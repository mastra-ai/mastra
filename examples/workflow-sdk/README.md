# Mastra on the Vercel Workflow SDK

This example runs Mastra workflows as durable [Vercel Workflow SDK](https://workflow-sdk.dev) runs, using the `@mastra/workflow` package. It is a Next.js App Router app with two workflows and a small page for driving them.

> **Experimental.** `@mastra/workflow` and Workflow SDK v5 are both pre-release. The API shown here can change without a major version bump.

## What this shows

Both workflows are written with the ordinary Mastra authoring API — `createWorkflow`, `createStep`, `.dountil()`, `.sleep()`, `suspend()`. The only difference from a stock Mastra workflow is where the builders come from:

```ts
// src/mastra/workflow-sdk.ts
import { init } from '@mastra/workflow';
import { mastraRunner } from '@mastra/workflow/workflows';

export const { createWorkflow, createStep } = init({ runner: mastraRunner });
```

Every step then executes as a durable Workflow SDK step, which buys you:

- **`increment-workflow`** — a `.dountil()` loop that counts to 10, then a `.sleep(5000)` before reporting. Each iteration is a separate durable step, and the sleep suspends the run instead of holding a function open.
- **`approval-workflow`** — a step that calls `suspend()` and parks the run until a human approves or rejects it. The decision can arrive from a different process, minutes or days later.

## How the pieces fit together

| Path | Role |
| --- | --- |
| `next.config.ts` | Wraps the config with `withWorkflow()` so the Workflow SDK compiler and its route handlers are wired up. |
| `workflows/mastra.ts` | Re-exports the Workflow SDK workflow/step functions from `@mastra/workflow/workflows` and side-effect imports the Mastra instance so its workflows are registered before a run replays. |
| `src/mastra/index.ts` | The `Mastra` instance. Registers both workflows and a LibSQL store for run snapshots. |
| `src/mastra/workflows/` | The two workflows. |
| `src/app/api/runs/` | Start, status, and resume endpoints. |

Durable step execution is handled by the Workflow SDK, which keeps its own event log under `.workflow-data` during local development. Mastra's LibSQL store (`./mastra.db`) holds run snapshots so a suspended run can be resumed by a later HTTP request.

Two entries in `package.json` look redundant but are not. `@swc/helpers` is there because Next's compiler emits imports for it into application code, and `@libsql/client` because it is listed in `serverExternalPackages`, which leaves it as a runtime require. Both resolve from this app's own `node_modules`, so under a strict package manager they have to be declared here rather than inherited from `next` and `@mastra/libsql`.

## Prerequisites

- Node.js 22.13 or later (required by `@mastra/workflow`)
- No external services. There is no dev server to run alongside this one, no Docker, and no API keys — both `.workflow-data` and `mastra.db` are local files.

> **This example cannot install from npm yet.** `@mastra/workflow` has not been published; it lands in a companion PR. Until it does, `npm install` will fail to resolve that one dependency. Once published, the steps below work as written — they were verified against a local build of the package.

## Running it

```sh
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) and use the buttons to start runs and approve the suspended one.

## Triggering from the command line

Start the counter:

```sh
curl -X POST --json '{"workflow":"incrementWorkflow","value":0}' \
  http://localhost:3000/api/runs
```

Start an approval and capture the run id:

```sh
curl -X POST --json '{"workflow":"approvalWorkflow","amount":250}' \
  http://localhost:3000/api/runs
```

Check its status — it should report `suspended`:

```sh
curl 'http://localhost:3000/api/runs/<runId>?workflow=approvalWorkflow'
```

Approve it:

```sh
curl -X POST --json '{"approved":true,"approver":"sam@example.com"}' \
  http://localhost:3000/api/runs/<runId>/resume
```

### How resuming works

A suspended Mastra step parks on a Workflow SDK hook whose token is `mastra:<runId>:<stepId>`, so the resume route delivers the decision with `resumeHook()` from `workflow/api`. That releases the hook and returns immediately rather than waiting for the workflow to finish, so the route can answer `202` and let the page poll the status endpoint for the outcome. It also makes a double-click on Approve easy to handle: once the first decision has been consumed, the second request finds no hook and gets a `404`.

The more familiar `run.resume()` works here too — a `Run` rebuilt in a process that never saw the run recovers it from the LibSQL store, so resuming, watching, and canceling all work across processes. The difference is that it waits for the run to reach its next stopping point before returning, which is what you want in a script or a server action that needs the final result, and not what you want in a route handler that should return promptly. If you do call it, pass the step you are resuming (`run.resume({ step: 'request-approval', resumeData })`), since the hook token is derived from the step id.

## Inspecting runs

The Workflow SDK ships an observability UI that shows each run, its steps, retries, and sleeps:

```sh
npx workflow web
```

Or, for a terminal interface:

```sh
npx workflow inspect runs
```

## What works today

`.then()`, `.parallel()`, `.branch()`, `.dountil()` / `.dowhile()`, `.foreach()` with concurrency, `.sleep()`, `setState` / `state` across steps, suspend and resume, and step errors surfacing as a failed run.

Not supported yet: nested workflows, time travel, `streamLegacy()`, and `perStep`. `.map()` is untested.

### What this example was run against

The flows above were run end to end against a local build of `@mastra/workflow` with `workflow@5.0.0-beta.36` on Next.js 16 and Turbopack, both under `next dev` and against a production `next build` served by `next start`: the counter loop, its durable sleep parking the run instead of holding a function open, and an approval that suspends, survives the server being killed, and then resumes through the route in a process that never saw it start. All of it on the Workflow SDK's local filesystem world.

Not exercised here: deploying to Vercel, and with it the hosted world and a hosted database; cancelling a run; `watch()` and `stream()`; and `.parallel()` / `.branch()` / `.foreach()`, which these two workflows do not use.

## Deploying

Workflow SDK apps need no special configuration on Vercel. See the [Workflow SDK deployment guide](https://workflow-sdk.dev/docs/deploying) for other targets.

The storage URL does have to change, though. LibSQL falls back to a local file here, which is fine while one process serves every request, but on serverless each invocation gets its own empty copy of that file — so a resume would fail to find the run it is resuming, which is the one thing the store is there to prevent. Set `DATABASE_URL` to a hosted libsql database (and `DATABASE_AUTH_TOKEN` with it); `src/mastra/index.ts` reads both.
