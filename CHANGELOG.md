# Changelog

All notable user-visible changes to this project are documented in this file. The project follows Semantic Versioning.

## Unreleased

### Added

- Estimate creation defaults to a 30-day validity period with explicit date overrides.
- Draft-only `estimates update` command that preserves the complete estimate before applying a text or validity-date patch.

- Dry-run-by-default `estimates create --file estimate.json` command with draft-only creation, line-item validation, and quote fields through Wave’s `estimateCreate` mutation.
- Example estimate input and usage documentation.

## 0.4.0 - 2026-09-09

### Added

- Dry-run-by-default `products rename` command backed by Wave's `productPatch` mutation.
- Dry-run-by-default `products delete` command that safely archives products through Wave's `productArchive` mutation.

## 0.3.0 - 2026-08-28

### Added

- Dry-run-by-default `invoices update` command for applying a JSON `InvoicePatchInput` to an invoice found by exact number.
- Example invoice update with replacement items and a fixed service discount.

## 0.2.0 - 2026-08-28

### Added

- Custom invoice numbers during creation through the `invoiceNumber` JSON field.
- Dry-run-by-default `invoices set-number` command for changing an existing invoice number by exact match.
- Invoice-numbering documentation.

## 0.1.0 - 2026-08-28

### Added

- Dependency-free Node.js CLI authenticated with `WAVEAPPS_FULL_ACCESS_TOKEN`.
- Commands for listing Wave businesses, customers, sellable products, and income accounts.
- Dry-run-by-default commands for creating customers, products, and invoices.
- JSON invoice validation and explicit `--submit` safeguards for Wave mutations.
- Mocked test suite that never contacts Wave.
- Public-repository documentation, CI across supported Node.js versions, and dependency-free secret scanning.
