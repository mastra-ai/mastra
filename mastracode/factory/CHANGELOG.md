# @mastra/factory

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
