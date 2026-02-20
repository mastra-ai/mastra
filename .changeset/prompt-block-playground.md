---
'@mastra/playground-ui': minor
---

Added prompt block management to the Playground. You can now create, edit, version, and publish reusable prompt blocks from a dedicated "Prompts" tab in the sidebar.

**Prompt block editor features:**
- Draft/published versioning with version history dropdown
- Variables editor (JSON schema) for defining template variables
- Display conditions for conditional block rendering
- Variable highlighting in the content editor

**Agent instruction block improvements:**
- Added support for referencing saved prompt blocks in agent instructions via a new "Reference saved prompt block" option in the add block dropdown
- Fixed save/publish button behavior — "Save" is now disabled when no changes have been made, and "Publish" is only enabled when there are unpublished drafts
