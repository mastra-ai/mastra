---
"@mastra/core": patch
"@mastra/server": patch
"@mastra/playground-ui": patch
"@mastra/s3": patch
"@mastra/gcs": patch
---

Fix LocalFilesystem.resolvePath handling of absolute paths and improve workspace filesystem info.

- Fix absolute path resolution: paths were incorrectly stripped of leading slashes and resolved relative to basePath, causing PermissionError for valid paths (e.g. skills processor accessing project-local skills directories).
- Make `FilesystemInfo` generic (`FilesystemInfo<TMetadata>`) so providers can type their metadata.
- Move provider-specific fields (`basePath`, `contained`) to metadata in LocalFilesystem.getInfo().
- Expose filesystem info from getInfo() in the GET /api/workspaces/:id API response.
- Default Studio file browser to basePath when filesystem containment is disabled.
- Update getInstructions() for uncontained filesystems to warn agents against listing /.
- Ensure all filesystem providers return all common fields (error, readOnly) from getInfo().
