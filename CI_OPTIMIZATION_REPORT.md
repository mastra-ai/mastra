# CI Pipeline Optimization Report

## Current State Analysis

Your CI pipeline has significant performance issues due to its architecture and configuration. Here's what I found:

### Architecture Overview

1. **Main Workflow**: `Quality assurance` (lint.yml) runs on every PR
2. **Dependent Workflows**: 11+ test workflows triggered via `workflow_run` after QA completes
3. **Path Filtering**: Each workflow checks for changes but only AFTER the main workflow completes

### Key Problems

#### 1. **Sequential Workflow Chaining (CRITICAL)**

- Current: `Quality assurance` → waits for completion → triggers 11+ workflows
- Impact: **Adds 2-5 minutes of overhead per PR** just waiting for workflows to start
- Why it's slow: `workflow_run` events have inherent delays in GitHub Actions

**Test Workflows Triggered Sequentially:**

- secrets.test-core.yml
- secrets.test-memory-ai5.yml
- secrets.test-memory.yml
- secrets.test-combined-stores.yml
- secrets.test-auth.yml
- secrets.test-deployer.yml
- secrets.test-server.yml
- secrets.test-mcp.yml
- secrets.test-rag.yml
- secrets.test-agent-builder.yml
- secrets.tool-builder-test.yml
- secrets.e2e.yml

#### 2. **Redundant Dependency Installation**

- Each workflow runs `pnpm install` independently
- Impact: **3-5 minutes per workflow** (even with caching)
- Total waste: **30-60 minutes across all workflows**

#### 3. **Redundant Build Steps**

- Multiple workflows rebuild the same packages:
  - Core package is built in 8+ workflows
  - Stores are built independently in each store test
  - No shared build artifacts between jobs

#### 4. **E2E Tests Build Everything**

- e2e-deployers runs `pnpm build` (builds ENTIRE monorepo)
- e2e-kitchen-sink runs `pnpm build` (builds ENTIRE monorepo)
- Impact: **5-10 minutes per E2E job** for unnecessary builds

#### 5. **Inefficient Turbo Cache Usage**

- Most workflows use `TURBO_CACHE: remote:r` (read-only)
- Only lint/prebuild use `remote:rw` (read-write)
- Impact: Builds in test workflows can't benefit from each other's cache

#### 6. **Check-changes Job Redundancy**

- Every workflow has its own `check-changes` job
- Each checks out code and runs path filters independently
- Could be done once and shared

---

## Recommended Optimizations (Prioritized)

### 🔥 CRITICAL (Implement First) - Expected Savings: 10-15 minutes

#### 1. Consolidate into Single Workflow with Job-Level Path Filtering

**Replace `workflow_run` pattern with a single workflow using path filters**

```yaml
name: CI Pipeline

on:
  pull_request:
    branches: [main]

jobs:
  # Central change detection
  detect-changes:
    runs-on: ubuntu-latest
    outputs:
      core: ${{ steps.filter.outputs.core }}
      memory: ${{ steps.filter.outputs.memory }}
      stores: ${{ steps.filter.outputs.stores }}
      # ... other outputs
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            core:
              - 'packages/core/**'
            memory:
              - 'packages/memory/**'
            stores:
              - 'stores/**'
            # ... other filters

  # Shared setup job
  setup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node & pnpm
        # ... setup steps
      - name: Install dependencies
        run: pnpm install
      - name: Cache node_modules
        uses: actions/cache/save@v3
        with:
          path: |
            node_modules
            **/node_modules
          key: ${{ runner.os }}-pnpm-${{ hashFiles('**/pnpm-lock.yaml') }}

  # Shared build job
  build-common:
    needs: setup
    runs-on: ubuntu-latest
    strategy:
      matrix:
        package: [core, cli, server, deployer]
    steps:
      - uses: actions/checkout@v4
      - name: Restore node_modules
        uses: actions/cache/restore@v3
        # ... restore cache
      - name: Build
        run: pnpm turbo build --filter ./packages/${{ matrix.package }}
      - name: Upload build artifacts
        uses: actions/upload-artifact@v3
        with:
          name: build-${{ matrix.package }}
          path: packages/${{ matrix.package }}/dist

  # Then test jobs that depend on build artifacts
  test-core:
    needs: [detect-changes, build-common]
    if: needs.detect-changes.outputs.core == 'true'
    # ... test steps using artifacts
```

**Benefits:**

- Eliminates workflow_run delays (saves 2-5 min)
- Runs path detection once (saves 1-2 min)
- Allows parallel test execution from the start
- Shares build artifacts between jobs

#### 2. Create Shared Build Artifacts

**Upload build outputs as artifacts, download in test jobs**

```yaml
build-packages:
  steps:
    - name: Build all packages
      run: pnpm turbo build --filter "./packages/*"
    - name: Upload artifacts
      uses: actions/upload-artifact@v3
      with:
        name: package-builds
        path: |
          packages/*/dist
        retention-days: 1

test-core:
  needs: build-packages
  steps:
    - name: Download builds
      uses: actions/upload-artifact@v3
      with:
        name: package-builds
    - name: Run tests (no build needed)
      run: pnpm test:core
```

**Benefits:**

- Build once, test many times (saves 5-8 min per workflow)
- Guarantees test isolation
- Faster test job startup

### ⚡ HIGH PRIORITY - Expected Savings: 5-8 minutes

#### 3. Optimize E2E Builds

**E2E tests should use targeted builds, not `pnpm build`**

Current (e2e-deployers):

```yaml
- name: Build
  run: pnpm build # ❌ Builds EVERYTHING
```

Optimized:

```yaml
- name: Build required packages only
  run: pnpm turbo build --filter "./packages/core" --filter "./packages/deployer" --filter "./deployers/*"
```

Do this for:

- e2e-kitchen-sink: Identify exact dependencies
- e2e-deployers: Already partially optimized but still builds too much

**Benefits:**

- Reduces build time from 8-10 min to 2-3 min per E2E job
- More explicit about dependencies

#### 4. Use Turbo Remote Cache Properly

**Enable read-write cache for all jobs**

Current:

```yaml
env:
  TURBO_CACHE: remote:r # ❌ Read-only in tests
```

Optimized:

```yaml
env:
  TURBO_CACHE: remote:rw # ✅ Read-write everywhere
```

**Why this matters:**

- First PR of the day is slow, but subsequent PRs benefit
- Parallel jobs can share cache entries
- Reduces redundant compilation

**Benefits:**

- Can save 2-5 min on builds when cache is warm
- Helps with parallel CI runs

### 🎯 MEDIUM PRIORITY - Expected Savings: 3-5 minutes

#### 5. Optimize pnpm Install

**Use pnpm fetch + offline install pattern**

Current:

```yaml
- name: Install dependencies
  run: pnpm install
```

Optimized:

```yaml
- name: Fetch dependencies
  run: pnpm fetch --ignore-scripts

- name: Install dependencies (offline)
  run: pnpm install --offline --frozen-lockfile
```

**Benefits:**

- Faster installs (downloads in parallel)
- More reliable caching
- Saves 30-60 seconds per job

#### 6. Matrix Optimization for Store Tests

**Run truly independent stores in parallel**

Current setup already uses matrix, but can improve:

```yaml
test-stores:
  strategy:
    fail-fast: false
    max-parallel: 5 # Add this
    matrix:
      store: ${{fromJson(needs.setup.outputs.stores)}}
```

**Benefits:**

- Ensures max parallelism
- Prevents GitHub Actions from throttling

#### 7. Reduce Checkout Depth

**Most jobs don't need full git history**

Current:

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0 # ❌ Full history
```

Optimized:

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 1 # ✅ Shallow clone
```

Only use `fetch-depth: 0` where needed (changesets, path-filter base job)

### 💡 LOW PRIORITY / NICE TO HAVE

#### 8. Use Dependency Caching Action

Replace manual pnpm cache with action:

```yaml
- uses: pnpm/action-setup@v4
  with:
    version: 10.18.2

- uses: actions/setup-node@v4
  with:
    node-version: 20.19.1
    cache: 'pnpm'
    cache-dependency-path: pnpm-lock.yaml
```

#### 9. Add Job Timeouts

Prevent stuck jobs from blocking CI:

```yaml
timeout-minutes: 10 # Already done for some, add to all
```

#### 10. Consider Self-Hosted Runners

For very frequent CI runs:

- Persistent node_modules cache
- Faster disk I/O
- Can save 2-3 min per run

---

## Implementation Roadmap

### Phase 1: Quick Wins (1-2 hours work)

- [ ] Enable `TURBO_CACHE: remote:rw` in all workflows
- [ ] Optimize E2E build commands (specify exact filters)
- [ ] Add `fetch-depth: 1` to most checkouts
- [ ] Add missing timeouts

**Expected savings: 5-7 minutes per PR**

### Phase 2: Major Refactor (4-6 hours work)

- [ ] Consolidate into single workflow file
- [ ] Implement shared setup job
- [ ] Add build artifact upload/download
- [ ] Test and verify all checks still work

**Expected savings: 10-15 minutes per PR**

### Phase 3: Fine-Tuning (2-3 hours)

- [ ] Optimize pnpm install with fetch pattern
- [ ] Review and optimize all Turbo filters
- [ ] Add matrix parallelism limits
- [ ] Monitor and tune cache hit rates

**Expected savings: 3-5 additional minutes**

---

## Estimated Total Improvements

| Current State | After Phase 1 | After Phase 2 | After Phase 3 |
| ------------- | ------------- | ------------- | ------------- |
| 25-35 min     | 18-28 min     | 10-15 min     | 7-12 min      |

**Total potential savings: 50-65% faster CI**

---

## Monitoring Recommendations

After implementing changes:

1. **Track workflow duration trends**
   - Use GitHub Actions insights
   - Monitor p50, p95, p99 durations

2. **Monitor Turbo cache hit rates**
   - Check turbo logs for cache performance
   - Verify remote cache is being populated

3. **Watch for flaky tests**
   - Artifact-based approach may expose timing issues
   - Monitor test failure rates

4. **Measure actual savings**
   - Compare avg duration before/after
   - Track cost savings (Actions minutes)

---

## Example: Optimized Single Workflow Structure

See the companion file `CI_OPTIMIZED_EXAMPLE.yml` for a complete example of the recommended architecture.

---

## Questions to Consider

1. **How often do you merge to main?**
   - High frequency → prioritize cache optimization
   - Low frequency → focus on cold start performance

2. **Which tests take longest?**
   - May want to split further or optimize those specifically

3. **Do you have Turbo remote cache configured?**
   - If not, Phase 1 won't help as much
   - Consider Vercel Remote Cache or self-hosted

4. **Budget for self-hosted runners?**
   - Can provide 2-3x speedup for monorepos
   - Better for frequent CI usage

---

## Next Steps

1. Review this report with your team
2. Decide which phase(s) to implement
3. Create a branch for CI optimization
4. Implement Phase 1 (quick wins) first
5. Measure results before proceeding to Phase 2
6. I can help implement any of these changes - just let me know where you'd like to start!
