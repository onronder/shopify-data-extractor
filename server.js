const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const bodyParser = require('body-parser');
const { fetchSchema } = require('./src/utils/schema');
const { buildDynamicQuery, validateAndUpdatePredefinedQuery } = require('./src/utils/queryBuilder');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Store credentials in memory (would use a better storage in production)
let shopifyCredentials = {
  storeName: '',
  clientId: '',
  accessToken: '',
  apiVersion: '2025-01' // Latest API version by default
};

// Store extraction state
let extractionState = {
  status: 'idle',
  progress: 0,
  recordsProcessed: 0,
  totalRecords: 0,
  logs: [],
  data: null,
  resource: null,
  query: null
};

// Save credentials to .env file
function saveCredentialsToFile(credentials) {
  const envContent = 
`SHOPIFY_CLIENT_ID=${credentials.clientId}
SHOPIFY_ACCESS_TOKEN=${credentials.accessToken}
SHOPIFY_STORE_NAME=${credentials.storeName}
SHOPIFY_API_VERSION=${credentials.apiVersion}`;
  
  fs.writeFileSync(path.join(__dirname, '.env'), envContent);
}

// API Routes

// Save API credentials
app.post('/api/credentials', (req, res) => {
  const { storeName, clientId, accessToken, apiVersion } = req.body;
  
  if (!storeName || !clientId || !accessToken) {
    return res.status(400).json({ error: 'Missing required credentials' });
  }
  
  // Save credentials to memory
  shopifyCredentials = { 
    storeName, 
    clientId, 
    accessToken,
    apiVersion: apiVersion || '2025-01' // Use provided version or default to latest
  };
  
  console.log(`Credentials saved with API version: ${shopifyCredentials.apiVersion}`);
  
  // Save to .env file
  try {
    saveCredentialsToFile(shopifyCredentials);
  } catch (error) {
    console.error('Error saving credentials to file:', error);
    // Continue anyway, as we have the credentials in memory
  }
  
  res.status(200).json({ success: true, message: 'Credentials saved' });
});

// Test connection to Shopify API
app.get('/api/test-connection', async (req, res) => {
  if (!shopifyCredentials.storeName || !shopifyCredentials.accessToken) {
    return res.status(400).json({ success: false, message: 'Missing credentials' });
  }
  
  try {
    // Simple GraphQL query to test connection
    const endpoint = `https://${shopifyCredentials.storeName}.myshopify.com/admin/api/${shopifyCredentials.apiVersion}/graphql.json`;
    const testQuery = `{
      shop {
        name
        primaryDomain {
          url
        }
      }
    }`;
    
    const response = await axios({
      url: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': shopifyCredentials.accessToken
      },
      data: { query: testQuery }
    });
    
    if (response.data && response.data.data && response.data.data.shop) {
      const shopInfo = response.data.data.shop;
      return res.status(200).json({ 
        success: true, 
        message: 'Connection successful', 
        shop: shopInfo 
      });
    }
    
    res.status(400).json({ success: false, message: 'Invalid response from Shopify' });
    
  } catch (error) {
    console.error('Connection test error:', error.message);
    
    // Extract the error message from Shopify if available
    let errorMessage = 'Connection failed';
    if (error.response && error.response.data && error.response.data.errors) {
      errorMessage = error.response.data.errors;
    }
    
    res.status(500).json({ success: false, message: errorMessage });
  }
});

// Fetch GraphQL schema
app.get('/api/schema', async (req, res) => {
  if (!shopifyCredentials.storeName || !shopifyCredentials.accessToken) {
    return res.status(400).json({ error: 'Missing credentials' });
  }
  
  try {
    const schemaTypes = await fetchSchema(shopifyCredentials);
    res.status(200).json(schemaTypes);
  } catch (error) {
    console.error('Error fetching schema:', error);
    res.status(500).json({ error: 'Failed to fetch schema: ' + error.message });
  }
});

// Validate query
app.post('/api/validate-query', async (req, res) => {
  const { resourceType, predefinedType } = req.body;
  
  if (!resourceType) {
    return res.status(400).json({ error: 'Resource type is required' });
  }
  
  if (!shopifyCredentials.storeName || !shopifyCredentials.accessToken) {
    return res.status(400).json({ error: 'Missing credentials' });
  }
  
  try {
    // Fetch schema
    const schemaTypes = await fetchSchema(shopifyCredentials);
    
    let validatedQuery;
    
    if (predefinedType) {
      // Get predefined query for the type
      let predefinedData;
      
      switch (predefinedType) {
        case 'products':
          predefinedData = getPredefinedProductsQuery();
          break;
        case 'orders':
          predefinedData = getPredefinedOrdersQuery();
          break;
        case 'customers':
          predefinedData = getPredefinedCustomersQuery();
          break;
        default:
          return res.status(400).json({ error: `No predefined query for type: ${predefinedType}` });
      }
      
      // Validate and update if needed
      validatedQuery = validateAndUpdatePredefinedQuery(schemaTypes, resourceType, predefinedData);
    } else {
      // Build dynamic query
      const query = buildDynamicQuery(schemaTypes, resourceType);
      validatedQuery = {
        query,
        fields: extractFieldsFromQuery(query)
      };
    }
    
    res.status(200).json(validatedQuery);
  } catch (error) {
    console.error('Error validating query:', error);
    res.status(500).json({ error: 'Failed to validate query: ' + error.message });
  }
});

// Build dynamic query
app.post('/api/build-query', async (req, res) => {
  const { resource, fields } = req.body;
  
  if (!resource) {
    return res.status(400).json({ error: 'Resource name is required' });
  }
  
  if (!shopifyCredentials.storeName || !shopifyCredentials.accessToken) {
    return res.status(400).json({ error: 'Missing credentials' });
  }
  
  try {
    // Fetch schema
    const schemaTypes = await fetchSchema(shopifyCredentials);
    
    // Build dynamic query
    const query = buildDynamicQuery(schemaTypes, resource, fields);
    
    res.status(200).json({ query });
  } catch (error) {
    console.error('Error building query:', error);
    res.status(500).json({ error: 'Failed to build query: ' + error.message });
  }
});

// Get fields for a specific resource
app.get('/api/resource-fields', async (req, res) => {
  const { resource } = req.query;
  
  if (!resource) {
    return res.status(400).json({ error: 'Resource name is required' });
  }
  
  if (!shopifyCredentials.storeName || !shopifyCredentials.accessToken) {
    return res.status(400).json({ error: 'Missing credentials' });
  }
  
  try {
    const endpoint = `https://${shopifyCredentials.storeName}.myshopify.com/admin/api/${shopifyCredentials.apiVersion}/graphql.json`;
    
    // Query to get resource type and fields
    const typeQuery = `
      query GetResourceType {
        __type(name: "${getTypeName(resource)}") {
          name
          kind
          description
          fields {
            name
            description
            type {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                  ofType {
                    kind
                    name
                  }
                }
              }
            }
          }
        }
      }
    `;
    
    const response = await axios({
      url: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': shopifyCredentials.accessToken
      },
      data: { query: typeQuery }
    });
    
    if (response.data && response.data.data && response.data.data.__type) {
      // Remove internal fields (starting with __)
      const fields = response.data.data.__type.fields.filter(field => !field.name.startsWith('__'));
      
      return res.status(200).json({
        resource,
        type: response.data.data.__type.name,
        description: response.data.data.__type.description,
        fields
      });
    }
    
    res.status(400).json({ error: 'Invalid type response from Shopify' });
    
  } catch (error) {
    console.error('Fields fetch error:', error.message);
    res.status(500).json({ error: 'Failed to fetch resource fields' });
  }
});

// Start data extraction
app.post('/api/extract', async (req, res) => {
  const { resource, query, fields } = req.body;
  
  if (!resource) {
    return res.status(400).json({ error: 'Resource name is required' });
  }
  
  if (!shopifyCredentials.storeName || !shopifyCredentials.accessToken) {
    return res.status(400).json({ error: 'Missing credentials' });
  }
  
  try {
    // Fetch schema
    const schemaTypes = await fetchSchema(shopifyCredentials);
    
    // Validate query or build a new one
    let validatedQuery = query;
    
    if (!query) {
      // If no query provided, build dynamically
      validatedQuery = buildDynamicQuery(schemaTypes, resource, fields);
      console.log('Generated dynamic query for extraction');
    }
    
    // Reset extraction state
    extractionState = {
      status: 'initializing',
      progress: 0,
      recordsProcessed: 0,
      totalRecords: 0,
      logs: [`Starting extraction for ${resource}`],
      data: [],
      resource,
      query: validatedQuery
    };
    
    // Start extraction in the background
    extractData(resource, validatedQuery, fields, schemaTypes).catch(error => {
      console.error('Extraction error:', error);
      extractionState.status = 'failed';
      extractionState.logs.push(`Error: ${error.message}`);
    });
    
    res.status(200).json({ success: true, message: 'Extraction started' });
  } catch (error) {
    console.error('Error preparing extraction:', error);
    res.status(500).json({ error: 'Failed to prepare extraction: ' + error.message });
  }
});

// Get extraction status
app.get('/api/extraction-status', (req, res) => {
  // Return the current status and extract the most recent log
  const latestLog = extractionState.logs.length > 0 
    ? extractionState.logs[extractionState.logs.length - 1] 
    : null;
  
  res.status(200).json({
    status: extractionState.status,
    progress: extractionState.progress,
    recordsProcessed: extractionState.recordsProcessed,
    totalRecords: extractionState.totalRecords,
    log: latestLog,
    data: extractionState.status === 'completed' ? extractionState.data : null
  });
});

// Data extraction function
async function extractData(resource, query, fields, schemaTypes) {
  try {
    const endpoint = `https://${shopifyCredentials.storeName}.myshopify.com/admin/api/${shopifyCredentials.apiVersion}/graphql.json`;
    console.log(`Extraction initiated for ${resource} using endpoint: ${endpoint}`);
    console.log(`API Version: ${shopifyCredentials.apiVersion}`);
    
    const PAGE_SIZE = 250; // Maximum page size for Shopify queries
    
    let hasNextPage = true;
    let cursor = null;
    let allItems = [];
    let pageCount = 0;
    
    extractionState.status = 'running';
    
    while (hasNextPage) {
      pageCount++;
      extractionState.logs.push(`Fetching page ${pageCount} of ${resource}...`);
      extractionState.status = 'paginating';
      
      // Set variables for the query
      const variables = {
        first: PAGE_SIZE,
        after: cursor
      };
      
      try {
        console.log(`Sending GraphQL query for ${resource} (page ${pageCount})...`);
        
        const response = await axios({
          url: endpoint,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': shopifyCredentials.accessToken
          },
          data: {
            query,
            variables
          }
        });
        
        if (response.data.errors) {
          console.error(`GraphQL errors:`, JSON.stringify(response.data.errors));
          
          // Try regenerating query on error
          extractionState.logs.push(`Encountered schema errors, regenerating query...`);
          
          // Generate a new query using the schema
          const newQuery = buildDynamicQuery(schemaTypes, resource);
          
          extractionState.logs.push(`Retrying with dynamically generated query`);
          extractionState.query = newQuery;
          
          // Retry with new query
          const retryResponse = await axios({
            url: endpoint,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Shopify-Access-Token': shopifyCredentials.accessToken
            },
            data: {
              query: newQuery,
              variables
            }
          });
          
          if (retryResponse.data.errors) {
            throw new Error(`Query regeneration failed: ${retryResponse.data.errors[0].message}`);
          }
          
          // Successfully got response with new query
          const retryData = retryResponse.data.data[resource];
          const retryEdges = retryData.edges || [];
          
          // Extract items from edges
          const pageItems = retryEdges.map(edge => edge.node);
          allItems = [...allItems, ...pageItems];
          
          // Update pagination state
          hasNextPage = retryData.pageInfo.hasNextPage || false;
          cursor = retryData.pageInfo.endCursor || null;
        } else {
          // Extract data and pagination info
          const responseData = response.data.data[resource];
          const edges = responseData.edges || [];
          const pageInfo = responseData.pageInfo || {};
          
          // Extract items from edges
          const pageItems = edges.map(edge => edge.node);
          allItems = [...allItems, ...pageItems];
          
          // Update pagination state
          hasNextPage = pageInfo.hasNextPage || false;
          cursor = pageInfo.endCursor || null;
        }
        
        // Update progress
        extractionState.recordsProcessed = allItems.length;
        if (pageCount === 1 && !hasNextPage) {
          // If there's only one page, we're at 100%
          extractionState.progress = 100;
        } else if (hasNextPage) {
          // If there are more pages, estimate progress based on typical distribution
          extractionState.progress = Math.min(90, Math.floor((pageCount * PAGE_SIZE) / (pageCount * PAGE_SIZE + PAGE_SIZE) * 100));
        } else {
          // Last page reached
          extractionState.progress = 100;
        }
        
        extractionState.logs.push(`Retrieved ${pageItems.length} ${resource} (total: ${allItems.length})`);
        
        // Add a small delay to avoid hitting rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        extractionState.logs.push(`Error on page ${pageCount}: ${error.message}`);
        console.error(`Error fetching page ${pageCount}:`, error.message);
        if (error.response && error.response.data) {
          console.error('API Error:', error.response.data);
          extractionState.logs.push(`API Error: ${JSON.stringify(error.response.data)}`);
        }
        // Break out of the loop on error
        hasNextPage = false;
        extractionState.status = 'failed';
      }
    }
    
    if (extractionState.status !== 'failed') {
      extractionState.status = 'processing';
      extractionState.logs.push(`Processing ${allItems.length} items...`);
      
      // Save results
      extractionState.data = allItems;
      extractionState.totalRecords = allItems.length;
      
      // Save to file if requested
      try {
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir);
        }
        
        const filename = `${resource}_${new Date().toISOString().split('T')[0]}.json`;
        fs.writeFileSync(
          path.join(dataDir, filename),
          JSON.stringify(allItems, null, 2)
        );
        
        extractionState.logs.push(`Data saved to file: ${filename}`);
      } catch (fileError) {
        extractionState.logs.push(`Warning: Could not save to file: ${fileError.message}`);
      }
      
      // Mark as complete
      extractionState.status = 'completed';
      extractionState.logs.push(`Extraction of ${allItems.length} ${resource} completed successfully!`);
    }
  } catch (error) {
    console.error('Extraction error:', error);
    extractionState.status = 'failed';
    extractionState.logs.push(`Error: ${error.message}`);
  }
}

// Helper function to get the type name for a resource
function getTypeName(resource) {
  // In most cases, the type is the singular, capitalized form of the resource
  // But there are exceptions, so we handle common cases
  const resourceTypeMappings = {
    products: 'Product',
    customers: 'Customer',
    orders: 'Order',
    collections: 'Collection',
    inventory: 'InventoryItem',
    metafields: 'Metafield',
    fulfillments: 'Fulfillment',
    // Add more mappings as needed
  };
  
  // Check if we have a direct mapping
  if (resourceTypeMappings[resource]) {
    return resourceTypeMappings[resource];
  }
  
  // Default to capitalizing and singularizing (naive approach)
  const singular = resource.endsWith('s') ? resource.slice(0, -1) : resource;
  return singular.charAt(0).toUpperCase() + singular.slice(1);
}

// Helper function to extract fields from a query
function extractFieldsFromQuery(query) {
  const fields = [];
  const lines = query.split('\n');
  let inNodeBlock = false;
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    if (trimmedLine.includes('node {')) {
      inNodeBlock = true;
      continue;
    }
    
    if (inNodeBlock && trimmedLine.includes('}')) {
      if (trimmedLine === '}') { // Single closing bracket (ending node block)
        inNodeBlock = false;
      }
      continue;
    }
    
    if (inNodeBlock && trimmedLine && !trimmedLine.includes('{') && !trimmedLine.includes('}')) {
      fields.push(trimmedLine);
    }
  }
  
  return fields;
}

// Predefined query helpers
function getPredefinedProductsQuery() {
  return {
    query: `
query GetProducts($first: Int!, $after: String) {
  products(first: $first, after: $after) {
    pageInfo {
      hasNextPage
      endCursor
    }
    edges {
      node {
        id
        title
        handle
        description
        productType
        vendor
        status
        tags
        createdAt
        updatedAt
        publishedAt
        onlineStoreUrl
        featuredImage {
          id
          url
          altText
        }
        priceRangeV2 {
          minVariantPrice {
            amount
            currencyCode
          }
          maxVariantPrice {
            amount
            currencyCode
          }
        }
        totalInventory
        variants(first: 50) {
          edges {
            node {
              id
              title
              sku
              price
              compareAtPrice
              inventoryQuantity
              barcode
              availableForSale
              taxable
              selectedOptions {
                name
                value
              }
            }
          }
        }
        images(first: 20) {
          edges {
            node {
              id
              url
              width
              height
              altText
            }
          }
        }
        metafields(first: 10) {
          edges {
            node {
              id
              namespace
              key
              value
              type
            }
          }
        }
      }
    }
  }
}`,
    fields: ["id", "title", "handle", "description", "productType", "vendor", "status", "tags", 
             "createdAt", "updatedAt", "publishedAt", "onlineStoreUrl", "featuredImage", 
             "priceRangeV2", "totalInventory", "variants", "images", "metafields"]
  };
}

function getPredefinedOrdersQuery() {
  return {
    query: `
query GetOrders($first: Int!, $after: String) {
  orders(first: $first, after: $after) {
    pageInfo {
      hasNextPage
      endCursor
    }
    edges {
      node {
        id
        name
        email
        phone
        closed
        cancelReason
        cancelledAt
        processedAt
        createdAt
        updatedAt
        displayFulfillmentStatus
        displayFinancialStatus
        note
        tags
        subtotalLineItemsQuantity
        totalPriceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        subtotalPriceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        totalShippingPriceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        totalTaxSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        totalDiscountsSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        customer {
          id
          firstName
          lastName
          email
          phone
        }
        shippingAddress {
          firstName
          lastName
          address1
          address2
          city
          province
          country
          zip
          phone
        }
        lineItems(first: 50) {
          edges {
            node {
              id
              title
              quantity
              originalTotalSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              discountedTotalSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              variant {
                id
                title
                sku
                price
              }
            }
          }
        }
      }
    }
  }
}`,
    fields: ["id", "name", "email", "phone", "closed", "cancelReason", "cancelledAt", "processedAt", 
             "createdAt", "updatedAt", "displayFulfillmentStatus", "displayFinancialStatus", "note", 
             "tags", "subtotalLineItemsQuantity", "totalPriceSet", "subtotalPriceSet", 
             "totalShippingPriceSet", "totalTaxSet", "totalDiscountsSet", "customer", 
             "shippingAddress", "lineItems"]
  };
}

function getPredefinedCustomersQuery() {
  return {
    query: `
query GetCustomers($first: Int!, $after: String) {
  customers(first: $first, after: $after) {
    pageInfo {
      hasNextPage
      endCursor
    }
    edges {
      node {
        id
        firstName
        lastName
        displayName
        email
        phone
        createdAt
        updatedAt
        verifiedEmail
        taxExempt
        taxExemptions
        state
        tags
        note
        defaultAddress {
          id
          address1
          address2
          city
          province
          country
          zip
          phone
        }
        addresses(first: 10) {
          edges {
            node {
              id
              address1
              address2
              city
              province
              country
              zip
              phone
            }
          }
        }
        orders(first: 5) {
          edges {
            node {
              id
              name
              processedAt
              totalPriceSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              displayFinancialStatus
            }
          }
        }
        metafields(first: 10) {
          edges {
            node {
              id
              namespace
              key
              value
              type
            }
          }
        }
      }
    }
  }
}`,
    fields: ["id", "firstName", "lastName", "displayName", "email", "phone", "createdAt", "updatedAt", 
             "verifiedEmail", "taxExempt", "taxExemptions", "state", "tags", "note", "defaultAddress", 
             "addresses", "orders", "metafields"]
  };
}

// Serve the main HTML file for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});
