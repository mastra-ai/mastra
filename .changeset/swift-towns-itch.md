---
'@mastra/client-js': minor
'@mastra/playground-ui': patch
'@mastra/server': patch
'@mastra/core': patch
'@mastra/mongodb': patch
'@mastra/libsql': patch
'@mastra/pg': patch
---

Added scorer version management and CMS draft/publish flow for scorers.

- Added scorer version methods to the client SDK: `listVersions`, `createVersion`, `getVersion`, `activateVersion`, `restoreVersion`, `deleteVersion`, `compareVersions`.
- Added `ScorerVersionCombobox` for navigating scorer versions with Published/Draft labels.
- Scorer edit page now supports Save (draft) and Publish workflows with an "Unpublished changes" indicator.
- Storage list methods for agents and scorers no longer default to filtering only published entities, allowing drafts to appear in the playground.
