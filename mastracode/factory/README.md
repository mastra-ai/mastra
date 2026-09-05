# @mastra/factory

`@mastra/factory` is the reusable backend for Mastra Software Factory. It owns Factory storage domains, routes, rules, integrations, sandboxes, and Factory-specific agent behavior.

Put React code in [`factory-ui`](../factory-ui/README.md), host wiring in [`web`](../web/README.md), and shared agent-controller behavior in [`sdk`](../sdk/README.md).

## Installation

```bash
npm install @mastra/factory
```

## Usage

Provide a configured `FactoryStorage` backend.

```typescript
import { MastraFactory } from '@mastra/factory';
import type { MastraFactoryConfig } from '@mastra/factory';

export function createFactory(storage: MastraFactoryConfig['storage']) {
  return new MastraFactory({ storage });
}
```

## Documentation

A host application calls `MastraFactory.prepare()`, constructs its `Mastra` instance, and then calls `MastraFactory.finalize()`. The `new Mastra(...)` expression must remain in the host entry file so Mastra's deployer can detect and bundle it. The implementation in `mastracode/web/src/mastra/index.ts` is the canonical host example.

`prepare()` initializes the Factory-owned resources needed before Mastra is constructed. `finalize()` connects those resources to the completed host, including Factory routes, integrations, storage-backed behavior, and agent-controller features. Consumers should keep frontend concerns in `factory-ui` and host-specific environment or deployment wiring in `web` rather than adding them to this package.

### Board lifecycle rules

Installed board definitions exclusively own phase entry and exit handlers. Work and Review are installed automatically with Mastra's preferred defaults; no rule configuration is needed. Custom boards declare source-specific `onEnter` and `onExit` handlers through `defineBoard()`:

```typescript
import { MastraFactory } from '@mastra/factory';
import type { MastraFactoryConfig } from '@mastra/factory';
import { defineBoard } from '@mastra/factory/boards';

const releaseBoard = defineBoard({
  id: 'release',
  title: 'Release',
  initialPhase: 'queued',
  phases: {
    queued: { title: 'Queued', next: 'shipped' },
    shipped: {
      title: 'Shipped',
      onEnter: {
        manual: () => ({ type: 'reject', code: 'release_held', reason: 'Release is held.' }),
      },
    },
  },
});

export function createFactory(storage: MastraFactoryConfig['storage']) {
  return new MastraFactory({ storage, boards: [releaseBoard] });
}
```

Handlers return one typed decision or `undefined`. Supported sources are `issue`, `pullRequest`, `linearIssue`, and `manual`. Each Factory instance resolves handlers from its installed definitions. To install only custom boards, set `includeDefaultBoards: false`. The IDs `work` and `review` remain reserved; they cannot be used to replace the built-ins.

**Preferred intake behavior:** Work automatically invokes `factory-triage` only for linked-item materialization with `autoStartCandidate: true`. GitHub stamps that eligibility using actor trust and issue creation timing. Manual entry and noncandidate arrivals do not automatically start an investigation just because they enter Intake. Explicit issue triage remains available, and existing human-approval safeguards remain in effect. Linear intake does not automatically investigate; entering Triage invokes its existing investigation behavior. Review retains its guarded automatic first pass and explicit review behavior.

**Migration:** Remove former global `rules.work` and `rules.review` configuration. Built-in customization is deferred; there is no built-in override or replacement API. Define custom-board handlers on their phases instead. The web deployment now uses the guarded Work default rather than its former unconditional intake handler, so noncandidate or manual arrivals no longer start merely from entering Intake.

Global rules now contain only the shared audit `version` and tool-result handlers:

```typescript
import { defaultFactoryRules } from '@mastra/factory/rules/defaults';

const rules = defaultFactoryRules({ version: 'deployment-v2' });
// Pass rules to MastraFactory. Optional tool overrides remain under overrides.tools.
```

### GitHub event rules

Both `GithubIntegration` and `PlatformGithubIntegration` own their GitHub event handlers. Existing installations retain the defaults without additional configuration.

```typescript
import { PlatformGithubIntegration } from '@mastra/factory/integrations/platform/github/integration';

const github = new PlatformGithubIntegration({
  rules: {
    issueOpened: context => ({
      type: 'reject',
      code: 'manual_intake',
      reason: 'This deployment manages issue intake manually.',
    }),
    issueCommentCreated: null,
  },
});
```

Pass the integration in `MastraFactory`'s `integrations` array. The direct `GithubIntegration` accepts the same `rules` option alongside its GitHub App credentials. A function replaces one default handler without composing with it. `null` disables that event's handler, not authentication, webhook ingestion, or reconciliation bookkeeping. Omitted events and `undefined` retain their defaults. Each instance copies and freezes its resolved handler map; unknown event names and invalid handler values are rejected during construction.

**Migration:** Move each global `rules.github[event].onEvent` value to the integration constructor's `rules[event]` option:

```typescript
// Before: global Factory rule overrides
const overrides = { github: { issueCommentCreated: { onEvent: null } } };

// After: GitHub integration constructor options
const github = new PlatformGithubIntegration({ rules: { issueCommentCreated: null } });
```

Board definitions own lifecycle handlers; only tool-result configuration remains global. The global rule version remains shared audit metadata, including for GitHub evaluations; it is not a hash of custom handler code and does not change delivery replay semantics. Update the deployment-owned version when changing handler behavior.

Handlers receive the existing typed GitHub context and return one decision or `undefined`. External titles, bodies, and comments remain untrusted data after webhook authentication. Custom handlers must preserve any required actor-permission checks explicitly.

### Linear event rules

Both `LinearIntegration` and `PlatformLinearIntegration` automatically install the built-in `issueObserved` and `issueClosed` handlers. No default-rule imports or configuration are needed, including for `new PlatformLinearIntegration()` or direct construction with credentials only.

```typescript
import { PlatformLinearIntegration } from '@mastra/factory/integrations/platform/linear/integration';

const linear = new PlatformLinearIntegration({
  rules: {
    issueObserved: context => ({
      type: 'reject',
      code: 'manual_intake',
      reason: 'This deployment manages issue intake manually.',
    }),
    issueClosed: null,
  },
});
```

Install `linear` in `MastraFactory`'s `integrations` array. The direct `LinearIntegration` accepts the same `rules` option alongside `clientId` and `clientSecret`. A function replaces one default handler without composition; `null` disables that handler, not issue ingestion or reconciliation bookkeeping. Omitted events and `undefined` retain defaults. Both constructors validate event names and handler values, then copy and freeze an isolated resolved map.

**Migration:** Move global `rules.linear[event].onEvent` values into the owning integration constructor's `rules[event]` option:

```typescript
// Before: global Factory rule overrides
const overrides = { linear: { issueClosed: { onEvent: null } } };

// After: Linear integration constructor options
const linear = new PlatformLinearIntegration({ rules: { issueClosed: null } });
```

Linear event handlers are configured exclusively on the integration. Fetched issues, platform polling, and issue reconciliation use that instance's handlers. Defaults create intake items for observed open issues and close linked non-terminal Work items as Done or Canceled; closed unlinked issues do not create new items. Custom handlers receive the existing typed Linear context and return one decision or `undefined`. Treat issue titles, descriptions, and other external content as untrusted data.

The global rule version remains shared audit metadata for Linear evaluations. Update the deployment-owned version when handler behavior changes; it does not change ingress identity or replay semantics.

### GitHub review commands

A repository maintainer with write or admin access can start a Factory review from a pull-request comment by posting the exact first-line command:

```text
@<factory-app> review
```

`@<factory-app> re-review` is also accepted. Factory resolves `<factory-app>` from its observed or configured GitHub App login (without the `[bot]` suffix), so commands are ignored until that identity is known. The command creates and starts a first Review pass for a missing or Intake card, restarts a completed card with `factory-rereview`, and is a no-op while the card is already Reviewing. Other prose, quoted mentions, edited comments, and comments from untrusted users do not trigger a run.

### Development

Run focused package checks from the repository root:

```bash
pnpm --filter ./mastracode/factory test
pnpm --filter ./mastracode/factory check
pnpm --filter ./mastracode/factory lint
pnpm --filter ./mastracode/factory build:lib
pnpm --filter ./mastracode/factory smoke:dist
```

Tests are colocated with source as `*.test.ts`. Use `smoke:dist` after building to verify that the published entry point can be imported successfully.

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/mastracode/factory/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
