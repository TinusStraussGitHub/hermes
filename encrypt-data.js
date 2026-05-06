#!/usr/bin/env node
/**
 * Encrypt data for CryptoJS compatibility
 * Outputs a JSON object with salt, iv, and ciphertext (all base64)
 * This is easier to debug and ensures compatibility
 */

const crypto = require('crypto');
const fs = require('fs');

const DEFAULT_PASSWORD = 'tinus2026';

function encrypt(text, password) {
    // Generate salt and IV
    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(16);
    
    // Derive key using PBKDF2 (same as we'll use in browser with Web Crypto API)
    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
    
    // Encrypt
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    // Return JSON with all components (except password!)
    const result = {
        salt: salt.toString('base64'),
        iv: iv.toString('base64'),
        ciphertext: encrypted
    };
    
    return JSON.stringify(result);
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
