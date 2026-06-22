---
'@mastra/server': minor
'@mastra/client-js': minor
---

feat(server, client-js, example): add Projects to MastraCode web app

**Server** (`@mastra/server`):
- Added `PUT /harness/:id/sessions/:rid/state` route that merges key-value pairs into session state

**Client JS** (`@mastra/client-js`):
- Added `setState(updates)` method to `HarnessSession`

**Example** (`examples/mastra-code-react`):
- Projects: named bindings to filesystem paths, persisted in localStorage
- ProjectPicker component in header with system directory picker (Chromium) + manual path fallback
- Dynamic workspace factory reads `projectPath` from session state per-request
- Agent instructions dynamically reference active project path
- StatusLine shows active project name
- New scenario test: project-switch (setState + workspace resolution)
