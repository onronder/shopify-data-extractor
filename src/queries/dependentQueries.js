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
  // Primary query to fetch resources and their IDs
  primaryQuery: `
    query GetResourcesWithIds($first: Int!, $after: String) {
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
          }
        }
      }
    }
  `,
  
  // Function to build secondary query for metafields
  buildSecondaryQuery: (resourceId) => ({
    query: `
      query GetMetafields($id: ID!) {
        product(id: $id) {
          id
          metafields(first: 50) {
            edges {
              node {
                id
                namespace
                key
                value
                type
                description
                createdAt
                updatedAt
              }
            }
          }
        }
      }
    `,
    variables: { id: resourceId }
  }),
  
  // Function to extract resource IDs
  idExtractor: (resources) => {
    return resources.map(resource => resource.id);
  },
  
  // Function to merge resources with metafields
  resultMerger: (resources, metafieldResults) => {
    // Create a map of metafields by resource ID
    const metafieldMap = {};
    metafieldResults.forEach(result => {
      if (result.product && result.product.id) {
        metafieldMap[result.product.id] = 
          result.product.metafields?.edges?.map(edge => edge.node) || [];
      }
    });
    
    // Merge metafields into resources
    return resources.map(resource => {
      const resourceMetafields = metafieldMap[resource.id] || [];
      
      return {
        ...resource,
        detailedMetafields: resourceMetafields
      };
    });
  }
};

// Order Line Items Query Templates
const orderLineItemQueries = {
  // Primary query to fetch orders with basic information
  primaryQuery: `
    query GetOrders($first: Int!, $after: String) {
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
            processedAt
            totalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            displayFinancialStatus
            displayFulfillmentStatus
          }
        }
      }
    }
  `,
  
  // Function to build secondary query for detailed order information
  buildSecondaryQuery: (orderId) => ({
    query: `
      query GetOrderDetails($id: ID!) {
        order(id: $id) {
          id
          lineItems(first: 50) {
            edges {
              node {
                id
                title
                quantity
                sku
                variant {
                  id
                  title
                  sku
                  price
                  barcode
                  inventoryQuantity
                  selectedOptions {
                    name
                    value
                  }
                  product {
                    id
                    title
                    handle
                  }
                }
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
                discountAllocations {
                  allocatedAmount {
                    amount
                    currencyCode
                  }
                  discountApplication {
                    targetType
                    targetSelection
                    allocationMethod
                    value {
                      ... on MoneyV2 {
                        amount
                        currencyCode
                      }
                      ... on PricingPercentageValue {
                        percentage
                      }
                    }
                  }
                }
              }
            }
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
          }
          transactions {
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
    `,
    variables: { id: orderId }
  }),
  
  // Function to extract order IDs
  idExtractor: (orders) => {
    return orders.map(order => order.id);
  },
  
  // Function to merge orders with detailed information
  resultMerger: (orders, orderDetails) => {
    // Create a map of order details by ID
    const orderDetailsMap = {};
    orderDetails.forEach(result => {
      if (result.order && result.order.id) {
        orderDetailsMap[result.order.id] = result.order;
      }
    });
    
    // Merge details into orders
    return orders.map(order => {
      const details = orderDetailsMap[order.id];
      
      if (!details) {
        return order;
      }
      
      return {
        ...order,
        lineItems: details.lineItems,
        shippingAddress: details.shippingAddress,
        transactions: details.transactions
      };
    });
  }
};

module.exports = {
  productVariantQueries,
  metafieldQueries,
  orderLineItemQueries
};