---
'@mastra/code-sdk': patch
'mastracode': patch
---

Fixed browser profile, executable and storage-state paths starting with `~` staying literal on Windows. They now resolve to your home directory, so the browser profile no longer lands in a `~` folder inside each project and stays logged in across projects. Paths already saved with `~` in settings are resolved when loaded. Any stray `~` folders created previously can be deleted.
