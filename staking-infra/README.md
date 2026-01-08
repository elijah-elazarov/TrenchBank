# $KryptCash Staking Infrastructure

A complete staking rewards system powered by **PumpSwap LP fees** and **Streamflow staking**.

## 🎯 How It Works

```
┌─────────────────────────────────────────────────────────────────────┐
│                    $KryptCash STAKING REWARDS FLOW                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   1. Launch $KryptCash on pump.fun                                       │
│                  ↓                                                  │
│   2. Token graduates → Auto-creates PumpSwap pool                   │
│                  ↓                                                  │
│   3. Every trade generates fees:                                    │
│      ├─ 0.20% → Liquidity Providers (optional)                      │
│      ├─ 0.05% → YOU (token creator) ← AUTOMATIC!                    │
│      └─ 0.05% → pump.fun protocol                                   │
│                  ↓                                                  │
│   4. Fee Router claims and deposits fees to Streamflow              │
│                  ↓                                                  │
│   5. Stakers (1M+ $KryptCash holders) earn proportional SOL rewards      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## 💰 Revenue Breakdown

| Daily Volume | Creator Earnings | LP Earnings* | Total to Stakers |
|--------------|------------------|--------------|------------------|
| $10,000      | $5/day          | $20/day      | Up to $25/day    |
| $50,000      | $25/day         | $100/day     | Up to $125/day   |
| $100,000     | $50/day         | $200/day     | Up to $250/day   |
| $500,000     | $250/day        | $1,000/day   | Up to $1,250/day |

*LP earnings require providing liquidity to the PumpSwap pool

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd staking-infra
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your settings
```

### 3. Launch Sequence

| Step | Action | Command |
|------|--------|---------|
| 1 | Launch token on pump.fun | (manual) |
| 2 | Wait for graduation | (automatic at ~$69k MC) |
| 3 | Get pool address | From pump.fun |
| 4 | Update .env | Set PUMPSWAP_POOL_ADDRESS |
| 5 | Setup Streamflow staking | `npm run setup:staking` |
| 6 | (Optional) Add LP | `npm run lp:add` |
| 7 | Start fee router | `npm run router:start` |

## 📦 Available Commands

### LP Management
```bash
npm run lp:add        # Add liquidity to PumpSwap pool
npm run lp:remove     # Remove liquidity
npm run lp:status     # Check your LP position
```

### Fee Collection
```bash
npm run claim:creator # Claim your creator fees (0.05%)
npm run router:start  # Collect fees and route to staking (once)
npm run router:dev    # Run fee router continuously
```

### Staking Setup
```bash
npm run setup:staking # Create Streamflow staking pool
npm run check:status  # Show full dashboard
```

## ⚙️ Configuration

### Staking Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| Min Stake | 1,000,000 $KryptCash | Minimum tokens to stake |
| Lock Period | 0 | No lock, claim anytime |
| Reward Token | SOL | Native SOL rewards |
| Distribution | Real-time | Proportional to stake |

### Fee Router

| Parameter | Default | Description |
|-----------|---------|-------------|
| Interval | 1 hour | How often to collect fees |
| Threshold | 0.01 SOL | Minimum to trigger routing |

## 🏗️ Architecture

```
staking-infra/
├── package.json              # Dependencies
├── tsconfig.json             # TypeScript config
├── .env.example              # Environment template
├── .env                      # Your config (gitignored)
└── src/
    ├── config.ts             # Shared configuration
    ├── pumpswap-lp.ts        # LP management
    ├── claim-creator-fees.ts # Creator fee claiming
    ├── fee-router.ts         # Auto fee routing
    ├── setup-streamflow.ts   # Staking pool setup
    └── check-status.ts       # Status dashboard
```

## 🔐 Security Notes

1. **Never commit your .env file** - Contains private keys
2. **Use a dedicated wallet** - For fee collection operations
3. **Test on devnet first** - Before mainnet deployment
4. **Monitor regularly** - Check status dashboard often

## 💡 Tips

### Maximizing Earnings

1. **Add liquidity** - Earn additional 0.20% on top of creator 0.05%
2. **More liquidity = more routing** - Aggregators route to pools with best prices
3. **Run router frequently** - Collect fees before they accumulate too long

### For Stakers

- Minimum 1,000,000 $KryptCash required
- No lock period - unstake anytime
- Rewards in native SOL
- Proportional to stake amount

## 📊 Monitoring

Check your status anytime:

```bash
npm run check:status
```

This shows:
- Wallet balance
- Token configuration
- PumpSwap pool status
- Streamflow staking status
- Earnings estimates

## 🆘 Troubleshooting

### "Pool not configured"
Set `PUMPSWAP_POOL_ADDRESS` in `.env` after token graduates

### "No pending fees"
Wait for trading activity on PumpSwap

### "Insufficient SOL"
Ensure wallet has SOL for transaction fees (~0.01 SOL)

## 📚 Resources

- [PumpSwap SDK](https://www.npmjs.com/package/@pump-fun/pump-swap-sdk)
- [Streamflow Docs](https://docs.streamflow.finance/)
- [pump.fun](https://pump.fun)

---

Built for **$KryptCash** 🚀
