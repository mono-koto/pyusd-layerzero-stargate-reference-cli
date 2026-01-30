import { Command } from '@commander-js/extra-typings'

import { isEvmChain, resolveChainConfigsForTransfer } from '../lib/chains'
import { resolveAddress } from '../lib/input-validation'
import { fetchStargateQuote } from '../lib/stargate'
import { formatAmount, parseAmount } from '../utils/format'

export const quoteCommand = new Command('quote')
  .description('Get a fee quote for a PYUSD cross-chain transfer via Stargate')
  .argument('<source>', 'Source chain (e.g., ethereum, arbitrum, avalanche)')
  .argument('<destination>', 'Destination chain')
  .argument('<amount>', 'Amount of PYUSD to transfer')
  .option('--address <address>', 'Sender address (or use PRIVATE_KEY env var)')
  .option('--to <address>', 'Recipient address on destination chain (defaults to sender)')
  .option('--slippage <percent>', 'Slippage tolerance in percent', '0.5')
  .action(async (source, destination, amount, options) => {
    const { srcConfig, dstConfig } = resolveChainConfigsForTransfer(source, destination)

    // Non-EVM chains require explicit address (can't derive from EVM private key)
    if (!isEvmChain(srcConfig) && !options.address) {
      console.error(`Error: --address is required for ${srcConfig.name}`)
      console.error(`This CLI currently only supports EVM private keys.`)
      process.exit(1)
    }

    // Resolve sender/recipient address (could be hex, base58, etc. depending on chain)
    const senderAddress = options.address || resolveAddress({})
    const recipientAddress = options.to || senderAddress

    // Calculate amounts in base units
    const amountLD = parseAmount(amount)
    const slippagePercent = Number.parseFloat(options.slippage)
    const slippageBps = Math.floor(slippagePercent * 100)
    const minAmountLD = (amountLD * BigInt(10000 - slippageBps)) / BigInt(10000)

    console.log('')
    console.log('PYUSD Transfer Quote (via Stargate)')
    console.log('─'.repeat(50))
    console.log(`Source:         ${srcConfig.name} (${srcConfig.symbol})`)
    console.log(`Destination:    ${dstConfig.name} (${dstConfig.symbol})`)
    console.log(`Sender:         ${senderAddress}`)
    console.log(`Recipient:      ${recipientAddress}`)
    console.log(`Amount:         ${amount} ${srcConfig.symbol}`)
    console.log('')

    try {
      // Fetch quote from Stargate API
      console.log('Fetching quote from Stargate...')
      console.log('')

      const quoteResult = await fetchStargateQuote({
        srcToken: srcConfig.tokenAddress,
        dstToken: dstConfig.tokenAddress,
        srcAddress: senderAddress,
        dstAddress: recipientAddress,
        srcChainKey: srcConfig.chainKey,
        dstChainKey: dstConfig.chainKey,
        srcAmount: amountLD.toString(),
        dstAmountMin: minAmountLD.toString(),
      })

      if (quoteResult.error) {
        console.error('─'.repeat(50))
        console.error(`Error: ${quoteResult.error}`)
        console.error('')
        process.exit(1)
      }

      if (!quoteResult.bestQuote) {
        console.error('─'.repeat(50))
        console.error('Error: No quote available')
        console.error('')
        process.exit(1)
      }

      const quote = quoteResult.bestQuote

      // Display quote details
      console.log('Quote Details')
      console.log('─'.repeat(50))

      // Parse amounts from quote response
      const srcAmountDisplay = formatAmount(BigInt(quote.srcAmount))
      const dstAmountDisplay = formatAmount(BigInt(quote.dstAmount))
      const minAmountDisplay = formatAmount(minAmountLD)

      console.log(`Send Amount:     ${srcAmountDisplay} ${srcConfig.symbol}`)
      console.log(`Receive Amount:  ${dstAmountDisplay} ${dstConfig.symbol}`)
      console.log(`Min Receive:     ${minAmountDisplay} ${dstConfig.symbol} (${options.slippage}% slippage)`)

      // Calculate and display fee
      const srcAmountBigInt = BigInt(quote.srcAmount)
      const dstAmountBigInt = BigInt(quote.dstAmount)
      const feeBigInt = srcAmountBigInt - dstAmountBigInt

      if (feeBigInt > 0n) {
        const feePercent = (Number(feeBigInt) / Number(srcAmountBigInt)) * 100
        console.log(`Protocol Fee:    ${formatAmount(feeBigInt)} ${srcConfig.symbol} (${feePercent.toFixed(3)}%)`)
      } else {
        console.log(`Protocol Fee:    0 ${srcConfig.symbol} (zero fee)`)
      }

      console.log('')
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Failed to get quote: ${error.message}`)
      }
      process.exit(1)
    }
  })
