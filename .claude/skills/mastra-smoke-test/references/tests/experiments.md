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

Read the generated manifest and worker bundle metadata. Use protocol version `1`, the embedded build ID, and the dataset SHA-256 attestation expected by the worker. A deliberately incorrect build ID should fail with protocol exit code `70` before loading the experiment.

### 3. Run one correctly attested request

Send one NDJSON request targeting a registered agent or workflow with a dataset item containing a string `id` and `input`. Capture stdout, stderr, and the process exit code.

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
