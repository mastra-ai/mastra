# Web UI and HTTP API

Use the web demo to upload a questionnaire, review draft answers and download the approved file. The Svelte client in `demo_ui` calls Mastra's HTTP API and uses the same evidence profile and review checks as the terminal flow.

## Run locally

From the template directory:

1. Install both the backend and UI dependencies:

   ```bash
   npm install
   ```

2. Create `.env` if you haven't configured it yet, then open it and set `OPENAI_API_KEY` and a private random `MASTRA_STUDIO_TOKEN`:

   ```bash
   cp .env.example .env
   ```

   Generate an access token with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` and paste it into `.env`. The server requires this token in development and production.

3. Prepare the fictional sample files and start both applications:

   ```bash
   npm run demo
   npm run dev
   ```

4. Open [the web demo](http://127.0.0.1:5173) and enter your `MASTRA_STUDIO_TOKEN` when prompted. [Mastra Studio](http://127.0.0.1:4111) is available for workflow and trace inspection.

The demo files are `.runtime/demo/questionnaire.xlsx` and `.runtime/demo/questionnaire.docx`. If the file picker hides `.runtime`, enter the full path or enable hidden files.

`npm run dev` starts both processes in one terminal. Ctrl+C stops both; if either exits, the other stops too. The UI requires port 5173 and reports a conflict if another process owns it.

To start them separately, run `npm run dev:mastra` and `npm run dev:ui` in separate terminals. Stop existing servers before switching to the combined command. For terminal-only use, see [local operation](local-operation.md).

## Shared service limits

The questionnaire API admits at most 60 authenticated mutations per minute and two active background jobs across all run IDs. Waiting for operator input also occupies a job slot. `REQUEST_LIMIT` asks you to wait one minute; `ACTIVE_RUN_LIMIT` asks you to finish or cancel an active job before retrying.

Every model-call reservation, including CLI and workflow calls, shares a rolling 24-hour limit of 10,000 calls and $50 of reserved estimated cost per database. Reservations are atomic across runs and remain in `vrq_service_usage` across restarts and run cleanup. Reservations are not refunded when actual usage is lower. Old entries expire after 24 hours. Exceeding either this allowance or the per-run budget stops that run with `BUDGET_EXHAUSTED`; start a new run after capacity becomes available.

The limits are defined in `src/mastra/contracts/service-limits.ts`. The cost uses each run's configured token rates and is not a provider billing cap. Keep one writer process per database; separate databases have separate allowances.

## Upload, review and download

1. In **Upload**, select the sample `questionnaire.xlsx`, then select **Submit**. Uploads accept XLSX or DOCX files up to 10 MiB.
2. Open the new item under **Questionnaires**. If mapping prompts appear, use the [field-mapping walkthrough](intake.md#upload-and-map-in-the-frontend). Confirm any intended prefilled replacement with `REPLACE`.
3. Wait for drafting to finish. The list refreshes every three seconds while the page is visible.
4. Read each question, draft, limitation and citation. Choose whether to release the answer, correct it, mark it unknown or withhold it. Explicitly select any cited sources that require sharing permission.
5. Select **Review** to validate your choices. Resolve reported issues and inspect the complete validated answer set.
6. Select **APPROVE** and confirm in the dialog when you are ready to authorize export.
7. When export finishes, select **Download**. Open the answered file and check its responses, including answers marked unknown or withheld.

For example, if a question asks for a test result but the available evidence contains only a policy, choose `unknown` instead of releasing an unsupported result. See [review choices](review.md#choose-what-to-share).

Saved review choices survive a reload. If a correction fails validation, check its cited evidence and resolve the reported issue before approving the answers.

### Read the review cards

Each card separates the original question, review notes, answer and cited evidence. Review notes explain each diagnostic code. Evidence shows the quoted text, source location and sharing policy without exposing technical hashes.

The answer field is always visible when a draft exists. Editing it selects **Release edited answer**; choosing **Release original draft** restores the original text. **Mark as unknown** and **Withhold answer** exclude the draft from the export. Sharing a source that requires review also needs its permission checkbox. **Review** validates these choices; only the complete validated set can be approved. Any further edits require another review.

`INVALID_ATTRIBUTION` means a quotation does not match the text at its cited location. Editing the answer cannot fix its citation in the demo. Choose **Mark as unknown** or **Withhold answer** for that draft. Custom clients can [submit a corrected citation through the API](#saved-files-and-citation-checks).

## Cancel or remove a questionnaire

**Cancel execution** stops active processing, including a run waiting for a mapping answer. The state changes to `cancelling` while work settles, then to `cancelled`.

Cancelled runs remain available for inspection and metrics. They cannot be resumed, reviewed or downloaded through the UI. Upload the source again to start a new run.

To remove an inactive questionnaire:

1. Select **Remove** in the questionnaire list.
2. Read and confirm the dialog.
3. Check that the questionnaire is no longer listed.

Removal persists across restarts and disables all questionnaire HTTP routes for that run. It retains underlying audit records and local files. Use [explicit cleanup](review.md#explicit-cleanup) to remove selected runtime data. An active run must finish cancelling before it can be removed.

## Read review metrics

Open **Review metrics** on a questionnaire. Five summary values remain visible; expand the other groups for details.

The metrics show answer outcomes, model usage and review activity. `Ms` means milliseconds, token fields count tokens, USD values are estimated dollars, and ratios are fractions. `—` means unavailable, not zero. See [metric definitions](evaluation.md#inspect-a-questionnaires-metrics).

## Production

Production requires a built backend, a built UI, authentication and a web server that forwards API requests to Mastra. A **reverse proxy** is the server configuration that forwards those requests while serving the UI from the same website.

### 1. Configure the backend

Stop the dev server. In the backend environment, set:

- `OPENAI_API_KEY` for model calls.
- `NODE_ENV=production`.
- A nonempty secret `MASTRA_STUDIO_TOKEN` for Studio and API access.

Keep `.runtime/profile.json`, evidence files and writable runtime storage available to the backend. Run one Mastra writer process.

`SimpleAuth` protects Studio and the API in every mode. A missing token prevents startup, including with `MASTRA_DEV=true`. A template middleware also requires the bearer token on `/vrq/*`, so multipart requests from another website cannot start work without the secret. The token is entered by the operator and kept only in browser memory; it is never added automatically by the Vite proxy.

### 2. Build and start Mastra

From the template directory, with the environment above configured:

```bash
npm run build
npm run start
```

To include Studio in the production build, use `npm run build -- --studio` for the build step.

### 3. Build and serve the UI

```bash
npm run build --prefix demo_ui
```

Configure your web server to serve `demo_ui/dist` and forward `/vrq` requests to Mastra on the same origin. Preserve the request path and the `Authorization` header. The web server must accept the questionnaire upload size, including multipart overhead.

For local Vite development and preview, `/vrq` is already proxied to `http://127.0.0.1:4111`. Set `MASTRA_URL` in the UI environment to change that target. A deployed static build needs its own web-server proxy configuration.

### 4. Verify authentication and upload

Open the deployed UI. It asks for the token when the API returns `401` and keeps the token only in memory. Upload a sample file and check that review is available after processing. Never put the token in a `VITE_*` variable, because those values can be exposed in client code.

After a backend restart, pending intake can resume from its checkpoint. Interrupted model work requires the [operator recovery procedure](review.md#restart-and-retry); the UI does not automatically restart it or reset the budget. Approved runs can retry export. Outdated review revisions and digests are rejected.

### Ask a coding LLM for the deployment configuration

<details>
<summary>Show optional prompt</summary>

```text
Prepare deployment configuration for the vendor-risk-questionnaire template.

Target host or platform: [target]
Web server or proxy: [choice, or ask me]
Public hostname: [hostname]
Mastra internal address: [address]
Persistent runtime and evidence paths: [paths]

Read package.json, demo_ui/package.json, demo_ui/vite.config.ts,
src/mastra/server/auth.ts, src/mastra/runtime/paths.ts and docs/ui.md.
Generate configuration files appropriate for my chosen host. Ask for missing
hosting details before selecting paths or services. Serve demo_ui/dist and
proxy /vrq to Mastra on the same origin, preserving paths and Authorization.
Allow 10 MiB file uploads plus multipart overhead.

Use one production Mastra writer process with persistent storage. Set
NODE_ENV=production, leave MASTRA_DEV unset, and reference OPENAI_API_KEY
and MASTRA_STUDIO_TOKEN through the host's secret configuration. Do not put
secrets in VITE_* variables, the browser bundle or committed files.

Show build/start commands and checks for unauthenticated rejection,
authenticated access and upload. Explain any host-specific requirements.
Create reviewable configuration files; do not deploy or run a questionnaire.
```

</details>

## HTTP routes

All routes are registered through Mastra `apiRoutes` and require authentication in development and production. `:runId` means the ID returned when you upload a questionnaire.

| Method | Route                                 | Operation                                                             |
| ------ | ------------------------------------- | --------------------------------------------------------------------- |
| POST   | `/vrq/questionnaires`                 | Upload multipart `file`; returns `202` and `runId`                    |
| GET    | `/vrq/questionnaires`                 | List saved questionnaires and processing state                        |
| GET    | `/vrq/questionnaires/:runId`          | Read review, saved choices, disclosure details and any pending prompt |
| DELETE | `/vrq/questionnaires/:runId`          | Remove an inactive run from the UI and HTTP access                    |
| POST   | `/vrq/questionnaires/:runId/cancel`   | Cancel processing or a pending intake prompt                          |
| POST   | `/vrq/questionnaires/:runId/input`    | Answer the current prompt using its `id` and `answer`                 |
| POST   | `/vrq/questionnaires/:runId/review`   | Validate a review decision; final approval resumes export             |
| POST   | `/vrq/questionnaires/:runId/resume`   | Resume intake or retry approved export                                |
| GET    | `/vrq/questionnaires/:runId/download` | Download the validated answered XLSX or DOCX                          |
| GET    | `/vrq/questionnaires/:runId/metrics`  | Read saved domain metrics                                             |

### Saved files and citation checks

The server stores the uploaded original bytes before starting the workflow. Corrections keep their citation bindings and pass support and security checks. Download validates the exported file and evidence again; approval alone does not make an invalid file downloadable.

Each citation must quote the text at its exact source location. For example, a citation to a JSON field containing `false` cannot quote a combination of that field, the organization and the date. A mismatch produces `INVALID_ATTRIBUTION`; earlier versions reported `INVALID_MAPPING` during review. A custom client can submit a corrected citation through the [review decision contract](review.md#inspect-and-submit-review-json). The server validates it against the original source.

### Try an upload from the terminal

With `npm run dev` running, open a second terminal in the template directory. Set `MASTRA_STUDIO_TOKEN` in that terminal to the same value configured in `.env`; the server does not export it to other shells.

```bash
curl --fail-with-body \
  -H "Authorization: Bearer $MASTRA_STUDIO_TOKEN" \
  -F "file=@$PWD/.runtime/demo/questionnaire.xlsx" \
  http://127.0.0.1:4111/vrq/questionnaires
```

This starts a real questionnaire run and can make provider calls. Copy the returned `runId`, then replace `RUN_ID` below:

```bash
curl --fail-with-body \
  -H "Authorization: Bearer $MASTRA_STUDIO_TOKEN" \
  http://127.0.0.1:4111/vrq/questionnaires/RUN_ID
```

Check the detail response for progress, a pending mapping prompt or a saved error. You can finish review in the web UI. Every request requires the bearer header in development and production.

`202` means work was accepted, not completed. `400` means invalid input. `409` can mean a stale review, a busy run or a state that does not allow export. Read the current detail before retrying; do not resubmit an old approval blindly.

For a custom review client, use the [review decision contract](review.md#inspect-and-submit-review-json). The multipart upload endpoint accepts a file and interactive mapping answers, not a JSON mapping object.

## Check UI changes

Run the checks relevant to your changes:

```bash
npm run check --prefix demo_ui
npm run build --prefix demo_ui
npm run typecheck
npm run test -- tests/integration/http.test.ts
```
