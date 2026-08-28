# Security policy

## Reporting a vulnerability

Please report suspected vulnerabilities privately through GitHub's private vulnerability reporting feature for this repository. Do not include access tokens, customer information, Wave business IDs, or exploit details in a public issue.

If private vulnerability reporting is unavailable, contact the repository maintainer privately through their GitHub profile and request a secure reporting channel.

## Credential handling

waveapps-cli reads `WAVEAPPS_FULL_ACCESS_TOKEN` from the process environment. It does not intentionally persist or print that token. Treat Wave full-access tokens like passwords, keep them out of command arguments and files, and revoke or replace a token immediately if it may have been exposed.

Only currently maintained releases are eligible for security fixes.
