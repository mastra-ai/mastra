# @mastra/core

## 1.8.0-alpha.0

### Minor Changes

- Make `queryVector` optional in the `QueryVectorParams` interface to support metadata-only queries. At least one of `queryVector` or `filter` must be provided. Not all vector store backends support metadata-only queries — check your store's documentation for details. ([#13286](https://github.com/mastra-ai/mastra/pull/13286))

  Also fixes documentation where the `query()` parameter was incorrectly named `vector` instead of `queryVector`.

- Added `targetOptions` parameter to `runEvals` that is forwarded directly to `agent.generate()` (modern path) or `workflow.run.start()`. Also added per-item `startOptions` field to `RunEvalsDataItem` for per-item workflow options like `initialState`. ([#13366](https://github.com/mastra-ai/mastra/pull/13366))

  **New feature: `targetOptions`**

  Pass agent execution options (e.g. `maxSteps`, `modelSettings`, `instructions`) through to `agent.generate()`, or workflow run options (e.g. `perStep`, `outputOptions`) through to `workflow.run.start()`:

  ```ts
  // Agent - pass modelSettings or maxSteps
  await runEvals({
    data,
    scorers,
    target: myAgent,
    targetOptions: { maxSteps: 5, modelSettings: { temperature: 0 } },
  });

  // Workflow - pass run options
  await runEvals({
    data,
    scorers,
    target: myWorkflow,
    targetOptions: { perStep: true },
  });
  ```

  **New feature: per-item `startOptions`**

  Supply per-item workflow options (e.g. `initialState`) directly on each data item:

  ```ts
  await runEvals({
    data: [
      { input: { query: 'hello' }, startOptions: { initialState: { counter: 1 } } },
      { input: { query: 'world' }, startOptions: { initialState: { counter: 2 } } },
    ],
    scorers,
    target: myWorkflow,
  });
  ```

  Per-item `startOptions` take precedence over global `targetOptions` for the same key. Runeval-managed options (`scorers`, `returnScorerData`, `requestContext`) cannot be overridden via `targetOptions`.

- Add supervisor pattern for multi-agent coordination using `stream()` and `generate()`. Includes delegation hooks, iteration monitoring, completion scoring, memory isolation, tool approval propagation, context filtering, and bail mechanism. ([#13323](https://github.com/mastra-ai/mastra/pull/13323))

- Add LSP diagnostics to workspace edit tools ([#13441](https://github.com/mastra-ai/mastra/pull/13441))

  Language Server Protocol (LSP) diagnostics now appear after edits made with write_file, edit_file, and ast_edit.
  Seeing type and lint errors immediately helps catch issues before the next tool call.
  Edits still work without diagnostics when language servers are not installed.

  Supports TypeScript, Python (Pyright), Go (gopls), Rust (rust-analyzer), and ESLint.

  **Example**

  Before:

  ```ts
  const workspace = new Workspace({ sandbox, filesystem });
  ```

  After:

  ```ts
  const workspace = new Workspace({ sandbox, filesystem, lsp: true });
  ```

### Patch Changes

- Propagate tripwire's that are thrown from a nested workflow. ([#13502](https://github.com/mastra-ai/mastra/pull/13502))

- Added `isProviderDefinedTool` helper to detect provider-defined AI SDK tools (e.g. `google.tools.googleSearch()`, `openai.tools.webSearch()`) for proper schema handling during serialization. ([#13507](https://github.com/mastra-ai/mastra/pull/13507))

- Fixed `ModelRouterEmbeddingModel.doEmbed()` crashing with `TypeError: result.warnings is not iterable` when used with AI SDK v6's `embedMany`. The result now always includes a `warnings` array, ensuring forward compatibility across AI SDK versions. ([#13369](https://github.com/mastra-ai/mastra/pull/13369))

- Fixed build error in `ModelRouterEmbeddingModel.doEmbed()` caused by `warnings` not existing on the return type. ([#13461](https://github.com/mastra-ai/mastra/pull/13461))

- Fixed `Harness.createThread()` defaulting the thread title to `"New Thread"` which prevented `generateTitle` from working (see #13391). Threads created without an explicit title now have an empty string title, allowing the agent's title generation to produce a title from the first user message. ([#13393](https://github.com/mastra-ai/mastra/pull/13393))

- Prevent unknown model IDs from being sorted to the front in `reorderModels()`. Models not present in the `modelIds` parameter are now moved to the end of the array. Fixes #13410. ([#13445](https://github.com/mastra-ai/mastra/pull/13445))

- Include traceId on scores generated during experiment runs to restore traceability of experiment results ([#13464](https://github.com/mastra-ai/mastra/pull/13464))

- Fixed `skill-read-reference` (and `getReference`, `getScript`, `getAsset` in `WorkspaceSkillsImpl`) to resolve file paths relative to the **skill root** instead of hardcoded subdirectories (`references/`, `scripts/`, `assets/`). ([#13363](https://github.com/mastra-ai/mastra/pull/13363))

  Previously, calling `skill-read-reference` with `referencePath: "docs/schema.md"` would silently fail because it resolved to `<skill>/references/docs/schema.md` instead of `<skill>/docs/schema.md`. Now all paths like `references/colors.md`, `docs/schema.md`, and `./config.json` resolve correctly relative to the skill root. Path traversal attacks (e.g. `../../etc/passwd`) are still blocked.

- Fixed workspace listing to show whether each workspace is global or agent-owned. ([#13468](https://github.com/mastra-ai/mastra/pull/13468))
  Agent-owned workspaces now include the owning agent's ID and name so clients can distinguish them from global workspaces.

- Fixed Observational Memory not working with AI SDK v4 models (legacy path). The legacy stream/generate path now calls processInputStep, enabling processors like Observational Memory to inject conversation history and observations. ([#13358](https://github.com/mastra-ai/mastra/pull/13358))

- Added `resolveWorkspace()` so callers can access a dynamic workspace before the first request. ([#13457](https://github.com/mastra-ai/mastra/pull/13457))

- Fixed abortSignal not stopping LLM generation or preventing memory persistence. When aborting a stream (e.g., client disconnect), the LLM response no longer continues processing in the background and partial/full responses are no longer saved to memory. Fixes #13117. ([#13206](https://github.com/mastra-ai/mastra/pull/13206))

- Fixed observation activation to always preserve a minimum amount of context. Previously, swapping buffered observation chunks could unexpectedly drop the context window to near-zero tokens. ([#13476](https://github.com/mastra-ai/mastra/pull/13476))

- Fixed a crash where the Node.js process would terminate with an unhandled TypeError when an LLM stream encountered an error. The ReadableStreamDefaultController would throw "Controller is already closed" when chunks were enqueued after a downstream consumer cancelled or terminated the stream. All controller.enqueue(), controller.close(), and controller.error() calls now check if the controller is still open before attempting operations. (https://github.com/mastra-ai/mastra/issues/13107) ([#13206](https://github.com/mastra-ai/mastra/pull/13206))

- Updated dependencies [[`8d14a59`](https://github.com/mastra-ai/mastra/commit/8d14a591d46fbbbe81baa33c9c267d596f790329)]:
  - @mastra/schema-compat@1.1.3-alpha.0

## 1.7.0

### Minor Changes

- Added `getObservationalMemoryRecord()` method to the `Harness` class. Fixes #13392. ([#13395](https://github.com/mastra-ai/mastra/pull/13395))

  This provides public access to the full `ObservationalMemoryRecord` for the current thread, including `activeObservations`, `generationCount`, and `observationTokenCount`. Previously, accessing raw observation text required bypassing the Harness abstraction by reaching into private storage internals.

  ```typescript
  const record = await harness.getObservationalMemoryRecord();
  if (record) {
    console.log(record.activeObservations);
  }
  ```

- Added `Workspace.setToolsConfig()` method for dynamically updating per-tool configuration at runtime without recreating the workspace instance. Passing `undefined` re-enables all tools. ([#13439](https://github.com/mastra-ai/mastra/pull/13439))

  ```ts
  const workspace = new Workspace({ filesystem, sandbox });

  // Disable write tools (e.g., in plan/read-only mode)
  workspace.setToolsConfig({
    mastra_workspace_write_file: { enabled: false },
    mastra_workspace_edit_file: { enabled: false },
  });

  // Re-enable all tools
  workspace.setToolsConfig(undefined);
  ```

- Added `HarnessDisplayState` so any UI can read a single state snapshot instead of handling 35+ individual events. ([#13427](https://github.com/mastra-ai/mastra/pull/13427))

  **Why:** Previously, every UI (TUI, web, desktop) had to subscribe to dozens of granular Harness events and independently reconstruct what to display. This led to duplicated state tracking and inconsistencies across UI implementations. Now the Harness maintains a single canonical display state that any UI can read.

  **Before:** UIs subscribed to raw events and built up display state locally:

  ```ts
  harness.subscribe((event) => {
    if (event.type === 'agent_start') localState.isRunning = true;
    if (event.type === 'agent_end') localState.isRunning = false;
    if (event.type === 'tool_start') localState.tools.set(event.toolCallId, ...);
    // ... 30+ more event types to handle
  });
  ```

  **After:** UIs read a single snapshot from the Harness:

  ```ts
  import type { HarnessDisplayState } from '@mastra/core/harness';

  harness.subscribe(event => {
    const ds: HarnessDisplayState = harness.getDisplayState();
    // ds.isRunning, ds.tokenUsage, ds.omProgress, ds.activeTools, etc.
    renderUI(ds);
  });
  ```

- Prompt blocks can now define their own variables schema (`requestContextSchema`), allowing you to create reusable prompt blocks with typed variable placeholders. The server now correctly computes and returns draft/published status for prompt blocks. Existing databases are automatically migrated when upgrading. ([#13351](https://github.com/mastra-ai/mastra/pull/13351))

- **Workspace instruction improvements** ([#13304](https://github.com/mastra-ai/mastra/pull/13304))
  - Added `Workspace.getInstructions()`: agents now receive accurate workspace context that distinguishes sandbox-accessible paths from workspace-only paths.
  - Added `WorkspaceInstructionsProcessor`: workspace context is injected directly into the agent system message instead of embedded in tool descriptions.
  - Deprecated `Workspace.getPathContext()` in favour of `getInstructions()`.

  Added `instructions` option to `LocalFilesystem` and `LocalSandbox`. Pass a string to fully replace default instructions, or a function to extend them with access to the current `requestContext` for per-request customization (e.g. by tenant or locale).

  ```typescript
  const filesystem = new LocalFilesystem({
    basePath: './workspace',
    instructions: ({ defaultInstructions, requestContext }) => {
      const locale = requestContext?.get('locale') ?? 'en';
      return `${defaultInstructions}\nLocale: ${locale}`;
    },
  });
  ```

- Added background process management to workspace sandboxes. ([#13293](https://github.com/mastra-ai/mastra/pull/13293))

  You can now spawn, monitor, and manage long-running background processes (dev servers, watchers, REPLs) inside sandbox environments.

  ```typescript
  // Spawn a background process
  const handle = await sandbox.processes.spawn('node server.js');

  // Stream output and wait for exit
  const result = await handle.wait({
    onStdout: data => console.log(data),
  });

  // List and manage running processes
  const procs = await sandbox.processes.list();
  await sandbox.processes.kill(handle.pid);
  ```

  - `SandboxProcessManager` abstract base class with `spawn()`, `list()`, `get(pid)`, `kill(pid)`
  - `ProcessHandle` base class with stdout/stderr accumulation, streaming callbacks, and `wait()`
  - `LocalProcessManager` implementation wrapping Node.js `child_process`
  - Node.js stream interop via `handle.reader` / `handle.writer`
  - Default `executeCommand` implementation built on process manager (spawn + wait)

- Added workspace tools for background process management and improved sandbox execution UI. ([#13309](https://github.com/mastra-ai/mastra/pull/13309))
  - `execute_command` now supports `background: true` to spawn long-running processes and return a PID
  - New `get_process_output` tool to check output/status of background processes (supports `wait` to block until exit)
  - New `kill_process` tool to terminate background processes
  - Output truncation helpers with configurable tail lines
  - Sandbox execution badge UI: terminal-style output display with streaming, exit codes, killed status, and workspace metadata

### Patch Changes

- Fixed agents-as-tools failing with OpenAI when using the model router. The auto-injected `resumeData` field (from `z.any()`) produced a JSON Schema without a `type` key, which OpenAI rejects. Tool schemas are now post-processed to ensure all properties have valid type information. ([#13326](https://github.com/mastra-ai/mastra/pull/13326))

- Fixed `stopWhen` callback receiving empty `toolResults` on steps. `step.toolResults` now correctly reflects the tool results present in `step.content`. ([#13319](https://github.com/mastra-ai/mastra/pull/13319))

- Added `hasJudge` metadata to scorer records so the studio can distinguish code-based scorers (e.g., textual-difference, content-similarity) from LLM-based scorers. This metadata is now included in all four score-saving paths: `runEvals`, scorer hooks, trace scoring, and dataset experiments. ([#13386](https://github.com/mastra-ai/mastra/pull/13386))

- Fixed a bug where custom output processors could not emit stream events during final output processing. The `writer` object was always `undefined` when passed to output processors in the finish phase, preventing use cases like streaming moderation updates or custom UI events back to the client. ([#13454](https://github.com/mastra-ai/mastra/pull/13454))

- Added per-file write locking to workspace tools (edit_file, write_file, ast_edit, delete). Concurrent tool calls targeting the same file are now serialized, preventing race conditions where parallel edits could silently overwrite each other. ([#13302](https://github.com/mastra-ai/mastra/pull/13302))

## 1.7.0-alpha.0

### Minor Changes

- Added `getObservationalMemoryRecord()` method to the `Harness` class. Fixes #13392. ([#13395](https://github.com/mastra-ai/mastra/pull/13395))

  This provides public access to the full `ObservationalMemoryRecord` for the current thread, including `activeObservations`, `generationCount`, and `observationTokenCount`. Previously, accessing raw observation text required bypassing the Harness abstraction by reaching into private storage internals.

  ```typescript
  const record = await harness.getObservationalMemoryRecord();
  if (record) {
    console.log(record.activeObservations);
  }
  ```

- Added `Workspace.setToolsConfig()` method for dynamically updating per-tool configuration at runtime without recreating the workspace instance. Passing `undefined` re-enables all tools. ([#13439](https://github.com/mastra-ai/mastra/pull/13439))

  ```ts
  const workspace = new Workspace({ filesystem, sandbox });

  // Disable write tools (e.g., in plan/read-only mode)
  workspace.setToolsConfig({
    mastra_workspace_write_file: { enabled: false },
    mastra_workspace_edit_file: { enabled: false },
  });

  // Re-enable all tools
  workspace.setToolsConfig(undefined);
  ```

- Added `HarnessDisplayState` so any UI can read a single state snapshot instead of handling 35+ individual events. ([#13427](https://github.com/mastra-ai/mastra/pull/13427))

  **Why:** Previously, every UI (TUI, web, desktop) had to subscribe to dozens of granular Harness events and independently reconstruct what to display. This led to duplicated state tracking and inconsistencies across UI implementations. Now the Harness maintains a single canonical display state that any UI can read.

  **Before:** UIs subscribed to raw events and built up display state locally:

  ```ts
  harness.subscribe((event) => {
    if (event.type === 'agent_start') localState.isRunning = true;
    if (event.type === 'agent_end') localState.isRunning = false;
    if (event.type === 'tool_start') localState.tools.set(event.toolCallId, ...);
    // ... 30+ more event types to handle
  });
  ```

  **After:** UIs read a single snapshot from the Harness:

  ```ts
  import type { HarnessDisplayState } from '@mastra/core/harness';

  harness.subscribe(event => {
    const ds: HarnessDisplayState = harness.getDisplayState();
    // ds.isRunning, ds.tokenUsage, ds.omProgress, ds.activeTools, etc.
    renderUI(ds);
  });
  ```

- Prompt blocks can now define their own variables schema (`requestContextSchema`), allowing you to create reusable prompt blocks with typed variable placeholders. The server now correctly computes and returns draft/published status for prompt blocks. Existing databases are automatically migrated when upgrading. ([#13351](https://github.com/mastra-ai/mastra/pull/13351))

- **Workspace instruction improvements** ([#13304](https://github.com/mastra-ai/mastra/pull/13304))
  - Added `Workspace.getInstructions()`: agents now receive accurate workspace context that distinguishes sandbox-accessible paths from workspace-only paths.
  - Added `WorkspaceInstructionsProcessor`: workspace context is injected directly into the agent system message instead of embedded in tool descriptions.
  - Deprecated `Workspace.getPathContext()` in favour of `getInstructions()`.

  Added `instructions` option to `LocalFilesystem` and `LocalSandbox`. Pass a string to fully replace default instructions, or a function to extend them with access to the current `requestContext` for per-request customization (e.g. by tenant or locale).

  ```typescript
  const filesystem = new LocalFilesystem({
    basePath: './workspace',
    instructions: ({ defaultInstructions, requestContext }) => {
      const locale = requestContext?.get('locale') ?? 'en';
      return `${defaultInstructions}\nLocale: ${locale}`;
    },
  });
  ```

- Added background process management to workspace sandboxes. ([#13293](https://github.com/mastra-ai/mastra/pull/13293))

  You can now spawn, monitor, and manage long-running background processes (dev servers, watchers, REPLs) inside sandbox environments.

  ```typescript
  // Spawn a background process
  const handle = await sandbox.processes.spawn('node server.js');

  // Stream output and wait for exit
  const result = await handle.wait({
    onStdout: data => console.log(data),
  });

  // List and manage running processes
  const procs = await sandbox.processes.list();
  await sandbox.processes.kill(handle.pid);
  ```

  - `SandboxProcessManager` abstract base class with `spawn()`, `list()`, `get(pid)`, `kill(pid)`
  - `ProcessHandle` base class with stdout/stderr accumulation, streaming callbacks, and `wait()`
  - `LocalProcessManager` implementation wrapping Node.js `child_process`
  - Node.js stream interop via `handle.reader` / `handle.writer`
  - Default `executeCommand` implementation built on process manager (spawn + wait)

- Added workspace tools for background process management and improved sandbox execution UI. ([#13309](https://github.com/mastra-ai/mastra/pull/13309))
  - `execute_command` now supports `background: true` to spawn long-running processes and return a PID
  - New `get_process_output` tool to check output/status of background processes (supports `wait` to block until exit)
  - New `kill_process` tool to terminate background processes
  - Output truncation helpers with configurable tail lines
  - Sandbox execution badge UI: terminal-style output display with streaming, exit codes, killed status, and workspace metadata

### Patch Changes

- Fixed agents-as-tools failing with OpenAI when using the model router. The auto-injected `resumeData` field (from `z.any()`) produced a JSON Schema without a `type` key, which OpenAI rejects. Tool schemas are now post-processed to ensure all properties have valid type information. ([#13326](https://github.com/mastra-ai/mastra/pull/13326))

- Fixed `stopWhen` callback receiving empty `toolResults` on steps. `step.toolResults` now correctly reflects the tool results present in `step.content`. ([#13319](https://github.com/mastra-ai/mastra/pull/13319))

- Added `hasJudge` metadata to scorer records so the studio can distinguish code-based scorers (e.g., textual-difference, content-similarity) from LLM-based scorers. This metadata is now included in all four score-saving paths: `runEvals`, scorer hooks, trace scoring, and dataset experiments. ([#13386](https://github.com/mastra-ai/mastra/pull/13386))

- Added per-file write locking to workspace tools (edit_file, write_file, ast_edit, delete). Concurrent tool calls targeting the same file are now serialized, preventing race conditions where parallel edits could silently overwrite each other. ([#13302](https://github.com/mastra-ai/mastra/pull/13302))

## 1.6.0

### Minor Changes

- Added Processor Providers — a new system for configuring and hydrating processors on stored agents. Define custom processor types with config schemas, available phases, and a factory method, then compose them into serializable processor graphs that support sequential, parallel, and conditional execution. ([#13219](https://github.com/mastra-ai/mastra/pull/13219))

  **Example — custom processor provider:**

  ```ts
  import { MastraEditor } from '@mastra/editor';

  // Built-in processors (token-limiter, unicode-normalizer, etc.) are registered automatically.
  // Only register custom providers for your own processors:
  const editor = new MastraEditor({
    processorProviders: {
      'my-custom-filter': myCustomFilterProvider,
    },
  });
  ```

  **Example — stored agent with a processor graph:**

  ```ts
  const agentConfig = {
    inputProcessors: {
      steps: [
        {
          type: 'step',
          step: { id: 'norm', providerId: 'unicode-normalizer', config: {}, enabledPhases: ['processInput'] },
        },
        {
          type: 'step',
          step: {
            id: 'limit',
            providerId: 'token-limiter',
            config: { limit: 4000 },
            enabledPhases: ['processInput', 'processOutputStream'],
          },
        },
      ],
    },
  };
  ```

- Added AST edit tool (`workspace_ast_edit`) for intelligent code transformations using AST analysis. Supports renaming identifiers, adding/removing/merging imports, and pattern-based find-and-replace with metavariable substitution. Automatically available when `@ast-grep/napi` is installed in the project. ([#13233](https://github.com/mastra-ai/mastra/pull/13233))

  **Example:**

  ```ts
  const workspace = new Workspace({
    filesystem: new LocalFilesystem({ basePath: '/my/project' }),
  });
  const tools = createWorkspaceTools(workspace);

  // Rename all occurrences of an identifier
  await tools['mastra_workspace_ast_edit'].execute({
    path: '/src/utils.ts',
    transform: 'rename',
    targetName: 'oldName',
    newName: 'newName',
  });

  // Add an import (merges into existing imports from the same module)
  await tools['mastra_workspace_ast_edit'].execute({
    path: '/src/app.ts',
    transform: 'add-import',
    importSpec: { module: 'react', names: ['useState', 'useEffect'] },
  });

  // Pattern-based replacement with metavariables
  await tools['mastra_workspace_ast_edit'].execute({
    path: '/src/app.ts',
    pattern: 'console.log($ARG)',
    replacement: 'logger.debug($ARG)',
  });
  ```

- Added streaming tool argument previews across all tool renderers. Tool names, file paths, and commands now appear immediately as the model generates them, rather than waiting for the complete tool call. ([#13328](https://github.com/mastra-ai/mastra/pull/13328))
  - **Generic tools** show live key/value argument previews as args stream in
  - **Edit tool** renders a bordered diff preview as soon as `old_str` and `new_str` are available, even before the tool result arrives
  - **Write tool** streams syntax-highlighted file content in a bordered box while args arrive
  - **Find files** shows the glob pattern in the pending header
  - **Task write** streams items directly into the pinned task list component in real-time

  All tools use partial JSON parsing to progressively display argument information. This is enabled automatically for all Harness-based agents — no configuration required.

- Added MCP server storage and editor support. MCP server configurations can now be persisted in storage and managed through the editor CMS. The editor's `mcpServer` namespace provides full CRUD operations and automatically hydrates stored configs into running `MCPServer` instances by resolving tool, agent, and workflow references from the Mastra registry. ([#13285](https://github.com/mastra-ai/mastra/pull/13285))

  ```ts
  const editor = new MastraEditor();
  const mastra = new Mastra({
    tools: { getWeather: weatherTool, calculate: calculatorTool },
    storage: new LibSQLStore({ url: ':memory:' }),
    editor,
  });

  // Store an MCP server config referencing tools by ID
  const server = await editor.mcpServer.create({
    id: 'my-server',
    name: 'My MCP Server',
    version: '1.0.0',
    tools: { getWeather: {}, calculate: { description: 'Custom description' } },
  });

  // Retrieve — automatically hydrates into a real MCPServer with resolved tools
  const mcp = await editor.mcpServer.getById('my-server');
  const tools = mcp.tools(); // { getWeather: ..., calculate: ... }
  ```

- **@mastra/core:** Added optional `threadLock` callbacks to `HarnessConfig` for preventing concurrent thread access across processes. The Harness calls `acquire`/`release` during `selectOrCreateThread`, `createThread`, and `switchThread` when configured. Locking is opt-in — when `threadLock` is not provided, behavior is unchanged. ([#13334](https://github.com/mastra-ai/mastra/pull/13334))

  ```ts
  const harness = new Harness({
    id: 'my-harness',
    storage: myStore,
    modes: [{ id: 'default', agent: myAgent }],
    threadLock: {
      acquire: threadId => acquireThreadLock(threadId),
      release: threadId => releaseThreadLock(threadId),
    },
  });
  ```

  **mastracode:** Wires the existing filesystem-based thread lock (`thread-lock.ts`) into the new `threadLock` config, restoring the concurrent access protection that was lost during the monorepo migration.

- Refactored all Harness class methods to accept object parameters instead of positional arguments, and standardized method naming. ([#13353](https://github.com/mastra-ai/mastra/pull/13353))

  **Why:** Positional arguments make call sites harder to read, especially for methods with optional middle parameters or multiple string arguments. Object parameters are self-documenting and easier to extend without breaking changes.
  - Methods returning arrays use `list` prefix (`listModes`, `listAvailableModels`, `listMessages`, `listMessagesForThread`)
  - `persistThreadSetting` → `setThreadSetting`
  - `resolveToolApprovalDecision` → `respondToToolApproval` (consistent with `respondToQuestion` / `respondToPlanApproval`)
  - `setPermissionCategory` → `setPermissionForCategory`
  - `setPermissionTool` → `setPermissionForTool`

  **Before:**

  ```typescript
  await harness.switchMode('build');
  await harness.sendMessage('Hello', { images });
  const modes = harness.getModes();
  const models = await harness.getAvailableModels();
  harness.resolveToolApprovalDecision('approve');
  ```

  **After:**

  ```typescript
  await harness.switchMode({ modeId: 'build' });
  await harness.sendMessage({ content: 'Hello', images });
  const modes = harness.listModes();
  const models = await harness.listAvailableModels();
  harness.respondToToolApproval({ decision: 'approve' });
  ```

  The `HarnessRequestContext` interface methods (`registerQuestion`, `registerPlanApproval`, `getSubagentModelId`) are also updated to use object parameters.

- Added `task_write` and `task_check` as built-in Harness tools. These tools are automatically injected into every agent call, allowing agents to track structured task lists without manual tool registration. ([#13344](https://github.com/mastra-ai/mastra/pull/13344))

  ```ts
  // Agents can call task_write to create/update a task list
  await tools['task_write'].execute({
    tasks: [
      { content: 'Fix authentication bug', status: 'in_progress', activeForm: 'Fixing authentication bug' },
      { content: 'Add unit tests', status: 'pending', activeForm: 'Adding unit tests' },
    ],
  });

  // Agents can call task_check to verify all tasks are complete before finishing
  await tools['task_check'].execute({});
  // Returns: { completed: 1, inProgress: 0, pending: 1, allDone: false, incomplete: [...] }
  ```

### Patch Changes

- Fixed duplicate Vercel AI Gateway configuration that could cause incorrect API key resolution. Removed a redundant override that conflicted with the upstream models.dev registry. ([#13291](https://github.com/mastra-ai/mastra/pull/13291))

- Fixed Vercel AI Gateway failing when using the model router string format (e.g. `vercel/openai/gpt-oss-120b`). The provider registry was overriding `createGateway`'s base URL with an incorrect value, causing API requests to hit the wrong endpoint. Removed the URL override so the AI SDK uses its own correct default. Closes #13280. ([#13287](https://github.com/mastra-ai/mastra/pull/13287))

- Fixed recursive schema warnings for processor graph entries by unrolling to a fixed depth of 3 levels, matching the existing rule group pattern ([#13292](https://github.com/mastra-ai/mastra/pull/13292))

- Fixed Observational Memory status not updating during conversations. The harness was missing streaming handlers for OM data chunks (status, observation start/end, buffering, activation), so the TUI never received real-time OM progress updates. Also added switchObserverModel and switchReflectorModel methods so changing OM models properly emits events to subscribers. ([#13330](https://github.com/mastra-ai/mastra/pull/13330))

- Fixed thread resuming in git worktrees. Previously, starting mastracode in a new worktree would resume a thread from another worktree of the same repo. Threads are now auto-tagged with the project path and filtered on resume so each worktree gets its own thread scope. ([#13343](https://github.com/mastra-ai/mastra/pull/13343))

- Fixed a crash where the Node.js process would terminate with an unhandled TypeError when an LLM stream encountered an error. The ReadableStreamDefaultController would throw "Controller is already closed" when chunks were enqueued after a downstream consumer cancelled or terminated the stream. All controller.enqueue(), controller.close(), and controller.error() calls now check if the controller is still open before attempting operations. (https://github.com/mastra-ai/mastra/issues/13107) ([#13142](https://github.com/mastra-ai/mastra/pull/13142))

- Added `suggestedContinuation` and `currentTask` fields to the in-memory storage adapter's Observational Memory activation result, aligning it with the persistent storage implementations. ([#13354](https://github.com/mastra-ai/mastra/pull/13354))

- Fixed provider-executed tools (e.g. Anthropic web_search) causing stream bail when called in parallel with regular tools. The tool-call-step now provides a fallback result for provider-executed tools whose output was not propagated, preventing the mapping step from misidentifying them as pending HITL interactions. Fixes #13125. ([#13126](https://github.com/mastra-ai/mastra/pull/13126))

- Updated dependencies [[`7184d87`](https://github.com/mastra-ai/mastra/commit/7184d87c9237d26862f500ccfd0c9f9eadd38ddf)]:
  - @mastra/schema-compat@1.1.2

## 1.6.0-alpha.0

### Minor Changes

- Added Processor Providers — a new system for configuring and hydrating processors on stored agents. Define custom processor types with config schemas, available phases, and a factory method, then compose them into serializable processor graphs that support sequential, parallel, and conditional execution. ([#13219](https://github.com/mastra-ai/mastra/pull/13219))

  **Example — custom processor provider:**

  ```ts
  import { MastraEditor } from '@mastra/editor';

  // Built-in processors (token-limiter, unicode-normalizer, etc.) are registered automatically.
  // Only register custom providers for your own processors:
  const editor = new MastraEditor({
    processorProviders: {
      'my-custom-filter': myCustomFilterProvider,
    },
  });
  ```

  **Example — stored agent with a processor graph:**

  ```ts
  const agentConfig = {
    inputProcessors: {
      steps: [
        {
          type: 'step',
          step: { id: 'norm', providerId: 'unicode-normalizer', config: {}, enabledPhases: ['processInput'] },
        },
        {
          type: 'step',
          step: {
            id: 'limit',
            providerId: 'token-limiter',
            config: { limit: 4000 },
            enabledPhases: ['processInput', 'processOutputStream'],
          },
        },
      ],
    },
  };
  ```

- Added AST edit tool (`workspace_ast_edit`) for intelligent code transformations using AST analysis. Supports renaming identifiers, adding/removing/merging imports, and pattern-based find-and-replace with metavariable substitution. Automatically available when `@ast-grep/napi` is installed in the project. ([#13233](https://github.com/mastra-ai/mastra/pull/13233))

  **Example:**

  ```ts
  const workspace = new Workspace({
    filesystem: new LocalFilesystem({ basePath: '/my/project' }),
  });
  const tools = createWorkspaceTools(workspace);

  // Rename all occurrences of an identifier
  await tools['mastra_workspace_ast_edit'].execute({
    path: '/src/utils.ts',
    transform: 'rename',
    targetName: 'oldName',
    newName: 'newName',
  });

  // Add an import (merges into existing imports from the same module)
  await tools['mastra_workspace_ast_edit'].execute({
    path: '/src/app.ts',
    transform: 'add-import',
    importSpec: { module: 'react', names: ['useState', 'useEffect'] },
  });

  // Pattern-based replacement with metavariables
  await tools['mastra_workspace_ast_edit'].execute({
    path: '/src/app.ts',
    pattern: 'console.log($ARG)',
    replacement: 'logger.debug($ARG)',
  });
  ```

- Added streaming tool argument previews across all tool renderers. Tool names, file paths, and commands now appear immediately as the model generates them, rather than waiting for the complete tool call. ([#13328](https://github.com/mastra-ai/mastra/pull/13328))
  - **Generic tools** show live key/value argument previews as args stream in
  - **Edit tool** renders a bordered diff preview as soon as `old_str` and `new_str` are available, even before the tool result arrives
  - **Write tool** streams syntax-highlighted file content in a bordered box while args arrive
  - **Find files** shows the glob pattern in the pending header
  - **Task write** streams items directly into the pinned task list component in real-time

  All tools use partial JSON parsing to progressively display argument information. This is enabled automatically for all Harness-based agents — no configuration required.

- Added MCP server storage and editor support. MCP server configurations can now be persisted in storage and managed through the editor CMS. The editor's `mcpServer` namespace provides full CRUD operations and automatically hydrates stored configs into running `MCPServer` instances by resolving tool, agent, and workflow references from the Mastra registry. ([#13285](https://github.com/mastra-ai/mastra/pull/13285))

  ```ts
  const editor = new MastraEditor();
  const mastra = new Mastra({
    tools: { getWeather: weatherTool, calculate: calculatorTool },
    storage: new LibSQLStore({ url: ':memory:' }),
    editor,
  });

  // Store an MCP server config referencing tools by ID
  const server = await editor.mcpServer.create({
    id: 'my-server',
    name: 'My MCP Server',
    version: '1.0.0',
    tools: { getWeather: {}, calculate: { description: 'Custom description' } },
  });

  // Retrieve — automatically hydrates into a real MCPServer with resolved tools
  const mcp = await editor.mcpServer.getById('my-server');
  const tools = mcp.tools(); // { getWeather: ..., calculate: ... }
  ```

- **@mastra/core:** Added optional `threadLock` callbacks to `HarnessConfig` for preventing concurrent thread access across processes. The Harness calls `acquire`/`release` during `selectOrCreateThread`, `createThread`, and `switchThread` when configured. Locking is opt-in — when `threadLock` is not provided, behavior is unchanged. ([#13334](https://github.com/mastra-ai/mastra/pull/13334))

  ```ts
  const harness = new Harness({
    id: 'my-harness',
    storage: myStore,
    modes: [{ id: 'default', agent: myAgent }],
    threadLock: {
      acquire: threadId => acquireThreadLock(threadId),
      release: threadId => releaseThreadLock(threadId),
    },
  });
  ```

  **mastracode:** Wires the existing filesystem-based thread lock (`thread-lock.ts`) into the new `threadLock` config, restoring the concurrent access protection that was lost during the monorepo migration.

- Refactored all Harness class methods to accept object parameters instead of positional arguments, and standardized method naming. ([#13353](https://github.com/mastra-ai/mastra/pull/13353))

  **Why:** Positional arguments make call sites harder to read, especially for methods with optional middle parameters or multiple string arguments. Object parameters are self-documenting and easier to extend without breaking changes.
  - Methods returning arrays use `list` prefix (`listModes`, `listAvailableModels`, `listMessages`, `listMessagesForThread`)
  - `persistThreadSetting` → `setThreadSetting`
  - `resolveToolApprovalDecision` → `respondToToolApproval` (consistent with `respondToQuestion` / `respondToPlanApproval`)
  - `setPermissionCategory` → `setPermissionForCategory`
  - `setPermissionTool` → `setPermissionForTool`

  **Before:**

  ```typescript
  await harness.switchMode('build');
  await harness.sendMessage('Hello', { images });
  const modes = harness.getModes();
  const models = await harness.getAvailableModels();
  harness.resolveToolApprovalDecision('approve');
  ```

  **After:**

  ```typescript
  await harness.switchMode({ modeId: 'build' });
  await harness.sendMessage({ content: 'Hello', images });
  const modes = harness.listModes();
  const models = await harness.listAvailableModels();
  harness.respondToToolApproval({ decision: 'approve' });
  ```

  The `HarnessRequestContext` interface methods (`registerQuestion`, `registerPlanApproval`, `getSubagentModelId`) are also updated to use object parameters.

- Added `task_write` and `task_check` as built-in Harness tools. These tools are automatically injected into every agent call, allowing agents to track structured task lists without manual tool registration. ([#13344](https://github.com/mastra-ai/mastra/pull/13344))

  ```ts
  // Agents can call task_write to create/update a task list
  await tools['task_write'].execute({
    tasks: [
      { content: 'Fix authentication bug', status: 'in_progress', activeForm: 'Fixing authentication bug' },
      { content: 'Add unit tests', status: 'pending', activeForm: 'Adding unit tests' },
    ],
  });

  // Agents can call task_check to verify all tasks are complete before finishing
  await tools['task_check'].execute({});
  // Returns: { completed: 1, inProgress: 0, pending: 1, allDone: false, incomplete: [...] }
  ```

### Patch Changes

- Fixed duplicate Vercel AI Gateway configuration that could cause incorrect API key resolution. Removed a redundant override that conflicted with the upstream models.dev registry. ([#13291](https://github.com/mastra-ai/mastra/pull/13291))

- Fixed Vercel AI Gateway failing when using the model router string format (e.g. `vercel/openai/gpt-oss-120b`). The provider registry was overriding `createGateway`'s base URL with an incorrect value, causing API requests to hit the wrong endpoint. Removed the URL override so the AI SDK uses its own correct default. Closes #13280. ([#13287](https://github.com/mastra-ai/mastra/pull/13287))

- Fixed recursive schema warnings for processor graph entries by unrolling to a fixed depth of 3 levels, matching the existing rule group pattern ([#13292](https://github.com/mastra-ai/mastra/pull/13292))

- Fixed Observational Memory status not updating during conversations. The harness was missing streaming handlers for OM data chunks (status, observation start/end, buffering, activation), so the TUI never received real-time OM progress updates. Also added switchObserverModel and switchReflectorModel methods so changing OM models properly emits events to subscribers. ([#13330](https://github.com/mastra-ai/mastra/pull/13330))

- Fixed thread resuming in git worktrees. Previously, starting mastracode in a new worktree would resume a thread from another worktree of the same repo. Threads are now auto-tagged with the project path and filtered on resume so each worktree gets its own thread scope. ([#13343](https://github.com/mastra-ai/mastra/pull/13343))

- Fixed a crash where the Node.js process would terminate with an unhandled TypeError when an LLM stream encountered an error. The ReadableStreamDefaultController would throw "Controller is already closed" when chunks were enqueued after a downstream consumer cancelled or terminated the stream. All controller.enqueue(), controller.close(), and controller.error() calls now check if the controller is still open before attempting operations. (https://github.com/mastra-ai/mastra/issues/13107) ([#13142](https://github.com/mastra-ai/mastra/pull/13142))

- Added `suggestedContinuation` and `currentTask` fields to the in-memory storage adapter's Observational Memory activation result, aligning it with the persistent storage implementations. ([#13354](https://github.com/mastra-ai/mastra/pull/13354))

- Fixed provider-executed tools (e.g. Anthropic web_search) causing stream bail when called in parallel with regular tools. The tool-call-step now provides a fallback result for provider-executed tools whose output was not propagated, preventing the mapping step from misidentifying them as pending HITL interactions. Fixes #13125. ([#13126](https://github.com/mastra-ai/mastra/pull/13126))

- Updated dependencies [[`7184d87`](https://github.com/mastra-ai/mastra/commit/7184d87c9237d26862f500ccfd0c9f9eadd38ddf)]:
  - @mastra/schema-compat@1.1.2-alpha.0

## 1.5.0

### Minor Changes

- Added `allowedPaths` option to `LocalFilesystem` for granting agents access to specific directories outside `basePath` without disabling containment. ([#13054](https://github.com/mastra-ai/mastra/pull/13054))

  ```typescript
  const workspace = new Workspace({
    filesystem: new LocalFilesystem({
      basePath: './workspace',
      allowedPaths: ['/home/user/.config', '/home/user/documents'],
    }),
  });
  ```

  Allowed paths can be updated at runtime using `setAllowedPaths()`:

  ```typescript
  workspace.filesystem.setAllowedPaths(prev => [...prev, '/home/user/new-dir']);
  ```

  This is the recommended approach for least-privilege access — agents can only reach the specific directories you allow, while containment stays enabled for everything else.

- Added generic Harness class to @mastra/core for orchestrating agents with modes, state management, built-in tools (ask_user, submit_plan), subagent support, Observational Memory integration, model discovery, and permission-aware tool approval. The Harness provides a reusable foundation for building agent-powered applications with features like thread management, heartbeat monitoring, and event-driven architecture. ([#13245](https://github.com/mastra-ai/mastra/pull/13245))

- Added glob pattern support for workspace configuration. The `list_files` tool now accepts a `pattern` parameter for filtering files (e.g., `**/*.ts`, `src/**/*.test.ts`). `autoIndexPaths` accepts glob patterns like `./docs/**/*.md` to selectively index files for BM25 search. Skills paths support globs like `./**/skills` to discover skill directories at any depth, including dot-directories like `.agents/skills`. ([#13023](https://github.com/mastra-ai/mastra/pull/13023))

  **`list_files` tool with pattern:**

  ```typescript
  // Agent can now use glob patterns to filter files
  const result = await workspace.tools.workspace_list_files({
    path: '/',
    pattern: '**/*.test.ts',
  });
  ```

  **`autoIndexPaths` with globs:**

  ```typescript
  const workspace = new Workspace({
    filesystem: new LocalFilesystem({ basePath: './project' }),
    bm25: true,
    // Only index markdown files under ./docs
    autoIndexPaths: ['./docs/**/*.md'],
  });
  ```

  **Skills paths with globs:**

  ```typescript
  const workspace = new Workspace({
    filesystem: new LocalFilesystem({ basePath: './project' }),
    // Discover any directory named 'skills' within 4 levels of depth
    skills: ['./**/skills'],
  });
  ```

  Note: Skills glob discovery walks up to 4 directory levels deep from the glob's static prefix. Use more specific patterns like `./src/**/skills` to narrow the search scope for large workspaces.

- Added direct skill path discovery — you can now pass a path directly to a skill directory or SKILL.md file in the workspace skills configuration (e.g., `skills: ['/path/to/my-skill']` or `skills: ['/path/to/my-skill/SKILL.md']`). Previously only parent directories were supported. Also improved error handling when a configured skills path is inaccessible (e.g., permission denied), logging a warning instead of breaking discovery for all skills. ([#13031](https://github.com/mastra-ai/mastra/pull/13031))

- Add optional `instruction` field to ObservationalMemory config types ([#13240](https://github.com/mastra-ai/mastra/pull/13240))

  Adds `instruction?: string` to `ObservationalMemoryObservationConfig` and `ObservationalMemoryReflectionConfig` interfaces, allowing external consumers to pass custom instructions to observational memory.

- Added typed workspace providers — `workspace.filesystem` and `workspace.sandbox` now return the concrete types you passed to the constructor, improving autocomplete and eliminating casts. ([#13021](https://github.com/mastra-ai/mastra/pull/13021))

  When mounts are configured, `workspace.filesystem` returns a typed `CompositeFilesystem<TMounts>` with per-key narrowing via `mounts.get()`.

  **Before:**

  ```ts
  const workspace = new Workspace({
    filesystem: new LocalFilesystem({ basePath: '/tmp' }),
    sandbox: new E2BSandbox({ timeout: 60000 }),
  });
  workspace.filesystem; // WorkspaceFilesystem | undefined
  workspace.sandbox; // WorkspaceSandbox | undefined
  ```

  **After:**

  ```ts
  const workspace = new Workspace({
    filesystem: new LocalFilesystem({ basePath: '/tmp' }),
    sandbox: new E2BSandbox({ timeout: 60000 }),
  });
  workspace.filesystem; // LocalFilesystem
  workspace.sandbox; // E2BSandbox

  // Mount-aware workspaces get typed per-key access:
  const ws = new Workspace({
    mounts: { '/local': new LocalFilesystem({ basePath: '/tmp' }) },
  });
  ws.filesystem.mounts.get('/local'); // LocalFilesystem
  ```

- Added support for Vercel AI Gateway in the model router. You can now use `model: 'vercel/google/gemini-3-flash'` with agents and it will route through the official AI SDK gateway provider. ([#13149](https://github.com/mastra-ai/mastra/pull/13149))

- Added workspace and skill storage domains with full CRUD, versioning, and implementations across LibSQL, Postgres, and MongoDB. Added `editor.workspace` and `editor.skill` namespaces for managing workspace configurations and skill definitions through the editor. Agents stored in the editor can now reference workspaces (by ID or inline config) and skills, with full hydration to runtime `Workspace` instances during agent resolution. ([#13156](https://github.com/mastra-ai/mastra/pull/13156))

  **Filesystem-native skill versioning (draft → publish model):**

  Skills are versioned as filesystem trees with content-addressable blob storage. The editing surface (live filesystem) is separated from the serving surface (versioned blob store), enabling a `draft → publish` workflow:
  - `editor.skill.publish(skillId, source, skillPath)` — Snapshots a skill directory from the filesystem into blob storage, creates a new version with a tree manifest, and sets `activeVersionId`
  - Version switching via `editor.skill.update({ id, activeVersionId })` — Points the skill to a previous version without re-publishing
  - Publishing a skill automatically invalidates cached agents that reference it, so they re-hydrate with the updated version on next access

  **Agent skill resolution strategies:**

  Agents can reference skills with different resolution strategies:
  - `strategy: 'latest'` — Resolves the skill's active version (honors `activeVersionId` for rollback)
  - `pin: '<versionId>'` — Pins to a specific version, immune to publishes
  - `strategy: 'live'` — Reads directly from the live filesystem (no blob store)

  **Blob storage infrastructure:**
  - `BlobStore` abstract class for content-addressable storage keyed by SHA-256 hash
  - `InMemoryBlobStore` for testing
  - LibSQL, Postgres, and MongoDB implementations
  - `S3BlobStore` for storing blobs in S3 or S3-compatible storage (AWS, R2, MinIO, DO Spaces)
  - `BlobStoreProvider` interface and `MastraEditorConfig.blobStores` registry for pluggable blob storage
  - `VersionedSkillSource` and `CompositeVersionedSkillSource` for reading skill files from the blob store at runtime

  **New storage types:**
  - `StorageWorkspaceSnapshotType` and `StorageSkillSnapshotType` with corresponding input/output types
  - `StorageWorkspaceRef` for ID-based or inline workspace references on agents
  - `StorageSkillConfig` for per-agent skill overrides (`pin`, `strategy`, description, instructions)
  - `SkillVersionTree` and `SkillVersionTreeEntry` for tree manifests
  - `StorageBlobEntry` for content-addressable blob entries
  - `SKILL_BLOBS_SCHEMA` for the `mastra_skill_blobs` table

  **New editor namespaces:**
  - `editor.workspace` — CRUD for workspace configs, plus `hydrateSnapshotToWorkspace()` for resolving to runtime `Workspace` instances
  - `editor.skill` — CRUD for skill definitions, plus `publish()` for filesystem-to-blob snapshots

  **Provider registries:**
  - `MastraEditorConfig` accepts `filesystems`, `sandboxes`, and `blobStores` provider registries (keyed by provider ID)
  - Built-in `local` filesystem and sandbox providers are auto-registered
  - `editor.resolveBlobStore()` resolves from provider registry or falls back to the storage backend's blobs domain
  - Providers expose `id`, `name`, `description`, `configSchema` (JSON Schema for UI form rendering), and a factory method

  **Storage adapter support:**
  - LibSQL: Full `workspaces`, `skills`, and `blobs` domain implementations
  - Postgres: Full `workspaces`, `skills`, and `blobs` domain implementations
  - MongoDB: Full `workspaces`, `skills`, and `blobs` domain implementations
  - All three include `workspace`, `skills`, and `skillsFormat` fields on agent versions

  **Server endpoints:**
  - `GET/POST/PATCH/DELETE /stored/workspaces` — CRUD for stored workspaces
  - `GET/POST/PATCH/DELETE /stored/skills` — CRUD for stored skills
  - `POST /stored/skills/:id/publish` — Publish a skill from a filesystem source

  ```ts
  import { MastraEditor } from '@mastra/editor';
  import { s3FilesystemProvider, s3BlobStoreProvider } from '@mastra/s3';
  import { e2bSandboxProvider } from '@mastra/e2b';

  const editor = new MastraEditor({
    filesystems: { s3: s3FilesystemProvider },
    sandboxes: { e2b: e2bSandboxProvider },
    blobStores: { s3: s3BlobStoreProvider },
  });

  // Create a skill and publish it
  const skill = await editor.skill.create({
    name: 'Code Review',
    description: 'Reviews code for best practices',
    instructions: 'Analyze the code and provide feedback...',
  });
  await editor.skill.publish(skill.id, source, 'skills/code-review');

  // Agents resolve skills by strategy
  await editor.agent.create({
    name: 'Dev Assistant',
    model: { provider: 'openai', name: 'gpt-4' },
    workspace: { type: 'id', workspaceId: workspace.id },
    skills: { [skill.id]: { strategy: 'latest' } },
    skillsFormat: 'xml',
  });
  ```

- Added draft/publish version management for all editor primitives (agents, scorers, MCP clients, prompt blocks). ([#13061](https://github.com/mastra-ai/mastra/pull/13061))

  **Status filtering on list endpoints** — All list endpoints now accept a `?status=draft|published|archived` query parameter to filter by entity status. Defaults to `published` to preserve backward compatibility.

  **Draft vs published resolution on get-by-id endpoints** — All get-by-id endpoints now accept `?status=draft` to resolve the entity with its latest (unpublished) version, or `?status=published` (default) to resolve with the active published version.

  **Edits no longer auto-publish** — When updating any primitive, a new version is created but `activeVersionId` is no longer automatically updated. Edits stay as drafts until explicitly published via the activate endpoint.

  **Full version management for all primitives** — Scorers, MCP clients, and prompt blocks now have the same version management API that agents have: list versions, create version snapshots, get specific versions, activate/publish, restore from a previous version, delete versions, and compare versions.

  **New prompt block CRUD routes** — Prompt blocks now have full server routes (`GET /stored/prompt-blocks`, `GET /stored/prompt-blocks/:id`, `POST`, `PATCH`, `DELETE`).

  **New version endpoints** — Each primitive now exposes 7 version management endpoints under `/stored/{type}/:id/versions` (list, create, get, activate, restore, delete, compare).

  ```ts
  // Fetch the published version (default behavior, backward compatible)
  const published = await fetch('/api/stored/scorers/my-scorer');

  // Fetch the draft version for editing in the UI
  const draft = await fetch('/api/stored/scorers/my-scorer?status=draft');

  // Publish a specific version
  await fetch('/api/stored/scorers/my-scorer/versions/abc123/activate', { method: 'POST' });

  // Compare two versions
  const diff = await fetch('/api/stored/scorers/my-scorer/versions/compare?from=v1&to=v2');
  ```

- Added `toModelOutput` support to the agent loop. Tool definitions can now include a `toModelOutput` function that transforms the raw tool result before it's sent to the model, while preserving the raw result in storage. This matches the AI SDK `toModelOutput` convention — the function receives the raw output directly and returns `{ type: 'text', value: string }` or `{ type: 'content', value: ContentPart[] }`. ([#13171](https://github.com/mastra-ai/mastra/pull/13171))

  ```ts
  import { createTool } from '@mastra/core/tools';
  import { z } from 'zod';

  const weatherTool = createTool({
    id: 'weather',
    inputSchema: z.object({ city: z.string() }),
    execute: async ({ city }) => ({
      city,
      temperature: 72,
      conditions: 'sunny',
      humidity: 45,
      raw_sensor_data: [0.12, 0.45, 0.78],
    }),
    // The model sees a concise summary instead of the full JSON
    toModelOutput: output => ({
      type: 'text',
      value: `${output.city}: ${output.temperature}°F, ${output.conditions}`,
    }),
  });
  ```

- Added `mastra_workspace_grep` workspace tool for regex-based content search across files. This complements the existing semantic search tool by providing direct pattern matching with support for case-insensitive search, file filtering by extension, context lines, and result limiting. ([#13010](https://github.com/mastra-ai/mastra/pull/13010))

  The tool is automatically available when a workspace has a filesystem configured:

  ```typescript
  import { Workspace, WORKSPACE_TOOLS } from '@mastra/core/workspace';
  import { LocalFilesystem } from '@mastra/core/workspace';

  const workspace = new Workspace({
    filesystem: new LocalFilesystem({ basePath: './my-project' }),
  });

  // The grep tool is auto-injected and available as:
  // WORKSPACE_TOOLS.SEARCH.GREP → 'mastra_workspace_grep'
  ```

- Removed `outputSchema` from workspace tools to return raw text instead of JSON, optimizing for token usage and LLM performance. Structured metadata that was previously returned in tool output is now emitted as `data-workspace-metadata` chunks via `writer.custom()`, keeping it available for UI consumption without passing it to the LLM. Tools are also extracted into individual files and can be imported directly (e.g. `import { readFileTool } from '@mastra/core/workspace'`). ([#13166](https://github.com/mastra-ai/mastra/pull/13166))

### Patch Changes

- dependencies updates: ([#13127](https://github.com/mastra-ai/mastra/pull/13127))
  - Updated dependency [`hono@^4.11.9` ↗︎](https://www.npmjs.com/package/hono/v/4.11.9) (from `^4.11.3`, in `dependencies`)

- dependencies updates: ([#13167](https://github.com/mastra-ai/mastra/pull/13167))
  - Updated dependency [`lru-cache@^11.2.6` ↗︎](https://www.npmjs.com/package/lru-cache/v/11.2.6) (from `^11.2.2`, in `dependencies`)

- Export `AnyWorkspace` type from `@mastra/core/workspace` for accepting any Workspace regardless of generic parameters. Updates Agent and Mastra to use `AnyWorkspace` so workspaces with typed mounts/sandbox (e.g. E2BSandbox, GCSFilesystem) are accepted without type errors. ([#13155](https://github.com/mastra-ai/mastra/pull/13155))

- Update provider registry and model documentation with latest models and providers ([`e37ef84`](https://github.com/mastra-ai/mastra/commit/e37ef8404043c94ca0c8e35ecdedb093b8087878))

- Fixed skill processor tools (skill-activate, skill-search, skill-read-reference, skill-read-script, skill-read-asset) being incorrectly suspended for approval when `requireToolApproval: true` is set. These internal tools now bypass the approval check and execute directly. ([#13160](https://github.com/mastra-ai/mastra/pull/13160))

- Fixed a bug where `requestContext` metadata was not propagated to child spans. When using `requestContextKeys`, only root spans were enriched with request context values — child spans (e.g. `agent_run` inside a workflow) were missing them. All spans in a trace are now correctly enriched. Fixes #12818. ([#12819](https://github.com/mastra-ai/mastra/pull/12819))

- Fixed semantic recall search in Mastra Studio returning no results when using non-default embedding dimensions (e.g., fastembed with 384-dim). The SemanticRecall processor now probes the embedder for its actual output dimension, ensuring the vector index name matches between write and read paths. Previously, the processor defaulted to a 1536-dim index name regardless of the actual embedder, causing a mismatch with the dimension-aware index name used by Studio's search. Fixes #13039 ([#13059](https://github.com/mastra-ai/mastra/pull/13059))

- Fixed `CompositeFilesystem` instructions: agents and tools no longer receive an incorrect claim that files written via workspace tools are accessible at sandbox paths. The instructions now accurately describe only the available mounted filesystems. ([#13221](https://github.com/mastra-ai/mastra/pull/13221))

- Fixed onChunk callback to receive raw Mastra chunks instead of AI SDK v5 converted chunks for tool results. Also added missing onChunk calls for tool-error chunks and tool-result chunks in mixed-error scenarios. ([#13243](https://github.com/mastra-ai/mastra/pull/13243))

- Fixed tool execution errors stopping the agentic loop. The agent now continues after tool errors, allowing the model to see the error and retry with corrected arguments. ([#13242](https://github.com/mastra-ai/mastra/pull/13242))

- Fixed conditional rules not being persisted for workflows, agents, and scorers when creating or updating agents in the CMS. Rules configured on these entities are now correctly saved to storage. ([#13044](https://github.com/mastra-ai/mastra/pull/13044))

- Added runtime `requestContext` forwarding to tool executions. ([#13094](https://github.com/mastra-ai/mastra/pull/13094))

  Tools invoked within agentic workflow steps now receive the caller's `requestContext` — including authenticated API clients, feature flags, and user metadata set by middleware. Runtime `requestContext` is preferred over build-time context when both are available.

  **Why:** Previously, `requestContext` values were silently dropped in two places: (1) the workflow loop stream created a new empty `RequestContext` instead of forwarding the caller's, and (2) `createToolCallStep` didn't pass `requestContext` in tool options. This aligns both the agent generate/stream and agentic workflow paths with the agent network path, where `requestContext` was already forwarded correctly.

  **Before:** Tools received an empty `requestContext`, losing all values set by the workflow step.

  ```ts
  // requestContext with auth data set in workflow step
  requestContext.set('apiClient', authedClient);
  // tool receives empty RequestContext — apiClient is undefined
  ```

  **After:** Pass `requestContext` via `MastraToolInvocationOptions` and tools receive it.

  ```ts
  // requestContext with auth data flows through to the tool
  requestContext.set('apiClient', authedClient);
  // tool receives the same RequestContext — apiClient is available
  ```

  Fixes #13088

- Fixed tsc out-of-memory crash caused by step-schema.d.ts expanding to 50k lines. Added explicit type annotations to all exported Zod schema constants, reducing declaration output from 49,729 to ~500 lines without changing runtime behavior. ([#13229](https://github.com/mastra-ai/mastra/pull/13229))

- Fixed TypeScript type generation hanging or running out of memory when packages depend on @mastra/core tool types. Changed ZodLikeSchema from a nominal union type to structural typing, which prevents TypeScript from performing deep comparisons of zod v3/v4 type trees during generic inference. ([#13239](https://github.com/mastra-ai/mastra/pull/13239))

- Fixed tool execution errors being emitted as `tool-result` instead of `tool-error` in fullStream. Previously, when a tool's execute function threw an error, the error was caught and returned as a value, causing the stream to emit a `tool-result` chunk containing the error object. Now errors are properly propagated, so the stream emits `tool-error` chunks, allowing consumers (including the `@mastra/ai-sdk` conversion pipeline) to correctly distinguish between successful tool results and failed tool executions. Fixes #13123. ([#13147](https://github.com/mastra-ai/mastra/pull/13147))

- Fixed thread title not being generated for pre-created threads. When threads were created before starting a conversation (e.g., for URL routing or storing metadata), the title stayed as a placeholder because the title generation condition checked whether the thread existed rather than whether it had a title. Threads created without an explicit title now get an empty title instead of a placeholder, and title generation fires whenever a thread has no title. Resolves #13145. ([#13151](https://github.com/mastra-ai/mastra/pull/13151))

- Fixed `inputData` in `dowhile` and `dountil` loop condition functions to be properly typed as the step's output schema instead of `any`. This means you no longer need to manually cast `inputData` in your loop conditions — TypeScript will now correctly infer the type from your step's `outputSchema`. ([#12977](https://github.com/mastra-ai/mastra/pull/12977))

- Migrated MastraCode from the prototype harness to the generic CoreHarness from @mastra/core. The createMastraCode function is now fully configurable with optional parameters for modes, subagents, storage, tools, and more. Removed the deprecated prototype harness implementation. ([#13245](https://github.com/mastra-ai/mastra/pull/13245))

- Fixed the writer object being undefined in processOutputStream, allowing output processors to emit custom events to the stream during chunk processing. This enables use cases like streaming moderation results back to the client. ([#13056](https://github.com/mastra-ai/mastra/pull/13056))

- Fixed sub-agent tool approval resume flow. When a sub-agent tool required approval and was approved, the agent would restart from scratch instead of resuming, causing an infinite loop. The resume data is now correctly passed through for agent tools so they properly resume after approval. ([#13241](https://github.com/mastra-ai/mastra/pull/13241))

- Dataset schemas now appear in the Edit Dataset dialog. Previously the `inputSchema` and `groundTruthSchema` fields were not passed to the dialog, so editing a dataset always showed empty schemas. ([#13175](https://github.com/mastra-ai/mastra/pull/13175))

  Schema edits in the JSON editor no longer cause the cursor to jump to the top of the field. Typing `{"type": "object"}` in the schema editor now behaves like a normal text input instead of resetting on every keystroke.

  Validation errors are now surfaced when updating a dataset schema that conflicts with existing items. For example, adding a `required: ["name"]` constraint when existing items lack a `name` field now shows "2 existing item(s) fail validation" in the dialog instead of silently dropping the error.

  Disabling a dataset schema from the Studio UI now correctly clears it. Previously the server converted `null` (disable) to `undefined` (no change), so the old schema persisted and validation continued.

  Workflow schemas fetched via `client.getWorkflow().getSchema()` are now correctly parsed. The server serializes schemas with `superjson`, but the client was using plain `JSON.parse`, yielding a `{json: {...}}` wrapper instead of the actual JSON Schema object.

- Fixed network mode messages missing metadata for filtering. All internal network messages (sub-agent results, tool execution results, workflow results) now include `metadata.mode: 'network'` in their content metadata, making it possible to filter them from user-facing messages without parsing JSON content. Previously, consumers had to parse the JSON body of each message to check for `isNetwork: true` — now they can simply check `message.content.metadata.mode === 'network'`. Fixes #13106. ([#13144](https://github.com/mastra-ai/mastra/pull/13144))

- Fixed sub-agent memory context pollution that caused 'Exhausted all fallback models' errors when using Observational Memory with sub-agents. The parent agent's memory context is now preserved across sub-agent tool execution. ([#13051](https://github.com/mastra-ai/mastra/pull/13051))

- CMS draft support with status badges for agents. ([#13194](https://github.com/mastra-ai/mastra/pull/13194))
  - Agent list now resolves the latest (draft) version for each stored agent, showing current edits rather than the last published state.
  - Added `hasDraft` and `activeVersionId` fields to the agent list API response.
  - Agent list badges: "Published" (green) when a published version exists, "Draft" (colored when unpublished changes exist, grayed out otherwise).
  - Added `resolvedVersionId` to all `StorageResolved*Type` types so the server can detect whether the latest version differs from the active version.
  - Added `status` option to `GetByIdOptions` to allow resolving draft vs published versions through the editor layer.
  - Fixed editor cache not being cleared on version activate, restore, and delete — all four versioned domains (agents, scorers, prompt-blocks, mcp-clients) now clear the cache after version mutations.
  - Added `ALTER TABLE` migration for `mastra_agent_versions` in libsql and pg to add newer columns (`mcpClients`, `requestContextSchema`, `workspace`, `skills`, `skillsFormat`).

- Added scorer version management and CMS draft/publish flow for scorers. ([#13194](https://github.com/mastra-ai/mastra/pull/13194))
  - Added scorer version methods to the client SDK: `listVersions`, `createVersion`, `getVersion`, `activateVersion`, `restoreVersion`, `deleteVersion`, `compareVersions`.
  - Added `ScorerVersionCombobox` for navigating scorer versions with Published/Draft labels.
  - Scorer edit page now supports Save (draft) and Publish workflows with an "Unpublished changes" indicator.
  - Storage list methods for agents and scorers no longer default to filtering only published entities, allowing drafts to appear in the playground.

- Fixed CompositeAuth losing public and protected route configurations from underlying auth providers. Routes marked as public or protected now work correctly when deployed to Mastra Cloud. ([#13086](https://github.com/mastra-ai/mastra/pull/13086))

- Trimmed the agent experiment result `output` to only persist relevant fields instead of the entire `FullOutput` blob. The stored output now contains: `text`, `object`, `toolCalls`, `toolResults`, `sources`, `files`, `usage`, `reasoningText`, `traceId`, and `error`. ([#13158](https://github.com/mastra-ai/mastra/pull/13158))

  Dropped fields like `steps`, `response`, `messages`, `rememberedMessages`, `request`, `providerMetadata`, `warnings`, `scoringData`, `suspendPayload`, and other provider/debugging internals that were duplicated elsewhere or not useful for experiment evaluation.

- Fixed `.branch()` condition receiving `undefined` inputData when resuming a suspended nested workflow after `.map()`. ([#13055](https://github.com/mastra-ai/mastra/pull/13055))

  Previously, when a workflow used `.map()` followed by `.branch()` and a nested workflow inside the branch called `suspend()`, resuming would fail with `TypeError: Cannot read properties of undefined` because the branch conditions were unnecessarily re-evaluated with stale data.

  Resume now skips condition re-evaluation for `.branch()` entries and goes directly to the correct suspended branch, matching the existing behavior for `.parallel()` entries.

  Fixes #12982

- Updated dependencies [[`1415bcd`](https://github.com/mastra-ai/mastra/commit/1415bcd894baba03e07640b3b1986037db49559d)]:
  - @mastra/schema-compat@1.1.1

## 1.5.0-alpha.1

### Patch Changes

- Updated dependencies [[`1415bcd`](https://github.com/mastra-ai/mastra/commit/1415bcd894baba03e07640b3b1986037db49559d)]:
  - @mastra/schema-compat@1.1.1-alpha.0

## 1.5.0-alpha.0

### Minor Changes

- Added `allowedPaths` option to `LocalFilesystem` for granting agents access to specific directories outside `basePath` without disabling containment. ([#13054](https://github.com/mastra-ai/mastra/pull/13054))

  ```typescript
  const workspace = new Workspace({
    filesystem: new LocalFilesystem({
      basePath: './workspace',
      allowedPaths: ['/home/user/.config', '/home/user/documents'],
    }),
  });
  ```

  Allowed paths can be updated at runtime using `setAllowedPaths()`:

  ```typescript
  workspace.filesystem.setAllowedPaths(prev => [...prev, '/home/user/new-dir']);
  ```

  This is the recommended approach for least-privilege access — agents can only reach the specific directories you allow, while containment stays enabled for everything else.

- Added generic Harness class to @mastra/core for orchestrating agents with modes, state management, built-in tools (ask_user, submit_plan), subagent support, Observational Memory integration, model discovery, and permission-aware tool approval. The Harness provides a reusable foundation for building agent-powered applications with features like thread management, heartbeat monitoring, and event-driven architecture. ([#13245](https://github.com/mastra-ai/mastra/pull/13245))

- Added glob pattern support for workspace configuration. The `list_files` tool now accepts a `pattern` parameter for filtering files (e.g., `**/*.ts`, `src/**/*.test.ts`). `autoIndexPaths` accepts glob patterns like `./docs/**/*.md` to selectively index files for BM25 search. Skills paths support globs like `./**/skills` to discover skill directories at any depth, including dot-directories like `.agents/skills`. ([#13023](https://github.com/mastra-ai/mastra/pull/13023))

  **`list_files` tool with pattern:**

  ```typescript
  // Agent can now use glob patterns to filter files
  const result = await workspace.tools.workspace_list_files({
    path: '/',
    pattern: '**/*.test.ts',
  });
  ```

  **`autoIndexPaths` with globs:**

  ```typescript
  const workspace = new Workspace({
    filesystem: new LocalFilesystem({ basePath: './project' }),
    bm25: true,
    // Only index markdown files under ./docs
    autoIndexPaths: ['./docs/**/*.md'],
  });
  ```

  **Skills paths with globs:**

  ```typescript
  const workspace = new Workspace({
    filesystem: new LocalFilesystem({ basePath: './project' }),
    // Discover any directory named 'skills' within 4 levels of depth
    skills: ['./**/skills'],
  });
  ```

  Note: Skills glob discovery walks up to 4 directory levels deep from the glob's static prefix. Use more specific patterns like `./src/**/skills` to narrow the search scope for large workspaces.

- Added direct skill path discovery — you can now pass a path directly to a skill directory or SKILL.md file in the workspace skills configuration (e.g., `skills: ['/path/to/my-skill']` or `skills: ['/path/to/my-skill/SKILL.md']`). Previously only parent directories were supported. Also improved error handling when a configured skills path is inaccessible (e.g., permission denied), logging a warning instead of breaking discovery for all skills. ([#13031](https://github.com/mastra-ai/mastra/pull/13031))

- Add optional `instruction` field to ObservationalMemory config types ([#13240](https://github.com/mastra-ai/mastra/pull/13240))

  Adds `instruction?: string` to `ObservationalMemoryObservationConfig` and `ObservationalMemoryReflectionConfig` interfaces, allowing external consumers to pass custom instructions to observational memory.

- Added typed workspace providers — `workspace.filesystem` and `workspace.sandbox` now return the concrete types you passed to the constructor, improving autocomplete and eliminating casts. ([#13021](https://github.com/mastra-ai/mastra/pull/13021))

  When mounts are configured, `workspace.filesystem` returns a typed `CompositeFilesystem<TMounts>` with per-key narrowing via `mounts.get()`.

  **Before:**

  ```ts
  const workspace = new Workspace({
    filesystem: new LocalFilesystem({ basePath: '/tmp' }),
    sandbox: new E2BSandbox({ timeout: 60000 }),
  });
  workspace.filesystem; // WorkspaceFilesystem | undefined
  workspace.sandbox; // WorkspaceSandbox | undefined
  ```

  **After:**

  ```ts
  const workspace = new Workspace({
    filesystem: new LocalFilesystem({ basePath: '/tmp' }),
    sandbox: new E2BSandbox({ timeout: 60000 }),
  });
  workspace.filesystem; // LocalFilesystem
  workspace.sandbox; // E2BSandbox

  // Mount-aware workspaces get typed per-key access:
  const ws = new Workspace({
    mounts: { '/local': new LocalFilesystem({ basePath: '/tmp' }) },
  });
  ws.filesystem.mounts.get('/local'); // LocalFilesystem
  ```

- Added support for Vercel AI Gateway in the model router. You can now use `model: 'vercel/google/gemini-3-flash'` with agents and it will route through the official AI SDK gateway provider. ([#13149](https://github.com/mastra-ai/mastra/pull/13149))

- Added workspace and skill storage domains with full CRUD, versioning, and implementations across LibSQL, Postgres, and MongoDB. Added `editor.workspace` and `editor.skill` namespaces for managing workspace configurations and skill definitions through the editor. Agents stored in the editor can now reference workspaces (by ID or inline config) and skills, with full hydration to runtime `Workspace` instances during agent resolution. ([#13156](https://github.com/mastra-ai/mastra/pull/13156))

  **Filesystem-native skill versioning (draft → publish model):**

  Skills are versioned as filesystem trees with content-addressable blob storage. The editing surface (live filesystem) is separated from the serving surface (versioned blob store), enabling a `draft → publish` workflow:
  - `editor.skill.publish(skillId, source, skillPath)` — Snapshots a skill directory from the filesystem into blob storage, creates a new version with a tree manifest, and sets `activeVersionId`
  - Version switching via `editor.skill.update({ id, activeVersionId })` — Points the skill to a previous version without re-publishing
  - Publishing a skill automatically invalidates cached agents that reference it, so they re-hydrate with the updated version on next access

  **Agent skill resolution strategies:**

  Agents can reference skills with different resolution strategies:
  - `strategy: 'latest'` — Resolves the skill's active version (honors `activeVersionId` for rollback)
  - `pin: '<versionId>'` — Pins to a specific version, immune to publishes
  - `strategy: 'live'` — Reads directly from the live filesystem (no blob store)

  **Blob storage infrastructure:**
  - `BlobStore` abstract class for content-addressable storage keyed by SHA-256 hash
  - `InMemoryBlobStore` for testing
  - LibSQL, Postgres, and MongoDB implementations
  - `S3BlobStore` for storing blobs in S3 or S3-compatible storage (AWS, R2, MinIO, DO Spaces)
  - `BlobStoreProvider` interface and `MastraEditorConfig.blobStores` registry for pluggable blob storage
  - `VersionedSkillSource` and `CompositeVersionedSkillSource` for reading skill files from the blob store at runtime

  **New storage types:**
  - `StorageWorkspaceSnapshotType` and `StorageSkillSnapshotType` with corresponding input/output types
  - `StorageWorkspaceRef` for ID-based or inline workspace references on agents
  - `StorageSkillConfig` for per-agent skill overrides (`pin`, `strategy`, description, instructions)
  - `SkillVersionTree` and `SkillVersionTreeEntry` for tree manifests
  - `StorageBlobEntry` for content-addressable blob entries
  - `SKILL_BLOBS_SCHEMA` for the `mastra_skill_blobs` table

  **New editor namespaces:**
  - `editor.workspace` — CRUD for workspace configs, plus `hydrateSnapshotToWorkspace()` for resolving to runtime `Workspace` instances
  - `editor.skill` — CRUD for skill definitions, plus `publish()` for filesystem-to-blob snapshots

  **Provider registries:**
  - `MastraEditorConfig` accepts `filesystems`, `sandboxes`, and `blobStores` provider registries (keyed by provider ID)
  - Built-in `local` filesystem and sandbox providers are auto-registered
  - `editor.resolveBlobStore()` resolves from provider registry or falls back to the storage backend's blobs domain
  - Providers expose `id`, `name`, `description`, `configSchema` (JSON Schema for UI form rendering), and a factory method

  **Storage adapter support:**
  - LibSQL: Full `workspaces`, `skills`, and `blobs` domain implementations
  - Postgres: Full `workspaces`, `skills`, and `blobs` domain implementations
  - MongoDB: Full `workspaces`, `skills`, and `blobs` domain implementations
  - All three include `workspace`, `skills`, and `skillsFormat` fields on agent versions

  **Server endpoints:**
  - `GET/POST/PATCH/DELETE /stored/workspaces` — CRUD for stored workspaces
  - `GET/POST/PATCH/DELETE /stored/skills` — CRUD for stored skills
  - `POST /stored/skills/:id/publish` — Publish a skill from a filesystem source

  ```ts
  import { MastraEditor } from '@mastra/editor';
  import { s3FilesystemProvider, s3BlobStoreProvider } from '@mastra/s3';
  import { e2bSandboxProvider } from '@mastra/e2b';

  const editor = new MastraEditor({
    filesystems: { s3: s3FilesystemProvider },
    sandboxes: { e2b: e2bSandboxProvider },
    blobStores: { s3: s3BlobStoreProvider },
  });

  // Create a skill and publish it
  const skill = await editor.skill.create({
    name: 'Code Review',
    description: 'Reviews code for best practices',
    instructions: 'Analyze the code and provide feedback...',
  });
  await editor.skill.publish(skill.id, source, 'skills/code-review');

  // Agents resolve skills by strategy
  await editor.agent.create({
    name: 'Dev Assistant',
    model: { provider: 'openai', name: 'gpt-4' },
    workspace: { type: 'id', workspaceId: workspace.id },
    skills: { [skill.id]: { strategy: 'latest' } },
    skillsFormat: 'xml',
  });
  ```

- Added draft/publish version management for all editor primitives (agents, scorers, MCP clients, prompt blocks). ([#13061](https://github.com/mastra-ai/mastra/pull/13061))

  **Status filtering on list endpoints** — All list endpoints now accept a `?status=draft|published|archived` query parameter to filter by entity status. Defaults to `published` to preserve backward compatibility.

  **Draft vs published resolution on get-by-id endpoints** — All get-by-id endpoints now accept `?status=draft` to resolve the entity with its latest (unpublished) version, or `?status=published` (default) to resolve with the active published version.

  **Edits no longer auto-publish** — When updating any primitive, a new version is created but `activeVersionId` is no longer automatically updated. Edits stay as drafts until explicitly published via the activate endpoint.

  **Full version management for all primitives** — Scorers, MCP clients, and prompt blocks now have the same version management API that agents have: list versions, create version snapshots, get specific versions, activate/publish, restore from a previous version, delete versions, and compare versions.

  **New prompt block CRUD routes** — Prompt blocks now have full server routes (`GET /stored/prompt-blocks`, `GET /stored/prompt-blocks/:id`, `POST`, `PATCH`, `DELETE`).

  **New version endpoints** — Each primitive now exposes 7 version management endpoints under `/stored/{type}/:id/versions` (list, create, get, activate, restore, delete, compare).

  ```ts
  // Fetch the published version (default behavior, backward compatible)
  const published = await fetch('/api/stored/scorers/my-scorer');

  // Fetch the draft version for editing in the UI
  const draft = await fetch('/api/stored/scorers/my-scorer?status=draft');

  // Publish a specific version
  await fetch('/api/stored/scorers/my-scorer/versions/abc123/activate', { method: 'POST' });

  // Compare two versions
  const diff = await fetch('/api/stored/scorers/my-scorer/versions/compare?from=v1&to=v2');
  ```

- Added `toModelOutput` support to the agent loop. Tool definitions can now include a `toModelOutput` function that transforms the raw tool result before it's sent to the model, while preserving the raw result in storage. This matches the AI SDK `toModelOutput` convention — the function receives the raw output directly and returns `{ type: 'text', value: string }` or `{ type: 'content', value: ContentPart[] }`. ([#13171](https://github.com/mastra-ai/mastra/pull/13171))

  ```ts
  import { createTool } from '@mastra/core/tools';
  import { z } from 'zod';

  const weatherTool = createTool({
    id: 'weather',
    inputSchema: z.object({ city: z.string() }),
    execute: async ({ city }) => ({
      city,
      temperature: 72,
      conditions: 'sunny',
      humidity: 45,
      raw_sensor_data: [0.12, 0.45, 0.78],
    }),
    // The model sees a concise summary instead of the full JSON
    toModelOutput: output => ({
      type: 'text',
      value: `${output.city}: ${output.temperature}°F, ${output.conditions}`,
    }),
  });
  ```

- Added `mastra_workspace_grep` workspace tool for regex-based content search across files. This complements the existing semantic search tool by providing direct pattern matching with support for case-insensitive search, file filtering by extension, context lines, and result limiting. ([#13010](https://github.com/mastra-ai/mastra/pull/13010))

  The tool is automatically available when a workspace has a filesystem configured:

  ```typescript
  import { Workspace, WORKSPACE_TOOLS } from '@mastra/core/workspace';
  import { LocalFilesystem } from '@mastra/core/workspace';

  const workspace = new Workspace({
    filesystem: new LocalFilesystem({ basePath: './my-project' }),
  });

  // The grep tool is auto-injected and available as:
  // WORKSPACE_TOOLS.SEARCH.GREP → 'mastra_workspace_grep'
  ```

- Removed `outputSchema` from workspace tools to return raw text instead of JSON, optimizing for token usage and LLM performance. Structured metadata that was previously returned in tool output is now emitted as `data-workspace-metadata` chunks via `writer.custom()`, keeping it available for UI consumption without passing it to the LLM. Tools are also extracted into individual files and can be imported directly (e.g. `import { readFileTool } from '@mastra/core/workspace'`). ([#13166](https://github.com/mastra-ai/mastra/pull/13166))

### Patch Changes

- dependencies updates: ([#13127](https://github.com/mastra-ai/mastra/pull/13127))
  - Updated dependency [`hono@^4.11.9` ↗︎](https://www.npmjs.com/package/hono/v/4.11.9) (from `^4.11.3`, in `dependencies`)

- dependencies updates: ([#13167](https://github.com/mastra-ai/mastra/pull/13167))
  - Updated dependency [`lru-cache@^11.2.6` ↗︎](https://www.npmjs.com/package/lru-cache/v/11.2.6) (from `^11.2.2`, in `dependencies`)

- Export `AnyWorkspace` type from `@mastra/core/workspace` for accepting any Workspace regardless of generic parameters. Updates Agent and Mastra to use `AnyWorkspace` so workspaces with typed mounts/sandbox (e.g. E2BSandbox, GCSFilesystem) are accepted without type errors. ([#13155](https://github.com/mastra-ai/mastra/pull/13155))

- Update provider registry and model documentation with latest models and providers ([`e37ef84`](https://github.com/mastra-ai/mastra/commit/e37ef8404043c94ca0c8e35ecdedb093b8087878))

- Fixed skill processor tools (skill-activate, skill-search, skill-read-reference, skill-read-script, skill-read-asset) being incorrectly suspended for approval when `requireToolApproval: true` is set. These internal tools now bypass the approval check and execute directly. ([#13160](https://github.com/mastra-ai/mastra/pull/13160))

- Fixed a bug where `requestContext` metadata was not propagated to child spans. When using `requestContextKeys`, only root spans were enriched with request context values — child spans (e.g. `agent_run` inside a workflow) were missing them. All spans in a trace are now correctly enriched. Fixes #12818. ([#12819](https://github.com/mastra-ai/mastra/pull/12819))

- Fixed semantic recall search in Mastra Studio returning no results when using non-default embedding dimensions (e.g., fastembed with 384-dim). The SemanticRecall processor now probes the embedder for its actual output dimension, ensuring the vector index name matches between write and read paths. Previously, the processor defaulted to a 1536-dim index name regardless of the actual embedder, causing a mismatch with the dimension-aware index name used by Studio's search. Fixes #13039 ([#13059](https://github.com/mastra-ai/mastra/pull/13059))

- Fixed `CompositeFilesystem` instructions: agents and tools no longer receive an incorrect claim that files written via workspace tools are accessible at sandbox paths. The instructions now accurately describe only the available mounted filesystems. ([#13221](https://github.com/mastra-ai/mastra/pull/13221))

- Fixed onChunk callback to receive raw Mastra chunks instead of AI SDK v5 converted chunks for tool results. Also added missing onChunk calls for tool-error chunks and tool-result chunks in mixed-error scenarios. ([#13243](https://github.com/mastra-ai/mastra/pull/13243))

- Fixed tool execution errors stopping the agentic loop. The agent now continues after tool errors, allowing the model to see the error and retry with corrected arguments. ([#13242](https://github.com/mastra-ai/mastra/pull/13242))

- Fixed conditional rules not being persisted for workflows, agents, and scorers when creating or updating agents in the CMS. Rules configured on these entities are now correctly saved to storage. ([#13044](https://github.com/mastra-ai/mastra/pull/13044))

- Added runtime `requestContext` forwarding to tool executions. ([#13094](https://github.com/mastra-ai/mastra/pull/13094))

  Tools invoked within agentic workflow steps now receive the caller's `requestContext` — including authenticated API clients, feature flags, and user metadata set by middleware. Runtime `requestContext` is preferred over build-time context when both are available.

  **Why:** Previously, `requestContext` values were silently dropped in two places: (1) the workflow loop stream created a new empty `RequestContext` instead of forwarding the caller's, and (2) `createToolCallStep` didn't pass `requestContext` in tool options. This aligns both the agent generate/stream and agentic workflow paths with the agent network path, where `requestContext` was already forwarded correctly.

  **Before:** Tools received an empty `requestContext`, losing all values set by the workflow step.

  ```ts
  // requestContext with auth data set in workflow step
  requestContext.set('apiClient', authedClient);
  // tool receives empty RequestContext — apiClient is undefined
  ```

  **After:** Pass `requestContext` via `MastraToolInvocationOptions` and tools receive it.

  ```ts
  // requestContext with auth data flows through to the tool
  requestContext.set('apiClient', authedClient);
  // tool receives the same RequestContext — apiClient is available
  ```

  Fixes #13088

- Fixed tsc out-of-memory crash caused by step-schema.d.ts expanding to 50k lines. Added explicit type annotations to all exported Zod schema constants, reducing declaration output from 49,729 to ~500 lines without changing runtime behavior. ([#13229](https://github.com/mastra-ai/mastra/pull/13229))

- Fixed TypeScript type generation hanging or running out of memory when packages depend on @mastra/core tool types. Changed ZodLikeSchema from a nominal union type to structural typing, which prevents TypeScript from performing deep comparisons of zod v3/v4 type trees during generic inference. ([#13239](https://github.com/mastra-ai/mastra/pull/13239))

- Fixed tool execution errors being emitted as `tool-result` instead of `tool-error` in fullStream. Previously, when a tool's execute function threw an error, the error was caught and returned as a value, causing the stream to emit a `tool-result` chunk containing the error object. Now errors are properly propagated, so the stream emits `tool-error` chunks, allowing consumers (including the `@mastra/ai-sdk` conversion pipeline) to correctly distinguish between successful tool results and failed tool executions. Fixes #13123. ([#13147](https://github.com/mastra-ai/mastra/pull/13147))

- Fixed thread title not being generated for pre-created threads. When threads were created before starting a conversation (e.g., for URL routing or storing metadata), the title stayed as a placeholder because the title generation condition checked whether the thread existed rather than whether it had a title. Threads created without an explicit title now get an empty title instead of a placeholder, and title generation fires whenever a thread has no title. Resolves #13145. ([#13151](https://github.com/mastra-ai/mastra/pull/13151))

- Fixed `inputData` in `dowhile` and `dountil` loop condition functions to be properly typed as the step's output schema instead of `any`. This means you no longer need to manually cast `inputData` in your loop conditions — TypeScript will now correctly infer the type from your step's `outputSchema`. ([#12977](https://github.com/mastra-ai/mastra/pull/12977))

- Migrated MastraCode from the prototype harness to the generic CoreHarness from @mastra/core. The createMastraCode function is now fully configurable with optional parameters for modes, subagents, storage, tools, and more. Removed the deprecated prototype harness implementation. ([#13245](https://github.com/mastra-ai/mastra/pull/13245))

- Fixed the writer object being undefined in processOutputStream, allowing output processors to emit custom events to the stream during chunk processing. This enables use cases like streaming moderation results back to the client. ([#13056](https://github.com/mastra-ai/mastra/pull/13056))

- Fixed sub-agent tool approval resume flow. When a sub-agent tool required approval and was approved, the agent would restart from scratch instead of resuming, causing an infinite loop. The resume data is now correctly passed through for agent tools so they properly resume after approval. ([#13241](https://github.com/mastra-ai/mastra/pull/13241))

- Dataset schemas now appear in the Edit Dataset dialog. Previously the `inputSchema` and `groundTruthSchema` fields were not passed to the dialog, so editing a dataset always showed empty schemas. ([#13175](https://github.com/mastra-ai/mastra/pull/13175))

  Schema edits in the JSON editor no longer cause the cursor to jump to the top of the field. Typing `{"type": "object"}` in the schema editor now behaves like a normal text input instead of resetting on every keystroke.

  Validation errors are now surfaced when updating a dataset schema that conflicts with existing items. For example, adding a `required: ["name"]` constraint when existing items lack a `name` field now shows "2 existing item(s) fail validation" in the dialog instead of silently dropping the error.

  Disabling a dataset schema from the Studio UI now correctly clears it. Previously the server converted `null` (disable) to `undefined` (no change), so the old schema persisted and validation continued.

  Workflow schemas fetched via `client.getWorkflow().getSchema()` are now correctly parsed. The server serializes schemas with `superjson`, but the client was using plain `JSON.parse`, yielding a `{json: {...}}` wrapper instead of the actual JSON Schema object.

- Fixed network mode messages missing metadata for filtering. All internal network messages (sub-agent results, tool execution results, workflow results) now include `metadata.mode: 'network'` in their content metadata, making it possible to filter them from user-facing messages without parsing JSON content. Previously, consumers had to parse the JSON body of each message to check for `isNetwork: true` — now they can simply check `message.content.metadata.mode === 'network'`. Fixes #13106. ([#13144](https://github.com/mastra-ai/mastra/pull/13144))

- Fixed sub-agent memory context pollution that caused 'Exhausted all fallback models' errors when using Observational Memory with sub-agents. The parent agent's memory context is now preserved across sub-agent tool execution. ([#13051](https://github.com/mastra-ai/mastra/pull/13051))

- CMS draft support with status badges for agents. ([#13194](https://github.com/mastra-ai/mastra/pull/13194))
  - Agent list now resolves the latest (draft) version for each stored agent, showing current edits rather than the last published state.
  - Added `hasDraft` and `activeVersionId` fields to the agent list API response.
  - Agent list badges: "Published" (green) when a published version exists, "Draft" (colored when unpublished changes exist, grayed out otherwise).
  - Added `resolvedVersionId` to all `StorageResolved*Type` types so the server can detect whether the latest version differs from the active version.
  - Added `status` option to `GetByIdOptions` to allow resolving draft vs published versions through the editor layer.
  - Fixed editor cache not being cleared on version activate, restore, and delete — all four versioned domains (agents, scorers, prompt-blocks, mcp-clients) now clear the cache after version mutations.
  - Added `ALTER TABLE` migration for `mastra_agent_versions` in libsql and pg to add newer columns (`mcpClients`, `requestContextSchema`, `workspace`, `skills`, `skillsFormat`).

- Added scorer version management and CMS draft/publish flow for scorers. ([#13194](https://github.com/mastra-ai/mastra/pull/13194))
  - Added scorer version methods to the client SDK: `listVersions`, `createVersion`, `getVersion`, `activateVersion`, `restoreVersion`, `deleteVersion`, `compareVersions`.
  - Added `ScorerVersionCombobox` for navigating scorer versions with Published/Draft labels.
  - Scorer edit page now supports Save (draft) and Publish workflows with an "Unpublished changes" indicator.
  - Storage list methods for agents and scorers no longer default to filtering only published entities, allowing drafts to appear in the playground.

- Fixed CompositeAuth losing public and protected route configurations from underlying auth providers. Routes marked as public or protected now work correctly when deployed to Mastra Cloud. ([#13086](https://github.com/mastra-ai/mastra/pull/13086))

- Trimmed the agent experiment result `output` to only persist relevant fields instead of the entire `FullOutput` blob. The stored output now contains: `text`, `object`, `toolCalls`, `toolResults`, `sources`, `files`, `usage`, `reasoningText`, `traceId`, and `error`. ([#13158](https://github.com/mastra-ai/mastra/pull/13158))

  Dropped fields like `steps`, `response`, `messages`, `rememberedMessages`, `request`, `providerMetadata`, `warnings`, `scoringData`, `suspendPayload`, and other provider/debugging internals that were duplicated elsewhere or not useful for experiment evaluation.

- Fixed `.branch()` condition receiving `undefined` inputData when resuming a suspended nested workflow after `.map()`. ([#13055](https://github.com/mastra-ai/mastra/pull/13055))

  Previously, when a workflow used `.map()` followed by `.branch()` and a nested workflow inside the branch called `suspend()`, resuming would fail with `TypeError: Cannot read properties of undefined` because the branch conditions were unnecessarily re-evaluated with stale data.

  Resume now skips condition re-evaluation for `.branch()` entries and goes directly to the correct suspended branch, matching the existing behavior for `.parallel()` entries.

  Fixes #12982

## 1.4.0

### Minor Changes

- Added Datasets and Experiments to core. Datasets let you store and version collections of test inputs with JSON Schema validation. Experiments let you run AI outputs against dataset items with configurable scorers to track quality over time. ([#12747](https://github.com/mastra-ai/mastra/pull/12747))

  **New exports from `@mastra/core/datasets`:**
  - `DatasetsManager` — orchestrates dataset CRUD, item versioning (SCD-2), and experiment execution
  - `Dataset` — single-dataset handle for adding items and running experiments

  **New storage domains:**
  - `DatasetsStorage` — abstract base class for dataset persistence (datasets, items, versions)
  - `ExperimentsStorage` — abstract base class for experiment lifecycle and result tracking

  **Example:**

  ```ts
  import { Mastra } from '@mastra/core';

  const mastra = new Mastra({
    /* ... */
  });

  const dataset = await mastra.datasets.create({ name: 'my-eval-set' });
  await dataset.addItems([{ input: { query: 'What is 2+2?' }, groundTruth: { answer: '4' } }]);

  const result = await dataset.runExperiment({
    targetType: 'agent',
    targetId: 'my-agent',
    scorerIds: ['accuracy'],
  });
  ```

- Fix LocalFilesystem.resolvePath handling of absolute paths and improve filesystem info. ([#12971](https://github.com/mastra-ai/mastra/pull/12971))
  - Fix absolute path resolution: paths were incorrectly stripped of leading slashes and resolved relative to basePath, causing PermissionError for valid paths (e.g. skills processor accessing project-local skills directories).
  - Make `FilesystemInfo` generic (`FilesystemInfo<TMetadata>`) so providers can type their metadata.
  - Move provider-specific fields (`basePath`, `contained`) to metadata in LocalFilesystem.getInfo().
  - Update LocalFilesystem.getInstructions() for uncontained filesystems to warn agents against listing /.
  - Use FilesystemInfo type in WorkspaceInfo instead of duplicated inline shape.

- Add `workflow-step-progress` stream event for foreach workflow steps. Each iteration emits a progress event with `completedCount`, `totalCount`, `currentIndex`, `iterationStatus` (`success` | `failed` | `suspended`), and optional `iterationOutput`. Both the default and evented execution engines emit these events. ([#12838](https://github.com/mastra-ai/mastra/pull/12838))

  The Mastra Studio UI now renders a progress bar with an N/total counter on foreach nodes, updating in real time as iterations complete:

  ```ts
  // Consuming progress events from the workflow stream
  const run = workflow.createRun();
  const result = await run.start({ inputData });
  const stream = result.stream;

  for await (const chunk of stream) {
    if (chunk.type === 'workflow-step-progress') {
      console.log(`${chunk.payload.completedCount}/${chunk.payload.totalCount} - ${chunk.payload.iterationStatus}`);
    }
  }
  ```

  `@mastra/react`: The `mapWorkflowStreamChunkToWatchResult` reducer now accumulates `foreachProgress` from `workflow-step-progress` events into step state, making progress data available to React consumers via the existing workflow watch hooks.

- Added observational memory configuration support for stored agents. When creating or editing a stored agent in the playground, you can now enable observational memory and configure its settings including model provider/name, scope (thread or resource), share token budget, and detailed observer/reflector parameters like token limits, buffer settings, and blocking thresholds. The configuration is serialized as part of the agent's memory config and round-trips through storage. ([#12962](https://github.com/mastra-ai/mastra/pull/12962))

  **Example usage in the playground:**

  Enable the Observational Memory toggle in the Memory section, then configure:
  - Top-level model (provider + model) used by both observer and reflector
  - Scope: `thread` (per-conversation) or `resource` (shared across threads)
  - Expand **Observer** or **Reflector** sections to override models and tune token budgets

  **Programmatic usage via client SDK:**

  ```ts
  await client.createStoredAgent({
    name: 'My Agent',
    // ...other config
    memory: {
      observationalMemory: true, // enable with defaults
      options: { lastMessages: 40 },
    },
  });

  // Or with custom configuration:
  await client.createStoredAgent({
    name: 'My Agent',
    memory: {
      observationalMemory: {
        model: 'google/gemini-2.5-flash',
        scope: 'resource',
        shareTokenBudget: true,
        observation: { messageTokens: 50000 },
        reflection: { observationTokens: 60000 },
      },
      options: { lastMessages: 40 },
    },
  });
  ```

  **Programmatic usage via editor:**

  ```ts
  await editor.agent.create({
    name: 'My Agent',
    // ...other config
    memory: {
      observationalMemory: true, // enable with defaults
      options: { lastMessages: 40 },
    },
  });

  // Or with custom configuration:
  await editor.agent.create({
    name: 'My Agent',
    memory: {
      observationalMemory: {
        model: 'google/gemini-2.5-flash',
        scope: 'resource',
        shareTokenBudget: true,
        observation: { messageTokens: 50000 },
        reflection: { observationTokens: 60000 },
      },
      options: { lastMessages: 40 },
    },
  });
  ```

- Added MCP client storage domain and ToolProvider interface for integrating external tool catalogs with stored agents. ([#12974](https://github.com/mastra-ai/mastra/pull/12974))

  **MCP Client Storage**

  New storage domain for persisting MCP client configurations with CRUD operations. Each MCP client can contain multiple servers with independent tool selection:

  ```ts
  // Store an MCP client with multiple servers
  await storage.mcpClients.create({
    id: 'my-mcp',
    name: 'My MCP Client',
    servers: {
      'github-server': { url: 'https://mcp.github.com/sse' },
      'slack-server': { url: 'https://mcp.slack.com/sse' },
    },
  });
  ```

  LibSQL, PostgreSQL, and MongoDB storage adapters all implement the new MCP client domain.

  **ToolProvider Interface**

  New `ToolProvider` interface at `@mastra/core/tool-provider` enables third-party tool catalog integration (e.g., Composio, Arcade AI):

  ```ts
  import type { ToolProvider } from '@mastra/core/tool-provider';

  # Providers implement: listToolkits(), listTools(), getToolSchema(), resolveTools()
  ```

  `resolveTools()` receives `requestContext` from the current request, enabling per-user API keys and credentials in multi-tenant setups:

  ```ts
  const tools = await provider.resolveTools(slugs, configs, {
    requestContext: { apiKey: 'user-specific-key', userId: 'tenant-123' },
  });
  ```

  **Tool Selection Semantics**

  Both `mcpClients` and `integrationTools` on stored agents follow consistent three-state selection:
  - `{ tools: undefined }` — provider registered, no tools selected
  - `{ tools: {} }` — all tools from provider included
  - `{ tools: { 'TOOL_SLUG': { description: '...' } } }` — specific tools with optional overrides

- **Added** ([#12764](https://github.com/mastra-ai/mastra/pull/12764))
  Added a `suppressFeedback` option to hide internal completion‑check messages from the stream. This keeps the conversation history clean while leaving existing behavior unchanged by default.

  **Example**
  Before:

  ```ts
  const agent = await mastra.createAgent({
    completion: { validate: true },
  });
  ```

  After:

  ```ts
  const agent = await mastra.createAgent({
    completion: { validate: true, suppressFeedback: true },
  });
  ```

- **Split workspace lifecycle interfaces** ([#12978](https://github.com/mastra-ai/mastra/pull/12978))

  The shared `Lifecycle` interface has been split into provider-specific types that match actual usage:
  - `FilesystemLifecycle` — two-phase: `init()` → `destroy()`
  - `SandboxLifecycle` — three-phase: `start()` → `stop()` → `destroy()`

  The base `Lifecycle` type is still exported for backward compatibility.

  **Added `onInit` / `onDestroy` callbacks to `MastraFilesystem`**

  The `MastraFilesystem` base class now accepts optional lifecycle callbacks via `MastraFilesystemOptions`, matching the existing `onStart` / `onStop` / `onDestroy` callbacks on `MastraSandbox`.

  ```ts
  const fs = new LocalFilesystem({
    basePath: './data',
    onInit: ({ filesystem }) => {
      console.log('Filesystem ready:', filesystem.status);
    },
    onDestroy: ({ filesystem }) => {
      console.log('Cleaning up...');
    },
  });
  ```

  `onInit` fires after the filesystem reaches `ready` status (non-fatal on failure). `onDestroy` fires before the filesystem is torn down.

### Patch Changes

- Update provider registry and model documentation with latest models and providers ([`7ef618f`](https://github.com/mastra-ai/mastra/commit/7ef618f3c49c27e2f6b27d7f564c557c0734325b))

- Fixed agent version storage to persist the requestContextSchema field. Previously, requestContextSchema was defined on the agent snapshot type but was not included in the database schema, INSERT statements, or row parsing logic, causing it to be silently dropped when saving and loading agent versions. ([#13003](https://github.com/mastra-ai/mastra/pull/13003))

- Fixed Anthropic API rejection errors caused by empty text content blocks in assistant messages. During streaming with web search citations, empty text parts could be persisted to the database and then rejected by Anthropic's API with 'text content blocks must be non-empty' errors. The fix filters out these empty text blocks before persistence, ensuring stored conversation history remains valid for Anthropic models. Fixes `#12553`. ([#12711](https://github.com/mastra-ai/mastra/pull/12711))

- Improve error messages when processor workflows or model fallback retries fail. ([#12970](https://github.com/mastra-ai/mastra/pull/12970))
  - Include the last error message and cause when all fallback models are exhausted, instead of the generic "Exhausted all fallback models" message.
  - Extract error details from failed workflow results and individual step failures when a processor workflow fails, instead of just reporting "failed with status: failed".

- Fixed tool-not-found errors crashing the agentic loop. When a model hallucinates a tool name (e.g., Gemini 3 Flash adding prefixes like `creating:view` instead of `view`), the error is now returned to the model as a tool result instead of throwing. This allows the model to self-correct and retry with the correct tool name on the next turn. The error message includes available tool names to help the model recover. Fixes #12895. ([#12961](https://github.com/mastra-ai/mastra/pull/12961))

- Fixed structured output failing with Anthropic models when memory is enabled. The error "assistant message in the final position" occurred because the prompt sent to Anthropic ended with an assistant-role message, which is not supported when using output format. Resolves https://github.com/mastra-ai/mastra/issues/12800 ([#12835](https://github.com/mastra-ai/mastra/pull/12835))

## 1.4.0-alpha.0

### Minor Changes

- Added Datasets and Experiments to core. Datasets let you store and version collections of test inputs with JSON Schema validation. Experiments let you run AI outputs against dataset items with configurable scorers to track quality over time. ([#12747](https://github.com/mastra-ai/mastra/pull/12747))

  **New exports from `@mastra/core/datasets`:**
  - `DatasetsManager` — orchestrates dataset CRUD, item versioning (SCD-2), and experiment execution
  - `Dataset` — single-dataset handle for adding items and running experiments

  **New storage domains:**
  - `DatasetsStorage` — abstract base class for dataset persistence (datasets, items, versions)
  - `ExperimentsStorage` — abstract base class for experiment lifecycle and result tracking

  **Example:**

  ```ts
  import { Mastra } from '@mastra/core';

  const mastra = new Mastra({
    /* ... */
  });

  const dataset = await mastra.datasets.create({ name: 'my-eval-set' });
  await dataset.addItems([{ input: { query: 'What is 2+2?' }, groundTruth: { answer: '4' } }]);

  const result = await dataset.runExperiment({
    targetType: 'agent',
    targetId: 'my-agent',
    scorerIds: ['accuracy'],
  });
  ```

- Fix LocalFilesystem.resolvePath handling of absolute paths and improve filesystem info. ([#12971](https://github.com/mastra-ai/mastra/pull/12971))
  - Fix absolute path resolution: paths were incorrectly stripped of leading slashes and resolved relative to basePath, causing PermissionError for valid paths (e.g. skills processor accessing project-local skills directories).
  - Make `FilesystemInfo` generic (`FilesystemInfo<TMetadata>`) so providers can type their metadata.
  - Move provider-specific fields (`basePath`, `contained`) to metadata in LocalFilesystem.getInfo().
  - Update LocalFilesystem.getInstructions() for uncontained filesystems to warn agents against listing /.
  - Use FilesystemInfo type in WorkspaceInfo instead of duplicated inline shape.

- Add `workflow-step-progress` stream event for foreach workflow steps. Each iteration emits a progress event with `completedCount`, `totalCount`, `currentIndex`, `iterationStatus` (`success` | `failed` | `suspended`), and optional `iterationOutput`. Both the default and evented execution engines emit these events. ([#12838](https://github.com/mastra-ai/mastra/pull/12838))

  The Mastra Studio UI now renders a progress bar with an N/total counter on foreach nodes, updating in real time as iterations complete:

  ```ts
  // Consuming progress events from the workflow stream
  const run = workflow.createRun();
  const result = await run.start({ inputData });
  const stream = result.stream;

  for await (const chunk of stream) {
    if (chunk.type === 'workflow-step-progress') {
      console.log(`${chunk.payload.completedCount}/${chunk.payload.totalCount} - ${chunk.payload.iterationStatus}`);
    }
  }
  ```

  `@mastra/react`: The `mapWorkflowStreamChunkToWatchResult` reducer now accumulates `foreachProgress` from `workflow-step-progress` events into step state, making progress data available to React consumers via the existing workflow watch hooks.

- Added observational memory configuration support for stored agents. When creating or editing a stored agent in the playground, you can now enable observational memory and configure its settings including model provider/name, scope (thread or resource), share token budget, and detailed observer/reflector parameters like token limits, buffer settings, and blocking thresholds. The configuration is serialized as part of the agent's memory config and round-trips through storage. ([#12962](https://github.com/mastra-ai/mastra/pull/12962))

  **Example usage in the playground:**

  Enable the Observational Memory toggle in the Memory section, then configure:
  - Top-level model (provider + model) used by both observer and reflector
  - Scope: `thread` (per-conversation) or `resource` (shared across threads)
  - Expand **Observer** or **Reflector** sections to override models and tune token budgets

  **Programmatic usage via client SDK:**

  ```ts
  await client.createStoredAgent({
    name: 'My Agent',
    // ...other config
    memory: {
      observationalMemory: true, // enable with defaults
      options: { lastMessages: 40 },
    },
  });

  // Or with custom configuration:
  await client.createStoredAgent({
    name: 'My Agent',
    memory: {
      observationalMemory: {
        model: 'google/gemini-2.5-flash',
        scope: 'resource',
        shareTokenBudget: true,
        observation: { messageTokens: 50000 },
        reflection: { observationTokens: 60000 },
      },
      options: { lastMessages: 40 },
    },
  });
  ```

  **Programmatic usage via editor:**

  ```ts
  await editor.agent.create({
    name: 'My Agent',
    // ...other config
    memory: {
      observationalMemory: true, // enable with defaults
      options: { lastMessages: 40 },
    },
  });

  // Or with custom configuration:
  await editor.agent.create({
    name: 'My Agent',
    memory: {
      observationalMemory: {
        model: 'google/gemini-2.5-flash',
        scope: 'resource',
        shareTokenBudget: true,
        observation: { messageTokens: 50000 },
        reflection: { observationTokens: 60000 },
      },
      options: { lastMessages: 40 },
    },
  });
  ```

- Added MCP client storage domain and ToolProvider interface for integrating external tool catalogs with stored agents. ([#12974](https://github.com/mastra-ai/mastra/pull/12974))

  **MCP Client Storage**

  New storage domain for persisting MCP client configurations with CRUD operations. Each MCP client can contain multiple servers with independent tool selection:

  ```ts
  // Store an MCP client with multiple servers
  await storage.mcpClients.create({
    id: 'my-mcp',
    name: 'My MCP Client',
    servers: {
      'github-server': { url: 'https://mcp.github.com/sse' },
      'slack-server': { url: 'https://mcp.slack.com/sse' },
    },
  });
  ```

  LibSQL, PostgreSQL, and MongoDB storage adapters all implement the new MCP client domain.

  **ToolProvider Interface**

  New `ToolProvider` interface at `@mastra/core/tool-provider` enables third-party tool catalog integration (e.g., Composio, Arcade AI):

  ```ts
  import type { ToolProvider } from '@mastra/core/tool-provider';

  # Providers implement: listToolkits(), listTools(), getToolSchema(), resolveTools()
  ```

  `resolveTools()` receives `requestContext` from the current request, enabling per-user API keys and credentials in multi-tenant setups:

  ```ts
  const tools = await provider.resolveTools(slugs, configs, {
    requestContext: { apiKey: 'user-specific-key', userId: 'tenant-123' },
  });
  ```

  **Tool Selection Semantics**

  Both `mcpClients` and `integrationTools` on stored agents follow consistent three-state selection:
  - `{ tools: undefined }` — provider registered, no tools selected
  - `{ tools: {} }` — all tools from provider included
  - `{ tools: { 'TOOL_SLUG': { description: '...' } } }` — specific tools with optional overrides

- **Added** ([#12764](https://github.com/mastra-ai/mastra/pull/12764))
  Added a `suppressFeedback` option to hide internal completion‑check messages from the stream. This keeps the conversation history clean while leaving existing behavior unchanged by default.

  **Example**
  Before:

  ```ts
  const agent = await mastra.createAgent({
    completion: { validate: true },
  });
  ```

  After:

  ```ts
  const agent = await mastra.createAgent({
    completion: { validate: true, suppressFeedback: true },
  });
  ```

- **Split workspace lifecycle interfaces** ([#12978](https://github.com/mastra-ai/mastra/pull/12978))

  The shared `Lifecycle` interface has been split into provider-specific types that match actual usage:
  - `FilesystemLifecycle` — two-phase: `init()` → `destroy()`
  - `SandboxLifecycle` — three-phase: `start()` → `stop()` → `destroy()`

  The base `Lifecycle` type is still exported for backward compatibility.

  **Added `onInit` / `onDestroy` callbacks to `MastraFilesystem`**

  The `MastraFilesystem` base class now accepts optional lifecycle callbacks via `MastraFilesystemOptions`, matching the existing `onStart` / `onStop` / `onDestroy` callbacks on `MastraSandbox`.

  ```ts
  const fs = new LocalFilesystem({
    basePath: './data',
    onInit: ({ filesystem }) => {
      console.log('Filesystem ready:', filesystem.status);
    },
    onDestroy: ({ filesystem }) => {
      console.log('Cleaning up...');
    },
  });
  ```

  `onInit` fires after the filesystem reaches `ready` status (non-fatal on failure). `onDestroy` fires before the filesystem is torn down.

### Patch Changes

- Update provider registry and model documentation with latest models and providers ([`7ef618f`](https://github.com/mastra-ai/mastra/commit/7ef618f3c49c27e2f6b27d7f564c557c0734325b))

- Fixed agent version storage to persist the requestContextSchema field. Previously, requestContextSchema was defined on the agent snapshot type but was not included in the database schema, INSERT statements, or row parsing logic, causing it to be silently dropped when saving and loading agent versions. ([#13003](https://github.com/mastra-ai/mastra/pull/13003))

- Fixed Anthropic API rejection errors caused by empty text content blocks in assistant messages. During streaming with web search citations, empty text parts could be persisted to the database and then rejected by Anthropic's API with 'text content blocks must be non-empty' errors. The fix filters out these empty text blocks before persistence, ensuring stored conversation history remains valid for Anthropic models. Fixes `#12553`. ([#12711](https://github.com/mastra-ai/mastra/pull/12711))

- Improve error messages when processor workflows or model fallback retries fail. ([#12970](https://github.com/mastra-ai/mastra/pull/12970))
  - Include the last error message and cause when all fallback models are exhausted, instead of the generic "Exhausted all fallback models" message.
  - Extract error details from failed workflow results and individual step failures when a processor workflow fails, instead of just reporting "failed with status: failed".

- Fixed tool-not-found errors crashing the agentic loop. When a model hallucinates a tool name (e.g., Gemini 3 Flash adding prefixes like `creating:view` instead of `view`), the error is now returned to the model as a tool result instead of throwing. This allows the model to self-correct and retry with the correct tool name on the next turn. The error message includes available tool names to help the model recover. Fixes #12895. ([#12961](https://github.com/mastra-ai/mastra/pull/12961))

- Fixed structured output failing with Anthropic models when memory is enabled. The error "assistant message in the final position" occurred because the prompt sent to Anthropic ended with an assistant-role message, which is not supported when using output format. Resolves https://github.com/mastra-ai/mastra/issues/12800 ([#12835](https://github.com/mastra-ai/mastra/pull/12835))

## 1.3.0

### Minor Changes

- Added mount support to workspaces, so you can combine multiple storage providers (S3, GCS, local disk, etc.) under a single directory tree. This lets agents access files from different sources through one unified filesystem. ([#12851](https://github.com/mastra-ai/mastra/pull/12851))

  **Why:** Previously a workspace could only use one filesystem. With mounts, you can organize files from different providers under different paths — for example, S3 data at `/data` and GCS models at `/models` — without agents needing to know which provider backs each path.

  **What's new:**
  - Added `CompositeFilesystem` for combining multiple filesystems under one tree
  - Added descriptive error types for sandbox and mount failures (e.g., `SandboxTimeoutError`, `MountError`)
  - Improved `MastraFilesystem` and `MastraSandbox` base classes with safer concurrent lifecycle handling

  ```ts
  import { Workspace, CompositeFilesystem } from '@mastra/core/workspace';

  // Mount multiple filesystems under one tree
  const composite = new CompositeFilesystem({
    mounts: {
      '/data': s3Filesystem,
      '/models': gcsFilesystem,
    },
  });

  const workspace = new Workspace({
    filesystem: composite,
    sandbox: e2bSandbox,
  });
  ```

- Supporting work to allow for cloning agents via the client SDK ([#12796](https://github.com/mastra-ai/mastra/pull/12796))

- Added `requestContextSchema` and rule-based conditional fields for stored agents. ([#12896](https://github.com/mastra-ai/mastra/pull/12896))

  Stored agent fields (`tools`, `model`, `workflows`, `agents`, `memory`, `scorers`, `inputProcessors`, `outputProcessors`, `defaultOptions`) can now be configured as conditional variants with rule groups that evaluate against request context at runtime. All matching variants accumulate — arrays are concatenated and objects are shallow-merged — so agents dynamically compose their configuration based on the incoming request context.

  **New `requestContextSchema` field**

  Stored agents now accept an optional `requestContextSchema` (JSON Schema) that is converted to a Zod schema and passed to the Agent constructor, enabling request context validation.

  **Conditional field example**

  ```ts
  await agentsStore.create({
    agent: {
      id: 'my-agent',
      name: 'My Agent',
      instructions: 'You are a helpful assistant',
      model: { provider: 'openai', name: 'gpt-4' },
      tools: [
        { value: { 'basic-tool': {} } },
        {
          value: { 'premium-tool': {} },
          rules: {
            operator: 'AND',
            conditions: [{ field: 'tier', operator: 'equals', value: 'premium' }],
          },
        },
      ],
      requestContextSchema: {
        type: 'object',
        properties: { tier: { type: 'string' } },
      },
    },
  });
  ```

- Implement underlying storage changes to allow for dynamic instructions in stored agents (for `@mastra/editor`) ([#12776](https://github.com/mastra-ai/mastra/pull/12776))

- Add native `@ai-sdk/groq` support to model router. Groq models now use the official AI SDK package instead of falling back to OpenAI-compatible mode. ([#12741](https://github.com/mastra-ai/mastra/pull/12741))

- **Added stored scorer definitions, editor namespace pattern, and generic storage domains** ([#12846](https://github.com/mastra-ai/mastra/pull/12846))
  - Added a new `scorer-definitions` storage domain for storing LLM-as-judge and preset scorer configurations in the database
  - Introduced a `VersionedStorageDomain` generic base class that unifies `AgentsStorage`, `PromptBlocksStorage`, and `ScorerDefinitionsStorage` with shared CRUD methods (`create`, `getById`, `getByIdResolved`, `update`, `delete`, `list`, `listResolved`)
  - Flattened stored scorer type system: replaced nested `preset`/`customLLMJudge` config with top-level `type`, `instructions`, `scoreRange`, and `presetConfig` fields
  - Refactored `MastraEditor` to use a namespace pattern (`editor.agent.*`, `editor.scorer.*`, `editor.prompt.*`) backed by a `CrudEditorNamespace` base class with built-in caching and an `onCacheEvict` hook
  - Added `rawConfig` support to `MastraBase` and `MastraScorer` via `toRawConfig()`, so hydrated primitives carry their stored configuration
  - Added prompt block and scorer registration to the `Mastra` class (`addPromptBlock`, `removePromptBlock`, `addScorer`, `removeScorer`)

  **Creating a stored scorer (LLM-as-judge):**

  ```ts
  const scorer = await editor.scorer.create({
    id: 'my-scorer',
    name: 'Response Quality',
    type: 'llm-judge',
    instructions: 'Evaluate the response for accuracy and helpfulness.',
    model: { provider: 'openai', name: 'gpt-4o' },
    scoreRange: { min: 0, max: 1 },
  });
  ```

  **Retrieving and resolving a stored scorer:**

  ```ts
  // Fetch the stored definition from DB
  const definition = await editor.scorer.getById('my-scorer');

  // Resolve it into a runnable MastraScorer instance
  const runnableScorer = editor.scorer.resolve(definition);

  // Execute the scorer
  const result = await runnableScorer.run({
    input: 'What is the capital of France?',
    output: 'The capital of France is Paris.',
  });
  ```

  **Editor namespace pattern (before/after):**

  ```ts
  // Before
  const agent = await editor.getStoredAgentById('abc');
  const prompts = await editor.listPromptBlocks();

  // After
  const agent = await editor.agent.getById('abc');
  const prompts = await editor.prompt.list();
  ```

  **Generic storage domain methods (before/after):**

  ```ts
  // Before
  const store = storage.getStore('agents');
  await store.createAgent({ agent: input });
  await store.getAgentById({ id: 'abc' });
  await store.deleteAgent({ id: 'abc' });

  // After
  const store = storage.getStore('agents');
  await store.create({ agent: input });
  await store.getById('abc');
  await store.delete('abc');
  ```

- Added mount status and error information to filesystem directory listings, so the UI can show whether each mount is healthy or has issues. Improved error handling when mount operations fail. Fixed tree formatter to use case-insensitive sorting to match native tree output. ([#12605](https://github.com/mastra-ai/mastra/pull/12605))

- Added workspace registration and tool context support. ([#12607](https://github.com/mastra-ai/mastra/pull/12607))

  **Why** - Makes it easier to manage multiple workspaces at runtime and lets tools read/write files in the intended workspace.

  **Workspace Registration** - Added a workspace registry so you can list and fetch workspaces by id with `addWorkspace()`, `getWorkspaceById()`, and `listWorkspaces()`. Agent workspaces are auto-registered when adding agents.

  **Before**

  ```typescript
  const mastra = new Mastra({ workspace: myWorkspace });
  // No way to look up workspaces by id or list all workspaces
  ```

  **After**

  ```typescript
  const mastra = new Mastra({ workspace: myWorkspace });

  // Look up by id
  const ws = mastra.getWorkspaceById('my-workspace');

  // List all registered workspaces
  const allWorkspaces = mastra.listWorkspaces();

  // Register additional workspaces
  mastra.addWorkspace(anotherWorkspace);
  ```

  **Tool Workspace Access** - Tools can access the workspace through `context.workspace` during execution, enabling filesystem and sandbox operations.

  ```typescript
  const myTool = createTool({
    id: 'file-reader',
    execute: async ({ context }) => {
      const fs = context.workspace?.filesystem;
      const content = await fs?.readFile('config.json');
      return { content };
    },
  });
  ```

  **Dynamic Workspace Configuration** - Workspace can be configured dynamically via agent config functions. Dynamically created workspaces are auto-registered with Mastra, making them available via `listWorkspaces()`.

  ```typescript
  const agent = new Agent({
    workspace: ({ mastra, requestContext }) => {
      // Return workspace dynamically based on context
      const workspaceId = requestContext?.get('workspaceId') || 'default';
      return mastra.getWorkspaceById(workspaceId);
    },
  });
  ```

- Add tool description overrides for stored agents: ([#12794](https://github.com/mastra-ai/mastra/pull/12794))
  - Changed stored agent `tools` field from `string[]` to `Record<string, { description?: string }>` to allow per-tool description overrides
  - When a stored agent specifies a custom `description` for a tool, the override is applied at resolution time
  - Updated server API schemas, client SDK types, and editor resolution logic accordingly

- **Breaking:** Removed `cloneAgent()` from the `Agent` class. Agent cloning is now handled by the editor package via `editor.agent.clone()`. ([#12904](https://github.com/mastra-ai/mastra/pull/12904))

  If you were calling `agent.cloneAgent()` directly, use the editor's agent namespace instead:

  ```ts
  // Before
  const result = await agent.cloneAgent({ newId: 'my-clone' });

  // After
  const editor = mastra.getEditor();
  const result = await editor.agent.clone(agent, { newId: 'my-clone' });
  ```

  **Why:** The `Agent` class should not be responsible for storage serialization. The editor package already handles converting between runtime agents and stored configurations, so cloning belongs there.

  **Added** `getConfiguredProcessorIds()` to the `Agent` class, which returns raw input/output processor IDs for the agent's configuration.

### Patch Changes

- Update provider registry and model documentation with latest models and providers ([`717ffab`](https://github.com/mastra-ai/mastra/commit/717ffab42cfd58ff723b5c19ada4939997773004))

- Fixed observational memory progress bars resetting to zero after agent responses finish. ([#12934](https://github.com/mastra-ai/mastra/pull/12934))

- Fixed issues with stored agents ([#12790](https://github.com/mastra-ai/mastra/pull/12790))

- Fixed sub-agent tool approval and suspend events not being surfaced to the parent agent stream. This enables proper suspend/resume workflows and approval handling when nested agents require tool approvals. ([#12732](https://github.com/mastra-ai/mastra/pull/12732))

  Related to issue #12552.

- Fixed stale agent data in CMS pages by adding removeAgent method to Mastra and updating clearStoredAgentCache to clear both Editor cache and Mastra registry when stored agents are updated or deleted ([#12693](https://github.com/mastra-ai/mastra/pull/12693))

- Fixed stored scorers not being registered on the Mastra instance. Scorers created via the editor are now automatically discoverable through `mastra.getScorer()` and `mastra.getScorerById()`, matching the existing behavior of stored agents. Previously, stored scorers could only be resolved inline but were invisible to the runtime registry, causing lookups to fail. ([#12903](https://github.com/mastra-ai/mastra/pull/12903))

- Fixed `generateTitle` running on every conversation turn instead of only the first, which caused redundant title generation calls. This happened when `lastMessages` was disabled or set to `false`. Titles are now correctly generated only on the first turn. ([#12890](https://github.com/mastra-ai/mastra/pull/12890))

- Fixed workflow step errors not being propagated to the configured Mastra logger. The execution engine now properly propagates the Mastra logger through the inheritance chain, and the evented step executor logs errors with structured MastraError context (matching the default engine behavior). Closes #12793 ([#12834](https://github.com/mastra-ai/mastra/pull/12834))

- Update memory config and exports: ([#12704](https://github.com/mastra-ai/mastra/pull/12704))
  - Updated `SerializedMemoryConfig` to allow `embedder?: EmbeddingModelId | string` for flexibility
  - Exported `EMBEDDING_MODELS` and `EmbeddingModelInfo` for use in server endpoints

- Fixed a catch-22 where third-party AI SDK providers (like `ollama-ai-provider-v2`) were rejected by both `stream()` and `streamLegacy()` due to unrecognized `specificationVersion` values. ([#12856](https://github.com/mastra-ai/mastra/pull/12856))

  When a model has a `specificationVersion` that isn't `'v1'`, `'v2'`, or `'v3'` (e.g., from a third-party provider), two fixes now apply:
  1. **Auto-wrapping in `resolveModelConfig()`**: Models with unknown spec versions that have `doStream`/`doGenerate` methods are automatically wrapped as AI SDK v5 models, preventing the catch-22 entirely.
  2. **Improved error messages**: If a model still reaches the version check, error messages now show the actual unrecognized `specificationVersion` instead of creating circular suggestions between `stream()` and `streamLegacy()`.

- Fixed routing output so users only see the final answer when routing handles a request directly. Previously, an internal routing explanation appeared before the answer and was duplicated. Fixes #12545. ([#12786](https://github.com/mastra-ai/mastra/pull/12786))

- Supporting changes for async buffering in observational memory, including new config options, streaming events, and UI markers. ([#12891](https://github.com/mastra-ai/mastra/pull/12891))

- Fixed an issue where processor retry (via `abort({ retry: true })` in `processOutputStep`) would send the rejected assistant response back to the LLM on retry. This confused models and often caused empty text responses. The rejected response is now removed from the message list before the retry iteration. ([#12799](https://github.com/mastra-ai/mastra/pull/12799))

- Fixed Moonshot AI (moonshotai and moonshotai-cn) models using the wrong base URL. The Anthropic-compatible endpoint was not being applied, causing API calls to fail with an upstream LLM error. ([#12750](https://github.com/mastra-ai/mastra/pull/12750))

- Fixed messages not being persisted to the database when using the stream-legacy endpoint. The thread is now saved to the database immediately when created, preventing a race condition where storage backends like PostgreSQL would reject message inserts because the thread didn't exist yet. Fixes #12566. ([#12774](https://github.com/mastra-ai/mastra/pull/12774))

- When calling `mastra.setLogger()`, memory instances were not being updated with the new logger. This caused memory-related errors to be logged via the default ConsoleLogger instead of the configured logger. ([#12905](https://github.com/mastra-ai/mastra/pull/12905))

- Fixed tool input validation failing when LLMs return stringified JSON for array or object parameters. Some models (e.g., GLM4.7) send `"[\"file.py\"]"` instead of `["file.py"]` for array fields, which caused Zod validation to reject the input. The validation pipeline now automatically detects and parses stringified JSON values when the schema expects an array or object. (GitHub #12757) ([#12771](https://github.com/mastra-ai/mastra/pull/12771))

- Fixed working memory tools being injected when no thread or resource context is provided. Made working memory tool execute scope-aware: thread-scoped requires threadId, resource-scoped requires resourceId (previously both were always required regardless of scope). ([#12831](https://github.com/mastra-ai/mastra/pull/12831))

- Fixed a crash when using agent workflows that have no input schema. Input now passes through on first invocation, so workflows run instead of failing. (#12739) ([#12785](https://github.com/mastra-ai/mastra/pull/12785))

- Fixes issue where client tools could not be used with agent.network(). Client tools configured in an agent's defaultOptions will now be available during network execution. ([#12821](https://github.com/mastra-ai/mastra/pull/12821))

  Fixes #12752

- Steps now support an optional `metadata` property for storing arbitrary key-value data. This metadata is preserved through step serialization and is available in the workflow graph, enabling use cases like UI annotations or custom step categorization. ([#12861](https://github.com/mastra-ai/mastra/pull/12861))

  ```diff
  import { createStep } from "@mastra/core/workflows";
  import { z } from "zod";

  const step = createStep({
    //...step information
  +  metadata: {
  +    category: "orders",
  +    priority: "high",
  +    version: "1.0.0",
  +  },
  });
  ```

  Metadata values must be serializable (no functions or circular references).

- Fixed: You can now pass workflows with a `requestContextSchema` to the Mastra constructor without a type error. Related: #12773. ([#12857](https://github.com/mastra-ai/mastra/pull/12857))

- Fixed TypeScript type errors when using `.optional().default()` in workflow input schemas. Workflows with default values in their schemas no longer produce false type errors when chaining steps with `.then()`. Fixes #12634 ([#12778](https://github.com/mastra-ai/mastra/pull/12778))

- Fix setLogger to update workflow loggers ([#12889](https://github.com/mastra-ai/mastra/pull/12889))

  When calling `mastra.setLogger()`, workflows were not being updated with the new logger. This caused workflow errors to be logged via the default ConsoleLogger instead of the configured logger (e.g., PinoLogger with HttpTransport), resulting in missing error logs in Cloud deployments.

## 1.3.0-alpha.2

### Patch Changes

- Fixed observational memory progress bars resetting to zero after agent responses finish. The messages and observations sidebar bars now retain their values on stream completion, cancellation, and page reload. Also added a buffer-status endpoint so buffering badges resolve with accurate token counts instead of spinning forever when buffering outlives the stream. ([#12934](https://github.com/mastra-ai/mastra/pull/12934))

## 1.3.0-alpha.1

### Minor Changes

- Added mount support to workspaces, so you can combine multiple storage providers (S3, GCS, local disk, etc.) under a single directory tree. This lets agents access files from different sources through one unified filesystem. ([#12851](https://github.com/mastra-ai/mastra/pull/12851))

  **Why:** Previously a workspace could only use one filesystem. With mounts, you can organize files from different providers under different paths — for example, S3 data at `/data` and GCS models at `/models` — without agents needing to know which provider backs each path.

  **What's new:**
  - Added `CompositeFilesystem` for combining multiple filesystems under one tree
  - Added descriptive error types for sandbox and mount failures (e.g., `SandboxTimeoutError`, `MountError`)
  - Improved `MastraFilesystem` and `MastraSandbox` base classes with safer concurrent lifecycle handling

  ```ts
  import { Workspace, CompositeFilesystem } from '@mastra/core/workspace';

  // Mount multiple filesystems under one tree
  const composite = new CompositeFilesystem({
    mounts: {
      '/data': s3Filesystem,
      '/models': gcsFilesystem,
    },
  });

  const workspace = new Workspace({
    filesystem: composite,
    sandbox: e2bSandbox,
  });
  ```

- Supporting work to allow for cloning agents via the client SDK ([#12796](https://github.com/mastra-ai/mastra/pull/12796))

- Added `requestContextSchema` and rule-based conditional fields for stored agents. ([#12896](https://github.com/mastra-ai/mastra/pull/12896))

  Stored agent fields (`tools`, `model`, `workflows`, `agents`, `memory`, `scorers`, `inputProcessors`, `outputProcessors`, `defaultOptions`) can now be configured as conditional variants with rule groups that evaluate against request context at runtime. All matching variants accumulate — arrays are concatenated and objects are shallow-merged — so agents dynamically compose their configuration based on the incoming request context.

  **New `requestContextSchema` field**

  Stored agents now accept an optional `requestContextSchema` (JSON Schema) that is converted to a Zod schema and passed to the Agent constructor, enabling request context validation.

  **Conditional field example**

  ```ts
  await agentsStore.create({
    agent: {
      id: 'my-agent',
      name: 'My Agent',
      instructions: 'You are a helpful assistant',
      model: { provider: 'openai', name: 'gpt-4' },
      tools: [
        { value: { 'basic-tool': {} } },
        {
          value: { 'premium-tool': {} },
          rules: {
            operator: 'AND',
            conditions: [{ field: 'tier', operator: 'equals', value: 'premium' }],
          },
        },
      ],
      requestContextSchema: {
        type: 'object',
        properties: { tier: { type: 'string' } },
      },
    },
  });
  ```

- Implement underlying storage changes to allow for dynamic instructions in stored agents (for `@mastra/editor`) ([#12776](https://github.com/mastra-ai/mastra/pull/12776))

- Add native `@ai-sdk/groq` support to model router. Groq models now use the official AI SDK package instead of falling back to OpenAI-compatible mode. ([#12741](https://github.com/mastra-ai/mastra/pull/12741))

- **Added stored scorer definitions, editor namespace pattern, and generic storage domains** ([#12846](https://github.com/mastra-ai/mastra/pull/12846))
  - Added a new `scorer-definitions` storage domain for storing LLM-as-judge and preset scorer configurations in the database
  - Introduced a `VersionedStorageDomain` generic base class that unifies `AgentsStorage`, `PromptBlocksStorage`, and `ScorerDefinitionsStorage` with shared CRUD methods (`create`, `getById`, `getByIdResolved`, `update`, `delete`, `list`, `listResolved`)
  - Flattened stored scorer type system: replaced nested `preset`/`customLLMJudge` config with top-level `type`, `instructions`, `scoreRange`, and `presetConfig` fields
  - Refactored `MastraEditor` to use a namespace pattern (`editor.agent.*`, `editor.scorer.*`, `editor.prompt.*`) backed by a `CrudEditorNamespace` base class with built-in caching and an `onCacheEvict` hook
  - Added `rawConfig` support to `MastraBase` and `MastraScorer` via `toRawConfig()`, so hydrated primitives carry their stored configuration
  - Added prompt block and scorer registration to the `Mastra` class (`addPromptBlock`, `removePromptBlock`, `addScorer`, `removeScorer`)

  **Creating a stored scorer (LLM-as-judge):**

  ```ts
  const scorer = await editor.scorer.create({
    id: 'my-scorer',
    name: 'Response Quality',
    type: 'llm-judge',
    instructions: 'Evaluate the response for accuracy and helpfulness.',
    model: { provider: 'openai', name: 'gpt-4o' },
    scoreRange: { min: 0, max: 1 },
  });
  ```

  **Retrieving and resolving a stored scorer:**

  ```ts
  // Fetch the stored definition from DB
  const definition = await editor.scorer.getById('my-scorer');

  // Resolve it into a runnable MastraScorer instance
  const runnableScorer = editor.scorer.resolve(definition);

  // Execute the scorer
  const result = await runnableScorer.run({
    input: 'What is the capital of France?',
    output: 'The capital of France is Paris.',
  });
  ```

  **Editor namespace pattern (before/after):**

  ```ts
  // Before
  const agent = await editor.getStoredAgentById('abc');
  const prompts = await editor.listPromptBlocks();

  // After
  const agent = await editor.agent.getById('abc');
  const prompts = await editor.prompt.list();
  ```

  **Generic storage domain methods (before/after):**

  ```ts
  // Before
  const store = storage.getStore('agents');
  await store.createAgent({ agent: input });
  await store.getAgentById({ id: 'abc' });
  await store.deleteAgent({ id: 'abc' });

  // After
  const store = storage.getStore('agents');
  await store.create({ agent: input });
  await store.getById('abc');
  await store.delete('abc');
  ```

- Added mount status and error information to filesystem directory listings, so the UI can show whether each mount is healthy or has issues. Improved error handling when mount operations fail. Fixed tree formatter to use case-insensitive sorting to match native tree output. ([#12605](https://github.com/mastra-ai/mastra/pull/12605))

- Added workspace registration and tool context support. ([#12607](https://github.com/mastra-ai/mastra/pull/12607))

  **Why** - Makes it easier to manage multiple workspaces at runtime and lets tools read/write files in the intended workspace.

  **Workspace Registration** - Added a workspace registry so you can list and fetch workspaces by id with `addWorkspace()`, `getWorkspaceById()`, and `listWorkspaces()`. Agent workspaces are auto-registered when adding agents.

  **Before**

  ```typescript
  const mastra = new Mastra({ workspace: myWorkspace });
  // No way to look up workspaces by id or list all workspaces
  ```

  **After**

  ```typescript
  const mastra = new Mastra({ workspace: myWorkspace });

  // Look up by id
  const ws = mastra.getWorkspaceById('my-workspace');

  // List all registered workspaces
  const allWorkspaces = mastra.listWorkspaces();

  // Register additional workspaces
  mastra.addWorkspace(anotherWorkspace);
  ```

  **Tool Workspace Access** - Tools can access the workspace through `context.workspace` during execution, enabling filesystem and sandbox operations.

  ```typescript
  const myTool = createTool({
    id: 'file-reader',
    execute: async ({ context }) => {
      const fs = context.workspace?.filesystem;
      const content = await fs?.readFile('config.json');
      return { content };
    },
  });
  ```

  **Dynamic Workspace Configuration** - Workspace can be configured dynamically via agent config functions. Dynamically created workspaces are auto-registered with Mastra, making them available via `listWorkspaces()`.

  ```typescript
  const agent = new Agent({
    workspace: ({ mastra, requestContext }) => {
      // Return workspace dynamically based on context
      const workspaceId = requestContext?.get('workspaceId') || 'default';
      return mastra.getWorkspaceById(workspaceId);
    },
  });
  ```

- Add tool description overrides for stored agents: ([#12794](https://github.com/mastra-ai/mastra/pull/12794))
  - Changed stored agent `tools` field from `string[]` to `Record<string, { description?: string }>` to allow per-tool description overrides
  - When a stored agent specifies a custom `description` for a tool, the override is applied at resolution time
  - Updated server API schemas, client SDK types, and editor resolution logic accordingly

- **Breaking:** Removed `cloneAgent()` from the `Agent` class. Agent cloning is now handled by the editor package via `editor.agent.clone()`. ([#12904](https://github.com/mastra-ai/mastra/pull/12904))

  If you were calling `agent.cloneAgent()` directly, use the editor's agent namespace instead:

  ```ts
  // Before
  const result = await agent.cloneAgent({ newId: 'my-clone' });

  // After
  const editor = mastra.getEditor();
  const result = await editor.agent.clone(agent, { newId: 'my-clone' });
  ```

  **Why:** The `Agent` class should not be responsible for storage serialization. The editor package already handles converting between runtime agents and stored configurations, so cloning belongs there.

  **Added** `getConfiguredProcessorIds()` to the `Agent` class, which returns raw input/output processor IDs for the agent's configuration.

### Patch Changes

- Update provider registry and model documentation with latest models and providers ([`717ffab`](https://github.com/mastra-ai/mastra/commit/717ffab42cfd58ff723b5c19ada4939997773004))

- Fixed issues with stored agents ([#12790](https://github.com/mastra-ai/mastra/pull/12790))

- Fixed sub-agent tool approval and suspend events not being surfaced to the parent agent stream. This enables proper suspend/resume workflows and approval handling when nested agents require tool approvals. ([#12732](https://github.com/mastra-ai/mastra/pull/12732))

  Related to issue #12552.

- Fixed stored scorers not being registered on the Mastra instance. Scorers created via the editor are now automatically discoverable through `mastra.getScorer()` and `mastra.getScorerById()`, matching the existing behavior of stored agents. Previously, stored scorers could only be resolved inline but were invisible to the runtime registry, causing lookups to fail. ([#12903](https://github.com/mastra-ai/mastra/pull/12903))

- Fixed `generateTitle` running on every conversation turn instead of only the first, which caused redundant title generation calls. This happened when `lastMessages` was disabled or set to `false`. Titles are now correctly generated only on the first turn. ([#12890](https://github.com/mastra-ai/mastra/pull/12890))

- Fixed workflow step errors not being propagated to the configured Mastra logger. The execution engine now properly propagates the Mastra logger through the inheritance chain, and the evented step executor logs errors with structured MastraError context (matching the default engine behavior). Closes #12793 ([#12834](https://github.com/mastra-ai/mastra/pull/12834))

- Fixed a catch-22 where third-party AI SDK providers (like `ollama-ai-provider-v2`) were rejected by both `stream()` and `streamLegacy()` due to unrecognized `specificationVersion` values. ([#12856](https://github.com/mastra-ai/mastra/pull/12856))

  When a model has a `specificationVersion` that isn't `'v1'`, `'v2'`, or `'v3'` (e.g., from a third-party provider), two fixes now apply:
  1. **Auto-wrapping in `resolveModelConfig()`**: Models with unknown spec versions that have `doStream`/`doGenerate` methods are automatically wrapped as AI SDK v5 models, preventing the catch-22 entirely.
  2. **Improved error messages**: If a model still reaches the version check, error messages now show the actual unrecognized `specificationVersion` instead of creating circular suggestions between `stream()` and `streamLegacy()`.

- Fixed routing output so users only see the final answer when routing handles a request directly. Previously, an internal routing explanation appeared before the answer and was duplicated. Fixes #12545. ([#12786](https://github.com/mastra-ai/mastra/pull/12786))

- **Async buffering for observational memory is now enabled by default.** Observations are pre-computed in the background as conversations grow — when the context window fills up, buffered observations activate instantly with no blocking LLM call. This keeps agents responsive during long conversations. ([#12891](https://github.com/mastra-ai/mastra/pull/12891))

  **Default settings:**
  - `observation.bufferTokens: 0.2` — buffer every 20% of `messageTokens` (~6k tokens with the default 30k threshold)
  - `observation.bufferActivation: 0.8` — on activation, retain 20% of the message window
  - `reflection.bufferActivation: 0.5` — start background reflection at 50% of the observation threshold

  **Disabling async buffering:**

  Set `observation.bufferTokens: false` to disable async buffering for both observations and reflections:

  ```ts
  const memory = new Memory({
    options: {
      observationalMemory: {
        model: 'google/gemini-2.5-flash',
        observation: {
          bufferTokens: false,
        },
      },
    },
  });
  ```

  **Model is now required** when passing an observational memory config object. Use `observationalMemory: true` for the default (google/gemini-2.5-flash), or set a model explicitly:

  ```ts
  // Uses default model (google/gemini-2.5-flash)
  observationalMemory: true

  // Explicit model
  observationalMemory: {
    model: "google/gemini-2.5-flash",
  }
  ```

  **`shareTokenBudget` requires `bufferTokens: false`** (temporary limitation). If you use `shareTokenBudget: true`, you must explicitly disable async buffering:

  ```ts
  observationalMemory: {
    model: "google/gemini-2.5-flash",
    shareTokenBudget: true,
    observation: { bufferTokens: false },
  }
  ```

  **New streaming event:** `data-om-status` replaces `data-om-progress` with a structured status object containing active window usage, buffered observation/reflection state, and projected activation impact.

  **Buffering markers:** New `data-om-buffering-start`, `data-om-buffering-end`, and `data-om-buffering-failed` streaming events for UI feedback during background operations.

- Fixed an issue where processor retry (via `abort({ retry: true })` in `processOutputStep`) would send the rejected assistant response back to the LLM on retry. This confused models and often caused empty text responses. The rejected response is now removed from the message list before the retry iteration. ([#12799](https://github.com/mastra-ai/mastra/pull/12799))

- Fixed Moonshot AI (moonshotai and moonshotai-cn) models using the wrong base URL. The Anthropic-compatible endpoint was not being applied, causing API calls to fail with an upstream LLM error. ([#12750](https://github.com/mastra-ai/mastra/pull/12750))

- Fixed messages not being persisted to the database when using the stream-legacy endpoint. The thread is now saved to the database immediately when created, preventing a race condition where storage backends like PostgreSQL would reject message inserts because the thread didn't exist yet. Fixes #12566. ([#12774](https://github.com/mastra-ai/mastra/pull/12774))

- fix(core): update memory loggers in setLogger ([#12905](https://github.com/mastra-ai/mastra/pull/12905))

  When calling `mastra.setLogger()`, memory instances were not being updated
  with the new logger. This caused memory-related errors to be logged via the
  default ConsoleLogger instead of the configured logger.

- Fixed tool input validation failing when LLMs return stringified JSON for array or object parameters. Some models (e.g., GLM4.7) send `"[\"file.py\"]"` instead of `["file.py"]` for array fields, which caused Zod validation to reject the input. The validation pipeline now automatically detects and parses stringified JSON values when the schema expects an array or object. (GitHub #12757) ([#12771](https://github.com/mastra-ai/mastra/pull/12771))

- Fixed working memory tools being injected when no thread or resource context is provided. Made working memory tool execute scope-aware: thread-scoped requires threadId, resource-scoped requires resourceId (previously both were always required regardless of scope). ([#12831](https://github.com/mastra-ai/mastra/pull/12831))

- Fixed a crash when using agent workflows that have no input schema. Input now passes through on first invocation, so workflows run instead of failing. (#12739) ([#12785](https://github.com/mastra-ai/mastra/pull/12785))

- Fixes issue where client tools could not be used with agent.network(). Client tools configured in an agent's defaultOptions will now be available during network execution. ([#12821](https://github.com/mastra-ai/mastra/pull/12821))

  Fixes #12752

- Steps now support an optional `metadata` property for storing arbitrary key-value data. This metadata is preserved through step serialization and is available in the workflow graph, enabling use cases like UI annotations or custom step categorization. ([#12861](https://github.com/mastra-ai/mastra/pull/12861))

  ```diff
  import { createStep } from "@mastra/core/workflows";
  import { z } from "zod";

  const step = createStep({
    //...step information
  +  metadata: {
  +    category: "orders",
  +    priority: "high",
  +    version: "1.0.0",
  +  },
  });
  ```

  Metadata values must be serializable (no functions or circular references).

- Fixed: You can now pass workflows with a `requestContextSchema` to the Mastra constructor without a type error. Related: #12773. ([#12857](https://github.com/mastra-ai/mastra/pull/12857))

- Fixed TypeScript type errors when using `.optional().default()` in workflow input schemas. Workflows with default values in their schemas no longer produce false type errors when chaining steps with `.then()`. Fixes #12634 ([#12778](https://github.com/mastra-ai/mastra/pull/12778))

- Fix setLogger to update workflow loggers ([#12889](https://github.com/mastra-ai/mastra/pull/12889))

  When calling `mastra.setLogger()`, workflows were not being updated with the new logger. This caused workflow errors to be logged via the default ConsoleLogger instead of the configured logger (e.g., PinoLogger with HttpTransport), resulting in missing error logs in Cloud deployments.

## 1.2.1-alpha.0

### Patch Changes

- Fixed stale agent data in CMS pages by adding removeAgent method to Mastra and updating clearStoredAgentCache to clear both Editor cache and Mastra registry when stored agents are updated or deleted ([#12693](https://github.com/mastra-ai/mastra/pull/12693))

- Update memory config and exports: ([#12704](https://github.com/mastra-ai/mastra/pull/12704))
  - Updated `SerializedMemoryConfig` to allow `embedder?: EmbeddingModelId | string` for flexibility
  - Exported `EMBEDDING_MODELS` and `EmbeddingModelInfo` for use in server endpoints

## 1.2.0

### Minor Changes

- Added Observational Memory — a new memory system that keeps your agent's context window small while preserving long-term memory across conversations. ([#12599](https://github.com/mastra-ai/mastra/pull/12599))

  **Why:** Long conversations cause context rot and waste tokens. Observational Memory compresses conversation history into observations (5–40x compression) and periodically condenses those into reflections. Your agent stays fast and focused, even after thousands of messages.

  **Usage:**

  ```ts
  import { Memory } from '@mastra/memory';
  import { PostgresStore } from '@mastra/pg';

  const memory = new Memory({
    storage: new PostgresStore({ connectionString: process.env.DATABASE_URL }),
    options: {
      observationalMemory: true,
    },
  });

  const agent = new Agent({
    name: 'my-agent',
    model: openai('gpt-4o'),
    memory,
  });
  ```

  **What's new:**
  - `observationalMemory: true` enables the three-tier memory system (recent messages → observations → reflections)
  - Thread-scoped (per-conversation) and resource-scoped (shared across all threads for a user) modes
  - Manual `observe()` API for triggering observation outside the normal agent loop
  - New OM storage methods for pg, libsql, and mongodb adapters (conditionally enabled)
  - `Agent.findProcessor()` method for looking up processors by ID
  - `processorStates` for persisting processor state across loop iterations
  - Abort signal propagation to processors
  - `ProcessorStreamWriter` for custom stream events from processors

- Created @mastra/editor package for managing and resolving stored agent configurations ([#12631](https://github.com/mastra-ai/mastra/pull/12631))

  This major addition introduces the editor package, which provides a complete solution for storing, versioning, and instantiating agent configurations from a database. The editor seamlessly integrates with Mastra's storage layer to enable dynamic agent management.

  **Key Features:**
  - **Agent Storage & Retrieval**: Store complete agent configurations including instructions, model settings, tools, workflows, nested agents, scorers, processors, and memory configuration
  - **Version Management**: Create and manage multiple versions of agents, with support for activating specific versions
  - **Dependency Resolution**: Automatically resolves and instantiates all agent dependencies (tools, workflows, sub-agents, etc.) from the Mastra registry
  - **Caching**: Built-in caching for improved performance when repeatedly accessing stored agents
  - **Type Safety**: Full TypeScript support with proper typing for stored configurations

  **Usage Example:**

  ```typescript
  import { MastraEditor } from '@mastra/editor';
  import { Mastra } from '@mastra/core';

  // Initialize editor with Mastra
  const mastra = new Mastra({
    /* config */
    editor: new MastraEditor(),
  });

  // Store an agent configuration
  const agentId = await mastra.storage.stores?.agents?.createAgent({
    name: 'customer-support',
    instructions: 'Help customers with inquiries',
    model: { provider: 'openai', name: 'gpt-4' },
    tools: ['search-kb', 'create-ticket'],
    workflows: ['escalation-flow'],
    memory: { vector: 'pinecone-db' },
  });

  // Retrieve and use the stored agent
  const agent = await mastra.getEditor()?.getStoredAgentById(agentId);
  const response = await agent?.generate('How do I reset my password?');

  // List all stored agents
  const agents = await mastra.getEditor()?.listStoredAgents({ pageSize: 10 });
  ```

  **Storage Improvements:**
  - Fixed JSONB handling in LibSQL, PostgreSQL, and MongoDB adapters
  - Improved agent resolution queries to properly merge version data
  - Enhanced type safety for serialized configurations

- Added logger support to Workspace filesystem and sandbox providers. Providers extending MastraFilesystem or MastraSandbox now automatically receive the Mastra logger for consistent logging of file operations and command executions. ([#12606](https://github.com/mastra-ai/mastra/pull/12606))

- Added ToolSearchProcessor for dynamic tool discovery. ([#12290](https://github.com/mastra-ai/mastra/pull/12290))

  Agents can now discover and load tools on demand instead of having all tools available upfront. This reduces context token usage by ~94% when working with large tool libraries.

  **New API:**

  ```typescript
  import { ToolSearchProcessor } from '@mastra/core/processors';
  import { Agent } from '@mastra/core';

  // Create a processor with searchable tools
  const toolSearch = new ToolSearchProcessor({
    tools: {
      createIssue: githubTools.createIssue,
      sendEmail: emailTools.send,
      // ... hundreds of tools
    },
    search: {
      topK: 5, // Return top 5 results (default: 5)
      minScore: 0.1, // Filter results below this score (default: 0)
    },
  });

  // Attach processor to agent
  const agent = new Agent({
    name: 'my-agent',
    inputProcessors: [toolSearch],
    tools: {
      /* always-available tools */
    },
  });
  ```

  **How it works:**

  The processor automatically provides two meta-tools to the agent:
  - `search_tools` - Search for available tools by keyword relevance
  - `load_tool` - Load a specific tool into the conversation

  The agent discovers what it needs via search and loads tools on demand. Loaded tools are available immediately and persist within the conversation thread.

  **Why:**

  When agents have access to 100+ tools (from MCP servers or integrations), including all tool definitions in the context can consume significant tokens (~1,500 tokens per tool). This pattern reduces context usage by giving agents only the tools they need, when they need them.

### Patch Changes

- Update provider registry and model documentation with latest models and providers ([`e6fc281`](https://github.com/mastra-ai/mastra/commit/e6fc281896a3584e9e06465b356a44fe7faade65))

- Fixed processors returning `{ tools: {}, toolChoice: 'none' }` being ignored. Previously, when a processor returned empty tools with an explicit `toolChoice: 'none'` to prevent tool calls, the toolChoice was discarded and defaulted to 'auto'. This fix preserves the explicit 'none' value, enabling patterns like ensuring a final text response when `maxSteps` is reached. ([#12601](https://github.com/mastra-ai/mastra/pull/12601))

- Fix moonshotai/kimi-k2.5 multi-step tool calling failing with "reasoning_content is missing in assistant tool call message" ([#12530](https://github.com/mastra-ai/mastra/pull/12530))
  - Changed moonshotai and moonshotai-cn (China version) providers to use Anthropic-compatible API endpoints instead of OpenAI-compatible
    - moonshotai: `https://api.moonshot.ai/anthropic/v1`
    - moonshotai-cn: `https://api.moonshot.cn/anthropic/v1`
  - This properly handles reasoning_content for kimi-k2.5 model

- Fixed custom input processors from disabling workspace skill tools in generate() and stream(). Custom processors now replace only the processors you configured, while memory and skills remain available. Fixes #12612. ([#12676](https://github.com/mastra-ai/mastra/pull/12676))

- **Fixed** ([#12673](https://github.com/mastra-ai/mastra/pull/12673))
  Workspace search index names now use underscores so they work with SQL-based vector stores (PgVector, LibSQL).

  **Added**
  You can now set a custom index name with `searchIndexName`.

  **Why**
  Some SQL vector stores reject hyphens in index names.

  **Example**

  ```ts
  // Before - would fail with PgVector
  new Workspace({ id: 'my-workspace', vectorStore, embedder });

  // After - works with all vector stores
  new Workspace({ id: 'my-workspace', vectorStore, embedder });

  // Or use a custom index name
  new Workspace({ vectorStore, embedder, searchIndexName: 'my_workspace_vectors' });
  ```

  Fixes #12656

- Catch up evented workflows on parity with default execution engine ([#12555](https://github.com/mastra-ai/mastra/pull/12555))

- Expose token usage from embedding operations ([#12556](https://github.com/mastra-ai/mastra/pull/12556))
  - `saveMessages` now returns `usage: { tokens: number }` with aggregated token count from all embeddings
  - `recall` now returns `usage: { tokens: number }` from the vector search query embedding
  - Updated abstract method signatures in `MastraMemory` to include optional `usage` in return types

  This allows users to track embedding token usage when using the Memory class.

- Fixed a security issue where sensitive observability credentials (such as Langfuse API keys) could be exposed in tool execution error logs. The tracingContext is now properly excluded from logged data. ([#12669](https://github.com/mastra-ai/mastra/pull/12669))

- Fixed issue where some models incorrectly call skill names directly as tools instead of using skill-activate. Added clearer system instructions that explicitly state skills are NOT tools and must be activated via skill-activate with the skill name as the "name" parameter. Fixes #12654. ([#12677](https://github.com/mastra-ai/mastra/pull/12677))

- Improved workspace filesystem error handling: return 404 for not-found errors instead of 500, show user-friendly error messages in UI, and add MastraClientError class with status/body properties for better error handling ([#12533](https://github.com/mastra-ai/mastra/pull/12533))

- Improved workspace tool descriptions with clearer usage guidance for read_file, edit_file, and execute_command tools. ([#12640](https://github.com/mastra-ai/mastra/pull/12640))

- Fixed JSON parsing in agent network to handle malformed LLM output. Uses parsePartialJson from AI SDK to recover truncated JSON, missing braces, and unescaped control characters instead of failing immediately. This reduces unnecessary retry round-trips when the routing agent generates slightly malformed JSON for tool/workflow prompts. Fixes #12519. ([#12526](https://github.com/mastra-ai/mastra/pull/12526))

- Updated dependencies [[`abae238`](https://github.com/mastra-ai/mastra/commit/abae238c755ebaf867bbfa1a3a219ef003a1021a)]:
  - @mastra/schema-compat@1.1.0

## 1.2.0-alpha.1

### Minor Changes

- Added Observational Memory — a new memory system that keeps your agent's context window small while preserving long-term memory across conversations. ([#12599](https://github.com/mastra-ai/mastra/pull/12599))

  **Why:** Long conversations cause context rot and waste tokens. Observational Memory compresses conversation history into observations (5–40x compression) and periodically condenses those into reflections. Your agent stays fast and focused, even after thousands of messages.

  **Usage:**

  ```ts
  import { Memory } from '@mastra/memory';
  import { PostgresStore } from '@mastra/pg';

  const memory = new Memory({
    storage: new PostgresStore({ connectionString: process.env.DATABASE_URL }),
    options: {
      observationalMemory: true,
    },
  });

  const agent = new Agent({
    name: 'my-agent',
    model: openai('gpt-4o'),
    memory,
  });
  ```

  **What's new:**
  - `observationalMemory: true` enables the three-tier memory system (recent messages → observations → reflections)
  - Thread-scoped (per-conversation) and resource-scoped (shared across all threads for a user) modes
  - Manual `observe()` API for triggering observation outside the normal agent loop
  - New OM storage methods for pg, libsql, and mongodb adapters (conditionally enabled)
  - `Agent.findProcessor()` method for looking up processors by ID
  - `processorStates` for persisting processor state across loop iterations
  - Abort signal propagation to processors
  - `ProcessorStreamWriter` for custom stream events from processors

- Created @mastra/editor package for managing and resolving stored agent configurations ([#12631](https://github.com/mastra-ai/mastra/pull/12631))

  This major addition introduces the editor package, which provides a complete solution for storing, versioning, and instantiating agent configurations from a database. The editor seamlessly integrates with Mastra's storage layer to enable dynamic agent management.

  **Key Features:**
  - **Agent Storage & Retrieval**: Store complete agent configurations including instructions, model settings, tools, workflows, nested agents, scorers, processors, and memory configuration
  - **Version Management**: Create and manage multiple versions of agents, with support for activating specific versions
  - **Dependency Resolution**: Automatically resolves and instantiates all agent dependencies (tools, workflows, sub-agents, etc.) from the Mastra registry
  - **Caching**: Built-in caching for improved performance when repeatedly accessing stored agents
  - **Type Safety**: Full TypeScript support with proper typing for stored configurations

  **Usage Example:**

  ```typescript
  import { MastraEditor } from '@mastra/editor';
  import { Mastra } from '@mastra/core';

  // Initialize editor with Mastra
  const mastra = new Mastra({
    /* config */
    editor: new MastraEditor(),
  });

  // Store an agent configuration
  const agentId = await mastra.storage.stores?.agents?.createAgent({
    name: 'customer-support',
    instructions: 'Help customers with inquiries',
    model: { provider: 'openai', name: 'gpt-4' },
    tools: ['search-kb', 'create-ticket'],
    workflows: ['escalation-flow'],
    memory: { vector: 'pinecone-db' },
  });

  // Retrieve and use the stored agent
  const agent = await mastra.getEditor()?.getStoredAgentById(agentId);
  const response = await agent?.generate('How do I reset my password?');

  // List all stored agents
  const agents = await mastra.getEditor()?.listStoredAgents({ pageSize: 10 });
  ```

  **Storage Improvements:**
  - Fixed JSONB handling in LibSQL, PostgreSQL, and MongoDB adapters
  - Improved agent resolution queries to properly merge version data
  - Enhanced type safety for serialized configurations

- Added logger support to Workspace filesystem and sandbox providers. Providers extending MastraFilesystem or MastraSandbox now automatically receive the Mastra logger for consistent logging of file operations and command executions. ([#12606](https://github.com/mastra-ai/mastra/pull/12606))

### Patch Changes

- Fixed custom input processors from disabling workspace skill tools in generate() and stream(). Custom processors now replace only the processors you configured, while memory and skills remain available. Fixes #12612. ([#12676](https://github.com/mastra-ai/mastra/pull/12676))

- **Fixed** ([#12673](https://github.com/mastra-ai/mastra/pull/12673))
  Workspace search index names now use underscores so they work with SQL-based vector stores (PgVector, LibSQL).

  **Added**
  You can now set a custom index name with `searchIndexName`.

  **Why**
  Some SQL vector stores reject hyphens in index names.

  **Example**

  ```ts
  // Before - would fail with PgVector
  new Workspace({ id: 'my-workspace', vectorStore, embedder });

  // After - works with all vector stores
  new Workspace({ id: 'my-workspace', vectorStore, embedder });

  // Or use a custom index name
  new Workspace({ vectorStore, embedder, searchIndexName: 'my_workspace_vectors' });
  ```

  Fixes #12656

- Fixed a security issue where sensitive observability credentials (such as Langfuse API keys) could be exposed in tool execution error logs. The tracingContext is now properly excluded from logged data. ([#12669](https://github.com/mastra-ai/mastra/pull/12669))

- Fixed issue where some models incorrectly call skill names directly as tools instead of using skill-activate. Added clearer system instructions that explicitly state skills are NOT tools and must be activated via skill-activate with the skill name as the "name" parameter. Fixes #12654. ([#12677](https://github.com/mastra-ai/mastra/pull/12677))

- Improved workspace tool descriptions with clearer usage guidance for read_file, edit_file, and execute_command tools. ([#12640](https://github.com/mastra-ai/mastra/pull/12640))

- Updated dependencies [[`abae238`](https://github.com/mastra-ai/mastra/commit/abae238c755ebaf867bbfa1a3a219ef003a1021a)]:
  - @mastra/schema-compat@1.1.0-alpha.0

## 1.2.0-alpha.0

### Minor Changes

- Added ToolSearchProcessor for dynamic tool discovery. ([#12290](https://github.com/mastra-ai/mastra/pull/12290))

  Agents can now discover and load tools on demand instead of having all tools available upfront. This reduces context token usage by ~94% when working with large tool libraries.

  **New API:**

  ```typescript
  import { ToolSearchProcessor } from '@mastra/core/processors';
  import { Agent } from '@mastra/core';

  // Create a processor with searchable tools
  const toolSearch = new ToolSearchProcessor({
    tools: {
      createIssue: githubTools.createIssue,
      sendEmail: emailTools.send,
      // ... hundreds of tools
    },
    search: {
      topK: 5, // Return top 5 results (default: 5)
      minScore: 0.1, // Filter results below this score (default: 0)
    },
  });

  // Attach processor to agent
  const agent = new Agent({
    name: 'my-agent',
    inputProcessors: [toolSearch],
    tools: {
      /* always-available tools */
    },
  });
  ```

  **How it works:**

  The processor automatically provides two meta-tools to the agent:
  - `search_tools` - Search for available tools by keyword relevance
  - `load_tool` - Load a specific tool into the conversation

  The agent discovers what it needs via search and loads tools on demand. Loaded tools are available immediately and persist within the conversation thread.

  **Why:**

  When agents have access to 100+ tools (from MCP servers or integrations), including all tool definitions in the context can consume significant tokens (~1,500 tokens per tool). This pattern reduces context usage by giving agents only the tools they need, when they need them.

### Patch Changes

- Update provider registry and model documentation with latest models and providers ([`e6fc281`](https://github.com/mastra-ai/mastra/commit/e6fc281896a3584e9e06465b356a44fe7faade65))

- Fixed processors returning `{ tools: {}, toolChoice: 'none' }` being ignored. Previously, when a processor returned empty tools with an explicit `toolChoice: 'none'` to prevent tool calls, the toolChoice was discarded and defaulted to 'auto'. This fix preserves the explicit 'none' value, enabling patterns like ensuring a final text response when `maxSteps` is reached. ([#12601](https://github.com/mastra-ai/mastra/pull/12601))

- Fix moonshotai/kimi-k2.5 multi-step tool calling failing with "reasoning_content is missing in assistant tool call message" ([#12530](https://github.com/mastra-ai/mastra/pull/12530))
  - Changed moonshotai and moonshotai-cn (China version) providers to use Anthropic-compatible API endpoints instead of OpenAI-compatible
    - moonshotai: `https://api.moonshot.ai/anthropic/v1`
    - moonshotai-cn: `https://api.moonshot.cn/anthropic/v1`
  - This properly handles reasoning_content for kimi-k2.5 model

- Catch up evented workflows on parity with default execution engine ([#12555](https://github.com/mastra-ai/mastra/pull/12555))

- Expose token usage from embedding operations ([#12556](https://github.com/mastra-ai/mastra/pull/12556))
  - `saveMessages` now returns `usage: { tokens: number }` with aggregated token count from all embeddings
  - `recall` now returns `usage: { tokens: number }` from the vector search query embedding
  - Updated abstract method signatures in `MastraMemory` to include optional `usage` in return types

  This allows users to track embedding token usage when using the Memory class.

- Improved workspace filesystem error handling: return 404 for not-found errors instead of 500, show user-friendly error messages in UI, and add MastraClientError class with status/body properties for better error handling ([#12533](https://github.com/mastra-ai/mastra/pull/12533))

- Fixed JSON parsing in agent network to handle malformed LLM output. Uses parsePartialJson from AI SDK to recover truncated JSON, missing braces, and unescaped control characters instead of failing immediately. This reduces unnecessary retry round-trips when the routing agent generates slightly malformed JSON for tool/workflow prompts. Fixes #12519. ([#12526](https://github.com/mastra-ai/mastra/pull/12526))

## 1.1.0

### Minor Changes

- Restructured stored agents to use a thin metadata record with versioned configuration snapshots. ([#12488](https://github.com/mastra-ai/mastra/pull/12488))

  The agent record now only stores metadata fields (id, status, activeVersionId, authorId, metadata, timestamps). All configuration fields (name, instructions, model, tools, etc.) live exclusively in version snapshot rows, enabling full version history and rollback.

  **Key changes:**
  - Stored Agent records are now thin metadata-only (StorageAgentType)
  - All config lives in version snapshots (StorageAgentSnapshotType)
  - New resolved type (StorageResolvedAgentType) merges agent record + active version config
  - Renamed `ownerId` to `authorId` for multi-tenant filtering
  - Changed `memory` field type from `string` to `Record<string, unknown>`
  - Added `status` field ('draft' | 'published') to agent records
  - Flattened CreateAgent/UpdateAgent input types (config fields at top level, no nested snapshot)
  - Version config columns are top-level in the agent_versions table (no single snapshot jsonb column)
  - List endpoints return resolved agents (thin record + active version config)
  - Auto-versioning on update with retention limits and race condition handling

- Added dynamic agent management with CRUD operations and version tracking ([#12038](https://github.com/mastra-ai/mastra/pull/12038))

  **New Features:**
  - Create, edit, and delete agents directly from the Mastra Studio UI
  - Full version history for agents with compare and restore capabilities
  - Visual diff viewer to compare agent configurations across versions
  - Agent creation modal with comprehensive configuration options (model selection, instructions, tools, workflows, sub-agents, memory)
  - AI-powered instruction enhancement

  **Storage:**
  - New storage interfaces for stored agents and agent versions
  - PostgreSQL, LibSQL, and MongoDB implementations included
  - In-memory storage for development and testing

  **API:**
  - RESTful endpoints for agent CRUD operations
  - Version management endpoints (create, list, activate, restore, delete, compare)
  - Automatic versioning on agent updates when enabled

  **Client SDK:**
  - JavaScript client with full support for stored agents and versions
  - Type-safe methods for all CRUD and version operations

  **Usage Example:**

  ```typescript
  // Server-side: Configure storage
  import { Mastra } from '@mastra/core';
  import { PgAgentsStorage } from '@mastra/pg';

  const mastra = new Mastra({
    agents: { agentOne },
    storage: {
      agents: new PgAgentsStorage({
        connectionString: process.env.DATABASE_URL,
      }),
    },
  });

  // Client-side: Use the SDK
  import { MastraClient } from '@mastra/client-js';

  const client = new MastraClient({ baseUrl: 'http://localhost:3000' });

  // Create a stored agent
  const agent = await client.createStoredAgent({
    name: 'Customer Support Agent',
    description: 'Handles customer inquiries',
    model: { provider: 'ANTHROPIC', name: 'claude-sonnet-4-5' },
    instructions: 'You are a helpful customer support agent...',
    tools: ['search', 'email'],
  });

  // Create a version snapshot
  await client.storedAgent(agent.id).createVersion({
    name: 'v1.0 - Initial release',
    changeMessage: 'First production version',
  });

  // Compare versions
  const diff = await client.storedAgent(agent.id).compareVersions('version-1', 'version-2');
  ```

  **Why:**
  This feature enables teams to manage agents dynamically without code changes, making it easier to iterate on agent configurations and maintain a complete audit trail of changes.

- Added unified Workspace API for agent filesystem access, code execution, and search capabilities. ([#11986](https://github.com/mastra-ai/mastra/pull/11986))

  **New Workspace class** combines filesystem, sandbox, and search into a single interface that agents can use for file operations, command execution, and content search.

  **Key features:**
  - Filesystem operations (read, write, copy, move, delete) through pluggable providers
  - Code and command execution in secure sandboxed environments with optional OS-level isolation
  - Keyword search, semantic search, and hybrid search modes
  - Skills system for discovering and using SKILL.md instruction files
  - Safety controls including read-before-write guards, approval flows, and read-only mode

  **Usage:**

  ```typescript
  import { Workspace, LocalFilesystem, LocalSandbox } from '@mastra/core/workspace';

  const workspace = new Workspace({
    filesystem: new LocalFilesystem({ basePath: './workspace' }),
    sandbox: new LocalSandbox({ workingDirectory: './workspace' }),
    bm25: true,
  });

  const agent = new Agent({
    workspace,
    // Agent automatically receives workspace tools
  });
  ```

- Added `status` field to `listTraces` response. The status field indicates the trace state: `success` (completed without error), `error` (has error), or `running` (still in progress). This makes it easier to filter and display traces by their current state without having to derive it from the `error` and `endedAt` fields. ([#12213](https://github.com/mastra-ai/mastra/pull/12213))

- Added `RequestContext.all` to access the entire `RequestContext` object values. ([#12259](https://github.com/mastra-ai/mastra/pull/12259))

  ```typescript
  const { userId, featureFlags } = requestContext.all;
  ```

  Added `requestContextSchema` support to tools, agents, workflows, and steps. Define a Zod schema to validate and type requestContext values at runtime.

  **Tool example:**

  ```typescript
  import { createTool } from '@mastra/core/tools';
  import { z } from 'zod';

  const myTool = createTool({
    id: 'my-tool',
    inputSchema: z.object({ query: z.string() }),
    requestContextSchema: z.object({
      userId: z.string(),
      apiKey: z.string(),
    }),
    execute: async (input, context) => {
      // context.requestContext is typed as RequestContext<{ userId: string, apiKey: string }>
      const userId = context.requestContext?.get('userId');
      return { result: 'success' };
    },
  });
  ```

  **Agent example:**

  ```typescript
  import { Agent } from '@mastra/core/agent';
  import { z } from 'zod';

  const agent = new Agent({
    name: 'my-agent',
    model: openai('gpt-4o'),
    requestContextSchema: z.object({
      userId: z.string(),
      featureFlags: z
        .object({
          debugMode: z.boolean().optional(),
          enableSearch: z.boolean().optional(),
        })
        .optional(),
    }),
    instructions: ({ requestContext }) => {
      // Access validated context values with type safety
      const { userId, featureFlags } = requestContext.all;

      const baseInstructions = `You are a helpful assistant. The current user ID is: ${userId}.`;

      if (featureFlags?.debugMode) {
        return `${baseInstructions} Debug mode is enabled - provide verbose responses.`;
      }

      return baseInstructions;
    },
    tools: ({ requestContext }) => {
      const tools: Record<string, any> = {
        weatherInfo,
      };

      // Conditionally add tools based on validated feature flags
      const { featureFlags } = requestContext.all;
      if (featureFlags?.enableSearch) {
        tools['web_search_preview'] = openai.tools.webSearchPreview();
      }

      return tools;
    },
  });
  ```

  **Workflow example:**

  ```typescript
  import { createWorkflow } from '@mastra/core/workflows';
  import { z } from 'zod';

  const workflow = createWorkflow({
    id: 'my-workflow',
    inputSchema: z.object({ data: z.string() }),
    requestContextSchema: z.object({
      tenantId: z.string(),
    }),
  });

  const step = createStep({
    id: 'my-step',
    description: 'My step description',
    inputSchema: z.object({ data: z.string() }),
    outputSchema: z.object({ result: z.string() }),
    requestContextSchema: z.object({
      userId: z.string(),
    }),
    execute: async ({ inputData, requestContext }) => {
      const userId = requestContext?.get('userId');
      return {
        result: 'some result here',
      };
    },
  });

  workflow.then(step).commit();
  ```

  When requestContextSchema is defined, validation runs automatically and throws an error if required context values are missing or invalid.

### Patch Changes

- dependencies updates: ([#10184](https://github.com/mastra-ai/mastra/pull/10184))
  - Updated dependency [`@isaacs/ttlcache@^2.1.4` ↗︎](https://www.npmjs.com/package/@isaacs/ttlcache/v/2.1.4) (from `^1.4.1`, in `dependencies`)

- Update provider registry and model documentation with latest models and providers ([`1cf5d2e`](https://github.com/mastra-ai/mastra/commit/1cf5d2ea1b085be23e34fb506c80c80a4e6d9c2b))

- Fixed skill loading error caused by Zod version conflicts between v3 and v4. Replaced Zod schemas with plain TypeScript validation functions in skill metadata validation. ([#12485](https://github.com/mastra-ai/mastra/pull/12485))

- Fix model router routing providers that use non-default AI SDK packages (e.g. `@ai-sdk/anthropic`, `@ai-sdk/openai`) to their correct SDK instead of falling back to `openai-compatible`. Add `cerebras`, `togetherai`, and `deepinfra` as native SDK providers. ([#12450](https://github.com/mastra-ai/mastra/pull/12450))

- Make suspendedToolRunId nullable to fix the null issue in tool input validation ([#12303](https://github.com/mastra-ai/mastra/pull/12303))

- Fixed agent.network() to properly pass requestContext to workflow runs. Workflow execution now includes user metadata (userId, resourceId) for observability and analytics. (Fixes #12330) ([#12379](https://github.com/mastra-ai/mastra/pull/12379))

- Fix ModelRouterLanguageModel to propagate supportedUrls from underlying model providers ([#12167](https://github.com/mastra-ai/mastra/pull/12167))

  Previously, `ModelRouterLanguageModel` (used when specifying models as strings like `"mistral/mistral-large-latest"` or `"openai/gpt-4o"`) had `supportedUrls` hardcoded as an empty object. This caused Mastra to download all file URLs and convert them to bytes/base64, even when the model provider supports URLs natively.

  This fix:
  - Changes `supportedUrls` to a lazy `PromiseLike` that resolves the underlying model's supported URL patterns
  - Updates `llm-execution-step.ts` to properly await `supportedUrls` when preparing messages

  **Impact:**
  - Mistral: PDF URLs are now passed directly (fixes #12152)
  - OpenAI: Image URLs (and PDF URLs in response models) are now passed directly
  - Anthropic: Image URLs are now passed directly
  - Google: Files from Google endpoints are now passed directly

  **Note:** Users who were relying on Mastra to download files from URLs that model providers cannot directly access (internal URLs, auth-protected URLs) may need to adjust their approach by either using base64-encoded content or ensuring URLs are publicly accessible to the model provider.

- Extended readOnly memory option to also apply to working memory. When readOnly: true, working memory data is provided as context but the updateWorkingMemory tool is not available. ([#12471](https://github.com/mastra-ai/mastra/pull/12471))

  **Example:**

  ```typescript
  // Working memory is loaded but agent cannot update it
  const response = await agent.generate('What do you know about me?', {
    memory: {
      thread: 'conversation-123',
      resource: 'user-alice-456',
      options: { readOnly: true },
    },
  });
  ```

- fix(core): skip non-serializable values in RequestContext.toJSON ([#12344](https://github.com/mastra-ai/mastra/pull/12344))

- Fixed TypeScript error when calling bail() in workflow steps. bail() now accepts any value, so workflows can exit early with a custom result. Fixes #12424. ([#12429](https://github.com/mastra-ai/mastra/pull/12429))

- Fixed type error when using createTool with Agent when exactOptionalPropertyTypes is enabled in TypeScript config. The ProviderDefinedTool structural type now correctly marks inputSchema as optional and allows execute to be undefined, matching the ToolAction interface. Fixes #12281 ([#12325](https://github.com/mastra-ai/mastra/pull/12325))

- Fixed tracingOptions.tags not being preserved when merging defaultOptions with call-site options. Tags set in agent's defaultOptions.tracingOptions are now correctly passed to all observability exporters (Langfuse, Langsmith, Braintrust, Datadog, etc.). Fixes #12209. ([#12220](https://github.com/mastra-ai/mastra/pull/12220))

- Added activeTools parameter support to model loop stream. The activeTools parameter can now be passed through the ModelLoopStreamArgs to control which tools are available during LLM execution. ([#12082](https://github.com/mastra-ai/mastra/pull/12082))

- Fixed agent network crashing with 'Invalid task input' error when routing agent returns malformed JSON for tool/workflow prompts. The error is now fed back to the routing agent, allowing it to retry with valid JSON on the next iteration. ([#12486](https://github.com/mastra-ai/mastra/pull/12486))

- Fixed type error when passing MastraVoice implementations (like OpenAIVoice) directly to Agent's voice config. Previously, the voice property only accepted CompositeVoice, requiring users to wrap their voice provider. Now you can pass any MastraVoice implementation directly. ([#12329](https://github.com/mastra-ai/mastra/pull/12329))

  **Before (required wrapper):**

  ```typescript
  const agent = new Agent({
    voice: new CompositeVoice({ output: new OpenAIVoice() }),
  });
  ```

  **After (direct usage):**

  ```typescript
  const agent = new Agent({
    voice: new OpenAIVoice(),
  });
  ```

  Fixes #12293

- Fixed output processors not being applied to messages saved during network execution. When using agent.network(), configured output processors (like TraceIdInjector for feedback attribution) are now correctly applied to all messages before they are saved to storage. ([#12346](https://github.com/mastra-ai/mastra/pull/12346))

- Removed deprecated Google `text-embedding-004` embedding model from the model router. Google shut down this model on January 14, 2026. Use `google/gemini-embedding-001` instead. ([#12433](https://github.com/mastra-ai/mastra/pull/12433))

- Fixed tool input validation failing when LLMs send null for optional fields (#12362). Zod's .optional() only accepts undefined, not null, causing validation errors with Gemini and other LLMs. Validation now retries with null values stripped when the initial attempt fails, so .optional() fields accept null while .nullable() fields continue to work correctly. ([#12396](https://github.com/mastra-ai/mastra/pull/12396))

- Tracing fixes: ([#12370](https://github.com/mastra-ai/mastra/pull/12370))
  - Spans now inherit entityType/entityId from the closest non-internal parent (#12250)
  - Processor spans correctly track separate input and output data
  - Model chunk spans are now emitted for all streaming chunks
  - Internal framework spans no longer appear in exported traces

- Fixed generated provider types so IDs starting with digits no longer break TypeScript builds ([#12418](https://github.com/mastra-ai/mastra/pull/12418))

- Fixed network mode not applying user-configured input/output processors (like token limiters) to the routing agent. This caused unbounded context growth during network iterations. ([#12074](https://github.com/mastra-ai/mastra/pull/12074))

  User-configured processors are now correctly passed to the routing agent, while memory-derived processors (which could interfere with routing logic) are excluded.

  Fixes #12016

- Fixed repeated build failures caused by stale global cache (~/.cache/mastra/) containing invalid TypeScript in provider-types.generated.d.ts. Provider names starting with digits (e.g. 302ai) are now properly quoted, and the global cache sync validates .d.ts files before copying to prevent corrupted files from overwriting correct ones. ([#12425](https://github.com/mastra-ai/mastra/pull/12425))

- Update @isaacs/ttlcache to v2 and fix import for v2 compatibility (changed from default to named export) ([#10184](https://github.com/mastra-ai/mastra/pull/10184))

- Fixed custom data parts from writer.custom() breaking subsequent messages with Gemini. Messages containing only data-\* parts no longer produce empty content arrays that cause Gemini to fail with 'must include at least one parts field'. ([#12373](https://github.com/mastra-ai/mastra/pull/12373))

- Improve autoresume prompt sent to LLM to ensure gemini resumes well. ([#12320](https://github.com/mastra-ai/mastra/pull/12320))
  Gemini sometimes doesn't use the previous messages to create inputData for the tool to resume, the prompt was updated to make sure it gets the inputData from the suspended tool call.

- Fixed sub-agents in Agent Networks seeing completion-check feedback from prior iterations, so delegated agents stay focused on their task. Fixes #12224 ([#12338](https://github.com/mastra-ai/mastra/pull/12338))

- Fix TypeScript types for custom API route handlers to include `requestContext` in Hono context Variables. Previously, only `mastra` was typed, causing TypeScript errors when accessing `c.get('requestContext')` even though the runtime correctly provided this context. ([#12419](https://github.com/mastra-ai/mastra/pull/12419))

- Let callers cancel a running agent network call and handle abort callbacks. ([#12351](https://github.com/mastra-ai/mastra/pull/12351))

  **Example**
  Before:

  ```ts
  const stream = await agent.network(task);
  ```

  After:

  ```ts
  const controller = new AbortController();
  const stream = await agent.network(task, {
    abortSignal: controller.signal,
    onAbort: ({ primitiveType, primitiveId }) => {
      logger.info(`Aborted ${primitiveType}:${primitiveId}`);
    },
  });

  controller.abort();
  ```

  Related issue: `#12282`

## 1.1.0-alpha.2

## 1.1.0-alpha.1

### Minor Changes

- Restructured stored agents to use a thin metadata record with versioned configuration snapshots. ([#12488](https://github.com/mastra-ai/mastra/pull/12488))

  The agent record now only stores metadata fields (id, status, activeVersionId, authorId, metadata, timestamps). All configuration fields (name, instructions, model, tools, etc.) live exclusively in version snapshot rows, enabling full version history and rollback.

  **Key changes:**
  - Stored Agent records are now thin metadata-only (StorageAgentType)
  - All config lives in version snapshots (StorageAgentSnapshotType)
  - New resolved type (StorageResolvedAgentType) merges agent record + active version config
  - Renamed `ownerId` to `authorId` for multi-tenant filtering
  - Changed `memory` field type from `string` to `Record<string, unknown>`
  - Added `status` field ('draft' | 'published') to agent records
  - Flattened CreateAgent/UpdateAgent input types (config fields at top level, no nested snapshot)
  - Version config columns are top-level in the agent_versions table (no single snapshot jsonb column)
  - List endpoints return resolved agents (thin record + active version config)
  - Auto-versioning on update with retention limits and race condition handling

### Patch Changes

- Fixed skill loading error caused by Zod version conflicts between v3 and v4. Replaced Zod schemas with plain TypeScript validation functions in skill metadata validation. ([#12485](https://github.com/mastra-ai/mastra/pull/12485))

- Fixed agent network crashing with 'Invalid task input' error when routing agent returns malformed JSON for tool/workflow prompts. The error is now fed back to the routing agent, allowing it to retry with valid JSON on the next iteration. ([#12486](https://github.com/mastra-ai/mastra/pull/12486))

## 1.1.0-alpha.0

### Minor Changes

- Added dynamic agent management with CRUD operations and version tracking ([#12038](https://github.com/mastra-ai/mastra/pull/12038))

  **New Features:**
  - Create, edit, and delete agents directly from the Mastra Studio UI
  - Full version history for agents with compare and restore capabilities
  - Visual diff viewer to compare agent configurations across versions
  - Agent creation modal with comprehensive configuration options (model selection, instructions, tools, workflows, sub-agents, memory)
  - AI-powered instruction enhancement

  **Storage:**
  - New storage interfaces for stored agents and agent versions
  - PostgreSQL, LibSQL, and MongoDB implementations included
  - In-memory storage for development and testing

  **API:**
  - RESTful endpoints for agent CRUD operations
  - Version management endpoints (create, list, activate, restore, delete, compare)
  - Automatic versioning on agent updates when enabled

  **Client SDK:**
  - JavaScript client with full support for stored agents and versions
  - Type-safe methods for all CRUD and version operations

  **Usage Example:**

  ```typescript
  // Server-side: Configure storage
  import { Mastra } from '@mastra/core';
  import { PgAgentsStorage } from '@mastra/pg';

  const mastra = new Mastra({
    agents: { agentOne },
    storage: {
      agents: new PgAgentsStorage({
        connectionString: process.env.DATABASE_URL,
      }),
    },
  });

  // Client-side: Use the SDK
  import { MastraClient } from '@mastra/client-js';

  const client = new MastraClient({ baseUrl: 'http://localhost:3000' });

  // Create a stored agent
  const agent = await client.createStoredAgent({
    name: 'Customer Support Agent',
    description: 'Handles customer inquiries',
    model: { provider: 'ANTHROPIC', name: 'claude-sonnet-4-5' },
    instructions: 'You are a helpful customer support agent...',
    tools: ['search', 'email'],
  });

  // Create a version snapshot
  await client.storedAgent(agent.id).createVersion({
    name: 'v1.0 - Initial release',
    changeMessage: 'First production version',
  });

  // Compare versions
  const diff = await client.storedAgent(agent.id).compareVersions('version-1', 'version-2');
  ```

  **Why:**
  This feature enables teams to manage agents dynamically without code changes, making it easier to iterate on agent configurations and maintain a complete audit trail of changes.

- Added unified Workspace API for agent filesystem access, code execution, and search capabilities. ([#11986](https://github.com/mastra-ai/mastra/pull/11986))

  **New Workspace class** combines filesystem, sandbox, and search into a single interface that agents can use for file operations, command execution, and content search.

  **Key features:**
  - Filesystem operations (read, write, copy, move, delete) through pluggable providers
  - Code and command execution in secure sandboxed environments with optional OS-level isolation
  - Keyword search, semantic search, and hybrid search modes
  - Skills system for discovering and using SKILL.md instruction files
  - Safety controls including read-before-write guards, approval flows, and read-only mode

  **Usage:**

  ```typescript
  import { Workspace, LocalFilesystem, LocalSandbox } from '@mastra/core/workspace';

  const workspace = new Workspace({
    filesystem: new LocalFilesystem({ basePath: './workspace' }),
    sandbox: new LocalSandbox({ workingDirectory: './workspace' }),
    bm25: true,
  });

  const agent = new Agent({
    workspace,
    // Agent automatically receives workspace tools
  });
  ```

- Added `status` field to `listTraces` response. The status field indicates the trace state: `success` (completed without error), `error` (has error), or `running` (still in progress). This makes it easier to filter and display traces by their current state without having to derive it from the `error` and `endedAt` fields. ([#12213](https://github.com/mastra-ai/mastra/pull/12213))

- Added `RequestContext.all` to access the entire `RequestContext` object values. ([#12259](https://github.com/mastra-ai/mastra/pull/12259))

  ```typescript
  const { userId, featureFlags } = requestContext.all;
  ```

  Added `requestContextSchema` support to tools, agents, workflows, and steps. Define a Zod schema to validate and type requestContext values at runtime.

  **Tool example:**

  ```typescript
  import { createTool } from '@mastra/core/tools';
  import { z } from 'zod';

  const myTool = createTool({
    id: 'my-tool',
    inputSchema: z.object({ query: z.string() }),
    requestContextSchema: z.object({
      userId: z.string(),
      apiKey: z.string(),
    }),
    execute: async (input, context) => {
      // context.requestContext is typed as RequestContext<{ userId: string, apiKey: string }>
      const userId = context.requestContext?.get('userId');
      return { result: 'success' };
    },
  });
  ```

  **Agent example:**

  ```typescript
  import { Agent } from '@mastra/core/agent';
  import { z } from 'zod';

  const agent = new Agent({
    name: 'my-agent',
    model: openai('gpt-4o'),
    requestContextSchema: z.object({
      userId: z.string(),
      featureFlags: z
        .object({
          debugMode: z.boolean().optional(),
          enableSearch: z.boolean().optional(),
        })
        .optional(),
    }),
    instructions: ({ requestContext }) => {
      // Access validated context values with type safety
      const { userId, featureFlags } = requestContext.all;

      const baseInstructions = `You are a helpful assistant. The current user ID is: ${userId}.`;

      if (featureFlags?.debugMode) {
        return `${baseInstructions} Debug mode is enabled - provide verbose responses.`;
      }

      return baseInstructions;
    },
    tools: ({ requestContext }) => {
      const tools: Record<string, any> = {
        weatherInfo,
      };

      // Conditionally add tools based on validated feature flags
      const { featureFlags } = requestContext.all;
      if (featureFlags?.enableSearch) {
        tools['web_search_preview'] = openai.tools.webSearchPreview();
      }

      return tools;
    },
  });
  ```

  **Workflow example:**

  ```typescript
  import { createWorkflow } from '@mastra/core/workflows';
  import { z } from 'zod';

  const workflow = createWorkflow({
    id: 'my-workflow',
    inputSchema: z.object({ data: z.string() }),
    requestContextSchema: z.object({
      tenantId: z.string(),
    }),
  });

  const step = createStep({
    id: 'my-step',
    description: 'My step description',
    inputSchema: z.object({ data: z.string() }),
    outputSchema: z.object({ result: z.string() }),
    requestContextSchema: z.object({
      userId: z.string(),
    }),
    execute: async ({ inputData, requestContext }) => {
      const userId = requestContext?.get('userId');
      return {
        result: 'some result here',
      };
    },
  });

  workflow.then(step).commit();
  ```

  When requestContextSchema is defined, validation runs automatically and throws an error if required context values are missing or invalid.

### Patch Changes

- dependencies updates: ([#10184](https://github.com/mastra-ai/mastra/pull/10184))
  - Updated dependency [`@isaacs/ttlcache@^2.1.4` ↗︎](https://www.npmjs.com/package/@isaacs/ttlcache/v/2.1.4) (from `^1.4.1`, in `dependencies`)

- Update provider registry and model documentation with latest models and providers ([`1cf5d2e`](https://github.com/mastra-ai/mastra/commit/1cf5d2ea1b085be23e34fb506c80c80a4e6d9c2b))

- Fix model router routing providers that use non-default AI SDK packages (e.g. `@ai-sdk/anthropic`, `@ai-sdk/openai`) to their correct SDK instead of falling back to `openai-compatible`. Add `cerebras`, `togetherai`, and `deepinfra` as native SDK providers. ([#12450](https://github.com/mastra-ai/mastra/pull/12450))

- Make suspendedToolRunId nullable to fix the null issue in tool input validation ([#12303](https://github.com/mastra-ai/mastra/pull/12303))

- Fixed agent.network() to properly pass requestContext to workflow runs. Workflow execution now includes user metadata (userId, resourceId) for observability and analytics. (Fixes #12330) ([#12379](https://github.com/mastra-ai/mastra/pull/12379))

- Fix ModelRouterLanguageModel to propagate supportedUrls from underlying model providers ([#12167](https://github.com/mastra-ai/mastra/pull/12167))

  Previously, `ModelRouterLanguageModel` (used when specifying models as strings like `"mistral/mistral-large-latest"` or `"openai/gpt-4o"`) had `supportedUrls` hardcoded as an empty object. This caused Mastra to download all file URLs and convert them to bytes/base64, even when the model provider supports URLs natively.

  This fix:
  - Changes `supportedUrls` to a lazy `PromiseLike` that resolves the underlying model's supported URL patterns
  - Updates `llm-execution-step.ts` to properly await `supportedUrls` when preparing messages

  **Impact:**
  - Mistral: PDF URLs are now passed directly (fixes #12152)
  - OpenAI: Image URLs (and PDF URLs in response models) are now passed directly
  - Anthropic: Image URLs are now passed directly
  - Google: Files from Google endpoints are now passed directly

  **Note:** Users who were relying on Mastra to download files from URLs that model providers cannot directly access (internal URLs, auth-protected URLs) may need to adjust their approach by either using base64-encoded content or ensuring URLs are publicly accessible to the model provider.

- Extended readOnly memory option to also apply to working memory. When readOnly: true, working memory data is provided as context but the updateWorkingMemory tool is not available. ([#12471](https://github.com/mastra-ai/mastra/pull/12471))

  **Example:**

  ```typescript
  // Working memory is loaded but agent cannot update it
  const response = await agent.generate('What do you know about me?', {
    memory: {
      thread: 'conversation-123',
      resource: 'user-alice-456',
      options: { readOnly: true },
    },
  });
  ```

- fix(core): skip non-serializable values in RequestContext.toJSON ([#12344](https://github.com/mastra-ai/mastra/pull/12344))

- Fixed TypeScript error when calling bail() in workflow steps. bail() now accepts any value, so workflows can exit early with a custom result. Fixes #12424. ([#12429](https://github.com/mastra-ai/mastra/pull/12429))

- Fixed type error when using createTool with Agent when exactOptionalPropertyTypes is enabled in TypeScript config. The ProviderDefinedTool structural type now correctly marks inputSchema as optional and allows execute to be undefined, matching the ToolAction interface. Fixes #12281 ([#12325](https://github.com/mastra-ai/mastra/pull/12325))

- Fixed tracingOptions.tags not being preserved when merging defaultOptions with call-site options. Tags set in agent's defaultOptions.tracingOptions are now correctly passed to all observability exporters (Langfuse, Langsmith, Braintrust, Datadog, etc.). Fixes #12209. ([#12220](https://github.com/mastra-ai/mastra/pull/12220))

- Added activeTools parameter support to model loop stream. The activeTools parameter can now be passed through the ModelLoopStreamArgs to control which tools are available during LLM execution. ([#12082](https://github.com/mastra-ai/mastra/pull/12082))

- Fixed type error when passing MastraVoice implementations (like OpenAIVoice) directly to Agent's voice config. Previously, the voice property only accepted CompositeVoice, requiring users to wrap their voice provider. Now you can pass any MastraVoice implementation directly. ([#12329](https://github.com/mastra-ai/mastra/pull/12329))

  **Before (required wrapper):**

  ```typescript
  const agent = new Agent({
    voice: new CompositeVoice({ output: new OpenAIVoice() }),
  });
  ```

  **After (direct usage):**

  ```typescript
  const agent = new Agent({
    voice: new OpenAIVoice(),
  });
  ```

  Fixes #12293

- Fixed output processors not being applied to messages saved during network execution. When using agent.network(), configured output processors (like TraceIdInjector for feedback attribution) are now correctly applied to all messages before they are saved to storage. ([#12346](https://github.com/mastra-ai/mastra/pull/12346))

- Removed deprecated Google `text-embedding-004` embedding model from the model router. Google shut down this model on January 14, 2026. Use `google/gemini-embedding-001` instead. ([#12433](https://github.com/mastra-ai/mastra/pull/12433))

- Fixed tool input validation failing when LLMs send null for optional fields (#12362). Zod's .optional() only accepts undefined, not null, causing validation errors with Gemini and other LLMs. Validation now retries with null values stripped when the initial attempt fails, so .optional() fields accept null while .nullable() fields continue to work correctly. ([#12396](https://github.com/mastra-ai/mastra/pull/12396))

- Tracing fixes: ([#12370](https://github.com/mastra-ai/mastra/pull/12370))
  - Spans now inherit entityType/entityId from the closest non-internal parent (#12250)
  - Processor spans correctly track separate input and output data
  - Model chunk spans are now emitted for all streaming chunks
  - Internal framework spans no longer appear in exported traces

- Fixed generated provider types so IDs starting with digits no longer break TypeScript builds ([#12418](https://github.com/mastra-ai/mastra/pull/12418))

- Fixed network mode not applying user-configured input/output processors (like token limiters) to the routing agent. This caused unbounded context growth during network iterations. ([#12074](https://github.com/mastra-ai/mastra/pull/12074))

  User-configured processors are now correctly passed to the routing agent, while memory-derived processors (which could interfere with routing logic) are excluded.

  Fixes #12016

- Fixed repeated build failures caused by stale global cache (~/.cache/mastra/) containing invalid TypeScript in provider-types.generated.d.ts. Provider names starting with digits (e.g. 302ai) are now properly quoted, and the global cache sync validates .d.ts files before copying to prevent corrupted files from overwriting correct ones. ([#12425](https://github.com/mastra-ai/mastra/pull/12425))

- Update @isaacs/ttlcache to v2 and fix import for v2 compatibility (changed from default to named export) ([#10184](https://github.com/mastra-ai/mastra/pull/10184))

- Fixed custom data parts from writer.custom() breaking subsequent messages with Gemini. Messages containing only data-\* parts no longer produce empty content arrays that cause Gemini to fail with 'must include at least one parts field'. ([#12373](https://github.com/mastra-ai/mastra/pull/12373))

- Improve autoresume prompt sent to LLM to ensure gemini resumes well. ([#12320](https://github.com/mastra-ai/mastra/pull/12320))
  Gemini sometimes doesn't use the previous messages to create inputData for the tool to resume, the prompt was updated to make sure it gets the inputData from the suspended tool call.

- Fixed sub-agents in Agent Networks seeing completion-check feedback from prior iterations, so delegated agents stay focused on their task. Fixes #12224 ([#12338](https://github.com/mastra-ai/mastra/pull/12338))

- Fix TypeScript types for custom API route handlers to include `requestContext` in Hono context Variables. Previously, only `mastra` was typed, causing TypeScript errors when accessing `c.get('requestContext')` even though the runtime correctly provided this context. ([#12419](https://github.com/mastra-ai/mastra/pull/12419))

- Let callers cancel a running agent network call and handle abort callbacks. ([#12351](https://github.com/mastra-ai/mastra/pull/12351))

  **Example**
  Before:

  ```ts
  const stream = await agent.network(task);
  ```

  After:

  ```ts
  const controller = new AbortController();
  const stream = await agent.network(task, {
    abortSignal: controller.signal,
    onAbort: ({ primitiveType, primitiveId }) => {
      logger.info(`Aborted ${primitiveType}:${primitiveId}`);
    },
  });

  controller.abort();
  ```

  Related issue: `#12282`

## 1.0.4

## 1.0.4-alpha.0

## 1.0.0

### Major Changes

- Moving scorers under the eval domain, api method consistency, prebuilt evals, scorers require ids. ([#9589](https://github.com/mastra-ai/mastra/pull/9589))

- Scorers for Agents will now use `MastraDBMessage` instead of `UIMessage` ([#9702](https://github.com/mastra-ai/mastra/pull/9702))
  - Scorer input/output types now use `MastraDBMessage[]` with nested `content` object structure
  - Added `getTextContentFromMastraDBMessage()` helper function to extract text content from `MastraDBMessage` objects
  - Added `createTestMessage()` helper function for creating `MastraDBMessage` objects in tests with optional tool invocations support
  - Updated `extractToolCalls()` to access tool invocations from nested `content` structure
  - Updated `getUserMessageFromRunInput()` and `getAssistantMessageFromRunOutput()` to use new message structure
  - Removed `createUIMessage()`

- Every Mastra primitive (agent, MCPServer, workflow, tool, processor, scorer, and vector) now has a get, list, and add method associated with it. Each primitive also now requires an id to be set. ([#9675](https://github.com/mastra-ai/mastra/pull/9675))

  Primitives that are added to other primitives are also automatically added to the Mastra instance

- Update handlers to use `listWorkflowRuns` instead of `getWorkflowRuns`. Fix type names from `StoragelistThreadsByResourceIdInput/Output` to `StorageListThreadsByResourceIdInput/Output`. ([#9507](https://github.com/mastra-ai/mastra/pull/9507))

- Refactor workflow and tool types to remove Zod-specific constraints ([#11814](https://github.com/mastra-ai/mastra/pull/11814))

  Removed Zod-specific type constraints across all workflow implementations and tool types, replacing them with generic types. This ensures type consistency across default, evented, and inngest workflows while preparing for Zod v4 migration.

  **Workflow Changes:**
  - Removed `z.ZodObject<any>` and `z.ZodType<any>` constraints from all workflow generic types
  - Updated method signatures to use `TInput` and `TState` directly instead of `z.infer<TInput>` and `z.infer<TState>`
  - Aligned conditional types across all workflow implementations using `TInput extends unknown` pattern
  - Fixed `TSteps` generic to properly use `TEngineType` instead of `any`

  **Tool Changes:**
  - Removed Zod schema constraints from `ToolExecutionContext` and related interfaces
  - Simplified type parameters from `TSuspendSchema extends ZodLikeSchema` to `TSuspend` and `TResume`
  - Updated tool execution context types to use generic types

  **Type Utilities:**
  - Refactored type helpers to work with generic schemas instead of Zod-specific types
  - Updated type extraction utilities for better compatibility

  This change maintains backward compatibility while improving type consistency and preparing for Zod v4 support across all affected packages.

- Remove `getMessagesPaginated()` and add `perPage: false` support ([#9670](https://github.com/mastra-ai/mastra/pull/9670))

  Removes deprecated `getMessagesPaginated()` method. The `listMessages()` API and score handlers now support `perPage: false` to fetch all records without pagination limits.

  **Storage changes:**
  - `StoragePagination.perPage` type changed from `number` to `number | false`
  - All storage implementations support `perPage: false`:
    - Memory: `listMessages()`
    - Scores: `listScoresBySpan()`, `listScoresByRunId()`, `listScoresByExecutionId()`
  - HTTP query parser accepts `"false"` string (e.g., `?perPage=false`)

  **Memory changes:**
  - `memory.query()` parameter type changed from `StorageGetMessagesArg` to `StorageListMessagesInput`
  - Uses flat parameters (`page`, `perPage`, `include`, `filter`, `vectorSearchString`) instead of `selectBy` object

  **Stricter validation:**
  - `listMessages()` requires non-empty, non-whitespace `threadId` (throws error instead of returning empty results)

  **Migration:**

  ```typescript
  // Storage/Memory: Replace getMessagesPaginated with listMessages
  - storage.getMessagesPaginated({ threadId, selectBy: { pagination: { page: 0, perPage: 20 } } })
  + storage.listMessages({ threadId, page: 0, perPage: 20 })
  + storage.listMessages({ threadId, page: 0, perPage: false })  // Fetch all

  // Memory: Replace selectBy with flat parameters
  - memory.query({ threadId, selectBy: { last: 20, include: [...] } })
  + memory.query({ threadId, perPage: 20, include: [...] })

  // Client SDK
  - thread.getMessagesPaginated({ selectBy: { pagination: { page: 0 } } })
  + thread.listMessages({ page: 0, perPage: 20 })
  ```

- **Removed `storage.getMessages()`** ([#9695](https://github.com/mastra-ai/mastra/pull/9695))

  The `getMessages()` method has been removed from all storage implementations. Use `listMessages()` instead, which provides pagination support.

  **Migration:**

  ```typescript
  // Before
  const messages = await storage.getMessages({ threadId: 'thread-1' });

  // After
  const result = await storage.listMessages({
    threadId: 'thread-1',
    page: 0,
    perPage: 50,
  });
  const messages = result.messages; // Access messages array
  console.log(result.total); // Total count
  console.log(result.hasMore); // Whether more pages exist
  ```

  **Message ordering default**

  `listMessages()` defaults to ASC (oldest first) ordering by `createdAt`, matching the previous `getMessages()` behavior.

  **To use DESC ordering (newest first):**

  ```typescript
  const result = await storage.listMessages({
    threadId: 'thread-1',
    orderBy: { field: 'createdAt', direction: 'DESC' },
  });
  ```

  **Renamed `client.getThreadMessages()` → `client.listThreadMessages()`**

  **Migration:**

  ```typescript
  // Before
  const response = await client.getThreadMessages(threadId, { agentId });

  // After
  const response = await client.listThreadMessages(threadId, { agentId });
  ```

  The response format remains the same.

  **Removed `StorageGetMessagesArg` type**

  Use `StorageListMessagesInput` instead:

  ```typescript
  // Before
  import type { StorageGetMessagesArg } from '@mastra/core';

  // After
  import type { StorageListMessagesInput } from '@mastra/core';
  ```

- - Removes modelSettings.abortSignal in favour of top-level abortSignal only. Also removes the deprecated output field - use structuredOutput.schema instead. ([`9e1911d`](https://github.com/mastra-ai/mastra/commit/9e1911db2b4db85e0e768c3f15e0d61e319869f6))
  - The deprecated generateVNext() and streamVNext() methods have been removed since they're now the stable generate() and stream() methods.
  - The deprecated `output` option has been removed entirely, in favour of `structuredOutput`.

  Method renames to clarify the API surface:
  - getDefaultGenerateOptions → getDefaultGenerateOptionsLegacy
  - getDefaultStreamOptions → getDefaultStreamOptionsLegacy
  - getDefaultVNextStreamOptions → getDefaultStreamOptions

- Bump minimum required Node.js version to 22.13.0 ([#9706](https://github.com/mastra-ai/mastra/pull/9706))

- Replace `getThreadsByResourceIdPaginated` with `listThreadsByResourceId` across memory handlers. Update client SDK to use `listThreads()` with `offset`/`limit` parameters instead of deprecated `getMemoryThreads()`. Consolidate `/api/memory/threads` routes to single paginated endpoint. ([#9508](https://github.com/mastra-ai/mastra/pull/9508))

- Add new list methods to storage API: `listMessages`, `listMessagesById`, `listThreadsByResourceId`, and `listWorkflowRuns`. Most methods are currently wrappers around existing methods. Full implementations will be added when migrating away from legacy methods. ([#9489](https://github.com/mastra-ai/mastra/pull/9489))

- Update tool execution signature ([#9587](https://github.com/mastra-ai/mastra/pull/9587))

  Consolidated the 3 different execution contexts to one

  ```typescript
  // before depending on the context the tool was executed in
  tool.execute({ context: data });
  tool.execute({ context: { inputData: data } });
  tool.execute(data);

  // now, for all contexts
  tool.execute(data, context);
  ```

  **Before:**

  ```typescript
  inputSchema: z.object({ something: z.string() }),
  execute: async ({ context, tracingContext, runId, ... }) => {
    return doSomething(context.string);
  }
  ```

  **After:**

  ```typescript
  inputSchema: z.object({ something: z.string() }),
  execute: async (inputData, context) => {
    const { agent, mcp, workflow, ...sharedContext } = context

    // context that only an agent would get like toolCallId, messages, suspend, resume, etc
    if (agent) {
      doSomething(inputData.something, agent)
    // context that only a workflow would get like runId, state, suspend, resume, etc
    } else if (workflow) {
      doSomething(inputData.something, workflow)
    // context that only a workflow would get like "extra", "elicitation"
    } else if (mcp) {
      doSomething(inputData.something, mcp)
    } else {
      // Running a tool in no execution context
      return doSomething(inputData.something);
    }
  }
  ```

- The `@mastra/core` package no longer allows top-level imports except for `Mastra` and `type Config`. You must use subpath imports for all other imports. ([#9544](https://github.com/mastra-ai/mastra/pull/9544))

  For example:

  ```diff
    import { Mastra, type Config } from "@mastra/core";
  - import { Agent } from "@mastra/core";
  - import { createTool } from "@mastra/core";
  - import { createStep } from "@mastra/core";

  + import { Agent } from "@mastra/core/agent";
  + import { createTool } from "@mastra/core/tools";
  + import { createStep } from "@mastra/core/workflows";
  ```

- This simplifies the Memory API by removing the confusing rememberMessages method and renaming query to recall for better clarity. ([#9701](https://github.com/mastra-ai/mastra/pull/9701))

  The rememberMessages method name implied it might persist data when it was actually just retrieving messages, same as query. Having two methods that did essentially the same thing was unnecessary.

  Before:

  ```typescript
  // Two methods that did the same thing
  memory.rememberMessages({ threadId, resourceId, config, vectorMessageSearch });
  memory.query({ threadId, resourceId, perPage, vectorSearchString });
  ```

  After:

  ```typescript
  // Single unified method with clear purpose
  memory.recall({ threadId, resourceId, perPage, vectorMessageSearch, threadConfig });
  ```

  All usages have been updated across the codebase including tests. The agent now calls recall directly with the appropriate parameters.

- Rename RuntimeContext to RequestContext ([#9511](https://github.com/mastra-ai/mastra/pull/9511))

- Implement listMessages API for replacing previous methods ([#9531](https://github.com/mastra-ai/mastra/pull/9531))

- Rename `defaultVNextStreamOptions` to `defaultOptions`. Add "Legacy" suffix to v1 option properties and methods (`defaultGenerateOptions` → `defaultGenerateOptionsLegacy`, `defaultStreamOptions` → `defaultStreamOptionsLegacy`). ([#9535](https://github.com/mastra-ai/mastra/pull/9535))

- **Breaking Change**: Convert OUTPUT generic from `OutputSchema` constraint to plain generic ([#11741](https://github.com/mastra-ai/mastra/pull/11741))

  This change removes the direct dependency on Zod typings in the public API by converting all `OUTPUT extends OutputSchema` generic constraints to plain `OUTPUT` generics throughout the codebase. This is preparation for moving to a standard schema approach.
  - All generic type parameters previously constrained to `OutputSchema` (e.g., `<OUTPUT extends OutputSchema = undefined>`) are now plain generics with defaults (e.g., `<OUTPUT = undefined>`)
  - Affects all public APIs including `Agent`, `MastraModelOutput`, `AgentExecutionOptions`, and stream/generate methods
  - `InferSchemaOutput<OUTPUT>` replaced with `OUTPUT` throughout
  - `PartialSchemaOutput<OUTPUT>` replaced with `Partial<OUTPUT>`
  - Schema fields now use `NonNullable<OutputSchema<OUTPUT>>` instead of `OUTPUT` directly
  - Added `FullOutput<OUTPUT>` type representing complete output with all fields
  - Added `AgentExecutionOptionsBase<OUTPUT>` type
  - `getFullOutput()` method now returns `Promise<FullOutput<OUTPUT>>`
  - `Agent` class now generic: `Agent<TAgentId, TTools, TOutput>`
  - `agent.generate()` and `agent.stream()` methods have updated signatures
  - `MastraModelOutput<OUTPUT>` no longer requires `OutputSchema` constraint
  - Network route and streaming APIs updated to use plain OUTPUT generic

  **Before:**

  ```typescript
  const output = await agent.generate<z.ZodType>([...], {
    structuredOutput: { schema: mySchema }
  });

  **After:**
  const output = await agent.generate<z.infer<typeof mySchema>>([...], {
    structuredOutput: { schema: mySchema }
  });
  // Or rely on type inference:
  const output = await agent.generate([...], {
    structuredOutput: { schema: mySchema }
  });

  ```

- Remove `getThreadsByResourceId` and `getThreadsByResourceIdPaginated` methods from storage interfaces in favor of `listThreadsByResourceId`. The new method uses `offset`/`limit` pagination and a nested `orderBy` object structure (`{ field, direction }`). ([#9536](https://github.com/mastra-ai/mastra/pull/9536))

- Remove `getMessagesById` method from storage interfaces in favor of `listMessagesById`. The new method only returns V2-format messages and removes the format parameter, simplifying the API surface. Users should migrate from `getMessagesById({ messageIds, format })` to `listMessagesById({ messageIds })`. ([#9534](https://github.com/mastra-ai/mastra/pull/9534))

- Experimental auth -> auth ([#9660](https://github.com/mastra-ai/mastra/pull/9660))

- Renamed a bunch of observability/tracing-related things to drop the AI prefix. ([#9744](https://github.com/mastra-ai/mastra/pull/9744))

- Removed MastraMessageV3 intermediary format, now we go from MastraDBMessage->aiv5 formats and back directly ([#9094](https://github.com/mastra-ai/mastra/pull/9094))

- **Breaking Change**: Remove legacy v1 watch events and consolidate on v2 implementation. ([#9252](https://github.com/mastra-ai/mastra/pull/9252))

  This change simplifies the workflow watching API by removing the legacy v1 event system and promoting v2 as the standard (renamed to just `watch`).

  **What's Changed**
  - Removed legacy v1 watch event handlers and types
  - Renamed `watch-v2` to `watch` throughout the codebase
  - Removed `.watch()` method from client-js SDK (`Workflow` and `AgentBuilder` classes)
  - Removed `/watch` HTTP endpoints from server and deployer
  - Removed `WorkflowWatchResult` and v1 `WatchEvent` types

- Remove various deprecated APIs from agent class. ([#9257](https://github.com/mastra-ai/mastra/pull/9257))
  - `agent.llm` → `agent.getLLM()`
  - `agent.tools` → `agent.getTools()`
  - `agent.instructions` → `agent.getInstructions()`
  - `agent.speak()` → `agent.voice.speak()`
  - `agent.getSpeakers()` → `agent.voice.getSpeakers()`
  - `agent.listen` → `agent.voice.listen()`
  - `agent.fetchMemory` → `(await agent.getMemory()).query()`
  - `agent.toStep` → Add agent directly to the step, workflows handle the transformation

- Pagination APIs now use `page`/`perPage` instead of `offset`/`limit` ([#9592](https://github.com/mastra-ai/mastra/pull/9592))

  All storage and memory pagination APIs have been updated to use `page` (0-indexed) and `perPage` instead of `offset` and `limit`, aligning with standard REST API patterns.

  **Affected APIs:**
  - `Memory.listThreadsByResourceId()`
  - `Memory.listMessages()`
  - `Storage.listWorkflowRuns()`

  **Migration:**

  ```typescript
  // Before
  await memory.listThreadsByResourceId({
    resourceId: 'user-123',
    offset: 20,
    limit: 10,
  });

  // After
  await memory.listThreadsByResourceId({
    resourceId: 'user-123',
    page: 2, // page = Math.floor(offset / limit)
    perPage: 10,
  });

  // Before
  await memory.listMessages({
    threadId: 'thread-456',
    offset: 20,
    limit: 10,
  });

  // After
  await memory.listMessages({
    threadId: 'thread-456',
    page: 2,
    perPage: 10,
  });

  // Before
  await storage.listWorkflowRuns({
    workflowName: 'my-workflow',
    offset: 20,
    limit: 10,
  });

  // After
  await storage.listWorkflowRuns({
    workflowName: 'my-workflow',
    page: 2,
    perPage: 10,
  });
  ```

  **Additional improvements:**
  - Added validation for negative `page` values in all storage implementations
  - Improved `perPage` validation to handle edge cases (negative values, `0`, `false`)
  - Added reusable query parser utilities for consistent validation in handlers

- ```ts ([#9709](https://github.com/mastra-ai/mastra/pull/9709))
  import { Mastra } from '@mastra/core';
  import { Observability } from '@mastra/observability'; // Explicit import

  const mastra = new Mastra({
    ...other_config,
    observability: new Observability({
      default: { enabled: true },
    }), // Instance
  });
  ```

  Instead of:

  ```ts
  import { Mastra } from '@mastra/core';
  import '@mastra/observability/init'; // Explicit import

  const mastra = new Mastra({
    ...other_config,
    observability: {
      default: { enabled: true },
    },
  });
  ```

  Also renamed a bunch of:
  - `Tracing` things to `Observability` things.
  - `AI-` things to just things.

- Changing getAgents -> listAgents, getTools -> listTools, getWorkflows -> listWorkflows ([#9495](https://github.com/mastra-ai/mastra/pull/9495))

- Removed old tracing code based on OpenTelemetry ([#9237](https://github.com/mastra-ai/mastra/pull/9237))

- Remove deprecated vector prompts and cohere provider from code ([#9596](https://github.com/mastra-ai/mastra/pull/9596))

- Renamed MastraStorage to MastraCompositeStore for better clarity. The old MastraStorage name remains available as a deprecated alias for backward compatibility, but will be removed in a future version. ([#12093](https://github.com/mastra-ai/mastra/pull/12093))

  **Migration:**

  Update your imports and usage:

  ```typescript
  // Before
  import { MastraStorage } from '@mastra/core/storage';

  const storage = new MastraStorage({
    id: 'composite',
    domains: { ... }
  });

  // After
  import { MastraCompositeStore } from '@mastra/core/storage';

  const storage = new MastraCompositeStore({
    id: 'composite',
    domains: { ... }
  });
  ```

  The new name better reflects that this is a composite storage implementation that routes different domains (workflows, traces, messages) to different underlying stores, avoiding confusion with the general "Mastra Storage" concept.

- Mark as stable ([`83d5942`](https://github.com/mastra-ai/mastra/commit/83d5942669ce7bba4a6ca4fd4da697a10eb5ebdc))

- Changed `.branch()` result schema to make all branch output fields optional. ([#10693](https://github.com/mastra-ai/mastra/pull/10693))

  **Breaking change**: Branch outputs are now optional since only one branch executes at runtime. Update your workflow schemas to handle optional branch results.

  **Before:**

  ```typescript
  const workflow = createWorkflow({...})
    .branch([
      [condition1, stepA],  // outputSchema: { result: z.string() }
      [condition2, stepB],  // outputSchema: { data: z.number() }
    ])
    .map({
      finalResult: { step: stepA, path: 'result' }  // Expected non-optional
    });
  ```

  **After:**

  ```typescript
  const workflow = createWorkflow({...})
    .branch([
      [condition1, stepA],
      [condition2, stepB],
    ])
    .map({
      finalResult: {
        step: stepA,
        path: 'result'  // Now optional - provide fallback
      }
    });
  ```

  **Why**: Branch conditionals execute only one path, so non-executed branches don't produce outputs. The type system now correctly reflects this runtime behavior.

  Related issue: https://github.com/mastra-ai/mastra/issues/10642

- Enforcing id required on Processor primitive ([#9591](https://github.com/mastra-ai/mastra/pull/9591))

- **Breaking Changes:** ([#9045](https://github.com/mastra-ai/mastra/pull/9045))
  - Moved `generateTitle` from `threads.generateTitle` to top-level memory option
  - Changed default value from `true` to `false`
  - Using `threads.generateTitle` now throws an error

  **Migration:**
  Replace `threads: { generateTitle: true }` with `generateTitle: true` at the top level of memory options.

  **Playground:**
  The playground UI now displays thread IDs instead of "Chat from" when titles aren't generated.

- Renamed `MastraMessageV2` to `MastraDBMessage` ([#9255](https://github.com/mastra-ai/mastra/pull/9255))
  Made the return format of all methods that return db messages consistent. It's always `{ messages: MastraDBMessage[] }` now, and messages can be converted after that using `@mastra/ai-sdk/ui`'s `toAISdkV4/5Messages()` function

- moved ai-tracing code into @mastra/observability ([#9661](https://github.com/mastra-ai/mastra/pull/9661))

- Remove legacy evals from Mastra ([#9491](https://github.com/mastra-ai/mastra/pull/9491))

- Use tool's outputSchema to validate results and return an error object if schema does not match output results. ([#9664](https://github.com/mastra-ai/mastra/pull/9664))

  ```typescript
  const getUserTool = createTool({
    id: 'get-user',
    outputSchema: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string().email(),
    }),
    execute: async inputData => {
      return { id: '123', name: 'John' };
    },
  });
  ```

  When validation fails, the tool returns a `ValidationError`:

  ```typescript
  // Before v1 - invalid output would silently pass through
  await getUserTool.execute({});
  // { id: "123", name: "John" } - missing email

  // After v1 - validation error is returned
  await getUserTool.execute({});
  // {
  //   error: true,
  //   message: "Tool output validation failed for get-user. The tool returned invalid output:\n- email: Required\n\nReturned output: {...}",
  //   validationErrors: { ... }
  // }
  ```

- Removes deprecated input-processor type and processors. ([#9200](https://github.com/mastra-ai/mastra/pull/9200))

### Minor Changes

- Add context parameter to `idGenerator` to enable deterministic ID generation based on context. ([#10964](https://github.com/mastra-ai/mastra/pull/10964))

  The `idGenerator` function now receives optional context about what type of ID is being generated and from which Mastra primitive. This allows generating IDs that can be shared with external databases.

  ```typescript
  const mastra = new Mastra({
    idGenerator: context => {
      // context.idType: 'thread' | 'message' | 'run' | 'step' | 'generic'
      // context.source: 'agent' | 'workflow' | 'memory'
      // context.entityId: the agent/workflow id
      // context.threadId, context.resourceId, context.role, context.stepType

      if (context?.idType === 'message' && context?.threadId) {
        return `msg-${context.threadId}-${Date.now()}`;
      }
      if (context?.idType === 'run' && context?.source === 'agent') {
        return `run-${context.entityId}-${Date.now()}`;
      }
      return crypto.randomUUID();
    },
  });
  ```

  Existing `idGenerator` functions without parameters continue to work since the context is optional.

  Fixes #8131

- Added `flush()` method to `ObservabilityExporter`, `ObservabilityBridge`, and `ObservabilityInstance` interfaces ([#12003](https://github.com/mastra-ai/mastra/pull/12003))

- Add `hideInput` and `hideOutput` options to `TracingOptions` for protecting sensitive data in traces. ([#11969](https://github.com/mastra-ai/mastra/pull/11969))

  When set to `true`, these options hide input/output data from all spans in a trace, including child spans. This is useful for protecting sensitive information from being logged to observability platforms.

  ```typescript
  const agent = mastra.getAgent('myAgent');
  await agent.generate('Process this sensitive data', {
    tracingOptions: {
      hideInput: true, // Input will be hidden from all spans
      hideOutput: true, // Output will be hidden from all spans
    },
  });
  ```

  The options can be used independently (hide only input or only output) or together. The settings are propagated to all child spans via `TraceState`, ensuring consistent behavior across the entire trace.

  Fixes #10888

- Add `onError` hook to server configuration for custom error handling. ([#11403](https://github.com/mastra-ai/mastra/pull/11403))

  You can now provide a custom error handler through the Mastra server config to catch errors, format responses, or send them to external services like Sentry:

  ```typescript
  import { Mastra } from '@mastra/core/mastra';

  const mastra = new Mastra({
    server: {
      onError: (err, c) => {
        // Send to Sentry
        Sentry.captureException(err);

        // Return custom formatted response
        return c.json(
          {
            error: err.message,
            timestamp: new Date().toISOString(),
          },
          500,
        );
      },
    },
  });
  ```

  If no `onError` is provided, the default error handler is used.

  Fixes #9610

- Add stored agents support ([#10953](https://github.com/mastra-ai/mastra/pull/10953))

  Agents can now be stored in the database and loaded at runtime. This lets you persist agent configurations and dynamically create executable Agent instances from storage.

  ```typescript
  import { Mastra } from '@mastra/core';
  import { LibSQLStore } from '@mastra/libsql';

  const mastra = new Mastra({
    storage: new LibSQLStore({ url: ':memory:' }),
    tools: { myTool },
    scorers: { myScorer },
  });

  // Create agent in storage via API or directly
  await mastra.getStorage().createAgent({
    agent: {
      id: 'my-agent',
      name: 'My Agent',
      instructions: 'You are helpful',
      model: { provider: 'openai', name: 'gpt-4' },
      tools: { myTool: {} },
      scorers: { myScorer: { sampling: { type: 'ratio', rate: 0.5 } } },
    },
  });

  // Load and use the agent
  const agent = await mastra.getStoredAgentById('my-agent');
  const response = await agent.generate('Hello!');

  // List all stored agents with pagination
  const { agents, total, hasMore } = await mastra.listStoredAgents({
    page: 0,
    perPage: 10,
  });
  ```

  Also adds a memory registry to Mastra so stored agents can reference memory instances by key.

- Added human-in-the-loop (HITL) tool approval support for `generate()` method. ([#12056](https://github.com/mastra-ai/mastra/pull/12056))

  **Why:** This provides parity between `stream()` and `generate()` for tool approval flows, allowing non-streaming use cases to leverage `requireToolApproval` without needing to switch to streaming.

  Previously, tool approval with `requireToolApproval` only worked with `stream()`. Now you can use the same approval flow with `generate()` for non-streaming use cases.

  **Using tool approval with generate()**

  ```typescript
  const output = await agent.generate('Find user John', {
    requireToolApproval: true,
  });

  // Check if a tool is waiting for approval
  if (output.finishReason === 'suspended') {
    console.log('Tool requires approval:', output.suspendPayload.toolName);

    // Approve the tool call
    const result = await agent.approveToolCallGenerate({
      runId: output.runId,
      toolCallId: output.suspendPayload.toolCallId,
    });

    console.log(result.text);
  }
  ```

  **Declining a tool call**

  ```typescript
  if (output.finishReason === 'suspended') {
    const result = await agent.declineToolCallGenerate({
      runId: output.runId,
      toolCallId: output.suspendPayload.toolCallId,
    });
  }
  ```

  **New methods added:**
  - `agent.approveToolCallGenerate({ runId, toolCallId })` - Approves a pending tool call and returns the complete result
  - `agent.declineToolCallGenerate({ runId, toolCallId })` - Declines a pending tool call and returns the complete result

  **Server routes added:**
  - `POST /api/agents/:agentId/approve-tool-call-generate`
  - `POST /api/agents/:agentId/decline-tool-call-generate`

  The playground UI now also supports tool approval when using generate mode.

- Memory system now uses processors. Memory processors (`MessageHistory`, `SemanticRecall`, `WorkingMemory`) are now exported from `@mastra/memory/processors` and automatically added to the agent pipeline based on your memory config. Core processors (`ToolCallFilter`, `TokenLimiter`) remain in `@mastra/core/processors`. ([#9254](https://github.com/mastra-ai/mastra/pull/9254))

- Add reserved keys in RequestContext for secure resourceId/threadId setting from middleware ([#10657](https://github.com/mastra-ai/mastra/pull/10657))

  This allows middleware to securely set `resourceId` and `threadId` via reserved keys in RequestContext (`MASTRA_RESOURCE_ID_KEY` and `MASTRA_THREAD_ID_KEY`), which take precedence over client-provided values for security.

- Removed the deprecated `AISDKV5OutputStream` class from the public API. ([#11845](https://github.com/mastra-ai/mastra/pull/11845))

  **What changed:** The `AISDKV5OutputStream` class is no longer exported from `@mastra/core`. This class was previously used with the `format: 'aisdk'` option, which has already been removed from `.stream()` and `.generate()` methods.

  **Who is affected:** Only users who were directly importing `AISDKV5OutputStream` from `@mastra/core`. If you were using the standard `.stream()` or `.generate()` methods without the `format` option, no changes are needed.

  **Migration:** If you were importing this class directly, switch to using `MastraModelOutput` which provides the same streaming functionality:

  ```typescript
  // Before
  import { AISDKV5OutputStream } from '@mastra/core';

  // After
  import { MastraModelOutput } from '@mastra/core';
  ```

- Changed JSON columns from TEXT to JSONB in `mastra_threads` and `mastra_workflow_snapshot` tables. ([#11853](https://github.com/mastra-ai/mastra/pull/11853))

  **Why this change?**

  These were the last remaining columns storing JSON as TEXT. This change aligns them with other tables that already use JSONB, enabling native JSON operators and improved performance. See [#8978](https://github.com/mastra-ai/mastra/issues/8978) for details.

  **Columns Changed:**
  - `mastra_threads.metadata` - Thread metadata
  - `mastra_workflow_snapshot.snapshot` - Workflow run state

  **PostgreSQL**

  Migration Required - PostgreSQL enforces column types, so existing tables must be migrated. Note: Migration will fail if existing column values contain invalid JSON.

  ```sql
  ALTER TABLE mastra_threads
  ALTER COLUMN metadata TYPE jsonb
  USING metadata::jsonb;

  ALTER TABLE mastra_workflow_snapshot
  ALTER COLUMN snapshot TYPE jsonb
  USING snapshot::jsonb;
  ```

  **LibSQL**

  No Migration Required - LibSQL now uses native SQLite JSONB format (added in SQLite 3.45) for ~3x performance improvement on JSON operations. The changes are fully backwards compatible:
  - Existing TEXT JSON data continues to work
  - New data is stored in binary JSONB format
  - Both formats can coexist in the same table
  - All JSON functions (`json_extract`, etc.) work on both formats

  New installations automatically use JSONB. Existing applications continue to work without any changes.

- Memory scope defaults changed from 'thread' to 'resource' ([#8983](https://github.com/mastra-ai/mastra/pull/8983))

  Both `workingMemory.scope` and `semanticRecall.scope` now default to `'resource'` instead of `'thread'`. This means:
  - Working memory persists across all conversations for the same user/resource
  - Semantic recall searches across all threads for the same user/resource

  **Migration**: To maintain the previous thread-scoped behavior, explicitly set `scope: 'thread'`:

  ```typescript
  memory: new Memory({
    storage,
    workingMemory: {
      enabled: true,
      scope: 'thread', // Explicitly set for thread-scoped behavior
    },
    semanticRecall: {
      scope: 'thread', // Explicitly set for thread-scoped behavior
    },
  }),
  ```

  Also fixed issues where playground semantic recall search could show missing or incorrect results in certain cases.

- Add support for AI SDK v6 (LanguageModelV3) ([#11191](https://github.com/mastra-ai/mastra/pull/11191))

  Agents can now use `LanguageModelV3` models from AI SDK v6 beta providers like `@ai-sdk/openai@^3.0.0-beta`.

  **New features:**
  - Usage normalization: V3's nested usage format is normalized to Mastra's flat format with `reasoningTokens`, `cachedInputTokens`, and raw data preserved in a `raw` field

  **Backward compatible:** All existing V1 and V2 models continue to work unchanged.

- Respect structured outputs for v2 models so tool schemas aren’t stripped ([#11038](https://github.com/mastra-ai/mastra/pull/11038))

- Deprecate `default: { enabled: true }` observability configuration ([#11674](https://github.com/mastra-ai/mastra/pull/11674))

  The shorthand `default: { enabled: true }` configuration is now deprecated and will be removed in a future version. Users should migrate to explicit configuration with `DefaultExporter`, `CloudExporter`, and `SensitiveDataFilter`.

  **Before (deprecated):**

  ```typescript
  import { Observability } from '@mastra/observability';

  const mastra = new Mastra({
    observability: new Observability({
      default: { enabled: true },
    }),
  });
  ```

  **After (recommended):**

  ```typescript
  import { Observability, DefaultExporter, CloudExporter, SensitiveDataFilter } from '@mastra/observability';

  const mastra = new Mastra({
    observability: new Observability({
      configs: {
        default: {
          serviceName: 'mastra',
          exporters: [new DefaultExporter(), new CloudExporter()],
          spanOutputProcessors: [new SensitiveDataFilter()],
        },
      },
    }),
  });
  ```

  The explicit configuration makes it clear exactly what exporters and processors are being used, improving code readability and maintainability.

  A deprecation warning will be logged when using the old configuration pattern.

- Exported `isProcessorWorkflow` function from @mastra/core/processors. Added `getConfiguredProcessorWorkflows()` method to agents and `listProcessors()` method to the Mastra class for programmatic access to processor information. ([#12059](https://github.com/mastra-ai/mastra/pull/12059))

- Adds a new `suspendData` parameter to workflow step execute functions that provides access to the data originally passed to `suspend()` when the step was suspended. This enables steps to access context about why they were suspended when they are later resumed. ([#10734](https://github.com/mastra-ai/mastra/pull/10734))

  **New Features:**
  - `suspendData` parameter automatically populated in step execute function when resuming
  - Type-safe access to suspend data matching the step's `suspendSchema`
  - Backward compatible - existing workflows continue to work unchanged

  **Example:**

  ```typescript
  const step = createStep({
    suspendSchema: z.object({ reason: z.string() }),
    resumeSchema: z.object({ approved: z.boolean() }),
    execute: async ({ suspend, suspendData, resumeData }) => {
      if (!resumeData?.approved) {
        return await suspend({ reason: 'Approval required' });
      }

      // Access original suspend data when resuming
      console.log(`Resuming after: ${suspendData?.reason}`);
      return { result: 'Approved' };
    },
  });
  ```

- - Fixed TypeScript errors where `threadId: string | string[]` was being passed to places expecting `Scalar` type ([#10663](https://github.com/mastra-ai/mastra/pull/10663))
  - Added proper multi-thread support for `listMessages` across all adapters when `threadId` is an array
  - Updated `_getIncludedMessages` to look up message threadId by ID (since message IDs are globally unique)
  - **upstash**: Added `msg-idx:{messageId}` index for O(1) message lookups (backwards compatible with fallback to scan for old messages, with automatic backfill)

- Added `TrackingExporter` base class with improved handling for: ([#11870](https://github.com/mastra-ai/mastra/pull/11870))
  - **Out-of-order span processing**: Spans that arrive before their parents are now queued and processed once dependencies are available
  - **Delayed cleanup**: Trace data is retained briefly after spans end to handle late-arriving updates
  - **Memory management**: Configurable limits on pending and total traces to prevent memory leaks

  New configuration options on `TrackingExporterConfig`:
  - `earlyQueueMaxAttempts` - Max retry attempts for queued events (default: 5)
  - `earlyQueueTTLMs` - TTL for queued events in ms (default: 30000)
  - `traceCleanupDelayMs` - Delay before cleaning up completed traces (default: 30000)
  - `maxPendingCleanupTraces` - Soft cap on traces awaiting cleanup (default: 100)
  - `maxTotalTraces` - Hard cap on total traces (default: 500)

  Updated @mastra/braintrust, @mastra/langfuse, @mastra/langsmith, @mastra/posthog to use the new TrackingExporter

- Introduce StorageDomain base class for composite storage support ([#11249](https://github.com/mastra-ai/mastra/pull/11249))

  Storage adapters now use a domain-based architecture where each domain (memory, workflows, scores, observability, agents) extends a `StorageDomain` base class with `init()` and `dangerouslyClearAll()` methods.

  **Key changes:**
  - Add `StorageDomain` abstract base class that all domain storage classes extend
  - Add `InMemoryDB` class for shared state across in-memory domain implementations
  - All storage domains now implement `dangerouslyClearAll()` for test cleanup
  - Remove `operations` from public `StorageDomains` type (now internal to each adapter)
  - Add flexible client/config patterns - domains accept either an existing database client or config to create one internally

  **Why this matters:**

  This enables composite storage where you can use different database adapters per domain:

  ```typescript
  import { Mastra } from '@mastra/core';
  import { PostgresStore } from '@mastra/pg';
  import { ClickhouseStore } from '@mastra/clickhouse';

  // Use Postgres for most domains but Clickhouse for observability
  const mastra = new Mastra({
    storage: new PostgresStore({
      connectionString: 'postgres://...',
    }),
    // Future: override specific domains
    // observability: new ClickhouseStore({ ... }).getStore('observability'),
  });
  ```

  **Standalone domain usage:**

  Domains can now be used independently with flexible configuration:

  ```typescript
  import { MemoryLibSQL } from '@mastra/libsql/memory';

  // Option 1: Pass config to create client internally
  const memory = new MemoryLibSQL({
    url: 'file:./local.db',
  });

  // Option 2: Pass existing client for shared connections
  import { createClient } from '@libsql/client';
  const client = createClient({ url: 'file:./local.db' });
  const memory = new MemoryLibSQL({ client });
  ```

  **Breaking changes:**
  - `StorageDomains` type no longer includes `operations` - access via `getStore()` instead
  - Domain base classes now require implementing `dangerouslyClearAll()` method

- Refactor storage architecture to use domain-specific stores via `getStore()` pattern ([#11361](https://github.com/mastra-ai/mastra/pull/11361))

  ### Summary

  This release introduces a new storage architecture that replaces passthrough methods on `MastraStorage` with domain-specific storage interfaces accessed via `getStore()`. This change reduces code duplication across storage adapters and provides a cleaner, more modular API.

  ### Migration Guide

  All direct method calls on storage instances should be updated to use `getStore()`:

  ```typescript
  // Before
  const thread = await storage.getThreadById({ threadId });
  await storage.persistWorkflowSnapshot({ workflowName, runId, snapshot });
  await storage.createSpan(span);

  // After
  const memory = await storage.getStore('memory');
  const thread = await memory?.getThreadById({ threadId });

  const workflows = await storage.getStore('workflows');
  await workflows?.persistWorkflowSnapshot({ workflowName, runId, snapshot });

  const observability = await storage.getStore('observability');
  await observability?.createSpan(span);
  ```

  ### Available Domains
  - **`memory`**: Thread and message operations (`getThreadById`, `saveThread`, `saveMessages`, etc.)
  - **`workflows`**: Workflow state persistence (`persistWorkflowSnapshot`, `loadWorkflowSnapshot`, `getWorkflowRunById`, etc.)
  - **`scores`**: Evaluation scores (`saveScore`, `listScoresByScorerId`, etc.)
  - **`observability`**: Tracing and spans (`createSpan`, `updateSpan`, `getTrace`, etc.)
  - **`agents`**: Stored agent configurations (`createAgent`, `getAgentById`, `listAgents`, etc.)

  ### Breaking Changes
  - Passthrough methods have been removed from `MastraStorage` base class
  - All storage adapters now require accessing domains via `getStore()`
  - The `stores` property on storage instances is now the canonical way to access domain storage

  ### Internal Changes
  - Each storage adapter now initializes domain-specific stores in its constructor
  - Domain stores share database connections and handle their own table initialization

- Adds trace tagging support to the BrainTrust and Langfuse tracing exporters. ([#10765](https://github.com/mastra-ai/mastra/pull/10765))

- Add support for AI SDK v6 ToolLoopAgent in Mastra ([#11254](https://github.com/mastra-ai/mastra/pull/11254))

  You can now pass an AI SDK v6 `ToolLoopAgent` directly to Mastra's agents configuration. The agent will be automatically converted to a Mastra Agent while preserving all ToolLoopAgent lifecycle hooks:
  - `prepareCall` - Called once at the start of generate/stream
  - `prepareStep` - Called before each step in the agentic loop
  - `stopWhen` - Custom stop conditions for the loop

  Example:

  ```typescript
  import { ToolLoopAgent } from 'ai';
  import { Mastra } from '@mastra/core/mastra';

  const toolLoopAgent = new ToolLoopAgent({
    model: openai('gpt-4o'),
    instructions: 'You are a helpful assistant.',
    tools: { weather: weatherTool },
    prepareStep: async ({ stepNumber }) => {
      if (stepNumber === 0) {
        return { toolChoice: 'required' };
      }
    },
  });

  const mastra = new Mastra({
    agents: { toolLoopAgent },
  });

  // Use like any other Mastra agent
  const agent = mastra.getAgent('toolLoopAgent');
  const result = await agent.generate('What is the weather?');
  ```

- Unified observability schema with entity-based span identification ([#11132](https://github.com/mastra-ai/mastra/pull/11132))

  ## What changed

  Spans now use a unified identification model with `entityId`, `entityType`, and `entityName` instead of separate `agentId`, `toolId`, `workflowId` fields.

  **Before:**

  ```typescript
  // Old span structure
  span.agentId; // 'my-agent'
  span.toolId; // undefined
  span.workflowId; // undefined
  ```

  **After:**

  ```typescript
  // New span structure
  span.entityType; // EntityType.AGENT
  span.entityId; // 'my-agent'
  span.entityName; // 'My Agent'
  ```

  ## New `listTraces()` API

  Query traces with filtering, pagination, and sorting:

  ```typescript
  const { spans, pagination } = await storage.listTraces({
    filters: {
      entityType: EntityType.AGENT,
      entityId: 'my-agent',
      userId: 'user-123',
      environment: 'production',
      status: TraceStatus.SUCCESS,
      startedAt: { start: new Date('2024-01-01'), end: new Date('2024-01-31') },
    },
    pagination: { page: 0, perPage: 50 },
    orderBy: { field: 'startedAt', direction: 'DESC' },
  });
  ```

  **Available filters:** date ranges (`startedAt`, `endedAt`), entity (`entityType`, `entityId`, `entityName`), identity (`userId`, `organizationId`), correlation IDs (`runId`, `sessionId`, `threadId`), deployment (`environment`, `source`, `serviceName`), `tags`, `metadata`, and `status`.

  ## New retrieval methods
  - `getSpan({ traceId, spanId })` - Get a single span
  - `getRootSpan({ traceId })` - Get the root span of a trace
  - `getTrace({ traceId })` - Get all spans for a trace

  ## Backward compatibility

  The legacy `getTraces()` method continues to work. When you pass `name: "agent run: my-agent"`, it automatically transforms to `entityId: "my-agent", entityType: AGENT`.

  ## Migration

  **Automatic:** SQL-based stores (PostgreSQL, LibSQL, MSSQL) automatically add new columns to existing `spans` tables on initialization. Existing data is preserved with new columns set to `NULL`.

  **No action required:** Your existing code continues to work. Adopt the new fields and `listTraces()` API at your convenience.

- Add embedderOptions support to Memory for AI SDK 5+ provider-specific embedding options ([#11462](https://github.com/mastra-ai/mastra/pull/11462))

  With AI SDK 5+, embedding models no longer accept options in their constructor. Options like `outputDimensionality` for Google embedding models must now be passed when calling `embed()` or `embedMany()`. This change adds `embedderOptions` to Memory configuration to enable passing these provider-specific options.

  You can now configure embedder options when creating Memory:

  ```typescript
  import { Memory } from '@mastra/core';
  import { google } from '@ai-sdk/google';

  // Before: No way to specify providerOptions
  const memory = new Memory({
    embedder: google.textEmbeddingModel('text-embedding-004'),
  });

  // After: Pass embedderOptions with providerOptions
  const memory = new Memory({
    embedder: google.textEmbeddingModel('text-embedding-004'),
    embedderOptions: {
      providerOptions: {
        google: {
          outputDimensionality: 768,
          taskType: 'RETRIEVAL_DOCUMENT',
        },
      },
    },
  });
  ```

  This is especially important for:
  - Google `text-embedding-004`: Control output dimensions (default 768)
  - Google `gemini-embedding-001`: Reduce from default 3072 dimensions to avoid pgvector's 2000 dimension limit for HNSW indexes

  Fixes #8248

- Add `messageList` parameter to `processOutputStream` for accessing remembered messages during streaming ([#10608](https://github.com/mastra-ai/mastra/pull/10608))

- Fix processor tracing to create individual spans per processor ([#11683](https://github.com/mastra-ai/mastra/pull/11683))
  - Processor spans now correctly show processor IDs (e.g., `input processor: validator`) instead of combined workflow IDs
  - Each processor in a chain gets its own trace span, improving observability into processor execution
  - Spans are only created for phases a processor actually implements, eliminating empty spans
  - Internal agent calls within processors now properly nest under their processor span
  - Added `INPUT_STEP_PROCESSOR` and `OUTPUT_STEP_PROCESSOR` entity types for finer-grained tracing
  - Changed `processorType` span attribute to `processorExecutor` with values `'workflow'` or `'legacy'`

- Added a unified `transformScoreRow` function in `@mastra/core/storage` that provides schema-driven row transformation for score data. This eliminates code duplication across 10 storage adapters while maintaining store-specific behavior through configurable options: ([#10648](https://github.com/mastra-ai/mastra/pull/10648))
  - `preferredTimestampFields`: Preferred source fields for timestamps (PostgreSQL, Cloudflare D1)
  - `convertTimestamps`: Convert timestamp strings to Date objects (MSSQL, MongoDB, ClickHouse)
  - `nullValuePattern`: Skip values matching pattern (ClickHouse's `'_null_'`)
  - `fieldMappings`: Map source column names to schema fields (LibSQL's `additionalLLMContext`)

  Each store adapter now uses the unified function with appropriate options, reducing ~200 lines of duplicate transformation logic while ensuring consistent behavior across all storage backends.

- Added new `listThreads` method for flexible thread filtering across all storage adapters. ([#11832](https://github.com/mastra-ai/mastra/pull/11832))

  **New Features**
  - Filter threads by `resourceId`, `metadata`, or both (with AND logic for metadata key-value pairs)
  - All filter parameters are optional, allowing you to list all threads or filter as needed
  - Full pagination and sorting support

  **Example Usage**

  ```typescript
  // List all threads
  const allThreads = await memory.listThreads({});

  // Filter by resourceId only
  const userThreads = await memory.listThreads({
    filter: { resourceId: 'user-123' },
  });

  // Filter by metadata only
  const supportThreads = await memory.listThreads({
    filter: { metadata: { category: 'support' } },
  });

  // Filter by both with pagination
  const filteredThreads = await memory.listThreads({
    filter: {
      resourceId: 'user-123',
      metadata: { priority: 'high', status: 'open' },
    },
    orderBy: { field: 'updatedAt', direction: 'DESC' },
    page: 0,
    perPage: 20,
  });
  ```

  **Security Improvements**
  - Added validation to prevent SQL injection via malicious metadata keys
  - Added pagination parameter validation to prevent integer overflow attacks

- Add completion validation to agent networks using custom scorers ([#11562](https://github.com/mastra-ai/mastra/pull/11562))

  You can now validate whether an agent network has completed its task by passing MastraScorers to `agent.network()`. When validation fails, the network automatically retries with feedback injected into the conversation.

  **Example: Creating a scorer to verify test coverage**

  ```ts
  import { createScorer } from '@mastra/core/evals';
  import { z } from 'zod';

  // Create a scorer that checks if tests were written
  const testsScorer = createScorer({
    id: 'tests-written',
    description: 'Validates that unit tests were included in the response',
    type: 'agent',
  }).generateScore({
    description: 'Return 1 if tests are present, 0 if missing',
    outputSchema: z.number(),
    createPrompt: ({ run }) => `
      Does this response include unit tests?
      Response: ${run.output}
      Return 1 if tests are present, 0 if not.
    `,
  });

  // Use the scorer with agent.network()
  const stream = await agent.network('Implement a fibonacci function with tests', {
    completion: {
      scorers: [testsScorer],
      strategy: 'all', // all scorers must pass (score >= 0.5)
    },
    maxSteps: 3,
  });
  ```

  **What this enables:**
  - **Programmatic completion checks**: Define objective criteria for task completion instead of relying on the default LLM-based check
  - **Automatic retry with feedback**: When a scorer returns `score: 0`, its reason is injected into the conversation so the network can address the gap on the next iteration
  - **Composable validation**: Combine multiple scorers with `strategy: 'all'` (all must pass) or `strategy: 'any'` (at least one must pass)

  This replaces guesswork with reliable, repeatable validation that ensures agent networks produce outputs meeting your specific requirements.

- Add MCP tool annotations and metadata support to `ToolAction` and `Tool` ([#11841](https://github.com/mastra-ai/mastra/pull/11841))

  Tools can now surface UI hints like `title`, `readOnlyHint`, `destructiveHint`, `idempotentHint`, and `openWorldHint` via the `mcp.annotations` field, and pass arbitrary metadata to MCP clients via `mcp._meta`. These MCP-specific properties are grouped under the `mcp` property to clearly indicate they only apply when tools are exposed via MCP.

  ```typescript
  import { createTool } from '@mastra/core/tools';

  const myTool = createTool({
    id: 'weather',
    description: 'Get weather for a location',
    mcp: {
      annotations: {
        title: 'Weather Lookup',
        readOnlyHint: true,
        destructiveHint: false,
      },
      _meta: { version: '1.0.0' },
    },
    execute: async ({ location }) => fetchWeather(location),
  });
  ```

- Add `disableInit` option to all storage adapters ([#10851](https://github.com/mastra-ai/mastra/pull/10851))

  Adds a new `disableInit` config option to all storage providers that allows users to disable automatic table creation/migrations at runtime. This is useful for CI/CD pipelines where you want to run migrations during deployment with elevated credentials, then run the application with `disableInit: true` so it doesn't attempt schema changes at runtime.

  ```typescript
  // CI/CD script - run migrations
  const storage = new PostgresStore({
    connectionString: DATABASE_URL,
    id: 'pg-storage',
  });
  await storage.init();

  // Runtime - skip auto-init
  const storage = new PostgresStore({
    connectionString: DATABASE_URL,
    id: 'pg-storage',
    disableInit: true,
  });
  ```

- Add structured output support to agent.network() method. Users can now pass a `structuredOutput` option with a Zod schema to get typed results from network execution. ([#11701](https://github.com/mastra-ai/mastra/pull/11701))

  The stream exposes `.object` (Promise) and `.objectStream` (ReadableStream) getters, and emits `network-object` and `network-object-result` chunk types. The structured output is generated after task completion using the provided schema.

  ```typescript
  const stream = await agent.network('Research AI trends', {
    structuredOutput: {
      schema: z.object({
        summary: z.string(),
        recommendations: z.array(z.string()),
      }),
    },
  });

  const result = await stream.object;
  // result is typed: { summary: string; recommendations: string[] }
  ```

- Unified `getWorkflowRunById` and `getWorkflowRunExecutionResult` into a single API that returns `WorkflowState` with both metadata and execution state. ([#11429](https://github.com/mastra-ai/mastra/pull/11429))

  **What changed:**
  - `getWorkflowRunById` now returns a unified `WorkflowState` object containing metadata (runId, workflowName, resourceId, createdAt, updatedAt) along with processed execution state (status, result, error, payload, steps)
  - Added optional `fields` parameter to request only specific fields for better performance
  - Added optional `withNestedWorkflows` parameter to control nested workflow step inclusion
  - Removed `getWorkflowRunExecutionResult` - use `getWorkflowRunById` instead (breaking change)
  - Removed `/execution-result` API endpoints from server (breaking change)
  - Removed `runExecutionResult()` method from client SDK (breaking change)
  - Removed `GetWorkflowRunExecutionResultResponse` type from client SDK (breaking change)

  **Before:**

  ```typescript
  // Had to call two different methods for different data
  const run = await workflow.getWorkflowRunById(runId); // Returns raw WorkflowRun with snapshot
  const result = await workflow.getWorkflowRunExecutionResult(runId); // Returns processed execution state
  ```

  **After:**

  ```typescript
  // Single method returns everything
  const run = await workflow.getWorkflowRunById(runId);
  // Returns: { runId, workflowName, resourceId, createdAt, updatedAt, status, result, error, payload, steps }

  // Request only specific fields for better performance (avoids expensive step fetching)
  const status = await workflow.getWorkflowRunById(runId, { fields: ['status'] });

  // Skip nested workflow steps for faster response
  const run = await workflow.getWorkflowRunById(runId, { withNestedWorkflows: false });
  ```

  **Why:** The previous API required calling two separate methods to get complete workflow run information. This unification simplifies the API surface and gives users control over performance - fetching all steps (especially nested workflows) can be expensive, so the `fields` and `withNestedWorkflows` options let users request only what they need.

- Rename LLM span types and attributes to use Model prefix ([#9105](https://github.com/mastra-ai/mastra/pull/9105))

  BREAKING CHANGE: This release renames tracing span types and attribute interfaces to use the "Model" prefix instead of "LLM":
  - `AISpanType.LLM_GENERATION` → `AISpanType.MODEL_GENERATION`
  - `AISpanType.LLM_STEP` → `AISpanType.MODEL_STEP`
  - `AISpanType.LLM_CHUNK` → `AISpanType.MODEL_CHUNK`
  - `LLMGenerationAttributes` → `ModelGenerationAttributes`
  - `LLMStepAttributes` → `ModelStepAttributes`
  - `LLMChunkAttributes` → `ModelChunkAttributes`
  - `InternalSpans.LLM` → `InternalSpans.MODEL`

  This change better reflects that these span types apply to all AI models, not just Large Language Models.

  Migration guide:
  - Update all imports: `import { ModelGenerationAttributes } from '@mastra/core/ai-tracing'`
  - Update span type references: `AISpanType.MODEL_GENERATION`
  - Update InternalSpans usage: `InternalSpans.MODEL`

### Patch Changes

- dependencies updates: ([#10110](https://github.com/mastra-ai/mastra/pull/10110))
  - Updated dependency [`hono-openapi@^1.1.1` ↗︎](https://www.npmjs.com/package/hono-openapi/v/1.1.1) (from `^0.4.8`, in `dependencies`)

- dependencies updates: ([#10131](https://github.com/mastra-ai/mastra/pull/10131))
  - Updated dependency [`hono@^4.10.5` ↗︎](https://www.npmjs.com/package/hono/v/4.10.5) (from `^4.9.7`, in `dependencies`)

- dependencies updates: ([#10133](https://github.com/mastra-ai/mastra/pull/10133))
  - Updated dependency [`js-tiktoken@^1.0.21` ↗︎](https://www.npmjs.com/package/js-tiktoken/v/1.0.21) (from `^1.0.20`, in `dependencies`)

- dependencies updates: ([#10191](https://github.com/mastra-ai/mastra/pull/10191))
  - Updated dependency [`dotenv@^17.2.3` ↗︎](https://www.npmjs.com/package/dotenv/v/17.2.3) (from `^16.6.1`, in `dependencies`)

- Add agentId and agentName attributes to MODEL_GENERATION spans. This allows users to correlate gen_ai.usage metrics with specific agents when analyzing LLM operation spans. The attributes are exported as gen_ai.agent.id and gen_ai.agent.name in the OtelExporter. ([#10984](https://github.com/mastra-ai/mastra/pull/10984))

- Added `customSpanFormatter` option to exporters for per-exporter span transformation. This allows different formatting per exporter and supports both synchronous and asynchronous operations, including async data enrichment. ([#11985](https://github.com/mastra-ai/mastra/pull/11985))

  **Configuration example:**

  ```ts
  import { DefaultExporter } from '@mastra/observability';
  import { SpanType } from '@mastra/core/observability';
  import type { CustomSpanFormatter } from '@mastra/core/observability';

  // Sync formatter
  const plainTextFormatter: CustomSpanFormatter = span => {
    if (span.type === SpanType.AGENT_RUN && Array.isArray(span.input)) {
      const userMessage = span.input.find(m => m.role === 'user');
      return { ...span, input: userMessage?.content ?? span.input };
    }
    return span;
  };

  // Async formatter for data enrichment
  const enrichmentFormatter: CustomSpanFormatter = async span => {
    const userData = await fetchUserData(span.metadata?.userId);
    return { ...span, metadata: { ...span.metadata, userName: userData.name } };
  };

  const exporter = new DefaultExporter({
    customSpanFormatter: plainTextFormatter,
  });
  ```

  Also added `chainFormatters` utility to combine multiple formatters (supports mixed sync/async):

  ```ts
  import { chainFormatters } from '@mastra/observability';

  const exporter = new BraintrustExporter({
    customSpanFormatter: chainFormatters([syncFormatter, asyncFormatter]),
  });
  ```

- Add embedded documentation support for Mastra packages ([#11472](https://github.com/mastra-ai/mastra/pull/11472))

  Mastra packages now include embedded documentation in the published npm package under `dist/docs/`. This enables coding agents and AI assistants to understand and use the framework by reading documentation directly from `node_modules`.

  Each package includes:
  - **SKILL.md** - Entry point explaining the package's purpose and capabilities
  - **SOURCE_MAP.json** - Machine-readable index mapping exports to types and implementation files
  - **Topic folders** - Conceptual documentation organized by feature area

  Documentation is driven by the `packages` frontmatter field in MDX files, which maps docs to their corresponding packages. CI validation ensures all docs include this field.

- Add exponential backoff to model retry logic to prevent cascading failures ([#9798](https://github.com/mastra-ai/mastra/pull/9798))

  When AI model calls fail, the system now implements exponential backoff (1s, 2s, 4s, 8s, max 10s) before retrying instead of immediately hammering the API. This prevents:
  - Rate limit violations from getting worse
  - Cascading failures across all fallback models
  - Wasted API quota by burning through retries instantly
  - Production outages when all models fail due to rate limits

  The backoff gives APIs time to recover from transient failures and rate limiting.

- Add support for `retries` and `scorers` parameters across all `createStep` overloads.
  ([#11495](https://github.com/mastra-ai/mastra/pull/11495))

  The `createStep` function now includes support for the `retries` and `scorers` fields across all step creation patterns, enabling step-level retry configuration and AI evaluation support for regular steps, agent-based steps, and tool-based steps.

  ```typescript
  import { init } from '@mastra/inngest';
  import { z } from 'zod';

  const { createStep } = init(inngest);

  // 1. Regular step with retries
  const regularStep = createStep({
    id: 'api-call',
    inputSchema: z.object({ url: z.string() }),
    outputSchema: z.object({ data: z.any() }),
    retries: 3, // ← Will retry up to 3 times on failure
    execute: async ({ inputData }) => {
      const response = await fetch(inputData.url);
      return { data: await response.json() };
    },
  });

  // 2. Agent step with retries and scorers
  const agentStep = createStep(myAgent, {
    retries: 3,
    scorers: [{ id: 'accuracy-scorer', scorer: myAccuracyScorer }],
  });

  // 3. Tool step with retries and scorers
  const toolStep = createStep(myTool, {
    retries: 2,
    scorers: [{ id: 'quality-scorer', scorer: myQualityScorer }],
  });
  ```

  This change ensures API consistency across all `createStep` overloads. All step types now support retry and evaluation configurations.

  This is a non-breaking change - steps without these parameters continue to work exactly as before.

  Fixes #9351

- Add time-to-first-token (TTFT) support for Langfuse integration ([#10781](https://github.com/mastra-ai/mastra/pull/10781))

  Adds `completionStartTime` to model generation spans, which Langfuse uses to calculate TTFT metrics. The timestamp is automatically captured when the first content chunk arrives during streaming.

  ```typescript
  // completionStartTime is now automatically captured and sent to Langfuse
  // enabling TTFT metrics in your Langfuse dashboard
  const result = await agent.stream('Hello');
  ```

- When using agent networks, the routing agent could fail with a cryptic `TypeError: Cannot read properties of undefined` if the generation response was missing or malformed. This made it difficult to diagnose why routing failed. The release now throws a descriptive error with debugging details (response text, finish reason, usage) to help identify the root cause. ([#12028](https://github.com/mastra-ai/mastra/pull/12028))

  Fixes #11749

- Remove `streamVNext`, `resumeStreamVNext`, and `observeStreamVNext` methods, call `stream`, `resumeStream` and `observeStream` directly ([#11499](https://github.com/mastra-ai/mastra/pull/11499))

  ```diff
  + const run = await workflow.createRun({ runId: '123' });
  - const stream = await run.streamVNext({ inputData: { ... } });
  + const stream = await run.stream({ inputData: { ... } });
  ```

- Update provider registry and model documentation with latest models and providers ([`f743dbb`](https://github.com/mastra-ai/mastra/commit/f743dbb8b40d1627b5c10c0e6fc154f4ebb6e394))

- Add Azure OpenAI gateway ([#9990](https://github.com/mastra-ai/mastra/pull/9990))

  The Azure OpenAI gateway supports three configuration modes:
  1. **Static deployments**: Provide deployment names from Azure Portal
  2. **Dynamic discovery**: Query Azure Management API for available deployments
  3. **Manual**: Specify deployment names when creating agents

  **Usage**

  ```typescript
  import { Mastra } from '@mastra/core';
  import { AzureOpenAIGateway } from '@mastra/core/llm';

  // Static mode (recommended)
  export const mastra = new Mastra({
    gateways: [
      new AzureOpenAIGateway({
        resourceName: process.env.AZURE_RESOURCE_NAME!,
        apiKey: process.env.AZURE_API_KEY!,
        deployments: ['gpt-4-prod', 'gpt-35-turbo-dev'],
      }),
    ],
  });

  // Dynamic discovery mode
  export const mastra = new Mastra({
    gateways: [
      new AzureOpenAIGateway({
        resourceName: process.env.AZURE_RESOURCE_NAME!,
        apiKey: process.env.AZURE_API_KEY!,
        management: {
          tenantId: process.env.AZURE_TENANT_ID!,
          clientId: process.env.AZURE_CLIENT_ID!,
          clientSecret: process.env.AZURE_CLIENT_SECRET!,
          subscriptionId: process.env.AZURE_SUBSCRIPTION_ID!,
          resourceGroup: 'my-resource-group',
        },
      }),
    ],
  });

  // Use Azure OpenAI models
  const agent = new Agent({
    model: 'azure-openai/gpt-4-deployment',
    instructions: 'You are a helpful assistant',
  });
  ```

- Fix Anthropic API error when tool calls have empty input objects ([#11474](https://github.com/mastra-ai/mastra/pull/11474))

  Fixes issue #11376 where Anthropic models would fail with error "messages.17.content.2.tool_use.input: Field required" when a tool call in a previous step had an empty object `{}` as input.

  The fix adds proper reconstruction of tool call arguments when converting messages to AIV5 model format. Tool-result parts now correctly include the `input` field from the matching tool call, which is required by Anthropic's API validation.

  Changes:
  - Added `findToolCallArgs()` helper method to search through messages and retrieve original tool call arguments
  - Enhanced `aiV5UIMessagesToAIV5ModelMessages()` to populate the `input` field on tool-result parts
  - Added comprehensive test coverage for empty object inputs, parameterized inputs, and multi-turn conversations

- Add additional context to workflow `onFinish` and `onError` callbacks ([#11705](https://github.com/mastra-ai/mastra/pull/11705))

  The `onFinish` and `onError` lifecycle callbacks now receive additional properties:
  - `runId` - The unique identifier for the workflow run
  - `workflowId` - The workflow's identifier
  - `resourceId` - Optional resource identifier (if provided when creating the run)
  - `getInitData()` - Function that returns the initial input data passed to the workflow
  - `mastra` - The Mastra instance (if workflow is registered with Mastra)
  - `requestContext` - Request-scoped context data
  - `logger` - The workflow's logger instance
  - `state` - The workflow's current state object

  ```typescript
  const workflow = createWorkflow({
    id: 'order-processing',
    inputSchema: z.object({ orderId: z.string() }),
    outputSchema: z.object({ status: z.string() }),
    options: {
      onFinish: async ({ runId, workflowId, getInitData, logger, state, mastra }) => {
        const inputData = getInitData();
        logger.info(`Workflow ${workflowId} run ${runId} completed`, {
          orderId: inputData.orderId,
          finalState: state,
        });

        // Access other Mastra components if needed
        const agent = mastra?.getAgent('notification-agent');
      },
      onError: async ({ runId, workflowId, error, logger, requestContext }) => {
        logger.error(`Workflow ${workflowId} run ${runId} failed: ${error?.message}`);
        // Access request context for additional debugging
        const userId = requestContext.get('userId');
      },
    },
  });
  ```

- Fix workflow tool not executing when requireApproval is true and tool call is approved ([#11538](https://github.com/mastra-ai/mastra/pull/11538))

- unexpected json parse issue, log error but dont fail ([#10241](https://github.com/mastra-ai/mastra/pull/10241))

- Updated OtelExporters, Bridge, and Arize packages to better implement GenAI v1.38.0 Otel Semantic Conventions. See: ([#10591](https://github.com/mastra-ai/mastra/pull/10591))
  https://github.com/open-telemetry/semantic-conventions/blob/v1.38.0/docs/gen-ai/README.md

- Standardize error IDs across all storage and vector stores using centralized helper functions (`createStorageErrorId` and `createVectorErrorId`). This ensures consistent error ID patterns (`MASTRA_STORAGE_{STORE}_{OPERATION}_{STATUS}` and `MASTRA_VECTOR_{STORE}_{OPERATION}_{STATUS}`) across the codebase for better error tracking and debugging. ([#10913](https://github.com/mastra-ai/mastra/pull/10913))

- Remove redundant toolCalls from network agent finalResult ([#11189](https://github.com/mastra-ai/mastra/pull/11189))

  The network agent's `finalResult` was storing `toolCalls` separately even though all tool call information is already present in the `messages` array (as `tool-call` and `tool-result` type messages). This caused significant token waste since the routing agent reads this data from memory on every iteration.

  **Before:** `finalResult: { text, toolCalls, messages }`
  **After:** `finalResult: { text, messages }`

  +**Migration:** If you were accessing `finalResult.toolCalls`, retrieve tool calls from `finalResult.messages` by filtering for messages with `type: 'tool-call'`.

  Updated `@mastra/react` to extract tool calls directly from the `messages` array instead of the removed `toolCalls` field when resolving initial messages from memory.

  Fixes #11059

- Fixed a bug in agent networks where sometimes the task name was empty ([#10629](https://github.com/mastra-ai/mastra/pull/10629))

- Fix agent onChunk callback receiving wrapped chunk instead of direct chunk ([#9350](https://github.com/mastra-ai/mastra/pull/9350))

- When calling `abort()` inside a `processInputStep` processor, the TripWire was being caught by the model retry logic instead of emitting a tripwire chunk to the stream. ([#11343](https://github.com/mastra-ai/mastra/pull/11343))

  Before this fix, processors using `processInputStep` with abort would see errors like:

  ```
  Error executing model gpt-4o-mini, attempt 1==== TripWire [Error]: Potentially harmful content detected
  ```

  Now the TripWire is properly handled - it emits a tripwire chunk and signals the abort correctly,

- Embed AI types to fix peerdeps mismatches ([`9650cce`](https://github.com/mastra-ai/mastra/commit/9650cce52a1d917ff9114653398e2a0f5c3ba808))

- Deprecate `runCount` parameter in favor of `retryCount` for better naming clarity. The name `runCount` was misleading as it doesn't represent the total number of times a step has run, but rather the number of retry attempts made for a step. ([#9153](https://github.com/mastra-ai/mastra/pull/9153))

  `runCount` is available in `execute()` functions and methods that interact with the step execution. This also applies to condition functions and loop condition functions that use this parameter. If your code uses `runCount`, change the name to `retryCount`.

  Here's an example migration:

  ```diff
  const myStep = createStep({
    // Rest of step...
  -  execute: async ({ runCount, ...params }) => {
  +  execute: async ({ retryCount, ...params }) => {
      // ... rest of your logic
    }
  });
  ```

- Set correct peer dependency range for `@mastra/observability` ([#9908](https://github.com/mastra-ai/mastra/pull/9908))

- Add requestContext column if it does not exist ([#9786](https://github.com/mastra-ai/mastra/pull/9786))

- Only handle download image asset transformation if needed ([#10122](https://github.com/mastra-ai/mastra/pull/10122))

- Fix model-level and runtime header support for LLM calls ([#11275](https://github.com/mastra-ai/mastra/pull/11275))

  This fixes a bug where custom headers configured on models (like `anthropic-beta`) were not being passed through to the underlying AI SDK calls. The fix properly handles headers from multiple sources with correct priority:

  **Header Priority (low to high):**
  1. Model config headers - Headers set in model configuration
  2. ModelSettings headers - Runtime headers that override model config
  3. Provider-level headers - Headers baked into AI SDK providers (not overridden)

  **Examples that now work:**

  ```typescript
  // Model config headers
  new Agent({
    model: {
      id: 'anthropic/claude-4-5-sonnet',
      headers: { 'anthropic-beta': 'context-1m-2025-08-07' },
    },
  });

  // Runtime headers override config
  agent.generate('...', {
    modelSettings: { headers: { 'x-custom': 'runtime-value' } },
  });

  // Provider-level headers preserved
  const openai = createOpenAI({ headers: { 'openai-organization': 'org-123' } });
  new Agent({ model: openai('gpt-4o-mini') });
  ```

- - Fix tool suspension throwing error when `outputSchema` is passed to tool during creation ([#10444](https://github.com/mastra-ai/mastra/pull/10444))
  - Pass `suspendSchema` and `resumeSchema` from tool into step created when creating step from tool

- Consolidate memory integration tests and fix working memory filtering in MessageHistory processor ([#11367](https://github.com/mastra-ai/mastra/pull/11367))

  Moved `extractWorkingMemoryTags`, `removeWorkingMemoryTags`, and `extractWorkingMemoryContent` utilities from `@mastra/memory` to `@mastra/core/memory` so they can be used by the `MessageHistory` processor.

  Updated `MessageHistory.filterMessagesForPersistence()` to properly filter out `updateWorkingMemory` tool invocations and strip working memory tags from text content, fixing an issue where working memory tool call arguments were polluting saved message history for v5+ models.

  Also consolidated integration tests for agent-memory, working-memory, and pg-storage into shared test functions that can run against multiple model versions (v4, v5, v6).

- Fix type safety for message ordering - restrict `orderBy` to only accept `'createdAt'` field ([#11069](https://github.com/mastra-ai/mastra/pull/11069))

  Messages don't have an `updatedAt` field, but the previous type allowed ordering by it, which would return empty results. This change adds compile-time type safety by making `StorageOrderBy` generic and restricting `StorageListMessagesInput.orderBy` to only accept `'createdAt'`. The API validation schemas have also been updated to reject invalid orderBy values at runtime.

- Fixed agent network mode failing with "Cannot read properties of undefined" error when tools or workflows don't have an `inputSchema` defined. ([#12063](https://github.com/mastra-ai/mastra/pull/12063))
  - **@mastra/core:** Fixed `getRoutingAgent()` to handle tools and workflows without `inputSchema` by providing a default empty schema fallback.
  - **@mastra/schema-compat:** Fixed Zod v4 optional/nullable fields producing invalid JSON schema for OpenAI structured outputs. OpenAI now correctly receives `type: ["string", "null"]` instead of `anyOf` patterns that were rejected with "must have a 'type' key" error.

- Fix invalid state: Controller is already closed ([`932d63d`](https://github.com/mastra-ai/mastra/commit/932d63dd51be9c8bf1e00e3671fe65606c6fb9cd))

  Fixes #11005

- Add support for AI SDK's `needsApproval` in tools. ([#11388](https://github.com/mastra-ai/mastra/pull/11388))

  **AI SDK tools with static approval:**

  ```typescript
  import { tool } from 'ai';
  import { z } from 'zod';

  const weatherTool = tool({
    description: 'Get weather information',
    inputSchema: z.object({ city: z.string() }),
    needsApproval: true,
    execute: async ({ city }) => {
      return { weather: 'sunny', temp: 72 };
    },
  });
  ```

  **AI SDK tools with dynamic approval:**

  ```typescript
  const paymentTool = tool({
    description: 'Process payment',
    inputSchema: z.object({ amount: z.number() }),
    needsApproval: async ({ amount }) => amount > 1000,
    execute: async ({ amount }) => {
      return { success: true, amount };
    },
  });
  ```

  **Mastra tools continue to work with `requireApproval`:**

  ```typescript
  import { createTool } from '@mastra/core';

  const deleteTool = createTool({
    id: 'delete-file',
    description: 'Delete a file',
    requireApproval: true,
    inputSchema: z.object({ path: z.string() }),
    execute: async ({ path }) => {
      return { deleted: true };
    },
  });
  ```

- Add serializedStepGraph to runExecutionResult response ([#10004](https://github.com/mastra-ai/mastra/pull/10004))

- Add `onFinish` and `onError` lifecycle callbacks to workflow options ([#11200](https://github.com/mastra-ai/mastra/pull/11200))

  Workflows now support lifecycle callbacks for server-side handling of workflow completion and errors:
  - `onFinish`: Called when workflow completes with any status (success, failed, suspended, tripwire)
  - `onError`: Called only when workflow fails (failed or tripwire status)

  ```typescript
  const workflow = createWorkflow({
    id: 'my-workflow',
    inputSchema: z.object({ ... }),
    outputSchema: z.object({ ... }),
    options: {
      onFinish: async (result) => {
        // Handle any workflow completion
        await updateJobStatus(result.status);
      },
      onError: async (errorInfo) => {
        // Handle workflow failures
        await logError(errorInfo.error);
      },
    },
  });
  ```

  Both callbacks support sync and async functions. Callback errors are caught and logged, not propagated to the workflow result.

- Adds `tool-result` and `tool-error` chunks to the processor.processOutputStream path. Processors now have access to these two chunks. ([#10645](https://github.com/mastra-ai/mastra/pull/10645))

- Add `onOutput` hook for tools ([#10466](https://github.com/mastra-ai/mastra/pull/10466))

  Tools now support an `onOutput` lifecycle hook that is invoked after successful tool execution. This complements the existing `onInputStart`, `onInputDelta`, and `onInputAvailable` hooks to provide complete visibility into the tool execution lifecycle.

  The `onOutput` hook receives:
  - `output`: The tool's return value (typed according to `outputSchema`)
  - `toolCallId`: Unique identifier for the tool call
  - `toolName`: The name of the tool that was executed
  - `abortSignal`: Signal for detecting if the operation should be cancelled

  Example usage:

  ```typescript
  import { createTool } from '@mastra/core/tools';
  import { z } from 'zod';

  export const weatherTool = createTool({
    id: 'weather-tool',
    description: 'Get weather information',
    outputSchema: z.object({
      temperature: z.number(),
      conditions: z.string(),
    }),
    execute: async input => {
      return { temperature: 72, conditions: 'sunny' };
    },
    onOutput: ({ output, toolCallId, toolName }) => {
      console.log(`${toolName} completed:`, output);
      // output is fully typed based on outputSchema
    },
  });
  ```

  Hook execution order:
  1. `onInputStart` - Input streaming begins
  2. `onInputDelta` - Input chunks arrive (called multiple times)
  3. `onInputAvailable` - Complete input parsed and validated
  4. Tool's `execute` function runs
  5. `onOutput` - Tool completed successfully (NEW)

- Fix saveScore not persisting ID correctly, breaking getScoreById retrieval ([#10915](https://github.com/mastra-ai/mastra/pull/10915))

  **What Changed**
  - saveScore now correctly returns scores that can be retrieved with getScoreById
  - Validation errors now include contextual information (scorer, entity, trace details) for easier debugging

  **Impact**
  Previously, calling getScoreById after saveScore would return null because the generated ID wasn't persisted to the database. This is now fixed across all store implementations, ensuring consistent behavior and data integrity.

- Fix HITL (Human-In-The-Loop) tool execution bug when mixing tools with and without execute functions. ([#11178](https://github.com/mastra-ai/mastra/pull/11178))

  When an agent called multiple tools simultaneously where some had `execute` functions and others didn't (HITL tools expecting `addToolResult` from the frontend), the HITL tools would incorrectly receive `result: undefined` and be marked as "output-available" instead of "input-available". This caused the agent to continue instead of pausing for user input.

- Track usage in workflow and agent network ([#9649](https://github.com/mastra-ai/mastra/pull/9649))

- Add resourceId to workflow routes ([#11166](https://github.com/mastra-ai/mastra/pull/11166))

- Fixed AbortSignal not propagating from parent workflows to nested sub-workflows in the evented workflow engine. ([#11142](https://github.com/mastra-ai/mastra/pull/11142))

  Previously, canceling a parent workflow did not stop nested sub-workflows, causing them to continue running and consuming resources after the parent was canceled.

  Now, when you cancel a parent workflow, all nested sub-workflows are automatically canceled as well, ensuring clean termination of the entire workflow tree.

  **Example:**

  ```typescript
  const parentWorkflow = createWorkflow({ id: 'parent-workflow' }).then(someStep).then(nestedChildWorkflow).commit();

  const run = await parentWorkflow.createRun();
  const resultPromise = run.start({ inputData: { value: 5 } });

  // Cancel the parent workflow - nested workflows will also be canceled
  await run.cancel();
  // or use: run.abortController.abort();

  const result = await resultPromise;
  // result.status === 'canceled'
  // All nested child workflows are also canceled
  ```

  Related to #11063

- Add new deleteVectors, updateVector by filter ([#10408](https://github.com/mastra-ai/mastra/pull/10408))

- Include `.input` in workflow results for both engines and remove the option to omit them from Inngest workflows. ([#10688](https://github.com/mastra-ai/mastra/pull/10688))

- Add support for typed structured output in agent workflow steps ([#11014](https://github.com/mastra-ai/mastra/pull/11014))

  When wrapping an agent with `createStep()` and providing a `structuredOutput.schema`, the step's `outputSchema` is now correctly inferred from the provided schema instead of defaulting to `{ text: string }`.

  This enables type-safe chaining of agent steps with structured output to subsequent steps:

  ```typescript
  const articleSchema = z.object({
    title: z.string(),
    summary: z.string(),
    tags: z.array(z.string()),
  });

  // Agent step with structured output - outputSchema is now articleSchema
  const agentStep = createStep(agent, {
    structuredOutput: { schema: articleSchema },
  });

  // Next step can receive the structured output directly
  const processStep = createStep({
    id: 'process',
    inputSchema: articleSchema, // Matches agent's outputSchema
    outputSchema: z.object({ tagCount: z.number() }),
    execute: async ({ inputData }) => ({
      tagCount: inputData.tags.length, // Fully typed!
    }),
  });

  workflow.then(agentStep).then(processStep).commit();
  ```

  When `structuredOutput` is not provided, the agent step continues to use the default `{ text: string }` output schema.

- **Breaking Change:** `memory.readOnly` has been moved to `memory.options.readOnly` ([#11523](https://github.com/mastra-ai/mastra/pull/11523))

  The `readOnly` option now lives inside `memory.options` alongside other memory configuration like `lastMessages` and `semanticRecall`.

  **Before:**

  ```typescript
  agent.stream('Hello', {
    memory: {
      thread: threadId,
      resource: resourceId,
      readOnly: true,
    },
  });
  ```

  **After:**

  ```typescript
  agent.stream('Hello', {
    memory: {
      thread: threadId,
      resource: resourceId,
      options: {
        readOnly: true,
      },
    },
  });
  ```

  **Migration:** Run the codemod to update your code automatically:

  ```shell
  npx @mastra/codemod@beta v1/memory-readonly-to-options .
  ```

  This also fixes issue #11519 where `readOnly: true` was being ignored and messages were saved to memory anyway.

- `getSpeakers` endpoint returns an empty array if voice is not configured on the agent and `getListeners` endpoint returns `{ enabled: false }` if voice is not figured on the agent. ([#10560](https://github.com/mastra-ai/mastra/pull/10560))

  When no voice is set on agent don't throw error, by default set voice to undefined rather than DefaultVoice which throws errors when it is accessed.

- Auto resume suspended tools if `autoResumeSuspendedTools: true` ([#11157](https://github.com/mastra-ai/mastra/pull/11157))

  The flag can be added to `defaultAgentOptions` when creating the agent or to options in `agent.stream` or `agent.generate`

  ```typescript
  const agent = new Agent({
    //...agent information,
    defaultAgentOptions: {
      autoResumeSuspendedTools: true,
    },
  });
  ```

- Allow resuming nested workflow step with chained id ([#9459](https://github.com/mastra-ai/mastra/pull/9459))

  Example, you have a workflow like this

  ```
  export const supportWorkflow = mainWorkflow.then(nestedWorkflow).commit();
  ```

  And a step in `nestedWorkflow` is supsended, you can now also resume it any of these ways:

  ```
  run.resume({
    step: "nestedWorkflow.suspendedStep", //chained nested workflow step id and suspended step id
    //other resume params
   })
  ```

  OR

  ```
  run.resume({
    step: "nestedWorkflow", // just the nested workflow step/step id
    //other resume params
   })
  ```

- Preserve error details when thrown from workflow steps ([#10992](https://github.com/mastra-ai/mastra/pull/10992))
  - Errors thrown in workflow steps now preserve full error details including `cause` chain and custom properties
  - Added `SerializedError` type with proper cause chain support
  - Added `SerializedStepResult` and `SerializedStepFailure` types for handling errors loaded from storage
  - Enhanced `addErrorToJSON` to recursively serialize error cause chains with max depth protection
  - Added `hydrateSerializedStepErrors` to convert serialized errors back to Error instances
  - Fixed Inngest workflow error handling to extract original error from `NonRetriableError.cause`

- Fix base64 encoded images with threads - issue #10480 ([#10483](https://github.com/mastra-ai/mastra/pull/10483))

  Fixed "Invalid URL" error when using base64 encoded images (without `data:` prefix) in agent calls with threads and resources. Raw base64 strings are now automatically converted to proper data URIs before being processed.

  **Changes:**
  - Updated `attachments-to-parts.ts` to detect and convert raw base64 strings to data URIs
  - Fixed `MessageList` image processing to handle raw base64 in two locations:
    - Image part conversion in `aiV4CoreMessageToV1PromptMessage`
    - File part to experimental_attachments conversion in `mastraDBMessageToAIV4UIMessage`
  - Added comprehensive tests for base64 images, data URIs, and HTTP URLs with threads

  **Breaking Change:** None - this is a bug fix that maintains backward compatibility while adding support for raw base64 strings.

- Fix OpenAI schema validation errors in processors ([#9093](https://github.com/mastra-ai/mastra/pull/9093))

- Fix dimension mismatch error when switching embedders in SemanticRecall. The processor now properly validates vector index dimensions when an index already exists, preventing runtime errors when switching between embedders with different dimensions (e.g., fastembed 384 dims → OpenAI 1536 dims). ([#11893](https://github.com/mastra-ai/mastra/pull/11893))

- SimpleAuth and improved CloudAuth ([#10490](https://github.com/mastra-ai/mastra/pull/10490))

- Move `@ai-sdk/azure` to devDependencies ([#10218](https://github.com/mastra-ai/mastra/pull/10218))

- When LLMs like Claude Sonnet 4.5 and Gemini 2.4 call tools with all-optional parameters, they send `args: undefined` instead of `args: {}`. This caused validation to fail with "root: Required". ([#10728](https://github.com/mastra-ai/mastra/pull/10728))

  The fix normalizes `undefined`/`null` to `{}` for object schemas and `[]` for array schemas before validation.

- Removes the deprecated `threadId` and `resourceId` options from `AgentExecutionOptions`. These have been deprecated for months in favour of the `memory` option. ([#11897](https://github.com/mastra-ai/mastra/pull/11897))

  ### Breaking Changes

  #### `@mastra/core`

  The `threadId` and `resourceId` options have been removed from `agent.generate()` and `agent.stream()`. Use the `memory` option instead:

  ```ts
  // Before
  await agent.stream('Hello', {
    threadId: 'thread-123',
    resourceId: 'user-456',
  });

  // After
  await agent.stream('Hello', {
    memory: {
      thread: 'thread-123',
      resource: 'user-456',
    },
  });
  ```

  #### `@mastra/server`

  The `threadId`, `resourceId`, and `resourceid` fields have been removed from the main agent execution body schema. The server now expects the `memory` option format in request bodies. Legacy routes (`/api/agents/:agentId/generate-legacy` and `/api/agents/:agentId/stream-legacy`) continue to support the deprecated fields.

  #### `@mastra/react`

  The `useChat` hook now internally converts `threadId` to the `memory` option format when making API calls. No changes needed in component code - the hook handles the conversion automatically.

  #### `@mastra/client-js`

  When using the client SDK agent methods, use the `memory` option instead of `threadId`/`resourceId`:

  ```ts
  const agent = client.getAgent('my-agent');

  // Before
  await agent.generate([...], {
    threadId: 'thread-123',
    resourceId: 'user-456',
  });

  // After
  await agent.generate([...], {
    memory: {
      thread: 'thread-123',
      resource: 'user-456',
    },
  });
  ```

- Loosen tools types in processInputStep / prepareStep. ([#11071](https://github.com/mastra-ai/mastra/pull/11071))

- Breaking change to move mcp related tool execute arguments nested under an `mcp` argument that is only populated if the tool is passed to an MCPServer. This simpliflies tool definitions and gives you the correct types when working with tools meant for MCP servers. ([#9134](https://github.com/mastra-ai/mastra/pull/9134))

- Refactor internal event system from Emitter to PubSub abstraction for workflow event handling. This change replaces the EventEmitter-based event system with a pluggable PubSub interface, enabling support for distributed workflow execution backends like Inngest. Adds `close()` method to PubSub implementations for proper cleanup. ([#11052](https://github.com/mastra-ai/mastra/pull/11052))

- Fix stopWhen type to accept AI SDK v6 StopCondition functions like `stepCountIs()` ([#11402](https://github.com/mastra-ai/mastra/pull/11402))

- Add human-in-the-loop (HITL) support to agent networks ([#11678](https://github.com/mastra-ai/mastra/pull/11678))
  - Add suspend/resume capabilities to agent network
  - Enable auto-resume for suspended network execution via `autoResumeSuspendedTools`

  `agent.resumeNetwork`, `agent.approveNetworkToolCall`, `agent.declineNetworkToolCall`

- Fixed tool validation error messages so logs show Zod validation errors directly instead of hiding them inside structured JSON. ([#10579](https://github.com/mastra-ai/mastra/pull/10579))

- Add `startAsync()` method and fix Inngest duplicate workflow execution bug ([#11093](https://github.com/mastra-ai/mastra/pull/11093))

  **New Feature: `startAsync()` for fire-and-forget workflow execution**
  - Add `Run.startAsync()` to base workflow class - starts workflow in background and returns `{ runId }` immediately
  - Add `EventedRun.startAsync()` - publishes workflow start event without subscribing for completion
  - Add `InngestRun.startAsync()` - sends Inngest event without polling for result

  **Prevent duplicate Inngest workflow executions**
  - Fix `getRuns()` to properly handle rate limits (429), empty responses, and JSON parse errors with retry logic and exponential backoff
  - Fix `getRunOutput()` to throw `NonRetriableError` when polling fails, preventing Inngest from retrying the parent function and re-triggering the workflow
  - Add timeout to `getRunOutput()` polling (default 5 minutes) with `NonRetriableError` on timeout

  This fixes a production issue where polling failures after successful workflow completion caused Inngest to retry the parent function, which fired a new workflow event and resulted in duplicate executions (e.g., duplicate Slack messages).

- Fixed AI SDK v6 provider tools (like `openai.tools.webSearch()`) not being invoked correctly. These tools are now properly recognized and executed instead of causing failures or hallucinated tool calls. ([#11946](https://github.com/mastra-ai/mastra/pull/11946))

  Resolves `#11781`.

- Fix agent runs with multiple steps only showing last text chunk in observability tools ([#11672](https://github.com/mastra-ai/mastra/pull/11672))

  When an agent model executes multiple steps and generates multiple text chunks, the onFinish payload was only receiving the text from the last step instead of all accumulated text. This caused observability tools like Braintrust to only display the final text chunk. The fix now correctly concatenates all text chunks from all steps.

- Adds validation guards to handle undefined/null values that can occur when config objects are spread (`{ ...config }`). Previously, if getters or non-enumerable properties resulted in undefined values during spread, the constructor would throw cryptic errors when accessing `.id` or `.name` on undefined objects. ([#10718](https://github.com/mastra-ai/mastra/pull/10718))

- Fix missing `title` field in Convex threads table schema ([#11356](https://github.com/mastra-ai/mastra/pull/11356))

  The Convex schema was hardcoded and out of sync with the core `TABLE_SCHEMAS`, causing errors when creating threads:

  ```
  Error: Failed to insert or update a document in table "mastra_threads"
  because it does not match the schema: Object contains extra field `title`
  that is not in the validator.
  ```

  Now the Convex schema dynamically builds from `TABLE_SCHEMAS` via a new `@mastra/core/storage/constants` export path that doesn't pull in Node.js dependencies (safe for Convex's sandboxed schema evaluation).

  ```typescript
  // Users can now import schema tables without Node.js dependency issues
  import { mastraThreadsTable, mastraMessagesTable } from '@mastra/convex/schema';

  export default defineSchema({
    mastra_threads: mastraThreadsTable,
    mastra_messages: mastraMessagesTable,
  });
  ```

  Fixes #11319

- Fix tool input validation destroying non-plain objects ([#11541](https://github.com/mastra-ai/mastra/pull/11541))

  The `convertUndefinedToNull` function in tool input validation was treating all objects as plain objects and recursively processing them. For objects like `Date`, `Map`, `URL`, and class instances, this resulted in empty objects `{}` because they have no enumerable own properties.

  This fix changes the approach to only recurse into plain objects (objects with `Object.prototype` or `null` prototype). All other objects (Date, Map, Set, URL, RegExp, Error, custom class instances, etc.) are now preserved as-is.

  Fixes #11502

- Fixed an issue where deprecated Groq models were shown during template creation. The model selection now filters out models marked as deprecated, displaying only active and supported models. ([#11445](https://github.com/mastra-ai/mastra/pull/11445))

- Workaround for duplicate text-start/text-end IDs in multi-step agentic flows. ([#10740](https://github.com/mastra-ai/mastra/pull/10740))

  The `@ai-sdk/anthropic` and `@ai-sdk/google` providers use numeric indices ("0", "1", etc.) for text block IDs that reset for each LLM call. This caused duplicate IDs when an agent does TEXT → TOOL → TEXT, breaking message ordering and storage.

  The fix replaces numeric IDs with UUIDs, maintaining a map per step so text-start, text-delta, and text-end chunks for the same block share the same UUID. OpenAI's UUIDs pass through unchanged.

- Added support for AI SDK v6 embedding models (specification version v3) in memory and vector modules. Fixed TypeScript error where `ModelRouterEmbeddingModel` was trying to implement a union type instead of `EmbeddingModelV2` directly. ([#11362](https://github.com/mastra-ai/mastra/pull/11362))

- Fix empty overrideScorers causing error instead of skipping scoring ([#11257](https://github.com/mastra-ai/mastra/pull/11257))

  When `overrideScorers` was passed as an empty object `{}`, the agent would throw a "No scorers found" error. Now an empty object explicitly skips scoring, while `undefined` continues to use default scorers.

- Fix GPT-5/o3 reasoning models failing with "required reasoning item" errors when using memory with tools. Empty reasoning is now stored with providerMetadata to preserve OpenAI's item_reference. ([#10585](https://github.com/mastra-ai/mastra/pull/10585))

- Fix generateTitle model type to accept AI SDK LanguageModelV2 ([#10541](https://github.com/mastra-ai/mastra/pull/10541))

  Updated the `generateTitle.model` config option to accept `MastraModelConfig` instead of `MastraLanguageModel`. This allows users to pass raw AI SDK `LanguageModelV2` models (e.g., `anthropic.languageModel('claude-3-5-haiku-20241022')`) directly without type errors.

  Previously, passing a standard `LanguageModelV2` would fail because `MastraLanguageModelV2` has different `doGenerate`/`doStream` return types. Now `MastraModelConfig` is used consistently across:
  - `memory/types.ts` - `generateTitle.model` config
  - `agent.ts` - `genTitle`, `generateTitleFromUserMessage`, `resolveTitleGenerationConfig`
  - `agent-legacy.ts` - `AgentLegacyCapabilities` interface

- fix: support gs:// and s3:// cloud storage URLs in attachmentsToParts ([#11398](https://github.com/mastra-ai/mastra/pull/11398))

- Some LLMs (particularly when not using native JSON mode) output actual newline characters inside JSON string values instead of properly escaped `\n` sequences. This breaks JSON parsing and causes structured output to fail. ([#10965](https://github.com/mastra-ai/mastra/pull/10965))

  This change adds preprocessing to escape unescaped control characters (`\n`, `\r`, `\t`) within JSON string values before parsing, making structured output more robust across different LLM providers.

- Add validation to detect when a function is passed as a tool instead of a tool object. Previously, passing a tool factory function (e.g., `tools: { myTool }` instead of `tools: { myTool: myTool() }`) would silently fail - the LLM would request tool calls but nothing would execute. Now throws a clear error with guidance on how to fix it. ([#11288](https://github.com/mastra-ai/mastra/pull/11288))

- Fixed client-side tool invocations not being stored in memory. Previously, tool invocations with state 'call' were filtered out before persistence, which incorrectly removed client-side tools. Now only streaming intermediate states ('partial-call') are filtered. ([#11630](https://github.com/mastra-ai/mastra/pull/11630))

  Fixed a crash when updating working memory with an empty or null update; existing data is now preserved.

- Fixed memory readOnly option not being respected when agents share a RequestContext. Previously, when output processors were resolved, the readOnly check happened too early - before the agent could set its own MastraMemory context. This caused child agents to inherit their parent's readOnly setting when sharing a RequestContext. ([#11653](https://github.com/mastra-ai/mastra/pull/11653))

  The readOnly check is now only done at execution time in each processor's processOutputResult method, allowing proper isolation.

- Messages without `createdAt` timestamps were getting shuffled because they all received identical timestamps during conversion. Now messages are assigned monotonically increasing timestamps via `generateCreatedAt()`, preserving input order. ([#10686](https://github.com/mastra-ai/mastra/pull/10686))

  Before:

  ```
  Input:  [user: "hello", assistant: "Hi!", user: "bye"]
  Output: [user: "bye", assistant: "Hi!", user: "hello"]  // shuffled!
  ```

  After:

  ```
  Input:  [user: "hello", assistant: "Hi!", user: "bye"]
  Output: [user: "hello", assistant: "Hi!", user: "bye"]  // correct order
  ```

- fix(observability): start MODEL_STEP span at beginning of LLM execution ([#11409](https://github.com/mastra-ai/mastra/pull/11409))

  The MODEL_STEP span was being created when the step-start chunk arrived (after the model API call completed), causing the span's startTime to be close to its endTime instead of accurately reflecting when the step began.

  This fix ensures MODEL_STEP spans capture the full duration of each LLM execution step, including the API call latency, by starting the span at the beginning of the step execution rather than when the response starts streaming.

  Fixes #11271

- Fix network validation not seeing previous iteration results in multi-step tasks ([#11691](https://github.com/mastra-ai/mastra/pull/11691))

  The validation LLM was unable to determine task completion for multi-step tasks because it couldn't see what primitives had already executed. Now includes a compact list of completed primitives in the validation prompt.

- Fix tool outputSchema validation to allow unsupported Zod types like ZodTuple. The outputSchema is only used for internal validation and never sent to the LLM, so model compatibility checks are not needed. ([#9409](https://github.com/mastra-ai/mastra/pull/9409))

- Fix provider-executed tools (like `openai.tools.webSearch()`) not working correctly with AI SDK v6 models. The agent's `generate()` method was ending prematurely with `finishReason: 'tool-calls'` instead of completing with a text response after tool execution. ([#11622](https://github.com/mastra-ai/mastra/pull/11622))

  The issue was that V6 provider tools have `type: 'provider'` while V5 uses `type: 'provider-defined'`. The tool preparation code now detects the model version and uses the correct type.

- Fix reasoning providerMetadata leaking into text parts when using memory with OpenAI reasoning models. The runState.providerOptions is now cleared after reasoning-end to prevent text parts from inheriting the reasoning's itemId. ([#11380](https://github.com/mastra-ai/mastra/pull/11380))

- Scorers now have access to custom gateways when resolving models. Previously, calling `resolveModelConfig` in the scorer didn't pass the Mastra instance, so custom gateways were never available. ([#10778](https://github.com/mastra-ai/mastra/pull/10778))

- Ensure model_generation spans end before agent_run spans. ([#9251](https://github.com/mastra-ai/mastra/pull/9251))

- Sub-agents with dynamic model configurations were broken because `requestContext` was not being passed to `getModel()` when creating agent tools. This caused sub-agents using function-based model configurations to receive an empty context instead of the parent's context. ([#10844](https://github.com/mastra-ai/mastra/pull/10844))

  No code changes required for consumers - this fix restores expected behavior for dynamic model configurations in sub-agents.

- Fixed `TokenLimiterProcessor` not filtering memory messages when limiting tokens. ([#11941](https://github.com/mastra-ai/mastra/pull/11941))

  Previously, the processor only received the latest user input messages, missing the conversation history from memory. This meant token limiting couldn't filter historical messages to fit within the context window.

  The processor now correctly:
  - Accesses all messages (memory + input) when calculating token budgets
  - Accounts for system messages in the token budget
  - Filters older messages to prioritize recent conversation context

  Fixes #11902

- Fixed inline type narrowing for `tool.execute()` return type when using `outputSchema`. ([#11420](https://github.com/mastra-ai/mastra/pull/11420))

  **Problem:** When calling `tool.execute()`, TypeScript couldn't narrow the `ValidationError | OutputType` union after checking `'error' in result && result.error`, causing type errors when accessing output properties.

  **Solution:**
  - Added `{ error?: never }` to the success type, enabling proper discriminated union narrowing
  - Simplified `createTool` generics so `inputData` is correctly typed based on `inputSchema`

  **Note:** Tool output schemas should not use `error` as a field name since it's reserved for ValidationError discrimination. Use `errorMessage` or similar instead.

  **Usage:**

  ```typescript
  const result = await myTool.execute({ firstName: 'Hans' });

  if ('error' in result && result.error) {
    console.error('Validation failed:', result.message);
    return;
  }

  // ✅ TypeScript now correctly narrows result
  return { fullName: result.fullName };
  ```

- Fix toolCallId propagation in agent network tool execution. The toolCallId property was undefined at runtime despite being required by TypeScript type definitions in AgentToolExecutionContext. Now properly passes the toolCallId through to the tool's context during network tool execution. ([#10951](https://github.com/mastra-ai/mastra/pull/10951))

- Changes `ToolStream` to extend `WritableStream<unknown>` instead of `WritableStream<T>`. This fixes the TypeScript error when piping `objectStream` or `fullStream` to `writer` in workflow steps. ([#10845](https://github.com/mastra-ai/mastra/pull/10845))

  Before:

  ```typescript
  // TypeError: ToolStream<ChunkType> is not assignable to WritableStream<Partial<StoryPlan>>
  await response.objectStream.pipeTo(writer);
  ```

  After:

  ```typescript
  // Works without type errors
  await response.objectStream.pipeTo(writer);
  ```

- Fix AI SDK v6 (specificationVersion: "v3") model support in sub-agent calls. Previously, when a parent agent invoked a sub-agent with a v3 model through the `agents` property, the version check only matched "v2", causing v3 models to incorrectly fall back to legacy streaming methods and throw "V2 models are not supported for streamLegacy" error. ([#11452](https://github.com/mastra-ai/mastra/pull/11452))

  The fix updates version checks in `listAgentTools` and `llm-mapping-step.ts` to use the centralized `supportedLanguageModelSpecifications` array which includes both v2 and v3.

  Also adds missing v3 test coverage to tool-handling.test.ts to prevent regression.

- Ensure that when resuming a workflow from a snapshot, the input property is correctly set from the snapshot's context input rather than from resume data. This prevents the loss of original workflow input data during suspend/resume cycles. ([#9380](https://github.com/mastra-ai/mastra/pull/9380))

- When createRun is called with an existing runId, it now correctly updates the run's status from the storage snapshot. This fixes the issue where different workflow instances (e.g., different API requests) would get a run with 'pending' status instead of the correct status from storage (e.g., 'suspended'). ([#10664](https://github.com/mastra-ai/mastra/pull/10664))

- Fixed "Transforms cannot be represented in JSON Schema" error when using Zod v4 with structuredOutput ([#11466](https://github.com/mastra-ai/mastra/pull/11466))

  When using schemas with `.optional()`, `.nullable()`, `.default()`, or `.nullish().default("")` patterns with `structuredOutput` and Zod v4, users would encounter an error because OpenAI schema compatibility layer adds transforms that Zod v4's native `toJSONSchema()` cannot handle.

  The fix uses Mastra's transform-safe `zodToJsonSchema` function which gracefully handles transforms by using the `unrepresentable: 'any'` option.

  Also exported `isZodType` utility from `@mastra/schema-compat` and updated it to detect both Zod v3 (`_def`) and Zod v4 (`_zod`) schemas.

- Fix crash in `mastraDBMessageToAIV4UIMessage` when `content.parts` is undefined or null. ([#11550](https://github.com/mastra-ai/mastra/pull/11550))

  This resolves an issue where `ModerationProcessor` (and other code paths using `MessageList.get.*.ui()`) would throw `TypeError: Cannot read properties of undefined (reading 'length')` when processing messages with missing `parts` array. This commonly occurred when using AI SDK v4 (LanguageModelV1) models with input/output processors.

  The fix adds null coalescing (`?? []`) to safely handle undefined/null `parts` in the message conversion method.

- Upgrade AI SDK v6 from beta to stable (6.0.1) and fix finishReason breaking change. ([#11351](https://github.com/mastra-ai/mastra/pull/11351))

  AI SDK v6 stable changed finishReason from a string to an object with `unified` and `raw` properties. Added `normalizeFinishReason()` helper to handle both v5 (string) and v6 (object) formats at the stream transform layer

- Improve autoResumeSuspendedTools instruction for tool approval ([#11338](https://github.com/mastra-ai/mastra/pull/11338))

- Fix vector definition to fix pinecone ([#10150](https://github.com/mastra-ai/mastra/pull/10150))

- Preserve error details when thrown from workflow steps ([#10992](https://github.com/mastra-ai/mastra/pull/10992))

  Workflow errors now retain custom properties like `statusCode`, `responseHeaders`, and `cause` chains. This enables error-specific recovery logic in your applications.

  **Before:**

  ```typescript
  const result = await workflow.execute({ input });
  if (result.status === 'failed') {
    // Custom error properties were lost
    console.log(result.error); // "Step execution failed" (just a string)
  }
  ```

  **After:**

  ```typescript
  const result = await workflow.execute({ input });
  if (result.status === 'failed') {
    // Custom properties are preserved
    console.log(result.error.message); // "Step execution failed"
    console.log(result.error.statusCode); // 429
    console.log(result.error.cause?.name); // "RateLimitError"
  }
  ```

  **Type change:** `WorkflowState.error` and `WorkflowRunState.error` types changed from `string | Error` to `SerializedError`.

  Other changes:
  - Added `UpdateWorkflowStateOptions` type for workflow state updates

- Fix message metadata not persisting when using simple message format. Previously, custom metadata passed in messages (e.g., `{role: 'user', content: 'text', metadata: {userId: '123'}}`) was not being saved to the database. This occurred because the CoreMessage conversion path didn't preserve metadata fields. ([#10488](https://github.com/mastra-ai/mastra/pull/10488))

  Now metadata is properly preserved for all message input formats:
  - Simple CoreMessage format: `{role, content, metadata}`
  - Full UIMessage format: `{role, content, parts, metadata}`
  - AI SDK v5 ModelMessage format with metadata

  Fixes #8556

- Fix Zod 4 compatibility for storage schema detection ([#11431](https://github.com/mastra-ai/mastra/pull/11431))

  If you're using Zod 4, `buildStorageSchema` was failing to detect nullable and optional fields correctly. This caused `NOT NULL constraint failed` errors when storing observability spans and other data.

  This fix enables proper schema detection for Zod 4 users, ensuring nullable fields like `parentSpanId` are correctly identified and don't cause database constraint violations.

- Add native Perplexity provider support ([#10885](https://github.com/mastra-ai/mastra/pull/10885))

- Added `startExclusive` and `endExclusive` options to `dateRange` filter for message queries. ([#11479](https://github.com/mastra-ai/mastra/pull/11479))

  **What changed:** The `filter.dateRange` parameter in `listMessages()` and `Memory.recall()` now supports `startExclusive` and `endExclusive` boolean options. When set to `true`, messages with timestamps exactly matching the boundary are excluded from results.

  **Why this matters:** Enables cursor-based pagination for chat applications. When new messages arrive during a session, offset-based pagination can skip or duplicate messages. Using `endExclusive: true` with the oldest message's timestamp as a cursor ensures consistent pagination without gaps or duplicates.

  **Example:**

  ```typescript
  // Get first page
  const page1 = await memory.recall({
    threadId: 'thread-123',
    perPage: 10,
    orderBy: { field: 'createdAt', direction: 'DESC' },
  });

  // Get next page using cursor-based pagination
  const oldestMessage = page1.messages[page1.messages.length - 1];
  const page2 = await memory.recall({
    threadId: 'thread-123',
    perPage: 10,
    orderBy: { field: 'createdAt', direction: 'DESC' },
    filter: {
      dateRange: {
        end: oldestMessage.createdAt,
        endExclusive: true, // Excludes the cursor message
      },
    },
  });
  ```

- Improved TypeScript type inference for workflow steps. ([#11953](https://github.com/mastra-ai/mastra/pull/11953))

  **What changed:**
  - Step input/output type mismatches are now caught at compile time when chaining steps with `.then()`
  - The `execute` function now properly infers types from `inputSchema`, `outputSchema`, `stateSchema`, and other schema parameters
  - Clearer error messages when step types don't match workflow requirements

  **Why:**
  Previously, type errors in workflow step chains would only surface at runtime. Now TypeScript validates that each step's input requirements are satisfied by the previous step's output, helping you catch integration issues earlier in development.

- Fix Zod 4 compatibility issue with structuredOutput in agent.generate() ([#11133](https://github.com/mastra-ai/mastra/pull/11133))

  Users with Zod 4 installed would see `TypeError: undefined is not an object (evaluating 'def.valueType._zod')` when using `structuredOutput` with agent.generate(). This happened because ProcessorStepSchema contains `z.custom()` fields that hold user-provided Zod schemas, and the workflow validation was trying to deeply validate these schemas causing version conflicts.

  The fix disables input validation for processor workflows since `z.custom()` fields are meant to pass through arbitrary types without deep validation.

- Truncate map config when too long ([#11175](https://github.com/mastra-ai/mastra/pull/11175))

- fix resumeStream type to use resumeSchema ([#10202](https://github.com/mastra-ai/mastra/pull/10202))

- Pass resourceId and threadId to network agent's subAgent when it has its own memory ([#10592](https://github.com/mastra-ai/mastra/pull/10592))

- use `agent.getMemory` to fetch the memory instance on the Agent class to make sure that storage gets set if memory doesn't set it itself. ([#10556](https://github.com/mastra-ai/mastra/pull/10556))

- Built-in processors that use internal agents (PromptInjectionDetector, ModerationProcessor, PIIDetector, LanguageDetector, StructuredOutputProcessor) now accept `providerOptions` to control model behavior. ([#10651](https://github.com/mastra-ai/mastra/pull/10651))

  This lets you pass provider-specific settings like `reasoningEffort` for OpenAI thinking models:

  ```typescript
  const processor = new PromptInjectionDetector({
    model: 'openai/o1-mini',
    threshold: 0.7,
    strategy: 'block',
    providerOptions: {
      openai: {
        reasoningEffort: 'low',
      },
    },
  });
  ```

- Improved typing for `workflow.then` to allow the provided steps `inputSchema` to be a subset of the previous steps `outputSchema`. Also errors if the provided steps `inputSchema` is a superset of the previous steps outputSchema. ([#10763](https://github.com/mastra-ai/mastra/pull/10763))

- Composite auth implementation ([#10359](https://github.com/mastra-ai/mastra/pull/10359))

- Fix message list provider metadata handling and reasoning text optimization ([#10281](https://github.com/mastra-ai/mastra/pull/10281))
  - Improved provider metadata preservation across message transformations
  - Optimized reasoning text storage to avoid duplication (using `details` instead of `reasoning` field)
  - Fixed test snapshots for timestamp precision and metadata handling

- Fix requireApproval property being ignored for tools passed via toolsets, clientTools, and memoryTools parameters. The requireApproval flag now correctly propagates through all tool conversion paths, ensuring tools requiring approval will properly request user approval before execution. ([#10464](https://github.com/mastra-ai/mastra/pull/10464))

- fix(core): support LanguageModelV3 in MastraModelGateway.resolveLanguageModel ([#11489](https://github.com/mastra-ai/mastra/pull/11489))

- Fixed duplicate storage initialization when init() is called explicitly before other methods. The augmentWithInit proxy now tracks when init() is called directly, preventing subsequent method calls from triggering init() again. This resolves the high volume of requests to storage backends (like Turso) during agent streaming with memory enabled. ([#12067](https://github.com/mastra-ai/mastra/pull/12067))

- Add timeTravel APIs and add timeTravel feature to studio ([#10361](https://github.com/mastra-ai/mastra/pull/10361))

- Add helpful JSDoc comments to `BundlerConfig` properties (used with `bundler` option) ([#10218](https://github.com/mastra-ai/mastra/pull/10218))

- Improve type handling with Zod ([#12091](https://github.com/mastra-ai/mastra/pull/12091))

- Added the ability to provide a base path for Mastra Studio. ([#10441](https://github.com/mastra-ai/mastra/pull/10441))

  ```ts
  import { Mastra } from '@mastra/core';

  export const mastra = new Mastra({
    server: {
      studioBase: '/my-mastra-studio',
    },
  });
  ```

  This will make Mastra Studio available at `http://localhost:4111/my-mastra-studio`.

- Fix Azure Foundry rate limit handling for -1 values ([#10409](https://github.com/mastra-ai/mastra/pull/10409))

- Improve error messaging for LLM API errors. When an error originates from an LLM provider (e.g., rate limits, overloaded, auth failures), the console now indicates it's an upstream API error and includes the provider and model information. ([#12022](https://github.com/mastra-ai/mastra/pull/12022))

  Before:

  ```
  ERROR (Mastra): Error in agent stream
      error: { "message": "Overloaded", "type": "overloaded_error" }
  ```

  After:

  ```
  ERROR (Mastra): Upstream LLM API error from anthropic (model: claude-3-opus)
      error: { "message": "Overloaded", "type": "overloaded_error" }
  ```

- feat: Add field filtering and nested workflow control to workflow execution result endpoint ([#11246](https://github.com/mastra-ai/mastra/pull/11246))

  Adds two optional query parameters to `/api/workflows/:workflowId/runs/:runId/execution-result` endpoint:
  - `fields`: Request only specific fields (e.g., `status`, `result`, `error`)
  - `withNestedWorkflows`: Control whether to fetch nested workflow data

  This significantly reduces response payload size and improves response times for large workflows.

  ## Server Endpoint Usage

  ```http
  # Get only status (minimal payload - fastest)
  GET /api/workflows/:workflowId/runs/:runId/execution-result?fields=status

  # Get status and result
  GET /api/workflows/:workflowId/runs/:runId/execution-result?fields=status,result

  # Get all fields but without nested workflow data (faster)
  GET /api/workflows/:workflowId/runs/:runId/execution-result?withNestedWorkflows=false

  # Get only specific fields without nested workflow data
  GET /api/workflows/:workflowId/runs/:runId/execution-result?fields=status,steps&withNestedWorkflows=false

  # Get full data (default behavior)
  GET /api/workflows/:workflowId/runs/:runId/execution-result
  ```

  ## Client SDK Usage

  ```typescript
  import { MastraClient } from '@mastra/client-js';

  const client = new MastraClient({ baseUrl: 'http://localhost:4111' });
  const workflow = client.getWorkflow('myWorkflow');

  // Get only status (minimal payload - fastest)
  const statusOnly = await workflow.runExecutionResult(runId, {
    fields: ['status'],
  });
  console.log(statusOnly.status); // 'success' | 'failed' | 'running' | etc.

  // Get status and result
  const statusAndResult = await workflow.runExecutionResult(runId, {
    fields: ['status', 'result'],
  });

  // Get all fields but without nested workflow data (faster)
  const resultWithoutNested = await workflow.runExecutionResult(runId, {
    withNestedWorkflows: false,
  });

  // Get specific fields without nested workflow data
  const optimized = await workflow.runExecutionResult(runId, {
    fields: ['status', 'steps'],
    withNestedWorkflows: false,
  });

  // Get full execution result (default behavior)
  const fullResult = await workflow.runExecutionResult(runId);
  ```

  ## Core API Changes

  The `Workflow.getWorkflowRunExecutionResult` method now accepts an options object:

  ```typescript
  await workflow.getWorkflowRunExecutionResult(runId, {
    withNestedWorkflows: false, // default: true, set to false to skip nested workflow data
    fields: ['status', 'result'], // optional field filtering
  });
  ```

  ## Inngest Compatibility

  The `@mastra/inngest` package has been updated to use the new options object API. This is a non-breaking internal change - no action required from inngest workflow users.

  ## Performance Impact

  For workflows with large step outputs:
  - Requesting only `status`: ~99% reduction in payload size
  - Requesting `status,result,error`: ~95% reduction in payload size
  - Using `withNestedWorkflows=false`: Avoids expensive nested workflow data fetching
  - Combining both: Maximum performance optimization

- Fix model headers not being passed through gateway system ([#10465](https://github.com/mastra-ai/mastra/pull/10465))

  Previously, custom headers specified in `MastraModelConfig` were not being passed through the gateway system to model providers. This affected:
  - OpenRouter (preventing activity tracking with `HTTP-Referer` and `X-Title`)
  - Custom providers using custom URLs (headers not passed to `createOpenAICompatible`)
  - Custom gateway implementations (headers not available in `resolveLanguageModel`)

  Now headers are correctly passed through the entire gateway system:
  - Base `MastraModelGateway` interface updated to accept headers
  - `ModelRouterLanguageModel` passes headers from config to all gateways
  - OpenRouter receives headers for activity tracking
  - Custom URL providers receive headers via `createOpenAICompatible`
  - Custom gateways can access headers in their `resolveLanguageModel` implementation

  Example usage:

  ```typescript
  // Works with OpenRouter
  const agent = new Agent({
    name: 'my-agent',
    instructions: 'You are a helpful assistant.',
    model: {
      id: 'openrouter/anthropic/claude-3-5-sonnet',
      headers: {
        'HTTP-Referer': 'https://myapp.com',
        'X-Title': 'My Application',
      },
    },
  });

  // Also works with custom providers
  const customAgent = new Agent({
    name: 'custom-agent',
    instructions: 'You are a helpful assistant.',
    model: {
      id: 'custom-provider/model',
      url: 'https://api.custom.com/v1',
      apiKey: 'key',
      headers: {
        'X-Custom-Header': 'custom-value',
      },
    },
  });
  ```

  Fixes https://github.com/mastra-ai/mastra/issues/9760

- Add type bailed to workflowRunStatus ([#10091](https://github.com/mastra-ai/mastra/pull/10091))

- Add tool call approval ([#8649](https://github.com/mastra-ai/mastra/pull/8649))

- Fixed a bug where multiple tools streaming output simultaneously could fail with "WritableStreamDefaultWriter is locked" errors. Tool streaming now works reliably during concurrent tool executions. ([#10830](https://github.com/mastra-ai/mastra/pull/10830))

- default validate inputs to true in Workflow execute ([#10222](https://github.com/mastra-ai/mastra/pull/10222))

- Fixes issues where thread and messages were not saved before suspension when tools require approval or call suspend() during execution. This caused conversation history to be lost if users refreshed during tool approval or suspension. ([#10369](https://github.com/mastra-ai/mastra/pull/10369))

  **Backend changes (@mastra/core):**
  - Add assistant messages to messageList immediately after LLM execution
  - Flush messages synchronously before suspension to persist state
  - Create thread if it doesn't exist before flushing
  - Add metadata helpers to persist and remove tool approval state
  - Pass saveQueueManager and memory context through workflow for immediate persistence

  **Frontend changes (@mastra/react):**
  - Extract runId from pending approvals to enable resumption after refresh
  - Convert `pendingToolApprovals` (DB format) to `requireApprovalMetadata` (runtime format)
  - Handle both `dynamic-tool` and `tool-{NAME}` part types for approval state
  - Change runId from hardcoded `agentId` to unique `uuid()`

  **UI changes (@mastra/playground-ui):**
  - Handle tool calls awaiting approval in message initialization
  - Convert approval metadata format when loading initial messages

  Fixes #9745, #9906

- Fix error handling and serialization in agent streaming to ensure errors are consistently exposed and preserved. ([#9144](https://github.com/mastra-ai/mastra/pull/9144))

- Update MockMemory to work with new storage API changes. MockMemory now properly implements all abstract MastraMemory methods. This includes proper thread management, message saving with MessageList conversion, working memory operations with scope support, and resource listing. ([#10368](https://github.com/mastra-ai/mastra/pull/10368))

  Add Zod v4 support for working memory schemas. Memory implementations now check for Zod v4's built-in `.toJsonSchema()` method before falling back to the `zodToJsonSchema` compatibility function, improving performance and forward compatibility while maintaining backward compatibility with Zod v3.

  Add Gemini 3 Pro test coverage in agent-gemini.test.ts to validate the latest Gemini model integration.

- Fixes issue where clicking the reset button in the model picker would fail to restore the original LanguageModelV2 (or any other types) object that was passed during agent construction. ([#9481](https://github.com/mastra-ai/mastra/pull/9481))

- Fix a bug where streaming didn't output the final chunk ([#9546](https://github.com/mastra-ai/mastra/pull/9546))

- Expand `processInputStep` processor method and integrate `prepareStep` as a processor ([#10774](https://github.com/mastra-ai/mastra/pull/10774))

  **New Features:**
  - `prepareStep` callback now runs through the standard `processInputStep` pipeline
  - Processors can now modify per-step: `model`, `tools`, `toolChoice`, `activeTools`, `messages`, `systemMessages`, `providerOptions`, `modelSettings`, and `structuredOutput`
  - Processor chaining: each processor receives accumulated state from previous processors
  - System messages are isolated per-step (reset at start of each step)

  **Breaking Change:**
  - `prepareStep` messages format changed from AI SDK v5 model messages to `MastraDBMessage` format
  - Migration: Use `messageList.get.all.aiV5.model()` if you need the old format

- Fix type issue with workflow `.parallel()` when passing multiple steps, one or more of which has a `resumeSchema` provided. ([#10708](https://github.com/mastra-ai/mastra/pull/10708))

- Add support for `instructions` field in MCPServer ([#11421](https://github.com/mastra-ai/mastra/pull/11421))

  Implements the official MCP specification's `instructions` field, which allows MCP servers to provide system-wide prompts that are automatically sent to clients during initialization. This eliminates the need for per-project configuration files (like AGENTS.md) by centralizing the system prompt in the server definition.

  **What's New:**
  - Added `instructions` optional field to `MCPServerConfig` type
  - Instructions are passed to the underlying MCP SDK Server during initialization
  - Instructions are sent to clients in the `InitializeResult` response
  - Fully compatible with all MCP clients (Cursor, Windsurf, Claude Desktop, etc.)

  **Example Usage:**

  ```typescript
  const server = new MCPServer({
    name: 'GitHub MCP Server',
    version: '1.0.0',
    instructions:
      'Use the available tools to help users manage GitHub repositories, issues, and pull requests. Always search before creating to avoid duplicates.',
    tools: { searchIssues, createIssue, listPRs },
  });
  ```

- Fix race condition in parallel tool stream writes ([#10463](https://github.com/mastra-ai/mastra/pull/10463))

  Introduces a write queue to ToolStream to serialize access to the underlying stream, preventing writer locked errors

- Remove unneeded console warning when flushing messages and no threadId or saveQueueManager is found. ([#10498](https://github.com/mastra-ai/mastra/pull/10498))

- Don't call `os.homedir()` at top level (but lazy invoke it) to accommodate sandboxed environments ([#9211](https://github.com/mastra-ai/mastra/pull/9211))

- Don't download unsupported media ([#9209](https://github.com/mastra-ai/mastra/pull/9209))

- Add support for doGenerate in LanguageModelV2. This change fixes issues with OpenAI stream permissions. ([#10239](https://github.com/mastra-ai/mastra/pull/10239))
  - Added new abstraction over LanguageModelV2

- Add storage composition to MastraStorage ([#11401](https://github.com/mastra-ai/mastra/pull/11401))

  `MastraStorage` can now compose storage domains from different adapters. Use it when you need different databases for different purposes - for example, PostgreSQL for memory and workflows, but a different database for observability.

  ```typescript
  import { MastraStorage } from '@mastra/core/storage';
  import { MemoryPG, WorkflowsPG, ScoresPG } from '@mastra/pg';
  import { MemoryLibSQL } from '@mastra/libsql';

  // Compose domains from different stores
  const storage = new MastraStorage({
    id: 'composite',
    domains: {
      memory: new MemoryLibSQL({ url: 'file:./local.db' }),
      workflows: new WorkflowsPG({ connectionString: process.env.DATABASE_URL }),
      scores: new ScoresPG({ connectionString: process.env.DATABASE_URL }),
    },
  });
  ```

  **Breaking changes:**
  - `storage.supports` property no longer exists
  - `StorageSupports` type is no longer exported from `@mastra/core/storage`

  All stores now support the same features. For domain availability, use `getStore()`:

  ```typescript
  const store = await storage.getStore('memory');
  if (store) {
    // domain is available
  }
  ```

- Fixes .network() method ignores MASTRA_RESOURCE_ID_KEY from requestContext ([`4524734`](https://github.com/mastra-ai/mastra/commit/45247343e384717a7c8404296275c56201d6470f))

- Fixed the type of targetResult in the onItemComplete callback for runEvals. The parameter was incorrectly typed as a Promise, but the actual value passed is already resolved. Users no longer need to await targetResult inside their callback. ([#12030](https://github.com/mastra-ai/mastra/pull/12030))

- Detect thenable objects returned by AI model providers ([#8905](https://github.com/mastra-ai/mastra/pull/8905))

- - PostgreSQL: use `getSqlType()` in `createTable` instead of `toUpperCase()` ([#11112](https://github.com/mastra-ai/mastra/pull/11112))
  - LibSQL: use `getSqlType()` in `createTable`, return `JSONB` for jsonb type (matches SQLite 3.45+ support)
  - ClickHouse: use `getSqlType()` in `createTable` instead of `COLUMN_TYPES` constant, add missing types (uuid, float, boolean)
  - Remove unused `getSqlType()` and `getDefaultValue()` from `MastraStorage` base class (all stores use `StoreOperations` versions)

- Fixed agent network not returning text response when routing agent handles requests without delegation. ([#11497](https://github.com/mastra-ai/mastra/pull/11497))

  **What changed:**
  - Agent networks now correctly stream text responses when the routing agent decides to handle a request itself instead of delegating to sub-agents, workflows, or tools
  - Added fallback in transformers to ensure text is always returned even if core events are missing

  **Why this matters:**
  Previously, when using `toAISdkV5Stream` or `networkRoute()` outside of the Mastra Studio UI, no text content was returned when the routing agent handled requests directly. This fix ensures consistent behavior across all API routes.

  Fixes #11219

- chore(core): MessageHistory input processor pass resourceId for storage ([#11910](https://github.com/mastra-ai/mastra/pull/11910))

- Add debugger-like click-through UI to workflow graph ([#11350](https://github.com/mastra-ai/mastra/pull/11350))

- Adds bidirectional integration with otel tracing via a new @mastra/otel-bridge package. ([#10482](https://github.com/mastra-ai/mastra/pull/10482))

- Add delete workflow run API ([#10991](https://github.com/mastra-ai/mastra/pull/10991))

  ```typescript
  await workflow.deleteWorkflowRunById(runId);
  ```

- Add optional includeRawChunks parameter to agent execution options, ([#10456](https://github.com/mastra-ai/mastra/pull/10456))
  allowing users to include raw chunks in stream output where supported
  by the model provider.

- Add initial state input to workflow form in studio ([#11560](https://github.com/mastra-ai/mastra/pull/11560))

- Fix input tool validation when no inputSchema is provided ([#9941](https://github.com/mastra-ai/mastra/pull/9941))

- When `mastra dev` runs, multiple processes can write to `provider-registry.json` concurrently (auto-refresh, syncGateways, syncGlobalCacheToLocal). This causes file corruption where the end of the JSON appears twice, making it unparseable. ([#10455](https://github.com/mastra-ai/mastra/pull/10455))

  The fix uses atomic writes via the write-to-temp-then-rename pattern. Instead of:

  ```ts
  fs.writeFileSync(filePath, content, 'utf-8');
  ```

  We now do:

  ```ts
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.${randomSuffix}.tmp`;
  fs.writeFileSync(tempPath, content, 'utf-8');
  fs.renameSync(tempPath, filePath); // atomic on POSIX
  ```

  `fs.rename()` is atomic on POSIX systems when both paths are on the same filesystem, so concurrent writes will each complete fully rather than interleaving.

- Adds `processInputStep` method to the Processor interface. Unlike `processInput` which runs once at the start, this runs at each step of the agentic loop (including tool call continuations). ([#10650](https://github.com/mastra-ai/mastra/pull/10650))

  ```ts
  const processor: Processor = {
    id: 'my-processor',
    processInputStep: async ({ messages, messageList, stepNumber, systemMessages }) => {
      // Transform messages at each step before LLM call
      return messageList;
    },
  };
  ```

- Added missing stream types to @mastra/core/stream for better TypeScript support ([#11513](https://github.com/mastra-ai/mastra/pull/11513))

  **New types available:**
  - Chunk types: `ToolCallChunk`, `ToolResultChunk`, `SourceChunk`, `FileChunk`, `ReasoningChunk`
  - Payload types: `ToolCallPayload`, `ToolResultPayload`, `TextDeltaPayload`, `ReasoningDeltaPayload`, `FilePayload`, `SourcePayload`
  - JSON utilities: `JSONValue`, `JSONObject`, `JSONArray` and readonly variants

  These types are now properly exported, enabling full TypeScript IntelliSense when working with streaming data.

- - `Run.cancel()` now updates workflow status to 'canceled' in storage, resolving the issue where suspended workflows remained in 'suspended' status after cancellation ([#11139](https://github.com/mastra-ai/mastra/pull/11139))
  - Cancellation status is immediately persisted and reflected to observers

- When using output processors with `agent.generate()`, `result.text` was returning the unprocessed LLM response instead of the processed text. ([#10735](https://github.com/mastra-ai/mastra/pull/10735))

  **Before:**

  ```ts
  const result = await agent.generate('hello');
  result.text; // "hello world" (unprocessed)
  result.response.messages[0].content[0].text; // "HELLO WORLD" (processed)
  ```

  **After:**

  ```ts
  const result = await agent.generate('hello');
  result.text; // "HELLO WORLD" (processed)
  ```

  The bug was caused by the `text` delayed promise being resolved twice - first correctly with the processed text, then overwritten with the unprocessed buffered text.

- Add `response` to finish chunk payload for output processor metadata access ([#11549](https://github.com/mastra-ai/mastra/pull/11549))

  When using output processors with streaming, metadata added via `processOutputResult` is now accessible in the finish chunk's `payload.response.uiMessages`. This allows clients consuming streams over HTTP (e.g., via `/stream/ui`) to access processor-added metadata.

  ```typescript
  for await (const chunk of stream.fullStream) {
    if (chunk.type === 'finish') {
      const uiMessages = chunk.payload.response?.uiMessages;
      const metadata = uiMessages?.find(m => m.role === 'assistant')?.metadata;
    }
  }
  ```

  Fixes #11454

- Make initialState optional in studio ([#11744](https://github.com/mastra-ai/mastra/pull/11744))

- Refactored default engine to fit durable execution better, and the inngest engine to match. ([#10627](https://github.com/mastra-ai/mastra/pull/10627))
  Also fixes requestContext persistence by relying on inngest step memoization.

  Unifies some of the stepResults and error formats in both engines.

- Removed a debug log that printed large Zod schemas, resulting in cleaner console output when using agents with memory enabled. ([#11279](https://github.com/mastra-ai/mastra/pull/11279))

- Fix type recursion by importing from 'zod' instead of 'zod/v3' ([#12009](https://github.com/mastra-ai/mastra/pull/12009))

- Fixed formatting of model_step, model_chunk, and tool_call spans in Arize Exporter. ([#11922](https://github.com/mastra-ai/mastra/pull/11922))

  Also removed `tools` output from `model_step` spans for all exporters.

- Set `externals: true` as the default for `mastra build` and cloud-deployer to reduce bundle issues with native dependencies. ([`0dbf199`](https://github.com/mastra-ai/mastra/commit/0dbf199110f22192ce5c95b1c8148d4872b4d119))

  **Note:** If you previously relied on the default bundling behavior (all dependencies bundled), you can explicitly set `externals: false` in your bundler configuration.

- Fixes incorrect tool invocation format in message list that was causing client tools to fail during message format conversions. ([#9590](https://github.com/mastra-ai/mastra/pull/9590))

- Allow direct access to server app handle directly from Mastra instance. ([#10598](https://github.com/mastra-ai/mastra/pull/10598))

  ```ts
  // Before: HTTP request to localhost
  const response = await fetch(`http://localhost:5000/api/tools`);

  // After: Direct call via app.fetch()
  const app = mastra.getServerApp<Hono>();
  const response = await app.fetch(new Request('http://internal/api/tools'));
  ```

  - Added `mastra.getServerApp<T>()` to access the underlying Hono/Express app
  - Added `mastra.getMastraServer()` and `mastra.setMastraServer()` for adapter access
  - Added `MastraServerBase` class in `@mastra/core/server` for adapter implementations
  - Server adapters now auto-register with Mastra in their constructor

- Allow provider to pass through options to the auth config ([#10284](https://github.com/mastra-ai/mastra/pull/10284))

- When sending the first message to a new thread with PostgresStore, users would get a "Thread not found" error. This happened because the thread was created in memory but not persisted to the database before the MessageHistory output processor tried to save messages. ([#10881](https://github.com/mastra-ai/mastra/pull/10881))

  **Before:**

  ```ts
  threadObject = await memory.createThread({
    // ...
    saveThread: false, // thread not in DB yet
  });
  // Later: MessageHistory calls saveMessages() -> PostgresStore throws "Thread not found"
  ```

  **After:**

  ```ts
  threadObject = await memory.createThread({
    // ...
    saveThread: true, // thread persisted immediately
  });
  // MessageHistory can now save messages without error
  ```

- Fix network agent not getting `text-delta` from subAgent when `.stream` is used ([#10533](https://github.com/mastra-ai/mastra/pull/10533))

- Fix .map when placed at the beginning of a workflow or nested workflow ([#10457](https://github.com/mastra-ai/mastra/pull/10457))

- Fix various places in core package where we were logging with console.error instead of the mastra logger. ([#11425](https://github.com/mastra-ai/mastra/pull/11425))

- Use input processors that are passed in generate or stream agent options rather than always defaulting to the processors set on the Agent class. ([#9407](https://github.com/mastra-ai/mastra/pull/9407))

- Add `perStep` option to workflow run methods, allowing a workflow to run just a step instead of all the workflow steps ([#11276](https://github.com/mastra-ai/mastra/pull/11276))

- Previously, tool input validation used the original Zod schema while the LLM received a schema-compat transformed version. This caused validation failures when LLMs (like OpenAI o3 or Claude 3.5 Haiku) sent arguments matching the transformed schema but not the original. ([#9258](https://github.com/mastra-ai/mastra/pull/9258))

  For example:
  - OpenAI o3 reasoning models convert `.optional()` to `.nullable()`, sending `null` values
  - Claude 3.5 Haiku strips `min`/`max` string constraints, sending shorter strings
  - Validation would reject these valid responses because it checked against the original schema

  The fix ensures validation uses the same schema-compat processed schema that was sent to the LLM, eliminating this mismatch.

- Improved tracing by filtering infrastructure chunks from model streams and adding success attribute to tool spans. ([#11943](https://github.com/mastra-ai/mastra/pull/11943))

  Added generic input/output attribute mapping for additional span types in Arize exporter.

- Add import for WriteableStream in execution-engine and dedupe llm.getModel in agent.ts ([#9185](https://github.com/mastra-ai/mastra/pull/9185))

- Fix deprecation warning when agent network executes workflows by using `.fullStream` instead of iterating `WorkflowRunOutput` directly ([#10285](https://github.com/mastra-ai/mastra/pull/10285))

- Internal refactor to `MessageList` for improved maintainability and modularity. This change does not affect external APIs or functionality. ([#11658](https://github.com/mastra-ai/mastra/pull/11658))

- Ensures that data chunks written via `writer.custom()` always bubble up directly to the top-level stream, even when nested in sub-agents. This allows tools to emit custom progress updates, metrics, and other data that can be consumed at any level of the agent hierarchy. ([#10309](https://github.com/mastra-ai/mastra/pull/10309))
  - **Added bubbling logic in sub-agent execution**: When sub-agents execute, data chunks (chunks with type starting with `data-`) are detected and written via `writer.custom()` instead of `writer.write()`, ensuring they bubble up directly without being wrapped in `tool-output` chunks.
  - **Added comprehensive tests**:
    - Test for `writer.custom()` with direct tool execution
    - Test for `writer.custom()` with sub-agent tools (nested execution)
    - Test for mixed usage of `writer.write()` and `writer.custom()` in the same tool

  When a sub-agent's tool uses `writer.custom()` to write data chunks, those chunks appear in the sub-agent's stream. The parent agent's execution logic now detects these chunks and uses `writer.custom()` to bubble them up directly, preserving their structure and making them accessible at the top level.

  This ensures that:
  - Data chunks from tools always appear directly in the stream (not wrapped)
  - Data chunks bubble up correctly through nested agent hierarchies
  - Regular chunks continue to be wrapped in `tool-output` as expected

- Emit error chunk and call onError when agent workflow step fails ([#10907](https://github.com/mastra-ai/mastra/pull/10907))

  When a workflow step fails (e.g., tool not found), the error is now properly emitted as an error chunk to the stream and the onError callback is called. This fixes the issue where agent.generate() would throw "promise 'text' was not resolved or rejected" instead of the actual error message.

- Fix discriminatedUnion schema information lost when json schema is converted to zod ([#10500](https://github.com/mastra-ai/mastra/pull/10500))

- `setState` is now async ([#10944](https://github.com/mastra-ai/mastra/pull/10944))
  - `setState` must now be awaited: `await setState({ key: value })`
  - State updates are merged automatically—no need to spread the previous state
  - State data is validated against the step's `stateSchema` when `validateInputs` is enabled (default: `true`)

- Use agent description when converting agent to tool ([#10879](https://github.com/mastra-ai/mastra/pull/10879))

- Fix generate toolResults and mismatch in provider tool names ([#10282](https://github.com/mastra-ai/mastra/pull/10282))

- Adds ability to create custom `MastraModelGateway`'s that can be added to the `Mastra` class instance under the `gateways` property. Giving you typescript autocompletion in any model picker string. ([#10180](https://github.com/mastra-ai/mastra/pull/10180))

  ```typescript
  import { MastraModelGateway, type ProviderConfig } from '@mastra/core/llm';
  import { createOpenAICompatible } from '@ai-sdk/openai-compatible-v5';
  import type { LanguageModelV2 } from '@ai-sdk/provider-v5';

  class MyCustomGateway extends MastraModelGateway {
    readonly id = 'my-custom-gateway';
    readonly name = 'My Custom Gateway';
    readonly prefix = 'custom';

    async fetchProviders(): Promise<Record<string, ProviderConfig>> {
      return {
        'my-provider': {
          name: 'My Provider',
          models: ['model-1', 'model-2'],
          apiKeyEnvVar: 'MY_API_KEY',
          gateway: this.id,
        },
      };
    }

    buildUrl(modelId: string, envVars?: Record<string, string>): string {
      return 'https://api.my-provider.com/v1';
    }

    async getApiKey(modelId: string): Promise<string> {
      const apiKey = process.env.MY_API_KEY;
      if (!apiKey) throw new Error('MY_API_KEY not set');
      return apiKey;
    }

    async resolveLanguageModel({
      modelId,
      providerId,
      apiKey,
    }: {
      modelId: string;
      providerId: string;
      apiKey: string;
    }): Promise<LanguageModelV2> {
      const baseURL = this.buildUrl(`${providerId}/${modelId}`);
      return createOpenAICompatible({
        name: providerId,
        apiKey,
        baseURL,
      }).chatModel(modelId);
    }
  }

  new Mastra({
    gateways: {
      myGateway: new MyCustomGateway(),
    },
  });
  ```

- Support AI SDK voice models ([#10304](https://github.com/mastra-ai/mastra/pull/10304))

  Mastra now supports AI SDK's transcription and speech models directly in `CompositeVoice`, enabling seamless integration with a wide range of voice providers through the AI SDK ecosystem. This allows you to use models from OpenAI, ElevenLabs, Groq, Deepgram, LMNT, Hume, and many more for both speech-to-text (transcription) and text-to-speech capabilities.

  AI SDK models are automatically wrapped when passed to `CompositeVoice`, so you can mix and match AI SDK models with existing Mastra voice providers for maximum flexibility.

  **Usage Example**

  ```typescript
  import { CompositeVoice } from '@mastra/core/voice';
  import { openai } from '@ai-sdk/openai';
  import { elevenlabs } from '@ai-sdk/elevenlabs';

  // Use AI SDK models directly with CompositeVoice
  const voice = new CompositeVoice({
    input: openai.transcription('whisper-1'), // AI SDK transcription model
    output: elevenlabs.speech('eleven_turbo_v2'), // AI SDK speech model
  });

  // Convert text to speech
  const audioStream = await voice.speak('Hello from AI SDK!');

  // Convert speech to text
  const transcript = await voice.listen(audioStream);
  console.log(transcript);
  ```

  Fixes #9947

- Refactor: consolidate duplicate applyMessages helpers in workflow.ts ([#11688](https://github.com/mastra-ai/mastra/pull/11688))
  - Added optional `defaultSource` parameter to `ProcessorRunner.applyMessagesToMessageList` to support both 'input' and 'response' default sources
  - Removed 3 duplicate inline `applyMessages` helper functions from workflow.ts (in input, outputResult, and outputStep phases)
  - All phases now use the shared `ProcessorRunner.applyMessagesToMessageList` static method

  This is an internal refactoring with no changes to external behavior.

- Resolve suspendPayload when tripwire is set off in agentic loop to prevent unresolved promises hanging. ([#11621](https://github.com/mastra-ai/mastra/pull/11621))

- Use a shared `getAllToolPaths()` method from the bundler to discover tool paths. ([#9204](https://github.com/mastra-ai/mastra/pull/9204))

- Add an additional check to determine whether the model natively supports specific file types. Only download the file if the model does not support it natively. ([#9790](https://github.com/mastra-ai/mastra/pull/9790))

- Fix OpenAI reasoning model + memory failing on second generate with "missing item" error ([#11492](https://github.com/mastra-ai/mastra/pull/11492))

  When using OpenAI reasoning models with memory enabled, the second `agent.generate()` call would fail with: "Item 'rs\_...' of type 'reasoning' was provided without its required following item."

  The issue was that `text-start` events contain `providerMetadata` with the text's `itemId` (e.g., `msg_xxx`), but this metadata was not being captured. When memory replayed the conversation, the reasoning part had its `rs_` ID but the text part was missing its `msg_` ID, causing OpenAI to reject the request.

  The fix adds handlers for `text-start` (to capture text providerMetadata) and `text-end` (to clear it and prevent leaking into subsequent parts).

  Fixes #11481

- Update agent workflow and sub-agent tool transformations to accept more input arguments. ([#10278](https://github.com/mastra-ai/mastra/pull/10278))

  These tools now accept the following

  ```ts
  workflowTool.execute({ inputData, initialState }, context);

  agentTool.execute({ prompt, threadId, resourceId, instructions, maxSteps }, context);
  ```

  Workflow tools now also properly return errors when the workflow run fails

  ```ts
  const workflowResult = await workflowTool.execute({ inputData, initialState }, context);

  console.log(workflowResult.error); // error msg if error
  console.log(workflowResult.result); // result of the workflow if success
  ```

  Workflows passed to agents do not properly handle suspend/resume`, they only handle success or error.

- Fixed OpenAI schema compatibility when using `agent.generate()` or `agent.stream()` with `structuredOutput`. ([#10366](https://github.com/mastra-ai/mastra/pull/10366))

  **Changes**
  - **Automatic transformation**: Zod schemas are now automatically transformed for OpenAI strict mode compatibility when using OpenAI models (including reasoning models like o1, o3, o4)
  - **Optional field handling**: `.optional()` fields are converted to `.nullable()` with a transform that converts `null` → `undefined`, preserving optional semantics while satisfying OpenAI's strict mode requirements
  - **Preserves nullable fields**: Intentionally `.nullable()` fields remain unchanged
  - **Deep transformation**: Handles `.optional()` fields at any nesting level (objects, arrays, unions, etc.)
  - **JSON Schema objects**: Not transformed, only Zod schemas

  **Example**

  ```typescript
  const agent = new Agent({
    name: 'data-extractor',
    model: { provider: 'openai', modelId: 'gpt-4o' },
    instructions: 'Extract user information',
  });

  const schema = z.object({
    name: z.string(),
    age: z.number().optional(),
    deletedAt: z.date().nullable(),
  });

  // Schema is automatically transformed for OpenAI compatibility
  const result = await agent.generate('Extract: John, deleted yesterday', {
    structuredOutput: { schema },
  });

  // Result: { name: 'John', age: undefined, deletedAt: null }
  ```

- When a workflow step is resumed, the writer parameter was not being properly passed through, causing writer.custom() calls to fail. This fix ensures the writableStream parameter is correctly passed to both run.resume() and run.start() calls in the workflow execution engine, allowing custom events to be emitted properly during resume operations. ([#10720](https://github.com/mastra-ai/mastra/pull/10720))

- Added support for .streamVNext and .stream that uses it in the inngest execution engine ([#9434](https://github.com/mastra-ai/mastra/pull/9434))

- Fix reasoning content being lost when text-start chunk arrives before reasoning-end ([#11494](https://github.com/mastra-ai/mastra/pull/11494))

  Some model providers (e.g., ZAI/glm-4.6) return streaming chunks where `text-start` arrives before `reasoning-end`. Previously, this would clear the accumulated reasoning deltas, resulting in empty reasoning content in the final message. Now `text-start` is properly excluded from triggering the reasoning state reset, allowing `reasoning-end` to correctly save the reasoning content.

- pass writableStream parameter to workflow execution ([#9139](https://github.com/mastra-ai/mastra/pull/9139))

- Adds native @ai-sdk/deepseek provider support instead of using the OpenAI-compatible fallback. ([#10822](https://github.com/mastra-ai/mastra/pull/10822))

  ```typescript
  const agent = new Agent({
    model: 'deepseek/deepseek-reasoner',
  });

  // With provider options for reasoning
  const response = await agent.generate('Solve this problem', {
    providerOptions: {
      deepseek: {
        thinking: { type: 'enabled' },
      },
    },
  });
  ```

  Also updates the doc generation scripts so DeepSeek provider options show up in the generated docs.

- Fix workflow throwing error when using .map after .foreach ([#11352](https://github.com/mastra-ai/mastra/pull/11352))

- Previously, network execution steps were not being tracked correctly in the AI SDK stream transformation. Steps were being duplicated rather than updated, and critical metadata like step IDs, iterations, and task information was missing or incorrectly structured. ([#10432](https://github.com/mastra-ai/mastra/pull/10432))

  **Changes:**
  - Enhanced step tracking in `AgentNetworkToAISDKTransformer` to properly maintain step state throughout execution lifecycle
  - Steps are now identified by unique IDs and updated in place rather than creating duplicates
  - Added proper iteration and task metadata to each step in the network execution flow
  - Fixed agent, workflow, and tool execution events to correctly populate step data
  - Updated network stream event types to include `networkId`, `workflowId`, and consistent `runId` tracking
  - Added test coverage for network custom data chunks with comprehensive validation

  This ensures the AI SDK correctly represents the full execution flow of agent networks with accurate step sequencing and metadata.

- Add `resumeGenerate` method for resuming agent via generate ([#11503](https://github.com/mastra-ai/mastra/pull/11503))
  Add `runId` and `suspendPayload` to fullOutput of agent stream
  Default `suspendedToolRunId` to empty string to prevent `null` issue

- Remove tools passed to the Routing Agent in .network() ([#9374](https://github.com/mastra-ai/mastra/pull/9374))

- Fix corrupted provider-registry.json file in global cache and regenerate corrupted files ([#10606](https://github.com/mastra-ai/mastra/pull/10606))

- The iteration counter in agent networks was stuck at 0 due to a faulty ternary operator that treated 0 as falsy. This prevented `maxSteps` from working correctly, causing infinite loops when the routing agent kept selecting primitives instead of returning "none". ([#9762](https://github.com/mastra-ai/mastra/pull/9762))

  **Changes:**
  - Fixed iteration counter logic in `loop/network/index.ts` from `(inputData.iteration ? inputData.iteration : -1) + 1` to `(inputData.iteration ?? -1) + 1`
  - Changed initial iteration value from `0` to `-1` so first iteration correctly starts at 0
  - Added `checkIterations()` helper to validate iteration counting in all network tests

  Fixes #9314

- Fixed CachedToken tracking in all Observability Exporters. Also fixed TimeToFirstToken in Langfuse, Braintrust, PostHog exporters. Fixed trace formatting in Posthog Exporter. ([#11029](https://github.com/mastra-ai/mastra/pull/11029))

- Fix generating provider-registry.json ([#10392](https://github.com/mastra-ai/mastra/pull/10392))

- Fix types from ai v4 ([#9818](https://github.com/mastra-ai/mastra/pull/9818))

- Add restart method to workflow run that allows restarting an active workflow run ([#9750](https://github.com/mastra-ai/mastra/pull/9750))
  Add status filter to `listWorkflowRuns`
  Add automatic restart to restart active workflow runs when server starts

- Save correct status in snapshot for all workflow parallel steps. ([#9379](https://github.com/mastra-ai/mastra/pull/9379))
  This ensures when you poll workflow run result using `getWorkflowRunExecutionResult(runId)`, you get the right status for all parallel steps

- Prevent changing workflow status to suspended when some parallel steps are still running ([#9431](https://github.com/mastra-ai/mastra/pull/9431))

- Add ability to pass agent options when wrapping an agent with createStep. This allows configuring agent execution settings when using agents as workflow steps. ([#9199](https://github.com/mastra-ai/mastra/pull/9199))

- Validate schemas by default in workflow. Previously, if you want schemas in the workflow to be validated, you'd have to add `validateInputs` option, now, this will be done by default but can be disabled. ([#10186](https://github.com/mastra-ai/mastra/pull/10186))

  For workflows whose schemas and step schemas you don't want validated, do this

  ```diff
  createWorkflow({
  +  options: {
  +    validateInputs: false
  +  }
  })
  ```

- Fix TypeScript error when using Zod schemas in `defaultOptions.structuredOutput` ([#10710](https://github.com/mastra-ai/mastra/pull/10710))

  Previously, defining `structuredOutput.schema` in `defaultOptions` would cause a TypeScript error because the type only accepted `undefined`. Now any valid `OutputSchema` is correctly accepted.

- Return state too if `includeState: true` is in `outputOptions` and workflow run is not successful ([#10806](https://github.com/mastra-ai/mastra/pull/10806))

- Fix MCP server registration ([#9802](https://github.com/mastra-ai/mastra/pull/9802))

- Fix network loop iteration counter and usage promise handling: ([#9408](https://github.com/mastra-ai/mastra/pull/9408))
  - Fixed iteration counter in network loop that was stuck at 0 due to falsy check. Properly handled zero values to ensure maxSteps is correctly enforced.
  - Fixed usage promise resolution in RunOutput stream by properly resolving or rejecting the promise on stream close, preventing hanging promises when streams complete.

- Fixed migration CLI failing with MIGRATION_REQUIRED error during Mastra import. Added MASTRA_DISABLE_STORAGE_INIT environment variable to skip auto-initialization of storage, allowing the migration command to import user's Mastra config without triggering the migration check. Also improved the migration prompt display to show warning messages before the confirmation dialog. ([#12100](https://github.com/mastra-ai/mastra/pull/12100))

- What changed: ([#10998](https://github.com/mastra-ai/mastra/pull/10998))

  Support for sequential tool execution was added. Tool call concurrency is now set conditionally, defaulting to 1 when sequential execution is needed (to avoid race conditions that interfere with human-in-the-loop approval during the workflow) rather than the default of 10 when concurrency is acceptable.

  How it was changed:

  A `sequentialExecutionRequired` constant was set to a boolean depending on whether any of the tools involved in a returned agentic execution workflow would require approval. If any tool has a 'suspendSchema' property (used for conditionally suspending execution and waiting for human input), or if they have their `requireApproval` property set to `true`, then the concurrency property used in the toolCallStep is set to 1, causing sequential execution. The old default of 10 remains otherwise.

- Fix generateTitle for pre-created threads ([#11771](https://github.com/mastra-ai/mastra/pull/11771))
  - Title generation now works automatically for pre-created threads (via client SDK)
  - When `generateTitle: true` is configured, titles are generated on the first user message
  - Detection is based on message history: if no existing user messages in memory, it's the first message
  - No metadata flags required - works seamlessly with optimistic UI patterns

  Fixes #11757

- Fix inngest parallel workflow ([#10169](https://github.com/mastra-ai/mastra/pull/10169))
  Fix tool as step in inngest
  Fix inngest nested workflow

- Adds thread cloning to create independent copies of conversations that can diverge. ([#11517](https://github.com/mastra-ai/mastra/pull/11517))

  ```typescript
  // Clone a thread
  const { thread, clonedMessages } = await memory.cloneThread({
    sourceThreadId: 'thread-123',
    title: 'My Clone',
    options: {
      messageLimit: 10, // optional: only copy last N messages
    },
  });

  // Check if a thread is a clone
  if (memory.isClone(thread)) {
    const source = await memory.getSourceThread(thread.id);
  }

  // List all clones of a thread
  const clones = await memory.listClones('thread-123');
  ```

  Includes:
  - Storage implementations for InMemory, PostgreSQL, LibSQL, Upstash
  - API endpoint: `POST /api/memory/threads/:threadId/clone`
  - Embeddings created for cloned messages (semantic recall)
  - Clone button in playground UI Memory tab

- Exports `convertFullStreamChunkToMastra` from the stream module for AI SDK stream chunk transformations. ([#10911](https://github.com/mastra-ai/mastra/pull/10911))

- Add support for `providerOptions` when defining tools. This allows developers to specify provider-specific configurations (like Anthropic's `cacheControl`) per tool. ([#10649](https://github.com/mastra-ai/mastra/pull/10649))

  ```typescript
  createTool({
    id: 'my-tool',
    providerOptions: {
      anthropic: { cacheControl: { type: 'ephemeral' } },
    },
    // ...
  });
  ```

- Remove `waitForEvent` from workflows. `waitForEvent` is now removed, please use suspend & resume flow instead. See https://mastra.ai/en/docs/workflows/suspend-and-resume for more details on suspend & resume flow. ([#9214](https://github.com/mastra-ai/mastra/pull/9214))

- Fix delayed promises rejecting when stream suspends on tool-call-approval ([#11278](https://github.com/mastra-ai/mastra/pull/11278))

  When a stream ends in suspended state (e.g., requiring tool approval), the delayed promises like `toolResults`, `toolCalls`, `text`, etc. now resolve with partial results instead of rejecting with an error. This allows consumers to access data that was produced before the suspension.

  Also improves generic type inference for `LLMStepResult` and related types throughout the streaming infrastructure.

- Workflow validation zod v4 support ([#9319](https://github.com/mastra-ai/mastra/pull/9319))

- Fixed semantic recall fetching all thread messages instead of only matched ones. ([#11435](https://github.com/mastra-ai/mastra/pull/11435))

  When using `semanticRecall` with `scope: 'thread'`, the processor was incorrectly fetching all messages from the thread instead of just the semantically matched messages with their context. This caused memory to return far more messages than expected when `topK` and `messageRange` were set to small values.

  Fixes #11428

- Improved test description in ModelsDevGateway to clearly reflect the behavior being tested ([#11460](https://github.com/mastra-ai/mastra/pull/11460))

- Add optional `partial` query parameter to `/api/agents` and `/api/workflows` endpoints to return minimal data without schemas, reducing payload size for list views: ([#10886](https://github.com/mastra-ai/mastra/pull/10886))
  - When `partial=true`: tool schemas (inputSchema, outputSchema) are omitted
  - When `partial=true`: workflow steps are replaced with stepCount integer
  - When `partial=true`: workflow root schemas (inputSchema, outputSchema) are omitted
  - Maintains backward compatibility when partial parameter is not provided

  **Server Endpoint Usage**

  ```bash
  # Get partial agent data (no tool schemas)
  GET /api/agents?partial=true

  # Get full agent data (default behavior)
  GET /api/agents

  # Get partial workflow data (stepCount instead of steps, no schemas)
  GET /api/workflows?partial=true

  # Get full workflow data (default behavior)
  GET /api/workflows
  ```

  **Client SDK Usage**

  ```typescript
  import { MastraClient } from '@mastra/client-js';

  const client = new MastraClient({ baseUrl: 'http://localhost:4111' });

  // Get partial agent list (smaller payload)
  const partialAgents = await client.listAgents({ partial: true });

  // Get full agent list with tool schemas
  const fullAgents = await client.listAgents();

  // Get partial workflow list (smaller payload)
  const partialWorkflows = await client.listWorkflows({ partial: true });

  // Get full workflow list with steps and schemas
  const fullWorkflows = await client.listWorkflows();
  ```

- Use memory mock in server tests ([#9486](https://github.com/mastra-ai/mastra/pull/9486))

- Add human-in-the-loop support for workflows used in agent ([#10871](https://github.com/mastra-ai/mastra/pull/10871))

- Real-time span export for Inngest workflow engine ([#11973](https://github.com/mastra-ai/mastra/pull/11973))
  - Spans are now exported immediately when created and ended, instead of being batched at workflow completion
  - Added durable span lifecycle hooks (`createStepSpan`, `endStepSpan`, `errorStepSpan`, `createChildSpan`, `endChildSpan`, `errorChildSpan`) that wrap span operations in Inngest's `step.run()` for memoization
  - Added `rebuildSpan()` method to reconstruct span objects from exported data after Inngest replay
  - Fixed nested workflow step spans missing output data
  - Spans correctly maintain parent-child relationships across Inngest's durable execution boundaries using `tracingIds`

- Fix network routing agent smoothstreaming ([#9247](https://github.com/mastra-ai/mastra/pull/9247))

- Adds type inference for `mastra.get*ById` functions. Only those registered at the top level mastra instance will get inferred. MCP and tool id's do not get inferred yet, those need additional changes. ([#10199](https://github.com/mastra-ai/mastra/pull/10199))

- Cache processor instances in MastraMemory to preserve embedding cache across calls ([#11720](https://github.com/mastra-ai/mastra/pull/11720))
  Fixed issue where getInputProcessors() and getOutputProcessors() created new processor instances on each call, causing the SemanticRecall embedding cache to be discarded. Processor instances (SemanticRecall, WorkingMemory, MessageHistory) are now cached and reused, reducing unnecessary embedding API calls and improving latency.
  Also added cache invalidation when setStorage(), setVector(), or setEmbedder() are called to ensure processors use updated dependencies.
  Fixes #11455

- Bump @ai-sdk/openai from 3.0.0-beta.102 to 3.0.1 ([#11377](https://github.com/mastra-ai/mastra/pull/11377))

- Add timeTravel to workflows. This makes it possible to start a workflow run from a particular step in the workflow ([#9994](https://github.com/mastra-ai/mastra/pull/9994))

  Example code:

  ```ts
  const result = await run.timeTravel({
    step: 'step2',
    inputData: {
      value: 'input',
    },
  });
  ```

- Fixed duplicate assistant messages appearing when using `useChat` with memory enabled. ([#11195](https://github.com/mastra-ai/mastra/pull/11195))

  **What was happening:** When using `useChat` with `chatRoute` and memory, assistant messages were being duplicated in storage after multiple conversation turns. This occurred because the backend-generated message ID wasn't being sent back to `useChat`, causing ID mismatches during deduplication.

  **What changed:**
  - The backend now sends the assistant message ID in the stream's start event, so `useChat` uses the same ID as storage
  - Custom `data-*` parts (from `writer.custom()`) are now preserved when messages contain V5 tool parts

  Fixes #11091

- Fixed sub-agents in `agent.network()` not receiving conversation history. ([#11825](https://github.com/mastra-ai/mastra/pull/11825))

  Sub-agents now have access to previous user messages from the conversation, enabling them to understand context from earlier exchanges. This resolves the issue where sub-agents would respond without knowledge of prior conversation turns.

  Fixes #11468

- Remove format from stream/generate ([#9577](https://github.com/mastra-ai/mastra/pull/9577))

- - Add persistence for custom data chunks (`data-*` parts) emitted via `writer.custom()` in tools ([#10884](https://github.com/mastra-ai/mastra/pull/10884))
  - Data chunks are now saved to message storage so they survive page refreshes
  - Update `@assistant-ui/react` to v0.11.47 with native `DataMessagePart` support
  - Convert `data-*` parts to `DataMessagePart` format (`{ type: 'data', name: string, data: T }`)
  - Update related `@assistant-ui/*` packages for compatibility

- Fix processInputStep so it runs correctly. ([#10909](https://github.com/mastra-ai/mastra/pull/10909))

- Fix agent network working memory tool routing. Memory tools are now included in routing agent instructions but excluded from its direct tool calls, allowing the routing agent to properly route to tool execution steps for memory updates. ([#9428](https://github.com/mastra-ai/mastra/pull/9428))

- Fix working memory zod to json schema conversion to use schema-compat zodtoJsonSchema fn. ([#10391](https://github.com/mastra-ai/mastra/pull/10391))

- Fix TypeScript type narrowing when iterating over typed RequestContext ([#10850](https://github.com/mastra-ai/mastra/pull/10850))

  The `set()` and `get()` methods on a typed `RequestContext` already provide full type safety. However, when iterating with `entries()`, `keys()`, `values()`, or `forEach()`, TypeScript couldn't narrow the value type based on key checks.

  Now it can:

  ```typescript
  const ctx = new RequestContext<{ userId: string; maxTokens: number }>();

  // Direct access:
  const tokens = ctx.get('maxTokens'); // number

  // Iteration now works too:
  for (const [key, value] of ctx.entries()) {
    if (key === 'maxTokens') {
      value.toFixed(0); // TypeScript knows value is number
    }
  }
  ```

- Fixes parallel tool call issue with Gemini 3 Pro by preventing step-start parts from being inserted between consecutive tool parts in the `addStartStepPartsForAIV5` function. This ensures that the AI SDK's `convertToModelMessages` correctly preserves the order of parallel tool calls and maintains the `thought_signature` on the first tool call as required by Gemini's API. ([#10372](https://github.com/mastra-ai/mastra/pull/10372))

- Fixes assets not being downloaded when available ([#10079](https://github.com/mastra-ai/mastra/pull/10079))

- Fixed OpenAI reasoning message merging so distinct reasoning items are no longer dropped when they share a message ID. Prevents downstream errors where a function call is missing its required "reasoning" item. See #9005. ([#10614](https://github.com/mastra-ai/mastra/pull/10614))

- Fix creating system messages from inside processors using processInput. ([#9469](https://github.com/mastra-ai/mastra/pull/9469))

- Fix usage tracking with agent network ([#9226](https://github.com/mastra-ai/mastra/pull/9226))

- Remove unused dependencies ([#10019](https://github.com/mastra-ai/mastra/pull/10019))

- fix(workflows): ensure writer.custom() bubbles up from nested workflows and loops ([#11422](https://github.com/mastra-ai/mastra/pull/11422))

  Previously, when using `writer.custom()` in steps within nested sub-workflows or loops (like `dountil`), the custom data events would not properly bubble up to the top-level workflow stream. This fix ensures that custom events are now correctly propagated through the nested workflow hierarchy without modification, allowing them to be consumed at the top level.

  This brings workflows in line with the existing behavior for agents, where custom data chunks properly bubble up through sub-agent execution.

  **What changed:**
  - Modified the `nestedWatchCb` function in workflow event handling to detect and preserve `data-*` custom events
  - Custom events now bubble up directly without being wrapped or modified
  - Regular workflow events continue to work as before with proper step ID prefixing

  **Example:**

  ```typescript
  const subStep = createStep({
    id: 'subStep',
    execute: async ({ writer }) => {
      await writer.custom({
        type: 'custom-progress',
        data: { status: 'processing' },
      });
      return { result: 'done' };
    },
  });

  const subWorkflow = createWorkflow({ id: 'sub' }).then(subStep).commit();

  const topWorkflow = createWorkflow({ id: 'top' }).then(subWorkflow).commit();

  const run = await topWorkflow.createRun();
  const stream = run.stream({ inputData: {} });

  // Custom events from subStep now properly appear in the top-level stream
  for await (const event of stream) {
    if (event.type === 'custom-progress') {
      console.log(event.data); // { status: 'processing' }
    }
  }
  ```

- Fix message conversion for incomplete client-side tool calls ([#9749](https://github.com/mastra-ai/mastra/pull/9749))

  Fixed handling of `input-available` tool state in `sanitizeV5UIMessages()` to differentiate between two use cases:
  1. **Response messages FROM the LLM**: Keep `input-available` states (tool calls waiting for client-side execution) in `response.messages` for proper message history.
  2. **Prompt messages TO the LLM**: Filter out `input-available` states when sending historical messages back to the LLM, as these incomplete tool calls (without results) cause errors in the OpenAI Responses API.

  The fix adds a `filterIncompleteToolCalls` parameter to control this behavior based on whether messages are being sent to or received from the LLM.

- Fix `runEvals()` to automatically save scores to storage, making them visible in Studio observability. ([#11516](https://github.com/mastra-ai/mastra/pull/11516))

  Previously, `runEvals()` would calculate scores but not persist them to storage, requiring users to manually implement score saving via the `onItemComplete` callback. Scores now automatically save when the target (Agent/Workflow) has an associated Mastra instance with storage configured.

  **What changed:**
  - Scores are now automatically saved to storage after each evaluation run
  - Fixed compatibility with both Agent (`getMastraInstance()`) and Workflow (`.mastra` getter)
  - Saved scores include complete context: `groundTruth` (in `additionalContext`), `requestContext`, `traceId`, and `spanId`
  - Scores are marked with `source: 'TEST'` to distinguish them from live scoring

  **Migration:**
  No action required. The `onItemComplete` workaround for saving scores can be removed if desired, but will continue to work for custom logic.

  **Example:**

  ```typescript
  const result = await runEvals({
    target: mastra.getWorkflow("myWorkflow"),
    data: [{ input: {...}, groundTruth: {...} }],
    scorers: [myScorer],
  });
  // Scores are now automatically saved and visible in Studio!
  ```

- Make suspendPayload optional when calling `suspend()` ([#9926](https://github.com/mastra-ai/mastra/pull/9926))
  Save value returned as `suspendOutput` if user returns data still after calling `suspend()`
  Automatically call `commit()` on uncommitted workflows when registering in Mastra instance
  Show actual suspendPayload on Studio in suspend/resume flow

- Add `initialState` and `outputOptions` to run.stream() call. ([#9238](https://github.com/mastra-ai/mastra/pull/9238))

  Example code

  ```ts
  const run = await workflow.createRunAsync();

  const streamResult = run.stream({
    inputData: {},
    initialState: { value: 'test-state', otherValue: 'test-other-state' },
    outputOptions: { includeState: true },
  });
  ```

  Then the result from the stream will include the final state information

  ```ts
  const executionResult = await streamResult.result;
  console.log(executionResult.state);
  ```

- Fixed double validation bug that prevented Zod transforms from working correctly in tool schemas. ([#11025](https://github.com/mastra-ai/mastra/pull/11025))

  When tools with Zod `.transform()` or `.pipe()` in their `outputSchema` were executed through the Agent pipeline, validation was happening twice - once in Tool.execute() (correct) and again in CoreToolBuilder (incorrect). The second validation received already-transformed data but expected pre-transform data, causing validation errors.

  This fix enables proper use of Zod transforms in both `inputSchema` (for normalizing/cleaning input data) and `outputSchema` (for transforming output data to be LLM-friendly).

- Add visual styles and labels for more workflow node types ([#9777](https://github.com/mastra-ai/mastra/pull/9777))

- Fix autoresume not working fine in useChat ([#11486](https://github.com/mastra-ai/mastra/pull/11486))

- Multiple Processor improvements including: ([#10947](https://github.com/mastra-ai/mastra/pull/10947))
  - Workflows can now return tripwires, they bubble up from agents that return tripwires in a step
  - You can write processors as workflows using the existing Workflow primitive, every processor flow is now a workflow.
  - tripwires that you throw can now return additional information including ability to retry the step
  - New processor method `processOutputStep` added which runs after every step.

  **What's new:**

  **1. Retry mechanism with LLM feedback** - Processors can now request retries with feedback that gets sent back to the LLM:

  ```typescript
  processOutputStep: async ({ text, abort, retryCount }) => {
    if (isLowQuality(text)) {
      abort('Response quality too low', { retry: true, metadata: { score: 0.6 } });
    }
    return [];
  };
  ```

  Configure with `maxProcessorRetries` (default: 3). Rejected steps are preserved in `result.steps[n].tripwire`. Retries are only available in `processOutputStep` and `processInputStep`. It will replay the step with additional context added.

  **2. Workflow orchestration for processors** - Processors can now be composed using workflow primitives:

  ```typescript
  import { createStep, createWorkflow } from '@mastra/core/workflows';
  import {
    ProcessorStepSchema,
  } from '@mastra/core/processors';

  const moderationWorkflow = createWorkflow({ id: 'moderation', inputSchema: ProcessorStepSchema, outputSchema: ProcessorStepSchema })
    .then(createStep(new lengthValidator({...})))
    .parallel([createStep(new piiDetector({...}), createStep(new toxicityChecker({...}))])
    .commit();

  const agent = new Agent({ inputProcessors: [moderationWorkflow] });
  ```

  Every processor array that gets passed to an agent gets added as a workflow
  <img width="614" height="673" alt="image" src="https://github.com/user-attachments/assets/0d79f1fd-8fca-4d86-8b45-22fddea984a8" />

  **3. Extended tripwire API** - `abort()` now accepts options for retry control and typed metadata:

  ```typescript
  abort('reason', { retry: true, metadata: { score: 0.8, category: 'quality' } });
  ```

  **4. New `processOutputStep` method** - Per-step output processing with access to step number, finish reason, tool calls, and retry count.

  **5. Workflow tripwire status** - Workflows now have a `'tripwire'` status distinct from `'failed'`, properly bubbling up processor rejections.

- Updated dependencies [[`b9b7ffd`](https://github.com/mastra-ai/mastra/commit/b9b7ffdad6936a7d50b6b814b5bbe54e19087f66), [`9650cce`](https://github.com/mastra-ai/mastra/commit/9650cce52a1d917ff9114653398e2a0f5c3ba808), [`6833c69`](https://github.com/mastra-ai/mastra/commit/6833c69607418d257750bbcdd84638993d343539), [`dd1c38d`](https://github.com/mastra-ai/mastra/commit/dd1c38d1b75f1b695c27b40d8d9d6ed00d5e0f6f), [`f93e2f5`](https://github.com/mastra-ai/mastra/commit/f93e2f575e775e627e5c1927cefdd72db07858ed), [`d07b568`](https://github.com/mastra-ai/mastra/commit/d07b5687819ea8cb1dffa776d0c1765faf4aa1ae), [`51acef9`](https://github.com/mastra-ai/mastra/commit/51acef95b5977826594fe3ee24475842bd3d5780), [`af56599`](https://github.com/mastra-ai/mastra/commit/af56599d73244ae3bf0d7bcade656410f8ded37b), [`70b300e`](https://github.com/mastra-ai/mastra/commit/70b300ebc631dfc0aa14e61547fef7994adb4ea6), [`f03ae60`](https://github.com/mastra-ai/mastra/commit/f03ae60500fe350c9d828621006cdafe1975fdd8), [`3bf08bf`](https://github.com/mastra-ai/mastra/commit/3bf08bf9c7c73818ac937b5a69d90e205653115f), [`bae33d9`](https://github.com/mastra-ai/mastra/commit/bae33d91a63fbb64d1e80519e1fc1acaed1e9013), [`83d5942`](https://github.com/mastra-ai/mastra/commit/83d5942669ce7bba4a6ca4fd4da697a10eb5ebdc)]:
  - @mastra/schema-compat@1.0.0

## 1.0.0-beta.27

### Patch Changes

- Fixed migration CLI failing with MIGRATION_REQUIRED error during Mastra import. Added MASTRA_DISABLE_STORAGE_INIT environment variable to skip auto-initialization of storage, allowing the migration command to import user's Mastra config without triggering the migration check. Also improved the migration prompt display to show warning messages before the confirmation dialog. ([#12100](https://github.com/mastra-ai/mastra/pull/12100))

## 1.0.0-beta.26

### Major Changes

- Renamed MastraStorage to MastraCompositeStore for better clarity. The old MastraStorage name remains available as a deprecated alias for backward compatibility, but will be removed in a future version. ([#12093](https://github.com/mastra-ai/mastra/pull/12093))

  **Migration:**

  Update your imports and usage:

  ```typescript
  // Before
  import { MastraStorage } from '@mastra/core/storage';

  const storage = new MastraStorage({
    id: 'composite',
    domains: { ... }
  });

  // After
  import { MastraCompositeStore } from '@mastra/core/storage';

  const storage = new MastraCompositeStore({
    id: 'composite',
    domains: { ... }
  });
  ```

  The new name better reflects that this is a composite storage implementation that routes different domains (workflows, traces, messages) to different underlying stores, avoiding confusion with the general "Mastra Storage" concept.

### Patch Changes

- Improve type handling with Zod ([#12091](https://github.com/mastra-ai/mastra/pull/12091))

## 1.0.0-beta.25

### Minor Changes

- Added human-in-the-loop (HITL) tool approval support for `generate()` method. ([#12056](https://github.com/mastra-ai/mastra/pull/12056))

  **Why:** This provides parity between `stream()` and `generate()` for tool approval flows, allowing non-streaming use cases to leverage `requireToolApproval` without needing to switch to streaming.

  Previously, tool approval with `requireToolApproval` only worked with `stream()`. Now you can use the same approval flow with `generate()` for non-streaming use cases.

  **Using tool approval with generate()**

  ```typescript
  const output = await agent.generate('Find user John', {
    requireToolApproval: true,
  });

  // Check if a tool is waiting for approval
  if (output.finishReason === 'suspended') {
    console.log('Tool requires approval:', output.suspendPayload.toolName);

    // Approve the tool call
    const result = await agent.approveToolCallGenerate({
      runId: output.runId,
      toolCallId: output.suspendPayload.toolCallId,
    });

    console.log(result.text);
  }
  ```

  **Declining a tool call**

  ```typescript
  if (output.finishReason === 'suspended') {
    const result = await agent.declineToolCallGenerate({
      runId: output.runId,
      toolCallId: output.suspendPayload.toolCallId,
    });
  }
  ```

  **New methods added:**
  - `agent.approveToolCallGenerate({ runId, toolCallId })` - Approves a pending tool call and returns the complete result
  - `agent.declineToolCallGenerate({ runId, toolCallId })` - Declines a pending tool call and returns the complete result

  **Server routes added:**
  - `POST /api/agents/:agentId/approve-tool-call-generate`
  - `POST /api/agents/:agentId/decline-tool-call-generate`

  The playground UI now also supports tool approval when using generate mode.

- Exported `isProcessorWorkflow` function from @mastra/core/processors. Added `getConfiguredProcessorWorkflows()` method to agents and `listProcessors()` method to the Mastra class for programmatic access to processor information. ([#12059](https://github.com/mastra-ai/mastra/pull/12059))

- Added new `listThreads` method for flexible thread filtering across all storage adapters. ([#11832](https://github.com/mastra-ai/mastra/pull/11832))

  **New Features**
  - Filter threads by `resourceId`, `metadata`, or both (with AND logic for metadata key-value pairs)
  - All filter parameters are optional, allowing you to list all threads or filter as needed
  - Full pagination and sorting support

  **Example Usage**

  ```typescript
  // List all threads
  const allThreads = await memory.listThreads({});

  // Filter by resourceId only
  const userThreads = await memory.listThreads({
    filter: { resourceId: 'user-123' },
  });

  // Filter by metadata only
  const supportThreads = await memory.listThreads({
    filter: { metadata: { category: 'support' } },
  });

  // Filter by both with pagination
  const filteredThreads = await memory.listThreads({
    filter: {
      resourceId: 'user-123',
      metadata: { priority: 'high', status: 'open' },
    },
    orderBy: { field: 'updatedAt', direction: 'DESC' },
    page: 0,
    perPage: 20,
  });
  ```

  **Security Improvements**
  - Added validation to prevent SQL injection via malicious metadata keys
  - Added pagination parameter validation to prevent integer overflow attacks

### Patch Changes

- Fixed agent network mode failing with "Cannot read properties of undefined" error when tools or workflows don't have an `inputSchema` defined. ([#12063](https://github.com/mastra-ai/mastra/pull/12063))
  - **@mastra/core:** Fixed `getRoutingAgent()` to handle tools and workflows without `inputSchema` by providing a default empty schema fallback.
  - **@mastra/schema-compat:** Fixed Zod v4 optional/nullable fields producing invalid JSON schema for OpenAI structured outputs. OpenAI now correctly receives `type: ["string", "null"]` instead of `anyOf` patterns that were rejected with "must have a 'type' key" error.

- Fixed duplicate storage initialization when init() is called explicitly before other methods. The augmentWithInit proxy now tracks when init() is called directly, preventing subsequent method calls from triggering init() again. This resolves the high volume of requests to storage backends (like Turso) during agent streaming with memory enabled. ([#12067](https://github.com/mastra-ai/mastra/pull/12067))

- chore(core): MessageHistory input processor pass resourceId for storage ([#11910](https://github.com/mastra-ai/mastra/pull/11910))

- Updated dependencies [[`6833c69`](https://github.com/mastra-ai/mastra/commit/6833c69607418d257750bbcdd84638993d343539)]:
  - @mastra/schema-compat@1.0.0-beta.8

## 1.0.0-beta.24

### Minor Changes

- Added `flush()` method to `ObservabilityExporter`, `ObservabilityBridge`, and `ObservabilityInstance` interfaces ([#12003](https://github.com/mastra-ai/mastra/pull/12003))

### Patch Changes

- When using agent networks, the routing agent could fail with a cryptic `TypeError: Cannot read properties of undefined` if the generation response was missing or malformed. This made it difficult to diagnose why routing failed. The release now throws a descriptive error with debugging details (response text, finish reason, usage) to help identify the root cause. ([#12028](https://github.com/mastra-ai/mastra/pull/12028))

  Fixes #11749

- Improve error messaging for LLM API errors. When an error originates from an LLM provider (e.g., rate limits, overloaded, auth failures), the console now indicates it's an upstream API error and includes the provider and model information. ([#12022](https://github.com/mastra-ai/mastra/pull/12022))

  Before:

  ```
  ERROR (Mastra): Error in agent stream
      error: { "message": "Overloaded", "type": "overloaded_error" }
  ```

  After:

  ```
  ERROR (Mastra): Upstream LLM API error from anthropic (model: claude-3-opus)
      error: { "message": "Overloaded", "type": "overloaded_error" }
  ```

- Fixed the type of targetResult in the onItemComplete callback for runEvals. The parameter was incorrectly typed as a Promise, but the actual value passed is already resolved. Users no longer need to await targetResult inside their callback. ([#12030](https://github.com/mastra-ai/mastra/pull/12030))

- Updated dependencies [[`f93e2f5`](https://github.com/mastra-ai/mastra/commit/f93e2f575e775e627e5c1927cefdd72db07858ed)]:
  - @mastra/schema-compat@1.0.0-beta.7

## 1.0.0-beta.23

### Patch Changes

- Added `customSpanFormatter` option to exporters for per-exporter span transformation. This allows different formatting per exporter and supports both synchronous and asynchronous operations, including async data enrichment. ([#11985](https://github.com/mastra-ai/mastra/pull/11985))

  **Configuration example:**

  ```ts
  import { DefaultExporter } from '@mastra/observability';
  import { SpanType } from '@mastra/core/observability';
  import type { CustomSpanFormatter } from '@mastra/core/observability';

  // Sync formatter
  const plainTextFormatter: CustomSpanFormatter = span => {
    if (span.type === SpanType.AGENT_RUN && Array.isArray(span.input)) {
      const userMessage = span.input.find(m => m.role === 'user');
      return { ...span, input: userMessage?.content ?? span.input };
    }
    return span;
  };

  // Async formatter for data enrichment
  const enrichmentFormatter: CustomSpanFormatter = async span => {
    const userData = await fetchUserData(span.metadata?.userId);
    return { ...span, metadata: { ...span.metadata, userName: userData.name } };
  };

  const exporter = new DefaultExporter({
    customSpanFormatter: plainTextFormatter,
  });
  ```

  Also added `chainFormatters` utility to combine multiple formatters (supports mixed sync/async):

  ```ts
  import { chainFormatters } from '@mastra/observability';

  const exporter = new BraintrustExporter({
    customSpanFormatter: chainFormatters([syncFormatter, asyncFormatter]),
  });
  ```

- Fix type recursion by importing from 'zod' instead of 'zod/v3' ([#12009](https://github.com/mastra-ai/mastra/pull/12009))

## 1.0.0-beta.22

### Major Changes

- Refactor workflow and tool types to remove Zod-specific constraints ([#11814](https://github.com/mastra-ai/mastra/pull/11814))

  Removed Zod-specific type constraints across all workflow implementations and tool types, replacing them with generic types. This ensures type consistency across default, evented, and inngest workflows while preparing for Zod v4 migration.

  **Workflow Changes:**
  - Removed `z.ZodObject<any>` and `z.ZodType<any>` constraints from all workflow generic types
  - Updated method signatures to use `TInput` and `TState` directly instead of `z.infer<TInput>` and `z.infer<TState>`
  - Aligned conditional types across all workflow implementations using `TInput extends unknown` pattern
  - Fixed `TSteps` generic to properly use `TEngineType` instead of `any`

  **Tool Changes:**
  - Removed Zod schema constraints from `ToolExecutionContext` and related interfaces
  - Simplified type parameters from `TSuspendSchema extends ZodLikeSchema` to `TSuspend` and `TResume`
  - Updated tool execution context types to use generic types

  **Type Utilities:**
  - Refactored type helpers to work with generic schemas instead of Zod-specific types
  - Updated type extraction utilities for better compatibility

  This change maintains backward compatibility while improving type consistency and preparing for Zod v4 support across all affected packages.

- **Breaking Change**: Convert OUTPUT generic from `OutputSchema` constraint to plain generic ([#11741](https://github.com/mastra-ai/mastra/pull/11741))

  This change removes the direct dependency on Zod typings in the public API by converting all `OUTPUT extends OutputSchema` generic constraints to plain `OUTPUT` generics throughout the codebase. This is preparation for moving to a standard schema approach.
  - All generic type parameters previously constrained to `OutputSchema` (e.g., `<OUTPUT extends OutputSchema = undefined>`) are now plain generics with defaults (e.g., `<OUTPUT = undefined>`)
  - Affects all public APIs including `Agent`, `MastraModelOutput`, `AgentExecutionOptions`, and stream/generate methods
  - `InferSchemaOutput<OUTPUT>` replaced with `OUTPUT` throughout
  - `PartialSchemaOutput<OUTPUT>` replaced with `Partial<OUTPUT>`
  - Schema fields now use `NonNullable<OutputSchema<OUTPUT>>` instead of `OUTPUT` directly
  - Added `FullOutput<OUTPUT>` type representing complete output with all fields
  - Added `AgentExecutionOptionsBase<OUTPUT>` type
  - `getFullOutput()` method now returns `Promise<FullOutput<OUTPUT>>`
  - `Agent` class now generic: `Agent<TAgentId, TTools, TOutput>`
  - `agent.generate()` and `agent.stream()` methods have updated signatures
  - `MastraModelOutput<OUTPUT>` no longer requires `OutputSchema` constraint
  - Network route and streaming APIs updated to use plain OUTPUT generic

  **Before:**

  ```typescript
  const output = await agent.generate<z.ZodType>({
    messages: [...],
    structuredOutput: { schema: mySchema }
  });

  **After:**
  const output = await agent.generate<z.infer<typeof mySchema>>({
    messages: [...],
    structuredOutput: { schema: mySchema }
  });
  // Or rely on type inference:
  const output = await agent.generate({
    messages: [...],
    structuredOutput: { schema: mySchema }
  });

  ```

### Minor Changes

- Add context parameter to `idGenerator` to enable deterministic ID generation based on context. ([#10964](https://github.com/mastra-ai/mastra/pull/10964))

  The `idGenerator` function now receives optional context about what type of ID is being generated and from which Mastra primitive. This allows generating IDs that can be shared with external databases.

  ```typescript
  const mastra = new Mastra({
    idGenerator: context => {
      // context.idType: 'thread' | 'message' | 'run' | 'step' | 'generic'
      // context.source: 'agent' | 'workflow' | 'memory'
      // context.entityId: the agent/workflow id
      // context.threadId, context.resourceId, context.role, context.stepType

      if (context?.idType === 'message' && context?.threadId) {
        return `msg-${context.threadId}-${Date.now()}`;
      }
      if (context?.idType === 'run' && context?.source === 'agent') {
        return `run-${context.entityId}-${Date.now()}`;
      }
      return crypto.randomUUID();
    },
  });
  ```

  Existing `idGenerator` functions without parameters continue to work since the context is optional.

  Fixes #8131

- Add `hideInput` and `hideOutput` options to `TracingOptions` for protecting sensitive data in traces. ([#11969](https://github.com/mastra-ai/mastra/pull/11969))

  When set to `true`, these options hide input/output data from all spans in a trace, including child spans. This is useful for protecting sensitive information from being logged to observability platforms.

  ```typescript
  const agent = mastra.getAgent('myAgent');
  await agent.generate('Process this sensitive data', {
    tracingOptions: {
      hideInput: true, // Input will be hidden from all spans
      hideOutput: true, // Output will be hidden from all spans
    },
  });
  ```

  The options can be used independently (hide only input or only output) or together. The settings are propagated to all child spans via `TraceState`, ensuring consistent behavior across the entire trace.

  Fixes #10888

- Removed the deprecated `AISDKV5OutputStream` class from the public API. ([#11845](https://github.com/mastra-ai/mastra/pull/11845))

  **What changed:** The `AISDKV5OutputStream` class is no longer exported from `@mastra/core`. This class was previously used with the `format: 'aisdk'` option, which has already been removed from `.stream()` and `.generate()` methods.

  **Who is affected:** Only users who were directly importing `AISDKV5OutputStream` from `@mastra/core`. If you were using the standard `.stream()` or `.generate()` methods without the `format` option, no changes are needed.

  **Migration:** If you were importing this class directly, switch to using `MastraModelOutput` which provides the same streaming functionality:

  ```typescript
  // Before
  import { AISDKV5OutputStream } from '@mastra/core';

  // After
  import { MastraModelOutput } from '@mastra/core';
  ```

- Changed JSON columns from TEXT to JSONB in `mastra_threads` and `mastra_workflow_snapshot` tables. ([#11853](https://github.com/mastra-ai/mastra/pull/11853))

  **Why this change?**

  These were the last remaining columns storing JSON as TEXT. This change aligns them with other tables that already use JSONB, enabling native JSON operators and improved performance. See [#8978](https://github.com/mastra-ai/mastra/issues/8978) for details.

  **Columns Changed:**
  - `mastra_threads.metadata` - Thread metadata
  - `mastra_workflow_snapshot.snapshot` - Workflow run state

  **PostgreSQL**

  Migration Required - PostgreSQL enforces column types, so existing tables must be migrated. Note: Migration will fail if existing column values contain invalid JSON.

  ```sql
  ALTER TABLE mastra_threads
  ALTER COLUMN metadata TYPE jsonb
  USING metadata::jsonb;

  ALTER TABLE mastra_workflow_snapshot
  ALTER COLUMN snapshot TYPE jsonb
  USING snapshot::jsonb;
  ```

  **LibSQL**

  No Migration Required - LibSQL now uses native SQLite JSONB format (added in SQLite 3.45) for ~3x performance improvement on JSON operations. The changes are fully backwards compatible:
  - Existing TEXT JSON data continues to work
  - New data is stored in binary JSONB format
  - Both formats can coexist in the same table
  - All JSON functions (`json_extract`, etc.) work on both formats

  New installations automatically use JSONB. Existing applications continue to work without any changes.

- Added `TrackingExporter` base class with improved handling for: ([#11870](https://github.com/mastra-ai/mastra/pull/11870))
  - **Out-of-order span processing**: Spans that arrive before their parents are now queued and processed once dependencies are available
  - **Delayed cleanup**: Trace data is retained briefly after spans end to handle late-arriving updates
  - **Memory management**: Configurable limits on pending and total traces to prevent memory leaks

  New configuration options on `TrackingExporterConfig`:
  - `earlyQueueMaxAttempts` - Max retry attempts for queued events (default: 5)
  - `earlyQueueTTLMs` - TTL for queued events in ms (default: 30000)
  - `traceCleanupDelayMs` - Delay before cleaning up completed traces (default: 30000)
  - `maxPendingCleanupTraces` - Soft cap on traces awaiting cleanup (default: 100)
  - `maxTotalTraces` - Hard cap on total traces (default: 500)

  Updated @mastra/braintrust, @mastra/langfuse, @mastra/langsmith, @mastra/posthog to use the new TrackingExporter

- Add MCP tool annotations and metadata support to `ToolAction` and `Tool` ([#11841](https://github.com/mastra-ai/mastra/pull/11841))

  Tools can now surface UI hints like `title`, `readOnlyHint`, `destructiveHint`, `idempotentHint`, and `openWorldHint` via the `mcp.annotations` field, and pass arbitrary metadata to MCP clients via `mcp._meta`. These MCP-specific properties are grouped under the `mcp` property to clearly indicate they only apply when tools are exposed via MCP.

  ```typescript
  import { createTool } from '@mastra/core/tools';

  const myTool = createTool({
    id: 'weather',
    description: 'Get weather for a location',
    mcp: {
      annotations: {
        title: 'Weather Lookup',
        readOnlyHint: true,
        destructiveHint: false,
      },
      _meta: { version: '1.0.0' },
    },
    execute: async ({ location }) => fetchWeather(location),
  });
  ```

### Patch Changes

- Fix dimension mismatch error when switching embedders in SemanticRecall. The processor now properly validates vector index dimensions when an index already exists, preventing runtime errors when switching between embedders with different dimensions (e.g., fastembed 384 dims → OpenAI 1536 dims). ([#11893](https://github.com/mastra-ai/mastra/pull/11893))

- Removes the deprecated `threadId` and `resourceId` options from `AgentExecutionOptions`. These have been deprecated for months in favour of the `memory` option. ([#11897](https://github.com/mastra-ai/mastra/pull/11897))

  ### Breaking Changes

  #### `@mastra/core`

  The `threadId` and `resourceId` options have been removed from `agent.generate()` and `agent.stream()`. Use the `memory` option instead:

  ```ts
  // Before
  await agent.stream('Hello', {
    threadId: 'thread-123',
    resourceId: 'user-456',
  });

  // After
  await agent.stream('Hello', {
    memory: {
      thread: 'thread-123',
      resource: 'user-456',
    },
  });
  ```

  #### `@mastra/server`

  The `threadId`, `resourceId`, and `resourceid` fields have been removed from the main agent execution body schema. The server now expects the `memory` option format in request bodies. Legacy routes (`/api/agents/:agentId/generate-legacy` and `/api/agents/:agentId/stream-legacy`) continue to support the deprecated fields.

  #### `@mastra/react`

  The `useChat` hook now internally converts `threadId` to the `memory` option format when making API calls. No changes needed in component code - the hook handles the conversion automatically.

  #### `@mastra/client-js`

  When using the client SDK agent methods, use the `memory` option instead of `threadId`/`resourceId`:

  ```ts
  const agent = client.getAgent('my-agent');

  // Before
  await agent.generate({
    messages: [...],
    threadId: 'thread-123',
    resourceId: 'user-456',
  });

  // After
  await agent.generate({
    messages: [...],
    memory: {
      thread: 'thread-123',
      resource: 'user-456',
    },
  });
  ```

- Add human-in-the-loop (HITL) support to agent networks ([#11678](https://github.com/mastra-ai/mastra/pull/11678))
  - Add suspend/resume capabilities to agent network
  - Enable auto-resume for suspended network execution via `autoResumeSuspendedTools`

  `agent.resumeNetwork`, `agent.approveNetworkToolCall`, `agent.declineNetworkToolCall`

- Fixed AI SDK v6 provider tools (like `openai.tools.webSearch()`) not being invoked correctly. These tools are now properly recognized and executed instead of causing failures or hallucinated tool calls. ([#11946](https://github.com/mastra-ai/mastra/pull/11946))

  Resolves `#11781`.

- Fixed `TokenLimiterProcessor` not filtering memory messages when limiting tokens. ([#11941](https://github.com/mastra-ai/mastra/pull/11941))

  Previously, the processor only received the latest user input messages, missing the conversation history from memory. This meant token limiting couldn't filter historical messages to fit within the context window.

  The processor now correctly:
  - Accesses all messages (memory + input) when calculating token budgets
  - Accounts for system messages in the token budget
  - Filters older messages to prioritize recent conversation context

  Fixes #11902

- Fix crash in `mastraDBMessageToAIV4UIMessage` when `content.parts` is undefined or null. ([#11550](https://github.com/mastra-ai/mastra/pull/11550))

  This resolves an issue where `ModerationProcessor` (and other code paths using `MessageList.get.*.ui()`) would throw `TypeError: Cannot read properties of undefined (reading 'length')` when processing messages with missing `parts` array. This commonly occurred when using AI SDK v4 (LanguageModelV1) models with input/output processors.

  The fix adds null coalescing (`?? []`) to safely handle undefined/null `parts` in the message conversion method.

- Improved TypeScript type inference for workflow steps. ([#11953](https://github.com/mastra-ai/mastra/pull/11953))

  **What changed:**
  - Step input/output type mismatches are now caught at compile time when chaining steps with `.then()`
  - The `execute` function now properly infers types from `inputSchema`, `outputSchema`, `stateSchema`, and other schema parameters
  - Clearer error messages when step types don't match workflow requirements

  **Why:**
  Previously, type errors in workflow step chains would only surface at runtime. Now TypeScript validates that each step's input requirements are satisfied by the previous step's output, helping you catch integration issues earlier in development.

- Add `response` to finish chunk payload for output processor metadata access ([#11549](https://github.com/mastra-ai/mastra/pull/11549))

  When using output processors with streaming, metadata added via `processOutputResult` is now accessible in the finish chunk's `payload.response.uiMessages`. This allows clients consuming streams over HTTP (e.g., via `/stream/ui`) to access processor-added metadata.

  ```typescript
  for await (const chunk of stream.fullStream) {
    if (chunk.type === 'finish') {
      const uiMessages = chunk.payload.response?.uiMessages;
      const metadata = uiMessages?.find(m => m.role === 'assistant')?.metadata;
    }
  }
  ```

  Fixes #11454

- Fixed formatting of model_step, model_chunk, and tool_call spans in Arize Exporter. ([#11922](https://github.com/mastra-ai/mastra/pull/11922))

  Also removed `tools` output from `model_step` spans for all exporters.

- Improved tracing by filtering infrastructure chunks from model streams and adding success attribute to tool spans. ([#11943](https://github.com/mastra-ai/mastra/pull/11943))

  Added generic input/output attribute mapping for additional span types in Arize exporter.

- Fix generateTitle for pre-created threads ([#11771](https://github.com/mastra-ai/mastra/pull/11771))
  - Title generation now works automatically for pre-created threads (via client SDK)
  - When `generateTitle: true` is configured, titles are generated on the first user message
  - Detection is based on message history: if no existing user messages in memory, it's the first message
  - No metadata flags required - works seamlessly with optimistic UI patterns

  Fixes #11757

- Real-time span export for Inngest workflow engine ([#11973](https://github.com/mastra-ai/mastra/pull/11973))
  - Spans are now exported immediately when created and ended, instead of being batched at workflow completion
  - Added durable span lifecycle hooks (`createStepSpan`, `endStepSpan`, `errorStepSpan`, `createChildSpan`, `endChildSpan`, `errorChildSpan`) that wrap span operations in Inngest's `step.run()` for memoization
  - Added `rebuildSpan()` method to reconstruct span objects from exported data after Inngest replay
  - Fixed nested workflow step spans missing output data
  - Spans correctly maintain parent-child relationships across Inngest's durable execution boundaries using `tracingIds`

- Fixed sub-agents in `agent.network()` not receiving conversation history. ([#11825](https://github.com/mastra-ai/mastra/pull/11825))

  Sub-agents now have access to previous user messages from the conversation, enabling them to understand context from earlier exchanges. This resolves the issue where sub-agents would respond without knowledge of prior conversation turns.

  Fixes #11468

- Fix TypeScript type narrowing when iterating over typed RequestContext ([#10850](https://github.com/mastra-ai/mastra/pull/10850))

  The `set()` and `get()` methods on a typed `RequestContext` already provide full type safety. However, when iterating with `entries()`, `keys()`, `values()`, or `forEach()`, TypeScript couldn't narrow the value type based on key checks.

  Now it can:

  ```typescript
  const ctx = new RequestContext<{ userId: string; maxTokens: number }>();

  // Direct access:
  const tokens = ctx.get('maxTokens'); // number

  // Iteration now works too:
  for (const [key, value] of ctx.entries()) {
    if (key === 'maxTokens') {
      value.toFixed(0); // TypeScript knows value is number
    }
  }
  ```

## 1.0.0-beta.21

### Minor Changes

- Add structured output support to agent.network() method. Users can now pass a `structuredOutput` option with a Zod schema to get typed results from network execution. ([#11701](https://github.com/mastra-ai/mastra/pull/11701))

  The stream exposes `.object` (Promise) and `.objectStream` (ReadableStream) getters, and emits `network-object` and `network-object-result` chunk types. The structured output is generated after task completion using the provided schema.

  ```typescript
  const stream = await agent.network('Research AI trends', {
    structuredOutput: {
      schema: z.object({
        summary: z.string(),
        recommendations: z.array(z.string()),
      }),
    },
  });

  const result = await stream.object;
  // result is typed: { summary: string; recommendations: string[] }
  ```

### Patch Changes

- dependencies updates: ([#10191](https://github.com/mastra-ai/mastra/pull/10191))
  - Updated dependency [`dotenv@^17.2.3` ↗︎](https://www.npmjs.com/package/dotenv/v/17.2.3) (from `^16.6.1`, in `dependencies`)

- Add additional context to workflow `onFinish` and `onError` callbacks ([#11705](https://github.com/mastra-ai/mastra/pull/11705))

  The `onFinish` and `onError` lifecycle callbacks now receive additional properties:
  - `runId` - The unique identifier for the workflow run
  - `workflowId` - The workflow's identifier
  - `resourceId` - Optional resource identifier (if provided when creating the run)
  - `getInitData()` - Function that returns the initial input data passed to the workflow
  - `mastra` - The Mastra instance (if workflow is registered with Mastra)
  - `requestContext` - Request-scoped context data
  - `logger` - The workflow's logger instance
  - `state` - The workflow's current state object

  ```typescript
  const workflow = createWorkflow({
    id: 'order-processing',
    inputSchema: z.object({ orderId: z.string() }),
    outputSchema: z.object({ status: z.string() }),
    options: {
      onFinish: async ({ runId, workflowId, getInitData, logger, state, mastra }) => {
        const inputData = getInitData();
        logger.info(`Workflow ${workflowId} run ${runId} completed`, {
          orderId: inputData.orderId,
          finalState: state,
        });

        // Access other Mastra components if needed
        const agent = mastra?.getAgent('notification-agent');
      },
      onError: async ({ runId, workflowId, error, logger, requestContext }) => {
        logger.error(`Workflow ${workflowId} run ${runId} failed: ${error?.message}`);
        // Access request context for additional debugging
        const userId = requestContext.get('userId');
      },
    },
  });
  ```

- Make initialState optional in studio ([#11744](https://github.com/mastra-ai/mastra/pull/11744))

- Refactor: consolidate duplicate applyMessages helpers in workflow.ts ([#11688](https://github.com/mastra-ai/mastra/pull/11688))
  - Added optional `defaultSource` parameter to `ProcessorRunner.applyMessagesToMessageList` to support both 'input' and 'response' default sources
  - Removed 3 duplicate inline `applyMessages` helper functions from workflow.ts (in input, outputResult, and outputStep phases)
  - All phases now use the shared `ProcessorRunner.applyMessagesToMessageList` static method

  This is an internal refactoring with no changes to external behavior.

- Cache processor instances in MastraMemory to preserve embedding cache across calls ([#11720](https://github.com/mastra-ai/mastra/pull/11720))
  Fixed issue where getInputProcessors() and getOutputProcessors() created new processor instances on each call, causing the SemanticRecall embedding cache to be discarded. Processor instances (SemanticRecall, WorkingMemory, MessageHistory) are now cached and reused, reducing unnecessary embedding API calls and improving latency.
  Also added cache invalidation when setStorage(), setVector(), or setEmbedder() are called to ensure processors use updated dependencies.
  Fixes #11455
- Updated dependencies [[`3bf08bf`](https://github.com/mastra-ai/mastra/commit/3bf08bf9c7c73818ac937b5a69d90e205653115f)]:
  - @mastra/schema-compat@1.0.0-beta.6

## 1.0.0-beta.20

### Minor Changes

- Deprecate `default: { enabled: true }` observability configuration ([#11674](https://github.com/mastra-ai/mastra/pull/11674))

  The shorthand `default: { enabled: true }` configuration is now deprecated and will be removed in a future version. Users should migrate to explicit configuration with `DefaultExporter`, `CloudExporter`, and `SensitiveDataFilter`.

  **Before (deprecated):**

  ```typescript
  import { Observability } from '@mastra/observability';

  const mastra = new Mastra({
    observability: new Observability({
      default: { enabled: true },
    }),
  });
  ```

  **After (recommended):**

  ```typescript
  import { Observability, DefaultExporter, CloudExporter, SensitiveDataFilter } from '@mastra/observability';

  const mastra = new Mastra({
    observability: new Observability({
      configs: {
        default: {
          serviceName: 'mastra',
          exporters: [new DefaultExporter(), new CloudExporter()],
          spanOutputProcessors: [new SensitiveDataFilter()],
        },
      },
    }),
  });
  ```

  The explicit configuration makes it clear exactly what exporters and processors are being used, improving code readability and maintainability.

  A deprecation warning will be logged when using the old configuration pattern.

- Fix processor tracing to create individual spans per processor ([#11683](https://github.com/mastra-ai/mastra/pull/11683))
  - Processor spans now correctly show processor IDs (e.g., `input processor: validator`) instead of combined workflow IDs
  - Each processor in a chain gets its own trace span, improving observability into processor execution
  - Spans are only created for phases a processor actually implements, eliminating empty spans
  - Internal agent calls within processors now properly nest under their processor span
  - Added `INPUT_STEP_PROCESSOR` and `OUTPUT_STEP_PROCESSOR` entity types for finer-grained tracing
  - Changed `processorType` span attribute to `processorExecutor` with values `'workflow'` or `'legacy'`

- Add completion validation to agent networks using custom scorers ([#11562](https://github.com/mastra-ai/mastra/pull/11562))

  You can now validate whether an agent network has completed its task by passing MastraScorers to `agent.network()`. When validation fails, the network automatically retries with feedback injected into the conversation.

  **Example: Creating a scorer to verify test coverage**

  ```ts
  import { createScorer } from '@mastra/core/evals';
  import { z } from 'zod';

  // Create a scorer that checks if tests were written
  const testsScorer = createScorer({
    id: 'tests-written',
    description: 'Validates that unit tests were included in the response',
    type: 'agent',
  }).generateScore({
    description: 'Return 1 if tests are present, 0 if missing',
    outputSchema: z.number(),
    createPrompt: ({ run }) => `
      Does this response include unit tests?
      Response: ${run.output}
      Return 1 if tests are present, 0 if not.
    `,
  });

  // Use the scorer with agent.network()
  const stream = await agent.network('Implement a fibonacci function with tests', {
    completion: {
      scorers: [testsScorer],
      strategy: 'all', // all scorers must pass (score >= 0.5)
    },
    maxSteps: 3,
  });
  ```

  **What this enables:**
  - **Programmatic completion checks**: Define objective criteria for task completion instead of relying on the default LLM-based check
  - **Automatic retry with feedback**: When a scorer returns `score: 0`, its reason is injected into the conversation so the network can address the gap on the next iteration
  - **Composable validation**: Combine multiple scorers with `strategy: 'all'` (all must pass) or `strategy: 'any'` (at least one must pass)

  This replaces guesswork with reliable, repeatable validation that ensures agent networks produce outputs meeting your specific requirements.

- Unified `getWorkflowRunById` and `getWorkflowRunExecutionResult` into a single API that returns `WorkflowState` with both metadata and execution state. ([#11429](https://github.com/mastra-ai/mastra/pull/11429))

  **What changed:**
  - `getWorkflowRunById` now returns a unified `WorkflowState` object containing metadata (runId, workflowName, resourceId, createdAt, updatedAt) along with processed execution state (status, result, error, payload, steps)
  - Added optional `fields` parameter to request only specific fields for better performance
  - Added optional `withNestedWorkflows` parameter to control nested workflow step inclusion
  - Removed `getWorkflowRunExecutionResult` - use `getWorkflowRunById` instead (breaking change)
  - Removed `/execution-result` API endpoints from server (breaking change)
  - Removed `runExecutionResult()` method from client SDK (breaking change)
  - Removed `GetWorkflowRunExecutionResultResponse` type from client SDK (breaking change)

  **Before:**

  ```typescript
  // Had to call two different methods for different data
  const run = await workflow.getWorkflowRunById(runId); // Returns raw WorkflowRun with snapshot
  const result = await workflow.getWorkflowRunExecutionResult(runId); // Returns processed execution state
  ```

  **After:**

  ```typescript
  // Single method returns everything
  const run = await workflow.getWorkflowRunById(runId);
  // Returns: { runId, workflowName, resourceId, createdAt, updatedAt, status, result, error, payload, steps }

  // Request only specific fields for better performance (avoids expensive step fetching)
  const status = await workflow.getWorkflowRunById(runId, { fields: ['status'] });

  // Skip nested workflow steps for faster response
  const run = await workflow.getWorkflowRunById(runId, { withNestedWorkflows: false });
  ```

  **Why:** The previous API required calling two separate methods to get complete workflow run information. This unification simplifies the API surface and gives users control over performance - fetching all steps (especially nested workflows) can be expensive, so the `fields` and `withNestedWorkflows` options let users request only what they need.

### Patch Changes

- dependencies updates: ([#10133](https://github.com/mastra-ai/mastra/pull/10133))
  - Updated dependency [`js-tiktoken@^1.0.21` ↗︎](https://www.npmjs.com/package/js-tiktoken/v/1.0.21) (from `^1.0.20`, in `dependencies`)

- Add embedded documentation support for Mastra packages ([#11472](https://github.com/mastra-ai/mastra/pull/11472))

  Mastra packages now include embedded documentation in the published npm package under `dist/docs/`. This enables coding agents and AI assistants to understand and use the framework by reading documentation directly from `node_modules`.

  Each package includes:
  - **SKILL.md** - Entry point explaining the package's purpose and capabilities
  - **SOURCE_MAP.json** - Machine-readable index mapping exports to types and implementation files
  - **Topic folders** - Conceptual documentation organized by feature area

  Documentation is driven by the `packages` frontmatter field in MDX files, which maps docs to their corresponding packages. CI validation ensures all docs include this field.

- Add support for `retries` and `scorers` parameters across all `createStep` overloads.
  ([#11495](https://github.com/mastra-ai/mastra/pull/11495))

  The `createStep` function now includes support for the `retries` and `scorers` fields across all step creation patterns, enabling step-level retry configuration and AI evaluation support for regular steps, agent-based steps, and tool-based steps.

  ```typescript
  import { init } from '@mastra/inngest';
  import { z } from 'zod';

  const { createStep } = init(inngest);

  // 1. Regular step with retries
  const regularStep = createStep({
    id: 'api-call',
    inputSchema: z.object({ url: z.string() }),
    outputSchema: z.object({ data: z.any() }),
    retries: 3, // ← Will retry up to 3 times on failure
    execute: async ({ inputData }) => {
      const response = await fetch(inputData.url);
      return { data: await response.json() };
    },
  });

  // 2. Agent step with retries and scorers
  const agentStep = createStep(myAgent, {
    retries: 3,
    scorers: [{ id: 'accuracy-scorer', scorer: myAccuracyScorer }],
  });

  // 3. Tool step with retries and scorers
  const toolStep = createStep(myTool, {
    retries: 2,
    scorers: [{ id: 'quality-scorer', scorer: myQualityScorer }],
  });
  ```

  This change ensures API consistency across all `createStep` overloads. All step types now support retry and evaluation configurations.

  This is a non-breaking change - steps without these parameters continue to work exactly as before.

  Fixes #9351

- Remove `streamVNext`, `resumeStreamVNext`, and `observeStreamVNext` methods, call `stream`, `resumeStream` and `observeStream` directly ([#11499](https://github.com/mastra-ai/mastra/pull/11499))

  ```diff
  + const run = await workflow.createRun({ runId: '123' });
  - const stream = await run.streamVNext({ inputData: { ... } });
  + const stream = await run.stream({ inputData: { ... } });
  ```

- Fix workflow tool not executing when requireApproval is true and tool call is approved ([#11538](https://github.com/mastra-ai/mastra/pull/11538))

- **Breaking Change:** `memory.readOnly` has been moved to `memory.options.readOnly` ([#11523](https://github.com/mastra-ai/mastra/pull/11523))

  The `readOnly` option now lives inside `memory.options` alongside other memory configuration like `lastMessages` and `semanticRecall`.

  **Before:**

  ```typescript
  agent.stream('Hello', {
    memory: {
      thread: threadId,
      resource: resourceId,
      readOnly: true,
    },
  });
  ```

  **After:**

  ```typescript
  agent.stream('Hello', {
    memory: {
      thread: threadId,
      resource: resourceId,
      options: {
        readOnly: true,
      },
    },
  });
  ```

  **Migration:** Run the codemod to update your code automatically:

  ```shell
  npx @mastra/codemod@beta v1/memory-readonly-to-options .
  ```

  This also fixes issue #11519 where `readOnly: true` was being ignored and messages were saved to memory anyway.

- Fix agent runs with multiple steps only showing last text chunk in observability tools ([#11672](https://github.com/mastra-ai/mastra/pull/11672))

  When an agent model executes multiple steps and generates multiple text chunks, the onFinish payload was only receiving the text from the last step instead of all accumulated text. This caused observability tools like Braintrust to only display the final text chunk. The fix now correctly concatenates all text chunks from all steps.

- Fix tool input validation destroying non-plain objects ([#11541](https://github.com/mastra-ai/mastra/pull/11541))

  The `convertUndefinedToNull` function in tool input validation was treating all objects as plain objects and recursively processing them. For objects like `Date`, `Map`, `URL`, and class instances, this resulted in empty objects `{}` because they have no enumerable own properties.

  This fix changes the approach to only recurse into plain objects (objects with `Object.prototype` or `null` prototype). All other objects (Date, Map, Set, URL, RegExp, Error, custom class instances, etc.) are now preserved as-is.

  Fixes #11502

- Fixed client-side tool invocations not being stored in memory. Previously, tool invocations with state 'call' were filtered out before persistence, which incorrectly removed client-side tools. Now only streaming intermediate states ('partial-call') are filtered. ([#11630](https://github.com/mastra-ai/mastra/pull/11630))

  Fixed a crash when updating working memory with an empty or null update; existing data is now preserved.

- Fixed memory readOnly option not being respected when agents share a RequestContext. Previously, when output processors were resolved, the readOnly check happened too early - before the agent could set its own MastraMemory context. This caused child agents to inherit their parent's readOnly setting when sharing a RequestContext. ([#11653](https://github.com/mastra-ai/mastra/pull/11653))

  The readOnly check is now only done at execution time in each processor's processOutputResult method, allowing proper isolation.

- Fix network validation not seeing previous iteration results in multi-step tasks ([#11691](https://github.com/mastra-ai/mastra/pull/11691))

  The validation LLM was unable to determine task completion for multi-step tasks because it couldn't see what primitives had already executed. Now includes a compact list of completed primitives in the validation prompt.

- Fix provider-executed tools (like `openai.tools.webSearch()`) not working correctly with AI SDK v6 models. The agent's `generate()` method was ending prematurely with `finishReason: 'tool-calls'` instead of completing with a text response after tool execution. ([#11622](https://github.com/mastra-ai/mastra/pull/11622))

  The issue was that V6 provider tools have `type: 'provider'` while V5 uses `type: 'provider-defined'`. The tool preparation code now detects the model version and uses the correct type.

- Added `startExclusive` and `endExclusive` options to `dateRange` filter for message queries. ([#11479](https://github.com/mastra-ai/mastra/pull/11479))

  **What changed:** The `filter.dateRange` parameter in `listMessages()` and `Memory.recall()` now supports `startExclusive` and `endExclusive` boolean options. When set to `true`, messages with timestamps exactly matching the boundary are excluded from results.

  **Why this matters:** Enables cursor-based pagination for chat applications. When new messages arrive during a session, offset-based pagination can skip or duplicate messages. Using `endExclusive: true` with the oldest message's timestamp as a cursor ensures consistent pagination without gaps or duplicates.

  **Example:**

  ```typescript
  // Get first page
  const page1 = await memory.recall({
    threadId: 'thread-123',
    perPage: 10,
    orderBy: { field: 'createdAt', direction: 'DESC' },
  });

  // Get next page using cursor-based pagination
  const oldestMessage = page1.messages[page1.messages.length - 1];
  const page2 = await memory.recall({
    threadId: 'thread-123',
    perPage: 10,
    orderBy: { field: 'createdAt', direction: 'DESC' },
    filter: {
      dateRange: {
        end: oldestMessage.createdAt,
        endExclusive: true, // Excludes the cursor message
      },
    },
  });
  ```

- fix(core): support LanguageModelV3 in MastraModelGateway.resolveLanguageModel ([#11489](https://github.com/mastra-ai/mastra/pull/11489))

- Fixed agent network not returning text response when routing agent handles requests without delegation. ([#11497](https://github.com/mastra-ai/mastra/pull/11497))

  **What changed:**
  - Agent networks now correctly stream text responses when the routing agent decides to handle a request itself instead of delegating to sub-agents, workflows, or tools
  - Added fallback in transformers to ensure text is always returned even if core events are missing

  **Why this matters:**
  Previously, when using `toAISdkV5Stream` or `networkRoute()` outside of the Mastra Studio UI, no text content was returned when the routing agent handled requests directly. This fix ensures consistent behavior across all API routes.

  Fixes #11219

- Add initial state input to workflow form in studio ([#11560](https://github.com/mastra-ai/mastra/pull/11560))

- Added missing stream types to @mastra/core/stream for better TypeScript support ([#11513](https://github.com/mastra-ai/mastra/pull/11513))

  **New types available:**
  - Chunk types: `ToolCallChunk`, `ToolResultChunk`, `SourceChunk`, `FileChunk`, `ReasoningChunk`
  - Payload types: `ToolCallPayload`, `ToolResultPayload`, `TextDeltaPayload`, `ReasoningDeltaPayload`, `FilePayload`, `SourcePayload`
  - JSON utilities: `JSONValue`, `JSONObject`, `JSONArray` and readonly variants

  These types are now properly exported, enabling full TypeScript IntelliSense when working with streaming data.

- Refactor the MessageList class from ~4000 LOC monolith to ~850 LOC with focused, single-responsibility modules. This improves maintainability, testability, and makes the codebase easier to understand. ([#11658](https://github.com/mastra-ai/mastra/pull/11658))
  - Extract message format adapters (AIV4Adapter, AIV5Adapter) for SDK conversions
  - Extract TypeDetector for centralized message format identification
  - Extract MessageStateManager for tracking message sources and persistence
  - Extract MessageMerger for streaming message merge logic
  - Extract StepContentExtractor for step content extraction
  - Extract CacheKeyGenerator for message deduplication
  - Consolidate provider compatibility utilities (Gemini, Anthropic, OpenAI)

  ```
  message-list/
  ├── message-list.ts        # Main class (~850 LOC, down from ~4000)
  ├── adapters/              # SDK format conversions
  │   ├── AIV4Adapter.ts     # MastraDBMessage <-> AI SDK V4
  │   └── AIV5Adapter.ts     # MastraDBMessage <-> AI SDK V5
  ├── cache/
  │   └── CacheKeyGenerator.ts  # Deduplication keys
  ├── conversion/
  │   ├── input-converter.ts    # Any format -> MastraDBMessage
  │   ├── output-converter.ts   # MastraDBMessage -> SDK formats
  │   ├── step-content.ts       # Step content extraction
  │   └── to-prompt.ts          # LLM prompt formatting
  ├── detection/
  │   └── TypeDetector.ts       # Format identification
  ├── merge/
  │   └── MessageMerger.ts      # Streaming merge logic
  ├── state/
  │   └── MessageStateManager.ts # Source & persistence tracking
  └── utils/
      └── provider-compat.ts    # Provider-specific fixes
  ```

- Resolve suspendPayload when tripwire is set off in agentic loop to prevent unresolved promises hanging. ([#11621](https://github.com/mastra-ai/mastra/pull/11621))

- Fix OpenAI reasoning model + memory failing on second generate with "missing item" error ([#11492](https://github.com/mastra-ai/mastra/pull/11492))

  When using OpenAI reasoning models with memory enabled, the second `agent.generate()` call would fail with: "Item 'rs\_...' of type 'reasoning' was provided without its required following item."

  The issue was that `text-start` events contain `providerMetadata` with the text's `itemId` (e.g., `msg_xxx`), but this metadata was not being captured. When memory replayed the conversation, the reasoning part had its `rs_` ID but the text part was missing its `msg_` ID, causing OpenAI to reject the request.

  The fix adds handlers for `text-start` (to capture text providerMetadata) and `text-end` (to clear it and prevent leaking into subsequent parts).

  Fixes #11481

- Fix reasoning content being lost when text-start chunk arrives before reasoning-end ([#11494](https://github.com/mastra-ai/mastra/pull/11494))

  Some model providers (e.g., ZAI/glm-4.6) return streaming chunks where `text-start` arrives before `reasoning-end`. Previously, this would clear the accumulated reasoning deltas, resulting in empty reasoning content in the final message. Now `text-start` is properly excluded from triggering the reasoning state reset, allowing `reasoning-end` to correctly save the reasoning content.

- Add `resumeGenerate` method for resuming agent via generate ([#11503](https://github.com/mastra-ai/mastra/pull/11503))
  Add `runId` and `suspendPayload` to fullOutput of agent stream
  Default `suspendedToolRunId` to empty string to prevent `null` issue

- Adds thread cloning to create independent copies of conversations that can diverge. ([#11517](https://github.com/mastra-ai/mastra/pull/11517))

  ```typescript
  // Clone a thread
  const { thread, clonedMessages } = await memory.cloneThread({
    sourceThreadId: 'thread-123',
    title: 'My Clone',
    options: {
      messageLimit: 10, // optional: only copy last N messages
    },
  });

  // Check if a thread is a clone
  if (memory.isClone(thread)) {
    const source = await memory.getSourceThread(thread.id);
  }

  // List all clones of a thread
  const clones = await memory.listClones('thread-123');
  ```

  Includes:
  - Storage implementations for InMemory, PostgreSQL, LibSQL, Upstash
  - API endpoint: `POST /api/memory/threads/:threadId/clone`
  - Embeddings created for cloned messages (semantic recall)
  - Clone button in playground UI Memory tab

- Fix `runEvals()` to automatically save scores to storage, making them visible in Studio observability. ([#11516](https://github.com/mastra-ai/mastra/pull/11516))

  Previously, `runEvals()` would calculate scores but not persist them to storage, requiring users to manually implement score saving via the `onItemComplete` callback. Scores now automatically save when the target (Agent/Workflow) has an associated Mastra instance with storage configured.

  **What changed:**
  - Scores are now automatically saved to storage after each evaluation run
  - Fixed compatibility with both Agent (`getMastraInstance()`) and Workflow (`.mastra` getter)
  - Saved scores include complete context: `groundTruth` (in `additionalContext`), `requestContext`, `traceId`, and `spanId`
  - Scores are marked with `source: 'TEST'` to distinguish them from live scoring

  **Migration:**
  No action required. The `onItemComplete` workaround for saving scores can be removed if desired, but will continue to work for custom logic.

  **Example:**

  ```typescript
  const result = await runEvals({
    target: mastra.getWorkflow("myWorkflow"),
    data: [{ input: {...}, groundTruth: {...} }],
    scorers: [myScorer],
  });
  // Scores are now automatically saved and visible in Studio!
  ```

- Fix autoresume not working fine in useChat ([#11486](https://github.com/mastra-ai/mastra/pull/11486))

## 1.0.0-beta.19

### Minor Changes

- Add embedderOptions support to Memory for AI SDK 5+ provider-specific embedding options ([#11462](https://github.com/mastra-ai/mastra/pull/11462))

  With AI SDK 5+, embedding models no longer accept options in their constructor. Options like `outputDimensionality` for Google embedding models must now be passed when calling `embed()` or `embedMany()`. This change adds `embedderOptions` to Memory configuration to enable passing these provider-specific options.

  You can now configure embedder options when creating Memory:

  ```typescript
  import { Memory } from '@mastra/core';
  import { google } from '@ai-sdk/google';

  // Before: No way to specify providerOptions
  const memory = new Memory({
    embedder: google.textEmbeddingModel('text-embedding-004'),
  });

  // After: Pass embedderOptions with providerOptions
  const memory = new Memory({
    embedder: google.textEmbeddingModel('text-embedding-004'),
    embedderOptions: {
      providerOptions: {
        google: {
          outputDimensionality: 768,
          taskType: 'RETRIEVAL_DOCUMENT',
        },
      },
    },
  });
  ```

  This is especially important for:
  - Google `text-embedding-004`: Control output dimensions (default 768)
  - Google `gemini-embedding-001`: Reduce from default 3072 dimensions to avoid pgvector's 2000 dimension limit for HNSW indexes

  Fixes #8248

### Patch Changes

- Fix Anthropic API error when tool calls have empty input objects ([#11474](https://github.com/mastra-ai/mastra/pull/11474))

  Fixes issue #11376 where Anthropic models would fail with error "messages.17.content.2.tool_use.input: Field required" when a tool call in a previous step had an empty object `{}` as input.

  The fix adds proper reconstruction of tool call arguments when converting messages to AIV5 model format. Tool-result parts now correctly include the `input` field from the matching tool call, which is required by Anthropic's API validation.

  Changes:
  - Added `findToolCallArgs()` helper method to search through messages and retrieve original tool call arguments
  - Enhanced `aiV5UIMessagesToAIV5ModelMessages()` to populate the `input` field on tool-result parts
  - Added comprehensive test coverage for empty object inputs, parameterized inputs, and multi-turn conversations

- Fixed an issue where deprecated Groq models were shown during template creation. The model selection now filters out models marked as deprecated, displaying only active and supported models. ([#11445](https://github.com/mastra-ai/mastra/pull/11445))

- Fix AI SDK v6 (specificationVersion: "v3") model support in sub-agent calls. Previously, when a parent agent invoked a sub-agent with a v3 model through the `agents` property, the version check only matched "v2", causing v3 models to incorrectly fall back to legacy streaming methods and throw "V2 models are not supported for streamLegacy" error. ([#11452](https://github.com/mastra-ai/mastra/pull/11452))

  The fix updates version checks in `listAgentTools` and `llm-mapping-step.ts` to use the centralized `supportedLanguageModelSpecifications` array which includes both v2 and v3.

  Also adds missing v3 test coverage to tool-handling.test.ts to prevent regression.

- Fixed "Transforms cannot be represented in JSON Schema" error when using Zod v4 with structuredOutput ([#11466](https://github.com/mastra-ai/mastra/pull/11466))

  When using schemas with `.optional()`, `.nullable()`, `.default()`, or `.nullish().default("")` patterns with `structuredOutput` and Zod v4, users would encounter an error because OpenAI schema compatibility layer adds transforms that Zod v4's native `toJSONSchema()` cannot handle.

  The fix uses Mastra's transform-safe `zodToJsonSchema` function which gracefully handles transforms by using the `unrepresentable: 'any'` option.

  Also exported `isZodType` utility from `@mastra/schema-compat` and updated it to detect both Zod v3 (`_def`) and Zod v4 (`_zod`) schemas.

- Improved test description in ModelsDevGateway to clearly reflect the behavior being tested ([#11460](https://github.com/mastra-ai/mastra/pull/11460))

- Updated dependencies [[`d07b568`](https://github.com/mastra-ai/mastra/commit/d07b5687819ea8cb1dffa776d0c1765faf4aa1ae), [`70b300e`](https://github.com/mastra-ai/mastra/commit/70b300ebc631dfc0aa14e61547fef7994adb4ea6)]:
  - @mastra/schema-compat@1.0.0-beta.5

## 1.0.0-beta.18

### Patch Changes

- Fixed semantic recall fetching all thread messages instead of only matched ones. ([#11435](https://github.com/mastra-ai/mastra/pull/11435))

  When using `semanticRecall` with `scope: 'thread'`, the processor was incorrectly fetching all messages from the thread instead of just the semantically matched messages with their context. This caused memory to return far more messages than expected when `topK` and `messageRange` were set to small values.

  Fixes #11428

## 1.0.0-beta.17

### Patch Changes

- Fix Zod 4 compatibility for storage schema detection ([#11431](https://github.com/mastra-ai/mastra/pull/11431))

  If you're using Zod 4, `buildStorageSchema` was failing to detect nullable and optional fields correctly. This caused `NOT NULL constraint failed` errors when storing observability spans and other data.

  This fix enables proper schema detection for Zod 4 users, ensuring nullable fields like `parentSpanId` are correctly identified and don't cause database constraint violations.

- Updated dependencies [[`af56599`](https://github.com/mastra-ai/mastra/commit/af56599d73244ae3bf0d7bcade656410f8ded37b)]:
  - @mastra/schema-compat@1.0.0-beta.4

## 1.0.0-beta.16

### Minor Changes

- Add `onError` hook to server configuration for custom error handling. ([#11403](https://github.com/mastra-ai/mastra/pull/11403))

  You can now provide a custom error handler through the Mastra server config to catch errors, format responses, or send them to external services like Sentry:

  ```typescript
  import { Mastra } from '@mastra/core/mastra';

  const mastra = new Mastra({
    server: {
      onError: (err, c) => {
        // Send to Sentry
        Sentry.captureException(err);

        // Return custom formatted response
        return c.json(
          {
            error: err.message,
            timestamp: new Date().toISOString(),
          },
          500,
        );
      },
    },
  });
  ```

  If no `onError` is provided, the default error handler is used.

  Fixes #9610

### Patch Changes

- fix(observability): start MODEL_STEP span at beginning of LLM execution ([#11409](https://github.com/mastra-ai/mastra/pull/11409))

  The MODEL_STEP span was being created when the step-start chunk arrived (after the model API call completed), causing the span's startTime to be close to its endTime instead of accurately reflecting when the step began.

  This fix ensures MODEL_STEP spans capture the full duration of each LLM execution step, including the API call latency, by starting the span at the beginning of the step execution rather than when the response starts streaming.

  Fixes #11271

- Fixed inline type narrowing for `tool.execute()` return type when using `outputSchema`. ([#11420](https://github.com/mastra-ai/mastra/pull/11420))

  **Problem:** When calling `tool.execute()`, TypeScript couldn't narrow the `ValidationError | OutputType` union after checking `'error' in result && result.error`, causing type errors when accessing output properties.

  **Solution:**
  - Added `{ error?: never }` to the success type, enabling proper discriminated union narrowing
  - Simplified `createTool` generics so `inputData` is correctly typed based on `inputSchema`

  **Note:** Tool output schemas should not use `error` as a field name since it's reserved for ValidationError discrimination. Use `errorMessage` or similar instead.

  **Usage:**

  ```typescript
  const result = await myTool.execute({ firstName: 'Hans' });

  if ('error' in result && result.error) {
    console.error('Validation failed:', result.message);
    return;
  }

  // ✅ TypeScript now correctly narrows result
  return { fullName: result.fullName };
  ```

- Add support for `instructions` field in MCPServer ([#11421](https://github.com/mastra-ai/mastra/pull/11421))

  Implements the official MCP specification's `instructions` field, which allows MCP servers to provide system-wide prompts that are automatically sent to clients during initialization. This eliminates the need for per-project configuration files (like AGENTS.md) by centralizing the system prompt in the server definition.

  **What's New:**
  - Added `instructions` optional field to `MCPServerConfig` type
  - Instructions are passed to the underlying MCP SDK Server during initialization
  - Instructions are sent to clients in the `InitializeResult` response
  - Fully compatible with all MCP clients (Cursor, Windsurf, Claude Desktop, etc.)

  **Example Usage:**

  ```typescript
  const server = new MCPServer({
    name: 'GitHub MCP Server',
    version: '1.0.0',
    instructions:
      'Use the available tools to help users manage GitHub repositories, issues, and pull requests. Always search before creating to avoid duplicates.',
    tools: { searchIssues, createIssue, listPRs },
  });
  ```

- Add storage composition to MastraStorage ([#11401](https://github.com/mastra-ai/mastra/pull/11401))

  `MastraStorage` can now compose storage domains from different adapters. Use it when you need different databases for different purposes - for example, PostgreSQL for memory and workflows, but a different database for observability.

  ```typescript
  import { MastraStorage } from '@mastra/core/storage';
  import { MemoryPG, WorkflowsPG, ScoresPG } from '@mastra/pg';
  import { MemoryLibSQL } from '@mastra/libsql';

  // Compose domains from different stores
  const storage = new MastraStorage({
    id: 'composite',
    domains: {
      memory: new MemoryLibSQL({ url: 'file:./local.db' }),
      workflows: new WorkflowsPG({ connectionString: process.env.DATABASE_URL }),
      scores: new ScoresPG({ connectionString: process.env.DATABASE_URL }),
    },
  });
  ```

  **Breaking changes:**
  - `storage.supports` property no longer exists
  - `StorageSupports` type is no longer exported from `@mastra/core/storage`

  All stores now support the same features. For domain availability, use `getStore()`:

  ```typescript
  const store = await storage.getStore('memory');
  if (store) {
    // domain is available
  }
  ```

- Fix various places in core package where we were logging with console.error instead of the mastra logger. ([#11425](https://github.com/mastra-ai/mastra/pull/11425))

- fix(workflows): ensure writer.custom() bubbles up from nested workflows and loops ([#11422](https://github.com/mastra-ai/mastra/pull/11422))

  Previously, when using `writer.custom()` in steps within nested sub-workflows or loops (like `dountil`), the custom data events would not properly bubble up to the top-level workflow stream. This fix ensures that custom events are now correctly propagated through the nested workflow hierarchy without modification, allowing them to be consumed at the top level.

  This brings workflows in line with the existing behavior for agents, where custom data chunks properly bubble up through sub-agent execution.

  **What changed:**
  - Modified the `nestedWatchCb` function in workflow event handling to detect and preserve `data-*` custom events
  - Custom events now bubble up directly without being wrapped or modified
  - Regular workflow events continue to work as before with proper step ID prefixing

  **Example:**

  ```typescript
  const subStep = createStep({
    id: 'subStep',
    execute: async ({ writer }) => {
      await writer.custom({
        type: 'custom-progress',
        data: { status: 'processing' },
      });
      return { result: 'done' };
    },
  });

  const subWorkflow = createWorkflow({ id: 'sub' }).then(subStep).commit();

  const topWorkflow = createWorkflow({ id: 'top' }).then(subWorkflow).commit();

  const run = await topWorkflow.createRun();
  const stream = run.stream({ inputData: {} });

  // Custom events from subStep now properly appear in the top-level stream
  for await (const event of stream) {
    if (event.type === 'custom-progress') {
      console.log(event.data); // { status: 'processing' }
    }
  }
  ```

## 1.0.0-beta.15

### Minor Changes

- Introduce StorageDomain base class for composite storage support ([#11249](https://github.com/mastra-ai/mastra/pull/11249))

  Storage adapters now use a domain-based architecture where each domain (memory, workflows, scores, observability, agents) extends a `StorageDomain` base class with `init()` and `dangerouslyClearAll()` methods.

  **Key changes:**
  - Add `StorageDomain` abstract base class that all domain storage classes extend
  - Add `InMemoryDB` class for shared state across in-memory domain implementations
  - All storage domains now implement `dangerouslyClearAll()` for test cleanup
  - Remove `operations` from public `StorageDomains` type (now internal to each adapter)
  - Add flexible client/config patterns - domains accept either an existing database client or config to create one internally

  **Why this matters:**

  This enables composite storage where you can use different database adapters per domain:

  ```typescript
  import { Mastra } from '@mastra/core';
  import { PostgresStore } from '@mastra/pg';
  import { ClickhouseStore } from '@mastra/clickhouse';

  // Use Postgres for most domains but Clickhouse for observability
  const mastra = new Mastra({
    storage: new PostgresStore({
      connectionString: 'postgres://...',
    }),
    // Future: override specific domains
    // observability: new ClickhouseStore({ ... }).getStore('observability'),
  });
  ```

  **Standalone domain usage:**

  Domains can now be used independently with flexible configuration:

  ```typescript
  import { MemoryLibSQL } from '@mastra/libsql/memory';

  // Option 1: Pass config to create client internally
  const memory = new MemoryLibSQL({
    url: 'file:./local.db',
  });

  // Option 2: Pass existing client for shared connections
  import { createClient } from '@libsql/client';
  const client = createClient({ url: 'file:./local.db' });
  const memory = new MemoryLibSQL({ client });
  ```

  **Breaking changes:**
  - `StorageDomains` type no longer includes `operations` - access via `getStore()` instead
  - Domain base classes now require implementing `dangerouslyClearAll()` method

- Refactor storage architecture to use domain-specific stores via `getStore()` pattern ([#11361](https://github.com/mastra-ai/mastra/pull/11361))

  ### Summary

  This release introduces a new storage architecture that replaces passthrough methods on `MastraStorage` with domain-specific storage interfaces accessed via `getStore()`. This change reduces code duplication across storage adapters and provides a cleaner, more modular API.

  ### Migration Guide

  All direct method calls on storage instances should be updated to use `getStore()`:

  ```typescript
  // Before
  const thread = await storage.getThreadById({ threadId });
  await storage.persistWorkflowSnapshot({ workflowName, runId, snapshot });
  await storage.createSpan(span);

  // After
  const memory = await storage.getStore('memory');
  const thread = await memory?.getThreadById({ threadId });

  const workflows = await storage.getStore('workflows');
  await workflows?.persistWorkflowSnapshot({ workflowName, runId, snapshot });

  const observability = await storage.getStore('observability');
  await observability?.createSpan(span);
  ```

  ### Available Domains
  - **`memory`**: Thread and message operations (`getThreadById`, `saveThread`, `saveMessages`, etc.)
  - **`workflows`**: Workflow state persistence (`persistWorkflowSnapshot`, `loadWorkflowSnapshot`, `getWorkflowRunById`, etc.)
  - **`scores`**: Evaluation scores (`saveScore`, `listScoresByScorerId`, etc.)
  - **`observability`**: Tracing and spans (`createSpan`, `updateSpan`, `getTrace`, etc.)
  - **`agents`**: Stored agent configurations (`createAgent`, `getAgentById`, `listAgents`, etc.)

  ### Breaking Changes
  - Passthrough methods have been removed from `MastraStorage` base class
  - All storage adapters now require accessing domains via `getStore()`
  - The `stores` property on storage instances is now the canonical way to access domain storage

  ### Internal Changes
  - Each storage adapter now initializes domain-specific stores in its constructor
  - Domain stores share database connections and handle their own table initialization

- Add support for AI SDK v6 ToolLoopAgent in Mastra ([#11254](https://github.com/mastra-ai/mastra/pull/11254))

  You can now pass an AI SDK v6 `ToolLoopAgent` directly to Mastra's agents configuration. The agent will be automatically converted to a Mastra Agent while preserving all ToolLoopAgent lifecycle hooks:
  - `prepareCall` - Called once at the start of generate/stream
  - `prepareStep` - Called before each step in the agentic loop
  - `stopWhen` - Custom stop conditions for the loop

  Example:

  ```typescript
  import { ToolLoopAgent } from 'ai';
  import { Mastra } from '@mastra/core/mastra';

  const toolLoopAgent = new ToolLoopAgent({
    model: openai('gpt-4o'),
    instructions: 'You are a helpful assistant.',
    tools: { weather: weatherTool },
    prepareStep: async ({ stepNumber }) => {
      if (stepNumber === 0) {
        return { toolChoice: 'required' };
      }
    },
  });

  const mastra = new Mastra({
    agents: { toolLoopAgent },
  });

  // Use like any other Mastra agent
  const agent = mastra.getAgent('toolLoopAgent');
  const result = await agent.generate('What is the weather?');
  ```

- Unified observability schema with entity-based span identification ([#11132](https://github.com/mastra-ai/mastra/pull/11132))

  ## What changed

  Spans now use a unified identification model with `entityId`, `entityType`, and `entityName` instead of separate `agentId`, `toolId`, `workflowId` fields.

  **Before:**

  ```typescript
  // Old span structure
  span.agentId; // 'my-agent'
  span.toolId; // undefined
  span.workflowId; // undefined
  ```

  **After:**

  ```typescript
  // New span structure
  span.entityType; // EntityType.AGENT
  span.entityId; // 'my-agent'
  span.entityName; // 'My Agent'
  ```

  ## New `listTraces()` API

  Query traces with filtering, pagination, and sorting:

  ```typescript
  const { spans, pagination } = await storage.listTraces({
    filters: {
      entityType: EntityType.AGENT,
      entityId: 'my-agent',
      userId: 'user-123',
      environment: 'production',
      status: TraceStatus.SUCCESS,
      startedAt: { start: new Date('2024-01-01'), end: new Date('2024-01-31') },
    },
    pagination: { page: 0, perPage: 50 },
    orderBy: { field: 'startedAt', direction: 'DESC' },
  });
  ```

  **Available filters:** date ranges (`startedAt`, `endedAt`), entity (`entityType`, `entityId`, `entityName`), identity (`userId`, `organizationId`), correlation IDs (`runId`, `sessionId`, `threadId`), deployment (`environment`, `source`, `serviceName`), `tags`, `metadata`, and `status`.

  ## New retrieval methods
  - `getSpan({ traceId, spanId })` - Get a single span
  - `getRootSpan({ traceId })` - Get the root span of a trace
  - `getTrace({ traceId })` - Get all spans for a trace

  ## Backward compatibility

  The legacy `getTraces()` method continues to work. When you pass `name: "agent run: my-agent"`, it automatically transforms to `entityId: "my-agent", entityType: AGENT`.

  ## Migration

  **Automatic:** SQL-based stores (PostgreSQL, LibSQL, MSSQL) automatically add new columns to existing `spans` tables on initialization. Existing data is preserved with new columns set to `NULL`.

  **No action required:** Your existing code continues to work. Adopt the new fields and `listTraces()` API at your convenience.

### Patch Changes

- When calling `abort()` inside a `processInputStep` processor, the TripWire was being caught by the model retry logic instead of emitting a tripwire chunk to the stream. ([#11343](https://github.com/mastra-ai/mastra/pull/11343))

  Before this fix, processors using `processInputStep` with abort would see errors like:

  ```
  Error executing model gpt-4o-mini, attempt 1==== TripWire [Error]: Potentially harmful content detected
  ```

  Now the TripWire is properly handled - it emits a tripwire chunk and signals the abort correctly,

- Consolidate memory integration tests and fix working memory filtering in MessageHistory processor ([#11367](https://github.com/mastra-ai/mastra/pull/11367))

  Moved `extractWorkingMemoryTags`, `removeWorkingMemoryTags`, and `extractWorkingMemoryContent` utilities from `@mastra/memory` to `@mastra/core/memory` so they can be used by the `MessageHistory` processor.

  Updated `MessageHistory.filterMessagesForPersistence()` to properly filter out `updateWorkingMemory` tool invocations and strip working memory tags from text content, fixing an issue where working memory tool call arguments were polluting saved message history for v5+ models.

  Also consolidated integration tests for agent-memory, working-memory, and pg-storage into shared test functions that can run against multiple model versions (v4, v5, v6).

- Add support for AI SDK's `needsApproval` in tools. ([#11388](https://github.com/mastra-ai/mastra/pull/11388))

  **AI SDK tools with static approval:**

  ```typescript
  import { tool } from 'ai';
  import { z } from 'zod';

  const weatherTool = tool({
    description: 'Get weather information',
    inputSchema: z.object({ city: z.string() }),
    needsApproval: true,
    execute: async ({ city }) => {
      return { weather: 'sunny', temp: 72 };
    },
  });
  ```

  **AI SDK tools with dynamic approval:**

  ```typescript
  const paymentTool = tool({
    description: 'Process payment',
    inputSchema: z.object({ amount: z.number() }),
    needsApproval: async ({ amount }) => amount > 1000,
    execute: async ({ amount }) => {
      return { success: true, amount };
    },
  });
  ```

  **Mastra tools continue to work with `requireApproval`:**

  ```typescript
  import { createTool } from '@mastra/core';

  const deleteTool = createTool({
    id: 'delete-file',
    description: 'Delete a file',
    requireApproval: true,
    inputSchema: z.object({ path: z.string() }),
    execute: async ({ path }) => {
      return { deleted: true };
    },
  });
  ```

- Fix stopWhen type to accept AI SDK v6 StopCondition functions like `stepCountIs()` ([#11402](https://github.com/mastra-ai/mastra/pull/11402))

- Fix missing `title` field in Convex threads table schema ([#11356](https://github.com/mastra-ai/mastra/pull/11356))

  The Convex schema was hardcoded and out of sync with the core `TABLE_SCHEMAS`, causing errors when creating threads:

  ```
  Error: Failed to insert or update a document in table "mastra_threads"
  because it does not match the schema: Object contains extra field `title`
  that is not in the validator.
  ```

  Now the Convex schema dynamically builds from `TABLE_SCHEMAS` via a new `@mastra/core/storage/constants` export path that doesn't pull in Node.js dependencies (safe for Convex's sandboxed schema evaluation).

  ```typescript
  // Users can now import schema tables without Node.js dependency issues
  import { mastraThreadsTable, mastraMessagesTable } from '@mastra/convex/schema';

  export default defineSchema({
    mastra_threads: mastraThreadsTable,
    mastra_messages: mastraMessagesTable,
  });
  ```

  Fixes #11319

- Added support for AI SDK v6 embedding models (specification version v3) in memory and vector modules. Fixed TypeScript error where `ModelRouterEmbeddingModel` was trying to implement a union type instead of `EmbeddingModelV2` directly. ([#11362](https://github.com/mastra-ai/mastra/pull/11362))

- fix: support gs:// and s3:// cloud storage URLs in attachmentsToParts ([#11398](https://github.com/mastra-ai/mastra/pull/11398))

- Add validation to detect when a function is passed as a tool instead of a tool object. Previously, passing a tool factory function (e.g., `tools: { myTool }` instead of `tools: { myTool: myTool() }`) would silently fail - the LLM would request tool calls but nothing would execute. Now throws a clear error with guidance on how to fix it. ([#11288](https://github.com/mastra-ai/mastra/pull/11288))

- Fix reasoning providerMetadata leaking into text parts when using memory with OpenAI reasoning models. The runState.providerOptions is now cleared after reasoning-end to prevent text parts from inheriting the reasoning's itemId. ([#11380](https://github.com/mastra-ai/mastra/pull/11380))

- Upgrade AI SDK v6 from beta to stable (6.0.1) and fix finishReason breaking change. ([#11351](https://github.com/mastra-ai/mastra/pull/11351))

  AI SDK v6 stable changed finishReason from a string to an object with `unified` and `raw` properties. Added `normalizeFinishReason()` helper to handle both v5 (string) and v6 (object) formats at the stream transform layer

- Improve autoResumeSuspendedTools instruction for tool approval ([#11338](https://github.com/mastra-ai/mastra/pull/11338))

- Add debugger-like click-through UI to workflow graph ([#11350](https://github.com/mastra-ai/mastra/pull/11350))

- Add `perStep` option to workflow run methods, allowing a workflow to run just a step instead of all the workflow steps ([#11276](https://github.com/mastra-ai/mastra/pull/11276))

- Fix workflow throwing error when using .map after .foreach ([#11352](https://github.com/mastra-ai/mastra/pull/11352))

- Bump @ai-sdk/openai from 3.0.0-beta.102 to 3.0.1 ([#11377](https://github.com/mastra-ai/mastra/pull/11377))

## 1.0.0-beta.14

### Minor Changes

- Add support for AI SDK v6 (LanguageModelV3) ([#11191](https://github.com/mastra-ai/mastra/pull/11191))

  Agents can now use `LanguageModelV3` models from AI SDK v6 beta providers like `@ai-sdk/openai@^3.0.0-beta`.

  **New features:**
  - Usage normalization: V3's nested usage format is normalized to Mastra's flat format with `reasoningTokens`, `cachedInputTokens`, and raw data preserved in a `raw` field

  **Backward compatible:** All existing V1 and V2 models continue to work unchanged.

### Patch Changes

- Fix model-level and runtime header support for LLM calls ([#11275](https://github.com/mastra-ai/mastra/pull/11275))

  This fixes a bug where custom headers configured on models (like `anthropic-beta`) were not being passed through to the underlying AI SDK calls. The fix properly handles headers from multiple sources with correct priority:

  **Header Priority (low to high):**
  1. Model config headers - Headers set in model configuration
  2. ModelSettings headers - Runtime headers that override model config
  3. Provider-level headers - Headers baked into AI SDK providers (not overridden)

  **Examples that now work:**

  ```typescript
  // Model config headers
  new Agent({
    model: {
      id: 'anthropic/claude-4-5-sonnet',
      headers: { 'anthropic-beta': 'context-1m-2025-08-07' },
    },
  });

  // Runtime headers override config
  agent.generate('...', {
    modelSettings: { headers: { 'x-custom': 'runtime-value' } },
  });

  // Provider-level headers preserved
  const openai = createOpenAI({ headers: { 'openai-organization': 'org-123' } });
  new Agent({ model: openai('gpt-4o-mini') });
  ```

- Fixed AbortSignal not propagating from parent workflows to nested sub-workflows in the evented workflow engine. ([#11142](https://github.com/mastra-ai/mastra/pull/11142))

  Previously, canceling a parent workflow did not stop nested sub-workflows, causing them to continue running and consuming resources after the parent was canceled.

  Now, when you cancel a parent workflow, all nested sub-workflows are automatically canceled as well, ensuring clean termination of the entire workflow tree.

  **Example:**

  ```typescript
  const parentWorkflow = createWorkflow({ id: 'parent-workflow' }).then(someStep).then(nestedChildWorkflow).commit();

  const run = await parentWorkflow.createRun();
  const resultPromise = run.start({ inputData: { value: 5 } });

  // Cancel the parent workflow - nested workflows will also be canceled
  await run.cancel();
  // or use: run.abortController.abort();

  const result = await resultPromise;
  // result.status === 'canceled'
  // All nested child workflows are also canceled
  ```

  Related to #11063

- Fix empty overrideScorers causing error instead of skipping scoring ([#11257](https://github.com/mastra-ai/mastra/pull/11257))

  When `overrideScorers` was passed as an empty object `{}`, the agent would throw a "No scorers found" error. Now an empty object explicitly skips scoring, while `undefined` continues to use default scorers.

- feat: Add field filtering and nested workflow control to workflow execution result endpoint ([#11246](https://github.com/mastra-ai/mastra/pull/11246))

  Adds two optional query parameters to `/api/workflows/:workflowId/runs/:runId/execution-result` endpoint:
  - `fields`: Request only specific fields (e.g., `status`, `result`, `error`)
  - `withNestedWorkflows`: Control whether to fetch nested workflow data

  This significantly reduces response payload size and improves response times for large workflows.

  ## Server Endpoint Usage

  ```http
  # Get only status (minimal payload - fastest)
  GET /api/workflows/:workflowId/runs/:runId/execution-result?fields=status

  # Get status and result
  GET /api/workflows/:workflowId/runs/:runId/execution-result?fields=status,result

  # Get all fields but without nested workflow data (faster)
  GET /api/workflows/:workflowId/runs/:runId/execution-result?withNestedWorkflows=false

  # Get only specific fields without nested workflow data
  GET /api/workflows/:workflowId/runs/:runId/execution-result?fields=status,steps&withNestedWorkflows=false

  # Get full data (default behavior)
  GET /api/workflows/:workflowId/runs/:runId/execution-result
  ```

  ## Client SDK Usage

  ```typescript
  import { MastraClient } from '@mastra/client-js';

  const client = new MastraClient({ baseUrl: 'http://localhost:4111' });
  const workflow = client.getWorkflow('myWorkflow');

  // Get only status (minimal payload - fastest)
  const statusOnly = await workflow.runExecutionResult(runId, {
    fields: ['status'],
  });
  console.log(statusOnly.status); // 'success' | 'failed' | 'running' | etc.

  // Get status and result
  const statusAndResult = await workflow.runExecutionResult(runId, {
    fields: ['status', 'result'],
  });

  // Get all fields but without nested workflow data (faster)
  const resultWithoutNested = await workflow.runExecutionResult(runId, {
    withNestedWorkflows: false,
  });

  // Get specific fields without nested workflow data
  const optimized = await workflow.runExecutionResult(runId, {
    fields: ['status', 'steps'],
    withNestedWorkflows: false,
  });

  // Get full execution result (default behavior)
  const fullResult = await workflow.runExecutionResult(runId);
  ```

  ## Core API Changes

  The `Workflow.getWorkflowRunExecutionResult` method now accepts an options object:

  ```typescript
  await workflow.getWorkflowRunExecutionResult(runId, {
    withNestedWorkflows: false, // default: true, set to false to skip nested workflow data
    fields: ['status', 'result'], // optional field filtering
  });
  ```

  ## Inngest Compatibility

  The `@mastra/inngest` package has been updated to use the new options object API. This is a non-breaking internal change - no action required from inngest workflow users.

  ## Performance Impact

  For workflows with large step outputs:
  - Requesting only `status`: ~99% reduction in payload size
  - Requesting `status,result,error`: ~95% reduction in payload size
  - Using `withNestedWorkflows=false`: Avoids expensive nested workflow data fetching
  - Combining both: Maximum performance optimization

- Removed a debug log that printed large Zod schemas, resulting in cleaner console output when using agents with memory enabled. ([#11279](https://github.com/mastra-ai/mastra/pull/11279))

- Set `externals: true` as the default for `mastra build` and cloud-deployer to reduce bundle issues with native dependencies. ([`0dbf199`](https://github.com/mastra-ai/mastra/commit/0dbf199110f22192ce5c95b1c8148d4872b4d119))

  **Note:** If you previously relied on the default bundling behavior (all dependencies bundled), you can explicitly set `externals: false` in your bundler configuration.

- Fix delayed promises rejecting when stream suspends on tool-call-approval ([#11278](https://github.com/mastra-ai/mastra/pull/11278))

  When a stream ends in suspended state (e.g., requiring tool approval), the delayed promises like `toolResults`, `toolCalls`, `text`, etc. now resolve with partial results instead of rejecting with an error. This allows consumers to access data that was produced before the suspension.

  Also improves generic type inference for `LLMStepResult` and related types throughout the streaming infrastructure.

## 1.0.0-beta.13

### Patch Changes

- Add `onFinish` and `onError` lifecycle callbacks to workflow options ([#11200](https://github.com/mastra-ai/mastra/pull/11200))

  Workflows now support lifecycle callbacks for server-side handling of workflow completion and errors:
  - `onFinish`: Called when workflow completes with any status (success, failed, suspended, tripwire)
  - `onError`: Called only when workflow fails (failed or tripwire status)

  ```typescript
  const workflow = createWorkflow({
    id: 'my-workflow',
    inputSchema: z.object({ ... }),
    outputSchema: z.object({ ... }),
    options: {
      onFinish: async (result) => {
        // Handle any workflow completion
        await updateJobStatus(result.status);
      },
      onError: async (errorInfo) => {
        // Handle workflow failures
        await logError(errorInfo.error);
      },
    },
  });
  ```

  Both callbacks support sync and async functions. Callback errors are caught and logged, not propagated to the workflow result.

## 1.0.0-beta.12

### Patch Changes

- Remove redundant toolCalls from network agent finalResult ([#11189](https://github.com/mastra-ai/mastra/pull/11189))

  The network agent's `finalResult` was storing `toolCalls` separately even though all tool call information is already present in the `messages` array (as `tool-call` and `tool-result` type messages). This caused significant token waste since the routing agent reads this data from memory on every iteration.

  **Before:** `finalResult: { text, toolCalls, messages }`
  **After:** `finalResult: { text, messages }`

  +**Migration:** If you were accessing `finalResult.toolCalls`, retrieve tool calls from `finalResult.messages` by filtering for messages with `type: 'tool-call'`.

  Updated `@mastra/react` to extract tool calls directly from the `messages` array instead of the removed `toolCalls` field when resolving initial messages from memory.

  Fixes #11059

- Embed AI types to fix peerdeps mismatches ([`9650cce`](https://github.com/mastra-ai/mastra/commit/9650cce52a1d917ff9114653398e2a0f5c3ba808))

- Fix invalid state: Controller is already closed ([`932d63d`](https://github.com/mastra-ai/mastra/commit/932d63dd51be9c8bf1e00e3671fe65606c6fb9cd))

  Fixes #11005

- Fix HITL (Human-In-The-Loop) tool execution bug when mixing tools with and without execute functions. ([#11178](https://github.com/mastra-ai/mastra/pull/11178))

  When an agent called multiple tools simultaneously where some had `execute` functions and others didn't (HITL tools expecting `addToolResult` from the frontend), the HITL tools would incorrectly receive `result: undefined` and be marked as "output-available" instead of "input-available". This caused the agent to continue instead of pausing for user input.

- Add resourceId to workflow routes ([#11166](https://github.com/mastra-ai/mastra/pull/11166))

- Auto resume suspended tools if `autoResumeSuspendedTools: true` ([#11157](https://github.com/mastra-ai/mastra/pull/11157))

  The flag can be added to `defaultAgentOptions` when creating the agent or to options in `agent.stream` or `agent.generate`

  ```typescript
  const agent = new Agent({
    //...agent information,
    defaultAgentOptions: {
      autoResumeSuspendedTools: true,
    },
  });
  ```

- Preserve error details when thrown from workflow steps ([#10992](https://github.com/mastra-ai/mastra/pull/10992))
  - Errors thrown in workflow steps now preserve full error details including `cause` chain and custom properties
  - Added `SerializedError` type with proper cause chain support
  - Added `SerializedStepResult` and `SerializedStepFailure` types for handling errors loaded from storage
  - Enhanced `addErrorToJSON` to recursively serialize error cause chains with max depth protection
  - Added `hydrateSerializedStepErrors` to convert serialized errors back to Error instances
  - Fixed Inngest workflow error handling to extract original error from `NonRetriableError.cause`

- Move `@ai-sdk/azure` to devDependencies ([#10218](https://github.com/mastra-ai/mastra/pull/10218))

- Refactor internal event system from Emitter to PubSub abstraction for workflow event handling. This change replaces the EventEmitter-based event system with a pluggable PubSub interface, enabling support for distributed workflow execution backends like Inngest. Adds `close()` method to PubSub implementations for proper cleanup. ([#11052](https://github.com/mastra-ai/mastra/pull/11052))

- Add `startAsync()` method and fix Inngest duplicate workflow execution bug ([#11093](https://github.com/mastra-ai/mastra/pull/11093))

  **New Feature: `startAsync()` for fire-and-forget workflow execution**
  - Add `Run.startAsync()` to base workflow class - starts workflow in background and returns `{ runId }` immediately
  - Add `EventedRun.startAsync()` - publishes workflow start event without subscribing for completion
  - Add `InngestRun.startAsync()` - sends Inngest event without polling for result

  **Bug Fix: Prevent duplicate Inngest workflow executions**
  - Fix `getRuns()` to properly handle rate limits (429), empty responses, and JSON parse errors with retry logic and exponential backoff
  - Fix `getRunOutput()` to throw `NonRetriableError` when polling fails, preventing Inngest from retrying the parent function and re-triggering the workflow
  - Add timeout to `getRunOutput()` polling (default 5 minutes) with `NonRetriableError` on timeout

  This fixes a production issue where polling failures after successful workflow completion caused Inngest to retry the parent function, which fired a new workflow event and resulted in duplicate executions (e.g., duplicate Slack messages).

- Preserve error details when thrown from workflow steps ([#10992](https://github.com/mastra-ai/mastra/pull/10992))

  Workflow errors now retain custom properties like `statusCode`, `responseHeaders`, and `cause` chains. This enables error-specific recovery logic in your applications.

  **Before:**

  ```typescript
  const result = await workflow.execute({ input });
  if (result.status === 'failed') {
    // Custom error properties were lost
    console.log(result.error); // "Step execution failed" (just a string)
  }
  ```

  **After:**

  ```typescript
  const result = await workflow.execute({ input });
  if (result.status === 'failed') {
    // Custom properties are preserved
    console.log(result.error.message); // "Step execution failed"
    console.log(result.error.statusCode); // 429
    console.log(result.error.cause?.name); // "RateLimitError"
  }
  ```

  **Type change:** `WorkflowState.error` and `WorkflowRunState.error` types changed from `string | Error` to `SerializedError`.

  Other changes:
  - Added `UpdateWorkflowStateOptions` type for workflow state updates

- Fix Zod 4 compatibility issue with structuredOutput in agent.generate() ([#11133](https://github.com/mastra-ai/mastra/pull/11133))

  Users with Zod 4 installed would see `TypeError: undefined is not an object (evaluating 'def.valueType._zod')` when using `structuredOutput` with agent.generate(). This happened because ProcessorStepSchema contains `z.custom()` fields that hold user-provided Zod schemas, and the workflow validation was trying to deeply validate these schemas causing version conflicts.

  The fix disables input validation for processor workflows since `z.custom()` fields are meant to pass through arbitrary types without deep validation.

- Truncate map config when too long ([#11175](https://github.com/mastra-ai/mastra/pull/11175))

- Add helpful JSDoc comments to `BundlerConfig` properties (used with `bundler` option) ([#10218](https://github.com/mastra-ai/mastra/pull/10218))

- Fixes .network() method ignores MASTRA_RESOURCE_ID_KEY from requestContext ([`4524734`](https://github.com/mastra-ai/mastra/commit/45247343e384717a7c8404296275c56201d6470f))

- fix: make getSqlType consistent across storage adapters ([#11112](https://github.com/mastra-ai/mastra/pull/11112))
  - PostgreSQL: use `getSqlType()` in `createTable` instead of `toUpperCase()`
  - LibSQL: use `getSqlType()` in `createTable`, return `JSONB` for jsonb type (matches SQLite 3.45+ support)
  - ClickHouse: use `getSqlType()` in `createTable` instead of `COLUMN_TYPES` constant, add missing types (uuid, float, boolean)
  - Remove unused `getSqlType()` and `getDefaultValue()` from `MastraStorage` base class (all stores use `StoreOperations` versions)

- Fix workflow cancel not updating status when workflow is suspended ([#11139](https://github.com/mastra-ai/mastra/pull/11139))
  - `Run.cancel()` now updates workflow status to 'canceled' in storage, resolving the issue where suspended workflows remained in 'suspended' status after cancellation
  - Cancellation status is immediately persisted and reflected to observers

- What changed: ([#10998](https://github.com/mastra-ai/mastra/pull/10998))

  Support for sequential tool execution was added. Tool call concurrency is now set conditionally, defaulting to 1 when sequential execution is needed (to avoid race conditions that interfere with human-in-the-loop approval during the workflow) rather than the default of 10 when concurrency is acceptable.

  How it was changed:

  A `sequentialExecutionRequired` constant was set to a boolean depending on whether any of the tools involved in a returned agentic execution workflow would require approval. If any tool has a 'suspendSchema' property (used for conditionally suspending execution and waiting for human input), or if they have their `requireApproval` property set to `true`, then the concurrency property used in the toolCallStep is set to 1, causing sequential execution. The old default of 10 remains otherwise.

- Fixed duplicate assistant messages appearing when using `useChat` with memory enabled. ([#11195](https://github.com/mastra-ai/mastra/pull/11195))

  **What was happening:** When using `useChat` with `chatRoute` and memory, assistant messages were being duplicated in storage after multiple conversation turns. This occurred because the backend-generated message ID wasn't being sent back to `useChat`, causing ID mismatches during deduplication.

  **What changed:**
  - The backend now sends the assistant message ID in the stream's start event, so `useChat` uses the same ID as storage
  - Custom `data-*` parts (from `writer.custom()`) are now preserved when messages contain V5 tool parts

  Fixes #11091

- Updated dependencies [[`9650cce`](https://github.com/mastra-ai/mastra/commit/9650cce52a1d917ff9114653398e2a0f5c3ba808), [`5a632bd`](https://github.com/mastra-ai/mastra/commit/5a632bdf7b78953b664f5e038e98d4ba5f971e47)]:
  - @mastra/schema-compat@1.0.0-beta.3
  - @mastra/observability@1.0.0-beta.5

## 1.0.0-beta.11

### Minor Changes

- Respect structured outputs for v2 models so tool schemas aren’t stripped ([#11038](https://github.com/mastra-ai/mastra/pull/11038))

### Patch Changes

- Fix type safety for message ordering - restrict `orderBy` to only accept `'createdAt'` field ([#11069](https://github.com/mastra-ai/mastra/pull/11069))

  Messages don't have an `updatedAt` field, but the previous type allowed ordering by it, which would return empty results. This change adds compile-time type safety by making `StorageOrderBy` generic and restricting `StorageListMessagesInput.orderBy` to only accept `'createdAt'`. The API validation schemas have also been updated to reject invalid orderBy values at runtime.

- Loosen tools types in processInputStep / prepareStep. ([#11071](https://github.com/mastra-ai/mastra/pull/11071))

- Added the ability to provide a base path for Mastra Studio. ([#10441](https://github.com/mastra-ai/mastra/pull/10441))

  ```ts
  import { Mastra } from '@mastra/core';

  export const mastra = new Mastra({
    server: {
      studioBase: '/my-mastra-studio',
    },
  });
  ```

  This will make Mastra Studio available at `http://localhost:4111/my-mastra-studio`.

- Expand `processInputStep` processor method and integrate `prepareStep` as a processor ([#10774](https://github.com/mastra-ai/mastra/pull/10774))

  **New Features:**
  - `prepareStep` callback now runs through the standard `processInputStep` pipeline
  - Processors can now modify per-step: `model`, `tools`, `toolChoice`, `activeTools`, `messages`, `systemMessages`, `providerOptions`, `modelSettings`, and `structuredOutput`
  - Processor chaining: each processor receives accumulated state from previous processors
  - System messages are isolated per-step (reset at start of each step)

  **Breaking Change:**
  - `prepareStep` messages format changed from AI SDK v5 model messages to `MastraDBMessage` format
  - Migration: Use `messageList.get.all.aiV5.model()` if you need the old format

- Multiple Processor improvements including: ([#10947](https://github.com/mastra-ai/mastra/pull/10947))
  - Workflows can now return tripwires, they bubble up from agents that return tripwires in a step
  - You can write processors as workflows using the existing Workflow primitive, every processor flow is now a workflow.
  - tripwires that you throw can now return additional information including ability to retry the step
  - New processor method `processOutputStep` added which runs after every step.

  **What's new:**

  **1. Retry mechanism with LLM feedback** - Processors can now request retries with feedback that gets sent back to the LLM:

  ```typescript
  processOutputStep: async ({ text, abort, retryCount }) => {
    if (isLowQuality(text)) {
      abort('Response quality too low', { retry: true, metadata: { score: 0.6 } });
    }
    return [];
  };
  ```

  Configure with `maxProcessorRetries` (default: 3). Rejected steps are preserved in `result.steps[n].tripwire`. Retries are only available in `processOutputStep` and `processInputStep`. It will replay the step with additional context added.

  **2. Workflow orchestration for processors** - Processors can now be composed using workflow primitives:

  ```typescript
  import { createStep, createWorkflow } from '@mastra/core/workflows';
  import {
    ProcessorStepSchema,
  } from '@mastra/core/processors';

  const moderationWorkflow = createWorkflow({ id: 'moderation', inputSchema: ProcessorStepSchema, outputSchema: ProcessorStepSchema })
    .then(createStep(new lengthValidator({...})))
    .parallel([createStep(new piiDetector({...}), createStep(new toxicityChecker({...}))])
    .commit();

  const agent = new Agent({ inputProcessors: [moderationWorkflow] });
  ```

  Every processor array that gets passed to an agent gets added as a workflow
  <img width="614" height="673" alt="image" src="https://github.com/user-attachments/assets/0d79f1fd-8fca-4d86-8b45-22fddea984a8" />

  **3. Extended tripwire API** - `abort()` now accepts options for retry control and typed metadata:

  ```typescript
  abort('reason', { retry: true, metadata: { score: 0.8, category: 'quality' } });
  ```

  **4. New `processOutputStep` method** - Per-step output processing with access to step number, finish reason, tool calls, and retry count.

  **5. Workflow tripwire status** - Workflows now have a `'tripwire'` status distinct from `'failed'`, properly bubbling up processor rejections.

## 1.0.0-beta.10

### Patch Changes

- Add support for typed structured output in agent workflow steps ([#11014](https://github.com/mastra-ai/mastra/pull/11014))

  When wrapping an agent with `createStep()` and providing a `structuredOutput.schema`, the step's `outputSchema` is now correctly inferred from the provided schema instead of defaulting to `{ text: string }`.

  This enables type-safe chaining of agent steps with structured output to subsequent steps:

  ```typescript
  const articleSchema = z.object({
    title: z.string(),
    summary: z.string(),
    tags: z.array(z.string()),
  });

  // Agent step with structured output - outputSchema is now articleSchema
  const agentStep = createStep(agent, {
    structuredOutput: { schema: articleSchema },
  });

  // Next step can receive the structured output directly
  const processStep = createStep({
    id: 'process',
    inputSchema: articleSchema, // Matches agent's outputSchema
    outputSchema: z.object({ tagCount: z.number() }),
    execute: async ({ inputData }) => ({
      tagCount: inputData.tags.length, // Fully typed!
    }),
  });

  workflow.then(agentStep).then(processStep).commit();
  ```

  When `structuredOutput` is not provided, the agent step continues to use the default `{ text: string }` output schema.

- Fixed a bug where multiple tools streaming output simultaneously could fail with "WritableStreamDefaultWriter is locked" errors. Tool streaming now works reliably during concurrent tool executions. ([#10830](https://github.com/mastra-ai/mastra/pull/10830))

- Add delete workflow run API ([#10991](https://github.com/mastra-ai/mastra/pull/10991))

  ```typescript
  await workflow.deleteWorkflowRunById(runId);
  ```

- Fixed CachedToken tracking in all Observability Exporters. Also fixed TimeToFirstToken in Langfuse, Braintrust, PostHog exporters. Fixed trace formatting in Posthog Exporter. ([#11029](https://github.com/mastra-ai/mastra/pull/11029))

- fix: persist data-\* chunks from writer.custom() to memory storage ([#10884](https://github.com/mastra-ai/mastra/pull/10884))
  - Add persistence for custom data chunks (`data-*` parts) emitted via `writer.custom()` in tools
  - Data chunks are now saved to message storage so they survive page refreshes
  - Update `@assistant-ui/react` to v0.11.47 with native `DataMessagePart` support
  - Convert `data-*` parts to `DataMessagePart` format (`{ type: 'data', name: string, data: T }`)
  - Update related `@assistant-ui/*` packages for compatibility

- Fixed double validation bug that prevented Zod transforms from working correctly in tool schemas. ([#11025](https://github.com/mastra-ai/mastra/pull/11025))

  When tools with Zod `.transform()` or `.pipe()` in their `outputSchema` were executed through the Agent pipeline, validation was happening twice - once in Tool.execute() (correct) and again in CoreToolBuilder (incorrect). The second validation received already-transformed data but expected pre-transform data, causing validation errors.

  This fix enables proper use of Zod transforms in both `inputSchema` (for normalizing/cleaning input data) and `outputSchema` (for transforming output data to be LLM-friendly).

- Updated dependencies [[`5d7000f`](https://github.com/mastra-ai/mastra/commit/5d7000f757cd65ea9dc5b05e662fd83dfd44e932)]:
  - @mastra/observability@1.0.0-beta.4

## 1.0.0-beta.9

### Minor Changes

- Add stored agents support ([#10953](https://github.com/mastra-ai/mastra/pull/10953))

  Agents can now be stored in the database and loaded at runtime. This lets you persist agent configurations and dynamically create executable Agent instances from storage.

  ```typescript
  import { Mastra } from '@mastra/core';
  import { LibSQLStore } from '@mastra/libsql';

  const mastra = new Mastra({
    storage: new LibSQLStore({ url: ':memory:' }),
    tools: { myTool },
    scorers: { myScorer },
  });

  // Create agent in storage via API or directly
  await mastra.getStorage().createAgent({
    agent: {
      id: 'my-agent',
      name: 'My Agent',
      instructions: 'You are helpful',
      model: { provider: 'openai', name: 'gpt-4' },
      tools: { myTool: {} },
      scorers: { myScorer: { sampling: { type: 'ratio', rate: 0.5 } } },
    },
  });

  // Load and use the agent
  const agent = await mastra.getStoredAgentById('my-agent');
  const response = await agent.generate({ messages: 'Hello!' });

  // List all stored agents with pagination
  const { agents, total, hasMore } = await mastra.listStoredAgents({
    page: 0,
    perPage: 10,
  });
  ```

  Also adds a memory registry to Mastra so stored agents can reference memory instances by key.

### Patch Changes

- Add agentId and agentName attributes to MODEL_GENERATION spans. This allows users to correlate gen_ai.usage metrics with specific agents when analyzing LLM operation spans. The attributes are exported as gen_ai.agent.id and gen_ai.agent.name in the OtelExporter. ([#10984](https://github.com/mastra-ai/mastra/pull/10984))

- Fix JSON parsing errors when LLMs output unescaped newlines in structured output strings ([#10965](https://github.com/mastra-ai/mastra/pull/10965))

  Some LLMs (particularly when not using native JSON mode) output actual newline characters inside JSON string values instead of properly escaped `\n` sequences. This breaks JSON parsing and causes structured output to fail.

  This change adds preprocessing to escape unescaped control characters (`\n`, `\r`, `\t`) within JSON string values before parsing, making structured output more robust across different LLM providers.

- Fix toolCallId propagation in agent network tool execution. The toolCallId property was undefined at runtime despite being required by TypeScript type definitions in AgentToolExecutionContext. Now properly passes the toolCallId through to the tool's context during network tool execution. ([#10951](https://github.com/mastra-ai/mastra/pull/10951))

- Exports `convertFullStreamChunkToMastra` from the stream module for AI SDK stream chunk transformations. ([#10911](https://github.com/mastra-ai/mastra/pull/10911))

## 1.0.0-beta.8

### Patch Changes

- Fix saveScore not persisting ID correctly, breaking getScoreById retrieval ([#10915](https://github.com/mastra-ai/mastra/pull/10915))

  **What Changed**
  - saveScore now correctly returns scores that can be retrieved with getScoreById
  - Validation errors now include contextual information (scorer, entity, trace details) for easier debugging

  **Impact**
  Previously, calling getScoreById after saveScore would return null because the generated ID wasn't persisted to the database. This is now fixed across all store implementations, ensuring consistent behavior and data integrity.

- `setState` is now async ([#10944](https://github.com/mastra-ai/mastra/pull/10944))
  - `setState` must now be awaited: `await setState({ key: value })`
  - State updates are merged automatically—no need to spread the previous state
  - State data is validated against the step's `stateSchema` when `validateInputs` is enabled (default: `true`)

- Add human-in-the-loop support for workflows used in agent ([#10871](https://github.com/mastra-ai/mastra/pull/10871))

## 1.0.0-beta.7

### Minor Changes

- Add `disableInit` option to all storage adapters ([#10851](https://github.com/mastra-ai/mastra/pull/10851))

  Adds a new `disableInit` config option to all storage providers that allows users to disable automatic table creation/migrations at runtime. This is useful for CI/CD pipelines where you want to run migrations during deployment with elevated credentials, then run the application with `disableInit: true` so it doesn't attempt schema changes at runtime.

  ```typescript
  // CI/CD script - run migrations
  const storage = new PostgresStore({
    connectionString: DATABASE_URL,
    id: 'pg-storage',
  });
  await storage.init();

  // Runtime - skip auto-init
  const storage = new PostgresStore({
    connectionString: DATABASE_URL,
    id: 'pg-storage',
    disableInit: true,
  });
  ```

### Patch Changes

- Add time-to-first-token (TTFT) support for Langfuse integration ([#10781](https://github.com/mastra-ai/mastra/pull/10781))

  Adds `completionStartTime` to model generation spans, which Langfuse uses to calculate TTFT metrics. The timestamp is automatically captured when the first content chunk arrives during streaming.

  ```typescript
  // completionStartTime is now automatically captured and sent to Langfuse
  // enabling TTFT metrics in your Langfuse dashboard
  const result = await agent.stream('Hello');
  ```

- Updated OtelExporters, Bridge, and Arize packages to better implement GenAI v1.38.0 Otel Semantic Conventions. See: ([#10591](https://github.com/mastra-ai/mastra/pull/10591))
  https://github.com/open-telemetry/semantic-conventions/blob/v1.38.0/docs/gen-ai/README.md

- Standardize error IDs across all storage and vector stores using centralized helper functions (`createStorageErrorId` and `createVectorErrorId`). This ensures consistent error ID patterns (`MASTRA_STORAGE_{STORE}_{OPERATION}_{STATUS}` and `MASTRA_VECTOR_{STORE}_{OPERATION}_{STATUS}`) across the codebase for better error tracking and debugging. ([#10913](https://github.com/mastra-ai/mastra/pull/10913))

- fix: generate unique text IDs for Anthropic/Google providers ([#10740](https://github.com/mastra-ai/mastra/pull/10740))

  Workaround for duplicate text-start/text-end IDs in multi-step agentic flows.

  The `@ai-sdk/anthropic` and `@ai-sdk/google` providers use numeric indices ("0", "1", etc.) for text block IDs that reset for each LLM call. This caused duplicate IDs when an agent does TEXT → TOOL → TEXT, breaking message ordering and storage.

  The fix replaces numeric IDs with UUIDs, maintaining a map per step so text-start, text-delta, and text-end chunks for the same block share the same UUID. OpenAI's UUIDs pass through unchanged.

  Related: #9909

- Fix sub-agent requestContext propagation in listAgentTools ([#10844](https://github.com/mastra-ai/mastra/pull/10844))

  Sub-agents with dynamic model configurations were broken because `requestContext` was not being passed to `getModel()` when creating agent tools. This caused sub-agents using function-based model configurations to receive an empty context instead of the parent's context.

  No code changes required for consumers - this fix restores expected behavior for dynamic model configurations in sub-agents.

- Fix ToolStream type error when piping streams with different types ([#10845](https://github.com/mastra-ai/mastra/pull/10845))

  Changes `ToolStream` to extend `WritableStream<unknown>` instead of `WritableStream<T>`. This fixes the TypeScript error when piping `objectStream` or `fullStream` to `writer` in workflow steps.

  Before:

  ```typescript
  // TypeError: ToolStream<ChunkType> is not assignable to WritableStream<Partial<StoryPlan>>
  await response.objectStream.pipeTo(writer);
  ```

  After:

  ```typescript
  // Works without type errors
  await response.objectStream.pipeTo(writer);
  ```

- feat: add native Perplexity provider support ([#10885](https://github.com/mastra-ai/mastra/pull/10885))

- When sending the first message to a new thread with PostgresStore, users would get a "Thread not found" error. This happened because the thread was created in memory but not persisted to the database before the MessageHistory output processor tried to save messages. ([#10881](https://github.com/mastra-ai/mastra/pull/10881))

  **Before:**

  ```ts
  threadObject = await memory.createThread({
    // ...
    saveThread: false, // thread not in DB yet
  });
  // Later: MessageHistory calls saveMessages() -> PostgresStore throws "Thread not found"
  ```

  **After:**

  ```ts
  threadObject = await memory.createThread({
    // ...
    saveThread: true, // thread persisted immediately
  });
  // MessageHistory can now save messages without error
  ```

- Emit error chunk and call onError when agent workflow step fails ([#10907](https://github.com/mastra-ai/mastra/pull/10907))

  When a workflow step fails (e.g., tool not found), the error is now properly emitted as an error chunk to the stream and the onError callback is called. This fixes the issue where agent.generate() would throw "promise 'text' was not resolved or rejected" instead of the actual error message.

- fix(core): use agent description when converting agent to tool ([#10879](https://github.com/mastra-ai/mastra/pull/10879))

- Adds native @ai-sdk/deepseek provider support instead of using the OpenAI-compatible fallback. ([#10822](https://github.com/mastra-ai/mastra/pull/10822))

  ```typescript
  const agent = new Agent({
    model: 'deepseek/deepseek-reasoner',
  });

  // With provider options for reasoning
  const response = await agent.generate('Solve this problem', {
    providerOptions: {
      deepseek: {
        thinking: { type: 'enabled' },
      },
    },
  });
  ```

  Also updates the doc generation scripts so DeepSeek provider options show up in the generated docs.

- Return state too if `includeState: true` is in `outputOptions` and workflow run is not successful ([#10806](https://github.com/mastra-ai/mastra/pull/10806))

- feat: Add partial response support for agent and workflow list endpoints ([#10886](https://github.com/mastra-ai/mastra/pull/10886))

  Add optional `partial` query parameter to `/api/agents` and `/api/workflows` endpoints to return minimal data without schemas, reducing payload size for list views:
  - When `partial=true`: tool schemas (inputSchema, outputSchema) are omitted
  - When `partial=true`: workflow steps are replaced with stepCount integer
  - When `partial=true`: workflow root schemas (inputSchema, outputSchema) are omitted
  - Maintains backward compatibility when partial parameter is not provided

  ## Server Endpoint Usage

  ```http
  # Get partial agent data (no tool schemas)
  GET /api/agents?partial=true

  # Get full agent data (default behavior)
  GET /api/agents

  # Get partial workflow data (stepCount instead of steps, no schemas)
  GET /api/workflows?partial=true

  # Get full workflow data (default behavior)
  GET /api/workflows
  ```

  ## Client SDK Usage

  ```typescript
  import { MastraClient } from '@mastra/client-js';

  const client = new MastraClient({ baseUrl: 'http://localhost:4111' });

  // Get partial agent list (smaller payload)
  const partialAgents = await client.listAgents({ partial: true });

  // Get full agent list with tool schemas
  const fullAgents = await client.listAgents();

  // Get partial workflow list (smaller payload)
  const partialWorkflows = await client.listWorkflows({ partial: true });

  // Get full workflow list with steps and schemas
  const fullWorkflows = await client.listWorkflows();
  ```

- Fix processInputStep so it runs correctly. ([#10909](https://github.com/mastra-ai/mastra/pull/10909))

- Updated dependencies [[`6c59a40`](https://github.com/mastra-ai/mastra/commit/6c59a40e0ad160467bd13d63a8a287028d75b02d), [`3076c67`](https://github.com/mastra-ai/mastra/commit/3076c6778b18988ae7d5c4c5c466366974b2d63f), [`0bada2f`](https://github.com/mastra-ai/mastra/commit/0bada2f2c1234932cf30c1c47a719ffb64b801c5), [`cc60ff6`](https://github.com/mastra-ai/mastra/commit/cc60ff616541a3b0fb531a7e469bf9ae7bb90528)]:
  - @mastra/observability@1.0.0-beta.3

## 1.0.0-beta.6

### Major Changes

- Changed `.branch()` result schema to make all branch output fields optional. ([#10693](https://github.com/mastra-ai/mastra/pull/10693))

  **Breaking change**: Branch outputs are now optional since only one branch executes at runtime. Update your workflow schemas to handle optional branch results.

  **Before:**

  ```typescript
  const workflow = createWorkflow({...})
    .branch([
      [condition1, stepA],  // outputSchema: { result: z.string() }
      [condition2, stepB],  // outputSchema: { data: z.number() }
    ])
    .map({
      finalResult: { step: stepA, path: 'result' }  // Expected non-optional
    });
  ```

  **After:**

  ```typescript
  const workflow = createWorkflow({...})
    .branch([
      [condition1, stepA],
      [condition2, stepB],
    ])
    .map({
      finalResult: {
        step: stepA,
        path: 'result'  // Now optional - provide fallback
      }
    });
  ```

  **Why**: Branch conditionals execute only one path, so non-executed branches don't produce outputs. The type system now correctly reflects this runtime behavior.

  Related issue: https://github.com/mastra-ai/mastra/issues/10642

### Minor Changes

- Memory system now uses processors. Memory processors (`MessageHistory`, `SemanticRecall`, `WorkingMemory`) are now exported from `@mastra/memory/processors` and automatically added to the agent pipeline based on your memory config. Core processors (`ToolCallFilter`, `TokenLimiter`) remain in `@mastra/core/processors`. ([#9254](https://github.com/mastra-ai/mastra/pull/9254))

- Add reserved keys in RequestContext for secure resourceId/threadId setting from middleware ([#10657](https://github.com/mastra-ai/mastra/pull/10657))

  This allows middleware to securely set `resourceId` and `threadId` via reserved keys in RequestContext (`MASTRA_RESOURCE_ID_KEY` and `MASTRA_THREAD_ID_KEY`), which take precedence over client-provided values for security.

- feat(workflows): add suspendData parameter to step execute function ([#10734](https://github.com/mastra-ai/mastra/pull/10734))

  Adds a new `suspendData` parameter to workflow step execute functions that provides access to the data originally passed to `suspend()` when the step was suspended. This enables steps to access context about why they were suspended when they are later resumed.

  **New Features:**
  - `suspendData` parameter automatically populated in step execute function when resuming
  - Type-safe access to suspend data matching the step's `suspendSchema`
  - Backward compatible - existing workflows continue to work unchanged

  **Example:**

  ```typescript
  const step = createStep({
    suspendSchema: z.object({ reason: z.string() }),
    resumeSchema: z.object({ approved: z.boolean() }),
    execute: async ({ suspend, suspendData, resumeData }) => {
      if (!resumeData?.approved) {
        return await suspend({ reason: 'Approval required' });
      }

      // Access original suspend data when resuming
      console.log(`Resuming after: ${suspendData?.reason}`);
      return { result: 'Approved' };
    },
  });
  ```

- feat(storage): support querying messages from multiple threads ([#10663](https://github.com/mastra-ai/mastra/pull/10663))
  - Fixed TypeScript errors where `threadId: string | string[]` was being passed to places expecting `Scalar` type
  - Added proper multi-thread support for `listMessages` across all adapters when `threadId` is an array
  - Updated `_getIncludedMessages` to look up message threadId by ID (since message IDs are globally unique)
  - **upstash**: Added `msg-idx:{messageId}` index for O(1) message lookups (backwards compatible with fallback to scan for old messages, with automatic backfill)

- Adds trace tagging support to the BrainTrust and Langfuse tracing exporters. ([#10765](https://github.com/mastra-ai/mastra/pull/10765))

- Add `messageList` parameter to `processOutputStream` for accessing remembered messages during streaming ([#10608](https://github.com/mastra-ai/mastra/pull/10608))

- Unify transformScoreRow functions across storage adapters ([#10648](https://github.com/mastra-ai/mastra/pull/10648))

  Added a unified `transformScoreRow` function in `@mastra/core/storage` that provides schema-driven row transformation for score data. This eliminates code duplication across 10 storage adapters while maintaining store-specific behavior through configurable options:
  - `preferredTimestampFields`: Preferred source fields for timestamps (PostgreSQL, Cloudflare D1)
  - `convertTimestamps`: Convert timestamp strings to Date objects (MSSQL, MongoDB, ClickHouse)
  - `nullValuePattern`: Skip values matching pattern (ClickHouse's `'_null_'`)
  - `fieldMappings`: Map source column names to schema fields (LibSQL's `additionalLLMContext`)

  Each store adapter now uses the unified function with appropriate options, reducing ~200 lines of duplicate transformation logic while ensuring consistent behavior across all storage backends.

### Patch Changes

- dependencies updates: ([#10110](https://github.com/mastra-ai/mastra/pull/10110))
  - Updated dependency [`hono-openapi@^1.1.1` ↗︎](https://www.npmjs.com/package/hono-openapi/v/1.1.1) (from `^0.4.8`, in `dependencies`)

- unexpected json parse issue, log error but dont fail ([#10241](https://github.com/mastra-ai/mastra/pull/10241))

- Fixed a bug in agent networks where sometimes the task name was empty ([#10629](https://github.com/mastra-ai/mastra/pull/10629))

- Adds `tool-result` and `tool-error` chunks to the processor.processOutputStream path. Processors now have access to these two chunks. ([#10645](https://github.com/mastra-ai/mastra/pull/10645))

- Include `.input` in workflow results for both engines and remove the option to omit them from Inngest workflows. ([#10688](https://github.com/mastra-ai/mastra/pull/10688))

- `getSpeakers` endpoint returns an empty array if voice is not configured on the agent and `getListeners` endpoint returns `{ enabled: false }` if voice is not figured on the agent. ([#10560](https://github.com/mastra-ai/mastra/pull/10560))

  When no voice is set on agent don't throw error, by default set voice to undefined rather than DefaultVoice which throws errors when it is accessed.

- SimpleAuth and improved CloudAuth ([#10490](https://github.com/mastra-ai/mastra/pull/10490))

- When LLMs like Claude Sonnet 4.5 and Gemini 2.4 call tools with all-optional parameters, they send `args: undefined` instead of `args: {}`. This caused validation to fail with "root: Required". ([#10728](https://github.com/mastra-ai/mastra/pull/10728))

  The fix normalizes `undefined`/`null` to `{}` for object schemas and `[]` for array schemas before validation.

- Fixed tool validation error messages so logs show Zod validation errors directly instead of hiding them inside structured JSON. ([#10579](https://github.com/mastra-ai/mastra/pull/10579))

- Fix error when spreading config objects in Mastra constructor ([#10718](https://github.com/mastra-ai/mastra/pull/10718))

  Adds validation guards to handle undefined/null values that can occur when config objects are spread (`{ ...config }`). Previously, if getters or non-enumerable properties resulted in undefined values during spread, the constructor would throw cryptic errors when accessing `.id` or `.name` on undefined objects.

- Fix GPT-5/o3 reasoning models failing with "required reasoning item" errors when using memory with tools. Empty reasoning is now stored with providerMetadata to preserve OpenAI's item_reference. ([#10585](https://github.com/mastra-ai/mastra/pull/10585))

- Fix generateTitle model type to accept AI SDK LanguageModelV2 ([#10541](https://github.com/mastra-ai/mastra/pull/10541))

  Updated the `generateTitle.model` config option to accept `MastraModelConfig` instead of `MastraLanguageModel`. This allows users to pass raw AI SDK `LanguageModelV2` models (e.g., `anthropic.languageModel('claude-3-5-haiku-20241022')`) directly without type errors.

  Previously, passing a standard `LanguageModelV2` would fail because `MastraLanguageModelV2` has different `doGenerate`/`doStream` return types. Now `MastraModelConfig` is used consistently across:
  - `memory/types.ts` - `generateTitle.model` config
  - `agent.ts` - `genTitle`, `generateTitleFromUserMessage`, `resolveTitleGenerationConfig`
  - `agent-legacy.ts` - `AgentLegacyCapabilities` interface

- Fix message ordering when using toAISdkV5Messages or prepareStep ([#10686](https://github.com/mastra-ai/mastra/pull/10686))

  Messages without `createdAt` timestamps were getting shuffled because they all received identical timestamps during conversion. Now messages are assigned monotonically increasing timestamps via `generateCreatedAt()`, preserving input order.

  Before:

  ```
  Input:  [user: "hello", assistant: "Hi!", user: "bye"]
  Output: [user: "bye", assistant: "Hi!", user: "hello"]  // shuffled!
  ```

  After:

  ```
  Input:  [user: "hello", assistant: "Hi!", user: "bye"]
  Output: [user: "hello", assistant: "Hi!", user: "bye"]  // correct order
  ```

- Fix Scorer not using custom gateways registered with Mastra ([#10778](https://github.com/mastra-ai/mastra/pull/10778))

  Scorers now have access to custom gateways when resolving models. Previously, calling `resolveModelConfig` in the scorer didn't pass the Mastra instance, so custom gateways were never available.

- Fix workflow run status not being updated from storage snapshot in createRun ([#10664](https://github.com/mastra-ai/mastra/pull/10664))

  When createRun is called with an existing runId, it now correctly updates the run's status from the storage snapshot. This fixes the issue where different workflow instances (e.g., different API requests) would get a run with 'pending' status instead of the correct status from storage (e.g., 'suspended').

- Pass resourceId and threadId to network agent's subAgent when it has its own memory ([#10592](https://github.com/mastra-ai/mastra/pull/10592))

- use `agent.getMemory` to fetch the memory instance on the Agent class to make sure that storage gets set if memory doesn't set it itself. ([#10556](https://github.com/mastra-ai/mastra/pull/10556))

- Built-in processors that use internal agents (PromptInjectionDetector, ModerationProcessor, PIIDetector, LanguageDetector, StructuredOutputProcessor) now accept `providerOptions` to control model behavior. ([#10651](https://github.com/mastra-ai/mastra/pull/10651))

  This lets you pass provider-specific settings like `reasoningEffort` for OpenAI thinking models:

  ```typescript
  const processor = new PromptInjectionDetector({
    model: 'openai/o1-mini',
    threshold: 0.7,
    strategy: 'block',
    providerOptions: {
      openai: {
        reasoningEffort: 'low',
      },
    },
  });
  ```

- Improved typing for `workflow.then` to allow the provided steps `inputSchema` to be a subset of the previous steps `outputSchema`. Also errors if the provided steps `inputSchema` is a superset of the previous steps outputSchema. ([#10763](https://github.com/mastra-ai/mastra/pull/10763))

- Fix type issue with workflow `.parallel()` when passing multiple steps, one or more of which has a `resumeSchema` provided. ([#10708](https://github.com/mastra-ai/mastra/pull/10708))

- Adds bidirectional integration with otel tracing via a new @mastra/otel-bridge package. ([#10482](https://github.com/mastra-ai/mastra/pull/10482))

- Adds `processInputStep` method to the Processor interface. Unlike `processInput` which runs once at the start, this runs at each step of the agentic loop (including tool call continuations). ([#10650](https://github.com/mastra-ai/mastra/pull/10650))

  ```ts
  const processor: Processor = {
    id: 'my-processor',
    processInputStep: async ({ messages, messageList, stepNumber, systemMessages }) => {
      // Transform messages at each step before LLM call
      return messageList;
    },
  };
  ```

- When using output processors with `agent.generate()`, `result.text` was returning the unprocessed LLM response instead of the processed text. ([#10735](https://github.com/mastra-ai/mastra/pull/10735))

  **Before:**

  ```ts
  const result = await agent.generate('hello');
  result.text; // "hello world" (unprocessed)
  result.response.messages[0].content[0].text; // "HELLO WORLD" (processed)
  ```

  **After:**

  ```ts
  const result = await agent.generate('hello');
  result.text; // "HELLO WORLD" (processed)
  ```

  The bug was caused by the `text` delayed promise being resolved twice - first correctly with the processed text, then overwritten with the unprocessed buffered text.

- Refactored default engine to fit durable execution better, and the inngest engine to match. ([#10627](https://github.com/mastra-ai/mastra/pull/10627))
  Also fixes requestContext persistence by relying on inngest step memoization.

  Unifies some of the stepResults and error formats in both engines.

- Allow direct access to server app handle directly from Mastra instance. ([#10598](https://github.com/mastra-ai/mastra/pull/10598))

  ```ts
  // Before: HTTP request to localhost
  const response = await fetch(`http://localhost:5000/api/tools`);

  // After: Direct call via app.fetch()
  const app = mastra.getServerApp<Hono>();
  const response = await app.fetch(new Request('http://internal/api/tools'));
  ```

  - Added `mastra.getServerApp<T>()` to access the underlying Hono/Express app
  - Added `mastra.getMastraServer()` and `mastra.setMastraServer()` for adapter access
  - Added `MastraServerBase` class in `@mastra/core/server` for adapter implementations
  - Server adapters now auto-register with Mastra in their constructor

- Fix network agent not getting `text-delta` from subAgent when `.stream` is used ([#10533](https://github.com/mastra-ai/mastra/pull/10533))

- Fix discriminatedUnion schema information lost when json schema is converted to zod ([#10500](https://github.com/mastra-ai/mastra/pull/10500))

- Fix writer.custom not working during workflow resume operations ([#10720](https://github.com/mastra-ai/mastra/pull/10720))

  When a workflow step is resumed, the writer parameter was not being properly passed through, causing writer.custom() calls to fail. This fix ensures the writableStream parameter is correctly passed to both run.resume() and run.start() calls in the workflow execution engine, allowing custom events to be emitted properly during resume operations.

- Fix corrupted provider-registry.json file in global cache and regenerate corrupted files ([#10606](https://github.com/mastra-ai/mastra/pull/10606))

- Fix TypeScript error when using Zod schemas in `defaultOptions.structuredOutput` ([#10710](https://github.com/mastra-ai/mastra/pull/10710))

  Previously, defining `structuredOutput.schema` in `defaultOptions` would cause a TypeScript error because the type only accepted `undefined`. Now any valid `OutputSchema` is correctly accepted.

- Add support for `providerOptions` when defining tools. This allows developers to specify provider-specific configurations (like Anthropic's `cacheControl`) per tool. ([#10649](https://github.com/mastra-ai/mastra/pull/10649))

  ```typescript
  createTool({
    id: 'my-tool',
    providerOptions: {
      anthropic: { cacheControl: { type: 'ephemeral' } },
    },
    // ...
  });
  ```

- Fixed OpenAI reasoning message merging so distinct reasoning items are no longer dropped when they share a message ID. Prevents downstream errors where a function call is missing its required "reasoning" item. See #9005. ([#10614](https://github.com/mastra-ai/mastra/pull/10614))

- Updated dependencies [[`103586c`](https://github.com/mastra-ai/mastra/commit/103586cb23ebcd2466c7f68a71674d37cc10e263), [`61a5705`](https://github.com/mastra-ai/mastra/commit/61a570551278b6743e64243b3ce7d73de915ca8a), [`db70a48`](https://github.com/mastra-ai/mastra/commit/db70a48aeeeeb8e5f92007e8ede52c364ce15287), [`f03ae60`](https://github.com/mastra-ai/mastra/commit/f03ae60500fe350c9d828621006cdafe1975fdd8)]:
  - @mastra/observability@1.0.0-beta.2
  - @mastra/schema-compat@1.0.0-beta.2

## 1.0.0-beta.5

### Patch Changes

- Add Azure OpenAI gateway ([#9990](https://github.com/mastra-ai/mastra/pull/9990))

  The Azure OpenAI gateway supports three configuration modes:
  1. **Static deployments**: Provide deployment names from Azure Portal
  2. **Dynamic discovery**: Query Azure Management API for available deployments
  3. **Manual**: Specify deployment names when creating agents

  ## Usage

  ```typescript
  import { Mastra } from '@mastra/core';
  import { AzureOpenAIGateway } from '@mastra/core/llm';

  // Static mode (recommended)
  export const mastra = new Mastra({
    gateways: [
      new AzureOpenAIGateway({
        resourceName: process.env.AZURE_RESOURCE_NAME!,
        apiKey: process.env.AZURE_API_KEY!,
        deployments: ['gpt-4-prod', 'gpt-35-turbo-dev'],
      }),
    ],
  });

  // Dynamic discovery mode
  export const mastra = new Mastra({
    gateways: [
      new AzureOpenAIGateway({
        resourceName: process.env.AZURE_RESOURCE_NAME!,
        apiKey: process.env.AZURE_API_KEY!,
        management: {
          tenantId: process.env.AZURE_TENANT_ID!,
          clientId: process.env.AZURE_CLIENT_ID!,
          clientSecret: process.env.AZURE_CLIENT_SECRET!,
          subscriptionId: process.env.AZURE_SUBSCRIPTION_ID!,
          resourceGroup: 'my-resource-group',
        },
      }),
    ],
  });

  // Use Azure OpenAI models
  const agent = new Agent({
    model: 'azure-openai/gpt-4-deployment',
    instructions: 'You are a helpful assistant',
  });
  ```

- - Fix tool suspension throwing error when `outputSchema` is passed to tool during creation ([#10444](https://github.com/mastra-ai/mastra/pull/10444))
  - Pass `suspendSchema` and `resumeSchema` from tool into step created when creating step from tool

- Add `onOutput` hook for tools ([#10466](https://github.com/mastra-ai/mastra/pull/10466))

  Tools now support an `onOutput` lifecycle hook that is invoked after successful tool execution. This complements the existing `onInputStart`, `onInputDelta`, and `onInputAvailable` hooks to provide complete visibility into the tool execution lifecycle.

  The `onOutput` hook receives:
  - `output`: The tool's return value (typed according to `outputSchema`)
  - `toolCallId`: Unique identifier for the tool call
  - `toolName`: The name of the tool that was executed
  - `abortSignal`: Signal for detecting if the operation should be cancelled

  Example usage:

  ```typescript
  import { createTool } from '@mastra/core/tools';
  import { z } from 'zod';

  export const weatherTool = createTool({
    id: 'weather-tool',
    description: 'Get weather information',
    outputSchema: z.object({
      temperature: z.number(),
      conditions: z.string(),
    }),
    execute: async input => {
      return { temperature: 72, conditions: 'sunny' };
    },
    onOutput: ({ output, toolCallId, toolName }) => {
      console.log(`${toolName} completed:`, output);
      // output is fully typed based on outputSchema
    },
  });
  ```

  Hook execution order:
  1. `onInputStart` - Input streaming begins
  2. `onInputDelta` - Input chunks arrive (called multiple times)
  3. `onInputAvailable` - Complete input parsed and validated
  4. Tool's `execute` function runs
  5. `onOutput` - Tool completed successfully (NEW)

- Add new deleteVectors, updateVector by filter ([#10408](https://github.com/mastra-ai/mastra/pull/10408))

- Fix base64 encoded images with threads - issue #10480 ([#10483](https://github.com/mastra-ai/mastra/pull/10483))

  Fixed "Invalid URL" error when using base64 encoded images (without `data:` prefix) in agent calls with threads and resources. Raw base64 strings are now automatically converted to proper data URIs before being processed.

  **Changes:**
  - Updated `attachments-to-parts.ts` to detect and convert raw base64 strings to data URIs
  - Fixed `MessageList` image processing to handle raw base64 in two locations:
    - Image part conversion in `aiV4CoreMessageToV1PromptMessage`
    - File part to experimental_attachments conversion in `mastraDBMessageToAIV4UIMessage`
  - Added comprehensive tests for base64 images, data URIs, and HTTP URLs with threads

  **Breaking Change:** None - this is a bug fix that maintains backward compatibility while adding support for raw base64 strings.

- Fix message metadata not persisting when using simple message format. Previously, custom metadata passed in messages (e.g., `{role: 'user', content: 'text', metadata: {userId: '123'}}`) was not being saved to the database. This occurred because the CoreMessage conversion path didn't preserve metadata fields. ([#10488](https://github.com/mastra-ai/mastra/pull/10488))

  Now metadata is properly preserved for all message input formats:
  - Simple CoreMessage format: `{role, content, metadata}`
  - Full UIMessage format: `{role, content, parts, metadata}`
  - AI SDK v5 ModelMessage format with metadata

  Fixes #8556

- feat: Composite auth implementation ([#10359](https://github.com/mastra-ai/mastra/pull/10359))

- Fix requireApproval property being ignored for tools passed via toolsets, clientTools, and memoryTools parameters. The requireApproval flag now correctly propagates through all tool conversion paths, ensuring tools requiring approval will properly request user approval before execution. ([#10464](https://github.com/mastra-ai/mastra/pull/10464))

- Add timeTravel APIs and add timeTravel feature to studio ([#10361](https://github.com/mastra-ai/mastra/pull/10361))

- Fix Azure Foundry rate limit handling for -1 values ([#10409](https://github.com/mastra-ai/mastra/pull/10409))

- Fix model headers not being passed through gateway system ([#10465](https://github.com/mastra-ai/mastra/pull/10465))

  Previously, custom headers specified in `MastraModelConfig` were not being passed through the gateway system to model providers. This affected:
  - OpenRouter (preventing activity tracking with `HTTP-Referer` and `X-Title`)
  - Custom providers using custom URLs (headers not passed to `createOpenAICompatible`)
  - Custom gateway implementations (headers not available in `resolveLanguageModel`)

  Now headers are correctly passed through the entire gateway system:
  - Base `MastraModelGateway` interface updated to accept headers
  - `ModelRouterLanguageModel` passes headers from config to all gateways
  - OpenRouter receives headers for activity tracking
  - Custom URL providers receive headers via `createOpenAICompatible`
  - Custom gateways can access headers in their `resolveLanguageModel` implementation

  Example usage:

  ```typescript
  // Works with OpenRouter
  const agent = new Agent({
    name: 'my-agent',
    instructions: 'You are a helpful assistant.',
    model: {
      id: 'openrouter/anthropic/claude-3-5-sonnet',
      headers: {
        'HTTP-Referer': 'https://myapp.com',
        'X-Title': 'My Application',
      },
    },
  });

  // Also works with custom providers
  const customAgent = new Agent({
    name: 'custom-agent',
    instructions: 'You are a helpful assistant.',
    model: {
      id: 'custom-provider/model',
      url: 'https://api.custom.com/v1',
      apiKey: 'key',
      headers: {
        'X-Custom-Header': 'custom-value',
      },
    },
  });
  ```

  Fixes https://github.com/mastra-ai/mastra/issues/9760

- fix(agent): persist messages before tool suspension ([#10369](https://github.com/mastra-ai/mastra/pull/10369))

  Fixes issues where thread and messages were not saved before suspension when tools require approval or call suspend() during execution. This caused conversation history to be lost if users refreshed during tool approval or suspension.

  **Backend changes (@mastra/core):**
  - Add assistant messages to messageList immediately after LLM execution
  - Flush messages synchronously before suspension to persist state
  - Create thread if it doesn't exist before flushing
  - Add metadata helpers to persist and remove tool approval state
  - Pass saveQueueManager and memory context through workflow for immediate persistence

  **Frontend changes (@mastra/react):**
  - Extract runId from pending approvals to enable resumption after refresh
  - Convert `pendingToolApprovals` (DB format) to `requireApprovalMetadata` (runtime format)
  - Handle both `dynamic-tool` and `tool-{NAME}` part types for approval state
  - Change runId from hardcoded `agentId` to unique `uuid()`

  **UI changes (@mastra/playground-ui):**
  - Handle tool calls awaiting approval in message initialization
  - Convert approval metadata format when loading initial messages

  Fixes #9745, #9906

- Update MockMemory to work with new storage API changes. MockMemory now properly implements all abstract MastraMemory methods. This includes proper thread management, message saving with MessageList conversion, working memory operations with scope support, and resource listing. ([#10368](https://github.com/mastra-ai/mastra/pull/10368))

  Add Zod v4 support for working memory schemas. Memory implementations now check for Zod v4's built-in `.toJsonSchema()` method before falling back to the `zodToJsonSchema` compatibility function, improving performance and forward compatibility while maintaining backward compatibility with Zod v3.

  Add Gemini 3 Pro test coverage in agent-gemini.test.ts to validate the latest Gemini model integration.

- Fix race condition in parallel tool stream writes ([#10463](https://github.com/mastra-ai/mastra/pull/10463))

  Introduces a write queue to ToolStream to serialize access to the underlying stream, preventing writer locked errors

- Remove unneeded console warning when flushing messages and no threadId or saveQueueManager is found. ([#10498](https://github.com/mastra-ai/mastra/pull/10498))

- Add optional includeRawChunks parameter to agent execution options, ([#10456](https://github.com/mastra-ai/mastra/pull/10456))
  allowing users to include raw chunks in stream output where supported
  by the model provider.

- When `mastra dev` runs, multiple processes can write to `provider-registry.json` concurrently (auto-refresh, syncGateways, syncGlobalCacheToLocal). This causes file corruption where the end of the JSON appears twice, making it unparseable. ([#10455](https://github.com/mastra-ai/mastra/pull/10455))

  The fix uses atomic writes via the write-to-temp-then-rename pattern. Instead of:

  ```ts
  fs.writeFileSync(filePath, content, 'utf-8');
  ```

  We now do:

  ```ts
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.${randomSuffix}.tmp`;
  fs.writeFileSync(tempPath, content, 'utf-8');
  fs.renameSync(tempPath, filePath); // atomic on POSIX
  ```

  `fs.rename()` is atomic on POSIX systems when both paths are on the same filesystem, so concurrent writes will each complete fully rather than interleaving.

- Fix .map when placed at the beginning of a workflow or nested workflow ([#10457](https://github.com/mastra-ai/mastra/pull/10457))

- Ensures that data chunks written via `writer.custom()` always bubble up directly to the top-level stream, even when nested in sub-agents. This allows tools to emit custom progress updates, metrics, and other data that can be consumed at any level of the agent hierarchy. ([#10309](https://github.com/mastra-ai/mastra/pull/10309))
  - **Added bubbling logic in sub-agent execution**: When sub-agents execute, data chunks (chunks with type starting with `data-`) are detected and written via `writer.custom()` instead of `writer.write()`, ensuring they bubble up directly without being wrapped in `tool-output` chunks.
  - **Added comprehensive tests**:
    - Test for `writer.custom()` with direct tool execution
    - Test for `writer.custom()` with sub-agent tools (nested execution)
    - Test for mixed usage of `writer.write()` and `writer.custom()` in the same tool

  When a sub-agent's tool uses `writer.custom()` to write data chunks, those chunks appear in the sub-agent's stream. The parent agent's execution logic now detects these chunks and uses `writer.custom()` to bubble them up directly, preserving their structure and making them accessible at the top level.

  This ensures that:
  - Data chunks from tools always appear directly in the stream (not wrapped)
  - Data chunks bubble up correctly through nested agent hierarchies
  - Regular chunks continue to be wrapped in `tool-output` as expected

- Update agent workflow and sub-agent tool transformations to accept more input arguments. ([#10278](https://github.com/mastra-ai/mastra/pull/10278))

  These tools now accept the following

  ```
  workflowTool.execute({ inputData, initialState }, context)

  agentTool.execute({ prompt, threadId, resourceId, instructions, maxSteps }, context)
  ```

  Workflow tools now also properly return errors when the workflow run fails

  ```
  const workflowResult = await workflowTool.execute({ inputData, initialState }, context)

  console.log(workflowResult.error) // error msg if error
  console.log(workflowResult.result) // result of the workflow if success
  ```

  Workflows passed to agents do not properly handle suspend/resume`, they only handle success or error.

- Fixed OpenAI schema compatibility when using `agent.generate()` or `agent.stream()` with `structuredOutput`. ([#10366](https://github.com/mastra-ai/mastra/pull/10366))

  ## Changes
  - **Automatic transformation**: Zod schemas are now automatically transformed for OpenAI strict mode compatibility when using OpenAI models (including reasoning models like o1, o3, o4)
  - **Optional field handling**: `.optional()` fields are converted to `.nullable()` with a transform that converts `null` → `undefined`, preserving optional semantics while satisfying OpenAI's strict mode requirements
  - **Preserves nullable fields**: Intentionally `.nullable()` fields remain unchanged
  - **Deep transformation**: Handles `.optional()` fields at any nesting level (objects, arrays, unions, etc.)
  - **JSON Schema objects**: Not transformed, only Zod schemas

  ## Example

  ```typescript
  const agent = new Agent({
    name: 'data-extractor',
    model: { provider: 'openai', modelId: 'gpt-4o' },
    instructions: 'Extract user information',
  });

  const schema = z.object({
    name: z.string(),
    age: z.number().optional(),
    deletedAt: z.date().nullable(),
  });

  // Schema is automatically transformed for OpenAI compatibility
  const result = await agent.generate('Extract: John, deleted yesterday', {
    structuredOutput: { schema },
  });

  // Result: { name: 'John', age: undefined, deletedAt: null }
  ```

- Fix network data step formatting in AI SDK stream transformation ([#10432](https://github.com/mastra-ai/mastra/pull/10432))

  Previously, network execution steps were not being tracked correctly in the AI SDK stream transformation. Steps were being duplicated rather than updated, and critical metadata like step IDs, iterations, and task information was missing or incorrectly structured.

  **Changes:**
  - Enhanced step tracking in `AgentNetworkToAISDKTransformer` to properly maintain step state throughout execution lifecycle
  - Steps are now identified by unique IDs and updated in place rather than creating duplicates
  - Added proper iteration and task metadata to each step in the network execution flow
  - Fixed agent, workflow, and tool execution events to correctly populate step data
  - Updated network stream event types to include `networkId`, `workflowId`, and consistent `runId` tracking
  - Added test coverage for network custom data chunks with comprehensive validation

  This ensures the AI SDK correctly represents the full execution flow of agent networks with accurate step sequencing and metadata.

- Fix generating provider-registry.json ([#10392](https://github.com/mastra-ai/mastra/pull/10392))

- Adds type inference for `mastra.get*ById` functions. Only those registered at the top level mastra instance will get inferred. MCP and tool id's do not get inferred yet, those need additional changes. ([#10199](https://github.com/mastra-ai/mastra/pull/10199))

- Fix working memory zod to json schema conversion to use schema-compat zodtoJsonSchema fn. ([#10391](https://github.com/mastra-ai/mastra/pull/10391))

- Fixes parallel tool call issue with Gemini 3 Pro by preventing step-start parts from being inserted between consecutive tool parts in the `addStartStepPartsForAIV5` function. This ensures that the AI SDK's `convertToModelMessages` correctly preserves the order of parallel tool calls and maintains the `thought_signature` on the first tool call as required by Gemini's API. ([#10372](https://github.com/mastra-ai/mastra/pull/10372))

- Updated dependencies [[`bae33d9`](https://github.com/mastra-ai/mastra/commit/bae33d91a63fbb64d1e80519e1fc1acaed1e9013)]:
  - @mastra/schema-compat@1.0.0-beta.1

## 1.0.0-beta.4

### Patch Changes

- Fix message list provider metadata handling and reasoning text optimization ([#10281](https://github.com/mastra-ai/mastra/pull/10281))
  - Improved provider metadata preservation across message transformations
  - Optimized reasoning text storage to avoid duplication (using `details` instead of `reasoning` field)
  - Fixed test snapshots for timestamp precision and metadata handling

- Allow provider to pass through options to the auth config ([#10284](https://github.com/mastra-ai/mastra/pull/10284))

- Fix deprecation warning when agent network executes workflows by using `.fullStream` instead of iterating `WorkflowRunOutput` directly ([#10285](https://github.com/mastra-ai/mastra/pull/10285))

- Fix generate toolResults and mismatch in provider tool names ([#10282](https://github.com/mastra-ai/mastra/pull/10282))

- Support AI SDK voice models ([#10304](https://github.com/mastra-ai/mastra/pull/10304))

  Mastra now supports AI SDK's transcription and speech models directly in `CompositeVoice`, enabling seamless integration with a wide range of voice providers through the AI SDK ecosystem. This allows you to use models from OpenAI, ElevenLabs, Groq, Deepgram, LMNT, Hume, and many more for both speech-to-text (transcription) and text-to-speech capabilities.

  AI SDK models are automatically wrapped when passed to `CompositeVoice`, so you can mix and match AI SDK models with existing Mastra voice providers for maximum flexibility.

  ## Usage Example

  ```typescript
  import { CompositeVoice } from '@mastra/core/voice';
  import { openai } from '@ai-sdk/openai';
  import { elevenlabs } from '@ai-sdk/elevenlabs';

  // Use AI SDK models directly with CompositeVoice
  const voice = new CompositeVoice({
    input: openai.transcription('whisper-1'), // AI SDK transcription model
    output: elevenlabs.speech('eleven_turbo_v2'), // AI SDK speech model
  });

  // Convert text to speech
  const audioStream = await voice.speak('Hello from AI SDK!');

  // Convert speech to text
  const transcript = await voice.listen(audioStream);
  console.log(transcript);
  ```

  Fixes #9947

## 1.0.0-beta.3

### Major Changes

- Use tool's outputSchema to validate results and return an error object if schema does not match output results. ([#9664](https://github.com/mastra-ai/mastra/pull/9664))

  ```typescript
  const getUserTool = createTool({
    id: 'get-user',
    outputSchema: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string().email(),
    }),
    execute: async inputData => {
      return { id: '123', name: 'John' };
    },
  });
  ```

  When validation fails, the tool returns a `ValidationError`:

  ```typescript
  // Before v1 - invalid output would silently pass through
  await getUserTool.execute({});
  // { id: "123", name: "John" } - missing email

  // After v1 - validation error is returned
  await getUserTool.execute({});
  // {
  //   error: true,
  //   message: "Tool output validation failed for get-user. The tool returned invalid output:\n- email: Required\n\nReturned output: {...}",
  //   validationErrors: { ... }
  // }
  ```

### Patch Changes

- dependencies updates: ([#10131](https://github.com/mastra-ai/mastra/pull/10131))
  - Updated dependency [`hono@^4.10.5` ↗︎](https://www.npmjs.com/package/hono/v/4.10.5) (from `^4.9.7`, in `dependencies`)

- Only handle download image asset transformation if needed ([#10122](https://github.com/mastra-ai/mastra/pull/10122))

- Add serializedStepGraph to runExecutionResult response ([#10004](https://github.com/mastra-ai/mastra/pull/10004))

- Fix tool outputSchema validation to allow unsupported Zod types like ZodTuple. The outputSchema is only used for internal validation and never sent to the LLM, so model compatibility checks are not needed. ([#9409](https://github.com/mastra-ai/mastra/pull/9409))

- Fix vector definition to fix pinecone ([#10150](https://github.com/mastra-ai/mastra/pull/10150))

- fix resumeStream type to use resumeSchema ([#10202](https://github.com/mastra-ai/mastra/pull/10202))

- Add type bailed to workflowRunStatus ([#10091](https://github.com/mastra-ai/mastra/pull/10091))

- default validate inputs to true in Workflow execute ([#10222](https://github.com/mastra-ai/mastra/pull/10222))

- Add support for doGenerate in LanguageModelV2. This change fixes issues with OpenAI stream permissions. ([#10239](https://github.com/mastra-ai/mastra/pull/10239))
  - Added new abstraction over LanguageModelV2

- Fix input tool validation when no inputSchema is provided ([#9941](https://github.com/mastra-ai/mastra/pull/9941))

- Adds ability to create custom `MastraModelGateway`'s that can be added to the `Mastra` class instance under the `gateways` property. Giving you typescript autocompletion in any model picker string. ([#10180](https://github.com/mastra-ai/mastra/pull/10180))

  ```typescript
  import { MastraModelGateway, type ProviderConfig } from '@mastra/core/llm';
  import { createOpenAICompatible } from '@ai-sdk/openai-compatible-v5';
  import type { LanguageModelV2 } from '@ai-sdk/provider-v5';

  class MyCustomGateway extends MastraModelGateway {
    readonly id = 'my-custom-gateway';
    readonly name = 'My Custom Gateway';
    readonly prefix = 'custom';

    async fetchProviders(): Promise<Record<string, ProviderConfig>> {
      return {
        'my-provider': {
          name: 'My Provider',
          models: ['model-1', 'model-2'],
          apiKeyEnvVar: 'MY_API_KEY',
          gateway: this.id,
        },
      };
    }

    buildUrl(modelId: string, envVars?: Record<string, string>): string {
      return 'https://api.my-provider.com/v1';
    }

    async getApiKey(modelId: string): Promise<string> {
      const apiKey = process.env.MY_API_KEY;
      if (!apiKey) throw new Error('MY_API_KEY not set');
      return apiKey;
    }

    async resolveLanguageModel({
      modelId,
      providerId,
      apiKey,
    }: {
      modelId: string;
      providerId: string;
      apiKey: string;
    }): Promise<LanguageModelV2> {
      const baseURL = this.buildUrl(`${providerId}/${modelId}`);
      return createOpenAICompatible({
        name: providerId,
        apiKey,
        baseURL,
      }).chatModel(modelId);
    }
  }

  new Mastra({
    gateways: {
      myGateway: new MyCustomGateway(),
    },
  });
  ```

- Add an additional check to determine whether the model natively supports specific file types. Only download the file if the model does not support it natively. ([#9790](https://github.com/mastra-ai/mastra/pull/9790))

- Add restart method to workflow run that allows restarting an active workflow run ([#9750](https://github.com/mastra-ai/mastra/pull/9750))
  Add status filter to `listWorkflowRuns`
  Add automatic restart to restart active workflow runs when server starts

- Validate schemas by default in workflow. Previously, if you want schemas in the workflow to be validated, you'd have to add `validateInputs` option, now, this will be done by default but can be disabled. ([#10186](https://github.com/mastra-ai/mastra/pull/10186))

  For workflows whose schemas and step schemas you don't want validated, do this

  ```diff
  createWorkflow({
  +  options: {
  +    validateInputs: false
  +  }
  })
  ```

- Fix inngest parallel workflow ([#10169](https://github.com/mastra-ai/mastra/pull/10169))
  Fix tool as step in inngest
  Fix inngest nested workflow

- Add timeTravel to workflows. This makes it possible to start a workflow run from a particular step in the workflow ([#9994](https://github.com/mastra-ai/mastra/pull/9994))

  Example code:

  ```ts
  const result = await run.timeTravel({
    step: 'step2',
    inputData: {
      value: 'input',
    },
  });
  ```

- Fixes assets not being downloaded when available ([#10079](https://github.com/mastra-ai/mastra/pull/10079))

- Remove unused dependencies ([#10019](https://github.com/mastra-ai/mastra/pull/10019))

- Updated dependencies [[`a64d16a`](https://github.com/mastra-ai/mastra/commit/a64d16aedafe57ee5707bdcc25f96e07fa1a0233)]:
  - @mastra/observability@1.0.0-beta.1

## 1.0.0-beta.2

### Patch Changes

- Make suspendPayload optional when calling `suspend()` ([#9926](https://github.com/mastra-ai/mastra/pull/9926))
  Save value returned as `suspendOutput` if user returns data still after calling `suspend()`
  Automatically call `commit()` on uncommitted workflows when registering in Mastra instance
  Show actual suspendPayload on Studio in suspend/resume flow

## 1.0.0-beta.1

### Patch Changes

- Set correct peer dependency range for `@mastra/observability` ([#9908](https://github.com/mastra-ai/mastra/pull/9908))

- Add visual styles and labels for more workflow node types ([#9777](https://github.com/mastra-ai/mastra/pull/9777))

- `registerApiRoute` now accepts a `requiresAuth` option, so custom endpoints can opt in/out of Mastra auth without mutating the returned route object.

## 1.0.0-beta.0

### Major Changes

- Moving scorers under the eval domain, api method consistency, prebuilt evals, scorers require ids. ([#9589](https://github.com/mastra-ai/mastra/pull/9589))

- **BREAKING CHANGE**: Scorers for Agents will now use `MastraDBMessage` instead of `UIMessage` ([#9702](https://github.com/mastra-ai/mastra/pull/9702))
  - Scorer input/output types now use `MastraDBMessage[]` with nested `content` object structure
  - Added `getTextContentFromMastraDBMessage()` helper function to extract text content from `MastraDBMessage` objects
  - Added `createTestMessage()` helper function for creating `MastraDBMessage` objects in tests with optional tool invocations support
  - Updated `extractToolCalls()` to access tool invocations from nested `content` structure
  - Updated `getUserMessageFromRunInput()` and `getAssistantMessageFromRunOutput()` to use new message structure
  - Removed `createUIMessage()`

- Every Mastra primitive (agent, MCPServer, workflow, tool, processor, scorer, and vector) now has a get, list, and add method associated with it. Each primitive also now requires an id to be set. ([#9675](https://github.com/mastra-ai/mastra/pull/9675))

  Primitives that are added to other primitives are also automatically added to the Mastra instance

- Update handlers to use `listWorkflowRuns` instead of `getWorkflowRuns`. Fix type names from `StoragelistThreadsByResourceIdInput/Output` to `StorageListThreadsByResourceIdInput/Output`. ([#9507](https://github.com/mastra-ai/mastra/pull/9507))

- **BREAKING:** Remove `getMessagesPaginated()` and add `perPage: false` support ([#9670](https://github.com/mastra-ai/mastra/pull/9670))

  Removes deprecated `getMessagesPaginated()` method. The `listMessages()` API and score handlers now support `perPage: false` to fetch all records without pagination limits.

  **Storage changes:**
  - `StoragePagination.perPage` type changed from `number` to `number | false`
  - All storage implementations support `perPage: false`:
    - Memory: `listMessages()`
    - Scores: `listScoresBySpan()`, `listScoresByRunId()`, `listScoresByExecutionId()`
  - HTTP query parser accepts `"false"` string (e.g., `?perPage=false`)

  **Memory changes:**
  - `memory.query()` parameter type changed from `StorageGetMessagesArg` to `StorageListMessagesInput`
  - Uses flat parameters (`page`, `perPage`, `include`, `filter`, `vectorSearchString`) instead of `selectBy` object

  **Stricter validation:**
  - `listMessages()` requires non-empty, non-whitespace `threadId` (throws error instead of returning empty results)

  **Migration:**

  ```typescript
  // Storage/Memory: Replace getMessagesPaginated with listMessages
  - storage.getMessagesPaginated({ threadId, selectBy: { pagination: { page: 0, perPage: 20 } } })
  + storage.listMessages({ threadId, page: 0, perPage: 20 })
  + storage.listMessages({ threadId, page: 0, perPage: false })  // Fetch all

  // Memory: Replace selectBy with flat parameters
  - memory.query({ threadId, selectBy: { last: 20, include: [...] } })
  + memory.query({ threadId, perPage: 20, include: [...] })

  // Client SDK
  - thread.getMessagesPaginated({ selectBy: { pagination: { page: 0 } } })
  + thread.listMessages({ page: 0, perPage: 20 })
  ```

- # Major Changes ([#9695](https://github.com/mastra-ai/mastra/pull/9695))

  ## Storage Layer

  ### BREAKING: Removed `storage.getMessages()`

  The `getMessages()` method has been removed from all storage implementations. Use `listMessages()` instead, which provides pagination support.

  **Migration:**

  ```typescript
  // Before
  const messages = await storage.getMessages({ threadId: 'thread-1' });

  // After
  const result = await storage.listMessages({
    threadId: 'thread-1',
    page: 0,
    perPage: 50,
  });
  const messages = result.messages; // Access messages array
  console.log(result.total); // Total count
  console.log(result.hasMore); // Whether more pages exist
  ```

  ### Message ordering default

  `listMessages()` defaults to ASC (oldest first) ordering by `createdAt`, matching the previous `getMessages()` behavior.

  **To use DESC ordering (newest first):**

  ```typescript
  const result = await storage.listMessages({
    threadId: 'thread-1',
    orderBy: { field: 'createdAt', direction: 'DESC' },
  });
  ```

  ## Client SDK

  ### BREAKING: Renamed `client.getThreadMessages()` → `client.listThreadMessages()`

  **Migration:**

  ```typescript
  // Before
  const response = await client.getThreadMessages(threadId, { agentId });

  // After
  const response = await client.listThreadMessages(threadId, { agentId });
  ```

  The response format remains the same.

  ## Type Changes

  ### BREAKING: Removed `StorageGetMessagesArg` type

  Use `StorageListMessagesInput` instead:

  ```typescript
  // Before
  import type { StorageGetMessagesArg } from '@mastra/core';

  // After
  import type { StorageListMessagesInput } from '@mastra/core';
  ```

- - Removes modelSettings.abortSignal in favour of top-level abortSignal only. Also removes the deprecated output field - use structuredOutput.schema instead. ([`9e1911d`](https://github.com/mastra-ai/mastra/commit/9e1911db2b4db85e0e768c3f15e0d61e319869f6))
  - The deprecated generateVNext() and streamVNext() methods have been removed since they're now the stable generate() and stream() methods.
  - The deprecated `output` option has been removed entirely, in favour of `structuredOutput`.

  Method renames to clarify the API surface:
  - getDefaultGenerateOptions → getDefaultGenerateOptionsLegacy
  - getDefaultStreamOptions → getDefaultStreamOptionsLegacy
  - getDefaultVNextStreamOptions → getDefaultStreamOptions

- Bump minimum required Node.js version to 22.13.0 ([#9706](https://github.com/mastra-ai/mastra/pull/9706))

- Replace `getThreadsByResourceIdPaginated` with `listThreadsByResourceId` across memory handlers. Update client SDK to use `listThreads()` with `offset`/`limit` parameters instead of deprecated `getMemoryThreads()`. Consolidate `/api/memory/threads` routes to single paginated endpoint. ([#9508](https://github.com/mastra-ai/mastra/pull/9508))

- Add new list methods to storage API: `listMessages`, `listMessagesById`, `listThreadsByResourceId`, and `listWorkflowRuns`. Most methods are currently wrappers around existing methods. Full implementations will be added when migrating away from legacy methods. ([#9489](https://github.com/mastra-ai/mastra/pull/9489))

- Update tool execution signature ([#9587](https://github.com/mastra-ai/mastra/pull/9587))

  Consolidated the 3 different execution contexts to one

  ```typescript
  // before depending on the context the tool was executed in
  tool.execute({ context: data });
  tool.execute({ context: { inputData: data } });
  tool.execute(data);

  // now, for all contexts
  tool.execute(data, context);
  ```

  **Before:**

  ```typescript
  inputSchema: z.object({ something: z.string() }),
  execute: async ({ context, tracingContext, runId, ... }) => {
    return doSomething(context.string);
  }
  ```

  **After:**

  ```typescript
  inputSchema: z.object({ something: z.string() }),
  execute: async (inputData, context) => {
    const { agent, mcp, workflow, ...sharedContext } = context

    // context that only an agent would get like toolCallId, messages, suspend, resume, etc
    if (agent) {
      doSomething(inputData.something, agent)
    // context that only a workflow would get like runId, state, suspend, resume, etc
    } else if (workflow) {
      doSomething(inputData.something, workflow)
    // context that only a workflow would get like "extra", "elicitation"
    } else if (mcp) {
      doSomething(inputData.something, mcp)
    } else {
      // Running a tool in no execution context
      return doSomething(inputData.something);
    }
  }
  ```

- The `@mastra/core` package no longer allows top-level imports except for `Mastra` and `type Config`. You must use subpath imports for all other imports. ([#9544](https://github.com/mastra-ai/mastra/pull/9544))

  For example:

  ```diff
    import { Mastra, type Config } from "@mastra/core";
  - import { Agent } from "@mastra/core";
  - import { createTool } from "@mastra/core";
  - import { createStep } from "@mastra/core";

  + import { Agent } from "@mastra/core/agent";
  + import { createTool } from "@mastra/core/tools";
  + import { createStep } from "@mastra/core/workflows";
  ```

- This simplifies the Memory API by removing the confusing rememberMessages method and renaming query to recall for better clarity. ([#9701](https://github.com/mastra-ai/mastra/pull/9701))

  The rememberMessages method name implied it might persist data when it was actually just retrieving messages, same as query. Having two methods that did essentially the same thing was unnecessary.

  Before:

  ```typescript
  // Two methods that did the same thing
  memory.rememberMessages({ threadId, resourceId, config, vectorMessageSearch });
  memory.query({ threadId, resourceId, perPage, vectorSearchString });
  ```

  After:

  ```typescript
  // Single unified method with clear purpose
  memory.recall({ threadId, resourceId, perPage, vectorMessageSearch, threadConfig });
  ```

  All usages have been updated across the codebase including tests. The agent now calls recall directly with the appropriate parameters.

- Rename RuntimeContext to RequestContext ([#9511](https://github.com/mastra-ai/mastra/pull/9511))

- Implement listMessages API for replacing previous methods ([#9531](https://github.com/mastra-ai/mastra/pull/9531))

- Rename `defaultVNextStreamOptions` to `defaultOptions`. Add "Legacy" suffix to v1 option properties and methods (`defaultGenerateOptions` → `defaultGenerateOptionsLegacy`, `defaultStreamOptions` → `defaultStreamOptionsLegacy`). ([#9535](https://github.com/mastra-ai/mastra/pull/9535))

- Remove `getThreadsByResourceId` and `getThreadsByResourceIdPaginated` methods from storage interfaces in favor of `listThreadsByResourceId`. The new method uses `offset`/`limit` pagination and a nested `orderBy` object structure (`{ field, direction }`). ([#9536](https://github.com/mastra-ai/mastra/pull/9536))

- Remove `getMessagesById` method from storage interfaces in favor of `listMessagesById`. The new method only returns V2-format messages and removes the format parameter, simplifying the API surface. Users should migrate from `getMessagesById({ messageIds, format })` to `listMessagesById({ messageIds })`. ([#9534](https://github.com/mastra-ai/mastra/pull/9534))

- Experimental auth -> auth ([#9660](https://github.com/mastra-ai/mastra/pull/9660))

- Renamed a bunch of observability/tracing-related things to drop the AI prefix. ([#9744](https://github.com/mastra-ai/mastra/pull/9744))

- Removed MastraMessageV3 intermediary format, now we go from MastraDBMessage->aiv5 formats and back directly ([#9094](https://github.com/mastra-ai/mastra/pull/9094))

- **Breaking Change**: Remove legacy v1 watch events and consolidate on v2 implementation. ([#9252](https://github.com/mastra-ai/mastra/pull/9252))

  This change simplifies the workflow watching API by removing the legacy v1 event system and promoting v2 as the standard (renamed to just `watch`).

  ### What's Changed
  - Removed legacy v1 watch event handlers and types
  - Renamed `watch-v2` to `watch` throughout the codebase
  - Removed `.watch()` method from client-js SDK (`Workflow` and `AgentBuilder` classes)
  - Removed `/watch` HTTP endpoints from server and deployer
  - Removed `WorkflowWatchResult` and v1 `WatchEvent` types

- Remove various deprecated APIs from agent class. ([#9257](https://github.com/mastra-ai/mastra/pull/9257))
  - `agent.llm` → `agent.getLLM()`
  - `agent.tools` → `agent.getTools()`
  - `agent.instructions` → `agent.getInstructions()`
  - `agent.speak()` → `agent.voice.speak()`
  - `agent.getSpeakers()` → `agent.voice.getSpeakers()`
  - `agent.listen` → `agent.voice.listen()`
  - `agent.fetchMemory` → `(await agent.getMemory()).query()`
  - `agent.toStep` → Add agent directly to the step, workflows handle the transformation

- **BREAKING CHANGE**: Pagination APIs now use `page`/`perPage` instead of `offset`/`limit` ([#9592](https://github.com/mastra-ai/mastra/pull/9592))

  All storage and memory pagination APIs have been updated to use `page` (0-indexed) and `perPage` instead of `offset` and `limit`, aligning with standard REST API patterns.

  **Affected APIs:**
  - `Memory.listThreadsByResourceId()`
  - `Memory.listMessages()`
  - `Storage.listWorkflowRuns()`

  **Migration:**

  ```typescript
  // Before
  await memory.listThreadsByResourceId({
    resourceId: 'user-123',
    offset: 20,
    limit: 10,
  });

  // After
  await memory.listThreadsByResourceId({
    resourceId: 'user-123',
    page: 2, // page = Math.floor(offset / limit)
    perPage: 10,
  });

  // Before
  await memory.listMessages({
    threadId: 'thread-456',
    offset: 20,
    limit: 10,
  });

  // After
  await memory.listMessages({
    threadId: 'thread-456',
    page: 2,
    perPage: 10,
  });

  // Before
  await storage.listWorkflowRuns({
    workflowName: 'my-workflow',
    offset: 20,
    limit: 10,
  });

  // After
  await storage.listWorkflowRuns({
    workflowName: 'my-workflow',
    page: 2,
    perPage: 10,
  });
  ```

  **Additional improvements:**
  - Added validation for negative `page` values in all storage implementations
  - Improved `perPage` validation to handle edge cases (negative values, `0`, `false`)
  - Added reusable query parser utilities for consistent validation in handlers

- ```([#9709](https://github.com/mastra-ai/mastra/pull/9709))
  import { Mastra } from '@mastra/core';
  import { Observability } from '@mastra/observability';  // Explicit import

  const mastra = new Mastra({
    ...other_config,
    observability: new Observability({
      default: { enabled: true }
    })  // Instance
  });
  ```

  Instead of:

  ```
  import { Mastra } from '@mastra/core';
  import '@mastra/observability/init';  // Explicit import

  const mastra = new Mastra({
    ...other_config,
    observability: {
      default: { enabled: true }
    }
  });
  ```

  Also renamed a bunch of:
  - `Tracing` things to `Observability` things.
  - `AI-` things to just things.

- Changing getAgents -> listAgents, getTools -> listTools, getWorkflows -> listWorkflows ([#9495](https://github.com/mastra-ai/mastra/pull/9495))

- Removed old tracing code based on OpenTelemetry ([#9237](https://github.com/mastra-ai/mastra/pull/9237))

- Remove deprecated vector prompts and cohere provider from code ([#9596](https://github.com/mastra-ai/mastra/pull/9596))

- Mark as stable ([`83d5942`](https://github.com/mastra-ai/mastra/commit/83d5942669ce7bba4a6ca4fd4da697a10eb5ebdc))

- Enforcing id required on Processor primitive ([#9591](https://github.com/mastra-ai/mastra/pull/9591))

- **Breaking Changes:** ([#9045](https://github.com/mastra-ai/mastra/pull/9045))
  - Moved `generateTitle` from `threads.generateTitle` to top-level memory option
  - Changed default value from `true` to `false`
  - Using `threads.generateTitle` now throws an error

  **Migration:**
  Replace `threads: { generateTitle: true }` with `generateTitle: true` at the top level of memory options.

  **Playground:**
  The playground UI now displays thread IDs instead of "Chat from" when titles aren't generated.

- Renamed `MastraMessageV2` to `MastraDBMessage` ([#9255](https://github.com/mastra-ai/mastra/pull/9255))
  Made the return format of all methods that return db messages consistent. It's always `{ messages: MastraDBMessage[] }` now, and messages can be converted after that using `@mastra/ai-sdk/ui`'s `toAISdkV4/5Messages()` function

- moved ai-tracing code into @mastra/observability ([#9661](https://github.com/mastra-ai/mastra/pull/9661))

- Remove legacy evals from Mastra ([#9491](https://github.com/mastra-ai/mastra/pull/9491))

- Removes deprecated input-processor type and processors. ([#9200](https://github.com/mastra-ai/mastra/pull/9200))

### Minor Changes

- **BREAKING CHANGE**: Memory scope defaults changed from 'thread' to 'resource' ([#8983](https://github.com/mastra-ai/mastra/pull/8983))

  Both `workingMemory.scope` and `semanticRecall.scope` now default to `'resource'` instead of `'thread'`. This means:
  - Working memory persists across all conversations for the same user/resource
  - Semantic recall searches across all threads for the same user/resource

  **Migration**: To maintain the previous thread-scoped behavior, explicitly set `scope: 'thread'`:

  ```typescript
  memory: new Memory({
    storage,
    workingMemory: {
      enabled: true,
      scope: 'thread', // Explicitly set for thread-scoped behavior
    },
    semanticRecall: {
      scope: 'thread', // Explicitly set for thread-scoped behavior
    },
  }),
  ```

  See the [migration guide](https://mastra.ai/docs/guides/migrations/memory-scope-defaults) for more details.

  Also fixed issues where playground semantic recall search could show missing or incorrect results in certain cases.

- Rename LLM span types and attributes to use Model prefix ([#9105](https://github.com/mastra-ai/mastra/pull/9105))

  BREAKING CHANGE: This release renames tracing span types and attribute interfaces to use the "Model" prefix instead of "LLM":
  - `AISpanType.LLM_GENERATION` → `AISpanType.MODEL_GENERATION`
  - `AISpanType.LLM_STEP` → `AISpanType.MODEL_STEP`
  - `AISpanType.LLM_CHUNK` → `AISpanType.MODEL_CHUNK`
  - `LLMGenerationAttributes` → `ModelGenerationAttributes`
  - `LLMStepAttributes` → `ModelStepAttributes`
  - `LLMChunkAttributes` → `ModelChunkAttributes`
  - `InternalSpans.LLM` → `InternalSpans.MODEL`

  This change better reflects that these span types apply to all AI models, not just Large Language Models.

  Migration guide:
  - Update all imports: `import { ModelGenerationAttributes } from '@mastra/core/ai-tracing'`
  - Update span type references: `AISpanType.MODEL_GENERATION`
  - Update InternalSpans usage: `InternalSpans.MODEL`

### Patch Changes

- Add exponential backoff to model retry logic to prevent cascading failures ([#9798](https://github.com/mastra-ai/mastra/pull/9798))

  When AI model calls fail, the system now implements exponential backoff (1s, 2s, 4s, 8s, max 10s) before retrying instead of immediately hammering the API. This prevents:
  - Rate limit violations from getting worse
  - Cascading failures across all fallback models
  - Wasted API quota by burning through retries instantly
  - Production outages when all models fail due to rate limits

  The backoff gives APIs time to recover from transient failures and rate limiting.

- Update provider registry and model documentation with latest models and providers ([`f743dbb`](https://github.com/mastra-ai/mastra/commit/f743dbb8b40d1627b5c10c0e6fc154f4ebb6e394))

- Fix agent onChunk callback receiving wrapped chunk instead of direct chunk ([#9350](https://github.com/mastra-ai/mastra/pull/9350))

- Deprecate `runCount` parameter in favor of `retryCount` for better naming clarity. The name `runCount` was misleading as it doesn't represent the total number of times a step has run, but rather the number of retry attempts made for a step. ([#9153](https://github.com/mastra-ai/mastra/pull/9153))

  `runCount` is available in `execute()` functions and methods that interact with the step execution. This also applies to condition functions and loop condition functions that use this parameter. If your code uses `runCount`, change the name to `retryCount`.

  Here's an example migration:

  ```diff
  const myStep = createStep({
    // Rest of step...
  -  execute: async ({ runCount, ...params }) => {
  +  execute: async ({ retryCount, ...params }) => {
      // ... rest of your logic
    }
  });
  ```

- Add requestContext column if it does not exist ([#9786](https://github.com/mastra-ai/mastra/pull/9786))

- Track usage in workflow and agent network ([#9649](https://github.com/mastra-ai/mastra/pull/9649))

- Allow resuming nested workflow step with chained id ([#9459](https://github.com/mastra-ai/mastra/pull/9459))

  Example, you have a workflow like this

  ```
  export const supportWorkflow = mainWorkflow.then(nestedWorkflow).commit();
  ```

  And a step in `nestedWorkflow` is supsended, you can now also resume it any of these ways:

  ```
  run.resume({
    step: "nestedWorkflow.suspendedStep", //chained nested workflow step id and suspended step id
    //other resume params
   })
  ```

  OR

  ```
  run.resume({
    step: "nestedWorkflow", // just the nested workflow step/step id
    //other resume params
   })
  ```

- Fix OpenAI schema validation errors in processors ([#9093](https://github.com/mastra-ai/mastra/pull/9093))

- Breaking change to move mcp related tool execute arguments nested under an `mcp` argument that is only populated if the tool is passed to an MCPServer. This simpliflies tool definitions and gives you the correct types when working with tools meant for MCP servers. ([#9134](https://github.com/mastra-ai/mastra/pull/9134))

- Ensure model_generation spans end before agent_run spans. ([#9251](https://github.com/mastra-ai/mastra/pull/9251))

- Fix workflow input property preservation after resume from snapshot ([#9380](https://github.com/mastra-ai/mastra/pull/9380))

  Ensure that when resuming a workflow from a snapshot, the input property is correctly set from the snapshot's context input rather than from resume data. This prevents the loss of original workflow input data during suspend/resume cycles.

- Add tool call approval ([#8649](https://github.com/mastra-ai/mastra/pull/8649))

- Fix error handling and serialization in agent streaming to ensure errors are consistently exposed and preserved. ([#9144](https://github.com/mastra-ai/mastra/pull/9144))

- Fixes issue where clicking the reset button in the model picker would fail to restore the original LanguageModelV2 (or any other types) object that was passed during agent construction. ([#9481](https://github.com/mastra-ai/mastra/pull/9481))

- Fix a bug where streaming didn't output the final chunk ([#9546](https://github.com/mastra-ai/mastra/pull/9546))

- Don't call `os.homedir()` at top level (but lazy invoke it) to accommodate sandboxed environments ([#9211](https://github.com/mastra-ai/mastra/pull/9211))

- Fix: Don't download unsupported media ([#9209](https://github.com/mastra-ai/mastra/pull/9209))

- Detect thenable objects returned by AI model providers ([#8905](https://github.com/mastra-ai/mastra/pull/8905))

- Fixes incorrect tool invocation format in message list that was causing client tools to fail during message format conversions. ([#9590](https://github.com/mastra-ai/mastra/pull/9590))

- Bug fix: Use input processors that are passed in generate or stream agent options rather than always defaulting to the processors set on the Agent class. ([#9407](https://github.com/mastra-ai/mastra/pull/9407))

- Fix tool input validation to use schema-compat transformed schemas ([#9258](https://github.com/mastra-ai/mastra/pull/9258))

  Previously, tool input validation used the original Zod schema while the LLM received a schema-compat transformed version. This caused validation failures when LLMs (like OpenAI o3 or Claude 3.5 Haiku) sent arguments matching the transformed schema but not the original.

  For example:
  - OpenAI o3 reasoning models convert `.optional()` to `.nullable()`, sending `null` values
  - Claude 3.5 Haiku strips `min`/`max` string constraints, sending shorter strings
  - Validation would reject these valid responses because it checked against the original schema

  The fix ensures validation uses the same schema-compat processed schema that was sent to the LLM, eliminating this mismatch.

- Add import for WriteableStream in execution-engine and dedupe llm.getModel in agent.ts ([#9185](https://github.com/mastra-ai/mastra/pull/9185))

- Use a shared `getAllToolPaths()` method from the bundler to discover tool paths. ([#9204](https://github.com/mastra-ai/mastra/pull/9204))

- Added support for .streamVNext and .stream that uses it in the inngest execution engine ([#9434](https://github.com/mastra-ai/mastra/pull/9434))

- pass writableStream parameter to workflow execution ([#9139](https://github.com/mastra-ai/mastra/pull/9139))

- Remove tools passed to the Routing Agent in .network() ([#9374](https://github.com/mastra-ai/mastra/pull/9374))

- Fix agent network iteration counter bug causing infinite loops ([#9762](https://github.com/mastra-ai/mastra/pull/9762))

  The iteration counter in agent networks was stuck at 0 due to a faulty ternary operator that treated 0 as falsy. This prevented `maxSteps` from working correctly, causing infinite loops when the routing agent kept selecting primitives instead of returning "none".

  **Changes:**
  - Fixed iteration counter logic in `loop/network/index.ts` from `(inputData.iteration ? inputData.iteration : -1) + 1` to `(inputData.iteration ?? -1) + 1`
  - Changed initial iteration value from `0` to `-1` so first iteration correctly starts at 0
  - Added `checkIterations()` helper to validate iteration counting in all network tests

  Fixes #9314

- Fix types from ai v4 ([#9818](https://github.com/mastra-ai/mastra/pull/9818))

- Save correct status in snapshot for all workflow parallel steps. ([#9379](https://github.com/mastra-ai/mastra/pull/9379))
  This ensures when you poll workflow run result using `getWorkflowRunExecutionResult(runId)`, you get the right status for all parallel steps

- Prevent changing workflow status to suspended when some parallel steps are still running ([#9431](https://github.com/mastra-ai/mastra/pull/9431))

- Add ability to pass agent options when wrapping an agent with createStep. This allows configuring agent execution settings when using agents as workflow steps. ([#9199](https://github.com/mastra-ai/mastra/pull/9199))

- Fix MCP server registration ([#9802](https://github.com/mastra-ai/mastra/pull/9802))

- Fix network loop iteration counter and usage promise handling: ([#9408](https://github.com/mastra-ai/mastra/pull/9408))
  - Fixed iteration counter in network loop that was stuck at 0 due to falsy check. Properly handled zero values to ensure maxSteps is correctly enforced.
  - Fixed usage promise resolution in RunOutput stream by properly resolving or rejecting the promise on stream close, preventing hanging promises when streams complete.

- Remove `waitForEvent` from workflows. `waitForEvent` is now removed, please use suspend & resume flow instead. See https://mastra.ai/en/docs/workflows/suspend-and-resume for more details on suspend & resume flow. ([#9214](https://github.com/mastra-ai/mastra/pull/9214))

- Workflow validation zod v4 support ([#9319](https://github.com/mastra-ai/mastra/pull/9319))

- Use memory mock in server tests ([#9486](https://github.com/mastra-ai/mastra/pull/9486))

- Fix network routing agent smoothstreaming ([#9247](https://github.com/mastra-ai/mastra/pull/9247))

- Remove format from stream/generate ([#9577](https://github.com/mastra-ai/mastra/pull/9577))

- Fix agent network working memory tool routing. Memory tools are now included in routing agent instructions but excluded from its direct tool calls, allowing the routing agent to properly route to tool execution steps for memory updates. ([#9428](https://github.com/mastra-ai/mastra/pull/9428))

- Fix creating system messages from inside processors using processInput. ([#9469](https://github.com/mastra-ai/mastra/pull/9469))

- Fix usage tracking with agent network ([#9226](https://github.com/mastra-ai/mastra/pull/9226))

- Fix message conversion for incomplete client-side tool calls ([#9749](https://github.com/mastra-ai/mastra/pull/9749))

  Fixed handling of `input-available` tool state in `sanitizeV5UIMessages()` to differentiate between two use cases:
  1. **Response messages FROM the LLM**: Keep `input-available` states (tool calls waiting for client-side execution) in `response.messages` for proper message history.
  2. **Prompt messages TO the LLM**: Filter out `input-available` states when sending historical messages back to the LLM, as these incomplete tool calls (without results) cause errors in the OpenAI Responses API.

  The fix adds a `filterIncompleteToolCalls` parameter to control this behavior based on whether messages are being sent to or received from the LLM.

- Add `initialState` and `outputOptions` to run.stream() call. ([#9238](https://github.com/mastra-ai/mastra/pull/9238))

  Example code

  ```
  const run = await workflow.createRunAsync();

  const streamResult = run.stream({
    inputData: {},
    initialState: { value: 'test-state', otherValue: 'test-other-state' },
    outputOptions: { includeState: true },
  });
  ```

  Then the result from the stream will include the final state information

  ```
  const executionResult = await streamResult.result;
  console.log(executionResult.state)
  ```

- Updated dependencies [[`b9b7ffd`](https://github.com/mastra-ai/mastra/commit/b9b7ffdad6936a7d50b6b814b5bbe54e19087f66), [`dd1c38d`](https://github.com/mastra-ai/mastra/commit/dd1c38d1b75f1b695c27b40d8d9d6ed00d5e0f6f), [`83b08dc`](https://github.com/mastra-ai/mastra/commit/83b08dcf1bfcc915efab23c09207df90fa247908), [`f0f8f12`](https://github.com/mastra-ai/mastra/commit/f0f8f125c308f2d0fd36942ef652fd852df7522f), [`f111eac`](https://github.com/mastra-ai/mastra/commit/f111eac5de509b2e5fccfc1882e7f74cda264c74), [`51acef9`](https://github.com/mastra-ai/mastra/commit/51acef95b5977826594fe3ee24475842bd3d5780), [`eb09742`](https://github.com/mastra-ai/mastra/commit/eb09742197f66c4c38154c3beec78313e69760b2), [`354ad0b`](https://github.com/mastra-ai/mastra/commit/354ad0b7b1b8183ac567f236a884fc7ede6d7138), [`83d5942`](https://github.com/mastra-ai/mastra/commit/83d5942669ce7bba4a6ca4fd4da697a10eb5ebdc), [`a0c8c1b`](https://github.com/mastra-ai/mastra/commit/a0c8c1b87d4fee252aebda73e8637fbe01d761c9)]:
  - @mastra/schema-compat@1.0.0-beta.0
  - @mastra/observability@1.0.0-beta.0

## 0.22.2

### Patch Changes

- Fix nested workflow events and networks ([#9132](https://github.com/mastra-ai/mastra/pull/9132))

## 0.22.2-alpha.0

### Patch Changes

- Fix nested workflow events and networks ([#9132](https://github.com/mastra-ai/mastra/pull/9132))

## 0.22.1

## 0.22.1-alpha.0

## 0.22.0

### Minor Changes

- Consolidate streamVNext logic into stream, move old stream function into streamLegacy ([#9092](https://github.com/mastra-ai/mastra/pull/9092))

### Patch Changes

- Update provider registry and model documentation with latest models and providers ([`c67ca32`](https://github.com/mastra-ai/mastra/commit/c67ca32e3c2cf69bfc146580770c720220ca44ac))

- Update provider registry and model documentation with latest models and providers ([`efb5ed9`](https://github.com/mastra-ai/mastra/commit/efb5ed946ae7f410bc68c9430beb4b010afd25ec))

- Add deprecation warnings for format:ai-sdk ([#9018](https://github.com/mastra-ai/mastra/pull/9018))

- network routing agent text delta ai-sdk streaming ([#8979](https://github.com/mastra-ai/mastra/pull/8979))

- Support writing custom top level stream chunks ([#8922](https://github.com/mastra-ai/mastra/pull/8922))

- Fix incorrect type assertions in Tool class. Created `MastraToolInvocationOptions` type to properly extend AI SDK's `ToolInvocationOptions` with Mastra-specific properties (`suspend`, `resumeData`, `writableStream`). Removed unsafe type assertions from tool execution code. ([#9033](https://github.com/mastra-ai/mastra/pull/9033))

- fix(core): Fix Gemini message ordering validation errors (#7287, #8053) ([#8069](https://github.com/mastra-ai/mastra/pull/8069))

  Fixes Gemini API "single turn requests" validation error by ensuring the first non-system message is from the user role. This resolves errors when:
  - Messages start with assistant role (e.g., from memory truncation)
  - Tool-call sequences begin with assistant messages

  **Breaking Change**: Empty or system-only message lists now throw an error instead of adding a placeholder user message, preventing confusing LLM responses.

  This fix handles both issue #7287 (tool-call ordering) and #8053 (single-turn validation) by inserting a placeholder user message when needed.

- Add support for external trace and parent span IDs in TracingOptions. This enables integration with external tracing systems by allowing new AI traces to be started with existing traceId and parentSpanId values. The implementation includes OpenTelemetry-compatible ID validation (32 hex chars for trace IDs, 16 hex chars for span IDs). ([#9053](https://github.com/mastra-ai/mastra/pull/9053))

- Updated `watch` and `watchAsync` methods to use proper function overloads instead of generic conditional types, ensuring compatibility with the base Run class signatures. ([#9048](https://github.com/mastra-ai/mastra/pull/9048))

- Fix tracing context propagation to agent steps in workflows ([#9074](https://github.com/mastra-ai/mastra/pull/9074))

  When creating a workflow step from an agent using `createStep(myAgent)`, the tracing context was not being passed to the agent's `stream()` and `streamLegacy()` methods. This caused tracing spans to break in the workflow chain.

  This fix ensures that `tracingContext` is properly propagated to both agent.stream() and agent.streamLegacy() calls, matching the behavior of tool steps which already propagate tracingContext correctly.

- Fixes how reasoning chunks are stored in memory to prevent data loss and ensure they are consolidated as single message parts rather than split into word-level fragments. ([#9041](https://github.com/mastra-ai/mastra/pull/9041))

- fixes an issue where input processors couldn't add system or assistant messages. Previously all messages from input processors were forced to be user messages, causing an error when trying to add other role types. ([#8835](https://github.com/mastra-ai/mastra/pull/8835))

- fix(core): Validate structured output at text-end instead of flush ([#8934](https://github.com/mastra-ai/mastra/pull/8934))

  Fixes structured output validation for Bedrock and LMStudio by moving validation from `flush()` to `text-end` chunk. Eliminates `finishReason` heuristics, adds special token extraction for LMStudio, and validates at the correct point in stream lifecycle.

- fix model.loop.test.ts tests to use structuredOutput.schema and add assertions ([#8926](https://github.com/mastra-ai/mastra/pull/8926))

- Add `initialState` as an option to `.streamVNext()` ([#9071](https://github.com/mastra-ai/mastra/pull/9071))

- added resourceId and runId to workflow_run metadata in ai tracing ([#9031](https://github.com/mastra-ai/mastra/pull/9031))

- When using OpenAI models with JSON response format, automatically enable strict schema validation. ([#8924](https://github.com/mastra-ai/mastra/pull/8924))

- Fix custom metadata preservation in UIMessages when loading threads. The `getMessagesHandler` now converts `messagesV2` (V2 format with metadata) instead of `messages` (V1 format without metadata) to AIV5.UI format. Also updates the abstract `MastraMemory.query()` return type to include `messagesV2` for proper type safety. ([#9029](https://github.com/mastra-ai/mastra/pull/9029))

- Fix TypeScript type errors when using provider-defined tools from external AI SDK packages. ([#8940](https://github.com/mastra-ai/mastra/pull/8940))

  Agents can now accept provider tools like `google.tools.googleSearch()` without type errors. Creates new `@internal/external-types` package to centralize AI SDK type re-exports and adds `ProviderDefinedTool` structural type to handle tools from different package versions/instances due to TypeScript's module path discrimination.

- feat(ai-tracing): Add automatic metadata extraction from RuntimeContext to spans ([#9072](https://github.com/mastra-ai/mastra/pull/9072))

  Enables automatic extraction of RuntimeContext values as metadata for AI tracing spans across entire traces.

  Key features:
  - Configure `runtimeContextKeys` in TracingConfig to extract specific keys from RuntimeContext
  - Add per-request keys via `tracingOptions.runtimeContextKeys` for trace-specific additions
  - Supports dot notation for nested values (e.g., 'user.id', 'session.data.experimentId')
  - TraceState computed once at root span and inherited by all child spans
  - Explicit metadata in span options takes precedence over extracted metadata

  Example:

  ```typescript
  const mastra = new Mastra({
    observability: {
      configs: {
        default: {
          runtimeContextKeys: ['userId', 'environment', 'tenantId'],
        },
      },
    },
  });

  await agent.generate({
    messages,
    runtimeContext,
    tracingOptions: {
      runtimeContextKeys: ['experimentId'], // Adds to configured keys
    },
  });
  ```

- Fix provider tools for popular providers and add support for anthropic/claude skills. ([#9038](https://github.com/mastra-ai/mastra/pull/9038))

- Refactor workflowstream into workflow output with fullStream property ([#9048](https://github.com/mastra-ai/mastra/pull/9048))

- Added the ability to use model router configs for embedders (eg "openai/text-embedding-ada-002") ([#8992](https://github.com/mastra-ai/mastra/pull/8992))

- Always set supportsStructuredOutputs true for openai compatible provider. ([#8933](https://github.com/mastra-ai/mastra/pull/8933))

- Support for custom resume labels mapping to step to be resumed ([#8941](https://github.com/mastra-ai/mastra/pull/8941))

- added tracing of LLM steps & chunks ([#9058](https://github.com/mastra-ai/mastra/pull/9058))

- Fixed an issue where a custom URL in model router still validated unknown providers against the known providers list. Custom URL means we don't necessarily know the provider. This allows local providers like Ollama to work properly ([#8989](https://github.com/mastra-ai/mastra/pull/8989))

- Show agent tool output better in playground ([#9021](https://github.com/mastra-ai/mastra/pull/9021))

- feat: inject schema context into main agent for processor mode structured output ([#8886](https://github.com/mastra-ai/mastra/pull/8886))

- Added providerOptions types to generate/stream for main builtin model router providers (openai/anthropic/google/xai) ([#8995](https://github.com/mastra-ai/mastra/pull/8995))

- Generate a title for Agent.network() threads ([#8853](https://github.com/mastra-ai/mastra/pull/8853))

## 0.22.0-alpha.1

### Minor Changes

- Consolidate streamVNext logic into stream, move old stream function into streamLegacy ([#9092](https://github.com/mastra-ai/mastra/pull/9092))

### Patch Changes

- Update provider registry and model documentation with latest models and providers ([`efb5ed9`](https://github.com/mastra-ai/mastra/commit/efb5ed946ae7f410bc68c9430beb4b010afd25ec))

- Fix incorrect type assertions in Tool class. Created `MastraToolInvocationOptions` type to properly extend AI SDK's `ToolInvocationOptions` with Mastra-specific properties (`suspend`, `resumeData`, `writableStream`). Removed unsafe type assertions from tool execution code. ([#9033](https://github.com/mastra-ai/mastra/pull/9033))

- Add support for external trace and parent span IDs in TracingOptions. This enables integration with external tracing systems by allowing new AI traces to be started with existing traceId and parentSpanId values. The implementation includes OpenTelemetry-compatible ID validation (32 hex chars for trace IDs, 16 hex chars for span IDs). ([#9053](https://github.com/mastra-ai/mastra/pull/9053))

- Updated `watch` and `watchAsync` methods to use proper function overloads instead of generic conditional types, ensuring compatibility with the base Run class signatures. ([#9048](https://github.com/mastra-ai/mastra/pull/9048))

- Fix tracing context propagation to agent steps in workflows ([#9074](https://github.com/mastra-ai/mastra/pull/9074))

  When creating a workflow step from an agent using `createStep(myAgent)`, the tracing context was not being passed to the agent's `stream()` and `streamLegacy()` methods. This caused tracing spans to break in the workflow chain.

  This fix ensures that `tracingContext` is properly propagated to both agent.stream() and agent.streamLegacy() calls, matching the behavior of tool steps which already propagate tracingContext correctly.

- Fixes how reasoning chunks are stored in memory to prevent data loss and ensure they are consolidated as single message parts rather than split into word-level fragments. ([#9041](https://github.com/mastra-ai/mastra/pull/9041))

- fixes an issue where input processors couldn't add system or assistant messages. Previously all messages from input processors were forced to be user messages, causing an error when trying to add other role types. ([#8835](https://github.com/mastra-ai/mastra/pull/8835))

- Add `initialState` as an option to `.streamVNext()` ([#9071](https://github.com/mastra-ai/mastra/pull/9071))

- added resourceId and runId to workflow_run metadata in ai tracing ([#9031](https://github.com/mastra-ai/mastra/pull/9031))

- Fix custom metadata preservation in UIMessages when loading threads. The `getMessagesHandler` now converts `messagesV2` (V2 format with metadata) instead of `messages` (V1 format without metadata) to AIV5.UI format. Also updates the abstract `MastraMemory.query()` return type to include `messagesV2` for proper type safety. ([#9029](https://github.com/mastra-ai/mastra/pull/9029))

- Fix TypeScript type errors when using provider-defined tools from external AI SDK packages. ([#8940](https://github.com/mastra-ai/mastra/pull/8940))

  Agents can now accept provider tools like `google.tools.googleSearch()` without type errors. Creates new `@internal/external-types` package to centralize AI SDK type re-exports and adds `ProviderDefinedTool` structural type to handle tools from different package versions/instances due to TypeScript's module path discrimination.

- feat(ai-tracing): Add automatic metadata extraction from RuntimeContext to spans ([#9072](https://github.com/mastra-ai/mastra/pull/9072))

  Enables automatic extraction of RuntimeContext values as metadata for AI tracing spans across entire traces.

  Key features:
  - Configure `runtimeContextKeys` in TracingConfig to extract specific keys from RuntimeContext
  - Add per-request keys via `tracingOptions.runtimeContextKeys` for trace-specific additions
  - Supports dot notation for nested values (e.g., 'user.id', 'session.data.experimentId')
  - TraceState computed once at root span and inherited by all child spans
  - Explicit metadata in span options takes precedence over extracted metadata

  Example:

  ```typescript
  const mastra = new Mastra({
    observability: {
      configs: {
        default: {
          runtimeContextKeys: ['userId', 'environment', 'tenantId'],
        },
      },
    },
  });

  await agent.generate({
    messages,
    runtimeContext,
    tracingOptions: {
      runtimeContextKeys: ['experimentId'], // Adds to configured keys
    },
  });
  ```

- Fix provider tools for popular providers and add support for anthropic/claude skills. ([#9038](https://github.com/mastra-ai/mastra/pull/9038))

- Refactor workflowstream into workflow output with fullStream property ([#9048](https://github.com/mastra-ai/mastra/pull/9048))

- added tracing of LLM steps & chunks ([#9058](https://github.com/mastra-ai/mastra/pull/9058))

- Show agent tool output better in playground ([#9021](https://github.com/mastra-ai/mastra/pull/9021))

## 0.21.2-alpha.0

### Patch Changes

- Update provider registry and model documentation with latest models and providers ([`c67ca32`](https://github.com/mastra-ai/mastra/commit/c67ca32e3c2cf69bfc146580770c720220ca44ac))

- Add deprecation warnings for format:ai-sdk ([#9018](https://github.com/mastra-ai/mastra/pull/9018))

- network routing agent text delta ai-sdk streaming ([#8979](https://github.com/mastra-ai/mastra/pull/8979))

- Support writing custom top level stream chunks ([#8922](https://github.com/mastra-ai/mastra/pull/8922))

- fix(core): Fix Gemini message ordering validation errors (#7287, #8053) ([#8069](https://github.com/mastra-ai/mastra/pull/8069))

  Fixes Gemini API "single turn requests" validation error by ensuring the first non-system message is from the user role. This resolves errors when:
  - Messages start with assistant role (e.g., from memory truncation)
  - Tool-call sequences begin with assistant messages

  **Breaking Change**: Empty or system-only message lists now throw an error instead of adding a placeholder user message, preventing confusing LLM responses.

  This fix handles both issue #7287 (tool-call ordering) and #8053 (single-turn validation) by inserting a placeholder user message when needed.

- fix(core): Validate structured output at text-end instead of flush ([#8934](https://github.com/mastra-ai/mastra/pull/8934))

  Fixes structured output validation for Bedrock and LMStudio by moving validation from `flush()` to `text-end` chunk. Eliminates `finishReason` heuristics, adds special token extraction for LMStudio, and validates at the correct point in stream lifecycle.

- fix model.loop.test.ts tests to use structuredOutput.schema and add assertions ([#8926](https://github.com/mastra-ai/mastra/pull/8926))

- When using OpenAI models with JSON response format, automatically enable strict schema validation. ([#8924](https://github.com/mastra-ai/mastra/pull/8924))

- Added the ability to use model router configs for embedders (eg "openai/text-embedding-ada-002") ([#8992](https://github.com/mastra-ai/mastra/pull/8992))

- Always set supportsStructuredOutputs true for openai compatible provider. ([#8933](https://github.com/mastra-ai/mastra/pull/8933))

- Support for custom resume labels mapping to step to be resumed ([#8941](https://github.com/mastra-ai/mastra/pull/8941))

- Fixed an issue where a custom URL in model router still validated unknown providers against the known providers list. Custom URL means we don't necessarily know the provider. This allows local providers like Ollama to work properly ([#8989](https://github.com/mastra-ai/mastra/pull/8989))

- feat: inject schema context into main agent for processor mode structured output ([#8886](https://github.com/mastra-ai/mastra/pull/8886))

- Added providerOptions types to generate/stream for main builtin model router providers (openai/anthropic/google/xai) ([#8995](https://github.com/mastra-ai/mastra/pull/8995))

- Generate a title for Agent.network() threads ([#8853](https://github.com/mastra-ai/mastra/pull/8853))

## 0.21.1

### Patch Changes

- Update provider registry with latest models and providers ([`ca85c93`](https://github.com/mastra-ai/mastra/commit/ca85c932b232e6ad820c811ec176d98e68c59b0a))

- Update provider registry and model documentation with latest models and providers ([`a1d40f8`](https://github.com/mastra-ai/mastra/commit/a1d40f88d4ce42c4508774ad22e38ac582157af2))

- Ability to call agents as tools with .generate()/.stream() ([#8863](https://github.com/mastra-ai/mastra/pull/8863))

- Add runId to `agent-execution-event-{string}` and `workflow-execution-event-{string}` event streamed in network ([#8862](https://github.com/mastra-ai/mastra/pull/8862))

## 0.21.1-alpha.0

### Patch Changes

- Update provider registry with latest models and providers ([`ca85c93`](https://github.com/mastra-ai/mastra/commit/ca85c932b232e6ad820c811ec176d98e68c59b0a))

- Update provider registry and model documentation with latest models and providers ([`a1d40f8`](https://github.com/mastra-ai/mastra/commit/a1d40f88d4ce42c4508774ad22e38ac582157af2))

- Ability to call agents as tools with .generate()/.stream() ([#8863](https://github.com/mastra-ai/mastra/pull/8863))

- Add runId to `agent-execution-event-{string}` and `workflow-execution-event-{string}` event streamed in network ([#8862](https://github.com/mastra-ai/mastra/pull/8862))

## 0.21.0

### Minor Changes

- Standardize model configuration across all Mastra components ([#8626](https://github.com/mastra-ai/mastra/pull/8626))

  All model configuration points now accept the same flexible `MastraModelConfig` type as the `Agent` class:
  - **Scorers**: Judge models now support magic strings, config objects, and dynamic functions
  - **Input/Output Processors**: ModerationProcessor and PIIDetector accept flexible model configs
  - **Relevance Scorers**: MastraAgentRelevanceScorer supports all model config types

  This change provides:
  - Consistent API across all components
  - Support for magic strings (e.g., `"openai/gpt-4o"`)
  - Support for OpenAI-compatible configs with custom URLs
  - Support for dynamic model resolution functions
  - Full backward compatibility with existing code

  Example:

  ```typescript
  // All of these now work everywhere models are accepted
  const scorer = createScorer({
    judge: { model: 'openai/gpt-4o' }, // Magic string
  });

  const processor = new ModerationProcessor({
    model: { id: 'custom/model', url: 'https://...' }, // Custom config
  });

  const relevanceScorer = new MastraAgentRelevanceScorer(
    async ctx => ctx.getModel(), // Dynamic function
  );
  ```

- support model router in structured output and client-js ([#8686](https://github.com/mastra-ai/mastra/pull/8686))

- Update structuredOutput to use response format by default with an opt in to json prompt injection. ([#8557](https://github.com/mastra-ai/mastra/pull/8557))
  Replaced internal usage of output with structuredOutput.

- Standardize model configuration across all components to support flexible model resolution ([#8626](https://github.com/mastra-ai/mastra/pull/8626))

  All model configuration points now accept `MastraModelConfig`, enabling consistent model specification across:
  - Scorers (`createScorer` and all built-in scorers)
  - Input/Output Processors (`ModerationProcessor`, `PIIDetector`)
  - Relevance Scorers (`MastraAgentRelevanceScorer`)

  **Supported formats:**
  - Magic strings: `'openai/gpt-4o-mini'`
  - Config objects: `{ id: 'openai/gpt-4o-mini' }` or `{ providerId: 'openai', modelId: 'gpt-4o-mini' }`
  - Custom endpoints: `{ id: 'custom/model', url: 'https://...', apiKey: '...' }`
  - Dynamic resolution: `(ctx) => 'openai/gpt-4o-mini'`

  This change provides a unified model configuration experience matching the `Agent` class, making it easier to switch models and use custom providers across all Mastra components.

### Patch Changes

- Fix aisdk format in workflow breaking stream ([#8716](https://github.com/mastra-ai/mastra/pull/8716))

- fix: preserve providerOptions through message list conversions ([#8837](https://github.com/mastra-ai/mastra/pull/8837))

- improve error propagation in agent stream failures ([#8733](https://github.com/mastra-ai/mastra/pull/8733))

- prevent duplicate deprecation warning logs and deprecate modelSettings.abortSignal in favor of top-level abortSignal ([#8840](https://github.com/mastra-ai/mastra/pull/8840))

- Removed logging of massive model objects in tool failures ([#8839](https://github.com/mastra-ai/mastra/pull/8839))

- Create unified Sidebar component to use on Playground and Cloud ([#8655](https://github.com/mastra-ai/mastra/pull/8655))

- Added tracing of input & output processors (this includes using structuredOutput) ([#8623](https://github.com/mastra-ai/mastra/pull/8623))

- ai-sdk workflow route, agent network route ([#8672](https://github.com/mastra-ai/mastra/pull/8672))

- Handle maxRetries in agent.generate/stream properly. Add deprecation warning to top level abortSignal in AgentExecuteOptions as that property is duplicated inside of modelSettings as well. ([#8729](https://github.com/mastra-ai/mastra/pull/8729))

- Include span id and trace id when running live scorers ([#8842](https://github.com/mastra-ai/mastra/pull/8842))

- Added deprecation warnings for stream and observeStream. We will switch the implementation to streamVNext/observeStreamVNext in the future. ([#8701](https://github.com/mastra-ai/mastra/pull/8701))

- Add div wrapper around entity tables to fix table vertical position ([#8758](https://github.com/mastra-ai/mastra/pull/8758))

- Customize AITraces type to seamlessly work on Cloud too ([#8759](https://github.com/mastra-ai/mastra/pull/8759))

- Refactor EntryList component and Scorer and Observability pages ([#8652](https://github.com/mastra-ai/mastra/pull/8652))

- Add support for exporting scores for external observability providers ([#8335](https://github.com/mastra-ai/mastra/pull/8335))

- Stream finalResult from network loop ([#8795](https://github.com/mastra-ai/mastra/pull/8795))

- Fix broken `generateTitle` behaviour #8726, make `generateTitle: true` default memory setting ([#8800](https://github.com/mastra-ai/mastra/pull/8800))

- Improve README ([#8819](https://github.com/mastra-ai/mastra/pull/8819))

- nested ai-sdk workflows and networks streaming support ([#8614](https://github.com/mastra-ai/mastra/pull/8614))

## 0.21.0-alpha.4

### Patch Changes

- Include span id and trace id when running live scorers ([#8842](https://github.com/mastra-ai/mastra/pull/8842))

## 0.21.0-alpha.3

### Patch Changes

- prevent duplicate deprecation warning logs and deprecate modelSettings.abortSignal in favor of top-level abortSignal ([#8840](https://github.com/mastra-ai/mastra/pull/8840))

- Removed logging of massive model objects in tool failures ([#8839](https://github.com/mastra-ai/mastra/pull/8839))

## 0.21.0-alpha.2

### Patch Changes

- fix: preserve providerOptions through message list conversions ([#8837](https://github.com/mastra-ai/mastra/pull/8837))

## 0.21.0-alpha.1

### Patch Changes

- Fix aisdk format in workflow breaking stream ([#8716](https://github.com/mastra-ai/mastra/pull/8716))

- improve error propagation in agent stream failures ([#8733](https://github.com/mastra-ai/mastra/pull/8733))

- Create unified Sidebar component to use on Playground and Cloud ([#8655](https://github.com/mastra-ai/mastra/pull/8655))

- Added tracing of input & output processors (this includes using structuredOutput) ([#8623](https://github.com/mastra-ai/mastra/pull/8623))

- ai-sdk workflow route, agent network route ([#8672](https://github.com/mastra-ai/mastra/pull/8672))

- Handle maxRetries in agent.generate/stream properly. Add deprecation warning to top level abortSignal in AgentExecuteOptions as that property is duplicated inside of modelSettings as well. ([#8729](https://github.com/mastra-ai/mastra/pull/8729))

- Added deprecation warnings for stream and observeStream. We will switch the implementation to streamVNext/observeStreamVNext in the future. ([#8701](https://github.com/mastra-ai/mastra/pull/8701))

- Add div wrapper around entity tables to fix table vertical position ([#8758](https://github.com/mastra-ai/mastra/pull/8758))

- Customize AITraces type to seamlessly work on Cloud too ([#8759](https://github.com/mastra-ai/mastra/pull/8759))

- Stream finalResult from network loop ([#8795](https://github.com/mastra-ai/mastra/pull/8795))

- Fix broken `generateTitle` behaviour #8726, make `generateTitle: true` default memory setting ([#8800](https://github.com/mastra-ai/mastra/pull/8800))

- Improve README ([#8819](https://github.com/mastra-ai/mastra/pull/8819))

## 0.21.0-alpha.0

### Minor Changes

- Standardize model configuration across all Mastra components ([#8626](https://github.com/mastra-ai/mastra/pull/8626))

  All model configuration points now accept the same flexible `MastraModelConfig` type as the `Agent` class:
  - **Scorers**: Judge models now support magic strings, config objects, and dynamic functions
  - **Input/Output Processors**: ModerationProcessor and PIIDetector accept flexible model configs
  - **Relevance Scorers**: MastraAgentRelevanceScorer supports all model config types

  This change provides:
  - Consistent API across all components
  - Support for magic strings (e.g., `"openai/gpt-4o"`)
  - Support for OpenAI-compatible configs with custom URLs
  - Support for dynamic model resolution functions
  - Full backward compatibility with existing code

  Example:

  ```typescript
  // All of these now work everywhere models are accepted
  const scorer = createScorer({
    judge: { model: 'openai/gpt-4o' }, // Magic string
  });

  const processor = new ModerationProcessor({
    model: { id: 'custom/model', url: 'https://...' }, // Custom config
  });

  const relevanceScorer = new MastraAgentRelevanceScorer(
    async ctx => ctx.getModel(), // Dynamic function
  );
  ```

- support model router in structured output and client-js ([#8686](https://github.com/mastra-ai/mastra/pull/8686))

- Update structuredOutput to use response format by default with an opt in to json prompt injection. ([#8557](https://github.com/mastra-ai/mastra/pull/8557))
  Replaced internal usage of output with structuredOutput.

- Standardize model configuration across all components to support flexible model resolution ([#8626](https://github.com/mastra-ai/mastra/pull/8626))

  All model configuration points now accept `MastraModelConfig`, enabling consistent model specification across:
  - Scorers (`createScorer` and all built-in scorers)
  - Input/Output Processors (`ModerationProcessor`, `PIIDetector`)
  - Relevance Scorers (`MastraAgentRelevanceScorer`)

  **Supported formats:**
  - Magic strings: `'openai/gpt-4o-mini'`
  - Config objects: `{ id: 'openai/gpt-4o-mini' }` or `{ providerId: 'openai', modelId: 'gpt-4o-mini' }`
  - Custom endpoints: `{ id: 'custom/model', url: 'https://...', apiKey: '...' }`
  - Dynamic resolution: `(ctx) => 'openai/gpt-4o-mini'`

  This change provides a unified model configuration experience matching the `Agent` class, making it easier to switch models and use custom providers across all Mastra components.

### Patch Changes

- Refactor EntryList component and Scorer and Observability pages ([#8652](https://github.com/mastra-ai/mastra/pull/8652))

- Add support for exporting scores for external observability providers ([#8335](https://github.com/mastra-ai/mastra/pull/8335))

- nested ai-sdk workflows and networks streaming support ([#8614](https://github.com/mastra-ai/mastra/pull/8614))

- Rename internal ai-sdk packages to have ai-v5 versions as default and ai-v4 versions as npm namespaced. Also moves ai-sdk provider packages to devDeps. ([#8687](https://github.com/mastra-ai/mastra/pull/8687))

## 0.20.2

### Patch Changes

- Pass through input/output processors to the server agent endpoints ([#8546](https://github.com/mastra-ai/mastra/pull/8546))

- Add structuredOutput data to response message metadata so it will be persisted. ([#8588](https://github.com/mastra-ai/mastra/pull/8588))

- Add shouldPersistSnapshot to control when to persist run snapshot ([#8617](https://github.com/mastra-ai/mastra/pull/8617))

- moved ai tracing startup logs to debug level ([#8625](https://github.com/mastra-ai/mastra/pull/8625))

## 0.20.2-alpha.1

### Patch Changes

- Pass through input/output processors to the server agent endpoints ([#8546](https://github.com/mastra-ai/mastra/pull/8546))

- moved ai tracing startup logs to debug level ([#8625](https://github.com/mastra-ai/mastra/pull/8625))

## 0.20.2-alpha.0

### Patch Changes

- Add structuredOutput data to response message metadata so it will be persisted. ([#8588](https://github.com/mastra-ai/mastra/pull/8588))

- Add shouldPersistSnapshot to control when to persist run snapshot ([#8617](https://github.com/mastra-ai/mastra/pull/8617))

## 0.20.1

### Patch Changes

- workflow run thread more visible ([#8539](https://github.com/mastra-ai/mastra/pull/8539))

- Add iterationCount to loop condition params ([#8579](https://github.com/mastra-ai/mastra/pull/8579))

- Mutable shared workflow run state ([#8545](https://github.com/mastra-ai/mastra/pull/8545))

- avoid refetching memory threads and messages on window focus ([#8519](https://github.com/mastra-ai/mastra/pull/8519))

- add tripwire reason in playground ([#8568](https://github.com/mastra-ai/mastra/pull/8568))

- Add validation for index creation ([#8552](https://github.com/mastra-ai/mastra/pull/8552))

- Save waiting step status in snapshot ([#8576](https://github.com/mastra-ai/mastra/pull/8576))

- Added AI SDK provider packages to model router for anthropic/google/openai/openrouter/xai ([#8559](https://github.com/mastra-ai/mastra/pull/8559))

- type fixes and missing changeset ([#8545](https://github.com/mastra-ai/mastra/pull/8545))

- Convert WorkflowWatchResult to WorkflowResult in workflow graph ([#8541](https://github.com/mastra-ai/mastra/pull/8541))

- add new deploy to cloud button ([#8549](https://github.com/mastra-ai/mastra/pull/8549))

- remove icons in entity lists ([#8520](https://github.com/mastra-ai/mastra/pull/8520))

- add client search to all entities ([#8523](https://github.com/mastra-ai/mastra/pull/8523))

- Fixed an issue where model router was adding /chat/completions to API urls when it shouldn't. ([#8589](https://github.com/mastra-ai/mastra/pull/8589))
  fixed an issue with provider ID rendering in playground UI

- Improve JSDoc documentation for Agent ([#8389](https://github.com/mastra-ai/mastra/pull/8389))

- Properly fix cloudflare randomUUID in global scope issue ([#8450](https://github.com/mastra-ai/mastra/pull/8450))

- Marked OTEL based telemetry as deprecated. ([#8586](https://github.com/mastra-ai/mastra/pull/8586))

- Add support for streaming nested agent tools ([#8580](https://github.com/mastra-ai/mastra/pull/8580))

- Fix TypeScript errors with provider-defined tools by updating ai-v5 and openai-v5 to matching provider-utils versions. This ensures npm deduplicates to a single provider-utils instance, resolving type incompatibility issues when passing provider tools to Agent. ([#8584](https://github.com/mastra-ai/mastra/pull/8584))

  Also adds deprecation warning to Agent import from root path to encourage using the recommended subpath import.

- UX for the agents page ([#8517](https://github.com/mastra-ai/mastra/pull/8517))

- add icons into playground titles + a link to the entity doc ([#8518](https://github.com/mastra-ai/mastra/pull/8518))

## 0.20.1-alpha.4

### Patch Changes

- Fixed an issue where model router was adding /chat/completions to API urls when it shouldn't. ([#8589](https://github.com/mastra-ai/mastra/pull/8589))
  fixed an issue with provider ID rendering in playground UI

## 0.20.1-alpha.3

### Patch Changes

- Marked OTEL based telemetry as deprecated. ([#8586](https://github.com/mastra-ai/mastra/pull/8586))

- Add support for streaming nested agent tools ([#8580](https://github.com/mastra-ai/mastra/pull/8580))

- Fix TypeScript errors with provider-defined tools by updating ai-v5 and openai-v5 to matching provider-utils versions. This ensures npm deduplicates to a single provider-utils instance, resolving type incompatibility issues when passing provider tools to Agent. ([#8584](https://github.com/mastra-ai/mastra/pull/8584))

  Also adds deprecation warning to Agent import from root path to encourage using the recommended subpath import.

## 0.20.1-alpha.2

### Patch Changes

- Added AI SDK provider packages to model router for anthropic/google/openai/openrouter/xai ([#8559](https://github.com/mastra-ai/mastra/pull/8559))

## 0.20.1-alpha.1

### Patch Changes

- workflow run thread more visible ([#8539](https://github.com/mastra-ai/mastra/pull/8539))

- Add iterationCount to loop condition params ([#8579](https://github.com/mastra-ai/mastra/pull/8579))

- Mutable shared workflow run state ([#8545](https://github.com/mastra-ai/mastra/pull/8545))

- avoid refetching memory threads and messages on window focus ([#8519](https://github.com/mastra-ai/mastra/pull/8519))

- add tripwire reason in playground ([#8568](https://github.com/mastra-ai/mastra/pull/8568))

- Add validation for index creation ([#8552](https://github.com/mastra-ai/mastra/pull/8552))

- Save waiting step status in snapshot ([#8576](https://github.com/mastra-ai/mastra/pull/8576))

- type fixes and missing changeset ([#8545](https://github.com/mastra-ai/mastra/pull/8545))

- Convert WorkflowWatchResult to WorkflowResult in workflow graph ([#8541](https://github.com/mastra-ai/mastra/pull/8541))

- add new deploy to cloud button ([#8549](https://github.com/mastra-ai/mastra/pull/8549))

- remove icons in entity lists ([#8520](https://github.com/mastra-ai/mastra/pull/8520))

- add client search to all entities ([#8523](https://github.com/mastra-ai/mastra/pull/8523))

- Improve JSDoc documentation for Agent ([#8389](https://github.com/mastra-ai/mastra/pull/8389))

- UX for the agents page ([#8517](https://github.com/mastra-ai/mastra/pull/8517))

- add icons into playground titles + a link to the entity doc ([#8518](https://github.com/mastra-ai/mastra/pull/8518))

## 0.20.1-alpha.0

### Patch Changes

- Properly fix cloudflare randomUUID in global scope issue ([#8450](https://github.com/mastra-ai/mastra/pull/8450))

## 0.20.0

### Minor Changes

- Breaking change to move the agent.streamVNext/generateVNext implementation to the default stream/generate. The old stream/generate have now been moved to streamLegacy and generateLegacy ([#8097](https://github.com/mastra-ai/mastra/pull/8097))

### Patch Changes

- Remove log drains UI from the playground ([#8379](https://github.com/mastra-ai/mastra/pull/8379))

- add refetch interval to traces to make it feel "instant" ([#8386](https://github.com/mastra-ai/mastra/pull/8386))

- better memory message ([#8382](https://github.com/mastra-ai/mastra/pull/8382))

- Add doc url to netlify gateway ([#8356](https://github.com/mastra-ai/mastra/pull/8356))

- fix codeblock line number color contrast for legacy traces ([#8385](https://github.com/mastra-ai/mastra/pull/8385))

- Fixes two issues, one where finish chunks were passed to output processors after every step, and the other where the processorState would get reset after every step, meaning that the final StructuredOutput process prompt was missing lots of context from the previous steps. ([#8373](https://github.com/mastra-ai/mastra/pull/8373))

- Convert structured output to a stream processor ([#8229](https://github.com/mastra-ai/mastra/pull/8229))

- Model router documentation and playground UI improvements ([#8372](https://github.com/mastra-ai/mastra/pull/8372))

  **Documentation generation (`@mastra/core`):**
  - Fixed inverted dynamic model selection logic in provider examples
  - Improved copy: replaced marketing language with action-oriented descriptions
  - Added generated file comments with timestamps to all MDX outputs so maintainers know not to directly edit generated files

  **Playground UI model picker (`@mastra/playground-ui`):**
  - Fixed provider field clearing when typing in model input
  - Added responsive layout (stacks on mobile, side-by-side on desktop)
  - Improved general styling of provider/model pickers

  **Environment variables (`@mastra/deployer`):**
  - Properly handle array of env vars (e.g., NETLIFY_TOKEN, NETLIFY_SITE_ID)
  - Added correct singular/plural handling for "environment variable(s)"

- Add approve and decline tool calls to mastra server pkg ([#8360](https://github.com/mastra-ai/mastra/pull/8360))

- Fix/8219 preserve resourceid on resume ([#8359](https://github.com/mastra-ai/mastra/pull/8359))

- Fix ai-sdk custom data output ([#8414](https://github.com/mastra-ai/mastra/pull/8414))

- show thread list in desc order ([#8381](https://github.com/mastra-ai/mastra/pull/8381))

- Fix an issue preventing showing working memory and semantic recall in the playground ([#8358](https://github.com/mastra-ai/mastra/pull/8358))

- Add observe strean to get streans after workflow has been interrupted ([#8318](https://github.com/mastra-ai/mastra/pull/8318))

## 0.20.0-alpha.0

### Minor Changes

- Breaking change to move the agent.streamVNext/generateVNext implementation to the default stream/generate. The old stream/generate have now been moved to streamLegacy and generateLegacy ([#8097](https://github.com/mastra-ai/mastra/pull/8097))

### Patch Changes

- Remove log drains UI from the playground ([#8379](https://github.com/mastra-ai/mastra/pull/8379))

- add refetch interval to traces to make it feel "instant" ([#8386](https://github.com/mastra-ai/mastra/pull/8386))

- better memory message ([#8382](https://github.com/mastra-ai/mastra/pull/8382))

- Add doc url to netlify gateway ([#8356](https://github.com/mastra-ai/mastra/pull/8356))

- fix codeblock line number color contrast for legacy traces ([#8385](https://github.com/mastra-ai/mastra/pull/8385))

- Fixes two issues, one where finish chunks were passed to output processors after every step, and the other where the processorState would get reset after every step, meaning that the final StructuredOutput process prompt was missing lots of context from the previous steps. ([#8373](https://github.com/mastra-ai/mastra/pull/8373))

- Convert structured output to a stream processor ([#8229](https://github.com/mastra-ai/mastra/pull/8229))

- Model router documentation and playground UI improvements ([#8372](https://github.com/mastra-ai/mastra/pull/8372))

  **Documentation generation (`@mastra/core`):**
  - Fixed inverted dynamic model selection logic in provider examples
  - Improved copy: replaced marketing language with action-oriented descriptions
  - Added generated file comments with timestamps to all MDX outputs so maintainers know not to directly edit generated files

  **Playground UI model picker (`@mastra/playground-ui`):**
  - Fixed provider field clearing when typing in model input
  - Added responsive layout (stacks on mobile, side-by-side on desktop)
  - Improved general styling of provider/model pickers

  **Environment variables (`@mastra/deployer`):**
  - Properly handle array of env vars (e.g., NETLIFY_TOKEN, NETLIFY_SITE_ID)
  - Added correct singular/plural handling for "environment variable(s)"

- Add approve and decline tool calls to mastra server pkg ([#8360](https://github.com/mastra-ai/mastra/pull/8360))

- Fix/8219 preserve resourceid on resume ([#8359](https://github.com/mastra-ai/mastra/pull/8359))

- Fix ai-sdk custom data output ([#8414](https://github.com/mastra-ai/mastra/pull/8414))

- show thread list in desc order ([#8381](https://github.com/mastra-ai/mastra/pull/8381))

- Fix an issue preventing showing working memory and semantic recall in the playground ([#8358](https://github.com/mastra-ai/mastra/pull/8358))

- Add observe strean to get streans after workflow has been interrupted ([#8318](https://github.com/mastra-ai/mastra/pull/8318))

## 0.19.1

### Patch Changes

- disable network label when memory is not enabled OR the agent has no subagents ([#8341](https://github.com/mastra-ai/mastra/pull/8341))

- Added Mastra model router to Playground UI ([#8332](https://github.com/mastra-ai/mastra/pull/8332))

- Netlify gateway support to the model router. Now accepts strings like "netlify/openai/gpt-5". ([#8331](https://github.com/mastra-ai/mastra/pull/8331))

## 0.19.1-alpha.1

### Patch Changes

- disable network label when memory is not enabled OR the agent has no subagents ([#8341](https://github.com/mastra-ai/mastra/pull/8341))

## 0.19.1-alpha.0

### Patch Changes

- Added Mastra model router to Playground UI ([#8332](https://github.com/mastra-ai/mastra/pull/8332))

- Netlify gateway support to the model router. Now accepts strings like "netlify/openai/gpt-5". ([#8331](https://github.com/mastra-ai/mastra/pull/8331))

## 0.19.0

### Minor Changes

- Add spanId column to scores table ([#8154](https://github.com/mastra-ai/mastra/pull/8154))

- changed ai_trace_spans table schema to use text for span_type column. ([#8027](https://github.com/mastra-ai/mastra/pull/8027))

### Patch Changes

- Remove legacy helpers ([#8017](https://github.com/mastra-ai/mastra/pull/8017))

- add a way to hide the deploy mastra cloud button ([#8137](https://github.com/mastra-ai/mastra/pull/8137))

- Core error processing - safeParse error object ([#8312](https://github.com/mastra-ai/mastra/pull/8312))

- Fix score input and output types ([#8153](https://github.com/mastra-ai/mastra/pull/8153))

- fix cloudflare deployer build ([#8105](https://github.com/mastra-ai/mastra/pull/8105))

- make suspend optional and move types.ts containing DynamicArgument to types folder ([#8305](https://github.com/mastra-ai/mastra/pull/8305))

- When an error would happen in a function like onStepResult, there are other code that executes synchronously and will execute after the controller already closes. We need to make sure we're only trying to enqueue chunks when the controller is still open. ([#8186](https://github.com/mastra-ai/mastra/pull/8186))

- Bring back ToolInvocationOptions for createTool execute function ([#8206](https://github.com/mastra-ai/mastra/pull/8206))

- Throw is memory is not passed to the routing agent. ([#8313](https://github.com/mastra-ai/mastra/pull/8313))

- Return the selection reason as the result if the agent could not route and pick a primitive ([#8308](https://github.com/mastra-ai/mastra/pull/8308))

- Mastra model router ([#8235](https://github.com/mastra-ai/mastra/pull/8235))

- Fix generateVNext tripwire return value ([#8122](https://github.com/mastra-ai/mastra/pull/8122))

- Fixed createTool types due totight coupling to Zod's internal structure, which changed between v3 and v4. Instead of checking for exact Zod types, we now use structural typing - checking for the presence of parse/safeParse methods ([#8150](https://github.com/mastra-ai/mastra/pull/8150))

- Fixes agent.network() memory tools (working memory, vector search) as well as fixes tool calling and workflow calling in general. Various clean up for the agent.network() code path. ([#8157](https://github.com/mastra-ai/mastra/pull/8157))

- fixNetworkChunkType ([#8210](https://github.com/mastra-ai/mastra/pull/8210))

- Show model that worked when there are model fallbacks ([#8167](https://github.com/mastra-ai/mastra/pull/8167))

- Add input data validation to workflow step execution ([#7779](https://github.com/mastra-ai/mastra/pull/7779))
  Add resume data validation to resume workflow method
  Add input data validation to start workflow method
  Use default value from inputSchema/resumeSchema

- Add types in the streamVNext codepath, fixes for various issues across multiple packages surfaced from type issues, align return types. ([#8010](https://github.com/mastra-ai/mastra/pull/8010))

- Support tracing options for workflow streaming endpoints ([#8278](https://github.com/mastra-ai/mastra/pull/8278))

- Adjust deprecation warnings ([#8326](https://github.com/mastra-ai/mastra/pull/8326))

- Improve error processing -don't mask useful errors ([#8270](https://github.com/mastra-ai/mastra/pull/8270))

- When step is created from agent or tool, add the description and component key to show that ([#8151](https://github.com/mastra-ai/mastra/pull/8151))

- [CLOUD-500] Refactor trace transform to agent payload ([#8280](https://github.com/mastra-ai/mastra/pull/8280))

## 0.19.0-alpha.1

### Minor Changes

- Add spanId column to scores table ([#8154](https://github.com/mastra-ai/mastra/pull/8154))

- changed ai_trace_spans table schema to use text for span_type column. ([#8027](https://github.com/mastra-ai/mastra/pull/8027))

### Patch Changes

- Core error processing - safeParse error object ([#8312](https://github.com/mastra-ai/mastra/pull/8312))

- Fix score input and output types ([#8153](https://github.com/mastra-ai/mastra/pull/8153))

- make suspend optional and move types.ts containing DynamicArgument to types folder ([#8305](https://github.com/mastra-ai/mastra/pull/8305))

- Bring back ToolInvocationOptions for createTool execute function ([#8206](https://github.com/mastra-ai/mastra/pull/8206))

- Throw is memory is not passed to the routing agent. ([#8313](https://github.com/mastra-ai/mastra/pull/8313))

- Return the selection reason as the result if the agent could not route and pick a primitive ([#8308](https://github.com/mastra-ai/mastra/pull/8308))

- Mastra model router ([#8235](https://github.com/mastra-ai/mastra/pull/8235))

- fixNetworkChunkType ([#8210](https://github.com/mastra-ai/mastra/pull/8210))

- Show model that worked when there are model fallbacks ([#8167](https://github.com/mastra-ai/mastra/pull/8167))

- Support tracing options for workflow streaming endpoints ([#8278](https://github.com/mastra-ai/mastra/pull/8278))

- Improve error processing -don't mask useful errors ([#8270](https://github.com/mastra-ai/mastra/pull/8270))

- [CLOUD-500] Refactor trace transform to agent payload ([#8280](https://github.com/mastra-ai/mastra/pull/8280))

## 0.18.1-alpha.0

### Patch Changes

- Remove legacy helpers ([#8017](https://github.com/mastra-ai/mastra/pull/8017))

- add a way to hide the deploy mastra cloud button ([#8137](https://github.com/mastra-ai/mastra/pull/8137))

- fix cloudflare deployer build ([#8105](https://github.com/mastra-ai/mastra/pull/8105))

- When an error would happen in a function like onStepResult, there are other code that executes synchronously and will execute after the controller already closes. We need to make sure we're only trying to enqueue chunks when the controller is still open. ([#8186](https://github.com/mastra-ai/mastra/pull/8186))

- Fix generateVNext tripwire return value ([#8122](https://github.com/mastra-ai/mastra/pull/8122))

- Fixed createTool types due totight coupling to Zod's internal structure, which changed between v3 and v4. Instead of checking for exact Zod types, we now use structural typing - checking for the presence of parse/safeParse methods ([#8150](https://github.com/mastra-ai/mastra/pull/8150))

- Fixes agent.network() memory tools (working memory, vector search) as well as fixes tool calling and workflow calling in general. Various clean up for the agent.network() code path. ([#8157](https://github.com/mastra-ai/mastra/pull/8157))

- Add input data validation to workflow step execution ([#7779](https://github.com/mastra-ai/mastra/pull/7779))
  Add resume data validation to resume workflow method
  Add input data validation to start workflow method
  Use default value from inputSchema/resumeSchema

- Add types in the streamVNext codepath, fixes for various issues across multiple packages surfaced from type issues, align return types. ([#8010](https://github.com/mastra-ai/mastra/pull/8010))

- When step is created from agent or tool, add the description and component key to show that ([#8151](https://github.com/mastra-ai/mastra/pull/8151))

## 0.18.0

### Minor Changes

- Allow agent instructions to accept SystemMessage types ([#7987](https://github.com/mastra-ai/mastra/pull/7987))

  Agents can now use rich instruction formats beyond simple strings:
  - CoreSystemMessage and SystemModelMessage objects with provider-specific options
  - Arrays of strings or system messages
  - Dynamic instructions returning any SystemMessage type

### Patch Changes

- Agent type fixes ([#8072](https://github.com/mastra-ai/mastra/pull/8072))

- Fixes for `getStepResult` in workflow steps ([#8065](https://github.com/mastra-ai/mastra/pull/8065))

- fix: result object type inference when using structuredOutput and unify output/structuredOutput types with single OUTPUT generic ([#7969](https://github.com/mastra-ai/mastra/pull/7969))

- feat: implement trace scoring with batch processing capabilities ([#8033](https://github.com/mastra-ai/mastra/pull/8033))

- Fix selection of agent method based on model version ([#8001](https://github.com/mastra-ai/mastra/pull/8001))

- show the tool-output stream in the playground for streamVNext ([#7983](https://github.com/mastra-ai/mastra/pull/7983))

- Add scorer type, for automatic type inferrence when creating scorers for agents ([#8032](https://github.com/mastra-ai/mastra/pull/8032))

- Get rid off swr one for all ([#7931](https://github.com/mastra-ai/mastra/pull/7931))

- Fix PostgreSQL vector index recreation issue and add optional index configuration ([#8020](https://github.com/mastra-ai/mastra/pull/8020))
  - Fixed critical bug where memory vector indexes were unnecessarily recreated on every operation
  - Added support for configuring vector index types (HNSW, IVFFlat, flat) and parameters

- Fix navigating between scores and entity types ([#8129](https://github.com/mastra-ai/mastra/pull/8129))

- Delayed streamVNext breaking change notice by 1 week ([#8121](https://github.com/mastra-ai/mastra/pull/8121))

- Tool hitl ([#8084](https://github.com/mastra-ai/mastra/pull/8084))

- Updated dependencies [[`b61b8e0`](https://github.com/mastra-ai/mastra/commit/b61b8e0b0e93a7e6e9d82e6f0b620bb919a20bdb)]:
  - @mastra/schema-compat@0.11.4

## 0.18.0-alpha.3

### Patch Changes

- feat: implement trace scoring with batch processing capabilities ([#8033](https://github.com/mastra-ai/mastra/pull/8033))

- Fix PostgreSQL vector index recreation issue and add optional index configuration ([#8020](https://github.com/mastra-ai/mastra/pull/8020))
  - Fixed critical bug where memory vector indexes were unnecessarily recreated on every operation
  - Added support for configuring vector index types (HNSW, IVFFlat, flat) and parameters

- Fix navigating between scores and entity types ([#8129](https://github.com/mastra-ai/mastra/pull/8129))

- Delayed streamVNext breaking change notice by 1 week ([#8121](https://github.com/mastra-ai/mastra/pull/8121))

- Tool hitl ([#8084](https://github.com/mastra-ai/mastra/pull/8084))

- Updated dependencies [[`b61b8e0`](https://github.com/mastra-ai/mastra/commit/b61b8e0b0e93a7e6e9d82e6f0b620bb919a20bdb)]:
  - @mastra/schema-compat@0.11.4-alpha.0

## 0.18.0-alpha.2

### Minor Changes

- Allow agent instructions to accept SystemMessage types ([#7987](https://github.com/mastra-ai/mastra/pull/7987))

  Agents can now use rich instruction formats beyond simple strings:
  - CoreSystemMessage and SystemModelMessage objects with provider-specific options
  - Arrays of strings or system messages
  - Dynamic instructions returning any SystemMessage type

### Patch Changes

- Agent type fixes ([#8072](https://github.com/mastra-ai/mastra/pull/8072))

- Fixes for `getStepResult` in workflow steps ([#8065](https://github.com/mastra-ai/mastra/pull/8065))

- Add scorer type, for automatic type inferrence when creating scorers for agents ([#8032](https://github.com/mastra-ai/mastra/pull/8032))

## 0.17.2-alpha.1

### Patch Changes

- show the tool-output stream in the playground for streamVNext ([#7983](https://github.com/mastra-ai/mastra/pull/7983))

## 0.17.2-alpha.0

### Patch Changes

- fix: result object type inference when using structuredOutput and unify output/structuredOutput types with single OUTPUT generic ([#7969](https://github.com/mastra-ai/mastra/pull/7969))

- Fix selection of agent method based on model version ([#8001](https://github.com/mastra-ai/mastra/pull/8001))

- Get rid off swr one for all ([#7931](https://github.com/mastra-ai/mastra/pull/7931))

## 0.17.1

### Patch Changes

- Refactor agent.#execute fn workflow to make code easier to follow. ([#7964](https://github.com/mastra-ai/mastra/pull/7964))

- fix workflow resuming issue in the playground ([#7988](https://github.com/mastra-ai/mastra/pull/7988))

- feat: Add system option support to VNext methods ([#7925](https://github.com/mastra-ai/mastra/pull/7925))

## 0.17.1-alpha.0

### Patch Changes

- Refactor agent.#execute fn workflow to make code easier to follow. ([#7964](https://github.com/mastra-ai/mastra/pull/7964))

- fix workflow resuming issue in the playground ([#7988](https://github.com/mastra-ai/mastra/pull/7988))

- feat: Add system option support to VNext methods ([#7925](https://github.com/mastra-ai/mastra/pull/7925))

## 0.17.0

### Minor Changes

- Remove original AgentNetwork ([#7919](https://github.com/mastra-ai/mastra/pull/7919))

- Fully deprecated createRun (now throws an error) in favour of createRunAsync ([#7897](https://github.com/mastra-ai/mastra/pull/7897))

- Improved workspace dependency resolution during development and builds. This makes the build process more reliable when working with monorepos and workspace packages, reducing potential bundling errors and improving development experience. ([#7619](https://github.com/mastra-ai/mastra/pull/7619))

### Patch Changes

- dependencies updates: ([#7861](https://github.com/mastra-ai/mastra/pull/7861))
  - Updated dependency [`hono@^4.9.7` ↗︎](https://www.npmjs.com/package/hono/v/4.9.7) (from `^4.9.6`, in `dependencies`)

- Updated SensitiveDataFilter to be less greedy in its redacting ([#7840](https://github.com/mastra-ai/mastra/pull/7840))

- clean up console logs in monorepo ([#7926](https://github.com/mastra-ai/mastra/pull/7926))

- Update dependencies ai-v5 and @ai-sdk/provider-utils-v5 to latest ([#7884](https://github.com/mastra-ai/mastra/pull/7884))

- Added the ability to hide internal ai tracing spans (enabled by default) ([#7764](https://github.com/mastra-ai/mastra/pull/7764))

- "refactored ai tracing to commonize types" ([#7744](https://github.com/mastra-ai/mastra/pull/7744))

- Register server cache in Mastra ([#7946](https://github.com/mastra-ai/mastra/pull/7946))

- feat: add requiresAuth option for custom API routes ([#7703](https://github.com/mastra-ai/mastra/pull/7703))

  Added a new `requiresAuth` option to the `ApiRoute` type that allows users to explicitly control authentication requirements for custom endpoints.
  - By default, all custom routes require authentication (`requiresAuth: true`)
  - Set `requiresAuth: false` to make a route publicly accessible without authentication
  - The auth middleware now checks this configuration before applying authentication

  Example usage:

  ```typescript
  const customRoutes: ApiRoute[] = [
    {
      path: '/api/public-endpoint',
      method: 'GET',
      requiresAuth: false, // No authentication required
      handler: async c => c.json({ message: 'Public access' }),
    },
    {
      path: '/api/protected-endpoint',
      method: 'GET',
      requiresAuth: true, // Authentication required (default)
      handler: async c => c.json({ message: 'Protected access' }),
    },
  ];
  ```

  This addresses issue #7674 where custom endpoints were not being protected by the authentication system.

- Resumable streams ([#7949](https://github.com/mastra-ai/mastra/pull/7949))

- Only log stream/generate deprecation warning once ([#7905](https://github.com/mastra-ai/mastra/pull/7905))

- Add support for running the Mastra dev server over HTTPS for local development. ([#7871](https://github.com/mastra-ai/mastra/pull/7871))
  - Add `--https` flag for `mastra dev`. This automatically creates a local key and certificate for you.
  - Alternatively, you can provide your own key and cert through `server.https`:

    ```ts
    // src/mastra/index.ts
    import { Mastra } from '@mastra/core/mastra';
    import fs from 'node:fs';

    export const mastra = new Mastra({
      server: {
        https: {
          key: fs.readFileSync('path/to/key.pem'),
          cert: fs.readFileSync('path/to/cert.pem'),
        },
      },
    });
    ```

- refactored handling of internal ai spans to be more intelligent ([#7876](https://github.com/mastra-ai/mastra/pull/7876))

- Improve error message when using V1 model with streamVNext ([#7948](https://github.com/mastra-ai/mastra/pull/7948))

- prevent out-of-order span errors in ai-tracing DefaultExporter ([#7895](https://github.com/mastra-ai/mastra/pull/7895))

- move ToolExecutionOptions and ToolCallOptions to a union type (ToolInvocationOptions) for use in createTool, Tool, and ToolAction ([#7914](https://github.com/mastra-ai/mastra/pull/7914))

- avoid refetching on error when resolving a workflow in cloud ([#7842](https://github.com/mastra-ai/mastra/pull/7842))

- fix scorers table link full row ([#7915](https://github.com/mastra-ai/mastra/pull/7915))

- fix(core): handle JSON code blocks in structured output streaming ([#7864](https://github.com/mastra-ai/mastra/pull/7864))

- Postgresql Storage Query Index Performance: Adds index operations and automatic indexing for Postgresql ([#7757](https://github.com/mastra-ai/mastra/pull/7757))

- adjust the way we display scorers in agent metadata ([#7910](https://github.com/mastra-ai/mastra/pull/7910))

- fix: support destructuring of streamVNext return values ([#7920](https://github.com/mastra-ai/mastra/pull/7920))

- Fix VNext generate/stream usage tokens. They used to be undefined, now we are receiving the proper values. ([#7901](https://github.com/mastra-ai/mastra/pull/7901))

- Add model fallbacks ([#7126](https://github.com/mastra-ai/mastra/pull/7126))

- Add resource id to workflow run snapshots ([#7740](https://github.com/mastra-ai/mastra/pull/7740))

- Fixes assistant message ids when using toUIMessageStream, preserves the original messageId rather than creating a new id for this message. ([#7783](https://github.com/mastra-ai/mastra/pull/7783))

- Fixes multiple issues with stopWhen and step results. ([#7862](https://github.com/mastra-ai/mastra/pull/7862))

- fix error message when fetching observability things ([#7956](https://github.com/mastra-ai/mastra/pull/7956))

- Network stream class when calling agent.network() ([#7763](https://github.com/mastra-ai/mastra/pull/7763))

- fix workflows runs fetching and displaying ([#7852](https://github.com/mastra-ai/mastra/pull/7852))

- fix empty state for scorers on agent page ([#7846](https://github.com/mastra-ai/mastra/pull/7846))

- Remove extraneous console.log ([#7916](https://github.com/mastra-ai/mastra/pull/7916))

- Deprecate "output" in generate and stream VNext in favour of structuredOutput. When structuredOutput is used in tandem with maxSteps = 1, the structuredOutput processor won't run, it'll generate the output using the main agent, similar to how "output" used to work. ([#7750](https://github.com/mastra-ai/mastra/pull/7750))

- Fix switch in prompt-injection ([#7951](https://github.com/mastra-ai/mastra/pull/7951))

## 0.17.0-alpha.8

### Patch Changes

- Improve error message when using V1 model with streamVNext ([#7948](https://github.com/mastra-ai/mastra/pull/7948))

- Fix VNext generate/stream usage tokens. They used to be undefined, now we are receiving the proper values. ([#7901](https://github.com/mastra-ai/mastra/pull/7901))

## 0.17.0-alpha.7

### Patch Changes

- fix error message when fetching observability things ([#7956](https://github.com/mastra-ai/mastra/pull/7956))

## 0.17.0-alpha.6

### Minor Changes

- Remove original AgentNetwork ([#7919](https://github.com/mastra-ai/mastra/pull/7919))

### Patch Changes

- dependencies updates: ([#7861](https://github.com/mastra-ai/mastra/pull/7861))
  - Updated dependency [`hono@^4.9.7` ↗︎](https://www.npmjs.com/package/hono/v/4.9.7) (from `^4.9.6`, in `dependencies`)

- clean up console logs in monorepo ([#7926](https://github.com/mastra-ai/mastra/pull/7926))

- Register server cache in Mastra ([#7946](https://github.com/mastra-ai/mastra/pull/7946))

- Resumable streams ([#7949](https://github.com/mastra-ai/mastra/pull/7949))

- move ToolExecutionOptions and ToolCallOptions to a union type (ToolInvocationOptions) for use in createTool, Tool, and ToolAction ([#7914](https://github.com/mastra-ai/mastra/pull/7914))

- fix scorers table link full row ([#7915](https://github.com/mastra-ai/mastra/pull/7915))

- adjust the way we display scorers in agent metadata ([#7910](https://github.com/mastra-ai/mastra/pull/7910))

- fix: support destructuring of streamVNext return values ([#7920](https://github.com/mastra-ai/mastra/pull/7920))

- Remove extraneous console.log ([#7916](https://github.com/mastra-ai/mastra/pull/7916))

- Fix switch in prompt-injection ([#7951](https://github.com/mastra-ai/mastra/pull/7951))

## 0.17.0-alpha.5

### Patch Changes

- Only log stream/generate deprecation warning once ([#7905](https://github.com/mastra-ai/mastra/pull/7905))

## 0.17.0-alpha.4

### Minor Changes

- Fully deprecated createRun (now throws an error) in favour of createRunAsync ([#7897](https://github.com/mastra-ai/mastra/pull/7897))

### Patch Changes

- Update dependencies ai-v5 and @ai-sdk/provider-utils-v5 to latest ([#7884](https://github.com/mastra-ai/mastra/pull/7884))

- refactored handling of internal ai spans to be more intelligent ([#7876](https://github.com/mastra-ai/mastra/pull/7876))

- prevent out-of-order span errors in ai-tracing DefaultExporter ([#7895](https://github.com/mastra-ai/mastra/pull/7895))

- Fixes multiple issues with stopWhen and step results. ([#7862](https://github.com/mastra-ai/mastra/pull/7862))

## 0.17.0-alpha.3

### Minor Changes

- Improved workspace dependency resolution during development and builds. This makes the build process more reliable when working with monorepos and workspace packages, reducing potential bundling errors and improving development experience. ([#7619](https://github.com/mastra-ai/mastra/pull/7619))

### Patch Changes

- Updated SensitiveDataFilter to be less greedy in its redacting ([#7840](https://github.com/mastra-ai/mastra/pull/7840))

- Add support for running the Mastra dev server over HTTPS for local development. ([#7871](https://github.com/mastra-ai/mastra/pull/7871))
  - Add `--https` flag for `mastra dev`. This automatically creates a local key and certificate for you.
  - Alternatively, you can provide your own key and cert through `server.https`:

    ```ts
    // src/mastra/index.ts
    import { Mastra } from '@mastra/core/mastra';
    import fs from 'node:fs';

    export const mastra = new Mastra({
      server: {
        https: {
          key: fs.readFileSync('path/to/key.pem'),
          cert: fs.readFileSync('path/to/cert.pem'),
        },
      },
    });
    ```

- avoid refetching on error when resolving a workflow in cloud ([#7842](https://github.com/mastra-ai/mastra/pull/7842))

- fix(core): handle JSON code blocks in structured output streaming ([#7864](https://github.com/mastra-ai/mastra/pull/7864))

- Add model fallbacks ([#7126](https://github.com/mastra-ai/mastra/pull/7126))

- fix workflows runs fetching and displaying ([#7852](https://github.com/mastra-ai/mastra/pull/7852))

- fix empty state for scorers on agent page ([#7846](https://github.com/mastra-ai/mastra/pull/7846))

## 0.16.4-alpha.2

### Patch Changes

- Postgresql Storage Query Index Performance: Adds index operations and automatic indexing for Postgresql ([#7757](https://github.com/mastra-ai/mastra/pull/7757))

- Fixes assistant message ids when using toUIMessageStream, preserves the original messageId rather than creating a new id for this message. ([#7783](https://github.com/mastra-ai/mastra/pull/7783))

## 0.16.4-alpha.1

### Patch Changes

- Add resource id to workflow run snapshots ([#7740](https://github.com/mastra-ai/mastra/pull/7740))

## 0.16.4-alpha.0

### Patch Changes

- Added the ability to hide internal ai tracing spans (enabled by default) ([#7764](https://github.com/mastra-ai/mastra/pull/7764))

- "refactored ai tracing to commonize types" ([#7744](https://github.com/mastra-ai/mastra/pull/7744))

- feat: add requiresAuth option for custom API routes ([#7703](https://github.com/mastra-ai/mastra/pull/7703))

  Added a new `requiresAuth` option to the `ApiRoute` type that allows users to explicitly control authentication requirements for custom endpoints.
  - By default, all custom routes require authentication (`requiresAuth: true`)
  - Set `requiresAuth: false` to make a route publicly accessible without authentication
  - The auth middleware now checks this configuration before applying authentication

  Example usage:

  ```typescript
  const customRoutes: ApiRoute[] = [
    {
      path: '/api/public-endpoint',
      method: 'GET',
      requiresAuth: false, // No authentication required
      handler: async c => c.json({ message: 'Public access' }),
    },
    {
      path: '/api/protected-endpoint',
      method: 'GET',
      requiresAuth: true, // Authentication required (default)
      handler: async c => c.json({ message: 'Protected access' }),
    },
  ];
  ```

  This addresses issue #7674 where custom endpoints were not being protected by the authentication system.

- Network stream class when calling agent.network() ([#7763](https://github.com/mastra-ai/mastra/pull/7763))

- Deprecate "output" in generate and stream VNext in favour of structuredOutput. When structuredOutput is used in tandem with maxSteps = 1, the structuredOutput processor won't run, it'll generate the output using the main agent, similar to how "output" used to work. ([#7750](https://github.com/mastra-ai/mastra/pull/7750))

## 0.16.3

### Patch Changes

- dependencies updates: ([#7545](https://github.com/mastra-ai/mastra/pull/7545))
  - Updated dependency [`hono@^4.9.6` ↗︎](https://www.npmjs.com/package/hono/v/4.9.6) (from `^4.8.12`, in `dependencies`)

- Delayed deprecation notice for streamVNext() replacing stream() until Sept 23rd ([#7739](https://github.com/mastra-ai/mastra/pull/7739))

- Fix onFinish callback in VNext functions to properly resolve the result ([#7733](https://github.com/mastra-ai/mastra/pull/7733))

- support JSONSchema7 output option with generateVNext, streamVNext ([#7630](https://github.com/mastra-ai/mastra/pull/7630))

- various improvements to input & output data on ai spans ([#7636](https://github.com/mastra-ai/mastra/pull/7636))

- cleanup ([#7736](https://github.com/mastra-ai/mastra/pull/7736))

- add network method ([#7704](https://github.com/mastra-ai/mastra/pull/7704))

- Fix memory not being affected by agent output processors (#7087). Output processors now correctly modify messages before they are saved to memory storage. The fix ensures that any transformations applied by output processors (like redacting sensitive information) are properly propagated to the memory system. ([#7647](https://github.com/mastra-ai/mastra/pull/7647))

- Fix agent structuredOutput option types ([#7668](https://github.com/mastra-ai/mastra/pull/7668))

- "added output to agent spans in ai-tracing" ([#7717](https://github.com/mastra-ai/mastra/pull/7717))

- Ensure system messages are persisted in processedList ([#7715](https://github.com/mastra-ai/mastra/pull/7715))

- AN Merge pt 1 ([#7702](https://github.com/mastra-ai/mastra/pull/7702))

- Custom metadata for traces can now be set when starting agents or workflows ([#7689](https://github.com/mastra-ai/mastra/pull/7689))

- Workflow & Agent executions now return traceId. ([#7663](https://github.com/mastra-ai/mastra/pull/7663))

- fixed bugs in observability config parsing ([#7669](https://github.com/mastra-ai/mastra/pull/7669))

- fix playground UI issue about dynmic workflow exec in agent thread ([#7665](https://github.com/mastra-ai/mastra/pull/7665))

- Updated dependencies [[`779d469`](https://github.com/mastra-ai/mastra/commit/779d469366bb9f7fcb6d1638fdabb9f3acc49218)]:
  - @mastra/schema-compat@0.11.3

## 0.16.3-alpha.1

### Patch Changes

- Delayed deprecation notice for streamVNext() replacing stream() until Sept 23rd ([#7739](https://github.com/mastra-ai/mastra/pull/7739))

- Fix onFinish callback in VNext functions to properly resolve the result ([#7733](https://github.com/mastra-ai/mastra/pull/7733))

- cleanup ([#7736](https://github.com/mastra-ai/mastra/pull/7736))

## 0.16.3-alpha.0

### Patch Changes

- dependencies updates: ([#7545](https://github.com/mastra-ai/mastra/pull/7545))
  - Updated dependency [`hono@^4.9.6` ↗︎](https://www.npmjs.com/package/hono/v/4.9.6) (from `^4.8.12`, in `dependencies`)

- support JSONSchema7 output option with generateVNext, streamVNext ([#7630](https://github.com/mastra-ai/mastra/pull/7630))

- various improvements to input & output data on ai spans ([#7636](https://github.com/mastra-ai/mastra/pull/7636))

- add network method ([#7704](https://github.com/mastra-ai/mastra/pull/7704))

- Fix memory not being affected by agent output processors (#7087). Output processors now correctly modify messages before they are saved to memory storage. The fix ensures that any transformations applied by output processors (like redacting sensitive information) are properly propagated to the memory system. ([#7647](https://github.com/mastra-ai/mastra/pull/7647))

- Fix agent structuredOutput option types ([#7668](https://github.com/mastra-ai/mastra/pull/7668))

- "added output to agent spans in ai-tracing" ([#7717](https://github.com/mastra-ai/mastra/pull/7717))

- Ensure system messages are persisted in processedList ([#7715](https://github.com/mastra-ai/mastra/pull/7715))

- AN Merge pt 1 ([#7702](https://github.com/mastra-ai/mastra/pull/7702))

- Custom metadata for traces can now be set when starting agents or workflows ([#7689](https://github.com/mastra-ai/mastra/pull/7689))

- Workflow & Agent executions now return traceId. ([#7663](https://github.com/mastra-ai/mastra/pull/7663))

- fixed bugs in observability config parsing ([#7669](https://github.com/mastra-ai/mastra/pull/7669))

- fix playground UI issue about dynmic workflow exec in agent thread ([#7665](https://github.com/mastra-ai/mastra/pull/7665))

- Updated dependencies [[`779d469`](https://github.com/mastra-ai/mastra/commit/779d469366bb9f7fcb6d1638fdabb9f3acc49218)]:
  - @mastra/schema-compat@0.11.3-alpha.0

## 0.16.2

### Patch Changes

- Export server types ([#7657](https://github.com/mastra-ai/mastra/pull/7657))

## 0.16.2-alpha.0

### Patch Changes

- Export server types ([#7657](https://github.com/mastra-ai/mastra/pull/7657))

## 0.16.1

### Patch Changes

- Fixed ai tracing for workflows nested directly in agents ([#7599](https://github.com/mastra-ai/mastra/pull/7599))

- Fixed provider defined tools for stream/generate vnext ([#7642](https://github.com/mastra-ai/mastra/pull/7642))

- Made tracing context optional on tool execute() ([#7532](https://github.com/mastra-ai/mastra/pull/7532))

- Fixed ai tracing context propagation in tool calls ([#7531](https://github.com/mastra-ai/mastra/pull/7531))

- Call getMemoryMessages even during first turn in a thread when semantic recall scope is resource ([#7529](https://github.com/mastra-ai/mastra/pull/7529))

- add usage and total usage to streamVNext onFinish callback ([#7598](https://github.com/mastra-ai/mastra/pull/7598))

- Add prepareStep to generate/stream VNext options. ([#7646](https://github.com/mastra-ai/mastra/pull/7646))

- Change to createRunAsync ([#7632](https://github.com/mastra-ai/mastra/pull/7632))

- Fix type in worfklow ([#7519](https://github.com/mastra-ai/mastra/pull/7519))

- Execute tool calls in parallel in generate/stream VNext methods ([#7524](https://github.com/mastra-ai/mastra/pull/7524))

- Allow streamVNext and generateVNext to use structuredOutputs from the MastraClient ([#7597](https://github.com/mastra-ai/mastra/pull/7597))

- Use workflow streamVNext in playground ([#7575](https://github.com/mastra-ai/mastra/pull/7575))

- Revert "feat(mcp): add createMCPTool helper for proper execute types" ([#7513](https://github.com/mastra-ai/mastra/pull/7513))

- Fix InvalidDataContentError when using image messages with AI SDK ([#7542](https://github.com/mastra-ai/mastra/pull/7542))

  Resolves an issue where passing image content in messages would throw an InvalidDataContentError. The fix properly handles multi-part content arrays containing both text and image parts when converting between Mastra and AI SDK message formats.

- Flatten loop config in stream options and pass to loop options ([#7643](https://github.com/mastra-ai/mastra/pull/7643))

- Pass mastra instance into MCP Server tools ([#7520](https://github.com/mastra-ai/mastra/pull/7520))

- Fix image input handling for Google Gemini models in AI SDK V5 ([#7490](https://github.com/mastra-ai/mastra/pull/7490))

  Resolves issue #7362 where Gemini threw `AI_InvalidDataContentError` when receiving URLs in image parts. The fix properly handles V3 message file parts that contain both URL and data fields, ensuring URLs are passed as URLs rather than being incorrectly treated as base64 data.

- Vnext output schema injection ([#6990](https://github.com/mastra-ai/mastra/pull/6990))

- removed duplicate 'float' switch case ([#7516](https://github.com/mastra-ai/mastra/pull/7516))

- Fix issue with response message id consistency between stream/generate response and the message ids saveed in the DB. Also fixed the custom generatorId implementation to work with this. ([#7606](https://github.com/mastra-ai/mastra/pull/7606))

## 0.16.1-alpha.3

### Patch Changes

- Add prepareStep to generate/stream VNext options. ([#7646](https://github.com/mastra-ai/mastra/pull/7646))

## 0.16.1-alpha.2

### Patch Changes

- Fixed provider defined tools for stream/generate vnext ([#7642](https://github.com/mastra-ai/mastra/pull/7642))

- Change to createRunAsync ([#7632](https://github.com/mastra-ai/mastra/pull/7632))

- Flatten loop config in stream options and pass to loop options ([#7643](https://github.com/mastra-ai/mastra/pull/7643))

- Fix issue with response message id consistency between stream/generate response and the message ids saveed in the DB. Also fixed the custom generatorId implementation to work with this. ([#7606](https://github.com/mastra-ai/mastra/pull/7606))

## 0.16.1-alpha.1

### Patch Changes

- Fixed ai tracing for workflows nested directly in agents ([#7599](https://github.com/mastra-ai/mastra/pull/7599))

- Fixed ai tracing context propagation in tool calls ([#7531](https://github.com/mastra-ai/mastra/pull/7531))

- add usage and total usage to streamVNext onFinish callback ([#7598](https://github.com/mastra-ai/mastra/pull/7598))

- Allow streamVNext and generateVNext to use structuredOutputs from the MastraClient ([#7597](https://github.com/mastra-ai/mastra/pull/7597))

- Use workflow streamVNext in playground ([#7575](https://github.com/mastra-ai/mastra/pull/7575))

- Fix InvalidDataContentError when using image messages with AI SDK ([#7542](https://github.com/mastra-ai/mastra/pull/7542))

  Resolves an issue where passing image content in messages would throw an InvalidDataContentError. The fix properly handles multi-part content arrays containing both text and image parts when converting between Mastra and AI SDK message formats.

## 0.16.1-alpha.0

### Patch Changes

- Made tracing context optional on tool execute() ([#7532](https://github.com/mastra-ai/mastra/pull/7532))

- Call getMemoryMessages even during first turn in a thread when semantic recall scope is resource ([#7529](https://github.com/mastra-ai/mastra/pull/7529))

- Execute tool calls in parallel in generate/stream VNext methods ([#7524](https://github.com/mastra-ai/mastra/pull/7524))

- Revert "feat(mcp): add createMCPTool helper for proper execute types" ([#7513](https://github.com/mastra-ai/mastra/pull/7513))

- Pass mastra instance into MCP Server tools ([#7520](https://github.com/mastra-ai/mastra/pull/7520))

- Fix image input handling for Google Gemini models in AI SDK V5 ([#7490](https://github.com/mastra-ai/mastra/pull/7490))

  Resolves issue #7362 where Gemini threw `AI_InvalidDataContentError` when receiving URLs in image parts. The fix properly handles V3 message file parts that contain both URL and data fields, ensuring URLs are passed as URLs rather than being incorrectly treated as base64 data.

- Vnext output schema injection ([#6990](https://github.com/mastra-ai/mastra/pull/6990))

- removed duplicate 'float' switch case ([#7516](https://github.com/mastra-ai/mastra/pull/7516))

## 0.16.0

### Minor Changes

- a01cf14: Add workflow graph in agent (workflow as tool in agent)

### Patch Changes

- 8fbf79e: Fix this to be not set when workflow is a step
- fd83526: Stream agent events with workflow `.streamVNext()`
- d0b90ab: Fix output processors to run before saving messages to memory
- 6f5eb7a: Throw if an empty or whitespace-only threadId is passed when getting messages
- a9e50ee: Allow both workflow stream message formats for now
- 5397eb4: Add public URL support when adding files in Multi Modal
- c9f4e4a: Pass tracing context to scorer run
- 0acbc80: Add InferUITools and related type helpers for AI SDK compatibility

  Adds new type utility functions to help with type inference when using Mastra tools with the AI SDK's UI components:
  - `InferUITools` - Infers input/output types for a collection of tools
  - `InferUITool` - Infers input/output types for a single tool

  These type helpers allow developers to easily integrate Mastra tools with AI SDK UI components like `useChat` by providing proper type inference for tool inputs and outputs.

## 0.16.0-alpha.1

### Patch Changes

- 8fbf79e: Fix this to be not set when workflow is a step

## 0.16.0-alpha.0

### Minor Changes

- a01cf14: Add workflow graph in agent (workflow as tool in agent)

### Patch Changes

- fd83526: Stream agent events with workflow `.streamVNext()`
- d0b90ab: Fix output processors to run before saving messages to memory
- 6f5eb7a: Throw if an empty or whitespace-only threadId is passed when getting messages
- a9e50ee: Allow both workflow stream message formats for now
- 5397eb4: Add public URL support when adding files in Multi Modal
- c9f4e4a: Pass tracing context to scorer run
- 0acbc80: Add InferUITools and related type helpers for AI SDK compatibility

  Adds new type utility functions to help with type inference when using Mastra tools with the AI SDK's UI components:
  - `InferUITools` - Infers input/output types for a collection of tools
  - `InferUITool` - Infers input/output types for a single tool

  These type helpers allow developers to easily integrate Mastra tools with AI SDK UI components like `useChat` by providing proper type inference for tool inputs and outputs.

## 0.15.3

### Patch Changes

- ab48c97: dependencies updates:
  - Updated dependency [`zod-to-json-schema@^3.24.6` ↗︎](https://www.npmjs.com/package/zod-to-json-schema/v/3.24.6) (from `^3.24.5`, in `dependencies`)
- 85ef90b: Return nested workflow steps information in getWorkflowRunExecutionResult
- aedbbfa: Fixed wrapping of models with AI Tracing when used with structured output.
- ff89505: Add deprecation warnings and add legacy routes
- 637f323: Fix issue with some compilers and calling zod v4's toJSONSchema function
- de3cbc6: Update the `package.json` file to include additional fields like `repository`, `homepage` or `files`.
- c19bcf7: stopped recording event spans for llm_chunks in ai-observability
- 4474d04: fix: do not pass tracing context to score run
- 183dc95: Added a fix to prevent filtering out injected initial default user messages. Related to issue 7231
- a1111e2: Fixes #7254 where the onFinish callback wasn't returning assistant messages when using format: 'aisdk' in streamVNext. The messageList was being updated with response messages but these weren't being passed to the user's onFinish callback.
- b42a961: New createMCPTool helper for correct types for MCP Server tools
- 61debef: Fix - add missing tool options to createTool
- 9beaeff: Create new `@mastra/ai-sdk` package to better support `useChat()`
- 29de0e1: MastraEmbeddingModel and ts hack
- f643c65: Support file download
- 00c74e7: Added a DefaultExporter for AI Tracing.
- fef7375: Fix tool validation when schema uses context or inputData reserved keys
- e3d8fea: Support Inngest flow control features for Mastra Inngest workflows
- 45e4d39: Try fixing the `Attempted import error: 'z'.'toJSONSchema' is not exported from 'zod'` error by tricking the compiler
- 9eee594: Fix passing providerOptions through in streamVNext, enabling reasoning-delta chunks to be receiving.
- 7149d8d: Add tripwire chunk to streamVNext full stream
- 822c2e8: Fix custom output (tool-output) in ai-sdk stream output
- 979912c: "Updated langfuse exporter to handle Event spans"
- 7dcf4c0: Ensure original stacktrace is preserved during workflow runs
- 4106a58: Fix image handling for Google Gemini and other providers when using streamVNext (fixes #7362)
- ad78bfc: "pipes tracingContext through all ai items: agents, workflows, tools, processors, scorers, etc.."
- 0302f50: Some LLM providers (openrouter for ex) add response-metadata chunks after each text-delta, this was resulting in us flushing text deltas into parts after each delta, so our output messages (with streamVNext) would have a separate text part for each text delta, instead of one text part for the combined deltas
- 6ac697e: improveEmbeddingModelStuff
- 74db265: Adds handling for event-type spans to the default ai observability exporter
- 0ce418a: upgrade ai v5 versions to latest for core and memory
- af90672: Add maxSteps
- 8387952: Register scorers on mastra instance to override per agent generate call
- 7f3b8da: Automatically pipe writer to workflows as a tool.
  Also changed start, finish, step-output events to be workflow-start, workflow-finish and workflow-step-output
- 905352b: Support AISDK models for runExperiment
- 599d04c: follow up fix for scorers
- 56041d0: Don't set supportsStructuredOutputs for every v2 model
- 3412597: Pass provider options
- 5eca5d2: Fixed wrapped mastra class inside workflow steps.
- f2cda47: Fixed issue where multiple split messages were created with identical content
  instead of properly distributing different parts of the original message.
- 5de1555: Fixed tracingContext on tool executions in AI tracing
- cfd377a: fix default stream options onFinish being overridden
- 1ed5a3e: Support workflows for run experiments
- Updated dependencies [ab48c97]
- Updated dependencies [637f323]
- Updated dependencies [de3cbc6]
- Updated dependencies [45e4d39]
  - @mastra/schema-compat@0.11.2

## 0.15.3-alpha.9

### Patch Changes

- [#7401](https://github.com/mastra-ai/mastra/pull/7401) [`599d04c`](https://github.com/mastra-ai/mastra/commit/599d04cebe92c1d536fee3190434941b8c91548e) Thanks [@YujohnNattrass](https://github.com/YujohnNattrass)! - follow up fix for scorers

## 0.15.3-alpha.8

### Patch Changes

- [#7397](https://github.com/mastra-ai/mastra/pull/7397) [`4474d04`](https://github.com/mastra-ai/mastra/commit/4474d0489b1e152e0985c33a4f529207317d27b5) Thanks [@YujohnNattrass](https://github.com/YujohnNattrass)! - fix: do not pass tracing context to score run

- [#7396](https://github.com/mastra-ai/mastra/pull/7396) [`4106a58`](https://github.com/mastra-ai/mastra/commit/4106a58b15b4c0a060a4a9ccab52d119d00d8edb) Thanks [@TylerBarnes](https://github.com/TylerBarnes)! - Fix image handling for Google Gemini and other providers when using streamVNext (fixes #7362)

## 0.15.3-alpha.7

### Patch Changes

- [#7392](https://github.com/mastra-ai/mastra/pull/7392) [`7149d8d`](https://github.com/mastra-ai/mastra/commit/7149d8d4bdc1edf0008e0ca9b7925eb0b8b60dbe) Thanks [@abhiaiyer91](https://github.com/abhiaiyer91)! - Add tripwire chunk to streamVNext full stream

## 0.15.3-alpha.6

### Patch Changes

- [#7361](https://github.com/mastra-ai/mastra/pull/7361) [`c19bcf7`](https://github.com/mastra-ai/mastra/commit/c19bcf7b43542b02157b5e17303e519933a153ab) Thanks [@epinzur](https://github.com/epinzur)! - stopped recording event spans for llm_chunks in ai-observability

- [#7383](https://github.com/mastra-ai/mastra/pull/7383) [`b42a961`](https://github.com/mastra-ai/mastra/commit/b42a961a5aefd19d6e938a7705fc0ecc90e8f756) Thanks [@DanielSLew](https://github.com/DanielSLew)! - New createMCPTool helper for correct types for MCP Server tools

- [#7350](https://github.com/mastra-ai/mastra/pull/7350) [`45e4d39`](https://github.com/mastra-ai/mastra/commit/45e4d391a2a09fc70c48e4d60f505586ada1ba0e) Thanks [@LekoArts](https://github.com/LekoArts)! - Try fixing the `Attempted import error: 'z'.'toJSONSchema' is not exported from 'zod'` error by tricking the compiler

- [#7382](https://github.com/mastra-ai/mastra/pull/7382) [`0302f50`](https://github.com/mastra-ai/mastra/commit/0302f50861a53c66ff28801fc371b37c5f97e41e) Thanks [@TylerBarnes](https://github.com/TylerBarnes)! - Some LLM providers (openrouter for ex) add response-metadata chunks after each text-delta, this was resulting in us flushing text deltas into parts after each delta, so our output messages (with streamVNext) would have a separate text part for each text delta, instead of one text part for the combined deltas

- [#7353](https://github.com/mastra-ai/mastra/pull/7353) [`74db265`](https://github.com/mastra-ai/mastra/commit/74db265b96aa01a72ffd91dcae0bc3b346cca0f2) Thanks [@epinzur](https://github.com/epinzur)! - Adds handling for event-type spans to the default ai observability exporter

- [#7355](https://github.com/mastra-ai/mastra/pull/7355) [`7f3b8da`](https://github.com/mastra-ai/mastra/commit/7f3b8da6dd21c35d3672e44b4f5dd3502b8f8f92) Thanks [@rase-](https://github.com/rase-)! - Automatically pipe writer to workflows as a tool.
  Also changed start, finish, step-output events to be workflow-start, workflow-finish and workflow-step-output

- [#7081](https://github.com/mastra-ai/mastra/pull/7081) [`905352b`](https://github.com/mastra-ai/mastra/commit/905352bcda134552400eb252bca1cb05a7975c14) Thanks [@YujohnNattrass](https://github.com/YujohnNattrass)! - Support AISDK models for runExperiment

- [#7321](https://github.com/mastra-ai/mastra/pull/7321) [`f2cda47`](https://github.com/mastra-ai/mastra/commit/f2cda47ae911038c5d5489f54c36517d6f15bdcc) Thanks [@TylerBarnes](https://github.com/TylerBarnes)! - Fixed issue where multiple split messages were created with identical content
  instead of properly distributing different parts of the original message.

- [#7386](https://github.com/mastra-ai/mastra/pull/7386) [`cfd377a`](https://github.com/mastra-ai/mastra/commit/cfd377a3a33a9c88b644f6540feed9cd9832db47) Thanks [@NikAiyer](https://github.com/NikAiyer)! - fix default stream options onFinish being overridden

- Updated dependencies [[`45e4d39`](https://github.com/mastra-ai/mastra/commit/45e4d391a2a09fc70c48e4d60f505586ada1ba0e)]:
  - @mastra/schema-compat@0.11.2-alpha.3

## 0.15.3-alpha.5

### Patch Changes

- [#7272](https://github.com/mastra-ai/mastra/pull/7272) [`85ef90b`](https://github.com/mastra-ai/mastra/commit/85ef90bb2cd4ae4df855c7ac175f7d392c55c1bf) Thanks [@taofeeq-deru](https://github.com/taofeeq-deru)! - Return nested workflow steps information in getWorkflowRunExecutionResult

- [#7343](https://github.com/mastra-ai/mastra/pull/7343) [`de3cbc6`](https://github.com/mastra-ai/mastra/commit/de3cbc61079211431bd30487982ea3653517278e) Thanks [@LekoArts](https://github.com/LekoArts)! - Update the `package.json` file to include additional fields like `repository`, `homepage` or `files`.

- Updated dependencies [[`de3cbc6`](https://github.com/mastra-ai/mastra/commit/de3cbc61079211431bd30487982ea3653517278e)]:
  - @mastra/schema-compat@0.11.2-alpha.2

## 0.15.3-alpha.4

### Patch Changes

- [#5816](https://github.com/mastra-ai/mastra/pull/5816) [`ab48c97`](https://github.com/mastra-ai/mastra/commit/ab48c979098ea571faf998a55d3a00e7acd7a715) Thanks [@dane-ai-mastra](https://github.com/apps/dane-ai-mastra)! - dependencies updates:
  - Updated dependency [`zod-to-json-schema@^3.24.6` ↗︎](https://www.npmjs.com/package/zod-to-json-schema/v/3.24.6) (from `^3.24.5`, in `dependencies`)

- [#7269](https://github.com/mastra-ai/mastra/pull/7269) [`ff89505`](https://github.com/mastra-ai/mastra/commit/ff895057c8c7e91a5535faef46c5e5391085ddfa) Thanks [@wardpeet](https://github.com/wardpeet)! - Add deprecation warnings and add legacy routes

- [#7317](https://github.com/mastra-ai/mastra/pull/7317) [`183dc95`](https://github.com/mastra-ai/mastra/commit/183dc95596f391b977bd1a2c050b8498dac74891) Thanks [@TylerBarnes](https://github.com/TylerBarnes)! - Added a fix to prevent filtering out injected initial default user messages. Related to issue 7231

- [#7327](https://github.com/mastra-ai/mastra/pull/7327) [`a1111e2`](https://github.com/mastra-ai/mastra/commit/a1111e24e705488adfe5e0a6f20c53bddf26cb22) Thanks [@TylerBarnes](https://github.com/TylerBarnes)! - Fixes #7254 where the onFinish callback wasn't returning assistant messages when using format: 'aisdk' in streamVNext. The messageList was being updated with response messages but these weren't being passed to the user's onFinish callback.

- [#7267](https://github.com/mastra-ai/mastra/pull/7267) [`61debef`](https://github.com/mastra-ai/mastra/commit/61debefd80ad3a7ed5737e19df6a23d40091689a) Thanks [@TheIsrael1](https://github.com/TheIsrael1)! - Fix - add missing tool options to createTool

- [#7263](https://github.com/mastra-ai/mastra/pull/7263) [`9beaeff`](https://github.com/mastra-ai/mastra/commit/9beaeffa4a97b1d5fd01a7f8af8708b16067f67c) Thanks [@wardpeet](https://github.com/wardpeet)! - Create new `@mastra/ai-sdk` package to better support `useChat()`

- [#7323](https://github.com/mastra-ai/mastra/pull/7323) [`9eee594`](https://github.com/mastra-ai/mastra/commit/9eee594e35e0ca2a650fcc33fa82009a142b9ed0) Thanks [@DanielSLew](https://github.com/DanielSLew)! - Fix passing providerOptions through in streamVNext, enabling reasoning-delta chunks to be receiving.

- [#7266](https://github.com/mastra-ai/mastra/pull/7266) [`979912c`](https://github.com/mastra-ai/mastra/commit/979912cfd180aad53287cda08af771df26454e2c) Thanks [@epinzur](https://github.com/epinzur)! - "Updated langfuse exporter to handle Event spans"

- [#6966](https://github.com/mastra-ai/mastra/pull/6966) [`7dcf4c0`](https://github.com/mastra-ai/mastra/commit/7dcf4c04f44d9345b1f8bc5d41eae3f11ac61611) Thanks [@kaorukobo](https://github.com/kaorukobo)! - Ensure original stacktrace is preserved during workflow runs

- [#7274](https://github.com/mastra-ai/mastra/pull/7274) [`ad78bfc`](https://github.com/mastra-ai/mastra/commit/ad78bfc4ea6a1fff140432bf4f638e01af7af668) Thanks [@epinzur](https://github.com/epinzur)! - "pipes tracingContext through all ai items: agents, workflows, tools, processors, scorers, etc.."

- [#7219](https://github.com/mastra-ai/mastra/pull/7219) [`0ce418a`](https://github.com/mastra-ai/mastra/commit/0ce418a1ccaa5e125d4483a9651b635046152569) Thanks [@NikAiyer](https://github.com/NikAiyer)! - upgrade ai v5 versions to latest for core and memory

- [#7039](https://github.com/mastra-ai/mastra/pull/7039) [`8387952`](https://github.com/mastra-ai/mastra/commit/838795227b4edf758c84a2adf6f7fba206c27719) Thanks [@YujohnNattrass](https://github.com/YujohnNattrass)! - Register scorers on mastra instance to override per agent generate call

- [#7246](https://github.com/mastra-ai/mastra/pull/7246) [`5eca5d2`](https://github.com/mastra-ai/mastra/commit/5eca5d2655788863ea0442a46c9ef5d3c6dbe0a8) Thanks [@epinzur](https://github.com/epinzur)! - Fixed wrapped mastra class inside workflow steps.

- Updated dependencies [[`ab48c97`](https://github.com/mastra-ai/mastra/commit/ab48c979098ea571faf998a55d3a00e7acd7a715)]:
  - @mastra/schema-compat@0.11.2-alpha.1

## 0.15.3-alpha.3

### Patch Changes

- [#7203](https://github.com/mastra-ai/mastra/pull/7203) [`aedbbfa`](https://github.com/mastra-ai/mastra/commit/aedbbfa064124ddde039111f12629daebfea7e48) Thanks [@epinzur](https://github.com/epinzur)! - Fixed wrapping of models with AI Tracing when used with structured output.

- [#7127](https://github.com/mastra-ai/mastra/pull/7127) [`f643c65`](https://github.com/mastra-ai/mastra/commit/f643c651bdaf57c2343cf9dbfc499010495701fb) Thanks [@abhiaiyer91](https://github.com/abhiaiyer91)! - Support file download

- [#7216](https://github.com/mastra-ai/mastra/pull/7216) [`fef7375`](https://github.com/mastra-ai/mastra/commit/fef737534574f41b432a7361a285f776c3bac42b) Thanks [@DanielSLew](https://github.com/DanielSLew)! - Fix tool validation when schema uses context or inputData reserved keys

- [#7090](https://github.com/mastra-ai/mastra/pull/7090) [`e3d8fea`](https://github.com/mastra-ai/mastra/commit/e3d8feaacfb8b5c5c03c13604cc06ea2873d45fe) Thanks [@K-Mistele](https://github.com/K-Mistele)! - Support Inngest flow control features for Mastra Inngest workflows

- [#7217](https://github.com/mastra-ai/mastra/pull/7217) [`3412597`](https://github.com/mastra-ai/mastra/commit/3412597a6644c0b6bf3236d6e319ed1450c5bae8) Thanks [@abhiaiyer91](https://github.com/abhiaiyer91)! - Pass provider options

## 0.15.3-alpha.2

### Patch Changes

- [#7129](https://github.com/mastra-ai/mastra/pull/7129) [`822c2e8`](https://github.com/mastra-ai/mastra/commit/822c2e88a3ecbffb7c680e6227976006ccefe6a8) Thanks [@wardpeet](https://github.com/wardpeet)! - Fix custom output (tool-output) in ai-sdk stream output

## 0.15.3-alpha.1

### Patch Changes

- [#7121](https://github.com/mastra-ai/mastra/pull/7121) [`637f323`](https://github.com/mastra-ai/mastra/commit/637f32371d79a8f78c52c0d53411af0915fcec67) Thanks [@DanielSLew](https://github.com/DanielSLew)! - Fix issue with some compilers and calling zod v4's toJSONSchema function

- [#7124](https://github.com/mastra-ai/mastra/pull/7124) [`29de0e1`](https://github.com/mastra-ai/mastra/commit/29de0e1b0a7173317ae7d1ab0c0993167c659f2b) Thanks [@abhiaiyer91](https://github.com/abhiaiyer91)! - MastraEmbeddingModel and ts hack

- [#7125](https://github.com/mastra-ai/mastra/pull/7125) [`6ac697e`](https://github.com/mastra-ai/mastra/commit/6ac697edcc2435482c247cba615277ec4765dcc4) Thanks [@abhiaiyer91](https://github.com/abhiaiyer91)! - improveEmbeddingModelStuff

- Updated dependencies [[`637f323`](https://github.com/mastra-ai/mastra/commit/637f32371d79a8f78c52c0d53411af0915fcec67)]:
  - @mastra/schema-compat@0.11.2-alpha.0

## 0.15.3-alpha.0

### Patch Changes

- [#7085](https://github.com/mastra-ai/mastra/pull/7085) [`00c74e7`](https://github.com/mastra-ai/mastra/commit/00c74e73b1926be0d475693bb886fb67a22ff352) Thanks [@epinzur](https://github.com/epinzur)! - Added a DefaultExporter for AI Tracing.

- [#7030](https://github.com/mastra-ai/mastra/pull/7030) [`af90672`](https://github.com/mastra-ai/mastra/commit/af906722d8da28688882193b1e531026f9e2e81e) Thanks [@abhiaiyer91](https://github.com/abhiaiyer91)! - Add maxSteps

- [#7116](https://github.com/mastra-ai/mastra/pull/7116) [`56041d0`](https://github.com/mastra-ai/mastra/commit/56041d018863a3da6b98c512e47348647c075fb3) Thanks [@DanielSLew](https://github.com/DanielSLew)! - Don't set supportsStructuredOutputs for every v2 model

- [#7109](https://github.com/mastra-ai/mastra/pull/7109) [`5de1555`](https://github.com/mastra-ai/mastra/commit/5de15554d3d6695211945a36928f6657e76cddc9) Thanks [@epinzur](https://github.com/epinzur)! - Fixed tracingContext on tool executions in AI tracing

- [#7025](https://github.com/mastra-ai/mastra/pull/7025) [`1ed5a3e`](https://github.com/mastra-ai/mastra/commit/1ed5a3e19330374c4347a4237cd2f4b9ffb60376) Thanks [@YujohnNattrass](https://github.com/YujohnNattrass)! - Support workflows for run experiments

## 0.15.2

### Patch Changes

- Updated dependencies [[`c6113ed`](https://github.com/mastra-ai/mastra/commit/c6113ed7f9df297e130d94436ceee310273d6430)]:
  - @mastra/schema-compat@0.11.1

## 0.15.0

### Minor Changes

- [#7032](https://github.com/mastra-ai/mastra/pull/7032) [`1191ce9`](https://github.com/mastra-ai/mastra/commit/1191ce946b40ed291e7877a349f8388e3cff7e5c) Thanks [@wardpeet](https://github.com/wardpeet)! - Bump zod peerdep to 3.25.0 to support both v3/v4

### Patch Changes

- [#6938](https://github.com/mastra-ai/mastra/pull/6938) [`0778757`](https://github.com/mastra-ai/mastra/commit/07787570e4addbd501522037bd2542c3d9e26822) Thanks [@dane-ai-mastra](https://github.com/apps/dane-ai-mastra)! - dependencies updates:
  - Updated dependency [`@opentelemetry/auto-instrumentations-node@^0.62.1` ↗︎](https://www.npmjs.com/package/@opentelemetry/auto-instrumentations-node/v/0.62.1) (from `^0.62.0`, in `dependencies`)

- [#6997](https://github.com/mastra-ai/mastra/pull/6997) [`943a7f3`](https://github.com/mastra-ai/mastra/commit/943a7f3dbc6a8ab3f9b7bc7c8a1c5b319c3d7f56) Thanks [@wardpeet](https://github.com/wardpeet)! - Bundle/mastra speed improvements

- [#6933](https://github.com/mastra-ai/mastra/pull/6933) [`bf504a8`](https://github.com/mastra-ai/mastra/commit/bf504a833051f6f321d832cc7d631f3cb86d657b) Thanks [@NikAiyer](https://github.com/NikAiyer)! - Add util functions for workflow server handlers and made processor process function async

- [#6954](https://github.com/mastra-ai/mastra/pull/6954) [`be49354`](https://github.com/mastra-ai/mastra/commit/be493546dca540101923ec700feb31f9a13939f2) Thanks [@YujohnNattrass](https://github.com/YujohnNattrass)! - Add db schema and base storage apis for AI Tracing

- [#6957](https://github.com/mastra-ai/mastra/pull/6957) [`d591ab3`](https://github.com/mastra-ai/mastra/commit/d591ab3ecc985c1870c0db347f8d7a20f7360536) Thanks [@YujohnNattrass](https://github.com/YujohnNattrass)! - Implement Tracing API for inmemory(mock) storage

- [#6923](https://github.com/mastra-ai/mastra/pull/6923) [`ba82abe`](https://github.com/mastra-ai/mastra/commit/ba82abe76e869316bb5a9c95e8ea3946f3436fae) Thanks [@rase-](https://github.com/rase-)! - Event based execution engine

- [#6971](https://github.com/mastra-ai/mastra/pull/6971) [`727f7e5`](https://github.com/mastra-ai/mastra/commit/727f7e5086e62e0dfe3356fb6dcd8bcb420af246) Thanks [@epinzur](https://github.com/epinzur)! - "updated ai tracing in workflows"

- [#6949](https://github.com/mastra-ai/mastra/pull/6949) [`e6f5046`](https://github.com/mastra-ai/mastra/commit/e6f50467aff317e67e8bd74c485c3fbe2a5a6db1) Thanks [@CalebBarnes](https://github.com/CalebBarnes)! - stream/generate vnext: simplify internal output schema handling, improve types and typescript generics, and add jsdoc comments

- [#6993](https://github.com/mastra-ai/mastra/pull/6993) [`82d9f64`](https://github.com/mastra-ai/mastra/commit/82d9f647fbe4f0177320e7c05073fce88599aa95) Thanks [@wardpeet](https://github.com/wardpeet)! - Improve types and fix linting issues

- [#7020](https://github.com/mastra-ai/mastra/pull/7020) [`2e58325`](https://github.com/mastra-ai/mastra/commit/2e58325beb170f5b92f856e27d915cd26917e5e6) Thanks [@YujohnNattrass](https://github.com/YujohnNattrass)! - Add column to ai spans table to tell if it's an event

- [#7011](https://github.com/mastra-ai/mastra/pull/7011) [`4189486`](https://github.com/mastra-ai/mastra/commit/4189486c6718fda78347bdf4ce4d3fc33b2236e1) Thanks [@epinzur](https://github.com/epinzur)! - Wrapped mastra objects in workflow steps to automatically pass on tracing context

- [#6942](https://github.com/mastra-ai/mastra/pull/6942) [`ca8ec2f`](https://github.com/mastra-ai/mastra/commit/ca8ec2f61884b9dfec5fc0d5f4f29d281ad13c01) Thanks [@wardpeet](https://github.com/wardpeet)! - Add zod as peerdeps for all packages

- [#6943](https://github.com/mastra-ai/mastra/pull/6943) [`9613558`](https://github.com/mastra-ai/mastra/commit/9613558e6475f4710e05d1be7553a32ee7bddc20) Thanks [@taofeeq-deru](https://github.com/taofeeq-deru)! - Persist to snapshot when step starts

- Updated dependencies [[`da58ccc`](https://github.com/mastra-ai/mastra/commit/da58ccc1f2ac33da0cb97b00443fc6208b45bdec), [`94e9f54`](https://github.com/mastra-ai/mastra/commit/94e9f547d66ef7cd01d9075ab53b5ca9a1cae100), [`1191ce9`](https://github.com/mastra-ai/mastra/commit/1191ce946b40ed291e7877a349f8388e3cff7e5c), [`a93f3ba`](https://github.com/mastra-ai/mastra/commit/a93f3ba05eef4cf17f876d61d29cf0841a9e70b7)]:
  - @mastra/schema-compat@0.11.0

## 0.15.0-alpha.4

### Minor Changes

- [#7032](https://github.com/mastra-ai/mastra/pull/7032) [`1191ce9`](https://github.com/mastra-ai/mastra/commit/1191ce946b40ed291e7877a349f8388e3cff7e5c) Thanks [@wardpeet](https://github.com/wardpeet)! - Bump zod peerdep to 3.25.0 to support both v3/v4

### Patch Changes

- Updated dependencies [[`1191ce9`](https://github.com/mastra-ai/mastra/commit/1191ce946b40ed291e7877a349f8388e3cff7e5c)]:
  - @mastra/schema-compat@0.11.0-alpha.2

## 0.15.0-alpha.3

### Patch Changes

- Updated dependencies [[`da58ccc`](https://github.com/mastra-ai/mastra/commit/da58ccc1f2ac33da0cb97b00443fc6208b45bdec)]:
  - @mastra/schema-compat@0.10.6-alpha.1

## 0.14.2-alpha.2

### Patch Changes

- [#7020](https://github.com/mastra-ai/mastra/pull/7020) [`2e58325`](https://github.com/mastra-ai/mastra/commit/2e58325beb170f5b92f856e27d915cd26917e5e6) Thanks [@YujohnNattrass](https://github.com/YujohnNattrass)! - Add column to ai spans table to tell if it's an event

## 0.14.2-alpha.1

### Patch Changes

- [#6997](https://github.com/mastra-ai/mastra/pull/6997) [`943a7f3`](https://github.com/mastra-ai/mastra/commit/943a7f3dbc6a8ab3f9b7bc7c8a1c5b319c3d7f56) Thanks [@wardpeet](https://github.com/wardpeet)! - Bundle/mastra speed improvements

- [#6954](https://github.com/mastra-ai/mastra/pull/6954) [`be49354`](https://github.com/mastra-ai/mastra/commit/be493546dca540101923ec700feb31f9a13939f2) Thanks [@YujohnNattrass](https://github.com/YujohnNattrass)! - Add db schema and base storage apis for AI Tracing

- [#6957](https://github.com/mastra-ai/mastra/pull/6957) [`d591ab3`](https://github.com/mastra-ai/mastra/commit/d591ab3ecc985c1870c0db347f8d7a20f7360536) Thanks [@YujohnNattrass](https://github.com/YujohnNattrass)! - Implement Tracing API for inmemory(mock) storage

- [#6923](https://github.com/mastra-ai/mastra/pull/6923) [`ba82abe`](https://github.com/mastra-ai/mastra/commit/ba82abe76e869316bb5a9c95e8ea3946f3436fae) Thanks [@rase-](https://github.com/rase-)! - Event based execution engine

- [#6971](https://github.com/mastra-ai/mastra/pull/6971) [`727f7e5`](https://github.com/mastra-ai/mastra/commit/727f7e5086e62e0dfe3356fb6dcd8bcb420af246) Thanks [@epinzur](https://github.com/epinzur)! - "updated ai tracing in workflows"

- [#6993](https://github.com/mastra-ai/mastra/pull/6993) [`82d9f64`](https://github.com/mastra-ai/mastra/commit/82d9f647fbe4f0177320e7c05073fce88599aa95) Thanks [@wardpeet](https://github.com/wardpeet)! - Improve types and fix linting issues

- [#7011](https://github.com/mastra-ai/mastra/pull/7011) [`4189486`](https://github.com/mastra-ai/mastra/commit/4189486c6718fda78347bdf4ce4d3fc33b2236e1) Thanks [@epinzur](https://github.com/epinzur)! - Wrapped mastra objects in workflow steps to automatically pass on tracing context

- [#6942](https://github.com/mastra-ai/mastra/pull/6942) [`ca8ec2f`](https://github.com/mastra-ai/mastra/commit/ca8ec2f61884b9dfec5fc0d5f4f29d281ad13c01) Thanks [@wardpeet](https://github.com/wardpeet)! - Add zod as peerdeps for all packages

- Updated dependencies [[`94e9f54`](https://github.com/mastra-ai/mastra/commit/94e9f547d66ef7cd01d9075ab53b5ca9a1cae100), [`a93f3ba`](https://github.com/mastra-ai/mastra/commit/a93f3ba05eef4cf17f876d61d29cf0841a9e70b7)]:
  - @mastra/schema-compat@0.10.6-alpha.0

## 0.14.2-alpha.0

### Patch Changes

- [#6938](https://github.com/mastra-ai/mastra/pull/6938) [`0778757`](https://github.com/mastra-ai/mastra/commit/07787570e4addbd501522037bd2542c3d9e26822) Thanks [@dane-ai-mastra](https://github.com/apps/dane-ai-mastra)! - dependencies updates:
  - Updated dependency [`@opentelemetry/auto-instrumentations-node@^0.62.1` ↗︎](https://www.npmjs.com/package/@opentelemetry/auto-instrumentations-node/v/0.62.1) (from `^0.62.0`, in `dependencies`)

- [#6933](https://github.com/mastra-ai/mastra/pull/6933) [`bf504a8`](https://github.com/mastra-ai/mastra/commit/bf504a833051f6f321d832cc7d631f3cb86d657b) Thanks [@NikAiyer](https://github.com/NikAiyer)! - Add util functions for workflow server handlers and made processor process function async

- [#6949](https://github.com/mastra-ai/mastra/pull/6949) [`e6f5046`](https://github.com/mastra-ai/mastra/commit/e6f50467aff317e67e8bd74c485c3fbe2a5a6db1) Thanks [@CalebBarnes](https://github.com/CalebBarnes)! - stream/generate vnext: simplify internal output schema handling, improve types and typescript generics, and add jsdoc comments

- [#6943](https://github.com/mastra-ai/mastra/pull/6943) [`9613558`](https://github.com/mastra-ai/mastra/commit/9613558e6475f4710e05d1be7553a32ee7bddc20) Thanks [@taofeeq-deru](https://github.com/taofeeq-deru)! - Persist to snapshot when step starts

## 0.14.1

### Patch Changes

- [#6919](https://github.com/mastra-ai/mastra/pull/6919) [`6e7e120`](https://github.com/mastra-ai/mastra/commit/6e7e1207d6e8d8b838f9024f90bd10df1181ba27) Thanks [@dane-ai-mastra](https://github.com/apps/dane-ai-mastra)! - dependencies updates:
  - Updated dependency [`@ai-sdk/provider-utils-v5@npm:@ai-sdk/provider-utils@3.0.3` ↗︎](https://www.npmjs.com/package/@ai-sdk/provider-utils-v5/v/3.0.3) (from `npm:@ai-sdk/provider-utils@3.0.0`, in `dependencies`)
  - Updated dependency [`ai@^4.3.19` ↗︎](https://www.npmjs.com/package/ai/v/4.3.19) (from `^4.3.16`, in `dependencies`)
  - Updated dependency [`ai-v5@npm:ai@5.0.15` ↗︎](https://www.npmjs.com/package/ai-v5/v/5.0.15) (from `npm:ai@5.0.0`, in `dependencies`)

- [#6864](https://github.com/mastra-ai/mastra/pull/6864) [`0f00e17`](https://github.com/mastra-ai/mastra/commit/0f00e172953ccdccadb35ed3d70f5e4d89115869) Thanks [@TylerBarnes](https://github.com/TylerBarnes)! - Added a convertMessages(from).to("Mastra.V2" | "AIV\*") util for operating on DB messages directly

- [#6927](https://github.com/mastra-ai/mastra/pull/6927) [`217cd7a`](https://github.com/mastra-ai/mastra/commit/217cd7a4ce171e9a575c41bb8c83300f4db03236) Thanks [@DanielSLew](https://github.com/DanielSLew)! - Fix output processors to match new stream types.

- [#6700](https://github.com/mastra-ai/mastra/pull/6700) [`a5a23d9`](https://github.com/mastra-ai/mastra/commit/a5a23d981920d458dc6078919992a5338931ef02) Thanks [@gpanakkal](https://github.com/gpanakkal)! - Add `getMessagesById` method to `MastraStorage` adapters

## 0.14.1-alpha.1

### Patch Changes

- [#6864](https://github.com/mastra-ai/mastra/pull/6864) [`0f00e17`](https://github.com/mastra-ai/mastra/commit/0f00e172953ccdccadb35ed3d70f5e4d89115869) Thanks [@TylerBarnes](https://github.com/TylerBarnes)! - Added a convertMessages(from).to("Mastra.V2" | "AIV\*") util for operating on DB messages directly

- [#6927](https://github.com/mastra-ai/mastra/pull/6927) [`217cd7a`](https://github.com/mastra-ai/mastra/commit/217cd7a4ce171e9a575c41bb8c83300f4db03236) Thanks [@DanielSLew](https://github.com/DanielSLew)! - Fix output processors to match new stream types.

## 0.14.1-alpha.0

### Patch Changes

- [#6919](https://github.com/mastra-ai/mastra/pull/6919) [`6e7e120`](https://github.com/mastra-ai/mastra/commit/6e7e1207d6e8d8b838f9024f90bd10df1181ba27) Thanks [@dane-ai-mastra](https://github.com/apps/dane-ai-mastra)! - dependencies updates:
  - Updated dependency [`@ai-sdk/provider-utils-v5@npm:@ai-sdk/provider-utils@3.0.3` ↗︎](https://www.npmjs.com/package/@ai-sdk/provider-utils-v5/v/3.0.3) (from `npm:@ai-sdk/provider-utils@3.0.0`, in `dependencies`)
  - Updated dependency [`ai@^4.3.19` ↗︎](https://www.npmjs.com/package/ai/v/4.3.19) (from `^4.3.16`, in `dependencies`)
  - Updated dependency [`ai-v5@npm:ai@5.0.15` ↗︎](https://www.npmjs.com/package/ai-v5/v/5.0.15) (from `npm:ai@5.0.0`, in `dependencies`)

- [#6700](https://github.com/mastra-ai/mastra/pull/6700) [`a5a23d9`](https://github.com/mastra-ai/mastra/commit/a5a23d981920d458dc6078919992a5338931ef02) Thanks [@gpanakkal](https://github.com/gpanakkal)! - Add `getMessagesById` method to `MastraStorage` adapters

## 0.14.0

### Minor Changes

- 3b5fec7: Added AIV5 support to internal MessageList, precursor to full AIV5 support in latest Mastra

### Patch Changes

- 227c7e6: replace console.log with logger.debug in inmemory operations
- 12cae67: fix: add threadId and resourceId to scorers
- fd3a3eb: Add runExperments to run scorers in a test suite or in CI
- 6faaee5: Reworks agent Processor API to include output processors. Adds structuredOutput property in agent.streamVNext and agent.generate to replace experimental_output. Move imports for processors to @mastra/core/processors. Adds 6 new output processors, BatchParts, StructuredOutputProcessor, TokenLimiter, SystemPromptScrubber, ModerationProcessor, PiiDetectorProcessor.
- 4232b14: Fix provider metadata preservation during V5 message conversions

  Provider metadata (providerMetadata and callProviderMetadata) is now properly preserved when converting messages between AI SDK V5 and internal V2 formats. This ensures provider-specific information isn't lost during message transformations.

- a89de7e: Adding a new agentic loop and streaming workflow system while working towards AI SDK v5 support.
- 5a37d0c: Fix dev server bug related to p-map imports
- 4bde0cb: Allow renaming .map functions in workflows
- cf4f357: When using the Cloudflare deployer you might see a `[duplicate-case]` warning. The internal cause for this was fixed.
- ad888a2: Stream vnext agent-network
- 481751d: Tests `mitt.off` event handler removal
- 2454423: Agentic loop and streaming workflow: generateVNext and streamVNext
- 194e395: exclude \_wrapToolsWithAITracing from agent trace
- a722c0b: Added a patch to filter out system messages that were stored in the db via an old memory bug that was patched long ago (see issue 6689). Users upgrading from the old version that still had the bug would see errors when the memory messages were retrieved from the db
- c30bca8: Fix do while resume-suspend in simple workflow losing data
- a8f129d: initial addition of experimental ai observability tracing features.

## 0.14.0-alpha.7

## 0.14.0-alpha.6

### Patch Changes

- ad888a2: Stream vnext agent-network
- 481751d: Tests `mitt.off` event handler removal
- 194e395: exclude \_wrapToolsWithAITracing from agent trace

## 0.14.0-alpha.5

## 0.14.0-alpha.4

### Patch Changes

- 0a7f675: Client JS vnext methods
- 12cae67: fix: add threadId and resourceId to scorers
- 5a37d0c: Fix dev server bug related to p-map imports
- 4bde0cb: Allow renaming .map functions in workflows
- 1a80071: loop code and tests
- 36a3be8: Agent processors tests
- 361757b: Execute method
- 2bb9955: Model loop changes
- 2454423: generateVNext and streamVNext
- a44d91e: Message list changes
- dfb91e9: Server handlers
- a741dde: generateVNext plumbing
- 7cb3fc0: Fix loop test
- 195eabb: Process Mastra Stream
- b78b95b: Support generateVNext in playground

## 0.14.0-alpha.3

### Patch Changes

- 227c7e6: replace console.log with logger.debug in inmemory operations
- fd3a3eb: Add runExperments to run scorers in a test suite or in CI
- a8f129d: "initial addition of experimental ai observability tracing features."

## 0.14.0-alpha.2

## 0.14.0-alpha.1

### Minor Changes

- 3b5fec7: Added AIV5 support to internal MessageList, precursor to full AIV5 support in latest Mastra

### Patch Changes

- 6faaee5: Reworks agent Processor API to include output processors. Adds structuredOutput property in agent.streamVNext and agent.generate to replace experimental_output. Move imports for processors to @mastra/core/processors. Adds 6 new output processors, BatchParts, StructuredOutputProcessor, TokenLimiter, SystemPromptScrubber, ModerationProcessor, PiiDetectorProcessor.
- 4232b14: Fix provider metadata preservation during V5 message conversions

  Provider metadata (providerMetadata and callProviderMetadata) is now properly preserved when converting messages between AI SDK V5 and internal V2 formats. This ensures provider-specific information isn't lost during message transformations.

- a89de7e: Adding a new agentic loop and streaming workflow system while working towards AI SDK v5 support.
- cf4f357: When using the Cloudflare deployer you might see a `[duplicate-case]` warning. The internal cause for this was fixed.
- a722c0b: Added a patch to filter out system messages that were stored in the db via an old memory bug that was patched long ago (see issue 6689). Users upgrading from the old version that still had the bug would see errors when the memory messages were retrieved from the db

## 0.13.3-alpha.0

### Patch Changes

- c30bca8: Fix do while resume-suspend in simple workflow losing data

## 0.13.2

### Patch Changes

- d5330bf: Allow agent model to be updated after the agent is created
- 2e74797: Fix tool arguments being lost when tool-result messages arrive separately from tool-call messages or when messages are restored from database. Tool invocations now correctly preserve their arguments in all scenarios.
- 8388649: Allow array of messages in vnext agent network
- a239d41: Updated A2A syntax to v0.3.0
- dd94a26: Dont rely on the full language model for schema compat
- 3ba6772: MastraModelInput
- b5cf2a3: make system message always available during agent calls
- 2fff911: Fix vnext working memory tool schema when model is incompatible with schema
- b32c50d: Filter scores by source
- 63449d0: Change the function signatures of `bundle`, `lint`, and internally `getToolsInputOptions` to expand the `toolsPaths` TypeScript type from `string[]` to `(string | string[])[]`.
- 121a3f8: Fixed an issue where telemetry logs were displaying promise statuses when `agent.stream` is called
- ec510e7: Tool input validation now returns errors as tool results instead of throwing, allowing agents to understand validation failures and retry with corrected parameters.
- Updated dependencies [dd94a26]
- Updated dependencies [2fff911]
- Updated dependencies [ae2eb63]
  - @mastra/schema-compat@0.10.7

## 0.13.2-alpha.3

### Patch Changes

- b5cf2a3: make system message always available during agent calls

## 0.13.2-alpha.2

### Patch Changes

- d5330bf: Allow agent model to be updated after the agent is created
- a239d41: Updated A2A syntax to v0.3.0
- b32c50d: Filter scores by source
- 121a3f8: Fixed an issue where telemetry logs were displaying promise statuses when `agent.stream` is called
- ec510e7: Tool input validation now returns errors as tool results instead of throwing, allowing agents to understand validation failures and retry with corrected parameters.
- Updated dependencies [ae2eb63]
  - @mastra/schema-compat@0.10.7-alpha.1

## 0.13.2-alpha.1

### Patch Changes

- 2e74797: Fix tool arguments being lost when tool-result messages arrive separately from tool-call messages or when messages are restored from database. Tool invocations now correctly preserve their arguments in all scenarios.
- 63449d0: Change the function signatures of `bundle`, `lint`, and internally `getToolsInputOptions` to expand the `toolsPaths` TypeScript type from `string[]` to `(string | string[])[]`.

## 0.13.2-alpha.0

### Patch Changes

- 8388649: Allow array of messages in vnext agent network
- dd94a26: Dont rely on the full language model for schema compat
- 3ba6772: MastraModelInput
- 2fff911: Fix vnext working memory tool schema when model is incompatible with schema
- Updated dependencies [dd94a26]
- Updated dependencies [2fff911]
  - @mastra/schema-compat@0.10.7-alpha.0

## 0.13.1

### Patch Changes

- cd0042e: Fix tool call history not being accessible in agent conversations

  When converting v2 messages (with combined tool calls and text) to v1 format for memory storage, split messages were all keeping the same ID. This caused later messages to replace earlier ones when added back to MessageList, losing tool history.

  The fix adds ID deduplication by appending `__split-N` suffixes to split messages and prevents double-suffixing when messages are re-converted between formats.

## 0.13.1-alpha.0

### Patch Changes

- cd0042e: Fix tool call history not being accessible in agent conversations

  When converting v2 messages (with combined tool calls and text) to v1 format for memory storage, split messages were all keeping the same ID. This caused later messages to replace earlier ones when added back to MessageList, losing tool history.

  The fix adds ID deduplication by appending `__split-N` suffixes to split messages and prevents double-suffixing when messages are re-converted between formats.

## 0.13.0

### Minor Changes

- ea0c5f2: Update scorer api

### Patch Changes

- cb36de0: dependencies updates:
  - Updated dependency [`hono@^4.8.11` ↗︎](https://www.npmjs.com/package/hono/v/4.8.11) (from `^4.8.9`, in `dependencies`)
- d0496e6: dependencies updates:
  - Updated dependency [`hono@^4.8.12` ↗︎](https://www.npmjs.com/package/hono/v/4.8.12) (from `^4.8.11`, in `dependencies`)
- a82b851: Exclude getVoice, getScorers from agent trace
- 41a0a0e: fixed a minor bug where ID generator wasn't being properly bound to instances of MessageList
- 2871020: update safelyParseJSON to check for value of param when handling parse
- 94f4812: lazy initialize Run's `AbortController`
- e202b82: Add getThreadsByResourceIdPaginated to the Memory Class
- e00f6a0: Fixed an issue where converting from v2->v1 messages would not properly split text and tool call parts into multiple messages
- 4a406ec: fixes TypeScript declaration file imports to ensure proper ESM compatibility
- b0e43c1: Fixed an issue where branching workflow steps maintained "suspended" status even after they've been successfully resumed and executed.
- 5d377e5: Fix tracing of runtimeContext values"
- 1fb812e: Fixed a bug in parallel workflow execution where resuming only one of multiple suspended parallel steps incorrectly completed the entire parallel block. The fix ensures proper execution and state management when resuming from suspension in parallel workflows.
- 35c5798: Add support for transpilePackages option
- Updated dependencies [4a406ec]
  - @mastra/schema-compat@0.10.6

## 0.13.0-alpha.3

### Patch Changes

- d0496e6: dependencies updates:
  - Updated dependency [`hono@^4.8.12` ↗︎](https://www.npmjs.com/package/hono/v/4.8.12) (from `^4.8.11`, in `dependencies`)

## 0.13.0-alpha.2

### Patch Changes

- cb36de0: dependencies updates:
  - Updated dependency [`hono@^4.8.11` ↗︎](https://www.npmjs.com/package/hono/v/4.8.11) (from `^4.8.9`, in `dependencies`)
- a82b851: Exclude getVoice, getScorers from agent trace
- 41a0a0e: fixed a minor bug where ID generator wasn't being properly bound to instances of MessageList
- 2871020: update safelyParseJSON to check for value of param when handling parse
- 4a406ec: fixes TypeScript declaration file imports to ensure proper ESM compatibility
- 5d377e5: Fix tracing of runtimeContext values"
- Updated dependencies [4a406ec]
  - @mastra/schema-compat@0.10.6-alpha.0

## 0.13.0-alpha.1

### Minor Changes

- ea0c5f2: Update scorer api

### Patch Changes

- b0e43c1: Fixed an issue where branching workflow steps maintained "suspended" status even after they've been successfully resumed and executed.
- 1fb812e: Fixed a bug in parallel workflow execution where resuming only one of multiple suspended parallel steps incorrectly completed the entire parallel block. The fix ensures proper execution and state management when resuming from suspension in parallel workflows.
- 35c5798: Add support for transpilePackages option

## 0.12.2-alpha.0

### Patch Changes

- 94f4812: lazy initialize Run's `AbortController`
- e202b82: Add getThreadsByResourceIdPaginated to the Memory Class
- e00f6a0: Fixed an issue where converting from v2->v1 messages would not properly split text and tool call parts into multiple messages

## 0.12.1

### Patch Changes

- 33dcb07: dependencies updates:
  - Updated dependency [`@opentelemetry/auto-instrumentations-node@^0.62.0` ↗︎](https://www.npmjs.com/package/@opentelemetry/auto-instrumentations-node/v/0.62.0) (from `^0.59.0`, in `dependencies`)
  - Updated dependency [`@opentelemetry/exporter-trace-otlp-grpc@^0.203.0` ↗︎](https://www.npmjs.com/package/@opentelemetry/exporter-trace-otlp-grpc/v/0.203.0) (from `^0.201.1`, in `dependencies`)
  - Updated dependency [`@opentelemetry/exporter-trace-otlp-http@^0.203.0` ↗︎](https://www.npmjs.com/package/@opentelemetry/exporter-trace-otlp-http/v/0.203.0) (from `^0.201.1`, in `dependencies`)
  - Updated dependency [`@opentelemetry/otlp-exporter-base@^0.203.0` ↗︎](https://www.npmjs.com/package/@opentelemetry/otlp-exporter-base/v/0.203.0) (from `^0.201.1`, in `dependencies`)
  - Updated dependency [`@opentelemetry/otlp-transformer@^0.203.0` ↗︎](https://www.npmjs.com/package/@opentelemetry/otlp-transformer/v/0.203.0) (from `^0.201.1`, in `dependencies`)
  - Updated dependency [`@opentelemetry/sdk-node@^0.203.0` ↗︎](https://www.npmjs.com/package/@opentelemetry/sdk-node/v/0.203.0) (from `^0.201.1`, in `dependencies`)
  - Updated dependency [`@opentelemetry/semantic-conventions@^1.36.0` ↗︎](https://www.npmjs.com/package/@opentelemetry/semantic-conventions/v/1.36.0) (from `^1.34.0`, in `dependencies`)
- d0d9500: Fixed an issue where AWS Bedrock is expecting a user message at the beginning of the message list
- d30b1a0: Remove js-tiktoken as it's unused
- bff87f7: fix issue where v1 messages from db wouldn't properly show tool calls in llm context window from historry
- b4a8df0: Fixed an issue where memory instances were not being registered with Mastra and custom ID generators weren't being used

## 0.12.1-alpha.1

### Patch Changes

- d0d9500: Fixed an issue where AWS Bedrock is expecting a user message at the beginning of the message list

## 0.12.1-alpha.0

### Patch Changes

- 33dcb07: dependencies updates:
  - Updated dependency [`@opentelemetry/auto-instrumentations-node@^0.62.0` ↗︎](https://www.npmjs.com/package/@opentelemetry/auto-instrumentations-node/v/0.62.0) (from `^0.59.0`, in `dependencies`)
  - Updated dependency [`@opentelemetry/exporter-trace-otlp-grpc@^0.203.0` ↗︎](https://www.npmjs.com/package/@opentelemetry/exporter-trace-otlp-grpc/v/0.203.0) (from `^0.201.1`, in `dependencies`)
  - Updated dependency [`@opentelemetry/exporter-trace-otlp-http@^0.203.0` ↗︎](https://www.npmjs.com/package/@opentelemetry/exporter-trace-otlp-http/v/0.203.0) (from `^0.201.1`, in `dependencies`)
  - Updated dependency [`@opentelemetry/otlp-exporter-base@^0.203.0` ↗︎](https://www.npmjs.com/package/@opentelemetry/otlp-exporter-base/v/0.203.0) (from `^0.201.1`, in `dependencies`)
  - Updated dependency [`@opentelemetry/otlp-transformer@^0.203.0` ↗︎](https://www.npmjs.com/package/@opentelemetry/otlp-transformer/v/0.203.0) (from `^0.201.1`, in `dependencies`)
  - Updated dependency [`@opentelemetry/sdk-node@^0.203.0` ↗︎](https://www.npmjs.com/package/@opentelemetry/sdk-node/v/0.203.0) (from `^0.201.1`, in `dependencies`)
  - Updated dependency [`@opentelemetry/semantic-conventions@^1.36.0` ↗︎](https://www.npmjs.com/package/@opentelemetry/semantic-conventions/v/1.36.0) (from `^1.34.0`, in `dependencies`)
- d30b1a0: Remove js-tiktoken as it's unused
- bff87f7: fix issue where v1 messages from db wouldn't properly show tool calls in llm context window from historry
- b4a8df0: Fixed an issue where memory instances were not being registered with Mastra and custom ID generators weren't being used

## 0.12.0

### Minor Changes

- 2ecf658: Added the option to provide a custom ID generator when creating an instance of Mastra. If the generator is not provided, a fallback of using UUID is used to generate IDs instead.

### Patch Changes

- 510e2c8: dependencies updates:
  - Updated dependency [`radash@^12.1.1` ↗︎](https://www.npmjs.com/package/radash/v/12.1.1) (from `^12.1.0`, in `dependencies`)
- 2f72fb2: dependencies updates:
  - Updated dependency [`xstate@^5.20.1` ↗︎](https://www.npmjs.com/package/xstate/v/5.20.1) (from `^5.19.4`, in `dependencies`)
- 27cc97a: dependencies updates:
  - Updated dependency [`hono@^4.8.9` ↗︎](https://www.npmjs.com/package/hono/v/4.8.9) (from `^4.8.4`, in `dependencies`)
- 3f89307: improve registerApiRoute validation
- 9eda7d4: Move createMockModel to test scope. This prevents test dependencies from leaking into production code.
- 9d49408: Fix conditional branch execution after nested workflow resume. Now conditional branches properly re-evaluate their conditions during resume, ensuring only the correct branches execute.
- 41daa63: Threads are no longer created until message generation is complete to avoid leaving orphaned empty threads in storage on failure
- ad0a58b: Enhancements for premade input processors
- 254a36b: Expose mastra instance on dynamic agent arguments
- 7a7754f: Fast follow scorers fixing input types, improve llm scorer reliability, fix ui to display scores that are 0
- fc92d80: fix: GenerateReturn type
- e0f73c6: Make input optional for scorer run
- 0b89602: Fix workflow feedback loop crashes by preventing resume data reuse

  Fixes an issue where workflows with loops (dountil/dowhile) containing suspended steps would incorrectly reuse resume data across iterations. This caused human-in-the-loop workflows to crash or skip suspend points after resuming.

  The fix ensures resume data is cleared after a step completes (non-suspended status), allowing subsequent loop iterations to properly suspend for new input.

  Fixes #6014

- 4d37822: Fix workflow input property preservation after resume from snapshot

  Ensure that when resuming a workflow from a snapshot, the input property is correctly set from the snapshot's context input rather than from resume data. This prevents the loss of original workflow input data during suspend/resume cycles.

- 23a6a7c: improve error message for missing memory ids
- cda801d: Added the ability to pass in metadata for UIMessage and MastraMessageV2 in client-js and agent.stream/generate
- a77c823: include PATCH method in default CORS configuration
- ff9c125: enhance thread retrieval with sorting options in libsql and pg
- 09bca64: Log warning when telemetry is enabled but not loaded
- b8efbb9: feat: add flexible deleteMessages method to memory API
  - Added `memory.deleteMessages(input)` method that accepts multiple input types:
    - Single message ID as string: `deleteMessages('msg-123')`
    - Array of message IDs: `deleteMessages(['msg-1', 'msg-2'])`
    - Message object with id property: `deleteMessages({ id: 'msg-123' })`
    - Array of message objects: `deleteMessages([{ id: 'msg-1' }, { id: 'msg-2' }])`
  - Implemented in all storage adapters (LibSQL, PostgreSQL, Upstash, InMemory)
  - Added REST API endpoint: `POST /api/memory/messages/delete`
  - Updated client SDK: `thread.deleteMessages()` accepts all input types
  - Updates thread timestamps when messages are deleted
  - Added comprehensive test coverage and documentation

- 71466e7: Adds traceId and resourceId to telemetry spans for agent invocations
- 0c99fbe: [Feature] Add ability to include input processors to Agent primitive in order to add guardrails to incoming messages.

## 0.12.0-alpha.5

## 0.12.0-alpha.4

### Patch Changes

- ad0a58b: Enhancements for premade input processors

## 0.12.0-alpha.3

## 0.12.0-alpha.2

### Patch Changes

- 27cc97a: dependencies updates:
  - Updated dependency [`hono@^4.8.9` ↗︎](https://www.npmjs.com/package/hono/v/4.8.9) (from `^4.8.4`, in `dependencies`)
- 41daa63: Threads are no longer created until message generation is complete to avoid leaving orphaned empty threads in storage on failure
- 254a36b: Expose mastra instance on dynamic agent arguments
- 0b89602: Fix workflow feedback loop crashes by preventing resume data reuse

  Fixes an issue where workflows with loops (dountil/dowhile) containing suspended steps would incorrectly reuse resume data across iterations. This caused human-in-the-loop workflows to crash or skip suspend points after resuming.

  The fix ensures resume data is cleared after a step completes (non-suspended status), allowing subsequent loop iterations to properly suspend for new input.

  Fixes #6014

- 4d37822: Fix workflow input property preservation after resume from snapshot

  Ensure that when resuming a workflow from a snapshot, the input property is correctly set from the snapshot's context input rather than from resume data. This prevents the loss of original workflow input data during suspend/resume cycles.

- ff9c125: enhance thread retrieval with sorting options in libsql and pg
- b8efbb9: feat: add flexible deleteMessages method to memory API
  - Added `memory.deleteMessages(input)` method that accepts multiple input types:
    - Single message ID as string: `deleteMessages('msg-123')`
    - Array of message IDs: `deleteMessages(['msg-1', 'msg-2'])`
    - Message object with id property: `deleteMessages({ id: 'msg-123' })`
    - Array of message objects: `deleteMessages([{ id: 'msg-1' }, { id: 'msg-2' }])`
  - Implemented in all storage adapters (LibSQL, PostgreSQL, Upstash, InMemory)
  - Added REST API endpoint: `POST /api/memory/messages/delete`
  - Updated client SDK: `thread.deleteMessages()` accepts all input types
  - Updates thread timestamps when messages are deleted
  - Added comprehensive test coverage and documentation

- 71466e7: Adds traceId and resourceId to telemetry spans for agent invocations
- 0c99fbe: [Feature] Add ability to include input processors to Agent primitive in order to add guardrails to incoming messages.

## 0.12.0-alpha.1

### Patch Changes

- e0f73c6: Make input optional for scorer run
- cda801d: Added the ability to pass in metadata for UIMessage and MastraMessageV2 in client-js and agent.stream/generate
- a77c823: include PATCH method in default CORS configuration

## 0.12.0-alpha.0

### Minor Changes

- 2ecf658: Added the option to provide a custom ID generator when creating an instance of Mastra. If the generator is not provided, a fallback of using UUID is used to generate IDs instead.

### Patch Changes

- 510e2c8: dependencies updates:
  - Updated dependency [`radash@^12.1.1` ↗︎](https://www.npmjs.com/package/radash/v/12.1.1) (from `^12.1.0`, in `dependencies`)
- 2f72fb2: dependencies updates:
  - Updated dependency [`xstate@^5.20.1` ↗︎](https://www.npmjs.com/package/xstate/v/5.20.1) (from `^5.19.4`, in `dependencies`)
- 3f89307: improve registerApiRoute validation
- 9eda7d4: Move createMockModel to test scope. This prevents test dependencies from leaking into production code.
- 9d49408: Fix conditional branch execution after nested workflow resume. Now conditional branches properly re-evaluate their conditions during resume, ensuring only the correct branches execute.
- 7a7754f: Fast follow scorers fixing input types, improve llm scorer reliability, fix ui to display scores that are 0
- fc92d80: fix: GenerateReturn type
- 23a6a7c: improve error message for missing memory ids
- 09bca64: Log warning when telemetry is enabled but not loaded

## 0.11.1

### Patch Changes

- f248d53: Adding `getMessagesPaginated` to the serve, deployer, and client-js
- 2affc57: Fix output type of network loop
- 66e13e3: Add methods to fetch workflow/agent by its true id
- edd9482: Fix "workflow run was not suspended" error when attempting to resume a workflow with consecutive nested workflows.
- 18344d7: Code and llm scorers
- 9d372c2: Fix streamVNext error handling
- 40c2525: Fix agent.generate error with experimental_output and clientTool
- e473f27: Implement off the shelf Scorers
- 032cb66: ClientJS
- 703ac71: scores schema
- a723d69: Pass workflowId through
- 7827943: Handle streaming large data
- 5889a31: Export storage domain types
- bf1e7e7: Configure agent memory using runtimeContext
- 65e3395: Add Scores playground-ui and add scorer hooks
- 4933192: Update Message List to ensure correct order of message parts
- d1c77a4: Scorer interface
- bea9dd1: Refactor Agent class to consolidate LLM generate and stream methods and improve type safety. This includes
  extracting common logic into prepareLLMOptions(), enhancing type definitions, and fixing test annotations.

  This changeset entry follows the established format in your project:
  - Targets the @mastra/core package with a patch version bump
  - Provides a concise description of the refactoring and type safety improvements
  - Mentions the key changes without being too verbose

- dcd4802: scores mastra server
- cbddd18: Remove erroneous reassignment of `Mastra.prototype.#vectors`
- 7ba91fa: Add scorer abstract methods for base storage

## 0.11.0-alpha.2

### Patch Changes

- f248d53: Adding `getMessagesPaginated` to the serve, deployer, and client-js
- 2affc57: Fix output type of network loop
- 66e13e3: Add methods to fetch workflow/agent by its true id
- edd9482: Fix "workflow run was not suspended" error when attempting to resume a workflow with consecutive nested workflows.
- 18344d7: Code and llm scorers
- 9d372c2: Fix streamVNext error handling
- 40c2525: Fix agent.generate error with experimental_output and clientTool
- e473f27: Implement off the shelf Scorers
- 032cb66: ClientJS
- 703ac71: scores schema
- a723d69: Pass workflowId through
- 5889a31: Export storage domain types
- 65e3395: Add Scores playground-ui and add scorer hooks
- 4933192: Update Message List to ensure correct order of message parts
- d1c77a4: Scorer interface
- bea9dd1: Refactor Agent class to consolidate LLM generate and stream methods and improve type safety. This includes
  extracting common logic into prepareLLMOptions(), enhancing type definitions, and fixing test annotations.

  This changeset entry follows the established format in your project:
  - Targets the @mastra/core package with a patch version bump
  - Provides a concise description of the refactoring and type safety improvements
  - Mentions the key changes without being too verbose

- dcd4802: scores mastra server
- 7ba91fa: Add scorer abstract methods for base storage

## 0.11.0-alpha.1

## 0.11.0-alpha.0

### Patch Changes

- 7827943: Handle streaming large data
- bf1e7e7: Configure agent memory using runtimeContext
- cbddd18: Remove erroneous reassignment of `Mastra.prototype.#vectors`

## 0.10.15

### Patch Changes

- 0b56518: Ensure removed runtimeContext values are not saved in snapshot
- db5cc15: Create thread if it does not exist yet in agent network stream, generate and loopStream
- 2ba5b76: Allow passing jsonSchema into workingMemory schema
- 5237998: Fix foreach output
- c3a30de: added new experimental vnext working memory
- 37c1acd: Format semantic recall messages grouped by dates and labeled by if they're from a different thread or not, to improve longmemeval scores
- 1aa60b1: Pipe runtimeContext to vNext network agent stream and generate steps, wire up runtimeContext for vNext Networks in cliet SDK & playground
- 89ec9d4: remove cohere-ai client dependency and just make a fetch call
- cf3a184: Add warning log when memory is not configured but threadId/resourceId are passed to agent
- d6bfd60: Simplify Message-List Merge Logic and Updates
- 626b0f4: [Cloud-126] Working Memory Playground - Added working memory to playground to allow users to view/edit working memory
- c22a91f: Fix nested workflow resume in loop workflow breaking
- f7403ab: Only change workflow status to success after all steps are successful
- 6c89d7f: Save runtimeContext in snapshot
- Updated dependencies [4da943f]
  - @mastra/schema-compat@0.10.5

## 0.10.15-alpha.1

### Patch Changes

- 0b56518: Ensure removed runtimeContext values are not saved in snapshot
- 2ba5b76: Allow passing jsonSchema into workingMemory schema
- c3a30de: added new experimental vnext working memory
- cf3a184: Add warning log when memory is not configured but threadId/resourceId are passed to agent
- d6bfd60: Simplify Message-List Merge Logic and Updates
- Updated dependencies [4da943f]
  - @mastra/schema-compat@0.10.5-alpha.0

## 0.10.15-alpha.0

### Patch Changes

- db5cc15: Create thread if it does not exist yet in agent network stream, generate and loopStream
- 5237998: Fix foreach output
- 37c1acd: Format semantic recall messages grouped by dates and labeled by if they're from a different thread or not, to improve longmemeval scores
- 1aa60b1: Pipe runtimeContext to vNext network agent stream and generate steps, wire up runtimeContext for vNext Networks in cliet SDK & playground
- 89ec9d4: remove cohere-ai client dependency and just make a fetch call
- 626b0f4: [Cloud-126] Working Memory Playground - Added working memory to playground to allow users to view/edit working memory
- c22a91f: Fix nested workflow resume in loop workflow breaking
- f7403ab: Only change workflow status to success after all steps are successful
- 6c89d7f: Save runtimeContext in snapshot

## 0.10.14

### Patch Changes

- Update @mastra/deployer

## 0.10.12

### Patch Changes

- b4a9811: Remove async-await of stream inside llm base class
- 4d5583d: [Cloud-195] added retrieved memory messages to agent traces

## 0.10.12-alpha.1

### Patch Changes

- 4d5583d: [Cloud-195] added retrieved memory messages to agent traces

## 0.10.12-alpha.0

### Patch Changes

- b4a9811: Remove async-await of stream inside llm base class

## 0.10.11

### Patch Changes

- 2873c7f: dependencies updates:
  - Updated dependency [`dotenv@^16.6.1` ↗︎](https://www.npmjs.com/package/dotenv/v/16.6.1) (from `^16.5.0`, in `dependencies`)
- 1c1c6a1: dependencies updates:
  - Updated dependency [`hono@^4.8.4` ↗︎](https://www.npmjs.com/package/hono/v/4.8.4) (from `^4.8.3`, in `dependencies`)
- f8ce2cc: Add stepId to workflow executeStep error log
- 8c846b6: Fixed a problem where per-resource working memory wasn't being queried properly
- c7bbf1e: Implement workflow retry delay
- 8722d53: Fix multi modal remaining steps
- 565cc0c: fix redirection when clicking on the playground breadcrumbs
- b790fd1: Ability to pass a function to .sleep()/.sleepUntil()
- 132027f: Check if workflow and step is suspended before resuming
- 0c85311: Fix Google models ZodNull tool schema handling
- d7ed04d: make workflow execute use createRunAsync
- cb16baf: Fix MCP tool output schema type and return value
- f36e4f1: Allow passing custom instructions to generateTitle to override default instructions.
- 7f6e403: [MASTRA-3765] Save Message parts - Add ability for user to save messages on step finish for stream and agent
- Updated dependencies [0c85311]
  - @mastra/schema-compat@0.10.4

## 0.10.11-alpha.4

## 0.10.11-alpha.3

### Patch Changes

- c7bbf1e: Implement workflow retry delay
- 8722d53: Fix multi modal remaining steps
- 132027f: Check if workflow and step is suspended before resuming
- 0c85311: Fix Google models ZodNull tool schema handling
- cb16baf: Fix MCP tool output schema type and return value
- Updated dependencies [0c85311]
  - @mastra/schema-compat@0.10.4-alpha.0

## 0.10.11-alpha.2

### Patch Changes

- 2873c7f: dependencies updates:
  - Updated dependency [`dotenv@^16.6.1` ↗︎](https://www.npmjs.com/package/dotenv/v/16.6.1) (from `^16.5.0`, in `dependencies`)
- 1c1c6a1: dependencies updates:
  - Updated dependency [`hono@^4.8.4` ↗︎](https://www.npmjs.com/package/hono/v/4.8.4) (from `^4.8.3`, in `dependencies`)
- 565cc0c: fix redirection when clicking on the playground breadcrumbs

## 0.10.11-alpha.1

### Patch Changes

- 7f6e403: [MASTRA-3765] Save Message parts - Add ability for user to save messages on step finish for stream and agent

## 0.10.11-alpha.0

### Patch Changes

- f8ce2cc: Add stepId to workflow executeStep error log
- 8c846b6: Fixed a problem where per-resource working memory wasn't being queried properly
- b790fd1: Ability to pass a function to .sleep()/.sleepUntil()
- d7ed04d: make workflow execute use createRunAsync
- f36e4f1: Allow passing custom instructions to generateTitle to override default instructions.

## 0.10.10

### Patch Changes

- 4d3fbdf: Return tool error message rather than throw when a tool error happens for agent and tool playground page.

## 0.10.10-alpha.1

## 0.10.10-alpha.0

### Patch Changes

- 4d3fbdf: Return tool error message rather than throw when a tool error happens for agent and tool playground page.

## 0.10.9

### Patch Changes

- 9dda1ac: dependencies updates:
  - Updated dependency [`hono@^4.8.3` ↗︎](https://www.npmjs.com/package/hono/v/4.8.3) (from `^4.7.11`, in `dependencies`)
- c984582: Improve error messages for invalid message content in MessageList
- 7e801dd: [MASTRA-4118] fixes issue with agent network loopStream where subsequent messages aren't present in playground on refresh
- a606c75: show right suspend schema for nested workflow on playground
- 7aa70a4: Use the right step id for nested workflow steps in watch-v2
- 764f86a: Introduces the runCount property in the execution parameters for the steps execute function
- 1760a1c: Use workflow stream in playground instead of watch
- 038e5ae: Add cancel workflow run
- 7dda16a: Agent Network: Prompting improvements for better decisions
- 5ebfcdd: Fix MessageList toUIMessage to filter out tool invocations with state="call" or "partial-call"
- b2d0c91: Made title generation a blocking operation to prevent issues where the process might close before the title is generated
- 4e809ad: Visualizations for .sleep()/.sleepUntil()/.waitForEvent()
- 57929df: [MASTRA-4143[ change message-list and agent network display
- b7852ed: [MASTRA-4139] make private functions protected in memory
- 6320a61: Allow passing model to generateTitle to override default model selection.

## 0.10.9-alpha.0

### Patch Changes

- 9dda1ac: dependencies updates:
  - Updated dependency [`hono@^4.8.3` ↗︎](https://www.npmjs.com/package/hono/v/4.8.3) (from `^4.7.11`, in `dependencies`)
- c984582: Improve error messages for invalid message content in MessageList
- 7e801dd: [MASTRA-4118] fixes issue with agent network loopStream where subsequent messages aren't present in playground on refresh
- a606c75: show right suspend schema for nested workflow on playground
- 7aa70a4: Use the right step id for nested workflow steps in watch-v2
- 764f86a: Introduces the runCount property in the execution parameters for the steps execute function
- 1760a1c: Use workflow stream in playground instead of watch
- 038e5ae: Add cancel workflow run
- 7dda16a: Agent Network: Prompting improvements for better decisions
- 5ebfcdd: Fix MessageList toUIMessage to filter out tool invocations with state="call" or "partial-call"
- b2d0c91: Made title generation a blocking operation to prevent issues where the process might close before the title is generated
- 4e809ad: Visualizations for .sleep()/.sleepUntil()/.waitForEvent()
- 57929df: [MASTRA-4143[ change message-list and agent network display
- b7852ed: [MASTRA-4139] make private functions protected in memory
- 6320a61: Allow passing model to generateTitle to override default model selection.

## 0.10.8

### Patch Changes

- b8f16b2: Fixes generateTitle overwriting working memory when both get used in the same LLM response cycle.
- 3e04487: Fix provider tools to check for output schema before attaching to tool
- a344ac7: Fix tool streaming in agent network
- dc4ca0a: Fixed a regression where intentionally serialized JSON message content was being parsed back into an object by MessageList

## 0.10.8-alpha.1

### Patch Changes

- b8f16b2: Fixes generateTitle overwriting working memory when both get used in the same LLM response cycle.
- 3e04487: Fix provider tools to check for output schema before attaching to tool
- dc4ca0a: Fixed a regression where intentionally serialized JSON message content was being parsed back into an object by MessageList

## 0.10.8-alpha.0

### Patch Changes

- a344ac7: Fix tool streaming in agent network

## 0.10.7

### Patch Changes

- 15e9d26: Added per-resource working memory for LibSQL, Upstash, and PG
- d1baedb: fix bad merge with mastra error
- d8f2d19: Add updateMessages API to storage classes (only support for PG and LibSQL for now) and to memory class. Additionally allow for metadata to be saved in the content field of a message.
- 4d21bf2: throw mastra errors for MCP
- 07d6d88: Bump MCP SDK version and add tool output schema support to MCPServer and MCPClient
- 9d52b17: Fix inngest workflows streaming and add step metadata
- 2097952: [MASTRA-4021] Fix PG getMessages and update messageLimit for all storage adapters
- 792c4c0: feat: pass runId to onFinish
- 5d74aab: Return isComplete of true in routing step when no resource is selected
- a8b194f: Fix double tool call for working memory
- 4fb0cc2: Type safe variable mapping
- d2a7a31: Fix memory message context for when LLM providers throw an error if the first message is a tool call.
- 502fe05: createRun() -> createRunAsync()
- 144eb0b: [MASTRA-3669] Metadata Filter Types
- 8ba1b51: Add custom routes by default to jsonapi
- 4efcfa0: Added bail() method and more ergonomic suspend function return value
- 0e17048: Throw mastra errors in storage packages
- Updated dependencies [98bbe5a]
- Updated dependencies [a853c43]
  - @mastra/schema-compat@0.10.3

## 0.10.7-alpha.5

### Patch Changes

- Updated dependencies [a853c43]
  - @mastra/schema-compat@0.10.3-alpha.1

## 0.10.7-alpha.4

### Patch Changes

- a8b194f: Fix double tool call for working memory

## 0.10.7-alpha.3

### Patch Changes

- 792c4c0: feat: pass runId to onFinish
- 502fe05: createRun() -> createRunAsync()
- 4efcfa0: Added bail() method and more ergonomic suspend function return value

## 0.10.7-alpha.2

### Patch Changes

- 15e9d26: Added per-resource working memory for LibSQL, Upstash, and PG
- 07d6d88: Bump MCP SDK version and add tool output schema support to MCPServer and MCPClient
- 5d74aab: Return isComplete of true in routing step when no resource is selected
- 144eb0b: [MASTRA-3669] Metadata Filter Types
- Updated dependencies [98bbe5a]
  - @mastra/schema-compat@0.10.3-alpha.0

## 0.10.7-alpha.1

### Patch Changes

- d1baedb: fix bad merge with mastra error
- 4d21bf2: throw mastra errors for MCP
- 2097952: [MASTRA-4021] Fix PG getMessages and update messageLimit for all storage adapters
- 4fb0cc2: Type safe variable mapping
- d2a7a31: Fix memory message context for when LLM providers throw an error if the first message is a tool call.
- 0e17048: Throw mastra errors in storage packages

## 0.10.7-alpha.0

### Patch Changes

- d8f2d19: Add updateMessages API to storage classes (only support for PG and LibSQL for now) and to memory class. Additionally allow for metadata to be saved in the content field of a message.
- 9d52b17: Fix inngest workflows streaming and add step metadata
- 8ba1b51: Add custom routes by default to jsonapi

## 0.10.6

### Patch Changes

- 63f6b7d: dependencies updates:
  - Updated dependency [`@opentelemetry/exporter-trace-otlp-grpc@^0.201.1` ↗︎](https://www.npmjs.com/package/@opentelemetry/exporter-trace-otlp-grpc/v/0.201.1) (from `^0.201.0`, in `dependencies`)
  - Updated dependency [`@opentelemetry/exporter-trace-otlp-http@^0.201.1` ↗︎](https://www.npmjs.com/package/@opentelemetry/exporter-trace-otlp-http/v/0.201.1) (from `^0.201.0`, in `dependencies`)
  - Updated dependency [`@opentelemetry/otlp-exporter-base@^0.201.1` ↗︎](https://www.npmjs.com/package/@opentelemetry/otlp-exporter-base/v/0.201.1) (from `^0.201.0`, in `dependencies`)
  - Updated dependency [`@opentelemetry/otlp-transformer@^0.201.1` ↗︎](https://www.npmjs.com/package/@opentelemetry/otlp-transformer/v/0.201.1) (from `^0.201.0`, in `dependencies`)
  - Updated dependency [`@opentelemetry/sdk-node@^0.201.1` ↗︎](https://www.npmjs.com/package/@opentelemetry/sdk-node/v/0.201.1) (from `^0.201.0`, in `dependencies`)
  - Updated dependency [`@opentelemetry/semantic-conventions@^1.34.0` ↗︎](https://www.npmjs.com/package/@opentelemetry/semantic-conventions/v/1.34.0) (from `^1.33.0`, in `dependencies`)
  - Updated dependency [`ai@^4.3.16` ↗︎](https://www.npmjs.com/package/ai/v/4.3.16) (from `^4.2.2`, in `dependencies`)
  - Updated dependency [`cohere-ai@^7.17.1` ↗︎](https://www.npmjs.com/package/cohere-ai/v/7.17.1) (from `^7.16.0`, in `dependencies`)
  - Updated dependency [`hono@^4.7.11` ↗︎](https://www.npmjs.com/package/hono/v/4.7.11) (from `^4.5.1`, in `dependencies`)
  - Updated dependency [`hono-openapi@^0.4.8` ↗︎](https://www.npmjs.com/package/hono-openapi/v/0.4.8) (from `^0.4.6`, in `dependencies`)
  - Updated dependency [`json-schema-to-zod@^2.6.1` ↗︎](https://www.npmjs.com/package/json-schema-to-zod/v/2.6.1) (from `^2.6.0`, in `dependencies`)
  - Updated dependency [`pino@^9.7.0` ↗︎](https://www.npmjs.com/package/pino/v/9.7.0) (from `^9.6.0`, in `dependencies`)
  - Updated dependency [`xstate@^5.19.4` ↗︎](https://www.npmjs.com/package/xstate/v/5.19.4) (from `^5.19.2`, in `dependencies`)
- 12a95fc: Allow passing thread metadata to agent.generate and agent.stream. This will update or create the thread with the metadata passed in. Also simplifies the arguments for those two functions into a new memory property.
- 4b0f8a6: Allow passing a string, ui message, core message, or mastra message to agent.genTitle and agent.generateTitleFromUserMessage to restore previously changed public behaviour
- 51264a5: Fix fetchMemory return type and value
- 8e6f677: Dynamic default llm options
- d70c420: fix(core, memory): fix fetchMemory regression
- ee9af57: Add api for polling run execution result and get run by id
- 36f1c36: MCP Client and Server streamable http fixes
- 2a16996: Working Memory Schema and Template
- 10d352e: fix: bug in `workflow.parallel` return types causing type errors on c…
- 9589624: Throw Mastra Errors when building and bundling mastra application
- 53d3c37: Get workflows from an agent if not found from Mastra instance #5083
- 751c894: pass resourceId
- 577ce3a: deno support - use globalThis
- 9260b3a: changeset

## 0.10.6-alpha.5

### Patch Changes

- 12a95fc: Allow passing thread metadata to agent.generate and agent.stream. This will update or create the thread with the metadata passed in. Also simplifies the arguments for those two functions into a new memory property.
- 51264a5: Fix fetchMemory return type and value
- 8e6f677: Dynamic default llm options

## 0.10.6-alpha.4

### Patch Changes

- 9589624: Throw Mastra Errors when building and bundling mastra application

## 0.10.6-alpha.3

### Patch Changes

- d70c420: fix(core, memory): fix fetchMemory regression
- 2a16996: Working Memory Schema and Template

## 0.10.6-alpha.2

### Patch Changes

- 4b0f8a6: Allow passing a string, ui message, core message, or mastra message to agent.genTitle and agent.generateTitleFromUserMessage to restore previously changed public behaviour

## 0.10.6-alpha.1

### Patch Changes

- ee9af57: Add api for polling run execution result and get run by id
- 751c894: pass resourceId
- 577ce3a: deno support - use globalThis
- 9260b3a: changeset

## 0.10.6-alpha.0

### Patch Changes

- 63f6b7d: dependencies updates:
  - Updated dependency [`@opentelemetry/exporter-trace-otlp-grpc@^0.201.1` ↗︎](https://www.npmjs.com/package/@opentelemetry/exporter-trace-otlp-grpc/v/0.201.1) (from `^0.201.0`, in `dependencies`)
  - Updated dependency [`@opentelemetry/exporter-trace-otlp-http@^0.201.1` ↗︎](https://www.npmjs.com/package/@opentelemetry/exporter-trace-otlp-http/v/0.201.1) (from `^0.201.0`, in `dependencies`)
  - Updated dependency [`@opentelemetry/otlp-exporter-base@^0.201.1` ↗︎](https://www.npmjs.com/package/@opentelemetry/otlp-exporter-base/v/0.201.1) (from `^0.201.0`, in `dependencies`)
  - Updated dependency [`@opentelemetry/otlp-transformer@^0.201.1` ↗︎](https://www.npmjs.com/package/@opentelemetry/otlp-transformer/v/0.201.1) (from `^0.201.0`, in `dependencies`)
  - Updated dependency [`@opentelemetry/sdk-node@^0.201.1` ↗︎](https://www.npmjs.com/package/@opentelemetry/sdk-node/v/0.201.1) (from `^0.201.0`, in `dependencies`)
  - Updated dependency [`@opentelemetry/semantic-conventions@^1.34.0` ↗︎](https://www.npmjs.com/package/@opentelemetry/semantic-conventions/v/1.34.0) (from `^1.33.0`, in `dependencies`)
  - Updated dependency [`ai@^4.3.16` ↗︎](https://www.npmjs.com/package/ai/v/4.3.16) (from `^4.2.2`, in `dependencies`)
  - Updated dependency [`cohere-ai@^7.17.1` ↗︎](https://www.npmjs.com/package/cohere-ai/v/7.17.1) (from `^7.16.0`, in `dependencies`)
  - Updated dependency [`hono@^4.7.11` ↗︎](https://www.npmjs.com/package/hono/v/4.7.11) (from `^4.5.1`, in `dependencies`)
  - Updated dependency [`hono-openapi@^0.4.8` ↗︎](https://www.npmjs.com/package/hono-openapi/v/0.4.8) (from `^0.4.6`, in `dependencies`)
  - Updated dependency [`json-schema-to-zod@^2.6.1` ↗︎](https://www.npmjs.com/package/json-schema-to-zod/v/2.6.1) (from `^2.6.0`, in `dependencies`)
  - Updated dependency [`pino@^9.7.0` ↗︎](https://www.npmjs.com/package/pino/v/9.7.0) (from `^9.6.0`, in `dependencies`)
  - Updated dependency [`xstate@^5.19.4` ↗︎](https://www.npmjs.com/package/xstate/v/5.19.4) (from `^5.19.2`, in `dependencies`)
- 36f1c36: MCP Client and Server streamable http fixes
- 10d352e: fix: bug in `workflow.parallel` return types causing type errors on c…
- 53d3c37: Get workflows from an agent if not found from Mastra instance #5083

## 0.10.5

### Patch Changes

- 13c97f9: Save run status, result and error in storage snapshot

## 0.10.4

### Patch Changes

- d1ed912: dependencies updates:
  - Updated dependency [`dotenv@^16.5.0` ↗︎](https://www.npmjs.com/package/dotenv/v/16.5.0) (from `^16.4.7`, in `dependencies`)
- f6fd25f: Updates @mastra/schema-compat to allow all zod schemas. Uses @mastra/schema-compat to apply schema transformations to agent output schema.
- dffb67b: updated stores to add alter table and change tests
- f1f1f1b: Add basic filtering capabilities to logs
- 925ab94: added paginated functions to base class and added boilerplate and updated imports
- f9816ae: Create @mastra/schema-compat package to extract the schema compatibility layer to be used outside of mastra
- 82090c1: Add pagination to logs
- 1b443fd: - add trackException to loggers to allow mastra cloud to track exceptions at runtime
  - Added generic MastraBaseError<D, C> in packages/core/src/error/index.ts to improve type safety and flexibility of error handling
- ce97900: Add paginated APIs to cloudflare-d1 storage class
- f1309d3: Now that UIMessages are stored, we added a check to make sure large text files or source urls are not sent to the LLM for thread title generation.
- 14a2566: Add pagination to libsql storage APIs
- f7f8293: Added LanceDB implementations for MastraVector and MastraStorage
- 48eddb9: update filter logic in Memory class to support semantic recall search scope
- Updated dependencies [f6fd25f]
- Updated dependencies [f9816ae]
  - @mastra/schema-compat@0.10.2

## 0.10.4-alpha.3

### Patch Changes

- 925ab94: added paginated functions to base class and added boilerplate and updated imports

## 0.10.4-alpha.2

### Patch Changes

- 48eddb9: update filter logic in Memory class to support semantic recall search scope

## 0.10.4-alpha.1

### Patch Changes

- f6fd25f: Updates @mastra/schema-compat to allow all zod schemas. Uses @mastra/schema-compat to apply schema transformations to agent output schema.
- dffb67b: updated stores to add alter table and change tests
- f1309d3: Now that UIMessages are stored, we added a check to make sure large text files or source urls are not sent to the LLM for thread title generation.
- f7f8293: Added LanceDB implementations for MastraVector and MastraStorage
- Updated dependencies [f6fd25f]
  - @mastra/schema-compat@0.10.2-alpha.3

## 0.10.4-alpha.0

### Patch Changes

- d1ed912: dependencies updates:
  - Updated dependency [`dotenv@^16.5.0` ↗︎](https://www.npmjs.com/package/dotenv/v/16.5.0) (from `^16.4.7`, in `dependencies`)
- f1f1f1b: Add basic filtering capabilities to logs
- f9816ae: Create @mastra/schema-compat package to extract the schema compatibility layer to be used outside of mastra
- 82090c1: Add pagination to logs
- 1b443fd: - add trackException to loggers to allow mastra cloud to track exceptions at runtime
  - Added generic MastraBaseError<D, C> in packages/core/src/error/index.ts to improve type safety and flexibility of error handling
- ce97900: Add paginated APIs to cloudflare-d1 storage class
- 14a2566: Add pagination to libsql storage APIs
- Updated dependencies [f9816ae]
  - @mastra/schema-compat@0.10.2-alpha.2

## 0.10.3

### Patch Changes

- 2b0fc7e: Ensure context messages aren't saved to the storage db

## 0.10.3-alpha.0

### Patch Changes

- 2b0fc7e: Ensure context messages aren't saved to the storage db

## 0.10.2

### Patch Changes

- ee77e78: Type fixes for dynamodb and MessageList
- 592a2db: Added different icons for agents and workflows in mcp tools list
- e5dc18d: Added a backwards compatible layer to begin storing/retrieving UIMessages in storage instead of CoreMessages
- ab5adbe: Add support for runtimeContext to generateTitle
- 1e8bb40: Add runtimeContext to tools and agents in a workflow step.

  Also updated start/resume docs for runtime context.

- 1b5fc55: Fixed an issue where the playground wouldn't display images saved in memory. Fixed memory to always store images as strings. Removed duplicate storage of reasoning and file/image parts in storage dbs
- 195c428: Add runId to step execute fn
- f73e11b: fix telemetry disabled not working on playground
- 37643b8: Fix tool access
- 99fd6cf: Fix workflow stream chunk type
- c5bf1ce: Add backwards compat code for new MessageList in storage
- add596e: Mastra protected auth
- 8dc94d8: Enhance workflow DI runtimeContext get method type safety
- ecebbeb: Mastra core auth abstract definition
- 79d5145: Fixes passing telemetry configuration when Agent.stream is used with experimental_output
- 12b7002: Add serializedStepGraph to workflow run snapshot in storage
- 2901125: feat: set mastra server middleware after Mastra has been initialized

## 0.10.2-alpha.8

### Patch Changes

- 37643b8: Fix tool access
- 79d5145: Fixes passing telemetry configuration when Agent.stream is used with experimental_output

## 0.10.2-alpha.7

## 0.10.2-alpha.6

### Patch Changes

- 99fd6cf: Fix workflow stream chunk type
- 8dc94d8: Enhance workflow DI runtimeContext get method type safety

## 0.10.2-alpha.5

### Patch Changes

- 1b5fc55: Fixed an issue where the playground wouldn't display images saved in memory. Fixed memory to always store images as strings. Removed duplicate storage of reasoning and file/image parts in storage dbs
- add596e: Mastra protected auth
- ecebbeb: Mastra core auth abstract definition

## 0.10.2-alpha.4

### Patch Changes

- c5bf1ce: Add backwards compat code for new MessageList in storage
- 12b7002: Add serializedStepGraph to workflow run snapshot in storage

## 0.10.2-alpha.3

### Patch Changes

- ab5adbe: Add support for runtimeContext to generateTitle
- 195c428: Add runId to step execute fn
- f73e11b: fix telemetry disabled not working on playground

## 0.10.2-alpha.2

### Patch Changes

- 1e8bb40: Add runtimeContext to tools and agents in a workflow step.

  Also updated start/resume docs for runtime context.

## 0.10.2-alpha.1

### Patch Changes

- ee77e78: Type fixes for dynamodb and MessageList
- 2901125: feat: set mastra server middleware after Mastra has been initialized

## 0.10.2-alpha.0

### Patch Changes

- 592a2db: Added different icons for agents and workflows in mcp tools list
- e5dc18d: Added a backwards compatible layer to begin storing/retrieving UIMessages in storage instead of CoreMessages

## 0.10.1

### Patch Changes

- d70b807: Improve storage.init
- 6d16390: Support custom bundle externals on mastra Instance
- 1e4a421: Fix duplication of items in array results in workflow
- 200d0da: Return payload data, start time, end time, resume time and suspend time for each step in workflow state
  Return error stack for failed workflow runs
- bf5f17b: Adds ability to pass workflows into MCPServer to generate tools from the workflows. Each workflow will become a tool that can start the workflow run.
- 5343f93: Move emitter to symbol to make private
- 38aee50: Adds ability to pass an agents into an MCPServer instance to automatically generate tools from them.
- 5c41100: Added binding support for cloudflare deployers, added cloudflare kv namespace changes, and removed randomUUID from buildExecutionGraph
- d6a759b: Update workflows code in core readme'
- 6015bdf: Leverage defaultAgentStreamOption, defaultAgentGenerateOption in playground

## 0.10.1-alpha.3

### Patch Changes

- d70b807: Improve storage.init

## 0.10.1-alpha.2

### Patch Changes

- 6015bdf: Leverage defaultAgentStreamOption, defaultAgentGenerateOption in playground

## 0.10.1-alpha.1

### Patch Changes

- 200d0da: Return payload data, start time, end time, resume time and suspend time for each step in workflow state
  Return error stack for failed workflow runs
- bf5f17b: Adds ability to pass workflows into MCPServer to generate tools from the workflows. Each workflow will become a tool that can start the workflow run.
- 5343f93: Move emitter to symbol to make private
- 38aee50: Adds ability to pass an agents into an MCPServer instance to automatically generate tools from them.
- 5c41100: Added binding support for cloudflare deployers, added cloudflare kv namespace changes, and removed randomUUID from buildExecutionGraph
- d6a759b: Update workflows code in core readme'

## 0.10.1-alpha.0

### Patch Changes

- 6d16390: Support custom bundle externals on mastra Instance
- 1e4a421: Fix duplication of items in array results in workflow

## 0.10.0

### Minor Changes

- 5eb5a99: Remove pino from @mastra/core into @mastra/loggers
- 7e632c5: Removed default LibSQLStore and LibSQLVector from @mastra/core. These now live in a separate package @mastra/libsql
- b2ae5aa: Added support for experimental authentication and authorization
- 0dcb9f0: Memory breaking changes: storage, vector, and embedder are now required. Working memory text streaming has been removed, only tool calling is supported for working memory updates now. Default settings have changed (lastMessages: 40->10, semanticRecall: true->false, threads.generateTitle: true->false)

### Patch Changes

- b3a3d63: BREAKING: Make vnext workflow the default worklow, and old workflow legacy_workflow
- 344f453: Await onFinish & onStepFinish to ensure the stream doesn't close early
- 0a3ae6d: Fixed a bug where tool input schema properties that were optional became required
- 95911be: Fixed an issue where if @mastra/core was not released at the same time as create-mastra, create-mastra would match the alpha tag instead of latest tag when running npm create mastra@latest
- f53a6ac: Add VNextWorkflowRuns type
- 1e9fbfa: Upgrade to OpenTelemetry JS SDK 2.x
- eabdcd9: [MASTRA-3451] SQL Injection Protection
- 90be034: Pass zod schema directly to getInitData
- 99f050a: Bumped a workspace package zod version to attempt to prevent duplicate dep installs of @mastra/core
- d0ee3c6: Change all public functions and constructors in vector stores to use named args and prepare to phase out positional args
- 23f258c: Add new list and get routes for mcp servers. Changed route make-up for more consistency with existing API routes. Lastly, added in a lot of extra detail that can be optionally passed to the mcp server per the mcp spec.
- a7292b0: BREAKING(@mastra/core, all vector stores): Vector store breaking changes (remove deprecated functions and positional arguments)
- 2672a05: Add MCP servers and tool call execution to playground

## 0.10.0-alpha.1

### Minor Changes

- 5eb5a99: Remove pino from @mastra/core into @mastra/loggers
- 7e632c5: Removed default LibSQLStore and LibSQLVector from @mastra/core. These now live in a separate package @mastra/libsql
- b2ae5aa: Added support for experimental authentication and authorization
- 0dcb9f0: Memory breaking changes: storage, vector, and embedder are now required. Working memory text streaming has been removed, only tool calling is supported for working memory updates now. Default settings have changed (lastMessages: 40->10, semanticRecall: true->false, threads.generateTitle: true->false)

### Patch Changes

- b3a3d63: BREAKING: Make vnext workflow the default worklow, and old workflow legacy_workflow
- 344f453: Await onFinish & onStepFinish to ensure the stream doesn't close early
- 0a3ae6d: Fixed a bug where tool input schema properties that were optional became required
- 95911be: Fixed an issue where if @mastra/core was not released at the same time as create-mastra, create-mastra would match the alpha tag instead of latest tag when running npm create mastra@latest
- 1e9fbfa: Upgrade to OpenTelemetry JS SDK 2.x
- a7292b0: BREAKING(@mastra/core, all vector stores): Vector store breaking changes (remove deprecated functions and positional arguments)

## 0.9.5-alpha.0

### Patch Changes

- f53a6ac: Add VNextWorkflowRuns type
- eabdcd9: [MASTRA-3451] SQL Injection Protection
- 90be034: Pass zod schema directly to getInitData
- 99f050a: Bumped a workspace package zod version to attempt to prevent duplicate dep installs of @mastra/core
- d0ee3c6: Change all public functions and constructors in vector stores to use named args and prepare to phase out positional args
- 23f258c: Add new list and get routes for mcp servers. Changed route make-up for more consistency with existing API routes. Lastly, added in a lot of extra detail that can be optionally passed to the mcp server per the mcp spec.
- 2672a05: Add MCP servers and tool call execution to playground

## 0.9.4

### Patch Changes

- 396be50: updated mcp server routes for MCP SSE for use with hono server
- ab80e7e: Fix resume workflow throwing workflow run not found error
- c3bd795: [MASTRA-3358] Deprecate updateIndexById and deleteIndexById
- da082f8: Switch from serializing json schema string as a function to a library that creates a zod object in memory from the json schema. This reduces the errors we were seeing from zod schema code that could not be serialized.
- a5810ce: Add support for experimental_generateMessageId and remove it from client-js types since it's not serializable
- 3e9c131: Typo resoolve.
- 3171b5b: Fix jsonSchema on vercel tools
- 973e5ac: Add workflows to agents properly
- daf942f: [MASTRA-3367] updated createthread when using generatetitle to perserve thread metadata
- 0b8b868: Added A2A support + streaming
- 9e1eff5: Fix tool compatibility schema handling by ensuring zodSchema.shape is safely accessed, preventing potential runtime errors.
- 6fa1ad1: Fixes and issue when a tool provides no inputSchema and when a tool uses a non-zod schema.
- c28d7a0: Fix watch workflow not streaming response back in legacy workflow
- edf1e88: allows ability to pass McpServer into the mastra class and creates an endpoint /api/servers/:serverId/mcp to POST messages to an MCP server

## 0.9.4-alpha.4

### Patch Changes

- 3e9c131: Typo resoolve.

## 0.9.4-alpha.3

### Patch Changes

- 396be50: updated mcp server routes for MCP SSE for use with hono server
- c3bd795: [MASTRA-3358] Deprecate updateIndexById and deleteIndexById
- da082f8: Switch from serializing json schema string as a function to a library that creates a zod object in memory from the json schema. This reduces the errors we were seeing from zod schema code that could not be serialized.
- a5810ce: Add support for experimental_generateMessageId and remove it from client-js types since it's not serializable

## 0.9.4-alpha.2

### Patch Changes

- 3171b5b: Fix jsonSchema on vercel tools
- 973e5ac: Add workflows to agents properly
- 9e1eff5: Fix tool compatibility schema handling by ensuring zodSchema.shape is safely accessed, preventing potential runtime errors.

## 0.9.4-alpha.1

### Patch Changes

- ab80e7e: Fix resume workflow throwing workflow run not found error
- 6fa1ad1: Fixes and issue when a tool provides no inputSchema and when a tool uses a non-zod schema.
- c28d7a0: Fix watch workflow not streaming response back in legacy workflow
- edf1e88: allows ability to pass McpServer into the mastra class and creates an endpoint /api/servers/:serverId/mcp to POST messages to an MCP server

## 0.9.4-alpha.0

### Patch Changes

- daf942f: [MASTRA-3367] updated createthread when using generatetitle to perserve thread metadata
- 0b8b868: Added A2A support + streaming

## 0.9.3

### Patch Changes

- e450778: vnext: Inngest playground fixes
- 8902157: added an optional `bodySizeLimit` to server config so that users can pass custom bodylimit size in mb. If not, it defaults to 4.5 mb
- ca0dc88: fix: filter out excessive logs when getting LLM for agents
- 526c570: expose agent runtimeContext from clientSDK
- d7a6a33: Allow more user messages to be saved to memory, and fix message saving when using output flag
- 9cd1a46: [MASTRA-3338] update naming scheme for embedding index based on vector store rules and added duplicate index checks
- b5d2de0: In vNext workflow serializedStepGraph, return only serializedStepFlow for steps created from a workflow
  allow viewing inner nested workflows in a multi-layered nested vnext workflow on the playground
- 644f8ad: Adds a tool compatibility layer to ensure models from various providers work the same way. Models may not be able to support all json schema properties (such as some openai reasoning models), as well as other models support the property but seem to ignore it. The feature allows for a compatibility class for a provider that can be customized to fit the models and make sure they're using the tool schemas properly.
- 70dbf51: [MASTRA-2452] updated setBaggage for tracing

## 0.9.3-alpha.1

### Patch Changes

- e450778: vnext: Inngest playground fixes
- 8902157: added an optional `bodySizeLimit` to server config so that users can pass custom bodylimit size in mb. If not, it defaults to 4.5 mb
- ca0dc88: fix: filter out excessive logs when getting LLM for agents
- 9cd1a46: [MASTRA-3338] update naming scheme for embedding index based on vector store rules and added duplicate index checks
- 70dbf51: [MASTRA-2452] updated setBaggage for tracing

## 0.9.3-alpha.0

### Patch Changes

- 526c570: expose agent runtimeContext from clientSDK
- b5d2de0: In vNext workflow serializedStepGraph, return only serializedStepFlow for steps created from a workflow
  allow viewing inner nested workflows in a multi-layered nested vnext workflow on the playground
- 644f8ad: Adds a tool compatibility layer to ensure models from various providers work the same way. Models may not be able to support all json schema properties (such as some openai reasoning models), as well as other models support the property but seem to ignore it. The feature allows for a compatibility class for a provider that can be customized to fit the models and make sure they're using the tool schemas properly.

## 0.9.2

### Patch Changes

- 6052aa6: Add getWorkflowRunById to vNext workflow core and server handler
- 967b41c: fix: removes new agent getter methods from telemetry
- 3d2fb5c: Fix commonjs import for vnext workflows
- 26738f4: Switched from a custom MCP tools schema deserializer to json-schema-to-zod - fixes an issue where MCP tool schemas didn't deserialize properly in Mastra playground. Also added support for testing tools with no input arguments in playground
- 4155f47: Add parameters to filter workflow runs
  Add fromDate and toDate to telemetry parameters
- 7eeb2bc: Add Memory default storage breaking change warning
- b804723: Fix #3831: keep conversations in tact by keeping empty assistant messages
- 8607972: Introduce Mastra lint cli command
- ccef9f9: Fixed a type error when converting tools
- 0097d50: Add serializedStepGraph to vNext workflow
  Return serializedStepGraph from vNext workflow
  Use serializedStepGraph in vNext workflow graph
- 7eeb2bc: Added explicit storage to memory in create-mastra so new projects don't see breaking change warnings
- 17826a9: Added a breaking change warning about deprecated working memory "use: 'text-stream'" which is being fully replaced by "use: 'tool-call'"
- 7d8b7c7: In vnext getworkflowRunById, pick run from this.#runs if it does not exist in storage
- fba031f: Show traces for vNext workflow
- 3a5f1e1: Created a new @mastra/fastembed package based on the default embedder in @mastra/core as the default embedder will be removed in a breaking change (May 20th)
  Added a warning to use the new @mastra/fastembed package instead of the default embedder
- 51e6923: fix ts errors on default proxy storage
- 8398d89: vNext: dynamic input mappings

## 0.9.2-alpha.6

### Patch Changes

- 6052aa6: Add getWorkflowRunById to vNext workflow core and server handler
- 7d8b7c7: In vnext getworkflowRunById, pick run from this.#runs if it does not exist in storage
- 3a5f1e1: Created a new @mastra/fastembed package based on the default embedder in @mastra/core as the default embedder will be removed in a breaking change (May 20th)
  Added a warning to use the new @mastra/fastembed package instead of the default embedder
- 8398d89: vNext: dynamic input mappings

## 0.9.2-alpha.5

### Patch Changes

- 3d2fb5c: Fix commonjs import for vnext workflows
- 7eeb2bc: Add Memory default storage breaking change warning
- 8607972: Introduce Mastra lint cli command
- 7eeb2bc: Added explicit storage to memory in create-mastra so new projects don't see breaking change warnings
- fba031f: Show traces for vNext workflow

## 0.9.2-alpha.4

### Patch Changes

- ccef9f9: Fixed a type error when converting tools
- 51e6923: fix ts errors on default proxy storage

## 0.9.2-alpha.3

### Patch Changes

- 967b41c: fix: removes new agent getter methods from telemetry
- 4155f47: Add parameters to filter workflow runs
  Add fromDate and toDate to telemetry parameters
- 17826a9: Added a breaking change warning about deprecated working memory "use: 'text-stream'" which is being fully replaced by "use: 'tool-call'"

## 0.9.2-alpha.2

### Patch Changes

- 26738f4: Switched from a custom MCP tools schema deserializer to json-schema-to-zod - fixes an issue where MCP tool schemas didn't deserialize properly in Mastra playground. Also added support for testing tools with no input arguments in playground

## 0.9.2-alpha.1

### Patch Changes

- b804723: Fix #3831: keep conversations in tact by keeping empty assistant messages

## 0.9.2-alpha.0

### Patch Changes

- 0097d50: Add serializedStepGraph to vNext workflow
  Return serializedStepGraph from vNext workflow
  Use serializedStepGraph in vNext workflow graph

## 0.9.1

### Patch Changes

- 405b63d: add ability to clone workflows with different id
- 81fb7f6: Workflows v2
- 20275d4: Adding warnings for current implicit Memory default options as they will be changing soon in a breaking change. Also added memory to create-mastra w/ new defaults so new projects don't see these warnings
- 7d1892c: Return error object directly in vNext workflows
- a90a082: Rename container to runtimeContext in vNext workflow
  Add steps accessor for stepFlow in vnext workflow
  Add getWorkflowRun to vnext workflow
  Add vnext_getWorkflows() to mastra core
- 2d17c73: Fix checking for presence of constant value mappings
- 61e92f5: vNext fix workflow watch cleanup
- 35955b0: Rename import to runtime-contxt
- 6262bd5: Mastra server custom host config
- c1409ef: Add vNextWorkflow handlers and APIs
  Add stepGraph and steps to vNextWorkflow
- 3e7b69d: Dynamic agent props
- e4943b8: Default arrays to string type when transformation JSON schema to zod as per the JSON schema spec.
- 11d4485: Show VNext workflows on the playground
  Show running status for step in vNext workflowState
- 479f490: [MASTRA-3131] Add getWorkflowRunByID and add resourceId as filter for getWorkflowRuns
- c23a81c: added deprecation warnings for pg and individual args
- 2d4001d: Add new @msstra/libsql package and use it in create-mastra
- c71013a: vNeuxt: unset currentStep for workflow status change event
- 1d3b1cd: Rebump

## 0.9.1-alpha.8

### Patch Changes

- 2d17c73: Fix checking for presence of constant value mappings

## 0.9.1-alpha.7

### Patch Changes

- 1d3b1cd: Rebump

## 0.9.1-alpha.6

### Patch Changes

- c23a81c: added deprecation warnings for pg and individual args

## 0.9.1-alpha.5

### Patch Changes

- 3e7b69d: Dynamic agent props

## 0.9.1-alpha.4

### Patch Changes

- e4943b8: Default arrays to string type when transformation JSON schema to zod as per the JSON schema spec.
- 479f490: [MASTRA-3131] Add getWorkflowRunByID and add resourceId as filter for getWorkflowRuns

## 0.9.1-alpha.3

### Patch Changes

- 6262bd5: Mastra server custom host config

## 0.9.1-alpha.2

### Patch Changes

- 405b63d: add ability to clone workflows with different id
- 61e92f5: vNext fix workflow watch cleanup
- c71013a: vNeuxt: unset currentStep for workflow status change event

## 0.9.1-alpha.1

### Patch Changes

- 20275d4: Adding warnings for current implicit Memory default options as they will be changing soon in a breaking change. Also added memory to create-mastra w/ new defaults so new projects don't see these warnings
- 7d1892c: Return error object directly in vNext workflows
- a90a082: Rename container to runtimeContext in vNext workflow
  Add steps accessor for stepFlow in vnext workflow
  Add getWorkflowRun to vnext workflow
  Add vnext_getWorkflows() to mastra core
- 35955b0: Rename import to runtime-contxt
- c1409ef: Add vNextWorkflow handlers and APIs
  Add stepGraph and steps to vNextWorkflow
- 11d4485: Show VNext workflows on the playground
  Show running status for step in vNext workflowState
- 2d4001d: Add new @msstra/libsql package and use it in create-mastra

## 0.9.1-alpha.0

### Patch Changes

- 81fb7f6: Workflows v2

## 0.9.0

### Minor Changes

- fe3ae4d: Remove \_\_ functions in storage and move to storage proxy to make sure init is called

### Patch Changes

- 000a6d4: Fixed an issue where the TokenLimiter message processor was adding new messages into the remembered messages array
- 08bb78e: Added an extra safety for Memory message ordering
- ed2f549: Fix exlude methods for batchTraceInsert
- 7e92011: Include tools with deployment builds
- 9ee4293: Improve commonjs support

  Add types files in the root directory to make sure typescript can resolve it without an exportsmap

- 03f3cd0: Propagate context to passed in tools
- c0f22b4: [MASTRA-3130] Metadata Filter Update for PG and Libsql
- 71d9444: updated savemessage to not use mutation when hiding working memory
- 157c741: Fix message dupes using processors
- 8a8a73b: fix container to network sub agent
- 0a033fa: Adds MCPServer component
- 9c26508: Fixed an issue where "mastra dev" wouldn't always print out localhost:4111 logs due to new NODE_ENV fixes
- 0f4eae3: Rename Container into RuntimeContext
- 16a8648: Disable swaggerUI, playground for production builds, mastra instance server build config to enable swaggerUI, apiReqLogs, openAPI documentation for prod builds
- 6f92295: Fixed an issue where some user messages and llm messages would have the exact same createdAt date, leading to incorrect message ordering. Added a fix for new messages as well as any that were saved before the fix in the wrong order

## 0.9.0-alpha.8

### Patch Changes

- 000a6d4: Fixed an issue where the TokenLimiter message processor was adding new messages into the remembered messages array
- ed2f549: Fix exlude methods for batchTraceInsert
- c0f22b4: [MASTRA-3130] Metadata Filter Update for PG and Libsql
- 0a033fa: Adds MCPServer component
- 9c26508: Fixed an issue where "mastra dev" wouldn't always print out localhost:4111 logs due to new NODE_ENV fixes
- 0f4eae3: Rename Container into RuntimeContext
- 16a8648: Disable swaggerUI, playground for production builds, mastra instance server build config to enable swaggerUI, apiReqLogs, openAPI documentation for prod builds

## 0.9.0-alpha.7

### Patch Changes

- 71d9444: updated savemessage to not use mutation when hiding working memory

## 0.9.0-alpha.6

### Patch Changes

- 157c741: Fix message dupes using processors

## 0.9.0-alpha.5

### Patch Changes

- 08bb78e: Added an extra safety for Memory message ordering

## 0.9.0-alpha.4

### Patch Changes

- 7e92011: Include tools with deployment builds

## 0.9.0-alpha.3

### Minor Changes

- fe3ae4d: Remove \_\_ functions in storage and move to storage proxy to make sure init is called

## 0.8.4-alpha.2

### Patch Changes

- 9ee4293: Improve commonjs support

  Add types files in the root directory to make sure typescript can resolve it without an exportsmap

## 0.8.4-alpha.1

### Patch Changes

- 8a8a73b: fix container to network sub agent
- 6f92295: Fixed an issue where some user messages and llm messages would have the exact same createdAt date, leading to incorrect message ordering. Added a fix for new messages as well as any that were saved before the fix in the wrong order

## 0.8.4-alpha.0

### Patch Changes

- 03f3cd0: Propagate context to passed in tools

## 0.8.3

### Patch Changes

- d72318f: Refactored the evals table to use the DS tables
- 0bcc862: Fixed an issue where we were sanitizing response message content and filter on a value that may not always be an array
- 10a8caf: Removed an extra console log that made it into core
- 359b089: Allowed explicitly disabling vector/embedder in Memory by passing vector: false or options.semanticRecall: false
- 32e7b71: Add support for dependency injection
- 37bb612: Add Elastic-2.0 licensing for packages
- 7f1b291: Client Side tool call passing

## 0.8.3-alpha.5

### Patch Changes

- d72318f: Refactored the evals table to use the DS tables

## 0.8.3-alpha.4

### Patch Changes

- 7f1b291: Client Side tool call passing

## 0.8.3-alpha.3

### Patch Changes

- 10a8caf: Removed an extra console log that made it into core

## 0.8.3-alpha.2

### Patch Changes

- 0bcc862: Fixed an issue where we were sanitizing response message content and filter on a value that may not always be an array

## 0.8.3-alpha.1

### Patch Changes

- 32e7b71: Add support for dependency injection
- 37bb612: Add Elastic-2.0 licensing for packages

## 0.8.3-alpha.0

### Patch Changes

- 359b089: Allowed explicitly disabling vector/embedder in Memory by passing vector: false or options.semanticRecall: false

## 0.8.2

### Patch Changes

- a06aadc: Upgrade fastembed to fix bug where fastembe cannot be imported

## 0.8.2-alpha.0

### Patch Changes

- a06aadc: Upgrade fastembed to fix bug where fastembe cannot be imported

## 0.8.1

### Patch Changes

- 99e2998: Set default max steps to 5
- 8fdb414: Custom mastra server cors config

## 0.8.1-alpha.0

### Patch Changes

- 99e2998: Set default max steps to 5
- 8fdb414: Custom mastra server cors config

## 0.8.0

### Minor Changes

- 619c39d: Added support for agents as steps

### Patch Changes

- 56c31b7: Batch insert messages for libsql adapter
- 5ae0180: Removed prefixed doc references
- fe56be0: exclude \_\_primitive, getMemory, hasOwnMemory from traces since they create noisy traces
- 93875ed: Improved the performance of Memory semantic recall by 2 to 3 times when using pg by making tweaks to @mastra/memory @mastra/core and @mastra/pg
- 107bcfe: Fixed JSON parsing in memory component to prevent crashes when encountering strings that start with '[' or '{' but are not valid JSON
- 9bfa12b: Accept ID on step config
- 515ebfb: Fix compound subscriber bug
- 5b4e19f: fix hanging and excessive workflow execution
- dbbbf80: Added clickhouse storage
- a0967a0: Added new "Memory Processor" feature to @mastra/core and @mastra/memory, allowing devs to modify Mastra Memory before it's sent to the LLM
- fca3b21: fix server in mastra not to be mandatory
- 88fa727: Added getWorkflowRuns for libsql, pg, clickhouse and upstash as well as added route getWorkflowRunsHandler
- f37f535: Added variables to while and until loops
- a3f0e90: Update storage initialization to ensure tables are present
- 4d67826: Fix eval writes, remove id column
- 6330967: Enable route timeout using server options
- 8393832: Handle nested workflow view on workflow graph
- 6330967: Add support for configuration of server port using Mastra instance
- 99d43b9: Updated evaluate to include agent output
- d7e08e8: createdAt needs to be nullable
- febc8a6: Added dual tracing and fixed local tracing recursion
- 7599d77: fix(deps): update ai sdk to ^4.2.2
- 0118361: Add resourceId to memory metadata
- 619c39d: AgentStep -> Agent as a workflow step (WIP)
- cafae83: Changed error messages for vector mismatch with index
- 8076ecf: Unify workflow watch/start response
- 8df4a77: Fix if-else execution order
- 304397c: Add support for custom api routes in mastra

## 0.8.0-alpha.8

### Patch Changes

- 8df4a77: Fix if-else execution order

## 0.8.0-alpha.7

### Patch Changes

- febc8a6: Added dual tracing and fixed local tracing recursion

## 0.8.0-alpha.6

### Patch Changes

- a3f0e90: Update storage initialization to ensure tables are present

## 0.8.0-alpha.5

### Patch Changes

- 93875ed: Improved the performance of Memory semantic recall by 2 to 3 times when using pg by making tweaks to @mastra/memory @mastra/core and @mastra/pg

## 0.8.0-alpha.4

### Patch Changes

- d7e08e8: createdAt needs to be nullable

## 0.8.0-alpha.3

### Patch Changes

- 5ae0180: Removed prefixed doc references
- 9bfa12b: Accept ID on step config
- 515ebfb: Fix compound subscriber bug
- 88fa727: Added getWorkflowRuns for libsql, pg, clickhouse and upstash as well as added route getWorkflowRunsHandler
- f37f535: Added variables to while and until loops
- 4d67826: Fix eval writes, remove id column
- 6330967: Enable route timeout using server options
- 8393832: Handle nested workflow view on workflow graph
- 6330967: Add support for configuration of server port using Mastra instance

## 0.8.0-alpha.2

### Patch Changes

- 56c31b7: Batch insert messages for libsql adapter
- dbbbf80: Added clickhouse storage
- 99d43b9: Updated evaluate to include agent output

## 0.8.0-alpha.1

### Minor Changes

- 619c39d: Added support for agents as steps

### Patch Changes

- fe56be0: exclude \_\_primitive, getMemory, hasOwnMemory from traces since they create noisy traces
- a0967a0: Added new "Memory Processor" feature to @mastra/core and @mastra/memory, allowing devs to modify Mastra Memory before it's sent to the LLM
- fca3b21: fix server in mastra not to be mandatory
- 0118361: Add resourceId to memory metadata
- 619c39d: AgentStep -> Agent as a workflow step (WIP)

## 0.7.1-alpha.0

### Patch Changes

- 107bcfe: Fixed JSON parsing in memory component to prevent crashes when encountering strings that start with '[' or '{' but are not valid JSON
- 5b4e19f: fix hanging and excessive workflow execution
- 7599d77: fix(deps): update ai sdk to ^4.2.2
- cafae83: Changed error messages for vector mismatch with index
- 8076ecf: Unify workflow watch/start response
- 304397c: Add support for custom api routes in mastra

## 0.7.0

### Minor Changes

- 1af25d5: Added nested workflows API

### Patch Changes

- b4fbc59: Fixed an issue where sending CoreMessages to AI SDK would result in "Unsupported role: tool" errors
- a838fde: Update memory.ts
- a8bd4cf: Fixed JSON Schema generation for null types to prevent duplicate null entries in type arrays
- 7a3eeb0: Fixed a memory issue when using useChat where new messages were formatted as ui messages, were mixed with stored core messages in memory, and a mixed list was sent to AI SDK, causing it to error
- 0b54522: AgentNetwork logs
- b3b34f5: Fix agent generate,stream returnType with experimental_output
- a4686e8: Realtime event queue
- 6530ad1: Correct agent onFinish interface
- 27439ad: Updated the jsonSchemaPropertiesToTSTypes function to properly handle JSON Schema definitions where type can be an array of strings. Previously, the function only handled single string types, but according to the JSON Schema specification, type can be an array of possible types.

## 0.7.0-alpha.3

### Patch Changes

- b3b34f5: Fix agent generate,stream returnType with experimental_output
- a4686e8: Realtime event queue

## 0.7.0-alpha.2

### Patch Changes

- a838fde: Update memory.ts
- a8bd4cf: Fixed JSON Schema generation for null types to prevent duplicate null entries in type arrays
- 7a3eeb0: Fixed a memory issue when using useChat where new messages were formatted as ui messages, were mixed with stored core messages in memory, and a mixed list was sent to AI SDK, causing it to error
- 6530ad1: Correct agent onFinish interface

## 0.7.0-alpha.1

### Minor Changes

- 1af25d5: Added nested workflows API

### Patch Changes

- 0b54522: AgentNetwork logs
- 27439ad: Updated the jsonSchemaPropertiesToTSTypes function to properly handle JSON Schema definitions where type can be an array of strings. Previously, the function only handled single string types, but according to the JSON Schema specification, type can be an array of possible types.

## 0.6.5-alpha.0

### Patch Changes

- b4fbc59: Fixed an issue where sending CoreMessages to AI SDK would result in "Unsupported role: tool" errors

## 0.6.4

### Patch Changes

- 6794797: Check for eval values before inserting into storage
- fb68a80: Inject mastra instance into llm class
- b56a681: Update README and some tests for vector stores
- 248cb07: Allow ai-sdk Message type for messages in agent generate and stream
  Fix sidebar horizontal overflow in playground

## 0.6.4-alpha.1

### Patch Changes

- 6794797: Check for eval values before inserting into storage

## 0.6.4-alpha.0

### Patch Changes

- fb68a80: Inject mastra instance into llm class
- b56a681: Update README and some tests for vector stores
- 248cb07: Allow ai-sdk Message type for messages in agent generate and stream
  Fix sidebar horizontal overflow in playground

## 0.6.3

### Patch Changes

- 404640e: AgentNetwork changeset
- 3bce733: fix: agent.generate only get thread if there is threadID

## 0.6.3-alpha.1

### Patch Changes

- 3bce733: fix: agent.generate only get thread if there is threadID

## 0.6.3-alpha.0

### Patch Changes

- 404640e: AgentNetwork changeset

## 0.6.2

### Patch Changes

- beaf1c2: createTool type fixes
- 3084e13: More parallel memory operations

## 0.6.2-alpha.0

### Patch Changes

- beaf1c2: createTool type fixes
- 3084e13: More parallel memory operations

## 0.6.1

### Patch Changes

- fc2f89c: Insert static payload into inputData
- dfbb131: Fix after method on multiple passes
- f4854ee: Fix else branch execution when if-branch has loops
- afaf73f: Add fix for vercel tools and optional instructions
- 0850b4c: Watch and resume per run
- 7bcfaee: Remove node_modules-path dir which calls \_\_dirname at the top level and breaks some esm runtimes
- 44631b1: Fix after usage with skipped conditions on the awaited steps
- 9116d70: Handle the different workflow methods in workflow graph
- 6e559a0: Update Voice for realtime providers
- 5f43505: feat: OpenAI realtime voice provider for speech to speech communication
  Update voice speaking event type

## 0.6.1-alpha.2

### Patch Changes

- fc2f89c: Insert static payload into inputData
- dfbb131: Fix after method on multiple passes
- 0850b4c: Watch and resume per run
- 9116d70: Handle the different workflow methods in workflow graph

## 0.6.1-alpha.1

### Patch Changes

- f4854ee: Fix else branch execution when if-branch has loops
- afaf73f: Add fix for vercel tools and optional instructions
- 44631b1: Fix after usage with skipped conditions on the awaited steps
- 6e559a0: Update Voice for realtime providers
- 5f43505: feat: OpenAI realtime voice provider for speech to speech communication
  Update voice speaking event type

## 0.6.1-alpha.0

### Patch Changes

- 7bcfaee: Remove node_modules-path dir which calls \_\_dirname at the top level and breaks some esm runtimes

## 0.6.0

### Minor Changes

- 1c8cda4: Experimental .afterEvent() support. Fixed suspend/resume in first workflow or .after() branch step. Changed suspend metadata to be in context.resumeData instead of resumed step output.
- 95b4144: Added server middleware to apply custom functionality in API endpoints like auth

### Patch Changes

- 16b98d9: Reduce default step retry attempts
- 3729dbd: Fixed a bug where useChat with client side tool calling and Memory would not work. Added docs for using Memory with useChat()
- c2144f4: Enable dynamic import of default-storage to reduce runtime/bundle size when not using default storage

## 0.6.0-alpha.1

### Minor Changes

- 1c8cda4: Experimental .afterEvent() support. Fixed suspend/resume in first workflow or .after() branch step. Changed suspend metadata to be in context.resumeData instead of resumed step output.
- 95b4144: Added server middleware to apply custom functionality in API endpoints like auth

### Patch Changes

- 16b98d9: Reduce default step retry attempts
- c2144f4: Enable dynamic import of default-storage to reduce runtime/bundle size when not using default storage

## 0.5.1-alpha.0

### Patch Changes

- 3729dbd: Fixed a bug where useChat with client side tool calling and Memory would not work. Added docs for using Memory with useChat()

## 0.5.0

### Minor Changes

- 59df7b6: Added a new option to use tool-calls for saving working memory: new Memory({ workingMemory: { enabled: true, use: "tool-call" } }). This is to support response methods like toDataStream where masking working memory chunks would be more resource intensive and complex.
  To support this `memory` is now passed into tool execute args.
- dfbe4e9: Added new looping constructs with while/until and optional enum-based cyclical condition execution
- 3764e71: Workflow trigger data should only accept object types
- 02ffb7b: Added updateIndexById and deleteIndexById methods in the MastraVector inteface
- 358f069: Experimental if-else branching in between steps

### Patch Changes

- a910463: Improve typinges for getStepResult and workflow results
- 22643eb: Replace MastraPrimitives with direct Mastra instance
- 6feb23f: Fix for else condition with ref/query syntax
- f2d6727: Support for compound `.after` syntax
- 7a7a547: Fix telemetry getter in hono server
- 29f3a82: Improve agent generate,stream returnTypes
- 3d0e290: Fixed an issue where messages that were numbers weren't being stored as strings. Fixed incorrect array access when retrieving memory messages
- e9fbac5: Update Vercel tools to have id and update deployer
- 301e4ee: Fix log level showing number in core logger
- ee667a2: Fixed a serialization bug for thread IDs and dates in memory
- dab255b: Fixed bug where using an in memory libsql db (config.url = ":memory:) for memory would throw errors about missing tables
- 1e8bcbc: Fix suspend types
- f6678e4: Fixed an issue where we were using a non-windows-friendly absolute path check for libsql file urls
- 9e81f35: Fix query filter for vector search and rerank
- c93798b: Added MastraLanguageModel which extends LanguageModelV1
- a85ab24: make execute optional for create tool
- dbd9f2d: Handle different condition types on workflow graph
- 59df7b6: Keep default memory db in .mastra/mastra.db, not .mastra/output/memory.db for consistency
- caefaa2: Added optional chaining to a memory function call that may not exist
- c151ae6: Fixed an issue where models that don't support structured output would error when generating a thread title. Added an option to disable thread title llm generation `new Memory({ threads: { generateTitle: false }})`
- 52e0418: Split up action types between tools and workflows
- d79aedf: Fix import/require paths in these package.json
- 03236ec: Added GRPC Exporter for Laminar and updated dodcs for Observability Providers
- df982db: Updated Agent tool input to accept vercel tool format
- a171b37: Better retry mechanisms
- 506f1d5: Properly serialize any date object when inserting into libsql
- 0461849: Fixed a bug where mastra.db file location was inconsistently created when running mastra dev vs running a file directly (tsx src/index.ts for ex)
- 2259379: Add documentation for workflow looping APIs
- aeb5e36: Adds default schema for tool when not provided
- f2301de: Added the ability to ensure the accessed thread in memory.query() is for the right resource id. ex memory.query({ threadId, resourceId }). If the resourceId doesn't own the thread it will throw an error.
- fd4a1d7: Update cjs bundling to make sure files are split
- c139344: When converting JSON schemas to Zod schemas, we were sometimes marking optional fields as nullable instead, making them required with a null value, even if the schema didn't mark them as required

## 0.5.0-alpha.12

### Patch Changes

- a85ab24: make execute optional for create tool

## 0.5.0-alpha.11

### Patch Changes

- 7a7a547: Fix telemetry getter in hono server
- c93798b: Added MastraLanguageModel which extends LanguageModelV1
- dbd9f2d: Handle different condition types on workflow graph
- a171b37: Better retry mechanisms
- fd4a1d7: Update cjs bundling to make sure files are split

## 0.5.0-alpha.10

### Patch Changes

- a910463: Improve typinges for getStepResult and workflow results

## 0.5.0-alpha.9

### Patch Changes

- e9fbac5: Update Vercel tools to have id and update deployer
- 1e8bcbc: Fix suspend types
- aeb5e36: Adds default schema for tool when not provided
- f2301de: Added the ability to ensure the accessed thread in memory.query() is for the right resource id. ex memory.query({ threadId, resourceId }). If the resourceId doesn't own the thread it will throw an error.

## 0.5.0-alpha.8

### Patch Changes

- 506f1d5: Properly serialize any date object when inserting into libsql

## 0.5.0-alpha.7

### Patch Changes

- ee667a2: Fixed a serialization bug for thread IDs and dates in memory

## 0.5.0-alpha.6

### Patch Changes

- f6678e4: Fixed an issue where we were using a non-windows-friendly absolute path check for libsql file urls

## 0.5.0-alpha.5

### Minor Changes

- dfbe4e9: Added new looping constructs with while/until and optional enum-based cyclical condition execution
- 3764e71: Workflow trigger data should only accept object types
- 358f069: Experimental if-else branching in between steps

### Patch Changes

- 22643eb: Replace MastraPrimitives with direct Mastra instance
- 6feb23f: Fix for else condition with ref/query syntax
- f2d6727: Support for compound `.after` syntax
- 301e4ee: Fix log level showing number in core logger
- 9e81f35: Fix query filter for vector search and rerank
- caefaa2: Added optional chaining to a memory function call that may not exist
- c151ae6: Fixed an issue where models that don't support structured output would error when generating a thread title. Added an option to disable thread title llm generation `new Memory({ threads: { generateTitle: false }})`
- 52e0418: Split up action types between tools and workflows
- 03236ec: Added GRPC Exporter for Laminar and updated dodcs for Observability Providers
- df982db: Updated Agent tool input to accept vercel tool format
- 0461849: Fixed a bug where mastra.db file location was inconsistently created when running mastra dev vs running a file directly (tsx src/index.ts for ex)
- 2259379: Add documentation for workflow looping APIs

## 0.5.0-alpha.4

### Patch Changes

- d79aedf: Fix import/require paths in these package.json

## 0.5.0-alpha.3

### Patch Changes

- 3d0e290: Fixed an issue where messages that were numbers weren't being stored as strings. Fixed incorrect array access when retrieving memory messages

## 0.5.0-alpha.2

### Minor Changes

- 02ffb7b: Added updateIndexById and deleteIndexById methods in the MastraVector inteface

## 0.5.0-alpha.1

### Patch Changes

- dab255b: Fixed bug where using an in memory libsql db (config.url = ":memory:) for memory would throw errors about missing tables

## 0.5.0-alpha.0

### Minor Changes

- 59df7b6: Added a new option to use tool-calls for saving working memory: new Memory({ workingMemory: { enabled: true, use: "tool-call" } }). This is to support response methods like toDataStream where masking working memory chunks would be more resource intensive and complex.
  To support this `memory` is now passed into tool execute args.

### Patch Changes

- 29f3a82: Improve agent generate,stream returnTypes
- 59df7b6: Keep default memory db in .mastra/mastra.db, not .mastra/output/memory.db for consistency
- c139344: When converting JSON schemas to Zod schemas, we were sometimes marking optional fields as nullable instead, making them required with a null value, even if the schema didn't mark them as required

## 0.4.4

### Patch Changes

- 1da20e7: Update typechecks for positional args

## 0.4.4-alpha.0

### Patch Changes

- 1da20e7: Update typechecks for positional args

## 0.4.3

### Patch Changes

- 0d185b1: Ensure proper message sort order for tool calls and results when using Memory semanticRecall feature
- ed55f1d: Fixes to watch payload in workloads with nested branching
- 06aa827: add option for specifying telemetry settings at generation time
- 0fd78ac: Update vector store functions to use object params
- 2512a93: Support all aisdk options for agent stream,generate
- e62de74: Fix optional tool llm
  execute
- 0d25b75: Add all agent stream,generate option to cliend-js sdk
- fd14a3f: Updating filter location from @mastra/core/filter to @mastra/core/vector/filter
- 8d13b14: Fixes early exits in workflows with branching
- 3f369a2: A better async/await based interface for suspend/resume tracking
- 3ee4831: Fixed agent.generate() so it properly infers the return type based on output: schema | string and experimental_output: schema
- 4d4e1e1: Updated vector tests and pinecone
- bb4f447: Add support for commonjs
- 108793c: Throw error when resourceId is not provided but Memory is configured and a threadId was passed
- 5f28f44: Updated Chroma Vector to allow for document storage
- dabecf4: Pass threadId and resourceId into tool execute functions so that tools are able to query memory

## 0.4.3-alpha.4

### Patch Changes

- dabecf4: Pass threadId and resourceId into tool execute functions so that tools are able to query memory

## 0.4.3-alpha.3

### Patch Changes

- 0fd78ac: Update vector store functions to use object params
- 0d25b75: Add all agent stream,generate option to cliend-js sdk
- fd14a3f: Updating filter location from @mastra/core/filter to @mastra/core/vector/filter
- 3f369a2: A better async/await based interface for suspend/resume tracking
- 4d4e1e1: Updated vector tests and pinecone
- bb4f447: Add support for commonjs

## 0.4.3-alpha.2

### Patch Changes

- 2512a93: Support all aisdk options for agent stream,generate
- e62de74: Fix optional tool llm
  execute

## 0.4.3-alpha.1

### Patch Changes

- 0d185b1: Ensure proper message sort order for tool calls and results when using Memory semanticRecall feature
- ed55f1d: Fixes to watch payload in workloads with nested branching
- 8d13b14: Fixes early exits in workflows with branching
- 3ee4831: Fixed agent.generate() so it properly infers the return type based on output: schema | string and experimental_output: schema
- 108793c: Throw error when resourceId is not provided but Memory is configured and a threadId was passed
- 5f28f44: Updated Chroma Vector to allow for document storage

## 0.4.3-alpha.0

### Patch Changes

- 06aa827: add option for specifying telemetry settings at generation time

## 0.4.2

### Patch Changes

- 7fceae1: Removed system prompt with todays date since it can interfere with input token caching. Also removed a memory system prompt that refered to date ranges - we no longer use date ranges for memory so this was removed
- 8d94c3e: Optional tool execute
- 99dcdb5: Inject primitives into condition function, and renames getStepPayload to getStepResult.
- 6cb63e0: Experimental output support
- f626fbb: add stt and tts capabilities on agent
- e752340: Move storage/vector libSQL to own files so they do not get imported when not using bundlers.
- eb91535: Correct typo in LanguageModel-related

## 0.4.2-alpha.2

### Patch Changes

- 8d94c3e: Optional tool execute
- 99dcdb5: Inject primitives into condition function, and renames getStepPayload to getStepResult.
- e752340: Move storage/vector libSQL to own files so they do not get imported when not using bundlers.
- eb91535: Correct typo in LanguageModel-related

## 0.4.2-alpha.1

### Patch Changes

- 6cb63e0: Experimental output support

## 0.4.2-alpha.0

### Patch Changes

- 7fceae1: Removed system prompt with todays date since it can interfere with input token caching. Also removed a memory system prompt that refered to date ranges - we no longer use date ranges for memory so this was removed
- f626fbb: add stt and tts capabilities on agent

## 0.4.1

### Patch Changes

- ce44b9b: Fixed a bug where embeddings were being created for memory even when semanticRecall was turned off
- 967da43: Logger, transport fixes
- b405f08: add stt and tts capabilities on agent

## 0.4.0

### Minor Changes

- 2fc618f: Add MastraVoice class

### Patch Changes

- fe0fd01: Fixed a bug where masked tags don't work when a chunk includes other text (ex "o <start_tag" or "tag> w") in the maskStreamTags() util

## 0.4.0-alpha.1

### Patch Changes

- fe0fd01: Fixed a bug where masked tags don't work when a chunk includes other text (ex "o <start_tag" or "tag> w") in the maskStreamTags() util

## 0.4.0-alpha.0

### Minor Changes

- 2fc618f: Add MastraVoice class

## 0.3.0

### Minor Changes

- f205ede: Memory can no longer be added to new Mastra(), only to new Agent() - this is for simplicity as each agent will typically need its own memory settings

## 0.2.1

### Patch Changes

- d59f1a8: Added example docs for evals and export metricJudge
- 91ef439: Add eslint and ran autofix
- 4a25be4: Fixed race condition when multiple storage methods attempt to initialize the db at the same time
- bf2e88f: Fix treeshake bug
- 2f0d707: Fix wrong usage of peerdep of AI pkg
- aac1667: Improve treeshaking of core and output

## 0.2.1-alpha.0

### Patch Changes

- d59f1a8: Added example docs for evals and export metricJudge
- 91ef439: Add eslint and ran autofix
- 4a25be4: Fixed race condition when multiple storage methods attempt to initialize the db at the same time
- bf2e88f: Fix treeshake bug
- 2f0d707: Fix wrong usage of peerdep of AI pkg
- aac1667: Improve treeshaking of core and output

## 0.2.0

### Minor Changes

- 4d4f6b6: Update deployer
- 30322ce: Added new Memory API for managed agent memory via MastraStorage and MastraVector classes
- d7d465a: Breaking change for Memory: embeddings: {} has been replaced with embedder: new OpenAIEmbedder() (or whichever embedder you want - check the docs)
- 5285356: Renamed MastraLibSQLStorage and MastraLibSQLVector to DefaultStorage and DefaultVectorDB. I left the old export names so that it wont break anyones projects but all docs now show the new names
- 74b3078: Reduce verbosity in workflows API
- 8b416d9: Breaking changes
- 16e5b04: Moved @mastra/vector-libsql into @mastra/core/vector/libsql
- 8769a62: Split core into seperate entry fils

### Patch Changes

- f537e33: feat: add default logger
- 6f2c0f5: Prevent telemetry proxy from converting sync methods to async
- e4d4ede: Better setLogger()
- 0be7181: Fix forward version
- dd6d87f: Update Agent and LLM config to accept temperature setting
- 9029796: add more logs to agent for debugging
- 6fa4bd2: New LLM primitive, OpenAI, AmazonBedrock
- f031a1f: expose embed from rag, and refactor embed
- 8151f44: Added \_\_registerPrimitives to model.ts
- d7d465a: Embedding api
- 73d112c: Core and deployer fixes
- 592e3cf: Add custom rag tools, add vector retrieval, and update docs
- 9d1796d: Fix storage and eval serialization on api
- e897f1c: Eval change
- 4a54c82: Fix dane labelling functionality
- 3967e69: Added GraphRAG implementation and updated docs
- 8ae2bbc: Dane publishing
- e9d1b47: Rename Memory options historySearch to semanticRecall, rename embeddingOptions to embedding
- 016493a: Deprecate metrics in favor of evals
- bc40916: Pass mastra instance directly into actions allowing access to all registered primitives
- 93a3719: Mastra prompt template engine
- 7d83b92: Create default storage and move evals towards it
- 9fb3039: Storage
- d5e12de: optional mastra config object
- e1dd94a: update the api for embeddings
- 07c069d: Add dotenv as dependency
- 5cdfb88: add getWorkflows method to core, add runId to workflow logs, update workflow starter file, add workflows page with table and workflow page with info, endpoints and logs
- 837a288: MAJOR Revamp of tools, workflows, syncs.
- 685108a: Remove syncs and excess rag
- c8ff2f5: Fixed passing CoreMessages to stream/generate where the role is not user. Previously all messages would be rewritten to have role: "user"
- 5fdc87c: Update evals storage in attachListeners
- ae7bf94: Fix loggers messing up deploys
- 8e7814f: Add payload getter on machine context
- 66a03ec: Removed an extra llm call that was needed for the old Memory API but is no longer needed
- 7d87a15: generate command in agent, and support array of message strings
- b97ca96: Tracing into default storage
- 23dcb23: Redeploy core
- 033eda6: More fixes for refactor
- 8105fae: Split embed into embed and embedMany to handle different return types
- e097800: TTS in core
- 1944807: Unified logger and major step in better logs
- 1874f40: Added re ranking tool to RAG
- 685108a: Removing mastra syncs
- f7d1131: Improved types when missing inputSchema
- 79acad0: Better type safety on trigger step
- 7a19083: Updates to the LLM class
- 382f4dc: move telemetry init to instrumentation.mjs file in build directory
- 1ebd071: Add more embedding models
- 0b74006: Workflow updates
- 2f17a5f: Added filter translator and tests for Qdrant
- f368477: Added evals package and added evals in core
- 7892533: Updated test evals to use Mastra Storage
- 9c10484: update all packages
- b726bf5: Fix agent memory int.
- 70dabd9: Fix broken publish
- 21fe536: add keyword tags for packages and update readmes
- 176bc42: Added runId and proper parent spans to workflow tracing
- 401a4d9: Add simple conditions test
- 2e099d2: Allow trigger passed in to `then` step
- 0b826f6: Allow agents to use ZodSchemas in structuredOutput
- d68b532: Updated debug logs
- 75bf3f0: remove context bug in agent tool execution, update style for mastra dev rendered pages
- e6d8055: Added Mastra Storage to add and query live evals
- e2e76de: Anthropic model added to new primitive structure
- ccbc581: Updated operator validation and handling for all vector stores
- 5950de5: Added update instructions API
- fe3dcb0: Add fastembed import error handling
- 78eec7c: Started implementation on Unified Filter API for several vector stores.
- a8a459a: Updated Evals table UI
- 0be7181: Add perplexity models
- 7b87567: Propagate setLogger calls to more places
- b524c22: Package upgrades
- df843d3: Fixed libsql db relative file paths so they're always outside the .mastra directory. If they're inside .mastra they will be deleted when code is re-bundled
- 4534e77: Fix fastembed imports in mastra cloud for default embedder
- d6d8159: Workflow graph diagram
- 0bd142c: Fixes learned from docs
- 9625602: Use mastra core splitted bundles in other packages
- 72d1990: Updated evals table schema
- f6ba259: simplify generate api
- 2712098: add getAgents method to core and route to cli dev, add homepage interface to cli
- eedb829: Better types, and correct payload resolution
- cb290ee: Reworked the Memory public API to have more intuitive and simple property names
- b4d7416: Added the ability to pass a configured Memory class instance directly to new Agent instances instead of passing memory to Mastra
- e608d8c: Export CoreMessage Types from ai sdk
- 06b2c0a: Update summarization prompt and fix eval input
- 002d6d8: add memory to playground agent
- e448a26: Correctly pass down runId to called tools
- fd494a3: TTS module
- dc90663: Fix issues in packages
- c872875: update createMultiLogger to combineLogger
- 3c4488b: Fix context not passed in agent tool execution
- a7b016d: Added export for MockMastraEngine from @mastra/core
- fd75f3c: Added storage, vector, embedder setters to the base MastraMemory class
- 7f24c29: Add Chroma Filter translator and updated vector store tests
- 2017553: Added fallback title when calling createThread() with no title - this is needed as storage db schemas mark title as non-null
- a10b7a3: Implemented new filtering for vectorQueryTool and updated docs
- cf6d825: Fixed a bug where 0 values in memory configs were falling back to default val. Removed a noisy log. Removed a deprecated option
- 963c15a: Add new toolset primitive and implementation for composio
- 7365b6c: More models
- 5ee67d3: make trace name configurable for telemetry exporter
- d38f7a6: clean up old methods in agent
- 38b7f66: Update deployer logic
- 2fa7f53: add more logs to workflow, only log failed workflow if all steps fail, animate workflow diagram edges
- 1420ae2: Fix storage logger
- f6da688: update agents/:agentId page in dev to show agent details and endpoints, add getTools to agent
- 3700be1: Added helpful error when using vector with Memory class - error now contains embedding option example
- 9ade36e: Changed measure for evals, added endpoints, attached metrics to agent, added ui for evals in playground, and updated docs
- 10870bc: Added a default vector db (libsql) and embedder (fastembed) so that new Memory() can be initialized with zero config
- 2b01511: Update CONSOLE logger to store logs and return logs, add logs to dev agent page
- a870123: Added local embedder class that uses fastembed-js, a Typescript/NodeJS implementation of @Qdrant/fastembed
- ccf115c: Fixed incomplete tool call errors when including memory message history in context
- 04434b6: Create separate logger file
- 5811de6: Updates spec-writer example to use new workflows constructs. Small improvements to workflow internals. Switch transformer tokenizer for js compatible one.
- 9f3ab05: pass custom telemetry exporter
- 66a5392: batchInsert needs init. Use private version for internal calls
- 4b1ce2c: Update Google model support in documentation and type definitions to include new Gemini versions
- 14064f2: Deployer abstract class
- f5dfa20: only add logger if there is a logger
- 327ece7: Updates for ts versions
- da2e8d3: Export EmbedManyResult and EmbedResult from ai sdk and update docs
- 95a4697: Fixed trace method for telemetry
- d5fccfb: expose model function
- 3427b95: Updated docs to include intermediate rag examples (metadata filtering, query filters, etc)
- 538a136: Added Simple Condition for workflows, updated /api/workflows/{workflowId}/execute endpoint and docs
- e66643a: Add o1 models
- b5393f1: New example: Dane and many fixes to make it work
- d2cd535: configure dotenv in core
- c2dd6b5: This set of changes introduces a new .step API for subscribing to step executions for running other step chains. It also improves step types, and enables the ability to create a cyclic step chain.
- 67637ba: Fixed storage bugs related to the new Memory API
- 836f4e3: Fixed some issues with memory, added Upstash as a memory provider. Silenced dev logs in core
- 5ee2e78: Update core for Alpha3 release
- cd02c56: Implement a new and improved API for workflows.
- 01502b0: fix thread title containing unnecessary text and removed unnecessary logs in memory
- d9c8dd0: Logger changes for default transports
- 9fb59d6: changeset
- a9345f9: Fixed tsc build for core types
- 99f1847: Clean up logs
- 04f3171: More providers
- d5ec619: Remove promptTemplate from core
- 27275c9: Added new short term "working" memory for agents. Also added a "maskStreamTags" helper to assist in hiding working memory xml blocks in streamed responses
- ae7bf94: Changeset
- 4f1d1a1: Enforce types ann cleanup package.json
- ee4de15: Dane fixes
- 202d404: Added instructions when generating evals
- a221426: Simplify workflows watch API

## 0.2.0-alpha.110

### Patch Changes

- 016493a: Deprecate metrics in favor of evals
- 382f4dc: move telemetry init to instrumentation.mjs file in build directory
- 176bc42: Added runId and proper parent spans to workflow tracing
- d68b532: Updated debug logs
- fe3dcb0: Add fastembed import error handling
- e448a26: Correctly pass down runId to called tools
- fd75f3c: Added storage, vector, embedder setters to the base MastraMemory class
- ccf115c: Fixed incomplete tool call errors when including memory message history in context
- a221426: Simplify workflows watch API

## 0.2.0-alpha.109

### Patch Changes

- d5fccfb: expose model function

## 0.2.0-alpha.108

### Patch Changes

- 5ee67d3: make trace name configurable for telemetry exporter
- 95a4697: Fixed trace method for telemetry

## 0.2.0-alpha.107

### Patch Changes

- 66a5392: batchInsert needs init. Use private version for internal calls

## 0.2.0-alpha.106

### Patch Changes

- 6f2c0f5: Prevent telemetry proxy from converting sync methods to async
- a8a459a: Updated Evals table UI

## 0.2.0-alpha.105

### Patch Changes

- 1420ae2: Fix storage logger
- 99f1847: Clean up logs

## 0.2.0-alpha.104

### Patch Changes

- 5fdc87c: Update evals storage in attachListeners
- b97ca96: Tracing into default storage
- 72d1990: Updated evals table schema
- cf6d825: Fixed a bug where 0 values in memory configs were falling back to default val. Removed a noisy log. Removed a deprecated option
- 10870bc: Added a default vector db (libsql) and embedder (fastembed) so that new Memory() can be initialized with zero config

## 0.2.0-alpha.103

### Patch Changes

- 4534e77: Fix fastembed imports in mastra cloud for default embedder

## 0.2.0-alpha.102

### Patch Changes

- a9345f9: Fixed tsc build for core types

## 0.2.0-alpha.101

### Patch Changes

- 66a03ec: Removed an extra llm call that was needed for the old Memory API but is no longer needed
- 4f1d1a1: Enforce types ann cleanup package.json

## 0.2.0-alpha.100

### Patch Changes

- 9d1796d: Fix storage and eval serialization on api

## 0.2.0-alpha.99

### Patch Changes

- 7d83b92: Create default storage and move evals towards it

## 0.2.0-alpha.98

### Patch Changes

- 70dabd9: Fix broken publish
- 202d404: Added instructions when generating evals

## 0.2.0-alpha.97

### Patch Changes

- 07c069d: Add dotenv as dependency
- 7892533: Updated test evals to use Mastra Storage
- e6d8055: Added Mastra Storage to add and query live evals
- 5950de5: Added update instructions API
- df843d3: Fixed libsql db relative file paths so they're always outside the .mastra directory. If they're inside .mastra they will be deleted when code is re-bundled
- a870123: Added local embedder class that uses fastembed-js, a Typescript/NodeJS implementation of @Qdrant/fastembed

## 0.2.0-alpha.96

### Minor Changes

- 74b3078: Reduce verbosity in workflows API

## 0.2.0-alpha.95

### Patch Changes

- 9fb59d6: changeset

## 0.2.0-alpha.94

### Minor Changes

- 8b416d9: Breaking changes

### Patch Changes

- 9c10484: update all packages

## 0.2.0-alpha.93

### Minor Changes

- 5285356: Renamed MastraLibSQLStorage and MastraLibSQLVector to DefaultStorage and DefaultVectorDB. I left the old export names so that it wont break anyones projects but all docs now show the new names

## 0.2.0-alpha.92

### Minor Changes

- 4d4f6b6: Update deployer

## 0.2.0-alpha.91

### Minor Changes

- d7d465a: Breaking change for Memory: embeddings: {} has been replaced with embedder: new OpenAIEmbedder() (or whichever embedder you want - check the docs)
- 16e5b04: Moved @mastra/vector-libsql into @mastra/core/vector/libsql

### Patch Changes

- d7d465a: Embedding api
- 2017553: Added fallback title when calling createThread() with no title - this is needed as storage db schemas mark title as non-null
- a10b7a3: Implemented new filtering for vectorQueryTool and updated docs

## 0.2.0-alpha.90

### Patch Changes

- 8151f44: Added \_\_registerPrimitives to model.ts
- e897f1c: Eval change
- 3700be1: Added helpful error when using vector with Memory class - error now contains embedding option example

## 0.2.0-alpha.89

### Patch Changes

- 27275c9: Added new short term "working" memory for agents. Also added a "maskStreamTags" helper to assist in hiding working memory xml blocks in streamed responses

## 0.2.0-alpha.88

### Patch Changes

- ccbc581: Updated operator validation and handling for all vector stores

## 0.2.0-alpha.87

### Patch Changes

- 7365b6c: More models

## 0.2.0-alpha.86

### Patch Changes

- 6fa4bd2: New LLM primitive, OpenAI, AmazonBedrock
- e2e76de: Anthropic model added to new primitive structure
- 7f24c29: Add Chroma Filter translator and updated vector store tests
- 67637ba: Fixed storage bugs related to the new Memory API
- 04f3171: More providers

## 0.2.0-alpha.85

### Patch Changes

- e9d1b47: Rename Memory options historySearch to semanticRecall, rename embeddingOptions to embedding

## 0.2.0-alpha.84

### Patch Changes

- 2f17a5f: Added filter translator and tests for Qdrant
- cb290ee: Reworked the Memory public API to have more intuitive and simple property names
- b4d7416: Added the ability to pass a configured Memory class instance directly to new Agent instances instead of passing memory to Mastra
- 38b7f66: Update deployer logic

## 0.2.0-alpha.83

### Minor Changes

- 30322ce: Added new Memory API for managed agent memory via MastraStorage and MastraVector classes
- 8769a62: Split core into seperate entry fils

### Patch Changes

- 78eec7c: Started implementation on Unified Filter API for several vector stores.
- 9625602: Use mastra core splitted bundles in other packages

## 0.1.27-alpha.82

### Patch Changes

- 73d112c: Core and deployer fixes

## 0.1.27-alpha.81

### Patch Changes

- 9fb3039: Storage

## 0.1.27-alpha.80

### Patch Changes

- 327ece7: Updates for ts versions

## 0.1.27-alpha.79

### Patch Changes

- 21fe536: add keyword tags for packages and update readmes

## 0.1.27-alpha.78

### Patch Changes

- 685108a: Remove syncs and excess rag
- 685108a: Removing mastra syncs

## 0.1.27-alpha.77

### Patch Changes

- 8105fae: Split embed into embed and embedMany to handle different return types

## 0.1.27-alpha.76

### Patch Changes

- ae7bf94: Fix loggers messing up deploys
- ae7bf94: Changeset

## 0.1.27-alpha.75

### Patch Changes

- 23dcb23: Redeploy core

## 0.1.27-alpha.74

### Patch Changes

- 7b87567: Propagate setLogger calls to more places

## 0.1.27-alpha.73

### Patch Changes

- 3427b95: Updated docs to include intermediate rag examples (metadata filtering, query filters, etc)

## 0.1.27-alpha.72

### Patch Changes

- e4d4ede: Better setLogger()
- 06b2c0a: Update summarization prompt and fix eval input

## 0.1.27-alpha.71

### Patch Changes

- d9c8dd0: Logger changes for default transports

## 0.1.27-alpha.70

### Patch Changes

- dd6d87f: Update Agent and LLM config to accept temperature setting
- 04434b6: Create separate logger file

## 0.1.27-alpha.69

### Patch Changes

- 1944807: Unified logger and major step in better logs
- 9ade36e: Changed measure for evals, added endpoints, attached metrics to agent, added ui for evals in playground, and updated docs

## 0.1.27-alpha.68

### Patch Changes

- 0be7181: Fix forward version
- 0be7181: Add perplexity models

## 0.1.27-alpha.67

### Patch Changes

- c8ff2f5: Fixed passing CoreMessages to stream/generate where the role is not user. Previously all messages would be rewritten to have role: "user"

## 0.1.27-alpha.66

### Patch Changes

- 14064f2: Deployer abstract class

## 0.1.27-alpha.65

### Patch Changes

- e66643a: Add o1 models

## 0.1.27-alpha.64

### Patch Changes

- f368477: Added evals package and added evals in core
- d5ec619: Remove promptTemplate from core

## 0.1.27-alpha.63

### Patch Changes

- e097800: TTS in core

## 0.1.27-alpha.62

### Patch Changes

- 93a3719: Mastra prompt template engine

## 0.1.27-alpha.61

### Patch Changes

- dc90663: Fix issues in packages

## 0.1.27-alpha.60

### Patch Changes

- 3967e69: Added GraphRAG implementation and updated docs

## 0.1.27-alpha.59

### Patch Changes

- b524c22: Package upgrades

## 0.1.27-alpha.58

### Patch Changes

- 1874f40: Added re ranking tool to RAG
- 4b1ce2c: Update Google model support in documentation and type definitions to include new Gemini versions

## 0.1.27-alpha.57

### Patch Changes

- fd494a3: TTS module

## 0.1.27-alpha.56

### Patch Changes

- 9f3ab05: pass custom telemetry exporter

## 0.1.27-alpha.55

### Patch Changes

- 592e3cf: Add custom rag tools, add vector retrieval, and update docs
- 837a288: MAJOR Revamp of tools, workflows, syncs.
- 0b74006: Workflow updates

## 0.1.27-alpha.54

### Patch Changes

- d2cd535: configure dotenv in core

## 0.1.27-alpha.53

### Patch Changes

- 8e7814f: Add payload getter on machine context

## 0.1.27-alpha.52

### Patch Changes

- eedb829: Better types, and correct payload resolution

## 0.1.27-alpha.51

### Patch Changes

- a7b016d: Added export for MockMastraEngine from @mastra/core
- da2e8d3: Export EmbedManyResult and EmbedResult from ai sdk and update docs
- 538a136: Added Simple Condition for workflows, updated /api/workflows/{workflowId}/execute endpoint and docs

## 0.1.27-alpha.50

### Patch Changes

- 401a4d9: Add simple conditions test

## 0.1.27-alpha.49

### Patch Changes

- 79acad0: Better type safety on trigger step
- f5dfa20: only add logger if there is a logger

## 0.1.27-alpha.48

### Patch Changes

- b726bf5: Fix agent memory int.

## 0.1.27-alpha.47

### Patch Changes

- f6ba259: simplify generate api

## 0.1.27-alpha.46

### Patch Changes

- 8ae2bbc: Dane publishing
- 0bd142c: Fixes learned from docs
- ee4de15: Dane fixes

## 0.1.27-alpha.45

### Patch Changes

- e608d8c: Export CoreMessage Types from ai sdk
- 002d6d8: add memory to playground agent

## 0.1.27-alpha.44

### Patch Changes

- 2fa7f53: add more logs to workflow, only log failed workflow if all steps fail, animate workflow diagram edges

## 0.1.27-alpha.43

### Patch Changes

- 2e099d2: Allow trigger passed in to `then` step
- d6d8159: Workflow graph diagram

## 0.1.27-alpha.42

### Patch Changes

- 4a54c82: Fix dane labelling functionality

## 0.1.27-alpha.41

### Patch Changes

- 5cdfb88: add getWorkflows method to core, add runId to workflow logs, update workflow starter file, add workflows page with table and workflow page with info, endpoints and logs

## 0.1.27-alpha.40

### Patch Changes

- 9029796: add more logs to agent for debugging

## 0.1.27-alpha.39

### Patch Changes

- 2b01511: Update CONSOLE logger to store logs and return logs, add logs to dev agent page

## 0.1.27-alpha.38

### Patch Changes

- f031a1f: expose embed from rag, and refactor embed

## 0.1.27-alpha.37

### Patch Changes

- c872875: update createMultiLogger to combineLogger
- f6da688: update agents/:agentId page in dev to show agent details and endpoints, add getTools to agent
- b5393f1: New example: Dane and many fixes to make it work

## 0.1.27-alpha.36

### Patch Changes

- f537e33: feat: add default logger
- bc40916: Pass mastra instance directly into actions allowing access to all registered primitives
- f7d1131: Improved types when missing inputSchema
- 75bf3f0: remove context bug in agent tool execution, update style for mastra dev rendered pages
- 3c4488b: Fix context not passed in agent tool execution
- d38f7a6: clean up old methods in agent

## 0.1.27-alpha.35

### Patch Changes

- 033eda6: More fixes for refactor

## 0.1.27-alpha.34

### Patch Changes

- 837a288: MAJOR Revamp of tools, workflows, syncs.
- 5811de6: Updates spec-writer example to use new workflows constructs. Small improvements to workflow internals. Switch transformer tokenizer for js compatible one.

## 0.1.27-alpha.33

### Patch Changes

- e1dd94a: update the api for embeddings

## 0.1.27-alpha.32

### Patch Changes

- 2712098: add getAgents method to core and route to cli dev, add homepage interface to cli

## 0.1.27-alpha.31

### Patch Changes

- c2dd6b5: This set of changes introduces a new .step API for subscribing to step executions for running other step chains. It also improves step types, and enables the ability to create a cyclic step chain.

## 0.1.27-alpha.30

### Patch Changes

- 963c15a: Add new toolset primitive and implementation for composio

## 0.1.27-alpha.29

### Patch Changes

- 7d87a15: generate command in agent, and support array of message strings

## 0.1.27-alpha.28

### Patch Changes

- 1ebd071: Add more embedding models

## 0.1.27-alpha.27

### Patch Changes

- cd02c56: Implement a new and improved API for workflows.

## 0.1.27-alpha.26

### Patch Changes

- d5e12de: optional mastra config object

## 0.1.27-alpha.25

### Patch Changes

- 01502b0: fix thread title containing unnecessary text and removed unnecessary logs in memory

## 0.1.27-alpha.24

### Patch Changes

- 836f4e3: Fixed some issues with memory, added Upstash as a memory provider. Silenced dev logs in core

## 0.1.27-alpha.23

### Patch Changes

- 0b826f6: Allow agents to use ZodSchemas in structuredOutput

## 0.1.27-alpha.22

### Patch Changes

- 7a19083: Updates to the LLM class

## 0.1.27-alpha.21

### Patch Changes

- 5ee2e78: Update core for Alpha3 release
