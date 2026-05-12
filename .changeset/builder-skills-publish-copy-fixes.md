---
'@mastra/server': patch
'@mastra/playground': patch
---

Builder Skills: three fixes surfaced by the Builder smoke test.

- `PATCH /stored/skills/:id` with a partial config body (e.g. `{ name }` only) used to spread `undefined` for every unspecified field into the storage layer, causing a `NOT NULL` violation on `mastra_skill_versions.description` (and similar columns) whenever the patch created a new version. The handler now strips `undefined` keys before forwarding the update, so partial PATCH preserves existing config values.
- `POST /stored/skills/:id/publish` returned a raw 500/ENOENT when `skillPath` pointed at a directory that did not exist. The handler now preflight-checks `skillPath` with `fs.stat` and returns a 400 with a clear "Skill source directory not found" message.
- The Library Copy flow (`useCopySkill`) used to forward `license: null` and `files: null` from the source skill, which the create schema rejects. The hook now strips null-valued optional fields before posting.

Also adds a Registries card to the Agent Builder Infrastructure page so the `registries.skillsSh` state from `GET /api/builder/infrastructure/status` is visible.
