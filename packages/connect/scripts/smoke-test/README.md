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

## Cross-provider cleanup

Scenarios see their own provider's tools in `tools` and the full project toolset in `allTools`. Use `allTools` when another provider owns the delete endpoint (e.g. `google_drive_delete_file` cleans up a sheet created by `google-sheet`). Prefer `tools` for everything else.

## What this suite is not

- **Not a correctness test.** Scenarios check round-trip shape (does the create return an id? does the read see the update?) but not every provider nuance. Unit tests cover schema contracts.
- **Not exhaustive.** One scenario per provider, exercising the dominant CRUD path. Follow-up scenarios can live beside the primary one in the same file.
- **Not safe against prod data.** Only run against a test project. Scenarios try hard not to touch pre-existing records, but failed cleanups leave records behind and the suite happily rewrites anything it owns.
