import { Command } from '@commander-js/extra-typings'
import { erc20Abi } from 'viem'

import { getChainConfig, isEvmChain, isSolanaChain } from '../lib/chains'
import { createPublicClientForChain } from '../lib/client'
import { resolveAddress } from '../lib/input-validation'
import { getSolanaTokenBalance, isSolanaAddress } from '../lib/solana-client'
import { formatAmount } from '../utils/format'

export const balanceCommand = new Command('balance')
  .description('Check PYUSD balance on a chain')
  .argument('<chain>', 'Chain to check balance on (e.g., ethereum, arbitrum, polygon)')
  .option('-a, --address <address>', 'Address to check (defaults to address derived from PRIVATE_KEY)')
  .action(async (chain, options) => {
    const chainConfig = getChainConfig(chain)

    // Handle Solana chains separately
    if (isSolanaChain(chainConfig)) {
      await handleSolanaBalance(chainConfig, options.address)
      return
    }

    // Non-EVM chains (other than Solana) require explicit address
    if (!isEvmChain(chainConfig) && !options.address) {
      console.error(`Error: --address is required for ${chainConfig.name}`)
      console.error(`This CLI currently only supports EVM private keys.`)
      process.exit(1)
    }

    // Resolve address from flag or private key
    const address = resolveAddress({ address: options.address })

    const client = createPublicClientForChain(chain)

    console.log('')
    console.log(`Checking PYUSD balance on ${chainConfig.name}...`)
    console.log('')

    try {
      // Read balance directly from the token contract
      const balance = await client.readContract({
        abi: erc20Abi,
        address: chainConfig.tokenAddress,
        functionName: 'balanceOf',
        args: [address],
      })

      const formattedBalance = formatAmount(balance)

      console.log(`Address:  ${address}`)
      console.log(`Chain:    ${chainConfig.name}`)
      console.log(`Token:    ${chainConfig.symbol}`)
      console.log(`Balance:  ${formattedBalance} ${chainConfig.symbol}`)
      console.log('')
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Failed to fetch balance: ${error.message}`)
      }
      process.exit(1)
    }
  })

/**
 * Handle balance check for Solana chains
 */
async function handleSolanaBalance(
  chainConfig: ReturnType<typeof getChainConfig>,
  addressOption?: string
): Promise<void> {
  // Solana requires explicit address (can't derive from EVM private key)
  if (!addressOption) {
    console.error(`Error: --address is required for ${chainConfig.name}`)
    console.error(`Provide a Solana address (base58 encoded, e.g., HcctjqtSJxFmmphaKpbAJZwKawWMQ86GDS3w8AXk9uJL)`)
    process.exit(1)
  }

  // Validate that it's a proper Solana address
  if (!isSolanaAddress(addressOption)) {
    console.error(`Error: "${addressOption}" is not a valid Solana address.`)
    console.error(`Solana addresses are base58 encoded and typically 32-44 characters.`)
    process.exit(1)
  }

  console.log('')
  console.log(`Checking PYUSD balance on ${chainConfig.name}...`)
  console.log('')

  try {
    const balance = await getSolanaTokenBalance(
      chainConfig.rpcUrl,
      addressOption,
      chainConfig.tokenAddress
    )

    const formattedBalance = formatAmount(balance)

    console.log(`Address:  ${addressOption}`)
    console.log(`Chain:    ${chainConfig.name}`)
    console.log(`Token:    ${chainConfig.symbol}`)
    console.log(`Balance:  ${formattedBalance} ${chainConfig.symbol}`)
    console.log('')
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Failed to fetch balance: ${error.message}`)
    }
    process.exit(1)
  }
}
