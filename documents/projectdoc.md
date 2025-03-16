# Shopify GraphQL Data Extractor - Project Documentation

## Project Overview

The Shopify GraphQL Data Extractor is a comprehensive web-based tool designed to extract data from Shopify stores using the Shopify Admin GraphQL API. It provides an intuitive user interface for connecting to Shopify stores, discovering available resources, customizing data extraction, and exporting the results in various formats.

## Key Features

- **Interactive Web Interface**: User-friendly GUI for configuring and executing data extractions
- **API Discovery**: Automatically discovers all available Shopify Admin API resources using GraphQL introspection
- **Field Selection**: Allows users to select specific fields to extract, with filtering and categorization
- **Predefined Queries**: Ready-to-use extraction templates for common data types (products, orders, customers)
- **Dependent Queries**: Advanced extraction strategies for complex data relationships
- **Automatic Pagination**: Handles cursor-based pagination for large datasets (up to 250 records per page)
- **Dynamic Query Building**: Generates GraphQL queries based on user selections
- **Schema Caching**: Caches API schema to improve performance and reduce API calls
- **Progress Tracking**: Real-time extraction progress with detailed logs
- **Multiple Export Formats**: Download extracted data as JSON or CSV
- **Error Handling**: Comprehensive error handling for API compatibility and rate limiting
- **Responsive Design**: Mobile-friendly interface with Bootstrap 5 styling
- **CLI Mode**: Command-line interface for automation and scripting

## Architecture

### Frontend Components

- **HTML/CSS/JavaScript**: Pure client-side implementation with Bootstrap 5 for styling
- **UI Components**:
  - Connection Form: For Shopify API credentials
  - Predefined Queries Section: Quick-start templates
  - API Selection: Discovery of available GraphQL resources
  - Field Selection: Customizable field picker with filtering
  - Extraction Progress: Real-time monitoring with logs
  - JSON Viewer: Built-in data viewer with syntax highlighting
  - Dependent Query Modal: Interface for complex extraction patterns

### Backend Components

- **Express Server**: Handles API requests and serves the web interface
- **GraphQL Utilities**:
  - Schema Fetching: Introspection queries to discover API structure
  - Query Building: Dynamic construction of GraphQL queries
  - Pagination: Cursor-based pagination handling
  - Dependent Queries: Multi-stage extraction for complex data types
- **Data Processing**:
  - Data Transformation: Flattening nested structures for export
  - CSV Conversion: Converting JSON to CSV with proper escaping
  - Result Caching: Temporary storage of extracted data
- **Schema Management**:
  - Version Compatibility: Support for different Shopify API versions
  - Schema Caching: Performance optimization through caching
  - Type Analysis: Understanding field types and relationships

## Technical Details

### Core Components

1. **Server Component (`server.js`)**:
   - Express server handling HTTP requests
   - API endpoints for credentials, extraction, and schema management
   - In-memory state management for extraction progress
   - Serves static frontend files

2. **GraphQL Module (`src/graphql.js`)**:
   - Executes GraphQL queries against the Shopify API
   - Handles authentication and error reporting
   - Manages API version compatibility

3. **Schema Utilities (`src/utils/schema.js`)**:
   - Fetches and parses GraphQL schema
   - Identifies field types and relationships
   - Maps resource names to GraphQL types

4. **Query Builder (`src/utils/queryBuilder.js`)**:
   - Dynamically constructs GraphQL queries
   - Handles scalar, object, and connection field types
   - Validates queries against schema

5. **Pagination Handler (`src/utils/pagination.js`)**:
   - Implements cursor-based pagination
   - Merges multiple page results
   - Saves intermediate results for fault tolerance

6. **Schema Versioning (`src/utils/schemaVersioning.js`)**:
   - Caches schema for performance
   - Compares API versions
   - Validates field availability across versions

7. **Dependent Queries (`src/utils/dependentQueries.js`)**:
   - Executes multi-stage extraction processes
   - Manages primary and secondary query execution
   - Handles data merging and relationship mapping

8. **CLI Interface (`src/cli.js`)**:
   - Command-line extraction functionality
   - Support for scripting and automation
   - Progress reporting and error handling

### Frontend Implementation

1. **Main Interface (`public/index.html`)**:
   - Responsive Bootstrap 5 layout
   - Interactive UI components
   - Modals for advanced functionality

2. **Application Logic (`public/app.js`)**:
   - Client-side state management
   - API interaction through fetch API
   - Dynamic UI updates
   - Real-time progress monitoring
   - Data visualization and export

3. **Styling (`public/styles.css`)**:
   - Custom theme extending Bootstrap
   - Shopify-inspired color scheme
   - Responsive design adjustments
   - Component-specific styling

4. **Documentation (`public/dependent-queries-info.html`)**:
   - User documentation for advanced features
   - Code examples and best practices
   - Technical explanation of complex concepts

### API Endpoints

1. **Credentials Management**:
   - `POST /api/credentials`: Save Shopify API credentials
   - `GET /api/test-connection`: Test Shopify API connection

2. **Schema Management**:
   - `GET /api/schema`: Fetch GraphQL schema
   - `GET /api/schema-info`: Get schema cache information
   - `POST /api/clear-schema-cache`: Clear cached schema

3. **Resource Discovery**:
   - `GET /api/resource-fields`: Get fields for a specific resource

4. **Query Building**:
   - `POST /api/validate-query`: Validate predefined queries
   - `POST /api/build-query`: Build custom GraphQL queries

5. **Extraction**:
   - `POST /api/extract`: Start data extraction
   - `GET /api/extraction-status`: Monitor extraction progress
   - `POST /api/dependent-extract`: Start dependent query extraction

6. **Dependent Queries**:
   - `GET /api/dependent-query-templates`: Get available template list

### Predefined Query Templates

The application provides several predefined query templates for common Shopify data:

1. **Products & Variants**:
   - Product details including title, description, handle
   - Images and media
   - Variants with prices and options
   - Inventory information
   - Metafields

2. **Orders & Line Items**:
   - Order details including financial and fulfillment status
   - Customer information
   - Shipping and billing addresses
   - Line items with product information
   - Transactions and payment details

3. **Customers & Addresses**:
   - Customer profile details
   - Contact information
   - Address book
   - Order history summary
   - Tags and metafields

### Dependent Query Templates

For complex data relationships, dependent query templates are provided:

1. **Product Variants**: Detailed information about each product variant
2. **Metafields**: Custom metadata for any Shopify resource
3. **Order Line Items**: Complete line item details for orders
4. **Customer Order History**: Comprehensive order history for customers
5. **Inventory Across Locations**: Inventory levels for all locations
6. **Fulfillment Details**: Shipping and delivery information
7. **Product Collections**: Products organized by collection
8. **Customer Tags**: Tag and segment information
9. **Product Media**: Images and media for products
10. **Order Transactions**: Payment and refund details
11. **Draft Order Conversions**: Tracking draft order to order conversion

## Performance Optimizations

1. **Schema Caching**:
   - The GraphQL schema is cached to reduce API calls
   - Cache includes API version information for compatibility checks
   - Users can manually refresh when needed

2. **Batched Requests**:
   - Dependent queries use batching to reduce request count
   - Configurable batch size balances speed and API limits

3. **Pagination Handling**:
   - Optimized cursor-based pagination for large datasets
   - Progress estimation that adjusts based on discovered page count

4. **Query Optimization**:
   - Dynamic field selection to minimize payload size
   - Selective sub-object requesting based on user needs

5. **Error Recovery**:
   - Incremental saving of extraction results
   - Retry mechanisms for transient failures
   - Fault isolation for individual records

## Data Processing Features

1. **JSON Viewing**:
   - Built-in JSON viewer with syntax highlighting
   - Record count and navigation
   - Copy to clipboard functionality

2. **CSV Conversion**:
   - Automatic flattening of nested objects
   - RFC 4180 compliant escaping
   - Column headers based on field paths
   - UTF-8 BOM for Excel compatibility

3. **Data Filtering**:
   - Field filtering by type (scalar, object, connection)
   - Categorization based on field purpose
   - Search functionality for large schemas
   - Grouping by related fields

## Error Handling

1. **API Compatibility**:
   - Validation against schema to prevent invalid queries
   - Version-specific field checking
   - Graceful degradation for unsupported fields

2. **Rate Limiting**:
   - Automatic delays between requests
   - Progress throttling for large extractions
   - User feedback on API limitations

3. **Connection Issues**:
   - Connection testing before extraction
   - Descriptive error messages for authentication problems
   - Reconnection capabilities

4. **Schema Changes**:
   - Handling of deprecated fields
   - Dynamic query adjustment for schema compatibility
   - Clear user feedback for schema-related issues

## Security Features

1. **Credential Management**:
   - Optional local storage of encrypted credentials
   - Server-side storage in environment variables
   - Access token validation before operations

2. **Data Handling**:
   - All processing happens server-side
   - No third-party data transmission
   - Local file storage of sensitive information

3. **API Restrictions**:
   - Read-only operations by default
   - Scope-limited API tokens
   - No modification of store data

## Integration Capabilities

1. **Command-line Interface**:
   - Scriptable extraction for automation
   - Support for CI/CD pipelines
   - Output to standard formats for further processing

2. **Local File System**:
   - Saving extraction results to local files
   - Support for different file formats (JSON, CSV)
   - Directory organization by resource type

## Development Practices

1. **Code Organization**:
   - Modular architecture with clear separation of concerns
   - Utility functions grouped by purpose
   - Consistent naming conventions

2. **Documentation**:
   - Comprehensive inline code comments
   - Function and parameter documentation
   - User-facing explanations for complex features

3. **Error Handling**:
   - Consistent error patterns
   - Detailed error messages
   - User-friendly error presentation

## Future Enhancements

1. **Additional Export Formats**:
   - Excel (.xlsx) direct export
   - XML export options
   - Custom format templates

2. **Enhanced Query Builder**:
   - Visual query builder interface
   - Query template saving
   - Query sharing capabilities

3. **Data Visualization**:
   - Basic charts and graphs for extracted data
   - Summary statistics and insights
   - Trend visualization

4. **Multi-store Management**:
   - Support for multiple Shopify stores
   - Comparative data extraction
   - Consolidated reporting

5. **Scheduled Extractions**:
   - Time-based automatic extractions
   - Webhook-triggered extractions
   - Differential data updates

## Conclusion

The Shopify GraphQL Data Extractor provides a comprehensive solution for extracting and processing data from Shopify stores. With its intuitive interface, powerful extraction capabilities, and robust error handling, it enables users to efficiently access and utilize their Shopify data for analysis, reporting, and integration purposes. The modular architecture and extensive documentation make it maintainable and extensible for future enhancements.