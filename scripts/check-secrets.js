#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const patterns = [
  { name: 'private key', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'Wave bearer token', pattern: /Authorization:\s*Bearer\s+(?!<ACCESS_TOKEN>|\$\{)[A-Za-z0-9_./+=-]{16,}/i },
  { name: 'assigned Wave token', pattern: /WAVEAPPS_FULL_ACCESS_TOKEN\s*=\s*["']?(?!your-token|test-token|$)[A-Za-z0-9_./+=-]{16,}/ }
];

let files;
try {
  files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
} catch {
  console.error('Secret scan could not list repository files.');
  process.exit(1);
}

const findings = [];
for (const file of files) {
  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  for (const { name, pattern } of patterns) {
    if (pattern.test(content)) findings.push(`${file}: possible ${name}`);
  }
}

if (findings.length) {
  console.error(findings.join('\n'));
  process.exit(1);
}

console.log(`Secret scan passed (${files.length} files checked).`);
