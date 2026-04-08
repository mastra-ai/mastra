# Platform Smoke Test Report

**Date:** April 8, 2026  
**Environment:** Production  
**Gateway URL:** https://gateway.mastra.ai  
**Project:** `smoke-test-prod-1775604`  
**API Key:** `msk_903e4d4b109712aa33243f8069f09fca`

---

## Summary

| Category | Passed | Failed | Warnings |
|----------|--------|--------|----------|
| API Endpoints | 5 | 1 | 1 |
| Memory | 1 | 0 | 0 |
| Threads API | 4 | 0 | 0 |
| BYOK | 1 | 2 | 1 |
| Dashboard UI | 5 | 0 | 0 |
| Error Handling | 5 | 0 | 0 |
| **Total** | **21** | **3** | **2** |

---

## Detailed Results

### API Endpoints

| Test | Result | Notes |
|------|--------|-------|
| Chat completions with provider prefix (`openai/gpt-4o-mini`) | ✅ Pass | Response: "Hello!" |
| Chat completions without provider prefix | ⚠️ Pass | Auto-attached `openai/gpt-4o-mini` (feature, not bug) |
| Chat completions with thread ID | ✅ Pass | Thread created successfully |
| Chat completions with thread ID + resource ID | ✅ Pass | Both IDs recorded |
| Legacy `/v1/completions` endpoint | ❌ Fail | Returns `404 Not Found` |
| `/v1/responses` endpoint | ✅ Pass | Response: "2 + 2 equals 4." |

### Memory Persistence

| Test | Result | Notes |
|------|--------|-------|
| Cross-request memory recall | ✅ Pass | Correctly recalled "pizza" and "Seattle" from prior message |

### Thread Operations (API)

| Test | Result | Notes |
|------|--------|-------|
| `GET /v1/memory/threads` (list) | ✅ Pass | Returns `{threads: [...]}` |
| `GET /v1/memory/threads/{id}` (get by ID) | ✅ Pass | Returns `{thread: {...}}` |
| `GET /v1/memory/threads/{id}/messages` | ✅ Pass | Returns `{messages: [...]}` |
| `POST /v1/memory/threads` (create) | ✅ Pass | Requires `resourceId` field |

**Note:** Original test used wrong paths (`/v1/threads`). Correct paths are `/v1/memory/threads/*`. Skill documentation has been updated.

### Observational Memory (OM)

| Test | Result | Notes |
|------|--------|-------|
| Extended conversation (13 messages) | ⚠️ Partial | `prompt_tokens: 2314` (growing), `cached_tokens: 1792` visible |

Token counts suggest memory is accumulating but OM plateau wasn't clearly observed.

### BYOK (Bring Your Own Key)

| Test | Result | Notes |
|------|--------|-------|
| OpenAI via `x-openai-api-key` header | ⚠️ Pass | Request worked, but `is_byok: false` in response (bug) |
| Anthropic via `x-anthropic-api-key` header | ❌ Fail | `"anthropic/claude-3-haiku-20240307 is not a valid model ID"` |
| Google via `x-google-api-key` header | ❌ Fail | `"google/gemini-1.5-flash is not a valid model ID"` |

### Dashboard UI

| Test | Result | Notes |
|------|--------|-------|
| Usage page | ✅ Pass | Shows requests (39), tokens (16.8K), cost (<$0.01), model breakdown |
| Threads page | ✅ Pass | Lists 5 threads with message counts and timestamps |
| Logs page | ✅ Pass | Shows log entries with status codes, models, timestamps |
| Settings page | ✅ Pass | Shows OM thresholds (Observation: 30000, Reflection: 40000), BYOK config |
| API Keys page | ✅ Pass | Lists "Default Key" with prefix `msk_903e...` |

### Error Handling

| Test | Result | Notes |
|------|--------|-------|
| Invalid API key | ✅ Pass | `{"error":{"message":"Non-Mastra key detected...","type":"authentication_error"}}` |
| Missing Authorization header | ✅ Pass | `{"error":{"message":"Missing API key...","type":"authentication_error"}}` |
| Invalid model name | ✅ Pass | `{"error":{"message":"openai/fake-model-xyz is not a valid model ID","code":400}}` |
| Missing model field | ✅ Pass | `{"error":{"message":"No models provided","code":400}}` |
| Empty messages array | ✅ Pass | `{"error":{"message":"Input required...","code":400}}` |

---

## Issues Found

### Critical

_None_

### High

2. **Non-OpenAI models not working with BYOK**
   - Anthropic and Google models return "not a valid model ID"
   - Only OpenAI models work via BYOK headers

3. **Legacy `/v1/completions` endpoint returns 404**
   - May break clients expecting OpenAI-compatible completions endpoint

### Medium

4. **BYOK `is_byok: false` reporting bug**
   - OpenAI BYOK requests work but response shows `is_byok: false`
   - Usage may be incorrectly charged

---

## Skipped Tests

| Test | Reason |
|------|--------|
| Team Invitations | Requires second email/account |
| RBAC | Requires multiple users with different roles |
| Full Account Creation | Used existing account; tested "Create Project" flow instead |

---

## Environment Details

```
Gateway URL: https://gateway.mastra.ai
API URL: https://server.mastra.ai
Organization: testing-org (org_01KNA8TV4V10BCAVSMZC44HCP5)
Project ID: f35d6a7b03ad7626dc4259b4
```

---

## Recommendations

1. **Implement Thread API endpoints** — or document that threads are UI-only
2. **Fix BYOK model validation** — add support for Anthropic/Google model IDs
3. **Fix `is_byok` flag** — should return `true` when BYOK header is used
4. **Clarify legacy endpoint status** — is `/v1/completions` deprecated or missing?
