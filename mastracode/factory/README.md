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
