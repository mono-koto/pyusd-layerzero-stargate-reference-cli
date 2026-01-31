# PYUSD LayerZero Stargate Transfers

A CLI tool implementing all [PYUSD and PYUSD0 cross-chain transfers via LayerZero Stargate Hydra](https://layerzero.network/blog/LayerZero%20brings%20Global%20Distribution%20to%20PayPal%20USD).

## Overview

Transfer PYUSD/PYUSD0 across chains using the Stargate Finance API. Zero slippage, 1:1 rate.

**Developer Guides:**
- [PYUSD_STARGATE_DEV_GUIDE.md](./PYUSD_STARGATE_DEV_GUIDE.md) — Technical guide with code examples for PYUSD transfers
- [PYUSD0_DEV_SUPPLEMENT.md](./PYUSD0_DEV_SUPPLEMENT.md) — PYUSD0 mesh network transfers (Ink, Plume, Avalanche, etc.)

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
```

**Using 1Password:** If your private keys are stored in 1Password, use `op run`:

```bash
# .env with 1Password references
PRIVATE_KEY=op://vault/item/evm-key
SOLANA_PRIVATE_KEY=op://vault/item/solana-key

# Run commands with op
op run --env-file=.env -- npm run cli transfer solana ethereum 10
```

### Custom RPC Endpoints

The CLI uses public RPC endpoints by default, which may be rate-limited or unreliable. For production use, configure custom RPCs:

```bash
# Format: RPC_<CHAIN_NAME_UPPERCASE>=<url>
RPC_ETHEREUM=https://eth-mainnet.g.alchemy.com/v2/your-key
RPC_ARBITRUM=https://arb-mainnet.g.alchemy.com/v2/your-key
RPC_AVALANCHE=https://api.avax.network/ext/bc/C/rpc
RPC_POLYGON=https://polygon-mainnet.g.alchemy.com/v2/your-key
RPC_SOLANA=https://api.mainnet-beta.solana.com
```

**Supported chains:** Any chain can have a custom RPC. Use the chain name in uppercase (e.g., `RPC_SEI`, `RPC_INK`, `RPC_FRAXTAL`).

**Recommended providers:**
- [Alchemy](https://alchemy.com) - Ethereum, Arbitrum, Polygon, Solana
- [Infura](https://infura.io) - Ethereum, Arbitrum, Polygon, Avalanche
- [QuickNode](https://quicknode.com) - All major chains

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
