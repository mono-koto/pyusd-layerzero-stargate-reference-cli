import type {Address, Hex, PublicClient, WalletClient} from 'viem'
import {erc20Abi, parseEventLogs} from 'viem'

import type {MessagingFee, QuoteResult, SendParam} from '../types/index'

// IOFT ABI - sourced from @layerzerolabs/oft-evm
// Only includes the functions we use to keep bundle small
const ioftAbi = [
  {type: 'function', name: 'approvalRequired', inputs: [], outputs: [{type: 'bool'}], stateMutability: 'view'},
  {type: 'function', name: 'token', inputs: [], outputs: [{type: 'address'}], stateMutability: 'view'},
  {
    type: 'function',
    name: 'quoteOFT',
    inputs: [{name: '_sendParam', type: 'tuple', components: [
      {name: 'dstEid', type: 'uint32'},
      {name: 'to', type: 'bytes32'},
      {name: 'amountLD', type: 'uint256'},
      {name: 'minAmountLD', type: 'uint256'},
      {name: 'extraOptions', type: 'bytes'},
      {name: 'composeMsg', type: 'bytes'},
      {name: 'oftCmd', type: 'bytes'},
    ]}],
    outputs: [
      {type: 'tuple', components: [{name: 'minAmountLD', type: 'uint256'}, {name: 'maxAmountLD', type: 'uint256'}]},
      {type: 'tuple[]', components: [{name: 'feeAmountLD', type: 'int256'}, {name: 'description', type: 'string'}]},
      {type: 'tuple', components: [{name: 'amountSentLD', type: 'uint256'}, {name: 'amountReceivedLD', type: 'uint256'}]},
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'quoteSend',
    inputs: [
      {name: '_sendParam', type: 'tuple', components: [
        {name: 'dstEid', type: 'uint32'},
        {name: 'to', type: 'bytes32'},
        {name: 'amountLD', type: 'uint256'},
        {name: 'minAmountLD', type: 'uint256'},
        {name: 'extraOptions', type: 'bytes'},
        {name: 'composeMsg', type: 'bytes'},
        {name: 'oftCmd', type: 'bytes'},
      ]},
      {name: '_payInLzToken', type: 'bool'},
    ],
    outputs: [{type: 'tuple', components: [{name: 'nativeFee', type: 'uint256'}, {name: 'lzTokenFee', type: 'uint256'}]}],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'send',
    inputs: [
      {name: '_sendParam', type: 'tuple', components: [
        {name: 'dstEid', type: 'uint32'},
        {name: 'to', type: 'bytes32'},
        {name: 'amountLD', type: 'uint256'},
        {name: 'minAmountLD', type: 'uint256'},
        {name: 'extraOptions', type: 'bytes'},
        {name: 'composeMsg', type: 'bytes'},
        {name: 'oftCmd', type: 'bytes'},
      ]},
      {name: '_fee', type: 'tuple', components: [{name: 'nativeFee', type: 'uint256'}, {name: 'lzTokenFee', type: 'uint256'}]},
      {name: '_refundAddress', type: 'address'},
    ],
    outputs: [
      {type: 'tuple', components: [{name: 'guid', type: 'bytes32'}, {name: 'nonce', type: 'uint64'}]},
      {type: 'tuple', components: [{name: 'amountSentLD', type: 'uint256'}, {name: 'amountReceivedLD', type: 'uint256'}]},
    ],
    stateMutability: 'payable',
  },
  {
    type: 'event',
    name: 'OFTSent',
    inputs: [
      {name: 'guid', type: 'bytes32', indexed: true},
      {name: 'dstEid', type: 'uint32', indexed: true},
      {name: 'fromAddress', type: 'address', indexed: true},
      {name: 'amountSentLD', type: 'uint256'},
      {name: 'amountReceivedLD', type: 'uint256'},
    ],
  },
] as const

/**
 * Get the underlying ERC20 token address for an OFT
 * Falls back to the address itself if it's not an OFT adapter
 */
export async function getTokenAddress(client: PublicClient, oftAddress: Address): Promise<Address> {
  try {
    return await client.readContract({
      abi: ioftAbi,
      address: oftAddress,
      functionName: 'token',
    })
  } catch {
    // If token() doesn't exist, the OFT IS the token
    return oftAddress
  }
}

/**
 * Check if ERC20 approval is required for the OFT
 */
export async function isApprovalRequired(client: PublicClient, oftAddress: Address): Promise<boolean> {
  return client.readContract({
    abi: ioftAbi,
    address: oftAddress,
    functionName: 'approvalRequired',
  })
}

/**
 * Get PYUSD balance for an address
 */
export async function getBalance(client: PublicClient, tokenAddress: Address, account: Address): Promise<bigint> {
  return client.readContract({
    abi: erc20Abi,
    address: tokenAddress,
    args: [account],
    functionName: 'balanceOf',
  })
}

/**
 * Get current allowance for the OFT contract
 */
export async function getAllowance(
  client: PublicClient,
  tokenAddress: Address,
  owner: Address,
  spender: Address,
): Promise<bigint> {
  return client.readContract({
    abi: erc20Abi,
    address: tokenAddress,
    args: [owner, spender],
    functionName: 'allowance',
  })
}

/**
 * Approve the OFT contract to spend tokens
 */
export async function approve(
  walletClient: WalletClient,
  publicClient: PublicClient,
  tokenAddress: Address,
  spender: Address,
  amount: bigint,
): Promise<Hex> {
  const hash = await walletClient.writeContract({
    abi: erc20Abi,
    account: walletClient.account!,
    address: tokenAddress,
    args: [spender, amount],
    chain: walletClient.chain,
    functionName: 'approve',
  })

  await publicClient.waitForTransactionReceipt({hash})
  return hash
}

/**
 * Get a quote for sending tokens cross-chain
 */
export async function quoteSend(
  client: PublicClient,
  oftAddress: Address,
  sendParam: SendParam,
  payInLzToken: boolean = false,
): Promise<QuoteResult> {
  const messagingFee = await client.readContract({
    abi: ioftAbi,
    address: oftAddress,
    args: [sendParam, payInLzToken],
    functionName: 'quoteSend',
  })

  const [limit, feeDetails, receipt] = await client.readContract({
    abi: ioftAbi,
    address: oftAddress,
    args: [sendParam],
    functionName: 'quoteOFT',
  })

  return {
    feeDetails: feeDetails.map((f) => ({
      description: f.description,
      feeAmountLD: f.feeAmountLD,
    })),
    limit: {
      maxAmountLD: limit.maxAmountLD,
      minAmountLD: limit.minAmountLD,
    },
    messagingFee: {
      lzTokenFee: messagingFee.lzTokenFee,
      nativeFee: messagingFee.nativeFee,
    },
    receipt: {
      amountReceivedLD: receipt.amountReceivedLD,
      amountSentLD: receipt.amountSentLD,
    },
  }
}

/**
 * Send tokens cross-chain
 */
export async function send(
  walletClient: WalletClient,
  publicClient: PublicClient,
  oftAddress: Address,
  sendParam: SendParam,
  fee: MessagingFee,
  refundAddress: Address,
): Promise<{guid: Hex; txHash: Hex}> {
  const hash = await walletClient.writeContract({
    abi: ioftAbi,
    account: walletClient.account!,
    address: oftAddress,
    args: [sendParam, fee, refundAddress],
    chain: walletClient.chain,
    functionName: 'send',
    value: fee.nativeFee,
  })

  const receipt = await publicClient.waitForTransactionReceipt({hash})

  // Parse OFTSent event using viem's type-safe parseEventLogs
  const logs = parseEventLogs({
    abi: ioftAbi,
    logs: receipt.logs,
    eventName: 'OFTSent',
  })

  const guid = logs[0]?.args?.guid ?? ('0x' as Hex)
  return {guid, txHash: hash}
}

/**
 * Check and approve tokens if needed
 */
export async function checkAndApprove(
  walletClient: WalletClient,
  publicClient: PublicClient,
  oftAddress: Address,
  amount: bigint,
): Promise<{approved: boolean; txHash?: Hex}> {
  const needsApproval = await isApprovalRequired(publicClient, oftAddress)
  if (!needsApproval) {
    return {approved: false}
  }

  const tokenAddress = await getTokenAddress(publicClient, oftAddress)
  const owner = walletClient.account!.address
  const currentAllowance = await getAllowance(publicClient, tokenAddress, owner, oftAddress)

  if (currentAllowance >= amount) {
    return {approved: false}
  }

  const maxApproval = 2n ** 256n - 1n
  const txHash = await approve(walletClient, publicClient, tokenAddress, oftAddress, maxApproval)

  return {approved: true, txHash}
}
