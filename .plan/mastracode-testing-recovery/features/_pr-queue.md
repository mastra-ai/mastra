# Mastra Code PR feature mapping queue

Generated from `git log --reverse --date=short --name-only --pretty=format:'...' -- mastracode`.

This queue is a working index, not truth. Each PR still needs PR review and current-code verification before feature pages are created or updated.

Totals: 493 commits touching `mastracode/`; 358 squash-merged PR commits; 251 initially flagged as likely user-visible or test-relevant.

## Processing rules

- Process oldest-to-newest.
- Review each PR with `gh pr view <number>` and optionally `gh pr diff <number>`.
- Create pages for new user-visible features.
- Update existing pages when later PRs modify earlier features.
- Mark non-user-visible PRs as skipped in history/handoff with evidence.

## Queue

Status values are updated as the queue is processed: `done`, `skipped`, `current`, `next`, or blank.

| Order | Date | PR | Commit | Initial flag | Status | Subject | Mastra Code files touched |
| ---: | --- | ---: | --- | --- | --- | --- | ---: |
| 1 | 2026-02-18 | #13218 | `0e64154f1b` | review | done | MastraCode initial port (#13218) | 112 |
| 2 | 2026-02-18 | #13227 | `5013f35869` | review | done | MC follow up 1 (#13227) | 13 |
| 3 | 2026-02-18 | #13231 | `6515d301d4` | review | done | More cleanup (#13231) | 10 |
| 4 | 2026-02-18 | #13234 | `4e28562012` | review | done | MC fixes (#13234) | 67 |
| 5 | 2026-02-18 | #13239 | `9bbf08e3c2` | review | skipped | fix(core): use structural typing for ZodLikeSchema to prevent tsc OOM (#13239) | 112 |
| 6 | 2026-02-18 | #13245 | `6fdd3d451a` | review | done | Harness primitive (#13245) | 24 |
| 7 | 2026-02-18 | #13037 | `a0b5df263a` | likely skip | skipped | chore: version packages (alpha) (#13037) | 2 |
| 8 | 2026-02-18 | #13250 | `4f2e364945` | review | done | fix(mastracode): ESM module resolution error on startup (#13250) | 1 |
| 9 | 2026-02-18 | #13251 | `a20fbeff59` | likely skip | skipped | chore: version packages (alpha) (#13251) | 2 |
| 10 | 2026-02-18 | #13253 | `1415bcd894` | review | done | fix(schema-compat): fix zodToJsonSchema routing for v3/v4 schemas (#13253) | 11 |
| 11 | 2026-02-18 | #13252 | `f090302af0` | likely skip | skipped | chore: version packages (alpha) (#13252) | 2 |
| 12 | 2026-02-19 | #13255 | `d715911c91` | review | done | feat(mastracode): add separate export path for MastraTUI (#13255) | 2 |
| 13 | 2026-02-19 | #13257 | `834b03e500` | likely skip | skipped | chore: version packages (alpha) (#13257) | 2 |
| 14 | 2026-02-19 | #13305 | `b2601234bd` | review | done | fix(memory): improve OM activation chunk selection and safeguards (#13305) | 1 |
| 15 | 2026-02-20 | #13294 | `a8e92aec01` | review | done | chore(mastracode): Update installation instructions (#13294) | 1 |
| 16 | 2026-02-20 | #13330 | `608e156def` | review | done | fix: restore OM status updates and model change events in harness (#13330) | 1 |
| 17 | 2026-02-20 | #13331 | `3ea22d7703` | review | done | feat(mastracode): add audit-tests subagent (#13331) | 3 |
| 18 | 2026-02-20 | #13328 | `45bb78b70b` | review | done | feat: stream tool arguments incrementally across all tool renderers (#13328) | 3 |
| 19 | 2026-02-20 | #13335 | `7f317fc5e4` | review | done | fix(tui): preserve assistant message text across todo_write tool calls (#13335) | 1 |
| 20 | 2026-02-20 | #13307 | `12e4819fe2` | review | done | fix(mastracode): reload auth storage before resolving OpenAI Codex model (#13307) | 1 |
| 21 | 2026-02-20 | #13334 | `24b80af87d` | review | done | feat(harness): add optional threadLock config for concurrent thread access protection (#13334) | 1 |
| 22 | 2026-02-20 | #13339 | `b322502d4a` | review | done | feat(mastracode): add subagent parallel-only and verification guidance (#13339) | 2 |
| 23 | 2026-02-20 | #13343 | `2b2e157a09` | review | done | fix: scope thread auto resume to current directory to make worktrees easier to use (#13343) | 1 |
| 24 | 2026-02-20 | #13344 | `c204b632d1` | review | done | refactor: move todo tools to @mastra/core/harness and rename to task (#13344) | 18 |
| 25 | 2026-02-20 | #13345 | `7aedfb7ff9` | review | done | feat(tui): resolve autocomplete and queue slash commands on Ctrl+F (#13345) | 2 |
| 26 | 2026-02-20 | #13311 | `d1b596fb05` | review | done | fix(mastracode): wire mcpManager to TUI so /mcp command works (#13311) | 2 |
| 27 | 2026-02-20 | #13346 | `e399dcba4f` | review | done | fix(mastracode): load AGENTS.md instruction files, drop deprecated AGENT.md (#13346) | 4 |
| 28 | 2026-02-20 | #13347 | `48d19d89e0` | review | done | refactor: replace MCPManager class with factory function (#13347) | 5 |
| 29 | 2026-02-20 | #13348 | `4137924b3f` | review | done | fix: limit tool result token sizes for view, grep, and web tools (#13348) | 3 |
| 30 | 2026-02-20 | #13349 | `5f1f0fa8a3` | review | done | fix: raise memory buffer activation threshold to prevent aggressive window shrinking (#13349) | 1 |
| 31 | 2026-02-20 | #13350 | `e65ec08031` | review | done | refactor: extract TUI state into dedicated TUIState interface and factory (#13350) | 3 |
| 32 | 2026-02-20 | #13355 | `89b1a4aead` | review | done | fix(mastracode): allow view_range for directory listings (#13355) | 2 |
| 33 | 2026-02-20 | #13354 | `78d1c808ad` | review | done | fix(memory): improve OM continuity at low activation (#13354) | 3 |
| 34 | 2026-02-20 | #13353 | `59d30b5d0c` | review | done | refactor(harness): use object parameters for all Harness methods + add reference docs (#13353) | 3 |
| 35 | 2026-02-20 | #13260 | `e610573a4c` | likely skip | skipped | chore: version packages (alpha) (#13260) | 2 |
| 36 | 2026-02-23 | #13416 | `9a3d857436` | review | done | fix(mastracode): plan mode agent now calls submit_plan tool (#13416) | 5 |
| 37 | 2026-02-23 | #13413 | `f08b0bb00b` | review | done | refactor: modularize TUI into focused modules (#13413) | 41 |
| 38 | 2026-02-23 | #13385 | `18553c3541` | review | done | fix(mastracode): use correct LSP language identifier for TS/JS files (#13385) | 1 |
| 39 | 2026-02-23 | #13384 | `8af03582df` | review | done | fix(mastracode): exclude hidden files from directory listings (#13384) | 2 |
| 40 | 2026-02-24 | #13376 | `7429026f6c` | review | done | feat(mastracode): include model name in Co-Authored-By commit message (#13376) | 3 |
| 41 | 2026-02-23 | #13421 | `27644fbf25` | review | done | feat(mastracode): add interactive onboarding flow and global settings (#13421) | 20 |
| 42 | 2026-02-23 | #13431 | `bb82abe5e9` | review | done | fix(mastracode): default codex model from 5.3 to 5.2 (#13431) | 2 |
| 43 | 2026-02-23 | #13422 | `d1abce8a51` | review | done | feat(mastracode): Add ASCII art banner header with purple gradient (#13422) | 4 |
| 44 | 2026-02-23 | #13428 | `6f927b2103` | review | done | fix(tui): fix view tool rendering for workspace read_file output (#13428) | 2 |
| 45 | 2026-02-23 | #13426 | `5839d227b4` | review | done | feat(mastracode): simplify suggested help commands (#13426) | 4 |
| 46 | 2026-02-23 | #13427 | `d4701f7e24` | review | done | feat(core): add HarnessDisplayState for UI-agnostic display state (#13427) | 28 |
| 47 | 2026-02-24 | #13435 | `decccfdf65` | review | done | feat(mastracode): add PostgreSQL opt-in storage backend + libsql settings ui (#13435) | 9 |
| 48 | 2026-02-24 | #13405 | `424bd890be` | likely skip | skipped | chore: version packages (alpha) (#13405) | 2 |
| 49 | 2026-02-24 | #13456 | `babdfb23c2` | review | done | feat(mastracode): refresh git branch on thread resume & abbreviate long branch names (#13456) | 5 |
| 50 | 2026-02-24 | #13457 | `00f43e8e97` | review | done | fix: cache dynamic workspace on harness after resolution (#13457) | 1 |
| 51 | 2026-02-24 | #13460 | `e9cc208c94` | review | done | fix(mastracode): wire fdPath to enable @ file autocomplete (#13460) | 2 |
| 52 | 2026-02-25 | #13442 | `cc62d1b2bb` | review | done | mastracode: trigger Stop and UserPromptSubmit hooks in TUI (#13442) | 2 |
| 53 | 2026-02-25 | #13487 | `9ef0b440ed` | review | done | feat(mastracode): inherit terminal color theme for light/dark mode support (#13487) | 21 |
| 54 | 2026-02-25 | #13494 | `5c6bf27b79` | review | done | fix(mastracode): Update documentation link for supported providers (#13494) | 1 |
| 55 | 2026-02-25 | #13493 | `434ad50157` | review | done | fix(mastracode): append unused arguments to slash command output (#13493) | 1 |
| 56 | 2026-02-25 | #13500 | `47cb0a8962` | review | done | fix(mastracode): allow onboarding to proceed with API keys only (#13500) | 2 |
| 57 | 2026-02-25 | #13503 | `cc26bff512` | review | done | fix(mastracode): remove individual theme function exports to fix startup crash (#13503) | 30 |
| 58 | 2026-02-25 | #13505 | `11def4789e` | review | done | feat(mastracode): add Claude Max OAuth ToS warning (#13505) | 6 |
| 59 | 2026-02-25 | #13476 | `cb9f921320` | review | done | fix: observational memory buffering precision (#13476) | 1 |
| 60 | 2026-02-25 | #13490 | `d7ad237020` | review | done | feat(mastracode): wire reasoning effort for OpenAI Codex models (#13490) | 11 |
| 61 | 2026-02-25 | #13508 | `b69a0046cb` | review | done | fix(mastracode): strengthen Claude Max OAuth risk warning (#13508) | 1 |
| 62 | 2026-02-25 | #13455 | `6302b3ae7c` | likely skip | skipped | chore: version packages (alpha) (#13455) | 2 |
| 63 | 2026-02-25 | #13519 | `b03c0e0389` | review | done | fix: tool approval resume failing for standalone agents (#13519) | 2 |
| 64 | 2026-02-26 | #13525 | `439dd1a1c9` | review | done | chore(docs): Move Mastra Code docs, add Alpha notice to Harness (#13525) | 6 |
| 65 | 2026-02-26 | #13530 | `0533de8a34` | review | done | chore(docs): Move mastra-code docs (#13530) | 6 |
| 66 | 2026-02-26 | #13512 | `191e5bd29b` | review | done | fix: unify /models pack flow and improve custom pack editing UX (#13512) | 17 |
| 67 | 2026-02-26 | #13526 | `85b54c0a4f` | review | done | fix(mastracode): resolve edit tool paths like execute_command (#13526) | 7 |
| 68 | 2026-02-26 | #13557 | `15f4da196c` | review | done | feat(plans): persist approved plans to disk (#13401) (#13557) | 4 |
| 69 | 2026-02-26 | #13560 | `3b56d782fa` | review | done | fix: handle ERR_STREAM_DESTROYED as non-fatal in global error handlers (#13560) | 3 |
| 70 | 2026-02-26 | #13563 | `9311c17d7a` | review | done | fix: make Codex models work with OM and mastracode streams (#13563) | 4 |
| 71 | 2026-02-27 | #13564 | `675a6d717f` | review | done | fix(mastracode): wire extraTools into tool builder and filter denied tools (#13564) | 5 |
| 72 | 2026-02-27 | #13566 | `dd32e1e7a2` | review | done | fix(mastracode): detect API keys for all registry providers in setup flow (#13566) | 5 |
| 73 | 2026-02-27 | #13598 | `e37c95493f` | review | done | fix: keep submitted plan visible when requesting changes (#13598) | 1 |
| 74 | 2026-02-27 | #13600 | `43187ad783` | review | done | feat(mastracode): support Anthropic API key as fallback auth for model resolution (#13600) | 4 |
| 75 | 2026-02-27 | #13556 | `c6c5376cb2` | review | done | feat: add Quiet mode setting for subagent output collapse (#13556) | 9 |
| 76 | 2026-02-28 | #13609 | `ebab49855b` | review | done | fix: preserve assistant text after tool updates and add openai web_search fallback (#13609) | 2 |
| 77 | 2026-02-28 | #13574 | `276246e0b9` | review | done | feat(harness): file attachment support with filename preservation and text file handling (#13574) | 1 |
| 78 | 2026-03-01 | #13605 | `829a09641d` | review | done | feat(mastracode): add /fix-issue and /report-issue commands (#13605) | 5 |
| 79 | 2026-03-02 | #13437 | `e9476527fd` | review | done | feat(mastracode): switch to workspace tools with TUI streaming [COR-511] (#13437) | 4 |
| 80 | 2026-03-02 | #13682 | `ee9c8df644` | review | done | feat(mastracode): add /custom-providers command for custom OpenAI-compatible providers (#13682) | 15 |
| 81 | 2026-03-02 | #13690 | `f77cd94c44` | review | done | fix: implement Harness resource ID methods and improve /resource command (#13690) | 2 |
| 82 | 2026-03-03 | #13613 | `bf7ee23532` | review | done | feat(mastracode): support HTTP MCP servers in config (#13613) | 8 |
| 83 | 2026-03-02 | #13691 | `978a63d71e` | review | done | fix(mastracode): gate debug.log behind MASTRA_DEBUG env var and cap file size (#13691) | 4 |
| 84 | 2026-03-02 | #13687 | `85664e9fd8` | review | done | feat(workspace): support tool name remapping in workspace tools config (#13687) | 11 |
| 85 | 2026-03-02 | #13569 | `b8963791c6` | review | done | feat(memory): clone Observational Memory when forking threads (#13569) | 8 |
| 86 | 2026-03-02 | #13692 | `87ab58f1c5` | review | done | fix(mastracode): fix test failures from cross-test contamination and add temp dir gitignore (#13692) | 4 |
| 87 | 2026-03-02 | #13701 | `33f289c616` | review | done | use separate tui debug env var (#13701) | 1 |
| 88 | 2026-03-03 | #13693 | `6e1b940177` | review | done | feat(mc): set workspace (#13693) | 1 |
| 89 | 2026-03-03 | #13700 | `1c4221cf60` | review | done | fix: forward requestContext and skill paths to subagents (#13700) | 5 |
| 90 | 2026-03-03 | #13710 | `bc2665ebf3` | review | done | chore(templates): README follow-ups (#13710) | 1 |
| 91 | 2026-03-03 | #13713 | `d7ed2bb64e` | review | done | feat(mastracode): support dynamic extraTools functions (#13713) | 3 |
| 92 | 2026-03-03 | #13712 | `d365d2926b` | review | done | feat(cli): Add clipboard image and text paste support via Ctrl+V (#13712) | 2 |
| 93 | 2026-03-03 | #13716 | `ee8de2adcf` | review | done | feat(mastracode): export resolveModel from createMastraCode (#13716) | 1 |
| 94 | 2026-03-03 | #13603 | `548da794ec` | review | done | feat(mastracode): auto-update prompt on session start (#13603) | 4 |
| 95 | 2026-03-03 | #13696 | `6f2946f240` | review | done | fix(mastracode): queue parallel interactive tool calls to prevent input corruption (#13696) | 4 |
| 96 | 2026-03-03 | #13724 | `77b4a254e5` | review | done | feat(workspace): gitignore support, lower tree depth, fix tool guidance (#13724) | 1 |
| 97 | 2026-03-03 | #13723 | `52022c842c` | review | done | feat(mastracode): Ctrl+Z now suspends the process (SIGTSTP) (#13723) | 5 |
| 98 | 2026-03-04 | #13523 | `edfda994ef` | likely skip | skip: version packages only | chore: version packages (alpha) (#13523) | 2 |
| 99 | 2026-03-04 | #13760 | `fa9692afe2` | review | done | fix(mastracode): inline version at build time instead of requiring package.json (#13760) | 2 |
| 100 | 2026-03-04 | #13761 | `3e2b181a61` | likely skip | skip: version packages only | chore: version packages (alpha) (#13761) | 2 |
| 101 | 2026-03-04 | #13767 | `205bbac168` | review | done | fix(mastracode): fallback to package.json when running from source (#13767) | 1 |
| 102 | 2026-03-04 | #13768 | `46211b2799` | review | done | fix(mastracode): use ESM-compatible fallback for version detection (#13768) | 1 |
| 103 | 2026-03-04 | #13748 | `a3c16eb1be` | review | done | fix: persist thinking level as a global preference (#13748) | 6 |
| 104 | 2026-03-04 | #13787 | `02cbb66435` | review | done | feat(mastracode): add /update slash command (#13787) | 6 |
| 105 | 2026-03-04 | #13753 | `633370bdf4` | review | done | fix: rename request_sandbox_access to request_access, fix tilde expansion and mid-turn setAllowedPaths (#13753) | 7 |
| 106 | 2026-03-04 | #13611 | `f6b91c454b` | review | done | feat(mastracode): auth routing fix, tool injection, and auth storage init (#13611) | 10 |
| 107 | 2026-03-05 | #13815 | `324fff2672` | review | done | feat(mastracode): add omScope to MastraCodeConfig (#13815) | 3 |
| 108 | 2026-03-05 | #13766 | `38a334998f` | likely skip | skip: version packages only | chore: version packages (alpha) (#13766) | 2 |
| 109 | 2026-03-05 | #13870 | `57764e02c0` | review | done | feat(mastracode): enhanced web_search tool rendering (#13870) | 1 |
| 110 | 2026-03-06 | #12532 | `7abbf1fb29` | review | skip: build-tool deps only | chore(deps): update build tools (#12532) | 1 |
| 111 | 2026-03-06 | #13648 | `4df211619d` | review | done | feat(mastracode): add headless non-interactive mode via --prompt flag (#13648) | 5 |
| 112 | 2026-03-06 | #13695 | `aae2295838` | review | done | fix(schema-compat, core): fix OpenAI strict mode schema rejection for agent networks (#12284) (#13695) | 2 |
| 113 | 2026-03-09 | #13999 | `534c8bdf04` | review | done | feat(mastracode): stream shell passthrough output in real-time (#13999) | 2 |
| 114 | 2026-03-09 | #13940 | `28c85b184f` | review | done | fix(mastracode): subagents inherit workspace from parent agent (#13940) | 25 |
| 115 | 2026-03-09 | #13953 | `57c739108b` | review | done | feat: add attachment support to observational memory and MastraCode (#13953) | 6 |
| 116 | 2026-03-10 | #14062 | `6ba1788c15` | likely skip | skipped | chore(deps): update formatting & linting (#14062) | 1 |
| 117 | 2026-03-10 | #13883 | `868dcde021` | likely skip | skipped | chore: version packages (alpha) (#13883) | 2 |
| 118 | 2026-03-11 | #14102 | `ab866ec480` | likely skip | skipped | chore: version packages (alpha) (#14102) | 2 |
| 119 | 2026-03-11 | #14146 | `05f93dc393` | likely skip | skipped | chore: version packages (alpha) (#14146) | 2 |
| 120 | 2026-03-11 | #13750 | `930302b249` | review | done | feat(mastracode): allow passing MCP server configs to createMastraCode (#13750) | 3 |
| 121 | 2026-03-11 | #13996 | `a554cca518` | review | done | fix(mastracode): restore /om typing in Kitty terminals (#13996) | 2 |
| 122 | 2026-03-11 | #14157 | `787f3ac08b` | review | done | fix: handle Zod v4 schemas without ~standard.jsonSchema (#14157) | 1 |
| 123 | 2026-03-11 | #14147 | `dbb4c690f3` | likely skip | skipped | chore: version packages (alpha) (#14147) | 2 |
| 124 | 2026-03-11 | #14168 | `89c209dd1a` | review | done | fix(mastracode): stop hiding tool validation errors in TUI (#14168) | 1 |
| 125 | 2026-03-11 | #14167 | `1e4db5e5ea` | likely skip | skipped | chore: version packages (alpha) (#14167) | 2 |
| 126 | 2026-03-12 | #13568 | `86f242631d` | review | done | feat(memory): observer context optimization (#13568) | 1 |
| 127 | 2026-03-13 | #14264 | `c562ec228f` | review | done | fix(schema-compat): avoid false z.toJSONSchema unavailable errors (#14264) | 1 |
| 128 | 2026-03-13 | #14201 | `6fa8b85bf8` | likely skip | skipped | chore: version packages (alpha) (#14201) | 2 |
| 129 | 2026-03-13 | #14266 | `057dbc0ddf` | likely skip | skipped | chore: version packages (alpha) (#14266) | 2 |
| 130 | 2026-03-13 | #14250 | `5d6075b445` | review | done | fix: refine queued follow-up UX in Mastra Code (#14250) | 18 |
| 131 | 2026-03-15 | #13573 | `d46c9e95a1` | review | done | feat: prompt for API keys in mastracode TUI (#13573) | 9 |
| 132 | 2026-03-16 | #14260 | `bbcbbce4f0` | review | skip: dependency/build-only for MC feature map | chore: update dependencies and fix mcp build for @modelcontextprotocol/sdk@1.27.1 (#14260) | 1 |
| 133 | 2026-03-16 | #14280 | `660aeff223` | likely skip | skipped | chore: version packages (alpha) (#14280) | 2 |
| 134 | 2026-03-16 | #14337 | `3f47335cac` | review | done | feat(mastracode): theme with adaptive colors and refined TUI styling (#14337) | 37 |
| 135 | 2026-03-16 | #13933 | `531607166e` | review | skip: build-tool deps only | chore(deps): update build tools (#13933) | 1 |
| 136 | 2026-03-16 | #14359 | `1179b045bb` | review | done | fix(mastracode): replace editor border animation with solid mode color (#14359) | 2 |
| 137 | 2026-03-17 | #14377 | `133ef20c39` | review | done | feat(mastracode): improve MCP server management with interactive /mcp selector (#14377) | 9 |
| 138 | 2026-03-17 | #14343 | `6611d73d42` | likely skip | skipped | chore: version packages (alpha) (#14343) | 2 |
| 139 | 2026-03-17 | #14427 | `52715cf453` | likely skip | skipped | chore: version packages (alpha) (#14427) | 2 |
| 140 | 2026-03-18 | #14432 | `0256b9b00a` | likely skip | skip: CI/turbo config | ci: optimize turbo cache inputs, config, and workflow concurrency (#14432) | 1 |
| 141 | 2026-03-18 | #14433 | `01a67403e1` | review | done | feat: forward harness headers to mastracode model providers (#14433) | 5 |
| 142 | 2026-03-18 | #14469 | `c2e48b6a72` | review | done | fix(mastracode): don't pass custom headers to anthropic/codex providers (#14469) | 2 |
| 143 | 2026-03-18 | #14423 | `d9d5f948b0` | review | done | feat: polish Mastra Code TUI history styling and prompt animation (#14423) | 7 |
| 144 | 2026-03-18 | #14428 | `11dd998449` | review | done | feat(mastracode): speed up /threads popup loading (#14428) | 6 |
| 145 | 2026-03-18 | #14472 | `8cda6192e0` | review | done | fix(tui): remove italic styling from tool arguments (#14472) | 1 |
| 146 | 2026-03-18 | #14436 | `681ee1c811` | review | done | feat: generate thread titles in observer (#14436) | 11 |
| 147 | 2026-03-18 | #14479 | `a673e88a4d` | review | done | fix: wrap long inline question answers (#14479) | 1 |
| 148 | 2026-03-19 | #14439 | `c3fa1e60a7` | likely skip | skipped | chore: version packages (alpha) (#14439) | 2 |
| 149 | 2026-03-19 | #14437 | `da931155c1` | review | done | feat(memory): add thread-scoped retrieval for observational memory (#14437) | 1 |
| 150 | 2026-03-20 | #14541 | `b8acde89fd` | review | done | fix(mastracode): pin dependency ranges (#14541) | 1 |
| 151 | 2026-03-20 | #14518 | `0adb54aa31` | likely skip | skipped | chore: version packages (alpha) (#14518) | 2 |
| 152 | 2026-03-22 | #14587 | `55529f6c51` | review | done | feat: Mastra Code autonomous system prompts (#14587) | 4 |
| 153 | 2026-03-23 | #14586 | `0b619421b8` | review | done | feat: prevent macOS sleep during active mastracode work (#14586) | 3 |
| 154 | 2026-03-23 | #14604 | `8d0e4aa363` | review | done | feat: update mastracode default OpenAI model packs (#14604) | 4 |
| 155 | 2026-03-23 | #14605 | `d3878829d4` | review | done | fix: remove Claude Max OAuth warning flow (#14605) | 10 |
| 156 | 2026-03-24 | #14549 | `d4fcb37312` | likely skip | skipped | chore: version packages (alpha) (#14549) | 2 |
| 157 | 2026-03-24 | #14654 | `62ff1b61a9` | likely skip | skipped | chore: version packages (alpha) (#14654) | 2 |
| 158 | 2026-03-25 | #14688 | `3cebe964bb` | review | done | fix: improve Mastra Code response guidance (#14688) | 1 |
| 159 | 2026-03-25 | #14690 | `b174c63a09` | review | done | fix(mastracode): speed up loading and show all threads in thread selector (#14690) | 2 |
| 160 | 2026-03-25 | #14691 | `faede8c392` | review | done | fix: remove thread selector preview lookup (#14691) | 2 |
| 161 | 2026-03-25 | #14565 | `404fea1304` | review | done | feat: add lsp_inspect workspace inspection tool (#14565) | 5 |
| 162 | 2026-03-25 | #14637 | `86e326363e` | review | done | feat: add dynamic AGENTS.md loading in mastracode (#14637) | 15 |
| 163 | 2026-03-27 | #14727 | `a98a9c7930` | review | done | fix(mastracode): fix custom slash commands not loading (#14727) | 2 |
| 164 | 2026-03-27 | #14567 | `949b7bfd4e` | review | done | feat(memory): cross-thread recall browsing, search, and scope-based access control (#14567) | 15 |
| 165 | 2026-03-27 | #14788 | `60a224dd49` | review | done | fix: persist observational memory threshold settings across restarts (#14788) | 3 |
| 166 | 2026-03-27 | #14790 | `d084b66923` | review | done | fix: cap injected AGENTS.md reminders (#14790) | 1 |
| 167 | 2026-03-30 | #14845 | `2bac10d032` | review | done | feat(mastracode): allow custom response on questions with options (#14845) | 2 |
| 168 | 2026-03-30 | #14656 | `0771fa8909` | likely skip | skipped | chore: version packages (alpha) (#14656) | 2 |
| 169 | 2026-03-30 | #14867 | `43b86882f7` | review | done | fix(mastracode): quote digit-leading provider names in gateway sync (#14867) | 1 |
| 170 | 2026-03-31 | #14804 | `3ae348c76f` | review | done | fix(mastracode): show configured subagents in /subagents (#14804) | 2 |
| 171 | 2026-03-31 | #14535 | `acf5fbcb89` | review | done | fix: handle circular references in tool results to prevent JSON.stringify crashes (#14535) | 4 |
| 172 | 2026-03-31 | #14870 | `0cd1c8dd9d` | likely skip | skipped | chore: version packages (alpha) (#14870) | 2 |
| 173 | 2026-03-31 | #14904 | `051aece9c3` | likely skip | skipped | chore: version packages (alpha) (#14904) | 2 |
| 174 | 2026-04-01 | #14911 | `2737684b2a` | likely skip | skipped | chore: version packages (alpha) (#14911) | 2 |
| 175 | 2026-04-01 | #14960 | `a9d47b786f` | review | done | fix(mastracode): disable MCP tool result timeout for long-running tools (#14960) | 1 |
| 176 | 2026-04-01 | #14961 | `b016d2d4b7` | review | done | fix: instruct agent to use request_access tool instead of telling user to run /sandbox (#14961) | 1 |
| 177 | 2026-04-01 | #14929 | `121c67f169` | likely skip | skipped | chore: version packages (alpha) (#14929) | 2 |
| 178 | 2026-04-01 | #14952 | `c8c86aa145` | review | done | feat: Mastra Gateway model router provider + memory integration (#14952) | 23 |
| 179 | 2026-04-02 | #14936 | `323b31fe37` | review | done | feat(mastracode): mask sensitive input fields in TUI dialogs (#14936) | 4 |
| 180 | 2026-04-03 | #14965 | `176278f52a` | likely skip | skipped | chore: version packages (alpha) (#14965) | 2 |
| 181 | 2026-04-03 | #15034 | `8eed048de4` | likely skip | skipped | chore: version packages (alpha) (#15034) | 2 |
| 182 | 2026-04-03 | #15042 | `c14a638639` | likely skip | skipped | chore: version packages (alpha) (#15042) | 2 |
| 183 | 2026-04-04 | #15055 | `ee09cbf675` | likely skip | skipped | chore: version packages (alpha) (#15055) | 2 |
| 184 | 2026-04-05 | #15059 | `f5b553c7a9` | likely skip | skipped | chore: version packages (alpha) (#15059) | 2 |
| 185 | 2026-04-05 | #15082 | `0073994124` | review | done | fix: prune mastracode chat memory growth (#15082) | 13 |
| 186 | 2026-04-05 | #15036 | `7d6f52164d` | review | done | feat(mastracode): add browser automation support (#15036) | 13 |
| 187 | 2026-04-05 | #15088 | `9f58f3a305` | review | done | fix: address mastracode review follow-ups (#15088) | 2 |
| 188 | 2026-04-06 | #15083 | `679003c3f6` | likely skip | skipped | chore: version packages (alpha) (#15083) | 2 |
| 189 | 2026-04-06 | #15114 | `6c3e6c14a0` | likely skip | skipped | chore: version packages (alpha) (#15114) | 2 |
| 190 | 2026-04-08 | #15151 | `171c703862` | review | done | feat: support Agent Skills spec skill directories (#15151) | 3 |
| 191 | 2026-04-07 | #15117 | `7f8d0efa83` | likely skip | skipped | chore: version packages (alpha) (#15117) | 2 |
| 192 | 2026-04-07 | #15165 | `44085a1ad0` | likely skip | skipped | chore: version packages (alpha) (#15165) | 2 |
| 193 | 2026-04-07 | #15172 | `2e325726f4` | likely skip | skipped | chore: version packages (alpha) (#15172) | 2 |
| 194 | 2026-04-08 | #15092 | `166e39a7d6` | review | done | feat: add collapsible output for shell passthrough (! commands) (#15092) | 11 |
| 195 | 2026-04-08 | #15174 | `6f63b8c638` | likely skip | skipped | chore: version packages (alpha) (#15174) | 2 |
| 196 | 2026-04-08 | #14962 | `061adb3329` | review | done | feat(mastracode): add thread control CLI options to headless mode (#14962) | 3 |
| 197 | 2026-04-08 | #15190 | `d93b410668` | likely skip | skipped | chore: version packages (alpha) (#15190) | 2 |
| 198 | 2026-04-08 | #15192 | `32b122470c` | review | done | fix(mastracode): clear task list on thread switch instead of reading stale global state (#15192) | 1 |
| 199 | 2026-04-08 | #15191 | `ee35ec6944` | likely skip | skipped | chore: version packages (alpha) (#15191) | 2 |
| 200 | 2026-04-09 | #15228 | `5d84914e0e` | review | done | fix: resolve symlinked workspace skill aliases (#15228) | 3 |
| 201 | 2026-04-13 | #15014 | `d292618171` | review | done | feat(mastracode): add /api-keys slash command for managing provider API keys (#15014) | 6 |
| 202 | 2026-04-14 | #14435 | `cbdf3e12b3` | review | done | feat: add processAPIError processor method for handling LLM API rejections (#14435) | 2 |
| 203 | 2026-04-14 | #15194 | `190f45258b` | review | done | feat(browser): add profile and executablePath options (#15194) | 2 |
| 204 | 2026-04-14 | #15352 | `c809341c0f` | review | done | refactor: refine Mastra Code autonomy prompts (#15352) | 2 |
| 205 | 2026-04-14 | #15359 | `274504c739` | review | done | feat: compress mastracode OM memory with caveman speak (#15359) | 2 |
| 206 | 2026-04-14 | #15200 | `74f927608f` | likely skip | skipped | chore: version packages (alpha) (#15200) | 2 |
| 207 | 2026-04-15 | #15370 | `95b144b2d5` | review | done | feat(mastracode): add share and import for model packs (#15370) | 3 |
| 208 | 2026-04-15 | #15390 | `1192dffd35` | likely skip | skipped | chore: version packages (alpha) (#15390) | 2 |
| 209 | 2026-04-15 | #14909 | `b42565acf0` | review | done | feat(mastracode): add --model CLI option to headless mode (#14909) | 4 |
| 210 | 2026-04-15 | #15365 | `9467ea8769` | review | done | feat: add activateAfterIdle for observational memory activation when prompt caches expire (#15365) | 6 |
| 211 | 2026-04-16 | #15420 | `0fd90a215c` | review | done | feat: activate observations on provider changes (#15420) | 6 |
| 212 | 2026-04-16 | #15458 | `346c2f5f05` | review | done | chore(mastracode): bump Anthropic pack defaults to opus-4-7 and sonnet-4-6 (#15458) | 1 |
| 213 | 2026-04-16 | #15462 | `f607106854` | review | done | fix: prevent early observational memory reflection activation overshoot (#15462) | 4 |
| 214 | 2026-04-18 | #15483 | `7f9dc6260b` | review | done | fix(mastracode): check stored API key slot and env vars in key resolution (#15483) | 1 |
| 215 | 2026-04-20 | #15403 | `f7420c2c45` | likely skip | skipped | chore: version packages (alpha) (#15403) | 2 |
| 216 | 2026-04-20 | #15423 | `5e42e6f903` | review | done | feat(core,mastracode): add --output-format to mastracode headless wit… (#15423) | 2 |
| 217 | 2026-04-20 | #15566 | `0a5fa1d3cb` | review | done | fix(security): replace polynomial-redos regexes with bounded/procedural alternatives (#15566) | 8 |
| 218 | 2026-04-21 | #15544 | `30bd1ac2db` | likely skip | skipped | chore(deps): update formatting & linting (major) (#15544) | 1 |
| 219 | 2026-04-21 | #15448 | `2ca2d23913` | review | done | feat: add Tavily integration package (#15448) | 2 |
| 220 | 2026-04-21 | #15515 | `3d3daffaae` | likely skip | skipped | chore: version packages (alpha) (#15515) | 2 |
| 221 | 2026-04-21 | #15601 | `74b1b9661f` | likely skip | skipped | chore: version packages (alpha) (#15601) | 2 |
| 222 | 2026-04-22 | #15606 | `dd05cb1f4a` | likely skip | skipped | chore: version packages (alpha) (#15606) | 2 |
| 223 | 2026-04-22 | #15631 | `c7b5417617` | review | done | feat(mastracode): normalize Fireworks and generic model IDs in TUI status line (#15631) | 2 |
| 224 | 2026-04-22 | #15605 | `01a7d51349` | review | done | feat(memory): opt-in temporal-gap markers for observational memory (#15605) | 11 |
| 225 | 2026-04-22 | #15629 | `83224849d1` | likely skip | skipped | chore: version packages (alpha) (#15629) | 2 |
| 226 | 2026-04-22 | #15653 | `8e75750997` | likely skip | skipped | chore: version packages (alpha) (#15653) | 2 |
| 227 | 2026-04-23 | #15678 | `090c9558a3` | review | done | fix(mastracode): keep custom slash commands in the active thread (#15678) | 2 |
| 228 | 2026-04-23 | #15656 | `f51df5d95a` | likely skip | skipped | chore: version packages (alpha) (#15656) | 2 |
| 229 | 2026-04-24 | #15699 | `d86bfacf70` | likely skip | skipped | chore: version packages (alpha) (#15699) | 2 |
| 230 | 2026-04-24 | #15749 | `5a0fca7986` | review | done | fix(mastracode): clear per-thread state on thread switch/create (#15749) | 7 |
| 231 | 2026-04-24 | #15730 | `7a7b3138fb` | review | done | feat(core,mastracode): add ProviderHistoryCompat error processor with extensible rule architecture (#15730) | 1 |
| 232 | 2026-04-24 | #15703 | `299f6fd1fb` | review | done | mastracode: allow custom model strings in /om (#15703) | 14 |
| 233 | 2026-04-27 | #15642 | `cf25a03132` | review | done | feat(mastracode): add evals system with live scorers, offline experiments, and Studio feedback (#15642) | 24 |
| 234 | 2026-04-28 | #15710 | `68a4cec599` | likely skip | skipped | chore: version packages (alpha) (#15710) | 2 |
| 235 | 2026-04-28 | #15759 | `c8919894c0` | review | done | feat(mastracode): use GPT-5.5 in OpenAI pack (#15759) | 7 |
| 236 | 2026-04-28 | #15760 | `13b4d7c16d` | review | done | Add stream error retry processor (#15760) | 4 |
| 237 | 2026-04-28 | #15695 | `5a4b1ee802` | review | done | feat(core): forked subagents inherit parent thread + prompt cache prefix (#15695) | 8 |
| 238 | 2026-04-28 | #15857 | `84a4c8515b` | likely skip | skipped | chore: version packages (alpha) (#15857) | 2 |
| 239 | 2026-04-28 | #15896 | `14227ce4b3` | likely skip | skipped | chore: version packages (alpha) (#15896) | 2 |
| 240 | 2026-04-28 | #15820 | `b430eef4e5` | review | done | feat(mastracode): include common binaries in system prompt (#15820) | 6 |
| 241 | 2026-04-29 | #15770 | `30fe03e5f5` | likely skip | skipped | chore(deps): update ai sdk (#15770) | 1 |
| 242 | 2026-04-29 | #15909 | `7179450363` | likely skip | skipped | chore: version packages (alpha) (#15909) | 2 |
| 243 | 2026-04-29 | #15928 | `f1589291e3` | likely skip | skipped | chore: version packages (alpha) (#15928) | 2 |
| 244 | 2026-04-29 | #15924 | `93a7e6f5e3` | review | done | feat(mastracode): show changelog in update prompt (#15924) | 4 |
| 245 | 2026-04-29 | #15942 | `8f1c0e7c9f` | review | done | fix(mastracode): display user message in TUI before async operations (#15942) | 1 |
| 246 | 2026-04-30 | #15940 | `3b11cdd283` | likely skip | skipped | chore: version packages (alpha) (#15940) | 2 |
| 247 | 2026-04-30 | #15993 | `0a6f95b8e6` | review | done | fix(mastracode): fix user message border misalignment when first line is full width (#15993) | 1 |
| 248 | 2026-04-30 | #15979 | `e19c4e5c81` | likely skip | skipped | chore: version packages (alpha) (#15979) | 2 |
| 249 | 2026-04-30 | #16006 | `2f53bdc6bc` | review | done | feat(mastracode): support piped stdin as initial TUI message (#16006) | 5 |
| 250 | 2026-04-30 | #16009 | `3c4712b259` | likely skip | skipped | chore: version packages (alpha) (#16009) | 2 |
| 251 | 2026-04-30 | #16011 | `861f59af84` | likely skip | skipped | chore: version packages (alpha) (#16011) | 2 |
| 252 | 2026-04-30 | #16016 | `a127afaa86` | likely skip | skipped | chore: version packages (alpha) (#16016) | 2 |
| 253 | 2026-04-30 | #16020 | `7510bcac37` | likely skip | skipped | chore: version packages (alpha) (#16020) | 2 |
| 254 | 2026-05-01 | #15395 | `7974532bb9` | review | done | feat(mastracode): add multiline support to question input box (#15395) | 14 |
| 255 | 2026-04-30 | #16023 | `ac386b56fc` | review | done | chore: format ask-question-inline-multiline test (#16023) | 1 |
| 256 | 2026-04-30 | #16022 | `bba1790449` | likely skip | skipped | chore: version packages (alpha) (#16022) | 2 |
| 257 | 2026-04-30 | #16024 | `20ed4654c0` | likely skip | skipped | chore: version packages (alpha) (#16024) | 2 |
| 258 | 2026-05-01 | #16068 | `8ed4c6a630` | review | done | fix(mastracode): only log skill directories that exist on disk (#16068) | 1 |
| 259 | 2026-05-01 | #16094 | `3566b34eac` | review | done | feat(mastracode): add /tmp as default allowed workspace path (#16094) | 1 |
| 260 | 2026-05-04 | #16135 | `d563e7599b` | review | done | fix(mastracode): normalize Enter/Esc handling in settings submenu (#16135) | 1 |
| 261 | 2026-05-04 | #16028 | `da37169958` | likely skip | skipped | chore: version packages (alpha) (#16028) | 2 |
| 262 | 2026-05-04 | #16182 | `b474594310` | likely skip | skipped | chore: version packages (alpha) (#16182) | 2 |
| 263 | 2026-05-04 | #16192 | `a6e9417968` | likely skip | skipped | chore: version packages (alpha) (#16192) | 2 |
| 264 | 2026-05-06 | #16250 | `98bae8da6e` | review | done | chore(mastracode): Improve README & docs (#16250) | 1 |
| 265 | 2026-05-06 | #16176 | `d1fdbd012a` | review | done | feat(core): add provider-boundary prompt processor hook (#16176) | 3 |
| 266 | 2026-05-06 | #13891 | `aa0cb0ddd8` | review | done | feat(mastracode): allow overriding memory instance via config (#13891) | 1 |
| 267 | 2026-05-06 | #16274 | `e2055ca7cd` | review | done | fix(mastracode): standardize setup and config overlays (#16274) | 32 |
| 268 | 2026-05-06 | #16196 | `3bdb5cee50` | likely skip | skipped | chore: version packages (alpha) (#16196) | 2 |
| 269 | 2026-05-07 | #16126 | `9f1741080d` | likely skip | skipped | chore(deps): update ai sdk (#16126) | 1 |
| 270 | 2026-05-07 | #16294 | `e97b9ec4af` | review | done | Fix Codex OAuth callback port fallback (#16294) | 2 |
| 271 | 2026-05-07 | #16065 | `33f5061cd1` | review | done | feat(mastracode): add /goal slash command for persistent cross-turn goals (Ralph loop) (#16065) | 38 |
| 272 | 2026-05-07 | #16295 | `8519846579` | likely skip | skipped | chore: version packages (alpha) (#16295) | 2 |
| 273 | 2026-05-07 | #16322 | `91db9e771f` | review | done | fix: keep goal commands and user choices intact (#16322) | 11 |
| 274 | 2026-05-07 | #16320 | `de93ce2a87` | likely skip | skipped | chore: version packages (alpha) (#16320) | 2 |
| 275 | 2026-05-07 | #16275 | `0586486462` | review | done | feat(mastracode): add /om toggle for caveman observations (#16275) | 13 |
| 276 | 2026-05-07 | #16326 | `b275631dc1` | review | done | Replace js-tiktoken with tokenx in @mastra/core and mastracode (#16326) | 2 |
| 277 | 2026-05-08 | #16351 | `25cd423cd8` | likely skip | skipped | chore: dedupe and clean up external dependencies (#16351) | 1 |
| 278 | 2026-05-08 | #16254 | `e2a079cc37` | review | done | feat(harness): add stable task patch tools (#16254) | 31 |
| 279 | 2026-05-08 | #16332 | `db34bc6fb3` | review | done | fix(core, mastracode): silence provider cache corruption warning and consolidate gateway sync (#16332) | 2 |
| 280 | 2026-05-08 | #16340 | `7c275a8105` | review | done | fix(mastracode): trigger plan execution when accepting plan via /goal (#16340) | 8 |
| 281 | 2026-05-08 | #16129 | `c50ebc34da` | review | done | feat(mastracode): add GitHub Copilot OAuth provider with live model discovery (#16129) | 16 |
| 282 | 2026-05-11 | #16398 | `7ad5585640` | likely skip | skipped | chore(deps): update ai sdk (#16398) | 1 |
| 283 | 2026-05-11 | #16223 | `50f5884b41` | review | done | draft: Add MastraPlatformExporter and MastraStorageExporter, deprecate CloudExporter and DefaultExporter (#16223) | 1 |
| 284 | 2026-05-11 | #16409 | `f3279f5129` | likely skip | skipped | chore: version packages (alpha) (#16409) | 2 |
| 285 | 2026-05-12 | #16231 | `f984b4d6c6` | review | done | feat(mastracode): send follow-ups through Agent signals (#16231) | 23 |
| 286 | 2026-05-12 | #16338 | `05dab92b33` | review | done | feat(playground): support signal follow-up chat (#16338) | 2 |
| 287 | 2026-05-12 | #16458 | `5337df1c3f` | likely skip | skipped | chore: version packages (alpha) (#16458) | 2 |
| 288 | 2026-05-12 | #16501 | `9cd4c8e07b` | likely skip | skipped | chore: version packages (alpha) (#16501) | 2 |
| 289 | 2026-05-12 | #16511 | `ca4f94e378` | likely skip | skipped | chore: version packages (alpha) (#16511) | 2 |
| 290 | 2026-05-12 | #16513 | `49996678b6` | review | done | feat: speed up LibSQL and Mastra Code startup (#16513) | 8 |
| 291 | 2026-05-12 | #16516 | `136e85f3ae` | likely skip | skipped | chore: version packages (alpha) (#16516) | 2 |
| 292 | 2026-05-13 | #16521 | `3e63fca7aa` | review | done | fix(mastracode): regular plan approval triggers via structured sendSignal and no longer hangs (#16521) | 2 |
| 293 | 2026-05-13 | #16548 | `7cb2a2b7f0` | review | done | feat(mastracode): add Codex device login and MCP OAuth config (#16548) | 16 |
| 294 | 2026-05-14 | #16559 | `046cb4a2e9` | likely skip | skipped | chore: version packages (alpha) (#16559) | 2 |
| 295 | 2026-05-14 | #16611 | `b23d30dd83` | likely skip | skipped | chore: version packages (alpha) (#16611) | 2 |
| 296 | 2026-05-15 | #16624 | `fd5fbb4ce7` | likely skip | skipped | chore: version packages (alpha) (#16624) | 2 |
| 297 | 2026-05-15 | #16654 | `87e0c9886a` | review | done | fix: improve goal mode judge UX (#16654) | 21 |
| 298 | 2026-05-15 | #16657 | `bbbf6d015a` | likely skip | skipped | chore: version packages (alpha) (#16657) | 2 |
| 299 | 2026-05-16 | #16618 | `64c1e0b351` | review | done | feat(mastracode): add /skill/<name> command to activate skills explicitly (#16618) | 14 |
| 300 | 2026-05-15 | #16622 | `40d83a90d9` | review | done | feat(core)!: simplify AgentSignalContents and fix multimodal signal handling (#16622) | 1 |
| 301 | 2026-05-19 | #16690 | `7ab779ad87` | review | current | fix(mastracode): track active goal pursuit time (#16690) | 9 |
| 302 | 2026-05-19 | #16691 | `359439bb8c` | review | | fix: inherit env for MastraCode commands (#16691) | 2 |
| 303 | 2026-05-19 | #16676 | `5e16cf0c6b` | review | | feat(mastracode): return to plan after approved goal (#16676) | 7 |
| 304 | 2026-05-19 | #16663 | `c272d50610` | review | | feat(memory): add provider-aware OM idle activation (#16663) | 12 |
| 305 | 2026-05-19 | #16665 | `841a222560` | review | | fix(core): route agent thread stream subscriptions through pubsub (#16665) | 2 |
| 306 | 2026-05-19 | #16682 | `c960279c56` | review | | feat(mastracode): /om toggle to skip attachments when observer is text-only (#16682) | 11 |
| 307 | 2026-05-19 | #16667 | `8a52e03557` | likely skip | | chore: version packages (alpha) (#16667) | 2 |
| 308 | 2026-05-19 | #15173 | `2c47b7e7a0` | review | | Add MastraCode product analytics (#15173) | 14 |
| 309 | 2026-05-19 | #16771 | `ac79462b98` | review | | feat(mastracode): add quiet mode (#16771) | 31 |
| 310 | 2026-05-19 | #16797 | `6209a1f157` | likely skip | | chore: version packages (alpha) (#16797) | 2 |
| 311 | 2026-05-19 | #16669 | `71a820b235` | review | | fix(mastracode): coordinate signals over Unix socket PubSub (#16669) | 6 |
| 312 | 2026-05-20 | #16804 | `7dd705f2b4` | likely skip | | chore: version packages (alpha) (#16804) | 2 |
| 313 | 2026-05-19 | #16807 | `2b27920c3a` | review | | fix(mastracode): polish quiet mode follow-ups (#16807) | 18 |
| 314 | 2026-05-20 | #16809 | `7dd82acbeb` | likely skip | | chore: version packages (alpha) (#16809) | 2 |
| 315 | 2026-05-20 | #16835 | `7b74651a51` | review | | fix(mastracode): improve tui render scheduling (#16835) | 15 |
| 316 | 2026-05-20 | #16839 | `7d36258d59` | review | | fix(mastracode): improve quiet mode task list contrast and alignment (#16839) | 5 |
| 317 | 2026-05-20 | #16849 | `f7692254ea` | review | | fix(mastracode): use visible width for terminal output (#16849) | 9 |
| 318 | 2026-05-20 | #16843 | `27fd1b79ac` | review | | fix: goal judge maxSteps, retry, resume retrigger, and task auto-demote (#16843) | 4 |
| 319 | 2026-05-20 | #16831 | `bb34e3dc4d` | likely skip | | chore: version packages (alpha) (#16831) | 2 |
| 320 | 2026-05-21 | #16920 | `206ceff6ca` | review | | fix(mastracode): convert update notification from modal to inline component (#16920) | 5 |
| 321 | 2026-05-21 | #16923 | `df1947affa` | review | | feat: add signal delivery attributes for active/idle context (#16923) | 7 |
| 322 | 2026-05-21 | #16790 | `c1d64b6306` | review | | fix(mastracode): run slash commands immediately during active runs & async git branch refresh (#16790) | 15 |
| 323 | 2026-05-21 | #16939 | `81164363eb` | review | | feat(core): per-thread socket PubSub to fix OOM from cross-thread serialization (#16939) | 2 |
| 324 | 2026-05-21 | #16922 | `c27c4b9f13` | review | | feat: generate provider capabilities file and add auto mode for OM observer attachments (#16922) | 9 |
| 325 | 2026-05-22 | #16951 | `63fe14cd38` | review | | perf(mastracode): replace remaining sync blockers with async alternatives (#16951) | 7 |
| 326 | 2026-05-22 | #16987 | `9a33d81f01` | review | | fix(mastracode): combine idle timeout and activation into single line (#16987) | 4 |
| 327 | 2026-05-25 | #17008 | `6096445973` | review | | perf(mastracode): fix mode switch delay, modal lag, Ctrl+F duplicate, and block mode switch while active (#17008) | 4 |
| 328 | 2026-05-25 | #17005 | `0e95e56637` | review | | fix(mastracode): wrap long ask_user option labels to prevent TUI crash (#17005) | 2 |
| 329 | 2026-05-25 | #13751 | `7462719a30` | review | | feat(mastracode): allow custom config directory via configDir option (#13751) | 19 |
| 330 | 2026-05-25 | #17032 | `b970a83042` | review | | fix: preserve unresolved slash command references and update pr-triage command (#17032) | 2 |
| 331 | 2026-05-25 | #16984 | `7f9da22efd` | review | | fix(core): suppress gateway fetch errors and stop retrying on failure (#16984) | 2 |
| 332 | 2026-05-26 | #17070 | `c35b9625c7` | review | | Fix legacy subagent results and MastraCode type checks (#17070) | 8 |
| 333 | 2026-05-27 | #17054 | `c49655fb6d` | review | | feat(mastracode): wrap long ask_user picker option labels with ↳ continuation (#17054) | 3 |
| 334 | 2026-05-26 | #16872 | `ed376fe8d7` | likely skip | | chore: version packages (alpha) (#16872) | 2 |
| 335 | 2026-05-27 | #17071 | `029668d5d6` | review | | fix(mastracode): decode kitty CSI-u keys for tool approval shortcuts (#17071) | 7 |
| 336 | 2026-05-26 | #17108 | `1d57d5c806` | likely skip | | chore: version packages (alpha) (#17108) | 2 |
| 337 | 2026-05-26 | #17114 | `ff5858afa2` | likely skip | | chore: version packages (alpha) (#17114) | 2 |
| 338 | 2026-05-27 | #17138 | `c3baf471a4` | likely skip | | chore: version packages (alpha) (#17138) | 2 |
| 339 | 2026-05-28 | #17220 | `97b974e292` | likely skip | | chore: add missing lint-staged configs (#17220) | 1 |
| 340 | 2026-05-30 | #17333 | `0f7f06bc92` | review | | fix(mastracode): wrap long slash-command descriptions in autocomplete picker (#17333) | 3 |
| 341 | 2026-05-30 | #17334 | `27c2376c99` | review | | fix(mastracode): render ask_user multi_select as a multi-select picker (#17334) | 8 |
| 342 | 2026-05-31 | #17283 | `c5eca07f1d` | review | | feat(mastracode): configure TUI shell passthrough (#17283) | 11 |
| 343 | 2026-05-31 | #17174 | `4517213d91` | likely skip | | chore: version packages (alpha) (#17174) | 2 |
| 344 | 2026-05-31 | #17365 | `98eb19b2bc` | likely skip | | chore: version packages (alpha) (#17365) | 2 |
| 345 | 2026-06-01 | #17276 | `8f1c6e2a90` | review | | feat(core, mastracode): add scoped Harness V1 session owner IDs (#17276) | 4 |
| 346 | 2026-06-01 | #17387 | `bc0d14181d` | likely skip | | chore: version packages (alpha) (#17387) | 2 |
| 347 | 2026-06-01 | #17431 | `5d47971add` | review | | fix(mastracode): truncate TUI lines that exceed terminal width on narrow terminals (#17431) | 3 |
| 348 | 2026-06-01 | #17421 | `09a59230c3` | likely skip | | chore: version packages (alpha) (#17421) | 2 |
| 349 | 2026-06-02 | #17452 | `bf35088a0b` | likely skip | | chore: version packages (alpha) (#17452) | 2 |
| 350 | 2026-06-02 | #17476 | `0d2110ddd4` | likely skip | | chore: version packages (alpha) (#17476) | 2 |
| 351 | 2026-06-02 | #17480 | `bfbcf46aa8` | likely skip | | chore: version packages (alpha) (#17480) | 2 |
| 352 | 2026-06-02 | #17240 | `e2a838017a` | review | | 05 feat(core): add processor state signals (#17240) | 6 |
| 353 | 2026-06-02 | #17241 | `e751af2194` | review | | 06 feat(core): add notification inbox signals (#17241) | 16 |
| 354 | 2026-06-03 | #17447 | `77e686c264` | review | | 07 feat(mastracode): add GitHub signal subscriptions (#17447) | 27 |
| 355 | 2026-06-03 | #17411 | `23c3b74ac7` | review | | feat(core): compose Harness v1 session state (#17411) | 6 |
| 356 | 2026-06-03 | #17511 | `de71e4fb3e` | review | | fix(mastracode): fall back to legacy switchMode when no session is active (#17511) | 2 |
| 357 | 2026-06-03 | #17492 | `aeb4b1568d` | likely skip | | chore: version packages (alpha) (#17492) | 2 |
| 358 | 2026-06-03 | #17538 | `3d1efdeb39` | review | | feat(mastracode): auto-subscribe to branch PR via GitHub Signals on agent run end (#17538) | 3 |
