# pyusd-lz

A CLI tool for cross-chain PYUSD transfers using LayerZero.

## Overview

This CLI tool demonstrates cross-chain PYUSD transfers using LayerZero's Omnichain Fungible Token (OFT) standard. Built with TypeScript, viem, and official LayerZero utilities.

**See [PYUSD_OFT_GUIDE.md](./PYUSD_OFT_GUIDE.md) for a detailed technical guide on implementing cross-chain OFT transfers.**

### Supported Chains

PYUSD is deployed across two LayerZero OFT meshes:

**PYUSD Mesh** (OFTAdapter - lock/unlock):
| Chain     | EID   | Chain ID |
|-----------|-------|----------|
| Ethereum  | 30101 | 1        |
| Arbitrum  | 30110 | 42161    |
| Flow      | 30336 | 747      |
| Glue      | 30342 | 1300     |

**PYUSD0 Mesh** (ProxyOFT - mint/burn):
| Chain      | EID   | Chain ID |
|------------|-------|----------|
| Polygon    | 30109 | 137      |
| Arbitrum   | 30110 | 42161    |
| Avalanche  | 30106 | 43114    |
| Sei        | 30280 | 1329     |
| Ink        | 30339 | 57073    |
| Abstract   | 30324 | 2741     |
| Fraxtal    | 30255 | 252      |

### Routing

The two meshes are **not directly connected**. Transfers can only occur between chains within the same mesh:

```
PYUSD Mesh:     Ethereum ←→ Arbitrum ←→ Flow ←→ Glue
                               ↕
PYUSD0 Mesh:               Arbitrum ←→ Polygon ←→ Avalanche ←→ Sei ←→ ...
```

**Valid routes:**
- Ethereum ↔ Arbitrum ✓ (both in PYUSD mesh)
- Polygon ↔ Arbitrum ✓ (both in PYUSD0 mesh)
- Polygon ↔ Avalanche ✓ (both in PYUSD0 mesh)

**Invalid routes:**
- Polygon → Ethereum ✗ (different meshes, no peer configured)
- Sei → Ethereum ✗ (different meshes)

**Arbitrum is a bridge:** To transfer between meshes (e.g., Polygon → Ethereum), you must do a two-hop transfer through Arbitrum:
1. Polygon → Arbitrum (PYUSD0 mesh)
2. Arbitrum → Ethereum (PYUSD mesh)

The CLI automatically selects the correct OFT contract based on your destination chain.

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Set your private key:

```bash
PRIVATE_KEY=0x...
```

Optionally configure custom RPC endpoints for better performance:

```bash
RPC_ETHEREUM=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
RPC_ARBITRUM=https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY
RPC_POLYGON=https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY
```

## Usage

### List Supported Chains

```bash
npm run cli chains
```

Output shows both OFT meshes:
```
PYUSD Chains
───────────────────────────────────────────────────────────────────────────────
Chain          EID      Type         Operation      OFT Address
───────────────────────────────────────────────────────────────────────────────
ethereum       30101    OFTAdapter   lock/unlock    0xa2c323fe5a74adffad2bf3e007e36bb029606444
arbitrum       30110    OFTAdapter   lock/unlock    0xfab5891ed867a1195303251912013b92c4fc3a1d

PYUSD0 Chains
───────────────────────────────────────────────────────────────────────────────
polygon        30109    ProxyOFT     mint/burn      0x26d27d5af2f6f1c14f40013c8619d97aaf015509
arbitrum       30110    ProxyOFT     mint/burn      0x3cd2b89c49d130c08f1d683225b2e5deb63ff876
...

Total: 13 chains (4 PYUSD + 9 PYUSD0)
```

### Check PYUSD Balance

```bash
# Using your wallet (requires PRIVATE_KEY)
npm run cli balance ethereum

# Check a specific address
npm run cli balance arbitrum --address 0x1234...
```

### Get Transfer Quote

Get a fee estimate before sending:

```bash
npm run cli quote ethereum arbitrum 100
```

Output:
```
PYUSD Transfer Quote
──────────────────────────────────────────────────
Source:         Ethereum (EID: 30101)
Destination:    Arbitrum (EID: 30110)
Recipient:      0x1234...
Amount:         100 PYUSD

Fees
──────────────────────────────────────────────────
LayerZero Fee:  0.00123 ETH

Amounts
──────────────────────────────────────────────────
Amount Sent:     100.00 PYUSD
Amount Received: 100.00 PYUSD
Min Received:    99.50 PYUSD (0.5% slippage)

Limits
──────────────────────────────────────────────────
Min Transfer:   0.000001 PYUSD
Max Transfer:   1000000.00 PYUSD
```

### Transfer PYUSD Cross-Chain

```bash
# Transfer to yourself on another chain
npm run cli transfer ethereum arbitrum 100

# Transfer to a different recipient
npm run cli transfer ethereum arbitrum 100 --to 0x5678...

# Dry run (simulate without sending)
npm run cli transfer ethereum arbitrum 100 --dry-run

# Custom slippage tolerance
npm run cli transfer ethereum arbitrum 100 --slippage 1
```

### Check Transfer Status

Track the status of a cross-chain transfer using the LayerZero Scan API:

```bash
npm run cli status 0xe4439a92601ec6b8f6698acc2821721fa58c9d81dd4c1c30f3e80bc251d138f8
```

Output:
```
Cross-Chain Transfer Status
────────────────────────────────────────────────────────────
Status:       ✓ DELIVERED
Message:      Executor transaction confirmed
GUID:         0x8acd9553...

Source
────────────────────────────────────────────────────────────
Chain:        ethereum
From:         0x5555...562A
TX Hash:      0xe4439a92...
Timestamp:    1/6/2026, 9:46:59 AM

Destination
────────────────────────────────────────────────────────────
Chain:        arbitrum
TX Hash:      0xe917e041...
Timestamp:    1/6/2026, 9:50:12 AM
```

### Update Chain Metadata

Fetch latest PYUSD chain configurations from the LayerZero metadata API:

```bash
npm run cli update-metadata
```

## Command Reference

### `chains`

List all supported PYUSD chains.

**Flags:**
- `--format, -f` - Output format: `table` (default) or `json`

### `balance <chain>`

Check PYUSD balance on a chain.

**Arguments:**
- `chain` - Chain name (ethereum, arbitrum, polygon, or testnet equivalents)

**Flags:**
- `--address, -a` - Address to check (defaults to your wallet)

### `quote <source> <destination> <amount>`

Get a fee quote for a cross-chain transfer.

**Arguments:**
- `source` - Source chain
- `destination` - Destination chain
- `amount` - Amount of PYUSD

**Flags:**
- `--to` - Recipient address (defaults to sender)
- `--slippage` - Slippage tolerance in percent (default: 0.5)
- `--gas` - Gas limit for destination execution (default: 200000)

### `transfer <source> <destination> <amount>`

Execute a cross-chain PYUSD transfer.

**Arguments:**
- `source` - Source chain
- `destination` - Destination chain
- `amount` - Amount of PYUSD

**Flags:**
- `--to` - Recipient address (defaults to sender)
- `--slippage` - Slippage tolerance in percent (default: 0.5)
- `--gas` - Gas limit for destination execution (default: 200000)
- `--dry-run` - Simulate without sending

### `status <txHash>`

Check the status of a cross-chain transfer using LayerZero Scan API.

**Arguments:**
- `txHash` - Source chain transaction hash

### `update-metadata`

Fetch PYUSD/PYUSD0 chain configurations from LayerZero metadata API.

**Flags:**
- `--output` - Output file path (default: config/chains.json)

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PRIVATE_KEY` | Your wallet private key for signing transactions | Yes (for transfer/balance) |
| `RPC_ETHEREUM` | Custom Ethereum RPC endpoint | No |
| `RPC_ARBITRUM` | Custom Arbitrum RPC endpoint | No |
| `RPC_POLYGON` | Custom Polygon RPC endpoint | No |
| `RPC_<CHAIN>` | Custom RPC for any chain (e.g., `RPC_AVALANCHE`) | No |

## How It Works

PYUSD uses LayerZero's Omnichain Fungible Token (OFT) standard for cross-chain transfers:

1. **Quote** - Fetch LayerZero messaging fees from the source chain's OFT contract
2. **Approval** - Automatically approve if the OFT adapter requires ERC20 approval
3. **Transfer** - Call OFT `send()` with destination chain, recipient, and amount
4. **Delivery** - LayerZero DVNs verify and deliver the message to the destination chain
5. **Receive** - Destination OFT calls `lzReceive()` to mint/unlock tokens to the recipient
6. **Track** - Monitor status via LayerZero Scan API using the transaction GUID

## Architecture

```
src/
├── commands/              # CLI command implementations
│   ├── balance.ts        # Check PYUSD balance
│   ├── chains.ts         # List supported chains
│   ├── update-metadata.ts # Fetch config from LayerZero API
│   ├── quote.ts          # Get transfer quote
│   ├── transfer.ts       # Execute transfer
│   └── status.ts         # Check transfer status
├── lib/                   # Core library functions
│   ├── chains.ts         # Chain configs + smart mesh resolution
│   ├── client.ts         # Viem client factory
│   ├── oft.ts            # OFT contract interactions
│   ├── options.ts        # LayerZero options encoding
│   └── send-preparation.ts # SendParam builder
├── types/
│   └── index.ts          # TypeScript interfaces
└── utils/
    ├── address.ts        # Address utilities (bytes32 encoding)
    └── format.ts         # PYUSD formatting (6 decimals)

config/
└── chains.json           # PYUSD + PYUSD0 chain configurations
```

**Key Dependencies:**
- `viem` - Ethereum client with built-in ERC20 ABI
- `@layerzerolabs/lz-v2-utilities` - Official LayerZero utilities (Options encoding)
- `commander` - CLI framework

## Development

This project uses [mise](https://mise.jdx.dev/) for tool version management. The `mise.toml` file specifies Node.js 22 as the required version. If you have mise installed, it will automatically use the correct Node version when you enter the project directory.

```bash
# Run CLI directly with tsx
npm run cli chains

# Build (type check)
npm run build

# Lint
npm run lint

# Format
npm run format
```

## Resources

- [LayerZero Documentation](https://docs.layerzero.network)
- [OFT Standard](https://docs.layerzero.network/v2/developers/evm/oft/quickstart)
- [LayerZero Scan](https://layerzeroscan.com) - Track cross-chain transactions
- [PYUSD](https://www.paypal.com/us/digital-wallet/manage-money/crypto/pyusd) - PayPal USD Stablecoin
- [Paxos PYUSD Testnet](https://docs.paxos.com/guides/stablecoin/pyusd/testnet) - Get testnet PYUSD

## License

MIT
