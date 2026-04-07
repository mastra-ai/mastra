# Scorers Testing (`--test scorers`)

## Purpose
Verify evaluation scorers page loads and displays available scorers.

## Steps

### 1. Navigate to Scorers Page
- [ ] Open `/evaluation?tab=scorers` in Studio
- [ ] Verify page loads without errors
- [ ] Check for scorers list

### 2. Verify Scorers Display
- [ ] List shows available scorers
- [ ] Each scorer shows name and description
- [ ] No error messages

### 3. Check Scorer Details (if available)
- [ ] Click on a scorer to view details
- [ ] Verify configuration is visible
- [ ] Check for any run history

## Expected Results

| Check | Expected |
|-------|----------|
| Scorers page | Loads without errors |
| Scorers list | Shows configured scorers |
| Scorer details | Name, description visible |

## Notes

- Scorers are optional - empty state is OK if none configured
- Default project may include example scorers
- Scorer runs appear in traces as `scorer run: <name>`

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| Empty scorers list | None configured | OK - just verify page loads |
| Page error | Missing dependencies | Check `@mastra/evals` installed |

## Browser Actions

```
Navigate to: /evaluation?tab=scorers
Wait: For page to load
Verify: Page loads without errors
Verify: Scorers list visible (may be empty)
```
