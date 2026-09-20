// Node helper: checks that the CSP hash in demo.html matches its inline boot script.
//   node js/demo/csp-hash.mjs          -> exit 0 when in sync, exit 1 + the expected hash otherwise
//   node js/demo/csp-hash.mjs --write  -> rewrites the hash in demo.html
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const file = new URL('../../demo.html', import.meta.url);
const html = readFileSync(file, 'utf8');
const body = html.replace(/<!--[\s\S]*?-->/g, '').match(/<script>([\s\S]*?)<\/script>/);
if (!body) { console.error('no inline <script> found in demo.html'); process.exit(1); }
const expected = 'sha256-' + createHash('sha256').update(body[1]).digest('base64');
const current = (html.match(/'(sha256-[^']+)'/) || [])[1];

if (current === expected) console.log('CSP hash OK  ' + expected);
else if (process.argv.includes('--write')) {
  writeFileSync(file, html.replace(`'${current}'`, `'${expected}'`));
  console.log('CSP hash updated -> ' + expected);
} else { console.error(`CSP hash mismatch\n  in demo.html: ${current}\n  expected:     ${expected}`); process.exit(1); }
