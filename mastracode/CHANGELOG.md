# mastracode

## 0.2.0

### Minor Changes

- Added streaming tool argument previews across all tool renderers. Tool names, file paths, and commands now appear immediately as the model generates them, rather than waiting for the complete tool call. ([#13328](https://github.com/mastra-ai/mastra/pull/13328))
  - **Generic tools** show live key/value argument previews as args stream in
  - **Edit tool** renders a bordered diff preview as soon as `old_str` and `new_str` are available, even before the tool result arrives
  - **Write tool** streams syntax-highlighted file content in a bordered box while args arrive
  - **Find files** shows the glob pattern in the pending header
  - **Task write** streams items directly into the pinned task list component in real-time

  All tools use partial JSON parsing to progressively display argument information. This is enabled automatically for all Harness-based agents — no configuration required.

### Patch Changes

- Improved subagent usage guidance: subagents are now only recommended when spawning multiple in parallel, and the main agent must verify all subagent output before proceeding. ([#13339](https://github.com/mastra-ai/mastra/pull/13339))

- Updated TUI to work with the new Harness object-parameter API, ensuring all commands, approvals, and thread flows continue to function correctly. ([#13353](https://github.com/mastra-ai/mastra/pull/13353))

- Added audit-tests subagent that reviews test quality in a branch. The parent agent passes a description of the branch work along with changed files to this read-only subagent, which explores existing test conventions then audits for behavioral coverage, intent-vs-test alignment, LLM-generated test slop, redundant assertions, file organization, and missing edge cases. ([#13331](https://github.com/mastra-ai/mastra/pull/13331))

- Fixed the `/mcp` slash command always showing "MCP system not initialized" even when MCP servers were configured and working. Server status and `/mcp reload` now work as expected. ([#13311](https://github.com/mastra-ai/mastra/pull/13311))

- Improved Observational Memory activation timing by halving the buffer interval when approaching the activation threshold, producing finer-grained chunks for more precise context management. ([#13357](https://github.com/mastra-ai/mastra/pull/13357))

- Fixed stale OAuth credentials when resolving the OpenAI Codex model. Auth storage is now reloaded before each model resolution, preventing authentication failures after token refresh. ([#13307](https://github.com/mastra-ai/mastra/pull/13307))

- Improved TUI composability for external consumers by exposing a structured `TUIState` interface and `createTUIState` factory. ([#13350](https://github.com/mastra-ai/mastra/pull/13350))

- Added AGENTS.md to the instruction file loader so projects created by create-mastra are automatically picked up. Removed support for the deprecated AGENT.md (singular) convention. ([#13346](https://github.com/mastra-ai/mastra/pull/13346))

- Fixed an issue where memory activation could shrink the message window too aggressively due to a token counting inaccuracy, resulting in very small context windows (~300 tokens). Temporarily raised the buffer activation threshold to prevent this. ([#13349](https://github.com/mastra-ai/mastra/pull/13349))

- Fixed assistant message text disappearing when todo_write tool calls were made during streaming ([#13335](https://github.com/mastra-ai/mastra/pull/13335))

- Fixed the view tool to gracefully handle view_range when viewing directories. Previously, passing view_range with a directory path would throw an error, and passing undefined values would fail schema validation. Now, view_range slices the directory listing to show a subset of entries, enabling pagination through large directories. ([#13355](https://github.com/mastra-ai/mastra/pull/13355))

- Updated README with current installation instructions for npm, pnpm, and Homebrew. ([#13294](https://github.com/mastra-ai/mastra/pull/13294))

- Simplified the MCP management API by replacing the `MCPManager` class with a `createMcpManager()` factory function. All existing behavior (TUI `/mcp` command, tool collection, config merging) is preserved. ([#13347](https://github.com/mastra-ai/mastra/pull/13347))

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

- Migrated from todo_write/todo_check tools to the new built-in task_write/task_check tools from @mastra/core/harness. Renamed all todo terminology to task across prompts, TUI components, and agent configurations. ([#13344](https://github.com/mastra-ai/mastra/pull/13344))

- Fixed Observational Memory status not updating during conversations. The harness was missing streaming handlers for OM data chunks (status, observation start/end, buffering, activation), so the TUI never received real-time OM progress updates. Also added switchObserverModel and switchReflectorModel methods so changing OM models properly emits events to subscribers. ([#13330](https://github.com/mastra-ai/mastra/pull/13330))

- Fixed Ctrl+F follow-up queueing to resolve autocomplete suggestions before reading editor text, so partially typed slash commands (e.g. /rev) are expanded to their full form (e.g. /review). Slash commands queued via Ctrl+F are now properly processed through the slash command handler after the agent finishes, instead of being sent as raw text to the LLM. ([#13345](https://github.com/mastra-ai/mastra/pull/13345))

- Reduced tool result token limits to prevent oversized responses. Lowered file view and grep token limits from 3,000 to 2,000 tokens. Added 2,000 token truncation to web search and web extract tools, which previously returned unbounded results. ([#13348](https://github.com/mastra-ai/mastra/pull/13348))

- Fixed thread resuming in git worktrees. Previously, starting mastracode in a new worktree would resume a thread from another worktree of the same repo. Threads are now auto-tagged with the project path and filtered on resume so each worktree gets its own thread scope. ([#13343](https://github.com/mastra-ai/mastra/pull/13343))

- Updated dependencies [[`5c70aeb`](https://github.com/mastra-ai/mastra/commit/5c70aeb391434c34f9e43caa2e8572d412bcb2b0), [`0d9efb4`](https://github.com/mastra-ai/mastra/commit/0d9efb47992c34aa90581c18b9f51f774f6252a5), [`5caa13d`](https://github.com/mastra-ai/mastra/commit/5caa13d1b2a496e2565ab124a11de9a51ad3e3b9), [`270dd16`](https://github.com/mastra-ai/mastra/commit/270dd168a86698a699d8a9de8dbce1a40f72d862), [`940163f`](https://github.com/mastra-ai/mastra/commit/940163fc492401d7562301e6f106ccef4fefe06f), [`5c70aeb`](https://github.com/mastra-ai/mastra/commit/5c70aeb391434c34f9e43caa2e8572d412bcb2b0), [`b260123`](https://github.com/mastra-ai/mastra/commit/b2601234bd093d358c92081a58f9b0befdae52b3), [`47892c8`](https://github.com/mastra-ai/mastra/commit/47892c85708eac348209f99f10f9a5f5267e11c0), [`45bb78b`](https://github.com/mastra-ai/mastra/commit/45bb78b70bd9db29678fe49476cd9f4ed01bfd0b), [`5c70aeb`](https://github.com/mastra-ai/mastra/commit/5c70aeb391434c34f9e43caa2e8572d412bcb2b0), [`70eef84`](https://github.com/mastra-ai/mastra/commit/70eef84b8f44493598fdafa2980a0e7283415eda), [`d84e52d`](https://github.com/mastra-ai/mastra/commit/d84e52d0f6511283ddd21ed5fe7f945449d0f799), [`24b80af`](https://github.com/mastra-ai/mastra/commit/24b80af87da93bb84d389340181e17b7477fa9ca), [`608e156`](https://github.com/mastra-ai/mastra/commit/608e156def954c9604c5e3f6d9dfce3bcc7aeab0), [`78d1c80`](https://github.com/mastra-ai/mastra/commit/78d1c808ad90201897a300af551bcc1d34458a20), [`2b2e157`](https://github.com/mastra-ai/mastra/commit/2b2e157a092cd597d9d3f0000d62b8bb4a7348ed), [`78d1c80`](https://github.com/mastra-ai/mastra/commit/78d1c808ad90201897a300af551bcc1d34458a20), [`59d30b5`](https://github.com/mastra-ai/mastra/commit/59d30b5d0cb44ea7a1c440e7460dfb57eac9a9b5), [`453693b`](https://github.com/mastra-ai/mastra/commit/453693bf9e265ddccecef901d50da6caaea0fbc6), [`78d1c80`](https://github.com/mastra-ai/mastra/commit/78d1c808ad90201897a300af551bcc1d34458a20), [`c204b63`](https://github.com/mastra-ai/mastra/commit/c204b632d19e66acb6d6e19b11c4540dd6ad5380), [`742a417`](https://github.com/mastra-ai/mastra/commit/742a417896088220a3b5560c354c45c5ca6d88b9)]:
  - @mastra/libsql@1.6.0
  - @mastra/core@1.6.0
  - @mastra/memory@1.5.0

## 0.2.0-alpha.0

### Minor Changes

- Added streaming tool argument previews across all tool renderers. Tool names, file paths, and commands now appear immediately as the model generates them, rather than waiting for the complete tool call. ([#13328](https://github.com/mastra-ai/mastra/pull/13328))
  - **Generic tools** show live key/value argument previews as args stream in
  - **Edit tool** renders a bordered diff preview as soon as `old_str` and `new_str` are available, even before the tool result arrives
  - **Write tool** streams syntax-highlighted file content in a bordered box while args arrive
  - **Find files** shows the glob pattern in the pending header
  - **Task write** streams items directly into the pinned task list component in real-time

  All tools use partial JSON parsing to progressively display argument information. This is enabled automatically for all Harness-based agents — no configuration required.

### Patch Changes

- Improved subagent usage guidance: subagents are now only recommended when spawning multiple in parallel, and the main agent must verify all subagent output before proceeding. ([#13339](https://github.com/mastra-ai/mastra/pull/13339))

- Updated TUI to work with the new Harness object-parameter API, ensuring all commands, approvals, and thread flows continue to function correctly. ([#13353](https://github.com/mastra-ai/mastra/pull/13353))

- Added audit-tests subagent that reviews test quality in a branch. The parent agent passes a description of the branch work along with changed files to this read-only subagent, which explores existing test conventions then audits for behavioral coverage, intent-vs-test alignment, LLM-generated test slop, redundant assertions, file organization, and missing edge cases. ([#13331](https://github.com/mastra-ai/mastra/pull/13331))

- Fixed the `/mcp` slash command always showing "MCP system not initialized" even when MCP servers were configured and working. Server status and `/mcp reload` now work as expected. ([#13311](https://github.com/mastra-ai/mastra/pull/13311))

- Improved Observational Memory activation timing by halving the buffer interval when approaching the activation threshold, producing finer-grained chunks for more precise context management. ([#13357](https://github.com/mastra-ai/mastra/pull/13357))

- Fixed stale OAuth credentials when resolving the OpenAI Codex model. Auth storage is now reloaded before each model resolution, preventing authentication failures after token refresh. ([#13307](https://github.com/mastra-ai/mastra/pull/13307))

- Improved TUI composability for external consumers by exposing a structured `TUIState` interface and `createTUIState` factory. ([#13350](https://github.com/mastra-ai/mastra/pull/13350))

- Added AGENTS.md to the instruction file loader so projects created by create-mastra are automatically picked up. Removed support for the deprecated AGENT.md (singular) convention. ([#13346](https://github.com/mastra-ai/mastra/pull/13346))

- Fixed an issue where memory activation could shrink the message window too aggressively due to a token counting inaccuracy, resulting in very small context windows (~300 tokens). Temporarily raised the buffer activation threshold to prevent this. ([#13349](https://github.com/mastra-ai/mastra/pull/13349))

- Fixed assistant message text disappearing when todo_write tool calls were made during streaming ([#13335](https://github.com/mastra-ai/mastra/pull/13335))

- Fixed the view tool to gracefully handle view_range when viewing directories. Previously, passing view_range with a directory path would throw an error, and passing undefined values would fail schema validation. Now, view_range slices the directory listing to show a subset of entries, enabling pagination through large directories. ([#13355](https://github.com/mastra-ai/mastra/pull/13355))

- Updated README with current installation instructions for npm, pnpm, and Homebrew. ([#13294](https://github.com/mastra-ai/mastra/pull/13294))

- Simplified the MCP management API by replacing the `MCPManager` class with a `createMcpManager()` factory function. All existing behavior (TUI `/mcp` command, tool collection, config merging) is preserved. ([#13347](https://github.com/mastra-ai/mastra/pull/13347))

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

- Migrated from todo_write/todo_check tools to the new built-in task_write/task_check tools from @mastra/core/harness. Renamed all todo terminology to task across prompts, TUI components, and agent configurations. ([#13344](https://github.com/mastra-ai/mastra/pull/13344))

- Fixed Observational Memory status not updating during conversations. The harness was missing streaming handlers for OM data chunks (status, observation start/end, buffering, activation), so the TUI never received real-time OM progress updates. Also added switchObserverModel and switchReflectorModel methods so changing OM models properly emits events to subscribers. ([#13330](https://github.com/mastra-ai/mastra/pull/13330))

- Fixed Ctrl+F follow-up queueing to resolve autocomplete suggestions before reading editor text, so partially typed slash commands (e.g. /rev) are expanded to their full form (e.g. /review). Slash commands queued via Ctrl+F are now properly processed through the slash command handler after the agent finishes, instead of being sent as raw text to the LLM. ([#13345](https://github.com/mastra-ai/mastra/pull/13345))

- Reduced tool result token limits to prevent oversized responses. Lowered file view and grep token limits from 3,000 to 2,000 tokens. Added 2,000 token truncation to web search and web extract tools, which previously returned unbounded results. ([#13348](https://github.com/mastra-ai/mastra/pull/13348))

- Fixed thread resuming in git worktrees. Previously, starting mastracode in a new worktree would resume a thread from another worktree of the same repo. Threads are now auto-tagged with the project path and filtered on resume so each worktree gets its own thread scope. ([#13343](https://github.com/mastra-ai/mastra/pull/13343))

- Updated dependencies [[`5c70aeb`](https://github.com/mastra-ai/mastra/commit/5c70aeb391434c34f9e43caa2e8572d412bcb2b0), [`0d9efb4`](https://github.com/mastra-ai/mastra/commit/0d9efb47992c34aa90581c18b9f51f774f6252a5), [`5caa13d`](https://github.com/mastra-ai/mastra/commit/5caa13d1b2a496e2565ab124a11de9a51ad3e3b9), [`270dd16`](https://github.com/mastra-ai/mastra/commit/270dd168a86698a699d8a9de8dbce1a40f72d862), [`940163f`](https://github.com/mastra-ai/mastra/commit/940163fc492401d7562301e6f106ccef4fefe06f), [`5c70aeb`](https://github.com/mastra-ai/mastra/commit/5c70aeb391434c34f9e43caa2e8572d412bcb2b0), [`b260123`](https://github.com/mastra-ai/mastra/commit/b2601234bd093d358c92081a58f9b0befdae52b3), [`47892c8`](https://github.com/mastra-ai/mastra/commit/47892c85708eac348209f99f10f9a5f5267e11c0), [`45bb78b`](https://github.com/mastra-ai/mastra/commit/45bb78b70bd9db29678fe49476cd9f4ed01bfd0b), [`5c70aeb`](https://github.com/mastra-ai/mastra/commit/5c70aeb391434c34f9e43caa2e8572d412bcb2b0), [`70eef84`](https://github.com/mastra-ai/mastra/commit/70eef84b8f44493598fdafa2980a0e7283415eda), [`d84e52d`](https://github.com/mastra-ai/mastra/commit/d84e52d0f6511283ddd21ed5fe7f945449d0f799), [`24b80af`](https://github.com/mastra-ai/mastra/commit/24b80af87da93bb84d389340181e17b7477fa9ca), [`608e156`](https://github.com/mastra-ai/mastra/commit/608e156def954c9604c5e3f6d9dfce3bcc7aeab0), [`78d1c80`](https://github.com/mastra-ai/mastra/commit/78d1c808ad90201897a300af551bcc1d34458a20), [`2b2e157`](https://github.com/mastra-ai/mastra/commit/2b2e157a092cd597d9d3f0000d62b8bb4a7348ed), [`78d1c80`](https://github.com/mastra-ai/mastra/commit/78d1c808ad90201897a300af551bcc1d34458a20), [`59d30b5`](https://github.com/mastra-ai/mastra/commit/59d30b5d0cb44ea7a1c440e7460dfb57eac9a9b5), [`453693b`](https://github.com/mastra-ai/mastra/commit/453693bf9e265ddccecef901d50da6caaea0fbc6), [`78d1c80`](https://github.com/mastra-ai/mastra/commit/78d1c808ad90201897a300af551bcc1d34458a20), [`c204b63`](https://github.com/mastra-ai/mastra/commit/c204b632d19e66acb6d6e19b11c4540dd6ad5380), [`742a417`](https://github.com/mastra-ai/mastra/commit/742a417896088220a3b5560c354c45c5ca6d88b9)]:
  - @mastra/libsql@1.6.0-alpha.0
  - @mastra/core@1.6.0-alpha.0
  - @mastra/memory@1.5.0-alpha.0

## 0.1.0

### Minor Changes

- Added a separate export path for the TUI at `mastracode/tui`, so consumers can cleanly import MastraTUI and related components without reaching into internals. ([#13255](https://github.com/mastra-ai/mastra/pull/13255))

  ```ts
  import { MastraTUI, type MastraTUIOptions } from 'mastracode/tui';
  import { theme, setTheme, ModelSelectorComponent } from 'mastracode/tui';
  ```

- Migrated MastraCode from the prototype harness to the generic CoreHarness from @mastra/core. The createMastraCode function is now fully configurable with optional parameters for modes, subagents, storage, tools, and more. Removed the deprecated prototype harness implementation. ([#13245](https://github.com/mastra-ai/mastra/pull/13245))

### Patch Changes

- Added generic Harness class to @mastra/core for orchestrating agents with modes, state management, built-in tools (ask_user, submit_plan), subagent support, Observational Memory integration, model discovery, and permission-aware tool approval. The Harness provides a reusable foundation for building agent-powered applications with features like thread management, heartbeat monitoring, and event-driven architecture. ([#13245](https://github.com/mastra-ai/mastra/pull/13245))

- fix(schema-compat): fix zodToJsonSchema routing for v3/v4 Zod schemas ([#13253](https://github.com/mastra-ai/mastra/pull/13253))

  The `zodToJsonSchema` function now reliably detects and routes Zod v3 vs v4 schemas regardless of which version the ambient `zod` import resolves to. Previously, the detection relied on checking `'toJSONSchema' in z` against the ambient `z` import, which could resolve to either v3 or v4 depending on the environment (monorepo vs global install). This caused v3 schemas to be passed to v4's `toJSONSchema()` (crashing with "Cannot read properties of undefined (reading 'def')") or v4 schemas to be passed to the v3 converter (producing schemas missing the `type` field).

  The fix explicitly imports `z as zV4` from `zod/v4` and routes based on the schema's own `_zod` property, making the behavior environment-independent.

  Also migrates all mastracode tool files from `zod/v3` to `zod` imports now that the schema-compat fix supports both versions correctly.

- Fixed mastracode crashing on startup with ERR_MODULE_NOT_FOUND for vscode-jsonrpc/node. Node.js ESM requires explicit .js extensions on subpath imports. ([#13250](https://github.com/mastra-ai/mastra/pull/13250))

- Updated dependencies [[`252580a`](https://github.com/mastra-ai/mastra/commit/252580a71feb0e46d0ccab04a70a79ff6a2ee0ab), [`f8e819f`](https://github.com/mastra-ai/mastra/commit/f8e819fabdfdc43d2da546a3ad81ba23685f603d), [`f8e819f`](https://github.com/mastra-ai/mastra/commit/f8e819fabdfdc43d2da546a3ad81ba23685f603d), [`5c75261`](https://github.com/mastra-ai/mastra/commit/5c7526120d936757d4ffb7b82232e1641ebd45cb), [`e27d832`](https://github.com/mastra-ai/mastra/commit/e27d83281b5e166fd63a13969689e928d8605944), [`e37ef84`](https://github.com/mastra-ai/mastra/commit/e37ef8404043c94ca0c8e35ecdedb093b8087878), [`6fdd3d4`](https://github.com/mastra-ai/mastra/commit/6fdd3d451a07a8e7e216c62ac364f8dd8e36c2af), [`10cf521`](https://github.com/mastra-ai/mastra/commit/10cf52183344743a0d7babe24cd24fd78870c354), [`6fdd3d4`](https://github.com/mastra-ai/mastra/commit/6fdd3d451a07a8e7e216c62ac364f8dd8e36c2af), [`efdb682`](https://github.com/mastra-ai/mastra/commit/efdb682887f6522149769383908f9790c188ab88), [`0dee7a0`](https://github.com/mastra-ai/mastra/commit/0dee7a0ff4c2507e6eb6e6ee5f9738877ebd4ad1), [`04c2c8e`](https://github.com/mastra-ai/mastra/commit/04c2c8e888984364194131aecb490a3d6e920e61), [`02dc07a`](https://github.com/mastra-ai/mastra/commit/02dc07acc4ad42d93335825e3308f5b42266eba2), [`8650e4d`](https://github.com/mastra-ai/mastra/commit/8650e4d3579a2c3a13e2dba7ec6ee7c82c7f61a8), [`bd222d3`](https://github.com/mastra-ai/mastra/commit/bd222d39e292bfcc4a2d9a9e6ec3976cc5a4f22f), [`bb7262b`](https://github.com/mastra-ai/mastra/commit/bb7262b7c0ca76320d985b40510b6ffbbb936582), [`cf1c6e7`](https://github.com/mastra-ai/mastra/commit/cf1c6e789b131f55638fed52183a89d5078b4876), [`5ffadfe`](https://github.com/mastra-ai/mastra/commit/5ffadfefb1468ac2612b20bb84d24c39de6961c0), [`1e1339c`](https://github.com/mastra-ai/mastra/commit/1e1339cc276e571a48cfff5014487877086bfe68), [`ffa5468`](https://github.com/mastra-ai/mastra/commit/ffa546857fc4821753979b3a34e13b4d76fbbcd4), [`d03df73`](https://github.com/mastra-ai/mastra/commit/d03df73f8fe9496064a33e1c3b74ba0479bf9ee6), [`79b8f45`](https://github.com/mastra-ai/mastra/commit/79b8f45a6767e1a5c3d56cd3c5b1214326b81661), [`9bbf08e`](https://github.com/mastra-ai/mastra/commit/9bbf08e3c20731c79dea13a765895b9fcf29cbf1), [`0a25952`](https://github.com/mastra-ai/mastra/commit/0a259526b5e1ac11e6efa53db1f140272962af2d), [`ffa5468`](https://github.com/mastra-ai/mastra/commit/ffa546857fc4821753979b3a34e13b4d76fbbcd4), [`3264a04`](https://github.com/mastra-ai/mastra/commit/3264a04e30340c3c5447433300a035ea0878df85), [`6fdd3d4`](https://github.com/mastra-ai/mastra/commit/6fdd3d451a07a8e7e216c62ac364f8dd8e36c2af), [`6fdd3d4`](https://github.com/mastra-ai/mastra/commit/6fdd3d451a07a8e7e216c62ac364f8dd8e36c2af), [`088d9ba`](https://github.com/mastra-ai/mastra/commit/088d9ba2577518703c52b0dccd617178d9ee6b0d), [`74fbebd`](https://github.com/mastra-ai/mastra/commit/74fbebd918a03832a2864965a8bea59bf617d3a2), [`74fbebd`](https://github.com/mastra-ai/mastra/commit/74fbebd918a03832a2864965a8bea59bf617d3a2), [`aea6217`](https://github.com/mastra-ai/mastra/commit/aea621790bfb2291431b08da0cc5e6e150303ae7), [`b6a855e`](https://github.com/mastra-ai/mastra/commit/b6a855edc056e088279075506442ba1d6fa6def9), [`ae408ea`](https://github.com/mastra-ai/mastra/commit/ae408ea7128f0d2710b78d8623185198e7cb19c1), [`17e942e`](https://github.com/mastra-ai/mastra/commit/17e942eee2ba44985b1f807e6208cdde672f82f9), [`2015cf9`](https://github.com/mastra-ai/mastra/commit/2015cf921649f44c3f5bcd32a2c052335f8e49b4), [`7ef454e`](https://github.com/mastra-ai/mastra/commit/7ef454eaf9dcec6de60021c8f42192052dd490d6), [`2be1d99`](https://github.com/mastra-ai/mastra/commit/2be1d99564ce79acc4846071082bff353035a87a), [`2708fa1`](https://github.com/mastra-ai/mastra/commit/2708fa1055ac91c03e08b598869f6b8fb51fa37f), [`ba74aef`](https://github.com/mastra-ai/mastra/commit/ba74aef5716142dbbe931351f5243c9c6e4128a9), [`ba74aef`](https://github.com/mastra-ai/mastra/commit/ba74aef5716142dbbe931351f5243c9c6e4128a9), [`ec53e89`](https://github.com/mastra-ai/mastra/commit/ec53e8939c76c638991e21af762e51378eff7543), [`9b5a8cb`](https://github.com/mastra-ai/mastra/commit/9b5a8cb13e120811b0bf14140ada314f1c067894), [`607e66b`](https://github.com/mastra-ai/mastra/commit/607e66b02dc7f531ee37799f3456aa2dc0ca7ac5), [`a215d06`](https://github.com/mastra-ai/mastra/commit/a215d06758dcf590eabfe0b7afd4ae39bdbf082c), [`6909c74`](https://github.com/mastra-ai/mastra/commit/6909c74a7781e0447d475e9dbc1dc871b700f426), [`192438f`](https://github.com/mastra-ai/mastra/commit/192438f8a90c4f375e955f8ff179bf8dc6821a83)]:
  - @mastra/core@1.5.0
  - @mastra/memory@1.4.0
  - @mastra/libsql@1.5.0

## 0.1.0-alpha.3

### Minor Changes

- Added a separate export path for the TUI at `mastracode/tui`, so consumers can cleanly import MastraTUI and related components without reaching into internals. ([#13255](https://github.com/mastra-ai/mastra/pull/13255))

  ```ts
  import { MastraTUI, type MastraTUIOptions } from 'mastracode/tui';
  import { theme, setTheme, ModelSelectorComponent } from 'mastracode/tui';
  ```

## 0.1.0-alpha.2

### Patch Changes

- fix(schema-compat): fix zodToJsonSchema routing for v3/v4 Zod schemas ([#13253](https://github.com/mastra-ai/mastra/pull/13253))

  The `zodToJsonSchema` function now reliably detects and routes Zod v3 vs v4 schemas regardless of which version the ambient `zod` import resolves to. Previously, the detection relied on checking `'toJSONSchema' in z` against the ambient `z` import, which could resolve to either v3 or v4 depending on the environment (monorepo vs global install). This caused v3 schemas to be passed to v4's `toJSONSchema()` (crashing with "Cannot read properties of undefined (reading 'def')") or v4 schemas to be passed to the v3 converter (producing schemas missing the `type` field).

  The fix explicitly imports `z as zV4` from `zod/v4` and routes based on the schema's own `_zod` property, making the behavior environment-independent.

  Also migrates all mastracode tool files from `zod/v3` to `zod` imports now that the schema-compat fix supports both versions correctly.

- Updated dependencies:
  - @mastra/core@1.5.0-alpha.1
  - @mastra/memory@1.4.0-alpha.1

## 0.1.0-alpha.1

### Patch Changes

- Fixed mastracode crashing on startup with ERR_MODULE_NOT_FOUND for vscode-jsonrpc/node. Node.js ESM requires explicit .js extensions on subpath imports. ([#13250](https://github.com/mastra-ai/mastra/pull/13250))

## 0.1.0-alpha.0

### Minor Changes

- Migrated MastraCode from the prototype harness to the generic CoreHarness from @mastra/core. The createMastraCode function is now fully configurable with optional parameters for modes, subagents, storage, tools, and more. Removed the deprecated prototype harness implementation. ([#13245](https://github.com/mastra-ai/mastra/pull/13245))

### Patch Changes

- Added generic Harness class to @mastra/core for orchestrating agents with modes, state management, built-in tools (ask_user, submit_plan), subagent support, Observational Memory integration, model discovery, and permission-aware tool approval. The Harness provides a reusable foundation for building agent-powered applications with features like thread management, heartbeat monitoring, and event-driven architecture. ([#13245](https://github.com/mastra-ai/mastra/pull/13245))

- Updated dependencies [[`252580a`](https://github.com/mastra-ai/mastra/commit/252580a71feb0e46d0ccab04a70a79ff6a2ee0ab), [`f8e819f`](https://github.com/mastra-ai/mastra/commit/f8e819fabdfdc43d2da546a3ad81ba23685f603d), [`f8e819f`](https://github.com/mastra-ai/mastra/commit/f8e819fabdfdc43d2da546a3ad81ba23685f603d), [`5c75261`](https://github.com/mastra-ai/mastra/commit/5c7526120d936757d4ffb7b82232e1641ebd45cb), [`e27d832`](https://github.com/mastra-ai/mastra/commit/e27d83281b5e166fd63a13969689e928d8605944), [`e37ef84`](https://github.com/mastra-ai/mastra/commit/e37ef8404043c94ca0c8e35ecdedb093b8087878), [`6fdd3d4`](https://github.com/mastra-ai/mastra/commit/6fdd3d451a07a8e7e216c62ac364f8dd8e36c2af), [`10cf521`](https://github.com/mastra-ai/mastra/commit/10cf52183344743a0d7babe24cd24fd78870c354), [`6fdd3d4`](https://github.com/mastra-ai/mastra/commit/6fdd3d451a07a8e7e216c62ac364f8dd8e36c2af), [`efdb682`](https://github.com/mastra-ai/mastra/commit/efdb682887f6522149769383908f9790c188ab88), [`0dee7a0`](https://github.com/mastra-ai/mastra/commit/0dee7a0ff4c2507e6eb6e6ee5f9738877ebd4ad1), [`04c2c8e`](https://github.com/mastra-ai/mastra/commit/04c2c8e888984364194131aecb490a3d6e920e61), [`02dc07a`](https://github.com/mastra-ai/mastra/commit/02dc07acc4ad42d93335825e3308f5b42266eba2), [`8650e4d`](https://github.com/mastra-ai/mastra/commit/8650e4d3579a2c3a13e2dba7ec6ee7c82c7f61a8), [`bd222d3`](https://github.com/mastra-ai/mastra/commit/bd222d39e292bfcc4a2d9a9e6ec3976cc5a4f22f), [`bb7262b`](https://github.com/mastra-ai/mastra/commit/bb7262b7c0ca76320d985b40510b6ffbbb936582), [`cf1c6e7`](https://github.com/mastra-ai/mastra/commit/cf1c6e789b131f55638fed52183a89d5078b4876), [`5ffadfe`](https://github.com/mastra-ai/mastra/commit/5ffadfefb1468ac2612b20bb84d24c39de6961c0), [`1e1339c`](https://github.com/mastra-ai/mastra/commit/1e1339cc276e571a48cfff5014487877086bfe68), [`ffa5468`](https://github.com/mastra-ai/mastra/commit/ffa546857fc4821753979b3a34e13b4d76fbbcd4), [`d03df73`](https://github.com/mastra-ai/mastra/commit/d03df73f8fe9496064a33e1c3b74ba0479bf9ee6), [`79b8f45`](https://github.com/mastra-ai/mastra/commit/79b8f45a6767e1a5c3d56cd3c5b1214326b81661), [`9bbf08e`](https://github.com/mastra-ai/mastra/commit/9bbf08e3c20731c79dea13a765895b9fcf29cbf1), [`0a25952`](https://github.com/mastra-ai/mastra/commit/0a259526b5e1ac11e6efa53db1f140272962af2d), [`ffa5468`](https://github.com/mastra-ai/mastra/commit/ffa546857fc4821753979b3a34e13b4d76fbbcd4), [`3264a04`](https://github.com/mastra-ai/mastra/commit/3264a04e30340c3c5447433300a035ea0878df85), [`6fdd3d4`](https://github.com/mastra-ai/mastra/commit/6fdd3d451a07a8e7e216c62ac364f8dd8e36c2af), [`6fdd3d4`](https://github.com/mastra-ai/mastra/commit/6fdd3d451a07a8e7e216c62ac364f8dd8e36c2af), [`088d9ba`](https://github.com/mastra-ai/mastra/commit/088d9ba2577518703c52b0dccd617178d9ee6b0d), [`74fbebd`](https://github.com/mastra-ai/mastra/commit/74fbebd918a03832a2864965a8bea59bf617d3a2), [`74fbebd`](https://github.com/mastra-ai/mastra/commit/74fbebd918a03832a2864965a8bea59bf617d3a2), [`aea6217`](https://github.com/mastra-ai/mastra/commit/aea621790bfb2291431b08da0cc5e6e150303ae7), [`b6a855e`](https://github.com/mastra-ai/mastra/commit/b6a855edc056e088279075506442ba1d6fa6def9), [`ae408ea`](https://github.com/mastra-ai/mastra/commit/ae408ea7128f0d2710b78d8623185198e7cb19c1), [`17e942e`](https://github.com/mastra-ai/mastra/commit/17e942eee2ba44985b1f807e6208cdde672f82f9), [`2015cf9`](https://github.com/mastra-ai/mastra/commit/2015cf921649f44c3f5bcd32a2c052335f8e49b4), [`7ef454e`](https://github.com/mastra-ai/mastra/commit/7ef454eaf9dcec6de60021c8f42192052dd490d6), [`2be1d99`](https://github.com/mastra-ai/mastra/commit/2be1d99564ce79acc4846071082bff353035a87a), [`2708fa1`](https://github.com/mastra-ai/mastra/commit/2708fa1055ac91c03e08b598869f6b8fb51fa37f), [`ba74aef`](https://github.com/mastra-ai/mastra/commit/ba74aef5716142dbbe931351f5243c9c6e4128a9), [`ba74aef`](https://github.com/mastra-ai/mastra/commit/ba74aef5716142dbbe931351f5243c9c6e4128a9), [`ec53e89`](https://github.com/mastra-ai/mastra/commit/ec53e8939c76c638991e21af762e51378eff7543), [`9b5a8cb`](https://github.com/mastra-ai/mastra/commit/9b5a8cb13e120811b0bf14140ada314f1c067894), [`607e66b`](https://github.com/mastra-ai/mastra/commit/607e66b02dc7f531ee37799f3456aa2dc0ca7ac5), [`a215d06`](https://github.com/mastra-ai/mastra/commit/a215d06758dcf590eabfe0b7afd4ae39bdbf082c), [`6909c74`](https://github.com/mastra-ai/mastra/commit/6909c74a7781e0447d475e9dbc1dc871b700f426), [`192438f`](https://github.com/mastra-ai/mastra/commit/192438f8a90c4f375e955f8ff179bf8dc6821a83)]:
  - @mastra/core@1.5.0-alpha.0
  - @mastra/memory@1.4.0-alpha.0
  - @mastra/libsql@1.5.0-alpha.0
