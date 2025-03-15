# Shopify GraphQL Data Extractor

A web-based tool for extracting data from Shopify using the Admin GraphQL API. This tool provides an intuitive interface for connecting to your Shopify store, discovering available resources, and extracting data with customizable field selection.

## Features

- Interactive web UI for configuring and running extractions
- Automatically discovers all available Shopify Admin API resources
- Select specific fields to extract from each resource
- Handles pagination automatically (max 250 records per page)
- Real-time extraction progress display
- Save credentials for easy reconnection
- Download extracted data as JSON

## Requirements

- Node.js 14.x or higher
- Shopify Admin API access
- Shopify API credentials (Client ID and Access Token)

## Installation

1. Clone this repository or download the source code
2. Install dependencies:

```bash
npm install
```

3. Set up your environment variables:

```bash
# Run the setup script (interactive)
node setup.js

# Or manually create a .env file based on .env.example
```

## Usage

### Starting the Web Interface

Run the application server:

```bash
npm start
```

Then open your browser and navigate to [http://localhost:3000](http://localhost:3000)

### Using the Interface

1. **Connect to Shopify**:
   - Enter your store name (without '.myshopify.com')
   - Enter your API Key / Client ID
   - Enter your Access Token
   - Click "Connect to Shopify"

2. **Select an API Resource**:
   - After connecting, click "Fetch Available APIs"
   - Browse the list of available resources (products, customers, orders, inventory, etc.)
   - Click on a resource to select it

3. **Choose Fields to Extract**:
   - Select the specific fields you want to extract
   - Use "Select All Fields" to choose everything
   - Click "Extract Selected Data"

4. **Monitor Extraction**:
   - Watch the real-time progress
   - View extraction logs
   - When complete, click "Download Extracted Data"

## How Pagination Works

The tool automatically handles pagination for large datasets following Shopify's guidelines:

- Uses a maximum of 250 records per page (Shopify's limit)
- Follows the GraphQL cursor-based pagination pattern
- Automatically requests the next page when more data is available
- Consolidates all pages into a single result

## CLI Mode

You can also use the command-line interface for scripts and automation:

```bash
# General extraction tool
npm run cli all

# Extract specific resources
npm run cli:products
npm run cli:customers
npm run cli:orders
```

## Project Structure

### Core Files

- `server.js` - Main Express server that handles API requests and serves the web interface
- `setup.js` - Interactive setup script for configuring Shopify API credentials
- `package.json` - Project dependencies and npm scripts

### Frontend

- `public/index.html` - Main HTML file for the web interface
- `public/app.js` - Frontend JavaScript for the web application
- `public/styles.css` - CSS styles for the web interface

### Backend

- `src/cli.js` - Command-line interface for running extractions without the web UI
- `src/index.js` - Core functionality shared between web and CLI interfaces
- `src/graphql.js` - GraphQL query builder and API interaction utilities
- `src/queries/` - Directory containing predefined GraphQL queries for different resources
- `src/utils/` - Utility functions for data processing and API interaction

### Configuration

- `.env` - Environment variables for Shopify API credentials (not committed to git)
- `.env.example` - Example environment variables file
- `.gitignore` - Specifies files that should not be tracked by git

### Data Storage

- `data/` - Directory where extracted data is saved as JSON files

## How It Works

1. **Authentication**: The application uses Shopify's Admin API access token for authentication
2. **API Discovery**: Uses GraphQL introspection to discover available resources
3. **Query Building**: Dynamically builds GraphQL queries based on selected resources and fields
4. **Pagination**: Implements cursor-based pagination to handle large datasets
5. **Data Processing**: Processes and formats the extracted data for download

## Customization

You can customize the extraction process by:

1. Modifying predefined queries in the `src/queries/` directory
2. Adjusting the pagination settings in `server.js`
3. Adding new resource types or field mappings

## Troubleshooting

If you encounter issues:

- Check your API credentials and permissions
- Ensure your Shopify Admin API is enabled
- Look for error messages in the browser console and server logs
- Verify that your API version is supported (defaults to 2025-01)

## License

MIT
