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
