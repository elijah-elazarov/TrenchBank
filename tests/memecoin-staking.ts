import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { MemecoinStaking } from "../target/types/memecoin_staking";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { assert } from "chai";

describe("memecoin-staking", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.MemecoinStaking as Program<MemecoinStaking>;
  const authority = provider.wallet;

  let stakingMint: anchor.web3.PublicKey;
  let rewardMint: anchor.web3.PublicKey;
  let pool: anchor.web3.PublicKey;
  let poolVault: anchor.web3.PublicKey;
  let rewardVault: anchor.web3.PublicKey;
  let userStakeAccount: anchor.web3.PublicKey;
  let userTokenAccount: anchor.web3.PublicKey;
  let userRewardAccount: anchor.web3.PublicKey;

  const REWARD_RATE = new anchor.BN(1_000_000); // 0.001 tokens per second per token staked
  const LOCK_PERIOD = new anchor.BN(0); // No lock for testing
  const STAKE_AMOUNT = new anchor.BN(100_000_000); // 100 tokens (with 6 decimals)

  before(async () => {
    // Create staking token mint
    stakingMint = await createMint(
      provider.connection,
      (authority as any).payer,
      authority.publicKey,
      null,
      6
    );

    // Create reward token mint
    rewardMint = await createMint(
      provider.connection,
      (authority as any).payer,
      authority.publicKey,
      null,
      6
    );

    // Derive PDAs
    [pool] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("pool"), stakingMint.toBuffer()],
      program.programId
    );

    [poolVault] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("pool_vault"), pool.toBuffer()],
      program.programId
    );

    [rewardVault] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("reward_vault"), pool.toBuffer()],
      program.programId
    );

    [userStakeAccount] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("user_stake"), pool.toBuffer(), authority.publicKey.toBuffer()],
      program.programId
    );

    // Create user token accounts
    const userStakingATA = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      (authority as any).payer,
      stakingMint,
      authority.publicKey
    );
    userTokenAccount = userStakingATA.address;

    const userRewardATA = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      (authority as any).payer,
      rewardMint,
      authority.publicKey
    );
    userRewardAccount = userRewardATA.address;

    // Mint tokens to user
    await mintTo(
      provider.connection,
      (authority as any).payer,
      stakingMint,
      userTokenAccount,
      authority.publicKey,
      1_000_000_000 // 1000 tokens
    );
  });

  it("Initializes stake pool", async () => {
    const tx = await program.methods
      .initializePool(REWARD_RATE, LOCK_PERIOD)
      .accounts({
        authority: authority.publicKey,
        pool,
        stakingMint,
        rewardMint,
        poolVault,
        rewardVault,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    console.log("Initialize pool tx:", tx);

    const poolAccount = await program.account.stakePool.fetch(pool);
    assert.equal(poolAccount.authority.toString(), authority.publicKey.toString());
    assert.equal(poolAccount.stakingMint.toString(), stakingMint.toString());
    assert.equal(poolAccount.rewardMint.toString(), rewardMint.toString());
    assert.equal(poolAccount.rewardRate.toString(), REWARD_RATE.toString());
    assert.equal(poolAccount.totalStaked.toString(), "0");
    assert.equal(poolAccount.paused, false);
  });

  it("Funds reward vault", async () => {
    // Mint reward tokens to user first
    await mintTo(
      provider.connection,
      (authority as any).payer,
      rewardMint,
      userRewardAccount,
      authority.publicKey,
      10_000_000_000 // 10,000 reward tokens
    );

    const tx = await program.methods
      .fundRewards(new anchor.BN(5_000_000_000))
      .accounts({
        funder: authority.publicKey,
        pool,
        funderTokenAccount: userRewardAccount,
        rewardVault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log("Fund rewards tx:", tx);
  });

  it("Stakes tokens", async () => {
    const tx = await program.methods
      .stake(STAKE_AMOUNT)
      .accounts({
        user: authority.publicKey,
        pool,
        userStake: userStakeAccount,
        userTokenAccount,
        poolVault,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log("Stake tx:", tx);

    const userStake = await program.account.userStake.fetch(userStakeAccount);
    assert.equal(userStake.stakedAmount.toString(), STAKE_AMOUNT.toString());
    assert.equal(userStake.owner.toString(), authority.publicKey.toString());

    const poolAccount = await program.account.stakePool.fetch(pool);
    assert.equal(poolAccount.totalStaked.toString(), STAKE_AMOUNT.toString());
  });

  it("Claims rewards after some time", async () => {
    // Wait a bit for rewards to accumulate
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const beforeBalance = await provider.connection.getTokenAccountBalance(userRewardAccount);

    const tx = await program.methods
      .claimRewards()
      .accounts({
        user: authority.publicKey,
        pool,
        userStake: userStakeAccount,
        userRewardAccount,
        rewardVault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log("Claim rewards tx:", tx);

    const afterBalance = await provider.connection.getTokenAccountBalance(userRewardAccount);
    const rewardsClaimed =
      Number(afterBalance.value.amount) - Number(beforeBalance.value.amount);

    console.log("Rewards claimed:", rewardsClaimed);
    assert.isAbove(rewardsClaimed, 0, "Should have claimed some rewards");
  });

  it("Unstakes tokens", async () => {
    const beforeBalance = await provider.connection.getTokenAccountBalance(userTokenAccount);

    const tx = await program.methods
      .unstake(STAKE_AMOUNT)
      .accounts({
        user: authority.publicKey,
        pool,
        userStake: userStakeAccount,
        userTokenAccount,
        poolVault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log("Unstake tx:", tx);

    const afterBalance = await provider.connection.getTokenAccountBalance(userTokenAccount);
    const tokensReturned =
      Number(afterBalance.value.amount) - Number(beforeBalance.value.amount);

    assert.equal(tokensReturned, STAKE_AMOUNT.toNumber());

    const userStake = await program.account.userStake.fetch(userStakeAccount);
    assert.equal(userStake.stakedAmount.toString(), "0");

    const poolAccount = await program.account.stakePool.fetch(pool);
    assert.equal(poolAccount.totalStaked.toString(), "0");
  });

  it("Updates reward rate (admin)", async () => {
    const newRate = new anchor.BN(2_000_000);

    const tx = await program.methods
      .updateRewardRate(newRate)
      .accounts({
        authority: authority.publicKey,
        pool,
      })
      .rpc();

    console.log("Update reward rate tx:", tx);

    const poolAccount = await program.account.stakePool.fetch(pool);
    assert.equal(poolAccount.rewardRate.toString(), newRate.toString());
  });

  it("Pauses and unpauses pool", async () => {
    // Pause
    await program.methods
      .setPaused(true)
      .accounts({
        authority: authority.publicKey,
        pool,
      })
      .rpc();

    let poolAccount = await program.account.stakePool.fetch(pool);
    assert.equal(poolAccount.paused, true);

    // Try to stake while paused (should fail)
    try {
      await program.methods
        .stake(STAKE_AMOUNT)
        .accounts({
          user: authority.publicKey,
          pool,
          userStake: userStakeAccount,
          userTokenAccount,
          poolVault,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();
      assert.fail("Should have thrown error");
    } catch (err: any) {
      assert.include(err.toString(), "PoolPaused");
    }

    // Unpause
    await program.methods
      .setPaused(false)
      .accounts({
        authority: authority.publicKey,
        pool,
      })
      .rpc();

    poolAccount = await program.account.stakePool.fetch(pool);
    assert.equal(poolAccount.paused, false);
  });
});

