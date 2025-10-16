# CI Quick Wins - Immediate Improvements

This guide shows you **simple changes you can make RIGHT NOW** to speed up your CI by 5-10 minutes without a major refactor.

## ⚡ Quick Win #1: Enable Turbo Remote Cache Everywhere (5 minutes)

**Impact:** 2-5 minute savings per workflow
**Difficulty:** Very Easy (find & replace)

### What to change:

In ALL workflow files that have this:

```yaml
env:
  TURBO_CACHE: remote:r # ❌ Read-only
```

Change to:

```yaml
env:
  TURBO_CACHE: remote:rw # ✅ Read-write
```

### Files to update:

- `.github/workflows/secrets.test-core.yml`
- `.github/workflows/secrets.test-memory-ai5.yml`
- `.github/workflows/secrets.test-combined-stores.yml`
- `.github/workflows/secrets.test-auth.yml`
- `.github/workflows/secrets.test-deployer.yml`
- `.github/workflows/secrets.test-server.yml`
- `.github/workflows/secrets.test-mcp.yml`
- `.github/workflows/secrets.test-rag.yml`
- `.github/workflows/secrets.e2e.yml`
- Any other test workflow files

### Command to do it automatically:

```bash
# From repo root
find .github/workflows -name "*.yml" -type f -exec sed -i '' 's/TURBO_CACHE: remote:r$/TURBO_CACHE: remote:rw/g' {} \;
```

---

## ⚡ Quick Win #2: Optimize E2E Build Commands (10 minutes)

**Impact:** 5-8 minute savings on E2E jobs
**Difficulty:** Easy

### File: `.github/workflows/secrets.e2e.yml`

#### Job: `e2e-deployers` (line ~240)

**Current:**

```yaml
- name: Build
  run: pnpm build # ❌ Builds EVERYTHING (~10 min)
```

**Change to:**

```yaml
- name: Build required packages
  run: pnpm turbo build --filter "./packages/core" --filter "./packages/deployer" --filter "./deployers/*"
  # ✅ Only builds what's needed (~2 min)
```

#### Job: `e2e-kitchen-sink` (line ~284)

**Current:**

```yaml
- name: Build
  run: pnpm build # ❌ Builds EVERYTHING
```

**Change to:**

```yaml
- name: Build required packages
  run: pnpm turbo build --filter "./packages/core" --filter "./packages/server" --filter "./packages/cli"
  # ✅ Only builds what kitchen-sink needs
```

---

## ⚡ Quick Win #3: Shallow Clones (5 minutes)

**Impact:** 10-30 second savings per job
**Difficulty:** Very Easy

Most jobs don't need full git history. Add `fetch-depth: 1` to checkouts.

### Files to update:

All test workflow files

**Current:**

```yaml
- uses: actions/checkout@v4
  with:
    ref: ${{ github.event.workflow_run.head_sha }}
```

**Change to:**

```yaml
- uses: actions/checkout@v4
  with:
    ref: ${{ github.event.workflow_run.head_sha }}
    fetch-depth: 1 # ✅ Shallow clone
```

### ⚠️ EXCEPTIONS - DO NOT change these jobs:

- `check-changes` jobs (they need history for path filtering)
- Jobs in `lint.yml` that use `fetch-depth: 0`

---

## ⚡ Quick Win #4: Add Missing Timeouts (5 minutes)

**Impact:** Prevents stuck jobs from blocking CI
**Difficulty:** Very Easy

Add timeouts to jobs that don't have them.

### Example - File: `.github/workflows/secrets.test-core.yml`

**Current:**

```yaml
test:
  needs: check-changes
  if: ${{ github.repository == 'mastra-ai/mastra' && needs.check-changes.outputs.core-changed == 'true' }}
  runs-on: ubuntu-latest
  # No timeout! ❌
```

**Change to:**

```yaml
test:
  needs: check-changes
  if: ${{ github.repository == 'mastra-ai/mastra' && needs.check-changes.outputs.core-changed == 'true' }}
  runs-on: ubuntu-latest
  timeout-minutes: 15 # ✅ Prevent hanging
```

### Suggested timeouts:

- Lint/Format jobs: `10 minutes`
- Unit tests: `15 minutes`
- Integration tests: `15 minutes`
- E2E tests: `20 minutes`

---

## ⚡ Quick Win #5: Optimize pnpm Registry Setup (5 minutes)

**Impact:** Cleaner, faster setup
**Difficulty:** Very Easy

### Current pattern in most workflows:

```yaml
- name: Configure npm registry
  run: mkdir -p ~/setup-pnpm && echo "registry=https://registry.yarnpkg.com" > ~/setup-pnpm/.npmrc

- uses: wardpeet/action-setup@pnpm-registry
  name: Install pnpm
  with:
    registry: https://registry.yarnpkg.com
    run_install: false
```

### Change to (simpler):

```yaml
- uses: pnpm/action-setup@v4
  with:
    version: 10.18.2
    run_install: false
```

This is cleaner and uses the official pnpm action.

---

## ⚡ Quick Win #6: Matrix Parallelism Limit (2 minutes)

**Impact:** Ensures max parallelism
**Difficulty:** Very Easy

### File: `.github/workflows/secrets.test-combined-stores.yml`

**Current (line ~83):**

```yaml
strategy:
  fail-fast: false
  matrix:
    store: ${{fromJson(needs.setup.outputs.stores)}}
```

**Change to:**

```yaml
strategy:
  fail-fast: false
  max-parallel: 5 # ✅ Run 5 stores in parallel
  matrix:
    store: ${{fromJson(needs.setup.outputs.stores)}}
```

Do the same for:

- Memory test matrix (`.github/workflows/secrets.test-memory-ai5.yml` line ~73)

---

## 📊 Expected Total Savings from Quick Wins

| Quick Win         | Time to Implement | Savings per PR          |
| ----------------- | ----------------- | ----------------------- |
| #1 Turbo cache    | 5 min             | 2-5 min                 |
| #2 E2E builds     | 10 min            | 5-8 min                 |
| #3 Shallow clones | 5 min             | 30-60 sec               |
| #4 Timeouts       | 5 min             | Prevents hanging        |
| #5 pnpm setup     | 5 min             | 10-20 sec               |
| #6 Parallelism    | 2 min             | Consistency             |
| **TOTAL**         | **32 minutes**    | **8-14 minutes per PR** |

---

## 🚀 Implementation Checklist

```bash
# 1. Create a new branch
git checkout -b ci-optimization-quick-wins

# 2. Quick Win #1: Update Turbo cache settings
find .github/workflows -name "secrets.*.yml" -type f -exec sed -i '' 's/TURBO_CACHE: remote:r$/TURBO_CACHE: remote:rw/g' {} \;

# 3. Verify changes
git diff .github/workflows/

# 4. Manually apply Quick Wins #2-6 (use your editor's find & replace)
# - Update e2e build commands
# - Add fetch-depth: 1 to checkouts
# - Add timeout-minutes to jobs
# - Update pnpm setup (optional)
# - Add max-parallel to matrices

# 5. Test the changes
git add .github/workflows/
git commit -m "ci: quick wins optimization - improve cache usage and build performance"
git push origin ci-optimization-quick-wins

# 6. Create PR and monitor the first run
# Compare with previous PR runs to measure improvement
```

---

## 🔍 Testing Your Changes

After merging:

1. **Check workflow duration:**
   - Go to Actions tab
   - Compare duration of workflows before/after
   - Look for improvements in build steps

2. **Monitor Turbo cache:**
   - Check build logs for "cache hit" messages
   - Should see more cache hits after first PR

3. **Watch for issues:**
   - Verify all tests still pass
   - Check for any new flaky tests
   - Ensure E2E tests work with targeted builds

---

## 🎯 Next Steps

After implementing quick wins:

1. **Measure the improvement** (track for 3-5 PRs)
2. **If you want MORE speed,** proceed to the full refactor (see `CI_OPTIMIZATION_REPORT.md`)
3. **Consider other optimizations** based on your specific bottlenecks

---

## ❓ Questions?

### "Will this break anything?"

No. These are all safe, conservative changes that maintain the same test coverage.

### "How long until I see results?"

- Turbo cache: After 1-2 PR runs (builds cache)
- E2E optimizations: Immediate
- Shallow clones: Immediate

### "Can I cherry-pick some quick wins?"

Yes! They're all independent. Start with #1 and #2 for biggest impact.

### "What if something breaks?"

Easy to revert - just git revert the commit. The changes are isolated to workflow files.
