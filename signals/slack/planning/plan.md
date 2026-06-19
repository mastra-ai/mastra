# Slack Signals Implementation Plan

## Working Rules

- Each phase should land as one or more discrete commits.
- Before starting a new phase, the working tree should have no lingering uncommitted changes.
- Keep each phase independently reviewable and verifiable.
- Prefer narrow tests from the affected package; do not run broad monorepo builds unless narrow checks cannot prove the change.
- Do not copy reference implementation code. Use references for architecture and API behavior only.

## Phase 0 — Planning Artifacts

### Build

Create planning docs that capture:

- Product vision.
- Current understanding of Mastra signals, Slack channel provider boundaries, and Slack API constraints.
- Reference repository findings.
- Phased implementation plan.

### Verification

- Read all planning docs for consistency.
- Confirm they cover subscribe/unsubscribe, workspace-wide watch semantics, phased verification, tests, and commit hygiene.

### Tests

- No automated tests required; documentation-only phase.

### Commit Guidance

- One commit is enough, e.g. `docs: plan slack signal provider`.

## Phase 1 — Package Scaffold and Public API

### Build

Create a new `signals/slack` package modeled after `signals/github`:

- `package.json` with package name, scripts, exports, peer dependencies, and metadata.
- `tsup.config.ts` / TypeScript config matching nearby package conventions.
- `src/index.ts` exporting:
  - `SlackSignalsProvider`
  - config types
  - subscription/thread metadata types
  - notification payload types
- `CHANGELOG.md` if required by package conventions.

Define the initial API surface without full polling implementation:

```ts
type SlackSignalsProviderConfig = {
  token: string;
  pollIntervalMs?: number;
  include?: {
    publicChannels?: boolean;
    privateChannels?: boolean;
    dms?: boolean;
    groupDms?: boolean;
  };
  syncClient?: SlackSignalsSyncClient;
};
```

Default include behavior should match the requested v0 semantics: watch all reachable conversation types.

### Verification

- Package builds successfully.
- Types are exported cleanly.
- No dependency or export mismatch.

### Tests

- Add minimal unit tests for constructor defaults and exported constants/types where practical.
- Run:
  - `pnpm --filter ./signals/slack test -- --bail 1 --reporter=dot`
  - `pnpm --filter ./signals/slack build`

### Commit Guidance

- One scaffold commit is enough if clean.
- If package setup and API design grow large, split into:
  1. package scaffold
  2. public provider/type surface

## Phase 2 — Subscription and Unsubscription Flow

### Build

Implement subscribe/unsubscribe behavior using Mastra signal provider conventions:

- Add input processors for subscribe/unsubscribe tags or signal inputs.
- Add tools for explicit subscription management if consistent with GitHub signals.
- Store Slack signal state in thread metadata under a dedicated key, likely `slackSignals`.
- Represent one workspace-wide subscription per thread.
- On subscribe, identify the workspace through the sync client (`auth.test` in the real client later).
- On unsubscribe, remove subscription state for the thread.
- Make subscribe idempotent.
- Make unsubscribe idempotent.

No message polling is required in this phase beyond any minimal workspace identity lookup.

### Verification

- Subscribe creates the expected metadata.
- Re-subscribing updates or preserves the existing subscription without duplicates.
- Unsubscribe removes the subscription.
- Unsubscribing when not subscribed is safe.

### Tests

Unit tests with a mock sync client:

- subscribe stores metadata
- subscribe is idempotent
- unsubscribe removes metadata
- unsubscribe handles missing subscription
- processor/tool result text is useful to the agent

Run:

- `pnpm --filter ./signals/slack test -- --bail 1 --reporter=dot`
- `pnpm --filter ./signals/slack build`

### Commit Guidance

- Prefer one commit for subscribe/unsubscribe flow.
- If tools and processors are both substantial, split them into separate commits while keeping each passing tests.

## Phase 3 — Slack Web API Sync Client

### Build

Add a real Slack Web API client behind a mockable interface.

Suggested interface:

```ts
type SlackSignalsSyncClient = {
  getWorkspace(): Promise<SlackSignalsWorkspace>;
  listConversations(input: SlackListConversationsInput): Promise<SlackListConversationsResult>;
  listMessages(input: SlackListMessagesInput): Promise<SlackListMessagesResult>;
};
```

Implementation details:

- Use official Slack Web API over `fetch` or an existing lightweight dependency if package conventions allow.
- Call `auth.test` for team/workspace identity.
- Call `conversations.list` with configured channel types.
- Call `conversations.history` with `oldest` from the durable per-channel `latestTs` high-water mark.
- Preserve Slack timestamp strings exactly.
- Handle Slack cursor pagination with `response_metadata.next_cursor` while draining each `conversations.list` or `conversations.history` query.
- Do not persist Slack `next_cursor` values as subscription state; they are transient page tokens, not durable sync cursors.
- Return the maximum message timestamp seen by `listMessages` so the provider can advance `latestTs` only after successful processing.
- Handle `429` with `Retry-After` and bounded retry.
- Surface Slack API errors as structured sync errors.

### Verification

- Mock HTTP responses prove request shape, pagination, timestamp handling, and rate-limit behavior.
- No real Slack token is required for tests.

### Tests

Unit tests for the sync client:

- workspace identity request
- channel type selection defaults to all reachable types
- conversation pagination using transient `next_cursor`
- history pagination using transient `next_cursor`
- `oldest` timestamp inclusion from durable `latestTs`
- no persistence of Slack `next_cursor` as subscription state
- max message timestamp calculation for `latestTs` advancement
- Slack API error handling
- 429 retry-after behavior if implemented in this phase

Add a small integration test against the Slack emulator if adding `emulate` as a dev dependency is acceptable for the package:

- start `createEmulator({ service: 'slack', seed })`
- point the sync client base URL at `${emulator.url}/api/`
- verify `auth.test`, `conversations.list`, `chat.postMessage`, and `conversations.history` round trip through real HTTP

Note: current emulate `conversations.history` supports cursor pagination but not Slack `oldest`/`latest` filtering. Keep high-water timestamp behavior covered by mock unit tests unless the emulator gains time filtering. The provider should still send `oldest` in emulator integration tests so request construction is exercised, but assertions should not depend on emulate filtering old messages out.

Run:

- `pnpm --filter ./signals/slack test -- --bail 1 --reporter=dot`
- `pnpm --filter ./signals/slack build`

### Commit Guidance

- At least one discrete commit for the sync client.
- Consider a second commit for retry/rate-limit behavior if it adds complexity.

## Phase 4 — Polling, High-Water State, and Notification Emission

### Build

Implement provider polling for active Slack subscriptions:

- Discover reachable conversations each poll or on a bounded refresh cadence.
- Track per-channel durable state in thread metadata, especially `latestTs`.
- Fetch only messages newer than the channel's latest known timestamp by passing `oldest: latestTs` and `inclusive: false` to `conversations.history`.
- Use Slack `next_cursor` only inside the current list/history request loop to drain additional pages.
- Dedupe by `${teamId}:${channelId}:${messageTs}`.
- Emit Mastra notifications for new messages.
- Advance `latestTs` only after successful processing, using the maximum processed message timestamp for that channel.
- Store sync status/errors in metadata.
- Bound work per polling cycle to avoid high-volume workspaces causing runaway API usage.

Suggested notification shape:

- `source`: `slack`
- `kind`: `slack-message`
- `priority`: likely `medium` for DMs/mentions and `low` for generic channel messages, or keep all `medium` initially if priority rules are not ready.
- `sourceId` / `dedupeKey`: `${teamId}:${channelId}:${messageTs}`
- `coalesceKey`: `${teamId}:${channelId}`
- payload includes team, channel, message, user, ts, thread ts, permalink when available.

### Verification

- Polling with mock sync client emits expected notification inputs.
- `latestTs` advances after successful notification processing.
- Re-running the same poll does not emit duplicates.
- Failed channel sync does not advance that channel's `latestTs`.
- Slack `next_cursor` is never written into thread metadata.
- One failing channel does not necessarily prevent other channels from syncing, if implemented that way.

### Tests

Unit tests:

- no subscriptions means no sync work
- subscribed thread syncs all included channel types
- new messages emit notifications
- old messages are ignored after `latestTs` advances
- `next_cursor` is used to fetch additional pages but is not persisted
- dedupe keys are stable
- metadata records successful sync
- sync errors are persisted in metadata
- bounded work behavior, if configured

Run:

- `pnpm --filter ./signals/slack test -- --bail 1 --reporter=dot`
- `pnpm --filter ./signals/slack build`

### Commit Guidance

- Split into at least two commits if needed:
  1. polling/high-water metadata
  2. notification emission/dedupe behavior

## Phase 5 — Filtering and Priority Rules

### Build

Add configurable filtering and priority behavior after baseline polling works:

- Include/exclude channel IDs or names.
- Optional keyword matching.
- DM/group-DM priority defaults.
- Mention detection if bot/user identity is known.
- Ignore bot messages or selected bot users by default/config.
- Optional max message preview length.

Keep filtering deterministic and easy to unit test.

### Verification

- Filters only affect notification emission, not necessarily conversation discovery.
- `latestTs` advancement remains correct when messages are filtered out.
- Priority rules are predictable and documented in types/tests.

### Tests

Unit tests:

- include channels
- exclude channels
- keyword allowlist
- bot ignore list
- DM priority
- filtered messages do not emit notifications
- filtered messages still allow `latestTs` to advance when appropriate

Run:

- `pnpm --filter ./signals/slack test -- --bail 1 --reporter=dot`
- `pnpm --filter ./signals/slack build`

### Commit Guidance

- One or more commits depending on filter count.
- Prefer separate commits for channel filters and content/priority filters.

## Phase 6 — Documentation and Integration Guidance

### Build

Add user-facing docs once the API is stable:

- Package README or docs page covering installation, config, token scopes, subscribe/unsubscribe, and limitations.
- Token capability matrix for bot vs user token behavior.
- Safety/rate-limit guidance.
- Example code using placeholder model tokens if examples/tests require model IDs.

Follow docs package instructions if editing `docs/`.

### Verification

- Docs match implemented API.
- All code snippets typecheck mentally or through an appropriate docs/snippet test if available.
- No promises about unsupported session scraping or historical archive import.

### Tests

- Package tests/build remain green:
  - `pnpm --filter ./signals/slack test -- --bail 1 --reporter=dot`
  - `pnpm --filter ./signals/slack build`
- If docs tooling is touched, run the narrowest relevant docs check available.

### Commit Guidance

- Separate docs commit from implementation commits unless docs are tiny and tied to the same API change.

## Phase 7 — Emulate Integration and Optional Manual Smoke Test

### Build

Add a narrow integration test layer using the Slack emulator from `/Users/tylerbarnes/code/vercel-labs/emulate` or the published `emulate` package:

- Start `createEmulator({ service: 'slack', seed })` in Vitest.
- Seed a workspace with users, public channels, private channels, DMs/MPIMs if needed, and a token with the scopes being tested.
- Point the Slack sync client at `${emulator.url}/api/`.
- Use `chat.postMessage` to create deterministic channel and DM messages.
- Run the provider poll path and assert Mastra notifications are emitted.
- Reset or close the emulator between tests.

Keep mock sync-client tests as the primary coverage for edge cases. Use emulate to prove the real HTTP client works against a stateful Slack-like API.

Optionally create a small local Mastra project or fixture that wires `SlackSignalsProvider` into an agent with a real Slack token supplied by the developer environment.

Manual smoke flow:

1. Start agent with Slack signals provider.
2. Subscribe current thread to Slack.
3. Send a Slack DM or test channel message.
4. Wait for polling.
5. Confirm notification record appears in the inbox.
6. Unsubscribe and confirm polling stops for that thread.

### Verification

- Emulated Slack behavior matches mocked tests for auth, discovery, posting, history reads, and notification emission.
- Real Slack workspace behavior matches mocked/emulated tests if manual smoke is run.
- Token scope errors are understandable.
- No unexpected historical flood occurs on first subscribe.

### Tests

- Automated emulate integration tests:
  - auth and workspace identity
  - channel discovery across selected conversation types
  - message creation plus history readback
  - provider poll emits notification for new emulated message
  - strict-scope failure path, if strict scopes are enabled in seed config
- Manual Slack smoke only if a safe Slack test workspace/token exists.
- Keep broad edge-case coverage mocked and deterministic.

### Commit Guidance

- Prefer a separate commit for adding emulate-based integration tests.
- Do not commit real tokens, `.env` files, or workspace-specific fixtures.
- Commit only reusable smoke docs/scripts if they are safe and generic.

## Release Readiness Checklist

Before opening a PR or asking for review:

- Working tree is clean except intended final changes.
- Each phase completed in one or more discrete commits.
- No new phase started with lingering uncommitted changes from the prior phase.
- Narrow package tests pass.
- Package build passes.
- Changeset added if the package is publishable or package behavior changed.
- Docs updated if the package is exposed to users.
- No reference code copied or vendored.
- No secrets committed.

## Outcome

At the end of this plan, we get a new **Slack Signals provider package** that lets a Mastra agent subscribe a thread to Slack activity and receive Slack messages as durable Mastra notification signals.

Concretely:

- New package: likely `signals/slack`
- Public API: `SlackSignalsProvider`
- Agent wiring:

```ts
const slackSignals = new SlackSignalsProvider({
  token: process.env.SLACK_BOT_TOKEN!,
});

const agent = new Agent({
  // ...
  signals: [slackSignals],
});
```

- User-facing behavior:
  - “Subscribe to Slack” starts watching Slack for the current thread.
  - “Unsubscribe from Slack” stops watching.
  - Subscribed means: watch all reachable DMs, group DMs, public channels, and private channels the token can access.
  - New watched Slack messages become Mastra notification records.
  - Pending Slack notifications can be read through the existing notification inbox tooling.

- Sync behavior:
  - Uses official Slack Web API.
  - Discovers conversations with `conversations.list`.
  - Polls messages with `conversations.history`.
  - Stores per-channel `latestTs` high-water timestamps.
  - Uses Slack `next_cursor` only for transient page pagination.
  - Avoids historical flood by not treating Slack cursor pagination as durable state.
  - Dedupes notifications by `teamId:channelId:messageTs`.

- Testing/proof:
  - Unit tests for subscribe/unsubscribe, sync client, polling, dedupe, cursor/high-water behavior, filtering, and priority rules.
  - Optional/narrow integration tests against `emulate` Slack to prove real HTTP Slack-shaped flows without hitting Slack.
  - Build/test checks per phase.

- Docs:
  - Token scope/capability guidance.
  - Bot vs user token limitations.
  - Subscribe/unsubscribe behavior.
  - Rate-limit/safety notes.
  - Emulator/manual smoke guidance if needed.

Non-outcomes for the first slice:

- No Slack Desktop DB scraping.
- No `xoxc`/`xoxd` session-token scraping.
- No archive import.
- No standalone `slackcrawl` CLI.
- No Slack reply/chat behavior; this is signals only.

So the final outcome is: **Mastra agents can monitor Slack and surface Slack activity through the same notification signal system we already studied for GitHub signals.**
