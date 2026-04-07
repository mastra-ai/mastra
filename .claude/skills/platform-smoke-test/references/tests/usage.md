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
1. Select different date ranges (Today, Week, Month)
2. [ ] Data updates accordingly
3. [ ] Recent requests appear in "Today"

### 4. Verify Cost Tab
Navigate to Usage → Cost tab

- [ ] Cost breakdown by model
- [ ] Input vs output costs shown
- [ ] BYOK requests show $0 (if applicable)

## Expected Results

| Check | Expected |
|-------|----------|
| Token counts | Match request sizes |
| Cost breakdown | Per-model costs |
| Charts | Render correctly |
| Date range | Filters data |

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| No usage data | No requests made | Make some requests first |
| Charts empty | Date range wrong | Select correct period |
| Wrong costs | Cached data | Refresh page |

## Notes

- Usage may take a few minutes to update
- BYOK requests tracked but not charged
- OM tokens tracked separately
