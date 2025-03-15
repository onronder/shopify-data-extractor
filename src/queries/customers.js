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
          email
          firstName
          lastName
          phone
          createdAt
          updatedAt
          defaultAddress {
            address1
            address2
            city
            company
            country
            countryCodeV2
            firstName
            lastName
            phone
            province
            provinceCode
            zip
          }
          addresses(first: 5) {
            edges {
              node {
                address1
                address2
                city
                company
                country
                countryCodeV2
                firstName
                lastName
                phone
                province
                provinceCode
                zip
                formatted
              }
            }
          }
          orders(first: 5) {
            edges {
              node {
                id
                name
                createdAt
                totalPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                fulfillmentStatus
                financialStatus
                processedAt
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
          tags
          note
          acceptsMarketing
          acceptsMarketingUpdatedAt
          state
          taxExempt
          verifiedEmail
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
