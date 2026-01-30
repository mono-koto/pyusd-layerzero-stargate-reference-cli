/**
 * Stargate Finance API client for PYUSD/PYUSD0 cross-chain transfers
 *
 * Stargate handles all routing and cross-chain complexity automatically.
 * Just specify source/destination tokens and chains, and the API returns
 * executable transactions.
 */

import type { Address, Hex, PublicClient, WalletClient } from 'viem'

// API configuration
const STARGATE_API_BASE = 'https://stargate.finance/api/v1'
const STARGATE_QUOTES_URL = `${STARGATE_API_BASE}/quotes`

// ============================================================================
// Types
// ============================================================================

export interface StargateQuoteParams {
  srcToken: string // Token address (hex for EVM, base58 for Solana, etc.)
  dstToken: string
  srcAddress: string // Wallet address in chain-native format
  dstAddress: string
  srcChainKey: string
  dstChainKey: string
  srcAmount: string // Amount in token units (e.g., "1000000" for 1 PYUSD)
  dstAmountMin: string // Minimum amount to receive after fees
}

export interface StargateTransaction {
  to: Address
  data: Hex
  value?: string
}

export interface StargateStep {
  type: 'approve' | 'bridge' | string
  transaction: StargateTransaction
  description?: string
}

export interface StargateQuote {
  steps: StargateStep[]
  route?: string | null
  srcAmount: string
  dstAmount: string
  fee?: {
    amount: string
    token: string
  }
  // API may return quotes with embedded errors instead of valid data
  error?: {
    message: string
  }
}

export interface StargateQuoteResponse {
  quotes: StargateQuote[]
  error?: {
    message: string
  }
}

export interface StargateQuoteResult {
  success: boolean
  quotes: StargateQuote[]
  error?: string
  // Convenience accessors for the best quote
  bestQuote?: StargateQuote
  srcAmount?: string
  dstAmount?: string
  stepCount?: number
}

export interface StargateTransferResult {
  success: boolean
  txHashes: Hex[]
  error?: string
  finalTxHash?: Hex // The bridge transaction hash for LayerZero tracking
}

// ============================================================================
// Quote Functions
// ============================================================================

/**
 * Fetch quotes from the Stargate API for a cross-chain transfer
 */
export async function fetchStargateQuote(
  params: StargateQuoteParams
): Promise<StargateQuoteResult> {
  const url = new URL(STARGATE_QUOTES_URL)

  // Add all parameters to URL
  url.searchParams.set('srcToken', params.srcToken)
  url.searchParams.set('dstToken', params.dstToken)
  url.searchParams.set('srcAddress', params.srcAddress)
  url.searchParams.set('dstAddress', params.dstAddress)
  url.searchParams.set('srcChainKey', params.srcChainKey)
  url.searchParams.set('dstChainKey', params.dstChainKey)
  url.searchParams.set('srcAmount', params.srcAmount)
  url.searchParams.set('dstAmountMin', params.dstAmountMin)

  try {
    const response = await fetch(url.toString())

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = `API Error (${response.status})`

      try {
        const errorJson = JSON.parse(errorText) as { error?: { message?: string } }
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message
        }
      } catch {
        // Use status code error
      }

      return {
        success: false,
        quotes: [],
        error: errorMessage,
      }
    }

    const data = (await response.json()) as StargateQuoteResponse

    if (!data.quotes || data.quotes.length === 0) {
      return {
        success: false,
        quotes: [],
        error: data.error?.message || 'No routes available',
      }
    }

    // Filter out quotes that have errors or missing required fields
    const validQuotes = data.quotes.filter(
      (q) => !q.error && q.srcAmount && q.dstAmount && q.steps?.length > 0
    )

    if (validQuotes.length === 0) {
      // Extract error message from first failed quote if available
      const firstError = data.quotes.find((q) => q.error)?.error?.message
      return {
        success: false,
        quotes: [],
        error: firstError || 'No valid routes available',
      }
    }

    const bestQuote = validQuotes[0]

    return {
      success: true,
      quotes: validQuotes,
      bestQuote,
      srcAmount: bestQuote.srcAmount,
      dstAmount: bestQuote.dstAmount,
      stepCount: bestQuote.steps?.length || 0,
    }
  } catch (error) {
    return {
      success: false,
      quotes: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Calculate minimum amount with slippage
 */
export function calculateMinAmount(amount: string, slippagePercent: number): string {
  const amountBigInt = BigInt(amount)
  const slippageBasisPoints = Math.floor(slippagePercent * 100)
  const minAmount = (amountBigInt * BigInt(10000 - slippageBasisPoints)) / BigInt(10000)
  return minAmount.toString()
}

// ============================================================================
// Transfer Execution
// ============================================================================

/**
 * Execute a Stargate transfer by running all steps in the quote
 *
 * @param walletClient - Viem wallet client for signing transactions
 * @param publicClient - Viem public client for waiting on confirmations
 * @param quote - The Stargate quote containing transaction steps
 * @param onStep - Optional callback for progress updates
 */
export async function executeStargateTransfer(
  walletClient: WalletClient,
  publicClient: PublicClient,
  quote: StargateQuote,
  onStep?: (stepIndex: number, stepType: string, status: 'pending' | 'confirmed') => void
): Promise<StargateTransferResult> {
  const txHashes: Hex[] = []
  let finalTxHash: Hex | undefined

  try {
    for (let i = 0; i < quote.steps.length; i++) {
      const step = quote.steps[i]
      const tx = step.transaction

      onStep?.(i, step.type, 'pending')

      // Build transaction params
      const txParams: {
        account: NonNullable<typeof walletClient.account>
        to: Address
        data: Hex
        value?: bigint
        chain: typeof walletClient.chain
      } = {
        account: walletClient.account!,
        to: tx.to,
        data: tx.data,
        chain: walletClient.chain,
      }

      // Add value if present (for bridge transactions that pay native gas)
      if (tx.value && tx.value !== '0') {
        txParams.value = BigInt(tx.value)
      }

      // Send transaction
      const hash = await walletClient.sendTransaction(txParams)
      txHashes.push(hash)

      // Wait for confirmation
      await publicClient.waitForTransactionReceipt({ hash })

      onStep?.(i, step.type, 'confirmed')

      // Track the bridge transaction for LayerZero lookup
      if (step.type === 'bridge') {
        finalTxHash = hash
      }
    }

    return {
      success: true,
      txHashes,
      finalTxHash: finalTxHash || txHashes[txHashes.length - 1],
    }
  } catch (error) {
    return {
      success: false,
      txHashes,
      error: error instanceof Error ? error.message : 'Transaction failed',
    }
  }
}

// ============================================================================
// Route Validation
// ============================================================================

/**
 * Check if a route is supported by Stargate
 *
 * Uses a minimal test query to check route availability.
 */
export async function isRouteSupported(
  srcChainKey: string,
  dstChainKey: string,
  srcToken: Address,
  dstToken: Address
): Promise<boolean> {
  const testAddress = '0x0000000000000000000000000000000000000001' as Address

  const result = await fetchStargateQuote({
    srcToken,
    dstToken,
    srcAddress: testAddress,
    dstAddress: testAddress,
    srcChainKey,
    dstChainKey,
    srcAmount: '1000000', // 1 PYUSD
    dstAmountMin: '900000', // Allow 10% slippage for test
  })

  return result.success
}
