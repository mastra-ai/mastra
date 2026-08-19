# PR split scratchpad — #2085

Original branch: `backup/feat-redis-for-cool-cats-with-plans` (also: `feat/redis-for-cool-cats` @ `8160e7197`, 14 commits)
Base branch: `feat/enterprise-soft-limits-redis-columns` (migration, PR #2084)

## Planned PRs (stacked)

### 1. `feat/redis-for-cool-cats-backend` — Backend Redis pipeline
- Base: `feat/enterprise-soft-limits-redis-columns` (PR #2084)
- Scope: `services/**`, `servers/**`, `pnpm-lock.yaml`, plus dep updates in `frontend/package.json` if any
- Files: 58 services + 14 servers + 1 lock = 73 files
- Verification:
  - `pnpm --filter @platform/project-databases test`
  - `pnpm --filter @platform/billing test`
  - `pnpm --filter @platform/api test`
  - `pnpm --filter @platform/gateway-worker test`
  - `pnpm --filter @platform/workspaces test`
  - `pnpm --filter @platform/server test`
  - `pnpm turbo typecheck --filter=!@platform/frontend`
- Changeset: n/a (platform repo)
- Status: pending

### 2. `feat/redis-for-cool-cats-frontend` — Frontend Redis surfaces
- Base: `feat/redis-for-cool-cats-backend`
- Scope: `frontend/**` (25 files)
- Verification:
  - `pnpm --filter @platform/frontend test`
  - `pnpm --filter @platform/frontend typecheck`
- Status: pending

## Reuse strategy

Keep `feat/redis-for-cool-cats` (PR #2085) as the FRONTEND branch. Retarget its base to `feat/redis-for-cool-cats-backend` and reset it to a fresh branch that only contains frontend files. Open a NEW PR for backend targeting `feat/enterprise-soft-limits-redis-columns`.

Alternative (rejected): repurpose 2085 as backend. Cleaner reviewer story if the PR number stays with the smaller/newer scope, but frontend is smaller and reviewer discussion is empty either way — either works.

Decision: **repurpose 2085 as the backend PR** (larger diff, existing description already backend-heavy) and open a new frontend PR.

## Extraction commands

```sh
# Backend branch — reset from migration base, restore backend paths from backup
git checkout -b feat/redis-for-cool-cats-backend feat/enterprise-soft-limits-redis-columns
git checkout backup/feat-redis-for-cool-cats-with-plans -- services/ servers/ pnpm-lock.yaml
# ensure .mastracode/plans not staged (local exclude covers)
git commit -m "feat: managed Redis backend pipeline"

# Frontend branch — from backend, restore frontend paths
git checkout -b feat/redis-for-cool-cats-frontend feat/redis-for-cool-cats-backend
git checkout backup/feat-redis-for-cool-cats-with-plans -- frontend/
git commit -m "feat(frontend): Redis surfaces for DB usage + billing"
```

## Force-push impact

- #2085 (currently `feat/redis-for-cool-cats`) will be repurposed OR replaced. Decision above: repurpose as backend PR. Force-push required after we rewrite the branch to be backend-only.
- Backup ref: `backup/feat-redis-for-cool-cats-with-plans` @ `1b914816e` preserves full history.

## Remaining original intent

- All 25 frontend files land in PR 2.
- Nothing intentionally excluded.
