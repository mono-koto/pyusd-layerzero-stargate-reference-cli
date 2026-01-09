# Cross-Chain PYUSD Transfers with LayerZero OFT

_A technical guide to implementing cross-chain PYUSD transfers using LayerZero's OFT standard_

---

## Introduction

PYUSD (PayPal USD) is deployed across multiple blockchain networks. LayerZero enables cross-chain token transfers through its Omnichain Fungible Token (OFT) standard—no centralized bridges required.

This guide covers:

- How LayerZero's OFT standard works
- Building cross-chain transfer workflows with TypeScript and viem
- Working with binary encoding for cross-chain messages

**Prerequisites:** TypeScript/Node.js, basic Ethereum/smart contract knowledge.

The complete code is available at [github.com/mono-koto/pyusd-lz](https://github.com/mono-koto/pyusd-lz).

---

## Understanding the Stack

### LayerZero Basics

LayerZero is a messaging protocol for cross-chain smart contract communication:

- **Endpoint IDs (EIDs):** Each chain has a unique identifier (Ethereum: `30101`, Arbitrum: `30110`, Polygon: `30109`)
- **Security:** Decentralized Verifier Networks (DVNs) and Executors
- **Fees:** Paid in native currency on the source chain

### OFT: Omnichain Fungible Token

Two implementations exist:

| Type | Use Case | Mechanism | Approval Needed |
|------|----------|-----------|-----------------|
| **OFT Adapter** | Wraps existing ERC-20 (PYUSD on Ethereum) | Lock on source, mint on destination | Yes |
| **OFT** | Native implementation (PYUSD on other chains) | Burn on source, mint on destination | No |

---

## The Transfer Flow

A cross-chain transfer involves:

1. Checking balances and handling approvals
2. Getting a transfer quote
3. Executing the transfer
4. Tracking delivery status

### Reading Balances

For OFT Adapters, get the underlying token address first:

```typescript
import type { Address, PublicClient } from "viem";
import { erc20Abi } from "viem"; // Use viem's built-in ERC20 ABI

// Minimal IOFT ABI - only the functions we need
const ioftAbi = [
  { type: "function", name: "token", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" },
  { type: "function", name: "approvalRequired", inputs: [], outputs: [{ type: "bool" }], stateMutability: "view" },
  // ... quoteSend, quoteOFT, send functions
] as const;

export async function getTokenAddress(
  client: PublicClient,
  oftAddress: Address
): Promise<Address> {
  try {
    // OFT Adapters have a token() function
    return await client.readContract({
      abi: ioftAbi,
      address: oftAddress,
      functionName: "token",
    });
  } catch {
    // Native OFTs ARE the token
    return oftAddress;
  }
}

export async function getBalance(
  client: PublicClient,
  tokenAddress: Address,
  account: Address
): Promise<bigint> {
  return client.readContract({
    abi: erc20Abi,
    address: tokenAddress,
    args: [account],
    functionName: "balanceOf",
  });
}
```

### Handling Approvals

OFT Adapters require ERC-20 approval before transfers:

```typescript
export async function isApprovalRequired(
  client: PublicClient,
  oftAddress: Address
): Promise<boolean> {
  return client.readContract({
    abi: ioftAbi,
    address: oftAddress,
    functionName: "approvalRequired",
  });
}

export async function checkAndApprove(
  walletClient: WalletClient,
  publicClient: PublicClient,
  oftAddress: Address,
  amount: bigint
): Promise<{ approved: boolean; txHash?: Hex }> {
  const needsApproval = await isApprovalRequired(publicClient, oftAddress);
  if (!needsApproval) return { approved: false };

  const tokenAddress = await getTokenAddress(publicClient, oftAddress);
  const owner = walletClient.account!.address;

  const currentAllowance = await publicClient.readContract({
    abi: erc20Abi,
    address: tokenAddress,
    args: [owner, oftAddress],
    functionName: "allowance",
  });

  if (currentAllowance >= amount) return { approved: false };

  // Approve (consider exact amounts for production)
  const txHash = await walletClient.writeContract({
    abi: erc20Abi,
    account: walletClient.account!,
    address: tokenAddress,
    args: [oftAddress, 2n ** 256n - 1n],
    chain: walletClient.chain,
    functionName: "approve",
  });

  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return { approved: true, txHash };
}
```

### Building the SendParam

All OFT transfers use a `SendParam` structure:

```typescript
interface SendParam {
  dstEid: number;        // Destination Endpoint ID
  to: Hex;               // Recipient (bytes32 format)
  amountLD: bigint;      // Amount in local decimals
  minAmountLD: bigint;   // Minimum to receive (slippage protection)
  extraOptions: Hex;     // Encoded execution options
  composeMsg: Hex;       // Optional compose message (0x for simple transfers)
  oftCmd: Hex;           // Optional OFT command (0x for simple transfers)
}
```

**Address format:** LayerZero uses 32-byte addresses for chain-agnostic compatibility:

```typescript
import { pad } from "viem";

export function addressToBytes32(address: Address): Hex {
  return pad(address, { size: 32 });
}
```

### Building Execution Options

LayerZero requires specifying gas for the destination chain's `lzReceive()` call. The `@layerzerolabs/lz-v2-utilities` package provides an `Options` builder:

```typescript
import { Options } from "@layerzerolabs/lz-v2-utilities";

export function buildLzReceiveOptions(gasLimit: bigint = 200_000n): Hex {
  return Options.newOptions()
    .addExecutorLzReceiveOption(gasLimit, 0n)
    .toHex() as Hex;
}
```

The Options builder handles the binary encoding of LayerZero V2 options format. You can chain multiple options if needed (e.g., `.addExecutorNativeDropOption()` for sending native tokens to the recipient).

### Getting a Quote

Before sending, fetch the LayerZero messaging fee:

```typescript
export async function quoteSend(
  client: PublicClient,
  oftAddress: Address,
  sendParam: SendParam
): Promise<QuoteResult> {
  const messagingFee = await client.readContract({
    abi: ioftAbi,
    address: oftAddress,
    args: [sendParam, false], // payInLzToken = false
    functionName: "quoteSend",
  });

  const [limit, feeDetails, receipt] = await client.readContract({
    abi: ioftAbi,
    address: oftAddress,
    args: [sendParam],
    functionName: "quoteOFT",
  });

  return { messagingFee, limit, feeDetails, receipt };
}
```

The quote returns:
- `messagingFee.nativeFee`: ETH/native token cost for LayerZero
- `receipt.amountReceivedLD`: Tokens recipient will receive
- `limit.minAmountLD` / `maxAmountLD`: Transfer bounds

Format token amounts correctly (PYUSD uses 6 decimals) and native fees (18 decimals).

### Executing the Transfer

```typescript
import { parseEventLogs, type Hex } from "viem";

export async function send(
  walletClient: WalletClient,
  publicClient: PublicClient,
  oftAddress: Address,
  sendParam: SendParam,
  fee: MessagingFee,
  refundAddress: Address
): Promise<{ guid: Hex; txHash: Hex }> {
  const hash = await walletClient.writeContract({
    abi: ioftAbi,
    account: walletClient.account!,
    address: oftAddress,
    args: [sendParam, fee, refundAddress],
    chain: walletClient.chain,
    functionName: "send",
    value: fee.nativeFee,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  // Parse OFTSent event using viem's type-safe parseEventLogs
  const logs = parseEventLogs({
    abi: ioftAbi,
    logs: receipt.logs,
    eventName: "OFTSent",
  });

  const guid = logs[0]?.args?.guid ?? ("0x" as Hex);
  return { guid, txHash: hash };
}
```

**What happens:**

1. **Source chain:** OFT Adapter locks tokens, emits `OFTSent` with GUID, calls LayerZero Endpoint
2. **LayerZero network:** DVNs verify the message
3. **Destination chain:** Endpoint calls `lzReceive()`, OFT mints tokens to recipient

### Tracking Status

LayerZero Scan provides a public API for tracking:

```typescript
interface LayerZeroMessage {
  status: { name: string; message: string };
  guid: string;
  source: { tx: { txHash: string } };
  destination?: { tx?: { txHash: string } };
}

async function checkStatus(txHash: string): Promise<LayerZeroMessage | null> {
  const response = await fetch(
    `https://scan.layerzero-api.com/v1/messages/tx/${txHash}`
  );
  if (!response.ok) return null;

  const data = await response.json();
  return data.messages[0];
}
```

**Message states:**
- `CONFIRMING`: Waiting for source chain confirmations
- `INFLIGHT`: DVNs verifying
- `DELIVERED`: Successfully executed on destination
- `FAILED`: Execution failed (usually insufficient gas)

The GUID from `OFTSent` is the universal identifier for tracking across the LayerZero network.

---

## LayerZero-Specific Notes

**Gas limits:** The `extraOptions` gas limit (default 200,000) must cover the destination `lzReceive()` execution. Insufficient gas causes `FAILED` status. The LayerZero devtools include `build-lz-options` CLI for interactive option building with validation.

**Slippage protection:** Always set `minAmountLD` to protect against unexpected fees. A common pattern:

```typescript
const minAmountLD = (amountLD * 995n) / 1000n; // 0.5% slippage
```

**Refund address:** Unused gas is refunded to the `refundAddress` parameter in `send()`. Typically set to the sender.

---

## Conclusion

LayerZero's OFT standard enables native cross-chain token transfers through a consistent interface: build a `SendParam`, get a quote, execute the transfer, track via GUID.

The patterns here apply to any OFT token. For production, add comprehensive error handling, input validation, and consider using the official `@layerzerolabs/lz-v2-utilities` package for options encoding.

**Resources:**
- [LayerZero V2 Docs](https://docs.layerzero.network)
- [OFT Quickstart](https://docs.layerzero.network/v2/developers/evm/oft/quickstart)
- [LayerZero Scan](https://layerzeroscan.com)
- [LayerZero DevTools](https://github.com/LayerZero-Labs/devtools)
