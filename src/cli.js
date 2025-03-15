#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { fetchAllPages } = require('./utils/pagination');

// Ensure data directory exists
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

async function cli() {
  const args = process.argv.slice(2);
  const dataType = args[0];
  const limit = parseInt(args[1], 10) || 50;
  
  if (!dataType || !['products', 'orders', 'customers', 'all'].includes(dataType)) {
    console.log('Usage: node cli.js <data-type> [limit]');
    console.log('Available data types: products, orders, customers, all');
    console.log('Example: node cli.js products 100');
    process.exit(1);
  }
  
  try {
    // Track start time
    const startTime = new Date();
    console.log(`Starting extraction for ${dataType === 'all' ? 'all data types' : dataType} at ${startTime.toISOString()}`);
    
    if (dataType === 'products' || dataType === 'all') {
      console.log('\n--- EXTRACTING PRODUCTS ---');
      const { productQuery, variables } = require('./queries/products');
      variables.first = limit;
      await fetchAllPages('products', productQuery, variables, 'products');
    }
    
    if (dataType === 'orders' || dataType === 'all') {
      console.log('\n--- EXTRACTING ORDERS ---');
      const { orderQuery, variables } = require('./queries/orders');
      variables.first = limit;
      await fetchAllPages('orders', orderQuery, variables, 'orders');
    }
    
    if (dataType === 'customers' || dataType === 'all') {
      console.log('\n--- EXTRACTING CUSTOMERS ---');
      const { customerQuery, variables } = require('./queries/customers');
      variables.first = limit;
      await fetchAllPages('customers', customerQuery, variables, 'customers');
    }
    
    // Calculate duration
    const endTime = new Date();
    const durationMs = endTime - startTime;
    const durationMinutes = Math.floor(durationMs / 60000);
    const durationSeconds = ((durationMs % 60000) / 1000).toFixed(2);
    
    console.log('\n--- EXTRACTION COMPLETED ---');
    console.log(`Duration: ${durationMinutes} minutes, ${durationSeconds} seconds`);
    console.log(`Results saved to ${dataDir}`);
  } catch (error) {
    console.error('Error during data extraction:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

cli();
