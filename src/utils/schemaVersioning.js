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