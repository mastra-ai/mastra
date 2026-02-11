---
"@mastra/core": patch
---

Fix LocalFilesystem.resolvePath handling of absolute paths and improve filesystem info.

- Fix absolute path resolution: paths were incorrectly stripped of leading slashes and resolved relative to basePath, causing PermissionError for valid paths (e.g. skills processor accessing project-local skills directories).
- Make `FilesystemInfo` generic (`FilesystemInfo<TMetadata>`) so providers can type their metadata.
- Move provider-specific fields (`basePath`, `contained`) to metadata in LocalFilesystem.getInfo().
- Update getInstructions() for uncontained filesystems to warn agents against listing /.
- Use FilesystemInfo type in WorkspaceInfo instead of duplicated inline shape.
