require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { fetchAllPages } = require('./utils/pagination');
const { productQuery, variables: productVariables } = require('./queries/products');
const { orderQuery, variables: orderVariables } = require('./queries/orders');
const { customerQuery, variables: customerVariables } = require('./queries/customers');

// Ensure data directory exists
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

async function main() {
  try {
    // Track start time
    const startTime = new Date();
    console.log(`Starting data extraction at ${startTime.toISOString()}`);
    
    // Extract products with pagination
    console.log('\n--- EXTRACTING PRODUCTS ---');
    const products = await fetchAllPages(
      'products',
      productQuery,
      productVariables,
      'products'
    );
    console.log(`Total products extracted: ${products.length}`);
    
    // Extract orders with pagination
    console.log('\n--- EXTRACTING ORDERS ---');
    const orders = await fetchAllPages(
      'orders',
      orderQuery,
      orderVariables,
      'orders'
    );
    console.log(`Total orders extracted: ${orders.length}`);
    
    // Extract customers with pagination
    console.log('\n--- EXTRACTING CUSTOMERS ---');
    const customers = await fetchAllPages(
      'customers',
      customerQuery,
      customerVariables,
      'customers'
    );
    console.log(`Total customers extracted: ${customers.length}`);
    
    // Create a summary file
    const endTime = new Date();
    const durationMs = endTime - startTime;
    const durationMinutes = Math.floor(durationMs / 60000);
    const durationSeconds = ((durationMs % 60000) / 1000).toFixed(2);
    
    const summary = {
      extractionDate: endTime.toISOString(),
      duration: `${durationMinutes} minutes, ${durationSeconds} seconds`,
      counts: {
        products: products.length,
        orders: orders.length,
        customers: customers.length,
      }
    };
    
    fs.writeFileSync(
      path.join(dataDir, 'extraction_summary.json'),
      JSON.stringify(summary, null, 2)
    );
    
    console.log('\n--- EXTRACTION COMPLETED ---');
    console.log(`Duration: ${durationMinutes} minutes, ${durationSeconds} seconds`);
    console.log(`Results saved to ${dataDir}`);
    console.log('Summary:');
    console.log(`- Products: ${products.length}`);
    console.log(`- Orders: ${orders.length}`);
    console.log(`- Customers: ${customers.length}`);
  } catch (error) {
    console.error('Error during data extraction:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

main();
