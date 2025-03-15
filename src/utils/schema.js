// src/utils/schema.js
const axios = require('axios');
require('dotenv').config();

/**
 * Shopify GraphQL API şemasını çeker
 * @param {Object} credentials Shopify API kimlik bilgileri
 * @returns {Promise<Array>} Şema tipleri listesi
 */
async function fetchSchema(credentials) {
  // Kimlik bilgileri doğrudan verilmediyse çevre değişkenlerini kullan
  const storeName = credentials?.storeName || process.env.SHOPIFY_STORE_NAME;
  const accessToken = credentials?.accessToken || process.env.SHOPIFY_ACCESS_TOKEN;
  const apiVersion = credentials?.apiVersion || '2025-01';

  if (!storeName || !accessToken) {
    throw new Error('Missing Shopify API credentials');
  }

  const endpoint = `https://${storeName}.myshopify.com/admin/api/${apiVersion}/graphql.json`;

  const introspectionQuery = `
    query IntrospectionQuery {
      __schema {
        types {
          name
          kind
          description
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

  try {
    const response = await axios({
      url: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken
      },
      data: {
        query: introspectionQuery
      }
    });

    if (response.data.errors) {
      throw new Error(`Schema fetch failed: ${response.data.errors[0].message}`);
    }

    if (response.data && response.data.data && response.data.data.__schema) {
      return response.data.data.__schema.types;
    }
    throw new Error('Invalid schema response structure');
  } catch (error) {
    console.error('Error fetching schema:', error.message);
    throw error;
  }
}

/**
 * Belirli bir tip için geçerli alanları getirir
 * @param {Array} schemaTypes Şema tipleri listesi
 * @param {string} typeName Tip adı
 * @returns {Array} Geçerli alanların listesi
 */
function getTypeFields(schemaTypes, typeName) {
  const type = schemaTypes.find(t => t.name === typeName);
  if (!type || !type.fields) return [];
  return type.fields.filter(field => !field.name.startsWith('__'));
}

/**
 * Bir alanın tipini getirir
 * @param {Array} schemaTypes Şema tipleri listesi
 * @param {string} typeName Tip adı
 * @param {string} fieldName Alan adı
 * @returns {Object|null} Alan tipi bilgisi
 */
function getFieldType(schemaTypes, typeName, fieldName) {
  const type = schemaTypes.find(t => t.name === typeName);
  if (!type || !type.fields) return null;
  
  const field = type.fields.find(f => f.name === fieldName);
  if (!field) return null;
  
  // Non-null veya List içerisinde olabilir, gerçek tipi al
  let fieldType = field.type;
  while (fieldType.kind === 'NON_NULL' || fieldType.kind === 'LIST') {
    if (!fieldType.ofType) return null;
    fieldType = fieldType.ofType;
  }
  
  return fieldType;
}

/**
 * Bir tipin bağlantı (connection) tipi olup olmadığını kontrol eder
 * @param {Object} fieldType Alan tipi
 * @returns {boolean} Bağlantı tipi mi
 */
function isConnectionType(fieldType) {
  return fieldType && fieldType.name && fieldType.name.endsWith('Connection');
}

/**
 * Bir tipin skalar tip olup olmadığını kontrol eder
 * @param {Object} fieldType Alan tipi
 * @returns {boolean} Skalar tip mi
 */
function isScalarType(fieldType) {
  return fieldType && fieldType.kind === 'SCALAR';
}

/**
 * Bir tipin enum tip olup olmadığını kontrol eder
 * @param {Object} fieldType Alan tipi
 * @returns {boolean} Enum tip mi
 */
function isEnumType(fieldType) {
  return fieldType && fieldType.kind === 'ENUM';
}

/**
 * Bir tipin obje tip olup olmadığını kontrol eder
 * @param {Object} fieldType Alan tipi
 * @returns {boolean} Obje tip mi
 */
function isObjectType(fieldType) {
  return fieldType && fieldType.kind === 'OBJECT';
}

/**
 * Bir kaynağın API'deki tip adını belirler
 * @param {string} resourceName Kaynak adı (çoğul)
 * @returns {string} Tip adı (tekil)
 */
function getResourceTypeName(resourceName) {
  // Özel durumları ele al
  const specialCases = {
    'products': 'Product',
    'orders': 'Order', 
    'customers': 'Customer',
    'collections': 'Collection',
    'metafields': 'Metafield',
    'inventory': 'InventoryItem'
  };
  
  if (specialCases[resourceName]) {
    return specialCases[resourceName];
  }
  
  // Temel çoğul-tekil dönüşümü
  if (resourceName.endsWith('s')) {
    return resourceName.charAt(0).toUpperCase() + resourceName.slice(1, -1);
  }
  
  return resourceName.charAt(0).toUpperCase() + resourceName.slice(1);
}

/**
 * Verilen alan adının sorgu içinde bulunması güvenli mi kontrol eder
 * @param {Array} schemaTypes Şema tipleri listesi
 * @param {string} typeName Tip adı
 * @param {string} fieldName Alan adı
 * @returns {boolean} Alan güvenli mi
 */
function isFieldSafe(schemaTypes, typeName, fieldName) {
  const fields = getTypeFields(schemaTypes, typeName).map(field => field.name);
  return fields.includes(fieldName);
}

/**
 * Bir özellikteki alan türünün tam adını döndürür (List ve NonNull dahil)
 * @param {Object} fieldType Alan tipi
 * @returns {string} Alan tipinin adı
 */
function getFullTypeName(fieldType) {
  if (!fieldType) return 'Unknown';
  
  if (fieldType.kind === 'NON_NULL') {
    return `${getFullTypeName(fieldType.ofType)}!`;
  }
  
  if (fieldType.kind === 'LIST') {
    return `[${getFullTypeName(fieldType.ofType)}]`;
  }
  
  return fieldType.name || 'Unknown';
}

module.exports = {
  fetchSchema,
  getTypeFields,
  getFieldType,
  isConnectionType,
  isScalarType,
  isEnumType,
  isObjectType,
  getResourceTypeName,
  isFieldSafe,
  getFullTypeName
};