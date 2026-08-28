# Project guidance

- Keep the CLI dependency-free unless a dependency materially improves the user experience.
- Never log, persist, or include Wave access tokens in errors.
- Customer, product, and invoice creation must remain a dry run unless the user explicitly supplies `--submit`.
- Keep Markdown paragraphs and list items on single physical lines.

## File map

- `bin/waveapps.js`: executable entry point.
- `src/cli.js`: argument parsing, dry-run safeguards, validation, and command output.
- `src/wave.js`: Wave GraphQL client plus customer, product, account, and invoice operations.
- `test/`: local tests using mocked HTTP responses.
- `scripts/check-secrets.js`: dependency-free tracked-file secret scan.
- `.github/workflows/`: continuous integration and secret-scan workflows.
- `examples/invoice.json`: example invoice input.
- `README.md`: installation and usage documentation.
- `CONTRIBUTING.md`: contribution workflow.
- `SECURITY.md`: private vulnerability-reporting policy.
- `LICENSE`: MIT license.
