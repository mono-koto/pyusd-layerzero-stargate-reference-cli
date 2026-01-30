#!/usr/bin/env tsx
/**
 * Generate valid test addresses for Solana and Tron
 */

import { Keypair } from '@solana/web3.js'
import TronWeb from 'tronweb'

const solana = Keypair.generate()
const tron = TronWeb.utils.accounts.generateAccount()

console.log('\n🌞 Solana:', solana.publicKey.toBase58())
console.log('🔷 Tron:  ', tron.address.base58)

console.log(`
Example:
  npm run cli quote -- \\
    --address ${solana.publicKey.toBase58()} \\
    --to ${tron.address.base58} \\
    solana tron 0.1
`)
