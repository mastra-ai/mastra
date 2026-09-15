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

The manifest is the source of truth for how the worker is launched and which protocol it speaks. Read it instead of assuming defaults:

```bash
MANIFEST=.mastra/experiment-worker/experiment-worker-manifest.json
jq '{launch, protocol, buildId: .build.buildId}' "$MANIFEST"
```

Record the reported values. At the time of writing the manifest reports `launch.executable: "node"`, `launch.arguments: ["index.mjs"]`, `launch.workingDirectory: "."`, `protocol.framing: "ndjson"`, `protocol.versions: ["1"]`, and `protocol.datasetCanonicalizationVersion: "1"`, but the steps below read every one of these from the manifest rather than assuming them. Report any value that differs from the defaults above.

`packet.artifacts.buildId` always comes from `.build.buildId`. A deliberately incorrect build ID should fail with protocol exit code `70` before loading the experiment.

### 3. Run one correctly attested request

From the project root, replace `YOUR_WORKFLOW_REGISTRY_KEY` below with a registered workflow key. This script creates one dataset item, canonicalizes it by recursively sorting object keys while preserving array order, computes the SHA-256 attestation, and writes a complete NDJSON request using the manifest's protocol and canonicalization versions. The worker is then launched from `launch.workingDirectory` using `launch.executable` and `launch.arguments`:

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

const manifest = JSON.parse(
  readFileSync('.mastra/experiment-worker/experiment-worker-manifest.json', 'utf8'),
);

const assert = (actual, expected, what) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `manifest ${what} is ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)} — ` +
        `update the launch command and request below to match the manifest, and report the change`,
    );
  }
};

// This request is written as one NDJSON line, so a different framing invalidates it.
assert(manifest.protocol.framing, 'ndjson', 'protocol.framing');

const protocolVersion = manifest.protocol.versions.at(-1);
const canonicalizationVersion = manifest.protocol.datasetCanonicalizationVersion;

const items = [{ id: 'item-1', input: { value: 21 }, toolMocks: [] }];
const digest = createHash('sha256').update(canonicalize(items)).digest('hex');
const experimentId = 'smoke-experiment-1';

console.log(JSON.stringify({
  type: 'run',
  protocolVersion,
  supportedProtocolVersions: manifest.protocol.versions,
  experimentId,
  jobId: 'smoke-job-1',
  attempt: 1,
  idempotencyKey: 'smoke-attempt-1',
  deadlineAt: new Date(Date.now() + 30_000).toISOString(),
  datasetAttestation: { itemCount: items.length, digest, canonicalizationVersion },
  packet: {
    protocolVersion,
    experimentId,
    tenant: {},
    environment: {},
    artifacts: { buildId: manifest.build.buildId },
    target: { type: 'workflow', id: 'YOUR_WORKFLOW_REGISTRY_KEY' },
    dataset: { itemCount: items.length, digest, canonicalizationVersion, items },
    scorers: [],
    limits: { concurrency: 1, timeoutMs: 5000 },
    policies: { allowedToolIds: [], allowedNetworkHosts: [] },
    secretReferences: [],
  },
}));
EOF

# Build the invocation from manifest.launch rather than assuming it.
# workingDirectory and arguments are relative to the worker output directory.
WORKER_DIR=.mastra/experiment-worker
MANIFEST="$WORKER_DIR/experiment-worker-manifest.json"
LAUNCH_CWD=$(cd "$WORKER_DIR/$(jq -r '.launch.workingDirectory' "$MANIFEST")" && pwd)
LAUNCH_EXE=$(jq -r '.launch.executable' "$MANIFEST")
LAUNCH_ARGS=()
while IFS= read -r arg; do LAUNCH_ARGS+=("$arg"); done < <(jq -r '.launch.arguments[]' "$MANIFEST")

(cd "$LAUNCH_CWD" && "$LAUNCH_EXE" "${LAUNCH_ARGS[@]}") \
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
