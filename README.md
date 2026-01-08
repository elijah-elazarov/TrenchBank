# 🏦 TrenchBank - Memecoin Staking

Solana memecoin staking platform built with Anchor & Next.js.

## Quick Start

```bash
# Install deps
yarn install && cd app && yarn install

# Build program
anchor build

# Deploy to devnet
anchor deploy --provider.cluster devnet

# Start frontend
cd app && yarn dev
```

## Structure

- `programs/memecoin-staking/` - Anchor program (Rust)
- `app/` - Next.js frontend
- `tests/` - Anchor tests

## Features

- ⚡ Instant stake/unstake
- 💰 Real-time rewards
- 🔒 Configurable lock periods
- 🔌 Multi-wallet support

## License

MIT

