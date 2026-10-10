# Upstream review handoff

Provider publication and catalog status: **unpublished candidate**. [Integration request #26590](https://github.com/mastra-ai/mastra/issues/26590) is awaiting maintainer triage and approval. This branch is prepared for a draft PR; approval is required before marking it ready for review. The separate generic core reporting bug and tested fix proposal are filed in [Mastra issue #26580](https://github.com/mastra-ai/mastra/issues/26580). No core fix PR has been opened or merged.

This local branch adds `workspaces/render` and `docs/src/content/en/integrations/sandboxes/render.mdx`, plus one entry in the existing integrations sidebar. That sidebar is also the data source for `IntegrationGrid` on the generic Sandbox overview, so one canonical listing covers both navigation paths without duplicating a provider registry.

Entry tested: a developer looking for isolated code execution opens Docs > Sandboxes and filesystems, selects Render in the Sandboxes grid, then reaches the local candidate's prerequisites and runnable example. Upstream discovery remains unverified until this patch is accepted and published.

## Maintainer decisions before publication

PR readiness checked on October 9, 2026: the implementation has enough evidence for maintainer review, but the submission path starts with a dedicated Render Sandbox feature request. Mastra's current [contribution rules](https://github.com/mastra-ai/mastra/blob/main/CONTRIBUTING.md#contributor-guidelines) require linked issues and maintainer feedback before feature PRs. Feature issues carrying `status: needs triage` or `status: needs approval` cannot yet have a PR; the rules say it will be automatically closed. The dedicated Sandbox integration request is now #26590. The existing Workflows request and the separate cancellation bug remain distinct.

Render will maintain this integration in Mastra's repository. The candidate is `@mastra/render` in `workspaces/render`, following existing providers. This is not a separate Render repository or a documentation-only contribution. Namespace and acceptance remain subject to Mastra review.

The package uses workspace core, catalog tooling, the shared types builder, ESM/CommonJS exports, root pnpm lockfile, existing workspace CI and a minor changeset. New releases use Mastra's versioning and publication workflow. No standalone GitHub or npm publishing workflow is included. Version 0.0.0 marks the unpublished candidate; the changeset requests its first minor release.

Cloud CI uses the existing trusted workspace job. Maintainers must configure `RENDER_API_KEY` and `RENDER_WORKSPACE_ID` with sandbox access. The live test is explicitly skipped when credentials are absent, while deterministic tests run without credentials. No GitHub secrets or npm permissions were changed locally.

Before marking the draft ready for review, obtain maintainer approval on #26590 under the contribution rules above. Keep the generic cancellation fix separate under #26580. No package, issue, integration PR or documentation was published during packaging work.

The draft branch starts from official Mastra main at `640dc7f24d247f52eb211f4888b41242e75361ec` and includes only Sandbox integration changes. The existing Workflows PR and original implementation branch are preserved separately. A small generic cancellation-reporting correction is now proposed below, based on the current-main reproduction.

## Cancellation-reporting proposal

Filed as [Mastra issue #26580](https://github.com/mastra-ai/mastra/issues/26580) after checking current main and related issues/PRs. The public issue includes a credential-free reproduction, the minimal code proposal, verification scope and related merged PR #25752. The exact public snippet was rechecked: published core 1.75.0 and unmodified current main fail, while the separately rebuilt patched core passes. The issue is open; maintainer acceptance and a fix release remain pending.

The source-built official main at `918704fd4608aa4d9d90d4d92c0a3429de2b880a` (core 1.76.0-alpha.5) and published core 1.75.0 incorrectly claim that an aborted command was killed when its provider throws. An attached Render command demonstrably continued and wrote a file after that tool message. Core 1.67.0 passes the same reproduction. Owned cleanup failure can produce the same false assurance.

The adapter cannot suppress this core-generated prefix through `WorkspaceSandbox`. Returning a fabricated exit code would hide an unknown outcome. The public after-tool hook cannot replace the result. This is a generic reporting gap; it does not require a Render-specific API or a process-management feature in core.

- Minimal reproduction: `npm run test:cancellation`, from this package. It uses only public `Workspace`, `WorkspaceSandbox` and `createWorkspaceTools`, without Render or credentials. It intentionally exits nonzero on affected core versions.
- Candidate patch: [upstream-cancellation.patch](upstream-cancellation.patch). It only says a command was killed when `result.killed === true`. Errors and missing kill information retain neutral cancellation text and the provider message.
- Verification: 55 focused upstream command-tool tests pass; the same public reproduction passes against the patched, rebuilt and packed core. The real agent and live cancellation tests used **unmodified** main.
- Evidence: [current-main record](../validation/upstream-current.json), [live cancellation](../validation/upstream-cancellation.json), and [full results](../validation/RESULTS.md).

The original checkout's core is unchanged. The patch was applied only in the ignored source-build fixture for verification. The core fix is proposed in the issue; maintainer approval, a subsequent PR and release remain pending. Render is the maintainer; namespace acceptance and upstream catalog placement remain Mastra maintainer decisions. Workflows still pins core 1.67.0, so the current-main probe is standalone; coexistence is verified at that shared stable version.

## Additional Modal adapter finding

Live cloud verification reproduced the false killed outcome in source-built `@mastra/modal` 0.7.1 with core 1.75.0 and Modal JavaScript SDK 0.10.1. The adapter returned `killed: true` and exit code 137 after abort, while a separate SDK connection observed both parent and child still running. Both processes subsequently wrote delayed files. A normal command control passed. This confirms the earlier controlled SDK-boundary reproduction against the actual cloud service.

A one-second command timeout also left both processes running and producing files. The tool returned exit code 1 without timeout metadata. Preserve this as a separate observed failure; the precise SDK/server responsibility for timeout enforcement has not been isolated. The live sandbox was independently confirmed terminated. See [live evidence and review](../validation/modal-cancellation-live.json), [live script](../scripts/modal-cancellation-live.mjs), and the [initial controlled reproduction](../scripts/other-provider-cancellation.test.mjs).

The abort defect is separate from the shared-tool proposal: that proposal trusts an explicit `killed: true`, so Modal must also correct its process-management metadata or implement and verify actual termination. No Modal code has been modified or issue submitted. LocalSandbox and Docker are passing live controls. Do not generalize this finding into a claim that every sandbox provider is affected.

## Live Docker control

The source-built Docker provider passed real local normal-completion, abort and timeout checks on core 1.75.0. Canceled commands and their child processes stopped, no delayed output appeared, and the container remained usable. Cleanup was verified through both Docker API and CLI. See [Docker evidence](../validation/docker-cancellation.json). LocalSandbox and Docker are passing controls; avoid claiming all third-party providers are affected. Mastra's hosted provider remains untested.

## Live Daytona control

The source-built Daytona adapter 0.11.2 passed all three real cloud behavior cases on core 1.75.0 with SDK 0.201.0: normal completion, abort and timeout. Abort and timeout stopped both parent and child, prevented delayed file writes, and returned correct kill/timeout metadata while leaving the sandbox usable. This is a passing third-party cloud control, distinct from the Modal failure.

The first cleanup check exited nonzero because immediate ID and list observations did not agree. A fresh SDK audit subsequently confirmed `DaytonaNotFoundError` for the test ID and an empty label-filtered list. No Daytona test sandbox remains. See [Daytona evidence](../validation/daytona-cancellation-live.json), [live probe](../scripts/daytona-cancellation-live.mjs), and [cleanup audit](../scripts/daytona-cleanup-audit.mjs). No Daytona provider change or external submission was made.

## Render command control and SDK coverage

The initial adapter stopped only observation for attached resources and disposed of owned resources on cancellation. The expanded adapter now uses a supervisor through public SDK exec to stop and verify a command process group while retaining the sandbox. Real normal, abort and timeout cases preserved unrelated work and prevented delayed writes from canceled parent/child processes. The original [feasibility probe](../validation/render-process-control-probe.json) remains historical evidence; [production acceptance](../validation/production-live.json) tests the integrated implementation.

Snapshot CRUD, filesystem/runtime restoration, native event streaming, streamed/file/directory/archive transfers, configurable file limits, concurrent operations, metadata queries, explicit lifecycle controls and SDK access are implemented. Gzip upload uses streaming host decompression to tar because the live service rejected the gzip media type advertised by SDK 1.2.0. The [README](../README.md) maps every public SDK method to the integration API.

The process supervisor retains the group leader identity until signaling ends and reports `killed` only after confirmation. Process groups do not contain deliberately detached descendants; dedicated owned sandboxes can use explicit whole-sandbox termination mode. The generic core reporting issue remains necessary for genuinely unconfirmed termination. Successful command control does not fix core's false message on an error path.
