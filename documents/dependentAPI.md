# Shopify GraphQL Dependent Query Integration Plan

This document outlines the implementation plan for integrating dependent query strategies into the Shopify GraphQL Data Extractor application. Dependent queries are necessary in scenarios where the Shopify API doesn't support retrieving all desired data in a single query, requiring multiple sequential queries.

## Background

The Shopify Admin GraphQL API has limitations when fetching certain data types directly. In many cases, you must first fetch primary resources (e.g., products) and then use the IDs from those resources to fetch related data (e.g., detailed variant information) in subsequent queries.

## Implementation Goals

1. Create a system for handling dependent queries in the backend
2. Develop a user-friendly interface for executing dependent queries
3. Support common dependent query scenarios documented in the API reference
4. Provide clear documentation and feedback to users

## Tasks

### 1. Create Dependent Queries Utility Module

**File: `src/utils/dependentQueries.js`**

```javascript
const axios = require('axios');

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
    progressCallback
  } = options;

  // Configure endpoint
  const endpoint = `https://${credentials.storeName}.myshopify.com/admin/api/${credentials.apiVersion}/graphql.json`;
  
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
  
  // Execute paginated primary query
  while (hasNextPage) {
    pageCount++;
    
    try {
      // Update variables for pagination
      const variables = { ...primaryVariables, after: cursor };
      
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
        throw new Error(`GraphQL Error: ${response.data.errors[0].message}`);
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
      if (progressCallback) {
        progressCallback({
          stage: 'primary',
          progress: Math.min(50, Math.floor((pageCount * 10))),
          message: `Fetched primary page ${pageCount} (${pageResults.length} items)`
        });
      }
      
      // Add delay before next request
      if (hasNextPage) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error) {
      throw new Error(`Primary query failed on page ${pageCount}: ${error.message}`);
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
      
      // Execute batch in parallel
      const batchResponses = await Promise.all(batchPromises);
      
      // Process batch responses
      batchResponses.forEach(response => {
        if (response.data.errors) {
          console.warn(`Secondary query warning: ${response.data.errors[0].message}`);
        } else {
          secondaryResults.push(response.data.data);
        }
      });
      
      // Report progress (50-100%)
      if (progressCallback) {
        const batchProgress = 50 + Math.floor(((i + 1) / batches.length) * 50);
        progressCallback({
          stage: 'secondary',
          progress: batchProgress,
          message: `Processed batch ${i + 1}/${batches.length} (${batch.length} items)`
        });
      }
      
      // Add delay before next batch
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error) {
      throw new Error(`Secondary query batch ${i + 1} failed: ${error.message}`);
    }
  }
  
  // Step 3: Merge results using the provided merger function
  return resultMerger(primaryResults, secondaryResults);
}

module.exports = {
  executeDependentQueries
};
```

### 2. Add Dependent Query Templates

**File: `src/queries/dependentQueries.js`**

```javascript
/**
 * Templates for common Shopify dependent query scenarios
 */

// Product Variants Query Templates
const productVariantQueries = {
  // Primary query to fetch products and variant IDs
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
  
  // Function to build secondary query for a variant
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
  
  // Function to extract variant IDs from products
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
  
  // Function to merge products with variant details
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

// Metafields Query Templates
const metafieldQueries = {
  // Similar structure for metafields
  // ...
};

// Order Line Items Query Templates
const orderLineItemQueries = {
  // Similar structure for order line items
  // ...
};

module.exports = {
  productVariantQueries,
  metafieldQueries,
  orderLineItemQueries,
  // Export other query templates...
};
```

### 3. Add Backend API Endpoints

**File: `server.js` (new endpoints to add)**

```javascript
// Require the new module
const { executeDependentQueries } = require('./src/utils/dependentQueries');
const { 
  productVariantQueries, 
  metafieldQueries,
  orderLineItemQueries 
} = require('./src/queries/dependentQueries');

// Add new endpoint for dependent extractions
app.post('/api/dependent-extract', async (req, res) => {
  const { queryType } = req.body;
  
  if (!queryType) {
    return res.status(400).json({ error: 'Query type is required' });
  }
  
  if (!shopifyCredentials.storeName || !shopifyCredentials.accessToken) {
    return res.status(400).json({ error: 'Missing credentials' });
  }
  
  try {
    // Reset extraction state for new operation
    extractionState = {
      status: 'initializing',
      progress: 0,
      recordsProcessed: 0,
      totalRecords: 0,
      logs: [`Starting dependent extraction for ${queryType}`],
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

// Function to start dependent extraction based on type
async function startDependentExtraction(queryType) {
  try {
    extractionState.status = 'running';
    let queryConfig;
    
    // Select query configuration based on type
    switch (queryType) {
      case 'product-variants':
        queryConfig = productVariantQueries;
        break;
      case 'metafields':
        queryConfig = metafieldQueries;
        break;
      case 'order-line-items':
        queryConfig = orderLineItemQueries;
        break;
      default:
        throw new Error(`Unknown dependent query type: ${queryType}`);
    }
    
    // Set up progress callback
    const progressCallback = (progress) => {
      extractionState.progress = progress.progress;
      extractionState.logs.push(progress.message);
      
      if (progress.stage === 'primary') {
        extractionState.status = 'fetching-primary';
      } else if (progress.stage === 'secondary') {
        extractionState.status = 'fetching-secondary';
      }
    };
    
    // Execute the dependent queries
    const results = await executeDependentQueries({
      credentials: shopifyCredentials,
      primaryQuery: queryConfig.primaryQuery,
      secondaryQueryBuilder: queryConfig.buildSecondaryQuery,
      idExtractor: queryConfig.idExtractor,
      resultMerger: queryConfig.resultMerger,
      progressCallback
    });
    
    // Update extraction state with results
    extractionState.status = 'completed';
    extractionState.data = results;
    extractionState.recordsProcessed = results.length;
    extractionState.totalRecords = results.length;
    extractionState.progress = 100;
    extractionState.logs.push(`Dependent extraction completed: ${results.length} items`);
    
    // Save results to file
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir);
    }
    
    const filename = `${queryType}_${new Date().toISOString().split('T')[0]}.json`;
    fs.writeFileSync(
      path.join(dataDir, filename),
      JSON.stringify(results, null, 2)
    );
    
    extractionState.logs.push(`Results saved to file: ${filename}`);
    
    return results;
  } catch (error) {
    extractionState.status = 'failed';
    extractionState.logs.push(`Error: ${error.message}`);
    throw error;
  }
}
```

### 4. Update Frontend Interface

**File: `public/app.js` (new code to add)**

```javascript
// Add after document.addEventListener('DOMContentLoaded', ...)

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
            </div>
            
            <h6 class="mb-3">Select a dependent query type:</h6>
            <div class="list-group">
              <button class="list-group-item list-group-item-action dependent-query-option" data-type="product-variants">
                <div class="d-flex w-100 justify-content-between">
                  <h6 class="mb-1">Product Variants</h6>
                  <small class="text-muted">Detailed variant information</small>
                </div>
                <p class="mb-1">Extract detailed variant information including inventory, prices, and options.</p>
                <small>First fetches products, then queries each variant individually.</small>
              </button>
              
              <button class="list-group-item list-group-item-action dependent-query-option" data-type="metafields">
                <div class="d-flex w-100 justify-content-between">
                  <h6 class="mb-1">Metafields</h6>
                  <small class="text-muted">Custom metadata</small>
                </div>
                <p class="mb-1">Extract metafields for products, orders, customers, etc.</p>
                <small>First fetches resources, then queries metafields for each item.</small>
              </button>
              
              <button class="list-group-item list-group-item-action dependent-query-option" data-type="order-line-items">
                <div class="d-flex w-100 justify-content-between">
                  <h6 class="mb-1">Order Line Items</h6>
                  <small class="text-muted">Detailed order contents</small>
                </div>
                <p class="mb-1">Extract detailed line item information for orders.</p>
                <small>Useful for orders with many line items that exceed pagination limits.</small>
              </button>
              
              <!-- Add more dependent query options as needed -->
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
  
  // Add event listeners to dependent query options
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
}

// Add dependent query button to UI
function addDependentQueryButton() {
  // Create button element
  const buttonHTML = `
    <button id="dependent-query-btn" class="btn btn-outline-info ms-2">
      <i class="bi bi-diagram-3 me-1"></i> Dependent Queries
    </button>
  `;
  
  // Find container to add button
  const customExtractionBtn = document.getElementById('custom-extraction-btn');
  if (customExtractionBtn) {
    customExtractionBtn.insertAdjacentHTML('afterend', buttonHTML);
    
    // Add click handler
    document.getElementById('dependent-query-btn').addEventListener('click', () => {
      // Show the dependent query modal
      const modal = new bootstrap.Modal(document.getElementById('dependent-query-modal'));
      modal.show();
    });
  }
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

// Create and add elements when the page loads
document.addEventListener('DOMContentLoaded', () => {
  // Existing initialization code...
  
  // Add dependent query components
  createDependentQueryModal();
  addDependentQueryButton();
});

// Update the extraction status display for dependent queries
function updateDependentExtractionStatus(status) {
  // Update status based on extraction state
  let statusText;
  let statusClass;
  
  switch (status) {
    case 'fetching-primary':
      statusText = 'Fetching primary data...';
      statusClass = 'text-primary';
      break;
    case 'fetching-secondary':
      statusText = 'Fetching dependent data...';
      statusClass = 'text-info';
      break;
    case 'completed':
      statusText = 'Extraction completed!';
      statusClass = 'text-success';
      break;
    case 'failed':
      statusText = 'Extraction failed';
      statusClass = 'text-danger';
      break;
    default:
      statusText = 'Processing...';
      statusClass = 'text-warning';
  }
  
  // Update UI
  extractionStatus.textContent = statusText;
  extractionStatus.className = statusClass;
}

// Modify the startExtractionUpdates function to handle dependent queries
// Find this function in the existing code and update it to add:
// (Only showing the part to add)

// Inside the startExtractionUpdates function:
if (statusData.status === 'fetching-primary' || statusData.status === 'fetching-secondary') {
  // Handle dependent query states
  updateDependentExtractionStatus(statusData.status);
}
```

### 5. Create Documentation Page

**File: `public/dependent-queries-info.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Shopify Dependent Query Strategies</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="container mt-4 mb-4">
    <div class="row">
      <div class="col-12">
        <div class="card">
          <div class="card-header bg-primary text-white">
            <h5 class="mb-0">Shopify Admin GraphQL API: Dependent Query Strategies</h5>
          </div>
          <div class="card-body">
            <div class="alert alert-info">
              <p class="lead mb-0">
                When working with the Shopify Admin GraphQL API, some data types cannot be fetched directly with a single query.
                These scenarios require dependent queries - fetching primary data first, then using the IDs to fetch related data.
              </p>
            </div>
            
            <h2 class="mt-4">Common Dependent Query Scenarios</h2>
            
            <div class="mt-4">
              <h3>1. ProductVariant Details</h3>
              <div class="code-block bg-light p-3 mb-3">
                <pre class="mb-0"><code># First query: Fetch products and variant IDs
query GetProductsWithVariantIds {
  products(first: 10) {
    edges {
      node {
        id
        title
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

# Second query: Get details for a specific variant
query GetProductVariant($id: ID!) {
  productVariant(id: $id) {
    id
    title
    price
    inventoryQuantity
    # other fields...
  }
}</code></pre>
              </div>
              <p>
                You cannot directly query product variants without their IDs. You first need to fetch products and their variant IDs, 
                then query each variant individually for detailed information.
              </p>
            </div>
            
            <!-- Add more dependent query examples similar to the above format -->
            
            <h2 class="mt-5">General Best Practices</h2>
            
            <h3>Pagination Management</h3>
            <p>Shopify API generally limits queries to a maximum of 250 items per page. For large datasets, use cursor-based pagination:</p>
            <div class="code-block bg-light p-3 mb-3">
              <pre class="mb-0"><code>query GetProductsWithPagination($cursor: String) {
  products(first: 250, after: $cursor) {
    pageInfo {
      hasNextPage
      endCursor
    }
    edges {
      node {
        id
        title
        # other fields...
      }
    }
  }
}</code></pre>
            </div>
            
            <h3>ID Formats</h3>
            <p>Shopify uses Global ID format: <code>gid://shopify/{type}/{numeric_id}</code>. Always use this format for dependent queries.</p>
            
            <h3>Rate Limiting</h3>
            <p>To avoid hitting rate limits:</p>
            <ul>
              <li>Limit parallel requests (use batching)</li>
              <li>Add delays between requests</li>
              <li>Implement exponential backoff for retries</li>
            </ul>
            
            <h3>Data Merging Strategy</h3>
            <p>The general strategy for dependent queries:</p>
            <ol>
              <li>Fetch primary objects (Products, Orders, Customers) and their IDs</li>
              <li>Collect IDs in an array</li>
              <li>Use these IDs to fetch related objects (Variants, LineItems, Metafields) with separate queries</li>
              <li>Merge the data on the client side</li>
            </ol>
            
            <div class="alert alert-warning mt-4">
              <h4 class="alert-heading">Important Considerations</h4>
              <p>When using dependent queries, be aware of the following:</p>
              <ul class="mb-0">
                <li>Extraction time will be longer due to multiple API calls</li>
                <li>You may need to adjust batch sizes to balance speed and API limits</li>
                <li>Always check for rate limiting headers in API responses</li>
                <li>Consider extracting only necessary data to minimize API usage</li>
              </ul>
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

## Implementation Details

### Dependent Query Modal

The modal will display:
- Explanation of dependent queries and when they're needed
- List of supported dependent query types with descriptions
- Configuration options for specific query types (batch size, fields to include)
- Clear feedback on what data will be fetched

### Query Execution Flow

1. User selects a dependent query type
2. System executes primary query to get resource IDs
3. Frontend shows progress of primary query (0-50%)
4. System executes batched dependent queries
5. Frontend shows progress of dependent queries (50-100%)
6. Results are merged and presented to user
7. User can download or view the combined data

### Rate Limiting Considerations

- Implement configurable batch sizes (default: 5 requests per batch)
- Add delays between batches (default: 500ms)
- Use exponential backoff for retry logic on failures
- Display rate limiting information to users

## Testing Plan

1. Test each dependent query type individually
2. Test with small and large datasets
3. Test rate limiting behavior
4. Verify data merging logic
5. Test error handling and recovery

## Future Enhancements

- Allow custom dependent query configuration
- Support more complex multi-level dependent queries
- Add visualization for dependent data relationships
- Implement caching for frequently accessed data
- Add scheduling for large dependent query operations


## Conclusion

Implementing dependent query support will significantly enhance the capabilities of the Shopify GraphQL Data Extractor, allowing users to extract complete and interconnected data that would otherwise be inaccessible through single queries. This feature addresses a common pain point when working with the Shopify Admin API and provides a user-friendly solution.