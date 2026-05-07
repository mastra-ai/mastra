# mastra

## 1.9.0-alpha.5

### Patch Changes

- Updated dependencies [[`bae019e`](https://github.com/mastra-ai/mastra/commit/bae019ecb6694da96909f7ec7b9eb3a0a33aa887), [`33f5061`](https://github.com/mastra-ai/mastra/commit/33f5061cd1c0335020c3faae61ce96de822854fa), [`99869ec`](https://github.com/mastra-ai/mastra/commit/99869ecb1f2aa6dfcc44fa4e843e5ee0344efa64), [`d86f031`](https://github.com/mastra-ai/mastra/commit/d86f031eb6b0b2570145afafea664e59bf688962)]:
  - @mastra/core@1.33.0-alpha.5
  - @mastra/deployer@1.33.0-alpha.5

## 1.9.0-alpha.4

### Minor Changes

- Updated the Studio observability UI with a filterable metrics dashboard and saved filter persistence. ([#15747](https://github.com/mastra-ai/mastra/pull/15747))

  **Metrics dashboard filters**

  The metrics page now includes a dimensional filter toolbar for `rootEntityType`, `entityName`, `entityId`, `tags`, `serviceName`, `environment`, and common identity/correlation IDs such as `threadId`, `resourceId`, `userId`, `organizationId`, `runId`, `sessionId`, `requestId`, and `experimentId`. Active metrics filters are reflected in the URL and can be saved to the Metrics page's own localStorage key.

  **Memory card**

  A new **Memory** card shows thread and resource activity in one tabbed card. Rows include run counts, token usage, and cost for the active date range and filters. The dashboard also restores the Total Threads and Total Resources KPI cards.

  **Drilldowns**

  Metrics cards can now link into Traces or Logs while preserving the active date range and relevant filters:
  - Latency, Trace Volume, Token Usage by Agent, and Model Usage & Cost expose header drilldown actions.
  - Token Usage by Agent, Trace Volume, and Model Usage & Cost rows/bars drill into Traces scoped to the clicked entity.
  - Trace Volume error segments can drill into Logs with `level=error`.
  - Memory rows drill into Traces scoped to the clicked `threadId` or `resourceId`.
  - Latency chart points narrow Traces to the clicked time bucket.

  Metrics-to-Traces drilldowns open the branch-oriented trace list so nested agent, workflow, and tool spans are visible. KPI cards remain non-clickable.

### Patch Changes

- Updated dependencies [[`9f17410`](https://github.com/mastra-ai/mastra/commit/9f1741080def23d42ee50b39887a385ae316a3c6), [`c6eb39e`](https://github.com/mastra-ai/mastra/commit/c6eb39ea6dca381c6563cb240237fbe608e02f93), [`900d086`](https://github.com/mastra-ai/mastra/commit/900d086bb737b9cf2fcf68f11b0389b801a2738c), [`4c0e286`](https://github.com/mastra-ai/mastra/commit/4c0e28637c9cfb4f416549b55e97ebfa13319dfc), [`25184ff`](https://github.com/mastra-ai/mastra/commit/25184ffaf1293ec95119426eb1a1f8d38831b96c), [`aebde9c`](https://github.com/mastra-ai/mastra/commit/aebde9cfacf56592c6b6350cae721740fe090b8a)]:
  - @mastra/core@1.33.0-alpha.4
  - @mastra/deployer@1.33.0-alpha.4

## 1.9.0-alpha.3

### Minor Changes

- Added `mastra api`, a machine-readable runtime CLI for calling Mastra server resources with JSON input and output. ([#16128](https://github.com/mastra-ai/mastra/pull/16128))

  The new API CLI supports agents, workflows, tools, MCP servers, memory threads, working memory, observability traces/logs/scores, datasets, and experiments. It includes schema-aware request handling so a single JSON input is split into path, query, and body fields based on server route contracts, plus ergonomic raw-input wrapping for tool execution.

  Exposed a route-derived server API schema manifest at runtime and generated CLI route metadata from it, enabling `--schema` output, response-shape-aware normalization, and server-aligned pagination output.

### Patch Changes

- Updated dependencies [[`087e413`](https://github.com/mastra-ai/mastra/commit/087e4133e5d6efa36619e9556c16750e4179c047), [`087e413`](https://github.com/mastra-ai/mastra/commit/087e4133e5d6efa36619e9556c16750e4179c047), [`087e413`](https://github.com/mastra-ai/mastra/commit/087e4133e5d6efa36619e9556c16750e4179c047)]:
  - @mastra/core@1.33.0-alpha.3
  - @mastra/deployer@1.33.0-alpha.3

## 1.8.2-alpha.2

### Patch Changes

- Updated dependencies [[`d1fdbd0`](https://github.com/mastra-ai/mastra/commit/d1fdbd012add5623cb7e6b7f882b605ab358bbb4), [`d91ebe2`](https://github.com/mastra-ai/mastra/commit/d91ebe28ee065d8f2ed6df741c3c07f58d359529)]:
  - @mastra/core@1.33.0-alpha.2
  - @mastra/deployer@1.33.0-alpha.2

## 1.8.2-alpha.1

### Patch Changes

- Updated dependencies [[`dccd8f1`](https://github.com/mastra-ai/mastra/commit/dccd8f1f8b8f1ad203b77556207e5529567c616d)]:
  - @mastra/core@1.33.0-alpha.1
  - @mastra/deployer@1.33.0-alpha.1

## 1.8.2-alpha.0

### Patch Changes

- Fixed peer dependency ranges so packages that use the Mastra server require a compatible Mastra core version. ([#16208](https://github.com/mastra-ai/mastra/pull/16208))

- Refactored the Mastra version dialog to use the new CodeBlock component and simplified the package versions copy button to an icon-only button with tooltip. ([#16202](https://github.com/mastra-ai/mastra/pull/16202))

- Updated dependencies [[`ac47842`](https://github.com/mastra-ai/mastra/commit/ac478427aa7a5f5fdaed633a911218689b438c60), [`0011a7e`](https://github.com/mastra-ai/mastra/commit/0011a7e2bba6a4fc97a638c3f4089c0e9308b37c)]:
  - @mastra/core@1.33.0-alpha.0
  - @mastra/deployer@1.33.0-alpha.0

## 1.8.1

### Patch Changes

- Updated dependencies [[`cc0469d`](https://github.com/mastra-ai/mastra/commit/cc0469d671d6f7a426013e4425f9501da6fa45f2)]:
  - @mastra/core@1.32.1
  - @mastra/deployer@1.32.1

## 1.8.1-alpha.0

### Patch Changes

- Updated dependencies [[`cc0469d`](https://github.com/mastra-ai/mastra/commit/cc0469d671d6f7a426013e4425f9501da6fa45f2)]:
  - @mastra/core@1.32.1-alpha.0
  - @mastra/deployer@1.32.1-alpha.0

## 1.8.0

### Minor Changes

- Added deploy suggestions commands for failed Studio and Server deploys. ([#15996](https://github.com/mastra-ai/mastra/pull/15996))

### Patch Changes

- Extend the schedules storage schema to support owned schedules and richer trigger audit. This is a breaking schema change to `mastra_schedules` and `mastra_schedule_triggers`; scheduled workflows are still in alpha so no compat shim is provided. ([#16166](https://github.com/mastra-ai/mastra/pull/16166))
  - `Schedule` gains optional `ownerType` / `ownerId` so a schedule row can be attributed to an owning subsystem (e.g. an agent that owns a heartbeat schedule). Workflow schedules leave both fields unset.
  - `ScheduleTrigger.status` is renamed to `outcome` and the type is widened to `ScheduleTriggerOutcome` so future outcome values can be added without another rename.
  - `ScheduleTrigger` gains a stable `id` primary key and new `triggerKind`, `parentTriggerId`, and `metadata` fields. `triggerKind` distinguishes `schedule-fire` rows from later `queue-drain` rows (used by upcoming heartbeat work); `parentTriggerId` links related rows; `metadata` carries outcome-specific context.
  - The libsql, pg, and mongodb adapters all add the new columns/indexes. Their `@mastra/core` peer dependency is tightened to `>=1.32.0-0 <2.0.0-0` so installing a new storage adapter against an older core (or vice-versa) surfaces a peer-dependency warning at install time instead of silently writing/reading the wrong field.
  - Scheduler producer, server schemas/handler, and client SDK types are updated to use the new fields. The `triggers` response on `GET /api/schedules/:id/triggers` now returns `outcome` instead of `status`.
  - The bundled Studio (Mastra CLI) is updated to read `outcome` so the schedule detail page keeps polling and rendering publish-failure rows correctly.

- Updated dependencies [[`6dcd65f`](https://github.com/mastra-ai/mastra/commit/6dcd65f2a34069e6dc43ba35f1d11119b9b40bef), [`86c0298`](https://github.com/mastra-ai/mastra/commit/86c0298e647306423c842f9d5ac827bd616bd13d), [`c05c9a1`](https://github.com/mastra-ai/mastra/commit/c05c9a13230988cef6d438a62f37760f31927bc7), [`ca28c23`](https://github.com/mastra-ai/mastra/commit/ca28c232a2f18801a6cf20fe053479237b4d4fb0), [`e24aacb`](https://github.com/mastra-ai/mastra/commit/e24aacba07bd66f5d95b636dc24016fca26b52cf), [`7679a63`](https://github.com/mastra-ai/mastra/commit/7679a634eae8e8ca459fd87538fdf72b4389b07f), [`7fce309`](https://github.com/mastra-ai/mastra/commit/7fce30912b14170bfc41f0ac736cca0f39fe0cd4), [`1d64a76`](https://github.com/mastra-ai/mastra/commit/1d64a765861a0772ea187bab76e5ed37bf82d042), [`1c2dda8`](https://github.com/mastra-ai/mastra/commit/1c2dda805fbfccc0abf55d4cb20cc34402dc3f0c), [`c721164`](https://github.com/mastra-ai/mastra/commit/c7211643f7ac861f83b19a3757cc921487fc9d75), [`1b55954`](https://github.com/mastra-ai/mastra/commit/1b559541c1e08a10e49d01ffc51a634dfc37a286), [`7997c2e`](https://github.com/mastra-ai/mastra/commit/7997c2e55ddd121562a4098cd8d2b89c68433bf1), [`5adc55e`](https://github.com/mastra-ai/mastra/commit/5adc55e63407be8ee977914957d68bcc2a075ceb), [`7679a63`](https://github.com/mastra-ai/mastra/commit/7679a634eae8e8ca459fd87538fdf72b4389b07f), [`a0d9b6d`](https://github.com/mastra-ai/mastra/commit/a0d9b6d6b810aeaa9e177a0dcc99a4402e609634), [`e97ccb9`](https://github.com/mastra-ai/mastra/commit/e97ccb900f8b7a390ce82c9f8eb8d6eb2c5e3777), [`c5daf48`](https://github.com/mastra-ai/mastra/commit/c5daf48556e98c46ae06caf00f92c249912007e9), [`70017d7`](https://github.com/mastra-ai/mastra/commit/70017d72ab741b5d7040e2a15c251a317782e39e), [`cd96779`](https://github.com/mastra-ai/mastra/commit/cd9677937f113b2856dc8b9f3d4bdabcee58bb2e), [`b0c7022`](https://github.com/mastra-ai/mastra/commit/b0c70224f80dad7c0cdbfb22cbff22e0f75c064f), [`e4942bc`](https://github.com/mastra-ai/mastra/commit/e4942bc7fdc903572f7d84f26d5e15f9d39c763d)]:
  - @mastra/core@1.32.0
  - @mastra/deployer@1.32.0

## 1.8.0-alpha.4

### Patch Changes

- Updated dependencies [[`7679a63`](https://github.com/mastra-ai/mastra/commit/7679a634eae8e8ca459fd87538fdf72b4389b07f), [`1d64a76`](https://github.com/mastra-ai/mastra/commit/1d64a765861a0772ea187bab76e5ed37bf82d042), [`7679a63`](https://github.com/mastra-ai/mastra/commit/7679a634eae8e8ca459fd87538fdf72b4389b07f), [`a0d9b6d`](https://github.com/mastra-ai/mastra/commit/a0d9b6d6b810aeaa9e177a0dcc99a4402e609634)]:
  - @mastra/core@1.32.0-alpha.4
  - @mastra/deployer@1.32.0-alpha.4

## 1.8.0-alpha.3

### Minor Changes

- Added deploy suggestions commands for failed Studio and Server deploys. ([#15996](https://github.com/mastra-ai/mastra/pull/15996))

### Patch Changes

- Extend the schedules storage schema to support owned schedules and richer trigger audit. This is a breaking schema change to `mastra_schedules` and `mastra_schedule_triggers`; scheduled workflows are still in alpha so no compat shim is provided. ([#16166](https://github.com/mastra-ai/mastra/pull/16166))
  - `Schedule` gains optional `ownerType` / `ownerId` so a schedule row can be attributed to an owning subsystem (e.g. an agent that owns a heartbeat schedule). Workflow schedules leave both fields unset.
  - `ScheduleTrigger.status` is renamed to `outcome` and the type is widened to `ScheduleTriggerOutcome` so future outcome values can be added without another rename.
  - `ScheduleTrigger` gains a stable `id` primary key and new `triggerKind`, `parentTriggerId`, and `metadata` fields. `triggerKind` distinguishes `schedule-fire` rows from later `queue-drain` rows (used by upcoming heartbeat work); `parentTriggerId` links related rows; `metadata` carries outcome-specific context.
  - The libsql, pg, and mongodb adapters all add the new columns/indexes. Their `@mastra/core` peer dependency is tightened to `>=1.32.0-0 <2.0.0-0` so installing a new storage adapter against an older core (or vice-versa) surfaces a peer-dependency warning at install time instead of silently writing/reading the wrong field.
  - Scheduler producer, server schemas/handler, and client SDK types are updated to use the new fields. The `triggers` response on `GET /api/schedules/:id/triggers` now returns `outcome` instead of `status`.
  - The bundled Studio (Mastra CLI) is updated to read `outcome` so the schedule detail page keeps polling and rendering publish-failure rows correctly.

- Updated dependencies [[`ca28c23`](https://github.com/mastra-ai/mastra/commit/ca28c232a2f18801a6cf20fe053479237b4d4fb0)]:
  - @mastra/core@1.32.0-alpha.3
  - @mastra/deployer@1.32.0-alpha.3

## 1.7.4-alpha.2

### Patch Changes

- Updated dependencies [[`86c0298`](https://github.com/mastra-ai/mastra/commit/86c0298e647306423c842f9d5ac827bd616bd13d), [`7fce309`](https://github.com/mastra-ai/mastra/commit/7fce30912b14170bfc41f0ac736cca0f39fe0cd4), [`7997c2e`](https://github.com/mastra-ai/mastra/commit/7997c2e55ddd121562a4098cd8d2b89c68433bf1), [`e97ccb9`](https://github.com/mastra-ai/mastra/commit/e97ccb900f8b7a390ce82c9f8eb8d6eb2c5e3777), [`c5daf48`](https://github.com/mastra-ai/mastra/commit/c5daf48556e98c46ae06caf00f92c249912007e9), [`cd96779`](https://github.com/mastra-ai/mastra/commit/cd9677937f113b2856dc8b9f3d4bdabcee58bb2e)]:
  - @mastra/core@1.32.0-alpha.2
  - @mastra/deployer@1.32.0-alpha.2

## 1.7.4-alpha.1

### Patch Changes

- Updated dependencies [[`c05c9a1`](https://github.com/mastra-ai/mastra/commit/c05c9a13230988cef6d438a62f37760f31927bc7), [`e24aacb`](https://github.com/mastra-ai/mastra/commit/e24aacba07bd66f5d95b636dc24016fca26b52cf), [`c721164`](https://github.com/mastra-ai/mastra/commit/c7211643f7ac861f83b19a3757cc921487fc9d75), [`1b55954`](https://github.com/mastra-ai/mastra/commit/1b559541c1e08a10e49d01ffc51a634dfc37a286), [`5adc55e`](https://github.com/mastra-ai/mastra/commit/5adc55e63407be8ee977914957d68bcc2a075ceb), [`70017d7`](https://github.com/mastra-ai/mastra/commit/70017d72ab741b5d7040e2a15c251a317782e39e), [`e4942bc`](https://github.com/mastra-ai/mastra/commit/e4942bc7fdc903572f7d84f26d5e15f9d39c763d)]:
  - @mastra/core@1.32.0-alpha.1
  - @mastra/deployer@1.32.0-alpha.1

## 1.7.4-alpha.0

### Patch Changes

- Updated dependencies [[`6dcd65f`](https://github.com/mastra-ai/mastra/commit/6dcd65f2a34069e6dc43ba35f1d11119b9b40bef), [`1c2dda8`](https://github.com/mastra-ai/mastra/commit/1c2dda805fbfccc0abf55d4cb20cc34402dc3f0c)]:
  - @mastra/core@1.31.1-alpha.0
  - @mastra/deployer@1.31.1-alpha.0

## 1.7.3

### Patch Changes

- Updated dependencies [[`4ea90c4`](https://github.com/mastra-ai/mastra/commit/4ea90c45de48858cdab6d82f45267617b337f34c), [`1723e09`](https://github.com/mastra-ai/mastra/commit/1723e099829892419ddbfe49287acfeac2522724), [`629f9e9`](https://github.com/mastra-ai/mastra/commit/629f9e9a7e56aa8f129515a3923c5813298790c7), [`25168fb`](https://github.com/mastra-ai/mastra/commit/25168fb9c1de9db7f8171df4f58ceb842c53aa29), [`ab34b5a`](https://github.com/mastra-ai/mastra/commit/ab34b5a2191b8e4353df1dbf7b9155e7d6628d79), [`5fb6c2a`](https://github.com/mastra-ai/mastra/commit/5fb6c2a95c1843cc231704b91354311fc1f34a71), [`2b0f355`](https://github.com/mastra-ai/mastra/commit/2b0f3553be3e9e5524da539a66e5cf82668440a4), [`394f0cf`](https://github.com/mastra-ai/mastra/commit/394f0cfc31e6b4d801219fdef2e9cc69e5bc8682), [`b2deb29`](https://github.com/mastra-ai/mastra/commit/b2deb29412b300c868655b5840463614fbb7962d), [`66644be`](https://github.com/mastra-ai/mastra/commit/66644beac1aa560f0e417956ff007c89341dc382), [`e109607`](https://github.com/mastra-ai/mastra/commit/e10960749251e34d46b480a20648c490fd30381b), [`310b953`](https://github.com/mastra-ai/mastra/commit/310b95345f302dcd5ba3ed862bdc96f059d44122), [`3d7f709`](https://github.com/mastra-ai/mastra/commit/3d7f709b615e588050bb6283c4ee5cfe2978cbde), [`48a42f1`](https://github.com/mastra-ai/mastra/commit/48a42f114a4006a95e0b7a1b5ad1a24815a175c2), [`8091c7c`](https://github.com/mastra-ai/mastra/commit/8091c7c944d15e13fef6d61b6cfd903f158d4006), [`2c83efc`](https://github.com/mastra-ai/mastra/commit/2c83efc4482b3efe50830e3b8b4ba9a8d219edff), [`43f0e1d`](https://github.com/mastra-ai/mastra/commit/43f0e1d5d5a74ba6fc746f2ad89ebe0c64777a7d), [`da0b9e2`](https://github.com/mastra-ai/mastra/commit/da0b9e2ba7ecc560213b426d6c097fe63946086e), [`282a10c`](https://github.com/mastra-ai/mastra/commit/282a10c9446e9922afe80e10e3770481c8ac8a28), [`04151c7`](https://github.com/mastra-ai/mastra/commit/04151c7dcea934b4fe9076708a23fac161195414), [`8091c7c`](https://github.com/mastra-ai/mastra/commit/8091c7c944d15e13fef6d61b6cfd903f158d4006)]:
  - @mastra/deployer@1.31.0
  - @mastra/core@1.31.0

## 1.7.3-alpha.6

### Patch Changes

- Updated dependencies:
  - @mastra/deployer@1.31.0-alpha.5
  - @mastra/core@1.31.0-alpha.5

## 1.7.3-alpha.5

### Patch Changes

- Updated dependencies [[`8091c7c`](https://github.com/mastra-ai/mastra/commit/8091c7c944d15e13fef6d61b6cfd903f158d4006), [`04151c7`](https://github.com/mastra-ai/mastra/commit/04151c7dcea934b4fe9076708a23fac161195414), [`8091c7c`](https://github.com/mastra-ai/mastra/commit/8091c7c944d15e13fef6d61b6cfd903f158d4006)]:
  - @mastra/core@1.31.0-alpha.4
  - @mastra/deployer@1.31.0-alpha.4

## 1.7.3-alpha.4

### Patch Changes

- Updated dependencies [[`b2deb29`](https://github.com/mastra-ai/mastra/commit/b2deb29412b300c868655b5840463614fbb7962d), [`66644be`](https://github.com/mastra-ai/mastra/commit/66644beac1aa560f0e417956ff007c89341dc382), [`310b953`](https://github.com/mastra-ai/mastra/commit/310b95345f302dcd5ba3ed862bdc96f059d44122), [`43f0e1d`](https://github.com/mastra-ai/mastra/commit/43f0e1d5d5a74ba6fc746f2ad89ebe0c64777a7d), [`da0b9e2`](https://github.com/mastra-ai/mastra/commit/da0b9e2ba7ecc560213b426d6c097fe63946086e)]:
  - @mastra/core@1.31.0-alpha.3
  - @mastra/deployer@1.31.0-alpha.3

## 1.7.3-alpha.3

### Patch Changes

- Updated dependencies [[`4ea90c4`](https://github.com/mastra-ai/mastra/commit/4ea90c45de48858cdab6d82f45267617b337f34c), [`2b0f355`](https://github.com/mastra-ai/mastra/commit/2b0f3553be3e9e5524da539a66e5cf82668440a4)]:
  - @mastra/deployer@1.31.0-alpha.2
  - @mastra/core@1.31.0-alpha.2

## 1.7.3-alpha.2

### Patch Changes

- Updated dependencies [[`e109607`](https://github.com/mastra-ai/mastra/commit/e10960749251e34d46b480a20648c490fd30381b)]:
  - @mastra/core@1.31.0-alpha.1
  - @mastra/deployer@1.31.0-alpha.1

## 1.7.3-alpha.1

### Patch Changes

- Updated dependencies [[`1723e09`](https://github.com/mastra-ai/mastra/commit/1723e099829892419ddbfe49287acfeac2522724), [`629f9e9`](https://github.com/mastra-ai/mastra/commit/629f9e9a7e56aa8f129515a3923c5813298790c7), [`25168fb`](https://github.com/mastra-ai/mastra/commit/25168fb9c1de9db7f8171df4f58ceb842c53aa29), [`ab34b5a`](https://github.com/mastra-ai/mastra/commit/ab34b5a2191b8e4353df1dbf7b9155e7d6628d79), [`5fb6c2a`](https://github.com/mastra-ai/mastra/commit/5fb6c2a95c1843cc231704b91354311fc1f34a71), [`394f0cf`](https://github.com/mastra-ai/mastra/commit/394f0cfc31e6b4d801219fdef2e9cc69e5bc8682), [`3d7f709`](https://github.com/mastra-ai/mastra/commit/3d7f709b615e588050bb6283c4ee5cfe2978cbde), [`48a42f1`](https://github.com/mastra-ai/mastra/commit/48a42f114a4006a95e0b7a1b5ad1a24815a175c2), [`2c83efc`](https://github.com/mastra-ai/mastra/commit/2c83efc4482b3efe50830e3b8b4ba9a8d219edff), [`282a10c`](https://github.com/mastra-ai/mastra/commit/282a10c9446e9922afe80e10e3770481c8ac8a28)]:
  - @mastra/core@1.31.0-alpha.0
  - @mastra/deployer@1.31.0-alpha.0

## 1.7.3-alpha.0

## 1.7.2

### Patch Changes

- Updated dependencies [[`920c757`](https://github.com/mastra-ai/mastra/commit/920c75799c6bd71787d86deaf654a35af4c839ca), [`d587199`](https://github.com/mastra-ai/mastra/commit/d5871993c0371bde2b0717d6b47194755baa1443), [`1fe2533`](https://github.com/mastra-ai/mastra/commit/1fe2533c4382ca6858aac7c4b63e888c2eac6541), [`f8694b6`](https://github.com/mastra-ai/mastra/commit/f8694b6fa0b7a5cde71d794c3bbef4957c55bcb8)]:
  - @mastra/core@1.30.0
  - @mastra/deployer@1.30.0

## 1.7.2-alpha.1

### Patch Changes

- Updated dependencies [[`920c757`](https://github.com/mastra-ai/mastra/commit/920c75799c6bd71787d86deaf654a35af4c839ca), [`1fe2533`](https://github.com/mastra-ai/mastra/commit/1fe2533c4382ca6858aac7c4b63e888c2eac6541), [`f8694b6`](https://github.com/mastra-ai/mastra/commit/f8694b6fa0b7a5cde71d794c3bbef4957c55bcb8)]:
  - @mastra/core@1.30.0-alpha.1
  - @mastra/deployer@1.30.0-alpha.1

## 1.7.2-alpha.0

### Patch Changes

- Updated dependencies [[`d587199`](https://github.com/mastra-ai/mastra/commit/d5871993c0371bde2b0717d6b47194755baa1443)]:
  - @mastra/core@1.29.2-alpha.0
  - @mastra/deployer@1.29.2-alpha.0

## 1.7.1

### Patch Changes

- Added a project config option to disable Mastra Platform observability during deploys. ([#15929](https://github.com/mastra-ai/mastra/pull/15929))

- Updated dependencies [[`6db978c`](https://github.com/mastra-ai/mastra/commit/6db978c42e94e75540a504f7230086f0b5cd35f9), [`512a013`](https://github.com/mastra-ai/mastra/commit/512a013f285aa9c0aa8f08a35b2ce09f9938b017), [`e9becde`](https://github.com/mastra-ai/mastra/commit/e9becdeed9176b9f8392e557bde12b933f99cf7a), [`703a443`](https://github.com/mastra-ai/mastra/commit/703a44390c587d9c0b8ae94ec4edd8afb2a74044), [`808df1b`](https://github.com/mastra-ai/mastra/commit/808df1b39358b5f10b7317107e42b1fda7c87185), [`8c8b66d`](https://github.com/mastra-ai/mastra/commit/8c8b66d97a79b78305dba90aae48133f27a01263)]:
  - @mastra/core@1.29.1
  - @mastra/deployer@1.29.1

## 1.7.1-alpha.2

### Patch Changes

- Added a project config option to disable Mastra Platform observability during deploys. ([#15929](https://github.com/mastra-ai/mastra/pull/15929))

- Updated dependencies [[`512a013`](https://github.com/mastra-ai/mastra/commit/512a013f285aa9c0aa8f08a35b2ce09f9938b017), [`e9becde`](https://github.com/mastra-ai/mastra/commit/e9becdeed9176b9f8392e557bde12b933f99cf7a)]:
  - @mastra/core@1.29.1-alpha.2
  - @mastra/deployer@1.29.1-alpha.2

## 1.7.1-alpha.1

### Patch Changes

- Updated dependencies [[`703a443`](https://github.com/mastra-ai/mastra/commit/703a44390c587d9c0b8ae94ec4edd8afb2a74044), [`808df1b`](https://github.com/mastra-ai/mastra/commit/808df1b39358b5f10b7317107e42b1fda7c87185), [`8c8b66d`](https://github.com/mastra-ai/mastra/commit/8c8b66d97a79b78305dba90aae48133f27a01263)]:
  - @mastra/core@1.29.1-alpha.1
  - @mastra/deployer@1.29.1-alpha.1

## 1.7.1-alpha.0

### Patch Changes

- Updated dependencies [[`6db978c`](https://github.com/mastra-ai/mastra/commit/6db978c42e94e75540a504f7230086f0b5cd35f9)]:
  - @mastra/core@1.29.1-alpha.0
  - @mastra/deployer@1.29.1-alpha.0

## 1.7.0

### Minor Changes

- Added Feedback tab to the trace/span detail view in Studio. When a trace has feedback (thumbs up/down, ratings, comments, corrections), a Feedback tab appears alongside Details and Scoring with a count badge. Clicking an entry opens a detail dialog showing the full feedback record including source, type, value, comment, and metadata. ([#15642](https://github.com/mastra-ai/mastra/pull/15642))

### Patch Changes

- Migrated the studio's theme handling to the shared `ThemeProvider` from `@mastra/playground-ui`. The settings page now uses a System / Light / Dark dropdown and applies the choice immediately. Existing theme preferences are preserved via a one-time migration; the studio continues to default to dark mode for new users. ([#15838](https://github.com/mastra-ai/mastra/pull/15838))

- Removed Prettier from the CLI install path so generated project setup no longer pulls in the prettier dependency. ([#15711](https://github.com/mastra-ai/mastra/pull/15711))

- Fixed 'Reading environment variables...' message showing before the user selects an env file during deployment. The spinner no longer wraps the interactive env file selection prompt. ([#15802](https://github.com/mastra-ai/mastra/pull/15802))

- Updated dependencies [[`28caa5b`](https://github.com/mastra-ai/mastra/commit/28caa5b032358545af2589ed90636eccb4dd9d2f), [`c1ae974`](https://github.com/mastra-ai/mastra/commit/c1ae97491f6e57378ce880c3a397778c42adcdf1), [`b510d36`](https://github.com/mastra-ai/mastra/commit/b510d368f73dab6be2e2c2bc99035aaef1fb7d7a), [`13b4d7c`](https://github.com/mastra-ai/mastra/commit/13b4d7c16de34dff9095d1cd80f22f544b6cfe75), [`7a7b313`](https://github.com/mastra-ai/mastra/commit/7a7b3138fb3bcf0b0c740eaea07971e43d330ef3), [`c04417b`](https://github.com/mastra-ai/mastra/commit/c04417ba0a2e4ded66da4352331ef29cd4bd1d79), [`cf25a03`](https://github.com/mastra-ai/mastra/commit/cf25a03132164b9dc1e5dccf7394824e33007c51), [`8a71261`](https://github.com/mastra-ai/mastra/commit/8a71261e3954ae617c6f8e25767b951f99438ab2), [`9e973b0`](https://github.com/mastra-ai/mastra/commit/9e973b010dacfa15ac82b0072897319f5234b90a), [`cd13713`](https://github.com/mastra-ai/mastra/commit/cd13713c01c29df6bfed64de204c5b588da222e1), [`dd934a0`](https://github.com/mastra-ai/mastra/commit/dd934a0982ce0f78712fbd559e4f2410bf594b39), [`ba6b0c5`](https://github.com/mastra-ai/mastra/commit/ba6b0c51bfce358554fd33c7f2bcd5593633f2ff), [`a6dac0a`](https://github.com/mastra-ai/mastra/commit/a6dac0a40c7181161b1add4e8534f962bcbc9aa7), [`5a4b1ee`](https://github.com/mastra-ai/mastra/commit/5a4b1ee80212969621228104995589c0fa59e575), [`5a4b1ee`](https://github.com/mastra-ai/mastra/commit/5a4b1ee80212969621228104995589c0fa59e575), [`5a4b1ee`](https://github.com/mastra-ai/mastra/commit/5a4b1ee80212969621228104995589c0fa59e575), [`6c8c6c7`](https://github.com/mastra-ai/mastra/commit/6c8c6c71518394321a4692614aa4b11f3bb0a343), [`5a4b1ee`](https://github.com/mastra-ai/mastra/commit/5a4b1ee80212969621228104995589c0fa59e575), [`7d056b6`](https://github.com/mastra-ai/mastra/commit/7d056b6ecf603cacaa0f663ff1df025ed885b6c1), [`9cef83b`](https://github.com/mastra-ai/mastra/commit/9cef83b8a642b8098747772921e3523b492bafbc), [`d30e215`](https://github.com/mastra-ai/mastra/commit/d30e2156c746bc9fd791745cec1cc24377b66789), [`021a60f`](https://github.com/mastra-ai/mastra/commit/021a60f1f3e0135a70ef23c58be7a9b3aaffe6b4), [`73f2809`](https://github.com/mastra-ai/mastra/commit/73f2809721db24e98cdf122539652a455211b450), [`aedeea4`](https://github.com/mastra-ai/mastra/commit/aedeea48a94f728323f040478775076b9574be50), [`26f1f94`](https://github.com/mastra-ai/mastra/commit/26f1f9490574b864ba1ecedf2c9632e0767a23bd), [`8126d86`](https://github.com/mastra-ai/mastra/commit/8126d8638411eacfafdc29036ac998e8757ea66f), [`73b45fa`](https://github.com/mastra-ai/mastra/commit/73b45facdef4fbcb8af710c50f0646f18619dbaa), [`ae97520`](https://github.com/mastra-ai/mastra/commit/ae975206fdb0f6ef03c4d5bf94f7dc7c3f706c02), [`7a7b313`](https://github.com/mastra-ai/mastra/commit/7a7b3138fb3bcf0b0c740eaea07971e43d330ef3), [`441670a`](https://github.com/mastra-ai/mastra/commit/441670a02c9dc7731c52674f55481e7848a84523)]:
  - @mastra/core@1.29.0
  - @mastra/deployer@1.29.0

## 1.7.0-alpha.6

### Patch Changes

- Updated dependencies [[`c1ae974`](https://github.com/mastra-ai/mastra/commit/c1ae97491f6e57378ce880c3a397778c42adcdf1), [`13b4d7c`](https://github.com/mastra-ai/mastra/commit/13b4d7c16de34dff9095d1cd80f22f544b6cfe75), [`5a4b1ee`](https://github.com/mastra-ai/mastra/commit/5a4b1ee80212969621228104995589c0fa59e575), [`5a4b1ee`](https://github.com/mastra-ai/mastra/commit/5a4b1ee80212969621228104995589c0fa59e575), [`5a4b1ee`](https://github.com/mastra-ai/mastra/commit/5a4b1ee80212969621228104995589c0fa59e575), [`6c8c6c7`](https://github.com/mastra-ai/mastra/commit/6c8c6c71518394321a4692614aa4b11f3bb0a343), [`5a4b1ee`](https://github.com/mastra-ai/mastra/commit/5a4b1ee80212969621228104995589c0fa59e575), [`ec4cb26`](https://github.com/mastra-ai/mastra/commit/ec4cb26919972eb2031fea510f8f013e1d5b7ee2)]:
  - @mastra/core@1.29.0-alpha.6
  - @mastra/deployer@1.29.0-alpha.6

## 1.7.0-alpha.5

### Patch Changes

- Updated dependencies [[`28caa5b`](https://github.com/mastra-ai/mastra/commit/28caa5b032358545af2589ed90636eccb4dd9d2f), [`7d056b6`](https://github.com/mastra-ai/mastra/commit/7d056b6ecf603cacaa0f663ff1df025ed885b6c1), [`26f1f94`](https://github.com/mastra-ai/mastra/commit/26f1f9490574b864ba1ecedf2c9632e0767a23bd)]:
  - @mastra/core@1.29.0-alpha.5
  - @mastra/deployer@1.29.0-alpha.5

## 1.7.0-alpha.4

### Patch Changes

- Migrated the studio's theme handling to the shared `ThemeProvider` from `@mastra/playground-ui`. The settings page now uses a System / Light / Dark dropdown and applies the choice immediately. Existing theme preferences are preserved via a one-time migration; the studio continues to default to dark mode for new users. ([#15838](https://github.com/mastra-ai/mastra/pull/15838))

- Fixed 'Reading environment variables...' message showing before the user selects an env file during deployment. The spinner no longer wraps the interactive env file selection prompt. ([#15802](https://github.com/mastra-ai/mastra/pull/15802))

- Updated dependencies [[`8a71261`](https://github.com/mastra-ai/mastra/commit/8a71261e3954ae617c6f8e25767b951f99438ab2), [`021a60f`](https://github.com/mastra-ai/mastra/commit/021a60f1f3e0135a70ef23c58be7a9b3aaffe6b4)]:
  - @mastra/core@1.29.0-alpha.4
  - @mastra/deployer@1.29.0-alpha.4

## 1.7.0-alpha.3

### Minor Changes

- Added Feedback tab to the trace/span detail view in Studio. When a trace has feedback (thumbs up/down, ratings, comments, corrections), a Feedback tab appears alongside Details and Scoring with a count badge. Clicking an entry opens a detail dialog showing the full feedback record including source, type, value, comment, and metadata. ([#15642](https://github.com/mastra-ai/mastra/pull/15642))

### Patch Changes

- Updated dependencies [[`c04417b`](https://github.com/mastra-ai/mastra/commit/c04417ba0a2e4ded66da4352331ef29cd4bd1d79), [`cf25a03`](https://github.com/mastra-ai/mastra/commit/cf25a03132164b9dc1e5dccf7394824e33007c51), [`ba6b0c5`](https://github.com/mastra-ai/mastra/commit/ba6b0c51bfce358554fd33c7f2bcd5593633f2ff)]:
  - @mastra/core@1.29.0-alpha.3
  - @mastra/deployer@1.29.0-alpha.3

## 1.6.4-alpha.2

### Patch Changes

- Updated dependencies [[`9e973b0`](https://github.com/mastra-ai/mastra/commit/9e973b010dacfa15ac82b0072897319f5234b90a), [`dd934a0`](https://github.com/mastra-ai/mastra/commit/dd934a0982ce0f78712fbd559e4f2410bf594b39), [`73f2809`](https://github.com/mastra-ai/mastra/commit/73f2809721db24e98cdf122539652a455211b450), [`aedeea4`](https://github.com/mastra-ai/mastra/commit/aedeea48a94f728323f040478775076b9574be50), [`8126d86`](https://github.com/mastra-ai/mastra/commit/8126d8638411eacfafdc29036ac998e8757ea66f), [`ae97520`](https://github.com/mastra-ai/mastra/commit/ae975206fdb0f6ef03c4d5bf94f7dc7c3f706c02), [`441670a`](https://github.com/mastra-ai/mastra/commit/441670a02c9dc7731c52674f55481e7848a84523)]:
  - @mastra/core@1.29.0-alpha.2
  - @mastra/deployer@1.29.0-alpha.2

## 1.6.4-alpha.1

### Patch Changes

- Updated dependencies [[`7a7b313`](https://github.com/mastra-ai/mastra/commit/7a7b3138fb3bcf0b0c740eaea07971e43d330ef3), [`a6dac0a`](https://github.com/mastra-ai/mastra/commit/a6dac0a40c7181161b1add4e8534f962bcbc9aa7), [`9cef83b`](https://github.com/mastra-ai/mastra/commit/9cef83b8a642b8098747772921e3523b492bafbc), [`d30e215`](https://github.com/mastra-ai/mastra/commit/d30e2156c746bc9fd791745cec1cc24377b66789), [`73b45fa`](https://github.com/mastra-ai/mastra/commit/73b45facdef4fbcb8af710c50f0646f18619dbaa), [`7a7b313`](https://github.com/mastra-ai/mastra/commit/7a7b3138fb3bcf0b0c740eaea07971e43d330ef3)]:
  - @mastra/core@1.29.0-alpha.1
  - @mastra/deployer@1.29.0-alpha.1

## 1.6.4-alpha.0

### Patch Changes

- Removed Prettier from the CLI install path so generated project setup no longer pulls in the prettier dependency. ([#15711](https://github.com/mastra-ai/mastra/pull/15711))

- Updated dependencies [[`b510d36`](https://github.com/mastra-ai/mastra/commit/b510d368f73dab6be2e2c2bc99035aaef1fb7d7a), [`cd13713`](https://github.com/mastra-ai/mastra/commit/cd13713c01c29df6bfed64de204c5b588da222e1)]:
  - @mastra/core@1.29.0-alpha.0
  - @mastra/deployer@1.29.0-alpha.0

## 1.6.3

### Patch Changes

- Fixed browser tool calls not rendering in Studio chat UI. Browser tools (`browser_*` and `stagehand_*`) were filtered from the chat, making it look like the agent was looping or idle. They now render inline alongside other tool calls. ([#15680](https://github.com/mastra-ai/mastra/pull/15680))

- Correct success message to match actual file created when no API key is provided during init ([#15651](https://github.com/mastra-ai/mastra/pull/15651))

- Fixed provider picker icons appearing black instead of white in Studio dark mode. Restored the Tailwind v4 class-based dark variant in the playground CSS so `dark:` utilities fire when users toggle Studio's theme to dark, regardless of the OS color scheme preference. ([#15672](https://github.com/mastra-ai/mastra/pull/15672))

- Fixed `mastra migrate` guidance for monorepos and other custom layouts. ([#15685](https://github.com/mastra-ai/mastra/pull/15685))
  - Relative `--dir` now resolves from `--root` (or cwd if `--root` is not provided).
  - When neither `src/mastra/index.ts` nor `src/mastra/index.js` is present, the CLI now prints actionable `--dir` and `--root` instructions instead of a raw file-missing error.
  - The error message also includes detected `src/mastra/index.ts|js` candidates under the selected root to help users choose the correct path quickly.

- Updated dependencies [[`733bf53`](https://github.com/mastra-ai/mastra/commit/733bf53d9352aedd3ef38c3d501edb275b65b43c), [`5405b3b`](https://github.com/mastra-ai/mastra/commit/5405b3b35325c5b8fb34fc7ac109bd2feb7bb6fe), [`45e29cb`](https://github.com/mastra-ai/mastra/commit/45e29cb5b5737f3083eb3852db02b944b9cf37ed), [`750b4d3`](https://github.com/mastra-ai/mastra/commit/750b4d3d8231f92e769b2c485921ac5a8ca639b9), [`c321127`](https://github.com/mastra-ai/mastra/commit/c3211275fc195de9ad1ead2746b354beb8eae6e8), [`a07bcef`](https://github.com/mastra-ai/mastra/commit/a07bcefea77c03d6d322caad973dca49b4b15fa1), [`696694e`](https://github.com/mastra-ai/mastra/commit/696694e00f29241a25dd1a1b749afa06c3a626b4), [`b084a80`](https://github.com/mastra-ai/mastra/commit/b084a800db0f82d62e1fc3d6e3e3480da1ba5a53), [`82b7a96`](https://github.com/mastra-ai/mastra/commit/82b7a964169636c1d1e0c694fc892a213b0179d5), [`df97812`](https://github.com/mastra-ai/mastra/commit/df97812bd949dcafeb074b80ecab501724b49c3b), [`8bbe360`](https://github.com/mastra-ai/mastra/commit/8bbe36042af7fc4be0244dffd8913f6795179421), [`f6b8ba8`](https://github.com/mastra-ai/mastra/commit/f6b8ba8dbf533b7a8db90c72b6805ddc804a3a72), [`a07bcef`](https://github.com/mastra-ai/mastra/commit/a07bcefea77c03d6d322caad973dca49b4b15fa1)]:
  - @mastra/core@1.28.0
  - @mastra/deployer@1.28.0

## 1.6.3-alpha.2

### Patch Changes

- Updated dependencies [[`45e29cb`](https://github.com/mastra-ai/mastra/commit/45e29cb5b5737f3083eb3852db02b944b9cf37ed), [`696694e`](https://github.com/mastra-ai/mastra/commit/696694e00f29241a25dd1a1b749afa06c3a626b4)]:
  - @mastra/core@1.28.0-alpha.2
  - @mastra/deployer@1.28.0-alpha.2

## 1.6.3-alpha.1

### Patch Changes

- Updated dependencies [[`750b4d3`](https://github.com/mastra-ai/mastra/commit/750b4d3d8231f92e769b2c485921ac5a8ca639b9)]:
  - @mastra/core@1.28.0-alpha.1
  - @mastra/deployer@1.28.0-alpha.1

## 1.6.3-alpha.0

### Patch Changes

- Fixed browser tool calls not rendering in Studio chat UI. Browser tools (`browser_*` and `stagehand_*`) were filtered from the chat, making it look like the agent was looping or idle. They now render inline alongside other tool calls. ([#15680](https://github.com/mastra-ai/mastra/pull/15680))

- Fixed provider picker icons appearing black instead of white in Studio dark mode. Restored the Tailwind v4 class-based dark variant in the playground CSS so `dark:` utilities fire when users toggle Studio's theme to dark, regardless of the OS color scheme preference. ([#15672](https://github.com/mastra-ai/mastra/pull/15672))

- Fixed `mastra migrate` guidance for monorepos and other custom layouts. ([#15685](https://github.com/mastra-ai/mastra/pull/15685))
  - Relative `--dir` now resolves from `--root` (or cwd if `--root` is not provided).
  - When neither `src/mastra/index.ts` nor `src/mastra/index.js` is present, the CLI now prints actionable `--dir` and `--root` instructions instead of a raw file-missing error.
  - The error message also includes detected `src/mastra/index.ts|js` candidates under the selected root to help users choose the correct path quickly.

- Updated dependencies [[`733bf53`](https://github.com/mastra-ai/mastra/commit/733bf53d9352aedd3ef38c3d501edb275b65b43c), [`5405b3b`](https://github.com/mastra-ai/mastra/commit/5405b3b35325c5b8fb34fc7ac109bd2feb7bb6fe), [`c321127`](https://github.com/mastra-ai/mastra/commit/c3211275fc195de9ad1ead2746b354beb8eae6e8), [`a07bcef`](https://github.com/mastra-ai/mastra/commit/a07bcefea77c03d6d322caad973dca49b4b15fa1), [`b084a80`](https://github.com/mastra-ai/mastra/commit/b084a800db0f82d62e1fc3d6e3e3480da1ba5a53), [`82b7a96`](https://github.com/mastra-ai/mastra/commit/82b7a964169636c1d1e0c694fc892a213b0179d5), [`df97812`](https://github.com/mastra-ai/mastra/commit/df97812bd949dcafeb074b80ecab501724b49c3b), [`8bbe360`](https://github.com/mastra-ai/mastra/commit/8bbe36042af7fc4be0244dffd8913f6795179421), [`f6b8ba8`](https://github.com/mastra-ai/mastra/commit/f6b8ba8dbf533b7a8db90c72b6805ddc804a3a72), [`a07bcef`](https://github.com/mastra-ai/mastra/commit/a07bcefea77c03d6d322caad973dca49b4b15fa1)]:
  - @mastra/core@1.28.0-alpha.0
  - @mastra/deployer@1.28.0-alpha.0

## 1.6.2

### Patch Changes

- Improved server deploy errors: the CLI now shows the platform API message (for example billing or payment errors) instead of only a generic status code. ([#15459](https://github.com/mastra-ai/mastra/pull/15459))

- Improved env file handling for `mastra server deploy` and `mastra studio deploy`. Deploy now selects a single env file instead of silently merging multiple files. When multiple `.env` files exist, you are prompted to choose one. Added `--env-file` to specify the file directly (e.g. `--env-file .env.staging`), which is required in non-interactive mode when multiple env files are present. ([#15641](https://github.com/mastra-ai/mastra/pull/15641))

- Hide internal log during `mastra dev` startup (that was previously already hidden but got exposed again by a recent change) ([#15616](https://github.com/mastra-ai/mastra/pull/15616))

- Updated dependencies [[`f112db1`](https://github.com/mastra-ai/mastra/commit/f112db179557ae9b5a0f1d25dc47f928d7d61cd9), [`21d9706`](https://github.com/mastra-ai/mastra/commit/21d970604d89eee970cbf8013d26d7551aff6ea5), [`0a0aa94`](https://github.com/mastra-ai/mastra/commit/0a0aa94729592e99885af2efb90c56aaada62247), [`ed07df3`](https://github.com/mastra-ai/mastra/commit/ed07df32a9d539c8261e892fc1bade783f5b41a6), [`01a7d51`](https://github.com/mastra-ai/mastra/commit/01a7d513493d21562f677f98550f7ceb165ba78c)]:
  - @mastra/core@1.27.0
  - @mastra/deployer@1.27.0

## 1.6.2-alpha.2

### Patch Changes

- Updated dependencies [[`ed07df3`](https://github.com/mastra-ai/mastra/commit/ed07df32a9d539c8261e892fc1bade783f5b41a6)]:
  - @mastra/core@1.27.0-alpha.2
  - @mastra/deployer@1.27.0-alpha.2

## 1.6.2-alpha.1

### Patch Changes

- Improved server deploy errors: the CLI now shows the platform API message (for example billing or payment errors) instead of only a generic status code. ([#15459](https://github.com/mastra-ai/mastra/pull/15459))

- Improved env file handling for `mastra server deploy` and `mastra studio deploy`. Deploy now selects a single env file instead of silently merging multiple files. When multiple `.env` files exist, you are prompted to choose one. Added `--env-file` to specify the file directly (e.g. `--env-file .env.staging`), which is required in non-interactive mode when multiple env files are present. ([#15641](https://github.com/mastra-ai/mastra/pull/15641))

- Updated dependencies [[`0a0aa94`](https://github.com/mastra-ai/mastra/commit/0a0aa94729592e99885af2efb90c56aaada62247), [`01a7d51`](https://github.com/mastra-ai/mastra/commit/01a7d513493d21562f677f98550f7ceb165ba78c)]:
  - @mastra/core@1.27.0-alpha.1
  - @mastra/deployer@1.27.0-alpha.1

## 1.6.2-alpha.0

### Patch Changes

- Hide internal log during `mastra dev` startup (that was previously already hidden but got exposed again by a recent change) ([#15616](https://github.com/mastra-ai/mastra/pull/15616))

- Updated dependencies [[`f112db1`](https://github.com/mastra-ai/mastra/commit/f112db179557ae9b5a0f1d25dc47f928d7d61cd9), [`21d9706`](https://github.com/mastra-ai/mastra/commit/21d970604d89eee970cbf8013d26d7551aff6ea5)]:
  - @mastra/core@1.26.1-alpha.0
  - @mastra/deployer@1.26.1-alpha.0

## 1.6.1

### Patch Changes

- Fixed a crash in the Agent Editor when opening a code-defined agent whose `Workspace` discovers skills. The editor now loads cleanly for these agents instead of showing the default error screen. ([#15559](https://github.com/mastra-ai/mastra/pull/15559))

- Fixed Ctrl+C on `mastra dev` so the dev server shuts down cleanly without freezing the terminal or printing warnings. Fixes #15446. ([#15558](https://github.com/mastra-ai/mastra/pull/15558))

- dependencies updates: ([#15525](https://github.com/mastra-ai/mastra/pull/15525))
  - Updated dependency [`prettier@^3.8.3` ↗︎](https://www.npmjs.com/package/prettier/v/3.8.3) (from `^3.8.1`, in `dependencies`)
- Updated dependencies [[`20f59b8`](https://github.com/mastra-ai/mastra/commit/20f59b876cf91199efbc49a0e36b391240708f08), [`20f59b8`](https://github.com/mastra-ai/mastra/commit/20f59b876cf91199efbc49a0e36b391240708f08), [`aba393e`](https://github.com/mastra-ai/mastra/commit/aba393e2da7390c69b80e516a4f153cda6f09376), [`3d83d06`](https://github.com/mastra-ai/mastra/commit/3d83d06f776f00fb5f4163dddd32a030c5c20844), [`e2687a7`](https://github.com/mastra-ai/mastra/commit/e2687a7408790c384563816a9a28ed06735684c9), [`fdd54cf`](https://github.com/mastra-ai/mastra/commit/fdd54cf612a9af876e9fdd85e534454f6e7dd518), [`6315317`](https://github.com/mastra-ai/mastra/commit/63153175fe9a7b224e5be7c209bbebc01dd9b0d5), [`a371ac5`](https://github.com/mastra-ai/mastra/commit/a371ac534aa1bb368a1acf9d8b313378dfdc787e), [`0474c2b`](https://github.com/mastra-ai/mastra/commit/0474c2b2e7c7e1ad8691dca031284841391ff1ef), [`0a5fa1d`](https://github.com/mastra-ai/mastra/commit/0a5fa1d3cb0583889d06687155f26fd7d2edc76c), [`7e0e63e`](https://github.com/mastra-ai/mastra/commit/7e0e63e2e485e84442351f4c7a79a424c83539dc), [`ea43e64`](https://github.com/mastra-ai/mastra/commit/ea43e646dd95d507694b6112b0bf1df22ad552b2), [`f607106`](https://github.com/mastra-ai/mastra/commit/f607106854c6416c4a07d4082604b9f66d047221), [`30456b6`](https://github.com/mastra-ai/mastra/commit/30456b6b08c8fd17e109dd093b73d93b65e83bc5), [`9d11a8c`](https://github.com/mastra-ai/mastra/commit/9d11a8c1c8924eb975a245a5884d40ca1b7e0491), [`9d3b24b`](https://github.com/mastra-ai/mastra/commit/9d3b24b19407ae9c09586cf7766d38dc4dff4a69), [`00d1b16`](https://github.com/mastra-ai/mastra/commit/00d1b16b401199cb294fa23f43336547db4dca9b), [`47cee3e`](https://github.com/mastra-ai/mastra/commit/47cee3e137fe39109cf7fffd2a8cf47b76dc702e), [`62919a6`](https://github.com/mastra-ai/mastra/commit/62919a6ee0fbf3779ad21a97b1ec6696515d5104), [`d246696`](https://github.com/mastra-ai/mastra/commit/d246696139a3144a5b21b042d41c532688e957e1), [`354f9ce`](https://github.com/mastra-ai/mastra/commit/354f9ce1ca6af2074b6a196a23f8ec30012dccca), [`16e34ca`](https://github.com/mastra-ai/mastra/commit/16e34caa98b9a114b17a6125e4e3fd87f169d0d0), [`7020c06`](https://github.com/mastra-ai/mastra/commit/7020c0690b199d9da337f0e805f16948e557922e), [`8786a61`](https://github.com/mastra-ai/mastra/commit/8786a61fa54ba265f85eeff9985ca39863d18bb6), [`9467ea8`](https://github.com/mastra-ai/mastra/commit/9467ea87695749a53dfc041576410ebf9ee7bb67), [`7338d94`](https://github.com/mastra-ai/mastra/commit/7338d949380cf68b095342e8e42610dc51d557c1), [`c80dc16`](https://github.com/mastra-ai/mastra/commit/c80dc16e113e6cc159f510ffde501ad4711b2189), [`af8a57e`](https://github.com/mastra-ai/mastra/commit/af8a57ed9ba9685ad8601d5b71ae3706da6222f9), [`d63ffdb`](https://github.com/mastra-ai/mastra/commit/d63ffdbb2c11e76fe5ea45faab44bc15460f010c), [`47cee3e`](https://github.com/mastra-ai/mastra/commit/47cee3e137fe39109cf7fffd2a8cf47b76dc702e), [`1bd5104`](https://github.com/mastra-ai/mastra/commit/1bd51048b6da93507276d6623e3fd96a9e1a8944), [`e9837b5`](https://github.com/mastra-ai/mastra/commit/e9837b53699e18711b09e0ca010a4106376f2653), [`8f1b280`](https://github.com/mastra-ai/mastra/commit/8f1b280b7fe6999ec654f160cb69c1a8719e7a57), [`92dcf02`](https://github.com/mastra-ai/mastra/commit/92dcf029294210ac91b090900c1a0555a425c57a), [`0fd90a2`](https://github.com/mastra-ai/mastra/commit/0fd90a215caf5fca8099c15a67ca03e4427747a3), [`8fb2405`](https://github.com/mastra-ai/mastra/commit/8fb2405138f2d208b7962ad03f121ca25bcc28c5), [`12df98c`](https://github.com/mastra-ai/mastra/commit/12df98c4904643d9481f5c78f3bed443725b4c96)]:
  - @mastra/core@1.26.0
  - @mastra/deployer@1.26.0

## 1.6.1-alpha.13

### Patch Changes

- Updated dependencies:
  - @mastra/deployer@1.26.0-alpha.13
  - @mastra/core@1.26.0-alpha.13

## 1.6.1-alpha.12

### Patch Changes

- Fixed Ctrl+C on `mastra dev` so the dev server shuts down cleanly without freezing the terminal or printing warnings. Fixes #15446. ([#15558](https://github.com/mastra-ai/mastra/pull/15558))

- Updated dependencies [[`a371ac5`](https://github.com/mastra-ai/mastra/commit/a371ac534aa1bb368a1acf9d8b313378dfdc787e), [`47cee3e`](https://github.com/mastra-ai/mastra/commit/47cee3e137fe39109cf7fffd2a8cf47b76dc702e), [`c80dc16`](https://github.com/mastra-ai/mastra/commit/c80dc16e113e6cc159f510ffde501ad4711b2189), [`47cee3e`](https://github.com/mastra-ai/mastra/commit/47cee3e137fe39109cf7fffd2a8cf47b76dc702e)]:
  - @mastra/core@1.26.0-alpha.12
  - @mastra/deployer@1.26.0-alpha.12

## 1.6.1-alpha.11

### Patch Changes

- Updated dependencies [[`20f59b8`](https://github.com/mastra-ai/mastra/commit/20f59b876cf91199efbc49a0e36b391240708f08), [`20f59b8`](https://github.com/mastra-ai/mastra/commit/20f59b876cf91199efbc49a0e36b391240708f08), [`e2687a7`](https://github.com/mastra-ai/mastra/commit/e2687a7408790c384563816a9a28ed06735684c9), [`8f1b280`](https://github.com/mastra-ai/mastra/commit/8f1b280b7fe6999ec654f160cb69c1a8719e7a57), [`12df98c`](https://github.com/mastra-ai/mastra/commit/12df98c4904643d9481f5c78f3bed443725b4c96)]:
  - @mastra/core@1.26.0-alpha.11
  - @mastra/deployer@1.26.0-alpha.11

## 1.6.1-alpha.10

### Patch Changes

- Fixed a crash in the Agent Editor when opening a code-defined agent whose `Workspace` discovers skills. The editor now loads cleanly for these agents instead of showing the default error screen. ([#15559](https://github.com/mastra-ai/mastra/pull/15559))

- Updated dependencies [[`aba393e`](https://github.com/mastra-ai/mastra/commit/aba393e2da7390c69b80e516a4f153cda6f09376), [`0a5fa1d`](https://github.com/mastra-ai/mastra/commit/0a5fa1d3cb0583889d06687155f26fd7d2edc76c), [`ea43e64`](https://github.com/mastra-ai/mastra/commit/ea43e646dd95d507694b6112b0bf1df22ad552b2), [`00d1b16`](https://github.com/mastra-ai/mastra/commit/00d1b16b401199cb294fa23f43336547db4dca9b), [`af8a57e`](https://github.com/mastra-ai/mastra/commit/af8a57ed9ba9685ad8601d5b71ae3706da6222f9)]:
  - @mastra/core@1.26.0-alpha.10
  - @mastra/deployer@1.26.0-alpha.10

## 1.6.1-alpha.9

### Patch Changes

- dependencies updates: ([#15525](https://github.com/mastra-ai/mastra/pull/15525))
  - Updated dependency [`prettier@^3.8.3` ↗︎](https://www.npmjs.com/package/prettier/v/3.8.3) (from `^3.8.1`, in `dependencies`)
- Updated dependencies [[`16e34ca`](https://github.com/mastra-ai/mastra/commit/16e34caa98b9a114b17a6125e4e3fd87f169d0d0)]:
  - @mastra/core@1.26.0-alpha.9
  - @mastra/deployer@1.26.0-alpha.9

## 1.6.1-alpha.8

### Patch Changes

- Updated dependencies [[`1bd5104`](https://github.com/mastra-ai/mastra/commit/1bd51048b6da93507276d6623e3fd96a9e1a8944)]:
  - @mastra/core@1.26.0-alpha.8
  - @mastra/deployer@1.26.0-alpha.8

## 1.6.1-alpha.7

### Patch Changes

- Updated dependencies [[`8786a61`](https://github.com/mastra-ai/mastra/commit/8786a61fa54ba265f85eeff9985ca39863d18bb6), [`8fb2405`](https://github.com/mastra-ai/mastra/commit/8fb2405138f2d208b7962ad03f121ca25bcc28c5)]:
  - @mastra/core@1.26.0-alpha.7
  - @mastra/deployer@1.26.0-alpha.7

## 1.6.1-alpha.6

### Patch Changes

- Updated dependencies [[`6315317`](https://github.com/mastra-ai/mastra/commit/63153175fe9a7b224e5be7c209bbebc01dd9b0d5), [`9d3b24b`](https://github.com/mastra-ai/mastra/commit/9d3b24b19407ae9c09586cf7766d38dc4dff4a69)]:
  - @mastra/core@1.26.0-alpha.6
  - @mastra/deployer@1.26.0-alpha.6

## 1.6.1-alpha.5

### Patch Changes

- Updated dependencies [[`92dcf02`](https://github.com/mastra-ai/mastra/commit/92dcf029294210ac91b090900c1a0555a425c57a)]:
  - @mastra/core@1.26.0-alpha.5
  - @mastra/deployer@1.26.0-alpha.5

## 1.6.1-alpha.4

### Patch Changes

- Updated dependencies [[`0474c2b`](https://github.com/mastra-ai/mastra/commit/0474c2b2e7c7e1ad8691dca031284841391ff1ef), [`f607106`](https://github.com/mastra-ai/mastra/commit/f607106854c6416c4a07d4082604b9f66d047221), [`62919a6`](https://github.com/mastra-ai/mastra/commit/62919a6ee0fbf3779ad21a97b1ec6696515d5104), [`0fd90a2`](https://github.com/mastra-ai/mastra/commit/0fd90a215caf5fca8099c15a67ca03e4427747a3)]:
  - @mastra/core@1.26.0-alpha.4
  - @mastra/deployer@1.26.0-alpha.4

## 1.6.1-alpha.3

### Patch Changes

- Updated dependencies [[`fdd54cf`](https://github.com/mastra-ai/mastra/commit/fdd54cf612a9af876e9fdd85e534454f6e7dd518), [`30456b6`](https://github.com/mastra-ai/mastra/commit/30456b6b08c8fd17e109dd093b73d93b65e83bc5), [`9d11a8c`](https://github.com/mastra-ai/mastra/commit/9d11a8c1c8924eb975a245a5884d40ca1b7e0491), [`d246696`](https://github.com/mastra-ai/mastra/commit/d246696139a3144a5b21b042d41c532688e957e1), [`354f9ce`](https://github.com/mastra-ai/mastra/commit/354f9ce1ca6af2074b6a196a23f8ec30012dccca), [`e9837b5`](https://github.com/mastra-ai/mastra/commit/e9837b53699e18711b09e0ca010a4106376f2653)]:
  - @mastra/core@1.26.0-alpha.3
  - @mastra/deployer@1.26.0-alpha.3

## 1.6.1-alpha.2

### Patch Changes

- Updated dependencies [[`3d83d06`](https://github.com/mastra-ai/mastra/commit/3d83d06f776f00fb5f4163dddd32a030c5c20844), [`7e0e63e`](https://github.com/mastra-ai/mastra/commit/7e0e63e2e485e84442351f4c7a79a424c83539dc), [`9467ea8`](https://github.com/mastra-ai/mastra/commit/9467ea87695749a53dfc041576410ebf9ee7bb67), [`7338d94`](https://github.com/mastra-ai/mastra/commit/7338d949380cf68b095342e8e42610dc51d557c1)]:
  - @mastra/core@1.26.0-alpha.2
  - @mastra/deployer@1.26.0-alpha.2

## 1.6.1-alpha.1

### Patch Changes

- Updated dependencies [[`7020c06`](https://github.com/mastra-ai/mastra/commit/7020c0690b199d9da337f0e805f16948e557922e)]:
  - @mastra/core@1.25.1-alpha.1
  - @mastra/deployer@1.25.1-alpha.1

## 1.6.1-alpha.0

### Patch Changes

- Updated dependencies [[`d63ffdb`](https://github.com/mastra-ai/mastra/commit/d63ffdbb2c11e76fe5ea45faab44bc15460f010c)]:
  - @mastra/core@1.25.1-alpha.0
  - @mastra/deployer@1.25.1-alpha.0

## 1.6.0

### Minor Changes

- Added `mastra server env pull [file]` command. Downloads environment variables from a deployed Mastra Server project into a local `.env` file. This is the inverse of `mastra server env import` and is useful in automated pipelines where you authenticate with a single API token and pull all other variables at runtime. ([#15355](https://github.com/mastra-ai/mastra/pull/15355))

### Patch Changes

- Improved Playground UI: disabled agent tabs now show tooltips with docs links explaining how to enable them. Experiment headers link to the agent version in the editor. Trace details show experiment and version as clickable cross-links. ([#15317](https://github.com/mastra-ai/mastra/pull/15317))

- Update references to "Mastra Cloud" to "Mastra platform" ([#15297](https://github.com/mastra-ai/mastra/pull/15297))

- Fixed headless server deploys so they can use .mastra-project.json for org and project resolution in CI. ([#15299](https://github.com/mastra-ai/mastra/pull/15299))

- Fixed `mastra studio deploy` and `mastra server deploy` so transient polling failures are retried up to 3 times before the CLI exits. ([#15350](https://github.com/mastra-ai/mastra/pull/15350))

- Fixed `mastra server deploy` and `mastra studio deploy` failing when deploying from a subdirectory (e.g. `mastra server deploy src`). ([#15253](https://github.com/mastra-ai/mastra/pull/15253))
  Added `--debug` flag to both deploy commands for verbose build logs.
  Fixed build errors displaying as `error: {}` instead of the actual error message.

- Fixed `mastra dev` so shutdown and hot reload fully stop the previous server before continuing, reducing orphaned processes and port-in-use errors after terminal close or restart. ([#15278](https://github.com/mastra-ai/mastra/pull/15278))

- Added `mastra server pause` and `mastra server restart` for Mastra Server projects. Pause stops the running server for your linked project; restart starts a paused or stopped server. ([#15295](https://github.com/mastra-ai/mastra/pull/15295))

- Refresh Studio Evaluation pages with an updated UI and flattened top-level URLs (`/scorers`, `/datasets`, `/experiments`; `/evaluation` remains as the overview). `@mastra/playground-ui` removes `EvaluationDashboard` and all `Evaluation*`-prefixed list components, constants, and hooks — use the per-domain replacements (e.g. `ScorersList`) instead. ([#15258](https://github.com/mastra-ai/mastra/pull/15258))

- Fixed `mastra studio deploy` reporting raw version specifiers (e.g. `catalog:`, `workspace:*`) instead of the actual installed version. The deploy command now resolves the real semver version from node_modules. ([#15378](https://github.com/mastra-ai/mastra/pull/15378))

- Fixed `mastra server deploy` getting stuck in `queued` after transient upload confirmation failures. The CLI now retries these failures and cleans up failed deploys so they no longer remain orphaned. ([#15371](https://github.com/mastra-ai/mastra/pull/15371))

- Updated dependencies [[`87df955`](https://github.com/mastra-ai/mastra/commit/87df955c028660c075873fd5d74af28233ce32eb), [`d135f00`](https://github.com/mastra-ai/mastra/commit/d135f00e9b0ed7c48f91140a1f83035661888f5c), [`8fad147`](https://github.com/mastra-ai/mastra/commit/8fad14759804179c8e080ce4d9dec6ef1a808b31), [`582644c`](https://github.com/mastra-ai/mastra/commit/582644c4a87f83b4f245a84d72b9e8590585012e), [`cbdf3e1`](https://github.com/mastra-ai/mastra/commit/cbdf3e12b3d0c30a6e5347be658e2009648c130a), [`8fe46d3`](https://github.com/mastra-ai/mastra/commit/8fe46d354027f3f0f0846e64219772348de106dd), [`18c67db`](https://github.com/mastra-ai/mastra/commit/18c67dbb9c9ebc26f26f65f7d3ff836e5691ef46), [`4ba3bb1`](https://github.com/mastra-ai/mastra/commit/4ba3bb1e465ad2ddaba3bbf2bc47e0faec32985e), [`5d84914`](https://github.com/mastra-ai/mastra/commit/5d84914e0e520c642a40329b210b413fcd139898), [`8dcc77e`](https://github.com/mastra-ai/mastra/commit/8dcc77e78a5340f5848f74b9e9f1b3da3513c1f5), [`aa67fc5`](https://github.com/mastra-ai/mastra/commit/aa67fc59ee8a5eeff1f23eb05970b8d7a536c8ff), [`fd2f314`](https://github.com/mastra-ai/mastra/commit/fd2f31473d3449b6b97e837ef8641264377f41a7), [`fa8140b`](https://github.com/mastra-ai/mastra/commit/fa8140bcd4251d2e3ac85fdc5547dfc4f372b5be), [`190f452`](https://github.com/mastra-ai/mastra/commit/190f45258b0640e2adfc8219fa3258cdc5b8f071), [`e80fead`](https://github.com/mastra-ai/mastra/commit/e80fead1412cc0d1b2f7d6a1ce5017d9e0098ff7), [`0287b64`](https://github.com/mastra-ai/mastra/commit/0287b644a5c3272755cf3112e71338106664103b), [`7e7bf60`](https://github.com/mastra-ai/mastra/commit/7e7bf606886bf374a6f9d4ca9b09dd83d0533372), [`184907d`](https://github.com/mastra-ai/mastra/commit/184907d775d8609c03c26e78ccaf37315f3aa287), [`075e91a`](https://github.com/mastra-ai/mastra/commit/075e91a4549baf46ad7a42a6a8ac8dfa78cc09e6), [`0c4cd13`](https://github.com/mastra-ai/mastra/commit/0c4cd131931c04ac5405373c932a242dbe88edd6), [`b16a753`](https://github.com/mastra-ai/mastra/commit/b16a753d5748440248d7df82e29bb987a9c8386c)]:
  - @mastra/core@1.25.0
  - @mastra/deployer@1.25.0

## 1.6.0-alpha.5

### Patch Changes

- Fixed `mastra server deploy` getting stuck in `queued` after transient upload confirmation failures. The CLI now retries these failures and cleans up failed deploys so they no longer remain orphaned. ([#15371](https://github.com/mastra-ai/mastra/pull/15371))

## 1.6.0-alpha.4

### Minor Changes

- Added `mastra server env pull [file]` command. Downloads environment variables from a deployed Mastra Server project into a local `.env` file. This is the inverse of `mastra server env import` and is useful in automated pipelines where you authenticate with a single API token and pull all other variables at runtime. ([#15355](https://github.com/mastra-ai/mastra/pull/15355))

### Patch Changes

- Improved Playground UI: disabled agent tabs now show tooltips with docs links explaining how to enable them. Experiment headers link to the agent version in the editor. Trace details show experiment and version as clickable cross-links. ([#15317](https://github.com/mastra-ai/mastra/pull/15317))

- Fixed headless server deploys so they can use .mastra-project.json for org and project resolution in CI. ([#15299](https://github.com/mastra-ai/mastra/pull/15299))

- Fixed `mastra studio deploy` and `mastra server deploy` so transient polling failures are retried up to 3 times before the CLI exits. ([#15350](https://github.com/mastra-ai/mastra/pull/15350))

- Fixed `mastra server deploy` and `mastra studio deploy` failing when deploying from a subdirectory (e.g. `mastra server deploy src`). ([#15253](https://github.com/mastra-ai/mastra/pull/15253))
  Added `--debug` flag to both deploy commands for verbose build logs.
  Fixed build errors displaying as `error: {}` instead of the actual error message.

- Fixed `mastra dev` so shutdown and hot reload fully stop the previous server before continuing, reducing orphaned processes and port-in-use errors after terminal close or restart. ([#15278](https://github.com/mastra-ai/mastra/pull/15278))

- Added `mastra server pause` and `mastra server restart` for Mastra Server projects. Pause stops the running server for your linked project; restart starts a paused or stopped server. ([#15295](https://github.com/mastra-ai/mastra/pull/15295))

- Fixed `mastra studio deploy` reporting raw version specifiers (e.g. `catalog:`, `workspace:*`) instead of the actual installed version. The deploy command now resolves the real semver version from node_modules. ([#15378](https://github.com/mastra-ai/mastra/pull/15378))

- Updated dependencies [[`d135f00`](https://github.com/mastra-ai/mastra/commit/d135f00e9b0ed7c48f91140a1f83035661888f5c), [`cbdf3e1`](https://github.com/mastra-ai/mastra/commit/cbdf3e12b3d0c30a6e5347be658e2009648c130a), [`8fe46d3`](https://github.com/mastra-ai/mastra/commit/8fe46d354027f3f0f0846e64219772348de106dd), [`18c67db`](https://github.com/mastra-ai/mastra/commit/18c67dbb9c9ebc26f26f65f7d3ff836e5691ef46), [`8dcc77e`](https://github.com/mastra-ai/mastra/commit/8dcc77e78a5340f5848f74b9e9f1b3da3513c1f5), [`aa67fc5`](https://github.com/mastra-ai/mastra/commit/aa67fc59ee8a5eeff1f23eb05970b8d7a536c8ff), [`fa8140b`](https://github.com/mastra-ai/mastra/commit/fa8140bcd4251d2e3ac85fdc5547dfc4f372b5be), [`190f452`](https://github.com/mastra-ai/mastra/commit/190f45258b0640e2adfc8219fa3258cdc5b8f071), [`7e7bf60`](https://github.com/mastra-ai/mastra/commit/7e7bf606886bf374a6f9d4ca9b09dd83d0533372), [`184907d`](https://github.com/mastra-ai/mastra/commit/184907d775d8609c03c26e78ccaf37315f3aa287), [`0c4cd13`](https://github.com/mastra-ai/mastra/commit/0c4cd131931c04ac5405373c932a242dbe88edd6), [`b16a753`](https://github.com/mastra-ai/mastra/commit/b16a753d5748440248d7df82e29bb987a9c8386c)]:
  - @mastra/deployer@1.25.0-alpha.3
  - @mastra/core@1.25.0-alpha.3

## 1.5.1-alpha.3

## 1.5.1-alpha.2

### Patch Changes

- Update references to "Mastra Cloud" to "Mastra platform" ([#15297](https://github.com/mastra-ai/mastra/pull/15297))

- Refresh Studio Evaluation pages with an updated UI and flattened top-level URLs (`/scorers`, `/datasets`, `/experiments`; `/evaluation` remains as the overview). `@mastra/playground-ui` removes `EvaluationDashboard` and all `Evaluation*`-prefixed list components, constants, and hooks — use the per-domain replacements (e.g. `ScorersList`) instead. ([#15258](https://github.com/mastra-ai/mastra/pull/15258))

- Updated dependencies [[`4ba3bb1`](https://github.com/mastra-ai/mastra/commit/4ba3bb1e465ad2ddaba3bbf2bc47e0faec32985e)]:
  - @mastra/core@1.25.0-alpha.2
  - @mastra/deployer@1.25.0-alpha.2

## 1.5.1-alpha.1

### Patch Changes

- Updated dependencies [[`8fad147`](https://github.com/mastra-ai/mastra/commit/8fad14759804179c8e080ce4d9dec6ef1a808b31), [`582644c`](https://github.com/mastra-ai/mastra/commit/582644c4a87f83b4f245a84d72b9e8590585012e), [`5d84914`](https://github.com/mastra-ai/mastra/commit/5d84914e0e520c642a40329b210b413fcd139898), [`fd2f314`](https://github.com/mastra-ai/mastra/commit/fd2f31473d3449b6b97e837ef8641264377f41a7), [`e80fead`](https://github.com/mastra-ai/mastra/commit/e80fead1412cc0d1b2f7d6a1ce5017d9e0098ff7), [`0287b64`](https://github.com/mastra-ai/mastra/commit/0287b644a5c3272755cf3112e71338106664103b)]:
  - @mastra/core@1.25.0-alpha.1
  - @mastra/deployer@1.25.0-alpha.1

## 1.5.1-alpha.0

### Patch Changes

- Updated dependencies [[`87df955`](https://github.com/mastra-ai/mastra/commit/87df955c028660c075873fd5d74af28233ce32eb), [`075e91a`](https://github.com/mastra-ai/mastra/commit/075e91a4549baf46ad7a42a6a8ac8dfa78cc09e6)]:
  - @mastra/core@1.24.2-alpha.0
  - @mastra/deployer@1.24.2-alpha.0

## 1.5.0

### Minor Changes

- Added `mastra server env` CLI commands for managing environment variables on deployed servers. New subcommands: `list`, `set`, `unset`, and `import` allow pushing env vars to production without using the UI. ([#15159](https://github.com/mastra-ai/mastra/pull/15159))

### Patch Changes

- Added documentation links to Evaluation page header for datasets, scorers, and experiments tabs. Moved Create Dataset button to header and simplified toolbar layout. ([#15180](https://github.com/mastra-ai/mastra/pull/15180))

- - Added span type color legend and color indicators to trace timeline ([#15175](https://github.com/mastra-ai/mastra/pull/15175))
  - Added missing memory and workspace span type support
  - Fixed scroll-into-view when navigating spans with Next/Prev
  - Fixed traceId URL deep-linking on click and page reload
  - Moved timeline span components from logs domain to traces domain

- Added 401 and 403 error handling to the Logs page for session expired and permission denied states ([#15178](https://github.com/mastra-ai/mastra/pull/15178))

- Updated dependencies [[`ef94400`](https://github.com/mastra-ai/mastra/commit/ef9440049402596b31f2ab976c5e4508f6cb6c91), [`3db852b`](https://github.com/mastra-ai/mastra/commit/3db852bff74e29f60d415a7b0f1583d6ce2bad92)]:
  - @mastra/core@1.24.1
  - @mastra/deployer@1.24.1

## 1.5.0-alpha.2

### Patch Changes

- Updated dependencies [[`3db852b`](https://github.com/mastra-ai/mastra/commit/3db852bff74e29f60d415a7b0f1583d6ce2bad92)]:
  - @mastra/core@1.24.1-alpha.1
  - @mastra/deployer@1.24.1-alpha.1

## 1.5.0-alpha.1

### Minor Changes

- Added `mastra server env` CLI commands for managing environment variables on deployed servers. New subcommands: `list`, `set`, `unset`, and `import` allow pushing env vars to production without using the UI. ([#15159](https://github.com/mastra-ai/mastra/pull/15159))

### Patch Changes

- Updated dependencies [[`ef94400`](https://github.com/mastra-ai/mastra/commit/ef9440049402596b31f2ab976c5e4508f6cb6c91)]:
  - @mastra/core@1.24.1-alpha.0
  - @mastra/deployer@1.24.1-alpha.0

## 1.4.2-alpha.0

### Patch Changes

- Added documentation links to Evaluation page header for datasets, scorers, and experiments tabs. Moved Create Dataset button to header and simplified toolbar layout. ([#15180](https://github.com/mastra-ai/mastra/pull/15180))

- - Added span type color legend and color indicators to trace timeline ([#15175](https://github.com/mastra-ai/mastra/pull/15175))
  - Added missing memory and workspace span type support
  - Fixed scroll-into-view when navigating spans with Next/Prev
  - Fixed traceId URL deep-linking on click and page reload
  - Moved timeline span components from logs domain to traces domain

- Added 401 and 403 error handling to the Logs page for session expired and permission denied states ([#15178](https://github.com/mastra-ai/mastra/pull/15178))

## 1.4.1

### Patch Changes

- Filtered confusing internal server logs (like 'Mastra API running on http://0.0.0.0:3000') from 'mastra studio deploy' output ([#15146](https://github.com/mastra-ai/mastra/pull/15146))

- Upload Studio assets to R2 during snapshot, prerelease, and stable publishes so each published CLI version has matching hosted Studio files. ([#15153](https://github.com/mastra-ai/mastra/pull/15153))

- Updated dependencies [[`8db7663`](https://github.com/mastra-ai/mastra/commit/8db7663c9a9c735828094c359d2e327fd4f8fba3), [`153e864`](https://github.com/mastra-ai/mastra/commit/153e86476b425db7cd0dc8490050096e92964a38), [`715710d`](https://github.com/mastra-ai/mastra/commit/715710d12fa47cf88e09d41f13843eddc29327b0), [`378c6c4`](https://github.com/mastra-ai/mastra/commit/378c6c4755726e8d8cf83a14809b350b90d46c62), [`2c4d99c`](https://github.com/mastra-ai/mastra/commit/2c4d99c619ef5029e1203022f48f3186c6084850), [`9f91fd5`](https://github.com/mastra-ai/mastra/commit/9f91fd538ab2a44f8cc740bcad8e51205f74fbea), [`ba6fa9c`](https://github.com/mastra-ai/mastra/commit/ba6fa9cc0f3e1912c49fd70d4c3bb8c44903ddaa)]:
  - @mastra/core@1.24.0
  - @mastra/loggers@1.1.1
  - @mastra/deployer@1.24.0

## 1.4.1-alpha.1

### Patch Changes

- Filtered confusing internal server logs (like 'Mastra API running on http://0.0.0.0:3000') from 'mastra studio deploy' output ([#15146](https://github.com/mastra-ai/mastra/pull/15146))

- Upload Studio assets to R2 during snapshot, prerelease, and stable publishes so each published CLI version has matching hosted Studio files. ([#15153](https://github.com/mastra-ai/mastra/pull/15153))

- Updated dependencies [[`8db7663`](https://github.com/mastra-ai/mastra/commit/8db7663c9a9c735828094c359d2e327fd4f8fba3), [`715710d`](https://github.com/mastra-ai/mastra/commit/715710d12fa47cf88e09d41f13843eddc29327b0), [`378c6c4`](https://github.com/mastra-ai/mastra/commit/378c6c4755726e8d8cf83a14809b350b90d46c62), [`2c4d99c`](https://github.com/mastra-ai/mastra/commit/2c4d99c619ef5029e1203022f48f3186c6084850), [`9f91fd5`](https://github.com/mastra-ai/mastra/commit/9f91fd538ab2a44f8cc740bcad8e51205f74fbea), [`ba6fa9c`](https://github.com/mastra-ai/mastra/commit/ba6fa9cc0f3e1912c49fd70d4c3bb8c44903ddaa)]:
  - @mastra/core@1.24.0-alpha.1
  - @mastra/loggers@1.1.1-alpha.0
  - @mastra/deployer@1.24.0-alpha.1

## 1.4.1-alpha.0

### Patch Changes

- Updated dependencies [[`153e864`](https://github.com/mastra-ai/mastra/commit/153e86476b425db7cd0dc8490050096e92964a38)]:
  - @mastra/core@1.23.1-alpha.0
  - @mastra/deployer@1.23.1-alpha.0

## 1.4.0

### Minor Changes

- Added `mastra server deploy` command for deploying to Mastra Server. Builds, zips, and uploads your project with environment variable support and deploy polling. ([#15080](https://github.com/mastra-ai/mastra/pull/15080))

- Added `mastra studio deploy` command for deploying studio to the Mastra platform. Includes `deploy`, `deploy list`, `deploy status`, `deploy logs`, and `projects` subcommands. Also generates a `package-lock.json` during build for faster deploys. ([#15067](https://github.com/mastra-ai/mastra/pull/15067))

- Added `mastra auth` commands to log in, log out, show the current account, switch organizations, and manage API tokens. ([#15066](https://github.com/mastra-ai/mastra/pull/15066))

### Patch Changes

- Fixed `mastra studio deploy` creating orphan projects when user cancels. Project creation is now deferred until after the user confirms the deploy settings. ([#15109](https://github.com/mastra-ai/mastra/pull/15109))

- Updated dependencies [[`c3899d0`](https://github.com/mastra-ai/mastra/commit/c3899d0829eae0c9844672da817578dcf1a11eba), [`f32b9e1`](https://github.com/mastra-ai/mastra/commit/f32b9e115a3c754d1c8cfa3f4256fba87b09cfb7), [`7d6f521`](https://github.com/mastra-ai/mastra/commit/7d6f52164d0cca099f0b07cb2bba334360f1c8ab), [`a50d220`](https://github.com/mastra-ai/mastra/commit/a50d220b01ecbc5644d489a3d446c3bd4ab30245), [`ef36607`](https://github.com/mastra-ai/mastra/commit/ef36607c05142900dd6de2dff1a0a575830d78bd), [`665477b`](https://github.com/mastra-ai/mastra/commit/665477bc104fd52cfef8e7610d7664781a70c220), [`4cc2755`](https://github.com/mastra-ai/mastra/commit/4cc2755a7194cb08720ff2ab4dffb4b4a5103dfd), [`ac7baf6`](https://github.com/mastra-ai/mastra/commit/ac7baf66ef1db15e03975ef4ebb02724f015a391), [`1b8f0d9`](https://github.com/mastra-ai/mastra/commit/1b8f0d913877d8b99d680d847890654da8da068e), [`ed425d7`](https://github.com/mastra-ai/mastra/commit/ed425d78e7c66cbda8209fee910856f98c6c6b82), [`1371703`](https://github.com/mastra-ai/mastra/commit/1371703835080450ef3f9aea58059a95d0da2e5a), [`0df8321`](https://github.com/mastra-ai/mastra/commit/0df832196eeb2450ab77ce887e8553abdd44c5a6), [`98f8a8b`](https://github.com/mastra-ai/mastra/commit/98f8a8bdf5761b9982f3ad3acbe7f1cc3efa71f3), [`ba6f7e9`](https://github.com/mastra-ai/mastra/commit/ba6f7e9086d8281393f2acae60fda61de3bff1f9), [`7eb2596`](https://github.com/mastra-ai/mastra/commit/7eb25960d607e07468c9a10c5437abd2deaf1e9a), [`1805ddc`](https://github.com/mastra-ai/mastra/commit/1805ddc9c9b3b14b63749735a13c05a45af43a80), [`fff91cf`](https://github.com/mastra-ai/mastra/commit/fff91cf914de0e731578aacebffdeebef82f0440), [`61109b3`](https://github.com/mastra-ai/mastra/commit/61109b34feb0e38d54bee4b8ca83eb7345b1d557), [`33f1ead`](https://github.com/mastra-ai/mastra/commit/33f1eadfa19c86953f593478e5fa371093b33779)]:
  - @mastra/deployer@1.23.0
  - @mastra/core@1.23.0

## 1.4.0-alpha.10

### Patch Changes

- Updated dependencies [[`a50d220`](https://github.com/mastra-ai/mastra/commit/a50d220b01ecbc5644d489a3d446c3bd4ab30245)]:
  - @mastra/core@1.23.0-alpha.9
  - @mastra/deployer@1.23.0-alpha.9

## 1.4.0-alpha.9

### Patch Changes

- Fixed `mastra studio deploy` creating orphan projects when user cancels. Project creation is now deferred until after the user confirms the deploy settings. ([#15109](https://github.com/mastra-ai/mastra/pull/15109))

## 1.4.0-alpha.8

### Patch Changes

- Updated dependencies [[`ac7baf6`](https://github.com/mastra-ai/mastra/commit/ac7baf66ef1db15e03975ef4ebb02724f015a391), [`0df8321`](https://github.com/mastra-ai/mastra/commit/0df832196eeb2450ab77ce887e8553abdd44c5a6), [`61109b3`](https://github.com/mastra-ai/mastra/commit/61109b34feb0e38d54bee4b8ca83eb7345b1d557), [`33f1ead`](https://github.com/mastra-ai/mastra/commit/33f1eadfa19c86953f593478e5fa371093b33779)]:
  - @mastra/core@1.23.0-alpha.8
  - @mastra/deployer@1.23.0-alpha.8

## 1.4.0-alpha.7

### Patch Changes

- Updated dependencies [[`665477b`](https://github.com/mastra-ai/mastra/commit/665477bc104fd52cfef8e7610d7664781a70c220), [`4cc2755`](https://github.com/mastra-ai/mastra/commit/4cc2755a7194cb08720ff2ab4dffb4b4a5103dfd), [`1b8f0d9`](https://github.com/mastra-ai/mastra/commit/1b8f0d913877d8b99d680d847890654da8da068e)]:
  - @mastra/core@1.23.0-alpha.7
  - @mastra/deployer@1.23.0-alpha.7

## 1.4.0-alpha.6

### Patch Changes

- Updated dependencies [[`7d6f521`](https://github.com/mastra-ai/mastra/commit/7d6f52164d0cca099f0b07cb2bba334360f1c8ab)]:
  - @mastra/core@1.23.0-alpha.6
  - @mastra/deployer@1.23.0-alpha.6

## 1.4.0-alpha.5

### Minor Changes

- Added `mastra server deploy` command for deploying to Mastra Server. Builds, zips, and uploads your project with environment variable support and deploy polling. ([#15080](https://github.com/mastra-ai/mastra/pull/15080))

### Patch Changes

- Updated dependencies [[`c3899d0`](https://github.com/mastra-ai/mastra/commit/c3899d0829eae0c9844672da817578dcf1a11eba), [`1371703`](https://github.com/mastra-ai/mastra/commit/1371703835080450ef3f9aea58059a95d0da2e5a), [`98f8a8b`](https://github.com/mastra-ai/mastra/commit/98f8a8bdf5761b9982f3ad3acbe7f1cc3efa71f3)]:
  - @mastra/deployer@1.23.0-alpha.5
  - @mastra/core@1.23.0-alpha.5

## 1.4.0-alpha.4

### Minor Changes

- Added `mastra studio deploy` command for deploying studio to the Mastra platform. Includes `deploy`, `deploy list`, `deploy status`, `deploy logs`, and `projects` subcommands. Also generates a `package-lock.json` during build for faster deploys. ([#15067](https://github.com/mastra-ai/mastra/pull/15067))

- Added `mastra auth` commands to log in, log out, show the current account, switch organizations, and manage API tokens. ([#15066](https://github.com/mastra-ai/mastra/pull/15066))

### Patch Changes

- Updated dependencies [[`ef36607`](https://github.com/mastra-ai/mastra/commit/ef36607c05142900dd6de2dff1a0a575830d78bd), [`fff91cf`](https://github.com/mastra-ai/mastra/commit/fff91cf914de0e731578aacebffdeebef82f0440)]:
  - @mastra/deployer@1.23.0-alpha.4
  - @mastra/core@1.23.0-alpha.4

## 1.3.21-alpha.3

### Patch Changes

- Updated dependencies [[`1805ddc`](https://github.com/mastra-ai/mastra/commit/1805ddc9c9b3b14b63749735a13c05a45af43a80)]:
  - @mastra/core@1.23.0-alpha.3
  - @mastra/deployer@1.23.0-alpha.3

## 1.3.21-alpha.2

### Patch Changes

- Updated dependencies:
  - @mastra/deployer@1.23.0-alpha.2
  - @mastra/core@1.23.0-alpha.2

## 1.3.21-alpha.1

### Patch Changes

- Updated dependencies [[`f32b9e1`](https://github.com/mastra-ai/mastra/commit/f32b9e115a3c754d1c8cfa3f4256fba87b09cfb7)]:
  - @mastra/core@1.23.0-alpha.1
  - @mastra/deployer@1.23.0-alpha.1

## 1.3.21-alpha.0

### Patch Changes

- Updated dependencies [[`ed425d7`](https://github.com/mastra-ai/mastra/commit/ed425d78e7c66cbda8209fee910856f98c6c6b82), [`ba6f7e9`](https://github.com/mastra-ai/mastra/commit/ba6f7e9086d8281393f2acae60fda61de3bff1f9), [`7eb2596`](https://github.com/mastra-ai/mastra/commit/7eb25960d607e07468c9a10c5437abd2deaf1e9a)]:
  - @mastra/core@1.23.0-alpha.0
  - @mastra/deployer@1.23.0-alpha.0

## 1.3.20

### Patch Changes

- Updated dependencies [[`cb15509`](https://github.com/mastra-ai/mastra/commit/cb15509b58f6a83e11b765c945082afc027db972), [`81e4259`](https://github.com/mastra-ai/mastra/commit/81e425939b4ceeb4f586e9b6d89c3b1c1f2d2fe7), [`951b8a1`](https://github.com/mastra-ai/mastra/commit/951b8a1b5ef7e1474c59dc4f2b9fc1a8b1e508b6), [`cb15509`](https://github.com/mastra-ai/mastra/commit/cb15509b58f6a83e11b765c945082afc027db972), [`80c5668`](https://github.com/mastra-ai/mastra/commit/80c5668e365470d3a96d3e953868fd7a643ff67c), [`3d478c1`](https://github.com/mastra-ai/mastra/commit/3d478c1e13f17b80f330ac49d7aa42ef929b93ff), [`2b4ea10`](https://github.com/mastra-ai/mastra/commit/2b4ea10b053e4ea1ab232d536933a4a3c4cba999), [`a0544f0`](https://github.com/mastra-ai/mastra/commit/a0544f0a1e6bd52ac12676228967c1938e43648d), [`6039f17`](https://github.com/mastra-ai/mastra/commit/6039f176f9c457304825ff1df8c83b8e457376c0), [`06b928d`](https://github.com/mastra-ai/mastra/commit/06b928dfc2f5630d023467476cc5919dfa858d0a), [`6a8d984`](https://github.com/mastra-ai/mastra/commit/6a8d9841f2933456ee1598099f488d742b600054), [`c8c86aa`](https://github.com/mastra-ai/mastra/commit/c8c86aa1458017fbd1c0776fdc0c520d129df8a6)]:
  - @mastra/core@1.22.0
  - @mastra/deployer@1.22.0

## 1.3.20-alpha.3

### Patch Changes

- Updated dependencies:
  - @mastra/deployer@1.22.0-alpha.3
  - @mastra/core@1.22.0-alpha.3

## 1.3.20-alpha.2

### Patch Changes

- Updated dependencies [[`cb15509`](https://github.com/mastra-ai/mastra/commit/cb15509b58f6a83e11b765c945082afc027db972), [`cb15509`](https://github.com/mastra-ai/mastra/commit/cb15509b58f6a83e11b765c945082afc027db972), [`80c5668`](https://github.com/mastra-ai/mastra/commit/80c5668e365470d3a96d3e953868fd7a643ff67c), [`3d478c1`](https://github.com/mastra-ai/mastra/commit/3d478c1e13f17b80f330ac49d7aa42ef929b93ff), [`6039f17`](https://github.com/mastra-ai/mastra/commit/6039f176f9c457304825ff1df8c83b8e457376c0), [`06b928d`](https://github.com/mastra-ai/mastra/commit/06b928dfc2f5630d023467476cc5919dfa858d0a), [`6a8d984`](https://github.com/mastra-ai/mastra/commit/6a8d9841f2933456ee1598099f488d742b600054)]:
  - @mastra/core@1.22.0-alpha.2
  - @mastra/deployer@1.22.0-alpha.2

## 1.3.20-alpha.1

### Patch Changes

- Updated dependencies [[`81e4259`](https://github.com/mastra-ai/mastra/commit/81e425939b4ceeb4f586e9b6d89c3b1c1f2d2fe7), [`951b8a1`](https://github.com/mastra-ai/mastra/commit/951b8a1b5ef7e1474c59dc4f2b9fc1a8b1e508b6)]:
  - @mastra/core@1.22.0-alpha.1
  - @mastra/deployer@1.22.0-alpha.1

## 1.3.20-alpha.0

### Patch Changes

- Updated dependencies [[`2b4ea10`](https://github.com/mastra-ai/mastra/commit/2b4ea10b053e4ea1ab232d536933a4a3c4cba999), [`a0544f0`](https://github.com/mastra-ai/mastra/commit/a0544f0a1e6bd52ac12676228967c1938e43648d), [`c8c86aa`](https://github.com/mastra-ai/mastra/commit/c8c86aa1458017fbd1c0776fdc0c520d129df8a6)]:
  - @mastra/core@1.22.0-alpha.0
  - @mastra/deployer@1.22.0-alpha.0

## 1.3.19

### Patch Changes

- Updated dependencies [[`9a43b47`](https://github.com/mastra-ai/mastra/commit/9a43b476465e86c9aca381c2831066b5c33c999a), [`ec5c319`](https://github.com/mastra-ai/mastra/commit/ec5c3197a50d034cb8e9cc494eebfddc684b5d81), [`6517789`](https://github.com/mastra-ai/mastra/commit/65177895b74b5471fe2245c7292f0176d9b3385d), [`13f4327`](https://github.com/mastra-ai/mastra/commit/13f4327f052faebe199cefbe906d33bf90238767), [`9ad6aa6`](https://github.com/mastra-ai/mastra/commit/9ad6aa6dfe858afc6955d1df5f3f78c40bb96b9c), [`2862127`](https://github.com/mastra-ai/mastra/commit/2862127d0a7cbd28523120ad64fea067a95838e6), [`3d16814`](https://github.com/mastra-ai/mastra/commit/3d16814c395931373543728994ff45ac98093074), [`7f498d0`](https://github.com/mastra-ai/mastra/commit/7f498d099eacef64fd43ee412e3bd6f87965a8a6), [`8cf8a67`](https://github.com/mastra-ai/mastra/commit/8cf8a67b061b737cb06d501fb8c1967a98bbf3cb), [`d7827e3`](https://github.com/mastra-ai/mastra/commit/d7827e393937c6cb0c7a744dde4d31538cb542b7)]:
  - @mastra/core@1.21.0
  - @mastra/deployer@1.21.0

## 1.3.19-alpha.2

### Patch Changes

- Updated dependencies [[`ec5c319`](https://github.com/mastra-ai/mastra/commit/ec5c3197a50d034cb8e9cc494eebfddc684b5d81), [`6517789`](https://github.com/mastra-ai/mastra/commit/65177895b74b5471fe2245c7292f0176d9b3385d), [`9ad6aa6`](https://github.com/mastra-ai/mastra/commit/9ad6aa6dfe858afc6955d1df5f3f78c40bb96b9c), [`2862127`](https://github.com/mastra-ai/mastra/commit/2862127d0a7cbd28523120ad64fea067a95838e6), [`3d16814`](https://github.com/mastra-ai/mastra/commit/3d16814c395931373543728994ff45ac98093074), [`7f498d0`](https://github.com/mastra-ai/mastra/commit/7f498d099eacef64fd43ee412e3bd6f87965a8a6), [`8cf8a67`](https://github.com/mastra-ai/mastra/commit/8cf8a67b061b737cb06d501fb8c1967a98bbf3cb), [`d7827e3`](https://github.com/mastra-ai/mastra/commit/d7827e393937c6cb0c7a744dde4d31538cb542b7)]:
  - @mastra/core@1.21.0-alpha.2
  - @mastra/deployer@1.21.0-alpha.2

## 1.3.19-alpha.1

### Patch Changes

- Updated dependencies [[`13f4327`](https://github.com/mastra-ai/mastra/commit/13f4327f052faebe199cefbe906d33bf90238767)]:
  - @mastra/core@1.21.0-alpha.1
  - @mastra/deployer@1.21.0-alpha.1

## 1.3.19-alpha.0

### Patch Changes

- Updated dependencies [[`9a43b47`](https://github.com/mastra-ai/mastra/commit/9a43b476465e86c9aca381c2831066b5c33c999a)]:
  - @mastra/core@1.21.0-alpha.0
  - @mastra/deployer@1.21.0-alpha.0

## 1.3.18

### Patch Changes

- Added Logs page to Studio. Browse server logs with date range filtering, text search, and column-based filters. Click any log to see its full message, metadata, and navigate to related traces and spans. ([#14899](https://github.com/mastra-ai/mastra/pull/14899))

- Standardized all logger calls across the codebase to use static string messages with structured data objects. Dynamic values are now passed as key-value pairs in the second argument instead of being interpolated into template literal strings. This improves log filterability and searchability in observability storage. ([#14899](https://github.com/mastra-ai/mastra/pull/14899))

  Removed ~150 redundant or noisy log calls including duplicate error logging after trackException and verbose in-memory storage CRUD traces.

- Added missing `/logs` route to the playground and wired up logs filtering with date presets and the new `SelectDataFilter` component. Removed experimental UI variant gating from sidebar. ([#14899](https://github.com/mastra-ai/mastra/pull/14899))

- Updated dependencies [[`cbeec24`](https://github.com/mastra-ai/mastra/commit/cbeec24b3c97a1a296e7e461e66cc7f7d215dc50), [`cee146b`](https://github.com/mastra-ai/mastra/commit/cee146b5d858212e1df2b2730fc36d3ceda0e08d), [`aa0aeff`](https://github.com/mastra-ai/mastra/commit/aa0aeffa11efbef5e219fbd97bf43d263cfe3afe), [`2bcec65`](https://github.com/mastra-ai/mastra/commit/2bcec652d62b07eab15e9eb9822f70184526eede), [`ad9bded`](https://github.com/mastra-ai/mastra/commit/ad9bdedf86a824801f49928a8d40f6e31ff5450f), [`cbeec24`](https://github.com/mastra-ai/mastra/commit/cbeec24b3c97a1a296e7e461e66cc7f7d215dc50), [`208c0bb`](https://github.com/mastra-ai/mastra/commit/208c0bbacbf5a1da6318f2a0e0c544390e542ddc), [`f566ee7`](https://github.com/mastra-ai/mastra/commit/f566ee7d53a3da33a01103e2a5ac2070ddefe6b0)]:
  - @mastra/core@1.20.0
  - @mastra/deployer@1.20.0

## 1.3.18-alpha.0

### Patch Changes

- Added Logs page to Studio. Browse server logs with date range filtering, text search, and column-based filters. Click any log to see its full message, metadata, and navigate to related traces and spans. ([#14899](https://github.com/mastra-ai/mastra/pull/14899))

- Standardized all logger calls across the codebase to use static string messages with structured data objects. Dynamic values are now passed as key-value pairs in the second argument instead of being interpolated into template literal strings. This improves log filterability and searchability in observability storage. ([#14899](https://github.com/mastra-ai/mastra/pull/14899))

  Removed ~150 redundant or noisy log calls including duplicate error logging after trackException and verbose in-memory storage CRUD traces.

- Added missing `/logs` route to the playground and wired up logs filtering with date presets and the new `SelectDataFilter` component. Removed experimental UI variant gating from sidebar. ([#14899](https://github.com/mastra-ai/mastra/pull/14899))

- Updated dependencies [[`cbeec24`](https://github.com/mastra-ai/mastra/commit/cbeec24b3c97a1a296e7e461e66cc7f7d215dc50), [`cee146b`](https://github.com/mastra-ai/mastra/commit/cee146b5d858212e1df2b2730fc36d3ceda0e08d), [`aa0aeff`](https://github.com/mastra-ai/mastra/commit/aa0aeffa11efbef5e219fbd97bf43d263cfe3afe), [`2bcec65`](https://github.com/mastra-ai/mastra/commit/2bcec652d62b07eab15e9eb9822f70184526eede), [`ad9bded`](https://github.com/mastra-ai/mastra/commit/ad9bdedf86a824801f49928a8d40f6e31ff5450f), [`cbeec24`](https://github.com/mastra-ai/mastra/commit/cbeec24b3c97a1a296e7e461e66cc7f7d215dc50), [`208c0bb`](https://github.com/mastra-ai/mastra/commit/208c0bbacbf5a1da6318f2a0e0c544390e542ddc), [`f566ee7`](https://github.com/mastra-ai/mastra/commit/f566ee7d53a3da33a01103e2a5ac2070ddefe6b0)]:
  - @mastra/core@1.20.0-alpha.0
  - @mastra/deployer@1.20.0-alpha.0

## 1.3.17

### Patch Changes

- Updated dependencies [[`180aaaf`](https://github.com/mastra-ai/mastra/commit/180aaaf4d0903d33a49bc72de2d40ca69a5bc599), [`9140989`](https://github.com/mastra-ai/mastra/commit/91409890e83f4f1d9c1b39223f1af91a6a53b549), [`d7c98cf`](https://github.com/mastra-ai/mastra/commit/d7c98cfc9d75baba9ecbf1a8835b5183d0a0aec8), [`acf5fbc`](https://github.com/mastra-ai/mastra/commit/acf5fbcb890dc7ca7167bec386ce5874dfadb997), [`24ca2ae`](https://github.com/mastra-ai/mastra/commit/24ca2ae57538ec189fabb9daee6175ad27035853), [`0762516`](https://github.com/mastra-ai/mastra/commit/07625167e029a8268ea7aaf0402416e6d8832874), [`9c57f2f`](https://github.com/mastra-ai/mastra/commit/9c57f2f7241e9f94769aa99fc86c531e8207d0f9), [`5bfc691`](https://github.com/mastra-ai/mastra/commit/5bfc69104c07ba7a9b55c2f8536422c0878b9c57), [`2de3d36`](https://github.com/mastra-ai/mastra/commit/2de3d36932b7f73ad26bc403f7da26cfe89e903e), [`d3736cb`](https://github.com/mastra-ai/mastra/commit/d3736cb9ce074d2b8e8b00218a01f790fe81a1b4), [`c627366`](https://github.com/mastra-ai/mastra/commit/c6273666f9ef4c8c617c68b7d07fe878a322f85c)]:
  - @mastra/core@1.19.0
  - @mastra/deployer@1.19.0

## 1.3.17-alpha.2

### Patch Changes

- Updated dependencies [[`9c57f2f`](https://github.com/mastra-ai/mastra/commit/9c57f2f7241e9f94769aa99fc86c531e8207d0f9), [`5bfc691`](https://github.com/mastra-ai/mastra/commit/5bfc69104c07ba7a9b55c2f8536422c0878b9c57)]:
  - @mastra/core@1.19.0-alpha.2
  - @mastra/deployer@1.19.0-alpha.2

## 1.3.17-alpha.1

### Patch Changes

- Updated dependencies [[`9140989`](https://github.com/mastra-ai/mastra/commit/91409890e83f4f1d9c1b39223f1af91a6a53b549), [`d7c98cf`](https://github.com/mastra-ai/mastra/commit/d7c98cfc9d75baba9ecbf1a8835b5183d0a0aec8), [`acf5fbc`](https://github.com/mastra-ai/mastra/commit/acf5fbcb890dc7ca7167bec386ce5874dfadb997), [`24ca2ae`](https://github.com/mastra-ai/mastra/commit/24ca2ae57538ec189fabb9daee6175ad27035853), [`0762516`](https://github.com/mastra-ai/mastra/commit/07625167e029a8268ea7aaf0402416e6d8832874), [`2de3d36`](https://github.com/mastra-ai/mastra/commit/2de3d36932b7f73ad26bc403f7da26cfe89e903e), [`d3736cb`](https://github.com/mastra-ai/mastra/commit/d3736cb9ce074d2b8e8b00218a01f790fe81a1b4), [`c627366`](https://github.com/mastra-ai/mastra/commit/c6273666f9ef4c8c617c68b7d07fe878a322f85c)]:
  - @mastra/core@1.18.1-alpha.1
  - @mastra/deployer@1.18.1-alpha.1

## 1.3.17-alpha.0

### Patch Changes

- Updated dependencies [[`180aaaf`](https://github.com/mastra-ai/mastra/commit/180aaaf4d0903d33a49bc72de2d40ca69a5bc599)]:
  - @mastra/core@1.18.1-alpha.0
  - @mastra/deployer@1.18.1-alpha.0

## 1.3.16

### Patch Changes

- Fixed `--no-example` flag being ignored when `--default` is also passed to `create-mastra`. Previously, running `create-mastra --default --no-example` would always scaffold the weather agent example. Now `--no-example` correctly suppresses example files even when using `--default`. ([#14839](https://github.com/mastra-ai/mastra/pull/14839))

- During `create-mastra`, skip the git initialization question if the current directory is already a git repository. ([#14763](https://github.com/mastra-ai/mastra/pull/14763))

- Fixed overflow scrolling on Primitives, Observability Overview, and Resources pages so content is scrollable when it exceeds the viewport. ([#14858](https://github.com/mastra-ai/mastra/pull/14858))

- Removed experimental UI variant gating from entity list pages. Agents, Workflows, Tools, MCP Servers, Processors, and Prompts pages now always render the new EntityListPageLayout, replacing the legacy MainContentLayout. ([#14833](https://github.com/mastra-ai/mastra/pull/14833))

- Finished light mode support for Mastra Studio. Theme selector is now always visible in settings — no environment variable needed. CodeMirror editors (instructions, trace view, code diff) render with proper syntax highlighting and cursor visibility in both light and dark modes. Dropdown menus now have correct hover/focus states in light mode. ([#14796](https://github.com/mastra-ai/mastra/pull/14796))

- Restructured Studio sidebar navigation into section-based layout with overview pages. ([#14649](https://github.com/mastra-ai/mastra/pull/14649))
  - **Section headers**: Sidebar now groups links under "Primitives", "Evaluation", and "Observability" section headers. Headers are clickable and link to overview pages.
  - **Sub-link indentation**: Links within each section are visually indented when the sidebar is expanded.
  - **Overview pages**: New overview pages for Primitives (`/primitives`), Observability (`/observability-overview`), and Resources (`/resources`) showing clickable cards for each sub-section.
  - **Evaluation tab bar removed**: Scorers, Datasets, and Experiments are now navigated via sidebar sub-links instead of in-page tabs.
  - **Layout cleanup**: Removed grey `bg-surface2` panel styling from the main content area, applying the dark background universally. Cleaned up experimental UI gating code.
  - **Sidebar bottom**: Removed "Share" button (moved to Resources page) and "Templates" link. Sidebar bottom now only shows the version footer.

- - Add DuckDB to `create-mastra` example code. Observability storage will use it instead of LibSQL so that "metrics" work ([#14725](https://github.com/mastra-ai/mastra/pull/14725))
  - Improved API key security in create-mastra example by masking input with `*` characters
- Updated dependencies [[`dc514a8`](https://github.com/mastra-ai/mastra/commit/dc514a83dba5f719172dddfd2c7b858e4943d067), [`e333b77`](https://github.com/mastra-ai/mastra/commit/e333b77e2d76ba57ccec1818e08cebc1993469ff), [`dc9fc19`](https://github.com/mastra-ai/mastra/commit/dc9fc19da4437f6b508cc355f346a8856746a76b), [`60a224d`](https://github.com/mastra-ai/mastra/commit/60a224dd497240e83698cfa5bfd02e3d1d854844), [`fbf22a7`](https://github.com/mastra-ai/mastra/commit/fbf22a7ad86bcb50dcf30459f0d075e51ddeb468), [`4e7f4e6`](https://github.com/mastra-ai/mastra/commit/4e7f4e6fe6239e0aa5f15416fb1e8ad8e9c52bcf), [`f16d92c`](https://github.com/mastra-ai/mastra/commit/f16d92c677a119a135cebcf7e2b9f51ada7a9df4), [`949b7bf`](https://github.com/mastra-ai/mastra/commit/949b7bfd4e40f2b2cba7fef5eb3f108a02cfe938), [`404fea1`](https://github.com/mastra-ai/mastra/commit/404fea13042181f0b0c73a101392ac87c79ceae2), [`ebf5047`](https://github.com/mastra-ai/mastra/commit/ebf5047e825c38a1a356f10b214c1d4260dfcd8d), [`12c647c`](https://github.com/mastra-ai/mastra/commit/12c647cf3a26826eb72d40b42e3c8356ceae16ed), [`d084b66`](https://github.com/mastra-ai/mastra/commit/d084b6692396057e83c086b954c1857d20b58a14), [`79c699a`](https://github.com/mastra-ai/mastra/commit/79c699acf3cd8a77e11c55530431f48eb48456e9), [`62757b6`](https://github.com/mastra-ai/mastra/commit/62757b6db6e8bb86569d23ad0b514178f57053f8), [`675f15b`](https://github.com/mastra-ai/mastra/commit/675f15b7eaeea649158d228ea635be40480c584d), [`b174c63`](https://github.com/mastra-ai/mastra/commit/b174c63a093108d4e53b9bc89a078d9f66202b3f), [`819f03c`](https://github.com/mastra-ai/mastra/commit/819f03c25823373b32476413bd76be28a5d8705a), [`04160ee`](https://github.com/mastra-ai/mastra/commit/04160eedf3130003cf842ad08428c8ff69af4cc1), [`a917d2b`](https://github.com/mastra-ai/mastra/commit/a917d2bdd3493434a0fe6c06b8c073388e9b1281), [`2c27503`](https://github.com/mastra-ai/mastra/commit/2c275032510d131d2cde47f99953abf0fe02c081), [`c40d0dd`](https://github.com/mastra-ai/mastra/commit/c40d0dd55890425e0a108db227711a0fffa80722), [`424a1df`](https://github.com/mastra-ai/mastra/commit/424a1df7bee59abb5c83717a54807fdd674a6224), [`3d70b0b`](https://github.com/mastra-ai/mastra/commit/3d70b0b3524d817173ad870768f259c06d61bd23), [`eef7cb2`](https://github.com/mastra-ai/mastra/commit/eef7cb2abe7ef15951e2fdf792a5095c6c643333), [`260fe12`](https://github.com/mastra-ai/mastra/commit/260fe1295fe7354e39d6def2775e0797a7a277f0), [`b879d6d`](https://github.com/mastra-ai/mastra/commit/b879d6db5bcf5a69cdf0ed6c4ccb42e4d0149215), [`12c88a6`](https://github.com/mastra-ai/mastra/commit/12c88a6e32bf982c2fe0c6af62e65a3414519a75), [`43595bf`](https://github.com/mastra-ai/mastra/commit/43595bf7b8df1a6edce7a23b445b5124d2a0b473), [`78670e9`](https://github.com/mastra-ai/mastra/commit/78670e97e76d7422cf7025faf371b2aeafed860d), [`e8a5b0b`](https://github.com/mastra-ai/mastra/commit/e8a5b0b9bc94d12dee4150095512ca27a288d778), [`3b45a13`](https://github.com/mastra-ai/mastra/commit/3b45a138d09d040779c0aba1edbbfc1b57442d23), [`d400e7c`](https://github.com/mastra-ai/mastra/commit/d400e7c8b8d7afa6ba2c71769eace4048e3cef8e), [`f58d1a7`](https://github.com/mastra-ai/mastra/commit/f58d1a7a457588a996c3ecb53201a68f3d28c432), [`a49a929`](https://github.com/mastra-ai/mastra/commit/a49a92904968b4fc67e01effee8c7c8d0464ba85), [`8127d96`](https://github.com/mastra-ai/mastra/commit/8127d96280492e335d49b244501088dfdd59a8f1)]:
  - @mastra/core@1.18.0
  - @mastra/deployer@1.18.0
  - @mastra/loggers@1.1.0

## 1.3.16-alpha.8

### Patch Changes

- Updated dependencies [[`12c647c`](https://github.com/mastra-ai/mastra/commit/12c647cf3a26826eb72d40b42e3c8356ceae16ed), [`819f03c`](https://github.com/mastra-ai/mastra/commit/819f03c25823373b32476413bd76be28a5d8705a)]:
  - @mastra/core@1.18.0-alpha.5
  - @mastra/deployer@1.18.0-alpha.5

## 1.3.16-alpha.7

### Patch Changes

- Fixed `--no-example` flag being ignored when `--default` is also passed to `create-mastra`. Previously, running `create-mastra --default --no-example` would always scaffold the weather agent example. Now `--no-example` correctly suppresses example files even when using `--default`. ([#14839](https://github.com/mastra-ai/mastra/pull/14839))

- Fixed overflow scrolling on Primitives, Observability Overview, and Resources pages so content is scrollable when it exceeds the viewport. ([#14858](https://github.com/mastra-ai/mastra/pull/14858))

- Removed experimental UI variant gating from entity list pages. Agents, Workflows, Tools, MCP Servers, Processors, and Prompts pages now always render the new EntityListPageLayout, replacing the legacy MainContentLayout. ([#14833](https://github.com/mastra-ai/mastra/pull/14833))

- Finished light mode support for Mastra Studio. Theme selector is now always visible in settings — no environment variable needed. CodeMirror editors (instructions, trace view, code diff) render with proper syntax highlighting and cursor visibility in both light and dark modes. Dropdown menus now have correct hover/focus states in light mode. ([#14796](https://github.com/mastra-ai/mastra/pull/14796))

- Updated dependencies [[`fbf22a7`](https://github.com/mastra-ai/mastra/commit/fbf22a7ad86bcb50dcf30459f0d075e51ddeb468), [`04160ee`](https://github.com/mastra-ai/mastra/commit/04160eedf3130003cf842ad08428c8ff69af4cc1), [`2c27503`](https://github.com/mastra-ai/mastra/commit/2c275032510d131d2cde47f99953abf0fe02c081), [`424a1df`](https://github.com/mastra-ai/mastra/commit/424a1df7bee59abb5c83717a54807fdd674a6224), [`b879d6d`](https://github.com/mastra-ai/mastra/commit/b879d6db5bcf5a69cdf0ed6c4ccb42e4d0149215), [`12c88a6`](https://github.com/mastra-ai/mastra/commit/12c88a6e32bf982c2fe0c6af62e65a3414519a75), [`43595bf`](https://github.com/mastra-ai/mastra/commit/43595bf7b8df1a6edce7a23b445b5124d2a0b473), [`78670e9`](https://github.com/mastra-ai/mastra/commit/78670e97e76d7422cf7025faf371b2aeafed860d), [`d400e7c`](https://github.com/mastra-ai/mastra/commit/d400e7c8b8d7afa6ba2c71769eace4048e3cef8e), [`f58d1a7`](https://github.com/mastra-ai/mastra/commit/f58d1a7a457588a996c3ecb53201a68f3d28c432), [`a49a929`](https://github.com/mastra-ai/mastra/commit/a49a92904968b4fc67e01effee8c7c8d0464ba85)]:
  - @mastra/core@1.18.0-alpha.4
  - @mastra/deployer@1.18.0-alpha.4

## 1.3.16-alpha.6

### Patch Changes

- Updated dependencies [[`e333b77`](https://github.com/mastra-ai/mastra/commit/e333b77e2d76ba57ccec1818e08cebc1993469ff), [`60a224d`](https://github.com/mastra-ai/mastra/commit/60a224dd497240e83698cfa5bfd02e3d1d854844), [`949b7bf`](https://github.com/mastra-ai/mastra/commit/949b7bfd4e40f2b2cba7fef5eb3f108a02cfe938), [`d084b66`](https://github.com/mastra-ai/mastra/commit/d084b6692396057e83c086b954c1857d20b58a14), [`79c699a`](https://github.com/mastra-ai/mastra/commit/79c699acf3cd8a77e11c55530431f48eb48456e9), [`62757b6`](https://github.com/mastra-ai/mastra/commit/62757b6db6e8bb86569d23ad0b514178f57053f8), [`3d70b0b`](https://github.com/mastra-ai/mastra/commit/3d70b0b3524d817173ad870768f259c06d61bd23), [`3b45a13`](https://github.com/mastra-ai/mastra/commit/3b45a138d09d040779c0aba1edbbfc1b57442d23), [`8127d96`](https://github.com/mastra-ai/mastra/commit/8127d96280492e335d49b244501088dfdd59a8f1)]:
  - @mastra/core@1.18.0-alpha.3
  - @mastra/deployer@1.18.0-alpha.3

## 1.3.16-alpha.5

### Patch Changes

- During `create-mastra`, skip the git initialization question if the current directory is already a git repository. ([#14763](https://github.com/mastra-ai/mastra/pull/14763))

- Updated dependencies [[`4e7f4e6`](https://github.com/mastra-ai/mastra/commit/4e7f4e6fe6239e0aa5f15416fb1e8ad8e9c52bcf), [`f16d92c`](https://github.com/mastra-ai/mastra/commit/f16d92c677a119a135cebcf7e2b9f51ada7a9df4), [`c40d0dd`](https://github.com/mastra-ai/mastra/commit/c40d0dd55890425e0a108db227711a0fffa80722)]:
  - @mastra/deployer@1.18.0-alpha.2
  - @mastra/core@1.18.0-alpha.2
  - @mastra/loggers@1.1.0-alpha.0

## 1.3.16-alpha.4

### Patch Changes

- Restructured Studio sidebar navigation into section-based layout with overview pages. ([#14649](https://github.com/mastra-ai/mastra/pull/14649))
  - **Section headers**: Sidebar now groups links under "Primitives", "Evaluation", and "Observability" section headers. Headers are clickable and link to overview pages.
  - **Sub-link indentation**: Links within each section are visually indented when the sidebar is expanded.
  - **Overview pages**: New overview pages for Primitives (`/primitives`), Observability (`/observability-overview`), and Resources (`/resources`) showing clickable cards for each sub-section.
  - **Evaluation tab bar removed**: Scorers, Datasets, and Experiments are now navigated via sidebar sub-links instead of in-page tabs.
  - **Layout cleanup**: Removed grey `bg-surface2` panel styling from the main content area, applying the dark background universally. Cleaned up experimental UI gating code.
  - **Sidebar bottom**: Removed "Share" button (moved to Resources page) and "Templates" link. Sidebar bottom now only shows the version footer.

- Updated dependencies [[`dc9fc19`](https://github.com/mastra-ai/mastra/commit/dc9fc19da4437f6b508cc355f346a8856746a76b), [`260fe12`](https://github.com/mastra-ai/mastra/commit/260fe1295fe7354e39d6def2775e0797a7a277f0)]:
  - @mastra/core@1.18.0-alpha.1
  - @mastra/deployer@1.18.0-alpha.1

## 1.3.16-alpha.3

### Patch Changes

- - Add DuckDB to `create-mastra` example code. Observability storage will use it instead of LibSQL so that "metrics" work ([#14725](https://github.com/mastra-ai/mastra/pull/14725))
  - Improved API key security in create-mastra example by masking input with `*` characters
- Updated dependencies [[`dc514a8`](https://github.com/mastra-ai/mastra/commit/dc514a83dba5f719172dddfd2c7b858e4943d067), [`404fea1`](https://github.com/mastra-ai/mastra/commit/404fea13042181f0b0c73a101392ac87c79ceae2), [`ebf5047`](https://github.com/mastra-ai/mastra/commit/ebf5047e825c38a1a356f10b214c1d4260dfcd8d), [`675f15b`](https://github.com/mastra-ai/mastra/commit/675f15b7eaeea649158d228ea635be40480c584d), [`b174c63`](https://github.com/mastra-ai/mastra/commit/b174c63a093108d4e53b9bc89a078d9f66202b3f), [`a917d2b`](https://github.com/mastra-ai/mastra/commit/a917d2bdd3493434a0fe6c06b8c073388e9b1281), [`eef7cb2`](https://github.com/mastra-ai/mastra/commit/eef7cb2abe7ef15951e2fdf792a5095c6c643333), [`e8a5b0b`](https://github.com/mastra-ai/mastra/commit/e8a5b0b9bc94d12dee4150095512ca27a288d778)]:
  - @mastra/core@1.18.0-alpha.0
  - @mastra/deployer@1.18.0-alpha.0

## 1.3.16-alpha.2

### Patch Changes

- Updated dependencies [[`404fea1`](https://github.com/mastra-ai/mastra/commit/404fea13042181f0b0c73a101392ac87c79ceae2), [`ebf5047`](https://github.com/mastra-ai/mastra/commit/ebf5047e825c38a1a356f10b214c1d4260dfcd8d), [`675f15b`](https://github.com/mastra-ai/mastra/commit/675f15b7eaeea649158d228ea635be40480c584d), [`b174c63`](https://github.com/mastra-ai/mastra/commit/b174c63a093108d4e53b9bc89a078d9f66202b3f), [`eef7cb2`](https://github.com/mastra-ai/mastra/commit/eef7cb2abe7ef15951e2fdf792a5095c6c643333), [`86e3263`](https://github.com/mastra-ai/mastra/commit/86e326363edd12be5a5b25ccce4a39f66f7c9f50), [`e8a5b0b`](https://github.com/mastra-ai/mastra/commit/e8a5b0b9bc94d12dee4150095512ca27a288d778)]:
  - @mastra/core@1.17.0-alpha.2
  - @mastra/deployer@1.17.0-alpha.2

## 1.3.16-alpha.1

### Patch Changes

- Updated dependencies [[`7302e5c`](https://github.com/mastra-ai/mastra/commit/7302e5ce0f52d769d3d63fb0faa8a7d4089cda6d)]:
  - @mastra/core@1.16.1-alpha.1
  - @mastra/deployer@1.16.1-alpha.1

## 1.3.16-alpha.0

### Patch Changes

- Updated dependencies [[`dc514a8`](https://github.com/mastra-ai/mastra/commit/dc514a83dba5f719172dddfd2c7b858e4943d067)]:
  - @mastra/core@1.16.1-alpha.0
  - @mastra/deployer@1.16.1-alpha.0

## 1.3.15

### Patch Changes

- Pass MASTRA_EXPERIMENTAL_UI environment variable through the studio dev server HTML shell. ([#14547](https://github.com/mastra-ai/mastra/pull/14547))

- Improved skill detail page breadcrumb navigation by validating the agentId query parameter against the cached agent list. Invalid or tampered agentId values now gracefully fall back to the workspace breadcrumb instead of showing broken navigation. ([#14502](https://github.com/mastra-ai/mastra/pull/14502))

- Added metrics dashboard with KPI cards, trace volume, latency, model usage, and scores visualizations. Includes filtering by date range, agents, models, and providers. Added HorizontalBars, MetricsCard, MetricsKpiCard, MetricsLineChart, MetricsFlexGrid, and MetricsDataTable design system components. ([#14491](https://github.com/mastra-ai/mastra/pull/14491))

- - Improve generated `AGENTS.md` file ([#14591](https://github.com/mastra-ai/mastra/pull/14591))
  - Remove `src/` directory question from create-mastra
  - Fix a bug with project name input in wizard (it was setting a default value unintentionally)
- Updated dependencies [[`68ed4e9`](https://github.com/mastra-ai/mastra/commit/68ed4e9f118e8646b60a6112dabe854d0ef53902), [`085c1da`](https://github.com/mastra-ai/mastra/commit/085c1daf71b55a97b8ebad26623089e40055021c), [`b874092`](https://github.com/mastra-ai/mastra/commit/b87409266999a08d364528c31dff24af4584637f), [`be37de4`](https://github.com/mastra-ai/mastra/commit/be37de4391bd1d5486ce38efacbf00ca51637262), [`7dbd611`](https://github.com/mastra-ai/mastra/commit/7dbd611a85cb1e0c0a1581c57564268cb183d86e), [`f14604c`](https://github.com/mastra-ai/mastra/commit/f14604c7ef01ba794e1a8d5c7bae5415852aacec), [`4a75e10`](https://github.com/mastra-ai/mastra/commit/4a75e106bd31c283a1b3fe74c923610dcc46415b), [`f3ce603`](https://github.com/mastra-ai/mastra/commit/f3ce603fd76180f4a5be90b6dc786d389b6b3e98), [`423aa6f`](https://github.com/mastra-ai/mastra/commit/423aa6fd12406de6a1cc6b68e463d30af1d790fb), [`f21c626`](https://github.com/mastra-ai/mastra/commit/f21c6263789903ab9720b4d11373093298e97f15), [`41aee84`](https://github.com/mastra-ai/mastra/commit/41aee84561ceebe28bad1ecba8702d92838f67f0), [`2871451`](https://github.com/mastra-ai/mastra/commit/2871451703829aefa06c4a5d6eca7fd3731222ef), [`085c1da`](https://github.com/mastra-ai/mastra/commit/085c1daf71b55a97b8ebad26623089e40055021c), [`4bb5adc`](https://github.com/mastra-ai/mastra/commit/4bb5adc05c88e3a83fe1ea5ecb9eae6e17313124), [`4bb5adc`](https://github.com/mastra-ai/mastra/commit/4bb5adc05c88e3a83fe1ea5ecb9eae6e17313124), [`e06b520`](https://github.com/mastra-ai/mastra/commit/e06b520bdd5fdef844760c5e692c7852cbc5c240), [`d3930ea`](https://github.com/mastra-ai/mastra/commit/d3930eac51c30b0ecf7eaa54bb9430758b399777), [`dd9c4e0`](https://github.com/mastra-ai/mastra/commit/dd9c4e0a47962f1413e9b72114fcad912e19a0a6)]:
  - @mastra/core@1.16.0
  - @mastra/deployer@1.16.0

## 1.3.15-alpha.5

### Patch Changes

- Updated dependencies [[`f21c626`](https://github.com/mastra-ai/mastra/commit/f21c6263789903ab9720b4d11373093298e97f15)]:
  - @mastra/core@1.16.0-alpha.5
  - @mastra/deployer@1.16.0-alpha.5

## 1.3.15-alpha.4

### Patch Changes

- Updated dependencies [[`f14604c`](https://github.com/mastra-ai/mastra/commit/f14604c7ef01ba794e1a8d5c7bae5415852aacec), [`e06b520`](https://github.com/mastra-ai/mastra/commit/e06b520bdd5fdef844760c5e692c7852cbc5c240), [`dd9c4e0`](https://github.com/mastra-ai/mastra/commit/dd9c4e0a47962f1413e9b72114fcad912e19a0a6)]:
  - @mastra/core@1.16.0-alpha.4
  - @mastra/deployer@1.16.0-alpha.4

## 1.3.15-alpha.3

### Patch Changes

- Improved skill detail page breadcrumb navigation by validating the agentId query parameter against the cached agent list. Invalid or tampered agentId values now gracefully fall back to the workspace breadcrumb instead of showing broken navigation. ([#14502](https://github.com/mastra-ai/mastra/pull/14502))

- Added metrics dashboard with KPI cards, trace volume, latency, model usage, and scores visualizations. Includes filtering by date range, agents, models, and providers. Added HorizontalBars, MetricsCard, MetricsKpiCard, MetricsLineChart, MetricsFlexGrid, and MetricsDataTable design system components. ([#14491](https://github.com/mastra-ai/mastra/pull/14491))

- Updated dependencies [[`423aa6f`](https://github.com/mastra-ai/mastra/commit/423aa6fd12406de6a1cc6b68e463d30af1d790fb), [`4bb5adc`](https://github.com/mastra-ai/mastra/commit/4bb5adc05c88e3a83fe1ea5ecb9eae6e17313124), [`4bb5adc`](https://github.com/mastra-ai/mastra/commit/4bb5adc05c88e3a83fe1ea5ecb9eae6e17313124)]:
  - @mastra/core@1.16.0-alpha.3
  - @mastra/deployer@1.16.0-alpha.3

## 1.3.15-alpha.2

### Patch Changes

- Updated dependencies [[`be37de4`](https://github.com/mastra-ai/mastra/commit/be37de4391bd1d5486ce38efacbf00ca51637262), [`f3ce603`](https://github.com/mastra-ai/mastra/commit/f3ce603fd76180f4a5be90b6dc786d389b6b3e98), [`2871451`](https://github.com/mastra-ai/mastra/commit/2871451703829aefa06c4a5d6eca7fd3731222ef), [`d3930ea`](https://github.com/mastra-ai/mastra/commit/d3930eac51c30b0ecf7eaa54bb9430758b399777)]:
  - @mastra/core@1.16.0-alpha.2
  - @mastra/deployer@1.16.0-alpha.2

## 1.3.15-alpha.1

### Patch Changes

- Pass MASTRA_EXPERIMENTAL_UI environment variable through the studio dev server HTML shell. ([#14547](https://github.com/mastra-ai/mastra/pull/14547))

- - Improve generated `AGENTS.md` file ([#14591](https://github.com/mastra-ai/mastra/pull/14591))
  - Remove `src/` directory question from create-mastra
  - Fix a bug with project name input in wizard (it was setting a default value unintentionally)
- Updated dependencies [[`b874092`](https://github.com/mastra-ai/mastra/commit/b87409266999a08d364528c31dff24af4584637f), [`7dbd611`](https://github.com/mastra-ai/mastra/commit/7dbd611a85cb1e0c0a1581c57564268cb183d86e), [`41aee84`](https://github.com/mastra-ai/mastra/commit/41aee84561ceebe28bad1ecba8702d92838f67f0)]:
  - @mastra/deployer@1.16.0-alpha.1
  - @mastra/core@1.16.0-alpha.1

## 1.3.15-alpha.0

### Patch Changes

- Updated dependencies [[`68ed4e9`](https://github.com/mastra-ai/mastra/commit/68ed4e9f118e8646b60a6112dabe854d0ef53902), [`085c1da`](https://github.com/mastra-ai/mastra/commit/085c1daf71b55a97b8ebad26623089e40055021c), [`4a75e10`](https://github.com/mastra-ai/mastra/commit/4a75e106bd31c283a1b3fe74c923610dcc46415b), [`085c1da`](https://github.com/mastra-ai/mastra/commit/085c1daf71b55a97b8ebad26623089e40055021c)]:
  - @mastra/core@1.16.0-alpha.0
  - @mastra/deployer@1.16.0-alpha.0

## 1.3.14

### Patch Changes

- Updated dependencies [[`fa99b06`](https://github.com/mastra-ai/mastra/commit/fa99b06835ff9a674b37a5442351de3f704c5de0), [`cb611a1`](https://github.com/mastra-ai/mastra/commit/cb611a1e89a4f4cf74c97b57e0c27bb56f2eceb5), [`da93115`](https://github.com/mastra-ai/mastra/commit/da931155c1a9bc63d455d3d86b4ec984db5991fe), [`62d1d3c`](https://github.com/mastra-ai/mastra/commit/62d1d3cc08fe8182e7080237fd975de862ec8c91), [`9e1a3ed`](https://github.com/mastra-ai/mastra/commit/9e1a3ed07cfafb5e8e19a796ce0bee817002d7c0), [`8681ecb`](https://github.com/mastra-ai/mastra/commit/8681ecb86184d5907267000e4576cc442a9a83fc), [`28d0249`](https://github.com/mastra-ai/mastra/commit/28d0249295782277040ad1e0d243e695b7ab1ce4), [`681ee1c`](https://github.com/mastra-ai/mastra/commit/681ee1c811359efd1b8bebc4bce35b9bb7b14bec), [`bb0f09d`](https://github.com/mastra-ai/mastra/commit/bb0f09dbac58401b36069f483acf5673202db5b5), [`a579f7a`](https://github.com/mastra-ai/mastra/commit/a579f7a31e582674862b5679bc79af7ccf7429b8), [`5f7e9d0`](https://github.com/mastra-ai/mastra/commit/5f7e9d0db664020e1f3d97d7d18c6b0b9d4843d0), [`d7f14c3`](https://github.com/mastra-ai/mastra/commit/d7f14c3285cd253ecdd5f58139b7b6cbdf3678b5), [`0efe12a`](https://github.com/mastra-ai/mastra/commit/0efe12a5f008a939a1aac71699486ba40138054e)]:
  - @mastra/deployer@1.15.0
  - @mastra/core@1.15.0

## 1.3.14-alpha.4

### Patch Changes

- Updated dependencies [[`da93115`](https://github.com/mastra-ai/mastra/commit/da931155c1a9bc63d455d3d86b4ec984db5991fe), [`0efe12a`](https://github.com/mastra-ai/mastra/commit/0efe12a5f008a939a1aac71699486ba40138054e)]:
  - @mastra/core@1.15.0-alpha.4
  - @mastra/deployer@1.15.0-alpha.4

## 1.3.14-alpha.3

### Patch Changes

- Updated dependencies [[`d7f14c3`](https://github.com/mastra-ai/mastra/commit/d7f14c3285cd253ecdd5f58139b7b6cbdf3678b5)]:
  - @mastra/core@1.15.0-alpha.3
  - @mastra/deployer@1.15.0-alpha.3

## 1.3.14-alpha.2

### Patch Changes

- Updated dependencies [[`9e1a3ed`](https://github.com/mastra-ai/mastra/commit/9e1a3ed07cfafb5e8e19a796ce0bee817002d7c0), [`a579f7a`](https://github.com/mastra-ai/mastra/commit/a579f7a31e582674862b5679bc79af7ccf7429b8)]:
  - @mastra/core@1.15.0-alpha.2
  - @mastra/deployer@1.15.0-alpha.2

## 1.3.14-alpha.1

### Patch Changes

- Updated dependencies [[`681ee1c`](https://github.com/mastra-ai/mastra/commit/681ee1c811359efd1b8bebc4bce35b9bb7b14bec)]:
  - @mastra/core@1.15.0-alpha.1
  - @mastra/deployer@1.15.0-alpha.1

## 1.3.14-alpha.0

### Patch Changes

- Updated dependencies [[`fa99b06`](https://github.com/mastra-ai/mastra/commit/fa99b06835ff9a674b37a5442351de3f704c5de0), [`cb611a1`](https://github.com/mastra-ai/mastra/commit/cb611a1e89a4f4cf74c97b57e0c27bb56f2eceb5), [`62d1d3c`](https://github.com/mastra-ai/mastra/commit/62d1d3cc08fe8182e7080237fd975de862ec8c91), [`8681ecb`](https://github.com/mastra-ai/mastra/commit/8681ecb86184d5907267000e4576cc442a9a83fc), [`28d0249`](https://github.com/mastra-ai/mastra/commit/28d0249295782277040ad1e0d243e695b7ab1ce4), [`bb0f09d`](https://github.com/mastra-ai/mastra/commit/bb0f09dbac58401b36069f483acf5673202db5b5), [`5f7e9d0`](https://github.com/mastra-ai/mastra/commit/5f7e9d0db664020e1f3d97d7d18c6b0b9d4843d0)]:
  - @mastra/deployer@1.15.0-alpha.0
  - @mastra/core@1.15.0-alpha.0

## 1.3.13

### Patch Changes

- Added a new `MASTRA_TEMPLATES` Studio runtime flag to control whether the **Templates** section appears in the sidebar. ([#14309](https://github.com/mastra-ai/mastra/pull/14309))
  - `MASTRA_TEMPLATES=true` now enables Templates navigation in Studio.
  - By default (`false` or unset), Templates is hidden.
  - Studio HTML injection now propagates this value in both CLI-hosted and deployer-hosted Studio builds.
  - Added tests covering environment variable injection for both paths.

- Fixed dev server startup log to display the configured `apiPrefix` instead of always showing `/api`. ([#14325](https://github.com/mastra-ai/mastra/pull/14325))

- Updated dependencies [[`51970b3`](https://github.com/mastra-ai/mastra/commit/51970b3828494d59a8dd4df143b194d37d31e3f5), [`4444280`](https://github.com/mastra-ai/mastra/commit/444428094253e916ec077e66284e685fde67021e), [`9d4f992`](https://github.com/mastra-ai/mastra/commit/9d4f9921d2d3afb3301b2c93f0e4e6a80a4f81a3), [`5dfaf3d`](https://github.com/mastra-ai/mastra/commit/5dfaf3d1cf286d56d3645398dcb687a4eb02db96), [`085e371`](https://github.com/mastra-ai/mastra/commit/085e3718a7d0fe9a210fe7dd1c867b9bdfe8d16b), [`b77aa19`](https://github.com/mastra-ai/mastra/commit/b77aa1981361c021f2c881bee8f0c703687f00da), [`dbb879a`](https://github.com/mastra-ai/mastra/commit/dbb879af0b809c668e9b3a9d8bac97d806caa267), [`8b4ce84`](https://github.com/mastra-ai/mastra/commit/8b4ce84aed0808b9805cc4fd7147c1f8a2ef7a36), [`8d4cfe6`](https://github.com/mastra-ai/mastra/commit/8d4cfe6b9a7157d3876206227ec9f04cde6dbc4a), [`dd6ca1c`](https://github.com/mastra-ai/mastra/commit/dd6ca1cdea3b8b6182f4cf61df41070ba0cc0deb), [`ce26fe2`](https://github.com/mastra-ai/mastra/commit/ce26fe2166dd90254f8bee5776e55977143e97de), [`68a019d`](https://github.com/mastra-ai/mastra/commit/68a019d30d22251ddd628a2947d60215c03c350a), [`4cb4edf`](https://github.com/mastra-ai/mastra/commit/4cb4edf3c909d197ec356c1790d13270514ffef6), [`f0dac25`](https://github.com/mastra-ai/mastra/commit/f0dac25d2753d022f66442f3d9057e0a40207ce7), [`0b0ba2f`](https://github.com/mastra-ai/mastra/commit/0b0ba2f251087df603b5ee512bb83ba81e79d9fb), [`8de3555`](https://github.com/mastra-ai/mastra/commit/8de355572c6fd838f863a3e7e6fe24d0947b774f), [`b26307f`](https://github.com/mastra-ai/mastra/commit/b26307f050df39629511b0e831b8fc26973ce8b1), [`68a019d`](https://github.com/mastra-ai/mastra/commit/68a019d30d22251ddd628a2947d60215c03c350a), [`e647a02`](https://github.com/mastra-ai/mastra/commit/e647a0215754bf91ed45c6d8857435bce4d387dc)]:
  - @mastra/core@1.14.0
  - @mastra/deployer@1.14.0
  - @mastra/loggers@1.0.3

## 1.3.13-alpha.3

### Patch Changes

- Updated dependencies [[`8b4ce84`](https://github.com/mastra-ai/mastra/commit/8b4ce84aed0808b9805cc4fd7147c1f8a2ef7a36), [`8d4cfe6`](https://github.com/mastra-ai/mastra/commit/8d4cfe6b9a7157d3876206227ec9f04cde6dbc4a), [`68a019d`](https://github.com/mastra-ai/mastra/commit/68a019d30d22251ddd628a2947d60215c03c350a), [`68a019d`](https://github.com/mastra-ai/mastra/commit/68a019d30d22251ddd628a2947d60215c03c350a)]:
  - @mastra/core@1.14.0-alpha.3
  - @mastra/deployer@1.14.0-alpha.3

## 1.3.13-alpha.2

### Patch Changes

- Updated dependencies [[`4444280`](https://github.com/mastra-ai/mastra/commit/444428094253e916ec077e66284e685fde67021e), [`dbb879a`](https://github.com/mastra-ai/mastra/commit/dbb879af0b809c668e9b3a9d8bac97d806caa267), [`8de3555`](https://github.com/mastra-ai/mastra/commit/8de355572c6fd838f863a3e7e6fe24d0947b774f)]:
  - @mastra/core@1.14.0-alpha.2
  - @mastra/deployer@1.14.0-alpha.2

## 1.3.13-alpha.1

### Patch Changes

- Added a new `MASTRA_TEMPLATES` Studio runtime flag to control whether the **Templates** section appears in the sidebar. ([#14309](https://github.com/mastra-ai/mastra/pull/14309))
  - `MASTRA_TEMPLATES=true` now enables Templates navigation in Studio.
  - By default (`false` or unset), Templates is hidden.
  - Studio HTML injection now propagates this value in both CLI-hosted and deployer-hosted Studio builds.
  - Added tests covering environment variable injection for both paths.

- Fixed dev server startup log to display the configured `apiPrefix` instead of always showing `/api`. ([#14325](https://github.com/mastra-ai/mastra/pull/14325))

- Updated dependencies [[`5dfaf3d`](https://github.com/mastra-ai/mastra/commit/5dfaf3d1cf286d56d3645398dcb687a4eb02db96), [`b77aa19`](https://github.com/mastra-ai/mastra/commit/b77aa1981361c021f2c881bee8f0c703687f00da), [`dd6ca1c`](https://github.com/mastra-ai/mastra/commit/dd6ca1cdea3b8b6182f4cf61df41070ba0cc0deb), [`4cb4edf`](https://github.com/mastra-ai/mastra/commit/4cb4edf3c909d197ec356c1790d13270514ffef6), [`e647a02`](https://github.com/mastra-ai/mastra/commit/e647a0215754bf91ed45c6d8857435bce4d387dc)]:
  - @mastra/deployer@1.13.3-alpha.1
  - @mastra/core@1.13.3-alpha.1

## 1.3.13-alpha.0

### Patch Changes

- Updated dependencies [[`51970b3`](https://github.com/mastra-ai/mastra/commit/51970b3828494d59a8dd4df143b194d37d31e3f5), [`9d4f992`](https://github.com/mastra-ai/mastra/commit/9d4f9921d2d3afb3301b2c93f0e4e6a80a4f81a3), [`085e371`](https://github.com/mastra-ai/mastra/commit/085e3718a7d0fe9a210fe7dd1c867b9bdfe8d16b), [`ce26fe2`](https://github.com/mastra-ai/mastra/commit/ce26fe2166dd90254f8bee5776e55977143e97de), [`f0dac25`](https://github.com/mastra-ai/mastra/commit/f0dac25d2753d022f66442f3d9057e0a40207ce7), [`0b0ba2f`](https://github.com/mastra-ai/mastra/commit/0b0ba2f251087df603b5ee512bb83ba81e79d9fb), [`b26307f`](https://github.com/mastra-ai/mastra/commit/b26307f050df39629511b0e831b8fc26973ce8b1)]:
  - @mastra/core@1.13.3-alpha.0
  - @mastra/deployer@1.13.3-alpha.0
  - @mastra/loggers@1.0.3-alpha.0

## 1.3.12

### Patch Changes

- Updated dependencies [[`0ce6035`](https://github.com/mastra-ai/mastra/commit/0ce603591189f547397704e53f23c77bc5630071)]:
  - @mastra/core@1.13.2
  - @mastra/deployer@1.13.2

## 1.3.12-alpha.0

### Patch Changes

- Updated dependencies [[`0ce6035`](https://github.com/mastra-ai/mastra/commit/0ce603591189f547397704e53f23c77bc5630071)]:
  - @mastra/core@1.13.2-alpha.0
  - @mastra/deployer@1.13.2-alpha.0

## 1.3.11

### Patch Changes

- Updated dependencies [[`205e76c`](https://github.com/mastra-ai/mastra/commit/205e76c3ba652205dafb037f50a4a8eea73f6736)]:
  - @mastra/core@1.13.1
  - @mastra/deployer@1.13.1

## 1.3.10

### Patch Changes

- Added dev session duration tracking on shutdown, package manager detection in analytics system properties, and component selection event tracking in the `create` command for both interactive and CLI-args paths. ([#13654](https://github.com/mastra-ai/mastra/pull/13654))

- Updated dependencies [[`ea86967`](https://github.com/mastra-ai/mastra/commit/ea86967449426e0a3673253bd1c2c052a99d970d), [`db21c21`](https://github.com/mastra-ai/mastra/commit/db21c21a6ae5f33539262cc535342fa8757eb359), [`388ca2f`](https://github.com/mastra-ai/mastra/commit/388ca2f89c2ac24d2e7a6b40e546549c9452e89c), [`11f5dbe`](https://github.com/mastra-ai/mastra/commit/11f5dbe9a1e7ad8ef3b1ea34fb4a9fa3631d1587), [`11f5dbe`](https://github.com/mastra-ai/mastra/commit/11f5dbe9a1e7ad8ef3b1ea34fb4a9fa3631d1587), [`6751354`](https://github.com/mastra-ai/mastra/commit/67513544d1a64be891d9de7624d40aadc895d56e), [`e3a6722`](https://github.com/mastra-ai/mastra/commit/e3a6722fda342d833f556f0e8e9204e4c736c726), [`c958cd3`](https://github.com/mastra-ai/mastra/commit/c958cd36627c1eea122ec241b2b15492977a263a), [`86f2426`](https://github.com/mastra-ai/mastra/commit/86f242631d252a172d2f9f9a2ea0feb8647a76b0), [`950eb07`](https://github.com/mastra-ai/mastra/commit/950eb07b7e7354629630e218d49550fdd299c452)]:
  - @mastra/core@1.13.0
  - @mastra/deployer@1.13.0

## 1.3.10-alpha.0

### Patch Changes

- Added dev session duration tracking on shutdown, package manager detection in analytics system properties, and component selection event tracking in the `create` command for both interactive and CLI-args paths. ([#13654](https://github.com/mastra-ai/mastra/pull/13654))

- Updated dependencies [[`ea86967`](https://github.com/mastra-ai/mastra/commit/ea86967449426e0a3673253bd1c2c052a99d970d), [`db21c21`](https://github.com/mastra-ai/mastra/commit/db21c21a6ae5f33539262cc535342fa8757eb359), [`388ca2f`](https://github.com/mastra-ai/mastra/commit/388ca2f89c2ac24d2e7a6b40e546549c9452e89c), [`11f5dbe`](https://github.com/mastra-ai/mastra/commit/11f5dbe9a1e7ad8ef3b1ea34fb4a9fa3631d1587), [`11f5dbe`](https://github.com/mastra-ai/mastra/commit/11f5dbe9a1e7ad8ef3b1ea34fb4a9fa3631d1587), [`6751354`](https://github.com/mastra-ai/mastra/commit/67513544d1a64be891d9de7624d40aadc895d56e), [`e3a6722`](https://github.com/mastra-ai/mastra/commit/e3a6722fda342d833f556f0e8e9204e4c736c726), [`c958cd3`](https://github.com/mastra-ai/mastra/commit/c958cd36627c1eea122ec241b2b15492977a263a), [`86f2426`](https://github.com/mastra-ai/mastra/commit/86f242631d252a172d2f9f9a2ea0feb8647a76b0), [`950eb07`](https://github.com/mastra-ai/mastra/commit/950eb07b7e7354629630e218d49550fdd299c452)]:
  - @mastra/core@1.13.0-alpha.0
  - @mastra/deployer@1.13.0-alpha.0

## 1.3.9

### Patch Changes

- Improved Studio load times by serving compressed static assets in both deploy and dev. Large bundles now download much faster and use significantly less bandwidth. ([#13945](https://github.com/mastra-ai/mastra/pull/13945))

- Updated dependencies [[`cddf895`](https://github.com/mastra-ai/mastra/commit/cddf895532b8ee7f9fa814136ec672f53d37a9ba), [`9cede11`](https://github.com/mastra-ai/mastra/commit/9cede110abac9d93072e0521bb3c8bcafb9fdadf), [`b160727`](https://github.com/mastra-ai/mastra/commit/b160727bbc9f0bf2c3fee633c077a353c8dab5ac), [`a59f126`](https://github.com/mastra-ai/mastra/commit/a59f1269104f54726699c5cdb98c72c93606d2df), [`ed8fd75`](https://github.com/mastra-ai/mastra/commit/ed8fd75cbff03bb5e19971ddb30ab7040fc60447), [`4bd5a32`](https://github.com/mastra-ai/mastra/commit/4bd5a3299c9e8410e15fc1d24eccff7a9a9a2af2), [`c510833`](https://github.com/mastra-ai/mastra/commit/c5108333e8cbc19dafee5f8bfefbcb5ee935335c), [`6255087`](https://github.com/mastra-ai/mastra/commit/62550872a7b4b11f2b3e34ef5f868bffb96e9440), [`c4c7dad`](https://github.com/mastra-ai/mastra/commit/c4c7dadfe2e4584f079f6c24bfabdb8c4981827f), [`45c3112`](https://github.com/mastra-ai/mastra/commit/45c31122666a0cc56b94727099fcb1871ed1b3f6), [`7296fcc`](https://github.com/mastra-ai/mastra/commit/7296fcc599c876a68699a71c7054a16d5aaf2337), [`00c27f9`](https://github.com/mastra-ai/mastra/commit/00c27f9080731433230a61be69c44e39a7a7b4c7), [`5e7c287`](https://github.com/mastra-ai/mastra/commit/5e7c28701f2bce795dd5c811e4c3060bf2ea2242), [`7e17d3f`](https://github.com/mastra-ai/mastra/commit/7e17d3f656fdda2aad47c4beb8c491636d70820c), [`ee19c9b`](https://github.com/mastra-ai/mastra/commit/ee19c9ba3ec3ed91feb214ad539bdc766c53bb01)]:
  - @mastra/core@1.12.0
  - @mastra/deployer@1.12.0

## 1.3.9-alpha.1

### Patch Changes

- Improved Studio load times by serving compressed static assets in both deploy and dev. Large bundles now download much faster and use significantly less bandwidth. ([#13945](https://github.com/mastra-ai/mastra/pull/13945))

- Updated dependencies [[`9cede11`](https://github.com/mastra-ai/mastra/commit/9cede110abac9d93072e0521bb3c8bcafb9fdadf), [`b160727`](https://github.com/mastra-ai/mastra/commit/b160727bbc9f0bf2c3fee633c077a353c8dab5ac), [`a59f126`](https://github.com/mastra-ai/mastra/commit/a59f1269104f54726699c5cdb98c72c93606d2df), [`c510833`](https://github.com/mastra-ai/mastra/commit/c5108333e8cbc19dafee5f8bfefbcb5ee935335c), [`6255087`](https://github.com/mastra-ai/mastra/commit/62550872a7b4b11f2b3e34ef5f868bffb96e9440), [`7296fcc`](https://github.com/mastra-ai/mastra/commit/7296fcc599c876a68699a71c7054a16d5aaf2337), [`00c27f9`](https://github.com/mastra-ai/mastra/commit/00c27f9080731433230a61be69c44e39a7a7b4c7), [`ee19c9b`](https://github.com/mastra-ai/mastra/commit/ee19c9ba3ec3ed91feb214ad539bdc766c53bb01)]:
  - @mastra/core@1.12.0-alpha.1
  - @mastra/deployer@1.12.0-alpha.1

## 1.3.9-alpha.0

### Patch Changes

- Updated dependencies [[`cddf895`](https://github.com/mastra-ai/mastra/commit/cddf895532b8ee7f9fa814136ec672f53d37a9ba), [`aede3cc`](https://github.com/mastra-ai/mastra/commit/aede3cc2a83b54bbd9e9a54c8aedcd1708b2ef87), [`4bd5a32`](https://github.com/mastra-ai/mastra/commit/4bd5a3299c9e8410e15fc1d24eccff7a9a9a2af2), [`c4c7dad`](https://github.com/mastra-ai/mastra/commit/c4c7dadfe2e4584f079f6c24bfabdb8c4981827f), [`45c3112`](https://github.com/mastra-ai/mastra/commit/45c31122666a0cc56b94727099fcb1871ed1b3f6), [`5e7c287`](https://github.com/mastra-ai/mastra/commit/5e7c28701f2bce795dd5c811e4c3060bf2ea2242), [`7e17d3f`](https://github.com/mastra-ai/mastra/commit/7e17d3f656fdda2aad47c4beb8c491636d70820c)]:
  - @mastra/core@1.12.0-alpha.0
  - @mastra/deployer@1.12.0-alpha.0

## 1.3.8

### Patch Changes

- dependencies updates: ([#14062](https://github.com/mastra-ai/mastra/pull/14062))
  - Updated dependency [`prettier@^3.8.1` ↗︎](https://www.npmjs.com/package/prettier/v/3.8.1) (from `^3.7.4`, in `dependencies`)

- dependencies updates: ([#14099](https://github.com/mastra-ai/mastra/pull/14099))
  - Updated dependency [`fs-extra@^11.3.4` ↗︎](https://www.npmjs.com/package/fs-extra/v/11.3.4) (from `^11.3.3`, in `dependencies`)

- dependencies updates: ([#14100](https://github.com/mastra-ai/mastra/pull/14100))
  - Updated dependency [`serve@^14.2.6` ↗︎](https://www.npmjs.com/package/serve/v/14.2.6) (from `^14.2.5`, in `dependencies`)
- Updated dependencies [[`4f71b43`](https://github.com/mastra-ai/mastra/commit/4f71b436a4a6b8839842d8da47b57b84509af56c), [`a070277`](https://github.com/mastra-ai/mastra/commit/a07027766ce195ba74d0783116d894cbab25d44c), [`7abbf1f`](https://github.com/mastra-ai/mastra/commit/7abbf1fb29f6f1b6ec2613e55605268481889adf), [`a6a5883`](https://github.com/mastra-ai/mastra/commit/a6a5883d288f4790ad4ce63d2a2c7fdc1743394f), [`b628b91`](https://github.com/mastra-ai/mastra/commit/b628b9128b372c0f54214d902b07279f03443900), [`332c014`](https://github.com/mastra-ai/mastra/commit/332c014e076b81edf7fe45b58205882726415e90), [`6b63153`](https://github.com/mastra-ai/mastra/commit/6b63153878ea841c0f4ce632ba66bb33e57e9c1b), [`4246e34`](https://github.com/mastra-ai/mastra/commit/4246e34cec9c26636d0965942268e6d07c346671), [`b8837ee`](https://github.com/mastra-ai/mastra/commit/b8837ee77e2e84197609762bfabd8b3da326d30c), [`866cc2c`](https://github.com/mastra-ai/mastra/commit/866cc2cb1f0e3b314afab5194f69477fada745d1), [`5d950f7`](https://github.com/mastra-ai/mastra/commit/5d950f7bf426a215a1808f0abef7de5c8336ba1c), [`28c85b1`](https://github.com/mastra-ai/mastra/commit/28c85b184fc32b40f7f160483c982da6d388ecbd), [`e9a08fb`](https://github.com/mastra-ai/mastra/commit/e9a08fbef1ada7e50e961e2f54f55e8c10b4a45c), [`1d0a8a8`](https://github.com/mastra-ai/mastra/commit/1d0a8a8acf33203d5744fc429b090ad8598aa8ed), [`631ffd8`](https://github.com/mastra-ai/mastra/commit/631ffd82fed108648b448b28e6a90e38c5f53bf5), [`6bcbf8a`](https://github.com/mastra-ai/mastra/commit/6bcbf8a6774d5a53b21d61db8a45ce2593ca1616), [`aae2295`](https://github.com/mastra-ai/mastra/commit/aae2295838a2d329ad6640829e87934790ffe5b8), [`aa61f29`](https://github.com/mastra-ai/mastra/commit/aa61f29ff8095ce46a4ae16e46c4d8c79b2b685b), [`7ff3714`](https://github.com/mastra-ai/mastra/commit/7ff37148515439bb3be009a60e02c3e363299760), [`18c3a90`](https://github.com/mastra-ai/mastra/commit/18c3a90c9e48cf69500e308affeb8eba5860b2af), [`41d79a1`](https://github.com/mastra-ai/mastra/commit/41d79a14bd8cb6de1e2565fd0a04786bae2f211b), [`f35487b`](https://github.com/mastra-ai/mastra/commit/f35487bb2d46c636e22aa71d90025613ae38235a), [`6dc2192`](https://github.com/mastra-ai/mastra/commit/6dc21921aef0f0efab15cd0805fa3d18f277a76f), [`eeb3a3f`](https://github.com/mastra-ai/mastra/commit/eeb3a3f43aca10cf49479eed2a84b7d9ecea02ba), [`e673376`](https://github.com/mastra-ai/mastra/commit/e6733763ad1321aa7e5ae15096b9c2104f93b1f3), [`05f8d90`](https://github.com/mastra-ai/mastra/commit/05f8d9009290ce6aa03428b3add635268615db85), [`b2204c9`](https://github.com/mastra-ai/mastra/commit/b2204c98a42848bbfb6f0440f005dc2b6354f1cd), [`a1bf1e3`](https://github.com/mastra-ai/mastra/commit/a1bf1e385ed4c0ef6f11b56c5887442970d127f2), [`b6f647a`](https://github.com/mastra-ai/mastra/commit/b6f647ae2388e091f366581595feb957e37d5b40), [`0c57b8b`](https://github.com/mastra-ai/mastra/commit/0c57b8b0a69a97b5a4ae3f79be6c610f29f3cf7b), [`b081f27`](https://github.com/mastra-ai/mastra/commit/b081f272cf411716e1d6bd72ceac4bcee2657b19), [`4b8da97`](https://github.com/mastra-ai/mastra/commit/4b8da97a5ce306e97869df6c39535d9069e563db), [`0c09eac`](https://github.com/mastra-ai/mastra/commit/0c09eacb1926f64cfdc9ae5c6d63385cf8c9f72c), [`6b9b93d`](https://github.com/mastra-ai/mastra/commit/6b9b93d6f459d1ba6e36f163abf62a085ddb3d64), [`31b6067`](https://github.com/mastra-ai/mastra/commit/31b6067d0cc3ab10e1b29c36147f3b5266bc714a), [`797ac42`](https://github.com/mastra-ai/mastra/commit/797ac4276de231ad2d694d9aeca75980f6cd0419), [`0bc289e`](https://github.com/mastra-ai/mastra/commit/0bc289e2d476bf46c5b91c21969e8d0c6864691c), [`9b75a06`](https://github.com/mastra-ai/mastra/commit/9b75a06e53ebb0b950ba7c1e83a0142047185f46), [`4c3a1b1`](https://github.com/mastra-ai/mastra/commit/4c3a1b122ea083e003d71092f30f3b31680b01c0), [`256df35`](https://github.com/mastra-ai/mastra/commit/256df3571d62beb3ad4971faa432927cc140e603), [`819fa1e`](https://github.com/mastra-ai/mastra/commit/819fa1e5ec3dd6f58afe33c65540d9ae4b2ae23a), [`85cc3b3`](https://github.com/mastra-ai/mastra/commit/85cc3b3b6f32ae4b083c26498f50d5b250ba944b), [`97ea28c`](https://github.com/mastra-ai/mastra/commit/97ea28c746e9e4147d56047bbb1c4a92417a3fec), [`d567299`](https://github.com/mastra-ai/mastra/commit/d567299cf81e02bd9d5221d4bc05967d6c224161), [`716ffe6`](https://github.com/mastra-ai/mastra/commit/716ffe68bed81f7c2690bc8581b9e140f7bf1c3d), [`8296332`](https://github.com/mastra-ai/mastra/commit/8296332de21c16e3dfc3d0b2d615720a6dc88f2f), [`4df2116`](https://github.com/mastra-ai/mastra/commit/4df211619dd922c047d396ca41cd7027c8c4c8e7), [`2219c1a`](https://github.com/mastra-ai/mastra/commit/2219c1acbd21da116da877f0036ffb985a9dd5a3), [`17c4145`](https://github.com/mastra-ai/mastra/commit/17c4145166099354545582335b5252bdfdfd908b)]:
  - @mastra/core@1.11.0
  - @mastra/deployer@1.11.0

## 1.3.8-alpha.2

### Patch Changes

- Updated dependencies [[`1d0a8a8`](https://github.com/mastra-ai/mastra/commit/1d0a8a8acf33203d5744fc429b090ad8598aa8ed)]:
  - @mastra/core@1.11.0-alpha.2
  - @mastra/deployer@1.11.0-alpha.2

## 1.3.8-alpha.1

### Patch Changes

- Updated dependencies [[`866cc2c`](https://github.com/mastra-ai/mastra/commit/866cc2cb1f0e3b314afab5194f69477fada745d1), [`6bcbf8a`](https://github.com/mastra-ai/mastra/commit/6bcbf8a6774d5a53b21d61db8a45ce2593ca1616), [`18c3a90`](https://github.com/mastra-ai/mastra/commit/18c3a90c9e48cf69500e308affeb8eba5860b2af), [`f35487b`](https://github.com/mastra-ai/mastra/commit/f35487bb2d46c636e22aa71d90025613ae38235a), [`6dc2192`](https://github.com/mastra-ai/mastra/commit/6dc21921aef0f0efab15cd0805fa3d18f277a76f), [`eeb3a3f`](https://github.com/mastra-ai/mastra/commit/eeb3a3f43aca10cf49479eed2a84b7d9ecea02ba), [`05f8d90`](https://github.com/mastra-ai/mastra/commit/05f8d9009290ce6aa03428b3add635268615db85), [`4b8da97`](https://github.com/mastra-ai/mastra/commit/4b8da97a5ce306e97869df6c39535d9069e563db), [`256df35`](https://github.com/mastra-ai/mastra/commit/256df3571d62beb3ad4971faa432927cc140e603)]:
  - @mastra/core@1.11.0-alpha.1
  - @mastra/deployer@1.11.0-alpha.1

## 1.3.8-alpha.0

### Patch Changes

- dependencies updates: ([#14062](https://github.com/mastra-ai/mastra/pull/14062))
  - Updated dependency [`prettier@^3.8.1` ↗︎](https://www.npmjs.com/package/prettier/v/3.8.1) (from `^3.7.4`, in `dependencies`)

- dependencies updates: ([#14099](https://github.com/mastra-ai/mastra/pull/14099))
  - Updated dependency [`fs-extra@^11.3.4` ↗︎](https://www.npmjs.com/package/fs-extra/v/11.3.4) (from `^11.3.3`, in `dependencies`)

- dependencies updates: ([#14100](https://github.com/mastra-ai/mastra/pull/14100))
  - Updated dependency [`serve@^14.2.6` ↗︎](https://www.npmjs.com/package/serve/v/14.2.6) (from `^14.2.5`, in `dependencies`)
- Updated dependencies [[`4f71b43`](https://github.com/mastra-ai/mastra/commit/4f71b436a4a6b8839842d8da47b57b84509af56c), [`a070277`](https://github.com/mastra-ai/mastra/commit/a07027766ce195ba74d0783116d894cbab25d44c), [`7abbf1f`](https://github.com/mastra-ai/mastra/commit/7abbf1fb29f6f1b6ec2613e55605268481889adf), [`a6a5883`](https://github.com/mastra-ai/mastra/commit/a6a5883d288f4790ad4ce63d2a2c7fdc1743394f), [`b628b91`](https://github.com/mastra-ai/mastra/commit/b628b9128b372c0f54214d902b07279f03443900), [`332c014`](https://github.com/mastra-ai/mastra/commit/332c014e076b81edf7fe45b58205882726415e90), [`6b63153`](https://github.com/mastra-ai/mastra/commit/6b63153878ea841c0f4ce632ba66bb33e57e9c1b), [`4246e34`](https://github.com/mastra-ai/mastra/commit/4246e34cec9c26636d0965942268e6d07c346671), [`b8837ee`](https://github.com/mastra-ai/mastra/commit/b8837ee77e2e84197609762bfabd8b3da326d30c), [`5d950f7`](https://github.com/mastra-ai/mastra/commit/5d950f7bf426a215a1808f0abef7de5c8336ba1c), [`28c85b1`](https://github.com/mastra-ai/mastra/commit/28c85b184fc32b40f7f160483c982da6d388ecbd), [`e9a08fb`](https://github.com/mastra-ai/mastra/commit/e9a08fbef1ada7e50e961e2f54f55e8c10b4a45c), [`631ffd8`](https://github.com/mastra-ai/mastra/commit/631ffd82fed108648b448b28e6a90e38c5f53bf5), [`aae2295`](https://github.com/mastra-ai/mastra/commit/aae2295838a2d329ad6640829e87934790ffe5b8), [`aa61f29`](https://github.com/mastra-ai/mastra/commit/aa61f29ff8095ce46a4ae16e46c4d8c79b2b685b), [`7ff3714`](https://github.com/mastra-ai/mastra/commit/7ff37148515439bb3be009a60e02c3e363299760), [`41d79a1`](https://github.com/mastra-ai/mastra/commit/41d79a14bd8cb6de1e2565fd0a04786bae2f211b), [`e673376`](https://github.com/mastra-ai/mastra/commit/e6733763ad1321aa7e5ae15096b9c2104f93b1f3), [`b2204c9`](https://github.com/mastra-ai/mastra/commit/b2204c98a42848bbfb6f0440f005dc2b6354f1cd), [`a1bf1e3`](https://github.com/mastra-ai/mastra/commit/a1bf1e385ed4c0ef6f11b56c5887442970d127f2), [`b6f647a`](https://github.com/mastra-ai/mastra/commit/b6f647ae2388e091f366581595feb957e37d5b40), [`0c57b8b`](https://github.com/mastra-ai/mastra/commit/0c57b8b0a69a97b5a4ae3f79be6c610f29f3cf7b), [`b081f27`](https://github.com/mastra-ai/mastra/commit/b081f272cf411716e1d6bd72ceac4bcee2657b19), [`0c09eac`](https://github.com/mastra-ai/mastra/commit/0c09eacb1926f64cfdc9ae5c6d63385cf8c9f72c), [`6b9b93d`](https://github.com/mastra-ai/mastra/commit/6b9b93d6f459d1ba6e36f163abf62a085ddb3d64), [`31b6067`](https://github.com/mastra-ai/mastra/commit/31b6067d0cc3ab10e1b29c36147f3b5266bc714a), [`797ac42`](https://github.com/mastra-ai/mastra/commit/797ac4276de231ad2d694d9aeca75980f6cd0419), [`0bc289e`](https://github.com/mastra-ai/mastra/commit/0bc289e2d476bf46c5b91c21969e8d0c6864691c), [`9b75a06`](https://github.com/mastra-ai/mastra/commit/9b75a06e53ebb0b950ba7c1e83a0142047185f46), [`4c3a1b1`](https://github.com/mastra-ai/mastra/commit/4c3a1b122ea083e003d71092f30f3b31680b01c0), [`819fa1e`](https://github.com/mastra-ai/mastra/commit/819fa1e5ec3dd6f58afe33c65540d9ae4b2ae23a), [`85cc3b3`](https://github.com/mastra-ai/mastra/commit/85cc3b3b6f32ae4b083c26498f50d5b250ba944b), [`97ea28c`](https://github.com/mastra-ai/mastra/commit/97ea28c746e9e4147d56047bbb1c4a92417a3fec), [`d567299`](https://github.com/mastra-ai/mastra/commit/d567299cf81e02bd9d5221d4bc05967d6c224161), [`716ffe6`](https://github.com/mastra-ai/mastra/commit/716ffe68bed81f7c2690bc8581b9e140f7bf1c3d), [`8296332`](https://github.com/mastra-ai/mastra/commit/8296332de21c16e3dfc3d0b2d615720a6dc88f2f), [`4df2116`](https://github.com/mastra-ai/mastra/commit/4df211619dd922c047d396ca41cd7027c8c4c8e7), [`2219c1a`](https://github.com/mastra-ai/mastra/commit/2219c1acbd21da116da877f0036ffb985a9dd5a3), [`17c4145`](https://github.com/mastra-ai/mastra/commit/17c4145166099354545582335b5252bdfdfd908b)]:
  - @mastra/core@1.11.0-alpha.0
  - @mastra/deployer@1.11.0-alpha.0

## 1.3.7

### Patch Changes

- Updated default OpenAI model from gpt-4o to gpt-5-mini for new projects. ([#13874](https://github.com/mastra-ai/mastra/pull/13874))

- dependencies updates: ([#13283](https://github.com/mastra-ai/mastra/pull/13283))
  - Updated dependency [`semver@^7.7.4` ↗︎](https://www.npmjs.com/package/semver/v/7.7.4) (from `^7.7.0`, in `dependencies`)
- Updated dependencies [[`41e48c1`](https://github.com/mastra-ai/mastra/commit/41e48c198eee846478e60c02ec432c19d322a517), [`82469d3`](https://github.com/mastra-ai/mastra/commit/82469d3135d5a49dd8dc8feec0ff398b4e0225a0), [`33e2fd5`](https://github.com/mastra-ai/mastra/commit/33e2fd5088f83666df17401e2da68c943dbc0448), [`7ef6e2c`](https://github.com/mastra-ai/mastra/commit/7ef6e2c61be5a42e26f55d15b5902866fc76634f), [`b12d2a5`](https://github.com/mastra-ai/mastra/commit/b12d2a59a48be0477cabae66eb6cf0fc94a7d40d), [`fa37d39`](https://github.com/mastra-ai/mastra/commit/fa37d39910421feaf8847716292e3d65dd4f30c2), [`b12d2a5`](https://github.com/mastra-ai/mastra/commit/b12d2a59a48be0477cabae66eb6cf0fc94a7d40d), [`71c38bf`](https://github.com/mastra-ai/mastra/commit/71c38bf905905148ecd0e75c07c1f9825d299b76), [`f993c38`](https://github.com/mastra-ai/mastra/commit/f993c3848c97479b813231be872443bedeced6ab), [`f51849a`](https://github.com/mastra-ai/mastra/commit/f51849a568935122b5100b7ee69704e6d680cf7b), [`9bf3a0d`](https://github.com/mastra-ai/mastra/commit/9bf3a0dac602787925f1762f1f0387d7b4a59620), [`cafa045`](https://github.com/mastra-ai/mastra/commit/cafa0453c9de141ad50c09a13894622dffdd9978), [`1fd9ddb`](https://github.com/mastra-ai/mastra/commit/1fd9ddbb3fe83b281b12bd2e27e426ae86288266), [`6135ef4`](https://github.com/mastra-ai/mastra/commit/6135ef4f5288652bf45f616ec590607e4c95f443), [`d9d228c`](https://github.com/mastra-ai/mastra/commit/d9d228c0c6ae82ae6ce3b540a3a56b2b1c2b8d98), [`5576507`](https://github.com/mastra-ai/mastra/commit/55765071e360fb97e443aa0a91ccf7e1cd8d92aa), [`79d69c9`](https://github.com/mastra-ai/mastra/commit/79d69c9d5f842ff1c31352fb6026f04c1f6190f3), [`94f44b8`](https://github.com/mastra-ai/mastra/commit/94f44b827ce57b179e50f4916a84c0fa6e7f3b8c), [`13187db`](https://github.com/mastra-ai/mastra/commit/13187dbac880174232dedc5a501ff6c5d0fe59bc), [`2ae5311`](https://github.com/mastra-ai/mastra/commit/2ae531185fff66a80fa165c0999e3d801900e89d), [`6135ef4`](https://github.com/mastra-ai/mastra/commit/6135ef4f5288652bf45f616ec590607e4c95f443)]:
  - @mastra/core@1.10.0
  - @mastra/deployer@1.10.0

## 1.3.7-alpha.1

### Patch Changes

- Updated default OpenAI model from gpt-4o to gpt-5-mini for new projects. ([#13874](https://github.com/mastra-ai/mastra/pull/13874))

## 1.3.7-alpha.0

### Patch Changes

- dependencies updates: ([#13283](https://github.com/mastra-ai/mastra/pull/13283))
  - Updated dependency [`semver@^7.7.4` ↗︎](https://www.npmjs.com/package/semver/v/7.7.4) (from `^7.7.0`, in `dependencies`)
- Updated dependencies [[`41e48c1`](https://github.com/mastra-ai/mastra/commit/41e48c198eee846478e60c02ec432c19d322a517), [`82469d3`](https://github.com/mastra-ai/mastra/commit/82469d3135d5a49dd8dc8feec0ff398b4e0225a0), [`33e2fd5`](https://github.com/mastra-ai/mastra/commit/33e2fd5088f83666df17401e2da68c943dbc0448), [`7ef6e2c`](https://github.com/mastra-ai/mastra/commit/7ef6e2c61be5a42e26f55d15b5902866fc76634f), [`b12d2a5`](https://github.com/mastra-ai/mastra/commit/b12d2a59a48be0477cabae66eb6cf0fc94a7d40d), [`fa37d39`](https://github.com/mastra-ai/mastra/commit/fa37d39910421feaf8847716292e3d65dd4f30c2), [`b12d2a5`](https://github.com/mastra-ai/mastra/commit/b12d2a59a48be0477cabae66eb6cf0fc94a7d40d), [`71c38bf`](https://github.com/mastra-ai/mastra/commit/71c38bf905905148ecd0e75c07c1f9825d299b76), [`f993c38`](https://github.com/mastra-ai/mastra/commit/f993c3848c97479b813231be872443bedeced6ab), [`f51849a`](https://github.com/mastra-ai/mastra/commit/f51849a568935122b5100b7ee69704e6d680cf7b), [`9bf3a0d`](https://github.com/mastra-ai/mastra/commit/9bf3a0dac602787925f1762f1f0387d7b4a59620), [`cafa045`](https://github.com/mastra-ai/mastra/commit/cafa0453c9de141ad50c09a13894622dffdd9978), [`1fd9ddb`](https://github.com/mastra-ai/mastra/commit/1fd9ddbb3fe83b281b12bd2e27e426ae86288266), [`6135ef4`](https://github.com/mastra-ai/mastra/commit/6135ef4f5288652bf45f616ec590607e4c95f443), [`d9d228c`](https://github.com/mastra-ai/mastra/commit/d9d228c0c6ae82ae6ce3b540a3a56b2b1c2b8d98), [`5576507`](https://github.com/mastra-ai/mastra/commit/55765071e360fb97e443aa0a91ccf7e1cd8d92aa), [`79d69c9`](https://github.com/mastra-ai/mastra/commit/79d69c9d5f842ff1c31352fb6026f04c1f6190f3), [`94f44b8`](https://github.com/mastra-ai/mastra/commit/94f44b827ce57b179e50f4916a84c0fa6e7f3b8c), [`13187db`](https://github.com/mastra-ai/mastra/commit/13187dbac880174232dedc5a501ff6c5d0fe59bc), [`2ae5311`](https://github.com/mastra-ai/mastra/commit/2ae531185fff66a80fa165c0999e3d801900e89d), [`6135ef4`](https://github.com/mastra-ai/mastra/commit/6135ef4f5288652bf45f616ec590607e4c95f443)]:
  - @mastra/core@1.10.0-alpha.0
  - @mastra/deployer@1.10.0-alpha.0

## 1.3.6

### Patch Changes

- Added auth provider bundling support to the build command. When an auth provider is configured, its package is automatically included in the build output. ([#13163](https://github.com/mastra-ai/mastra/pull/13163))

- Fixed workspace search UI: search panel now correctly hides when switching to a workspace without search capabilities, skill results are filtered from file search, and clicking a file search result switches to the files tab. Added init warning for autoIndexPaths. ([#13511](https://github.com/mastra-ai/mastra/pull/13511))

- Fix standalone Studio to respect `MASTRA_STUDIO_BASE_PATH` so subpath deployments load the correct base URL and static assets. ([#13689](https://github.com/mastra-ai/mastra/pull/13689))

- Redesigned experiment detail page with tabbed layout, score integration, and modular column panels. ([#13663](https://github.com/mastra-ai/mastra/pull/13663))

  **Experiment page layout**
  - Added `ExperimentPageContent` with Summary and Results tabs, replacing the old `ExperimentResultsListAndDetails` component
  - Summary tab shows `ExperimentScorerSummary` with per-scorer average scores
  - Results tab displays a master-detail column layout with score columns in the results list

  **Score detail panel**
  - Added `ExperimentScorePanel` that opens as a column when clicking a score row in the result detail panel
  - Shows score value, reason, input/output, and LLM prompts (preprocess, analyze, generate score, generate reason)
  - Score and trace panels are mutually exclusive — opening one closes the other
  - Prev/next navigation between scores within a result

  **Score data improvements**
  - `useScoresByExperimentId` now preserves full `ClientScoreRowData` instead of a minimal subset
  - Added `perPage: 10000` to `listScoresByRunId` to prevent score truncation from server default limit

  **Component cleanup**
  - Removed `ListAndDetails` DS component — replaced by `Column` sub-components (`Column.Toolbar`, `Column.Content`)
  - Extracted `MultiColumn` component for managing horizontally scrolling multi-column layouts
  - Deleted `ExperimentResultsListAndDetails` (superseded by `ExperimentPageContent`)

- Fixed `mastra build` ignoring `disableInit: true` — the built server no longer runs CREATE TABLE / ALTER TABLE statements on startup when `disableInit` is set. ([#13570](https://github.com/mastra-ai/mastra/issues/13570)) ([#13572](https://github.com/mastra-ai/mastra/pull/13572))

- Fixed CMS features (Create an agent button, clone, edit, create scorer) not appearing in built output. The build command now writes package metadata so the studio can detect installed Mastra packages at runtime. ([#13163](https://github.com/mastra-ai/mastra/pull/13163))

- Updated dependencies [[`504fc8b`](https://github.com/mastra-ai/mastra/commit/504fc8b9d0ddab717577ad3bf9c95ea4bd5377bd), [`f9c150b`](https://github.com/mastra-ai/mastra/commit/f9c150b7595ad05ad9cc9a11098e2944361e8c22), [`88de7e8`](https://github.com/mastra-ai/mastra/commit/88de7e8dfe4b7e1951a9e441bb33136e705ce24e), [`edee4b3`](https://github.com/mastra-ai/mastra/commit/edee4b37dff0af515fc7cc0e8d71ee39e6a762f0), [`3790c75`](https://github.com/mastra-ai/mastra/commit/3790c7578cc6a47d854eb12d89e6b1912867fe29), [`e7a235b`](https://github.com/mastra-ai/mastra/commit/e7a235be6472e0c870ed6c791ddb17c492dc188b), [`d51d298`](https://github.com/mastra-ai/mastra/commit/d51d298953967aab1f58ec965b644d109214f085), [`6dbeeb9`](https://github.com/mastra-ai/mastra/commit/6dbeeb94a8b1eebb727300d1a98961f882180794), [`d5f0d8d`](https://github.com/mastra-ai/mastra/commit/d5f0d8d6a03e515ddaa9b5da19b7e44b8357b07b), [`09c3b18`](https://github.com/mastra-ai/mastra/commit/09c3b1802ff14e243a8a8baea327440bc8cc2e32), [`b896379`](https://github.com/mastra-ai/mastra/commit/b8963791c6afa79484645fcec596a201f936b9a2), [`85c84eb`](https://github.com/mastra-ai/mastra/commit/85c84ebb78aebfcba9d209c8e152b16d7a00cb71), [`a89272a`](https://github.com/mastra-ai/mastra/commit/a89272a5d71939b9fcd284e6a6dc1dd091a6bdcf), [`ee9c8df`](https://github.com/mastra-ai/mastra/commit/ee9c8df644f19d055af5f496bf4942705f5a47b7), [`77b4a25`](https://github.com/mastra-ai/mastra/commit/77b4a254e51907f8ff3a3ba95596a18e93ae4b35), [`276246e`](https://github.com/mastra-ai/mastra/commit/276246e0b9066a1ea48bbc70df84dbe528daaf99), [`08ecfdb`](https://github.com/mastra-ai/mastra/commit/08ecfdbdad6fb8285deef86a034bdf4a6047cfca), [`5ca0767`](https://github.com/mastra-ai/mastra/commit/5ca0767eed8ce95aa95137039bb5c9f4d9804a26), [`d5f628c`](https://github.com/mastra-ai/mastra/commit/d5f628ca86c6f6f3ff1035d52f635df32dd81cab), [`524c0f3`](https://github.com/mastra-ai/mastra/commit/524c0f3c434c3d9d18f66338dcef383d6161b59c), [`c18a0e9`](https://github.com/mastra-ai/mastra/commit/c18a0e9cef1e4ca004b2963d35e4cfc031971eac), [`4bd21ea`](https://github.com/mastra-ai/mastra/commit/4bd21ea43d44d0a0427414fc047577f9f0aa3bec), [`115a7a4`](https://github.com/mastra-ai/mastra/commit/115a7a47db5e9896fec12ae6507501adb9ec89bf), [`22a48ae`](https://github.com/mastra-ai/mastra/commit/22a48ae2513eb54d8d79dad361fddbca97a155e8), [`3c6ef79`](https://github.com/mastra-ai/mastra/commit/3c6ef798481e00d6d22563be2de98818fd4dd5e0), [`9311c17`](https://github.com/mastra-ai/mastra/commit/9311c17d7a0640d9c4da2e71b814dc67c57c6369), [`628d8c6`](https://github.com/mastra-ai/mastra/commit/628d8c6a1c063ef3521d1e8872d52b967cc571a1), [`7edf78f`](https://github.com/mastra-ai/mastra/commit/7edf78f80422c43e84585f08ba11df0d4d0b73c5), [`1c4221c`](https://github.com/mastra-ai/mastra/commit/1c4221cf6032ec98d0e094d4ee11da3e48490d96), [`d25b9ea`](https://github.com/mastra-ai/mastra/commit/d25b9eabd400167255a97b690ffbc4ee4097ded5), [`fe1ce5c`](https://github.com/mastra-ai/mastra/commit/fe1ce5c9211c03d561606fda95cbfe7df1d9a9b5), [`b03c0e0`](https://github.com/mastra-ai/mastra/commit/b03c0e0389a799523929a458b0509c9e4244d562), [`0a8366b`](https://github.com/mastra-ai/mastra/commit/0a8366b0a692fcdde56c4d526e4cf03c502ae4ac), [`85664e9`](https://github.com/mastra-ai/mastra/commit/85664e9fd857320fbc245e301f764f45f66f32a3), [`bc79650`](https://github.com/mastra-ai/mastra/commit/bc796500c6e0334faa158a96077e3fb332274869), [`9257d01`](https://github.com/mastra-ai/mastra/commit/9257d01d1366d81f84c582fe02b5e200cf9621f4), [`3a3a59e`](https://github.com/mastra-ai/mastra/commit/3a3a59e8ffaa6a985fe3d9a126a3f5ade11a6724), [`122121c`](https://github.com/mastra-ai/mastra/commit/122121c872df5418a80c62ece0e313e37c54cb88), [`3108d4e`](https://github.com/mastra-ai/mastra/commit/3108d4e649c9fddbf03253a6feeb388a5fa9fa5a), [`0c33b2c`](https://github.com/mastra-ai/mastra/commit/0c33b2c9db537f815e1c59e2c898ffce2e395a79), [`191e5bd`](https://github.com/mastra-ai/mastra/commit/191e5bd29b82f5bda35243945790da7bc7b695c2), [`f77cd94`](https://github.com/mastra-ai/mastra/commit/f77cd94c44eabed490384e7d19232a865e13214c), [`e8135c7`](https://github.com/mastra-ai/mastra/commit/e8135c7e300dac5040670eec7eab896ac6092e30), [`daca48f`](https://github.com/mastra-ai/mastra/commit/daca48f0fb17b7ae0b62a2ac40cf0e491b2fd0b7), [`257d14f`](https://github.com/mastra-ai/mastra/commit/257d14faca5931f2e4186fc165b6f0b1f915deee), [`352f25d`](https://github.com/mastra-ai/mastra/commit/352f25da316b24cdd5b410fd8dddf6a8b763da2a), [`93477d0`](https://github.com/mastra-ai/mastra/commit/93477d0769b8a13ea5ed73d508d967fb23eaeed9), [`31c78b3`](https://github.com/mastra-ai/mastra/commit/31c78b3eb28f58a8017f1dcc795c33214d87feac), [`0bc0720`](https://github.com/mastra-ai/mastra/commit/0bc07201095791858087cc56f353fcd65e87ab54), [`36516ac`](https://github.com/mastra-ai/mastra/commit/36516aca1021cbeb42e74751b46a2614101f37c8), [`e947652`](https://github.com/mastra-ai/mastra/commit/e9476527fdecb4449e54570e80dfaf8466901254), [`3c6ef79`](https://github.com/mastra-ai/mastra/commit/3c6ef798481e00d6d22563be2de98818fd4dd5e0), [`9257d01`](https://github.com/mastra-ai/mastra/commit/9257d01d1366d81f84c582fe02b5e200cf9621f4), [`ec248f6`](https://github.com/mastra-ai/mastra/commit/ec248f6b56e8a037c066c49b2178e2507471d988)]:
  - @mastra/core@1.9.0
  - @mastra/deployer@1.9.0

## 1.3.6-alpha.0

### Patch Changes

- Added auth provider bundling support to the build command. When an auth provider is configured, its package is automatically included in the build output. ([#13163](https://github.com/mastra-ai/mastra/pull/13163))

- Fixed workspace search UI: search panel now correctly hides when switching to a workspace without search capabilities, skill results are filtered from file search, and clicking a file search result switches to the files tab. Added init warning for autoIndexPaths. ([#13511](https://github.com/mastra-ai/mastra/pull/13511))

- Fix standalone Studio to respect `MASTRA_STUDIO_BASE_PATH` so subpath deployments load the correct base URL and static assets. ([#13689](https://github.com/mastra-ai/mastra/pull/13689))

- Redesigned experiment detail page with tabbed layout, score integration, and modular column panels. ([#13663](https://github.com/mastra-ai/mastra/pull/13663))

  **Experiment page layout**
  - Added `ExperimentPageContent` with Summary and Results tabs, replacing the old `ExperimentResultsListAndDetails` component
  - Summary tab shows `ExperimentScorerSummary` with per-scorer average scores
  - Results tab displays a master-detail column layout with score columns in the results list

  **Score detail panel**
  - Added `ExperimentScorePanel` that opens as a column when clicking a score row in the result detail panel
  - Shows score value, reason, input/output, and LLM prompts (preprocess, analyze, generate score, generate reason)
  - Score and trace panels are mutually exclusive — opening one closes the other
  - Prev/next navigation between scores within a result

  **Score data improvements**
  - `useScoresByExperimentId` now preserves full `ClientScoreRowData` instead of a minimal subset
  - Added `perPage: 10000` to `listScoresByRunId` to prevent score truncation from server default limit

  **Component cleanup**
  - Removed `ListAndDetails` DS component — replaced by `Column` sub-components (`Column.Toolbar`, `Column.Content`)
  - Extracted `MultiColumn` component for managing horizontally scrolling multi-column layouts
  - Deleted `ExperimentResultsListAndDetails` (superseded by `ExperimentPageContent`)

- Fixed `mastra build` ignoring `disableInit: true` — the built server no longer runs CREATE TABLE / ALTER TABLE statements on startup when `disableInit` is set. ([#13570](https://github.com/mastra-ai/mastra/issues/13570)) ([#13572](https://github.com/mastra-ai/mastra/pull/13572))

- Fixed CMS features (Create an agent button, clone, edit, create scorer) not appearing in built output. The build command now writes package metadata so the studio can detect installed Mastra packages at runtime. ([#13163](https://github.com/mastra-ai/mastra/pull/13163))

- Updated dependencies [[`504fc8b`](https://github.com/mastra-ai/mastra/commit/504fc8b9d0ddab717577ad3bf9c95ea4bd5377bd), [`f9c150b`](https://github.com/mastra-ai/mastra/commit/f9c150b7595ad05ad9cc9a11098e2944361e8c22), [`88de7e8`](https://github.com/mastra-ai/mastra/commit/88de7e8dfe4b7e1951a9e441bb33136e705ce24e), [`edee4b3`](https://github.com/mastra-ai/mastra/commit/edee4b37dff0af515fc7cc0e8d71ee39e6a762f0), [`3790c75`](https://github.com/mastra-ai/mastra/commit/3790c7578cc6a47d854eb12d89e6b1912867fe29), [`e7a235b`](https://github.com/mastra-ai/mastra/commit/e7a235be6472e0c870ed6c791ddb17c492dc188b), [`d51d298`](https://github.com/mastra-ai/mastra/commit/d51d298953967aab1f58ec965b644d109214f085), [`6dbeeb9`](https://github.com/mastra-ai/mastra/commit/6dbeeb94a8b1eebb727300d1a98961f882180794), [`d5f0d8d`](https://github.com/mastra-ai/mastra/commit/d5f0d8d6a03e515ddaa9b5da19b7e44b8357b07b), [`09c3b18`](https://github.com/mastra-ai/mastra/commit/09c3b1802ff14e243a8a8baea327440bc8cc2e32), [`b896379`](https://github.com/mastra-ai/mastra/commit/b8963791c6afa79484645fcec596a201f936b9a2), [`85c84eb`](https://github.com/mastra-ai/mastra/commit/85c84ebb78aebfcba9d209c8e152b16d7a00cb71), [`a89272a`](https://github.com/mastra-ai/mastra/commit/a89272a5d71939b9fcd284e6a6dc1dd091a6bdcf), [`ee9c8df`](https://github.com/mastra-ai/mastra/commit/ee9c8df644f19d055af5f496bf4942705f5a47b7), [`77b4a25`](https://github.com/mastra-ai/mastra/commit/77b4a254e51907f8ff3a3ba95596a18e93ae4b35), [`276246e`](https://github.com/mastra-ai/mastra/commit/276246e0b9066a1ea48bbc70df84dbe528daaf99), [`08ecfdb`](https://github.com/mastra-ai/mastra/commit/08ecfdbdad6fb8285deef86a034bdf4a6047cfca), [`5ca0767`](https://github.com/mastra-ai/mastra/commit/5ca0767eed8ce95aa95137039bb5c9f4d9804a26), [`d5f628c`](https://github.com/mastra-ai/mastra/commit/d5f628ca86c6f6f3ff1035d52f635df32dd81cab), [`524c0f3`](https://github.com/mastra-ai/mastra/commit/524c0f3c434c3d9d18f66338dcef383d6161b59c), [`c18a0e9`](https://github.com/mastra-ai/mastra/commit/c18a0e9cef1e4ca004b2963d35e4cfc031971eac), [`4bd21ea`](https://github.com/mastra-ai/mastra/commit/4bd21ea43d44d0a0427414fc047577f9f0aa3bec), [`115a7a4`](https://github.com/mastra-ai/mastra/commit/115a7a47db5e9896fec12ae6507501adb9ec89bf), [`22a48ae`](https://github.com/mastra-ai/mastra/commit/22a48ae2513eb54d8d79dad361fddbca97a155e8), [`3c6ef79`](https://github.com/mastra-ai/mastra/commit/3c6ef798481e00d6d22563be2de98818fd4dd5e0), [`9311c17`](https://github.com/mastra-ai/mastra/commit/9311c17d7a0640d9c4da2e71b814dc67c57c6369), [`628d8c6`](https://github.com/mastra-ai/mastra/commit/628d8c6a1c063ef3521d1e8872d52b967cc571a1), [`7edf78f`](https://github.com/mastra-ai/mastra/commit/7edf78f80422c43e84585f08ba11df0d4d0b73c5), [`1c4221c`](https://github.com/mastra-ai/mastra/commit/1c4221cf6032ec98d0e094d4ee11da3e48490d96), [`d25b9ea`](https://github.com/mastra-ai/mastra/commit/d25b9eabd400167255a97b690ffbc4ee4097ded5), [`fe1ce5c`](https://github.com/mastra-ai/mastra/commit/fe1ce5c9211c03d561606fda95cbfe7df1d9a9b5), [`b03c0e0`](https://github.com/mastra-ai/mastra/commit/b03c0e0389a799523929a458b0509c9e4244d562), [`0a8366b`](https://github.com/mastra-ai/mastra/commit/0a8366b0a692fcdde56c4d526e4cf03c502ae4ac), [`85664e9`](https://github.com/mastra-ai/mastra/commit/85664e9fd857320fbc245e301f764f45f66f32a3), [`bc79650`](https://github.com/mastra-ai/mastra/commit/bc796500c6e0334faa158a96077e3fb332274869), [`9257d01`](https://github.com/mastra-ai/mastra/commit/9257d01d1366d81f84c582fe02b5e200cf9621f4), [`3a3a59e`](https://github.com/mastra-ai/mastra/commit/3a3a59e8ffaa6a985fe3d9a126a3f5ade11a6724), [`122121c`](https://github.com/mastra-ai/mastra/commit/122121c872df5418a80c62ece0e313e37c54cb88), [`3108d4e`](https://github.com/mastra-ai/mastra/commit/3108d4e649c9fddbf03253a6feeb388a5fa9fa5a), [`0c33b2c`](https://github.com/mastra-ai/mastra/commit/0c33b2c9db537f815e1c59e2c898ffce2e395a79), [`191e5bd`](https://github.com/mastra-ai/mastra/commit/191e5bd29b82f5bda35243945790da7bc7b695c2), [`f77cd94`](https://github.com/mastra-ai/mastra/commit/f77cd94c44eabed490384e7d19232a865e13214c), [`e8135c7`](https://github.com/mastra-ai/mastra/commit/e8135c7e300dac5040670eec7eab896ac6092e30), [`daca48f`](https://github.com/mastra-ai/mastra/commit/daca48f0fb17b7ae0b62a2ac40cf0e491b2fd0b7), [`257d14f`](https://github.com/mastra-ai/mastra/commit/257d14faca5931f2e4186fc165b6f0b1f915deee), [`352f25d`](https://github.com/mastra-ai/mastra/commit/352f25da316b24cdd5b410fd8dddf6a8b763da2a), [`93477d0`](https://github.com/mastra-ai/mastra/commit/93477d0769b8a13ea5ed73d508d967fb23eaeed9), [`31c78b3`](https://github.com/mastra-ai/mastra/commit/31c78b3eb28f58a8017f1dcc795c33214d87feac), [`0bc0720`](https://github.com/mastra-ai/mastra/commit/0bc07201095791858087cc56f353fcd65e87ab54), [`36516ac`](https://github.com/mastra-ai/mastra/commit/36516aca1021cbeb42e74751b46a2614101f37c8), [`e947652`](https://github.com/mastra-ai/mastra/commit/e9476527fdecb4449e54570e80dfaf8466901254), [`3c6ef79`](https://github.com/mastra-ai/mastra/commit/3c6ef798481e00d6d22563be2de98818fd4dd5e0), [`9257d01`](https://github.com/mastra-ai/mastra/commit/9257d01d1366d81f84c582fe02b5e200cf9621f4), [`ec248f6`](https://github.com/mastra-ai/mastra/commit/ec248f6b56e8a037c066c49b2178e2507471d988)]:
  - @mastra/core@1.9.0-alpha.0
  - @mastra/deployer@1.9.0-alpha.0

## 1.3.5

### Patch Changes

- Updated dependencies [[`df170fd`](https://github.com/mastra-ai/mastra/commit/df170fd139b55f845bfd2de8488b16435bd3d0da), [`ae55343`](https://github.com/mastra-ai/mastra/commit/ae5534397fc006fd6eef3e4f80c235bcdc9289ef), [`c290cec`](https://github.com/mastra-ai/mastra/commit/c290cec5bf9107225de42942b56b487107aa9dce), [`f03e794`](https://github.com/mastra-ai/mastra/commit/f03e794630f812b56e95aad54f7b1993dc003add), [`aa4a5ae`](https://github.com/mastra-ai/mastra/commit/aa4a5aedb80d8d6837bab8cbb2e301215d1ba3e9), [`de3f584`](https://github.com/mastra-ai/mastra/commit/de3f58408752a8d80a295275c7f23fc306cf7f4f), [`d3fb010`](https://github.com/mastra-ai/mastra/commit/d3fb010c98f575f1c0614452667396e2653815f6), [`702ee1c`](https://github.com/mastra-ai/mastra/commit/702ee1c41be67cc532b4dbe89bcb62143508f6f0), [`f495051`](https://github.com/mastra-ai/mastra/commit/f495051eb6496a720f637fc85b6d69941c12554c), [`e622f1d`](https://github.com/mastra-ai/mastra/commit/e622f1d3ab346a8e6aca6d1fe2eac99bd961e50b), [`861f111`](https://github.com/mastra-ai/mastra/commit/861f11189211b20ddb70d8df81a6b901fc78d11e), [`00f43e8`](https://github.com/mastra-ai/mastra/commit/00f43e8e97a80c82b27d5bd30494f10a715a1df9), [`1b6f651`](https://github.com/mastra-ai/mastra/commit/1b6f65127d4a0d6c38d0a1055cb84527db529d6b), [`96a1702`](https://github.com/mastra-ai/mastra/commit/96a1702ce362c50dda20c8b4a228b4ad1a36a17a), [`cb9f921`](https://github.com/mastra-ai/mastra/commit/cb9f921320913975657abb1404855d8c510f7ac5), [`114e7c1`](https://github.com/mastra-ai/mastra/commit/114e7c146ac682925f0fb37376c1be70e5d6e6e5), [`1b6f651`](https://github.com/mastra-ai/mastra/commit/1b6f65127d4a0d6c38d0a1055cb84527db529d6b), [`72df4a8`](https://github.com/mastra-ai/mastra/commit/72df4a8f9bf1a20cfd3d9006a4fdb597ad56d10a)]:
  - @mastra/core@1.8.0
  - @mastra/deployer@1.8.0

## 1.3.5-alpha.0

### Patch Changes

- Updated dependencies [[`df170fd`](https://github.com/mastra-ai/mastra/commit/df170fd139b55f845bfd2de8488b16435bd3d0da), [`ae55343`](https://github.com/mastra-ai/mastra/commit/ae5534397fc006fd6eef3e4f80c235bcdc9289ef), [`c290cec`](https://github.com/mastra-ai/mastra/commit/c290cec5bf9107225de42942b56b487107aa9dce), [`f03e794`](https://github.com/mastra-ai/mastra/commit/f03e794630f812b56e95aad54f7b1993dc003add), [`aa4a5ae`](https://github.com/mastra-ai/mastra/commit/aa4a5aedb80d8d6837bab8cbb2e301215d1ba3e9), [`de3f584`](https://github.com/mastra-ai/mastra/commit/de3f58408752a8d80a295275c7f23fc306cf7f4f), [`d3fb010`](https://github.com/mastra-ai/mastra/commit/d3fb010c98f575f1c0614452667396e2653815f6), [`702ee1c`](https://github.com/mastra-ai/mastra/commit/702ee1c41be67cc532b4dbe89bcb62143508f6f0), [`f495051`](https://github.com/mastra-ai/mastra/commit/f495051eb6496a720f637fc85b6d69941c12554c), [`e622f1d`](https://github.com/mastra-ai/mastra/commit/e622f1d3ab346a8e6aca6d1fe2eac99bd961e50b), [`861f111`](https://github.com/mastra-ai/mastra/commit/861f11189211b20ddb70d8df81a6b901fc78d11e), [`00f43e8`](https://github.com/mastra-ai/mastra/commit/00f43e8e97a80c82b27d5bd30494f10a715a1df9), [`1b6f651`](https://github.com/mastra-ai/mastra/commit/1b6f65127d4a0d6c38d0a1055cb84527db529d6b), [`96a1702`](https://github.com/mastra-ai/mastra/commit/96a1702ce362c50dda20c8b4a228b4ad1a36a17a), [`cb9f921`](https://github.com/mastra-ai/mastra/commit/cb9f921320913975657abb1404855d8c510f7ac5), [`114e7c1`](https://github.com/mastra-ai/mastra/commit/114e7c146ac682925f0fb37376c1be70e5d6e6e5), [`1b6f651`](https://github.com/mastra-ai/mastra/commit/1b6f65127d4a0d6c38d0a1055cb84527db529d6b), [`72df4a8`](https://github.com/mastra-ai/mastra/commit/72df4a8f9bf1a20cfd3d9006a4fdb597ad56d10a)]:
  - @mastra/core@1.8.0-alpha.0
  - @mastra/deployer@1.8.0-alpha.0

## 1.3.4

### Patch Changes

- Updated dependencies [[`24284ff`](https://github.com/mastra-ai/mastra/commit/24284ffae306ddf0ab83273e13f033520839ef40), [`f5097cc`](https://github.com/mastra-ai/mastra/commit/f5097cc8a813c82c3378882c31178320cadeb655), [`71e237f`](https://github.com/mastra-ai/mastra/commit/71e237fa852a3ad9a50a3ddb3b5f3b20b9a8181c), [`13a291e`](https://github.com/mastra-ai/mastra/commit/13a291ebb9f9bca80befa0d9166b916bb348e8e9), [`397af5a`](https://github.com/mastra-ai/mastra/commit/397af5a69f34d4157f51a7c8da3f1ded1e1d611c), [`d4701f7`](https://github.com/mastra-ai/mastra/commit/d4701f7e24822b081b70f9c806c39411b1a712e7), [`2b40831`](https://github.com/mastra-ai/mastra/commit/2b40831dcca2275c9570ddf09b7f25ba3e8dc7fc), [`6184727`](https://github.com/mastra-ai/mastra/commit/6184727e812bf7a65cee209bacec3a2f5a16e923), [`0c338b8`](https://github.com/mastra-ai/mastra/commit/0c338b87362dcd95ff8191ca00df645b6953f534), [`6f6385b`](https://github.com/mastra-ai/mastra/commit/6f6385be5b33687cd21e71fc27e972e6928bb34c), [`14aba61`](https://github.com/mastra-ai/mastra/commit/14aba61b9cff76d72bc7ef6f3a83ae2c5d059193), [`dd9dd1c`](https://github.com/mastra-ai/mastra/commit/dd9dd1c9ae32ae79093f8c4adde1732ac6357233)]:
  - @mastra/core@1.7.0
  - @mastra/deployer@1.7.0

## 1.3.4-alpha.0

### Patch Changes

- Updated dependencies [[`24284ff`](https://github.com/mastra-ai/mastra/commit/24284ffae306ddf0ab83273e13f033520839ef40), [`f5097cc`](https://github.com/mastra-ai/mastra/commit/f5097cc8a813c82c3378882c31178320cadeb655), [`71e237f`](https://github.com/mastra-ai/mastra/commit/71e237fa852a3ad9a50a3ddb3b5f3b20b9a8181c), [`13a291e`](https://github.com/mastra-ai/mastra/commit/13a291ebb9f9bca80befa0d9166b916bb348e8e9), [`397af5a`](https://github.com/mastra-ai/mastra/commit/397af5a69f34d4157f51a7c8da3f1ded1e1d611c), [`d4701f7`](https://github.com/mastra-ai/mastra/commit/d4701f7e24822b081b70f9c806c39411b1a712e7), [`2b40831`](https://github.com/mastra-ai/mastra/commit/2b40831dcca2275c9570ddf09b7f25ba3e8dc7fc), [`6184727`](https://github.com/mastra-ai/mastra/commit/6184727e812bf7a65cee209bacec3a2f5a16e923), [`6f6385b`](https://github.com/mastra-ai/mastra/commit/6f6385be5b33687cd21e71fc27e972e6928bb34c), [`14aba61`](https://github.com/mastra-ai/mastra/commit/14aba61b9cff76d72bc7ef6f3a83ae2c5d059193), [`dd9dd1c`](https://github.com/mastra-ai/mastra/commit/dd9dd1c9ae32ae79093f8c4adde1732ac6357233)]:
  - @mastra/core@1.7.0-alpha.0
  - @mastra/deployer@1.7.0-alpha.0

## 1.3.3

### Patch Changes

- Added a side-by-side diff view to the Dataset comparison pages (Compare Items and Compare Item Versions), making it easier to spot differences between dataset entries at a glance. ([#13267](https://github.com/mastra-ai/mastra/pull/13267))

- Added a searchable combobox header to the Dataset page, allowing you to quickly filter and switch between datasets without scrolling through a long list. ([#13273](https://github.com/mastra-ai/mastra/pull/13273))

- Removed the "Experimental" badge from the Datasets sidebar item now that the feature is stable. ([#13269](https://github.com/mastra-ai/mastra/pull/13269))

- Updated dependencies [[`0d9efb4`](https://github.com/mastra-ai/mastra/commit/0d9efb47992c34aa90581c18b9f51f774f6252a5), [`5caa13d`](https://github.com/mastra-ai/mastra/commit/5caa13d1b2a496e2565ab124a11de9a51ad3e3b9), [`940163f`](https://github.com/mastra-ai/mastra/commit/940163fc492401d7562301e6f106ccef4fefe06f), [`47892c8`](https://github.com/mastra-ai/mastra/commit/47892c85708eac348209f99f10f9a5f5267e11c0), [`45bb78b`](https://github.com/mastra-ai/mastra/commit/45bb78b70bd9db29678fe49476cd9f4ed01bfd0b), [`70eef84`](https://github.com/mastra-ai/mastra/commit/70eef84b8f44493598fdafa2980a0e7283415eda), [`d84e52d`](https://github.com/mastra-ai/mastra/commit/d84e52d0f6511283ddd21ed5fe7f945449d0f799), [`24b80af`](https://github.com/mastra-ai/mastra/commit/24b80af87da93bb84d389340181e17b7477fa9ca), [`608e156`](https://github.com/mastra-ai/mastra/commit/608e156def954c9604c5e3f6d9dfce3bcc7aeab0), [`2b2e157`](https://github.com/mastra-ai/mastra/commit/2b2e157a092cd597d9d3f0000d62b8bb4a7348ed), [`59d30b5`](https://github.com/mastra-ai/mastra/commit/59d30b5d0cb44ea7a1c440e7460dfb57eac9a9b5), [`453693b`](https://github.com/mastra-ai/mastra/commit/453693bf9e265ddccecef901d50da6caaea0fbc6), [`78d1c80`](https://github.com/mastra-ai/mastra/commit/78d1c808ad90201897a300af551bcc1d34458a20), [`c204b63`](https://github.com/mastra-ai/mastra/commit/c204b632d19e66acb6d6e19b11c4540dd6ad5380), [`742a417`](https://github.com/mastra-ai/mastra/commit/742a417896088220a3b5560c354c45c5ca6d88b9)]:
  - @mastra/core@1.6.0
  - @mastra/deployer@1.6.0

## 1.3.3-alpha.0

### Patch Changes

- Added a side-by-side diff view to the Dataset comparison pages (Compare Items and Compare Item Versions), making it easier to spot differences between dataset entries at a glance. ([#13267](https://github.com/mastra-ai/mastra/pull/13267))

- Added a searchable combobox header to the Dataset page, allowing you to quickly filter and switch between datasets without scrolling through a long list. ([#13273](https://github.com/mastra-ai/mastra/pull/13273))

- Removed the "Experimental" badge from the Datasets sidebar item now that the feature is stable. ([#13269](https://github.com/mastra-ai/mastra/pull/13269))

- Updated dependencies [[`0d9efb4`](https://github.com/mastra-ai/mastra/commit/0d9efb47992c34aa90581c18b9f51f774f6252a5), [`5caa13d`](https://github.com/mastra-ai/mastra/commit/5caa13d1b2a496e2565ab124a11de9a51ad3e3b9), [`940163f`](https://github.com/mastra-ai/mastra/commit/940163fc492401d7562301e6f106ccef4fefe06f), [`b260123`](https://github.com/mastra-ai/mastra/commit/b2601234bd093d358c92081a58f9b0befdae52b3), [`47892c8`](https://github.com/mastra-ai/mastra/commit/47892c85708eac348209f99f10f9a5f5267e11c0), [`45bb78b`](https://github.com/mastra-ai/mastra/commit/45bb78b70bd9db29678fe49476cd9f4ed01bfd0b), [`70eef84`](https://github.com/mastra-ai/mastra/commit/70eef84b8f44493598fdafa2980a0e7283415eda), [`d84e52d`](https://github.com/mastra-ai/mastra/commit/d84e52d0f6511283ddd21ed5fe7f945449d0f799), [`24b80af`](https://github.com/mastra-ai/mastra/commit/24b80af87da93bb84d389340181e17b7477fa9ca), [`608e156`](https://github.com/mastra-ai/mastra/commit/608e156def954c9604c5e3f6d9dfce3bcc7aeab0), [`2b2e157`](https://github.com/mastra-ai/mastra/commit/2b2e157a092cd597d9d3f0000d62b8bb4a7348ed), [`59d30b5`](https://github.com/mastra-ai/mastra/commit/59d30b5d0cb44ea7a1c440e7460dfb57eac9a9b5), [`453693b`](https://github.com/mastra-ai/mastra/commit/453693bf9e265ddccecef901d50da6caaea0fbc6), [`78d1c80`](https://github.com/mastra-ai/mastra/commit/78d1c808ad90201897a300af551bcc1d34458a20), [`c204b63`](https://github.com/mastra-ai/mastra/commit/c204b632d19e66acb6d6e19b11c4540dd6ad5380), [`742a417`](https://github.com/mastra-ai/mastra/commit/742a417896088220a3b5560c354c45c5ca6d88b9)]:
  - @mastra/core@1.6.0-alpha.0
  - @mastra/deployer@1.6.0-alpha.0

## 1.3.2

### Patch Changes

- Update internal dependency `@clack/prompts` to v1 ([#13095](https://github.com/mastra-ai/mastra/pull/13095))

- Updated style of Button and Select experimental variants ([#13186](https://github.com/mastra-ai/mastra/pull/13186))

- Updated dependencies [[`252580a`](https://github.com/mastra-ai/mastra/commit/252580a71feb0e46d0ccab04a70a79ff6a2ee0ab), [`f8e819f`](https://github.com/mastra-ai/mastra/commit/f8e819fabdfdc43d2da546a3ad81ba23685f603d), [`252580a`](https://github.com/mastra-ai/mastra/commit/252580a71feb0e46d0ccab04a70a79ff6a2ee0ab), [`620b476`](https://github.com/mastra-ai/mastra/commit/620b476a1d7595ec7796ed1e341a6d64020116c7), [`71bb065`](https://github.com/mastra-ai/mastra/commit/71bb0651ce433e1e03fa30bd25f397748065e637), [`5c75261`](https://github.com/mastra-ai/mastra/commit/5c7526120d936757d4ffb7b82232e1641ebd45cb), [`e27d832`](https://github.com/mastra-ai/mastra/commit/e27d83281b5e166fd63a13969689e928d8605944), [`e37ef84`](https://github.com/mastra-ai/mastra/commit/e37ef8404043c94ca0c8e35ecdedb093b8087878), [`6fdd3d4`](https://github.com/mastra-ai/mastra/commit/6fdd3d451a07a8e7e216c62ac364f8dd8e36c2af), [`10cf521`](https://github.com/mastra-ai/mastra/commit/10cf52183344743a0d7babe24cd24fd78870c354), [`efdb682`](https://github.com/mastra-ai/mastra/commit/efdb682887f6522149769383908f9790c188ab88), [`0dee7a0`](https://github.com/mastra-ai/mastra/commit/0dee7a0ff4c2507e6eb6e6ee5f9738877ebd4ad1), [`04c2c8e`](https://github.com/mastra-ai/mastra/commit/04c2c8e888984364194131aecb490a3d6e920e61), [`02dc07a`](https://github.com/mastra-ai/mastra/commit/02dc07acc4ad42d93335825e3308f5b42266eba2), [`bb7262b`](https://github.com/mastra-ai/mastra/commit/bb7262b7c0ca76320d985b40510b6ffbbb936582), [`cf1c6e7`](https://github.com/mastra-ai/mastra/commit/cf1c6e789b131f55638fed52183a89d5078b4876), [`f363a8c`](https://github.com/mastra-ai/mastra/commit/f363a8c596e529150bf58717a02a5060a7af5b6b), [`5ffadfe`](https://github.com/mastra-ai/mastra/commit/5ffadfefb1468ac2612b20bb84d24c39de6961c0), [`1e1339c`](https://github.com/mastra-ai/mastra/commit/1e1339cc276e571a48cfff5014487877086bfe68), [`d03df73`](https://github.com/mastra-ai/mastra/commit/d03df73f8fe9496064a33e1c3b74ba0479bf9ee6), [`79b8f45`](https://github.com/mastra-ai/mastra/commit/79b8f45a6767e1a5c3d56cd3c5b1214326b81661), [`9bbf08e`](https://github.com/mastra-ai/mastra/commit/9bbf08e3c20731c79dea13a765895b9fcf29cbf1), [`0a25952`](https://github.com/mastra-ai/mastra/commit/0a259526b5e1ac11e6efa53db1f140272962af2d), [`ffa5468`](https://github.com/mastra-ai/mastra/commit/ffa546857fc4821753979b3a34e13b4d76fbbcd4), [`3264a04`](https://github.com/mastra-ai/mastra/commit/3264a04e30340c3c5447433300a035ea0878df85), [`6fdd3d4`](https://github.com/mastra-ai/mastra/commit/6fdd3d451a07a8e7e216c62ac364f8dd8e36c2af), [`088d9ba`](https://github.com/mastra-ai/mastra/commit/088d9ba2577518703c52b0dccd617178d9ee6b0d), [`74fbebd`](https://github.com/mastra-ai/mastra/commit/74fbebd918a03832a2864965a8bea59bf617d3a2), [`aea6217`](https://github.com/mastra-ai/mastra/commit/aea621790bfb2291431b08da0cc5e6e150303ae7), [`b6a855e`](https://github.com/mastra-ai/mastra/commit/b6a855edc056e088279075506442ba1d6fa6def9), [`ae408ea`](https://github.com/mastra-ai/mastra/commit/ae408ea7128f0d2710b78d8623185198e7cb19c1), [`17e942e`](https://github.com/mastra-ai/mastra/commit/17e942eee2ba44985b1f807e6208cdde672f82f9), [`2015cf9`](https://github.com/mastra-ai/mastra/commit/2015cf921649f44c3f5bcd32a2c052335f8e49b4), [`7ef454e`](https://github.com/mastra-ai/mastra/commit/7ef454eaf9dcec6de60021c8f42192052dd490d6), [`2be1d99`](https://github.com/mastra-ai/mastra/commit/2be1d99564ce79acc4846071082bff353035a87a), [`2708fa1`](https://github.com/mastra-ai/mastra/commit/2708fa1055ac91c03e08b598869f6b8fb51fa37f), [`ba74aef`](https://github.com/mastra-ai/mastra/commit/ba74aef5716142dbbe931351f5243c9c6e4128a9), [`ba74aef`](https://github.com/mastra-ai/mastra/commit/ba74aef5716142dbbe931351f5243c9c6e4128a9), [`ec53e89`](https://github.com/mastra-ai/mastra/commit/ec53e8939c76c638991e21af762e51378eff7543), [`9b5a8cb`](https://github.com/mastra-ai/mastra/commit/9b5a8cb13e120811b0bf14140ada314f1c067894), [`607e66b`](https://github.com/mastra-ai/mastra/commit/607e66b02dc7f531ee37799f3456aa2dc0ca7ac5), [`a215d06`](https://github.com/mastra-ai/mastra/commit/a215d06758dcf590eabfe0b7afd4ae39bdbf082c), [`6909c74`](https://github.com/mastra-ai/mastra/commit/6909c74a7781e0447d475e9dbc1dc871b700f426), [`192438f`](https://github.com/mastra-ai/mastra/commit/192438f8a90c4f375e955f8ff179bf8dc6821a83)]:
  - @mastra/core@1.5.0
  - @mastra/deployer@1.5.0
  - @mastra/loggers@1.0.2

## 1.3.2-alpha.1

### Patch Changes

- Updated dependencies [[`71bb065`](https://github.com/mastra-ai/mastra/commit/71bb0651ce433e1e03fa30bd25f397748065e637)]:
  - @mastra/loggers@1.0.2-alpha.0
  - @mastra/core@1.5.0-alpha.1
  - @mastra/deployer@1.5.0-alpha.1

## 1.3.2-alpha.0

### Patch Changes

- Update internal dependency `@clack/prompts` to v1 ([#13095](https://github.com/mastra-ai/mastra/pull/13095))

- Updated style of Button and Select experimental variants ([#13186](https://github.com/mastra-ai/mastra/pull/13186))

- Updated dependencies [[`252580a`](https://github.com/mastra-ai/mastra/commit/252580a71feb0e46d0ccab04a70a79ff6a2ee0ab), [`f8e819f`](https://github.com/mastra-ai/mastra/commit/f8e819fabdfdc43d2da546a3ad81ba23685f603d), [`252580a`](https://github.com/mastra-ai/mastra/commit/252580a71feb0e46d0ccab04a70a79ff6a2ee0ab), [`620b476`](https://github.com/mastra-ai/mastra/commit/620b476a1d7595ec7796ed1e341a6d64020116c7), [`5c75261`](https://github.com/mastra-ai/mastra/commit/5c7526120d936757d4ffb7b82232e1641ebd45cb), [`e27d832`](https://github.com/mastra-ai/mastra/commit/e27d83281b5e166fd63a13969689e928d8605944), [`e37ef84`](https://github.com/mastra-ai/mastra/commit/e37ef8404043c94ca0c8e35ecdedb093b8087878), [`6fdd3d4`](https://github.com/mastra-ai/mastra/commit/6fdd3d451a07a8e7e216c62ac364f8dd8e36c2af), [`10cf521`](https://github.com/mastra-ai/mastra/commit/10cf52183344743a0d7babe24cd24fd78870c354), [`efdb682`](https://github.com/mastra-ai/mastra/commit/efdb682887f6522149769383908f9790c188ab88), [`0dee7a0`](https://github.com/mastra-ai/mastra/commit/0dee7a0ff4c2507e6eb6e6ee5f9738877ebd4ad1), [`04c2c8e`](https://github.com/mastra-ai/mastra/commit/04c2c8e888984364194131aecb490a3d6e920e61), [`02dc07a`](https://github.com/mastra-ai/mastra/commit/02dc07acc4ad42d93335825e3308f5b42266eba2), [`bb7262b`](https://github.com/mastra-ai/mastra/commit/bb7262b7c0ca76320d985b40510b6ffbbb936582), [`cf1c6e7`](https://github.com/mastra-ai/mastra/commit/cf1c6e789b131f55638fed52183a89d5078b4876), [`f363a8c`](https://github.com/mastra-ai/mastra/commit/f363a8c596e529150bf58717a02a5060a7af5b6b), [`5ffadfe`](https://github.com/mastra-ai/mastra/commit/5ffadfefb1468ac2612b20bb84d24c39de6961c0), [`1e1339c`](https://github.com/mastra-ai/mastra/commit/1e1339cc276e571a48cfff5014487877086bfe68), [`d03df73`](https://github.com/mastra-ai/mastra/commit/d03df73f8fe9496064a33e1c3b74ba0479bf9ee6), [`79b8f45`](https://github.com/mastra-ai/mastra/commit/79b8f45a6767e1a5c3d56cd3c5b1214326b81661), [`9bbf08e`](https://github.com/mastra-ai/mastra/commit/9bbf08e3c20731c79dea13a765895b9fcf29cbf1), [`0a25952`](https://github.com/mastra-ai/mastra/commit/0a259526b5e1ac11e6efa53db1f140272962af2d), [`ffa5468`](https://github.com/mastra-ai/mastra/commit/ffa546857fc4821753979b3a34e13b4d76fbbcd4), [`3264a04`](https://github.com/mastra-ai/mastra/commit/3264a04e30340c3c5447433300a035ea0878df85), [`6fdd3d4`](https://github.com/mastra-ai/mastra/commit/6fdd3d451a07a8e7e216c62ac364f8dd8e36c2af), [`088d9ba`](https://github.com/mastra-ai/mastra/commit/088d9ba2577518703c52b0dccd617178d9ee6b0d), [`74fbebd`](https://github.com/mastra-ai/mastra/commit/74fbebd918a03832a2864965a8bea59bf617d3a2), [`aea6217`](https://github.com/mastra-ai/mastra/commit/aea621790bfb2291431b08da0cc5e6e150303ae7), [`b6a855e`](https://github.com/mastra-ai/mastra/commit/b6a855edc056e088279075506442ba1d6fa6def9), [`ae408ea`](https://github.com/mastra-ai/mastra/commit/ae408ea7128f0d2710b78d8623185198e7cb19c1), [`17e942e`](https://github.com/mastra-ai/mastra/commit/17e942eee2ba44985b1f807e6208cdde672f82f9), [`2015cf9`](https://github.com/mastra-ai/mastra/commit/2015cf921649f44c3f5bcd32a2c052335f8e49b4), [`7ef454e`](https://github.com/mastra-ai/mastra/commit/7ef454eaf9dcec6de60021c8f42192052dd490d6), [`2be1d99`](https://github.com/mastra-ai/mastra/commit/2be1d99564ce79acc4846071082bff353035a87a), [`2708fa1`](https://github.com/mastra-ai/mastra/commit/2708fa1055ac91c03e08b598869f6b8fb51fa37f), [`ba74aef`](https://github.com/mastra-ai/mastra/commit/ba74aef5716142dbbe931351f5243c9c6e4128a9), [`ba74aef`](https://github.com/mastra-ai/mastra/commit/ba74aef5716142dbbe931351f5243c9c6e4128a9), [`ec53e89`](https://github.com/mastra-ai/mastra/commit/ec53e8939c76c638991e21af762e51378eff7543), [`9b5a8cb`](https://github.com/mastra-ai/mastra/commit/9b5a8cb13e120811b0bf14140ada314f1c067894), [`607e66b`](https://github.com/mastra-ai/mastra/commit/607e66b02dc7f531ee37799f3456aa2dc0ca7ac5), [`a215d06`](https://github.com/mastra-ai/mastra/commit/a215d06758dcf590eabfe0b7afd4ae39bdbf082c), [`6909c74`](https://github.com/mastra-ai/mastra/commit/6909c74a7781e0447d475e9dbc1dc871b700f426), [`192438f`](https://github.com/mastra-ai/mastra/commit/192438f8a90c4f375e955f8ff179bf8dc6821a83)]:
  - @mastra/core@1.5.0-alpha.0
  - @mastra/deployer@1.5.0-alpha.0

## 1.3.1

### Patch Changes

- dependencies updates: ([#12989](https://github.com/mastra-ai/mastra/pull/12989))
  - Updated dependency [`commander@^14.0.3` ↗︎](https://www.npmjs.com/package/commander/v/14.0.3) (from `^14.0.2`, in `dependencies`)

- Do not show verbose `dotenv` output when loading environment variables in the `studio` command ([#12956](https://github.com/mastra-ai/mastra/pull/12956))

- Updated dependencies [[`7ef618f`](https://github.com/mastra-ai/mastra/commit/7ef618f3c49c27e2f6b27d7f564c557c0734325b), [`b373564`](https://github.com/mastra-ai/mastra/commit/b37356491d43b4d53067f10cb669abaf2502f218), [`927c2af`](https://github.com/mastra-ai/mastra/commit/927c2af9792286c122e04409efce0f3c804f777f), [`b896b41`](https://github.com/mastra-ai/mastra/commit/b896b41343de7fcc14442fb40fe82d189e65bbe2), [`6415277`](https://github.com/mastra-ai/mastra/commit/6415277a438faa00db2af850ead5dee25f40c428), [`0831bbb`](https://github.com/mastra-ai/mastra/commit/0831bbb5bc750c18e9b22b45f18687c964b70828), [`63f7eda`](https://github.com/mastra-ai/mastra/commit/63f7eda605eb3e0c8c35ee3912ffe7c999c69f69), [`a5b67a3`](https://github.com/mastra-ai/mastra/commit/a5b67a3589a74415feb663a55d1858324a2afde9), [`877b02c`](https://github.com/mastra-ai/mastra/commit/877b02cdbb15e199184c7f2b8f217be8d3ebada7), [`7567222`](https://github.com/mastra-ai/mastra/commit/7567222b1366f0d39980594792dd9d5060bfe2ab), [`af71458`](https://github.com/mastra-ai/mastra/commit/af71458e3b566f09c11d0e5a0a836dc818e7a24a), [`eb36bd8`](https://github.com/mastra-ai/mastra/commit/eb36bd8c52fcd6ec9674ac3b7a6412405b5983e1), [`3cbf121`](https://github.com/mastra-ai/mastra/commit/3cbf121f55418141924754a83102aade89835947)]:
  - @mastra/core@1.4.0
  - @mastra/deployer@1.4.0

## 1.3.1-alpha.0

### Patch Changes

- dependencies updates: ([#12989](https://github.com/mastra-ai/mastra/pull/12989))
  - Updated dependency [`commander@^14.0.3` ↗︎](https://www.npmjs.com/package/commander/v/14.0.3) (from `^14.0.2`, in `dependencies`)

- Do not show verbose `dotenv` output when loading environment variables in the `studio` command ([#12956](https://github.com/mastra-ai/mastra/pull/12956))

- Updated dependencies [[`7ef618f`](https://github.com/mastra-ai/mastra/commit/7ef618f3c49c27e2f6b27d7f564c557c0734325b), [`b373564`](https://github.com/mastra-ai/mastra/commit/b37356491d43b4d53067f10cb669abaf2502f218), [`927c2af`](https://github.com/mastra-ai/mastra/commit/927c2af9792286c122e04409efce0f3c804f777f), [`b896b41`](https://github.com/mastra-ai/mastra/commit/b896b41343de7fcc14442fb40fe82d189e65bbe2), [`6415277`](https://github.com/mastra-ai/mastra/commit/6415277a438faa00db2af850ead5dee25f40c428), [`0831bbb`](https://github.com/mastra-ai/mastra/commit/0831bbb5bc750c18e9b22b45f18687c964b70828), [`63f7eda`](https://github.com/mastra-ai/mastra/commit/63f7eda605eb3e0c8c35ee3912ffe7c999c69f69), [`a5b67a3`](https://github.com/mastra-ai/mastra/commit/a5b67a3589a74415feb663a55d1858324a2afde9), [`877b02c`](https://github.com/mastra-ai/mastra/commit/877b02cdbb15e199184c7f2b8f217be8d3ebada7), [`7567222`](https://github.com/mastra-ai/mastra/commit/7567222b1366f0d39980594792dd9d5060bfe2ab), [`af71458`](https://github.com/mastra-ai/mastra/commit/af71458e3b566f09c11d0e5a0a836dc818e7a24a), [`eb36bd8`](https://github.com/mastra-ai/mastra/commit/eb36bd8c52fcd6ec9674ac3b7a6412405b5983e1), [`3cbf121`](https://github.com/mastra-ai/mastra/commit/3cbf121f55418141924754a83102aade89835947)]:
  - @mastra/core@1.4.0-alpha.0
  - @mastra/deployer@1.4.0-alpha.0

## 1.3.0

### Minor Changes

- Added support for request context presets in Mastra Studio. You can now define a JSON file with named requestContext presets and pass it via the `--request-context-presets` CLI flag to both `mastra dev` and `mastra studio` commands. A dropdown selector appears in the Studio Playground, allowing you to quickly switch between preset configurations. ([#12501](https://github.com/mastra-ai/mastra/pull/12501))

  **Usage:**

  ```bash
  mastra dev --request-context-presets ./presets.json
  mastra studio --request-context-presets ./presets.json
  ```

  **Presets file format:**

  ```json
  {
    "development": { "userId": "dev-user", "env": "development" },
    "production": { "userId": "prod-user", "env": "production" }
  }
  ```

  When presets are loaded, a dropdown appears above the JSON editor on the Request Context page. Selecting a preset populates the editor, and manually editing the JSON automatically switches back to "Custom".

- Update peer dependencies to match core package version bump (1.1.0) ([#12508](https://github.com/mastra-ai/mastra/pull/12508))

### Patch Changes

- Improved AGENTS.md generated by create-mastra to emphasize loading the Mastra skill before working with Mastra code. When skills are configured, the file now includes a CRITICAL section at the top and detailed loading instructions to ensure agents use current APIs instead of outdated training data. ([#12824](https://github.com/mastra-ai/mastra/pull/12824))

- Supporting work to enable workflow step metadata ([#12508](https://github.com/mastra-ai/mastra/pull/12508))

- Added `--custom-args` flag to `mastra start`, matching the existing support in `mastra dev`. This lets you pass Node.js flags like `--require=newrelic` to the production server process. ([#12842](https://github.com/mastra-ai/mastra/pull/12842))

- Add hints to the `create mastra` CLI on how to use the multiselect prompt. Also remove Codex and OpenCode from initial selection of skills since they support `.agents` now. ([#12717](https://github.com/mastra-ai/mastra/pull/12717))

- Updated dependencies [[`717ffab`](https://github.com/mastra-ai/mastra/commit/717ffab42cfd58ff723b5c19ada4939997773004), [`b31c922`](https://github.com/mastra-ai/mastra/commit/b31c922215b513791d98feaea1b98784aa00803a), [`e4b6dab`](https://github.com/mastra-ai/mastra/commit/e4b6dab171c5960e340b3ea3ea6da8d64d2b8672), [`946a6ee`](https://github.com/mastra-ai/mastra/commit/946a6eec7c57b905ad355e1aebf0943e47f6b216), [`5719fa8`](https://github.com/mastra-ai/mastra/commit/5719fa8880e86e8affe698ec4b3807c7e0e0a06f), [`83cda45`](https://github.com/mastra-ai/mastra/commit/83cda4523e588558466892bff8f80f631a36945a), [`11804ad`](https://github.com/mastra-ai/mastra/commit/11804adf1d6be46ebe216be40a43b39bb8b397d7), [`aa95f95`](https://github.com/mastra-ai/mastra/commit/aa95f958b186ae5c9f4219c88e268f5565c277a2), [`90f7894`](https://github.com/mastra-ai/mastra/commit/90f7894568dc9481f40a4d29672234fae23090bb), [`f5501ae`](https://github.com/mastra-ai/mastra/commit/f5501aedb0a11106c7db7e480d6eaf3971b7bda8), [`44573af`](https://github.com/mastra-ai/mastra/commit/44573afad0a4bc86f627d6cbc0207961cdcb3bc3), [`00e3861`](https://github.com/mastra-ai/mastra/commit/00e3861863fbfee78faeb1ebbdc7c0223aae13ff), [`8109aee`](https://github.com/mastra-ai/mastra/commit/8109aeeab758e16cd4255a6c36f044b70eefc6a6), [`7bfbc52`](https://github.com/mastra-ai/mastra/commit/7bfbc52a8604feb0fff2c0a082c13c0c2a3df1a2), [`1445994`](https://github.com/mastra-ai/mastra/commit/1445994aee19c9334a6a101cf7bd80ca7ed4d186), [`61f44a2`](https://github.com/mastra-ai/mastra/commit/61f44a26861c89e364f367ff40825bdb7f19df55), [`37145d2`](https://github.com/mastra-ai/mastra/commit/37145d25f99dc31f1a9105576e5452609843ce32), [`fdad759`](https://github.com/mastra-ai/mastra/commit/fdad75939ff008b27625f5ec0ce9c6915d99d9ec), [`e4569c5`](https://github.com/mastra-ai/mastra/commit/e4569c589e00c4061a686c9eb85afe1b7050b0a8), [`7309a85`](https://github.com/mastra-ai/mastra/commit/7309a85427281a8be23f4fb80ca52e18eaffd596), [`faade96`](https://github.com/mastra-ai/mastra/commit/faade96fafdd2421227809b264c1f66e6cff56e7), [`99424f6`](https://github.com/mastra-ai/mastra/commit/99424f6862ffb679c4ec6765501486034754a4c2), [`44eb452`](https://github.com/mastra-ai/mastra/commit/44eb4529b10603c279688318bebf3048543a1d61), [`b54390a`](https://github.com/mastra-ai/mastra/commit/b54390a3703f3405f262b9dcfa5a5a6076b1bcc0), [`6c40593`](https://github.com/mastra-ai/mastra/commit/6c40593d6d2b1b68b0c45d1a3a4c6ac5ecac3937), [`8c1135d`](https://github.com/mastra-ai/mastra/commit/8c1135dfb91b057283eae7ee11f9ec28753cc64f), [`dd39e54`](https://github.com/mastra-ai/mastra/commit/dd39e54ea34532c995b33bee6e0e808bf41a7341), [`b6fad9a`](https://github.com/mastra-ai/mastra/commit/b6fad9a602182b1cc0df47cd8c55004fa829ad61), [`4129c07`](https://github.com/mastra-ai/mastra/commit/4129c073349b5a66643fd8136ebfe9d7097cf793), [`5b930ab`](https://github.com/mastra-ai/mastra/commit/5b930aba1834d9898e8460a49d15106f31ac7c8d), [`4be93d0`](https://github.com/mastra-ai/mastra/commit/4be93d09d68e20aaf0ea3f210749422719618b5f), [`047635c`](https://github.com/mastra-ai/mastra/commit/047635ccd7861d726c62d135560c0022a5490aec), [`8c90ff4`](https://github.com/mastra-ai/mastra/commit/8c90ff4d3414e7f2a2d216ea91274644f7b29133), [`ed232d1`](https://github.com/mastra-ai/mastra/commit/ed232d1583f403925dc5ae45f7bee948cf2a182b), [`3891795`](https://github.com/mastra-ai/mastra/commit/38917953518eb4154a984ee36e6ededdcfe80f72), [`4f955b2`](https://github.com/mastra-ai/mastra/commit/4f955b20c7f66ed282ee1fd8709696fa64c4f19d), [`55a4c90`](https://github.com/mastra-ai/mastra/commit/55a4c9044ac7454349b9f6aeba0bbab5ee65d10f)]:
  - @mastra/core@1.3.0
  - @mastra/deployer@1.3.0

## 1.3.0-alpha.3

## 1.3.0-alpha.2

### Patch Changes

- Updated dependencies [[`b31c922`](https://github.com/mastra-ai/mastra/commit/b31c922215b513791d98feaea1b98784aa00803a)]:
  - @mastra/core@1.3.0-alpha.2
  - @mastra/deployer@1.3.0-alpha.2

## 1.3.0-alpha.1

### Minor Changes

- Added support for request context presets in Mastra Studio. You can now define a JSON file with named requestContext presets and pass it via the `--request-context-presets` CLI flag to both `mastra dev` and `mastra studio` commands. A dropdown selector appears in the Studio Playground, allowing you to quickly switch between preset configurations. ([#12501](https://github.com/mastra-ai/mastra/pull/12501))

  **Usage:**

  ```bash
  mastra dev --request-context-presets ./presets.json
  mastra studio --request-context-presets ./presets.json
  ```

  **Presets file format:**

  ```json
  {
    "development": { "userId": "dev-user", "env": "development" },
    "production": { "userId": "prod-user", "env": "production" }
  }
  ```

  When presets are loaded, a dropdown appears above the JSON editor on the Request Context page. Selecting a preset populates the editor, and manually editing the JSON automatically switches back to "Custom".

- Update peer dependencies to match core package version bump (1.1.0) ([#12508](https://github.com/mastra-ai/mastra/pull/12508))

### Patch Changes

- Improved AGENTS.md generated by create-mastra to emphasize loading the Mastra skill before working with Mastra code. When skills are configured, the file now includes a CRITICAL section at the top and detailed loading instructions to ensure agents use current APIs instead of outdated training data. ([#12824](https://github.com/mastra-ai/mastra/pull/12824))

- Supporting work to enable workflow step metadata ([#12508](https://github.com/mastra-ai/mastra/pull/12508))

- Added `--custom-args` flag to `mastra start`, matching the existing support in `mastra dev`. This lets you pass Node.js flags like `--require=newrelic` to the production server process. ([#12842](https://github.com/mastra-ai/mastra/pull/12842))

- Add hints to the `create mastra` CLI on how to use the multiselect prompt. Also remove Codex and OpenCode from initial selection of skills since they support `.agents` now. ([#12717](https://github.com/mastra-ai/mastra/pull/12717))

- Updated dependencies [[`717ffab`](https://github.com/mastra-ai/mastra/commit/717ffab42cfd58ff723b5c19ada4939997773004), [`e4b6dab`](https://github.com/mastra-ai/mastra/commit/e4b6dab171c5960e340b3ea3ea6da8d64d2b8672), [`5719fa8`](https://github.com/mastra-ai/mastra/commit/5719fa8880e86e8affe698ec4b3807c7e0e0a06f), [`83cda45`](https://github.com/mastra-ai/mastra/commit/83cda4523e588558466892bff8f80f631a36945a), [`11804ad`](https://github.com/mastra-ai/mastra/commit/11804adf1d6be46ebe216be40a43b39bb8b397d7), [`aa95f95`](https://github.com/mastra-ai/mastra/commit/aa95f958b186ae5c9f4219c88e268f5565c277a2), [`f5501ae`](https://github.com/mastra-ai/mastra/commit/f5501aedb0a11106c7db7e480d6eaf3971b7bda8), [`44573af`](https://github.com/mastra-ai/mastra/commit/44573afad0a4bc86f627d6cbc0207961cdcb3bc3), [`00e3861`](https://github.com/mastra-ai/mastra/commit/00e3861863fbfee78faeb1ebbdc7c0223aae13ff), [`7bfbc52`](https://github.com/mastra-ai/mastra/commit/7bfbc52a8604feb0fff2c0a082c13c0c2a3df1a2), [`1445994`](https://github.com/mastra-ai/mastra/commit/1445994aee19c9334a6a101cf7bd80ca7ed4d186), [`61f44a2`](https://github.com/mastra-ai/mastra/commit/61f44a26861c89e364f367ff40825bdb7f19df55), [`37145d2`](https://github.com/mastra-ai/mastra/commit/37145d25f99dc31f1a9105576e5452609843ce32), [`fdad759`](https://github.com/mastra-ai/mastra/commit/fdad75939ff008b27625f5ec0ce9c6915d99d9ec), [`e4569c5`](https://github.com/mastra-ai/mastra/commit/e4569c589e00c4061a686c9eb85afe1b7050b0a8), [`7309a85`](https://github.com/mastra-ai/mastra/commit/7309a85427281a8be23f4fb80ca52e18eaffd596), [`faade96`](https://github.com/mastra-ai/mastra/commit/faade96fafdd2421227809b264c1f66e6cff56e7), [`99424f6`](https://github.com/mastra-ai/mastra/commit/99424f6862ffb679c4ec6765501486034754a4c2), [`44eb452`](https://github.com/mastra-ai/mastra/commit/44eb4529b10603c279688318bebf3048543a1d61), [`b54390a`](https://github.com/mastra-ai/mastra/commit/b54390a3703f3405f262b9dcfa5a5a6076b1bcc0), [`6c40593`](https://github.com/mastra-ai/mastra/commit/6c40593d6d2b1b68b0c45d1a3a4c6ac5ecac3937), [`8c1135d`](https://github.com/mastra-ai/mastra/commit/8c1135dfb91b057283eae7ee11f9ec28753cc64f), [`dd39e54`](https://github.com/mastra-ai/mastra/commit/dd39e54ea34532c995b33bee6e0e808bf41a7341), [`b6fad9a`](https://github.com/mastra-ai/mastra/commit/b6fad9a602182b1cc0df47cd8c55004fa829ad61), [`4129c07`](https://github.com/mastra-ai/mastra/commit/4129c073349b5a66643fd8136ebfe9d7097cf793), [`5b930ab`](https://github.com/mastra-ai/mastra/commit/5b930aba1834d9898e8460a49d15106f31ac7c8d), [`4be93d0`](https://github.com/mastra-ai/mastra/commit/4be93d09d68e20aaf0ea3f210749422719618b5f), [`047635c`](https://github.com/mastra-ai/mastra/commit/047635ccd7861d726c62d135560c0022a5490aec), [`8c90ff4`](https://github.com/mastra-ai/mastra/commit/8c90ff4d3414e7f2a2d216ea91274644f7b29133), [`ed232d1`](https://github.com/mastra-ai/mastra/commit/ed232d1583f403925dc5ae45f7bee948cf2a182b), [`3891795`](https://github.com/mastra-ai/mastra/commit/38917953518eb4154a984ee36e6ededdcfe80f72), [`4f955b2`](https://github.com/mastra-ai/mastra/commit/4f955b20c7f66ed282ee1fd8709696fa64c4f19d), [`55a4c90`](https://github.com/mastra-ai/mastra/commit/55a4c9044ac7454349b9f6aeba0bbab5ee65d10f)]:
  - @mastra/core@1.3.0-alpha.1
  - @mastra/deployer@1.3.0-alpha.1

## 1.2.1-alpha.0

### Patch Changes

- Updated dependencies [[`946a6ee`](https://github.com/mastra-ai/mastra/commit/946a6eec7c57b905ad355e1aebf0943e47f6b216), [`90f7894`](https://github.com/mastra-ai/mastra/commit/90f7894568dc9481f40a4d29672234fae23090bb), [`8109aee`](https://github.com/mastra-ai/mastra/commit/8109aeeab758e16cd4255a6c36f044b70eefc6a6)]:
  - @mastra/deployer@1.2.1-alpha.0
  - @mastra/core@1.2.1-alpha.0

## 1.2.0

### Minor Changes

- **New feature:** You can install the Mastra skill during the `create-mastra` wizard. ([#12582](https://github.com/mastra-ai/mastra/pull/12582))

  The wizard now asks you to install the official Mastra skill. Choose your favorite agent and your newly created project is set up.
  For non-interactive setup, use the `--skills` flag that accepts comma-separated agent names (e.g. `--skills claude-code`).

- Pre-select Claude Code, Codex, OpenCode, and Cursor as default agents when users choose to install Mastra skills during project creation. Codex has been promoted to the popular agents list for better visibility. ([#12626](https://github.com/mastra-ai/mastra/pull/12626))

### Patch Changes

- Fixed peer dependency checker fix command to suggest the correct package to upgrade: ([#12529](https://github.com/mastra-ai/mastra/pull/12529))
  - If peer dep is too old (below range) → suggests upgrading the peer dep (e.g., `@mastra/core`)
  - If peer dep is too new (above range) → suggests upgrading the package requiring it (e.g., `@mastra/libsql`)

- Add `AGENTS.md` file (and optionally `CLAUDE.md`) during `create mastra` creation ([#12658](https://github.com/mastra-ai/mastra/pull/12658))

- Updated dependencies [[`e6fc281`](https://github.com/mastra-ai/mastra/commit/e6fc281896a3584e9e06465b356a44fe7faade65), [`97be6c8`](https://github.com/mastra-ai/mastra/commit/97be6c8963130fca8a664fcf99d7b3a38e463595), [`2770921`](https://github.com/mastra-ai/mastra/commit/2770921eec4d55a36b278d15c3a83f694e462ee5), [`b1695db`](https://github.com/mastra-ai/mastra/commit/b1695db2d7be0c329d499619c7881899649188d0), [`5fe1fe0`](https://github.com/mastra-ai/mastra/commit/5fe1fe0109faf2c87db34b725d8a4571a594f80e), [`4133d48`](https://github.com/mastra-ai/mastra/commit/4133d48eaa354cdb45920dc6265732ffbc96788d), [`5dd01cc`](https://github.com/mastra-ai/mastra/commit/5dd01cce68d61874aa3ecbd91ee17884cfd5aca2), [`13e0a2a`](https://github.com/mastra-ai/mastra/commit/13e0a2a2bcec01ff4d701274b3727d5e907a6a01), [`f6673b8`](https://github.com/mastra-ai/mastra/commit/f6673b893b65b7d273ad25ead42e990704cc1e17), [`cd6be8a`](https://github.com/mastra-ai/mastra/commit/cd6be8ad32741cd41cabf508355bb31b71e8a5bd), [`9eb4e8e`](https://github.com/mastra-ai/mastra/commit/9eb4e8e39efbdcfff7a40ff2ce07ce2714c65fa8), [`c987384`](https://github.com/mastra-ai/mastra/commit/c987384d6c8ca844a9701d7778f09f5a88da7f9f), [`cb8cc12`](https://github.com/mastra-ai/mastra/commit/cb8cc12bfadd526aa95a01125076f1da44e4afa7), [`aa37c84`](https://github.com/mastra-ai/mastra/commit/aa37c84d29b7db68c72517337932ef486c316275), [`62f5d50`](https://github.com/mastra-ai/mastra/commit/62f5d5043debbba497dacb7ab008fe86b38b8de3), [`47eba72`](https://github.com/mastra-ai/mastra/commit/47eba72f0397d0d14fbe324b97940c3d55e5a525)]:
  - @mastra/core@1.2.0
  - @mastra/deployer@1.2.0

## 1.2.0-alpha.1

### Minor Changes

- Pre-select Claude Code, Codex, OpenCode, and Cursor as default agents when users choose to install Mastra skills during project creation. Codex has been promoted to the popular agents list for better visibility. ([#12626](https://github.com/mastra-ai/mastra/pull/12626))

### Patch Changes

- Add `AGENTS.md` file (and optionally `CLAUDE.md`) during `create mastra` creation ([#12658](https://github.com/mastra-ai/mastra/pull/12658))

- Updated dependencies [[`2770921`](https://github.com/mastra-ai/mastra/commit/2770921eec4d55a36b278d15c3a83f694e462ee5), [`b1695db`](https://github.com/mastra-ai/mastra/commit/b1695db2d7be0c329d499619c7881899649188d0), [`4133d48`](https://github.com/mastra-ai/mastra/commit/4133d48eaa354cdb45920dc6265732ffbc96788d), [`5dd01cc`](https://github.com/mastra-ai/mastra/commit/5dd01cce68d61874aa3ecbd91ee17884cfd5aca2), [`13e0a2a`](https://github.com/mastra-ai/mastra/commit/13e0a2a2bcec01ff4d701274b3727d5e907a6a01), [`c987384`](https://github.com/mastra-ai/mastra/commit/c987384d6c8ca844a9701d7778f09f5a88da7f9f), [`cb8cc12`](https://github.com/mastra-ai/mastra/commit/cb8cc12bfadd526aa95a01125076f1da44e4afa7), [`62f5d50`](https://github.com/mastra-ai/mastra/commit/62f5d5043debbba497dacb7ab008fe86b38b8de3)]:
  - @mastra/core@1.2.0-alpha.1
  - @mastra/deployer@1.2.0-alpha.1

## 1.2.0-alpha.0

### Minor Changes

- **New feature:** You can install the Mastra skill during the `create-mastra` wizard. ([#12582](https://github.com/mastra-ai/mastra/pull/12582))

  The wizard now asks you to install the official Mastra skill. Choose your favorite agent and your newly created project is set up.
  For non-interactive setup, use the `--skills` flag that accepts comma-separated agent names (e.g. `--skills claude-code`).

### Patch Changes

- Fixed peer dependency checker fix command to suggest the correct package to upgrade: ([#12529](https://github.com/mastra-ai/mastra/pull/12529))
  - If peer dep is too old (below range) → suggests upgrading the peer dep (e.g., `@mastra/core`)
  - If peer dep is too new (above range) → suggests upgrading the package requiring it (e.g., `@mastra/libsql`)
- Updated dependencies [[`e6fc281`](https://github.com/mastra-ai/mastra/commit/e6fc281896a3584e9e06465b356a44fe7faade65), [`97be6c8`](https://github.com/mastra-ai/mastra/commit/97be6c8963130fca8a664fcf99d7b3a38e463595), [`5fe1fe0`](https://github.com/mastra-ai/mastra/commit/5fe1fe0109faf2c87db34b725d8a4571a594f80e), [`f6673b8`](https://github.com/mastra-ai/mastra/commit/f6673b893b65b7d273ad25ead42e990704cc1e17), [`cd6be8a`](https://github.com/mastra-ai/mastra/commit/cd6be8ad32741cd41cabf508355bb31b71e8a5bd), [`9eb4e8e`](https://github.com/mastra-ai/mastra/commit/9eb4e8e39efbdcfff7a40ff2ce07ce2714c65fa8), [`aa37c84`](https://github.com/mastra-ai/mastra/commit/aa37c84d29b7db68c72517337932ef486c316275), [`47eba72`](https://github.com/mastra-ai/mastra/commit/47eba72f0397d0d14fbe324b97940c3d55e5a525)]:
  - @mastra/core@1.2.0-alpha.0
  - @mastra/deployer@1.2.0-alpha.0

## 1.1.0

### Minor Changes

- Added `--server-api-prefix` option to `mastra studio` command for connecting to servers with custom API route prefixes. ([#12295](https://github.com/mastra-ai/mastra/pull/12295))

  ```bash
  # Connect to server using custom prefix
  mastra studio --server-port 3000 --server-api-prefix /mastra
  ```

### Patch Changes

- Fixed Studio CLI placeholder replacement so generated URLs are valid. ([#12108](https://github.com/mastra-ai/mastra/pull/12108))

- Fixed peer dependency checker to correctly validate prerelease versions (e.g., 1.1.0-alpha.1 now satisfies >=1.0.0-0 <2.0.0-0) ([#12495](https://github.com/mastra-ai/mastra/pull/12495))

- Added peer dependency version validation when running `mastra dev` and `mastra build`. The CLI now checks if installed @mastra/\* packages satisfy each other's peer dependency requirements and displays a warning with upgrade instructions when mismatches are detected. ([#12469](https://github.com/mastra-ai/mastra/pull/12469))

- Improved peer dependency version mismatch warnings in the CLI: ([#12479](https://github.com/mastra-ai/mastra/pull/12479))
  - When the dev server crashes with an error, a hint is now shown suggesting that updating mismatched packages may fix the issue
  - The update command now uses the correct package manager (pnpm/npm/yarn) detected from lockfiles
  - The update command uses `add @package@latest` instead of `update` to ensure major version updates are applied
  - Added `MASTRA_SKIP_PEERDEP_CHECK=1` environment variable to skip the peer dependency check

- fix workflow run input caching bug in studio UI ([#11784](https://github.com/mastra-ai/mastra/pull/11784))

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

- Fixed Studio scorers page crash when navigating directly to a scorer URL or reloading the page. The page would crash with 'Cannot read properties of undefined' due to a race condition between scorer and agents data loading. ([#12126](https://github.com/mastra-ai/mastra/pull/12126))

- Updated dependencies [[`90fc0e5`](https://github.com/mastra-ai/mastra/commit/90fc0e5717cb280c2d4acf4f0410b510bb4c0a72), [`906a097`](https://github.com/mastra-ai/mastra/commit/906a0973027f496ebb6a8031721a9d2b6c0802ea), [`c818902`](https://github.com/mastra-ai/mastra/commit/c81890204437500e0c3cbd8d505d56177e850a1f), [`1cf5d2e`](https://github.com/mastra-ai/mastra/commit/1cf5d2ea1b085be23e34fb506c80c80a4e6d9c2b), [`b99ceac`](https://github.com/mastra-ai/mastra/commit/b99ceace2c830dbdef47c8692d56a91954aefea2), [`deea43e`](https://github.com/mastra-ai/mastra/commit/deea43eb1366d03a864c5e597d16a48592b9893f), [`833ae96`](https://github.com/mastra-ai/mastra/commit/833ae96c3e34370e58a1e979571c41f39a720592), [`943772b`](https://github.com/mastra-ai/mastra/commit/943772b4378f625f0f4e19ea2b7c392bd8e71786), [`b5c711b`](https://github.com/mastra-ai/mastra/commit/b5c711b281dd1fb81a399a766bc9f86c55efc13e), [`3efbe5a`](https://github.com/mastra-ai/mastra/commit/3efbe5ae20864c4f3143457f4f3ee7dc2fa5ca76), [`9517e02`](https://github.com/mastra-ai/mastra/commit/9517e023192d1ad862679a4edd6b66396c48bdeb), [`1e49e7a`](https://github.com/mastra-ai/mastra/commit/1e49e7ab5f173582154cb26b29d424de67d09aef), [`751eaab`](https://github.com/mastra-ai/mastra/commit/751eaab4e0d3820a94e4c3d39a2ff2663ded3d91), [`b11b8e4`](https://github.com/mastra-ai/mastra/commit/b11b8e4c34b5595fffb2b6cae004e83262e61a2e), [`69d8156`](https://github.com/mastra-ai/mastra/commit/69d81568bcf062557c24471ce26812446bec465d), [`fcc4157`](https://github.com/mastra-ai/mastra/commit/fcc41572830b5cf245058b2a424f46b33e7b25a5), [`60d9d89`](https://github.com/mastra-ai/mastra/commit/60d9d899e44b35bc43f1bcd967a74e0ce010b1af), [`5c544c8`](https://github.com/mastra-ai/mastra/commit/5c544c8d12b08ab40d64d8f37b3c4215bee95b87), [`771ad96`](https://github.com/mastra-ai/mastra/commit/771ad962441996b5c43549391a3e6a02c6ddedc2), [`2b0936b`](https://github.com/mastra-ai/mastra/commit/2b0936b0c9a43eeed9bef63e614d7e02ee803f7e), [`3b04f30`](https://github.com/mastra-ai/mastra/commit/3b04f3010604f3cdfc8a0674731700ad66471cee), [`97e26de`](https://github.com/mastra-ai/mastra/commit/97e26deaebd9836647a67b96423281d66421ca07), [`ac9ec66`](https://github.com/mastra-ai/mastra/commit/ac9ec6672779b2e6d4344e415481d1a6a7d4911a), [`10523f4`](https://github.com/mastra-ai/mastra/commit/10523f4882d9b874b40ce6e3715f66dbcd4947d2), [`cb72d20`](https://github.com/mastra-ai/mastra/commit/cb72d2069d7339bda8a0e76d4f35615debb07b84), [`42856b1`](https://github.com/mastra-ai/mastra/commit/42856b1c8aeea6371c9ee77ae2f5f5fe34400933), [`66f33ff`](https://github.com/mastra-ai/mastra/commit/66f33ff68620018513e499c394411d1d39b3aa5c), [`ab3c190`](https://github.com/mastra-ai/mastra/commit/ab3c1901980a99910ca9b96a7090c22e24060113), [`d4f06c8`](https://github.com/mastra-ai/mastra/commit/d4f06c85ffa5bb0da38fb82ebf3b040cc6b4ec4e), [`7e00234`](https://github.com/mastra-ai/mastra/commit/7e002343589efc095f854bde70c72538a4bf8868), [`0350626`](https://github.com/mastra-ai/mastra/commit/03506267ec41b67add80d994c0c0fcce93bbc75f), [`bc9fa00`](https://github.com/mastra-ai/mastra/commit/bc9fa00859c5c4a796d53a0a5cae46ab4a3072e4), [`f46a478`](https://github.com/mastra-ai/mastra/commit/f46a4782f595949c696569e891f81c8d26338508), [`90fc0e5`](https://github.com/mastra-ai/mastra/commit/90fc0e5717cb280c2d4acf4f0410b510bb4c0a72), [`f05a3a5`](https://github.com/mastra-ai/mastra/commit/f05a3a5cf2b9a9c2d40c09cb8c762a4b6cd5d565), [`a291da9`](https://github.com/mastra-ai/mastra/commit/a291da9363efd92dafd8775dccb4f2d0511ece7a), [`c5d71da`](https://github.com/mastra-ai/mastra/commit/c5d71da1c680ce5640b1a7f8ca0e024a4ab1cfed), [`07042f9`](https://github.com/mastra-ai/mastra/commit/07042f9f89080f38b8f72713ba1c972d5b1905b8), [`0423442`](https://github.com/mastra-ai/mastra/commit/0423442b7be2dfacba95890bea8f4a810db4d603)]:
  - @mastra/core@1.1.0
  - @mastra/deployer@1.1.0
  - @mastra/loggers@1.0.1

## 1.1.0-alpha.3

### Patch Changes

- Updated dependencies [[`9517e02`](https://github.com/mastra-ai/mastra/commit/9517e023192d1ad862679a4edd6b66396c48bdeb)]:
  - @mastra/loggers@1.0.1-alpha.0
  - @mastra/core@1.1.0-alpha.2
  - @mastra/deployer@1.1.0-alpha.2

## 1.1.0-alpha.2

### Patch Changes

- Fixed peer dependency checker to correctly validate prerelease versions (e.g., 1.1.0-alpha.1 now satisfies >=1.0.0-0 <2.0.0-0) ([#12495](https://github.com/mastra-ai/mastra/pull/12495))

## 1.1.0-alpha.1

### Patch Changes

- Updated dependencies [[`b99ceac`](https://github.com/mastra-ai/mastra/commit/b99ceace2c830dbdef47c8692d56a91954aefea2), [`deea43e`](https://github.com/mastra-ai/mastra/commit/deea43eb1366d03a864c5e597d16a48592b9893f), [`ac9ec66`](https://github.com/mastra-ai/mastra/commit/ac9ec6672779b2e6d4344e415481d1a6a7d4911a)]:
  - @mastra/core@1.1.0-alpha.1
  - @mastra/deployer@1.1.0-alpha.1

## 1.1.0-alpha.0

### Minor Changes

- Added `--server-api-prefix` option to `mastra studio` command for connecting to servers with custom API route prefixes. ([#12295](https://github.com/mastra-ai/mastra/pull/12295))

  ```bash
  # Connect to server using custom prefix
  mastra studio --server-port 3000 --server-api-prefix /mastra
  ```

### Patch Changes

- Fixed Studio CLI placeholder replacement so generated URLs are valid. ([#12108](https://github.com/mastra-ai/mastra/pull/12108))

- Added peer dependency version validation when running `mastra dev` and `mastra build`. The CLI now checks if installed @mastra/\* packages satisfy each other's peer dependency requirements and displays a warning with upgrade instructions when mismatches are detected. ([#12469](https://github.com/mastra-ai/mastra/pull/12469))

- Improved peer dependency version mismatch warnings in the CLI: ([#12479](https://github.com/mastra-ai/mastra/pull/12479))
  - When the dev server crashes with an error, a hint is now shown suggesting that updating mismatched packages may fix the issue
  - The update command now uses the correct package manager (pnpm/npm/yarn) detected from lockfiles
  - The update command uses `add @package@latest` instead of `update` to ensure major version updates are applied
  - Added `MASTRA_SKIP_PEERDEP_CHECK=1` environment variable to skip the peer dependency check

- fix workflow run input caching bug in studio UI ([#11784](https://github.com/mastra-ai/mastra/pull/11784))

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

- Fixed Studio scorers page crash when navigating directly to a scorer URL or reloading the page. The page would crash with 'Cannot read properties of undefined' due to a race condition between scorer and agents data loading. ([#12126](https://github.com/mastra-ai/mastra/pull/12126))

- Updated dependencies [[`90fc0e5`](https://github.com/mastra-ai/mastra/commit/90fc0e5717cb280c2d4acf4f0410b510bb4c0a72), [`906a097`](https://github.com/mastra-ai/mastra/commit/906a0973027f496ebb6a8031721a9d2b6c0802ea), [`c818902`](https://github.com/mastra-ai/mastra/commit/c81890204437500e0c3cbd8d505d56177e850a1f), [`1cf5d2e`](https://github.com/mastra-ai/mastra/commit/1cf5d2ea1b085be23e34fb506c80c80a4e6d9c2b), [`833ae96`](https://github.com/mastra-ai/mastra/commit/833ae96c3e34370e58a1e979571c41f39a720592), [`943772b`](https://github.com/mastra-ai/mastra/commit/943772b4378f625f0f4e19ea2b7c392bd8e71786), [`b5c711b`](https://github.com/mastra-ai/mastra/commit/b5c711b281dd1fb81a399a766bc9f86c55efc13e), [`3efbe5a`](https://github.com/mastra-ai/mastra/commit/3efbe5ae20864c4f3143457f4f3ee7dc2fa5ca76), [`1e49e7a`](https://github.com/mastra-ai/mastra/commit/1e49e7ab5f173582154cb26b29d424de67d09aef), [`751eaab`](https://github.com/mastra-ai/mastra/commit/751eaab4e0d3820a94e4c3d39a2ff2663ded3d91), [`b11b8e4`](https://github.com/mastra-ai/mastra/commit/b11b8e4c34b5595fffb2b6cae004e83262e61a2e), [`69d8156`](https://github.com/mastra-ai/mastra/commit/69d81568bcf062557c24471ce26812446bec465d), [`fcc4157`](https://github.com/mastra-ai/mastra/commit/fcc41572830b5cf245058b2a424f46b33e7b25a5), [`60d9d89`](https://github.com/mastra-ai/mastra/commit/60d9d899e44b35bc43f1bcd967a74e0ce010b1af), [`5c544c8`](https://github.com/mastra-ai/mastra/commit/5c544c8d12b08ab40d64d8f37b3c4215bee95b87), [`771ad96`](https://github.com/mastra-ai/mastra/commit/771ad962441996b5c43549391a3e6a02c6ddedc2), [`2b0936b`](https://github.com/mastra-ai/mastra/commit/2b0936b0c9a43eeed9bef63e614d7e02ee803f7e), [`3b04f30`](https://github.com/mastra-ai/mastra/commit/3b04f3010604f3cdfc8a0674731700ad66471cee), [`97e26de`](https://github.com/mastra-ai/mastra/commit/97e26deaebd9836647a67b96423281d66421ca07), [`10523f4`](https://github.com/mastra-ai/mastra/commit/10523f4882d9b874b40ce6e3715f66dbcd4947d2), [`cb72d20`](https://github.com/mastra-ai/mastra/commit/cb72d2069d7339bda8a0e76d4f35615debb07b84), [`42856b1`](https://github.com/mastra-ai/mastra/commit/42856b1c8aeea6371c9ee77ae2f5f5fe34400933), [`66f33ff`](https://github.com/mastra-ai/mastra/commit/66f33ff68620018513e499c394411d1d39b3aa5c), [`ab3c190`](https://github.com/mastra-ai/mastra/commit/ab3c1901980a99910ca9b96a7090c22e24060113), [`d4f06c8`](https://github.com/mastra-ai/mastra/commit/d4f06c85ffa5bb0da38fb82ebf3b040cc6b4ec4e), [`7e00234`](https://github.com/mastra-ai/mastra/commit/7e002343589efc095f854bde70c72538a4bf8868), [`0350626`](https://github.com/mastra-ai/mastra/commit/03506267ec41b67add80d994c0c0fcce93bbc75f), [`bc9fa00`](https://github.com/mastra-ai/mastra/commit/bc9fa00859c5c4a796d53a0a5cae46ab4a3072e4), [`f46a478`](https://github.com/mastra-ai/mastra/commit/f46a4782f595949c696569e891f81c8d26338508), [`90fc0e5`](https://github.com/mastra-ai/mastra/commit/90fc0e5717cb280c2d4acf4f0410b510bb4c0a72), [`f05a3a5`](https://github.com/mastra-ai/mastra/commit/f05a3a5cf2b9a9c2d40c09cb8c762a4b6cd5d565), [`a291da9`](https://github.com/mastra-ai/mastra/commit/a291da9363efd92dafd8775dccb4f2d0511ece7a), [`c5d71da`](https://github.com/mastra-ai/mastra/commit/c5d71da1c680ce5640b1a7f8ca0e024a4ab1cfed), [`07042f9`](https://github.com/mastra-ai/mastra/commit/07042f9f89080f38b8f72713ba1c972d5b1905b8), [`0423442`](https://github.com/mastra-ai/mastra/commit/0423442b7be2dfacba95890bea8f4a810db4d603)]:
  - @mastra/core@1.1.0-alpha.0
  - @mastra/deployer@1.1.0-alpha.0

## 1.0.1

### Patch Changes

- Updated dependencies:
  - @mastra/deployer@1.0.4
  - @mastra/core@1.0.4

## 1.0.1-alpha.0

### Patch Changes

- Updated dependencies:
  - @mastra/deployer@1.0.4-alpha.0
  - @mastra/core@1.0.4-alpha.0

## 1.0.0

### Major Changes

- Moving scorers under the eval domain, api method consistency, prebuilt evals, scorers require ids. ([#9589](https://github.com/mastra-ai/mastra/pull/9589))

- Bump minimum required Node.js version to 22.13.0 ([#9706](https://github.com/mastra-ai/mastra/pull/9706))

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

- Mark as stable ([`83d5942`](https://github.com/mastra-ai/mastra/commit/83d5942669ce7bba4a6ca4fd4da697a10eb5ebdc))

- Remove legacy evals from Mastra ([#9491](https://github.com/mastra-ai/mastra/pull/9491))

### Minor Changes

- Add Antigravity IDE support to create-mastra CLI. Users can now select Antigravity during project initialization and automatically configure the global Mastra MCP server for the IDE, reducing manual setup and enabling immediate use of Mastra agents. ([#11374](https://github.com/mastra-ai/mastra/pull/11374))

- Add host:port support to --inspect and --inspect-brk flags ([#10077](https://github.com/mastra-ai/mastra/pull/10077))

  Enable optional host:port values for Docker debugging (e.g., `--inspect=0.0.0.0:9229`) while maintaining backward compatibility with boolean flags.

- Add --studio flag to bundle playground UI with mastra build ([#11327](https://github.com/mastra-ai/mastra/pull/11327))

  Enables bundling the studio/playground UI into the build output so it can be served from the deployed server.

  ```bash
  mastra build --studio
  ```

- Added CLI options to configure Mastra Studio runtime settings, allowing you to customize the server connection details, and protocol. ([#11265](https://github.com/mastra-ai/mastra/pull/11265))

  You can now override the default studio configuration using command-line arguments:

  ```bash
  mastra studio \
    --server-host api.example.com \
    --server-port 8080 \
    --server-protocol https
  ```

  These options configure the `window.MASTRA_*` environment variables that the Studio frontend uses to connect to your API server.

- Added `mastra migrate` CLI command to manually run storage migrations. This command bundles and executes the migration script against your configured storage backend, deduplicating spans and adding unique constraints. Useful when upgrading from older versions that may have duplicate (traceId, spanId) entries. ([#12073](https://github.com/mastra-ai/mastra/pull/12073))

  **Usage:**

  ```bash
  npx mastra migrate
  ```

  **Options:**
  - `-d, --dir <path>` - Path to your Mastra folder (default: `src/mastra`)
  - `-r, --root <path>` - Path to your root folder
  - `-e, --env <env>` - Custom env file to include
  - `--debug` - Enable debug logs

- Update peer dependencies to match core package version bump (1.0.0) ([#9237](https://github.com/mastra-ai/mastra/pull/9237))

- Add `README.md` file during `create-mastra` command. It contains basic project information and links to Mastra's docs. ([#11806](https://github.com/mastra-ai/mastra/pull/11806))

- Rename `playground` to `studio` internally. ([#11751](https://github.com/mastra-ai/mastra/pull/11751))
  - The CLI now copies the Studio to `dist/studio`
  - `mastra build --studio` creates a `.mastra/output/studio` folder now

  The `mastra studio` command behaves as before.

- Fix "MessagePartRuntime is not available" error when chatting with agents in Studio playground by replacing deprecated `useMessagePart` hook with `useAssistantState` ([#11039](https://github.com/mastra-ai/mastra/pull/11039))

### Patch Changes

- Remove `streamVNext`, `resumeStreamVNext`, and `observeStreamVNext` methods, call `stream`, `resumeStream` and `observeStream` directly ([#11499](https://github.com/mastra-ai/mastra/pull/11499))

  ```diff
  + const run = await workflow.createRun({ runId: '123' });
  - const stream = await run.streamVNext({ inputData: { ... } });
  + const stream = await run.stream({ inputData: { ... } });
  ```

- Improve Bun detection logic by looking for `.lockb`, too ([#11879](https://github.com/mastra-ai/mastra/pull/11879))

- Replace deprecated client.getTraces with a client.listTraces ([#11711](https://github.com/mastra-ai/mastra/pull/11711))

- Allow to run mastra studio from anywhere in the file system, and not necessarily inside a mastra project ([#11067](https://github.com/mastra-ai/mastra/pull/11067))

- Add `mastra studio` CLI command to serve the built playground as a static server ([#10283](https://github.com/mastra-ai/mastra/pull/10283))

- Fix select options overflow when list is long by adding maximum height ([#10813](https://github.com/mastra-ai/mastra/pull/10813))

- Make sure to verify that a mastra instance is running on server.port OR 4111 by default ([#11066](https://github.com/mastra-ai/mastra/pull/11066))

- Rename "Playground" to "Studio" ([#10443](https://github.com/mastra-ai/mastra/pull/10443))

- Use dynamic model for scorers in create cli ([#9188](https://github.com/mastra-ai/mastra/pull/9188))

- Update MainSidebar component to fit required changes in Cloud CTA link ([#9318](https://github.com/mastra-ai/mastra/pull/9318))

- Fix default value showing on workflow form after user submits ([#10983](https://github.com/mastra-ai/mastra/pull/10983))

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

- Make MainSidebar toggle button sticky to bottom, always visible ([#9682](https://github.com/mastra-ai/mastra/pull/9682))

- Move to @posthog/react which is the actual way to use posthog in React. It also fixes ([#10967](https://github.com/mastra-ai/mastra/pull/10967))

- Extract getDurationMs helper method to simplify command execution timing in CLI analytics. Replaces repeated process.hrtime logic with a reusable private helper method, improving code maintainability and reducing duplication. ([#11316](https://github.com/mastra-ai/mastra/pull/11316))

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

- Add human-in-the-loop (HITL) support to agent networks ([#11678](https://github.com/mastra-ai/mastra/pull/11678))
  - Add suspend/resume capabilities to agent network
  - Enable auto-resume for suspended network execution via `autoResumeSuspendedTools`

  `agent.resumeNetwork`, `agent.approveNetworkToolCall`, `agent.declineNetworkToolCall`

- Detect bun runtime and cleanup on failure ([#10242](https://github.com/mastra-ai/mastra/pull/10242))

- Update CLI start server command ([#9757](https://github.com/mastra-ai/mastra/pull/9757))

- Add support to skip dotenv/env file loading by adding MASTRA_SKIP_DOTENV ([#9455](https://github.com/mastra-ai/mastra/pull/9455))

- Add `Run` instance to client-js. `workflow.createRun` returns the `Run` instance which can be used for the different run methods. ([#11207](https://github.com/mastra-ai/mastra/pull/11207))
  With this change, run methods cannot be called directly on workflow instance anymore

  ```diff
  - const result = await workflow.stream({ runId: '123', inputData: { ... } });
  + const run = await workflow.createRun({ runId: '123' });
  + const stream = await run.stream({ inputData: { ... } });
  ```

- Add timeTravel APIs and add timeTravel feature to studio ([#10361](https://github.com/mastra-ai/mastra/pull/10361))

- Fixes issue where clicking the reset button in the model picker would fail to restore the original LanguageModelV2 (or any other types) object that was passed during agent construction. ([#9481](https://github.com/mastra-ai/mastra/pull/9481))

- Add Bun runtime detection for bundler platform selection ([#11548](https://github.com/mastra-ai/mastra/pull/11548))

  When running under Bun, the bundler now uses `neutral` esbuild platform instead of `node` to preserve Bun-specific globals (like `Bun.s3`). This fixes compatibility issues where Bun APIs were being incorrectly transformed during the build process.

- During `npm create-mastra` you can now optionally initialize a git repository in the newly created project. The setup wizard will prompt for this option. ([#9792](https://github.com/mastra-ai/mastra/pull/9792))

- update translation scorer template to use util methods to get user and assistant message ([#9761](https://github.com/mastra-ai/mastra/pull/9761))

- Add debugger-like click-through UI to workflow graph ([#11350](https://github.com/mastra-ai/mastra/pull/11350))

- dependencies updates: ([#11642](https://github.com/mastra-ai/mastra/pull/11642))
  - Updated dependency [`fs-extra@^11.3.3` ↗︎](https://www.npmjs.com/package/fs-extra/v/11.3.3) (from `^11.3.2`, in `dependencies`)

- dependencies updates: ([#9781](https://github.com/mastra-ai/mastra/pull/9781))
  - Updated dependency [`posthog-node@5.11.2` ↗︎](https://www.npmjs.com/package/posthog-node/v/5.11.2) (from `4.18.0`, in `dependencies`)

- Update internal dependencies ([#12050](https://github.com/mastra-ai/mastra/pull/12050))

- Add delete workflow run API ([#10991](https://github.com/mastra-ai/mastra/pull/10991))

  ```typescript
  await workflow.deleteWorkflowRunById(runId);
  ```

- Add initial state input to workflow form in studio ([#11560](https://github.com/mastra-ai/mastra/pull/11560))

- Now when you run npx mastra@beta init, the CLI detects it's running from the beta dist-tag and installs the correct versions. ([#10821](https://github.com/mastra-ai/mastra/pull/10821))

- Make initialState optional in studio ([#11744](https://github.com/mastra-ai/mastra/pull/11744))

- Set `externals: true` as the default for `mastra build` and cloud-deployer to reduce bundle issues with native dependencies. ([`0dbf199`](https://github.com/mastra-ai/mastra/commit/0dbf199110f22192ce5c95b1c8148d4872b4d119))

  **Note:** If you previously relied on the default bundling behavior (all dependencies bundled), you can explicitly set `externals: false` in your bundler configuration.

- Fix e2e test compatibility by passing version tags to all Mastra package installations. The `init` function now accepts an optional `versionTag` parameter that ensures all installed Mastra packages (`@mastra/evals`, `@mastra/libsql`, `@mastra/memory`, `@mastra/loggers`, `@mastra/observability`) use the same version, preventing module resolution errors when packages are updated with breaking internal changes. ([#9540](https://github.com/mastra-ai/mastra/pull/9540))

- Added Processors tab to Mastra Studio. You can now view all configured processors, see which agents use them, and test processors directly from the UI. Processor workflows automatically redirect to the workflow graph view with a simplified input mode for testing. ([#12059](https://github.com/mastra-ai/mastra/pull/12059))

- Two smaller quality of life improvements: ([#11232](https://github.com/mastra-ai/mastra/pull/11232))
  - The default `create-mastra` project no longer defines a LibSQLStore storage for the weather agent memory. It uses the root level `storage` option now (which is memory). This way no `mastra.db` files are created outside of the project
  - When running `mastra init` inside a project that already has git initialized, the prompt to initialize git is skipped

- Fix discriminatedUnion schema information lost when json schema is converted to zod ([#10500](https://github.com/mastra-ai/mastra/pull/10500))

- Use a shared `getAllToolPaths()` method from the bundler to discover tool paths. ([#9204](https://github.com/mastra-ai/mastra/pull/9204))

- Move useScorers down to trace page to trigger it once for all trace spans ([#10985](https://github.com/mastra-ai/mastra/pull/10985))

- Fix the development experience of the studio. It was not able to resolve the running instance because the index.html variables were not replaced in the vite dev standalone config ([#11085](https://github.com/mastra-ai/mastra/pull/11085))

- Internal changes to enable a custom base path for Mastra Studio ([#10441](https://github.com/mastra-ai/mastra/pull/10441))

- Update Observability Trace Spans list UI, so a user can expand/collapse span children/descendants and can filter the list by span type or name ([#10378](https://github.com/mastra-ai/mastra/pull/10378))

- Better handle errors during `mastra start` and throw them with Mastra's logger. Also add special error handling for `ERR_MODULE_NOT_FOUND` cases. ([#9127](https://github.com/mastra-ai/mastra/pull/9127))

- Fix workflow trigger form overflow ([#10986](https://github.com/mastra-ai/mastra/pull/10986))

- Add restart method to workflow run that allows restarting an active workflow run ([#9750](https://github.com/mastra-ai/mastra/pull/9750))
  Add status filter to `listWorkflowRuns`
  Add automatic restart to restart active workflow runs when server starts

- Fix scorer filtering for SpanScoring, add error and info message for user ([#10160](https://github.com/mastra-ai/mastra/pull/10160))

- Templates now don't dynamically create a branch for every provider, each template should be agnostic and just use a env var to set the models until the user wants to set it otherwise. ([#10036](https://github.com/mastra-ai/mastra/pull/10036))
  MCP docs server will install the beta version of the docs server if they create a project with the beta tag.
  Updates to the templates now will get pushed to the beta branch, when beta goes stable we will merge the beta branch into the main branch for all templates and update the github script to push to main.
  Templates have been cleaned up
  small docs updates based off of how the template migrations went

- Improved file persistence in dev mode. Files created by `mastra dev` are now saved in the public directory, so you can commit them to version control or ignore them via `.gitignore`. ([#11234](https://github.com/mastra-ai/mastra/pull/11234))

- Hide time travel on map steps in Studio ([#10631](https://github.com/mastra-ai/mastra/pull/10631))

- Fixed migration CLI failing with MIGRATION_REQUIRED error during Mastra import. Added MASTRA_DISABLE_STORAGE_INIT environment variable to skip auto-initialization of storage, allowing the migration command to import user's Mastra config without triggering the migration check. Also improved the migration prompt display to show warning messages before the confirmation dialog. ([#12100](https://github.com/mastra-ai/mastra/pull/12100))

- Fixes an error during `mastra create` with bun/yarn due to usage of `--save-dev`. Replaced with `-D` during installation. ([#9879](https://github.com/mastra-ai/mastra/pull/9879))

- Fixed tool list empty state when there are no agents so the page renders correctly. ([#10711](https://github.com/mastra-ai/mastra/pull/10711))

- Update internal dependencies, no change in behavior ([#10000](https://github.com/mastra-ai/mastra/pull/10000))

- Fix double scroll on agent chat container ([#10253](https://github.com/mastra-ai/mastra/pull/10253))

- Display network completion validation results and scorer feedback in the Playground when viewing agent network runs, letting users see pass/fail status and actionable feedback from completion scorers ([#11562](https://github.com/mastra-ai/mastra/pull/11562))

- Make sure that `mastra init` also installs the `mastra` CLI package (if not already installed) ([#9179](https://github.com/mastra-ai/mastra/pull/9179))

- Detect installed Mastra packages during dev and pass version information to the playground server via `MASTRA_PACKAGES_FILE` env var ([#11211](https://github.com/mastra-ai/mastra/pull/11211))

- Add `@mastra/observability` to starter project dependencies ([#9175](https://github.com/mastra-ai/mastra/pull/9175))

- fix isTopLevelSpan value definition on SpanScoring to properly recognize lack of span?.parentSpanId value (null or empty string) ([#11083](https://github.com/mastra-ai/mastra/pull/11083))

- Updated dependencies [[`ac0d2f4`](https://github.com/mastra-ai/mastra/commit/ac0d2f4ff8831f72c1c66c2be809706d17f65789), [`2319326`](https://github.com/mastra-ai/mastra/commit/2319326f8c64e503a09bbcf14be2dd65405445e0), [`d2d3e22`](https://github.com/mastra-ai/mastra/commit/d2d3e22a419ee243f8812a84e3453dd44365ecb0), [`08766f1`](https://github.com/mastra-ai/mastra/commit/08766f15e13ac0692fde2a8bd366c2e16e4321df), [`2319326`](https://github.com/mastra-ai/mastra/commit/2319326f8c64e503a09bbcf14be2dd65405445e0), [`b3db460`](https://github.com/mastra-ai/mastra/commit/b3db4609771139727e4cddb3af1cc82e6d431665), [`77ff370`](https://github.com/mastra-ai/mastra/commit/77ff370186ba77955620c465fd2e95360e1947ea), [`df9fdcd`](https://github.com/mastra-ai/mastra/commit/df9fdcd8403652c894cf4ac0503afea3b822588c), [`65591d2`](https://github.com/mastra-ai/mastra/commit/65591d2b7cecb83fff4ebc1d743e2f71859a2f7d), [`ac32ca9`](https://github.com/mastra-ai/mastra/commit/ac32ca968fb906f6c61fd7b4a194323bcb2f3daa), [`52e5984`](https://github.com/mastra-ai/mastra/commit/52e5984b067254e955646d09b217165b3f145292), [`72df8ae`](https://github.com/mastra-ai/mastra/commit/72df8ae595584cdd7747d5c39ffaca45e4507227), [`8aab268`](https://github.com/mastra-ai/mastra/commit/8aab268ee81ed6cde8adf3ac81a5e2de1c544a0c), [`ebae12a`](https://github.com/mastra-ai/mastra/commit/ebae12a2dd0212e75478981053b148a2c246962d), [`c8417b4`](https://github.com/mastra-ai/mastra/commit/c8417b41d9f3486854dc7842d977fbe5e2166264), [`bc72b52`](https://github.com/mastra-ai/mastra/commit/bc72b529ee4478fe89ecd85a8be47ce0127b82a0), [`39c9743`](https://github.com/mastra-ai/mastra/commit/39c97432d084294f8ba85fbf3ef28098ff21459e), [`1dbd8c7`](https://github.com/mastra-ai/mastra/commit/1dbd8c729fb6536ec52f00064d76b80253d346e9), [`c61a0a5`](https://github.com/mastra-ai/mastra/commit/c61a0a5de4904c88fd8b3718bc26d1be1c2ec6e7), [`05b8bee`](https://github.com/mastra-ai/mastra/commit/05b8bee9e50e6c2a4a2bf210eca25ee212ca24fa), [`3076c67`](https://github.com/mastra-ai/mastra/commit/3076c6778b18988ae7d5c4c5c466366974b2d63f), [`38c98bc`](https://github.com/mastra-ai/mastra/commit/38c98bca79aa028d6ac324073779483ace4d665b), [`3d93a15`](https://github.com/mastra-ai/mastra/commit/3d93a15796b158c617461c8b98bede476ebb43e2), [`9198899`](https://github.com/mastra-ai/mastra/commit/91988995c427b185c33714b7f3be955367911324), [`403c643`](https://github.com/mastra-ai/mastra/commit/403c643ea02862f3177d4b92e85b09f83aed3eb3), [`ed3e3dd`](https://github.com/mastra-ai/mastra/commit/ed3e3ddec69d564fe2b125e083437f76331f1283), [`c59e13c`](https://github.com/mastra-ai/mastra/commit/c59e13c7688284bd96b2baee3e314335003548de), [`c042bd0`](https://github.com/mastra-ai/mastra/commit/c042bd0b743e0e86199d0cb83344ca7690e34a9c), [`f743dbb`](https://github.com/mastra-ai/mastra/commit/f743dbb8b40d1627b5c10c0e6fc154f4ebb6e394), [`21a15de`](https://github.com/mastra-ai/mastra/commit/21a15de369fe82aac26bb642ed7be73505475e8b), [`e54953e`](https://github.com/mastra-ai/mastra/commit/e54953ed8ce1b28c0d62a19950163039af7834b4), [`3852192`](https://github.com/mastra-ai/mastra/commit/3852192c81b2a4f1f883f17d80ce50e0c60dba55), [`289f85c`](https://github.com/mastra-ai/mastra/commit/289f85c48d4d4c5f71672967715e17b512c40f4d), [`ae8baf7`](https://github.com/mastra-ai/mastra/commit/ae8baf7d8adcb0ff9dac11880400452bc49b33ff), [`fec5129`](https://github.com/mastra-ai/mastra/commit/fec5129de7fc64423ea03661a56cef31dc747a0d), [`940a2b2`](https://github.com/mastra-ai/mastra/commit/940a2b27480626ed7e74f55806dcd2181c1dd0c2), [`1a0d3fc`](https://github.com/mastra-ai/mastra/commit/1a0d3fc811482c9c376cdf79ee615c23bae9b2d6), [`85d7ee1`](https://github.com/mastra-ai/mastra/commit/85d7ee18ff4e14d625a8a30ec6656bb49804989b), [`c6c1092`](https://github.com/mastra-ai/mastra/commit/c6c1092f8fbf76109303f69e000e96fd1960c4ce), [`5540775`](https://github.com/mastra-ai/mastra/commit/5540775f68685e19ddb6972ad73297f117656f59), [`0491e7c`](https://github.com/mastra-ai/mastra/commit/0491e7c9b714cb0ba22187ee062147ec2dd7c712), [`f6f4903`](https://github.com/mastra-ai/mastra/commit/f6f4903397314f73362061dc5a3e8e7c61ea34aa), [`d5ed981`](https://github.com/mastra-ai/mastra/commit/d5ed981c8701c1b8a27a5f35a9a2f7d9244e695f), [`85a628b`](https://github.com/mastra-ai/mastra/commit/85a628b1224a8f64cd82ea7f033774bf22df7a7e), [`0e8ed46`](https://github.com/mastra-ai/mastra/commit/0e8ed467c54d6901a6a365f270ec15d6faadb36c), [`692d4ee`](https://github.com/mastra-ai/mastra/commit/692d4ee72105ec59c3cb64431d10a9ea9dbbfbaa), [`33a4d2e`](https://github.com/mastra-ai/mastra/commit/33a4d2e4ed8af51f69256232f00c34d6b6b51d48), [`9650cce`](https://github.com/mastra-ai/mastra/commit/9650cce52a1d917ff9114653398e2a0f5c3ba808), [`6c049d9`](https://github.com/mastra-ai/mastra/commit/6c049d94063fdcbd5b81c4912a2bf82a92c9cc0b), [`910db9e`](https://github.com/mastra-ai/mastra/commit/910db9e0312888495eb5617b567f247d03303814), [`2f897df`](https://github.com/mastra-ai/mastra/commit/2f897df208508f46f51b7625e5dd20c37f93e0e3), [`d3e89dd`](https://github.com/mastra-ai/mastra/commit/d3e89dd4fc31ae2804c4c7bd3e98113d069cf780), [`d629361`](https://github.com/mastra-ai/mastra/commit/d629361a60f6565b5bfb11976fdaf7308af858e2), [`4f94ed8`](https://github.com/mastra-ai/mastra/commit/4f94ed8177abfde3ec536e3574883e075423350c), [`feb7ee4`](https://github.com/mastra-ai/mastra/commit/feb7ee4d09a75edb46c6669a3beaceec78811747), [`4aaa844`](https://github.com/mastra-ai/mastra/commit/4aaa844a4f19d054490f43638a990cc57bda8d2f), [`c237233`](https://github.com/mastra-ai/mastra/commit/c23723399ccedf7f5744b3f40997b79246bfbe64), [`38380b6`](https://github.com/mastra-ai/mastra/commit/38380b60fca905824bdf6b43df307a58efb1aa15), [`6833c69`](https://github.com/mastra-ai/mastra/commit/6833c69607418d257750bbcdd84638993d343539), [`90ae4bf`](https://github.com/mastra-ai/mastra/commit/90ae4bf971286398d4cb528b4678d96b461fef42), [`932d63d`](https://github.com/mastra-ai/mastra/commit/932d63dd51be9c8bf1e00e3671fe65606c6fb9cd), [`4a1a6cb`](https://github.com/mastra-ai/mastra/commit/4a1a6cb3facad54b2bb6780b00ce91d6de1edc08), [`08c31c1`](https://github.com/mastra-ai/mastra/commit/08c31c188ebccd598acaf55e888b6397d01f7eae), [`919a22b`](https://github.com/mastra-ai/mastra/commit/919a22b25876f9ed5891efe5facbe682c30ff497), [`f0f8f12`](https://github.com/mastra-ai/mastra/commit/f0f8f125c308f2d0fd36942ef652fd852df7522f), [`15f9e21`](https://github.com/mastra-ai/mastra/commit/15f9e216177201ea6e3f6d0bfb063fcc0953444f), [`3443770`](https://github.com/mastra-ai/mastra/commit/3443770662df8eb24c9df3589b2792d78cfcb811), [`69136e7`](https://github.com/mastra-ai/mastra/commit/69136e748e32f57297728a4e0f9a75988462f1a7), [`b0e2ea5`](https://github.com/mastra-ai/mastra/commit/b0e2ea5b52c40fae438b9e2f7baee6f0f89c5442), [`f0a07e0`](https://github.com/mastra-ai/mastra/commit/f0a07e0111b3307c5fabfa4094c5c2cfb734fbe6), [`4b161df`](https://github.com/mastra-ai/mastra/commit/4b161df5df43cd45bab4dab2fe79066243aa6928), [`ff94dea`](https://github.com/mastra-ai/mastra/commit/ff94dea935f4e34545c63bcb6c29804732698809), [`0d41fe2`](https://github.com/mastra-ai/mastra/commit/0d41fe245355dfc66d61a0d9c85d9400aac351ff), [`b760b73`](https://github.com/mastra-ai/mastra/commit/b760b731aca7c8a3f041f61d57a7f125ae9cb215), [`aaa40e7`](https://github.com/mastra-ai/mastra/commit/aaa40e788628b319baa8e889407d11ad626547fa), [`1521d71`](https://github.com/mastra-ai/mastra/commit/1521d716e5daedc74690c983fbd961123c56756b), [`449aed2`](https://github.com/mastra-ai/mastra/commit/449aed2ba9d507b75bf93d427646ea94f734dfd1), [`eb648a2`](https://github.com/mastra-ai/mastra/commit/eb648a2cc1728f7678768dd70cd77619b448dab9), [`695a621`](https://github.com/mastra-ai/mastra/commit/695a621528bdabeb87f83c2277cf2bb084c7f2b4), [`9e1911d`](https://github.com/mastra-ai/mastra/commit/9e1911db2b4db85e0e768c3f15e0d61e319869f6), [`ac3cc23`](https://github.com/mastra-ai/mastra/commit/ac3cc2397d1966bc0fc2736a223abc449d3c7719), [`c456e01`](https://github.com/mastra-ai/mastra/commit/c456e0149e3c176afcefdbd9bb1d2c5917723725), [`ebac155`](https://github.com/mastra-ai/mastra/commit/ebac15564a590117db7078233f927a7e28a85106), [`a86f4df`](https://github.com/mastra-ai/mastra/commit/a86f4df0407311e0d2ea49b9a541f0938810d6a9), [`dd1c38d`](https://github.com/mastra-ai/mastra/commit/dd1c38d1b75f1b695c27b40d8d9d6ed00d5e0f6f), [`5948e6a`](https://github.com/mastra-ai/mastra/commit/5948e6a5146c83666ba3f294b2be576c82a513fb), [`5b2ff46`](https://github.com/mastra-ai/mastra/commit/5b2ff4651df70c146523a7fca773f8eb0a2272f8), [`edb07e4`](https://github.com/mastra-ai/mastra/commit/edb07e49283e0c28bd094a60e03439bf6ecf0221), [`e0941c3`](https://github.com/mastra-ai/mastra/commit/e0941c3d7fc75695d5d258e7008fd5d6e650800c), [`db41688`](https://github.com/mastra-ai/mastra/commit/db4168806d007417e2e60b4f68656dca4e5f40c9), [`2b459f4`](https://github.com/mastra-ai/mastra/commit/2b459f466fd91688eeb2a44801dc23f7f8a887ab), [`798d0c7`](https://github.com/mastra-ai/mastra/commit/798d0c740232653b1d754870e6b43a55c364ffe2), [`0c0580a`](https://github.com/mastra-ai/mastra/commit/0c0580a42f697cd2a7d5973f25bfe7da9055038a), [`2ef1f3c`](https://github.com/mastra-ai/mastra/commit/2ef1f3cc1f9785998197571478821326b2a528ee), [`8940859`](https://github.com/mastra-ai/mastra/commit/89408593658199b4ad67f7b65e888f344e64a442), [`486352b`](https://github.com/mastra-ai/mastra/commit/486352b66c746602b68a95839f830de14c7fb8c0), [`f0f8f12`](https://github.com/mastra-ai/mastra/commit/f0f8f125c308f2d0fd36942ef652fd852df7522f), [`ab035c2`](https://github.com/mastra-ai/mastra/commit/ab035c2ef6d8cc7bb25f06f1a38508bd9e6f126b), [`a54a3a6`](https://github.com/mastra-ai/mastra/commit/a54a3a61d88219829de9ff6cf0d5ece163d78dc1), [`e629310`](https://github.com/mastra-ai/mastra/commit/e629310f1a73fa236d49ec7a1d1cceb6229dc7cc), [`0131105`](https://github.com/mastra-ai/mastra/commit/0131105532e83bdcbb73352fc7d0879eebf140dc), [`5ca599d`](https://github.com/mastra-ai/mastra/commit/5ca599d0bb59a1595f19f58473fcd67cc71cef58), [`09e4bae`](https://github.com/mastra-ai/mastra/commit/09e4bae18dd5357d2ae078a4a95a2af32168ab08), [`47b1c16`](https://github.com/mastra-ai/mastra/commit/47b1c16a01c7ffb6765fe1e499b49092f8b7eba3), [`5df9cce`](https://github.com/mastra-ai/mastra/commit/5df9cce1a753438413f64c11eeef8f845745c2a8), [`4c6b492`](https://github.com/mastra-ai/mastra/commit/4c6b492c4dd591c6a592520c1f6855d6e936d71f), [`80115db`](https://github.com/mastra-ai/mastra/commit/80115db81ab658404c1c3d81375e0adbc8f5e131), [`bff1145`](https://github.com/mastra-ai/mastra/commit/bff114556b3cbadad9b2768488708f8ad0e91475), [`dff01d8`](https://github.com/mastra-ai/mastra/commit/dff01d81ce1f4e4087cfac20fa868e6db138dd14), [`9d5059e`](https://github.com/mastra-ai/mastra/commit/9d5059eae810829935fb08e81a9bb7ecd5b144a7), [`ffe84d5`](https://github.com/mastra-ai/mastra/commit/ffe84d54f3b0f85167fe977efd027dba027eb998), [`5c8ca24`](https://github.com/mastra-ai/mastra/commit/5c8ca247094e0cc2cdbd7137822fb47241f86e77), [`9d819d5`](https://github.com/mastra-ai/mastra/commit/9d819d54b61481639f4008e4694791bddf187edd), [`24b76d8`](https://github.com/mastra-ai/mastra/commit/24b76d8e17656269c8ed09a0c038adb9cc2ae95a), [`b7de533`](https://github.com/mastra-ai/mastra/commit/b7de53361667eb51fefd89fcaed924f3c57cee8d), [`31d13d5`](https://github.com/mastra-ai/mastra/commit/31d13d5fdc2e2380e2e3ee3ec9fb29d2a00f265d), [`ef756c6`](https://github.com/mastra-ai/mastra/commit/ef756c65f82d16531c43f49a27290a416611e526), [`e191844`](https://github.com/mastra-ai/mastra/commit/e1918444ca3f80e82feef1dad506cd4ec6e2875f), [`243a823`](https://github.com/mastra-ai/mastra/commit/243a8239c5906f5c94e4f78b54676793f7510ae3), [`b00ccd3`](https://github.com/mastra-ai/mastra/commit/b00ccd325ebd5d9e37e34dd0a105caae67eb568f), [`2fe69cb`](https://github.com/mastra-ai/mastra/commit/2fe69cbfda1025a7cf440308eed26c77ec553e1a), [`28f5f89`](https://github.com/mastra-ai/mastra/commit/28f5f89705f2409921e3c45178796c0e0d0bbb64), [`7761c77`](https://github.com/mastra-ai/mastra/commit/7761c778b7b083cb01f7587cfa66010307204d00), [`22553f1`](https://github.com/mastra-ai/mastra/commit/22553f11c63ee5e966a9c034a349822249584691), [`4c62166`](https://github.com/mastra-ai/mastra/commit/4c621669f4a29b1f443eca3ba70b814afa286266), [`e601b27`](https://github.com/mastra-ai/mastra/commit/e601b272c70f3a5ecca610373aa6223012704892), [`d7b7b76`](https://github.com/mastra-ai/mastra/commit/d7b7b769c1a63b7a750bb0bf6fa1ebb6680eff15), [`7d56d92`](https://github.com/mastra-ai/mastra/commit/7d56d9213886e8353956d7d40df10045fd12b299), [`81dc110`](https://github.com/mastra-ai/mastra/commit/81dc11008d147cf5bdc8996ead1aa61dbdebb6fc), [`7bcbf10`](https://github.com/mastra-ai/mastra/commit/7bcbf10133516e03df964b941f9a34e9e4ab4177), [`029540c`](https://github.com/mastra-ai/mastra/commit/029540ca1e582fc2dd8d288ecd4a9b0f31a954ef), [`7237163`](https://github.com/mastra-ai/mastra/commit/72371635dbf96a87df4b073cc48fc655afbdce3d), [`6afd81d`](https://github.com/mastra-ai/mastra/commit/6afd81df67fbbf362871f632fb34d90da1ed5c0b), [`2500740`](https://github.com/mastra-ai/mastra/commit/2500740ea23da067d6e50ec71c625ab3ce275e64), [`4353600`](https://github.com/mastra-ai/mastra/commit/43536005a65988a8eede236f69122e7f5a284ba2), [`653e65a`](https://github.com/mastra-ai/mastra/commit/653e65ae1f9502c2958a32f47a5a2df11e612a92), [`873ecbb`](https://github.com/mastra-ai/mastra/commit/873ecbb517586aa17d2f1e99283755b3ebb2863f), [`6986fb0`](https://github.com/mastra-ai/mastra/commit/6986fb064f5db6ecc24aa655e1d26529087b43b3), [`3d3366f`](https://github.com/mastra-ai/mastra/commit/3d3366f31683e7137d126a3a57174a222c5801fb), [`5a4953f`](https://github.com/mastra-ai/mastra/commit/5a4953f7d25bb15ca31ed16038092a39cb3f98b3), [`4f9bbe5`](https://github.com/mastra-ai/mastra/commit/4f9bbe5968f42c86f4930b8193de3c3c17e5bd36), [`efe406a`](https://github.com/mastra-ai/mastra/commit/efe406a1353c24993280ebc2ed61dd9f65b84b26), [`eb9e522`](https://github.com/mastra-ai/mastra/commit/eb9e522ce3070a405e5b949b7bf5609ca51d7fe2), [`4da09a4`](https://github.com/mastra-ai/mastra/commit/4da09a4b95262be57c912821d6d8108868ae59db), [`fd3d338`](https://github.com/mastra-ai/mastra/commit/fd3d338a2c362174ed5b383f1f011ad9fb0302aa), [`20e6f19`](https://github.com/mastra-ai/mastra/commit/20e6f1971d51d3ff6dd7accad8aaaae826d540ed), [`053e979`](https://github.com/mastra-ai/mastra/commit/053e9793b28e970086b0507f7f3b76ea32c1e838), [`02e51fe`](https://github.com/mastra-ai/mastra/commit/02e51feddb3d4155cfbcc42624fd0d0970d032c0), [`71c8d6c`](https://github.com/mastra-ai/mastra/commit/71c8d6c161253207b2b9588bdadb7eed604f7253), [`7aedb74`](https://github.com/mastra-ai/mastra/commit/7aedb74883adf66af38e270e4068fd42e7a37036), [`3bdfa75`](https://github.com/mastra-ai/mastra/commit/3bdfa7507a91db66f176ba8221aa28dd546e464a), [`119e5c6`](https://github.com/mastra-ai/mastra/commit/119e5c65008f3e5cfca954eefc2eb85e3bf40da4), [`c6fd6fe`](https://github.com/mastra-ai/mastra/commit/c6fd6fedd09e9cf8004b03a80925f5e94826ad7e), [`8f02d80`](https://github.com/mastra-ai/mastra/commit/8f02d800777397e4b45d7f1ad041988a8b0c6630), [`2a54120`](https://github.com/mastra-ai/mastra/commit/2a541203a7ede20c7b4dca11adaed387e717d6e0), [`fdac646`](https://github.com/mastra-ai/mastra/commit/fdac646033a0930a1a4e00d13aa64c40bb7f1e02), [`6179a9b`](https://github.com/mastra-ai/mastra/commit/6179a9ba36ffac326de3cc3c43cdc8028d37c251), [`8f3fa3a`](https://github.com/mastra-ai/mastra/commit/8f3fa3a652bb77da092f913ec51ae46e3a7e27dc), [`d07b568`](https://github.com/mastra-ai/mastra/commit/d07b5687819ea8cb1dffa776d0c1765faf4aa1ae), [`e770de9`](https://github.com/mastra-ai/mastra/commit/e770de941a287a49b1964d44db5a5763d19890a6), [`e26dc9c`](https://github.com/mastra-ai/mastra/commit/e26dc9c3ccfec54ae3dc3e2b2589f741f9ae60a6), [`55edf73`](https://github.com/mastra-ai/mastra/commit/55edf7302149d6c964fbb7908b43babfc2b52145), [`7cb14cf`](https://github.com/mastra-ai/mastra/commit/7cb14cfe0bc52095ed7f1b447996ba8c5d002e0d), [`c30400a`](https://github.com/mastra-ai/mastra/commit/c30400a49b994b1b97256fe785eb6c906fc2b232), [`486352b`](https://github.com/mastra-ai/mastra/commit/486352b66c746602b68a95839f830de14c7fb8c0), [`00f4921`](https://github.com/mastra-ai/mastra/commit/00f4921dd2c91a1e5446799599ef7116a8214a1a), [`1a46a56`](https://github.com/mastra-ai/mastra/commit/1a46a566f45a3fcbadc1cf36bf86d351f264bfa3), [`ca8041c`](https://github.com/mastra-ai/mastra/commit/ca8041cce0379fda22ed293a565bcb5b6ddca68a), [`b5dc973`](https://github.com/mastra-ai/mastra/commit/b5dc9733a5158850298dfb103acb3babdba8a318), [`7051bf3`](https://github.com/mastra-ai/mastra/commit/7051bf38b3b122a069008f861f7bfc004a6d9f6e), [`a8f1494`](https://github.com/mastra-ai/mastra/commit/a8f1494f4bbdc2770bcf327d4c7d869e332183f1), [`52e2716`](https://github.com/mastra-ai/mastra/commit/52e2716b42df6eff443de72360ae83e86ec23993), [`d7aad50`](https://github.com/mastra-ai/mastra/commit/d7aad501ce61646b76b4b511e558ac4eea9884d0), [`4f0b3c6`](https://github.com/mastra-ai/mastra/commit/4f0b3c66f196c06448487f680ccbb614d281e2f7), [`27b4040`](https://github.com/mastra-ai/mastra/commit/27b4040bfa1a95d92546f420a02a626b1419a1d6), [`c61fac3`](https://github.com/mastra-ai/mastra/commit/c61fac3add96f0dcce0208c07415279e2537eb62), [`6f14f70`](https://github.com/mastra-ai/mastra/commit/6f14f706ccaaf81b69544b6c1b75ab66a41e5317), [`69e0a87`](https://github.com/mastra-ai/mastra/commit/69e0a878896a2da9494945d86e056a5f8f05b851), [`cd29ad2`](https://github.com/mastra-ai/mastra/commit/cd29ad23a255534e8191f249593849ed29160886), [`bdf4d8c`](https://github.com/mastra-ai/mastra/commit/bdf4d8cdc656d8a2c21d81834bfa3bfa70f56c16), [`854e3da`](https://github.com/mastra-ai/mastra/commit/854e3dad5daac17a91a20986399d3a51f54bf68b), [`ce18d38`](https://github.com/mastra-ai/mastra/commit/ce18d38678c65870350d123955014a8432075fd9), [`3cf540b`](https://github.com/mastra-ai/mastra/commit/3cf540b9fbfea8f4fc8d3a2319a4e6c0b0cbfd52), [`352a5d6`](https://github.com/mastra-ai/mastra/commit/352a5d625cfe09849b21e8f52a24c9f0366759d5), [`1c6ce51`](https://github.com/mastra-ai/mastra/commit/1c6ce51f875915ab57fd36873623013699a2a65d), [`74c4f22`](https://github.com/mastra-ai/mastra/commit/74c4f22ed4c71e72598eacc346ba95cdbc00294f), [`3a76a80`](https://github.com/mastra-ai/mastra/commit/3a76a80284cb71a0faa975abb3d4b2a9631e60cd), [`898a972`](https://github.com/mastra-ai/mastra/commit/898a9727d286c2510d6b702dfd367e6aaf5c6b0f), [`0793497`](https://github.com/mastra-ai/mastra/commit/079349753620c40246ffd673e3f9d7d9820beff3), [`09e4bae`](https://github.com/mastra-ai/mastra/commit/09e4bae18dd5357d2ae078a4a95a2af32168ab08), [`026b848`](https://github.com/mastra-ai/mastra/commit/026b8483fbf5b6d977be8f7e6aac8d15c75558ac), [`2c212e7`](https://github.com/mastra-ai/mastra/commit/2c212e704c90e2db83d4109e62c03f0f6ebd2667), [`a97003a`](https://github.com/mastra-ai/mastra/commit/a97003aa1cf2f4022a41912324a1e77263b326b8), [`f9a2509`](https://github.com/mastra-ai/mastra/commit/f9a25093ea72d210a5e52cfcb3bcc8b5e02dc25c), [`66741d1`](https://github.com/mastra-ai/mastra/commit/66741d1a99c4f42cf23a16109939e8348ac6852e), [`ccc141e`](https://github.com/mastra-ai/mastra/commit/ccc141ed27da0abc3a3fc28e9e5128152e8e37f4), [`27c0009`](https://github.com/mastra-ai/mastra/commit/27c0009777a6073d7631b0eb7b481d94e165b5ca), [`01f8878`](https://github.com/mastra-ai/mastra/commit/01f88783de25e4de048c1c8aace43e26373c6ea5), [`dee388d`](https://github.com/mastra-ai/mastra/commit/dee388dde02f2e63c53385ae69252a47ab6825cc), [`610a70b`](https://github.com/mastra-ai/mastra/commit/610a70bdad282079f0c630e0d7bb284578f20151), [`5df9cce`](https://github.com/mastra-ai/mastra/commit/5df9cce1a753438413f64c11eeef8f845745c2a8), [`b7e17d3`](https://github.com/mastra-ai/mastra/commit/b7e17d3f5390bb5a71efc112204413656fcdc18d), [`4c77209`](https://github.com/mastra-ai/mastra/commit/4c77209e6c11678808b365d545845918c40045c8), [`a854ede`](https://github.com/mastra-ai/mastra/commit/a854ede62bf5ac0945a624ac48913dd69c73aabf), [`fe3b897`](https://github.com/mastra-ai/mastra/commit/fe3b897c2ccbcd2b10e81b099438c7337feddf89), [`c576fc0`](https://github.com/mastra-ai/mastra/commit/c576fc0b100b2085afded91a37c97a0ea0ec09c7), [`3defc80`](https://github.com/mastra-ai/mastra/commit/3defc80cf2b88a1b7fc1cc4ddcb91e982a614609), [`26346be`](https://github.com/mastra-ai/mastra/commit/26346beb6e637a114d1dd2eaf5127512c5af84fd), [`00123ba`](https://github.com/mastra-ai/mastra/commit/00123ba96dc9e5cd0b110420ebdba56d8f237b25), [`16153fe`](https://github.com/mastra-ai/mastra/commit/16153fe7eb13c99401f48e6ca32707c965ee28b9), [`9f4a683`](https://github.com/mastra-ai/mastra/commit/9f4a6833e88b52574665c028fd5508ad5c2f6004), [`bc94344`](https://github.com/mastra-ai/mastra/commit/bc943444a1342d8a662151b7bce1df7dae32f59c), [`f4eebb2`](https://github.com/mastra-ai/mastra/commit/f4eebb28151f8b0259c88559149c4abfa00a84de), [`4ca4306`](https://github.com/mastra-ai/mastra/commit/4ca430614daa5fa04730205a302a43bf4accfe9f), [`b874113`](https://github.com/mastra-ai/mastra/commit/b8741130ed63eeaf837e6210d351792492f6bcd1), [`cccf9c8`](https://github.com/mastra-ai/mastra/commit/cccf9c8b2d2dfc1a5e63919395b83d78c89682a0), [`5a9bafc`](https://github.com/mastra-ai/mastra/commit/5a9bafcaaa859898e954456e781a1552dc0ad4f1), [`74e504a`](https://github.com/mastra-ai/mastra/commit/74e504a3b584eafd2f198001c6a113bbec589fd3), [`29c4309`](https://github.com/mastra-ai/mastra/commit/29c4309f818b24304c041bcb4a8f19b5f13f6b62), [`16785ce`](https://github.com/mastra-ai/mastra/commit/16785ced928f6f22638f4488cf8a125d99211799), [`87f9f96`](https://github.com/mastra-ai/mastra/commit/87f9f96c772117fb868c9ea17a9eda664d41a35e), [`57d157f`](https://github.com/mastra-ai/mastra/commit/57d157f0b163a95c3e6c9eae31bdb11d1bfc64f9), [`61a5705`](https://github.com/mastra-ai/mastra/commit/61a570551278b6743e64243b3ce7d73de915ca8a), [`903f67d`](https://github.com/mastra-ai/mastra/commit/903f67d184504a273893818c02b961f5423a79ad), [`3f3fc30`](https://github.com/mastra-ai/mastra/commit/3f3fc3096f24c4a26cffeecfe73085928f72aa63), [`d827d08`](https://github.com/mastra-ai/mastra/commit/d827d0808ffe1f3553a84e975806cc989b9735dd), [`e33fdbd`](https://github.com/mastra-ai/mastra/commit/e33fdbd07b33920d81e823122331b0c0bee0bb59), [`6375f52`](https://github.com/mastra-ai/mastra/commit/6375f52c219305abef6f2026b4eaf8ac2fa5f1c0), [`4524734`](https://github.com/mastra-ai/mastra/commit/45247343e384717a7c8404296275c56201d6470f), [`7a010c5`](https://github.com/mastra-ai/mastra/commit/7a010c56b846a313a49ae42fccd3d8de2b9f292d), [`2a90c55`](https://github.com/mastra-ai/mastra/commit/2a90c55a86a9210697d5adaab5ee94584b079adc), [`2a53598`](https://github.com/mastra-ai/mastra/commit/2a53598c6d8cfeb904a7fc74e57e526d751c8fa6), [`81b6a8f`](https://github.com/mastra-ai/mastra/commit/81b6a8ff79f49a7549d15d66624ac1a0b8f5f971), [`8538a0d`](https://github.com/mastra-ai/mastra/commit/8538a0d232619bf55dad7ddc2a8b0ca77c679a87), [`d90ea65`](https://github.com/mastra-ai/mastra/commit/d90ea6536f7aa51c6545a4e9215b55858e98e16d), [`db70a48`](https://github.com/mastra-ai/mastra/commit/db70a48aeeeeb8e5f92007e8ede52c364ce15287), [`261473a`](https://github.com/mastra-ai/mastra/commit/261473ac637e633064a22076671e2e02b002214d), [`eb09742`](https://github.com/mastra-ai/mastra/commit/eb09742197f66c4c38154c3beec78313e69760b2), [`73ac522`](https://github.com/mastra-ai/mastra/commit/73ac522d5db7ba08a9bacf1f801d7990f3100a70), [`de8239b`](https://github.com/mastra-ai/mastra/commit/de8239bdcb1d8c0cfa06da21f1569912a66bbc8a), [`e4d366a`](https://github.com/mastra-ai/mastra/commit/e4d366aeb500371dd4210d6aa8361a4c21d87034), [`23c10a1`](https://github.com/mastra-ai/mastra/commit/23c10a1efdd9a693c405511ab2dc8a1236603162), [`b5e6cd7`](https://github.com/mastra-ai/mastra/commit/b5e6cd77fc8c8e64e0494c1d06cee3d84e795d1e), [`d171e55`](https://github.com/mastra-ai/mastra/commit/d171e559ead9f52ec728d424844c8f7b164c4510), [`162d768`](https://github.com/mastra-ai/mastra/commit/162d76861e18ee7b4423482169f78bf1de015612), [`9e0a85d`](https://github.com/mastra-ai/mastra/commit/9e0a85d11d02ca5918463ab5c2ec55d4eebf3769), [`f0fdc14`](https://github.com/mastra-ai/mastra/commit/f0fdc14ee233d619266b3d2bbdeea7d25cfc6d13), [`a4f010b`](https://github.com/mastra-ai/mastra/commit/a4f010b22e4355a5fdee70a1fe0f6e4a692cc29e), [`c7cd3c7`](https://github.com/mastra-ai/mastra/commit/c7cd3c7a187d7aaf79e2ca139de328bf609a14b4), [`db18bc9`](https://github.com/mastra-ai/mastra/commit/db18bc9c3825e2c1a0ad9a183cc9935f6691bfa1), [`96d35f6`](https://github.com/mastra-ai/mastra/commit/96d35f61376bc2b1bf148648a2c1985bd51bef55), [`68ec97d`](https://github.com/mastra-ai/mastra/commit/68ec97d4c07c6393fcf95c2481fc5d73da99f8c8), [`8dc7f55`](https://github.com/mastra-ai/mastra/commit/8dc7f55900395771da851dc7d78d53ae84fe34ec), [`cfabdd4`](https://github.com/mastra-ai/mastra/commit/cfabdd4aae7a726b706942d6836eeca110fb6267), [`9b37b56`](https://github.com/mastra-ai/mastra/commit/9b37b565e1f2a76c24f728945cc740c2b09be9da), [`01b20fe`](https://github.com/mastra-ai/mastra/commit/01b20fefb7c67c2b7d79417598ef4e60256d1225), [`dd4f34c`](https://github.com/mastra-ai/mastra/commit/dd4f34c78cbae24063463475b0619575c415f9b8), [`8379099`](https://github.com/mastra-ai/mastra/commit/8379099fc467af6bef54dd7f80c9bd75bf8bbddf), [`0dbf199`](https://github.com/mastra-ai/mastra/commit/0dbf199110f22192ce5c95b1c8148d4872b4d119), [`5cbe88a`](https://github.com/mastra-ai/mastra/commit/5cbe88aefbd9f933bca669fd371ea36bf939ac6d), [`41a23c3`](https://github.com/mastra-ai/mastra/commit/41a23c32f9877d71810f37e24930515df2ff7a0f), [`cc4d0a1`](https://github.com/mastra-ai/mastra/commit/cc4d0a151bb97b07ceeee2751332779403aec8dc), [`a1bd7b8`](https://github.com/mastra-ai/mastra/commit/a1bd7b8571db16b94eb01588f451a74758c96d65), [`d78b38d`](https://github.com/mastra-ai/mastra/commit/d78b38d898fce285260d3bbb4befade54331617f), [`e41f852`](https://github.com/mastra-ai/mastra/commit/e41f852a3068be9c65818d9ab2218bae06ed0237), [`a0a5b4b`](https://github.com/mastra-ai/mastra/commit/a0a5b4bbebe6c701ebbadf744873aa0d5ca01371), [`ce0a73a`](https://github.com/mastra-ai/mastra/commit/ce0a73abeaa75b10ca38f9e40a255a645d50ebfb), [`5d171ad`](https://github.com/mastra-ai/mastra/commit/5d171ad9ef340387276b77c2bb3e83e83332d729), [`c576fc0`](https://github.com/mastra-ai/mastra/commit/c576fc0b100b2085afded91a37c97a0ea0ec09c7), [`0633100`](https://github.com/mastra-ai/mastra/commit/0633100a911ad22f5256471bdf753da21c104742), [`3759cb0`](https://github.com/mastra-ai/mastra/commit/3759cb064935b5f74c65ac2f52a1145f7352899d), [`929f69c`](https://github.com/mastra-ai/mastra/commit/929f69c3436fa20dd0f0e2f7ebe8270bd82a1529), [`c710c16`](https://github.com/mastra-ai/mastra/commit/c710c1652dccfdc4111c8412bca7a6bb1d48b441), [`10c2735`](https://github.com/mastra-ai/mastra/commit/10c27355edfdad1ee2b826b897df74125eb81fb8), [`354ad0b`](https://github.com/mastra-ai/mastra/commit/354ad0b7b1b8183ac567f236a884fc7ede6d7138), [`cfae733`](https://github.com/mastra-ai/mastra/commit/cfae73394f4920635e6c919c8e95ff9a0788e2e5), [`8c0ec25`](https://github.com/mastra-ai/mastra/commit/8c0ec25646c8a7df253ed1e5ff4863a0d3f1316c), [`e3dfda7`](https://github.com/mastra-ai/mastra/commit/e3dfda7b11bf3b8c4bb55637028befb5f387fc74), [`69ea758`](https://github.com/mastra-ai/mastra/commit/69ea758358edd7117f191c2e69c8bb5fc79e7a1a), [`73b0bb3`](https://github.com/mastra-ai/mastra/commit/73b0bb394dba7c9482eb467a97ab283dbc0ef4db), [`7b406f4`](https://github.com/mastra-ai/mastra/commit/7b406f49d8fec4b1b991ea15c2eb484a554ba00d), [`651e772`](https://github.com/mastra-ai/mastra/commit/651e772eb1475fb13e126d3fcc01751297a88214), [`a02e542`](https://github.com/mastra-ai/mastra/commit/a02e542d23179bad250b044b17ff023caa61739f), [`f03ae60`](https://github.com/mastra-ai/mastra/commit/f03ae60500fe350c9d828621006cdafe1975fdd8), [`6b3ba91`](https://github.com/mastra-ai/mastra/commit/6b3ba91494cc10394df96782f349a4f7b1e152cc), [`a372c64`](https://github.com/mastra-ai/mastra/commit/a372c640ad1fd12e8f0613cebdc682fc156b4d95), [`993ad98`](https://github.com/mastra-ai/mastra/commit/993ad98d7ad3bebda9ecef5fec5c94349a0d04bc), [`676ccc7`](https://github.com/mastra-ai/mastra/commit/676ccc7fe92468d2d45d39c31a87825c89fd1ea0), [`3ff2c17`](https://github.com/mastra-ai/mastra/commit/3ff2c17a58e312fad5ea37377262c12d92ca0908), [`a0e437f`](https://github.com/mastra-ai/mastra/commit/a0e437fac561b28ee719e0302d72b2f9b4c138f0), [`d1e74a0`](https://github.com/mastra-ai/mastra/commit/d1e74a0a293866dece31022047f5dbab65a304d0), [`844ea5d`](https://github.com/mastra-ai/mastra/commit/844ea5dc0c248961e7bf73629ae7dcff503e853c), [`5627a8c`](https://github.com/mastra-ai/mastra/commit/5627a8c6dc11fe3711b3fa7a6ffd6eb34100a306), [`398fde3`](https://github.com/mastra-ai/mastra/commit/398fde3f39e707cda79372cdae8f9870e3b57c8d), [`c10398d`](https://github.com/mastra-ai/mastra/commit/c10398d5b88f1d4af556f4267ff06f1d11e89179), [`3ff45d1`](https://github.com/mastra-ai/mastra/commit/3ff45d10e0c80c5335a957ab563da72feb623520), [`dfe3f8c`](https://github.com/mastra-ai/mastra/commit/dfe3f8c7376ffe159236819e19ca522143c1f972), [`f0f8f12`](https://github.com/mastra-ai/mastra/commit/f0f8f125c308f2d0fd36942ef652fd852df7522f), [`b61b93f`](https://github.com/mastra-ai/mastra/commit/b61b93f9e058b11dd2eec169853175d31dbdd567), [`bae33d9`](https://github.com/mastra-ai/mastra/commit/bae33d91a63fbb64d1e80519e1fc1acaed1e9013), [`39e7869`](https://github.com/mastra-ai/mastra/commit/39e7869bc7d0ee391077ce291474d8a84eedccff), [`0d7618b`](https://github.com/mastra-ai/mastra/commit/0d7618bc650bf2800934b243eca5648f4aeed9c2), [`2c212e7`](https://github.com/mastra-ai/mastra/commit/2c212e704c90e2db83d4109e62c03f0f6ebd2667), [`7b763e5`](https://github.com/mastra-ai/mastra/commit/7b763e52fc3eaf699c2a99f2adf418dd46e4e9a5), [`251df45`](https://github.com/mastra-ai/mastra/commit/251df4531407dfa46d805feb40ff3fb49769f455), [`d36cfbb`](https://github.com/mastra-ai/mastra/commit/d36cfbbb6565ba5f827883cc9bb648eb14befdc1), [`f894d14`](https://github.com/mastra-ai/mastra/commit/f894d148946629af7b1f452d65a9cf864cec3765), [`8846867`](https://github.com/mastra-ai/mastra/commit/8846867ffa9a3746767618e314bebac08eb77d87), [`1924cf0`](https://github.com/mastra-ai/mastra/commit/1924cf06816e5e4d4d5333065ec0f4bb02a97799), [`c0b731f`](https://github.com/mastra-ai/mastra/commit/c0b731fb27d712dc8582e846df5c0332a6a0c5ba), [`5761926`](https://github.com/mastra-ai/mastra/commit/57619260c4a2cdd598763abbacd90de594c6bc76), [`c2b9547`](https://github.com/mastra-ai/mastra/commit/c2b9547bf435f56339f23625a743b2147ab1c7a6), [`3697853`](https://github.com/mastra-ai/mastra/commit/3697853deeb72017d90e0f38a93c1e29221aeca0), [`c900fdd`](https://github.com/mastra-ai/mastra/commit/c900fdd504c41348efdffb205cfe80d48c38fa33), [`c23200d`](https://github.com/mastra-ai/mastra/commit/c23200ddfd60830effb39329674ba4ca93be6aac), [`9312dcd`](https://github.com/mastra-ai/mastra/commit/9312dcd1c6f5b321929e7d382e763d95fdc030f5), [`b2e45ec`](https://github.com/mastra-ai/mastra/commit/b2e45eca727a8db01a81ba93f1a5219c7183c839), [`5d7000f`](https://github.com/mastra-ai/mastra/commit/5d7000f757cd65ea9dc5b05e662fd83dfd44e932), [`43ca8f2`](https://github.com/mastra-ai/mastra/commit/43ca8f2c7334851cc7b4d3d2f037d8784bfbdd5f), [`d6d49f7`](https://github.com/mastra-ai/mastra/commit/d6d49f7b8714fa19a52ff9c7cf7fb7e73751901e), [`00c2387`](https://github.com/mastra-ai/mastra/commit/00c2387f5f04a365316f851e58666ac43f8c4edf), [`a534e95`](https://github.com/mastra-ai/mastra/commit/a534e9591f83b3cc1ebff99c67edf4cda7bf81d3), [`9d0e7fe`](https://github.com/mastra-ai/mastra/commit/9d0e7feca8ed98de959f53476ee1456073673348), [`09e4bae`](https://github.com/mastra-ai/mastra/commit/09e4bae18dd5357d2ae078a4a95a2af32168ab08), [`53d927c`](https://github.com/mastra-ai/mastra/commit/53d927cc6f03bff33655b7e2b788da445a08731d), [`ad6250d`](https://github.com/mastra-ai/mastra/commit/ad6250dbdaad927e29f74a27b83f6c468b50a705), [`580b592`](https://github.com/mastra-ai/mastra/commit/580b5927afc82fe460dfdf9a38a902511b6b7e7f), [`604a79f`](https://github.com/mastra-ai/mastra/commit/604a79fecf276e26a54a3fe01bb94e65315d2e0e), [`a547452`](https://github.com/mastra-ai/mastra/commit/a547452ad96720490323a48d611a89fc6e1c7383), [`42a42cf`](https://github.com/mastra-ai/mastra/commit/42a42cf3132b9786feecbb8c13c583dce5b0e198), [`3f2faf2`](https://github.com/mastra-ai/mastra/commit/3f2faf2e2d685d6c053cc5af1bf9fedf267b2ce5), [`22f64bc`](https://github.com/mastra-ai/mastra/commit/22f64bc1d37149480b58bf2fefe35b79a1e3e7d5), [`ff4d9a6`](https://github.com/mastra-ai/mastra/commit/ff4d9a6704fc87b31a380a76ed22736fdedbba5a), [`50fd320`](https://github.com/mastra-ai/mastra/commit/50fd320003d0d93831c230ef531bef41f5ba7b3a), [`847c212`](https://github.com/mastra-ai/mastra/commit/847c212caba7df0d6f2fc756b494ac3c75c3720d), [`69821ef`](https://github.com/mastra-ai/mastra/commit/69821ef806482e2c44e2197ac0b050c3fe3a5285), [`363284b`](https://github.com/mastra-ai/mastra/commit/363284bb974e850f06f40f89a28c79d9f432d7e4), [`3a73998`](https://github.com/mastra-ai/mastra/commit/3a73998fa4ebeb7f3dc9301afe78095fc63e7999), [`6c7ffcd`](https://github.com/mastra-ai/mastra/commit/6c7ffcdf9a5b0a4435eb3f934c22c05b9e2fedb3), [`ffa553a`](https://github.com/mastra-ai/mastra/commit/ffa553a3edc1bd17d73669fba66d6b6f4ac10897), [`de97ee5`](https://github.com/mastra-ai/mastra/commit/de97ee552241268e9931319b1358826a41534e99), [`83d5942`](https://github.com/mastra-ai/mastra/commit/83d5942669ce7bba4a6ca4fd4da697a10eb5ebdc), [`58e3931`](https://github.com/mastra-ai/mastra/commit/58e3931af9baa5921688566210f00fb0c10479fa), [`ae08bf0`](https://github.com/mastra-ai/mastra/commit/ae08bf0ebc6a4e4da992b711c4a389c32ba84cf4), [`0bed332`](https://github.com/mastra-ai/mastra/commit/0bed332843f627202c6520eaf671771313cd20f3), [`887f0b4`](https://github.com/mastra-ai/mastra/commit/887f0b4746cdbd7cb7d6b17ac9f82aeb58037ea5), [`6540711`](https://github.com/mastra-ai/mastra/commit/65407118b4788400b29d5ff50e985505abee4c08), [`2562143`](https://github.com/mastra-ai/mastra/commit/256214336b4faa78646c9c1776612393790d8784), [`cd7c74a`](https://github.com/mastra-ai/mastra/commit/cd7c74ab8f7975713b03e6c4768ad66dc0aa2a57), [`b7959e6`](https://github.com/mastra-ai/mastra/commit/b7959e6e25a46b480f9ea2217c4c6c588c423791), [`bdfd094`](https://github.com/mastra-ai/mastra/commit/bdfd0943f05e001a7b7b0bf1216caf9b292e565c), [`a7ce182`](https://github.com/mastra-ai/mastra/commit/a7ce1822a8785ce45d62dd5c911af465e144f7d7), [`bda6370`](https://github.com/mastra-ai/mastra/commit/bda637009360649aaf579919e7873e33553c273e), [`d7acd8e`](https://github.com/mastra-ai/mastra/commit/d7acd8e987b5d7eff4fd98b0906c17c06a2e83d5), [`056d075`](https://github.com/mastra-ai/mastra/commit/056d075598761a47c4f6f48c0ba8f793ca915c7f), [`c7f1f7d`](https://github.com/mastra-ai/mastra/commit/c7f1f7d24f61f247f018cc2d1f33bf63212959a7), [`0bddc6d`](https://github.com/mastra-ai/mastra/commit/0bddc6d8dbd6f6008c0cba2e4960a2da75a55af1), [`bec5efd`](https://github.com/mastra-ai/mastra/commit/bec5efde96653ccae6604e68c696d1bc6c1a0bf5), [`5947fcd`](https://github.com/mastra-ai/mastra/commit/5947fcdd425531f29f9422026d466c2ee3113c93), [`4aa55b3`](https://github.com/mastra-ai/mastra/commit/4aa55b383cf06043943359ea316572fd969861a7), [`4a8cade`](https://github.com/mastra-ai/mastra/commit/4a8cade69b4616da04d78e6f76649b52d843997e), [`21735a7`](https://github.com/mastra-ai/mastra/commit/21735a7ef306963554a69a89b44f06c3bcd85141), [`735d8c1`](https://github.com/mastra-ai/mastra/commit/735d8c1c0d19fbc09e6f8b66cf41bc7655993838), [`7907fd1`](https://github.com/mastra-ai/mastra/commit/7907fd1c5059813b7b870b81ca71041dc807331b), [`1ed5716`](https://github.com/mastra-ai/mastra/commit/1ed5716830867b3774c4a1b43cc0d82935f32b96), [`acf322e`](https://github.com/mastra-ai/mastra/commit/acf322e0f1fd0189684cf529d91c694bea918a45), [`2ca67cc`](https://github.com/mastra-ai/mastra/commit/2ca67cc3bb1f6a617353fdcab197d9efebe60d6f), [`9eedf7d`](https://github.com/mastra-ai/mastra/commit/9eedf7de1d6e0022a2f4e5e9e6fe1ec468f9b43c), [`b339816`](https://github.com/mastra-ai/mastra/commit/b339816df0984d0243d944ac2655d6ba5f809cde), [`e16d553`](https://github.com/mastra-ai/mastra/commit/e16d55338403c7553531cc568125c63d53653dff), [`6f941c4`](https://github.com/mastra-ai/mastra/commit/6f941c438ca5f578619788acc7608fc2e23bd176), [`4186bdd`](https://github.com/mastra-ai/mastra/commit/4186bdd00731305726fa06adba0b076a1d50b49f), [`08bb631`](https://github.com/mastra-ai/mastra/commit/08bb631ae2b14684b2678e3549d0b399a6f0561e), [`c942802`](https://github.com/mastra-ai/mastra/commit/c942802a477a925b01859a7b8688d4355715caaa), [`4f0331a`](https://github.com/mastra-ai/mastra/commit/4f0331a79bf6eb5ee598a5086e55de4b5a0ada03), [`a0c8c1b`](https://github.com/mastra-ai/mastra/commit/a0c8c1b87d4fee252aebda73e8637fbe01d761c9), [`1d877b8`](https://github.com/mastra-ai/mastra/commit/1d877b8d7b536a251c1a7a18db7ddcf4f68d6f8b), [`cc34739`](https://github.com/mastra-ai/mastra/commit/cc34739c34b6266a91bea561119240a7acf47887), [`c218bd3`](https://github.com/mastra-ai/mastra/commit/c218bd3759e32423735b04843a09404572631014), [`9e67002`](https://github.com/mastra-ai/mastra/commit/9e67002b52c9be19936c420a489dbee9c5fd6a78), [`7aaf973`](https://github.com/mastra-ai/mastra/commit/7aaf973f83fbbe9521f1f9e7a4fd99b8de464617), [`2c4438b`](https://github.com/mastra-ai/mastra/commit/2c4438b87817ab7eed818c7990fef010475af1a3), [`35edc49`](https://github.com/mastra-ai/mastra/commit/35edc49ac0556db609189641d6341e76771b81fc), [`4d59f58`](https://github.com/mastra-ai/mastra/commit/4d59f58de2d90d6e2810a19d4518e38ddddb9038), [`ef11a61`](https://github.com/mastra-ai/mastra/commit/ef11a61920fa0ed08a5b7ceedd192875af119749), [`46fa9fe`](https://github.com/mastra-ai/mastra/commit/46fa9feae3d44c7fdcd5b5f6be6acbe341b46e56), [`2b8893c`](https://github.com/mastra-ai/mastra/commit/2b8893cb108ef9acb72ee7835cd625610d2c1a4a), [`8e5c75b`](https://github.com/mastra-ai/mastra/commit/8e5c75bdb1d08a42d45309a4c72def4b6890230f), [`e1bb9c9`](https://github.com/mastra-ai/mastra/commit/e1bb9c94b4eb68b019ae275981be3feb769b5365), [`351a11f`](https://github.com/mastra-ai/mastra/commit/351a11fcaf2ed1008977fa9b9a489fc422e51cd4), [`8a73529`](https://github.com/mastra-ai/mastra/commit/8a73529ca01187f604b1f3019d0a725ac63ae55f), [`e59e0d3`](https://github.com/mastra-ai/mastra/commit/e59e0d32afb5fcf2c9f3c00c8f81f6c21d3a63fa), [`4fba91b`](https://github.com/mastra-ai/mastra/commit/4fba91bec7c95911dc28e369437596b152b04cd0), [`9cd9d2f`](https://github.com/mastra-ai/mastra/commit/9cd9d2f7c66a1016c8fed0221eb55343d4f19a17), [`465ac05`](https://github.com/mastra-ai/mastra/commit/465ac0526a91d175542091c675181f1a96c98c46), [`fa8409b`](https://github.com/mastra-ai/mastra/commit/fa8409bc39cfd8ba6643b9db5269b90b22e2a2f7), [`8a000da`](https://github.com/mastra-ai/mastra/commit/8a000da0c09c679a2312f6b3aa05b2ca78ca7393), [`e7266a2`](https://github.com/mastra-ai/mastra/commit/e7266a278db02035c97a5e9cd9d1669a6b7a535d), [`173c535`](https://github.com/mastra-ai/mastra/commit/173c535c0645b0da404fe09f003778f0b0d4e019), [`1176e03`](https://github.com/mastra-ai/mastra/commit/1176e03a0db4b8f5b0a85afbaf45d3cc7ab2d94a), [`12b0cc4`](https://github.com/mastra-ai/mastra/commit/12b0cc4077d886b1a552637dedb70a7ade93528c), [`3bf6c5f`](https://github.com/mastra-ai/mastra/commit/3bf6c5f104c25226cd84e0c77f9dec15f2cac2db)]:
  - @mastra/core@1.0.0
  - @mastra/deployer@1.0.0
  - @mastra/loggers@1.0.0

## 1.0.0-beta.19

### Patch Changes

- Fixed migration CLI failing with MIGRATION_REQUIRED error during Mastra import. Added MASTRA_DISABLE_STORAGE_INIT environment variable to skip auto-initialization of storage, allowing the migration command to import user's Mastra config without triggering the migration check. Also improved the migration prompt display to show warning messages before the confirmation dialog. ([#12100](https://github.com/mastra-ai/mastra/pull/12100))

- Updated dependencies [[`50fd320`](https://github.com/mastra-ai/mastra/commit/50fd320003d0d93831c230ef531bef41f5ba7b3a)]:
  - @mastra/core@1.0.0-beta.27
  - @mastra/deployer@1.0.0-beta.27

## 1.0.0-beta.18

### Minor Changes

- Added `mastra migrate` CLI command to manually run storage migrations. This command bundles and executes the migration script against your configured storage backend, deduplicating spans and adding unique constraints. Useful when upgrading from older versions that may have duplicate (traceId, spanId) entries. ([#12073](https://github.com/mastra-ai/mastra/pull/12073))

  **Usage:**

  ```bash
  npx mastra migrate
  ```

  **Options:**
  - `-d, --dir <path>` - Path to your Mastra folder (default: `src/mastra`)
  - `-r, --root <path>` - Path to your root folder
  - `-e, --env <env>` - Custom env file to include
  - `--debug` - Enable debug logs

### Patch Changes

- Updated dependencies [[`026b848`](https://github.com/mastra-ai/mastra/commit/026b8483fbf5b6d977be8f7e6aac8d15c75558ac), [`ffa553a`](https://github.com/mastra-ai/mastra/commit/ffa553a3edc1bd17d73669fba66d6b6f4ac10897)]:
  - @mastra/core@1.0.0-beta.26
  - @mastra/deployer@1.0.0-beta.26

## 1.0.0-beta.17

### Patch Changes

- Added Processors tab to Mastra Studio. You can now view all configured processors, see which agents use them, and test processors directly from the UI. Processor workflows automatically redirect to the workflow graph view with a simplified input mode for testing. ([#12059](https://github.com/mastra-ai/mastra/pull/12059))

- Updated dependencies [[`ed3e3dd`](https://github.com/mastra-ai/mastra/commit/ed3e3ddec69d564fe2b125e083437f76331f1283), [`6833c69`](https://github.com/mastra-ai/mastra/commit/6833c69607418d257750bbcdd84638993d343539), [`47b1c16`](https://github.com/mastra-ai/mastra/commit/47b1c16a01c7ffb6765fe1e499b49092f8b7eba3), [`3a76a80`](https://github.com/mastra-ai/mastra/commit/3a76a80284cb71a0faa975abb3d4b2a9631e60cd), [`8538a0d`](https://github.com/mastra-ai/mastra/commit/8538a0d232619bf55dad7ddc2a8b0ca77c679a87), [`7b406f4`](https://github.com/mastra-ai/mastra/commit/7b406f49d8fec4b1b991ea15c2eb484a554ba00d), [`9312dcd`](https://github.com/mastra-ai/mastra/commit/9312dcd1c6f5b321929e7d382e763d95fdc030f5)]:
  - @mastra/core@1.0.0-beta.25
  - @mastra/deployer@1.0.0-beta.25

## 1.0.0-beta.16

### Patch Changes

- Update internal dependencies ([#12050](https://github.com/mastra-ai/mastra/pull/12050))

## 1.0.0-beta.15

### Minor Changes

- Add `README.md` file during `create-mastra` command. It contains basic project information and links to Mastra's docs. ([#11806](https://github.com/mastra-ai/mastra/pull/11806))

- Rename `playground` to `studio` internally. ([#11751](https://github.com/mastra-ai/mastra/pull/11751))
  - The CLI now copies the Studio to `dist/studio`
  - `mastra build --studio` creates a `.mastra/output/studio` folder now

  The `mastra studio` command behaves as before.

### Patch Changes

- Improve Bun detection logic by looking for `.lockb`, too ([#11879](https://github.com/mastra-ai/mastra/pull/11879))

- Add human-in-the-loop (HITL) support to agent networks ([#11678](https://github.com/mastra-ai/mastra/pull/11678))
  - Add suspend/resume capabilities to agent network
  - Enable auto-resume for suspended network execution via `autoResumeSuspendedTools`

  `agent.resumeNetwork`, `agent.approveNetworkToolCall`, `agent.declineNetworkToolCall`

- Updated dependencies [[`8aab268`](https://github.com/mastra-ai/mastra/commit/8aab268ee81ed6cde8adf3ac81a5e2de1c544a0c), [`ebae12a`](https://github.com/mastra-ai/mastra/commit/ebae12a2dd0212e75478981053b148a2c246962d), [`c61a0a5`](https://github.com/mastra-ai/mastra/commit/c61a0a5de4904c88fd8b3718bc26d1be1c2ec6e7), [`69136e7`](https://github.com/mastra-ai/mastra/commit/69136e748e32f57297728a4e0f9a75988462f1a7), [`449aed2`](https://github.com/mastra-ai/mastra/commit/449aed2ba9d507b75bf93d427646ea94f734dfd1), [`eb648a2`](https://github.com/mastra-ai/mastra/commit/eb648a2cc1728f7678768dd70cd77619b448dab9), [`0131105`](https://github.com/mastra-ai/mastra/commit/0131105532e83bdcbb73352fc7d0879eebf140dc), [`9d5059e`](https://github.com/mastra-ai/mastra/commit/9d5059eae810829935fb08e81a9bb7ecd5b144a7), [`ef756c6`](https://github.com/mastra-ai/mastra/commit/ef756c65f82d16531c43f49a27290a416611e526), [`b00ccd3`](https://github.com/mastra-ai/mastra/commit/b00ccd325ebd5d9e37e34dd0a105caae67eb568f), [`6afd81d`](https://github.com/mastra-ai/mastra/commit/6afd81df67fbbf362871f632fb34d90da1ed5c0b), [`3bdfa75`](https://github.com/mastra-ai/mastra/commit/3bdfa7507a91db66f176ba8221aa28dd546e464a), [`e770de9`](https://github.com/mastra-ai/mastra/commit/e770de941a287a49b1964d44db5a5763d19890a6), [`52e2716`](https://github.com/mastra-ai/mastra/commit/52e2716b42df6eff443de72360ae83e86ec23993), [`27b4040`](https://github.com/mastra-ai/mastra/commit/27b4040bfa1a95d92546f420a02a626b1419a1d6), [`610a70b`](https://github.com/mastra-ai/mastra/commit/610a70bdad282079f0c630e0d7bb284578f20151), [`f4eebb2`](https://github.com/mastra-ai/mastra/commit/f4eebb28151f8b0259c88559149c4abfa00a84de), [`8dc7f55`](https://github.com/mastra-ai/mastra/commit/8dc7f55900395771da851dc7d78d53ae84fe34ec), [`8379099`](https://github.com/mastra-ai/mastra/commit/8379099fc467af6bef54dd7f80c9bd75bf8bbddf), [`8c0ec25`](https://github.com/mastra-ai/mastra/commit/8c0ec25646c8a7df253ed1e5ff4863a0d3f1316c), [`ff4d9a6`](https://github.com/mastra-ai/mastra/commit/ff4d9a6704fc87b31a380a76ed22736fdedbba5a), [`69821ef`](https://github.com/mastra-ai/mastra/commit/69821ef806482e2c44e2197ac0b050c3fe3a5285), [`1ed5716`](https://github.com/mastra-ai/mastra/commit/1ed5716830867b3774c4a1b43cc0d82935f32b96), [`4186bdd`](https://github.com/mastra-ai/mastra/commit/4186bdd00731305726fa06adba0b076a1d50b49f), [`7aaf973`](https://github.com/mastra-ai/mastra/commit/7aaf973f83fbbe9521f1f9e7a4fd99b8de464617)]:
  - @mastra/deployer@1.0.0-beta.22
  - @mastra/core@1.0.0-beta.22

## 1.0.0-beta.14

### Patch Changes

- Replace deprecated client.getTraces with a client.listTraces ([#11711](https://github.com/mastra-ai/mastra/pull/11711))

- dependencies updates: ([#11642](https://github.com/mastra-ai/mastra/pull/11642))
  - Updated dependency [`fs-extra@^11.3.3` ↗︎](https://www.npmjs.com/package/fs-extra/v/11.3.3) (from `^11.3.2`, in `dependencies`)

- Make initialState optional in studio ([#11744](https://github.com/mastra-ai/mastra/pull/11744))

- Updated dependencies [[`08766f1`](https://github.com/mastra-ai/mastra/commit/08766f15e13ac0692fde2a8bd366c2e16e4321df), [`b3db460`](https://github.com/mastra-ai/mastra/commit/b3db4609771139727e4cddb3af1cc82e6d431665), [`ae8baf7`](https://github.com/mastra-ai/mastra/commit/ae8baf7d8adcb0ff9dac11880400452bc49b33ff), [`cfabdd4`](https://github.com/mastra-ai/mastra/commit/cfabdd4aae7a726b706942d6836eeca110fb6267), [`a0e437f`](https://github.com/mastra-ai/mastra/commit/a0e437fac561b28ee719e0302d72b2f9b4c138f0), [`bec5efd`](https://github.com/mastra-ai/mastra/commit/bec5efde96653ccae6604e68c696d1bc6c1a0bf5), [`9eedf7d`](https://github.com/mastra-ai/mastra/commit/9eedf7de1d6e0022a2f4e5e9e6fe1ec468f9b43c)]:
  - @mastra/core@1.0.0-beta.21
  - @mastra/deployer@1.0.0-beta.21

## 1.0.0-beta.13

### Patch Changes

- Remove `streamVNext`, `resumeStreamVNext`, and `observeStreamVNext` methods, call `stream`, `resumeStream` and `observeStream` directly ([#11499](https://github.com/mastra-ai/mastra/pull/11499))

  ```diff
  + const run = await workflow.createRun({ runId: '123' });
  - const stream = await run.streamVNext({ inputData: { ... } });
  + const stream = await run.stream({ inputData: { ... } });
  ```

- Add Bun runtime detection for bundler platform selection ([#11548](https://github.com/mastra-ai/mastra/pull/11548))

  When running under Bun, the bundler now uses `neutral` esbuild platform instead of `node` to preserve Bun-specific globals (like `Bun.s3`). This fixes compatibility issues where Bun APIs were being incorrectly transformed during the build process.

- Add initial state input to workflow form in studio ([#11560](https://github.com/mastra-ai/mastra/pull/11560))

- Improved file persistence in dev mode. Files created by `mastra dev` are now saved in the public directory, so you can commit them to version control or ignore them via `.gitignore`. ([#11234](https://github.com/mastra-ai/mastra/pull/11234))

- Display network completion validation results and scorer feedback in the Playground when viewing agent network runs, letting users see pass/fail status and actionable feedback from completion scorers ([#11562](https://github.com/mastra-ai/mastra/pull/11562))

- Updated dependencies [[`d2d3e22`](https://github.com/mastra-ai/mastra/commit/d2d3e22a419ee243f8812a84e3453dd44365ecb0), [`bc72b52`](https://github.com/mastra-ai/mastra/commit/bc72b529ee4478fe89ecd85a8be47ce0127b82a0), [`05b8bee`](https://github.com/mastra-ai/mastra/commit/05b8bee9e50e6c2a4a2bf210eca25ee212ca24fa), [`c042bd0`](https://github.com/mastra-ai/mastra/commit/c042bd0b743e0e86199d0cb83344ca7690e34a9c), [`289f85c`](https://github.com/mastra-ai/mastra/commit/289f85c48d4d4c5f71672967715e17b512c40f4d), [`940a2b2`](https://github.com/mastra-ai/mastra/commit/940a2b27480626ed7e74f55806dcd2181c1dd0c2), [`e0941c3`](https://github.com/mastra-ai/mastra/commit/e0941c3d7fc75695d5d258e7008fd5d6e650800c), [`0c0580a`](https://github.com/mastra-ai/mastra/commit/0c0580a42f697cd2a7d5973f25bfe7da9055038a), [`28f5f89`](https://github.com/mastra-ai/mastra/commit/28f5f89705f2409921e3c45178796c0e0d0bbb64), [`e601b27`](https://github.com/mastra-ai/mastra/commit/e601b272c70f3a5ecca610373aa6223012704892), [`3d3366f`](https://github.com/mastra-ai/mastra/commit/3d3366f31683e7137d126a3a57174a222c5801fb), [`5a4953f`](https://github.com/mastra-ai/mastra/commit/5a4953f7d25bb15ca31ed16038092a39cb3f98b3), [`eb9e522`](https://github.com/mastra-ai/mastra/commit/eb9e522ce3070a405e5b949b7bf5609ca51d7fe2), [`20e6f19`](https://github.com/mastra-ai/mastra/commit/20e6f1971d51d3ff6dd7accad8aaaae826d540ed), [`4f0b3c6`](https://github.com/mastra-ai/mastra/commit/4f0b3c66f196c06448487f680ccbb614d281e2f7), [`74c4f22`](https://github.com/mastra-ai/mastra/commit/74c4f22ed4c71e72598eacc346ba95cdbc00294f), [`b874113`](https://github.com/mastra-ai/mastra/commit/b8741130ed63eeaf837e6210d351792492f6bcd1), [`81b6a8f`](https://github.com/mastra-ai/mastra/commit/81b6a8ff79f49a7549d15d66624ac1a0b8f5f971), [`e4d366a`](https://github.com/mastra-ai/mastra/commit/e4d366aeb500371dd4210d6aa8361a4c21d87034), [`a4f010b`](https://github.com/mastra-ai/mastra/commit/a4f010b22e4355a5fdee70a1fe0f6e4a692cc29e), [`73b0bb3`](https://github.com/mastra-ai/mastra/commit/73b0bb394dba7c9482eb467a97ab283dbc0ef4db), [`5627a8c`](https://github.com/mastra-ai/mastra/commit/5627a8c6dc11fe3711b3fa7a6ffd6eb34100a306), [`3ff45d1`](https://github.com/mastra-ai/mastra/commit/3ff45d10e0c80c5335a957ab563da72feb623520), [`251df45`](https://github.com/mastra-ai/mastra/commit/251df4531407dfa46d805feb40ff3fb49769f455), [`f894d14`](https://github.com/mastra-ai/mastra/commit/f894d148946629af7b1f452d65a9cf864cec3765), [`c2b9547`](https://github.com/mastra-ai/mastra/commit/c2b9547bf435f56339f23625a743b2147ab1c7a6), [`580b592`](https://github.com/mastra-ai/mastra/commit/580b5927afc82fe460dfdf9a38a902511b6b7e7f), [`a547452`](https://github.com/mastra-ai/mastra/commit/a547452ad96720490323a48d611a89fc6e1c7383), [`58e3931`](https://github.com/mastra-ai/mastra/commit/58e3931af9baa5921688566210f00fb0c10479fa), [`bdfd094`](https://github.com/mastra-ai/mastra/commit/bdfd0943f05e001a7b7b0bf1216caf9b292e565c), [`08bb631`](https://github.com/mastra-ai/mastra/commit/08bb631ae2b14684b2678e3549d0b399a6f0561e), [`4fba91b`](https://github.com/mastra-ai/mastra/commit/4fba91bec7c95911dc28e369437596b152b04cd0), [`12b0cc4`](https://github.com/mastra-ai/mastra/commit/12b0cc4077d886b1a552637dedb70a7ade93528c)]:
  - @mastra/core@1.0.0-beta.20
  - @mastra/deployer@1.0.0-beta.20
  - @mastra/loggers@1.0.0-beta.4

## 1.0.0-beta.12

### Minor Changes

- Add Antigravity IDE support to create-mastra CLI. Users can now select Antigravity during project initialization and automatically configure the global Mastra MCP server for the IDE, reducing manual setup and enabling immediate use of Mastra agents. ([#11374](https://github.com/mastra-ai/mastra/pull/11374))

- Add --studio flag to bundle playground UI with mastra build ([#11327](https://github.com/mastra-ai/mastra/pull/11327))

  Enables bundling the studio/playground UI into the build output so it can be served from the deployed server.

  ```bash
  mastra build --studio
  ```

- Added CLI options to configure Mastra Studio runtime settings, allowing you to customize the server connection details, and protocol. ([#11265](https://github.com/mastra-ai/mastra/pull/11265))

  You can now override the default studio configuration using command-line arguments:

  ```bash
  mastra studio \
    --server-host api.example.com \
    --server-port 8080 \
    --server-protocol https
  ```

  These options configure the `window.MASTRA_*` environment variables that the Studio frontend uses to connect to your API server.

### Patch Changes

- Extract getDurationMs helper method to simplify command execution timing in CLI analytics. Replaces repeated process.hrtime logic with a reusable private helper method, improving code maintainability and reducing duplication. ([#11316](https://github.com/mastra-ai/mastra/pull/11316))

- Add debugger-like click-through UI to workflow graph ([#11350](https://github.com/mastra-ai/mastra/pull/11350))

- Detect installed Mastra packages during dev and pass version information to the playground server via `MASTRA_PACKAGES_FILE` env var ([#11211](https://github.com/mastra-ai/mastra/pull/11211))

- Updated dependencies [[`403c643`](https://github.com/mastra-ai/mastra/commit/403c643ea02862f3177d4b92e85b09f83aed3eb3), [`33a4d2e`](https://github.com/mastra-ai/mastra/commit/33a4d2e4ed8af51f69256232f00c34d6b6b51d48), [`4aaa844`](https://github.com/mastra-ai/mastra/commit/4aaa844a4f19d054490f43638a990cc57bda8d2f), [`4a1a6cb`](https://github.com/mastra-ai/mastra/commit/4a1a6cb3facad54b2bb6780b00ce91d6de1edc08), [`31d13d5`](https://github.com/mastra-ai/mastra/commit/31d13d5fdc2e2380e2e3ee3ec9fb29d2a00f265d), [`2fe69cb`](https://github.com/mastra-ai/mastra/commit/2fe69cbfda1025a7cf440308eed26c77ec553e1a), [`4c62166`](https://github.com/mastra-ai/mastra/commit/4c621669f4a29b1f443eca3ba70b814afa286266), [`7bcbf10`](https://github.com/mastra-ai/mastra/commit/7bcbf10133516e03df964b941f9a34e9e4ab4177), [`4353600`](https://github.com/mastra-ai/mastra/commit/43536005a65988a8eede236f69122e7f5a284ba2), [`6986fb0`](https://github.com/mastra-ai/mastra/commit/6986fb064f5db6ecc24aa655e1d26529087b43b3), [`4da09a4`](https://github.com/mastra-ai/mastra/commit/4da09a4b95262be57c912821d6d8108868ae59db), [`053e979`](https://github.com/mastra-ai/mastra/commit/053e9793b28e970086b0507f7f3b76ea32c1e838), [`e26dc9c`](https://github.com/mastra-ai/mastra/commit/e26dc9c3ccfec54ae3dc3e2b2589f741f9ae60a6), [`55edf73`](https://github.com/mastra-ai/mastra/commit/55edf7302149d6c964fbb7908b43babfc2b52145), [`27c0009`](https://github.com/mastra-ai/mastra/commit/27c0009777a6073d7631b0eb7b481d94e165b5ca), [`dee388d`](https://github.com/mastra-ai/mastra/commit/dee388dde02f2e63c53385ae69252a47ab6825cc), [`3f3fc30`](https://github.com/mastra-ai/mastra/commit/3f3fc3096f24c4a26cffeecfe73085928f72aa63), [`d90ea65`](https://github.com/mastra-ai/mastra/commit/d90ea6536f7aa51c6545a4e9215b55858e98e16d), [`d171e55`](https://github.com/mastra-ai/mastra/commit/d171e559ead9f52ec728d424844c8f7b164c4510), [`10c2735`](https://github.com/mastra-ai/mastra/commit/10c27355edfdad1ee2b826b897df74125eb81fb8), [`1924cf0`](https://github.com/mastra-ai/mastra/commit/1924cf06816e5e4d4d5333065ec0f4bb02a97799), [`b339816`](https://github.com/mastra-ai/mastra/commit/b339816df0984d0243d944ac2655d6ba5f809cde)]:
  - @mastra/deployer@1.0.0-beta.15
  - @mastra/core@1.0.0-beta.15

## 1.0.0-beta.11

### Patch Changes

- Set `externals: true` as the default for `mastra build` and cloud-deployer to reduce bundle issues with native dependencies. ([`0dbf199`](https://github.com/mastra-ai/mastra/commit/0dbf199110f22192ce5c95b1c8148d4872b4d119))

  **Note:** If you previously relied on the default bundling behavior (all dependencies bundled), you can explicitly set `externals: false` in your bundler configuration.

- Two smaller quality of life improvements: ([#11232](https://github.com/mastra-ai/mastra/pull/11232))
  - The default `create-mastra` project no longer defines a LibSQLStore storage for the weather agent memory. It uses the root level `storage` option now (which is memory). This way no `mastra.db` files are created outside of the project
  - When running `mastra init` inside a project that already has git initialized, the prompt to initialize git is skipped

- Updated dependencies [[`4f94ed8`](https://github.com/mastra-ai/mastra/commit/4f94ed8177abfde3ec536e3574883e075423350c), [`ac3cc23`](https://github.com/mastra-ai/mastra/commit/ac3cc2397d1966bc0fc2736a223abc449d3c7719), [`a86f4df`](https://github.com/mastra-ai/mastra/commit/a86f4df0407311e0d2ea49b9a541f0938810d6a9), [`029540c`](https://github.com/mastra-ai/mastra/commit/029540ca1e582fc2dd8d288ecd4a9b0f31a954ef), [`66741d1`](https://github.com/mastra-ai/mastra/commit/66741d1a99c4f42cf23a16109939e8348ac6852e), [`01b20fe`](https://github.com/mastra-ai/mastra/commit/01b20fefb7c67c2b7d79417598ef4e60256d1225), [`0dbf199`](https://github.com/mastra-ai/mastra/commit/0dbf199110f22192ce5c95b1c8148d4872b4d119), [`a7ce182`](https://github.com/mastra-ai/mastra/commit/a7ce1822a8785ce45d62dd5c911af465e144f7d7)]:
  - @mastra/core@1.0.0-beta.14
  - @mastra/deployer@1.0.0-beta.14

## 1.0.0-beta.10

### Patch Changes

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

- Add `Run` instance to client-js. `workflow.createRun` returns the `Run` instance which can be used for the different run methods. ([#11207](https://github.com/mastra-ai/mastra/pull/11207))
  With this change, run methods cannot be called directly on workflow instance anymore

  ```diff
  - const result = await workflow.stream({ runId: '123', inputData: { ... } });
  + const run = await workflow.createRun({ runId: '123' });
  + const stream = await run.stream({ inputData: { ... } });
  ```

- Fix the development experience of the studio. It was not able to resolve the running instance because the index.html variables were not replaced in the vite dev standalone config ([#11085](https://github.com/mastra-ai/mastra/pull/11085))

- fix isTopLevelSpan value definition on SpanScoring to properly recognize lack of span?.parentSpanId value (null or empty string) ([#11083](https://github.com/mastra-ai/mastra/pull/11083))

- Updated dependencies [[`d5ed981`](https://github.com/mastra-ai/mastra/commit/d5ed981c8701c1b8a27a5f35a9a2f7d9244e695f), [`9650cce`](https://github.com/mastra-ai/mastra/commit/9650cce52a1d917ff9114653398e2a0f5c3ba808), [`932d63d`](https://github.com/mastra-ai/mastra/commit/932d63dd51be9c8bf1e00e3671fe65606c6fb9cd), [`b760b73`](https://github.com/mastra-ai/mastra/commit/b760b731aca7c8a3f041f61d57a7f125ae9cb215), [`695a621`](https://github.com/mastra-ai/mastra/commit/695a621528bdabeb87f83c2277cf2bb084c7f2b4), [`2b459f4`](https://github.com/mastra-ai/mastra/commit/2b459f466fd91688eeb2a44801dc23f7f8a887ab), [`486352b`](https://github.com/mastra-ai/mastra/commit/486352b66c746602b68a95839f830de14c7fb8c0), [`09e4bae`](https://github.com/mastra-ai/mastra/commit/09e4bae18dd5357d2ae078a4a95a2af32168ab08), [`24b76d8`](https://github.com/mastra-ai/mastra/commit/24b76d8e17656269c8ed09a0c038adb9cc2ae95a), [`243a823`](https://github.com/mastra-ai/mastra/commit/243a8239c5906f5c94e4f78b54676793f7510ae3), [`486352b`](https://github.com/mastra-ai/mastra/commit/486352b66c746602b68a95839f830de14c7fb8c0), [`c61fac3`](https://github.com/mastra-ai/mastra/commit/c61fac3add96f0dcce0208c07415279e2537eb62), [`6f14f70`](https://github.com/mastra-ai/mastra/commit/6f14f706ccaaf81b69544b6c1b75ab66a41e5317), [`09e4bae`](https://github.com/mastra-ai/mastra/commit/09e4bae18dd5357d2ae078a4a95a2af32168ab08), [`6375f52`](https://github.com/mastra-ai/mastra/commit/6375f52c219305abef6f2026b4eaf8ac2fa5f1c0), [`4524734`](https://github.com/mastra-ai/mastra/commit/45247343e384717a7c8404296275c56201d6470f), [`2a53598`](https://github.com/mastra-ai/mastra/commit/2a53598c6d8cfeb904a7fc74e57e526d751c8fa6), [`c7cd3c7`](https://github.com/mastra-ai/mastra/commit/c7cd3c7a187d7aaf79e2ca139de328bf609a14b4), [`09e4bae`](https://github.com/mastra-ai/mastra/commit/09e4bae18dd5357d2ae078a4a95a2af32168ab08), [`847c212`](https://github.com/mastra-ai/mastra/commit/847c212caba7df0d6f2fc756b494ac3c75c3720d), [`6f941c4`](https://github.com/mastra-ai/mastra/commit/6f941c438ca5f578619788acc7608fc2e23bd176)]:
  - @mastra/core@1.0.0-beta.12
  - @mastra/deployer@1.0.0-beta.12

## 1.0.0-beta.9

### Patch Changes

- Allow to run mastra studio from anywhere in the file system, and not necessarily inside a mastra project ([#11067](https://github.com/mastra-ai/mastra/pull/11067))

- Make sure to verify that a mastra instance is running on server.port OR 4111 by default ([#11066](https://github.com/mastra-ai/mastra/pull/11066))

- Internal changes to enable a custom base path for Mastra Studio ([#10441](https://github.com/mastra-ai/mastra/pull/10441))

- Updated dependencies [[`38380b6`](https://github.com/mastra-ai/mastra/commit/38380b60fca905824bdf6b43df307a58efb1aa15), [`798d0c7`](https://github.com/mastra-ai/mastra/commit/798d0c740232653b1d754870e6b43a55c364ffe2), [`ffe84d5`](https://github.com/mastra-ai/mastra/commit/ffe84d54f3b0f85167fe977efd027dba027eb998), [`2c212e7`](https://github.com/mastra-ai/mastra/commit/2c212e704c90e2db83d4109e62c03f0f6ebd2667), [`4ca4306`](https://github.com/mastra-ai/mastra/commit/4ca430614daa5fa04730205a302a43bf4accfe9f), [`2c212e7`](https://github.com/mastra-ai/mastra/commit/2c212e704c90e2db83d4109e62c03f0f6ebd2667), [`3bf6c5f`](https://github.com/mastra-ai/mastra/commit/3bf6c5f104c25226cd84e0c77f9dec15f2cac2db)]:
  - @mastra/core@1.0.0-beta.11
  - @mastra/deployer@1.0.0-beta.11

## 1.0.0-beta.8

### Minor Changes

- Fix "MessagePartRuntime is not available" error when chatting with agents in Studio playground by replacing deprecated `useMessagePart` hook with `useAssistantState` ([#11039](https://github.com/mastra-ai/mastra/pull/11039))

### Patch Changes

- Add delete workflow run API ([#10991](https://github.com/mastra-ai/mastra/pull/10991))

  ```typescript
  await workflow.deleteWorkflowRunById(runId);
  ```

- Updated dependencies [[`edb07e4`](https://github.com/mastra-ai/mastra/commit/edb07e49283e0c28bd094a60e03439bf6ecf0221), [`b7e17d3`](https://github.com/mastra-ai/mastra/commit/b7e17d3f5390bb5a71efc112204413656fcdc18d), [`26346be`](https://github.com/mastra-ai/mastra/commit/26346beb6e637a114d1dd2eaf5127512c5af84fd), [`261473a`](https://github.com/mastra-ai/mastra/commit/261473ac637e633064a22076671e2e02b002214d), [`5d7000f`](https://github.com/mastra-ai/mastra/commit/5d7000f757cd65ea9dc5b05e662fd83dfd44e932), [`4f0331a`](https://github.com/mastra-ai/mastra/commit/4f0331a79bf6eb5ee598a5086e55de4b5a0ada03), [`8a000da`](https://github.com/mastra-ai/mastra/commit/8a000da0c09c679a2312f6b3aa05b2ca78ca7393)]:
  - @mastra/core@1.0.0-beta.10
  - @mastra/deployer@1.0.0-beta.10

## 1.0.0-beta.7

### Patch Changes

- Add `mastra studio` CLI command to serve the built playground as a static server ([#10283](https://github.com/mastra-ai/mastra/pull/10283))

- Fix default value showing on workflow form after user submits ([#10983](https://github.com/mastra-ai/mastra/pull/10983))

- Move to @posthog/react which is the actual way to use posthog in React. It also fixes ([#10967](https://github.com/mastra-ai/mastra/pull/10967))

- Move useScorers down to trace page to trigger it once for all trace spans ([#10985](https://github.com/mastra-ai/mastra/pull/10985))

- Update Observability Trace Spans list UI, so a user can expand/collapse span children/descendants and can filter the list by span type or name ([#10378](https://github.com/mastra-ai/mastra/pull/10378))

- Fix workflow trigger form overflow ([#10986](https://github.com/mastra-ai/mastra/pull/10986))

- Updated dependencies [[`72df8ae`](https://github.com/mastra-ai/mastra/commit/72df8ae595584cdd7747d5c39ffaca45e4507227), [`9198899`](https://github.com/mastra-ai/mastra/commit/91988995c427b185c33714b7f3be955367911324), [`7761c77`](https://github.com/mastra-ai/mastra/commit/7761c778b7b083cb01f7587cfa66010307204d00), [`653e65a`](https://github.com/mastra-ai/mastra/commit/653e65ae1f9502c2958a32f47a5a2df11e612a92), [`c6fd6fe`](https://github.com/mastra-ai/mastra/commit/c6fd6fedd09e9cf8004b03a80925f5e94826ad7e), [`0bed332`](https://github.com/mastra-ai/mastra/commit/0bed332843f627202c6520eaf671771313cd20f3)]:
  - @mastra/core@1.0.0-beta.9
  - @mastra/deployer@1.0.0-beta.9

## 1.0.0-beta.6

### Patch Changes

- Fix select options overflow when list is long by adding maximum height ([#10813](https://github.com/mastra-ai/mastra/pull/10813))

- Now when you run npx mastra@beta init, the CLI detects it's running from the beta dist-tag and installs the correct versions. ([#10821](https://github.com/mastra-ai/mastra/pull/10821))

- Updated dependencies [[`3076c67`](https://github.com/mastra-ai/mastra/commit/3076c6778b18988ae7d5c4c5c466366974b2d63f), [`85d7ee1`](https://github.com/mastra-ai/mastra/commit/85d7ee18ff4e14d625a8a30ec6656bb49804989b), [`c6c1092`](https://github.com/mastra-ai/mastra/commit/c6c1092f8fbf76109303f69e000e96fd1960c4ce), [`692d4ee`](https://github.com/mastra-ai/mastra/commit/692d4ee72105ec59c3cb64431d10a9ea9dbbfbaa), [`80115db`](https://github.com/mastra-ai/mastra/commit/80115db81ab658404c1c3d81375e0adbc8f5e131), [`81dc110`](https://github.com/mastra-ai/mastra/commit/81dc11008d147cf5bdc8996ead1aa61dbdebb6fc), [`7aedb74`](https://github.com/mastra-ai/mastra/commit/7aedb74883adf66af38e270e4068fd42e7a37036), [`8f02d80`](https://github.com/mastra-ai/mastra/commit/8f02d800777397e4b45d7f1ad041988a8b0c6630), [`d7aad50`](https://github.com/mastra-ai/mastra/commit/d7aad501ce61646b76b4b511e558ac4eea9884d0), [`162d768`](https://github.com/mastra-ai/mastra/commit/162d76861e18ee7b4423482169f78bf1de015612), [`ce0a73a`](https://github.com/mastra-ai/mastra/commit/ce0a73abeaa75b10ca38f9e40a255a645d50ebfb), [`a02e542`](https://github.com/mastra-ai/mastra/commit/a02e542d23179bad250b044b17ff023caa61739f), [`a372c64`](https://github.com/mastra-ai/mastra/commit/a372c640ad1fd12e8f0613cebdc682fc156b4d95), [`8846867`](https://github.com/mastra-ai/mastra/commit/8846867ffa9a3746767618e314bebac08eb77d87), [`42a42cf`](https://github.com/mastra-ai/mastra/commit/42a42cf3132b9786feecbb8c13c583dce5b0e198), [`ae08bf0`](https://github.com/mastra-ai/mastra/commit/ae08bf0ebc6a4e4da992b711c4a389c32ba84cf4), [`6540711`](https://github.com/mastra-ai/mastra/commit/65407118b4788400b29d5ff50e985505abee4c08), [`21735a7`](https://github.com/mastra-ai/mastra/commit/21735a7ef306963554a69a89b44f06c3bcd85141), [`1d877b8`](https://github.com/mastra-ai/mastra/commit/1d877b8d7b536a251c1a7a18db7ddcf4f68d6f8b)]:
  - @mastra/core@1.0.0-beta.7
  - @mastra/deployer@1.0.0-beta.7
  - @mastra/loggers@1.0.0-beta.2

## 1.0.0-beta.5

### Patch Changes

- During `npm create-mastra` you can now optionally initialize a git repository in the newly created project. The setup wizard will prompt for this option. ([#9792](https://github.com/mastra-ai/mastra/pull/9792))

- Fix discriminatedUnion schema information lost when json schema is converted to zod ([#10500](https://github.com/mastra-ai/mastra/pull/10500))

- Hide time travel on map steps in Studio ([#10631](https://github.com/mastra-ai/mastra/pull/10631))

- Fixed tool list empty state when there are no agents so the page renders correctly. ([#10711](https://github.com/mastra-ai/mastra/pull/10711))

- Updated dependencies [[`ac0d2f4`](https://github.com/mastra-ai/mastra/commit/ac0d2f4ff8831f72c1c66c2be809706d17f65789), [`1a0d3fc`](https://github.com/mastra-ai/mastra/commit/1a0d3fc811482c9c376cdf79ee615c23bae9b2d6), [`85a628b`](https://github.com/mastra-ai/mastra/commit/85a628b1224a8f64cd82ea7f033774bf22df7a7e), [`c237233`](https://github.com/mastra-ai/mastra/commit/c23723399ccedf7f5744b3f40997b79246bfbe64), [`90ae4bf`](https://github.com/mastra-ai/mastra/commit/90ae4bf971286398d4cb528b4678d96b461fef42), [`15f9e21`](https://github.com/mastra-ai/mastra/commit/15f9e216177201ea6e3f6d0bfb063fcc0953444f), [`ff94dea`](https://github.com/mastra-ai/mastra/commit/ff94dea935f4e34545c63bcb6c29804732698809), [`5b2ff46`](https://github.com/mastra-ai/mastra/commit/5b2ff4651df70c146523a7fca773f8eb0a2272f8), [`db41688`](https://github.com/mastra-ai/mastra/commit/db4168806d007417e2e60b4f68656dca4e5f40c9), [`a54a3a6`](https://github.com/mastra-ai/mastra/commit/a54a3a61d88219829de9ff6cf0d5ece163d78dc1), [`5ca599d`](https://github.com/mastra-ai/mastra/commit/5ca599d0bb59a1595f19f58473fcd67cc71cef58), [`bff1145`](https://github.com/mastra-ai/mastra/commit/bff114556b3cbadad9b2768488708f8ad0e91475), [`5c8ca24`](https://github.com/mastra-ai/mastra/commit/5c8ca247094e0cc2cdbd7137822fb47241f86e77), [`e191844`](https://github.com/mastra-ai/mastra/commit/e1918444ca3f80e82feef1dad506cd4ec6e2875f), [`22553f1`](https://github.com/mastra-ai/mastra/commit/22553f11c63ee5e966a9c034a349822249584691), [`7237163`](https://github.com/mastra-ai/mastra/commit/72371635dbf96a87df4b073cc48fc655afbdce3d), [`2500740`](https://github.com/mastra-ai/mastra/commit/2500740ea23da067d6e50ec71c625ab3ce275e64), [`873ecbb`](https://github.com/mastra-ai/mastra/commit/873ecbb517586aa17d2f1e99283755b3ebb2863f), [`4f9bbe5`](https://github.com/mastra-ai/mastra/commit/4f9bbe5968f42c86f4930b8193de3c3c17e5bd36), [`02e51fe`](https://github.com/mastra-ai/mastra/commit/02e51feddb3d4155cfbcc42624fd0d0970d032c0), [`8f3fa3a`](https://github.com/mastra-ai/mastra/commit/8f3fa3a652bb77da092f913ec51ae46e3a7e27dc), [`cd29ad2`](https://github.com/mastra-ai/mastra/commit/cd29ad23a255534e8191f249593849ed29160886), [`bdf4d8c`](https://github.com/mastra-ai/mastra/commit/bdf4d8cdc656d8a2c21d81834bfa3bfa70f56c16), [`854e3da`](https://github.com/mastra-ai/mastra/commit/854e3dad5daac17a91a20986399d3a51f54bf68b), [`ce18d38`](https://github.com/mastra-ai/mastra/commit/ce18d38678c65870350d123955014a8432075fd9), [`cccf9c8`](https://github.com/mastra-ai/mastra/commit/cccf9c8b2d2dfc1a5e63919395b83d78c89682a0), [`5a9bafc`](https://github.com/mastra-ai/mastra/commit/5a9bafcaaa859898e954456e781a1552dc0ad4f1), [`61a5705`](https://github.com/mastra-ai/mastra/commit/61a570551278b6743e64243b3ce7d73de915ca8a), [`db70a48`](https://github.com/mastra-ai/mastra/commit/db70a48aeeeeb8e5f92007e8ede52c364ce15287), [`73ac522`](https://github.com/mastra-ai/mastra/commit/73ac522d5db7ba08a9bacf1f801d7990f3100a70), [`f0fdc14`](https://github.com/mastra-ai/mastra/commit/f0fdc14ee233d619266b3d2bbdeea7d25cfc6d13), [`db18bc9`](https://github.com/mastra-ai/mastra/commit/db18bc9c3825e2c1a0ad9a183cc9935f6691bfa1), [`9b37b56`](https://github.com/mastra-ai/mastra/commit/9b37b565e1f2a76c24f728945cc740c2b09be9da), [`41a23c3`](https://github.com/mastra-ai/mastra/commit/41a23c32f9877d71810f37e24930515df2ff7a0f), [`5d171ad`](https://github.com/mastra-ai/mastra/commit/5d171ad9ef340387276b77c2bb3e83e83332d729), [`f03ae60`](https://github.com/mastra-ai/mastra/commit/f03ae60500fe350c9d828621006cdafe1975fdd8), [`d1e74a0`](https://github.com/mastra-ai/mastra/commit/d1e74a0a293866dece31022047f5dbab65a304d0), [`39e7869`](https://github.com/mastra-ai/mastra/commit/39e7869bc7d0ee391077ce291474d8a84eedccff), [`5761926`](https://github.com/mastra-ai/mastra/commit/57619260c4a2cdd598763abbacd90de594c6bc76), [`c900fdd`](https://github.com/mastra-ai/mastra/commit/c900fdd504c41348efdffb205cfe80d48c38fa33), [`604a79f`](https://github.com/mastra-ai/mastra/commit/604a79fecf276e26a54a3fe01bb94e65315d2e0e), [`887f0b4`](https://github.com/mastra-ai/mastra/commit/887f0b4746cdbd7cb7d6b17ac9f82aeb58037ea5), [`2562143`](https://github.com/mastra-ai/mastra/commit/256214336b4faa78646c9c1776612393790d8784), [`cd7c74a`](https://github.com/mastra-ai/mastra/commit/cd7c74ab8f7975713b03e6c4768ad66dc0aa2a57), [`ef11a61`](https://github.com/mastra-ai/mastra/commit/ef11a61920fa0ed08a5b7ceedd192875af119749), [`46fa9fe`](https://github.com/mastra-ai/mastra/commit/46fa9feae3d44c7fdcd5b5f6be6acbe341b46e56)]:
  - @mastra/core@1.0.0-beta.6
  - @mastra/deployer@1.0.0-beta.6

## 1.0.0-beta.4

### Patch Changes

- Rename "Playground" to "Studio" ([#10443](https://github.com/mastra-ai/mastra/pull/10443))

- Add timeTravel APIs and add timeTravel feature to studio ([#10361](https://github.com/mastra-ai/mastra/pull/10361))

- Updated dependencies [[`21a15de`](https://github.com/mastra-ai/mastra/commit/21a15de369fe82aac26bb642ed7be73505475e8b), [`d3e89dd`](https://github.com/mastra-ai/mastra/commit/d3e89dd4fc31ae2804c4c7bd3e98113d069cf780), [`feb7ee4`](https://github.com/mastra-ai/mastra/commit/feb7ee4d09a75edb46c6669a3beaceec78811747), [`b0e2ea5`](https://github.com/mastra-ai/mastra/commit/b0e2ea5b52c40fae438b9e2f7baee6f0f89c5442), [`4b161df`](https://github.com/mastra-ai/mastra/commit/4b161df5df43cd45bab4dab2fe79066243aa6928), [`c456e01`](https://github.com/mastra-ai/mastra/commit/c456e0149e3c176afcefdbd9bb1d2c5917723725), [`ab035c2`](https://github.com/mastra-ai/mastra/commit/ab035c2ef6d8cc7bb25f06f1a38508bd9e6f126b), [`1a46a56`](https://github.com/mastra-ai/mastra/commit/1a46a566f45a3fcbadc1cf36bf86d351f264bfa3), [`3cf540b`](https://github.com/mastra-ai/mastra/commit/3cf540b9fbfea8f4fc8d3a2319a4e6c0b0cbfd52), [`1c6ce51`](https://github.com/mastra-ai/mastra/commit/1c6ce51f875915ab57fd36873623013699a2a65d), [`898a972`](https://github.com/mastra-ai/mastra/commit/898a9727d286c2510d6b702dfd367e6aaf5c6b0f), [`a97003a`](https://github.com/mastra-ai/mastra/commit/a97003aa1cf2f4022a41912324a1e77263b326b8), [`ccc141e`](https://github.com/mastra-ai/mastra/commit/ccc141ed27da0abc3a3fc28e9e5128152e8e37f4), [`fe3b897`](https://github.com/mastra-ai/mastra/commit/fe3b897c2ccbcd2b10e81b099438c7337feddf89), [`00123ba`](https://github.com/mastra-ai/mastra/commit/00123ba96dc9e5cd0b110420ebdba56d8f237b25), [`29c4309`](https://github.com/mastra-ai/mastra/commit/29c4309f818b24304c041bcb4a8f19b5f13f6b62), [`16785ce`](https://github.com/mastra-ai/mastra/commit/16785ced928f6f22638f4488cf8a125d99211799), [`de8239b`](https://github.com/mastra-ai/mastra/commit/de8239bdcb1d8c0cfa06da21f1569912a66bbc8a), [`b5e6cd7`](https://github.com/mastra-ai/mastra/commit/b5e6cd77fc8c8e64e0494c1d06cee3d84e795d1e), [`cc4d0a1`](https://github.com/mastra-ai/mastra/commit/cc4d0a151bb97b07ceeee2751332779403aec8dc), [`3759cb0`](https://github.com/mastra-ai/mastra/commit/3759cb064935b5f74c65ac2f52a1145f7352899d), [`651e772`](https://github.com/mastra-ai/mastra/commit/651e772eb1475fb13e126d3fcc01751297a88214), [`b61b93f`](https://github.com/mastra-ai/mastra/commit/b61b93f9e058b11dd2eec169853175d31dbdd567), [`bae33d9`](https://github.com/mastra-ai/mastra/commit/bae33d91a63fbb64d1e80519e1fc1acaed1e9013), [`c0b731f`](https://github.com/mastra-ai/mastra/commit/c0b731fb27d712dc8582e846df5c0332a6a0c5ba), [`43ca8f2`](https://github.com/mastra-ai/mastra/commit/43ca8f2c7334851cc7b4d3d2f037d8784bfbdd5f), [`2ca67cc`](https://github.com/mastra-ai/mastra/commit/2ca67cc3bb1f6a617353fdcab197d9efebe60d6f), [`9e67002`](https://github.com/mastra-ai/mastra/commit/9e67002b52c9be19936c420a489dbee9c5fd6a78), [`35edc49`](https://github.com/mastra-ai/mastra/commit/35edc49ac0556db609189641d6341e76771b81fc), [`9cd9d2f`](https://github.com/mastra-ai/mastra/commit/9cd9d2f7c66a1016c8fed0221eb55343d4f19a17)]:
  - @mastra/core@1.0.0-beta.5
  - @mastra/deployer@1.0.0-beta.5

## 1.0.0-beta.3

### Patch Changes

- fix: detect bun runtime and cleanup on failure ([#10242](https://github.com/mastra-ai/mastra/pull/10242))

- Updated dependencies [[`352a5d6`](https://github.com/mastra-ai/mastra/commit/352a5d625cfe09849b21e8f52a24c9f0366759d5), [`a0a5b4b`](https://github.com/mastra-ai/mastra/commit/a0a5b4bbebe6c701ebbadf744873aa0d5ca01371), [`69ea758`](https://github.com/mastra-ai/mastra/commit/69ea758358edd7117f191c2e69c8bb5fc79e7a1a), [`993ad98`](https://github.com/mastra-ai/mastra/commit/993ad98d7ad3bebda9ecef5fec5c94349a0d04bc), [`3ff2c17`](https://github.com/mastra-ai/mastra/commit/3ff2c17a58e312fad5ea37377262c12d92ca0908)]:
  - @mastra/core@1.0.0-beta.4
  - @mastra/deployer@1.0.0-beta.4

## 1.0.0-beta.2

### Minor Changes

- Add host:port support to --inspect and --inspect-brk flags ([#10077](https://github.com/mastra-ai/mastra/pull/10077))

  Enable optional host:port values for Docker debugging (e.g., `--inspect=0.0.0.0:9229`) while maintaining backward compatibility with boolean flags.

### Patch Changes

- Add support to skip dotenv/env file loading by adding MASTRA_SKIP_DOTENV ([#9455](https://github.com/mastra-ai/mastra/pull/9455))

- dependencies updates: ([#9781](https://github.com/mastra-ai/mastra/pull/9781))
  - Updated dependency [`posthog-node@5.11.2` ↗︎](https://www.npmjs.com/package/posthog-node/v/5.11.2) (from `4.18.0`, in `dependencies`)

- Add restart method to workflow run that allows restarting an active workflow run ([#9750](https://github.com/mastra-ai/mastra/pull/9750))
  Add status filter to `listWorkflowRuns`
  Add automatic restart to restart active workflow runs when server starts

- Fix scorer filtering for SpanScoring, add error and info message for user ([#10160](https://github.com/mastra-ai/mastra/pull/10160))

- Templates now don't dynamically create a branch for every provider, each template should be agnostic and just use a env var to set the models until the user wants to set it otherwise. ([#10036](https://github.com/mastra-ai/mastra/pull/10036))
  MCP docs server will install the beta version of the docs server if they create a project with the beta tag.
  Updates to the templates now will get pushed to the beta branch, when beta goes stable we will merge the beta branch into the main branch for all templates and update the github script to push to main.
  Templates have been cleaned up
  small docs updates based off of how the template migrations went

- Update internal dependencies, no change in behavior ([#10000](https://github.com/mastra-ai/mastra/pull/10000))

- Fix double scroll on agent chat container ([#10253](https://github.com/mastra-ai/mastra/pull/10253))

- Updated dependencies [[`2319326`](https://github.com/mastra-ai/mastra/commit/2319326f8c64e503a09bbcf14be2dd65405445e0), [`2319326`](https://github.com/mastra-ai/mastra/commit/2319326f8c64e503a09bbcf14be2dd65405445e0), [`df9fdcd`](https://github.com/mastra-ai/mastra/commit/df9fdcd8403652c894cf4ac0503afea3b822588c), [`65591d2`](https://github.com/mastra-ai/mastra/commit/65591d2b7cecb83fff4ebc1d743e2f71859a2f7d), [`52e5984`](https://github.com/mastra-ai/mastra/commit/52e5984b067254e955646d09b217165b3f145292), [`d629361`](https://github.com/mastra-ai/mastra/commit/d629361a60f6565b5bfb11976fdaf7308af858e2), [`08c31c1`](https://github.com/mastra-ai/mastra/commit/08c31c188ebccd598acaf55e888b6397d01f7eae), [`fd3d338`](https://github.com/mastra-ai/mastra/commit/fd3d338a2c362174ed5b383f1f011ad9fb0302aa), [`c30400a`](https://github.com/mastra-ai/mastra/commit/c30400a49b994b1b97256fe785eb6c906fc2b232), [`69e0a87`](https://github.com/mastra-ai/mastra/commit/69e0a878896a2da9494945d86e056a5f8f05b851), [`01f8878`](https://github.com/mastra-ai/mastra/commit/01f88783de25e4de048c1c8aace43e26373c6ea5), [`4c77209`](https://github.com/mastra-ai/mastra/commit/4c77209e6c11678808b365d545845918c40045c8), [`d827d08`](https://github.com/mastra-ai/mastra/commit/d827d0808ffe1f3553a84e975806cc989b9735dd), [`23c10a1`](https://github.com/mastra-ai/mastra/commit/23c10a1efdd9a693c405511ab2dc8a1236603162), [`676ccc7`](https://github.com/mastra-ai/mastra/commit/676ccc7fe92468d2d45d39c31a87825c89fd1ea0), [`c10398d`](https://github.com/mastra-ai/mastra/commit/c10398d5b88f1d4af556f4267ff06f1d11e89179), [`00c2387`](https://github.com/mastra-ai/mastra/commit/00c2387f5f04a365316f851e58666ac43f8c4edf), [`ad6250d`](https://github.com/mastra-ai/mastra/commit/ad6250dbdaad927e29f74a27b83f6c468b50a705), [`3a73998`](https://github.com/mastra-ai/mastra/commit/3a73998fa4ebeb7f3dc9301afe78095fc63e7999), [`e16d553`](https://github.com/mastra-ai/mastra/commit/e16d55338403c7553531cc568125c63d53653dff), [`4d59f58`](https://github.com/mastra-ai/mastra/commit/4d59f58de2d90d6e2810a19d4518e38ddddb9038), [`e1bb9c9`](https://github.com/mastra-ai/mastra/commit/e1bb9c94b4eb68b019ae275981be3feb769b5365), [`351a11f`](https://github.com/mastra-ai/mastra/commit/351a11fcaf2ed1008977fa9b9a489fc422e51cd4)]:
  - @mastra/core@1.0.0-beta.3
  - @mastra/deployer@1.0.0-beta.3
  - @mastra/loggers@1.0.0-beta.1

## 1.0.0-beta.1

### Patch Changes

- Make MainSidebar toggle button sticky to bottom, always visible ([#9682](https://github.com/mastra-ai/mastra/pull/9682))

- Fixes an error during `mastra create` with bun/yarn due to usage of `--save-dev`. Replaced with `-D` during installation. ([#9879](https://github.com/mastra-ai/mastra/pull/9879))

- Updated dependencies [[`ac32ca9`](https://github.com/mastra-ai/mastra/commit/ac32ca968fb906f6c61fd7b4a194323bcb2f3daa), [`910db9e`](https://github.com/mastra-ai/mastra/commit/910db9e0312888495eb5617b567f247d03303814), [`e7266a2`](https://github.com/mastra-ai/mastra/commit/e7266a278db02035c97a5e9cd9d1669a6b7a535d)]:
  - @mastra/deployer@1.0.0-beta.1
  - @mastra/core@1.0.0-beta.1

## 1.0.0-beta.0

### Major Changes

- Moving scorers under the eval domain, api method consistency, prebuilt evals, scorers require ids. ([#9589](https://github.com/mastra-ai/mastra/pull/9589))

- Bump minimum required Node.js version to 22.13.0 ([#9706](https://github.com/mastra-ai/mastra/pull/9706))

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

- Mark as stable ([`83d5942`](https://github.com/mastra-ai/mastra/commit/83d5942669ce7bba4a6ca4fd4da697a10eb5ebdc))

- Remove legacy evals from Mastra ([#9491](https://github.com/mastra-ai/mastra/pull/9491))

### Minor Changes

- Update peer dependencies to match core package version bump (1.0.0) ([#9237](https://github.com/mastra-ai/mastra/pull/9237))

### Patch Changes

- Use dynamic model for scorers in create cli ([#9188](https://github.com/mastra-ai/mastra/pull/9188))

- Update MainSidebar component to fit required changes in Cloud CTA link ([#9318](https://github.com/mastra-ai/mastra/pull/9318))

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

- Update CLI start server command ([#9757](https://github.com/mastra-ai/mastra/pull/9757))

- Fixes issue where clicking the reset button in the model picker would fail to restore the original LanguageModelV2 (or any other types) object that was passed during agent construction. ([#9481](https://github.com/mastra-ai/mastra/pull/9481))

- update translation scorer template to use util methods to get user and assistant message ([#9761](https://github.com/mastra-ai/mastra/pull/9761))

- Fix e2e test compatibility by passing version tags to all Mastra package installations. The `init` function now accepts an optional `versionTag` parameter that ensures all installed Mastra packages (`@mastra/evals`, `@mastra/libsql`, `@mastra/memory`, `@mastra/loggers`, `@mastra/observability`) use the same version, preventing module resolution errors when packages are updated with breaking internal changes. ([#9540](https://github.com/mastra-ai/mastra/pull/9540))

- Use a shared `getAllToolPaths()` method from the bundler to discover tool paths. ([#9204](https://github.com/mastra-ai/mastra/pull/9204))

- Better handle errors during `mastra start` and throw them with Mastra's logger. Also add special error handling for `ERR_MODULE_NOT_FOUND` cases. ([#9127](https://github.com/mastra-ai/mastra/pull/9127))

- Make sure that `mastra init` also installs the `mastra` CLI package (if not already installed) ([#9179](https://github.com/mastra-ai/mastra/pull/9179))

- Add `@mastra/observability` to starter project dependencies ([#9175](https://github.com/mastra-ai/mastra/pull/9175))

- Updated dependencies [[`77ff370`](https://github.com/mastra-ai/mastra/commit/77ff370186ba77955620c465fd2e95360e1947ea), [`39c9743`](https://github.com/mastra-ai/mastra/commit/39c97432d084294f8ba85fbf3ef28098ff21459e), [`f743dbb`](https://github.com/mastra-ai/mastra/commit/f743dbb8b40d1627b5c10c0e6fc154f4ebb6e394), [`3852192`](https://github.com/mastra-ai/mastra/commit/3852192c81b2a4f1f883f17d80ce50e0c60dba55), [`fec5129`](https://github.com/mastra-ai/mastra/commit/fec5129de7fc64423ea03661a56cef31dc747a0d), [`5540775`](https://github.com/mastra-ai/mastra/commit/5540775f68685e19ddb6972ad73297f117656f59), [`0491e7c`](https://github.com/mastra-ai/mastra/commit/0491e7c9b714cb0ba22187ee062147ec2dd7c712), [`f6f4903`](https://github.com/mastra-ai/mastra/commit/f6f4903397314f73362061dc5a3e8e7c61ea34aa), [`0e8ed46`](https://github.com/mastra-ai/mastra/commit/0e8ed467c54d6901a6a365f270ec15d6faadb36c), [`6c049d9`](https://github.com/mastra-ai/mastra/commit/6c049d94063fdcbd5b81c4912a2bf82a92c9cc0b), [`2f897df`](https://github.com/mastra-ai/mastra/commit/2f897df208508f46f51b7625e5dd20c37f93e0e3), [`f0f8f12`](https://github.com/mastra-ai/mastra/commit/f0f8f125c308f2d0fd36942ef652fd852df7522f), [`3443770`](https://github.com/mastra-ai/mastra/commit/3443770662df8eb24c9df3589b2792d78cfcb811), [`f0a07e0`](https://github.com/mastra-ai/mastra/commit/f0a07e0111b3307c5fabfa4094c5c2cfb734fbe6), [`aaa40e7`](https://github.com/mastra-ai/mastra/commit/aaa40e788628b319baa8e889407d11ad626547fa), [`1521d71`](https://github.com/mastra-ai/mastra/commit/1521d716e5daedc74690c983fbd961123c56756b), [`9e1911d`](https://github.com/mastra-ai/mastra/commit/9e1911db2b4db85e0e768c3f15e0d61e319869f6), [`ebac155`](https://github.com/mastra-ai/mastra/commit/ebac15564a590117db7078233f927a7e28a85106), [`dd1c38d`](https://github.com/mastra-ai/mastra/commit/dd1c38d1b75f1b695c27b40d8d9d6ed00d5e0f6f), [`5948e6a`](https://github.com/mastra-ai/mastra/commit/5948e6a5146c83666ba3f294b2be576c82a513fb), [`2ef1f3c`](https://github.com/mastra-ai/mastra/commit/2ef1f3cc1f9785998197571478821326b2a528ee), [`8940859`](https://github.com/mastra-ai/mastra/commit/89408593658199b4ad67f7b65e888f344e64a442), [`f0f8f12`](https://github.com/mastra-ai/mastra/commit/f0f8f125c308f2d0fd36942ef652fd852df7522f), [`e629310`](https://github.com/mastra-ai/mastra/commit/e629310f1a73fa236d49ec7a1d1cceb6229dc7cc), [`5df9cce`](https://github.com/mastra-ai/mastra/commit/5df9cce1a753438413f64c11eeef8f845745c2a8), [`4c6b492`](https://github.com/mastra-ai/mastra/commit/4c6b492c4dd591c6a592520c1f6855d6e936d71f), [`dff01d8`](https://github.com/mastra-ai/mastra/commit/dff01d81ce1f4e4087cfac20fa868e6db138dd14), [`9d819d5`](https://github.com/mastra-ai/mastra/commit/9d819d54b61481639f4008e4694791bddf187edd), [`b7de533`](https://github.com/mastra-ai/mastra/commit/b7de53361667eb51fefd89fcaed924f3c57cee8d), [`71c8d6c`](https://github.com/mastra-ai/mastra/commit/71c8d6c161253207b2b9588bdadb7eed604f7253), [`6179a9b`](https://github.com/mastra-ai/mastra/commit/6179a9ba36ffac326de3cc3c43cdc8028d37c251), [`00f4921`](https://github.com/mastra-ai/mastra/commit/00f4921dd2c91a1e5446799599ef7116a8214a1a), [`ca8041c`](https://github.com/mastra-ai/mastra/commit/ca8041cce0379fda22ed293a565bcb5b6ddca68a), [`7051bf3`](https://github.com/mastra-ai/mastra/commit/7051bf38b3b122a069008f861f7bfc004a6d9f6e), [`a8f1494`](https://github.com/mastra-ai/mastra/commit/a8f1494f4bbdc2770bcf327d4c7d869e332183f1), [`0793497`](https://github.com/mastra-ai/mastra/commit/079349753620c40246ffd673e3f9d7d9820beff3), [`5df9cce`](https://github.com/mastra-ai/mastra/commit/5df9cce1a753438413f64c11eeef8f845745c2a8), [`a854ede`](https://github.com/mastra-ai/mastra/commit/a854ede62bf5ac0945a624ac48913dd69c73aabf), [`c576fc0`](https://github.com/mastra-ai/mastra/commit/c576fc0b100b2085afded91a37c97a0ea0ec09c7), [`3defc80`](https://github.com/mastra-ai/mastra/commit/3defc80cf2b88a1b7fc1cc4ddcb91e982a614609), [`16153fe`](https://github.com/mastra-ai/mastra/commit/16153fe7eb13c99401f48e6ca32707c965ee28b9), [`9f4a683`](https://github.com/mastra-ai/mastra/commit/9f4a6833e88b52574665c028fd5508ad5c2f6004), [`bc94344`](https://github.com/mastra-ai/mastra/commit/bc943444a1342d8a662151b7bce1df7dae32f59c), [`87f9f96`](https://github.com/mastra-ai/mastra/commit/87f9f96c772117fb868c9ea17a9eda664d41a35e), [`57d157f`](https://github.com/mastra-ai/mastra/commit/57d157f0b163a95c3e6c9eae31bdb11d1bfc64f9), [`903f67d`](https://github.com/mastra-ai/mastra/commit/903f67d184504a273893818c02b961f5423a79ad), [`2a90c55`](https://github.com/mastra-ai/mastra/commit/2a90c55a86a9210697d5adaab5ee94584b079adc), [`eb09742`](https://github.com/mastra-ai/mastra/commit/eb09742197f66c4c38154c3beec78313e69760b2), [`9e0a85d`](https://github.com/mastra-ai/mastra/commit/9e0a85d11d02ca5918463ab5c2ec55d4eebf3769), [`96d35f6`](https://github.com/mastra-ai/mastra/commit/96d35f61376bc2b1bf148648a2c1985bd51bef55), [`5cbe88a`](https://github.com/mastra-ai/mastra/commit/5cbe88aefbd9f933bca669fd371ea36bf939ac6d), [`a1bd7b8`](https://github.com/mastra-ai/mastra/commit/a1bd7b8571db16b94eb01588f451a74758c96d65), [`d78b38d`](https://github.com/mastra-ai/mastra/commit/d78b38d898fce285260d3bbb4befade54331617f), [`e41f852`](https://github.com/mastra-ai/mastra/commit/e41f852a3068be9c65818d9ab2218bae06ed0237), [`c576fc0`](https://github.com/mastra-ai/mastra/commit/c576fc0b100b2085afded91a37c97a0ea0ec09c7), [`0633100`](https://github.com/mastra-ai/mastra/commit/0633100a911ad22f5256471bdf753da21c104742), [`c710c16`](https://github.com/mastra-ai/mastra/commit/c710c1652dccfdc4111c8412bca7a6bb1d48b441), [`354ad0b`](https://github.com/mastra-ai/mastra/commit/354ad0b7b1b8183ac567f236a884fc7ede6d7138), [`cfae733`](https://github.com/mastra-ai/mastra/commit/cfae73394f4920635e6c919c8e95ff9a0788e2e5), [`e3dfda7`](https://github.com/mastra-ai/mastra/commit/e3dfda7b11bf3b8c4bb55637028befb5f387fc74), [`844ea5d`](https://github.com/mastra-ai/mastra/commit/844ea5dc0c248961e7bf73629ae7dcff503e853c), [`398fde3`](https://github.com/mastra-ai/mastra/commit/398fde3f39e707cda79372cdae8f9870e3b57c8d), [`dfe3f8c`](https://github.com/mastra-ai/mastra/commit/dfe3f8c7376ffe159236819e19ca522143c1f972), [`f0f8f12`](https://github.com/mastra-ai/mastra/commit/f0f8f125c308f2d0fd36942ef652fd852df7522f), [`0d7618b`](https://github.com/mastra-ai/mastra/commit/0d7618bc650bf2800934b243eca5648f4aeed9c2), [`7b763e5`](https://github.com/mastra-ai/mastra/commit/7b763e52fc3eaf699c2a99f2adf418dd46e4e9a5), [`d36cfbb`](https://github.com/mastra-ai/mastra/commit/d36cfbbb6565ba5f827883cc9bb648eb14befdc1), [`3697853`](https://github.com/mastra-ai/mastra/commit/3697853deeb72017d90e0f38a93c1e29221aeca0), [`c23200d`](https://github.com/mastra-ai/mastra/commit/c23200ddfd60830effb39329674ba4ca93be6aac), [`b2e45ec`](https://github.com/mastra-ai/mastra/commit/b2e45eca727a8db01a81ba93f1a5219c7183c839), [`d6d49f7`](https://github.com/mastra-ai/mastra/commit/d6d49f7b8714fa19a52ff9c7cf7fb7e73751901e), [`a534e95`](https://github.com/mastra-ai/mastra/commit/a534e9591f83b3cc1ebff99c67edf4cda7bf81d3), [`9d0e7fe`](https://github.com/mastra-ai/mastra/commit/9d0e7feca8ed98de959f53476ee1456073673348), [`53d927c`](https://github.com/mastra-ai/mastra/commit/53d927cc6f03bff33655b7e2b788da445a08731d), [`3f2faf2`](https://github.com/mastra-ai/mastra/commit/3f2faf2e2d685d6c053cc5af1bf9fedf267b2ce5), [`22f64bc`](https://github.com/mastra-ai/mastra/commit/22f64bc1d37149480b58bf2fefe35b79a1e3e7d5), [`363284b`](https://github.com/mastra-ai/mastra/commit/363284bb974e850f06f40f89a28c79d9f432d7e4), [`6c7ffcd`](https://github.com/mastra-ai/mastra/commit/6c7ffcdf9a5b0a4435eb3f934c22c05b9e2fedb3), [`83d5942`](https://github.com/mastra-ai/mastra/commit/83d5942669ce7bba4a6ca4fd4da697a10eb5ebdc), [`b7959e6`](https://github.com/mastra-ai/mastra/commit/b7959e6e25a46b480f9ea2217c4c6c588c423791), [`bda6370`](https://github.com/mastra-ai/mastra/commit/bda637009360649aaf579919e7873e33553c273e), [`d7acd8e`](https://github.com/mastra-ai/mastra/commit/d7acd8e987b5d7eff4fd98b0906c17c06a2e83d5), [`056d075`](https://github.com/mastra-ai/mastra/commit/056d075598761a47c4f6f48c0ba8f793ca915c7f), [`c7f1f7d`](https://github.com/mastra-ai/mastra/commit/c7f1f7d24f61f247f018cc2d1f33bf63212959a7), [`0bddc6d`](https://github.com/mastra-ai/mastra/commit/0bddc6d8dbd6f6008c0cba2e4960a2da75a55af1), [`4a8cade`](https://github.com/mastra-ai/mastra/commit/4a8cade69b4616da04d78e6f76649b52d843997e), [`735d8c1`](https://github.com/mastra-ai/mastra/commit/735d8c1c0d19fbc09e6f8b66cf41bc7655993838), [`acf322e`](https://github.com/mastra-ai/mastra/commit/acf322e0f1fd0189684cf529d91c694bea918a45), [`c942802`](https://github.com/mastra-ai/mastra/commit/c942802a477a925b01859a7b8688d4355715caaa), [`a0c8c1b`](https://github.com/mastra-ai/mastra/commit/a0c8c1b87d4fee252aebda73e8637fbe01d761c9), [`cc34739`](https://github.com/mastra-ai/mastra/commit/cc34739c34b6266a91bea561119240a7acf47887), [`c218bd3`](https://github.com/mastra-ai/mastra/commit/c218bd3759e32423735b04843a09404572631014), [`2c4438b`](https://github.com/mastra-ai/mastra/commit/2c4438b87817ab7eed818c7990fef010475af1a3), [`2b8893c`](https://github.com/mastra-ai/mastra/commit/2b8893cb108ef9acb72ee7835cd625610d2c1a4a), [`8e5c75b`](https://github.com/mastra-ai/mastra/commit/8e5c75bdb1d08a42d45309a4c72def4b6890230f), [`e59e0d3`](https://github.com/mastra-ai/mastra/commit/e59e0d32afb5fcf2c9f3c00c8f81f6c21d3a63fa), [`fa8409b`](https://github.com/mastra-ai/mastra/commit/fa8409bc39cfd8ba6643b9db5269b90b22e2a2f7), [`173c535`](https://github.com/mastra-ai/mastra/commit/173c535c0645b0da404fe09f003778f0b0d4e019), [`1176e03`](https://github.com/mastra-ai/mastra/commit/1176e03a0db4b8f5b0a85afbaf45d3cc7ab2d94a)]:
  - @mastra/deployer@1.0.0-beta.0
  - @mastra/core@1.0.0-beta.0
  - @mastra/loggers@1.0.0-beta.0

## 0.17.3

### Patch Changes

- Updated dependencies [[`2b031e2`](https://github.com/mastra-ai/mastra/commit/2b031e25ca10cd3e4d63e6a27f909cba26d91405)]:
  - @mastra/core@0.22.2
  - @mastra/deployer@0.22.2

## 0.17.3-alpha.0

### Patch Changes

- Updated dependencies [[`2b031e2`](https://github.com/mastra-ai/mastra/commit/2b031e25ca10cd3e4d63e6a27f909cba26d91405)]:
  - @mastra/core@0.22.2-alpha.0
  - @mastra/deployer@0.22.2-alpha.0

## 0.17.2

### Patch Changes

- Fix a bug where `mastra init` didn't work correctly when core dependencies were missing in the project ([#9070](https://github.com/mastra-ai/mastra/pull/9070))

- Updated dependencies [[`69ff5d5`](https://github.com/mastra-ai/mastra/commit/69ff5d58e4bc4054ce76bbb25a8fa5d3177c49ea)]:
  - @mastra/deployer@0.22.1
  - @mastra/core@0.22.1

## 0.17.2-alpha.0

### Patch Changes

- Fix a bug where `mastra init` didn't work correctly when core dependencies were missing in the project ([#9070](https://github.com/mastra-ai/mastra/pull/9070))

- Updated dependencies [[`69ff5d5`](https://github.com/mastra-ai/mastra/commit/69ff5d58e4bc4054ce76bbb25a8fa5d3177c49ea)]:
  - @mastra/deployer@0.22.1-alpha.0
  - @mastra/core@0.22.1-alpha.0

## 0.17.1

### Patch Changes

- Add scorers to the default weather agent in the create command. ([#9042](https://github.com/mastra-ai/mastra/pull/9042))

- Fix tool result in playground ([#9087](https://github.com/mastra-ai/mastra/pull/9087))

- Use newer model id for anthropic during `create-mastra` ([#8996](https://github.com/mastra-ai/mastra/pull/8996))

- Update peerdeps to 0.23.0-0 ([#9043](https://github.com/mastra-ai/mastra/pull/9043))

- Updated dependencies [[`25305a2`](https://github.com/mastra-ai/mastra/commit/25305a2af1acf77cc2ac9237774ecd7d3caa31a1), [`c67ca32`](https://github.com/mastra-ai/mastra/commit/c67ca32e3c2cf69bfc146580770c720220ca44ac), [`efb5ed9`](https://github.com/mastra-ai/mastra/commit/efb5ed946ae7f410bc68c9430beb4b010afd25ec), [`dbc9e12`](https://github.com/mastra-ai/mastra/commit/dbc9e1216ba575ba59ead4afb727a01215f7de4f), [`99e41b9`](https://github.com/mastra-ai/mastra/commit/99e41b94957cdd25137d3ac12e94e8b21aa01b68), [`c28833c`](https://github.com/mastra-ai/mastra/commit/c28833c5b6d8e10eeffd7f7d39129d53b8bca240), [`8ea07b4`](https://github.com/mastra-ai/mastra/commit/8ea07b4bdc73e4218437dbb6dcb0f4b23e745a44), [`ba201b8`](https://github.com/mastra-ai/mastra/commit/ba201b8f8feac4c72350f2dbd52c13c7297ba7b0), [`f053e89`](https://github.com/mastra-ai/mastra/commit/f053e89160dbd0bd3333fc3492f68231b5c7c349), [`4fc4136`](https://github.com/mastra-ai/mastra/commit/4fc413652866a8d2240694fddb2562e9edbb70df), [`b78e04d`](https://github.com/mastra-ai/mastra/commit/b78e04d935a16ecb1e59c5c96e564903527edddd), [`d10baf5`](https://github.com/mastra-ai/mastra/commit/d10baf5a3c924f2a6654e23a3e318ed03f189b76), [`038c55a`](https://github.com/mastra-ai/mastra/commit/038c55a7090fc1b1513a966386d3072617f836ac), [`1eb156a`](https://github.com/mastra-ai/mastra/commit/1eb156ace499b34ab48bf23fb16f1affe6bb9c1c), [`182f045`](https://github.com/mastra-ai/mastra/commit/182f0458f25bd70aa774e64fd923c8a483eddbf1), [`9a1a485`](https://github.com/mastra-ai/mastra/commit/9a1a4859b855e37239f652bf14b1ecd1029b8c4e), [`9257233`](https://github.com/mastra-ai/mastra/commit/9257233c4ffce09b2bedc2a9adbd70d7a83fa8e2), [`7620d2b`](https://github.com/mastra-ai/mastra/commit/7620d2bddeb4fae4c3c0a0b4e672969795fca11a), [`b2365f0`](https://github.com/mastra-ai/mastra/commit/b2365f038dd4c5f06400428b224af963f399ad50), [`0f1a4c9`](https://github.com/mastra-ai/mastra/commit/0f1a4c984fb4b104b2f0b63ba18c9fa77f567700), [`9029ba3`](https://github.com/mastra-ai/mastra/commit/9029ba34459c8859fed4c6b73efd8e2d0021e7ba), [`426cc56`](https://github.com/mastra-ai/mastra/commit/426cc561c85ae76a112ded2385532a91f9f9f074), [`00931fb`](https://github.com/mastra-ai/mastra/commit/00931fb1a21aa42c4fbc20c2c40dd62466b8fc8f), [`e473bfe`](https://github.com/mastra-ai/mastra/commit/e473bfe416c0b8e876973c2b6a6f13c394b7a93f), [`b78e04d`](https://github.com/mastra-ai/mastra/commit/b78e04d935a16ecb1e59c5c96e564903527edddd), [`8ea07b4`](https://github.com/mastra-ai/mastra/commit/8ea07b4bdc73e4218437dbb6dcb0f4b23e745a44), [`084afad`](https://github.com/mastra-ai/mastra/commit/084afadff49b168d8b6104b43c77cecc96c48ac2), [`2db6160`](https://github.com/mastra-ai/mastra/commit/2db6160e2022ff8827c15d30157e684683b934b5), [`8aeea37`](https://github.com/mastra-ai/mastra/commit/8aeea37efdde347c635a67fed56794943b7f74ec), [`02fe153`](https://github.com/mastra-ai/mastra/commit/02fe15351d6021d214da48ec982a0e9e4150bcee), [`648e2ca`](https://github.com/mastra-ai/mastra/commit/648e2ca42da54838c6ccbdaadc6fadd808fa6b86), [`74567b3`](https://github.com/mastra-ai/mastra/commit/74567b3d237ae3915cd0bca3cf55fa0a64e4e4a4), [`b65c5e0`](https://github.com/mastra-ai/mastra/commit/b65c5e0fe6f3c390a9a8bbcf69304d972c3a4afb), [`15a1733`](https://github.com/mastra-ai/mastra/commit/15a1733074cee8bd37370e1af34cd818e89fa7ac), [`fc2a774`](https://github.com/mastra-ai/mastra/commit/fc2a77468981aaddc3e77f83f0c4ad4a4af140da), [`4e08933`](https://github.com/mastra-ai/mastra/commit/4e08933625464dfde178347af5b6278fcf34188e), [`10188d6`](https://github.com/mastra-ai/mastra/commit/10188d632a729010441f9c7e2a41eab60afccb23)]:
  - @mastra/deployer@0.22.0
  - @mastra/core@0.22.0
  - @mastra/loggers@0.10.17

## 0.17.1-alpha.1

### Patch Changes

- Add scorers to the default weather agent in the create command. ([#9042](https://github.com/mastra-ai/mastra/pull/9042))

- Fix tool result in playground ([#9087](https://github.com/mastra-ai/mastra/pull/9087))

- Update peerdeps to 0.23.0-0 ([#9043](https://github.com/mastra-ai/mastra/pull/9043))

- Updated dependencies [[`25305a2`](https://github.com/mastra-ai/mastra/commit/25305a2af1acf77cc2ac9237774ecd7d3caa31a1), [`efb5ed9`](https://github.com/mastra-ai/mastra/commit/efb5ed946ae7f410bc68c9430beb4b010afd25ec), [`8ea07b4`](https://github.com/mastra-ai/mastra/commit/8ea07b4bdc73e4218437dbb6dcb0f4b23e745a44), [`ba201b8`](https://github.com/mastra-ai/mastra/commit/ba201b8f8feac4c72350f2dbd52c13c7297ba7b0), [`4fc4136`](https://github.com/mastra-ai/mastra/commit/4fc413652866a8d2240694fddb2562e9edbb70df), [`b78e04d`](https://github.com/mastra-ai/mastra/commit/b78e04d935a16ecb1e59c5c96e564903527edddd), [`d10baf5`](https://github.com/mastra-ai/mastra/commit/d10baf5a3c924f2a6654e23a3e318ed03f189b76), [`038c55a`](https://github.com/mastra-ai/mastra/commit/038c55a7090fc1b1513a966386d3072617f836ac), [`182f045`](https://github.com/mastra-ai/mastra/commit/182f0458f25bd70aa774e64fd923c8a483eddbf1), [`7620d2b`](https://github.com/mastra-ai/mastra/commit/7620d2bddeb4fae4c3c0a0b4e672969795fca11a), [`b2365f0`](https://github.com/mastra-ai/mastra/commit/b2365f038dd4c5f06400428b224af963f399ad50), [`9029ba3`](https://github.com/mastra-ai/mastra/commit/9029ba34459c8859fed4c6b73efd8e2d0021e7ba), [`426cc56`](https://github.com/mastra-ai/mastra/commit/426cc561c85ae76a112ded2385532a91f9f9f074), [`00931fb`](https://github.com/mastra-ai/mastra/commit/00931fb1a21aa42c4fbc20c2c40dd62466b8fc8f), [`e473bfe`](https://github.com/mastra-ai/mastra/commit/e473bfe416c0b8e876973c2b6a6f13c394b7a93f), [`b78e04d`](https://github.com/mastra-ai/mastra/commit/b78e04d935a16ecb1e59c5c96e564903527edddd), [`8ea07b4`](https://github.com/mastra-ai/mastra/commit/8ea07b4bdc73e4218437dbb6dcb0f4b23e745a44), [`084afad`](https://github.com/mastra-ai/mastra/commit/084afadff49b168d8b6104b43c77cecc96c48ac2), [`648e2ca`](https://github.com/mastra-ai/mastra/commit/648e2ca42da54838c6ccbdaadc6fadd808fa6b86), [`b65c5e0`](https://github.com/mastra-ai/mastra/commit/b65c5e0fe6f3c390a9a8bbcf69304d972c3a4afb), [`10188d6`](https://github.com/mastra-ai/mastra/commit/10188d632a729010441f9c7e2a41eab60afccb23)]:
  - @mastra/deployer@0.22.0-alpha.1
  - @mastra/core@0.22.0-alpha.1
  - @mastra/loggers@0.10.17-alpha.0

## 0.17.1-alpha.0

### Patch Changes

- Use newer model id for anthropic during `create-mastra` ([#8996](https://github.com/mastra-ai/mastra/pull/8996))

- Updated dependencies [[`c67ca32`](https://github.com/mastra-ai/mastra/commit/c67ca32e3c2cf69bfc146580770c720220ca44ac), [`dbc9e12`](https://github.com/mastra-ai/mastra/commit/dbc9e1216ba575ba59ead4afb727a01215f7de4f), [`99e41b9`](https://github.com/mastra-ai/mastra/commit/99e41b94957cdd25137d3ac12e94e8b21aa01b68), [`c28833c`](https://github.com/mastra-ai/mastra/commit/c28833c5b6d8e10eeffd7f7d39129d53b8bca240), [`f053e89`](https://github.com/mastra-ai/mastra/commit/f053e89160dbd0bd3333fc3492f68231b5c7c349), [`1eb156a`](https://github.com/mastra-ai/mastra/commit/1eb156ace499b34ab48bf23fb16f1affe6bb9c1c), [`9a1a485`](https://github.com/mastra-ai/mastra/commit/9a1a4859b855e37239f652bf14b1ecd1029b8c4e), [`9257233`](https://github.com/mastra-ai/mastra/commit/9257233c4ffce09b2bedc2a9adbd70d7a83fa8e2), [`0f1a4c9`](https://github.com/mastra-ai/mastra/commit/0f1a4c984fb4b104b2f0b63ba18c9fa77f567700), [`2db6160`](https://github.com/mastra-ai/mastra/commit/2db6160e2022ff8827c15d30157e684683b934b5), [`8aeea37`](https://github.com/mastra-ai/mastra/commit/8aeea37efdde347c635a67fed56794943b7f74ec), [`02fe153`](https://github.com/mastra-ai/mastra/commit/02fe15351d6021d214da48ec982a0e9e4150bcee), [`74567b3`](https://github.com/mastra-ai/mastra/commit/74567b3d237ae3915cd0bca3cf55fa0a64e4e4a4), [`15a1733`](https://github.com/mastra-ai/mastra/commit/15a1733074cee8bd37370e1af34cd818e89fa7ac), [`fc2a774`](https://github.com/mastra-ai/mastra/commit/fc2a77468981aaddc3e77f83f0c4ad4a4af140da), [`4e08933`](https://github.com/mastra-ai/mastra/commit/4e08933625464dfde178347af5b6278fcf34188e)]:
  - @mastra/core@0.21.2-alpha.0
  - @mastra/deployer@0.21.2-alpha.0

## 0.17.0

### Minor Changes

- - Remove the `mastra deploy` CLI command. Use the deploy instructions of your individual platform. ([#8798](https://github.com/mastra-ai/mastra/pull/8798))
  - Remove `--env` flag from `mastra build` command
  - Remove `--port` flag from `mastra dev`. Use `server.port` on the `new Mastra()` class instead.
  - Validate `--components` and `--llm` flags for `mastra create` and `mastra init`

### Patch Changes

- Updated dependencies [[`5253cd2`](https://github.com/mastra-ai/mastra/commit/5253cd2d5b2cf4558963fa73c6a6b36c72f8875f), [`ca85c93`](https://github.com/mastra-ai/mastra/commit/ca85c932b232e6ad820c811ec176d98e68c59b0a), [`a1d40f8`](https://github.com/mastra-ai/mastra/commit/a1d40f88d4ce42c4508774ad22e38ac582157af2), [`11e9e8f`](https://github.com/mastra-ai/mastra/commit/11e9e8f4fb09a493ea00deda49081788f16e753b), [`00bf52b`](https://github.com/mastra-ai/mastra/commit/00bf52b89a93e6bffaaaf1714316870ad8af6572), [`01c4a25`](https://github.com/mastra-ai/mastra/commit/01c4a2506c514d5e861c004d3d2fb3791c6391f3), [`cce8aad`](https://github.com/mastra-ai/mastra/commit/cce8aad878a0dd98e5647680f3765caba0b1701c)]:
  - @mastra/deployer@0.21.1
  - @mastra/core@0.21.1

## 0.17.0-alpha.0

### Minor Changes

- - Remove the `mastra deploy` CLI command. Use the deploy instructions of your individual platform. ([#8798](https://github.com/mastra-ai/mastra/pull/8798))
  - Remove `--env` flag from `mastra build` command
  - Remove `--port` flag from `mastra dev`. Use `server.port` on the `new Mastra()` class instead.
  - Validate `--components` and `--llm` flags for `mastra create` and `mastra init`

### Patch Changes

- Updated dependencies [[`5253cd2`](https://github.com/mastra-ai/mastra/commit/5253cd2d5b2cf4558963fa73c6a6b36c72f8875f), [`ca85c93`](https://github.com/mastra-ai/mastra/commit/ca85c932b232e6ad820c811ec176d98e68c59b0a), [`a1d40f8`](https://github.com/mastra-ai/mastra/commit/a1d40f88d4ce42c4508774ad22e38ac582157af2), [`11e9e8f`](https://github.com/mastra-ai/mastra/commit/11e9e8f4fb09a493ea00deda49081788f16e753b), [`00bf52b`](https://github.com/mastra-ai/mastra/commit/00bf52b89a93e6bffaaaf1714316870ad8af6572), [`01c4a25`](https://github.com/mastra-ai/mastra/commit/01c4a2506c514d5e861c004d3d2fb3791c6391f3), [`cce8aad`](https://github.com/mastra-ai/mastra/commit/cce8aad878a0dd98e5647680f3765caba0b1701c)]:
  - @mastra/deployer@0.21.1-alpha.0
  - @mastra/core@0.21.1-alpha.0

## 0.16.0

### Minor Changes

- Update peer dependencies to match core package version bump (0.21.0) ([#8795](https://github.com/mastra-ai/mastra/pull/8795))

### Patch Changes

- Use model-router in create-mastra starter template ([#8631](https://github.com/mastra-ai/mastra/pull/8631))

- Fix typo in playground causing semantic recall to always be false when enabled. ([#8640](https://github.com/mastra-ai/mastra/pull/8640))

- Update peer dependencies to match core package version bump (0.21.0) ([#8619](https://github.com/mastra-ai/mastra/pull/8619))

- Create unified Sidebar component to use on Playground and Cloud ([#8655](https://github.com/mastra-ai/mastra/pull/8655))

- Use only zod validation in dynamic form ([#8802](https://github.com/mastra-ai/mastra/pull/8802))

- Add support for --debug options to build/dev commands to add more logging ([#8792](https://github.com/mastra-ai/mastra/pull/8792))

- Add div wrapper around entity tables to fix table vertical position ([#8758](https://github.com/mastra-ai/mastra/pull/8758))

- Update peer dependencies to match core package version bump (0.21.0) ([#8557](https://github.com/mastra-ai/mastra/pull/8557))

- Update peer dependencies to match core package version bump (0.21.0) ([#8626](https://github.com/mastra-ai/mastra/pull/8626))

- Customize AITraces type to seamlessly work on Cloud too ([#8759](https://github.com/mastra-ai/mastra/pull/8759))

- Refactor EntryList component and Scorer and Observability pages ([#8652](https://github.com/mastra-ai/mastra/pull/8652))

- Stream finalResult from network loop ([#8795](https://github.com/mastra-ai/mastra/pull/8795))

- Improve README ([#8819](https://github.com/mastra-ai/mastra/pull/8819))

- Update peer dependencies to match core package version bump (0.21.0) ([#8686](https://github.com/mastra-ai/mastra/pull/8686))

- Updated dependencies [[`0fb6616`](https://github.com/mastra-ai/mastra/commit/0fb66169600ed2a3dc1297b1bfa8a7693ebb6e3c), [`1ed9670`](https://github.com/mastra-ai/mastra/commit/1ed9670d3ca50cb60dc2e517738c5eef3968ed27), [`b5a66b7`](https://github.com/mastra-ai/mastra/commit/b5a66b748a14fc8b3f63b04642ddb9621fbcc9e0), [`1dbd76a`](https://github.com/mastra-ai/mastra/commit/1dbd76aff29cc764d3a1ac7bb01172fe59cb5992), [`f59fc1e`](https://github.com/mastra-ai/mastra/commit/f59fc1e406b8912e692f6bff6cfd4754cc8d165c), [`ca5a01f`](https://github.com/mastra-ai/mastra/commit/ca5a01f0dd4dabdbfde3beeaf92c7333e0f9bb39), [`158381d`](https://github.com/mastra-ai/mastra/commit/158381d39335be934b81ef8a1947bccace492c25), [`a1799bc`](https://github.com/mastra-ai/mastra/commit/a1799bcc1b5a1cdc188f2ac0165f17a1c4ac6f7b), [`6ff6094`](https://github.com/mastra-ai/mastra/commit/6ff60946f4ecfebdeef6e21d2b230c2204f2c9b8), [`2ddb851`](https://github.com/mastra-ai/mastra/commit/2ddb8519c4b6f1d31be10ffd33b41d2b649a04ff), [`fb703b9`](https://github.com/mastra-ai/mastra/commit/fb703b9634eeaff1a6eb2b5531ce0f9e8fb04727), [`dfe856f`](https://github.com/mastra-ai/mastra/commit/dfe856f7f60ff4765b75930e7b5d82dd0f0f7d89), [`37a2314`](https://github.com/mastra-ai/mastra/commit/37a23148e0e5a3b40d4f9f098b194671a8a49faf), [`7b1ef57`](https://github.com/mastra-ai/mastra/commit/7b1ef57fc071c2aa2a2e32905b18cd88719c5a39), [`7b1ef57`](https://github.com/mastra-ai/mastra/commit/7b1ef57fc071c2aa2a2e32905b18cd88719c5a39), [`05a9dee`](https://github.com/mastra-ai/mastra/commit/05a9dee3d355694d28847bfffb6289657fcf7dfa), [`e3c1077`](https://github.com/mastra-ai/mastra/commit/e3c107763aedd1643d3def5df450c235da9ff76c), [`1908ca0`](https://github.com/mastra-ai/mastra/commit/1908ca0521f90e43779cc29ab590173ca560443c), [`1bccdb3`](https://github.com/mastra-ai/mastra/commit/1bccdb33eb90cbeba2dc5ece1c2561fb774b26b6), [`5ef944a`](https://github.com/mastra-ai/mastra/commit/5ef944a3721d93105675cac2b2311432ff8cc393), [`228228b`](https://github.com/mastra-ai/mastra/commit/228228b0b1de9291cb8887587f5cea1a8757ebad), [`b5a66b7`](https://github.com/mastra-ai/mastra/commit/b5a66b748a14fc8b3f63b04642ddb9621fbcc9e0), [`d6b186f`](https://github.com/mastra-ai/mastra/commit/d6b186fb08f1caf1b86f73d3a5ee88fb999ca3be), [`ee68e82`](https://github.com/mastra-ai/mastra/commit/ee68e8289ea4408d29849e899bc6e78b3bd4e843), [`228228b`](https://github.com/mastra-ai/mastra/commit/228228b0b1de9291cb8887587f5cea1a8757ebad), [`ea33930`](https://github.com/mastra-ai/mastra/commit/ea339301e82d6318257720d811b043014ee44064), [`65493b3`](https://github.com/mastra-ai/mastra/commit/65493b31c36f6fdb78f9679f7e1ecf0c250aa5ee), [`a998b8f`](https://github.com/mastra-ai/mastra/commit/a998b8f858091c2ec47683e60766cf12d03001e4), [`b5a66b7`](https://github.com/mastra-ai/mastra/commit/b5a66b748a14fc8b3f63b04642ddb9621fbcc9e0), [`8a37bdd`](https://github.com/mastra-ai/mastra/commit/8a37bddb6d8614a32c5b70303d583d80c620ea61), [`7b1ef57`](https://github.com/mastra-ai/mastra/commit/7b1ef57fc071c2aa2a2e32905b18cd88719c5a39), [`e0e1cf1`](https://github.com/mastra-ai/mastra/commit/e0e1cf1e37b9dc61099ab331a6d386e44b816310), [`135d6f2`](https://github.com/mastra-ai/mastra/commit/135d6f22a326ed1dffff858700669dff09d2c9eb)]:
  - @mastra/deployer@0.21.0
  - @mastra/core@0.21.0
  - @mastra/loggers@0.10.16
  - @mastra/mcp@0.13.5

## 0.16.0-alpha.1

### Minor Changes

- Update peer dependencies to match core package version bump (0.21.0) ([#8795](https://github.com/mastra-ai/mastra/pull/8795))

### Patch Changes

- Create unified Sidebar component to use on Playground and Cloud ([#8655](https://github.com/mastra-ai/mastra/pull/8655))

- Use only zod validation in dynamic form ([#8802](https://github.com/mastra-ai/mastra/pull/8802))

- Add support for --debug options to build/dev commands to add more logging ([#8792](https://github.com/mastra-ai/mastra/pull/8792))

- Add div wrapper around entity tables to fix table vertical position ([#8758](https://github.com/mastra-ai/mastra/pull/8758))

- Customize AITraces type to seamlessly work on Cloud too ([#8759](https://github.com/mastra-ai/mastra/pull/8759))

- Stream finalResult from network loop ([#8795](https://github.com/mastra-ai/mastra/pull/8795))

- Improve README ([#8819](https://github.com/mastra-ai/mastra/pull/8819))

- Updated dependencies [[`1ed9670`](https://github.com/mastra-ai/mastra/commit/1ed9670d3ca50cb60dc2e517738c5eef3968ed27), [`ca5a01f`](https://github.com/mastra-ai/mastra/commit/ca5a01f0dd4dabdbfde3beeaf92c7333e0f9bb39), [`158381d`](https://github.com/mastra-ai/mastra/commit/158381d39335be934b81ef8a1947bccace492c25), [`fb703b9`](https://github.com/mastra-ai/mastra/commit/fb703b9634eeaff1a6eb2b5531ce0f9e8fb04727), [`dfe856f`](https://github.com/mastra-ai/mastra/commit/dfe856f7f60ff4765b75930e7b5d82dd0f0f7d89), [`37a2314`](https://github.com/mastra-ai/mastra/commit/37a23148e0e5a3b40d4f9f098b194671a8a49faf), [`05a9dee`](https://github.com/mastra-ai/mastra/commit/05a9dee3d355694d28847bfffb6289657fcf7dfa), [`e3c1077`](https://github.com/mastra-ai/mastra/commit/e3c107763aedd1643d3def5df450c235da9ff76c), [`1bccdb3`](https://github.com/mastra-ai/mastra/commit/1bccdb33eb90cbeba2dc5ece1c2561fb774b26b6), [`5ef944a`](https://github.com/mastra-ai/mastra/commit/5ef944a3721d93105675cac2b2311432ff8cc393), [`d6b186f`](https://github.com/mastra-ai/mastra/commit/d6b186fb08f1caf1b86f73d3a5ee88fb999ca3be), [`65493b3`](https://github.com/mastra-ai/mastra/commit/65493b31c36f6fdb78f9679f7e1ecf0c250aa5ee), [`a998b8f`](https://github.com/mastra-ai/mastra/commit/a998b8f858091c2ec47683e60766cf12d03001e4), [`8a37bdd`](https://github.com/mastra-ai/mastra/commit/8a37bddb6d8614a32c5b70303d583d80c620ea61), [`e0e1cf1`](https://github.com/mastra-ai/mastra/commit/e0e1cf1e37b9dc61099ab331a6d386e44b816310)]:
  - @mastra/core@0.21.0-alpha.1
  - @mastra/deployer@0.21.0-alpha.1

## 0.15.2-alpha.0

### Patch Changes

- Use model-router in create-mastra starter template ([#8631](https://github.com/mastra-ai/mastra/pull/8631))

- Fix typo in playground causing semantic recall to always be false when enabled. ([#8640](https://github.com/mastra-ai/mastra/pull/8640))

- Update peer dependencies to match core package version bump (0.21.0) ([#8619](https://github.com/mastra-ai/mastra/pull/8619))

- Update peer dependencies to match core package version bump (0.21.0) ([#8557](https://github.com/mastra-ai/mastra/pull/8557))

- Update peer dependencies to match core package version bump (0.21.0) ([#8626](https://github.com/mastra-ai/mastra/pull/8626))

- Refactor EntryList component and Scorer and Observability pages ([#8652](https://github.com/mastra-ai/mastra/pull/8652))

- Update peer dependencies to match core package version bump (0.21.0) ([#8686](https://github.com/mastra-ai/mastra/pull/8686))

- Updated dependencies [[`0fb6616`](https://github.com/mastra-ai/mastra/commit/0fb66169600ed2a3dc1297b1bfa8a7693ebb6e3c), [`b5a66b7`](https://github.com/mastra-ai/mastra/commit/b5a66b748a14fc8b3f63b04642ddb9621fbcc9e0), [`1dbd76a`](https://github.com/mastra-ai/mastra/commit/1dbd76aff29cc764d3a1ac7bb01172fe59cb5992), [`2ddb851`](https://github.com/mastra-ai/mastra/commit/2ddb8519c4b6f1d31be10ffd33b41d2b649a04ff), [`7b1ef57`](https://github.com/mastra-ai/mastra/commit/7b1ef57fc071c2aa2a2e32905b18cd88719c5a39), [`7b1ef57`](https://github.com/mastra-ai/mastra/commit/7b1ef57fc071c2aa2a2e32905b18cd88719c5a39), [`228228b`](https://github.com/mastra-ai/mastra/commit/228228b0b1de9291cb8887587f5cea1a8757ebad), [`b5a66b7`](https://github.com/mastra-ai/mastra/commit/b5a66b748a14fc8b3f63b04642ddb9621fbcc9e0), [`ee68e82`](https://github.com/mastra-ai/mastra/commit/ee68e8289ea4408d29849e899bc6e78b3bd4e843), [`228228b`](https://github.com/mastra-ai/mastra/commit/228228b0b1de9291cb8887587f5cea1a8757ebad), [`ea33930`](https://github.com/mastra-ai/mastra/commit/ea339301e82d6318257720d811b043014ee44064), [`b5a66b7`](https://github.com/mastra-ai/mastra/commit/b5a66b748a14fc8b3f63b04642ddb9621fbcc9e0), [`7b1ef57`](https://github.com/mastra-ai/mastra/commit/7b1ef57fc071c2aa2a2e32905b18cd88719c5a39), [`135d6f2`](https://github.com/mastra-ai/mastra/commit/135d6f22a326ed1dffff858700669dff09d2c9eb), [`59d036d`](https://github.com/mastra-ai/mastra/commit/59d036d4c2706b430b0e3f1f1e0ee853ce16ca04)]:
  - @mastra/deployer@0.21.0-alpha.0
  - @mastra/core@0.21.0-alpha.0
  - @mastra/loggers@0.10.16-alpha.0
  - @mastra/mcp@0.13.5-alpha.0

## 0.15.1

### Patch Changes

- Marked telemetry as disabled in the default template, in preperation for the Nov 4th deprecation. ([#8618](https://github.com/mastra-ai/mastra/pull/8618))

- Improve the overall flow of the `create-mastra` CLI by first asking all questions and then creating the project structure. If you skip entering an API key during the wizard, the `your-api-key` placeholder will now be added to an `.env.example` file instead of `.env`. ([#8603](https://github.com/mastra-ai/mastra/pull/8603))

- Updated dependencies [[`07eaf25`](https://github.com/mastra-ai/mastra/commit/07eaf25aada9e42235dbf905854de53da4d8121b), [`0d71771`](https://github.com/mastra-ai/mastra/commit/0d71771f5711164c79f8e80919bc84d6bffeb6bc), [`0d6e55e`](https://github.com/mastra-ai/mastra/commit/0d6e55ecc5a2e689cd4fc9c86525e0eb54d82372), [`68b1111`](https://github.com/mastra-ai/mastra/commit/68b11118a1303f93e9c0c157850c0751309304c5)]:
  - @mastra/core@0.20.2
  - @mastra/deployer@0.20.2

## 0.15.1-alpha.1

### Patch Changes

- Marked telemetry as disabled in the default template, in preperation for the Nov 4th deprecation. ([#8618](https://github.com/mastra-ai/mastra/pull/8618))

## 0.15.1-alpha.0

### Patch Changes

- Improve the overall flow of the `create-mastra` CLI by first asking all questions and then creating the project structure. If you skip entering an API key during the wizard, the `your-api-key` placeholder will now be added to an `.env.example` file instead of `.env`. ([#8603](https://github.com/mastra-ai/mastra/pull/8603))

- Updated dependencies [[`0d71771`](https://github.com/mastra-ai/mastra/commit/0d71771f5711164c79f8e80919bc84d6bffeb6bc), [`0d6e55e`](https://github.com/mastra-ai/mastra/commit/0d6e55ecc5a2e689cd4fc9c86525e0eb54d82372)]:
  - @mastra/core@0.20.2-alpha.0
  - @mastra/deployer@0.20.2-alpha.0

## 0.15.0

### Minor Changes

- Update peer dependencies to match core package version bump (0.20.1) ([#8589](https://github.com/mastra-ai/mastra/pull/8589))

### Patch Changes

- workflow run thread more visible ([#8539](https://github.com/mastra-ai/mastra/pull/8539))

- Mutable shared workflow run state ([#8545](https://github.com/mastra-ai/mastra/pull/8545))

- streamLegacy/generateLegacy clarification in playground ([#8468](https://github.com/mastra-ai/mastra/pull/8468))

- avoid refetching memory threads and messages on window focus ([#8519](https://github.com/mastra-ai/mastra/pull/8519))

- add tripwire reason in playground ([#8568](https://github.com/mastra-ai/mastra/pull/8568))

- Save waiting step status in snapshot ([#8576](https://github.com/mastra-ai/mastra/pull/8576))

- Added AI SDK provider packages to model router for anthropic/google/openai/openrouter/xai ([#8559](https://github.com/mastra-ai/mastra/pull/8559))

- Convert WorkflowWatchResult to WorkflowResult in workflow graph ([#8541](https://github.com/mastra-ai/mastra/pull/8541))

- add new deploy to cloud button ([#8549](https://github.com/mastra-ai/mastra/pull/8549))

- remove icons in entity lists ([#8520](https://github.com/mastra-ai/mastra/pull/8520))

- add client search to all entities ([#8523](https://github.com/mastra-ai/mastra/pull/8523))

- Fixed an issue where model router was adding /chat/completions to API urls when it shouldn't. ([#8589](https://github.com/mastra-ai/mastra/pull/8589))
  fixed an issue with provider ID rendering in playground UI

- Fix useStreamWorkflow unmounting breaking stream call ([#8449](https://github.com/mastra-ai/mastra/pull/8449))

- Remove shell from dev ([#8466](https://github.com/mastra-ai/mastra/pull/8466))

- UX for the agents page ([#8517](https://github.com/mastra-ai/mastra/pull/8517))

- add icons into playground titles + a link to the entity doc ([#8518](https://github.com/mastra-ai/mastra/pull/8518))

- Updated dependencies [[`c621613`](https://github.com/mastra-ai/mastra/commit/c621613069173c69eb2c3ef19a5308894c6549f0), [`ee17cec`](https://github.com/mastra-ai/mastra/commit/ee17cec065f4454740c9cc8f8a841027a5990f57), [`12b1189`](https://github.com/mastra-ai/mastra/commit/12b118942445e4de0dd916c593e33ec78dc3bc73), [`42ffed3`](https://github.com/mastra-ai/mastra/commit/42ffed311b9d8750652bbc55c773be62c989fcc6), [`4783b30`](https://github.com/mastra-ai/mastra/commit/4783b3063efea887825514b783ba27f67912c26d), [`076b092`](https://github.com/mastra-ai/mastra/commit/076b0924902ff0f49d5712d2df24c4cca683713f), [`2aee9e7`](https://github.com/mastra-ai/mastra/commit/2aee9e7d188b8b256a4ddc203ccefb366b4867fa), [`c582906`](https://github.com/mastra-ai/mastra/commit/c5829065a346260f96c4beb8af131b94804ae3ad), [`fa2eb96`](https://github.com/mastra-ai/mastra/commit/fa2eb96af16c7d433891a73932764960d3235c1d), [`ee9108f`](https://github.com/mastra-ai/mastra/commit/ee9108fa29bb8368fc23df158c9f0645b2d7b65c), [`4783b30`](https://github.com/mastra-ai/mastra/commit/4783b3063efea887825514b783ba27f67912c26d), [`a739d0c`](https://github.com/mastra-ai/mastra/commit/a739d0c8b37cd89569e04a6ca0827083c6167e19), [`a9c4cb7`](https://github.com/mastra-ai/mastra/commit/a9c4cb7d6a35de23ca51066f166a66e0e4cca418), [`603e927`](https://github.com/mastra-ai/mastra/commit/603e9279db8bf8a46caf83881c6b7389ccffff7e), [`cd45982`](https://github.com/mastra-ai/mastra/commit/cd4598291cda128a88738734ae6cbef076ebdebd), [`874f74d`](https://github.com/mastra-ai/mastra/commit/874f74da4b1acf6517f18132d035612c3ecc394a), [`b728a45`](https://github.com/mastra-ai/mastra/commit/b728a45ab3dba59da0f5ee36b81fe246659f305d), [`0baf2ba`](https://github.com/mastra-ai/mastra/commit/0baf2bab8420277072ef1f95df5ea7b0a2f61fe7), [`10e633a`](https://github.com/mastra-ai/mastra/commit/10e633a07d333466d9734c97acfc3dbf757ad2d0), [`a6d69c5`](https://github.com/mastra-ai/mastra/commit/a6d69c5fb50c0875b46275811fece5862f03c6a0), [`84199af`](https://github.com/mastra-ai/mastra/commit/84199af8673f6f9cb59286ffb5477a41932775de), [`7f431af`](https://github.com/mastra-ai/mastra/commit/7f431afd586b7d3265075e73106eb73167edbb86), [`26e968d`](https://github.com/mastra-ai/mastra/commit/26e968db2171ded9e4d47aa1b4f19e1e771158d0), [`cbd3fb6`](https://github.com/mastra-ai/mastra/commit/cbd3fb65adb03a7c0df193cb998aed5ac56675ee)]:
  - @mastra/core@0.20.1
  - @mastra/deployer@0.20.1
  - @mastra/mcp@0.13.4

## 0.15.0-alpha.3

### Minor Changes

- Update peer dependencies to match core package version bump (0.20.1) ([#8589](https://github.com/mastra-ai/mastra/pull/8589))

### Patch Changes

- Fixed an issue where model router was adding /chat/completions to API urls when it shouldn't. ([#8589](https://github.com/mastra-ai/mastra/pull/8589))
  fixed an issue with provider ID rendering in playground UI
- Updated dependencies [[`b728a45`](https://github.com/mastra-ai/mastra/commit/b728a45ab3dba59da0f5ee36b81fe246659f305d)]:
  - @mastra/core@0.20.1-alpha.4
  - @mastra/deployer@0.20.1-alpha.4

## 0.14.2-alpha.2

### Patch Changes

- Added AI SDK provider packages to model router for anthropic/google/openai/openrouter/xai ([#8559](https://github.com/mastra-ai/mastra/pull/8559))

- Updated dependencies [[`42ffed3`](https://github.com/mastra-ai/mastra/commit/42ffed311b9d8750652bbc55c773be62c989fcc6), [`ee9108f`](https://github.com/mastra-ai/mastra/commit/ee9108fa29bb8368fc23df158c9f0645b2d7b65c)]:
  - @mastra/deployer@0.20.1-alpha.2
  - @mastra/core@0.20.1-alpha.2

## 0.14.2-alpha.1

### Patch Changes

- workflow run thread more visible ([#8539](https://github.com/mastra-ai/mastra/pull/8539))

- Mutable shared workflow run state ([#8545](https://github.com/mastra-ai/mastra/pull/8545))

- avoid refetching memory threads and messages on window focus ([#8519](https://github.com/mastra-ai/mastra/pull/8519))

- add tripwire reason in playground ([#8568](https://github.com/mastra-ai/mastra/pull/8568))

- Save waiting step status in snapshot ([#8576](https://github.com/mastra-ai/mastra/pull/8576))

- Convert WorkflowWatchResult to WorkflowResult in workflow graph ([#8541](https://github.com/mastra-ai/mastra/pull/8541))

- add new deploy to cloud button ([#8549](https://github.com/mastra-ai/mastra/pull/8549))

- remove icons in entity lists ([#8520](https://github.com/mastra-ai/mastra/pull/8520))

- add client search to all entities ([#8523](https://github.com/mastra-ai/mastra/pull/8523))

- UX for the agents page ([#8517](https://github.com/mastra-ai/mastra/pull/8517))

- add icons into playground titles + a link to the entity doc ([#8518](https://github.com/mastra-ai/mastra/pull/8518))

- Updated dependencies [[`c621613`](https://github.com/mastra-ai/mastra/commit/c621613069173c69eb2c3ef19a5308894c6549f0), [`ee17cec`](https://github.com/mastra-ai/mastra/commit/ee17cec065f4454740c9cc8f8a841027a5990f57), [`12b1189`](https://github.com/mastra-ai/mastra/commit/12b118942445e4de0dd916c593e33ec78dc3bc73), [`4783b30`](https://github.com/mastra-ai/mastra/commit/4783b3063efea887825514b783ba27f67912c26d), [`076b092`](https://github.com/mastra-ai/mastra/commit/076b0924902ff0f49d5712d2df24c4cca683713f), [`2aee9e7`](https://github.com/mastra-ai/mastra/commit/2aee9e7d188b8b256a4ddc203ccefb366b4867fa), [`c582906`](https://github.com/mastra-ai/mastra/commit/c5829065a346260f96c4beb8af131b94804ae3ad), [`fa2eb96`](https://github.com/mastra-ai/mastra/commit/fa2eb96af16c7d433891a73932764960d3235c1d), [`4783b30`](https://github.com/mastra-ai/mastra/commit/4783b3063efea887825514b783ba27f67912c26d), [`a739d0c`](https://github.com/mastra-ai/mastra/commit/a739d0c8b37cd89569e04a6ca0827083c6167e19), [`a9c4cb7`](https://github.com/mastra-ai/mastra/commit/a9c4cb7d6a35de23ca51066f166a66e0e4cca418), [`603e927`](https://github.com/mastra-ai/mastra/commit/603e9279db8bf8a46caf83881c6b7389ccffff7e), [`cd45982`](https://github.com/mastra-ai/mastra/commit/cd4598291cda128a88738734ae6cbef076ebdebd), [`874f74d`](https://github.com/mastra-ai/mastra/commit/874f74da4b1acf6517f18132d035612c3ecc394a), [`0baf2ba`](https://github.com/mastra-ai/mastra/commit/0baf2bab8420277072ef1f95df5ea7b0a2f61fe7), [`26e968d`](https://github.com/mastra-ai/mastra/commit/26e968db2171ded9e4d47aa1b4f19e1e771158d0), [`cbd3fb6`](https://github.com/mastra-ai/mastra/commit/cbd3fb65adb03a7c0df193cb998aed5ac56675ee)]:
  - @mastra/core@0.20.1-alpha.1
  - @mastra/deployer@0.20.1-alpha.1
  - @mastra/mcp@0.13.4-alpha.0

## 0.14.2-alpha.0

### Patch Changes

- streamLegacy/generateLegacy clarification in playground ([#8468](https://github.com/mastra-ai/mastra/pull/8468))

- Fix useStreamWorkflow unmounting breaking stream call ([#8449](https://github.com/mastra-ai/mastra/pull/8449))

- Remove shell from dev ([#8466](https://github.com/mastra-ai/mastra/pull/8466))

- Updated dependencies [[`10e633a`](https://github.com/mastra-ai/mastra/commit/10e633a07d333466d9734c97acfc3dbf757ad2d0)]:
  - @mastra/core@0.20.1-alpha.0
  - @mastra/deployer@0.20.1-alpha.0

## 0.14.1

### Patch Changes

- Make init versions latest pkgs ([#8434](https://github.com/mastra-ai/mastra/pull/8434))

## 0.14.1-alpha.0

### Patch Changes

- Make init versions latest pkgs ([#8434](https://github.com/mastra-ai/mastra/pull/8434))

## 0.14.0

### Minor Changes

- Breaking change to move the agent.streamVNext/generateVNext implementation to the default stream/generate. The old stream/generate have now been moved to streamLegacy and generateLegacy ([#8097](https://github.com/mastra-ai/mastra/pull/8097))

### Patch Changes

- Remove log drains UI from the playground ([#8379](https://github.com/mastra-ai/mastra/pull/8379))

- add refetch interval to traces to make it feel "instant" ([#8386](https://github.com/mastra-ai/mastra/pull/8386))

- better memory message ([#8382](https://github.com/mastra-ai/mastra/pull/8382))

- Add doc url to netlify gateway ([#8356](https://github.com/mastra-ai/mastra/pull/8356))

- fix codeblock line number color contrast for legacy traces ([#8385](https://github.com/mastra-ai/mastra/pull/8385))

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

- fix playground message history initial state for v1 models ([#8427](https://github.com/mastra-ai/mastra/pull/8427))

- show thread list in desc order ([#8381](https://github.com/mastra-ai/mastra/pull/8381))

- Fix an issue preventing showing working memory and semantic recall in the playground ([#8358](https://github.com/mastra-ai/mastra/pull/8358))

- Fix shell option breaking server start on windows env ([#8377](https://github.com/mastra-ai/mastra/pull/8377))

- Add observe strean to get streans after workflow has been interrupted ([#8318](https://github.com/mastra-ai/mastra/pull/8318))

- Updated dependencies [[`00cb6bd`](https://github.com/mastra-ai/mastra/commit/00cb6bdf78737c0fac14a5a0c7b532a11e38558a), [`869ba22`](https://github.com/mastra-ai/mastra/commit/869ba222e1d6b58fc1b65e7c9fd55ca4e01b8c2f), [`1b73665`](https://github.com/mastra-ai/mastra/commit/1b73665e8e23f5c09d49fcf3e7d709c75259259e), [`989a4db`](https://github.com/mastra-ai/mastra/commit/989a4dbbaf07a2794d0e1863714c6d10f1244d6b), [`f7d7475`](https://github.com/mastra-ai/mastra/commit/f7d747507341aef60ed39e4b49318db1f86034a6), [`084b77b`](https://github.com/mastra-ai/mastra/commit/084b77b2955960e0190af8db3f77138aa83ed65c), [`a93ff84`](https://github.com/mastra-ai/mastra/commit/a93ff84b5e1af07ee236ac8873dac9b49aa5d501), [`bc5aacb`](https://github.com/mastra-ai/mastra/commit/bc5aacb646d468d325327e36117129f28cd13bf6), [`03622f8`](https://github.com/mastra-ai/mastra/commit/03622f86e9d7342197f80f95333ea3ff65c783ae), [`6b5af12`](https://github.com/mastra-ai/mastra/commit/6b5af12ce9e09066e0c32e821c203a6954498bea), [`bf60e4a`](https://github.com/mastra-ai/mastra/commit/bf60e4a89c515afd9570b7b79f33b95e7d07c397), [`d41aee5`](https://github.com/mastra-ai/mastra/commit/d41aee526d124e35f42720a08e64043229193679), [`e8fe13c`](https://github.com/mastra-ai/mastra/commit/e8fe13c4b4c255a42520127797ec394310f7c919), [`3ca833d`](https://github.com/mastra-ai/mastra/commit/3ca833dc994c38e3c9b4f9b4478a61cd8e07b32a), [`1edb8d1`](https://github.com/mastra-ai/mastra/commit/1edb8d1cfb963e72a12412990fb9170936c9904c), [`fbf6e32`](https://github.com/mastra-ai/mastra/commit/fbf6e324946332d0f5ed8930bf9d4d4479cefd7a), [`4753027`](https://github.com/mastra-ai/mastra/commit/4753027ee889288775c6958bdfeda03ff909af67)]:
  - @mastra/core@0.20.0
  - @mastra/deployer@0.20.0
  - @mastra/mcp@0.13.3
  - @mastra/loggers@0.10.15

## 0.14.0-alpha.0

### Minor Changes

- Breaking change to move the agent.streamVNext/generateVNext implementation to the default stream/generate. The old stream/generate have now been moved to streamLegacy and generateLegacy ([#8097](https://github.com/mastra-ai/mastra/pull/8097))

### Patch Changes

- Remove log drains UI from the playground ([#8379](https://github.com/mastra-ai/mastra/pull/8379))

- add refetch interval to traces to make it feel "instant" ([#8386](https://github.com/mastra-ai/mastra/pull/8386))

- better memory message ([#8382](https://github.com/mastra-ai/mastra/pull/8382))

- Add doc url to netlify gateway ([#8356](https://github.com/mastra-ai/mastra/pull/8356))

- fix codeblock line number color contrast for legacy traces ([#8385](https://github.com/mastra-ai/mastra/pull/8385))

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

- fix playground message history initial state for v1 models ([#8427](https://github.com/mastra-ai/mastra/pull/8427))

- show thread list in desc order ([#8381](https://github.com/mastra-ai/mastra/pull/8381))

- Fix an issue preventing showing working memory and semantic recall in the playground ([#8358](https://github.com/mastra-ai/mastra/pull/8358))

- Fix shell option breaking server start on windows env ([#8377](https://github.com/mastra-ai/mastra/pull/8377))

- Add observe strean to get streans after workflow has been interrupted ([#8318](https://github.com/mastra-ai/mastra/pull/8318))

- Updated dependencies [[`00cb6bd`](https://github.com/mastra-ai/mastra/commit/00cb6bdf78737c0fac14a5a0c7b532a11e38558a), [`869ba22`](https://github.com/mastra-ai/mastra/commit/869ba222e1d6b58fc1b65e7c9fd55ca4e01b8c2f), [`1b73665`](https://github.com/mastra-ai/mastra/commit/1b73665e8e23f5c09d49fcf3e7d709c75259259e), [`989a4db`](https://github.com/mastra-ai/mastra/commit/989a4dbbaf07a2794d0e1863714c6d10f1244d6b), [`f7d7475`](https://github.com/mastra-ai/mastra/commit/f7d747507341aef60ed39e4b49318db1f86034a6), [`084b77b`](https://github.com/mastra-ai/mastra/commit/084b77b2955960e0190af8db3f77138aa83ed65c), [`a93ff84`](https://github.com/mastra-ai/mastra/commit/a93ff84b5e1af07ee236ac8873dac9b49aa5d501), [`bc5aacb`](https://github.com/mastra-ai/mastra/commit/bc5aacb646d468d325327e36117129f28cd13bf6), [`03622f8`](https://github.com/mastra-ai/mastra/commit/03622f86e9d7342197f80f95333ea3ff65c783ae), [`6b5af12`](https://github.com/mastra-ai/mastra/commit/6b5af12ce9e09066e0c32e821c203a6954498bea), [`bf60e4a`](https://github.com/mastra-ai/mastra/commit/bf60e4a89c515afd9570b7b79f33b95e7d07c397), [`d41aee5`](https://github.com/mastra-ai/mastra/commit/d41aee526d124e35f42720a08e64043229193679), [`e8fe13c`](https://github.com/mastra-ai/mastra/commit/e8fe13c4b4c255a42520127797ec394310f7c919), [`3ca833d`](https://github.com/mastra-ai/mastra/commit/3ca833dc994c38e3c9b4f9b4478a61cd8e07b32a), [`1edb8d1`](https://github.com/mastra-ai/mastra/commit/1edb8d1cfb963e72a12412990fb9170936c9904c), [`fbf6e32`](https://github.com/mastra-ai/mastra/commit/fbf6e324946332d0f5ed8930bf9d4d4479cefd7a), [`4753027`](https://github.com/mastra-ai/mastra/commit/4753027ee889288775c6958bdfeda03ff909af67)]:
  - @mastra/core@0.20.0-alpha.0
  - @mastra/deployer@0.20.0-alpha.0
  - @mastra/mcp@0.13.3-alpha.0
  - @mastra/loggers@0.10.15-alpha.0

## 0.13.4

### Patch Changes

- disable network label when memory is not enabled OR the agent has no subagents ([#8341](https://github.com/mastra-ai/mastra/pull/8341))

- Added Mastra model router to Playground UI ([#8332](https://github.com/mastra-ai/mastra/pull/8332))

- Updated dependencies [[`4a70ccc`](https://github.com/mastra-ai/mastra/commit/4a70ccc5cfa12ae9c2b36545a5814cd98e5a0ead), [`0992b8b`](https://github.com/mastra-ai/mastra/commit/0992b8bf0f4f1ba7ad9940883ec4bb8d867d3105), [`283bea0`](https://github.com/mastra-ai/mastra/commit/283bea07adbaf04a27fa3ad2df611095e0825195)]:
  - @mastra/core@0.19.1
  - @mastra/deployer@0.19.1

## 0.13.4-alpha.1

### Patch Changes

- disable network label when memory is not enabled OR the agent has no subagents ([#8341](https://github.com/mastra-ai/mastra/pull/8341))

- Updated dependencies [[`4a70ccc`](https://github.com/mastra-ai/mastra/commit/4a70ccc5cfa12ae9c2b36545a5814cd98e5a0ead)]:
  - @mastra/core@0.19.1-alpha.1
  - @mastra/deployer@0.19.1-alpha.1

## 0.13.4-alpha.0

### Patch Changes

- Added Mastra model router to Playground UI ([#8332](https://github.com/mastra-ai/mastra/pull/8332))

- Updated dependencies [[`0992b8b`](https://github.com/mastra-ai/mastra/commit/0992b8bf0f4f1ba7ad9940883ec4bb8d867d3105), [`283bea0`](https://github.com/mastra-ai/mastra/commit/283bea07adbaf04a27fa3ad2df611095e0825195)]:
  - @mastra/deployer@0.19.1-alpha.0
  - @mastra/core@0.19.1-alpha.0

## 0.13.3

### Patch Changes

- Remove legacy helpers ([#8017](https://github.com/mastra-ai/mastra/pull/8017))

- add a way to hide the deploy mastra cloud button ([#8137](https://github.com/mastra-ai/mastra/pull/8137))

- Update peer deps ([#8154](https://github.com/mastra-ai/mastra/pull/8154))

- Fixed an issue in playground where text-start/end parts were ignored in handleStreamChunk and tool ordering vs text wasn't retained ([#8234](https://github.com/mastra-ai/mastra/pull/8234))

- Add conditional chaining to scorer.agentNames return ([#8199](https://github.com/mastra-ai/mastra/pull/8199))

- Show model that worked when there are model fallbacks ([#8167](https://github.com/mastra-ai/mastra/pull/8167))

- Add types in the streamVNext codepath, fixes for various issues across multiple packages surfaced from type issues, align return types. ([#8010](https://github.com/mastra-ai/mastra/pull/8010))

- Add model fallbacks to playground ([#7427](https://github.com/mastra-ai/mastra/pull/7427))

- Updated dependencies [[`5089c84`](https://github.com/mastra-ai/mastra/commit/5089c84a2f535ad12e79b5aa524ad7d8ca5e2b4c), [`5f4e677`](https://github.com/mastra-ai/mastra/commit/5f4e67757bc23f2694d83af10f88cfccdc6013ff), [`5c98f03`](https://github.com/mastra-ai/mastra/commit/5c98f03ae76d9a93cd6be206b4abb7bf186b3163), [`dc099b4`](https://github.com/mastra-ai/mastra/commit/dc099b40fb31147ba3f362f98d991892033c4c67), [`57b75b0`](https://github.com/mastra-ai/mastra/commit/57b75b01c0c64d91c50d7384c700afda89456fe8), [`4c5e65d`](https://github.com/mastra-ai/mastra/commit/4c5e65de746fbdab23eb6072cb999f4c7aeef9f3), [`504438b`](https://github.com/mastra-ai/mastra/commit/504438b961bde211071186bba63a842c4e3db879), [`57b6dd5`](https://github.com/mastra-ai/mastra/commit/57b6dd50f9e6d92c0ed3e7199e6a92752025e3a1), [`b342a68`](https://github.com/mastra-ai/mastra/commit/b342a68e1399cf1ece9ba11bda112db89d21118c), [`a7243e2`](https://github.com/mastra-ai/mastra/commit/a7243e2e58762667a6e3921e755e89d6bb0a3282), [`504438b`](https://github.com/mastra-ai/mastra/commit/504438b961bde211071186bba63a842c4e3db879), [`7fceb0a`](https://github.com/mastra-ai/mastra/commit/7fceb0a327d678e812f90f5387c5bc4f38bd039e), [`303a9c0`](https://github.com/mastra-ai/mastra/commit/303a9c0d7dd58795915979f06a0512359e4532fb), [`df64f9e`](https://github.com/mastra-ai/mastra/commit/df64f9ef814916fff9baedd861c988084e7c41de), [`370f8a6`](https://github.com/mastra-ai/mastra/commit/370f8a6480faec70fef18d72e5f7538f27004301), [`809eea0`](https://github.com/mastra-ai/mastra/commit/809eea092fa80c3f69b9eaf078d843b57fd2a88e), [`683e5a1`](https://github.com/mastra-ai/mastra/commit/683e5a1466e48b686825b2c11f84680f296138e4), [`3679378`](https://github.com/mastra-ai/mastra/commit/3679378673350aa314741dc826f837b1984149bc), [`7775bc2`](https://github.com/mastra-ai/mastra/commit/7775bc20bb1ad1ab24797fb420e4f96c65b0d8ec), [`623ffaf`](https://github.com/mastra-ai/mastra/commit/623ffaf2d969e11e99a0224633cf7b5a0815c857), [`9fc1613`](https://github.com/mastra-ai/mastra/commit/9fc16136400186648880fd990119ac15f7c02ee4), [`61f62aa`](https://github.com/mastra-ai/mastra/commit/61f62aa31bc88fe4ddf8da6240dbcfbeb07358bd), [`db1891a`](https://github.com/mastra-ai/mastra/commit/db1891a4707443720b7cd8a260dc7e1d49b3609c), [`e8f379d`](https://github.com/mastra-ai/mastra/commit/e8f379d390efa264c4e0874f9ac0cf8839b07777), [`652066b`](https://github.com/mastra-ai/mastra/commit/652066bd1efc6bb6813ba950ed1d7573e8b7d9d4), [`3e292ba`](https://github.com/mastra-ai/mastra/commit/3e292ba00837886d5d68a34cbc0d9b703c991883), [`418c136`](https://github.com/mastra-ai/mastra/commit/418c1366843d88e491bca3f87763899ce855ca29), [`ea8d386`](https://github.com/mastra-ai/mastra/commit/ea8d386cd8c5593664515fd5770c06bf2aa980ef), [`67b0f00`](https://github.com/mastra-ai/mastra/commit/67b0f005b520335c71fb85cbaa25df4ce8484a81), [`c2a4919`](https://github.com/mastra-ai/mastra/commit/c2a4919ba6797d8bdb1509e02287496eef69303e), [`c84b7d0`](https://github.com/mastra-ai/mastra/commit/c84b7d093c4657772140cbfd2b15ef72f3315ed5), [`6f67656`](https://github.com/mastra-ai/mastra/commit/6f676562276926e2982401574d1e07157579be30), [`0130986`](https://github.com/mastra-ai/mastra/commit/0130986fc62d0edcc626dd593282661dbb9af141), [`5dc8e9a`](https://github.com/mastra-ai/mastra/commit/5dc8e9a7f8472298cd3d4e8a0cf6d265529f287d)]:
  - @mastra/deployer@0.19.0
  - @mastra/mcp@0.13.2
  - @mastra/core@0.19.0
  - @mastra/loggers@0.10.14

## 0.13.3-alpha.1

### Patch Changes

- Update peer deps ([#8154](https://github.com/mastra-ai/mastra/pull/8154))

- Fixed an issue in playground where text-start/end parts were ignored in handleStreamChunk and tool ordering vs text wasn't retained ([#8234](https://github.com/mastra-ai/mastra/pull/8234))

- Add conditional chaining to scorer.agentNames return ([#8199](https://github.com/mastra-ai/mastra/pull/8199))

- Show model that worked when there are model fallbacks ([#8167](https://github.com/mastra-ai/mastra/pull/8167))

- Updated dependencies [[`5089c84`](https://github.com/mastra-ai/mastra/commit/5089c84a2f535ad12e79b5aa524ad7d8ca5e2b4c), [`5f4e677`](https://github.com/mastra-ai/mastra/commit/5f4e67757bc23f2694d83af10f88cfccdc6013ff), [`5c98f03`](https://github.com/mastra-ai/mastra/commit/5c98f03ae76d9a93cd6be206b4abb7bf186b3163), [`57b75b0`](https://github.com/mastra-ai/mastra/commit/57b75b01c0c64d91c50d7384c700afda89456fe8), [`4c5e65d`](https://github.com/mastra-ai/mastra/commit/4c5e65de746fbdab23eb6072cb999f4c7aeef9f3), [`504438b`](https://github.com/mastra-ai/mastra/commit/504438b961bde211071186bba63a842c4e3db879), [`57b6dd5`](https://github.com/mastra-ai/mastra/commit/57b6dd50f9e6d92c0ed3e7199e6a92752025e3a1), [`a7243e2`](https://github.com/mastra-ai/mastra/commit/a7243e2e58762667a6e3921e755e89d6bb0a3282), [`504438b`](https://github.com/mastra-ai/mastra/commit/504438b961bde211071186bba63a842c4e3db879), [`7fceb0a`](https://github.com/mastra-ai/mastra/commit/7fceb0a327d678e812f90f5387c5bc4f38bd039e), [`df64f9e`](https://github.com/mastra-ai/mastra/commit/df64f9ef814916fff9baedd861c988084e7c41de), [`809eea0`](https://github.com/mastra-ai/mastra/commit/809eea092fa80c3f69b9eaf078d843b57fd2a88e), [`683e5a1`](https://github.com/mastra-ai/mastra/commit/683e5a1466e48b686825b2c11f84680f296138e4), [`3679378`](https://github.com/mastra-ai/mastra/commit/3679378673350aa314741dc826f837b1984149bc), [`7775bc2`](https://github.com/mastra-ai/mastra/commit/7775bc20bb1ad1ab24797fb420e4f96c65b0d8ec), [`db1891a`](https://github.com/mastra-ai/mastra/commit/db1891a4707443720b7cd8a260dc7e1d49b3609c), [`e8f379d`](https://github.com/mastra-ai/mastra/commit/e8f379d390efa264c4e0874f9ac0cf8839b07777), [`652066b`](https://github.com/mastra-ai/mastra/commit/652066bd1efc6bb6813ba950ed1d7573e8b7d9d4), [`ea8d386`](https://github.com/mastra-ai/mastra/commit/ea8d386cd8c5593664515fd5770c06bf2aa980ef), [`c2a4919`](https://github.com/mastra-ai/mastra/commit/c2a4919ba6797d8bdb1509e02287496eef69303e), [`6f67656`](https://github.com/mastra-ai/mastra/commit/6f676562276926e2982401574d1e07157579be30), [`0130986`](https://github.com/mastra-ai/mastra/commit/0130986fc62d0edcc626dd593282661dbb9af141), [`5dc8e9a`](https://github.com/mastra-ai/mastra/commit/5dc8e9a7f8472298cd3d4e8a0cf6d265529f287d)]:
  - @mastra/deployer@0.19.0-alpha.1
  - @mastra/mcp@0.13.2-alpha.0
  - @mastra/core@0.19.0-alpha.1
  - @mastra/loggers@0.10.14-alpha.0

## 0.13.3-alpha.0

### Patch Changes

- Remove legacy helpers ([#8017](https://github.com/mastra-ai/mastra/pull/8017))

- add a way to hide the deploy mastra cloud button ([#8137](https://github.com/mastra-ai/mastra/pull/8137))

- Add types in the streamVNext codepath, fixes for various issues across multiple packages surfaced from type issues, align return types. ([#8010](https://github.com/mastra-ai/mastra/pull/8010))

- Add model fallbacks to playground ([#7427](https://github.com/mastra-ai/mastra/pull/7427))

- Updated dependencies [[`dc099b4`](https://github.com/mastra-ai/mastra/commit/dc099b40fb31147ba3f362f98d991892033c4c67), [`b342a68`](https://github.com/mastra-ai/mastra/commit/b342a68e1399cf1ece9ba11bda112db89d21118c), [`303a9c0`](https://github.com/mastra-ai/mastra/commit/303a9c0d7dd58795915979f06a0512359e4532fb), [`370f8a6`](https://github.com/mastra-ai/mastra/commit/370f8a6480faec70fef18d72e5f7538f27004301), [`623ffaf`](https://github.com/mastra-ai/mastra/commit/623ffaf2d969e11e99a0224633cf7b5a0815c857), [`9fc1613`](https://github.com/mastra-ai/mastra/commit/9fc16136400186648880fd990119ac15f7c02ee4), [`61f62aa`](https://github.com/mastra-ai/mastra/commit/61f62aa31bc88fe4ddf8da6240dbcfbeb07358bd), [`3e292ba`](https://github.com/mastra-ai/mastra/commit/3e292ba00837886d5d68a34cbc0d9b703c991883), [`418c136`](https://github.com/mastra-ai/mastra/commit/418c1366843d88e491bca3f87763899ce855ca29), [`c84b7d0`](https://github.com/mastra-ai/mastra/commit/c84b7d093c4657772140cbfd2b15ef72f3315ed5)]:
  - @mastra/core@0.18.1-alpha.0
  - @mastra/deployer@0.18.1-alpha.0

## 0.13.2

### Patch Changes

- feat: implement trace scoring with batch processing capabilities ([#8033](https://github.com/mastra-ai/mastra/pull/8033))

- Add model fallback handlers and apis ([#7378](https://github.com/mastra-ai/mastra/pull/7378))

- dependencies updates: ([#8007](https://github.com/mastra-ai/mastra/pull/8007))
  - Updated dependency [`fs-extra@^11.3.2` ↗︎](https://www.npmjs.com/package/fs-extra/v/11.3.2) (from `^11.3.1`, in `dependencies`)

- show the tool-output stream in the playground for streamVNext ([#7983](https://github.com/mastra-ai/mastra/pull/7983))

- Get rid off swr one for all ([#7931](https://github.com/mastra-ai/mastra/pull/7931))

- Fix DateTimePicker style issue ([#8106](https://github.com/mastra-ai/mastra/pull/8106))

- Fix navigating between scores and entity types ([#8129](https://github.com/mastra-ai/mastra/pull/8129))

- Fix getting tool link path from agent in playground ui tools page ([#8135](https://github.com/mastra-ai/mastra/pull/8135))

- Update Peerdeps for packages based on core minor bump ([#8025](https://github.com/mastra-ai/mastra/pull/8025))

- Updated dependencies [[`288745a`](https://github.com/mastra-ai/mastra/commit/288745a19aa9557db3ab3c877d667ff59f14d79c), [`cf34503`](https://github.com/mastra-ai/mastra/commit/cf345031de4e157f29087946449e60b965e9c8a9), [`6b4b1e4`](https://github.com/mastra-ai/mastra/commit/6b4b1e4235428d39e51cbda9832704c0ba70ab32), [`3469fca`](https://github.com/mastra-ai/mastra/commit/3469fca7bb7e5e19369ff9f7044716a5e4b02585), [`a61f23f`](https://github.com/mastra-ai/mastra/commit/a61f23fbbca4b88b763d94f1d784c47895ed72d7), [`4b339b8`](https://github.com/mastra-ai/mastra/commit/4b339b8141c20d6a6d80583c7e8c5c05d8c19492), [`8f56160`](https://github.com/mastra-ai/mastra/commit/8f56160fd45c740076529148b9c225f6842d43b0), [`d1dc606`](https://github.com/mastra-ai/mastra/commit/d1dc6067b0557a71190b68d56ee15b48c26d2411), [`2d29ad9`](https://github.com/mastra-ai/mastra/commit/2d29ad92763cac02fc1d80c221ac93c39c0c5caf), [`c45298a`](https://github.com/mastra-ai/mastra/commit/c45298a0a0791db35cf79f1199d77004da0704cb), [`c4a8204`](https://github.com/mastra-ai/mastra/commit/c4a82046bfd241d6044e234bc5917d5a01fe6b55), [`d3bd4d4`](https://github.com/mastra-ai/mastra/commit/d3bd4d482a685bbb67bfa89be91c90dca3fa71ad), [`c591dfc`](https://github.com/mastra-ai/mastra/commit/c591dfc1e600fae1dedffe239357d250e146378f), [`1920c5c`](https://github.com/mastra-ai/mastra/commit/1920c5c6d666f687785c73021196aa551e579e0d), [`b6a3b65`](https://github.com/mastra-ai/mastra/commit/b6a3b65d830fa0ca7754ad6481661d1f2c878f21), [`af3abb6`](https://github.com/mastra-ai/mastra/commit/af3abb6f7c7585d856e22d27f4e7d2ece2186b9a), [`5b1ee71`](https://github.com/mastra-ai/mastra/commit/5b1ee71dc3ac92383226dc1e375642ca5f9b4224), [`282379f`](https://github.com/mastra-ai/mastra/commit/282379fafed80c6417fe1e791087110decd481ca)]:
  - @mastra/deployer@0.18.0
  - @mastra/core@0.18.0
  - @mastra/loggers@0.10.13
  - @mastra/mcp@0.13.1

## 0.13.2-alpha.4

### Patch Changes

- Fix getting tool link path from agent in playground ui tools page ([#8135](https://github.com/mastra-ai/mastra/pull/8135))

## 0.13.2-alpha.3

### Patch Changes

- feat: implement trace scoring with batch processing capabilities ([#8033](https://github.com/mastra-ai/mastra/pull/8033))

- Add model fallback handlers and apis ([#7378](https://github.com/mastra-ai/mastra/pull/7378))

- Fix DateTimePicker style issue ([#8106](https://github.com/mastra-ai/mastra/pull/8106))

- Fix navigating between scores and entity types ([#8129](https://github.com/mastra-ai/mastra/pull/8129))

- Updated dependencies [[`4b339b8`](https://github.com/mastra-ai/mastra/commit/4b339b8141c20d6a6d80583c7e8c5c05d8c19492), [`8f56160`](https://github.com/mastra-ai/mastra/commit/8f56160fd45c740076529148b9c225f6842d43b0), [`c591dfc`](https://github.com/mastra-ai/mastra/commit/c591dfc1e600fae1dedffe239357d250e146378f), [`1920c5c`](https://github.com/mastra-ai/mastra/commit/1920c5c6d666f687785c73021196aa551e579e0d), [`b6a3b65`](https://github.com/mastra-ai/mastra/commit/b6a3b65d830fa0ca7754ad6481661d1f2c878f21), [`af3abb6`](https://github.com/mastra-ai/mastra/commit/af3abb6f7c7585d856e22d27f4e7d2ece2186b9a), [`282379f`](https://github.com/mastra-ai/mastra/commit/282379fafed80c6417fe1e791087110decd481ca)]:
  - @mastra/core@0.18.0-alpha.3
  - @mastra/deployer@0.18.0-alpha.3

## 0.13.2-alpha.2

### Patch Changes

- Update Peerdeps for packages based on core minor bump ([#8025](https://github.com/mastra-ai/mastra/pull/8025))

- Updated dependencies [[`cf34503`](https://github.com/mastra-ai/mastra/commit/cf345031de4e157f29087946449e60b965e9c8a9), [`6b4b1e4`](https://github.com/mastra-ai/mastra/commit/6b4b1e4235428d39e51cbda9832704c0ba70ab32), [`3469fca`](https://github.com/mastra-ai/mastra/commit/3469fca7bb7e5e19369ff9f7044716a5e4b02585), [`2d29ad9`](https://github.com/mastra-ai/mastra/commit/2d29ad92763cac02fc1d80c221ac93c39c0c5caf), [`c4a8204`](https://github.com/mastra-ai/mastra/commit/c4a82046bfd241d6044e234bc5917d5a01fe6b55), [`5b1ee71`](https://github.com/mastra-ai/mastra/commit/5b1ee71dc3ac92383226dc1e375642ca5f9b4224)]:
  - @mastra/core@0.18.0-alpha.2
  - @mastra/deployer@0.18.0-alpha.2
  - @mastra/loggers@0.10.13-alpha.0
  - @mastra/mcp@0.13.1-alpha.0

## 0.13.2-alpha.1

### Patch Changes

- dependencies updates: ([#8007](https://github.com/mastra-ai/mastra/pull/8007))
  - Updated dependency [`fs-extra@^11.3.2` ↗︎](https://www.npmjs.com/package/fs-extra/v/11.3.2) (from `^11.3.1`, in `dependencies`)

- show the tool-output stream in the playground for streamVNext ([#7983](https://github.com/mastra-ai/mastra/pull/7983))

- Updated dependencies [[`288745a`](https://github.com/mastra-ai/mastra/commit/288745a19aa9557db3ab3c877d667ff59f14d79c), [`c45298a`](https://github.com/mastra-ai/mastra/commit/c45298a0a0791db35cf79f1199d77004da0704cb)]:
  - @mastra/deployer@0.17.2-alpha.1
  - @mastra/core@0.17.2-alpha.1

## 0.13.2-alpha.0

### Patch Changes

- Get rid off swr one for all ([#7931](https://github.com/mastra-ai/mastra/pull/7931))

- Updated dependencies [[`a61f23f`](https://github.com/mastra-ai/mastra/commit/a61f23fbbca4b88b763d94f1d784c47895ed72d7), [`d1dc606`](https://github.com/mastra-ai/mastra/commit/d1dc6067b0557a71190b68d56ee15b48c26d2411), [`d3bd4d4`](https://github.com/mastra-ai/mastra/commit/d3bd4d482a685bbb67bfa89be91c90dca3fa71ad)]:
  - @mastra/core@0.17.2-alpha.0
  - @mastra/deployer@0.17.2-alpha.0

## 0.13.1

### Patch Changes

- fix workflow resuming issue in the playground ([#7988](https://github.com/mastra-ai/mastra/pull/7988))

- Updated dependencies [[`fd00e63`](https://github.com/mastra-ai/mastra/commit/fd00e63759cbcca3473c40cac9843280b0557cff), [`ab610f6`](https://github.com/mastra-ai/mastra/commit/ab610f6f41dbfe6c9502368671485ca7a0aac09b), [`e6bda5f`](https://github.com/mastra-ai/mastra/commit/e6bda5f954ee8493ea18adc1a883f0a5b785ad9b)]:
  - @mastra/core@0.17.1
  - @mastra/deployer@0.17.1

## 0.13.1-alpha.0

### Patch Changes

- fix workflow resuming issue in the playground ([#7988](https://github.com/mastra-ai/mastra/pull/7988))

- Updated dependencies [[`fd00e63`](https://github.com/mastra-ai/mastra/commit/fd00e63759cbcca3473c40cac9843280b0557cff), [`ab610f6`](https://github.com/mastra-ai/mastra/commit/ab610f6f41dbfe6c9502368671485ca7a0aac09b), [`e6bda5f`](https://github.com/mastra-ai/mastra/commit/e6bda5f954ee8493ea18adc1a883f0a5b785ad9b)]:
  - @mastra/core@0.17.1-alpha.0
  - @mastra/deployer@0.17.1-alpha.0

## 0.13.0

### Minor Changes

- Improved workspace dependency resolution during development and builds. This makes the build process more reliable when working with monorepos and workspace packages, reducing potential bundling errors and improving development experience. ([#7619](https://github.com/mastra-ai/mastra/pull/7619))

### Patch Changes

- clean up console logs in monorepo ([#7926](https://github.com/mastra-ai/mastra/pull/7926))

- update playground workflows to use createRunAsync instead of createRun ([#7903](https://github.com/mastra-ai/mastra/pull/7903))

- Improve the `mastra init` CLI. ([#7837](https://github.com/mastra-ai/mastra/pull/7837))

  Previously, when you ran `mastra init` in a directory without a `package.json` file you'd receive no output. Now the CLI shows an error with next steps. Additionally, `mastra init` now also installs `zod` if not present already.

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

- fix scorers table link full row ([#7915](https://github.com/mastra-ai/mastra/pull/7915))

- dependencies updates: ([#7810](https://github.com/mastra-ai/mastra/pull/7810))
  - Updated dependency [`strip-json-comments@^5.0.3` ↗︎](https://www.npmjs.com/package/strip-json-comments/v/5.0.3) (from `^5.0.2`, in `dependencies`)

- adjust the way we display scorers in agent metadata ([#7910](https://github.com/mastra-ai/mastra/pull/7910))

- fix minor playground stuff for observability ([#7765](https://github.com/mastra-ai/mastra/pull/7765))

- Handle zod intersections in dynamic form ([#7768](https://github.com/mastra-ai/mastra/pull/7768))

- Playground ui -pass runtimeContext to client SDK get methods ([#7767](https://github.com/mastra-ai/mastra/pull/7767))

- fix markdown rendering in agent in agent text-delta ([#7851](https://github.com/mastra-ai/mastra/pull/7851))

- fix error message when fetching observability things ([#7956](https://github.com/mastra-ai/mastra/pull/7956))

- fix workflows runs fetching and displaying ([#7852](https://github.com/mastra-ai/mastra/pull/7852))

- fix empty state for scorers on agent page ([#7846](https://github.com/mastra-ai/mastra/pull/7846))

- Updated dependencies [[`197cbb2`](https://github.com/mastra-ai/mastra/commit/197cbb248fc8cb4bbf61bf70b770f1388b445df2), [`b1c155b`](https://github.com/mastra-ai/mastra/commit/b1c155b57ce702674f207f1d4c6a4ebf94225f44), [`790f7d1`](https://github.com/mastra-ai/mastra/commit/790f7d17895d7a5f75b6b5d2d794c2e820b99d4c), [`3cd6538`](https://github.com/mastra-ai/mastra/commit/3cd6538811fc94f84a19dbd1064f46cb42e38c1d), [`197cbb2`](https://github.com/mastra-ai/mastra/commit/197cbb248fc8cb4bbf61bf70b770f1388b445df2), [`a1bb887`](https://github.com/mastra-ai/mastra/commit/a1bb887e8bfae44230f487648da72e96ef824561), [`6590763`](https://github.com/mastra-ai/mastra/commit/65907630ef4bf4127067cecd1cb21b56f55d5f1b), [`fb84c21`](https://github.com/mastra-ai/mastra/commit/fb84c21859d09bdc8f158bd5412bdc4b5835a61c), [`5802bf5`](https://github.com/mastra-ai/mastra/commit/5802bf57f6182e4b67c28d7d91abed349a8d14f3), [`5bda53a`](https://github.com/mastra-ai/mastra/commit/5bda53a9747bfa7d876d754fc92c83a06e503f62), [`c2eade3`](https://github.com/mastra-ai/mastra/commit/c2eade3508ef309662f065e5f340d7840295dd53), [`f26a8fd`](https://github.com/mastra-ai/mastra/commit/f26a8fd99fcb0497a5d86c28324430d7f6a5fb83), [`8a3f5e4`](https://github.com/mastra-ai/mastra/commit/8a3f5e4212ec36b302957deb4bd47005ab598382), [`7e82fbf`](https://github.com/mastra-ai/mastra/commit/7e82fbf3715175e274d2015eb59fb7f57dc9b09d), [`222965a`](https://github.com/mastra-ai/mastra/commit/222965a98ce8197b86673ec594244650b5960257), [`6047778`](https://github.com/mastra-ai/mastra/commit/6047778e501df460648f31decddf8e443f36e373), [`a0f5f1c`](https://github.com/mastra-ai/mastra/commit/a0f5f1ca39c3c5c6d26202e9fcab986b4fe14568), [`9d4fc09`](https://github.com/mastra-ai/mastra/commit/9d4fc09b2ad55caa7738c7ceb3a905e454f74cdd), [`05c7abf`](https://github.com/mastra-ai/mastra/commit/05c7abfe105a015b7760c9bf33ff4419727502a0), [`0324ceb`](https://github.com/mastra-ai/mastra/commit/0324ceb8af9d16c12a531f90e575f6aab797ac81), [`d75ccf0`](https://github.com/mastra-ai/mastra/commit/d75ccf06dfd2582b916aa12624e3cd61b279edf1), [`0f9d227`](https://github.com/mastra-ai/mastra/commit/0f9d227890a98db33865abbea39daf407cd55ef7), [`b356f5f`](https://github.com/mastra-ai/mastra/commit/b356f5f7566cb3edb755d91f00b72fc1420b2a37), [`de056a0`](https://github.com/mastra-ai/mastra/commit/de056a02cbb43f6aa0380ab2150ea404af9ec0dd), [`f5ce05f`](https://github.com/mastra-ai/mastra/commit/f5ce05f831d42c69559bf4c0fdb46ccb920fc3a3), [`60c9cec`](https://github.com/mastra-ai/mastra/commit/60c9cec7048a79a87440f7840c383875bd710d93), [`c93532a`](https://github.com/mastra-ai/mastra/commit/c93532a340b80e4dd946d4c138d9381de5f70399), [`6c33d7f`](https://github.com/mastra-ai/mastra/commit/6c33d7f7242804c32e969ad3ab33ff4a6aebda8b), [`6cb1fcb`](https://github.com/mastra-ai/mastra/commit/6cb1fcbc8d0378ffed0d17784c96e68f30cb0272), [`aee4f00`](https://github.com/mastra-ai/mastra/commit/aee4f00e61e1a42e81a6d74ff149dbe69e32695a), [`f0ab020`](https://github.com/mastra-ai/mastra/commit/f0ab02034532a4afb71a1ef4fe243f9a8dffde84), [`9f6f30f`](https://github.com/mastra-ai/mastra/commit/9f6f30f04ec6648bbca798ea8aad59317c40d8db), [`547c621`](https://github.com/mastra-ai/mastra/commit/547c62104af3f7a551b3754e9cbdf0a3fbba15e4), [`897995e`](https://github.com/mastra-ai/mastra/commit/897995e630d572fe2891e7ede817938cabb43251), [`0fed8f2`](https://github.com/mastra-ai/mastra/commit/0fed8f2aa84b167b3415ea6f8f70755775132c8d), [`4f9ea8c`](https://github.com/mastra-ai/mastra/commit/4f9ea8c95ea74ba9abbf3b2ab6106c7d7bc45689), [`1a1fbe6`](https://github.com/mastra-ai/mastra/commit/1a1fbe66efb7d94abc373ed0dd9676adb8122454), [`d706fad`](https://github.com/mastra-ai/mastra/commit/d706fad6e6e4b72357b18d229ba38e6c913c0e70), [`87fd07f`](https://github.com/mastra-ai/mastra/commit/87fd07ff35387a38728967163460231b5d33ae3b), [`8a3f5e4`](https://github.com/mastra-ai/mastra/commit/8a3f5e4212ec36b302957deb4bd47005ab598382), [`5c3768f`](https://github.com/mastra-ai/mastra/commit/5c3768fa959454232ad76715c381f4aac00c6881), [`2685a78`](https://github.com/mastra-ai/mastra/commit/2685a78f224b8b04e20d4fab5ac1adb638190071), [`36f39c0`](https://github.com/mastra-ai/mastra/commit/36f39c00dc794952dc3c11aab91c2fa8bca74b11), [`239b5a4`](https://github.com/mastra-ai/mastra/commit/239b5a497aeae2e8b4d764f46217cfff2284788e), [`8a3f5e4`](https://github.com/mastra-ai/mastra/commit/8a3f5e4212ec36b302957deb4bd47005ab598382)]:
  - @mastra/core@0.17.0
  - @mastra/deployer@0.17.0
  - @mastra/loggers@0.10.12
  - @mastra/mcp@0.13.0

## 0.13.0-alpha.5

### Patch Changes

- fix error message when fetching observability things ([#7956](https://github.com/mastra-ai/mastra/pull/7956))

- Updated dependencies [[`4f9ea8c`](https://github.com/mastra-ai/mastra/commit/4f9ea8c95ea74ba9abbf3b2ab6106c7d7bc45689)]:
  - @mastra/core@0.17.0-alpha.7
  - @mastra/deployer@0.17.0-alpha.7

## 0.13.0-alpha.4

### Patch Changes

- clean up console logs in monorepo ([#7926](https://github.com/mastra-ai/mastra/pull/7926))

- fix scorers table link full row ([#7915](https://github.com/mastra-ai/mastra/pull/7915))

- adjust the way we display scorers in agent metadata ([#7910](https://github.com/mastra-ai/mastra/pull/7910))

- Updated dependencies [[`197cbb2`](https://github.com/mastra-ai/mastra/commit/197cbb248fc8cb4bbf61bf70b770f1388b445df2), [`197cbb2`](https://github.com/mastra-ai/mastra/commit/197cbb248fc8cb4bbf61bf70b770f1388b445df2), [`6590763`](https://github.com/mastra-ai/mastra/commit/65907630ef4bf4127067cecd1cb21b56f55d5f1b), [`c2eade3`](https://github.com/mastra-ai/mastra/commit/c2eade3508ef309662f065e5f340d7840295dd53), [`222965a`](https://github.com/mastra-ai/mastra/commit/222965a98ce8197b86673ec594244650b5960257), [`0324ceb`](https://github.com/mastra-ai/mastra/commit/0324ceb8af9d16c12a531f90e575f6aab797ac81), [`0f9d227`](https://github.com/mastra-ai/mastra/commit/0f9d227890a98db33865abbea39daf407cd55ef7), [`de056a0`](https://github.com/mastra-ai/mastra/commit/de056a02cbb43f6aa0380ab2150ea404af9ec0dd), [`c93532a`](https://github.com/mastra-ai/mastra/commit/c93532a340b80e4dd946d4c138d9381de5f70399), [`6c33d7f`](https://github.com/mastra-ai/mastra/commit/6c33d7f7242804c32e969ad3ab33ff4a6aebda8b), [`6cb1fcb`](https://github.com/mastra-ai/mastra/commit/6cb1fcbc8d0378ffed0d17784c96e68f30cb0272), [`2685a78`](https://github.com/mastra-ai/mastra/commit/2685a78f224b8b04e20d4fab5ac1adb638190071), [`239b5a4`](https://github.com/mastra-ai/mastra/commit/239b5a497aeae2e8b4d764f46217cfff2284788e)]:
  - @mastra/core@0.17.0-alpha.6
  - @mastra/deployer@0.17.0-alpha.6
  - @mastra/loggers@0.10.12-alpha.1
  - @mastra/mcp@0.13.0-alpha.2

## 0.13.0-alpha.3

### Patch Changes

- update playground workflows to use createRunAsync instead of createRun ([#7903](https://github.com/mastra-ai/mastra/pull/7903))

- Updated dependencies [[`6047778`](https://github.com/mastra-ai/mastra/commit/6047778e501df460648f31decddf8e443f36e373)]:
  - @mastra/core@0.17.0-alpha.5
  - @mastra/deployer@0.17.0-alpha.5

## 0.13.0-alpha.2

### Patch Changes

- Updated dependencies [[`fb84c21`](https://github.com/mastra-ai/mastra/commit/fb84c21859d09bdc8f158bd5412bdc4b5835a61c), [`9d4fc09`](https://github.com/mastra-ai/mastra/commit/9d4fc09b2ad55caa7738c7ceb3a905e454f74cdd), [`d75ccf0`](https://github.com/mastra-ai/mastra/commit/d75ccf06dfd2582b916aa12624e3cd61b279edf1), [`0fed8f2`](https://github.com/mastra-ai/mastra/commit/0fed8f2aa84b167b3415ea6f8f70755775132c8d), [`87fd07f`](https://github.com/mastra-ai/mastra/commit/87fd07ff35387a38728967163460231b5d33ae3b)]:
  - @mastra/core@0.17.0-alpha.4
  - @mastra/mcp@0.13.0-alpha.1
  - @mastra/deployer@0.17.0-alpha.4

## 0.13.0-alpha.1

### Minor Changes

- Improved workspace dependency resolution during development and builds. This makes the build process more reliable when working with monorepos and workspace packages, reducing potential bundling errors and improving development experience. ([#7619](https://github.com/mastra-ai/mastra/pull/7619))

### Patch Changes

- Improve the `mastra init` CLI. ([#7837](https://github.com/mastra-ai/mastra/pull/7837))

  Previously, when you ran `mastra init` in a directory without a `package.json` file you'd receive no output. Now the CLI shows an error with next steps. Additionally, `mastra init` now also installs `zod` if not present already.

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

- dependencies updates: ([#7810](https://github.com/mastra-ai/mastra/pull/7810))
  - Updated dependency [`strip-json-comments@^5.0.3` ↗︎](https://www.npmjs.com/package/strip-json-comments/v/5.0.3) (from `^5.0.2`, in `dependencies`)

- fix markdown rendering in agent in agent text-delta ([#7851](https://github.com/mastra-ai/mastra/pull/7851))

- fix workflows runs fetching and displaying ([#7852](https://github.com/mastra-ai/mastra/pull/7852))

- fix empty state for scorers on agent page ([#7846](https://github.com/mastra-ai/mastra/pull/7846))

- Updated dependencies [[`b1c155b`](https://github.com/mastra-ai/mastra/commit/b1c155b57ce702674f207f1d4c6a4ebf94225f44), [`790f7d1`](https://github.com/mastra-ai/mastra/commit/790f7d17895d7a5f75b6b5d2d794c2e820b99d4c), [`3cd6538`](https://github.com/mastra-ai/mastra/commit/3cd6538811fc94f84a19dbd1064f46cb42e38c1d), [`a1bb887`](https://github.com/mastra-ai/mastra/commit/a1bb887e8bfae44230f487648da72e96ef824561), [`8a3f5e4`](https://github.com/mastra-ai/mastra/commit/8a3f5e4212ec36b302957deb4bd47005ab598382), [`7e82fbf`](https://github.com/mastra-ai/mastra/commit/7e82fbf3715175e274d2015eb59fb7f57dc9b09d), [`a0f5f1c`](https://github.com/mastra-ai/mastra/commit/a0f5f1ca39c3c5c6d26202e9fcab986b4fe14568), [`b356f5f`](https://github.com/mastra-ai/mastra/commit/b356f5f7566cb3edb755d91f00b72fc1420b2a37), [`f5ce05f`](https://github.com/mastra-ai/mastra/commit/f5ce05f831d42c69559bf4c0fdb46ccb920fc3a3), [`9f6f30f`](https://github.com/mastra-ai/mastra/commit/9f6f30f04ec6648bbca798ea8aad59317c40d8db), [`d706fad`](https://github.com/mastra-ai/mastra/commit/d706fad6e6e4b72357b18d229ba38e6c913c0e70), [`8a3f5e4`](https://github.com/mastra-ai/mastra/commit/8a3f5e4212ec36b302957deb4bd47005ab598382), [`5c3768f`](https://github.com/mastra-ai/mastra/commit/5c3768fa959454232ad76715c381f4aac00c6881), [`8a3f5e4`](https://github.com/mastra-ai/mastra/commit/8a3f5e4212ec36b302957deb4bd47005ab598382)]:
  - @mastra/deployer@0.17.0-alpha.3
  - @mastra/core@0.17.0-alpha.3
  - @mastra/loggers@0.10.12-alpha.0
  - @mastra/mcp@0.12.1-alpha.0

## 0.12.4-alpha.0

### Patch Changes

- fix minor playground stuff for observability ([#7765](https://github.com/mastra-ai/mastra/pull/7765))

- Handle zod intersections in dynamic form ([#7768](https://github.com/mastra-ai/mastra/pull/7768))

- Playground ui -pass runtimeContext to client SDK get methods ([#7767](https://github.com/mastra-ai/mastra/pull/7767))

- Updated dependencies [[`5802bf5`](https://github.com/mastra-ai/mastra/commit/5802bf57f6182e4b67c28d7d91abed349a8d14f3), [`5bda53a`](https://github.com/mastra-ai/mastra/commit/5bda53a9747bfa7d876d754fc92c83a06e503f62), [`f26a8fd`](https://github.com/mastra-ai/mastra/commit/f26a8fd99fcb0497a5d86c28324430d7f6a5fb83), [`f0ab020`](https://github.com/mastra-ai/mastra/commit/f0ab02034532a4afb71a1ef4fe243f9a8dffde84), [`1a1fbe6`](https://github.com/mastra-ai/mastra/commit/1a1fbe66efb7d94abc373ed0dd9676adb8122454), [`36f39c0`](https://github.com/mastra-ai/mastra/commit/36f39c00dc794952dc3c11aab91c2fa8bca74b11)]:
  - @mastra/core@0.16.4-alpha.0
  - @mastra/deployer@0.16.4-alpha.0

## 0.12.3

### Patch Changes

- Client SDK Agents, Mastra server - support runtimeContext with GET requests ([#7734](https://github.com/mastra-ai/mastra/pull/7734))

- Add new scorers to list ([#7614](https://github.com/mastra-ai/mastra/pull/7614))

- fix playground UI issue about dynmic workflow exec in agent thread ([#7665](https://github.com/mastra-ai/mastra/pull/7665))

- Updated dependencies [[`b4379f7`](https://github.com/mastra-ai/mastra/commit/b4379f703fd74474f253420e8c3a684f2c4b2f8e), [`b4379f7`](https://github.com/mastra-ai/mastra/commit/b4379f703fd74474f253420e8c3a684f2c4b2f8e), [`2a6585f`](https://github.com/mastra-ai/mastra/commit/2a6585f7cb71f023f805d521d1c3c95fb9a3aa59), [`3d26e83`](https://github.com/mastra-ai/mastra/commit/3d26e8353a945719028f087cc6ac4b06f0ce27d2), [`dd9119b`](https://github.com/mastra-ai/mastra/commit/dd9119b175a8f389082f75c12750e51f96d65dca), [`d34aaa1`](https://github.com/mastra-ai/mastra/commit/d34aaa1da5d3c5f991740f59e2fe6d28d3e2dd91), [`56e55d1`](https://github.com/mastra-ai/mastra/commit/56e55d1e9eb63e7d9e41aa46e012aae471256812), [`ce1e580`](https://github.com/mastra-ai/mastra/commit/ce1e580f6391e94a0c6816a9c5db0a21566a262f), [`b2babfa`](https://github.com/mastra-ai/mastra/commit/b2babfa9e75b22f2759179e71d8473f6dc5421ed), [`d8c3ba5`](https://github.com/mastra-ai/mastra/commit/d8c3ba516f4173282d293f7e64769cfc8738d360), [`a566c4e`](https://github.com/mastra-ai/mastra/commit/a566c4e92d86c1671707c54359b1d33934f7cc13), [`0666082`](https://github.com/mastra-ai/mastra/commit/06660820230dcb1fa7c1d51c8254107afd68cd67), [`af333aa`](https://github.com/mastra-ai/mastra/commit/af333aa30fe6d1b127024b03a64736c46eddeca2), [`4c81b65`](https://github.com/mastra-ai/mastra/commit/4c81b65a28d128560bdf63bc9b8a1bddd4884812), [`3863c52`](https://github.com/mastra-ai/mastra/commit/3863c52d44b4e5779968b802d977e87adf939d8e), [`6424c7e`](https://github.com/mastra-ai/mastra/commit/6424c7ec38b6921d66212431db1e0958f441b2a7), [`db94750`](https://github.com/mastra-ai/mastra/commit/db94750a41fd29b43eb1f7ce8e97ba8b9978c91b), [`a66a371`](https://github.com/mastra-ai/mastra/commit/a66a3716b00553d7f01842be9deb34f720b10fab), [`69fc3cd`](https://github.com/mastra-ai/mastra/commit/69fc3cd0fd814901785bdcf49bf536ab1e7fd975)]:
  - @mastra/core@0.16.3
  - @mastra/deployer@0.16.3

## 0.12.3-alpha.1

### Patch Changes

- Client SDK Agents, Mastra server - support runtimeContext with GET requests ([#7734](https://github.com/mastra-ai/mastra/pull/7734))

- Updated dependencies [[`2a6585f`](https://github.com/mastra-ai/mastra/commit/2a6585f7cb71f023f805d521d1c3c95fb9a3aa59), [`3d26e83`](https://github.com/mastra-ai/mastra/commit/3d26e8353a945719028f087cc6ac4b06f0ce27d2), [`56e55d1`](https://github.com/mastra-ai/mastra/commit/56e55d1e9eb63e7d9e41aa46e012aae471256812), [`4c81b65`](https://github.com/mastra-ai/mastra/commit/4c81b65a28d128560bdf63bc9b8a1bddd4884812)]:
  - @mastra/core@0.16.3-alpha.1
  - @mastra/deployer@0.16.3-alpha.1

## 0.12.3-alpha.0

### Patch Changes

- Add new scorers to list ([#7614](https://github.com/mastra-ai/mastra/pull/7614))

- fix playground UI issue about dynmic workflow exec in agent thread ([#7665](https://github.com/mastra-ai/mastra/pull/7665))

- Updated dependencies [[`b4379f7`](https://github.com/mastra-ai/mastra/commit/b4379f703fd74474f253420e8c3a684f2c4b2f8e), [`b4379f7`](https://github.com/mastra-ai/mastra/commit/b4379f703fd74474f253420e8c3a684f2c4b2f8e), [`dd9119b`](https://github.com/mastra-ai/mastra/commit/dd9119b175a8f389082f75c12750e51f96d65dca), [`d34aaa1`](https://github.com/mastra-ai/mastra/commit/d34aaa1da5d3c5f991740f59e2fe6d28d3e2dd91), [`ce1e580`](https://github.com/mastra-ai/mastra/commit/ce1e580f6391e94a0c6816a9c5db0a21566a262f), [`b2babfa`](https://github.com/mastra-ai/mastra/commit/b2babfa9e75b22f2759179e71d8473f6dc5421ed), [`d8c3ba5`](https://github.com/mastra-ai/mastra/commit/d8c3ba516f4173282d293f7e64769cfc8738d360), [`a566c4e`](https://github.com/mastra-ai/mastra/commit/a566c4e92d86c1671707c54359b1d33934f7cc13), [`0666082`](https://github.com/mastra-ai/mastra/commit/06660820230dcb1fa7c1d51c8254107afd68cd67), [`af333aa`](https://github.com/mastra-ai/mastra/commit/af333aa30fe6d1b127024b03a64736c46eddeca2), [`3863c52`](https://github.com/mastra-ai/mastra/commit/3863c52d44b4e5779968b802d977e87adf939d8e), [`6424c7e`](https://github.com/mastra-ai/mastra/commit/6424c7ec38b6921d66212431db1e0958f441b2a7), [`db94750`](https://github.com/mastra-ai/mastra/commit/db94750a41fd29b43eb1f7ce8e97ba8b9978c91b), [`a66a371`](https://github.com/mastra-ai/mastra/commit/a66a3716b00553d7f01842be9deb34f720b10fab), [`69fc3cd`](https://github.com/mastra-ai/mastra/commit/69fc3cd0fd814901785bdcf49bf536ab1e7fd975)]:
  - @mastra/core@0.16.3-alpha.0
  - @mastra/deployer@0.16.3-alpha.0

## 0.12.2

### Patch Changes

- Updated dependencies [[`61926ef`](https://github.com/mastra-ai/mastra/commit/61926ef40d415b805a63527cffe27a50542e15e5)]:
  - @mastra/core@0.16.2
  - @mastra/deployer@0.16.2

## 0.12.2-alpha.0

### Patch Changes

- Updated dependencies [[`61926ef`](https://github.com/mastra-ai/mastra/commit/61926ef40d415b805a63527cffe27a50542e15e5)]:
  - @mastra/core@0.16.2-alpha.0
  - @mastra/deployer@0.16.2-alpha.0

## 0.12.1

### Patch Changes

- dependencies updates: ([#7544](https://github.com/mastra-ai/mastra/pull/7544))
  - Updated dependency [`fs-extra@^11.3.1` ↗︎](https://www.npmjs.com/package/fs-extra/v/11.3.1) (from `^11.3.0`, in `dependencies`)

- Use workflow streamVNext in playground ([#7575](https://github.com/mastra-ai/mastra/pull/7575))

- add workflow streaming in agent thread ([#7506](https://github.com/mastra-ai/mastra/pull/7506))

- Fix template slug when getting template environment variables ([#7650](https://github.com/mastra-ai/mastra/pull/7650))

- Update cli dev copy from "Local" - ([#7579](https://github.com/mastra-ai/mastra/pull/7579))

- Updated dependencies [[`6d6e5dd`](https://github.com/mastra-ai/mastra/commit/6d6e5dd00edd5f4d2f310d347c615aef3ed7f609), [`0f7b8c0`](https://github.com/mastra-ai/mastra/commit/0f7b8c0c22d2a677a0f71c35ad1bc2d60b063d39), [`47b6dc9`](https://github.com/mastra-ai/mastra/commit/47b6dc94f4976d4f3d3882e8f19eb365bbc5976c), [`827d876`](https://github.com/mastra-ai/mastra/commit/827d8766f36a900afcaf64a040f7ba76249009b3), [`0662d02`](https://github.com/mastra-ai/mastra/commit/0662d02ef16916e67531890639fcd72c69cfb6e2), [`565d65f`](https://github.com/mastra-ai/mastra/commit/565d65fc16314a99f081975ec92f2636dff0c86d), [`6189844`](https://github.com/mastra-ai/mastra/commit/61898448e65bda02bb814fb15801a89dc6476938), [`4da3d68`](https://github.com/mastra-ai/mastra/commit/4da3d68a778e5c4d5a17351ef223289fe2f45a45), [`90cab34`](https://github.com/mastra-ai/mastra/commit/90cab347db71359dc5f3d001b1e8d63fd958879a), [`fd9bbfe`](https://github.com/mastra-ai/mastra/commit/fd9bbfee22484f8493582325f53e8171bf8e682b), [`e75360a`](https://github.com/mastra-ai/mastra/commit/e75360a134d722df969777abcf36092fadad1f12), [`7eaf1d1`](https://github.com/mastra-ai/mastra/commit/7eaf1d1cec7e828d7a98efc2a748ac395bbdba3b), [`6f046b5`](https://github.com/mastra-ai/mastra/commit/6f046b5ccc5c8721302a9a61d5d16c12374cc8d7), [`d7a8f59`](https://github.com/mastra-ai/mastra/commit/d7a8f59154b0621aec4f41a6b2ea2b3882f03cb7), [`0b0bbb2`](https://github.com/mastra-ai/mastra/commit/0b0bbb24f4198ead69792e92b68a350f52b45cf3), [`d951f41`](https://github.com/mastra-ai/mastra/commit/d951f41771e4e5da8da4b9f870949f9509e38756), [`4dda259`](https://github.com/mastra-ai/mastra/commit/4dda2593b6343f9258671de5fb237aeba3ef6bb7), [`8049e2e`](https://github.com/mastra-ai/mastra/commit/8049e2e8cce80a00353c64894c62b695ac34e35e), [`f3427cd`](https://github.com/mastra-ai/mastra/commit/f3427cdaf9eecd63360dfc897a4acbf5f4143a4e), [`defed1c`](https://github.com/mastra-ai/mastra/commit/defed1ca8040cc8d42e645c5a50a1bc52a4918d7), [`79b39c1`](https://github.com/mastra-ai/mastra/commit/79b39c1def3bbd5d6ee2d2cc1e89ea378a940477), [`6991ced`](https://github.com/mastra-ai/mastra/commit/6991cedcb5a44a49d9fe58ef67926e1f96ba55b1), [`9cb9c42`](https://github.com/mastra-ai/mastra/commit/9cb9c422854ee81074989dd2d8dccc0500ba8d3e), [`f36343e`](https://github.com/mastra-ai/mastra/commit/f36343e02935b9a112a45b2dc3de7b562cc3aa68), [`8334859`](https://github.com/mastra-ai/mastra/commit/83348594d4f37b311ba4a94d679c5f8721d796d4), [`05f13b8`](https://github.com/mastra-ai/mastra/commit/05f13b8fb269ccfc4de98e9db58dbe16eae55a5e)]:
  - @mastra/deployer@0.16.1
  - @mastra/mcp@0.12.0
  - @mastra/core@0.16.1

## 0.12.1-alpha.2

### Patch Changes

- Fix template slug when getting template environment variables ([#7650](https://github.com/mastra-ai/mastra/pull/7650))

- Updated dependencies [[`fd9bbfe`](https://github.com/mastra-ai/mastra/commit/fd9bbfee22484f8493582325f53e8171bf8e682b)]:
  - @mastra/core@0.16.1-alpha.3
  - @mastra/deployer@0.16.1-alpha.3

## 0.12.1-alpha.1

### Patch Changes

- Use workflow streamVNext in playground ([#7575](https://github.com/mastra-ai/mastra/pull/7575))

- add workflow streaming in agent thread ([#7506](https://github.com/mastra-ai/mastra/pull/7506))

- Updated dependencies [[`0f7b8c0`](https://github.com/mastra-ai/mastra/commit/0f7b8c0c22d2a677a0f71c35ad1bc2d60b063d39), [`47b6dc9`](https://github.com/mastra-ai/mastra/commit/47b6dc94f4976d4f3d3882e8f19eb365bbc5976c), [`565d65f`](https://github.com/mastra-ai/mastra/commit/565d65fc16314a99f081975ec92f2636dff0c86d), [`4da3d68`](https://github.com/mastra-ai/mastra/commit/4da3d68a778e5c4d5a17351ef223289fe2f45a45), [`0b0bbb2`](https://github.com/mastra-ai/mastra/commit/0b0bbb24f4198ead69792e92b68a350f52b45cf3), [`d951f41`](https://github.com/mastra-ai/mastra/commit/d951f41771e4e5da8da4b9f870949f9509e38756), [`8049e2e`](https://github.com/mastra-ai/mastra/commit/8049e2e8cce80a00353c64894c62b695ac34e35e), [`f36343e`](https://github.com/mastra-ai/mastra/commit/f36343e02935b9a112a45b2dc3de7b562cc3aa68)]:
  - @mastra/mcp@0.12.0-alpha.1
  - @mastra/core@0.16.1-alpha.1
  - @mastra/deployer@0.16.1-alpha.1

## 0.12.1-alpha.0

### Patch Changes

- dependencies updates: ([#7544](https://github.com/mastra-ai/mastra/pull/7544))
  - Updated dependency [`fs-extra@^11.3.1` ↗︎](https://www.npmjs.com/package/fs-extra/v/11.3.1) (from `^11.3.0`, in `dependencies`)

- Update cli dev copy from "Local" - ([#7579](https://github.com/mastra-ai/mastra/pull/7579))

- Updated dependencies [[`6d6e5dd`](https://github.com/mastra-ai/mastra/commit/6d6e5dd00edd5f4d2f310d347c615aef3ed7f609), [`0662d02`](https://github.com/mastra-ai/mastra/commit/0662d02ef16916e67531890639fcd72c69cfb6e2), [`6189844`](https://github.com/mastra-ai/mastra/commit/61898448e65bda02bb814fb15801a89dc6476938), [`90cab34`](https://github.com/mastra-ai/mastra/commit/90cab347db71359dc5f3d001b1e8d63fd958879a), [`e75360a`](https://github.com/mastra-ai/mastra/commit/e75360a134d722df969777abcf36092fadad1f12), [`d7a8f59`](https://github.com/mastra-ai/mastra/commit/d7a8f59154b0621aec4f41a6b2ea2b3882f03cb7), [`4dda259`](https://github.com/mastra-ai/mastra/commit/4dda2593b6343f9258671de5fb237aeba3ef6bb7), [`defed1c`](https://github.com/mastra-ai/mastra/commit/defed1ca8040cc8d42e645c5a50a1bc52a4918d7), [`79b39c1`](https://github.com/mastra-ai/mastra/commit/79b39c1def3bbd5d6ee2d2cc1e89ea378a940477), [`6991ced`](https://github.com/mastra-ai/mastra/commit/6991cedcb5a44a49d9fe58ef67926e1f96ba55b1), [`9cb9c42`](https://github.com/mastra-ai/mastra/commit/9cb9c422854ee81074989dd2d8dccc0500ba8d3e), [`8334859`](https://github.com/mastra-ai/mastra/commit/83348594d4f37b311ba4a94d679c5f8721d796d4)]:
  - @mastra/deployer@0.16.1-alpha.0
  - @mastra/core@0.16.1-alpha.0
  - @mastra/mcp@0.12.0-alpha.0

## 0.12.0

### Minor Changes

- a01cf14: Add workflow graph in agent (workflow as tool in agent)

### Patch Changes

- cf4e353: Agent Builder Template - adding in UI components to use agent builder template actions
- 788e612: Fix playground workflow graph is broken when workflow starts with a branch
- 5397eb4: Add public URL support when adding files in Multi Modal
- 376913a: Update peerdeps
- Updated dependencies [8fbf79e]
- Updated dependencies [cf4e353]
- Updated dependencies [fd83526]
- Updated dependencies [d0b90ab]
- Updated dependencies [6f5eb7a]
- Updated dependencies [a01cf14]
- Updated dependencies [a9e50ee]
- Updated dependencies [5397eb4]
- Updated dependencies [376913a]
- Updated dependencies [c9f4e4a]
- Updated dependencies [0acbc80]
- Updated dependencies [376913a]
  - @mastra/core@0.16.0
  - @mastra/deployer@0.16.0
  - @mastra/loggers@0.10.11
  - @mastra/mcp@0.11.4

## 0.12.0-alpha.1

### Patch Changes

- 376913a: Update peerdeps
- Updated dependencies [8fbf79e]
- Updated dependencies [376913a]
- Updated dependencies [376913a]
  - @mastra/core@0.16.0-alpha.1
  - @mastra/loggers@0.10.11-alpha.0
  - @mastra/mcp@0.11.4-alpha.0
  - @mastra/deployer@0.16.0-alpha.1

## 0.12.0-alpha.0

### Minor Changes

- a01cf14: Add workflow graph in agent (workflow as tool in agent)

### Patch Changes

- cf4e353: Agent Builder Template - adding in UI components to use agent builder template actions
- 788e612: Fix playground workflow graph is broken when workflow starts with a branch
- 5397eb4: Add public URL support when adding files in Multi Modal
- Updated dependencies [cf4e353]
- Updated dependencies [fd83526]
- Updated dependencies [d0b90ab]
- Updated dependencies [6f5eb7a]
- Updated dependencies [a01cf14]
- Updated dependencies [a9e50ee]
- Updated dependencies [5397eb4]
- Updated dependencies [c9f4e4a]
- Updated dependencies [0acbc80]
  - @mastra/deployer@0.16.0-alpha.0
  - @mastra/core@0.16.0-alpha.0

## 0.11.3

### Patch Changes

- 64152fd: Improve output of Cli Dev command
- de3cbc6: Update the `package.json` file to include additional fields like `repository`, `homepage` or `files`.
- 26b0d7c: Cleanup pkg output
- 8e4fe90: Unify focus outlines
- 2f55297: Fix issue when using `yarn dlx create-mastra`
- e3d8fea: Support Inngest flow control features for Mastra Inngest workflows
- f539199: mastra start - load env files, custom env. Deperecate --env flag for mastra build
- ab48c97: dependencies updates:
  - Updated dependency [`zod-to-json-schema@^3.24.6` ↗︎](https://www.npmjs.com/package/zod-to-json-schema/v/3.24.6) (from `^3.24.5`, in `dependencies`)
- 87de958: fix chat outline
- 6f715fe: Fix plyground baseUrl, default api baseUrl to playground baseUrl
- 01264f1: Mastra dev- load env vars before watch
- 3308c9f: fix dev:playground command
- d99baf6: change outline
- 8f22a2c: During package installation do not print audit, funding or any non-error logs
- Updated dependencies [ab48c97]
- Updated dependencies [3e0bd2a]
- Updated dependencies [2b64943]
- Updated dependencies [85ef90b]
- Updated dependencies [aedbbfa]
- Updated dependencies [ff89505]
- Updated dependencies [637f323]
- Updated dependencies [de3cbc6]
- Updated dependencies [c19bcf7]
- Updated dependencies [4474d04]
- Updated dependencies [183dc95]
- Updated dependencies [a1111e2]
- Updated dependencies [b42a961]
- Updated dependencies [71b657b]
- Updated dependencies [61debef]
- Updated dependencies [9beaeff]
- Updated dependencies [29de0e1]
- Updated dependencies [f643c65]
- Updated dependencies [00c74e7]
- Updated dependencies [f0dfcac]
- Updated dependencies [fef7375]
- Updated dependencies [6d98856]
- Updated dependencies [e3d8fea]
- Updated dependencies [45e4d39]
- Updated dependencies [ad78bfc]
- Updated dependencies [9eee594]
- Updated dependencies [7149d8d]
- Updated dependencies [822c2e8]
- Updated dependencies [3b8972b]
- Updated dependencies [979912c]
- Updated dependencies [7dcf4c0]
- Updated dependencies [4106a58]
- Updated dependencies [ad78bfc]
- Updated dependencies [6f715fe]
- Updated dependencies [48f0742]
- Updated dependencies [0302f50]
- Updated dependencies [12adcc8]
- Updated dependencies [6ac697e]
- Updated dependencies [74db265]
- Updated dependencies [6cffb99]
- Updated dependencies [0ce418a]
- Updated dependencies [3e0153a]
- Updated dependencies [af90672]
- Updated dependencies [8387952]
- Updated dependencies [7f3b8da]
- Updated dependencies [905352b]
- Updated dependencies [599d04c]
- Updated dependencies [a6e2254]
- Updated dependencies [56041d0]
- Updated dependencies [3412597]
- Updated dependencies [5eca5d2]
- Updated dependencies [8f22a2c]
- Updated dependencies [f2cda47]
- Updated dependencies [5de1555]
- Updated dependencies [cfd377a]
- Updated dependencies [1ed5a3e]
- Updated dependencies [03d0c39]
  - @mastra/core@0.15.3
  - @mastra/deployer@0.15.3
  - @mastra/loggers@0.10.10
  - @mastra/mcp@0.11.3

## 0.11.3-alpha.4

### Patch Changes

- [#7358](https://github.com/mastra-ai/mastra/pull/7358) [`2f55297`](https://github.com/mastra-ai/mastra/commit/2f552975f4eb602f24c9e811c18587a65f620d72) Thanks [@LekoArts](https://github.com/LekoArts)! - Fix issue when using `yarn dlx create-mastra`

- [#7357](https://github.com/mastra-ai/mastra/pull/7357) [`01264f1`](https://github.com/mastra-ai/mastra/commit/01264f1280db040d1bd1ac9b8d29cfcaac3d6cbc) Thanks [@TheIsrael1](https://github.com/TheIsrael1)! - Mastra dev- load env vars before watch

- Updated dependencies [[`c19bcf7`](https://github.com/mastra-ai/mastra/commit/c19bcf7b43542b02157b5e17303e519933a153ab), [`b42a961`](https://github.com/mastra-ai/mastra/commit/b42a961a5aefd19d6e938a7705fc0ecc90e8f756), [`45e4d39`](https://github.com/mastra-ai/mastra/commit/45e4d391a2a09fc70c48e4d60f505586ada1ba0e), [`3b8972b`](https://github.com/mastra-ai/mastra/commit/3b8972bab8161d9fd96f6a41f57181443636cd43), [`0302f50`](https://github.com/mastra-ai/mastra/commit/0302f50861a53c66ff28801fc371b37c5f97e41e), [`74db265`](https://github.com/mastra-ai/mastra/commit/74db265b96aa01a72ffd91dcae0bc3b346cca0f2), [`6cffb99`](https://github.com/mastra-ai/mastra/commit/6cffb99030dc46256e4c3c0e6730565a2825d7a4), [`7f3b8da`](https://github.com/mastra-ai/mastra/commit/7f3b8da6dd21c35d3672e44b4f5dd3502b8f8f92), [`905352b`](https://github.com/mastra-ai/mastra/commit/905352bcda134552400eb252bca1cb05a7975c14), [`f2cda47`](https://github.com/mastra-ai/mastra/commit/f2cda47ae911038c5d5489f54c36517d6f15bdcc), [`cfd377a`](https://github.com/mastra-ai/mastra/commit/cfd377a3a33a9c88b644f6540feed9cd9832db47), [`03d0c39`](https://github.com/mastra-ai/mastra/commit/03d0c3963a748294577dd232a53ee01e1e5bcc12)]:
  - @mastra/core@0.15.3-alpha.6
  - @mastra/mcp@0.11.3-alpha.3
  - @mastra/deployer@0.15.3-alpha.6

## 0.11.3-alpha.3

### Patch Changes

- [#7343](https://github.com/mastra-ai/mastra/pull/7343) [`de3cbc6`](https://github.com/mastra-ai/mastra/commit/de3cbc61079211431bd30487982ea3653517278e) Thanks [@LekoArts](https://github.com/LekoArts)! - Update the `package.json` file to include additional fields like `repository`, `homepage` or `files`.

- Updated dependencies [[`2b64943`](https://github.com/mastra-ai/mastra/commit/2b64943a282c99988c2e5b6e1269bfaca60e6fe3), [`85ef90b`](https://github.com/mastra-ai/mastra/commit/85ef90bb2cd4ae4df855c7ac175f7d392c55c1bf), [`de3cbc6`](https://github.com/mastra-ai/mastra/commit/de3cbc61079211431bd30487982ea3653517278e)]:
  - @mastra/deployer@0.15.3-alpha.5
  - @mastra/core@0.15.3-alpha.5
  - @mastra/loggers@0.10.10-alpha.0
  - @mastra/mcp@0.11.3-alpha.2

## 0.11.3-alpha.2

### Patch Changes

- [#7329](https://github.com/mastra-ai/mastra/pull/7329) [`26b0d7c`](https://github.com/mastra-ai/mastra/commit/26b0d7c7cba46469351d453714e119ac7aae9da2) Thanks [@wardpeet](https://github.com/wardpeet)! - Cleanup pkg output

- [#7218](https://github.com/mastra-ai/mastra/pull/7218) [`f539199`](https://github.com/mastra-ai/mastra/commit/f53919950a9320b292732e0cfcdf61cdae6c8742) Thanks [@TheIsrael1](https://github.com/TheIsrael1)! - mastra start - load env files, custom env. Deperecate --env flag for mastra build

- [#5816](https://github.com/mastra-ai/mastra/pull/5816) [`ab48c97`](https://github.com/mastra-ai/mastra/commit/ab48c979098ea571faf998a55d3a00e7acd7a715) Thanks [@dane-ai-mastra](https://github.com/apps/dane-ai-mastra)! - dependencies updates:
  - Updated dependency [`zod-to-json-schema@^3.24.6` ↗︎](https://www.npmjs.com/package/zod-to-json-schema/v/3.24.6) (from `^3.24.5`, in `dependencies`)

- [#6946](https://github.com/mastra-ai/mastra/pull/6946) [`8f22a2c`](https://github.com/mastra-ai/mastra/commit/8f22a2c35a0a9ddd2f34a9c3ebb6ff6668aa9ea9) Thanks [@LekoArts](https://github.com/LekoArts)! - During package installation do not print audit, funding or any non-error logs

- Updated dependencies [[`ab48c97`](https://github.com/mastra-ai/mastra/commit/ab48c979098ea571faf998a55d3a00e7acd7a715), [`3e0bd2a`](https://github.com/mastra-ai/mastra/commit/3e0bd2aa0a19823939f9a973d44791f4927ff5c3), [`ff89505`](https://github.com/mastra-ai/mastra/commit/ff895057c8c7e91a5535faef46c5e5391085ddfa), [`183dc95`](https://github.com/mastra-ai/mastra/commit/183dc95596f391b977bd1a2c050b8498dac74891), [`a1111e2`](https://github.com/mastra-ai/mastra/commit/a1111e24e705488adfe5e0a6f20c53bddf26cb22), [`61debef`](https://github.com/mastra-ai/mastra/commit/61debefd80ad3a7ed5737e19df6a23d40091689a), [`9beaeff`](https://github.com/mastra-ai/mastra/commit/9beaeffa4a97b1d5fd01a7f8af8708b16067f67c), [`ad78bfc`](https://github.com/mastra-ai/mastra/commit/ad78bfc4ea6a1fff140432bf4f638e01af7af668), [`9eee594`](https://github.com/mastra-ai/mastra/commit/9eee594e35e0ca2a650fcc33fa82009a142b9ed0), [`979912c`](https://github.com/mastra-ai/mastra/commit/979912cfd180aad53287cda08af771df26454e2c), [`7dcf4c0`](https://github.com/mastra-ai/mastra/commit/7dcf4c04f44d9345b1f8bc5d41eae3f11ac61611), [`ad78bfc`](https://github.com/mastra-ai/mastra/commit/ad78bfc4ea6a1fff140432bf4f638e01af7af668), [`48f0742`](https://github.com/mastra-ai/mastra/commit/48f0742662414610dc9a7a99d45902d059ee123d), [`12adcc8`](https://github.com/mastra-ai/mastra/commit/12adcc8929db79b3cf7b83237ebaf6ba2db0181e), [`0ce418a`](https://github.com/mastra-ai/mastra/commit/0ce418a1ccaa5e125d4483a9651b635046152569), [`8387952`](https://github.com/mastra-ai/mastra/commit/838795227b4edf758c84a2adf6f7fba206c27719), [`5eca5d2`](https://github.com/mastra-ai/mastra/commit/5eca5d2655788863ea0442a46c9ef5d3c6dbe0a8), [`8f22a2c`](https://github.com/mastra-ai/mastra/commit/8f22a2c35a0a9ddd2f34a9c3ebb6ff6668aa9ea9)]:
  - @mastra/core@0.15.3-alpha.4
  - @mastra/deployer@0.15.3-alpha.4
  - @mastra/mcp@0.11.3-alpha.1

## 0.11.3-alpha.1

### Patch Changes

- [#7090](https://github.com/mastra-ai/mastra/pull/7090) [`e3d8fea`](https://github.com/mastra-ai/mastra/commit/e3d8feaacfb8b5c5c03c13604cc06ea2873d45fe) Thanks [@K-Mistele](https://github.com/K-Mistele)! - Support Inngest flow control features for Mastra Inngest workflows

- [#7210](https://github.com/mastra-ai/mastra/pull/7210) [`87de958`](https://github.com/mastra-ai/mastra/commit/87de95832a7bdfa9ecb14473c84dc874331f1a7d) Thanks [@mfrachet](https://github.com/mfrachet)! - fix chat outline

- Updated dependencies [[`aedbbfa`](https://github.com/mastra-ai/mastra/commit/aedbbfa064124ddde039111f12629daebfea7e48), [`71b657b`](https://github.com/mastra-ai/mastra/commit/71b657bffebbdcfdf1ce9c6d72003041bd6e200a), [`f643c65`](https://github.com/mastra-ai/mastra/commit/f643c651bdaf57c2343cf9dbfc499010495701fb), [`fef7375`](https://github.com/mastra-ai/mastra/commit/fef737534574f41b432a7361a285f776c3bac42b), [`6d98856`](https://github.com/mastra-ai/mastra/commit/6d98856ed7cf56cbd6c4e02b3254e3dfb1e455db), [`e3d8fea`](https://github.com/mastra-ai/mastra/commit/e3d8feaacfb8b5c5c03c13604cc06ea2873d45fe), [`3412597`](https://github.com/mastra-ai/mastra/commit/3412597a6644c0b6bf3236d6e319ed1450c5bae8)]:
  - @mastra/core@0.15.3-alpha.3
  - @mastra/deployer@0.15.3-alpha.3

## 0.11.3-alpha.0

### Patch Changes

- [#7046](https://github.com/mastra-ai/mastra/pull/7046) [`64152fd`](https://github.com/mastra-ai/mastra/commit/64152fd4e8f8c76612b82a2e4981ee09b22674d7) Thanks [@adeleke5140](https://github.com/adeleke5140)! - Improve output of Cli Dev command

- [#7076](https://github.com/mastra-ai/mastra/pull/7076) [`8e4fe90`](https://github.com/mastra-ai/mastra/commit/8e4fe90605ee4dfcfd911a7f07e1355fe49205ba) Thanks [@mfrachet](https://github.com/mfrachet)! - Unify focus outlines

- [#7115](https://github.com/mastra-ai/mastra/pull/7115) [`6f715fe`](https://github.com/mastra-ai/mastra/commit/6f715fe524296e1138a319e56bcf8e4214bd5dd5) Thanks [@TheIsrael1](https://github.com/TheIsrael1)! - Fix plyground baseUrl, default api baseUrl to playground baseUrl

- [#7044](https://github.com/mastra-ai/mastra/pull/7044) [`3308c9f`](https://github.com/mastra-ai/mastra/commit/3308c9ff1da7594925d193a825f33da2880fb9c1) Thanks [@mfrachet](https://github.com/mfrachet)! - fix dev:playground command

- [#7101](https://github.com/mastra-ai/mastra/pull/7101) [`d99baf6`](https://github.com/mastra-ai/mastra/commit/d99baf6e69bbf83e9a286fbd18c47543de12cb58) Thanks [@mfrachet](https://github.com/mfrachet)! - change outline

- Updated dependencies [[`00c74e7`](https://github.com/mastra-ai/mastra/commit/00c74e73b1926be0d475693bb886fb67a22ff352), [`6f715fe`](https://github.com/mastra-ai/mastra/commit/6f715fe524296e1138a319e56bcf8e4214bd5dd5), [`3e0153a`](https://github.com/mastra-ai/mastra/commit/3e0153adcf2309f3ffb01c9ac9e0f5adc0caa259), [`af90672`](https://github.com/mastra-ai/mastra/commit/af906722d8da28688882193b1e531026f9e2e81e), [`a6e2254`](https://github.com/mastra-ai/mastra/commit/a6e225469159950bb69e8d240d510ec57dc0d79a), [`56041d0`](https://github.com/mastra-ai/mastra/commit/56041d018863a3da6b98c512e47348647c075fb3), [`5de1555`](https://github.com/mastra-ai/mastra/commit/5de15554d3d6695211945a36928f6657e76cddc9), [`1ed5a3e`](https://github.com/mastra-ai/mastra/commit/1ed5a3e19330374c4347a4237cd2f4b9ffb60376)]:
  - @mastra/core@0.15.3-alpha.0
  - @mastra/deployer@0.15.3-alpha.0
  - @mastra/mcp@0.11.3-alpha.0

## 0.11.2

### Patch Changes

- [`c6113ed`](https://github.com/mastra-ai/mastra/commit/c6113ed7f9df297e130d94436ceee310273d6430) Thanks [@wardpeet](https://github.com/wardpeet)! - Fix peerdpes for @mastra/core

- Updated dependencies [[`c6113ed`](https://github.com/mastra-ai/mastra/commit/c6113ed7f9df297e130d94436ceee310273d6430)]:
  - @mastra/deployer@0.15.2
  - @mastra/loggers@0.10.9
  - @mastra/mcp@0.11.2
  - @mastra/core@0.15.2

## 0.11.1

### Patch Changes

- [`95b2aa9`](https://github.com/mastra-ai/mastra/commit/95b2aa908230919e67efcac0d69005a2d5745298) Thanks [@wardpeet](https://github.com/wardpeet)! - Fix peerdeps @mastra/core

- Updated dependencies [[`95b2aa9`](https://github.com/mastra-ai/mastra/commit/95b2aa908230919e67efcac0d69005a2d5745298)]:
  - @mastra/deployer@0.15.1
  - @mastra/loggers@0.10.8
  - @mastra/mcp@0.11.1
  - @mastra/core@0.15.1

## 0.11.0

### Minor Changes

- [#7032](https://github.com/mastra-ai/mastra/pull/7032) [`1191ce9`](https://github.com/mastra-ai/mastra/commit/1191ce946b40ed291e7877a349f8388e3cff7e5c) Thanks [@wardpeet](https://github.com/wardpeet)! - Bump zod peerdep to 3.25.0 to support both v3/v4

### Patch Changes

- [#6938](https://github.com/mastra-ai/mastra/pull/6938) [`0778757`](https://github.com/mastra-ai/mastra/commit/07787570e4addbd501522037bd2542c3d9e26822) Thanks [@dane-ai-mastra](https://github.com/apps/dane-ai-mastra)! - dependencies updates:
  - Updated dependency [`@opentelemetry/auto-instrumentations-node@^0.62.1` ↗︎](https://www.npmjs.com/package/@opentelemetry/auto-instrumentations-node/v/0.62.1) (from `^0.62.0`, in `dependencies`)

- [#6942](https://github.com/mastra-ai/mastra/pull/6942) [`ca8ec2f`](https://github.com/mastra-ai/mastra/commit/ca8ec2f61884b9dfec5fc0d5f4f29d281ad13c01) Thanks [@wardpeet](https://github.com/wardpeet)! - Add zod as peerdeps for all packages

- [#6892](https://github.com/mastra-ai/mastra/pull/6892) [`f61b8c6`](https://github.com/mastra-ai/mastra/commit/f61b8c6b35ec96312d9bb52570578d4f0124467d) Thanks [@wardpeet](https://github.com/wardpeet)! - Improve playground build

- [#6948](https://github.com/mastra-ai/mastra/pull/6948) [`a8070e6`](https://github.com/mastra-ai/mastra/commit/a8070e63ab384ae14a214faaf8634c53b7064bc3) Thanks [@taofeeq-deru](https://github.com/taofeeq-deru)! - Preserve run state in workflows after viewing traces

- Updated dependencies [[`0778757`](https://github.com/mastra-ai/mastra/commit/07787570e4addbd501522037bd2542c3d9e26822), [`e9a36bd`](https://github.com/mastra-ai/mastra/commit/e9a36bd03ed032528b60186a318f563ebf59c01a), [`2b38a60`](https://github.com/mastra-ai/mastra/commit/2b38a60da0c1153028d8241c7748b41c5fb81121), [`e38f807`](https://github.com/mastra-ai/mastra/commit/e38f8072853cc803ba48394e1930825129708400), [`943a7f3`](https://github.com/mastra-ai/mastra/commit/943a7f3dbc6a8ab3f9b7bc7c8a1c5b319c3d7f56), [`681252d`](https://github.com/mastra-ai/mastra/commit/681252d20e57fcee6821377dea96cacab3bc230f), [`01be5d3`](https://github.com/mastra-ai/mastra/commit/01be5d358fad8faa101e5c69dfa54562c02cc0af), [`bf504a8`](https://github.com/mastra-ai/mastra/commit/bf504a833051f6f321d832cc7d631f3cb86d657b), [`24d9ee3`](https://github.com/mastra-ai/mastra/commit/24d9ee3db1c09d15f27a5d0971b102abcfcf7dfd), [`da58ccc`](https://github.com/mastra-ai/mastra/commit/da58ccc1f2ac33da0cb97b00443fc6208b45bdec), [`be49354`](https://github.com/mastra-ai/mastra/commit/be493546dca540101923ec700feb31f9a13939f2), [`d591ab3`](https://github.com/mastra-ai/mastra/commit/d591ab3ecc985c1870c0db347f8d7a20f7360536), [`ba82abe`](https://github.com/mastra-ai/mastra/commit/ba82abe76e869316bb5a9c95e8ea3946f3436fae), [`2a96802`](https://github.com/mastra-ai/mastra/commit/2a96802f76790ebb86a1bcb254398dccf27e5479), [`727f7e5`](https://github.com/mastra-ai/mastra/commit/727f7e5086e62e0dfe3356fb6dcd8bcb420af246), [`e6f5046`](https://github.com/mastra-ai/mastra/commit/e6f50467aff317e67e8bd74c485c3fbe2a5a6db1), [`82d9f64`](https://github.com/mastra-ai/mastra/commit/82d9f647fbe4f0177320e7c05073fce88599aa95), [`2e58325`](https://github.com/mastra-ai/mastra/commit/2e58325beb170f5b92f856e27d915cd26917e5e6), [`1191ce9`](https://github.com/mastra-ai/mastra/commit/1191ce946b40ed291e7877a349f8388e3cff7e5c), [`de24804`](https://github.com/mastra-ai/mastra/commit/de248044e79b407d211b339ce3ed4dc6e1630704), [`4189486`](https://github.com/mastra-ai/mastra/commit/4189486c6718fda78347bdf4ce4d3fc33b2236e1), [`ca8ec2f`](https://github.com/mastra-ai/mastra/commit/ca8ec2f61884b9dfec5fc0d5f4f29d281ad13c01), [`9613558`](https://github.com/mastra-ai/mastra/commit/9613558e6475f4710e05d1be7553a32ee7bddc20)]:
  - @mastra/core@0.15.0
  - @mastra/deployer@0.15.0
  - @mastra/mcp@0.11.0

## 0.11.0-alpha.3

### Minor Changes

- [#7032](https://github.com/mastra-ai/mastra/pull/7032) [`1191ce9`](https://github.com/mastra-ai/mastra/commit/1191ce946b40ed291e7877a349f8388e3cff7e5c) Thanks [@wardpeet](https://github.com/wardpeet)! - Bump zod peerdep to 3.25.0 to support both v3/v4

### Patch Changes

- Updated dependencies [[`1191ce9`](https://github.com/mastra-ai/mastra/commit/1191ce946b40ed291e7877a349f8388e3cff7e5c)]:
  - @mastra/deployer@0.15.0-alpha.4
  - @mastra/core@0.15.0-alpha.4
  - @mastra/mcp@0.11.0-alpha.3

## 0.10.24-alpha.2

### Patch Changes

- Updated dependencies [[`da58ccc`](https://github.com/mastra-ai/mastra/commit/da58ccc1f2ac33da0cb97b00443fc6208b45bdec)]:
  - @mastra/deployer@0.15.0-alpha.3
  - @mastra/mcp@0.11.0-alpha.2
  - @mastra/core@0.15.0-alpha.3

## 0.10.24-alpha.1

### Patch Changes

- [#6942](https://github.com/mastra-ai/mastra/pull/6942) [`ca8ec2f`](https://github.com/mastra-ai/mastra/commit/ca8ec2f61884b9dfec5fc0d5f4f29d281ad13c01) Thanks [@wardpeet](https://github.com/wardpeet)! - Add zod as peerdeps for all packages

- Updated dependencies [[`2b38a60`](https://github.com/mastra-ai/mastra/commit/2b38a60da0c1153028d8241c7748b41c5fb81121), [`943a7f3`](https://github.com/mastra-ai/mastra/commit/943a7f3dbc6a8ab3f9b7bc7c8a1c5b319c3d7f56), [`681252d`](https://github.com/mastra-ai/mastra/commit/681252d20e57fcee6821377dea96cacab3bc230f), [`01be5d3`](https://github.com/mastra-ai/mastra/commit/01be5d358fad8faa101e5c69dfa54562c02cc0af), [`24d9ee3`](https://github.com/mastra-ai/mastra/commit/24d9ee3db1c09d15f27a5d0971b102abcfcf7dfd), [`be49354`](https://github.com/mastra-ai/mastra/commit/be493546dca540101923ec700feb31f9a13939f2), [`d591ab3`](https://github.com/mastra-ai/mastra/commit/d591ab3ecc985c1870c0db347f8d7a20f7360536), [`ba82abe`](https://github.com/mastra-ai/mastra/commit/ba82abe76e869316bb5a9c95e8ea3946f3436fae), [`727f7e5`](https://github.com/mastra-ai/mastra/commit/727f7e5086e62e0dfe3356fb6dcd8bcb420af246), [`82d9f64`](https://github.com/mastra-ai/mastra/commit/82d9f647fbe4f0177320e7c05073fce88599aa95), [`4189486`](https://github.com/mastra-ai/mastra/commit/4189486c6718fda78347bdf4ce4d3fc33b2236e1), [`ca8ec2f`](https://github.com/mastra-ai/mastra/commit/ca8ec2f61884b9dfec5fc0d5f4f29d281ad13c01)]:
  - @mastra/deployer@0.14.2-alpha.1
  - @mastra/core@0.14.2-alpha.1
  - @mastra/mcp@0.10.13-alpha.1

## 0.10.24-alpha.0

### Patch Changes

- [#6938](https://github.com/mastra-ai/mastra/pull/6938) [`0778757`](https://github.com/mastra-ai/mastra/commit/07787570e4addbd501522037bd2542c3d9e26822) Thanks [@dane-ai-mastra](https://github.com/apps/dane-ai-mastra)! - dependencies updates:
  - Updated dependency [`@opentelemetry/auto-instrumentations-node@^0.62.1` ↗︎](https://www.npmjs.com/package/@opentelemetry/auto-instrumentations-node/v/0.62.1) (from `^0.62.0`, in `dependencies`)

- [#6892](https://github.com/mastra-ai/mastra/pull/6892) [`f61b8c6`](https://github.com/mastra-ai/mastra/commit/f61b8c6b35ec96312d9bb52570578d4f0124467d) Thanks [@wardpeet](https://github.com/wardpeet)! - Improve playground build

- [#6948](https://github.com/mastra-ai/mastra/pull/6948) [`a8070e6`](https://github.com/mastra-ai/mastra/commit/a8070e63ab384ae14a214faaf8634c53b7064bc3) Thanks [@taofeeq-deru](https://github.com/taofeeq-deru)! - Preserve run state in workflows after viewing traces

- Updated dependencies [[`0778757`](https://github.com/mastra-ai/mastra/commit/07787570e4addbd501522037bd2542c3d9e26822), [`e9a36bd`](https://github.com/mastra-ai/mastra/commit/e9a36bd03ed032528b60186a318f563ebf59c01a), [`e38f807`](https://github.com/mastra-ai/mastra/commit/e38f8072853cc803ba48394e1930825129708400), [`bf504a8`](https://github.com/mastra-ai/mastra/commit/bf504a833051f6f321d832cc7d631f3cb86d657b), [`e6f5046`](https://github.com/mastra-ai/mastra/commit/e6f50467aff317e67e8bd74c485c3fbe2a5a6db1), [`de24804`](https://github.com/mastra-ai/mastra/commit/de248044e79b407d211b339ce3ed4dc6e1630704), [`9613558`](https://github.com/mastra-ai/mastra/commit/9613558e6475f4710e05d1be7553a32ee7bddc20)]:
  - @mastra/core@0.14.2-alpha.0
  - @mastra/deployer@0.14.2-alpha.0
  - @mastra/mcp@0.10.13-alpha.0

## 0.10.23

### Patch Changes

- Updated dependencies [[`6e7e120`](https://github.com/mastra-ai/mastra/commit/6e7e1207d6e8d8b838f9024f90bd10df1181ba27), [`4c8956f`](https://github.com/mastra-ai/mastra/commit/4c8956f3110ccf39595e022f127a44a0a5c09c86), [`0f00e17`](https://github.com/mastra-ai/mastra/commit/0f00e172953ccdccadb35ed3d70f5e4d89115869), [`217cd7a`](https://github.com/mastra-ai/mastra/commit/217cd7a4ce171e9a575c41bb8c83300f4db03236), [`a5a23d9`](https://github.com/mastra-ai/mastra/commit/a5a23d981920d458dc6078919992a5338931ef02)]:
  - @mastra/core@0.14.1
  - @mastra/deployer@0.14.1

## 0.10.23-alpha.0

### Patch Changes

- Updated dependencies [[`6e7e120`](https://github.com/mastra-ai/mastra/commit/6e7e1207d6e8d8b838f9024f90bd10df1181ba27), [`4c8956f`](https://github.com/mastra-ai/mastra/commit/4c8956f3110ccf39595e022f127a44a0a5c09c86), [`a5a23d9`](https://github.com/mastra-ai/mastra/commit/a5a23d981920d458dc6078919992a5338931ef02)]:
  - @mastra/core@0.14.1-alpha.0
  - @mastra/deployer@0.14.1-alpha.0

## 0.10.22

### Patch Changes

- 8f8409a: Inject analytics instance into create cmd
- 97c1d5e: Add new `scorers` subcommand for managing scorers.
  Refactor cli to be more modular.
- dd702eb: Fix default in playground
- 6313063: Implement model switcher in playground
- 1d59515: Add options to playground based on modelVersion
- 9ce22c5: Fix swagger-ui link
- 36928f0: Use right icon for anthropic in model switcher
- 03997ae: Update peerdeps
- Updated dependencies [895d3b2]
- Updated dependencies [227c7e6]
- Updated dependencies [12cae67]
- Updated dependencies [bca2ba3]
- Updated dependencies [fd3a3eb]
- Updated dependencies [022f3a2]
- Updated dependencies [6faaee5]
- Updated dependencies [4232b14]
- Updated dependencies [6313063]
- Updated dependencies [a89de7e]
- Updated dependencies [96518cc]
- Updated dependencies [5a37d0c]
- Updated dependencies [4bde0cb]
- Updated dependencies [e1aed55]
- Updated dependencies [cf4f357]
- Updated dependencies [c712849]
- Updated dependencies [04dcd66]
- Updated dependencies [03997ae]
- Updated dependencies [03997ae]
- Updated dependencies [ad888a2]
- Updated dependencies [481751d]
- Updated dependencies [2454423]
- Updated dependencies [194e395]
- Updated dependencies [a9916bd]
- Updated dependencies [a722c0b]
- Updated dependencies [c30bca8]
- Updated dependencies [95e1330]
- Updated dependencies [33eb340]
- Updated dependencies [3b5fec7]
- Updated dependencies [a8f129d]
- Updated dependencies [6dfc4a6]
  - @mastra/mcp@0.10.12
  - @mastra/core@0.14.0
  - @mastra/deployer@0.14.0
  - @mastra/loggers@0.10.7

## 0.10.22-alpha.6

### Patch Changes

- 03997ae: Update peerdeps
- Updated dependencies [03997ae]
- Updated dependencies [03997ae]
  - @mastra/loggers@0.10.7-alpha.0
  - @mastra/mcp@0.10.12-alpha.2
  - @mastra/deployer@0.14.0-alpha.7
  - @mastra/core@0.14.0-alpha.7

## 0.10.22-alpha.5

### Patch Changes

- 9ce22c5: Fix swagger-ui link
- Updated dependencies [ad888a2]
- Updated dependencies [481751d]
- Updated dependencies [194e395]
- Updated dependencies [a9916bd]
  - @mastra/core@0.14.0-alpha.6
  - @mastra/deployer@0.14.0-alpha.6

## 0.10.22-alpha.4

### Patch Changes

- dd702eb: Fix default in playground

## 0.10.22-alpha.3

### Patch Changes

- 1d59515: Add options to playground based on modelVersion
- Updated dependencies [0a7f675]
- Updated dependencies [12cae67]
- Updated dependencies [96518cc]
- Updated dependencies [5a37d0c]
- Updated dependencies [4bde0cb]
- Updated dependencies [e1aed55]
- Updated dependencies [1a80071]
- Updated dependencies [36a3be8]
- Updated dependencies [c712849]
- Updated dependencies [361757b]
- Updated dependencies [2bb9955]
- Updated dependencies [2454423]
- Updated dependencies [a44d91e]
- Updated dependencies [dfb91e9]
- Updated dependencies [a741dde]
- Updated dependencies [95e1330]
- Updated dependencies [7cb3fc0]
- Updated dependencies [195eabb]
- Updated dependencies [33eb340]
- Updated dependencies [b78b95b]
  - @mastra/core@0.14.0-alpha.4
  - @mastra/deployer@0.14.0-alpha.4
  - @mastra/mcp@0.10.12-alpha.1

## 0.10.22-alpha.2

### Patch Changes

- 36928f0: Use right icon for anthropic in model switcher
- Updated dependencies [227c7e6]
- Updated dependencies [fd3a3eb]
- Updated dependencies [04dcd66]
- Updated dependencies [a8f129d]
  - @mastra/core@0.14.0-alpha.3
  - @mastra/deployer@0.14.0-alpha.3

## 0.10.22-alpha.1

### Patch Changes

- 8f8409a: Inject analytics instance into create cmd
- 6313063: Implement model switcher in playground
- Updated dependencies [895d3b2]
- Updated dependencies [bca2ba3]
- Updated dependencies [6faaee5]
- Updated dependencies [4232b14]
- Updated dependencies [6313063]
- Updated dependencies [a89de7e]
- Updated dependencies [cf4f357]
- Updated dependencies [a722c0b]
- Updated dependencies [3b5fec7]
- Updated dependencies [6dfc4a6]
  - @mastra/mcp@0.10.12-alpha.0
  - @mastra/deployer@0.14.0-alpha.1
  - @mastra/core@0.14.0-alpha.1

## 0.10.22-alpha.0

### Patch Changes

- 97c1d5e: Add new `scorers` subcommand for managing scorers.
  Refactor cli to be more modular.
- Updated dependencies [c30bca8]
  - @mastra/core@0.13.3-alpha.0
  - @mastra/deployer@0.13.3-alpha.0

## 0.10.21

### Patch Changes

- 63449d0: Change the globbing of tools to exclude test files. Files inside `__tests__` directory and files with `.test.` or `.spec.` in their file name are now excluded from bundling.
- 77b6cfe: Use just modelId for gpt-5 check
- 96169cc: Create handler that returns providers user has keys for in their env
- 33da97c: Set temperature to 1 for gpt-5 model in playground
- c6d2603: Properly set baseUrl in playground when user sets the host or port in Mastra instance.
- 7aad750: Fix tool ui showing after message when chat is refreshed
- ce04175: Add update agent model handler
- Updated dependencies [d5330bf]
- Updated dependencies [aaf0224]
- Updated dependencies [2e74797]
- Updated dependencies [42cb4e9]
- Updated dependencies [8388649]
- Updated dependencies [a239d41]
- Updated dependencies [dd94a26]
- Updated dependencies [3ba6772]
- Updated dependencies [96169cc]
- Updated dependencies [b5cf2a3]
- Updated dependencies [2fff911]
- Updated dependencies [b32c50d]
- Updated dependencies [c6d2603]
- Updated dependencies [63449d0]
- Updated dependencies [121a3f8]
- Updated dependencies [ce04175]
- Updated dependencies [ec510e7]
  - @mastra/core@0.13.2
  - @mastra/deployer@0.13.2
  - @mastra/mcp@0.10.11

## 0.10.21-alpha.2

### Patch Changes

- 77b6cfe: Use just modelId for gpt-5 check
- 96169cc: Create handler that returns providers user has keys for in their env
- 33da97c: Set temperature to 1 for gpt-5 model in playground
- c6d2603: Properly set baseUrl in playground when user sets the host or port in Mastra instance.
- ce04175: Add update agent model handler
- Updated dependencies [d5330bf]
- Updated dependencies [aaf0224]
- Updated dependencies [42cb4e9]
- Updated dependencies [a239d41]
- Updated dependencies [96169cc]
- Updated dependencies [b32c50d]
- Updated dependencies [c6d2603]
- Updated dependencies [121a3f8]
- Updated dependencies [ce04175]
- Updated dependencies [ec510e7]
  - @mastra/core@0.13.2-alpha.2
  - @mastra/deployer@0.13.2-alpha.2
  - @mastra/mcp@0.10.11-alpha.0

## 0.10.21-alpha.1

### Patch Changes

- 63449d0: Change the globbing of tools to exclude test files. Files inside `__tests__` directory and files with `.test.` or `.spec.` in their file name are now excluded from bundling.
- Updated dependencies [2e74797]
- Updated dependencies [63449d0]
  - @mastra/core@0.13.2-alpha.1
  - @mastra/deployer@0.13.2-alpha.1

## 0.10.21-alpha.0

### Patch Changes

- 7aad750: Fix tool ui showing after message when chat is refreshed
- Updated dependencies [8388649]
- Updated dependencies [dd94a26]
- Updated dependencies [3ba6772]
- Updated dependencies [2fff911]
  - @mastra/core@0.13.2-alpha.0
  - @mastra/deployer@0.13.2-alpha.0

## 0.10.20

### Patch Changes

- Updated dependencies [cd0042e]
  - @mastra/core@0.13.1
  - @mastra/deployer@0.13.1

## 0.10.20-alpha.0

### Patch Changes

- Updated dependencies [cd0042e]
  - @mastra/core@0.13.1-alpha.0
  - @mastra/deployer@0.13.1-alpha.0

## 0.10.19

### Patch Changes

- ea0c5f2: Update to support new scorer api
- 4a406ec: fixes TypeScript declaration file imports to ensure proper ESM compatibility
- 35c5798: Add support for transpilePackages option
- Updated dependencies [cb36de0]
- Updated dependencies [d0496e6]
- Updated dependencies [7b8172f]
- Updated dependencies [cb36de0]
- Updated dependencies [d0496e6]
- Updated dependencies [a82b851]
- Updated dependencies [ea0c5f2]
- Updated dependencies [41a0a0e]
- Updated dependencies [2871020]
- Updated dependencies [9e792ef]
- Updated dependencies [94f4812]
- Updated dependencies [e202b82]
- Updated dependencies [e00f6a0]
- Updated dependencies [4a406ec]
- Updated dependencies [b0e43c1]
- Updated dependencies [5d377e5]
- Updated dependencies [1fb812e]
- Updated dependencies [35c5798]
  - @mastra/core@0.13.0
  - @mastra/deployer@0.13.0
  - @mastra/mcp@0.10.10
  - @mastra/loggers@0.10.6

## 0.10.19-alpha.2

### Patch Changes

- 4a406ec: fixes TypeScript declaration file imports to ensure proper ESM compatibility
- Updated dependencies [cb36de0]
- Updated dependencies [cb36de0]
- Updated dependencies [a82b851]
- Updated dependencies [41a0a0e]
- Updated dependencies [2871020]
- Updated dependencies [4a406ec]
- Updated dependencies [5d377e5]
  - @mastra/core@0.13.0-alpha.2
  - @mastra/deployer@0.13.0-alpha.2
  - @mastra/loggers@0.10.6-alpha.0
  - @mastra/mcp@0.10.10-alpha.0

## 0.10.19-alpha.1

### Patch Changes

- ea0c5f2: Update to support new scorer api
- 35c5798: Add support for transpilePackages option
- Updated dependencies [7b8172f]
- Updated dependencies [ea0c5f2]
- Updated dependencies [b0e43c1]
- Updated dependencies [1fb812e]
- Updated dependencies [35c5798]
  - @mastra/deployer@0.13.0-alpha.1
  - @mastra/core@0.13.0-alpha.1

## 0.10.19-alpha.0

### Patch Changes

- Updated dependencies [94f4812]
- Updated dependencies [e202b82]
- Updated dependencies [e00f6a0]
  - @mastra/core@0.12.2-alpha.0
  - @mastra/deployer@0.12.2-alpha.0

## 0.10.18

### Patch Changes

- ad04455: Missed changeset in last release, needed to include create-mastra

## 0.10.18-alpha.0

### Patch Changes

- ad04455: Missed changeset in last release, needed to include create-mastra

## 0.10.17

### Patch Changes

- 9862477: Install specific ai v4 deps when scaffolding a project
- 33dcb07: dependencies updates:
  - Updated dependency [`@opentelemetry/instrumentation@^0.203.0` ↗︎](https://www.npmjs.com/package/@opentelemetry/instrumentation/v/0.203.0) (from `^0.202.0`, in `dependencies`)
  - Updated dependency [`@opentelemetry/auto-instrumentations-node@^0.62.0` ↗︎](https://www.npmjs.com/package/@opentelemetry/auto-instrumentations-node/v/0.62.0) (from `^0.60.1`, in `dependencies`)
  - Updated dependency [`@opentelemetry/exporter-trace-otlp-grpc@^0.203.0` ↗︎](https://www.npmjs.com/package/@opentelemetry/exporter-trace-otlp-grpc/v/0.203.0) (from `^0.202.0`, in `dependencies`)
  - Updated dependency [`@opentelemetry/exporter-trace-otlp-http@^0.203.0` ↗︎](https://www.npmjs.com/package/@opentelemetry/exporter-trace-otlp-http/v/0.203.0) (from `^0.202.0`, in `dependencies`)
  - Updated dependency [`@opentelemetry/sdk-node@^0.203.0` ↗︎](https://www.npmjs.com/package/@opentelemetry/sdk-node/v/0.203.0) (from `^0.202.0`, in `dependencies`)
  - Updated dependency [`@opentelemetry/semantic-conventions@^1.36.0` ↗︎](https://www.npmjs.com/package/@opentelemetry/semantic-conventions/v/1.36.0) (from `^1.34.0`, in `dependencies`)
- Updated dependencies [33dcb07]
- Updated dependencies [f90797b]
- Updated dependencies [d0d9500]
- Updated dependencies [d30b1a0]
- Updated dependencies [bff87f7]
- Updated dependencies [07fe7a2]
- Updated dependencies [b4a8df0]
  - @mastra/core@0.12.1
  - @mastra/mcp@0.10.9
  - @mastra/deployer@0.12.1

## 0.10.17-alpha.1

### Patch Changes

- 9862477: Install specific ai v4 deps when scaffolding a project
- Updated dependencies [d0d9500]
  - @mastra/core@0.12.1-alpha.1
  - @mastra/deployer@0.12.1-alpha.1

## 0.10.17-alpha.0

### Patch Changes

- 33dcb07: dependencies updates:
  - Updated dependency [`@opentelemetry/instrumentation@^0.203.0` ↗︎](https://www.npmjs.com/package/@opentelemetry/instrumentation/v/0.203.0) (from `^0.202.0`, in `dependencies`)
  - Updated dependency [`@opentelemetry/auto-instrumentations-node@^0.62.0` ↗︎](https://www.npmjs.com/package/@opentelemetry/auto-instrumentations-node/v/0.62.0) (from `^0.60.1`, in `dependencies`)
  - Updated dependency [`@opentelemetry/exporter-trace-otlp-grpc@^0.203.0` ↗︎](https://www.npmjs.com/package/@opentelemetry/exporter-trace-otlp-grpc/v/0.203.0) (from `^0.202.0`, in `dependencies`)
  - Updated dependency [`@opentelemetry/exporter-trace-otlp-http@^0.203.0` ↗︎](https://www.npmjs.com/package/@opentelemetry/exporter-trace-otlp-http/v/0.203.0) (from `^0.202.0`, in `dependencies`)
  - Updated dependency [`@opentelemetry/sdk-node@^0.203.0` ↗︎](https://www.npmjs.com/package/@opentelemetry/sdk-node/v/0.203.0) (from `^0.202.0`, in `dependencies`)
  - Updated dependency [`@opentelemetry/semantic-conventions@^1.36.0` ↗︎](https://www.npmjs.com/package/@opentelemetry/semantic-conventions/v/1.36.0) (from `^1.34.0`, in `dependencies`)
- Updated dependencies [33dcb07]
- Updated dependencies [f90797b]
- Updated dependencies [d30b1a0]
- Updated dependencies [bff87f7]
- Updated dependencies [07fe7a2]
- Updated dependencies [b4a8df0]
  - @mastra/core@0.12.1-alpha.0
  - @mastra/mcp@0.10.9-alpha.0
  - @mastra/deployer@0.12.1-alpha.0

## 0.10.16

### Patch Changes

- bc6b44a: Extract tools import from `createHonoServer`; the function now receives tools via a prop on the `options` parameter.
- f442224: speech to text using voice config
- 7a7754f: Fast follow scorers fixing input types, improve llm scorer reliability, fix ui to display scores that are 0
- d8dec5e: add a cta to invite to deploy to cloud
- 6336993: Fix workflow input form overflow
- d5cc460: This change implements a fix to sourcemap mappings being off due to `removeDeployer` Babel plugin missing source map config.
- f42c4c2: update peer deps for packages to latest core range
- a5681f2: fix: pagination breaks trace grouping
- 89d2f4e: add TTS to the playground
- Updated dependencies [510e2c8]
- Updated dependencies [2f72fb2]
- Updated dependencies [27cc97a]
- Updated dependencies [832691b]
- Updated dependencies [557bb9d]
- Updated dependencies [27cc97a]
- Updated dependencies [3f89307]
- Updated dependencies [9eda7d4]
- Updated dependencies [9d49408]
- Updated dependencies [bc6b44a]
- Updated dependencies [41daa63]
- Updated dependencies [ad0a58b]
- Updated dependencies [254a36b]
- Updated dependencies [2ecf658]
- Updated dependencies [7a7754f]
- Updated dependencies [fc92d80]
- Updated dependencies [e0f73c6]
- Updated dependencies [0b89602]
- Updated dependencies [4d37822]
- Updated dependencies [23a6a7c]
- Updated dependencies [cda801d]
- Updated dependencies [a77c823]
- Updated dependencies [ff9c125]
- Updated dependencies [09bca64]
- Updated dependencies [9802f42]
- Updated dependencies [d5cc460]
- Updated dependencies [f42c4c2]
- Updated dependencies [b8efbb9]
- Updated dependencies [71466e7]
- Updated dependencies [0c99fbe]
  - @mastra/core@0.12.0
  - @mastra/deployer@0.12.0
  - @mastra/loggers@0.10.5
  - @mastra/mcp@0.10.8

## 0.10.16-alpha.3

### Patch Changes

- f42c4c2: update peer deps for packages to latest core range
- Updated dependencies [f42c4c2]
  - @mastra/deployer@0.12.0-alpha.5
  - @mastra/loggers@0.10.5-alpha.0
  - @mastra/mcp@0.10.8-alpha.0
  - @mastra/core@0.12.0-alpha.5

## 0.10.16-alpha.2

### Patch Changes

- d5cc460: This change implements a fix to sourcemap mappings being off due to `removeDeployer` Babel plugin missing source map config.
- a5681f2: fix: pagination breaks trace grouping
- Updated dependencies [27cc97a]
- Updated dependencies [27cc97a]
- Updated dependencies [41daa63]
- Updated dependencies [254a36b]
- Updated dependencies [0b89602]
- Updated dependencies [4d37822]
- Updated dependencies [ff9c125]
- Updated dependencies [d5cc460]
- Updated dependencies [b8efbb9]
- Updated dependencies [71466e7]
- Updated dependencies [0c99fbe]
  - @mastra/core@0.12.0-alpha.2
  - @mastra/deployer@0.12.0-alpha.2

## 0.10.16-alpha.1

### Patch Changes

- 6336993: Fix workflow input form overflow
- Updated dependencies [e0f73c6]
- Updated dependencies [cda801d]
- Updated dependencies [a77c823]
  - @mastra/core@0.12.0-alpha.1
  - @mastra/deployer@0.12.0-alpha.1

## 0.10.16-alpha.0

### Patch Changes

- bc6b44a: Extract tools import from `createHonoServer`; the function now receives tools via a prop on the `options` parameter.
- f442224: speech to text using voice config
- 7a7754f: Fast follow scorers fixing input types, improve llm scorer reliability, fix ui to display scores that are 0
- d8dec5e: add a cta to invite to deploy to cloud
- 89d2f4e: add TTS to the playground
- Updated dependencies [510e2c8]
- Updated dependencies [2f72fb2]
- Updated dependencies [832691b]
- Updated dependencies [557bb9d]
- Updated dependencies [3f89307]
- Updated dependencies [9eda7d4]
- Updated dependencies [9d49408]
- Updated dependencies [bc6b44a]
- Updated dependencies [2ecf658]
- Updated dependencies [7a7754f]
- Updated dependencies [fc92d80]
- Updated dependencies [23a6a7c]
- Updated dependencies [09bca64]
  - @mastra/core@0.12.0-alpha.0
  - @mastra/deployer@0.12.0-alpha.0

## 0.10.15

### Patch Changes

- 1a45f3a: Fix peerdeps

## 0.10.14

### Patch Changes

- dd2a4c9: change the way we start the dev process of playground
- af1f902: share thread list between agent, network and cloud
- 8f89bcd: fix traces pagination + sharing trace view with cloud
- 0bf0bc8: fix link in shared components + add e2e tests
- 2affc57: Fix output type of network loop
- 51192f8: Spread the loaded env into the main process
- f6c4d75: fix date picker on change
- 59f0dcd: Add light background color for step statuses
- 698518b: Allow external templates from github
- cf8d497: factorize tabs component between cloud and core
- 7827943: Handle streaming large data
- 808b493: wrap runtime context with tooltip provider for usage in cloud
- 8364fac: Fix displaying scorer input
- 09464dd: Share AgentMetadata component with cloud
- 80692d5: refactor: sharing only the UI and not data fetching for traces
- 80c2b06: Fix agent chat stop button to cancel stream/generate reqs in the playground
- Updated dependencies [f248d53]
- Updated dependencies [82c6860]
- Updated dependencies [2affc57]
- Updated dependencies [66e13e3]
- Updated dependencies [edd9482]
- Updated dependencies [0938991]
- Updated dependencies [18344d7]
- Updated dependencies [7ba91fa]
- Updated dependencies [a512ede]
- Updated dependencies [35b1155]
- Updated dependencies [9d372c2]
- Updated dependencies [45469c5]
- Updated dependencies [40c2525]
- Updated dependencies [e473f27]
- Updated dependencies [032cb66]
- Updated dependencies [6f50efd]
- Updated dependencies [24eb25c]
- Updated dependencies [bf6903e]
- Updated dependencies [703ac71]
- Updated dependencies [a723d69]
- Updated dependencies [7827943]
- Updated dependencies [4c06f06]
- Updated dependencies [5889a31]
- Updated dependencies [bf1e7e7]
- Updated dependencies [65e3395]
- Updated dependencies [9de6f58]
- Updated dependencies [4933192]
- Updated dependencies [d1c77a4]
- Updated dependencies [bea9dd1]
- Updated dependencies [7983e53]
- Updated dependencies [dcd4802]
- Updated dependencies [cbddd18]
- Updated dependencies [7ba91fa]
- Updated dependencies [15ce274]
  - @mastra/core@0.11.0
  - @mastra/deployer@0.11.0

## 0.10.14-alpha.3

### Patch Changes

- 8364fac: Fix displaying scorer input

## 0.10.14-alpha.2

### Patch Changes

- dd2a4c9: change the way we start the dev process of playground
- af1f902: share thread list between agent, network and cloud
- 2affc57: Fix output type of network loop
- 51192f8: Spread the loaded env into the main process
- f6c4d75: fix date picker on change
- 698518b: Allow external templates from github
- 09464dd: Share AgentMetadata component with cloud
- 80c2b06: Fix agent chat stop button to cancel stream/generate reqs in the playground
- Updated dependencies [f248d53]
- Updated dependencies [82c6860]
- Updated dependencies [2affc57]
- Updated dependencies [66e13e3]
- Updated dependencies [edd9482]
- Updated dependencies [18344d7]
- Updated dependencies [7ba91fa]
- Updated dependencies [a512ede]
- Updated dependencies [35b1155]
- Updated dependencies [9d372c2]
- Updated dependencies [45469c5]
- Updated dependencies [40c2525]
- Updated dependencies [e473f27]
- Updated dependencies [032cb66]
- Updated dependencies [24eb25c]
- Updated dependencies [703ac71]
- Updated dependencies [a723d69]
- Updated dependencies [4c06f06]
- Updated dependencies [5889a31]
- Updated dependencies [65e3395]
- Updated dependencies [9de6f58]
- Updated dependencies [4933192]
- Updated dependencies [d1c77a4]
- Updated dependencies [bea9dd1]
- Updated dependencies [dcd4802]
- Updated dependencies [7ba91fa]
- Updated dependencies [15ce274]
  - @mastra/core@0.11.0-alpha.2
  - @mastra/deployer@0.11.0-alpha.2

## 0.10.14-alpha.1

### Patch Changes

- 8f89bcd: fix traces pagination + sharing trace view with cloud
- 59f0dcd: Add light background color for step statuses
- cf8d497: factorize tabs component between cloud and core
- 80692d5: refactor: sharing only the UI and not data fetching for traces
- Updated dependencies [7983e53]
  - @mastra/deployer@0.11.0-alpha.1
  - @mastra/core@0.11.0-alpha.1

## 0.10.14-alpha.0

### Patch Changes

- 0bf0bc8: fix link in shared components + add e2e tests
- 7827943: Handle streaming large data
- 808b493: wrap runtime context with tooltip provider for usage in cloud
- Updated dependencies [0938991]
- Updated dependencies [6f50efd]
- Updated dependencies [bf6903e]
- Updated dependencies [7827943]
- Updated dependencies [bf1e7e7]
- Updated dependencies [cbddd18]
  - @mastra/deployer@0.11.0-alpha.0
  - @mastra/core@0.11.0-alpha.0

## 0.10.13

### Patch Changes

- 593631d: allow to pass ref to the link abstraction
- 5237998: Fix foreach output
- 1aa60b1: Pipe runtimeContext to vNext network agent stream and generate steps, wire up runtimeContext for vNext Networks in cliet SDK & playground
- d49334d: export tool list for usage in cloud
- 9cdfcb5: fix infinite rerenders on agents table + share runtime context for cloud
- 794d9f3: Fix thread creation in playground
- 5130bcb: dependencies updates:
  - Updated dependency [`swr@^2.3.4` ↗︎](https://www.npmjs.com/package/swr/v/2.3.4) (from `^2.3.3`, in `dependencies`)
- 984887a: dependencies updates:
  - Updated dependency [`prettier@^3.6.2` ↗︎](https://www.npmjs.com/package/prettier/v/3.6.2) (from `^3.5.3`, in `dependencies`)
- aa9528a: Display reasoning in playground
- 45174f3: share network list between core and cloud
- 48f5532: export workflow list for usage in cloud
- 3e484be: Added CLI template option
- 626b0f4: [Cloud-126] Working Memory Playground - Added working memory to playground to allow users to view/edit working memory
- e1d0080: abstract Link component between cloud and core
- f9b1508: add the same agent table as in cloud and export it from the playground
- dfbeec6: Fix navigation to vnext AgentNetwork agents
- Updated dependencies [7776324]
- Updated dependencies [0b56518]
- Updated dependencies [db5cc15]
- Updated dependencies [2ba5b76]
- Updated dependencies [7b57e2c]
- Updated dependencies [5237998]
- Updated dependencies [c3a30de]
- Updated dependencies [37c1acd]
- Updated dependencies [1aa60b1]
- Updated dependencies [89ec9d4]
- Updated dependencies [cf3a184]
- Updated dependencies [fe4bbd4]
- Updated dependencies [d6bfd60]
- Updated dependencies [626b0f4]
- Updated dependencies [c22a91f]
- Updated dependencies [f7403ab]
- Updated dependencies [6c89d7f]
  - @mastra/deployer@0.10.15
  - @mastra/core@0.10.15

## 0.10.13-alpha.2

### Patch Changes

- 794d9f3: Fix thread creation in playground
- dfbeec6: Fix navigation to vnext AgentNetwork agents

## 0.10.13-alpha.1

### Patch Changes

- d49334d: export tool list for usage in cloud
- 9cdfcb5: fix infinite rerenders on agents table + share runtime context for cloud
- 45174f3: share network list between core and cloud
- 48f5532: export workflow list for usage in cloud
- 3e484be: Added CLI template option
- Updated dependencies [0b56518]
- Updated dependencies [2ba5b76]
- Updated dependencies [c3a30de]
- Updated dependencies [cf3a184]
- Updated dependencies [fe4bbd4]
- Updated dependencies [d6bfd60]
  - @mastra/core@0.10.15-alpha.1
  - @mastra/deployer@0.10.15-alpha.1

## 0.10.13-alpha.0

### Patch Changes

- 593631d: allow to pass ref to the link abstraction
- 5237998: Fix foreach output
- 1aa60b1: Pipe runtimeContext to vNext network agent stream and generate steps, wire up runtimeContext for vNext Networks in cliet SDK & playground
- 5130bcb: dependencies updates:
  - Updated dependency [`swr@^2.3.4` ↗︎](https://www.npmjs.com/package/swr/v/2.3.4) (from `^2.3.3`, in `dependencies`)
- 984887a: dependencies updates:
  - Updated dependency [`prettier@^3.6.2` ↗︎](https://www.npmjs.com/package/prettier/v/3.6.2) (from `^3.5.3`, in `dependencies`)
- aa9528a: Display reasoning in playground
- 626b0f4: [Cloud-126] Working Memory Playground - Added working memory to playground to allow users to view/edit working memory
- e1d0080: abstract Link component between cloud and core
- f9b1508: add the same agent table as in cloud and export it from the playground
- Updated dependencies [7776324]
- Updated dependencies [db5cc15]
- Updated dependencies [7b57e2c]
- Updated dependencies [5237998]
- Updated dependencies [37c1acd]
- Updated dependencies [1aa60b1]
- Updated dependencies [89ec9d4]
- Updated dependencies [626b0f4]
- Updated dependencies [c22a91f]
- Updated dependencies [f7403ab]
- Updated dependencies [6c89d7f]
  - @mastra/deployer@0.10.15-alpha.0
  - @mastra/core@0.10.15-alpha.0

## 0.10.12

### Patch Changes

- 640f47e: move agent model settings into agent settings
- 5d0c163: Scaffold create-mastra projects with zod@^3 to prevent package version conflicts during install
- 53e3f58: Add support for custom instrumentation files
- Updated dependencies [b4a9811]
- Updated dependencies [4d5583d]
- Updated dependencies [53e3f58]
  - @mastra/core@0.10.12
  - @mastra/deployer@0.10.12

## 0.10.12-alpha.0

### Patch Changes

- 640f47e: move agent model settings into agent settings
- 5d0c163: Scaffold create-mastra projects with zod@^3 to prevent package version conflicts during install
- 53e3f58: Add support for custom instrumentation files
- Updated dependencies [b4a9811]
- Updated dependencies [53e3f58]
  - @mastra/core@0.10.12-alpha.0
  - @mastra/deployer@0.10.12-alpha.0

## 0.10.11

### Patch Changes

- ec77f83: Expose --inspect flag for mastra dev to start debugger
- af9e40e: Map log level number to string value
- f457d86: reset localstorage when resetting model settings
- 8722d53: Fix multi modal remaining steps
- 565cc0c: fix redirection when clicking on the playground breadcrumbs
- 4219597: add JSON input close to form input
- 2873c7f: dependencies updates:
  - Updated dependency [`dotenv@^16.6.1` ↗︎](https://www.npmjs.com/package/dotenv/v/16.6.1) (from `^16.5.0`, in `dependencies`)
- a9f51e4: Fix plaground get tools not including x-mastra-dev-header"
- 3322d00: Fix tools watcher in dev
- b790fd1: Use SerializedStepFlowEntry in playground
- a7a836a: Highlight send event button
- Updated dependencies [2873c7f]
- Updated dependencies [1c1c6a1]
- Updated dependencies [bc40cdd]
- Updated dependencies [2873c7f]
- Updated dependencies [1c1c6a1]
- Updated dependencies [d9b26b5]
- Updated dependencies [f5ec3a4]
- Updated dependencies [f8ce2cc]
- Updated dependencies [ab3bbff]
- Updated dependencies [8c846b6]
- Updated dependencies [c7bbf1e]
- Updated dependencies [8722d53]
- Updated dependencies [565cc0c]
- Updated dependencies [b790fd1]
- Updated dependencies [132027f]
- Updated dependencies [0c85311]
- Updated dependencies [d7ed04d]
- Updated dependencies [c0ba5e2]
- Updated dependencies [18ca936]
- Updated dependencies [cb16baf]
- Updated dependencies [40cd025]
- Updated dependencies [f36e4f1]
- Updated dependencies [7f6e403]
  - @mastra/core@0.10.11
  - @mastra/deployer@0.10.11
  - @mastra/mcp@0.10.6

## 0.10.11-alpha.3

### Patch Changes

- f457d86: reset localstorage when resetting model settings
- 8722d53: Fix multi modal remaining steps
- Updated dependencies [c7bbf1e]
- Updated dependencies [8722d53]
- Updated dependencies [132027f]
- Updated dependencies [0c85311]
- Updated dependencies [c0ba5e2]
- Updated dependencies [cb16baf]
  - @mastra/core@0.10.11-alpha.3
  - @mastra/mcp@0.10.6-alpha.1
  - @mastra/deployer@0.10.11-alpha.3

## 0.10.11-alpha.2

### Patch Changes

- ec77f83: Expose --inspect flag for mastra dev to start debugger
- 565cc0c: fix redirection when clicking on the playground breadcrumbs
- 4219597: add JSON input close to form input
- 2873c7f: dependencies updates:
  - Updated dependency [`dotenv@^16.6.1` ↗︎](https://www.npmjs.com/package/dotenv/v/16.6.1) (from `^16.5.0`, in `dependencies`)
- Updated dependencies [2873c7f]
- Updated dependencies [1c1c6a1]
- Updated dependencies [2873c7f]
- Updated dependencies [1c1c6a1]
- Updated dependencies [d9b26b5]
- Updated dependencies [f5ec3a4]
- Updated dependencies [ab3bbff]
- Updated dependencies [565cc0c]
- Updated dependencies [18ca936]
  - @mastra/core@0.10.11-alpha.2
  - @mastra/deployer@0.10.11-alpha.2
  - @mastra/mcp@0.10.6-alpha.0

## 0.10.11-alpha.1

### Patch Changes

- a7a836a: Highlight send event button
- Updated dependencies [7f6e403]
  - @mastra/core@0.10.11-alpha.1
  - @mastra/deployer@0.10.11-alpha.1

## 0.10.11-alpha.0

### Patch Changes

- af9e40e: Map log level number to string value
- a9f51e4: Fix plaground get tools not including x-mastra-dev-header"
- 3322d00: Fix tools watcher in dev
- b790fd1: Use SerializedStepFlowEntry in playground
- Updated dependencies [bc40cdd]
- Updated dependencies [f8ce2cc]
- Updated dependencies [8c846b6]
- Updated dependencies [b790fd1]
- Updated dependencies [d7ed04d]
- Updated dependencies [f36e4f1]
  - @mastra/deployer@0.10.11-alpha.0
  - @mastra/core@0.10.11-alpha.0

## 0.10.10

### Patch Changes

- 6997af1: add send event to server, deployer, client-js and playground-ui
- 4d3fbdf: Return tool error message rather than throw when a tool error happens for agent and tool playground page.
- Updated dependencies [6e13b80]
- Updated dependencies [25bf999]
- Updated dependencies [6997af1]
- Updated dependencies [4d3fbdf]
  - @mastra/deployer@0.10.10
  - @mastra/loggers@0.10.3
  - @mastra/core@0.10.10

## 0.10.10-alpha.2

### Patch Changes

- Updated dependencies [25bf999]
  - @mastra/loggers@0.10.3-alpha.0

## 0.10.10-alpha.1

### Patch Changes

- 6997af1: add send event to server, deployer, client-js and playground-ui
- Updated dependencies [6997af1]
  - @mastra/deployer@0.10.10-alpha.1
  - @mastra/core@0.10.10-alpha.1

## 0.10.10-alpha.0

### Patch Changes

- 4d3fbdf: Return tool error message rather than throw when a tool error happens for agent and tool playground page.
- Updated dependencies [6e13b80]
- Updated dependencies [4d3fbdf]
  - @mastra/deployer@0.10.10-alpha.0
  - @mastra/core@0.10.10-alpha.0

## 0.10.9

### Patch Changes

- 4e06e3f: timing not displayed correctly in traces
- 7e801dd: [MASTRA-4118] fixes issue with agent network loopStream where subsequent messages aren't present in playground on refresh
- d093c1e: Update example workflow to use existing weather agent
- a606c75: show right suspend schema for nested workflow on playground
- 1cbdfd0: update create-mastra gemini model to 2.5
- 1760a1c: Use workflow stream in playground instead of watch
- 038e5ae: Add cancel workflow run
- ac369c6: Show resume data on workflow graph
- 91c43b4: Use process.execPath for node in dev
- 976a62b: remove persistence capabilities in model settings components
- 4e809ad: Visualizations for .sleep()/.sleepUntil()/.waitForEvent()
- f78f399: Make AgentModelSettings shareable between cloud and playground
- 57929df: agent network display
- Updated dependencies [9dda1ac]
- Updated dependencies [9dda1ac]
- Updated dependencies [c984582]
- Updated dependencies [7e801dd]
- Updated dependencies [a606c75]
- Updated dependencies [7aa70a4]
- Updated dependencies [764f86a]
- Updated dependencies [1760a1c]
- Updated dependencies [038e5ae]
- Updated dependencies [7dda16a]
- Updated dependencies [6f87544]
- Updated dependencies [5ebfcdd]
- Updated dependencies [81a1b3b]
- Updated dependencies [b2d0c91]
- Updated dependencies [4e809ad]
- Updated dependencies [57929df]
- Updated dependencies [7e801dd]
- Updated dependencies [b7852ed]
- Updated dependencies [6320a61]
  - @mastra/core@0.10.9
  - @mastra/deployer@0.10.9

## 0.10.9-alpha.0

### Patch Changes

- 4e06e3f: timing not displayed correctly in traces
- 7e801dd: [MASTRA-4118] fixes issue with agent network loopStream where subsequent messages aren't present in playground on refresh
- d093c1e: Update example workflow to use existing weather agent
- a606c75: show right suspend schema for nested workflow on playground
- 1cbdfd0: update create-mastra gemini model to 2.5
- 1760a1c: Use workflow stream in playground instead of watch
- 038e5ae: Add cancel workflow run
- ac369c6: Show resume data on workflow graph
- 91c43b4: Use process.execPath for node in dev
- 976a62b: remove persistence capabilities in model settings components
- 4e809ad: Visualizations for .sleep()/.sleepUntil()/.waitForEvent()
- f78f399: Make AgentModelSettings shareable between cloud and playground
- 57929df: agent network display
- Updated dependencies [9dda1ac]
- Updated dependencies [9dda1ac]
- Updated dependencies [c984582]
- Updated dependencies [7e801dd]
- Updated dependencies [a606c75]
- Updated dependencies [7aa70a4]
- Updated dependencies [764f86a]
- Updated dependencies [1760a1c]
- Updated dependencies [038e5ae]
- Updated dependencies [7dda16a]
- Updated dependencies [6f87544]
- Updated dependencies [5ebfcdd]
- Updated dependencies [81a1b3b]
- Updated dependencies [b2d0c91]
- Updated dependencies [4e809ad]
- Updated dependencies [57929df]
- Updated dependencies [7e801dd]
- Updated dependencies [b7852ed]
- Updated dependencies [6320a61]
  - @mastra/core@0.10.9-alpha.0
  - @mastra/deployer@0.10.9-alpha.0

## 0.10.8

### Patch Changes

- a344ac7: Fix tool streaming in agent network
- Updated dependencies [b8f16b2]
- Updated dependencies [3e04487]
- Updated dependencies [a344ac7]
- Updated dependencies [dc4ca0a]
  - @mastra/core@0.10.8
  - @mastra/deployer@0.10.8

## 0.10.8-alpha.1

### Patch Changes

- Updated dependencies [b8f16b2]
- Updated dependencies [3e04487]
- Updated dependencies [dc4ca0a]
  - @mastra/core@0.10.8-alpha.1
  - @mastra/deployer@0.10.8-alpha.1

## 0.10.8-alpha.0

### Patch Changes

- a344ac7: Fix tool streaming in agent network
- Updated dependencies [a344ac7]
  - @mastra/deployer@0.10.8-alpha.0
  - @mastra/core@0.10.8-alpha.0

## 0.10.7

### Patch Changes

- 5d74aab: vNext network in playground
- 9102d89: Fix final output not showing on playground for previously suspended steps
- 17903a3: Remove install step from dev for telemetry
- 8e1b6e9: dependencies updates:
  - Updated dependency [`zod@^3.25.67` ↗︎](https://www.npmjs.com/package/zod/v/3.25.67) (from `^3.25.57`, in `dependencies`)
- 21ffb97: Make dynamic form handle schema better
- be3d5a3: Remove recharts and ramada (unused deps)
- f9b4350: fix icons not showing on all agents
- Updated dependencies [8e1b6e9]
- Updated dependencies [36cd0f1]
- Updated dependencies [2eab82b]
- Updated dependencies [ee93d96]
- Updated dependencies [c00039d]
- Updated dependencies [15e9d26]
- Updated dependencies [d1baedb]
- Updated dependencies [d8f2d19]
- Updated dependencies [9bf1d55]
- Updated dependencies [4d21bf2]
- Updated dependencies [914684e]
- Updated dependencies [07d6d88]
- Updated dependencies [9d52b17]
- Updated dependencies [2097952]
- Updated dependencies [792c4c0]
- Updated dependencies [5d74aab]
- Updated dependencies [5d74aab]
- Updated dependencies [17903a3]
- Updated dependencies [a8b194f]
- Updated dependencies [4fb0cc2]
- Updated dependencies [d2a7a31]
- Updated dependencies [502fe05]
- Updated dependencies [144eb0b]
- Updated dependencies [8ba1b51]
- Updated dependencies [10a4f10]
- Updated dependencies [4efcfa0]
- Updated dependencies [0e17048]
- Updated dependencies [dc93062]
  - @mastra/deployer@0.10.7
  - @mastra/mcp@0.10.5
  - @mastra/core@0.10.7

## 0.10.7-alpha.5

### Patch Changes

- f9b4350: fix icons not showing on all agents
  - @mastra/core@0.10.7-alpha.5
  - @mastra/deployer@0.10.7-alpha.5

## 0.10.7-alpha.4

### Patch Changes

- Updated dependencies [a8b194f]
- Updated dependencies [dc93062]
  - @mastra/core@0.10.7-alpha.4
  - @mastra/mcp@0.10.5-alpha.2
  - @mastra/deployer@0.10.7-alpha.4

## 0.10.7-alpha.3

### Patch Changes

- Updated dependencies [792c4c0]
- Updated dependencies [502fe05]
- Updated dependencies [10a4f10]
- Updated dependencies [4efcfa0]
  - @mastra/core@0.10.7-alpha.3
  - @mastra/deployer@0.10.7-alpha.3

## 0.10.7-alpha.2

### Patch Changes

- 5d74aab: vNext network in playground
- 17903a3: Remove install step from dev for telemetry
- 8e1b6e9: dependencies updates:
  - Updated dependency [`zod@^3.25.67` ↗︎](https://www.npmjs.com/package/zod/v/3.25.67) (from `^3.25.57`, in `dependencies`)
- be3d5a3: Remove recharts and ramada (unused deps)
- Updated dependencies [8e1b6e9]
- Updated dependencies [36cd0f1]
- Updated dependencies [2eab82b]
- Updated dependencies [ee93d96]
- Updated dependencies [c00039d]
- Updated dependencies [15e9d26]
- Updated dependencies [9bf1d55]
- Updated dependencies [914684e]
- Updated dependencies [07d6d88]
- Updated dependencies [5d74aab]
- Updated dependencies [5d74aab]
- Updated dependencies [17903a3]
- Updated dependencies [144eb0b]
  - @mastra/deployer@0.10.7-alpha.2
  - @mastra/mcp@0.10.5-alpha.1
  - @mastra/core@0.10.7-alpha.2

## 0.10.7-alpha.1

### Patch Changes

- 21ffb97: Make dynamic form handle schema better
- Updated dependencies [d1baedb]
- Updated dependencies [4d21bf2]
- Updated dependencies [2097952]
- Updated dependencies [4fb0cc2]
- Updated dependencies [d2a7a31]
- Updated dependencies [0e17048]
  - @mastra/core@0.10.7-alpha.1
  - @mastra/mcp@0.10.5-alpha.0
  - @mastra/deployer@0.10.7-alpha.1

## 0.10.7-alpha.0

### Patch Changes

- 9102d89: Fix final output not showing on playground for previously suspended steps
- Updated dependencies [d8f2d19]
- Updated dependencies [9d52b17]
- Updated dependencies [8ba1b51]
  - @mastra/core@0.10.7-alpha.0
  - @mastra/deployer@0.10.7-alpha.0

## 0.10.6

### Patch Changes

- 02560d4: lift evals fetching to the playground package instead
- 084f6aa: Add logs to circular dependency to warn people when starting server might break
- b29c802: Remove open browser
- 5f2aa3e: Move workflow hooks to playground
- 4051477: dependencies updates:
  - Updated dependency [`@clack/prompts@^0.11.0` ↗︎](https://www.npmjs.com/package/@clack/prompts/v/0.11.0) (from `^0.8.2`, in `dependencies`)
  - Updated dependency [`@opentelemetry/instrumentation@^0.202.0` ↗︎](https://www.npmjs.com/package/@opentelemetry/instrumentation/v/0.202.0) (from `^0.57.2`, in `dependencies`)
  - Updated dependency [`posthog-node@4.18.0` ↗︎](https://www.npmjs.com/package/posthog-node/v/4.18.0) (from `4.16.0`, in `dependencies`)
  - Updated dependency [`yocto-spinner@^0.2.3` ↗︎](https://www.npmjs.com/package/yocto-spinner/v/0.2.3) (from `^0.1.2`, in `dependencies`)
  - Added dependency [`open@^10.1.2` ↗︎](https://www.npmjs.com/package/open/v/10.1.2) (to `dependencies`)
- b40f365: dependencies updates:
  - Updated dependency [`@clack/prompts@^0.11.0` ↗︎](https://www.npmjs.com/package/@clack/prompts/v/0.11.0) (from `^0.8.2`, in `dependencies`)
  - Updated dependency [`@opentelemetry/instrumentation@^0.202.0` ↗︎](https://www.npmjs.com/package/@opentelemetry/instrumentation/v/0.202.0) (from `^0.57.2`, in `dependencies`)
  - Updated dependency [`posthog-node@4.18.0` ↗︎](https://www.npmjs.com/package/posthog-node/v/4.18.0) (from `4.16.0`, in `dependencies`)
  - Updated dependency [`yocto-spinner@^0.2.3` ↗︎](https://www.npmjs.com/package/yocto-spinner/v/0.2.3) (from `^0.1.2`, in `dependencies`)
- 63f6b7d: dependencies updates:
  - Updated dependency [`execa@^9.6.0` ↗︎](https://www.npmjs.com/package/execa/v/9.6.0) (from `^9.5.2`, in `dependencies`)
  - Updated dependency [`json-schema-to-zod@^2.6.1` ↗︎](https://www.npmjs.com/package/json-schema-to-zod/v/2.6.1) (from `^2.6.0`, in `dependencies`)
  - Updated dependency [`shell-quote@^1.8.3` ↗︎](https://www.npmjs.com/package/shell-quote/v/1.8.3) (from `^1.8.2`, in `dependencies`)
  - Updated dependency [`strip-json-comments@^5.0.2` ↗︎](https://www.npmjs.com/package/strip-json-comments/v/5.0.2) (from `^5.0.1`, in `dependencies`)
  - Updated dependency [`zod@^3.25.57` ↗︎](https://www.npmjs.com/package/zod/v/3.25.57) (from `^3.25.56`, in `dependencies`)
- 143b4e4: Fix globbing of tools to only capture js/ts files
- 44ba52d: Add proper error message when installation of mastra fails
- 311132e: move useWorkflow to playground instead of playground-ui
- 3270d9d: Fix runtime context being undefined
- 906f992: CLI error log
- 53d3c37: Get workflows from an agent if not found from Mastra instance #5083
- fc677d7: For final result for a workflow
- 47e7029: Add open browser functionality when running mastra dev
- Updated dependencies [63f6b7d]
- Updated dependencies [4051477]
- Updated dependencies [2d12edd]
- Updated dependencies [63f6b7d]
- Updated dependencies [c28ed65]
- Updated dependencies [63f6b7d]
- Updated dependencies [12a95fc]
- Updated dependencies [79b9909]
- Updated dependencies [4b0f8a6]
- Updated dependencies [51264a5]
- Updated dependencies [8e6f677]
- Updated dependencies [d70c420]
- Updated dependencies [ee9af57]
- Updated dependencies [ec7f824]
- Updated dependencies [36f1c36]
- Updated dependencies [084f6aa]
- Updated dependencies [2a16996]
- Updated dependencies [10d352e]
- Updated dependencies [9589624]
- Updated dependencies [bd1674f]
- Updated dependencies [69f76f7]
- Updated dependencies [3270d9d]
- Updated dependencies [53d3c37]
- Updated dependencies [751c894]
- Updated dependencies [577ce3a]
- Updated dependencies [9260b3a]
  - @mastra/core@0.10.6
  - @mastra/deployer@0.10.6
  - @mastra/mcp@0.10.4

## 0.10.6-alpha.7

### Patch Changes

- b29c802: Remove open browser
- Updated dependencies [bd1674f]
- Updated dependencies [69f76f7]
  - @mastra/mcp@0.10.4-alpha.1
  - @mastra/deployer@0.10.6-alpha.5

## 0.10.6-alpha.6

### Patch Changes

- 5f2aa3e: Move workflow hooks to playground
- Updated dependencies [12a95fc]
- Updated dependencies [51264a5]
- Updated dependencies [8e6f677]
  - @mastra/core@0.10.6-alpha.5
  - @mastra/deployer@0.10.6-alpha.5

## 0.10.6-alpha.5

### Patch Changes

- 084f6aa: Add logs to circular dependency to warn people when starting server might break
- Updated dependencies [79b9909]
- Updated dependencies [084f6aa]
- Updated dependencies [9589624]
  - @mastra/deployer@0.10.6-alpha.4
  - @mastra/core@0.10.6-alpha.4

## 0.10.6-alpha.4

### Patch Changes

- 4051477: dependencies updates:
  - Updated dependency [`@clack/prompts@^0.11.0` ↗︎](https://www.npmjs.com/package/@clack/prompts/v/0.11.0) (from `^0.8.2`, in `dependencies`)
  - Updated dependency [`@opentelemetry/instrumentation@^0.202.0` ↗︎](https://www.npmjs.com/package/@opentelemetry/instrumentation/v/0.202.0) (from `^0.57.2`, in `dependencies`)
  - Updated dependency [`posthog-node@4.18.0` ↗︎](https://www.npmjs.com/package/posthog-node/v/4.18.0) (from `4.16.0`, in `dependencies`)
  - Updated dependency [`yocto-spinner@^0.2.3` ↗︎](https://www.npmjs.com/package/yocto-spinner/v/0.2.3) (from `^0.1.2`, in `dependencies`)
  - Added dependency [`open@^10.1.2` ↗︎](https://www.npmjs.com/package/open/v/10.1.2) (to `dependencies`)
- b40f365: dependencies updates:
  - Updated dependency [`@clack/prompts@^0.11.0` ↗︎](https://www.npmjs.com/package/@clack/prompts/v/0.11.0) (from `^0.8.2`, in `dependencies`)
  - Updated dependency [`@opentelemetry/instrumentation@^0.202.0` ↗︎](https://www.npmjs.com/package/@opentelemetry/instrumentation/v/0.202.0) (from `^0.57.2`, in `dependencies`)
  - Updated dependency [`posthog-node@4.18.0` ↗︎](https://www.npmjs.com/package/posthog-node/v/4.18.0) (from `4.16.0`, in `dependencies`)
  - Updated dependency [`yocto-spinner@^0.2.3` ↗︎](https://www.npmjs.com/package/yocto-spinner/v/0.2.3) (from `^0.1.2`, in `dependencies`)
- Updated dependencies [4051477]
- Updated dependencies [c28ed65]
- Updated dependencies [d70c420]
- Updated dependencies [2a16996]
  - @mastra/deployer@0.10.6-alpha.3
  - @mastra/core@0.10.6-alpha.3

## 0.10.6-alpha.3

### Patch Changes

- Updated dependencies [4b0f8a6]
- Updated dependencies [ec7f824]
  - @mastra/core@0.10.6-alpha.2
  - @mastra/deployer@0.10.6-alpha.2

## 0.10.6-alpha.2

### Patch Changes

- 143b4e4: Fix globbing of tools to only capture js/ts files
- 44ba52d: Add proper error message when installation of mastra fails
- 3270d9d: Fix runtime context being undefined
- fc677d7: For final result for a workflow
- Updated dependencies [ee9af57]
- Updated dependencies [3270d9d]
- Updated dependencies [751c894]
- Updated dependencies [577ce3a]
- Updated dependencies [9260b3a]
  - @mastra/deployer@0.10.6-alpha.1
  - @mastra/core@0.10.6-alpha.1

## 0.10.6-alpha.1

### Patch Changes

- 47e7029: Add open browser functionality when running mastra dev

## 0.10.6-alpha.0

### Patch Changes

- 02560d4: lift evals fetching to the playground package instead
- 63f6b7d: dependencies updates:
  - Updated dependency [`execa@^9.6.0` ↗︎](https://www.npmjs.com/package/execa/v/9.6.0) (from `^9.5.2`, in `dependencies`)
  - Updated dependency [`json-schema-to-zod@^2.6.1` ↗︎](https://www.npmjs.com/package/json-schema-to-zod/v/2.6.1) (from `^2.6.0`, in `dependencies`)
  - Updated dependency [`shell-quote@^1.8.3` ↗︎](https://www.npmjs.com/package/shell-quote/v/1.8.3) (from `^1.8.2`, in `dependencies`)
  - Updated dependency [`strip-json-comments@^5.0.2` ↗︎](https://www.npmjs.com/package/strip-json-comments/v/5.0.2) (from `^5.0.1`, in `dependencies`)
  - Updated dependency [`zod@^3.25.57` ↗︎](https://www.npmjs.com/package/zod/v/3.25.57) (from `^3.25.56`, in `dependencies`)
- 311132e: move useWorkflow to playground instead of playground-ui
- 906f992: CLI error log
- 53d3c37: Get workflows from an agent if not found from Mastra instance #5083
- Updated dependencies [63f6b7d]
- Updated dependencies [2d12edd]
- Updated dependencies [63f6b7d]
- Updated dependencies [63f6b7d]
- Updated dependencies [36f1c36]
- Updated dependencies [10d352e]
- Updated dependencies [53d3c37]
  - @mastra/core@0.10.6-alpha.0
  - @mastra/deployer@0.10.6-alpha.0
  - @mastra/mcp@0.10.4-alpha.0

## 0.10.5

### Patch Changes

- 1ba421d: fix the tools not showing on workflows attached to agents
- 8725d02: Improve cli by reducing the amount of setups during interactive prompt
- 13c97f9: Save run status, result and error in storage snapshot
- Updated dependencies [8725d02]
- Updated dependencies [13c97f9]
- Updated dependencies [105f872]
  - @mastra/deployer@0.10.5
  - @mastra/core@0.10.5

## 0.10.4

### Patch Changes

- e719504: don't start posthog when the browser is Brave
- 8e1994a: Fix bug where port auto increments on restart
- afd9fda: Reset retry-count on code change and only retry if server actually is running

  Fixes #4563

- b4ee346: Reintroduce --env flag for mastra dev, build
- f1f1f1b: Add basic filtering capabilities to logs
- 125b1c6: Updated @mastra/mcp-docs-server configuration in create-mastra for Windows - the cmd /c workaround for Cursor/Windsurf is no longer required
- 82090c1: Add pagination to logs
- d1ed912: dependencies updates:
  - Updated dependency [`dotenv@^16.5.0` ↗︎](https://www.npmjs.com/package/dotenv/v/16.5.0) (from `^16.4.7`, in `dependencies`)
- 1ccccff: dependencies updates:
  - Updated dependency [`zod@^3.25.56` ↗︎](https://www.npmjs.com/package/zod/v/3.25.56) (from `^3.24.3`, in `dependencies`)
- 1ccccff: dependencies updates:
  - Updated dependency [`zod@^3.25.56` ↗︎](https://www.npmjs.com/package/zod/v/3.25.56) (from `^3.24.3`, in `dependencies`)
- 26f0031: Removed @latest from @mastra/mcp-docs-server scaffolded configuration for Windsurf/Cursor/VSCode. There is an npx caching issue that causes @latest to break the MCP server for many users, and for now removing @latest makes it work. We will debug this more but for now having a working docs server is more important than it updating every time users start their IDE.
- d7d41f0: Fix mastra dev cmd
- 8f60de4: fix workflow output when the schema is a primitive
- 4c4ee43: [fix] recreate resizable sidebar on workflow
- a528bdb: Add dynamic port allocation if port is already in use
- Updated dependencies [d1ed912]
- Updated dependencies [d1ed912]
- Updated dependencies [f595975]
- Updated dependencies [d90c49f]
- Updated dependencies [1ccccff]
- Updated dependencies [1ccccff]
- Updated dependencies [afd9fda]
- Updated dependencies [f6fd25f]
- Updated dependencies [dffb67b]
- Updated dependencies [f1f1f1b]
- Updated dependencies [925ab94]
- Updated dependencies [9597ee5]
- Updated dependencies [f9816ae]
- Updated dependencies [82090c1]
- Updated dependencies [69f6101]
- Updated dependencies [1b443fd]
- Updated dependencies [ce97900]
- Updated dependencies [fc579cd]
- Updated dependencies [514fdde]
- Updated dependencies [f1309d3]
- Updated dependencies [bebd27c]
- Updated dependencies [14a2566]
- Updated dependencies [f7f8293]
- Updated dependencies [48eddb9]
- Updated dependencies [66f4424]
  - @mastra/core@0.10.4
  - @mastra/deployer@0.10.4
  - @mastra/loggers@0.10.2
  - @mastra/mcp@0.10.3

## 0.10.4-alpha.5

### Patch Changes

- 4c4ee43: [fix] recreate resizable sidebar on workflow
- Updated dependencies [66f4424]
  - @mastra/loggers@0.10.2-alpha.1

## 0.10.4-alpha.4

### Patch Changes

- Updated dependencies [925ab94]
  - @mastra/core@0.10.4-alpha.3
  - @mastra/deployer@0.10.4-alpha.3

## 0.10.4-alpha.3

### Patch Changes

- Updated dependencies [48eddb9]
  - @mastra/core@0.10.4-alpha.2
  - @mastra/deployer@0.10.4-alpha.2

## 0.10.4-alpha.2

### Patch Changes

- e719504: don't start posthog when the browser is Brave
- b4ee346: Reintroduce --env flag for mastra dev, build

## 0.10.4-alpha.1

### Patch Changes

- 8e1994a: Fix bug where port auto increments on restart
- 125b1c6: Updated @mastra/mcp-docs-server configuration in create-mastra for Windows - the cmd /c workaround for Cursor/Windsurf is no longer required
- 1ccccff: dependencies updates:
  - Updated dependency [`zod@^3.25.56` ↗︎](https://www.npmjs.com/package/zod/v/3.25.56) (from `^3.24.3`, in `dependencies`)
- 1ccccff: dependencies updates:
  - Updated dependency [`zod@^3.25.56` ↗︎](https://www.npmjs.com/package/zod/v/3.25.56) (from `^3.24.3`, in `dependencies`)
- 26f0031: Removed @latest from @mastra/mcp-docs-server scaffolded configuration for Windsurf/Cursor/VSCode. There is an npx caching issue that causes @latest to break the MCP server for many users, and for now removing @latest makes it work. We will debug this more but for now having a working docs server is more important than it updating every time users start their IDE.
- Updated dependencies [d90c49f]
- Updated dependencies [1ccccff]
- Updated dependencies [1ccccff]
- Updated dependencies [f6fd25f]
- Updated dependencies [dffb67b]
- Updated dependencies [9597ee5]
- Updated dependencies [fc579cd]
- Updated dependencies [514fdde]
- Updated dependencies [f1309d3]
- Updated dependencies [bebd27c]
- Updated dependencies [f7f8293]
  - @mastra/deployer@0.10.4-alpha.1
  - @mastra/core@0.10.4-alpha.1
  - @mastra/mcp@0.10.3-alpha.0

## 0.10.4-alpha.0

### Patch Changes

- afd9fda: Reset retry-count on code change and only retry if server actually is running

  Fixes #4563

- f1f1f1b: Add basic filtering capabilities to logs
- 82090c1: Add pagination to logs
- d1ed912: dependencies updates:
  - Updated dependency [`dotenv@^16.5.0` ↗︎](https://www.npmjs.com/package/dotenv/v/16.5.0) (from `^16.4.7`, in `dependencies`)
- d7d41f0: Fix mastra dev cmd
- 8f60de4: fix workflow output when the schema is a primitive
- a528bdb: Add dynamic port allocation if port is already in use
- Updated dependencies [d1ed912]
- Updated dependencies [d1ed912]
- Updated dependencies [f595975]
- Updated dependencies [afd9fda]
- Updated dependencies [f1f1f1b]
- Updated dependencies [f9816ae]
- Updated dependencies [82090c1]
- Updated dependencies [69f6101]
- Updated dependencies [1b443fd]
- Updated dependencies [ce97900]
- Updated dependencies [14a2566]
  - @mastra/core@0.10.4-alpha.0
  - @mastra/deployer@0.10.4-alpha.0
  - @mastra/loggers@0.10.2-alpha.0

## 0.10.3

### Patch Changes

- Updated dependencies [2b0fc7e]
  - @mastra/core@0.10.3
  - @mastra/deployer@0.10.3

## 0.10.3-alpha.0

### Patch Changes

- Updated dependencies [2b0fc7e]
  - @mastra/core@0.10.3-alpha.0
  - @mastra/deployer@0.10.3-alpha.0

## 0.10.2

### Patch Changes

- 73fec0b: Mastra start cli command"
- 401bbae: Show workflow graph from stepGraph of previous runs when viewing a previous run
- 592a2db: Added different icons for agents and workflows in mcp tools list
- 1b5fc55: Fixed an issue where the playground wouldn't display images saved in memory. Fixed memory to always store images as strings. Removed duplicate storage of reasoning and file/image parts in storage dbs
- f73e11b: fix telemetry disabled not working on playground
- 9666468: move the fetch traces call to the playground instead of playground-ui
- 1fcc048: chore: generate sourcemaps in dev build
- 90e96de: Fix: prevent default flag from triggering interactive prompt
- a399086: Bumping because we forgot to
- 89a69d0: add a way to go to the given trace of a workflow step
- 6fd77b5: add docs and txt support for multi modal
- 9faee5b: small fixes in the workflows graph
- 631683f: move workflow runs list in playground-ui instead of playground
- 068b850: fix: able to pass headers to playground components which are using the mastra client
- 668af6d: Fix mastra dev server restarts
- f0d559f: Fix peerdeps for alpha channel
- f6ddf55: fix traces not showing and reduce API surface from playground ui
- 9a31c09: Highlight steps in nested workflows on workflow graph
- Updated dependencies [ee77e78]
- Updated dependencies [592a2db]
- Updated dependencies [e5dc18d]
- Updated dependencies [ab5adbe]
- Updated dependencies [e8d2aff]
- Updated dependencies [1e8bb40]
- Updated dependencies [1b5fc55]
- Updated dependencies [195c428]
- Updated dependencies [f73e11b]
- Updated dependencies [37643b8]
- Updated dependencies [99fd6cf]
- Updated dependencies [1fcc048]
- Updated dependencies [c5bf1ce]
- Updated dependencies [f946acf]
- Updated dependencies [add596e]
- Updated dependencies [8dc94d8]
- Updated dependencies [ecebbeb]
- Updated dependencies [4187ed4]
- Updated dependencies [79d5145]
- Updated dependencies [12b7002]
- Updated dependencies [f0d559f]
- Updated dependencies [2901125]
  - @mastra/core@0.10.2
  - @mastra/mcp@0.10.2
  - @mastra/deployer@0.10.2
  - @mastra/loggers@0.10.1

## 0.10.2-alpha.9

### Patch Changes

- 90e96de: Fix: prevent default flag from triggering interactive prompt
- Updated dependencies [37643b8]
- Updated dependencies [79d5145]
  - @mastra/core@0.10.2-alpha.8
  - @mastra/deployer@0.10.2-alpha.8

## 0.10.2-alpha.8

### Patch Changes

- a399086: Bumping because we forgot to
  - @mastra/deployer@0.10.2-alpha.7
  - @mastra/core@0.10.2-alpha.7

## 0.10.2-alpha.7

### Patch Changes

- 1fcc048: chore: generate sourcemaps in dev build
- 6fd77b5: add docs and txt support for multi modal
- 631683f: move workflow runs list in playground-ui instead of playground
- Updated dependencies [99fd6cf]
- Updated dependencies [1fcc048]
- Updated dependencies [8dc94d8]
  - @mastra/core@0.10.2-alpha.6
  - @mastra/deployer@0.10.2-alpha.6

## 0.10.2-alpha.6

### Patch Changes

- 1b5fc55: Fixed an issue where the playground wouldn't display images saved in memory. Fixed memory to always store images as strings. Removed duplicate storage of reasoning and file/image parts in storage dbs
- 9666468: move the fetch traces call to the playground instead of playground-ui
- 668af6d: Fix mastra dev server restarts
- Updated dependencies [1b5fc55]
- Updated dependencies [add596e]
- Updated dependencies [ecebbeb]
  - @mastra/core@0.10.2-alpha.5
  - @mastra/deployer@0.10.2-alpha.5

## 0.10.2-alpha.5

### Patch Changes

- 401bbae: Show workflow graph from stepGraph of previous runs when viewing a previous run

## 0.10.2-alpha.4

### Patch Changes

- Updated dependencies [c5bf1ce]
- Updated dependencies [12b7002]
  - @mastra/core@0.10.2-alpha.4
  - @mastra/deployer@0.10.2-alpha.4

## 0.10.2-alpha.3

### Patch Changes

- f73e11b: fix telemetry disabled not working on playground
- 068b850: fix: able to pass headers to playground components which are using the mastra client
- Updated dependencies [ab5adbe]
- Updated dependencies [195c428]
- Updated dependencies [f73e11b]
- Updated dependencies [f946acf]
  - @mastra/core@0.10.2-alpha.3
  - @mastra/deployer@0.10.2-alpha.3

## 0.10.2-alpha.2

### Patch Changes

- 73fec0b: Mastra start cli command"
- f0d559f: Fix peerdeps for alpha channel
- f6ddf55: fix traces not showing and reduce API surface from playground ui
- Updated dependencies [e8d2aff]
- Updated dependencies [1e8bb40]
- Updated dependencies [4187ed4]
- Updated dependencies [f0d559f]
  - @mastra/deployer@0.10.2-alpha.2
  - @mastra/core@0.10.2-alpha.2
  - @mastra/loggers@0.10.1-alpha.0
  - @mastra/mcp@0.10.2-alpha.1

## 0.10.2-alpha.1

### Patch Changes

- Updated dependencies [ee77e78]
- Updated dependencies [2901125]
  - @mastra/core@0.10.2-alpha.1
  - @mastra/deployer@0.10.2-alpha.1

## 0.10.2-alpha.0

### Patch Changes

- 592a2db: Added different icons for agents and workflows in mcp tools list
- 89a69d0: add a way to go to the given trace of a workflow step
- 9faee5b: small fixes in the workflows graph
- 9a31c09: Highlight steps in nested workflows on workflow graph
- Updated dependencies [592a2db]
- Updated dependencies [e5dc18d]
  - @mastra/core@0.10.2-alpha.0
  - @mastra/mcp@0.10.2-alpha.0
  - @mastra/deployer@0.10.2-alpha.0

## 0.10.1

### Patch Changes

- d70b807: Improve storage.init
- b4365f6: add empty states for agents network and tools
- d0932ac: add multi modal input behind feature flag
- bed0916: Update default tools path in mastra dev,build
- 3c2dba5: add workflow run list
- 23d56b1: Handle dev server errors, restart, exit
- 3240a80: feat: add vscode as option to interactive prompt
- 992fe17: chore: remove check for alpha and non-alpha mastra packages from mastra lint
- 267773e: Show map config on workflow graph
  Highlight borders for conditions too on workflow graph
  Fix watch stream
- 35bb6a3: Allow undefined temprature, topP model setting from playground
- 33f1c64: revamp the experience for workflows
- 6015bdf: Leverage defaultAgentStreamOption, defaultAgentGenerateOption in playground
- 7a32205: add empty states for workflows, agents and mcp servers
- Updated dependencies [d70b807]
- Updated dependencies [6d16390]
- Updated dependencies [1e4a421]
- Updated dependencies [ab89d6a]
- Updated dependencies [200d0da]
- Updated dependencies [bed0916]
- Updated dependencies [bf5f17b]
- Updated dependencies [5343f93]
- Updated dependencies [38aee50]
- Updated dependencies [5c41100]
- Updated dependencies [d6a759b]
- Updated dependencies [fe68410]
- Updated dependencies [6015bdf]
  - @mastra/core@0.10.1
  - @mastra/deployer@0.10.1
  - @mastra/mcp@0.10.1

## 0.10.1-alpha.6

### Patch Changes

- 3240a80: feat: add vscode as option to interactive prompt

## 0.10.1-alpha.5

### Patch Changes

- 992fe17: chore: remove check for alpha and non-alpha mastra packages from mastra lint
- 267773e: Show map config on workflow graph
  Highlight borders for conditions too on workflow graph
  Fix watch stream

## 0.10.1-alpha.4

### Patch Changes

- d70b807: Improve storage.init
- 3c2dba5: add workflow run list
- 33f1c64: revamp the experience for workflows
- Updated dependencies [d70b807]
  - @mastra/core@0.10.1-alpha.3
  - @mastra/deployer@0.10.1-alpha.3

## 0.10.1-alpha.3

### Patch Changes

- 6015bdf: Leverage defaultAgentStreamOption, defaultAgentGenerateOption in playground
- Updated dependencies [fe68410]
- Updated dependencies [6015bdf]
  - @mastra/deployer@0.10.1-alpha.2
  - @mastra/core@0.10.1-alpha.2

## 0.10.1-alpha.2

### Patch Changes

- b4365f6: add empty states for agents network and tools
- d0932ac: add multi modal input behind feature flag
- bed0916: Update default tools path in mastra dev,build
- 23d56b1: Handle dev server errors, restart, exit
- Updated dependencies [ab89d6a]
- Updated dependencies [200d0da]
- Updated dependencies [bed0916]
- Updated dependencies [bf5f17b]
- Updated dependencies [5343f93]
- Updated dependencies [38aee50]
- Updated dependencies [5c41100]
- Updated dependencies [d6a759b]
  - @mastra/mcp@0.10.1-alpha.0
  - @mastra/core@0.10.1-alpha.1
  - @mastra/deployer@0.10.1-alpha.1

## 0.10.1-alpha.1

### Patch Changes

- 7a32205: add empty states for workflows, agents and mcp servers

## 0.10.1-alpha.0

### Patch Changes

- 35bb6a3: Allow undefined temprature, topP model setting from playground
- Updated dependencies [6d16390]
- Updated dependencies [1e4a421]
  - @mastra/deployer@0.10.1-alpha.0
  - @mastra/core@0.10.1-alpha.0

## 0.10.0

### Minor Changes

- 83da932: Move @mastra/core to peerdeps
- 5eb5a99: Remove pino from @mastra/core into @mastra/loggers
- 0dcb9f0: Memory breaking changes: storage, vector, and embedder are now required. Working memory text streaming has been removed, only tool calling is supported for working memory updates now. Default settings have changed (lastMessages: 40->10, semanticRecall: true->false, threads.generateTitle: true->false)

### Patch Changes

- bdb7934: fix tools not showing (discoverability)
- b3a3d63: BREAKING: Make vnext workflow the default worklow, and old workflow legacy_workflow
- ae122cc: show the entities ID close to the copy button
- 99552bc: revamp the UI of the tools page
- f2d3352: fix overflow scroll in runtime context
- db4211d: improve the UI/UX of the runtime context with formatting, copying, docs and syntax highlighting
- 9b7294a: Revamp the UI for the right sidebar of the agents page
- e2c2cf1: Persist playground agent settings across refresh
- 47776b4: update the mcp pages
- fd69cc3: revamp UI of workflow "Run" pane
- 1270183: Add waterfull traces instead of stacked progressbar (UI improvement mostly)
- 392a14d: changing the empty state for threads in agent chat
- 8d9feae: Add missing x-mastra-dev-playground headers
- cbf153f: Handle broken images on the playground
- 0cae9b1: sidebar adjustments (storing status + showing the action of collapsing / expanding)
- d2b595a: a better tools playground page
- 1f6886f: bring back the memory not activated warning in agent chat
- 8a68886: revamp the UI of the workflow form input
- 8332970: Rename agents, tools, workflow example files.
- 2672a05: Add MCP servers and tool call execution to playground
- Updated dependencies [b3a3d63]
- Updated dependencies [344f453]
- Updated dependencies [0a3ae6d]
- Updated dependencies [95911be]
- Updated dependencies [83da932]
- Updated dependencies [f53a6ac]
- Updated dependencies [5eb5a99]
- Updated dependencies [7e632c5]
- Updated dependencies [1e9fbfa]
- Updated dependencies [eabdcd9]
- Updated dependencies [90be034]
- Updated dependencies [129b5f5]
- Updated dependencies [8d9feae]
- Updated dependencies [aaf0e48]
- Updated dependencies [99f050a]
- Updated dependencies [d0ee3c6]
- Updated dependencies [b2ae5aa]
- Updated dependencies [48e5910]
- Updated dependencies [23f258c]
- Updated dependencies [a7292b0]
- Updated dependencies [0dcb9f0]
- Updated dependencies [2672a05]
  - @mastra/deployer@0.10.0
  - @mastra/core@0.10.0
  - @mastra/mcp@0.10.0
  - @mastra/loggers@0.10.0

## 0.7.0-alpha.2

### Patch Changes

- 47776b4: update the mcp pages
- Updated dependencies [129b5f5]
  - @mastra/loggers@0.2.0-alpha.2

## 0.7.0-alpha.1

### Minor Changes

- 83da932: Move @mastra/core to peerdeps
- 5eb5a99: Remove pino from @mastra/core into @mastra/loggers
- 0dcb9f0: Memory breaking changes: storage, vector, and embedder are now required. Working memory text streaming has been removed, only tool calling is supported for working memory updates now. Default settings have changed (lastMessages: 40->10, semanticRecall: true->false, threads.generateTitle: true->false)

### Patch Changes

- bdb7934: fix tools not showing (discoverability)
- b3a3d63: BREAKING: Make vnext workflow the default worklow, and old workflow legacy_workflow
- ae122cc: show the entities ID close to the copy button
- f2d3352: fix overflow scroll in runtime context
- fd69cc3: revamp UI of workflow "Run" pane
- 8d9feae: Add missing x-mastra-dev-playground headers
- cbf153f: Handle broken images on the playground
- 0cae9b1: sidebar adjustments (storing status + showing the action of collapsing / expanding)
- d2b595a: a better tools playground page
- 1f6886f: bring back the memory not activated warning in agent chat
- 8a68886: revamp the UI of the workflow form input
- 8332970: Rename agents, tools, workflow example files.
- Updated dependencies [b3a3d63]
- Updated dependencies [344f453]
- Updated dependencies [0a3ae6d]
- Updated dependencies [95911be]
- Updated dependencies [83da932]
- Updated dependencies [5eb5a99]
- Updated dependencies [7e632c5]
- Updated dependencies [1e9fbfa]
- Updated dependencies [8d9feae]
- Updated dependencies [b2ae5aa]
- Updated dependencies [a7292b0]
- Updated dependencies [0dcb9f0]
  - @mastra/deployer@0.4.0-alpha.1
  - @mastra/core@0.10.0-alpha.1
  - @mastra/mcp@0.6.0-alpha.1
  - @mastra/loggers@0.2.0-alpha.1

## 0.6.4-alpha.0

### Patch Changes

- 99552bc: revamp the UI of the tools page
- db4211d: improve the UI/UX of the runtime context with formatting, copying, docs and syntax highlighting
- 9b7294a: Revamp the UI for the right sidebar of the agents page
- e2c2cf1: Persist playground agent settings across refresh
- 1270183: Add waterfull traces instead of stacked progressbar (UI improvement mostly)
- 392a14d: changing the empty state for threads in agent chat
- 2672a05: Add MCP servers and tool call execution to playground
- Updated dependencies [f53a6ac]
- Updated dependencies [eabdcd9]
- Updated dependencies [90be034]
- Updated dependencies [aaf0e48]
- Updated dependencies [99f050a]
- Updated dependencies [d0ee3c6]
- Updated dependencies [48e5910]
- Updated dependencies [23f258c]
- Updated dependencies [2672a05]
  - @mastra/core@0.9.5-alpha.0
  - @mastra/deployer@0.3.5-alpha.0
  - @mastra/mcp@0.5.1-alpha.0

## 0.6.3

### Patch Changes

- cebc50a: "mastra lint now supports comments in tsconfig.json"
- 15dc8e4: Use detected package manager in post-create instructions
- a3435f8: Add node engine to create-mastra project package.json
- cb1f698: Set runtimeContext from playground for agents, tools, workflows
- Updated dependencies [396be50]
- Updated dependencies [ab80e7e]
- Updated dependencies [5c70b8a]
- Updated dependencies [c3bd795]
- Updated dependencies [da082f8]
- Updated dependencies [a5810ce]
- Updated dependencies [3e9c131]
- Updated dependencies [3171b5b]
- Updated dependencies [03c40d1]
- Updated dependencies [cb1f698]
- Updated dependencies [973e5ac]
- Updated dependencies [daf942f]
- Updated dependencies [0b8b868]
- Updated dependencies [9e1eff5]
- Updated dependencies [6fa1ad1]
- Updated dependencies [c28d7a0]
- Updated dependencies [edf1e88]
  - @mastra/core@0.9.4
  - @mastra/deployer@0.3.4

## 0.6.3-alpha.6

### Patch Changes

- Updated dependencies [5c70b8a]
- Updated dependencies [3e9c131]
  - @mastra/deployer@0.3.4-alpha.4
  - @mastra/core@0.9.4-alpha.4

## 0.6.3-alpha.5

### Patch Changes

- a3435f8: Add node engine to create-mastra project package.json

## 0.6.3-alpha.4

### Patch Changes

- Updated dependencies [396be50]
- Updated dependencies [c3bd795]
- Updated dependencies [da082f8]
- Updated dependencies [a5810ce]
  - @mastra/core@0.9.4-alpha.3
  - @mastra/deployer@0.3.4-alpha.3

## 0.6.3-alpha.3

### Patch Changes

- cebc50a: "mastra lint now supports comments in tsconfig.json"
  - @mastra/deployer@0.3.4-alpha.2

## 0.6.3-alpha.2

### Patch Changes

- Updated dependencies [3171b5b]
- Updated dependencies [03c40d1]
- Updated dependencies [973e5ac]
- Updated dependencies [9e1eff5]
  - @mastra/core@0.9.4-alpha.2
  - @mastra/deployer@0.3.4-alpha.2

## 0.6.3-alpha.1

### Patch Changes

- Updated dependencies [ab80e7e]
- Updated dependencies [6fa1ad1]
- Updated dependencies [c28d7a0]
- Updated dependencies [edf1e88]
  - @mastra/core@0.9.4-alpha.1
  - @mastra/deployer@0.3.4-alpha.1

## 0.6.3-alpha.0

### Patch Changes

- 15dc8e4: Use detected package manager in post-create instructions
- cb1f698: Set runtimeContext from playground for agents, tools, workflows
- Updated dependencies [cb1f698]
- Updated dependencies [daf942f]
- Updated dependencies [0b8b868]
  - @mastra/deployer@0.3.4-alpha.0
  - @mastra/core@0.9.4-alpha.0

## 0.6.2

### Patch Changes

- 0db0992: - add new --mcp option to cli
  - add support for mcp in vscode
  - include examples with --default flag
- b5d2de0: In vNext workflow serializedStepGraph, return only serializedStepFlow for steps created from a workflow
  allow viewing inner nested workflows in a multi-layered nested vnext workflow on the playground
- 62c9e7d: Fix disappearing tool calls in streaming
- Updated dependencies [e450778]
- Updated dependencies [8902157]
- Updated dependencies [ca0dc88]
- Updated dependencies [526c570]
- Updated dependencies [d7a6a33]
- Updated dependencies [9cd1a46]
- Updated dependencies [b5d2de0]
- Updated dependencies [644f8ad]
- Updated dependencies [70dbf51]
  - @mastra/core@0.9.3
  - @mastra/deployer@0.3.3

## 0.6.2-alpha.1

### Patch Changes

- 62c9e7d: Fix disappearing tool calls in streaming
- Updated dependencies [e450778]
- Updated dependencies [8902157]
- Updated dependencies [ca0dc88]
- Updated dependencies [9cd1a46]
- Updated dependencies [70dbf51]
  - @mastra/core@0.9.3-alpha.1
  - @mastra/deployer@0.3.3-alpha.1

## 0.6.2-alpha.0

### Patch Changes

- b5d2de0: In vNext workflow serializedStepGraph, return only serializedStepFlow for steps created from a workflow
  allow viewing inner nested workflows in a multi-layered nested vnext workflow on the playground
- Updated dependencies [526c570]
- Updated dependencies [b5d2de0]
- Updated dependencies [644f8ad]
  - @mastra/core@0.9.3-alpha.0
  - @mastra/deployer@0.3.3-alpha.0

## 0.6.1

### Patch Changes

- 144fa1b: lift up the traces fetching and allow to pass them down in the TracesTable. It allows passing down mastra client traces OR clickhouse traces
- 33b84fd: fix showing sig digits in trace / span duration
- 4155f47: Add parameters to filter workflow runs
  Add fromDate and toDate to telemetry parameters
- 8607972: Introduce Mastra lint cli command
- 2cf3b8f: dependencies updates:
  - Updated dependency [`zod@^3.24.3` ↗︎](https://www.npmjs.com/package/zod/v/3.24.3) (from `^3.24.2`, in `dependencies`)
  - Updated dependency [`zod-to-json-schema@^3.24.5` ↗︎](https://www.npmjs.com/package/zod-to-json-schema/v/3.24.5) (from `^3.24.3`, in `dependencies`)
- 0097d50: Add serializedStepGraph to vNext workflow
  Return serializedStepGraph from vNext workflow
  Use serializedStepGraph in vNext workflow graph
- 5b43dd0: revamp ui for threads
- 7eeb2bc: Added explicit storage to memory in create-mastra so new projects don't see breaking change warnings
- 8ea9d17: Pinned Posthog-node which is broken in the most recent version of that package https://github.com/PostHog/posthog-js-lite/issues/491
- 2429c74: Add get workflow runs api to client-js
- fba031f: Show traces for vNext workflow
- b63e712: refactor: Separate fetching traces from within playground-ui components
- Updated dependencies [2cf3b8f]
- Updated dependencies [6052aa6]
- Updated dependencies [967b41c]
- Updated dependencies [3d2fb5c]
- Updated dependencies [26738f4]
- Updated dependencies [4155f47]
- Updated dependencies [254f5c3]
- Updated dependencies [7eeb2bc]
- Updated dependencies [b804723]
- Updated dependencies [8607972]
- Updated dependencies [a798090]
- Updated dependencies [ccef9f9]
- Updated dependencies [0097d50]
- Updated dependencies [7eeb2bc]
- Updated dependencies [17826a9]
- Updated dependencies [7d8b7c7]
- Updated dependencies [fba031f]
- Updated dependencies [3a5f1e1]
- Updated dependencies [51e6923]
- Updated dependencies [8398d89]
  - @mastra/deployer@0.3.2
  - @mastra/core@0.9.2

## 0.6.1-alpha.6

### Patch Changes

- 144fa1b: lift up the traces fetching and allow to pass them down in the TracesTable. It allows passing down mastra client traces OR clickhouse traces
- Updated dependencies [6052aa6]
- Updated dependencies [a798090]
- Updated dependencies [7d8b7c7]
- Updated dependencies [3a5f1e1]
- Updated dependencies [8398d89]
  - @mastra/core@0.9.2-alpha.6
  - @mastra/deployer@0.3.2-alpha.6

## 0.6.1-alpha.5

### Patch Changes

- 8607972: Introduce Mastra lint cli command
- 7eeb2bc: Added explicit storage to memory in create-mastra so new projects don't see breaking change warnings
- fba031f: Show traces for vNext workflow
- Updated dependencies [3d2fb5c]
- Updated dependencies [7eeb2bc]
- Updated dependencies [8607972]
- Updated dependencies [7eeb2bc]
- Updated dependencies [fba031f]
  - @mastra/core@0.9.2-alpha.5
  - @mastra/deployer@0.3.2-alpha.5

## 0.6.1-alpha.4

### Patch Changes

- 5b43dd0: revamp ui for threads
- 8ea9d17: Pinned Posthog-node which is broken in the most recent version of that package https://github.com/PostHog/posthog-js-lite/issues/491
- Updated dependencies [ccef9f9]
- Updated dependencies [51e6923]
  - @mastra/core@0.9.2-alpha.4
  - @mastra/deployer@0.3.2-alpha.4

## 0.6.1-alpha.3

### Patch Changes

- 33b84fd: fix showing sig digits in trace / span duration
- 4155f47: Add parameters to filter workflow runs
  Add fromDate and toDate to telemetry parameters
- b63e712: refactor: Separate fetching traces from within playground-ui components
- Updated dependencies [967b41c]
- Updated dependencies [4155f47]
- Updated dependencies [17826a9]
  - @mastra/core@0.9.2-alpha.3
  - @mastra/deployer@0.3.2-alpha.3

## 0.6.1-alpha.2

### Patch Changes

- Updated dependencies [26738f4]
  - @mastra/core@0.9.2-alpha.2
  - @mastra/deployer@0.3.2-alpha.2

## 0.6.1-alpha.1

### Patch Changes

- 2429c74: Add get workflow runs api to client-js
- Updated dependencies [254f5c3]
- Updated dependencies [b804723]
  - @mastra/deployer@0.3.2-alpha.1
  - @mastra/core@0.9.2-alpha.1

## 0.6.1-alpha.0

### Patch Changes

- 0097d50: Add serializedStepGraph to vNext workflow
  Return serializedStepGraph from vNext workflow
  Use serializedStepGraph in vNext workflow graph
- Updated dependencies [0097d50]
  - @mastra/core@0.9.2-alpha.0
  - @mastra/deployer@0.3.2-alpha.0

## 0.6.0

### Minor Changes

- e126a44: improve non-interactive mode of the mastra cli and create-mastra by adding --no-example and --dir flags

### Patch Changes

- 34a76ca: Call workflow cleanup function when closing watch stream controller
- 0ccb8b4: Fix deployer bundling when custom mastra dir is set
- 25d3c39: build logs for how to load instrumentation for build output
- 70124e1: revamp the ui for traces
- 20275d4: Adding warnings for current implicit Memory default options as they will be changing soon in a breaking change. Also added memory to create-mastra w/ new defaults so new projects don't see these warnings
- 3b74a74: add badge for failure / successful traces
- 05806e3: revamp the UI of the chat in playground
- 926821d: Fix triggerSchema default not showing in workflow ui
- 0c3c4f4: Playground routing model settings for AgentNetworks
- 1700eca: fixing overflow on agent traces
- b50b9b7: Add vNext workflow to client-js
- 11d4485: Show VNext workflows on the playground
  Show running status for step in vNext workflowState
- ca665d3: fix the ui for smaller screen regarding traces
- 57b25ed: Use resumeSchema to show inputs on the playground for suspended workflows
- f1d4b7a: Add x-mastra-dev-playground header to all playground requests
- 5a66ced: add click on trace row
- 8863033: Fix tools api in local dev api
- 2d4001d: Add new @msstra/libsql package and use it in create-mastra
- 5ebe2aa: Adds ability to add a global configuration for cursor for the Mastra docs MCP server during creation of a Mastra project. Allowing all cursor projects to have access to the MCP server.
- Updated dependencies [e7c2881]
- Updated dependencies [0ccb8b4]
- Updated dependencies [92c598d]
- Updated dependencies [405b63d]
- Updated dependencies [81fb7f6]
- Updated dependencies [20275d4]
- Updated dependencies [7d1892c]
- Updated dependencies [ebdb781]
- Updated dependencies [a90a082]
- Updated dependencies [2d17c73]
- Updated dependencies [61e92f5]
- Updated dependencies [35955b0]
- Updated dependencies [6262bd5]
- Updated dependencies [c1409ef]
- Updated dependencies [3e7b69d]
- Updated dependencies [e4943b8]
- Updated dependencies [11d4485]
- Updated dependencies [479f490]
- Updated dependencies [530ced1]
- Updated dependencies [c23a81c]
- Updated dependencies [611aa4a]
- Updated dependencies [2d4001d]
- Updated dependencies [c71013a]
- Updated dependencies [1d3b1cd]
  - @mastra/deployer@0.3.1
  - @mastra/core@0.9.1

## 0.6.0-alpha.11

### Patch Changes

- ca665d3: fix the ui for smaller screen regarding traces

## 0.6.0-alpha.10

### Patch Changes

- Updated dependencies [2d17c73]
  - @mastra/core@0.9.1-alpha.8
  - @mastra/deployer@0.3.1-alpha.8

## 0.6.0-alpha.9

### Patch Changes

- Updated dependencies [1d3b1cd]
  - @mastra/core@0.9.1-alpha.7
  - @mastra/deployer@0.3.1-alpha.7

## 0.6.0-alpha.8

### Patch Changes

- Updated dependencies [c23a81c]
  - @mastra/core@0.9.1-alpha.6
  - @mastra/deployer@0.3.1-alpha.6

## 0.6.0-alpha.7

### Patch Changes

- Updated dependencies [3e7b69d]
  - @mastra/core@0.9.1-alpha.5
  - @mastra/deployer@0.3.1-alpha.5

## 0.6.0-alpha.6

### Patch Changes

- 25d3c39: build logs for how to load instrumentation for build output

## 0.6.0-alpha.5

### Patch Changes

- 3b74a74: add badge for failure / successful traces
- 5a66ced: add click on trace row
- Updated dependencies [e4943b8]
- Updated dependencies [479f490]
  - @mastra/core@0.9.1-alpha.4
  - @mastra/deployer@0.3.1-alpha.4

## 0.6.0-alpha.4

### Patch Changes

- 5ebe2aa: Adds ability to add a global configuration for cursor for the Mastra docs MCP server during creation of a Mastra project. Allowing all cursor projects to have access to the MCP server.

## 0.6.0-alpha.3

### Patch Changes

- 34a76ca: Call workflow cleanup function when closing watch stream controller
- 0c3c4f4: Playground routing model settings for AgentNetworks
- 1700eca: fixing overflow on agent traces
- Updated dependencies [6262bd5]
  - @mastra/deployer@0.3.1-alpha.3
  - @mastra/core@0.9.1-alpha.3

## 0.6.0-alpha.2

### Patch Changes

- 70124e1: revamp the ui for traces
- 926821d: Fix triggerSchema default not showing in workflow ui
- 57b25ed: Use resumeSchema to show inputs on the playground for suspended workflows
- f1d4b7a: Add x-mastra-dev-playground header to all playground requests
- Updated dependencies [405b63d]
- Updated dependencies [61e92f5]
- Updated dependencies [c71013a]
  - @mastra/core@0.9.1-alpha.2
  - @mastra/deployer@0.3.1-alpha.2

## 0.6.0-alpha.1

### Minor Changes

- e126a44: improve non-interactive mode of the mastra cli and create-mastra by adding --no-example and --dir flags

### Patch Changes

- 0ccb8b4: Fix deployer bundling when custom mastra dir is set
- 20275d4: Adding warnings for current implicit Memory default options as they will be changing soon in a breaking change. Also added memory to create-mastra w/ new defaults so new projects don't see these warnings
- 05806e3: revamp the UI of the chat in playground
- b50b9b7: Add vNext workflow to client-js
- 11d4485: Show VNext workflows on the playground
  Show running status for step in vNext workflowState
- 8863033: Fix tools api in local dev api
- 2d4001d: Add new @msstra/libsql package and use it in create-mastra
- Updated dependencies [e7c2881]
- Updated dependencies [0ccb8b4]
- Updated dependencies [92c598d]
- Updated dependencies [20275d4]
- Updated dependencies [7d1892c]
- Updated dependencies [ebdb781]
- Updated dependencies [a90a082]
- Updated dependencies [35955b0]
- Updated dependencies [c1409ef]
- Updated dependencies [11d4485]
- Updated dependencies [530ced1]
- Updated dependencies [611aa4a]
- Updated dependencies [2d4001d]
  - @mastra/deployer@0.3.1-alpha.1
  - @mastra/core@0.9.1-alpha.1

## 0.5.1-alpha.0

### Patch Changes

- Updated dependencies [81fb7f6]
  - @mastra/core@0.9.1-alpha.0
  - @mastra/deployer@0.3.1-alpha.0

## 0.5.0

### Minor Changes

- fe3ae4d: Remove \_\_ functions in storage and move to storage proxy to make sure init is called

### Patch Changes

- c489535: update --llm options for init command to list all providers
- 7e92011: Include tools with deployment builds
- 7184dc5: Add support to pass project path directly to create-mastra and improve tag handling
- c821402: Fix table layout issue in the Agent Network section of the Playground.
- 9c26508: Fixed an issue where "mastra dev" wouldn't always print out localhost:4111 logs due to new NODE_ENV fixes
- 735ead7: Add support for process.env.development
- 16a8648: Disable swaggerUI, playground for production builds, mastra instance server build config to enable swaggerUI, apiReqLogs, openAPI documentation for prod builds
- bdbde72: Sync DS components with Cloud
- Updated dependencies [b9122b0]
- Updated dependencies [000a6d4]
- Updated dependencies [08bb78e]
- Updated dependencies [3527610]
- Updated dependencies [ed2f549]
- Updated dependencies [7e92011]
- Updated dependencies [9ee4293]
- Updated dependencies [03f3cd0]
- Updated dependencies [c0f22b4]
- Updated dependencies [71d9444]
- Updated dependencies [157c741]
- Updated dependencies [8a8a73b]
- Updated dependencies [0a033fa]
- Updated dependencies [fe3ae4d]
- Updated dependencies [2538066]
- Updated dependencies [9c26508]
- Updated dependencies [63fe16a]
- Updated dependencies [0f4eae3]
- Updated dependencies [3f9d151]
- Updated dependencies [735ead7]
- Updated dependencies [16a8648]
- Updated dependencies [6f92295]
  - @mastra/deployer@0.3.0
  - @mastra/core@0.9.0

## 0.5.0-alpha.9

### Patch Changes

- c489535: update --llm options for init command to list all providers
- c821402: Fix table layout issue in the Agent Network section of the Playground.
- 9c26508: Fixed an issue where "mastra dev" wouldn't always print out localhost:4111 logs due to new NODE_ENV fixes
- 16a8648: Disable swaggerUI, playground for production builds, mastra instance server build config to enable swaggerUI, apiReqLogs, openAPI documentation for prod builds
- bdbde72: Sync DS components with Cloud
- Updated dependencies [b9122b0]
- Updated dependencies [000a6d4]
- Updated dependencies [ed2f549]
- Updated dependencies [c0f22b4]
- Updated dependencies [0a033fa]
- Updated dependencies [2538066]
- Updated dependencies [9c26508]
- Updated dependencies [0f4eae3]
- Updated dependencies [16a8648]
  - @mastra/deployer@0.3.0-alpha.9
  - @mastra/core@0.9.0-alpha.8

## 0.5.0-alpha.8

### Patch Changes

- Updated dependencies [71d9444]
  - @mastra/core@0.9.0-alpha.7
  - @mastra/deployer@0.3.0-alpha.8

## 0.5.0-alpha.7

### Patch Changes

- 735ead7: Add support for process.env.development
- Updated dependencies [157c741]
- Updated dependencies [63fe16a]
- Updated dependencies [735ead7]
  - @mastra/core@0.9.0-alpha.6
  - @mastra/deployer@0.3.0-alpha.7

## 0.5.0-alpha.6

### Patch Changes

- Updated dependencies [08bb78e]
- Updated dependencies [3f9d151]
  - @mastra/core@0.9.0-alpha.5
  - @mastra/deployer@0.3.0-alpha.6

## 0.5.0-alpha.5

### Patch Changes

- 7e92011: Include tools with deployment builds
- Updated dependencies [7e92011]
  - @mastra/deployer@0.3.0-alpha.5
  - @mastra/core@0.9.0-alpha.4

## 0.5.0-alpha.4

### Minor Changes

- fe3ae4d: Remove \_\_ functions in storage and move to storage proxy to make sure init is called

### Patch Changes

- Updated dependencies [fe3ae4d]
  - @mastra/deployer@0.3.0-alpha.4
  - @mastra/core@0.9.0-alpha.3

## 0.4.10-alpha.3

### Patch Changes

- Updated dependencies [9ee4293]
  - @mastra/core@0.8.4-alpha.2
  - @mastra/deployer@0.2.10-alpha.3

## 0.4.10-alpha.2

### Patch Changes

- 7184dc5: Add support to pass project path directly to create-mastra and improve tag handling
- Updated dependencies [3527610]
  - @mastra/deployer@0.2.10-alpha.2

## 0.4.10-alpha.1

### Patch Changes

- Updated dependencies [8a8a73b]
- Updated dependencies [6f92295]
  - @mastra/core@0.8.4-alpha.1
  - @mastra/deployer@0.2.10-alpha.1

## 0.4.10-alpha.0

### Patch Changes

- Updated dependencies [03f3cd0]
  - @mastra/core@0.8.4-alpha.0
  - @mastra/deployer@0.2.10-alpha.0

## 0.4.9

### Patch Changes

- d72318f: Refactored the evals table to use the DS tables
- 1ebbfbf: Ability to toggle stream vs generate in playground
- a2318cd: Revamp mastra deply dx, Make mastra build command output deployment ready build
- ea0725e: make sure to put the geoip argument in the right spot (client init) and not at the properties level
- 37bb612: Add Elastic-2.0 licensing for packages
- c8fe5f0: change the header of all pages with the one from the DS
- Updated dependencies [d72318f]
- Updated dependencies [0bcc862]
- Updated dependencies [10a8caf]
- Updated dependencies [359b089]
- Updated dependencies [9f6f6dd]
- Updated dependencies [32e7b71]
- Updated dependencies [37bb612]
- Updated dependencies [1ebbfbf]
- Updated dependencies [67aff42]
- Updated dependencies [7f1b291]
  - @mastra/core@0.8.3
  - @mastra/deployer@0.2.9

## 0.4.9-alpha.7

### Patch Changes

- d72318f: Refactored the evals table to use the DS tables
- Updated dependencies [d72318f]
  - @mastra/core@0.8.3-alpha.5
  - @mastra/deployer@0.2.9-alpha.7

## 0.4.9-alpha.6

### Patch Changes

- Updated dependencies [67aff42]
  - @mastra/deployer@0.2.9-alpha.6

## 0.4.9-alpha.5

### Patch Changes

- Updated dependencies [9f6f6dd]
  - @mastra/deployer@0.2.9-alpha.5

## 0.4.9-alpha.4

### Patch Changes

- 1ebbfbf: Ability to toggle stream vs generate in playground
- ea0725e: make sure to put the geoip argument in the right spot (client init) and not at the properties level
- Updated dependencies [1ebbfbf]
- Updated dependencies [7f1b291]
  - @mastra/deployer@0.2.9-alpha.4
  - @mastra/core@0.8.3-alpha.4

## 0.4.9-alpha.3

### Patch Changes

- Updated dependencies [10a8caf]
  - @mastra/core@0.8.3-alpha.3
  - @mastra/deployer@0.2.9-alpha.3

## 0.4.9-alpha.2

### Patch Changes

- Updated dependencies [0bcc862]
  - @mastra/core@0.8.3-alpha.2
  - @mastra/deployer@0.2.9-alpha.2

## 0.4.9-alpha.1

### Patch Changes

- a2318cd: Revamp mastra deply dx, Make mastra build command output deployment ready build
- 37bb612: Add Elastic-2.0 licensing for packages
- c8fe5f0: change the header of all pages with the one from the DS
- Updated dependencies [32e7b71]
- Updated dependencies [37bb612]
  - @mastra/deployer@0.2.9-alpha.1
  - @mastra/core@0.8.3-alpha.1

## 0.4.9-alpha.0

### Patch Changes

- Updated dependencies [359b089]
  - @mastra/core@0.8.3-alpha.0
  - @mastra/deployer@0.2.9-alpha.0

## 0.4.8

### Patch Changes

- d3c372c: Show status UI of steps on playground workflow when workflow has no triggerSchema
  Show number of steps on workflows table
- df5989d: Correct playground model setting maxSteps reset value
- Updated dependencies [a06aadc]
- Updated dependencies [ae6c5ce]
- Updated dependencies [94cd5c1]
  - @mastra/core@0.8.2
  - @mastra/deployer@0.2.8

## 0.4.8-alpha.1

### Patch Changes

- df5989d: Correct playground model setting maxSteps reset value
- Updated dependencies [94cd5c1]
  - @mastra/deployer@0.2.8-alpha.1

## 0.4.8-alpha.0

### Patch Changes

- d3c372c: Show status UI of steps on playground workflow when workflow has no triggerSchema
  Show number of steps on workflows table
- Updated dependencies [a06aadc]
- Updated dependencies [ae6c5ce]
  - @mastra/core@0.8.2-alpha.0
  - @mastra/deployer@0.2.8-alpha.0

## 0.4.7

### Patch Changes

- 99e2998: Set default max steps to 5
- 8fdb414: Custom mastra server cors config
- Updated dependencies [99e2998]
- Updated dependencies [8fdb414]
  - @mastra/core@0.8.1
  - @mastra/deployer@0.2.7

## 0.4.7-alpha.0

### Patch Changes

- 99e2998: Set default max steps to 5
- 8fdb414: Custom mastra server cors config
- Updated dependencies [99e2998]
- Updated dependencies [8fdb414]
  - @mastra/core@0.8.1-alpha.0
  - @mastra/deployer@0.2.7-alpha.0

## 0.4.6

### Patch Changes

- 87b96d7: set playground agent maxSteps default to 3

## 0.4.6-alpha.0

### Patch Changes

- 87b96d7: set playground agent maxSteps default to 3

## 0.4.5

### Patch Changes

- a4a1151: Fix playground freezing when buffer is passed between steps
- 9f529a4: enable geoip in system properties for analytics
- 9d13790: update playground-ui dynamic form, cleanups
- 13ade6a: update favicon shape
- b08fc42: Fix workflow in getting started
- 055c4ea: Fix traces page showing e.reduce error
- 124ce08: Ability to set maxTokens, temperature, and other common features in playground
- c0f6c98: fix flag for disabling geoip
- 789bef3: Make runId optional for workflow startAsync api
- a3f0e90: Update storage initialization to ensure tables are present
- 40dca45: Fix expanding workflow sidebar not expanding the output section
- 6330967: Enable route timeout using server options
- b311bb7: fix cli build command to use correct Mastra directory
- 8393832: Handle nested workflow view on workflow graph
- 6330967: Add support for configuration of server port using Mastra instance
- 40720d3: Add support for webcontainers like stackblitz
- 23999d4: Add Design System tokens and components into playground ui
- 706e6aa: Remove unused dependencies
- 8076ecf: Unify workflow watch/start response
- 9e7d46a: Fix scroll issue on playground tools page
- d16ed18: Make playground-ui dynamic forms better
- Updated dependencies [56c31b7]
- Updated dependencies [619c39d]
- Updated dependencies [2135c81]
- Updated dependencies [5ae0180]
- Updated dependencies [05d58cc]
- Updated dependencies [fe56be0]
- Updated dependencies [93875ed]
- Updated dependencies [107bcfe]
- Updated dependencies [9bfa12b]
- Updated dependencies [515ebfb]
- Updated dependencies [5b4e19f]
- Updated dependencies [4c98129]
- Updated dependencies [4c65a57]
- Updated dependencies [dbbbf80]
- Updated dependencies [a0967a0]
- Updated dependencies [84fe241]
- Updated dependencies [fca3b21]
- Updated dependencies [88fa727]
- Updated dependencies [dfb0601]
- Updated dependencies [f37f535]
- Updated dependencies [789bef3]
- Updated dependencies [a3f0e90]
- Updated dependencies [4d67826]
- Updated dependencies [6330967]
- Updated dependencies [8393832]
- Updated dependencies [6330967]
- Updated dependencies [84fe241]
- Updated dependencies [99d43b9]
- Updated dependencies [32ba03c]
- Updated dependencies [d7e08e8]
- Updated dependencies [3c6ae54]
- Updated dependencies [febc8a6]
- Updated dependencies [0deb356]
- Updated dependencies [7599d77]
- Updated dependencies [0118361]
- Updated dependencies [619c39d]
- Updated dependencies [cafae83]
- Updated dependencies [8076ecf]
- Updated dependencies [8df4a77]
- Updated dependencies [304397c]
  - @mastra/core@0.8.0
  - @mastra/deployer@0.2.6

## 0.4.5-alpha.11

### Patch Changes

- a4a1151: Fix playground freezing when buffer is passed between steps
- 13ade6a: update favicon shape
- 124ce08: Ability to set maxTokens, temperature, and other common features in playground
- c0f6c98: fix flag for disabling geoip
- 23999d4: Add Design System tokens and components into playground ui
- 9e7d46a: Fix scroll issue on playground tools page

## 0.4.5-alpha.10

### Patch Changes

- b08fc42: Fix workflow in getting started
- 055c4ea: Fix traces page showing e.reduce error
- Updated dependencies [2135c81]
- Updated dependencies [8df4a77]
  - @mastra/deployer@0.2.6-alpha.10
  - @mastra/core@0.8.0-alpha.8

## 0.4.5-alpha.9

### Patch Changes

- 40720d3: Add support for webcontainers like stackblitz
- Updated dependencies [3c6ae54]
- Updated dependencies [febc8a6]
  - @mastra/deployer@0.2.6-alpha.9
  - @mastra/core@0.8.0-alpha.7

## 0.4.5-alpha.8

### Patch Changes

- 9d13790: update playground-ui dynamic form, cleanups
- a3f0e90: Update storage initialization to ensure tables are present
- 40dca45: Fix expanding workflow sidebar not expanding the output section
- b311bb7: fix cli build command to use correct Mastra directory
- d16ed18: Make playground-ui dynamic forms better
- Updated dependencies [4c65a57]
- Updated dependencies [a3f0e90]
  - @mastra/deployer@0.2.6-alpha.8
  - @mastra/core@0.8.0-alpha.6

## 0.4.5-alpha.7

### Patch Changes

- 9f529a4: enable geoip in system properties for analytics
- Updated dependencies [93875ed]
  - @mastra/core@0.8.0-alpha.5
  - @mastra/deployer@0.2.6-alpha.7

## 0.4.5-alpha.6

### Patch Changes

- Updated dependencies [d7e08e8]
  - @mastra/core@0.8.0-alpha.4
  - @mastra/deployer@0.2.6-alpha.6

## 0.4.5-alpha.5

### Patch Changes

- Updated dependencies [32ba03c]
  - @mastra/deployer@0.2.6-alpha.5

## 0.4.5-alpha.4

### Patch Changes

- 789bef3: Make runId optional for workflow startAsync api
- 6330967: Enable route timeout using server options
- 8393832: Handle nested workflow view on workflow graph
- 6330967: Add support for configuration of server port using Mastra instance
- Updated dependencies [5ae0180]
- Updated dependencies [9bfa12b]
- Updated dependencies [515ebfb]
- Updated dependencies [88fa727]
- Updated dependencies [dfb0601]
- Updated dependencies [f37f535]
- Updated dependencies [789bef3]
- Updated dependencies [4d67826]
- Updated dependencies [6330967]
- Updated dependencies [8393832]
- Updated dependencies [6330967]
  - @mastra/core@0.8.0-alpha.3
  - @mastra/deployer@0.2.6-alpha.4

## 0.4.5-alpha.3

### Patch Changes

- Updated dependencies [0deb356]
  - @mastra/deployer@0.2.6-alpha.3

## 0.4.5-alpha.2

### Patch Changes

- 706e6aa: Remove unused dependencies
- Updated dependencies [56c31b7]
- Updated dependencies [4c98129]
- Updated dependencies [dbbbf80]
- Updated dependencies [84fe241]
- Updated dependencies [84fe241]
- Updated dependencies [99d43b9]
  - @mastra/core@0.8.0-alpha.2
  - @mastra/deployer@0.2.6-alpha.2

## 0.4.5-alpha.1

### Patch Changes

- Updated dependencies [619c39d]
- Updated dependencies [fe56be0]
- Updated dependencies [a0967a0]
- Updated dependencies [fca3b21]
- Updated dependencies [0118361]
- Updated dependencies [619c39d]
  - @mastra/core@0.8.0-alpha.1
  - @mastra/deployer@0.2.6-alpha.1

## 0.4.5-alpha.0

### Patch Changes

- 8076ecf: Unify workflow watch/start response
- Updated dependencies [05d58cc]
- Updated dependencies [107bcfe]
- Updated dependencies [5b4e19f]
- Updated dependencies [7599d77]
- Updated dependencies [cafae83]
- Updated dependencies [8076ecf]
- Updated dependencies [304397c]
  - @mastra/deployer@0.2.6-alpha.0
  - @mastra/core@0.7.1-alpha.0

## 0.4.4

### Patch Changes

- 6d5d9c6: Show tool calls in playground chat
- 2447900: Show No input for steps without input on traces UI
- c30787b: Stop automatically scrolling to bottom in agent chat if user has scrolled up
- e05e7cc: Add origin to cli tracking
- 214e7ce: Only mark required fields as required on the playground
- 3811029: Add identifying header
- 0b496ff: Load env vars on mastra deploy
- 2134786: Fix traces navigation not working in playground
- Updated dependencies [cdc0498]
- Updated dependencies [b4fbc59]
- Updated dependencies [a838fde]
- Updated dependencies [a8bd4cf]
- Updated dependencies [7a3eeb0]
- Updated dependencies [0b54522]
- Updated dependencies [b3b34f5]
- Updated dependencies [1af25d5]
- Updated dependencies [a4686e8]
- Updated dependencies [6530ad1]
- Updated dependencies [0b496ff]
- Updated dependencies [27439ad]
  - @mastra/deployer@0.2.5
  - @mastra/core@0.7.0

## 0.4.4-alpha.4

### Patch Changes

- 6d5d9c6: Show tool calls in playground chat

## 0.4.4-alpha.3

### Patch Changes

- 2134786: Fix traces navigation not working in playground
- Updated dependencies [b3b34f5]
- Updated dependencies [a4686e8]
  - @mastra/core@0.7.0-alpha.3
  - @mastra/deployer@0.2.5-alpha.3

## 0.4.4-alpha.2

### Patch Changes

- Updated dependencies [a838fde]
- Updated dependencies [a8bd4cf]
- Updated dependencies [7a3eeb0]
- Updated dependencies [6530ad1]
  - @mastra/core@0.7.0-alpha.2
  - @mastra/deployer@0.2.5-alpha.2

## 0.4.4-alpha.1

### Patch Changes

- 2447900: Show No input for steps without input on traces UI
- c30787b: Stop automatically scrolling to bottom in agent chat if user has scrolled up
- 214e7ce: Only mark required fields as required on the playground
- 0b496ff: Load env vars on mastra deploy
- Updated dependencies [cdc0498]
- Updated dependencies [0b54522]
- Updated dependencies [1af25d5]
- Updated dependencies [0b496ff]
- Updated dependencies [27439ad]
  - @mastra/deployer@0.2.5-alpha.1
  - @mastra/core@0.7.0-alpha.1

## 0.4.4-alpha.0

### Patch Changes

- e05e7cc: Add origin to cli tracking
- 3811029: Add identifying header
- Updated dependencies [b4fbc59]
  - @mastra/core@0.6.5-alpha.0
  - @mastra/deployer@0.2.5-alpha.0

## 0.4.3

### Patch Changes

- 2348e30: When running pnpm create mastra and selecting to install MCP docs server for Windsurf, the prompt placement was confusing as there was an additional confirm step during initialization later. Now the prompts all happen at the same time. Also added a check so we don't re-install global Windsurf if it's already installed
- 6794797: Check for eval values before inserting into storage
- 933ea4d: Fix messages in thread not showing latest when switching between threads
- 9cba774: Fix new thread title not reflecting until refresh or new message is sent
- 77e4c35: Pop a dialog showing the functional condition when a functional condition is clicked on workflow graph
- 248cb07: Allow ai-sdk Message type for messages in agent generate and stream
  Fix sidebar horizontal overflow in playground
- Updated dependencies [e764fd1]
- Updated dependencies [6794797]
- Updated dependencies [709aa2c]
- Updated dependencies [fb68a80]
- Updated dependencies [e764fd1]
- Updated dependencies [05ef3e0]
- Updated dependencies [95c5745]
- Updated dependencies [b56a681]
- Updated dependencies [85a2461]
- Updated dependencies [248cb07]
  - @mastra/deployer@0.2.4
  - @mastra/core@0.6.4

## 0.4.3-alpha.2

### Patch Changes

- 6794797: Check for eval values before inserting into storage
- 77e4c35: Pop a dialog showing the functional condition when a functional condition is clicked on workflow graph
- Updated dependencies [6794797]
- Updated dependencies [709aa2c]
- Updated dependencies [85a2461]
  - @mastra/core@0.6.4-alpha.1
  - @mastra/deployer@0.2.4-alpha.1

## 0.4.3-alpha.1

### Patch Changes

- 2348e30: When running pnpm create mastra and selecting to install MCP docs server for Windsurf, the prompt placement was confusing as there was an additional confirm step during initialization later. Now the prompts all happen at the same time. Also added a check so we don't re-install global Windsurf if it's already installed

## 0.4.3-alpha.0

### Patch Changes

- 933ea4d: Fix messages in thread not showing latest when switching between threads
- 9cba774: Fix new thread title not reflecting until refresh or new message is sent
- 248cb07: Allow ai-sdk Message type for messages in agent generate and stream
  Fix sidebar horizontal overflow in playground
- Updated dependencies [e764fd1]
- Updated dependencies [fb68a80]
- Updated dependencies [e764fd1]
- Updated dependencies [05ef3e0]
- Updated dependencies [95c5745]
- Updated dependencies [b56a681]
- Updated dependencies [248cb07]
  - @mastra/deployer@0.2.4-alpha.0
  - @mastra/core@0.6.4-alpha.0

## 0.4.2

### Patch Changes

- 404640e: AgentNetwork changeset
- Updated dependencies [404640e]
- Updated dependencies [3bce733]
  - @mastra/deployer@0.2.3
  - @mastra/core@0.6.3

## 0.4.2-alpha.1

### Patch Changes

- Updated dependencies [3bce733]
  - @mastra/core@0.6.3-alpha.1
  - @mastra/deployer@0.2.3-alpha.1

## 0.4.2-alpha.0

### Patch Changes

- 404640e: AgentNetwork changeset
- Updated dependencies [404640e]
  - @mastra/deployer@0.2.3-alpha.0
  - @mastra/core@0.6.3-alpha.0

## 0.4.1

### Patch Changes

- aede1ea: Add non english support to weather example
- 2f6a8b6: Update port handling in dev command to ensure CLI port takes precedence over environment variables and add warning when overriding PORT environment variable.
- 010fc45: Fix storage init stuck
- Updated dependencies [4e6732b]
- Updated dependencies [beaf1c2]
- Updated dependencies [3084e13]
  - @mastra/deployer@0.2.2
  - @mastra/core@0.6.2

## 0.4.1-alpha.2

### Patch Changes

- 010fc45: Fix storage init stuck

## 0.4.1-alpha.1

### Patch Changes

- 2f6a8b6: Update port handling in dev command to ensure CLI port takes precedence over environment variables and add warning when overriding PORT environment variable.
- Updated dependencies [beaf1c2]
- Updated dependencies [3084e13]
  - @mastra/core@0.6.2-alpha.0
  - @mastra/deployer@0.2.2-alpha.1

## 0.4.1-alpha.0

### Patch Changes

- aede1ea: Add non english support to weather example
- Updated dependencies [4e6732b]
  - @mastra/deployer@0.2.2-alpha.0

## 0.4.0

### Minor Changes

- f9b6ab5: add Cerebras as a llm provider to create-mastra@latest

### Patch Changes

- 5052613: Added a new `mastra create --project-name <string>` flag so coder agents can create new Mastra projects with a one line command.
- 1291e89: Add resizable-panel to playground-ui and use in agent and workflow sidebars
- 1405e46: update the Groq model the create-mastra@latest sets
- da8d9bb: Enable public dir copying if it exists
- 9ba1e97: update playground ui for mastra and create-mastra
- 5baf1ec: animate new traces
- 65f2a4c: Add Mastra Docs MCP to the pnpm create mastra TUI with the option to install in Cursor or Windsurf
- 9116d70: Handle the different workflow methods in workflow graph
- 0709d99: add prop for dynamic empty text
- Updated dependencies [cc7f392]
- Updated dependencies [fc2f89c]
- Updated dependencies [dfbb131]
- Updated dependencies [f4854ee]
- Updated dependencies [afaf73f]
- Updated dependencies [0850b4c]
- Updated dependencies [7bcfaee]
- Updated dependencies [da8d9bb]
- Updated dependencies [44631b1]
- Updated dependencies [9116d70]
- Updated dependencies [6e559a0]
- Updated dependencies [5f43505]
- Updated dependencies [61ad5a4]
  - @mastra/deployer@0.2.1
  - @mastra/core@0.6.1

## 0.4.0-alpha.2

### Patch Changes

- da8d9bb: Enable public dir copying if it exists
- 5baf1ec: animate new traces
- 65f2a4c: Add Mastra Docs MCP to the pnpm create mastra TUI with the option to install in Cursor or Windsurf
- 9116d70: Handle the different workflow methods in workflow graph
- 0709d99: add prop for dynamic empty text
- Updated dependencies [cc7f392]
- Updated dependencies [fc2f89c]
- Updated dependencies [dfbb131]
- Updated dependencies [0850b4c]
- Updated dependencies [da8d9bb]
- Updated dependencies [9116d70]
  - @mastra/deployer@0.2.1-alpha.2
  - @mastra/core@0.6.1-alpha.2

## 0.4.0-alpha.1

### Minor Changes

- f9b6ab5: add Cerebras as a llm provider to create-mastra@latest

### Patch Changes

- 5052613: Added a new `mastra create --project-name <string>` flag so coder agents can create new Mastra projects with a one line command.
- 1291e89: Add resizable-panel to playground-ui and use in agent and workflow sidebars
- 9ba1e97: update playground ui for mastra and create-mastra
- Updated dependencies [f4854ee]
- Updated dependencies [afaf73f]
- Updated dependencies [44631b1]
- Updated dependencies [6e559a0]
- Updated dependencies [5f43505]
- Updated dependencies [61ad5a4]
  - @mastra/core@0.6.1-alpha.1
  - @mastra/deployer@0.2.1-alpha.1

## 0.3.2-alpha.0

### Patch Changes

- 1405e46: update the Groq model the create-mastra@latest sets
- Updated dependencies [7bcfaee]
  - @mastra/core@0.6.1-alpha.0
  - @mastra/deployer@0.2.1-alpha.0

## 0.3.1

### Patch Changes

- c49f798: remove hardcoded localhost url in playground
- 63cebd4: Fixed a bug with the new tool discovery feature where a missing tools/index.ts would crash the process
- d3d6fae: Deprecate mastra dev --env flag
- Updated dependencies [16b98d9]
- Updated dependencies [1c8cda4]
- Updated dependencies [95b4144]
- Updated dependencies [3729dbd]
- Updated dependencies [c2144f4]
  - @mastra/core@0.6.0
  - @mastra/deployer@0.2.0

## 0.3.1-alpha.1

### Patch Changes

- c49f798: remove hardcoded localhost url in playground
- 63cebd4: Fixed a bug with the new tool discovery feature where a missing tools/index.ts would crash the process
- Updated dependencies [16b98d9]
- Updated dependencies [1c8cda4]
- Updated dependencies [95b4144]
- Updated dependencies [c2144f4]
  - @mastra/core@0.6.0-alpha.1
  - @mastra/deployer@0.2.0-alpha.1

## 0.3.1-alpha.0

### Patch Changes

- d3d6fae: Deprecate mastra dev --env flag
- Updated dependencies [3729dbd]
  - @mastra/core@0.5.1-alpha.0
  - @mastra/deployer@0.1.9-alpha.0

## 0.3.0

### Minor Changes

- dd7a09a: Added new MCPConfiguration class for managing multiple MCP server tools/toolsets. Fixed a bug where MCPClient env would overwrite PATH env var. Fixed a bug where MCP servers would be killed non-gracefully leading to printing huge errors on every code save when running mastra dev

### Patch Changes

- 5fae49e: Configurable timeout on npm create mastra
- 91d2e30: Fix init in non npm project
- 960690d: Improve client-js workflow watch dx
- af7466e: fixes in playground ui
- dbd9f2d: Handle different condition types on workflow graph
- 07a7470: Move WorkflowTrigger to playground-ui package and use in dev playground
- 52e0418: Split up action types between tools and workflows
- a80bdaf: persist data in run tab in dev
- e5149bb: Fix playground-ui agent-evals tab-content
- 8deb34c: Better workflow watch api + watch workflow by runId
- 36d970e: Make tools discovery work in mastra dev
- 144b3d5: Update traces table UI, agent Chat UI
  Fix get workflows breaking
- 62565c1: --no-timeout npm create mastra flag
- 9035565: Update tools dev playground inputs for different fieldtypes
- fd4a1d7: Update cjs bundling to make sure files are split
- Updated dependencies [a910463]
- Updated dependencies [59df7b6]
- Updated dependencies [22643eb]
- Updated dependencies [6feb23f]
- Updated dependencies [f2d6727]
- Updated dependencies [7a7a547]
- Updated dependencies [29f3a82]
- Updated dependencies [3d0e290]
- Updated dependencies [e9fbac5]
- Updated dependencies [301e4ee]
- Updated dependencies [ee667a2]
- Updated dependencies [dfbe4e9]
- Updated dependencies [dab255b]
- Updated dependencies [1e8bcbc]
- Updated dependencies [f6678e4]
- Updated dependencies [9e81f35]
- Updated dependencies [c93798b]
- Updated dependencies [a85ab24]
- Updated dependencies [dbd9f2d]
- Updated dependencies [59df7b6]
- Updated dependencies [caefaa2]
- Updated dependencies [c151ae6]
- Updated dependencies [52e0418]
- Updated dependencies [d79aedf]
- Updated dependencies [8deb34c]
- Updated dependencies [c2dde91]
- Updated dependencies [5d41958]
- Updated dependencies [144b3d5]
- Updated dependencies [03236ec]
- Updated dependencies [3764e71]
- Updated dependencies [df982db]
- Updated dependencies [a171b37]
- Updated dependencies [506f1d5]
- Updated dependencies [02ffb7b]
- Updated dependencies [731dd8a]
- Updated dependencies [0461849]
- Updated dependencies [2259379]
- Updated dependencies [aeb5e36]
- Updated dependencies [f2301de]
- Updated dependencies [358f069]
- Updated dependencies [fd4a1d7]
- Updated dependencies [960690d]
- Updated dependencies [c139344]
  - @mastra/core@0.5.0
  - @mastra/deployer@0.1.8

## 0.3.0-alpha.12

### Patch Changes

- 07a7470: Move WorkflowTrigger to playground-ui package and use in dev playground
- Updated dependencies [a85ab24]
  - @mastra/core@0.5.0-alpha.12
  - @mastra/deployer@0.1.8-alpha.12

## 0.3.0-alpha.11

### Patch Changes

- dbd9f2d: Handle different condition types on workflow graph
- 8deb34c: Better workflow watch api + watch workflow by runId
- 36d970e: Make tools discovery work in mastra dev
- fd4a1d7: Update cjs bundling to make sure files are split
- Updated dependencies [7a7a547]
- Updated dependencies [c93798b]
- Updated dependencies [dbd9f2d]
- Updated dependencies [8deb34c]
- Updated dependencies [5d41958]
- Updated dependencies [a171b37]
- Updated dependencies [fd4a1d7]
  - @mastra/deployer@0.1.8-alpha.11
  - @mastra/core@0.5.0-alpha.11

## 0.3.0-alpha.10

### Minor Changes

- dd7a09a: Added new MCPConfiguration class for managing multiple MCP server tools/toolsets. Fixed a bug where MCPClient env would overwrite PATH env var. Fixed a bug where MCP servers would be killed non-gracefully leading to printing huge errors on every code save when running mastra dev

### Patch Changes

- Updated dependencies [a910463]
  - @mastra/core@0.5.0-alpha.10
  - @mastra/deployer@0.1.8-alpha.10

## 0.2.9-alpha.9

### Patch Changes

- Updated dependencies [e9fbac5]
- Updated dependencies [1e8bcbc]
- Updated dependencies [aeb5e36]
- Updated dependencies [f2301de]
  - @mastra/deployer@0.1.8-alpha.9
  - @mastra/core@0.5.0-alpha.9

## 0.2.9-alpha.8

### Patch Changes

- Updated dependencies [506f1d5]
  - @mastra/core@0.5.0-alpha.8
  - @mastra/deployer@0.1.8-alpha.8

## 0.2.9-alpha.7

### Patch Changes

- Updated dependencies [ee667a2]
  - @mastra/core@0.5.0-alpha.7
  - @mastra/deployer@0.1.8-alpha.7

## 0.2.9-alpha.6

### Patch Changes

- Updated dependencies [f6678e4]
  - @mastra/core@0.5.0-alpha.6
  - @mastra/deployer@0.1.8-alpha.6

## 0.2.9-alpha.5

### Patch Changes

- 91d2e30: Fix init in non npm project
- af7466e: fixes in playground ui
- 52e0418: Split up action types between tools and workflows
- a80bdaf: persist data in run tab in dev
- 9035565: Update tools dev playground inputs for different fieldtypes
- Updated dependencies [22643eb]
- Updated dependencies [6feb23f]
- Updated dependencies [f2d6727]
- Updated dependencies [301e4ee]
- Updated dependencies [dfbe4e9]
- Updated dependencies [9e81f35]
- Updated dependencies [caefaa2]
- Updated dependencies [c151ae6]
- Updated dependencies [52e0418]
- Updated dependencies [03236ec]
- Updated dependencies [3764e71]
- Updated dependencies [df982db]
- Updated dependencies [0461849]
- Updated dependencies [2259379]
- Updated dependencies [358f069]
  - @mastra/core@0.5.0-alpha.5
  - @mastra/deployer@0.1.8-alpha.5

## 0.2.9-alpha.4

### Patch Changes

- 144b3d5: Update traces table UI, agent Chat UI
  Fix get workflows breaking
- Updated dependencies [d79aedf]
- Updated dependencies [144b3d5]
  - @mastra/core@0.5.0-alpha.4
  - @mastra/deployer@0.1.8-alpha.4

## 0.2.9-alpha.3

### Patch Changes

- Updated dependencies [3d0e290]
  - @mastra/core@0.5.0-alpha.3
  - @mastra/deployer@0.1.8-alpha.3

## 0.2.9-alpha.2

### Patch Changes

- Updated dependencies [02ffb7b]
  - @mastra/core@0.5.0-alpha.2
  - @mastra/deployer@0.1.8-alpha.2

## 0.2.9-alpha.1

### Patch Changes

- e5149bb: Fix playground-ui agent-evals tab-content
- Updated dependencies [dab255b]
  - @mastra/core@0.5.0-alpha.1
  - @mastra/deployer@0.1.8-alpha.1

## 0.2.9-alpha.0

### Patch Changes

- 5fae49e: Configurable timeout on npm create mastra
- 960690d: Improve client-js workflow watch dx
- 62565c1: --no-timeout npm create mastra flag
- Updated dependencies [59df7b6]
- Updated dependencies [29f3a82]
- Updated dependencies [59df7b6]
- Updated dependencies [c2dde91]
- Updated dependencies [731dd8a]
- Updated dependencies [960690d]
- Updated dependencies [c139344]
  - @mastra/core@0.5.0-alpha.0
  - @mastra/deployer@0.1.8-alpha.0

## 0.2.8

### Patch Changes

- Updated dependencies [1da20e7]
- Updated dependencies [30a4c29]
- Updated dependencies [e1e2705]
  - @mastra/core@0.4.4
  - @mastra/deployer@0.1.7

## 0.2.8-alpha.0

### Patch Changes

- Updated dependencies [1da20e7]
- Updated dependencies [30a4c29]
- Updated dependencies [e1e2705]
  - @mastra/core@0.4.4-alpha.0
  - @mastra/deployer@0.1.7-alpha.0

## 0.2.7

### Patch Changes

- 8d4e0d0: build playground-ui with cli
- 7a64aff: playground-ui lib package to enhance dev/cloud ui unification
- b24970d: Added Mastra svg favicon to playground
- e5a0c67: Fix polling on dev traces
- 7a0866e: Use non-crypto uuid function in playground, to allow for local urls like local.lan:4111 during development
- bb4f447: Add support for commonjs
- Updated dependencies [0d185b1]
- Updated dependencies [ed55f1d]
- Updated dependencies [06aa827]
- Updated dependencies [80cdd76]
- Updated dependencies [0fd78ac]
- Updated dependencies [2512a93]
- Updated dependencies [e62de74]
- Updated dependencies [0d25b75]
- Updated dependencies [fd14a3f]
- Updated dependencies [8d13b14]
- Updated dependencies [3f369a2]
- Updated dependencies [3ee4831]
- Updated dependencies [4d4e1e1]
- Updated dependencies [bb4f447]
- Updated dependencies [108793c]
- Updated dependencies [5f28f44]
- Updated dependencies [dabecf4]
  - @mastra/core@0.4.3
  - @mastra/deployer@0.1.6

## 0.2.7-alpha.4

### Patch Changes

- Updated dependencies [dabecf4]
  - @mastra/core@0.4.3-alpha.4
  - @mastra/deployer@0.1.6-alpha.4

## 0.2.7-alpha.3

### Patch Changes

- 8d4e0d0: build playground-ui with cli
- 7a64aff: playground-ui lib package to enhance dev/cloud ui unification
- bb4f447: Add support for commonjs
- Updated dependencies [0fd78ac]
- Updated dependencies [0d25b75]
- Updated dependencies [fd14a3f]
- Updated dependencies [3f369a2]
- Updated dependencies [4d4e1e1]
- Updated dependencies [bb4f447]
  - @mastra/deployer@0.1.6-alpha.3
  - @mastra/core@0.4.3-alpha.3

## 0.2.7-alpha.2

### Patch Changes

- Updated dependencies [2512a93]
- Updated dependencies [e62de74]
  - @mastra/core@0.4.3-alpha.2
  - @mastra/deployer@0.1.6-alpha.2

## 0.2.7-alpha.1

### Patch Changes

- e5a0c67: Fix polling on dev traces
- Updated dependencies [0d185b1]
- Updated dependencies [ed55f1d]
- Updated dependencies [80cdd76]
- Updated dependencies [8d13b14]
- Updated dependencies [3ee4831]
- Updated dependencies [108793c]
- Updated dependencies [5f28f44]
  - @mastra/core@0.4.3-alpha.1
  - @mastra/deployer@0.1.6-alpha.1

## 0.2.7-alpha.0

### Patch Changes

- b24970d: Added Mastra svg favicon to playground
- 7a0866e: Use non-crypto uuid function in playground, to allow for local urls like local.lan:4111 during development
- Updated dependencies [06aa827]
  - @mastra/core@0.4.3-alpha.0
  - @mastra/deployer@0.1.6-alpha.0

## 0.2.6

### Patch Changes

- e4ee56c: Enable \* imports in analyze bundle
- 2d68431: Fix mastra server error processing
- 99dcdb5: Inject primitives into condition function, and renames getStepPayload to getStepResult.
- 9c1057d: Fix mastra dev back slash issues
- Updated dependencies [7fceae1]
- Updated dependencies [e4ee56c]
- Updated dependencies [8d94c3e]
- Updated dependencies [2d68431]
- Updated dependencies [99dcdb5]
- Updated dependencies [6cb63e0]
- Updated dependencies [f626fbb]
- Updated dependencies [e752340]
- Updated dependencies [eb91535]
  - @mastra/core@0.4.2
  - @mastra/deployer@0.1.5

## 0.2.6-alpha.3

### Patch Changes

- 99dcdb5: Inject primitives into condition function, and renames getStepPayload to getStepResult.
- 9c1057d: Fix mastra dev back slash issues
- Updated dependencies [8d94c3e]
- Updated dependencies [99dcdb5]
- Updated dependencies [e752340]
- Updated dependencies [eb91535]
  - @mastra/core@0.4.2-alpha.2
  - @mastra/deployer@0.1.5-alpha.3

## 0.2.6-alpha.2

### Patch Changes

- Updated dependencies [6cb63e0]
  - @mastra/core@0.4.2-alpha.1
  - @mastra/deployer@0.1.5-alpha.2

## 0.2.6-alpha.1

### Patch Changes

- 2d68431: Fix mastra server error processing
- Updated dependencies [2d68431]
  - @mastra/deployer@0.1.5-alpha.1

## 0.2.6-alpha.0

### Patch Changes

- e4ee56c: Enable \* imports in analyze bundle
- Updated dependencies [7fceae1]
- Updated dependencies [e4ee56c]
- Updated dependencies [f626fbb]
  - @mastra/core@0.4.2-alpha.0
  - @mastra/deployer@0.1.5-alpha.0

## 0.2.5

### Patch Changes

- 967da43: Logger, transport fixes
- Updated dependencies [ce44b9b]
- Updated dependencies [967da43]
- Updated dependencies [b405f08]
  - @mastra/core@0.4.1
  - @mastra/deployer@0.1.4

## 0.2.4

### Patch Changes

- 13ba53a: Remove cli postinstall script
- bd98fb6: Fix yarn create mastra, use correct install commnad for deps install
- 71cedf8: Allow column resizing on tracing UI
  Fix UI issues in mastra dev agent chat page
- dd3a52b: pass createVersionTag to create mastra deps
- a931e9a: Fix resizer not showing when user has scrolled down the span details column
- Updated dependencies [5297264]
- Updated dependencies [2fc618f]
- Updated dependencies [fe0fd01]
  - @mastra/deployer@0.1.3
  - @mastra/core@0.4.0

## 0.2.4-alpha.2

### Patch Changes

- bd98fb6: Fix yarn create mastra, use correct install commnad for deps install

## 0.2.4-alpha.1

### Patch Changes

- Updated dependencies [fe0fd01]
  - @mastra/core@0.4.0-alpha.1
  - @mastra/deployer@0.1.3-alpha.1

## 0.2.4-alpha.0

### Patch Changes

- 13ba53a: Remove cli postinstall script
- 71cedf8: Allow column resizing on tracing UI
  Fix UI issues in mastra dev agent chat page
- dd3a52b: pass createVersionTag to create mastra deps
- a931e9a: Fix resizer not showing when user has scrolled down the span details column
- Updated dependencies [5297264]
- Updated dependencies [2fc618f]
  - @mastra/deployer@0.1.3-alpha.0
  - @mastra/core@0.4.0-alpha.0

## 0.2.3

### Patch Changes

- 23b2a7a: Fixed a bug when detecting package manager during mastra init where npm would run after pnpm already installed, resulting in errors
- dfe2df9: Fix mastra create workflow starter
- Updated dependencies [f205ede]
  - @mastra/core@0.3.0
  - @mastra/deployer@0.1.2

## 0.2.3-alpha.0

### Patch Changes

- 23b2a7a: Fixed a bug when detecting package manager during mastra init where npm would run after pnpm already installed, resulting in errors
- dfe2df9: Fix mastra create workflow starter

## 0.2.2

### Patch Changes

- c5a68f9: Optimize create mastra deps install
- a9e8d7c: Fix create mastra deps install
- ffbde2b: Fixed issue where "pnpm create mastra" would take so long it would time out

## 0.2.2-alpha.0

### Patch Changes

- c5a68f9: Optimize create mastra deps install
- a9e8d7c: Fix create mastra deps install
- ffbde2b: Fixed issue where "pnpm create mastra" would take so long it would time out

## 0.2.1

### Patch Changes

- 936dc26: Add mastra server endpoints for watch/resume + plug watch and resume functionality to dev playground
- 91ef439: Add eslint and ran autofix
- b0b975d: Update package installation to latest instead of alpha
- bf2e88f: Add instrumentation http to mastra
- 4526a78: Fixed "instrumentation.mjs" not found, and port 4111 in use errors when rebundling in "mastra dev"
- Updated dependencies [d59f1a8]
- Updated dependencies [936dc26]
- Updated dependencies [91ef439]
- Updated dependencies [4a25be4]
- Updated dependencies [bf2e88f]
- Updated dependencies [2f0d707]
- Updated dependencies [aac1667]
  - @mastra/core@0.2.1
  - @mastra/deployer@0.1.1

## 0.2.1-alpha.0

### Patch Changes

- 936dc26: Add mastra server endpoints for watch/resume + plug watch and resume functionality to dev playground
- 91ef439: Add eslint and ran autofix
- b0b975d: Update package installation to latest instead of alpha
- bf2e88f: Add instrumentation http to mastra
- 4526a78: Fixed "instrumentation.mjs" not found, and port 4111 in use errors when rebundling in "mastra dev"
- Updated dependencies [d59f1a8]
- Updated dependencies [936dc26]
- Updated dependencies [91ef439]
- Updated dependencies [4a25be4]
- Updated dependencies [bf2e88f]
- Updated dependencies [2f0d707]
- Updated dependencies [aac1667]
  - @mastra/core@0.2.1-alpha.0
  - @mastra/deployer@0.1.1-alpha.0

## 0.2.0

### Minor Changes

- 4d4f6b6: Update deployer
- 5916f9d: Update deps from fixed to ^
- 74b3078: Reduce verbosity in workflows API
- 8b416d9: Breaking changes

### Patch Changes

- 2ab57d6: Fix: Workflows require a trigger schema otherwise it fails to run in dev
- fd15221: cli publishing fix
- c8a8eab: fix some workflow conditions not showing on graph and dev watcher not working
- cc9172a: Clarify functionality of logs tab in dev environment
- f1cb298: rename serve command to dev
- e38b412: Fixes
- 0f08180: Update docs for mastra dev
- a828155: Add prepare script to include node_modules in published package
- 0e2b588: Update cloudflare deployment config
- ba821de: publish cli homepage
- 95e15a9: render agent chat errors
- abdd42d: polish mastra create, fix create-mastra publishing
- f187221: bring back cli post install
- 9d1796d: Fix storage and eval serialization on api
- 3af5866: publish cli post install script
- b9f7d2f: Expose memory APIs in mastra serve
- 9df6d6e: Fix serve
- e27fe69: Add dir to deployer
- 8ae2bbc: Dane publishing
- c4cd3ff: Catch npx mastra dev dependency issue
- 82a6d53: better create-mastra tsconfig, better error for mastra server agent stream
- f79a9ff: Fix example tool execution not workin in dev, add example tool to example agent, add example workflow to main Mastra export
- 7d83b92: Create default storage and move evals towards it
- cc5bd40: Fix playground agent chat losing some chat during redirect
- 813c719: Fix watcher in mastra dev, now listens to all files
- 0209290: Add env to starter gitignore file
- 5cdfb88: add getWorkflows method to core, add runId to workflow logs, update workflow starter file, add workflows page with table and workflow page with info, endpoints and logs
- 837a288: MAJOR Revamp of tools, workflows, syncs.
- 97fb0d5: Move playground dependencies out of cli
- dde845f: Fix cli stater files build
- 7344dd7: Fix tool executor ui bugs
- 989833c: Handle rendering workflows without triggerschema on dev playground
- 17608e9: Fix agent generate/stream with structured output
- b97ca96: Tracing into default storage
- ad2cd74: Deploy fix
- 033eda6: More fixes for refactor
- 7babd5c: CLI build and other
- 9066f95: CF deployer fixes
- 884793d: Fix 500 error in memory call, fix threads sidebar in playground agent chat
- 1944807: Unified logger and major step in better logs
- 0091799: Add dev and deploy mastra commands to CLI references in documentation, update build successful message in dev command
- a61be33: update readme
- 43667fa: postinstall mastra package deps
- 019d771: throw proper errors in serve
- b6f9860: watch for changes in user mastra directory and restart server in cli dev
- 1d68b0c: update dane publishing
- 255fc56: create mastra bundle correctly
- 8e62269: show cli options rather than ascii art
- de279d5: update apiKey
- 382f4dc: move telemetry init to instrumentation.mjs file in build directory
- ad38e98: Fix example code
- 689b529: fix mastra dev for windows
- edd70b5: changeset
- cefd906: cli interactive api key configuration
- 0b74006: Workflow updates
- 7892533: Updated test evals to use Mastra Storage
- 79a464e: Update cli, dane, stabilityai builds.
- 5b5de5e: Instructions playground
- 9c10484: update all packages
- 59f592a: mastra dev open api spec, mastra server templates as code
- 70dabd9: Fix broken publish
- 21fe536: add keyword tags for packages and update readmes
- 31ca9fe: fix bugs with init
- 391d5ea: Add @opentelemetry/instrumentation to pkg json of build artifcat
- ba2437d: one central cli dev playground app
- 1b321d5: Get all tools
- d68b532: Updated debug logs
- 75bf3f0: remove context bug in agent tool execution, update style for mastra dev rendered pages
- e6d8055: Added Mastra Storage to add and query live evals
- aacfff6: publish new mastra, create-mastra
- a18e96c: Array schemas for dev tool playground
- 1d88043: Fix tools bundling
- b425845: Logger and execa logs
- 85c6935: Fix messages sent not rendering when evals are on
- b135410: fix- mastra post install
- 4123324: Fix cli server build
- d6d8159: Workflow graph diagram
- 606bbbe: Adds -f option to engine commands to specify custom docker config. Updates Engine docs.
- 7db55f6: Install aisdk model provider for in create-mastra init
- c156b63: Add missing mastra deploy server deps
- 188ffa8: Fix cli create not parsing components flag
- 0bd142c: Fixes learned from docs
- 9625602: Use mastra core splitted bundles in other packages
- 72d1990: Updated evals table schema
- f6ba259: simplify generate api
- 2712098: add getAgents method to core and route to cli dev, add homepage interface to cli
- 5d2f4b0: cli shared ui
- e604ddb: Change bundling architecture
- 678ffb4: Add layout with sidebar, update dev endpoints to have /api prefix
- fa3c7cb: Fix trace name on table being too long
- 8890cac: group mastra dev playground tools
- e5e2bb4: Configure vercel deployment project name
- f2c5dfa: update endpoint path
- 002d6d8: add memory to playground agent
- 2b4d224: Publishing
- 6b518fc: Add js banner to mastra dev bundle to fix dynamic import errors
- dc90663: Fix issues in packages
- 6e18618: Generate tsconfig on mastra create
- 505d385: playground breadcrumb navigation
- de60682: Fix playground thread navigation
- 2f2f65e: Fix multipart location tool error with init example
- b80ea8d: Fix bundling of server
- 323e09e: Use 4o-mini in starter example
- 1dbbb49: update netlify and cloudflare server templates
- b748d2a: fix error when installing zod in starter
- 56f2163: add proper titles and handle empty list
- 9db58b8: Update UI to clarify memory usage in agent chat interface
- 43ac982: serve agent chat ui on mastra serve
- 42a2e69: Fix playground error parsing
- 245e3f7: dev playground rebuild/refresh on file changes
- ffa0b63: Fix scrolling issue in mastra dev tools playground UI
- 28dceab: Catch apiKey error in dev
- 3c2d317: add textObject and streamObject to serve api
- c18a0c0: Fix creation of new threads in dev playground
- d863bb3: Fixing mastra engine generate
- 38b7f66: Update deployer logic
- 32cd966: new mastra create command, publish create-mastra a way to quickly spin up mastra apps
- 2fa7f53: add more logs to workflow, only log failed workflow if all steps fail, animate workflow diagram edges
- b9c7047: Move to non deprecated table name for eval insertion
- f6da688: update agents/:agentId page in dev to show agent details and endpoints, add getTools to agent
- 9ade36e: Changed measure for evals, added endpoints, attached metrics to agent, added ui for evals in playground, and updated docs
- c16b6a1: Fix loading env files in dev
- 2b01511: Update CONSOLE logger to store logs and return logs, add logs to dev agent page
- f4ae8dd: dev playground, support multiple tool dirs
- 6cc479d: change cat example
- 04434b6: Create separate logger file
- ec3ea2f: configurable CF worker name
- 732a971: create api for sync
- 327ece7: Updates for ts versions
- b39ea1d: ability to skip wrangler cli installation
- 538a136: Added Simple Condition for workflows, updated /api/workflows/{workflowId}/execute endpoint and docs
- b5393f1: New example: Dane and many fixes to make it work
- 3296399: Bump version
- 46e9b7a: bundle mastra dev deps with publish
- 215a1c2: Fix bad cli create starter files copying
- d1e3623: Refactor CLI and improve engine commands
- 9fb59d6: changeset
- 2667e66: fix create mastra publishing
- f1e3105: Now that memory can be added to an agent, the playground needs to look up memory on the agent, not on mastra. Now the playground looks up on the agent to properly access memory
- 5fd3569: Update CLOUDFLARE and NETLIFY servers
- 4f1d1a1: Enforce types ann cleanup package.json
- ee4de15: Dane fixes
- 86c9e6b: Added posthog telemetry
- 202d404: Added instructions when generating evals
- Updated dependencies [2ab57d6]
- Updated dependencies [a1774e7]
- Updated dependencies [f537e33]
- Updated dependencies [291fe57]
- Updated dependencies [6f2c0f5]
- Updated dependencies [e4d4ede]
- Updated dependencies [0be7181]
- Updated dependencies [dd6d87f]
- Updated dependencies [9029796]
- Updated dependencies [6fa4bd2]
- Updated dependencies [f031a1f]
- Updated dependencies [8151f44]
- Updated dependencies [d7d465a]
- Updated dependencies [4d4f6b6]
- Updated dependencies [73d112c]
- Updated dependencies [592e3cf]
- Updated dependencies [9d1796d]
- Updated dependencies [e897f1c]
- Updated dependencies [4a54c82]
- Updated dependencies [e27fe69]
- Updated dependencies [3967e69]
- Updated dependencies [8ae2bbc]
- Updated dependencies [246f06c]
- Updated dependencies [ac8c61a]
- Updated dependencies [82a6d53]
- Updated dependencies [e9d1b47]
- Updated dependencies [bdaf834]
- Updated dependencies [016493a]
- Updated dependencies [bc40916]
- Updated dependencies [93a3719]
- Updated dependencies [7d83b92]
- Updated dependencies [9fb3039]
- Updated dependencies [8fa48b9]
- Updated dependencies [d5e12de]
- Updated dependencies [e1dd94a]
- Updated dependencies [07c069d]
- Updated dependencies [5cdfb88]
- Updated dependencies [837a288]
- Updated dependencies [685108a]
- Updated dependencies [c8ff2f5]
- Updated dependencies [5fdc87c]
- Updated dependencies [ae7bf94]
- Updated dependencies [8e7814f]
- Updated dependencies [66a03ec]
- Updated dependencies [5916f9d]
- Updated dependencies [7d87a15]
- Updated dependencies [b97ca96]
- Updated dependencies [ad2cd74]
- Updated dependencies [23dcb23]
- Updated dependencies [033eda6]
- Updated dependencies [7babd5c]
- Updated dependencies [a9b5ddf]
- Updated dependencies [9066f95]
- Updated dependencies [4139b43]
- Updated dependencies [8105fae]
- Updated dependencies [e097800]
- Updated dependencies [ab01c53]
- Updated dependencies [1944807]
- Updated dependencies [30322ce]
- Updated dependencies [8aec8b7]
- Updated dependencies [1874f40]
- Updated dependencies [685108a]
- Updated dependencies [f7d1131]
- Updated dependencies [79acad0]
- Updated dependencies [7a19083]
- Updated dependencies [382f4dc]
- Updated dependencies [1ebd071]
- Updated dependencies [0b74006]
- Updated dependencies [2f17a5f]
- Updated dependencies [f368477]
- Updated dependencies [7892533]
- Updated dependencies [9c10484]
- Updated dependencies [b726bf5]
- Updated dependencies [88f18d7]
- Updated dependencies [70dabd9]
- Updated dependencies [21fe536]
- Updated dependencies [1a41fbf]
- Updated dependencies [176bc42]
- Updated dependencies [391d5ea]
- Updated dependencies [401a4d9]
- Updated dependencies [2e099d2]
- Updated dependencies [0b826f6]
- Updated dependencies [8329f1a]
- Updated dependencies [d68b532]
- Updated dependencies [75bf3f0]
- Updated dependencies [e6d8055]
- Updated dependencies [e2e76de]
- Updated dependencies [a18e96c]
- Updated dependencies [ccbc581]
- Updated dependencies [5950de5]
- Updated dependencies [b425845]
- Updated dependencies [fe3dcb0]
- Updated dependencies [0696eeb]
- Updated dependencies [6780223]
- Updated dependencies [78eec7c]
- Updated dependencies [a8a459a]
- Updated dependencies [0b96376]
- Updated dependencies [0be7181]
- Updated dependencies [7b87567]
- Updated dependencies [b524c22]
- Updated dependencies [d7d465a]
- Updated dependencies [df843d3]
- Updated dependencies [cfb966f]
- Updated dependencies [4534e77]
- Updated dependencies [d6d8159]
- Updated dependencies [0bd142c]
- Updated dependencies [9625602]
- Updated dependencies [72d1990]
- Updated dependencies [f6ba259]
- Updated dependencies [2712098]
- Updated dependencies [a291824]
- Updated dependencies [eedb829]
- Updated dependencies [8ea426a]
- Updated dependencies [c5f2d50]
- Updated dependencies [5285356]
- Updated dependencies [74b3078]
- Updated dependencies [cb290ee]
- Updated dependencies [b4d7416]
- Updated dependencies [e608d8c]
- Updated dependencies [7064554]
- Updated dependencies [06b2c0a]
- Updated dependencies [002d6d8]
- Updated dependencies [e448a26]
- Updated dependencies [8b416d9]
- Updated dependencies [fd494a3]
- Updated dependencies [dc90663]
- Updated dependencies [c872875]
- Updated dependencies [3c4488b]
- Updated dependencies [72c280b]
- Updated dependencies [a7b016d]
- Updated dependencies [fd75f3c]
- Updated dependencies [7f24c29]
- Updated dependencies [2017553]
- Updated dependencies [b80ea8d]
- Updated dependencies [a10b7a3]
- Updated dependencies [42a2e69]
- Updated dependencies [cf6d825]
- Updated dependencies [963c15a]
- Updated dependencies [28dceab]
- Updated dependencies [7365b6c]
- Updated dependencies [5ee67d3]
- Updated dependencies [a5604c4]
- Updated dependencies [d38f7a6]
- Updated dependencies [38b7f66]
- Updated dependencies [2fa7f53]
- Updated dependencies [1420ae2]
- Updated dependencies [b9c7047]
- Updated dependencies [4a328af]
- Updated dependencies [f6da688]
- Updated dependencies [3700be1]
- Updated dependencies [9ade36e]
- Updated dependencies [10870bc]
- Updated dependencies [2b01511]
- Updated dependencies [a870123]
- Updated dependencies [ccf115c]
- Updated dependencies [04434b6]
- Updated dependencies [5811de6]
- Updated dependencies [9f3ab05]
- Updated dependencies [66a5392]
- Updated dependencies [4b1ce2c]
- Updated dependencies [14064f2]
- Updated dependencies [f5dfa20]
- Updated dependencies [327ece7]
- Updated dependencies [da2e8d3]
- Updated dependencies [95a4697]
- Updated dependencies [d5fccfb]
- Updated dependencies [3427b95]
- Updated dependencies [538a136]
- Updated dependencies [e66643a]
- Updated dependencies [b5393f1]
- Updated dependencies [d2cd535]
- Updated dependencies [c2dd6b5]
- Updated dependencies [67637ba]
- Updated dependencies [836f4e3]
- Updated dependencies [5ee2e78]
- Updated dependencies [cd02c56]
- Updated dependencies [01502b0]
- Updated dependencies [16e5b04]
- Updated dependencies [d9c8dd0]
- Updated dependencies [9fb59d6]
- Updated dependencies [a9345f9]
- Updated dependencies [f1e3105]
- Updated dependencies [99f1847]
- Updated dependencies [04f3171]
- Updated dependencies [8769a62]
- Updated dependencies [d5ec619]
- Updated dependencies [27275c9]
- Updated dependencies [ae7bf94]
- Updated dependencies [4f1d1a1]
- Updated dependencies [ee4de15]
- Updated dependencies [202d404]
- Updated dependencies [a221426]
  - @mastra/deployer@0.1.0
  - @mastra/core@0.2.0

## 0.2.0-alpha.171

### Patch Changes

- 391d5ea: Add @opentelemetry/instrumentation to pkg json of build artifcat
- Updated dependencies [391d5ea]
  - @mastra/deployer@0.1.0-alpha.63

## 0.2.0-alpha.170

### Patch Changes

- 382f4dc: move telemetry init to instrumentation.mjs file in build directory
- d68b532: Updated debug logs
- Updated dependencies [016493a]
- Updated dependencies [382f4dc]
- Updated dependencies [176bc42]
- Updated dependencies [d68b532]
- Updated dependencies [fe3dcb0]
- Updated dependencies [e448a26]
- Updated dependencies [fd75f3c]
- Updated dependencies [ccf115c]
- Updated dependencies [a221426]
  - @mastra/core@0.2.0-alpha.110
  - @mastra/deployer@0.1.0-alpha.62

## 0.2.0-alpha.169

### Patch Changes

- 5b5de5e: Instructions playground
- b9c7047: Move to non deprecated table name for eval insertion
- Updated dependencies [b9c7047]
  - @mastra/deployer@0.1.0-alpha.61

## 0.2.0-alpha.168

### Patch Changes

- Updated dependencies [d5fccfb]
  - @mastra/core@0.2.0-alpha.109
  - @mastra/deployer@0.1.0-alpha.60

## 0.2.0-alpha.167

### Patch Changes

- Updated dependencies [5ee67d3]
- Updated dependencies [95a4697]
  - @mastra/core@0.2.0-alpha.108
  - @mastra/deployer@0.1.0-alpha.59

## 0.2.0-alpha.166

### Patch Changes

- Updated dependencies [8fa48b9]
- Updated dependencies [66a5392]
  - @mastra/deployer@0.1.0-alpha.58
  - @mastra/core@0.2.0-alpha.107

## 0.2.0-alpha.165

### Patch Changes

- de60682: Fix playground thread navigation
- Updated dependencies [6f2c0f5]
- Updated dependencies [a8a459a]
- Updated dependencies [4a328af]
  - @mastra/core@0.2.0-alpha.106
  - @mastra/deployer@0.1.0-alpha.57

## 0.2.0-alpha.164

### Patch Changes

- Updated dependencies [246f06c]
  - @mastra/deployer@0.1.0-alpha.56

## 0.2.0-alpha.163

### Patch Changes

- fa3c7cb: Fix trace name on table being too long
- Updated dependencies [1420ae2]
- Updated dependencies [99f1847]
  - @mastra/core@0.2.0-alpha.105
  - @mastra/deployer@0.1.0-alpha.55

## 0.2.0-alpha.162

### Patch Changes

- b97ca96: Tracing into default storage
- 72d1990: Updated evals table schema
- Updated dependencies [5fdc87c]
- Updated dependencies [b97ca96]
- Updated dependencies [6780223]
- Updated dependencies [72d1990]
- Updated dependencies [cf6d825]
- Updated dependencies [10870bc]
  - @mastra/core@0.2.0-alpha.104
  - @mastra/deployer@0.1.0-alpha.54

## 0.2.0-alpha.161

### Patch Changes

- Updated dependencies [4534e77]
  - @mastra/core@0.2.0-alpha.103
  - @mastra/deployer@0.1.0-alpha.53

## 0.2.0-alpha.160

### Patch Changes

- Updated dependencies [a9345f9]
  - @mastra/core@0.2.0-alpha.102
  - @mastra/deployer@0.1.0-alpha.52

## 0.2.0-alpha.159

### Patch Changes

- 4f1d1a1: Enforce types ann cleanup package.json
- Updated dependencies [66a03ec]
- Updated dependencies [4f1d1a1]
  - @mastra/core@0.2.0-alpha.101
  - @mastra/deployer@0.1.0-alpha.51

## 0.2.0-alpha.158

### Patch Changes

- 9d1796d: Fix storage and eval serialization on api
- Updated dependencies [9d1796d]
  - @mastra/deployer@0.1.0-alpha.50
  - @mastra/core@0.2.0-alpha.100

## 0.2.0-alpha.157

### Patch Changes

- 7d83b92: Create default storage and move evals towards it
- Updated dependencies [7d83b92]
  - @mastra/deployer@0.1.0-alpha.49
  - @mastra/core@0.2.0-alpha.99

## 0.2.0-alpha.156

### Patch Changes

- Updated dependencies [8aec8b7]
  - @mastra/deployer@0.1.0-alpha.48

## 0.2.0-alpha.155

### Patch Changes

- 70dabd9: Fix broken publish
- 202d404: Added instructions when generating evals
- Updated dependencies [70dabd9]
- Updated dependencies [202d404]
  - @mastra/core@0.2.0-alpha.98
  - @mastra/deployer@0.1.0-alpha.47

## 0.2.0-alpha.154

### Patch Changes

- 7892533: Updated test evals to use Mastra Storage
- e6d8055: Added Mastra Storage to add and query live evals
- a18e96c: Array schemas for dev tool playground
- 85c6935: Fix messages sent not rendering when evals are on
- f1e3105: Now that memory can be added to an agent, the playground needs to look up memory on the agent, not on mastra. Now the playground looks up on the agent to properly access memory
- Updated dependencies [07c069d]
- Updated dependencies [7892533]
- Updated dependencies [e6d8055]
- Updated dependencies [a18e96c]
- Updated dependencies [5950de5]
- Updated dependencies [df843d3]
- Updated dependencies [a870123]
- Updated dependencies [f1e3105]
  - @mastra/core@0.2.0-alpha.97
  - @mastra/deployer@0.1.0-alpha.46

## 0.2.0-alpha.153

### Minor Changes

- 74b3078: Reduce verbosity in workflows API

### Patch Changes

- 813c719: Fix watcher in mastra dev, now listens to all files
- 7db55f6: Install aisdk model provider for in create-mastra init
- c18a0c0: Fix creation of new threads in dev playground
- Updated dependencies [74b3078]
  - @mastra/core@0.2.0-alpha.96
  - @mastra/deployer@0.1.0-alpha.45

## 0.2.0-alpha.152

### Patch Changes

- 9fb59d6: changeset
- Updated dependencies [9fb59d6]
  - @mastra/deployer@0.1.0-alpha.44
  - @mastra/core@0.2.0-alpha.95

## 0.2.0-alpha.151

### Minor Changes

- 8b416d9: Breaking changes

### Patch Changes

- 9c10484: update all packages
- Updated dependencies [9c10484]
- Updated dependencies [8b416d9]
  - @mastra/core@0.2.0-alpha.94
  - @mastra/deployer@0.1.0-alpha.43

## 0.2.0-alpha.150

### Patch Changes

- 0209290: Add env to starter gitignore file
- 42a2e69: Fix playground error parsing
- Updated dependencies [5285356]
- Updated dependencies [42a2e69]
  - @mastra/core@0.2.0-alpha.93
  - @mastra/deployer@0.1.0-alpha.42

## 0.2.0-alpha.149

### Patch Changes

- Updated dependencies [0b96376]
  - @mastra/deployer@0.1.0-alpha.41

## 0.2.0-alpha.148

### Patch Changes

- Updated dependencies [8329f1a]
  - @mastra/deployer@0.1.0-alpha.40

## 0.2.0-alpha.147

### Patch Changes

- Updated dependencies [8ea426a]
  - @mastra/deployer@0.1.0-alpha.39

## 0.2.0-alpha.146

### Patch Changes

- b80ea8d: Fix bundling of server
- Updated dependencies [b80ea8d]
  - @mastra/deployer@0.1.0-alpha.34

## 0.2.0-alpha.145

### Minor Changes

- 4d4f6b6: Update deployer

### Patch Changes

- 2f2f65e: Fix multipart location tool error with init example
- Updated dependencies [4d4f6b6]
  - @mastra/deployer@0.1.0-alpha.38
  - @mastra/core@0.2.0-alpha.92

## 0.2.0-alpha.144

### Patch Changes

- Updated dependencies [d7d465a]
- Updated dependencies [d7d465a]
- Updated dependencies [2017553]
- Updated dependencies [a10b7a3]
- Updated dependencies [16e5b04]
  - @mastra/core@0.2.0-alpha.91
  - @mastra/deployer@0.1.0-alpha.37

## 0.2.0-alpha.143

### Patch Changes

- 82a6d53: better create-mastra tsconfig, better error for mastra server agent stream
- Updated dependencies [8151f44]
- Updated dependencies [e897f1c]
- Updated dependencies [82a6d53]
- Updated dependencies [3700be1]
  - @mastra/core@0.2.0-alpha.90
  - @mastra/deployer@0.1.0-alpha.36

## 0.2.0-alpha.142

### Patch Changes

- Updated dependencies [27275c9]
  - @mastra/core@0.2.0-alpha.89
  - @mastra/deployer@0.1.0-alpha.35

## 0.2.0-alpha.141

### Patch Changes

- 323e09e: Use 4o-mini in starter example
- Updated dependencies [ab01c53]
- Updated dependencies [ccbc581]
  - @mastra/deployer@0.1.0-alpha.34
  - @mastra/core@0.2.0-alpha.88

## 0.2.0-alpha.140

### Patch Changes

- c16b6a1: Fix loading env files in dev

## 0.2.0-alpha.139

### Patch Changes

- Updated dependencies [7365b6c]
  - @mastra/core@0.2.0-alpha.87
  - @mastra/deployer@0.1.0-alpha.33

## 0.2.0-alpha.138

### Minor Changes

- 5916f9d: Update deps from fixed to ^

### Patch Changes

- Updated dependencies [6fa4bd2]
- Updated dependencies [5916f9d]
- Updated dependencies [e2e76de]
- Updated dependencies [7f24c29]
- Updated dependencies [67637ba]
- Updated dependencies [04f3171]
  - @mastra/core@0.2.0-alpha.86
  - @mastra/deployer@0.1.0-alpha.32

## 0.1.57-alpha.137

### Patch Changes

- Updated dependencies [e9d1b47]
- Updated dependencies [c5f2d50]
  - @mastra/core@0.2.0-alpha.85
  - @mastra/deployer@0.0.1-alpha.31

## 0.1.57-alpha.136

### Patch Changes

- 3296399: Bump version

## 0.1.57-alpha.135

### Patch Changes

- e27fe69: Add dir to deployer
- Updated dependencies [e27fe69]
  - @mastra/deployer@0.0.1-alpha.30

## 0.1.57-alpha.134

### Patch Changes

- 38b7f66: Update deployer logic
- Updated dependencies [2f17a5f]
- Updated dependencies [0696eeb]
- Updated dependencies [cb290ee]
- Updated dependencies [b4d7416]
- Updated dependencies [38b7f66]
  - @mastra/core@0.2.0-alpha.84
  - @mastra/deployer@0.0.1-alpha.29

## 0.1.57-alpha.133

### Patch Changes

- 2ab57d6: Fix: Workflows require a trigger schema otherwise it fails to run in dev
- 9625602: Use mastra core splitted bundles in other packages
- Updated dependencies [2ab57d6]
- Updated dependencies [30322ce]
- Updated dependencies [78eec7c]
- Updated dependencies [9625602]
- Updated dependencies [8769a62]
  - @mastra/deployer@0.0.1-alpha.28
  - @mastra/core@0.2.0-alpha.83

## 0.1.57-alpha.132

### Patch Changes

- Updated dependencies [73d112c]
- Updated dependencies [ac8c61a]
  - @mastra/deployer@0.0.1-alpha.27
  - @mastra/core@0.1.27-alpha.82

## 0.1.57-alpha.131

### Patch Changes

- Updated dependencies [9fb3039]
  - @mastra/core@0.1.27-alpha.81
  - @mastra/deployer@0.0.1-alpha.26

## 0.1.57-alpha.130

### Patch Changes

- ad38e98: Fix example code

## 0.1.57-alpha.129

### Patch Changes

- 188ffa8: Fix cli create not parsing components flag

## 0.1.57-alpha.128

### Patch Changes

- 327ece7: Updates for ts versions
- Updated dependencies [327ece7]
  - @mastra/core@0.1.27-alpha.80
  - @mastra/deployer@0.0.1-alpha.25

## 0.1.57-alpha.127

### Patch Changes

- 21fe536: add keyword tags for packages and update readmes
- Updated dependencies [21fe536]
  - @mastra/core@0.1.27-alpha.79
  - @mastra/deployer@0.0.1-alpha.24

## 0.1.57-alpha.126

### Patch Changes

- Updated dependencies [88f18d7]
  - @mastra/deployer@0.0.1-alpha.23

## 0.1.57-alpha.125

### Patch Changes

- 6b518fc: Add js banner to mastra dev bundle to fix dynamic import errors

## 0.1.57-alpha.124

### Patch Changes

- Updated dependencies [685108a]
- Updated dependencies [685108a]
  - @mastra/deployer@0.0.1-alpha.22
  - @mastra/core@0.1.27-alpha.78

## 0.1.57-alpha.123

### Patch Changes

- c8a8eab: fix some workflow conditions not showing on graph and dev watcher not working
- Updated dependencies [8105fae]
- Updated dependencies [cfb966f]
  - @mastra/core@0.1.27-alpha.77
  - @mastra/deployer@0.0.1-alpha.21

## 0.1.57-alpha.122

### Patch Changes

- Updated dependencies [ae7bf94]
- Updated dependencies [ae7bf94]
  - @mastra/deployer@0.0.1-alpha.20
  - @mastra/core@0.1.27-alpha.76

## 0.1.57-alpha.121

### Patch Changes

- Updated dependencies [23dcb23]
- Updated dependencies [7064554]
  - @mastra/core@0.1.27-alpha.75
  - @mastra/deployer@0.0.1-alpha.19

## 0.1.57-alpha.120

### Patch Changes

- Updated dependencies [7b87567]
  - @mastra/core@0.1.27-alpha.74
  - @mastra/deployer@0.0.1-alpha.18

## 0.1.57-alpha.119

### Patch Changes

- Updated dependencies [3427b95]
  - @mastra/core@0.1.27-alpha.73
  - @mastra/deployer@0.0.1-alpha.17

## 0.1.57-alpha.118

### Patch Changes

- 255fc56: create mastra bundle correctly
- Updated dependencies [e4d4ede]
- Updated dependencies [06b2c0a]
  - @mastra/core@0.1.27-alpha.72
  - @mastra/deployer@0.0.1-alpha.16

## 0.1.57-alpha.117

### Patch Changes

- 884793d: Fix 500 error in memory call, fix threads sidebar in playground agent chat

## 0.1.57-alpha.116

### Patch Changes

- Updated dependencies [d9c8dd0]
  - @mastra/deployer@0.0.1-alpha.15
  - @mastra/core@0.1.27-alpha.71

## 0.1.57-alpha.115

### Patch Changes

- 215a1c2: Fix bad cli create starter files copying

## 0.1.57-alpha.114

### Patch Changes

- ad2cd74: Deploy fix
- Updated dependencies [ad2cd74]
  - @mastra/deployer@0.0.1-alpha.14

## 0.1.57-alpha.113

### Patch Changes

- Updated dependencies [a1774e7]
  - @mastra/deployer@0.0.1-alpha.13

## 0.1.57-alpha.112

### Patch Changes

- e604ddb: Change bundling architecture
- 28dceab: Catch apiKey error in dev
- Updated dependencies [28dceab]
  - @mastra/deployer@0.0.1-alpha.12

## 0.1.57-alpha.111

### Patch Changes

- Updated dependencies [bdaf834]
  - @mastra/deployer@0.0.1-alpha.11

## 0.1.57-alpha.110

### Patch Changes

- 04434b6: Create separate logger file
- Updated dependencies [dd6d87f]
- Updated dependencies [04434b6]
  - @mastra/core@0.1.27-alpha.70
  - @mastra/deployer@0.0.1-alpha.10

## 0.1.57-alpha.109

### Patch Changes

- 9066f95: CF deployer fixes
- Updated dependencies [9066f95]
  - @mastra/deployer@0.0.1-alpha.9

## 0.1.57-alpha.108

### Patch Changes

- b425845: Logger and execa logs
- Updated dependencies [b425845]
  - @mastra/deployer@0.0.1-alpha.8

## 0.1.57-alpha.107

### Patch Changes

- 1944807: Unified logger and major step in better logs
- 6e18618: Generate tsconfig on mastra create
- 9ade36e: Changed measure for evals, added endpoints, attached metrics to agent, added ui for evals in playground, and updated docs
- Updated dependencies [1944807]
- Updated dependencies [9ade36e]
  - @mastra/deployer@0.0.1-alpha.7
  - @mastra/core@0.1.27-alpha.69

## 0.1.57-alpha.106

### Patch Changes

- Updated dependencies [291fe57]
- Updated dependencies [1a41fbf]
  - @mastra/deployer@0.0.1-alpha.6

## 0.1.57-alpha.105

### Patch Changes

- Updated dependencies [0be7181]
- Updated dependencies [0be7181]
  - @mastra/core@0.1.27-alpha.68
  - @mastra/deployer@0.0.1-alpha.5

## 0.1.57-alpha.104

### Patch Changes

- 7babd5c: CLI build and other
- Updated dependencies [7babd5c]
  - @mastra/deployer@0.0.1-alpha.4

## 0.1.57-alpha.103

### Patch Changes

- Updated dependencies [c8ff2f5]
- Updated dependencies [a291824]
  - @mastra/core@0.1.27-alpha.67
  - @mastra/deployer@0.0.1-alpha.3

## 0.1.57-alpha.102

### Patch Changes

- Updated dependencies [a9b5ddf]
- Updated dependencies [72c280b]
  - @mastra/deployer@0.0.1-alpha.2

## 0.1.57-alpha.101

### Patch Changes

- e38b412: Fixes

## 0.1.57-alpha.100

### Patch Changes

- Updated dependencies [4139b43]
- Updated dependencies [a5604c4]
  - @mastra/deployer@0.0.1-alpha.0

## 0.1.57-alpha.99

### Patch Changes

- Updated dependencies [14064f2]
  - @mastra/core@0.1.27-alpha.66

## 0.1.57-alpha.98

### Patch Changes

- 989833c: Handle rendering workflows without triggerschema on dev playground
- Updated dependencies [e66643a]
  - @mastra/core@0.1.27-alpha.65

## 0.1.57-alpha.97

### Patch Changes

- 17608e9: Fix agent generate/stream with structured output

## 0.1.57-alpha.96

### Patch Changes

- 97fb0d5: Move playground dependencies out of cli
- 245e3f7: dev playground rebuild/refresh on file changes

## 0.1.57-alpha.95

### Patch Changes

- cc9172a: Clarify functionality of logs tab in dev environment
- 9db58b8: Update UI to clarify memory usage in agent chat interface
- ffa0b63: Fix scrolling issue in mastra dev tools playground UI
- Updated dependencies [f368477]
- Updated dependencies [d5ec619]
  - @mastra/core@0.1.27-alpha.64

## 0.1.57-alpha.94

### Patch Changes

- b39ea1d: ability to skip wrangler cli installation

## 0.1.57-alpha.93

### Patch Changes

- 0e2b588: Update cloudflare deployment config
- ec3ea2f: configurable CF worker name

## 0.1.57-alpha.92

### Patch Changes

- Updated dependencies [e097800]
  - @mastra/core@0.1.27-alpha.63

## 0.1.57-alpha.91

### Patch Changes

- Updated dependencies [93a3719]
  - @mastra/core@0.1.27-alpha.62

## 0.1.57-alpha.90

### Patch Changes

- c4cd3ff: Catch npx mastra dev dependency issue
- dde845f: Fix cli stater files build
- 2b4d224: Publishing

## 0.1.57-alpha.89

### Patch Changes

- c4cd3ff: Catch npx mastra dev dependency issue
- dde845f: Fix cli stater files build

## 0.1.57-alpha.88

### Patch Changes

- dc90663: Fix issues in packages
- Updated dependencies [dc90663]
  - @mastra/core@0.1.27-alpha.61

## 0.1.57-alpha.87

### Patch Changes

- Updated dependencies [3967e69]
  - @mastra/core@0.1.27-alpha.60

## 0.1.57-alpha.86

### Patch Changes

- 606bbbe: Adds -f option to engine commands to specify custom docker config. Updates Engine docs.
- Updated dependencies [b524c22]
  - @mastra/core@0.1.27-alpha.59

## 0.1.57-alpha.85

### Patch Changes

- Updated dependencies [1874f40]
- Updated dependencies [4b1ce2c]
  - @mastra/core@0.1.27-alpha.58

## 0.1.57-alpha.84

### Patch Changes

- Updated dependencies [fd494a3]
  - @mastra/core@0.1.27-alpha.57

## 0.1.57-alpha.83

### Patch Changes

- Updated dependencies [9f3ab05]
  - @mastra/core@0.1.27-alpha.56

## 0.1.57-alpha.82

### Patch Changes

- 6cc479d: change cat example

## 0.1.57-alpha.81

### Patch Changes

- 837a288: MAJOR Revamp of tools, workflows, syncs.
- 0b74006: Workflow updates
- Updated dependencies [592e3cf]
- Updated dependencies [837a288]
- Updated dependencies [0b74006]
  - @mastra/core@0.1.27-alpha.55

## 0.1.57-alpha.80

### Patch Changes

- Updated dependencies [d2cd535]
  - @mastra/core@0.1.27-alpha.54

## 0.1.57-alpha.79

### Patch Changes

- Updated dependencies [8e7814f]
  - @mastra/core@0.1.27-alpha.53

## 0.1.57-alpha.78

### Patch Changes

- f79a9ff: Fix example tool execution not workin in dev, add example tool to example agent, add example workflow to main Mastra export
- Updated dependencies [eedb829]
  - @mastra/core@0.1.27-alpha.52

## 0.1.57-alpha.77

### Patch Changes

- 538a136: Added Simple Condition for workflows, updated /api/workflows/{workflowId}/execute endpoint and docs
- Updated dependencies [a7b016d]
- Updated dependencies [da2e8d3]
- Updated dependencies [538a136]
  - @mastra/core@0.1.27-alpha.51

## 0.1.57-alpha.76

### Patch Changes

- b6f9860: watch for changes in user mastra directory and restart server in cli dev
- cefd906: cli interactive api key configuration
- Updated dependencies [401a4d9]
  - @mastra/core@0.1.27-alpha.50

## 0.1.57-alpha.75

### Patch Changes

- Updated dependencies [79acad0]
- Updated dependencies [f5dfa20]
  - @mastra/core@0.1.27-alpha.49

## 0.1.57-alpha.74

### Patch Changes

- edd70b5: changeset

## 0.1.57-alpha.73

### Patch Changes

- aacfff6: publish new mastra, create-mastra

## 0.1.57-alpha.72

### Patch Changes

- 2667e66: fix create mastra publishing

## 0.1.57-alpha.71

### Patch Changes

- 1d68b0c: update dane publishing

## 0.1.57-alpha.70

### Patch Changes

- abdd42d: polish mastra create, fix create-mastra publishing

## 0.1.57-alpha.69

### Patch Changes

- 32cd966: new mastra create command, publish create-mastra a way to quickly spin up mastra apps

## 0.1.57-alpha.68

### Patch Changes

- c156b63: Add missing mastra deploy server deps

## 0.1.57-alpha.67

### Patch Changes

- Updated dependencies [b726bf5]
  - @mastra/core@0.1.27-alpha.48

## 0.1.57-alpha.66

### Patch Changes

- f2c5dfa: update endpoint path

## 0.1.57-alpha.65

### Patch Changes

- f6ba259: simplify generate api
- Updated dependencies [f6ba259]
  - @mastra/core@0.1.27-alpha.47

## 0.1.57-alpha.64

### Patch Changes

- 8ae2bbc: Dane publishing
- 0bd142c: Fixes learned from docs
- ee4de15: Dane fixes
- Updated dependencies [8ae2bbc]
- Updated dependencies [0bd142c]
- Updated dependencies [ee4de15]
  - @mastra/core@0.1.27-alpha.46

## 0.1.57-alpha.63

### Patch Changes

- 0091799: Add dev and deploy mastra commands to CLI references in documentation, update build successful message in dev command
- 1dbbb49: update netlify and cloudflare server templates

## 0.1.57-alpha.62

### Patch Changes

- 0f08180: Update docs for mastra dev

## 0.1.57-alpha.61

### Patch Changes

- 689b529: fix mastra dev for windows

## 0.1.57-alpha.60

### Patch Changes

- cc5bd40: Fix playground agent chat losing some chat during redirect
- 002d6d8: add memory to playground agent
- Updated dependencies [e608d8c]
- Updated dependencies [002d6d8]
  - @mastra/core@0.1.27-alpha.45

## 0.1.57-alpha.59

### Patch Changes

- e5e2bb4: Configure vercel deployment project name

## 0.1.57-alpha.58

### Patch Changes

- 1d88043: Fix tools bundling

## 0.1.57-alpha.57

### Patch Changes

- 79a464e: Update cli, dane, stabilityai builds.
- 2fa7f53: add more logs to workflow, only log failed workflow if all steps fail, animate workflow diagram edges
- Updated dependencies [2fa7f53]
  - @mastra/core@0.1.27-alpha.44

## 0.1.57-alpha.56

### Patch Changes

- b135410: fix- mastra post install
- d6d8159: Workflow graph diagram
- 505d385: playground breadcrumb navigation
- Updated dependencies [2e099d2]
- Updated dependencies [d6d8159]
  - @mastra/core@0.1.27-alpha.43

## 0.1.57-alpha.55

### Patch Changes

- f4ae8dd: dev playground, support multiple tool dirs

## 0.1.57-alpha.54

### Patch Changes

- Updated dependencies [4a54c82]
  - @mastra/core@0.1.27-alpha.42

## 0.1.57-alpha.53

### Patch Changes

- de279d5: update apiKey

## 0.1.57-alpha.52

### Patch Changes

- 1b321d5: Get all tools

## 0.1.57-alpha.51

### Patch Changes

- 5cdfb88: add getWorkflows method to core, add runId to workflow logs, update workflow starter file, add workflows page with table and workflow page with info, endpoints and logs
- Updated dependencies [5cdfb88]
  - @mastra/core@0.1.27-alpha.41

## 0.1.57-alpha.50

### Patch Changes

- ba2437d: one central cli dev playground app
- 8890cac: group mastra dev playground tools

## 0.1.57-alpha.49

### Patch Changes

- Updated dependencies [9029796]
  - @mastra/core@0.1.27-alpha.40

## 0.1.57-alpha.48

### Patch Changes

- 2b01511: Update CONSOLE logger to store logs and return logs, add logs to dev agent page
- Updated dependencies [2b01511]
  - @mastra/core@0.1.27-alpha.39

## 0.1.57-alpha.47

### Patch Changes

- a61be33: update readme

## 0.1.57-alpha.46

### Patch Changes

- Updated dependencies [f031a1f]
  - @mastra/core@0.1.27-alpha.38

## 0.1.57-alpha.45

### Patch Changes

- f6da688: update agents/:agentId page in dev to show agent details and endpoints, add getTools to agent
- b5393f1: New example: Dane and many fixes to make it work
- d1e3623: Refactor CLI and improve engine commands
- Updated dependencies [c872875]
- Updated dependencies [f6da688]
- Updated dependencies [b5393f1]
  - @mastra/core@0.1.27-alpha.37

## 0.1.57-alpha.44

### Patch Changes

- f187221: bring back cli post install
- 75bf3f0: remove context bug in agent tool execution, update style for mastra dev rendered pages
- b748d2a: fix error when installing zod in starter
- Updated dependencies [f537e33]
- Updated dependencies [bc40916]
- Updated dependencies [f7d1131]
- Updated dependencies [75bf3f0]
- Updated dependencies [3c4488b]
- Updated dependencies [d38f7a6]
  - @mastra/core@0.1.27-alpha.36

## 0.1.57-alpha.43

### Patch Changes

- 033eda6: More fixes for refactor
- Updated dependencies [033eda6]
  - @mastra/core@0.1.27-alpha.35

## 0.1.57-alpha.42

### Patch Changes

- 837a288: MAJOR Revamp of tools, workflows, syncs.
- Updated dependencies [837a288]
- Updated dependencies [5811de6]
  - @mastra/core@0.1.27-alpha.34

## 0.1.57-alpha.41

### Patch Changes

- Updated dependencies [e1dd94a]
  - @mastra/core@0.1.27-alpha.33

## 0.1.57-alpha.40

### Patch Changes

- 678ffb4: Add layout with sidebar, update dev endpoints to have /api prefix

## 0.1.57-alpha.39

### Patch Changes

- ba821de: publish cli homepage

## 0.1.57-alpha.38

### Patch Changes

- 3af5866: publish cli post install script

## 0.1.57-alpha.37

### Patch Changes

- 43667fa: postinstall mastra package deps
- 2712098: add getAgents method to core and route to cli dev, add homepage interface to cli
- 5d2f4b0: cli shared ui
- Updated dependencies [2712098]
  - @mastra/core@0.1.27-alpha.32

## 0.1.57-alpha.36

### Patch Changes

- fd15221: cli publishing fix

## 0.1.57-alpha.35

### Patch Changes

- a828155: Add prepare script to include node_modules in published package
- Updated dependencies [c2dd6b5]
  - @mastra/core@0.1.27-alpha.31

## 0.1.57-alpha.34

### Patch Changes

- 46e9b7a: bundle mastra dev deps with publish

## 0.1.57-alpha.33

### Patch Changes

- 59f592a: mastra dev open api spec, mastra server templates as code

## 0.1.57-alpha.32

### Patch Changes

- 95e15a9: render agent chat errors

## 0.1.57-alpha.31

### Patch Changes

- f1cb298: rename serve command to dev
- 732a971: create api for sync

## 0.1.57-alpha.30

### Patch Changes

- 43ac982: serve agent chat ui on mastra serve

## 0.1.57-alpha.29

### Patch Changes

- 019d771: throw proper errors in serve

## 0.1.57-alpha.28

### Patch Changes

- 4123324: Fix cli server build
- 5fd3569: Update CLOUDFLARE and NETLIFY servers

## 0.1.57-alpha.27

### Patch Changes

- Updated dependencies [963c15a]
  - @mastra/core@0.1.27-alpha.30

## 0.1.57-alpha.26

### Patch Changes

- Updated dependencies [7d87a15]
  - @mastra/core@0.1.27-alpha.29

## 0.1.57-alpha.25

### Patch Changes

- Updated dependencies [1ebd071]
  - @mastra/core@0.1.27-alpha.28

## 0.1.57-alpha.24

### Patch Changes

- b9f7d2f: Expose memory APIs in mastra serve
- Updated dependencies [cd02c56]
  - @mastra/core@0.1.27-alpha.27

## 0.1.57-alpha.23

### Patch Changes

- 9df6d6e: Fix serve

## 0.1.57-alpha.22

### Patch Changes

- 31ca9fe: fix bugs with init
- 3c2d317: add textObject and streamObject to serve api
- Updated dependencies [d5e12de]
  - @mastra/core@0.1.27-alpha.26

## 0.1.57-alpha.21

### Patch Changes

- 86c9e6b: Added posthog telemetry

## 0.1.57-alpha.20

### Patch Changes

- 56f2163: add proper titles and handle empty list
- Updated dependencies [01502b0]
  - @mastra/core@0.1.27-alpha.25

## 0.1.57-alpha.19

### Patch Changes

- 8e62269: show cli options rather than ascii art

## 0.1.57-alpha.18

### Patch Changes

- Updated dependencies [836f4e3]
  - @mastra/core@0.1.27-alpha.24

## 0.1.57-alpha.17

### Patch Changes

- Updated dependencies [0b826f6]
  - @mastra/core@0.1.27-alpha.23

## 0.1.57-alpha.16

### Patch Changes

- Updated dependencies [7a19083]
  - @mastra/core@0.1.27-alpha.22

## 0.1.57-alpha.15

### Patch Changes

- d863bb3: Fixing mastra engine generate

## 0.1.57-alpha.14

### Patch Changes

- Updated dependencies [5ee2e78]
  - @mastra/core@0.1.27-alpha.21

## 0.1.57-alpha.13

### Patch Changes

- 5abbb24: Added deploy commands, init experience, serve improvements
