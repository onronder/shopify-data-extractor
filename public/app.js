/**
 * Shopify GraphQL Data Extractor - Frontend Application
 */

// State management
const appState = {
  connected: false,
  credentials: {
    storeName: '',
    clientId: '',
    accessToken: ''
  },
  schema: null,
  selectedResource: null,
  selectedFields: [],
  extractionData: null,
  extractionInProgress: false
};

// DOM Elements
document.addEventListener('DOMContentLoaded', () => {
  // Connection Form
  const connectionForm = document.getElementById('connection-form');
  const storeNameInput = document.getElementById('store-name');
  const clientIdInput = document.getElementById('client-id');
  const accessTokenInput = document.getElementById('access-token');
  const apiVersionSelect = document.getElementById('api-version');
  const alwaysLatestCheckbox = document.getElementById('always-latest');
  const connectBtn = document.getElementById('connect-btn');
  const connectionStatus = document.getElementById('connection-status');
  
  // API version handling
  alwaysLatestCheckbox.addEventListener('change', () => {
    apiVersionSelect.disabled = alwaysLatestCheckbox.checked;
    if (alwaysLatestCheckbox.checked) {
      apiVersionSelect.value = '2025-01'; // Set to latest
    }
  });
  
  // Initial state
  apiVersionSelect.disabled = alwaysLatestCheckbox.checked;
  
  // Predefined Queries Section
  const predefinedQueriesSection = document.getElementById('predefined-queries-section');
  const predefinedExtractBtns = document.querySelectorAll('.predefined-extract-btn');
  const customExtractionBtn = document.getElementById('custom-extraction-btn');
  
  // API Selection
  const apiSelectionSection = document.getElementById('api-selection-section');
  const backToPredefinedBtn = document.getElementById('back-to-predefined-btn');
  const fetchSchemaBtn = document.getElementById('fetch-schema-btn');
  const apiListContainer = document.getElementById('api-list-container');
  const apiListBody = document.getElementById('api-list-body');
  const schemaLoading = document.getElementById('schema-loading');
  
  // Field Selection
  const fieldSelectionSection = document.getElementById('field-selection-section');
  const selectedResourceName = document.getElementById('selected-resource-name');
  const backToApisBtn = document.getElementById('back-to-apis-btn');
  const fieldsContainer = document.getElementById('fields-container');
  const fieldsLoading = document.getElementById('fields-loading');
  const fieldsListBody = document.getElementById('fields-list-body');
  const selectAllFields = document.getElementById('select-all-fields');
  const extractDataBtn = document.getElementById('extract-data-btn');
  
  // Field Filters
  const fieldSearchInput = document.getElementById('field-search');
  const clearSearchBtn = document.getElementById('clear-search');
  const categoryFilterList = document.getElementById('category-filter-list');
  const typeFilterCheckboxes = document.querySelectorAll('.filter-type');
  
  // Extraction Section
  const extractionSection = document.getElementById('extraction-section');
  const extractionProgressBar = document.getElementById('extraction-progress-bar');
  const extractionStatus = document.getElementById('extraction-status');
  const recordsCount = document.getElementById('records-count');
  const extractionLogs = document.getElementById('extraction-logs');
  const downloadDataBtn = document.getElementById('download-data-btn');
  
  // Hidden Fields
  const currentQueryInput = document.getElementById('current-query');
  const currentResourceInput = document.getElementById('current-resource');
  
  // Event Listeners
  connectionForm.addEventListener('submit', handleConnect);
  fetchSchemaBtn.addEventListener('click', fetchAvailableApis);
  backToApisBtn.addEventListener('click', showApiSelectionSection);
  backToPredefinedBtn.addEventListener('click', showPredefinedQueriesSection);
  selectAllFields.addEventListener('change', toggleSelectAllFields);
  extractDataBtn.addEventListener('click', startExtraction);
  downloadDataBtn.addEventListener('click', downloadExtractedData);
  
  // Custom extraction button
  customExtractionBtn.addEventListener('click', () => {
    predefinedQueriesSection.style.display = 'none';
    apiSelectionSection.style.display = 'block';
    fetchAvailableApis(); // Auto-fetch schema
  });
  
  // Predefined extraction buttons
  predefinedExtractBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const dataType = e.target.closest('button').dataset.type;
      startPredefinedExtraction(dataType);
    });
  });
  
  // Field filter event listeners
  fieldSearchInput.addEventListener('input', applyFilters);
  clearSearchBtn.addEventListener('click', () => {
    fieldSearchInput.value = '';
    applyFilters();
  });
  
  // Type filter checkboxes
  typeFilterCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', applyFilters);
  });
  
  // Try to load saved credentials
  loadCredentials();
  
  // Connection Form Handler
  async function handleConnect(event) {
    event.preventDefault();
    
    const storeName = storeNameInput.value.trim();
    const clientId = clientIdInput.value.trim();
    const accessToken = accessTokenInput.value.trim();
    
    // Get API version - either selected or latest
    const apiVersion = alwaysLatestCheckbox.checked ? '2025-01' : apiVersionSelect.value;
    
    if (!storeName || !clientId || !accessToken) {
      alert('Please fill in all required fields');
      return;
    }
    
    // Update connection button state
    connectBtn.disabled = true;
    connectBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Connecting...';
    
    try {
      // Show selected API version
      console.log(`Using Shopify Admin API version: ${apiVersion}`);
      
      // Save credentials to server
      const response = await fetch('/api/credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ storeName, clientId, accessToken, apiVersion })
      });
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      // Test connection
      const testResponse = await fetch('/api/test-connection');
      const testResult = await testResponse.json();
      
      if (!testResult.success) {
        throw new Error(testResult.message || 'Connection test failed');
      }
      
      // Update state
      appState.connected = true;
      appState.credentials = { storeName, clientId, accessToken, apiVersion };
      
      // Update UI
      connectionStatus.className = 'badge bg-success';
      connectionStatus.textContent = 'Connected';
      connectBtn.innerHTML = `<i class="bi bi-check-circle-fill me-1"></i> Connected (API v${apiVersion})`;
      connectBtn.classList.remove('btn-primary');
      connectBtn.classList.add('btn-success');
      
      // Keep the input values in the form
      storeNameInput.value = storeName;
      clientIdInput.value = clientId;
      accessTokenInput.value = accessToken;
      
      // Show predefined queries section
      predefinedQueriesSection.style.display = 'block';
      
      // Save credentials to localStorage
      saveCredentials({ storeName, clientId, accessToken, apiVersion });
      
    } catch (error) {
      console.error('Connection error:', error);
      alert(`Failed to connect: ${error.message}`);
      
      // Reset button but keep the input values
      connectBtn.disabled = false;
      connectBtn.innerHTML = '<i class="bi bi-plug-fill me-1"></i> Connect to Shopify';
    }
  }
  
  // Save credentials to localStorage
  function saveCredentials(credentials) {
    try {
      localStorage.setItem('shopifyCredentials', JSON.stringify(credentials));
      console.log('Credentials saved to localStorage');
    } catch (error) {
      console.error('Error saving credentials to localStorage:', error);
    }
  }
  
  // Load credentials from localStorage
  function loadCredentials() {
    try {
      const savedCredentials = localStorage.getItem('shopifyCredentials');
      
      if (savedCredentials) {
        const credentials = JSON.parse(savedCredentials);
        
        // Fill the form with saved credentials
        storeNameInput.value = credentials.storeName || '';
        clientIdInput.value = credentials.clientId || '';
        accessTokenInput.value = credentials.accessToken || '';
        
        if (credentials.apiVersion) {
          // Set API version if available
          if (apiVersionSelect.querySelector(`option[value="${credentials.apiVersion}"]`)) {
            apiVersionSelect.value = credentials.apiVersion;
          }
        }
        
        console.log('Credentials loaded from localStorage');
      }
    } catch (error) {
      console.error('Error loading credentials from localStorage:', error);
    }
  }
  
  // Fetch Available APIs from GraphQL Schema
  async function fetchAvailableApis() {
    if (!appState.connected) {
      alert('Please connect to your Shopify store first');
      return;
    }
    
    // Show loading state
    schemaLoading.style.display = 'block';
    apiListContainer.style.display = 'none';
    fetchSchemaBtn.disabled = true;
    
    try {
      const response = await fetch('/api/schema');
      if (!response.ok) {
        throw new Error(`Failed to fetch schema: ${response.status}`);
      }
      
      const schemaData = await response.json();
      appState.schema = schemaData;
      
      // Populate API list
      populateApiList(schemaData);
      
      // Hide loading, show table
      schemaLoading.style.display = 'none';
      apiListContainer.style.display = 'block';
      fetchSchemaBtn.disabled = false;
      
    } catch (error) {
      console.error('Error fetching schema:', error);
      alert(`Failed to fetch API schema: ${error.message}`);
      
      schemaLoading.style.display = 'none';
      fetchSchemaBtn.disabled = false;
    }
  }
  
  // Populate API List Table
  function populateApiList(schema) {
    // Clear existing entries
    apiListBody.innerHTML = '';
    
    // Get queryable types (those available in the Query type)
    const queryType = schema.find(type => type.name === 'QueryRoot');
    
    if (!queryType || !queryType.fields) {
      apiListBody.innerHTML = '<tr><td colspan="4" class="text-center">No API resources found</td></tr>';
      return;
    }
    
    // Sort fields alphabetically
    const sortedFields = [...queryType.fields].sort((a, b) => a.name.localeCompare(b.name));
    
    // Filter out internal fields and mutations
    const queryableFields = sortedFields.filter(field => {
      // Skip internal fields that start with double underscore
      if (field.name.startsWith('__')) return false;
      
      // Skip non-object and non-connection types
      const typeName = field.type.name || (field.type.ofType ? field.type.ofType.name : null);
      if (!typeName) return false;
      
      // Only include connections or objects
      return true;
    });
    
    // Create table rows
    queryableFields.forEach(field => {
      const row = document.createElement('tr');
      row.className = 'resource-row';
      row.dataset.resource = field.name;
      
      // Determine type information
      let typeDisplay = getTypeDisplay(field.type);
      let typeClass = getTypeClass(field.type);
      
      // Build row content
      row.innerHTML = `
        <td>${field.name}</td>
        <td><span class="badge ${typeClass}">${typeDisplay}</span></td>
        <td>${field.description || 'No description available'}</td>
        <td>
          <button class="btn btn-sm btn-outline-primary select-resource-btn" data-resource="${field.name}">
            Select
          </button>
        </td>
      `;
      
      // Add to table
      apiListBody.appendChild(row);
    });
    
    // Add click handlers for select buttons
    document.querySelectorAll('.select-resource-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const resourceName = e.target.dataset.resource;
        selectResource(resourceName);
      });
    });
    
    // Also make the entire row clickable
    document.querySelectorAll('.resource-row').forEach(row => {
      row.addEventListener('click', (e) => {
        // Don't trigger if the button was clicked
        if (e.target.closest('.select-resource-btn')) return;
        
        const resourceName = row.dataset.resource;
        selectResource(resourceName);
      });
    });
  }
  
  // Handle resource selection
  function selectResource(resourceName) {
    if (!resourceName) return;
    
    // Set the selected resource
    appState.selectedResource = resourceName;
    currentResourceInput.value = resourceName;
    
    // Update UI
    selectedResourceName.textContent = resourceName;
    
    // Show field selection section and fetch fields
    showFieldSelectionSection();
    fetchResourceFields(resourceName);
  }
  
  // Fetch fields for a selected resource
  async function fetchResourceFields(resourceName) {
    // Show loading
    fieldsLoading.style.display = 'block';
    fieldsContainer.style.display = 'none';
    
    try {
      const response = await fetch(`/api/resource-fields?resource=${encodeURIComponent(resourceName)}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch fields: ${response.status}`);
      }
      
      const fieldsData = await response.json();
      
      // Populate fields table
      populateFieldsTable(fieldsData);
      
      // Hide loading, show container
      fieldsLoading.style.display = 'none';
      fieldsContainer.style.display = 'block';
      
    } catch (error) {
      console.error('Error fetching fields:', error);
      alert(`Failed to fetch fields: ${error.message}`);
      
      fieldsLoading.style.display = 'none';
    }
  }
  
  // Populate fields selection table
  function populateFieldsTable(fieldsData) {
    // Clear existing entries
    fieldsListBody.innerHTML = '';
    
    if (!fieldsData || !fieldsData.fields || fieldsData.fields.length === 0) {
      fieldsListBody.innerHTML = '<tr><td colspan="5" class="text-center">No fields available</td></tr>';
      return;
    }
    
    // Sort fields alphabetically
    const sortedFields = [...fieldsData.fields].sort((a, b) => a.name.localeCompare(b.name));
    
    // Add fields categorization
    const categorizedFields = categorizeFields(sortedFields);
    
    // Add grouped fields to categories panel
    populateCategoriesPanel(categorizedFields);
    
    // Add categories to filter sidebar
    populateCategoryFilters(Object.keys(categorizedFields).sort());
    
    // Create table rows
    sortedFields.forEach(field => {
      const row = document.createElement('tr');
      row.className = 'field-row';
      row.dataset.fieldName = field.name;
      
      // Determine type information
      let typeDisplay = getTypeDisplay(field.type);
      let typeClass = getTypeClass(field.type);
      
      // Check if it's a basic field or a connection/object
      const isScalar = isScalarType(field.type);
      
      // Determine the category
      const category = determineFieldCategory(field);
      
      row.innerHTML = `
        <td>
          <div class="form-check">
            <input class="form-check-input field-checkbox" type="checkbox" value="${field.name}" 
                   id="field-${field.name}" data-field-name="${field.name}" data-is-scalar="${isScalar}"
                   data-category="${category}">
          </div>
        </td>
        <td>${field.name}</td>
        <td><span class="category-badge">${category}</span></td>
        <td><span class="badge ${typeClass}">${typeDisplay}</span></td>
        <td>${field.description || 'No description available'}</td>
      `;
      
      fieldsListBody.appendChild(row);
    });
    
    // Update select all checkbox state
    updateSelectAllState();
    
    // Add event listeners for checkboxes
    document.querySelectorAll('.field-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        updateSelectAllState();
      });
    });
    
    // Add event listener for group by category toggle
    const groupByCategoryCheckbox = document.getElementById('group-by-category');
    const fieldCategoriesPanel = document.getElementById('field-categories-panel');
    const fieldsTable = document.getElementById('fields-table').closest('.table-responsive');
    
    groupByCategoryCheckbox.addEventListener('change', () => {
      if (groupByCategoryCheckbox.checked) {
        // Show categories panel, hide table
        fieldCategoriesPanel.style.display = 'block';
        fieldsTable.style.display = 'none';
      } else {
        // Show table, hide categories panel
        fieldCategoriesPanel.style.display = 'none';
        fieldsTable.style.display = 'block';
      }
    });
  }
  
  // Categorize fields based on their name and type
  function categorizeFields(fields) {
    const categories = {};
    
    fields.forEach(field => {
      const category = determineFieldCategory(field);
      
      if (!categories[category]) {
        categories[category] = [];
      }
      
      categories[category].push(field);
    });
    
    return categories;
  }
  
  // Determine the category for a field
  function determineFieldCategory(field) {
    // Analyze field name and type to determine its category
    const name = field.name.toLowerCase();
    const baseType = getBaseType(field.type);
    const typeName = baseType.name || '';
    
    // Check for known object types
    if (typeName.includes('Connection')) {
      return 'Connections';
    }
    
    // Check common field patterns
    if (name.includes('metafield')) {
      return 'Metafields';
    }
    
    if (name.includes('image') || name.includes('media') || name.includes('thumbnail')) {
      return 'Media';
    }
    
    if (name.includes('price') || name.includes('cost') || name.includes('amount') || 
        name.includes('tax') || name.includes('discount') || name.includes('currency')) {
      return 'Pricing';
    }
    
    if (name.includes('inventory') || name.includes('stock') || name.includes('quantity')) {
      return 'Inventory';
    }
    
    if (name.includes('shipping') || name.includes('fulfillment') || name.includes('delivery')) {
      return 'Fulfillment';
    }
    
    if (name.includes('variant') || typeName.includes('Variant')) {
      return 'Variants';
    }
    
    if (name.includes('customer') || name.includes('client') || name.includes('buyer') || 
        typeName.includes('Customer')) {
      return 'Customers';
    }
    
    if (name.includes('order') || typeName.includes('Order')) {
      return 'Orders';
    }
    
    if (name.includes('product') || typeName.includes('Product')) {
      return 'Products';
    }
    
    if (name.includes('collection') || typeName.includes('Collection')) {
      return 'Collections';
    }
    
    if (name.includes('address') || name.includes('location') || name.includes('country') || 
        name.includes('city') || name.includes('postal') || name.includes('zip')) {
      return 'Addresses';
    }
    
    if (name.includes('email') || name.includes('phone') || name.includes('contact')) {
      return 'Contact';
    }
    
    if (name.includes('date') || name.includes('time') || name.includes('created') || 
        name.includes('updated') || name.includes('published')) {
      return 'Timestamps';
    }
    
    if (name.includes('id') || name.includes('handle') || name.includes('slug') || name === 'id') {
      return 'Identifiers';
    }
    
    if (name.includes('name') || name.includes('title') || name.includes('description') || 
        name.includes('summary') || name.includes('content') || name.includes('tag')) {
      return 'Content';
    }
    
    if (name.includes('status') || name.includes('state') || name.includes('active') || 
        name.includes('published') || name.includes('visibility')) {
      return 'Status';
    }
    
    // Default category for anything not matched
    return 'Other';
  }
  
  // Populate the categorized fields panel
  function populateCategoriesPanel(categorizedFields) {
    const accordionContainer = document.getElementById('categories-accordion');
    accordionContainer.innerHTML = '';
    
    // Sort categories alphabetically
    const sortedCategories = Object.keys(categorizedFields).sort();
    
    sortedCategories.forEach((category, index) => {
      const fields = categorizedFields[category];
      const categoryId = `category-${category.replace(/\s+/g, '-').toLowerCase()}`;
      const accordionItem = document.createElement('div');
      accordionItem.className = 'accordion-item';
      
      // Create category header
      const header = `
        <h2 class="accordion-header" id="heading-${categoryId}">
          <button class="accordion-button ${index === 0 ? '' : 'collapsed'}" type="button" 
                  data-bs-toggle="collapse" data-bs-target="#collapse-${categoryId}" 
                  aria-expanded="${index === 0 ? 'true' : 'false'}" aria-controls="collapse-${categoryId}">
            ${category} <span class="category-counter">(${fields.length})</span>
          </button>
        </h2>
      `;
      
      // Create category body with fields
      let fieldsHtml = '';
      fields.forEach(field => {
        const typeDisplay = getTypeDisplay(field.type);
        const typeClass = getTypeClass(field.type);
        const isScalar = isScalarType(field.type);
        
        fieldsHtml += `
          <div class="field-row-grouped">
            <div class="form-check">
              <input class="form-check-input field-checkbox-categorized" type="checkbox" 
                     value="${field.name}" id="field-cat-${field.name}" 
                     data-field-name="${field.name}" data-is-scalar="${isScalar}"
                     data-category="${category}">
              <label class="form-check-label" for="field-cat-${field.name}">
                <strong>${field.name}</strong>
                <span class="ms-2 badge ${typeClass}">${typeDisplay}</span>
                <div class="small text-muted">${field.description || 'No description available'}</div>
              </label>
            </div>
          </div>
        `;
      });
      
      const body = `
        <div id="collapse-${categoryId}" class="accordion-collapse collapse ${index === 0 ? 'show' : ''}" 
             aria-labelledby="heading-${categoryId}" data-bs-parent="#categories-accordion">
          <div class="accordion-body">
            <div class="mb-2">
              <button class="btn btn-sm btn-outline-primary select-all-in-category" 
                      data-category="${category}">Select All</button>
              <button class="btn btn-sm btn-outline-secondary clear-all-in-category ms-2" 
                      data-category="${category}">Clear All</button>
            </div>
            ${fieldsHtml}
          </div>
        </div>
      `;
      
      accordionItem.innerHTML = header + body;
      accordionContainer.appendChild(accordionItem);
    });
    
    // Add event listeners for categorized checkboxes
    document.querySelectorAll('.field-checkbox-categorized').forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        // Sync with the main table checkbox
        const fieldName = checkbox.dataset.fieldName;
        const mainCheckbox = document.querySelector(`.field-checkbox[data-field-name="${fieldName}"]`);
        if (mainCheckbox) {
          mainCheckbox.checked = checkbox.checked;
        }
        updateSelectAllState();
      });
    });
    
    // Add event listeners for Select All / Clear All in category buttons
    document.querySelectorAll('.select-all-in-category').forEach(button => {
      button.addEventListener('click', () => {
        const category = button.dataset.category;
        document.querySelectorAll(`.field-checkbox-categorized[data-category="${category}"]`).forEach(checkbox => {
          checkbox.checked = true;
          // Also update the corresponding checkbox in the main table
          const fieldName = checkbox.dataset.fieldName;
          const mainCheckbox = document.querySelector(`.field-checkbox[data-field-name="${fieldName}"]`);
          if (mainCheckbox) {
            mainCheckbox.checked = true;
          }
        });
        updateSelectAllState();
      });
    });
    
    document.querySelectorAll('.clear-all-in-category').forEach(button => {
      button.addEventListener('click', () => {
        const category = button.dataset.category;
        document.querySelectorAll(`.field-checkbox-categorized[data-category="${category}"]`).forEach(checkbox => {
          checkbox.checked = false;
          // Also update the corresponding checkbox in the main table
          const fieldName = checkbox.dataset.fieldName;
          const mainCheckbox = document.querySelector(`.field-checkbox[data-field-name="${fieldName}"]`);
          if (mainCheckbox) {
            mainCheckbox.checked = false;
          }
        });
        updateSelectAllState();
      });
    });
  }
  
  // Toggle all field checkboxes
  function toggleSelectAllFields() {
    const isChecked = selectAllFields.checked;
    
    // Update both table and categorized checkboxes
    document.querySelectorAll('.field-checkbox, .field-checkbox-categorized').forEach(checkbox => {
      checkbox.checked = isChecked;
    });
  }
  
  // Update the "select all" checkbox state
  function updateSelectAllState() {
    const checkboxes = document.querySelectorAll('.field-checkbox');
    const checkedBoxes = document.querySelectorAll('.field-checkbox:checked');
    
    if (checkboxes.length === 0) {
      selectAllFields.checked = false;
      selectAllFields.indeterminate = false;
    } else if (checkedBoxes.length === 0) {
      selectAllFields.checked = false;
      selectAllFields.indeterminate = false;
    } else if (checkedBoxes.length === checkboxes.length) {
      selectAllFields.checked = true;
      selectAllFields.indeterminate = false;
    } else {
      selectAllFields.checked = false;
      selectAllFields.indeterminate = true;
    }
    
    // Also update category checkboxes to match
    document.querySelectorAll('.field-checkbox').forEach(checkbox => {
      const fieldName = checkbox.dataset.fieldName;
      const categoryCheckbox = document.querySelector(`.field-checkbox-categorized[data-field-name="${fieldName}"]`);
      if (categoryCheckbox) {
        categoryCheckbox.checked = checkbox.checked;
      }
    });
    
    // Update category counters
    updateCategorySelectionCounters();
  }
  
  // Update the category selection counters
  function updateCategorySelectionCounters() {
    // Group categories
    const categories = {};
    document.querySelectorAll('.field-checkbox').forEach(checkbox => {
      const category = checkbox.dataset.category;
      if (!categories[category]) {
        categories[category] = {
          total: 0,
          selected: 0
        };
      }
      
      categories[category].total++;
      if (checkbox.checked) {
        categories[category].selected++;
      }
    });
    
    // Update counters in accordion headers
    Object.keys(categories).forEach(category => {
      const categoryId = `category-${category.replace(/\s+/g, '-').toLowerCase()}`;
      const counterElement = document.querySelector(`#heading-${categoryId} .category-counter`);
      if (counterElement) {
        const { total, selected } = categories[category];
        counterElement.textContent = `(${selected}/${total})`;
        
        // Highlight categories with selections
        const headerButton = document.querySelector(`#heading-${categoryId} .accordion-button`);
        if (headerButton) {
          if (selected > 0) {
            headerButton.classList.add('text-primary');
          } else {
            headerButton.classList.remove('text-primary');
          }
        }
      }
    });
    
    // Also update filter sidebar category counts
    document.querySelectorAll('.category-filter-checkbox').forEach(checkbox => {
      const category = checkbox.dataset.category;
      const countElement = checkbox.closest('.form-check').querySelector('.category-count');
      if (countElement && categories[category]) {
        const { total, selected } = categories[category];
        countElement.textContent = `(${selected}/${total})`;
      }
    });
  }
  
  // Populate the category filters sidebar
  function populateCategoryFilters(categories) {
    categoryFilterList.innerHTML = '';
    
    // Create a checkbox for each category
    categories.forEach(category => {
      const categoryId = `filter-category-${category.replace(/\s+/g, '-').toLowerCase()}`;
      
      const checkboxContainer = document.createElement('div');
      checkboxContainer.className = 'form-check';
      
      checkboxContainer.innerHTML = `
        <input class="form-check-input category-filter-checkbox" type="checkbox" 
               id="${categoryId}" data-category="${category}" checked>
        <label class="form-check-label d-flex justify-content-between" for="${categoryId}">
          ${category}
          <span class="category-count ms-1 text-muted small">(0/0)</span>
        </label>
      `;
      
      categoryFilterList.appendChild(checkboxContainer);
      
      // Add event listener
      const checkbox = checkboxContainer.querySelector('input');
      checkbox.addEventListener('change', applyFilters);
    });
  }
  
  // Apply all filters to the field rows
  function applyFilters() {
    const searchText = fieldSearchInput.value.toLowerCase();
    const showScalar = document.getElementById('filter-scalar').checked;
    const showObject = document.getElementById('filter-object').checked;
    const showConnection = document.getElementById('filter-connection').checked;
    
    // Get selected categories
    const selectedCategories = Array.from(document.querySelectorAll('.category-filter-checkbox:checked'))
      .map(checkbox => checkbox.dataset.category);
    
    // Apply filters to table view
    document.querySelectorAll('.field-row').forEach(row => {
      const fieldName = row.dataset.fieldName;
      const checkbox = row.querySelector('.field-checkbox');
      const category = checkbox.dataset.category;
      const isScalar = checkbox.dataset.isScalar === 'true';
      
      // Determine field type class
      let fieldType = 'scalar';
      if (!isScalar) {
        const typeCell = row.querySelector('td:nth-child(4) .badge');
        fieldType = typeCell.textContent.toLowerCase().includes('connection') ? 'connection' : 'object';
      }
      
      // Check if field matches all active filters
      const matchesSearch = searchText === '' || 
                            fieldName.toLowerCase().includes(searchText);
      
      const matchesType = (isScalar && showScalar) || 
                          (fieldType === 'object' && showObject) || 
                          (fieldType === 'connection' && showConnection);
      
      const matchesCategory = selectedCategories.includes(category);
      
      // Show/hide based on filter matches
      row.style.display = (matchesSearch && matchesType && matchesCategory) ? '' : 'none';
    });
    
    // Also apply filters to categorized view
    document.querySelectorAll('.field-checkbox-categorized').forEach(checkbox => {
      const fieldName = checkbox.dataset.fieldName;
      const isScalar = checkbox.dataset.isScalar === 'true';
      const category = checkbox.dataset.category;
      
      const matchesSearch = searchText === '' || 
                            fieldName.toLowerCase().includes(searchText);
      
      const matchesType = (isScalar && showScalar) || 
                          (category === 'object' && showObject) || 
                          (category === 'connection' && showConnection);
      
      const matchesCategory = selectedCategories.includes(category);
      
      checkbox.closest('.field-row-grouped').style.display = 
        (matchesSearch && matchesType && matchesCategory) ? '' : 'none';
    });
  }
  
  // Start the data extraction process
  async function startExtraction() {
    // Get selected fields (from either view - table or categorized)
    const selectedCheckboxes = document.querySelectorAll('.field-checkbox:checked');
    
    if (selectedCheckboxes.length === 0) {
      alert('Please select at least one field to extract');
      return;
    }
    
    // Get selected fields and categorize them
    const selectedFields = [];
    const selectedConnections = [];
    const fieldsByCategory = {};
    
    selectedCheckboxes.forEach(checkbox => {
      const fieldName = checkbox.dataset.fieldName;
      const isScalar = checkbox.dataset.isScalar === 'true';
      const category = checkbox.dataset.category || 'Other';
      
      // Group by category for logging
      if (!fieldsByCategory[category]) {
        fieldsByCategory[category] = [];
      }
      fieldsByCategory[category].push(fieldName);
      
      // Split by field type
      if (isScalar) {
        selectedFields.push(fieldName);
      } else {
        selectedConnections.push(fieldName);
      }
    });
    
    appState.selectedFields = selectedFields.concat(selectedConnections);
    
    // Log the fields by category for reference
    console.log('Selected fields by category:', fieldsByCategory);
    
    // Show extraction section
    extractionSection.style.display = 'block';
    
    // Scroll to extraction section
    extractionSection.scrollIntoView({ behavior: 'smooth' });
    
    try {
      // Build the GraphQL query
      const query = await buildGraphQLQuery(appState.selectedResource, selectedFields, selectedConnections);
      currentQueryInput.value = query;
      
      // Log summary of selected fields by category
      const categoryLog = Object.entries(fieldsByCategory)
        .map(([category, fields]) => `${category}: ${fields.length} fields`)
        .join(', ');
      
      appendToLogs(`Selected ${appState.selectedFields.length} fields across categories: ${categoryLog}`);
      
      // Log the query
      appendToLogs(`Extraction query built for ${appState.selectedResource}`);
      
      // Start extraction
      appState.extractionInProgress = true;
      extractionStatus.textContent = 'Initializing extraction...';
      updateProgressBar(0);
      
      // Initialize extraction
      const initResponse = await fetch('/api/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          resource: appState.selectedResource,
          query,
          fields: appState.selectedFields
        })
      });
      
      if (!initResponse.ok) {
        throw new Error(`Failed to initialize extraction: ${initResponse.status}`);
      }
      
      // Start listening for extraction updates
      startExtractionUpdates();
      
    } catch (error) {
      console.error('Extraction initialization error:', error);
      appendToLogs(`Error: ${error.message}`);
      extractionStatus.textContent = 'Failed to start extraction';
      appState.extractionInProgress = false;
    }
  }
  
  // Start a predefined extraction based on data type
  async function startPredefinedExtraction(dataType) {
    // Show extraction section
    extractionSection.style.display = 'block';
    
    // Scroll to extraction section
    extractionSection.scrollIntoView({ behavior: 'smooth' });
    
    // Set progress and status
    updateProgressBar(0);
    extractionStatus.textContent = `Initializing ${dataType} extraction...`;
    recordsCount.textContent = '0';
    extractionLogs.textContent = '';
    
    // Log start of extraction
    appendToLogs(`Starting predefined extraction for ${dataType}...`);
    
    try {
      // Şemayı kontrol edip güvenli ve güncel bir sorgu alalım
      const predefinedQuery = await getPredefinedQuery(dataType);
      const resource = dataType; // Resource matches the data type (products, orders, customers)
      
      // Initialize extraction
      const initResponse = await fetch('/api/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          resource: resource,
          query: predefinedQuery.query,
          fields: predefinedQuery.fields
        })
      });
      
      if (!initResponse.ok) {
        throw new Error(`Failed to initialize extraction: ${initResponse.status}`);
      }
      
      // Set app state to track
      appState.extractionInProgress = true;
      appState.selectedResource = resource;
      
      // Set the resource and query for reference
      currentResourceInput.value = resource;
      currentQueryInput.value = predefinedQuery.query;
      
      // Start listening for extraction updates
      startExtractionUpdates();
      
    } catch (error) {
      console.error('Extraction initialization error:', error);
      appendToLogs(`Error: ${error.message}`);
      extractionStatus.textContent = 'Failed to start extraction';
    }
  }
  
  // Monitor extraction progress
  function startExtractionUpdates() {
    const updateInterval = setInterval(async () => {
      if (!appState.extractionInProgress) {
        clearInterval(updateInterval);
        return;
      }
      
      try {
        const response = await fetch('/api/extraction-status');
        if (!response.ok) {
          throw new Error(`Failed to get extraction status: ${response.status}`);
        }
        
        const statusData = await response.json();
        
        // Update progress bar
        updateProgressBar(statusData.progress);
        
        // Update status text
        extractionStatus.textContent = getStatusText(statusData.status);
        
        // Update records count
        recordsCount.textContent = statusData.recordsProcessed.toString();
        
        // Add log if available
        if (statusData.log) {
          appendToLogs(statusData.log);
        }
        
        // Check if extraction is complete
        if (statusData.status === 'completed') {
          appState.extractionInProgress = false;
          appState.extractionData = statusData.data;
          
          // Enable download button
          downloadDataBtn.disabled = false;
          
          // Final log
          appendToLogs(`Extraction completed: ${statusData.recordsProcessed} records extracted`);
          
          // Clear the interval
          clearInterval(updateInterval);
        } else if (statusData.status === 'failed') {
          appState.extractionInProgress = false;
          
          // Final log
          appendToLogs(`Extraction failed: ${statusData.log || 'Unknown error'}`);
          
          // Clear the interval
          clearInterval(updateInterval);
        }
        
      } catch (error) {
        console.error('Error getting extraction status:', error);
        appendToLogs(`Error getting status: ${error.message}`);
      }
    }, 1000); // Check every second
  }
  
  // Download the extracted data as JSON or CSV
  function downloadExtractedData() {
    if (!appState.extractionData) {
      alert('No data available to download');
      return;
    }
    
    // Ask user for format preference
    const format = confirm('Download as CSV? (Click Cancel for JSON format)') ? 'csv' : 'json';
    
    if (format === 'json') {
      // Create a JSON blob
      const dataStr = JSON.stringify(appState.extractionData, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      
      // Create a download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${appState.selectedResource}_${new Date().toISOString().split('T')[0]}.json`;
      
      // Trigger download
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    } else {
      // Convert JSON to CSV
      const csv = convertToCSV(appState.extractionData);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      
      // Create a download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${appState.selectedResource}_${new Date().toISOString().split('T')[0]}.csv`;
      
      // Trigger download
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    }
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
  
  // Helper function to get status text
  function getStatusText(status) {
    switch (status) {
      case 'idle':
        return 'Ready to extract';
      case 'initializing':
        return 'Initializing extraction...';
      case 'running':
        return 'Extraction in progress...';
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
  
  // Helper function to update progress bar
  function updateProgressBar(percent) {
    extractionProgressBar.style.width = `${percent}%`;
    extractionProgressBar.setAttribute('aria-valuenow', percent);
    
    // Change color based on progress
    if (percent < 25) {
      extractionProgressBar.className = 'progress-bar bg-danger';
    } else if (percent < 50) {
      extractionProgressBar.className = 'progress-bar bg-warning';
    } else if (percent < 75) {
      extractionProgressBar.className = 'progress-bar bg-info';
    } else {
      extractionProgressBar.className = 'progress-bar bg-success';
    }
  }
  
  // Helper function to append to logs
  function appendToLogs(message) {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    logEntry.innerHTML = `<span class="log-time">[${timestamp}]</span> ${message}`;
    
    extractionLogs.appendChild(logEntry);
    extractionLogs.scrollTop = extractionLogs.scrollHeight;
  }
  
  // Helper function to capitalize first letter
  function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }
  
  // Helper function to show API selection section
  function showApiSelectionSection() {
    fieldSelectionSection.style.display = 'none';
    apiSelectionSection.style.display = 'block';
  }
  
  // Helper function to show predefined queries section
  function showPredefinedQueriesSection() {
    apiSelectionSection.style.display = 'none';
    predefinedQueriesSection.style.display = 'block';
  }
  
  // Helper function to show field selection section
  function showFieldSelectionSection() {
    apiSelectionSection.style.display = 'none';
    fieldSelectionSection.style.display = 'block';
  }
  
  // Helper function to check if a type is a scalar
  function isScalarType(type) {
    // Check if it's a scalar type
    const scalarTypes = ['String', 'Int', 'Float', 'Boolean', 'ID'];
    
    // Get the base type (unwrap non-null and list types)
    const baseType = getBaseType(type);
    
    // Check if the base type is a scalar
    return scalarTypes.includes(baseType.name);
  }
  
  // Helper function to get the base type (unwrap non-null and list types)
  function getBaseType(type) {
    if (type.kind === 'NON_NULL' && type.ofType) {
      return getBaseType(type.ofType);
    }
    
    if (type.kind === 'LIST' && type.ofType) {
      return getBaseType(type.ofType);
    }
    
    return type;
  }
  
  // Helper function to get type display text
  function getTypeDisplay(type) {
    if (type.kind === 'NON_NULL') {
      return `${getTypeDisplay(type.ofType)}!`;
    }
    
    if (type.kind === 'LIST') {
      return `[${getTypeDisplay(type.ofType)}]`;
    }
    
    return type.name;
  }
  
  // Helper function to get type class for styling
  function getTypeClass(type) {
    const baseType = getBaseType(type);
    
    if (isScalarType(type)) {
      return 'bg-success';
    }
    
    if (baseType.name && baseType.name.includes('Connection')) {
      return 'bg-primary';
    }
    
    return 'bg-info';
  }
  
  // Get a predefined query by type
  async function getPredefinedQuery(type) {
    try {
      // Önce şemayı kontrol edelim
      const validateQueryResponse = await fetch('/api/validate-query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          resourceType: type,
          predefinedType: type
        })
      });
      
      if (!validateQueryResponse.ok) {
        throw new Error(`Failed to validate query: ${validateQueryResponse.status}`);
      }
      
      const validatedQuery = await validateQueryResponse.json();
      return validatedQuery;
    } catch (error) {
      console.error(`Error getting predefined query for ${type}:`, error);
      alert(`Failed to prepare query: ${error.message}`);
      throw error;
    }
  }
  
  // Helper function to build a GraphQL query
  async function buildGraphQLQuery(resourceName, scalarFields, connectionFields) {
    try {
      // Dinamik sorgu oluştur
      const response = await fetch('/api/build-query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          resource: resourceName,
          fields: [...scalarFields, ...connectionFields]
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to build query: ${response.status}`);
      }
      
      const result = await response.json();
      return result.query;
    } catch (error) {
      console.error('Error building GraphQL query:', error);
      
      // Bir hata olursa basit bir sorgu döndürelim
      const queryName = `get${capitalizeFirstLetter(resourceName)}`;
      
      let query = `query ${queryName}($first: Int!, $after: String) {\n`;
      query += `  ${resourceName}(first: $first, after: $after) {\n`;
      query += `    pageInfo {\n`;
      query += `      hasNextPage\n`;
      query += `      endCursor\n`;
      query += `    }\n`;
      query += `    edges {\n`;
      query += `      node {\n`;
      query += `        id\n`;
      
      // En azından ID'yi her zaman ekleyelim
      const uniqueFields = new Set(['id', ...scalarFields, ...connectionFields]);
      
      uniqueFields.forEach(field => {
        if (field !== 'id') { // ID zaten eklendi
          query += `        ${field}\n`;
        }
      });
      
      query += `      }\n`;
      query += `    }\n`;
      query += `  }\n`;
      query += `}`;
      
      return query;
    }
  }
});