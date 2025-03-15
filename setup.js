#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Path to .env file
const envPath = path.join(__dirname, '.env');

// Check if .env already exists
const envFileExists = fs.existsSync(envPath);

console.log('Shopify Data Extractor - Setup');
console.log('-------------------------------');

if (envFileExists) {
  console.log('Warning: .env file already exists.');
  rl.question('Do you want to overwrite it? (y/n): ', (answer) => {
    if (answer.toLowerCase() !== 'y') {
      console.log('Setup cancelled. Existing .env file preserved.');
      rl.close();
      return;
    }
    collectCredentials();
  });
} else {
  collectCredentials();
}

function collectCredentials() {
  console.log('\nPlease enter your Shopify API credentials:');
  
  rl.question('Client ID: ', (clientId) => {
    rl.question('Access Token: ', (accessToken) => {
      rl.question('Store Name (without .myshopify.com): ', (storeName) => {
        // Create .env file content
        const envContent = `SHOPIFY_CLIENT_ID=${clientId.trim()}
SHOPIFY_ACCESS_TOKEN=${accessToken.trim()}
SHOPIFY_STORE_NAME=${storeName.trim()}`;
        
        // Write to .env file
        fs.writeFileSync(envPath, envContent);
        
        console.log('\n.env file created successfully!');
        console.log(`Credentials saved to: ${envPath}`);
        console.log('\nYou can now run the data extractor with: npm start');
        
        rl.close();
      });
    });
  });
}
