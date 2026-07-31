# @mastra/code-sdk

The agent core behind [Mastra Code](https://mastra.ai) — everything except the terminal UI. Use it to build your own UIs and surfaces (web apps, editors, bots) on top of the Mastra Code coding agent.

The published [`mastracode`](https://www.npmjs.com/package/mastracode) CLI/TUI and the Mastra Code web surface are both built on this SDK.

## Installation

```bash
npm install @mastra/code-sdk
```

## Usage

Mount the Mastra Code agent controller on a Mastra instance:

```ts
import { mountAgentControllerOnMastra } from '@mastra/code-sdk';

// Creates a Mastra instance that hosts the Mastra Code agent controller
// (thread management, modes, tools, memory) and starts its workers.
const { mastra, controller } = await mountAgentControllerOnMastra({
  cwd: process.cwd(),
});
```

To construct the `Mastra` instance yourself (e.g. in a deployable `mastra` entry file), use `prepareAgentControllerMount`:

```ts
import { Mastra } from '@mastra/core/mastra';
import { prepareAgentControllerMount } from '@mastra/code-sdk';

const prepared = await prepareAgentControllerMount({ cwd: process.cwd() });

export const mastra = new Mastra(prepared.mastraArgs);

await prepared.finalize();
```

### Add input processors

Embedding surfaces can prepend stateless input processors without replacing Mastra Code's required policy and compatibility processors:

```ts
const phaseProcessor = {
  id: 'current-phase',
  async processInputStep({ messages }) {
    await reconcileCompletedTools(messages);
  },
};

const prepared = await prepareAgentControllerMount({
  cwd: process.cwd(),
  inputProcessors: [phaseProcessor],
});
```

Configured processors run before Mastra Code's built-in input processors. Keep processor instances stateless because the mounted agent shares them across sessions and runs.

### Plugins

Mastra Code loads plugins from `.mastracode/plugins`. A plugin can contribute tools, commands, skills, system instructions, processors, and signal providers:

```ts
import { defineMastraCodePlugin } from '@mastra/code-sdk/plugin';

export default defineMastraCodePlugin({
  id: 'acme.reviewer',
  processors: { input: [auditLog] },
  signalProviders: [new AcmeSignals()],
});
```

Plugin processors run last among the processors Mastra Code configures, in a slot that is not configurable, and are resolved before every LLM call so enabling or updating a plugin applies on the next request. Signal providers are long-lived, so the SDK owns their lifecycle: it registers Mastra on them, connects them to the coding agent, starts them polling, and stops them when the plugin is updated, disabled, or uninstalled. See the [`defineMastraCodePlugin()` reference](https://mastra.ai/reference/code-sdk/plugin).

Deep modules are available as subpath imports, e.g.:

```ts
import { loadSettings } from '@mastra/code-sdk/onboarding/settings';
```

> The subpath API surface is still evolving and may change between minor releases while the package is pre-1.0.

## License

Apache-2.0
