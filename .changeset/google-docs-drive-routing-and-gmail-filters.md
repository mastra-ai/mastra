---
'@mastra/connect': minor
---

Fix two production bugs in the Google integrations by regenerating against [NangoHQ/integration-templates#699](https://github.com/NangoHQ/integration-templates/pull/699).

**Google Docs / Google Drive** — `google_docs_export_document` and `google_docs_list_revisions` always failed at runtime with `Proxy base URL override is not allowed for this connection`. They call `/drive/v3/files/...` and set `baseUrlOverride: 'https://www.googleapis.com'`, but the `google-docs` provider does not permit a base-URL override. These are Drive API operations, not Docs API operations, so they now live under `google-drive`:

- `google_docs_export_document` → `google_drive_export_file` (also broadened to any Google Workspace file: Doc, Sheet, Slide, Drawing, with the matching MIME-type set)
- `google_docs_list_revisions` → `google_drive_list_revisions` (input key renames `documentId` → `fileId`)

**Google Mail** — `google_mail_list_filters` threw when the mailbox had no filters (Gmail returns `{}` or `{"filter": null}` for an empty list, and the old `.parse()` schema did not tolerate either shape). The regenerated tool uses `safeParse` with a nullish `filter` field and returns `{ filters: [] }` on an empty mailbox.

Callers that used `google_docs_export_document` or `google_docs_list_revisions` must switch to a `google-drive` connection (set `MASTRA_GOOGLE_DRIVE_CONNECTION_ID`) and the new tool names and input shape.
