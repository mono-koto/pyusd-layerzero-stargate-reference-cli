#!/usr/bin/env tsx

import { Command } from '@commander-js/extra-typings'

import { balanceCommand } from '../src/commands/balance'
import { chainsCommand } from '../src/commands/chains'
import { fetchChainsCommand } from '../src/commands/fetch-chains'
import { quoteCommand } from '../src/commands/quote'
import { sendCommand } from '../src/commands/send'

const program = new Command()
  .name('pyusd-lz')
  .description('CLI tool for cross-chain PYUSD transfers using LayerZero')
  .version('0.0.0')

program.addCommand(balanceCommand)
program.addCommand(quoteCommand)
program.addCommand(sendCommand)
program.addCommand(chainsCommand)
program.addCommand(fetchChainsCommand)

program.parse()
