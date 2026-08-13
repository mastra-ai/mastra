---
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/pg': patch
'@mastra/mysql': patch
'@mastra/mongodb': patch
'@mastra/memory': patch
'@mastra/factory': patch
'@mastra/code-sdk': patch
---

Subconscious fixes for factory sessions:

- Knowledge facts now support an optional metadata record (for example the capture agent's reasoning for keeping or pinning a fact), persisted across the inmemory, libsql, pg, mysql, and mongodb knowledge domains (a nullable jsonb column on the SQL stores). There is no migration for existing installations: fresh tables include the column, but existing knowledge tables must be recreated or gain the `metadata` jsonb column manually.
- The subconscious curate, learn, and remind agents resolve their model from the per-agent config first, then the observational memory model, and only then the main agent, so they work in hosts that never supply a main-agent reference.
- A direct curation entry point (`Memory.runCuration`) runs the curator over the pending fact worklist without a reflection, and a new `curationCadence` subconscious option fires it after every N committed observation runs.
- Factory work sessions run the curator on every phase exit (replacing the previous reflect-on-transition hook), set the curation cadence to 3, and seed the authoritative organization id into session state so knowledge writes are scoped to the real org instead of a user id.
- The default capture schema gains an optional per-fact `reason`, and the pin tools accept a `reason` too; pin edits carry existing metadata forward.
