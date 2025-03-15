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
          const error = response.data.errors[0];
          const errorMessage = `GraphQL Error: ${error.message}`;
          
          // If it's a schema compatibility error, provide more helpful information
          if (error.message.includes("doesn't exist on type")) {
            if (extractionState) {
              extractionState.logs.push(`Schema Compatibility Warning: ${error.message}`);
              extractionState.logs.push(`This often occurs due to differences in API versions or shop-specific features.`);
              extractionState.logs.push(`Trying to continue with available fields...`);
            }
            
            // For these specific errors, we might want to still try to extract data
            // but for now, we'll fail gracefully
            throw new Error(`Schema compatibility issue: ${error.message}. This query may not be compatible with your shop's API version.`);
          } else {
            // For other errors, standard error handling
            if (extractionState) {
              extractionState.logs.push(`Error: ${errorMessage}`);
            }
            throw new Error(errorMessage);
          }
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
        hasNextPage = resource.pageInfo && resource.pageInfo.hasNextPage ? resource.pageInfo.hasNextPage : false;
        cursor = resource.pageInfo && resource.pageInfo.endCursor ? resource.pageInfo.endCursor : null;
        
        // Report progress for primary query (0-50% range)
        // Each page contributes up to 10% progress, capped at 50% for primary phase
        const primaryProgress = Math.min(50, Math.floor((pageCount * 10)));
        
        if (progressCallback) {
          progressCallback({
            stage: 'primary',
            progress: primaryProgress,
            message: `Fetched primary page ${pageCount} (${pageResults.length} items)`
          });
        }
        
        if (extractionState) {
          // Explicitly set numeric progress to ensure it's a number
          extractionState.progress = Number(primaryProgress);
          extractionState.recordsProcessed = primaryResults.length;
          extractionState.logs.push(`Retrieved ${pageResults.length} primary records (total: ${primaryResults.length}) - Progress: ${primaryProgress}%`);
          console.log(`Primary extraction progress: ${primaryProgress}% (page ${pageCount}, ${primaryResults.length} total records)`);
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
            
            // Still include partial data even if there are errors
            if (response.data.data) {
              secondaryResults.push(response.data.data);
            }
          } else {
            secondaryResults.push(response.data.data);
          }
        });
        
        // Report progress for secondary queries (50-100% range)
        // Calculate exact percentage from 50% to 100% based on batch progress
        const batchProgress = 50 + Math.floor(((i + 1) / batches.length) * 50);
        
        if (progressCallback) {
          progressCallback({
            stage: 'secondary',
            progress: batchProgress,
            message: `Processed batch ${i + 1}/${batches.length} (${batch.length} items)`
          });
        }
        
        if (extractionState) {
          // Explicitly set numeric progress to ensure it's a number
          extractionState.progress = Number(batchProgress);
          extractionState.logs.push(`Completed batch ${i + 1}/${batches.length} (${secondaryResults.length} secondary records retrieved) - Progress: ${batchProgress}%`);
          console.log(`Secondary extraction progress: ${batchProgress}% (batch ${i + 1}/${batches.length}, ${secondaryResults.length} total secondary records)`);
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