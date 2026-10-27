#!/usr/bin/env node
const crypto = require('crypto')

function hashPassword(password) {
  if (!password || typeof password !== 'string') {
    throw new Error('Please provide a password string.')
  }
  const salt = crypto.randomBytes(16).toString('hex')
  const derivedKey = crypto.scryptSync(password, salt, 64)
  return `scrypt$${salt}$${derivedKey.toString('hex')}`
}

const password = process.argv[2]
if (!password) {
  console.log('CampusFind Password Hash Generator')
  console.log('Usage: node generate-password-hash.js "<your-password>"')
  console.log('Example: node generate-password-hash.js "CampusStaff2026!"')
  process.exit(1)
}

const hash = hashPassword(password)
console.log('\n--- Generated Scrypt Salted Password Hash ---')
console.log(hash)
console.log('\nCopy and paste the line below into your backend/.env file:')
console.log(`STAFF_PASSWORD_HASH=${hash}\n`)
