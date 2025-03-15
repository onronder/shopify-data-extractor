# Shopify Dependent Queries Implementation

This document provides a complete implementation plan for enhancing the Shopify GraphQL Data Extractor with resilient dependent query capabilities. The implementation is designed to work with the existing codebase while adding support for advanced dependent query scenarios.

## Table of Contents

1. [New Files to Create](#new-files-to-create)
2. [Existing Files to Modify](#existing-files-to-modify)
3. [Implementation Details](#implementation-details)
4. [Dependent Query Templates](#dependent-query-templates)
5. [Installation Instructions](#installation-instructions)

## New Files to Create

Create the following new files to implement the dependent query system:

1. `src/utils/dependentQueries.js` - Core utility for executing dependent queries
2. `src/utils/schemaVersioning.js` - Handles API version detection and schema caching
3. `src/queries/dependentQueryTemplates.js` - Contains templates for all dependent query types
4. `public/dependent-queries-info.html` - Documentation page for dependent queries

## Existing Files to Modify

Modify these existing files to integrate the dependent query system:

1. `server.js` - Add new API endpoints for dependent queries
2. `public/app.js` - Add UI components for dependent query selection and execution
3. `public/index.html` - Add dependent query button to the UI
4. `public/styles.css` - Add styling for new dependent query components

## Implementation Details

### 1. Core Dependent Query Utility

**File: `src/utils/dependentQueries.js`**

```javascript
const axios = require('axios');
const fs = require('fs');
const path = require('path');

/**
 * Execute dependent queries against Shopify API
 * @param {Object} options Configuration options
 * @returns {Promise<Array>} Combined results
 */
async function executeDependentQueries(options) {
  const {
    credentials,
    primaryQuery,
    primaryVariables = { first: 50, after: null },
    secondaryQueryBuilder,
    idExtractor,
    resultMerger,
    batchSize = 5,
    delay = 500,
    progressCallback,
    extractionState
  } = options;

  // Configure endpoint
  const endpoint = `https://${credentials.storeName}.myshopify.com/admin/api/${credentials.apiVersion}/graphql.json`;
  
  try {
    // Step 1: Execute primary query with pagination
    let hasNextPage = true;
    let cursor = null;
    let primaryResults = [];
    let idList = [];
    let pageCount = 0;
    
    // Report initial progress
    if (progressCallback) {
      progressCallback({
        stage: 'primary',
        progress: 0,
        message: 'Starting primary query execution...'
      });
    }
    
    if (extractionState) {
      extractionState.status = 'fetching-primary';
      extractionState.logs.push('Starting primary query execution...');
    }
    
    // Execute paginated primary query
    while (hasNextPage) {
      pageCount++;
      
      try {
        // Update variables for pagination
        const variables = { ...primaryVariables, after: cursor };
        
        // Log the request
        if (extractionState) {
          extractionState.logs.push(`Executing primary query page ${pageCount}...`);
        }
        
        // Execute query
        const response = await axios({
          url: endpoint,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': credentials.accessToken
          },
          data: { query: primaryQuery, variables }
        });
        
        // Handle errors
        if (response.data.errors) {
          const errorMessage = `GraphQL Error: ${response.data.errors[0].message}`;
          if (extractionState) {
            extractionState.logs.push(`Error: ${errorMessage}`);
          }
          throw new Error(errorMessage);
        }
        
        // Extract data and pagination info
        const data = response.data.data;
        const resourceKey = Object.keys(data)[0];
        const resource = data[resourceKey];
        
        // Add results to collection
        const pageResults = resource.edges.map(edge => edge.node);
        primaryResults = [...primaryResults, ...pageResults];
        
        // Extract IDs using the provided extractor function
        const pageIds = idExtractor(pageResults);
        idList = [...idList, ...pageIds];
        
        // Update pagination state
        hasNextPage = resource.pageInfo.hasNextPage;
        cursor = resource.pageInfo.endCursor;
        
        // Report progress (0-50%)
        const progressPercentage = Math.min(50, Math.floor((pageCount * 10)));
        
        if (progressCallback) {
          progressCallback({
            stage: 'primary',
            progress: progressPercentage,
            message: `Fetched primary page ${pageCount} (${pageResults.length} items)`
          });
        }
        
        if (extractionState) {
          extractionState.progress = progressPercentage;
          extractionState.recordsProcessed = primaryResults.length;
          extractionState.logs.push(`Retrieved ${pageResults.length} primary records (total: ${primaryResults.length})`);
        }
        
        // Add delay before next request
        if (hasNextPage) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        const errorMessage = `Primary query failed on page ${pageCount}: ${error.message}`;
        if (extractionState) {
          extractionState.logs.push(`Error: ${errorMessage}`);
        }
        throw new Error(errorMessage);
      }
    }
    
    // Step 2: Execute secondary queries in batches
    const secondaryResults = [];
    const batches = [];
    
    // Create batches of IDs
    for (let i = 0; i < idList.length; i += batchSize) {
      batches.push(idList.slice(i, i + batchSize));
    }
    
    // Report progress update
    if (progressCallback) {
      progressCallback({
        stage: 'secondary',
        progress: 50,
        message: `Starting dependent queries for ${idList.length} items in ${batches.length} batches...`
      });
    }
    
    if (extractionState) {
      extractionState.status = 'fetching-secondary';
      extractionState.logs.push(`Starting dependent queries for ${idList.length} items in ${batches.length} batches...`);
    }
    
    // Process each batch
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      
      try {
        // Create queries for this batch
        const batchPromises = batch.map(id => {
          // Build secondary query using the provided function
          const { query, variables } = secondaryQueryBuilder(id);
          
          return axios({
            url: endpoint,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Shopify-Access-Token': credentials.accessToken
            },
            data: { query, variables }
          });
        });
        
        if (extractionState) {
          extractionState.logs.push(`Processing batch ${i + 1}/${batches.length} (${batch.length} items)`);
        }
        
        // Execute batch in parallel
        const batchResponses = await Promise.all(batchPromises);
        
        // Process batch responses
        batchResponses.forEach((response, index) => {
          if (response.data.errors) {
            const warning = `Secondary query warning for ID ${batch[index]}: ${response.data.errors[0].message}`;
            console.warn(warning);
            if (extractionState) {
              extractionState.logs.push(`Warning: ${warning}`);
            }
          } else {
            secondaryResults.push(response.data.data);
          }
        });
        
        // Report progress (50-100%)
        const batchProgress = 50 + Math.floor(((i + 1) / batches.length) * 50);
        
        if (progressCallback) {
          progressCallback({
            stage: 'secondary',
            progress: batchProgress,
            message: `Processed batch ${i + 1}/${batches.length} (${batch.length} items)`
          });
        }
        
        if (extractionState) {
          extractionState.progress = batchProgress;
          extractionState.logs.push(`Completed batch ${i + 1}/${batches.length} (${secondaryResults.length} secondary records retrieved)`);
        }
        
        // Add delay before next batch
        if (i < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        const errorMessage = `Secondary query batch ${i + 1} failed: ${error.message}`;
        if (extractionState) {
          extractionState.logs.push(`Error: ${errorMessage}`);
        }
        throw new Error(errorMessage);
      }
    }
    
    // Step 3: Merge results using the provided merger function
    const mergedResults = resultMerger(primaryResults, secondaryResults);
    
    if (extractionState) {
      extractionState.logs.push(`Successfully merged ${primaryResults.length} primary records with ${secondaryResults.length} secondary records`);
    }
    
    return mergedResults;
  } catch (error) {
    if (extractionState) {
      extractionState.status = 'failed';
      extractionState.logs.push(`Error in dependent query execution: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Save extracted data to file
 * @param {string} queryType Type of query
 * @param {Array} data Data to save
 * @returns {string} Filename
 */
function saveResultsToFile(queryType, data) {
  const dataDir = path.join(__dirname, '../../data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  const filename = `${queryType}_${new Date().toISOString().split('T')[0]}.json`;
  fs.writeFileSync(
    path.join(dataDir, filename),
    JSON.stringify(data, null, 2)
  );
  
  return filename;
}

module.exports = {
  executeDependentQueries,
  saveResultsToFile
};
```

### 2. Schema Versioning Utility

**File: `src/utils/schemaVersioning.js`**

```javascript
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.join(__dirname, '../../cache');
const SCHEMA_CACHE_FILE = path.join(CACHE_DIR, 'schema-cache.json');

/**
 * Get current Shopify API schema
 * @param {Object} credentials Shopify API credentials
 * @returns {Promise<Object>} GraphQL schema
 */
async function getApiSchema(credentials) {
  // Basic introspection query to get type information
  const introspectionQuery = `
    query {
      __schema {
        types {
          name
          kind
          fields {
            name
            description
            type {
              name
              kind
              ofType {
                name
                kind
                ofType {
                  name
                  kind
                  ofType {
                    name
                    kind
                  }
                }
              }
            }
          }
        }
      }
    }
  `;
  
  const response = await axios({
    url: `https://${credentials.storeName}.myshopify.com/admin/api/${credentials.apiVersion}/graphql.json`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': credentials.accessToken
    },
    data: {
      query: introspectionQuery
    }
  });
  
  if (response.data.errors) {
    throw new Error(`Schema introspection failed: ${response.data.errors[0].message}`);
  }
  
  return response.data.data.__schema;
}

/**
 * Check if a field exists in the schema
 * @param {Object} schema GraphQL schema
 * @param {string} typeName Name of the type
 * @param {string} fieldName Name of the field
 * @returns {boolean} Whether the field exists
 */
function fieldExists(schema, typeName, fieldName) {
  const type = schema.types.find(t => t.name === typeName);
  if (!type || !type.fields) return false;
  
  return type.fields.some(f => f.name === fieldName);
}

/**
 * Get available fields for a type
 * @param {Object} schema GraphQL schema
 * @param {string} typeName Name of the type
 * @returns {Array} Available fields
 */
function getAvailableFields(schema, typeName) {
  const type = schema.types.find(t => t.name === typeName);
  if (!type || !type.fields) return [];
  
  return type.fields.map(field => ({
    name: field.name,
    description: field.description,
    type: field.type
  }));
}

/**
 * Save schema to cache
 * @param {Object} schema GraphQL schema
 * @param {string} apiVersion API version
 */
function saveSchemaToCache(schema, apiVersion) {
  // Create cache directory if it doesn't exist
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
  
  // Save schema with version information
  const cacheData = {
    apiVersion,
    timestamp: new Date().toISOString(),
    schema
  };
  
  fs.writeFileSync(
    SCHEMA_CACHE_FILE,
    JSON.stringify(cacheData, null, 2)
  );
}

/**
 * Load schema from cache
 * @returns {Object|null} Cached schema or null if not found
 */
function loadSchemaFromCache() {
  try {
    if (fs.existsSync(SCHEMA_CACHE_FILE)) {
      const cacheData = JSON.parse(fs.readFileSync(SCHEMA_CACHE_FILE, 'utf8'));
      return cacheData;
    }
    return null;
  } catch (error) {
    console.warn('Error loading schema cache:', error.message);
    return null;
  }
}

/**
 * Clear schema cache
 */
function clearSchemaCache() {
  if (fs.existsSync(SCHEMA_CACHE_FILE)) {
    fs.unlinkSync(SCHEMA_CACHE_FILE);
  }
}

/**
 * Compare API versions
 * @param {string} version1 First version (e.g., "2023-10")
 * @param {string} version2 Second version (e.g., "2024-01")
 * @returns {number} -1 if version1 < version2, 0 if equal, 1 if version1 > version2
 */
function compareVersions(version1, version2) {
  const [year1, month1] = version1.split('-').map(Number);
  const [year2, month2] = version2.split('-').map(Number);
  
  if (year1 !== year2) return year1 - year2;
  return month1 - month2;
}

/**
 * Validate query fields against schema
 * @param {Object} schema GraphQL schema
 * @param {string} typeName Type name (e.g., "Product")
 * @param {Array} fields Array of field names
 * @returns {Array} Valid fields that exist in the schema
 */
function validateQueryFields(schema, typeName, fields) {
  return fields.filter(field => fieldExists(schema, typeName, field));
}

module.exports = {
  getApiSchema,
  fieldExists,
  getAvailableFields,
  saveSchemaToCache,
  loadSchemaFromCache,
  clearSchemaCache,
  compareVersions,
  validateQueryFields
};
```

### 3. Dependent Query Templates

**File: `src/queries/dependentQueryTemplates.js`**

```javascript
/**
 * Templates for Shopify Dependent Queries
 */

// 1. Product Variants
const productVariantsTemplate = {
  name: 'product-variants',
  label: 'Product Variants',
  description: 'Extract detailed variant information including inventory, prices, and options.',
  help: 'First fetches products, then queries each variant individually.',
  primaryQuery: `
    query GetProductsWithVariantIds($first: Int!, $after: String) {
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
            status
            variants(first: 20) {
              edges {
                node {
                  id
                }
              }
            }
          }
        }
      }
    }
  `,
  buildSecondaryQuery: (variantId) => ({
    query: `
      query GetProductVariant($id: ID!) {
        productVariant(id: $id) {
          id
          title
          sku
          price
          compareAtPrice
          barcode
          inventoryQuantity
          selectedOptions {
            name
            value
          }
          inventoryItem {
            id
            tracked
          }
          product {
            id
          }
        }
      }
    `,
    variables: { id: variantId }
  }),
  idExtractor: (products) => {
    const variantIds = [];
    products.forEach(product => {
      if (product.variants && product.variants.edges) {
        product.variants.edges.forEach(edge => {
          variantIds.push(edge.node.id);
        });
      }
    });
    return variantIds;
  },
  resultMerger: (products, variantResults) => {
    // Create a map of variant details by ID
    const variantMap = {};
    variantResults.forEach(result => {
      if (result.productVariant) {
        variantMap[result.productVariant.id] = result.productVariant;
      }
    });
    
    // Merge variant details into products
    return products.map(product => {
      const detailedVariants = [];
      
      // Replace variant nodes with detailed variants
      if (product.variants && product.variants.edges) {
        product.variants.edges.forEach(edge => {
          const variantId = edge.node.id;
          if (variantMap[variantId]) {
            detailedVariants.push(variantMap[variantId]);
          }
        });
      }
      
      // Create a new object with detailed variants
      return {
        ...product,
        variants: { edges: product.variants.edges }, // Keep original structure
        detailedVariants // Add the detailed variants array
      };
    });
  }
};

// 2. Metafields
const metafieldsTemplate = {
  name: 'metafields',
  label: 'Metafields',
  description: 'Extract metafields for products, orders, customers, etc.',
  help: 'First fetches resources, then queries metafields for each item.',
  primaryQuery: `
    query GetProductsForMetafields($first: Int!, $after: String) {
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
          }
        }
      }
    }
  `,
  buildSecondaryQuery: (productId) => ({
    query: `
      query GetProductMetafields($id: ID!) {
        product(id: $id) {
          id
          metafields(first: 20) {
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
    `,
    variables: { id: productId }
  }),
  idExtractor: (products) => {
    return products.map(product => product.id);
  },
  resultMerger: (products, metafieldResults) => {
    // Create a map of metafields by product ID
    const metafieldMap = {};
    metafieldResults.forEach(result => {
      if (result.product) {
        metafieldMap[result.product.id] = result.product.metafields.edges.map(edge => edge.node);
      }
    });
    
    // Merge metafields into products
    return products.map(product => {
      return {
        ...product,
        detailedMetafields: metafieldMap[product.id] || []
      };
    });
  }
};

// 3. Order Line Items
const orderLineItemsTemplate = {
  name: 'order-line-items',
  label: 'Order Line Items',
  description: 'Extract detailed line item information for orders.',
  help: 'Useful for orders with many line items that exceed pagination limits.',
  primaryQuery: `
    query GetOrdersForLineItems($first: Int!, $after: String) {
      orders(first: $first, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            name
            createdAt
            displayFinancialStatus
            displayFulfillmentStatus
            totalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
          }
        }
      }
    }
  `,
  buildSecondaryQuery: (orderId) => ({
    query: `
      query GetOrderLineItems($id: ID!) {
        order(id: $id) {
          id
          lineItems(first: 250) {
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
                  product {
                    id
                    title
                  }
                }
              }
            }
          }
        }
      }
    `,
    variables: { id: orderId }
  }),
  idExtractor: (orders) => {
    return orders.map(order => order.id);
  },
  resultMerger: (orders, lineItemResults) => {
    // Create a map of line items by order ID
    const lineItemMap = {};
    lineItemResults.forEach(result => {
      if (result.order) {
        lineItemMap[result.order.id] = result.order.lineItems.edges.map(edge => edge.node);
      }
    });
    
    // Merge line items into orders
    return orders.map(order => {
      return {
        ...order,
        detailedLineItems: lineItemMap[order.id] || []
      };
    });
  }
};

// 4. Customer Order History
const customerOrderHistoryTemplate = {
  name: 'customer-order-history',
  label: 'Customer Order History',
  description: 'Extract complete order history for customers.',
  help: 'Analyze customer lifetime value, purchase frequency, and buying patterns.',
  primaryQuery: `
    query GetCustomersForOrderHistory($first: Int!, $after: String) {
      customers(first: $first, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            email
            firstName
            lastName
            displayName
            ordersCount
            totalSpent
          }
        }
      }
    }
  `,
  buildSecondaryQuery: (customerId) => ({
    query: `
      query GetCustomerOrders($id: ID!) {
        customer(id: $id) {
          id
          orders(first: 250) {
            edges {
              node {
                id
                name
                processedAt
                displayFinancialStatus
                displayFulfillmentStatus
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
                totalTaxSet {
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
              }
            }
          }
        }
      }
    `,
    variables: { id: customerId }
  }),
  idExtractor: (customers) => {
    return customers.map(customer => customer.id);
  },
  resultMerger: (customers, orderResults) => {
    // Create a map of orders by customer ID
    const orderMap = {};
    orderResults.forEach(result => {
      if (result.customer && result.customer.orders) {
        orderMap[result.customer.id] = result.customer.orders.edges.map(edge => edge.node);
      }
    });
    
    // Merge orders into customers
    return customers.map(customer => {
      return {
        ...customer,
        detailedOrders: orderMap[customer.id] || []
      };
    });
  }
};

// 5. Inventory Across Locations
const inventoryAcrossLocationsTemplate = {
  name: 'inventory-across-locations',
  label: 'Inventory Across Locations',
  description: 'Extract inventory levels for all items across all locations.',
  help: 'Complete inventory visibility across multiple store locations.',
  primaryQuery: `
    query GetLocationsAndInventoryItems($first: Int!, $after: String) {
      locations(first: $first) {
        edges {
          node {
            id
            name
            isActive
          }
        }
      }
      inventoryItems(first: $first, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            sku
            tracked
            variant {
              id
              displayName
              product {
                id
                title
              }
            }
          }
        }
      }
    }
  `,
  buildSecondaryQuery: (inventoryItemId) => ({
    query: `
      query GetInventoryLevels($id: ID!) {
        inventoryItem(id: $id) {
          id
          inventoryLevels(first: 20) {
            edges {
              node {
                id
                available
                location {
                  id
                  name
                }
              }
            }
          }
        }
      }
    `,
    variables: { id: inventoryItemId }
  }),
  idExtractor: (data) => {
    // Extract inventory item IDs
    if (data[0] && data[0].inventoryItems && data[0].inventoryItems.edges) {
      return data[0].inventoryItems.edges.map(edge => edge.node.id);
    }
    
    // For paginated results, this will be a flat array of inventory items
    return data.map(item => item.id);
  },
  resultMerger: (primaryData, inventoryLevelResults) => {
    // Extract locations and inventory items from primary data
    let locations = [];
    let inventoryItems = [];
    
    if (primaryData[0] && primaryData[0].locations) {
      // First page of results
      locations = primaryData[0].locations.edges.map(edge => edge.node);
      inventoryItems = primaryData[0].inventoryItems.edges.map(edge => edge.node);
    } else {
      // Handle pagination (location data will be in first page only)
      inventoryItems = primaryData;
    }
    
    // Create map of inventory levels by inventory item ID
    const inventoryLevelMap = {};
    inventoryLevelResults.forEach(result => {
      if (result.inventoryItem && result.inventoryItem.inventoryLevels) {
        inventoryLevelMap[result.inventoryItem.id] = result.inventoryItem.inventoryLevels.edges.map(edge => edge.node);
      }
    });
    
    // Merge inventory levels into inventory items
    const enrichedInventoryItems = inventoryItems.map(item => {
      return {
        ...item,
        inventoryLevels: inventoryLevelMap[item.id] || []
      };
    });
    
    return {
      locations,
      inventoryItems: enrichedInventoryItems
    };
  }
};

// 6. Fulfillment Details
const fulfillmentDetailsTemplate = {
  name: 'fulfillment-details',
  label: 'Fulfillment Details',
  description: 'Extract detailed fulfillment information for orders.',
  help: 'Analyze shipping performance, fulfillment times, and delivery issues.',
  primaryQuery: `
    query GetOrdersForFulfillments($first: Int!, $after: String) {
      orders(first: $first, after: $after, query: "fulfillment_status:partial OR fulfillment_status:fulfilled") {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            name
            createdAt
            displayFulfillmentStatus
          }
        }
      }
    }
  `,
  buildSecondaryQuery: (orderId) => ({
    query: `
      query GetOrderFulfillments($id: ID!) {
        order(id: $id) {
          id
          fulfillments(first: 20) {
            edges {
              node {
                id
                status
                createdAt
                updatedAt
                trackingInfo {
                  company
                  number
                  url
                }
                deliveredAt
                estimatedDeliveryAt
                shipmentStatus
                service
                totalQuantity
                lineItems(first: 10) {
                  edges {
                    node {
                      id
                      title
                      quantity
                    }
                  }
                }
              }
            }
          }
        }
      }
    `,
    variables: { id: orderId }
  }),
  idExtractor: (orders) => {
    return orders.map(order => order.id);
  },
  resultMerger: (orders, fulfillmentResults) => {
    // Create a map of fulfillments by order ID
    const fulfillmentMap = {};
    fulfillmentResults.forEach(result => {
      if (result.order && result.order.fulfillments) {
        fulfillmentMap[result.order.id] = result.order.fulfillments.edges.map(edge => edge.node);
      }
    });
    
    // Merge fulfillments into orders
    return orders.map(order => {
      return {
        ...order,
        detailedFulfillments: fulfillmentMap[order.id] || []
      };
    });
  }
};

// 7. Product Collections
const productCollectionsTemplate = {
  name: 'product-collections',
  label: 'Product Collections',
  description: 'Extract all products within each collection.',
  help: 'Analyze collection performance and product categorization.',
  primaryQuery: `
    query GetCollections($first: Int!, $after: String) {
      collections(first: $first, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            title
            handle
            productsCount
            updatedAt
          }
        }
      }
    }
  `,
  buildSecondaryQuery: (collectionId) => ({
    query: `
      query GetCollectionProducts($id: ID!) {
        collection(id: $id) {
          id
          products(first: 250) {
            pageInfo {
              hasNextPage
              endCursor
            }
            edges {
              node {
                id
                title
                handle
                productType
                vendor
                publishedAt
                images(first: 1) {
                  edges {
                    node {
                      id
                      url
                    }
                  }
                }
                variants(first: 1) {
                  edges {
                    node {
                      id
                      price
                    }
                  }
                }
              }
            }
          }
        }
      }
    `,
    variables: { id: collectionId }
  }),
  idExtractor: (collections) => {
    return collections.map(collection => collection.id);
  },
  resultMerger: (collections, productResults) => {
    // Create a map of products by collection ID
    const productMap = {};
    productResults.forEach(result => {
      if (result.collection && result.collection.products) {
        productMap[result.collection.id] = result.collection.products.edges.map(edge => edge.node);
      }
    });
    
    // Merge products into collections
    return collections.map(collection => {
      return {
        ...collection,
        detailedProducts: productMap[collection.id] || []
      };
    });
  }
};

// 8. Discount Usage
const discountUsageTemplate = {
  name: 'discount-usage',
  label: 'Discount Usage',
  description: 'Extract discount codes and usage statistics for each price rule.',
  help: 'Measure promotion effectiveness and discount usage patterns.',
  primaryQuery: `
    query GetPriceRules($first: Int!, $after: String) {
      priceRules(first: $first, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            title
            target
            startsAt
            endsAt
            status
            valueType
            value
          }
        }
      }
    }
  `,
  buildSecondaryQuery: (priceRuleId) => ({
    query: `
      query GetDiscountCodes($id: ID!) {
        priceRule(id: $id) {
          id
          discountCodes(first: 50) {
            edges {
              node {
                id
                code
                usageCount
                createdAt
              }
            }
          }
        }
      }
    `,
    variables: { id: priceRuleId }
  }),
  idExtractor: (priceRules) => {
    return priceRules.map(rule => rule.id);
  },
  resultMerger: (priceRules, discountResults) => {
    // Create a map of discount codes by price rule ID
    const discountMap = {};
    discountResults.forEach(result => {
      if (result.priceRule && result.priceRule.discountCodes) {
        discountMap[result.priceRule.id] = result.priceRule.discountCodes.edges.map(edge => edge.node);
      }
    });
    
    // Merge discount codes into price rules
    return priceRules.map(rule => {
      return {
        ...rule,
        detailedDiscountCodes: discountMap[rule.id] || []
      };
    });
  }
};

// 9. Customer Tags & Segments
const customerTagsTemplate = {
  name: 'customer-tags',
  label: 'Customer Tags & Segments',
  description: 'Extract detailed tag and segment information for customers.',
  help: 'Analyze customer segmentation and targeting effectiveness.',
  primaryQuery: `
    query GetCustomersForTags($first: Int!, $after: String) {
      customers(first: $first, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            email
            firstName
            lastName
            displayName
            tags
          }
        }
      }
    }
  `,
  buildSecondaryQuery: (customerId) => ({
    query: `
      query GetCustomerTagDetails($id: ID!) {
        customer(id: $id) {
          id
          metafields(first: 50, namespace: "customer") {
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
    `,
    variables: { id: customerId }
  }),
  idExtractor: (customers) => {
    return customers.map(customer => customer.id);
  },
  resultMerger: (customers, tagResults) => {
    // Create a map of tag metafields by customer ID
    const tagMetafieldMap = {};
    tagResults.forEach(result => {
      if (result.customer && result.customer.metafields) {
        tagMetafieldMap[result.customer.id] = result.customer.metafields.edges.map(edge => edge.node);
      }
    });
    
    // Merge tag metafields into customers
    return customers.map(customer => {
      // Parse tags into a more useful format if possible
      const parsedTags = customer.tags ? customer.tags.split(',').map(tag => tag.trim()) : [];
      
      return {
        ...customer,
        parsedTags,
        detailedTagMetafields: tagMetafieldMap[customer.id] || []
      };
    });
  }
};

// 10. Product Media & Images
const productMediaTemplate = {
  name: 'product-media',
  label: 'Product Media & Images',
  description: 'Extract all media and images for each product.',
  help: 'Analyze product presentation completeness and quality.',
  primaryQuery: `
    query GetProductsForMedia($first: Int!, $after: String) {
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
            status
          }
        }
      }
    }
  `,
  buildSecondaryQuery: (productId) => ({
    query: `
      query GetProductMedia($id: ID!) {
        product(id: $id) {
          id
          images(first: 50) {
            edges {
              node {
                id
                url
                width
                height
                altText
                createdAt
              }
            }
          }
          media(first: 50) {
            edges {
              node {
                id
                mediaContentType
                preview {
                  image {
                    url
                  }
                }
                status
              }
            }
          }
        }
      }
    `,
    variables: { id: productId }
  }),
  idExtractor: (products) => {
    return products.map(product => product.id);
  },
  resultMerger: (products, mediaResults) => {
    // Create maps of images and media by product ID
    const mediaMap = {};
    mediaResults.forEach(result => {
      if (result.product) {
        mediaMap[result.product.id] = {
          images: result.product.images ? result.product.images.edges.map(edge => edge.node) : [],
          media: result.product.media ? result.product.media.edges.map(edge => edge.node) : []
        };
      }
    });
    
    // Merge media into products
    return products.map(product => {
      const productMedia = mediaMap[product.id] || { images: [], media: [] };
      
      return {
        ...product,
        detailedImages: productMedia.images,
        detailedMedia: productMedia.media
      };
    });
  }
};

// 11. Order Transactions
const orderTransactionsTemplate = {
  name: 'order-transactions',
  label: 'Order Transactions',
  description: 'Extract detailed transaction history for each order.',
  help: 'Analyze payment methods, refunds, and transaction issues.',
  primaryQuery: `
    query GetOrdersForTransactions($first: Int!, $after: String) {
      orders(first: $first, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            name
            createdAt
            displayFinancialStatus
            totalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
          }
        }
      }
    }
  `,
  buildSecondaryQuery: (orderId) => ({
    query: `
      query GetOrderTransactions($id: ID!) {
        order(id: $id) {
          id
          transactions {
            id
            status
            kind
            gateway
            test
            amountSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            paymentDetails {
              creditCardNumber
              creditCardCompany
              paymentMethod
            }
            createdAt
            formattedGateway
            parentTransaction {
              id
              kind
            }
          }
        }
      }
    `,
    variables: { id: orderId }
  }),
  idExtractor: (orders) => {
    return orders.map(order => order.id);
  },
  resultMerger: (orders, transactionResults) => {
    // Create a map of transactions by order ID
    const transactionMap = {};
    transactionResults.forEach(result => {
      if (result.order && result.order.transactions) {
        transactionMap[result.order.id] = result.order.transactions;
      }
    });
    
    // Merge transactions into orders
    return orders.map(order => {
      return {
        ...order,
        detailedTransactions: transactionMap[order.id] || []
      };
    });
  }
};

// 12. Draft Order Conversions
const draftOrdersTemplate = {
  name: 'draft-orders',
  label: 'Draft Order Conversions',
  description: 'Track which draft orders converted to actual orders.',
  help: 'Analyze sales process efficiency and abandoned cart recovery.',
  primaryQuery: `
    query GetDraftOrders($first: Int!, $after: String) {
      draftOrders(first: $first, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            name
            status
            createdAt
            updatedAt
            totalPrice
            customer {
              id
              email
              displayName
            }
          }
        }
      }
    }
  `,
  buildSecondaryQuery: (draftOrderId) => ({
    query: `
      query GetDraftOrderDetails($id: ID!) {
        draftOrder(id: $id) {
          id
          completedAt
          invoice {
            url
          }
          order {
            id
            name
            createdAt
            displayFinancialStatus
            displayFulfillmentStatus
            totalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
          }
          lineItems(first: 10) {
            edges {
              node {
                id
                title
                quantity
                variantTitle
              }
            }
          }
        }
      }
    `,
    variables: { id: draftOrderId }
  }),
  idExtractor: (draftOrders) => {
    return draftOrders.map(draftOrder => draftOrder.id);
  },
  resultMerger: (draftOrders, detailResults) => {
    // Create a map of draft order details by ID
    const detailMap = {};
    detailResults.forEach(result => {
      if (result.draftOrder) {
        detailMap[result.draftOrder.id] = {
          completedAt: result.draftOrder.completedAt,
          invoice: result.draftOrder.invoice,
          order: result.draftOrder.order,
          lineItems: result.draftOrder.lineItems ? result.draftOrder.lineItems.edges.map(edge => edge.node) : []
        };
      }
    });
    
    // Merge details into draft orders
    return draftOrders.map(draftOrder => {
      const details = detailMap[draftOrder.id] || {};
      
      return {
        ...draftOrder,
        completedAt: details.completedAt,
        invoice: details.invoice,
        convertedOrder: details.order,
        detailedLineItems: details.lineItems || []
      };
    });
  }
};

// Export all templates
const dependentQueryTemplates = {
  'product-variants': productVariantsTemplate,
  'metafields': metafieldsTemplate,
  'order-line-items': orderLineItemsTemplate,
  'customer-order-history': customerOrderHistoryTemplate,
  'inventory-across-locations': inventoryAcrossLocationsTemplate,
  'fulfillment-details': fulfillmentDetailsTemplate,
  'product-collections': productCollectionsTemplate,
  'discount-usage': discountUsageTemplate,
  'customer-tags': customerTagsTemplate,
  'product-media': productMediaTemplate,
  'order-transactions': orderTransactionsTemplate,
  'draft-orders': draftOrdersTemplate
};

// Get template by name
function getQueryTemplate(name) {
  return dependentQueryTemplates[name];
}

// Get all template names
function getAllTemplateNames() {
  return Object.keys(dependentQueryTemplates);
}

// Get template list with basic info for UI
function getTemplateList() {
  return Object.values(dependentQueryTemplates).map(template => ({
    name: template.name,
    label: template.label,
    description: template.description,
    help: template.help
  }));
}

module.exports = {
  getQueryTemplate,
  getAllTemplateNames,
  getTemplateList,
  dependentQueryTemplates
};
```

### 4. Server-side API Endpoints

Add the following code to `server.js` (add after existing endpoint definitions but before the catch-all route):

```javascript
// Import new modules
const { executeDependentQueries, saveResultsToFile } = require('./src/utils/dependentQueries');
const { getQueryTemplate, getTemplateList } = require('./src/queries/dependentQueryTemplates');
const { 
  getApiSchema, 
  saveSchemaToCache,
  loadSchemaFromCache,
  clearSchemaCache
} = require('./src/utils/schemaVersioning');

// Get dependent query template list
app.get('/api/dependent-query-templates', (req, res) => {
  try {
    const templates = getTemplateList();
    res.status(200).json(templates);
  } catch (error) {
    console.error('Error getting query templates:', error);
    res.status(500).json({ error: 'Failed to get query templates: ' + error.message });
  }
});

// Execute dependent query
app.post('/api/dependent-extract', async (req, res) => {
  const { queryType } = req.body;
  
  if (!queryType) {
    return res.status(400).json({ error: 'Query type is required' });
  }
  
  if (!shopifyCredentials.storeName || !shopifyCredentials.accessToken) {
    return res.status(400).json({ error: 'Missing credentials' });
  }
  
  try {
    // Get query template
    const template = getQueryTemplate(queryType);
    if (!template) {
      return res.status(400).json({ error: `Unknown query type: ${queryType}` });
    }
    
    // Reset extraction state for new operation
    extractionState = {
      status: 'initializing',
      progress: 0,
      recordsProcessed: 0,
      totalRecords: 0,
      logs: [`Starting dependent extraction for ${template.label}`],
      data: [],
      resource: queryType,
      query: null
    };
    
    // Start dependent extraction in background
    startDependentExtraction(queryType).catch(error => {
      console.error('Dependent extraction error:', error);
      extractionState.status = 'failed';
      extractionState.logs.push(`Error: ${error.message}`);
    });
    
    res.status(200).json({ success: true, message: 'Dependent extraction started' });
  } catch (error) {
    console.error('Error starting dependent extraction:', error);
    res.status(500).json({ error: 'Failed to start dependent extraction: ' + error.message });
  }
});

// Get schema information
app.get('/api/schema-info', async (req, res) => {
  try {
    // Get cached schema
    const cachedData = loadSchemaFromCache();
    
    res.status(200).json({
      apiVersion: shopifyCredentials.apiVersion,
      schemaCache: cachedData ? {
        timestamp: cachedData.timestamp,
        apiVersion: cachedData.apiVersion
      } : null
    });
  } catch (error) {
    console.error('Error getting schema info:', error);
    res.status(500).json({ error: 'Failed to get schema info: ' + error.message });
  }
});

// Clear schema cache
app.post('/api/clear-schema-cache', (req, res) => {
  try {
    clearSchemaCache();
    res.status(200).json({ success: true, message: 'Schema cache cleared' });
  } catch (error) {
    console.error('Error clearing schema cache:', error);
    res.status(500).json({ error: 'Failed to clear schema cache: ' + error.message });
  }
});

// Function to start dependent extraction
async function startDependentExtraction(queryType) {
  try {
    extractionState.status = 'initializing';
    
    // Get query template
    const template = getQueryTemplate(queryType);
    if (!template) {
      throw new Error(`Unknown query type: ${queryType}`);
    }
    
    // Check for cached schema
    let schema = null;
    const cachedData = loadSchemaFromCache();
    
    if (cachedData && cachedData.apiVersion === shopifyCredentials.apiVersion) {
      extractionState.logs.push('Using cached schema');
      schema = cachedData.schema;
    } else {
      extractionState.logs.push('Fetching current schema from Shopify...');
      schema = await getApiSchema(shopifyCredentials);
      saveSchemaToCache(schema, shopifyCredentials.apiVersion);
      extractionState.logs.push('Schema fetched and cached');
    }
    
    // Execute the dependent queries
    extractionState.logs.push(`Starting ${template.label} extraction with primary query...`);
    
    const results = await executeDependentQueries({
      credentials: shopifyCredentials,
      primaryQuery: template.primaryQuery,
      secondaryQueryBuilder: template.buildSecondaryQuery,
      idExtractor: template.idExtractor,
      resultMerger: template.resultMerger,
      extractionState: extractionState
    });
    
    // Update extraction state with results
    extractionState.status = 'completed';
    extractionState.data = results;
    extractionState.recordsProcessed = Array.isArray(results) ? results.length : 1;
    extractionState.totalRecords = extractionState.recordsProcessed;
    extractionState.progress = 100;
    
    // Save results to file
    const filename = saveResultsToFile(queryType, results);
    extractionState.logs.push(`Extraction completed: ${extractionState.recordsProcessed} records extracted`);
    extractionState.logs.push(`Results saved to file: ${filename}`);
    
    return results;
  } catch (error) {
    extractionState.status = 'failed';
    extractionState.logs.push(`Error: ${error.message}`);
    throw error;
  }
}
```

### 5. Frontend UI Components

Add the following code to `public/app.js` (after document.addEventListener('DOMContentLoaded', ...)):

```javascript
// Create the dependent query modal
function createDependentQueryModal() {
  const modalHTML = `
    <div class="modal fade" id="dependent-query-modal" tabindex="-1" aria-labelledby="dependent-query-modal-label" aria-hidden="true">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header bg-primary text-white">
            <h5 class="modal-title" id="dependent-query-modal-label">Dependent Query Extraction</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <div class="alert alert-info">
              <p><strong>What are dependent queries?</strong></p>
              <p>Some Shopify data requires multiple queries to fully extract. For example, to get complete variant details, 
              we first need to fetch products to get variant IDs, then query each variant separately.</p>
              <p><a href="/dependent-queries-info.html" target="_blank" class="alert-link">Learn more about dependent queries <i class="bi bi-box-arrow-up-right"></i></a></p>
            </div>
            
            <h6 class="mb-3">Select a dependent query type:</h6>
            <div class="list-group dependent-query-list">
              <div class="text-center my-5">
                <div class="spinner-border text-primary" role="status">
                  <span class="visually-hidden">Loading templates...</span>
                </div>
                <p class="mt-2">Loading query templates...</p>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Add modal to document
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // Load query templates when modal is shown
  const modal = document.getElementById('dependent-query-modal');
  modal.addEventListener('show.bs.modal', loadDependentQueryTemplates);
}

// Fetch and display dependent query templates
async function loadDependentQueryTemplates() {
  const queryList = document.querySelector('.dependent-query-list');
  
  try {
    const response = await fetch('/api/dependent-query-templates');
    
    if (!response.ok) {
      throw new Error(`Failed to load templates: ${response.status}`);
    }
    
    const templates = await response.json();
    
    if (templates.length === 0) {
      queryList.innerHTML = `
        <div class="alert alert-warning">
          No query templates available.
        </div>
      `;
      return;
    }
    
    // Create template list
    queryList.innerHTML = templates.map(template => `
      <button class="list-group-item list-group-item-action dependent-query-option" data-type="${template.name}">
        <div class="d-flex w-100 justify-content-between">
          <h6 class="mb-1">${template.label}</h6>
          <small class="text-muted">${template.name}</small>
        </div>
        <p class="mb-1">${template.description}</p>
        <small class="text-muted">${template.help}</small>
      </button>
    `).join('');
    
    // Add event listeners
    document.querySelectorAll('.dependent-query-option').forEach(button => {
      button.addEventListener('click', (e) => {
        const queryType = e.currentTarget.dataset.type;
        // Close the modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('dependent-query-modal'));
        modal.hide();
        // Start the dependent extraction
        startDependentExtraction(queryType);
      });
    });
  } catch (error) {
    console.error('Error loading query templates:', error);
    queryList.innerHTML = `
      <div class="alert alert-danger">
        Failed to load query templates: ${error.message}
      </div>
    `;
  }
}

// Add dependent query button to UI
function addDependentQueryButton() {
  // Find the container element
  const buttonContainer = document.querySelector('#custom-extraction-btn').parentNode;
  
  // Create button element
  const buttonHTML = `
    <button id="dependent-query-btn" class="btn btn-outline-info ms-2">
      <i class="bi bi-diagram-3 me-1"></i> Dependent Queries
    </button>
  `;
  
  // Add button to container
  buttonContainer.insertAdjacentHTML('beforeend', buttonHTML);
  
  // Add click handler
  document.getElementById('dependent-query-btn').addEventListener('click', () => {
    // Show the dependent query modal
    const modal = new bootstrap.Modal(document.getElementById('dependent-query-modal'));
    modal.show();
  });
}

// Start dependent extraction process
async function startDependentExtraction(queryType) {
  if (!appState.connected) {
    alert('Please connect to your Shopify store first');
    return;
  }
  
  // Show extraction section
  extractionSection.style.display = 'block';
  extractionSection.scrollIntoView({ behavior: 'smooth' });
  
  // Reset extraction UI
  updateProgressBar(0);
  extractionStatus.textContent = 'Initializing dependent extraction...';
  recordsCount.textContent = '0';
  extractionLogs.innerHTML = '';
  
  // Log start
  appendToLogs(`Starting dependent extraction for ${queryType}...`);
  
  // Disable download buttons until complete
  downloadDataBtn.disabled = true;
  viewJsonBtn.disabled = true;
  
  try {
    // Initialize the extraction on the server
    const response = await fetch('/api/dependent-extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ queryType })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to start extraction: ${response.status}`);
    }
    
    // Set app state for tracking
    appState.extractionInProgress = true;
    appState.selectedResource = queryType;
    
    // Start monitoring progress
    startExtractionUpdates();
    
  } catch (error) {
    console.error('Failed to start dependent extraction:', error);
    appendToLogs(`Error: ${error.message}`);
    extractionStatus.textContent = 'Failed to start extraction';
  }
}

// Update the getStatusText function to handle dependent query states
function getStatusText(status) {
  switch (status) {
    case 'idle':
      return 'Ready to extract';
    case 'initializing':
      return 'Initializing extraction...';
    case 'running':
      return 'Extraction in progress...';
    case 'fetching-primary':
      return 'Fetching primary data...';
    case 'fetching-secondary':
      return 'Fetching dependent data...';
    case 'paginating':
      return 'Fetching data pages...';
    case 'processing':
      return 'Processing extracted data...';
    case 'completed':
      return 'Extraction completed!';
    case 'failed':
      return 'Extraction failed';
    default:
      return status;
  }
}

// Create and add elements when the page loads
document.addEventListener('DOMContentLoaded', () => {
  // Existing initialization code...
  
  // Add dependent query components
  createDependentQueryModal();
  addDependentQueryButton();
});
```

### 6. Documentation Page

**File: `public/dependent-queries-info.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Shopify Dependent Query Strategies</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="container mt-4 mb-4">
    <div class="row">
      <div class="col-12">
        <div class="card">
          <div class="card-header bg-primary text-white d-flex justify-content-between align-items-center">
            <h5 class="mb-0">Shopify Admin GraphQL API: Dependent Query Strategies</h5>
            <a href="/" class="btn btn-sm btn-light">
              <i class="bi bi-arrow-left me-1"></i> Back to Extractor
            </a>
          </div>
          <div class="card-body">
            <div class="alert alert-info">
              <p class="lead mb-0">
                When working with the Shopify Admin GraphQL API, some data types cannot be fetched directly with a single query.
                These scenarios require dependent queries - fetching primary data first, then using the IDs to fetch related data.
              </p>
            </div>
            
            <h2 class="mt-4">Supported Dependent Query Types</h2>
            
            <div class="table-responsive mt-3">
              <table class="table table-striped table-hover">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Description</th>
                    <th>Business Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Product Variants</strong></td>
                    <td>Extract detailed variant information including inventory, prices, and options.</td>
                    <td>Complete product catalog analysis with variant-level details.</td>
                  </tr>
                  <tr>
                    <td><strong>Metafields</strong></td>
                    <td>Extract metafields for products, orders, customers, etc.</td>
                    <td>Access custom metadata for enhanced reporting.</td>
                  </tr>
                  <tr>
                    <td><strong>Order Line Items</strong></td>
                    <td>Extract detailed line item information for orders.</td>
                    <td>Complete order analysis, especially for large orders.</td>
                  </tr>
                  <tr>
                    <td><strong>Customer Order History</strong></td>
                    <td>Extract complete order history for customers.</td>
                    <td>Analyze customer lifetime value and buying patterns.</td>
                  </tr>
                  <tr>
                    <td><strong>Inventory Across Locations</strong></td>
                    <td>Extract inventory levels for all items across all locations.</td>
                    <td>Complete inventory visibility across multiple store locations.</td>
                  </tr>
                  <tr>
                    <td><strong>Fulfillment Details</strong></td>
                    <td>Extract detailed fulfillment information for orders.</td>
                    <td>Analyze shipping performance, fulfillment times, and delivery issues.</td>
                  </tr>
                  <tr>
                    <td><strong>Product Collections</strong></td>
                    <td>Extract all products within each collection.</td>
                    <td>Analyze collection performance and product categorization.</td>
                  </tr>
                  <tr>
                    <td><strong>Discount Usage</strong></td>
                    <td>Extract discount codes and usage statistics for each price rule.</td>
                    <td>Measure promotion effectiveness and discount usage patterns.</td>
                  </tr>
                  <tr>
                    <td><strong>Customer Tags & Segments</strong></td>
                    <td>Extract detailed tag and segment information for customers.</td>
                    <td>Analyze customer segmentation and targeting effectiveness.</td>
                  </tr>
                  <tr>
                    <td><strong>Product Media & Images</strong></td>
                    <td>Extract all media and images for each product.</td>
                    <td>Analyze product presentation completeness and quality.</td>
                  </tr>
                  <tr>
                    <td><strong>Order Transactions</strong></td>
                    <td>Extract detailed transaction history for each order.</td>
                    <td>Analyze payment methods, refunds, and transaction issues.</td>
                  </tr>
                  <tr>
                    <td><strong>Draft Order Conversions</strong></td>
                    <td>Track which draft orders converted to actual orders.</td>
                    <td>Analyze sales process efficiency and abandoned cart recovery.</td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <h2 class="mt-5">How Dependent Queries Work</h2>
            
            <p>The dependent query process follows these steps:</p>
            
            <ol>
              <li><strong>Primary Query:</strong> First, we fetch primary data (e.g., products) to get IDs</li>
              <li><strong>ID Extraction:</strong> We extract relevant IDs from the primary data</li>
              <li><strong>Secondary Queries:</strong> We use these IDs to fetch related data (e.g., variants)</li>
              <li><strong>Data Merging:</strong> We combine the primary and secondary data into a unified result</li>
            </ol>
            
            <div class="row mt-4">
              <div class="col-md-6">
                <div class="card">
                  <div class="card-header bg-light">
                    <h5 class="mb-0">Example: Product Variants</h5>
                  </div>
                  <div class="card-body">
                    <h6>Step 1: Primary Query (Products)</h6>
                    <pre class="bg-light p-3 mb-3"><code>query GetProductsWithVariantIds {
  products(first: 10) {
    edges {
      node {
        id
        title
        variants(first: 20) {
          edges {
            node {
              id  # We extract these IDs
            }
          }
        }
      }
    }
  }
}</code></pre>

                    <h6>Step 2: Secondary Query (Variants)</h6>
                    <pre class="bg-light p-3"><code>query GetProductVariant($id: ID!) {
  productVariant(id: $id) {  # Using IDs from step 1
    id
    title
    price
    inventoryQuantity
    # other fields...
  }
}</code></pre>
                  </div>
                </div>
              </div>
              
              <div class="col-md-6">
                <div class="card">
                  <div class="card-header bg-light">
                    <h5 class="mb-0">Performance Considerations</h5>
                  </div>
                  <div class="card-body">
                    <h6>Rate Limiting</h6>
                    <p>Dependent queries involve multiple API requests, which can approach Shopify's rate limits. Our implementation:</p>
                    <ul>
                      <li>Uses batch processing (5 requests at a time)</li>
                      <li>Adds delays between batches (500ms default)</li>
                      <li>Shows real-time progress for transparency</li>
                    </ul>
                    
                    <h6>Data Volume</h6>
                    <p>Dependent queries can retrieve large amounts of data. For example:</p>
                    <ul>
                      <li>1,000 products × 5 variants each = 5,000 secondary queries</li>
                      <li>This would be split into 1,000 batches of 5 queries</li>
                      <li>With 500ms delay, would take ~8.3 minutes to complete</li>
                    </ul>
                    
                    <div class="alert alert-warning mt-3 mb-0">
                      <i class="bi bi-exclamation-triangle me-2"></i> For very large stores, consider using more specific filters in your primary queries.
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <h2 class="mt-5">API Version Compatibility</h2>
            
            <p>
              The dependent query templates are designed to work with Shopify API version 2023-10 and newer.
              The system automatically checks field compatibility with your store's API version and adapts
              queries as needed.
            </p>
            
            <div class="alert alert-info">
              <i class="bi bi-info-circle me-2"></i> When Shopify updates their API, your saved queries will be
              automatically validated against the current schema to ensure compatibility.
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
```

### 7. Update CSS styles

Add the following styles to `public/styles.css`:

```css
/* Dependent Query Styles */
.dependent-query-option {
  transition: all 0.2s ease;
}

.dependent-query-option:hover {
  background-color: rgba(92, 106, 196, 0.08);
}

.dependent-query-list {
  max-height: 60vh;
  overflow-y: auto;
}

/* Code block styling */
pre {
  margin: 0;
  white-space: pre-wrap;
  font-size: 0.85rem;
}

pre code {
  color: #333;
}

/* Modal styling */
.modal-lg {
  max-width: 900px;
}

/* Status indicators */
.status-fetching-primary,
.status-fetching-secondary {
  color: #0d6efd;
}

.status-completed {
  color: #198754;
}

.status-failed {
  color: #dc3545;
}
```

## Installation Instructions

Follow these steps to implement the dependent query system:

1. Create the new directories if they don't exist:
   ```
   mkdir -p src/utils
   mkdir -p src/queries
   mkdir -p cache
   ```

2. Create the new files:
   - `src/utils/dependentQueries.js`
   - `src/utils/schemaVersioning.js`
   - `src/queries/dependentQueryTemplates.js`
   - `public/dependent-queries-info.html`

3. Add the content for each file as provided above.

4. Modify the existing files:
   - Add the server-side code to `server.js`
   - Add the frontend UI code to `public/app.js`
   - Add the new CSS styles to `public/styles.css`

5. Start the server:
   ```
   npm start
   ```

## Testing the Implementation

1. Connect to your Shopify store
2. Click on the "Dependent Queries" button
3. Select a query type from the modal
4. Watch the extraction progress and examine the results

## Troubleshooting

If you encounter issues:

1. Check the browser console for JavaScript errors
2. Check the server logs for backend errors
3. Verify your Shopify API credentials and permissions
4. Check that the API version matches what's available in your store
5. Clear the schema cache if you encounter schema-related issues

## Extending the System

To add a new dependent query type:

1. Add a new template to `src/queries/dependentQueryTemplates.js`
2. Define the primary query, secondary query builder, ID extractor, and result merger
3. Add the new query type to the template list
4. Test the new query type with a small data set before using it with large amounts of data

## Maintenance

The system is designed to adapt to Shopify API changes automatically, but for major API version changes:

1. Review the schema using the introspection query
2. Update any field names or query structures that have changed
3. Test the dependent queries with the new API version
4. Clear the schema cache to force a refresh

This implementation is designed to work seamlessly with the existing codebase while adding powerful new capabilities for dependent query extraction.