# waveapps-cli

A dependency-free Node.js CLI for listing Wave records and creating customers, sellable products, and invoices from the terminal. It uses Wave's public GraphQL API and reads a personal full-access token from the environment.

## Requirements

- Node.js 18 or newer
- A Wave full-access token in `WAVEAPPS_FULL_ACCESS_TOKEN`

The client ID and client secret are not needed for a CLI that only accesses your own Wave account.

## Install

From this directory:

```sh
npm link
```

Add the token to `.zshrc` without putting it in this repository:

```sh
export WAVEAPPS_FULL_ACCESS_TOKEN="your-token"
```

Open a new terminal afterward, or load it into the current interactive shell with `source ~/.zshrc`. Confirm that the variable exists without printing its secret value:

```sh
test -n "$WAVEAPPS_FULL_ACCESS_TOKEN" && echo "Wave token is set"
```

Do not paste the token into command arguments, logs, invoice files, or committed configuration.

## Command reference

```text
waveapps businesses
waveapps customers --business BUSINESS_ID
waveapps customers create --business ID --name NAME [--email EMAIL] [--currency USD] [--submit]
waveapps products --business BUSINESS_ID
waveapps products create --business ID --name NAME --price PRICE --income-account ID [--description TEXT] [--submit]
waveapps accounts --business BUSINESS_ID
waveapps invoices create --file invoice.json [--submit]
waveapps help
```

Every create command is a dry run by default. It displays the exact API input and makes no Wave mutation until `--submit` is supplied.

## Find Wave IDs

```sh
waveapps businesses
waveapps customers --business BUSINESS_ID
waveapps products --business BUSINESS_ID
waveapps accounts --business BUSINESS_ID
```

The `customers` and `products` list commands show the IDs needed in invoice JSON. `products` shows active sellable products. The `accounts` command lists valid active income accounts needed to create a sellable product.

## Create customers and products

Preview a new customer, then create it:

```sh
waveapps customers create --business BUSINESS_ID --name "Jane Example"
waveapps customers create --business BUSINESS_ID --name "Jane Example" --submit
```

Optional customer fields are `--email` and `--currency`.

Find an income account with `waveapps accounts --business BUSINESS_ID`, then preview and create a product:

```sh
waveapps products create --business BUSINESS_ID --name "On-Site IT Support" --price 80.00 --income-account INCOME_ACCOUNT_ID --description "Hourly support at discounted rate"
waveapps products create --business BUSINESS_ID --name "On-Site IT Support" --price 80.00 --income-account INCOME_ACCOUNT_ID --description "Hourly support at discounted rate" --submit
```

Customer and product creation are dry runs unless `--submit` is present.

For reimbursements, create separate products if you want them to appear as distinct invoice lines:

```sh
waveapps products create --business BUSINESS_ID --name "Parking Reimbursement" --price 17.00 --income-account INCOME_ACCOUNT_ID --submit
waveapps products create --business BUSINESS_ID --name "NYC Congestion Fee Reimbursement" --price 9.00 --income-account INCOME_ACCOUNT_ID --submit
```

Choose the income account that matches your bookkeeping practice. If Wave has no dedicated reimbursed-expense income account, confirm the appropriate account with your accountant.

## Build an invoice file

Copy `examples/invoice.json`, then replace its placeholder IDs and edit the invoice fields. Each line item must reference an existing Wave product or service. `description`, `quantity`, and `unitPrice` can override the product defaults.

For example, three hours at an $80 hourly rate plus $17 and $9 reimbursements can be represented as:

```json
{
  "businessId": "BUSINESS_ID",
  "customerId": "CUSTOMER_ID",
  "status": "DRAFT",
  "invoiceDate": "2026-01-15",
  "dueDate": "2026-02-14",
  "title": "IT Support",
  "items": [
    {
      "productId": "IT_SUPPORT_PRODUCT_ID",
      "description": "On-site IT support and account setup",
      "quantity": "3",
      "unitPrice": "80.00"
    },
    {
      "productId": "PARKING_PRODUCT_ID",
      "quantity": "1",
      "unitPrice": "17.00"
    },
    {
      "productId": "CONGESTION_FEE_PRODUCT_ID",
      "quantity": "1",
      "unitPrice": "9.00"
    }
  ]
}
```

This example totals $266 before any taxes configured in Wave. Use current dates and IDs rather than copying the placeholders literally.

## Preview and create an invoice

Previewing is the default and does not contact the invoice mutation:

```sh
waveapps invoices create --file my-invoice.json
```

After reviewing the exact input, explicitly submit it:

```sh
waveapps invoices create --file my-invoice.json --submit
```

Use `"status": "DRAFT"` while testing. `"SAVED"` approves/saves the invoice in Wave. This command creates an invoice but does not email it.

## Safety and limitations

- `--submit` creates a real record in Wave; there is no CLI delete command.
- Invoice creation does not email the invoice or charge the customer.
- Customer creation supports name, email, and currency. Add addresses or other details in Wave afterward.
- Product creation requires an income-account ID so the product is sellable and usable on an invoice.
- Lookup commands currently return the first 100 records of each type.
- The CLI never needs `WAVEAPPS_CLIENT_ID` or `WAVEAPPS_CLIENT_SECRET` for personal full-access-token use.

## Development

```sh
npm test
npm run check
```

The tests use mocked HTTP responses and never access Wave.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow and [SECURITY.md](SECURITY.md) for reporting security issues.

## API documentation

- [Create invoice](https://developer.waveapps.com/hc/en-us/articles/360038817812-Mutation-Create-invoice)
- [Create customer](https://developer.waveapps.com/hc/en-us/articles/360032569232-Mutation-Create-customer)
- [Create product/service](https://developer.waveapps.com/hc/en-us/articles/360033284492-Mutation-Create-product-service)
- [Wave API reference](https://developer.waveapps.com/hc/en-us/articles/360019968212-API-Reference)
