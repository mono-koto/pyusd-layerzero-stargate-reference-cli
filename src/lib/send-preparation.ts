import type { SendParam } from '../types/index'

import { buildLzReceiveOptions } from './options'
import { addressToBytes32 } from '../utils/address'
import { calculateMinAmount, parseAmount } from '../utils/format'

/**
 * Prepare SendParam structure for cross-chain transfer
 *
 * Centralizes the logic for building a SendParam with amount parsing,
 * slippage calculation, and LayerZero options encoding.
 *
 * @param params - Transfer parameters
 * @param params.amount - Amount of tokens to send (as string, e.g., "100")
 * @param params.dstEid - Destination LayerZero Endpoint ID
 * @param params.recipient - Recipient address on destination chain
 * @param params.slippage - Slippage tolerance as percentage string (e.g., "0.5")
 * @param params.gas - Gas limit for destination lzReceive (as string)
 * @returns SendParam structure and parsed amounts
 */
export function prepareSendParam(params: {
  amount: string
  dstEid: number
  recipient: `0x${string}`
  slippage: string
  gas: string
}): {
  sendParam: SendParam
  amountLD: bigint
  minAmountLD: bigint
} {
  // Parse amount to local decimals (PYUSD uses 6 decimals)
  const amountLD = parseAmount(params.amount)

  // Calculate minimum amount with slippage protection
  const slippagePercent = Number.parseFloat(params.slippage)
  const minAmountLD = calculateMinAmount(amountLD, slippagePercent)

  // Build SendParam structure
  const sendParam: SendParam = {
    amountLD,
    composeMsg: '0x',                             // No composition message (simple transfer)
    dstEid: params.dstEid,                         // Destination LayerZero Endpoint ID
    extraOptions: buildLzReceiveOptions(BigInt(params.gas)),  // Gas limit for lzReceive
    minAmountLD,                                   // Minimum to receive (slippage protection)
    oftCmd: '0x',                                  // No OFT command (simple transfer)
    to: addressToBytes32(params.recipient),        // Recipient as bytes32
  }

  return {
    sendParam,
    amountLD,
    minAmountLD,
  }
}
