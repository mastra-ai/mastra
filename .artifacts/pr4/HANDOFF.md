# Artifact-only evidence handoff

This directory is a standalone evidence package for the PR4 lifecycle investigation. It contains **no product implementation**. `REPORT.md` is the entry point; `evidence-summary.json` is the compact result set; `.mjs` files are runnable local integration harnesses. Report provenance identifies the two exact source revisions. Use the post-PR1 individual logs for merged-source claims; append-only aggregate JSONL files include multiple invocations and both source baselines.

## Sanitization review

All 46 original report/harness/evidence files were scanned for credential-like patterns, secret/password/API-key/token assignments, bearer authorization, and URLs. No real credentials, environment dumps, provider tokens, private keys, customer records or production endpoints were found. `apiKey: 'test'` and bearer `alice`/`bob` are literal synthetic fixtures accepted only by the local harness; they are not credentials for any deployed service and are intentionally retained so the proof can be rerun. Model requests go to local AIMock. Redis is unauthenticated loopback-only. UUIDs, ephemeral ports, Redis fixture keys, provider-generated fixture IDs, local build paths, and Alice/Bob fixture ownership are preserved as evidence.

No source log rows were redacted or rewritten. The report was extended with an explicit generation-safe ownership design gate after the completion report. This gate is not implemented. `MANIFEST.json` contains SHA-256 checksums for every handoff file except itself; this avoids circular checksums. The Git commit is the authoritative package identity. The earlier sandbox-only archive was not committed; this directory is the portable handoff.

## Verify checksums

From repository root:

```sh
node --input-type=module <<'NODE'
import fs from 'node:fs';
import crypto from 'node:crypto';
const root = '.artifacts/pr4';
const manifest = JSON.parse(fs.readFileSync(`${root}/MANIFEST.json`, 'utf8'));
for (const { file, sha256 } of manifest.files) {
  const actual = crypto.createHash('sha256').update(fs.readFileSync(`${root}/${file}`)).digest('hex');
  if (actual !== sha256) throw new Error(`Checksum mismatch: ${file}`);
}
console.log(`Verified ${manifest.files.length} files`);
NODE
```

The package must be overlaid onto either exact source revision from the report to reproduce it. The proof branch itself is based on the post-PR1 revision. No secrets or package lockfiles are needed. Refer to `REPORT.md` for prerequisites, commands, observed limitations, contract matrix and design/test gates. After this handoff, investigation is held pending further instruction.
