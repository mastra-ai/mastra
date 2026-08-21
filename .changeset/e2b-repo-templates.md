---
'@mastra/e2b': minor
---

Added `createRepoTemplate` and `repoTemplateAlias`: sha-aliased repository template specs that clone a repo and run its setup command at template build time, so sandboxes start with a warm checkout. Aliases are deterministic (repo + sha + setup command), resolved lazily (exists, then build once), and layered on the default mountable base so git and mount tooling are present. Template builds receive no credentials — clones are tokenless, so private repos degrade to the fallback and the runtime cold clone. Build steps now prep the workspace root as root before cloning as the sandbox user, a failed build falls back to a named workspace-base template with a user-writable `/workspace`, and creating from a broken alias (E2B keeps failed builds' aliases visible to `Template.exists`) retries once on the fallback instead of wedging the session.
