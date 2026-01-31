# pyusd-lz

A CLI tool for cross-chain PYUSD transfers via Stargate Finance.

## Overview

Transfer PYUSD/PYUSD0 across chains using the Stargate Finance API. Zero slippage, 1:1 rate.

**See [PYUSD_OFT_GUIDE.md](./PYUSD_OFT_GUIDE.md) for a technical guide with code examples.**

## Supported Chains

Run `npm run cli update-chains` to fetch the latest from Stargate, or `npm run cli chains` to see what's configured.

**PYUSD** (Native PayPal USD):
- Ethereum, Arbitrum, Solana

**PYUSD0** (Synthetic via Stargate Hydra):
- Avalanche, Sei, Ink, Abstract, Plume, Polygon, Fraxtal, Codex, Flow, Stable, Tron*

*\*Tron is listed in Stargate's config but not yet supported by this CLI.*

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file:

```bash
# Required for EVM transfers (Ethereum, Arbitrum, etc.)
PRIVATE_KEY=0x...

# Required for Solana transfers (base58 or hex format)
SOLANA_PRIVATE_KEY=...

# Optional: Custom RPC endpoints
RPC_ETHEREUM=https://...
RPC_ARBITRUM=https://...
RPC_SOLANA=https://...
```

**Using 1Password:** If your private keys are stored in 1Password, use `op run`:

```bash
# .env with 1Password references
PRIVATE_KEY=op://vault/item/evm-key
SOLANA_PRIVATE_KEY=op://vault/item/solana-key

# Run commands with op
op run --env-file=.env -- npm run cli transfer solana ethereum 10
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

# Execute EVM transfer
npm run cli transfer arbitrum avalanche 100

# Execute Solana transfer (requires SOLANA_PRIVATE_KEY)
npm run cli transfer solana ethereum 100
```

### Update Chain Data

```bash
npm run cli update-chains
```

## Routing Notes

**EVM Routes:**
- **Ethereum ↔ Arbitrum**: Direct transfers supported
- **Arbitrum ↔ PYUSD0 chains**: Direct transfers to Avalanche, Sei, Ink, Abstract, Plume, etc.
- **PYUSD0 ↔ PYUSD0**: All PYUSD0 chains can transfer to each other (mesh network)
- **Ethereum → PYUSD0**: Requires two hops (Ethereum → Arbitrum → destination)

**Solana Routes:**
- **Solana ↔ Ethereum**: Direct transfers supported
- **Solana ↔ Arbitrum**: Not yet available in Stargate API
- **Solana → PYUSD0 chains**: Not yet available

**Solana Requirements:**
- Sender must have a PYUSD token account (ATA) on Solana
- The `--address` flag is required (Solana addresses cannot be derived from EVM keys)

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
