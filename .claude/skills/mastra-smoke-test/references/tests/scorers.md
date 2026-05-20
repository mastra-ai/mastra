# Scorers Testing (`--test scorers`)

## Purpose

Verify evaluation scorers page loads and displays available scorers.

## Steps

### 1. Navigate to Scorers Page

- [ ] Open `/evaluation?tab=scorers` in Studio
- [ ] Note if page loads and any errors displayed
- [ ] Record what scorers list shows

### 2. Observe Scorers Display

- [ ] Record which scorers are listed
- [ ] Note what information is shown for each scorer (name, description)
- [ ] Record any error messages

### 3. Check Scorer Details (if available)

- [ ] Click on a scorer to view details
- [ ] Record what configuration is visible
- [ ] Note any run history shown

## Observations to Report

| Check          | What to Record                  |
| -------------- | ------------------------------- |
| Scorers page   | Load behavior, any errors       |
| Scorers list   | Which scorers appear            |
| Scorer details | Configuration and history shown |

## Notes

- Scorers are optional - empty state is OK if none configured
- Default project may include example scorers
- Scorer runs appear in traces as `scorer run: <name>`

## Common Issues

| Issue              | Cause                | Fix                             |
| ------------------ | -------------------- | ------------------------------- |
| Empty scorers list | None configured      | OK - just verify page loads     |
| Page error         | Missing dependencies | Check `@mastra/evals` installed |

## Browser Actions

```
Navigate to: /evaluation?tab=scorers
Wait: For page to load
Verify: Page loads without errors
Verify: Scorers list visible (may be empty)
```

## Curl / API (for `--skip-browser`)

**There is no "execute scorer" HTTP endpoint.** Scorers run automatically
as part of agent / workflow execution (live scoring) and record `score`
rows. To smoke-test scorers over the API you verify (1) they are
registered, and (2) they emit scores when an agent / workflow runs.

**1. List registered scorers**

```bash
curl -s http://localhost:4111/api/scores/scorers | jq 'keys'
```

Pass: returns an object keyed by scorer id (`weather-scorer`,
`translation-quality-scorer`, etc.) for the scorers declared in the
project. Empty `{}` is only acceptable if the project genuinely declares
none.

**2. Get a single scorer's config**

```bash
curl -s http://localhost:4111/api/scores/scorers/<scorerId> | jq '.'
```

Pass: returns a non-null object with `config` and the agents/workflows it
is attached to. `null` means the id is wrong or the scorer is not
registered.

**3. Trigger scoring by running an agent / workflow, then read scores**

```bash
# Run the workflow (or agent) that has scorers attached
curl -s -X POST "http://localhost:4111/api/workflows/<workflowId>/start-async" \
  -H "Content-Type: application/json" \
  -d '{"inputData":{"city":"Tokyo"}}' | jq '.traceId'

# Scores recorded for that run
curl -s "http://localhost:4111/api/observability/scores?page=0&perPage=20" \
  | jq '.scores | map({scorerId, score, reason})'
```

**Pass criteria:**

- `/api/scores/scorers` lists every scorer the template declares
- After a workflow/agent run completes, `/api/observability/scores` has
  new entries with the expected `scorerId`s and numeric `score` values
- Each recorded score has a `runId` / `traceId` tying it back to the
  invoking run

**Common mistakes:**

- Treating `POST /api/scores/scorers/<id>/execute` as real — it does not
  exist. If you see agent output that claims a score without a
  corresponding row in `/observability/scores`, you hallucinated the
  result.
- Expecting scorers to run on ad-hoc text input — they need a live
  agent/workflow run.
