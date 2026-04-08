# Usage & Billing Testing (`--test usage`)

## Purpose

Test usage tracking and billing displays.

## Prerequisites

- `MASTRA_API_KEY` set
- `API_URL` set
- Some API requests made (for usage data)

## Steps

### 1. Generate Usage with Multiple Models

```bash
# OpenAI
curl -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer $MASTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "openai/gpt-4o", "messages": [{"role": "user", "content": "Test for usage tracking"}]}'

# Anthropic
curl -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer $MASTRA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "anthropic/claude-sonnet-4-20250514", "messages": [{"role": "user", "content": "Test for usage tracking"}]}'

# Multiple requests for charts
for i in {1..5}; do
  curl -s -X POST "$API_URL/v1/chat/completions" \
    -H "Authorization: Bearer $MASTRA_API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"model\": \"openai/gpt-4o\", \"messages\": [{\"role\": \"user\", \"content\": \"Request $i\"}]}"
  sleep 1
done
```

### 2. Verify Usage Dashboard

Navigate to Dashboard → Project → Usage

**Token Counts:**

- [ ] Total tokens displayed
- [ ] Breakdown by input/output tokens
- [ ] Numbers match approximate request sizes

**Cost Breakdown:**

- [ ] Cost per model shown
- [ ] OpenAI and Anthropic separated
- [ ] Total cost accurate

**Charts:**

- [ ] Usage over time chart renders
- [ ] Model breakdown chart shows both providers
- [ ] Date range selector works

### 3. Check Date Range

**⚠️ REQUIRED: Actually click each date range option**

1. [ ] Click "Today" filter - record what data appears
2. [ ] Click "Week" filter - record if data changes
3. [ ] Click "Month" filter - record if data changes
4. [ ] Note if recent requests appear correctly in each view

### 4. Verify Cost Tab

**⚠️ REQUIRED: Navigate to the Cost tab**

1. Find and click on "Cost" tab (may be a sub-tab within Usage)
2. In the Cost view:
   - [ ] Record cost breakdown by model
   - [ ] Record if input vs output costs shown separately
   - [ ] Record if BYOK requests show $0 (if you've made BYOK requests)

## Observations to Report

| Check          | What to Record                               |
| -------------- | -------------------------------------------- |
| Token counts   | Record token values displayed                |
| Cost breakdown | Record costs shown per model                 |
| Charts         | Note if charts render, describe what appears |
| Date range     | Note if data changes with range selection    |

## Common Issues

| Issue         | Cause            | Fix                      |
| ------------- | ---------------- | ------------------------ |
| No usage data | No requests made | Make some requests first |
| Charts empty  | Date range wrong | Select correct period    |
| Wrong costs   | Cached data      | Refresh page             |

## Notes

- Usage may take a few minutes to update
- BYOK requests tracked but not charged
- OM tokens tracked separately
