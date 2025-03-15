// Test CSV conversion
const testData = [
  {
    id: "gid://shopify/Product/123456789",
    title: "Test Product",
    description: "This is a test product with a comma, and a quote \" in it",
    variants: [
      { id: "var1", price: "19.99" },
      { id: "var2", price: "29.99" }
    ],
    nested: {
      field1: "value1",
      field2: "value2"
    }
  },
  {
    id: "gid://shopify/Product/987654321",
    title: "Another Product",
    description: "Another description",
    variants: [
      { id: "var3", price: "39.99" }
    ],
    nested: {
      field1: "value3",
      field2: "value4"
    }
  }
];

// Helper function to flatten nested objects for CSV conversion
function flattenObject(obj, prefix = '') {
  return Object.keys(obj).reduce((acc, key) => {
    const pre = prefix.length ? `${prefix}.` : '';
    
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      Object.assign(acc, flattenObject(obj[key], `${pre}${key}`));
    } else if (Array.isArray(obj[key])) {
      // For arrays, join the values with a semicolon
      acc[`${pre}${key}`] = obj[key].map(item => {
        if (typeof item === 'object' && item !== null) {
          return JSON.stringify(item);
        }
        return item;
      }).join('; ');
    } else {
      acc[`${pre}${key}`] = obj[key];
    }
    
    return acc;
  }, {});
}

// Helper function to convert JSON to CSV
function convertToCSV(jsonData) {
  if (!jsonData || !jsonData.length) {
    return '';
  }
  
  // Get all possible headers from all objects
  const headers = new Set();
  jsonData.forEach(item => {
    Object.keys(flattenObject(item)).forEach(key => headers.add(key));
  });
  
  const headerRow = Array.from(headers).join(',');
  
  // Create rows
  const rows = jsonData.map(item => {
    const flatItem = flattenObject(item);
    return Array.from(headers)
      .map(header => {
        let value = flatItem[header] === undefined ? '' : flatItem[header];
        
        // Handle values that need quotes (strings with commas, quotes, or newlines)
        if (typeof value === 'string') {
          if (value.includes('"')) {
            value = value.replace(/"/g, '""');
          }
          if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            value = `"${value}"`;
          }
        }
        
        return value;
      })
      .join(',');
  });
  
  // Combine header and rows
  return [headerRow, ...rows].join('\n');
}

// Convert to CSV
const csv = convertToCSV(testData);
console.log(csv); 