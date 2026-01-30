# pyusd-lz

A CLI tool for cross-chain PYUSD transfers via Stargate Finance.

## Overview

Transfer PYUSD/PYUSD0 across chains using the Stargate Finance API. Zero slippage, 1:1 rate.

**See [PYUSD_OFT_GUIDE.md](./PYUSD_OFT_GUIDE.md) for a technical guide with code examples.**

## Supported Chains

Run `npm run cli update-chains` to fetch the latest from Stargate, or `npm run cli chains` to see what's configured.

**PYUSD** (Native PayPal USD):
- Ethereum, Arbitrum

**PYUSD0** (Synthetic):
- Avalanche, Sei, Ink, Abstract, Plume

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file:

```bash
# Required for transfers
PRIVATE_KEY=0x...

# Optional: Custom RPC endpoints
RPC_ETHEREUM=https://...
RPC_ARBITRUM=https://...
```

## Usage

### List Supported Chains

```bash
npm run cli chains
```

### Check Balance

```bash
npm run cli balance avalanche --address 0x...
```

### Get Transfer Quote

```bash
npm run cli quote arbitrum avalanche 100 --address 0x...
```

### Transfer

```bash
# Dry run first
npm run cli transfer arbitrum avalanche 100 --dry-run

# Execute
npm run cli transfer arbitrum avalanche 100
```

### Update Chain Data

```bash
npm run cli update-chains
```

## Routing Notes

- **PYUSD chains** (Ethereum, Arbitrum) can transfer to each other directly
- **PYUSD0 chains** (Avalanche, Sei, etc.) can transfer to each other directly
- **Cross-transfers** from Ethereum to PYUSD0 chains require going through Arbitrum first

## Commands

| Command | Description |
|---------|-------------|
| `chains` | List supported chains |
| `balance <chain>` | Check PYUSD balance |
| `quote <src> <dst> <amount>` | Get transfer quote |
| `transfer <src> <dst> <amount>` | Execute transfer |
| `status <txHash>` | Check transfer status |
| `update-chains` | Fetch latest chain config |

## Resources

- [Stargate Finance](https://stargate.finance)
- [LayerZero Scan](https://layerzeroscan.com) - Track cross-chain transfers
- [PYUSD](https://www.paypal.com/pyusd)

## License

MIT
