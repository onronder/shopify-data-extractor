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
          createdAt
          updatedAt
          cancelledAt
          cancelReason
          closed
          confirmed
          test
          totalPrice
          totalDiscounts
          totalTax
          subtotalPrice
          totalShippingPrice
          currencyCode
          fulfillmentStatus
          financialStatus
          processedAt
          tags
          customer {
            id
            email
            firstName
            lastName
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
          }
          lineItems(first: 20) {
            edges {
              node {
                id
                title
                quantity
                originalTotalPrice
                discountedTotalPrice
                variant {
                  id
                  sku
                  title
                  price
                }
                product {
                  id
                  title
                  handle
                }
              }
            }
          }
          transactions(first: 5) {
            edges {
              node {
                id
                status
                test
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
  }
`;

module.exports = {
  orderQuery,
  variables: {
    first: 50, // Adjust based on your needs
    after: null, // For pagination
  }
};
