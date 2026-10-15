---
'@mastra/connect': patch
---

Fixed Google Drive tools failing on shared drives: google_drive_create_folder, google_drive_upload_document, and google_drive_move_file now send supportsAllDrives so agents can write to team shared drives. Added two new Google Drive tools from upstream templates: google_drive_export_file (export Docs/Sheets/Slides to PDF and other formats) and google_drive_list_revisions. Fixed fireflies_get_transcript failing with a validation error because Fireflies returns numeric speaker_id, start_time, and end_time values that the sentence schema only accepted as strings.
