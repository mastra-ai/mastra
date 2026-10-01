---
'@mastra/connect': minor
---

**Added Google Docs, Google Drive, and Google Sheets toolsets to @mastra/connect.** Agents connected through Mastra Cloud can now edit Google Docs (including PDF/DOCX/HTML/text export), manage Google Drive files, folders, permissions, and shared drives, and read and write Google Sheets, alongside the existing Gmail and Google Calendar toolsets.

**Added binary response support to the platform proxy.** Tool templates that need to fetch binary payloads (file exports, image downloads) can now pass `responseType: 'arraybuffer'` on a proxy request; the response body is returned as an `ArrayBuffer` instead of being parsed as JSON. This unlocks document-export tools such as Google Docs' `export-document`, and any future providers that ship binary-download actions.
