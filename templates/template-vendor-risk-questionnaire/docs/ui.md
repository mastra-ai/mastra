# Questionnaire UI

`demo_ui` contains a Svelte 5 and Bits UI client. It communicates with Mastra over HTTP and uses the existing local evidence profile, questionnaire workflow, review validation and domain metrics.

## Run locally

Configure `.env` and `.runtime/profile.json` as described in the README. From the template directory, run:

```sh
npm run dev
```

In another terminal:

```sh
npm install --prefix demo_ui --workspaces=false
npm run dev --prefix demo_ui
```

Open `http://127.0.0.1:5173`. Vite forwards `/vrq` to `http://127.0.0.1:4111`; set `MASTRA_URL` in the UI environment to change that target.

Upload an XLSX or DOCX questionnaire, up to 10 MiB. The browser sends the selected local file directly to the API. The server persists the original bytes in its runtime database before starting the questionnaire workflow. Known mappings follow the same intake as `respond`; other mappings and prefilled replacements require answers to the existing operator prompts. The questionnaire list refreshes every three seconds while the page is visible.

Open a questionnaire to inspect original questions, drafts, review reasons, limitations and citations. Select a disposition for every question. Corrections keep their source bindings and undergo the existing support and security checks. Explicitly select any sources that require disclosure approval. Submit the review, inspect the validated complete answer set, then approve it. An answered document becomes downloadable only after publication; download revalidates the publication and evidence.

Review metrics displays the existing `readDomainMetrics` response for the selected run. Five summary values remain visible; the other groups expand individually in a compact two-column layout (one column on mobile). It preserves metric names and units (`Ms`, tokens, USD and ratios), shows unavailable values as `—`, and does not generate additional metrics or seed data.

## Production

Set `NODE_ENV=production` and a nonempty `MASTRA_STUDIO_TOKEN` when starting Mastra. `SimpleAuth` protects Studio and the API in production; a missing token prevents startup. Development and tests remain unauthenticated. Mastra dev sets `MASTRA_DEV=true`, which also disables authentication even though the CLI sets `NODE_ENV=production` internally. The UI requests the token when the API returns 401 and keeps it only in memory. Never put the token in a `VITE_*` variable.

Build the UI with `npm run build --prefix demo_ui`. Serve `demo_ui/dist` from a web server and proxy `/vrq` to Mastra on the same origin, forwarding the Authorization header. The preview command also supports the local proxy. To include Studio in the Mastra production build, use `npm run build -- --studio`.

Keep one Mastra writer process. After restart, pending intake can be resumed from its checkpoint. Interrupted model work requires the existing operator recovery procedure; the UI never automatically restarts it or resets its budget. Approved runs can retry publication. Review remains bound to its revision and digest, so stale decisions are rejected.

## HTTP routes

All routes are registered through Mastra `apiRoutes` and inherit its production authentication.

| Method | Route                                 | Operation                                                                         |
| ------ | ------------------------------------- | --------------------------------------------------------------------------------- |
| POST   | `/vrq/questionnaires`                 | Multipart `file` upload; returns 202 and `runId`                                  |
| GET    | `/vrq/questionnaires`                 | Persisted questionnaires and current processing state                             |
| GET    | `/vrq/questionnaires/:runId`          | Review, saved dispositions, source disclosure and pending intake prompt           |
| POST   | `/vrq/questionnaires/:runId/input`    | Answer the current prompt using its `id` and `answer`                             |
| POST   | `/vrq/questionnaires/:runId/review`   | Validate the existing review decision schema; final approval resumes the workflow |
| POST   | `/vrq/questionnaires/:runId/resume`   | Resume intake or retry an approved publication                                    |
| GET    | `/vrq/questionnaires/:runId/download` | Validated answered XLSX or DOCX                                                   |
| GET    | `/vrq/questionnaires/:runId/metrics`  | Existing domain metrics                                                           |

`202` means work was accepted. Poll the detail route for completion or its persisted error. `409` includes stale revisions, busy runs and invalid publication state; `400` indicates invalid input.

Run `npm run check --prefix demo_ui`, `npm run build --prefix demo_ui`, `npm run typecheck` and `npm run test -- tests/integration/http.test.ts` to check changes.
