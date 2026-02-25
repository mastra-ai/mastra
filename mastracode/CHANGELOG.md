# mastracode

## 0.4.0-alpha.0

### Minor Changes

- Added light theme support and automatic terminal theme detection. Mastra Code now detects your terminal's color scheme and applies a matching dark or light theme. Use the new `/theme` slash command to switch between `auto`, `dark`, and `light` modes. The choice is persisted across sessions. You can also set the `MASTRA_THEME` environment variable to override the detected theme. ([#13487](https://github.com/mastra-ai/mastra/pull/13487))

  ```sh
  # Switch theme at runtime via slash command
  /theme auto    # detect from terminal background
  /theme dark    # force dark theme
  /theme light   # force light theme

  # Or override via environment variable
  MASTRA_THEME=light mastracode
  ```

- Added reasoning effort support for OpenAI Codex models. The `/think` command now controls the reasoning depth (off, low, medium, high, xhigh) sent to the Codex API via the `reasoningEffort` parameter. Without this, gpt-5.3-codex skips tool calls and narrates instead of acting. ([#13490](https://github.com/mastra-ai/mastra/pull/13490))

  **Other improvements:**
  - `/think` now shows an inline selector list when run without arguments, or accepts a level directly (e.g. `/think high`)
  - Dropped `minimal` level (was redundantly mapping to same API value as `low`)
  - Added `xhigh` level for GPT-5.2+ and Codex models
  - Provider-specific values (e.g. `none`, `xhigh`) shown next to labels when an OpenAI model is selected
  - Switching to an OpenAI model pack auto-enables reasoning at `low` if it was off
  - Updated default Codex model from gpt-5.2 to gpt-5.3
  - Shows a warning when the current model doesn't support reasoning

### Patch Changes

- Added Claude Max OAuth warning for Anthropic authentication ([#13505](https://github.com/mastra-ai/mastra/pull/13505))

  A warning now appears when authenticating with Anthropic via OAuth, alerting that using a Claude Max subscription through OAuth is a grey area that may violate Anthropic's Terms of Service.
  - During `/login` or onboarding: **Continue** proceeds with OAuth, **Cancel** returns to the provider selection screen.
  - At startup (when existing Anthropic OAuth credentials are detected and the warning has not been acknowledged): **Continue** keeps credentials, **Remove OAuth** logs out from Anthropic.
  - The startup warning only appears once — acknowledging it persists the choice in settings.

- Fixed `/skills` so it lists skills even before the first message is sent. ([#13457](https://github.com/mastra-ai/mastra/pull/13457))

- Fixed `@` file autocomplete so fuzzy file search works when `fd` or `fdfind` is installed. ([#13460](https://github.com/mastra-ai/mastra/pull/13460))

- Fixed onboarding to allow API-key-only setup without requiring OAuth login. Previously, users with API keys configured as environment variables were blocked at the model pack selection step if they skipped OAuth login during onboarding. The auth step now clearly indicates that OAuth is optional when API keys are set. ([#13500](https://github.com/mastra-ai/mastra/pull/13500))

- Updated default observational memory settings: bufferTokens 1/5, bufferActivation 2000, blockAfter 2. ([#13476](https://github.com/mastra-ai/mastra/pull/13476))

- Fixed a fatal crash on startup that caused the TUI to fail immediately on launch. ([#13503](https://github.com/mastra-ai/mastra/pull/13503))

- Fixed stale git branch in system prompt and TUI status bar. The branch is now refreshed on every agent request and when switching threads, so both the system prompt and status bar reflect the current branch. Also improved the status line to show abbreviated branch names instead of hiding the branch entirely when the name is too long. ([#13456](https://github.com/mastra-ai/mastra/pull/13456))

- Fixed Mastra Code TUI hook triggering so `Stop` runs on every `agent_end` reason (`complete`, `aborted`, `error`) and `UserPromptSubmit` runs before sending non-command user prompts with block handling. ([#13442](https://github.com/mastra-ai/mastra/pull/13442))

- Updated thinking-level labels in Mastra Code UI to be provider-aware for OpenAI models. ([#13490](https://github.com/mastra-ai/mastra/pull/13490))
  - `/think` and Settings now use shared label metadata
  - OpenAI models show provider-specific labels (for example, `Very High (xhigh)`)
  - Stored `thinkingLevel` values remain unchanged (`off`, `low`, `medium`, `high`, `xhigh`)

- Strengthened the Anthropic Claude Max OAuth warning language to explicitly call out account-ban risk and potential Terms of Service violations before users continue with OAuth. ([#13508](https://github.com/mastra-ai/mastra/pull/13508))

- Fixed slash command arguments being silently discarded when the command template doesn't use $ARGUMENTS or positional variables ($1, $2, etc.). Arguments are now appended to the output so the model can see what the user provided. ([#13493](https://github.com/mastra-ai/mastra/pull/13493))

- Updated dependencies [[`df170fd`](https://github.com/mastra-ai/mastra/commit/df170fd139b55f845bfd2de8488b16435bd3d0da), [`ae55343`](https://github.com/mastra-ai/mastra/commit/ae5534397fc006fd6eef3e4f80c235bcdc9289ef), [`b8621e2`](https://github.com/mastra-ai/mastra/commit/b8621e25e70cae69a9343353f878a9112493a2fe), [`c290cec`](https://github.com/mastra-ai/mastra/commit/c290cec5bf9107225de42942b56b487107aa9dce), [`c290cec`](https://github.com/mastra-ai/mastra/commit/c290cec5bf9107225de42942b56b487107aa9dce), [`f03e794`](https://github.com/mastra-ai/mastra/commit/f03e794630f812b56e95aad54f7b1993dc003add), [`aa4a5ae`](https://github.com/mastra-ai/mastra/commit/aa4a5aedb80d8d6837bab8cbb2e301215d1ba3e9), [`de3f584`](https://github.com/mastra-ai/mastra/commit/de3f58408752a8d80a295275c7f23fc306cf7f4f), [`74ae019`](https://github.com/mastra-ai/mastra/commit/74ae0197a6895f8897c369038c643d7e32dd84c2), [`d3fb010`](https://github.com/mastra-ai/mastra/commit/d3fb010c98f575f1c0614452667396e2653815f6), [`702ee1c`](https://github.com/mastra-ai/mastra/commit/702ee1c41be67cc532b4dbe89bcb62143508f6f0), [`f495051`](https://github.com/mastra-ai/mastra/commit/f495051eb6496a720f637fc85b6d69941c12554c), [`60b45e0`](https://github.com/mastra-ai/mastra/commit/60b45e0af29485c69f70f77b15d6643aaa5a9da7), [`e622f1d`](https://github.com/mastra-ai/mastra/commit/e622f1d3ab346a8e6aca6d1fe2eac99bd961e50b), [`861f111`](https://github.com/mastra-ai/mastra/commit/861f11189211b20ddb70d8df81a6b901fc78d11e), [`00f43e8`](https://github.com/mastra-ai/mastra/commit/00f43e8e97a80c82b27d5bd30494f10a715a1df9), [`1b6f651`](https://github.com/mastra-ai/mastra/commit/1b6f65127d4a0d6c38d0a1055cb84527db529d6b), [`96a1702`](https://github.com/mastra-ai/mastra/commit/96a1702ce362c50dda20c8b4a228b4ad1a36a17a), [`cb9f921`](https://github.com/mastra-ai/mastra/commit/cb9f921320913975657abb1404855d8c510f7ac5), [`114e7c1`](https://github.com/mastra-ai/mastra/commit/114e7c146ac682925f0fb37376c1be70e5d6e6e5), [`cb9f921`](https://github.com/mastra-ai/mastra/commit/cb9f921320913975657abb1404855d8c510f7ac5), [`1b6f651`](https://github.com/mastra-ai/mastra/commit/1b6f65127d4a0d6c38d0a1055cb84527db529d6b), [`c290cec`](https://github.com/mastra-ai/mastra/commit/c290cec5bf9107225de42942b56b487107aa9dce), [`72df4a8`](https://github.com/mastra-ai/mastra/commit/72df4a8f9bf1a20cfd3d9006a4fdb597ad56d10a)]:
  - @mastra/core@1.8.0-alpha.0
  - @mastra/mcp@1.0.2-alpha.0
  - @mastra/pg@1.7.0-alpha.0
  - @mastra/libsql@1.6.2-alpha.0
  - @mastra/memory@1.5.2-alpha.0

## 0.3.0

### Minor Changes

- Added interactive onboarding flow for first-time setup ([#13421](https://github.com/mastra-ai/mastra/pull/13421))

  **Setup wizard** — On first launch, an interactive wizard guides you through:
  - Authenticating with AI providers (Claude Max, OpenAI Codex)
  - Choosing a model pack (Varied, Anthropic, OpenAI, or Custom)
  - Selecting an observational memory model
  - Enabling or disabling YOLO mode (auto-approve tool calls)

  **Global settings** — Your preferences are now saved to `settings.json` in the app data directory and automatically applied to new threads. Model pack selections reference pack IDs so you get new model versions automatically.

  **Custom model packs** — Choose "Custom" to pick a specific model for each mode (plan/build/fast). Saved custom packs appear when re-running `/setup`.

  **`/setup` command** — Re-run the setup wizard anytime. Previously chosen options are highlighted with "(current)" indicators.

  **Settings migration** — Model-related data previously stored in `auth.json` (`_modelRanks`, `_modeModelId_*`, `_subagentModelId*`) is automatically migrated to `settings.json` on first load.

- Added storage backend configuration to `/settings` with PostgreSQL opt-in and remote LibSQL support. ([#13435](https://github.com/mastra-ai/mastra/pull/13435))

  **Selecting a backend**

  Switch storage backends through the `/settings` command (Storage backend option) or by setting the `MASTRA_STORAGE_BACKEND` environment variable. LibSQL remains the default — no changes needed for existing setups. Both backends prompt for a connection URL interactively after selection.

  **Remote LibSQL (Turso)**

  Select LibSQL in `/settings` and enter a remote Turso URL (e.g. `libsql://your-db.turso.io`). Leave empty to keep the default local file database. Can also be set via environment variable:

  ```sh
  export MASTRA_DB_URL="libsql://your-db.turso.io"
  export MASTRA_DB_AUTH_TOKEN="your-token"
  ```

  **PostgreSQL configuration**

  Select PostgreSQL in `/settings` and enter a connection string, or configure via environment variables:

  ```sh
  export MASTRA_STORAGE_BACKEND=pg
  export MASTRA_PG_CONNECTION_STRING="postgresql://user:pass@localhost:5432/db"
  ```

  If the PostgreSQL connection fails on startup, mastracode falls back to the local LibSQL database and shows a warning so you can fix the connection via `/settings`.

  Optional PostgreSQL settings include `schemaName`, `disableInit`, and `skipDefaultIndexes`.

- Added model name to Co-Authored-By in commit messages. Commits now include the active model (e.g. `Co-Authored-By: Mastra Code (anthropic/claude-opus-4-6) <noreply@mastra.ai>`) for traceability when switching between models. Falls back to the original static format when no model is set. ([#13376](https://github.com/mastra-ai/mastra/pull/13376))

### Patch Changes

- Fixed plan mode agent to properly call submit_plan tool. The agent was generating text descriptions instead of calling the tool. Fixed by: creating dynamic mode-specific tool guidance with correct tool names, clarifying tool vs text usage with explicit exceptions for communication tools, and strengthening submit_plan call instructions with urgent language and code examples. ([#13416](https://github.com/mastra-ai/mastra/pull/13416))

- Updated `/cost` and `/diff` commands to read token usage, memory progress, and modified files from the Harness display state instead of maintaining separate local copies. Moved shared type definitions (`OMProgressState`, `OMStatus`, `OMBufferedStatus`) to `@mastra/core/harness` and re-exported them for backward compatibility. ([#13427](https://github.com/mastra-ai/mastra/pull/13427))

- Exclude hidden files from directory listings ([#13384](https://github.com/mastra-ai/mastra/pull/13384))

- Consolidated keyboard shortcuts and commands into a `/help` overlay. The header now shows a compact hint line (`⇧Tab mode · /help info & shortcuts`) instead of 3 lines of keybinding instructions. Running `/help` opens a styled overlay with all commands and shortcuts. ([#13426](https://github.com/mastra-ai/mastra/pull/13426))

- Improved TUI maintainability by modularizing the main TUI class into focused modules: event handlers, command dispatchers, status line rendering, message rendering, error display, shell passthrough, and setup logic. Reduced the main TUI file from ~4,760 lines to 449 lines with no changes to user-facing behavior. ([#13413](https://github.com/mastra-ai/mastra/pull/13413))

- Added styled ASCII art banner header to the TUI with purple gradient and project frontmatter display. The banner shows "MASTRA CODE" in block letters for wide terminals, "MASTRA" for medium terminals, and falls back to a compact single line for narrow terminals. Project info (name, resource ID, branch, user) now renders inside the TUI header instead of via console.info before startup. ([#13422](https://github.com/mastra-ai/mastra/pull/13422))

- LSP now shows correct diagnostics for TypeScript and JavaScript files ([#13385](https://github.com/mastra-ai/mastra/pull/13385))

- Updated dependencies [[`551dc24`](https://github.com/mastra-ai/mastra/commit/551dc2445ffb6efa05eb268e8ab700bcd34ed39c), [`e8afc44`](https://github.com/mastra-ai/mastra/commit/e8afc44a41f24ffe8b8ae4a5ee27cfddbe7934a6), [`24284ff`](https://github.com/mastra-ai/mastra/commit/24284ffae306ddf0ab83273e13f033520839ef40), [`f5097cc`](https://github.com/mastra-ai/mastra/commit/f5097cc8a813c82c3378882c31178320cadeb655), [`71e237f`](https://github.com/mastra-ai/mastra/commit/71e237fa852a3ad9a50a3ddb3b5f3b20b9a8181c), [`c2e02f1`](https://github.com/mastra-ai/mastra/commit/c2e02f181843cbda8db6fd893adce85edc0f8742), [`13a291e`](https://github.com/mastra-ai/mastra/commit/13a291ebb9f9bca80befa0d9166b916bb348e8e9), [`397af5a`](https://github.com/mastra-ai/mastra/commit/397af5a69f34d4157f51a7c8da3f1ded1e1d611c), [`d4701f7`](https://github.com/mastra-ai/mastra/commit/d4701f7e24822b081b70f9c806c39411b1a712e7), [`2b40831`](https://github.com/mastra-ai/mastra/commit/2b40831dcca2275c9570ddf09b7f25ba3e8dc7fc), [`6184727`](https://github.com/mastra-ai/mastra/commit/6184727e812bf7a65cee209bacec3a2f5a16e923), [`0c338b8`](https://github.com/mastra-ai/mastra/commit/0c338b87362dcd95ff8191ca00df645b6953f534), [`6f6385b`](https://github.com/mastra-ai/mastra/commit/6f6385be5b33687cd21e71fc27e972e6928bb34c), [`14aba61`](https://github.com/mastra-ai/mastra/commit/14aba61b9cff76d72bc7ef6f3a83ae2c5d059193), [`dd9dd1c`](https://github.com/mastra-ai/mastra/commit/dd9dd1c9ae32ae79093f8c4adde1732ac6357233)]:
  - @mastra/libsql@1.6.1
  - @mastra/pg@1.6.1
  - @mastra/memory@1.5.1
  - @mastra/core@1.7.0

## 0.3.0-alpha.0

### Minor Changes

- Added interactive onboarding flow for first-time setup ([#13421](https://github.com/mastra-ai/mastra/pull/13421))

  **Setup wizard** — On first launch, an interactive wizard guides you through:
  - Authenticating with AI providers (Claude Max, OpenAI Codex)
  - Choosing a model pack (Varied, Anthropic, OpenAI, or Custom)
  - Selecting an observational memory model
  - Enabling or disabling YOLO mode (auto-approve tool calls)

  **Global settings** — Your preferences are now saved to `settings.json` in the app data directory and automatically applied to new threads. Model pack selections reference pack IDs so you get new model versions automatically.

  **Custom model packs** — Choose "Custom" to pick a specific model for each mode (plan/build/fast). Saved custom packs appear when re-running `/setup`.

  **`/setup` command** — Re-run the setup wizard anytime. Previously chosen options are highlighted with "(current)" indicators.

  **Settings migration** — Model-related data previously stored in `auth.json` (`_modelRanks`, `_modeModelId_*`, `_subagentModelId*`) is automatically migrated to `settings.json` on first load.

- Added storage backend configuration to `/settings` with PostgreSQL opt-in and remote LibSQL support. ([#13435](https://github.com/mastra-ai/mastra/pull/13435))

  **Selecting a backend**

  Switch storage backends through the `/settings` command (Storage backend option) or by setting the `MASTRA_STORAGE_BACKEND` environment variable. LibSQL remains the default — no changes needed for existing setups. Both backends prompt for a connection URL interactively after selection.

  **Remote LibSQL (Turso)**

  Select LibSQL in `/settings` and enter a remote Turso URL (e.g. `libsql://your-db.turso.io`). Leave empty to keep the default local file database. Can also be set via environment variable:

  ```sh
  export MASTRA_DB_URL="libsql://your-db.turso.io"
  export MASTRA_DB_AUTH_TOKEN="your-token"
  ```

  **PostgreSQL configuration**

  Select PostgreSQL in `/settings` and enter a connection string, or configure via environment variables:

  ```sh
  export MASTRA_STORAGE_BACKEND=pg
  export MASTRA_PG_CONNECTION_STRING="postgresql://user:pass@localhost:5432/db"
  ```

  If the PostgreSQL connection fails on startup, mastracode falls back to the local LibSQL database and shows a warning so you can fix the connection via `/settings`.

  Optional PostgreSQL settings include `schemaName`, `disableInit`, and `skipDefaultIndexes`.

- Added model name to Co-Authored-By in commit messages. Commits now include the active model (e.g. `Co-Authored-By: Mastra Code (anthropic/claude-opus-4-6) <noreply@mastra.ai>`) for traceability when switching between models. Falls back to the original static format when no model is set. ([#13376](https://github.com/mastra-ai/mastra/pull/13376))

### Patch Changes

- Fixed plan mode agent to properly call submit_plan tool. The agent was generating text descriptions instead of calling the tool. Fixed by: creating dynamic mode-specific tool guidance with correct tool names, clarifying tool vs text usage with explicit exceptions for communication tools, and strengthening submit_plan call instructions with urgent language and code examples. ([#13416](https://github.com/mastra-ai/mastra/pull/13416))

- Updated `/cost` and `/diff` commands to read token usage, memory progress, and modified files from the Harness display state instead of maintaining separate local copies. Moved shared type definitions (`OMProgressState`, `OMStatus`, `OMBufferedStatus`) to `@mastra/core/harness` and re-exported them for backward compatibility. ([#13427](https://github.com/mastra-ai/mastra/pull/13427))

- Exclude hidden files from directory listings ([#13384](https://github.com/mastra-ai/mastra/pull/13384))

- Consolidated keyboard shortcuts and commands into a `/help` overlay. The header now shows a compact hint line (`⇧Tab mode · /help info & shortcuts`) instead of 3 lines of keybinding instructions. Running `/help` opens a styled overlay with all commands and shortcuts. ([#13426](https://github.com/mastra-ai/mastra/pull/13426))

- Improved TUI maintainability by modularizing the main TUI class into focused modules: event handlers, command dispatchers, status line rendering, message rendering, error display, shell passthrough, and setup logic. Reduced the main TUI file from ~4,760 lines to 449 lines with no changes to user-facing behavior. ([#13413](https://github.com/mastra-ai/mastra/pull/13413))

- Added styled ASCII art banner header to the TUI with purple gradient and project frontmatter display. The banner shows "MASTRA CODE" in block letters for wide terminals, "MASTRA" for medium terminals, and falls back to a compact single line for narrow terminals. Project info (name, resource ID, branch, user) now renders inside the TUI header instead of via console.info before startup. ([#13422](https://github.com/mastra-ai/mastra/pull/13422))

- LSP now shows correct diagnostics for TypeScript and JavaScript files ([#13385](https://github.com/mastra-ai/mastra/pull/13385))

- Updated dependencies [[`551dc24`](https://github.com/mastra-ai/mastra/commit/551dc2445ffb6efa05eb268e8ab700bcd34ed39c), [`e8afc44`](https://github.com/mastra-ai/mastra/commit/e8afc44a41f24ffe8b8ae4a5ee27cfddbe7934a6), [`24284ff`](https://github.com/mastra-ai/mastra/commit/24284ffae306ddf0ab83273e13f033520839ef40), [`f5097cc`](https://github.com/mastra-ai/mastra/commit/f5097cc8a813c82c3378882c31178320cadeb655), [`71e237f`](https://github.com/mastra-ai/mastra/commit/71e237fa852a3ad9a50a3ddb3b5f3b20b9a8181c), [`c2e02f1`](https://github.com/mastra-ai/mastra/commit/c2e02f181843cbda8db6fd893adce85edc0f8742), [`13a291e`](https://github.com/mastra-ai/mastra/commit/13a291ebb9f9bca80befa0d9166b916bb348e8e9), [`397af5a`](https://github.com/mastra-ai/mastra/commit/397af5a69f34d4157f51a7c8da3f1ded1e1d611c), [`d4701f7`](https://github.com/mastra-ai/mastra/commit/d4701f7e24822b081b70f9c806c39411b1a712e7), [`2b40831`](https://github.com/mastra-ai/mastra/commit/2b40831dcca2275c9570ddf09b7f25ba3e8dc7fc), [`6184727`](https://github.com/mastra-ai/mastra/commit/6184727e812bf7a65cee209bacec3a2f5a16e923), [`6f6385b`](https://github.com/mastra-ai/mastra/commit/6f6385be5b33687cd21e71fc27e972e6928bb34c), [`14aba61`](https://github.com/mastra-ai/mastra/commit/14aba61b9cff76d72bc7ef6f3a83ae2c5d059193), [`dd9dd1c`](https://github.com/mastra-ai/mastra/commit/dd9dd1c9ae32ae79093f8c4adde1732ac6357233)]:
  - @mastra/libsql@1.6.1-alpha.0
  - @mastra/pg@1.6.1-alpha.0
  - @mastra/memory@1.5.1-alpha.0
  - @mastra/core@1.7.0-alpha.0

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
