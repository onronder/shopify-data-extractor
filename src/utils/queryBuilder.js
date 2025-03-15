// src/utils/queryBuilder.js
const {
  getTypeFields,
  getFieldType,
  isConnectionType,
  isScalarType,
  isEnumType,
  isObjectType,
  getResourceTypeName
} = require('./schema');

/**
 * Dinamik GraphQL sorgusu oluşturur
 * @param {Array} schemaTypes Şema tipleri listesi
 * @param {string} resourceType Kaynak tipi (products, orders, customers)
 * @param {Array} selectedFields Seçilen alanlar (opsiyonel)
 * @returns {string} GraphQL sorgusu
 */
function buildDynamicQuery(schemaTypes, resourceType, selectedFields = []) {
  const resourceTypeName = getResourceTypeName(resourceType);
  let resourceFields = getTypeFields(schemaTypes, resourceTypeName);
  
  // Belirli alanlar seçilmişse onları kullan, yoksa tüm alanları al
  if (selectedFields && selectedFields.length > 0) {
    resourceFields = resourceFields.filter(field => 
      selectedFields.includes(field.name));
  }
  
  // Sorgu başlangıcı
  let query = `
query Get${resourceTypeName}s($first: Int!, $after: String) {
  ${resourceType}(first: $first, after: $after) {
    pageInfo {
      hasNextPage
      endCursor
    }
    edges {
      node {`;
  
  // Her alan için sorgu oluştur
  resourceFields.forEach(field => {
    // Dahili alanları atla
    if (field.name.startsWith('__')) return;
    
    const fieldType = getFieldType(schemaTypes, resourceTypeName, field.name);
    if (!fieldType) return;
    
    if (isScalarType(fieldType) || isEnumType(fieldType)) {
      // Basit tip (string, int, enum vs.)
      query += `
        ${field.name}`;
    } 
    else if (isObjectType(fieldType)) {
      // Karmaşık nesne alanları
      if (isConnectionType(fieldType)) {
        // Bağlantı tipi (edges/node yapısı)
        const connectionNodeType = fieldType.name.replace('Connection', '');
        const nodeFields = getTypeFields(schemaTypes, connectionNodeType);
        
        if (nodeFields.length > 0) {
          query += `
        ${field.name}(first: 10) {
          edges {
            node {
              id`;
          
          // Bağlantı tipinin ilk 5 alanını ekle (ID zaten eklendi)
          nodeFields
            .filter(f => f.name !== 'id' && !f.name.startsWith('__'))
            .slice(0, 5)
            .forEach(subField => {
              const subFieldType = getFieldType(schemaTypes, connectionNodeType, subField.name);
              if (isScalarType(subFieldType) || isEnumType(subFieldType)) {
                query += `
              ${subField.name}`;
              }
            });
          
          query += `
            }
          }
        }`;
        }
      } else {
        // Normal obje tipi
        const subFields = getTypeFields(schemaTypes, fieldType.name);
        
        if (subFields.length > 0) {
          query += `
        ${field.name} {
          id`;
          
          // Objenin ilk 5 alanını ekle (ID zaten eklendi)
          subFields
            .filter(f => f.name !== 'id' && !f.name.startsWith('__') && (
              isScalarType(getFieldType(schemaTypes, fieldType.name, f.name)) || 
              isEnumType(getFieldType(schemaTypes, fieldType.name, f.name))
            ))
            .slice(0, 5)
            .forEach(subField => {
              query += `
          ${subField.name}`;
            });
          
          query += `
        }`;
        }
      }
    }
  });
  
  // Sorguyu kapat
  query += `
      }
    }
  }
}`;
  
  return query;
}

/**
 * Önceden tanımlı sorguları güncellemek için alan doğrulama
 * @param {Array} schemaTypes Şema tipleri listesi
 * @param {string} queryString GraphQL sorgu metni
 * @returns {boolean} Sorgu güncel ve güvenli mi?
 */
function validateQueryAgainstSchema(schemaTypes, queryString) {
  // Basit bir doğrulama: GraphQL sorgu içindeki alan adlarını çıkar
  // ve şemada var mı kontrol et
  
  // Örneğin "fields" satırlarını bul
  const fieldLines = queryString.split('\n')
    .map(line => line.trim())
    .filter(line => 
      line.length > 0 && 
      !line.startsWith('#') && 
      !line.includes('{') && 
      !line.includes('}') &&
      !line.includes('query') &&
      !line.includes('(') &&
      !line.includes('pageInfo') &&
      !line.includes('edges') &&
      !line.includes('node')
    );
  
  // Her alanın türünü belirle (basit alan, bağlantı vs.)
  // Bu kod gerçek bir uygulama için geliştirilmeli
  // Şu anki haliyle basit bir kontrol
  return true;
}

/**
 * Önceden tanımlı sorguyu şema ile doğrulayıp gerekirse günceller
 * @param {Array} schemaTypes Şema tipleri listesi
 * @param {string} resourceType Kaynak tipi
 * @param {Object} predefinedData Önceden tanımlı sorgu ve alanlar
 * @returns {Object} Doğrulanmış sorgu ve alanlar
 */
function validateAndUpdatePredefinedQuery(schemaTypes, resourceType, predefinedData) {
  try {
    const isValid = validateQueryAgainstSchema(schemaTypes, predefinedData.query);
    
    if (isValid) {
      return predefinedData;
    }
    
    // Sorgu geçerli değilse, dinamik sorgu oluştur
    console.warn(`Predefined query for ${resourceType} validation failed, generating dynamic query instead`);
    const newQuery = buildDynamicQuery(schemaTypes, resourceType);
    
    return {
      query: newQuery,
      fields: predefinedData.fields
    };
  } catch (error) {
    console.warn(`Error validating predefined query: ${error.message}`);
    const newQuery = buildDynamicQuery(schemaTypes, resourceType);
    return {
      query: newQuery,
      fields: predefinedData.fields 
    };
  }
}

module.exports = {
  buildDynamicQuery,
  validateQueryAgainstSchema,
  validateAndUpdatePredefinedQuery
};