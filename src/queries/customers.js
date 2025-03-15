/**
 * GraphQL query to fetch customers from Shopify Admin API
 */
const customerQuery = `
  query GetCustomers($first: Int!, $after: String) {
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
          state
          taxExempt
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
  }
`;

module.exports = {
  customerQuery,
  variables: {
    first: 50, // Adjust based on your needs
    after: null, // For pagination
  }
};