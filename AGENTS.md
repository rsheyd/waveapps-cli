# Project guidance

- Keep the CLI dependency-free unless a dependency materially improves the user experience.
- Never log, persist, or include Wave access tokens in errors.
- Customer, product, and invoice creation must remain a dry run unless the user explicitly supplies `--submit`.
- Keep Markdown paragraphs and list items on single physical lines.

## Versioning and changelog

- Use Semantic Versioning, with `package.json` as the version source of truth and Git tags formatted as `vX.Y.Z`.
- Before 1.0, use patch releases for backward-compatible fixes and minor releases for new features or backward-incompatible CLI changes.
- Release 1.0.0 when the command-line interface and invoice input format are considered stable; after 1.0, reserve major releases for backward-incompatible changes.
- Record user-visible changes in `CHANGELOG.md` under `Unreleased`, then move them into a dated version section when releasing.
- Tests, internal refactors, and documentation-only changes do not require changelog entries unless they change user-facing behavior or usage.

## File map

- `bin/waveapps.js`: executable entry point.
- `src/cli.js`: argument parsing, dry-run safeguards, validation, and command output.
- `src/wave.js`: Wave GraphQL client plus customer, product, account, and invoice operations.
- `test/`: local tests using mocked HTTP responses.
- `scripts/check-secrets.js`: dependency-free tracked-file secret scan.
- `.github/workflows/`: continuous integration and secret-scan workflows.
- `examples/invoice.json`: example invoice input.
- `examples/invoice-update.json`: example replacement items and invoice discount patch.
- `README.md`: installation and usage documentation.
- `CHANGELOG.md`: user-visible release history.
- `CONTRIBUTING.md`: contribution workflow.
- `SECURITY.md`: private vulnerability-reporting policy.
- `LICENSE`: MIT license.
