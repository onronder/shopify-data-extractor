/**
 * GraphQL query to fetch products from Shopify Admin API
 */
const productQuery = `
  query GetProducts($first: Int!, $after: String) {
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
          createdAt
          updatedAt
          productType
          vendor
          status
          tags
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
          images(first: 5) {
            edges {
              node {
                id
                url
                altText
              }
            }
          }
          variants(first: 10) {
            edges {
              node {
                id
                title
                sku
                price
                compareAtPrice
                inventoryQuantity
                availableForSale
                taxable
                selectedOptions {
                  name
                  value
                }
              }
            }
          }
          metafields(first: 10) {
            edges {
              node {
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
  }
`;

module.exports = {
  productQuery,
  variables: {
    first: 50, // Adjust based on your needs
    after: null, // For pagination
  }
};