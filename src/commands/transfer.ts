import { Command } from '@commander-js/extra-typings'
import { erc20Abi } from 'viem'

import { isEvmChain, resolveChainConfigsForTransfer } from '../lib/chains'
import { createPublicClientForChain, createWalletClientForChain } from '../lib/client'
import { resolveAddress } from '../lib/input-validation'
import { executeStargateTransfer, fetchStargateQuote } from '../lib/stargate'
import { formatAmount, parseAmount, truncateAddress } from '../utils/format'

export const transferCommand = new Command('transfer')
  .description('Execute a PYUSD cross-chain transfer via Stargate')
  .argument('<source>', 'Source chain (e.g., ethereum, arbitrum, avalanche)')
  .argument('<destination>', 'Destination chain')
  .argument('<amount>', 'Amount of PYUSD to transfer')
  .option('--to <address>', 'Recipient address on destination chain (defaults to sender)')
  .option('--slippage <percent>', 'Slippage tolerance in percent', '0.5')
  .option('--dry-run', 'Simulate transaction without sending', false)
  .action(async (source, destination, amount, options) => {
    const { srcConfig, dstConfig } = resolveChainConfigsForTransfer(source, destination)

    // Transactions on non-EVM chains are not yet implemented
    if (!isEvmChain(srcConfig)) {
      console.error(`Error: Transfers from ${srcConfig.name} are not yet supported.`)
      console.error(`This CLI currently only supports EVM private keys for signing transactions.`)
      process.exit(1)
    }

    const privateKey = process.env.PRIVATE_KEY
    if (!privateKey) {
      console.error('Error: PRIVATE_KEY environment variable is required for transfers')
      process.exit(1)
    }

    // Resolve sender and recipient addresses
    const senderAddress = resolveAddress({ requirePrivateKey: true })
    const recipientAddress = (options.to || senderAddress) as `0x${string}`

    // Calculate amounts in base units
    const amountLD = parseAmount(amount)
    const slippagePercent = Number.parseFloat(options.slippage)
    const slippageBps = Math.floor(slippagePercent * 100)
    const minAmountLD = (amountLD * BigInt(10000 - slippageBps)) / BigInt(10000)

    const publicClient = createPublicClientForChain(srcConfig)
    const walletClient = createWalletClientForChain(srcConfig, privateKey as `0x${string}`)

    console.log('')
    console.log('PYUSD Cross-Chain Transfer (via Stargate)')
    console.log('─'.repeat(50))
    console.log(`From:       ${srcConfig.name} → ${dstConfig.name}`)
    console.log(`Sender:     ${truncateAddress(senderAddress)}`)
    console.log(`Recipient:  ${truncateAddress(recipientAddress)}`)
    console.log(`Amount:     ${amount} PYUSD`)
    console.log('')

    try {
      // Step 1: Check balance
      console.log('Step 1: Checking balance...')
      const balance = await publicClient.readContract({
        abi: erc20Abi,
        address: srcConfig.tokenAddress,
        functionName: 'balanceOf',
        args: [senderAddress],
      })

      if (balance < amountLD) {
        console.error(`Insufficient balance: have ${formatAmount(balance)} PYUSD, need ${amount} PYUSD`)
        process.exit(1)
      }

      console.log(`  ✓ Balance: ${formatAmount(balance)} PYUSD`)
      console.log('')

      // Step 2: Get quote from Stargate
      console.log('Step 2: Getting quote from Stargate...')

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

      if (!quoteResult.success || !quoteResult.bestQuote) {
        console.error(`Failed to get quote: ${quoteResult.error || 'No routes available'}`)
        console.error('')

        // Provide helpful guidance for cross-mesh routes
        if (srcConfig.symbol === 'PYUSD' && dstConfig.symbol === 'PYUSD0' && srcConfig.chainKey !== 'arbitrum') {
          console.error('Tip: Transfers from Ethereum to PYUSD0 chains require routing through Arbitrum.')
          console.error('     Try: ethereum → arbitrum, then arbitrum → ' + dstConfig.chainKey)
          console.error('')
        }

        process.exit(1)
      }

      const quote = quoteResult.bestQuote
      console.log(`  ✓ Quote received: ${quote.steps.length} step(s)`)
      console.log(`  ✓ Will receive: ${formatAmount(BigInt(quote.dstAmount))} PYUSD`)
      console.log('')

      // Step 3: Execute transfer (or dry run)
      if (options.dryRun) {
        console.log('Step 3: Dry run (skipping actual transfer)')
        console.log('  ✓ Quote simulation successful')
        console.log('')
        console.log('─'.repeat(50))
        console.log('Dry run complete. Remove --dry-run flag to execute.')
        console.log('')
        console.log('Steps that would be executed:')
        for (let i = 0; i < quote.steps.length; i++) {
          const step = quote.steps[i]
          const gasNote = step.transaction.value && step.transaction.value !== '0'
            ? ` (+ ${Number(BigInt(step.transaction.value)) / 1e18} ${srcConfig.nativeCurrency.symbol})`
            : ''
          console.log(`  ${i + 1}. ${step.type}${gasNote}`)
        }
        console.log('')
        return
      }

      console.log(`Step 3: Executing transfer (${quote.steps.length} transaction(s))...`)

      const result = await executeStargateTransfer(
        walletClient,
        publicClient,
        quote,
        (stepIndex, stepType, status) => {
          const stepNum = stepIndex + 1
          if (status === 'pending') {
            console.log(`  → Step ${stepNum}/${quote.steps.length}: ${stepType}...`)
          } else {
            console.log(`  ✓ Step ${stepNum}/${quote.steps.length}: ${stepType} confirmed`)
          }
        }
      )

      if (!result.success) {
        console.error(`\nTransfer failed: ${result.error}`)
        if (result.txHashes.length > 0) {
          console.error(`Completed transactions: ${result.txHashes.join(', ')}`)
        }
        process.exit(1)
      }

      console.log('')
      console.log('Results')
      console.log('─'.repeat(50))

      // Display all transaction hashes
      for (let i = 0; i < result.txHashes.length; i++) {
        const hash = result.txHashes[i]
        const stepType = quote.steps[i]?.type || 'tx'
        console.log(`${stepType} TX:   ${hash}`)
      }

      // Display tracking links
      if (result.finalTxHash) {
        console.log('')
        console.log(`LayerZero:    https://layerzeroscan.com/tx/${result.finalTxHash}`)
      }

      console.log('')
      console.log('Status: Pending (check LayerZero scan for cross-chain delivery)')
      console.log('')
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Transaction failed: ${error.message}`)
      }
      process.exit(1)
    }
  })
