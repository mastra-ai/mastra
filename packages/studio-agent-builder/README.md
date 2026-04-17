# @mastra/studio-agent-builder

> **Enterprise Edition.** Requires a valid `MASTRA_EE_LICENSE` in production.
> See [`LICENSE.md`](./LICENSE.md).

Mastra Studio Agent Builder — the end-user facing UI inside Mastra Studio for
creating, sharing, and discovering stored (dynamic, DB-driven) agents and
skills.

This package is the configuration surface that admins attach to the `Mastra`
class to opt in. All UI lives inside Mastra Studio (`@mastra/playground`) and
turns on automatically when the server boots with a valid license and this
package configured.

## Installation

```sh
pnpm add @mastra/studio-agent-builder
```

## Wiring

```ts
import { Mastra } from '@mastra/core';
import { MastraAgentBuilder } from '@mastra/studio-agent-builder';

export const mastra = new Mastra({
  agentBuilder: new MastraAgentBuilder({
    enabledSections: ['tools', 'memory', 'skills'],
    marketplace: { enabled: true, showAgents: true, showSkills: true },
    configure: { allowSkillCreation: true, allowAppearance: true },
    recents: { maxItems: 5 },
  }),
});
```

## Licensing

The server will refuse to start in production if `agentBuilder` is configured
but no valid `MASTRA_EE_LICENSE` is present — the behavior mirrors RBAC exactly.

Set the environment variable before booting:

```sh
export MASTRA_EE_LICENSE="your-license-key"
```
