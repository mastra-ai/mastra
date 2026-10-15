---
'@mastra/connect': patch
---

**Google Drive**

- Fixed `google_drive_create_folder`, `google_drive_upload_document`, and `google_drive_move_file` failing with 404 errors on shared drives. Agents can now write to team shared drives.
- Added `google_drive_export_file` for exporting Docs, Sheets, and Slides to PDF and other formats.
- Added `google_drive_list_revisions` for listing a file's revision history.

```ts
const toolset = await tools({ providers: ['google-drive'] })();

await toolset.google_drive_export_file.execute({
  fileId: '1Kj3d86Z-Sfd56YP4dImQ-ggMRyP2QZ_BRO33zOO224c',
  mimeType: 'application/pdf',
});
```

**Fireflies**

- Fixed `fireflies_get_transcript` failing validation on every transcript. Fireflies returns numeric `speaker_id`, `start_time`, and `end_time` values that the schema only accepted as strings; the tool now accepts and normalizes them.
