# Changelog

All notable user-visible changes to this project are documented in this file. The project follows Semantic Versioning.

## Unreleased

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
