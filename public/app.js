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
      
      // Show predefined queries section
      predefinedQueriesSection.style.display = 'block';
      
      // Save credentials to localStorage
      saveCredentials({ storeName, clientId, accessToken, apiVersion });
      
    } catch (error) {
      console.error('Connection error:', error);
      alert(`Failed to connect: ${error.message}`);
      
      // Reset button
      connectBtn.disabled = false;
      connectBtn.innerHTML = '<i class="bi bi-plug-fill me-1"></i> Connect to Shopify';
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
    const queryType = schema.types.find(type => type.name === 'QueryRoot');
    
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
      const category = checkbox.dataset.category;
      const isScalar = checkbox.dataset.isScalar === 'true';
      const fieldRow = checkbox.closest('.field-row-grouped');
      
      // Determine field type class
      let fieldType = 'scalar';
      if (!isScalar) {
        const typeSpan = fieldRow.querySelector('.badge');
        fieldType = typeSpan.textContent.toLowerCase().includes('connection') ? 'connection' : 'object';
      }
      
      // Check if field matches all active filters
      const matchesSearch = searchText === '' || 
                            fieldName.toLowerCase().includes(searchText);
      
      const matchesType = (isScalar && showScalar) || 
                          (fieldType === 'object' && showObject) || 
                          (fieldType === 'connection' && showConnection);
      
      const matchesCategory = selectedCategories.includes(category);
      
      // Show/hide based on filter matches
      fieldRow.style.display = (matchesSearch && matchesType && matchesCategory) ? '' : 'none';
    });
    
    // Update empty state message for each category in accordion
    document.querySelectorAll('.accordion-item').forEach(accordionItem => {
      const category = accordionItem.querySelector('.accordion-button').textContent.split('(')[0].trim();
      const visibleFields = accordionItem.querySelectorAll('.field-row-grouped[style="display: none;"]');
      const emptyStateMsg = accordionItem.querySelector('.empty-state');
      
      if (visibleFields.length === 0) {
        // All fields are filtered out
        if (!emptyStateMsg) {
          const emptyState = document.createElement('div');
          emptyState.className = 'empty-state p-3 text-center text-muted';
          emptyState.textContent = 'No fields match the current filters';
          accordionItem.querySelector('.accordion-body').appendChild(emptyState);
        }
      } else if (emptyStateMsg) {
        emptyStateMsg.remove();
      }
    });
  }
  
  // Start the data extraction process
  async function startExtraction() {
    // Get selected fields (from either view - table or categorized)
    const selectedCheckboxes = document.querySelectorAll('.field-checkbox:checked');
    const groupByCategory = document.getElementById('group-by-category').checked;
    
    // If we're in category view, we should collect from category checkboxes instead
    const checkboxesToUse = selectedCheckboxes;
    
    if (checkboxesToUse.length === 0) {
      alert('Please select at least one field to extract');
      return;
    }
    
    // Get selected fields and categorize them
    const selectedFields = [];
    const selectedConnections = [];
    const fieldsByCategory = {};
    
    checkboxesToUse.forEach(checkbox => {
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
    
    // Build the GraphQL query
    const query = buildGraphQLQuery(appState.selectedResource, selectedFields, selectedConnections);
    currentQueryInput.value = query;
    
    // Log summary of selected fields by category
    const categoryLog = Object.entries(fieldsByCategory)
      .map(([category, fields]) => `${category}: ${fields.length} fields`)
      .join(', ');
    
    appendToLogs(`Selected ${appState.selectedFields.length} fields across categories: ${categoryLog}`);
    
    // Log the query
    appendToLogs(`Extraction query built for ${appState.selectedResource}:\n${query}`);
    
    // Start extraction
    appState.extractionInProgress = true;
    extractionStatus.textContent = 'Initializing extraction...';
    updateProgressBar(0);
    
    try {
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
  
  // Start polling for extraction updates
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
        
        // Update UI with status
        updateExtractionStatus(statusData);
        
        // If extraction is complete, stop polling
        if (statusData.status === 'completed' || statusData.status === 'failed') {
          appState.extractionInProgress = false;
          clearInterval(updateInterval);
          
          if (statusData.status === 'completed') {
            downloadDataBtn.disabled = false;
            appState.extractionData = statusData.data;
          }
        }
        
      } catch (error) {
        console.error('Error fetching extraction status:', error);
        appendToLogs(`Error fetching status: ${error.message}`);
      }
    }, 1000); // Poll every second
  }
  
  // Update extraction status UI
  function updateExtractionStatus(statusData) {
    const { status, progress, recordsProcessed, totalRecords, log } = statusData;
    
    // Update progress
    if (typeof progress === 'number') {
      updateProgressBar(progress);
    }
    
    // Update status text
    extractionStatus.textContent = getStatusText(status);
    
    // Update records count
    if (typeof recordsProcessed === 'number') {
      recordsCount.textContent = recordsProcessed;
      if (typeof totalRecords === 'number') {
        recordsCount.textContent += ` of ${totalRecords}`;
      }
    }
    
    // Add log entry if present
    if (log) {
      appendToLogs(log);
    }
  }
  
  // Convert status code to user-friendly text
  function getStatusText(status) {
    switch (status) {
      case 'initializing': return 'Initializing extraction...';
      case 'running': return 'Extraction in progress';
      case 'paginating': return 'Fetching next page of results...';
      case 'processing': return 'Processing extracted data...';
      case 'completed': return 'Extraction completed successfully';
      case 'failed': return 'Extraction failed';
      default: return status || 'Unknown status';
    }
  }
  
  // Update the progress bar
  function updateProgressBar(percentage) {
    const progress = Math.max(0, Math.min(100, Math.round(percentage)));
    extractionProgressBar.style.width = `${progress}%`;
    extractionProgressBar.setAttribute('aria-valuenow', progress);
    extractionProgressBar.textContent = `${progress}%`;
    
    // Change color based on progress
    extractionProgressBar.className = 'progress-bar progress-bar-striped progress-bar-animated';
    if (progress === 100) {
      extractionProgressBar.classList.add('bg-success');
    } else if (progress >= 66) {
      extractionProgressBar.classList.add('bg-info');
    } else if (progress >= 33) {
      extractionProgressBar.classList.add('bg-warning');
    } else {
      extractionProgressBar.classList.add('bg-danger');
    }
  }
  
  // Append text to the log display
  function appendToLogs(text) {
    const timestamp = new Date().toLocaleTimeString();
    extractionLogs.textContent += `[${timestamp}] ${text}\n`;
    extractionLogs.scrollTop = extractionLogs.scrollHeight;
  }
  
  // Download the extracted data
  function downloadExtractedData() {
    if (!appState.extractionData) {
      alert('No data available to download');
      return;
    }
    
    // Show download options modal
    showDownloadOptionsModal();
  }
  
  // Show download options modal
  function showDownloadOptionsModal() {
    // Create modal element
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.id = 'downloadOptionsModal';
    modal.setAttribute('tabindex', '-1');
    modal.setAttribute('aria-labelledby', 'downloadOptionsModalLabel');
    modal.setAttribute('aria-hidden', 'true');
    
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="downloadOptionsModalLabel">Download Options</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <p>Choose a format to download the extracted data:</p>
            <div class="d-grid gap-2">
              <button type="button" class="btn btn-primary download-json-btn">
                <i class="bi bi-filetype-json me-2"></i> Download as JSON
              </button>
              <button type="button" class="btn btn-success download-csv-btn">
                <i class="bi bi-filetype-csv me-2"></i> Download as CSV
              </button>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
          </div>
        </div>
      </div>
    `;
    
    // Add to body
    document.body.appendChild(modal);
    
    // Initialize Bootstrap modal
    const modalInstance = new bootstrap.Modal(modal);
    modalInstance.show();
    
    // Add event listeners
    modal.querySelector('.download-json-btn').addEventListener('click', () => {
      downloadAsJson();
      modalInstance.hide();
    });
    
    modal.querySelector('.download-csv-btn').addEventListener('click', () => {
      downloadAsCsv();
      modalInstance.hide();
    });
    
    // Cleanup when modal is hidden
    modal.addEventListener('hidden.bs.modal', () => {
      document.body.removeChild(modal);
    });
  }
  
  // Download data as JSON
  function downloadAsJson() {
    // Create a JSON blob
    const dataStr = JSON.stringify(appState.extractionData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    
    // Create download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `${appState.selectedResource}-${new Date().toISOString().split('T')[0]}.json`;
    
    // Trigger download
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }
  
  // Download data as CSV
  function downloadAsCsv() {
    const resource = appState.selectedResource;
    const data = appState.extractionData;
    
    if (!data || data.length === 0) {
      alert('No data available to convert to CSV');
      return;
    }
    
    // Process data based on resource type
    let csvContent;
    
    try {
      switch (resource) {
        case 'products':
          csvContent = generateProductsCsv(data);
          break;
        case 'orders':
          csvContent = generateOrdersCsv(data);
          break;
        case 'customers':
          csvContent = generateCustomersCsv(data);
          break;
        default:
          // For other resources, use a generic approach
          csvContent = generateGenericCsv(data);
      }
      
      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `${resource}-${new Date().toISOString().split('T')[0]}.csv`;
      
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
    } catch (error) {
      console.error('Error generating CSV:', error);
      alert('Failed to generate CSV: ' + error.message);
    }
  }
  
  // Generate CSV for products
  function generateProductsCsv(products) {
    // Define columns for products CSV
    const columns = [
      'id', 'title', 'handle', 'status', 'productType', 'vendor', 'createdAt', 'updatedAt',
      'minPrice', 'maxPrice', 'currency', 'totalInventory', 'tags', 'variantCount', 'imageCount',
      'metafieldCount'
    ];
    
    // Create header row
    let csv = columns.join(',') + '\\n';
    
    // Add data rows
    products.forEach(product => {
      const row = [];
      
      // Basic fields
      row.push(escapeCsvValue(product.id));
      row.push(escapeCsvValue(product.title));
      row.push(escapeCsvValue(product.handle));
      row.push(escapeCsvValue(product.status));
      row.push(escapeCsvValue(product.productType));
      row.push(escapeCsvValue(product.vendor));
      row.push(escapeCsvValue(product.createdAt));
      row.push(escapeCsvValue(product.updatedAt));
      
      // Price range
      if (product.priceRangeV2) {
        row.push(escapeCsvValue(product.priceRangeV2.minVariantPrice?.amount || ''));
        row.push(escapeCsvValue(product.priceRangeV2.maxVariantPrice?.amount || ''));
        row.push(escapeCsvValue(product.priceRangeV2.minVariantPrice?.currencyCode || ''));
      } else {
        row.push('','','');
      }
      
      // Other fields
      row.push(escapeCsvValue(product.totalInventory));
      row.push(escapeCsvValue(Array.isArray(product.tags) ? product.tags.join('|') : product.tags));
      
      // Count of related items
      const variantCount = product.variants?.edges?.length || 0;
      const imageCount = product.images?.edges?.length || 0;
      const metafieldCount = product.metafields?.edges?.length || 0;
      
      row.push(escapeCsvValue(variantCount));
      row.push(escapeCsvValue(imageCount));
      row.push(escapeCsvValue(metafieldCount));
      
      // Add row to CSV
      csv += row.join(',') + '\\n';
    });
    
    return csv;
  }
  
  // Generate CSV for variants (companion to products)
  function generateVariantsCsv(products) {
    // Define columns for variants CSV
    const columns = [
      'id', 'productId', 'productTitle', 'variantTitle', 'sku', 'price', 'compareAtPrice',
      'inventoryQuantity', 'inventoryPolicy', 'barcode', 'position', 'option1Name', 'option1Value',
      'option2Name', 'option2Value', 'option3Name', 'option3Value'
    ];
    
    // Create header row
    let csv = columns.join(',') + '\\n';
    
    // Add data rows
    products.forEach(product => {
      const productId = product.id;
      const productTitle = product.title;
      
      // Process each variant
      if (product.variants && product.variants.edges) {
        product.variants.edges.forEach(edge => {
          const variant = edge.node;
          const row = [];
          
          // Basic fields
          row.push(escapeCsvValue(variant.id));
          row.push(escapeCsvValue(productId));
          row.push(escapeCsvValue(productTitle));
          row.push(escapeCsvValue(variant.title));
          row.push(escapeCsvValue(variant.sku));
          row.push(escapeCsvValue(variant.price));
          row.push(escapeCsvValue(variant.compareAtPrice));
          row.push(escapeCsvValue(variant.inventoryQuantity));
          row.push(escapeCsvValue(variant.inventoryPolicy));
          row.push(escapeCsvValue(variant.barcode));
          row.push(escapeCsvValue(variant.position));
          
          // Handle options
          const options = variant.selectedOptions || [];
          for (let i = 0; i < 3; i++) {
            if (options[i]) {
              row.push(escapeCsvValue(options[i].name));
              row.push(escapeCsvValue(options[i].value));
            } else {
              row.push('', ''); // Empty option slots
            }
          }
          
          // Add row to CSV
          csv += row.join(',') + '\\n';
        });
      }
    });
    
    return csv;
  }
  
  // Generate CSV for orders
  function generateOrdersCsv(orders) {
    // Define columns for orders CSV
    const columns = [
      'id', 'name', 'email', 'phone', 'createdAt', 'processedAt', 'displayFinancialStatus', 
      'displayFulfillmentStatus', 'totalPrice', 'subtotalPrice', 'totalShippingPrice', 'totalTax',
      'totalDiscounts', 'currencyCode', 'itemCount', 'customer', 'shippingAddress', 'billingAddress',
      'note', 'tags'
    ];
    
    // Create header row
    let csv = columns.join(',') + '\\n';
    
    // Add data rows
    orders.forEach(order => {
      const row = [];
      
      // Basic fields
      row.push(escapeCsvValue(order.id));
      row.push(escapeCsvValue(order.name));
      row.push(escapeCsvValue(order.email));
      row.push(escapeCsvValue(order.phone));
      row.push(escapeCsvValue(order.createdAt));
      row.push(escapeCsvValue(order.processedAt));
      row.push(escapeCsvValue(order.displayFinancialStatus));
      row.push(escapeCsvValue(order.displayFulfillmentStatus));
      
      // Money fields
      const totalPrice = order.totalPriceSet?.shopMoney?.amount || '';
      const subtotalPrice = order.subtotalPriceSet?.shopMoney?.amount || '';
      const totalShippingPrice = order.totalShippingPriceSet?.shopMoney?.amount || '';
      const totalTax = order.totalTaxSet?.shopMoney?.amount || '';
      const totalDiscounts = order.totalDiscountsSet?.shopMoney?.amount || '';
      const currencyCode = order.totalPriceSet?.shopMoney?.currencyCode || '';
      
      row.push(escapeCsvValue(totalPrice));
      row.push(escapeCsvValue(subtotalPrice));
      row.push(escapeCsvValue(totalShippingPrice));
      row.push(escapeCsvValue(totalTax));
      row.push(escapeCsvValue(totalDiscounts));
      row.push(escapeCsvValue(currencyCode));
      
      // Line items count
      const itemCount = order.subtotalLineItemsQuantity || order.lineItems?.edges?.length || 0;
      row.push(escapeCsvValue(itemCount));
      
      // Customer
      const customer = order.customer ? 
        `${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim() : '';
      row.push(escapeCsvValue(customer));
      
      // Addresses - use formatted if available
      const formatAddress = (addr) => {
        if (!addr) return '';
        if (addr.formatted) return addr.formatted;
        return [
          addr.firstName, addr.lastName,
          addr.address1, addr.address2,
          addr.city, addr.province, addr.country, addr.zip
        ].filter(Boolean).join(', ');
      };
      
      row.push(escapeCsvValue(formatAddress(order.shippingAddress)));
      row.push(escapeCsvValue(formatAddress(order.billingAddress)));
      
      // Other fields
      row.push(escapeCsvValue(order.note));
      row.push(escapeCsvValue(Array.isArray(order.tags) ? order.tags.join('|') : order.tags));
      
      // Add row to CSV
      csv += row.join(',') + '\\n';
    });
    
    return csv;
  }
  
  // Generate CSV for customers
  function generateCustomersCsv(customers) {
    // Define columns for customers CSV
    const columns = [
      'id', 'firstName', 'lastName', 'email', 'phone', 'createdAt', 'ordersCount',
      'totalSpent', 'taxExempt', 'state', 'defaultAddressFormatted', 'addressCount', 
      'tags', 'note'
    ];
    
    // Create header row
    let csv = columns.join(',') + '\\n';
    
    // Add data rows
    customers.forEach(customer => {
      const row = [];
      
      // Basic fields
      row.push(escapeCsvValue(customer.id));
      row.push(escapeCsvValue(customer.firstName));
      row.push(escapeCsvValue(customer.lastName));
      row.push(escapeCsvValue(customer.email));
      row.push(escapeCsvValue(customer.phone));
      row.push(escapeCsvValue(customer.createdAt));
      row.push(escapeCsvValue(customer.ordersCount));
      
      // Money fields
      row.push(escapeCsvValue(customer.totalSpent || ''));
      
      // Boolean flags
      row.push(escapeCsvValue(customer.taxExempt ? 'Yes' : 'No'));
      row.push(escapeCsvValue(customer.state));
      
      // Address info
      row.push(escapeCsvValue(customer.defaultAddress?.formatted || ''));
      
      // In the new API, addresses is a direct list, not edges/nodes
      const addressCount = Array.isArray(customer.addresses) ? customer.addresses.length : 0;
      row.push(escapeCsvValue(addressCount));
      
      // Other fields
      row.push(escapeCsvValue(Array.isArray(customer.tags) ? customer.tags.join('|') : customer.tags));
      row.push(escapeCsvValue(customer.note));
      
      // Add row to CSV
      csv += row.join(',') + '\\n';
    });
    
    return csv;
  }
  
  // Generate a generic CSV for any data
  function generateGenericCsv(data) {
    if (!data || data.length === 0) {
      return 'No data';
    }
    
    // Get all unique keys from all objects at depth 1
    const allKeys = new Set();
    data.forEach(item => {
      Object.keys(item).forEach(key => {
        // Only include scalar values in CSV
        if (item[key] === null || 
            typeof item[key] !== 'object' ||
            item[key] instanceof Date) {
          allKeys.add(key);
        }
      });
    });
    
    // Convert to array and sort
    const columns = Array.from(allKeys).sort();
    
    // Create header row
    let csv = columns.join(',') + '\\n';
    
    // Add data rows
    data.forEach(item => {
      const row = columns.map(column => {
        const value = item[column];
        
        // Format the value
        if (value === null || value === undefined) {
          return '';
        } else if (typeof value === 'object') {
          return escapeCsvValue(JSON.stringify(value));
        } else {
          return escapeCsvValue(value.toString());
        }
      });
      
      csv += row.join(',') + '\\n';
    });
    
    return csv;
  }
  
  // Helper to escape CSV values
  function escapeCsvValue(value) {
    if (value === null || value === undefined) {
      return '';
    }
    
    const stringValue = String(value);
    
    // If the value contains a comma, newline, or double quote, enclose it in double quotes
    if (stringValue.includes(',') || stringValue.includes('\\n') || stringValue.includes('"') || stringValue.includes('\\r')) {
      // Replace double quotes with two double quotes to escape them
      return '"' + stringValue.replace(/"/g, '""') + '"';
    }
    
    return stringValue;
  }
  
  // Navigation functions
  function showPredefinedQueriesSection() {
    fieldSelectionSection.style.display = 'none';
    apiSelectionSection.style.display = 'none';
    predefinedQueriesSection.style.display = 'block';
  }
  
  // Show API selection section
  function showApiSelectionSection() {
    fieldSelectionSection.style.display = 'none';
    predefinedQueriesSection.style.display = 'none';
    apiSelectionSection.style.display = 'block';
  }
  
  // Show field selection section
  function showFieldSelectionSection() {
    predefinedQueriesSection.style.display = 'none';
    apiSelectionSection.style.display = 'none';
    fieldSelectionSection.style.display = 'block';
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
    
    // Get the predefined query for the data type
    const predefinedQuery = getPredefinedQuery(dataType);
    const resource = dataType; // Resource matches the data type (products, orders, customers)
    
    try {
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
  
  // Get a predefined query by type
  function getPredefinedQuery(type) {
    switch (type) {
      case 'products':
        return {
          query: `query GetProducts($first: Int!, $after: String) {
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
              requiresShipping
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
        
      case 'orders':
        return {
          query: `query GetOrders($first: Int!, $after: String) {
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
          company
          formatted
        }
        billingAddress {
          firstName
          lastName
          address1
          address2
          city
          province
          country
          zip
          phone
          company
          formatted
        }
        lineItems(first: 50) {
          edges {
            node {
              id
              title
              quantity
              discountedTotalSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              originalTotalSet {
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
                  handle
                }
              }
            }
          }
        }
        transactions(first: 10) {
          edges {
            node {
              id
              status
              kind
              gateway
              createdAt
              amountSet {
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
  }
}`,
          fields: ["id", "name", "email", "phone", "closed", "cancelReason", "cancelledAt", "processedAt", 
                  "createdAt", "updatedAt", "displayFinancialStatus", "displayFulfillmentStatus", 
                  "note", "tags", "subtotalLineItemsQuantity", "totalPriceSet", "subtotalPriceSet", 
                  "totalShippingPriceSet", "totalTaxSet", "totalDiscountsSet", "customer", 
                  "shippingAddress", "billingAddress", "lineItems", "transactions"]
        };
        
      case 'customers':
        return {
          query: `query GetCustomers($first: Int!, $after: String) {
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
        email
        phone
        displayName
        createdAt
        updatedAt
        defaultAddress {
          id
          address1
          address2
          city
          country
          firstName
          lastName
          company
          phone
          province
          zip
          formatted
        }
        addresses {
          id
          address1
          address2
          city
          country
          firstName
          lastName
          company
          phone
          province
          zip
          formatted
        }
        note
        tags
        ordersCount
        state
        taxExempt
        totalSpent
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
        orders(first: 5) {
          edges {
            node {
              id
              name
              processedAt
              displayFulfillmentStatus
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
    }
  }
}`,
          fields: ["id", "firstName", "lastName", "email", "phone", "displayName", "createdAt", "updatedAt", 
                   "defaultAddress", "addresses", "note", "tags", "ordersCount", "state", "taxExempt", 
                   "totalSpent", "metafields", "orders"]
        };
        
      default:
        throw new Error(`Unknown predefined query type: ${type}`);
    }
  }
  
  // Helper function to build a GraphQL query
  function buildGraphQLQuery(resourceName, scalarFields, connectionFields) {
    // Build the pagination variables
    const queryName = `get${capitalizeFirstLetter(resourceName)}`;
    
    let query = `query ${queryName}($first: Int!, $after: String) {\n`;
    query += `  ${resourceName}(first: $first, after: $after) {\n`;
    query += `    pageInfo {\n`;
    query += `      hasNextPage\n`;
    query += `      endCursor\n`;
    query += `    }\n`;
    query += `    edges {\n`;
    query += `      node {\n`;
    
    // Add scalar fields
    scalarFields.forEach(field => {
      query += `        ${field}\n`;
    });
    
    // Add connection fields with default subfields
    connectionFields.forEach(field => {
      query += `        ${field}(first: 10) {\n`;
      query += `          edges {\n`;
      query += `            node {\n`;
      query += `              id\n`;
      query += `            }\n`;
      query += `          }\n`;
      query += `        }\n`;
    });
    
    // Close the query
    query += `      }\n`;
    query += `    }\n`;
    query += `  }\n`;
    query += `}`;
    
    return query;
  }
  
  // Helper function to get display text for a type
  function getTypeDisplay(type) {
    if (type.kind === 'SCALAR') {
      return `Scalar: ${type.name}`;
    } else if (type.kind === 'OBJECT') {
      return `Object: ${type.name}`;
    } else if (type.kind === 'LIST') {
      const ofTypeName = type.ofType ? type.ofType.name : 'Unknown';
      return `List of ${ofTypeName}`;
    } else if (type.kind === 'NON_NULL') {
      const ofType = type.ofType ? getTypeDisplay(type.ofType) : 'Unknown';
      return `${ofType}!`;
    } else if (type.kind === 'ENUM') {
      return `Enum: ${type.name}`;
    }
    
    return type.name || 'Unknown';
  }
  
  // Helper function to get CSS class for a type badge
  function getTypeClass(type) {
    const baseType = getBaseType(type);
    const baseKind = baseType.kind;
    
    if (baseKind === 'SCALAR' || baseKind === 'ENUM') {
      return 'badge-field-type badge-scalar';
    } else if (baseKind === 'OBJECT') {
      if (baseType.name && baseType.name.endsWith('Connection')) {
        return 'badge-field-type badge-connection';
      }
      return 'badge-field-type badge-object';
    }
    
    return 'badge-field-type badge-scalar';
  }
  
  // Helper function to check if a type is a scalar
  function isScalarType(type) {
    const baseType = getBaseType(type);
    return baseType.kind === 'SCALAR' || baseType.kind === 'ENUM';
  }
  
  // Helper function to get the base type
  function getBaseType(type) {
    if (type.kind === 'NON_NULL' || type.kind === 'LIST') {
      return type.ofType ? getBaseType(type.ofType) : type;
    }
    return type;
  }
  
  // Helper function to capitalize first letter
  function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }
  
  // Save credentials to localStorage
  function saveCredentials(credentials) {
    try {
      const encryptedCredentials = btoa(JSON.stringify(credentials));
      localStorage.setItem('shopifyCredentials', encryptedCredentials);
    } catch (error) {
      console.error('Failed to save credentials:', error);
    }
  }
  
  // Load credentials from localStorage
  function loadCredentials() {
    try {
      const encryptedCredentials = localStorage.getItem('shopifyCredentials');
      if (encryptedCredentials) {
        const credentials = JSON.parse(atob(encryptedCredentials));
        
        // Populate form fields
        storeNameInput.value = credentials.storeName || '';
        clientIdInput.value = credentials.clientId || '';
        accessTokenInput.value = credentials.accessToken || '';
        
        // Set API version if available, otherwise use latest
        if (credentials.apiVersion) {
          apiVersionSelect.value = credentials.apiVersion;
          // If the version doesn't exist in our dropdown, add it
          if (!Array.from(apiVersionSelect.options).some(opt => opt.value === credentials.apiVersion)) {
            const newOption = document.createElement('option');
            newOption.value = credentials.apiVersion;
            newOption.text = `${credentials.apiVersion} (Custom)`;
            apiVersionSelect.add(newOption);
            apiVersionSelect.value = credentials.apiVersion;
          }
          
          // Uncheck "always latest" if we're using a specific version that's not the latest
          if (credentials.apiVersion !== '2025-01') {
            alwaysLatestCheckbox.checked = false;
            apiVersionSelect.disabled = false;
          }
        }
        
        // If we have all required credentials, enable auto-connect
        if (credentials.storeName && credentials.clientId && credentials.accessToken) {
          // Set a timeout to auto-connect
          setTimeout(() => {
            if (confirm('Auto-connect using saved credentials?')) {
              connectionForm.dispatchEvent(new Event('submit'));
            }
          }, 500);
        }
      }
    } catch (error) {
      console.error('Failed to load credentials:', error);
    }
  }
});
