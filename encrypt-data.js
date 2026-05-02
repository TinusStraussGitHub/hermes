#!/usr/bin/env node
/**
 * Encrypt data in OpenSSL-compatible format that CryptoJS can decrypt
 * Format: "Salted__" + 8-byte salt + ciphertext
 * This is the format CryptoJS.AES.decrypt() expects when given a password
 */

const crypto = require('crypto');
const fs = require('fs');

const DEFAULT_PASSWORD = 'tinus2026';

function encrypt(text, password) {
    // Generate 8-byte salt
    const salt = crypto.randomBytes(8);
    
    // Derive key and IV using EVP_BytesToKey (OpenSSL's key derivation)
    // This is what CryptoJS uses internally
    const keyIv = evpBytesToKey(password, salt, 32 + 16); // 32 for key, 16 for IV
    const key = keyIv.slice(0, 32);
    const iv = keyIv.slice(32, 48);
    
    // Encrypt
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Format: "Salted__" + salt + ciphertext
    const prefix = Buffer.from('Salted__', 'ascii');
    const ciphertext = Buffer.from(encrypted, 'hex');
    const combined = Buffer.concat([prefix, salt, ciphertext]);
    
    return combined.toString('base64');
}

// EVP_BytesToKey - OpenSSL's key derivation function (used by CryptoJS)
function evpBytesToKey(password, salt, keyLen) {
    const passwordBuf = Buffer.from(password, 'utf8');
    let keyIv = Buffer.alloc(0);
    let prev = Buffer.alloc(0);
    
    while (keyIv.length < keyLen) {
        const hash = crypto.createHash('md5');
        hash.update(Buffer.concat([prev, passwordBuf, salt]));
        prev = hash.digest();
        keyIv = Buffer.concat([keyIv, prev]);
    }
    
    return keyIv.slice(0, keyLen);
}

// CLI usage
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
        console.error('Usage: node encrypt-data.js <input.json> <output.enc.json> [password]');
        process.exit(1);
    }
    
    const inputFile = args[0];
    const outputFile = args[1];
    const password = args[2] || DEFAULT_PASSWORD;
    
    try {
        const data = fs.readFileSync(inputFile, 'utf8');
        const encrypted = encrypt(data, password);
        fs.writeFileSync(outputFile, encrypted, 'utf8');
        console.log(`Encrypted ${inputFile} -> ${outputFile}`);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

module.exports = { encrypt };
