# @mastra/factory

## 0.7.1-alpha.2

### Patch Changes

- Fixed session materialization timing being overwritten when sessions resume. The initial-materialize timestamp is now recorded once and preserved across idle-reap, checkpoint restore, and sandbox recreation, so time-to-first-materialize measurements reflect the true initial cost. Historical metrics captured before this fix are not backfilled. ([#21520](https://github.com/mastra-ai/mastra/pull/21520))

- Fixed Factory completion so moving a GitHub issue to Done marks it as pending close and removes its remaining triage status labels. ([#21515](https://github.com/mastra-ai/mastra/pull/21515))

- Improved chat scrolling in the factory. Sending a message now scrolls once and parks it near the top with room under it, and the view stays on the agent's newest output — tool progress, subagents, the streamed reply — instead of standing still or jumping back up to what you just sent. ([#21523](https://github.com/mastra-ai/mastra/pull/21523))

  Scroll up to read back and the chat stops following. Return to the bottom and it picks the stream up again. The jump-to-latest button no longer flickers when you send a message.

  The room under the live turn is released when the run ends, so a finished conversation settles against the composer instead of leaving most of the window blank.

- Updated dependencies [[`7e096f0`](https://github.com/mastra-ai/mastra/commit/7e096f02f0dddbf09b85d306458351245ed2f886), [`8f0a332`](https://github.com/mastra-ai/mastra/commit/8f0a3321bf180368d76fe7b36aa1a8f60f00b6de), [`b098de9`](https://github.com/mastra-ai/mastra/commit/b098de9d7cb9f672e0883a5c716465a3a689693d), [`ef6e295`](https://github.com/mastra-ai/mastra/commit/ef6e295b59bc25a5b61b633a89c97bcfce9fb465), [`208e1b3`](https://github.com/mastra-ai/mastra/commit/208e1b39f30f4b386e494394e9d71d96f0f90241), [`c938d34`](https://github.com/mastra-ai/mastra/commit/c938d34739936c8ecbabd67ad6a4a4396f41c4c6), [`1d9a0ea`](https://github.com/mastra-ai/mastra/commit/1d9a0ea4a9901baee6cd56737243bd6d1f631ac0), [`3667679`](https://github.com/mastra-ai/mastra/commit/3667679db057edfb086846d13369fdda4902ad65), [`49696e8`](https://github.com/mastra-ai/mastra/commit/49696e8e42f870674a0a58f5abcd22cc54dd2864), [`512100a`](https://github.com/mastra-ai/mastra/commit/512100a7d8b7e9c920f2590c6b3612f5de0d3cff), [`9ef432b`](https://github.com/mastra-ai/mastra/commit/9ef432b6faa534b57b0d182a610e13dd9a7123ff), [`b9cf308`](https://github.com/mastra-ai/mastra/commit/b9cf30846f97f99ac1906ee8a68f4f2d117b0378)]:
  - @mastra/core@1.60.0-alpha.2
  - @mastra/code-sdk@1.2.2-alpha.2

## 0.7.1-alpha.1

### Patch Changes

- Added Factory session state to browser tabs and the sidebar, so a running session can be followed without switching to its window. ([#21426](https://github.com/mastra-ai/mastra/pull/21426))

  - Session tab favicons are color-coded: amber while initializing, green while the agent works, blue when it is your turn, red on failure.
  - Sidebar status dots now cover workspaces and user sessions alike, with Initializing / Working / Ready tooltips in the same three colors, so a tab and its sidebar row read the same.
  - Failures show on the favicon only; the sidebar has no error dot yet.
  - Tab titles show the session's identifier — `#1567` for GitHub pull requests and issues, `COR-210` for Linear — or the thread title for user sessions.
  - Board kickoff toasts gained a **New Tab** action, so a ready session opens without leaving the board.
  - Fixed a pinned session losing its sidebar slot when five other sessions were busy at once.

- Fixed observational memory in Factory web user sessions ignoring the stored memory settings. Sessions created from the web UI now start with the observer and reflector models, thresholds, and attachment preferences saved in your memory settings, instead of falling back to the built-in default model — which failed with a missing API key error when that provider was not configured. ([#21423](https://github.com/mastra-ai/mastra/pull/21423))

- The Review board now has a Canceled column. A pull request closed without merging used to reappear in Intake — the queue of pull requests still waiting for review — carrying a "Canceled" chip to explain why it looked out of place. It now sits in its own column. ([#21323](https://github.com/mastra-ai/mastra/pull/21323))

- Fixed the Factory session favicons being nearly invisible in light-themed browsers: the Mastra mark now switches to black on light and white on dark, matching the default favicon, and the state dots use the design system's light-theme accents so amber, green, blue, and red stay legible on a white tab strip. ([#21510](https://github.com/mastra-ai/mastra/pull/21510))

- Improved Factory stage handling so run routes and board columns stay aligned with the rule stage vocabulary. ([#21516](https://github.com/mastra-ai/mastra/pull/21516))

- Smoothed out the chat transcript. A streamed reply now reveals at a steady pace instead of arriving in clumps, and a tool card that turns up while the agent is working fades in rather than popping onto the page. Both stop for readers who ask for reduced motion. ([#21499](https://github.com/mastra-ai/mastra/pull/21499))

- Board cards now show one status line instead of stacking several. A card reports what you just triggered, then what a rule is doing on its own, then what a click will do — one thing at a time, in that order. ([#21323](https://github.com/mastra-ai/mastra/pull/21323))

  Automatic actions say what they do rather than where they sit in a queue. A card reads "Starting an automated run…" while a rule works, and "Automated run could not start" when it gives up, with the raw error one hover away next to Retry. An action the server is still re-attempting says "— retrying…", so a card looping through retries no longer looks like one starting for the first time.

  Unfiled GitHub and Linear items now use the same card as filed work. Clicking anywhere on the card starts its default run and reports "Starting run…" while that resolves, instead of looking inert. A link to the issue or pull request sits beside the title, and the remaining actions are in the card's actions menu.

  A resting card also shows less. The click hint and the actions menu fade in when you point at the card or reach it with the keyboard, the hint shares the author's line instead of taking a row of its own, and labels are shorter. Touch screens have no hover, so they keep both visible.

- Updated dependencies [[`15101bb`](https://github.com/mastra-ai/mastra/commit/15101bb53c0d934f31af6b8813b88191e382a5e5), [`c2c3deb`](https://github.com/mastra-ai/mastra/commit/c2c3debcf670c7082d0a5e553aa99818a864698c), [`8a4a4af`](https://github.com/mastra-ai/mastra/commit/8a4a4af31358fa3af79b962f87cf9a89f2c07aa9), [`33374ba`](https://github.com/mastra-ai/mastra/commit/33374ba359e4fb13eaa918ae925fe167a3c55414), [`c5f964d`](https://github.com/mastra-ai/mastra/commit/c5f964d3f77064e978f8066ec506eed77ba5c63c), [`f8f653f`](https://github.com/mastra-ai/mastra/commit/f8f653f10980d01a73706cc3c8689ca5e40ce808)]:
  - @mastra/core@1.60.0-alpha.1
  - @mastra/auth-studio@1.3.4-alpha.0
  - @mastra/code-sdk@1.2.2-alpha.1

## 0.7.1-alpha.0

### Patch Changes

- Updated dependencies [[`587f6ef`](https://github.com/mastra-ai/mastra/commit/587f6efcfc25880b93760a8607d1cd381ec612fe)]:
  - @mastra/core@1.59.1-alpha.0
  - @mastra/code-sdk@1.2.2-alpha.0

## 0.7.0

### Minor Changes

- **Automatic agent runs are now opt-in per Factory** ([#21326](https://github.com/mastra-ai/mastra/pull/21326))

  Factory rules no longer start agent runs on their own. When a rule wants to start one — reviewing a new pull request, triaging an issue, planning work — it is parked as a `proposed` decision, and clicking the card starts it. Rules that only mirror external facts are untouched: a merged pull request still moves its card to Done, a closed issue still lands in Done or Canceled.

  Automatic runs are switched on and off from the top of the Work and Review boards, and they start off — including for Factories that exist today, so rules stop starting runs on upgrade until someone turns them back on.

  A proposal that nobody wants can be turned down from the card menu or the Rules page, and both actions are recorded in the audit log. Through the API:

  ```ts
  // Turn automatic runs back on for a Factory.
  await fetch(`/web/factory/projects/${factoryProjectId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ autoRunEnabled: true }),
  });

  // Release a parked run, or drop it for good.
  await fetch(`/web/factory/projects/${factoryProjectId}/decisions/${decisionId}/approve`, { method: 'POST' });
  await fetch(`/web/factory/projects/${factoryProjectId}/decisions/${decisionId}/dismiss`, { method: 'POST' });
  ```

  **Why:** opening a pull request used to start an agent that checks out and runs its code, with no way to say no. That consent now belongs to the Factory owner, while the board keeps reflecting what happens in GitHub and Linear either way.

- Added independent GitHub issue and pull request reconciliation controls for Factory, with legacy reconciliation settings preserved as fallbacks. Added Linear issue reconciliation aliases and automatically move linked work cards to Done or Canceled when upstream issues close. ([#21342](https://github.com/mastra-ai/mastra/pull/21342))

  For example, run GitHub issue reconciliation every minute while leaving pull-request reconciliation at its existing cadence:

  ```sh
  MASTRACODE_GITHUB_ISSUE_RECONCILE_INTERVAL_MS=60000
  ```

- Added Slack channel adapter options to `SlackIntegration` and made concise thinking, typing, and working statuses the default. ([#21381](https://github.com/mastra-ai/mastra/pull/21381))

  ```ts
  new SlackIntegration({
    signingSecret,
    adapterOptions: {
      streaming: true,
      toolDisplay: 'grouped',
    },
  });
  ```

### Patch Changes

- Cleaned up the agent transcript in the Factory web UI. Tool calls, tool groups and skill activations now share one row shape: a leading glyph for the kind of call, the label, the live command, and a disclosure chevron that only shows on hover. A collapsed group keeps its `5 steps` label and stands for what it holds with one glyph per kind of call, instead of a generic `Find files · Read · Run` list. ([#21321](https://github.com/mastra-ai/mastra/pull/21321))

  A skill now looks the same whether you activated it or the agent called the `skill` tool itself: both render the instructions as Markdown rather than a raw arguments-and-output dump, and a skill call no longer disappears inside a group of steps.

  Also fixed two artefacts: a message carrying only internal step markers drew an empty chat bubble, and invisible parts split runs of tool calls into unrelated groups.

- Factory triage now uses `status:` labels so triaged and approval-pending issues remain visible to the Factory workflow. ([#21318](https://github.com/mastra-ai/mastra/pull/21318))

- Route GitHub issue investigation through Factory rules and the bundled `factory-triage` skill instead of the legacy triage runner. ([#21413](https://github.com/mastra-ai/mastra/pull/21413))

- Replaced the raw `buffering`/`observing`/`reflecting` phase label in the Factory status line with two rings, one per memory budget: the message window and the accumulated observations. Each ring shows how full its budget is, and a highlight travels around the ring while memory works through it — background work reads as work instead of leaking an internal phase name. A memory pass that actually holds the turn still says so ("saving memory", "consolidating memory"). Both rings sit in one control, and clicking it opens both budgets in full: an icon each in the budget's own colour, the figures, and a line saying what reaching the threshold sets off. The control speaks both readings to assistive tech, which a button otherwise hides. ([#21366](https://github.com/mastra-ai/mastra/pull/21366))

  A background pass now shows on the budget it actually acts on, rather than as one word shared by both.

- Fixed the Mastra client being recreated on every render of MastraClientProvider, which silently reset per-client caches such as endpoint support and capability probes. ([#21326](https://github.com/mastra-ai/mastra/pull/21326))

- Fixed the Factory error screen rendering its message as a single column of letters down the page when the factories list fails to load. The notice now shows as a centered card with a readable line length. ([#21322](https://github.com/mastra-ai/mastra/pull/21322))

- Fixed a failed branch push being reported as a token cleanup error. When the push failed and the token cleanup failed too, the cleanup error replaced the push error, so a push blocked by the network was reported with an unrelated error code. The push error is now reported as-is with its own code, and the cleanup error is added to the end of its message. ([#21407](https://github.com/mastra-ai/mastra/pull/21407))

- Fixed workspace opening failures reporting a confusing `ENOENT` / `The "cwd" option is invalid` error instead of the real cause. When a repository clone failed and left no working directory behind, the token cleanup that always runs afterwards crashed on the missing directory and replaced the original error. Blocked egress, bad credentials, or a missing repository now surface as the actual failure. ([#21338](https://github.com/mastra-ai/mastra/pull/21338))

  Token cleanup is also stricter where it matters: once the access token has been written into the checkout's git settings, a failed cleanup is now always reported — even when the update itself failed, and even when a failed clone left a partial checkout behind — instead of being silently ignored.

- Factory Overview now measures the Factory, not the connected repo. ([#21333](https://github.com/mastra-ai/mastra/pull/21333))

  The integrations sync every issue and pull request of a connected repository onto the board, and those cards vastly outnumber the work the Factory actually runs. The Overview counted all of them, so a busy repo reported hundreds of completions, a lead time measured from the moment the poller filed the card, and an automation rate pinned near 100% because the poller stamps itself on every move it makes.

  **What changed**

  - Throughput, lead time, in-flight, work intake and stage coverage now cover only cards a Factory run was started on.
  - **In flight** no longer counts the intake inbox, so it covers the same work as the queue-health chart below it, which already excluded it.
  - **Automation coverage** is now **Agent coverage**: the share of each stage's first passes an agent finished, instead of any move no human made. The near-constant automation ratio card is gone.
  - **Agents running** previously read threads under the wrong resource and always showed 0. The work-item listing now reports which of the cards it returns have a run in flight, so the count and the 'agent running' marker in the queue-health drill-down come from one read and can't disagree.
  - Deleting a card whose agent is running clears its running marker with the card, instead of leaving it counted until the next poll.

  `GET /web/factory/projects/:id/work-items` gains `runningSessionIds` alongside `workItems`. `FactoryMetrics` drops `transitions` and renames `stageAutomation` to `agentCoverage` (`exits` → `passes`, `automated` → `byAgent`).

- Fixed MASTRACODE_ENV_DIR being resolved against the UI source directory instead of the working directory, which made the dev server silently load no environment variables when a relative path was given. ([#21326](https://github.com/mastra-ai/mastra/pull/21326))

- Send opaque acting-user subjects with Platform sandbox requests, including Factory creation and reattachment flows. ([#20754](https://github.com/mastra-ai/mastra/pull/20754))

  ```typescript
  import { PlatformSandbox } from '@mastra/platform-workspace';

  const sandbox = new PlatformSandbox({
    environmentId: 'env_abc',
    actingUserId: auth.user.id,
  });
  ```

- Improved Factory issue investigations with effort and impact labels. ([#21401](https://github.com/mastra-ai/mastra/pull/21401))

- Chat messages now carry the time they were sent and a button that copies their text. Both sit under the message and only appear when you hover (or keyboard-focus) it, so the transcript stays clean. ([#21350](https://github.com/mastra-ai/mastra/pull/21350))

- - Trigger a fresh review when a push arrives after a pull request review finishes. ([#21356](https://github.com/mastra-ai/mastra/pull/21356))
  - Cancel an in-flight review when a push or Factory bot re-review request supersedes it.
  - Route platform-polled `synchronize` and `review_requested` events through the same review rules as direct webhooks.
  - Revive subscribed sessions with the persisted owner identified by the subscription session ID.
  - Isolate failed subscription deliveries so stale bindings do not replay events or block newer repository activity.

  A push or bot request that returns a card from `done` to `review` now runs `factory-rereview`. The skill reconciles the previous review against the pushed commits, checks for newly introduced defects, and reviews the whole pull request again before publishing its verdict. A canceled first-time review still restarts with `factory-review` because it has no completed pass to reconcile.

- Agent replies now fade in word by word as they stream, instead of snapping whole chunks of text into place. Each word appears whole, so the visible text trails the stream by at most one word. A block that changes shape while it grows — a paragraph turning into a list item — fades again. Text that has finished streaming renders as before. ([#21417](https://github.com/mastra-ai/mastra/pull/21417))

- Fixed workspace completion sounds and activity indicators to remain synchronized when switching threads. Running indicators no longer require an open workspace session, so they stay live on the board and overview pages too. ([#21353](https://github.com/mastra-ai/mastra/pull/21353))

- Fixed markdown rendering in the Factory chat. Bullet and numbered lists show their markers again instead of collapsing into blankly indented lines, and task lists, tables and blockquotes now render properly. Fenced code blocks go through the design-system code block, so they get syntax highlighting, a copy button and a readable surface, and inline code is legible on every background. ([#21355](https://github.com/mastra-ai/mastra/pull/21355))

  The chat now uses the same markdown renderer as the Studio rather than its own copy, so both stay in sync from here on.

- Added a Skills page under the Agent section in Factory settings that shows the pipeline stage skills (Triage, Planning, Review, Re-review) with their playbook content, backed by a new GET /web/factory/skills endpoint. Also fixed a noisy checkpoint warning when the sandbox does not support snapshots. ([#21369](https://github.com/mastra-ai/mastra/pull/21369))

- Improved Factory issue triage to label confirmed direct @mastra/core bugs. ([#21179](https://github.com/mastra-ai/mastra/pull/21179))

- Improved work session preparation feedback across light and dark themes. ([#21382](https://github.com/mastra-ai/mastra/pull/21382))

- Updated dependencies [[`088e41e`](https://github.com/mastra-ai/mastra/commit/088e41e434ed05f2c674b254f1034ec46a57a7be), [`aa3e7be`](https://github.com/mastra-ai/mastra/commit/aa3e7be30f8addb0278ea74429f4df054517a287), [`d118873`](https://github.com/mastra-ai/mastra/commit/d118873cfd5074b1f814a1c169a97ca7a3a29174), [`b2f0013`](https://github.com/mastra-ai/mastra/commit/b2f0013375588d40c03c13e843b99c0ff8872ca5), [`3b541ae`](https://github.com/mastra-ai/mastra/commit/3b541ae5d410c52b80a7e381d84d021cddb9a449), [`79dd7c2`](https://github.com/mastra-ai/mastra/commit/79dd7c261ee6be1fafedd4651959394db21d2cba), [`90822db`](https://github.com/mastra-ai/mastra/commit/90822dba08fb2169c518e4a6d7f127c098eb46b8), [`898bba4`](https://github.com/mastra-ai/mastra/commit/898bba46d4806dd255a44e5dc3a3d5827eaefdfe), [`b9a28ec`](https://github.com/mastra-ai/mastra/commit/b9a28ecf7acdc0cb7a543d5b660f9fbee301df9a), [`f9aab1c`](https://github.com/mastra-ai/mastra/commit/f9aab1cfc3fda03238a7fd7bd8b794e07497878c), [`3700208`](https://github.com/mastra-ai/mastra/commit/37002080c7838267803a7e579a7d58b908d62f36), [`e31421b`](https://github.com/mastra-ai/mastra/commit/e31421bc9c11c03c6e74f447ecb5820000e2b9d7), [`8b7131e`](https://github.com/mastra-ai/mastra/commit/8b7131eb0407f58f5205e68fb27b81f026488f28), [`161258b`](https://github.com/mastra-ai/mastra/commit/161258b3473a6d0fce00a43cab59d119a49a232f), [`aece0e7`](https://github.com/mastra-ai/mastra/commit/aece0e7cb124ae1eb1230689b887f5554b9a0bf0), [`ae79e34`](https://github.com/mastra-ai/mastra/commit/ae79e34c0bd8674fc24c7524217bfc4a051c6136), [`59d8898`](https://github.com/mastra-ai/mastra/commit/59d8898c8cb48b342fe5bcb5eee803cc8cc95060), [`a6c4399`](https://github.com/mastra-ai/mastra/commit/a6c4399763590b3dae21a2c81826e89a3b1deee4), [`a40f915`](https://github.com/mastra-ai/mastra/commit/a40f9157690d89ef13ce825cc88e30be581de5d4), [`8ea8038`](https://github.com/mastra-ai/mastra/commit/8ea80386fde53d26e2c0b2060c53bc9bd9be10f3), [`be31796`](https://github.com/mastra-ai/mastra/commit/be3179624ad5f77cff5fa342cd08046bf7605283), [`79c4f82`](https://github.com/mastra-ai/mastra/commit/79c4f8295f568752eeadf8a9b50010a7d9ec06ae), [`90822db`](https://github.com/mastra-ai/mastra/commit/90822dba08fb2169c518e4a6d7f127c098eb46b8), [`7dafa4f`](https://github.com/mastra-ai/mastra/commit/7dafa4f670fb16ec8ff07349645a00ca12bc5794)]:
  - @mastra/core@1.59.0
  - @mastra/code-sdk@1.2.1

## 0.7.0-alpha.5

### Patch Changes

- Agent replies now fade in word by word as they stream, instead of snapping whole chunks of text into place. Each word appears whole, so the visible text trails the stream by at most one word. A block that changes shape while it grows — a paragraph turning into a list item — fades again. Text that has finished streaming renders as before. ([#21417](https://github.com/mastra-ai/mastra/pull/21417))

- Updated dependencies [[`59d8898`](https://github.com/mastra-ai/mastra/commit/59d8898c8cb48b342fe5bcb5eee803cc8cc95060), [`a40f915`](https://github.com/mastra-ai/mastra/commit/a40f9157690d89ef13ce825cc88e30be581de5d4)]:
  - @mastra/core@1.59.0-alpha.5
  - @mastra/code-sdk@1.2.1-alpha.5

## 0.7.0-alpha.4

### Minor Changes

- Added Slack channel adapter options to `SlackIntegration` and made concise thinking, typing, and working statuses the default. ([#21381](https://github.com/mastra-ai/mastra/pull/21381))

  ```ts
  new SlackIntegration({
    signingSecret,
    adapterOptions: {
      streaming: true,
      toolDisplay: 'grouped',
    },
  });
  ```

### Patch Changes

- Fixed a failed branch push being reported as a token cleanup error. When the push failed and the token cleanup failed too, the cleanup error replaced the push error, so a push blocked by the network was reported with an unrelated error code. The push error is now reported as-is with its own code, and the cleanup error is added to the end of its message. ([#21407](https://github.com/mastra-ai/mastra/pull/21407))

- Send opaque acting-user subjects with Platform sandbox requests, including Factory creation and reattachment flows. ([#20754](https://github.com/mastra-ai/mastra/pull/20754))

  ```typescript
  import { PlatformSandbox } from '@mastra/platform-workspace';

  const sandbox = new PlatformSandbox({
    environmentId: 'env_abc',
    actingUserId: auth.user.id,
  });
  ```

- Fixed workspace completion sounds and activity indicators to remain synchronized when switching threads. Running indicators no longer require an open workspace session, so they stay live on the board and overview pages too. ([#21353](https://github.com/mastra-ai/mastra/pull/21353))

- Updated dependencies [[`79dd7c2`](https://github.com/mastra-ai/mastra/commit/79dd7c261ee6be1fafedd4651959394db21d2cba), [`b9a28ec`](https://github.com/mastra-ai/mastra/commit/b9a28ecf7acdc0cb7a543d5b660f9fbee301df9a), [`be31796`](https://github.com/mastra-ai/mastra/commit/be3179624ad5f77cff5fa342cd08046bf7605283)]:
  - @mastra/core@1.59.0-alpha.4
  - @mastra/code-sdk@1.2.1-alpha.4

## 0.7.0-alpha.3

### Patch Changes

- Fixed workspace opening failures reporting a confusing `ENOENT` / `The "cwd" option is invalid` error instead of the real cause. When a repository clone failed and left no working directory behind, the token cleanup that always runs afterwards crashed on the missing directory and replaced the original error. Blocked egress, bad credentials, or a missing repository now surface as the actual failure. ([#21338](https://github.com/mastra-ai/mastra/pull/21338))

  Token cleanup is also stricter where it matters: once the access token has been written into the checkout's git settings, a failed cleanup is now always reported — even when the update itself failed, and even when a failed clone left a partial checkout behind — instead of being silently ignored.

- Updated dependencies [[`d118873`](https://github.com/mastra-ai/mastra/commit/d118873cfd5074b1f814a1c169a97ca7a3a29174), [`161258b`](https://github.com/mastra-ai/mastra/commit/161258b3473a6d0fce00a43cab59d119a49a232f), [`8ea8038`](https://github.com/mastra-ai/mastra/commit/8ea80386fde53d26e2c0b2060c53bc9bd9be10f3)]:
  - @mastra/core@1.59.0-alpha.3
  - @mastra/code-sdk@1.2.1-alpha.3

## 0.7.0-alpha.2

### Minor Changes

- Added independent GitHub issue and pull request reconciliation controls for Factory, with legacy reconciliation settings preserved as fallbacks. Added Linear issue reconciliation aliases and automatically move linked work cards to Done or Canceled when upstream issues close. ([#21342](https://github.com/mastra-ai/mastra/pull/21342))

  For example, run GitHub issue reconciliation every minute while leaving pull-request reconciliation at its existing cadence:

  ```sh
  MASTRACODE_GITHUB_ISSUE_RECONCILE_INTERVAL_MS=60000
  ```

### Patch Changes

- Route GitHub issue investigation through Factory rules and the bundled `factory-triage` skill instead of the legacy triage runner. ([#21413](https://github.com/mastra-ai/mastra/pull/21413))

- Replaced the raw `buffering`/`observing`/`reflecting` phase label in the Factory status line with two rings, one per memory budget: the message window and the accumulated observations. Each ring shows how full its budget is, and a highlight travels around the ring while memory works through it — background work reads as work instead of leaking an internal phase name. A memory pass that actually holds the turn still says so ("saving memory", "consolidating memory"). Both rings sit in one control, and clicking it opens both budgets in full: an icon each in the budget's own colour, the figures, and a line saying what reaching the threshold sets off. The control speaks both readings to assistive tech, which a button otherwise hides. ([#21366](https://github.com/mastra-ai/mastra/pull/21366))

  A background pass now shows on the budget it actually acts on, rather than as one word shared by both.

- Improved Factory issue investigations with effort and impact labels. ([#21401](https://github.com/mastra-ai/mastra/pull/21401))

- Improved Factory issue triage to label confirmed direct @mastra/core bugs. ([#21179](https://github.com/mastra-ai/mastra/pull/21179))

- Improved work session preparation feedback across light and dark themes. ([#21382](https://github.com/mastra-ai/mastra/pull/21382))

- Updated dependencies [[`898bba4`](https://github.com/mastra-ai/mastra/commit/898bba46d4806dd255a44e5dc3a3d5827eaefdfe), [`f9aab1c`](https://github.com/mastra-ai/mastra/commit/f9aab1cfc3fda03238a7fd7bd8b794e07497878c), [`e31421b`](https://github.com/mastra-ai/mastra/commit/e31421bc9c11c03c6e74f447ecb5820000e2b9d7), [`aece0e7`](https://github.com/mastra-ai/mastra/commit/aece0e7cb124ae1eb1230689b887f5554b9a0bf0)]:
  - @mastra/core@1.59.0-alpha.2
  - @mastra/code-sdk@1.2.1-alpha.2

## 0.7.0-alpha.1

### Minor Changes

- **Automatic agent runs are now opt-in per Factory** ([#21326](https://github.com/mastra-ai/mastra/pull/21326))

  Factory rules no longer start agent runs on their own. When a rule wants to start one — reviewing a new pull request, triaging an issue, planning work — it is parked as a `proposed` decision, and clicking the card starts it. Rules that only mirror external facts are untouched: a merged pull request still moves its card to Done, a closed issue still lands in Done or Canceled.

  Automatic runs are switched on and off from the top of the Work and Review boards, and they start off — including for Factories that exist today, so rules stop starting runs on upgrade until someone turns them back on.

  A proposal that nobody wants can be turned down from the card menu or the Rules page, and both actions are recorded in the audit log. Through the API:

  ```ts
  // Turn automatic runs back on for a Factory.
  await fetch(`/web/factory/projects/${factoryProjectId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ autoRunEnabled: true }),
  });

  // Release a parked run, or drop it for good.
  await fetch(`/web/factory/projects/${factoryProjectId}/decisions/${decisionId}/approve`, { method: 'POST' });
  await fetch(`/web/factory/projects/${factoryProjectId}/decisions/${decisionId}/dismiss`, { method: 'POST' });
  ```

  **Why:** opening a pull request used to start an agent that checks out and runs its code, with no way to say no. That consent now belongs to the Factory owner, while the board keeps reflecting what happens in GitHub and Linear either way.

### Patch Changes

- Fixed the Mastra client being recreated on every render of MastraClientProvider, which silently reset per-client caches such as endpoint support and capability probes. ([#21326](https://github.com/mastra-ai/mastra/pull/21326))

- Factory Overview now measures the Factory, not the connected repo. ([#21333](https://github.com/mastra-ai/mastra/pull/21333))

  The integrations sync every issue and pull request of a connected repository onto the board, and those cards vastly outnumber the work the Factory actually runs. The Overview counted all of them, so a busy repo reported hundreds of completions, a lead time measured from the moment the poller filed the card, and an automation rate pinned near 100% because the poller stamps itself on every move it makes.

  **What changed**

  - Throughput, lead time, in-flight, work intake and stage coverage now cover only cards a Factory run was started on.
  - **In flight** no longer counts the intake inbox, so it covers the same work as the queue-health chart below it, which already excluded it.
  - **Automation coverage** is now **Agent coverage**: the share of each stage's first passes an agent finished, instead of any move no human made. The near-constant automation ratio card is gone.
  - **Agents running** previously read threads under the wrong resource and always showed 0. The work-item listing now reports which of the cards it returns have a run in flight, so the count and the 'agent running' marker in the queue-health drill-down come from one read and can't disagree.
  - Deleting a card whose agent is running clears its running marker with the card, instead of leaving it counted until the next poll.

  `GET /web/factory/projects/:id/work-items` gains `runningSessionIds` alongside `workItems`. `FactoryMetrics` drops `transitions` and renames `stageAutomation` to `agentCoverage` (`exits` → `passes`, `automated` → `byAgent`).

- Fixed MASTRACODE_ENV_DIR being resolved against the UI source directory instead of the working directory, which made the dev server silently load no environment variables when a relative path was given. ([#21326](https://github.com/mastra-ai/mastra/pull/21326))

- Chat messages now carry the time they were sent and a button that copies their text. Both sit under the message and only appear when you hover (or keyboard-focus) it, so the transcript stays clean. ([#21350](https://github.com/mastra-ai/mastra/pull/21350))

- - Trigger a fresh review when a push arrives after a pull request review finishes. ([#21356](https://github.com/mastra-ai/mastra/pull/21356))
  - Cancel an in-flight review when a push or Factory bot re-review request supersedes it.
  - Route platform-polled `synchronize` and `review_requested` events through the same review rules as direct webhooks.
  - Revive subscribed sessions with the persisted owner identified by the subscription session ID.
  - Isolate failed subscription deliveries so stale bindings do not replay events or block newer repository activity.

  A push or bot request that returns a card from `done` to `review` now runs `factory-rereview`. The skill reconciles the previous review against the pushed commits, checks for newly introduced defects, and reviews the whole pull request again before publishing its verdict. A canceled first-time review still restarts with `factory-review` because it has no completed pass to reconcile.

- Fixed markdown rendering in the Factory chat. Bullet and numbered lists show their markers again instead of collapsing into blankly indented lines, and task lists, tables and blockquotes now render properly. Fenced code blocks go through the design-system code block, so they get syntax highlighting, a copy button and a readable surface, and inline code is legible on every background. ([#21355](https://github.com/mastra-ai/mastra/pull/21355))

  The chat now uses the same markdown renderer as the Studio rather than its own copy, so both stay in sync from here on.

- Added a Skills page under the Agent section in Factory settings that shows the pipeline stage skills (Triage, Planning, Review, Re-review) with their playbook content, backed by a new GET /web/factory/skills endpoint. Also fixed a noisy checkpoint warning when the sandbox does not support snapshots. ([#21369](https://github.com/mastra-ai/mastra/pull/21369))

- Updated dependencies [[`aa3e7be`](https://github.com/mastra-ai/mastra/commit/aa3e7be30f8addb0278ea74429f4df054517a287), [`90822db`](https://github.com/mastra-ai/mastra/commit/90822dba08fb2169c518e4a6d7f127c098eb46b8), [`3700208`](https://github.com/mastra-ai/mastra/commit/37002080c7838267803a7e579a7d58b908d62f36), [`8b7131e`](https://github.com/mastra-ai/mastra/commit/8b7131eb0407f58f5205e68fb27b81f026488f28), [`79c4f82`](https://github.com/mastra-ai/mastra/commit/79c4f8295f568752eeadf8a9b50010a7d9ec06ae), [`90822db`](https://github.com/mastra-ai/mastra/commit/90822dba08fb2169c518e4a6d7f127c098eb46b8)]:
  - @mastra/core@1.59.0-alpha.1
  - @mastra/code-sdk@1.2.1-alpha.1

## 0.6.1-alpha.0

### Patch Changes

- Cleaned up the agent transcript in the Factory web UI. Tool calls, tool groups and skill activations now share one row shape: a leading glyph for the kind of call, the label, the live command, and a disclosure chevron that only shows on hover. A collapsed group keeps its `5 steps` label and stands for what it holds with one glyph per kind of call, instead of a generic `Find files · Read · Run` list. ([#21321](https://github.com/mastra-ai/mastra/pull/21321))

  A skill now looks the same whether you activated it or the agent called the `skill` tool itself: both render the instructions as Markdown rather than a raw arguments-and-output dump, and a skill call no longer disappears inside a group of steps.

  Also fixed two artefacts: a message carrying only internal step markers drew an empty chat bubble, and invisible parts split runs of tool calls into unrelated groups.

- Factory triage now uses `status:` labels so triaged and approval-pending issues remain visible to the Factory workflow. ([#21318](https://github.com/mastra-ai/mastra/pull/21318))

- Fixed the Factory error screen rendering its message as a single column of letters down the page when the factories list fails to load. The notice now shows as a centered card with a readable line length. ([#21322](https://github.com/mastra-ai/mastra/pull/21322))

- Updated dependencies [[`088e41e`](https://github.com/mastra-ai/mastra/commit/088e41e434ed05f2c674b254f1034ec46a57a7be), [`b2f0013`](https://github.com/mastra-ai/mastra/commit/b2f0013375588d40c03c13e843b99c0ff8872ca5), [`3b541ae`](https://github.com/mastra-ai/mastra/commit/3b541ae5d410c52b80a7e381d84d021cddb9a449), [`ae79e34`](https://github.com/mastra-ai/mastra/commit/ae79e34c0bd8674fc24c7524217bfc4a051c6136), [`a6c4399`](https://github.com/mastra-ai/mastra/commit/a6c4399763590b3dae21a2c81826e89a3b1deee4)]:
  - @mastra/core@1.59.0-alpha.0
  - @mastra/code-sdk@1.2.1-alpha.0

## 0.6.0

### Minor Changes

- Added creator and recent worker attribution to Factory board cards, with names and profile images from GitHub and Linear. GitHub pull request cards now show the author and draft, open, closed, or merged status. ([#20822](https://github.com/mastra-ai/mastra/pull/20822))

- Added a `firstMeaningfulExecAt` timestamp to source-control sessions, recording when the session's agent completed its first successful sandbox command. Together with `firstMessageAt` this measures time-to-first-meaningful-exec: how long a user waits between sending their first message and the agent actually doing work in a live sandbox. The value is written once per session and is available on all session read APIs; setup commands run by the platform itself (skill loading, repo checkout) do not count. ([#21211](https://github.com/mastra-ai/mastra/pull/21211))

- Fixed the Factory metrics so the same date range always reports the same numbers, and dropped the response fields that nothing displayed. ([#21256](https://github.com/mastra-ai/mastra/pull/21256))

  **Completions are events, not the board's current state.** Throughput and lead time now count entries into `done` in the stage history, so reopening a card no longer erases the day it shipped and a card that shipped twice counts twice. The per-day rate divides by the days the board actually existed, so a 12-month range on a two-week-old board no longer reads as ~0 per day.

  **Automation numbers stop counting the wrong things.** A card landing on the board when it is created is no longer counted as an automated stage move, which used to credit every webhook-synced card. Automation coverage measures the first pass through each stage only — a redo used to add a second entry to the denominator alone, capping a fully automated stage at 50% — and each pass's outcome is now frozen at the end of the window instead of reflecting where the card sits today.

  **Response shape.** `stageDurations`, `wip`, `agingWip` and `earliestItemAt` are gone: nothing rendered them, and live in-flight work is already covered by the queue-health chart. `windowDays` is now `daysCovered` (the window clipped to the board's life) and `cycleTime` is `leadTime`, which is what it always measured — card creation through to `done`.

  The metrics endpoint (`GET /web/factory/projects/:id/metrics`) renames two fields:

  ```jsonc
  // before
  { "metrics": { "windowDays": 30, "cycleTime": { "medianMs": 7200000 } } }
  // after
  { "metrics": { "daysCovered": 30, "leadTime": { "medianMs": 7200000 } } }
  ```

  A corrupt stage-history timestamp now throws instead of being read as 1970.

- Added stable identities and display titles for Factory user sessions. ([#20781](https://github.com/mastra-ai/mastra/pull/20781))

  `POST /web/github/projects/:id/sessions` now accepts optional `sessionId` and `title` fields. When `branch` is omitted, the session uses `user/session-<sessionId>`. Callers can create a client-side draft, safely retry the first server request with the same UUID, and show the first prompt as a human-readable title. If `sessionId` is omitted, the server generates one. Explicit branches still work unchanged.

  ```ts
  const sessionId = crypto.randomUUID();
  const response = await fetch(`/web/github/projects/${projectRepositoryId}/sessions`, {
    method: 'POST',
    body: JSON.stringify({ sessionId, title: 'Fix the login flow' }),
  });
  ```

  Titles collapse whitespace, trim surrounding space, and are limited to 80 characters. Blank titles are stored as `null`.

- Add a reasoning-effort configuration surface across mastracode and Factory (fixes #20766): ([#20884](https://github.com/mastra-ai/mastra/pull/20884))

  - New `max` thinking level (mapped to `reasoning effort: max` for OpenAI Codex and Anthropic `effort`).
  - Anthropic extended-thinking wiring: the session thinking level now applies to anthropic/claude-opus-4-7 and other Anthropic models via provider thinking/effort options (previously OpenAI-only).
  - New `models.modeThinkingDefaults` setting: per-mode (build/plan/fast) default thinking levels, resolved at request time with precedence session override → mode default → global `preferences.thinkingLevel`. Configuration changes now apply to the next request of every session, including automated Factory runs.
  - Factory: new Settings → Defaults controls for editing global and per-mode thinking defaults in local deployments.
  - TUI: `/think` now sets a session-only override, supports `/think default` to clear it, and `/think status` reports the effective level with provenance (session override / mode default / global default).

  Example `settings.json` configuration:

  ```json
  {
    "preferences": { "thinkingLevel": "medium" },
    "models": {
      "modeThinkingDefaults": {
        "build": "high",
        "plan": "max",
        "fast": "off"
      }
    }
  }
  ```

- Added persisted workspace file lists for Factory threads. The Files view now keeps a thread's captured file list available after an agent run while file contents continue to load from its live sandbox. ([#20937](https://github.com/mastra-ai/mastra/pull/20937))

- Added label reconciliation and label filtering to Factory work and review boards. GitHub pull requests, GitHub issues, and Linear issues now keep their labels in sync with the provider, and boards expose a searchable multi-select label filter that shares state through the URL. ([#20845](https://github.com/mastra-ai/mastra/pull/20845))

  Selected labels round-trip through the `label` query parameter (repeated per label to preserve values containing commas):

  ```
  /factory/project/<id>/work?label=bug&label=needs%20triage
  /factory/project/<id>/review?teammate=<userId>&label=priority%3Ap0
  ```

- Added automatic GitHub and Linear issue reconciliation so Factory work items stay current when provider metadata changes outside Factory. Platform Linear now tails the Platform event stream and folds a periodic reconcile sweep in on its own cadence, so Issue updates flow into Factory through the normal rules pipeline without waiting for the next board poll. ([#20845](https://github.com/mastra-ai/mastra/pull/20845))

  GitHub issue reconciliation runs inside the same worker as the pull-request reconciler (both self-hosted and Platform), sharing the same lease, cadence, and configured-repository target set. That means one sweep per repository per interval covers both writers of card state.

  Reconciliation is on by default. Disable or tune it with environment variables on the Factory server:

  ```bash
  # Turn Linear reconciliation off entirely.
  MASTRACODE_LINEAR_RECONCILE_ENABLED=false

  # Slow the Linear reconcile sweep down (default: 5 minutes).
  MASTRACODE_LINEAR_RECONCILE_INTERVAL_MS=600000

  # Stop Platform Linear from tailing the event stream; the reconcile sweep still runs.
  MASTRACODE_PLATFORM_LINEAR_POLLING_ENABLED=false

  # GitHub reconciliation uses the same shape.
  MASTRACODE_GITHUB_RECONCILE_ENABLED=false
  MASTRACODE_GITHUB_RECONCILE_INTERVAL_MS=600000
  ```

- Added a `firstMessageAt` timestamp to Factory source-control sessions. The session's first agent run now records when the first message reached the agent, so session listings and latency reporting can measure time-to-first-response from the real conversation start instead of the session's creation time (which can be long before the user sends anything). The value is returned on session objects from the source-control sessions API and is write-once: later messages never move it. ([#21206](https://github.com/mastra-ai/mastra/pull/21206))

- Added searchable, resettable teammate and relevance filters to Factory work and review boards. Filter state can be shared by URL, and matching covers GitHub and Linear authors, assignees, activity, and requested reviewers. ([#20841](https://github.com/mastra-ai/mastra/pull/20841))

  Example shareable URL: `/factory/projects/<id>/board?teammate=github:octocat&relevance=authored,assigned`.

- The Factory now re-reviews a pull request when review is re-requested from its GitHub bot. After any Factory verdict (approve or request changes), clicking GitHub's re-request review button on the Factory reviewer moves the Review card back into Reviewing and starts a fresh review pass. Only trusted collaborators (write or admin) can trigger it, and re-requests aimed at human reviewers or on closed, merged, or already-in-review pull requests are ignored. ([#20830](https://github.com/mastra-ai/mastra/pull/20830))

### Patch Changes

- Fixed workspace re-open hard-failing when a session branch was auto-deleted after merge. `git pull` messages like "no such ref was fetched" and "couldn't find remote ref" are now treated as benign, so materialization keeps the checkout as-is instead of leaving permanent rule-effect alerts on Done items. ([#20910](https://github.com/mastra-ai/mastra/pull/20910))

- Fixed sandbox checkpoints only being captured at session teardown. Factory sessions now snapshot the workspace sandbox at the end of every agent turn, so sandboxes that are reclaimed while idle can be restored from a checkpoint that includes the last completed turn's changes. ([#21227](https://github.com/mastra-ai/mastra/pull/21227))

- Fixed Slack threads on cloud factory deployments falling back to chat-only sessions or erroring instead of getting a repo-backed workspace. ([#21217](https://github.com/mastra-ai/mastra/pull/21217))

  - Fixed repository resolution failing when a factory project carries a stale source-control connection (for example after a GitHub App reinstall deleted the old installation but left its connection behind). Resolution now tries every connection and skips the ones that no longer resolve.
  - Fixed chat-only sessions on deployments configured with a remote sandbox replying with "A Factory session ID is required to create a remote sandbox workspace" on every message. These sessions now run without a workspace, so workspace tools are simply not registered and the server host never executes commands for them.
  - Fixed top-level DM and channel conversations (threads with no thread timestamp) failing their clone with the invalid git ref `slack/`. Their session branch now derives from the channel id.

- Improved Factory workspace deletion by terminating matching live controller sessions before sandbox reclamation. ([#21174](https://github.com/mastra-ai/mastra/pull/21174))

- Added `dispatcher.maxInFlight` to `MastraFactoryConfig` and the `MASTRACODE_DISPATCH_MAX_IN_FLIGHT` deployment setting to configure the maximum number of concurrent Factory background dispatches per replica. ([#20903](https://github.com/mastra-ai/mastra/pull/20903))

  ```sh
  export MASTRACODE_DISPATCH_MAX_IN_FLIGHT=10
  ```

- Fixed Factory sessions rejecting signed-in users when session-based authentication providers store the user and active organization in a wrapped session shape. Workspace ownership checks and GitHub session tools now recognize both flat and session-wrapped authenticated users. ([#21008](https://github.com/mastra-ai/mastra/pull/21008))

- Make factory review sessions survive server restarts, dropped connections, and strict git configs. ([#20899](https://github.com/mastra-ai/mastra/pull/20899))

  - Crash-resumed sessions recover their run binding and untrusted-checkout posture from the binding table instead of silently losing the transition tool.
  - Overly long transition rationales are clamped instead of failing the run.
  - Clones and pulls retry when the transfer to github.com drops partway through.
  - Checkouts with `pull.rebase` set no longer fail workspace materialization.

- Fixed the sign-in callback redirecting straight back to the identity provider in a loop when it denies access (for example access_denied for an account that is not part of the organization). The denial now lands on the sign-in page with the error shown. ([#21166](https://github.com/mastra-ai/mastra/pull/21166))

- Fixed the Factory review handoff turning finding references into GitHub links. A re-review that pointed back at "Blocking `#1`" published a link to issue 1 of the repository; findings are now named by subject and `file:line`. ([#21263](https://github.com/mastra-ai/mastra/pull/21263))

- Improved Factory issue investigations with structured summaries and GitHub triage-label updates. ([#20988](https://github.com/mastra-ai/mastra/pull/20988))

- Fixed Factory intake saves when generated clients include disabled defaults for integrations that are not configured. ([#21019](https://github.com/mastra-ai/mastra/pull/21019))

- Fixed Factory review sessions losing caller identity when an existing request context is empty. ([#21055](https://github.com/mastra-ai/mastra/pull/21055))

- Fixed Linear issue investigations using inconsistent metadata, failing to start, or resolving a stale work item binding after the same session was rebound. ([#20810](https://github.com/mastra-ai/mastra/pull/20810))

- Slow workspace opens can now be diagnosed directly from server logs. Added `[factory:timing]` log lines for each phase of the sandbox session-open path — `sandbox.reattach`, `sandbox.provision`, `workspace.materialize`, and `workspace.checkout` — so you can see exactly which phase is slow instead of reconstructing timings by hand. ([#21194](https://github.com/mastra-ai/mastra/pull/21194))

- Fixed autonomous GitHub factory-rule runs ignoring the factory's configured default model. ([#20827](https://github.com/mastra-ai/mastra/pull/20827))

  A run triggered by a factory rule started on the built-in default model rather than the model configured on the factory project, so a factory set up for a provider other than the built-in default failed the run outright with a missing-credentials error. Runs started from the board were unaffected, which is why this only appeared on autonomous runs. Rule-triggered runs now start on the project's configured model, matching runs started from the board.

- Added a `command_exit` session event to the agent controller. Subscribers now receive the exit code and success flag of each foreground `execute_command` tool call, alongside the existing `shell_output` stream: ([#21211](https://github.com/mastra-ai/mastra/pull/21211))

  ```typescript
  session.subscribe(event => {
    if (event.type === 'command_exit') {
      console.log(event.toolCallId, event.exitCode, event.success);
    }
  });
  ```

  Previously the exit outcome was only visible inside the tool result text, so observers could stream a command's output but never tell whether it succeeded.

- Return from deleting a workspace as soon as its session is gone instead of holding the request open while the sandbox is reclaimed. Waking the VM and scrubbing its checkout took minutes on a large repository, so the UI appeared to hang long after the workspace had been removed. The scrub and pool release now run in the background; because a sandbox only becomes claimable once it is published to the reuse pool, the next session still gets a clean checkout. ([#20785](https://github.com/mastra-ai/mastra/pull/20785))

- Hardened the GitHub reconcile worker, the Platform Linear event worker, and the shared issue reconciler: ([#20845](https://github.com/mastra-ai/mastra/pull/20845))

  - Platform Linear Issue events now only dispatch to `(orgId, factoryProjectId)` pairs that already have a persisted work item for the incoming Linear issue. Previously the worker fanned an event out to every Factory project regardless of tenant, which could materialize a triage card in an unrelated org via the default `linearIssueObserved` rule.
  - Reconciler metadata patches no longer spread `undefined` values over stored fields, so a live issue that omits (for example) an author does not clobber the previously recorded value.
  - Documented the event worker's at-most-once delivery contract explicitly: the cursor advances past a failing ingest and drift is caught by the folded reconciler sweep on its own cadence.
  - `GithubReconcileWorker` now renews its lease while a sweep is in flight, so folding the issue sweep into the same tick can no longer let the lease expire and hand off to a replica mid-sweep. A `renewLease` result of `false` or a renewal error is treated as lease loss: the worker aborts before running the folded issue sweep and skips `releaseLease` so the new owner's TTL is not disturbed.
  - The Platform Linear event worker no longer calls `listWorkspaces` in reconcile-only mode, so a workspace-listing outage cannot block the reconcile sweep.
  - The Platform Linear event worker now resolves the project list once per event page rather than once per event, avoiding up to `EVENT_PAGE_SIZE` × N project scans per poll cycle.

- Fixed new Factory sessions stalling for minutes when the background decision queue was deep. The dispatcher now claims pending session starts before deferred decisions, so a new session always starts on the next tick. ([#21265](https://github.com/mastra-ai/mastra/pull/21265))

- Fixed reused Factory workspaces retaining GitHub credentials from an outdated work or review assignment. ([#21035](https://github.com/mastra-ai/mastra/pull/21035))

- Fixed Slack sessions ignoring the factory's configured default model and memory settings. ([#20832](https://github.com/mastra-ai/mastra/pull/20832))

  Sessions started from Slack ran on the built-in default model rather than the model configured on the factory project, so a factory set up for a provider other than the built-in default failed every Slack message with a missing-credentials error. Repo-backed Slack threads now start on the project's configured model and observational-memory settings, matching runs started from the web.

  A thread keeps a model chosen inside it. Once a model is set on the thread, restarting the server no longer resets it to the project default.

- Work board cards now follow their GitHub issue when it closes: closing an issue moves its card to Done (or to Canceled when the issue was closed as `not_planned` or `duplicate`), and a card whose issue closed while the deployment was unreachable is caught up automatically by the periodic reconcile sweep. Previously these cards stayed on the board until moved by hand. ([#20895](https://github.com/mastra-ai/mastra/pull/20895))

- Preserved every GitHub issue assignee end-to-end so Factory boards no longer drop co-assignees, and backfilled missing assignee and reviewer metadata so the pull request reconciler stops re-fetching cards on every sweep. ([#20841](https://github.com/mastra-ai/mastra/pull/20841))

- Updated dependencies [[`e7109ee`](https://github.com/mastra-ai/mastra/commit/e7109ee6f731bacc79c885906f3c7dca8d8f013a), [`ae0e985`](https://github.com/mastra-ai/mastra/commit/ae0e985e8f1186a8ecfcf0de6dd36ac12ef85324), [`e7109ee`](https://github.com/mastra-ai/mastra/commit/e7109ee6f731bacc79c885906f3c7dca8d8f013a), [`b8ce7ec`](https://github.com/mastra-ai/mastra/commit/b8ce7ec96e39343c6c2f36d12d68a9ad816c09f7), [`2e4624e`](https://github.com/mastra-ai/mastra/commit/2e4624edb6917e61249cb60ee377735e7af7e4a9), [`45a9147`](https://github.com/mastra-ai/mastra/commit/45a914741f578754d79d8b7de7b4e4f304d8e14a), [`a3a3624`](https://github.com/mastra-ai/mastra/commit/a3a3624f646b98e409424d8defccbd334da9e8b8), [`6246914`](https://github.com/mastra-ai/mastra/commit/62469146636911f3cbbe0880bd011c6a897a59a7), [`6445eba`](https://github.com/mastra-ai/mastra/commit/6445eba6020abac681aba1cc9289f446cb400cbe), [`86b7b77`](https://github.com/mastra-ai/mastra/commit/86b7b777980d30f66e1fd134a37d2af4c22e54cc), [`1c75e32`](https://github.com/mastra-ai/mastra/commit/1c75e32f7fc0b9fb6f548b4407feaec8a1440212), [`296dc9a`](https://github.com/mastra-ai/mastra/commit/296dc9af29f3616e786c7825ec32e0df92d754c5), [`f59032a`](https://github.com/mastra-ai/mastra/commit/f59032a73699443555a08a479e7ac578975784f2), [`f59032a`](https://github.com/mastra-ai/mastra/commit/f59032a73699443555a08a479e7ac578975784f2), [`cdd5c33`](https://github.com/mastra-ai/mastra/commit/cdd5c33ac6c7118a9f139e6dc0e14e6a8ae31658), [`1670533`](https://github.com/mastra-ai/mastra/commit/1670533986f6bacf567746245348125e3a106448), [`3f73c07`](https://github.com/mastra-ai/mastra/commit/3f73c076727e8c36b4fff7a1b40290fb68957fa8), [`772c0c8`](https://github.com/mastra-ai/mastra/commit/772c0c897cec383258de2e6178147f8014767c7b), [`d7cf7fa`](https://github.com/mastra-ai/mastra/commit/d7cf7fafc1ae1b50bd8462dd0e6c671a8606db93), [`7c1ebb1`](https://github.com/mastra-ai/mastra/commit/7c1ebb15690c4b3f0eabb19077cf8af573311e57), [`0f9a448`](https://github.com/mastra-ai/mastra/commit/0f9a448502157e59f7b76f24360ad497168f5ef8), [`578bf2e`](https://github.com/mastra-ai/mastra/commit/578bf2e6a88e9d5b8bf502204e15a95dfbb679ae), [`3e50f63`](https://github.com/mastra-ai/mastra/commit/3e50f63db85e9fe365b4ce5daecb0ac0dc464d93), [`25956fc`](https://github.com/mastra-ai/mastra/commit/25956fc8841780d506acb22b618fdb4dcf6c4e21), [`2e4624e`](https://github.com/mastra-ai/mastra/commit/2e4624edb6917e61249cb60ee377735e7af7e4a9), [`c47165c`](https://github.com/mastra-ai/mastra/commit/c47165c983c87594c6952f1fd2fa51a90205034c), [`289f4ce`](https://github.com/mastra-ai/mastra/commit/289f4ce16e3293370440172132c52ee787cbc09f), [`df31eb0`](https://github.com/mastra-ai/mastra/commit/df31eb0c7087d782a0d9346e467f9a4af4b0eef6), [`9571e3a`](https://github.com/mastra-ai/mastra/commit/9571e3a06ed2c5220196460bf82a2129255c3a8b), [`4f16ff8`](https://github.com/mastra-ai/mastra/commit/4f16ff824bf2f9b0ddc93f210477c10c8a4fb1ab), [`b4c89b4`](https://github.com/mastra-ai/mastra/commit/b4c89b4371b0c86da57403ad1a3b3ef0681f3128), [`e6534fa`](https://github.com/mastra-ai/mastra/commit/e6534fab031216f6cb48c4c9907cbfdce9d60bc6), [`210cb7a`](https://github.com/mastra-ai/mastra/commit/210cb7a167998c7bbf72cb3b93e6eb0563330239), [`06b2d87`](https://github.com/mastra-ai/mastra/commit/06b2d87e63bcdd0ed59215c6789692b9b12de376), [`1c67d85`](https://github.com/mastra-ai/mastra/commit/1c67d85e9da8285662f4dbbf47e0378c3fee0747), [`ac01d63`](https://github.com/mastra-ai/mastra/commit/ac01d6355974aec73fdb8781449ed12bac582094), [`80a3324`](https://github.com/mastra-ai/mastra/commit/80a33245d3110204de6f56d61211523ffe338692), [`e44e8f3`](https://github.com/mastra-ai/mastra/commit/e44e8f370b66c339ddcaba946d33da6d3c3f06cd), [`d9d2881`](https://github.com/mastra-ai/mastra/commit/d9d2881ede6dd6c023d144215fc812062aed0890), [`a810a05`](https://github.com/mastra-ai/mastra/commit/a810a058f62ad407cfc1701e0be36ae91145d7cf), [`ba24be6`](https://github.com/mastra-ai/mastra/commit/ba24be662439c331ab23a600041f93803c89eca8), [`842b5fe`](https://github.com/mastra-ai/mastra/commit/842b5fe22b6a7fa811bd14e48eb9af523ac989f2), [`990611b`](https://github.com/mastra-ai/mastra/commit/990611ba76eb876d86c9c594371ae5f02f94b432), [`80bdf3a`](https://github.com/mastra-ai/mastra/commit/80bdf3ae16ade6ff63bde0cb16fa2df8ab7dd4dd), [`c967a5e`](https://github.com/mastra-ai/mastra/commit/c967a5eec150c5dc5418c4a4388982d1fb7ad27c), [`1315d8f`](https://github.com/mastra-ai/mastra/commit/1315d8f17e8e7acb61cca46b72a1d42f6d00d289), [`dc4a25d`](https://github.com/mastra-ai/mastra/commit/dc4a25d41af4e2fe97a816070eaec6aa963ab53b), [`9ba1247`](https://github.com/mastra-ai/mastra/commit/9ba12470c77f1c03642d720ce67e517e878f666e), [`fd96298`](https://github.com/mastra-ai/mastra/commit/fd96298a8367622f4ebfcaa97b5b6c1fbbd14564), [`66bbfb5`](https://github.com/mastra-ai/mastra/commit/66bbfb5f05b473d39f88c0e4a481ccac41634f3a), [`dc4a25d`](https://github.com/mastra-ai/mastra/commit/dc4a25d41af4e2fe97a816070eaec6aa963ab53b), [`f8da216`](https://github.com/mastra-ai/mastra/commit/f8da21633e7eb0e31c9ce0fc30567870d19416d3), [`4a09a9c`](https://github.com/mastra-ai/mastra/commit/4a09a9c0474ef643558fcb5f0edc542b82f1cab0), [`5f798b3`](https://github.com/mastra-ai/mastra/commit/5f798b3362e9bdf4d690f85245606e146eef60b9), [`6a84954`](https://github.com/mastra-ai/mastra/commit/6a84954a2667f85b6d59da652dab1bbff007ccb0), [`1e83a47`](https://github.com/mastra-ai/mastra/commit/1e83a4734ab61ba5926af6793e3569a78b72ed37), [`52d8ef0`](https://github.com/mastra-ai/mastra/commit/52d8ef03801f1deb7ee48532fc4190dd4a33916c), [`cdd5c33`](https://github.com/mastra-ai/mastra/commit/cdd5c33ac6c7118a9f139e6dc0e14e6a8ae31658), [`7fdcaa6`](https://github.com/mastra-ai/mastra/commit/7fdcaa66105d64290f9b14432a12ec99f39c4d3a), [`d6c56f9`](https://github.com/mastra-ai/mastra/commit/d6c56f951db3213330b98b0abafa9778c8770e58), [`e08e789`](https://github.com/mastra-ai/mastra/commit/e08e789c1bf4cd2fe46363f7a4728536ceccc9bd), [`bf936e2`](https://github.com/mastra-ai/mastra/commit/bf936e2c89b2ff0dad5695b873ddc009ba96d41e), [`7fb580a`](https://github.com/mastra-ai/mastra/commit/7fb580ac73fbcacf2ff00872a3395f73ae1b9fa5), [`ed5d606`](https://github.com/mastra-ai/mastra/commit/ed5d606739c5e3fbdfa9f272df7809aa5ab43b1d), [`f53d5bd`](https://github.com/mastra-ai/mastra/commit/f53d5bd4885b29e4ac29a428a6044088ea8d6aa3), [`87db0e4`](https://github.com/mastra-ai/mastra/commit/87db0e49a8c04030eb74fff7f051fac330678839), [`32980a3`](https://github.com/mastra-ai/mastra/commit/32980a3e2413d0274ac244d32c37d910edc13f00), [`01a2943`](https://github.com/mastra-ai/mastra/commit/01a2943a7d886edefdff072bfa51f055bab54437), [`82e3365`](https://github.com/mastra-ai/mastra/commit/82e3365ef7c9bf7bee2e7a7029035ea262d68895), [`6104347`](https://github.com/mastra-ai/mastra/commit/61043473ba6bfd0a25156824e853e13165562e6c), [`35cc901`](https://github.com/mastra-ai/mastra/commit/35cc90102cf834a84827acaf9eee0b6d6d1e2a3b), [`a8b4cf0`](https://github.com/mastra-ai/mastra/commit/a8b4cf02823cffebc4751a53337dfacf097c1ae1), [`9571e3a`](https://github.com/mastra-ai/mastra/commit/9571e3a06ed2c5220196460bf82a2129255c3a8b), [`0ce1d05`](https://github.com/mastra-ai/mastra/commit/0ce1d054586c5d348543d2749067b40adbc9b783), [`6698e16`](https://github.com/mastra-ai/mastra/commit/6698e168d74e054fc3efa97b19025fb2d1dafc45), [`333785c`](https://github.com/mastra-ai/mastra/commit/333785c93cbb01e42c60167e995457c28897ddbf), [`bda2235`](https://github.com/mastra-ai/mastra/commit/bda22353ee28f2df0eaea555f7cae1549f979c0b), [`efd5c81`](https://github.com/mastra-ai/mastra/commit/efd5c81cc25fde3c2ddd86fc1178deb4ec176e19), [`a04d1a6`](https://github.com/mastra-ai/mastra/commit/a04d1a642ccae3ea3b28be37067480d49bcb1b7d), [`1b482c2`](https://github.com/mastra-ai/mastra/commit/1b482c2d89244dd758c41e5f927a2b44041388d2), [`45bfb88`](https://github.com/mastra-ai/mastra/commit/45bfb88fd52f1dd3be20e2a38905777c96499c90), [`ff28284`](https://github.com/mastra-ai/mastra/commit/ff2828416f14daff9d956e6a352fdaa23c950979), [`4bcdfaf`](https://github.com/mastra-ai/mastra/commit/4bcdfaf0eac3199d7cb171b0a19a92c9c341eea4), [`e3b9307`](https://github.com/mastra-ai/mastra/commit/e3b9307098daefbfae2a52ae2ef51bc9fc701190), [`d6834c5`](https://github.com/mastra-ai/mastra/commit/d6834c5a7866b16734d23900163c2414ed70d791), [`f33264f`](https://github.com/mastra-ai/mastra/commit/f33264f517ae603279afd5c4251e2b40f6dd3618), [`689f2c4`](https://github.com/mastra-ai/mastra/commit/689f2c4b6c0835fe455702b01d21daa8abcd9331), [`fcd0667`](https://github.com/mastra-ai/mastra/commit/fcd0667a4e378be35c9a1b1eb19cce78fbfd7282), [`cfd0d9e`](https://github.com/mastra-ai/mastra/commit/cfd0d9ec77ec3c69dd96f79cdb579e03d79f22ce), [`acc3513`](https://github.com/mastra-ai/mastra/commit/acc3513b19f79bf0a7ec2998694580edca54086c), [`1670533`](https://github.com/mastra-ai/mastra/commit/1670533986f6bacf567746245348125e3a106448), [`a7eb4a1`](https://github.com/mastra-ai/mastra/commit/a7eb4a11450f6170274ed5141bffe821d4fdd5a6), [`0976933`](https://github.com/mastra-ai/mastra/commit/0976933142333ec78451feef265b68bcb45aa5e7), [`242b945`](https://github.com/mastra-ai/mastra/commit/242b94558777bfbdeb42cbfea84afff0b6ad0633), [`c52d346`](https://github.com/mastra-ai/mastra/commit/c52d3462ec831a5d95926ecd3d3373f5928ad2e5), [`af4636a`](https://github.com/mastra-ai/mastra/commit/af4636a74463275d71c1d13a38f7d2b738f128bf), [`01a2943`](https://github.com/mastra-ai/mastra/commit/01a2943a7d886edefdff072bfa51f055bab54437), [`2eabc09`](https://github.com/mastra-ai/mastra/commit/2eabc097d86d52fbd0123da36a7c874154cc384f), [`0023e79`](https://github.com/mastra-ai/mastra/commit/0023e7919431078280abd11c89d1edeae35fcc69), [`c2ad51e`](https://github.com/mastra-ai/mastra/commit/c2ad51e2467f901eecba8c9f4a45e22a50bd7c18), [`25ca73d`](https://github.com/mastra-ai/mastra/commit/25ca73d25dee7ce9f0ca72939e3a505c4db7257e), [`2f9ef3f`](https://github.com/mastra-ai/mastra/commit/2f9ef3f4ca06fc2dcdd5088c26b7f4da6a016791), [`e7eefcb`](https://github.com/mastra-ai/mastra/commit/e7eefcb162cda7c493e8c3bf43050ead0efbcb2c), [`fea5cae`](https://github.com/mastra-ai/mastra/commit/fea5caedc7e2cfea51784a15e015952692027abf), [`72ce266`](https://github.com/mastra-ai/mastra/commit/72ce2669506e755c0bbe73baf3a7e8ea5208bdad), [`4d7aca2`](https://github.com/mastra-ai/mastra/commit/4d7aca2fe75f225c83d1502d63079568e6ec163f), [`e1cead1`](https://github.com/mastra-ai/mastra/commit/e1cead17b5f3653cf00d2f90cc19b113119c02ba), [`01a2943`](https://github.com/mastra-ai/mastra/commit/01a2943a7d886edefdff072bfa51f055bab54437), [`d9d93b2`](https://github.com/mastra-ai/mastra/commit/d9d93b25e4a65ad5fa153fa35be7ed149c8d587f), [`c4ec889`](https://github.com/mastra-ai/mastra/commit/c4ec889561c0264c43f66d04d587bee4ce35e792), [`4b59f78`](https://github.com/mastra-ai/mastra/commit/4b59f786cbc9a7d1ef07a07517dbd4b96865e99d), [`eeae63e`](https://github.com/mastra-ai/mastra/commit/eeae63e7fbe8e1f237adc69bca6e2ac13c5ca907), [`3dc97ea`](https://github.com/mastra-ai/mastra/commit/3dc97ea415fad353b48a13095fad1835933cc12a), [`94e7ae9`](https://github.com/mastra-ai/mastra/commit/94e7ae970b37c888cd1244ef013292639a2fe6d1), [`e6a2860`](https://github.com/mastra-ai/mastra/commit/e6a2860649cc51f87d32d78b766ae2126446ba07), [`7010c5d`](https://github.com/mastra-ai/mastra/commit/7010c5d15728bf9c5dfe4fb6b1bf80ce23bf143a), [`bab06b1`](https://github.com/mastra-ai/mastra/commit/bab06b18923873a584bdfc71a6b4ec7fb4727fb7), [`3d01cd3`](https://github.com/mastra-ai/mastra/commit/3d01cd387321b6f9c5cac31d487c84bf51b19c78), [`7bf3086`](https://github.com/mastra-ai/mastra/commit/7bf308663f0115ca74ad20554ade740f06640859), [`4c186a0`](https://github.com/mastra-ai/mastra/commit/4c186a017275f45e6ed4c09de0f89550e2d09e8c), [`b0fa077`](https://github.com/mastra-ai/mastra/commit/b0fa077bcbc9b08551846fe372a0d3d15b71ed72), [`0282e16`](https://github.com/mastra-ai/mastra/commit/0282e16115538c8e9b248b90f0748eb01cb5dc98), [`a8dd139`](https://github.com/mastra-ai/mastra/commit/a8dd1391a9fe9a6632c25809ef236980afa9a020), [`6a667b4`](https://github.com/mastra-ai/mastra/commit/6a667b4b7cd6a93fe41fcdd357b08c5a8c09b9ab), [`9be8878`](https://github.com/mastra-ai/mastra/commit/9be8878dcf0388e84fc4873e0eec27bd49b881a4), [`e5786be`](https://github.com/mastra-ai/mastra/commit/e5786be02bb903073082bd9d6da880ebaacc343f), [`2440e09`](https://github.com/mastra-ai/mastra/commit/2440e096ea6c2def1ccc1eb2d0f3f5b88c4af940), [`2093fbd`](https://github.com/mastra-ai/mastra/commit/2093fbd53bb744bae19ec89f6d73db9a66fbe8a7), [`a59049b`](https://github.com/mastra-ai/mastra/commit/a59049b1652a13efff66ac826326b5ed9a550342), [`7bd85ea`](https://github.com/mastra-ai/mastra/commit/7bd85ea7588b71c25ce9f4019c88f8539be5dcbc), [`83fa004`](https://github.com/mastra-ai/mastra/commit/83fa0044bfda8b703a83883dbd8bef204844d13f), [`833432b`](https://github.com/mastra-ai/mastra/commit/833432b92612b7f122aa7342132ea37f2ad96e77), [`a463cdf`](https://github.com/mastra-ai/mastra/commit/a463cdf1c95c3059e70f0bff27959e8558bb899d), [`e7a5da4`](https://github.com/mastra-ai/mastra/commit/e7a5da4ef8e4dd452d2f232961b4e682a85ffe43), [`0282e16`](https://github.com/mastra-ai/mastra/commit/0282e16115538c8e9b248b90f0748eb01cb5dc98), [`7b4393d`](https://github.com/mastra-ai/mastra/commit/7b4393d557411fdcf07b0e30e5acaf7cc85154ae), [`0ea6b80`](https://github.com/mastra-ai/mastra/commit/0ea6b8001408ce02b56e8be0536b0fd8cbaf8ad2)]:
  - @mastra/code-sdk@1.2.0
  - @mastra/core@1.58.0
  - @mastra/slack@1.6.1

## 0.6.0-alpha.19

### Patch Changes

- Fixed the Factory review handoff turning finding references into GitHub links. A re-review that pointed back at "Blocking `#1`" published a link to issue 1 of the repository; findings are now named by subject and `file:line`. ([#21263](https://github.com/mastra-ai/mastra/pull/21263))

- Updated dependencies [[`296dc9a`](https://github.com/mastra-ai/mastra/commit/296dc9af29f3616e786c7825ec32e0df92d754c5), [`1670533`](https://github.com/mastra-ai/mastra/commit/1670533986f6bacf567746245348125e3a106448), [`4a09a9c`](https://github.com/mastra-ai/mastra/commit/4a09a9c0474ef643558fcb5f0edc542b82f1cab0), [`1e83a47`](https://github.com/mastra-ai/mastra/commit/1e83a4734ab61ba5926af6793e3569a78b72ed37), [`ff28284`](https://github.com/mastra-ai/mastra/commit/ff2828416f14daff9d956e6a352fdaa23c950979), [`1670533`](https://github.com/mastra-ai/mastra/commit/1670533986f6bacf567746245348125e3a106448)]:
  - @mastra/core@1.58.0-alpha.16
  - @mastra/code-sdk@1.2.0-alpha.18

## 0.6.0-alpha.18

### Minor Changes

- Fixed the Factory metrics so the same date range always reports the same numbers, and dropped the response fields that nothing displayed. ([#21256](https://github.com/mastra-ai/mastra/pull/21256))

  **Completions are events, not the board's current state.** Throughput and lead time now count entries into `done` in the stage history, so reopening a card no longer erases the day it shipped and a card that shipped twice counts twice. The per-day rate divides by the days the board actually existed, so a 12-month range on a two-week-old board no longer reads as ~0 per day.

  **Automation numbers stop counting the wrong things.** A card landing on the board when it is created is no longer counted as an automated stage move, which used to credit every webhook-synced card. Automation coverage measures the first pass through each stage only — a redo used to add a second entry to the denominator alone, capping a fully automated stage at 50% — and each pass's outcome is now frozen at the end of the window instead of reflecting where the card sits today.

  **Response shape.** `stageDurations`, `wip`, `agingWip` and `earliestItemAt` are gone: nothing rendered them, and live in-flight work is already covered by the queue-health chart. `windowDays` is now `daysCovered` (the window clipped to the board's life) and `cycleTime` is `leadTime`, which is what it always measured — card creation through to `done`.

  The metrics endpoint (`GET /web/factory/projects/:id/metrics`) renames two fields:

  ```jsonc
  // before
  { "metrics": { "windowDays": 30, "cycleTime": { "medianMs": 7200000 } } }
  // after
  { "metrics": { "daysCovered": 30, "leadTime": { "medianMs": 7200000 } } }
  ```

  A corrupt stage-history timestamp now throws instead of being read as 1970.

### Patch Changes

- Updated dependencies [[`dc4a25d`](https://github.com/mastra-ai/mastra/commit/dc4a25d41af4e2fe97a816070eaec6aa963ab53b), [`dc4a25d`](https://github.com/mastra-ai/mastra/commit/dc4a25d41af4e2fe97a816070eaec6aa963ab53b)]:
  - @mastra/core@1.58.0-alpha.15
  - @mastra/code-sdk@1.2.0-alpha.17

## 0.6.0-alpha.17

### Patch Changes

- Fixed sandbox checkpoints only being captured at session teardown. Factory sessions now snapshot the workspace sandbox at the end of every agent turn, so sandboxes that are reclaimed while idle can be restored from a checkpoint that includes the last completed turn's changes. ([#21227](https://github.com/mastra-ai/mastra/pull/21227))

- Improved Factory workspace deletion by terminating matching live controller sessions before sandbox reclamation. ([#21174](https://github.com/mastra-ai/mastra/pull/21174))

- Fixed new Factory sessions stalling for minutes when the background decision queue was deep. The dispatcher now claims pending session starts before deferred decisions, so a new session always starts on the next tick. ([#21265](https://github.com/mastra-ai/mastra/pull/21265))

- Updated dependencies [[`210cb7a`](https://github.com/mastra-ai/mastra/commit/210cb7a167998c7bbf72cb3b93e6eb0563330239), [`5f798b3`](https://github.com/mastra-ai/mastra/commit/5f798b3362e9bdf4d690f85245606e146eef60b9), [`01a2943`](https://github.com/mastra-ai/mastra/commit/01a2943a7d886edefdff072bfa51f055bab54437), [`01a2943`](https://github.com/mastra-ai/mastra/commit/01a2943a7d886edefdff072bfa51f055bab54437), [`25ca73d`](https://github.com/mastra-ai/mastra/commit/25ca73d25dee7ce9f0ca72939e3a505c4db7257e), [`e1cead1`](https://github.com/mastra-ai/mastra/commit/e1cead17b5f3653cf00d2f90cc19b113119c02ba), [`01a2943`](https://github.com/mastra-ai/mastra/commit/01a2943a7d886edefdff072bfa51f055bab54437)]:
  - @mastra/core@1.58.0-alpha.14
  - @mastra/code-sdk@1.2.0-alpha.16

## 0.6.0-alpha.16

### Minor Changes

- Added a `firstMeaningfulExecAt` timestamp to source-control sessions, recording when the session's agent completed its first successful sandbox command. Together with `firstMessageAt` this measures time-to-first-meaningful-exec: how long a user waits between sending their first message and the agent actually doing work in a live sandbox. The value is written once per session and is available on all session read APIs; setup commands run by the platform itself (skill loading, repo checkout) do not count. ([#21211](https://github.com/mastra-ai/mastra/pull/21211))

- Added a `firstMessageAt` timestamp to Factory source-control sessions. The session's first agent run now records when the first message reached the agent, so session listings and latency reporting can measure time-to-first-response from the real conversation start instead of the session's creation time (which can be long before the user sends anything). The value is returned on session objects from the source-control sessions API and is write-once: later messages never move it. ([#21206](https://github.com/mastra-ai/mastra/pull/21206))

### Patch Changes

- Fixed Slack threads on cloud factory deployments falling back to chat-only sessions or erroring instead of getting a repo-backed workspace. ([#21217](https://github.com/mastra-ai/mastra/pull/21217))

  - Fixed repository resolution failing when a factory project carries a stale source-control connection (for example after a GitHub App reinstall deleted the old installation but left its connection behind). Resolution now tries every connection and skips the ones that no longer resolve.
  - Fixed chat-only sessions on deployments configured with a remote sandbox replying with "A Factory session ID is required to create a remote sandbox workspace" on every message. These sessions now run without a workspace, so workspace tools are simply not registered and the server host never executes commands for them.
  - Fixed top-level DM and channel conversations (threads with no thread timestamp) failing their clone with the invalid git ref `slack/`. Their session branch now derives from the channel id.

- Fixed the sign-in callback redirecting straight back to the identity provider in a loop when it denies access (for example access_denied for an account that is not part of the organization). The denial now lands on the sign-in page with the error shown. ([#21166](https://github.com/mastra-ai/mastra/pull/21166))

- Slow workspace opens can now be diagnosed directly from server logs. Added `[factory:timing]` log lines for each phase of the sandbox session-open path — `sandbox.reattach`, `sandbox.provision`, `workspace.materialize`, and `workspace.checkout` — so you can see exactly which phase is slow instead of reconstructing timings by hand. ([#21194](https://github.com/mastra-ai/mastra/pull/21194))

- Added a `command_exit` session event to the agent controller. Subscribers now receive the exit code and success flag of each foreground `execute_command` tool call, alongside the existing `shell_output` stream: ([#21211](https://github.com/mastra-ai/mastra/pull/21211))

  ```typescript
  session.subscribe(event => {
    if (event.type === 'command_exit') {
      console.log(event.toolCallId, event.exitCode, event.success);
    }
  });
  ```

  Previously the exit outcome was only visible inside the tool result text, so observers could stream a command's output but never tell whether it succeeded.

- Updated dependencies [[`9571e3a`](https://github.com/mastra-ai/mastra/commit/9571e3a06ed2c5220196460bf82a2129255c3a8b), [`d6c56f9`](https://github.com/mastra-ai/mastra/commit/d6c56f951db3213330b98b0abafa9778c8770e58), [`9571e3a`](https://github.com/mastra-ai/mastra/commit/9571e3a06ed2c5220196460bf82a2129255c3a8b), [`a04d1a6`](https://github.com/mastra-ai/mastra/commit/a04d1a642ccae3ea3b28be37067480d49bcb1b7d), [`acc3513`](https://github.com/mastra-ai/mastra/commit/acc3513b19f79bf0a7ec2998694580edca54086c), [`94e7ae9`](https://github.com/mastra-ai/mastra/commit/94e7ae970b37c888cd1244ef013292639a2fe6d1), [`6a667b4`](https://github.com/mastra-ai/mastra/commit/6a667b4b7cd6a93fe41fcdd357b08c5a8c09b9ab), [`2440e09`](https://github.com/mastra-ai/mastra/commit/2440e096ea6c2def1ccc1eb2d0f3f5b88c4af940), [`a59049b`](https://github.com/mastra-ai/mastra/commit/a59049b1652a13efff66ac826326b5ed9a550342)]:
  - @mastra/core@1.58.0-alpha.13
  - @mastra/code-sdk@1.2.0-alpha.15

## 0.6.0-alpha.15

### Patch Changes

- Updated dependencies [[`72ce266`](https://github.com/mastra-ai/mastra/commit/72ce2669506e755c0bbe73baf3a7e8ea5208bdad)]:
  - @mastra/code-sdk@1.2.0-alpha.14

## 0.6.0-alpha.14

### Patch Changes

- Updated dependencies [[`2e4624e`](https://github.com/mastra-ai/mastra/commit/2e4624edb6917e61249cb60ee377735e7af7e4a9), [`2e4624e`](https://github.com/mastra-ai/mastra/commit/2e4624edb6917e61249cb60ee377735e7af7e4a9), [`e6534fa`](https://github.com/mastra-ai/mastra/commit/e6534fab031216f6cb48c4c9907cbfdce9d60bc6), [`7fdcaa6`](https://github.com/mastra-ai/mastra/commit/7fdcaa66105d64290f9b14432a12ec99f39c4d3a), [`cfd0d9e`](https://github.com/mastra-ai/mastra/commit/cfd0d9ec77ec3c69dd96f79cdb579e03d79f22ce), [`d9d93b2`](https://github.com/mastra-ai/mastra/commit/d9d93b25e4a65ad5fa153fa35be7ed149c8d587f)]:
  - @mastra/core@1.58.0-alpha.12
  - @mastra/code-sdk@1.2.0-alpha.13

## 0.6.0-alpha.13

### Patch Changes

- Updated dependencies [[`b8ce7ec`](https://github.com/mastra-ai/mastra/commit/b8ce7ec96e39343c6c2f36d12d68a9ad816c09f7), [`a3a3624`](https://github.com/mastra-ai/mastra/commit/a3a3624f646b98e409424d8defccbd334da9e8b8), [`6246914`](https://github.com/mastra-ai/mastra/commit/62469146636911f3cbbe0880bd011c6a897a59a7), [`3f73c07`](https://github.com/mastra-ai/mastra/commit/3f73c076727e8c36b4fff7a1b40290fb68957fa8), [`7c1ebb1`](https://github.com/mastra-ai/mastra/commit/7c1ebb15690c4b3f0eabb19077cf8af573311e57), [`1315d8f`](https://github.com/mastra-ai/mastra/commit/1315d8f17e8e7acb61cca46b72a1d42f6d00d289), [`32980a3`](https://github.com/mastra-ai/mastra/commit/32980a3e2413d0274ac244d32c37d910edc13f00), [`4bcdfaf`](https://github.com/mastra-ai/mastra/commit/4bcdfaf0eac3199d7cb171b0a19a92c9c341eea4), [`af4636a`](https://github.com/mastra-ai/mastra/commit/af4636a74463275d71c1d13a38f7d2b738f128bf), [`a463cdf`](https://github.com/mastra-ai/mastra/commit/a463cdf1c95c3059e70f0bff27959e8558bb899d), [`0ea6b80`](https://github.com/mastra-ai/mastra/commit/0ea6b8001408ce02b56e8be0536b0fd8cbaf8ad2)]:
  - @mastra/core@1.58.0-alpha.11
  - @mastra/code-sdk@1.2.0-alpha.12

## 0.6.0-alpha.12

### Patch Changes

- Updated dependencies [[`66bbfb5`](https://github.com/mastra-ai/mastra/commit/66bbfb5f05b473d39f88c0e4a481ccac41634f3a)]:
  - @mastra/core@1.58.0-alpha.10
  - @mastra/code-sdk@1.2.0-alpha.11

## 0.6.0-alpha.11

### Patch Changes

- Updated dependencies [[`86b7b77`](https://github.com/mastra-ai/mastra/commit/86b7b777980d30f66e1fd134a37d2af4c22e54cc), [`80a3324`](https://github.com/mastra-ai/mastra/commit/80a33245d3110204de6f56d61211523ffe338692), [`d9d2881`](https://github.com/mastra-ai/mastra/commit/d9d2881ede6dd6c023d144215fc812062aed0890), [`82e3365`](https://github.com/mastra-ai/mastra/commit/82e3365ef7c9bf7bee2e7a7029035ea262d68895), [`1b482c2`](https://github.com/mastra-ai/mastra/commit/1b482c2d89244dd758c41e5f927a2b44041388d2), [`e6a2860`](https://github.com/mastra-ai/mastra/commit/e6a2860649cc51f87d32d78b766ae2126446ba07), [`7bd85ea`](https://github.com/mastra-ai/mastra/commit/7bd85ea7588b71c25ce9f4019c88f8539be5dcbc), [`833432b`](https://github.com/mastra-ai/mastra/commit/833432b92612b7f122aa7342132ea37f2ad96e77)]:
  - @mastra/core@1.58.0-alpha.9
  - @mastra/code-sdk@1.2.0-alpha.10

## 0.6.0-alpha.10

### Patch Changes

- Updated dependencies [[`1c75e32`](https://github.com/mastra-ai/mastra/commit/1c75e32f7fc0b9fb6f548b4407feaec8a1440212), [`c47165c`](https://github.com/mastra-ai/mastra/commit/c47165c983c87594c6952f1fd2fa51a90205034c), [`e08e789`](https://github.com/mastra-ai/mastra/commit/e08e789c1bf4cd2fe46363f7a4728536ceccc9bd), [`35cc901`](https://github.com/mastra-ai/mastra/commit/35cc90102cf834a84827acaf9eee0b6d6d1e2a3b), [`a8b4cf0`](https://github.com/mastra-ai/mastra/commit/a8b4cf02823cffebc4751a53337dfacf097c1ae1), [`f33264f`](https://github.com/mastra-ai/mastra/commit/f33264f517ae603279afd5c4251e2b40f6dd3618), [`689f2c4`](https://github.com/mastra-ai/mastra/commit/689f2c4b6c0835fe455702b01d21daa8abcd9331), [`eeae63e`](https://github.com/mastra-ai/mastra/commit/eeae63e7fbe8e1f237adc69bca6e2ac13c5ca907), [`4c186a0`](https://github.com/mastra-ai/mastra/commit/4c186a017275f45e6ed4c09de0f89550e2d09e8c), [`b0fa077`](https://github.com/mastra-ai/mastra/commit/b0fa077bcbc9b08551846fe372a0d3d15b71ed72)]:
  - @mastra/core@1.58.0-alpha.8
  - @mastra/code-sdk@1.2.0-alpha.9

## 0.6.0-alpha.9

### Patch Changes

- Fixed Factory review sessions losing caller identity when an existing request context is empty. ([#21055](https://github.com/mastra-ai/mastra/pull/21055))

- Updated dependencies [[`7fb580a`](https://github.com/mastra-ai/mastra/commit/7fb580ac73fbcacf2ff00872a3395f73ae1b9fa5), [`333785c`](https://github.com/mastra-ai/mastra/commit/333785c93cbb01e42c60167e995457c28897ddbf), [`2eabc09`](https://github.com/mastra-ai/mastra/commit/2eabc097d86d52fbd0123da36a7c874154cc384f), [`83fa004`](https://github.com/mastra-ai/mastra/commit/83fa0044bfda8b703a83883dbd8bef204844d13f)]:
  - @mastra/core@1.58.0-alpha.7
  - @mastra/code-sdk@1.2.0-alpha.8

## 0.6.0-alpha.8

### Patch Changes

- Fixed Factory intake saves when generated clients include disabled defaults for integrations that are not configured. ([#21019](https://github.com/mastra-ai/mastra/pull/21019))

- Fixed reused Factory workspaces retaining GitHub credentials from an outdated work or review assignment. ([#21035](https://github.com/mastra-ai/mastra/pull/21035))

## 0.6.0-alpha.7

### Patch Changes

- Fixed Factory sessions rejecting signed-in users when session-based authentication providers store the user and active organization in a wrapped session shape. Workspace ownership checks and GitHub session tools now recognize both flat and session-wrapped authenticated users. ([#21008](https://github.com/mastra-ai/mastra/pull/21008))

- Updated dependencies [[`f59032a`](https://github.com/mastra-ai/mastra/commit/f59032a73699443555a08a479e7ac578975784f2), [`f59032a`](https://github.com/mastra-ai/mastra/commit/f59032a73699443555a08a479e7ac578975784f2), [`3e50f63`](https://github.com/mastra-ai/mastra/commit/3e50f63db85e9fe365b4ce5daecb0ac0dc464d93), [`bf936e2`](https://github.com/mastra-ai/mastra/commit/bf936e2c89b2ff0dad5695b873ddc009ba96d41e)]:
  - @mastra/code-sdk@1.2.0-alpha.7
  - @mastra/core@1.58.0-alpha.6

## 0.6.0-alpha.6

### Patch Changes

- Updated dependencies [[`25956fc`](https://github.com/mastra-ai/mastra/commit/25956fc8841780d506acb22b618fdb4dcf6c4e21)]:
  - @mastra/code-sdk@1.2.0-alpha.6

## 0.6.0-alpha.5

### Patch Changes

- Updated dependencies [[`6445eba`](https://github.com/mastra-ai/mastra/commit/6445eba6020abac681aba1cc9289f446cb400cbe), [`df31eb0`](https://github.com/mastra-ai/mastra/commit/df31eb0c7087d782a0d9346e467f9a4af4b0eef6), [`fcd0667`](https://github.com/mastra-ai/mastra/commit/fcd0667a4e378be35c9a1b1eb19cce78fbfd7282), [`bab06b1`](https://github.com/mastra-ai/mastra/commit/bab06b18923873a584bdfc71a6b4ec7fb4727fb7)]:
  - @mastra/core@1.58.0-alpha.5
  - @mastra/code-sdk@1.2.0-alpha.5

## 0.6.0-alpha.4

### Patch Changes

- Updated dependencies [[`76e5132`](https://github.com/mastra-ai/mastra/commit/76e51328dbc0749c8304e6b3f21e4401f451b081), [`0282e16`](https://github.com/mastra-ai/mastra/commit/0282e16115538c8e9b248b90f0748eb01cb5dc98), [`0282e16`](https://github.com/mastra-ai/mastra/commit/0282e16115538c8e9b248b90f0748eb01cb5dc98)]:
  - @mastra/core@1.58.0-alpha.4
  - @mastra/slack@1.6.1-alpha.0
  - @mastra/code-sdk@1.2.0-alpha.4

## 0.6.0-alpha.3

### Minor Changes

- Add a reasoning-effort configuration surface across mastracode and Factory (fixes #20766): ([#20884](https://github.com/mastra-ai/mastra/pull/20884))

  - New `max` thinking level (mapped to `reasoning effort: max` for OpenAI Codex and Anthropic `effort`).
  - Anthropic extended-thinking wiring: the session thinking level now applies to anthropic/claude-opus-4-7 and other Anthropic models via provider thinking/effort options (previously OpenAI-only).
  - New `models.modeThinkingDefaults` setting: per-mode (build/plan/fast) default thinking levels, resolved at request time with precedence session override → mode default → global `preferences.thinkingLevel`. Configuration changes now apply to the next request of every session, including automated Factory runs.
  - Factory: new Settings → Defaults controls for editing global and per-mode thinking defaults in local deployments.
  - TUI: `/think` now sets a session-only override, supports `/think default` to clear it, and `/think status` reports the effective level with provenance (session override / mode default / global default).

  Example `settings.json` configuration:

  ```json
  {
    "preferences": { "thinkingLevel": "medium" },
    "models": {
      "modeThinkingDefaults": {
        "build": "high",
        "plan": "max",
        "fast": "off"
      }
    }
  }
  ```

- Added persisted workspace file lists for Factory threads. The Files view now keeps a thread's captured file list available after an agent run while file contents continue to load from its live sandbox. ([#20937](https://github.com/mastra-ai/mastra/pull/20937))

- Added label reconciliation and label filtering to Factory work and review boards. GitHub pull requests, GitHub issues, and Linear issues now keep their labels in sync with the provider, and boards expose a searchable multi-select label filter that shares state through the URL. ([#20845](https://github.com/mastra-ai/mastra/pull/20845))

  Selected labels round-trip through the `label` query parameter (repeated per label to preserve values containing commas):

  ```
  /factory/project/<id>/work?label=bug&label=needs%20triage
  /factory/project/<id>/review?teammate=<userId>&label=priority%3Ap0
  ```

- Added automatic GitHub and Linear issue reconciliation so Factory work items stay current when provider metadata changes outside Factory. Platform Linear now tails the Platform event stream and folds a periodic reconcile sweep in on its own cadence, so Issue updates flow into Factory through the normal rules pipeline without waiting for the next board poll. ([#20845](https://github.com/mastra-ai/mastra/pull/20845))

  GitHub issue reconciliation runs inside the same worker as the pull-request reconciler (both self-hosted and Platform), sharing the same lease, cadence, and configured-repository target set. That means one sweep per repository per interval covers both writers of card state.

  Reconciliation is on by default. Disable or tune it with environment variables on the Factory server:

  ```bash
  # Turn Linear reconciliation off entirely.
  MASTRACODE_LINEAR_RECONCILE_ENABLED=false

  # Slow the Linear reconcile sweep down (default: 5 minutes).
  MASTRACODE_LINEAR_RECONCILE_INTERVAL_MS=600000

  # Stop Platform Linear from tailing the event stream; the reconcile sweep still runs.
  MASTRACODE_PLATFORM_LINEAR_POLLING_ENABLED=false

  # GitHub reconciliation uses the same shape.
  MASTRACODE_GITHUB_RECONCILE_ENABLED=false
  MASTRACODE_GITHUB_RECONCILE_INTERVAL_MS=600000
  ```

### Patch Changes

- Fixed workspace re-open hard-failing when a session branch was auto-deleted after merge. `git pull` messages like "no such ref was fetched" and "couldn't find remote ref" are now treated as benign, so materialization keeps the checkout as-is instead of leaving permanent rule-effect alerts on Done items. ([#20910](https://github.com/mastra-ai/mastra/pull/20910))

- Added `dispatcher.maxInFlight` to `MastraFactoryConfig` and the `MASTRACODE_DISPATCH_MAX_IN_FLIGHT` deployment setting to configure the maximum number of concurrent Factory background dispatches per replica. ([#20903](https://github.com/mastra-ai/mastra/pull/20903))

  ```sh
  export MASTRACODE_DISPATCH_MAX_IN_FLIGHT=10
  ```

- Make factory review sessions survive server restarts, dropped connections, and strict git configs. ([#20899](https://github.com/mastra-ai/mastra/pull/20899))

  - Crash-resumed sessions recover their run binding and untrusted-checkout posture from the binding table instead of silently losing the transition tool.
  - Overly long transition rationales are clamped instead of failing the run.
  - Clones and pulls retry when the transfer to github.com drops partway through.
  - Checkouts with `pull.rebase` set no longer fail workspace materialization.

- Improved Factory issue investigations with structured summaries and GitHub triage-label updates. ([#20988](https://github.com/mastra-ai/mastra/pull/20988))

- Hardened the GitHub reconcile worker, the Platform Linear event worker, and the shared issue reconciler: ([#20845](https://github.com/mastra-ai/mastra/pull/20845))

  - Platform Linear Issue events now only dispatch to `(orgId, factoryProjectId)` pairs that already have a persisted work item for the incoming Linear issue. Previously the worker fanned an event out to every Factory project regardless of tenant, which could materialize a triage card in an unrelated org via the default `linearIssueObserved` rule.
  - Reconciler metadata patches no longer spread `undefined` values over stored fields, so a live issue that omits (for example) an author does not clobber the previously recorded value.
  - Documented the event worker's at-most-once delivery contract explicitly: the cursor advances past a failing ingest and drift is caught by the folded reconciler sweep on its own cadence.
  - `GithubReconcileWorker` now renews its lease while a sweep is in flight, so folding the issue sweep into the same tick can no longer let the lease expire and hand off to a replica mid-sweep. A `renewLease` result of `false` or a renewal error is treated as lease loss: the worker aborts before running the folded issue sweep and skips `releaseLease` so the new owner's TTL is not disturbed.
  - The Platform Linear event worker no longer calls `listWorkspaces` in reconcile-only mode, so a workspace-listing outage cannot block the reconcile sweep.
  - The Platform Linear event worker now resolves the project list once per event page rather than once per event, avoiding up to `EVENT_PAGE_SIZE` × N project scans per poll cycle.

- Updated dependencies [[`cdd5c33`](https://github.com/mastra-ai/mastra/commit/cdd5c33ac6c7118a9f139e6dc0e14e6a8ae31658), [`d7cf7fa`](https://github.com/mastra-ai/mastra/commit/d7cf7fafc1ae1b50bd8462dd0e6c671a8606db93), [`0f9a448`](https://github.com/mastra-ai/mastra/commit/0f9a448502157e59f7b76f24360ad497168f5ef8), [`289f4ce`](https://github.com/mastra-ai/mastra/commit/289f4ce16e3293370440172132c52ee787cbc09f), [`4f16ff8`](https://github.com/mastra-ai/mastra/commit/4f16ff824bf2f9b0ddc93f210477c10c8a4fb1ab), [`1c67d85`](https://github.com/mastra-ai/mastra/commit/1c67d85e9da8285662f4dbbf47e0378c3fee0747), [`ba24be6`](https://github.com/mastra-ai/mastra/commit/ba24be662439c331ab23a600041f93803c89eca8), [`842b5fe`](https://github.com/mastra-ai/mastra/commit/842b5fe22b6a7fa811bd14e48eb9af523ac989f2), [`80bdf3a`](https://github.com/mastra-ai/mastra/commit/80bdf3ae16ade6ff63bde0cb16fa2df8ab7dd4dd), [`9ba1247`](https://github.com/mastra-ai/mastra/commit/9ba12470c77f1c03642d720ce67e517e878f666e), [`fd96298`](https://github.com/mastra-ai/mastra/commit/fd96298a8367622f4ebfcaa97b5b6c1fbbd14564), [`6a84954`](https://github.com/mastra-ai/mastra/commit/6a84954a2667f85b6d59da652dab1bbff007ccb0), [`52d8ef0`](https://github.com/mastra-ai/mastra/commit/52d8ef03801f1deb7ee48532fc4190dd4a33916c), [`cdd5c33`](https://github.com/mastra-ai/mastra/commit/cdd5c33ac6c7118a9f139e6dc0e14e6a8ae31658), [`87db0e4`](https://github.com/mastra-ai/mastra/commit/87db0e49a8c04030eb74fff7f051fac330678839), [`efd5c81`](https://github.com/mastra-ai/mastra/commit/efd5c81cc25fde3c2ddd86fc1178deb4ec176e19), [`0976933`](https://github.com/mastra-ai/mastra/commit/0976933142333ec78451feef265b68bcb45aa5e7), [`242b945`](https://github.com/mastra-ai/mastra/commit/242b94558777bfbdeb42cbfea84afff0b6ad0633), [`fea5cae`](https://github.com/mastra-ai/mastra/commit/fea5caedc7e2cfea51784a15e015952692027abf), [`4b59f78`](https://github.com/mastra-ai/mastra/commit/4b59f786cbc9a7d1ef07a07517dbd4b96865e99d), [`7010c5d`](https://github.com/mastra-ai/mastra/commit/7010c5d15728bf9c5dfe4fb6b1bf80ce23bf143a)]:
  - @mastra/core@1.58.0-alpha.3
  - @mastra/code-sdk@1.2.0-alpha.3

## 0.6.0-alpha.2

### Minor Changes

- Added stable identities and display titles for Factory user sessions. ([#20781](https://github.com/mastra-ai/mastra/pull/20781))

  `POST /web/github/projects/:id/sessions` now accepts optional `sessionId` and `title` fields. When `branch` is omitted, the session uses `user/session-<sessionId>`. Callers can create a client-side draft, safely retry the first server request with the same UUID, and show the first prompt as a human-readable title. If `sessionId` is omitted, the server generates one. Explicit branches still work unchanged.

  ```ts
  const sessionId = crypto.randomUUID();
  const response = await fetch(`/web/github/projects/${projectRepositoryId}/sessions`, {
    method: 'POST',
    body: JSON.stringify({ sessionId, title: 'Fix the login flow' }),
  });
  ```

  Titles collapse whitespace, trim surrounding space, and are limited to 80 characters. Blank titles are stored as `null`.

### Patch Changes

- Work board cards now follow their GitHub issue when it closes: closing an issue moves its card to Done (or to Canceled when the issue was closed as `not_planned` or `duplicate`), and a card whose issue closed while the deployment was unreachable is caught up automatically by the periodic reconcile sweep. Previously these cards stayed on the board until moved by hand. ([#20895](https://github.com/mastra-ai/mastra/pull/20895))

- Updated dependencies [[`b4c89b4`](https://github.com/mastra-ai/mastra/commit/b4c89b4371b0c86da57403ad1a3b3ef0681f3128), [`e44e8f3`](https://github.com/mastra-ai/mastra/commit/e44e8f370b66c339ddcaba946d33da6d3c3f06cd), [`c967a5e`](https://github.com/mastra-ai/mastra/commit/c967a5eec150c5dc5418c4a4388982d1fb7ad27c), [`f53d5bd`](https://github.com/mastra-ai/mastra/commit/f53d5bd4885b29e4ac29a428a6044088ea8d6aa3), [`bda2235`](https://github.com/mastra-ai/mastra/commit/bda22353ee28f2df0eaea555f7cae1549f979c0b), [`a7eb4a1`](https://github.com/mastra-ai/mastra/commit/a7eb4a11450f6170274ed5141bffe821d4fdd5a6), [`2f9ef3f`](https://github.com/mastra-ai/mastra/commit/2f9ef3f4ca06fc2dcdd5088c26b7f4da6a016791), [`e7eefcb`](https://github.com/mastra-ai/mastra/commit/e7eefcb162cda7c493e8c3bf43050ead0efbcb2c), [`4d7aca2`](https://github.com/mastra-ai/mastra/commit/4d7aca2fe75f225c83d1502d63079568e6ec163f), [`c4ec889`](https://github.com/mastra-ai/mastra/commit/c4ec889561c0264c43f66d04d587bee4ce35e792), [`9be8878`](https://github.com/mastra-ai/mastra/commit/9be8878dcf0388e84fc4873e0eec27bd49b881a4)]:
  - @mastra/core@1.58.0-alpha.2
  - @mastra/code-sdk@1.2.0-alpha.2

## 0.6.0-alpha.1

### Minor Changes

- Added creator and recent worker attribution to Factory board cards, with names and profile images from GitHub and Linear. GitHub pull request cards now show the author and draft, open, closed, or merged status. ([#20822](https://github.com/mastra-ai/mastra/pull/20822))

- Added searchable, resettable teammate and relevance filters to Factory work and review boards. Filter state can be shared by URL, and matching covers GitHub and Linear authors, assignees, activity, and requested reviewers. ([#20841](https://github.com/mastra-ai/mastra/pull/20841))

  Example shareable URL: `/factory/projects/<id>/board?teammate=github:octocat&relevance=authored,assigned`.

- The Factory now re-reviews a pull request when review is re-requested from its GitHub bot. After any Factory verdict (approve or request changes), clicking GitHub's re-request review button on the Factory reviewer moves the Review card back into Reviewing and starts a fresh review pass. Only trusted collaborators (write or admin) can trigger it, and re-requests aimed at human reviewers or on closed, merged, or already-in-review pull requests are ignored. ([#20830](https://github.com/mastra-ai/mastra/pull/20830))

### Patch Changes

- Fixed Linear issue investigations using inconsistent metadata, failing to start, or resolving a stale work item binding after the same session was rebound. ([#20810](https://github.com/mastra-ai/mastra/pull/20810))

- Fixed autonomous GitHub factory-rule runs ignoring the factory's configured default model. ([#20827](https://github.com/mastra-ai/mastra/pull/20827))

  A run triggered by a factory rule started on the built-in default model rather than the model configured on the factory project, so a factory set up for a provider other than the built-in default failed the run outright with a missing-credentials error. Runs started from the board were unaffected, which is why this only appeared on autonomous runs. Rule-triggered runs now start on the project's configured model, matching runs started from the board.

- Return from deleting a workspace as soon as its session is gone instead of holding the request open while the sandbox is reclaimed. Waking the VM and scrubbing its checkout took minutes on a large repository, so the UI appeared to hang long after the workspace had been removed. The scrub and pool release now run in the background; because a sandbox only becomes claimable once it is published to the reuse pool, the next session still gets a clean checkout. ([#20785](https://github.com/mastra-ai/mastra/pull/20785))

- Fixed Slack sessions ignoring the factory's configured default model and memory settings. ([#20832](https://github.com/mastra-ai/mastra/pull/20832))

  Sessions started from Slack ran on the built-in default model rather than the model configured on the factory project, so a factory set up for a provider other than the built-in default failed every Slack message with a missing-credentials error. Repo-backed Slack threads now start on the project's configured model and observational-memory settings, matching runs started from the web.

  A thread keeps a model chosen inside it. Once a model is set on the thread, restarting the server no longer resets it to the project default.

- Preserved every GitHub issue assignee end-to-end so Factory boards no longer drop co-assignees, and backfilled missing assignee and reviewer metadata so the pull request reconciler stops re-fetching cards on every sweep. ([#20841](https://github.com/mastra-ai/mastra/pull/20841))

- Updated dependencies [[`e7109ee`](https://github.com/mastra-ai/mastra/commit/e7109ee6f731bacc79c885906f3c7dca8d8f013a), [`ae0e985`](https://github.com/mastra-ai/mastra/commit/ae0e985e8f1186a8ecfcf0de6dd36ac12ef85324), [`e7109ee`](https://github.com/mastra-ai/mastra/commit/e7109ee6f731bacc79c885906f3c7dca8d8f013a), [`772c0c8`](https://github.com/mastra-ai/mastra/commit/772c0c897cec383258de2e6178147f8014767c7b), [`578bf2e`](https://github.com/mastra-ai/mastra/commit/578bf2e6a88e9d5b8bf502204e15a95dfbb679ae), [`06b2d87`](https://github.com/mastra-ai/mastra/commit/06b2d87e63bcdd0ed59215c6789692b9b12de376), [`ac01d63`](https://github.com/mastra-ai/mastra/commit/ac01d6355974aec73fdb8781449ed12bac582094), [`a810a05`](https://github.com/mastra-ai/mastra/commit/a810a058f62ad407cfc1701e0be36ae91145d7cf), [`f8da216`](https://github.com/mastra-ai/mastra/commit/f8da21633e7eb0e31c9ce0fc30567870d19416d3), [`6104347`](https://github.com/mastra-ai/mastra/commit/61043473ba6bfd0a25156824e853e13165562e6c), [`0ce1d05`](https://github.com/mastra-ai/mastra/commit/0ce1d054586c5d348543d2749067b40adbc9b783), [`6698e16`](https://github.com/mastra-ai/mastra/commit/6698e168d74e054fc3efa97b19025fb2d1dafc45), [`45bfb88`](https://github.com/mastra-ai/mastra/commit/45bfb88fd52f1dd3be20e2a38905777c96499c90), [`e3b9307`](https://github.com/mastra-ai/mastra/commit/e3b9307098daefbfae2a52ae2ef51bc9fc701190), [`d6834c5`](https://github.com/mastra-ai/mastra/commit/d6834c5a7866b16734d23900163c2414ed70d791), [`c52d346`](https://github.com/mastra-ai/mastra/commit/c52d3462ec831a5d95926ecd3d3373f5928ad2e5), [`0023e79`](https://github.com/mastra-ai/mastra/commit/0023e7919431078280abd11c89d1edeae35fcc69), [`c2ad51e`](https://github.com/mastra-ai/mastra/commit/c2ad51e2467f901eecba8c9f4a45e22a50bd7c18), [`3dc97ea`](https://github.com/mastra-ai/mastra/commit/3dc97ea415fad353b48a13095fad1835933cc12a), [`3d01cd3`](https://github.com/mastra-ai/mastra/commit/3d01cd387321b6f9c5cac31d487c84bf51b19c78), [`7bf3086`](https://github.com/mastra-ai/mastra/commit/7bf308663f0115ca74ad20554ade740f06640859), [`a8dd139`](https://github.com/mastra-ai/mastra/commit/a8dd1391a9fe9a6632c25809ef236980afa9a020), [`e5786be`](https://github.com/mastra-ai/mastra/commit/e5786be02bb903073082bd9d6da880ebaacc343f), [`2093fbd`](https://github.com/mastra-ai/mastra/commit/2093fbd53bb744bae19ec89f6d73db9a66fbe8a7), [`e7a5da4`](https://github.com/mastra-ai/mastra/commit/e7a5da4ef8e4dd452d2f232961b4e682a85ffe43), [`7b4393d`](https://github.com/mastra-ai/mastra/commit/7b4393d557411fdcf07b0e30e5acaf7cc85154ae)]:
  - @mastra/code-sdk@1.2.0-alpha.1
  - @mastra/core@1.58.0-alpha.1

## 0.5.1-alpha.0

### Patch Changes

- Updated dependencies [[`45a9147`](https://github.com/mastra-ai/mastra/commit/45a914741f578754d79d8b7de7b4e4f304d8e14a), [`990611b`](https://github.com/mastra-ai/mastra/commit/990611ba76eb876d86c9c594371ae5f02f94b432), [`ed5d606`](https://github.com/mastra-ai/mastra/commit/ed5d606739c5e3fbdfa9f272df7809aa5ab43b1d)]:
  - @mastra/core@1.58.0-alpha.0
  - @mastra/code-sdk@1.1.4-alpha.0

## 0.5.0

### Minor Changes

- Added a built-in Slack integration, so every factory and create-factory deployment can offer Slack channels without vendoring the integration itself. Register it alongside the built-in GitHub and Linear integrations: ([#20507](https://github.com/mastra-ai/mastra/pull/20507))

  ```ts
  import { SlackIntegration } from '@mastra/factory/integrations/slack/integration';

  new MastraFactory({
    integrations: [new SlackIntegration({ signingSecret, botToken, clientId, clientSecret })],
  });
  ```

  Slack-started sessions are repo-backed automatically: the factory exposes its source-control owner on `IntegrationContext` (`ctx.storage.sourceControlOwner`) and the integration wires itself up from there.

  Two related changes come with it. `FactoryIntegration.channels()` now returns a config object (`FactoryChannelsConfig`) instead of a built `AgentControllerChannels` instance, and the factory constructs the instance at the attach site. And when no Slack integration is registered, the factory answers `GET /web/channel-accounts` with `{ accounts: [], canConnect: false, reason: 'not_registered' }`, so the Connections UI can say Slack is not set up instead of telling you to set environment variables that would not enable it.

### Patch Changes

- Fixed Factory sessions that stopped responding after a server restart. GitHub webhook deliveries now restore the saved session owner when they rebuild a session, so the delivery goes through and the session picks up where it left off. ([#20698](https://github.com/mastra-ai/mastra/pull/20698))

- Updated dependencies [[`8d2399b`](https://github.com/mastra-ai/mastra/commit/8d2399b638f8e0945cf2cda0187dbea8dcf0b784), [`8d2399b`](https://github.com/mastra-ai/mastra/commit/8d2399b638f8e0945cf2cda0187dbea8dcf0b784), [`c8002da`](https://github.com/mastra-ai/mastra/commit/c8002da7775c468e2965b6ff5f82045450fa8cb9), [`92be47f`](https://github.com/mastra-ai/mastra/commit/92be47fbd26ffccec0e2131ef7c1d9e70dd5ef4a), [`89200ba`](https://github.com/mastra-ai/mastra/commit/89200bafa05444bb7949b363ce7b743e29867561), [`c950138`](https://github.com/mastra-ai/mastra/commit/c950138e72e4f317a40187e3800588731ab790ce), [`810c7e7`](https://github.com/mastra-ai/mastra/commit/810c7e74929989d8b8b5db52cd3af22cd0998af4), [`063c8b2`](https://github.com/mastra-ai/mastra/commit/063c8b2eb14e4e5ca021779bc33e8c3c031c8604), [`f9f9884`](https://github.com/mastra-ai/mastra/commit/f9f98848ee194dc71a787a709ec430b065cdc41b), [`e0904dc`](https://github.com/mastra-ai/mastra/commit/e0904dc538792e54e1806b70172e5900ac49bff4), [`9672fab`](https://github.com/mastra-ai/mastra/commit/9672fabfbcadb961a35c22a2d6722e077f7b24b9), [`f4e964c`](https://github.com/mastra-ai/mastra/commit/f4e964cad57057301d6bed5c55bcdd730175b941), [`1f7bbd7`](https://github.com/mastra-ai/mastra/commit/1f7bbd7785a8d230aad02454ecabeb4a0b2cc96f), [`e47ff36`](https://github.com/mastra-ai/mastra/commit/e47ff36945720f4ee4caa09f6e83514d7d188608), [`64d6781`](https://github.com/mastra-ai/mastra/commit/64d67814bccddd314f7e09643243821e57cb87b6), [`fb9a6ac`](https://github.com/mastra-ai/mastra/commit/fb9a6ac11c9560518742ece60b49d6b062845fd3), [`aa2cec8`](https://github.com/mastra-ai/mastra/commit/aa2cec8501f634d51c2f3ebfb3dd3aa7af8d2ca2), [`c848e65`](https://github.com/mastra-ai/mastra/commit/c848e655a64ff10331a8ceafafe7f18e70a0f092), [`2adf8eb`](https://github.com/mastra-ai/mastra/commit/2adf8eb4a70ed2b6cff2dd39281496ea0e025fac), [`0494489`](https://github.com/mastra-ai/mastra/commit/049448906e4c3d2d615bbe865b073a0d890ddb7c), [`8d1aeb8`](https://github.com/mastra-ai/mastra/commit/8d1aeb8acf7c20c4bb8e4d8e4bdc6569c83ac561), [`8264611`](https://github.com/mastra-ai/mastra/commit/8264611510e421b818bc7395dc2ae4d9c2d518b2), [`d8fa243`](https://github.com/mastra-ai/mastra/commit/d8fa2430d21113e330c4e676ac65e1235cf44f81), [`44fc98b`](https://github.com/mastra-ai/mastra/commit/44fc98b9d1242aa87a3ab44bdce9e9f12c44d8c9), [`f933ba3`](https://github.com/mastra-ai/mastra/commit/f933ba32700e1d0bf143311c1a08f88300b840b6), [`83065bf`](https://github.com/mastra-ai/mastra/commit/83065bfee9e47c3c6f09132a9034501f6cfb69cf), [`0f2ef41`](https://github.com/mastra-ai/mastra/commit/0f2ef4118da022e4f30dac4e9856cc3a8c97671c), [`01b162f`](https://github.com/mastra-ai/mastra/commit/01b162fe435295881aa7ea55f1759407ad5175ad)]:
  - @mastra/code-sdk@1.1.3
  - @mastra/core@1.57.0

## 0.5.0-alpha.2

### Patch Changes

- Updated dependencies [[`810c7e7`](https://github.com/mastra-ai/mastra/commit/810c7e74929989d8b8b5db52cd3af22cd0998af4), [`f9f9884`](https://github.com/mastra-ai/mastra/commit/f9f98848ee194dc71a787a709ec430b065cdc41b), [`e0904dc`](https://github.com/mastra-ai/mastra/commit/e0904dc538792e54e1806b70172e5900ac49bff4), [`64d6781`](https://github.com/mastra-ai/mastra/commit/64d67814bccddd314f7e09643243821e57cb87b6), [`c848e65`](https://github.com/mastra-ai/mastra/commit/c848e655a64ff10331a8ceafafe7f18e70a0f092), [`0494489`](https://github.com/mastra-ai/mastra/commit/049448906e4c3d2d615bbe865b073a0d890ddb7c), [`8d1aeb8`](https://github.com/mastra-ai/mastra/commit/8d1aeb8acf7c20c4bb8e4d8e4bdc6569c83ac561), [`83065bf`](https://github.com/mastra-ai/mastra/commit/83065bfee9e47c3c6f09132a9034501f6cfb69cf), [`01b162f`](https://github.com/mastra-ai/mastra/commit/01b162fe435295881aa7ea55f1759407ad5175ad)]:
  - @mastra/core@1.57.0-alpha.2
  - @mastra/code-sdk@1.1.3-alpha.2

## 0.5.0-alpha.1

### Minor Changes

- Added a built-in Slack integration, so every factory and create-factory deployment can offer Slack channels without vendoring the integration itself. Register it alongside the built-in GitHub and Linear integrations: ([#20507](https://github.com/mastra-ai/mastra/pull/20507))

  ```ts
  import { SlackIntegration } from '@mastra/factory/integrations/slack/integration';

  new MastraFactory({
    integrations: [new SlackIntegration({ signingSecret, botToken, clientId, clientSecret })],
  });
  ```

  Slack-started sessions are repo-backed automatically: the factory exposes its source-control owner on `IntegrationContext` (`ctx.storage.sourceControlOwner`) and the integration wires itself up from there.

  Two related changes come with it. `FactoryIntegration.channels()` now returns a config object (`FactoryChannelsConfig`) instead of a built `AgentControllerChannels` instance, and the factory constructs the instance at the attach site. And when no Slack integration is registered, the factory answers `GET /web/channel-accounts` with `{ accounts: [], canConnect: false, reason: 'not_registered' }`, so the Connections UI can say Slack is not set up instead of telling you to set environment variables that would not enable it.

### Patch Changes

- Fixed Factory sessions that stopped responding after a server restart. GitHub webhook deliveries now restore the saved session owner when they rebuild a session, so the delivery goes through and the session picks up where it left off. ([#20698](https://github.com/mastra-ai/mastra/pull/20698))

- Updated dependencies [[`89200ba`](https://github.com/mastra-ai/mastra/commit/89200bafa05444bb7949b363ce7b743e29867561), [`c950138`](https://github.com/mastra-ai/mastra/commit/c950138e72e4f317a40187e3800588731ab790ce), [`063c8b2`](https://github.com/mastra-ai/mastra/commit/063c8b2eb14e4e5ca021779bc33e8c3c031c8604), [`f4e964c`](https://github.com/mastra-ai/mastra/commit/f4e964cad57057301d6bed5c55bcdd730175b941), [`1f7bbd7`](https://github.com/mastra-ai/mastra/commit/1f7bbd7785a8d230aad02454ecabeb4a0b2cc96f), [`e47ff36`](https://github.com/mastra-ai/mastra/commit/e47ff36945720f4ee4caa09f6e83514d7d188608), [`fb9a6ac`](https://github.com/mastra-ai/mastra/commit/fb9a6ac11c9560518742ece60b49d6b062845fd3), [`aa2cec8`](https://github.com/mastra-ai/mastra/commit/aa2cec8501f634d51c2f3ebfb3dd3aa7af8d2ca2), [`2adf8eb`](https://github.com/mastra-ai/mastra/commit/2adf8eb4a70ed2b6cff2dd39281496ea0e025fac), [`8264611`](https://github.com/mastra-ai/mastra/commit/8264611510e421b818bc7395dc2ae4d9c2d518b2), [`44fc98b`](https://github.com/mastra-ai/mastra/commit/44fc98b9d1242aa87a3ab44bdce9e9f12c44d8c9), [`0f2ef41`](https://github.com/mastra-ai/mastra/commit/0f2ef4118da022e4f30dac4e9856cc3a8c97671c)]:
  - @mastra/core@1.57.0-alpha.1
  - @mastra/code-sdk@1.1.3-alpha.1

## 0.4.1-alpha.0

### Patch Changes

- Updated dependencies [[`c8002da`](https://github.com/mastra-ai/mastra/commit/c8002da7775c468e2965b6ff5f82045450fa8cb9)]:
  - @mastra/core@1.56.1-alpha.0
  - @mastra/code-sdk@1.1.3-alpha.0

## 0.4.0

### Minor Changes

- Added a lightweight pending changes viewer with per-file line counts for Factory session workspaces and improved chat composer readability. ([#20418](https://github.com/mastra-ai/mastra/pull/20418))

### Patch Changes

- Self-hosted GitHub deployments now detect merged pull requests. ([#20361](https://github.com/mastra-ai/mastra/pull/20361))

  Merge state previously reached the factory only through GitHub webhooks. A deployment GitHub cannot reach — local development, or any server behind a private network — never received one, so its pull request cards stayed `open` forever and merge rules never fired.

  A background sweep now reads live pull request state for the cards that are still open and replays missed merges through the normal rules ingress, which dedupes them against the webhook path. Webhooks remain the fast path; this is the safety net that was already running on platform-backed deployments.

  The sweep runs every 5 minutes, is scoped to repositories linked to a factory project, and coordinates across replicas so only one sweeps at a time.

  It also retires the thread's pull request subscription, which the webhook handler was previously the only thing to do. That is what the PR chip in a thread and the workspace sidebar row read, so on both self-hosted and platform deployments they now show merged or closed instead of staying open indefinitely.

  **Configuration**

  ```bash
  MASTRACODE_GITHUB_RECONCILE_ENABLED=false   # opt out entirely
  MASTRACODE_GITHUB_RECONCILE_INTERVAL_MS=60000  # change the cadence
  ```

- Improved Factory triage so editing a linked GitHub issue or creating, editing, or deleting a human comment re-runs investigation and refreshes the existing handoff comment. ([#20516](https://github.com/mastra-ai/mastra/pull/20516))

- Factory work item transitions now require explicit approval before execution. ([#20622](https://github.com/mastra-ai/mastra/pull/20622))

- Fixed Factory rule dispatches so concurrent skill wakeups stay bounded until their agent runs finish or terminal observation times out. ([#20623](https://github.com/mastra-ai/mastra/pull/20623))

- Improved Factory pull-request reviews by requiring comparison with analogous codebase patterns. ([#20524](https://github.com/mastra-ai/mastra/pull/20524))

- Fixed the Factory getting stuck after a GitHub App is uninstalled and reinstalled. ([#20481](https://github.com/mastra-ai/mastra/pull/20481))

  GitHub assigns a new installation ID on reinstall, which left every token request failing against the old one — recovering it needed a manual database edit. The Factory already knew how to repoint a repository at the replacement installation, but only triggered that recovery when the platform reported the old installation as missing (404). A suspended or soft-deleted installation reports as a conflict (409) instead, so the recovery never ran. It now covers both.

  A failed token mint that could equally be a transient GitHub outage (502) still surfaces as an error rather than repointing the repository, so a passing incident never migrates a healthy repository.

- Fixed GitHub issue intake pagination when platform responses contain fewer issues after filtering pull requests. ([#20637](https://github.com/mastra-ai/mastra/pull/20637))

- Fixed factory sessions inheriting the personal agent instructions of the machine hosting them. ([#20633](https://github.com/mastra-ai/mastra/pull/20633))

  A factory should behave the same wherever it runs. It did not: alongside the repository's AGENTS.md and the skill it was started with, every session also loaded the instruction files sitting in the home directory of whatever machine hosted the factory (`~/.claude/CLAUDE.md`, `~/.mastracode/AGENTS.md`, and the other supported home directory locations). Those files are the operator's personal preferences, so the same review rule produced a differently written review depending on who was running the factory, and nothing in the session showed why.

  Factory sessions now read only the repository's instructions (served from the pull request's base branch when the checkout is untrusted) and the skill. This applies to every session the factory creates: work items it picks up on its own, sessions a GitHub webhook resumes, and the ones you open yourself in the factory UI.

  If you were relying on a home directory file to steer factory output, move those instructions into the repository's AGENTS.md.

- Updated Factory triage to keep new features in Intake until manually advanced. ([#20624](https://github.com/mastra-ai/mastra/pull/20624))

- Updated dependencies [[`4844167`](https://github.com/mastra-ai/mastra/commit/4844167cff2d5ec5004e94edd34970833040fa3f), [`c5e56ff`](https://github.com/mastra-ai/mastra/commit/c5e56ff3bcabdf062708f2d48744fec304df6792), [`594f7b2`](https://github.com/mastra-ai/mastra/commit/594f7b28f5263fb9982fd50d95c471fb971ea984), [`7f4e26d`](https://github.com/mastra-ai/mastra/commit/7f4e26dd57bd9b23c278ea21235ab823a3810a6c), [`311f943`](https://github.com/mastra-ai/mastra/commit/311f943bee60e8fdf5c84499ea50e884276c936c), [`322daa6`](https://github.com/mastra-ai/mastra/commit/322daa6d90552909204044790d850958f6745fed), [`db4e6ff`](https://github.com/mastra-ai/mastra/commit/db4e6ff744503112eb64deeaf6c2b54bf26a54c7), [`5faf93f`](https://github.com/mastra-ai/mastra/commit/5faf93f03e19daea394b9e2a923f2e4f833407f2), [`82201f7`](https://github.com/mastra-ai/mastra/commit/82201f75fae8e050a8de2df08b74875ee74c6b83), [`cadaa13`](https://github.com/mastra-ai/mastra/commit/cadaa1372e1077c8e85eb64c5499ba8803caa323), [`0c89896`](https://github.com/mastra-ai/mastra/commit/0c8989673fb7d106837098398131e570c6023b68), [`6d19a65`](https://github.com/mastra-ai/mastra/commit/6d19a6517f5da3911023d446b7e2d5dad8adb1cb), [`23b4238`](https://github.com/mastra-ai/mastra/commit/23b423844ad0bcf2a502a68dd62866d6160f9f6d), [`80ad891`](https://github.com/mastra-ai/mastra/commit/80ad891f8cd10379aa5b5af7510c763783b2ab56), [`fb18da5`](https://github.com/mastra-ai/mastra/commit/fb18da56fc35689ae370621a8f10b5b0d8606e20), [`d01cac8`](https://github.com/mastra-ai/mastra/commit/d01cac87ef674ae6cdd354e15d39525ff9599170), [`fb18da5`](https://github.com/mastra-ai/mastra/commit/fb18da56fc35689ae370621a8f10b5b0d8606e20), [`e320a76`](https://github.com/mastra-ai/mastra/commit/e320a763feaf65c6be3cebecf746defcbde161b3), [`03b4918`](https://github.com/mastra-ai/mastra/commit/03b4918c80d188ce375334c393e131c6e94bd7eb), [`14ef73a`](https://github.com/mastra-ai/mastra/commit/14ef73a4bbd73e7808414816eb0628ce1d80b5d7), [`b582f7f`](https://github.com/mastra-ai/mastra/commit/b582f7fa2f9c1f87d19efc63d344fbe5dda2608c), [`0a6598b`](https://github.com/mastra-ai/mastra/commit/0a6598bde80bde008986ad6616bed9632b9294cb), [`06000d7`](https://github.com/mastra-ai/mastra/commit/06000d73712911572e913b8a83339270296d0a22), [`1d677d5`](https://github.com/mastra-ai/mastra/commit/1d677d5f99d7db403f7828585e8c25f299f72628), [`9e1dad8`](https://github.com/mastra-ai/mastra/commit/9e1dad8f7b1cab2bb7ade90e5b7561f24577b88a), [`2f43145`](https://github.com/mastra-ai/mastra/commit/2f4314504c03cbba280414ac81ba3197448ee6b0), [`4e35a56`](https://github.com/mastra-ai/mastra/commit/4e35a56cdf8d74a5ff6d5eda01f2c1deaf6cc7be), [`d94b8e1`](https://github.com/mastra-ai/mastra/commit/d94b8e1cee67416d518a8c30099040061bef6a1c), [`93e28ec`](https://github.com/mastra-ai/mastra/commit/93e28ecce9031c02397e0ae8406593e5c7a95883), [`729dab4`](https://github.com/mastra-ai/mastra/commit/729dab408faccfaef0cbb048e5a4338f9172847e), [`484003d`](https://github.com/mastra-ai/mastra/commit/484003d33ff59330c86b19863e4a38732d7e4155), [`3de0188`](https://github.com/mastra-ai/mastra/commit/3de0188bfaf9a9c09c95fe322b53838cf52c70b6), [`34d34d8`](https://github.com/mastra-ai/mastra/commit/34d34d8c811df512fef4dd5459f79b7821be1866), [`b582f7f`](https://github.com/mastra-ai/mastra/commit/b582f7fa2f9c1f87d19efc63d344fbe5dda2608c), [`933d291`](https://github.com/mastra-ai/mastra/commit/933d291146b789c19442ad206f94da3e4be90c64), [`a1cb98d`](https://github.com/mastra-ai/mastra/commit/a1cb98d11990b560b98482292a1f34aa1a2d9092), [`598ad82`](https://github.com/mastra-ai/mastra/commit/598ad82d41c41389a686338a1d0e50b7400e1938), [`1fd6aad`](https://github.com/mastra-ai/mastra/commit/1fd6aad1ea4a9d32f65efa832307c35e981a4c0a)]:
  - @mastra/core@1.56.0
  - @mastra/code-sdk@1.1.2

## 0.4.0-alpha.7

### Patch Changes

- Updated dependencies [[`d94b8e1`](https://github.com/mastra-ai/mastra/commit/d94b8e1cee67416d518a8c30099040061bef6a1c)]:
  - @mastra/core@1.56.0-alpha.7
  - @mastra/code-sdk@1.1.2-alpha.7

## 0.4.0-alpha.6

### Patch Changes

- Self-hosted GitHub deployments now detect merged pull requests. ([#20361](https://github.com/mastra-ai/mastra/pull/20361))

  Merge state previously reached the factory only through GitHub webhooks. A deployment GitHub cannot reach — local development, or any server behind a private network — never received one, so its pull request cards stayed `open` forever and merge rules never fired.

  A background sweep now reads live pull request state for the cards that are still open and replays missed merges through the normal rules ingress, which dedupes them against the webhook path. Webhooks remain the fast path; this is the safety net that was already running on platform-backed deployments.

  The sweep runs every 5 minutes, is scoped to repositories linked to a factory project, and coordinates across replicas so only one sweeps at a time.

  It also retires the thread's pull request subscription, which the webhook handler was previously the only thing to do. That is what the PR chip in a thread and the workspace sidebar row read, so on both self-hosted and platform deployments they now show merged or closed instead of staying open indefinitely.

  **Configuration**

  ```bash
  MASTRACODE_GITHUB_RECONCILE_ENABLED=false   # opt out entirely
  MASTRACODE_GITHUB_RECONCILE_INTERVAL_MS=60000  # change the cadence
  ```

- Improved Factory triage so editing a linked GitHub issue or creating, editing, or deleting a human comment re-runs investigation and refreshes the existing handoff comment. ([#20516](https://github.com/mastra-ai/mastra/pull/20516))

- Factory work item transitions now require explicit approval before execution. ([#20622](https://github.com/mastra-ai/mastra/pull/20622))

- Fixed Factory rule dispatches so concurrent skill wakeups stay bounded until their agent runs finish or terminal observation times out. ([#20623](https://github.com/mastra-ai/mastra/pull/20623))

- Improved Factory pull-request reviews by requiring comparison with analogous codebase patterns. ([#20524](https://github.com/mastra-ai/mastra/pull/20524))

- Fixed GitHub issue intake pagination when platform responses contain fewer issues after filtering pull requests. ([#20637](https://github.com/mastra-ai/mastra/pull/20637))

- Fixed factory sessions inheriting the personal agent instructions of the machine hosting them. ([#20633](https://github.com/mastra-ai/mastra/pull/20633))

  A factory should behave the same wherever it runs. It did not: alongside the repository's AGENTS.md and the skill it was started with, every session also loaded the instruction files sitting in the home directory of whatever machine hosted the factory (`~/.claude/CLAUDE.md`, `~/.mastracode/AGENTS.md`, and the other supported home directory locations). Those files are the operator's personal preferences, so the same review rule produced a differently written review depending on who was running the factory, and nothing in the session showed why.

  Factory sessions now read only the repository's instructions (served from the pull request's base branch when the checkout is untrusted) and the skill. This applies to every session the factory creates: work items it picks up on its own, sessions a GitHub webhook resumes, and the ones you open yourself in the factory UI.

  If you were relying on a home directory file to steer factory output, move those instructions into the repository's AGENTS.md.

- Updated Factory triage to keep new features in Intake until manually advanced. ([#20624](https://github.com/mastra-ai/mastra/pull/20624))

- Updated dependencies [[`82201f7`](https://github.com/mastra-ai/mastra/commit/82201f75fae8e050a8de2df08b74875ee74c6b83), [`fb18da5`](https://github.com/mastra-ai/mastra/commit/fb18da56fc35689ae370621a8f10b5b0d8606e20), [`d01cac8`](https://github.com/mastra-ai/mastra/commit/d01cac87ef674ae6cdd354e15d39525ff9599170), [`fb18da5`](https://github.com/mastra-ai/mastra/commit/fb18da56fc35689ae370621a8f10b5b0d8606e20), [`0a6598b`](https://github.com/mastra-ai/mastra/commit/0a6598bde80bde008986ad6616bed9632b9294cb), [`9e1dad8`](https://github.com/mastra-ai/mastra/commit/9e1dad8f7b1cab2bb7ade90e5b7561f24577b88a), [`2f43145`](https://github.com/mastra-ai/mastra/commit/2f4314504c03cbba280414ac81ba3197448ee6b0), [`34d34d8`](https://github.com/mastra-ai/mastra/commit/34d34d8c811df512fef4dd5459f79b7821be1866)]:
  - @mastra/core@1.56.0-alpha.6
  - @mastra/code-sdk@1.1.2-alpha.6

## 0.4.0-alpha.5

### Patch Changes

- Updated dependencies [[`db4e6ff`](https://github.com/mastra-ai/mastra/commit/db4e6ff744503112eb64deeaf6c2b54bf26a54c7), [`6d19a65`](https://github.com/mastra-ai/mastra/commit/6d19a6517f5da3911023d446b7e2d5dad8adb1cb)]:
  - @mastra/core@1.56.0-alpha.5
  - @mastra/code-sdk@1.1.2-alpha.5

## 0.4.0-alpha.4

### Patch Changes

- Updated dependencies [[`4844167`](https://github.com/mastra-ai/mastra/commit/4844167cff2d5ec5004e94edd34970833040fa3f), [`5faf93f`](https://github.com/mastra-ai/mastra/commit/5faf93f03e19daea394b9e2a923f2e4f833407f2), [`80ad891`](https://github.com/mastra-ai/mastra/commit/80ad891f8cd10379aa5b5af7510c763783b2ab56), [`a1cb98d`](https://github.com/mastra-ai/mastra/commit/a1cb98d11990b560b98482292a1f34aa1a2d9092), [`598ad82`](https://github.com/mastra-ai/mastra/commit/598ad82d41c41389a686338a1d0e50b7400e1938), [`1fd6aad`](https://github.com/mastra-ai/mastra/commit/1fd6aad1ea4a9d32f65efa832307c35e981a4c0a)]:
  - @mastra/core@1.56.0-alpha.4
  - @mastra/code-sdk@1.1.2-alpha.4

## 0.4.0-alpha.3

### Patch Changes

- Fixed the Factory getting stuck after a GitHub App is uninstalled and reinstalled. ([#20481](https://github.com/mastra-ai/mastra/pull/20481))

  GitHub assigns a new installation ID on reinstall, which left every token request failing against the old one — recovering it needed a manual database edit. The Factory already knew how to repoint a repository at the replacement installation, but only triggered that recovery when the platform reported the old installation as missing (404). A suspended or soft-deleted installation reports as a conflict (409) instead, so the recovery never ran. It now covers both.

  A failed token mint that could equally be a transient GitHub outage (502) still surfaces as an error rather than repointing the repository, so a passing incident never migrates a healthy repository.

- Updated dependencies [[`594f7b2`](https://github.com/mastra-ai/mastra/commit/594f7b28f5263fb9982fd50d95c471fb971ea984), [`311f943`](https://github.com/mastra-ai/mastra/commit/311f943bee60e8fdf5c84499ea50e884276c936c), [`0c89896`](https://github.com/mastra-ai/mastra/commit/0c8989673fb7d106837098398131e570c6023b68), [`23b4238`](https://github.com/mastra-ai/mastra/commit/23b423844ad0bcf2a502a68dd62866d6160f9f6d), [`e320a76`](https://github.com/mastra-ai/mastra/commit/e320a763feaf65c6be3cebecf746defcbde161b3), [`03b4918`](https://github.com/mastra-ai/mastra/commit/03b4918c80d188ce375334c393e131c6e94bd7eb), [`14ef73a`](https://github.com/mastra-ai/mastra/commit/14ef73a4bbd73e7808414816eb0628ce1d80b5d7), [`1d677d5`](https://github.com/mastra-ai/mastra/commit/1d677d5f99d7db403f7828585e8c25f299f72628), [`93e28ec`](https://github.com/mastra-ai/mastra/commit/93e28ecce9031c02397e0ae8406593e5c7a95883), [`729dab4`](https://github.com/mastra-ai/mastra/commit/729dab408faccfaef0cbb048e5a4338f9172847e), [`484003d`](https://github.com/mastra-ai/mastra/commit/484003d33ff59330c86b19863e4a38732d7e4155), [`933d291`](https://github.com/mastra-ai/mastra/commit/933d291146b789c19442ad206f94da3e4be90c64)]:
  - @mastra/core@1.56.0-alpha.3
  - @mastra/code-sdk@1.1.2-alpha.3

## 0.4.0-alpha.2

### Patch Changes

- Updated dependencies [[`322daa6`](https://github.com/mastra-ai/mastra/commit/322daa6d90552909204044790d850958f6745fed), [`cadaa13`](https://github.com/mastra-ai/mastra/commit/cadaa1372e1077c8e85eb64c5499ba8803caa323), [`06000d7`](https://github.com/mastra-ai/mastra/commit/06000d73712911572e913b8a83339270296d0a22), [`3de0188`](https://github.com/mastra-ai/mastra/commit/3de0188bfaf9a9c09c95fe322b53838cf52c70b6)]:
  - @mastra/core@1.56.0-alpha.2
  - @mastra/code-sdk@1.1.2-alpha.2

## 0.4.0-alpha.1

### Minor Changes

- Added a lightweight pending changes viewer with per-file line counts for Factory session workspaces and improved chat composer readability. ([#20418](https://github.com/mastra-ai/mastra/pull/20418))

### Patch Changes

- Updated dependencies [[`c5e56ff`](https://github.com/mastra-ai/mastra/commit/c5e56ff3bcabdf062708f2d48744fec304df6792), [`4e35a56`](https://github.com/mastra-ai/mastra/commit/4e35a56cdf8d74a5ff6d5eda01f2c1deaf6cc7be)]:
  - @mastra/core@1.56.0-alpha.1
  - @mastra/code-sdk@1.1.2-alpha.1

## 0.3.1-alpha.0

### Patch Changes

- Updated dependencies [[`7f4e26d`](https://github.com/mastra-ai/mastra/commit/7f4e26dd57bd9b23c278ea21235ab823a3810a6c), [`b582f7f`](https://github.com/mastra-ai/mastra/commit/b582f7fa2f9c1f87d19efc63d344fbe5dda2608c), [`b582f7f`](https://github.com/mastra-ai/mastra/commit/b582f7fa2f9c1f87d19efc63d344fbe5dda2608c)]:
  - @mastra/core@1.56.0-alpha.0
  - @mastra/code-sdk@1.1.2-alpha.0

## 0.3.0

### Minor Changes

- Added a `channel-identity` storage domain so a factory can link a chat-platform sender to one of its own users, and a `channels()` slot so an integration can supply the chat platform itself. ([#20060](https://github.com/mastra-ai/mastra/pull/20060))

  `ChannelIdentityStorage` persists account links keyed by platform, external team id, and external user id, and records an optional default factory project per link. A link is written only after the chat platform itself asserts the account through OpenID Connect, with the existing `createStateSigner` binding the round trip to the tenant that started it.

  `FactoryIntegration` gains an optional `channels(ctx)` returning an `AgentControllerChannels`, which the factory attaches to the mounted agent controller during `prepare()`. Inbound platform messages then reach the same agents the web UI drives, without the deploy entry reaching into the prepared controller to wire them by hand. `IntegrationContext` gains `storage.channelIdentity` for integrations that use the slot. Providing `channels()` adds the `channel-identity` domain to the integration's readiness requirements, so an integration whose reverse index is not migrated reports not-ready and its channels never attach. Only one integration may provide channels; a second fails the boot, because attaching replaces rather than merges.

  `StateTenant` — what `StateSigner.verify` returns — gains a `nonce` field carrying the per-`state` random value. A signed `state` stays valid for its whole lifetime, so a flow that must not run twice off one `state` can key single-use bookkeeping on the nonce; the Slack account-link callback burns it before spending the authorization code. `verify` now rejects a `state` carrying no nonce.

  The integration seam itself — `FactoryIntegration`, `IntegrationContext`, `IntegrationHooks`, and `IntegrationTools` — is now exported from the package entry point. Implementing an integration outside this package was already the documented path for third parties, but the types to do it were unreachable. `ChannelIdentityStorage` and `createFactoryRouteAuth` are exported too, alongside the existing projects and work-items storage domains.

  Fixed sign-in returning to the root path instead of the page the visitor started from. The OAuth `state` carrying that destination was encoded as Base64URL JSON, but `MastraAuthStudio` reads the `uuid|encodedPath` shape, so it never found a destination and every sign-in landed on `/`. The state now uses that shape, and the destination is also stashed in a short-lived `HttpOnly` cookie for providers that do not echo `state` back to the callback.

- Added a per-Factory Slack work-item setting so a new Slack thread only opens a Work-board card when that Factory opts in, and Slack OAuth now returns to the Factory the flow started from. ([#20395](https://github.com/mastra-ai/mastra/pull/20395))

### Patch Changes

- Fixed workspace re-opening failing when the session's agent switched branches and left uncommitted work in the tree. The workspace now keeps the checkout on its current branch instead of returning an error — the session's work in progress always wins over the recorded branch. ([#20372](https://github.com/mastra-ai/mastra/pull/20372))

- Move Github log to debug instead of info in factory ([#20331](https://github.com/mastra-ai/mastra/pull/20331))

- Opening a workspace no longer fails when the repository checkout holds uncommitted or untracked files that block `git pull` (for example residue from a changeset-version run or a build). Materialization now keeps the checkout as-is — the same treatment diverged session branches already receive — instead of surfacing "git pull failed: Your local changes would be overwritten by merge" and refusing to open the thread. Local state is never discarded to force the pull through. ([#20372](https://github.com/mastra-ai/mastra/pull/20372))

- Stop long-running Factory dispatches from starving the decision queue. The dispatcher poll loop previously awaited every dispatch to completion before claiming again, so a single slow effect (a skill kickoff consuming a full agent run, or binding preparation cloning a repository) froze the whole queue and left every other rule effect stuck in "pending" — sometimes for the 15-minute sandbox clone timeout times five retry attempts. Dispatches now run detached from the poll loop under a bounded in-flight cap while lease renewal keeps them protected from re-claim, so new decisions keep flowing while slow ones finish. ([#20356](https://github.com/mastra-ai/mastra/pull/20356))

- Added model switching to Factory review sessions so work can continue during a model outage. ([#20423](https://github.com/mastra-ai/mastra/pull/20423))

- Fixed a boot-time provisioning storm where several concurrent requests for the same cold session (for example multiple open browser tabs polling right after a server restart) each provisioned their own sandbox. Concurrent sandbox opens for the same session now share one in-flight provision, so only a single sandbox is created per session. ([#20380](https://github.com/mastra-ai/mastra/pull/20380))

- Fixed manual issue triage in platform deployments. The triage runner is now automatically derived from the mounted controller, so manual triage no longer returns 503 when no explicit runner is configured. The manual triage endpoint now shares the same wrapper as webhook-triggered triage, ensuring labels and default model resolution are handled consistently. ([#20362](https://github.com/mastra-ai/mastra/pull/20362))

- Improved contributor guidance for Factory backend development. ([#20327](https://github.com/mastra-ai/mastra/pull/20327))

- Fixed Factory losing repository access after a GitHub App is reinstalled with a new installation ID. ([#20348](https://github.com/mastra-ai/mastra/pull/20348))

- Review sessions now load project AGENTS.md/CLAUDE.md from the pull request's trusted base branch instead of skipping them entirely. The working-tree copies on an untrusted checkout remain excluded from the system prompt and reminder injection; content is served from the base ref via git, and sessions without a known base ref still skip project instruction files. ([#20372](https://github.com/mastra-ai/mastra/pull/20372))

- Factory review verdicts are stricter and grounded in the full review record: ([#20372](https://github.com/mastra-ai/mastra/pull/20372))

  - The reviewer waits for pending review bots to finish on the head commit (polling up to 10 minutes) before forming a verdict, then reads existing reviews — bot and human — and every substantive prior finding is confirmed, addressed, or refuted with evidence. Confirmed unaddressed major findings block approval.
  - Approval is earned through explicit gates: verification executed, all prior findings dispositioned, no bot still pending, behavior covered by tests, adversarial self-check survived. Any concrete change the author should make before merge means "request changes", borderline calls tie-break toward "request changes", and real defects can't be relabeled non-blocking to protect an approval.
  - Non-blocking findings with mechanical fixes ship as a follow-up PR opened by the reviewer against the reviewed PR's branch, instead of landing as homework for the author.
  - The reviewer is hardened against prompt injection: PR content can never direct the review, steering attempts become blocking security findings, bot identity is verified by account login, the PR's install/test-time code is inspected before anything is executed, and follow-up PRs only ever contain code the reviewer authored.
  - The reviewer runs the changed packages' tests and typecheck itself instead of trusting green CI, and every approval must survive an adversarial self-check.
  - PRs with merge conflicts still get a full review but are never approved and never have their conflicts resolved by the reviewer.

  Reviews arrive on the pull request itself, published via `gh pr review --approve` or `gh pr review --request-changes` before the review pass completes.

- Fix Factory workspaces not being available to HTTP routes immediately after creation. Sessions now consistently reuse the same workspace across requests. ([#20421](https://github.com/mastra-ai/mastra/pull/20421))

- Fixed Factory rules treating a work item from a non-GitHub, non-Linear source as a GitHub issue. A Slack thread card moved into Triage ran the GitHub issue rule and handed the triage agent a Slack permalink labeled as a GitHub issue; those cards now resolve the plain work-item rules instead. ([#20395](https://github.com/mastra-ai/mastra/pull/20395))

- Review sessions no longer ingest AGENTS.md or CLAUDE.md from the checked-out pull request branch. A PR branch is third-party content, so its instruction files are treated as content under review instead of trusted configuration — closing a prompt-injection path into the reviewer agent. The reviewer also runs the PR's install/build/test commands with GitHub tokens stripped from the environment. ([#20372](https://github.com/mastra-ai/mastra/pull/20372))

- Fixed Factory provisioning a fresh Platform sandbox for every new session. When a work item finishes or a session is deleted, its sandbox is scrubbed back to the repository's default branch (including gitignored files) and returned to a per-repository reuse pool, so new sessions for the same repository reuse a pooled sandbox instead of spinning up another VM. ([#20328](https://github.com/mastra-ai/mastra/pull/20328))

  GitHub tokens are injected per command and are no longer stored in the sandbox environment, so a reused sandbox never carries a previous session's credentials.

- Added an option to the instruction-file reminder processor that lets hosts disable injection entirely for a request, so instruction files from untrusted checkouts are never surfaced as reminders. ([#20372](https://github.com/mastra-ai/mastra/pull/20372))

- Updated dependencies [[`3f472b4`](https://github.com/mastra-ai/mastra/commit/3f472b468892a1ff14ccb43cc0343b86f7d8fd7d), [`ba369f2`](https://github.com/mastra-ai/mastra/commit/ba369f2a0aaf998da0d6aa033d26f64f96bef8ac), [`7457af7`](https://github.com/mastra-ai/mastra/commit/7457af7d309fa4ba4d975904249c0d05ec32e6b7), [`35b929b`](https://github.com/mastra-ai/mastra/commit/35b929b7abc3d20d85c7985880960ac2d04a6c86), [`55c9e24`](https://github.com/mastra-ai/mastra/commit/55c9e248c27c1d72b5bb7e94ea6b8a3999eee49f), [`dcfed93`](https://github.com/mastra-ai/mastra/commit/dcfed93e1e256c6abfa792cbb7ca836f5d0e8638), [`2876e15`](https://github.com/mastra-ai/mastra/commit/2876e15b4d2f616a3bc1ed3af57d546c268384ce), [`35b929b`](https://github.com/mastra-ai/mastra/commit/35b929b7abc3d20d85c7985880960ac2d04a6c86), [`9b3626a`](https://github.com/mastra-ai/mastra/commit/9b3626aeb1d16fcd34b0a8e94c114ddb80a3b240), [`6936517`](https://github.com/mastra-ai/mastra/commit/6936517137090304b735a32aca8f8694f91cb927), [`4696963`](https://github.com/mastra-ai/mastra/commit/469696312ac4c618bc8475b0c5ed7949b8a3455e), [`723aa54`](https://github.com/mastra-ai/mastra/commit/723aa5437106bdb708ae03c0ef6b77aa11291e73), [`4137863`](https://github.com/mastra-ai/mastra/commit/4137863eaa35f430117d21d5dc1bf2f534e64339), [`4137863`](https://github.com/mastra-ai/mastra/commit/4137863eaa35f430117d21d5dc1bf2f534e64339), [`07f5b4b`](https://github.com/mastra-ai/mastra/commit/07f5b4ba9d608d88865030732e580298296adf99), [`723aa54`](https://github.com/mastra-ai/mastra/commit/723aa5437106bdb708ae03c0ef6b77aa11291e73), [`723aa54`](https://github.com/mastra-ai/mastra/commit/723aa5437106bdb708ae03c0ef6b77aa11291e73), [`598080f`](https://github.com/mastra-ai/mastra/commit/598080f224edb3f0f5b801035b067fac50a56a03)]:
  - @mastra/core@1.55.0
  - @mastra/code-sdk@1.1.1

## 0.3.0-alpha.3

### Minor Changes

- Added a per-Factory Slack work-item setting so a new Slack thread only opens a Work-board card when that Factory opts in, and Slack OAuth now returns to the Factory the flow started from. ([#20395](https://github.com/mastra-ai/mastra/pull/20395))

### Patch Changes

- Fixed workspace re-opening failing when the session's agent switched branches and left uncommitted work in the tree. The workspace now keeps the checkout on its current branch instead of returning an error — the session's work in progress always wins over the recorded branch. ([#20372](https://github.com/mastra-ai/mastra/pull/20372))

- Opening a workspace no longer fails when the repository checkout holds uncommitted or untracked files that block `git pull` (for example residue from a changeset-version run or a build). Materialization now keeps the checkout as-is — the same treatment diverged session branches already receive — instead of surfacing "git pull failed: Your local changes would be overwritten by merge" and refusing to open the thread. Local state is never discarded to force the pull through. ([#20372](https://github.com/mastra-ai/mastra/pull/20372))

- Review sessions now load project AGENTS.md/CLAUDE.md from the pull request's trusted base branch instead of skipping them entirely. The working-tree copies on an untrusted checkout remain excluded from the system prompt and reminder injection; content is served from the base ref via git, and sessions without a known base ref still skip project instruction files. ([#20372](https://github.com/mastra-ai/mastra/pull/20372))

- Factory review verdicts are stricter and grounded in the full review record: ([#20372](https://github.com/mastra-ai/mastra/pull/20372))

  - The reviewer waits for pending review bots to finish on the head commit (polling up to 10 minutes) before forming a verdict, then reads existing reviews — bot and human — and every substantive prior finding is confirmed, addressed, or refuted with evidence. Confirmed unaddressed major findings block approval.
  - Approval is earned through explicit gates: verification executed, all prior findings dispositioned, no bot still pending, behavior covered by tests, adversarial self-check survived. Any concrete change the author should make before merge means "request changes", borderline calls tie-break toward "request changes", and real defects can't be relabeled non-blocking to protect an approval.
  - Non-blocking findings with mechanical fixes ship as a follow-up PR opened by the reviewer against the reviewed PR's branch, instead of landing as homework for the author.
  - The reviewer is hardened against prompt injection: PR content can never direct the review, steering attempts become blocking security findings, bot identity is verified by account login, the PR's install/test-time code is inspected before anything is executed, and follow-up PRs only ever contain code the reviewer authored.
  - The reviewer runs the changed packages' tests and typecheck itself instead of trusting green CI, and every approval must survive an adversarial self-check.
  - PRs with merge conflicts still get a full review but are never approved and never have their conflicts resolved by the reviewer.

  Reviews arrive on the pull request itself, published via `gh pr review --approve` or `gh pr review --request-changes` before the review pass completes.

- Fix Factory workspaces not being available to HTTP routes immediately after creation. Sessions now consistently reuse the same workspace across requests. ([#20421](https://github.com/mastra-ai/mastra/pull/20421))

- Fixed Factory rules treating a work item from a non-GitHub, non-Linear source as a GitHub issue. A Slack thread card moved into Triage ran the GitHub issue rule and handed the triage agent a Slack permalink labeled as a GitHub issue; those cards now resolve the plain work-item rules instead. ([#20395](https://github.com/mastra-ai/mastra/pull/20395))

- Review sessions no longer ingest AGENTS.md or CLAUDE.md from the checked-out pull request branch. A PR branch is third-party content, so its instruction files are treated as content under review instead of trusted configuration — closing a prompt-injection path into the reviewer agent. The reviewer also runs the PR's install/build/test commands with GitHub tokens stripped from the environment. ([#20372](https://github.com/mastra-ai/mastra/pull/20372))

- Added an option to the instruction-file reminder processor that lets hosts disable injection entirely for a request, so instruction files from untrusted checkouts are never surfaced as reminders. ([#20372](https://github.com/mastra-ai/mastra/pull/20372))

- Updated dependencies [[`723aa54`](https://github.com/mastra-ai/mastra/commit/723aa5437106bdb708ae03c0ef6b77aa11291e73), [`723aa54`](https://github.com/mastra-ai/mastra/commit/723aa5437106bdb708ae03c0ef6b77aa11291e73), [`723aa54`](https://github.com/mastra-ai/mastra/commit/723aa5437106bdb708ae03c0ef6b77aa11291e73)]:
  - @mastra/code-sdk@1.1.1-alpha.3
  - @mastra/core@1.55.0-alpha.3

## 0.3.0-alpha.2

### Minor Changes

- Added a `channel-identity` storage domain so a factory can link a chat-platform sender to one of its own users, and a `channels()` slot so an integration can supply the chat platform itself. ([#20060](https://github.com/mastra-ai/mastra/pull/20060))

  `ChannelIdentityStorage` persists account links keyed by platform, external team id, and external user id, and records an optional default factory project per link. A link is written only after the chat platform itself asserts the account through OpenID Connect, with the existing `createStateSigner` binding the round trip to the tenant that started it.

  `FactoryIntegration` gains an optional `channels(ctx)` returning an `AgentControllerChannels`, which the factory attaches to the mounted agent controller during `prepare()`. Inbound platform messages then reach the same agents the web UI drives, without the deploy entry reaching into the prepared controller to wire them by hand. `IntegrationContext` gains `storage.channelIdentity` for integrations that use the slot. Providing `channels()` adds the `channel-identity` domain to the integration's readiness requirements, so an integration whose reverse index is not migrated reports not-ready and its channels never attach. Only one integration may provide channels; a second fails the boot, because attaching replaces rather than merges.

  `StateTenant` — what `StateSigner.verify` returns — gains a `nonce` field carrying the per-`state` random value. A signed `state` stays valid for its whole lifetime, so a flow that must not run twice off one `state` can key single-use bookkeeping on the nonce; the Slack account-link callback burns it before spending the authorization code. `verify` now rejects a `state` carrying no nonce.

  The integration seam itself — `FactoryIntegration`, `IntegrationContext`, `IntegrationHooks`, and `IntegrationTools` — is now exported from the package entry point. Implementing an integration outside this package was already the documented path for third parties, but the types to do it were unreachable. `ChannelIdentityStorage` and `createFactoryRouteAuth` are exported too, alongside the existing projects and work-items storage domains.

  Fixed sign-in returning to the root path instead of the page the visitor started from. The OAuth `state` carrying that destination was encoded as Base64URL JSON, but `MastraAuthStudio` reads the `uuid|encodedPath` shape, so it never found a destination and every sign-in landed on `/`. The state now uses that shape, and the destination is also stashed in a short-lived `HttpOnly` cookie for providers that do not echo `state` back to the callback.

### Patch Changes

- Fixed a boot-time provisioning storm where several concurrent requests for the same cold session (for example multiple open browser tabs polling right after a server restart) each provisioned their own sandbox. Concurrent sandbox opens for the same session now share one in-flight provision, so only a single sandbox is created per session. ([#20380](https://github.com/mastra-ai/mastra/pull/20380))

- Fixed Factory provisioning a fresh Platform sandbox for every new session. When a work item finishes or a session is deleted, its sandbox is scrubbed back to the repository's default branch (including gitignored files) and returned to a per-repository reuse pool, so new sessions for the same repository reuse a pooled sandbox instead of spinning up another VM. ([#20328](https://github.com/mastra-ai/mastra/pull/20328))

  GitHub tokens are injected per command and are no longer stored in the sandbox environment, so a reused sandbox never carries a previous session's credentials.

- Updated dependencies [[`7457af7`](https://github.com/mastra-ai/mastra/commit/7457af7d309fa4ba4d975904249c0d05ec32e6b7), [`55c9e24`](https://github.com/mastra-ai/mastra/commit/55c9e248c27c1d72b5bb7e94ea6b8a3999eee49f), [`07f5b4b`](https://github.com/mastra-ai/mastra/commit/07f5b4ba9d608d88865030732e580298296adf99)]:
  - @mastra/code-sdk@1.1.1-alpha.2
  - @mastra/core@1.55.0-alpha.2

## 0.2.3-alpha.1

### Patch Changes

- Move Github log to debug instead of info in factory ([#20331](https://github.com/mastra-ai/mastra/pull/20331))

- Stop long-running Factory dispatches from starving the decision queue. The dispatcher poll loop previously awaited every dispatch to completion before claiming again, so a single slow effect (a skill kickoff consuming a full agent run, or binding preparation cloning a repository) froze the whole queue and left every other rule effect stuck in "pending" — sometimes for the 15-minute sandbox clone timeout times five retry attempts. Dispatches now run detached from the poll loop under a bounded in-flight cap while lease renewal keeps them protected from re-claim, so new decisions keep flowing while slow ones finish. ([#20356](https://github.com/mastra-ai/mastra/pull/20356))

- Fixed manual issue triage in platform deployments. The triage runner is now automatically derived from the mounted controller, so manual triage no longer returns 503 when no explicit runner is configured. The manual triage endpoint now shares the same wrapper as webhook-triggered triage, ensuring labels and default model resolution are handled consistently. ([#20362](https://github.com/mastra-ai/mastra/pull/20362))

- Updated dependencies [[`ba369f2`](https://github.com/mastra-ai/mastra/commit/ba369f2a0aaf998da0d6aa033d26f64f96bef8ac), [`dcfed93`](https://github.com/mastra-ai/mastra/commit/dcfed93e1e256c6abfa792cbb7ca836f5d0e8638), [`2876e15`](https://github.com/mastra-ai/mastra/commit/2876e15b4d2f616a3bc1ed3af57d546c268384ce), [`4137863`](https://github.com/mastra-ai/mastra/commit/4137863eaa35f430117d21d5dc1bf2f534e64339), [`4137863`](https://github.com/mastra-ai/mastra/commit/4137863eaa35f430117d21d5dc1bf2f534e64339), [`598080f`](https://github.com/mastra-ai/mastra/commit/598080f224edb3f0f5b801035b067fac50a56a03)]:
  - @mastra/core@1.55.0-alpha.1
  - @mastra/code-sdk@1.1.1-alpha.1

## 0.2.3-alpha.0

### Patch Changes

- Improved contributor guidance for Factory backend development. ([#20327](https://github.com/mastra-ai/mastra/pull/20327))

- Fixed Factory losing repository access after a GitHub App is reinstalled with a new installation ID. ([#20348](https://github.com/mastra-ai/mastra/pull/20348))

- Updated dependencies [[`3f472b4`](https://github.com/mastra-ai/mastra/commit/3f472b468892a1ff14ccb43cc0343b86f7d8fd7d), [`35b929b`](https://github.com/mastra-ai/mastra/commit/35b929b7abc3d20d85c7985880960ac2d04a6c86), [`35b929b`](https://github.com/mastra-ai/mastra/commit/35b929b7abc3d20d85c7985880960ac2d04a6c86), [`9b3626a`](https://github.com/mastra-ai/mastra/commit/9b3626aeb1d16fcd34b0a8e94c114ddb80a3b240)]:
  - @mastra/core@1.55.0-alpha.0
  - @mastra/code-sdk@1.1.1-alpha.0

## 0.2.2

### Patch Changes

- Make shared-factory credentials discoverable and shareable. The providers config route now reports `orgKey` per provider (an org-wide API key exists, even when shadowed by a personal credential) and `orgKeyAdmin` on the envelope (whether the caller may write org-scoped keys). The Studio UI uses this to default factory-setup API keys to org scope, warn when a factory default model is backed by a personal-only credential, show Personal/Org key badges, and replace the composer with an actionable notice when the signed-in user has no credential for the factory default model's provider. ([#20315](https://github.com/mastra-ai/mastra/pull/20315))

- Reopening a workspace no longer fails with "git pull failed: Not possible to fast-forward" when the sandbox workdir was left on a session branch that diverged from its upstream (or has no upstream / detached HEAD). That state is the session's local work, so materialization now keeps the checkout as-is and continues instead of erroring the thread page; genuine pull failures (auth, egress, corruption) still surface. ([#20315](https://github.com/mastra-ai/mastra/pull/20315))

- Observational-memory settings no longer fail with "No session for resourceId" on the settings page: OM config routes now treat the live session as best-effort sync and fall back to the durably stored per-user settings when no agent-controller session exists for the resource (e.g. after a server restart), so settings load and save instead of 404ing ([#20265](https://github.com/mastra-ai/mastra/pull/20265))

- Pin Factory session agents to their session workdir. The agent system prompt derives its working directory from `state.projectPath`, which for Factory sessions inherited the controller-global default — the web server's own checkout. Review agents would `cd` into the host repository and run `gh pr checkout` there, mutating the developer's working tree instead of the session sandbox. The session workspace factory now seeds `projectPath`/`projectName` with the resolved sandbox workdir when the session is created and self-heals live state on later requests. ([#20320](https://github.com/mastra-ai/mastra/pull/20320))

- Fixed session creation ignoring an exact thread id when the session was already live. Requesting a session with a threadId now resumes or creates that exact thread even when another request (like an event subscription or message listing) created the session first, preventing 'Thread not found' errors for workspace threads. ([#20265](https://github.com/mastra-ai/mastra/pull/20265))

- Made Factory session opens and rule-driven kickoffs resilient to platform sandbox failures: ([#20294](https://github.com/mastra-ai/mastra/pull/20294))

  - Skill kickoffs now wait for the agent to accept the wake signal (via the new `requireDelivery` option on `session.sendSignal`) and automatically retry when delivery fails — for example when a platform sandbox is unreachable. Previously kickoffs were marked as sent even when the wake never reached the agent, so review sessions ended up as permanently empty threads.
  - Exec calls in the repo materialize/checkout/worktree-setup path retry thrown transport errors with a 5xx status (up to 2 retries with backoff). When several platform sandboxes are provisioned concurrently, the workspace proxy can return a transient 5xx on exec while a VM is still booting; this previously failed the whole session open with "Platform proxy request failed with 500". Command failures are unaffected — they resolve with a non-zero exit code and are never retried.
  - A sandbox whose git preflight fails (`git-missing`) is now treated as poisoned: the workspace factory tears it down, clears the persisted binding, and retries once on a freshly provisioned sandbox. Previously a sandbox booted from a bare base image (e.g. when the provider's template build fails) was reattached forever, so every session open failed with "git is not installed in the sandbox".
  - Concurrent kickoff preparation no longer surfaces a spurious unique-constraint error: a losing preparer can collide on both the work item's `source_key` and the pending start's `kickoff_key` in sequence, so the insert-or-replay loop now retries once more before giving up.

- Fixed Factory sessions failing to start their kickoff run. Workspaces now recover automatically when the sandbox provider changes or a sandbox is wiped (the repository is re-cloned instead of failing), thread pages surface workspace preparation errors with a Retry button instead of hanging, and kickoff messages are now delivered to the session thread instead of silently failing with a permissions error. ([#20265](https://github.com/mastra-ai/mastra/pull/20265))

- The factory-review skill now publishes its verdict on the pull request itself (gh pr review --approve / --request-changes with the full handoff body, falling back to a PR comment when GitHub rejects the review) instead of only posting the verdict in the Factory thread ([#20265](https://github.com/mastra-ai/mastra/pull/20265))

- Allow signed-out Factory pages to load their web app manifest and icon. ([#20246](https://github.com/mastra-ai/mastra/pull/20246))

- Added a periodic merged-PR reconciler so review board cards can never get stuck when a merge event is missed. Every 5 minutes the platform GitHub worker lists still-open `github-pr` review cards, fetches the live pull request state from GitHub, and replays a missed merge through the normal rules ingress with a state-derived idempotency key — moving the card to Done (and notifying an active session, if any) exactly once. The sweep has its own switch, `MASTRA_PLATFORM_GITHUB_RECONCILE_ENABLED` (default on), and keeps running in a reconcile-only worker mode even when `MASTRA_PLATFORM_GITHUB_POLLING_ENABLED=false`. Sweep failures are logged and stay on cadence instead of retrying every poll tick. ([#20315](https://github.com/mastra-ai/mastra/pull/20315))

- Move merged pull request Review cards to Done automatically. When a PR merge event binds to the PR's own Review card, the built-in rule now transitions the card to Done (delivering a note to the card's active session when one exists) instead of attempting to message a work session that may not exist. Merge events bound to a provenance-linked Work item still only remind that agent to assess completion and never auto-complete the Work item. ([#20315](https://github.com/mastra-ai/mastra/pull/20315))

  Pull requests closed without merging now clear off the board too: a new built-in `pullRequestClosed` rule moves the PR's Review card to Canceled, and the reconcile sweep replays missed closes (not just missed merges) so abandoned PRs no longer sit in Reviewing forever.

  The reconcile sweep is also scoped to factory-configured repositories: instead of probing every repository a GitHub installation exposes, it bulk-loads the (installation, repository) pairs linked to factory projects and only sweeps those, reporting the swept repository count in its summary log.

- Changed the observational memory defaults a factory gets when you connect a provider: Google and DeepSeek now seed OM with their small, cheap model instead of the model you selected for the factory, matching what Anthropic and OpenAI already did. Providers without a cheap OM model keep using your selected model, and OM models you already set are still left untouched. ([#20298](https://github.com/mastra-ai/mastra/pull/20298))

- Speed up Factory hot paths: ([#20261](https://github.com/mastra-ai/mastra/pull/20261))

  - Much lower latency on authenticated requests — successful auth verifications are cached briefly instead of hitting the platform on every request, and credential verification requests time out after 15 seconds instead of hanging
  - Faster GitHub repository listing and connecting
  - Opening the same session concurrently no longer provisions duplicate sandboxes, and stuck sandbox commands now fail with a clear error instead of hanging
  - Factory run dispatching stays fast as work-item history grows

- Updated dependencies [[`ce93a3c`](https://github.com/mastra-ai/mastra/commit/ce93a3c114ea1cbfbd576f3db41d7c26c9844f5b), [`5718a22`](https://github.com/mastra-ai/mastra/commit/5718a229281dcfd36bcd1f42a242e3717e510a33), [`a211d09`](https://github.com/mastra-ai/mastra/commit/a211d09185dc65a746534914cf38b67f21ee9bac), [`0dca9d0`](https://github.com/mastra-ai/mastra/commit/0dca9d0b1356024a53b72ea6f040db528b126caa), [`6218217`](https://github.com/mastra-ai/mastra/commit/62182171b6cfca0b099f1c6a77a2e65e7639ab86), [`f014c26`](https://github.com/mastra-ai/mastra/commit/f014c26f3445118b684e286ee5819b46dfa943a0), [`5807d3a`](https://github.com/mastra-ai/mastra/commit/5807d3ae1d259b8b7d6df7e5bf2b485c694af9c8), [`57661af`](https://github.com/mastra-ai/mastra/commit/57661afeca52ff9af4e72675ede2134fa503d5a5), [`05db566`](https://github.com/mastra-ai/mastra/commit/05db566fcbdcbf33d0bffca0c72ec30129e2e3ca), [`57661af`](https://github.com/mastra-ai/mastra/commit/57661afeca52ff9af4e72675ede2134fa503d5a5), [`57661af`](https://github.com/mastra-ai/mastra/commit/57661afeca52ff9af4e72675ede2134fa503d5a5), [`5718a22`](https://github.com/mastra-ai/mastra/commit/5718a229281dcfd36bcd1f42a242e3717e510a33), [`57661af`](https://github.com/mastra-ai/mastra/commit/57661afeca52ff9af4e72675ede2134fa503d5a5), [`d1b7e3a`](https://github.com/mastra-ai/mastra/commit/d1b7e3a978a309a5653eeaa490d2d6c7c53bd093), [`29c584a`](https://github.com/mastra-ai/mastra/commit/29c584a13a88831e5ed1fdeb0ff8e82eae180433), [`8dadb6a`](https://github.com/mastra-ai/mastra/commit/8dadb6abfe449b7f8b129663671cc614f2cceeef), [`c093146`](https://github.com/mastra-ai/mastra/commit/c0931466404d3c521308ea119cb165bb7e695155), [`2624b7e`](https://github.com/mastra-ai/mastra/commit/2624b7ecad926028e3cbc9a5e843f5624c67302e), [`8124754`](https://github.com/mastra-ai/mastra/commit/8124754ae89fbc69f8136d1df4a91904d0f84c4e), [`d12b2e4`](https://github.com/mastra-ai/mastra/commit/d12b2e4023fd9e3d3e93a9169f5088bcee2a849c)]:
  - @mastra/core@1.54.0
  - @mastra/code-sdk@1.1.0
  - @mastra/auth-studio@1.3.3

## 0.2.2-alpha.4

### Patch Changes

- Make shared-factory credentials discoverable and shareable. The providers config route now reports `orgKey` per provider (an org-wide API key exists, even when shadowed by a personal credential) and `orgKeyAdmin` on the envelope (whether the caller may write org-scoped keys). The Studio UI uses this to default factory-setup API keys to org scope, warn when a factory default model is backed by a personal-only credential, show Personal/Org key badges, and replace the composer with an actionable notice when the signed-in user has no credential for the factory default model's provider. ([#20315](https://github.com/mastra-ai/mastra/pull/20315))

- Reopening a workspace no longer fails with "git pull failed: Not possible to fast-forward" when the sandbox workdir was left on a session branch that diverged from its upstream (or has no upstream / detached HEAD). That state is the session's local work, so materialization now keeps the checkout as-is and continues instead of erroring the thread page; genuine pull failures (auth, egress, corruption) still surface. ([#20315](https://github.com/mastra-ai/mastra/pull/20315))

- Pin Factory session agents to their session workdir. The agent system prompt derives its working directory from `state.projectPath`, which for Factory sessions inherited the controller-global default — the web server's own checkout. Review agents would `cd` into the host repository and run `gh pr checkout` there, mutating the developer's working tree instead of the session sandbox. The session workspace factory now seeds `projectPath`/`projectName` with the resolved sandbox workdir when the session is created and self-heals live state on later requests. ([#20320](https://github.com/mastra-ai/mastra/pull/20320))

- Made Factory session opens and rule-driven kickoffs resilient to platform sandbox failures: ([#20294](https://github.com/mastra-ai/mastra/pull/20294))

  - Skill kickoffs now wait for the agent to accept the wake signal (via the new `requireDelivery` option on `session.sendSignal`) and automatically retry when delivery fails — for example when a platform sandbox is unreachable. Previously kickoffs were marked as sent even when the wake never reached the agent, so review sessions ended up as permanently empty threads.
  - Exec calls in the repo materialize/checkout/worktree-setup path retry thrown transport errors with a 5xx status (up to 2 retries with backoff). When several platform sandboxes are provisioned concurrently, the workspace proxy can return a transient 5xx on exec while a VM is still booting; this previously failed the whole session open with "Platform proxy request failed with 500". Command failures are unaffected — they resolve with a non-zero exit code and are never retried.
  - A sandbox whose git preflight fails (`git-missing`) is now treated as poisoned: the workspace factory tears it down, clears the persisted binding, and retries once on a freshly provisioned sandbox. Previously a sandbox booted from a bare base image (e.g. when the provider's template build fails) was reattached forever, so every session open failed with "git is not installed in the sandbox".
  - Concurrent kickoff preparation no longer surfaces a spurious unique-constraint error: a losing preparer can collide on both the work item's `source_key` and the pending start's `kickoff_key` in sequence, so the insert-or-replay loop now retries once more before giving up.

- Added a periodic merged-PR reconciler so review board cards can never get stuck when a merge event is missed. Every 5 minutes the platform GitHub worker lists still-open `github-pr` review cards, fetches the live pull request state from GitHub, and replays a missed merge through the normal rules ingress with a state-derived idempotency key — moving the card to Done (and notifying an active session, if any) exactly once. The sweep has its own switch, `MASTRA_PLATFORM_GITHUB_RECONCILE_ENABLED` (default on), and keeps running in a reconcile-only worker mode even when `MASTRA_PLATFORM_GITHUB_POLLING_ENABLED=false`. Sweep failures are logged and stay on cadence instead of retrying every poll tick. ([#20315](https://github.com/mastra-ai/mastra/pull/20315))

- Move merged pull request Review cards to Done automatically. When a PR merge event binds to the PR's own Review card, the built-in rule now transitions the card to Done (delivering a note to the card's active session when one exists) instead of attempting to message a work session that may not exist. Merge events bound to a provenance-linked Work item still only remind that agent to assess completion and never auto-complete the Work item. ([#20315](https://github.com/mastra-ai/mastra/pull/20315))

  Pull requests closed without merging now clear off the board too: a new built-in `pullRequestClosed` rule moves the PR's Review card to Canceled, and the reconcile sweep replays missed closes (not just missed merges) so abandoned PRs no longer sit in Reviewing forever.

  The reconcile sweep is also scoped to factory-configured repositories: instead of probing every repository a GitHub installation exposes, it bulk-loads the (installation, repository) pairs linked to factory projects and only sweeps those, reporting the swept repository count in its summary log.

- Updated dependencies [[`6218217`](https://github.com/mastra-ai/mastra/commit/62182171b6cfca0b099f1c6a77a2e65e7639ab86), [`d12b2e4`](https://github.com/mastra-ai/mastra/commit/d12b2e4023fd9e3d3e93a9169f5088bcee2a849c)]:
  - @mastra/core@1.54.0-alpha.4
  - @mastra/code-sdk@1.1.0-alpha.4

## 0.2.2-alpha.3

### Patch Changes

- Updated dependencies [[`29c584a`](https://github.com/mastra-ai/mastra/commit/29c584a13a88831e5ed1fdeb0ff8e82eae180433)]:
  - @mastra/core@1.54.0-alpha.3
  - @mastra/code-sdk@1.1.0-alpha.3

## 0.2.2-alpha.2

### Patch Changes

- Changed the observational memory defaults a factory gets when you connect a provider: Google and DeepSeek now seed OM with their small, cheap model instead of the model you selected for the factory, matching what Anthropic and OpenAI already did. Providers without a cheap OM model keep using your selected model, and OM models you already set are still left untouched. ([#20298](https://github.com/mastra-ai/mastra/pull/20298))

- Updated dependencies [[`a211d09`](https://github.com/mastra-ai/mastra/commit/a211d09185dc65a746534914cf38b67f21ee9bac), [`f014c26`](https://github.com/mastra-ai/mastra/commit/f014c26f3445118b684e286ee5819b46dfa943a0), [`05db566`](https://github.com/mastra-ai/mastra/commit/05db566fcbdcbf33d0bffca0c72ec30129e2e3ca), [`8dadb6a`](https://github.com/mastra-ai/mastra/commit/8dadb6abfe449b7f8b129663671cc614f2cceeef), [`8124754`](https://github.com/mastra-ai/mastra/commit/8124754ae89fbc69f8136d1df4a91904d0f84c4e)]:
  - @mastra/core@1.54.0-alpha.2
  - @mastra/code-sdk@1.1.0-alpha.2

## 0.2.2-alpha.1

### Patch Changes

- Observational-memory settings no longer fail with "No session for resourceId" on the settings page: OM config routes now treat the live session as best-effort sync and fall back to the durably stored per-user settings when no agent-controller session exists for the resource (e.g. after a server restart), so settings load and save instead of 404ing ([#20265](https://github.com/mastra-ai/mastra/pull/20265))

- Fixed session creation ignoring an exact thread id when the session was already live. Requesting a session with a threadId now resumes or creates that exact thread even when another request (like an event subscription or message listing) created the session first, preventing 'Thread not found' errors for workspace threads. ([#20265](https://github.com/mastra-ai/mastra/pull/20265))

- Fixed Factory sessions failing to start their kickoff run. Workspaces now recover automatically when the sandbox provider changes or a sandbox is wiped (the repository is re-cloned instead of failing), thread pages surface workspace preparation errors with a Retry button instead of hanging, and kickoff messages are now delivered to the session thread instead of silently failing with a permissions error. ([#20265](https://github.com/mastra-ai/mastra/pull/20265))

- The factory-review skill now publishes its verdict on the pull request itself (gh pr review --approve / --request-changes with the full handoff body, falling back to a PR comment when GitHub rejects the review) instead of only posting the verdict in the Factory thread ([#20265](https://github.com/mastra-ai/mastra/pull/20265))

- Allow signed-out Factory pages to load their web app manifest and icon. ([#20246](https://github.com/mastra-ai/mastra/pull/20246))

- Speed up Factory hot paths: ([#20261](https://github.com/mastra-ai/mastra/pull/20261))

  - Much lower latency on authenticated requests — successful auth verifications are cached briefly instead of hitting the platform on every request, and credential verification requests time out after 15 seconds instead of hanging
  - Faster GitHub repository listing and connecting
  - Opening the same session concurrently no longer provisions duplicate sandboxes, and stuck sandbox commands now fail with a clear error instead of hanging
  - Factory run dispatching stays fast as work-item history grows

- Updated dependencies [[`ce93a3c`](https://github.com/mastra-ai/mastra/commit/ce93a3c114ea1cbfbd576f3db41d7c26c9844f5b), [`5718a22`](https://github.com/mastra-ai/mastra/commit/5718a229281dcfd36bcd1f42a242e3717e510a33), [`5807d3a`](https://github.com/mastra-ai/mastra/commit/5807d3ae1d259b8b7d6df7e5bf2b485c694af9c8), [`57661af`](https://github.com/mastra-ai/mastra/commit/57661afeca52ff9af4e72675ede2134fa503d5a5), [`57661af`](https://github.com/mastra-ai/mastra/commit/57661afeca52ff9af4e72675ede2134fa503d5a5), [`57661af`](https://github.com/mastra-ai/mastra/commit/57661afeca52ff9af4e72675ede2134fa503d5a5), [`5718a22`](https://github.com/mastra-ai/mastra/commit/5718a229281dcfd36bcd1f42a242e3717e510a33), [`57661af`](https://github.com/mastra-ai/mastra/commit/57661afeca52ff9af4e72675ede2134fa503d5a5), [`d1b7e3a`](https://github.com/mastra-ai/mastra/commit/d1b7e3a978a309a5653eeaa490d2d6c7c53bd093), [`c093146`](https://github.com/mastra-ai/mastra/commit/c0931466404d3c521308ea119cb165bb7e695155), [`2624b7e`](https://github.com/mastra-ai/mastra/commit/2624b7ecad926028e3cbc9a5e843f5624c67302e)]:
  - @mastra/core@1.54.0-alpha.1
  - @mastra/auth-studio@1.3.3-alpha.0
  - @mastra/code-sdk@1.0.3-alpha.1

## 0.2.2-alpha.0

### Patch Changes

- Updated dependencies [[`0dca9d0`](https://github.com/mastra-ai/mastra/commit/0dca9d0b1356024a53b72ea6f040db528b126caa)]:
  - @mastra/core@1.54.0-alpha.0
  - @mastra/code-sdk@1.0.3-alpha.0

## 0.2.1

### Patch Changes

- Removed Git and GitHub route locking that held database transactions open during sandbox and network operations. ([#20135](https://github.com/mastra-ai/mastra/pull/20135))

- Improved Platform GitHub event polling efficiency and added event-count and latency logging for each poll. ([#20123](https://github.com/mastra-ai/mastra/pull/20123))

- Bound the `withProjectLock` / `withDbAdvisoryLock` critical section with an `AbortSignal` timeout (default 60s, configurable via `timeoutMs`). Previously, an unbounded outbound call inside the lock could keep the transaction open for up to Neon's `idle_in_transaction_session_timeout` (5 minutes), pinning the pool connection and the advisory lock the entire time. On timeout the wrapper aborts the `fn`'s signal, rolls the transaction back, releases the connection, and throws `ProjectLockTimeoutError`. ([#20129](https://github.com/mastra-ai/mastra/pull/20129))

- Improved Factory work-item concurrency by replacing distributed advisory locks with atomic claims, idempotent replay, and serializable relationship transactions. ([#20135](https://github.com/mastra-ai/mastra/pull/20135))

- Fixed the workspace files panel in Factory web returning "Path is outside the browsable root" for Factory sessions. The workspace file endpoints now recognize a session id, reattach to that session's sandbox, and list and read rendered files (like .artifacts) directly from the sandbox, so session artifacts render on deployed factories. ([#20101](https://github.com/mastra-ai/mastra/pull/20101))

- Added an updateIssue capability to the Intake surface so Factory can change the state of external issues (open/closed on GitHub, workflow state on Linear) as a side effect of stage transitions. Adapters cover the direct GitHub, direct Linear, platform GitHub, and platform Linear integrations. GitHub adapters reject pull-request targets. Linear adapters resolve the target workflow state per team and skip when the issue is already in the desired state. The platform Linear adapter degrades to a no-op (returns null) when the platform workflow-states endpoint is not yet deployed, so this change is safe to ship ahead of the platform companion route. This is a plumbing change: no rule currently emits the new decision, so behavior is unchanged. ([#20111](https://github.com/mastra-ai/mastra/pull/20111))

- Fixed Factory integrations so GitHub and Linear attach their own event rules. This restores work-item rule ingestion for Platform-backed Linear intake and for the Platform GitHub issue poller. ([#20169](https://github.com/mastra-ai/mastra/pull/20169))

- Updated dependencies [[`c8d8a01`](https://github.com/mastra-ai/mastra/commit/c8d8a010ee2efe2b7bf4d07707382c34c87b14e4), [`f497717`](https://github.com/mastra-ai/mastra/commit/f497717304ad76043f689711ccc044f0cd51ba41), [`df6a9ce`](https://github.com/mastra-ai/mastra/commit/df6a9ce87214f7aadb2edfe62f67605fe998a0a4), [`73839cb`](https://github.com/mastra-ai/mastra/commit/73839cb58322679c170627d1015669ede5f619aa), [`371cf60`](https://github.com/mastra-ai/mastra/commit/371cf6075cef88ac6919a08d59a82e485397364a), [`8e4dc79`](https://github.com/mastra-ai/mastra/commit/8e4dc793dcf035ea506f9ce79f56d2d501a4be14), [`2db93cc`](https://github.com/mastra-ai/mastra/commit/2db93ccd0b872e4de7853a93383efe0647901df8), [`094ab61`](https://github.com/mastra-ai/mastra/commit/094ab6129a1a3ecf6eeb86decac17d5faea4e02a), [`fe80944`](https://github.com/mastra-ai/mastra/commit/fe80944f3ef6681fea6eae8200fce387b7bb3c2f), [`cadd3a2`](https://github.com/mastra-ai/mastra/commit/cadd3a276f8e0026e3c84cffe935538419cb890c), [`263d2ca`](https://github.com/mastra-ai/mastra/commit/263d2cac80ba3b03b9c0f008db6f1f1b9eb0278c), [`75f843d`](https://github.com/mastra-ai/mastra/commit/75f843d09f758223e6eeb321321bdcc5c7e779d0), [`e51e166`](https://github.com/mastra-ai/mastra/commit/e51e166c52e220abc9b64554ce37359dca8544b1)]:
  - @mastra/core@1.53.0
  - @mastra/code-sdk@1.0.2

## 0.2.1-alpha.4

### Patch Changes

- Removed Git and GitHub route locking that held database transactions open during sandbox and network operations. ([#20135](https://github.com/mastra-ai/mastra/pull/20135))

- Improved Factory work-item concurrency by replacing distributed advisory locks with atomic claims, idempotent replay, and serializable relationship transactions. ([#20135](https://github.com/mastra-ai/mastra/pull/20135))

- Fixed Factory integrations so GitHub and Linear attach their own event rules. This restores work-item rule ingestion for Platform-backed Linear intake and for the Platform GitHub issue poller. ([#20169](https://github.com/mastra-ai/mastra/pull/20169))

- Updated dependencies [[`f497717`](https://github.com/mastra-ai/mastra/commit/f497717304ad76043f689711ccc044f0cd51ba41), [`73839cb`](https://github.com/mastra-ai/mastra/commit/73839cb58322679c170627d1015669ede5f619aa), [`8e4dc79`](https://github.com/mastra-ai/mastra/commit/8e4dc793dcf035ea506f9ce79f56d2d501a4be14), [`2db93cc`](https://github.com/mastra-ai/mastra/commit/2db93ccd0b872e4de7853a93383efe0647901df8), [`094ab61`](https://github.com/mastra-ai/mastra/commit/094ab6129a1a3ecf6eeb86decac17d5faea4e02a), [`fe80944`](https://github.com/mastra-ai/mastra/commit/fe80944f3ef6681fea6eae8200fce387b7bb3c2f), [`e51e166`](https://github.com/mastra-ai/mastra/commit/e51e166c52e220abc9b64554ce37359dca8544b1)]:
  - @mastra/code-sdk@1.0.2-alpha.4
  - @mastra/core@1.53.0-alpha.4

## 0.2.1-alpha.3

### Patch Changes

- Updated dependencies:
  - @mastra/core@1.53.0-alpha.3
  - @mastra/code-sdk@1.0.2-alpha.3

## 0.2.1-alpha.2

### Patch Changes

- Updated dependencies [[`75f843d`](https://github.com/mastra-ai/mastra/commit/75f843d09f758223e6eeb321321bdcc5c7e779d0)]:
  - @mastra/core@1.53.0-alpha.2
  - @mastra/code-sdk@1.0.2-alpha.2

## 0.2.1-alpha.1

### Patch Changes

- Updated dependencies [[`c8d8a01`](https://github.com/mastra-ai/mastra/commit/c8d8a010ee2efe2b7bf4d07707382c34c87b14e4), [`371cf60`](https://github.com/mastra-ai/mastra/commit/371cf6075cef88ac6919a08d59a82e485397364a), [`263d2ca`](https://github.com/mastra-ai/mastra/commit/263d2cac80ba3b03b9c0f008db6f1f1b9eb0278c)]:
  - @mastra/core@1.53.0-alpha.1
  - @mastra/code-sdk@1.0.2-alpha.1

## 0.2.1-alpha.0

### Patch Changes

- Improved Platform GitHub event polling efficiency and added event-count and latency logging for each poll. ([#20123](https://github.com/mastra-ai/mastra/pull/20123))

- Bound the `withProjectLock` / `withDbAdvisoryLock` critical section with an `AbortSignal` timeout (default 60s, configurable via `timeoutMs`). Previously, an unbounded outbound call inside the lock could keep the transaction open for up to Neon's `idle_in_transaction_session_timeout` (5 minutes), pinning the pool connection and the advisory lock the entire time. On timeout the wrapper aborts the `fn`'s signal, rolls the transaction back, releases the connection, and throws `ProjectLockTimeoutError`. ([#20129](https://github.com/mastra-ai/mastra/pull/20129))

- Fixed the workspace files panel in Factory web returning "Path is outside the browsable root" for Factory sessions. The workspace file endpoints now recognize a session id, reattach to that session's sandbox, and list and read rendered files (like .artifacts) directly from the sandbox, so session artifacts render on deployed factories. ([#20101](https://github.com/mastra-ai/mastra/pull/20101))

- Added an updateIssue capability to the Intake surface so Factory can change the state of external issues (open/closed on GitHub, workflow state on Linear) as a side effect of stage transitions. Adapters cover the direct GitHub, direct Linear, platform GitHub, and platform Linear integrations. GitHub adapters reject pull-request targets. Linear adapters resolve the target workflow state per team and skip when the issue is already in the desired state. The platform Linear adapter degrades to a no-op (returns null) when the platform workflow-states endpoint is not yet deployed, so this change is safe to ship ahead of the platform companion route. This is a plumbing change: no rule currently emits the new decision, so behavior is unchanged. ([#20111](https://github.com/mastra-ai/mastra/pull/20111))

- Updated dependencies [[`df6a9ce`](https://github.com/mastra-ai/mastra/commit/df6a9ce87214f7aadb2edfe62f67605fe998a0a4), [`cadd3a2`](https://github.com/mastra-ai/mastra/commit/cadd3a276f8e0026e3c84cffe935538419cb890c)]:
  - @mastra/core@1.52.2-alpha.0
  - @mastra/code-sdk@1.0.2-alpha.0

## 0.2.0

### Minor Changes

- Added guided model-provider setup to Factory onboarding with a recommended default model and provider-specific observational-memory defaults. ([#20079](https://github.com/mastra-ai/mastra/pull/20079))

### Patch Changes

- Renamed Mastra Factory server log prefix from "[MastraCode Web]" to "[Mastra Factory]" ([#20088](https://github.com/mastra-ai/mastra/pull/20088))

- Link Factory Review cards to their work item when a PR opens without recorded provenance. GitHub PR-opened ingress now falls back to matching the PR head branch against work item session branches, and Review intake records `headBranch`/`baseBranch` metadata so the board and session views can relate the cards. ([#20074](https://github.com/mastra-ai/mastra/pull/20074))

- Fixed board-started work sessions to use the Factory's default coding model and persisted observational-memory settings. ([#20081](https://github.com/mastra-ai/mastra/pull/20081))

- Restored observational-memory settings so Factory users can choose models and preferences before opening a chat session. ([#20079](https://github.com/mastra-ai/mastra/pull/20079))

- Updated dependencies [[`55adddf`](https://github.com/mastra-ai/mastra/commit/55adddfda2a170b00c112bf37d677e8ce5b65d5a)]:
  - @mastra/core@1.52.1
  - @mastra/code-sdk@1.0.1

## 0.2.0-alpha.0

### Minor Changes

- Added guided model-provider setup to Factory onboarding with a recommended default model and provider-specific observational-memory defaults. ([#20079](https://github.com/mastra-ai/mastra/pull/20079))

### Patch Changes

- Link Factory Review cards to their work item when a PR opens without recorded provenance. GitHub PR-opened ingress now falls back to matching the PR head branch against work item session branches, and Review intake records `headBranch`/`baseBranch` metadata so the board and session views can relate the cards. ([#20074](https://github.com/mastra-ai/mastra/pull/20074))

- Fixed board-started work sessions to use the Factory's default coding model and persisted observational-memory settings. ([#20081](https://github.com/mastra-ai/mastra/pull/20081))

- Restored observational-memory settings so Factory users can choose models and preferences before opening a chat session. ([#20079](https://github.com/mastra-ai/mastra/pull/20079))

- Updated dependencies [[`55adddf`](https://github.com/mastra-ai/mastra/commit/55adddfda2a170b00c112bf37d677e8ce5b65d5a)]:
  - @mastra/core@1.52.1-alpha.0
  - @mastra/code-sdk@1.0.1-alpha.0

## 0.1.0

### Minor Changes

- Move the Factory project CRUD and source-control connection routes into `@mastra/factory` as a `ProjectRoutes` class. The routes take their storage handles (`FactoryProjectsStorage`, `SourceControlStorage`), the allowed version-control integration ids, and a `RouteAuth` adapter at construction time, replacing the old `ProjectDomain` that resolved domains through the `FactoryStorage` registry. The now-unused `FactoryDomain` base class was removed from the web host. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Move the audit domain, agent git-action auditing, intake capabilities, and intake routes into `@mastra/factory`. `AuditDomain` now takes its storage handles (`AuditStorage`, `FactoryProjectsStorage`) and a `RouteAuth` adapter directly instead of resolving them through the factory storage registry, fans out to pluggable `AuditSink`s, and resolves agent tenants through an injected `agentTenant` callback. Intake routes ship as an `IntakeRoutes` class that calls `IntakeStorage` directly (the intermediate intake store module was removed). ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Added autonomous first-pass skills to the Software Factory. Work items now get an automatic investigation, planning, or review pass as soon as they enter the matching board column — no human input needed mid-run: ([#20058](https://github.com/mastra-ai/mastra/pull/20058))

  - **factory-triage** runs when an issue enters triage: it investigates the issue, diagnoses the root cause, and requests a move to planning (or done if the issue should be closed).
  - **factory-plan** runs when an item enters planning: it produces a phased implementation plan and requests a move to execute.
  - **factory-review** runs when a pull request enters review: it reviews the changes, posts a verdict, and requests completion.

  Instead of stopping to ask questions, the skills decide and record each decision as an assumption, batching assumptions and genuinely-human questions into one terminal handoff message. The superseded interactive skills (understand-issue, understand-pr) were removed.

- Move the `FactoryIntegration` contract and the OAuth `state` signer into `@mastra/factory`. The integration interface (routes, tools, diagnostics, intake/version-control capabilities, `IntegrationContext`) now lives at `@mastra/factory/integrations/base`, and `createStateSigner`/`StateSigner` at `@mastra/factory/state-signing`, so integrations can be implemented against the package without importing the web host. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Added the @mastra/factory package. It now owns the Software Factory storage domains (projects, work items, intake, audit, credentials, integrations, model packs, queue health, source control) that previously lived inside the mastracode web app, so they can be reused outside the web server. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Moved the server config routes and provider credential helpers into @mastra/factory as a reusable ConfigRoutes class. Route handlers now receive their auth checks through an injected RouteAuth seam and storage domains through constructor options, so hosts other than the Mastra Code web app can mount the same routes. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Move the Factory work-item (kanban board) routes into `@mastra/factory` as a `WorkItemRoutes` class. The routes take their storage handles (`WorkItemsStorage`, `FactoryProjectsStorage`, `QueueHealthStorage`), an `AuditEmitter`, and a `RouteAuth` adapter at construction time. The request-body validators (`parseCreateWorkItem`, `parseUpdateWorkItem`) now live with the routes, the pass-through work-item store module was removed in favor of calling `WorkItemsStorage` directly, and `computeFactoryMetrics` takes a single object parameter. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

### Patch Changes

- Move the WorkOS audit integration into `@mastra/factory/integrations/workos`. Its Admin Portal route now resolves the caller through the `RouteAuth` seam on `IntegrationContext` instead of web-host auth helpers, and `@mastra/auth-workos` becomes a package dependency. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Move the factory auth module into `@mastra/factory/auth`. The provider-neutral ([#19866](https://github.com/mastra-ai/mastra/pull/19866))
  auth gating (`mountFactoryAuth`, `buildAuthRoutes`, `createFactoryAuthGate`),
  the `RouteAuth` implementation (`createFactoryRouteAuth`), and the WorkOS/SSO
  helpers now live next to the route seam they implement, with factory naming
  throughout.

- The Factory's default `publicUrl` is now `http://localhost:4111` (the Factory server, which serves both the UI and the API) instead of `http://localhost:5173`. Generated Factory projects now run from a single server, so OAuth callback URLs and auth redirects derived from `publicUrl` point at the right origin out of the box. If you serve the SPA from a separate origin (for example a Vite dev server on :5173), set `publicUrl` (or `MASTRACODE_PUBLIC_URL`) explicitly. ([#20036](https://github.com/mastra-ai/mastra/pull/20036))

- Factory board now picks up new GitHub/Linear intake automatically (gentle 30s poll) and refreshes work-item positions immediately when the tab regains focus, instead of requiring a manual page reload ([#20071](https://github.com/mastra-ai/mastra/pull/20071))

- Fixed GitHub PATs saved in Settings not taking effect for the gh CLI in already-running Factory sessions until the server was restarted ([#20069](https://github.com/mastra-ai/mastra/pull/20069))

- Forwarded closed Platform GitHub event-log deliveries into Factory governance before dispatching repository subscriptions, and kept default GitHub rules from auto-starting issues or pull requests created before the Factory. ([#19988](https://github.com/mastra-ai/mastra/pull/19988))

- Track per-stage automation in Factory metrics. Stage history now stamps the exiting actor (`exitedBy`) alongside the entering one, `isAutomationActor` classifies rules-engine, agent (`agent:*`), and webhook (`github:*`) actors as automation, and `computeFactoryMetrics` reports a `stageAutomation` breakdown per stage: how many passes were fully automated (entered and exited by automation on the first visit) and how those automated passes ended up (`done`, `canceled`, `reworked`, or still in flight). Adds the `canceled` terminal stage to the board vocabulary (`FACTORY_RULE_STAGES`) — a tracked non-completion that feeds neither throughput nor cycle time — and rewords organization-required errors to be auth-provider neutral. ([#19844](https://github.com/mastra-ai/mastra/pull/19844))

- Fixed @mastra/factory build output so published modules use explicit .js import extensions and resolve correctly under Node ESM ([#19954](https://github.com/mastra-ai/mastra/pull/19954))

- Deployed factories now authenticate API and Studio requests with the same provider, so Studio sessions work without extra configuration. ([#19966](https://github.com/mastra-ai/mastra/pull/19966))

- Fixed Factory metrics windowing to use inclusive UTC calendar days. Date-only `from`/`to` bounds now include both selected days, an item completing at the current instant is counted in today's throughput (previously it could be dropped on the window's exclusive edge), and `windowDays` reflects the number of gap-filled day buckets. Cards feed the source mix only when created inside the window. ([#19971](https://github.com/mastra-ai/mastra/pull/19971))

- Fixed duplicate repositories in Factory source control settings. ([#19971](https://github.com/mastra-ai/mastra/pull/19971))

- Move the API-surface assembler from mastracode/web into @mastra/factory as `routes/surface` — `assembleWebApiRoutes` is now `assembleFactoryApiRoutes` and `WebApiRoutesDeps` is now `FactoryApiRoutesDeps`. The module composes fs/config/oauth/skills/intake/work-item routes plus every registered integration's route surface (with disabled-status stubs for absent github/linear integrations) from explicitly threaded dependency handles. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Move the GitHub integration and the sandbox fleet into `@mastra/factory`. The fleet is now a DI-constructed `SandboxFleet` class (`@mastra/factory/sandbox/fleet`) that owns provisioning, reattach, teardown, idle windows, and per-replica budgets instead of reading a seeded runtime-config registry. The GitHub routes, webhook, sandbox materialization, project locks, and session subscriptions (`@mastra/factory/integrations/github`) resolve tenants through the `RouteAuth` seam and receive the fleet and factory storage via `IntegrationContext`, so the web host no longer exports `getSeededSandbox`/`getSeededGithubIntegration` service locators. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Move the filesystem routes (`@mastra/factory/routes/fs`) and skill routes (`@mastra/factory/routes/skills`) into `@mastra/factory`. The skill prepare/invoke routes are now a `SkillRoutes` class that resolves users and tenants through the `RouteAuth` seam instead of web-host auth helpers. Diagnostics fields exposed by the GitHub and Linear integrations rename `webAuthEnabled` to `factoryAuthEnabled` to match the package's auth seam naming. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Moved custom model providers and custom model packs off settings.json in the factory web app: both now live in the app database (org-scoped rows in deployed mode, a sentinel local scope in no-auth mode). Custom providers saved in the web settings page are picked up by model resolution and the model catalog through a new pluggable custom-providers source in the SDK, so the gateway no longer reads the host machine's settings.json for them, and models from your custom providers appear in the web model pickers. ([#19964](https://github.com/mastra-ai/mastra/pull/19964))

  Hosts that store custom providers elsewhere (like the factory's database) register a source at boot; when none is registered, the SDK keeps reading settings.json as before:

  ```ts
  import { setCustomProvidersSource } from '@mastra/code-sdk/agents/custom-provider-source';

  setCustomProvidersSource(tenant => (tenant ? snapshotForOrg(tenant.orgId) : []));
  ```

- Fixed cloned session threads reading from a previous storage instance. The dynamic memory cache now invalidates when the storage or vector instance changes, so thread cloning always uses the current database. ([#19966](https://github.com/mastra-ai/mastra/pull/19966))

- Added a memory-settings storage domain: observational memory settings (observer and reflector models, thresholds, attachment observation) changed in the web app are now stored in the app database — one row per user — instead of settings.json, and the settings page reads them back from the database. Factory-mounted agent controllers no longer seed observational memory settings from the host machine's settings.json (new `disableSettingsOmSeed` SDK option), so server sessions start from built-in defaults plus whatever is stored in the database. The OM settings model pickers in the web UI are now searchable comboboxes. ([#19964](https://github.com/mastra-ai/mastra/pull/19964))

  Server embedders that persist memory settings in their own database can opt out of the settings.json seed:

  ```ts
  import { createMastraCode } from '@mastra/code-sdk';

  const mastraCode = await createMastraCode({
    cwd: process.cwd(),
    // Don't seed observer/reflector models or thresholds from the host
    // machine's settings.json — sessions start from built-in defaults.
    disableSettingsOmSeed: true,
  });
  ```

- Move the Linear integration into `@mastra/factory/integrations/linear`. `LinearIntegration` now owns the full connection lifecycle (OAuth token exchange, single-flight refresh, scope checks, and connection caching) as class methods, the routes and agent tools resolve tenants through the `RouteAuth` seam instead of web-host auth imports, and the `getSeededIntegration` runtime-config indirection is gone — the host hands the integration instance and storage handles directly via `initialize()`. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Fixed Factory automation so polled GitHub events reach governance rules, authenticated sessions start with the correct ownership, and board moves reliably notify active or idle agents. ([#19979](https://github.com/mastra-ai/mastra/pull/19979))

- Move the `MastraFactory` assembly root into `@mastra/factory`. `factory-entry.ts` now lives at the package root export (`@mastra/factory`), alongside the extracted `workspace`, `spa-static`, `server-error`, and `sandbox/reattach` helpers. Factory skills ship with the package and are copied into deploy output via the consuming app's build script. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Fixed web chat sessions getting stuck in a "Connection lost — reconnecting…" loop while the session workspace was still starting up ([#20067](https://github.com/mastra-ai/mastra/pull/20067))

- Fixed a server startup crash when the factory's storage backend could not be recognized by the SDK. The factory now tells the SDK explicitly whether its Mastra store is Postgres or LibSQL, so agent state wiring works even when the project's dependency graph contains duplicate copies of Mastra packages. ([#20030](https://github.com/mastra-ai/mastra/pull/20030))

- Updated dependencies [[`a4d7c7d`](https://github.com/mastra-ai/mastra/commit/a4d7c7d74f423efc73b3e4db8142478763e6989d), [`ec857fc`](https://github.com/mastra-ai/mastra/commit/ec857fc79c264b53b38e16478c789b7177f2ad59), [`41a5392`](https://github.com/mastra-ai/mastra/commit/41a5392d9f6c5e18d6b227f0fc0ddf49c50774e9), [`ec857fc`](https://github.com/mastra-ai/mastra/commit/ec857fc79c264b53b38e16478c789b7177f2ad59), [`d7385ad`](https://github.com/mastra-ai/mastra/commit/d7385ad9e88f9e4f33d15c0ec0bfebedde0cbc2e), [`41a5392`](https://github.com/mastra-ai/mastra/commit/41a5392d9f6c5e18d6b227f0fc0ddf49c50774e9), [`3d6e539`](https://github.com/mastra-ai/mastra/commit/3d6e539272eb2ea0407034605ee1906b3be06b39), [`1426af2`](https://github.com/mastra-ai/mastra/commit/1426af24975879c000d13ac75673f630fcc970c1), [`a40adeb`](https://github.com/mastra-ai/mastra/commit/a40adeb222b961a56a58af56a106106525721b74), [`8a0d145`](https://github.com/mastra-ai/mastra/commit/8a0d145aadbdf7278665aceaaec364b35dd9bd94), [`bd2f1d2`](https://github.com/mastra-ai/mastra/commit/bd2f1d274d05e60e2366f005ea0d94d5cea0d5ff), [`b4b7ea8`](https://github.com/mastra-ai/mastra/commit/b4b7ea8733f033fc441ea47ed03f6afb17ec2248), [`d2a51c1`](https://github.com/mastra-ai/mastra/commit/d2a51c13c92c22f82bba8b4f48e746a2cc1aecdf), [`e1f2fae`](https://github.com/mastra-ai/mastra/commit/e1f2faebaf048c3d4c2e2c01d293767c195d5794), [`63aa799`](https://github.com/mastra-ai/mastra/commit/63aa799c6b44eacc7806cda6846b7c5bbee06b37), [`b7e79c3`](https://github.com/mastra-ai/mastra/commit/b7e79c3c02ac5cd415db34ba0975ceafc1464333), [`675fbff`](https://github.com/mastra-ai/mastra/commit/675fbff84d3274391b33e852f76083c38a5514e5), [`55b6ecd`](https://github.com/mastra-ai/mastra/commit/55b6ecd1083d21d00ea19488e721e451de75e76f), [`dfc7769`](https://github.com/mastra-ai/mastra/commit/dfc77695549e4434873051ddd1f6065330ed5ab8), [`da009e1`](https://github.com/mastra-ai/mastra/commit/da009e1aacd89ed94b8d1b2af09c9d4fe7c4db49), [`3b77e77`](https://github.com/mastra-ai/mastra/commit/3b77e7704936522e4769d29de1b5ea6901f302bd), [`c7d30cd`](https://github.com/mastra-ai/mastra/commit/c7d30cd86009c407df91105591f03cd6e3d2854d), [`21a0eb8`](https://github.com/mastra-ai/mastra/commit/21a0eb86746ba0b703acea360d4f84c6a5a493f2), [`8b20926`](https://github.com/mastra-ai/mastra/commit/8b20926cd59e2ba3d66458e062fa0e6e2ada3e68), [`b4b7ea8`](https://github.com/mastra-ai/mastra/commit/b4b7ea8733f033fc441ea47ed03f6afb17ec2248), [`975295d`](https://github.com/mastra-ai/mastra/commit/975295d418552f0d46a59edfef4c3ee555f9930a), [`73db8db`](https://github.com/mastra-ai/mastra/commit/73db8db90d69ab6153c7942749f624db0d96952d), [`6b1bf3b`](https://github.com/mastra-ai/mastra/commit/6b1bf3b9494bd51aa8f654c68c9355d6046fa2a1), [`35c2181`](https://github.com/mastra-ai/mastra/commit/35c2181e6a50e47c90ba36260db7c9723d54696f), [`0a2c22c`](https://github.com/mastra-ai/mastra/commit/0a2c22c902604439ec490319e14c17f331e0c84c), [`cc656b9`](https://github.com/mastra-ai/mastra/commit/cc656b92cc8fe40af3e2ea8bb796a6b406e96791), [`4cfdd64`](https://github.com/mastra-ai/mastra/commit/4cfdd645794feaea0c4ea711e70ecdfbef0c5b8e), [`232fcbc`](https://github.com/mastra-ai/mastra/commit/232fcbc14fce625dd672ba043329c0b732c62be2), [`b75d749`](https://github.com/mastra-ai/mastra/commit/b75d749621ff5d17e86bcb4ee809d301fb4f7cf3), [`821648b`](https://github.com/mastra-ai/mastra/commit/821648bf2871ef840100c7bacbecf676010bd12a), [`de86fd7`](https://github.com/mastra-ai/mastra/commit/de86fd7119f0438381d1a642e3d258143c0b9c29), [`d2a51c1`](https://github.com/mastra-ai/mastra/commit/d2a51c13c92c22f82bba8b4f48e746a2cc1aecdf), [`2745031`](https://github.com/mastra-ai/mastra/commit/2745031d1d4a4978f037092da371428c32e2842a), [`b4b7ea8`](https://github.com/mastra-ai/mastra/commit/b4b7ea8733f033fc441ea47ed03f6afb17ec2248), [`cc656b9`](https://github.com/mastra-ai/mastra/commit/cc656b92cc8fe40af3e2ea8bb796a6b406e96791), [`ef03fbc`](https://github.com/mastra-ai/mastra/commit/ef03fbcc556bcbc04c9b3d06fab88771ecaa043c), [`3a8024c`](https://github.com/mastra-ai/mastra/commit/3a8024ce615f8aa89479c0d71fe61d10bb0040be), [`bb92559`](https://github.com/mastra-ai/mastra/commit/bb9255954be8323a5ecab7595fe5365c564b3f52), [`35865a5`](https://github.com/mastra-ai/mastra/commit/35865a53e194aa9634d6a70a97010e7a6b9d58b1), [`67dd8b5`](https://github.com/mastra-ai/mastra/commit/67dd8b594d8b87a3a4d4ca7659f57d89fe8312a6), [`f9717e4`](https://github.com/mastra-ai/mastra/commit/f9717e4a381500042d088577347a787b0ec8caff), [`74faf8b`](https://github.com/mastra-ai/mastra/commit/74faf8bd9c1018f2492653c06b1e25fc8300e9e6), [`ef03fbc`](https://github.com/mastra-ai/mastra/commit/ef03fbcc556bcbc04c9b3d06fab88771ecaa043c), [`675fbff`](https://github.com/mastra-ai/mastra/commit/675fbff84d3274391b33e852f76083c38a5514e5), [`70687f7`](https://github.com/mastra-ai/mastra/commit/70687f7e495a322a02070b4a67cb0c77a5ca91ec), [`1fadac4`](https://github.com/mastra-ai/mastra/commit/1fadac44537caeefe81f9f775ae2f2f3d94e9069), [`73db8db`](https://github.com/mastra-ai/mastra/commit/73db8db90d69ab6153c7942749f624db0d96952d), [`76b7181`](https://github.com/mastra-ai/mastra/commit/76b71810366e6d90b9d3973149d1c7ba3659ffb9), [`6341b72`](https://github.com/mastra-ai/mastra/commit/6341b720fa80e65731cbbd7d88d1088f4c5b9914), [`792ec9a`](https://github.com/mastra-ai/mastra/commit/792ec9a0869bab8274cf5e0ed2840738737a1607), [`85e4fb5`](https://github.com/mastra-ai/mastra/commit/85e4fb50087a81c74df3a762f53b56373db0b912), [`712b864`](https://github.com/mastra-ai/mastra/commit/712b864aa1ed12b14c54390ec17b69de163c37f7), [`85e4fb5`](https://github.com/mastra-ai/mastra/commit/85e4fb50087a81c74df3a762f53b56373db0b912), [`9bffb73`](https://github.com/mastra-ai/mastra/commit/9bffb73e9ea46f48b53205b35a69a57f70912c78), [`0c0e8d7`](https://github.com/mastra-ai/mastra/commit/0c0e8d7becd4d1445c656b78d5d845f606c1ff9d), [`a7bbe77`](https://github.com/mastra-ai/mastra/commit/a7bbe773577f60bc4761b534ef7ec6b476332dad), [`eec6a54`](https://github.com/mastra-ai/mastra/commit/eec6a54c64cd365c9b75c14a02e32122ad5f657c), [`72e437c`](https://github.com/mastra-ai/mastra/commit/72e437c515942c80b9def5b026e0bdee61b469d9), [`8f7a5de`](https://github.com/mastra-ai/mastra/commit/8f7a5dedc246cdc938bb65516703cf9b27b03756), [`a7bbe77`](https://github.com/mastra-ai/mastra/commit/a7bbe773577f60bc4761b534ef7ec6b476332dad), [`11f6cd9`](https://github.com/mastra-ai/mastra/commit/11f6cd96fe42582403416608beb212cc1a2cc79e), [`337d41d`](https://github.com/mastra-ai/mastra/commit/337d41d8aae0399d2bf42d42ebddac0c21953891), [`ef03c0c`](https://github.com/mastra-ai/mastra/commit/ef03c0cfc62367a458e4cc56462e2148b35681c5), [`4fb4d88`](https://github.com/mastra-ai/mastra/commit/4fb4d881bc107acee13890ad4d78661016c510ed), [`da009e1`](https://github.com/mastra-ai/mastra/commit/da009e1aacd89ed94b8d1b2af09c9d4fe7c4db49), [`4e68363`](https://github.com/mastra-ai/mastra/commit/4e683634f94ebd062d26a3bb6093a8dfc7263d37), [`c328769`](https://github.com/mastra-ai/mastra/commit/c3287698ff8ef98dba86d415faa566fa3e5f4d56), [`eec6a54`](https://github.com/mastra-ai/mastra/commit/eec6a54c64cd365c9b75c14a02e32122ad5f657c), [`d7f5f9e`](https://github.com/mastra-ai/mastra/commit/d7f5f9e5d76ed588842bce30fac076ec9e3ad98a), [`9f7c67a`](https://github.com/mastra-ai/mastra/commit/9f7c67abeeb52c41c51a9b5edee60b62afe7cd8d), [`c46bb46`](https://github.com/mastra-ai/mastra/commit/c46bb461636ce3a8d45ecd7fc5d4a58803360cd0), [`3b65e68`](https://github.com/mastra-ai/mastra/commit/3b65e68d7f1c771c7a70eea42d83fefdd28cad88), [`4eba27a`](https://github.com/mastra-ai/mastra/commit/4eba27adcf60f991df0e62f94b3e75b4e67f3b4b), [`c701be3`](https://github.com/mastra-ai/mastra/commit/c701be32d7d9aa94a66da8c6cc38dcac6856f464), [`db650ce`](https://github.com/mastra-ai/mastra/commit/db650ce490348914e85b93651d83acdf8f2a4c31), [`232fcbc`](https://github.com/mastra-ai/mastra/commit/232fcbc14fce625dd672ba043329c0b732c62be2), [`6354eeb`](https://github.com/mastra-ai/mastra/commit/6354eeb32efa9f5f68f51dda394e90e2ee76f1fb), [`a8799bb`](https://github.com/mastra-ai/mastra/commit/a8799bb8e44f4a60d01e4e2acd3448ff80bf14f8), [`3d6e539`](https://github.com/mastra-ai/mastra/commit/3d6e539272eb2ea0407034605ee1906b3be06b39), [`e3868e2`](https://github.com/mastra-ai/mastra/commit/e3868e22babfffd0133771669ca724501c2dd58e), [`b06a569`](https://github.com/mastra-ai/mastra/commit/b06a56958d683e45574d2e3806dca42db5fe8a7a), [`9251370`](https://github.com/mastra-ai/mastra/commit/9251370ad413af464aa22d7566338bec5613e8de), [`b87e4ca`](https://github.com/mastra-ai/mastra/commit/b87e4cad9acf70e58c1559da0ca3640d5ae25e6e), [`3491666`](https://github.com/mastra-ai/mastra/commit/34916663c4fdd43b48c21f4ab2d5fb6dcccc94f9), [`c0bec73`](https://github.com/mastra-ai/mastra/commit/c0bec732c93d1a22ae5e51ed66cf8cacca8bd6a6)]:
  - @mastra/auth-workos@1.6.4
  - @mastra/code-sdk@1.0.0
  - @mastra/core@1.52.0
  - @mastra/auth-studio@1.3.2

## 0.1.0-alpha.10

### Patch Changes

- Factory board now picks up new GitHub/Linear intake automatically (gentle 30s poll) and refreshes work-item positions immediately when the tab regains focus, instead of requiring a manual page reload ([#20071](https://github.com/mastra-ai/mastra/pull/20071))

## 0.1.0-alpha.9

### Patch Changes

- Fixed GitHub PATs saved in Settings not taking effect for the gh CLI in already-running Factory sessions until the server was restarted ([#20069](https://github.com/mastra-ai/mastra/pull/20069))

- Fixed web chat sessions getting stuck in a "Connection lost — reconnecting…" loop while the session workspace was still starting up ([#20067](https://github.com/mastra-ai/mastra/pull/20067))

## 0.1.0-alpha.8

### Minor Changes

- Added autonomous first-pass skills to the Software Factory. Work items now get an automatic investigation, planning, or review pass as soon as they enter the matching board column — no human input needed mid-run: ([#20058](https://github.com/mastra-ai/mastra/pull/20058))

  - **factory-triage** runs when an issue enters triage: it investigates the issue, diagnoses the root cause, and requests a move to planning (or done if the issue should be closed).
  - **factory-plan** runs when an item enters planning: it produces a phased implementation plan and requests a move to execute.
  - **factory-review** runs when a pull request enters review: it reviews the changes, posts a verdict, and requests completion.

  Instead of stopping to ask questions, the skills decide and record each decision as an assumption, batching assumptions and genuinely-human questions into one terminal handoff message. The superseded interactive skills (understand-issue, understand-pr) were removed.

## 0.1.0-alpha.7

### Patch Changes

- Updated dependencies:
  - @mastra/code-sdk@1.0.0-alpha.18

## 0.1.0-alpha.6

### Patch Changes

- The Factory's default `publicUrl` is now `http://localhost:4111` (the Factory server, which serves both the UI and the API) instead of `http://localhost:5173`. Generated Factory projects now run from a single server, so OAuth callback URLs and auth redirects derived from `publicUrl` point at the right origin out of the box. If you serve the SPA from a separate origin (for example a Vite dev server on :5173), set `publicUrl` (or `MASTRACODE_PUBLIC_URL`) explicitly. ([#20036](https://github.com/mastra-ai/mastra/pull/20036))

## 0.1.0-alpha.5

### Patch Changes

- Fixed a server startup crash when the factory's storage backend could not be recognized by the SDK. The factory now tells the SDK explicitly whether its Mastra store is Postgres or LibSQL, so agent state wiring works even when the project's dependency graph contains duplicate copies of Mastra packages. ([#20030](https://github.com/mastra-ai/mastra/pull/20030))

- Updated dependencies [[`b06a569`](https://github.com/mastra-ai/mastra/commit/b06a56958d683e45574d2e3806dca42db5fe8a7a)]:
  - @mastra/code-sdk@1.0.0-alpha.17

## 0.1.0-alpha.4

### Patch Changes

- Moved custom model providers and custom model packs off settings.json in the factory web app: both now live in the app database (org-scoped rows in deployed mode, a sentinel local scope in no-auth mode). Custom providers saved in the web settings page are picked up by model resolution and the model catalog through a new pluggable custom-providers source in the SDK, so the gateway no longer reads the host machine's settings.json for them, and models from your custom providers appear in the web model pickers. ([#19964](https://github.com/mastra-ai/mastra/pull/19964))

  Hosts that store custom providers elsewhere (like the factory's database) register a source at boot; when none is registered, the SDK keeps reading settings.json as before:

  ```ts
  import { setCustomProvidersSource } from '@mastra/code-sdk/agents/custom-provider-source';

  setCustomProvidersSource(tenant => (tenant ? snapshotForOrg(tenant.orgId) : []));
  ```

- Added a memory-settings storage domain: observational memory settings (observer and reflector models, thresholds, attachment observation) changed in the web app are now stored in the app database — one row per user — instead of settings.json, and the settings page reads them back from the database. Factory-mounted agent controllers no longer seed observational memory settings from the host machine's settings.json (new `disableSettingsOmSeed` SDK option), so server sessions start from built-in defaults plus whatever is stored in the database. The OM settings model pickers in the web UI are now searchable comboboxes. ([#19964](https://github.com/mastra-ai/mastra/pull/19964))

  Server embedders that persist memory settings in their own database can opt out of the settings.json seed:

  ```ts
  import { createMastraCode } from '@mastra/code-sdk';

  const mastraCode = await createMastraCode({
    cwd: process.cwd(),
    // Don't seed observer/reflector models or thresholds from the host
    // machine's settings.json — sessions start from built-in defaults.
    disableSettingsOmSeed: true,
  });
  ```

- Updated dependencies [[`eec6a54`](https://github.com/mastra-ai/mastra/commit/eec6a54c64cd365c9b75c14a02e32122ad5f657c), [`eec6a54`](https://github.com/mastra-ai/mastra/commit/eec6a54c64cd365c9b75c14a02e32122ad5f657c)]:
  - @mastra/code-sdk@1.0.0-alpha.16
  - @mastra/core@1.52.0-alpha.13

## 0.1.0-alpha.3

### Patch Changes

- Forwarded closed Platform GitHub event-log deliveries into Factory governance before dispatching repository subscriptions, and kept default GitHub rules from auto-starting issues or pull requests created before the Factory. ([#19988](https://github.com/mastra-ai/mastra/pull/19988))

- Deployed factories now authenticate API and Studio requests with the same provider, so Studio sessions work without extra configuration. ([#19966](https://github.com/mastra-ai/mastra/pull/19966))

- Fixed cloned session threads reading from a previous storage instance. The dynamic memory cache now invalidates when the storage or vector instance changes, so thread cloning always uses the current database. ([#19966](https://github.com/mastra-ai/mastra/pull/19966))

- Updated dependencies [[`cc656b9`](https://github.com/mastra-ai/mastra/commit/cc656b92cc8fe40af3e2ea8bb796a6b406e96791), [`cc656b9`](https://github.com/mastra-ai/mastra/commit/cc656b92cc8fe40af3e2ea8bb796a6b406e96791), [`337d41d`](https://github.com/mastra-ai/mastra/commit/337d41d8aae0399d2bf42d42ebddac0c21953891)]:
  - @mastra/code-sdk@1.0.0-alpha.15

## 0.1.0-alpha.2

### Patch Changes

- Fixed Factory metrics windowing to use inclusive UTC calendar days. Date-only `from`/`to` bounds now include both selected days, an item completing at the current instant is counted in today's throughput (previously it could be dropped on the window's exclusive edge), and `windowDays` reflects the number of gap-filled day buckets. Cards feed the source mix only when created inside the window. ([#19971](https://github.com/mastra-ai/mastra/pull/19971))

- Fixed duplicate repositories in Factory source control settings. ([#19971](https://github.com/mastra-ai/mastra/pull/19971))

- Fixed Factory automation so polled GitHub events reach governance rules, authenticated sessions start with the correct ownership, and board moves reliably notify active or idle agents. ([#19979](https://github.com/mastra-ai/mastra/pull/19979))

## 0.1.0-alpha.1

### Minor Changes

- Move the Factory project CRUD and source-control connection routes into `@mastra/factory` as a `ProjectRoutes` class. The routes take their storage handles (`FactoryProjectsStorage`, `SourceControlStorage`), the allowed version-control integration ids, and a `RouteAuth` adapter at construction time, replacing the old `ProjectDomain` that resolved domains through the `FactoryStorage` registry. The now-unused `FactoryDomain` base class was removed from the web host. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Move the audit domain, agent git-action auditing, intake capabilities, and intake routes into `@mastra/factory`. `AuditDomain` now takes its storage handles (`AuditStorage`, `FactoryProjectsStorage`) and a `RouteAuth` adapter directly instead of resolving them through the factory storage registry, fans out to pluggable `AuditSink`s, and resolves agent tenants through an injected `agentTenant` callback. Intake routes ship as an `IntakeRoutes` class that calls `IntakeStorage` directly (the intermediate intake store module was removed). ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Move the `FactoryIntegration` contract and the OAuth `state` signer into `@mastra/factory`. The integration interface (routes, tools, diagnostics, intake/version-control capabilities, `IntegrationContext`) now lives at `@mastra/factory/integrations/base`, and `createStateSigner`/`StateSigner` at `@mastra/factory/state-signing`, so integrations can be implemented against the package without importing the web host. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Added the @mastra/factory package. It now owns the Software Factory storage domains (projects, work items, intake, audit, credentials, integrations, model packs, queue health, source control) that previously lived inside the mastracode web app, so they can be reused outside the web server. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Moved the server config routes and provider credential helpers into @mastra/factory as a reusable ConfigRoutes class. Route handlers now receive their auth checks through an injected RouteAuth seam and storage domains through constructor options, so hosts other than the Mastra Code web app can mount the same routes. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Move the Factory work-item (kanban board) routes into `@mastra/factory` as a `WorkItemRoutes` class. The routes take their storage handles (`WorkItemsStorage`, `FactoryProjectsStorage`, `QueueHealthStorage`), an `AuditEmitter`, and a `RouteAuth` adapter at construction time. The request-body validators (`parseCreateWorkItem`, `parseUpdateWorkItem`) now live with the routes, the pass-through work-item store module was removed in favor of calling `WorkItemsStorage` directly, and `computeFactoryMetrics` takes a single object parameter. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

### Patch Changes

- Move the WorkOS audit integration into `@mastra/factory/integrations/workos`. Its Admin Portal route now resolves the caller through the `RouteAuth` seam on `IntegrationContext` instead of web-host auth helpers, and `@mastra/auth-workos` becomes a package dependency. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Move the factory auth module into `@mastra/factory/auth`. The provider-neutral ([#19866](https://github.com/mastra-ai/mastra/pull/19866))
  auth gating (`mountFactoryAuth`, `buildAuthRoutes`, `createFactoryAuthGate`),
  the `RouteAuth` implementation (`createFactoryRouteAuth`), and the WorkOS/SSO
  helpers now live next to the route seam they implement, with factory naming
  throughout.

- Track per-stage automation in Factory metrics. Stage history now stamps the exiting actor (`exitedBy`) alongside the entering one, `isAutomationActor` classifies rules-engine, agent (`agent:*`), and webhook (`github:*`) actors as automation, and `computeFactoryMetrics` reports a `stageAutomation` breakdown per stage: how many passes were fully automated (entered and exited by automation on the first visit) and how those automated passes ended up (`done`, `canceled`, `reworked`, or still in flight). Adds the `canceled` terminal stage to the board vocabulary (`FACTORY_RULE_STAGES`) — a tracked non-completion that feeds neither throughput nor cycle time — and rewords organization-required errors to be auth-provider neutral. ([#19844](https://github.com/mastra-ai/mastra/pull/19844))

- Fixed @mastra/factory build output so published modules use explicit .js import extensions and resolve correctly under Node ESM ([#19954](https://github.com/mastra-ai/mastra/pull/19954))

- Move the API-surface assembler from mastracode/web into @mastra/factory as `routes/surface` — `assembleWebApiRoutes` is now `assembleFactoryApiRoutes` and `WebApiRoutesDeps` is now `FactoryApiRoutesDeps`. The module composes fs/config/oauth/skills/intake/work-item routes plus every registered integration's route surface (with disabled-status stubs for absent github/linear integrations) from explicitly threaded dependency handles. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Move the GitHub integration and the sandbox fleet into `@mastra/factory`. The fleet is now a DI-constructed `SandboxFleet` class (`@mastra/factory/sandbox/fleet`) that owns provisioning, reattach, teardown, idle windows, and per-replica budgets instead of reading a seeded runtime-config registry. The GitHub routes, webhook, sandbox materialization, project locks, and session subscriptions (`@mastra/factory/integrations/github`) resolve tenants through the `RouteAuth` seam and receive the fleet and factory storage via `IntegrationContext`, so the web host no longer exports `getSeededSandbox`/`getSeededGithubIntegration` service locators. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Move the filesystem routes (`@mastra/factory/routes/fs`) and skill routes (`@mastra/factory/routes/skills`) into `@mastra/factory`. The skill prepare/invoke routes are now a `SkillRoutes` class that resolves users and tenants through the `RouteAuth` seam instead of web-host auth helpers. Diagnostics fields exposed by the GitHub and Linear integrations rename `webAuthEnabled` to `factoryAuthEnabled` to match the package's auth seam naming. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Move the Linear integration into `@mastra/factory/integrations/linear`. `LinearIntegration` now owns the full connection lifecycle (OAuth token exchange, single-flight refresh, scope checks, and connection caching) as class methods, the routes and agent tools resolve tenants through the `RouteAuth` seam instead of web-host auth imports, and the `getSeededIntegration` runtime-config indirection is gone — the host hands the integration instance and storage handles directly via `initialize()`. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Move the `MastraFactory` assembly root into `@mastra/factory`. `factory-entry.ts` now lives at the package root export (`@mastra/factory`), alongside the extracted `workspace`, `spa-static`, `server-error`, and `sandbox/reattach` helpers. Factory skills ship with the package and are copied into deploy output via the consuming app's build script. ([#19866](https://github.com/mastra-ai/mastra/pull/19866))

- Updated dependencies [[`a4d7c7d`](https://github.com/mastra-ai/mastra/commit/a4d7c7d74f423efc73b3e4db8142478763e6989d), [`d7385ad`](https://github.com/mastra-ai/mastra/commit/d7385ad9e88f9e4f33d15c0ec0bfebedde0cbc2e), [`3d6e539`](https://github.com/mastra-ai/mastra/commit/3d6e539272eb2ea0407034605ee1906b3be06b39), [`35865a5`](https://github.com/mastra-ai/mastra/commit/35865a53e194aa9634d6a70a97010e7a6b9d58b1), [`70687f7`](https://github.com/mastra-ai/mastra/commit/70687f7e495a322a02070b4a67cb0c77a5ca91ec), [`9bffb73`](https://github.com/mastra-ai/mastra/commit/9bffb73e9ea46f48b53205b35a69a57f70912c78), [`3d6e539`](https://github.com/mastra-ai/mastra/commit/3d6e539272eb2ea0407034605ee1906b3be06b39), [`b87e4ca`](https://github.com/mastra-ai/mastra/commit/b87e4cad9acf70e58c1559da0ca3640d5ae25e6e)]:
  - @mastra/auth-workos@1.6.4-alpha.1
  - @mastra/core@1.52.0-alpha.12
  - @mastra/code-sdk@1.0.0-alpha.14
  - @mastra/auth-studio@1.3.2-alpha.1
