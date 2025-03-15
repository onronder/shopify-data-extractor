const axios = require('axios');

// Load environment variables
const clientId = process.env.SHOPIFY_CLIENT_ID;
const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
const storeName = process.env.SHOPIFY_STORE_NAME;

// Validate environment variables
if (!clientId || !accessToken || !storeName) {
  console.error('Error: Missing required environment variables. Please check your .env file.');
  process.exit(1);
}

// Configure GraphQL endpoint
const endpoint = `https://${storeName}.myshopify.com/admin/api/2023-10/graphql.json`;

/**
 * Execute a GraphQL query against the Shopify Admin API
 * @param {string} query - The GraphQL query to execute
 * @param {Object} variables - Variables for the GraphQL query
 * @returns {Promise<Object>} - The query result
 */
async function executeQuery(query, variables = {}) {
  try {
    const response = await axios({
      url: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
        'X-GraphQL-Cost-Include-Fields': true
      },
      data: {
        query,
        variables
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('GraphQL query execution failed:');
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
      console.error('Response data:', error.response.data);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('Request made but no response received:', error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error setting up request:', error.message);
    }
    throw error;
  }
}

module.exports = {
  executeQuery
};
