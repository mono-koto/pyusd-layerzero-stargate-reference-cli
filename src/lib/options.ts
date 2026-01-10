import {Options} from '@layerzerolabs/lz-v2-utilities'
import type {Hex} from 'viem'

// Default gas limit for OFT lzReceive (200000 is typical for OFT)
export const DEFAULT_GAS_LIMIT = 200_000n

/**
 * Build extra options for a simple OFT transfer
 * This encodes the gas limit for the lzReceive call on the destination chain
 *
 * See: https://docs.layerzero.network/v2/developers/evm/configuration/options
 */
export function buildLzReceiveOptions(gasLimit: bigint = DEFAULT_GAS_LIMIT): Hex {
  return Options.newOptions().addExecutorLzReceiveOption(gasLimit, 0n).toHex() as Hex
}
