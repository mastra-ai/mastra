# Stable Release Smoke

Use this after the stable/full release workflow starts or completes.

After the stable/full release publishes, run smoke again against the published stable packages. Do not rely on alpha smoke as final stable-release signoff because the stable publish path, npm dist-tags, generated project install path, and package versions are distinct release surfaces.

## 1. Confirm the stable publish workflow completed

Inspect the full release run. The stable path should complete successfully, with snapshot/prerelease jobs skipped when this is a normal full release.

```bash
gh run view <run-id> --json name,event,status,conclusion,workflowName,headBranch,headSha,jobs,url --jq .
gh run watch <run-id>
```

If the run fails or is cancelled, stop and report the failed job/step before creating a fresh smoke project.

If it fails after some packages published, use `references/stable-partial-publish-recovery.md` before smoke testing.

## 2. Confirm stable packages are installable

Check the published `latest` versions and make sure they match the intended stable release versions:

```bash
npm view @mastra/core@latest version
npm view mastra@latest version
npm view create-mastra@latest version
```

If npm returns the previous stable version, wait for publish/registry propagation and retry. Do not run final stable smoke against stale `latest` packages.

## 3. Create a fresh stable smoke project

Use the same dated workspace, but create a separate project from the alpha project so dependency resolution and generated files prove the stable release path independently.

```bash
# Reuse the existing SMOKE_DIR from the alpha/release-scope run.
: "${SMOKE_DIR:?Set SMOKE_DIR via references/release-scope-discovery.md before stable smoke}"
mkdir -p "$SMOKE_DIR/logs"

cd "$SMOKE_DIR"
pnpm create mastra@latest stable-smoke-project -c agents,tools,workflows,scorers -l openai -e
cd stable-smoke-project
pnpm run dev
```

If an existing dev server is holding port `4111` or a DuckDB lock, stop that process before starting the stable project. Do not run alpha and stable smoke projects against the same generated project directory or storage file.

## 4. Rerun the required smoke coverage

For stable release signoff, rerun at least:

- mandatory local checklist: setup, agents, tools, workflows, traces, scorers, memory, MCP, errors
- Local Studio browser smoke: shell/version, agent chat, tool execution, workflow run, traces, scorers, MCP
- targeted release-scope checks identified from the PR categorization, especially any checks added because the generated project does not cover changed features

Append stable results to the dated `smoke-report.md` in a separate section from alpha results and clearly record the package versions tested.
