# Contributing

Thanks for considering a contribution to waveapps-cli.

## Development setup

This project requires Node.js 18 or newer and has no runtime dependencies.

```sh
npm install
npm test
npm run check
```

Tests must use mocked HTTP responses and must never make requests against a real Wave account. Do not put access tokens, customer information, business IDs, or other private Wave data in issues, fixtures, tests, logs, or commits.

## Pull requests

Keep changes focused, add or update tests for behavior changes, and update the README when commands or user-visible behavior change. Run `npm test` and `npm run check` before opening a pull request.

Invoice, customer, and product creation must remain dry runs unless the user explicitly supplies `--submit`.

## Reporting security issues

Do not report suspected vulnerabilities in a public issue. Follow [SECURITY.md](SECURITY.md) instead.
