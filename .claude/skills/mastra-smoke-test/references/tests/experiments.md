# Experiment Companion Worker Testing (`--test experiments`)

## Purpose

Verify `mastra experiment build` produces a standalone companion worker and that the worker completes a protocol-v1 NDJSON experiment request.

## Steps

### 1. Build the worker

```bash
<pm> exec mastra experiment build --output-dir .mastra/experiment-worker
```

- [ ] Build exits successfully
- [ ] `experiment-worker-manifest.json` exists
- [ ] Manifest file digests complete without `EISDIR`
- [ ] Native dependencies either bundle or are explicitly externalized and resolvable
- [ ] Generated pnpm build approvals contain booleans, not placeholders such as `set this to true or false`

If the main project includes native stores such as DuckDB, also build a minimal isolated Mastra entry point containing one workflow and deterministic scorer. Record whether failures are project-specific or reproduce without the native dependency.

### 2. Inspect protocol identity

Read the launch command, protocol version, and build ID from the generated manifest:

```bash
MANIFEST=.mastra/experiment-worker/experiment-worker-manifest.json
jq '{launch, protocol, buildId: .build.buildId}' "$MANIFEST"
```

The default launch command is `cd .mastra/experiment-worker && node index.mjs`. Use the protocol version from `.protocol.versions` and copy `.build.buildId` to `packet.artifacts.buildId`. A deliberately incorrect build ID should fail with protocol exit code `70` before loading the experiment.

### 3. Run one correctly attested request

From the project root, replace `YOUR_WORKFLOW_REGISTRY_KEY` below with a registered workflow key. This script creates one dataset item, canonicalizes it by recursively sorting object keys while preserving array order, computes the SHA-256 attestation, and writes a complete protocol-v1 NDJSON request:

```bash
node --input-type=module > .mastra/experiment-request.ndjson <<'EOF'
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const canonicalize = value =>
  value === null || typeof value !== 'object'
    ? JSON.stringify(value)
    : Array.isArray(value)
      ? `[${value.map(canonicalize).join(',')}]`
      : `{${Object.keys(value)
          .sort()
          .map(key => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
          .join(',')}}`;

const items = [{ id: 'item-1', input: { value: 21 }, toolMocks: [] }];
const digest = createHash('sha256').update(canonicalize(items)).digest('hex');
const manifest = JSON.parse(
  readFileSync('.mastra/experiment-worker/experiment-worker-manifest.json', 'utf8'),
);
const experimentId = 'smoke-experiment-1';

console.log(JSON.stringify({
  type: 'run',
  protocolVersion: '1',
  supportedProtocolVersions: ['1'],
  experimentId,
  jobId: 'smoke-job-1',
  attempt: 1,
  idempotencyKey: 'smoke-attempt-1',
  deadlineAt: new Date(Date.now() + 30_000).toISOString(),
  datasetAttestation: { itemCount: items.length, digest, canonicalizationVersion: '1' },
  packet: {
    protocolVersion: '1',
    experimentId,
    tenant: {},
    environment: {},
    artifacts: { buildId: manifest.build.buildId },
    target: { type: 'workflow', id: 'YOUR_WORKFLOW_REGISTRY_KEY' },
    dataset: { itemCount: items.length, digest, canonicalizationVersion: '1', items },
    scorers: [],
    limits: { concurrency: 1, timeoutMs: 5000 },
    policies: { allowedToolIds: [], allowedNetworkHosts: [] },
    secretReferences: [],
  },
}));
EOF

(cd .mastra/experiment-worker && node index.mjs) \
  < .mastra/experiment-request.ndjson \
  > .mastra/experiment-stdout.ndjson \
  2> .mastra/experiment-stderr.log
status=$?
printf 'worker exit code: %s\n' "$status"
cat .mastra/experiment-stdout.ndjson
cat .mastra/experiment-stderr.log >&2
```

The item count, digest, and canonicalization version must match in `datasetAttestation` and `packet.dataset`. Capture stdout, stderr, and the process exit code.

Expected successful lifecycle:

```text
accepted → run-started → item-completed → terminal
```

Pass criteria:

- Exit code `0`
- Sequential event numbers
- Terminal status `completed`
- Item output matches the target's expected output
- Diagnostics stay on stderr; protocol events stay on stdout

### 4. Classify failures

Treat these as product issues, not smoke-environment noise:

- Caller-provided `experimentId` is passed to persistence without first creating the experiment record, causing `Experiment not found` or storage update-not-found failures.
- Manifest hashing reads pnpm directory symlinks as files and throws `EISDIR`.
- A native dependency cannot be bundled and cannot be cleanly externalized into the worker.
- Generated build policy contains unresolved approval placeholders.

A temporary no-persistence patch can prove the remaining protocol path, but it does not make the released worker a pass.

## Report

Record the build command, artifact path, build ID, request target, exit code, event sequence, terminal result, stderr diagnostics, and any workaround used.
