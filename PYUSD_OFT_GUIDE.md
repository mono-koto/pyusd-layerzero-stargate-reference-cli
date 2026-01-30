# Cross-Chain PYUSD Transfers via Stargate

A guide to transferring PYUSD across chains using the Stargate Finance API.

## Overview

PYUSD (PayPal USD) is available on multiple chains. Stargate Finance provides a simple API for cross-chain transfers with zero slippage.

**Two token types:**
- **PYUSD** - Native PayPal USD on Ethereum and Arbitrum
- **PYUSD0** - Synthetic representation on Avalanche, Sei, Ink, Abstract, Plume

## How It Works

1. Call Stargate's `/quotes` API with source/destination tokens
2. API returns executable transactions (approve + bridge)
3. Execute transactions sequentially
4. Track delivery on LayerZero Scan

## Quick Start

### Get a Quote

```typescript
const response = await fetch('https://stargate.finance/api/v1/quotes?' + new URLSearchParams({
  srcToken: '0x46850ad61c2b7d64d08c9c754f45254596696984', // PYUSD on Arbitrum
  dstToken: '0x142cdc44890978b506e745bb3bd11607b7f7faef', // PYUSD0 on Avalanche
  srcAddress: '0xYourAddress',
  dstAddress: '0xYourAddress',
  srcChainKey: 'arbitrum',
  dstChainKey: 'avalanche',
  srcAmount: '100000000',  // 100 PYUSD (6 decimals)
  dstAmountMin: '99500000' // Min receive (0.5% slippage)
}));

const data = await response.json();
const quote = data.quotes[0];
// quote.steps contains transactions to execute
```

### Execute Transfer

```typescript
for (const step of quote.steps) {
  const hash = await walletClient.sendTransaction({
    to: step.transaction.to,
    data: step.transaction.data,
    value: step.transaction.value ? BigInt(step.transaction.value) : undefined,
  });
  await publicClient.waitForTransactionReceipt({ hash });
}
```

### Track Delivery

After the bridge transaction confirms:
```
https://layerzeroscan.com/tx/{bridgeTxHash}
```

## Token Addresses

### PYUSD
| Chain | Address |
|-------|---------|
| Ethereum | `0x6c3ea9036406852006290770bedfcaba0e23a0e8` |
| Arbitrum | `0x46850ad61c2b7d64d08c9c754f45254596696984` |

### PYUSD0
| Chain | Address |
|-------|---------|
| Avalanche | `0x142cdc44890978b506e745bb3bd11607b7f7faef` |
| Sei | `0x142cdc44890978b506e745bb3bd11607b7f7faef` |
| Ink | `0x142cdc44890978b506e745bb3bd11607b7f7faef` |
| Abstract | `0x142cdc44890978b506e745bb3bd11607b7f7faef` |
| Plume | `0x142cdc44890978b506e745bb3bd11607b7f7faef` |

## Supported Routes

**Direct routes:**
- Ethereum ↔ Arbitrum
- Arbitrum ↔ Avalanche, Sei, Ink, Abstract, Plume
- Avalanche ↔ Sei ↔ Ink ↔ Abstract ↔ Plume

**Two-hop routes (via Arbitrum):**
- Ethereum → PYUSD0 chains: Go through Arbitrum first

## Complete Example

```typescript
import { createPublicClient, createWalletClient, http, erc20Abi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrum } from 'viem/chains';

const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`;
const PYUSD_ARBITRUM = '0x46850ad61c2b7d64d08c9c754f45254596696984';
const PYUSD0_AVALANCHE = '0x142cdc44890978b506e745bb3bd11607b7f7faef';

async function transfer(amount: string) {
  const account = privateKeyToAccount(PRIVATE_KEY);

  const publicClient = createPublicClient({
    chain: arbitrum,
    transport: http()
  });

  const walletClient = createWalletClient({
    account,
    chain: arbitrum,
    transport: http()
  });

  // 1. Check balance
  const balance = await publicClient.readContract({
    abi: erc20Abi,
    address: PYUSD_ARBITRUM,
    functionName: 'balanceOf',
    args: [account.address]
  });

  const amountWei = BigInt(parseFloat(amount) * 1e6);
  if (balance < amountWei) {
    throw new Error(`Insufficient balance`);
  }

  // 2. Get quote
  const minAmount = (amountWei * 995n / 1000n).toString();

  const quoteResponse = await fetch('https://stargate.finance/api/v1/quotes?' + new URLSearchParams({
    srcToken: PYUSD_ARBITRUM,
    dstToken: PYUSD0_AVALANCHE,
    srcAddress: account.address,
    dstAddress: account.address,
    srcChainKey: 'arbitrum',
    dstChainKey: 'avalanche',
    srcAmount: amountWei.toString(),
    dstAmountMin: minAmount
  }));

  const data = await quoteResponse.json();
  if (!data.quotes?.length) throw new Error('No routes available');

  const quote = data.quotes[0];

  // 3. Execute steps
  let bridgeTxHash: string | undefined;

  for (const step of quote.steps) {
    const hash = await walletClient.sendTransaction({
      to: step.transaction.to,
      data: step.transaction.data,
      value: step.transaction.value ? BigInt(step.transaction.value) : undefined,
    });

    await publicClient.waitForTransactionReceipt({ hash });

    if (step.type === 'bridge') bridgeTxHash = hash;
  }

  console.log(`Track: https://layerzeroscan.com/tx/${bridgeTxHash}`);
}

transfer('10').catch(console.error);
```

## Using the CLI

```bash
# Check balance
npm run cli balance arbitrum --address 0x...

# Get quote
npm run cli quote arbitrum avalanche 100 --address 0x...

# Transfer (requires PRIVATE_KEY env var)
npm run cli transfer arbitrum avalanche 100

# Dry run
npm run cli transfer arbitrum avalanche 100 --dry-run
```

## Resources

- [Stargate Finance](https://stargate.finance)
- [Stargate API Docs](https://docs.stargate.finance)
- [LayerZero Scan](https://layerzeroscan.com)
