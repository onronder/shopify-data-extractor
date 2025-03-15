const fs = require('fs');
const path = require('path');
const { executeQuery } = require('../graphql');

/**
 * Handles paginated data extraction from Shopify GraphQL API
 * @param {string} queryName - Name of the query for file naming
 * @param {string} query - GraphQL query
 * @param {Object} variables - Query variables
 * @param {string} dataPath - Path in response to access edges (e.g., 'products')
 * @returns {Promise<Array>} - Array of all fetched items
 */
async function fetchAllPages(queryName, query, variables, dataPath) {
  const dataDir = path.join(__dirname, '../../data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
  }

  console.log(`Starting paginated extraction for ${queryName}...`);
  
  let hasNextPage = true;
  let cursor = null;
  let allItems = [];
  let pageCount = 0;
  
  while (hasNextPage) {
    pageCount++;
    console.log(`Fetching page ${pageCount} of ${queryName}...`);
    
    // Update cursor for pagination
    const pageVariables = { ...variables, after: cursor };
    
    try {
      const response = await executeQuery(query, pageVariables);
      
      // Extract data from response using the provided path
      const data = response.data[dataPath];
      const edges = data.edges || [];
      
      // Extract items from edges and add to collection
      const pageItems = edges.map(edge => edge.node);
      allItems = [...allItems, ...pageItems];
      
      // Save each page as we go for fault tolerance
      fs.writeFileSync(
        path.join(dataDir, `${queryName}_page_${pageCount}.json`),
        JSON.stringify(response, null, 2)
      );
      
      // Check if there are more pages
      hasNextPage = data.pageInfo.hasNextPage;
      cursor = data.pageInfo.endCursor;
      
      console.log(`Extracted ${edges.length} items from page ${pageCount}`);
      
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`Error fetching page ${pageCount} of ${queryName}:`, error.message);
      if (error.response && error.response.data) {
        console.error('API Error:', error.response.data);
      }
      break;
    }
  }
  
  // Save all items to a consolidated file
  fs.writeFileSync(
    path.join(dataDir, `${queryName}_all.json`),
    JSON.stringify(allItems, null, 2)
  );
  
  console.log(`Completed extraction for ${queryName}. Total items: ${allItems.length}`);
  return allItems;
}

module.exports = {
  fetchAllPages
};
