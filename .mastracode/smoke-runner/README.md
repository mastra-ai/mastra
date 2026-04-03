# Smoke Runner

Reusable Playwright harness for `/all-the-smoke`.

## Purpose

This directory is intentionally persistent across smoke-test runs.

Keep in place:
- `package.json`
- Playwright dependency installation
- reusable smoke scripts/helpers
- `run-smoke.mjs` orchestrator

Delete per run:
- generated `create-mastra` apps under `../tmp-smoke/runs/<run-id>/`
- dev servers started for those generated apps
- per-run screenshots/output unless intentionally preserved for debugging

## Expected structure

- `.mastracode/smoke-runner/` - reusable harness
- `.mastracode/smoke-runner/run-smoke.mjs` - end-to-end orchestrator
- `.mastracode/tmp-smoke/runs/<run-id>/app/` - disposable created app
- `.mastracode/tmp-smoke/runs/<run-id>/screenshots/` - per-run screenshots preserved for review
