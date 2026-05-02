#!/usr/bin/env node
/**
 * Encrypt JSON data files for GitHub Pages
 * Uses AES-CBC mode compatible with CryptoJS browser library
 * 
 * Usage: node encrypt-data.js <input.json> <output.enc.json> [password]
 */

const crypto = require('crypto');
const fs = require('fs');

// Default password (same as in script.js)
const DEFAULT_PASSWORD = 'tinus2026';

function encrypt(text, password) {
    // Derive a key from the password using PBKDF2
    const salt = crypto.randomBytes(8);
    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    // Format compatible with CryptoJS: salt + iv + ciphertext, all base64
    // CryptoJS format: Salt__ + salt (8 bytes) + ciphertext (which includes iv prepended)
    // Actually, let's use a simpler custom format:
    // Structure: salt (8 bytes) + iv (16 bytes) + encrypted data
    // All encoded as base64 for storage
    
    const combined = Buffer.concat([
        salt,
        iv,
        Buffer.from(encrypted, 'base64')
    ]);
    
    return combined.toString('base64');
}

function decrypt(encryptedBase64, password) {
    const combined = Buffer.from(encryptedBase64, 'base64');
    
    // Extract components
    const salt = combined.slice(0, 8);
    const iv = combined.slice(8, 24);
    const encrypted = combined.slice(24).toString('base64');
    
    // Derive key
    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
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

module.exports = { encrypt, decrypt };
