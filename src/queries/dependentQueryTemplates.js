/**
 * Templates for Shopify Dependent Query Scenarios
 */

// 1. Product Variants
const productVariantsTemplate = {
  name: 'product-variants',
  label: 'Product Variants',
  description: 'Extract detailed variant information including inventory, prices, and options.',
  help: 'First fetches products, then queries each variant individually.',
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

// 2. Metafields
const metafieldsTemplate = {
  name: 'metafields',
  label: 'Metafields',
  description: 'Extract metafields for products, orders, customers, etc.',
  help: 'First fetches resources, then queries metafields for each item.',
  primaryQuery: `
    query GetProductsForMetafields($first: Int!, $after: String) {
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
  buildSecondaryQuery: (productId) => ({
    query: `
      query GetProductMetafields($id: ID!) {
        product(id: $id) {
          id
          metafields(first: 20) {
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
    `,
    variables: { id: productId }
  }),
  idExtractor: (products) => {
    return products.map(product => product.id);
  },
  resultMerger: (products, metafieldResults) => {
    // Create a map of metafields by product ID
    const metafieldMap = {};
    metafieldResults.forEach(result => {
      if (result.product) {
        metafieldMap[result.product.id] = result.product.metafields.edges.map(edge => edge.node);
      }
    });
    
    // Merge metafields into products
    return products.map(product => {
      return {
        ...product,
        detailedMetafields: metafieldMap[product.id] || []
      };
    });
  }
};

// 3. Order Line Items
const orderLineItemsTemplate = {
  name: 'order-line-items',
  label: 'Order Line Items',
  description: 'Extract detailed line item information for orders.',
  help: 'Useful for orders with many line items that exceed pagination limits.',
  primaryQuery: `
    query GetOrdersForLineItems($first: Int!, $after: String) {
      orders(first: $first, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            name
            createdAt
            displayFinancialStatus
            displayFulfillmentStatus
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
  `,
  buildSecondaryQuery: (orderId) => ({
    query: `
      query GetOrderLineItems($id: ID!) {
        order(id: $id) {
          id
          lineItems(first: 250) {
            edges {
              node {
                id
                title
                quantity
                originalTotalSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                discountedTotalSet {
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
                  }
                }
              }
            }
          }
        }
      }
    `,
    variables: { id: orderId }
  }),
  idExtractor: (orders) => {
    return orders.map(order => order.id);
  },
  resultMerger: (orders, lineItemResults) => {
    // Create a map of line items by order ID
    const lineItemMap = {};
    lineItemResults.forEach(result => {
      if (result.order) {
        lineItemMap[result.order.id] = result.order.lineItems.edges.map(edge => edge.node);
      }
    });
    
    // Merge line items into orders
    return orders.map(order => {
      return {
        ...order,
        detailedLineItems: lineItemMap[order.id] || []
      };
    });
  }
};

// 4. Customer Order History
const customerOrderHistoryTemplate = {
  name: 'customer-order-history',
  label: 'Customer Order History',
  description: 'Extract complete order history for customers.',
  help: 'Analyze customer lifetime value, purchase frequency, and buying patterns.',
  primaryQuery: `
    query GetCustomersForOrderHistory($first: Int!, $after: String) {
      customers(first: $first, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            email
            firstName
            lastName
            displayName
            # ordersCount and totalSpent fields removed - not available in all API versions
          }
        }
      }
    }
  `,
  buildSecondaryQuery: (customerId) => ({
    query: `
      query GetCustomerOrders($id: ID!) {
        customer(id: $id) {
          id
          orders(first: 250) {
            edges {
              node {
                id
                name
                processedAt
                displayFinancialStatus
                displayFulfillmentStatus
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
                totalTaxSet {
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
              }
            }
          }
        }
      }
    `,
    variables: { id: customerId }
  }),
  idExtractor: (customers) => {
    return customers.map(customer => customer.id);
  },
  resultMerger: (customers, orderResults) => {
    // Create a map of orders by customer ID
    const orderMap = {};
    orderResults.forEach(result => {
      if (result.customer && result.customer.orders) {
        orderMap[result.customer.id] = result.customer.orders.edges.map(edge => edge.node);
      }
    });
    
    // Merge orders into customers
    return customers.map(customer => {
      return {
        ...customer,
        detailedOrders: orderMap[customer.id] || []
      };
    });
  }
};

// 5. Inventory Across Locations
const inventoryAcrossLocationsTemplate = {
  name: 'inventory-across-locations',
  label: 'Inventory Across Locations',
  description: 'Extract inventory levels for all items across all locations.',
  help: 'Complete inventory visibility across multiple store locations.',
  primaryQuery: `
    query GetLocationsAndInventoryItems($first: Int!, $after: String) {
      locations(first: $first) {
        edges {
          node {
            id
            name
            isActive
          }
        }
      }
      inventoryItems(first: $first, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            sku
            tracked
            variant {
              id
              displayName
              product {
                id
                title
              }
            }
          }
        }
      }
    }
  `,
  buildSecondaryQuery: (inventoryItemId) => ({
    query: `
      query GetInventoryLevels($id: ID!) {
        inventoryItem(id: $id) {
          id
          inventoryLevels(first: 20) {
            edges {
              node {
                id
                quantity
                location {
                  id
                  name
                }
              }
            }
          }
        }
      }
    `,
    variables: { id: inventoryItemId }
  }),
  idExtractor: (data) => {
    // Extract inventory item IDs
    if (data[0] && data[0].inventoryItems && data[0].inventoryItems.edges) {
      return data[0].inventoryItems.edges.map(edge => edge.node.id);
    }
    
    // For paginated results, this will be a flat array of inventory items
    return data.map(item => item.id);
  },
  resultMerger: (primaryData, inventoryLevelResults) => {
    // Extract locations and inventory items from primary data
    let locations = [];
    let inventoryItems = [];
    
    if (primaryData[0] && primaryData[0].locations) {
      // First page of results
      locations = primaryData[0].locations.edges.map(edge => edge.node);
      inventoryItems = primaryData[0].inventoryItems.edges.map(edge => edge.node);
    } else {
      // Handle pagination (location data will be in first page only)
      inventoryItems = primaryData;
    }
    
    // Create map of inventory levels by inventory item ID
    const inventoryLevelMap = {};
    inventoryLevelResults.forEach(result => {
      if (result.inventoryItem && result.inventoryItem.inventoryLevels) {
        inventoryLevelMap[result.inventoryItem.id] = result.inventoryItem.inventoryLevels.edges.map(edge => edge.node);
      }
    });
    
    // Merge inventory levels into inventory items
    const enrichedInventoryItems = inventoryItems.map(item => {
      return {
        ...item,
        inventoryLevels: inventoryLevelMap[item.id] || []
      };
    });
    
    return {
      locations,
      inventoryItems: enrichedInventoryItems
    };
  }
};

// 6. Fulfillment Details
const fulfillmentDetailsTemplate = {
  name: 'fulfillment-details',
  label: 'Fulfillment Details',
  description: 'Extract detailed fulfillment information for orders.',
  help: 'Analyze shipping performance, fulfillment times, and delivery issues.',
  primaryQuery: `
    query GetOrdersForFulfillments($first: Int!, $after: String) {
      orders(first: $first, after: $after, query: "fulfillment_status:partial OR fulfillment_status:fulfilled") {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            name
            createdAt
            displayFulfillmentStatus
          }
        }
      }
    }
  `,
  buildSecondaryQuery: (orderId) => ({
    query: `
      query GetOrderFulfillments($id: ID!) {
        order(id: $id) {
          id
          fulfillments(first: 20) {
            edges {
              node {
                id
                status
                createdAt
                updatedAt
                trackingInfo {
                  company
                  number
                  url
                }
                deliveredAt
                estimatedDeliveryAt
                shipmentStatus
                service
                totalQuantity
                lineItems(first: 10) {
                  edges {
                    node {
                      id
                      title
                      quantity
                    }
                  }
                }
              }
            }
          }
        }
      }
    `,
    variables: { id: orderId }
  }),
  idExtractor: (orders) => {
    return orders.map(order => order.id);
  },
  resultMerger: (orders, fulfillmentResults) => {
    // Create a map of fulfillments by order ID
    const fulfillmentMap = {};
    fulfillmentResults.forEach(result => {
      if (result.order && result.order.fulfillments) {
        fulfillmentMap[result.order.id] = result.order.fulfillments.edges.map(edge => edge.node);
      }
    });
    
    // Merge fulfillments into orders
    return orders.map(order => {
      return {
        ...order,
        detailedFulfillments: fulfillmentMap[order.id] || []
      };
    });
  }
};

// 7. Product Collections
const productCollectionsTemplate = {
  name: 'product-collections',
  label: 'Product Collections',
  description: 'Extract all products within each collection.',
  help: 'Analyze collection performance and product categorization.',
  primaryQuery: `
    query GetCollections($first: Int!, $after: String) {
      collections(first: $first, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            title
            handle
            productsCount {
          count
        }
            updatedAt
          }
        }
      }
    }
  `,
  buildSecondaryQuery: (collectionId) => ({
    query: `
      query GetCollectionProducts($id: ID!) {
        collection(id: $id) {
          id
          products(first: 250) {
            pageInfo {
              hasNextPage
              endCursor
            }
            edges {
              node {
                id
                title
                handle
                productType
                vendor
                publishedAt
                images(first: 1) {
                  edges {
                    node {
                      id
                      url
                    }
                  }
                }
                variants(first: 1) {
                  edges {
                    node {
                      id
                      price
                    }
                  }
                }
              }
            }
          }
        }
      }
    `,
    variables: { id: collectionId }
  }),
  idExtractor: (collections) => {
    return collections.map(collection => collection.id);
  },
  resultMerger: (collections, productResults) => {
    // Create a map of products by collection ID
    const productMap = {};
    productResults.forEach(result => {
      if (result.collection && result.collection.products) {
        productMap[result.collection.id] = result.collection.products.edges.map(edge => edge.node);
      }
    });
    
    // Merge products into collections
    return collections.map(collection => {
      return {
        ...collection,
        detailedProducts: productMap[collection.id] || []
      };
    });
  }
};

// 8. Discount Usage (DISABLED - Not compatible with all API versions)
const discountUsageTemplate = {
  name: 'discount-usage',
  label: 'Discount Usage',
  description: 'Extract discount codes and usage statistics for each price rule.',
  help: 'Measure promotion effectiveness and discount usage patterns. Note: This template may not be compatible with all API versions as priceRules field is not available in some versions.',
  primaryQuery: `
    query GetPriceRules($first: Int!, $after: String) {
      priceRules(first: $first, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            title
            target
            startsAt
            endsAt
            status
            valueType
            value
          }
        }
      }
    }
  `,
  buildSecondaryQuery: (priceRuleId) => ({
    query: `
      query GetDiscountCodes($id: ID!) {
        priceRule(id: $id) {
          id
          discountCodes(first: 50) {
            edges {
              node {
                id
                code
                usageCount
                createdAt
              }
            }
          }
        }
      }
    `,
    variables: { id: priceRuleId }
  }),
  idExtractor: (priceRules) => {
    return priceRules.map(rule => rule.id);
  },
  resultMerger: (priceRules, discountResults) => {
    // Create a map of discount codes by price rule ID
    const discountMap = {};
    discountResults.forEach(result => {
      if (result.priceRule && result.priceRule.discountCodes) {
        discountMap[result.priceRule.id] = result.priceRule.discountCodes.edges.map(edge => edge.node);
      }
    });
    
    // Merge discount codes into price rules
    return priceRules.map(rule => {
      return {
        ...rule,
        detailedDiscountCodes: discountMap[rule.id] || []
      };
    });
  }
};

// 9. Customer Tags & Segments
const customerTagsTemplate = {
  name: 'customer-tags',
  label: 'Customer Tags & Segments',
  description: 'Extract detailed tag and segment information for customers.',
  help: 'Analyze customer segmentation and targeting effectiveness.',
  primaryQuery: `
    query GetCustomersForTags($first: Int!, $after: String) {
      customers(first: $first, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            email
            firstName
            lastName
            displayName
            tags
          }
        }
      }
    }
  `,
  buildSecondaryQuery: (customerId) => ({
    query: `
      query GetCustomerTagDetails($id: ID!) {
        customer(id: $id) {
          id
          metafields(first: 50, namespace: "customer") {
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
    `,
    variables: { id: customerId }
  }),
  idExtractor: (customers) => {
    return customers.map(customer => customer.id);
  },
  resultMerger: (customers, tagResults) => {
    // Create a map of tag metafields by customer ID
    const tagMetafieldMap = {};
    tagResults.forEach(result => {
      if (result.customer && result.customer.metafields) {
        tagMetafieldMap[result.customer.id] = result.customer.metafields.edges.map(edge => edge.node);
      }
    });
    
    // Merge tag metafields into customers
    return customers.map(customer => {
      // Parse tags into a more useful format if possible
      let parsedTags = [];
      if (customer.tags) {
        if (typeof customer.tags === 'string') {
          parsedTags = customer.tags.split(',').map(tag => tag.trim());
        } else if (Array.isArray(customer.tags)) {
          parsedTags = customer.tags;
        }
      }
      
      return {
        ...customer,
        parsedTags,
        detailedTagMetafields: tagMetafieldMap[customer.id] || []
      };
    });
  }
};

// 10. Product Media & Images
const productMediaTemplate = {
  name: 'product-media',
  label: 'Product Media & Images',
  description: 'Extract all media and images for each product.',
  help: 'Analyze product presentation completeness and quality.',
  primaryQuery: `
    query GetProductsForMedia($first: Int!, $after: String) {
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
          }
        }
      }
    }
  `,
  buildSecondaryQuery: (productId) => ({
    query: `
      query GetProductMedia($id: ID!) {
        product(id: $id) {
          id
          images(first: 50) {
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
          media(first: 50) {
            edges {
              node {
                id
                mediaContentType
                preview {
                  image {
                    url
                  }
                }
                status
              }
            }
          }
        }
      }
    `,
    variables: { id: productId }
  }),
  idExtractor: (products) => {
    return products.map(product => product.id);
  },
  resultMerger: (products, mediaResults) => {
    // Create maps of images and media by product ID
    const mediaMap = {};
    mediaResults.forEach(result => {
      if (result.product) {
        mediaMap[result.product.id] = {
          images: result.product.images ? result.product.images.edges.map(edge => edge.node) : [],
          media: result.product.media ? result.product.media.edges.map(edge => edge.node) : []
        };
      }
    });
    
    // Merge media into products
    return products.map(product => {
      const productMedia = mediaMap[product.id] || { images: [], media: [] };
      
      return {
        ...product,
        detailedImages: productMedia.images,
        detailedMedia: productMedia.media
      };
    });
  }
};

// 11. Order Transactions
const orderTransactionsTemplate = {
  name: 'order-transactions',
  label: 'Order Transactions',
  description: 'Extract detailed transaction history for each order.',
  help: 'Analyze payment methods, refunds, and transaction issues.',
  primaryQuery: `
    query GetOrdersForTransactions($first: Int!, $after: String) {
      orders(first: $first, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            name
            createdAt
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
  `,
  buildSecondaryQuery: (orderId) => ({
    query: `
      query GetOrderTransactions($id: ID!) {
        order(id: $id) {
          id
          transactions {
            id
            status
            kind
            gateway
            test
            amountSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            # Removed paymentDetails as it's a union type that requires special handling
            createdAt
            formattedGateway
            parentTransaction {
              id
              kind
            }
          }
        }
      }
    `,
    variables: { id: orderId }
  }),
  idExtractor: (orders) => {
    return orders.map(order => order.id);
  },
  resultMerger: (orders, transactionResults) => {
    // Create a map of transactions by order ID
    const transactionMap = {};
    transactionResults.forEach(result => {
      if (result.order && result.order.transactions) {
        transactionMap[result.order.id] = result.order.transactions;
      }
    });
    
    // Merge transactions into orders
    return orders.map(order => {
      return {
        ...order,
        detailedTransactions: transactionMap[order.id] || []
      };
    });
  }
};

// 12. Draft Order Conversions
const draftOrdersTemplate = {
  name: 'draft-orders',
  label: 'Draft Order Conversions',
  description: 'Track which draft orders converted to actual orders.',
  help: 'Analyze sales process efficiency and abandoned cart recovery.',
  primaryQuery: `
    query GetDraftOrders($first: Int!, $after: String) {
      draftOrders(first: $first, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            name
            status
            createdAt
            updatedAt
            totalPrice
            customer {
              id
              email
              displayName
            }
          }
        }
      }
    }
  `,
  buildSecondaryQuery: (draftOrderId) => ({
    query: `
      query GetDraftOrderDetails($id: ID!) {
        draftOrder(id: $id) {
          id
          completedAt
          # invoice field removed - not available in all API versions
          order {
            id
            name
            createdAt
            displayFinancialStatus
            displayFulfillmentStatus
            totalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
          }
          lineItems(first: 10) {
            edges {
              node {
                id
                title
                quantity
                variantTitle
              }
            }
          }
        }
      }
    `,
    variables: { id: draftOrderId }
  }),
  idExtractor: (draftOrders) => {
    return draftOrders.map(draftOrder => draftOrder.id);
  },
  resultMerger: (draftOrders, detailResults) => {
    // Create a map of draft order details by ID
    const detailMap = {};
    detailResults.forEach(result => {
      if (result.draftOrder) {
        detailMap[result.draftOrder.id] = {
          completedAt: result.draftOrder.completedAt,
          // invoice removed since field is not available in all API versions
          order: result.draftOrder.order,
          lineItems: result.draftOrder.lineItems ? result.draftOrder.lineItems.edges.map(edge => edge.node) : []
        };
      }
    });
    
    // Merge details into draft orders
    return draftOrders.map(draftOrder => {
      const details = detailMap[draftOrder.id] || {};
      
      return {
        ...draftOrder,
        completedAt: details.completedAt,
        // invoice removed since field is not available in all API versions
        convertedOrder: details.order,
        detailedLineItems: details.lineItems || []
      };
    });
  }
};

// Export all templates
const dependentQueryTemplates = {
  'product-variants': productVariantsTemplate,
  'metafields': metafieldsTemplate,
  'order-line-items': orderLineItemsTemplate,
  'customer-order-history': customerOrderHistoryTemplate,
  'inventory-across-locations': inventoryAcrossLocationsTemplate,
  'fulfillment-details': fulfillmentDetailsTemplate,
  'product-collections': productCollectionsTemplate,
  'discount-usage': discountUsageTemplate,
  'customer-tags': customerTagsTemplate,
  'product-media': productMediaTemplate,
  'order-transactions': orderTransactionsTemplate,
  'draft-orders': draftOrdersTemplate
};

// Get template by name
function getQueryTemplate(name) {
  return dependentQueryTemplates[name];
}

// Get all template names
function getAllTemplateNames() {
  return Object.keys(dependentQueryTemplates);
}

// Get template list with basic info for UI
function getTemplateList() {
  return Object.values(dependentQueryTemplates)
    .filter(template => template.name !== 'discount-usage') // Filter out incompatible templates
    .map(template => ({
      name: template.name,
      label: template.label,
      description: template.description,
      help: template.help
    }));
}

module.exports = {
  getQueryTemplate,
  getAllTemplateNames,
  getTemplateList,
  dependentQueryTemplates
};