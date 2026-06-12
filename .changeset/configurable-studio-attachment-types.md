---
'mastra': minor
'@mastra/playground-ui': patch
---

Studio chat attachments: configurable allowed file types via `MASTRA_STUDIO_ATTACHMENT_TYPES` (comma-separated MIME allowlist with `type/*` wildcards, e.g. `image/*,application/pdf,text/csv`). When set, the file picker filters to the allowed types and disallowed files/URLs are rejected with visible feedback instead of silently ignored; when unset, behavior is unchanged (all types accepted). Binary attachments that are not PDFs (spreadsheets, docs, ...) are now sent as file parts with their own MIME type instead of being read as text, and common document/spreadsheet extensions were added to the extension→MIME map.