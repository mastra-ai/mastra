# @mastra/connect smoke test suite

End-to-end smoke tests that exercise every provider's tools against a real Platform project. The runner reads auth and the project id from the environment, resolves tools through the public `tools()` resolver, and dispatches to per-provider scenarios that run a full lifecycle (`create → read → update → delete`) using the available tools — no backdoor cleanup.

## Running the suite

```bash
export MASTRA_PLATFORM_SECRET_KEY=…
export MASTRA_PROJECT_ID=…

# every provider that has a scenario registered
pnpm --filter @mastra/connect smoke-test

# a specific provider (pass --provider multiple times to allow several)
pnpm --filter @mastra/connect smoke-test --provider linear --provider notion

# override the project id for one run
pnpm --filter @mastra/connect smoke-test --project-id prj_abc123
```

Exit code is `0` when every scenario passes or self-skips, `1` when any scenario fails or errors. Skipped scenarios (no scenario registered, provider not attached to the project, or a scenario-level preflight) do not fail the run.

### Optional opt-in environment variables

Some scenarios probe side-effecting endpoints by default and only perform the real operation when explicitly opted in:

| variable                          | effect when set                                                                                                                                                                                                                                                             |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MASTRA_SMOKE_RESEND_RECIPIENT`   | Resend sends real test emails — only ever to this address, from Resend's sandbox sender (`onboarding@resend.dev`, deliverable only to the account owner). Upgrades `send_email`, `send_email_batch`, and the email get/share/attachments/update/cancel tools to real calls. |
| `MASTRA_SMOKE_TWITTER_ALLOW_POST` | `=1` lets the twitter-v2 scenario publish (and then delete) a real tweet.                                                                                                                                                                                                   |
| `MASTRA_SMOKE_TWITTER_USER_ID`    | Numeric user id for authenticated twitter-v2 operations.                                                                                                                                                                                                                    |
| `MASTRA_SMOKE_GA_PROPERTY_ID`     | Real GA4 property (`properties/123456`) for google-analytics report reads instead of synthetic-id probes.                                                                                                                                                                   |

## What the output means

Each provider block is one of:

| badge | meaning                                                   |
| ----- | --------------------------------------------------------- |
| PASS  | every step passed                                         |
| FAIL  | at least one step failed; records may need manual cleanup |
| SKIP  | scenario self-skipped (missing tools, no parent, etc.)    |
| ERR   | the scenario itself threw before producing steps          |

Below each provider the runner prints every step with a `✓` / `✗` / `-` badge and the tool id that step invoked. When a cleanup step fails the scenario also logs an `error`-level line naming the leaked record so an operator can delete it by hand.

## Adding a scenario

1. Create `scenarios/<provider>.ts` exporting a `Scenario` object. Keep the `integrationId` lowercase, matching the platform catalog id (hyphenated: `google-sheet`, not `googleSheet`).
2. Short-circuit with `requireTools(tools, [...])` first — a missing tool should produce a `skip` step, not a thrown error.
3. Pick one representative lifecycle for the provider. Prefer records the connected user owns (test teams, scratch pages, throwaway spreadsheets). Avoid tools that touch other users' data (sending messages, publishing changes externally).
4. Make cleanup unconditional: wrap each post-create step in its own `try/catch` so a failed read or update does not leak the record. If cleanup fails, call `log.error` so the leak is visible and record the step as `fail`.
5. Append your scenario to `scenarios/index.ts` in alphabetical order.

### Scenario sketch

```ts
import type { Scenario, ScenarioStep } from '../scenario.js';
import { requireTools } from '../scenario.js';

export const myProviderScenario: Scenario = {
  integrationId: 'my-provider',
  summary: 'create → read → update → delete record',
  async run({ runId, call, log }) {
    const steps: ScenarioStep[] = [];
    // 1. preflight
    // 2. create (bail here if it fails — nothing to clean up yet)
    // 3. read / update inside try/catch, keep going even if they fail
    // 4. delete inside try/catch, log.error on failure
    return steps;
  },
};
```

### Naming records

Every scenario receives a `runId` like `mastra-smoke-k7fx3`. Embed it in every record title so a concurrent run never collides and any leaked record is visibly tagged.

## Channels suite

`smoke-test:channels` is a sibling suite for the `channels()` resolver — the channel-provider path (Discord, Microsoft Teams, Slack, Telegram) that the tools suite doesn't touch. Channels are addressed by platform integrationId: `discord`, `microsoft-teams`, `slack-channels`, `telegram`. The `microsoft-teams` channel additionally needs `MASTRA_ENCRYPTION_KEY` (32-byte, base64) — its install store persists per-agent bot secrets at rest, and `channels()` warn-and-skips the provider without one.

```bash
# every channel (channels without an active connection are skipped)
pnpm --filter @mastra/connect smoke-test:channels

# one channel
pnpm --filter @mastra/connect smoke-test:channels --channel discord
```

It checks six layers:

- **Resolver contract** — construction guards, route mounting before any connection exists, TTL cache + `refresh()`/`disconnect()`, concurrent resolutions deduped through one inflight build, stale-TTL resolution serving the cached snapshot while a background revalidation lands, `false` exclusion and bogus `connectionId` overrides.
- **Server mount** — the resolver is handed to a real `Mastra` instance; the suite asserts the channel routes land in the merged `server.apiRoutes` with correct `requiresAuth` flags, mounts them the way the production server adapter does (`handler` / `createHandler({ mastra })` onto Hono), and drives every platform's webhook endpoint with real HTTP requests (unknown webhook ids answer 404).
- **Credential flow** — for each connected channel: presence in the resolved map (which proves credential late-binding, e.g. Discord's `sync()` → `configure()`), provider `id`/routes/`getInfo()`, a platform credential fetch, and a vendor whoami call (Discord `GET /users/@me` + `/applications/@me`, Slack `auth.test` with the App Configuration token, Teams Microsoft Graph `GET /me` + a Dev Portal secondary-token presence check, Telegram `getMe`). The whoami calls deliberately bypass the proxy — channel providers call vendor APIs directly with the resolved token, so that direct path is what gets smoked. Each connected channel also fetches its connection context (the platform metadata backing `ChannelRuntime.getConnectionContext()`).
- **Discord full webhook flow** — the one platform where the whole loop is testable without external listeners. The suite overrides the provider's Ed25519 public key with a locally generated pair (`providerOptions.publicKey`), `connect()`s an agent to a guild the bot is already in (`commands: []`, so nothing on the guild is mutated), POSTs a **signed PING interaction** to the mounted route and expects a PONG, POSTs a forged signature and expects 401, POSTs with no signature headers and expects 401, then `disconnect()`s and verifies the installation is gone — the previously valid signed PING now 404s against the dead webhook, and a second `disconnect()` rejects with a clean "no installation" error (the provider contract). The installation lives in in-process channel storage, so nothing persists after the run.
- **Slack manifest lifecycle** — `connect()` runs a real `apps.manifest.create` mint with the App Configuration token the platform's `slack-channels` integration serves ([#25332](https://github.com/mastra-ai/mastra/pull/25332)), expecting a pending OAuth install with an authorization URL, then `disconnect()` deletes the minted app via `apps.manifest.delete` — nothing is left behind in the workspace, and a second `disconnect()` rejects with a clean "no installation" error. The public `/slack/oauth/callback` and `/slack/commands/:webhookId` routes are probed with garbage and must answer controlled 4xx responses. Completing the OAuth install needs a human browser step, so activation — and therefore signed event delivery / `url_verification`, which require an **active** install — stays out of scope.
- **Teams provisioning lifecycle** — `connect()` provisions a real Entra application + client secret (Microsoft Graph) and a Teams Dev Portal bot registration with the scope-aware token resolver, records an **active** installation, and returns a Dev Portal deep link (packaging the bot into a Teams app is a human step, out of scope). `disconnect()` deletes both again; because the provider's remote deletes are best-effort, the suite then proves the Entra application is actually gone (`GET /applications/{id}` → 404). The provisioned bot's messaging endpoint points at a local placeholder URL and is never called.

Telegram's equivalent flow needs `setWebhook` against the live bot and a reachable public URL — out of scope here; its webhook route is still exercised via the mounted server (unknown-webhook path). Slack event delivery needs a completed OAuth install (pending installations are invisible to the events route by design). The suite sends no messages; everything it registers with a vendor (the Slack app, the Teams Entra app + bot) is deleted in the same run.

## Cross-provider cleanup

Scenarios see their own provider's tools in `tools` and the full project toolset in `allTools`. Use `allTools` when another provider owns the delete endpoint (e.g. `google_drive_delete_file` cleans up a sheet created by `google-sheet`). Prefer `tools` for everything else.

## What this suite is not

- **Not a correctness test.** Scenarios check round-trip shape (does the create return an id? does the read see the update?) but not every provider nuance. Unit tests cover schema contracts.
- **Not exhaustive.** One scenario per provider, exercising the dominant CRUD path. Follow-up scenarios can live beside the primary one in the same file.
- **Not safe against prod data.** Only run against a test project. Scenarios try hard not to touch pre-existing records, but failed cleanups leave records behind and the suite happily rewrites anything it owns.
