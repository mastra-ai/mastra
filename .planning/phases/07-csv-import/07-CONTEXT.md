# Phase 7: CSV Import - Context

**Gathered:** 2026-01-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Bulk item creation from CSV with validation and explicit column mapping via playground UI. CLI import deferred to future phase.

</domain>

<decisions>
## Implementation Decisions

### Column Mapping UX

- Braintrust-style drag-drop: columns default to input, user drags to recategorize
- Flow: Upload → Preview table (first 5 rows) → Map columns → Validate → Confirm import
- Only input mapping required; expectedOutput and metadata optional
- One column per field only (multi-column combining deferred)
- Auto-parse JSON strings in CSV cells; warn (don't fail) if JSON parse fails
- Empty cells become null (not empty string)

### Validation Feedback

- Validation runs before commit (not during preview)
- Error summary at top + invalid rows highlighted in table
- Validation rules: input required + JSON type checking
- On errors: user must fix CSV and re-upload (no "skip invalid" option)

### File Handling

- No explicit file size limit (browser/server naturally constrain)
- UTF-8 encoding only
- Comma delimiter only (standard CSV)
- Header row required

### CLI vs UI

- This phase is UI-only (playground)
- CLI CSV import deferred to future phase
- SDK/programmatic import available via existing `addItem` method

### Claude's Discretion

- Specific drag-drop interaction implementation
- Preview table styling and pagination
- Error message formatting
- Upload dialog layout

</decisions>

<specifics>
## Specific Ideas

- Column mapping inspired by [Braintrust](https://www.braintrust.dev/docs/annotate/datasets) - simple drag to recategorize
- JSON auto-parsing from [Langfuse](https://langfuse.com/changelog/2025-01-27-Dataset-Items-csv-upload) - nested JSON objects supported

</specifics>

<deferred>
## Deferred Ideas

- CLI CSV import with `--input=col1 --expected=col2` flags — future phase
- Multi-column combining into JSON objects — future enhancement
- Auto-detect delimiter (semicolon, tab) — future if needed
- "Skip invalid rows" option — future if requested

</deferred>

---

_Phase: 07-csv-import_
_Context gathered: 2026-01-26_
