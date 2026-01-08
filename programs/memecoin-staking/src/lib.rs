use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use anchor_spl::token_interface::{Mint as MintInterface, TokenAccount as TokenAccountInterface, TokenInterface};

declare_id!("2RoYimfnkSHZTFrjzLNYt5DSJKPm6VHRbg2k3sfmyCDB");

#[program]
pub mod memecoin_staking {
    use super::*;

    /// Initialize a new staking pool for a memecoin
    pub fn initialize_pool(
        ctx: Context<InitializePool>,
        reward_rate: u64,    // Rewards per second per token (scaled by 1e18)
        lock_period: i64,    // Minimum stake duration in seconds
        min_stake_amount: u64, // Minimum tokens required to stake (in base units)
    ) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        pool.authority = ctx.accounts.authority.key();
        pool.staking_mint = ctx.accounts.staking_mint.key();
        pool.reward_mint = ctx.accounts.reward_mint.key();
        pool.pool_vault = ctx.accounts.pool_vault.key();
        pool.reward_vault = ctx.accounts.reward_vault.key();
        pool.reward_rate = reward_rate;
        pool.lock_period = lock_period;
        pool.min_stake_amount = min_stake_amount;
        pool.total_staked = 0;
        pool.last_update_time = Clock::get()?.unix_timestamp;
        pool.paused = false;
        pool.bump = ctx.bumps.pool;

        emit!(PoolInitialized {
            pool: ctx.accounts.pool.key(),
            staking_mint: ctx.accounts.staking_mint.key(),
            reward_mint: ctx.accounts.reward_mint.key(),
            reward_rate,
            lock_period,
            min_stake_amount,
        });

        Ok(())
    }

    /// Stake tokens into the pool
    pub fn stake(ctx: Context<Stake>, amount: u64) -> Result<()> {
        require!(amount > 0, StakingError::InvalidAmount);
        require!(!ctx.accounts.pool.paused, StakingError::PoolPaused);
        
        // Check minimum stake requirement
        let new_total = ctx.accounts.user_stake.staked_amount
            .checked_add(amount)
            .ok_or(StakingError::MathOverflow)?;
        require!(
            new_total >= ctx.accounts.pool.min_stake_amount,
            StakingError::BelowMinimumStake
        );

        let pool = &mut ctx.accounts.pool;
        let user_stake = &mut ctx.accounts.user_stake;
        let clock = Clock::get()?;

        // Initialize user stake account if first time
        if user_stake.owner == Pubkey::default() {
            user_stake.owner = ctx.accounts.user.key();
            user_stake.pool = pool.key();
            user_stake.bump = ctx.bumps.user_stake;
        }

        // Calculate pending rewards before updating stake
        if user_stake.staked_amount > 0 {
            let pending = calculate_pending_rewards(
                user_stake.staked_amount,
                user_stake.last_stake_time,
                clock.unix_timestamp,
                pool.reward_rate,
            );
            user_stake.pending_rewards = user_stake
                .pending_rewards
                .checked_add(pending)
                .ok_or(StakingError::MathOverflow)?;
        }

        // Transfer tokens to vault using token interface
        let cpi_accounts = anchor_spl::token_interface::TransferChecked {
            from: ctx.accounts.user_token_account.to_account_info(),
            mint: ctx.accounts.staking_mint.to_account_info(),
            to: ctx.accounts.pool_vault.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_program = ctx.accounts.staking_token_program.to_account_info();
        
        let decimals = ctx.accounts.staking_mint.decimals;
        anchor_spl::token_interface::transfer_checked(
            CpiContext::new(cpi_program, cpi_accounts),
            amount,
            decimals,
        )?;

        // Update state
        user_stake.staked_amount = user_stake
            .staked_amount
            .checked_add(amount)
            .ok_or(StakingError::MathOverflow)?;
        user_stake.last_stake_time = clock.unix_timestamp;
        
        // Only set start time if this is a new stake
        if user_stake.stake_start_time == 0 {
            user_stake.stake_start_time = clock.unix_timestamp;
        }

        pool.total_staked = pool
            .total_staked
            .checked_add(amount)
            .ok_or(StakingError::MathOverflow)?;
        pool.last_update_time = clock.unix_timestamp;

        emit!(StakeEvent {
            user: ctx.accounts.user.key(),
            pool: pool.key(),
            amount,
            total_staked: user_stake.staked_amount,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Unstake tokens from the pool
    pub fn unstake(ctx: Context<Unstake>, amount: u64) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        let user_stake = &mut ctx.accounts.user_stake;
        let clock = Clock::get()?;

        require!(amount > 0, StakingError::InvalidAmount);
        require!(
            user_stake.staked_amount >= amount,
            StakingError::InsufficientStake
        );

        // Check lock period
        let time_staked = clock
            .unix_timestamp
            .checked_sub(user_stake.stake_start_time)
            .ok_or(StakingError::MathOverflow)?;
        require!(time_staked >= pool.lock_period, StakingError::StillLocked);

        // Calculate and store pending rewards
        let pending = calculate_pending_rewards(
            user_stake.staked_amount,
            user_stake.last_stake_time,
            clock.unix_timestamp,
            pool.reward_rate,
        );
        user_stake.pending_rewards = user_stake
            .pending_rewards
            .checked_add(pending)
            .ok_or(StakingError::MathOverflow)?;

        // Transfer tokens back to user using PDA signer
        let staking_mint_key = pool.staking_mint;
        let seeds = &[
            b"pool".as_ref(),
            staking_mint_key.as_ref(),
            &[pool.bump],
        ];
        let signer = &[&seeds[..]];

        let cpi_accounts = anchor_spl::token_interface::TransferChecked {
            from: ctx.accounts.pool_vault.to_account_info(),
            mint: ctx.accounts.staking_mint.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: pool.to_account_info(),
        };
        let decimals = ctx.accounts.staking_mint.decimals;
        anchor_spl::token_interface::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.staking_token_program.to_account_info(),
                cpi_accounts,
                signer,
            ),
            amount,
            decimals,
        )?;

        // Update state
        user_stake.staked_amount = user_stake
            .staked_amount
            .checked_sub(amount)
            .ok_or(StakingError::MathOverflow)?;
        user_stake.last_stake_time = clock.unix_timestamp;

        pool.total_staked = pool
            .total_staked
            .checked_sub(amount)
            .ok_or(StakingError::MathOverflow)?;
        pool.last_update_time = clock.unix_timestamp;

        // Reset stake start time if fully unstaked
        if user_stake.staked_amount == 0 {
            user_stake.stake_start_time = 0;
        }

        emit!(UnstakeEvent {
            user: ctx.accounts.user.key(),
            pool: pool.key(),
            amount,
            remaining_stake: user_stake.staked_amount,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Claim accumulated rewards
    pub fn claim_rewards(ctx: Context<ClaimRewards>) -> Result<()> {
        let pool = &ctx.accounts.pool;
        let user_stake = &mut ctx.accounts.user_stake;
        let clock = Clock::get()?;

        // Calculate total rewards
        let pending = calculate_pending_rewards(
            user_stake.staked_amount,
            user_stake.last_stake_time,
            clock.unix_timestamp,
            pool.reward_rate,
        );
        let total_rewards = user_stake
            .pending_rewards
            .checked_add(pending)
            .ok_or(StakingError::MathOverflow)?;

        require!(total_rewards > 0, StakingError::NoRewards);

        // Check reward vault balance
        require!(
            ctx.accounts.reward_vault.amount >= total_rewards,
            StakingError::InsufficientRewardBalance
        );

        // Transfer rewards using PDA signer
        let staking_mint = pool.staking_mint;
        let seeds = &[
            b"pool".as_ref(),
            staking_mint.as_ref(),
            &[pool.bump],
        ];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.reward_vault.to_account_info(),
            to: ctx.accounts.user_reward_account.to_account_info(),
            authority: ctx.accounts.pool.to_account_info(),
        };
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts,
                signer,
            ),
            total_rewards,
        )?;

        // Reset pending rewards and update timestamp
        user_stake.pending_rewards = 0;
        user_stake.last_stake_time = clock.unix_timestamp;
        user_stake.total_rewards_claimed = user_stake
            .total_rewards_claimed
            .checked_add(total_rewards)
            .ok_or(StakingError::MathOverflow)?;

        emit!(ClaimEvent {
            user: ctx.accounts.user.key(),
            pool: pool.key(),
            amount: total_rewards,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Update pool reward rate (admin only)
    pub fn update_reward_rate(ctx: Context<AdminAction>, new_rate: u64) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        let old_rate = pool.reward_rate;
        pool.reward_rate = new_rate;
        pool.last_update_time = Clock::get()?.unix_timestamp;

        emit!(RewardRateUpdated {
            pool: pool.key(),
            old_rate,
            new_rate,
        });

        Ok(())
    }

    /// Pause/unpause the pool (admin only)
    pub fn set_paused(ctx: Context<AdminAction>, paused: bool) -> Result<()> {
        ctx.accounts.pool.paused = paused;

        emit!(PoolPausedEvent {
            pool: ctx.accounts.pool.key(),
            paused,
        });

        Ok(())
    }

    /// Fund the reward vault (anyone can fund)
    pub fn fund_rewards(ctx: Context<FundRewards>, amount: u64) -> Result<()> {
        require!(amount > 0, StakingError::InvalidAmount);

        let cpi_accounts = Transfer {
            from: ctx.accounts.funder_token_account.to_account_info(),
            to: ctx.accounts.reward_vault.to_account_info(),
            authority: ctx.accounts.funder.to_account_info(),
        };
        token::transfer(
            CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts),
            amount,
        )?;

        emit!(RewardsFunded {
            pool: ctx.accounts.pool.key(),
            funder: ctx.accounts.funder.key(),
            amount,
        });

        Ok(())
    }
}

// ============ HELPER FUNCTIONS ============

/// Scaling factor for reward rate precision (1e18)
const REWARD_SCALE: u128 = 1_000_000_000_000_000_000;

fn calculate_pending_rewards(
    staked_amount: u64,
    last_stake_time: i64,
    current_time: i64,
    reward_rate: u64,
) -> u64 {
    if staked_amount == 0 || last_stake_time >= current_time {
        return 0;
    }

    let time_elapsed = (current_time - last_stake_time) as u128;
    let staked = staked_amount as u128;
    let rate = reward_rate as u128;

    // rewards = staked_amount * reward_rate * time_elapsed / 1e18
    staked
        .checked_mul(rate)
        .and_then(|v| v.checked_mul(time_elapsed))
        .and_then(|v| v.checked_div(REWARD_SCALE))
        .map(|v| v as u64)
        .unwrap_or(0)
}

// ============ ACCOUNT CONTEXTS ============

#[derive(Accounts)]
pub struct InitializePool<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + StakePool::INIT_SPACE,
        seeds = [b"pool", staking_mint.key().as_ref()],
        bump
    )]
    pub pool: Account<'info, StakePool>,

    /// The staking token mint (can be Token or Token-2022)
    pub staking_mint: InterfaceAccount<'info, MintInterface>,
    /// The reward token mint (USDC - regular Token program)
    pub reward_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = authority,
        token::mint = staking_mint,
        token::authority = pool,
        token::token_program = staking_token_program,
        seeds = [b"pool_vault", pool.key().as_ref()],
        bump
    )]
    pub pool_vault: InterfaceAccount<'info, TokenAccountInterface>,

    #[account(
        init,
        payer = authority,
        token::mint = reward_mint,
        token::authority = pool,
        seeds = [b"reward_vault", pool.key().as_ref()],
        bump
    )]
    pub reward_vault: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    /// Token program for staking token (Token or Token-2022)
    pub staking_token_program: Interface<'info, TokenInterface>,
    /// Token program for reward token (regular Token)
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"pool", pool.staking_mint.as_ref()],
        bump = pool.bump,
    )]
    pub pool: Account<'info, StakePool>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + UserStake::INIT_SPACE,
        seeds = [b"user_stake", pool.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub user_stake: Account<'info, UserStake>,

    /// The staking token mint
    #[account(
        constraint = staking_mint.key() == pool.staking_mint @ StakingError::InvalidMint,
    )]
    pub staking_mint: InterfaceAccount<'info, MintInterface>,

    #[account(
        mut,
        constraint = user_token_account.owner == user.key() @ StakingError::InvalidOwner,
        constraint = user_token_account.mint == pool.staking_mint @ StakingError::InvalidMint,
    )]
    pub user_token_account: InterfaceAccount<'info, TokenAccountInterface>,

    #[account(
        mut,
        seeds = [b"pool_vault", pool.key().as_ref()],
        bump,
    )]
    pub pool_vault: InterfaceAccount<'info, TokenAccountInterface>,

    pub system_program: Program<'info, System>,
    /// Token program for staking token (Token or Token-2022)
    pub staking_token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct Unstake<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"pool", pool.staking_mint.as_ref()],
        bump = pool.bump,
    )]
    pub pool: Account<'info, StakePool>,

    #[account(
        mut,
        seeds = [b"user_stake", pool.key().as_ref(), user.key().as_ref()],
        bump = user_stake.bump,
        constraint = user_stake.owner == user.key() @ StakingError::InvalidOwner,
    )]
    pub user_stake: Account<'info, UserStake>,

    /// The staking token mint
    #[account(
        constraint = staking_mint.key() == pool.staking_mint @ StakingError::InvalidMint,
    )]
    pub staking_mint: InterfaceAccount<'info, MintInterface>,

    #[account(
        mut,
        constraint = user_token_account.owner == user.key() @ StakingError::InvalidOwner,
        constraint = user_token_account.mint == pool.staking_mint @ StakingError::InvalidMint,
    )]
    pub user_token_account: InterfaceAccount<'info, TokenAccountInterface>,

    #[account(
        mut,
        seeds = [b"pool_vault", pool.key().as_ref()],
        bump,
    )]
    pub pool_vault: InterfaceAccount<'info, TokenAccountInterface>,

    /// Token program for staking token (Token or Token-2022)
    pub staking_token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct ClaimRewards<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        seeds = [b"pool", pool.staking_mint.as_ref()],
        bump = pool.bump,
    )]
    pub pool: Account<'info, StakePool>,

    #[account(
        mut,
        seeds = [b"user_stake", pool.key().as_ref(), user.key().as_ref()],
        bump = user_stake.bump,
        constraint = user_stake.owner == user.key() @ StakingError::InvalidOwner,
    )]
    pub user_stake: Account<'info, UserStake>,

    #[account(
        mut,
        constraint = user_reward_account.owner == user.key() @ StakingError::InvalidOwner,
        constraint = user_reward_account.mint == pool.reward_mint @ StakingError::InvalidMint,
    )]
    pub user_reward_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"reward_vault", pool.key().as_ref()],
        bump,
    )]
    pub reward_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct AdminAction<'info> {
    #[account(
        constraint = authority.key() == pool.authority @ StakingError::Unauthorized
    )]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"pool", pool.staking_mint.as_ref()],
        bump = pool.bump,
    )]
    pub pool: Account<'info, StakePool>,
}

#[derive(Accounts)]
pub struct FundRewards<'info> {
    #[account(mut)]
    pub funder: Signer<'info>,

    #[account(
        seeds = [b"pool", pool.staking_mint.as_ref()],
        bump = pool.bump,
    )]
    pub pool: Account<'info, StakePool>,

    #[account(
        mut,
        constraint = funder_token_account.owner == funder.key() @ StakingError::InvalidOwner,
        constraint = funder_token_account.mint == pool.reward_mint @ StakingError::InvalidMint,
    )]
    pub funder_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"reward_vault", pool.key().as_ref()],
        bump,
    )]
    pub reward_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

// ============ STATE ACCOUNTS ============

#[account]
#[derive(InitSpace)]
pub struct StakePool {
    /// Pool authority (admin)
    pub authority: Pubkey,
    /// Token mint for staking
    pub staking_mint: Pubkey,
    /// Token mint for rewards
    pub reward_mint: Pubkey,
    /// Vault holding staked tokens
    pub pool_vault: Pubkey,
    /// Vault holding reward tokens
    pub reward_vault: Pubkey,
    /// Rewards per second per staked token (scaled by 1e9)
    pub reward_rate: u64,
    /// Minimum stake lock period in seconds
    pub lock_period: i64,
    /// Minimum tokens required to stake
    pub min_stake_amount: u64,
    /// Total tokens staked in pool
    pub total_staked: u64,
    /// Last pool update timestamp
    pub last_update_time: i64,
    /// Whether pool is paused
    pub paused: bool,
    /// PDA bump seed
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct UserStake {
    /// User wallet
    pub owner: Pubkey,
    /// Associated pool
    pub pool: Pubkey,
    /// Amount currently staked
    pub staked_amount: u64,
    /// Unclaimed rewards
    pub pending_rewards: u64,
    /// Last stake/claim timestamp
    pub last_stake_time: i64,
    /// When the current stake period started
    pub stake_start_time: i64,
    /// Total rewards claimed all-time
    pub total_rewards_claimed: u64,
    /// PDA bump seed
    pub bump: u8,
}

// ============ EVENTS ============

#[event]
pub struct PoolInitialized {
    pub pool: Pubkey,
    pub staking_mint: Pubkey,
    pub reward_mint: Pubkey,
    pub reward_rate: u64,
    pub lock_period: i64,
    pub min_stake_amount: u64,
}

#[event]
pub struct StakeEvent {
    pub user: Pubkey,
    pub pool: Pubkey,
    pub amount: u64,
    pub total_staked: u64,
    pub timestamp: i64,
}

#[event]
pub struct UnstakeEvent {
    pub user: Pubkey,
    pub pool: Pubkey,
    pub amount: u64,
    pub remaining_stake: u64,
    pub timestamp: i64,
}

#[event]
pub struct ClaimEvent {
    pub user: Pubkey,
    pub pool: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct RewardRateUpdated {
    pub pool: Pubkey,
    pub old_rate: u64,
    pub new_rate: u64,
}

#[event]
pub struct PoolPausedEvent {
    pub pool: Pubkey,
    pub paused: bool,
}

#[event]
pub struct RewardsFunded {
    pub pool: Pubkey,
    pub funder: Pubkey,
    pub amount: u64,
}

// ============ ERRORS ============

#[error_code]
pub enum StakingError {
    #[msg("Invalid stake amount - must be greater than 0")]
    InvalidAmount,
    #[msg("Insufficient staked balance")]
    InsufficientStake,
    #[msg("Tokens are still in lock period")]
    StillLocked,
    #[msg("No rewards available to claim")]
    NoRewards,
    #[msg("Pool is currently paused")]
    PoolPaused,
    #[msg("Insufficient reward tokens in vault")]
    InsufficientRewardBalance,
    #[msg("Math overflow error")]
    MathOverflow,
    #[msg("Unauthorized - admin only")]
    Unauthorized,
    #[msg("Invalid token account owner")]
    InvalidOwner,
    #[msg("Invalid token mint")]
    InvalidMint,
    #[msg("Stake amount below minimum required")]
    BelowMinimumStake,
}

