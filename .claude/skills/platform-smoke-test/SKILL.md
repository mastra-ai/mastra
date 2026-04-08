---
name: platform-smoke-test
description: Smoke test the Mastra Platform - Gateway API, dashboard UI, account management, team invites, RBAC, and usage tracking. Tests gateway.mastra.ai and projects.mastra.ai.
---

# Platform Smoke Test

Smoke test the Mastra Platform - Gateway API, dashboard, accounts, and usage tracking.

## ⚠️ Mandatory Test Checklist

**Use `task_write` to track progress.** Run ALL tests unless `--test` specifies otherwise.

**Do not skip tests unless you hit an actual blocker.** "Seemed complex" or "wasn't sure" are not valid reasons. Attempt everything - only stop a test when you literally cannot proceed (e.g., need a second account you don't have). Report what you tried and what blocked you.

| # | Test | Reference | When Required |
|---|------|-----------|---------------|
| 1 | **Setup** | `references/tests/setup.md` | Always |
| 2 | **API** | `references/tests/api.md` | `--test api` or full |
| 3 | **Memory** | `references/tests/memory.md` | `--test memory` or full |
| 4 | **Threads** | `references/tests/threads.md` | `--test threads` or full |
| 5 | **OM** | `references/tests/om.md` | `--test om` or full |
| 6 | **BYOK** | `references/tests/byok.md` | `--test byok` or full |
| 7 | **Usage** | `references/tests/usage.md` | `--test usage` or full |
| 8 | **Dashboard** | `references/tests/dashboard.md` | `--test dashboard` or full |
| 9 | **Onboarding** | `references/tests/onboarding.md` | `--test onboarding` (new account) |
| 10 | **Account** | `references/tests/account.md` | `--test account` (new account) |
| 11 | **Invites** | `references/tests/invites.md` | `--test invites` (multi-user) |
| 12 | **RBAC** | `references/tests/rbac.md` | `--test rbac` (multi-user) |
| 13 | **Errors** | `references/tests/errors.md` | `--test errors` or full |

### Execution Flow

1. **Read the reference file** for each test you're about to run
2. **Execute the steps** in that reference file
3. **Mark the test complete** before moving to the next

### Partial Testing (`--test`)

If `--test` is provided:
1. Always run **Setup** (step 1)
2. Run **only** the specified test(s)
3. Skip other tests

Example: `--test api,memory` → Run steps 1, 2, and 3 only.

### Multi-User Tests

Tests 11-12 (invites, rbac) require multiple accounts. Try:
- Email aliases (e.g., `user+test@example.com`)
- Browser incognito for second account

Only skip if you've tried and cannot create/access a second account.

---

## Usage

```text
# Full platform test
platform smoke test --env production
platform smoke test --env staging --api-key msk_...

# Partial testing
platform smoke test --env production --test api,memory
platform smoke test --env staging --test onboarding
```

## Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `--env` | **Yes** | - | `staging` or `production` |
| `--api-key` | No | - | Skip account creation |
| `--test` | No | (full) | Specific test(s) |
| `--provider` | No | `openai` | For BYOK testing |

## Test Options (`--test`)

| Option | Description | Notes |
|--------|-------------|-------|
| `api` | API endpoints | Core functionality |
| `memory` | Memory persistence | Uses threads |
| `threads` | Thread CRUD | List, get, delete |
| `om` | Observational Memory | Token tracking |
| `byok` | Bring Your Own Key | Needs provider keys |
| `usage` | Usage dashboard | Costs, charts |
| `dashboard` | UI pages | All sections |
| `onboarding` | New user flow | Fresh email needed |
| `account` | Account creation | Fresh email needed |
| `invites` | Team invites | Multi-user |
| `rbac` | Role permissions | Multi-user |
| `errors` | Error handling | API + logs |

## Prerequisites

- `curl` and `jq` installed
- Browser tools enabled
- For BYOK: Provider API keys
- For onboarding/account: Fresh email

## Gateway URLs

| Environment | Dashboard | API |
|-------------|-----------|-----|
| Production | `gateway.mastra.ai` | `server.mastra.ai` |
| Staging | `gateway.staging.mastra.ai` | `server.staging.mastra.ai` |

## Quick Start

```bash
# Set environment
export GATEWAY_URL="https://gateway.mastra.ai"
export API_URL="https://server.mastra.ai"
export MASTRA_API_KEY="msk_..."

# Test API
curl -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer $MASTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "openai/gpt-4o", "messages": [{"role": "user", "content": "Hi"}]}'
```

## References

| File | Purpose |
|------|---------|
| `references/tests/*.md` | Detailed steps for each test |

## Result Reporting

After testing, provide:

```
## Platform Smoke Test Results

**Environment**: staging/production
**API Key**: (provided / created)

| Test | Status | Notes |
|------|--------|-------|
| Setup | ✅/❌ | |
| API | ✅/❌ | |
| Memory | ✅/❌ | |
| ... | | |

**Issues Found**: (list any)
**Warnings**: (list any)
**Skipped Tests**: (list with reason - e.g., "Invites - requires multiple accounts")
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| 401 errors | Check API key, re-create if needed |
| "No provider" | Use `provider/model` format |
| Thread not found | Check thread ID |
| Dashboard empty | Make some requests first |

> For deployed Studio/Server testing, use `mastra-smoke-test` instead.
