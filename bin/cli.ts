#!/usr/bin/env tsx

import { Command } from '@commander-js/extra-typings'

import { balanceCommand } from '../src/commands/balance'
import { chainsCommand } from '../src/commands/chains'
import { quoteCommand } from '../src/commands/quote'
import { statusCommand } from '../src/commands/status'
import { transferCommand } from '../src/commands/transfer'
import { updateChainsCommand } from '../src/commands/update-chains'

const program = new Command()
  .name('pyusd-lz')
  .description('CLI tool for cross-chain PYUSD transfers via Stargate')
  .version('0.0.0')

program.addCommand(balanceCommand)
program.addCommand(quoteCommand)
program.addCommand(transferCommand)
program.addCommand(statusCommand)
program.addCommand(chainsCommand)
program.addCommand(updateChainsCommand)

program.parse()
