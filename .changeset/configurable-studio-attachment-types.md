---
'mastra': minor
'@mastra/playground-ui': patch
---

Studio chat attachments: configurable allowed file types via the `MASTRA_STUDIO_ATTACHMENT_TYPES` env var — a comma-separated MIME allowlist supporting `type/*` wildcards.

```bash
MASTRA_STUDIO_ATTACHMENT_TYPES="image/*,application/pdf,text/csv" mastra dev
```

When set:

- the file picker filters to the allowed types via the `accept` attribute;
- disallowed files and URL attachments are rejected with visible feedback in the attach dialog (previously they disappeared silently).

When unset, behavior is unchanged (all file types accepted).

Also:

- binary attachments that are not PDFs (spreadsheets, docs, ...) are now sent as file parts with their own MIME type instead of being read as text;
- the extension→MIME map gains common document/spreadsheet/text types (csv, xlsx, docx, txt, md, json, ...).