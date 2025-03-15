/**
 * GraphQL query to fetch orders from Shopify Admin API
 */
const orderQuery = `
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
    }
  }
`;

module.exports = {
  orderQuery,
  variables: {
    first: 50, // Adjust based on your needs
    after: null, // For pagination
  }
};