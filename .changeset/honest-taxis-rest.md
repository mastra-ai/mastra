---
'@mastra/connect': minor
---

**Added Google Workspace and Microsoft 365 toolsets to @mastra/connect.** Agents connected through Mastra Cloud can now:

- Edit Google Docs (including PDF/DOCX/HTML/text export), manage Google Drive files, folders, permissions, and shared drives, and read and write Google Sheets alongside the existing Gmail and Google Calendar toolsets.
- Send and organize Outlook mail, manage OneDrive files, and drive SharePoint Online sites, lists, and drives.
- Edit Word documents (including PDF export), create and update Excel workbooks and worksheets, and edit PowerPoint presentations (including PDF export and slide content download).

**Added binary response support to the platform proxy.** Tool templates that need to fetch binary payloads (file exports, image downloads) can now pass `responseType: 'arraybuffer'` on a proxy request; the response body is returned as an `ArrayBuffer` instead of being parsed as JSON. This unlocks document-export and file-download tools across the new toolsets and any future providers that ship them.
