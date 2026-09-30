---
'@mastra/connect': minor
---

**Added Google Workspace and Microsoft 365 toolsets to @mastra/connect.** Agents connected through Mastra Cloud can now:

- Edit Google Docs (including PDF/DOCX/HTML/text export), manage Google Drive files, folders, permissions, and shared drives, and read and write Google Sheets alongside the existing Gmail and Google Calendar toolsets.
- Send and organize Outlook mail, manage OneDrive files, and drive SharePoint Online sites, lists, and drives.
- Edit Word documents (including PDF export and raw `.docx` download), create and update Excel workbooks and worksheets (with paginated worksheet listing), and edit PowerPoint presentations (including PDF export, slide content download, and permission listing).

**Expanded the platform proxy surface so more provider templates run on it out of the box.** The proxy now supports:

- `responseType: 'arraybuffer'` on a proxy request, returning the body as an `ArrayBuffer` instead of parsed JSON. This unlocks document-export and file-download tools across the new toolsets and any future providers that ship them.
- `platformProxy.proxy(config)`, a method-agnostic dispatcher that mirrors the Nango SDK's `proxy` helper (defaults to GET when `method` is omitted) so templates authored against `nango.proxy(...)` can generate without hand-editing.
- `platformProxy.paginate(config)`, an async-iterable helper that walks `link`, `offset`, and `cursor` paginated endpoints and yields one page of items at a time. Templates like Microsoft Graph's `list-worksheets` iterate cleanly through Graph's `@odata.nextLink` chains without any custom pagination code.
- Preserved `node:crypto` imports in generated tools, letting templates that use `randomUUID` (for example, to produce unique file names in `copy-word-document`) generate straight from the upstream integration templates.
