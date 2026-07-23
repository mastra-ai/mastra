# @mastra/server

## 1.52.1-alpha.0

### Patch Changes

- Updated dependencies [[`55adddf`](https://github.com/mastra-ai/mastra/commit/55adddfda2a170b00c112bf37d677e8ce5b65d5a)]:
  - @mastra/core@1.52.1-alpha.0

## 1.52.0

### Minor Changes

- Added request-scoped model overrides to agent execution and approvals, and fixed Studio model selection so each tab can use a different model without changing the agent's configured default. ([#19749](https://github.com/mastra-ai/mastra/pull/19749))

  ```ts
  await agent.stream(messages, { model: 'google/gemini-2.5-flash' });
  ```

- Added exact thread binding to the AgentController session creation endpoint. ([#19902](https://github.com/mastra-ai/mastra/pull/19902))

### Patch Changes

- Fixed agent generate and stream requests being rejected with a 400 error when `memory.resource` was omitted but server auth was configured with `mapUserToResourceId`. The request body schema required `memory.resource` even though the server derives the resource ID from the authenticated user and overrides any client-provided value. ([#19524](https://github.com/mastra-ai/mastra/pull/19524))

  Clients no longer need to send a placeholder resource ID:

  ```json
  {
    "messages": ["what was my last message?"],
    "memory": { "thread": "test-thread" }
  }
  ```

  If a request uses memory and neither the body nor the authenticated request context provides a resource ID, the server now returns a clear 400 error. Fixes [#19518](https://github.com/mastra-ai/mastra/issues/19518).

- Prevented redundant agent controller thread switches from interrupting active responses. ([#19333](https://github.com/mastra-ai/mastra/pull/19333))

- Fixed agent replies from channels being silently dropped on Cloudflare Workers. ([#19299](https://github.com/mastra-ai/mastra/pull/19299))

  The bot would receive a message and the webhook returned `200 OK`, but no reply was posted and nothing was logged. Channel replies run after the webhook responds, and on Cloudflare Workers that remaining work was being dropped once the response was sent. It is now kept running to completion, so the reply is delivered. (#19285)

- Fixed durable-agent check in recover route ([#19632](https://github.com/mastra-ai/mastra/pull/19632))

- Fixed agent controller session routes to use the active request context when creating or resolving sessions. ([#19642](https://github.com/mastra-ai/mastra/pull/19642))

- Fixed dataset item endpoints to return HTTP 400 when payloads contain circular values, silently lossy JSON values (nested `undefined`, functions, symbols, bigints, and non-finite numbers), or non-plain objects (`Date`, `Map`, `Set`, class instances, and custom `toJSON()` objects) that cannot be serialized faithfully. Also fixed the add/update dataset item endpoints to persist the caller-provided `requestContext` entries instead of the live server request context instance, which contained internal server state and could fail storage serialization. ([#19603](https://github.com/mastra-ai/mastra/pull/19603))

- Documented the optional `requestContext` body field on agent controller run routes (send message, steer, follow-up, tool approval, tool suspension) so it appears in the generated OpenAPI spec. The server already merged this field into the request context; only the route schemas were missing it. ([#19531](https://github.com/mastra-ai/mastra/pull/19531))

- Replace `any` with `unknown` in generated route types so clients get real type errors instead of silently unchecked values. Route-types generation now deduplicates shared schemas into reusable type aliases, shrinking the generated `route-types.generated.ts` from ~94K to ~22K lines (77% smaller). The memory config response now types `workingMemory` (enabled, scope, template, schema, version) instead of `unknown`. ([#19573](https://github.com/mastra-ai/mastra/pull/19573))

  If your code read fields from responses that were previously typed `any`, TypeScript now requires you to narrow them before use:

  ```ts
  // Before: `metadata` was `any`, so this compiled even when unsafe
  const value = response.metadata.someField;

  // After: `metadata` is `unknown` — narrow it first
  const metadata = response.metadata;
  if (metadata && typeof metadata === 'object' && 'someField' in metadata) {
    const value = metadata.someField;
  }
  // ...or cast if you know the shape: (metadata as MyMetadata).someField
  ```

  Code that reads `workingMemory` from the memory config response no longer needs casts — `config.workingMemory?.enabled`, `scope`, `template`, `schema`, and `version` are now typed directly.

- Prevented clients from spoofing a trusted actor or tenant scope through built-in agent HTTP execution routes. ([#19338](https://github.com/mastra-ai/mastra/pull/19338))

  The agent generate/stream/resume routes parse the request body with a passthrough schema and spread unknown fields into the execution options, so a caller could supply `actor` (including `agentId`, `permissions`, and `scope`) and have it reach the authorization layer, or self-assert a tenant by setting `requestContext.organizationId`.

  - `actor` is now stripped from top-level and nested execution options handled by these routes. The actor signal must be produced by trusted server-side code, such as a scheduled job or workflow, never accepted from an HTTP client.
  - `organizationId` is now a reserved request-context key, so a body-supplied value is no longer merged into the request context. Establish tenant scope server-side.

  Behavior change: clients that previously passed `actor` or `organizationId` through the HTTP body will no longer have those values honored.

- Added stable metrics and logs capability reporting for observability storage. The system packages response now includes `observabilityStorageCapabilities` with `metrics` and `logs` flags, enabling capability-based detection that is resilient to bundler-generated constructor name changes. ([#19305](https://github.com/mastra-ai/mastra/pull/19305))

  ```typescript
  const packages = await client.getSystemPackages();
  console.log(packages.observabilityStorageCapabilities?.metrics); // true
  console.log(packages.observabilityStorageCapabilities?.logs); // true
  ```

  Studio now uses the capability response instead of relying on constructor names, with a fallback for older servers.

- Updated dependencies [[`ec857fc`](https://github.com/mastra-ai/mastra/commit/ec857fc79c264b53b38e16478c789b7177f2ad59), [`d7385ad`](https://github.com/mastra-ai/mastra/commit/d7385ad9e88f9e4f33d15c0ec0bfebedde0cbc2e), [`41a5392`](https://github.com/mastra-ai/mastra/commit/41a5392d9f6c5e18d6b227f0fc0ddf49c50774e9), [`3d6e539`](https://github.com/mastra-ai/mastra/commit/3d6e539272eb2ea0407034605ee1906b3be06b39), [`1426af2`](https://github.com/mastra-ai/mastra/commit/1426af24975879c000d13ac75673f630fcc970c1), [`a40adeb`](https://github.com/mastra-ai/mastra/commit/a40adeb222b961a56a58af56a106106525721b74), [`8a0d145`](https://github.com/mastra-ai/mastra/commit/8a0d145aadbdf7278665aceaaec364b35dd9bd94), [`bd2f1d2`](https://github.com/mastra-ai/mastra/commit/bd2f1d274d05e60e2366f005ea0d94d5cea0d5ff), [`e1f2fae`](https://github.com/mastra-ai/mastra/commit/e1f2faebaf048c3d4c2e2c01d293767c195d5794), [`63aa799`](https://github.com/mastra-ai/mastra/commit/63aa799c6b44eacc7806cda6846b7c5bbee06b37), [`b7e79c3`](https://github.com/mastra-ai/mastra/commit/b7e79c3c02ac5cd415db34ba0975ceafc1464333), [`675fbff`](https://github.com/mastra-ai/mastra/commit/675fbff84d3274391b33e852f76083c38a5514e5), [`da009e1`](https://github.com/mastra-ai/mastra/commit/da009e1aacd89ed94b8d1b2af09c9d4fe7c4db49), [`3b77e77`](https://github.com/mastra-ai/mastra/commit/3b77e7704936522e4769d29de1b5ea6901f302bd), [`c7d30cd`](https://github.com/mastra-ai/mastra/commit/c7d30cd86009c407df91105591f03cd6e3d2854d), [`21a0eb8`](https://github.com/mastra-ai/mastra/commit/21a0eb86746ba0b703acea360d4f84c6a5a493f2), [`8b20926`](https://github.com/mastra-ai/mastra/commit/8b20926cd59e2ba3d66458e062fa0e6e2ada3e68), [`975295d`](https://github.com/mastra-ai/mastra/commit/975295d418552f0d46a59edfef4c3ee555f9930a), [`73db8db`](https://github.com/mastra-ai/mastra/commit/73db8db90d69ab6153c7942749f624db0d96952d), [`6b1bf3b`](https://github.com/mastra-ai/mastra/commit/6b1bf3b9494bd51aa8f654c68c9355d6046fa2a1), [`35c2181`](https://github.com/mastra-ai/mastra/commit/35c2181e6a50e47c90ba36260db7c9723d54696f), [`0a2c22c`](https://github.com/mastra-ai/mastra/commit/0a2c22c902604439ec490319e14c17f331e0c84c), [`4cfdd64`](https://github.com/mastra-ai/mastra/commit/4cfdd645794feaea0c4ea711e70ecdfbef0c5b8e), [`b75d749`](https://github.com/mastra-ai/mastra/commit/b75d749621ff5d17e86bcb4ee809d301fb4f7cf3), [`821648b`](https://github.com/mastra-ai/mastra/commit/821648bf2871ef840100c7bacbecf676010bd12a), [`de86fd7`](https://github.com/mastra-ai/mastra/commit/de86fd7119f0438381d1a642e3d258143c0b9c29), [`2745031`](https://github.com/mastra-ai/mastra/commit/2745031d1d4a4978f037092da371428c32e2842a), [`b4b7ea8`](https://github.com/mastra-ai/mastra/commit/b4b7ea8733f033fc441ea47ed03f6afb17ec2248), [`3a8024c`](https://github.com/mastra-ai/mastra/commit/3a8024ce615f8aa89479c0d71fe61d10bb0040be), [`35865a5`](https://github.com/mastra-ai/mastra/commit/35865a53e194aa9634d6a70a97010e7a6b9d58b1), [`74faf8b`](https://github.com/mastra-ai/mastra/commit/74faf8bd9c1018f2492653c06b1e25fc8300e9e6), [`ef03fbc`](https://github.com/mastra-ai/mastra/commit/ef03fbcc556bcbc04c9b3d06fab88771ecaa043c), [`675fbff`](https://github.com/mastra-ai/mastra/commit/675fbff84d3274391b33e852f76083c38a5514e5), [`70687f7`](https://github.com/mastra-ai/mastra/commit/70687f7e495a322a02070b4a67cb0c77a5ca91ec), [`1fadac4`](https://github.com/mastra-ai/mastra/commit/1fadac44537caeefe81f9f775ae2f2f3d94e9069), [`73db8db`](https://github.com/mastra-ai/mastra/commit/73db8db90d69ab6153c7942749f624db0d96952d), [`76b7181`](https://github.com/mastra-ai/mastra/commit/76b71810366e6d90b9d3973149d1c7ba3659ffb9), [`792ec9a`](https://github.com/mastra-ai/mastra/commit/792ec9a0869bab8274cf5e0ed2840738737a1607), [`712b864`](https://github.com/mastra-ai/mastra/commit/712b864aa1ed12b14c54390ec17b69de163c37f7), [`85e4fb5`](https://github.com/mastra-ai/mastra/commit/85e4fb50087a81c74df3a762f53b56373db0b912), [`0c0e8d7`](https://github.com/mastra-ai/mastra/commit/0c0e8d7becd4d1445c656b78d5d845f606c1ff9d), [`a7bbe77`](https://github.com/mastra-ai/mastra/commit/a7bbe773577f60bc4761b534ef7ec6b476332dad), [`72e437c`](https://github.com/mastra-ai/mastra/commit/72e437c515942c80b9def5b026e0bdee61b469d9), [`8f7a5de`](https://github.com/mastra-ai/mastra/commit/8f7a5dedc246cdc938bb65516703cf9b27b03756), [`a7bbe77`](https://github.com/mastra-ai/mastra/commit/a7bbe773577f60bc4761b534ef7ec6b476332dad), [`11f6cd9`](https://github.com/mastra-ai/mastra/commit/11f6cd96fe42582403416608beb212cc1a2cc79e), [`ef03c0c`](https://github.com/mastra-ai/mastra/commit/ef03c0cfc62367a458e4cc56462e2148b35681c5), [`4fb4d88`](https://github.com/mastra-ai/mastra/commit/4fb4d881bc107acee13890ad4d78661016c510ed), [`4e68363`](https://github.com/mastra-ai/mastra/commit/4e683634f94ebd062d26a3bb6093a8dfc7263d37), [`c328769`](https://github.com/mastra-ai/mastra/commit/c3287698ff8ef98dba86d415faa566fa3e5f4d56), [`9f7c67a`](https://github.com/mastra-ai/mastra/commit/9f7c67abeeb52c41c51a9b5edee60b62afe7cd8d), [`3b65e68`](https://github.com/mastra-ai/mastra/commit/3b65e68d7f1c771c7a70eea42d83fefdd28cad88), [`4eba27a`](https://github.com/mastra-ai/mastra/commit/4eba27adcf60f991df0e62f94b3e75b4e67f3b4b), [`c701be3`](https://github.com/mastra-ai/mastra/commit/c701be32d7d9aa94a66da8c6cc38dcac6856f464), [`db650ce`](https://github.com/mastra-ai/mastra/commit/db650ce490348914e85b93651d83acdf8f2a4c31), [`232fcbc`](https://github.com/mastra-ai/mastra/commit/232fcbc14fce625dd672ba043329c0b732c62be2), [`6354eeb`](https://github.com/mastra-ai/mastra/commit/6354eeb32efa9f5f68f51dda394e90e2ee76f1fb), [`a8799bb`](https://github.com/mastra-ai/mastra/commit/a8799bb8e44f4a60d01e4e2acd3448ff80bf14f8), [`3d6e539`](https://github.com/mastra-ai/mastra/commit/3d6e539272eb2ea0407034605ee1906b3be06b39), [`e3868e2`](https://github.com/mastra-ai/mastra/commit/e3868e22babfffd0133771669ca724501c2dd58e), [`9251370`](https://github.com/mastra-ai/mastra/commit/9251370ad413af464aa22d7566338bec5613e8de), [`3491666`](https://github.com/mastra-ai/mastra/commit/34916663c4fdd43b48c21f4ab2d5fb6dcccc94f9), [`c0bec73`](https://github.com/mastra-ai/mastra/commit/c0bec732c93d1a22ae5e51ed66cf8cacca8bd6a6)]:
  - @mastra/core@1.52.0

## 1.52.0-alpha.13

### Patch Changes

- Updated dependencies:
  - @mastra/core@1.52.0-alpha.13

## 1.52.0-alpha.12

### Patch Changes

- Updated dependencies [[`d7385ad`](https://github.com/mastra-ai/mastra/commit/d7385ad9e88f9e4f33d15c0ec0bfebedde0cbc2e), [`3d6e539`](https://github.com/mastra-ai/mastra/commit/3d6e539272eb2ea0407034605ee1906b3be06b39), [`35865a5`](https://github.com/mastra-ai/mastra/commit/35865a53e194aa9634d6a70a97010e7a6b9d58b1), [`70687f7`](https://github.com/mastra-ai/mastra/commit/70687f7e495a322a02070b4a67cb0c77a5ca91ec), [`3d6e539`](https://github.com/mastra-ai/mastra/commit/3d6e539272eb2ea0407034605ee1906b3be06b39)]:
  - @mastra/core@1.52.0-alpha.12

## 1.52.0-alpha.11

### Minor Changes

- Added exact thread binding to the AgentController session creation endpoint. ([#19902](https://github.com/mastra-ai/mastra/pull/19902))

### Patch Changes

- Updated dependencies [[`c7d30cd`](https://github.com/mastra-ai/mastra/commit/c7d30cd86009c407df91105591f03cd6e3d2854d), [`ef03fbc`](https://github.com/mastra-ai/mastra/commit/ef03fbcc556bcbc04c9b3d06fab88771ecaa043c), [`a7bbe77`](https://github.com/mastra-ai/mastra/commit/a7bbe773577f60bc4761b534ef7ec6b476332dad), [`a7bbe77`](https://github.com/mastra-ai/mastra/commit/a7bbe773577f60bc4761b534ef7ec6b476332dad), [`4e68363`](https://github.com/mastra-ai/mastra/commit/4e683634f94ebd062d26a3bb6093a8dfc7263d37), [`9251370`](https://github.com/mastra-ai/mastra/commit/9251370ad413af464aa22d7566338bec5613e8de)]:
  - @mastra/core@1.52.0-alpha.11

## 1.52.0-alpha.10

### Minor Changes

- Added request-scoped model overrides to agent execution and approvals, and fixed Studio model selection so each tab can use a different model without changing the agent's configured default. ([#19749](https://github.com/mastra-ai/mastra/pull/19749))

  ```ts
  await agent.stream(messages, { model: 'google/gemini-2.5-flash' });
  ```

### Patch Changes

- Prevented clients from spoofing a trusted actor or tenant scope through built-in agent HTTP execution routes. ([#19338](https://github.com/mastra-ai/mastra/pull/19338))

  The agent generate/stream/resume routes parse the request body with a passthrough schema and spread unknown fields into the execution options, so a caller could supply `actor` (including `agentId`, `permissions`, and `scope`) and have it reach the authorization layer, or self-assert a tenant by setting `requestContext.organizationId`.

  - `actor` is now stripped from top-level and nested execution options handled by these routes. The actor signal must be produced by trusted server-side code, such as a scheduled job or workflow, never accepted from an HTTP client.
  - `organizationId` is now a reserved request-context key, so a body-supplied value is no longer merged into the request context. Establish tenant scope server-side.

  Behavior change: clients that previously passed `actor` or `organizationId` through the HTTP body will no longer have those values honored.

- Updated dependencies [[`41a5392`](https://github.com/mastra-ai/mastra/commit/41a5392d9f6c5e18d6b227f0fc0ddf49c50774e9), [`675fbff`](https://github.com/mastra-ai/mastra/commit/675fbff84d3274391b33e852f76083c38a5514e5), [`da009e1`](https://github.com/mastra-ai/mastra/commit/da009e1aacd89ed94b8d1b2af09c9d4fe7c4db49), [`35c2181`](https://github.com/mastra-ai/mastra/commit/35c2181e6a50e47c90ba36260db7c9723d54696f), [`b4b7ea8`](https://github.com/mastra-ai/mastra/commit/b4b7ea8733f033fc441ea47ed03f6afb17ec2248), [`675fbff`](https://github.com/mastra-ai/mastra/commit/675fbff84d3274391b33e852f76083c38a5514e5), [`c328769`](https://github.com/mastra-ai/mastra/commit/c3287698ff8ef98dba86d415faa566fa3e5f4d56), [`232fcbc`](https://github.com/mastra-ai/mastra/commit/232fcbc14fce625dd672ba043329c0b732c62be2), [`3491666`](https://github.com/mastra-ai/mastra/commit/34916663c4fdd43b48c21f4ab2d5fb6dcccc94f9)]:
  - @mastra/core@1.52.0-alpha.10

## 1.52.0-alpha.9

### Patch Changes

- Updated dependencies [[`0a2c22c`](https://github.com/mastra-ai/mastra/commit/0a2c22c902604439ec490319e14c17f331e0c84c), [`3a8024c`](https://github.com/mastra-ai/mastra/commit/3a8024ce615f8aa89479c0d71fe61d10bb0040be)]:
  - @mastra/core@1.52.0-alpha.9

## 1.52.0-alpha.8

### Patch Changes

- Updated dependencies [[`3b77e77`](https://github.com/mastra-ai/mastra/commit/3b77e7704936522e4769d29de1b5ea6901f302bd), [`6b1bf3b`](https://github.com/mastra-ai/mastra/commit/6b1bf3b9494bd51aa8f654c68c9355d6046fa2a1), [`72e437c`](https://github.com/mastra-ai/mastra/commit/72e437c515942c80b9def5b026e0bdee61b469d9)]:
  - @mastra/core@1.52.0-alpha.8

## 1.52.0-alpha.7

### Patch Changes

- Updated dependencies [[`b7e79c3`](https://github.com/mastra-ai/mastra/commit/b7e79c3c02ac5cd415db34ba0975ceafc1464333), [`b75d749`](https://github.com/mastra-ai/mastra/commit/b75d749621ff5d17e86bcb4ee809d301fb4f7cf3), [`a8799bb`](https://github.com/mastra-ai/mastra/commit/a8799bb8e44f4a60d01e4e2acd3448ff80bf14f8)]:
  - @mastra/core@1.52.0-alpha.7

## 1.52.0-alpha.6

### Patch Changes

- Fixed agent replies from channels being silently dropped on Cloudflare Workers. ([#19299](https://github.com/mastra-ai/mastra/pull/19299))

  The bot would receive a message and the webhook returned `200 OK`, but no reply was posted and nothing was logged. Channel replies run after the webhook responds, and on Cloudflare Workers that remaining work was being dropped once the response was sent. It is now kept running to completion, so the reply is delivered. (#19285)

- Fixed durable-agent check in recover route ([#19632](https://github.com/mastra-ai/mastra/pull/19632))

- Fixed dataset item endpoints to return HTTP 400 when payloads contain circular values, silently lossy JSON values (nested `undefined`, functions, symbols, bigints, and non-finite numbers), or non-plain objects (`Date`, `Map`, `Set`, class instances, and custom `toJSON()` objects) that cannot be serialized faithfully. Also fixed the add/update dataset item endpoints to persist the caller-provided `requestContext` entries instead of the live server request context instance, which contained internal server state and could fail storage serialization. ([#19603](https://github.com/mastra-ai/mastra/pull/19603))

- Updated dependencies [[`a40adeb`](https://github.com/mastra-ai/mastra/commit/a40adeb222b961a56a58af56a106106525721b74), [`821648b`](https://github.com/mastra-ai/mastra/commit/821648bf2871ef840100c7bacbecf676010bd12a), [`11f6cd9`](https://github.com/mastra-ai/mastra/commit/11f6cd96fe42582403416608beb212cc1a2cc79e)]:
  - @mastra/core@1.52.0-alpha.6

## 1.52.0-alpha.5

### Patch Changes

- Fixed agent controller session routes to use the active request context when creating or resolving sessions. ([#19642](https://github.com/mastra-ai/mastra/pull/19642))

- Replace `any` with `unknown` in generated route types so clients get real type errors instead of silently unchecked values. Route-types generation now deduplicates shared schemas into reusable type aliases, shrinking the generated `route-types.generated.ts` from ~94K to ~22K lines (77% smaller). The memory config response now types `workingMemory` (enabled, scope, template, schema, version) instead of `unknown`. ([#19573](https://github.com/mastra-ai/mastra/pull/19573))

  If your code read fields from responses that were previously typed `any`, TypeScript now requires you to narrow them before use:

  ```ts
  // Before: `metadata` was `any`, so this compiled even when unsafe
  const value = response.metadata.someField;

  // After: `metadata` is `unknown` — narrow it first
  const metadata = response.metadata;
  if (metadata && typeof metadata === 'object' && 'someField' in metadata) {
    const value = metadata.someField;
  }
  // ...or cast if you know the shape: (metadata as MyMetadata).someField
  ```

  Code that reads `workingMemory` from the memory config response no longer needs casts — `config.workingMemory?.enabled`, `scope`, `template`, `schema`, and `version` are now typed directly.

- Updated dependencies [[`ec857fc`](https://github.com/mastra-ai/mastra/commit/ec857fc79c264b53b38e16478c789b7177f2ad59), [`e1f2fae`](https://github.com/mastra-ai/mastra/commit/e1f2faebaf048c3d4c2e2c01d293767c195d5794), [`63aa799`](https://github.com/mastra-ai/mastra/commit/63aa799c6b44eacc7806cda6846b7c5bbee06b37), [`73db8db`](https://github.com/mastra-ai/mastra/commit/73db8db90d69ab6153c7942749f624db0d96952d), [`73db8db`](https://github.com/mastra-ai/mastra/commit/73db8db90d69ab6153c7942749f624db0d96952d), [`76b7181`](https://github.com/mastra-ai/mastra/commit/76b71810366e6d90b9d3973149d1c7ba3659ffb9), [`0c0e8d7`](https://github.com/mastra-ai/mastra/commit/0c0e8d7becd4d1445c656b78d5d845f606c1ff9d), [`9f7c67a`](https://github.com/mastra-ai/mastra/commit/9f7c67abeeb52c41c51a9b5edee60b62afe7cd8d), [`3b65e68`](https://github.com/mastra-ai/mastra/commit/3b65e68d7f1c771c7a70eea42d83fefdd28cad88), [`e3868e2`](https://github.com/mastra-ai/mastra/commit/e3868e22babfffd0133771669ca724501c2dd58e)]:
  - @mastra/core@1.52.0-alpha.5

## 1.52.0-alpha.4

### Patch Changes

- Updated dependencies [[`4cfdd64`](https://github.com/mastra-ai/mastra/commit/4cfdd645794feaea0c4ea711e70ecdfbef0c5b8e)]:
  - @mastra/core@1.52.0-alpha.4

## 1.52.0-alpha.3

### Patch Changes

- Documented the optional `requestContext` body field on agent controller run routes (send message, steer, follow-up, tool approval, tool suspension) so it appears in the generated OpenAPI spec. The server already merged this field into the request context; only the route schemas were missing it. ([#19531](https://github.com/mastra-ai/mastra/pull/19531))

- Added stable metrics and logs capability reporting for observability storage. The system packages response now includes `observabilityStorageCapabilities` with `metrics` and `logs` flags, enabling capability-based detection that is resilient to bundler-generated constructor name changes. ([#19305](https://github.com/mastra-ai/mastra/pull/19305))

  ```typescript
  const packages = await client.getSystemPackages();
  console.log(packages.observabilityStorageCapabilities?.metrics); // true
  console.log(packages.observabilityStorageCapabilities?.logs); // true
  ```

  Studio now uses the capability response instead of relying on constructor names, with a fallback for older servers.

- Updated dependencies [[`1426af2`](https://github.com/mastra-ai/mastra/commit/1426af24975879c000d13ac75673f630fcc970c1), [`975295d`](https://github.com/mastra-ai/mastra/commit/975295d418552f0d46a59edfef4c3ee555f9930a), [`85e4fb5`](https://github.com/mastra-ai/mastra/commit/85e4fb50087a81c74df3a762f53b56373db0b912), [`ef03c0c`](https://github.com/mastra-ai/mastra/commit/ef03c0cfc62367a458e4cc56462e2148b35681c5), [`4fb4d88`](https://github.com/mastra-ai/mastra/commit/4fb4d881bc107acee13890ad4d78661016c510ed), [`4eba27a`](https://github.com/mastra-ai/mastra/commit/4eba27adcf60f991df0e62f94b3e75b4e67f3b4b), [`c701be3`](https://github.com/mastra-ai/mastra/commit/c701be32d7d9aa94a66da8c6cc38dcac6856f464)]:
  - @mastra/core@1.52.0-alpha.3

## 1.52.0-alpha.2

### Patch Changes

- Fixed agent generate and stream requests being rejected with a 400 error when `memory.resource` was omitted but server auth was configured with `mapUserToResourceId`. The request body schema required `memory.resource` even though the server derives the resource ID from the authenticated user and overrides any client-provided value. ([#19524](https://github.com/mastra-ai/mastra/pull/19524))

  Clients no longer need to send a placeholder resource ID:

  ```json
  {
    "messages": ["what was my last message?"],
    "memory": { "thread": "test-thread" }
  }
  ```

  If a request uses memory and neither the body nor the authenticated request context provides a resource ID, the server now returns a clear 400 error. Fixes [#19518](https://github.com/mastra-ai/mastra/issues/19518).

- Updated dependencies [[`8b20926`](https://github.com/mastra-ai/mastra/commit/8b20926cd59e2ba3d66458e062fa0e6e2ada3e68), [`74faf8b`](https://github.com/mastra-ai/mastra/commit/74faf8bd9c1018f2492653c06b1e25fc8300e9e6), [`1fadac4`](https://github.com/mastra-ai/mastra/commit/1fadac44537caeefe81f9f775ae2f2f3d94e9069), [`792ec9a`](https://github.com/mastra-ai/mastra/commit/792ec9a0869bab8274cf5e0ed2840738737a1607), [`712b864`](https://github.com/mastra-ai/mastra/commit/712b864aa1ed12b14c54390ec17b69de163c37f7), [`8f7a5de`](https://github.com/mastra-ai/mastra/commit/8f7a5dedc246cdc938bb65516703cf9b27b03756), [`c0bec73`](https://github.com/mastra-ai/mastra/commit/c0bec732c93d1a22ae5e51ed66cf8cacca8bd6a6)]:
  - @mastra/core@1.52.0-alpha.2

## 1.51.1-alpha.1

### Patch Changes

- Updated dependencies:
  - @mastra/core@1.51.1-alpha.1

## 1.51.1-alpha.0

### Patch Changes

- Prevented redundant agent controller thread switches from interrupting active responses. ([#19333](https://github.com/mastra-ai/mastra/pull/19333))

- Updated dependencies [[`8a0d145`](https://github.com/mastra-ai/mastra/commit/8a0d145aadbdf7278665aceaaec364b35dd9bd94), [`bd2f1d2`](https://github.com/mastra-ai/mastra/commit/bd2f1d274d05e60e2366f005ea0d94d5cea0d5ff), [`21a0eb8`](https://github.com/mastra-ai/mastra/commit/21a0eb86746ba0b703acea360d4f84c6a5a493f2), [`de86fd7`](https://github.com/mastra-ai/mastra/commit/de86fd7119f0438381d1a642e3d258143c0b9c29), [`2745031`](https://github.com/mastra-ai/mastra/commit/2745031d1d4a4978f037092da371428c32e2842a), [`db650ce`](https://github.com/mastra-ai/mastra/commit/db650ce490348914e85b93651d83acdf8f2a4c31), [`6354eeb`](https://github.com/mastra-ai/mastra/commit/6354eeb32efa9f5f68f51dda394e90e2ee76f1fb)]:
  - @mastra/core@1.51.1-alpha.0

## 1.51.0

### Minor Changes

- Added an optional session scope to the agent controller API so clients can address independent sessions that share one resource (for example one session per git worktree). ([#19357](https://github.com/mastra-ai/mastra/pull/19357))

  Session routes now accept a `sessionScope` query parameter, and `AgentController.session()` in the client accepts a scope that travels on every request:

  ```ts
  const controller = client.getAgentController('code');

  // Address the worktree's own session instead of the shared one:
  const session = controller.session('repo-123', '/worktrees/feature-a');
  await session.create({ tags: { projectPath: '/worktrees/feature-a' } });
  await session.sendMessage('hello');
  ```

  Requests without a scope behave exactly as before.

- Added image attachment support to agent controller chat. You can now send images (and other files) with a message, and the Mastra Code web chat lets you attach, paste, or drag-and-drop images which render inline in the transcript. ([#19368](https://github.com/mastra-ai/mastra/pull/19368))

  ```ts
  await session.sendMessage({
    content: 'What is in this screenshot?',
    files: [{ data: base64Png, mediaType: 'image/png', filename: 'screenshot.png' }],
  });
  ```

- Added caller-defined dataset item identities for safe retries across all dataset storage adapters. ([#19384](https://github.com/mastra-ai/mastra/pull/19384))

  Dataset items can now include an `externalId` when calling `addItem` or `addItems`:

  ```ts
  await dataset.addItem({
    externalId: 'source-item-123',
    input: { prompt: 'Hello' },
  });
  ```

  Retrying with the same identity and payload returns the existing item. Reusing an identity with different content returns a typed conflict, including during concurrent writes. Updates and deletes preserve the identity, Spanner retries transactions without changing the outcome, and MySQL batch writes now preserve every supported dataset item field.

- Added run activity reporting to agent controller sessions. `session.state()` responses include a `running` flag so UIs can show a working indicator immediately when attaching to a session that is already mid-run, and each thread returned by `session.listThreads()` carries a `state` of `'active'` or `'idle'` (backed by the same per-thread run tracking that signal `ifIdle` delivery uses), so one listing can power activity indicators across every worktree or scope sharing a resource instead of polling each session: ([#19357](https://github.com/mastra-ai/mastra/pull/19357))

  ```ts
  const session = client.getAgentController('code').session(resourceId);

  const { running } = await session.state(); // is the session mid-run?

  const threads = await session.listThreads({ tags: { projectPath } });
  const busy = threads.filter(thread => thread.state === 'active');
  ```

### Patch Changes

- Added HTTP and client bindings for recovering an interrupted durable agent run. ([#19191](https://github.com/mastra-ai/mastra/pull/19191))

  **What changed**
  - `@mastra/server`: new `POST /agents/:agentId/recover` route. Given the id of a durable agent run that was interrupted by a deploy or crash, the server picks the run back up from where it left off and streams the rest of the response to the caller. Non-durable agents are rejected, and callers can only recover runs that belong to them (same permission and ownership rules as resuming a suspended run).
  - `@mastra/client-js`: new `agent.recover({ runId })` method that reads that stream from the browser or Node. It behaves the same as `agent.resumeStream()` — you get back a readable stream of the agent's remaining response.

  **Why**

  The underlying core API for recovering an interrupted durable agent run could previously only be called from server-side code. This adds the standard HTTP + client surface so operators can reattach to an interrupted run from a dashboard, an admin tool, or any other client, using the same auth and ownership rules as the rest of the agents API.

  **Usage**

  ```ts
  const stream = await mastraClient.getAgent('support').recover({ runId: 'run-abc123' });
  for await (const chunk of stream) {
    // render or forward the remaining agent output
  }
  ```

- Fixed streamed agent-controller error events losing their message: Error instances are now flattened before serialization so clients see the real failure reason instead of a generic "Error". ([#19258](https://github.com/mastra-ai/mastra/pull/19258))

- The tool provider authorize handler now falls back to the provider's `defaultScope` when a request does not specify a connection `scope`. Precedence is: explicit request `scope`, then the provider's `defaultScope`, then `'per-author'`. This lets a provider configured with `defaultScope: 'caller-supplied'` produce per-tenant connections through the Agent Builder connect flow, which does not send a scope. ([#19144](https://github.com/mastra-ai/mastra/pull/19144))

- Updated dependencies [[`bd6d240`](https://github.com/mastra-ai/mastra/commit/bd6d2402db93dddaef0721667e7e8a030e7c6e16), [`0111486`](https://github.com/mastra-ai/mastra/commit/01114867612593eef5cfa2fda6a1194dfedda841), [`96a3749`](https://github.com/mastra-ai/mastra/commit/96a37492235f5b8076b3e3177d83ed5a5e44a640), [`fe1bda0`](https://github.com/mastra-ai/mastra/commit/fe1bda06f6af92a694a51712db747cda1e7185f0), [`25e7c12`](https://github.com/mastra-ai/mastra/commit/25e7c126a770069ae7fb7ecf1d2adb40e017b009), [`1ce5121`](https://github.com/mastra-ai/mastra/commit/1ce512155d122bb21f47d98383e82ffbf84b39e8), [`fb8aea3`](https://github.com/mastra-ai/mastra/commit/fb8aea384291e77311be3a64ee1717320d5c3c73), [`4adc391`](https://github.com/mastra-ai/mastra/commit/4adc3911075249c352bb4832d2471922826344de), [`a5c6337`](https://github.com/mastra-ai/mastra/commit/a5c6337d23c7686c81a32ce62f550f610543a240), [`3cfc47a`](https://github.com/mastra-ai/mastra/commit/3cfc47a6b89940aadd0f46fb01ae9624a73a865d), [`2bb7817`](https://github.com/mastra-ai/mastra/commit/2bb78176112fde628483de2830528f7eee911e56), [`51d9870`](https://github.com/mastra-ai/mastra/commit/51d987032c689c2855374d0f244f5d654da809d1), [`5cab274`](https://github.com/mastra-ai/mastra/commit/5cab2744250e22d12fefa7b32637dce224233cee), [`7fa27d3`](https://github.com/mastra-ai/mastra/commit/7fa27d3b6f5ed68cd34e454a4d3ad9c482a0cfbc), [`8b97958`](https://github.com/mastra-ai/mastra/commit/8b979589f9aa59ba67cac565949475f2ffeb4ac3), [`8410541`](https://github.com/mastra-ai/mastra/commit/84105412c60ecd3bb33a9838146f59c4b588228f), [`a58dcbb`](https://github.com/mastra-ai/mastra/commit/a58dcbb546d7e1d65ebdc1f39e55f0908fcd9391), [`aa38805`](https://github.com/mastra-ai/mastra/commit/aa38805b878b827403be785eb90688d7172f5a40), [`153bd3b`](https://github.com/mastra-ai/mastra/commit/153bd3b396bdfed6b74cf43de12db8fd2d83c04a), [`45a8e65`](https://github.com/mastra-ai/mastra/commit/45a8e65e1556d1362cb3f25187023c36de26661d), [`e955965`](https://github.com/mastra-ai/mastra/commit/e955965dce575a903e37cf054d28ea99aa48785e), [`2d22570`](https://github.com/mastra-ai/mastra/commit/2d22570c7dfdd02123d0ecc529efb05ccba2d9fc), [`07bb863`](https://github.com/mastra-ai/mastra/commit/07bb8631919c6f7cf377dccd45b096e0f17fbed0), [`c8ed116`](https://github.com/mastra-ai/mastra/commit/c8ed11699f62bcac70102ab4ec84d80d20541da6), [`01b338c`](https://github.com/mastra-ai/mastra/commit/01b338c56271f0219606710e3e8b26dee27ac6c2), [`a99eae8`](https://github.com/mastra-ai/mastra/commit/a99eae8908e500c1b2d12f9d277be616b98617a5), [`860ef7e`](https://github.com/mastra-ai/mastra/commit/860ef7e77d92b63469cbe5857aa1e626197e43e9), [`17e818c`](https://github.com/mastra-ai/mastra/commit/17e818c51a958ba90641b1a959dc38faf8c034e9), [`edce8d2`](https://github.com/mastra-ai/mastra/commit/edce8d2769f19e27a05737c627af2d765472a4f8), [`8a586ec`](https://github.com/mastra-ai/mastra/commit/8a586eca9a4914f31dff6140d0d45ac375b00669), [`4451dfe`](https://github.com/mastra-ai/mastra/commit/4451dfe857428e7abcc0261a507a2e186dae6d47), [`8b7361d`](https://github.com/mastra-ai/mastra/commit/8b7361d35de68b80d05d30a74e0c69e7218fd612), [`1d39058`](https://github.com/mastra-ai/mastra/commit/1d39058e548efd691799985d5c8af2737f1c3bd2), [`3927473`](https://github.com/mastra-ai/mastra/commit/392747323ddb10c643d12be7b9ae913159dfaeed), [`dce50dc`](https://github.com/mastra-ai/mastra/commit/dce50dc9a1c1fcd0f427bb5f6250ec74910cb04b), [`fd13f8e`](https://github.com/mastra-ai/mastra/commit/fd13f8e21990f9904c3eedba3a626bb4a929cdb8), [`634caff`](https://github.com/mastra-ai/mastra/commit/634caff29a9200ad058b67d53f96d9e5832fb8a2), [`f703f87`](https://github.com/mastra-ai/mastra/commit/f703f878de072d51fda557f9c50867d8252bef05), [`3e26c87`](https://github.com/mastra-ai/mastra/commit/3e26c87de0c5bc2583b795ce6ca5889b6b161acb), [`33f2b88`](https://github.com/mastra-ai/mastra/commit/33f2b88842c09a567f906fac4cb61cd5277ced59), [`177010f`](https://github.com/mastra-ai/mastra/commit/177010ff096d2e4b28d89803be5b1a4cad2a0d6b), [`0ad646f`](https://github.com/mastra-ai/mastra/commit/0ad646f71a530f2454664299e5e01bfd13fa12e5), [`b486abf`](https://github.com/mastra-ai/mastra/commit/b486abfa2a7528c6f527e4015c819ea9fa54aaad), [`54a51e0`](https://github.com/mastra-ai/mastra/commit/54a51e0a484fe1ebad3fb1f7ef5282a075709eb7), [`c43f3a9`](https://github.com/mastra-ai/mastra/commit/c43f3a9d1efde99b38789364ba4d0ba670f430e3), [`a5008f2`](https://github.com/mastra-ai/mastra/commit/a5008f22ae710ad9402ea9f2547d8c02f74d384b), [`e2d5f37`](https://github.com/mastra-ai/mastra/commit/e2d5f373bd289be534d5f8694d34465010533df6), [`4ce0163`](https://github.com/mastra-ai/mastra/commit/4ce0163dc86e675a86809685c8ce6c49f1aeb87e), [`4378341`](https://github.com/mastra-ai/mastra/commit/43783412df5ea3dd35f5b1f6e4851e79c346fc89)]:
  - @mastra/core@1.51.0

## 1.51.0-alpha.13

### Minor Changes

- Added caller-defined dataset item identities for safe retries across all dataset storage adapters. ([#19384](https://github.com/mastra-ai/mastra/pull/19384))

  Dataset items can now include an `externalId` when calling `addItem` or `addItems`:

  ```ts
  await dataset.addItem({
    externalId: 'source-item-123',
    input: { prompt: 'Hello' },
  });
  ```

  Retrying with the same identity and payload returns the existing item. Reusing an identity with different content returns a typed conflict, including during concurrent writes. Updates and deletes preserve the identity, Spanner retries transactions without changing the outcome, and MySQL batch writes now preserve every supported dataset item field.

### Patch Changes

- Updated dependencies [[`a99eae8`](https://github.com/mastra-ai/mastra/commit/a99eae8908e500c1b2d12f9d277be616b98617a5), [`fd13f8e`](https://github.com/mastra-ai/mastra/commit/fd13f8e21990f9904c3eedba3a626bb4a929cdb8), [`f703f87`](https://github.com/mastra-ai/mastra/commit/f703f878de072d51fda557f9c50867d8252bef05), [`0ad646f`](https://github.com/mastra-ai/mastra/commit/0ad646f71a530f2454664299e5e01bfd13fa12e5)]:
  - @mastra/core@1.51.0-alpha.13

## 1.51.0-alpha.12

### Patch Changes

- Updated dependencies [[`aa38805`](https://github.com/mastra-ai/mastra/commit/aa38805b878b827403be785eb90688d7172f5a40), [`2d22570`](https://github.com/mastra-ai/mastra/commit/2d22570c7dfdd02123d0ecc529efb05ccba2d9fc), [`4378341`](https://github.com/mastra-ai/mastra/commit/43783412df5ea3dd35f5b1f6e4851e79c346fc89)]:
  - @mastra/core@1.51.0-alpha.12

## 1.51.0-alpha.11

### Patch Changes

- Updated dependencies [[`45a8e65`](https://github.com/mastra-ai/mastra/commit/45a8e65e1556d1362cb3f25187023c36de26661d), [`c8ed116`](https://github.com/mastra-ai/mastra/commit/c8ed11699f62bcac70102ab4ec84d80d20541da6), [`33f2b88`](https://github.com/mastra-ai/mastra/commit/33f2b88842c09a567f906fac4cb61cd5277ced59)]:
  - @mastra/core@1.51.0-alpha.11

## 1.51.0-alpha.10

### Patch Changes

- Updated dependencies [[`4adc391`](https://github.com/mastra-ai/mastra/commit/4adc3911075249c352bb4832d2471922826344de), [`b486abf`](https://github.com/mastra-ai/mastra/commit/b486abfa2a7528c6f527e4015c819ea9fa54aaad)]:
  - @mastra/core@1.51.0-alpha.10

## 1.51.0-alpha.9

### Patch Changes

- Updated dependencies [[`edce8d2`](https://github.com/mastra-ai/mastra/commit/edce8d2769f19e27a05737c627af2d765472a4f8)]:
  - @mastra/core@1.51.0-alpha.9

## 1.51.0-alpha.8

### Minor Changes

- Added image attachment support to agent controller chat. You can now send images (and other files) with a message, and the Mastra Code web chat lets you attach, paste, or drag-and-drop images which render inline in the transcript. ([#19368](https://github.com/mastra-ai/mastra/pull/19368))

  ```ts
  await session.sendMessage({
    content: 'What is in this screenshot?',
    files: [{ data: base64Png, mediaType: 'image/png', filename: 'screenshot.png' }],
  });
  ```

### Patch Changes

- Updated dependencies [[`bd6d240`](https://github.com/mastra-ai/mastra/commit/bd6d2402db93dddaef0721667e7e8a030e7c6e16), [`0111486`](https://github.com/mastra-ai/mastra/commit/01114867612593eef5cfa2fda6a1194dfedda841), [`96a3749`](https://github.com/mastra-ai/mastra/commit/96a37492235f5b8076b3e3177d83ed5a5e44a640), [`3e26c87`](https://github.com/mastra-ai/mastra/commit/3e26c87de0c5bc2583b795ce6ca5889b6b161acb), [`a5008f2`](https://github.com/mastra-ai/mastra/commit/a5008f22ae710ad9402ea9f2547d8c02f74d384b)]:
  - @mastra/core@1.51.0-alpha.8

## 1.51.0-alpha.7

### Minor Changes

- Added an optional session scope to the agent controller API so clients can address independent sessions that share one resource (for example one session per git worktree). ([#19357](https://github.com/mastra-ai/mastra/pull/19357))

  Session routes now accept a `sessionScope` query parameter, and `AgentController.session()` in the client accepts a scope that travels on every request:

  ```ts
  const controller = client.getAgentController('code');

  // Address the worktree's own session instead of the shared one:
  const session = controller.session('repo-123', '/worktrees/feature-a');
  await session.create({ tags: { projectPath: '/worktrees/feature-a' } });
  await session.sendMessage('hello');
  ```

  Requests without a scope behave exactly as before.

- Added run activity reporting to agent controller sessions. `session.state()` responses include a `running` flag so UIs can show a working indicator immediately when attaching to a session that is already mid-run, and each thread returned by `session.listThreads()` carries a `state` of `'active'` or `'idle'` (backed by the same per-thread run tracking that signal `ifIdle` delivery uses), so one listing can power activity indicators across every worktree or scope sharing a resource instead of polling each session: ([#19357](https://github.com/mastra-ai/mastra/pull/19357))

  ```ts
  const session = client.getAgentController('code').session(resourceId);

  const { running } = await session.state(); // is the session mid-run?

  const threads = await session.listThreads({ tags: { projectPath } });
  const busy = threads.filter(thread => thread.state === 'active');
  ```

### Patch Changes

- Updated dependencies [[`25e7c12`](https://github.com/mastra-ai/mastra/commit/25e7c126a770069ae7fb7ecf1d2adb40e017b009), [`1ce5121`](https://github.com/mastra-ai/mastra/commit/1ce512155d122bb21f47d98383e82ffbf84b39e8), [`3cfc47a`](https://github.com/mastra-ai/mastra/commit/3cfc47a6b89940aadd0f46fb01ae9624a73a865d), [`2bb7817`](https://github.com/mastra-ai/mastra/commit/2bb78176112fde628483de2830528f7eee911e56), [`51d9870`](https://github.com/mastra-ai/mastra/commit/51d987032c689c2855374d0f244f5d654da809d1), [`5cab274`](https://github.com/mastra-ai/mastra/commit/5cab2744250e22d12fefa7b32637dce224233cee), [`7fa27d3`](https://github.com/mastra-ai/mastra/commit/7fa27d3b6f5ed68cd34e454a4d3ad9c482a0cfbc), [`a58dcbb`](https://github.com/mastra-ai/mastra/commit/a58dcbb546d7e1d65ebdc1f39e55f0908fcd9391), [`153bd3b`](https://github.com/mastra-ai/mastra/commit/153bd3b396bdfed6b74cf43de12db8fd2d83c04a), [`07bb863`](https://github.com/mastra-ai/mastra/commit/07bb8631919c6f7cf377dccd45b096e0f17fbed0), [`8a586ec`](https://github.com/mastra-ai/mastra/commit/8a586eca9a4914f31dff6140d0d45ac375b00669), [`3927473`](https://github.com/mastra-ai/mastra/commit/392747323ddb10c643d12be7b9ae913159dfaeed), [`dce50dc`](https://github.com/mastra-ai/mastra/commit/dce50dc9a1c1fcd0f427bb5f6250ec74910cb04b), [`634caff`](https://github.com/mastra-ai/mastra/commit/634caff29a9200ad058b67d53f96d9e5832fb8a2)]:
  - @mastra/core@1.51.0-alpha.7

## 1.51.0-alpha.6

### Patch Changes

- Added HTTP and client bindings for recovering an interrupted durable agent run. ([#19191](https://github.com/mastra-ai/mastra/pull/19191))

  **What changed**
  - `@mastra/server`: new `POST /agents/:agentId/recover` route. Given the id of a durable agent run that was interrupted by a deploy or crash, the server picks the run back up from where it left off and streams the rest of the response to the caller. Non-durable agents are rejected, and callers can only recover runs that belong to them (same permission and ownership rules as resuming a suspended run).
  - `@mastra/client-js`: new `agent.recover({ runId })` method that reads that stream from the browser or Node. It behaves the same as `agent.resumeStream()` — you get back a readable stream of the agent's remaining response.

  **Why**

  The underlying core API for recovering an interrupted durable agent run could previously only be called from server-side code. This adds the standard HTTP + client surface so operators can reattach to an interrupted run from a dashboard, an admin tool, or any other client, using the same auth and ownership rules as the rest of the agents API.

  **Usage**

  ```ts
  const stream = await mastraClient.getAgent('support').recover({ runId: 'run-abc123' });
  for await (const chunk of stream) {
    // render or forward the remaining agent output
  }
  ```

- Updated dependencies [[`e2d5f37`](https://github.com/mastra-ai/mastra/commit/e2d5f373bd289be534d5f8694d34465010533df6)]:
  - @mastra/core@1.51.0-alpha.6

## 1.51.0-alpha.5

### Patch Changes

- Fixed streamed agent-controller error events losing their message: Error instances are now flattened before serialization so clients see the real failure reason instead of a generic "Error". ([#19258](https://github.com/mastra-ai/mastra/pull/19258))

- The tool provider authorize handler now falls back to the provider's `defaultScope` when a request does not specify a connection `scope`. Precedence is: explicit request `scope`, then the provider's `defaultScope`, then `'per-author'`. This lets a provider configured with `defaultScope: 'caller-supplied'` produce per-tenant connections through the Agent Builder connect flow, which does not send a scope. ([#19144](https://github.com/mastra-ai/mastra/pull/19144))

- Updated dependencies [[`fb8aea3`](https://github.com/mastra-ai/mastra/commit/fb8aea384291e77311be3a64ee1717320d5c3c73), [`4ce0163`](https://github.com/mastra-ai/mastra/commit/4ce0163dc86e675a86809685c8ce6c49f1aeb87e)]:
  - @mastra/core@1.51.0-alpha.5

## 1.51.0-alpha.4

### Patch Changes

- Updated dependencies [[`a5c6337`](https://github.com/mastra-ai/mastra/commit/a5c6337d23c7686c81a32ce62f550f610543a240), [`8b97958`](https://github.com/mastra-ai/mastra/commit/8b979589f9aa59ba67cac565949475f2ffeb4ac3), [`8410541`](https://github.com/mastra-ai/mastra/commit/84105412c60ecd3bb33a9838146f59c4b588228f), [`01b338c`](https://github.com/mastra-ai/mastra/commit/01b338c56271f0219606710e3e8b26dee27ac6c2), [`8b7361d`](https://github.com/mastra-ai/mastra/commit/8b7361d35de68b80d05d30a74e0c69e7218fd612), [`c43f3a9`](https://github.com/mastra-ai/mastra/commit/c43f3a9d1efde99b38789364ba4d0ba670f430e3)]:
  - @mastra/core@1.51.0-alpha.4

## 1.51.0-alpha.3

### Patch Changes

- Updated dependencies [[`177010f`](https://github.com/mastra-ai/mastra/commit/177010ff096d2e4b28d89803be5b1a4cad2a0d6b), [`54a51e0`](https://github.com/mastra-ai/mastra/commit/54a51e0a484fe1ebad3fb1f7ef5282a075709eb7)]:
  - @mastra/core@1.51.0-alpha.3

## 1.51.0-alpha.2

### Patch Changes

- Updated dependencies [[`e955965`](https://github.com/mastra-ai/mastra/commit/e955965dce575a903e37cf054d28ea99aa48785e), [`860ef7e`](https://github.com/mastra-ai/mastra/commit/860ef7e77d92b63469cbe5857aa1e626197e43e9), [`17e818c`](https://github.com/mastra-ai/mastra/commit/17e818c51a958ba90641b1a959dc38faf8c034e9), [`4451dfe`](https://github.com/mastra-ai/mastra/commit/4451dfe857428e7abcc0261a507a2e186dae6d47), [`1d39058`](https://github.com/mastra-ai/mastra/commit/1d39058e548efd691799985d5c8af2737f1c3bd2)]:
  - @mastra/core@1.51.0-alpha.2

## 1.50.2-alpha.1

### Patch Changes

- Updated dependencies:
  - @mastra/core@1.50.2-alpha.1

## 1.50.2-alpha.0

### Patch Changes

- Updated dependencies [[`fe1bda0`](https://github.com/mastra-ai/mastra/commit/fe1bda06f6af92a694a51712db747cda1e7185f0)]:
  - @mastra/core@1.50.2-alpha.0

## 1.50.1

### Patch Changes

- Updated dependencies [[`e900f25`](https://github.com/mastra-ai/mastra/commit/e900f25dfe2c9237f15b26cb109ac55aa9de3000), [`e8eaf3a`](https://github.com/mastra-ai/mastra/commit/e8eaf3aea09d51c131b5d369aee459442f416efc), [`d1c930f`](https://github.com/mastra-ai/mastra/commit/d1c930f713d1de09d5f3cd665cb79a8b7ebd7ec7), [`02634f7`](https://github.com/mastra-ai/mastra/commit/02634f700051e014a125d0d10165e3c9b8414e95), [`a940148`](https://github.com/mastra-ai/mastra/commit/a9401483e1bfe85c18a6e73d33c5949239d65a92)]:
  - @mastra/core@1.50.1

## 1.50.1-alpha.2

### Patch Changes

- Updated dependencies [[`a940148`](https://github.com/mastra-ai/mastra/commit/a9401483e1bfe85c18a6e73d33c5949239d65a92)]:
  - @mastra/core@1.50.1-alpha.2

## 1.50.1-alpha.1

### Patch Changes

- Updated dependencies [[`e8eaf3a`](https://github.com/mastra-ai/mastra/commit/e8eaf3aea09d51c131b5d369aee459442f416efc), [`d1c930f`](https://github.com/mastra-ai/mastra/commit/d1c930f713d1de09d5f3cd665cb79a8b7ebd7ec7), [`02634f7`](https://github.com/mastra-ai/mastra/commit/02634f700051e014a125d0d10165e3c9b8414e95)]:
  - @mastra/core@1.50.1-alpha.1

## 1.50.1-alpha.0

### Patch Changes

- Updated dependencies [[`e900f25`](https://github.com/mastra-ai/mastra/commit/e900f25dfe2c9237f15b26cb109ac55aa9de3000)]:
  - @mastra/core@1.50.1-alpha.0

## 1.50.0

### Minor Changes

- **Merged `/api/heartbeats` into `/api/schedules`.** The server now exposes one unified schedules API that covers both agent schedules (previously heartbeats) and workflow schedules. ([#18874](https://github.com/mastra-ai/mastra/pull/18874))
  - `GET /api/schedules` lists both kinds and supports `agentId`, `workflowId`, `status`, `threadId`, `resourceId`, and `name` filters.
  - `POST /api/schedules` creates an agent schedule (body with `agentId`, `cron`, `prompt`) or a workflow schedule (body with `workflowId`, `cron`).
  - `PATCH`, `DELETE`, and `POST .../pause`, `.../resume`, `.../run` work for both kinds.
  - The `/api/heartbeats/*` routes were removed. Use `/api/schedules/*` instead.

  ```sh
  curl -X POST http://localhost:4111/api/schedules \
    -H 'Content-Type: application/json' \
    -d '{"agentId":"chef-agent","cron":"0 9 * * *","prompt":"Suggest a dish of the day"}'
  ```

### Patch Changes

- Added workspace-level provider registry to MastraEditor. You can now register WorkspaceProvider factories that build complete Workspace instances as a single unit, instead of composing from separate filesystem and sandbox providers. Stored agents can reference a workspace provider via `{ type: 'provider', provider: 'my-cloud', config: { ... } }` and the editor will call the registered factory during agent hydration. ([#18781](https://github.com/mastra-ai/mastra/pull/18781))

  ```ts
  import { MastraEditor } from '@mastra/editor';
  import { Workspace } from '@mastra/core/workspace';

  const editor = new MastraEditor({
    workspaces: {
      'my-cloud': {
        id: 'my-cloud',
        name: 'My Cloud Workspace',
        createWorkspace: config =>
          new Workspace({
            id: 'cloud-ws',
            name: 'Cloud WS',
            filesystem: new MyCloudFilesystem(config),
            sandbox: new MyCloudSandbox(config),
          }),
      },
    },
  });

  // Stored agent workspace reference using the provider:
  // { type: 'provider', provider: 'my-cloud', config: { region: 'us-east-1' } }
  ```

- Fixed AgentController route handlers dropping the request context set by server middleware. Identity values set on the request context in `server.middleware` (for example a tenant id) now reach dynamic instructions and tools when an agent is driven through the AgentController API, matching the behavior of the plain agent routes. This applies to the send-message, steer, follow-up, tool-approval, and tool-suspension routes. Fixes [#18916](https://github.com/mastra-ai/mastra/issues/18916). ([#18918](https://github.com/mastra-ai/mastra/pull/18918))

- Update `@mastra/core` peer dependency for the unified schedules API ([#18874](https://github.com/mastra-ai/mastra/pull/18874))

- Updated dependencies [[`b291760`](https://github.com/mastra-ai/mastra/commit/b291760df9d6c7e4fc72606c8f0a4af2cf6e946c), [`3ffb8b7`](https://github.com/mastra-ai/mastra/commit/3ffb8b720e90f5e6977129ec1f6707d43c2bebe0), [`6ef59fe`](https://github.com/mastra-ai/mastra/commit/6ef59fef1da52ed8da5fbb2a892c71cf4fb6c739), [`4039488`](https://github.com/mastra-ai/mastra/commit/403948898af7293198d9e8b3e7fb47f623c78b94), [`29b7ea6`](https://github.com/mastra-ai/mastra/commit/29b7ea64e72b5523d5bdcbd34ee03d2b854d54e1), [`b2c9d70`](https://github.com/mastra-ai/mastra/commit/b2c9d70757207fb01a9069549e69b6f0d73a6636), [`a51c63d`](https://github.com/mastra-ai/mastra/commit/a51c63d8ee639e4daeba2a0be093efa6a1b5e52f), [`252f63d`](https://github.com/mastra-ai/mastra/commit/252f63d8fec723955adb2202be2f01a75ad0e69c), [`5ea76a7`](https://github.com/mastra-ai/mastra/commit/5ea76a723d966c72da9aa3ab30ae20276e049765), [`6445560`](https://github.com/mastra-ai/mastra/commit/6445560327045d20b239585fc63fed72e9ce36ec), [`e2b9f33`](https://github.com/mastra-ai/mastra/commit/e2b9f33456fd638eca555f9466c6519d8d049666), [`10959d5`](https://github.com/mastra-ai/mastra/commit/10959d509d824f682d40ff96e05ee044aec3b0e5), [`c547a77`](https://github.com/mastra-ai/mastra/commit/c547a7729bdf64dfc2df29c965046c0712a18f10), [`a0085fa`](https://github.com/mastra-ai/mastra/commit/a0085fa0934e52c37c8c8b3d75a6bb5cd199af36), [`a2ba369`](https://github.com/mastra-ai/mastra/commit/a2ba369e796dfab610f41c6875965b488272fa55), [`ffc3c17`](https://github.com/mastra-ai/mastra/commit/ffc3c17274ea17c11aa6f73d3140649cd7fc8abc), [`81542c1`](https://github.com/mastra-ai/mastra/commit/81542c1835c35bc32f2ce4fa9136ee11993cd299), [`3908e53`](https://github.com/mastra-ai/mastra/commit/3908e53ce04bbea04f5e0c097d7aa298c35fabee), [`cb24ce7`](https://github.com/mastra-ai/mastra/commit/cb24ce76bd16ca88eb6a963f6277f8780e703029), [`02705fd`](https://github.com/mastra-ai/mastra/commit/02705fd2f5a9062210d64ea061adeeb10dc9452e), [`ae51e81`](https://github.com/mastra-ai/mastra/commit/ae51e818825582d42500338dfc1929a082eff0ba), [`6f304ef`](https://github.com/mastra-ai/mastra/commit/6f304ef319e99725e884bdb8d3193c001b6e5964), [`5f9858f`](https://github.com/mastra-ai/mastra/commit/5f9858f791f1137ca7d52d23559fb4568f7a9026)]:
  - @mastra/core@1.50.0

## 1.50.0-alpha.5

### Patch Changes

- Updated dependencies [[`a0085fa`](https://github.com/mastra-ai/mastra/commit/a0085fa0934e52c37c8c8b3d75a6bb5cd199af36)]:
  - @mastra/core@1.50.0-alpha.5

## 1.50.0-alpha.4

### Patch Changes

- Updated dependencies [[`4039488`](https://github.com/mastra-ai/mastra/commit/403948898af7293198d9e8b3e7fb47f623c78b94), [`b2c9d70`](https://github.com/mastra-ai/mastra/commit/b2c9d70757207fb01a9069549e69b6f0d73a6636), [`252f63d`](https://github.com/mastra-ai/mastra/commit/252f63d8fec723955adb2202be2f01a75ad0e69c), [`c547a77`](https://github.com/mastra-ai/mastra/commit/c547a7729bdf64dfc2df29c965046c0712a18f10), [`81542c1`](https://github.com/mastra-ai/mastra/commit/81542c1835c35bc32f2ce4fa9136ee11993cd299), [`cb24ce7`](https://github.com/mastra-ai/mastra/commit/cb24ce76bd16ca88eb6a963f6277f8780e703029), [`5f9858f`](https://github.com/mastra-ai/mastra/commit/5f9858f791f1137ca7d52d23559fb4568f7a9026)]:
  - @mastra/core@1.50.0-alpha.4

## 1.50.0-alpha.3

### Minor Changes

- **Merged `/api/heartbeats` into `/api/schedules`.** The server now exposes one unified schedules API that covers both agent schedules (previously heartbeats) and workflow schedules. ([#18874](https://github.com/mastra-ai/mastra/pull/18874))
  - `GET /api/schedules` lists both kinds and supports `agentId`, `workflowId`, `status`, `threadId`, `resourceId`, and `name` filters.
  - `POST /api/schedules` creates an agent schedule (body with `agentId`, `cron`, `prompt`) or a workflow schedule (body with `workflowId`, `cron`).
  - `PATCH`, `DELETE`, and `POST .../pause`, `.../resume`, `.../run` work for both kinds.
  - The `/api/heartbeats/*` routes were removed. Use `/api/schedules/*` instead.

  ```sh
  curl -X POST http://localhost:4111/api/schedules \
    -H 'Content-Type: application/json' \
    -d '{"agentId":"chef-agent","cron":"0 9 * * *","prompt":"Suggest a dish of the day"}'
  ```

### Patch Changes

- Fixed AgentController route handlers dropping the request context set by server middleware. Identity values set on the request context in `server.middleware` (for example a tenant id) now reach dynamic instructions and tools when an agent is driven through the AgentController API, matching the behavior of the plain agent routes. This applies to the send-message, steer, follow-up, tool-approval, and tool-suspension routes. Fixes [#18916](https://github.com/mastra-ai/mastra/issues/18916). ([#18918](https://github.com/mastra-ai/mastra/pull/18918))

- Update `@mastra/core` peer dependency for the unified schedules API ([#18874](https://github.com/mastra-ai/mastra/pull/18874))

- Updated dependencies [[`b291760`](https://github.com/mastra-ai/mastra/commit/b291760df9d6c7e4fc72606c8f0a4af2cf6e946c), [`29b7ea6`](https://github.com/mastra-ai/mastra/commit/29b7ea64e72b5523d5bdcbd34ee03d2b854d54e1), [`10959d5`](https://github.com/mastra-ai/mastra/commit/10959d509d824f682d40ff96e05ee044aec3b0e5), [`ffc3c17`](https://github.com/mastra-ai/mastra/commit/ffc3c17274ea17c11aa6f73d3140649cd7fc8abc), [`3908e53`](https://github.com/mastra-ai/mastra/commit/3908e53ce04bbea04f5e0c097d7aa298c35fabee)]:
  - @mastra/core@1.50.0-alpha.3

## 1.50.0-alpha.2

### Patch Changes

- Updated dependencies [[`a51c63d`](https://github.com/mastra-ai/mastra/commit/a51c63d8ee639e4daeba2a0be093efa6a1b5e52f), [`02705fd`](https://github.com/mastra-ai/mastra/commit/02705fd2f5a9062210d64ea061adeeb10dc9452e)]:
  - @mastra/core@1.50.0-alpha.2

## 1.50.0-alpha.1

### Patch Changes

- Updated dependencies [[`3ffb8b7`](https://github.com/mastra-ai/mastra/commit/3ffb8b720e90f5e6977129ec1f6707d43c2bebe0), [`5ea76a7`](https://github.com/mastra-ai/mastra/commit/5ea76a723d966c72da9aa3ab30ae20276e049765), [`6445560`](https://github.com/mastra-ai/mastra/commit/6445560327045d20b239585fc63fed72e9ce36ec), [`a2ba369`](https://github.com/mastra-ai/mastra/commit/a2ba369e796dfab610f41c6875965b488272fa55), [`ae51e81`](https://github.com/mastra-ai/mastra/commit/ae51e818825582d42500338dfc1929a082eff0ba), [`6f304ef`](https://github.com/mastra-ai/mastra/commit/6f304ef319e99725e884bdb8d3193c001b6e5964)]:
  - @mastra/core@1.50.0-alpha.1

## 1.50.0-alpha.0

### Patch Changes

- Added workspace-level provider registry to MastraEditor. You can now register WorkspaceProvider factories that build complete Workspace instances as a single unit, instead of composing from separate filesystem and sandbox providers. Stored agents can reference a workspace provider via `{ type: 'provider', provider: 'my-cloud', config: { ... } }` and the editor will call the registered factory during agent hydration. ([#18781](https://github.com/mastra-ai/mastra/pull/18781))

  ```ts
  import { MastraEditor } from '@mastra/editor';
  import { Workspace } from '@mastra/core/workspace';

  const editor = new MastraEditor({
    workspaces: {
      'my-cloud': {
        id: 'my-cloud',
        name: 'My Cloud Workspace',
        createWorkspace: config =>
          new Workspace({
            id: 'cloud-ws',
            name: 'Cloud WS',
            filesystem: new MyCloudFilesystem(config),
            sandbox: new MyCloudSandbox(config),
          }),
      },
    },
  });

  // Stored agent workspace reference using the provider:
  // { type: 'provider', provider: 'my-cloud', config: { region: 'us-east-1' } }
  ```

- Updated dependencies [[`6ef59fe`](https://github.com/mastra-ai/mastra/commit/6ef59fef1da52ed8da5fbb2a892c71cf4fb6c739), [`e2b9f33`](https://github.com/mastra-ai/mastra/commit/e2b9f33456fd638eca555f9466c6519d8d049666)]:
  - @mastra/core@1.50.0-alpha.0

## 1.49.0

### Minor Changes

- Added optional `organizationId` and `projectId` query parameters to the dataset routes. ([#18750](https://github.com/mastra-ai/mastra/pull/18750))

  `GET /datasets/:datasetId`, `PATCH /datasets/:datasetId`, and `DELETE /datasets/:datasetId` now accept optional tenancy query parameters. When provided, they are forwarded to `mastra.datasets.get` / `.delete` and the operation returns 404 if the dataset does not belong to the requested tenant. Requests that omit the query parameters keep their existing behavior.

  **Example**

  ```
  GET /datasets/abc123?organizationId=org_a&projectId=proj_1
  DELETE /datasets/abc123?organizationId=org_a
  ```

### Patch Changes

- Added optional tenancy arguments to `getDataset`, `updateDataset`, and `deleteDataset`. ([#18750](https://github.com/mastra-ai/mastra/pull/18750))

  You can now pass `organizationId` and `projectId` to scope dataset reads, updates, and deletes to a specific tenant. Reads and updates against a dataset in a different tenant throw `DATASET_NOT_FOUND` (surfaced as a 404 over HTTP). Deletes silently no-op on a tenancy mismatch — matching the existing "delete non-existent id is a no-op" semantics so cross-tenant existence is never leaked via error timing or status.

  **Example**

  ```ts
  // Before
  await client.getDataset('abc123');
  await client.deleteDataset('abc123');
  await client.updateDataset({ id: 'abc123', name: 'renamed' });

  // After — scope to a tenant
  await client.getDataset('abc123', { organizationId: 'org_a', projectId: 'proj_1' });
  await client.deleteDataset('abc123', { organizationId: 'org_a' });
  await client.updateDataset({ id: 'abc123', name: 'renamed', organizationId: 'org_a' });
  ```

- Fixed a TypeScript error where auth provider instances (for example `new MastraAuthWorkos()`) could not be assigned to `server.auth` or `studio.auth`, failing with `Property '#private' is missing` (#18682). ([#18796](https://github.com/mastra-ai/mastra/pull/18796))

  Auth providers are now typed with a new structural `IMastraAuthProvider` interface (exported from `@mastra/core/server` and `@mastra/auth`), so provider packages no longer need a shared class identity with `@mastra/core`. `CompositeAuth` also accepts any `IMastraAuthProvider` implementation. No code changes are required:

  ```typescript
  import { Mastra } from '@mastra/core';
  import { MastraAuthWorkos } from '@mastra/auth-workos';

  // Previously failed to compile with TS2322, now works without casts
  export const mastra = new Mastra({
    server: {
      auth: new MastraAuthWorkos(),
    },
  });
  ```

- Fixed a cross-tenant data-access issue on datasets by scoping `DatasetsManager.get` and `DatasetsManager.delete` to tenancy filters. ([#18750](https://github.com/mastra-ai/mastra/pull/18750))

  Previously `get({ id })` and `delete({ id })` looked up a dataset by its primary key alone. Any caller who knew a dataset id could read or delete it regardless of which `organizationId` / `projectId` it belonged to. This is now closed at the storage layer via a scoped SQL predicate (option (a) — no fetch-then-assert).

  **What changed**
  - `DatasetsManager.get` and `DatasetsManager.delete` accept optional `organizationId` and `projectId`.
  - The tenancy is stashed on the returned `Dataset` handle and forwarded to every downstream storage call (`getDetails`, `update`, `addItem`, item batch ops, `startExperimentAsync`).
  - The abstract storage contract (`getDatasetById`, `deleteDataset`) gained an optional `filters?: DatasetTenancyFilters` arg.
  - Item-mutation inputs (`AddDatasetItemInput`, `UpdateDatasetItemInput`, `BatchInsertItemsInput`, `BatchDeleteItemsInput`) and `UpdateDatasetInput` accept optional `filters` for the internal existence check.

  **Behavior**
  - Omitting tenancy preserves the existing behavior (no predicate added) — fully backwards compatible.
  - On tenancy mismatch, `get` throws NOT_FOUND (returns null at the storage layer) and `delete` is a silent no-op — matching how a missing id already behaves, so existence does not leak through error timing or messages.

  **Example**

  ```ts
  // Before
  const ds = await mastra.datasets.get({ id });
  await mastra.datasets.delete({ id });

  // After — scope to a tenant
  const ds = await mastra.datasets.get({ id, organizationId, projectId });
  await mastra.datasets.delete({ id, organizationId, projectId });
  ```

- Scoped `getDatasetById` and `deleteDataset` to tenancy filters when the caller passes `organizationId` / `projectId`. ([#18750](https://github.com/mastra-ai/mastra/pull/18750))

  The adapters now push the tenancy predicate into the SQL/query when the new optional `filters` argument is present. Legacy calls that omit tenancy are unchanged. On mismatch, `getDatasetById` returns `null` and `deleteDataset` is a silent no-op — the cascade delete (dataset items and versions) is gated by a scoped parent pre-check, so cross-tenant data is never touched.

- Updated dependencies [[`700619b`](https://github.com/mastra-ai/mastra/commit/700619b61d572e592cbaaf758121d168844ca4d2), [`0f69865`](https://github.com/mastra-ai/mastra/commit/0f69865aced225d98eac812e22699dc445ee18cb), [`9250acd`](https://github.com/mastra-ai/mastra/commit/9250acd1357f0f1f33d0dcca16f9655084c58eca), [`0c3d4bc`](https://github.com/mastra-ai/mastra/commit/0c3d4bcae13ea3699d379403e6f350d5cf4efe9f), [`cc440a3`](https://github.com/mastra-ai/mastra/commit/cc440a39400d8ce06655462b26c1666a1b3d4320), [`6a61846`](https://github.com/mastra-ai/mastra/commit/6a61846eeda29fb714549b70f1bee2bf6b141c44), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748), [`17369b2`](https://github.com/mastra-ai/mastra/commit/17369b25250561e9ed994ae509be1d15bfb33bcb), [`c64c2a8`](https://github.com/mastra-ai/mastra/commit/c64c2a8503a50252f9ca6b8e8c54cadee31b92a2), [`bcae929`](https://github.com/mastra-ai/mastra/commit/bcae929945cbf265bd9f327cc715ecafa072b5b9), [`ea6327b`](https://github.com/mastra-ai/mastra/commit/ea6327ba2d63ca647804bc97b347e03a58617162), [`3439fa8`](https://github.com/mastra-ai/mastra/commit/3439fa836ecfcaa257b40c20b30ac2a8be22e9ea), [`85107f2`](https://github.com/mastra-ai/mastra/commit/85107f2758b527147fccbedff962961927c2d3b8), [`b33822e`](https://github.com/mastra-ai/mastra/commit/b33822e8d470884954b02f7b0745407ee4ef74b1), [`06e2680`](https://github.com/mastra-ai/mastra/commit/06e26806b51d2cbd858afdc66daa2b86ff3ba64a), [`06ff9e0`](https://github.com/mastra-ai/mastra/commit/06ff9e0befd1d642ab87ff749285ee4091205c7e), [`d5c11e3`](https://github.com/mastra-ai/mastra/commit/d5c11e3ba5045969caa7272a7bd1fd141c93ab6c), [`7f5e1ff`](https://github.com/mastra-ai/mastra/commit/7f5e1ff695a92f672bb3976363925d1e9136b54a), [`ff80671`](https://github.com/mastra-ai/mastra/commit/ff8067185e208b27198b4e5b71803013175c3643), [`b8375c1`](https://github.com/mastra-ai/mastra/commit/b8375c1f8fe905df8ae2ae9a893bb365f17aec4e), [`dab1257`](https://github.com/mastra-ai/mastra/commit/dab1257b64e4ed576dc5038bb7a3f7072338bc9f), [`1240f05`](https://github.com/mastra-ai/mastra/commit/1240f051c8e5371f1c014448bf37b1a1b9a05e47), [`705ff39`](https://github.com/mastra-ai/mastra/commit/705ff3969e57214ff2fdaf3815d751dd558886ed), [`e6fbd5b`](https://github.com/mastra-ai/mastra/commit/e6fbd5bfdc28e92c0c0433f29aa1bc152d3430f6), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`6f2026c`](https://github.com/mastra-ai/mastra/commit/6f2026cdf114ff1e21e49133ca774ec7d5085059), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748), [`003f35d`](https://github.com/mastra-ai/mastra/commit/003f35d19e07b23b4bacc591c8bc0c59b42124ae), [`f890eda`](https://github.com/mastra-ai/mastra/commit/f890eda2c8a2ae83d9b30bc6d85842f93b6c266b), [`1340fb7`](https://github.com/mastra-ai/mastra/commit/1340fb76262a3ca062130aa71859f07257a0a5a4)]:
  - @mastra/core@1.49.0

## 1.49.0-alpha.5

### Minor Changes

- Added optional `organizationId` and `projectId` query parameters to the dataset routes. ([#18750](https://github.com/mastra-ai/mastra/pull/18750))

  `GET /datasets/:datasetId`, `PATCH /datasets/:datasetId`, and `DELETE /datasets/:datasetId` now accept optional tenancy query parameters. When provided, they are forwarded to `mastra.datasets.get` / `.delete` and the operation returns 404 if the dataset does not belong to the requested tenant. Requests that omit the query parameters keep their existing behavior.

  **Example**

  ```
  GET /datasets/abc123?organizationId=org_a&projectId=proj_1
  DELETE /datasets/abc123?organizationId=org_a
  ```

### Patch Changes

- Added optional tenancy arguments to `getDataset`, `updateDataset`, and `deleteDataset`. ([#18750](https://github.com/mastra-ai/mastra/pull/18750))

  You can now pass `organizationId` and `projectId` to scope dataset reads, updates, and deletes to a specific tenant. Reads and updates against a dataset in a different tenant throw `DATASET_NOT_FOUND` (surfaced as a 404 over HTTP). Deletes silently no-op on a tenancy mismatch — matching the existing "delete non-existent id is a no-op" semantics so cross-tenant existence is never leaked via error timing or status.

  **Example**

  ```ts
  // Before
  await client.getDataset('abc123');
  await client.deleteDataset('abc123');
  await client.updateDataset({ id: 'abc123', name: 'renamed' });

  // After — scope to a tenant
  await client.getDataset('abc123', { organizationId: 'org_a', projectId: 'proj_1' });
  await client.deleteDataset('abc123', { organizationId: 'org_a' });
  await client.updateDataset({ id: 'abc123', name: 'renamed', organizationId: 'org_a' });
  ```

- Fixed a cross-tenant data-access issue on datasets by scoping `DatasetsManager.get` and `DatasetsManager.delete` to tenancy filters. ([#18750](https://github.com/mastra-ai/mastra/pull/18750))

  Previously `get({ id })` and `delete({ id })` looked up a dataset by its primary key alone. Any caller who knew a dataset id could read or delete it regardless of which `organizationId` / `projectId` it belonged to. This is now closed at the storage layer via a scoped SQL predicate (option (a) — no fetch-then-assert).

  **What changed**
  - `DatasetsManager.get` and `DatasetsManager.delete` accept optional `organizationId` and `projectId`.
  - The tenancy is stashed on the returned `Dataset` handle and forwarded to every downstream storage call (`getDetails`, `update`, `addItem`, item batch ops, `startExperimentAsync`).
  - The abstract storage contract (`getDatasetById`, `deleteDataset`) gained an optional `filters?: DatasetTenancyFilters` arg.
  - Item-mutation inputs (`AddDatasetItemInput`, `UpdateDatasetItemInput`, `BatchInsertItemsInput`, `BatchDeleteItemsInput`) and `UpdateDatasetInput` accept optional `filters` for the internal existence check.

  **Behavior**
  - Omitting tenancy preserves the existing behavior (no predicate added) — fully backwards compatible.
  - On tenancy mismatch, `get` throws NOT_FOUND (returns null at the storage layer) and `delete` is a silent no-op — matching how a missing id already behaves, so existence does not leak through error timing or messages.

  **Example**

  ```ts
  // Before
  const ds = await mastra.datasets.get({ id });
  await mastra.datasets.delete({ id });

  // After — scope to a tenant
  const ds = await mastra.datasets.get({ id, organizationId, projectId });
  await mastra.datasets.delete({ id, organizationId, projectId });
  ```

- Scoped `getDatasetById` and `deleteDataset` to tenancy filters when the caller passes `organizationId` / `projectId`. ([#18750](https://github.com/mastra-ai/mastra/pull/18750))

  The adapters now push the tenancy predicate into the SQL/query when the new optional `filters` argument is present. Legacy calls that omit tenancy are unchanged. On mismatch, `getDatasetById` returns `null` and `deleteDataset` is a silent no-op — the cascade delete (dataset items and versions) is gated by a scoped parent pre-check, so cross-tenant data is never touched.

- Updated dependencies [[`9250acd`](https://github.com/mastra-ai/mastra/commit/9250acd1357f0f1f33d0dcca16f9655084c58eca), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748), [`c64c2a8`](https://github.com/mastra-ai/mastra/commit/c64c2a8503a50252f9ca6b8e8c54cadee31b92a2), [`06e2680`](https://github.com/mastra-ai/mastra/commit/06e26806b51d2cbd858afdc66daa2b86ff3ba64a), [`1240f05`](https://github.com/mastra-ai/mastra/commit/1240f051c8e5371f1c014448bf37b1a1b9a05e47), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`24c10d3`](https://github.com/mastra-ai/mastra/commit/24c10d333e6649ac06075903aeeee13a933db3b3), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748), [`215f9b0`](https://github.com/mastra-ai/mastra/commit/215f9b0f3f3f6fc165edad360582dd4d3d7ea748)]:
  - @mastra/core@1.49.0-alpha.5

## 1.49.0-alpha.4

### Patch Changes

- Updated dependencies [[`6a61846`](https://github.com/mastra-ai/mastra/commit/6a61846eeda29fb714549b70f1bee2bf6b141c44)]:
  - @mastra/core@1.49.0-alpha.4

## 1.49.0-alpha.3

### Patch Changes

- Fixed a TypeScript error where auth provider instances (for example `new MastraAuthWorkos()`) could not be assigned to `server.auth` or `studio.auth`, failing with `Property '#private' is missing` (#18682). ([#18796](https://github.com/mastra-ai/mastra/pull/18796))

  Auth providers are now typed with a new structural `IMastraAuthProvider` interface (exported from `@mastra/core/server` and `@mastra/auth`), so provider packages no longer need a shared class identity with `@mastra/core`. `CompositeAuth` also accepts any `IMastraAuthProvider` implementation. No code changes are required:

  ```typescript
  import { Mastra } from '@mastra/core';
  import { MastraAuthWorkos } from '@mastra/auth-workos';

  // Previously failed to compile with TS2322, now works without casts
  export const mastra = new Mastra({
    server: {
      auth: new MastraAuthWorkos(),
    },
  });
  ```

- Updated dependencies [[`700619b`](https://github.com/mastra-ai/mastra/commit/700619b61d572e592cbaaf758121d168844ca4d2), [`0c3d4bc`](https://github.com/mastra-ai/mastra/commit/0c3d4bcae13ea3699d379403e6f350d5cf4efe9f), [`17369b2`](https://github.com/mastra-ai/mastra/commit/17369b25250561e9ed994ae509be1d15bfb33bcb), [`bcae929`](https://github.com/mastra-ai/mastra/commit/bcae929945cbf265bd9f327cc715ecafa072b5b9), [`b33822e`](https://github.com/mastra-ai/mastra/commit/b33822e8d470884954b02f7b0745407ee4ef74b1), [`d5c11e3`](https://github.com/mastra-ai/mastra/commit/d5c11e3ba5045969caa7272a7bd1fd141c93ab6c), [`ff80671`](https://github.com/mastra-ai/mastra/commit/ff8067185e208b27198b4e5b71803013175c3643), [`dab1257`](https://github.com/mastra-ai/mastra/commit/dab1257b64e4ed576dc5038bb7a3f7072338bc9f), [`705ff39`](https://github.com/mastra-ai/mastra/commit/705ff3969e57214ff2fdaf3815d751dd558886ed), [`e6fbd5b`](https://github.com/mastra-ai/mastra/commit/e6fbd5bfdc28e92c0c0433f29aa1bc152d3430f6), [`6f2026c`](https://github.com/mastra-ai/mastra/commit/6f2026cdf114ff1e21e49133ca774ec7d5085059), [`f890eda`](https://github.com/mastra-ai/mastra/commit/f890eda2c8a2ae83d9b30bc6d85842f93b6c266b)]:
  - @mastra/core@1.49.0-alpha.3

## 1.49.0-alpha.2

### Patch Changes

- Updated dependencies [[`1340fb7`](https://github.com/mastra-ai/mastra/commit/1340fb76262a3ca062130aa71859f07257a0a5a4)]:
  - @mastra/core@1.49.0-alpha.2

## 1.49.0-alpha.1

### Patch Changes

- Updated dependencies [[`cc440a3`](https://github.com/mastra-ai/mastra/commit/cc440a39400d8ce06655462b26c1666a1b3d4320), [`ea6327b`](https://github.com/mastra-ai/mastra/commit/ea6327ba2d63ca647804bc97b347e03a58617162), [`3439fa8`](https://github.com/mastra-ai/mastra/commit/3439fa836ecfcaa257b40c20b30ac2a8be22e9ea), [`85107f2`](https://github.com/mastra-ai/mastra/commit/85107f2758b527147fccbedff962961927c2d3b8), [`06ff9e0`](https://github.com/mastra-ai/mastra/commit/06ff9e0befd1d642ab87ff749285ee4091205c7e), [`7f5e1ff`](https://github.com/mastra-ai/mastra/commit/7f5e1ff695a92f672bb3976363925d1e9136b54a), [`b8375c1`](https://github.com/mastra-ai/mastra/commit/b8375c1f8fe905df8ae2ae9a893bb365f17aec4e), [`003f35d`](https://github.com/mastra-ai/mastra/commit/003f35d19e07b23b4bacc591c8bc0c59b42124ae)]:
  - @mastra/core@1.49.0-alpha.1

## 1.48.1-alpha.0

### Patch Changes

- Updated dependencies [[`0f69865`](https://github.com/mastra-ai/mastra/commit/0f69865aced225d98eac812e22699dc445ee18cb)]:
  - @mastra/core@1.48.1-alpha.0

## 1.48.0

### Minor Changes

- **Added** heartbeats: schedule an agent to run on a recurring cron, either inside an existing conversation thread or on its own. ([#18184](https://github.com/mastra-ai/mastra/pull/18184))

  A heartbeat fires a prompt to an agent on a schedule. When it has a thread, the run is delivered into that thread as a normal agent signal, so anything watching the thread sees it like any other message; without a thread, the agent just runs in isolation. Each heartbeat has its own id and an optional `name`, so one agent or thread can have several heartbeats with different schedules and prompts. The id is generated for you, or you can pass your own `id` to `create` for a stable handle (it's normalized to `hb_<slug>`). Heartbeats are persisted, so they keep firing across process restarts with no extra setup.

  ```ts
  const hb = await mastra.heartbeats.create({
    agentId: 'chef',
    name: 'morning-checkin',
    threadId,
    resourceId,
    cron: '*/5 * * * *',
    prompt: 'Check in on the user',
    ifActive: { behavior: 'discard' }, // skip if the user is mid-conversation
    ifIdle: { behavior: 'wake' }, // wake the agent if the thread is idle
  });

  // Threadless: run the agent on a cron with no conversation.
  await mastra.heartbeats.create({
    agentId: 'chef',
    cron: '0 * * * *',
    prompt: 'Run the hourly summary',
  });

  await mastra.heartbeats.list({ agentId: 'chef' });
  await mastra.heartbeats.get(hb.id);
  await mastra.heartbeats.update(hb.id, { prompt: 'check in gently' });
  await mastra.heartbeats.pause(hb.id);
  await mastra.heartbeats.resume(hb.id);
  await mastra.heartbeats.run(hb.id); // fire once now
  await mastra.heartbeats.delete(hb.id);
  ```

  The same CRUD is available over HTTP through `@mastra/server` (under `/api/heartbeats`) and as top-level methods on the `@mastra/client-js` client (`client.createHeartbeat`, `client.getHeartbeat`, `client.listHeartbeats`, etc.).

  **Lifecycle hooks**

  React to heartbeat runs via `heartbeat` on the `Mastra` constructor. It's a single hook bundle that runs for every agent's heartbeats; each hook receives the firing `agentId` so you can branch on it. `prepare` resolves fire-time parameters (for example, creating a fresh thread per fire), and `onFinish` / `onError` / `onAbort` mirror `agent.stream`.

  ```ts
  new Mastra({
    // ...
    heartbeat: {
      // Return overrides, `null` to skip this fire, or `undefined` to use defaults.
      prepare: async ({ agentId, heartbeat }) => {
        if (agentId === 'chef' && heartbeat.name === 'daily-digest') {
          return { threadId: await createDailyThread(), resourceId: 'slack:U095PUH0FKL' };
        }
      },
      onFinish: ({ agentId, outcome, result, heartbeat }) => {
        metrics.record({ agentId, heartbeat: heartbeat.name, outcome });
      },
      onError: ({ agentId, error, phase, heartbeat }) => {
        alerts.send(`heartbeat ${agentId}/${heartbeat.name} failed in ${phase}: ${error.message}`);
      },
    },
  });
  ```

  **Signal shaping**

  A heartbeat fire surfaces to the agent as a signal. By default it uses the `notification` type and renders as `<heartbeat>…</heartbeat>`; override `signalType` and `tagName` to change either. `ifActive` and `ifIdle` mirror the `agent.sendSignal` options shape (`{ behavior, attributes }`, plus `streamOptions` on `ifIdle`) and stay JSON-serializable so they persist with the schedule. `ifIdle.streamOptions` currently accepts `requestContext`, which is rehydrated onto the woken run. Top-level `attributes` are rendered on the signal tag, and top-level `providerOptions` are merged into the signal payload on every fire.

  ```ts
  await mastra.heartbeats.create({
    agentId: 'chef',
    threadId,
    resourceId,
    cron: '*/5 * * * *',
    prompt: 'Check in on the user',
    tagName: 'check-in', // renders as <check-in>…</check-in>
    attributes: { source: 'cron' },
    providerOptions: { openai: { store: false } },
    ifIdle: {
      behavior: 'wake',
      streamOptions: { requestContext: { locale: 'en-US' } },
    },
  });
  ```

- Added storage-backed discovery of suspended agent runs, so human-in-the-loop approval UIs can recover a pending run after a page refresh or server restart. ([#17898](https://github.com/mastra-ai/mastra/pull/17898))

  `agent.listSuspendedRuns()` lists runs waiting on a tool-call approval or on a tool that called `suspend()`. Unlike the in-memory `getActiveThreadRunId()`, it reads from storage, so it works after a restart and across multiple server instances:

  ```ts
  const { runs, total } = await agent.listSuspendedRuns({ threadId, resourceId });
  if (runs[0]) {
    // runs[0].toolCalls -> [{ toolCallId, toolName, args, requiresApproval }]
    await agent.approveToolCall({ runId: runs[0].runId, toolCallId: runs[0].toolCalls[0].toolCallId });
  }
  ```

  Supports `threadId`/`resourceId`/date filters and pagination, mirroring `listWorkflowRuns()`. The same surface is exposed over HTTP as `GET /agents/:agentId/suspended-runs` and on the client SDK as `agent.listSuspendedRuns()`; server-enforced request-context values take precedence over client query parameters, so clients cannot list runs outside their scope.

  `sendToolApproval()` now falls back to this storage-backed discovery when no active run is found in memory for the thread, so approvals keep working after a restart. If several suspended runs match, it throws an error asking for a `toolCallId` to disambiguate.

  **Why:** approval UIs previously had no public way to recover a suspended run after a refresh or restart, forcing apps to parse internal workflow snapshots.

### Patch Changes

- Allow `'fs'` as an agent/scorer definition source in the server handlers and response schemas. File-based agents are registered with `source: 'fs'`, and the scorer/agent list endpoints now surface and validate that value instead of failing schema validation. ([#18609](https://github.com/mastra-ai/mastra/pull/18609))

  ```ts
  // GET /api/agents now returns file-based agents alongside code/stored ones:
  {
    "weather": { "name": "weather", "source": "fs" /* was rejected before */ }
  }
  ```

- Fixed inline skills (created via createSkill()) not appearing in the Dev Portal. The server now uses agent.listSkills() and agent.getSkill() which return both inline and workspace skills, instead of only querying workspace skills. ([#18569](https://github.com/mastra-ai/mastra/pull/18569))

- add Studio support for observational memory extractors ([#18655](https://github.com/mastra-ai/mastra/pull/18655))

  Adds `bufferedObservationChunks` and extraction metadata to the buffer-status API and client types so extracted values flow through during live streaming. Renders observational memory indicators from a normalized cycle model that preserves extraction data across streaming, refetch, reload, activation, and failure transitions.

- Updated dependencies [[`b9a2961`](https://github.com/mastra-ai/mastra/commit/b9a2961c1be81e3639c0879e58588c26dd0ae866), [`b33c77d`](https://github.com/mastra-ai/mastra/commit/b33c77d5293f14a794f3ec38dc947a6676de2764), [`1274eb3`](https://github.com/mastra-ai/mastra/commit/1274eb3a9508f579ceb3187fbce34408222d4b71), [`cdd5f93`](https://github.com/mastra-ai/mastra/commit/cdd5f939cefa67390629704dce92563ccbf492b2), [`1274eb3`](https://github.com/mastra-ai/mastra/commit/1274eb3a9508f579ceb3187fbce34408222d4b71), [`0ac14ce`](https://github.com/mastra-ai/mastra/commit/0ac14cea48e1b0a7857782153c78f7242fdf7e1a), [`9566d27`](https://github.com/mastra-ai/mastra/commit/9566d27ead3d95bdbe5a69e5a082a68222829cf2), [`8be63b0`](https://github.com/mastra-ai/mastra/commit/8be63b015fb8d72cea1220f05e7dc3bb997cc249), [`1009f77`](https://github.com/mastra-ai/mastra/commit/1009f772aa40016b49267c8566d0c29f6a16aa3c), [`1b8728a`](https://github.com/mastra-ai/mastra/commit/1b8728a57fd844205a452b0b4216d20ff60c784a), [`23c31de`](https://github.com/mastra-ai/mastra/commit/23c31de96ed8153402dcf092ac84b27a0c3638c1), [`0368766`](https://github.com/mastra-ai/mastra/commit/0368766744c7ea3df4d6059e2cc15f7bdf55f5a6), [`6f578ac`](https://github.com/mastra-ai/mastra/commit/6f578acba84930b406b2a0700b17cfdfaf5aae56), [`345eecc`](https://github.com/mastra-ai/mastra/commit/345eecce6ba519b5d987f0e10b5de4c8e5734580), [`1917c53`](https://github.com/mastra-ai/mastra/commit/1917c53b19dac43926f29c496893b0686462dca4), [`c01012f`](https://github.com/mastra-ai/mastra/commit/c01012f50368d29eb3fc3764df42d48291973d23), [`705ba98`](https://github.com/mastra-ai/mastra/commit/705ba98726d388a596e896225f237907ca6807a9), [`95857bc`](https://github.com/mastra-ai/mastra/commit/95857bcd6669da7193f503e803f0d72a2bd66be6), [`e62c108`](https://github.com/mastra-ai/mastra/commit/e62c108409dfd6a6cac0a48ec39c5cc81d24fd52), [`2866f04`](https://github.com/mastra-ai/mastra/commit/2866f04953edb78c1637fa45cc53abe24122edcb), [`ee14cae`](https://github.com/mastra-ai/mastra/commit/ee14cae244805783bde518a6142de28b744b169c), [`e84e791`](https://github.com/mastra-ai/mastra/commit/e84e79174031d7bc8793ca6c805eb38b06e7cfb1), [`c2f0b7f`](https://github.com/mastra-ai/mastra/commit/c2f0b7f1370f4428d165f51f0d1d9a48331cc257), [`213feb8`](https://github.com/mastra-ai/mastra/commit/213feb87bfdd1d8ec00ea660e218f9bcfcb34e7b), [`58e287b`](https://github.com/mastra-ai/mastra/commit/58e287b1edaf978b13745a1795989cad3826e82b), [`e420b3c`](https://github.com/mastra-ai/mastra/commit/e420b3c3ffc98bbc5b791897ea390bb47af99696), [`be875ed`](https://github.com/mastra-ai/mastra/commit/be875ed43f856742ce58529f531b5ea0ae6911f3), [`9eefdc0`](https://github.com/mastra-ai/mastra/commit/9eefdc0ac03f989718c6d835334940a977938895), [`bfbbb01`](https://github.com/mastra-ai/mastra/commit/bfbbb01bd845ba54cdc0c678c277d08a7cb847e4), [`7d112ca`](https://github.com/mastra-ai/mastra/commit/7d112ca17078479b2659b88ba1c85b936cfc111c)]:
  - @mastra/core@1.48.0

## 1.48.0-alpha.10

### Patch Changes

- add Studio support for observational memory extractors ([#18655](https://github.com/mastra-ai/mastra/pull/18655))

  Adds `bufferedObservationChunks` and extraction metadata to the buffer-status API and client types so extracted values flow through during live streaming. Renders observational memory indicators from a normalized cycle model that preserves extraction data across streaming, refetch, reload, activation, and failure transitions.

- Updated dependencies [[`6f578ac`](https://github.com/mastra-ai/mastra/commit/6f578acba84930b406b2a0700b17cfdfaf5aae56), [`c01012f`](https://github.com/mastra-ai/mastra/commit/c01012f50368d29eb3fc3764df42d48291973d23), [`be875ed`](https://github.com/mastra-ai/mastra/commit/be875ed43f856742ce58529f531b5ea0ae6911f3), [`9eefdc0`](https://github.com/mastra-ai/mastra/commit/9eefdc0ac03f989718c6d835334940a977938895), [`7d112ca`](https://github.com/mastra-ai/mastra/commit/7d112ca17078479b2659b88ba1c85b936cfc111c)]:
  - @mastra/core@1.48.0-alpha.10

## 1.48.0-alpha.9

### Patch Changes

- Updated dependencies [[`e84e791`](https://github.com/mastra-ai/mastra/commit/e84e79174031d7bc8793ca6c805eb38b06e7cfb1)]:
  - @mastra/core@1.48.0-alpha.9

## 1.48.0-alpha.8

### Patch Changes

- Updated dependencies [[`0ac14ce`](https://github.com/mastra-ai/mastra/commit/0ac14cea48e1b0a7857782153c78f7242fdf7e1a), [`c2f0b7f`](https://github.com/mastra-ai/mastra/commit/c2f0b7f1370f4428d165f51f0d1d9a48331cc257)]:
  - @mastra/core@1.48.0-alpha.8

## 1.48.0-alpha.7

### Patch Changes

- Allow `'fs'` as an agent/scorer definition source in the server handlers and response schemas. File-based agents are registered with `source: 'fs'`, and the scorer/agent list endpoints now surface and validate that value instead of failing schema validation. ([#18609](https://github.com/mastra-ai/mastra/pull/18609))

  ```ts
  // GET /api/agents now returns file-based agents alongside code/stored ones:
  {
    "weather": { "name": "weather", "source": "fs" /* was rejected before */ }
  }
  ```

- Updated dependencies [[`8be63b0`](https://github.com/mastra-ai/mastra/commit/8be63b015fb8d72cea1220f05e7dc3bb997cc249), [`345eecc`](https://github.com/mastra-ai/mastra/commit/345eecce6ba519b5d987f0e10b5de4c8e5734580), [`ee14cae`](https://github.com/mastra-ai/mastra/commit/ee14cae244805783bde518a6142de28b744b169c)]:
  - @mastra/core@1.48.0-alpha.7

## 1.48.0-alpha.6

### Patch Changes

- Updated dependencies [[`b33c77d`](https://github.com/mastra-ai/mastra/commit/b33c77d5293f14a794f3ec38dc947a6676de2764), [`1009f77`](https://github.com/mastra-ai/mastra/commit/1009f772aa40016b49267c8566d0c29f6a16aa3c), [`23c31de`](https://github.com/mastra-ai/mastra/commit/23c31de96ed8153402dcf092ac84b27a0c3638c1), [`0368766`](https://github.com/mastra-ai/mastra/commit/0368766744c7ea3df4d6059e2cc15f7bdf55f5a6), [`2866f04`](https://github.com/mastra-ai/mastra/commit/2866f04953edb78c1637fa45cc53abe24122edcb)]:
  - @mastra/core@1.48.0-alpha.6

## 1.48.0-alpha.5

### Minor Changes

- **Added** heartbeats: schedule an agent to run on a recurring cron, either inside an existing conversation thread or on its own. ([#18184](https://github.com/mastra-ai/mastra/pull/18184))

  A heartbeat fires a prompt to an agent on a schedule. When it has a thread, the run is delivered into that thread as a normal agent signal, so anything watching the thread sees it like any other message; without a thread, the agent just runs in isolation. Each heartbeat has its own id and an optional `name`, so one agent or thread can have several heartbeats with different schedules and prompts. The id is generated for you, or you can pass your own `id` to `create` for a stable handle (it's normalized to `hb_<slug>`). Heartbeats are persisted, so they keep firing across process restarts with no extra setup.

  ```ts
  const hb = await mastra.heartbeats.create({
    agentId: 'chef',
    name: 'morning-checkin',
    threadId,
    resourceId,
    cron: '*/5 * * * *',
    prompt: 'Check in on the user',
    ifActive: { behavior: 'discard' }, // skip if the user is mid-conversation
    ifIdle: { behavior: 'wake' }, // wake the agent if the thread is idle
  });

  // Threadless: run the agent on a cron with no conversation.
  await mastra.heartbeats.create({
    agentId: 'chef',
    cron: '0 * * * *',
    prompt: 'Run the hourly summary',
  });

  await mastra.heartbeats.list({ agentId: 'chef' });
  await mastra.heartbeats.get(hb.id);
  await mastra.heartbeats.update(hb.id, { prompt: 'check in gently' });
  await mastra.heartbeats.pause(hb.id);
  await mastra.heartbeats.resume(hb.id);
  await mastra.heartbeats.run(hb.id); // fire once now
  await mastra.heartbeats.delete(hb.id);
  ```

  The same CRUD is available over HTTP through `@mastra/server` (under `/api/heartbeats`) and as top-level methods on the `@mastra/client-js` client (`client.createHeartbeat`, `client.getHeartbeat`, `client.listHeartbeats`, etc.).

  **Lifecycle hooks**

  React to heartbeat runs via `heartbeat` on the `Mastra` constructor. It's a single hook bundle that runs for every agent's heartbeats; each hook receives the firing `agentId` so you can branch on it. `prepare` resolves fire-time parameters (for example, creating a fresh thread per fire), and `onFinish` / `onError` / `onAbort` mirror `agent.stream`.

  ```ts
  new Mastra({
    // ...
    heartbeat: {
      // Return overrides, `null` to skip this fire, or `undefined` to use defaults.
      prepare: async ({ agentId, heartbeat }) => {
        if (agentId === 'chef' && heartbeat.name === 'daily-digest') {
          return { threadId: await createDailyThread(), resourceId: 'slack:U095PUH0FKL' };
        }
      },
      onFinish: ({ agentId, outcome, result, heartbeat }) => {
        metrics.record({ agentId, heartbeat: heartbeat.name, outcome });
      },
      onError: ({ agentId, error, phase, heartbeat }) => {
        alerts.send(`heartbeat ${agentId}/${heartbeat.name} failed in ${phase}: ${error.message}`);
      },
    },
  });
  ```

  **Signal shaping**

  A heartbeat fire surfaces to the agent as a signal. By default it uses the `notification` type and renders as `<heartbeat>…</heartbeat>`; override `signalType` and `tagName` to change either. `ifActive` and `ifIdle` mirror the `agent.sendSignal` options shape (`{ behavior, attributes }`, plus `streamOptions` on `ifIdle`) and stay JSON-serializable so they persist with the schedule. `ifIdle.streamOptions` currently accepts `requestContext`, which is rehydrated onto the woken run. Top-level `attributes` are rendered on the signal tag, and top-level `providerOptions` are merged into the signal payload on every fire.

  ```ts
  await mastra.heartbeats.create({
    agentId: 'chef',
    threadId,
    resourceId,
    cron: '*/5 * * * *',
    prompt: 'Check in on the user',
    tagName: 'check-in', // renders as <check-in>…</check-in>
    attributes: { source: 'cron' },
    providerOptions: { openai: { store: false } },
    ifIdle: {
      behavior: 'wake',
      streamOptions: { requestContext: { locale: 'en-US' } },
    },
  });
  ```

- Added storage-backed discovery of suspended agent runs, so human-in-the-loop approval UIs can recover a pending run after a page refresh or server restart. ([#17898](https://github.com/mastra-ai/mastra/pull/17898))

  `agent.listSuspendedRuns()` lists runs waiting on a tool-call approval or on a tool that called `suspend()`. Unlike the in-memory `getActiveThreadRunId()`, it reads from storage, so it works after a restart and across multiple server instances:

  ```ts
  const { runs, total } = await agent.listSuspendedRuns({ threadId, resourceId });
  if (runs[0]) {
    // runs[0].toolCalls -> [{ toolCallId, toolName, args, requiresApproval }]
    await agent.approveToolCall({ runId: runs[0].runId, toolCallId: runs[0].toolCalls[0].toolCallId });
  }
  ```

  Supports `threadId`/`resourceId`/date filters and pagination, mirroring `listWorkflowRuns()`. The same surface is exposed over HTTP as `GET /agents/:agentId/suspended-runs` and on the client SDK as `agent.listSuspendedRuns()`; server-enforced request-context values take precedence over client query parameters, so clients cannot list runs outside their scope.

  `sendToolApproval()` now falls back to this storage-backed discovery when no active run is found in memory for the thread, so approvals keep working after a restart. If several suspended runs match, it throws an error asking for a `toolCallId` to disambiguate.

  **Why:** approval UIs previously had no public way to recover a suspended run after a refresh or restart, forcing apps to parse internal workflow snapshots.

### Patch Changes

- Updated dependencies [[`1917c53`](https://github.com/mastra-ai/mastra/commit/1917c53b19dac43926f29c496893b0686462dca4), [`58e287b`](https://github.com/mastra-ai/mastra/commit/58e287b1edaf978b13745a1795989cad3826e82b)]:
  - @mastra/core@1.48.0-alpha.5

## 1.48.0-alpha.4

### Patch Changes

- Updated dependencies [[`705ba98`](https://github.com/mastra-ai/mastra/commit/705ba98726d388a596e896225f237907ca6807a9), [`e62c108`](https://github.com/mastra-ai/mastra/commit/e62c108409dfd6a6cac0a48ec39c5cc81d24fd52), [`bfbbb01`](https://github.com/mastra-ai/mastra/commit/bfbbb01bd845ba54cdc0c678c277d08a7cb847e4)]:
  - @mastra/core@1.48.0-alpha.4

## 1.48.0-alpha.3

### Patch Changes

- Fixed inline skills (created via createSkill()) not appearing in the Dev Portal. The server now uses agent.listSkills() and agent.getSkill() which return both inline and workspace skills, instead of only querying workspace skills. ([#18569](https://github.com/mastra-ai/mastra/pull/18569))

- Updated dependencies [[`cdd5f93`](https://github.com/mastra-ai/mastra/commit/cdd5f939cefa67390629704dce92563ccbf492b2), [`1b8728a`](https://github.com/mastra-ai/mastra/commit/1b8728a57fd844205a452b0b4216d20ff60c784a), [`213feb8`](https://github.com/mastra-ai/mastra/commit/213feb87bfdd1d8ec00ea660e218f9bcfcb34e7b)]:
  - @mastra/core@1.48.0-alpha.3

## 1.48.0-alpha.2

### Patch Changes

- Updated dependencies [[`e420b3c`](https://github.com/mastra-ai/mastra/commit/e420b3c3ffc98bbc5b791897ea390bb47af99696)]:
  - @mastra/core@1.48.0-alpha.2

## 1.48.0-alpha.1

### Patch Changes

- Updated dependencies [[`95857bc`](https://github.com/mastra-ai/mastra/commit/95857bcd6669da7193f503e803f0d72a2bd66be6), [`8e9c0fb`](https://github.com/mastra-ai/mastra/commit/8e9c0fb48fd58da2efcdff2cf1202ee41092c315)]:
  - @mastra/core@1.48.0-alpha.1

## 1.48.0-alpha.0

### Patch Changes

- Updated dependencies [[`b9a2961`](https://github.com/mastra-ai/mastra/commit/b9a2961c1be81e3639c0879e58588c26dd0ae866), [`1274eb3`](https://github.com/mastra-ai/mastra/commit/1274eb3a9508f579ceb3187fbce34408222d4b71), [`1274eb3`](https://github.com/mastra-ai/mastra/commit/1274eb3a9508f579ceb3187fbce34408222d4b71), [`9566d27`](https://github.com/mastra-ai/mastra/commit/9566d27ead3d95bdbe5a69e5a082a68222829cf2)]:
  - @mastra/core@1.48.0-alpha.0

## 1.47.0

### Minor Changes

- Enrich the agent-controller HTTP session surface so a client can render a status ([#18446](https://github.com/mastra-ai/mastra/pull/18446))
  line, read behavior settings, and scope threads per working directory.

  `GET /agent-controller/:controllerId/sessions/:resourceId` now also returns:
  - `omProgress` — the status-line slice of observational-memory progress
    (pending tokens vs. observation threshold, accumulated observations vs.
    reflection threshold, plus projected message removal / reflection savings)
  - `tokenUsage` — cumulative token usage for the current thread
  - `settings` — agent behavior settings (`yolo`, `thinkingLevel`,
    `notifications`, `smartEditing`)

  `GET /agent-controller/:controllerId/sessions/:resourceId/threads` accepts
  an optional `tags` query param (a JSON-encoded object). A single resourceId can
  be shared across git worktrees of the same repo (the id is derived from the git
  URL), so passing `tags` scopes the list to threads matching every tag (e.g.
  `{ projectPath }` for the working directory). Each returned thread now also
  includes the scoping `tags` it was stamped with at creation.

  The session event stream route (`.../stream`) now enqueues raw event objects
  and lets the server adapter handle SSE framing, fixing a double-framing bug
  where events were wrapped twice (`data: "data: {...}\n\n"\n\n`) and could not be
  parsed by clients.

  `@mastra/client-js` gains the matching types and reads:
  - `AgentControllerOMProgress` and `AgentControllerSessionSettings`, surfaced on
    `AgentControllerSessionState` (`omProgress`, `tokenUsage`, `settings`)
  - a `display_state_changed` event in `KnownAgentControllerEvent` carrying the
    status-line figures
  - `AgentControllerSession.listThreads()` now accepts either a number
    (back-compat) or `{ limit?, tags? }`

  Example:

  ```ts
  const session = client.getAgentController('code').session(resourceId);

  // Scope a worktree's thread list (and resumed session) to its own threads.
  await session.create({ tags: { projectPath: '/repo/worktree-a' } });
  const threads = await session.listThreads({ tags: { projectPath: '/repo/worktree-a' } });

  // Read the status-line figures and agent settings.
  const state = await session.state();
  state.omProgress; // observational-memory progress
  state.tokenUsage; // cumulative token usage
  state.settings; // { yolo, thinkingLevel, notifications, smartEditing }
  ```

- Rename the `Harness` class to `AgentController` and its associated `Harness*` types to `AgentController*` (e.g. `HarnessConfig` → `AgentControllerConfig`, `HarnessMode` → `AgentControllerMode`, `HarnessEvent` → `AgentControllerEvent`). ([#18505](https://github.com/mastra-ai/mastra/pull/18505))

  `@mastra/core`: A new canonical subpath `@mastra/core/agent-controller` exports the `AgentController` class plus the `AgentController*` types. The legacy `@mastra/core/harness` subpath remains available and re-exports the deprecated `Harness*` aliases, so existing `Harness` class and type usage continues to work unchanged. New code should import from `@mastra/core/agent-controller`. On `Mastra`, the hosted-controller API is exposed under agent-controller names — `getAgentController`, `getAgentControllerById`, `listAgentControllers`, and the `agentControllers` config key — while `getHarness`/`getHarnessById`/`listHarnesses` and the `harnesses` config key remain as deprecated aliases.

  `@mastra/server`: The controller session API is now served exclusively under `/agent-controller/...` (with `agent-controller:read` / `agent-controller:execute` permissions). The legacy `/harness/...` routes and `harness:*` permissions have been removed. List responses use the `agentControllers` key, session responses use `controllerId`, and path params use `:controllerId`.

  `@mastra/client-js`: `AgentController` and `AgentControllerSession` are now the canonical resource classes, with `MastraClient.getAgentController(id)` / `listAgentControllers()` targeting the `/agent-controller` routes and reading the canonical `agentControllers` / `controllerId` response keys. The deprecated `getHarness` / `listHarnesses` methods and `Harness` / `HarnessSession` classes have been removed. This is a breaking change for the recently released client.

  The `@mastra/core` peer dependency floor is raised to `>=1.47.0-0` so consumers must be on the release that introduces the canonical agent-controller surface. This applies to `@mastra/server`, `@mastra/deployer`, and `mastra` (CLI), and is propagated to the packages that depend on them: the deployers (`@mastra/deployer-cloud`, `@mastra/deployer-cloudflare`, `@mastra/deployer-netlify`, `@mastra/deployer-vercel`), the server adapters (`@mastra/express`, `@mastra/fastify`, `@mastra/hono`, `@mastra/koa`, `@mastra/nestjs`, `@mastra/next`, `@mastra/tanstack-start`), and `@mastra/temporal`.

- Scope harness session creation with tags so sessions sharing a resourceId can ([#18446](https://github.com/mastra-ai/mastra/pull/18446))
  each resume their own thread.

  `harness.createSession()` now accepts an optional `tags` record. The tags are
  (a) seeded into the new session's state, (b) stamped onto every thread the
  session creates (so thread listings can be filtered back to the session's
  scope), and (c) used to filter initial thread selection: a thread is a resume
  candidate only when its metadata matches every provided tag. Previously, initial
  thread selection only consulted the
  harness-global `initialState.projectPath`; on a multi-session server (where one
  Harness serves many scopes) a session could resume the most recently updated
  thread from a _different_ scope that shared the resourceId. Using a generic tag
  record (e.g. `{ projectPath }`) keeps room for future scoping dimensions without
  further API changes.

  The `@mastra/client-js` `HarnessSession.create()` method accepts `{ tags }`, and
  the `POST /harness/:id/sessions` route accepts a `tags` body field.

  ```ts
  // before: initial thread chosen by resourceId only
  const session = await harness.createSession({ resourceId, id, ownerId });

  // after: initial thread scoped to this worktree via a tag
  const session = await harness.createSession({
    resourceId,
    id,
    ownerId,
    tags: { projectPath: '/repo/worktree-a' },
  });
  ```

### Patch Changes

- feat(playground): render ask_user tool as interactive question UI in Studio ([#18374](https://github.com/mastra-ai/mastra/pull/18374))

  Adds an `AskUserBadge` component that renders suspended `ask_user` tool calls
  as interactive prompts with clickable option buttons (single/multi-select) or
  free-text input. The user's answer is sent as `resumeData` through the existing
  `sendToolApproval` flow to properly resume the tool.

  Plumbing changes:
  - `sendToolApprovalBodySchema` now accepts optional `resumeData`
  - `agent.sendToolApproval()` passes custom `resumeData` when provided
  - `@mastra/client-js` and `@mastra/react` expose the new parameter

- Fixed conditional workflows so that re-running or rehydrating a run (time travel) no longer leaves the wrong branch marked as active. When a paused or replayed run lands on a conditional, arms whose condition does not evaluate truthy are now correctly recorded as skipped instead of staying stuck in a running state. ([#18228](https://github.com/mastra-ai/mastra/pull/18228))

  The server workflow and schedule run-status response schemas now include the `'skipped'` status so they stay in sync with core's `WorkflowRunStatus`.

- Updated dependencies [[`86623c1`](https://github.com/mastra-ai/mastra/commit/86623c1adf7d22de32cc916dda17f4155184db36), [`023766f`](https://github.com/mastra-ai/mastra/commit/023766f44d59b30a50f3a381e33eddde8ab56c00), [`0200e75`](https://github.com/mastra-ai/mastra/commit/0200e7552d02d4221cd6040bf4eddf189a97a156), [`7c9dd77`](https://github.com/mastra-ai/mastra/commit/7c9dd77bd18cb8dc72797e25f1a0fbdc71a11347), [`7f9ae70`](https://github.com/mastra-ai/mastra/commit/7f9ae70826b047e5a66218f9e92f20e54a2d791f), [`a0509c7`](https://github.com/mastra-ai/mastra/commit/a0509c731a08aa3ed626557c5338126362856f57), [`06e0d63`](https://github.com/mastra-ai/mastra/commit/06e0d63d42bc2a202e18bc091f3781f409f5e6fb), [`bf3fe49`](https://github.com/mastra-ai/mastra/commit/bf3fe49f9467dbbdb8f9eaf74e0f7971ffb19559), [`01caf93`](https://github.com/mastra-ai/mastra/commit/01caf93d71ae2c1e65f49735cafb531975187426), [`438a971`](https://github.com/mastra-ai/mastra/commit/438a9715c8b4398e5eaf8914a1f19dc8a85dc1de), [`9990965`](https://github.com/mastra-ai/mastra/commit/999096571635a83b42ef40841fd7028cfa630779), [`77518cc`](https://github.com/mastra-ai/mastra/commit/77518ccb5bb8cc684875081e64213dc85cffdbee), [`fbeda0c`](https://github.com/mastra-ai/mastra/commit/fbeda0c0f35def07e6837936dd3a003b2b7c5172), [`8a68844`](https://github.com/mastra-ai/mastra/commit/8a688443013816105a09f89c6afa34b5ff13e26d), [`bb2a13b`](https://github.com/mastra-ai/mastra/commit/bb2a13bb4b32e6bb807200fe7b18ae8fa4322118), [`24ceaea`](https://github.com/mastra-ai/mastra/commit/24ceaea0bdd8609cabbab764380608ca6621a194), [`a73cd1a`](https://github.com/mastra-ai/mastra/commit/a73cd1a62a5e4ca023dcc39ba150029f4f1f74c1), [`c0ffa3c`](https://github.com/mastra-ai/mastra/commit/c0ffa3c897ccd326de880df734740a7f0681a18f), [`462a769`](https://github.com/mastra-ai/mastra/commit/462a769da61850862ca1be3d74134d33078ee6a7), [`0504bf5`](https://github.com/mastra-ai/mastra/commit/0504bf5e8cffc571a4b343326178de371e6f859b), [`0b5cc47`](https://github.com/mastra-ai/mastra/commit/0b5cc4726dc18d9a685a27520db39ff1b36bb89a), [`87f38a3`](https://github.com/mastra-ai/mastra/commit/87f38a3de03e24731f2dd6f8ed6a60b6722b85a1), [`d5fa3cd`](https://github.com/mastra-ai/mastra/commit/d5fa3cda1788c3cb93a361a3c6ec47de6ba21e98), [`fe98ef2`](https://github.com/mastra-ai/mastra/commit/fe98ef2e66dbfcbd7d645c88c9ee1e67b458a136), [`6ccf67b`](https://github.com/mastra-ai/mastra/commit/6ccf67bf075753754927a57bc2e1734ba2c820c5), [`793ea0f`](https://github.com/mastra-ai/mastra/commit/793ea0f52f831178837f21c83af6af93bf4ce638), [`825d8de`](https://github.com/mastra-ai/mastra/commit/825d8def9fa64c2bcc3d8dd6b49e09342c3ac5c7), [`507a5c4`](https://github.com/mastra-ai/mastra/commit/507a5c461bdc3136ad80744c0efbb55ce1f18f97), [`5afe423`](https://github.com/mastra-ai/mastra/commit/5afe423e4badf040f1b0d4525183a856fcb8146e), [`307573b`](https://github.com/mastra-ai/mastra/commit/307573b9ff3149b70c79540dbc86f1319b180f29), [`79b3626`](https://github.com/mastra-ai/mastra/commit/79b3626f8d647307eb07c8da14c9073c2699719d), [`c2c1d7b`](https://github.com/mastra-ai/mastra/commit/c2c1d7bb61d2602955f14ed3952f807c2d6eb576), [`86623c1`](https://github.com/mastra-ai/mastra/commit/86623c1adf7d22de32cc916dda17f4155184db36), [`1505c07`](https://github.com/mastra-ai/mastra/commit/1505c07603f6346bae12aa82f140e8b88ffea9ab), [`f328049`](https://github.com/mastra-ai/mastra/commit/f3280498c324afd2a8d36cd828f5b9f94a2dddc1), [`e545228`](https://github.com/mastra-ai/mastra/commit/e54522856934a5dc030b7b6385771e3548020d59), [`3eb852e`](https://github.com/mastra-ai/mastra/commit/3eb852e5435bc908b800193498103dc724f455b0), [`ffa09e7`](https://github.com/mastra-ai/mastra/commit/ffa09e772a5c92270eabe2090fc42d45bd8ec4b7), [`8c9f1c0`](https://github.com/mastra-ai/mastra/commit/8c9f1c0361d89066f9bcd14a2f69e761b01766c8), [`461a7c5`](https://github.com/mastra-ai/mastra/commit/461a7c501449295287f4f0ee4b0b42344f39fcf8), [`4211472`](https://github.com/mastra-ai/mastra/commit/4211472a5a2bd319c60cd2e42d9109c3eef7ac1c), [`9e45902`](https://github.com/mastra-ai/mastra/commit/9e4590208e745055cecca202e2db0e5c65e17d3c), [`5c0df77`](https://github.com/mastra-ai/mastra/commit/5c0df776c40efa420f8c07a2f3ee66010296618e), [`e940f09`](https://github.com/mastra-ai/mastra/commit/e940f099ef5d18b403e6f2b4937e086a4da857b1)]:
  - @mastra/core@1.47.0

## 1.47.0-alpha.7

### Patch Changes

- Updated dependencies [[`8a68844`](https://github.com/mastra-ai/mastra/commit/8a688443013816105a09f89c6afa34b5ff13e26d)]:
  - @mastra/core@1.47.0-alpha.7

## 1.47.0-alpha.6

### Minor Changes

- Rename the `Harness` class to `AgentController` and its associated `Harness*` types to `AgentController*` (e.g. `HarnessConfig` → `AgentControllerConfig`, `HarnessMode` → `AgentControllerMode`, `HarnessEvent` → `AgentControllerEvent`). ([#18505](https://github.com/mastra-ai/mastra/pull/18505))

  `@mastra/core`: A new canonical subpath `@mastra/core/agent-controller` exports the `AgentController` class plus the `AgentController*` types. The legacy `@mastra/core/harness` subpath remains available and re-exports the deprecated `Harness*` aliases, so existing `Harness` class and type usage continues to work unchanged. New code should import from `@mastra/core/agent-controller`. On `Mastra`, the hosted-controller API is exposed under agent-controller names — `getAgentController`, `getAgentControllerById`, `listAgentControllers`, and the `agentControllers` config key — while `getHarness`/`getHarnessById`/`listHarnesses` and the `harnesses` config key remain as deprecated aliases.

  `@mastra/server`: The controller session API is now served exclusively under `/agent-controller/...` (with `agent-controller:read` / `agent-controller:execute` permissions). The legacy `/harness/...` routes and `harness:*` permissions have been removed. List responses use the `agentControllers` key, session responses use `controllerId`, and path params use `:controllerId`.

  `@mastra/client-js`: `AgentController` and `AgentControllerSession` are now the canonical resource classes, with `MastraClient.getAgentController(id)` / `listAgentControllers()` targeting the `/agent-controller` routes and reading the canonical `agentControllers` / `controllerId` response keys. The deprecated `getHarness` / `listHarnesses` methods and `Harness` / `HarnessSession` classes have been removed. This is a breaking change for the recently released client.

  The `@mastra/core` peer dependency floor is raised to `>=1.47.0-0` so consumers must be on the release that introduces the canonical agent-controller surface. This applies to `@mastra/server`, `@mastra/deployer`, and `mastra` (CLI), and is propagated to the packages that depend on them: the deployers (`@mastra/deployer-cloud`, `@mastra/deployer-cloudflare`, `@mastra/deployer-netlify`, `@mastra/deployer-vercel`), the server adapters (`@mastra/express`, `@mastra/fastify`, `@mastra/hono`, `@mastra/koa`, `@mastra/nestjs`, `@mastra/next`, `@mastra/tanstack-start`), and `@mastra/temporal`.

### Patch Changes

- feat(playground): render ask_user tool as interactive question UI in Studio ([#18374](https://github.com/mastra-ai/mastra/pull/18374))

  Adds an `AskUserBadge` component that renders suspended `ask_user` tool calls
  as interactive prompts with clickable option buttons (single/multi-select) or
  free-text input. The user's answer is sent as `resumeData` through the existing
  `sendToolApproval` flow to properly resume the tool.

  Plumbing changes:
  - `sendToolApprovalBodySchema` now accepts optional `resumeData`
  - `agent.sendToolApproval()` passes custom `resumeData` when provided
  - `@mastra/client-js` and `@mastra/react` expose the new parameter

- Updated dependencies [[`0200e75`](https://github.com/mastra-ai/mastra/commit/0200e7552d02d4221cd6040bf4eddf189a97a156), [`06e0d63`](https://github.com/mastra-ai/mastra/commit/06e0d63d42bc2a202e18bc091f3781f409f5e6fb), [`438a971`](https://github.com/mastra-ai/mastra/commit/438a9715c8b4398e5eaf8914a1f19dc8a85dc1de), [`77518cc`](https://github.com/mastra-ai/mastra/commit/77518ccb5bb8cc684875081e64213dc85cffdbee), [`bb2a13b`](https://github.com/mastra-ai/mastra/commit/bb2a13bb4b32e6bb807200fe7b18ae8fa4322118), [`a73cd1a`](https://github.com/mastra-ai/mastra/commit/a73cd1a62a5e4ca023dcc39ba150029f4f1f74c1), [`0b5cc47`](https://github.com/mastra-ai/mastra/commit/0b5cc4726dc18d9a685a27520db39ff1b36bb89a), [`87f38a3`](https://github.com/mastra-ai/mastra/commit/87f38a3de03e24731f2dd6f8ed6a60b6722b85a1), [`d5fa3cd`](https://github.com/mastra-ai/mastra/commit/d5fa3cda1788c3cb93a361a3c6ec47de6ba21e98), [`fe98ef2`](https://github.com/mastra-ai/mastra/commit/fe98ef2e66dbfcbd7d645c88c9ee1e67b458a136), [`793ea0f`](https://github.com/mastra-ai/mastra/commit/793ea0f52f831178837f21c83af6af93bf4ce638), [`507a5c4`](https://github.com/mastra-ai/mastra/commit/507a5c461bdc3136ad80744c0efbb55ce1f18f97), [`79b3626`](https://github.com/mastra-ai/mastra/commit/79b3626f8d647307eb07c8da14c9073c2699719d)]:
  - @mastra/core@1.47.0-alpha.6

## 1.47.0-alpha.5

### Patch Changes

- Updated dependencies [[`023766f`](https://github.com/mastra-ai/mastra/commit/023766f44d59b30a50f3a381e33eddde8ab56c00), [`a0509c7`](https://github.com/mastra-ai/mastra/commit/a0509c731a08aa3ed626557c5338126362856f57), [`01caf93`](https://github.com/mastra-ai/mastra/commit/01caf93d71ae2c1e65f49735cafb531975187426), [`c2c1d7b`](https://github.com/mastra-ai/mastra/commit/c2c1d7bb61d2602955f14ed3952f807c2d6eb576), [`3eb852e`](https://github.com/mastra-ai/mastra/commit/3eb852e5435bc908b800193498103dc724f455b0)]:
  - @mastra/core@1.47.0-alpha.5

## 1.47.0-alpha.4

### Patch Changes

- Updated dependencies [[`462a769`](https://github.com/mastra-ai/mastra/commit/462a769da61850862ca1be3d74134d33078ee6a7), [`f328049`](https://github.com/mastra-ai/mastra/commit/f3280498c324afd2a8d36cd828f5b9f94a2dddc1), [`e545228`](https://github.com/mastra-ai/mastra/commit/e54522856934a5dc030b7b6385771e3548020d59)]:
  - @mastra/core@1.47.0-alpha.4

## 1.47.0-alpha.3

### Minor Changes

- Enrich the harness HTTP session surface so a client can render a status line, ([#18446](https://github.com/mastra-ai/mastra/pull/18446))
  read behavior settings, and scope threads per working directory.

  `GET /harness/:harnessId/sessions/:resourceId` now also returns:
  - `omProgress` — the status-line slice of observational-memory progress
    (pending tokens vs. observation threshold, accumulated observations vs.
    reflection threshold, plus projected message removal / reflection savings)
  - `tokenUsage` — cumulative token usage for the current thread
  - `settings` — agent behavior settings (`yolo`, `thinkingLevel`,
    `notifications`, `smartEditing`)

  `GET /harness/:harnessId/sessions/:resourceId/threads` accepts an optional
  `tags` query param (a JSON-encoded object). A single resourceId can be shared
  across git worktrees of the same repo (the id is derived from the git URL), so
  passing `tags` scopes the list to threads matching every tag (e.g.
  `{ projectPath }` for the working directory). Each returned thread now also
  includes the scoping `tags` it was stamped with at creation.

  The session event stream route (`.../stream`) now enqueues raw event objects
  and lets the server adapter handle SSE framing, fixing a double-framing bug
  where events were wrapped twice (`data: "data: {...}\n\n"\n\n`) and could not be
  parsed by clients.

  `@mastra/client-js` gains the matching types and reads:
  - `HarnessOMProgress` and `HarnessSessionSettings`, surfaced on
    `HarnessSessionState` (`omProgress`, `tokenUsage`, `settings`)
  - a `display_state_changed` event in `KnownHarnessEvent` carrying the
    status-line figures
  - `HarnessSession.listThreads()` now accepts either a number (back-compat) or
    `{ limit?, tags? }`

  Example:

  ```ts
  const session = client.getHarness('code').session(resourceId);

  // Scope a worktree's thread list (and resumed session) to its own threads.
  await session.create({ tags: { projectPath: '/repo/worktree-a' } });
  const threads = await session.listThreads({ tags: { projectPath: '/repo/worktree-a' } });

  // Read the status-line figures and agent settings.
  const state = await session.state();
  state.omProgress; // observational-memory progress
  state.tokenUsage; // cumulative token usage
  state.settings; // { yolo, thinkingLevel, notifications, smartEditing }
  ```

- Scope harness session creation with tags so sessions sharing a resourceId can ([#18446](https://github.com/mastra-ai/mastra/pull/18446))
  each resume their own thread.

  `harness.createSession()` now accepts an optional `tags` record. The tags are
  (a) seeded into the new session's state, (b) stamped onto every thread the
  session creates (so thread listings can be filtered back to the session's
  scope), and (c) used to filter initial thread selection: a thread is a resume
  candidate only when its metadata matches every provided tag. Previously, initial
  thread selection only consulted the
  harness-global `initialState.projectPath`; on a multi-session server (where one
  Harness serves many scopes) a session could resume the most recently updated
  thread from a _different_ scope that shared the resourceId. Using a generic tag
  record (e.g. `{ projectPath }`) keeps room for future scoping dimensions without
  further API changes.

  The `@mastra/client-js` `HarnessSession.create()` method accepts `{ tags }`, and
  the `POST /harness/:id/sessions` route accepts a `tags` body field.

  ```ts
  // before: initial thread chosen by resourceId only
  const session = await harness.createSession({ resourceId, id, ownerId });

  // after: initial thread scoped to this worktree via a tag
  const session = await harness.createSession({
    resourceId,
    id,
    ownerId,
    tags: { projectPath: '/repo/worktree-a' },
  });
  ```

### Patch Changes

- Fixed conditional workflows so that re-running or rehydrating a run (time travel) no longer leaves the wrong branch marked as active. When a paused or replayed run lands on a conditional, arms whose condition does not evaluate truthy are now correctly recorded as skipped instead of staying stuck in a running state. ([#18228](https://github.com/mastra-ai/mastra/pull/18228))

  The server workflow and schedule run-status response schemas now include the `'skipped'` status so they stay in sync with core's `WorkflowRunStatus`.

- Updated dependencies [[`bf3fe49`](https://github.com/mastra-ai/mastra/commit/bf3fe49f9467dbbdb8f9eaf74e0f7971ffb19559), [`24ceaea`](https://github.com/mastra-ai/mastra/commit/24ceaea0bdd8609cabbab764380608ca6621a194), [`6ccf67b`](https://github.com/mastra-ai/mastra/commit/6ccf67bf075753754927a57bc2e1734ba2c820c5), [`825d8de`](https://github.com/mastra-ai/mastra/commit/825d8def9fa64c2bcc3d8dd6b49e09342c3ac5c7), [`ffa09e7`](https://github.com/mastra-ai/mastra/commit/ffa09e772a5c92270eabe2090fc42d45bd8ec4b7), [`461a7c5`](https://github.com/mastra-ai/mastra/commit/461a7c501449295287f4f0ee4b0b42344f39fcf8), [`4211472`](https://github.com/mastra-ai/mastra/commit/4211472a5a2bd319c60cd2e42d9109c3eef7ac1c), [`9e45902`](https://github.com/mastra-ai/mastra/commit/9e4590208e745055cecca202e2db0e5c65e17d3c), [`5c0df77`](https://github.com/mastra-ai/mastra/commit/5c0df776c40efa420f8c07a2f3ee66010296618e)]:
  - @mastra/core@1.47.0-alpha.3

## 1.47.0-alpha.2

### Patch Changes

- Updated dependencies [[`86623c1`](https://github.com/mastra-ai/mastra/commit/86623c1adf7d22de32cc916dda17f4155184db36), [`7c9dd77`](https://github.com/mastra-ai/mastra/commit/7c9dd77bd18cb8dc72797e25f1a0fbdc71a11347), [`9990965`](https://github.com/mastra-ai/mastra/commit/999096571635a83b42ef40841fd7028cfa630779), [`c0ffa3c`](https://github.com/mastra-ai/mastra/commit/c0ffa3c897ccd326de880df734740a7f0681a18f), [`0504bf5`](https://github.com/mastra-ai/mastra/commit/0504bf5e8cffc571a4b343326178de371e6f859b), [`5afe423`](https://github.com/mastra-ai/mastra/commit/5afe423e4badf040f1b0d4525183a856fcb8146e), [`86623c1`](https://github.com/mastra-ai/mastra/commit/86623c1adf7d22de32cc916dda17f4155184db36), [`8c9f1c0`](https://github.com/mastra-ai/mastra/commit/8c9f1c0361d89066f9bcd14a2f69e761b01766c8)]:
  - @mastra/core@1.47.0-alpha.2

## 1.46.1-alpha.1

### Patch Changes

- Updated dependencies [[`7f9ae70`](https://github.com/mastra-ai/mastra/commit/7f9ae70826b047e5a66218f9e92f20e54a2d791f), [`1505c07`](https://github.com/mastra-ai/mastra/commit/1505c07603f6346bae12aa82f140e8b88ffea9ab), [`e940f09`](https://github.com/mastra-ai/mastra/commit/e940f099ef5d18b403e6f2b4937e086a4da857b1)]:
  - @mastra/core@1.46.1-alpha.1

## 1.46.1-alpha.0

### Patch Changes

- Updated dependencies [[`fbeda0c`](https://github.com/mastra-ai/mastra/commit/fbeda0c0f35def07e6837936dd3a003b2b7c5172), [`307573b`](https://github.com/mastra-ai/mastra/commit/307573b9ff3149b70c79540dbc86f1319b180f29)]:
  - @mastra/core@1.46.1-alpha.0

## 1.46.0

### Minor Changes

- Expose Harness sessions over HTTP. ([#18358](https://github.com/mastra-ai/mastra/pull/18358))

  Adds a set of `harness`-scoped server routes that let a registered Harness be
  driven over HTTP: create (get-or-create) a session by `resourceId`, send
  messages, steer, abort, approve/decline tool calls, respond to tool
  suspensions, switch mode/model, manage threads, read session state, and
  subscribe to the session's event stream via SSE. Routes resolve the target
  Harness through `mastra.getHarness(id)` and operate on the session returned by
  `harness.createSession(...)`.

  A new `harness` permission resource is included (`harness:read`,
  `harness:execute`).

  The tool-approval route forwards the request's `toolCallId` so a stale or
  delayed approval can only resolve the gate it targets, and the list-models
  route no longer returns API key environment variable names.

- Added the AUTO_BLOCK_EXTERNAL_PROVIDERS environment variable. When set to `true` or `1`, Mastra Studio hides all external model providers (OpenAI, Anthropic, Gemini, etc.) and the built-in gateways, showing only the custom gateways you register. This lets enterprise deployments that route through their own gateway present just that gateway in the model picker. ([#18153](https://github.com/mastra-ai/mastra/pull/18153))

  ```bash
  AUTO_BLOCK_EXTERNAL_PROVIDERS=true
  ```

### Patch Changes

- The HTTP signal/message routes adapt to the agent's new `accepted` contract: they await `accepted` to derive the authoritative `runId` (falling back to the caller's `runId` or the stored signal id for `persist`/`discard`) while preserving the `{ accepted: true; runId: string }` wire shape. A setup/misconfig rejection tagged `ErrorCategory.USER` now maps to a `400` instead of a generic `500`. ([#18237](https://github.com/mastra-ai/mastra/pull/18237))

- Extend `datasetItemSourceSchema` enum with `'candidate-screener'`. ([#18314](https://github.com/mastra-ai/mastra/pull/18314))

  The server's Zod schema for dataset item sources mirrored the closed `DatasetItemSource['type']` union from `@mastra/core`. Now that core extends the union with `'candidate-screener'`, the server schema follows so HTTP handlers can compile against the new core types and the API can round-trip externally-materialized items.

- Expose item-level tool mocks through the dataset API and client SDK. Dataset item create/update/batch endpoints accept a `toolMocks` array (toolName + args + output + optional `matchArgs` mode), experiment result responses include the `toolMockReport`, and the client-js types thread `toolMocks` and `toolMockReport` through the dataset item and experiment result types. ([#18037](https://github.com/mastra-ai/mastra/pull/18037))

  ```ts
  // Author a dataset item with a tool mock the agent will replay during experiments
  await client.addDatasetItem({
    datasetId,
    input: { question: 'What is the weather in Tokyo?' },
    toolMocks: [{ toolName: 'getWeather', args: { city: 'Tokyo' }, output: { tempC: 18 } }],
  });
  ```

- Added a `serializeStreamChunk` helper to `@mastra/server/server-adapter` that server adapters use to safely serialize stream chunks. It converts values that JSON cannot represent (BigInt to string, circular references to "[Circular]") and reports a serialization error instead of throwing, so one bad chunk can no longer terminate an HTTP stream. Part of the fix for [#17821](https://github.com/mastra-ai/mastra/issues/17821) ([#17843](https://github.com/mastra-ai/mastra/pull/17843))

- Updated dependencies [[`5bd72d2`](https://github.com/mastra-ai/mastra/commit/5bd72d255f45b5ea8ab342643bd463814a980a24), [`1cc9ee1`](https://github.com/mastra-ai/mastra/commit/1cc9ee1ba51db53020a735626d33017a60b4b5b3), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`65f255a`](https://github.com/mastra-ai/mastra/commit/65f255a38667beb6ceeadabfa9eb5059bfec8298), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`30ebaf0`](https://github.com/mastra-ai/mastra/commit/30ebaf07bed5f4d30f2f257836c15d1bf7e40aae), [`5704634`](https://github.com/mastra-ai/mastra/commit/5704634b22133167dea337a942a34f57aaa3fa14), [`5c4e9a4`](https://github.com/mastra-ai/mastra/commit/5c4e9a4cfb2216bb3ea7f8988ad3727f3b92bb3a), [`4a88c6e`](https://github.com/mastra-ai/mastra/commit/4a88c6e2bdce316f8d7551b4ec3449b0b06fc71c), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`25961e3`](https://github.com/mastra-ai/mastra/commit/25961e3260ff3b1464637af8fcdb36210551c39f), [`6a1428a`](https://github.com/mastra-ai/mastra/commit/6a1428a23133fc070fc6c1caa08d28f3ba4fe5ff), [`87a17ef`](https://github.com/mastra-ai/mastra/commit/87a17efbd725aca6639febdc5e69e2abb3048689), [`e11ff30`](https://github.com/mastra-ai/mastra/commit/e11ff301408bf1731dca2fb7fbfcd8c819500a35), [`7794d71`](https://github.com/mastra-ai/mastra/commit/7794d71872c68733a30e028dfb7b1705daf6c5d2), [`9d2c946`](https://github.com/mastra-ai/mastra/commit/9d2c946d0859e90ae4bcec5beeb1da7398d2ad1e), [`c0eda2b`](https://github.com/mastra-ai/mastra/commit/c0eda2bcd91a228427314b12c91d8b147f3a739f), [`7b29f33`](https://github.com/mastra-ai/mastra/commit/7b29f332a357a83e555f29e718e5f2fab9979943), [`c0eda2b`](https://github.com/mastra-ai/mastra/commit/c0eda2bcd91a228427314b12c91d8b147f3a739f), [`b13925b`](https://github.com/mastra-ai/mastra/commit/b13925bfa91aa8700f56fa54a9ce707ee7e4ba62), [`f1ec385`](https://github.com/mastra-ai/mastra/commit/f1ec385386f62b1a0847ec5353ae2bb169d1c3d9), [`e14986f`](https://github.com/mastra-ai/mastra/commit/e14986f6e5478d6384d04ff9a7f9a79a46a8b529), [`24912b1`](https://github.com/mastra-ai/mastra/commit/24912b1f855d29ec36af4ef4bde1f7417e20cdf5), [`bf94ec6`](https://github.com/mastra-ai/mastra/commit/bf94ec68192d9f16e46ef7e5ac36370aeeddf35d), [`a29f371`](https://github.com/mastra-ai/mastra/commit/a29f371aef629ac8562661524a497127e93b5131), [`7686216`](https://github.com/mastra-ai/mastra/commit/7686216f37e74568feddec17cef3c3d24e10e60a), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`073f910`](https://github.com/mastra-ai/mastra/commit/073f910481e7d94b95ba3830f96531774ae95d33), [`0be490f`](https://github.com/mastra-ai/mastra/commit/0be490fabb538c5a7de796ea0aff7d04a0bea1f3), [`0be490f`](https://github.com/mastra-ai/mastra/commit/0be490fabb538c5a7de796ea0aff7d04a0bea1f3), [`ebbe1d3`](https://github.com/mastra-ai/mastra/commit/ebbe1d31a965a3adb0e728758f326b8122b4b55f), [`974f614`](https://github.com/mastra-ai/mastra/commit/974f614e083bd68278536f94453f7b320b86a3c7), [`3818814`](https://github.com/mastra-ai/mastra/commit/38188149ce454c4403fe9fcbdf73b735c68d36be), [`975c59a`](https://github.com/mastra-ai/mastra/commit/975c59ae363ee275fc55062392e1ffd2cbccbd53), [`1f97ce5`](https://github.com/mastra-ai/mastra/commit/1f97ce5695463bebb4eaacf501da6fb403e20885), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`7f51548`](https://github.com/mastra-ai/mastra/commit/7f515481213780be7047cef00640b9d35f3d545c), [`64f58c0`](https://github.com/mastra-ai/mastra/commit/64f58c04e78b40137497d47f781e897e416f22a5), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`ebbe1d3`](https://github.com/mastra-ai/mastra/commit/ebbe1d31a965a3adb0e728758f326b8122b4b55f), [`d95f394`](https://github.com/mastra-ai/mastra/commit/d95f394fd24c8411886930d727679c4d5252aa26), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`8e25a78`](https://github.com/mastra-ai/mastra/commit/8e25a78e0597575f0b0729bae8c5e190c84869b5), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`f3f0c9d`](https://github.com/mastra-ai/mastra/commit/f3f0c9d7c878db5a13177871ce3523a14f14b311), [`a5b22d3`](https://github.com/mastra-ai/mastra/commit/a5b22d314d62a68d801886a8d3d0eb6c089473db), [`31be1cf`](https://github.com/mastra-ai/mastra/commit/31be1cf5f2a7b5eef12f6123a40653b4d8115c16), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858)]:
  - @mastra/core@1.46.0

## 1.46.0-alpha.5

### Patch Changes

- Updated dependencies [[`3818814`](https://github.com/mastra-ai/mastra/commit/38188149ce454c4403fe9fcbdf73b735c68d36be)]:
  - @mastra/core@1.46.0-alpha.5

## 1.46.0-alpha.4

### Patch Changes

- Extend `datasetItemSourceSchema` enum with `'candidate-screener'`. ([#18314](https://github.com/mastra-ai/mastra/pull/18314))

  The server's Zod schema for dataset item sources mirrored the closed `DatasetItemSource['type']` union from `@mastra/core`. Now that core extends the union with `'candidate-screener'`, the server schema follows so HTTP handlers can compile against the new core types and the API can round-trip externally-materialized items.

- Expose item-level tool mocks through the dataset API and client SDK. Dataset item create/update/batch endpoints accept a `toolMocks` array (toolName + args + output + optional `matchArgs` mode), experiment result responses include the `toolMockReport`, and the client-js types thread `toolMocks` and `toolMockReport` through the dataset item and experiment result types. ([#18037](https://github.com/mastra-ai/mastra/pull/18037))

  ```ts
  // Author a dataset item with a tool mock the agent will replay during experiments
  await client.addDatasetItem({
    datasetId,
    input: { question: 'What is the weather in Tokyo?' },
    toolMocks: [{ toolName: 'getWeather', args: { city: 'Tokyo' }, output: { tempC: 18 } }],
  });
  ```

- Updated dependencies [[`5c4e9a4`](https://github.com/mastra-ai/mastra/commit/5c4e9a4cfb2216bb3ea7f8988ad3727f3b92bb3a), [`25961e3`](https://github.com/mastra-ai/mastra/commit/25961e3260ff3b1464637af8fcdb36210551c39f), [`7b29f33`](https://github.com/mastra-ai/mastra/commit/7b29f332a357a83e555f29e718e5f2fab9979943), [`24912b1`](https://github.com/mastra-ai/mastra/commit/24912b1f855d29ec36af4ef4bde1f7417e20cdf5), [`7686216`](https://github.com/mastra-ai/mastra/commit/7686216f37e74568feddec17cef3c3d24e10e60a), [`975c59a`](https://github.com/mastra-ai/mastra/commit/975c59ae363ee275fc55062392e1ffd2cbccbd53), [`d95f394`](https://github.com/mastra-ai/mastra/commit/d95f394fd24c8411886930d727679c4d5252aa26), [`f3f0c9d`](https://github.com/mastra-ai/mastra/commit/f3f0c9d7c878db5a13177871ce3523a14f14b311)]:
  - @mastra/core@1.46.0-alpha.4

## 1.46.0-alpha.3

### Minor Changes

- Expose Harness sessions over HTTP. ([#18358](https://github.com/mastra-ai/mastra/pull/18358))

  Adds a set of `harness`-scoped server routes that let a registered Harness be
  driven over HTTP: create (get-or-create) a session by `resourceId`, send
  messages, steer, abort, approve/decline tool calls, respond to tool
  suspensions, switch mode/model, manage threads, read session state, and
  subscribe to the session's event stream via SSE. Routes resolve the target
  Harness through `mastra.getHarness(id)` and operate on the session returned by
  `harness.createSession(...)`.

  A new `harness` permission resource is included (`harness:read`,
  `harness:execute`).

  The tool-approval route forwards the request's `toolCallId` so a stale or
  delayed approval can only resolve the gate it targets, and the list-models
  route no longer returns API key environment variable names.

### Patch Changes

- Updated dependencies [[`65f255a`](https://github.com/mastra-ai/mastra/commit/65f255a38667beb6ceeadabfa9eb5059bfec8298), [`4a88c6e`](https://github.com/mastra-ai/mastra/commit/4a88c6e2bdce316f8d7551b4ec3449b0b06fc71c), [`87a17ef`](https://github.com/mastra-ai/mastra/commit/87a17efbd725aca6639febdc5e69e2abb3048689), [`e11ff30`](https://github.com/mastra-ai/mastra/commit/e11ff301408bf1731dca2fb7fbfcd8c819500a35), [`9d2c946`](https://github.com/mastra-ai/mastra/commit/9d2c946d0859e90ae4bcec5beeb1da7398d2ad1e), [`f1ec385`](https://github.com/mastra-ai/mastra/commit/f1ec385386f62b1a0847ec5353ae2bb169d1c3d9), [`e14986f`](https://github.com/mastra-ai/mastra/commit/e14986f6e5478d6384d04ff9a7f9a79a46a8b529), [`0be490f`](https://github.com/mastra-ai/mastra/commit/0be490fabb538c5a7de796ea0aff7d04a0bea1f3), [`0be490f`](https://github.com/mastra-ai/mastra/commit/0be490fabb538c5a7de796ea0aff7d04a0bea1f3), [`974f614`](https://github.com/mastra-ai/mastra/commit/974f614e083bd68278536f94453f7b320b86a3c7), [`31be1cf`](https://github.com/mastra-ai/mastra/commit/31be1cf5f2a7b5eef12f6123a40653b4d8115c16)]:
  - @mastra/core@1.46.0-alpha.3

## 1.46.0-alpha.2

### Patch Changes

- Updated dependencies [[`6a1428a`](https://github.com/mastra-ai/mastra/commit/6a1428a23133fc070fc6c1caa08d28f3ba4fe5ff), [`7f51548`](https://github.com/mastra-ai/mastra/commit/7f515481213780be7047cef00640b9d35f3d545c)]:
  - @mastra/core@1.46.0-alpha.2

## 1.46.0-alpha.1

### Patch Changes

- Updated dependencies [[`7794d71`](https://github.com/mastra-ai/mastra/commit/7794d71872c68733a30e028dfb7b1705daf6c5d2)]:
  - @mastra/core@1.46.0-alpha.1

## 1.46.0-alpha.0

### Minor Changes

- Added the AUTO_BLOCK_EXTERNAL_PROVIDERS environment variable. When set to `true` or `1`, Mastra Studio hides all external model providers (OpenAI, Anthropic, Gemini, etc.) and the built-in gateways, showing only the custom gateways you register. This lets enterprise deployments that route through their own gateway present just that gateway in the model picker. ([#18153](https://github.com/mastra-ai/mastra/pull/18153))

  ```bash
  AUTO_BLOCK_EXTERNAL_PROVIDERS=true
  ```

### Patch Changes

- The HTTP signal/message routes adapt to the agent's new `accepted` contract: they await `accepted` to derive the authoritative `runId` (falling back to the caller's `runId` or the stored signal id for `persist`/`discard`) while preserving the `{ accepted: true; runId: string }` wire shape. A setup/misconfig rejection tagged `ErrorCategory.USER` now maps to a `400` instead of a generic `500`. ([#18237](https://github.com/mastra-ai/mastra/pull/18237))

- Added a `serializeStreamChunk` helper to `@mastra/server/server-adapter` that server adapters use to safely serialize stream chunks. It converts values that JSON cannot represent (BigInt to string, circular references to "[Circular]") and reports a serialization error instead of throwing, so one bad chunk can no longer terminate an HTTP stream. Part of the fix for [#17821](https://github.com/mastra-ai/mastra/issues/17821) ([#17843](https://github.com/mastra-ai/mastra/pull/17843))

- Updated dependencies [[`5bd72d2`](https://github.com/mastra-ai/mastra/commit/5bd72d255f45b5ea8ab342643bd463814a980a24), [`1cc9ee1`](https://github.com/mastra-ai/mastra/commit/1cc9ee1ba51db53020a735626d33017a60b4b5b3), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`30ebaf0`](https://github.com/mastra-ai/mastra/commit/30ebaf07bed5f4d30f2f257836c15d1bf7e40aae), [`5704634`](https://github.com/mastra-ai/mastra/commit/5704634b22133167dea337a942a34f57aaa3fa14), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`c0eda2b`](https://github.com/mastra-ai/mastra/commit/c0eda2bcd91a228427314b12c91d8b147f3a739f), [`c0eda2b`](https://github.com/mastra-ai/mastra/commit/c0eda2bcd91a228427314b12c91d8b147f3a739f), [`b13925b`](https://github.com/mastra-ai/mastra/commit/b13925bfa91aa8700f56fa54a9ce707ee7e4ba62), [`bf94ec6`](https://github.com/mastra-ai/mastra/commit/bf94ec68192d9f16e46ef7e5ac36370aeeddf35d), [`a29f371`](https://github.com/mastra-ai/mastra/commit/a29f371aef629ac8562661524a497127e93b5131), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`073f910`](https://github.com/mastra-ai/mastra/commit/073f910481e7d94b95ba3830f96531774ae95d33), [`ebbe1d3`](https://github.com/mastra-ai/mastra/commit/ebbe1d31a965a3adb0e728758f326b8122b4b55f), [`1f97ce5`](https://github.com/mastra-ai/mastra/commit/1f97ce5695463bebb4eaacf501da6fb403e20885), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`64f58c0`](https://github.com/mastra-ai/mastra/commit/64f58c04e78b40137497d47f781e897e416f22a5), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`ebbe1d3`](https://github.com/mastra-ai/mastra/commit/ebbe1d31a965a3adb0e728758f326b8122b4b55f), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`8e25a78`](https://github.com/mastra-ai/mastra/commit/8e25a78e0597575f0b0729bae8c5e190c84869b5), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`a5b22d3`](https://github.com/mastra-ai/mastra/commit/a5b22d314d62a68d801886a8d3d0eb6c089473db), [`417baae`](https://github.com/mastra-ai/mastra/commit/417baae40b995db5819c845036947f0c27dc1c00), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858), [`74955f9`](https://github.com/mastra-ai/mastra/commit/74955f9120cde8b1d8ce4399232b4033236be858)]:
  - @mastra/core@1.46.0-alpha.0

## 1.45.0

### Minor Changes

- Random bump ([#18178](https://github.com/mastra-ai/mastra/pull/18178))

### Patch Changes

- Updated dependencies [[`7c0d868`](https://github.com/mastra-ai/mastra/commit/7c0d868d97d0fdbc04c14d0166dbf44d4c5a4a62), [`d9d2273`](https://github.com/mastra-ai/mastra/commit/d9d2273c702690c9a26eab2aebea879701d4355a), [`b04369d`](https://github.com/mastra-ai/mastra/commit/b04369d6b167c698ef103981171a8bf92808e756), [`8f3c262`](https://github.com/mastra-ai/mastra/commit/8f3c262587b335588a02d96b17fd6aca34c885b3)]:
  - @mastra/core@1.45.0

## 1.45.0-alpha.0

### Minor Changes

- Random bump ([#18178](https://github.com/mastra-ai/mastra/pull/18178))

### Patch Changes

- Updated dependencies [[`7c0d868`](https://github.com/mastra-ai/mastra/commit/7c0d868d97d0fdbc04c14d0166dbf44d4c5a4a62), [`d9d2273`](https://github.com/mastra-ai/mastra/commit/d9d2273c702690c9a26eab2aebea879701d4355a), [`b04369d`](https://github.com/mastra-ai/mastra/commit/b04369d6b167c698ef103981171a8bf92808e756), [`8f3c262`](https://github.com/mastra-ai/mastra/commit/8f3c262587b335588a02d96b17fd6aca34c885b3)]:
  - @mastra/core@1.45.0-alpha.0

## 1.44.0

### Patch Changes

- Security remediation for the 2026-06-17 "easy-day-js" supply-chain incident. Patch bump to publish clean versions and move the `latest` dist-tag forward, superseding the compromised versions that declared the malicious `easy-day-js` dependency. ([#18056](https://github.com/mastra-ai/mastra/pull/18056))

- Fix crash on every request when deployed with @mastra/core < 1.42.0. The server now gracefully falls back to server-only auth instead of throwing `TypeError: this.mastra.getStudio is not a function`. ([#18075](https://github.com/mastra-ai/mastra/pull/18075))

- Fix SSO callback routing for dual auth configurations. OAuth redirects from identity providers now correctly route to studio auth instead of failing with "sso_not_configured" error. ([#18054](https://github.com/mastra-ai/mastra/pull/18054))

- Updated dependencies [[`339c57c`](https://github.com/mastra-ai/mastra/commit/339c57c5b2c6dbe75a125e138228e0556528976f), [`1dd4117`](https://github.com/mastra-ai/mastra/commit/1dd4117dcbd8e031ede9f0489436bfbc6f0315b8), [`2b11d1f`](https://github.com/mastra-ai/mastra/commit/2b11d1f6ac7024c5dd2b2dd12a48a956ac9d63bd), [`77a2351`](https://github.com/mastra-ai/mastra/commit/77a2351ee79296e360bce822cb3391f7cfd6489d), [`b7dff0a`](https://github.com/mastra-ai/mastra/commit/b7dff0a3d1022eb6868f48dc40a2b1febd5c277f), [`02087e1`](https://github.com/mastra-ai/mastra/commit/02087e1fbc54aa07f3071f7a200df1bf5be601a8), [`49af8df`](https://github.com/mastra-ai/mastra/commit/49af8df589c4ff71a5015a4553b377b32704b691), [`30ce559`](https://github.com/mastra-ai/mastra/commit/30ce55902ecf819b8ab8697398dd68b108228063), [`c241b92`](https://github.com/mastra-ai/mastra/commit/c241b929dc8c8d6a7b7219c99ed13ac1f3124a77), [`7d6ff70`](https://github.com/mastra-ai/mastra/commit/7d6ff708727297a0526ca0e26e93eeb5bbaaa187), [`ab975d4`](https://github.com/mastra-ai/mastra/commit/ab975d4dd9488752f05bda7afa03166d207e3e2a), [`9d6aa1b`](https://github.com/mastra-ai/mastra/commit/9d6aa1bae407e2afa6a089abc2a6accbbcb287b8)]:
  - @mastra/core@1.44.0

## 1.44.0-alpha.2

### Patch Changes

- Updated dependencies [[`339c57c`](https://github.com/mastra-ai/mastra/commit/339c57c5b2c6dbe75a125e138228e0556528976f), [`1dd4117`](https://github.com/mastra-ai/mastra/commit/1dd4117dcbd8e031ede9f0489436bfbc6f0315b8), [`2b11d1f`](https://github.com/mastra-ai/mastra/commit/2b11d1f6ac7024c5dd2b2dd12a48a956ac9d63bd), [`49af8df`](https://github.com/mastra-ai/mastra/commit/49af8df589c4ff71a5015a4553b377b32704b691), [`30ce559`](https://github.com/mastra-ai/mastra/commit/30ce55902ecf819b8ab8697398dd68b108228063), [`c241b92`](https://github.com/mastra-ai/mastra/commit/c241b929dc8c8d6a7b7219c99ed13ac1f3124a77), [`7d6ff70`](https://github.com/mastra-ai/mastra/commit/7d6ff708727297a0526ca0e26e93eeb5bbaaa187)]:
  - @mastra/core@1.44.0-alpha.2

## 1.44.0-alpha.1

### Patch Changes

- Fix SSO callback routing for dual auth configurations. OAuth redirects from identity providers now correctly route to studio auth instead of failing with "sso_not_configured" error. ([#18054](https://github.com/mastra-ai/mastra/pull/18054))

- Updated dependencies [[`b7dff0a`](https://github.com/mastra-ai/mastra/commit/b7dff0a3d1022eb6868f48dc40a2b1febd5c277f), [`02087e1`](https://github.com/mastra-ai/mastra/commit/02087e1fbc54aa07f3071f7a200df1bf5be601a8), [`ab975d4`](https://github.com/mastra-ai/mastra/commit/ab975d4dd9488752f05bda7afa03166d207e3e2a)]:
  - @mastra/core@1.44.0-alpha.1

## 1.43.1-alpha.0

### Patch Changes

- Security remediation for the 2026-06-17 "easy-day-js" supply-chain incident. Patch bump to publish clean versions and move the `latest` dist-tag forward, superseding the compromised versions that declared the malicious `easy-day-js` dependency. ([#18056](https://github.com/mastra-ai/mastra/pull/18056))

- Fix crash on every request when deployed with @mastra/core < 1.42.0. The server now gracefully falls back to server-only auth instead of throwing `TypeError: this.mastra.getStudio is not a function`. ([#18075](https://github.com/mastra-ai/mastra/pull/18075))

- Updated dependencies [[`77a2351`](https://github.com/mastra-ai/mastra/commit/77a2351ee79296e360bce822cb3391f7cfd6489d)]:
  - @mastra/core@1.43.1-alpha.0

## 1.43.0

### Minor Changes

- Added server and client APIs for source-backed stored agent workflows. ([#17583](https://github.com/mastra-ai/mastra/pull/17583))

  The stored agent API can now report editor source capabilities, export owned agent override JSON, and open provider-backed change requests from the server. The client SDK exposes matching methods so Studio and other clients can use the same stored-agent workflow without calling a source provider directly.

  ```ts
  const storedAgent = client.getStoredAgent('weather-agent');
  const exported = await storedAgent.export({ instructions: '...' });
  await storedAgent.openChangeRequest({
    instructions: '...',
    changeMessage: 'Tune weather instructions',
  });
  ```

### Patch Changes

- Added full Studio authentication support for Auth0 users. ([#16658](https://github.com/mastra-ai/mastra/pull/16658))

  **What's new:**
  - **Studio SSO login** — your internal team can now sign in to Mastra Studio using their Auth0 accounts via OAuth 2.0/OIDC
  - **JWT validation** — API requests with Auth0-issued JWTs are automatically validated
  - **Session persistence** — Studio sessions are maintained with encrypted cookies (no need to log in repeatedly)
  - **Secure logout** — proper RP-Initiated Logout support via Auth0's `/v2/logout` endpoint

  **Setup:**
  1. Create a Regular Web Application in your Auth0 Dashboard
  2. Configure the auth provider with your Auth0 credentials

  ```typescript
  import { MastraAuthAuth0 } from '@mastra/auth-auth0';

  const auth = new MastraAuthAuth0({
    domain: 'your-tenant.auth0.com',
    audience: 'https://your-api',
    // For Studio SSO login:
    clientId: process.env.AUTH0_CLIENT_ID,
    clientSecret: process.env.AUTH0_CLIENT_SECRET,
    session: { cookiePassword: process.env.AUTH0_COOKIE_PASSWORD },
  });
  ```

  **Note:** This release includes updates to `@mastra/core` (ISSOProvider interface now supports async getLoginUrl) and `@mastra/server` (handles async login URLs). All three packages should be updated together.

- Added full Studio authentication support for Clerk users. ([#16659](https://github.com/mastra-ai/mastra/pull/16659))

  **What's new:**
  - **Studio SSO login** — your internal team can now sign in to Mastra Studio using their Clerk accounts via OAuth 2.0/OIDC
  - **JWT validation** — API requests with Clerk-issued JWTs are automatically validated
  - **Session persistence** — Studio sessions are maintained with encrypted cookies (no need to log in repeatedly)

  **Setup:**
  1. Create an OAuth Application in your Clerk Dashboard
  2. Configure the auth provider with your Clerk credentials

  ```typescript
  import { MastraAuthClerk } from '@mastra/auth-clerk';

  const auth = new MastraAuthClerk({
    jwksUri: process.env.CLERK_JWKS_URI,
    secretKey: process.env.CLERK_SECRET_KEY,
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
    // For Studio SSO login:
    oauthClientId: process.env.CLERK_OAUTH_CLIENT_ID,
    oauthClientSecret: process.env.CLERK_OAUTH_CLIENT_SECRET,
    session: { cookiePassword: process.env.CLERK_COOKIE_PASSWORD },
  });
  ```

  **Note:** This release includes updates to `@mastra/core` (ISSOProvider interface now supports async getLoginUrl) and `@mastra/server` (handles async login URLs). All three packages should be updated together.

- Republished clean patch versions after compromised npm releases were published outside of the trusted release workflow. ([#18049](https://github.com/mastra-ai/mastra/pull/18049))

  These packages must be released as clean versions higher than the compromised versions currently present on npm so semver ranges resolve to trusted tarballs.

- Updated dependencies [[`de66bb0`](https://github.com/mastra-ai/mastra/commit/de66bb040570444c702ce4d8e1e228a5de2949cb), [`67bf8e2`](https://github.com/mastra-ai/mastra/commit/67bf8e206dfe583954d96015cf0d09f7ac50e45f), [`8216d05`](https://github.com/mastra-ai/mastra/commit/8216d0528d866eb9a07f5d4c87ea3bb1e1139b45), [`d18b23c`](https://github.com/mastra-ai/mastra/commit/d18b23c5e29dfc381e73e3c51fcf6c779afd1823), [`5eb94eb`](https://github.com/mastra-ai/mastra/commit/5eb94ebcf66d4e28c9e26d5821ac93379bab20a0), [`1fa3e12`](https://github.com/mastra-ai/mastra/commit/1fa3e123582b63cfe49de4ee52dc6a065e8d956a), [`f9ee2ac`](https://github.com/mastra-ai/mastra/commit/f9ee2ac661af584e61bc063ac208c9035cd752ef), [`c853d53`](https://github.com/mastra-ai/mastra/commit/c853d535d2df84ab89db1adb4c28900c54c9a2d2), [`d8df1f8`](https://github.com/mastra-ai/mastra/commit/d8df1f8e947e1966c9d4e54713df56d0d0d65226), [`9192ddb`](https://github.com/mastra-ai/mastra/commit/9192ddbced8949113b30de444cbe763f075b59f5), [`ae96523`](https://github.com/mastra-ai/mastra/commit/ae965231f562d9766b0c90c49a69fc68acaa031c), [`17d5a92`](https://github.com/mastra-ai/mastra/commit/17d5a9211aa293b4d4418de3de70dc0394d58101), [`5573693`](https://github.com/mastra-ai/mastra/commit/5573693b589822250e20dfe6cf66e9ff3bc96da8), [`ec4da8a`](https://github.com/mastra-ai/mastra/commit/ec4da8a09e0d2ab452c6ee2c786042ea826b77e5), [`adc44e1`](https://github.com/mastra-ai/mastra/commit/adc44e13c7e570b91e86b20ea7556e61d819db31), [`ed346c0`](https://github.com/mastra-ai/mastra/commit/ed346c0bee2d8496690a4e538bfba1e46894660f), [`c9ce1b2`](https://github.com/mastra-ai/mastra/commit/c9ce1b28d10871110648f9d7b6d76e880b9fa999), [`3ef01fd`](https://github.com/mastra-ai/mastra/commit/3ef01fd130b53d5bd4f828beb174e516a2eb1158), [`245a9a3`](https://github.com/mastra-ai/mastra/commit/245a9a315705fce17ddd980f78a92504b6615c4a), [`dc0b611`](https://github.com/mastra-ai/mastra/commit/dc0b6119b769bd00ee2c5df9259fb376fe63077a), [`38b5de8`](https://github.com/mastra-ai/mastra/commit/38b5de8e5d1d41a69522addf53d96f4b3a1d5bf0), [`dc0b611`](https://github.com/mastra-ai/mastra/commit/dc0b6119b769bd00ee2c5df9259fb376fe63077a), [`dd6a66e`](https://github.com/mastra-ai/mastra/commit/dd6a66ea0b32e0dea8059aec6b35d151e2c87dc4), [`d785c59`](https://github.com/mastra-ai/mastra/commit/d785c593b67fcb4cdc4fab9fdbde5f3b7665efc0), [`1fa3e12`](https://github.com/mastra-ai/mastra/commit/1fa3e123582b63cfe49de4ee52dc6a065e8d956a), [`8b984f4`](https://github.com/mastra-ai/mastra/commit/8b984f4361c202270ceb69257185c4756c9a7c56), [`bf08402`](https://github.com/mastra-ai/mastra/commit/bf084022374fa5d06ca70ed67a86dd64e379071b), [`81fe587`](https://github.com/mastra-ai/mastra/commit/81fe587275035715c1720ddf3fee0505cf053036), [`1fa3e12`](https://github.com/mastra-ai/mastra/commit/1fa3e123582b63cfe49de4ee52dc6a065e8d956a), [`403c438`](https://github.com/mastra-ai/mastra/commit/403c438e417278989ce247233d2c465b8d902cdd), [`f8ba195`](https://github.com/mastra-ai/mastra/commit/f8ba1954e27ee2b20586cc6cd9cf13c002c232f2)]:
  - @mastra/core@1.43.0

## 1.42.0

### Minor Changes

- **Added** author enrichment to the stored-agents list and get handlers. When an auth provider is configured, each agent record now includes a resolved `author` object alongside the existing `authorId`: ([#17205](https://github.com/mastra-ai/mastra/pull/17205))

  ```ts
  {
    id: 'agent_…',
    authorId: 'user_…',
   id, name?, email?, avatarUrl? } // new, optional
    // …
  }
  ```

  Lookups are deduplicated per request and use the provider's `getUsers` batch method when available, falling back to per-id `getUser` calls otherwise. The field is omitted when no auth provider is configured or the ID can't be resolved, so existing clients keep working unchanged.

- Added dual auth system for separate Studio and API authentication. ([#17722](https://github.com/mastra-ai/mastra/pull/17722))

  When configured, Studio and server (API) can use different auth providers:
  - `server.auth` handles API authentication (external customers)
  - `studio.auth` handles Studio authentication (internal team)

  **Dual auth is opt-in:** If `studio.auth` is not configured, Studio requests fall back to `server.auth` for backward compatibility. To enable strict separation, configure both.

  **Example**

  ```typescript
  const mastra = new Mastra({
    server: {
      auth: new MastraAuthWorkos({ ... }), // External customers
    },
    studio: {
      auth: new MastraAuthOkta({ ... }), // Internal team
      rbac: new StaticRBACProvider({
        roles: DEFAULT_ROLES,
        getUserRoles: (user) => [user.role],
      }),
    },
  });
  ```

  This pattern matches real-world SaaS architecture (e.g., Stripe, Supabase) with separate dashboard and API authentication.

- Add server endpoints so Studio can resolve agent-builder model availability and auth permission patterns without importing server-only EE code in the browser: ([#17489](https://github.com/mastra-ai/mastra/pull/17489))
  - `GET /editor/builder/models/available` returns the provider/model list already filtered by the active builder model policy (`requiresAuth: true`, `stored-agents:read`).
  - `GET /auth/permission-patterns` returns the valid permission-pattern strings. It is gated by `requiresAuth: true` with no finer-grained permission: the response is the non-sensitive route-permission vocabulary that every authenticated user needs to gate their own sidebar/redirects, and there is no narrower permission that fits.

  `@mastra/client-js` gains `getBuilderAvailableModels()` and `getPermissionPatterns()` to consume these endpoints.

  ```ts
  import { MastraClient } from '@mastra/client-js';

  const client = new MastraClient({ baseUrl: 'http://localhost:4111' });

  const { providers } = await client.getBuilderAvailableModels();
  const { patterns } = await client.getPermissionPatterns();
  ```

### Patch Changes

- Fixed the tools API endpoint to include dynamically created tools (e.g., MCP tools) alongside bundler-discovered tools. Previously, when the CLI bundler discovered tools, dynamically created tools registered via `new Mastra({ tools })` were silently dropped from the `/api/tools` response. Now both sources are merged, with bundler-discovered tools taking precedence on conflicts. ([#17535](https://github.com/mastra-ai/mastra/pull/17535))

- Added voice helpers to the React SDK and made agent text-to-speech audible. ([#17663](https://github.com/mastra-ai/mastra/pull/17663))

  The React SDK now exposes voice helpers: `useSpeechRecognition` for speech-to-text, `playStreamWithWebAudio` for buffered Web Audio playback from a `ReadableStream`, and `recordMicrophoneToFile` for capturing microphone audio. The `useSpeechRecognition` hook automatically uses an agent's voice provider when one is configured, and falls back to the browser's built-in speech recognition otherwise.

  ```tsx
  import { useSpeechRecognition } from '@mastra/react';

  function VoiceInput({ agentId }: { agentId?: string }) {
    const { start, stop, isListening, transcript } = useSpeechRecognition({ agentId });
    return <button onClick={isListening ? stop : start}>{transcript}</button>;
  }
  ```

  Also fixed agent text-to-speech being inaudible. The `voice/speak` route now returns a web-standard audio response (`Content-Type: audio/mpeg`) so server-side adapters pass raw audio bytes through to the client instead of JSON-encoding them. This also resolves `getReader` crashes when an agent speaks using providers like OpenAI voice.

- **Added** optional `getUsers(userIds)` batch lookup method to `IUserProvider`. Auth providers can implement it to resolve multiple users in a single call; providers that don't implement it continue to work via per-id `getUser` fallback. ([#17205](https://github.com/mastra-ai/mastra/pull/17205))

  ```ts
  // optional batch lookup, returns results positionally aligned to userIds
  const users = await provider.getUsers?.(['u_1', 'u_2', 'u_3']);
  ```

- Fixed the Agent Builder selecting models from providers with no API key configured. The builder available-models list now only includes providers whose API key is set, so an agent created in the Agent Builder can no longer be assigned a model that can never run. ([#17725](https://github.com/mastra-ai/mastra/pull/17725))

- Added agent memory-support metadata to the agents API and client types. ([#17581](https://github.com/mastra-ai/mastra/pull/17581))

- **Added** optional `author` field on `StoredAgentResponse` so consumers can render the resolved author (name, email, avatar) returned by stored-agent list and detail endpoints. ([#17205](https://github.com/mastra-ai/mastra/pull/17205))

- Allow `workflows:execute` to authorize `POST /workflows/:workflowId/create-run` and `POST /workflows/events`. Both routes previously required `workflows:write` (which is intended for editing workflow definitions); they now accept either `workflows:write` or `workflows:execute`. This unblocks Studio's "Run workflow" flow for roles that only have `*:execute` (e.g. WorkOS `member`) and aligns the broker push endpoint's permission with what it actually does (advance runtime state). ([#17855](https://github.com/mastra-ai/mastra/pull/17855))

- Updated dependencies [[`d468acb`](https://github.com/mastra-ai/mastra/commit/d468acb07aec1bb19a2cb0ada8042b05b46746b2), [`575f815`](https://github.com/mastra-ai/mastra/commit/575f815c5c3567b71c0b83cbb7fa98c8253a9d9c), [`34839c1`](https://github.com/mastra-ai/mastra/commit/34839c1910b6964bf59ed0cee58844efebbb684e), [`053735a`](https://github.com/mastra-ai/mastra/commit/053735a75c2c18e23ce34d9468007efa4a45f4c4), [`306909a`](https://github.com/mastra-ai/mastra/commit/306909a693de77d709b38706e2673c9547d24a28), [`5191af8`](https://github.com/mastra-ai/mastra/commit/5191af80c799eea25357c545fc05d91b3883531d), [`43bd3d4`](https://github.com/mastra-ai/mastra/commit/43bd3d421987463fdf35386a45199c49499ed069), [`e6fa79e`](https://github.com/mastra-ai/mastra/commit/e6fa79ec72a2ddffdd25e85270398951e9d552a4), [`904bcdf`](https://github.com/mastra-ai/mastra/commit/904bcdf7b8004aa7be823f9f70ca63580e47e470), [`7f5ee1d`](https://github.com/mastra-ai/mastra/commit/7f5ee1dca46daee8d2817f2ebe49e6335da81956), [`1e9aab5`](https://github.com/mastra-ai/mastra/commit/1e9aab50ff11e6e88fde4d7cbf512c44a9fe8d61), [`2bccba4`](https://github.com/mastra-ai/mastra/commit/2bccba4c03cadc815c2d54cbf4dd43a922140a8d), [`bf8eb6d`](https://github.com/mastra-ai/mastra/commit/bf8eb6d0ec213a403eb9265a594ad283c44ab3dc), [`e9be4e7`](https://github.com/mastra-ai/mastra/commit/e9be4e747ec3d8b65548bff92f9377db06105376), [`493a328`](https://github.com/mastra-ai/mastra/commit/493a328f4346a1deeb9f1e2e44c8f2a3a4d7591b), [`d53cfc2`](https://github.com/mastra-ai/mastra/commit/d53cfc2c7f8d78343a4aa84ec4e129ba25f3325e), [`65799d4`](https://github.com/mastra-ai/mastra/commit/65799d4d549e5ebb9c848fbe3f51ac090f64becf), [`c268c89`](https://github.com/mastra-ai/mastra/commit/c268c89f4c63a93ee474d3cffdf3ea60bf00d4f2), [`34839c1`](https://github.com/mastra-ai/mastra/commit/34839c1910b6964bf59ed0cee58844efebbb684e), [`014e00f`](https://github.com/mastra-ai/mastra/commit/014e00f2b3a597a016b72f9901c6ab27d491f822), [`029a414`](https://github.com/mastra-ai/mastra/commit/029a4141719793bd3e898a39eb5a0466a55f5f3a), [`d468acb`](https://github.com/mastra-ai/mastra/commit/d468acb07aec1bb19a2cb0ada8042b05b46746b2), [`b147b29`](https://github.com/mastra-ai/mastra/commit/b147b2907f0cd1aa812efe6d6e3f58d22e66fc88), [`d371ac1`](https://github.com/mastra-ai/mastra/commit/d371ac1d9820afaaf7cfdbc380a475946a994d8f), [`2bccba4`](https://github.com/mastra-ai/mastra/commit/2bccba4c03cadc815c2d54cbf4dd43a922140a8d), [`0c72f03`](https://github.com/mastra-ai/mastra/commit/0c72f032abb13254df5a7856d64be2f207b8006d), [`cf182b7`](https://github.com/mastra-ai/mastra/commit/cf182b7fb495767946d9840ef29f19cfa906f31f), [`3b45ea9`](https://github.com/mastra-ai/mastra/commit/3b45ea95015557a6cb9d70dc5252af54ab1b78ac), [`a049c2a`](https://github.com/mastra-ai/mastra/commit/a049c2a9dfb41d0ee2e7a28874a88cd64fd5669f), [`f084be1`](https://github.com/mastra-ai/mastra/commit/f084be1fcbe33ad7480913e44d6130c421c0976f), [`b147b29`](https://github.com/mastra-ai/mastra/commit/b147b2907f0cd1aa812efe6d6e3f58d22e66fc88), [`2a96528`](https://github.com/mastra-ai/mastra/commit/2a9652848dfa3c5a2426f952e9d93554c26fd90f), [`f2ab060`](https://github.com/mastra-ai/mastra/commit/f2ab060162bea81505fda553e2cee29c1979fd04), [`5d302c8`](https://github.com/mastra-ai/mastra/commit/5d302c8eda1a6ac74eab5e442c4f64db6cc97a06), [`34839c1`](https://github.com/mastra-ai/mastra/commit/34839c1910b6964bf59ed0cee58844efebbb684e), [`a952852`](https://github.com/mastra-ai/mastra/commit/a952852c971a21fb646cd907c75fcf4443cdc963), [`2656d9c`](https://github.com/mastra-ai/mastra/commit/2656d9c2976d4f3354253bfbbbf9b88a1b2bbf34), [`63e3fe1`](https://github.com/mastra-ai/mastra/commit/63e3fe13cc1ea96f91d7c68aea92f400faf9e4da), [`1d4ce8d`](https://github.com/mastra-ai/mastra/commit/1d4ce8daaa54511f325c1b609d31b8e54009d677), [`8c68372`](https://github.com/mastra-ai/mastra/commit/8c68372e85fe0b066ec12c58bd29ffb93e54c552)]:
  - @mastra/core@1.42.0

## 1.42.0-alpha.4

### Minor Changes

- Added dual auth system for separate Studio and API authentication. ([#17722](https://github.com/mastra-ai/mastra/pull/17722))

  When configured, Studio and server (API) can use different auth providers:
  - `server.auth` handles API authentication (external customers)
  - `studio.auth` handles Studio authentication (internal team)

  **Dual auth is opt-in:** If `studio.auth` is not configured, Studio requests fall back to `server.auth` for backward compatibility. To enable strict separation, configure both.

  **Example**

  ```typescript
  const mastra = new Mastra({
    server: {
      auth: new MastraAuthWorkos({ ... }), // External customers
    },
    studio: {
      auth: new MastraAuthOkta({ ... }), // Internal team
      rbac: new StaticRBACProvider({
        roles: DEFAULT_ROLES,
        getUserRoles: (user) => [user.role],
      }),
    },
  });
  ```

  This pattern matches real-world SaaS architecture (e.g., Stripe, Supabase) with separate dashboard and API authentication.

### Patch Changes

- Added voice helpers to the React SDK and made agent text-to-speech audible. ([#17663](https://github.com/mastra-ai/mastra/pull/17663))

  The React SDK now exposes voice helpers: `useSpeechRecognition` for speech-to-text, `playStreamWithWebAudio` for buffered Web Audio playback from a `ReadableStream`, and `recordMicrophoneToFile` for capturing microphone audio. The `useSpeechRecognition` hook automatically uses an agent's voice provider when one is configured, and falls back to the browser's built-in speech recognition otherwise.

  ```tsx
  import { useSpeechRecognition } from '@mastra/react';

  function VoiceInput({ agentId }: { agentId?: string }) {
    const { start, stop, isListening, transcript } = useSpeechRecognition({ agentId });
    return <button onClick={isListening ? stop : start}>{transcript}</button>;
  }
  ```

  Also fixed agent text-to-speech being inaudible. The `voice/speak` route now returns a web-standard audio response (`Content-Type: audio/mpeg`) so server-side adapters pass raw audio bytes through to the client instead of JSON-encoding them. This also resolves `getReader` crashes when an agent speaks using providers like OpenAI voice.

- Fixed the Agent Builder selecting models from providers with no API key configured. The builder available-models list now only includes providers whose API key is set, so an agent created in the Agent Builder can no longer be assigned a model that can never run. ([#17725](https://github.com/mastra-ai/mastra/pull/17725))

- Allow `workflows:execute` to authorize `POST /workflows/:workflowId/create-run` and `POST /workflows/events`. Both routes previously required `workflows:write` (which is intended for editing workflow definitions); they now accept either `workflows:write` or `workflows:execute`. This unblocks Studio's "Run workflow" flow for roles that only have `*:execute` (e.g. WorkOS `member`) and aligns the broker push endpoint's permission with what it actually does (advance runtime state). ([#17855](https://github.com/mastra-ai/mastra/pull/17855))

- Updated dependencies [[`575f815`](https://github.com/mastra-ai/mastra/commit/575f815c5c3567b71c0b83cbb7fa98c8253a9d9c), [`306909a`](https://github.com/mastra-ai/mastra/commit/306909a693de77d709b38706e2673c9547d24a28), [`5191af8`](https://github.com/mastra-ai/mastra/commit/5191af80c799eea25357c545fc05d91b3883531d), [`43bd3d4`](https://github.com/mastra-ai/mastra/commit/43bd3d421987463fdf35386a45199c49499ed069), [`e6fa79e`](https://github.com/mastra-ai/mastra/commit/e6fa79ec72a2ddffdd25e85270398951e9d552a4), [`904bcdf`](https://github.com/mastra-ai/mastra/commit/904bcdf7b8004aa7be823f9f70ca63580e47e470), [`7f5ee1d`](https://github.com/mastra-ai/mastra/commit/7f5ee1dca46daee8d2817f2ebe49e6335da81956), [`1e9aab5`](https://github.com/mastra-ai/mastra/commit/1e9aab50ff11e6e88fde4d7cbf512c44a9fe8d61), [`bf8eb6d`](https://github.com/mastra-ai/mastra/commit/bf8eb6d0ec213a403eb9265a594ad283c44ab3dc), [`493a328`](https://github.com/mastra-ai/mastra/commit/493a328f4346a1deeb9f1e2e44c8f2a3a4d7591b), [`029a414`](https://github.com/mastra-ai/mastra/commit/029a4141719793bd3e898a39eb5a0466a55f5f3a), [`b147b29`](https://github.com/mastra-ai/mastra/commit/b147b2907f0cd1aa812efe6d6e3f58d22e66fc88), [`d371ac1`](https://github.com/mastra-ai/mastra/commit/d371ac1d9820afaaf7cfdbc380a475946a994d8f), [`cf182b7`](https://github.com/mastra-ai/mastra/commit/cf182b7fb495767946d9840ef29f19cfa906f31f), [`a049c2a`](https://github.com/mastra-ai/mastra/commit/a049c2a9dfb41d0ee2e7a28874a88cd64fd5669f), [`b147b29`](https://github.com/mastra-ai/mastra/commit/b147b2907f0cd1aa812efe6d6e3f58d22e66fc88), [`2a96528`](https://github.com/mastra-ai/mastra/commit/2a9652848dfa3c5a2426f952e9d93554c26fd90f), [`2656d9c`](https://github.com/mastra-ai/mastra/commit/2656d9c2976d4f3354253bfbbbf9b88a1b2bbf34), [`63e3fe1`](https://github.com/mastra-ai/mastra/commit/63e3fe13cc1ea96f91d7c68aea92f400faf9e4da), [`1d4ce8d`](https://github.com/mastra-ai/mastra/commit/1d4ce8daaa54511f325c1b609d31b8e54009d677), [`8c68372`](https://github.com/mastra-ai/mastra/commit/8c68372e85fe0b066ec12c58bd29ffb93e54c552)]:
  - @mastra/core@1.42.0-alpha.4

## 1.42.0-alpha.3

### Minor Changes

- **Added** author enrichment to the stored-agents list and get handlers. When an auth provider is configured, each agent record now includes a resolved `author` object alongside the existing `authorId`: ([#17205](https://github.com/mastra-ai/mastra/pull/17205))

  ```ts
  {
    id: 'agent_…',
    authorId: 'user_…',
   id, name?, email?, avatarUrl? } // new, optional
    // …
  }
  ```

  Lookups are deduplicated per request and use the provider's `getUsers` batch method when available, falling back to per-id `getUser` calls otherwise. The field is omitted when no auth provider is configured or the ID can't be resolved, so existing clients keep working unchanged.

### Patch Changes

- **Added** optional `getUsers(userIds)` batch lookup method to `IUserProvider`. Auth providers can implement it to resolve multiple users in a single call; providers that don't implement it continue to work via per-id `getUser` fallback. ([#17205](https://github.com/mastra-ai/mastra/pull/17205))

  ```ts
  // optional batch lookup, returns results positionally aligned to userIds
  const users = await provider.getUsers?.(['u_1', 'u_2', 'u_3']);
  ```

- **Added** optional `author` field on `StoredAgentResponse` so consumers can render the resolved author (name, email, avatar) returned by stored-agent list and detail endpoints. ([#17205](https://github.com/mastra-ai/mastra/pull/17205))

- Updated dependencies [[`34839c1`](https://github.com/mastra-ai/mastra/commit/34839c1910b6964bf59ed0cee58844efebbb684e), [`053735a`](https://github.com/mastra-ai/mastra/commit/053735a75c2c18e23ce34d9468007efa4a45f4c4), [`34839c1`](https://github.com/mastra-ai/mastra/commit/34839c1910b6964bf59ed0cee58844efebbb684e), [`34839c1`](https://github.com/mastra-ai/mastra/commit/34839c1910b6964bf59ed0cee58844efebbb684e), [`a952852`](https://github.com/mastra-ai/mastra/commit/a952852c971a21fb646cd907c75fcf4443cdc963)]:
  - @mastra/core@1.42.0-alpha.3

## 1.42.0-alpha.2

### Patch Changes

- Updated dependencies [[`014e00f`](https://github.com/mastra-ai/mastra/commit/014e00f2b3a597a016b72f9901c6ab27d491f822)]:
  - @mastra/core@1.42.0-alpha.2

## 1.42.0-alpha.1

### Patch Changes

- Updated dependencies [[`2bccba4`](https://github.com/mastra-ai/mastra/commit/2bccba4c03cadc815c2d54cbf4dd43a922140a8d), [`2bccba4`](https://github.com/mastra-ai/mastra/commit/2bccba4c03cadc815c2d54cbf4dd43a922140a8d), [`f2ab060`](https://github.com/mastra-ai/mastra/commit/f2ab060162bea81505fda553e2cee29c1979fd04), [`5d302c8`](https://github.com/mastra-ai/mastra/commit/5d302c8eda1a6ac74eab5e442c4f64db6cc97a06)]:
  - @mastra/core@1.42.0-alpha.1

## 1.42.0-alpha.0

### Minor Changes

- Add server endpoints so Studio can resolve agent-builder model availability and auth permission patterns without importing server-only EE code in the browser: ([#17489](https://github.com/mastra-ai/mastra/pull/17489))
  - `GET /editor/builder/models/available` returns the provider/model list already filtered by the active builder model policy (`requiresAuth: true`, `stored-agents:read`).
  - `GET /auth/permission-patterns` returns the valid permission-pattern strings. It is gated by `requiresAuth: true` with no finer-grained permission: the response is the non-sensitive route-permission vocabulary that every authenticated user needs to gate their own sidebar/redirects, and there is no narrower permission that fits.

  `@mastra/client-js` gains `getBuilderAvailableModels()` and `getPermissionPatterns()` to consume these endpoints.

  ```ts
  import { MastraClient } from '@mastra/client-js';

  const client = new MastraClient({ baseUrl: 'http://localhost:4111' });

  const { providers } = await client.getBuilderAvailableModels();
  const { patterns } = await client.getPermissionPatterns();
  ```

### Patch Changes

- Fixed the tools API endpoint to include dynamically created tools (e.g., MCP tools) alongside bundler-discovered tools. Previously, when the CLI bundler discovered tools, dynamically created tools registered via `new Mastra({ tools })` were silently dropped from the `/api/tools` response. Now both sources are merged, with bundler-discovered tools taking precedence on conflicts. ([#17535](https://github.com/mastra-ai/mastra/pull/17535))

- Added agent memory-support metadata to the agents API and client types. ([#17581](https://github.com/mastra-ai/mastra/pull/17581))

- Updated dependencies [[`d468acb`](https://github.com/mastra-ai/mastra/commit/d468acb07aec1bb19a2cb0ada8042b05b46746b2), [`e9be4e7`](https://github.com/mastra-ai/mastra/commit/e9be4e747ec3d8b65548bff92f9377db06105376), [`d53cfc2`](https://github.com/mastra-ai/mastra/commit/d53cfc2c7f8d78343a4aa84ec4e129ba25f3325e), [`65799d4`](https://github.com/mastra-ai/mastra/commit/65799d4d549e5ebb9c848fbe3f51ac090f64becf), [`c268c89`](https://github.com/mastra-ai/mastra/commit/c268c89f4c63a93ee474d3cffdf3ea60bf00d4f2), [`d468acb`](https://github.com/mastra-ai/mastra/commit/d468acb07aec1bb19a2cb0ada8042b05b46746b2), [`0c72f03`](https://github.com/mastra-ai/mastra/commit/0c72f032abb13254df5a7856d64be2f207b8006d), [`3b45ea9`](https://github.com/mastra-ai/mastra/commit/3b45ea95015557a6cb9d70dc5252af54ab1b78ac), [`f084be1`](https://github.com/mastra-ai/mastra/commit/f084be1fcbe33ad7480913e44d6130c421c0976f)]:
  - @mastra/core@1.42.0-alpha.0

## 1.41.0

### Minor Changes

- The `/agents/:agentId/stream` and `/agents/:agentId/resume-stream` endpoints now accept an `untilIdle` field in the request body. When set, the stream stays open across background-task continuations (same behavior as the `/stream-until-idle` endpoint). The dedicated `/stream-until-idle` and `/resume-stream-until-idle` endpoints remain available but are deprecated. ([#17536](https://github.com/mastra-ai/mastra/pull/17536))

  **Server example:**

  ```ts
  // POST /api/agents/:agentId/stream
  fetch(`/api/agents/${agentId}/stream`, {
    method: 'POST',
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Research solana for me' }],
      untilIdle: true, // or { maxIdleMs: 60000 }
    }),
  });
  ```

  **Client SDK:** `streamUntilIdle()` and `resumeStreamUntilIdle()` are deprecated — use `stream(messages, { untilIdle: true })` instead.

### Patch Changes

- Updated dependencies [[`f82cc72`](https://github.com/mastra-ai/mastra/commit/f82cc72edca0ce636fe18abaf2598d89a0c6bcca), [`fcf6027`](https://github.com/mastra-ai/mastra/commit/fcf602747f6771731dda268ff3493b836f9f0ee9)]:
  - @mastra/core@1.41.0

## 1.41.0-alpha.0

### Minor Changes

- The `/agents/:agentId/stream` and `/agents/:agentId/resume-stream` endpoints now accept an `untilIdle` field in the request body. When set, the stream stays open across background-task continuations (same behavior as the `/stream-until-idle` endpoint). The dedicated `/stream-until-idle` and `/resume-stream-until-idle` endpoints remain available but are deprecated. ([#17536](https://github.com/mastra-ai/mastra/pull/17536))

  **Server example:**

  ```ts
  // POST /api/agents/:agentId/stream
  fetch(`/api/agents/${agentId}/stream`, {
    method: 'POST',
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Research solana for me' }],
      untilIdle: true, // or { maxIdleMs: 60000 }
    }),
  });
  ```

  **Client SDK:** `streamUntilIdle()` and `resumeStreamUntilIdle()` are deprecated — use `stream(messages, { untilIdle: true })` instead.

### Patch Changes

- Updated dependencies [[`f82cc72`](https://github.com/mastra-ai/mastra/commit/f82cc72edca0ce636fe18abaf2598d89a0c6bcca), [`fcf6027`](https://github.com/mastra-ai/mastra/commit/fcf602747f6771731dda268ff3493b836f9f0ee9)]:
  - @mastra/core@1.41.0-alpha.0

## 1.40.0

### Patch Changes

- Updated dependencies [[`ae1fa3a`](https://github.com/mastra-ai/mastra/commit/ae1fa3a9c40510f1e068ffc2345cf09f9ee32b26)]:
  - @mastra/core@1.40.0

## 1.40.0-alpha.0

### Patch Changes

- Updated dependencies [[`ae1fa3a`](https://github.com/mastra-ai/mastra/commit/ae1fa3a9c40510f1e068ffc2345cf09f9ee32b26)]:
  - @mastra/core@1.40.0-alpha.0

## 1.39.0

### Minor Changes

- Added `GET /stored/agents/:storedAgentId/dependents` endpoint that lists agents ([#17183](https://github.com/mastra-ai/mastra/pull/17183))
  referencing a stored agent as a sub-agent.

  ```ts
  const { dependents, hiddenCount } = await client.getStoredAgent(id).dependents();
  // { dependents: [{ id: 'parent-1', name: 'Triager' }], hiddenCount: 2 }
  ```

  - `dependents` — caller-readable agents (public agents and the caller's own private
    agents) with `id` + `name`.
  - `hiddenCount` — cross-workspace dependents the caller cannot read, only surfaced
    when the target agent is public.

  Access mirrors `GET /stored/agents/:storedAgentId` — 404 when the caller cannot
  read the target.

### Patch Changes

- Fixed memory status incorrectly reporting memory as enabled for agents without memory configured. The /api/memory/status endpoint now returns false for a resolved agent that has no memory, even when the Mastra instance has storage configured. Previously, Studio would render memory UI for such agents. ([#17506](https://github.com/mastra-ai/mastra/pull/17506))

- Fixed subscribed client tools so browser-executed tool results continue through the existing thread subscription instead of opening and canceling a second stream. This prevents closed-stream errors in apps like Agent Builder when multiple client tools run during one response. ([#17532](https://github.com/mastra-ai/mastra/pull/17532))

- Updated dependencies [[`c973db4`](https://github.com/mastra-ai/mastra/commit/c973db428df1b564ff0c35d4b2a90e8f4f1e13fd), [`552285e`](https://github.com/mastra-ai/mastra/commit/552285e5af43cfc680a0972032cab8de8776c6a0), [`77e686c`](https://github.com/mastra-ai/mastra/commit/77e686c264e493e99ae5024e4dfe3ea5d5a09718), [`ece8dba`](https://github.com/mastra-ai/mastra/commit/ece8dba7ec1a5089eee8c33167cd762bfa91e509), [`e751af2`](https://github.com/mastra-ai/mastra/commit/e751af219433fbf4c7035b2d771b4c9ec8813b05), [`e2a8380`](https://github.com/mastra-ai/mastra/commit/e2a838017a7657850404c1e94c70d79ffdc6f14a), [`be3f1cd`](https://github.com/mastra-ai/mastra/commit/be3f1cd81f0e2a649e8eac15a024d542d814aef8), [`a34d9db`](https://github.com/mastra-ai/mastra/commit/a34d9dbc39fedb722f271318e9355ecee70489ab)]:
  - @mastra/core@1.39.0

## 1.39.0-alpha.0

### Minor Changes

- Added `GET /stored/agents/:storedAgentId/dependents` endpoint that lists agents ([#17183](https://github.com/mastra-ai/mastra/pull/17183))
  referencing a stored agent as a sub-agent.

  ```ts
  const { dependents, hiddenCount } = await client.getStoredAgent(id).dependents();
  // { dependents: [{ id: 'parent-1', name: 'Triager' }], hiddenCount: 2 }
  ```

  - `dependents` — caller-readable agents (public agents and the caller's own private
    agents) with `id` + `name`.
  - `hiddenCount` — cross-workspace dependents the caller cannot read, only surfaced
    when the target agent is public.

  Access mirrors `GET /stored/agents/:storedAgentId` — 404 when the caller cannot
  read the target.

### Patch Changes

- Fixed memory status incorrectly reporting memory as enabled for agents without memory configured. The /api/memory/status endpoint now returns false for a resolved agent that has no memory, even when the Mastra instance has storage configured. Previously, Studio would render memory UI for such agents. ([#17506](https://github.com/mastra-ai/mastra/pull/17506))

- Fixed subscribed client tools so browser-executed tool results continue through the existing thread subscription instead of opening and canceling a second stream. This prevents closed-stream errors in apps like Agent Builder when multiple client tools run during one response. ([#17532](https://github.com/mastra-ai/mastra/pull/17532))

- Updated dependencies [[`c973db4`](https://github.com/mastra-ai/mastra/commit/c973db428df1b564ff0c35d4b2a90e8f4f1e13fd), [`552285e`](https://github.com/mastra-ai/mastra/commit/552285e5af43cfc680a0972032cab8de8776c6a0), [`77e686c`](https://github.com/mastra-ai/mastra/commit/77e686c264e493e99ae5024e4dfe3ea5d5a09718), [`ece8dba`](https://github.com/mastra-ai/mastra/commit/ece8dba7ec1a5089eee8c33167cd762bfa91e509), [`e751af2`](https://github.com/mastra-ai/mastra/commit/e751af219433fbf4c7035b2d771b4c9ec8813b05), [`e2a8380`](https://github.com/mastra-ai/mastra/commit/e2a838017a7657850404c1e94c70d79ffdc6f14a), [`be3f1cd`](https://github.com/mastra-ai/mastra/commit/be3f1cd81f0e2a649e8eac15a024d542d814aef8), [`a34d9db`](https://github.com/mastra-ai/mastra/commit/a34d9dbc39fedb722f271318e9355ecee70489ab)]:
  - @mastra/core@1.39.0-alpha.0

## 1.38.0

### Minor Changes

- Added an agent override export API and server-side ownership enforcement. ([#17228](https://github.com/mastra-ai/mastra/pull/17228))

  The server and client now expose an agent override export endpoint so Studio can download an agent's overrides as JSON for review or commit workflows. Saves are enforced server-side against each agent's `editor` config, so only owned fields (instructions, tools, or tool descriptions) are persisted and fields locked by the `editor` config are stripped.

  The system packages response also reports the active editor `source` so clients can render the correct editing experience.

- Added `isZodError` helper and `ZodErrorLike` type, exported from `@mastra/server/server-adapter` (and `@mastra/server/handlers/error`). Use these instead of `instanceof ZodError` when handling validation errors in custom server adapters or middleware so the check survives consumers that pin a different `zod` package instance than the one bundled with `@mastra/server`. ([#17172](https://github.com/mastra-ai/mastra/pull/17172))

  ```ts
  import { isZodError } from '@mastra/server/server-adapter';

  try {
    await schema.parseAsync(input);
  } catch (error) {
    if (isZodError(error)) {
      // structural check — works across zod v3/v4 realms
      return formatValidationError(error);
    }
    throw error;
  }
  ```

  Underpins the fix for [#17167](https://github.com/mastra-ai/mastra/issues/17167).

- Add fire-and-forget workflow resume that returns immediately with `{ runId }` without awaiting the run output. ([#17230](https://github.com/mastra-ai/mastra/pull/17230))

  For `@mastra/inngest`, this skips the `getRunOutput()` polling that previously raced a realtime subscription against the Inngest runs API and could surface spurious 404s even though the durable workflow was running fine.
  - `Run.resumeAsync()` added to core: dispatches the resume in the background and returns `{ runId }` immediately. Engines that poll for results (Inngest) override it to skip polling entirely.
  - `InngestRun.resumeAsync()` sends the resume event and returns `{ runId }`, skipping polling. Send-time failures (bad payload, event send failure) still reject synchronously and roll back the snapshot.
  - New `POST /workflows/:workflowId/resume-no-wait` and `POST /agent-builder/:actionId/resume-no-wait` routes return `{ runId }` immediately.
  - New client SDK `run.resumeNoWait()` resolves with `{ runId }`.

  The existing `resumeAsync()` client/server surface is unchanged and still resolves with the full workflow result, so there is no breaking change.

  `resumeNoWait` is intentionally additive in v1. In Mastra v2 the fire-and-forget behavior is planned to become the default behavior of `resumeAsync()` (mirroring `start`/`resume` semantics), at which point `resumeNoWait` and the `resume-no-wait` routes will be removed. The code paths carry `TODO(v2)` comments documenting this consolidation.

- Add experimental HTTP message routes for agent threads. Servers now expose `POST /agents/:agentId/send-message` and `POST /agents/:agentId/queue-message` for message-first input while keeping `/agents/:agentId/signals` available for lower-level signals and compatibility. ([#17237](https://github.com/mastra-ai/mastra/pull/17237))

- Added a `PATCH /tool-providers/:providerId/connections/:connectionId` endpoint and matching client SDK method so authors can rename a connection's display label after creation. ([#17249](https://github.com/mastra-ai/mastra/pull/17249))

  **Rename a connection from the client SDK**

  ```ts
  import { MastraClient } from '@mastra/client-js';

  const client = new MastraClient({ baseUrl: '…' });

  await client.getToolProvider('composio').updateConnection('auth_abc', {
    label: 'Work inbox',
  });
  ```

  Pass `label: null` (or an empty string) to clear the existing label. Labels are 1–32 characters and accept letters, digits, spaces, underscores, and hyphens (`[A-Za-z0-9 _-]+`).

  **Ownership enforced server-side**

  Non-owners get a 403 unless they hold `tool-providers:admin`. Shared connections are reachable by every author. The label is stored on the connection row itself, so the rename flows to every agent that pins the connection — no per-agent edit needed.

- Added the v1 ToolProvider runtime, server routes, client SDK methods, and editor wiring that power OAuth-backed integrations on stored agents. ([#17248](https://github.com/mastra-ai/mastra/pull/17248))

  **Stored agents can now pin OAuth connections per toolkit**

  A stored agent's config accepts a new `toolProviders` shape that tells the runtime which connection to bind for each toolkit at execution time. Connections can be scoped per-author, shared across an org, or supplied by the caller.

  ```ts
  {
    toolProviders: {
      composio: {
        connections: {
          gmail: [{ kind: 'author', toolkit: 'gmail', connectionId: 'auth_abc', scope: 'per-author' }],
        },
        tools: {
          GMAIL_FETCH_EMAILS: { toolkit: 'gmail' },
        },
      },
    },
  }
  ```

  **New client SDK surface for managing connections**

  ```ts
  import { MastraClient } from '@mastra/client-js';

  const client = new MastraClient({ baseUrl: '…' });
  const composio = client.toolProvider('composio');

  const { items } = await composio.listConnections({ toolkit: 'gmail' });
  await composio.disconnectConnection('auth_abc');
  ```

  **New `ToolProvider` interface for custom providers**

  Providers implement a VNext surface (`listToolkitsVNext`, `listToolsVNext`, `resolveToolsVNext`) plus the auth round-trip (`authorize`, `getAuthStatus`, `listConnections`, `disconnectConnection`, `listConnectionFields`, `health`). The Composio provider has been rewritten on this surface; the older catalog methods remain as `@deprecated` shims for back-compat.

  Connections list responses use `page`/`perPage` pagination, matching the rest of the server surface.

  Both stored agents (`editor.agent.getById(...)`) and code-defined agents with stored overrides (`editor.agent.applyStoredOverrides(...)`) resolve `toolProviders` at request time, merging provider-resolved tools alongside code/registry/MCP/integration tools.

  Stored agents that don't set `toolProviders` continue to work unchanged. The Studio/Builder UI ships separately.

### Patch Changes

- Separated thread subscription cleanup from active-run aborts so closing or switching a listener only unsubscribes that listener, while explicit cancel still aborts the active run. ([#17310](https://github.com/mastra-ai/mastra/pull/17310))

- Added sseFlushOnConnect route option to scope the SSE connected comment to subscribe endpoints only ([#17158](https://github.com/mastra-ai/mastra/pull/17158))

- Added subscription-native tool approval APIs so approving or declining a tool call resumes through the active thread subscription instead of requiring a separate continuation stream. New messages are queued while a tool approval is waiting, preventing overlapping runs from duplicating approval requests. ([#17311](https://github.com/mastra-ai/mastra/pull/17311))

  ```ts
  await agent.sendToolApproval({
    resourceId: 'user-123',
    threadId: 'thread-123',
    toolCallId: 'tool-call-123',
    approved: true,
  });
  ```

- Moved shared voice primitives and route metadata into the new `@internal/voice` package so voice providers no longer depend on `@mastra/core` and server voice routes share the same route definitions. ([#16725](https://github.com/mastra-ai/mastra/pull/16725))

  `@mastra/core/voice` continues to re-export the voice APIs for backwards compatibility.

- Fix custom providers appearing twice in Studio's provider selector. ([#17441](https://github.com/mastra-ai/mastra/pull/17441))

  In dev mode, `GatewayRegistry` registers custom gateways so `PROVIDER_REGISTRY` already contains them with prefixed keys (e.g. `"melioffice/genai"`). The `/agents/providers` handler then called `gateway.fetchProviders()` again and re-added them, but the live call returns raw unprefixed keys (e.g. `"genai"`) which after prefixing produce the same key — however in some cases the keys differed, causing both entries to appear in the UI.

  The fix skips adding a provider from the live `fetchProviders()` call if it is already present in `allProviders` from `PROVIDER_REGISTRY`.

- Fixed a startup crash that affected deployments pinning an older `@mastra/core` version. The server now boots successfully even when the installed `@mastra/core` doesn't include the Agent Builder runtime. ([#17382](https://github.com/mastra-ai/mastra/pull/17382))

  **Symptom**

  Deployed servers failed to start with `ERR_MODULE_NOT_FOUND` pointing at `@mastra/core/dist/agent-builder/ee/index.js`, even on apps that never used the Agent Builder.

  **What changed**

  The server no longer eagerly loads the Agent Builder runtime at boot. It's loaded on demand, only when a request actually needs it on an app that has configured a `MastraEditor` with builder support.

  No application code changes required.

- Fixed sub-agent version resolution in supervisor mode. Sub-agents now inherit the parent's draft/published version semantics — when chatting in the editor (draft mode), sub-agents resolve to their latest draft version; in the main agent chat (published mode), sub-agents resolve to their published version. Previously, sub-agents without explicit per-agent version overrides always fell back to the code-defined default, ignoring the parent's version context. ([#17165](https://github.com/mastra-ai/mastra/pull/17165))

- Stored agent and skill POST, PATCH, and skill publish responses now include `isFavorited`, matching GET behavior. Clients can read favorite status from write responses without an extra GET request. ([#17246](https://github.com/mastra-ai/mastra/pull/17246))

  Under auth-off, write responses also omit `favoriteCount` to match GET, so the response shape is consistent across all single-entity endpoints.

- Fixed memory status reporting for agents that do not support Mastra memory. The memory status endpoint now preserves storage fallback for regular agents while allowing integrations to opt out of memory UI. ([#16906](https://github.com/mastra-ai/mastra/pull/16906))

- Scoped the SSE connected comment to subscribe routes only and added SSE comment passthrough for Fastify and NestJS adapters ([#17158](https://github.com/mastra-ai/mastra/pull/17158))

- Hardened v1 ToolProvider connection routes and SDK forwarding. ([#17248](https://github.com/mastra-ai/mastra/pull/17248))

  **Fail closed on unknown `connectionId`**

  `DELETE /tool-providers/:providerId/connections/:connectionId` and
  `GET …/usage` now return `403` when storage is configured but no persisted
  row matches the supplied `connectionId` and the caller isn't an admin.
  Previously these routes fell through to the caller's own `authorId`, which
  let non-admin callers probe (and trigger provider-side `revokeConnection`
  for) IDs that didn't belong to them.

  **Aligned authorize label validation with stored label rules**

  `POST /tool-providers/:providerId/authorize` now enforces the same label
  rules the stored `toolProviders` config uses (`min(1)`, `max(32)`,
  `/^[A-Za-z0-9 _-]+$/`). Labels that pass `authorize` are now guaranteed to
  pass downstream stored-agent validation.

  **SDK forwards `toolkit` on connection-scoped operations**

  `@mastra/client-js`:

  ```ts
  await client.toolProviders.get('composio').disconnectConnection('ca_xxx', {
    toolkit: 'gmail',
    force: true,
  });

  const usage = await client.toolProviders.get('composio').getConnectionUsage('ca_xxx', { toolkit: 'gmail' });
  ```

  `disconnectConnection` now forwards `params.toolkit` (previously dropped)
  and `getConnectionUsage` accepts an optional `{ toolkit }` parameter so
  toolkit-scoped connection lookups disambiguate correctly server-side.

- Lazy-load `@mastra/core/tool-provider` inside the tool-provider handler so ([#17248](https://github.com/mastra-ai/mastra/pull/17248))
  `@mastra/server` evaluates under any peer-compatible `@mastra/core` (peer floor
  remains `>=1.34.0-0`). The handler no longer imports `SHARED_BUCKET_ID` or
  `UnknownToolProviderError` at module load — `SHARED_BUCKET_ID` is mirrored as a
  local literal (verified in lockstep with core via a regression test), and
  `UnknownToolProviderError` is resolved via a cached `await import(...)` inside
  `resolveProvider` so the real class identity is preserved for `instanceof`.

  OSS users running `Mastra` without a `MastraEditor` are unaffected: every
  tool-provider route still short-circuits with HTTP 500 "Editor is not
  configured" via `requireEditor(...)` before any core/tool-provider value is
  touched. Users with a `MastraEditor` already pull a compatible core
  transitively through `@mastra/editor`. Tool-provider routes require the new
  core exports at request time only — older cores surface a clear runtime error
  instead of crashing the server at boot.

- Improved observability and error isolation in the v1 ToolProvider runtime. ([#17248](https://github.com/mastra-ai/mastra/pull/17248))

  **Better visibility into connection-scope misconfiguration**

  When an agent runs with a stored ToolProvider connection whose scope cannot be resolved from the request context, the runtime now logs a one-shot warning and falls back to a shared bucket instead of silently routing every caller to the same OAuth account. Multi-tenant deployments get a clear signal when their identity wiring isn't reaching the runtime.

  **One bad toolkit no longer disables sibling providers**

  If a provider returns more connections for a toolkit than its declared capabilities allow, the runtime now logs and skips that toolkit instead of throwing. Other providers and other toolkits on the same agent continue to resolve normally.

- Workflows now support an optional `metadata` field for attaching custom key-value data such as `displayName`, `author`, or `category`. Metadata is preserved through serialization and returned in workflow info API responses. ([#17355](https://github.com/mastra-ai/mastra/pull/17355))

  ```typescript
  // Define a workflow with metadata
  const myWorkflow = createWorkflow({
    id: 'data-processing',
    metadata: {
      displayName: 'Data Processing Pipeline',

      category: 'ETL',
    },
    inputSchema: z.object({ ... }),
    outputSchema: z.object({ ... }),
  });

  // Retrieve workflow info with metadata via the Mastra Server API
  const workflowInfo = await mastraClient.getWorkflow('data-processing');
  console.log(workflowInfo.metadata?.displayName); // "Data Processing Pipeline"
  ```

- Updated dependencies [[`fa63872`](https://github.com/mastra-ai/mastra/commit/fa6387280954e6b667bec5714b55ba082bc627ff), [`d779de3`](https://github.com/mastra-ai/mastra/commit/d779de3cd9d2e7ed8110547190e2f15e786a0e41), [`1750c97`](https://github.com/mastra-ai/mastra/commit/1750c975d6179fbf6db2813b15229d4f8f23fc55), [`9283971`](https://github.com/mastra-ai/mastra/commit/928397157009b4aef4d5fdf3a0a273cb371beb55), [`f07b646`](https://github.com/mastra-ai/mastra/commit/f07b64604ab7d25391179790b7fd4823df9e2dff), [`d8838ae`](https://github.com/mastra-ai/mastra/commit/d8838ae80b69780361693d27098f7f6684af12fe), [`40f9297`](https://github.com/mastra-ai/mastra/commit/40f9297003b921c62373d3e8d3a4bda76c9f6de3), [`19a8658`](https://github.com/mastra-ai/mastra/commit/19a86589c788ef48bb6c1b0612cc82a201857379), [`850af77`](https://github.com/mastra-ai/mastra/commit/850af7779cb87c350804488734544a5b1843de25), [`0f0d1ba`](https://github.com/mastra-ai/mastra/commit/0f0d1ba67bfcb2204e571401662f1eceefc03357), [`a18775a`](https://github.com/mastra-ai/mastra/commit/a18775a693172546ee2378d39b67d4e32895b251), [`1baf2d1`](https://github.com/mastra-ai/mastra/commit/1baf2d152c6881338ff8f114633d5316fe13dd15), [`8c31bcd`](https://github.com/mastra-ai/mastra/commit/8c31bcdb00e597880d5939b1b7d7566fbe5dacae), [`0e32507`](https://github.com/mastra-ai/mastra/commit/0e32507962cdfa5569b7bda5bc6fb3dd34e40b03), [`95b14cd`](https://github.com/mastra-ai/mastra/commit/95b14cdd820e86d97ac05fe568424c513a252e31), [`07c3de7`](https://github.com/mastra-ai/mastra/commit/07c3de7f7bc418beccaea3b5e6b7f7cdda79d492), [`0bf2d93`](https://github.com/mastra-ai/mastra/commit/0bf2d932d20e2936f2d9abb8c0a86e24fbc97ec6), [`7b0d34c`](https://github.com/mastra-ai/mastra/commit/7b0d34cfe4a2fce22ac86ae17404685ff67a2ddb), [`a659a77`](https://github.com/mastra-ai/mastra/commit/a659a779bdebe3a52a518c56d2260592d0240fe0), [`aa36be2`](https://github.com/mastra-ai/mastra/commit/aa36be23aa513b7dc53cb8ca16b7fab8f20e43ad), [`3332be9`](https://github.com/mastra-ai/mastra/commit/3332be9701ecd77aba840959d9a1d1ce7aef02d3), [`212c635`](https://github.com/mastra-ai/mastra/commit/212c635203e61d036ab41db8ff86c3893dc795b3), [`d8838ae`](https://github.com/mastra-ai/mastra/commit/d8838ae80b69780361693d27098f7f6684af12fe), [`9aa5a73`](https://github.com/mastra-ai/mastra/commit/9aa5a73e7e110f6e9365eec69364a33d5f03bb56), [`f73c789`](https://github.com/mastra-ai/mastra/commit/f73c789e8ef21561580395d2c410119cab5848c8), [`8bd16da`](https://github.com/mastra-ai/mastra/commit/8bd16da73a4cb874d739373643dbd6a6e7f88684), [`c8630f8`](https://github.com/mastra-ai/mastra/commit/c8630f80d4f40cb5d22e60ab162b618b1907167a), [`94dfef6`](https://github.com/mastra-ai/mastra/commit/94dfef6e2bf19a88467ea3940afcbce88a433f0f), [`47f71dc`](https://github.com/mastra-ai/mastra/commit/47f71dc6fbcbd12d71e21a979e676e20a02bd77d), [`50ceae2`](https://github.com/mastra-ai/mastra/commit/50ceae270878e2f8fb2b2c6c2faab09df0007c8a), [`a122f79`](https://github.com/mastra-ai/mastra/commit/a122f79427ae225ec79c7b2ed46278da48d04b17), [`8cdde58`](https://github.com/mastra-ai/mastra/commit/8cdde5875bbba6702d9df226f2b20232b8d75d6c), [`3a081c1`](https://github.com/mastra-ai/mastra/commit/3a081c1255c5ae8c99f6dad91cc612934ef6f2bd), [`49f8abc`](https://github.com/mastra-ai/mastra/commit/49f8abce8258e4f2f87bd326acfbdb641264a47c), [`847ff1e`](https://github.com/mastra-ai/mastra/commit/847ff1e0d94368d94b2e173e4e0908e115568ef3), [`0c1ed1d`](https://github.com/mastra-ai/mastra/commit/0c1ed1d00c7d87b5ac99ca95896211a2fa9189fa), [`259d409`](https://github.com/mastra-ai/mastra/commit/259d409a514174299dbde1ff5e1121209b3ba850), [`9e16c68`](https://github.com/mastra-ai/mastra/commit/9e16c6818b6485ccb43df28aba6f3a2219d28662), [`cefca33`](https://github.com/mastra-ai/mastra/commit/cefca33ae666e69810c935fedf95a929c173d1d7), [`d00e8c5`](https://github.com/mastra-ai/mastra/commit/d00e8c50daebe5bce5bf2f48bde39c86fc3d2fe4), [`36fa7e2`](https://github.com/mastra-ai/mastra/commit/36fa7e24d14e58a1eb46147097b32f583e5b8775), [`87e9774`](https://github.com/mastra-ai/mastra/commit/87e97741c1e493cd6d62f478eb810b49bda4d57c), [`65a72e7`](https://github.com/mastra-ai/mastra/commit/65a72e70c25eedea8ff985a6624b96be2850236b), [`fe9eacd`](https://github.com/mastra-ai/mastra/commit/fe9eacd9545a0a9d64aad31c9fa90294a425289e), [`4c02027`](https://github.com/mastra-ai/mastra/commit/4c020277235eaa6b1dc957c90ad0639eef213992), [`0f77241`](https://github.com/mastra-ai/mastra/commit/0f7724108806703799a8ba80ad0f09414afd5066), [`849efb9`](https://github.com/mastra-ai/mastra/commit/849efb9fca6dc976589c1f90a303fea618769109), [`92ff509`](https://github.com/mastra-ai/mastra/commit/92ff5098ef8a990438ca038077021a5f7541ec1d), [`3fce5e7`](https://github.com/mastra-ai/mastra/commit/3fce5e70d011d289043e75003ef3336ed4aa43c3), [`a763592`](https://github.com/mastra-ai/mastra/commit/a763592c3db46963ef1011cfe16fe372816e775e), [`db79c86`](https://github.com/mastra-ai/mastra/commit/db79c86c60723d57e02f9636ca2611bd4515f194), [`6855012`](https://github.com/mastra-ai/mastra/commit/685501247cc4717506f3e89beed03509d63a5370), [`80c7737`](https://github.com/mastra-ai/mastra/commit/80c7737e32d7917b5f356957d67c169d01744fd3), [`7fef31c`](https://github.com/mastra-ai/mastra/commit/7fef31c0d2a6d362a43a647a8a4f6ab893758a23), [`7fef31c`](https://github.com/mastra-ai/mastra/commit/7fef31c0d2a6d362a43a647a8a4f6ab893758a23), [`3f1cf47`](https://github.com/mastra-ai/mastra/commit/3f1cf476f74c1e4cc2df908837e05853a5347e31)]:
  - @mastra/core@1.38.0

## 1.38.0-alpha.9

### Patch Changes

- Updated dependencies [[`850af77`](https://github.com/mastra-ai/mastra/commit/850af7779cb87c350804488734544a5b1843de25), [`7b0d34c`](https://github.com/mastra-ai/mastra/commit/7b0d34cfe4a2fce22ac86ae17404685ff67a2ddb)]:
  - @mastra/core@1.38.0-alpha.9

## 1.38.0-alpha.8

### Patch Changes

- Updated dependencies [[`0c1ed1d`](https://github.com/mastra-ai/mastra/commit/0c1ed1d00c7d87b5ac99ca95896211a2fa9189fa), [`849efb9`](https://github.com/mastra-ai/mastra/commit/849efb9fca6dc976589c1f90a303fea618769109)]:
  - @mastra/core@1.38.0-alpha.8

## 1.38.0-alpha.7

### Patch Changes

- Fixed memory status reporting for agents that do not support Mastra memory. The memory status endpoint now preserves storage fallback for regular agents while allowing integrations to opt out of memory UI. ([#16906](https://github.com/mastra-ai/mastra/pull/16906))

- Updated dependencies:
  - @mastra/core@1.38.0-alpha.7

## 1.38.0-alpha.6

### Patch Changes

- Separated thread subscription cleanup from active-run aborts so closing or switching a listener only unsubscribes that listener, while explicit cancel still aborts the active run. ([#17310](https://github.com/mastra-ai/mastra/pull/17310))

- Added subscription-native tool approval APIs so approving or declining a tool call resumes through the active thread subscription instead of requiring a separate continuation stream. New messages are queued while a tool approval is waiting, preventing overlapping runs from duplicating approval requests. ([#17311](https://github.com/mastra-ai/mastra/pull/17311))

  ```ts
  await agent.sendToolApproval({
    resourceId: 'user-123',
    threadId: 'thread-123',
    toolCallId: 'tool-call-123',
    approved: true,
  });
  ```

- Fix custom providers appearing twice in Studio's provider selector. ([#17441](https://github.com/mastra-ai/mastra/pull/17441))

  In dev mode, `GatewayRegistry` registers custom gateways so `PROVIDER_REGISTRY` already contains them with prefixed keys (e.g. `"melioffice/genai"`). The `/agents/providers` handler then called `gateway.fetchProviders()` again and re-added them, but the live call returns raw unprefixed keys (e.g. `"genai"`) which after prefixing produce the same key — however in some cases the keys differed, causing both entries to appear in the UI.

  The fix skips adding a provider from the live `fetchProviders()` call if it is already present in `allProviders` from `PROVIDER_REGISTRY`.

- Fixed a startup crash that affected deployments pinning an older `@mastra/core` version. The server now boots successfully even when the installed `@mastra/core` doesn't include the Agent Builder runtime. ([#17382](https://github.com/mastra-ai/mastra/pull/17382))

  **Symptom**

  Deployed servers failed to start with `ERR_MODULE_NOT_FOUND` pointing at `@mastra/core/dist/agent-builder/ee/index.js`, even on apps that never used the Agent Builder.

  **What changed**

  The server no longer eagerly loads the Agent Builder runtime at boot. It's loaded on demand, only when a request actually needs it on an app that has configured a `MastraEditor` with builder support.

  No application code changes required.

- Updated dependencies [[`19a8658`](https://github.com/mastra-ai/mastra/commit/19a86589c788ef48bb6c1b0612cc82a201857379), [`a659a77`](https://github.com/mastra-ai/mastra/commit/a659a779bdebe3a52a518c56d2260592d0240fe0), [`3332be9`](https://github.com/mastra-ai/mastra/commit/3332be9701ecd77aba840959d9a1d1ce7aef02d3)]:
  - @mastra/core@1.38.0-alpha.6

## 1.38.0-alpha.5

### Minor Changes

- Added an agent override export API and server-side ownership enforcement. ([#17228](https://github.com/mastra-ai/mastra/pull/17228))

  The server and client now expose an agent override export endpoint so Studio can download an agent's overrides as JSON for review or commit workflows. Saves are enforced server-side against each agent's `editor` config, so only owned fields (instructions, tools, or tool descriptions) are persisted and fields locked by the `editor` config are stripped.

  The system packages response also reports the active editor `source` so clients can render the correct editing experience.

- Added a `PATCH /tool-providers/:providerId/connections/:connectionId` endpoint and matching client SDK method so authors can rename a connection's display label after creation. ([#17249](https://github.com/mastra-ai/mastra/pull/17249))

  **Rename a connection from the client SDK**

  ```ts
  import { MastraClient } from '@mastra/client-js';

  const client = new MastraClient({ baseUrl: '…' });

  await client.getToolProvider('composio').updateConnection('auth_abc', {
    label: 'Work inbox',
  });
  ```

  Pass `label: null` (or an empty string) to clear the existing label. Labels are 1–32 characters and accept letters, digits, spaces, underscores, and hyphens (`[A-Za-z0-9 _-]+`).

  **Ownership enforced server-side**

  Non-owners get a 403 unless they hold `tool-providers:admin`. Shared connections are reachable by every author. The label is stored on the connection row itself, so the rename flows to every agent that pins the connection — no per-agent edit needed.

### Patch Changes

- Updated dependencies [[`a18775a`](https://github.com/mastra-ai/mastra/commit/a18775a693172546ee2378d39b67d4e32895b251), [`1baf2d1`](https://github.com/mastra-ai/mastra/commit/1baf2d152c6881338ff8f114633d5316fe13dd15)]:
  - @mastra/core@1.38.0-alpha.5

## 1.38.0-alpha.4

### Minor Changes

- Added the v1 ToolProvider runtime, server routes, client SDK methods, and editor wiring that power OAuth-backed integrations on stored agents. ([#17248](https://github.com/mastra-ai/mastra/pull/17248))

  **Stored agents can now pin OAuth connections per toolkit**

  A stored agent's config accepts a new `toolProviders` shape that tells the runtime which connection to bind for each toolkit at execution time. Connections can be scoped per-author, shared across an org, or supplied by the caller.

  ```ts
  {
    toolProviders: {
      composio: {
        connections: {
          gmail: [{ kind: 'author', toolkit: 'gmail', connectionId: 'auth_abc', scope: 'per-author' }],
        },
        tools: {
          GMAIL_FETCH_EMAILS: { toolkit: 'gmail' },
        },
      },
    },
  }
  ```

  **New client SDK surface for managing connections**

  ```ts
  import { MastraClient } from '@mastra/client-js';

  const client = new MastraClient({ baseUrl: '…' });
  const composio = client.toolProvider('composio');

  const { items } = await composio.listConnections({ toolkit: 'gmail' });
  await composio.disconnectConnection('auth_abc');
  ```

  **New `ToolProvider` interface for custom providers**

  Providers implement a VNext surface (`listToolkitsVNext`, `listToolsVNext`, `resolveToolsVNext`) plus the auth round-trip (`authorize`, `getAuthStatus`, `listConnections`, `disconnectConnection`, `listConnectionFields`, `health`). The Composio provider has been rewritten on this surface; the older catalog methods remain as `@deprecated` shims for back-compat.

  Connections list responses use `page`/`perPage` pagination, matching the rest of the server surface.

  Both stored agents (`editor.agent.getById(...)`) and code-defined agents with stored overrides (`editor.agent.applyStoredOverrides(...)`) resolve `toolProviders` at request time, merging provider-resolved tools alongside code/registry/MCP/integration tools.

  Stored agents that don't set `toolProviders` continue to work unchanged. The Studio/Builder UI ships separately.

### Patch Changes

- Hardened v1 ToolProvider connection routes and SDK forwarding. ([#17248](https://github.com/mastra-ai/mastra/pull/17248))

  **Fail closed on unknown `connectionId`**

  `DELETE /tool-providers/:providerId/connections/:connectionId` and
  `GET …/usage` now return `403` when storage is configured but no persisted
  row matches the supplied `connectionId` and the caller isn't an admin.
  Previously these routes fell through to the caller's own `authorId`, which
  let non-admin callers probe (and trigger provider-side `revokeConnection`
  for) IDs that didn't belong to them.

  **Aligned authorize label validation with stored label rules**

  `POST /tool-providers/:providerId/authorize` now enforces the same label
  rules the stored `toolProviders` config uses (`min(1)`, `max(32)`,
  `/^[A-Za-z0-9 _-]+$/`). Labels that pass `authorize` are now guaranteed to
  pass downstream stored-agent validation.

  **SDK forwards `toolkit` on connection-scoped operations**

  `@mastra/client-js`:

  ```ts
  await client.toolProviders.get('composio').disconnectConnection('ca_xxx', {
    toolkit: 'gmail',
    force: true,
  });

  const usage = await client.toolProviders.get('composio').getConnectionUsage('ca_xxx', { toolkit: 'gmail' });
  ```

  `disconnectConnection` now forwards `params.toolkit` (previously dropped)
  and `getConnectionUsage` accepts an optional `{ toolkit }` parameter so
  toolkit-scoped connection lookups disambiguate correctly server-side.

- Lazy-load `@mastra/core/tool-provider` inside the tool-provider handler so ([#17248](https://github.com/mastra-ai/mastra/pull/17248))
  `@mastra/server` evaluates under any peer-compatible `@mastra/core` (peer floor
  remains `>=1.34.0-0`). The handler no longer imports `SHARED_BUCKET_ID` or
  `UnknownToolProviderError` at module load — `SHARED_BUCKET_ID` is mirrored as a
  local literal (verified in lockstep with core via a regression test), and
  `UnknownToolProviderError` is resolved via a cached `await import(...)` inside
  `resolveProvider` so the real class identity is preserved for `instanceof`.

  OSS users running `Mastra` without a `MastraEditor` are unaffected: every
  tool-provider route still short-circuits with HTTP 500 "Editor is not
  configured" via `requireEditor(...)` before any core/tool-provider value is
  touched. Users with a `MastraEditor` already pull a compatible core
  transitively through `@mastra/editor`. Tool-provider routes require the new
  core exports at request time only — older cores surface a clear runtime error
  instead of crashing the server at boot.

- Improved observability and error isolation in the v1 ToolProvider runtime. ([#17248](https://github.com/mastra-ai/mastra/pull/17248))

  **Better visibility into connection-scope misconfiguration**

  When an agent runs with a stored ToolProvider connection whose scope cannot be resolved from the request context, the runtime now logs a one-shot warning and falls back to a shared bucket instead of silently routing every caller to the same OAuth account. Multi-tenant deployments get a clear signal when their identity wiring isn't reaching the runtime.

  **One bad toolkit no longer disables sibling providers**

  If a provider returns more connections for a toolkit than its declared capabilities allow, the runtime now logs and skips that toolkit instead of throwing. Other providers and other toolkits on the same agent continue to resolve normally.

- Updated dependencies [[`50ed00c`](https://github.com/mastra-ai/mastra/commit/50ed00caa914a85969b33de83f26b48e328ef641), [`9283971`](https://github.com/mastra-ai/mastra/commit/928397157009b4aef4d5fdf3a0a273cb371beb55), [`0bf2d93`](https://github.com/mastra-ai/mastra/commit/0bf2d932d20e2936f2d9abb8c0a86e24fbc97ec6), [`94dfef6`](https://github.com/mastra-ai/mastra/commit/94dfef6e2bf19a88467ea3940afcbce88a433f0f), [`a122f79`](https://github.com/mastra-ai/mastra/commit/a122f79427ae225ec79c7b2ed46278da48d04b17), [`4c02027`](https://github.com/mastra-ai/mastra/commit/4c020277235eaa6b1dc957c90ad0639eef213992), [`6855012`](https://github.com/mastra-ai/mastra/commit/685501247cc4717506f3e89beed03509d63a5370), [`7fef31c`](https://github.com/mastra-ai/mastra/commit/7fef31c0d2a6d362a43a647a8a4f6ab893758a23), [`7fef31c`](https://github.com/mastra-ai/mastra/commit/7fef31c0d2a6d362a43a647a8a4f6ab893758a23)]:
  - @mastra/core@1.38.0-alpha.4

## 1.38.0-alpha.3

### Minor Changes

- Add fire-and-forget workflow resume that returns immediately with `{ runId }` without awaiting the run output. ([#17230](https://github.com/mastra-ai/mastra/pull/17230))

  For `@mastra/inngest`, this skips the `getRunOutput()` polling that previously raced a realtime subscription against the Inngest runs API and could surface spurious 404s even though the durable workflow was running fine.
  - `Run.resumeAsync()` added to core: dispatches the resume in the background and returns `{ runId }` immediately. Engines that poll for results (Inngest) override it to skip polling entirely.
  - `InngestRun.resumeAsync()` sends the resume event and returns `{ runId }`, skipping polling. Send-time failures (bad payload, event send failure) still reject synchronously and roll back the snapshot.
  - New `POST /workflows/:workflowId/resume-no-wait` and `POST /agent-builder/:actionId/resume-no-wait` routes return `{ runId }` immediately.
  - New client SDK `run.resumeNoWait()` resolves with `{ runId }`.

  The existing `resumeAsync()` client/server surface is unchanged and still resolves with the full workflow result, so there is no breaking change.

  `resumeNoWait` is intentionally additive in v1. In Mastra v2 the fire-and-forget behavior is planned to become the default behavior of `resumeAsync()` (mirroring `start`/`resume` semantics), at which point `resumeNoWait` and the `resume-no-wait` routes will be removed. The code paths carry `TODO(v2)` comments documenting this consolidation.

- Add experimental HTTP message routes for agent threads. Servers now expose `POST /agents/:agentId/send-message` and `POST /agents/:agentId/queue-message` for message-first input while keeping `/agents/:agentId/signals` available for lower-level signals and compatibility. ([#17237](https://github.com/mastra-ai/mastra/pull/17237))

### Patch Changes

- Stored agent and skill POST, PATCH, and skill publish responses now include `isFavorited`, matching GET behavior. Clients can read favorite status from write responses without an extra GET request. ([#17246](https://github.com/mastra-ai/mastra/pull/17246))

  Under auth-off, write responses also omit `favoriteCount` to match GET, so the response shape is consistent across all single-entity endpoints.

- Workflows now support an optional `metadata` field for attaching custom key-value data such as `displayName`, `author`, or `category`. Metadata is preserved through serialization and returned in workflow info API responses. ([#17355](https://github.com/mastra-ai/mastra/pull/17355))

  ```typescript
  // Define a workflow with metadata
  const myWorkflow = createWorkflow({
    id: 'data-processing',
    metadata: {
      displayName: 'Data Processing Pipeline',

      category: 'ETL',
    },
    inputSchema: z.object({ ... }),
    outputSchema: z.object({ ... }),
  });

  // Retrieve workflow info with metadata via the Mastra Server API
  const workflowInfo = await mastraClient.getWorkflow('data-processing');
  console.log(workflowInfo.metadata?.displayName); // "Data Processing Pipeline"
  ```

- Updated dependencies [[`8ace89d`](https://github.com/mastra-ai/mastra/commit/8ace89df77f762e622d3b9f7f65ad7524350d050), [`fa63872`](https://github.com/mastra-ai/mastra/commit/fa6387280954e6b667bec5714b55ba082bc627ff), [`f07b646`](https://github.com/mastra-ai/mastra/commit/f07b64604ab7d25391179790b7fd4823df9e2dff), [`d8838ae`](https://github.com/mastra-ai/mastra/commit/d8838ae80b69780361693d27098f7f6684af12fe), [`40f9297`](https://github.com/mastra-ai/mastra/commit/40f9297003b921c62373d3e8d3a4bda76c9f6de3), [`0f0d1ba`](https://github.com/mastra-ai/mastra/commit/0f0d1ba67bfcb2204e571401662f1eceefc03357), [`8c31bcd`](https://github.com/mastra-ai/mastra/commit/8c31bcdb00e597880d5939b1b7d7566fbe5dacae), [`95b14cd`](https://github.com/mastra-ai/mastra/commit/95b14cdd820e86d97ac05fe568424c513a252e31), [`aa36be2`](https://github.com/mastra-ai/mastra/commit/aa36be23aa513b7dc53cb8ca16b7fab8f20e43ad), [`212c635`](https://github.com/mastra-ai/mastra/commit/212c635203e61d036ab41db8ff86c3893dc795b3), [`d8838ae`](https://github.com/mastra-ai/mastra/commit/d8838ae80b69780361693d27098f7f6684af12fe), [`9aa5a73`](https://github.com/mastra-ai/mastra/commit/9aa5a73e7e110f6e9365eec69364a33d5f03bb56), [`f73c789`](https://github.com/mastra-ai/mastra/commit/f73c789e8ef21561580395d2c410119cab5848c8), [`8bd16da`](https://github.com/mastra-ai/mastra/commit/8bd16da73a4cb874d739373643dbd6a6e7f88684), [`c8630f8`](https://github.com/mastra-ai/mastra/commit/c8630f80d4f40cb5d22e60ab162b618b1907167a), [`47f71dc`](https://github.com/mastra-ai/mastra/commit/47f71dc6fbcbd12d71e21a979e676e20a02bd77d), [`50ceae2`](https://github.com/mastra-ai/mastra/commit/50ceae270878e2f8fb2b2c6c2faab09df0007c8a), [`8cdde58`](https://github.com/mastra-ai/mastra/commit/8cdde5875bbba6702d9df226f2b20232b8d75d6c), [`847ff1e`](https://github.com/mastra-ai/mastra/commit/847ff1e0d94368d94b2e173e4e0908e115568ef3), [`259d409`](https://github.com/mastra-ai/mastra/commit/259d409a514174299dbde1ff5e1121209b3ba850), [`9e16c68`](https://github.com/mastra-ai/mastra/commit/9e16c6818b6485ccb43df28aba6f3a2219d28662), [`cefca33`](https://github.com/mastra-ai/mastra/commit/cefca33ae666e69810c935fedf95a929c173d1d7), [`d00e8c5`](https://github.com/mastra-ai/mastra/commit/d00e8c50daebe5bce5bf2f48bde39c86fc3d2fe4), [`36fa7e2`](https://github.com/mastra-ai/mastra/commit/36fa7e24d14e58a1eb46147097b32f583e5b8775), [`87e9774`](https://github.com/mastra-ai/mastra/commit/87e97741c1e493cd6d62f478eb810b49bda4d57c), [`65a72e7`](https://github.com/mastra-ai/mastra/commit/65a72e70c25eedea8ff985a6624b96be2850236b), [`0f77241`](https://github.com/mastra-ai/mastra/commit/0f7724108806703799a8ba80ad0f09414afd5066), [`92ff509`](https://github.com/mastra-ai/mastra/commit/92ff5098ef8a990438ca038077021a5f7541ec1d), [`3fce5e7`](https://github.com/mastra-ai/mastra/commit/3fce5e70d011d289043e75003ef3336ed4aa43c3), [`a763592`](https://github.com/mastra-ai/mastra/commit/a763592c3db46963ef1011cfe16fe372816e775e), [`80c7737`](https://github.com/mastra-ai/mastra/commit/80c7737e32d7917b5f356957d67c169d01744fd3), [`3f1cf47`](https://github.com/mastra-ai/mastra/commit/3f1cf476f74c1e4cc2df908837e05853a5347e31)]:
  - @mastra/core@1.38.0-alpha.3

## 1.38.0-alpha.2

### Minor Changes

- Added `isZodError` helper and `ZodErrorLike` type, exported from `@mastra/server/server-adapter` (and `@mastra/server/handlers/error`). Use these instead of `instanceof ZodError` when handling validation errors in custom server adapters or middleware so the check survives consumers that pin a different `zod` package instance than the one bundled with `@mastra/server`. ([#17172](https://github.com/mastra-ai/mastra/pull/17172))

  ```ts
  import { isZodError } from '@mastra/server/server-adapter';

  try {
    await schema.parseAsync(input);
  } catch (error) {
    if (isZodError(error)) {
      // structural check — works across zod v3/v4 realms
      return formatValidationError(error);
    }
    throw error;
  }
  ```

  Underpins the fix for [#17167](https://github.com/mastra-ai/mastra/issues/17167).

### Patch Changes

- Updated dependencies [[`d779de3`](https://github.com/mastra-ai/mastra/commit/d779de3cd9d2e7ed8110547190e2f15e786a0e41), [`1750c97`](https://github.com/mastra-ai/mastra/commit/1750c975d6179fbf6db2813b15229d4f8f23fc55), [`0e32507`](https://github.com/mastra-ai/mastra/commit/0e32507962cdfa5569b7bda5bc6fb3dd34e40b03), [`3a081c1`](https://github.com/mastra-ai/mastra/commit/3a081c1255c5ae8c99f6dad91cc612934ef6f2bd), [`fe9eacd`](https://github.com/mastra-ai/mastra/commit/fe9eacd9545a0a9d64aad31c9fa90294a425289e), [`db79c86`](https://github.com/mastra-ai/mastra/commit/db79c86c60723d57e02f9636ca2611bd4515f194)]:
  - @mastra/core@1.38.0-alpha.2

## 1.37.2-alpha.1

### Patch Changes

- Added sseFlushOnConnect route option to scope the SSE connected comment to subscribe endpoints only ([#17158](https://github.com/mastra-ai/mastra/pull/17158))

- Fixed sub-agent version resolution in supervisor mode. Sub-agents now inherit the parent's draft/published version semantics — when chatting in the editor (draft mode), sub-agents resolve to their latest draft version; in the main agent chat (published mode), sub-agents resolve to their published version. Previously, sub-agents without explicit per-agent version overrides always fell back to the code-defined default, ignoring the parent's version context. ([#17165](https://github.com/mastra-ai/mastra/pull/17165))

- Scoped the SSE connected comment to subscribe routes only and added SSE comment passthrough for Fastify and NestJS adapters ([#17158](https://github.com/mastra-ai/mastra/pull/17158))

- Updated dependencies [[`49f8abc`](https://github.com/mastra-ai/mastra/commit/49f8abce8258e4f2f87bd326acfbdb641264a47c)]:
  - @mastra/core@1.37.2-alpha.1

## 1.37.2-alpha.0

### Patch Changes

- Moved shared voice primitives and route metadata into the new `@internal/voice` package so voice providers no longer depend on `@mastra/core` and server voice routes share the same route definitions. ([#16725](https://github.com/mastra-ai/mastra/pull/16725))

  `@mastra/core/voice` continues to re-export the voice APIs for backwards compatibility.

- Updated dependencies [[`07c3de7`](https://github.com/mastra-ai/mastra/commit/07c3de7f7bc418beccaea3b5e6b7f7cdda79d492)]:
  - @mastra/core@1.37.2-alpha.0

## 1.37.1

### Patch Changes

- Updated dependencies [[`21db1a4`](https://github.com/mastra-ai/mastra/commit/21db1a4b8ac058d5a4fbe38b516cc1b81e526915)]:
  - @mastra/core@1.37.1

## 1.37.0

### Minor Changes

- Connecting or disconnecting an agent through a channel (e.g. Slack) now requires the same write permission as editing the underlying stored agent. The check runs on `POST /channels/:platform/connect` and `POST /channels/:platform/:agentId/disconnect` whenever the target agent has a record in the stored-agents store. Callers without write access receive a `404 Not found`, matching the behavior of the stored-agent edit routes. Agents defined in code (no stored-agents record) are unaffected and continue to honor only the route's existing auth requirement. ([#16949](https://github.com/mastra-ai/mastra/pull/16949))

  The caller must either own the stored agent, have admin bypass, or hold `agents:edit` (or a scoped `agents:edit:<agentId>`).

  ```http
  POST /channels/slack/connect
  Authorization: Bearer <token-with-agents:edit>
  Content-Type: application/json

  { "agentId": "support-bot" }
  ```

  ```http
  POST /channels/slack/support-bot/disconnect
  Authorization: Bearer <token-with-agents:edit>
  ```

  `@mastra/core` is bumped as a patch to ship the regenerated permission definitions that back this check.

- Gate stored-workspace handlers by author. Previously any authenticated caller within a tenant could list, read, update, or delete another user's workspace. ([#16974](https://github.com/mastra-ai/mastra/pull/16974))

  **Behavior changes**
  - `POST /stored/workspaces` — server stamps `authorId` from the authenticated caller; any body-provided `authorId` is ignored.
  - `GET /stored/workspaces/:id`, `PATCH /stored/workspaces/:id`, `DELETE /stored/workspaces/:id` — return `404 Not found` unless the caller is the owner, an admin (`*`), or holds `stored-workspaces:<action>[:<id>]`.
  - `GET /stored/workspaces` — filters to the caller's own rows plus legacy unowned records; admins still see every row.
  - Legacy workspaces created before this change (no `authorId`) remain accessible to any authenticated caller for backwards compatibility.

  **Example**

  ```ts
  // Client POST body — authorId is ignored if sent
  await fetch('/stored/workspaces', {
    method: 'POST',
    body: JSON.stringify({ name: 'My workspace', authorId: 'someone-else' }),
  });

  // Stored row — authorId is stamped from the authenticated caller
  // {
  //   id: 'my-workspace',
  //   name: 'My workspace',
  //   authorId: 'user_abc123', // from requestContext, NOT from body
  //   ...
  // }
  ```

  **Migration**
  - Existing rows with `authorId === null/undefined` remain readable/writable by any authenticated caller — no action required for backwards compatibility.
  - To lock down legacy rows, backfill `authorId` directly in the `workspaces` table with the original creator's id.
  - For service accounts or tooling that need cross-user access, grant `stored-workspaces:*` (or per-id `stored-workspaces:<action>:<id>`) instead of relying on the legacy unowned bypass.
  - Admins (callers with `*`) continue to see and mutate every row regardless of `authorId`.

  The `@mastra/core` patch regenerates `permissions.generated.ts` to include the `auth` and `infrastructure` resources that already had routes on `main`.

- Agent Builder action routes (`/agent-builder/*`) are now registered automatically through the standard server route pipeline. Any adapter built on `@mastra/server` (Hono, Express, Fastify, Koa, etc.) serves the 15 `/agent-builder/*` endpoints without consumers wiring them manually. ([#17085](https://github.com/mastra-ai/mastra/pull/17085))

  **Example**

  ```ts
  import { MastraClient } from '@mastra/client-js';

  const client = new MastraClient({ baseUrl: 'http://localhost:4111' });

  // `/agent-builder/*` routes are now reachable out-of-the-box
  const actions = await client.getAgentBuilderActions();

  const action = client.getAgentBuilderAction('generate-agent');
  const { runId } = await action.createRun();
  const result = await action.startAsync({ inputData: { prompt: 'Build me an agent' } }, runId);
  ```

  **Why**

  Previously, `AGENT_BUILDER_ROUTES` was a type-only entry in the route registry to keep `@mastra/agent-builder` out of Cloudflare worker bundles. Consumers had to register the routes themselves to expose Agent Builder functionality. Lazy-loading of `@mastra/agent-builder` is preserved — handlers still resolve the workflow module on first request via dynamic `import()`, so Cloudflare bundles are unaffected.

  **New EE permissions**

  The following permissions are added to the EE registry. RBAC consumers with strict allowlists must grant these to retain access to builder action routes:
  - `agent-builder:read`
  - `agent-builder:write`
  - `agent-builder:execute`

  Two legacy stream routes (`STREAM_LEGACY_AGENT_BUILDER_ACTION_ROUTE`, `OBSERVE_STREAM_LEGACY_AGENT_BUILDER_ACTION_ROUTE`) are now registered through the standard pipeline as well.

### Patch Changes

- Developers can now cancel long-running custom API route work when clients disconnect. Node-based adapters pass abort signals into custom route handlers, clean up response streams correctly, and still surface upstream response body errors. ([#16335](https://github.com/mastra-ai/mastra/pull/16335))

  ```ts
  registerApiRoute('/stream', {
    method: 'GET',
    handler: async c => {
      const stream = await agent.stream(prompt, {
        abortSignal: c.req.raw.signal,
      });

      return stream.toTextStreamResponse();
    },
  });
  ```

- Made optional memory response fields optional in server schemas and generated client types. ([#17070](https://github.com/mastra-ai/mastra/pull/17070))

- Improved agent thread subscription resilience by keeping server streams active during idle periods and allowing the JavaScript client to reconnect when subscription streams close or resubscribe requests fail. ([#17045](https://github.com/mastra-ai/mastra/pull/17045))

  Enable automatic reconnection with `subscription.processDataStream({ onChunk: chunk => console.log(chunk), reconnect: true })`.

- Updated dependencies [[`cfa2e3a`](https://github.com/mastra-ai/mastra/commit/cfa2e3a5292322f48bb28b4d257d631da7f9d3cc), [`0cbece9`](https://github.com/mastra-ai/mastra/commit/0cbece9d832cb134a74cdbf3682d390a058215a4), [`2f5f58a`](https://github.com/mastra-ai/mastra/commit/2f5f58a9a8bb13bcdc6789db221eef7c9bf1ff02), [`7dfe1bc`](https://github.com/mastra-ai/mastra/commit/7dfe1bcfe71d261a6fd6bbf29b1dec49d78fb98f), [`ac442a4`](https://github.com/mastra-ai/mastra/commit/ac442a42fda0354ac2bcea772bf6691cb3e9dbb3), [`b7286f4`](https://github.com/mastra-ai/mastra/commit/b7286f4308267f5fd70e6bfee10dba9472640906), [`6096445`](https://github.com/mastra-ai/mastra/commit/60964459733f0ab384584d95e19c36607ffdf7b0), [`d72dc4b`](https://github.com/mastra-ai/mastra/commit/d72dc4b12d832546c05c20255fa96fe4eb515900), [`a481027`](https://github.com/mastra-ai/mastra/commit/a481027b549ba1018414990c8f045eaee7b9f413), [`1e5c067`](https://github.com/mastra-ai/mastra/commit/1e5c067d2e20a781af670578180d1ee249806d41), [`168fa09`](https://github.com/mastra-ai/mastra/commit/168fa09d6b39114cb8c13bd06f1dccb9bc81c6cd), [`df1947a`](https://github.com/mastra-ai/mastra/commit/df1947affa40f742067542251fac7ca759492ef4), [`ee59b74`](https://github.com/mastra-ai/mastra/commit/ee59b743ce73ad11784b4d9c6fbba8568edee1c8), [`a97b1a0`](https://github.com/mastra-ai/mastra/commit/a97b1a0abaed83946c3519d1e0f680d0815b8a67), [`008baaf`](https://github.com/mastra-ai/mastra/commit/008baafd8d851f831407045aebead5a2e3342eff), [`801baa0`](https://github.com/mastra-ai/mastra/commit/801baa07cccdbaec1d00942a92bdc831111744a2), [`8116436`](https://github.com/mastra-ai/mastra/commit/81164363eb225d774e41ff27da6a5ea611406688), [`c35b962`](https://github.com/mastra-ai/mastra/commit/c35b9625c7e854fcfdeee226a3338a750d0ff211), [`c27c4b9`](https://github.com/mastra-ai/mastra/commit/c27c4b9f137df5414fca4e45896aceccff6b0ed5), [`08b3b59`](https://github.com/mastra-ai/mastra/commit/08b3b590dd960dee6c9a6e39272f8927d803db6e), [`b3c3b18`](https://github.com/mastra-ai/mastra/commit/b3c3b189121489a3a51a8fd8204b569be9a89fe5), [`4084113`](https://github.com/mastra-ai/mastra/commit/408411370fc48a822e8b616b3b63f9409774e0e9), [`70cb714`](https://github.com/mastra-ai/mastra/commit/70cb7149c8f16f478e15b58498254a53181750a4), [`91cf0e0`](https://github.com/mastra-ai/mastra/commit/91cf0e027e511b871481a8576b56b7af83b15afd), [`7f9da22`](https://github.com/mastra-ai/mastra/commit/7f9da22efd5aa595e138a31de55a5f0f2f28b33d)]:
  - @mastra/core@1.37.0

## 1.37.0-alpha.9

### Patch Changes

- Updated dependencies [[`d72dc4b`](https://github.com/mastra-ai/mastra/commit/d72dc4b12d832546c05c20255fa96fe4eb515900)]:
  - @mastra/core@1.37.0-alpha.9

## 1.37.0-alpha.8

### Minor Changes

- Agent Builder action routes (`/agent-builder/*`) are now registered automatically through the standard server route pipeline. Any adapter built on `@mastra/server` (Hono, Express, Fastify, Koa, etc.) serves the 15 `/agent-builder/*` endpoints without consumers wiring them manually. ([#17085](https://github.com/mastra-ai/mastra/pull/17085))

  **Example**

  ```ts
  import { MastraClient } from '@mastra/client-js';

  const client = new MastraClient({ baseUrl: 'http://localhost:4111' });

  // `/agent-builder/*` routes are now reachable out-of-the-box
  const actions = await client.getAgentBuilderActions();

  const action = client.getAgentBuilderAction('generate-agent');
  const { runId } = await action.createRun();
  const result = await action.startAsync({ inputData: { prompt: 'Build me an agent' } }, runId);
  ```

  **Why**

  Previously, `AGENT_BUILDER_ROUTES` was a type-only entry in the route registry to keep `@mastra/agent-builder` out of Cloudflare worker bundles. Consumers had to register the routes themselves to expose Agent Builder functionality. Lazy-loading of `@mastra/agent-builder` is preserved — handlers still resolve the workflow module on first request via dynamic `import()`, so Cloudflare bundles are unaffected.

  **New EE permissions**

  The following permissions are added to the EE registry. RBAC consumers with strict allowlists must grant these to retain access to builder action routes:
  - `agent-builder:read`
  - `agent-builder:write`
  - `agent-builder:execute`

  Two legacy stream routes (`STREAM_LEGACY_AGENT_BUILDER_ACTION_ROUTE`, `OBSERVE_STREAM_LEGACY_AGENT_BUILDER_ACTION_ROUTE`) are now registered through the standard pipeline as well.

### Patch Changes

- Made optional memory response fields optional in server schemas and generated client types. ([#17070](https://github.com/mastra-ai/mastra/pull/17070))

- Improved agent thread subscription resilience by keeping server streams active during idle periods and allowing the JavaScript client to reconnect when subscription streams close or resubscribe requests fail. ([#17045](https://github.com/mastra-ai/mastra/pull/17045))

  Enable automatic reconnection with `subscription.processDataStream({ onChunk: chunk => console.log(chunk), reconnect: true })`.

- Updated dependencies [[`c35b962`](https://github.com/mastra-ai/mastra/commit/c35b9625c7e854fcfdeee226a3338a750d0ff211), [`4084113`](https://github.com/mastra-ai/mastra/commit/408411370fc48a822e8b616b3b63f9409774e0e9)]:
  - @mastra/core@1.37.0-alpha.8

## 1.37.0-alpha.7

### Patch Changes

- Updated dependencies [[`168fa09`](https://github.com/mastra-ai/mastra/commit/168fa09d6b39114cb8c13bd06f1dccb9bc81c6cd)]:
  - @mastra/core@1.37.0-alpha.7

## 1.37.0-alpha.6

### Patch Changes

- Developers can now cancel long-running custom API route work when clients disconnect. Node-based adapters pass abort signals into custom route handlers, clean up response streams correctly, and still surface upstream response body errors. ([#16335](https://github.com/mastra-ai/mastra/pull/16335))

  ```ts
  registerApiRoute('/stream', {
    method: 'GET',
    handler: async c => {
      const stream = await agent.stream(prompt, {
        abortSignal: c.req.raw.signal,
      });

      return stream.toTextStreamResponse();
    },
  });
  ```

- Updated dependencies [[`0cbece9`](https://github.com/mastra-ai/mastra/commit/0cbece9d832cb134a74cdbf3682d390a058215a4), [`7dfe1bc`](https://github.com/mastra-ai/mastra/commit/7dfe1bcfe71d261a6fd6bbf29b1dec49d78fb98f), [`70cb714`](https://github.com/mastra-ai/mastra/commit/70cb7149c8f16f478e15b58498254a53181750a4), [`7f9da22`](https://github.com/mastra-ai/mastra/commit/7f9da22efd5aa595e138a31de55a5f0f2f28b33d)]:
  - @mastra/core@1.37.0-alpha.6

## 1.37.0-alpha.5

### Patch Changes

- Updated dependencies [[`6096445`](https://github.com/mastra-ai/mastra/commit/60964459733f0ab384584d95e19c36607ffdf7b0), [`91cf0e0`](https://github.com/mastra-ai/mastra/commit/91cf0e027e511b871481a8576b56b7af83b15afd)]:
  - @mastra/core@1.37.0-alpha.5

## 1.37.0-alpha.4

### Minor Changes

- Connecting or disconnecting an agent through a channel (e.g. Slack) now requires the same write permission as editing the underlying stored agent. The check runs on `POST /channels/:platform/connect` and `POST /channels/:platform/:agentId/disconnect` whenever the target agent has a record in the stored-agents store. Callers without write access receive a `404 Not found`, matching the behavior of the stored-agent edit routes. Agents defined in code (no stored-agents record) are unaffected and continue to honor only the route's existing auth requirement. ([#16949](https://github.com/mastra-ai/mastra/pull/16949))

  The caller must either own the stored agent, have admin bypass, or hold `agents:edit` (or a scoped `agents:edit:<agentId>`).

  ```http
  POST /channels/slack/connect
  Authorization: Bearer <token-with-agents:edit>
  Content-Type: application/json

  { "agentId": "support-bot" }
  ```

  ```http
  POST /channels/slack/support-bot/disconnect
  Authorization: Bearer <token-with-agents:edit>
  ```

  `@mastra/core` is bumped as a patch to ship the regenerated permission definitions that back this check.

- Gate stored-workspace handlers by author. Previously any authenticated caller within a tenant could list, read, update, or delete another user's workspace. ([#16974](https://github.com/mastra-ai/mastra/pull/16974))

  **Behavior changes**
  - `POST /stored/workspaces` — server stamps `authorId` from the authenticated caller; any body-provided `authorId` is ignored.
  - `GET /stored/workspaces/:id`, `PATCH /stored/workspaces/:id`, `DELETE /stored/workspaces/:id` — return `404 Not found` unless the caller is the owner, an admin (`*`), or holds `stored-workspaces:<action>[:<id>]`.
  - `GET /stored/workspaces` — filters to the caller's own rows plus legacy unowned records; admins still see every row.
  - Legacy workspaces created before this change (no `authorId`) remain accessible to any authenticated caller for backwards compatibility.

  **Example**

  ```ts
  // Client POST body — authorId is ignored if sent
  await fetch('/stored/workspaces', {
    method: 'POST',
    body: JSON.stringify({ name: 'My workspace', authorId: 'someone-else' }),
  });

  // Stored row — authorId is stamped from the authenticated caller
  // {
  //   id: 'my-workspace',
  //   name: 'My workspace',
  //   authorId: 'user_abc123', // from requestContext, NOT from body
  //   ...
  // }
  ```

  **Migration**
  - Existing rows with `authorId === null/undefined` remain readable/writable by any authenticated caller — no action required for backwards compatibility.
  - To lock down legacy rows, backfill `authorId` directly in the `workspaces` table with the original creator's id.
  - For service accounts or tooling that need cross-user access, grant `stored-workspaces:*` (or per-id `stored-workspaces:<action>:<id>`) instead of relying on the legacy unowned bypass.
  - Admins (callers with `*`) continue to see and mutate every row regardless of `authorId`.

  The `@mastra/core` patch regenerates `permissions.generated.ts` to include the `auth` and `infrastructure` resources that already had routes on `main`.

### Patch Changes

- Updated dependencies [[`b7286f4`](https://github.com/mastra-ai/mastra/commit/b7286f4308267f5fd70e6bfee10dba9472640906), [`a481027`](https://github.com/mastra-ai/mastra/commit/a481027b549ba1018414990c8f045eaee7b9f413), [`801baa0`](https://github.com/mastra-ai/mastra/commit/801baa07cccdbaec1d00942a92bdc831111744a2), [`b3c3b18`](https://github.com/mastra-ai/mastra/commit/b3c3b189121489a3a51a8fd8204b569be9a89fe5)]:
  - @mastra/core@1.37.0-alpha.4

## 1.37.0-alpha.3

### Patch Changes

- Updated dependencies [[`ac442a4`](https://github.com/mastra-ai/mastra/commit/ac442a42fda0354ac2bcea772bf6691cb3e9dbb3), [`1e5c067`](https://github.com/mastra-ai/mastra/commit/1e5c067d2e20a781af670578180d1ee249806d41), [`008baaf`](https://github.com/mastra-ai/mastra/commit/008baafd8d851f831407045aebead5a2e3342eff), [`8116436`](https://github.com/mastra-ai/mastra/commit/81164363eb225d774e41ff27da6a5ea611406688), [`c27c4b9`](https://github.com/mastra-ai/mastra/commit/c27c4b9f137df5414fca4e45896aceccff6b0ed5), [`08b3b59`](https://github.com/mastra-ai/mastra/commit/08b3b590dd960dee6c9a6e39272f8927d803db6e)]:
  - @mastra/core@1.37.0-alpha.3

## 1.37.0-alpha.2

### Patch Changes

- Updated dependencies [[`df1947a`](https://github.com/mastra-ai/mastra/commit/df1947affa40f742067542251fac7ca759492ef4), [`ee59b74`](https://github.com/mastra-ai/mastra/commit/ee59b743ce73ad11784b4d9c6fbba8568edee1c8), [`a97b1a0`](https://github.com/mastra-ai/mastra/commit/a97b1a0abaed83946c3519d1e0f680d0815b8a67)]:
  - @mastra/core@1.37.0-alpha.2

## 1.37.0-alpha.1

### Patch Changes

- Updated dependencies [[`2f5f58a`](https://github.com/mastra-ai/mastra/commit/2f5f58a9a8bb13bcdc6789db221eef7c9bf1ff02)]:
  - @mastra/core@1.37.0-alpha.1

## 1.36.1-alpha.0

### Patch Changes

- Updated dependencies [[`cfa2e3a`](https://github.com/mastra-ai/mastra/commit/cfa2e3a5292322f48bb28b4d257d631da7f9d3cc)]:
  - @mastra/core@1.36.1-alpha.0

## 1.36.0

### Minor Changes

- Added delta polling support for observability list endpoints. ([#16632](https://github.com/mastra-ai/mastra/pull/16632))

  ```ts
  const page = await client.observability.listTraces({
    mode: 'page',
    filters: { entityName: 'agent-1' },
  });

  const delta = await client.observability.listTraces({
    mode: 'delta',
    filters: { entityName: 'agent-1' },
    after: page.deltaCursor,
  });
  ```

  Use `mode: 'delta'` to fetch only new items after the last cursor.

  Page-mode responses include `pagination` and `deltaCursor` when delta polling is supported. Delta-mode responses include `delta` and do not include `pagination`.

  If you read these responses directly in typed code, note that `pagination` is only included in page mode.

- Added automatic FGA metadata for stored resource routes plus optional request scope isolation for stored resource APIs. Enable protected-route coverage with provider options: ([#16651](https://github.com/mastra-ai/mastra/pull/16651))

  ```ts
  const fga = new MastraFGAWorkos({
    resourceMapping,
    permissionMapping,
    requireForProtectedRoutes: true,
    auditProtectedRoutes: 'warn',
  });
  ```

- Added an HTTP surface for stored agents/skills/workspaces, plus introspection endpoints for the agent-builder and an external skill-registry proxy. Studio and the client SDK use these endpoints to back the new "stored entity" management UI. ([#16666](https://github.com/mastra-ai/mastra/pull/16666))

  ```http
  # Browse + manage stored entities (responses include favoriteCount + isFavorited)
  GET    /stored/agents?visibility=public&page=1&perPage=20
  GET    /stored/agents/:id
  POST   /stored/agents
  PATCH  /stored/agents/:id
  DELETE /stored/agents/:id

  # Versioning
  POST   /stored/skills/:id/publish
  POST   /stored/skills/:id/activate
  POST   /stored/skills/:id/restore

  # Favorites
  PUT    /stored/agents/:id/favorite
  DELETE /stored/agents/:id/favorite

  # Builder introspection
  GET    /editor/builder/settings
  GET    /editor/builder/infrastructure

  # External skill registry proxy (skills.sh)
  GET    /editor/builder/registries
  GET    /editor/builder/registries/:registryId/search
  GET    /editor/builder/registries/:registryId/popular
  GET    /editor/builder/registries/:registryId/skills/:owner/:repo/preview
  POST   /editor/builder/registries/:registryId/skills/:owner/:repo/install
  ```

  Highlights:
  - **Visibility + authorship gating.** Stored agents/skills now resolve a caller's author identity from the request context. Non-admin users only see their own + public entities. Admins see everything.
  - **Favorites.** List/get responses include `favoriteCount` and the caller's `isFavorited` flag. `PUT`/`DELETE /stored/{agents|skills}/:id/favorite` toggle the favorite for the caller.
  - **Avatar validation.** Stored-agent/skill metadata avatars are validated through a new `validateMetadataAvatarUrl` helper (rejects payloads over the size limit or with malformed base64).
  - **Model-policy enforcement.** Stored-agent create/update routes invoke `assertModelAllowed` via the new `resolveBuilderModelPolicy` helper. Disallowed models map to HTTP 422 with a structured body — `{ code, attempted, offendingLabel, allowed }` — via `handleError`'s new `ModelNotAllowedError` mapping.
  - **Builder introspection.** `GET /editor/builder/settings` returns feature flags, configuration, picker visibility, and model policy. `GET /editor/builder/infrastructure` reports browser-provider and sandbox status. Both default to `{ enabled: false }` when no `MastraEditor` is configured.
  - **External skill registry.** `/editor/builder/registries/*` proxies the public skills.sh catalog so the builder UI can browse and install registered skills.

  This also bumps the `@mastra/core` peer dependency floor to `>=1.34.0-0` (see the separate changeset) because the new handlers and error mapping import runtime values from `@mastra/core/agent-builder/ee`.

- Narrowed `AgentSignalContents` from `BaseMessageListInput` to `string | (TextPart | FilePart)[]`. ([#16622](https://github.com/mastra-ai/mastra/pull/16622))

  Fixed two signal-content bugs:
  - `user-message` signal attributes now reach the LLM
  - multimodal non-`user-message` signals no longer lose file parts

  Callers that previously passed wrapped message shapes to `agent.sendSignal` should now pass a bare string or a bare parts array.

  Before:
  `{ type: 'user-message', contents: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }] }`

  After:
  `{ type: 'user-message', contents: [{ type: 'text', text: 'hi' }] }`

  Added an optional `providerOptions` field to `agent.sendSignal` that flows through to the resulting prompt turn (as `providerOptions` on the LLM message) and is persisted on the stored signal message (as `content.providerMetadata`).

- Routes can now require **any one of multiple permissions** by passing an array to `requiresPermission`. When an array is provided, the request is allowed if the caller holds any of the listed permissions. Existing single-string usage continues to work. ([#16605](https://github.com/mastra-ai/mastra/pull/16605))

  ```ts
  // Before — single permission only
  {
    path: '/v1/things',
    method: 'GET',
    requiresPermission: 'things:read',
    handler,
  }

  // After — single permission or ANY-of array
  {
    path: '/v1/things/:id/stream',
    method: 'GET',
    requiresPermission: ['things:read', 'things:execute'],
    handler,
  }
  ```

  Denial messages now read `Missing required permission: a or b or c` when an array is used.

  **New endpoint**

  `GET /api/auth/roles/:roleId/permissions` returns the resolved permission list for a role. Useful for client-side gating and admin tooling.

  ```ts
  const res = await fetch('/api/auth/roles/admin/permissions', { credentials: 'include' });
  // { "roleId": "admin", "permissions": ["*"] }
  ```

  **Namespaced request-context keys (non-breaking)**

  `coreAuthMiddleware` now writes user state under namespaced keys (`mastra__user`, `mastra__userPermissions`, `mastra__userRoles`) in addition to the existing bare keys (`user`, `userPermissions`, `userRoles`). The bare keys are still written for backward compatibility, so existing middleware, integrations, and built-in handlers that read `requestContext.get('user')` continue to work unchanged.

  New code should prefer the namespaced constants to avoid collisions with caller-supplied request-context entries:

  ```ts
  import { MASTRA_USER_KEY, MASTRA_USER_PERMISSIONS_KEY, MASTRA_USER_ROLES_KEY } from '@mastra/server/auth';

  const user = requestContext.get(MASTRA_USER_KEY);
  const permissions = requestContext.get(MASTRA_USER_PERMISSIONS_KEY) as string[] | undefined;
  const roles = requestContext.get(MASTRA_USER_ROLES_KEY) as string[] | undefined;
  ```

  The bare keys (`user`, `userPermissions`, `userRoles`) remain populated and are considered the documented public surface for this release; a future major release may deprecate them.

  **Route permission derivation**

  `getEffectivePermission()` now recognizes stored resource families (`stored-agents`, `stored-skills`, `stored-prompt-blocks`, `stored-mcp-clients`, `stored-scorers`, `stored-workspaces`) and `publish` / `activate` / `restore` action suffixes on stored-resource routes. Return type widened to `string | string[] | null` to support routes that map to multiple permissions.

### Patch Changes

- Fixed stored resource updates to preserve existing metadata keys. ([#16651](https://github.com/mastra-ai/mastra/pull/16651))

- Hardened the stored-agent and stored-skill favorite toggle endpoints (`PUT`/`DELETE /stored/{agents,skills}/:id/favorite`) so callers can no longer favorite or unfavorite entities outside their tenant scope. ([#16749](https://github.com/mastra-ai/mastra/pull/16749))

  Deployments that configure `storedResources.scope` now get the same 404-on-mismatch protection on favorite toggles that already applied to read/update/delete. Single-tenant deployments are unaffected.

  Also corrected JSDoc on stored-agent and stored-skill handlers to reference the canonical resource/action names (`stored-agents:read`, `stored-skills:write`).

- Fix DELETE custom routes forwarding JSON request bodies. ([#16857](https://github.com/mastra-ai/mastra/pull/16857))

- Fixed CompositeAuth incorrectly advertising SSO, session, and user provider capabilities when no inner provider supports them. Studio would show an SSO login button even when no provider had SSO configured, leading to 401 errors on login attempts. The duck-typing check now verifies that interface methods are actual functions rather than just present on the prototype chain. ([#16664](https://github.com/mastra-ai/mastra/pull/16664))

- Fixed provider and dataset item history response types to include fields returned by the API. ([#16213](https://github.com/mastra-ai/mastra/pull/16213))

- Widened `BrowserStreamConfig.getToolset` to support async lookup. Existing synchronous implementations continue to work — the type now accepts `MastraBrowser | undefined` or `Promise<MastraBrowser | undefined>`. ([#16778](https://github.com/mastra-ai/mastra/pull/16778))

  This unblocks server-adapter implementations that need to resolve agents asynchronously (for example, hydrating stored agents from storage on first browser-stream connection).

  ```ts
  import { setupBrowserStream } from '@mastra/server';

  await setupBrowserStream(app, {
    getToolset: async agentId => {
      const agent = await resolveAgent(agentId);
      return agent?.browser;
    },
    apiPrefix,
  });
  ```

- Align stored-entity authorship checks with their RBAC resource names. Stored-agent and stored-skill handlers were calling `hasAdminBypass` / `assertReadAccess` / `assertWriteAccess` / `resolveAuthorFilter` with `resource: 'agents'` and `resource: 'skills'`, but the routes are gated by `stored-agents:*` / `stored-skills:*` permissions. An admin granted `stored-agents:*` (or `stored-skills:*`) without the global `*` wildcard would pass route authorization but be treated as a non-admin inside the handler, so they could not list, read, or update private records owned by other users. Handlers now use `stored-agents` and `stored-skills` as the authorship resource string, matching the permission strings emitted by the route layer. ([#16666](https://github.com/mastra-ai/mastra/pull/16666))

- Restore backwards compatibility for the legacy `GET /api/memory/threads?orderBy=<field>&sortDirection=<dir>` query shape emitted by `@mastra/client-js` < 1.18 (and any hand-rolled HTTP clients written against pre-1.0 docs). Server 1.31.0 turned that shape into a hard 400 (`Invalid input: expected object, received undefined`); the legacy bare-string + `sortDirection` pair is now transparently fused into the current `{ orderBy: { field, direction } }` object shape before validation, so pinned clients keep working. ([#16745](https://github.com/mastra-ai/mastra/pull/16745))

  Current callers using bracket notation (`orderBy[field]=...&orderBy[direction]=...`) or a JSON-stringified `orderBy` are unaffected.

- Bumped the `@mastra/core` peer dependency floor from `>=1.32.0-0` to `>=1.34.0-0`. ([#16666](https://github.com/mastra-ai/mastra/pull/16666))

- Fixed the playground memory configuration display for agents using observationalMemory: true. ([#16213](https://github.com/mastra-ai/mastra/pull/16213))

- Updated dependencies [[`452036a`](https://github.com/mastra-ai/mastra/commit/452036a0d965b4f4c1efd93606e4f03b50b807a5), [`c272d50`](https://github.com/mastra-ai/mastra/commit/c272d50610a54496b6b6d92ccd4d37b333a2613a), [`27fd1b7`](https://github.com/mastra-ai/mastra/commit/27fd1b79ac62eb7694f92587eb7d1be05b59be01), [`5ba7253`](https://github.com/mastra-ai/mastra/commit/5ba7253745c85e8df8012a76d954c640ffa336f7), [`5556cc1`](https://github.com/mastra-ai/mastra/commit/5556cc1befec71518d84f826b3bfe3a079a9daf7), [`f73980d`](https://github.com/mastra-ai/mastra/commit/f73980d651eb5f7f1ab20582de4615a1b6f10fce), [`5499303`](https://github.com/mastra-ai/mastra/commit/54993032c1ebc09642625b78d2014e0cf84a3cae), [`a702009`](https://github.com/mastra-ai/mastra/commit/a702009d3cfaa745120f501e21c783ed4d6a3072), [`9aee493`](https://github.com/mastra-ai/mastra/commit/9aee493ed6089b5133472623dcce49934bf2d509), [`d8692af`](https://github.com/mastra-ai/mastra/commit/d8692afa253028e39cdce2aafa0ac414071a762e), [`1a9cc60`](https://github.com/mastra-ai/mastra/commit/1a9cc6069f9910fc3d59e4953ac8cd95d89ad6f5), [`8cdb86c`](https://github.com/mastra-ai/mastra/commit/8cdb86ceed1137bc2768e147dce85a0692b9fb26), [`8534d79`](https://github.com/mastra-ai/mastra/commit/8534d791fa1cb70fe1c19e2604c4b63cc10dd051), [`eda90c5`](https://github.com/mastra-ai/mastra/commit/eda90c5bfd7de11805ecc9f4552716c895fbaf78), [`a935b0a`](https://github.com/mastra-ai/mastra/commit/a935b0a0977ae3f196b33ec7621f528069c82db0), [`9c88701`](https://github.com/mastra-ai/mastra/commit/9c8870195b41a38dc40b6ba2aa55eda04df8fa69), [`c78f8cd`](https://github.com/mastra-ai/mastra/commit/c78f8cd6222a86e6c60ae5210b6929ad5221b6fb), [`e146aad`](https://github.com/mastra-ai/mastra/commit/e146aadbba66c410ba0e74bac4c50135495cb8dd), [`ac79462`](https://github.com/mastra-ai/mastra/commit/ac79462b98f1062394c45093aa515b0766f27ee2), [`1a0ec78`](https://github.com/mastra-ai/mastra/commit/1a0ec789a26cae443744e9abbd62ed6ee676af39), [`e47bca7`](https://github.com/mastra-ai/mastra/commit/e47bca7b72866d3abd173b9f530ac4318113a8ff), [`afc004f`](https://github.com/mastra-ai/mastra/commit/afc004f5cc7e30697809e7021820b9f5881e6719), [`0031d0f`](https://github.com/mastra-ai/mastra/commit/0031d0f13831d7843ac5d498734a7d92862e2ce3), [`841a222`](https://github.com/mastra-ai/mastra/commit/841a222560d8c19238f8213713f30535cdd82284), [`64c1e0b`](https://github.com/mastra-ai/mastra/commit/64c1e0b35165c96b659818bd0177aa18794ef11f), [`40d83a9`](https://github.com/mastra-ai/mastra/commit/40d83a90d9be31a1b83e04649edb703eb7753e33), [`4e88dc6`](https://github.com/mastra-ai/mastra/commit/4e88dc6b89f154c0eae37221c8126be0c23c569f), [`19018f0`](https://github.com/mastra-ai/mastra/commit/19018f05722af74a5978781a7731a654b26f7f2a), [`19281c7`](https://github.com/mastra-ai/mastra/commit/19281c70424f757219782de16c2699743c5e04d0), [`3498b49`](https://github.com/mastra-ai/mastra/commit/3498b4946be94f4313cd817733589680dcda5278), [`d52b6fe`](https://github.com/mastra-ai/mastra/commit/d52b6fe1c56853eb38864baae0bbfa75cc739ccb), [`408be73`](https://github.com/mastra-ai/mastra/commit/408be73449dfab92b51eab8c6623b6c443debc25), [`359439b`](https://github.com/mastra-ai/mastra/commit/359439bb8c635e048176306828195f8297f50021), [`71a820b`](https://github.com/mastra-ai/mastra/commit/71a820b2353fa1406772c50760a3732058a8b337), [`1698f5e`](https://github.com/mastra-ai/mastra/commit/1698f5ec141d34f22a873efdb145ce3cdf848a5e)]:
  - @mastra/core@1.36.0

## 1.36.0-alpha.10

### Patch Changes

- Fix DELETE custom routes forwarding JSON request bodies. ([#16857](https://github.com/mastra-ai/mastra/pull/16857))

- Updated dependencies [[`27fd1b7`](https://github.com/mastra-ai/mastra/commit/27fd1b79ac62eb7694f92587eb7d1be05b59be01), [`a702009`](https://github.com/mastra-ai/mastra/commit/a702009d3cfaa745120f501e21c783ed4d6a3072), [`8534d79`](https://github.com/mastra-ai/mastra/commit/8534d791fa1cb70fe1c19e2604c4b63cc10dd051), [`c78f8cd`](https://github.com/mastra-ai/mastra/commit/c78f8cd6222a86e6c60ae5210b6929ad5221b6fb), [`e146aad`](https://github.com/mastra-ai/mastra/commit/e146aadbba66c410ba0e74bac4c50135495cb8dd), [`1a0ec78`](https://github.com/mastra-ai/mastra/commit/1a0ec789a26cae443744e9abbd62ed6ee676af39), [`d52b6fe`](https://github.com/mastra-ai/mastra/commit/d52b6fe1c56853eb38864baae0bbfa75cc739ccb)]:
  - @mastra/core@1.36.0-alpha.10

## 1.36.0-alpha.9

### Patch Changes

- Fixed provider and dataset item history response types to include fields returned by the API. ([#16213](https://github.com/mastra-ai/mastra/pull/16213))

- Fixed the playground memory configuration display for agents using observationalMemory: true. ([#16213](https://github.com/mastra-ai/mastra/pull/16213))

- Updated dependencies [[`1698f5e`](https://github.com/mastra-ai/mastra/commit/1698f5ec141d34f22a873efdb145ce3cdf848a5e)]:
  - @mastra/core@1.36.0-alpha.9

## 1.36.0-alpha.8

### Patch Changes

- Updated dependencies [[`9aee493`](https://github.com/mastra-ai/mastra/commit/9aee493ed6089b5133472623dcce49934bf2d509)]:
  - @mastra/core@1.36.0-alpha.8

## 1.36.0-alpha.7

### Patch Changes

- Widened `BrowserStreamConfig.getToolset` to support async lookup. Existing synchronous implementations continue to work — the type now accepts `MastraBrowser | undefined` or `Promise<MastraBrowser | undefined>`. ([#16778](https://github.com/mastra-ai/mastra/pull/16778))

  This unblocks server-adapter implementations that need to resolve agents asynchronously (for example, hydrating stored agents from storage on first browser-stream connection).

  ```ts
  import { setupBrowserStream } from '@mastra/server';

  await setupBrowserStream(app, {
    getToolset: async agentId => {
      const agent = await resolveAgent(agentId);
      return agent?.browser;
    },
    apiPrefix,
  });
  ```

- Updated dependencies [[`a935b0a`](https://github.com/mastra-ai/mastra/commit/a935b0a0977ae3f196b33ec7621f528069c82db0)]:
  - @mastra/core@1.36.0-alpha.7

## 1.36.0-alpha.6

### Patch Changes

- Updated dependencies [[`71a820b`](https://github.com/mastra-ai/mastra/commit/71a820b2353fa1406772c50760a3732058a8b337)]:
  - @mastra/core@1.36.0-alpha.6

## 1.36.0-alpha.5

### Patch Changes

- Updated dependencies [[`ac79462`](https://github.com/mastra-ai/mastra/commit/ac79462b98f1062394c45093aa515b0766f27ee2), [`19281c7`](https://github.com/mastra-ai/mastra/commit/19281c70424f757219782de16c2699743c5e04d0)]:
  - @mastra/core@1.36.0-alpha.5

## 1.36.0-alpha.4

### Patch Changes

- Updated dependencies [[`c272d50`](https://github.com/mastra-ai/mastra/commit/c272d50610a54496b6b6d92ccd4d37b333a2613a), [`d8692af`](https://github.com/mastra-ai/mastra/commit/d8692afa253028e39cdce2aafa0ac414071a762e), [`841a222`](https://github.com/mastra-ai/mastra/commit/841a222560d8c19238f8213713f30535cdd82284)]:
  - @mastra/core@1.36.0-alpha.4

## 1.36.0-alpha.3

### Minor Changes

- Added delta polling support for observability list endpoints. ([#16632](https://github.com/mastra-ai/mastra/pull/16632))

  ```ts
  const page = await client.observability.listTraces({
    mode: 'page',
    filters: { entityName: 'agent-1' },
  });

  const delta = await client.observability.listTraces({
    mode: 'delta',
    filters: { entityName: 'agent-1' },
    after: page.deltaCursor,
  });
  ```

  Use `mode: 'delta'` to fetch only new items after the last cursor.

  Page-mode responses include `pagination` and `deltaCursor` when delta polling is supported. Delta-mode responses include `delta` and do not include `pagination`.

  If you read these responses directly in typed code, note that `pagination` is only included in page mode.

### Patch Changes

- Hardened the stored-agent and stored-skill favorite toggle endpoints (`PUT`/`DELETE /stored/{agents,skills}/:id/favorite`) so callers can no longer favorite or unfavorite entities outside their tenant scope. ([#16749](https://github.com/mastra-ai/mastra/pull/16749))

  Deployments that configure `storedResources.scope` now get the same 404-on-mismatch protection on favorite toggles that already applied to read/update/delete. Single-tenant deployments are unaffected.

  Also corrected JSDoc on stored-agent and stored-skill handlers to reference the canonical resource/action names (`stored-agents:read`, `stored-skills:write`).

- Restore backwards compatibility for the legacy `GET /api/memory/threads?orderBy=<field>&sortDirection=<dir>` query shape emitted by `@mastra/client-js` < 1.18 (and any hand-rolled HTTP clients written against pre-1.0 docs). Server 1.31.0 turned that shape into a hard 400 (`Invalid input: expected object, received undefined`); the legacy bare-string + `sortDirection` pair is now transparently fused into the current `{ orderBy: { field, direction } }` object shape before validation, so pinned clients keep working. ([#16745](https://github.com/mastra-ai/mastra/pull/16745))

  Current callers using bracket notation (`orderBy[field]=...&orderBy[direction]=...`) or a JSON-stringified `orderBy` are unaffected.

- Updated dependencies [[`5556cc1`](https://github.com/mastra-ai/mastra/commit/5556cc1befec71518d84f826b3bfe3a079a9daf7), [`5499303`](https://github.com/mastra-ai/mastra/commit/54993032c1ebc09642625b78d2014e0cf84a3cae), [`e47bca7`](https://github.com/mastra-ai/mastra/commit/e47bca7b72866d3abd173b9f530ac4318113a8ff), [`0031d0f`](https://github.com/mastra-ai/mastra/commit/0031d0f13831d7843ac5d498734a7d92862e2ce3), [`3498b49`](https://github.com/mastra-ai/mastra/commit/3498b4946be94f4313cd817733589680dcda5278), [`359439b`](https://github.com/mastra-ai/mastra/commit/359439bb8c635e048176306828195f8297f50021)]:
  - @mastra/core@1.36.0-alpha.3

## 1.36.0-alpha.2

### Minor Changes

- Added automatic FGA metadata for stored resource routes plus optional request scope isolation for stored resource APIs. Enable protected-route coverage with provider options: ([#16651](https://github.com/mastra-ai/mastra/pull/16651))

  ```ts
  const fga = new MastraFGAWorkos({
    resourceMapping,
    permissionMapping,
    requireForProtectedRoutes: true,
    auditProtectedRoutes: 'warn',
  });
  ```

- Added an HTTP surface for stored agents/skills/workspaces, plus introspection endpoints for the agent-builder and an external skill-registry proxy. Studio and the client SDK use these endpoints to back the new "stored entity" management UI. ([#16666](https://github.com/mastra-ai/mastra/pull/16666))

  ```http
  # Browse + manage stored entities (responses include favoriteCount + isFavorited)
  GET    /stored/agents?visibility=public&page=1&perPage=20
  GET    /stored/agents/:id
  POST   /stored/agents
  PATCH  /stored/agents/:id
  DELETE /stored/agents/:id

  # Versioning
  POST   /stored/skills/:id/publish
  POST   /stored/skills/:id/activate
  POST   /stored/skills/:id/restore

  # Favorites
  PUT    /stored/agents/:id/favorite
  DELETE /stored/agents/:id/favorite

  # Builder introspection
  GET    /editor/builder/settings
  GET    /editor/builder/infrastructure

  # External skill registry proxy (skills.sh)
  GET    /editor/builder/registries
  GET    /editor/builder/registries/:registryId/search
  GET    /editor/builder/registries/:registryId/popular
  GET    /editor/builder/registries/:registryId/skills/:owner/:repo/preview
  POST   /editor/builder/registries/:registryId/skills/:owner/:repo/install
  ```

  Highlights:
  - **Visibility + authorship gating.** Stored agents/skills now resolve a caller's author identity from the request context. Non-admin users only see their own + public entities. Admins see everything.
  - **Favorites.** List/get responses include `favoriteCount` and the caller's `isFavorited` flag. `PUT`/`DELETE /stored/{agents|skills}/:id/favorite` toggle the favorite for the caller.
  - **Avatar validation.** Stored-agent/skill metadata avatars are validated through a new `validateMetadataAvatarUrl` helper (rejects payloads over the size limit or with malformed base64).
  - **Model-policy enforcement.** Stored-agent create/update routes invoke `assertModelAllowed` via the new `resolveBuilderModelPolicy` helper. Disallowed models map to HTTP 422 with a structured body — `{ code, attempted, offendingLabel, allowed }` — via `handleError`'s new `ModelNotAllowedError` mapping.
  - **Builder introspection.** `GET /editor/builder/settings` returns feature flags, configuration, picker visibility, and model policy. `GET /editor/builder/infrastructure` reports browser-provider and sandbox status. Both default to `{ enabled: false }` when no `MastraEditor` is configured.
  - **External skill registry.** `/editor/builder/registries/*` proxies the public skills.sh catalog so the builder UI can browse and install registered skills.

  This also bumps the `@mastra/core` peer dependency floor to `>=1.34.0-0` (see the separate changeset) because the new handlers and error mapping import runtime values from `@mastra/core/agent-builder/ee`.

- Routes can now require **any one of multiple permissions** by passing an array to `requiresPermission`. When an array is provided, the request is allowed if the caller holds any of the listed permissions. Existing single-string usage continues to work. ([#16605](https://github.com/mastra-ai/mastra/pull/16605))

  ```ts
  // Before — single permission only
  {
    path: '/v1/things',
    method: 'GET',
    requiresPermission: 'things:read',
    handler,
  }

  // After — single permission or ANY-of array
  {
    path: '/v1/things/:id/stream',
    method: 'GET',
    requiresPermission: ['things:read', 'things:execute'],
    handler,
  }
  ```

  Denial messages now read `Missing required permission: a or b or c` when an array is used.

  **New endpoint**

  `GET /api/auth/roles/:roleId/permissions` returns the resolved permission list for a role. Useful for client-side gating and admin tooling.

  ```ts
  const res = await fetch('/api/auth/roles/admin/permissions', { credentials: 'include' });
  // { "roleId": "admin", "permissions": ["*"] }
  ```

  **Namespaced request-context keys (non-breaking)**

  `coreAuthMiddleware` now writes user state under namespaced keys (`mastra__user`, `mastra__userPermissions`, `mastra__userRoles`) in addition to the existing bare keys (`user`, `userPermissions`, `userRoles`). The bare keys are still written for backward compatibility, so existing middleware, integrations, and built-in handlers that read `requestContext.get('user')` continue to work unchanged.

  New code should prefer the namespaced constants to avoid collisions with caller-supplied request-context entries:

  ```ts
  import { MASTRA_USER_KEY, MASTRA_USER_PERMISSIONS_KEY, MASTRA_USER_ROLES_KEY } from '@mastra/server/auth';

  const user = requestContext.get(MASTRA_USER_KEY);
  const permissions = requestContext.get(MASTRA_USER_PERMISSIONS_KEY) as string[] | undefined;
  const roles = requestContext.get(MASTRA_USER_ROLES_KEY) as string[] | undefined;
  ```

  The bare keys (`user`, `userPermissions`, `userRoles`) remain populated and are considered the documented public surface for this release; a future major release may deprecate them.

  **Route permission derivation**

  `getEffectivePermission()` now recognizes stored resource families (`stored-agents`, `stored-skills`, `stored-prompt-blocks`, `stored-mcp-clients`, `stored-scorers`, `stored-workspaces`) and `publish` / `activate` / `restore` action suffixes on stored-resource routes. Return type widened to `string | string[] | null` to support routes that map to multiple permissions.

### Patch Changes

- Fixed stored resource updates to preserve existing metadata keys. ([#16651](https://github.com/mastra-ai/mastra/pull/16651))

- Align stored-entity authorship checks with their RBAC resource names. Stored-agent and stored-skill handlers were calling `hasAdminBypass` / `assertReadAccess` / `assertWriteAccess` / `resolveAuthorFilter` with `resource: 'agents'` and `resource: 'skills'`, but the routes are gated by `stored-agents:*` / `stored-skills:*` permissions. An admin granted `stored-agents:*` (or `stored-skills:*`) without the global `*` wildcard would pass route authorization but be treated as a non-admin inside the handler, so they could not list, read, or update private records owned by other users. Handlers now use `stored-agents` and `stored-skills` as the authorship resource string, matching the permission strings emitted by the route layer. ([#16666](https://github.com/mastra-ai/mastra/pull/16666))

- Bumped the `@mastra/core` peer dependency floor from `>=1.32.0-0` to `>=1.34.0-0`. ([#16666](https://github.com/mastra-ai/mastra/pull/16666))

- Updated dependencies [[`5ba7253`](https://github.com/mastra-ai/mastra/commit/5ba7253745c85e8df8012a76d954c640ffa336f7), [`f73980d`](https://github.com/mastra-ai/mastra/commit/f73980d651eb5f7f1ab20582de4615a1b6f10fce), [`9c88701`](https://github.com/mastra-ai/mastra/commit/9c8870195b41a38dc40b6ba2aa55eda04df8fa69), [`4e88dc6`](https://github.com/mastra-ai/mastra/commit/4e88dc6b89f154c0eae37221c8126be0c23c569f), [`19018f0`](https://github.com/mastra-ai/mastra/commit/19018f05722af74a5978781a7731a654b26f7f2a)]:
  - @mastra/core@1.36.0-alpha.2

## 1.36.0-alpha.1

### Patch Changes

- Updated dependencies [[`8cdb86c`](https://github.com/mastra-ai/mastra/commit/8cdb86ceed1137bc2768e147dce85a0692b9fb26), [`eda90c5`](https://github.com/mastra-ai/mastra/commit/eda90c5bfd7de11805ecc9f4552716c895fbaf78), [`afc004f`](https://github.com/mastra-ai/mastra/commit/afc004f5cc7e30697809e7021820b9f5881e6719), [`408be73`](https://github.com/mastra-ai/mastra/commit/408be73449dfab92b51eab8c6623b6c443debc25)]:
  - @mastra/core@1.36.0-alpha.1

## 1.36.0-alpha.0

### Minor Changes

- Narrowed `AgentSignalContents` from `BaseMessageListInput` to `string | (TextPart | FilePart)[]`. ([#16622](https://github.com/mastra-ai/mastra/pull/16622))

  Fixed two signal-content bugs:
  - `user-message` signal attributes now reach the LLM
  - multimodal non-`user-message` signals no longer lose file parts

  Callers that previously passed wrapped message shapes to `agent.sendSignal` should now pass a bare string or a bare parts array.

  Before:
  `{ type: 'user-message', contents: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }] }`

  After:
  `{ type: 'user-message', contents: [{ type: 'text', text: 'hi' }] }`

  Added an optional `providerOptions` field to `agent.sendSignal` that flows through to the resulting prompt turn (as `providerOptions` on the LLM message) and is persisted on the stored signal message (as `content.providerMetadata`).

### Patch Changes

- Fixed CompositeAuth incorrectly advertising SSO, session, and user provider capabilities when no inner provider supports them. Studio would show an SSO login button even when no provider had SSO configured, leading to 401 errors on login attempts. The duck-typing check now verifies that interface methods are actual functions rather than just present on the prototype chain. ([#16664](https://github.com/mastra-ai/mastra/pull/16664))

- Updated dependencies [[`452036a`](https://github.com/mastra-ai/mastra/commit/452036a0d965b4f4c1efd93606e4f03b50b807a5), [`1a9cc60`](https://github.com/mastra-ai/mastra/commit/1a9cc6069f9910fc3d59e4953ac8cd95d89ad6f5), [`64c1e0b`](https://github.com/mastra-ai/mastra/commit/64c1e0b35165c96b659818bd0177aa18794ef11f), [`40d83a9`](https://github.com/mastra-ai/mastra/commit/40d83a90d9be31a1b83e04649edb703eb7753e33)]:
  - @mastra/core@1.36.0-alpha.0

## 1.35.0

### Minor Changes

- Added FGA route policy coverage controls, built-in resource route metadata resolution, and resolver hooks. ([#16485](https://github.com/mastra-ai/mastra/pull/16485))

  For example:

  ```ts
  import { MastraFGAWorkos } from '@mastra/auth-workos';
  import type { FGARouteConfig, FGARouteResolver, IFGAProvider } from '@mastra/core/auth/ee';
  import { createRoute } from '@mastra/server/server-adapter';

  const routeFGA = {
    'GET /billing/:accountId': {
      resourceType: 'account',
      resourceIdParam: 'accountId',
      permission: 'billing:read',
    },
  } satisfies Record<string, FGARouteConfig>;

  const resolveRouteFGA: FGARouteResolver = ({ route }) => routeFGA[`${route.method} ${route.path}`];

  const fga: IFGAProvider = new MastraFGAWorkos({
    apiKey: process.env.WORKOS_API_KEY!,
    clientId: process.env.WORKOS_CLIENT_ID!,
    requireForProtectedRoutes: true,
    auditProtectedRoutes: 'warn',
    resolveRouteFGA,
    validatePermissions: async permissions => {
      /* validate mappings */
    },
  });

  export const getProjectRoute = createRoute({
    method: 'GET',
    path: '/projects/:projectId',
    responseType: 'json',
    requiresAuth: true,
    fga: {
      resourceType: 'project',
      resourceIdParam: 'projectId',
      permission: 'projects:read',
    },
    handler: async () => {
      return { project: null };
    },
  });
  ```

### Patch Changes

- Updated dependencies [[`b661349`](https://github.com/mastra-ai/mastra/commit/b661349281514691db78941a9044e6e4f1cde7a7), [`816b974`](https://github.com/mastra-ai/mastra/commit/816b974b424e4a1bfae3af30cc41263b6f1c0344), [`271c044`](https://github.com/mastra-ai/mastra/commit/271c044f6b79ff38cfa3409f4385fbd26a0f3185), [`bad08e9`](https://github.com/mastra-ai/mastra/commit/bad08e99c5291884c3ac76743c78c74f53a302c2), [`816b974`](https://github.com/mastra-ai/mastra/commit/816b974b424e4a1bfae3af30cc41263b6f1c0344), [`b32ba5f`](https://github.com/mastra-ai/mastra/commit/b32ba5fde524b46a4ff1bdf38e30d62a2bb29b04), [`75c7c38`](https://github.com/mastra-ai/mastra/commit/75c7c38a4e9af9821931539dd339f57fcc6414e3)]:
  - @mastra/core@1.35.0

## 1.35.0-alpha.3

### Patch Changes

- Updated dependencies [[`271c044`](https://github.com/mastra-ai/mastra/commit/271c044f6b79ff38cfa3409f4385fbd26a0f3185), [`75c7c38`](https://github.com/mastra-ai/mastra/commit/75c7c38a4e9af9821931539dd339f57fcc6414e3)]:
  - @mastra/core@1.35.0-alpha.3

## 1.35.0-alpha.2

### Patch Changes

- Updated dependencies [[`816b974`](https://github.com/mastra-ai/mastra/commit/816b974b424e4a1bfae3af30cc41263b6f1c0344), [`816b974`](https://github.com/mastra-ai/mastra/commit/816b974b424e4a1bfae3af30cc41263b6f1c0344), [`b32ba5f`](https://github.com/mastra-ai/mastra/commit/b32ba5fde524b46a4ff1bdf38e30d62a2bb29b04)]:
  - @mastra/core@1.35.0-alpha.2

## 1.35.0-alpha.1

### Minor Changes

- Added FGA route policy coverage controls, built-in resource route metadata resolution, and resolver hooks. ([#16485](https://github.com/mastra-ai/mastra/pull/16485))

  For example:

  ```ts
  import { MastraFGAWorkos } from '@mastra/auth-workos';
  import type { FGARouteConfig, FGARouteResolver, IFGAProvider } from '@mastra/core/auth/ee';
  import { createRoute } from '@mastra/server/server-adapter';

  const routeFGA = {
    'GET /billing/:accountId': {
      resourceType: 'account',
      resourceIdParam: 'accountId',
      permission: 'billing:read',
    },
  } satisfies Record<string, FGARouteConfig>;

  const resolveRouteFGA: FGARouteResolver = ({ route }) => routeFGA[`${route.method} ${route.path}`];

  const fga: IFGAProvider = new MastraFGAWorkos({
    apiKey: process.env.WORKOS_API_KEY!,
    clientId: process.env.WORKOS_CLIENT_ID!,
    requireForProtectedRoutes: true,
    auditProtectedRoutes: 'warn',
    resolveRouteFGA,
    validatePermissions: async permissions => {
      /* validate mappings */
    },
  });

  export const getProjectRoute = createRoute({
    method: 'GET',
    path: '/projects/:projectId',
    responseType: 'json',
    requiresAuth: true,
    fga: {
      resourceType: 'project',
      resourceIdParam: 'projectId',
      permission: 'projects:read',
    },
    handler: async () => {
      return { project: null };
    },
  });
  ```

### Patch Changes

- Updated dependencies [[`bad08e9`](https://github.com/mastra-ai/mastra/commit/bad08e99c5291884c3ac76743c78c74f53a302c2)]:
  - @mastra/core@1.35.0-alpha.1

## 1.34.1-alpha.0

### Patch Changes

- Updated dependencies [[`b661349`](https://github.com/mastra-ai/mastra/commit/b661349281514691db78941a9044e6e4f1cde7a7)]:
  - @mastra/core@1.34.1-alpha.0

## 1.34.0

### Minor Changes

- Added optional `metadata` to code-defined agents. Pass a `metadata` record to `new Agent({...})`, read it back with `agent.getMetadata()`, and clients can filter on it from the existing `/agents` and `/agents/:agentId` responses without encoding the data into IDs or names. ([#16603](https://github.com/mastra-ai/mastra/pull/16603))

  Metadata supports the same `DynamicArgument` form as other agent config fields, so it can also be resolved per request from the request context.

  Stored agents loaded via the editor also expose their metadata through `agent.getMetadata()`, so clients can filter these agents as well. Cloning a runtime agent via `editor.agent.clone()` now carries the source agent's metadata over to the stored clone when the caller does not provide one explicitly.

  ```ts
  // Static
  const supportAgent = new Agent({
    id: 'support-agent',
    name: 'Support Agent',
    instructions: 'You help customers with support requests.',
    model: 'openai/gpt-5',
    metadata: { type: 'support' },
  });

  supportAgent.getMetadata(); // { type: 'support' }

  // Dynamic
  const tenantAgent = new Agent({
    id: 'tenant-agent',
    name: 'Tenant Agent',
    instructions: 'You help customers with tenant-specific tasks.',
    model: 'openai/gpt-5',
    metadata: ({ requestContext }) => ({
      type: 'support',
      tenant: requestContext.get('tenant'),
    }),
  });

  await tenantAgent.getMetadata({ requestContext }); // { type: 'support', tenant: 'acme' }
  ```

### Patch Changes

- Expose `GET /observability/traces/light` and storage support for fetching paginated trace-list rows without span payload data. ([#16608](https://github.com/mastra-ai/mastra/pull/16608))

- `GET /api/observability/discovery/metric-names` and `GET /api/observability/discovery/metric-label-values` now accept `limit` as a URL query parameter without pre-parsing. Previously, passing `?limit=10` was rejected as a validation error; callers can now use these endpoints directly from HTTP clients, consistent with other query endpoints (e.g. pagination). ([#16489](https://github.com/mastra-ai/mastra/pull/16489))

- Fixed agent signal wakeups so idle runs receive request context values while preserving server-owned resource identifiers. ([#16557](https://github.com/mastra-ai/mastra/pull/16557))

- Updated dependencies [[`20787de`](https://github.com/mastra-ai/mastra/commit/20787de5965234a1af28fe35f49437c537dbfa0d), [`784ad98`](https://github.com/mastra-ai/mastra/commit/784ad989549de91dc5d33ab8ef36caa6f7dcd34e), [`fceae1f`](https://github.com/mastra-ai/mastra/commit/fceae1f5f5db4722cb078a663c6eb4bd22944123), [`090a647`](https://github.com/mastra-ai/mastra/commit/090a647ba5a66d36f203f9f49457e03a1ff4e6fb), [`bf02acb`](https://github.com/mastra-ai/mastra/commit/bf02acbb8a6110f638ac844e89f1ebf04cb7fe74), [`090a647`](https://github.com/mastra-ai/mastra/commit/090a647ba5a66d36f203f9f49457e03a1ff4e6fb), [`bdb4cbf`](https://github.com/mastra-ai/mastra/commit/bdb4cbf8ba4b685d7481f28bb9dc3de6c79c9ed2), [`0fd3fbe`](https://github.com/mastra-ai/mastra/commit/0fd3fbe40fb63657aedd72f6e7b38c8e8ee6940d), [`f84447d`](https://github.com/mastra-ai/mastra/commit/f84447d6c80f3471836a9b300d246b331fb47e0d), [`a1a5b3e`](https://github.com/mastra-ai/mastra/commit/a1a5b3e42ab2ca5161ea21db59ebf28442680fa7), [`af84f57`](https://github.com/mastra-ai/mastra/commit/af84f571ed762e92e8e61c5f9a72363520914274), [`8b3c6f9`](https://github.com/mastra-ai/mastra/commit/8b3c6f90f7879833ba7d1bc70937e1d8f69d0804), [`fed0475`](https://github.com/mastra-ai/mastra/commit/fed0475ccfea31e4fc251469ac05640d0742c1f0), [`0d53730`](https://github.com/mastra-ai/mastra/commit/0d53730c1ed87ef80c87caa5701c4170ea8028e6), [`522f44d`](https://github.com/mastra-ai/mastra/commit/522f44d947214bfc06cff50599bae1ef3494880d)]:
  - @mastra/core@1.34.0

## 1.34.0-alpha.3

### Minor Changes

- Added optional `metadata` to code-defined agents. Pass a `metadata` record to `new Agent({...})`, read it back with `agent.getMetadata()`, and clients can filter on it from the existing `/agents` and `/agents/:agentId` responses without encoding the data into IDs or names. ([#16603](https://github.com/mastra-ai/mastra/pull/16603))

  Metadata supports the same `DynamicArgument` form as other agent config fields, so it can also be resolved per request from the request context.

  Stored agents loaded via the editor also expose their metadata through `agent.getMetadata()`, so clients can filter these agents as well. Cloning a runtime agent via `editor.agent.clone()` now carries the source agent's metadata over to the stored clone when the caller does not provide one explicitly.

  ```ts
  // Static
  const supportAgent = new Agent({
    id: 'support-agent',
    name: 'Support Agent',
    instructions: 'You help customers with support requests.',
    model: 'openai/gpt-5',
    metadata: { type: 'support' },
  });

  supportAgent.getMetadata(); // { type: 'support' }

  // Dynamic
  const tenantAgent = new Agent({
    id: 'tenant-agent',
    name: 'Tenant Agent',
    instructions: 'You help customers with tenant-specific tasks.',
    model: 'openai/gpt-5',
    metadata: ({ requestContext }) => ({
      type: 'support',
      tenant: requestContext.get('tenant'),
    }),
  });

  await tenantAgent.getMetadata({ requestContext }); // { type: 'support', tenant: 'acme' }
  ```

### Patch Changes

- Expose `GET /observability/traces/light` and storage support for fetching paginated trace-list rows without span payload data. ([#16608](https://github.com/mastra-ai/mastra/pull/16608))

- `GET /api/observability/discovery/metric-names` and `GET /api/observability/discovery/metric-label-values` now accept `limit` as a URL query parameter without pre-parsing. Previously, passing `?limit=10` was rejected as a validation error; callers can now use these endpoints directly from HTTP clients, consistent with other query endpoints (e.g. pagination). ([#16489](https://github.com/mastra-ai/mastra/pull/16489))

- Updated dependencies [[`090a647`](https://github.com/mastra-ai/mastra/commit/090a647ba5a66d36f203f9f49457e03a1ff4e6fb), [`090a647`](https://github.com/mastra-ai/mastra/commit/090a647ba5a66d36f203f9f49457e03a1ff4e6fb), [`f84447d`](https://github.com/mastra-ai/mastra/commit/f84447d6c80f3471836a9b300d246b331fb47e0d), [`a1a5b3e`](https://github.com/mastra-ai/mastra/commit/a1a5b3e42ab2ca5161ea21db59ebf28442680fa7), [`af84f57`](https://github.com/mastra-ai/mastra/commit/af84f571ed762e92e8e61c5f9a72363520914274), [`8b3c6f9`](https://github.com/mastra-ai/mastra/commit/8b3c6f90f7879833ba7d1bc70937e1d8f69d0804)]:
  - @mastra/core@1.34.0-alpha.3

## 1.34.0-alpha.2

### Patch Changes

- Updated dependencies [[`bdb4cbf`](https://github.com/mastra-ai/mastra/commit/bdb4cbf8ba4b685d7481f28bb9dc3de6c79c9ed2)]:
  - @mastra/core@1.34.0-alpha.2

## 1.34.0-alpha.1

### Patch Changes

- Updated dependencies [[`fceae1f`](https://github.com/mastra-ai/mastra/commit/fceae1f5f5db4722cb078a663c6eb4bd22944123), [`bf02acb`](https://github.com/mastra-ai/mastra/commit/bf02acbb8a6110f638ac844e89f1ebf04cb7fe74), [`0fd3fbe`](https://github.com/mastra-ai/mastra/commit/0fd3fbe40fb63657aedd72f6e7b38c8e8ee6940d), [`fed0475`](https://github.com/mastra-ai/mastra/commit/fed0475ccfea31e4fc251469ac05640d0742c1f0), [`522f44d`](https://github.com/mastra-ai/mastra/commit/522f44d947214bfc06cff50599bae1ef3494880d)]:
  - @mastra/core@1.34.0-alpha.1

## 1.34.0-alpha.0

### Patch Changes

- Fixed agent signal wakeups so idle runs receive request context values while preserving server-owned resource identifiers. ([#16557](https://github.com/mastra-ai/mastra/pull/16557))

- Updated dependencies [[`20787de`](https://github.com/mastra-ai/mastra/commit/20787de5965234a1af28fe35f49437c537dbfa0d), [`784ad98`](https://github.com/mastra-ai/mastra/commit/784ad989549de91dc5d33ab8ef36caa6f7dcd34e), [`0d53730`](https://github.com/mastra-ai/mastra/commit/0d53730c1ed87ef80c87caa5701c4170ea8028e6)]:
  - @mastra/core@1.34.0-alpha.0

## 1.33.1

### Patch Changes

- Fix: the A2A `message/send` endpoint now accepts file and data message parts in addition to text. External A2A clients can attach files — either as URIs or base64-encoded bytes — and send structured data parts to a Mastra agent without hitting a JSON-RPC `-32602` invalid-params error. Unknown part kinds continue to return invalid-params, so strict validation is preserved. ([#16498](https://github.com/mastra-ai/mastra/pull/16498))

- Updated dependencies [[`6ba46dc`](https://github.com/mastra-ai/mastra/commit/6ba46dc1ac04af635d0f59377d7384ca6af44cd1), [`3e63fca`](https://github.com/mastra-ai/mastra/commit/3e63fca7aa41269b2a9518effdd09b8ab8f1ff04), [`bc386e0`](https://github.com/mastra-ai/mastra/commit/bc386e08249dd30f3e66cf59de0c151a8dc26afb)]:
  - @mastra/core@1.33.1

## 1.33.1-alpha.1

### Patch Changes

- Updated dependencies [[`3e63fca`](https://github.com/mastra-ai/mastra/commit/3e63fca7aa41269b2a9518effdd09b8ab8f1ff04), [`bc386e0`](https://github.com/mastra-ai/mastra/commit/bc386e08249dd30f3e66cf59de0c151a8dc26afb)]:
  - @mastra/core@1.33.1-alpha.1

## 1.33.1-alpha.0

### Patch Changes

- Updated dependencies [[`6ba46dc`](https://github.com/mastra-ai/mastra/commit/6ba46dc1ac04af635d0f59377d7384ca6af44cd1)]:
  - @mastra/core@1.33.1-alpha.0

## 1.33.0

### Minor Changes

- Added in-memory A2A push notification support for task updates. ([#16175](https://github.com/mastra-ai/mastra/pull/16175))

  Clients can now register push notification configs with `message/send`, `message/stream`, or the `tasks/pushNotificationConfig/*` methods. The server advertises push notification support in the agent card and sends the current task snapshot to registered webhooks when a task reaches `completed`, `failed`, `canceled`, or `input-required`.

  Webhook delivery validates the configured URL and pins outbound delivery to the validated address to reduce DNS rebinding risk. This remains in-memory and best-effort; operators should still use normal egress controls and avoid exposing push delivery to networks with sensitive internal services unless they trust the configured webhook targets.

  ```ts
  await a2a.setTaskPushNotificationConfig({
    taskId: 'task-123',
    pushNotificationConfig: {
      url: 'https://example.com/a2a-webhook',
      token: 'session-token',
    },
  });
  ```

- Allow stored Responses API follow-up requests to use `previous_response_id` without also passing `agent_id`. ([#16246](https://github.com/mastra-ai/mastra/pull/16246))

  When callers pass both `previous_response_id` and an explicit `agent_id`, mismatched agents now return a clear 400 response instead of looking like a missing stored response.

  The create-response schema now also rejects empty `agent_id` and `previous_response_id` strings.

- Added client, React, and Studio support for Agent signals in threaded chat. Threaded user messages now send through Agent signals, stream output is consumed from the thread subscription, echoed user messages are deduped by signal ID, file and image message contents are preserved, Studio can send follow-ups while a response is streaming, Studio subscribes to open threads so additional tabs can observe active streams, and the Studio stop button aborts the active thread subscription. React chat also falls back to legacy threaded streaming when it connects to a server or core version that does not support signal routes yet. ([#16338](https://github.com/mastra-ai/mastra/pull/16338))

  ```ts
  const { sendMessage } = useChat({ agentId, resourceId, threadId });
  await sendMessage({ message: 'Follow up while streaming', threadId });
  ```

- Added Agent signals for sending contextual messages into agent thread loops and subscribing to thread activity. ([#16229](https://github.com/mastra-ai/mastra/pull/16229))

  Call `agent.sendSignal()` to inject context into a running agent loop. When the thread is idle, that same signal becomes the prompt that starts the next loop by default. Use `ifActive.behavior` and `ifIdle.behavior` to deliver, persist, discard, or wake from a signal.

  Use `agent.subscribeToThread()` to follow the raw stream chunks for a memory thread, observe signal echoes with stable IDs, and abort the active stream for that thread.

  ```ts
  const subscription = await agent.subscribeToThread({ resourceId, threadId });

  void (async () => {
    for await (const part of subscription.stream) {
      if (part.type === 'finish') {
        subscription.unsubscribe();
      }
    }
  })();

  agent.sendSignal({ type: 'user-message', contents: 'Use the latest answer' }, { resourceId, threadId });
  ```

- Responses streams now emit tool call events so clients can track tool arguments and results in real time. ([#16285](https://github.com/mastra-ai/mastra/pull/16285))

  Tool outputs now use consistent IDs (`<toolCallId>:output`) so streamed arguments can be matched to completed results.

  ```ts
  for await (const event of stream) {
    if (event.type === 'response.function_call_arguments.delta') {
      console.log(event.delta);
    }

    if (event.type === 'response.output_item.done' && event.item.type === 'function_call') {
      console.log(event.item.id);
    }
  }
  ```

- Added support for signed A2A Agent Cards. ([#16207](https://github.com/mastra-ai/mastra/pull/16207))

  **Example**

  ```ts
  const mastra = new Mastra({
    server: {
      a2a: {
        agentCardSigning: {
          privateKey: process.env.A2A_AGENT_CARD_PRIVATE_KEY!,
          protectedHeader: {
            alg: 'ES256',
            kid: 'agent-card-key',
          },
          header: {
            issuer: 'mastra',
          },
        },
      },
    },
  });
  ```

  Mastra now conditionally signs served A2A Agent Cards via `signAgentCard(...)` when `server.a2a.agentCardSigning` is configured, and the A2A Agent Card response schema now includes the `signatures` array.

- Added `mastra api`, a machine-readable runtime CLI for calling Mastra server resources with JSON input and output. ([#16128](https://github.com/mastra-ai/mastra/pull/16128))

  The new API CLI supports agents, workflows, tools, MCP servers, memory threads, working memory, observability traces/logs/scores, datasets, and experiments. It includes schema-aware request handling so a single JSON input is split into path, query, and body fields based on server route contracts, plus ergonomic raw-input wrapping for tool execution.

  Exposed a route-derived server API schema manifest at runtime and generated CLI route metadata from it, enabling `--schema` output, response-shape-aware normalization, and server-aligned pagination output.

- Add `POST /api/agents/:agentId/resume-stream-until-idle` SSE route, mirroring `agent.resumeStreamUntilIdle()`. ([#16260](https://github.com/mastra-ai/mastra/pull/16260))

- Worker review fixes: ([#16309](https://github.com/mastra-ai/mastra/pull/16309))
  - Step-execution endpoint (`POST /workflows/:id/runs/:runId/steps/execute`) is
    now gated by Mastra's standard `requiresAuth: true` + `authenticateToken`
    pipeline rather than a parallel "worker secret" body field. The previously
    introduced `workerSecret` config knob and `MASTRA_WORKER_SECRET` env var
    have been removed (they were never released). To gate the endpoint on a
    standalone-worker deployment, configure an auth provider on the server's
    `Mastra` instance — without one the framework currently treats
    `requiresAuth: true` as a no-op for this route.
  - `HttpRemoteStrategy` now sends credentials as a normal `Authorization:
Bearer <token>` header. The token comes from the new
    `MASTRA_WORKER_AUTH_TOKEN` env var or an explicit `auth` constructor option.
  - Honor the caller's `abortSignal` in `HttpRemoteStrategy` by combining it
    with the per-request timeout via `AbortSignal.any` (with a manual fallback
    for runtimes that don't expose it).
  - Implement comma-separated name filtering for the `MASTRA_WORKERS` env var.
    `MASTRA_WORKERS=scheduler,backgroundTasks` now boots only those named
    workers; `MASTRA_WORKERS=false` still disables all workers.
  - Restore `Mastra.startEventEngine` / `stopEventEngine` as `@deprecated`
    aliases for the renamed `startWorkers` / `stopWorkers`.
  - `BackgroundTaskWorker` now subscribes to PubSub in `start()` instead of
    `init()`, matching the lifecycle of the other workers and making
    `isRunning` accurately reflect subscription state.
  - `RedisStreamsPubSub` adds a `maxDeliveryAttempts` option (default 5) that
    drops events after the configured number of failed deliveries instead of
    redelivering forever, and replaces empty `catch {}` blocks with
    `logger.warn`/`logger.debug` calls.
  - `RedisStreamsPubSub.unsubscribe(topic, cb)` now honors the topic argument
    so the same callback can be subscribed to multiple topics independently.
  - `PullTransport` guards the async router callback against unhandled promise
    rejections by attaching a `.catch` that nacks the message.
  - Drop the dead `MASTRA_WORKER_NAME` env var injection in the CLI worker
    spawn (the bundle entrypoint already passes the worker name directly).
  - Add a real cross-process e2e auth suite
    (`pubsub/redis-streams/src/auth-e2e.test.ts`) covering happy path, wrong
    token, missing token, anonymous direct hits, and the no-auth-provider
    pin-down behavior.
  - Step-execution route now has a response schema, satisfying
    `schema-consistency.test.ts`.
  - Internal type cleanups (drop several `as any` casts in worker strategies
    and `BackgroundTaskWorker`).
  - `RedisStreamsPubSub.maxDeliveryAttempts` now rejects negative / NaN values
    at construction. `0` still means "no cap" for back-compat but emits a
    one-time warning; pass `Infinity` to disable the cap explicitly.
  - `PullTransport` accepts a logger and uses it for unhandled router-callback
    rejections instead of `console.error`.
  - `BackgroundTaskWorker.start()` now throws if `init()` was not called,
    matching the contract of the other workers.
  - Cross-process integration tests now spawn a single user-owned project
    (`test-fixtures/cli-project/src/mastra/index.ts`) through two generic
    entries that mirror what `BuildBundler` and `WorkerBundler` emit. The
    previous one-off `server.entry.ts` / `worker.entry.ts` /
    `scheduler.entry.ts` / `background.entry.ts` files have been deleted —
    they implied users hand-roll entry files, which they don't. Worker role
    is selected via `MASTRA_WORKERS` exactly as in production.

  Push-capable PubSub:
  - The `PubSub` abstract class now declares a `supportedModes` getter
    (defaulting to `['pull']` for backward compatibility) so consumers can
    tell whether a broker delivers events through a pull loop, an in-process
    push, or an out-of-process HTTP push. `EventEmitterPubSub` reports
    `['pull', 'push']` (EventEmitter dispatches synchronously and works for
    either path), `@mastra/redis-streams` reports `['pull']`.
  - `Mastra` now exposes a public `handleWorkflowEvent(event)` method backed
    by a shared `WorkflowEventProcessor`. It is the single entry point used
    by the existing pull-mode `OrchestrationWorker`, by in-process push
    pubsubs (auto-wired during `startWorkers()`), and by the new
    `POST /api/workflows/events` route which lets push-mode brokers (GCP
    Pub/Sub push, SNS, EventBridge) deliver events over HTTP.
  - When the configured pubsub does not support `'pull'`, Mastra
    automatically skips creating an `OrchestrationWorker` and
    `OrchestrationWorker.init()` throws a clear error if it is constructed
    against a push-only pubsub.
  - `WorkflowEventProcessor` gains a `handle(event)` method that returns a
    structured `{ ok, retry }` result. The original `process(event, ack?)`
    method is preserved as a thin wrapper for back-compat.

  Public-API example for a push-capable PubSub:

  ```ts
  import { Mastra } from '@mastra/core/mastra';
  import { EventEmitterPubSub } from '@mastra/core/pubsub';

  const mastra = new Mastra({
    // A push-capable broker (GCP Pub/Sub push, SNS, EventEmitter, …).
    // EventEmitterPubSub reports supportedModes = ['pull', 'push'].
    pubsub: new EventEmitterPubSub(),
    workflows: { myWorkflow },
  });

  // In-process push pubsubs are auto-wired here. For out-of-process
  // push (e.g. HTTP webhook from a cloud broker), POST the event to
  // /api/workflows/events on your Mastra server instead.
  await mastra.startWorkers();

  // Direct invocation (e.g. inside an HTTP handler that bridges from a
  // cloud broker's push delivery):
  await mastra.handleWorkflowEvent({
    id: 'evt-1',
    type: 'workflow.start',
    runId: 'run-1',
    createdAt: new Date(),
    data: { workflowId: 'myWorkflow', inputData: { name: 'world' } },
  });
  ```

  CI follow-ups:
  - `Mastra` only auto-registers `SchedulerWorker` when storage is configured.
    Without storage the worker would crash on startup (`deps.storage.getStore`
    on undefined); the scheduler now silently no-ops in that case, matching the
    pre-worker scheduler behavior.
  - `SchedulerWorker.init` defensively logs and returns when called without
    storage instead of throwing a TypeError.
  - `RECEIVE_WORKFLOW_EVENT_ROUTE` (`POST /workflows/events`) `createdAt` is
    now a plain `z.string()` on the wire and the handler converts it to a
    `Date` (validating "Invalid Date" -> 400). The previous
    `union(...).transform().refine()` schema couldn't be exercised by the
    shared adapter test suite because the generator didn't unwrap Zod 4's
    `ZodPipe`.
  - `_test-utils/route-test-utils` recognizes Zod 4's `number_format` check
    (used for `int()` / `safeint()`), and `generateContextualValue` now
    produces a valid ISO timestamp for `createdAt` / `updatedAt` fields.

### Patch Changes

- Improved Studio agent serialization by making Studio mode and auth-related request context server-controlled across adapters. Playground requests now identify Studio traffic consistently, body and query request context cannot set reserved server values, and Studio placeholder fallback is limited to instruction rendering while serialized models, workspace, skills, tools, and default options use the real request context. ([#16152](https://github.com/mastra-ai/mastra/pull/16152))

- Fixed FGA EE license gating so production servers require an Enterprise license when FGA is configured. ([#16362](https://github.com/mastra-ai/mastra/pull/16362))

- Fixed Cloudflare Worker startup crashes by keeping Agent Builder routes out of the default server route bundle. ([#16499](https://github.com/mastra-ai/mastra/pull/16499))

- Fixed stored Responses streams so completed tool output, zero-argument tool calls, and assistant text are preserved when provider messages are partial. ([#16285](https://github.com/mastra-ai/mastra/pull/16285))

- Updated dependencies [[`9f17410`](https://github.com/mastra-ai/mastra/commit/9f1741080def23d42ee50b39887a385ae316a3c6), [`7ad5585`](https://github.com/mastra-ai/mastra/commit/7ad55856406f1de398dc713f6a9eaa78b2784bb6), [`ac47842`](https://github.com/mastra-ai/mastra/commit/ac478427aa7a5f5fdaed633a911218689b438c60), [`cc189cc`](https://github.com/mastra-ai/mastra/commit/cc189cc0128eb7af233476b5e421ec6888bffde7), [`d1fdbd0`](https://github.com/mastra-ai/mastra/commit/d1fdbd012add5623cb7e6b7f882b605ab358bbb4), [`210ea7a`](https://github.com/mastra-ai/mastra/commit/210ea7af559791b73a44fc9c12179908aaa3183f), [`7c275a8`](https://github.com/mastra-ai/mastra/commit/7c275a810595e1a6c41ccc39720531ab65734700), [`bae019e`](https://github.com/mastra-ai/mastra/commit/bae019ecb6694da96909f7ec7b9eb3a0a33aa887), [`890b24c`](https://github.com/mastra-ai/mastra/commit/890b24cc7d32ed6aa4dfe253e54dc6bf4099f690), [`f984b4d`](https://github.com/mastra-ai/mastra/commit/f984b4d6c60bf2ae2a9b156f0e8c35a66fe96c91), [`6742347`](https://github.com/mastra-ai/mastra/commit/6742347d71955d7639adc9ddf6ff8282de7ee3ba), [`b59316f`](https://github.com/mastra-ai/mastra/commit/b59316ffa0f7688165b0f9c81ccdf85da461e5b2), [`0f48ebf`](https://github.com/mastra-ai/mastra/commit/0f48ebfc7ac7897b2092a189f45751924cf56d1c), [`37c0dc5`](https://github.com/mastra-ai/mastra/commit/37c0dc5697d343db98628bf867bf71ce6deec6d7), [`087e413`](https://github.com/mastra-ai/mastra/commit/087e4133e5d6efa36619e9556c16750e4179c047), [`83218c8`](https://github.com/mastra-ai/mastra/commit/83218c88b37773c9424fbe733b37be556e55e94d), [`ef6b584`](https://github.com/mastra-ai/mastra/commit/ef6b5847ac33c0a7e80af3a86e8801e2933dd3ee), [`c6eb39e`](https://github.com/mastra-ai/mastra/commit/c6eb39ea6dca381c6563cb240237fbe608e02f93), [`7b0ad1f`](https://github.com/mastra-ai/mastra/commit/7b0ad1f5c53dc118c6da12ae82ae2587037dc2b8), [`d91ebe2`](https://github.com/mastra-ai/mastra/commit/d91ebe28ee065d8f2ed6df741c3c07f58d359529), [`62666c3`](https://github.com/mastra-ai/mastra/commit/62666c367eaeac3941ead454b1d38810cc855721), [`33f5061`](https://github.com/mastra-ai/mastra/commit/33f5061cd1c0335020c3faae61ce96de822854fa), [`4af2160`](https://github.com/mastra-ai/mastra/commit/4af2160322f4718cac421930cce85641e9512389), [`087e413`](https://github.com/mastra-ai/mastra/commit/087e4133e5d6efa36619e9556c16750e4179c047), [`265ec9f`](https://github.com/mastra-ai/mastra/commit/265ec9f887b5c81255c873a76ff7796f16e4f99b), [`ce01024`](https://github.com/mastra-ai/mastra/commit/ce010242eee9bdfc09e4c26725b9d37998679a8d), [`6ce80bf`](https://github.com/mastra-ai/mastra/commit/6ce80bf4872a891e0bddf8b80561a80584efb14b), [`f984b4d`](https://github.com/mastra-ai/mastra/commit/f984b4d6c60bf2ae2a9b156f0e8c35a66fe96c91), [`136c959`](https://github.com/mastra-ai/mastra/commit/136c9592fb0eeb0cd212f28629d8a29b7557a2fc), [`9268531`](https://github.com/mastra-ai/mastra/commit/9268531e7ec4be98beeba3b3ae8be0a7ea380662), [`13ead79`](https://github.com/mastra-ai/mastra/commit/13ead79149486b88144db7e11e6ff551caef5be1), [`dccd8f1`](https://github.com/mastra-ai/mastra/commit/dccd8f1f8b8f1ad203b77556207e5529567c616d), [`4df7cc7`](https://github.com/mastra-ai/mastra/commit/4df7cc79342fd065fe7fdeef93c094db14b12bcd), [`f180e49`](https://github.com/mastra-ai/mastra/commit/f180e4990e71b04c9a475b523584071712f0048f), [`9260e01`](https://github.com/mastra-ai/mastra/commit/9260e015276fb1b500f7878ee452b47476bf1583), [`2f6c54e`](https://github.com/mastra-ai/mastra/commit/2f6c54e17c041cac1def54baaa6b771647836414), [`aca3121`](https://github.com/mastra-ai/mastra/commit/aca31211233dac25459f140ea4fcfb3a5af64c18), [`e06a159`](https://github.com/mastra-ai/mastra/commit/e06a1598ca07a6c3778aefc2a2d288363c6294ff), [`4dd900d`](https://github.com/mastra-ai/mastra/commit/4dd900d75dfe9be89f8c15188b368a8622aa1e18), [`b560d6f`](https://github.com/mastra-ai/mastra/commit/b560d6f88b9b904b15c10f75c949eb145bc27684), [`99869ec`](https://github.com/mastra-ai/mastra/commit/99869ecb1f2aa6dfcc44fa4e843e5ee0344efa64), [`900d086`](https://github.com/mastra-ai/mastra/commit/900d086bb737b9cf2fcf68f11b0389b801a2738c), [`4c0e286`](https://github.com/mastra-ai/mastra/commit/4c0e28637c9cfb4f416549b55e97ebfa13319dfc), [`55f1e2d`](https://github.com/mastra-ai/mastra/commit/55f1e2d65425b95a49ae788053b266f256e38c96), [`4ff5bdf`](https://github.com/mastra-ai/mastra/commit/4ff5bdfe170cba6dfb5260c6af0f4ba668430772), [`9cdf38e`](https://github.com/mastra-ai/mastra/commit/9cdf38e58506e1109c8b38f97cd7770978a4218e), [`087e413`](https://github.com/mastra-ai/mastra/commit/087e4133e5d6efa36619e9556c16750e4179c047), [`db34bc6`](https://github.com/mastra-ai/mastra/commit/db34bc6fb36cf125bda0c46be4d3fdc774b70cc4), [`990851e`](https://github.com/mastra-ai/mastra/commit/990851edcb0e30be5c2c18b6532f1a876cc2d335), [`bbcd93c`](https://github.com/mastra-ai/mastra/commit/bbcd93cf7d8aa1007d6d84bfd033b8015c912087), [`8373ff4`](https://github.com/mastra-ai/mastra/commit/8373ff46745d77af79f183c4470f80fa2727a6b2), [`d48a705`](https://github.com/mastra-ai/mastra/commit/d48a705ff3dfbdc7a996e07ecd8293b5effd9a2a), [`308bd07`](https://github.com/mastra-ai/mastra/commit/308bd074f35cef0c75d82fc1eb19382fe04ecf6f), [`6068a6c`](https://github.com/mastra-ai/mastra/commit/6068a6c42950fad3ebfc92346417896ba60803d2), [`36b3bbf`](https://github.com/mastra-ai/mastra/commit/36b3bbf5a8d59f7e23d47e29340e76c681b4929c), [`d86f031`](https://github.com/mastra-ai/mastra/commit/d86f031eb6b0b2570145afafea664e59bf688962), [`b275631`](https://github.com/mastra-ai/mastra/commit/b275631dc10541a482b2e2d4a3e3cfa843bd5fa1), [`00106be`](https://github.com/mastra-ai/mastra/commit/00106bede59b81e5b0e9cd6aad8d3b5dbc336387), [`bd36d8e`](https://github.com/mastra-ai/mastra/commit/bd36d8eb6de8c9a0310352649dbd4b06703c2299), [`11c1528`](https://github.com/mastra-ai/mastra/commit/11c152848c5d0ef227184853b5040f5b41ee7b1e), [`4999667`](https://github.com/mastra-ai/mastra/commit/49996678b68356cad7f088430009690406c50fbd), [`e2a079c`](https://github.com/mastra-ai/mastra/commit/e2a079cc3755b1895f7bd5dc36e9be81b11c7c22), [`8ac9141`](https://github.com/mastra-ai/mastra/commit/8ac9141439caa8fdd674944c4d84f29b3c730296), [`25184ff`](https://github.com/mastra-ai/mastra/commit/25184ffaf1293ec95119426eb1a1f8d38831b96c), [`534a456`](https://github.com/mastra-ai/mastra/commit/534a456a25e4df1e5407e7e632f4cb3b1fa14f9d), [`105e454`](https://github.com/mastra-ai/mastra/commit/105e454c95af06a7c741c15969d8f9b0f02463a7), [`aebde9c`](https://github.com/mastra-ai/mastra/commit/aebde9cfacf56592c6b6350cae721740fe090b8a), [`36bae07`](https://github.com/mastra-ai/mastra/commit/36bae07c0e70b1b3006f2fd20830e8883dcbd066), [`5688881`](https://github.com/mastra-ai/mastra/commit/5688881669c7ed157f31ac77f6fc5f8d95ceea32)]:
  - @mastra/core@1.33.0

## 1.33.0-alpha.17

### Patch Changes

- Updated dependencies [[`4999667`](https://github.com/mastra-ai/mastra/commit/49996678b68356cad7f088430009690406c50fbd)]:
  - @mastra/core@1.33.0-alpha.17

## 1.33.0-alpha.16

### Patch Changes

- Fixed Cloudflare Worker startup crashes by keeping Agent Builder routes out of the default server route bundle. ([#16499](https://github.com/mastra-ai/mastra/pull/16499))

- Updated dependencies [[`cc189cc`](https://github.com/mastra-ai/mastra/commit/cc189cc0128eb7af233476b5e421ec6888bffde7)]:
  - @mastra/core@1.33.0-alpha.16

## 1.33.0-alpha.15

### Patch Changes

- Updated dependencies [[`105e454`](https://github.com/mastra-ai/mastra/commit/105e454c95af06a7c741c15969d8f9b0f02463a7)]:
  - @mastra/core@1.33.0-alpha.15

## 1.33.0-alpha.14

### Minor Changes

- Added client, React, and Studio support for Agent signals in threaded chat. Threaded user messages now send through Agent signals, stream output is consumed from the thread subscription, echoed user messages are deduped by signal ID, file and image message contents are preserved, Studio can send follow-ups while a response is streaming, Studio subscribes to open threads so additional tabs can observe active streams, and the Studio stop button aborts the active thread subscription. React chat also falls back to legacy threaded streaming when it connects to a server or core version that does not support signal routes yet. ([#16338](https://github.com/mastra-ai/mastra/pull/16338))

  ```ts
  const { sendMessage } = useChat({ agentId, resourceId, threadId });
  await sendMessage({ message: 'Follow up while streaming', threadId });
  ```

### Patch Changes

- Updated dependencies:
  - @mastra/core@1.33.0-alpha.14

## 1.33.0-alpha.13

### Patch Changes

- Updated dependencies [[`f984b4d`](https://github.com/mastra-ai/mastra/commit/f984b4d6c60bf2ae2a9b156f0e8c35a66fe96c91), [`ce01024`](https://github.com/mastra-ai/mastra/commit/ce010242eee9bdfc09e4c26725b9d37998679a8d), [`f984b4d`](https://github.com/mastra-ai/mastra/commit/f984b4d6c60bf2ae2a9b156f0e8c35a66fe96c91), [`8373ff4`](https://github.com/mastra-ai/mastra/commit/8373ff46745d77af79f183c4470f80fa2727a6b2), [`11c1528`](https://github.com/mastra-ai/mastra/commit/11c152848c5d0ef227184853b5040f5b41ee7b1e)]:
  - @mastra/core@1.33.0-alpha.13

## 1.33.0-alpha.12

### Minor Changes

- Added Agent signals for sending contextual messages into agent thread loops and subscribing to thread activity. ([#16229](https://github.com/mastra-ai/mastra/pull/16229))

  Call `agent.sendSignal()` to inject context into a running agent loop. When the thread is idle, that same signal becomes the prompt that starts the next loop by default. Use `ifActive.behavior` and `ifIdle.behavior` to deliver, persist, discard, or wake from a signal.

  Use `agent.subscribeToThread()` to follow the raw stream chunks for a memory thread, observe signal echoes with stable IDs, and abort the active stream for that thread.

  ```ts
  const subscription = await agent.subscribeToThread({ resourceId, threadId });

  void (async () => {
    for await (const part of subscription.stream) {
      if (part.type === 'finish') {
        subscription.unsubscribe();
      }
    }
  })();

  agent.sendSignal({ type: 'user-message', contents: 'Use the latest answer' }, { resourceId, threadId });
  ```

### Patch Changes

- Updated dependencies [[`b59316f`](https://github.com/mastra-ai/mastra/commit/b59316ffa0f7688165b0f9c81ccdf85da461e5b2), [`55f1e2d`](https://github.com/mastra-ai/mastra/commit/55f1e2d65425b95a49ae788053b266f256e38c96), [`d48a705`](https://github.com/mastra-ai/mastra/commit/d48a705ff3dfbdc7a996e07ecd8293b5effd9a2a)]:
  - @mastra/core@1.33.0-alpha.12

## 1.33.0-alpha.11

### Patch Changes

- Fixed FGA EE license gating so production servers require an Enterprise license when FGA is configured. ([#16362](https://github.com/mastra-ai/mastra/pull/16362))

- Updated dependencies [[`37c0dc5`](https://github.com/mastra-ai/mastra/commit/37c0dc5697d343db98628bf867bf71ce6deec6d7), [`ef6b584`](https://github.com/mastra-ai/mastra/commit/ef6b5847ac33c0a7e80af3a86e8801e2933dd3ee), [`4dd900d`](https://github.com/mastra-ai/mastra/commit/4dd900d75dfe9be89f8c15188b368a8622aa1e18), [`4ff5bdf`](https://github.com/mastra-ai/mastra/commit/4ff5bdfe170cba6dfb5260c6af0f4ba668430772), [`bbcd93c`](https://github.com/mastra-ai/mastra/commit/bbcd93cf7d8aa1007d6d84bfd033b8015c912087), [`308bd07`](https://github.com/mastra-ai/mastra/commit/308bd074f35cef0c75d82fc1eb19382fe04ecf6f)]:
  - @mastra/core@1.33.0-alpha.11

## 1.33.0-alpha.10

### Patch Changes

- Updated dependencies [[`7ad5585`](https://github.com/mastra-ai/mastra/commit/7ad55856406f1de398dc713f6a9eaa78b2784bb6), [`210ea7a`](https://github.com/mastra-ai/mastra/commit/210ea7af559791b73a44fc9c12179908aaa3183f), [`83218c8`](https://github.com/mastra-ai/mastra/commit/83218c88b37773c9424fbe733b37be556e55e94d), [`265ec9f`](https://github.com/mastra-ai/mastra/commit/265ec9f887b5c81255c873a76ff7796f16e4f99b), [`6ce80bf`](https://github.com/mastra-ai/mastra/commit/6ce80bf4872a891e0bddf8b80561a80584efb14b), [`9268531`](https://github.com/mastra-ai/mastra/commit/9268531e7ec4be98beeba3b3ae8be0a7ea380662), [`13ead79`](https://github.com/mastra-ai/mastra/commit/13ead79149486b88144db7e11e6ff551caef5be1), [`bd36d8e`](https://github.com/mastra-ai/mastra/commit/bd36d8eb6de8c9a0310352649dbd4b06703c2299), [`8ac9141`](https://github.com/mastra-ai/mastra/commit/8ac9141439caa8fdd674944c4d84f29b3c730296)]:
  - @mastra/core@1.33.0-alpha.10

## 1.33.0-alpha.9

### Patch Changes

- Updated dependencies [[`5688881`](https://github.com/mastra-ai/mastra/commit/5688881669c7ed157f31ac77f6fc5f8d95ceea32)]:
  - @mastra/core@1.33.0-alpha.9

## 1.33.0-alpha.8

### Patch Changes

- Updated dependencies [[`7c275a8`](https://github.com/mastra-ai/mastra/commit/7c275a810595e1a6c41ccc39720531ab65734700), [`890b24c`](https://github.com/mastra-ai/mastra/commit/890b24cc7d32ed6aa4dfe253e54dc6bf4099f690), [`0f48ebf`](https://github.com/mastra-ai/mastra/commit/0f48ebfc7ac7897b2092a189f45751924cf56d1c), [`f180e49`](https://github.com/mastra-ai/mastra/commit/f180e4990e71b04c9a475b523584071712f0048f), [`9260e01`](https://github.com/mastra-ai/mastra/commit/9260e015276fb1b500f7878ee452b47476bf1583), [`2f6c54e`](https://github.com/mastra-ai/mastra/commit/2f6c54e17c041cac1def54baaa6b771647836414), [`e06a159`](https://github.com/mastra-ai/mastra/commit/e06a1598ca07a6c3778aefc2a2d288363c6294ff), [`db34bc6`](https://github.com/mastra-ai/mastra/commit/db34bc6fb36cf125bda0c46be4d3fdc774b70cc4)]:
  - @mastra/core@1.33.0-alpha.8

## 1.33.0-alpha.7

### Minor Changes

- Responses streams now emit tool call events so clients can track tool arguments and results in real time. ([#16285](https://github.com/mastra-ai/mastra/pull/16285))

  Tool outputs now use consistent IDs (`<toolCallId>:output`) so streamed arguments can be matched to completed results.

  ```ts
  for await (const event of stream) {
    if (event.type === 'response.function_call_arguments.delta') {
      console.log(event.delta);
    }

    if (event.type === 'response.output_item.done' && event.item.type === 'function_call') {
      console.log(event.item.id);
    }
  }
  ```

- Worker review fixes: ([#16309](https://github.com/mastra-ai/mastra/pull/16309))
  - Step-execution endpoint (`POST /workflows/:id/runs/:runId/steps/execute`) is
    now gated by Mastra's standard `requiresAuth: true` + `authenticateToken`
    pipeline rather than a parallel "worker secret" body field. The previously
    introduced `workerSecret` config knob and `MASTRA_WORKER_SECRET` env var
    have been removed (they were never released). To gate the endpoint on a
    standalone-worker deployment, configure an auth provider on the server's
    `Mastra` instance — without one the framework currently treats
    `requiresAuth: true` as a no-op for this route.
  - `HttpRemoteStrategy` now sends credentials as a normal `Authorization:
Bearer <token>` header. The token comes from the new
    `MASTRA_WORKER_AUTH_TOKEN` env var or an explicit `auth` constructor option.
  - Honor the caller's `abortSignal` in `HttpRemoteStrategy` by combining it
    with the per-request timeout via `AbortSignal.any` (with a manual fallback
    for runtimes that don't expose it).
  - Implement comma-separated name filtering for the `MASTRA_WORKERS` env var.
    `MASTRA_WORKERS=scheduler,backgroundTasks` now boots only those named
    workers; `MASTRA_WORKERS=false` still disables all workers.
  - Restore `Mastra.startEventEngine` / `stopEventEngine` as `@deprecated`
    aliases for the renamed `startWorkers` / `stopWorkers`.
  - `BackgroundTaskWorker` now subscribes to PubSub in `start()` instead of
    `init()`, matching the lifecycle of the other workers and making
    `isRunning` accurately reflect subscription state.
  - `RedisStreamsPubSub` adds a `maxDeliveryAttempts` option (default 5) that
    drops events after the configured number of failed deliveries instead of
    redelivering forever, and replaces empty `catch {}` blocks with
    `logger.warn`/`logger.debug` calls.
  - `RedisStreamsPubSub.unsubscribe(topic, cb)` now honors the topic argument
    so the same callback can be subscribed to multiple topics independently.
  - `PullTransport` guards the async router callback against unhandled promise
    rejections by attaching a `.catch` that nacks the message.
  - Drop the dead `MASTRA_WORKER_NAME` env var injection in the CLI worker
    spawn (the bundle entrypoint already passes the worker name directly).
  - Add a real cross-process e2e auth suite
    (`pubsub/redis-streams/src/auth-e2e.test.ts`) covering happy path, wrong
    token, missing token, anonymous direct hits, and the no-auth-provider
    pin-down behavior.
  - Step-execution route now has a response schema, satisfying
    `schema-consistency.test.ts`.
  - Internal type cleanups (drop several `as any` casts in worker strategies
    and `BackgroundTaskWorker`).
  - `RedisStreamsPubSub.maxDeliveryAttempts` now rejects negative / NaN values
    at construction. `0` still means "no cap" for back-compat but emits a
    one-time warning; pass `Infinity` to disable the cap explicitly.
  - `PullTransport` accepts a logger and uses it for unhandled router-callback
    rejections instead of `console.error`.
  - `BackgroundTaskWorker.start()` now throws if `init()` was not called,
    matching the contract of the other workers.
  - Cross-process integration tests now spawn a single user-owned project
    (`test-fixtures/cli-project/src/mastra/index.ts`) through two generic
    entries that mirror what `BuildBundler` and `WorkerBundler` emit. The
    previous one-off `server.entry.ts` / `worker.entry.ts` /
    `scheduler.entry.ts` / `background.entry.ts` files have been deleted —
    they implied users hand-roll entry files, which they don't. Worker role
    is selected via `MASTRA_WORKERS` exactly as in production.

  Push-capable PubSub:
  - The `PubSub` abstract class now declares a `supportedModes` getter
    (defaulting to `['pull']` for backward compatibility) so consumers can
    tell whether a broker delivers events through a pull loop, an in-process
    push, or an out-of-process HTTP push. `EventEmitterPubSub` reports
    `['pull', 'push']` (EventEmitter dispatches synchronously and works for
    either path), `@mastra/redis-streams` reports `['pull']`.
  - `Mastra` now exposes a public `handleWorkflowEvent(event)` method backed
    by a shared `WorkflowEventProcessor`. It is the single entry point used
    by the existing pull-mode `OrchestrationWorker`, by in-process push
    pubsubs (auto-wired during `startWorkers()`), and by the new
    `POST /api/workflows/events` route which lets push-mode brokers (GCP
    Pub/Sub push, SNS, EventBridge) deliver events over HTTP.
  - When the configured pubsub does not support `'pull'`, Mastra
    automatically skips creating an `OrchestrationWorker` and
    `OrchestrationWorker.init()` throws a clear error if it is constructed
    against a push-only pubsub.
  - `WorkflowEventProcessor` gains a `handle(event)` method that returns a
    structured `{ ok, retry }` result. The original `process(event, ack?)`
    method is preserved as a thin wrapper for back-compat.

  Public-API example for a push-capable PubSub:

  ```ts
  import { Mastra } from '@mastra/core/mastra';
  import { EventEmitterPubSub } from '@mastra/core/pubsub';

  const mastra = new Mastra({
    // A push-capable broker (GCP Pub/Sub push, SNS, EventEmitter, …).
    // EventEmitterPubSub reports supportedModes = ['pull', 'push'].
    pubsub: new EventEmitterPubSub(),
    workflows: { myWorkflow },
  });

  // In-process push pubsubs are auto-wired here. For out-of-process
  // push (e.g. HTTP webhook from a cloud broker), POST the event to
  // /api/workflows/events on your Mastra server instead.
  await mastra.startWorkers();

  // Direct invocation (e.g. inside an HTTP handler that bridges from a
  // cloud broker's push delivery):
  await mastra.handleWorkflowEvent({
    id: 'evt-1',
    type: 'workflow.start',
    runId: 'run-1',
    createdAt: new Date(),
    data: { workflowId: 'myWorkflow', inputData: { name: 'world' } },
  });
  ```

  CI follow-ups:
  - `Mastra` only auto-registers `SchedulerWorker` when storage is configured.
    Without storage the worker would crash on startup (`deps.storage.getStore`
    on undefined); the scheduler now silently no-ops in that case, matching the
    pre-worker scheduler behavior.
  - `SchedulerWorker.init` defensively logs and returns when called without
    storage instead of throwing a TypeError.
  - `RECEIVE_WORKFLOW_EVENT_ROUTE` (`POST /workflows/events`) `createdAt` is
    now a plain `z.string()` on the wire and the handler converts it to a
    `Date` (validating "Invalid Date" -> 400). The previous
    `union(...).transform().refine()` schema couldn't be exercised by the
    shared adapter test suite because the generator didn't unwrap Zod 4's
    `ZodPipe`.
  - `_test-utils/route-test-utils` recognizes Zod 4's `number_format` check
    (used for `int()` / `safeint()`), and `generateContextualValue` now
    produces a valid ISO timestamp for `createdAt` / `updatedAt` fields.

### Patch Changes

- Improved Studio agent serialization by making Studio mode and auth-related request context server-controlled across adapters. Playground requests now identify Studio traffic consistently, body and query request context cannot set reserved server values, and Studio placeholder fallback is limited to instruction rendering while serialized models, workspace, skills, tools, and default options use the real request context. ([#16152](https://github.com/mastra-ai/mastra/pull/16152))

- Fixed stored Responses streams so completed tool output, zero-argument tool calls, and assistant text are preserved when provider messages are partial. ([#16285](https://github.com/mastra-ai/mastra/pull/16285))

- Updated dependencies [[`6742347`](https://github.com/mastra-ai/mastra/commit/6742347d71955d7639adc9ddf6ff8282de7ee3ba), [`7b0ad1f`](https://github.com/mastra-ai/mastra/commit/7b0ad1f5c53dc118c6da12ae82ae2587037dc2b8), [`62666c3`](https://github.com/mastra-ai/mastra/commit/62666c367eaeac3941ead454b1d38810cc855721), [`4af2160`](https://github.com/mastra-ai/mastra/commit/4af2160322f4718cac421930cce85641e9512389), [`136c959`](https://github.com/mastra-ai/mastra/commit/136c9592fb0eeb0cd212f28629d8a29b7557a2fc), [`4df7cc7`](https://github.com/mastra-ai/mastra/commit/4df7cc79342fd065fe7fdeef93c094db14b12bcd), [`aca3121`](https://github.com/mastra-ai/mastra/commit/aca31211233dac25459f140ea4fcfb3a5af64c18), [`9cdf38e`](https://github.com/mastra-ai/mastra/commit/9cdf38e58506e1109c8b38f97cd7770978a4218e), [`990851e`](https://github.com/mastra-ai/mastra/commit/990851edcb0e30be5c2c18b6532f1a876cc2d335), [`6068a6c`](https://github.com/mastra-ai/mastra/commit/6068a6c42950fad3ebfc92346417896ba60803d2), [`00106be`](https://github.com/mastra-ai/mastra/commit/00106bede59b81e5b0e9cd6aad8d3b5dbc336387), [`e2a079c`](https://github.com/mastra-ai/mastra/commit/e2a079cc3755b1895f7bd5dc36e9be81b11c7c22), [`534a456`](https://github.com/mastra-ai/mastra/commit/534a456a25e4df1e5407e7e632f4cb3b1fa14f9d), [`36bae07`](https://github.com/mastra-ai/mastra/commit/36bae07c0e70b1b3006f2fd20830e8883dcbd066)]:
  - @mastra/core@1.33.0-alpha.7

## 1.33.0-alpha.6

### Patch Changes

- Updated dependencies [[`b560d6f`](https://github.com/mastra-ai/mastra/commit/b560d6f88b9b904b15c10f75c949eb145bc27684), [`36b3bbf`](https://github.com/mastra-ai/mastra/commit/36b3bbf5a8d59f7e23d47e29340e76c681b4929c), [`b275631`](https://github.com/mastra-ai/mastra/commit/b275631dc10541a482b2e2d4a3e3cfa843bd5fa1)]:
  - @mastra/core@1.33.0-alpha.6

## 1.33.0-alpha.5

### Patch Changes

- Updated dependencies [[`bae019e`](https://github.com/mastra-ai/mastra/commit/bae019ecb6694da96909f7ec7b9eb3a0a33aa887), [`33f5061`](https://github.com/mastra-ai/mastra/commit/33f5061cd1c0335020c3faae61ce96de822854fa), [`99869ec`](https://github.com/mastra-ai/mastra/commit/99869ecb1f2aa6dfcc44fa4e843e5ee0344efa64), [`d86f031`](https://github.com/mastra-ai/mastra/commit/d86f031eb6b0b2570145afafea664e59bf688962)]:
  - @mastra/core@1.33.0-alpha.5

## 1.33.0-alpha.4

### Minor Changes

- Added support for signed A2A Agent Cards. ([#16207](https://github.com/mastra-ai/mastra/pull/16207))

  **Example**

  ```ts
  const mastra = new Mastra({
    server: {
      a2a: {
        agentCardSigning: {
          privateKey: process.env.A2A_AGENT_CARD_PRIVATE_KEY!,
          protectedHeader: {
            alg: 'ES256',
            kid: 'agent-card-key',
          },
          header: {
            issuer: 'mastra',
          },
        },
      },
    },
  });
  ```

  Mastra now conditionally signs served A2A Agent Cards via `signAgentCard(...)` when `server.a2a.agentCardSigning` is configured, and the A2A Agent Card response schema now includes the `signatures` array.

- Add `POST /api/agents/:agentId/resume-stream-until-idle` SSE route, mirroring `agent.resumeStreamUntilIdle()`. ([#16260](https://github.com/mastra-ai/mastra/pull/16260))

### Patch Changes

- Updated dependencies [[`9f17410`](https://github.com/mastra-ai/mastra/commit/9f1741080def23d42ee50b39887a385ae316a3c6), [`c6eb39e`](https://github.com/mastra-ai/mastra/commit/c6eb39ea6dca381c6563cb240237fbe608e02f93), [`900d086`](https://github.com/mastra-ai/mastra/commit/900d086bb737b9cf2fcf68f11b0389b801a2738c), [`4c0e286`](https://github.com/mastra-ai/mastra/commit/4c0e28637c9cfb4f416549b55e97ebfa13319dfc), [`25184ff`](https://github.com/mastra-ai/mastra/commit/25184ffaf1293ec95119426eb1a1f8d38831b96c), [`aebde9c`](https://github.com/mastra-ai/mastra/commit/aebde9cfacf56592c6b6350cae721740fe090b8a)]:
  - @mastra/core@1.33.0-alpha.4

## 1.33.0-alpha.3

### Minor Changes

- Allow stored Responses API follow-up requests to use `previous_response_id` without also passing `agent_id`. ([#16246](https://github.com/mastra-ai/mastra/pull/16246))

  When callers pass both `previous_response_id` and an explicit `agent_id`, mismatched agents now return a clear 400 response instead of looking like a missing stored response.

  The create-response schema now also rejects empty `agent_id` and `previous_response_id` strings.

- Added `mastra api`, a machine-readable runtime CLI for calling Mastra server resources with JSON input and output. ([#16128](https://github.com/mastra-ai/mastra/pull/16128))

  The new API CLI supports agents, workflows, tools, MCP servers, memory threads, working memory, observability traces/logs/scores, datasets, and experiments. It includes schema-aware request handling so a single JSON input is split into path, query, and body fields based on server route contracts, plus ergonomic raw-input wrapping for tool execution.

  Exposed a route-derived server API schema manifest at runtime and generated CLI route metadata from it, enabling `--schema` output, response-shape-aware normalization, and server-aligned pagination output.

### Patch Changes

- Updated dependencies [[`087e413`](https://github.com/mastra-ai/mastra/commit/087e4133e5d6efa36619e9556c16750e4179c047), [`087e413`](https://github.com/mastra-ai/mastra/commit/087e4133e5d6efa36619e9556c16750e4179c047), [`087e413`](https://github.com/mastra-ai/mastra/commit/087e4133e5d6efa36619e9556c16750e4179c047)]:
  - @mastra/core@1.33.0-alpha.3

## 1.33.0-alpha.2

### Patch Changes

- Updated dependencies [[`d1fdbd0`](https://github.com/mastra-ai/mastra/commit/d1fdbd012add5623cb7e6b7f882b605ab358bbb4), [`d91ebe2`](https://github.com/mastra-ai/mastra/commit/d91ebe28ee065d8f2ed6df741c3c07f58d359529)]:
  - @mastra/core@1.33.0-alpha.2

## 1.33.0-alpha.1

### Patch Changes

- Updated dependencies [[`dccd8f1`](https://github.com/mastra-ai/mastra/commit/dccd8f1f8b8f1ad203b77556207e5529567c616d)]:
  - @mastra/core@1.33.0-alpha.1

## 1.33.0-alpha.0

### Minor Changes

- Added in-memory A2A push notification support for task updates. ([#16175](https://github.com/mastra-ai/mastra/pull/16175))

  Clients can now register push notification configs with `message/send`, `message/stream`, or the `tasks/pushNotificationConfig/*` methods. The server advertises push notification support in the agent card and sends the current task snapshot to registered webhooks when a task reaches `completed`, `failed`, `canceled`, or `input-required`.

  Webhook delivery validates the configured URL and pins outbound delivery to the validated address to reduce DNS rebinding risk. This remains in-memory and best-effort; operators should still use normal egress controls and avoid exposing push delivery to networks with sensitive internal services unless they trust the configured webhook targets.

  ```ts
  await a2a.setTaskPushNotificationConfig({
    taskId: 'task-123',
    pushNotificationConfig: {
      url: 'https://example.com/a2a-webhook',
      token: 'session-token',
    },
  });
  ```

### Patch Changes

- Updated dependencies [[`ac47842`](https://github.com/mastra-ai/mastra/commit/ac478427aa7a5f5fdaed633a911218689b438c60)]:
  - @mastra/core@1.33.0-alpha.0

## 1.32.1

### Patch Changes

- Fix a startup crash in `@mastra/server` when paired with an older `@mastra/core` (e.g. `1.31.0`) that does not export newer 1.32 names. ([#16194](https://github.com/mastra-ai/mastra/pull/16194))

  The server now starts successfully on those versions. Endpoints that depend on 1.32-only functionality degrade at request time instead of failing at module load.

- Updated dependencies [[`cc0469d`](https://github.com/mastra-ai/mastra/commit/cc0469d671d6f7a426013e4425f9501da6fa45f2)]:
  - @mastra/core@1.32.1

## 1.32.1-alpha.0

### Patch Changes

- Fix a startup crash in `@mastra/server` when paired with an older `@mastra/core` (e.g. `1.31.0`) that does not export newer 1.32 names. ([#16194](https://github.com/mastra-ai/mastra/pull/16194))

  The server now starts successfully on those versions. Endpoints that depend on 1.32-only functionality degrade at request time instead of failing at module load.

- Updated dependencies [[`cc0469d`](https://github.com/mastra-ai/mastra/commit/cc0469d671d6f7a426013e4425f9501da6fa45f2)]:
  - @mastra/core@1.32.1-alpha.0

## 1.32.0

### Minor Changes

- Extend the schedules storage schema to support owned schedules and richer trigger audit. This is a breaking schema change to `mastra_schedules` and `mastra_schedule_triggers`; scheduled workflows are still in alpha so no compat shim is provided. ([#16166](https://github.com/mastra-ai/mastra/pull/16166))
  - `Schedule` gains optional `ownerType` / `ownerId` so a schedule row can be attributed to an owning subsystem (e.g. an agent that owns a heartbeat schedule). Workflow schedules leave both fields unset.
  - `ScheduleTrigger.status` is renamed to `outcome` and the type is widened to `ScheduleTriggerOutcome` so future outcome values can be added without another rename.
  - `ScheduleTrigger` gains a stable `id` primary key and new `triggerKind`, `parentTriggerId`, and `metadata` fields. `triggerKind` distinguishes `schedule-fire` rows from later `queue-drain` rows (used by upcoming heartbeat work); `parentTriggerId` links related rows; `metadata` carries outcome-specific context.
  - The libsql, pg, and mongodb adapters all add the new columns/indexes. Their `@mastra/core` peer dependency is tightened to `>=1.32.0-0 <2.0.0-0` so installing a new storage adapter against an older core (or vice-versa) surfaces a peer-dependency warning at install time instead of silently writing/reading the wrong field.
  - Scheduler producer, server schemas/handler, and client SDK types are updated to use the new fields. The `triggers` response on `GET /api/schedules/:id/triggers` now returns `outcome` instead of `status`.
  - The bundled Studio (Mastra CLI) is updated to read `outcome` so the schedule detail page keeps polling and rendering publish-failure rows correctly.

- Added API endpoints for MCP server resources, enabling clients to list and read app resources for interactive UI rendering. ([#16004](https://github.com/mastra-ai/mastra/pull/16004))
  - `GET /api/mcp/:serverId/resources` — lists available resources on an MCP server
  - `POST /api/mcp/:serverId/resources/read` — reads a specific resource by URI (e.g. `ui://calculator/app`)

- Added HTTP routes for scheduled workflows. ([#15830](https://github.com/mastra-ai/mastra/pull/15830))
  - `GET /api/schedules` — list schedules across the project, optionally filtered by `workflowId`.
  - `GET /api/schedules/:scheduleId` — fetch a schedule with its most recent run summary.
  - `GET /api/schedules/:scheduleId/triggers` — paginated trigger history joined to the corresponding workflow run.
  - `POST /api/schedules/:scheduleId/pause` and `POST /api/schedules/:scheduleId/resume` — durable pause/resume. Both require `schedules:write` and are idempotent. Resume recomputes `nextFireAt` from now so a long-paused schedule does not fire a backlog.

- Added `listBranches` and `getBranch` endpoints. Use these to find specific runs of an agent, workflow, tool, or processor — even when they are nested inside another trace — and to fetch the subtree of spans rooted at any single span. ([#16177](https://github.com/mastra-ai/mastra/pull/16177))

  ```
  GET /observability/branches?spanType=agent_run&entityName=Observer
  GET /observability/traces/:traceId/branches/:spanId?depth=1
  ```

  Each row in `listBranches` is a single anchor span (one of `AGENT_RUN`, `WORKFLOW_RUN`, `PROCESSOR_RUN`, `SCORER_RUN`, `RAG_INGESTION`, `TOOL_CALL`, `MCP_TOOL_CALL`), so entities that always run as a child (e.g., an `Observer` agent inside a workflow) — previously not listable through `listTraces` — are now queryable via the HTTP API. `getBranch` accepts an optional `depth` (`0` = anchor only; omitted = full subtree).

  Follow-up to https://github.com/mastra-ai/mastra/pull/16154 which added the underlying `@mastra/core` storage APIs.

- Added Fine-Grained Authorization (FGA) enforcement across server handlers and memory APIs: ([#15410](https://github.com/mastra-ai/mastra/pull/15410))
  - Route-level checks on detail endpoints, custom routes (including request-aware resource ID resolvers and path parameters), and resource-scoped search
  - Thread-level checks on reads, writes, creation, cloning, message saving, and listing — with unviewable threads hidden from totals and pagination
  - Message deletion now denies access when the message's thread cannot be verified
  - Authenticated user context preserved through thread authorization, and the thread's owning `resourceId` forwarded into the FGA context so providers can derive composite tenant-scoped resource IDs
  - Route permission derivation and memory clone checks now use the correct resource context
  - Typed FGA permission constants accepted in route and thread authorization config

### Patch Changes

- Fixed A2A task resubscribe to return the current task snapshot and continue streaming live artifact and status updates for in-progress tasks. ([#15987](https://github.com/mastra-ai/mastra/pull/15987))

- Added an observability score lookup endpoint at `GET /observability/scores/:scoreId` backed by observability storage. ([#16162](https://github.com/mastra-ai/mastra/pull/16162))

- Added MCP Apps extension support (SEP-1865). MCPServer now accepts an `appResources` config to register interactive `ui://` HTML resources. MCPClient preserves full tool `_meta` (including `ui.resourceUri`) when converting MCP tools to Mastra tools. Both advertise the `io.modelcontextprotocol/ui` extension capability. ([#16004](https://github.com/mastra-ai/mastra/pull/16004))

  **Example — MCPServer with app resources:**

  ```typescript
  const server = new MCPServer({
    name: 'my-server',
    tools: { myTool },
    appResources: {
      dashboard: {
        name: 'Dashboard',
        description: 'Interactive dashboard UI',
        html: '<html>...</html>',
      },
    },
  });
  ```

- Added server-generated route contract types for the JavaScript client SDK and updated the SDK to use those generated request and response types. ([#15519](https://github.com/mastra-ai/mastra/pull/15519))

- Updated dependencies [[`6dcd65f`](https://github.com/mastra-ai/mastra/commit/6dcd65f2a34069e6dc43ba35f1d11119b9b40bef), [`86c0298`](https://github.com/mastra-ai/mastra/commit/86c0298e647306423c842f9d5ac827bd616bd13d), [`c05c9a1`](https://github.com/mastra-ai/mastra/commit/c05c9a13230988cef6d438a62f37760f31927bc7), [`ca28c23`](https://github.com/mastra-ai/mastra/commit/ca28c232a2f18801a6cf20fe053479237b4d4fb0), [`e24aacb`](https://github.com/mastra-ai/mastra/commit/e24aacba07bd66f5d95b636dc24016fca26b52cf), [`7679a63`](https://github.com/mastra-ai/mastra/commit/7679a634eae8e8ca459fd87538fdf72b4389b07f), [`7fce309`](https://github.com/mastra-ai/mastra/commit/7fce30912b14170bfc41f0ac736cca0f39fe0cd4), [`1d64a76`](https://github.com/mastra-ai/mastra/commit/1d64a765861a0772ea187bab76e5ed37bf82d042), [`1c2dda8`](https://github.com/mastra-ai/mastra/commit/1c2dda805fbfccc0abf55d4cb20cc34402dc3f0c), [`c721164`](https://github.com/mastra-ai/mastra/commit/c7211643f7ac861f83b19a3757cc921487fc9d75), [`1b55954`](https://github.com/mastra-ai/mastra/commit/1b559541c1e08a10e49d01ffc51a634dfc37a286), [`7997c2e`](https://github.com/mastra-ai/mastra/commit/7997c2e55ddd121562a4098cd8d2b89c68433bf1), [`5adc55e`](https://github.com/mastra-ai/mastra/commit/5adc55e63407be8ee977914957d68bcc2a075ceb), [`7679a63`](https://github.com/mastra-ai/mastra/commit/7679a634eae8e8ca459fd87538fdf72b4389b07f), [`a0d9b6d`](https://github.com/mastra-ai/mastra/commit/a0d9b6d6b810aeaa9e177a0dcc99a4402e609634), [`e97ccb9`](https://github.com/mastra-ai/mastra/commit/e97ccb900f8b7a390ce82c9f8eb8d6eb2c5e3777), [`c5daf48`](https://github.com/mastra-ai/mastra/commit/c5daf48556e98c46ae06caf00f92c249912007e9), [`70017d7`](https://github.com/mastra-ai/mastra/commit/70017d72ab741b5d7040e2a15c251a317782e39e), [`cd96779`](https://github.com/mastra-ai/mastra/commit/cd9677937f113b2856dc8b9f3d4bdabcee58bb2e), [`b0c7022`](https://github.com/mastra-ai/mastra/commit/b0c70224f80dad7c0cdbfb22cbff22e0f75c064f), [`e4942bc`](https://github.com/mastra-ai/mastra/commit/e4942bc7fdc903572f7d84f26d5e15f9d39c763d)]:
  - @mastra/core@1.32.0

## 1.32.0-alpha.4

### Minor Changes

- Added API endpoints for MCP server resources, enabling clients to list and read app resources for interactive UI rendering. ([#16004](https://github.com/mastra-ai/mastra/pull/16004))
  - `GET /api/mcp/:serverId/resources` — lists available resources on an MCP server
  - `POST /api/mcp/:serverId/resources/read` — reads a specific resource by URI (e.g. `ui://calculator/app`)

### Patch Changes

- Added MCP Apps extension support (SEP-1865). MCPServer now accepts an `appResources` config to register interactive `ui://` HTML resources. MCPClient preserves full tool `_meta` (including `ui.resourceUri`) when converting MCP tools to Mastra tools. Both advertise the `io.modelcontextprotocol/ui` extension capability. ([#16004](https://github.com/mastra-ai/mastra/pull/16004))

  **Example — MCPServer with app resources:**

  ```typescript
  const server = new MCPServer({
    name: 'my-server',
    tools: { myTool },
    appResources: {
      dashboard: {
        name: 'Dashboard',
        description: 'Interactive dashboard UI',
        html: '<html>...</html>',
      },
    },
  });
  ```

- Updated dependencies [[`7679a63`](https://github.com/mastra-ai/mastra/commit/7679a634eae8e8ca459fd87538fdf72b4389b07f), [`1d64a76`](https://github.com/mastra-ai/mastra/commit/1d64a765861a0772ea187bab76e5ed37bf82d042), [`7679a63`](https://github.com/mastra-ai/mastra/commit/7679a634eae8e8ca459fd87538fdf72b4389b07f), [`a0d9b6d`](https://github.com/mastra-ai/mastra/commit/a0d9b6d6b810aeaa9e177a0dcc99a4402e609634)]:
  - @mastra/core@1.32.0-alpha.4

## 1.32.0-alpha.3

### Minor Changes

- Extend the schedules storage schema to support owned schedules and richer trigger audit. This is a breaking schema change to `mastra_schedules` and `mastra_schedule_triggers`; scheduled workflows are still in alpha so no compat shim is provided. ([#16166](https://github.com/mastra-ai/mastra/pull/16166))
  - `Schedule` gains optional `ownerType` / `ownerId` so a schedule row can be attributed to an owning subsystem (e.g. an agent that owns a heartbeat schedule). Workflow schedules leave both fields unset.
  - `ScheduleTrigger.status` is renamed to `outcome` and the type is widened to `ScheduleTriggerOutcome` so future outcome values can be added without another rename.
  - `ScheduleTrigger` gains a stable `id` primary key and new `triggerKind`, `parentTriggerId`, and `metadata` fields. `triggerKind` distinguishes `schedule-fire` rows from later `queue-drain` rows (used by upcoming heartbeat work); `parentTriggerId` links related rows; `metadata` carries outcome-specific context.
  - The libsql, pg, and mongodb adapters all add the new columns/indexes. Their `@mastra/core` peer dependency is tightened to `>=1.32.0-0 <2.0.0-0` so installing a new storage adapter against an older core (or vice-versa) surfaces a peer-dependency warning at install time instead of silently writing/reading the wrong field.
  - Scheduler producer, server schemas/handler, and client SDK types are updated to use the new fields. The `triggers` response on `GET /api/schedules/:id/triggers` now returns `outcome` instead of `status`.
  - The bundled Studio (Mastra CLI) is updated to read `outcome` so the schedule detail page keeps polling and rendering publish-failure rows correctly.

- Added `listBranches` and `getBranch` endpoints. Use these to find specific runs of an agent, workflow, tool, or processor — even when they are nested inside another trace — and to fetch the subtree of spans rooted at any single span. ([#16177](https://github.com/mastra-ai/mastra/pull/16177))

  ```
  GET /observability/branches?spanType=agent_run&entityName=Observer
  GET /observability/traces/:traceId/branches/:spanId?depth=1
  ```

  Each row in `listBranches` is a single anchor span (one of `AGENT_RUN`, `WORKFLOW_RUN`, `PROCESSOR_RUN`, `SCORER_RUN`, `RAG_INGESTION`, `TOOL_CALL`, `MCP_TOOL_CALL`), so entities that always run as a child (e.g., an `Observer` agent inside a workflow) — previously not listable through `listTraces` — are now queryable via the HTTP API. `getBranch` accepts an optional `depth` (`0` = anchor only; omitted = full subtree).

  Follow-up to https://github.com/mastra-ai/mastra/pull/16154 which added the underlying `@mastra/core` storage APIs.

### Patch Changes

- Fixed A2A task resubscribe to return the current task snapshot and continue streaming live artifact and status updates for in-progress tasks. ([#15987](https://github.com/mastra-ai/mastra/pull/15987))

- Updated dependencies [[`ca28c23`](https://github.com/mastra-ai/mastra/commit/ca28c232a2f18801a6cf20fe053479237b4d4fb0)]:
  - @mastra/core@1.32.0-alpha.3

## 1.32.0-alpha.2

### Minor Changes

- Added Fine-Grained Authorization (FGA) enforcement across server handlers and memory APIs: ([#15410](https://github.com/mastra-ai/mastra/pull/15410))
  - Route-level checks on detail endpoints, custom routes (including request-aware resource ID resolvers and path parameters), and resource-scoped search
  - Thread-level checks on reads, writes, creation, cloning, message saving, and listing — with unviewable threads hidden from totals and pagination
  - Message deletion now denies access when the message's thread cannot be verified
  - Authenticated user context preserved through thread authorization, and the thread's owning `resourceId` forwarded into the FGA context so providers can derive composite tenant-scoped resource IDs
  - Route permission derivation and memory clone checks now use the correct resource context
  - Typed FGA permission constants accepted in route and thread authorization config

### Patch Changes

- Added an observability score lookup endpoint at `GET /observability/scores/:scoreId` backed by observability storage. ([#16162](https://github.com/mastra-ai/mastra/pull/16162))

- Added server-generated route contract types for the JavaScript client SDK and updated the SDK to use those generated request and response types. ([#15519](https://github.com/mastra-ai/mastra/pull/15519))

- Updated dependencies [[`86c0298`](https://github.com/mastra-ai/mastra/commit/86c0298e647306423c842f9d5ac827bd616bd13d), [`7fce309`](https://github.com/mastra-ai/mastra/commit/7fce30912b14170bfc41f0ac736cca0f39fe0cd4), [`7997c2e`](https://github.com/mastra-ai/mastra/commit/7997c2e55ddd121562a4098cd8d2b89c68433bf1), [`e97ccb9`](https://github.com/mastra-ai/mastra/commit/e97ccb900f8b7a390ce82c9f8eb8d6eb2c5e3777), [`c5daf48`](https://github.com/mastra-ai/mastra/commit/c5daf48556e98c46ae06caf00f92c249912007e9), [`cd96779`](https://github.com/mastra-ai/mastra/commit/cd9677937f113b2856dc8b9f3d4bdabcee58bb2e)]:
  - @mastra/core@1.32.0-alpha.2

## 1.32.0-alpha.1

### Minor Changes

- Added HTTP routes for scheduled workflows. ([#15830](https://github.com/mastra-ai/mastra/pull/15830))
  - `GET /api/schedules` — list schedules across the project, optionally filtered by `workflowId`.
  - `GET /api/schedules/:scheduleId` — fetch a schedule with its most recent run summary.
  - `GET /api/schedules/:scheduleId/triggers` — paginated trigger history joined to the corresponding workflow run.
  - `POST /api/schedules/:scheduleId/pause` and `POST /api/schedules/:scheduleId/resume` — durable pause/resume. Both require `schedules:write` and are idempotent. Resume recomputes `nextFireAt` from now so a long-paused schedule does not fire a backlog.

### Patch Changes

- Updated dependencies [[`c05c9a1`](https://github.com/mastra-ai/mastra/commit/c05c9a13230988cef6d438a62f37760f31927bc7), [`e24aacb`](https://github.com/mastra-ai/mastra/commit/e24aacba07bd66f5d95b636dc24016fca26b52cf), [`c721164`](https://github.com/mastra-ai/mastra/commit/c7211643f7ac861f83b19a3757cc921487fc9d75), [`1b55954`](https://github.com/mastra-ai/mastra/commit/1b559541c1e08a10e49d01ffc51a634dfc37a286), [`5adc55e`](https://github.com/mastra-ai/mastra/commit/5adc55e63407be8ee977914957d68bcc2a075ceb), [`70017d7`](https://github.com/mastra-ai/mastra/commit/70017d72ab741b5d7040e2a15c251a317782e39e), [`e4942bc`](https://github.com/mastra-ai/mastra/commit/e4942bc7fdc903572f7d84f26d5e15f9d39c763d)]:
  - @mastra/core@1.32.0-alpha.1

## 1.31.1-alpha.0

### Patch Changes

- Updated dependencies [[`6dcd65f`](https://github.com/mastra-ai/mastra/commit/6dcd65f2a34069e6dc43ba35f1d11119b9b40bef), [`1c2dda8`](https://github.com/mastra-ai/mastra/commit/1c2dda805fbfccc0abf55d4cb20cc34402dc3f0c)]:
  - @mastra/core@1.31.1-alpha.0

## 1.31.0

### Patch Changes

- Fix `GET /tools/:toolId` and `POST /tools/:toolId/execute` to find dynamically-resolved agent tools (provided via `toolsResolver` / function-based `tools`) when they are not in the static tool registry. Errors thrown by an individual agent's `listTools()` during the lookup are now logged as warnings instead of being silently swallowed. ([#13989](https://github.com/mastra-ai/mastra/pull/13989))

- Fixed memory query validation when optional JSON query params are omitted with newer Zod versions. ([#15969](https://github.com/mastra-ai/mastra/pull/15969))

- Export `MastraServerBase` from `@mastra/core/server` so framework adapters that manage routing independently can share the same server base class. ([#12751](https://github.com/mastra-ai/mastra/pull/12751))

- Added platform channels framework with ChannelProvider interface, ChannelsStorage domain, and ChannelConnectResult discriminated union supporting OAuth, deep link, and immediate connection flows. Channels can be registered on the Mastra instance and expose connect/disconnect/list APIs for platform integrations. ([#15876](https://github.com/mastra-ai/mastra/pull/15876))

- Updated dependencies [[`1723e09`](https://github.com/mastra-ai/mastra/commit/1723e099829892419ddbfe49287acfeac2522724), [`629f9e9`](https://github.com/mastra-ai/mastra/commit/629f9e9a7e56aa8f129515a3923c5813298790c7), [`25168fb`](https://github.com/mastra-ai/mastra/commit/25168fb9c1de9db7f8171df4f58ceb842c53aa29), [`ab34b5a`](https://github.com/mastra-ai/mastra/commit/ab34b5a2191b8e4353df1dbf7b9155e7d6628d79), [`5fb6c2a`](https://github.com/mastra-ai/mastra/commit/5fb6c2a95c1843cc231704b91354311fc1f34a71), [`2b0f355`](https://github.com/mastra-ai/mastra/commit/2b0f3553be3e9e5524da539a66e5cf82668440a4), [`394f0cf`](https://github.com/mastra-ai/mastra/commit/394f0cfc31e6b4d801219fdef2e9cc69e5bc8682), [`b2deb29`](https://github.com/mastra-ai/mastra/commit/b2deb29412b300c868655b5840463614fbb7962d), [`66644be`](https://github.com/mastra-ai/mastra/commit/66644beac1aa560f0e417956ff007c89341dc382), [`e109607`](https://github.com/mastra-ai/mastra/commit/e10960749251e34d46b480a20648c490fd30381b), [`310b953`](https://github.com/mastra-ai/mastra/commit/310b95345f302dcd5ba3ed862bdc96f059d44122), [`3d7f709`](https://github.com/mastra-ai/mastra/commit/3d7f709b615e588050bb6283c4ee5cfe2978cbde), [`48a42f1`](https://github.com/mastra-ai/mastra/commit/48a42f114a4006a95e0b7a1b5ad1a24815a175c2), [`8091c7c`](https://github.com/mastra-ai/mastra/commit/8091c7c944d15e13fef6d61b6cfd903f158d4006), [`2c83efc`](https://github.com/mastra-ai/mastra/commit/2c83efc4482b3efe50830e3b8b4ba9a8d219edff), [`43f0e1d`](https://github.com/mastra-ai/mastra/commit/43f0e1d5d5a74ba6fc746f2ad89ebe0c64777a7d), [`da0b9e2`](https://github.com/mastra-ai/mastra/commit/da0b9e2ba7ecc560213b426d6c097fe63946086e), [`282a10c`](https://github.com/mastra-ai/mastra/commit/282a10c9446e9922afe80e10e3770481c8ac8a28), [`04151c7`](https://github.com/mastra-ai/mastra/commit/04151c7dcea934b4fe9076708a23fac161195414), [`8091c7c`](https://github.com/mastra-ai/mastra/commit/8091c7c944d15e13fef6d61b6cfd903f158d4006)]:
  - @mastra/core@1.31.0

## 1.31.0-alpha.5

### Patch Changes

- Fix `GET /tools/:toolId` and `POST /tools/:toolId/execute` to find dynamically-resolved agent tools (provided via `toolsResolver` / function-based `tools`) when they are not in the static tool registry. Errors thrown by an individual agent's `listTools()` during the lookup are now logged as warnings instead of being silently swallowed. ([#13989](https://github.com/mastra-ai/mastra/pull/13989))

- Updated dependencies:
  - @mastra/core@1.31.0-alpha.5

## 1.31.0-alpha.4

### Patch Changes

- Export `MastraServerBase` from `@mastra/core/server` so framework adapters that manage routing independently can share the same server base class. ([#12751](https://github.com/mastra-ai/mastra/pull/12751))

- Updated dependencies [[`8091c7c`](https://github.com/mastra-ai/mastra/commit/8091c7c944d15e13fef6d61b6cfd903f158d4006), [`04151c7`](https://github.com/mastra-ai/mastra/commit/04151c7dcea934b4fe9076708a23fac161195414), [`8091c7c`](https://github.com/mastra-ai/mastra/commit/8091c7c944d15e13fef6d61b6cfd903f158d4006)]:
  - @mastra/core@1.31.0-alpha.4

## 1.31.0-alpha.3

### Patch Changes

- Added platform channels framework with ChannelProvider interface, ChannelsStorage domain, and ChannelConnectResult discriminated union supporting OAuth, deep link, and immediate connection flows. Channels can be registered on the Mastra instance and expose connect/disconnect/list APIs for platform integrations. ([#15876](https://github.com/mastra-ai/mastra/pull/15876))

- Updated dependencies [[`b2deb29`](https://github.com/mastra-ai/mastra/commit/b2deb29412b300c868655b5840463614fbb7962d), [`66644be`](https://github.com/mastra-ai/mastra/commit/66644beac1aa560f0e417956ff007c89341dc382), [`310b953`](https://github.com/mastra-ai/mastra/commit/310b95345f302dcd5ba3ed862bdc96f059d44122), [`43f0e1d`](https://github.com/mastra-ai/mastra/commit/43f0e1d5d5a74ba6fc746f2ad89ebe0c64777a7d), [`da0b9e2`](https://github.com/mastra-ai/mastra/commit/da0b9e2ba7ecc560213b426d6c097fe63946086e)]:
  - @mastra/core@1.31.0-alpha.3

## 1.31.0-alpha.2

### Patch Changes

- Updated dependencies [[`2b0f355`](https://github.com/mastra-ai/mastra/commit/2b0f3553be3e9e5524da539a66e5cf82668440a4)]:
  - @mastra/core@1.31.0-alpha.2

## 1.31.0-alpha.1

### Patch Changes

- Updated dependencies [[`e109607`](https://github.com/mastra-ai/mastra/commit/e10960749251e34d46b480a20648c490fd30381b)]:
  - @mastra/core@1.31.0-alpha.1

## 1.31.0-alpha.0

### Patch Changes

- Fixed memory query validation when optional JSON query params are omitted with newer Zod versions. ([#15969](https://github.com/mastra-ai/mastra/pull/15969))

- Updated dependencies [[`1723e09`](https://github.com/mastra-ai/mastra/commit/1723e099829892419ddbfe49287acfeac2522724), [`629f9e9`](https://github.com/mastra-ai/mastra/commit/629f9e9a7e56aa8f129515a3923c5813298790c7), [`25168fb`](https://github.com/mastra-ai/mastra/commit/25168fb9c1de9db7f8171df4f58ceb842c53aa29), [`ab34b5a`](https://github.com/mastra-ai/mastra/commit/ab34b5a2191b8e4353df1dbf7b9155e7d6628d79), [`5fb6c2a`](https://github.com/mastra-ai/mastra/commit/5fb6c2a95c1843cc231704b91354311fc1f34a71), [`394f0cf`](https://github.com/mastra-ai/mastra/commit/394f0cfc31e6b4d801219fdef2e9cc69e5bc8682), [`3d7f709`](https://github.com/mastra-ai/mastra/commit/3d7f709b615e588050bb6283c4ee5cfe2978cbde), [`48a42f1`](https://github.com/mastra-ai/mastra/commit/48a42f114a4006a95e0b7a1b5ad1a24815a175c2), [`2c83efc`](https://github.com/mastra-ai/mastra/commit/2c83efc4482b3efe50830e3b8b4ba9a8d219edff), [`282a10c`](https://github.com/mastra-ai/mastra/commit/282a10c9446e9922afe80e10e3770481c8ac8a28)]:
  - @mastra/core@1.31.0-alpha.0

## 1.30.0

### Minor Changes

- Update peer dependencies to match core package version bump (1.0.5) ([#12557](https://github.com/mastra-ai/mastra/pull/12557))

### Patch Changes

- Fixed a regression in 1.29.0 where configuring an agent with channel adapters (e.g. `channels.adapters.slack`) caused server startup to crash with a "Custom API route ... must not start with /api" error. The custom-route prefix validation now skips framework-generated webhook routes. ([#15952](https://github.com/mastra-ai/mastra/pull/15952))

- Fix MCP client support in the agent editor: ([#15945](https://github.com/mastra-ai/mastra/pull/15945))
  - MCP client form dirty state: Save button now enables after adding/removing MCP clients
  - MCP tool name matching: Both bare and namespaced tool names are matched correctly
  - Auth token forwarding: Token from cookie or header is forwarded to auth-protected MCP servers
  - String interpolation: Request context variables in system prompts now resolve correctly

- Add durable agents with resumable streams ([#12557](https://github.com/mastra-ai/mastra/pull/12557))

  Durable agents make agent execution resilient to disconnections, crashes, and long-running operations.

  ### The Problem

  Standard agent streaming has two fragility points:
  1. **Connection drops** - If a client disconnects mid-stream (network blip, browser refresh, mobile app backgrounded), all subsequent events are lost. The client has no way to "catch up" on what they missed.
  2. **Long-running operations** - Agent loops with tool calls can take minutes. Holding an HTTP connection open that long is unreliable. If the server restarts or the connection times out, the work is lost.

  ### The Solution

  **Resumable streams** solve connection drops. Every event is cached with a sequential index. If a client disconnects at event 5, they can reconnect and request events starting from index 6. They receive cached events immediately, then continue with live events as they arrive.

  **Durable execution** solves long-running operations. Instead of executing the agent loop directly in the HTTP request, execution happens in a workflow engine (built-in evented engine or Inngest). The HTTP request just subscribes to events. If the connection drops, execution continues. The client can reconnect anytime to observe progress.

  ### Usage

  Wrap any existing `Agent` with durability using factory functions:

  ```typescript
  import { Agent } from '@mastra/core/agent';
  import { createDurableAgent } from '@mastra/core/agent/durable';

  const agent = new Agent({
    id: 'my-agent',
    model: openai('gpt-4'),
    instructions: 'You are helpful',
  });

  const durableAgent = createDurableAgent({ agent });
  ```

  **Factory functions for different execution strategies:**

  | Factory                                  | Execution                           | Use Case                        |
  | ---------------------------------------- | ----------------------------------- | ------------------------------- |
  | `createDurableAgent({ agent })`          | Local, synchronous                  | Development, simple deployments |
  | `createEventedAgent({ agent })`          | Fire-and-forget via workflow engine | Long-running operations         |
  | `createInngestAgent({ agent, inngest })` | Inngest-powered                     | Production, distributed systems |

  ### Resumable Streams

  ```typescript
  // Start streaming
  const { runId, output } = await durableAgent.stream('Analyze this data...');

  // Client disconnects at event 5...

  // Reconnect and resume from where we left off
  const { output: resumed } = await durableAgent.observe(runId, { offset: 6 });
  // Receives events 6, 7, 8... from cache, then continues with live events
  ```

  ### PubSub and Cache

  Durable agents use two infrastructure components:

  | Component  | Purpose                                   | Default               |
  | ---------- | ----------------------------------------- | --------------------- |
  | **PubSub** | Real-time event delivery during streaming | `EventEmitterPubSub`  |
  | **Cache**  | Stores events for replay on reconnection  | `InMemoryServerCache` |

  When `stream()` is called, events flow through pubsub in real-time. The cache stores each event with a sequential index. When `observe()` is called, missed events replay from cache before continuing with live events.

  **Configure via Mastra instance (recommended):**

  ```typescript
  const mastra = new Mastra({
    cache: new RedisServerCache({ url: 'redis://...' }),
    pubsub: new RedisPubSub({ url: 'redis://...' }),
    agents: {
      // Inherits cache and pubsub from Mastra
      myAgent: createDurableAgent({ agent }),
    },
  });
  ```

  **Configure per-agent (overrides Mastra):**

  ```typescript
  const durableAgent = createDurableAgent({
    agent,
    cache: new RedisServerCache({ url: 'redis://...' }),
    pubsub: new RedisPubSub({ url: 'redis://...' }),
  });
  ```

  **Disable caching (streams won't be resumable):**

  ```typescript
  const durableAgent = createDurableAgent({ agent, cache: false });
  ```

  For single-instance deployments, the defaults work fine. For multi-instance deployments (load balancer, horizontal scaling), use Redis-backed implementations so any instance can serve reconnection requests.

  ### Class Hierarchy
  - `DurableAgent` extends `Agent` - base class with resumable streams
  - `EventedAgent` extends `DurableAgent` - fire-and-forget execution
  - `InngestAgent` extends `DurableAgent` - Inngest-powered execution

- Fix A2A streaming to emit incremental artifact updates from the agent full stream while preserving final structured output artifacts. ([#15941](https://github.com/mastra-ai/mastra/pull/15941))

- Updated dependencies [[`920c757`](https://github.com/mastra-ai/mastra/commit/920c75799c6bd71787d86deaf654a35af4c839ca), [`d587199`](https://github.com/mastra-ai/mastra/commit/d5871993c0371bde2b0717d6b47194755baa1443), [`1fe2533`](https://github.com/mastra-ai/mastra/commit/1fe2533c4382ca6858aac7c4b63e888c2eac6541), [`f8694b6`](https://github.com/mastra-ai/mastra/commit/f8694b6fa0b7a5cde71d794c3bbef4957c55bcb8)]:
  - @mastra/core@1.30.0

## 1.30.0-alpha.1

### Minor Changes

- Update peer dependencies to match core package version bump (1.0.5) ([#12557](https://github.com/mastra-ai/mastra/pull/12557))

### Patch Changes

- Fixed a regression in 1.29.0 where configuring an agent with channel adapters (e.g. `channels.adapters.slack`) caused server startup to crash with a "Custom API route ... must not start with /api" error. The custom-route prefix validation now skips framework-generated webhook routes. ([#15952](https://github.com/mastra-ai/mastra/pull/15952))

- Fix MCP client support in the agent editor: ([#15945](https://github.com/mastra-ai/mastra/pull/15945))
  - MCP client form dirty state: Save button now enables after adding/removing MCP clients
  - MCP tool name matching: Both bare and namespaced tool names are matched correctly
  - Auth token forwarding: Token from cookie or header is forwarded to auth-protected MCP servers
  - String interpolation: Request context variables in system prompts now resolve correctly

- Add durable agents with resumable streams ([#12557](https://github.com/mastra-ai/mastra/pull/12557))

  Durable agents make agent execution resilient to disconnections, crashes, and long-running operations.

  ### The Problem

  Standard agent streaming has two fragility points:
  1. **Connection drops** - If a client disconnects mid-stream (network blip, browser refresh, mobile app backgrounded), all subsequent events are lost. The client has no way to "catch up" on what they missed.
  2. **Long-running operations** - Agent loops with tool calls can take minutes. Holding an HTTP connection open that long is unreliable. If the server restarts or the connection times out, the work is lost.

  ### The Solution

  **Resumable streams** solve connection drops. Every event is cached with a sequential index. If a client disconnects at event 5, they can reconnect and request events starting from index 6. They receive cached events immediately, then continue with live events as they arrive.

  **Durable execution** solves long-running operations. Instead of executing the agent loop directly in the HTTP request, execution happens in a workflow engine (built-in evented engine or Inngest). The HTTP request just subscribes to events. If the connection drops, execution continues. The client can reconnect anytime to observe progress.

  ### Usage

  Wrap any existing `Agent` with durability using factory functions:

  ```typescript
  import { Agent } from '@mastra/core/agent';
  import { createDurableAgent } from '@mastra/core/agent/durable';

  const agent = new Agent({
    id: 'my-agent',
    model: openai('gpt-4'),
    instructions: 'You are helpful',
  });

  const durableAgent = createDurableAgent({ agent });
  ```

  **Factory functions for different execution strategies:**

  | Factory                                  | Execution                           | Use Case                        |
  | ---------------------------------------- | ----------------------------------- | ------------------------------- |
  | `createDurableAgent({ agent })`          | Local, synchronous                  | Development, simple deployments |
  | `createEventedAgent({ agent })`          | Fire-and-forget via workflow engine | Long-running operations         |
  | `createInngestAgent({ agent, inngest })` | Inngest-powered                     | Production, distributed systems |

  ### Resumable Streams

  ```typescript
  // Start streaming
  const { runId, output } = await durableAgent.stream('Analyze this data...');

  // Client disconnects at event 5...

  // Reconnect and resume from where we left off
  const { output: resumed } = await durableAgent.observe(runId, { offset: 6 });
  // Receives events 6, 7, 8... from cache, then continues with live events
  ```

  ### PubSub and Cache

  Durable agents use two infrastructure components:

  | Component  | Purpose                                   | Default               |
  | ---------- | ----------------------------------------- | --------------------- |
  | **PubSub** | Real-time event delivery during streaming | `EventEmitterPubSub`  |
  | **Cache**  | Stores events for replay on reconnection  | `InMemoryServerCache` |

  When `stream()` is called, events flow through pubsub in real-time. The cache stores each event with a sequential index. When `observe()` is called, missed events replay from cache before continuing with live events.

  **Configure via Mastra instance (recommended):**

  ```typescript
  const mastra = new Mastra({
    cache: new RedisServerCache({ url: 'redis://...' }),
    pubsub: new RedisPubSub({ url: 'redis://...' }),
    agents: {
      // Inherits cache and pubsub from Mastra
      myAgent: createDurableAgent({ agent }),
    },
  });
  ```

  **Configure per-agent (overrides Mastra):**

  ```typescript
  const durableAgent = createDurableAgent({
    agent,
    cache: new RedisServerCache({ url: 'redis://...' }),
    pubsub: new RedisPubSub({ url: 'redis://...' }),
  });
  ```

  **Disable caching (streams won't be resumable):**

  ```typescript
  const durableAgent = createDurableAgent({ agent, cache: false });
  ```

  For single-instance deployments, the defaults work fine. For multi-instance deployments (load balancer, horizontal scaling), use Redis-backed implementations so any instance can serve reconnection requests.

  ### Class Hierarchy
  - `DurableAgent` extends `Agent` - base class with resumable streams
  - `EventedAgent` extends `DurableAgent` - fire-and-forget execution
  - `InngestAgent` extends `DurableAgent` - Inngest-powered execution

- Updated dependencies [[`920c757`](https://github.com/mastra-ai/mastra/commit/920c75799c6bd71787d86deaf654a35af4c839ca), [`1fe2533`](https://github.com/mastra-ai/mastra/commit/1fe2533c4382ca6858aac7c4b63e888c2eac6541), [`f8694b6`](https://github.com/mastra-ai/mastra/commit/f8694b6fa0b7a5cde71d794c3bbef4957c55bcb8)]:
  - @mastra/core@1.30.0-alpha.1

## 1.29.2-alpha.0

### Patch Changes

- Fix A2A streaming to emit incremental artifact updates from the agent full stream while preserving final structured output artifacts. ([#15941](https://github.com/mastra-ai/mastra/pull/15941))

- Updated dependencies [[`d587199`](https://github.com/mastra-ai/mastra/commit/d5871993c0371bde2b0717d6b47194755baa1443)]:
  - @mastra/core@1.29.2-alpha.0

## 1.29.1

### Patch Changes

- Fixed `GET /agents` returning 500 when one agent throws while resolving dynamic configuration under the active request context. ([#15911](https://github.com/mastra-ai/mastra/pull/15911))
  The route now still returns the rest of the agent list and falls back to safe defaults for the failing agent instead of failing the whole response.
- Updated dependencies [[`6db978c`](https://github.com/mastra-ai/mastra/commit/6db978c42e94e75540a504f7230086f0b5cd35f9), [`512a013`](https://github.com/mastra-ai/mastra/commit/512a013f285aa9c0aa8f08a35b2ce09f9938b017), [`e9becde`](https://github.com/mastra-ai/mastra/commit/e9becdeed9176b9f8392e557bde12b933f99cf7a), [`703a443`](https://github.com/mastra-ai/mastra/commit/703a44390c587d9c0b8ae94ec4edd8afb2a74044), [`808df1b`](https://github.com/mastra-ai/mastra/commit/808df1b39358b5f10b7317107e42b1fda7c87185)]:
  - @mastra/core@1.29.1

## 1.29.1-alpha.2

### Patch Changes

- Updated dependencies [[`512a013`](https://github.com/mastra-ai/mastra/commit/512a013f285aa9c0aa8f08a35b2ce09f9938b017), [`e9becde`](https://github.com/mastra-ai/mastra/commit/e9becdeed9176b9f8392e557bde12b933f99cf7a)]:
  - @mastra/core@1.29.1-alpha.2

## 1.29.1-alpha.1

### Patch Changes

- Fixed `GET /agents` returning 500 when one agent throws while resolving dynamic configuration under the active request context. ([#15911](https://github.com/mastra-ai/mastra/pull/15911))
  The route now still returns the rest of the agent list and falls back to safe defaults for the failing agent instead of failing the whole response.
- Updated dependencies [[`703a443`](https://github.com/mastra-ai/mastra/commit/703a44390c587d9c0b8ae94ec4edd8afb2a74044), [`808df1b`](https://github.com/mastra-ai/mastra/commit/808df1b39358b5f10b7317107e42b1fda7c87185)]:
  - @mastra/core@1.29.1-alpha.1

## 1.29.1-alpha.0

### Patch Changes

- Updated dependencies [[`6db978c`](https://github.com/mastra-ai/mastra/commit/6db978c42e94e75540a504f7230086f0b5cd35f9)]:
  - @mastra/core@1.29.1-alpha.0

## 1.29.0

### Minor Changes

- Added support for resuming suspended agent streams over HTTP with custom data. This adds the `POST /agents/:agentId/resume-stream` server endpoint and the client SDK `agent.resumeStream()` method, so apps can continue a suspended agent run through the Mastra client. ([#14579](https://github.com/mastra-ai/mastra/pull/14579))

  **Usage example (client SDK):**

  ```typescript
  const agent = mastraClient.getAgent('my-agent');

  // Resume a suspended agent stream with custom data
  const response = await agent.resumeStream(
    { approved: true, selectedOption: 'plan-b' },
    { runId: 'previous-run-id', toolCallId: 'tool-123' },
  );

  await response.processDataStream({
    onChunk: chunk => console.log(chunk),
  });
  ```

### Patch Changes

- Fixed Studio observability tabs so runtime-injected observability unlocks them. ([#15821](https://github.com/mastra-ai/mastra/pull/15821))

- Authentication now refreshes expired server-side sessions transparently, so recoverable token expiry no longer causes unexpected user sign-outs. Only truly expired sessions (e.g. refresh token dead) return a 401. ([#15819](https://github.com/mastra-ai/mastra/pull/15819))

  Server adapters now forward refreshed session cookies consistently, and auth-studio logs session validation and refresh failures to improve diagnostics.

- Updated the A2A server to match the v0.3 protocol shapes and methods. ([#15720](https://github.com/mastra-ai/mastra/pull/15720))

- Refactored Hono adapter's `registerCustomApiRoutes()` to use the shared `buildCustomRouteHandler()` from the base class instead of duplicating route/handler resolution logic. Added `forwardCustomRouteRequest()` to the base class for adapters that already have a raw `Request` object (avoiding unnecessary request reconstruction). ([#15793](https://github.com/mastra-ai/mastra/pull/15793))

- Custom API routes now validate that their paths don't collide with the built-in route prefix. If a custom route path starts with the server's `apiPrefix` (default `/api`), a descriptive error is thrown at startup. This prevents custom routes from shadowing built-in Mastra routes (e.g. `/api/agents`, `/api/tools`). ([#15743](https://github.com/mastra-ai/mastra/pull/15743))

- Add `POST /api/agents/:agentId/stream-until-idle` SSE route that mirrors `agent.streamUntilIdle()`. The route keeps the SSE stream open through background task completion and the agent's follow-up turn, so clients receive the final answer in a single request. ([#15686](https://github.com/mastra-ai/mastra/pull/15686))

- Updated dependencies [[`28caa5b`](https://github.com/mastra-ai/mastra/commit/28caa5b032358545af2589ed90636eccb4dd9d2f), [`c1ae974`](https://github.com/mastra-ai/mastra/commit/c1ae97491f6e57378ce880c3a397778c42adcdf1), [`b510d36`](https://github.com/mastra-ai/mastra/commit/b510d368f73dab6be2e2c2bc99035aaef1fb7d7a), [`13b4d7c`](https://github.com/mastra-ai/mastra/commit/13b4d7c16de34dff9095d1cd80f22f544b6cfe75), [`7a7b313`](https://github.com/mastra-ai/mastra/commit/7a7b3138fb3bcf0b0c740eaea07971e43d330ef3), [`c04417b`](https://github.com/mastra-ai/mastra/commit/c04417ba0a2e4ded66da4352331ef29cd4bd1d79), [`cf25a03`](https://github.com/mastra-ai/mastra/commit/cf25a03132164b9dc1e5dccf7394824e33007c51), [`8a71261`](https://github.com/mastra-ai/mastra/commit/8a71261e3954ae617c6f8e25767b951f99438ab2), [`9e973b0`](https://github.com/mastra-ai/mastra/commit/9e973b010dacfa15ac82b0072897319f5234b90a), [`dd934a0`](https://github.com/mastra-ai/mastra/commit/dd934a0982ce0f78712fbd559e4f2410bf594b39), [`ba6b0c5`](https://github.com/mastra-ai/mastra/commit/ba6b0c51bfce358554fd33c7f2bcd5593633f2ff), [`a6dac0a`](https://github.com/mastra-ai/mastra/commit/a6dac0a40c7181161b1add4e8534f962bcbc9aa7), [`5a4b1ee`](https://github.com/mastra-ai/mastra/commit/5a4b1ee80212969621228104995589c0fa59e575), [`5a4b1ee`](https://github.com/mastra-ai/mastra/commit/5a4b1ee80212969621228104995589c0fa59e575), [`5a4b1ee`](https://github.com/mastra-ai/mastra/commit/5a4b1ee80212969621228104995589c0fa59e575), [`6c8c6c7`](https://github.com/mastra-ai/mastra/commit/6c8c6c71518394321a4692614aa4b11f3bb0a343), [`5a4b1ee`](https://github.com/mastra-ai/mastra/commit/5a4b1ee80212969621228104995589c0fa59e575), [`7d056b6`](https://github.com/mastra-ai/mastra/commit/7d056b6ecf603cacaa0f663ff1df025ed885b6c1), [`9cef83b`](https://github.com/mastra-ai/mastra/commit/9cef83b8a642b8098747772921e3523b492bafbc), [`d30e215`](https://github.com/mastra-ai/mastra/commit/d30e2156c746bc9fd791745cec1cc24377b66789), [`021a60f`](https://github.com/mastra-ai/mastra/commit/021a60f1f3e0135a70ef23c58be7a9b3aaffe6b4), [`73f2809`](https://github.com/mastra-ai/mastra/commit/73f2809721db24e98cdf122539652a455211b450), [`aedeea4`](https://github.com/mastra-ai/mastra/commit/aedeea48a94f728323f040478775076b9574be50), [`26f1f94`](https://github.com/mastra-ai/mastra/commit/26f1f9490574b864ba1ecedf2c9632e0767a23bd), [`8126d86`](https://github.com/mastra-ai/mastra/commit/8126d8638411eacfafdc29036ac998e8757ea66f), [`73b45fa`](https://github.com/mastra-ai/mastra/commit/73b45facdef4fbcb8af710c50f0646f18619dbaa), [`ae97520`](https://github.com/mastra-ai/mastra/commit/ae975206fdb0f6ef03c4d5bf94f7dc7c3f706c02), [`7a7b313`](https://github.com/mastra-ai/mastra/commit/7a7b3138fb3bcf0b0c740eaea07971e43d330ef3), [`441670a`](https://github.com/mastra-ai/mastra/commit/441670a02c9dc7731c52674f55481e7848a84523)]:
  - @mastra/core@1.29.0

## 1.29.0-alpha.6

### Patch Changes

- Fixed Studio observability tabs so runtime-injected observability unlocks them. ([#15821](https://github.com/mastra-ai/mastra/pull/15821))

- Updated the A2A server to match the v0.3 protocol shapes and methods. ([#15720](https://github.com/mastra-ai/mastra/pull/15720))

- Updated dependencies [[`c1ae974`](https://github.com/mastra-ai/mastra/commit/c1ae97491f6e57378ce880c3a397778c42adcdf1), [`13b4d7c`](https://github.com/mastra-ai/mastra/commit/13b4d7c16de34dff9095d1cd80f22f544b6cfe75), [`5a4b1ee`](https://github.com/mastra-ai/mastra/commit/5a4b1ee80212969621228104995589c0fa59e575), [`5a4b1ee`](https://github.com/mastra-ai/mastra/commit/5a4b1ee80212969621228104995589c0fa59e575), [`5a4b1ee`](https://github.com/mastra-ai/mastra/commit/5a4b1ee80212969621228104995589c0fa59e575), [`6c8c6c7`](https://github.com/mastra-ai/mastra/commit/6c8c6c71518394321a4692614aa4b11f3bb0a343), [`5a4b1ee`](https://github.com/mastra-ai/mastra/commit/5a4b1ee80212969621228104995589c0fa59e575), [`ec4cb26`](https://github.com/mastra-ai/mastra/commit/ec4cb26919972eb2031fea510f8f013e1d5b7ee2)]:
  - @mastra/core@1.29.0-alpha.6

## 1.29.0-alpha.5

### Patch Changes

- Authentication now refreshes expired server-side sessions transparently, so recoverable token expiry no longer causes unexpected user sign-outs. Only truly expired sessions (e.g. refresh token dead) return a 401. ([#15819](https://github.com/mastra-ai/mastra/pull/15819))

  Server adapters now forward refreshed session cookies consistently, and auth-studio logs session validation and refresh failures to improve diagnostics.

- Updated dependencies [[`28caa5b`](https://github.com/mastra-ai/mastra/commit/28caa5b032358545af2589ed90636eccb4dd9d2f), [`7d056b6`](https://github.com/mastra-ai/mastra/commit/7d056b6ecf603cacaa0f663ff1df025ed885b6c1), [`26f1f94`](https://github.com/mastra-ai/mastra/commit/26f1f9490574b864ba1ecedf2c9632e0767a23bd)]:
  - @mastra/core@1.29.0-alpha.5

## 1.29.0-alpha.4

### Patch Changes

- Updated dependencies [[`8a71261`](https://github.com/mastra-ai/mastra/commit/8a71261e3954ae617c6f8e25767b951f99438ab2), [`021a60f`](https://github.com/mastra-ai/mastra/commit/021a60f1f3e0135a70ef23c58be7a9b3aaffe6b4)]:
  - @mastra/core@1.29.0-alpha.4

## 1.29.0-alpha.3

### Patch Changes

- Updated dependencies [[`c04417b`](https://github.com/mastra-ai/mastra/commit/c04417ba0a2e4ded66da4352331ef29cd4bd1d79), [`cf25a03`](https://github.com/mastra-ai/mastra/commit/cf25a03132164b9dc1e5dccf7394824e33007c51), [`ba6b0c5`](https://github.com/mastra-ai/mastra/commit/ba6b0c51bfce358554fd33c7f2bcd5593633f2ff)]:
  - @mastra/core@1.29.0-alpha.3

## 1.29.0-alpha.2

### Patch Changes

- Refactored Hono adapter's `registerCustomApiRoutes()` to use the shared `buildCustomRouteHandler()` from the base class instead of duplicating route/handler resolution logic. Added `forwardCustomRouteRequest()` to the base class for adapters that already have a raw `Request` object (avoiding unnecessary request reconstruction). ([#15793](https://github.com/mastra-ai/mastra/pull/15793))

- Custom API routes now validate that their paths don't collide with the built-in route prefix. If a custom route path starts with the server's `apiPrefix` (default `/api`), a descriptive error is thrown at startup. This prevents custom routes from shadowing built-in Mastra routes (e.g. `/api/agents`, `/api/tools`). ([#15743](https://github.com/mastra-ai/mastra/pull/15743))

- Add `POST /api/agents/:agentId/stream-until-idle` SSE route that mirrors `agent.streamUntilIdle()`. The route keeps the SSE stream open through background task completion and the agent's follow-up turn, so clients receive the final answer in a single request. ([#15686](https://github.com/mastra-ai/mastra/pull/15686))

- Updated dependencies [[`9e973b0`](https://github.com/mastra-ai/mastra/commit/9e973b010dacfa15ac82b0072897319f5234b90a), [`dd934a0`](https://github.com/mastra-ai/mastra/commit/dd934a0982ce0f78712fbd559e4f2410bf594b39), [`73f2809`](https://github.com/mastra-ai/mastra/commit/73f2809721db24e98cdf122539652a455211b450), [`aedeea4`](https://github.com/mastra-ai/mastra/commit/aedeea48a94f728323f040478775076b9574be50), [`8126d86`](https://github.com/mastra-ai/mastra/commit/8126d8638411eacfafdc29036ac998e8757ea66f), [`ae97520`](https://github.com/mastra-ai/mastra/commit/ae975206fdb0f6ef03c4d5bf94f7dc7c3f706c02), [`441670a`](https://github.com/mastra-ai/mastra/commit/441670a02c9dc7731c52674f55481e7848a84523)]:
  - @mastra/core@1.29.0-alpha.2

## 1.29.0-alpha.1

### Patch Changes

- Updated dependencies [[`7a7b313`](https://github.com/mastra-ai/mastra/commit/7a7b3138fb3bcf0b0c740eaea07971e43d330ef3), [`a6dac0a`](https://github.com/mastra-ai/mastra/commit/a6dac0a40c7181161b1add4e8534f962bcbc9aa7), [`9cef83b`](https://github.com/mastra-ai/mastra/commit/9cef83b8a642b8098747772921e3523b492bafbc), [`d30e215`](https://github.com/mastra-ai/mastra/commit/d30e2156c746bc9fd791745cec1cc24377b66789), [`73b45fa`](https://github.com/mastra-ai/mastra/commit/73b45facdef4fbcb8af710c50f0646f18619dbaa), [`7a7b313`](https://github.com/mastra-ai/mastra/commit/7a7b3138fb3bcf0b0c740eaea07971e43d330ef3)]:
  - @mastra/core@1.29.0-alpha.1

## 1.29.0-alpha.0

### Minor Changes

- Added support for resuming suspended agent streams over HTTP with custom data. This adds the `POST /agents/:agentId/resume-stream` server endpoint and the client SDK `agent.resumeStream()` method, so apps can continue a suspended agent run through the Mastra client. ([#14579](https://github.com/mastra-ai/mastra/pull/14579))

  **Usage example (client SDK):**

  ```typescript
  const agent = mastraClient.getAgent('my-agent');

  // Resume a suspended agent stream with custom data
  const response = await agent.resumeStream(
    { approved: true, selectedOption: 'plan-b' },
    { runId: 'previous-run-id', toolCallId: 'tool-123' },
  );

  await response.processDataStream({
    onChunk: chunk => console.log(chunk),
  });
  ```

### Patch Changes

- Updated dependencies [[`b510d36`](https://github.com/mastra-ai/mastra/commit/b510d368f73dab6be2e2c2bc99035aaef1fb7d7a)]:
  - @mastra/core@1.29.0-alpha.0

## 1.28.0

### Patch Changes

- Fixed non-Zod Standard Schema types (e.g. ArkType) being incorrectly called as lazy getters in resolveLazySchema, which caused Studio UI tool forms to receive validation errors instead of the actual JSON Schema ([#15670](https://github.com/mastra-ai/mastra/pull/15670))

- Fix: Public origin resolution for AWS ALB deployments ([#15666](https://github.com/mastra-ai/mastra/pull/15666))

  Implement cascading header resolution in getPublicOrigin() to properly handle:
  - X-Forwarded-Host (traditional reverse proxies) → always HTTPS
  - Host header (AWS ALB with Preserve Host Header) → respect X-Forwarded-Proto or default HTTPS
  - request.url (local development) → fallback

  Fixes OAuth callback URLs being resolved to http:// instead of https:// when deployed behind AWS ALB with Preserve Host Header enabled.

- Updated dependencies [[`733bf53`](https://github.com/mastra-ai/mastra/commit/733bf53d9352aedd3ef38c3d501edb275b65b43c), [`5405b3b`](https://github.com/mastra-ai/mastra/commit/5405b3b35325c5b8fb34fc7ac109bd2feb7bb6fe), [`45e29cb`](https://github.com/mastra-ai/mastra/commit/45e29cb5b5737f3083eb3852db02b944b9cf37ed), [`750b4d3`](https://github.com/mastra-ai/mastra/commit/750b4d3d8231f92e769b2c485921ac5a8ca639b9), [`c321127`](https://github.com/mastra-ai/mastra/commit/c3211275fc195de9ad1ead2746b354beb8eae6e8), [`a07bcef`](https://github.com/mastra-ai/mastra/commit/a07bcefea77c03d6d322caad973dca49b4b15fa1), [`696694e`](https://github.com/mastra-ai/mastra/commit/696694e00f29241a25dd1a1b749afa06c3a626b4), [`b084a80`](https://github.com/mastra-ai/mastra/commit/b084a800db0f82d62e1fc3d6e3e3480da1ba5a53), [`82b7a96`](https://github.com/mastra-ai/mastra/commit/82b7a964169636c1d1e0c694fc892a213b0179d5), [`df97812`](https://github.com/mastra-ai/mastra/commit/df97812bd949dcafeb074b80ecab501724b49c3b), [`8bbe360`](https://github.com/mastra-ai/mastra/commit/8bbe36042af7fc4be0244dffd8913f6795179421), [`f6b8ba8`](https://github.com/mastra-ai/mastra/commit/f6b8ba8dbf533b7a8db90c72b6805ddc804a3a72), [`a07bcef`](https://github.com/mastra-ai/mastra/commit/a07bcefea77c03d6d322caad973dca49b4b15fa1)]:
  - @mastra/core@1.28.0

## 1.28.0-alpha.2

### Patch Changes

- Updated dependencies [[`45e29cb`](https://github.com/mastra-ai/mastra/commit/45e29cb5b5737f3083eb3852db02b944b9cf37ed), [`696694e`](https://github.com/mastra-ai/mastra/commit/696694e00f29241a25dd1a1b749afa06c3a626b4)]:
  - @mastra/core@1.28.0-alpha.2

## 1.28.0-alpha.1

### Patch Changes

- Updated dependencies [[`750b4d3`](https://github.com/mastra-ai/mastra/commit/750b4d3d8231f92e769b2c485921ac5a8ca639b9)]:
  - @mastra/core@1.28.0-alpha.1

## 1.28.0-alpha.0

### Patch Changes

- Fixed non-Zod Standard Schema types (e.g. ArkType) being incorrectly called as lazy getters in resolveLazySchema, which caused Studio UI tool forms to receive validation errors instead of the actual JSON Schema ([#15670](https://github.com/mastra-ai/mastra/pull/15670))

- Fix: Public origin resolution for AWS ALB deployments ([#15666](https://github.com/mastra-ai/mastra/pull/15666))

  Implement cascading header resolution in getPublicOrigin() to properly handle:
  - X-Forwarded-Host (traditional reverse proxies) → always HTTPS
  - Host header (AWS ALB with Preserve Host Header) → respect X-Forwarded-Proto or default HTTPS
  - request.url (local development) → fallback

  Fixes OAuth callback URLs being resolved to http:// instead of https:// when deployed behind AWS ALB with Preserve Host Header enabled.

- Updated dependencies [[`733bf53`](https://github.com/mastra-ai/mastra/commit/733bf53d9352aedd3ef38c3d501edb275b65b43c), [`5405b3b`](https://github.com/mastra-ai/mastra/commit/5405b3b35325c5b8fb34fc7ac109bd2feb7bb6fe), [`c321127`](https://github.com/mastra-ai/mastra/commit/c3211275fc195de9ad1ead2746b354beb8eae6e8), [`a07bcef`](https://github.com/mastra-ai/mastra/commit/a07bcefea77c03d6d322caad973dca49b4b15fa1), [`b084a80`](https://github.com/mastra-ai/mastra/commit/b084a800db0f82d62e1fc3d6e3e3480da1ba5a53), [`82b7a96`](https://github.com/mastra-ai/mastra/commit/82b7a964169636c1d1e0c694fc892a213b0179d5), [`df97812`](https://github.com/mastra-ai/mastra/commit/df97812bd949dcafeb074b80ecab501724b49c3b), [`8bbe360`](https://github.com/mastra-ai/mastra/commit/8bbe36042af7fc4be0244dffd8913f6795179421), [`f6b8ba8`](https://github.com/mastra-ai/mastra/commit/f6b8ba8dbf533b7a8db90c72b6805ddc804a3a72), [`a07bcef`](https://github.com/mastra-ai/mastra/commit/a07bcefea77c03d6d322caad973dca49b4b15fa1)]:
  - @mastra/core@1.28.0-alpha.0

## 1.27.0

### Patch Changes

- Forward `requestContext` from the `/approve-tool-call`, `/decline-tool-call`, `/approve-tool-call-generate` and `/decline-tool-call-generate` REST handlers to `agent.approveToolCall(...)` / `declineToolCall(...)` / `approveToolCallGenerate(...)` / `declineToolCallGenerate(...)`. ([#15620](https://github.com/mastra-ai/mastra/pull/15620))

  Previously `requestContext` was destructured from the handler arguments but never passed through. On resume, `dynamicInstructions` ran with `requestContext: undefined`, so any value placed on the per-request `RequestContext` by upstream middleware (or by `body.requestContext` auto-merge) was lost for the rest of the turn. Agents whose prompt assembly depends on request-scoped data (e.g. read-only state from the frontend) produced blank or placeholder responses after the user approved a HITL tool call. Other agent entry points (`stream`, `generate`) already forwarded `requestContext` correctly; this brings the approval routes in line.

- Fixed screencast panel staying "Live" after browser closes due to an error. The `ViewerRegistry` now broadcasts `browser_closed` status when a screencast stream emits an error, not just when it stops cleanly. ([#15415](https://github.com/mastra-ai/mastra/pull/15415))

- Updated dependencies [[`f112db1`](https://github.com/mastra-ai/mastra/commit/f112db179557ae9b5a0f1d25dc47f928d7d61cd9), [`21d9706`](https://github.com/mastra-ai/mastra/commit/21d970604d89eee970cbf8013d26d7551aff6ea5), [`0a0aa94`](https://github.com/mastra-ai/mastra/commit/0a0aa94729592e99885af2efb90c56aaada62247), [`ed07df3`](https://github.com/mastra-ai/mastra/commit/ed07df32a9d539c8261e892fc1bade783f5b41a6), [`01a7d51`](https://github.com/mastra-ai/mastra/commit/01a7d513493d21562f677f98550f7ceb165ba78c)]:
  - @mastra/core@1.27.0

## 1.27.0-alpha.2

### Patch Changes

- Updated dependencies [[`ed07df3`](https://github.com/mastra-ai/mastra/commit/ed07df32a9d539c8261e892fc1bade783f5b41a6)]:
  - @mastra/core@1.27.0-alpha.2

## 1.27.0-alpha.1

### Patch Changes

- Forward `requestContext` from the `/approve-tool-call`, `/decline-tool-call`, `/approve-tool-call-generate` and `/decline-tool-call-generate` REST handlers to `agent.approveToolCall(...)` / `declineToolCall(...)` / `approveToolCallGenerate(...)` / `declineToolCallGenerate(...)`. ([#15620](https://github.com/mastra-ai/mastra/pull/15620))

  Previously `requestContext` was destructured from the handler arguments but never passed through. On resume, `dynamicInstructions` ran with `requestContext: undefined`, so any value placed on the per-request `RequestContext` by upstream middleware (or by `body.requestContext` auto-merge) was lost for the rest of the turn. Agents whose prompt assembly depends on request-scoped data (e.g. read-only state from the frontend) produced blank or placeholder responses after the user approved a HITL tool call. Other agent entry points (`stream`, `generate`) already forwarded `requestContext` correctly; this brings the approval routes in line.

- Fixed screencast panel staying "Live" after browser closes due to an error. The `ViewerRegistry` now broadcasts `browser_closed` status when a screencast stream emits an error, not just when it stops cleanly. ([#15415](https://github.com/mastra-ai/mastra/pull/15415))

- Updated dependencies [[`0a0aa94`](https://github.com/mastra-ai/mastra/commit/0a0aa94729592e99885af2efb90c56aaada62247), [`01a7d51`](https://github.com/mastra-ai/mastra/commit/01a7d513493d21562f677f98550f7ceb165ba78c)]:
  - @mastra/core@1.27.0-alpha.1

## 1.26.1-alpha.0

### Patch Changes

- Updated dependencies [[`f112db1`](https://github.com/mastra-ai/mastra/commit/f112db179557ae9b5a0f1d25dc47f928d7d61cd9), [`21d9706`](https://github.com/mastra-ai/mastra/commit/21d970604d89eee970cbf8013d26d7551aff6ea5)]:
  - @mastra/core@1.26.1-alpha.0

## 1.26.0

### Minor Changes

- You can now tag spans and redact sensitive input or output per request by passing `tags`, `hideInput`, or `hideOutput` in `tracingOptions` when calling an agent or workflow. ([#15512](https://github.com/mastra-ai/mastra/pull/15512))

  Added a lightweight trace endpoint (`GET /observability/traces/:traceId/light`) that returns only timeline-relevant span fields, dramatically reducing payload size when rendering trace timelines. Also added a dedicated span endpoint (`GET /observability/traces/:traceId/spans/:spanId`) to fetch full span details on demand.

- Added `forEachIndex` to the workflow resume request body schema. The `/workflows/:workflowId/resume`, `/resume-async`, and `/resume-stream` endpoints (including their agent-builder equivalents) now accept an optional zero-based `forEachIndex` so clients can target a specific iteration of a suspended `.foreach()` step. ([#15563](https://github.com/mastra-ai/mastra/pull/15563))

  ```ts
  // POST /workflows/:workflowId/resume
  // body
  {
    step: 'approve',
    resumeData: { ok: true },
    forEachIndex: 1, // resume only the second iteration; others stay suspended
  }
  ```

### Patch Changes

- Add `/api/background-tasks` routes (SSE stream, list with filters + pagination, get by ID) and matching `MastraClient` methods (`listBackgroundTasks`, `getBackgroundTask`, `streamBackgroundTasks`). ([#15307](https://github.com/mastra-ai/mastra/pull/15307))

- Added support for `versions` field in agent generate and stream request bodies, enabling per-request sub-agent version overrides that propagate through delegation. ([#15373](https://github.com/mastra-ai/mastra/pull/15373))

- Fix prototype pollution in `setNestedValue` (`@mastra/core/utils`) and `generateOpenAPIDocument` (`@mastra/server`). ([#15565](https://github.com/mastra-ai/mastra/pull/15565))

  `setNestedValue` now rejects dot-path segments named `__proto__`, `constructor`, or `prototype`, preventing attacker-controlled field paths passed to `selectFields` from polluting `Object.prototype`. `generateOpenAPIDocument` builds its `paths` map with `Object.create(null)` so a route path of `__proto__` cannot poison the prototype chain.

- Fixed noisy 'Background task manager not available' error log in studio when background tasks are not enabled. The list endpoint now returns an empty list, the get-by-id endpoint returns 404, and the SSE stream endpoint returns an empty stream that closes on disconnect — instead of throwing an HTTP 400 that gets logged as an error. ([#15600](https://github.com/mastra-ai/mastra/pull/15600))

- Added unique IDs (`logId`, `metricId`, `scoreId`, `feedbackId`) to all observability signals, generated automatically at emission time for de-duplication across the framework pipeline and cross-system correlation. User-facing APIs (`logger.info()`, `metrics.emit()`, `addScore()`, `addFeedback()`) are unchanged. ([#15242](https://github.com/mastra-ai/mastra/pull/15242))

  For existing ClickHouse and DuckDB observability signal tables, run `npx mastra migrate` before initializing the store so the new signal-ID schema is applied.

- Updated dependencies [[`20f59b8`](https://github.com/mastra-ai/mastra/commit/20f59b876cf91199efbc49a0e36b391240708f08), [`aba393e`](https://github.com/mastra-ai/mastra/commit/aba393e2da7390c69b80e516a4f153cda6f09376), [`3d83d06`](https://github.com/mastra-ai/mastra/commit/3d83d06f776f00fb5f4163dddd32a030c5c20844), [`e2687a7`](https://github.com/mastra-ai/mastra/commit/e2687a7408790c384563816a9a28ed06735684c9), [`fdd54cf`](https://github.com/mastra-ai/mastra/commit/fdd54cf612a9af876e9fdd85e534454f6e7dd518), [`6315317`](https://github.com/mastra-ai/mastra/commit/63153175fe9a7b224e5be7c209bbebc01dd9b0d5), [`a371ac5`](https://github.com/mastra-ai/mastra/commit/a371ac534aa1bb368a1acf9d8b313378dfdc787e), [`0474c2b`](https://github.com/mastra-ai/mastra/commit/0474c2b2e7c7e1ad8691dca031284841391ff1ef), [`0a5fa1d`](https://github.com/mastra-ai/mastra/commit/0a5fa1d3cb0583889d06687155f26fd7d2edc76c), [`7e0e63e`](https://github.com/mastra-ai/mastra/commit/7e0e63e2e485e84442351f4c7a79a424c83539dc), [`ea43e64`](https://github.com/mastra-ai/mastra/commit/ea43e646dd95d507694b6112b0bf1df22ad552b2), [`f607106`](https://github.com/mastra-ai/mastra/commit/f607106854c6416c4a07d4082604b9f66d047221), [`30456b6`](https://github.com/mastra-ai/mastra/commit/30456b6b08c8fd17e109dd093b73d93b65e83bc5), [`9d11a8c`](https://github.com/mastra-ai/mastra/commit/9d11a8c1c8924eb975a245a5884d40ca1b7e0491), [`9d3b24b`](https://github.com/mastra-ai/mastra/commit/9d3b24b19407ae9c09586cf7766d38dc4dff4a69), [`00d1b16`](https://github.com/mastra-ai/mastra/commit/00d1b16b401199cb294fa23f43336547db4dca9b), [`47cee3e`](https://github.com/mastra-ai/mastra/commit/47cee3e137fe39109cf7fffd2a8cf47b76dc702e), [`62919a6`](https://github.com/mastra-ai/mastra/commit/62919a6ee0fbf3779ad21a97b1ec6696515d5104), [`d246696`](https://github.com/mastra-ai/mastra/commit/d246696139a3144a5b21b042d41c532688e957e1), [`354f9ce`](https://github.com/mastra-ai/mastra/commit/354f9ce1ca6af2074b6a196a23f8ec30012dccca), [`16e34ca`](https://github.com/mastra-ai/mastra/commit/16e34caa98b9a114b17a6125e4e3fd87f169d0d0), [`7020c06`](https://github.com/mastra-ai/mastra/commit/7020c0690b199d9da337f0e805f16948e557922e), [`8786a61`](https://github.com/mastra-ai/mastra/commit/8786a61fa54ba265f85eeff9985ca39863d18bb6), [`9467ea8`](https://github.com/mastra-ai/mastra/commit/9467ea87695749a53dfc041576410ebf9ee7bb67), [`7338d94`](https://github.com/mastra-ai/mastra/commit/7338d949380cf68b095342e8e42610dc51d557c1), [`c80dc16`](https://github.com/mastra-ai/mastra/commit/c80dc16e113e6cc159f510ffde501ad4711b2189), [`af8a57e`](https://github.com/mastra-ai/mastra/commit/af8a57ed9ba9685ad8601d5b71ae3706da6222f9), [`d63ffdb`](https://github.com/mastra-ai/mastra/commit/d63ffdbb2c11e76fe5ea45faab44bc15460f010c), [`47cee3e`](https://github.com/mastra-ai/mastra/commit/47cee3e137fe39109cf7fffd2a8cf47b76dc702e), [`1bd5104`](https://github.com/mastra-ai/mastra/commit/1bd51048b6da93507276d6623e3fd96a9e1a8944), [`e9837b5`](https://github.com/mastra-ai/mastra/commit/e9837b53699e18711b09e0ca010a4106376f2653), [`8f1b280`](https://github.com/mastra-ai/mastra/commit/8f1b280b7fe6999ec654f160cb69c1a8719e7a57), [`92dcf02`](https://github.com/mastra-ai/mastra/commit/92dcf029294210ac91b090900c1a0555a425c57a), [`0fd90a2`](https://github.com/mastra-ai/mastra/commit/0fd90a215caf5fca8099c15a67ca03e4427747a3), [`8fb2405`](https://github.com/mastra-ai/mastra/commit/8fb2405138f2d208b7962ad03f121ca25bcc28c5), [`12df98c`](https://github.com/mastra-ai/mastra/commit/12df98c4904643d9481f5c78f3bed443725b4c96)]:
  - @mastra/core@1.26.0

## 1.26.0-alpha.13

### Patch Changes

- Fixed noisy 'Background task manager not available' error log in studio when background tasks are not enabled. The list endpoint now returns an empty list, the get-by-id endpoint returns 404, and the SSE stream endpoint returns an empty stream that closes on disconnect — instead of throwing an HTTP 400 that gets logged as an error. ([#15600](https://github.com/mastra-ai/mastra/pull/15600))

- Updated dependencies:
  - @mastra/core@1.26.0-alpha.13

## 1.26.0-alpha.12

### Patch Changes

- Updated dependencies [[`a371ac5`](https://github.com/mastra-ai/mastra/commit/a371ac534aa1bb368a1acf9d8b313378dfdc787e), [`47cee3e`](https://github.com/mastra-ai/mastra/commit/47cee3e137fe39109cf7fffd2a8cf47b76dc702e), [`c80dc16`](https://github.com/mastra-ai/mastra/commit/c80dc16e113e6cc159f510ffde501ad4711b2189), [`47cee3e`](https://github.com/mastra-ai/mastra/commit/47cee3e137fe39109cf7fffd2a8cf47b76dc702e)]:
  - @mastra/core@1.26.0-alpha.12

## 1.26.0-alpha.11

### Minor Changes

- You can now tag spans and redact sensitive input or output per request by passing `tags`, `hideInput`, or `hideOutput` in `tracingOptions` when calling an agent or workflow. ([#15512](https://github.com/mastra-ai/mastra/pull/15512))

  Added a lightweight trace endpoint (`GET /observability/traces/:traceId/light`) that returns only timeline-relevant span fields, dramatically reducing payload size when rendering trace timelines. Also added a dedicated span endpoint (`GET /observability/traces/:traceId/spans/:spanId`) to fetch full span details on demand.

### Patch Changes

- Added unique IDs (`logId`, `metricId`, `scoreId`, `feedbackId`) to all observability signals, generated automatically at emission time for de-duplication across the framework pipeline and cross-system correlation. User-facing APIs (`logger.info()`, `metrics.emit()`, `addScore()`, `addFeedback()`) are unchanged. ([#15242](https://github.com/mastra-ai/mastra/pull/15242))

  For existing ClickHouse and DuckDB observability signal tables, run `npx mastra migrate` before initializing the store so the new signal-ID schema is applied.

- Updated dependencies [[`20f59b8`](https://github.com/mastra-ai/mastra/commit/20f59b876cf91199efbc49a0e36b391240708f08), [`e2687a7`](https://github.com/mastra-ai/mastra/commit/e2687a7408790c384563816a9a28ed06735684c9), [`8f1b280`](https://github.com/mastra-ai/mastra/commit/8f1b280b7fe6999ec654f160cb69c1a8719e7a57), [`12df98c`](https://github.com/mastra-ai/mastra/commit/12df98c4904643d9481f5c78f3bed443725b4c96)]:
  - @mastra/core@1.26.0-alpha.11

## 1.26.0-alpha.10

### Minor Changes

- Added `forEachIndex` to the workflow resume request body schema. The `/workflows/:workflowId/resume`, `/resume-async`, and `/resume-stream` endpoints (including their agent-builder equivalents) now accept an optional zero-based `forEachIndex` so clients can target a specific iteration of a suspended `.foreach()` step. ([#15563](https://github.com/mastra-ai/mastra/pull/15563))

  ```ts
  // POST /workflows/:workflowId/resume
  // body
  {
    step: 'approve',
    resumeData: { ok: true },
    forEachIndex: 1, // resume only the second iteration; others stay suspended
  }
  ```

### Patch Changes

- Added support for `versions` field in agent generate and stream request bodies, enabling per-request sub-agent version overrides that propagate through delegation. ([#15373](https://github.com/mastra-ai/mastra/pull/15373))

- Fix prototype pollution in `setNestedValue` (`@mastra/core/utils`) and `generateOpenAPIDocument` (`@mastra/server`). ([#15565](https://github.com/mastra-ai/mastra/pull/15565))

  `setNestedValue` now rejects dot-path segments named `__proto__`, `constructor`, or `prototype`, preventing attacker-controlled field paths passed to `selectFields` from polluting `Object.prototype`. `generateOpenAPIDocument` builds its `paths` map with `Object.create(null)` so a route path of `__proto__` cannot poison the prototype chain.

- Updated dependencies [[`aba393e`](https://github.com/mastra-ai/mastra/commit/aba393e2da7390c69b80e516a4f153cda6f09376), [`0a5fa1d`](https://github.com/mastra-ai/mastra/commit/0a5fa1d3cb0583889d06687155f26fd7d2edc76c), [`ea43e64`](https://github.com/mastra-ai/mastra/commit/ea43e646dd95d507694b6112b0bf1df22ad552b2), [`00d1b16`](https://github.com/mastra-ai/mastra/commit/00d1b16b401199cb294fa23f43336547db4dca9b), [`af8a57e`](https://github.com/mastra-ai/mastra/commit/af8a57ed9ba9685ad8601d5b71ae3706da6222f9)]:
  - @mastra/core@1.26.0-alpha.10

## 1.26.0-alpha.9

### Patch Changes

- Updated dependencies [[`16e34ca`](https://github.com/mastra-ai/mastra/commit/16e34caa98b9a114b17a6125e4e3fd87f169d0d0)]:
  - @mastra/core@1.26.0-alpha.9

## 1.26.0-alpha.8

### Patch Changes

- Updated dependencies [[`1bd5104`](https://github.com/mastra-ai/mastra/commit/1bd51048b6da93507276d6623e3fd96a9e1a8944)]:
  - @mastra/core@1.26.0-alpha.8

## 1.26.0-alpha.7

### Patch Changes

- Updated dependencies [[`8786a61`](https://github.com/mastra-ai/mastra/commit/8786a61fa54ba265f85eeff9985ca39863d18bb6), [`8fb2405`](https://github.com/mastra-ai/mastra/commit/8fb2405138f2d208b7962ad03f121ca25bcc28c5)]:
  - @mastra/core@1.26.0-alpha.7

## 1.26.0-alpha.6

### Patch Changes

- Updated dependencies [[`6315317`](https://github.com/mastra-ai/mastra/commit/63153175fe9a7b224e5be7c209bbebc01dd9b0d5), [`9d3b24b`](https://github.com/mastra-ai/mastra/commit/9d3b24b19407ae9c09586cf7766d38dc4dff4a69)]:
  - @mastra/core@1.26.0-alpha.6

## 1.26.0-alpha.5

### Patch Changes

- Updated dependencies [[`92dcf02`](https://github.com/mastra-ai/mastra/commit/92dcf029294210ac91b090900c1a0555a425c57a)]:
  - @mastra/core@1.26.0-alpha.5

## 1.26.0-alpha.4

### Patch Changes

- Updated dependencies [[`0474c2b`](https://github.com/mastra-ai/mastra/commit/0474c2b2e7c7e1ad8691dca031284841391ff1ef), [`f607106`](https://github.com/mastra-ai/mastra/commit/f607106854c6416c4a07d4082604b9f66d047221), [`62919a6`](https://github.com/mastra-ai/mastra/commit/62919a6ee0fbf3779ad21a97b1ec6696515d5104), [`0fd90a2`](https://github.com/mastra-ai/mastra/commit/0fd90a215caf5fca8099c15a67ca03e4427747a3)]:
  - @mastra/core@1.26.0-alpha.4

## 1.26.0-alpha.3

### Patch Changes

- Updated dependencies [[`fdd54cf`](https://github.com/mastra-ai/mastra/commit/fdd54cf612a9af876e9fdd85e534454f6e7dd518), [`30456b6`](https://github.com/mastra-ai/mastra/commit/30456b6b08c8fd17e109dd093b73d93b65e83bc5), [`9d11a8c`](https://github.com/mastra-ai/mastra/commit/9d11a8c1c8924eb975a245a5884d40ca1b7e0491), [`d246696`](https://github.com/mastra-ai/mastra/commit/d246696139a3144a5b21b042d41c532688e957e1), [`354f9ce`](https://github.com/mastra-ai/mastra/commit/354f9ce1ca6af2074b6a196a23f8ec30012dccca), [`e9837b5`](https://github.com/mastra-ai/mastra/commit/e9837b53699e18711b09e0ca010a4106376f2653)]:
  - @mastra/core@1.26.0-alpha.3

## 1.26.0-alpha.2

### Patch Changes

- Updated dependencies [[`3d83d06`](https://github.com/mastra-ai/mastra/commit/3d83d06f776f00fb5f4163dddd32a030c5c20844), [`7e0e63e`](https://github.com/mastra-ai/mastra/commit/7e0e63e2e485e84442351f4c7a79a424c83539dc), [`9467ea8`](https://github.com/mastra-ai/mastra/commit/9467ea87695749a53dfc041576410ebf9ee7bb67), [`7338d94`](https://github.com/mastra-ai/mastra/commit/7338d949380cf68b095342e8e42610dc51d557c1)]:
  - @mastra/core@1.26.0-alpha.2

## 1.25.1-alpha.1

### Patch Changes

- Updated dependencies [[`7020c06`](https://github.com/mastra-ai/mastra/commit/7020c0690b199d9da337f0e805f16948e557922e)]:
  - @mastra/core@1.25.1-alpha.1

## 1.25.1-alpha.0

### Patch Changes

- Add `/api/background-tasks` routes (SSE stream, list with filters + pagination, get by ID) and matching `MastraClient` methods (`listBackgroundTasks`, `getBackgroundTask`, `streamBackgroundTasks`). ([#15307](https://github.com/mastra-ai/mastra/pull/15307))

- Updated dependencies [[`d63ffdb`](https://github.com/mastra-ai/mastra/commit/d63ffdbb2c11e76fe5ea45faab44bc15460f010c)]:
  - @mastra/core@1.25.1-alpha.0

## 1.25.0

### Minor Changes

- feat(server): Add `mapUserToResourceId` callback to auth config for automatic resource ID scoping ([#13954](https://github.com/mastra-ai/mastra/pull/13954))

  Auth configs now accept a `mapUserToResourceId` callback that maps the authenticated user to a resource ID after successful authentication. This enables per-user memory and thread isolation without requiring custom middleware or adapter subclassing.

  ```typescript
  const mastra = new Mastra({
    server: {
      auth: {
        authenticateToken: async token => verifyToken(token),
        mapUserToResourceId: user => user.id,
      },
    },
  });
  ```

  The callback is called in `coreAuthMiddleware` after the user is authenticated and set on the request context. The returned value is set as `MASTRA_RESOURCE_ID_KEY`, which takes precedence over client-provided values for security. Works across all server adapters (Hono, Express, Next.js, etc.).

### Patch Changes

- fix(server): Strip reserved context keys from client-provided requestContext ([#13954](https://github.com/mastra-ai/mastra/pull/13954))

  Clients could inject `mastra__resourceId` or `mastra__threadId` via the request body or query params to impersonate other users' memory/thread access. Reserved keys are now filtered out during request context creation in `mergeRequestContext`, so only server-side code (auth callbacks, middleware) can set them.

- Updated dependencies [[`87df955`](https://github.com/mastra-ai/mastra/commit/87df955c028660c075873fd5d74af28233ce32eb), [`8fad147`](https://github.com/mastra-ai/mastra/commit/8fad14759804179c8e080ce4d9dec6ef1a808b31), [`582644c`](https://github.com/mastra-ai/mastra/commit/582644c4a87f83b4f245a84d72b9e8590585012e), [`cbdf3e1`](https://github.com/mastra-ai/mastra/commit/cbdf3e12b3d0c30a6e5347be658e2009648c130a), [`8fe46d3`](https://github.com/mastra-ai/mastra/commit/8fe46d354027f3f0f0846e64219772348de106dd), [`18c67db`](https://github.com/mastra-ai/mastra/commit/18c67dbb9c9ebc26f26f65f7d3ff836e5691ef46), [`4ba3bb1`](https://github.com/mastra-ai/mastra/commit/4ba3bb1e465ad2ddaba3bbf2bc47e0faec32985e), [`5d84914`](https://github.com/mastra-ai/mastra/commit/5d84914e0e520c642a40329b210b413fcd139898), [`8dcc77e`](https://github.com/mastra-ai/mastra/commit/8dcc77e78a5340f5848f74b9e9f1b3da3513c1f5), [`aa67fc5`](https://github.com/mastra-ai/mastra/commit/aa67fc59ee8a5eeff1f23eb05970b8d7a536c8ff), [`fd2f314`](https://github.com/mastra-ai/mastra/commit/fd2f31473d3449b6b97e837ef8641264377f41a7), [`fa8140b`](https://github.com/mastra-ai/mastra/commit/fa8140bcd4251d2e3ac85fdc5547dfc4f372b5be), [`190f452`](https://github.com/mastra-ai/mastra/commit/190f45258b0640e2adfc8219fa3258cdc5b8f071), [`e80fead`](https://github.com/mastra-ai/mastra/commit/e80fead1412cc0d1b2f7d6a1ce5017d9e0098ff7), [`0287b64`](https://github.com/mastra-ai/mastra/commit/0287b644a5c3272755cf3112e71338106664103b), [`7e7bf60`](https://github.com/mastra-ai/mastra/commit/7e7bf606886bf374a6f9d4ca9b09dd83d0533372), [`184907d`](https://github.com/mastra-ai/mastra/commit/184907d775d8609c03c26e78ccaf37315f3aa287), [`075e91a`](https://github.com/mastra-ai/mastra/commit/075e91a4549baf46ad7a42a6a8ac8dfa78cc09e6), [`0c4cd13`](https://github.com/mastra-ai/mastra/commit/0c4cd131931c04ac5405373c932a242dbe88edd6), [`b16a753`](https://github.com/mastra-ai/mastra/commit/b16a753d5748440248d7df82e29bb987a9c8386c)]:
  - @mastra/core@1.25.0

## 1.25.0-alpha.3

### Patch Changes

- Updated dependencies [[`cbdf3e1`](https://github.com/mastra-ai/mastra/commit/cbdf3e12b3d0c30a6e5347be658e2009648c130a), [`8fe46d3`](https://github.com/mastra-ai/mastra/commit/8fe46d354027f3f0f0846e64219772348de106dd), [`18c67db`](https://github.com/mastra-ai/mastra/commit/18c67dbb9c9ebc26f26f65f7d3ff836e5691ef46), [`8dcc77e`](https://github.com/mastra-ai/mastra/commit/8dcc77e78a5340f5848f74b9e9f1b3da3513c1f5), [`aa67fc5`](https://github.com/mastra-ai/mastra/commit/aa67fc59ee8a5eeff1f23eb05970b8d7a536c8ff), [`fa8140b`](https://github.com/mastra-ai/mastra/commit/fa8140bcd4251d2e3ac85fdc5547dfc4f372b5be), [`190f452`](https://github.com/mastra-ai/mastra/commit/190f45258b0640e2adfc8219fa3258cdc5b8f071), [`7e7bf60`](https://github.com/mastra-ai/mastra/commit/7e7bf606886bf374a6f9d4ca9b09dd83d0533372), [`184907d`](https://github.com/mastra-ai/mastra/commit/184907d775d8609c03c26e78ccaf37315f3aa287), [`0c4cd13`](https://github.com/mastra-ai/mastra/commit/0c4cd131931c04ac5405373c932a242dbe88edd6), [`b16a753`](https://github.com/mastra-ai/mastra/commit/b16a753d5748440248d7df82e29bb987a9c8386c)]:
  - @mastra/core@1.25.0-alpha.3

## 1.25.0-alpha.2

### Patch Changes

- Updated dependencies [[`4ba3bb1`](https://github.com/mastra-ai/mastra/commit/4ba3bb1e465ad2ddaba3bbf2bc47e0faec32985e)]:
  - @mastra/core@1.25.0-alpha.2

## 1.25.0-alpha.1

### Minor Changes

- feat(server): Add `mapUserToResourceId` callback to auth config for automatic resource ID scoping ([#13954](https://github.com/mastra-ai/mastra/pull/13954))

  Auth configs now accept a `mapUserToResourceId` callback that maps the authenticated user to a resource ID after successful authentication. This enables per-user memory and thread isolation without requiring custom middleware or adapter subclassing.

  ```typescript
  const mastra = new Mastra({
    server: {
      auth: {
        authenticateToken: async token => verifyToken(token),
        mapUserToResourceId: user => user.id,
      },
    },
  });
  ```

  The callback is called in `coreAuthMiddleware` after the user is authenticated and set on the request context. The returned value is set as `MASTRA_RESOURCE_ID_KEY`, which takes precedence over client-provided values for security. Works across all server adapters (Hono, Express, Next.js, etc.).

### Patch Changes

- fix(server): Strip reserved context keys from client-provided requestContext ([#13954](https://github.com/mastra-ai/mastra/pull/13954))

  Clients could inject `mastra__resourceId` or `mastra__threadId` via the request body or query params to impersonate other users' memory/thread access. Reserved keys are now filtered out during request context creation in `mergeRequestContext`, so only server-side code (auth callbacks, middleware) can set them.

- Updated dependencies [[`8fad147`](https://github.com/mastra-ai/mastra/commit/8fad14759804179c8e080ce4d9dec6ef1a808b31), [`582644c`](https://github.com/mastra-ai/mastra/commit/582644c4a87f83b4f245a84d72b9e8590585012e), [`5d84914`](https://github.com/mastra-ai/mastra/commit/5d84914e0e520c642a40329b210b413fcd139898), [`fd2f314`](https://github.com/mastra-ai/mastra/commit/fd2f31473d3449b6b97e837ef8641264377f41a7), [`e80fead`](https://github.com/mastra-ai/mastra/commit/e80fead1412cc0d1b2f7d6a1ce5017d9e0098ff7), [`0287b64`](https://github.com/mastra-ai/mastra/commit/0287b644a5c3272755cf3112e71338106664103b)]:
  - @mastra/core@1.25.0-alpha.1

## 1.24.2-alpha.0

### Patch Changes

- Updated dependencies [[`87df955`](https://github.com/mastra-ai/mastra/commit/87df955c028660c075873fd5d74af28233ce32eb), [`075e91a`](https://github.com/mastra-ai/mastra/commit/075e91a4549baf46ad7a42a6a8ac8dfa78cc09e6)]:
  - @mastra/core@1.24.2-alpha.0

## 1.24.1

### Patch Changes

- Updated dependencies [[`ef94400`](https://github.com/mastra-ai/mastra/commit/ef9440049402596b31f2ab976c5e4508f6cb6c91), [`3db852b`](https://github.com/mastra-ai/mastra/commit/3db852bff74e29f60d415a7b0f1583d6ce2bad92)]:
  - @mastra/core@1.24.1

## 1.24.1-alpha.1

### Patch Changes

- Updated dependencies [[`3db852b`](https://github.com/mastra-ai/mastra/commit/3db852bff74e29f60d415a7b0f1583d6ce2bad92)]:
  - @mastra/core@1.24.1-alpha.1

## 1.24.1-alpha.0

### Patch Changes

- Updated dependencies [[`ef94400`](https://github.com/mastra-ai/mastra/commit/ef9440049402596b31f2ab976c5e4508f6cb6c91)]:
  - @mastra/core@1.24.1-alpha.0

## 1.24.0

### Patch Changes

- **Fixed publishing older agent versions** ([#15154](https://github.com/mastra-ai/mastra/pull/15154))

  Fixed agent editor to allow publishing older read-only versions. Previously, the Publish button was disabled when viewing a previous version. Now a "Publish This Version" button appears, enabling users to set any older version as the published version.

  **Fixed Publish button being clickable without a saved draft**

  The Publish button is now disabled until a draft version is saved. Previously, making edits would enable the Publish button even without a saved draft, which caused an error when clicked.

  **Eliminated spurious 404 error logs for code-only agents**

  The agent versions endpoint now checks both code-registered and stored agents before returning 404, and the frontend conditionally fetches stored agent details only when versions exist. This prevents noisy error logs when navigating to the editor for agents that haven't been published yet.

  **Changed editor sections to be collapsed by default**

  The System Prompt, Tools, and Variables sections in the agent editor are now collapsed by default when navigating to the editor page.

- Fixed the Responses API to use the agent default model when create requests omit model. ([#15140](https://github.com/mastra-ai/mastra/pull/15140))

- Updated dependencies [[`8db7663`](https://github.com/mastra-ai/mastra/commit/8db7663c9a9c735828094c359d2e327fd4f8fba3), [`153e864`](https://github.com/mastra-ai/mastra/commit/153e86476b425db7cd0dc8490050096e92964a38), [`715710d`](https://github.com/mastra-ai/mastra/commit/715710d12fa47cf88e09d41f13843eddc29327b0), [`378c6c4`](https://github.com/mastra-ai/mastra/commit/378c6c4755726e8d8cf83a14809b350b90d46c62), [`9f91fd5`](https://github.com/mastra-ai/mastra/commit/9f91fd538ab2a44f8cc740bcad8e51205f74fbea), [`ba6fa9c`](https://github.com/mastra-ai/mastra/commit/ba6fa9cc0f3e1912c49fd70d4c3bb8c44903ddaa)]:
  - @mastra/core@1.24.0

## 1.24.0-alpha.1

### Patch Changes

- **Fixed publishing older agent versions** ([#15154](https://github.com/mastra-ai/mastra/pull/15154))

  Fixed agent editor to allow publishing older read-only versions. Previously, the Publish button was disabled when viewing a previous version. Now a "Publish This Version" button appears, enabling users to set any older version as the published version.

  **Fixed Publish button being clickable without a saved draft**

  The Publish button is now disabled until a draft version is saved. Previously, making edits would enable the Publish button even without a saved draft, which caused an error when clicked.

  **Eliminated spurious 404 error logs for code-only agents**

  The agent versions endpoint now checks both code-registered and stored agents before returning 404, and the frontend conditionally fetches stored agent details only when versions exist. This prevents noisy error logs when navigating to the editor for agents that haven't been published yet.

  **Changed editor sections to be collapsed by default**

  The System Prompt, Tools, and Variables sections in the agent editor are now collapsed by default when navigating to the editor page.

- Updated dependencies [[`8db7663`](https://github.com/mastra-ai/mastra/commit/8db7663c9a9c735828094c359d2e327fd4f8fba3), [`715710d`](https://github.com/mastra-ai/mastra/commit/715710d12fa47cf88e09d41f13843eddc29327b0), [`378c6c4`](https://github.com/mastra-ai/mastra/commit/378c6c4755726e8d8cf83a14809b350b90d46c62), [`9f91fd5`](https://github.com/mastra-ai/mastra/commit/9f91fd538ab2a44f8cc740bcad8e51205f74fbea), [`ba6fa9c`](https://github.com/mastra-ai/mastra/commit/ba6fa9cc0f3e1912c49fd70d4c3bb8c44903ddaa)]:
  - @mastra/core@1.24.0-alpha.1

## 1.23.1-alpha.0

### Patch Changes

- Fixed the Responses API to use the agent default model when create requests omit model. ([#15140](https://github.com/mastra-ai/mastra/pull/15140))

- Updated dependencies [[`153e864`](https://github.com/mastra-ai/mastra/commit/153e86476b425db7cd0dc8490050096e92964a38)]:
  - @mastra/core@1.23.1-alpha.0

## 1.23.0

### Patch Changes

- Fixed duplicate provider entries when fetching providers from gateways by applying consistent ID prefixing ([#15098](https://github.com/mastra-ai/mastra/pull/15098))

- Aligned workspace tool config types with core's dynamic function support. Dynamic config functions (enabled, requireApproval, requireReadBeforeWrite) are now resolved by calling them with workspace and requestContext, matching core's behavior. ([#14528](https://github.com/mastra-ai/mastra/pull/14528))

- Add session refresh endpoint. Expired sessions can now be refreshed automatically, keeping users signed in longer. ([#15024](https://github.com/mastra-ai/mastra/pull/15024))

- Fixed gateway memory client failing with 404 when MASTRA_GATEWAY_URL includes a /v1 suffix (e.g. https://gateway-api.mastra.ai/v1). The URL is now normalized before appending the memory base path, matching how the model router handles the same variable. ([#15054](https://github.com/mastra-ai/mastra/pull/15054))

- Updated dependencies [[`f32b9e1`](https://github.com/mastra-ai/mastra/commit/f32b9e115a3c754d1c8cfa3f4256fba87b09cfb7), [`7d6f521`](https://github.com/mastra-ai/mastra/commit/7d6f52164d0cca099f0b07cb2bba334360f1c8ab), [`a50d220`](https://github.com/mastra-ai/mastra/commit/a50d220b01ecbc5644d489a3d446c3bd4ab30245), [`665477b`](https://github.com/mastra-ai/mastra/commit/665477bc104fd52cfef8e7610d7664781a70c220), [`4cc2755`](https://github.com/mastra-ai/mastra/commit/4cc2755a7194cb08720ff2ab4dffb4b4a5103dfd), [`ac7baf6`](https://github.com/mastra-ai/mastra/commit/ac7baf66ef1db15e03975ef4ebb02724f015a391), [`ed425d7`](https://github.com/mastra-ai/mastra/commit/ed425d78e7c66cbda8209fee910856f98c6c6b82), [`1371703`](https://github.com/mastra-ai/mastra/commit/1371703835080450ef3f9aea58059a95d0da2e5a), [`0df8321`](https://github.com/mastra-ai/mastra/commit/0df832196eeb2450ab77ce887e8553abdd44c5a6), [`98f8a8b`](https://github.com/mastra-ai/mastra/commit/98f8a8bdf5761b9982f3ad3acbe7f1cc3efa71f3), [`ba6f7e9`](https://github.com/mastra-ai/mastra/commit/ba6f7e9086d8281393f2acae60fda61de3bff1f9), [`7eb2596`](https://github.com/mastra-ai/mastra/commit/7eb25960d607e07468c9a10c5437abd2deaf1e9a), [`1805ddc`](https://github.com/mastra-ai/mastra/commit/1805ddc9c9b3b14b63749735a13c05a45af43a80), [`fff91cf`](https://github.com/mastra-ai/mastra/commit/fff91cf914de0e731578aacebffdeebef82f0440), [`61109b3`](https://github.com/mastra-ai/mastra/commit/61109b34feb0e38d54bee4b8ca83eb7345b1d557), [`33f1ead`](https://github.com/mastra-ai/mastra/commit/33f1eadfa19c86953f593478e5fa371093b33779)]:
  - @mastra/core@1.23.0

## 1.23.0-alpha.9

### Patch Changes

- Updated dependencies [[`a50d220`](https://github.com/mastra-ai/mastra/commit/a50d220b01ecbc5644d489a3d446c3bd4ab30245)]:
  - @mastra/core@1.23.0-alpha.9

## 1.23.0-alpha.8

### Patch Changes

- Fixed duplicate provider entries when fetching providers from gateways by applying consistent ID prefixing ([#15098](https://github.com/mastra-ai/mastra/pull/15098))

- Updated dependencies [[`ac7baf6`](https://github.com/mastra-ai/mastra/commit/ac7baf66ef1db15e03975ef4ebb02724f015a391), [`0df8321`](https://github.com/mastra-ai/mastra/commit/0df832196eeb2450ab77ce887e8553abdd44c5a6), [`61109b3`](https://github.com/mastra-ai/mastra/commit/61109b34feb0e38d54bee4b8ca83eb7345b1d557), [`33f1ead`](https://github.com/mastra-ai/mastra/commit/33f1eadfa19c86953f593478e5fa371093b33779)]:
  - @mastra/core@1.23.0-alpha.8

## 1.23.0-alpha.7

### Patch Changes

- Updated dependencies [[`665477b`](https://github.com/mastra-ai/mastra/commit/665477bc104fd52cfef8e7610d7664781a70c220), [`4cc2755`](https://github.com/mastra-ai/mastra/commit/4cc2755a7194cb08720ff2ab4dffb4b4a5103dfd)]:
  - @mastra/core@1.23.0-alpha.7

## 1.23.0-alpha.6

### Patch Changes

- Updated dependencies [[`7d6f521`](https://github.com/mastra-ai/mastra/commit/7d6f52164d0cca099f0b07cb2bba334360f1c8ab)]:
  - @mastra/core@1.23.0-alpha.6

## 1.23.0-alpha.5

### Patch Changes

- Updated dependencies [[`1371703`](https://github.com/mastra-ai/mastra/commit/1371703835080450ef3f9aea58059a95d0da2e5a), [`98f8a8b`](https://github.com/mastra-ai/mastra/commit/98f8a8bdf5761b9982f3ad3acbe7f1cc3efa71f3)]:
  - @mastra/core@1.23.0-alpha.5

## 1.23.0-alpha.4

### Patch Changes

- Updated dependencies [[`fff91cf`](https://github.com/mastra-ai/mastra/commit/fff91cf914de0e731578aacebffdeebef82f0440)]:
  - @mastra/core@1.23.0-alpha.4

## 1.23.0-alpha.3

### Patch Changes

- Updated dependencies [[`1805ddc`](https://github.com/mastra-ai/mastra/commit/1805ddc9c9b3b14b63749735a13c05a45af43a80)]:
  - @mastra/core@1.23.0-alpha.3

## 1.23.0-alpha.2

### Patch Changes

- Fixed gateway memory client failing with 404 when MASTRA_GATEWAY_URL includes a /v1 suffix (e.g. https://gateway-api.mastra.ai/v1). The URL is now normalized before appending the memory base path, matching how the model router handles the same variable. ([#15054](https://github.com/mastra-ai/mastra/pull/15054))

- Updated dependencies:
  - @mastra/core@1.23.0-alpha.2

## 1.23.0-alpha.1

### Patch Changes

- Updated dependencies [[`f32b9e1`](https://github.com/mastra-ai/mastra/commit/f32b9e115a3c754d1c8cfa3f4256fba87b09cfb7)]:
  - @mastra/core@1.23.0-alpha.1

## 1.23.0-alpha.0

### Patch Changes

- Aligned workspace tool config types with core's dynamic function support. Dynamic config functions (enabled, requireApproval, requireReadBeforeWrite) are now resolved by calling them with workspace and requestContext, matching core's behavior. ([#14528](https://github.com/mastra-ai/mastra/pull/14528))

- Add session refresh endpoint. Expired sessions can now be refreshed automatically, keeping users signed in longer. ([#15024](https://github.com/mastra-ai/mastra/pull/15024))

- Updated dependencies [[`ed425d7`](https://github.com/mastra-ai/mastra/commit/ed425d78e7c66cbda8209fee910856f98c6c6b82), [`ba6f7e9`](https://github.com/mastra-ai/mastra/commit/ba6f7e9086d8281393f2acae60fda61de3bff1f9), [`7eb2596`](https://github.com/mastra-ai/mastra/commit/7eb25960d607e07468c9a10c5437abd2deaf1e9a)]:
  - @mastra/core@1.23.0-alpha.0

## 1.22.0

### Minor Changes

- Add browser streaming endpoints and WebSocket handlers ([#14938](https://github.com/mastra-ai/mastra/pull/14938))
  - New `/api/agents/:agentId/browser/stream` WebSocket endpoint for screencast streaming
  - New `/api/agents/:agentId/browser/close` endpoint for closing browser sessions
  - Input handler for mouse and keyboard event injection
  - Viewer registry for managing screencast connections per agent/thread

- Added Memory Gateway proxying for agents using Mastra Gateway models. ([#14952](https://github.com/mastra-ai/mastra/pull/14952))

  When an agent uses a `mastra/` model string, memory operations (threads, messages, observational memory) are automatically proxied to the remote Mastra Gateway instead of local storage.

  **New endpoints:**
  - **GET /memory/observational-memory** — retrieves the current observational memory record and optional generation history for an agent
  - **POST /memory/observational-memory/buffer-status** — waits for in-flight buffering operations to complete (30s timeout) and returns the updated record

  **New internal module:**
  - `GatewayMemoryClient` — HTTP client that proxies memory operations to the Mastra Gateway REST API, with automatic format conversion between gateway and local response types

- Added expectedTrajectory support to dataset items across all storage backends and API layer. Dataset items can now store trajectory expectations that define expected agent execution steps, ordering, and constraints for trajectory-based evaluation scoring. ([#14902](https://github.com/mastra-ai/mastra/pull/14902))

### Patch Changes

- Added browser tools to the Agent details UI in Playground. Agents configured with browser support now show a "Browser Tools" section in metadata. ([#14998](https://github.com/mastra-ai/mastra/pull/14998))

- Fixed Responses and Conversations to resolve stored data through the selected agent's memory store instead of assuming Mastra root memory storage. ([#14977](https://github.com/mastra-ai/mastra/pull/14977))

  Responses and conversation retrieval, deletion, and continuation now follow the agent's configured memory storage, while still using Mastra root storage when that agent memory inherits it.

- Fixed memory endpoints (list threads, get thread, list messages, delete messages, memory status) returning 404 when agentId refers to a stored agent not resolvable via getAgentById(). Endpoints now fall back to storage-based access, matching the behavior when agentId is omitted. Fixes #14765. ([#14784](https://github.com/mastra-ai/mastra/pull/14784))

- Fixed dataset schema to accept null values for trajectory expectations, matching what the database stores and what the UI sends ([#15028](https://github.com/mastra-ai/mastra/pull/15028))

- Updated dependencies [[`cb15509`](https://github.com/mastra-ai/mastra/commit/cb15509b58f6a83e11b765c945082afc027db972), [`81e4259`](https://github.com/mastra-ai/mastra/commit/81e425939b4ceeb4f586e9b6d89c3b1c1f2d2fe7), [`951b8a1`](https://github.com/mastra-ai/mastra/commit/951b8a1b5ef7e1474c59dc4f2b9fc1a8b1e508b6), [`80c5668`](https://github.com/mastra-ai/mastra/commit/80c5668e365470d3a96d3e953868fd7a643ff67c), [`3d478c1`](https://github.com/mastra-ai/mastra/commit/3d478c1e13f17b80f330ac49d7aa42ef929b93ff), [`2b4ea10`](https://github.com/mastra-ai/mastra/commit/2b4ea10b053e4ea1ab232d536933a4a3c4cba999), [`a0544f0`](https://github.com/mastra-ai/mastra/commit/a0544f0a1e6bd52ac12676228967c1938e43648d), [`6039f17`](https://github.com/mastra-ai/mastra/commit/6039f176f9c457304825ff1df8c83b8e457376c0), [`06b928d`](https://github.com/mastra-ai/mastra/commit/06b928dfc2f5630d023467476cc5919dfa858d0a), [`6a8d984`](https://github.com/mastra-ai/mastra/commit/6a8d9841f2933456ee1598099f488d742b600054), [`c8c86aa`](https://github.com/mastra-ai/mastra/commit/c8c86aa1458017fbd1c0776fdc0c520d129df8a6)]:
  - @mastra/core@1.22.0

## 1.22.0-alpha.3

### Patch Changes

- Added browser tools to the Agent details UI in Playground. Agents configured with browser support now show a "Browser Tools" section in metadata. ([#14998](https://github.com/mastra-ai/mastra/pull/14998))

- Updated dependencies:
  - @mastra/core@1.22.0-alpha.3

## 1.22.0-alpha.2

### Minor Changes

- Add browser streaming endpoints and WebSocket handlers ([#14938](https://github.com/mastra-ai/mastra/pull/14938))
  - New `/api/agents/:agentId/browser/stream` WebSocket endpoint for screencast streaming
  - New `/api/agents/:agentId/browser/close` endpoint for closing browser sessions
  - Input handler for mouse and keyboard event injection
  - Viewer registry for managing screencast connections per agent/thread

- Added expectedTrajectory support to dataset items across all storage backends and API layer. Dataset items can now store trajectory expectations that define expected agent execution steps, ordering, and constraints for trajectory-based evaluation scoring. ([#14902](https://github.com/mastra-ai/mastra/pull/14902))

### Patch Changes

- Fixed Responses and Conversations to resolve stored data through the selected agent's memory store instead of assuming Mastra root memory storage. ([#14977](https://github.com/mastra-ai/mastra/pull/14977))

  Responses and conversation retrieval, deletion, and continuation now follow the agent's configured memory storage, while still using Mastra root storage when that agent memory inherits it.

- Fixed memory endpoints (list threads, get thread, list messages, delete messages, memory status) returning 404 when agentId refers to a stored agent not resolvable via getAgentById(). Endpoints now fall back to storage-based access, matching the behavior when agentId is omitted. Fixes #14765. ([#14784](https://github.com/mastra-ai/mastra/pull/14784))

- Updated dependencies [[`cb15509`](https://github.com/mastra-ai/mastra/commit/cb15509b58f6a83e11b765c945082afc027db972), [`80c5668`](https://github.com/mastra-ai/mastra/commit/80c5668e365470d3a96d3e953868fd7a643ff67c), [`3d478c1`](https://github.com/mastra-ai/mastra/commit/3d478c1e13f17b80f330ac49d7aa42ef929b93ff), [`6039f17`](https://github.com/mastra-ai/mastra/commit/6039f176f9c457304825ff1df8c83b8e457376c0), [`06b928d`](https://github.com/mastra-ai/mastra/commit/06b928dfc2f5630d023467476cc5919dfa858d0a), [`6a8d984`](https://github.com/mastra-ai/mastra/commit/6a8d9841f2933456ee1598099f488d742b600054)]:
  - @mastra/core@1.22.0-alpha.2

## 1.22.0-alpha.1

### Patch Changes

- Updated dependencies [[`81e4259`](https://github.com/mastra-ai/mastra/commit/81e425939b4ceeb4f586e9b6d89c3b1c1f2d2fe7), [`951b8a1`](https://github.com/mastra-ai/mastra/commit/951b8a1b5ef7e1474c59dc4f2b9fc1a8b1e508b6)]:
  - @mastra/core@1.22.0-alpha.1

## 1.22.0-alpha.0

### Minor Changes

- Added Memory Gateway proxying for agents using Mastra Gateway models. ([#14952](https://github.com/mastra-ai/mastra/pull/14952))

  When an agent uses a `mastra/` model string, memory operations (threads, messages, observational memory) are automatically proxied to the remote Mastra Gateway instead of local storage.

  **New endpoints:**
  - **GET /memory/observational-memory** — retrieves the current observational memory record and optional generation history for an agent
  - **POST /memory/observational-memory/buffer-status** — waits for in-flight buffering operations to complete (30s timeout) and returns the updated record

  **New internal module:**
  - `GatewayMemoryClient` — HTTP client that proxies memory operations to the Mastra Gateway REST API, with automatic format conversion between gateway and local response types

### Patch Changes

- Updated dependencies [[`2b4ea10`](https://github.com/mastra-ai/mastra/commit/2b4ea10b053e4ea1ab232d536933a4a3c4cba999), [`a0544f0`](https://github.com/mastra-ai/mastra/commit/a0544f0a1e6bd52ac12676228967c1938e43648d), [`c8c86aa`](https://github.com/mastra-ai/mastra/commit/c8c86aa1458017fbd1c0776fdc0c520d129df8a6)]:
  - @mastra/core@1.22.0-alpha.0

## 1.21.0

### Minor Changes

- **Added Responses API support for local Mastra apps** ([#14339](https://github.com/mastra-ai/mastra/pull/14339))

  You can now call Mastra through a Responses API flow and continue stored turns with
  `previous_response_id`, while keeping `model` as a Mastra model string and using
  `agent_id` to target the registered Mastra agent that handles the request. This API acts as an agent-backed
  adapter layer on top of Mastra memory and storage. Advanced provider-native settings can
  also be passed through with `providerOptions`, and provider-returned continuation state
  is surfaced back on the response under the same `providerOptions` field. Stored
  response IDs now map directly to the persisted assistant turn ID in Mastra memory.
  Configured tool definitions are returned under `tools`, while executed tool activity
  is surfaced through `output` items such as `function_call`, `function_call_output`,
  and the final assistant message. Stored responses also return `conversation_id`, which
  maps directly to the underlying Mastra memory thread ID. You can create a conversation
  explicitly with `client.conversations.create()` or let the first stored response create
  it implicitly, inspect the stored item history with `client.conversations.items.list()`,
  retrieve the conversation with `client.conversations.retrieve()`, or remove it with
  `client.conversations.delete()`. Responses requests also support
  `text.format`, including `json_object` for JSON mode and `json_schema` for
  schema-constrained structured output, through the same agent-backed route.

  ```ts
  import { MastraClient } from '@mastra/client-js';

  const client = new MastraClient({
    baseUrl: 'http://localhost:4111',
  });

  const first = await client.responses.create({
    model: 'openai/gpt-5',
    agent_id: 'support-agent',
    input: 'Write a short bedtime story.',
    store: true,
  });

  const second = await client.responses.create({
    model: 'openai/gpt-5',
    agent_id: 'support-agent',
    input: 'Make it funnier.',
    store: true,
    previous_response_id: first.id,
  });

  const items = await client.conversations.items.list(first.conversation_id!);

  const jsonResponse = await client.responses.create({
    model: 'openai/gpt-5',
    agent_id: 'support-agent',
    input: 'Return a JSON object with a title and summary.',
    text: {
      format: {
        type: 'json_object',
      },
    },
  });

  const structuredResponse = await client.responses.create({
    model: 'openai/gpt-5',
    agent_id: 'support-agent',
    input: 'Return a structured support ticket summary.',
    text: {
      format: {
        type: 'json_schema',
        name: 'ticket_summary',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            priority: { type: 'string' },
          },
          required: ['summary', 'priority'],
          additionalProperties: false,
        },
      },
    },
  });
  ```

### Patch Changes

- Fixed OpenAI Responses API json_object mode so agent-backed responses return JSON output correctly. ([#14935](https://github.com/mastra-ai/mastra/pull/14935))

- Updated dependencies [[`9a43b47`](https://github.com/mastra-ai/mastra/commit/9a43b476465e86c9aca381c2831066b5c33c999a), [`ec5c319`](https://github.com/mastra-ai/mastra/commit/ec5c3197a50d034cb8e9cc494eebfddc684b5d81), [`6517789`](https://github.com/mastra-ai/mastra/commit/65177895b74b5471fe2245c7292f0176d9b3385d), [`13f4327`](https://github.com/mastra-ai/mastra/commit/13f4327f052faebe199cefbe906d33bf90238767), [`9ad6aa6`](https://github.com/mastra-ai/mastra/commit/9ad6aa6dfe858afc6955d1df5f3f78c40bb96b9c), [`2862127`](https://github.com/mastra-ai/mastra/commit/2862127d0a7cbd28523120ad64fea067a95838e6), [`3d16814`](https://github.com/mastra-ai/mastra/commit/3d16814c395931373543728994ff45ac98093074), [`7f498d0`](https://github.com/mastra-ai/mastra/commit/7f498d099eacef64fd43ee412e3bd6f87965a8a6), [`8cf8a67`](https://github.com/mastra-ai/mastra/commit/8cf8a67b061b737cb06d501fb8c1967a98bbf3cb), [`d7827e3`](https://github.com/mastra-ai/mastra/commit/d7827e393937c6cb0c7a744dde4d31538cb542b7)]:
  - @mastra/core@1.21.0

## 1.21.0-alpha.2

### Patch Changes

- Updated dependencies [[`ec5c319`](https://github.com/mastra-ai/mastra/commit/ec5c3197a50d034cb8e9cc494eebfddc684b5d81), [`6517789`](https://github.com/mastra-ai/mastra/commit/65177895b74b5471fe2245c7292f0176d9b3385d), [`9ad6aa6`](https://github.com/mastra-ai/mastra/commit/9ad6aa6dfe858afc6955d1df5f3f78c40bb96b9c), [`2862127`](https://github.com/mastra-ai/mastra/commit/2862127d0a7cbd28523120ad64fea067a95838e6), [`3d16814`](https://github.com/mastra-ai/mastra/commit/3d16814c395931373543728994ff45ac98093074), [`7f498d0`](https://github.com/mastra-ai/mastra/commit/7f498d099eacef64fd43ee412e3bd6f87965a8a6), [`8cf8a67`](https://github.com/mastra-ai/mastra/commit/8cf8a67b061b737cb06d501fb8c1967a98bbf3cb), [`d7827e3`](https://github.com/mastra-ai/mastra/commit/d7827e393937c6cb0c7a744dde4d31538cb542b7)]:
  - @mastra/core@1.21.0-alpha.2

## 1.21.0-alpha.1

### Patch Changes

- Fixed OpenAI Responses API json_object mode so agent-backed responses return JSON output correctly. ([#14935](https://github.com/mastra-ai/mastra/pull/14935))

- Updated dependencies [[`13f4327`](https://github.com/mastra-ai/mastra/commit/13f4327f052faebe199cefbe906d33bf90238767)]:
  - @mastra/core@1.21.0-alpha.1

## 1.21.0-alpha.0

### Minor Changes

- **Added Responses API support for local Mastra apps** ([#14339](https://github.com/mastra-ai/mastra/pull/14339))

  You can now call Mastra through a Responses API flow and continue stored turns with
  `previous_response_id`, while keeping `model` as a Mastra model string and using
  `agent_id` to target the registered Mastra agent that handles the request. This API acts as an agent-backed
  adapter layer on top of Mastra memory and storage. Advanced provider-native settings can
  also be passed through with `providerOptions`, and provider-returned continuation state
  is surfaced back on the response under the same `providerOptions` field. Stored
  response IDs now map directly to the persisted assistant turn ID in Mastra memory.
  Configured tool definitions are returned under `tools`, while executed tool activity
  is surfaced through `output` items such as `function_call`, `function_call_output`,
  and the final assistant message. Stored responses also return `conversation_id`, which
  maps directly to the underlying Mastra memory thread ID. You can create a conversation
  explicitly with `client.conversations.create()` or let the first stored response create
  it implicitly, inspect the stored item history with `client.conversations.items.list()`,
  retrieve the conversation with `client.conversations.retrieve()`, or remove it with
  `client.conversations.delete()`. Responses requests also support
  `text.format`, including `json_object` for JSON mode and `json_schema` for
  schema-constrained structured output, through the same agent-backed route.

  ```ts
  import { MastraClient } from '@mastra/client-js';

  const client = new MastraClient({
    baseUrl: 'http://localhost:4111',
  });

  const first = await client.responses.create({
    model: 'openai/gpt-5',
    agent_id: 'support-agent',
    input: 'Write a short bedtime story.',
    store: true,
  });

  const second = await client.responses.create({
    model: 'openai/gpt-5',
    agent_id: 'support-agent',
    input: 'Make it funnier.',
    store: true,
    previous_response_id: first.id,
  });

  const items = await client.conversations.items.list(first.conversation_id!);

  const jsonResponse = await client.responses.create({
    model: 'openai/gpt-5',
    agent_id: 'support-agent',
    input: 'Return a JSON object with a title and summary.',
    text: {
      format: {
        type: 'json_object',
      },
    },
  });

  const structuredResponse = await client.responses.create({
    model: 'openai/gpt-5',
    agent_id: 'support-agent',
    input: 'Return a structured support ticket summary.',
    text: {
      format: {
        type: 'json_schema',
        name: 'ticket_summary',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            priority: { type: 'string' },
          },
          required: ['summary', 'priority'],
          additionalProperties: false,
        },
      },
    },
  });
  ```

### Patch Changes

- Updated dependencies [[`9a43b47`](https://github.com/mastra-ai/mastra/commit/9a43b476465e86c9aca381c2831066b5c33c999a)]:
  - @mastra/core@1.21.0-alpha.0

## 1.20.0

### Patch Changes

- Standardized all logger calls across the codebase to use static string messages with structured data objects. Dynamic values are now passed as key-value pairs in the second argument instead of being interpolated into template literal strings. This improves log filterability and searchability in observability storage. ([#14899](https://github.com/mastra-ai/mastra/pull/14899))

  Removed ~150 redundant or noisy log calls including duplicate error logging after trackException and verbose in-memory storage CRUD traces.

- Updated dependencies [[`cbeec24`](https://github.com/mastra-ai/mastra/commit/cbeec24b3c97a1a296e7e461e66cc7f7d215dc50), [`cee146b`](https://github.com/mastra-ai/mastra/commit/cee146b5d858212e1df2b2730fc36d3ceda0e08d), [`aa0aeff`](https://github.com/mastra-ai/mastra/commit/aa0aeffa11efbef5e219fbd97bf43d263cfe3afe), [`2bcec65`](https://github.com/mastra-ai/mastra/commit/2bcec652d62b07eab15e9eb9822f70184526eede), [`ad9bded`](https://github.com/mastra-ai/mastra/commit/ad9bdedf86a824801f49928a8d40f6e31ff5450f), [`cbeec24`](https://github.com/mastra-ai/mastra/commit/cbeec24b3c97a1a296e7e461e66cc7f7d215dc50), [`208c0bb`](https://github.com/mastra-ai/mastra/commit/208c0bbacbf5a1da6318f2a0e0c544390e542ddc), [`f566ee7`](https://github.com/mastra-ai/mastra/commit/f566ee7d53a3da33a01103e2a5ac2070ddefe6b0)]:
  - @mastra/core@1.20.0

## 1.20.0-alpha.0

### Patch Changes

- Standardized all logger calls across the codebase to use static string messages with structured data objects. Dynamic values are now passed as key-value pairs in the second argument instead of being interpolated into template literal strings. This improves log filterability and searchability in observability storage. ([#14899](https://github.com/mastra-ai/mastra/pull/14899))

  Removed ~150 redundant or noisy log calls including duplicate error logging after trackException and verbose in-memory storage CRUD traces.

- Updated dependencies [[`cbeec24`](https://github.com/mastra-ai/mastra/commit/cbeec24b3c97a1a296e7e461e66cc7f7d215dc50), [`cee146b`](https://github.com/mastra-ai/mastra/commit/cee146b5d858212e1df2b2730fc36d3ceda0e08d), [`aa0aeff`](https://github.com/mastra-ai/mastra/commit/aa0aeffa11efbef5e219fbd97bf43d263cfe3afe), [`2bcec65`](https://github.com/mastra-ai/mastra/commit/2bcec652d62b07eab15e9eb9822f70184526eede), [`ad9bded`](https://github.com/mastra-ai/mastra/commit/ad9bdedf86a824801f49928a8d40f6e31ff5450f), [`cbeec24`](https://github.com/mastra-ai/mastra/commit/cbeec24b3c97a1a296e7e461e66cc7f7d215dc50), [`208c0bb`](https://github.com/mastra-ai/mastra/commit/208c0bbacbf5a1da6318f2a0e0c544390e542ddc), [`f566ee7`](https://github.com/mastra-ai/mastra/commit/f566ee7d53a3da33a01103e2a5ac2070ddefe6b0)]:
  - @mastra/core@1.20.0-alpha.0

## 1.19.0

### Patch Changes

- Registered missing observability score and feedback aggregate routes. The handlers for `scores/aggregate`, `scores/breakdown`, `scores/timeseries`, `scores/percentiles` and their feedback counterparts were defined but not wired into the server route array, resulting in 404s. ([#14885](https://github.com/mastra-ai/mastra/pull/14885))

- Updated dependencies [[`180aaaf`](https://github.com/mastra-ai/mastra/commit/180aaaf4d0903d33a49bc72de2d40ca69a5bc599), [`9140989`](https://github.com/mastra-ai/mastra/commit/91409890e83f4f1d9c1b39223f1af91a6a53b549), [`d7c98cf`](https://github.com/mastra-ai/mastra/commit/d7c98cfc9d75baba9ecbf1a8835b5183d0a0aec8), [`acf5fbc`](https://github.com/mastra-ai/mastra/commit/acf5fbcb890dc7ca7167bec386ce5874dfadb997), [`24ca2ae`](https://github.com/mastra-ai/mastra/commit/24ca2ae57538ec189fabb9daee6175ad27035853), [`0762516`](https://github.com/mastra-ai/mastra/commit/07625167e029a8268ea7aaf0402416e6d8832874), [`9c57f2f`](https://github.com/mastra-ai/mastra/commit/9c57f2f7241e9f94769aa99fc86c531e8207d0f9), [`5bfc691`](https://github.com/mastra-ai/mastra/commit/5bfc69104c07ba7a9b55c2f8536422c0878b9c57), [`2de3d36`](https://github.com/mastra-ai/mastra/commit/2de3d36932b7f73ad26bc403f7da26cfe89e903e), [`d3736cb`](https://github.com/mastra-ai/mastra/commit/d3736cb9ce074d2b8e8b00218a01f790fe81a1b4), [`c627366`](https://github.com/mastra-ai/mastra/commit/c6273666f9ef4c8c617c68b7d07fe878a322f85c)]:
  - @mastra/core@1.19.0

## 1.19.0-alpha.2

### Patch Changes

- Updated dependencies [[`9c57f2f`](https://github.com/mastra-ai/mastra/commit/9c57f2f7241e9f94769aa99fc86c531e8207d0f9), [`5bfc691`](https://github.com/mastra-ai/mastra/commit/5bfc69104c07ba7a9b55c2f8536422c0878b9c57)]:
  - @mastra/core@1.19.0-alpha.2

## 1.18.1-alpha.1

### Patch Changes

- Registered missing observability score and feedback aggregate routes. The handlers for `scores/aggregate`, `scores/breakdown`, `scores/timeseries`, `scores/percentiles` and their feedback counterparts were defined but not wired into the server route array, resulting in 404s. ([#14885](https://github.com/mastra-ai/mastra/pull/14885))

- Updated dependencies [[`9140989`](https://github.com/mastra-ai/mastra/commit/91409890e83f4f1d9c1b39223f1af91a6a53b549), [`d7c98cf`](https://github.com/mastra-ai/mastra/commit/d7c98cfc9d75baba9ecbf1a8835b5183d0a0aec8), [`acf5fbc`](https://github.com/mastra-ai/mastra/commit/acf5fbcb890dc7ca7167bec386ce5874dfadb997), [`24ca2ae`](https://github.com/mastra-ai/mastra/commit/24ca2ae57538ec189fabb9daee6175ad27035853), [`0762516`](https://github.com/mastra-ai/mastra/commit/07625167e029a8268ea7aaf0402416e6d8832874), [`2de3d36`](https://github.com/mastra-ai/mastra/commit/2de3d36932b7f73ad26bc403f7da26cfe89e903e), [`d3736cb`](https://github.com/mastra-ai/mastra/commit/d3736cb9ce074d2b8e8b00218a01f790fe81a1b4), [`c627366`](https://github.com/mastra-ai/mastra/commit/c6273666f9ef4c8c617c68b7d07fe878a322f85c)]:
  - @mastra/core@1.18.1-alpha.1

## 1.18.1-alpha.0

### Patch Changes

- Updated dependencies [[`180aaaf`](https://github.com/mastra-ai/mastra/commit/180aaaf4d0903d33a49bc72de2d40ca69a5bc599)]:
  - @mastra/core@1.18.1-alpha.0

## 1.18.0

### Minor Changes

- Added public observability endpoints for score and feedback analytics, including `/observability/scores/aggregate`, `/observability/scores/breakdown`, `/observability/scores/timeseries`, `/observability/scores/percentiles`, and matching `/observability/feedback/*` routes for aggregates, breakdowns, time-series, and percentile queries. ([#14861](https://github.com/mastra-ai/mastra/pull/14861))

  ```bash
  curl -X POST /observability/scores/aggregate \
    -H 'content-type: application/json' \
    -d '{"scorerId":"relevance","aggregation":"avg"}'
  # {"value":0.82}
  ```

- Added new observability API endpoints for listing available tags, environments, and service names to support trace filtering in the studio UI. ([#14564](https://github.com/mastra-ai/mastra/pull/14564))

### Patch Changes

- Changed default agent version resolution from draft to published. Execution endpoints now use the latest published agent version by default instead of the draft version. ([#14847](https://github.com/mastra-ai/mastra/pull/14847))

- Added `scorerIds` to dataset API schemas and handlers, allowing scorers to be attached to datasets via CREATE and UPDATE endpoints. ([#14783](https://github.com/mastra-ai/mastra/pull/14783))

- GET /tools and GET /agents no longer crash when MCP tools or other JSON Schema-backed tools are registered. ([#14787](https://github.com/mastra-ai/mastra/pull/14787))

- Added experiment review summary API endpoint and client SDK method. ([#14649](https://github.com/mastra-ai/mastra/pull/14649))
  - **Server**: New `GET /experiments/review-summary` endpoint that returns aggregated review status counts (`needsReview`, `reviewed`, `complete`) per experiment, with totals.
  - **Client SDK**: New `getExperimentReviewSummary()` method and `ExperimentReviewCounts` type for querying the review pipeline state from the client.

- Fixed `@mastra/server` memory message filters to accept `startExclusive` and `endExclusive` date range flags in HTTP requests. ([#14014](https://github.com/mastra-ai/mastra/pull/14014))

- Updated dependencies [[`dc514a8`](https://github.com/mastra-ai/mastra/commit/dc514a83dba5f719172dddfd2c7b858e4943d067), [`e333b77`](https://github.com/mastra-ai/mastra/commit/e333b77e2d76ba57ccec1818e08cebc1993469ff), [`dc9fc19`](https://github.com/mastra-ai/mastra/commit/dc9fc19da4437f6b508cc355f346a8856746a76b), [`60a224d`](https://github.com/mastra-ai/mastra/commit/60a224dd497240e83698cfa5bfd02e3d1d854844), [`fbf22a7`](https://github.com/mastra-ai/mastra/commit/fbf22a7ad86bcb50dcf30459f0d075e51ddeb468), [`f16d92c`](https://github.com/mastra-ai/mastra/commit/f16d92c677a119a135cebcf7e2b9f51ada7a9df4), [`949b7bf`](https://github.com/mastra-ai/mastra/commit/949b7bfd4e40f2b2cba7fef5eb3f108a02cfe938), [`404fea1`](https://github.com/mastra-ai/mastra/commit/404fea13042181f0b0c73a101392ac87c79ceae2), [`ebf5047`](https://github.com/mastra-ai/mastra/commit/ebf5047e825c38a1a356f10b214c1d4260dfcd8d), [`12c647c`](https://github.com/mastra-ai/mastra/commit/12c647cf3a26826eb72d40b42e3c8356ceae16ed), [`d084b66`](https://github.com/mastra-ai/mastra/commit/d084b6692396057e83c086b954c1857d20b58a14), [`79c699a`](https://github.com/mastra-ai/mastra/commit/79c699acf3cd8a77e11c55530431f48eb48456e9), [`62757b6`](https://github.com/mastra-ai/mastra/commit/62757b6db6e8bb86569d23ad0b514178f57053f8), [`675f15b`](https://github.com/mastra-ai/mastra/commit/675f15b7eaeea649158d228ea635be40480c584d), [`b174c63`](https://github.com/mastra-ai/mastra/commit/b174c63a093108d4e53b9bc89a078d9f66202b3f), [`819f03c`](https://github.com/mastra-ai/mastra/commit/819f03c25823373b32476413bd76be28a5d8705a), [`04160ee`](https://github.com/mastra-ai/mastra/commit/04160eedf3130003cf842ad08428c8ff69af4cc1), [`2c27503`](https://github.com/mastra-ai/mastra/commit/2c275032510d131d2cde47f99953abf0fe02c081), [`424a1df`](https://github.com/mastra-ai/mastra/commit/424a1df7bee59abb5c83717a54807fdd674a6224), [`3d70b0b`](https://github.com/mastra-ai/mastra/commit/3d70b0b3524d817173ad870768f259c06d61bd23), [`eef7cb2`](https://github.com/mastra-ai/mastra/commit/eef7cb2abe7ef15951e2fdf792a5095c6c643333), [`260fe12`](https://github.com/mastra-ai/mastra/commit/260fe1295fe7354e39d6def2775e0797a7a277f0), [`12c88a6`](https://github.com/mastra-ai/mastra/commit/12c88a6e32bf982c2fe0c6af62e65a3414519a75), [`43595bf`](https://github.com/mastra-ai/mastra/commit/43595bf7b8df1a6edce7a23b445b5124d2a0b473), [`78670e9`](https://github.com/mastra-ai/mastra/commit/78670e97e76d7422cf7025faf371b2aeafed860d), [`e8a5b0b`](https://github.com/mastra-ai/mastra/commit/e8a5b0b9bc94d12dee4150095512ca27a288d778), [`3b45a13`](https://github.com/mastra-ai/mastra/commit/3b45a138d09d040779c0aba1edbbfc1b57442d23), [`d400e7c`](https://github.com/mastra-ai/mastra/commit/d400e7c8b8d7afa6ba2c71769eace4048e3cef8e), [`f58d1a7`](https://github.com/mastra-ai/mastra/commit/f58d1a7a457588a996c3ecb53201a68f3d28c432), [`a49a929`](https://github.com/mastra-ai/mastra/commit/a49a92904968b4fc67e01effee8c7c8d0464ba85), [`8127d96`](https://github.com/mastra-ai/mastra/commit/8127d96280492e335d49b244501088dfdd59a8f1)]:
  - @mastra/core@1.18.0

## 1.18.0-alpha.5

### Minor Changes

- Added public observability endpoints for score and feedback analytics, including `/observability/scores/aggregate`, `/observability/scores/breakdown`, `/observability/scores/timeseries`, `/observability/scores/percentiles`, and matching `/observability/feedback/*` routes for aggregates, breakdowns, time-series, and percentile queries. ([#14861](https://github.com/mastra-ai/mastra/pull/14861))

  ```bash
  curl -X POST /observability/scores/aggregate \
    -H 'content-type: application/json' \
    -d '{"scorerId":"relevance","aggregation":"avg"}'
  # {"value":0.82}
  ```

### Patch Changes

- Changed default agent version resolution from draft to published. Execution endpoints now use the latest published agent version by default instead of the draft version. ([#14847](https://github.com/mastra-ai/mastra/pull/14847))

- GET /tools and GET /agents no longer crash when MCP tools or other JSON Schema-backed tools are registered. ([#14787](https://github.com/mastra-ai/mastra/pull/14787))

- Updated dependencies [[`12c647c`](https://github.com/mastra-ai/mastra/commit/12c647cf3a26826eb72d40b42e3c8356ceae16ed), [`819f03c`](https://github.com/mastra-ai/mastra/commit/819f03c25823373b32476413bd76be28a5d8705a)]:
  - @mastra/core@1.18.0-alpha.5

## 1.18.0-alpha.4

### Patch Changes

- Added `scorerIds` to dataset API schemas and handlers, allowing scorers to be attached to datasets via CREATE and UPDATE endpoints. ([#14783](https://github.com/mastra-ai/mastra/pull/14783))

- Updated dependencies [[`fbf22a7`](https://github.com/mastra-ai/mastra/commit/fbf22a7ad86bcb50dcf30459f0d075e51ddeb468), [`04160ee`](https://github.com/mastra-ai/mastra/commit/04160eedf3130003cf842ad08428c8ff69af4cc1), [`2c27503`](https://github.com/mastra-ai/mastra/commit/2c275032510d131d2cde47f99953abf0fe02c081), [`424a1df`](https://github.com/mastra-ai/mastra/commit/424a1df7bee59abb5c83717a54807fdd674a6224), [`12c88a6`](https://github.com/mastra-ai/mastra/commit/12c88a6e32bf982c2fe0c6af62e65a3414519a75), [`43595bf`](https://github.com/mastra-ai/mastra/commit/43595bf7b8df1a6edce7a23b445b5124d2a0b473), [`78670e9`](https://github.com/mastra-ai/mastra/commit/78670e97e76d7422cf7025faf371b2aeafed860d), [`d400e7c`](https://github.com/mastra-ai/mastra/commit/d400e7c8b8d7afa6ba2c71769eace4048e3cef8e), [`f58d1a7`](https://github.com/mastra-ai/mastra/commit/f58d1a7a457588a996c3ecb53201a68f3d28c432), [`a49a929`](https://github.com/mastra-ai/mastra/commit/a49a92904968b4fc67e01effee8c7c8d0464ba85)]:
  - @mastra/core@1.18.0-alpha.4

## 1.18.0-alpha.3

### Patch Changes

- Updated dependencies [[`e333b77`](https://github.com/mastra-ai/mastra/commit/e333b77e2d76ba57ccec1818e08cebc1993469ff), [`60a224d`](https://github.com/mastra-ai/mastra/commit/60a224dd497240e83698cfa5bfd02e3d1d854844), [`949b7bf`](https://github.com/mastra-ai/mastra/commit/949b7bfd4e40f2b2cba7fef5eb3f108a02cfe938), [`d084b66`](https://github.com/mastra-ai/mastra/commit/d084b6692396057e83c086b954c1857d20b58a14), [`79c699a`](https://github.com/mastra-ai/mastra/commit/79c699acf3cd8a77e11c55530431f48eb48456e9), [`62757b6`](https://github.com/mastra-ai/mastra/commit/62757b6db6e8bb86569d23ad0b514178f57053f8), [`3d70b0b`](https://github.com/mastra-ai/mastra/commit/3d70b0b3524d817173ad870768f259c06d61bd23), [`3b45a13`](https://github.com/mastra-ai/mastra/commit/3b45a138d09d040779c0aba1edbbfc1b57442d23), [`8127d96`](https://github.com/mastra-ai/mastra/commit/8127d96280492e335d49b244501088dfdd59a8f1)]:
  - @mastra/core@1.18.0-alpha.3

## 1.18.0-alpha.2

### Patch Changes

- Fixed `@mastra/server` memory message filters to accept `startExclusive` and `endExclusive` date range flags in HTTP requests. ([#14014](https://github.com/mastra-ai/mastra/pull/14014))

- Updated dependencies [[`f16d92c`](https://github.com/mastra-ai/mastra/commit/f16d92c677a119a135cebcf7e2b9f51ada7a9df4)]:
  - @mastra/core@1.18.0-alpha.2

## 1.18.0-alpha.1

### Patch Changes

- Added experiment review summary API endpoint and client SDK method. ([#14649](https://github.com/mastra-ai/mastra/pull/14649))
  - **Server**: New `GET /experiments/review-summary` endpoint that returns aggregated review status counts (`needsReview`, `reviewed`, `complete`) per experiment, with totals.
  - **Client SDK**: New `getExperimentReviewSummary()` method and `ExperimentReviewCounts` type for querying the review pipeline state from the client.

- Updated dependencies [[`dc9fc19`](https://github.com/mastra-ai/mastra/commit/dc9fc19da4437f6b508cc355f346a8856746a76b), [`260fe12`](https://github.com/mastra-ai/mastra/commit/260fe1295fe7354e39d6def2775e0797a7a277f0)]:
  - @mastra/core@1.18.0-alpha.1

## 1.18.0-alpha.0

### Minor Changes

- Added new observability API endpoints for listing available tags, environments, and service names to support trace filtering in the studio UI. ([#14564](https://github.com/mastra-ai/mastra/pull/14564))

### Patch Changes

- Updated dependencies [[`dc514a8`](https://github.com/mastra-ai/mastra/commit/dc514a83dba5f719172dddfd2c7b858e4943d067), [`404fea1`](https://github.com/mastra-ai/mastra/commit/404fea13042181f0b0c73a101392ac87c79ceae2), [`ebf5047`](https://github.com/mastra-ai/mastra/commit/ebf5047e825c38a1a356f10b214c1d4260dfcd8d), [`675f15b`](https://github.com/mastra-ai/mastra/commit/675f15b7eaeea649158d228ea635be40480c584d), [`b174c63`](https://github.com/mastra-ai/mastra/commit/b174c63a093108d4e53b9bc89a078d9f66202b3f), [`eef7cb2`](https://github.com/mastra-ai/mastra/commit/eef7cb2abe7ef15951e2fdf792a5095c6c643333), [`e8a5b0b`](https://github.com/mastra-ai/mastra/commit/e8a5b0b9bc94d12dee4150095512ca27a288d778)]:
  - @mastra/core@1.18.0-alpha.0

## 1.17.0

### Minor Changes

- Added new observability API endpoints for listing available tags, environments, and service names to support trace filtering in the studio UI. ([#14564](https://github.com/mastra-ai/mastra/pull/14564))

### Patch Changes

- Updated dependencies [[`dc514a8`](https://github.com/mastra-ai/mastra/commit/dc514a83dba5f719172dddfd2c7b858e4943d067), [`404fea1`](https://github.com/mastra-ai/mastra/commit/404fea13042181f0b0c73a101392ac87c79ceae2), [`ebf5047`](https://github.com/mastra-ai/mastra/commit/ebf5047e825c38a1a356f10b214c1d4260dfcd8d), [`675f15b`](https://github.com/mastra-ai/mastra/commit/675f15b7eaeea649158d228ea635be40480c584d), [`b174c63`](https://github.com/mastra-ai/mastra/commit/b174c63a093108d4e53b9bc89a078d9f66202b3f), [`7302e5c`](https://github.com/mastra-ai/mastra/commit/7302e5ce0f52d769d3d63fb0faa8a7d4089cda6d), [`eef7cb2`](https://github.com/mastra-ai/mastra/commit/eef7cb2abe7ef15951e2fdf792a5095c6c643333), [`86e3263`](https://github.com/mastra-ai/mastra/commit/86e326363edd12be5a5b25ccce4a39f66f7c9f50), [`e8a5b0b`](https://github.com/mastra-ai/mastra/commit/e8a5b0b9bc94d12dee4150095512ca27a288d778)]:
  - @mastra/core@1.17.0

## 1.17.0-alpha.2

### Patch Changes

- Updated dependencies [[`404fea1`](https://github.com/mastra-ai/mastra/commit/404fea13042181f0b0c73a101392ac87c79ceae2), [`ebf5047`](https://github.com/mastra-ai/mastra/commit/ebf5047e825c38a1a356f10b214c1d4260dfcd8d), [`675f15b`](https://github.com/mastra-ai/mastra/commit/675f15b7eaeea649158d228ea635be40480c584d), [`b174c63`](https://github.com/mastra-ai/mastra/commit/b174c63a093108d4e53b9bc89a078d9f66202b3f), [`eef7cb2`](https://github.com/mastra-ai/mastra/commit/eef7cb2abe7ef15951e2fdf792a5095c6c643333), [`86e3263`](https://github.com/mastra-ai/mastra/commit/86e326363edd12be5a5b25ccce4a39f66f7c9f50), [`e8a5b0b`](https://github.com/mastra-ai/mastra/commit/e8a5b0b9bc94d12dee4150095512ca27a288d778)]:
  - @mastra/core@1.17.0-alpha.2

## 1.16.1-alpha.1

### Patch Changes

- Updated dependencies [[`7302e5c`](https://github.com/mastra-ai/mastra/commit/7302e5ce0f52d769d3d63fb0faa8a7d4089cda6d)]:
  - @mastra/core@1.16.1-alpha.1

## 1.16.1-alpha.0

### Patch Changes

- Updated dependencies [[`dc514a8`](https://github.com/mastra-ai/mastra/commit/dc514a83dba5f719172dddfd2c7b858e4943d067)]:
  - @mastra/core@1.16.1-alpha.0

## 1.16.0

### Minor Changes

- Added dataset-agent association and experiment status tracking for the Evaluate workflow. ([#14470](https://github.com/mastra-ai/mastra/pull/14470))
  - **Dataset targeting**: Added `targetType` and `targetIds` fields to datasets, enabling association with agents, scorers, or workflows. Datasets can now be linked to multiple entities.
  - **Experiment status**: Added `status` field to experiment results (`'needs-review'`, `'reviewed'`, `'complete'`) for review queue workflow.
  - **Dataset experiment routes**: Added API endpoints for triggering experiments from a dataset with configurable target type and target ID.
  - **LLM data generation**: Added endpoint for generating dataset items using an LLM with configurable count and prompt.
  - **Failure analysis**: Added endpoint for clustering experiment failures and proposing tags using LLM analysis.

- Added `getAuthenticatedUser()` to `@mastra/server/auth` so server middleware can resolve the configured auth user without changing route auth behavior. ([#14458](https://github.com/mastra-ai/mastra/pull/14458))

  **Example**

  ```ts
  import { getAuthenticatedUser } from '@mastra/server/auth';

  const user = await getAuthenticatedUser({
    mastra,
    token,
    request: c.req.raw,
  });
  ```

- Added new observability API endpoints and client methods for logs, scores, feedback, metrics (aggregate, breakdown, time series, percentiles), and discovery (metric names, label keys/values, entity types/names, service names, environments, tags) ([#14470](https://github.com/mastra-ai/mastra/pull/14470))

### Patch Changes

- Added agent version support for experiments. When triggering an experiment, you can now pass an `agentVersion` parameter to pin which agent version to use. The agent version is stored with the experiment and returned in experiment responses. ([#14562](https://github.com/mastra-ai/mastra/pull/14562))

  ```ts
  const client = new MastraClient();

  await client.triggerDatasetExperiment({
    datasetId: 'my-dataset',
    targetType: 'agent',
    targetId: 'my-agent',
    version: 3, // pin to dataset version 3
    agentVersion: 'ver_abc123', // pin to a specific agent version
  });
  ```

- Add optional `?path=` query param to workspace skill routes for disambiguating same-named skills. ([#14430](https://github.com/mastra-ai/mastra/pull/14430))

  Skill routes continue to use `:skillName` in the URL path (no breaking change). When two skills share the same name (e.g. from different directories), pass the optional `?path=` query parameter to select the exact skill:

  ```
  GET /workspaces/:workspaceId/skills/:skillName?path=skills/brand-guidelines
  ```

  `SkillMetadata` now includes a `path` field, and the `list()` method returns all same-named skills for disambiguation. The client SDK's `getSkill()` accepts an optional `skillPath` parameter for disambiguation.

- Updated skill search result types and query parameters to use `skillName`/`skillNames` instead of `skillPath`/`skillPaths` for consistency with the name-based public API. ([#14430](https://github.com/mastra-ai/mastra/pull/14430))

- Added storage type detection to the Metrics Dashboard. The `/system/packages` endpoint now returns `observabilityStorageType`, identifying the observability storage backend. The dashboard shows an empty state when the storage does not support metrics (e.g. PostgreSQL, LibSQL), and displays a warning when using in-memory storage since metrics are not persisted across server restarts. Also added a docs link button to the Metrics page header. ([#14620](https://github.com/mastra-ai/mastra/pull/14620))

  ```ts
  import { MastraClient } from '@mastra/client-js';

  const client = new MastraClient();
  const system = await client.getSystemPackages();

  // system.observabilityStorageType contains the class name of the observability store:
  // - 'ObservabilityInMemory' → metrics work but are not persisted across restarts
  // - 'ObservabilityPG', 'ObservabilityLibSQL', etc. → metrics not supported

  if (system.observabilityStorageType === 'ObservabilityInMemory') {
    console.warn('Metrics are not persisted — data will be lost on server restart.');
  }

  const SUPPORTED = new Set(['ObservabilityInMemory']);
  if (!SUPPORTED.has(system.observabilityStorageType ?? '')) {
    console.error('Metrics require in-memory observability storage.');
  }
  ```

- Fix Zod v3 and Zod v4 compatibility across public structured-output APIs. ([#14464](https://github.com/mastra-ai/mastra/pull/14464))

  Mastra agent and client APIs accept schemas from either `zod/v3` or `zod/v4`, matching the documented peer dependency range and preserving TypeScript compatibility for both Zod versions.

- Added `ModelByInputTokens` in `@mastra/memory` for token-threshold-based model selection in Observational Memory. ([#14614](https://github.com/mastra-ai/mastra/pull/14614))

  When configured, OM automatically selects different observer or reflector models based on the actual input token count at the time the OM call runs.

  Example usage:

  ```ts
  import { Memory, ModelByInputTokens } from '@mastra/memory';

  const memory = new Memory({
    options: {
      observationalMemory: {
        model: new ModelByInputTokens({
          upTo: {
            10_000: 'google/gemini-2.5-flash',
            40_000: 'openai/gpt-4o',
            1_000_000: 'openai/gpt-4.5',
          },
        }),
      },
    },
  });
  ```

  The `upTo` keys are inclusive upper bounds. OM resolves the matching tier directly at the observer or reflector call site. If the input exceeds the largest configured threshold, OM throws an error.

  Improved Observational Memory tracing so traces show the observer and reflector spans and make it easier to see which resolved model was used at runtime.

- Updated dependencies [[`68ed4e9`](https://github.com/mastra-ai/mastra/commit/68ed4e9f118e8646b60a6112dabe854d0ef53902), [`085c1da`](https://github.com/mastra-ai/mastra/commit/085c1daf71b55a97b8ebad26623089e40055021c), [`be37de4`](https://github.com/mastra-ai/mastra/commit/be37de4391bd1d5486ce38efacbf00ca51637262), [`7dbd611`](https://github.com/mastra-ai/mastra/commit/7dbd611a85cb1e0c0a1581c57564268cb183d86e), [`f14604c`](https://github.com/mastra-ai/mastra/commit/f14604c7ef01ba794e1a8d5c7bae5415852aacec), [`4a75e10`](https://github.com/mastra-ai/mastra/commit/4a75e106bd31c283a1b3fe74c923610dcc46415b), [`f3ce603`](https://github.com/mastra-ai/mastra/commit/f3ce603fd76180f4a5be90b6dc786d389b6b3e98), [`423aa6f`](https://github.com/mastra-ai/mastra/commit/423aa6fd12406de6a1cc6b68e463d30af1d790fb), [`f21c626`](https://github.com/mastra-ai/mastra/commit/f21c6263789903ab9720b4d11373093298e97f15), [`41aee84`](https://github.com/mastra-ai/mastra/commit/41aee84561ceebe28bad1ecba8702d92838f67f0), [`2871451`](https://github.com/mastra-ai/mastra/commit/2871451703829aefa06c4a5d6eca7fd3731222ef), [`085c1da`](https://github.com/mastra-ai/mastra/commit/085c1daf71b55a97b8ebad26623089e40055021c), [`4bb5adc`](https://github.com/mastra-ai/mastra/commit/4bb5adc05c88e3a83fe1ea5ecb9eae6e17313124), [`4bb5adc`](https://github.com/mastra-ai/mastra/commit/4bb5adc05c88e3a83fe1ea5ecb9eae6e17313124), [`e06b520`](https://github.com/mastra-ai/mastra/commit/e06b520bdd5fdef844760c5e692c7852cbc5c240), [`d3930ea`](https://github.com/mastra-ai/mastra/commit/d3930eac51c30b0ecf7eaa54bb9430758b399777), [`dd9c4e0`](https://github.com/mastra-ai/mastra/commit/dd9c4e0a47962f1413e9b72114fcad912e19a0a6)]:
  - @mastra/core@1.16.0

## 1.16.0-alpha.5

### Patch Changes

- Updated dependencies [[`f21c626`](https://github.com/mastra-ai/mastra/commit/f21c6263789903ab9720b4d11373093298e97f15)]:
  - @mastra/core@1.16.0-alpha.5

## 1.16.0-alpha.4

### Patch Changes

- Added `ModelByInputTokens` in `@mastra/memory` for token-threshold-based model selection in Observational Memory. ([#14614](https://github.com/mastra-ai/mastra/pull/14614))

  When configured, OM automatically selects different observer or reflector models based on the actual input token count at the time the OM call runs.

  Example usage:

  ```ts
  import { Memory, ModelByInputTokens } from '@mastra/memory';

  const memory = new Memory({
    options: {
      observationalMemory: {
        model: new ModelByInputTokens({
          upTo: {
            10_000: 'google/gemini-2.5-flash',
            40_000: 'openai/gpt-4o',
            1_000_000: 'openai/gpt-4.5',
          },
        }),
      },
    },
  });
  ```

  The `upTo` keys are inclusive upper bounds. OM resolves the matching tier directly at the observer or reflector call site. If the input exceeds the largest configured threshold, OM throws an error.

  Improved Observational Memory tracing so traces show the observer and reflector spans and make it easier to see which resolved model was used at runtime.

- Updated dependencies [[`f14604c`](https://github.com/mastra-ai/mastra/commit/f14604c7ef01ba794e1a8d5c7bae5415852aacec), [`e06b520`](https://github.com/mastra-ai/mastra/commit/e06b520bdd5fdef844760c5e692c7852cbc5c240), [`dd9c4e0`](https://github.com/mastra-ai/mastra/commit/dd9c4e0a47962f1413e9b72114fcad912e19a0a6)]:
  - @mastra/core@1.16.0-alpha.4

## 1.16.0-alpha.3

### Patch Changes

- Add optional `?path=` query param to workspace skill routes for disambiguating same-named skills. ([#14430](https://github.com/mastra-ai/mastra/pull/14430))

  Skill routes continue to use `:skillName` in the URL path (no breaking change). When two skills share the same name (e.g. from different directories), pass the optional `?path=` query parameter to select the exact skill:

  ```
  GET /workspaces/:workspaceId/skills/:skillName?path=skills/brand-guidelines
  ```

  `SkillMetadata` now includes a `path` field, and the `list()` method returns all same-named skills for disambiguation. The client SDK's `getSkill()` accepts an optional `skillPath` parameter for disambiguation.

- Updated skill search result types and query parameters to use `skillName`/`skillNames` instead of `skillPath`/`skillPaths` for consistency with the name-based public API. ([#14430](https://github.com/mastra-ai/mastra/pull/14430))

- Added storage type detection to the Metrics Dashboard. The `/system/packages` endpoint now returns `observabilityStorageType`, identifying the observability storage backend. The dashboard shows an empty state when the storage does not support metrics (e.g. PostgreSQL, LibSQL), and displays a warning when using in-memory storage since metrics are not persisted across server restarts. Also added a docs link button to the Metrics page header. ([#14620](https://github.com/mastra-ai/mastra/pull/14620))

  ```ts
  import { MastraClient } from '@mastra/client-js';

  const client = new MastraClient();
  const system = await client.getSystemPackages();

  // system.observabilityStorageType contains the class name of the observability store:
  // - 'ObservabilityInMemory' → metrics work but are not persisted across restarts
  // - 'ObservabilityPG', 'ObservabilityLibSQL', etc. → metrics not supported

  if (system.observabilityStorageType === 'ObservabilityInMemory') {
    console.warn('Metrics are not persisted — data will be lost on server restart.');
  }

  const SUPPORTED = new Set(['ObservabilityInMemory']);
  if (!SUPPORTED.has(system.observabilityStorageType ?? '')) {
    console.error('Metrics require in-memory observability storage.');
  }
  ```

- Updated dependencies [[`423aa6f`](https://github.com/mastra-ai/mastra/commit/423aa6fd12406de6a1cc6b68e463d30af1d790fb), [`4bb5adc`](https://github.com/mastra-ai/mastra/commit/4bb5adc05c88e3a83fe1ea5ecb9eae6e17313124), [`4bb5adc`](https://github.com/mastra-ai/mastra/commit/4bb5adc05c88e3a83fe1ea5ecb9eae6e17313124)]:
  - @mastra/core@1.16.0-alpha.3

## 1.16.0-alpha.2

### Patch Changes

- Fix Zod v3 and Zod v4 compatibility across public structured-output APIs. ([#14464](https://github.com/mastra-ai/mastra/pull/14464))

  Mastra agent and client APIs accept schemas from either `zod/v3` or `zod/v4`, matching the documented peer dependency range and preserving TypeScript compatibility for both Zod versions.

- Updated dependencies [[`be37de4`](https://github.com/mastra-ai/mastra/commit/be37de4391bd1d5486ce38efacbf00ca51637262), [`f3ce603`](https://github.com/mastra-ai/mastra/commit/f3ce603fd76180f4a5be90b6dc786d389b6b3e98), [`2871451`](https://github.com/mastra-ai/mastra/commit/2871451703829aefa06c4a5d6eca7fd3731222ef), [`d3930ea`](https://github.com/mastra-ai/mastra/commit/d3930eac51c30b0ecf7eaa54bb9430758b399777)]:
  - @mastra/core@1.16.0-alpha.2

## 1.16.0-alpha.1

### Minor Changes

- Added `getAuthenticatedUser()` to `@mastra/server/auth` so server middleware can resolve the configured auth user without changing route auth behavior. ([#14458](https://github.com/mastra-ai/mastra/pull/14458))

  **Example**

  ```ts
  import { getAuthenticatedUser } from '@mastra/server/auth';

  const user = await getAuthenticatedUser({
    mastra,
    token,
    request: c.req.raw,
  });
  ```

### Patch Changes

- Added agent version support for experiments. When triggering an experiment, you can now pass an `agentVersion` parameter to pin which agent version to use. The agent version is stored with the experiment and returned in experiment responses. ([#14562](https://github.com/mastra-ai/mastra/pull/14562))

  ```ts
  const client = new MastraClient();

  await client.triggerDatasetExperiment({
    datasetId: 'my-dataset',
    targetType: 'agent',
    targetId: 'my-agent',
    version: 3, // pin to dataset version 3
    agentVersion: 'ver_abc123', // pin to a specific agent version
  });
  ```

- Updated dependencies [[`7dbd611`](https://github.com/mastra-ai/mastra/commit/7dbd611a85cb1e0c0a1581c57564268cb183d86e), [`41aee84`](https://github.com/mastra-ai/mastra/commit/41aee84561ceebe28bad1ecba8702d92838f67f0)]:
  - @mastra/core@1.16.0-alpha.1

## 1.16.0-alpha.0

### Minor Changes

- Added dataset-agent association and experiment status tracking for the Evaluate workflow. ([#14470](https://github.com/mastra-ai/mastra/pull/14470))
  - **Dataset targeting**: Added `targetType` and `targetIds` fields to datasets, enabling association with agents, scorers, or workflows. Datasets can now be linked to multiple entities.
  - **Experiment status**: Added `status` field to experiment results (`'needs-review'`, `'reviewed'`, `'complete'`) for review queue workflow.
  - **Dataset experiment routes**: Added API endpoints for triggering experiments from a dataset with configurable target type and target ID.
  - **LLM data generation**: Added endpoint for generating dataset items using an LLM with configurable count and prompt.
  - **Failure analysis**: Added endpoint for clustering experiment failures and proposing tags using LLM analysis.

- Added new observability API endpoints and client methods for logs, scores, feedback, metrics (aggregate, breakdown, time series, percentiles), and discovery (metric names, label keys/values, entity types/names, service names, environments, tags) ([#14470](https://github.com/mastra-ai/mastra/pull/14470))

### Patch Changes

- Updated dependencies [[`68ed4e9`](https://github.com/mastra-ai/mastra/commit/68ed4e9f118e8646b60a6112dabe854d0ef53902), [`085c1da`](https://github.com/mastra-ai/mastra/commit/085c1daf71b55a97b8ebad26623089e40055021c), [`4a75e10`](https://github.com/mastra-ai/mastra/commit/4a75e106bd31c283a1b3fe74c923610dcc46415b), [`085c1da`](https://github.com/mastra-ai/mastra/commit/085c1daf71b55a97b8ebad26623089e40055021c)]:
  - @mastra/core@1.16.0-alpha.0

## 1.15.0

### Minor Changes

- Added version query parameters to GET /api/agents/:agentId endpoint. Code-defined agents can now be resolved with specific stored config versions using ?status=draft (latest, default), ?status=published (active version), or ?versionId=<id> (specific version). ([#14156](https://github.com/mastra-ai/mastra/pull/14156))

### Patch Changes

- Added missing route "GET_METRICS_BREAKDOWN" to observability server domain. ([#14457](https://github.com/mastra-ai/mastra/pull/14457))

- fix: remove explicit Transfer-Encoding header to prevent duplicate headers in Bun runtime ([#11545](https://github.com/mastra-ai/mastra/pull/11545))

  Removes explicit `Transfer-Encoding: chunked` header from `toTextStreamResponse()` and `toDataStreamResponse()` calls in agent streaming handlers. When deploying with Bun, the runtime automatically adds this header for `ReadableStream` responses. Setting it explicitly caused duplicate headers, which broke HTTP protocol compliance and resulted in 502 errors.

  Node.js runtimes will continue to automatically add the `Transfer-Encoding` header for chunked responses, so this change has no impact on Node.js deployments.

  Fixes #11510

- Updated dependencies [[`cb611a1`](https://github.com/mastra-ai/mastra/commit/cb611a1e89a4f4cf74c97b57e0c27bb56f2eceb5), [`da93115`](https://github.com/mastra-ai/mastra/commit/da931155c1a9bc63d455d3d86b4ec984db5991fe), [`62d1d3c`](https://github.com/mastra-ai/mastra/commit/62d1d3cc08fe8182e7080237fd975de862ec8c91), [`9e1a3ed`](https://github.com/mastra-ai/mastra/commit/9e1a3ed07cfafb5e8e19a796ce0bee817002d7c0), [`8681ecb`](https://github.com/mastra-ai/mastra/commit/8681ecb86184d5907267000e4576cc442a9a83fc), [`28d0249`](https://github.com/mastra-ai/mastra/commit/28d0249295782277040ad1e0d243e695b7ab1ce4), [`681ee1c`](https://github.com/mastra-ai/mastra/commit/681ee1c811359efd1b8bebc4bce35b9bb7b14bec), [`bb0f09d`](https://github.com/mastra-ai/mastra/commit/bb0f09dbac58401b36069f483acf5673202db5b5), [`a579f7a`](https://github.com/mastra-ai/mastra/commit/a579f7a31e582674862b5679bc79af7ccf7429b8), [`5f7e9d0`](https://github.com/mastra-ai/mastra/commit/5f7e9d0db664020e1f3d97d7d18c6b0b9d4843d0), [`d7f14c3`](https://github.com/mastra-ai/mastra/commit/d7f14c3285cd253ecdd5f58139b7b6cbdf3678b5), [`0efe12a`](https://github.com/mastra-ai/mastra/commit/0efe12a5f008a939a1aac71699486ba40138054e)]:
  - @mastra/core@1.15.0

## 1.15.0-alpha.4

### Patch Changes

- Updated dependencies [[`da93115`](https://github.com/mastra-ai/mastra/commit/da931155c1a9bc63d455d3d86b4ec984db5991fe), [`0efe12a`](https://github.com/mastra-ai/mastra/commit/0efe12a5f008a939a1aac71699486ba40138054e)]:
  - @mastra/core@1.15.0-alpha.4

## 1.15.0-alpha.3

### Patch Changes

- Updated dependencies [[`d7f14c3`](https://github.com/mastra-ai/mastra/commit/d7f14c3285cd253ecdd5f58139b7b6cbdf3678b5)]:
  - @mastra/core@1.15.0-alpha.3

## 1.15.0-alpha.2

### Patch Changes

- fix: remove explicit Transfer-Encoding header to prevent duplicate headers in Bun runtime ([#11545](https://github.com/mastra-ai/mastra/pull/11545))

  Removes explicit `Transfer-Encoding: chunked` header from `toTextStreamResponse()` and `toDataStreamResponse()` calls in agent streaming handlers. When deploying with Bun, the runtime automatically adds this header for `ReadableStream` responses. Setting it explicitly caused duplicate headers, which broke HTTP protocol compliance and resulted in 502 errors.

  Node.js runtimes will continue to automatically add the `Transfer-Encoding` header for chunked responses, so this change has no impact on Node.js deployments.

  Fixes #11510

- Updated dependencies [[`9e1a3ed`](https://github.com/mastra-ai/mastra/commit/9e1a3ed07cfafb5e8e19a796ce0bee817002d7c0), [`a579f7a`](https://github.com/mastra-ai/mastra/commit/a579f7a31e582674862b5679bc79af7ccf7429b8)]:
  - @mastra/core@1.15.0-alpha.2

## 1.15.0-alpha.1

### Patch Changes

- Updated dependencies [[`681ee1c`](https://github.com/mastra-ai/mastra/commit/681ee1c811359efd1b8bebc4bce35b9bb7b14bec)]:
  - @mastra/core@1.15.0-alpha.1

## 1.15.0-alpha.0

### Minor Changes

- Added version query parameters to GET /api/agents/:agentId endpoint. Code-defined agents can now be resolved with specific stored config versions using ?status=draft (latest, default), ?status=published (active version), or ?versionId=<id> (specific version). ([#14156](https://github.com/mastra-ai/mastra/pull/14156))

### Patch Changes

- Added missing route "GET_METRICS_BREAKDOWN" to observability server domain. ([#14457](https://github.com/mastra-ai/mastra/pull/14457))

- Updated dependencies [[`cb611a1`](https://github.com/mastra-ai/mastra/commit/cb611a1e89a4f4cf74c97b57e0c27bb56f2eceb5), [`62d1d3c`](https://github.com/mastra-ai/mastra/commit/62d1d3cc08fe8182e7080237fd975de862ec8c91), [`8681ecb`](https://github.com/mastra-ai/mastra/commit/8681ecb86184d5907267000e4576cc442a9a83fc), [`28d0249`](https://github.com/mastra-ai/mastra/commit/28d0249295782277040ad1e0d243e695b7ab1ce4), [`bb0f09d`](https://github.com/mastra-ai/mastra/commit/bb0f09dbac58401b36069f483acf5673202db5b5), [`5f7e9d0`](https://github.com/mastra-ai/mastra/commit/5f7e9d0db664020e1f3d97d7d18c6b0b9d4843d0)]:
  - @mastra/core@1.15.0-alpha.0

## 1.14.0

### Minor Changes

- Added new observability API endpoints and client methods for logs, scores, feedback, metrics (aggregate, breakdown, time series, percentiles), and discovery (metric names, label keys/values, entity types/names, service names, environments, tags) ([#14270](https://github.com/mastra-ai/mastra/pull/14270))

### Patch Changes

- Fixed server tool serialization for plain JSON Schema objects to prevent tools from disappearing in Studio. ([#13920](https://github.com/mastra-ai/mastra/pull/13920))

- Updated dependencies [[`51970b3`](https://github.com/mastra-ai/mastra/commit/51970b3828494d59a8dd4df143b194d37d31e3f5), [`4444280`](https://github.com/mastra-ai/mastra/commit/444428094253e916ec077e66284e685fde67021e), [`085e371`](https://github.com/mastra-ai/mastra/commit/085e3718a7d0fe9a210fe7dd1c867b9bdfe8d16b), [`b77aa19`](https://github.com/mastra-ai/mastra/commit/b77aa1981361c021f2c881bee8f0c703687f00da), [`dbb879a`](https://github.com/mastra-ai/mastra/commit/dbb879af0b809c668e9b3a9d8bac97d806caa267), [`8b4ce84`](https://github.com/mastra-ai/mastra/commit/8b4ce84aed0808b9805cc4fd7147c1f8a2ef7a36), [`8d4cfe6`](https://github.com/mastra-ai/mastra/commit/8d4cfe6b9a7157d3876206227ec9f04cde6dbc4a), [`dd6ca1c`](https://github.com/mastra-ai/mastra/commit/dd6ca1cdea3b8b6182f4cf61df41070ba0cc0deb), [`ce26fe2`](https://github.com/mastra-ai/mastra/commit/ce26fe2166dd90254f8bee5776e55977143e97de), [`68a019d`](https://github.com/mastra-ai/mastra/commit/68a019d30d22251ddd628a2947d60215c03c350a), [`4cb4edf`](https://github.com/mastra-ai/mastra/commit/4cb4edf3c909d197ec356c1790d13270514ffef6), [`8de3555`](https://github.com/mastra-ai/mastra/commit/8de355572c6fd838f863a3e7e6fe24d0947b774f), [`b26307f`](https://github.com/mastra-ai/mastra/commit/b26307f050df39629511b0e831b8fc26973ce8b1), [`68a019d`](https://github.com/mastra-ai/mastra/commit/68a019d30d22251ddd628a2947d60215c03c350a)]:
  - @mastra/core@1.14.0

## 1.14.0-alpha.3

### Patch Changes

- Updated dependencies [[`8b4ce84`](https://github.com/mastra-ai/mastra/commit/8b4ce84aed0808b9805cc4fd7147c1f8a2ef7a36), [`8d4cfe6`](https://github.com/mastra-ai/mastra/commit/8d4cfe6b9a7157d3876206227ec9f04cde6dbc4a), [`68a019d`](https://github.com/mastra-ai/mastra/commit/68a019d30d22251ddd628a2947d60215c03c350a), [`68a019d`](https://github.com/mastra-ai/mastra/commit/68a019d30d22251ddd628a2947d60215c03c350a)]:
  - @mastra/core@1.14.0-alpha.3

## 1.14.0-alpha.2

### Minor Changes

- Added new observability API endpoints and client methods for logs, scores, feedback, metrics (aggregate, breakdown, time series, percentiles), and discovery (metric names, label keys/values, entity types/names, service names, environments, tags) ([#14270](https://github.com/mastra-ai/mastra/pull/14270))

### Patch Changes

- Updated dependencies [[`4444280`](https://github.com/mastra-ai/mastra/commit/444428094253e916ec077e66284e685fde67021e), [`dbb879a`](https://github.com/mastra-ai/mastra/commit/dbb879af0b809c668e9b3a9d8bac97d806caa267), [`8de3555`](https://github.com/mastra-ai/mastra/commit/8de355572c6fd838f863a3e7e6fe24d0947b774f)]:
  - @mastra/core@1.14.0-alpha.2

## 1.13.3-alpha.1

### Patch Changes

- Updated dependencies [[`b77aa19`](https://github.com/mastra-ai/mastra/commit/b77aa1981361c021f2c881bee8f0c703687f00da), [`dd6ca1c`](https://github.com/mastra-ai/mastra/commit/dd6ca1cdea3b8b6182f4cf61df41070ba0cc0deb), [`4cb4edf`](https://github.com/mastra-ai/mastra/commit/4cb4edf3c909d197ec356c1790d13270514ffef6)]:
  - @mastra/core@1.13.3-alpha.1

## 1.13.3-alpha.0

### Patch Changes

- Fixed server tool serialization for plain JSON Schema objects to prevent tools from disappearing in Studio. ([#13920](https://github.com/mastra-ai/mastra/pull/13920))

- Updated dependencies [[`51970b3`](https://github.com/mastra-ai/mastra/commit/51970b3828494d59a8dd4df143b194d37d31e3f5), [`085e371`](https://github.com/mastra-ai/mastra/commit/085e3718a7d0fe9a210fe7dd1c867b9bdfe8d16b), [`ce26fe2`](https://github.com/mastra-ai/mastra/commit/ce26fe2166dd90254f8bee5776e55977143e97de), [`b26307f`](https://github.com/mastra-ai/mastra/commit/b26307f050df39629511b0e831b8fc26973ce8b1)]:
  - @mastra/core@1.13.3-alpha.0

## 1.13.2

### Patch Changes

- Updated dependencies [[`0ce6035`](https://github.com/mastra-ai/mastra/commit/0ce603591189f547397704e53f23c77bc5630071)]:
  - @mastra/core@1.13.2

## 1.13.2-alpha.0

### Patch Changes

- Updated dependencies [[`0ce6035`](https://github.com/mastra-ai/mastra/commit/0ce603591189f547397704e53f23c77bc5630071)]:
  - @mastra/core@1.13.2-alpha.0

## 1.13.1

### Patch Changes

- Fixed memory API endpoints (`/memory/config` and `/memory/threads/:threadId/working-memory`) returning 400 errors when agents don't have memory configured. These endpoints now return graceful null responses instead of throwing, preventing console error noise in the playground/studio. Fixes regression of #11765. ([#14234](https://github.com/mastra-ai/mastra/pull/14234))

- Updated dependencies [[`205e76c`](https://github.com/mastra-ai/mastra/commit/205e76c3ba652205dafb037f50a4a8eea73f6736)]:
  - @mastra/core@1.13.1

## 1.13.0

### Minor Changes

- Added `@mastra/server/schemas` export with utility types that infer path params, query params, request body, and response types from any route in `SERVER_ROUTES`. When you add a new route via `createRoute()`, it automatically appears in the `RouteMap` type — no manual contract needed. ([#14008](https://github.com/mastra-ai/mastra/pull/14008))

  ```ts
  import type { RouteMap, RouteContract, InferPathParams, InferBody, InferResponse } from '@mastra/server/schemas';

  type GetAgentParams = InferPathParams<RouteMap['GET /agents/:agentId']>;
  // => { agentId: string }

  type GenerateBody = InferBody<RouteMap['POST /agents/:agentId/generate']>;
  // => { messages: CoreMessage[], ... }

  type AgentResponse = InferResponse<RouteMap['GET /agents/:agentId']>;
  // => { name: string, tools: ..., ... }
  ```

### Patch Changes

- Fixed OpenAPI spec for custom route paths. Custom routes registered via `registerApiRoute` are served at the root path (e.g. `/health`), not under `/api`. The OpenAPI spec now correctly represents this so that API tools and clients using the spec will resolve them to the correct URL. ([#13930](https://github.com/mastra-ai/mastra/pull/13930))

- Fixed an unnecessary runtime dependency in `@mastra/server`, reducing install size for consumers. Moved `@mastra/schema-compat` from dependencies to devDependencies since it is only needed at build time. ([#14223](https://github.com/mastra-ai/mastra/pull/14223))

- Updated dependencies [[`ea86967`](https://github.com/mastra-ai/mastra/commit/ea86967449426e0a3673253bd1c2c052a99d970d), [`db21c21`](https://github.com/mastra-ai/mastra/commit/db21c21a6ae5f33539262cc535342fa8757eb359), [`11f5dbe`](https://github.com/mastra-ai/mastra/commit/11f5dbe9a1e7ad8ef3b1ea34fb4a9fa3631d1587), [`6751354`](https://github.com/mastra-ai/mastra/commit/67513544d1a64be891d9de7624d40aadc895d56e), [`c958cd3`](https://github.com/mastra-ai/mastra/commit/c958cd36627c1eea122ec241b2b15492977a263a), [`86f2426`](https://github.com/mastra-ai/mastra/commit/86f242631d252a172d2f9f9a2ea0feb8647a76b0), [`950eb07`](https://github.com/mastra-ai/mastra/commit/950eb07b7e7354629630e218d49550fdd299c452)]:
  - @mastra/core@1.13.0

## 1.13.0-alpha.0

### Minor Changes

- Added `@mastra/server/schemas` export with utility types that infer path params, query params, request body, and response types from any route in `SERVER_ROUTES`. When you add a new route via `createRoute()`, it automatically appears in the `RouteMap` type — no manual contract needed. ([#14008](https://github.com/mastra-ai/mastra/pull/14008))

  ```ts
  import type { RouteMap, RouteContract, InferPathParams, InferBody, InferResponse } from '@mastra/server/schemas';

  type GetAgentParams = InferPathParams<RouteMap['GET /agents/:agentId']>;
  // => { agentId: string }

  type GenerateBody = InferBody<RouteMap['POST /agents/:agentId/generate']>;
  // => { messages: CoreMessage[], ... }

  type AgentResponse = InferResponse<RouteMap['GET /agents/:agentId']>;
  // => { name: string, tools: ..., ... }
  ```

### Patch Changes

- Fixed OpenAPI spec for custom route paths. Custom routes registered via `registerApiRoute` are served at the root path (e.g. `/health`), not under `/api`. The OpenAPI spec now correctly represents this so that API tools and clients using the spec will resolve them to the correct URL. ([#13930](https://github.com/mastra-ai/mastra/pull/13930))

- Fixed an unnecessary runtime dependency in `@mastra/server`, reducing install size for consumers. Moved `@mastra/schema-compat` from dependencies to devDependencies since it is only needed at build time. ([#14223](https://github.com/mastra-ai/mastra/pull/14223))

- Updated dependencies [[`ea86967`](https://github.com/mastra-ai/mastra/commit/ea86967449426e0a3673253bd1c2c052a99d970d), [`db21c21`](https://github.com/mastra-ai/mastra/commit/db21c21a6ae5f33539262cc535342fa8757eb359), [`11f5dbe`](https://github.com/mastra-ai/mastra/commit/11f5dbe9a1e7ad8ef3b1ea34fb4a9fa3631d1587), [`6751354`](https://github.com/mastra-ai/mastra/commit/67513544d1a64be891d9de7624d40aadc895d56e), [`c958cd3`](https://github.com/mastra-ai/mastra/commit/c958cd36627c1eea122ec241b2b15492977a263a), [`86f2426`](https://github.com/mastra-ai/mastra/commit/86f242631d252a172d2f9f9a2ea0feb8647a76b0), [`950eb07`](https://github.com/mastra-ai/mastra/commit/950eb07b7e7354629630e218d49550fdd299c452)]:
  - @mastra/core@1.13.0-alpha.0

## 1.12.0

### Patch Changes

- Fixed workspace filesystem permission errors returning HTTP 500 instead of 403. Permission denied errors now return the correct status code, preventing unnecessary client-side retries. ([#13804](https://github.com/mastra-ai/mastra/pull/13804))

- Updated dependencies [[`709362d`](https://github.com/mastra-ai/mastra/commit/709362d67b80d8832729bbf9e449cad27640a5d2), [`cddf895`](https://github.com/mastra-ai/mastra/commit/cddf895532b8ee7f9fa814136ec672f53d37a9ba), [`9cede11`](https://github.com/mastra-ai/mastra/commit/9cede110abac9d93072e0521bb3c8bcafb9fdadf), [`a59f126`](https://github.com/mastra-ai/mastra/commit/a59f1269104f54726699c5cdb98c72c93606d2df), [`ed8fd75`](https://github.com/mastra-ai/mastra/commit/ed8fd75cbff03bb5e19971ddb30ab7040fc60447), [`c510833`](https://github.com/mastra-ai/mastra/commit/c5108333e8cbc19dafee5f8bfefbcb5ee935335c), [`c4c7dad`](https://github.com/mastra-ai/mastra/commit/c4c7dadfe2e4584f079f6c24bfabdb8c4981827f), [`787f3ac`](https://github.com/mastra-ai/mastra/commit/787f3ac08b3bb77413645a7ab5c447fa851708fd), [`45c3112`](https://github.com/mastra-ai/mastra/commit/45c31122666a0cc56b94727099fcb1871ed1b3f6), [`7296fcc`](https://github.com/mastra-ai/mastra/commit/7296fcc599c876a68699a71c7054a16d5aaf2337), [`00c27f9`](https://github.com/mastra-ai/mastra/commit/00c27f9080731433230a61be69c44e39a7a7b4c7), [`5e7c287`](https://github.com/mastra-ai/mastra/commit/5e7c28701f2bce795dd5c811e4c3060bf2ea2242), [`7e17d3f`](https://github.com/mastra-ai/mastra/commit/7e17d3f656fdda2aad47c4beb8c491636d70820c), [`ee19c9b`](https://github.com/mastra-ai/mastra/commit/ee19c9ba3ec3ed91feb214ad539bdc766c53bb01)]:
  - @mastra/schema-compat@1.2.1
  - @mastra/core@1.12.0

## 1.12.0-alpha.1

### Patch Changes

- Fixed workspace filesystem permission errors returning HTTP 500 instead of 403. Permission denied errors now return the correct status code, preventing unnecessary client-side retries. ([#13804](https://github.com/mastra-ai/mastra/pull/13804))

- Updated dependencies [[`709362d`](https://github.com/mastra-ai/mastra/commit/709362d67b80d8832729bbf9e449cad27640a5d2), [`9cede11`](https://github.com/mastra-ai/mastra/commit/9cede110abac9d93072e0521bb3c8bcafb9fdadf), [`a59f126`](https://github.com/mastra-ai/mastra/commit/a59f1269104f54726699c5cdb98c72c93606d2df), [`c510833`](https://github.com/mastra-ai/mastra/commit/c5108333e8cbc19dafee5f8bfefbcb5ee935335c), [`7296fcc`](https://github.com/mastra-ai/mastra/commit/7296fcc599c876a68699a71c7054a16d5aaf2337), [`00c27f9`](https://github.com/mastra-ai/mastra/commit/00c27f9080731433230a61be69c44e39a7a7b4c7), [`ee19c9b`](https://github.com/mastra-ai/mastra/commit/ee19c9ba3ec3ed91feb214ad539bdc766c53bb01)]:
  - @mastra/schema-compat@1.2.1-alpha.1
  - @mastra/core@1.12.0-alpha.1

## 1.12.0-alpha.0

### Patch Changes

- Updated dependencies [[`cddf895`](https://github.com/mastra-ai/mastra/commit/cddf895532b8ee7f9fa814136ec672f53d37a9ba), [`aede3cc`](https://github.com/mastra-ai/mastra/commit/aede3cc2a83b54bbd9e9a54c8aedcd1708b2ef87), [`c4c7dad`](https://github.com/mastra-ai/mastra/commit/c4c7dadfe2e4584f079f6c24bfabdb8c4981827f), [`787f3ac`](https://github.com/mastra-ai/mastra/commit/787f3ac08b3bb77413645a7ab5c447fa851708fd), [`45c3112`](https://github.com/mastra-ai/mastra/commit/45c31122666a0cc56b94727099fcb1871ed1b3f6), [`5e7c287`](https://github.com/mastra-ai/mastra/commit/5e7c28701f2bce795dd5c811e4c3060bf2ea2242), [`7e17d3f`](https://github.com/mastra-ai/mastra/commit/7e17d3f656fdda2aad47c4beb8c491636d70820c)]:
  - @mastra/core@1.12.0-alpha.0
  - @mastra/schema-compat@1.2.1-alpha.0

## 1.11.0

### Minor Changes

- Added `onValidationError` hook to `ServerConfig` and `createRoute()`. When a request fails Zod schema validation (query parameters, request body, or path parameters), this hook lets you customize the error response — including the HTTP status code and response body — instead of the default 400 response. Set it on the server config to apply globally, or on individual routes to override per-route. All server adapters (Hono, Express, Fastify, Koa) support this hook. ([#13477](https://github.com/mastra-ai/mastra/pull/13477))

  ```ts
  const mastra = new Mastra({
    server: {
      onValidationError: (error, context) => ({
        status: 422,
        body: {
          ok: false,
          errors: error.issues.map(i => ({
            path: i.path.join('.'),
            message: i.message,
          })),
          source: context,
        },
      }),
    },
  });
  ```

- Added `requestContext` field to dataset item API endpoints and `requestContextSchema` to dataset CRUD endpoints. Added `requestContext` option to the experiment trigger endpoint, which gets forwarded to agent execution during experiments. ([#13938](https://github.com/mastra-ai/mastra/pull/13938))

  **Usage with `@mastra/client-js`:**

  ```ts
  // Create a dataset with a request context schema
  await client.createDataset({
    name: 'my-dataset',
    requestContextSchema: {
      type: 'object',
      properties: { region: { type: 'string' } },
    },
  });

  // Add an item with request context
  await client.addDatasetItem({
    datasetId: 'my-dataset',
    input: { prompt: 'Hello' },
    requestContext: { region: 'us-east-1' },
  });

  // Trigger an experiment with request context forwarded to agent
  await client.triggerDatasetExperiment({
    datasetId: 'my-dataset',
    agentId: 'my-agent',
    requestContext: { region: 'eu-west-1' },
  });
  ```

### Patch Changes

- Experiments now fail immediately with a clear error when triggered on a dataset with zero items, instead of getting stuck in "pending" status forever. The experiment trigger API returns HTTP 400 for empty datasets. Unexpected errors during async experiment setup are now logged and mark the experiment as failed. ([#14031](https://github.com/mastra-ai/mastra/pull/14031))

- Fixed `getPublicOrigin` to parse only the first value from the `X-Forwarded-Host` header. When requests pass through multiple proxies, each proxy appends its host to the header, creating a comma-separated list. The previous code used the raw value, producing a malformed URL that broke OAuth redirect URIs. Now only the first (client-facing) host is used, per RFC 7239. ([#13935](https://github.com/mastra-ai/mastra/pull/13935))

- Updated dependencies [[`4f71b43`](https://github.com/mastra-ai/mastra/commit/4f71b436a4a6b8839842d8da47b57b84509af56c), [`a070277`](https://github.com/mastra-ai/mastra/commit/a07027766ce195ba74d0783116d894cbab25d44c), [`b628b91`](https://github.com/mastra-ai/mastra/commit/b628b9128b372c0f54214d902b07279f03443900), [`332c014`](https://github.com/mastra-ai/mastra/commit/332c014e076b81edf7fe45b58205882726415e90), [`6b63153`](https://github.com/mastra-ai/mastra/commit/6b63153878ea841c0f4ce632ba66bb33e57e9c1b), [`4246e34`](https://github.com/mastra-ai/mastra/commit/4246e34cec9c26636d0965942268e6d07c346671), [`b8837ee`](https://github.com/mastra-ai/mastra/commit/b8837ee77e2e84197609762bfabd8b3da326d30c), [`866cc2c`](https://github.com/mastra-ai/mastra/commit/866cc2cb1f0e3b314afab5194f69477fada745d1), [`fb58ce1`](https://github.com/mastra-ai/mastra/commit/fb58ce1de85d57f142005c4b3b7559f909167a3f), [`5d950f7`](https://github.com/mastra-ai/mastra/commit/5d950f7bf426a215a1808f0abef7de5c8336ba1c), [`28c85b1`](https://github.com/mastra-ai/mastra/commit/28c85b184fc32b40f7f160483c982da6d388ecbd), [`e9a08fb`](https://github.com/mastra-ai/mastra/commit/e9a08fbef1ada7e50e961e2f54f55e8c10b4a45c), [`1d0a8a8`](https://github.com/mastra-ai/mastra/commit/1d0a8a8acf33203d5744fc429b090ad8598aa8ed), [`631ffd8`](https://github.com/mastra-ai/mastra/commit/631ffd82fed108648b448b28e6a90e38c5f53bf5), [`6bcbf8a`](https://github.com/mastra-ai/mastra/commit/6bcbf8a6774d5a53b21d61db8a45ce2593ca1616), [`aae2295`](https://github.com/mastra-ai/mastra/commit/aae2295838a2d329ad6640829e87934790ffe5b8), [`aa61f29`](https://github.com/mastra-ai/mastra/commit/aa61f29ff8095ce46a4ae16e46c4d8c79b2b685b), [`7ff3714`](https://github.com/mastra-ai/mastra/commit/7ff37148515439bb3be009a60e02c3e363299760), [`18c3a90`](https://github.com/mastra-ai/mastra/commit/18c3a90c9e48cf69500e308affeb8eba5860b2af), [`41d79a1`](https://github.com/mastra-ai/mastra/commit/41d79a14bd8cb6de1e2565fd0a04786bae2f211b), [`f35487b`](https://github.com/mastra-ai/mastra/commit/f35487bb2d46c636e22aa71d90025613ae38235a), [`6dc2192`](https://github.com/mastra-ai/mastra/commit/6dc21921aef0f0efab15cd0805fa3d18f277a76f), [`eeb3a3f`](https://github.com/mastra-ai/mastra/commit/eeb3a3f43aca10cf49479eed2a84b7d9ecea02ba), [`e673376`](https://github.com/mastra-ai/mastra/commit/e6733763ad1321aa7e5ae15096b9c2104f93b1f3), [`05f8d90`](https://github.com/mastra-ai/mastra/commit/05f8d9009290ce6aa03428b3add635268615db85), [`b2204c9`](https://github.com/mastra-ai/mastra/commit/b2204c98a42848bbfb6f0440f005dc2b6354f1cd), [`a1bf1e3`](https://github.com/mastra-ai/mastra/commit/a1bf1e385ed4c0ef6f11b56c5887442970d127f2), [`b6f647a`](https://github.com/mastra-ai/mastra/commit/b6f647ae2388e091f366581595feb957e37d5b40), [`0c57b8b`](https://github.com/mastra-ai/mastra/commit/0c57b8b0a69a97b5a4ae3f79be6c610f29f3cf7b), [`b081f27`](https://github.com/mastra-ai/mastra/commit/b081f272cf411716e1d6bd72ceac4bcee2657b19), [`4b8da97`](https://github.com/mastra-ai/mastra/commit/4b8da97a5ce306e97869df6c39535d9069e563db), [`0c09eac`](https://github.com/mastra-ai/mastra/commit/0c09eacb1926f64cfdc9ae5c6d63385cf8c9f72c), [`6b9b93d`](https://github.com/mastra-ai/mastra/commit/6b9b93d6f459d1ba6e36f163abf62a085ddb3d64), [`31b6067`](https://github.com/mastra-ai/mastra/commit/31b6067d0cc3ab10e1b29c36147f3b5266bc714a), [`797ac42`](https://github.com/mastra-ai/mastra/commit/797ac4276de231ad2d694d9aeca75980f6cd0419), [`aae2295`](https://github.com/mastra-ai/mastra/commit/aae2295838a2d329ad6640829e87934790ffe5b8), [`0bc289e`](https://github.com/mastra-ai/mastra/commit/0bc289e2d476bf46c5b91c21969e8d0c6864691c), [`9b75a06`](https://github.com/mastra-ai/mastra/commit/9b75a06e53ebb0b950ba7c1e83a0142047185f46), [`4c3a1b1`](https://github.com/mastra-ai/mastra/commit/4c3a1b122ea083e003d71092f30f3b31680b01c0), [`256df35`](https://github.com/mastra-ai/mastra/commit/256df3571d62beb3ad4971faa432927cc140e603), [`85cc3b3`](https://github.com/mastra-ai/mastra/commit/85cc3b3b6f32ae4b083c26498f50d5b250ba944b), [`97ea28c`](https://github.com/mastra-ai/mastra/commit/97ea28c746e9e4147d56047bbb1c4a92417a3fec), [`d567299`](https://github.com/mastra-ai/mastra/commit/d567299cf81e02bd9d5221d4bc05967d6c224161), [`716ffe6`](https://github.com/mastra-ai/mastra/commit/716ffe68bed81f7c2690bc8581b9e140f7bf1c3d), [`8296332`](https://github.com/mastra-ai/mastra/commit/8296332de21c16e3dfc3d0b2d615720a6dc88f2f), [`4df2116`](https://github.com/mastra-ai/mastra/commit/4df211619dd922c047d396ca41cd7027c8c4c8e7), [`2219c1a`](https://github.com/mastra-ai/mastra/commit/2219c1acbd21da116da877f0036ffb985a9dd5a3), [`17c4145`](https://github.com/mastra-ai/mastra/commit/17c4145166099354545582335b5252bdfdfd908b)]:
  - @mastra/core@1.11.0
  - @mastra/schema-compat@1.2.0

## 1.11.0-alpha.2

### Patch Changes

- Updated dependencies [[`1d0a8a8`](https://github.com/mastra-ai/mastra/commit/1d0a8a8acf33203d5744fc429b090ad8598aa8ed)]:
  - @mastra/core@1.11.0-alpha.2

## 1.11.0-alpha.1

### Patch Changes

- Experiments now fail immediately with a clear error when triggered on a dataset with zero items, instead of getting stuck in "pending" status forever. The experiment trigger API returns HTTP 400 for empty datasets. Unexpected errors during async experiment setup are now logged and mark the experiment as failed. ([#14031](https://github.com/mastra-ai/mastra/pull/14031))

- Updated dependencies [[`866cc2c`](https://github.com/mastra-ai/mastra/commit/866cc2cb1f0e3b314afab5194f69477fada745d1), [`6bcbf8a`](https://github.com/mastra-ai/mastra/commit/6bcbf8a6774d5a53b21d61db8a45ce2593ca1616), [`18c3a90`](https://github.com/mastra-ai/mastra/commit/18c3a90c9e48cf69500e308affeb8eba5860b2af), [`f35487b`](https://github.com/mastra-ai/mastra/commit/f35487bb2d46c636e22aa71d90025613ae38235a), [`6dc2192`](https://github.com/mastra-ai/mastra/commit/6dc21921aef0f0efab15cd0805fa3d18f277a76f), [`eeb3a3f`](https://github.com/mastra-ai/mastra/commit/eeb3a3f43aca10cf49479eed2a84b7d9ecea02ba), [`05f8d90`](https://github.com/mastra-ai/mastra/commit/05f8d9009290ce6aa03428b3add635268615db85), [`4b8da97`](https://github.com/mastra-ai/mastra/commit/4b8da97a5ce306e97869df6c39535d9069e563db), [`256df35`](https://github.com/mastra-ai/mastra/commit/256df3571d62beb3ad4971faa432927cc140e603)]:
  - @mastra/core@1.11.0-alpha.1

## 1.11.0-alpha.0

### Minor Changes

- Added `onValidationError` hook to `ServerConfig` and `createRoute()`. When a request fails Zod schema validation (query parameters, request body, or path parameters), this hook lets you customize the error response — including the HTTP status code and response body — instead of the default 400 response. Set it on the server config to apply globally, or on individual routes to override per-route. All server adapters (Hono, Express, Fastify, Koa) support this hook. ([#13477](https://github.com/mastra-ai/mastra/pull/13477))

  ```ts
  const mastra = new Mastra({
    server: {
      onValidationError: (error, context) => ({
        status: 422,
        body: {
          ok: false,
          errors: error.issues.map(i => ({
            path: i.path.join('.'),
            message: i.message,
          })),
          source: context,
        },
      }),
    },
  });
  ```

- Added `requestContext` field to dataset item API endpoints and `requestContextSchema` to dataset CRUD endpoints. Added `requestContext` option to the experiment trigger endpoint, which gets forwarded to agent execution during experiments. ([#13938](https://github.com/mastra-ai/mastra/pull/13938))

  **Usage with `@mastra/client-js`:**

  ```ts
  // Create a dataset with a request context schema
  await client.createDataset({
    name: 'my-dataset',
    requestContextSchema: {
      type: 'object',
      properties: { region: { type: 'string' } },
    },
  });

  // Add an item with request context
  await client.addDatasetItem({
    datasetId: 'my-dataset',
    input: { prompt: 'Hello' },
    requestContext: { region: 'us-east-1' },
  });

  // Trigger an experiment with request context forwarded to agent
  await client.triggerDatasetExperiment({
    datasetId: 'my-dataset',
    agentId: 'my-agent',
    requestContext: { region: 'eu-west-1' },
  });
  ```

### Patch Changes

- Fixed `getPublicOrigin` to parse only the first value from the `X-Forwarded-Host` header. When requests pass through multiple proxies, each proxy appends its host to the header, creating a comma-separated list. The previous code used the raw value, producing a malformed URL that broke OAuth redirect URIs. Now only the first (client-facing) host is used, per RFC 7239. ([#13935](https://github.com/mastra-ai/mastra/pull/13935))

- Updated dependencies [[`4f71b43`](https://github.com/mastra-ai/mastra/commit/4f71b436a4a6b8839842d8da47b57b84509af56c), [`a070277`](https://github.com/mastra-ai/mastra/commit/a07027766ce195ba74d0783116d894cbab25d44c), [`b628b91`](https://github.com/mastra-ai/mastra/commit/b628b9128b372c0f54214d902b07279f03443900), [`332c014`](https://github.com/mastra-ai/mastra/commit/332c014e076b81edf7fe45b58205882726415e90), [`6b63153`](https://github.com/mastra-ai/mastra/commit/6b63153878ea841c0f4ce632ba66bb33e57e9c1b), [`4246e34`](https://github.com/mastra-ai/mastra/commit/4246e34cec9c26636d0965942268e6d07c346671), [`b8837ee`](https://github.com/mastra-ai/mastra/commit/b8837ee77e2e84197609762bfabd8b3da326d30c), [`fb58ce1`](https://github.com/mastra-ai/mastra/commit/fb58ce1de85d57f142005c4b3b7559f909167a3f), [`5d950f7`](https://github.com/mastra-ai/mastra/commit/5d950f7bf426a215a1808f0abef7de5c8336ba1c), [`28c85b1`](https://github.com/mastra-ai/mastra/commit/28c85b184fc32b40f7f160483c982da6d388ecbd), [`e9a08fb`](https://github.com/mastra-ai/mastra/commit/e9a08fbef1ada7e50e961e2f54f55e8c10b4a45c), [`631ffd8`](https://github.com/mastra-ai/mastra/commit/631ffd82fed108648b448b28e6a90e38c5f53bf5), [`aae2295`](https://github.com/mastra-ai/mastra/commit/aae2295838a2d329ad6640829e87934790ffe5b8), [`aa61f29`](https://github.com/mastra-ai/mastra/commit/aa61f29ff8095ce46a4ae16e46c4d8c79b2b685b), [`7ff3714`](https://github.com/mastra-ai/mastra/commit/7ff37148515439bb3be009a60e02c3e363299760), [`41d79a1`](https://github.com/mastra-ai/mastra/commit/41d79a14bd8cb6de1e2565fd0a04786bae2f211b), [`e673376`](https://github.com/mastra-ai/mastra/commit/e6733763ad1321aa7e5ae15096b9c2104f93b1f3), [`b2204c9`](https://github.com/mastra-ai/mastra/commit/b2204c98a42848bbfb6f0440f005dc2b6354f1cd), [`a1bf1e3`](https://github.com/mastra-ai/mastra/commit/a1bf1e385ed4c0ef6f11b56c5887442970d127f2), [`b6f647a`](https://github.com/mastra-ai/mastra/commit/b6f647ae2388e091f366581595feb957e37d5b40), [`0c57b8b`](https://github.com/mastra-ai/mastra/commit/0c57b8b0a69a97b5a4ae3f79be6c610f29f3cf7b), [`b081f27`](https://github.com/mastra-ai/mastra/commit/b081f272cf411716e1d6bd72ceac4bcee2657b19), [`0c09eac`](https://github.com/mastra-ai/mastra/commit/0c09eacb1926f64cfdc9ae5c6d63385cf8c9f72c), [`6b9b93d`](https://github.com/mastra-ai/mastra/commit/6b9b93d6f459d1ba6e36f163abf62a085ddb3d64), [`31b6067`](https://github.com/mastra-ai/mastra/commit/31b6067d0cc3ab10e1b29c36147f3b5266bc714a), [`797ac42`](https://github.com/mastra-ai/mastra/commit/797ac4276de231ad2d694d9aeca75980f6cd0419), [`aae2295`](https://github.com/mastra-ai/mastra/commit/aae2295838a2d329ad6640829e87934790ffe5b8), [`0bc289e`](https://github.com/mastra-ai/mastra/commit/0bc289e2d476bf46c5b91c21969e8d0c6864691c), [`9b75a06`](https://github.com/mastra-ai/mastra/commit/9b75a06e53ebb0b950ba7c1e83a0142047185f46), [`4c3a1b1`](https://github.com/mastra-ai/mastra/commit/4c3a1b122ea083e003d71092f30f3b31680b01c0), [`85cc3b3`](https://github.com/mastra-ai/mastra/commit/85cc3b3b6f32ae4b083c26498f50d5b250ba944b), [`97ea28c`](https://github.com/mastra-ai/mastra/commit/97ea28c746e9e4147d56047bbb1c4a92417a3fec), [`d567299`](https://github.com/mastra-ai/mastra/commit/d567299cf81e02bd9d5221d4bc05967d6c224161), [`716ffe6`](https://github.com/mastra-ai/mastra/commit/716ffe68bed81f7c2690bc8581b9e140f7bf1c3d), [`8296332`](https://github.com/mastra-ai/mastra/commit/8296332de21c16e3dfc3d0b2d615720a6dc88f2f), [`4df2116`](https://github.com/mastra-ai/mastra/commit/4df211619dd922c047d396ca41cd7027c8c4c8e7), [`2219c1a`](https://github.com/mastra-ai/mastra/commit/2219c1acbd21da116da877f0036ffb985a9dd5a3), [`17c4145`](https://github.com/mastra-ai/mastra/commit/17c4145166099354545582335b5252bdfdfd908b)]:
  - @mastra/core@1.11.0-alpha.0
  - @mastra/schema-compat@1.2.0-alpha.0

## 1.10.0

### Patch Changes

- Added support for editing code-defined agents in the Playground CMS. When a code agent is opened in the editor, only **Instructions**, **Tools**, and **Variables** sections are shown — model, memory, workspace, and other code-defined fields are hidden since they cannot be safely serialized. ([#13727](https://github.com/mastra-ai/mastra/pull/13727))

  On first save, a stored override record is created with the same agent ID. Subsequent saves update the override. The server now applies stored overrides (instructions, tools) to code-defined agents before serializing them in `GET /agents` and `GET /agents/:id` responses.

- Fixed Studio so custom gateway models appear in the provider list. ([#13772](https://github.com/mastra-ai/mastra/pull/13772))
  Improved /agents/providers API to include both built-in providers and providers from configured custom gateways.

- Fixed dev playground auth bypass not working in capabilities endpoint. The client now passes MastraClient headers (including x-mastra-dev-playground) to the auth capabilities endpoint, and the server returns disabled state when this header is present. This prevents the login gate from appearing in dev playground mode. ([#13801](https://github.com/mastra-ai/mastra/pull/13801))

- Updated dependencies [[`41e48c1`](https://github.com/mastra-ai/mastra/commit/41e48c198eee846478e60c02ec432c19d322a517), [`82469d3`](https://github.com/mastra-ai/mastra/commit/82469d3135d5a49dd8dc8feec0ff398b4e0225a0), [`33e2fd5`](https://github.com/mastra-ai/mastra/commit/33e2fd5088f83666df17401e2da68c943dbc0448), [`7ef6e2c`](https://github.com/mastra-ai/mastra/commit/7ef6e2c61be5a42e26f55d15b5902866fc76634f), [`b12d2a5`](https://github.com/mastra-ai/mastra/commit/b12d2a59a48be0477cabae66eb6cf0fc94a7d40d), [`fa37d39`](https://github.com/mastra-ai/mastra/commit/fa37d39910421feaf8847716292e3d65dd4f30c2), [`b12d2a5`](https://github.com/mastra-ai/mastra/commit/b12d2a59a48be0477cabae66eb6cf0fc94a7d40d), [`71c38bf`](https://github.com/mastra-ai/mastra/commit/71c38bf905905148ecd0e75c07c1f9825d299b76), [`f993c38`](https://github.com/mastra-ai/mastra/commit/f993c3848c97479b813231be872443bedeced6ab), [`f51849a`](https://github.com/mastra-ai/mastra/commit/f51849a568935122b5100b7ee69704e6d680cf7b), [`9bf3a0d`](https://github.com/mastra-ai/mastra/commit/9bf3a0dac602787925f1762f1f0387d7b4a59620), [`cafa045`](https://github.com/mastra-ai/mastra/commit/cafa0453c9de141ad50c09a13894622dffdd9978), [`1fd9ddb`](https://github.com/mastra-ai/mastra/commit/1fd9ddbb3fe83b281b12bd2e27e426ae86288266), [`6135ef4`](https://github.com/mastra-ai/mastra/commit/6135ef4f5288652bf45f616ec590607e4c95f443), [`d9d228c`](https://github.com/mastra-ai/mastra/commit/d9d228c0c6ae82ae6ce3b540a3a56b2b1c2b8d98), [`5576507`](https://github.com/mastra-ai/mastra/commit/55765071e360fb97e443aa0a91ccf7e1cd8d92aa), [`79d69c9`](https://github.com/mastra-ai/mastra/commit/79d69c9d5f842ff1c31352fb6026f04c1f6190f3), [`94f44b8`](https://github.com/mastra-ai/mastra/commit/94f44b827ce57b179e50f4916a84c0fa6e7f3b8c), [`13187db`](https://github.com/mastra-ai/mastra/commit/13187dbac880174232dedc5a501ff6c5d0fe59bc), [`2ae5311`](https://github.com/mastra-ai/mastra/commit/2ae531185fff66a80fa165c0999e3d801900e89d), [`6135ef4`](https://github.com/mastra-ai/mastra/commit/6135ef4f5288652bf45f616ec590607e4c95f443)]:
  - @mastra/core@1.10.0

## 1.10.0-alpha.0

### Patch Changes

- Added support for editing code-defined agents in the Playground CMS. When a code agent is opened in the editor, only **Instructions**, **Tools**, and **Variables** sections are shown — model, memory, workspace, and other code-defined fields are hidden since they cannot be safely serialized. ([#13727](https://github.com/mastra-ai/mastra/pull/13727))

  On first save, a stored override record is created with the same agent ID. Subsequent saves update the override. The server now applies stored overrides (instructions, tools) to code-defined agents before serializing them in `GET /agents` and `GET /agents/:id` responses.

- Fixed Studio so custom gateway models appear in the provider list. ([#13772](https://github.com/mastra-ai/mastra/pull/13772))
  Improved /agents/providers API to include both built-in providers and providers from configured custom gateways.

- Fixed dev playground auth bypass not working in capabilities endpoint. The client now passes MastraClient headers (including x-mastra-dev-playground) to the auth capabilities endpoint, and the server returns disabled state when this header is present. This prevents the login gate from appearing in dev playground mode. ([#13801](https://github.com/mastra-ai/mastra/pull/13801))

- Updated dependencies [[`41e48c1`](https://github.com/mastra-ai/mastra/commit/41e48c198eee846478e60c02ec432c19d322a517), [`82469d3`](https://github.com/mastra-ai/mastra/commit/82469d3135d5a49dd8dc8feec0ff398b4e0225a0), [`33e2fd5`](https://github.com/mastra-ai/mastra/commit/33e2fd5088f83666df17401e2da68c943dbc0448), [`7ef6e2c`](https://github.com/mastra-ai/mastra/commit/7ef6e2c61be5a42e26f55d15b5902866fc76634f), [`b12d2a5`](https://github.com/mastra-ai/mastra/commit/b12d2a59a48be0477cabae66eb6cf0fc94a7d40d), [`fa37d39`](https://github.com/mastra-ai/mastra/commit/fa37d39910421feaf8847716292e3d65dd4f30c2), [`b12d2a5`](https://github.com/mastra-ai/mastra/commit/b12d2a59a48be0477cabae66eb6cf0fc94a7d40d), [`71c38bf`](https://github.com/mastra-ai/mastra/commit/71c38bf905905148ecd0e75c07c1f9825d299b76), [`f993c38`](https://github.com/mastra-ai/mastra/commit/f993c3848c97479b813231be872443bedeced6ab), [`f51849a`](https://github.com/mastra-ai/mastra/commit/f51849a568935122b5100b7ee69704e6d680cf7b), [`9bf3a0d`](https://github.com/mastra-ai/mastra/commit/9bf3a0dac602787925f1762f1f0387d7b4a59620), [`cafa045`](https://github.com/mastra-ai/mastra/commit/cafa0453c9de141ad50c09a13894622dffdd9978), [`1fd9ddb`](https://github.com/mastra-ai/mastra/commit/1fd9ddbb3fe83b281b12bd2e27e426ae86288266), [`6135ef4`](https://github.com/mastra-ai/mastra/commit/6135ef4f5288652bf45f616ec590607e4c95f443), [`d9d228c`](https://github.com/mastra-ai/mastra/commit/d9d228c0c6ae82ae6ce3b540a3a56b2b1c2b8d98), [`5576507`](https://github.com/mastra-ai/mastra/commit/55765071e360fb97e443aa0a91ccf7e1cd8d92aa), [`79d69c9`](https://github.com/mastra-ai/mastra/commit/79d69c9d5f842ff1c31352fb6026f04c1f6190f3), [`94f44b8`](https://github.com/mastra-ai/mastra/commit/94f44b827ce57b179e50f4916a84c0fa6e7f3b8c), [`13187db`](https://github.com/mastra-ai/mastra/commit/13187dbac880174232dedc5a501ff6c5d0fe59bc), [`2ae5311`](https://github.com/mastra-ai/mastra/commit/2ae531185fff66a80fa165c0999e3d801900e89d), [`6135ef4`](https://github.com/mastra-ai/mastra/commit/6135ef4f5288652bf45f616ec590607e4c95f443)]:
  - @mastra/core@1.10.0-alpha.0

## 1.9.0

### Minor Changes

- Added auth handlers and route-level permission enforcement to the server. ([#13163](https://github.com/mastra-ai/mastra/pull/13163))

  **Auth API routes** for login, signup, logout, session validation, and SSO flows — all wired automatically when an auth provider is configured on the Mastra instance.

  **Route-level permission enforcement** via `requiresPermission` in route configs. Permissions are derived automatically from the route path and HTTP method using a convention-based system (`{resource}:{action}`), so most routes are protected without any manual configuration:

  ```ts
  // Automatic: GET /api/agents → requires "agents:read"
  // Automatic: POST /api/workflows/:id/execute → requires "workflows:execute"

  // Or specify explicitly:
  const route = {
    path: '/api/custom',
    method: 'POST',
    requiresPermission: 'custom:write',
    handler: myHandler,
  };
  ```

### Patch Changes

- Fixed CMS features (Create an agent button, clone, edit, create scorer) not appearing in built output. The build command now writes package metadata so the studio can detect installed Mastra packages at runtime. ([#13163](https://github.com/mastra-ai/mastra/pull/13163))

- Added HTTP request logging infrastructure. This enables `apiReqLogs: true` (or a detailed `HttpLoggingConfig`) in the server config to log method, path, status, and duration for every request, with optional header redaction and path exclusions. ([#11907](https://github.com/mastra-ai/mastra/pull/11907))

  **Simple activation**

  ```ts
  const mastra = new Mastra({
    server: { build: { apiReqLogs: true } },
  });
  ```

  **Advanced configuration**

  ```ts
  const mastra = new Mastra({
    server: {
      build: {
        apiReqLogs: {
          enabled: true,
          level: 'info',
          excludePaths: ['/health', '/ready'],
          includeHeaders: true,
          includeQueryParams: true,
          redactHeaders: ['authorization', 'cookie'],
        },
      },
    },
  });
  ```

- Updated dependencies [[`504fc8b`](https://github.com/mastra-ai/mastra/commit/504fc8b9d0ddab717577ad3bf9c95ea4bd5377bd), [`f9c150b`](https://github.com/mastra-ai/mastra/commit/f9c150b7595ad05ad9cc9a11098e2944361e8c22), [`88de7e8`](https://github.com/mastra-ai/mastra/commit/88de7e8dfe4b7e1951a9e441bb33136e705ce24e), [`edee4b3`](https://github.com/mastra-ai/mastra/commit/edee4b37dff0af515fc7cc0e8d71ee39e6a762f0), [`3790c75`](https://github.com/mastra-ai/mastra/commit/3790c7578cc6a47d854eb12d89e6b1912867fe29), [`e7a235b`](https://github.com/mastra-ai/mastra/commit/e7a235be6472e0c870ed6c791ddb17c492dc188b), [`d51d298`](https://github.com/mastra-ai/mastra/commit/d51d298953967aab1f58ec965b644d109214f085), [`6dbeeb9`](https://github.com/mastra-ai/mastra/commit/6dbeeb94a8b1eebb727300d1a98961f882180794), [`d5f0d8d`](https://github.com/mastra-ai/mastra/commit/d5f0d8d6a03e515ddaa9b5da19b7e44b8357b07b), [`09c3b18`](https://github.com/mastra-ai/mastra/commit/09c3b1802ff14e243a8a8baea327440bc8cc2e32), [`b896379`](https://github.com/mastra-ai/mastra/commit/b8963791c6afa79484645fcec596a201f936b9a2), [`85c84eb`](https://github.com/mastra-ai/mastra/commit/85c84ebb78aebfcba9d209c8e152b16d7a00cb71), [`a89272a`](https://github.com/mastra-ai/mastra/commit/a89272a5d71939b9fcd284e6a6dc1dd091a6bdcf), [`ee9c8df`](https://github.com/mastra-ai/mastra/commit/ee9c8df644f19d055af5f496bf4942705f5a47b7), [`77b4a25`](https://github.com/mastra-ai/mastra/commit/77b4a254e51907f8ff3a3ba95596a18e93ae4b35), [`276246e`](https://github.com/mastra-ai/mastra/commit/276246e0b9066a1ea48bbc70df84dbe528daaf99), [`08ecfdb`](https://github.com/mastra-ai/mastra/commit/08ecfdbdad6fb8285deef86a034bdf4a6047cfca), [`d5f628c`](https://github.com/mastra-ai/mastra/commit/d5f628ca86c6f6f3ff1035d52f635df32dd81cab), [`524c0f3`](https://github.com/mastra-ai/mastra/commit/524c0f3c434c3d9d18f66338dcef383d6161b59c), [`c18a0e9`](https://github.com/mastra-ai/mastra/commit/c18a0e9cef1e4ca004b2963d35e4cfc031971eac), [`4bd21ea`](https://github.com/mastra-ai/mastra/commit/4bd21ea43d44d0a0427414fc047577f9f0aa3bec), [`115a7a4`](https://github.com/mastra-ai/mastra/commit/115a7a47db5e9896fec12ae6507501adb9ec89bf), [`22a48ae`](https://github.com/mastra-ai/mastra/commit/22a48ae2513eb54d8d79dad361fddbca97a155e8), [`3c6ef79`](https://github.com/mastra-ai/mastra/commit/3c6ef798481e00d6d22563be2de98818fd4dd5e0), [`9311c17`](https://github.com/mastra-ai/mastra/commit/9311c17d7a0640d9c4da2e71b814dc67c57c6369), [`7edf78f`](https://github.com/mastra-ai/mastra/commit/7edf78f80422c43e84585f08ba11df0d4d0b73c5), [`1c4221c`](https://github.com/mastra-ai/mastra/commit/1c4221cf6032ec98d0e094d4ee11da3e48490d96), [`d25b9ea`](https://github.com/mastra-ai/mastra/commit/d25b9eabd400167255a97b690ffbc4ee4097ded5), [`fe1ce5c`](https://github.com/mastra-ai/mastra/commit/fe1ce5c9211c03d561606fda95cbfe7df1d9a9b5), [`b03c0e0`](https://github.com/mastra-ai/mastra/commit/b03c0e0389a799523929a458b0509c9e4244d562), [`0a8366b`](https://github.com/mastra-ai/mastra/commit/0a8366b0a692fcdde56c4d526e4cf03c502ae4ac), [`85664e9`](https://github.com/mastra-ai/mastra/commit/85664e9fd857320fbc245e301f764f45f66f32a3), [`bc79650`](https://github.com/mastra-ai/mastra/commit/bc796500c6e0334faa158a96077e3fb332274869), [`9257d01`](https://github.com/mastra-ai/mastra/commit/9257d01d1366d81f84c582fe02b5e200cf9621f4), [`3a3a59e`](https://github.com/mastra-ai/mastra/commit/3a3a59e8ffaa6a985fe3d9a126a3f5ade11a6724), [`3108d4e`](https://github.com/mastra-ai/mastra/commit/3108d4e649c9fddbf03253a6feeb388a5fa9fa5a), [`0c33b2c`](https://github.com/mastra-ai/mastra/commit/0c33b2c9db537f815e1c59e2c898ffce2e395a79), [`191e5bd`](https://github.com/mastra-ai/mastra/commit/191e5bd29b82f5bda35243945790da7bc7b695c2), [`f77cd94`](https://github.com/mastra-ai/mastra/commit/f77cd94c44eabed490384e7d19232a865e13214c), [`e8135c7`](https://github.com/mastra-ai/mastra/commit/e8135c7e300dac5040670eec7eab896ac6092e30), [`daca48f`](https://github.com/mastra-ai/mastra/commit/daca48f0fb17b7ae0b62a2ac40cf0e491b2fd0b7), [`257d14f`](https://github.com/mastra-ai/mastra/commit/257d14faca5931f2e4186fc165b6f0b1f915deee), [`352f25d`](https://github.com/mastra-ai/mastra/commit/352f25da316b24cdd5b410fd8dddf6a8b763da2a), [`93477d0`](https://github.com/mastra-ai/mastra/commit/93477d0769b8a13ea5ed73d508d967fb23eaeed9), [`31c78b3`](https://github.com/mastra-ai/mastra/commit/31c78b3eb28f58a8017f1dcc795c33214d87feac), [`0bc0720`](https://github.com/mastra-ai/mastra/commit/0bc07201095791858087cc56f353fcd65e87ab54), [`36516ac`](https://github.com/mastra-ai/mastra/commit/36516aca1021cbeb42e74751b46a2614101f37c8), [`e947652`](https://github.com/mastra-ai/mastra/commit/e9476527fdecb4449e54570e80dfaf8466901254), [`3c6ef79`](https://github.com/mastra-ai/mastra/commit/3c6ef798481e00d6d22563be2de98818fd4dd5e0), [`9257d01`](https://github.com/mastra-ai/mastra/commit/9257d01d1366d81f84c582fe02b5e200cf9621f4), [`ec248f6`](https://github.com/mastra-ai/mastra/commit/ec248f6b56e8a037c066c49b2178e2507471d988)]:
  - @mastra/core@1.9.0

## 1.9.0-alpha.0

### Minor Changes

- Added auth handlers and route-level permission enforcement to the server. ([#13163](https://github.com/mastra-ai/mastra/pull/13163))

  **Auth API routes** for login, signup, logout, session validation, and SSO flows — all wired automatically when an auth provider is configured on the Mastra instance.

  **Route-level permission enforcement** via `requiresPermission` in route configs. Permissions are derived automatically from the route path and HTTP method using a convention-based system (`{resource}:{action}`), so most routes are protected without any manual configuration:

  ```ts
  // Automatic: GET /api/agents → requires "agents:read"
  // Automatic: POST /api/workflows/:id/execute → requires "workflows:execute"

  // Or specify explicitly:
  const route = {
    path: '/api/custom',
    method: 'POST',
    requiresPermission: 'custom:write',
    handler: myHandler,
  };
  ```

### Patch Changes

- Fixed CMS features (Create an agent button, clone, edit, create scorer) not appearing in built output. The build command now writes package metadata so the studio can detect installed Mastra packages at runtime. ([#13163](https://github.com/mastra-ai/mastra/pull/13163))

- Added HTTP request logging infrastructure. This enables `apiReqLogs: true` (or a detailed `HttpLoggingConfig`) in the server config to log method, path, status, and duration for every request, with optional header redaction and path exclusions. ([#11907](https://github.com/mastra-ai/mastra/pull/11907))

  **Simple activation**

  ```ts
  const mastra = new Mastra({
    server: { build: { apiReqLogs: true } },
  });
  ```

  **Advanced configuration**

  ```ts
  const mastra = new Mastra({
    server: {
      build: {
        apiReqLogs: {
          enabled: true,
          level: 'info',
          excludePaths: ['/health', '/ready'],
          includeHeaders: true,
          includeQueryParams: true,
          redactHeaders: ['authorization', 'cookie'],
        },
      },
    },
  });
  ```

- Updated dependencies [[`504fc8b`](https://github.com/mastra-ai/mastra/commit/504fc8b9d0ddab717577ad3bf9c95ea4bd5377bd), [`f9c150b`](https://github.com/mastra-ai/mastra/commit/f9c150b7595ad05ad9cc9a11098e2944361e8c22), [`88de7e8`](https://github.com/mastra-ai/mastra/commit/88de7e8dfe4b7e1951a9e441bb33136e705ce24e), [`edee4b3`](https://github.com/mastra-ai/mastra/commit/edee4b37dff0af515fc7cc0e8d71ee39e6a762f0), [`3790c75`](https://github.com/mastra-ai/mastra/commit/3790c7578cc6a47d854eb12d89e6b1912867fe29), [`e7a235b`](https://github.com/mastra-ai/mastra/commit/e7a235be6472e0c870ed6c791ddb17c492dc188b), [`d51d298`](https://github.com/mastra-ai/mastra/commit/d51d298953967aab1f58ec965b644d109214f085), [`6dbeeb9`](https://github.com/mastra-ai/mastra/commit/6dbeeb94a8b1eebb727300d1a98961f882180794), [`d5f0d8d`](https://github.com/mastra-ai/mastra/commit/d5f0d8d6a03e515ddaa9b5da19b7e44b8357b07b), [`09c3b18`](https://github.com/mastra-ai/mastra/commit/09c3b1802ff14e243a8a8baea327440bc8cc2e32), [`b896379`](https://github.com/mastra-ai/mastra/commit/b8963791c6afa79484645fcec596a201f936b9a2), [`85c84eb`](https://github.com/mastra-ai/mastra/commit/85c84ebb78aebfcba9d209c8e152b16d7a00cb71), [`a89272a`](https://github.com/mastra-ai/mastra/commit/a89272a5d71939b9fcd284e6a6dc1dd091a6bdcf), [`ee9c8df`](https://github.com/mastra-ai/mastra/commit/ee9c8df644f19d055af5f496bf4942705f5a47b7), [`77b4a25`](https://github.com/mastra-ai/mastra/commit/77b4a254e51907f8ff3a3ba95596a18e93ae4b35), [`276246e`](https://github.com/mastra-ai/mastra/commit/276246e0b9066a1ea48bbc70df84dbe528daaf99), [`08ecfdb`](https://github.com/mastra-ai/mastra/commit/08ecfdbdad6fb8285deef86a034bdf4a6047cfca), [`d5f628c`](https://github.com/mastra-ai/mastra/commit/d5f628ca86c6f6f3ff1035d52f635df32dd81cab), [`524c0f3`](https://github.com/mastra-ai/mastra/commit/524c0f3c434c3d9d18f66338dcef383d6161b59c), [`c18a0e9`](https://github.com/mastra-ai/mastra/commit/c18a0e9cef1e4ca004b2963d35e4cfc031971eac), [`4bd21ea`](https://github.com/mastra-ai/mastra/commit/4bd21ea43d44d0a0427414fc047577f9f0aa3bec), [`115a7a4`](https://github.com/mastra-ai/mastra/commit/115a7a47db5e9896fec12ae6507501adb9ec89bf), [`22a48ae`](https://github.com/mastra-ai/mastra/commit/22a48ae2513eb54d8d79dad361fddbca97a155e8), [`3c6ef79`](https://github.com/mastra-ai/mastra/commit/3c6ef798481e00d6d22563be2de98818fd4dd5e0), [`9311c17`](https://github.com/mastra-ai/mastra/commit/9311c17d7a0640d9c4da2e71b814dc67c57c6369), [`7edf78f`](https://github.com/mastra-ai/mastra/commit/7edf78f80422c43e84585f08ba11df0d4d0b73c5), [`1c4221c`](https://github.com/mastra-ai/mastra/commit/1c4221cf6032ec98d0e094d4ee11da3e48490d96), [`d25b9ea`](https://github.com/mastra-ai/mastra/commit/d25b9eabd400167255a97b690ffbc4ee4097ded5), [`fe1ce5c`](https://github.com/mastra-ai/mastra/commit/fe1ce5c9211c03d561606fda95cbfe7df1d9a9b5), [`b03c0e0`](https://github.com/mastra-ai/mastra/commit/b03c0e0389a799523929a458b0509c9e4244d562), [`0a8366b`](https://github.com/mastra-ai/mastra/commit/0a8366b0a692fcdde56c4d526e4cf03c502ae4ac), [`85664e9`](https://github.com/mastra-ai/mastra/commit/85664e9fd857320fbc245e301f764f45f66f32a3), [`bc79650`](https://github.com/mastra-ai/mastra/commit/bc796500c6e0334faa158a96077e3fb332274869), [`9257d01`](https://github.com/mastra-ai/mastra/commit/9257d01d1366d81f84c582fe02b5e200cf9621f4), [`3a3a59e`](https://github.com/mastra-ai/mastra/commit/3a3a59e8ffaa6a985fe3d9a126a3f5ade11a6724), [`3108d4e`](https://github.com/mastra-ai/mastra/commit/3108d4e649c9fddbf03253a6feeb388a5fa9fa5a), [`0c33b2c`](https://github.com/mastra-ai/mastra/commit/0c33b2c9db537f815e1c59e2c898ffce2e395a79), [`191e5bd`](https://github.com/mastra-ai/mastra/commit/191e5bd29b82f5bda35243945790da7bc7b695c2), [`f77cd94`](https://github.com/mastra-ai/mastra/commit/f77cd94c44eabed490384e7d19232a865e13214c), [`e8135c7`](https://github.com/mastra-ai/mastra/commit/e8135c7e300dac5040670eec7eab896ac6092e30), [`daca48f`](https://github.com/mastra-ai/mastra/commit/daca48f0fb17b7ae0b62a2ac40cf0e491b2fd0b7), [`257d14f`](https://github.com/mastra-ai/mastra/commit/257d14faca5931f2e4186fc165b6f0b1f915deee), [`352f25d`](https://github.com/mastra-ai/mastra/commit/352f25da316b24cdd5b410fd8dddf6a8b763da2a), [`93477d0`](https://github.com/mastra-ai/mastra/commit/93477d0769b8a13ea5ed73d508d967fb23eaeed9), [`31c78b3`](https://github.com/mastra-ai/mastra/commit/31c78b3eb28f58a8017f1dcc795c33214d87feac), [`0bc0720`](https://github.com/mastra-ai/mastra/commit/0bc07201095791858087cc56f353fcd65e87ab54), [`36516ac`](https://github.com/mastra-ai/mastra/commit/36516aca1021cbeb42e74751b46a2614101f37c8), [`e947652`](https://github.com/mastra-ai/mastra/commit/e9476527fdecb4449e54570e80dfaf8466901254), [`3c6ef79`](https://github.com/mastra-ai/mastra/commit/3c6ef798481e00d6d22563be2de98818fd4dd5e0), [`9257d01`](https://github.com/mastra-ai/mastra/commit/9257d01d1366d81f84c582fe02b5e200cf9621f4), [`ec248f6`](https://github.com/mastra-ai/mastra/commit/ec248f6b56e8a037c066c49b2178e2507471d988)]:
  - @mastra/core@1.9.0-alpha.0

## 1.8.0

### Patch Changes

- Fixed the skill reference endpoint (`GET /workspaces/:workspaceId/skills/:skillName/references/:referencePath`) returning 404 for valid reference files. ([#13506](https://github.com/mastra-ai/mastra/pull/13506))

- Fixed `GET /api/workspaces` returning `source: 'mastra'` for all workspaces. Agent workspaces now correctly return `source: 'agent'` with `agentId` and `agentName` populated. ([#13468](https://github.com/mastra-ai/mastra/pull/13468))

- Fixed /tools API endpoint crashing with provider-defined tools (e.g. `google.tools.googleSearch()`, `openai.tools.webSearch()`). These tools have a lazy `inputSchema` that is not a Zod schema, which caused `zodToJsonSchema` to throw `"Cannot read properties of undefined (reading 'typeName')"`. ([#13507](https://github.com/mastra-ai/mastra/pull/13507))

- Updated dependencies [[`df170fd`](https://github.com/mastra-ai/mastra/commit/df170fd139b55f845bfd2de8488b16435bd3d0da), [`ae55343`](https://github.com/mastra-ai/mastra/commit/ae5534397fc006fd6eef3e4f80c235bcdc9289ef), [`c290cec`](https://github.com/mastra-ai/mastra/commit/c290cec5bf9107225de42942b56b487107aa9dce), [`f03e794`](https://github.com/mastra-ai/mastra/commit/f03e794630f812b56e95aad54f7b1993dc003add), [`aa4a5ae`](https://github.com/mastra-ai/mastra/commit/aa4a5aedb80d8d6837bab8cbb2e301215d1ba3e9), [`de3f584`](https://github.com/mastra-ai/mastra/commit/de3f58408752a8d80a295275c7f23fc306cf7f4f), [`d3fb010`](https://github.com/mastra-ai/mastra/commit/d3fb010c98f575f1c0614452667396e2653815f6), [`702ee1c`](https://github.com/mastra-ai/mastra/commit/702ee1c41be67cc532b4dbe89bcb62143508f6f0), [`f495051`](https://github.com/mastra-ai/mastra/commit/f495051eb6496a720f637fc85b6d69941c12554c), [`e622f1d`](https://github.com/mastra-ai/mastra/commit/e622f1d3ab346a8e6aca6d1fe2eac99bd961e50b), [`861f111`](https://github.com/mastra-ai/mastra/commit/861f11189211b20ddb70d8df81a6b901fc78d11e), [`00f43e8`](https://github.com/mastra-ai/mastra/commit/00f43e8e97a80c82b27d5bd30494f10a715a1df9), [`1b6f651`](https://github.com/mastra-ai/mastra/commit/1b6f65127d4a0d6c38d0a1055cb84527db529d6b), [`96a1702`](https://github.com/mastra-ai/mastra/commit/96a1702ce362c50dda20c8b4a228b4ad1a36a17a), [`cb9f921`](https://github.com/mastra-ai/mastra/commit/cb9f921320913975657abb1404855d8c510f7ac5), [`114e7c1`](https://github.com/mastra-ai/mastra/commit/114e7c146ac682925f0fb37376c1be70e5d6e6e5), [`1b6f651`](https://github.com/mastra-ai/mastra/commit/1b6f65127d4a0d6c38d0a1055cb84527db529d6b), [`72df4a8`](https://github.com/mastra-ai/mastra/commit/72df4a8f9bf1a20cfd3d9006a4fdb597ad56d10a)]:
  - @mastra/core@1.8.0

## 1.8.0-alpha.0

### Patch Changes

- Fixed the skill reference endpoint (`GET /workspaces/:workspaceId/skills/:skillName/references/:referencePath`) returning 404 for valid reference files. ([#13506](https://github.com/mastra-ai/mastra/pull/13506))

- Fixed `GET /api/workspaces` returning `source: 'mastra'` for all workspaces. Agent workspaces now correctly return `source: 'agent'` with `agentId` and `agentName` populated. ([#13468](https://github.com/mastra-ai/mastra/pull/13468))

- Fixed /tools API endpoint crashing with provider-defined tools (e.g. `google.tools.googleSearch()`, `openai.tools.webSearch()`). These tools have a lazy `inputSchema` that is not a Zod schema, which caused `zodToJsonSchema` to throw `"Cannot read properties of undefined (reading 'typeName')"`. ([#13507](https://github.com/mastra-ai/mastra/pull/13507))

- Updated dependencies [[`df170fd`](https://github.com/mastra-ai/mastra/commit/df170fd139b55f845bfd2de8488b16435bd3d0da), [`ae55343`](https://github.com/mastra-ai/mastra/commit/ae5534397fc006fd6eef3e4f80c235bcdc9289ef), [`c290cec`](https://github.com/mastra-ai/mastra/commit/c290cec5bf9107225de42942b56b487107aa9dce), [`f03e794`](https://github.com/mastra-ai/mastra/commit/f03e794630f812b56e95aad54f7b1993dc003add), [`aa4a5ae`](https://github.com/mastra-ai/mastra/commit/aa4a5aedb80d8d6837bab8cbb2e301215d1ba3e9), [`de3f584`](https://github.com/mastra-ai/mastra/commit/de3f58408752a8d80a295275c7f23fc306cf7f4f), [`d3fb010`](https://github.com/mastra-ai/mastra/commit/d3fb010c98f575f1c0614452667396e2653815f6), [`702ee1c`](https://github.com/mastra-ai/mastra/commit/702ee1c41be67cc532b4dbe89bcb62143508f6f0), [`f495051`](https://github.com/mastra-ai/mastra/commit/f495051eb6496a720f637fc85b6d69941c12554c), [`e622f1d`](https://github.com/mastra-ai/mastra/commit/e622f1d3ab346a8e6aca6d1fe2eac99bd961e50b), [`861f111`](https://github.com/mastra-ai/mastra/commit/861f11189211b20ddb70d8df81a6b901fc78d11e), [`00f43e8`](https://github.com/mastra-ai/mastra/commit/00f43e8e97a80c82b27d5bd30494f10a715a1df9), [`1b6f651`](https://github.com/mastra-ai/mastra/commit/1b6f65127d4a0d6c38d0a1055cb84527db529d6b), [`96a1702`](https://github.com/mastra-ai/mastra/commit/96a1702ce362c50dda20c8b4a228b4ad1a36a17a), [`cb9f921`](https://github.com/mastra-ai/mastra/commit/cb9f921320913975657abb1404855d8c510f7ac5), [`114e7c1`](https://github.com/mastra-ai/mastra/commit/114e7c146ac682925f0fb37376c1be70e5d6e6e5), [`1b6f651`](https://github.com/mastra-ai/mastra/commit/1b6f65127d4a0d6c38d0a1055cb84527db529d6b), [`72df4a8`](https://github.com/mastra-ai/mastra/commit/72df4a8f9bf1a20cfd3d9006a4fdb597ad56d10a)]:
  - @mastra/core@1.8.0-alpha.0

## 1.7.0

### Minor Changes

- Prompt blocks can now define their own variables schema (`requestContextSchema`), allowing you to create reusable prompt blocks with typed variable placeholders. The server now correctly computes and returns draft/published status for prompt blocks. Existing databases are automatically migrated when upgrading. ([#13351](https://github.com/mastra-ai/mastra/pull/13351))

### Patch Changes

- Updated dependencies [[`24284ff`](https://github.com/mastra-ai/mastra/commit/24284ffae306ddf0ab83273e13f033520839ef40), [`f5097cc`](https://github.com/mastra-ai/mastra/commit/f5097cc8a813c82c3378882c31178320cadeb655), [`71e237f`](https://github.com/mastra-ai/mastra/commit/71e237fa852a3ad9a50a3ddb3b5f3b20b9a8181c), [`13a291e`](https://github.com/mastra-ai/mastra/commit/13a291ebb9f9bca80befa0d9166b916bb348e8e9), [`397af5a`](https://github.com/mastra-ai/mastra/commit/397af5a69f34d4157f51a7c8da3f1ded1e1d611c), [`d4701f7`](https://github.com/mastra-ai/mastra/commit/d4701f7e24822b081b70f9c806c39411b1a712e7), [`2b40831`](https://github.com/mastra-ai/mastra/commit/2b40831dcca2275c9570ddf09b7f25ba3e8dc7fc), [`6184727`](https://github.com/mastra-ai/mastra/commit/6184727e812bf7a65cee209bacec3a2f5a16e923), [`0c338b8`](https://github.com/mastra-ai/mastra/commit/0c338b87362dcd95ff8191ca00df645b6953f534), [`6f6385b`](https://github.com/mastra-ai/mastra/commit/6f6385be5b33687cd21e71fc27e972e6928bb34c), [`14aba61`](https://github.com/mastra-ai/mastra/commit/14aba61b9cff76d72bc7ef6f3a83ae2c5d059193), [`dd9dd1c`](https://github.com/mastra-ai/mastra/commit/dd9dd1c9ae32ae79093f8c4adde1732ac6357233)]:
  - @mastra/core@1.7.0

## 1.7.0-alpha.0

### Minor Changes

- Prompt blocks can now define their own variables schema (`requestContextSchema`), allowing you to create reusable prompt blocks with typed variable placeholders. The server now correctly computes and returns draft/published status for prompt blocks. Existing databases are automatically migrated when upgrading. ([#13351](https://github.com/mastra-ai/mastra/pull/13351))

### Patch Changes

- Updated dependencies [[`24284ff`](https://github.com/mastra-ai/mastra/commit/24284ffae306ddf0ab83273e13f033520839ef40), [`f5097cc`](https://github.com/mastra-ai/mastra/commit/f5097cc8a813c82c3378882c31178320cadeb655), [`71e237f`](https://github.com/mastra-ai/mastra/commit/71e237fa852a3ad9a50a3ddb3b5f3b20b9a8181c), [`13a291e`](https://github.com/mastra-ai/mastra/commit/13a291ebb9f9bca80befa0d9166b916bb348e8e9), [`397af5a`](https://github.com/mastra-ai/mastra/commit/397af5a69f34d4157f51a7c8da3f1ded1e1d611c), [`d4701f7`](https://github.com/mastra-ai/mastra/commit/d4701f7e24822b081b70f9c806c39411b1a712e7), [`2b40831`](https://github.com/mastra-ai/mastra/commit/2b40831dcca2275c9570ddf09b7f25ba3e8dc7fc), [`6184727`](https://github.com/mastra-ai/mastra/commit/6184727e812bf7a65cee209bacec3a2f5a16e923), [`6f6385b`](https://github.com/mastra-ai/mastra/commit/6f6385be5b33687cd21e71fc27e972e6928bb34c), [`14aba61`](https://github.com/mastra-ai/mastra/commit/14aba61b9cff76d72bc7ef6f3a83ae2c5d059193), [`dd9dd1c`](https://github.com/mastra-ai/mastra/commit/dd9dd1c9ae32ae79093f8c4adde1732ac6357233)]:
  - @mastra/core@1.7.0-alpha.0

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

### Patch Changes

- Added skill editing and workspace support in the agent CMS. Agents can now toggle skills on/off and associate a workspace. Fixed auto-versioning to compare against the latest draft version instead of the published one, preventing stale draft configs from being returned after saves. ([#13314](https://github.com/mastra-ai/mastra/pull/13314))

- Fixed recursive schema warnings for processor graph entries by unrolling to a fixed depth of 3 levels, matching the existing rule group pattern ([#13292](https://github.com/mastra-ai/mastra/pull/13292))

- Workspace tools like `ast_edit` are now correctly detected at runtime based on available dependencies (e.g. `@ast-grep/napi`), preventing missing tools from being advertised to agents. ([#13233](https://github.com/mastra-ai/mastra/pull/13233))

- Updated dependencies [[`0d9efb4`](https://github.com/mastra-ai/mastra/commit/0d9efb47992c34aa90581c18b9f51f774f6252a5), [`5caa13d`](https://github.com/mastra-ai/mastra/commit/5caa13d1b2a496e2565ab124a11de9a51ad3e3b9), [`940163f`](https://github.com/mastra-ai/mastra/commit/940163fc492401d7562301e6f106ccef4fefe06f), [`47892c8`](https://github.com/mastra-ai/mastra/commit/47892c85708eac348209f99f10f9a5f5267e11c0), [`45bb78b`](https://github.com/mastra-ai/mastra/commit/45bb78b70bd9db29678fe49476cd9f4ed01bfd0b), [`70eef84`](https://github.com/mastra-ai/mastra/commit/70eef84b8f44493598fdafa2980a0e7283415eda), [`d84e52d`](https://github.com/mastra-ai/mastra/commit/d84e52d0f6511283ddd21ed5fe7f945449d0f799), [`24b80af`](https://github.com/mastra-ai/mastra/commit/24b80af87da93bb84d389340181e17b7477fa9ca), [`608e156`](https://github.com/mastra-ai/mastra/commit/608e156def954c9604c5e3f6d9dfce3bcc7aeab0), [`2b2e157`](https://github.com/mastra-ai/mastra/commit/2b2e157a092cd597d9d3f0000d62b8bb4a7348ed), [`59d30b5`](https://github.com/mastra-ai/mastra/commit/59d30b5d0cb44ea7a1c440e7460dfb57eac9a9b5), [`453693b`](https://github.com/mastra-ai/mastra/commit/453693bf9e265ddccecef901d50da6caaea0fbc6), [`78d1c80`](https://github.com/mastra-ai/mastra/commit/78d1c808ad90201897a300af551bcc1d34458a20), [`c204b63`](https://github.com/mastra-ai/mastra/commit/c204b632d19e66acb6d6e19b11c4540dd6ad5380), [`742a417`](https://github.com/mastra-ai/mastra/commit/742a417896088220a3b5560c354c45c5ca6d88b9)]:
  - @mastra/core@1.6.0

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

### Patch Changes

- Added skill editing and workspace support in the agent CMS. Agents can now toggle skills on/off and associate a workspace. Fixed auto-versioning to compare against the latest draft version instead of the published one, preventing stale draft configs from being returned after saves. ([#13314](https://github.com/mastra-ai/mastra/pull/13314))

- Fixed recursive schema warnings for processor graph entries by unrolling to a fixed depth of 3 levels, matching the existing rule group pattern ([#13292](https://github.com/mastra-ai/mastra/pull/13292))

- Workspace tools like `ast_edit` are now correctly detected at runtime based on available dependencies (e.g. `@ast-grep/napi`), preventing missing tools from being advertised to agents. ([#13233](https://github.com/mastra-ai/mastra/pull/13233))

- Updated dependencies [[`0d9efb4`](https://github.com/mastra-ai/mastra/commit/0d9efb47992c34aa90581c18b9f51f774f6252a5), [`5caa13d`](https://github.com/mastra-ai/mastra/commit/5caa13d1b2a496e2565ab124a11de9a51ad3e3b9), [`940163f`](https://github.com/mastra-ai/mastra/commit/940163fc492401d7562301e6f106ccef4fefe06f), [`b260123`](https://github.com/mastra-ai/mastra/commit/b2601234bd093d358c92081a58f9b0befdae52b3), [`47892c8`](https://github.com/mastra-ai/mastra/commit/47892c85708eac348209f99f10f9a5f5267e11c0), [`45bb78b`](https://github.com/mastra-ai/mastra/commit/45bb78b70bd9db29678fe49476cd9f4ed01bfd0b), [`70eef84`](https://github.com/mastra-ai/mastra/commit/70eef84b8f44493598fdafa2980a0e7283415eda), [`d84e52d`](https://github.com/mastra-ai/mastra/commit/d84e52d0f6511283ddd21ed5fe7f945449d0f799), [`24b80af`](https://github.com/mastra-ai/mastra/commit/24b80af87da93bb84d389340181e17b7477fa9ca), [`608e156`](https://github.com/mastra-ai/mastra/commit/608e156def954c9604c5e3f6d9dfce3bcc7aeab0), [`2b2e157`](https://github.com/mastra-ai/mastra/commit/2b2e157a092cd597d9d3f0000d62b8bb4a7348ed), [`59d30b5`](https://github.com/mastra-ai/mastra/commit/59d30b5d0cb44ea7a1c440e7460dfb57eac9a9b5), [`453693b`](https://github.com/mastra-ai/mastra/commit/453693bf9e265ddccecef901d50da6caaea0fbc6), [`78d1c80`](https://github.com/mastra-ai/mastra/commit/78d1c808ad90201897a300af551bcc1d34458a20), [`c204b63`](https://github.com/mastra-ai/mastra/commit/c204b632d19e66acb6d6e19b11c4540dd6ad5380), [`742a417`](https://github.com/mastra-ai/mastra/commit/742a417896088220a3b5560c354c45c5ca6d88b9)]:
  - @mastra/core@1.6.0-alpha.0

## 1.5.0

### Minor Changes

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

- CMS draft support with status badges for agents. ([#13194](https://github.com/mastra-ai/mastra/pull/13194))
  - Agent list now resolves the latest (draft) version for each stored agent, showing current edits rather than the last published state.
  - Added `hasDraft` and `activeVersionId` fields to the agent list API response.
  - Agent list badges: "Published" (green) when a published version exists, "Draft" (colored when unpublished changes exist, grayed out otherwise).
  - Added `resolvedVersionId` to all `StorageResolved*Type` types so the server can detect whether the latest version differs from the active version.
  - Added `status` option to `GetByIdOptions` to allow resolving draft vs published versions through the editor layer.
  - Fixed editor cache not being cleared on version activate, restore, and delete — all four versioned domains (agents, scorers, prompt-blocks, mcp-clients) now clear the cache after version mutations.
  - Added `ALTER TABLE` migration for `mastra_agent_versions` in libsql and pg to add newer columns (`mcpClients`, `requestContextSchema`, `workspace`, `skills`, `skillsFormat`).

### Patch Changes

- dependencies updates: ([#13127](https://github.com/mastra-ai/mastra/pull/13127))
  - Updated dependency [`hono@^4.11.9` ↗︎](https://www.npmjs.com/package/hono/v/4.11.9) (from `^4.11.3`, in `dependencies`)

- Use dynamic import in server for stored skills related feature. ([#13217](https://github.com/mastra-ai/mastra/pull/13217))

- Fixed conditional rules not being persisted for workflows, agents, and scorers when creating or updating agents in the CMS. Rules configured on these entities are now correctly saved to storage. ([#13044](https://github.com/mastra-ai/mastra/pull/13044))

- Register `mastra_workspace_grep` tool in studio workspace tools listing so it appears in the agent metadata UI when a workspace has a filesystem configured. ([#13010](https://github.com/mastra-ai/mastra/pull/13010))

- Fixed skill removal for glob-discovered skills. The remove handler now looks up a skill's actual discovered path instead of assuming the hardcoded `.agents/skills` directory, so skills discovered via glob patterns can be correctly deleted. ([#13023](https://github.com/mastra-ai/mastra/pull/13023))

- Dataset schemas now appear in the Edit Dataset dialog. Previously the `inputSchema` and `groundTruthSchema` fields were not passed to the dialog, so editing a dataset always showed empty schemas. ([#13175](https://github.com/mastra-ai/mastra/pull/13175))

  Schema edits in the JSON editor no longer cause the cursor to jump to the top of the field. Typing `{"type": "object"}` in the schema editor now behaves like a normal text input instead of resetting on every keystroke.

  Validation errors are now surfaced when updating a dataset schema that conflicts with existing items. For example, adding a `required: ["name"]` constraint when existing items lack a `name` field now shows "2 existing item(s) fail validation" in the dialog instead of silently dropping the error.

  Disabling a dataset schema from the Studio UI now correctly clears it. Previously the server converted `null` (disable) to `undefined` (no change), so the old schema persisted and validation continued.

  Workflow schemas fetched via `client.getWorkflow().getSchema()` are now correctly parsed. The server serializes schemas with `superjson`, but the client was using plain `JSON.parse`, yielding a `{json: {...}}` wrapper instead of the actual JSON Schema object.

- Added mount-aware skill installation for CompositeFilesystem workspaces. The install, remove, and update handlers now resolve the correct mount when multiple filesystem mounts are configured. Workspace info endpoint now includes mount metadata when available. ([#13031](https://github.com/mastra-ai/mastra/pull/13031))

- Added scorer version management and CMS draft/publish flow for scorers. ([#13194](https://github.com/mastra-ai/mastra/pull/13194))
  - Added scorer version methods to the client SDK: `listVersions`, `createVersion`, `getVersion`, `activateVersion`, `restoreVersion`, `deleteVersion`, `compareVersions`.
  - Added `ScorerVersionCombobox` for navigating scorer versions with Published/Draft labels.
  - Scorer edit page now supports Save (draft) and Publish workflows with an "Unpublished changes" indicator.
  - Storage list methods for agents and scorers no longer default to filtering only published entities, allowing drafts to appear in the playground.

- Updated dependencies [[`252580a`](https://github.com/mastra-ai/mastra/commit/252580a71feb0e46d0ccab04a70a79ff6a2ee0ab), [`f8e819f`](https://github.com/mastra-ai/mastra/commit/f8e819fabdfdc43d2da546a3ad81ba23685f603d), [`5c75261`](https://github.com/mastra-ai/mastra/commit/5c7526120d936757d4ffb7b82232e1641ebd45cb), [`e27d832`](https://github.com/mastra-ai/mastra/commit/e27d83281b5e166fd63a13969689e928d8605944), [`e37ef84`](https://github.com/mastra-ai/mastra/commit/e37ef8404043c94ca0c8e35ecdedb093b8087878), [`6fdd3d4`](https://github.com/mastra-ai/mastra/commit/6fdd3d451a07a8e7e216c62ac364f8dd8e36c2af), [`10cf521`](https://github.com/mastra-ai/mastra/commit/10cf52183344743a0d7babe24cd24fd78870c354), [`efdb682`](https://github.com/mastra-ai/mastra/commit/efdb682887f6522149769383908f9790c188ab88), [`0dee7a0`](https://github.com/mastra-ai/mastra/commit/0dee7a0ff4c2507e6eb6e6ee5f9738877ebd4ad1), [`04c2c8e`](https://github.com/mastra-ai/mastra/commit/04c2c8e888984364194131aecb490a3d6e920e61), [`02dc07a`](https://github.com/mastra-ai/mastra/commit/02dc07acc4ad42d93335825e3308f5b42266eba2), [`bb7262b`](https://github.com/mastra-ai/mastra/commit/bb7262b7c0ca76320d985b40510b6ffbbb936582), [`cf1c6e7`](https://github.com/mastra-ai/mastra/commit/cf1c6e789b131f55638fed52183a89d5078b4876), [`5ffadfe`](https://github.com/mastra-ai/mastra/commit/5ffadfefb1468ac2612b20bb84d24c39de6961c0), [`1e1339c`](https://github.com/mastra-ai/mastra/commit/1e1339cc276e571a48cfff5014487877086bfe68), [`d03df73`](https://github.com/mastra-ai/mastra/commit/d03df73f8fe9496064a33e1c3b74ba0479bf9ee6), [`79b8f45`](https://github.com/mastra-ai/mastra/commit/79b8f45a6767e1a5c3d56cd3c5b1214326b81661), [`9bbf08e`](https://github.com/mastra-ai/mastra/commit/9bbf08e3c20731c79dea13a765895b9fcf29cbf1), [`0a25952`](https://github.com/mastra-ai/mastra/commit/0a259526b5e1ac11e6efa53db1f140272962af2d), [`ffa5468`](https://github.com/mastra-ai/mastra/commit/ffa546857fc4821753979b3a34e13b4d76fbbcd4), [`3264a04`](https://github.com/mastra-ai/mastra/commit/3264a04e30340c3c5447433300a035ea0878df85), [`6fdd3d4`](https://github.com/mastra-ai/mastra/commit/6fdd3d451a07a8e7e216c62ac364f8dd8e36c2af), [`088d9ba`](https://github.com/mastra-ai/mastra/commit/088d9ba2577518703c52b0dccd617178d9ee6b0d), [`74fbebd`](https://github.com/mastra-ai/mastra/commit/74fbebd918a03832a2864965a8bea59bf617d3a2), [`aea6217`](https://github.com/mastra-ai/mastra/commit/aea621790bfb2291431b08da0cc5e6e150303ae7), [`b6a855e`](https://github.com/mastra-ai/mastra/commit/b6a855edc056e088279075506442ba1d6fa6def9), [`ae408ea`](https://github.com/mastra-ai/mastra/commit/ae408ea7128f0d2710b78d8623185198e7cb19c1), [`17e942e`](https://github.com/mastra-ai/mastra/commit/17e942eee2ba44985b1f807e6208cdde672f82f9), [`2015cf9`](https://github.com/mastra-ai/mastra/commit/2015cf921649f44c3f5bcd32a2c052335f8e49b4), [`7ef454e`](https://github.com/mastra-ai/mastra/commit/7ef454eaf9dcec6de60021c8f42192052dd490d6), [`2be1d99`](https://github.com/mastra-ai/mastra/commit/2be1d99564ce79acc4846071082bff353035a87a), [`2708fa1`](https://github.com/mastra-ai/mastra/commit/2708fa1055ac91c03e08b598869f6b8fb51fa37f), [`ba74aef`](https://github.com/mastra-ai/mastra/commit/ba74aef5716142dbbe931351f5243c9c6e4128a9), [`ba74aef`](https://github.com/mastra-ai/mastra/commit/ba74aef5716142dbbe931351f5243c9c6e4128a9), [`ec53e89`](https://github.com/mastra-ai/mastra/commit/ec53e8939c76c638991e21af762e51378eff7543), [`9b5a8cb`](https://github.com/mastra-ai/mastra/commit/9b5a8cb13e120811b0bf14140ada314f1c067894), [`607e66b`](https://github.com/mastra-ai/mastra/commit/607e66b02dc7f531ee37799f3456aa2dc0ca7ac5), [`a215d06`](https://github.com/mastra-ai/mastra/commit/a215d06758dcf590eabfe0b7afd4ae39bdbf082c), [`6909c74`](https://github.com/mastra-ai/mastra/commit/6909c74a7781e0447d475e9dbc1dc871b700f426), [`192438f`](https://github.com/mastra-ai/mastra/commit/192438f8a90c4f375e955f8ff179bf8dc6821a83)]:
  - @mastra/core@1.5.0

## 1.5.0-alpha.1

### Patch Changes

- Updated dependencies:
  - @mastra/core@1.5.0-alpha.1

## 1.5.0-alpha.0

### Minor Changes

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

- CMS draft support with status badges for agents. ([#13194](https://github.com/mastra-ai/mastra/pull/13194))
  - Agent list now resolves the latest (draft) version for each stored agent, showing current edits rather than the last published state.
  - Added `hasDraft` and `activeVersionId` fields to the agent list API response.
  - Agent list badges: "Published" (green) when a published version exists, "Draft" (colored when unpublished changes exist, grayed out otherwise).
  - Added `resolvedVersionId` to all `StorageResolved*Type` types so the server can detect whether the latest version differs from the active version.
  - Added `status` option to `GetByIdOptions` to allow resolving draft vs published versions through the editor layer.
  - Fixed editor cache not being cleared on version activate, restore, and delete — all four versioned domains (agents, scorers, prompt-blocks, mcp-clients) now clear the cache after version mutations.
  - Added `ALTER TABLE` migration for `mastra_agent_versions` in libsql and pg to add newer columns (`mcpClients`, `requestContextSchema`, `workspace`, `skills`, `skillsFormat`).

### Patch Changes

- dependencies updates: ([#13127](https://github.com/mastra-ai/mastra/pull/13127))
  - Updated dependency [`hono@^4.11.9` ↗︎](https://www.npmjs.com/package/hono/v/4.11.9) (from `^4.11.3`, in `dependencies`)

- Use dynamic import in server for stored skills related feature. ([#13217](https://github.com/mastra-ai/mastra/pull/13217))

- Fixed conditional rules not being persisted for workflows, agents, and scorers when creating or updating agents in the CMS. Rules configured on these entities are now correctly saved to storage. ([#13044](https://github.com/mastra-ai/mastra/pull/13044))

- Register `mastra_workspace_grep` tool in studio workspace tools listing so it appears in the agent metadata UI when a workspace has a filesystem configured. ([#13010](https://github.com/mastra-ai/mastra/pull/13010))

- Fixed skill removal for glob-discovered skills. The remove handler now looks up a skill's actual discovered path instead of assuming the hardcoded `.agents/skills` directory, so skills discovered via glob patterns can be correctly deleted. ([#13023](https://github.com/mastra-ai/mastra/pull/13023))

- Dataset schemas now appear in the Edit Dataset dialog. Previously the `inputSchema` and `groundTruthSchema` fields were not passed to the dialog, so editing a dataset always showed empty schemas. ([#13175](https://github.com/mastra-ai/mastra/pull/13175))

  Schema edits in the JSON editor no longer cause the cursor to jump to the top of the field. Typing `{"type": "object"}` in the schema editor now behaves like a normal text input instead of resetting on every keystroke.

  Validation errors are now surfaced when updating a dataset schema that conflicts with existing items. For example, adding a `required: ["name"]` constraint when existing items lack a `name` field now shows "2 existing item(s) fail validation" in the dialog instead of silently dropping the error.

  Disabling a dataset schema from the Studio UI now correctly clears it. Previously the server converted `null` (disable) to `undefined` (no change), so the old schema persisted and validation continued.

  Workflow schemas fetched via `client.getWorkflow().getSchema()` are now correctly parsed. The server serializes schemas with `superjson`, but the client was using plain `JSON.parse`, yielding a `{json: {...}}` wrapper instead of the actual JSON Schema object.

- Added mount-aware skill installation for CompositeFilesystem workspaces. The install, remove, and update handlers now resolve the correct mount when multiple filesystem mounts are configured. Workspace info endpoint now includes mount metadata when available. ([#13031](https://github.com/mastra-ai/mastra/pull/13031))

- Added scorer version management and CMS draft/publish flow for scorers. ([#13194](https://github.com/mastra-ai/mastra/pull/13194))
  - Added scorer version methods to the client SDK: `listVersions`, `createVersion`, `getVersion`, `activateVersion`, `restoreVersion`, `deleteVersion`, `compareVersions`.
  - Added `ScorerVersionCombobox` for navigating scorer versions with Published/Draft labels.
  - Scorer edit page now supports Save (draft) and Publish workflows with an "Unpublished changes" indicator.
  - Storage list methods for agents and scorers no longer default to filtering only published entities, allowing drafts to appear in the playground.

- Updated dependencies [[`252580a`](https://github.com/mastra-ai/mastra/commit/252580a71feb0e46d0ccab04a70a79ff6a2ee0ab), [`f8e819f`](https://github.com/mastra-ai/mastra/commit/f8e819fabdfdc43d2da546a3ad81ba23685f603d), [`5c75261`](https://github.com/mastra-ai/mastra/commit/5c7526120d936757d4ffb7b82232e1641ebd45cb), [`e27d832`](https://github.com/mastra-ai/mastra/commit/e27d83281b5e166fd63a13969689e928d8605944), [`e37ef84`](https://github.com/mastra-ai/mastra/commit/e37ef8404043c94ca0c8e35ecdedb093b8087878), [`6fdd3d4`](https://github.com/mastra-ai/mastra/commit/6fdd3d451a07a8e7e216c62ac364f8dd8e36c2af), [`10cf521`](https://github.com/mastra-ai/mastra/commit/10cf52183344743a0d7babe24cd24fd78870c354), [`efdb682`](https://github.com/mastra-ai/mastra/commit/efdb682887f6522149769383908f9790c188ab88), [`0dee7a0`](https://github.com/mastra-ai/mastra/commit/0dee7a0ff4c2507e6eb6e6ee5f9738877ebd4ad1), [`04c2c8e`](https://github.com/mastra-ai/mastra/commit/04c2c8e888984364194131aecb490a3d6e920e61), [`02dc07a`](https://github.com/mastra-ai/mastra/commit/02dc07acc4ad42d93335825e3308f5b42266eba2), [`bb7262b`](https://github.com/mastra-ai/mastra/commit/bb7262b7c0ca76320d985b40510b6ffbbb936582), [`cf1c6e7`](https://github.com/mastra-ai/mastra/commit/cf1c6e789b131f55638fed52183a89d5078b4876), [`5ffadfe`](https://github.com/mastra-ai/mastra/commit/5ffadfefb1468ac2612b20bb84d24c39de6961c0), [`1e1339c`](https://github.com/mastra-ai/mastra/commit/1e1339cc276e571a48cfff5014487877086bfe68), [`d03df73`](https://github.com/mastra-ai/mastra/commit/d03df73f8fe9496064a33e1c3b74ba0479bf9ee6), [`79b8f45`](https://github.com/mastra-ai/mastra/commit/79b8f45a6767e1a5c3d56cd3c5b1214326b81661), [`9bbf08e`](https://github.com/mastra-ai/mastra/commit/9bbf08e3c20731c79dea13a765895b9fcf29cbf1), [`0a25952`](https://github.com/mastra-ai/mastra/commit/0a259526b5e1ac11e6efa53db1f140272962af2d), [`ffa5468`](https://github.com/mastra-ai/mastra/commit/ffa546857fc4821753979b3a34e13b4d76fbbcd4), [`3264a04`](https://github.com/mastra-ai/mastra/commit/3264a04e30340c3c5447433300a035ea0878df85), [`6fdd3d4`](https://github.com/mastra-ai/mastra/commit/6fdd3d451a07a8e7e216c62ac364f8dd8e36c2af), [`088d9ba`](https://github.com/mastra-ai/mastra/commit/088d9ba2577518703c52b0dccd617178d9ee6b0d), [`74fbebd`](https://github.com/mastra-ai/mastra/commit/74fbebd918a03832a2864965a8bea59bf617d3a2), [`aea6217`](https://github.com/mastra-ai/mastra/commit/aea621790bfb2291431b08da0cc5e6e150303ae7), [`b6a855e`](https://github.com/mastra-ai/mastra/commit/b6a855edc056e088279075506442ba1d6fa6def9), [`ae408ea`](https://github.com/mastra-ai/mastra/commit/ae408ea7128f0d2710b78d8623185198e7cb19c1), [`17e942e`](https://github.com/mastra-ai/mastra/commit/17e942eee2ba44985b1f807e6208cdde672f82f9), [`2015cf9`](https://github.com/mastra-ai/mastra/commit/2015cf921649f44c3f5bcd32a2c052335f8e49b4), [`7ef454e`](https://github.com/mastra-ai/mastra/commit/7ef454eaf9dcec6de60021c8f42192052dd490d6), [`2be1d99`](https://github.com/mastra-ai/mastra/commit/2be1d99564ce79acc4846071082bff353035a87a), [`2708fa1`](https://github.com/mastra-ai/mastra/commit/2708fa1055ac91c03e08b598869f6b8fb51fa37f), [`ba74aef`](https://github.com/mastra-ai/mastra/commit/ba74aef5716142dbbe931351f5243c9c6e4128a9), [`ba74aef`](https://github.com/mastra-ai/mastra/commit/ba74aef5716142dbbe931351f5243c9c6e4128a9), [`ec53e89`](https://github.com/mastra-ai/mastra/commit/ec53e8939c76c638991e21af762e51378eff7543), [`9b5a8cb`](https://github.com/mastra-ai/mastra/commit/9b5a8cb13e120811b0bf14140ada314f1c067894), [`607e66b`](https://github.com/mastra-ai/mastra/commit/607e66b02dc7f531ee37799f3456aa2dc0ca7ac5), [`a215d06`](https://github.com/mastra-ai/mastra/commit/a215d06758dcf590eabfe0b7afd4ae39bdbf082c), [`6909c74`](https://github.com/mastra-ai/mastra/commit/6909c74a7781e0447d475e9dbc1dc871b700f426), [`192438f`](https://github.com/mastra-ai/mastra/commit/192438f8a90c4f375e955f8ff179bf8dc6821a83)]:
  - @mastra/core@1.5.0-alpha.0

## 1.4.0

### Minor Changes

- Added REST API routes for Datasets and Experiments. New endpoints under `/datasets` for full CRUD on datasets, items, versions, experiments, and experiment results. Includes batch operations and experiment comparison. ([#12747](https://github.com/mastra-ai/mastra/pull/12747))

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

### Patch Changes

- Fixed the /api/tools endpoint returning an empty list even when tools are registered on the Mastra instance. Closes #12983 ([#13008](https://github.com/mastra-ai/mastra/pull/13008))

- Fixed custom API routes registered via `registerApiRoute()` being silently ignored by Koa, Express, Fastify, and Hono server adapters. Routes previously appeared in the OpenAPI spec but returned 404 at runtime. Custom routes now work correctly across all server adapters. ([#12960](https://github.com/mastra-ai/mastra/pull/12960))

  **Example:**

  ```ts
  import Koa from 'koa';
  import { Mastra } from '@mastra/core';
  import { registerApiRoute } from '@mastra/core/server';
  import { MastraServer } from '@mastra/koa';

  const mastra = new Mastra({
    server: {
      apiRoutes: [
        registerApiRoute('/hello', {
          method: 'GET',
          handler: async c => c.json({ message: 'Hello!' }),
        }),
      ],
    },
  });

  const app = new Koa();
  const server = new MastraServer({ app, mastra });
  await server.init();
  // GET /hello now returns 200 instead of 404
  ```

- Added API routes for stored MCP clients and tool provider discovery. ([#12974](https://github.com/mastra-ai/mastra/pull/12974))

  **Stored MCP Client Routes**

  New REST endpoints for managing stored MCP client configurations:
  - `GET /api/stored-mcp-clients` — List all stored MCP clients
  - `GET /api/stored-mcp-clients/:id` — Get a specific MCP client
  - `POST /api/stored-mcp-clients` — Create a new MCP client
  - `PATCH /api/stored-mcp-clients/:id` — Update an existing MCP client
  - `DELETE /api/stored-mcp-clients/:id` — Delete an MCP client

  ```ts
  // Create a stored MCP client
  const response = await fetch('/api/stored-mcp-clients', {
    method: 'POST',
    body: JSON.stringify({
      id: 'my-mcp-client',
      name: 'My MCP Client',
      servers: {
        'github-server': { url: 'https://mcp.github.com/sse' },
      },
    }),
  });
  ```

  **Tool Provider Routes**

  New REST endpoints for browsing registered tool providers and their tools:
  - `GET /api/tool-providers` — List all registered tool providers with metadata
  - `GET /api/tool-providers/:providerId/toolkits` — List toolkits for a provider
  - `GET /api/tool-providers/:providerId/tools` — List tools (with optional toolkit/search filtering)
  - `GET /api/tool-providers/:providerId/tools/:toolSlug/schema` — Get input schema for a tool

  ```ts
  // List all registered tool providers
  const providers = await fetch('/api/tool-providers');

  // Browse tools in a specific toolkit
  const tools = await fetch('/api/tool-providers/composio/tools?toolkit=github');

  // Get schema for a specific tool
  const schema = await fetch('/api/tool-providers/composio/tools/GITHUB_LIST_ISSUES/schema');
  ```

  Updated stored agent schemas to include `mcpClients` and `integrationTools` conditional fields, and updated agent version tracking accordingly.

- Fixed requestContextSchema missing from the agent list API response. Agents with a requestContextSchema now correctly include it when listed via GET /agents. ([#12954](https://github.com/mastra-ai/mastra/pull/12954))

- Expose filesystem info from getInfo() in the GET /api/workspaces/:id API response, including provider type, status, readOnly, and provider-specific metadata. ([#12971](https://github.com/mastra-ai/mastra/pull/12971))

- Updated dependencies [[`7ef618f`](https://github.com/mastra-ai/mastra/commit/7ef618f3c49c27e2f6b27d7f564c557c0734325b), [`b373564`](https://github.com/mastra-ai/mastra/commit/b37356491d43b4d53067f10cb669abaf2502f218), [`927c2af`](https://github.com/mastra-ai/mastra/commit/927c2af9792286c122e04409efce0f3c804f777f), [`b896b41`](https://github.com/mastra-ai/mastra/commit/b896b41343de7fcc14442fb40fe82d189e65bbe2), [`6415277`](https://github.com/mastra-ai/mastra/commit/6415277a438faa00db2af850ead5dee25f40c428), [`0831bbb`](https://github.com/mastra-ai/mastra/commit/0831bbb5bc750c18e9b22b45f18687c964b70828), [`63f7eda`](https://github.com/mastra-ai/mastra/commit/63f7eda605eb3e0c8c35ee3912ffe7c999c69f69), [`a5b67a3`](https://github.com/mastra-ai/mastra/commit/a5b67a3589a74415feb663a55d1858324a2afde9), [`877b02c`](https://github.com/mastra-ai/mastra/commit/877b02cdbb15e199184c7f2b8f217be8d3ebada7), [`7567222`](https://github.com/mastra-ai/mastra/commit/7567222b1366f0d39980594792dd9d5060bfe2ab), [`af71458`](https://github.com/mastra-ai/mastra/commit/af71458e3b566f09c11d0e5a0a836dc818e7a24a), [`eb36bd8`](https://github.com/mastra-ai/mastra/commit/eb36bd8c52fcd6ec9674ac3b7a6412405b5983e1), [`3cbf121`](https://github.com/mastra-ai/mastra/commit/3cbf121f55418141924754a83102aade89835947)]:
  - @mastra/core@1.4.0

## 1.4.0-alpha.0

### Minor Changes

- Added REST API routes for Datasets and Experiments. New endpoints under `/datasets` for full CRUD on datasets, items, versions, experiments, and experiment results. Includes batch operations and experiment comparison. ([#12747](https://github.com/mastra-ai/mastra/pull/12747))

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

### Patch Changes

- Fixed the /api/tools endpoint returning an empty list even when tools are registered on the Mastra instance. Closes #12983 ([#13008](https://github.com/mastra-ai/mastra/pull/13008))

- Fixed custom API routes registered via `registerApiRoute()` being silently ignored by Koa, Express, Fastify, and Hono server adapters. Routes previously appeared in the OpenAPI spec but returned 404 at runtime. Custom routes now work correctly across all server adapters. ([#12960](https://github.com/mastra-ai/mastra/pull/12960))

  **Example:**

  ```ts
  import Koa from 'koa';
  import { Mastra } from '@mastra/core';
  import { registerApiRoute } from '@mastra/core/server';
  import { MastraServer } from '@mastra/koa';

  const mastra = new Mastra({
    server: {
      apiRoutes: [
        registerApiRoute('/hello', {
          method: 'GET',
          handler: async c => c.json({ message: 'Hello!' }),
        }),
      ],
    },
  });

  const app = new Koa();
  const server = new MastraServer({ app, mastra });
  await server.init();
  // GET /hello now returns 200 instead of 404
  ```

- Added API routes for stored MCP clients and tool provider discovery. ([#12974](https://github.com/mastra-ai/mastra/pull/12974))

  **Stored MCP Client Routes**

  New REST endpoints for managing stored MCP client configurations:
  - `GET /api/stored-mcp-clients` — List all stored MCP clients
  - `GET /api/stored-mcp-clients/:id` — Get a specific MCP client
  - `POST /api/stored-mcp-clients` — Create a new MCP client
  - `PATCH /api/stored-mcp-clients/:id` — Update an existing MCP client
  - `DELETE /api/stored-mcp-clients/:id` — Delete an MCP client

  ```ts
  // Create a stored MCP client
  const response = await fetch('/api/stored-mcp-clients', {
    method: 'POST',
    body: JSON.stringify({
      id: 'my-mcp-client',
      name: 'My MCP Client',
      servers: {
        'github-server': { url: 'https://mcp.github.com/sse' },
      },
    }),
  });
  ```

  **Tool Provider Routes**

  New REST endpoints for browsing registered tool providers and their tools:
  - `GET /api/tool-providers` — List all registered tool providers with metadata
  - `GET /api/tool-providers/:providerId/toolkits` — List toolkits for a provider
  - `GET /api/tool-providers/:providerId/tools` — List tools (with optional toolkit/search filtering)
  - `GET /api/tool-providers/:providerId/tools/:toolSlug/schema` — Get input schema for a tool

  ```ts
  // List all registered tool providers
  const providers = await fetch('/api/tool-providers');

  // Browse tools in a specific toolkit
  const tools = await fetch('/api/tool-providers/composio/tools?toolkit=github');

  // Get schema for a specific tool
  const schema = await fetch('/api/tool-providers/composio/tools/GITHUB_LIST_ISSUES/schema');
  ```

  Updated stored agent schemas to include `mcpClients` and `integrationTools` conditional fields, and updated agent version tracking accordingly.

- Fixed requestContextSchema missing from the agent list API response. Agents with a requestContextSchema now correctly include it when listed via GET /agents. ([#12954](https://github.com/mastra-ai/mastra/pull/12954))

- Expose filesystem info from getInfo() in the GET /api/workspaces/:id API response, including provider type, status, readOnly, and provider-specific metadata. ([#12971](https://github.com/mastra-ai/mastra/pull/12971))

- Updated dependencies [[`7ef618f`](https://github.com/mastra-ai/mastra/commit/7ef618f3c49c27e2f6b27d7f564c557c0734325b), [`b373564`](https://github.com/mastra-ai/mastra/commit/b37356491d43b4d53067f10cb669abaf2502f218), [`927c2af`](https://github.com/mastra-ai/mastra/commit/927c2af9792286c122e04409efce0f3c804f777f), [`b896b41`](https://github.com/mastra-ai/mastra/commit/b896b41343de7fcc14442fb40fe82d189e65bbe2), [`6415277`](https://github.com/mastra-ai/mastra/commit/6415277a438faa00db2af850ead5dee25f40c428), [`0831bbb`](https://github.com/mastra-ai/mastra/commit/0831bbb5bc750c18e9b22b45f18687c964b70828), [`63f7eda`](https://github.com/mastra-ai/mastra/commit/63f7eda605eb3e0c8c35ee3912ffe7c999c69f69), [`a5b67a3`](https://github.com/mastra-ai/mastra/commit/a5b67a3589a74415feb663a55d1858324a2afde9), [`877b02c`](https://github.com/mastra-ai/mastra/commit/877b02cdbb15e199184c7f2b8f217be8d3ebada7), [`7567222`](https://github.com/mastra-ai/mastra/commit/7567222b1366f0d39980594792dd9d5060bfe2ab), [`af71458`](https://github.com/mastra-ai/mastra/commit/af71458e3b566f09c11d0e5a0a836dc818e7a24a), [`eb36bd8`](https://github.com/mastra-ai/mastra/commit/eb36bd8c52fcd6ec9674ac3b7a6412405b5983e1), [`3cbf121`](https://github.com/mastra-ai/mastra/commit/3cbf121f55418141924754a83102aade89835947)]:
  - @mastra/core@1.4.0-alpha.0

## 1.3.0

### Minor Changes

- **Added stored scorer CRUD API and updated editor namespace calls** ([#12846](https://github.com/mastra-ai/mastra/pull/12846))
  - Added server routes for stored scorer definitions: create, read, update, delete, list, and list resolved
  - Added `StoredScorer` resource to the client SDK with full CRUD support
  - Updated all server handlers to use the new editor namespace pattern (`editor.agent.getById`, `editor.agent.list`, `editor.prompt.preview`) and generic storage domain methods (`store.create`, `store.getById`, `store.delete`)

- Supporting work to allow for cloning agents via the client SDK ([#12796](https://github.com/mastra-ai/mastra/pull/12796))

- Update peer dependencies to match core package version bump (1.1.0) ([#12508](https://github.com/mastra-ai/mastra/pull/12508))

- Add tool description overrides for stored agents: ([#12794](https://github.com/mastra-ai/mastra/pull/12794))
  - Changed stored agent `tools` field from `string[]` to `Record<string, { description?: string }>` to allow per-tool description overrides
  - When a stored agent specifies a custom `description` for a tool, the override is applied at resolution time
  - Updated server API schemas, client SDK types, and editor resolution logic accordingly

### Patch Changes

- Fixed observational memory progress bars resetting to zero after agent responses finish. ([#12934](https://github.com/mastra-ai/mastra/pull/12934))

- Fixed issues with stored agents ([#12790](https://github.com/mastra-ai/mastra/pull/12790))

- Added `requestContextSchema` and conditional field validation to stored agent API schemas. The stored agent create, update, and version endpoints now accept conditional variants for dynamically-configurable fields (`tools`, `model`, `workflows`, `agents`, `memory`, `scorers`, `inputProcessors`, `outputProcessors`, `defaultOptions`). ([#12896](https://github.com/mastra-ai/mastra/pull/12896))

- Fix stored agents functionality: ([#12704](https://github.com/mastra-ai/mastra/pull/12704))
  - Fixed auto-versioning bug where `activeVersionId` wasn't being updated when creating new versions
  - Added `GET /vectors` endpoint to list available vector stores
  - Added `GET /embedders` endpoint to list available embedding models
  - Added validation for memory configuration when semantic recall is enabled
  - Fixed version comparison in `handleAutoVersioning` to use the active version instead of latest
  - Added proper cache clearing after agent updates

- Added `POST /stored/agents/preview-instructions` endpoint for resolving instruction blocks against a request context. This enables UI previews of how agent instructions will render with specific variables and rule conditions. Updated Zod schemas to support the new `AgentInstructionBlock` union type (`text, prompt_block_ref, inline prompt_block`) in agent version and stored agent responses. ([#12776](https://github.com/mastra-ai/mastra/pull/12776))

- Improved workspace lookup performance while keeping backwards compatibility. ([#12607](https://github.com/mastra-ai/mastra/pull/12607))

  The workspace handlers now use Mastra's workspace registry (`getWorkspaceById()`) for faster lookup when available, and fall back to iterating through agents for older `@mastra/core` versions.

  This change is backwards compatible - newer @mastra/server works with both older and newer @mastra/core versions.

- Route server errors through Mastra logger instead of console.error ([#12888](https://github.com/mastra-ai/mastra/pull/12888))

  Server adapter errors (handler errors, parsing errors, auth errors) now use the configured Mastra logger instead of console.error. This ensures errors are properly  
  formatted as structured logs and sent to configured transports like HttpTransport.

- Fixed Swagger UI not including the API prefix (e.g., `/api`) in request URLs. The OpenAPI spec now includes a servers field with the configured prefix, so Swagger UI correctly generates URLs like `http://localhost:4111/api/agents` instead of `http://localhost:4111/agents`. ([#12847](https://github.com/mastra-ai/mastra/pull/12847))

- Fixed sort direction parameters being silently ignored in Thread Messages API when using bracket notation query params (e.g., `orderBy[field]=createdAt&orderBy[direction]=DESC`). The `normalizeQueryParams` function now reconstructs nested objects from bracket-notation keys, so both JSON format and bracket notation work correctly for `orderBy`, `filter`, `metadata`, and other complex query parameters. (Fixes #12816) ([#12832](https://github.com/mastra-ai/mastra/pull/12832))

- Supporting work to enable workflow step metadata ([#12508](https://github.com/mastra-ai/mastra/pull/12508))

- Made description and instructions required fields in the scorer edit form ([#12897](https://github.com/mastra-ai/mastra/pull/12897))

- Added mount metadata to the workspace file listing response. File entries now include provider, icon, display name, and description for mounted filesystems. ([#12851](https://github.com/mastra-ai/mastra/pull/12851))

- Added source repository info to workspace skill listings so clients can distinguish identically named skills installed from different repos. ([#12678](https://github.com/mastra-ai/mastra/pull/12678))

- Improved error messages when skill installation fails, now showing the actual error instead of a generic message. ([#12605](https://github.com/mastra-ai/mastra/pull/12605))

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

- Updated dependencies [[`717ffab`](https://github.com/mastra-ai/mastra/commit/717ffab42cfd58ff723b5c19ada4939997773004), [`b31c922`](https://github.com/mastra-ai/mastra/commit/b31c922215b513791d98feaea1b98784aa00803a), [`e4b6dab`](https://github.com/mastra-ai/mastra/commit/e4b6dab171c5960e340b3ea3ea6da8d64d2b8672), [`5719fa8`](https://github.com/mastra-ai/mastra/commit/5719fa8880e86e8affe698ec4b3807c7e0e0a06f), [`83cda45`](https://github.com/mastra-ai/mastra/commit/83cda4523e588558466892bff8f80f631a36945a), [`11804ad`](https://github.com/mastra-ai/mastra/commit/11804adf1d6be46ebe216be40a43b39bb8b397d7), [`aa95f95`](https://github.com/mastra-ai/mastra/commit/aa95f958b186ae5c9f4219c88e268f5565c277a2), [`90f7894`](https://github.com/mastra-ai/mastra/commit/90f7894568dc9481f40a4d29672234fae23090bb), [`f5501ae`](https://github.com/mastra-ai/mastra/commit/f5501aedb0a11106c7db7e480d6eaf3971b7bda8), [`44573af`](https://github.com/mastra-ai/mastra/commit/44573afad0a4bc86f627d6cbc0207961cdcb3bc3), [`00e3861`](https://github.com/mastra-ai/mastra/commit/00e3861863fbfee78faeb1ebbdc7c0223aae13ff), [`8109aee`](https://github.com/mastra-ai/mastra/commit/8109aeeab758e16cd4255a6c36f044b70eefc6a6), [`7bfbc52`](https://github.com/mastra-ai/mastra/commit/7bfbc52a8604feb0fff2c0a082c13c0c2a3df1a2), [`1445994`](https://github.com/mastra-ai/mastra/commit/1445994aee19c9334a6a101cf7bd80ca7ed4d186), [`61f44a2`](https://github.com/mastra-ai/mastra/commit/61f44a26861c89e364f367ff40825bdb7f19df55), [`37145d2`](https://github.com/mastra-ai/mastra/commit/37145d25f99dc31f1a9105576e5452609843ce32), [`fdad759`](https://github.com/mastra-ai/mastra/commit/fdad75939ff008b27625f5ec0ce9c6915d99d9ec), [`e4569c5`](https://github.com/mastra-ai/mastra/commit/e4569c589e00c4061a686c9eb85afe1b7050b0a8), [`7309a85`](https://github.com/mastra-ai/mastra/commit/7309a85427281a8be23f4fb80ca52e18eaffd596), [`99424f6`](https://github.com/mastra-ai/mastra/commit/99424f6862ffb679c4ec6765501486034754a4c2), [`44eb452`](https://github.com/mastra-ai/mastra/commit/44eb4529b10603c279688318bebf3048543a1d61), [`6c40593`](https://github.com/mastra-ai/mastra/commit/6c40593d6d2b1b68b0c45d1a3a4c6ac5ecac3937), [`8c1135d`](https://github.com/mastra-ai/mastra/commit/8c1135dfb91b057283eae7ee11f9ec28753cc64f), [`dd39e54`](https://github.com/mastra-ai/mastra/commit/dd39e54ea34532c995b33bee6e0e808bf41a7341), [`b6fad9a`](https://github.com/mastra-ai/mastra/commit/b6fad9a602182b1cc0df47cd8c55004fa829ad61), [`4129c07`](https://github.com/mastra-ai/mastra/commit/4129c073349b5a66643fd8136ebfe9d7097cf793), [`5b930ab`](https://github.com/mastra-ai/mastra/commit/5b930aba1834d9898e8460a49d15106f31ac7c8d), [`4be93d0`](https://github.com/mastra-ai/mastra/commit/4be93d09d68e20aaf0ea3f210749422719618b5f), [`047635c`](https://github.com/mastra-ai/mastra/commit/047635ccd7861d726c62d135560c0022a5490aec), [`8c90ff4`](https://github.com/mastra-ai/mastra/commit/8c90ff4d3414e7f2a2d216ea91274644f7b29133), [`ed232d1`](https://github.com/mastra-ai/mastra/commit/ed232d1583f403925dc5ae45f7bee948cf2a182b), [`3891795`](https://github.com/mastra-ai/mastra/commit/38917953518eb4154a984ee36e6ededdcfe80f72), [`4f955b2`](https://github.com/mastra-ai/mastra/commit/4f955b20c7f66ed282ee1fd8709696fa64c4f19d), [`55a4c90`](https://github.com/mastra-ai/mastra/commit/55a4c9044ac7454349b9f6aeba0bbab5ee65d10f)]:
  - @mastra/core@1.3.0

## 1.3.0-alpha.2

### Patch Changes

- Fixed observational memory progress bars resetting to zero after agent responses finish. The messages and observations sidebar bars now retain their values on stream completion, cancellation, and page reload. Also added a buffer-status endpoint so buffering badges resolve with accurate token counts instead of spinning forever when buffering outlives the stream. ([#12934](https://github.com/mastra-ai/mastra/pull/12934))

- Updated dependencies [[`b31c922`](https://github.com/mastra-ai/mastra/commit/b31c922215b513791d98feaea1b98784aa00803a)]:
  - @mastra/core@1.3.0-alpha.2

## 1.3.0-alpha.1

### Minor Changes

- **Added stored scorer CRUD API and updated editor namespace calls** ([#12846](https://github.com/mastra-ai/mastra/pull/12846))
  - Added server routes for stored scorer definitions: create, read, update, delete, list, and list resolved
  - Added `StoredScorer` resource to the client SDK with full CRUD support
  - Updated all server handlers to use the new editor namespace pattern (`editor.agent.getById`, `editor.agent.list`, `editor.prompt.preview`) and generic storage domain methods (`store.create`, `store.getById`, `store.delete`)

- Supporting work to allow for cloning agents via the client SDK ([#12796](https://github.com/mastra-ai/mastra/pull/12796))

- Update peer dependencies to match core package version bump (1.1.0) ([#12508](https://github.com/mastra-ai/mastra/pull/12508))

- Add tool description overrides for stored agents: ([#12794](https://github.com/mastra-ai/mastra/pull/12794))
  - Changed stored agent `tools` field from `string[]` to `Record<string, { description?: string }>` to allow per-tool description overrides
  - When a stored agent specifies a custom `description` for a tool, the override is applied at resolution time
  - Updated server API schemas, client SDK types, and editor resolution logic accordingly

### Patch Changes

- Fixed issues with stored agents ([#12790](https://github.com/mastra-ai/mastra/pull/12790))

- Added `requestContextSchema` and conditional field validation to stored agent API schemas. The stored agent create, update, and version endpoints now accept conditional variants for dynamically-configurable fields (`tools`, `model`, `workflows`, `agents`, `memory`, `scorers`, `inputProcessors`, `outputProcessors`, `defaultOptions`). ([#12896](https://github.com/mastra-ai/mastra/pull/12896))

- Added `POST /stored/agents/preview-instructions` endpoint for resolving instruction blocks against a request context. This enables UI previews of how agent instructions will render with specific variables and rule conditions. Updated Zod schemas to support the new `AgentInstructionBlock` union type (`text, prompt_block_ref, inline prompt_block`) in agent version and stored agent responses. ([#12776](https://github.com/mastra-ai/mastra/pull/12776))

- Improved workspace lookup performance while keeping backwards compatibility. ([#12607](https://github.com/mastra-ai/mastra/pull/12607))

  The workspace handlers now use Mastra's workspace registry (`getWorkspaceById()`) for faster lookup when available, and fall back to iterating through agents for older `@mastra/core` versions.

  This change is backwards compatible - newer @mastra/server works with both older and newer @mastra/core versions.

- Route server errors through Mastra logger instead of console.error ([#12888](https://github.com/mastra-ai/mastra/pull/12888))

  Server adapter errors (handler errors, parsing errors, auth errors) now use the configured Mastra logger instead of console.error. This ensures errors are properly  
  formatted as structured logs and sent to configured transports like HttpTransport.

- Fixed Swagger UI not including the API prefix (e.g., `/api`) in request URLs. The OpenAPI spec now includes a servers field with the configured prefix, so Swagger UI correctly generates URLs like `http://localhost:4111/api/agents` instead of `http://localhost:4111/agents`. ([#12847](https://github.com/mastra-ai/mastra/pull/12847))

- Fixed sort direction parameters being silently ignored in Thread Messages API when using bracket notation query params (e.g., `orderBy[field]=createdAt&orderBy[direction]=DESC`). The `normalizeQueryParams` function now reconstructs nested objects from bracket-notation keys, so both JSON format and bracket notation work correctly for `orderBy`, `filter`, `metadata`, and other complex query parameters. (Fixes #12816) ([#12832](https://github.com/mastra-ai/mastra/pull/12832))

- Supporting work to enable workflow step metadata ([#12508](https://github.com/mastra-ai/mastra/pull/12508))

- Added mount metadata to the workspace file listing response. File entries now include provider, icon, display name, and description for mounted filesystems. ([#12851](https://github.com/mastra-ai/mastra/pull/12851))

- Improved error messages when skill installation fails, now showing the actual error instead of a generic message. ([#12605](https://github.com/mastra-ai/mastra/pull/12605))

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

- Updated dependencies [[`717ffab`](https://github.com/mastra-ai/mastra/commit/717ffab42cfd58ff723b5c19ada4939997773004), [`e4b6dab`](https://github.com/mastra-ai/mastra/commit/e4b6dab171c5960e340b3ea3ea6da8d64d2b8672), [`5719fa8`](https://github.com/mastra-ai/mastra/commit/5719fa8880e86e8affe698ec4b3807c7e0e0a06f), [`83cda45`](https://github.com/mastra-ai/mastra/commit/83cda4523e588558466892bff8f80f631a36945a), [`11804ad`](https://github.com/mastra-ai/mastra/commit/11804adf1d6be46ebe216be40a43b39bb8b397d7), [`aa95f95`](https://github.com/mastra-ai/mastra/commit/aa95f958b186ae5c9f4219c88e268f5565c277a2), [`f5501ae`](https://github.com/mastra-ai/mastra/commit/f5501aedb0a11106c7db7e480d6eaf3971b7bda8), [`44573af`](https://github.com/mastra-ai/mastra/commit/44573afad0a4bc86f627d6cbc0207961cdcb3bc3), [`00e3861`](https://github.com/mastra-ai/mastra/commit/00e3861863fbfee78faeb1ebbdc7c0223aae13ff), [`7bfbc52`](https://github.com/mastra-ai/mastra/commit/7bfbc52a8604feb0fff2c0a082c13c0c2a3df1a2), [`1445994`](https://github.com/mastra-ai/mastra/commit/1445994aee19c9334a6a101cf7bd80ca7ed4d186), [`61f44a2`](https://github.com/mastra-ai/mastra/commit/61f44a26861c89e364f367ff40825bdb7f19df55), [`37145d2`](https://github.com/mastra-ai/mastra/commit/37145d25f99dc31f1a9105576e5452609843ce32), [`fdad759`](https://github.com/mastra-ai/mastra/commit/fdad75939ff008b27625f5ec0ce9c6915d99d9ec), [`e4569c5`](https://github.com/mastra-ai/mastra/commit/e4569c589e00c4061a686c9eb85afe1b7050b0a8), [`7309a85`](https://github.com/mastra-ai/mastra/commit/7309a85427281a8be23f4fb80ca52e18eaffd596), [`99424f6`](https://github.com/mastra-ai/mastra/commit/99424f6862ffb679c4ec6765501486034754a4c2), [`44eb452`](https://github.com/mastra-ai/mastra/commit/44eb4529b10603c279688318bebf3048543a1d61), [`6c40593`](https://github.com/mastra-ai/mastra/commit/6c40593d6d2b1b68b0c45d1a3a4c6ac5ecac3937), [`8c1135d`](https://github.com/mastra-ai/mastra/commit/8c1135dfb91b057283eae7ee11f9ec28753cc64f), [`dd39e54`](https://github.com/mastra-ai/mastra/commit/dd39e54ea34532c995b33bee6e0e808bf41a7341), [`b6fad9a`](https://github.com/mastra-ai/mastra/commit/b6fad9a602182b1cc0df47cd8c55004fa829ad61), [`4129c07`](https://github.com/mastra-ai/mastra/commit/4129c073349b5a66643fd8136ebfe9d7097cf793), [`5b930ab`](https://github.com/mastra-ai/mastra/commit/5b930aba1834d9898e8460a49d15106f31ac7c8d), [`4be93d0`](https://github.com/mastra-ai/mastra/commit/4be93d09d68e20aaf0ea3f210749422719618b5f), [`047635c`](https://github.com/mastra-ai/mastra/commit/047635ccd7861d726c62d135560c0022a5490aec), [`8c90ff4`](https://github.com/mastra-ai/mastra/commit/8c90ff4d3414e7f2a2d216ea91274644f7b29133), [`ed232d1`](https://github.com/mastra-ai/mastra/commit/ed232d1583f403925dc5ae45f7bee948cf2a182b), [`3891795`](https://github.com/mastra-ai/mastra/commit/38917953518eb4154a984ee36e6ededdcfe80f72), [`4f955b2`](https://github.com/mastra-ai/mastra/commit/4f955b20c7f66ed282ee1fd8709696fa64c4f19d), [`55a4c90`](https://github.com/mastra-ai/mastra/commit/55a4c9044ac7454349b9f6aeba0bbab5ee65d10f)]:
  - @mastra/core@1.3.0-alpha.1

## 1.2.1-alpha.0

### Patch Changes

- Fix stored agents functionality: ([#12704](https://github.com/mastra-ai/mastra/pull/12704))
  - Fixed auto-versioning bug where `activeVersionId` wasn't being updated when creating new versions
  - Added `GET /vectors` endpoint to list available vector stores
  - Added `GET /embedders` endpoint to list available embedding models
  - Added validation for memory configuration when semantic recall is enabled
  - Fixed version comparison in `handleAutoVersioning` to use the active version instead of latest
  - Added proper cache clearing after agent updates

- Added source repository info to workspace skill listings so clients can distinguish identically named skills installed from different repos. ([#12678](https://github.com/mastra-ai/mastra/pull/12678))

- Updated dependencies [[`90f7894`](https://github.com/mastra-ai/mastra/commit/90f7894568dc9481f40a4d29672234fae23090bb), [`8109aee`](https://github.com/mastra-ai/mastra/commit/8109aeeab758e16cd4255a6c36f044b70eefc6a6)]:
  - @mastra/core@1.2.1-alpha.0

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

- Added skills.sh proxy endpoints for browsing, searching, and installing skills from the community registry. ([#12492](https://github.com/mastra-ai/mastra/pull/12492))

  **New endpoints:**
  - GET /api/workspaces/:id/skills-sh/search - Search skills
  - GET /api/workspaces/:id/skills-sh/popular - Browse popular skills
  - GET /api/workspaces/:id/skills-sh/preview - Preview skill SKILL.md content
  - POST /api/workspaces/:id/skills-sh/install - Install a skill from GitHub
  - POST /api/workspaces/:id/skills-sh/update - Update installed skills
  - POST /api/workspaces/:id/skills-sh/remove - Remove an installed skill

### Patch Changes

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

- Fixed custom gateway provider detection in Studio. ([#11815](https://github.com/mastra-ai/mastra/pull/11815))

  **What changed:**
  - Studio now correctly detects connected custom gateway providers (e.g., providers registered as `acme/custom` are now found when the agent uses model `acme/custom/gpt-4o`)
  - The model selector properly displays and updates models for custom gateway providers
  - "Enhance prompt" feature works correctly with custom gateway providers

  **Why:**
  Custom gateway providers are stored with a gateway prefix (e.g., `acme/custom`), but the model router extracts just the provider part (e.g., `custom`). The lookups were failing because they only did exact matching. Now both backend and frontend use fallback logic to find providers with gateway prefixes.

  Fixes #11732

- Improved workspace filesystem error handling: return 404 for not-found errors instead of 500, show user-friendly error messages in UI, and add MastraClientError class with status/body properties for better error handling ([#12533](https://github.com/mastra-ai/mastra/pull/12533))

- Updated dependencies [[`e6fc281`](https://github.com/mastra-ai/mastra/commit/e6fc281896a3584e9e06465b356a44fe7faade65), [`97be6c8`](https://github.com/mastra-ai/mastra/commit/97be6c8963130fca8a664fcf99d7b3a38e463595), [`2770921`](https://github.com/mastra-ai/mastra/commit/2770921eec4d55a36b278d15c3a83f694e462ee5), [`b1695db`](https://github.com/mastra-ai/mastra/commit/b1695db2d7be0c329d499619c7881899649188d0), [`5fe1fe0`](https://github.com/mastra-ai/mastra/commit/5fe1fe0109faf2c87db34b725d8a4571a594f80e), [`4133d48`](https://github.com/mastra-ai/mastra/commit/4133d48eaa354cdb45920dc6265732ffbc96788d), [`5dd01cc`](https://github.com/mastra-ai/mastra/commit/5dd01cce68d61874aa3ecbd91ee17884cfd5aca2), [`13e0a2a`](https://github.com/mastra-ai/mastra/commit/13e0a2a2bcec01ff4d701274b3727d5e907a6a01), [`f6673b8`](https://github.com/mastra-ai/mastra/commit/f6673b893b65b7d273ad25ead42e990704cc1e17), [`cd6be8a`](https://github.com/mastra-ai/mastra/commit/cd6be8ad32741cd41cabf508355bb31b71e8a5bd), [`9eb4e8e`](https://github.com/mastra-ai/mastra/commit/9eb4e8e39efbdcfff7a40ff2ce07ce2714c65fa8), [`c987384`](https://github.com/mastra-ai/mastra/commit/c987384d6c8ca844a9701d7778f09f5a88da7f9f), [`cb8cc12`](https://github.com/mastra-ai/mastra/commit/cb8cc12bfadd526aa95a01125076f1da44e4afa7), [`aa37c84`](https://github.com/mastra-ai/mastra/commit/aa37c84d29b7db68c72517337932ef486c316275), [`62f5d50`](https://github.com/mastra-ai/mastra/commit/62f5d5043debbba497dacb7ab008fe86b38b8de3), [`47eba72`](https://github.com/mastra-ai/mastra/commit/47eba72f0397d0d14fbe324b97940c3d55e5a525)]:
  - @mastra/core@1.2.0

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

### Patch Changes

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

- Updated dependencies [[`2770921`](https://github.com/mastra-ai/mastra/commit/2770921eec4d55a36b278d15c3a83f694e462ee5), [`b1695db`](https://github.com/mastra-ai/mastra/commit/b1695db2d7be0c329d499619c7881899649188d0), [`4133d48`](https://github.com/mastra-ai/mastra/commit/4133d48eaa354cdb45920dc6265732ffbc96788d), [`5dd01cc`](https://github.com/mastra-ai/mastra/commit/5dd01cce68d61874aa3ecbd91ee17884cfd5aca2), [`13e0a2a`](https://github.com/mastra-ai/mastra/commit/13e0a2a2bcec01ff4d701274b3727d5e907a6a01), [`c987384`](https://github.com/mastra-ai/mastra/commit/c987384d6c8ca844a9701d7778f09f5a88da7f9f), [`cb8cc12`](https://github.com/mastra-ai/mastra/commit/cb8cc12bfadd526aa95a01125076f1da44e4afa7), [`62f5d50`](https://github.com/mastra-ai/mastra/commit/62f5d5043debbba497dacb7ab008fe86b38b8de3)]:
  - @mastra/core@1.2.0-alpha.1

## 1.2.0-alpha.0

### Minor Changes

- Added skills.sh proxy endpoints for browsing, searching, and installing skills from the community registry. ([#12492](https://github.com/mastra-ai/mastra/pull/12492))

  **New endpoints:**
  - GET /api/workspaces/:id/skills-sh/search - Search skills
  - GET /api/workspaces/:id/skills-sh/popular - Browse popular skills
  - GET /api/workspaces/:id/skills-sh/preview - Preview skill SKILL.md content
  - POST /api/workspaces/:id/skills-sh/install - Install a skill from GitHub
  - POST /api/workspaces/:id/skills-sh/update - Update installed skills
  - POST /api/workspaces/:id/skills-sh/remove - Remove an installed skill

### Patch Changes

- Fixed custom gateway provider detection in Studio. ([#11815](https://github.com/mastra-ai/mastra/pull/11815))

  **What changed:**
  - Studio now correctly detects connected custom gateway providers (e.g., providers registered as `acme/custom` are now found when the agent uses model `acme/custom/gpt-4o`)
  - The model selector properly displays and updates models for custom gateway providers
  - "Enhance prompt" feature works correctly with custom gateway providers

  **Why:**
  Custom gateway providers are stored with a gateway prefix (e.g., `acme/custom`), but the model router extracts just the provider part (e.g., `custom`). The lookups were failing because they only did exact matching. Now both backend and frontend use fallback logic to find providers with gateway prefixes.

  Fixes #11732

- Improved workspace filesystem error handling: return 404 for not-found errors instead of 500, show user-friendly error messages in UI, and add MastraClientError class with status/body properties for better error handling ([#12533](https://github.com/mastra-ai/mastra/pull/12533))

- Updated dependencies [[`e6fc281`](https://github.com/mastra-ai/mastra/commit/e6fc281896a3584e9e06465b356a44fe7faade65), [`97be6c8`](https://github.com/mastra-ai/mastra/commit/97be6c8963130fca8a664fcf99d7b3a38e463595), [`5fe1fe0`](https://github.com/mastra-ai/mastra/commit/5fe1fe0109faf2c87db34b725d8a4571a594f80e), [`f6673b8`](https://github.com/mastra-ai/mastra/commit/f6673b893b65b7d273ad25ead42e990704cc1e17), [`cd6be8a`](https://github.com/mastra-ai/mastra/commit/cd6be8ad32741cd41cabf508355bb31b71e8a5bd), [`9eb4e8e`](https://github.com/mastra-ai/mastra/commit/9eb4e8e39efbdcfff7a40ff2ce07ce2714c65fa8), [`aa37c84`](https://github.com/mastra-ai/mastra/commit/aa37c84d29b7db68c72517337932ef486c316275), [`47eba72`](https://github.com/mastra-ai/mastra/commit/47eba72f0397d0d14fbe324b97940c3d55e5a525)]:
  - @mastra/core@1.2.0-alpha.0

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

- Added explicit auth control to built-in API routes. All routes now have a requiresAuth property that determines whether authentication is required. This eliminates route matching overhead and makes auth requirements clear in route definitions. Routes default to requiresAuth: true (protected) for security. To make a route public, set requiresAuth: false in the route definition. ([#12153](https://github.com/mastra-ai/mastra/pull/12153))

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

- Added support for including custom API routes in the generated OpenAPI documentation. Custom routes registered via `registerApiRoute()` now appear in the OpenAPI spec alongside built-in Mastra routes. ([#11786](https://github.com/mastra-ai/mastra/pull/11786))

- Added workspace API endpoints for filesystem operations, skill management, and content search. ([#11986](https://github.com/mastra-ai/mastra/pull/11986))

  **New endpoints:**
  - `GET /workspaces` - List all workspaces (from Mastra instance and agents)
  - `GET /workspaces/:workspaceId` - Get workspace info and capabilities
  - `GET/POST/DELETE /workspaces/:workspaceId/fs/*` - Filesystem operations (read, write, list, delete, mkdir, stat)
  - `GET /workspaces/:workspaceId/skills` - List available skills
  - `GET /workspaces/:workspaceId/skills/:skillName` - Get skill details
  - `GET /workspaces/:workspaceId/skills/:skillName/references` - List skill references
  - `GET /workspaces/:workspaceId/search` - Search indexed content

  **Usage:**

  ```typescript
  // List workspaces
  const { workspaces } = await fetch('/api/workspaces').then(r => r.json());
  const workspaceId = workspaces[0].id;

  // Read a file
  const response = await fetch(`/api/workspaces/${workspaceId}/fs/read?path=/docs/guide.md`);
  const { content } = await response.json();

  // List skills
  const skills = await fetch(`/api/workspaces/${workspaceId}/skills`).then(r => r.json());

  // Search content
  const results = await fetch(`/api/workspaces/${workspaceId}/search?query=authentication&mode=hybrid`).then(r =>
    r.json(),
  );
  ```

### Patch Changes

- Fixed server handlers to find stored and sub-agents, not just registered agents. Agents created via the API or stored in the database are now correctly resolved in A2A, memory, scores, tools, and voice endpoints. ([#12481](https://github.com/mastra-ai/mastra/pull/12481))

- Fixed a bug introduced in PR #12251 where requestContext was not passed through to agent and workflow operations. This could cause tools and nested operations that rely on requestContext values to fail or behave incorrectly. ([#12428](https://github.com/mastra-ai/mastra/pull/12428))

- Fix broken import for deepEqual by inlining the function into server. ([#12446](https://github.com/mastra-ai/mastra/pull/12446))

- Added requestContextSchema type support. ([#12259](https://github.com/mastra-ai/mastra/pull/12259))

- Fixed authentication bypass for custom routes in dev mode. Routes registered with registerApiRoute and requiresAuth: true now correctly enforce authentication even when MASTRA_DEV=true. ([#12339](https://github.com/mastra-ai/mastra/pull/12339))

- Fixed malformed JSON body handling in Hono adapter. When a POST request contains invalid JSON (e.g., missing closing braces), the server now returns HTTP 400 Bad Request with a structured error message instead of silently accepting the request with HTTP 200. This prevents workflows from starting with undefined input data. ([#12310](https://github.com/mastra-ai/mastra/issues/12310)) ([#12332](https://github.com/mastra-ai/mastra/pull/12332))

- Fix path parameter routes not respecting requiresAuth setting ([#12143](https://github.com/mastra-ai/mastra/pull/12143))

  Fixes issue where custom API routes with path parameters (e.g., `/users/:id`) were incorrectly requiring authentication even when `requiresAuth` was set to `false`. The authentication middleware now uses pattern matching to correctly match dynamic routes against registered patterns.

  Changes:
  - Inlined path pattern matching utility (based on regexparam) to avoid dependency complexity
  - Updated `isCustomRoutePublic()` to iterate through routes and match path patterns
  - Enhanced `pathMatchesPattern()` to support path parameters (`:id`), optional parameters (`:id?`), and wildcards (`*`)
  - Added comprehensive test coverage for path parameter matching scenarios

  Fixes #12106

- Improves CommonJS support by adding typefiles to the root directory ([#12068](https://github.com/mastra-ai/mastra/pull/12068))

- Added `mcpOptions` to server adapters for serverless MCP support. ([#12324](https://github.com/mastra-ai/mastra/pull/12324))

  **Why:** MCP HTTP transport uses session management by default, which requires persistent state across requests. This doesn't work in serverless environments like Cloudflare Workers or Vercel Edge where each request runs in isolation. The new `mcpOptions` parameter lets you enable stateless mode without overriding the entire `sendResponse()` method.

  **Before:**

  ```typescript
  const server = new MastraServer({
    app,
    mastra,
  });
  // No way to pass serverless option to MCP HTTP transport
  ```

  **After:**

  ```typescript
  const server = new MastraServer({
    app,
    mastra,
    mcpOptions: {
      serverless: true,
    },
  });
  // MCP HTTP transport now runs in stateless mode
  ```

- Fixed memory API endpoints to respect MASTRA_RESOURCE_ID_KEY and MASTRA_THREAD_ID_KEY from middleware. Previously, these endpoints ignored the reserved context keys and used client-provided values directly, allowing authenticated users to potentially access other users' threads and messages. Now when middleware sets these reserved keys, they take precedence over client-provided values for secure user isolation. ([#12251](https://github.com/mastra-ai/mastra/pull/12251))

- Route prefixes are now normalized for consistent handling (trailing slashes removed, leading slashes added, multiple slashes collapsed). ([#12295](https://github.com/mastra-ai/mastra/pull/12295))

- Fixed route prefix behavior to correctly replace the default /api prefix instead of prepending to it. Previously, setting prefix: '/api/v2' resulted in routes at /api/v2/api/agents. Now routes correctly appear at /api/v2/agents as documented. ([#12221](https://github.com/mastra-ai/mastra/pull/12221))

- Updated dependencies [[`90fc0e5`](https://github.com/mastra-ai/mastra/commit/90fc0e5717cb280c2d4acf4f0410b510bb4c0a72), [`1cf5d2e`](https://github.com/mastra-ai/mastra/commit/1cf5d2ea1b085be23e34fb506c80c80a4e6d9c2b), [`b99ceac`](https://github.com/mastra-ai/mastra/commit/b99ceace2c830dbdef47c8692d56a91954aefea2), [`deea43e`](https://github.com/mastra-ai/mastra/commit/deea43eb1366d03a864c5e597d16a48592b9893f), [`833ae96`](https://github.com/mastra-ai/mastra/commit/833ae96c3e34370e58a1e979571c41f39a720592), [`943772b`](https://github.com/mastra-ai/mastra/commit/943772b4378f625f0f4e19ea2b7c392bd8e71786), [`b5c711b`](https://github.com/mastra-ai/mastra/commit/b5c711b281dd1fb81a399a766bc9f86c55efc13e), [`3efbe5a`](https://github.com/mastra-ai/mastra/commit/3efbe5ae20864c4f3143457f4f3ee7dc2fa5ca76), [`1e49e7a`](https://github.com/mastra-ai/mastra/commit/1e49e7ab5f173582154cb26b29d424de67d09aef), [`751eaab`](https://github.com/mastra-ai/mastra/commit/751eaab4e0d3820a94e4c3d39a2ff2663ded3d91), [`69d8156`](https://github.com/mastra-ai/mastra/commit/69d81568bcf062557c24471ce26812446bec465d), [`60d9d89`](https://github.com/mastra-ai/mastra/commit/60d9d899e44b35bc43f1bcd967a74e0ce010b1af), [`5c544c8`](https://github.com/mastra-ai/mastra/commit/5c544c8d12b08ab40d64d8f37b3c4215bee95b87), [`771ad96`](https://github.com/mastra-ai/mastra/commit/771ad962441996b5c43549391a3e6a02c6ddedc2), [`2b0936b`](https://github.com/mastra-ai/mastra/commit/2b0936b0c9a43eeed9bef63e614d7e02ee803f7e), [`3b04f30`](https://github.com/mastra-ai/mastra/commit/3b04f3010604f3cdfc8a0674731700ad66471cee), [`97e26de`](https://github.com/mastra-ai/mastra/commit/97e26deaebd9836647a67b96423281d66421ca07), [`ac9ec66`](https://github.com/mastra-ai/mastra/commit/ac9ec6672779b2e6d4344e415481d1a6a7d4911a), [`10523f4`](https://github.com/mastra-ai/mastra/commit/10523f4882d9b874b40ce6e3715f66dbcd4947d2), [`cb72d20`](https://github.com/mastra-ai/mastra/commit/cb72d2069d7339bda8a0e76d4f35615debb07b84), [`42856b1`](https://github.com/mastra-ai/mastra/commit/42856b1c8aeea6371c9ee77ae2f5f5fe34400933), [`66f33ff`](https://github.com/mastra-ai/mastra/commit/66f33ff68620018513e499c394411d1d39b3aa5c), [`ab3c190`](https://github.com/mastra-ai/mastra/commit/ab3c1901980a99910ca9b96a7090c22e24060113), [`d4f06c8`](https://github.com/mastra-ai/mastra/commit/d4f06c85ffa5bb0da38fb82ebf3b040cc6b4ec4e), [`0350626`](https://github.com/mastra-ai/mastra/commit/03506267ec41b67add80d994c0c0fcce93bbc75f), [`bc9fa00`](https://github.com/mastra-ai/mastra/commit/bc9fa00859c5c4a796d53a0a5cae46ab4a3072e4), [`f46a478`](https://github.com/mastra-ai/mastra/commit/f46a4782f595949c696569e891f81c8d26338508), [`90fc0e5`](https://github.com/mastra-ai/mastra/commit/90fc0e5717cb280c2d4acf4f0410b510bb4c0a72), [`f05a3a5`](https://github.com/mastra-ai/mastra/commit/f05a3a5cf2b9a9c2d40c09cb8c762a4b6cd5d565), [`a291da9`](https://github.com/mastra-ai/mastra/commit/a291da9363efd92dafd8775dccb4f2d0511ece7a), [`c5d71da`](https://github.com/mastra-ai/mastra/commit/c5d71da1c680ce5640b1a7f8ca0e024a4ab1cfed), [`07042f9`](https://github.com/mastra-ai/mastra/commit/07042f9f89080f38b8f72713ba1c972d5b1905b8), [`0423442`](https://github.com/mastra-ai/mastra/commit/0423442b7be2dfacba95890bea8f4a810db4d603)]:
  - @mastra/core@1.1.0

## 1.1.0-alpha.2

### Patch Changes

- Updated dependencies:
  - @mastra/core@1.1.0-alpha.2

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

- Updated dependencies [[`b99ceac`](https://github.com/mastra-ai/mastra/commit/b99ceace2c830dbdef47c8692d56a91954aefea2), [`deea43e`](https://github.com/mastra-ai/mastra/commit/deea43eb1366d03a864c5e597d16a48592b9893f), [`ac9ec66`](https://github.com/mastra-ai/mastra/commit/ac9ec6672779b2e6d4344e415481d1a6a7d4911a)]:
  - @mastra/core@1.1.0-alpha.1

## 1.1.0-alpha.0

### Minor Changes

- Added explicit auth control to built-in API routes. All routes now have a requiresAuth property that determines whether authentication is required. This eliminates route matching overhead and makes auth requirements clear in route definitions. Routes default to requiresAuth: true (protected) for security. To make a route public, set requiresAuth: false in the route definition. ([#12153](https://github.com/mastra-ai/mastra/pull/12153))

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

- Added support for including custom API routes in the generated OpenAPI documentation. Custom routes registered via `registerApiRoute()` now appear in the OpenAPI spec alongside built-in Mastra routes. ([#11786](https://github.com/mastra-ai/mastra/pull/11786))

- Added workspace API endpoints for filesystem operations, skill management, and content search. ([#11986](https://github.com/mastra-ai/mastra/pull/11986))

  **New endpoints:**
  - `GET /workspaces` - List all workspaces (from Mastra instance and agents)
  - `GET /workspaces/:workspaceId` - Get workspace info and capabilities
  - `GET/POST/DELETE /workspaces/:workspaceId/fs/*` - Filesystem operations (read, write, list, delete, mkdir, stat)
  - `GET /workspaces/:workspaceId/skills` - List available skills
  - `GET /workspaces/:workspaceId/skills/:skillName` - Get skill details
  - `GET /workspaces/:workspaceId/skills/:skillName/references` - List skill references
  - `GET /workspaces/:workspaceId/search` - Search indexed content

  **Usage:**

  ```typescript
  // List workspaces
  const { workspaces } = await fetch('/api/workspaces').then(r => r.json());
  const workspaceId = workspaces[0].id;

  // Read a file
  const response = await fetch(`/api/workspaces/${workspaceId}/fs/read?path=/docs/guide.md`);
  const { content } = await response.json();

  // List skills
  const skills = await fetch(`/api/workspaces/${workspaceId}/skills`).then(r => r.json());

  // Search content
  const results = await fetch(`/api/workspaces/${workspaceId}/search?query=authentication&mode=hybrid`).then(r =>
    r.json(),
  );
  ```

### Patch Changes

- Fixed server handlers to find stored and sub-agents, not just registered agents. Agents created via the API or stored in the database are now correctly resolved in A2A, memory, scores, tools, and voice endpoints. ([#12481](https://github.com/mastra-ai/mastra/pull/12481))

- Fixed a bug introduced in PR #12251 where requestContext was not passed through to agent and workflow operations. This could cause tools and nested operations that rely on requestContext values to fail or behave incorrectly. ([#12428](https://github.com/mastra-ai/mastra/pull/12428))

- Fix broken import for deepEqual by inlining the function into server. ([#12446](https://github.com/mastra-ai/mastra/pull/12446))

- Added requestContextSchema type support. ([#12259](https://github.com/mastra-ai/mastra/pull/12259))

- Fixed authentication bypass for custom routes in dev mode. Routes registered with registerApiRoute and requiresAuth: true now correctly enforce authentication even when MASTRA_DEV=true. ([#12339](https://github.com/mastra-ai/mastra/pull/12339))

- Fixed malformed JSON body handling in Hono adapter. When a POST request contains invalid JSON (e.g., missing closing braces), the server now returns HTTP 400 Bad Request with a structured error message instead of silently accepting the request with HTTP 200. This prevents workflows from starting with undefined input data. ([#12310](https://github.com/mastra-ai/mastra/issues/12310)) ([#12332](https://github.com/mastra-ai/mastra/pull/12332))

- Fix path parameter routes not respecting requiresAuth setting ([#12143](https://github.com/mastra-ai/mastra/pull/12143))

  Fixes issue where custom API routes with path parameters (e.g., `/users/:id`) were incorrectly requiring authentication even when `requiresAuth` was set to `false`. The authentication middleware now uses pattern matching to correctly match dynamic routes against registered patterns.

  Changes:
  - Inlined path pattern matching utility (based on regexparam) to avoid dependency complexity
  - Updated `isCustomRoutePublic()` to iterate through routes and match path patterns
  - Enhanced `pathMatchesPattern()` to support path parameters (`:id`), optional parameters (`:id?`), and wildcards (`*`)
  - Added comprehensive test coverage for path parameter matching scenarios

  Fixes #12106

- Improves CommonJS support by adding typefiles to the root directory ([#12068](https://github.com/mastra-ai/mastra/pull/12068))

- Added `mcpOptions` to server adapters for serverless MCP support. ([#12324](https://github.com/mastra-ai/mastra/pull/12324))

  **Why:** MCP HTTP transport uses session management by default, which requires persistent state across requests. This doesn't work in serverless environments like Cloudflare Workers or Vercel Edge where each request runs in isolation. The new `mcpOptions` parameter lets you enable stateless mode without overriding the entire `sendResponse()` method.

  **Before:**

  ```typescript
  const server = new MastraServer({
    app,
    mastra,
  });
  // No way to pass serverless option to MCP HTTP transport
  ```

  **After:**

  ```typescript
  const server = new MastraServer({
    app,
    mastra,
    mcpOptions: {
      serverless: true,
    },
  });
  // MCP HTTP transport now runs in stateless mode
  ```

- Fixed memory API endpoints to respect MASTRA_RESOURCE_ID_KEY and MASTRA_THREAD_ID_KEY from middleware. Previously, these endpoints ignored the reserved context keys and used client-provided values directly, allowing authenticated users to potentially access other users' threads and messages. Now when middleware sets these reserved keys, they take precedence over client-provided values for secure user isolation. ([#12251](https://github.com/mastra-ai/mastra/pull/12251))

- Route prefixes are now normalized for consistent handling (trailing slashes removed, leading slashes added, multiple slashes collapsed). ([#12295](https://github.com/mastra-ai/mastra/pull/12295))

- Fixed route prefix behavior to correctly replace the default /api prefix instead of prepending to it. Previously, setting prefix: '/api/v2' resulted in routes at /api/v2/api/agents. Now routes correctly appear at /api/v2/agents as documented. ([#12221](https://github.com/mastra-ai/mastra/pull/12221))

- Updated dependencies [[`90fc0e5`](https://github.com/mastra-ai/mastra/commit/90fc0e5717cb280c2d4acf4f0410b510bb4c0a72), [`1cf5d2e`](https://github.com/mastra-ai/mastra/commit/1cf5d2ea1b085be23e34fb506c80c80a4e6d9c2b), [`833ae96`](https://github.com/mastra-ai/mastra/commit/833ae96c3e34370e58a1e979571c41f39a720592), [`943772b`](https://github.com/mastra-ai/mastra/commit/943772b4378f625f0f4e19ea2b7c392bd8e71786), [`b5c711b`](https://github.com/mastra-ai/mastra/commit/b5c711b281dd1fb81a399a766bc9f86c55efc13e), [`3efbe5a`](https://github.com/mastra-ai/mastra/commit/3efbe5ae20864c4f3143457f4f3ee7dc2fa5ca76), [`1e49e7a`](https://github.com/mastra-ai/mastra/commit/1e49e7ab5f173582154cb26b29d424de67d09aef), [`751eaab`](https://github.com/mastra-ai/mastra/commit/751eaab4e0d3820a94e4c3d39a2ff2663ded3d91), [`69d8156`](https://github.com/mastra-ai/mastra/commit/69d81568bcf062557c24471ce26812446bec465d), [`60d9d89`](https://github.com/mastra-ai/mastra/commit/60d9d899e44b35bc43f1bcd967a74e0ce010b1af), [`5c544c8`](https://github.com/mastra-ai/mastra/commit/5c544c8d12b08ab40d64d8f37b3c4215bee95b87), [`771ad96`](https://github.com/mastra-ai/mastra/commit/771ad962441996b5c43549391a3e6a02c6ddedc2), [`2b0936b`](https://github.com/mastra-ai/mastra/commit/2b0936b0c9a43eeed9bef63e614d7e02ee803f7e), [`3b04f30`](https://github.com/mastra-ai/mastra/commit/3b04f3010604f3cdfc8a0674731700ad66471cee), [`97e26de`](https://github.com/mastra-ai/mastra/commit/97e26deaebd9836647a67b96423281d66421ca07), [`10523f4`](https://github.com/mastra-ai/mastra/commit/10523f4882d9b874b40ce6e3715f66dbcd4947d2), [`cb72d20`](https://github.com/mastra-ai/mastra/commit/cb72d2069d7339bda8a0e76d4f35615debb07b84), [`42856b1`](https://github.com/mastra-ai/mastra/commit/42856b1c8aeea6371c9ee77ae2f5f5fe34400933), [`66f33ff`](https://github.com/mastra-ai/mastra/commit/66f33ff68620018513e499c394411d1d39b3aa5c), [`ab3c190`](https://github.com/mastra-ai/mastra/commit/ab3c1901980a99910ca9b96a7090c22e24060113), [`d4f06c8`](https://github.com/mastra-ai/mastra/commit/d4f06c85ffa5bb0da38fb82ebf3b040cc6b4ec4e), [`0350626`](https://github.com/mastra-ai/mastra/commit/03506267ec41b67add80d994c0c0fcce93bbc75f), [`bc9fa00`](https://github.com/mastra-ai/mastra/commit/bc9fa00859c5c4a796d53a0a5cae46ab4a3072e4), [`f46a478`](https://github.com/mastra-ai/mastra/commit/f46a4782f595949c696569e891f81c8d26338508), [`90fc0e5`](https://github.com/mastra-ai/mastra/commit/90fc0e5717cb280c2d4acf4f0410b510bb4c0a72), [`f05a3a5`](https://github.com/mastra-ai/mastra/commit/f05a3a5cf2b9a9c2d40c09cb8c762a4b6cd5d565), [`a291da9`](https://github.com/mastra-ai/mastra/commit/a291da9363efd92dafd8775dccb4f2d0511ece7a), [`c5d71da`](https://github.com/mastra-ai/mastra/commit/c5d71da1c680ce5640b1a7f8ca0e024a4ab1cfed), [`07042f9`](https://github.com/mastra-ai/mastra/commit/07042f9f89080f38b8f72713ba1c972d5b1905b8), [`0423442`](https://github.com/mastra-ai/mastra/commit/0423442b7be2dfacba95890bea8f4a810db4d603)]:
  - @mastra/core@1.1.0-alpha.0

## 1.0.4

### Patch Changes

- Release stable ([#12102](https://github.com/mastra-ai/mastra/pull/12102))

- Updated dependencies:
  - @mastra/core@1.0.4

## 1.0.4-alpha.0

### Patch Changes

- Release stable ([#12102](https://github.com/mastra-ai/mastra/pull/12102))

- Updated dependencies:
  - @mastra/core@1.0.4-alpha.0

## 1.0.0

### Major Changes

- Moving scorers under the eval domain, api method consistency, prebuilt evals, scorers require ids. ([#9589](https://github.com/mastra-ai/mastra/pull/9589))

- Every Mastra primitive (agent, MCPServer, workflow, tool, processor, scorer, and vector) now has a get, list, and add method associated with it. Each primitive also now requires an id to be set. ([#9675](https://github.com/mastra-ai/mastra/pull/9675))

  Primitives that are added to other primitives are also automatically added to the Mastra instance

- Update handlers to use `listWorkflowRuns` instead of `getWorkflowRuns`. Fix type names from `StoragelistThreadsByResourceIdInput/Output` to `StorageListThreadsByResourceIdInput/Output`. ([#9507](https://github.com/mastra-ai/mastra/pull/9507))

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

- Bump minimum required Node.js version to 22.13.0 ([#9706](https://github.com/mastra-ai/mastra/pull/9706))

- Replace `getThreadsByResourceIdPaginated` with `listThreadsByResourceId` across memory handlers. Update client SDK to use `listThreads()` with `offset`/`limit` parameters instead of deprecated `getMemoryThreads()`. Consolidate `/api/memory/threads` routes to single paginated endpoint. ([#9508](https://github.com/mastra-ai/mastra/pull/9508))

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

- Renamed a bunch of observability/tracing-related things to drop the AI prefix. ([#9744](https://github.com/mastra-ai/mastra/pull/9744))

- **Breaking Change**: Remove legacy v1 watch events and consolidate on v2 implementation. ([#9252](https://github.com/mastra-ai/mastra/pull/9252))

  This change simplifies the workflow watching API by removing the legacy v1 event system and promoting v2 as the standard (renamed to just `watch`).

  **What's Changed**
  - Removed legacy v1 watch event handlers and types
  - Renamed `watch-v2` to `watch` throughout the codebase
  - Removed `.watch()` method from client-js SDK (`Workflow` and `AgentBuilder` classes)
  - Removed `/watch` HTTP endpoints from server and deployer
  - Removed `WorkflowWatchResult` and v1 `WatchEvent` types

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

- Changing getAgents -> listAgents, getTools -> listTools, getWorkflows -> listWorkflows ([#9495](https://github.com/mastra-ai/mastra/pull/9495))

- Removed old tracing code based on OpenTelemetry ([#9237](https://github.com/mastra-ai/mastra/pull/9237))

- Remove deprecated vector prompts and cohere provider from code ([#9596](https://github.com/mastra-ai/mastra/pull/9596))

- Mark as stable ([`83d5942`](https://github.com/mastra-ai/mastra/commit/83d5942669ce7bba4a6ca4fd4da697a10eb5ebdc))

- Enforcing id required on Processor primitive ([#9591](https://github.com/mastra-ai/mastra/pull/9591))

- Renamed `MastraMessageV2` to `MastraDBMessage` ([#9255](https://github.com/mastra-ai/mastra/pull/9255))
  Made the return format of all methods that return db messages consistent. It's always `{ messages: MastraDBMessage[] }` now, and messages can be converted after that using `@mastra/ai-sdk/ui`'s `toAISdkV4/5Messages()` function

- moved ai-tracing code into @mastra/observability ([#9661](https://github.com/mastra-ai/mastra/pull/9661))

- Remove legacy evals from Mastra ([#9491](https://github.com/mastra-ai/mastra/pull/9491))

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

- Update peer dependencies to match core package version bump (1.0.0) ([#9237](https://github.com/mastra-ai/mastra/pull/9237))

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

- Update peer dependencies to match core package version bump (1.0.0) ([#9495](https://github.com/mastra-ai/mastra/pull/9495))

- Update peer dependencies to match core package version bump (0.22.1) ([#8649](https://github.com/mastra-ai/mastra/pull/8649))

- Add observeStream support for agent-builder template installation ([#9372](https://github.com/mastra-ai/mastra/pull/9372))
  - Add observeStream, observeStreamVNext, observeStreamLegacy, and resumeStream methods to agent-builder client SDK
  - Add corresponding server handlers and deployer routes for observe streaming
  - Add tracingOptions parameter to existing agent-builder handlers for parity with workflows
  - Update template installation processor to support both legacy and VNext streaming event formats

- Update peer dependencies to match core package version bump (0.22.0) ([#8983](https://github.com/mastra-ai/mastra/pull/8983))

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

- Update peer dependencies to match core package version bump (1.0.0) ([#9491](https://github.com/mastra-ai/mastra/pull/9491))

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

- Add embedded documentation support for Mastra packages ([#11472](https://github.com/mastra-ai/mastra/pull/11472))

  Mastra packages now include embedded documentation in the published npm package under `dist/docs/`. This enables coding agents and AI assistants to understand and use the framework by reading documentation directly from `node_modules`.

  Each package includes:
  - **SKILL.md** - Entry point explaining the package's purpose and capabilities
  - **SOURCE_MAP.json** - Machine-readable index mapping exports to types and implementation files
  - **Topic folders** - Conceptual documentation organized by feature area

  Documentation is driven by the `packages` frontmatter field in MDX files, which maps docs to their corresponding packages. CI validation ensures all docs include this field.

- Remove `streamVNext`, `resumeStreamVNext`, and `observeStreamVNext` methods, call `stream`, `resumeStream` and `observeStream` directly ([#11499](https://github.com/mastra-ai/mastra/pull/11499))

  ```diff
  + const run = await workflow.createRun({ runId: '123' });
  - const stream = await run.streamVNext({ inputData: { ... } });
  + const stream = await run.stream({ inputData: { ... } });
  ```

- Replace deprecated client.getTraces with a client.listTraces ([#11711](https://github.com/mastra-ai/mastra/pull/11711))

- Make step optional in all resume APIs ([#9454](https://github.com/mastra-ai/mastra/pull/9454))

- Fix semantic search endpoint to return results in the correct format. Also fix the delete messages endpoint to properly normalize ids in the expected format. ([#10032](https://github.com/mastra-ai/mastra/pull/10032))

- Extract routing from @deployer/server into server adapter packages. ([#10263](https://github.com/mastra-ai/mastra/pull/10263))
  New packages:
  - @mastra/express
  - @mastra/hono

  These packages support mastra server routes on express and hono respectively.
  Better abstractions will be built on top of these packages in the near future, enabling users to easily attach mastra routes to any existing server framework.

- Fix navigation for processors Studio tab ([#12062](https://github.com/mastra-ai/mastra/pull/12062))

- Fix type safety for message ordering - restrict `orderBy` to only accept `'createdAt'` field ([#11069](https://github.com/mastra-ai/mastra/pull/11069))

  Messages don't have an `updatedAt` field, but the previous type allowed ordering by it, which would return empty results. This change adds compile-time type safety by making `StorageOrderBy` generic and restricting `StorageListMessagesInput.orderBy` to only accept `'createdAt'`. The API validation schemas have also been updated to reject invalid orderBy values at runtime.

- Add resourceId to workflow routes ([#11166](https://github.com/mastra-ai/mastra/pull/11166))

- Fixed inconsistent query parameter handling across server adapters. ([#11429](https://github.com/mastra-ai/mastra/pull/11429))

  **What changed:** Query parameters are now processed consistently across all server adapters (Express, Hono, Fastify, Koa). Added internal helper `normalizeQueryParams` and `ParsedRequestParams` type to `@mastra/server` for adapter implementations.

  **Why:** Different HTTP frameworks handle query parameters differently - some return single strings while others return arrays for repeated params like `?tag=a&tag=b`. This caused type inconsistencies that could lead to validation failures in certain adapters.

  **User impact:** None for typical usage - HTTP endpoints and client SDK behavior are unchanged. If you extend server adapter classes and override `getParams` or `parseQueryParams`, update your implementation to use `Record<string, string | string[]>` for query parameters.

- Add agent id to the list agent ([#9770](https://github.com/mastra-ai/mastra/pull/9770))

- Added new /api/processors endpoints to list, get details, and execute processors. Processor workflows are now auto-detected based on their schema. ([#12059](https://github.com/mastra-ai/mastra/pull/12059))

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

- Fixed orderBy query parameter parsing for memory endpoints. The listMessages and listThreads endpoints now correctly parse orderBy when passed as a JSON string in URL query parameters, matching the existing behavior for include and filter parameters. ([#11767](https://github.com/mastra-ai/mastra/pull/11767))

- Add human-in-the-loop (HITL) support to agent networks ([#11678](https://github.com/mastra-ai/mastra/pull/11678))
  - Add suspend/resume capabilities to agent network
  - Enable auto-resume for suspended network execution via `autoResumeSuspendedTools`

  `agent.resumeNetwork`, `agent.approveNetworkToolCall`, `agent.declineNetworkToolCall`

- Add the description field to listAgents ([#9672](https://github.com/mastra-ai/mastra/pull/9672))

- Fix query parameter parsing for complex nested optional types ([#11711](https://github.com/mastra-ai/mastra/pull/11711))

  Fixes an issue where complex query parameters (like `startedAt` and `endedAt` date range filters) would fail with "Expected object, received string" errors when using the `listTraces` API.

  The fix addresses two issues:
  - Properly unwraps all layers of nested optional/nullable types (e.g., from `.partial()` on already-optional fields)
  - Ensures compatibility with both zod v3 and v4

- Add execution metadata to A2A message/send responses. The A2A protocol now returns detailed execution information including tool calls, tool results, token usage, and finish reason in the task metadata. This allows clients to inspect which tools were invoked during agent execution and access execution statistics without additional queries. ([#11241](https://github.com/mastra-ai/mastra/pull/11241))

- Fix the link issue in observability ([#9764](https://github.com/mastra-ai/mastra/pull/9764))

- Fixes issue #11185 where `MastraServer.tools` was rejecting tools created with `createTool({ inputSchema })`. Changed the tools property type from `Record<string, Tool>` to `ToolsInput` to accept tools with any schema types (input, output, or none), as well as Vercel AI SDK tools and provider-defined tools. ([`5118f38`](https://github.com/mastra-ai/mastra/commit/5118f384a70b1166012fde3b901f3227870b1009))

  Tools created with `createTool({ inputSchema: z.object(...) })` now work without TypeScript errors.

- Fix workflow observability view broken by invalid entityType parameter ([#11427](https://github.com/mastra-ai/mastra/pull/11427))

  The UI workflow observability view was failing with a Zod validation error when trying to filter traces by workflow. The UI was sending `entityType=workflow`, but the backend's `EntityType` enum only accepts `workflow_run`.

  **Root Cause**: The legacy value transformation was happening in the handler (after validation), but Zod validation occurred earlier in the request pipeline, rejecting the request before it could be transformed.

  **Solution**:
  - Added `z.preprocess()` to the query schema to transform `workflow` → `workflow_run` before validation
  - Kept handler transformation for defense in depth
  - Updated UI to use `EntityType.WORKFLOW_RUN` enum value for type safety

  This maintains backward compatibility with legacy clients while fixing the validation error.

  Fixes #11412

- Add timeTravel APIs and add timeTravel feature to studio ([#10361](https://github.com/mastra-ai/mastra/pull/10361))

- Improve type handling with Zod ([#12091](https://github.com/mastra-ai/mastra/pull/12091))

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

- Add tool call approval ([#8649](https://github.com/mastra-ai/mastra/pull/8649))

- Fix scorers listing filtring ([#9801](https://github.com/mastra-ai/mastra/pull/9801))

- **Breaking Changes** ([#11028](https://github.com/mastra-ai/mastra/pull/11028))
  - Renamed `RuntimeContext` type to `ServerContext` to avoid confusion with the user-facing `RequestContext` (previously called `RuntimeContext`)
  - Removed `playground` and `isDev` options from server adapter constructors - these only set context variables without any actual functionality

  **Changes**

  **@mastra/server**
  - Renamed `RuntimeContext` type to `ServerContext` in route handler types
  - Renamed `createTestRuntimeContext` to `createTestServerContext` in test utilities
  - Renamed `isPlayground` parameter to `isStudio` in `formatAgent` function

  **@mastra/hono**
  - Removed `playground` and `isDev` from `HonoVariables` type
  - Removed setting of `playground` and `isDev` context variables in middleware

  **@mastra/express**
  - Removed `playground` and `isDev` from `Express.Locals` interface
  - Removed setting of `playground` and `isDev` in response locals

- Fixes issue where clicking the reset button in the model picker would fail to restore the original LanguageModelV2 (or any other types) object that was passed during agent construction. ([#9481](https://github.com/mastra-ai/mastra/pull/9481))

- Unified MastraServer API with MCP transport routes ([#10644](https://github.com/mastra-ai/mastra/pull/10644))

  **Breaking Changes:**
  - Renamed `HonoServerAdapter` to `MastraServer` in `@mastra/hono`
  - Renamed `ExpressServerAdapter` to `MastraServer` in `@mastra/express`
  - Configuration now passed to constructor instead of separate method calls
  - Renamed base class from `ServerAdapter` to `MastraServerBase` in `@mastra/server`

  **New Features:**
  - Added MCP transport routes (HTTP and SSE) to server adapters
  - MCP endpoints available at `/api/mcp/:serverId/mcp` (HTTP) and `/api/mcp/:serverId/sse` (SSE)
  - Added `express.json()` middleware compatibility for MCP routes
  - Moved authentication helpers from deployer to `@mastra/server/auth`

  **Testing:**
  - Added shared MCP route and transport test suites in `@internal/server-adapter-test-utils`
  - Added comprehensive MCP endpoint tests for both Hono and Express adapters
  - Added GitHub Actions workflow for server adapter CI testing

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

- Remove deprecated playground-only prompt generation handler (functionality moved to @mastra/server) ([#11074](https://github.com/mastra-ai/mastra/pull/11074))

  Improve prompt enhancement UX: show toast errors when enhancement fails, disable button when no model has a configured API key, and prevent users from disabling all models in the model list

  Add missing `/api/agents/:agentId/instructions/enhance` endpoint that was referenced by `@mastra/client-js` and `@mastra/playground-ui`

- Update peer dependencies to match core package version bump (1.0.0) ([#9489](https://github.com/mastra-ai/mastra/pull/9489))

- Add delete workflow run API ([#10991](https://github.com/mastra-ai/mastra/pull/10991))

  ```typescript
  await workflow.deleteWorkflowRunById(runId);
  ```

- Add initial state input to workflow form in studio ([#11560](https://github.com/mastra-ai/mastra/pull/11560))

- Fix 'Memory is not initialized' error in playground for agents with sub-agents but no memory ([#11780](https://github.com/mastra-ai/mastra/pull/11780))

  When using agents with sub-agents (e.g., agent networks) but no memory configured, the playground UI would log HTTPException errors when fetching messages for sub-agents without memory.

  Changed GET /api/memory/threads/:threadId/messages to return empty messages `{ messages: [], uiMessages: [] }` instead of throwing 400 error when memory is not configured for the requested agent.

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

- Add `/api/system/packages` endpoint that returns installed Mastra packages and versions from the dev environment ([#11211](https://github.com/mastra-ai/mastra/pull/11211))

- Add `perStep` option to workflow run methods, allowing a workflow to run just a step instead of all the workflow steps ([#11276](https://github.com/mastra-ai/mastra/pull/11276))

- Standardize pagination params to page/perPage with backwards compatibility for limit/offset ([#10790](https://github.com/mastra-ai/mastra/pull/10790))
  - Server now accepts both `page`/`perPage` and legacy `limit`/`offset` params for workflow runs and MCP server listing endpoints
  - Client SDK sends both param formats to support older server versions
  - Added `createCombinedPaginationSchema` helper for endpoints needing backwards compatibility
  - Marked `limit` and `offset` as deprecated in client types

- Fixed server handler bugs: filter parsing now handles colons in values (timestamps, URLs), dateRange validation now converts JSON strings to Date objects, deleteMessages schema accepts object forms, and added missing responseSchema for legacy stream route ([#10362](https://github.com/mastra-ai/mastra/pull/10362))

- **Client (`@mastra/client-js`):** ([#10653](https://github.com/mastra-ai/mastra/pull/10653))
  - Fixed `sendStreamingMessage` to properly return a streaming response instead of attempting to parse it as JSON

  **Server (`@mastra/server`):**
  - Fixed A2A message handler to pass `contextId` as `threadId` for memory persistence across conversations
  - Added support for user-provided `resourceId` via `params.metadata.resourceId` or `message.metadata.resourceId`, falling back to `agentId`

- Fix undefined runtimeContext using memory from playground ([#9328](https://github.com/mastra-ai/mastra/pull/9328))

- Make step optional in resumeStreamVNext API ([#9453](https://github.com/mastra-ai/mastra/pull/9453))

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

- The `stream` API endpoint now automatically redacts `request` data from stream chunks (`step-start`, `step-finish`, `finish`) which could contain system prompts, tool definitions, and API keys. Redaction is enabled by default and can be disabled for debugging/internal services via `streamOptions.redact`. ([#10705](https://github.com/mastra-ai/mastra/pull/10705))

- Remove `waitForEvent` from workflows. `waitForEvent` is now removed, please use suspend & resume flow instead. See https://mastra.ai/en/docs/workflows/suspend-and-resume for more details on suspend & resume flow. ([#9214](https://github.com/mastra-ai/mastra/pull/9214))

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

- Support new Workflow tripwire run status. Tripwires that are thrown from within a workflow will now bubble up and return a graceful state with information about tripwires. ([#10947](https://github.com/mastra-ai/mastra/pull/10947))

  When a workflow contains an agent step that triggers a tripwire, the workflow returns with `status: 'tripwire'` and includes tripwire details:

  ```typescript
  const run = await workflow.createRun();
  const result = await run.start({ inputData: { message: 'Hello' } });

  if (result.status === 'tripwire') {
    console.log('Workflow terminated by tripwire:', result.tripwire?.reason);
    console.log('Processor ID:', result.tripwire?.processorId);
    console.log('Retry requested:', result.tripwire?.retry);
  }
  ```

  Adds new UI state for tripwire in agent chat and workflow UI.

  This is distinct from `status: 'failed'` which indicates an unexpected error. A tripwire status means a processor intentionally stopped execution (e.g., for content moderation).

- Network handler now accesses thread and resource parameters from the nested memory object instead of directly from request body. ([#10294](https://github.com/mastra-ai/mastra/pull/10294))

- Remove format from stream/generate ([#9577](https://github.com/mastra-ai/mastra/pull/9577))

- Make agentId optional for memory read operations (getThread, listThreads, listMessages) ([#11540](https://github.com/mastra-ai/mastra/pull/11540))

  When workflows use multiple agents sharing the same threadId/resourceId, users can now retrieve threads and messages without specifying an agentId. The server falls back to using storage directly when agentId is not provided.

- Fixed voice transcription endpoint ([#11348](https://github.com/mastra-ai/mastra/pull/11348))

  The voice transcription endpoint (`/api/agents/:agentId/voice/listen`) now correctly handles multipart/form-data requests for audio uploads rather than only parsing JSON request bodies.

  Both Express and Hono adapters now parse multipart/form-data bodies and handle JSON-encoded form fields.

  **Breaking change:** The server schema field for the transcription endpoint was renamed from `audioData` to `audio` to match the client SDK. If you are making direct API calls to the transcription endpoint (not using the SDK), you will need to update your request body to use `audio` instead of `audioData`.

- Updated dependencies [[`ac0d2f4`](https://github.com/mastra-ai/mastra/commit/ac0d2f4ff8831f72c1c66c2be809706d17f65789), [`2319326`](https://github.com/mastra-ai/mastra/commit/2319326f8c64e503a09bbcf14be2dd65405445e0), [`d2d3e22`](https://github.com/mastra-ai/mastra/commit/d2d3e22a419ee243f8812a84e3453dd44365ecb0), [`08766f1`](https://github.com/mastra-ai/mastra/commit/08766f15e13ac0692fde2a8bd366c2e16e4321df), [`72df8ae`](https://github.com/mastra-ai/mastra/commit/72df8ae595584cdd7747d5c39ffaca45e4507227), [`ebae12a`](https://github.com/mastra-ai/mastra/commit/ebae12a2dd0212e75478981053b148a2c246962d), [`c8417b4`](https://github.com/mastra-ai/mastra/commit/c8417b41d9f3486854dc7842d977fbe5e2166264), [`bc72b52`](https://github.com/mastra-ai/mastra/commit/bc72b529ee4478fe89ecd85a8be47ce0127b82a0), [`39c9743`](https://github.com/mastra-ai/mastra/commit/39c97432d084294f8ba85fbf3ef28098ff21459e), [`1dbd8c7`](https://github.com/mastra-ai/mastra/commit/1dbd8c729fb6536ec52f00064d76b80253d346e9), [`c61a0a5`](https://github.com/mastra-ai/mastra/commit/c61a0a5de4904c88fd8b3718bc26d1be1c2ec6e7), [`05b8bee`](https://github.com/mastra-ai/mastra/commit/05b8bee9e50e6c2a4a2bf210eca25ee212ca24fa), [`3076c67`](https://github.com/mastra-ai/mastra/commit/3076c6778b18988ae7d5c4c5c466366974b2d63f), [`3d93a15`](https://github.com/mastra-ai/mastra/commit/3d93a15796b158c617461c8b98bede476ebb43e2), [`9198899`](https://github.com/mastra-ai/mastra/commit/91988995c427b185c33714b7f3be955367911324), [`ed3e3dd`](https://github.com/mastra-ai/mastra/commit/ed3e3ddec69d564fe2b125e083437f76331f1283), [`c59e13c`](https://github.com/mastra-ai/mastra/commit/c59e13c7688284bd96b2baee3e314335003548de), [`c042bd0`](https://github.com/mastra-ai/mastra/commit/c042bd0b743e0e86199d0cb83344ca7690e34a9c), [`f743dbb`](https://github.com/mastra-ai/mastra/commit/f743dbb8b40d1627b5c10c0e6fc154f4ebb6e394), [`21a15de`](https://github.com/mastra-ai/mastra/commit/21a15de369fe82aac26bb642ed7be73505475e8b), [`e54953e`](https://github.com/mastra-ai/mastra/commit/e54953ed8ce1b28c0d62a19950163039af7834b4), [`ae8baf7`](https://github.com/mastra-ai/mastra/commit/ae8baf7d8adcb0ff9dac11880400452bc49b33ff), [`fec5129`](https://github.com/mastra-ai/mastra/commit/fec5129de7fc64423ea03661a56cef31dc747a0d), [`940a2b2`](https://github.com/mastra-ai/mastra/commit/940a2b27480626ed7e74f55806dcd2181c1dd0c2), [`1a0d3fc`](https://github.com/mastra-ai/mastra/commit/1a0d3fc811482c9c376cdf79ee615c23bae9b2d6), [`85d7ee1`](https://github.com/mastra-ai/mastra/commit/85d7ee18ff4e14d625a8a30ec6656bb49804989b), [`c6c1092`](https://github.com/mastra-ai/mastra/commit/c6c1092f8fbf76109303f69e000e96fd1960c4ce), [`0491e7c`](https://github.com/mastra-ai/mastra/commit/0491e7c9b714cb0ba22187ee062147ec2dd7c712), [`f6f4903`](https://github.com/mastra-ai/mastra/commit/f6f4903397314f73362061dc5a3e8e7c61ea34aa), [`d5ed981`](https://github.com/mastra-ai/mastra/commit/d5ed981c8701c1b8a27a5f35a9a2f7d9244e695f), [`85a628b`](https://github.com/mastra-ai/mastra/commit/85a628b1224a8f64cd82ea7f033774bf22df7a7e), [`0e8ed46`](https://github.com/mastra-ai/mastra/commit/0e8ed467c54d6901a6a365f270ec15d6faadb36c), [`33a4d2e`](https://github.com/mastra-ai/mastra/commit/33a4d2e4ed8af51f69256232f00c34d6b6b51d48), [`9650cce`](https://github.com/mastra-ai/mastra/commit/9650cce52a1d917ff9114653398e2a0f5c3ba808), [`6c049d9`](https://github.com/mastra-ai/mastra/commit/6c049d94063fdcbd5b81c4912a2bf82a92c9cc0b), [`910db9e`](https://github.com/mastra-ai/mastra/commit/910db9e0312888495eb5617b567f247d03303814), [`2f897df`](https://github.com/mastra-ai/mastra/commit/2f897df208508f46f51b7625e5dd20c37f93e0e3), [`d629361`](https://github.com/mastra-ai/mastra/commit/d629361a60f6565b5bfb11976fdaf7308af858e2), [`4f94ed8`](https://github.com/mastra-ai/mastra/commit/4f94ed8177abfde3ec536e3574883e075423350c), [`feb7ee4`](https://github.com/mastra-ai/mastra/commit/feb7ee4d09a75edb46c6669a3beaceec78811747), [`4aaa844`](https://github.com/mastra-ai/mastra/commit/4aaa844a4f19d054490f43638a990cc57bda8d2f), [`c237233`](https://github.com/mastra-ai/mastra/commit/c23723399ccedf7f5744b3f40997b79246bfbe64), [`38380b6`](https://github.com/mastra-ai/mastra/commit/38380b60fca905824bdf6b43df307a58efb1aa15), [`6833c69`](https://github.com/mastra-ai/mastra/commit/6833c69607418d257750bbcdd84638993d343539), [`932d63d`](https://github.com/mastra-ai/mastra/commit/932d63dd51be9c8bf1e00e3671fe65606c6fb9cd), [`4a1a6cb`](https://github.com/mastra-ai/mastra/commit/4a1a6cb3facad54b2bb6780b00ce91d6de1edc08), [`08c31c1`](https://github.com/mastra-ai/mastra/commit/08c31c188ebccd598acaf55e888b6397d01f7eae), [`919a22b`](https://github.com/mastra-ai/mastra/commit/919a22b25876f9ed5891efe5facbe682c30ff497), [`15f9e21`](https://github.com/mastra-ai/mastra/commit/15f9e216177201ea6e3f6d0bfb063fcc0953444f), [`3443770`](https://github.com/mastra-ai/mastra/commit/3443770662df8eb24c9df3589b2792d78cfcb811), [`69136e7`](https://github.com/mastra-ai/mastra/commit/69136e748e32f57297728a4e0f9a75988462f1a7), [`b0e2ea5`](https://github.com/mastra-ai/mastra/commit/b0e2ea5b52c40fae438b9e2f7baee6f0f89c5442), [`f0a07e0`](https://github.com/mastra-ai/mastra/commit/f0a07e0111b3307c5fabfa4094c5c2cfb734fbe6), [`ff94dea`](https://github.com/mastra-ai/mastra/commit/ff94dea935f4e34545c63bcb6c29804732698809), [`0d41fe2`](https://github.com/mastra-ai/mastra/commit/0d41fe245355dfc66d61a0d9c85d9400aac351ff), [`b760b73`](https://github.com/mastra-ai/mastra/commit/b760b731aca7c8a3f041f61d57a7f125ae9cb215), [`aaa40e7`](https://github.com/mastra-ai/mastra/commit/aaa40e788628b319baa8e889407d11ad626547fa), [`1521d71`](https://github.com/mastra-ai/mastra/commit/1521d716e5daedc74690c983fbd961123c56756b), [`449aed2`](https://github.com/mastra-ai/mastra/commit/449aed2ba9d507b75bf93d427646ea94f734dfd1), [`eb648a2`](https://github.com/mastra-ai/mastra/commit/eb648a2cc1728f7678768dd70cd77619b448dab9), [`695a621`](https://github.com/mastra-ai/mastra/commit/695a621528bdabeb87f83c2277cf2bb084c7f2b4), [`9e1911d`](https://github.com/mastra-ai/mastra/commit/9e1911db2b4db85e0e768c3f15e0d61e319869f6), [`ac3cc23`](https://github.com/mastra-ai/mastra/commit/ac3cc2397d1966bc0fc2736a223abc449d3c7719), [`c456e01`](https://github.com/mastra-ai/mastra/commit/c456e0149e3c176afcefdbd9bb1d2c5917723725), [`ebac155`](https://github.com/mastra-ai/mastra/commit/ebac15564a590117db7078233f927a7e28a85106), [`a86f4df`](https://github.com/mastra-ai/mastra/commit/a86f4df0407311e0d2ea49b9a541f0938810d6a9), [`dd1c38d`](https://github.com/mastra-ai/mastra/commit/dd1c38d1b75f1b695c27b40d8d9d6ed00d5e0f6f), [`5948e6a`](https://github.com/mastra-ai/mastra/commit/5948e6a5146c83666ba3f294b2be576c82a513fb), [`5b2ff46`](https://github.com/mastra-ai/mastra/commit/5b2ff4651df70c146523a7fca773f8eb0a2272f8), [`edb07e4`](https://github.com/mastra-ai/mastra/commit/edb07e49283e0c28bd094a60e03439bf6ecf0221), [`e0941c3`](https://github.com/mastra-ai/mastra/commit/e0941c3d7fc75695d5d258e7008fd5d6e650800c), [`db41688`](https://github.com/mastra-ai/mastra/commit/db4168806d007417e2e60b4f68656dca4e5f40c9), [`2b459f4`](https://github.com/mastra-ai/mastra/commit/2b459f466fd91688eeb2a44801dc23f7f8a887ab), [`798d0c7`](https://github.com/mastra-ai/mastra/commit/798d0c740232653b1d754870e6b43a55c364ffe2), [`0c0580a`](https://github.com/mastra-ai/mastra/commit/0c0580a42f697cd2a7d5973f25bfe7da9055038a), [`8940859`](https://github.com/mastra-ai/mastra/commit/89408593658199b4ad67f7b65e888f344e64a442), [`486352b`](https://github.com/mastra-ai/mastra/commit/486352b66c746602b68a95839f830de14c7fb8c0), [`ab035c2`](https://github.com/mastra-ai/mastra/commit/ab035c2ef6d8cc7bb25f06f1a38508bd9e6f126b), [`e629310`](https://github.com/mastra-ai/mastra/commit/e629310f1a73fa236d49ec7a1d1cceb6229dc7cc), [`0131105`](https://github.com/mastra-ai/mastra/commit/0131105532e83bdcbb73352fc7d0879eebf140dc), [`5ca599d`](https://github.com/mastra-ai/mastra/commit/5ca599d0bb59a1595f19f58473fcd67cc71cef58), [`09e4bae`](https://github.com/mastra-ai/mastra/commit/09e4bae18dd5357d2ae078a4a95a2af32168ab08), [`47b1c16`](https://github.com/mastra-ai/mastra/commit/47b1c16a01c7ffb6765fe1e499b49092f8b7eba3), [`4c6b492`](https://github.com/mastra-ai/mastra/commit/4c6b492c4dd591c6a592520c1f6855d6e936d71f), [`bff1145`](https://github.com/mastra-ai/mastra/commit/bff114556b3cbadad9b2768488708f8ad0e91475), [`dff01d8`](https://github.com/mastra-ai/mastra/commit/dff01d81ce1f4e4087cfac20fa868e6db138dd14), [`9d5059e`](https://github.com/mastra-ai/mastra/commit/9d5059eae810829935fb08e81a9bb7ecd5b144a7), [`ffe84d5`](https://github.com/mastra-ai/mastra/commit/ffe84d54f3b0f85167fe977efd027dba027eb998), [`5c8ca24`](https://github.com/mastra-ai/mastra/commit/5c8ca247094e0cc2cdbd7137822fb47241f86e77), [`9d819d5`](https://github.com/mastra-ai/mastra/commit/9d819d54b61481639f4008e4694791bddf187edd), [`24b76d8`](https://github.com/mastra-ai/mastra/commit/24b76d8e17656269c8ed09a0c038adb9cc2ae95a), [`31d13d5`](https://github.com/mastra-ai/mastra/commit/31d13d5fdc2e2380e2e3ee3ec9fb29d2a00f265d), [`ef756c6`](https://github.com/mastra-ai/mastra/commit/ef756c65f82d16531c43f49a27290a416611e526), [`e191844`](https://github.com/mastra-ai/mastra/commit/e1918444ca3f80e82feef1dad506cd4ec6e2875f), [`243a823`](https://github.com/mastra-ai/mastra/commit/243a8239c5906f5c94e4f78b54676793f7510ae3), [`b00ccd3`](https://github.com/mastra-ai/mastra/commit/b00ccd325ebd5d9e37e34dd0a105caae67eb568f), [`28f5f89`](https://github.com/mastra-ai/mastra/commit/28f5f89705f2409921e3c45178796c0e0d0bbb64), [`22553f1`](https://github.com/mastra-ai/mastra/commit/22553f11c63ee5e966a9c034a349822249584691), [`4c62166`](https://github.com/mastra-ai/mastra/commit/4c621669f4a29b1f443eca3ba70b814afa286266), [`e601b27`](https://github.com/mastra-ai/mastra/commit/e601b272c70f3a5ecca610373aa6223012704892), [`7d56d92`](https://github.com/mastra-ai/mastra/commit/7d56d9213886e8353956d7d40df10045fd12b299), [`81dc110`](https://github.com/mastra-ai/mastra/commit/81dc11008d147cf5bdc8996ead1aa61dbdebb6fc), [`7bcbf10`](https://github.com/mastra-ai/mastra/commit/7bcbf10133516e03df964b941f9a34e9e4ab4177), [`029540c`](https://github.com/mastra-ai/mastra/commit/029540ca1e582fc2dd8d288ecd4a9b0f31a954ef), [`7237163`](https://github.com/mastra-ai/mastra/commit/72371635dbf96a87df4b073cc48fc655afbdce3d), [`2500740`](https://github.com/mastra-ai/mastra/commit/2500740ea23da067d6e50ec71c625ab3ce275e64), [`4353600`](https://github.com/mastra-ai/mastra/commit/43536005a65988a8eede236f69122e7f5a284ba2), [`653e65a`](https://github.com/mastra-ai/mastra/commit/653e65ae1f9502c2958a32f47a5a2df11e612a92), [`873ecbb`](https://github.com/mastra-ai/mastra/commit/873ecbb517586aa17d2f1e99283755b3ebb2863f), [`6986fb0`](https://github.com/mastra-ai/mastra/commit/6986fb064f5db6ecc24aa655e1d26529087b43b3), [`3d3366f`](https://github.com/mastra-ai/mastra/commit/3d3366f31683e7137d126a3a57174a222c5801fb), [`5a4953f`](https://github.com/mastra-ai/mastra/commit/5a4953f7d25bb15ca31ed16038092a39cb3f98b3), [`4f9bbe5`](https://github.com/mastra-ai/mastra/commit/4f9bbe5968f42c86f4930b8193de3c3c17e5bd36), [`efe406a`](https://github.com/mastra-ai/mastra/commit/efe406a1353c24993280ebc2ed61dd9f65b84b26), [`eb9e522`](https://github.com/mastra-ai/mastra/commit/eb9e522ce3070a405e5b949b7bf5609ca51d7fe2), [`fd3d338`](https://github.com/mastra-ai/mastra/commit/fd3d338a2c362174ed5b383f1f011ad9fb0302aa), [`20e6f19`](https://github.com/mastra-ai/mastra/commit/20e6f1971d51d3ff6dd7accad8aaaae826d540ed), [`053e979`](https://github.com/mastra-ai/mastra/commit/053e9793b28e970086b0507f7f3b76ea32c1e838), [`02e51fe`](https://github.com/mastra-ai/mastra/commit/02e51feddb3d4155cfbcc42624fd0d0970d032c0), [`71c8d6c`](https://github.com/mastra-ai/mastra/commit/71c8d6c161253207b2b9588bdadb7eed604f7253), [`7aedb74`](https://github.com/mastra-ai/mastra/commit/7aedb74883adf66af38e270e4068fd42e7a37036), [`3bdfa75`](https://github.com/mastra-ai/mastra/commit/3bdfa7507a91db66f176ba8221aa28dd546e464a), [`119e5c6`](https://github.com/mastra-ai/mastra/commit/119e5c65008f3e5cfca954eefc2eb85e3bf40da4), [`c6fd6fe`](https://github.com/mastra-ai/mastra/commit/c6fd6fedd09e9cf8004b03a80925f5e94826ad7e), [`8f02d80`](https://github.com/mastra-ai/mastra/commit/8f02d800777397e4b45d7f1ad041988a8b0c6630), [`fdac646`](https://github.com/mastra-ai/mastra/commit/fdac646033a0930a1a4e00d13aa64c40bb7f1e02), [`6179a9b`](https://github.com/mastra-ai/mastra/commit/6179a9ba36ffac326de3cc3c43cdc8028d37c251), [`8f3fa3a`](https://github.com/mastra-ai/mastra/commit/8f3fa3a652bb77da092f913ec51ae46e3a7e27dc), [`d07b568`](https://github.com/mastra-ai/mastra/commit/d07b5687819ea8cb1dffa776d0c1765faf4aa1ae), [`e770de9`](https://github.com/mastra-ai/mastra/commit/e770de941a287a49b1964d44db5a5763d19890a6), [`e26dc9c`](https://github.com/mastra-ai/mastra/commit/e26dc9c3ccfec54ae3dc3e2b2589f741f9ae60a6), [`55edf73`](https://github.com/mastra-ai/mastra/commit/55edf7302149d6c964fbb7908b43babfc2b52145), [`c30400a`](https://github.com/mastra-ai/mastra/commit/c30400a49b994b1b97256fe785eb6c906fc2b232), [`486352b`](https://github.com/mastra-ai/mastra/commit/486352b66c746602b68a95839f830de14c7fb8c0), [`00f4921`](https://github.com/mastra-ai/mastra/commit/00f4921dd2c91a1e5446799599ef7116a8214a1a), [`1a46a56`](https://github.com/mastra-ai/mastra/commit/1a46a566f45a3fcbadc1cf36bf86d351f264bfa3), [`ca8041c`](https://github.com/mastra-ai/mastra/commit/ca8041cce0379fda22ed293a565bcb5b6ddca68a), [`b5dc973`](https://github.com/mastra-ai/mastra/commit/b5dc9733a5158850298dfb103acb3babdba8a318), [`7051bf3`](https://github.com/mastra-ai/mastra/commit/7051bf38b3b122a069008f861f7bfc004a6d9f6e), [`a8f1494`](https://github.com/mastra-ai/mastra/commit/a8f1494f4bbdc2770bcf327d4c7d869e332183f1), [`52e2716`](https://github.com/mastra-ai/mastra/commit/52e2716b42df6eff443de72360ae83e86ec23993), [`d7aad50`](https://github.com/mastra-ai/mastra/commit/d7aad501ce61646b76b4b511e558ac4eea9884d0), [`4f0b3c6`](https://github.com/mastra-ai/mastra/commit/4f0b3c66f196c06448487f680ccbb614d281e2f7), [`27b4040`](https://github.com/mastra-ai/mastra/commit/27b4040bfa1a95d92546f420a02a626b1419a1d6), [`c61fac3`](https://github.com/mastra-ai/mastra/commit/c61fac3add96f0dcce0208c07415279e2537eb62), [`6f14f70`](https://github.com/mastra-ai/mastra/commit/6f14f706ccaaf81b69544b6c1b75ab66a41e5317), [`69e0a87`](https://github.com/mastra-ai/mastra/commit/69e0a878896a2da9494945d86e056a5f8f05b851), [`cd29ad2`](https://github.com/mastra-ai/mastra/commit/cd29ad23a255534e8191f249593849ed29160886), [`bdf4d8c`](https://github.com/mastra-ai/mastra/commit/bdf4d8cdc656d8a2c21d81834bfa3bfa70f56c16), [`854e3da`](https://github.com/mastra-ai/mastra/commit/854e3dad5daac17a91a20986399d3a51f54bf68b), [`ce18d38`](https://github.com/mastra-ai/mastra/commit/ce18d38678c65870350d123955014a8432075fd9), [`3cf540b`](https://github.com/mastra-ai/mastra/commit/3cf540b9fbfea8f4fc8d3a2319a4e6c0b0cbfd52), [`352a5d6`](https://github.com/mastra-ai/mastra/commit/352a5d625cfe09849b21e8f52a24c9f0366759d5), [`1c6ce51`](https://github.com/mastra-ai/mastra/commit/1c6ce51f875915ab57fd36873623013699a2a65d), [`74c4f22`](https://github.com/mastra-ai/mastra/commit/74c4f22ed4c71e72598eacc346ba95cdbc00294f), [`3a76a80`](https://github.com/mastra-ai/mastra/commit/3a76a80284cb71a0faa975abb3d4b2a9631e60cd), [`898a972`](https://github.com/mastra-ai/mastra/commit/898a9727d286c2510d6b702dfd367e6aaf5c6b0f), [`0793497`](https://github.com/mastra-ai/mastra/commit/079349753620c40246ffd673e3f9d7d9820beff3), [`09e4bae`](https://github.com/mastra-ai/mastra/commit/09e4bae18dd5357d2ae078a4a95a2af32168ab08), [`026b848`](https://github.com/mastra-ai/mastra/commit/026b8483fbf5b6d977be8f7e6aac8d15c75558ac), [`2c212e7`](https://github.com/mastra-ai/mastra/commit/2c212e704c90e2db83d4109e62c03f0f6ebd2667), [`a97003a`](https://github.com/mastra-ai/mastra/commit/a97003aa1cf2f4022a41912324a1e77263b326b8), [`f9a2509`](https://github.com/mastra-ai/mastra/commit/f9a25093ea72d210a5e52cfcb3bcc8b5e02dc25c), [`66741d1`](https://github.com/mastra-ai/mastra/commit/66741d1a99c4f42cf23a16109939e8348ac6852e), [`ccc141e`](https://github.com/mastra-ai/mastra/commit/ccc141ed27da0abc3a3fc28e9e5128152e8e37f4), [`27c0009`](https://github.com/mastra-ai/mastra/commit/27c0009777a6073d7631b0eb7b481d94e165b5ca), [`01f8878`](https://github.com/mastra-ai/mastra/commit/01f88783de25e4de048c1c8aace43e26373c6ea5), [`dee388d`](https://github.com/mastra-ai/mastra/commit/dee388dde02f2e63c53385ae69252a47ab6825cc), [`610a70b`](https://github.com/mastra-ai/mastra/commit/610a70bdad282079f0c630e0d7bb284578f20151), [`5df9cce`](https://github.com/mastra-ai/mastra/commit/5df9cce1a753438413f64c11eeef8f845745c2a8), [`b7e17d3`](https://github.com/mastra-ai/mastra/commit/b7e17d3f5390bb5a71efc112204413656fcdc18d), [`4c77209`](https://github.com/mastra-ai/mastra/commit/4c77209e6c11678808b365d545845918c40045c8), [`a854ede`](https://github.com/mastra-ai/mastra/commit/a854ede62bf5ac0945a624ac48913dd69c73aabf), [`fe3b897`](https://github.com/mastra-ai/mastra/commit/fe3b897c2ccbcd2b10e81b099438c7337feddf89), [`c576fc0`](https://github.com/mastra-ai/mastra/commit/c576fc0b100b2085afded91a37c97a0ea0ec09c7), [`3defc80`](https://github.com/mastra-ai/mastra/commit/3defc80cf2b88a1b7fc1cc4ddcb91e982a614609), [`00123ba`](https://github.com/mastra-ai/mastra/commit/00123ba96dc9e5cd0b110420ebdba56d8f237b25), [`16153fe`](https://github.com/mastra-ai/mastra/commit/16153fe7eb13c99401f48e6ca32707c965ee28b9), [`9f4a683`](https://github.com/mastra-ai/mastra/commit/9f4a6833e88b52574665c028fd5508ad5c2f6004), [`bc94344`](https://github.com/mastra-ai/mastra/commit/bc943444a1342d8a662151b7bce1df7dae32f59c), [`4ca4306`](https://github.com/mastra-ai/mastra/commit/4ca430614daa5fa04730205a302a43bf4accfe9f), [`cccf9c8`](https://github.com/mastra-ai/mastra/commit/cccf9c8b2d2dfc1a5e63919395b83d78c89682a0), [`74e504a`](https://github.com/mastra-ai/mastra/commit/74e504a3b584eafd2f198001c6a113bbec589fd3), [`29c4309`](https://github.com/mastra-ai/mastra/commit/29c4309f818b24304c041bcb4a8f19b5f13f6b62), [`16785ce`](https://github.com/mastra-ai/mastra/commit/16785ced928f6f22638f4488cf8a125d99211799), [`57d157f`](https://github.com/mastra-ai/mastra/commit/57d157f0b163a95c3e6c9eae31bdb11d1bfc64f9), [`61a5705`](https://github.com/mastra-ai/mastra/commit/61a570551278b6743e64243b3ce7d73de915ca8a), [`903f67d`](https://github.com/mastra-ai/mastra/commit/903f67d184504a273893818c02b961f5423a79ad), [`3f3fc30`](https://github.com/mastra-ai/mastra/commit/3f3fc3096f24c4a26cffeecfe73085928f72aa63), [`d827d08`](https://github.com/mastra-ai/mastra/commit/d827d0808ffe1f3553a84e975806cc989b9735dd), [`e33fdbd`](https://github.com/mastra-ai/mastra/commit/e33fdbd07b33920d81e823122331b0c0bee0bb59), [`4524734`](https://github.com/mastra-ai/mastra/commit/45247343e384717a7c8404296275c56201d6470f), [`7a010c5`](https://github.com/mastra-ai/mastra/commit/7a010c56b846a313a49ae42fccd3d8de2b9f292d), [`2a90c55`](https://github.com/mastra-ai/mastra/commit/2a90c55a86a9210697d5adaab5ee94584b079adc), [`2a53598`](https://github.com/mastra-ai/mastra/commit/2a53598c6d8cfeb904a7fc74e57e526d751c8fa6), [`81b6a8f`](https://github.com/mastra-ai/mastra/commit/81b6a8ff79f49a7549d15d66624ac1a0b8f5f971), [`8538a0d`](https://github.com/mastra-ai/mastra/commit/8538a0d232619bf55dad7ddc2a8b0ca77c679a87), [`d90ea65`](https://github.com/mastra-ai/mastra/commit/d90ea6536f7aa51c6545a4e9215b55858e98e16d), [`db70a48`](https://github.com/mastra-ai/mastra/commit/db70a48aeeeeb8e5f92007e8ede52c364ce15287), [`261473a`](https://github.com/mastra-ai/mastra/commit/261473ac637e633064a22076671e2e02b002214d), [`eb09742`](https://github.com/mastra-ai/mastra/commit/eb09742197f66c4c38154c3beec78313e69760b2), [`de8239b`](https://github.com/mastra-ai/mastra/commit/de8239bdcb1d8c0cfa06da21f1569912a66bbc8a), [`e4d366a`](https://github.com/mastra-ai/mastra/commit/e4d366aeb500371dd4210d6aa8361a4c21d87034), [`23c10a1`](https://github.com/mastra-ai/mastra/commit/23c10a1efdd9a693c405511ab2dc8a1236603162), [`b5e6cd7`](https://github.com/mastra-ai/mastra/commit/b5e6cd77fc8c8e64e0494c1d06cee3d84e795d1e), [`d171e55`](https://github.com/mastra-ai/mastra/commit/d171e559ead9f52ec728d424844c8f7b164c4510), [`f0fdc14`](https://github.com/mastra-ai/mastra/commit/f0fdc14ee233d619266b3d2bbdeea7d25cfc6d13), [`a4f010b`](https://github.com/mastra-ai/mastra/commit/a4f010b22e4355a5fdee70a1fe0f6e4a692cc29e), [`c7cd3c7`](https://github.com/mastra-ai/mastra/commit/c7cd3c7a187d7aaf79e2ca139de328bf609a14b4), [`db18bc9`](https://github.com/mastra-ai/mastra/commit/db18bc9c3825e2c1a0ad9a183cc9935f6691bfa1), [`96d35f6`](https://github.com/mastra-ai/mastra/commit/96d35f61376bc2b1bf148648a2c1985bd51bef55), [`68ec97d`](https://github.com/mastra-ai/mastra/commit/68ec97d4c07c6393fcf95c2481fc5d73da99f8c8), [`8dc7f55`](https://github.com/mastra-ai/mastra/commit/8dc7f55900395771da851dc7d78d53ae84fe34ec), [`cfabdd4`](https://github.com/mastra-ai/mastra/commit/cfabdd4aae7a726b706942d6836eeca110fb6267), [`9b37b56`](https://github.com/mastra-ai/mastra/commit/9b37b565e1f2a76c24f728945cc740c2b09be9da), [`01b20fe`](https://github.com/mastra-ai/mastra/commit/01b20fefb7c67c2b7d79417598ef4e60256d1225), [`dd4f34c`](https://github.com/mastra-ai/mastra/commit/dd4f34c78cbae24063463475b0619575c415f9b8), [`8379099`](https://github.com/mastra-ai/mastra/commit/8379099fc467af6bef54dd7f80c9bd75bf8bbddf), [`0dbf199`](https://github.com/mastra-ai/mastra/commit/0dbf199110f22192ce5c95b1c8148d4872b4d119), [`5cbe88a`](https://github.com/mastra-ai/mastra/commit/5cbe88aefbd9f933bca669fd371ea36bf939ac6d), [`41a23c3`](https://github.com/mastra-ai/mastra/commit/41a23c32f9877d71810f37e24930515df2ff7a0f), [`a1bd7b8`](https://github.com/mastra-ai/mastra/commit/a1bd7b8571db16b94eb01588f451a74758c96d65), [`d78b38d`](https://github.com/mastra-ai/mastra/commit/d78b38d898fce285260d3bbb4befade54331617f), [`a0a5b4b`](https://github.com/mastra-ai/mastra/commit/a0a5b4bbebe6c701ebbadf744873aa0d5ca01371), [`ce0a73a`](https://github.com/mastra-ai/mastra/commit/ce0a73abeaa75b10ca38f9e40a255a645d50ebfb), [`5d171ad`](https://github.com/mastra-ai/mastra/commit/5d171ad9ef340387276b77c2bb3e83e83332d729), [`0633100`](https://github.com/mastra-ai/mastra/commit/0633100a911ad22f5256471bdf753da21c104742), [`3759cb0`](https://github.com/mastra-ai/mastra/commit/3759cb064935b5f74c65ac2f52a1145f7352899d), [`929f69c`](https://github.com/mastra-ai/mastra/commit/929f69c3436fa20dd0f0e2f7ebe8270bd82a1529), [`c710c16`](https://github.com/mastra-ai/mastra/commit/c710c1652dccfdc4111c8412bca7a6bb1d48b441), [`10c2735`](https://github.com/mastra-ai/mastra/commit/10c27355edfdad1ee2b826b897df74125eb81fb8), [`354ad0b`](https://github.com/mastra-ai/mastra/commit/354ad0b7b1b8183ac567f236a884fc7ede6d7138), [`cfae733`](https://github.com/mastra-ai/mastra/commit/cfae73394f4920635e6c919c8e95ff9a0788e2e5), [`8c0ec25`](https://github.com/mastra-ai/mastra/commit/8c0ec25646c8a7df253ed1e5ff4863a0d3f1316c), [`e3dfda7`](https://github.com/mastra-ai/mastra/commit/e3dfda7b11bf3b8c4bb55637028befb5f387fc74), [`69ea758`](https://github.com/mastra-ai/mastra/commit/69ea758358edd7117f191c2e69c8bb5fc79e7a1a), [`73b0bb3`](https://github.com/mastra-ai/mastra/commit/73b0bb394dba7c9482eb467a97ab283dbc0ef4db), [`651e772`](https://github.com/mastra-ai/mastra/commit/651e772eb1475fb13e126d3fcc01751297a88214), [`a02e542`](https://github.com/mastra-ai/mastra/commit/a02e542d23179bad250b044b17ff023caa61739f), [`f03ae60`](https://github.com/mastra-ai/mastra/commit/f03ae60500fe350c9d828621006cdafe1975fdd8), [`6b3ba91`](https://github.com/mastra-ai/mastra/commit/6b3ba91494cc10394df96782f349a4f7b1e152cc), [`a372c64`](https://github.com/mastra-ai/mastra/commit/a372c640ad1fd12e8f0613cebdc682fc156b4d95), [`993ad98`](https://github.com/mastra-ai/mastra/commit/993ad98d7ad3bebda9ecef5fec5c94349a0d04bc), [`676ccc7`](https://github.com/mastra-ai/mastra/commit/676ccc7fe92468d2d45d39c31a87825c89fd1ea0), [`3ff2c17`](https://github.com/mastra-ai/mastra/commit/3ff2c17a58e312fad5ea37377262c12d92ca0908), [`a0e437f`](https://github.com/mastra-ai/mastra/commit/a0e437fac561b28ee719e0302d72b2f9b4c138f0), [`d1e74a0`](https://github.com/mastra-ai/mastra/commit/d1e74a0a293866dece31022047f5dbab65a304d0), [`844ea5d`](https://github.com/mastra-ai/mastra/commit/844ea5dc0c248961e7bf73629ae7dcff503e853c), [`5627a8c`](https://github.com/mastra-ai/mastra/commit/5627a8c6dc11fe3711b3fa7a6ffd6eb34100a306), [`398fde3`](https://github.com/mastra-ai/mastra/commit/398fde3f39e707cda79372cdae8f9870e3b57c8d), [`c10398d`](https://github.com/mastra-ai/mastra/commit/c10398d5b88f1d4af556f4267ff06f1d11e89179), [`3ff45d1`](https://github.com/mastra-ai/mastra/commit/3ff45d10e0c80c5335a957ab563da72feb623520), [`f0f8f12`](https://github.com/mastra-ai/mastra/commit/f0f8f125c308f2d0fd36942ef652fd852df7522f), [`b61b93f`](https://github.com/mastra-ai/mastra/commit/b61b93f9e058b11dd2eec169853175d31dbdd567), [`bae33d9`](https://github.com/mastra-ai/mastra/commit/bae33d91a63fbb64d1e80519e1fc1acaed1e9013), [`39e7869`](https://github.com/mastra-ai/mastra/commit/39e7869bc7d0ee391077ce291474d8a84eedccff), [`0d7618b`](https://github.com/mastra-ai/mastra/commit/0d7618bc650bf2800934b243eca5648f4aeed9c2), [`7b763e5`](https://github.com/mastra-ai/mastra/commit/7b763e52fc3eaf699c2a99f2adf418dd46e4e9a5), [`251df45`](https://github.com/mastra-ai/mastra/commit/251df4531407dfa46d805feb40ff3fb49769f455), [`d36cfbb`](https://github.com/mastra-ai/mastra/commit/d36cfbbb6565ba5f827883cc9bb648eb14befdc1), [`f894d14`](https://github.com/mastra-ai/mastra/commit/f894d148946629af7b1f452d65a9cf864cec3765), [`8846867`](https://github.com/mastra-ai/mastra/commit/8846867ffa9a3746767618e314bebac08eb77d87), [`1924cf0`](https://github.com/mastra-ai/mastra/commit/1924cf06816e5e4d4d5333065ec0f4bb02a97799), [`c0b731f`](https://github.com/mastra-ai/mastra/commit/c0b731fb27d712dc8582e846df5c0332a6a0c5ba), [`5761926`](https://github.com/mastra-ai/mastra/commit/57619260c4a2cdd598763abbacd90de594c6bc76), [`c2b9547`](https://github.com/mastra-ai/mastra/commit/c2b9547bf435f56339f23625a743b2147ab1c7a6), [`3697853`](https://github.com/mastra-ai/mastra/commit/3697853deeb72017d90e0f38a93c1e29221aeca0), [`c900fdd`](https://github.com/mastra-ai/mastra/commit/c900fdd504c41348efdffb205cfe80d48c38fa33), [`9312dcd`](https://github.com/mastra-ai/mastra/commit/9312dcd1c6f5b321929e7d382e763d95fdc030f5), [`b2e45ec`](https://github.com/mastra-ai/mastra/commit/b2e45eca727a8db01a81ba93f1a5219c7183c839), [`5d7000f`](https://github.com/mastra-ai/mastra/commit/5d7000f757cd65ea9dc5b05e662fd83dfd44e932), [`43ca8f2`](https://github.com/mastra-ai/mastra/commit/43ca8f2c7334851cc7b4d3d2f037d8784bfbdd5f), [`d6d49f7`](https://github.com/mastra-ai/mastra/commit/d6d49f7b8714fa19a52ff9c7cf7fb7e73751901e), [`00c2387`](https://github.com/mastra-ai/mastra/commit/00c2387f5f04a365316f851e58666ac43f8c4edf), [`a534e95`](https://github.com/mastra-ai/mastra/commit/a534e9591f83b3cc1ebff99c67edf4cda7bf81d3), [`9d0e7fe`](https://github.com/mastra-ai/mastra/commit/9d0e7feca8ed98de959f53476ee1456073673348), [`53d927c`](https://github.com/mastra-ai/mastra/commit/53d927cc6f03bff33655b7e2b788da445a08731d), [`ad6250d`](https://github.com/mastra-ai/mastra/commit/ad6250dbdaad927e29f74a27b83f6c468b50a705), [`580b592`](https://github.com/mastra-ai/mastra/commit/580b5927afc82fe460dfdf9a38a902511b6b7e7f), [`604a79f`](https://github.com/mastra-ai/mastra/commit/604a79fecf276e26a54a3fe01bb94e65315d2e0e), [`42a42cf`](https://github.com/mastra-ai/mastra/commit/42a42cf3132b9786feecbb8c13c583dce5b0e198), [`3f2faf2`](https://github.com/mastra-ai/mastra/commit/3f2faf2e2d685d6c053cc5af1bf9fedf267b2ce5), [`22f64bc`](https://github.com/mastra-ai/mastra/commit/22f64bc1d37149480b58bf2fefe35b79a1e3e7d5), [`ff4d9a6`](https://github.com/mastra-ai/mastra/commit/ff4d9a6704fc87b31a380a76ed22736fdedbba5a), [`50fd320`](https://github.com/mastra-ai/mastra/commit/50fd320003d0d93831c230ef531bef41f5ba7b3a), [`847c212`](https://github.com/mastra-ai/mastra/commit/847c212caba7df0d6f2fc756b494ac3c75c3720d), [`69821ef`](https://github.com/mastra-ai/mastra/commit/69821ef806482e2c44e2197ac0b050c3fe3a5285), [`3a73998`](https://github.com/mastra-ai/mastra/commit/3a73998fa4ebeb7f3dc9301afe78095fc63e7999), [`ffa553a`](https://github.com/mastra-ai/mastra/commit/ffa553a3edc1bd17d73669fba66d6b6f4ac10897), [`83d5942`](https://github.com/mastra-ai/mastra/commit/83d5942669ce7bba4a6ca4fd4da697a10eb5ebdc), [`58e3931`](https://github.com/mastra-ai/mastra/commit/58e3931af9baa5921688566210f00fb0c10479fa), [`ae08bf0`](https://github.com/mastra-ai/mastra/commit/ae08bf0ebc6a4e4da992b711c4a389c32ba84cf4), [`0bed332`](https://github.com/mastra-ai/mastra/commit/0bed332843f627202c6520eaf671771313cd20f3), [`887f0b4`](https://github.com/mastra-ai/mastra/commit/887f0b4746cdbd7cb7d6b17ac9f82aeb58037ea5), [`2562143`](https://github.com/mastra-ai/mastra/commit/256214336b4faa78646c9c1776612393790d8784), [`b7959e6`](https://github.com/mastra-ai/mastra/commit/b7959e6e25a46b480f9ea2217c4c6c588c423791), [`a7ce182`](https://github.com/mastra-ai/mastra/commit/a7ce1822a8785ce45d62dd5c911af465e144f7d7), [`bda6370`](https://github.com/mastra-ai/mastra/commit/bda637009360649aaf579919e7873e33553c273e), [`d7acd8e`](https://github.com/mastra-ai/mastra/commit/d7acd8e987b5d7eff4fd98b0906c17c06a2e83d5), [`c7f1f7d`](https://github.com/mastra-ai/mastra/commit/c7f1f7d24f61f247f018cc2d1f33bf63212959a7), [`0bddc6d`](https://github.com/mastra-ai/mastra/commit/0bddc6d8dbd6f6008c0cba2e4960a2da75a55af1), [`bec5efd`](https://github.com/mastra-ai/mastra/commit/bec5efde96653ccae6604e68c696d1bc6c1a0bf5), [`5947fcd`](https://github.com/mastra-ai/mastra/commit/5947fcdd425531f29f9422026d466c2ee3113c93), [`4aa55b3`](https://github.com/mastra-ai/mastra/commit/4aa55b383cf06043943359ea316572fd969861a7), [`21735a7`](https://github.com/mastra-ai/mastra/commit/21735a7ef306963554a69a89b44f06c3bcd85141), [`735d8c1`](https://github.com/mastra-ai/mastra/commit/735d8c1c0d19fbc09e6f8b66cf41bc7655993838), [`7907fd1`](https://github.com/mastra-ai/mastra/commit/7907fd1c5059813b7b870b81ca71041dc807331b), [`1ed5716`](https://github.com/mastra-ai/mastra/commit/1ed5716830867b3774c4a1b43cc0d82935f32b96), [`acf322e`](https://github.com/mastra-ai/mastra/commit/acf322e0f1fd0189684cf529d91c694bea918a45), [`2ca67cc`](https://github.com/mastra-ai/mastra/commit/2ca67cc3bb1f6a617353fdcab197d9efebe60d6f), [`9eedf7d`](https://github.com/mastra-ai/mastra/commit/9eedf7de1d6e0022a2f4e5e9e6fe1ec468f9b43c), [`b339816`](https://github.com/mastra-ai/mastra/commit/b339816df0984d0243d944ac2655d6ba5f809cde), [`e16d553`](https://github.com/mastra-ai/mastra/commit/e16d55338403c7553531cc568125c63d53653dff), [`6f941c4`](https://github.com/mastra-ai/mastra/commit/6f941c438ca5f578619788acc7608fc2e23bd176), [`4186bdd`](https://github.com/mastra-ai/mastra/commit/4186bdd00731305726fa06adba0b076a1d50b49f), [`08bb631`](https://github.com/mastra-ai/mastra/commit/08bb631ae2b14684b2678e3549d0b399a6f0561e), [`c942802`](https://github.com/mastra-ai/mastra/commit/c942802a477a925b01859a7b8688d4355715caaa), [`4f0331a`](https://github.com/mastra-ai/mastra/commit/4f0331a79bf6eb5ee598a5086e55de4b5a0ada03), [`a0c8c1b`](https://github.com/mastra-ai/mastra/commit/a0c8c1b87d4fee252aebda73e8637fbe01d761c9), [`1d877b8`](https://github.com/mastra-ai/mastra/commit/1d877b8d7b536a251c1a7a18db7ddcf4f68d6f8b), [`cc34739`](https://github.com/mastra-ai/mastra/commit/cc34739c34b6266a91bea561119240a7acf47887), [`c218bd3`](https://github.com/mastra-ai/mastra/commit/c218bd3759e32423735b04843a09404572631014), [`9e67002`](https://github.com/mastra-ai/mastra/commit/9e67002b52c9be19936c420a489dbee9c5fd6a78), [`7aaf973`](https://github.com/mastra-ai/mastra/commit/7aaf973f83fbbe9521f1f9e7a4fd99b8de464617), [`2c4438b`](https://github.com/mastra-ai/mastra/commit/2c4438b87817ab7eed818c7990fef010475af1a3), [`35edc49`](https://github.com/mastra-ai/mastra/commit/35edc49ac0556db609189641d6341e76771b81fc), [`4d59f58`](https://github.com/mastra-ai/mastra/commit/4d59f58de2d90d6e2810a19d4518e38ddddb9038), [`ef11a61`](https://github.com/mastra-ai/mastra/commit/ef11a61920fa0ed08a5b7ceedd192875af119749), [`2b8893c`](https://github.com/mastra-ai/mastra/commit/2b8893cb108ef9acb72ee7835cd625610d2c1a4a), [`8e5c75b`](https://github.com/mastra-ai/mastra/commit/8e5c75bdb1d08a42d45309a4c72def4b6890230f), [`e1bb9c9`](https://github.com/mastra-ai/mastra/commit/e1bb9c94b4eb68b019ae275981be3feb769b5365), [`351a11f`](https://github.com/mastra-ai/mastra/commit/351a11fcaf2ed1008977fa9b9a489fc422e51cd4), [`8a73529`](https://github.com/mastra-ai/mastra/commit/8a73529ca01187f604b1f3019d0a725ac63ae55f), [`e59e0d3`](https://github.com/mastra-ai/mastra/commit/e59e0d32afb5fcf2c9f3c00c8f81f6c21d3a63fa), [`4fba91b`](https://github.com/mastra-ai/mastra/commit/4fba91bec7c95911dc28e369437596b152b04cd0), [`465ac05`](https://github.com/mastra-ai/mastra/commit/465ac0526a91d175542091c675181f1a96c98c46), [`fa8409b`](https://github.com/mastra-ai/mastra/commit/fa8409bc39cfd8ba6643b9db5269b90b22e2a2f7), [`8a000da`](https://github.com/mastra-ai/mastra/commit/8a000da0c09c679a2312f6b3aa05b2ca78ca7393), [`e7266a2`](https://github.com/mastra-ai/mastra/commit/e7266a278db02035c97a5e9cd9d1669a6b7a535d), [`173c535`](https://github.com/mastra-ai/mastra/commit/173c535c0645b0da404fe09f003778f0b0d4e019), [`12b0cc4`](https://github.com/mastra-ai/mastra/commit/12b0cc4077d886b1a552637dedb70a7ade93528c), [`3bf6c5f`](https://github.com/mastra-ai/mastra/commit/3bf6c5f104c25226cd84e0c77f9dec15f2cac2db)]:
  - @mastra/core@1.0.0

## 1.0.0-beta.27

### Patch Changes

- Updated dependencies [[`50fd320`](https://github.com/mastra-ai/mastra/commit/50fd320003d0d93831c230ef531bef41f5ba7b3a)]:
  - @mastra/core@1.0.0-beta.27

## 1.0.0-beta.26

### Patch Changes

- Improve type handling with Zod ([#12091](https://github.com/mastra-ai/mastra/pull/12091))

- Updated dependencies [[`026b848`](https://github.com/mastra-ai/mastra/commit/026b8483fbf5b6d977be8f7e6aac8d15c75558ac), [`ffa553a`](https://github.com/mastra-ai/mastra/commit/ffa553a3edc1bd17d73669fba66d6b6f4ac10897)]:
  - @mastra/core@1.0.0-beta.26

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

- Fix navigation for processors Studio tab ([#12062](https://github.com/mastra-ai/mastra/pull/12062))

- Added new /api/processors endpoints to list, get details, and execute processors. Processor workflows are now auto-detected based on their schema. ([#12059](https://github.com/mastra-ai/mastra/pull/12059))

- Updated dependencies [[`ed3e3dd`](https://github.com/mastra-ai/mastra/commit/ed3e3ddec69d564fe2b125e083437f76331f1283), [`6833c69`](https://github.com/mastra-ai/mastra/commit/6833c69607418d257750bbcdd84638993d343539), [`47b1c16`](https://github.com/mastra-ai/mastra/commit/47b1c16a01c7ffb6765fe1e499b49092f8b7eba3), [`3a76a80`](https://github.com/mastra-ai/mastra/commit/3a76a80284cb71a0faa975abb3d4b2a9631e60cd), [`8538a0d`](https://github.com/mastra-ai/mastra/commit/8538a0d232619bf55dad7ddc2a8b0ca77c679a87), [`9312dcd`](https://github.com/mastra-ai/mastra/commit/9312dcd1c6f5b321929e7d382e763d95fdc030f5)]:
  - @mastra/core@1.0.0-beta.25

## 1.0.0-beta.24

### Patch Changes

- Updated dependencies [[`1dbd8c7`](https://github.com/mastra-ai/mastra/commit/1dbd8c729fb6536ec52f00064d76b80253d346e9), [`c59e13c`](https://github.com/mastra-ai/mastra/commit/c59e13c7688284bd96b2baee3e314335003548de), [`f9a2509`](https://github.com/mastra-ai/mastra/commit/f9a25093ea72d210a5e52cfcb3bcc8b5e02dc25c), [`7a010c5`](https://github.com/mastra-ai/mastra/commit/7a010c56b846a313a49ae42fccd3d8de2b9f292d)]:
  - @mastra/core@1.0.0-beta.24

## 1.0.0-beta.23

### Patch Changes

- Updated dependencies [[`c8417b4`](https://github.com/mastra-ai/mastra/commit/c8417b41d9f3486854dc7842d977fbe5e2166264), [`dd4f34c`](https://github.com/mastra-ai/mastra/commit/dd4f34c78cbae24063463475b0619575c415f9b8)]:
  - @mastra/core@1.0.0-beta.23

## 1.0.0-beta.22

### Major Changes

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

### Patch Changes

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

- Fixed orderBy query parameter parsing for memory endpoints. The listMessages and listThreads endpoints now correctly parse orderBy when passed as a JSON string in URL query parameters, matching the existing behavior for include and filter parameters. ([#11767](https://github.com/mastra-ai/mastra/pull/11767))

- Add human-in-the-loop (HITL) support to agent networks ([#11678](https://github.com/mastra-ai/mastra/pull/11678))
  - Add suspend/resume capabilities to agent network
  - Enable auto-resume for suspended network execution via `autoResumeSuspendedTools`

  `agent.resumeNetwork`, `agent.approveNetworkToolCall`, `agent.declineNetworkToolCall`

- Fix 'Memory is not initialized' error in playground for agents with sub-agents but no memory ([#11780](https://github.com/mastra-ai/mastra/pull/11780))

  When using agents with sub-agents (e.g., agent networks) but no memory configured, the playground UI would log HTTPException errors when fetching messages for sub-agents without memory.

  Changed GET /api/memory/threads/:threadId/messages to return empty messages `{ messages: [], uiMessages: [] }` instead of throwing 400 error when memory is not configured for the requested agent.

- Updated dependencies [[`ebae12a`](https://github.com/mastra-ai/mastra/commit/ebae12a2dd0212e75478981053b148a2c246962d), [`c61a0a5`](https://github.com/mastra-ai/mastra/commit/c61a0a5de4904c88fd8b3718bc26d1be1c2ec6e7), [`69136e7`](https://github.com/mastra-ai/mastra/commit/69136e748e32f57297728a4e0f9a75988462f1a7), [`449aed2`](https://github.com/mastra-ai/mastra/commit/449aed2ba9d507b75bf93d427646ea94f734dfd1), [`eb648a2`](https://github.com/mastra-ai/mastra/commit/eb648a2cc1728f7678768dd70cd77619b448dab9), [`0131105`](https://github.com/mastra-ai/mastra/commit/0131105532e83bdcbb73352fc7d0879eebf140dc), [`9d5059e`](https://github.com/mastra-ai/mastra/commit/9d5059eae810829935fb08e81a9bb7ecd5b144a7), [`ef756c6`](https://github.com/mastra-ai/mastra/commit/ef756c65f82d16531c43f49a27290a416611e526), [`b00ccd3`](https://github.com/mastra-ai/mastra/commit/b00ccd325ebd5d9e37e34dd0a105caae67eb568f), [`3bdfa75`](https://github.com/mastra-ai/mastra/commit/3bdfa7507a91db66f176ba8221aa28dd546e464a), [`e770de9`](https://github.com/mastra-ai/mastra/commit/e770de941a287a49b1964d44db5a5763d19890a6), [`52e2716`](https://github.com/mastra-ai/mastra/commit/52e2716b42df6eff443de72360ae83e86ec23993), [`27b4040`](https://github.com/mastra-ai/mastra/commit/27b4040bfa1a95d92546f420a02a626b1419a1d6), [`610a70b`](https://github.com/mastra-ai/mastra/commit/610a70bdad282079f0c630e0d7bb284578f20151), [`8dc7f55`](https://github.com/mastra-ai/mastra/commit/8dc7f55900395771da851dc7d78d53ae84fe34ec), [`8379099`](https://github.com/mastra-ai/mastra/commit/8379099fc467af6bef54dd7f80c9bd75bf8bbddf), [`8c0ec25`](https://github.com/mastra-ai/mastra/commit/8c0ec25646c8a7df253ed1e5ff4863a0d3f1316c), [`ff4d9a6`](https://github.com/mastra-ai/mastra/commit/ff4d9a6704fc87b31a380a76ed22736fdedbba5a), [`69821ef`](https://github.com/mastra-ai/mastra/commit/69821ef806482e2c44e2197ac0b050c3fe3a5285), [`1ed5716`](https://github.com/mastra-ai/mastra/commit/1ed5716830867b3774c4a1b43cc0d82935f32b96), [`4186bdd`](https://github.com/mastra-ai/mastra/commit/4186bdd00731305726fa06adba0b076a1d50b49f), [`7aaf973`](https://github.com/mastra-ai/mastra/commit/7aaf973f83fbbe9521f1f9e7a4fd99b8de464617)]:
  - @mastra/core@1.0.0-beta.22

## 1.0.0-beta.21

### Patch Changes

- Replace deprecated client.getTraces with a client.listTraces ([#11711](https://github.com/mastra-ai/mastra/pull/11711))

- Fix query parameter parsing for complex nested optional types ([#11711](https://github.com/mastra-ai/mastra/pull/11711))

  Fixes an issue where complex query parameters (like `startedAt` and `endedAt` date range filters) would fail with "Expected object, received string" errors when using the `listTraces` API.

  The fix addresses two issues:
  - Properly unwraps all layers of nested optional/nullable types (e.g., from `.partial()` on already-optional fields)
  - Ensures compatibility with both zod v3 and v4

- Updated dependencies [[`08766f1`](https://github.com/mastra-ai/mastra/commit/08766f15e13ac0692fde2a8bd366c2e16e4321df), [`ae8baf7`](https://github.com/mastra-ai/mastra/commit/ae8baf7d8adcb0ff9dac11880400452bc49b33ff), [`cfabdd4`](https://github.com/mastra-ai/mastra/commit/cfabdd4aae7a726b706942d6836eeca110fb6267), [`a0e437f`](https://github.com/mastra-ai/mastra/commit/a0e437fac561b28ee719e0302d72b2f9b4c138f0), [`bec5efd`](https://github.com/mastra-ai/mastra/commit/bec5efde96653ccae6604e68c696d1bc6c1a0bf5), [`9eedf7d`](https://github.com/mastra-ai/mastra/commit/9eedf7de1d6e0022a2f4e5e9e6fe1ec468f9b43c)]:
  - @mastra/core@1.0.0-beta.21

## 1.0.0-beta.20

### Minor Changes

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

- Add embedded documentation support for Mastra packages ([#11472](https://github.com/mastra-ai/mastra/pull/11472))

  Mastra packages now include embedded documentation in the published npm package under `dist/docs/`. This enables coding agents and AI assistants to understand and use the framework by reading documentation directly from `node_modules`.

  Each package includes:
  - **SKILL.md** - Entry point explaining the package's purpose and capabilities
  - **SOURCE_MAP.json** - Machine-readable index mapping exports to types and implementation files
  - **Topic folders** - Conceptual documentation organized by feature area

  Documentation is driven by the `packages` frontmatter field in MDX files, which maps docs to their corresponding packages. CI validation ensures all docs include this field.

- Remove `streamVNext`, `resumeStreamVNext`, and `observeStreamVNext` methods, call `stream`, `resumeStream` and `observeStream` directly ([#11499](https://github.com/mastra-ai/mastra/pull/11499))

  ```diff
  + const run = await workflow.createRun({ runId: '123' });
  - const stream = await run.streamVNext({ inputData: { ... } });
  + const stream = await run.stream({ inputData: { ... } });
  ```

- Fixed inconsistent query parameter handling across server adapters. ([#11429](https://github.com/mastra-ai/mastra/pull/11429))

  **What changed:** Query parameters are now processed consistently across all server adapters (Express, Hono, Fastify, Koa). Added internal helper `normalizeQueryParams` and `ParsedRequestParams` type to `@mastra/server` for adapter implementations.

  **Why:** Different HTTP frameworks handle query parameters differently - some return single strings while others return arrays for repeated params like `?tag=a&tag=b`. This caused type inconsistencies that could lead to validation failures in certain adapters.

  **User impact:** None for typical usage - HTTP endpoints and client SDK behavior are unchanged. If you extend server adapter classes and override `getParams` or `parseQueryParams`, update your implementation to use `Record<string, string | string[]>` for query parameters.

- Add initial state input to workflow form in studio ([#11560](https://github.com/mastra-ai/mastra/pull/11560))

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

- Make agentId optional for memory read operations (getThread, listThreads, listMessages) ([#11540](https://github.com/mastra-ai/mastra/pull/11540))

  When workflows use multiple agents sharing the same threadId/resourceId, users can now retrieve threads and messages without specifying an agentId. The server falls back to using storage directly when agentId is not provided.

- Updated dependencies [[`d2d3e22`](https://github.com/mastra-ai/mastra/commit/d2d3e22a419ee243f8812a84e3453dd44365ecb0), [`bc72b52`](https://github.com/mastra-ai/mastra/commit/bc72b529ee4478fe89ecd85a8be47ce0127b82a0), [`05b8bee`](https://github.com/mastra-ai/mastra/commit/05b8bee9e50e6c2a4a2bf210eca25ee212ca24fa), [`c042bd0`](https://github.com/mastra-ai/mastra/commit/c042bd0b743e0e86199d0cb83344ca7690e34a9c), [`940a2b2`](https://github.com/mastra-ai/mastra/commit/940a2b27480626ed7e74f55806dcd2181c1dd0c2), [`e0941c3`](https://github.com/mastra-ai/mastra/commit/e0941c3d7fc75695d5d258e7008fd5d6e650800c), [`0c0580a`](https://github.com/mastra-ai/mastra/commit/0c0580a42f697cd2a7d5973f25bfe7da9055038a), [`28f5f89`](https://github.com/mastra-ai/mastra/commit/28f5f89705f2409921e3c45178796c0e0d0bbb64), [`e601b27`](https://github.com/mastra-ai/mastra/commit/e601b272c70f3a5ecca610373aa6223012704892), [`3d3366f`](https://github.com/mastra-ai/mastra/commit/3d3366f31683e7137d126a3a57174a222c5801fb), [`5a4953f`](https://github.com/mastra-ai/mastra/commit/5a4953f7d25bb15ca31ed16038092a39cb3f98b3), [`eb9e522`](https://github.com/mastra-ai/mastra/commit/eb9e522ce3070a405e5b949b7bf5609ca51d7fe2), [`20e6f19`](https://github.com/mastra-ai/mastra/commit/20e6f1971d51d3ff6dd7accad8aaaae826d540ed), [`4f0b3c6`](https://github.com/mastra-ai/mastra/commit/4f0b3c66f196c06448487f680ccbb614d281e2f7), [`74c4f22`](https://github.com/mastra-ai/mastra/commit/74c4f22ed4c71e72598eacc346ba95cdbc00294f), [`81b6a8f`](https://github.com/mastra-ai/mastra/commit/81b6a8ff79f49a7549d15d66624ac1a0b8f5f971), [`e4d366a`](https://github.com/mastra-ai/mastra/commit/e4d366aeb500371dd4210d6aa8361a4c21d87034), [`a4f010b`](https://github.com/mastra-ai/mastra/commit/a4f010b22e4355a5fdee70a1fe0f6e4a692cc29e), [`73b0bb3`](https://github.com/mastra-ai/mastra/commit/73b0bb394dba7c9482eb467a97ab283dbc0ef4db), [`5627a8c`](https://github.com/mastra-ai/mastra/commit/5627a8c6dc11fe3711b3fa7a6ffd6eb34100a306), [`3ff45d1`](https://github.com/mastra-ai/mastra/commit/3ff45d10e0c80c5335a957ab563da72feb623520), [`251df45`](https://github.com/mastra-ai/mastra/commit/251df4531407dfa46d805feb40ff3fb49769f455), [`f894d14`](https://github.com/mastra-ai/mastra/commit/f894d148946629af7b1f452d65a9cf864cec3765), [`c2b9547`](https://github.com/mastra-ai/mastra/commit/c2b9547bf435f56339f23625a743b2147ab1c7a6), [`580b592`](https://github.com/mastra-ai/mastra/commit/580b5927afc82fe460dfdf9a38a902511b6b7e7f), [`58e3931`](https://github.com/mastra-ai/mastra/commit/58e3931af9baa5921688566210f00fb0c10479fa), [`08bb631`](https://github.com/mastra-ai/mastra/commit/08bb631ae2b14684b2678e3549d0b399a6f0561e), [`4fba91b`](https://github.com/mastra-ai/mastra/commit/4fba91bec7c95911dc28e369437596b152b04cd0), [`12b0cc4`](https://github.com/mastra-ai/mastra/commit/12b0cc4077d886b1a552637dedb70a7ade93528c)]:
  - @mastra/core@1.0.0-beta.20

## 1.0.0-beta.19

### Patch Changes

- Updated dependencies [[`e54953e`](https://github.com/mastra-ai/mastra/commit/e54953ed8ce1b28c0d62a19950163039af7834b4), [`7d56d92`](https://github.com/mastra-ai/mastra/commit/7d56d9213886e8353956d7d40df10045fd12b299), [`fdac646`](https://github.com/mastra-ai/mastra/commit/fdac646033a0930a1a4e00d13aa64c40bb7f1e02), [`d07b568`](https://github.com/mastra-ai/mastra/commit/d07b5687819ea8cb1dffa776d0c1765faf4aa1ae), [`68ec97d`](https://github.com/mastra-ai/mastra/commit/68ec97d4c07c6393fcf95c2481fc5d73da99f8c8), [`4aa55b3`](https://github.com/mastra-ai/mastra/commit/4aa55b383cf06043943359ea316572fd969861a7)]:
  - @mastra/core@1.0.0-beta.19

## 1.0.0-beta.18

### Patch Changes

- Updated dependencies [[`5947fcd`](https://github.com/mastra-ai/mastra/commit/5947fcdd425531f29f9422026d466c2ee3113c93)]:
  - @mastra/core@1.0.0-beta.18

## 1.0.0-beta.17

### Patch Changes

- Updated dependencies [[`b5dc973`](https://github.com/mastra-ai/mastra/commit/b5dc9733a5158850298dfb103acb3babdba8a318)]:
  - @mastra/core@1.0.0-beta.17

## 1.0.0-beta.16

### Patch Changes

- Fix workflow observability view broken by invalid entityType parameter ([#11427](https://github.com/mastra-ai/mastra/pull/11427))

  The UI workflow observability view was failing with a Zod validation error when trying to filter traces by workflow. The UI was sending `entityType=workflow`, but the backend's `EntityType` enum only accepts `workflow_run`.

  **Root Cause**: The legacy value transformation was happening in the handler (after validation), but Zod validation occurred earlier in the request pipeline, rejecting the request before it could be transformed.

  **Solution**:
  - Added `z.preprocess()` to the query schema to transform `workflow` → `workflow_run` before validation
  - Kept handler transformation for defense in depth
  - Updated UI to use `EntityType.WORKFLOW_RUN` enum value for type safety

  This maintains backward compatibility with legacy clients while fixing the validation error.

  Fixes #11412

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

- Updated dependencies [[`3d93a15`](https://github.com/mastra-ai/mastra/commit/3d93a15796b158c617461c8b98bede476ebb43e2), [`efe406a`](https://github.com/mastra-ai/mastra/commit/efe406a1353c24993280ebc2ed61dd9f65b84b26), [`119e5c6`](https://github.com/mastra-ai/mastra/commit/119e5c65008f3e5cfca954eefc2eb85e3bf40da4), [`74e504a`](https://github.com/mastra-ai/mastra/commit/74e504a3b584eafd2f198001c6a113bbec589fd3), [`e33fdbd`](https://github.com/mastra-ai/mastra/commit/e33fdbd07b33920d81e823122331b0c0bee0bb59), [`929f69c`](https://github.com/mastra-ai/mastra/commit/929f69c3436fa20dd0f0e2f7ebe8270bd82a1529), [`8a73529`](https://github.com/mastra-ai/mastra/commit/8a73529ca01187f604b1f3019d0a725ac63ae55f)]:
  - @mastra/core@1.0.0-beta.16

## 1.0.0-beta.15

### Minor Changes

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

- Add `/api/system/packages` endpoint that returns installed Mastra packages and versions from the dev environment ([#11211](https://github.com/mastra-ai/mastra/pull/11211))

- Add `perStep` option to workflow run methods, allowing a workflow to run just a step instead of all the workflow steps ([#11276](https://github.com/mastra-ai/mastra/pull/11276))

- Fixed voice transcription endpoint ([#11348](https://github.com/mastra-ai/mastra/pull/11348))

  The voice transcription endpoint (`/api/agents/:agentId/voice/listen`) now correctly handles multipart/form-data requests for audio uploads rather than only parsing JSON request bodies.

  Both Express and Hono adapters now parse multipart/form-data bodies and handle JSON-encoded form fields.

  **Breaking change:** The server schema field for the transcription endpoint was renamed from `audioData` to `audio` to match the client SDK. If you are making direct API calls to the transcription endpoint (not using the SDK), you will need to update your request body to use `audio` instead of `audioData`.

- Updated dependencies [[`33a4d2e`](https://github.com/mastra-ai/mastra/commit/33a4d2e4ed8af51f69256232f00c34d6b6b51d48), [`4aaa844`](https://github.com/mastra-ai/mastra/commit/4aaa844a4f19d054490f43638a990cc57bda8d2f), [`4a1a6cb`](https://github.com/mastra-ai/mastra/commit/4a1a6cb3facad54b2bb6780b00ce91d6de1edc08), [`31d13d5`](https://github.com/mastra-ai/mastra/commit/31d13d5fdc2e2380e2e3ee3ec9fb29d2a00f265d), [`4c62166`](https://github.com/mastra-ai/mastra/commit/4c621669f4a29b1f443eca3ba70b814afa286266), [`7bcbf10`](https://github.com/mastra-ai/mastra/commit/7bcbf10133516e03df964b941f9a34e9e4ab4177), [`4353600`](https://github.com/mastra-ai/mastra/commit/43536005a65988a8eede236f69122e7f5a284ba2), [`6986fb0`](https://github.com/mastra-ai/mastra/commit/6986fb064f5db6ecc24aa655e1d26529087b43b3), [`053e979`](https://github.com/mastra-ai/mastra/commit/053e9793b28e970086b0507f7f3b76ea32c1e838), [`e26dc9c`](https://github.com/mastra-ai/mastra/commit/e26dc9c3ccfec54ae3dc3e2b2589f741f9ae60a6), [`55edf73`](https://github.com/mastra-ai/mastra/commit/55edf7302149d6c964fbb7908b43babfc2b52145), [`27c0009`](https://github.com/mastra-ai/mastra/commit/27c0009777a6073d7631b0eb7b481d94e165b5ca), [`dee388d`](https://github.com/mastra-ai/mastra/commit/dee388dde02f2e63c53385ae69252a47ab6825cc), [`3f3fc30`](https://github.com/mastra-ai/mastra/commit/3f3fc3096f24c4a26cffeecfe73085928f72aa63), [`d90ea65`](https://github.com/mastra-ai/mastra/commit/d90ea6536f7aa51c6545a4e9215b55858e98e16d), [`d171e55`](https://github.com/mastra-ai/mastra/commit/d171e559ead9f52ec728d424844c8f7b164c4510), [`10c2735`](https://github.com/mastra-ai/mastra/commit/10c27355edfdad1ee2b826b897df74125eb81fb8), [`1924cf0`](https://github.com/mastra-ai/mastra/commit/1924cf06816e5e4d4d5333065ec0f4bb02a97799), [`b339816`](https://github.com/mastra-ai/mastra/commit/b339816df0984d0243d944ac2655d6ba5f809cde)]:
  - @mastra/core@1.0.0-beta.15

## 1.0.0-beta.14

### Patch Changes

- Add execution metadata to A2A message/send responses. The A2A protocol now returns detailed execution information including tool calls, tool results, token usage, and finish reason in the task metadata. This allows clients to inspect which tools were invoked during agent execution and access execution statistics without additional queries. ([#11241](https://github.com/mastra-ai/mastra/pull/11241))

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

- Updated dependencies [[`4f94ed8`](https://github.com/mastra-ai/mastra/commit/4f94ed8177abfde3ec536e3574883e075423350c), [`ac3cc23`](https://github.com/mastra-ai/mastra/commit/ac3cc2397d1966bc0fc2736a223abc449d3c7719), [`a86f4df`](https://github.com/mastra-ai/mastra/commit/a86f4df0407311e0d2ea49b9a541f0938810d6a9), [`029540c`](https://github.com/mastra-ai/mastra/commit/029540ca1e582fc2dd8d288ecd4a9b0f31a954ef), [`66741d1`](https://github.com/mastra-ai/mastra/commit/66741d1a99c4f42cf23a16109939e8348ac6852e), [`01b20fe`](https://github.com/mastra-ai/mastra/commit/01b20fefb7c67c2b7d79417598ef4e60256d1225), [`0dbf199`](https://github.com/mastra-ai/mastra/commit/0dbf199110f22192ce5c95b1c8148d4872b4d119), [`a7ce182`](https://github.com/mastra-ai/mastra/commit/a7ce1822a8785ce45d62dd5c911af465e144f7d7)]:
  - @mastra/core@1.0.0-beta.14

## 1.0.0-beta.13

### Patch Changes

- Updated dependencies [[`919a22b`](https://github.com/mastra-ai/mastra/commit/919a22b25876f9ed5891efe5facbe682c30ff497)]:
  - @mastra/core@1.0.0-beta.13

## 1.0.0-beta.12

### Patch Changes

- Add resourceId to workflow routes ([#11166](https://github.com/mastra-ai/mastra/pull/11166))

- Fix MastraServer.tools typing to accept tools with input schemas ([`5118f38`](https://github.com/mastra-ai/mastra/commit/5118f384a70b1166012fde3b901f3227870b1009))

  Fixes issue #11185 where `MastraServer.tools` was rejecting tools created with `createTool({ inputSchema })`. Changed the tools property type from `Record<string, Tool>` to `ToolsInput` to accept tools with any schema types (input, output, or none), as well as Vercel AI SDK tools and provider-defined tools.

  Tools created with `createTool({ inputSchema: z.object(...) })` now work without TypeScript errors.

- Remove deprecated playground-only prompt generation handler (functionality moved to @mastra/server) ([#11074](https://github.com/mastra-ai/mastra/pull/11074))

  Improve prompt enhancement UX: show toast errors when enhancement fails, disable button when no model has a configured API key, and prevent users from disabling all models in the model list

  Add missing `/api/agents/:agentId/instructions/enhance` endpoint that was referenced by `@mastra/client-js` and `@mastra/playground-ui`

- Updated dependencies [[`d5ed981`](https://github.com/mastra-ai/mastra/commit/d5ed981c8701c1b8a27a5f35a9a2f7d9244e695f), [`9650cce`](https://github.com/mastra-ai/mastra/commit/9650cce52a1d917ff9114653398e2a0f5c3ba808), [`932d63d`](https://github.com/mastra-ai/mastra/commit/932d63dd51be9c8bf1e00e3671fe65606c6fb9cd), [`b760b73`](https://github.com/mastra-ai/mastra/commit/b760b731aca7c8a3f041f61d57a7f125ae9cb215), [`695a621`](https://github.com/mastra-ai/mastra/commit/695a621528bdabeb87f83c2277cf2bb084c7f2b4), [`2b459f4`](https://github.com/mastra-ai/mastra/commit/2b459f466fd91688eeb2a44801dc23f7f8a887ab), [`486352b`](https://github.com/mastra-ai/mastra/commit/486352b66c746602b68a95839f830de14c7fb8c0), [`09e4bae`](https://github.com/mastra-ai/mastra/commit/09e4bae18dd5357d2ae078a4a95a2af32168ab08), [`24b76d8`](https://github.com/mastra-ai/mastra/commit/24b76d8e17656269c8ed09a0c038adb9cc2ae95a), [`243a823`](https://github.com/mastra-ai/mastra/commit/243a8239c5906f5c94e4f78b54676793f7510ae3), [`486352b`](https://github.com/mastra-ai/mastra/commit/486352b66c746602b68a95839f830de14c7fb8c0), [`c61fac3`](https://github.com/mastra-ai/mastra/commit/c61fac3add96f0dcce0208c07415279e2537eb62), [`6f14f70`](https://github.com/mastra-ai/mastra/commit/6f14f706ccaaf81b69544b6c1b75ab66a41e5317), [`09e4bae`](https://github.com/mastra-ai/mastra/commit/09e4bae18dd5357d2ae078a4a95a2af32168ab08), [`4524734`](https://github.com/mastra-ai/mastra/commit/45247343e384717a7c8404296275c56201d6470f), [`2a53598`](https://github.com/mastra-ai/mastra/commit/2a53598c6d8cfeb904a7fc74e57e526d751c8fa6), [`c7cd3c7`](https://github.com/mastra-ai/mastra/commit/c7cd3c7a187d7aaf79e2ca139de328bf609a14b4), [`847c212`](https://github.com/mastra-ai/mastra/commit/847c212caba7df0d6f2fc756b494ac3c75c3720d), [`6f941c4`](https://github.com/mastra-ai/mastra/commit/6f941c438ca5f578619788acc7608fc2e23bd176)]:
  - @mastra/core@1.0.0-beta.12

## 1.0.0-beta.11

### Patch Changes

- Fix type safety for message ordering - restrict `orderBy` to only accept `'createdAt'` field ([#11069](https://github.com/mastra-ai/mastra/pull/11069))

  Messages don't have an `updatedAt` field, but the previous type allowed ordering by it, which would return empty results. This change adds compile-time type safety by making `StorageOrderBy` generic and restricting `StorageListMessagesInput.orderBy` to only accept `'createdAt'`. The API validation schemas have also been updated to reject invalid orderBy values at runtime.

- Support new Workflow tripwire run status. Tripwires that are thrown from within a workflow will now bubble up and return a graceful state with information about tripwires. ([#10947](https://github.com/mastra-ai/mastra/pull/10947))

  When a workflow contains an agent step that triggers a tripwire, the workflow returns with `status: 'tripwire'` and includes tripwire details:

  ```typescript showLineNumbers copy
  const run = await workflow.createRun();
  const result = await run.start({ inputData: { message: 'Hello' } });

  if (result.status === 'tripwire') {
    console.log('Workflow terminated by tripwire:', result.tripwire?.reason);
    console.log('Processor ID:', result.tripwire?.processorId);
    console.log('Retry requested:', result.tripwire?.retry);
  }
  ```

  Adds new UI state for tripwire in agent chat and workflow UI.

  This is distinct from `status: 'failed'` which indicates an unexpected error. A tripwire status means a processor intentionally stopped execution (e.g., for content moderation).

- Updated dependencies [[`38380b6`](https://github.com/mastra-ai/mastra/commit/38380b60fca905824bdf6b43df307a58efb1aa15), [`798d0c7`](https://github.com/mastra-ai/mastra/commit/798d0c740232653b1d754870e6b43a55c364ffe2), [`ffe84d5`](https://github.com/mastra-ai/mastra/commit/ffe84d54f3b0f85167fe977efd027dba027eb998), [`2c212e7`](https://github.com/mastra-ai/mastra/commit/2c212e704c90e2db83d4109e62c03f0f6ebd2667), [`4ca4306`](https://github.com/mastra-ai/mastra/commit/4ca430614daa5fa04730205a302a43bf4accfe9f), [`3bf6c5f`](https://github.com/mastra-ai/mastra/commit/3bf6c5f104c25226cd84e0c77f9dec15f2cac2db)]:
  - @mastra/core@1.0.0-beta.11

## 1.0.0-beta.10

### Patch Changes

- ### Breaking Changes ([#11028](https://github.com/mastra-ai/mastra/pull/11028))
  - Renamed `RuntimeContext` type to `ServerContext` to avoid confusion with the user-facing `RequestContext` (previously called `RuntimeContext`)
  - Removed `playground` and `isDev` options from server adapter constructors - these only set context variables without any actual functionality

  ### Changes

  **@mastra/server**
  - Renamed `RuntimeContext` type to `ServerContext` in route handler types
  - Renamed `createTestRuntimeContext` to `createTestServerContext` in test utilities
  - Renamed `isPlayground` parameter to `isStudio` in `formatAgent` function

  **@mastra/hono**
  - Removed `playground` and `isDev` from `HonoVariables` type
  - Removed setting of `playground` and `isDev` context variables in middleware

  **@mastra/express**
  - Removed `playground` and `isDev` from `Express.Locals` interface
  - Removed setting of `playground` and `isDev` in response locals

- Add delete workflow run API ([#10991](https://github.com/mastra-ai/mastra/pull/10991))

  ```typescript
  await workflow.deleteWorkflowRunById(runId);
  ```

- Updated dependencies [[`edb07e4`](https://github.com/mastra-ai/mastra/commit/edb07e49283e0c28bd094a60e03439bf6ecf0221), [`b7e17d3`](https://github.com/mastra-ai/mastra/commit/b7e17d3f5390bb5a71efc112204413656fcdc18d), [`261473a`](https://github.com/mastra-ai/mastra/commit/261473ac637e633064a22076671e2e02b002214d), [`5d7000f`](https://github.com/mastra-ai/mastra/commit/5d7000f757cd65ea9dc5b05e662fd83dfd44e932), [`4f0331a`](https://github.com/mastra-ai/mastra/commit/4f0331a79bf6eb5ee598a5086e55de4b5a0ada03), [`8a000da`](https://github.com/mastra-ai/mastra/commit/8a000da0c09c679a2312f6b3aa05b2ca78ca7393)]:
  - @mastra/core@1.0.0-beta.10

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

- Updated dependencies [[`72df8ae`](https://github.com/mastra-ai/mastra/commit/72df8ae595584cdd7747d5c39ffaca45e4507227), [`9198899`](https://github.com/mastra-ai/mastra/commit/91988995c427b185c33714b7f3be955367911324), [`653e65a`](https://github.com/mastra-ai/mastra/commit/653e65ae1f9502c2958a32f47a5a2df11e612a92), [`c6fd6fe`](https://github.com/mastra-ai/mastra/commit/c6fd6fedd09e9cf8004b03a80925f5e94826ad7e), [`0bed332`](https://github.com/mastra-ai/mastra/commit/0bed332843f627202c6520eaf671771313cd20f3)]:
  - @mastra/core@1.0.0-beta.9

## 1.0.0-beta.8

### Patch Changes

- Updated dependencies [[`0d41fe2`](https://github.com/mastra-ai/mastra/commit/0d41fe245355dfc66d61a0d9c85d9400aac351ff), [`6b3ba91`](https://github.com/mastra-ai/mastra/commit/6b3ba91494cc10394df96782f349a4f7b1e152cc), [`7907fd1`](https://github.com/mastra-ai/mastra/commit/7907fd1c5059813b7b870b81ca71041dc807331b)]:
  - @mastra/core@1.0.0-beta.8

## 1.0.0-beta.7

### Patch Changes

- fix: standardize pagination params to page/perPage with backwards compatibility for limit/offset ([#10790](https://github.com/mastra-ai/mastra/pull/10790))
  - Server now accepts both `page`/`perPage` and legacy `limit`/`offset` params for workflow runs and MCP server listing endpoints
  - Client SDK sends both param formats to support older server versions
  - Added `createCombinedPaginationSchema` helper for endpoints needing backwards compatibility
  - Marked `limit` and `offset` as deprecated in client types

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

- Updated dependencies [[`3076c67`](https://github.com/mastra-ai/mastra/commit/3076c6778b18988ae7d5c4c5c466366974b2d63f), [`85d7ee1`](https://github.com/mastra-ai/mastra/commit/85d7ee18ff4e14d625a8a30ec6656bb49804989b), [`c6c1092`](https://github.com/mastra-ai/mastra/commit/c6c1092f8fbf76109303f69e000e96fd1960c4ce), [`81dc110`](https://github.com/mastra-ai/mastra/commit/81dc11008d147cf5bdc8996ead1aa61dbdebb6fc), [`7aedb74`](https://github.com/mastra-ai/mastra/commit/7aedb74883adf66af38e270e4068fd42e7a37036), [`8f02d80`](https://github.com/mastra-ai/mastra/commit/8f02d800777397e4b45d7f1ad041988a8b0c6630), [`d7aad50`](https://github.com/mastra-ai/mastra/commit/d7aad501ce61646b76b4b511e558ac4eea9884d0), [`ce0a73a`](https://github.com/mastra-ai/mastra/commit/ce0a73abeaa75b10ca38f9e40a255a645d50ebfb), [`a02e542`](https://github.com/mastra-ai/mastra/commit/a02e542d23179bad250b044b17ff023caa61739f), [`a372c64`](https://github.com/mastra-ai/mastra/commit/a372c640ad1fd12e8f0613cebdc682fc156b4d95), [`8846867`](https://github.com/mastra-ai/mastra/commit/8846867ffa9a3746767618e314bebac08eb77d87), [`42a42cf`](https://github.com/mastra-ai/mastra/commit/42a42cf3132b9786feecbb8c13c583dce5b0e198), [`ae08bf0`](https://github.com/mastra-ai/mastra/commit/ae08bf0ebc6a4e4da992b711c4a389c32ba84cf4), [`21735a7`](https://github.com/mastra-ai/mastra/commit/21735a7ef306963554a69a89b44f06c3bcd85141), [`1d877b8`](https://github.com/mastra-ai/mastra/commit/1d877b8d7b536a251c1a7a18db7ddcf4f68d6f8b)]:
  - @mastra/core@1.0.0-beta.7

## 1.0.0-beta.6

### Patch Changes

- Unified MastraServer API with MCP transport routes ([#10644](https://github.com/mastra-ai/mastra/pull/10644))

  **Breaking Changes:**
  - Renamed `HonoServerAdapter` to `MastraServer` in `@mastra/hono`
  - Renamed `ExpressServerAdapter` to `MastraServer` in `@mastra/express`
  - Configuration now passed to constructor instead of separate method calls
  - Renamed base class from `ServerAdapter` to `MastraServerBase` in `@mastra/server`

  **New Features:**
  - Added MCP transport routes (HTTP and SSE) to server adapters
  - MCP endpoints available at `/api/mcp/:serverId/mcp` (HTTP) and `/api/mcp/:serverId/sse` (SSE)
  - Added `express.json()` middleware compatibility for MCP routes
  - Moved authentication helpers from deployer to `@mastra/server/auth`

  **Testing:**
  - Added shared MCP route and transport test suites in `@internal/server-adapter-test-utils`
  - Added comprehensive MCP endpoint tests for both Hono and Express adapters
  - Added GitHub Actions workflow for server adapter CI testing

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

- fix(a2a): fix streaming and memory support for A2A protocol ([#10653](https://github.com/mastra-ai/mastra/pull/10653))

  **Client (`@mastra/client-js`):**
  - Fixed `sendStreamingMessage` to properly return a streaming response instead of attempting to parse it as JSON

  **Server (`@mastra/server`):**
  - Fixed A2A message handler to pass `contextId` as `threadId` for memory persistence across conversations
  - Added support for user-provided `resourceId` via `params.metadata.resourceId` or `message.metadata.resourceId`, falling back to `agentId`

- Add stream data redaction to prevent sensitive information leaks in agent stream API responses. ([#10705](https://github.com/mastra-ai/mastra/pull/10705))

  The `stream` API endpoint now automatically redacts `request` data from stream chunks (`step-start`, `step-finish`, `finish`) which could contain system prompts, tool definitions, and API keys. Redaction is enabled by default and can be disabled for debugging/internal services via `streamOptions.redact`.

- Updated dependencies [[`ac0d2f4`](https://github.com/mastra-ai/mastra/commit/ac0d2f4ff8831f72c1c66c2be809706d17f65789), [`1a0d3fc`](https://github.com/mastra-ai/mastra/commit/1a0d3fc811482c9c376cdf79ee615c23bae9b2d6), [`85a628b`](https://github.com/mastra-ai/mastra/commit/85a628b1224a8f64cd82ea7f033774bf22df7a7e), [`c237233`](https://github.com/mastra-ai/mastra/commit/c23723399ccedf7f5744b3f40997b79246bfbe64), [`15f9e21`](https://github.com/mastra-ai/mastra/commit/15f9e216177201ea6e3f6d0bfb063fcc0953444f), [`ff94dea`](https://github.com/mastra-ai/mastra/commit/ff94dea935f4e34545c63bcb6c29804732698809), [`5b2ff46`](https://github.com/mastra-ai/mastra/commit/5b2ff4651df70c146523a7fca773f8eb0a2272f8), [`db41688`](https://github.com/mastra-ai/mastra/commit/db4168806d007417e2e60b4f68656dca4e5f40c9), [`5ca599d`](https://github.com/mastra-ai/mastra/commit/5ca599d0bb59a1595f19f58473fcd67cc71cef58), [`bff1145`](https://github.com/mastra-ai/mastra/commit/bff114556b3cbadad9b2768488708f8ad0e91475), [`5c8ca24`](https://github.com/mastra-ai/mastra/commit/5c8ca247094e0cc2cdbd7137822fb47241f86e77), [`e191844`](https://github.com/mastra-ai/mastra/commit/e1918444ca3f80e82feef1dad506cd4ec6e2875f), [`22553f1`](https://github.com/mastra-ai/mastra/commit/22553f11c63ee5e966a9c034a349822249584691), [`7237163`](https://github.com/mastra-ai/mastra/commit/72371635dbf96a87df4b073cc48fc655afbdce3d), [`2500740`](https://github.com/mastra-ai/mastra/commit/2500740ea23da067d6e50ec71c625ab3ce275e64), [`873ecbb`](https://github.com/mastra-ai/mastra/commit/873ecbb517586aa17d2f1e99283755b3ebb2863f), [`4f9bbe5`](https://github.com/mastra-ai/mastra/commit/4f9bbe5968f42c86f4930b8193de3c3c17e5bd36), [`02e51fe`](https://github.com/mastra-ai/mastra/commit/02e51feddb3d4155cfbcc42624fd0d0970d032c0), [`8f3fa3a`](https://github.com/mastra-ai/mastra/commit/8f3fa3a652bb77da092f913ec51ae46e3a7e27dc), [`cd29ad2`](https://github.com/mastra-ai/mastra/commit/cd29ad23a255534e8191f249593849ed29160886), [`bdf4d8c`](https://github.com/mastra-ai/mastra/commit/bdf4d8cdc656d8a2c21d81834bfa3bfa70f56c16), [`854e3da`](https://github.com/mastra-ai/mastra/commit/854e3dad5daac17a91a20986399d3a51f54bf68b), [`ce18d38`](https://github.com/mastra-ai/mastra/commit/ce18d38678c65870350d123955014a8432075fd9), [`cccf9c8`](https://github.com/mastra-ai/mastra/commit/cccf9c8b2d2dfc1a5e63919395b83d78c89682a0), [`61a5705`](https://github.com/mastra-ai/mastra/commit/61a570551278b6743e64243b3ce7d73de915ca8a), [`db70a48`](https://github.com/mastra-ai/mastra/commit/db70a48aeeeeb8e5f92007e8ede52c364ce15287), [`f0fdc14`](https://github.com/mastra-ai/mastra/commit/f0fdc14ee233d619266b3d2bbdeea7d25cfc6d13), [`db18bc9`](https://github.com/mastra-ai/mastra/commit/db18bc9c3825e2c1a0ad9a183cc9935f6691bfa1), [`9b37b56`](https://github.com/mastra-ai/mastra/commit/9b37b565e1f2a76c24f728945cc740c2b09be9da), [`41a23c3`](https://github.com/mastra-ai/mastra/commit/41a23c32f9877d71810f37e24930515df2ff7a0f), [`5d171ad`](https://github.com/mastra-ai/mastra/commit/5d171ad9ef340387276b77c2bb3e83e83332d729), [`f03ae60`](https://github.com/mastra-ai/mastra/commit/f03ae60500fe350c9d828621006cdafe1975fdd8), [`d1e74a0`](https://github.com/mastra-ai/mastra/commit/d1e74a0a293866dece31022047f5dbab65a304d0), [`39e7869`](https://github.com/mastra-ai/mastra/commit/39e7869bc7d0ee391077ce291474d8a84eedccff), [`5761926`](https://github.com/mastra-ai/mastra/commit/57619260c4a2cdd598763abbacd90de594c6bc76), [`c900fdd`](https://github.com/mastra-ai/mastra/commit/c900fdd504c41348efdffb205cfe80d48c38fa33), [`604a79f`](https://github.com/mastra-ai/mastra/commit/604a79fecf276e26a54a3fe01bb94e65315d2e0e), [`887f0b4`](https://github.com/mastra-ai/mastra/commit/887f0b4746cdbd7cb7d6b17ac9f82aeb58037ea5), [`2562143`](https://github.com/mastra-ai/mastra/commit/256214336b4faa78646c9c1776612393790d8784), [`ef11a61`](https://github.com/mastra-ai/mastra/commit/ef11a61920fa0ed08a5b7ceedd192875af119749)]:
  - @mastra/core@1.0.0-beta.6

## 1.0.0-beta.5

### Patch Changes

- Extract routing from @deployer/server into server adapter packages. ([#10263](https://github.com/mastra-ai/mastra/pull/10263))
  New packages:
  - @mastra/express
  - @mastra/hono

  These packages support mastra server routes on express and hono respectively.
  Better abstractions will be built on top of these packages in the near future, enabling users to easily attach mastra routes to any existing server framework.

- Add timeTravel APIs and add timeTravel feature to studio ([#10361](https://github.com/mastra-ai/mastra/pull/10361))

- Fixed server handler bugs: filter parsing now handles colons in values (timestamps, URLs), dateRange validation now converts JSON strings to Date objects, deleteMessages schema accepts object forms, and added missing responseSchema for legacy stream route ([#10362](https://github.com/mastra-ai/mastra/pull/10362))

- Updated dependencies [[`21a15de`](https://github.com/mastra-ai/mastra/commit/21a15de369fe82aac26bb642ed7be73505475e8b), [`feb7ee4`](https://github.com/mastra-ai/mastra/commit/feb7ee4d09a75edb46c6669a3beaceec78811747), [`b0e2ea5`](https://github.com/mastra-ai/mastra/commit/b0e2ea5b52c40fae438b9e2f7baee6f0f89c5442), [`c456e01`](https://github.com/mastra-ai/mastra/commit/c456e0149e3c176afcefdbd9bb1d2c5917723725), [`ab035c2`](https://github.com/mastra-ai/mastra/commit/ab035c2ef6d8cc7bb25f06f1a38508bd9e6f126b), [`1a46a56`](https://github.com/mastra-ai/mastra/commit/1a46a566f45a3fcbadc1cf36bf86d351f264bfa3), [`3cf540b`](https://github.com/mastra-ai/mastra/commit/3cf540b9fbfea8f4fc8d3a2319a4e6c0b0cbfd52), [`1c6ce51`](https://github.com/mastra-ai/mastra/commit/1c6ce51f875915ab57fd36873623013699a2a65d), [`898a972`](https://github.com/mastra-ai/mastra/commit/898a9727d286c2510d6b702dfd367e6aaf5c6b0f), [`a97003a`](https://github.com/mastra-ai/mastra/commit/a97003aa1cf2f4022a41912324a1e77263b326b8), [`ccc141e`](https://github.com/mastra-ai/mastra/commit/ccc141ed27da0abc3a3fc28e9e5128152e8e37f4), [`fe3b897`](https://github.com/mastra-ai/mastra/commit/fe3b897c2ccbcd2b10e81b099438c7337feddf89), [`00123ba`](https://github.com/mastra-ai/mastra/commit/00123ba96dc9e5cd0b110420ebdba56d8f237b25), [`29c4309`](https://github.com/mastra-ai/mastra/commit/29c4309f818b24304c041bcb4a8f19b5f13f6b62), [`16785ce`](https://github.com/mastra-ai/mastra/commit/16785ced928f6f22638f4488cf8a125d99211799), [`de8239b`](https://github.com/mastra-ai/mastra/commit/de8239bdcb1d8c0cfa06da21f1569912a66bbc8a), [`b5e6cd7`](https://github.com/mastra-ai/mastra/commit/b5e6cd77fc8c8e64e0494c1d06cee3d84e795d1e), [`3759cb0`](https://github.com/mastra-ai/mastra/commit/3759cb064935b5f74c65ac2f52a1145f7352899d), [`651e772`](https://github.com/mastra-ai/mastra/commit/651e772eb1475fb13e126d3fcc01751297a88214), [`b61b93f`](https://github.com/mastra-ai/mastra/commit/b61b93f9e058b11dd2eec169853175d31dbdd567), [`bae33d9`](https://github.com/mastra-ai/mastra/commit/bae33d91a63fbb64d1e80519e1fc1acaed1e9013), [`c0b731f`](https://github.com/mastra-ai/mastra/commit/c0b731fb27d712dc8582e846df5c0332a6a0c5ba), [`43ca8f2`](https://github.com/mastra-ai/mastra/commit/43ca8f2c7334851cc7b4d3d2f037d8784bfbdd5f), [`2ca67cc`](https://github.com/mastra-ai/mastra/commit/2ca67cc3bb1f6a617353fdcab197d9efebe60d6f), [`9e67002`](https://github.com/mastra-ai/mastra/commit/9e67002b52c9be19936c420a489dbee9c5fd6a78), [`35edc49`](https://github.com/mastra-ai/mastra/commit/35edc49ac0556db609189641d6341e76771b81fc)]:
  - @mastra/core@1.0.0-beta.5

## 1.0.0-beta.4

### Patch Changes

- Network handler now accesses thread and resource parameters from the nested memory object instead of directly from request body. ([#10294](https://github.com/mastra-ai/mastra/pull/10294))

- Updated dependencies [[`352a5d6`](https://github.com/mastra-ai/mastra/commit/352a5d625cfe09849b21e8f52a24c9f0366759d5), [`a0a5b4b`](https://github.com/mastra-ai/mastra/commit/a0a5b4bbebe6c701ebbadf744873aa0d5ca01371), [`69ea758`](https://github.com/mastra-ai/mastra/commit/69ea758358edd7117f191c2e69c8bb5fc79e7a1a), [`993ad98`](https://github.com/mastra-ai/mastra/commit/993ad98d7ad3bebda9ecef5fec5c94349a0d04bc), [`3ff2c17`](https://github.com/mastra-ai/mastra/commit/3ff2c17a58e312fad5ea37377262c12d92ca0908)]:
  - @mastra/core@1.0.0-beta.4

## 1.0.0-beta.3

### Patch Changes

- Fix semantic search endpoint to return results in the correct format. Also fix the delete messages endpoint to properly normalize ids in the expected format. ([#10032](https://github.com/mastra-ai/mastra/pull/10032))

- Updated dependencies [[`2319326`](https://github.com/mastra-ai/mastra/commit/2319326f8c64e503a09bbcf14be2dd65405445e0), [`d629361`](https://github.com/mastra-ai/mastra/commit/d629361a60f6565b5bfb11976fdaf7308af858e2), [`08c31c1`](https://github.com/mastra-ai/mastra/commit/08c31c188ebccd598acaf55e888b6397d01f7eae), [`fd3d338`](https://github.com/mastra-ai/mastra/commit/fd3d338a2c362174ed5b383f1f011ad9fb0302aa), [`c30400a`](https://github.com/mastra-ai/mastra/commit/c30400a49b994b1b97256fe785eb6c906fc2b232), [`69e0a87`](https://github.com/mastra-ai/mastra/commit/69e0a878896a2da9494945d86e056a5f8f05b851), [`01f8878`](https://github.com/mastra-ai/mastra/commit/01f88783de25e4de048c1c8aace43e26373c6ea5), [`4c77209`](https://github.com/mastra-ai/mastra/commit/4c77209e6c11678808b365d545845918c40045c8), [`d827d08`](https://github.com/mastra-ai/mastra/commit/d827d0808ffe1f3553a84e975806cc989b9735dd), [`23c10a1`](https://github.com/mastra-ai/mastra/commit/23c10a1efdd9a693c405511ab2dc8a1236603162), [`676ccc7`](https://github.com/mastra-ai/mastra/commit/676ccc7fe92468d2d45d39c31a87825c89fd1ea0), [`c10398d`](https://github.com/mastra-ai/mastra/commit/c10398d5b88f1d4af556f4267ff06f1d11e89179), [`00c2387`](https://github.com/mastra-ai/mastra/commit/00c2387f5f04a365316f851e58666ac43f8c4edf), [`ad6250d`](https://github.com/mastra-ai/mastra/commit/ad6250dbdaad927e29f74a27b83f6c468b50a705), [`3a73998`](https://github.com/mastra-ai/mastra/commit/3a73998fa4ebeb7f3dc9301afe78095fc63e7999), [`e16d553`](https://github.com/mastra-ai/mastra/commit/e16d55338403c7553531cc568125c63d53653dff), [`4d59f58`](https://github.com/mastra-ai/mastra/commit/4d59f58de2d90d6e2810a19d4518e38ddddb9038), [`e1bb9c9`](https://github.com/mastra-ai/mastra/commit/e1bb9c94b4eb68b019ae275981be3feb769b5365), [`351a11f`](https://github.com/mastra-ai/mastra/commit/351a11fcaf2ed1008977fa9b9a489fc422e51cd4)]:
  - @mastra/core@1.0.0-beta.3

## 1.0.0-beta.2

### Patch Changes

- Updated dependencies [[`465ac05`](https://github.com/mastra-ai/mastra/commit/465ac0526a91d175542091c675181f1a96c98c46)]:
  - @mastra/core@1.0.0-beta.2

## 1.0.0-beta.1

### Patch Changes

- Updated dependencies [[`910db9e`](https://github.com/mastra-ai/mastra/commit/910db9e0312888495eb5617b567f247d03303814), [`e7266a2`](https://github.com/mastra-ai/mastra/commit/e7266a278db02035c97a5e9cd9d1669a6b7a535d)]:
  - @mastra/core@1.0.0-beta.1

## 1.0.0-beta.0

### Major Changes

- Moving scorers under the eval domain, api method consistency, prebuilt evals, scorers require ids. ([#9589](https://github.com/mastra-ai/mastra/pull/9589))

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

- Bump minimum required Node.js version to 22.13.0 ([#9706](https://github.com/mastra-ai/mastra/pull/9706))

- Replace `getThreadsByResourceIdPaginated` with `listThreadsByResourceId` across memory handlers. Update client SDK to use `listThreads()` with `offset`/`limit` parameters instead of deprecated `getMemoryThreads()`. Consolidate `/api/memory/threads` routes to single paginated endpoint. ([#9508](https://github.com/mastra-ai/mastra/pull/9508))

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

- Rename `defaultVNextStreamOptions` to `defaultOptions`. Add "Legacy" suffix to v1 option properties and methods (`defaultGenerateOptions` → `defaultGenerateOptionsLegacy`, `defaultStreamOptions` → `defaultStreamOptionsLegacy`). ([#9535](https://github.com/mastra-ai/mastra/pull/9535))

- Remove `getThreadsByResourceId` and `getThreadsByResourceIdPaginated` methods from storage interfaces in favor of `listThreadsByResourceId`. The new method uses `offset`/`limit` pagination and a nested `orderBy` object structure (`{ field, direction }`). ([#9536](https://github.com/mastra-ai/mastra/pull/9536))

- Renamed a bunch of observability/tracing-related things to drop the AI prefix. ([#9744](https://github.com/mastra-ai/mastra/pull/9744))

- **Breaking Change**: Remove legacy v1 watch events and consolidate on v2 implementation. ([#9252](https://github.com/mastra-ai/mastra/pull/9252))

  This change simplifies the workflow watching API by removing the legacy v1 event system and promoting v2 as the standard (renamed to just `watch`).

  ### What's Changed
  - Removed legacy v1 watch event handlers and types
  - Renamed `watch-v2` to `watch` throughout the codebase
  - Removed `.watch()` method from client-js SDK (`Workflow` and `AgentBuilder` classes)
  - Removed `/watch` HTTP endpoints from server and deployer
  - Removed `WorkflowWatchResult` and v1 `WatchEvent` types

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

- Changing getAgents -> listAgents, getTools -> listTools, getWorkflows -> listWorkflows ([#9495](https://github.com/mastra-ai/mastra/pull/9495))

- Removed old tracing code based on OpenTelemetry ([#9237](https://github.com/mastra-ai/mastra/pull/9237))

- Remove deprecated vector prompts and cohere provider from code ([#9596](https://github.com/mastra-ai/mastra/pull/9596))

- Mark as stable ([`83d5942`](https://github.com/mastra-ai/mastra/commit/83d5942669ce7bba4a6ca4fd4da697a10eb5ebdc))

- Enforcing id required on Processor primitive ([#9591](https://github.com/mastra-ai/mastra/pull/9591))

- Renamed `MastraMessageV2` to `MastraDBMessage` ([#9255](https://github.com/mastra-ai/mastra/pull/9255))
  Made the return format of all methods that return db messages consistent. It's always `{ messages: MastraDBMessage[] }` now, and messages can be converted after that using `@mastra/ai-sdk/ui`'s `toAISdkV4/5Messages()` function

- moved ai-tracing code into @mastra/observability ([#9661](https://github.com/mastra-ai/mastra/pull/9661))

- Remove legacy evals from Mastra ([#9491](https://github.com/mastra-ai/mastra/pull/9491))

### Minor Changes

- Update peer dependencies to match core package version bump (1.0.0) ([#9237](https://github.com/mastra-ai/mastra/pull/9237))

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

- Update peer dependencies to match core package version bump (1.0.0) ([#9495](https://github.com/mastra-ai/mastra/pull/9495))

- Update peer dependencies to match core package version bump (0.22.1) ([#8649](https://github.com/mastra-ai/mastra/pull/8649))

- Add observeStream support for agent-builder template installation ([#9372](https://github.com/mastra-ai/mastra/pull/9372))
  - Add observeStream, observeStreamVNext, observeStreamLegacy, and resumeStream methods to agent-builder client SDK
  - Add corresponding server handlers and deployer routes for observe streaming
  - Add tracingOptions parameter to existing agent-builder handlers for parity with workflows
  - Update template installation processor to support both legacy and VNext streaming event formats

- Update peer dependencies to match core package version bump (0.22.0) ([#8983](https://github.com/mastra-ai/mastra/pull/8983))

- Update peer dependencies to match core package version bump (1.0.0) ([#9491](https://github.com/mastra-ai/mastra/pull/9491))

### Patch Changes

- Make step optional in all resume APIs ([#9454](https://github.com/mastra-ai/mastra/pull/9454))

- Add agent id to the list agent ([#9770](https://github.com/mastra-ai/mastra/pull/9770))

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

- Add the description field to listAgents ([#9672](https://github.com/mastra-ai/mastra/pull/9672))

- Fix the link issue in observability ([#9764](https://github.com/mastra-ai/mastra/pull/9764))

- Add tool call approval ([#8649](https://github.com/mastra-ai/mastra/pull/8649))

- Fix scorers listing filtring ([#9801](https://github.com/mastra-ai/mastra/pull/9801))

- Fixes issue where clicking the reset button in the model picker would fail to restore the original LanguageModelV2 (or any other types) object that was passed during agent construction. ([#9481](https://github.com/mastra-ai/mastra/pull/9481))

- Update peer dependencies to match core package version bump (1.0.0) ([#9489](https://github.com/mastra-ai/mastra/pull/9489))

- Fix undefined runtimeContext using memory from playground ([#9328](https://github.com/mastra-ai/mastra/pull/9328))

- Make step optional in resumeStreamVNext API ([#9453](https://github.com/mastra-ai/mastra/pull/9453))

- Remove `waitForEvent` from workflows. `waitForEvent` is now removed, please use suspend & resume flow instead. See https://mastra.ai/en/docs/workflows/suspend-and-resume for more details on suspend & resume flow. ([#9214](https://github.com/mastra-ai/mastra/pull/9214))

- Use memory mock in server tests ([#9486](https://github.com/mastra-ai/mastra/pull/9486))

- Remove format from stream/generate ([#9577](https://github.com/mastra-ai/mastra/pull/9577))

- Updated dependencies [[`39c9743`](https://github.com/mastra-ai/mastra/commit/39c97432d084294f8ba85fbf3ef28098ff21459e), [`f743dbb`](https://github.com/mastra-ai/mastra/commit/f743dbb8b40d1627b5c10c0e6fc154f4ebb6e394), [`fec5129`](https://github.com/mastra-ai/mastra/commit/fec5129de7fc64423ea03661a56cef31dc747a0d), [`0491e7c`](https://github.com/mastra-ai/mastra/commit/0491e7c9b714cb0ba22187ee062147ec2dd7c712), [`f6f4903`](https://github.com/mastra-ai/mastra/commit/f6f4903397314f73362061dc5a3e8e7c61ea34aa), [`0e8ed46`](https://github.com/mastra-ai/mastra/commit/0e8ed467c54d6901a6a365f270ec15d6faadb36c), [`6c049d9`](https://github.com/mastra-ai/mastra/commit/6c049d94063fdcbd5b81c4912a2bf82a92c9cc0b), [`2f897df`](https://github.com/mastra-ai/mastra/commit/2f897df208508f46f51b7625e5dd20c37f93e0e3), [`3443770`](https://github.com/mastra-ai/mastra/commit/3443770662df8eb24c9df3589b2792d78cfcb811), [`f0a07e0`](https://github.com/mastra-ai/mastra/commit/f0a07e0111b3307c5fabfa4094c5c2cfb734fbe6), [`aaa40e7`](https://github.com/mastra-ai/mastra/commit/aaa40e788628b319baa8e889407d11ad626547fa), [`1521d71`](https://github.com/mastra-ai/mastra/commit/1521d716e5daedc74690c983fbd961123c56756b), [`9e1911d`](https://github.com/mastra-ai/mastra/commit/9e1911db2b4db85e0e768c3f15e0d61e319869f6), [`ebac155`](https://github.com/mastra-ai/mastra/commit/ebac15564a590117db7078233f927a7e28a85106), [`dd1c38d`](https://github.com/mastra-ai/mastra/commit/dd1c38d1b75f1b695c27b40d8d9d6ed00d5e0f6f), [`5948e6a`](https://github.com/mastra-ai/mastra/commit/5948e6a5146c83666ba3f294b2be576c82a513fb), [`8940859`](https://github.com/mastra-ai/mastra/commit/89408593658199b4ad67f7b65e888f344e64a442), [`e629310`](https://github.com/mastra-ai/mastra/commit/e629310f1a73fa236d49ec7a1d1cceb6229dc7cc), [`4c6b492`](https://github.com/mastra-ai/mastra/commit/4c6b492c4dd591c6a592520c1f6855d6e936d71f), [`dff01d8`](https://github.com/mastra-ai/mastra/commit/dff01d81ce1f4e4087cfac20fa868e6db138dd14), [`9d819d5`](https://github.com/mastra-ai/mastra/commit/9d819d54b61481639f4008e4694791bddf187edd), [`71c8d6c`](https://github.com/mastra-ai/mastra/commit/71c8d6c161253207b2b9588bdadb7eed604f7253), [`6179a9b`](https://github.com/mastra-ai/mastra/commit/6179a9ba36ffac326de3cc3c43cdc8028d37c251), [`00f4921`](https://github.com/mastra-ai/mastra/commit/00f4921dd2c91a1e5446799599ef7116a8214a1a), [`ca8041c`](https://github.com/mastra-ai/mastra/commit/ca8041cce0379fda22ed293a565bcb5b6ddca68a), [`7051bf3`](https://github.com/mastra-ai/mastra/commit/7051bf38b3b122a069008f861f7bfc004a6d9f6e), [`a8f1494`](https://github.com/mastra-ai/mastra/commit/a8f1494f4bbdc2770bcf327d4c7d869e332183f1), [`0793497`](https://github.com/mastra-ai/mastra/commit/079349753620c40246ffd673e3f9d7d9820beff3), [`5df9cce`](https://github.com/mastra-ai/mastra/commit/5df9cce1a753438413f64c11eeef8f845745c2a8), [`a854ede`](https://github.com/mastra-ai/mastra/commit/a854ede62bf5ac0945a624ac48913dd69c73aabf), [`c576fc0`](https://github.com/mastra-ai/mastra/commit/c576fc0b100b2085afded91a37c97a0ea0ec09c7), [`3defc80`](https://github.com/mastra-ai/mastra/commit/3defc80cf2b88a1b7fc1cc4ddcb91e982a614609), [`16153fe`](https://github.com/mastra-ai/mastra/commit/16153fe7eb13c99401f48e6ca32707c965ee28b9), [`9f4a683`](https://github.com/mastra-ai/mastra/commit/9f4a6833e88b52574665c028fd5508ad5c2f6004), [`bc94344`](https://github.com/mastra-ai/mastra/commit/bc943444a1342d8a662151b7bce1df7dae32f59c), [`57d157f`](https://github.com/mastra-ai/mastra/commit/57d157f0b163a95c3e6c9eae31bdb11d1bfc64f9), [`903f67d`](https://github.com/mastra-ai/mastra/commit/903f67d184504a273893818c02b961f5423a79ad), [`2a90c55`](https://github.com/mastra-ai/mastra/commit/2a90c55a86a9210697d5adaab5ee94584b079adc), [`eb09742`](https://github.com/mastra-ai/mastra/commit/eb09742197f66c4c38154c3beec78313e69760b2), [`96d35f6`](https://github.com/mastra-ai/mastra/commit/96d35f61376bc2b1bf148648a2c1985bd51bef55), [`5cbe88a`](https://github.com/mastra-ai/mastra/commit/5cbe88aefbd9f933bca669fd371ea36bf939ac6d), [`a1bd7b8`](https://github.com/mastra-ai/mastra/commit/a1bd7b8571db16b94eb01588f451a74758c96d65), [`d78b38d`](https://github.com/mastra-ai/mastra/commit/d78b38d898fce285260d3bbb4befade54331617f), [`0633100`](https://github.com/mastra-ai/mastra/commit/0633100a911ad22f5256471bdf753da21c104742), [`c710c16`](https://github.com/mastra-ai/mastra/commit/c710c1652dccfdc4111c8412bca7a6bb1d48b441), [`354ad0b`](https://github.com/mastra-ai/mastra/commit/354ad0b7b1b8183ac567f236a884fc7ede6d7138), [`cfae733`](https://github.com/mastra-ai/mastra/commit/cfae73394f4920635e6c919c8e95ff9a0788e2e5), [`e3dfda7`](https://github.com/mastra-ai/mastra/commit/e3dfda7b11bf3b8c4bb55637028befb5f387fc74), [`844ea5d`](https://github.com/mastra-ai/mastra/commit/844ea5dc0c248961e7bf73629ae7dcff503e853c), [`398fde3`](https://github.com/mastra-ai/mastra/commit/398fde3f39e707cda79372cdae8f9870e3b57c8d), [`f0f8f12`](https://github.com/mastra-ai/mastra/commit/f0f8f125c308f2d0fd36942ef652fd852df7522f), [`0d7618b`](https://github.com/mastra-ai/mastra/commit/0d7618bc650bf2800934b243eca5648f4aeed9c2), [`7b763e5`](https://github.com/mastra-ai/mastra/commit/7b763e52fc3eaf699c2a99f2adf418dd46e4e9a5), [`d36cfbb`](https://github.com/mastra-ai/mastra/commit/d36cfbbb6565ba5f827883cc9bb648eb14befdc1), [`3697853`](https://github.com/mastra-ai/mastra/commit/3697853deeb72017d90e0f38a93c1e29221aeca0), [`b2e45ec`](https://github.com/mastra-ai/mastra/commit/b2e45eca727a8db01a81ba93f1a5219c7183c839), [`d6d49f7`](https://github.com/mastra-ai/mastra/commit/d6d49f7b8714fa19a52ff9c7cf7fb7e73751901e), [`a534e95`](https://github.com/mastra-ai/mastra/commit/a534e9591f83b3cc1ebff99c67edf4cda7bf81d3), [`9d0e7fe`](https://github.com/mastra-ai/mastra/commit/9d0e7feca8ed98de959f53476ee1456073673348), [`53d927c`](https://github.com/mastra-ai/mastra/commit/53d927cc6f03bff33655b7e2b788da445a08731d), [`3f2faf2`](https://github.com/mastra-ai/mastra/commit/3f2faf2e2d685d6c053cc5af1bf9fedf267b2ce5), [`22f64bc`](https://github.com/mastra-ai/mastra/commit/22f64bc1d37149480b58bf2fefe35b79a1e3e7d5), [`83d5942`](https://github.com/mastra-ai/mastra/commit/83d5942669ce7bba4a6ca4fd4da697a10eb5ebdc), [`b7959e6`](https://github.com/mastra-ai/mastra/commit/b7959e6e25a46b480f9ea2217c4c6c588c423791), [`bda6370`](https://github.com/mastra-ai/mastra/commit/bda637009360649aaf579919e7873e33553c273e), [`d7acd8e`](https://github.com/mastra-ai/mastra/commit/d7acd8e987b5d7eff4fd98b0906c17c06a2e83d5), [`c7f1f7d`](https://github.com/mastra-ai/mastra/commit/c7f1f7d24f61f247f018cc2d1f33bf63212959a7), [`0bddc6d`](https://github.com/mastra-ai/mastra/commit/0bddc6d8dbd6f6008c0cba2e4960a2da75a55af1), [`735d8c1`](https://github.com/mastra-ai/mastra/commit/735d8c1c0d19fbc09e6f8b66cf41bc7655993838), [`acf322e`](https://github.com/mastra-ai/mastra/commit/acf322e0f1fd0189684cf529d91c694bea918a45), [`c942802`](https://github.com/mastra-ai/mastra/commit/c942802a477a925b01859a7b8688d4355715caaa), [`a0c8c1b`](https://github.com/mastra-ai/mastra/commit/a0c8c1b87d4fee252aebda73e8637fbe01d761c9), [`cc34739`](https://github.com/mastra-ai/mastra/commit/cc34739c34b6266a91bea561119240a7acf47887), [`c218bd3`](https://github.com/mastra-ai/mastra/commit/c218bd3759e32423735b04843a09404572631014), [`2c4438b`](https://github.com/mastra-ai/mastra/commit/2c4438b87817ab7eed818c7990fef010475af1a3), [`2b8893c`](https://github.com/mastra-ai/mastra/commit/2b8893cb108ef9acb72ee7835cd625610d2c1a4a), [`8e5c75b`](https://github.com/mastra-ai/mastra/commit/8e5c75bdb1d08a42d45309a4c72def4b6890230f), [`e59e0d3`](https://github.com/mastra-ai/mastra/commit/e59e0d32afb5fcf2c9f3c00c8f81f6c21d3a63fa), [`fa8409b`](https://github.com/mastra-ai/mastra/commit/fa8409bc39cfd8ba6643b9db5269b90b22e2a2f7), [`173c535`](https://github.com/mastra-ai/mastra/commit/173c535c0645b0da404fe09f003778f0b0d4e019)]:
  - @mastra/core@1.0.0-beta.0

## 0.22.2

### Patch Changes

- Updated dependencies [[`2b031e2`](https://github.com/mastra-ai/mastra/commit/2b031e25ca10cd3e4d63e6a27f909cba26d91405)]:
  - @mastra/core@0.22.2

## 0.22.2-alpha.0

### Patch Changes

- Updated dependencies [[`2b031e2`](https://github.com/mastra-ai/mastra/commit/2b031e25ca10cd3e4d63e6a27f909cba26d91405)]:
  - @mastra/core@0.22.2-alpha.0

## 0.22.1

### Patch Changes

- Get agent registered on a parent agent via API ([#9106](https://github.com/mastra-ai/mastra/pull/9106))

- Updated dependencies []:
  - @mastra/core@0.22.1

## 0.22.1-alpha.0

### Patch Changes

- Get agent registered on a parent agent via API ([#9106](https://github.com/mastra-ai/mastra/pull/9106))

- Updated dependencies []:
  - @mastra/core@0.22.1-alpha.0

## 0.22.0

### Minor Changes

- Consolidate streamVNext logic into stream, move old stream function into streamLegacy ([#9092](https://github.com/mastra-ai/mastra/pull/9092))

- Update peer dependencies to match core package version bump (0.21.2) ([#9038](https://github.com/mastra-ai/mastra/pull/9038))

- Update peer dependencies to match core package version bump (0.22.0) ([#9092](https://github.com/mastra-ai/mastra/pull/9092))

- Update peer dependencies to match core package version bump (0.21.2) ([#9021](https://github.com/mastra-ai/mastra/pull/9021))

### Patch Changes

- Updated `watch` and `watchAsync` methods to use proper function overloads instead of generic conditional types, ensuring compatibility with the base Run class signatures. ([#9048](https://github.com/mastra-ai/mastra/pull/9048))

- Generate a title for Agent.network() threads ([#8853](https://github.com/mastra-ai/mastra/pull/8853))

- Fix custom metadata preservation in UIMessages when loading threads. The `getMessagesHandler` now converts `messagesV2` (V2 format with metadata) instead of `messages` (V1 format without metadata) to AIV5.UI format. Also updates the abstract `MastraMemory.query()` return type to include `messagesV2` for proper type safety. ([#9029](https://github.com/mastra-ai/mastra/pull/9029))

- Fix provider tools for popular providers and add support for anthropic/claude skills. ([#9038](https://github.com/mastra-ai/mastra/pull/9038))

- Show agent tool output better in playground ([#9021](https://github.com/mastra-ai/mastra/pull/9021))

- Update peerdeps to 0.23.0-0 ([#9043](https://github.com/mastra-ai/mastra/pull/9043))

- Updated dependencies [[`c67ca32`](https://github.com/mastra-ai/mastra/commit/c67ca32e3c2cf69bfc146580770c720220ca44ac), [`efb5ed9`](https://github.com/mastra-ai/mastra/commit/efb5ed946ae7f410bc68c9430beb4b010afd25ec), [`dbc9e12`](https://github.com/mastra-ai/mastra/commit/dbc9e1216ba575ba59ead4afb727a01215f7de4f), [`99e41b9`](https://github.com/mastra-ai/mastra/commit/99e41b94957cdd25137d3ac12e94e8b21aa01b68), [`c28833c`](https://github.com/mastra-ai/mastra/commit/c28833c5b6d8e10eeffd7f7d39129d53b8bca240), [`8ea07b4`](https://github.com/mastra-ai/mastra/commit/8ea07b4bdc73e4218437dbb6dcb0f4b23e745a44), [`ba201b8`](https://github.com/mastra-ai/mastra/commit/ba201b8f8feac4c72350f2dbd52c13c7297ba7b0), [`f053e89`](https://github.com/mastra-ai/mastra/commit/f053e89160dbd0bd3333fc3492f68231b5c7c349), [`4fc4136`](https://github.com/mastra-ai/mastra/commit/4fc413652866a8d2240694fddb2562e9edbb70df), [`b78e04d`](https://github.com/mastra-ai/mastra/commit/b78e04d935a16ecb1e59c5c96e564903527edddd), [`d10baf5`](https://github.com/mastra-ai/mastra/commit/d10baf5a3c924f2a6654e23a3e318ed03f189b76), [`038c55a`](https://github.com/mastra-ai/mastra/commit/038c55a7090fc1b1513a966386d3072617f836ac), [`182f045`](https://github.com/mastra-ai/mastra/commit/182f0458f25bd70aa774e64fd923c8a483eddbf1), [`9a1a485`](https://github.com/mastra-ai/mastra/commit/9a1a4859b855e37239f652bf14b1ecd1029b8c4e), [`9257233`](https://github.com/mastra-ai/mastra/commit/9257233c4ffce09b2bedc2a9adbd70d7a83fa8e2), [`7620d2b`](https://github.com/mastra-ai/mastra/commit/7620d2bddeb4fae4c3c0a0b4e672969795fca11a), [`b2365f0`](https://github.com/mastra-ai/mastra/commit/b2365f038dd4c5f06400428b224af963f399ad50), [`0f1a4c9`](https://github.com/mastra-ai/mastra/commit/0f1a4c984fb4b104b2f0b63ba18c9fa77f567700), [`9029ba3`](https://github.com/mastra-ai/mastra/commit/9029ba34459c8859fed4c6b73efd8e2d0021e7ba), [`426cc56`](https://github.com/mastra-ai/mastra/commit/426cc561c85ae76a112ded2385532a91f9f9f074), [`00931fb`](https://github.com/mastra-ai/mastra/commit/00931fb1a21aa42c4fbc20c2c40dd62466b8fc8f), [`e473bfe`](https://github.com/mastra-ai/mastra/commit/e473bfe416c0b8e876973c2b6a6f13c394b7a93f), [`b78e04d`](https://github.com/mastra-ai/mastra/commit/b78e04d935a16ecb1e59c5c96e564903527edddd), [`2db6160`](https://github.com/mastra-ai/mastra/commit/2db6160e2022ff8827c15d30157e684683b934b5), [`8aeea37`](https://github.com/mastra-ai/mastra/commit/8aeea37efdde347c635a67fed56794943b7f74ec), [`02fe153`](https://github.com/mastra-ai/mastra/commit/02fe15351d6021d214da48ec982a0e9e4150bcee), [`648e2ca`](https://github.com/mastra-ai/mastra/commit/648e2ca42da54838c6ccbdaadc6fadd808fa6b86), [`74567b3`](https://github.com/mastra-ai/mastra/commit/74567b3d237ae3915cd0bca3cf55fa0a64e4e4a4), [`b65c5e0`](https://github.com/mastra-ai/mastra/commit/b65c5e0fe6f3c390a9a8bbcf69304d972c3a4afb), [`15a1733`](https://github.com/mastra-ai/mastra/commit/15a1733074cee8bd37370e1af34cd818e89fa7ac), [`fc2a774`](https://github.com/mastra-ai/mastra/commit/fc2a77468981aaddc3e77f83f0c4ad4a4af140da), [`4e08933`](https://github.com/mastra-ai/mastra/commit/4e08933625464dfde178347af5b6278fcf34188e)]:
  - @mastra/core@0.22.0

## 0.22.0-alpha.1

### Minor Changes

- Consolidate streamVNext logic into stream, move old stream function into streamLegacy ([#9092](https://github.com/mastra-ai/mastra/pull/9092))

- Update peer dependencies to match core package version bump (0.21.2) ([#9038](https://github.com/mastra-ai/mastra/pull/9038))

- Update peer dependencies to match core package version bump (0.22.0) ([#9092](https://github.com/mastra-ai/mastra/pull/9092))

- Update peer dependencies to match core package version bump (0.21.2) ([#9021](https://github.com/mastra-ai/mastra/pull/9021))

### Patch Changes

- Updated `watch` and `watchAsync` methods to use proper function overloads instead of generic conditional types, ensuring compatibility with the base Run class signatures. ([#9048](https://github.com/mastra-ai/mastra/pull/9048))

- Fix custom metadata preservation in UIMessages when loading threads. The `getMessagesHandler` now converts `messagesV2` (V2 format with metadata) instead of `messages` (V1 format without metadata) to AIV5.UI format. Also updates the abstract `MastraMemory.query()` return type to include `messagesV2` for proper type safety. ([#9029](https://github.com/mastra-ai/mastra/pull/9029))

- Fix provider tools for popular providers and add support for anthropic/claude skills. ([#9038](https://github.com/mastra-ai/mastra/pull/9038))

- Show agent tool output better in playground ([#9021](https://github.com/mastra-ai/mastra/pull/9021))

- Update peerdeps to 0.23.0-0 ([#9043](https://github.com/mastra-ai/mastra/pull/9043))

- Updated dependencies [[`efb5ed9`](https://github.com/mastra-ai/mastra/commit/efb5ed946ae7f410bc68c9430beb4b010afd25ec), [`8ea07b4`](https://github.com/mastra-ai/mastra/commit/8ea07b4bdc73e4218437dbb6dcb0f4b23e745a44), [`ba201b8`](https://github.com/mastra-ai/mastra/commit/ba201b8f8feac4c72350f2dbd52c13c7297ba7b0), [`4fc4136`](https://github.com/mastra-ai/mastra/commit/4fc413652866a8d2240694fddb2562e9edbb70df), [`b78e04d`](https://github.com/mastra-ai/mastra/commit/b78e04d935a16ecb1e59c5c96e564903527edddd), [`d10baf5`](https://github.com/mastra-ai/mastra/commit/d10baf5a3c924f2a6654e23a3e318ed03f189b76), [`038c55a`](https://github.com/mastra-ai/mastra/commit/038c55a7090fc1b1513a966386d3072617f836ac), [`182f045`](https://github.com/mastra-ai/mastra/commit/182f0458f25bd70aa774e64fd923c8a483eddbf1), [`7620d2b`](https://github.com/mastra-ai/mastra/commit/7620d2bddeb4fae4c3c0a0b4e672969795fca11a), [`b2365f0`](https://github.com/mastra-ai/mastra/commit/b2365f038dd4c5f06400428b224af963f399ad50), [`9029ba3`](https://github.com/mastra-ai/mastra/commit/9029ba34459c8859fed4c6b73efd8e2d0021e7ba), [`426cc56`](https://github.com/mastra-ai/mastra/commit/426cc561c85ae76a112ded2385532a91f9f9f074), [`00931fb`](https://github.com/mastra-ai/mastra/commit/00931fb1a21aa42c4fbc20c2c40dd62466b8fc8f), [`e473bfe`](https://github.com/mastra-ai/mastra/commit/e473bfe416c0b8e876973c2b6a6f13c394b7a93f), [`b78e04d`](https://github.com/mastra-ai/mastra/commit/b78e04d935a16ecb1e59c5c96e564903527edddd), [`648e2ca`](https://github.com/mastra-ai/mastra/commit/648e2ca42da54838c6ccbdaadc6fadd808fa6b86), [`b65c5e0`](https://github.com/mastra-ai/mastra/commit/b65c5e0fe6f3c390a9a8bbcf69304d972c3a4afb)]:
  - @mastra/core@0.22.0-alpha.1

## 0.21.2-alpha.0

### Patch Changes

- Generate a title for Agent.network() threads ([#8853](https://github.com/mastra-ai/mastra/pull/8853))

- Updated dependencies [[`c67ca32`](https://github.com/mastra-ai/mastra/commit/c67ca32e3c2cf69bfc146580770c720220ca44ac), [`dbc9e12`](https://github.com/mastra-ai/mastra/commit/dbc9e1216ba575ba59ead4afb727a01215f7de4f), [`99e41b9`](https://github.com/mastra-ai/mastra/commit/99e41b94957cdd25137d3ac12e94e8b21aa01b68), [`c28833c`](https://github.com/mastra-ai/mastra/commit/c28833c5b6d8e10eeffd7f7d39129d53b8bca240), [`f053e89`](https://github.com/mastra-ai/mastra/commit/f053e89160dbd0bd3333fc3492f68231b5c7c349), [`9a1a485`](https://github.com/mastra-ai/mastra/commit/9a1a4859b855e37239f652bf14b1ecd1029b8c4e), [`9257233`](https://github.com/mastra-ai/mastra/commit/9257233c4ffce09b2bedc2a9adbd70d7a83fa8e2), [`0f1a4c9`](https://github.com/mastra-ai/mastra/commit/0f1a4c984fb4b104b2f0b63ba18c9fa77f567700), [`2db6160`](https://github.com/mastra-ai/mastra/commit/2db6160e2022ff8827c15d30157e684683b934b5), [`8aeea37`](https://github.com/mastra-ai/mastra/commit/8aeea37efdde347c635a67fed56794943b7f74ec), [`02fe153`](https://github.com/mastra-ai/mastra/commit/02fe15351d6021d214da48ec982a0e9e4150bcee), [`74567b3`](https://github.com/mastra-ai/mastra/commit/74567b3d237ae3915cd0bca3cf55fa0a64e4e4a4), [`15a1733`](https://github.com/mastra-ai/mastra/commit/15a1733074cee8bd37370e1af34cd818e89fa7ac), [`fc2a774`](https://github.com/mastra-ai/mastra/commit/fc2a77468981aaddc3e77f83f0c4ad4a4af140da), [`4e08933`](https://github.com/mastra-ai/mastra/commit/4e08933625464dfde178347af5b6278fcf34188e)]:
  - @mastra/core@0.21.2-alpha.0

## 0.21.1

### Patch Changes

- Updated dependencies [[`ca85c93`](https://github.com/mastra-ai/mastra/commit/ca85c932b232e6ad820c811ec176d98e68c59b0a), [`a1d40f8`](https://github.com/mastra-ai/mastra/commit/a1d40f88d4ce42c4508774ad22e38ac582157af2), [`01c4a25`](https://github.com/mastra-ai/mastra/commit/01c4a2506c514d5e861c004d3d2fb3791c6391f3), [`cce8aad`](https://github.com/mastra-ai/mastra/commit/cce8aad878a0dd98e5647680f3765caba0b1701c)]:
  - @mastra/core@0.21.1

## 0.21.1-alpha.0

### Patch Changes

- Updated dependencies [[`ca85c93`](https://github.com/mastra-ai/mastra/commit/ca85c932b232e6ad820c811ec176d98e68c59b0a), [`a1d40f8`](https://github.com/mastra-ai/mastra/commit/a1d40f88d4ce42c4508774ad22e38ac582157af2), [`01c4a25`](https://github.com/mastra-ai/mastra/commit/01c4a2506c514d5e861c004d3d2fb3791c6391f3), [`cce8aad`](https://github.com/mastra-ai/mastra/commit/cce8aad878a0dd98e5647680f3765caba0b1701c)]:
  - @mastra/core@0.21.1-alpha.0

## 0.21.0

### Minor Changes

- Update structuredOutput to use response format by default with an opt in to json prompt injection. ([#8557](https://github.com/mastra-ai/mastra/pull/8557))
  Replaced internal usage of output with structuredOutput.

- Update peer dependencies to match core package version bump (0.21.0) ([#8557](https://github.com/mastra-ai/mastra/pull/8557))

### Patch Changes

- Update peer dependencies to match core package version bump (0.21.0) ([#8619](https://github.com/mastra-ai/mastra/pull/8619))

- Include span id and trace id when running live scorers ([#8842](https://github.com/mastra-ai/mastra/pull/8842))

- Update peer dependencies to match core package version bump (0.21.0) ([#8626](https://github.com/mastra-ai/mastra/pull/8626))

- Update peer dependencies to match core package version bump (0.21.0) ([#8686](https://github.com/mastra-ai/mastra/pull/8686))

- Updated dependencies [[`1ed9670`](https://github.com/mastra-ai/mastra/commit/1ed9670d3ca50cb60dc2e517738c5eef3968ed27), [`b5a66b7`](https://github.com/mastra-ai/mastra/commit/b5a66b748a14fc8b3f63b04642ddb9621fbcc9e0), [`f59fc1e`](https://github.com/mastra-ai/mastra/commit/f59fc1e406b8912e692f6bff6cfd4754cc8d165c), [`158381d`](https://github.com/mastra-ai/mastra/commit/158381d39335be934b81ef8a1947bccace492c25), [`a1799bc`](https://github.com/mastra-ai/mastra/commit/a1799bcc1b5a1cdc188f2ac0165f17a1c4ac6f7b), [`6ff6094`](https://github.com/mastra-ai/mastra/commit/6ff60946f4ecfebdeef6e21d2b230c2204f2c9b8), [`fb703b9`](https://github.com/mastra-ai/mastra/commit/fb703b9634eeaff1a6eb2b5531ce0f9e8fb04727), [`37a2314`](https://github.com/mastra-ai/mastra/commit/37a23148e0e5a3b40d4f9f098b194671a8a49faf), [`7b1ef57`](https://github.com/mastra-ai/mastra/commit/7b1ef57fc071c2aa2a2e32905b18cd88719c5a39), [`05a9dee`](https://github.com/mastra-ai/mastra/commit/05a9dee3d355694d28847bfffb6289657fcf7dfa), [`e3c1077`](https://github.com/mastra-ai/mastra/commit/e3c107763aedd1643d3def5df450c235da9ff76c), [`1908ca0`](https://github.com/mastra-ai/mastra/commit/1908ca0521f90e43779cc29ab590173ca560443c), [`1bccdb3`](https://github.com/mastra-ai/mastra/commit/1bccdb33eb90cbeba2dc5ece1c2561fb774b26b6), [`5ef944a`](https://github.com/mastra-ai/mastra/commit/5ef944a3721d93105675cac2b2311432ff8cc393), [`d6b186f`](https://github.com/mastra-ai/mastra/commit/d6b186fb08f1caf1b86f73d3a5ee88fb999ca3be), [`ee68e82`](https://github.com/mastra-ai/mastra/commit/ee68e8289ea4408d29849e899bc6e78b3bd4e843), [`228228b`](https://github.com/mastra-ai/mastra/commit/228228b0b1de9291cb8887587f5cea1a8757ebad), [`ea33930`](https://github.com/mastra-ai/mastra/commit/ea339301e82d6318257720d811b043014ee44064), [`65493b3`](https://github.com/mastra-ai/mastra/commit/65493b31c36f6fdb78f9679f7e1ecf0c250aa5ee), [`a998b8f`](https://github.com/mastra-ai/mastra/commit/a998b8f858091c2ec47683e60766cf12d03001e4), [`b5a66b7`](https://github.com/mastra-ai/mastra/commit/b5a66b748a14fc8b3f63b04642ddb9621fbcc9e0), [`8a37bdd`](https://github.com/mastra-ai/mastra/commit/8a37bddb6d8614a32c5b70303d583d80c620ea61), [`135d6f2`](https://github.com/mastra-ai/mastra/commit/135d6f22a326ed1dffff858700669dff09d2c9eb)]:
  - @mastra/core@0.21.0

## 0.21.0-alpha.4

### Patch Changes

- Include span id and trace id when running live scorers ([#8842](https://github.com/mastra-ai/mastra/pull/8842))

- Updated dependencies [[`1908ca0`](https://github.com/mastra-ai/mastra/commit/1908ca0521f90e43779cc29ab590173ca560443c)]:
  - @mastra/core@0.21.0-alpha.4

## 0.21.0-alpha.3

### Patch Changes

- Updated dependencies [[`a1799bc`](https://github.com/mastra-ai/mastra/commit/a1799bcc1b5a1cdc188f2ac0165f17a1c4ac6f7b), [`6ff6094`](https://github.com/mastra-ai/mastra/commit/6ff60946f4ecfebdeef6e21d2b230c2204f2c9b8)]:
  - @mastra/core@0.21.0-alpha.3

## 0.21.0-alpha.2

### Patch Changes

- Updated dependencies [[`f59fc1e`](https://github.com/mastra-ai/mastra/commit/f59fc1e406b8912e692f6bff6cfd4754cc8d165c)]:
  - @mastra/core@0.21.0-alpha.2

## 0.21.0-alpha.1

### Patch Changes

- Updated dependencies [[`1ed9670`](https://github.com/mastra-ai/mastra/commit/1ed9670d3ca50cb60dc2e517738c5eef3968ed27), [`158381d`](https://github.com/mastra-ai/mastra/commit/158381d39335be934b81ef8a1947bccace492c25), [`fb703b9`](https://github.com/mastra-ai/mastra/commit/fb703b9634eeaff1a6eb2b5531ce0f9e8fb04727), [`37a2314`](https://github.com/mastra-ai/mastra/commit/37a23148e0e5a3b40d4f9f098b194671a8a49faf), [`05a9dee`](https://github.com/mastra-ai/mastra/commit/05a9dee3d355694d28847bfffb6289657fcf7dfa), [`e3c1077`](https://github.com/mastra-ai/mastra/commit/e3c107763aedd1643d3def5df450c235da9ff76c), [`1bccdb3`](https://github.com/mastra-ai/mastra/commit/1bccdb33eb90cbeba2dc5ece1c2561fb774b26b6), [`5ef944a`](https://github.com/mastra-ai/mastra/commit/5ef944a3721d93105675cac2b2311432ff8cc393), [`d6b186f`](https://github.com/mastra-ai/mastra/commit/d6b186fb08f1caf1b86f73d3a5ee88fb999ca3be), [`65493b3`](https://github.com/mastra-ai/mastra/commit/65493b31c36f6fdb78f9679f7e1ecf0c250aa5ee), [`a998b8f`](https://github.com/mastra-ai/mastra/commit/a998b8f858091c2ec47683e60766cf12d03001e4), [`8a37bdd`](https://github.com/mastra-ai/mastra/commit/8a37bddb6d8614a32c5b70303d583d80c620ea61)]:
  - @mastra/core@0.21.0-alpha.1

## 0.21.0-alpha.0

### Minor Changes

- Update structuredOutput to use response format by default with an opt in to json prompt injection. ([#8557](https://github.com/mastra-ai/mastra/pull/8557))
  Replaced internal usage of output with structuredOutput.

- Update peer dependencies to match core package version bump (0.21.0) ([#8557](https://github.com/mastra-ai/mastra/pull/8557))

### Patch Changes

- Update peer dependencies to match core package version bump (0.21.0) ([#8619](https://github.com/mastra-ai/mastra/pull/8619))

- Update peer dependencies to match core package version bump (0.21.0) ([#8626](https://github.com/mastra-ai/mastra/pull/8626))

- Update peer dependencies to match core package version bump (0.21.0) ([#8686](https://github.com/mastra-ai/mastra/pull/8686))

- Updated dependencies [[`b5a66b7`](https://github.com/mastra-ai/mastra/commit/b5a66b748a14fc8b3f63b04642ddb9621fbcc9e0), [`7b1ef57`](https://github.com/mastra-ai/mastra/commit/7b1ef57fc071c2aa2a2e32905b18cd88719c5a39), [`ee68e82`](https://github.com/mastra-ai/mastra/commit/ee68e8289ea4408d29849e899bc6e78b3bd4e843), [`228228b`](https://github.com/mastra-ai/mastra/commit/228228b0b1de9291cb8887587f5cea1a8757ebad), [`ea33930`](https://github.com/mastra-ai/mastra/commit/ea339301e82d6318257720d811b043014ee44064), [`b5a66b7`](https://github.com/mastra-ai/mastra/commit/b5a66b748a14fc8b3f63b04642ddb9621fbcc9e0), [`135d6f2`](https://github.com/mastra-ai/mastra/commit/135d6f22a326ed1dffff858700669dff09d2c9eb), [`59d036d`](https://github.com/mastra-ai/mastra/commit/59d036d4c2706b430b0e3f1f1e0ee853ce16ca04)]:
  - @mastra/core@0.21.0-alpha.0

## 0.20.2

### Patch Changes

- Pass through input/output processors to the server agent endpoints ([#8546](https://github.com/mastra-ai/mastra/pull/8546))

- Updated dependencies [[`07eaf25`](https://github.com/mastra-ai/mastra/commit/07eaf25aada9e42235dbf905854de53da4d8121b), [`0d71771`](https://github.com/mastra-ai/mastra/commit/0d71771f5711164c79f8e80919bc84d6bffeb6bc), [`0d6e55e`](https://github.com/mastra-ai/mastra/commit/0d6e55ecc5a2e689cd4fc9c86525e0eb54d82372), [`68b1111`](https://github.com/mastra-ai/mastra/commit/68b11118a1303f93e9c0c157850c0751309304c5)]:
  - @mastra/core@0.20.2

## 0.20.2-alpha.1

### Patch Changes

- Pass through input/output processors to the server agent endpoints ([#8546](https://github.com/mastra-ai/mastra/pull/8546))

- Updated dependencies [[`07eaf25`](https://github.com/mastra-ai/mastra/commit/07eaf25aada9e42235dbf905854de53da4d8121b), [`68b1111`](https://github.com/mastra-ai/mastra/commit/68b11118a1303f93e9c0c157850c0751309304c5)]:
  - @mastra/core@0.20.2-alpha.1

## 0.20.2-alpha.0

### Patch Changes

- Updated dependencies [[`0d71771`](https://github.com/mastra-ai/mastra/commit/0d71771f5711164c79f8e80919bc84d6bffeb6bc), [`0d6e55e`](https://github.com/mastra-ai/mastra/commit/0d6e55ecc5a2e689cd4fc9c86525e0eb54d82372)]:
  - @mastra/core@0.20.2-alpha.0

## 0.20.1

### Patch Changes

- Mutable shared workflow run state ([#8545](https://github.com/mastra-ai/mastra/pull/8545))

- Fix TypeScript errors with provider-defined tools by updating ai-v5 and openai-v5 to matching provider-utils versions. This ensures npm deduplicates to a single provider-utils instance, resolving type incompatibility issues when passing provider tools to Agent. ([#8584](https://github.com/mastra-ai/mastra/pull/8584))

  Also adds deprecation warning to Agent import from root path to encourage using the recommended subpath import.

- Updated dependencies [[`c621613`](https://github.com/mastra-ai/mastra/commit/c621613069173c69eb2c3ef19a5308894c6549f0), [`12b1189`](https://github.com/mastra-ai/mastra/commit/12b118942445e4de0dd916c593e33ec78dc3bc73), [`4783b30`](https://github.com/mastra-ai/mastra/commit/4783b3063efea887825514b783ba27f67912c26d), [`076b092`](https://github.com/mastra-ai/mastra/commit/076b0924902ff0f49d5712d2df24c4cca683713f), [`2aee9e7`](https://github.com/mastra-ai/mastra/commit/2aee9e7d188b8b256a4ddc203ccefb366b4867fa), [`c582906`](https://github.com/mastra-ai/mastra/commit/c5829065a346260f96c4beb8af131b94804ae3ad), [`fa2eb96`](https://github.com/mastra-ai/mastra/commit/fa2eb96af16c7d433891a73932764960d3235c1d), [`ee9108f`](https://github.com/mastra-ai/mastra/commit/ee9108fa29bb8368fc23df158c9f0645b2d7b65c), [`4783b30`](https://github.com/mastra-ai/mastra/commit/4783b3063efea887825514b783ba27f67912c26d), [`a739d0c`](https://github.com/mastra-ai/mastra/commit/a739d0c8b37cd89569e04a6ca0827083c6167e19), [`603e927`](https://github.com/mastra-ai/mastra/commit/603e9279db8bf8a46caf83881c6b7389ccffff7e), [`cd45982`](https://github.com/mastra-ai/mastra/commit/cd4598291cda128a88738734ae6cbef076ebdebd), [`874f74d`](https://github.com/mastra-ai/mastra/commit/874f74da4b1acf6517f18132d035612c3ecc394a), [`b728a45`](https://github.com/mastra-ai/mastra/commit/b728a45ab3dba59da0f5ee36b81fe246659f305d), [`0baf2ba`](https://github.com/mastra-ai/mastra/commit/0baf2bab8420277072ef1f95df5ea7b0a2f61fe7), [`10e633a`](https://github.com/mastra-ai/mastra/commit/10e633a07d333466d9734c97acfc3dbf757ad2d0), [`a6d69c5`](https://github.com/mastra-ai/mastra/commit/a6d69c5fb50c0875b46275811fece5862f03c6a0), [`84199af`](https://github.com/mastra-ai/mastra/commit/84199af8673f6f9cb59286ffb5477a41932775de), [`7f431af`](https://github.com/mastra-ai/mastra/commit/7f431afd586b7d3265075e73106eb73167edbb86), [`26e968d`](https://github.com/mastra-ai/mastra/commit/26e968db2171ded9e4d47aa1b4f19e1e771158d0), [`cbd3fb6`](https://github.com/mastra-ai/mastra/commit/cbd3fb65adb03a7c0df193cb998aed5ac56675ee)]:
  - @mastra/core@0.20.1

## 0.20.1-alpha.4

### Patch Changes

- Updated dependencies [[`b728a45`](https://github.com/mastra-ai/mastra/commit/b728a45ab3dba59da0f5ee36b81fe246659f305d)]:
  - @mastra/core@0.20.1-alpha.4

## 0.20.1-alpha.3

### Patch Changes

- Fix TypeScript errors with provider-defined tools by updating ai-v5 and openai-v5 to matching provider-utils versions. This ensures npm deduplicates to a single provider-utils instance, resolving type incompatibility issues when passing provider tools to Agent. ([#8584](https://github.com/mastra-ai/mastra/pull/8584))

  Also adds deprecation warning to Agent import from root path to encourage using the recommended subpath import.

- Updated dependencies [[`a6d69c5`](https://github.com/mastra-ai/mastra/commit/a6d69c5fb50c0875b46275811fece5862f03c6a0), [`84199af`](https://github.com/mastra-ai/mastra/commit/84199af8673f6f9cb59286ffb5477a41932775de), [`7f431af`](https://github.com/mastra-ai/mastra/commit/7f431afd586b7d3265075e73106eb73167edbb86)]:
  - @mastra/core@0.20.1-alpha.3

## 0.20.1-alpha.2

### Patch Changes

- Updated dependencies [[`ee9108f`](https://github.com/mastra-ai/mastra/commit/ee9108fa29bb8368fc23df158c9f0645b2d7b65c)]:
  - @mastra/core@0.20.1-alpha.2

## 0.20.1-alpha.1

### Patch Changes

- Mutable shared workflow run state ([#8545](https://github.com/mastra-ai/mastra/pull/8545))

- Updated dependencies [[`c621613`](https://github.com/mastra-ai/mastra/commit/c621613069173c69eb2c3ef19a5308894c6549f0), [`12b1189`](https://github.com/mastra-ai/mastra/commit/12b118942445e4de0dd916c593e33ec78dc3bc73), [`4783b30`](https://github.com/mastra-ai/mastra/commit/4783b3063efea887825514b783ba27f67912c26d), [`076b092`](https://github.com/mastra-ai/mastra/commit/076b0924902ff0f49d5712d2df24c4cca683713f), [`2aee9e7`](https://github.com/mastra-ai/mastra/commit/2aee9e7d188b8b256a4ddc203ccefb366b4867fa), [`c582906`](https://github.com/mastra-ai/mastra/commit/c5829065a346260f96c4beb8af131b94804ae3ad), [`fa2eb96`](https://github.com/mastra-ai/mastra/commit/fa2eb96af16c7d433891a73932764960d3235c1d), [`4783b30`](https://github.com/mastra-ai/mastra/commit/4783b3063efea887825514b783ba27f67912c26d), [`a739d0c`](https://github.com/mastra-ai/mastra/commit/a739d0c8b37cd89569e04a6ca0827083c6167e19), [`603e927`](https://github.com/mastra-ai/mastra/commit/603e9279db8bf8a46caf83881c6b7389ccffff7e), [`cd45982`](https://github.com/mastra-ai/mastra/commit/cd4598291cda128a88738734ae6cbef076ebdebd), [`874f74d`](https://github.com/mastra-ai/mastra/commit/874f74da4b1acf6517f18132d035612c3ecc394a), [`0baf2ba`](https://github.com/mastra-ai/mastra/commit/0baf2bab8420277072ef1f95df5ea7b0a2f61fe7), [`26e968d`](https://github.com/mastra-ai/mastra/commit/26e968db2171ded9e4d47aa1b4f19e1e771158d0), [`cbd3fb6`](https://github.com/mastra-ai/mastra/commit/cbd3fb65adb03a7c0df193cb998aed5ac56675ee)]:
  - @mastra/core@0.20.1-alpha.1

## 0.20.1-alpha.0

### Patch Changes

- Updated dependencies [[`10e633a`](https://github.com/mastra-ai/mastra/commit/10e633a07d333466d9734c97acfc3dbf757ad2d0)]:
  - @mastra/core@0.20.1-alpha.0

## 0.20.0

### Minor Changes

- Breaking change to move the agent.streamVNext/generateVNext implementation to the default stream/generate. The old stream/generate have now been moved to streamLegacy and generateLegacy ([#8097](https://github.com/mastra-ai/mastra/pull/8097))

### Patch Changes

- Add approve and decline tool calls to mastra server pkg ([#8360](https://github.com/mastra-ai/mastra/pull/8360))

- Fix/8219 preserve resourceid on resume ([#8359](https://github.com/mastra-ai/mastra/pull/8359))

- Add observe strean to get streans after workflow has been interrupted ([#8318](https://github.com/mastra-ai/mastra/pull/8318))

- Updated dependencies [[`00cb6bd`](https://github.com/mastra-ai/mastra/commit/00cb6bdf78737c0fac14a5a0c7b532a11e38558a), [`869ba22`](https://github.com/mastra-ai/mastra/commit/869ba222e1d6b58fc1b65e7c9fd55ca4e01b8c2f), [`1b73665`](https://github.com/mastra-ai/mastra/commit/1b73665e8e23f5c09d49fcf3e7d709c75259259e), [`f7d7475`](https://github.com/mastra-ai/mastra/commit/f7d747507341aef60ed39e4b49318db1f86034a6), [`084b77b`](https://github.com/mastra-ai/mastra/commit/084b77b2955960e0190af8db3f77138aa83ed65c), [`a93ff84`](https://github.com/mastra-ai/mastra/commit/a93ff84b5e1af07ee236ac8873dac9b49aa5d501), [`bc5aacb`](https://github.com/mastra-ai/mastra/commit/bc5aacb646d468d325327e36117129f28cd13bf6), [`6b5af12`](https://github.com/mastra-ai/mastra/commit/6b5af12ce9e09066e0c32e821c203a6954498bea), [`bf60e4a`](https://github.com/mastra-ai/mastra/commit/bf60e4a89c515afd9570b7b79f33b95e7d07c397), [`d41aee5`](https://github.com/mastra-ai/mastra/commit/d41aee526d124e35f42720a08e64043229193679), [`e8fe13c`](https://github.com/mastra-ai/mastra/commit/e8fe13c4b4c255a42520127797ec394310f7c919), [`3ca833d`](https://github.com/mastra-ai/mastra/commit/3ca833dc994c38e3c9b4f9b4478a61cd8e07b32a), [`1edb8d1`](https://github.com/mastra-ai/mastra/commit/1edb8d1cfb963e72a12412990fb9170936c9904c), [`fbf6e32`](https://github.com/mastra-ai/mastra/commit/fbf6e324946332d0f5ed8930bf9d4d4479cefd7a), [`4753027`](https://github.com/mastra-ai/mastra/commit/4753027ee889288775c6958bdfeda03ff909af67)]:
  - @mastra/core@0.20.0

## 0.20.0-alpha.0

### Minor Changes

- Breaking change to move the agent.streamVNext/generateVNext implementation to the default stream/generate. The old stream/generate have now been moved to streamLegacy and generateLegacy ([#8097](https://github.com/mastra-ai/mastra/pull/8097))

### Patch Changes

- Add approve and decline tool calls to mastra server pkg ([#8360](https://github.com/mastra-ai/mastra/pull/8360))

- Fix/8219 preserve resourceid on resume ([#8359](https://github.com/mastra-ai/mastra/pull/8359))

- Add observe strean to get streans after workflow has been interrupted ([#8318](https://github.com/mastra-ai/mastra/pull/8318))

- Updated dependencies [[`00cb6bd`](https://github.com/mastra-ai/mastra/commit/00cb6bdf78737c0fac14a5a0c7b532a11e38558a), [`869ba22`](https://github.com/mastra-ai/mastra/commit/869ba222e1d6b58fc1b65e7c9fd55ca4e01b8c2f), [`1b73665`](https://github.com/mastra-ai/mastra/commit/1b73665e8e23f5c09d49fcf3e7d709c75259259e), [`f7d7475`](https://github.com/mastra-ai/mastra/commit/f7d747507341aef60ed39e4b49318db1f86034a6), [`084b77b`](https://github.com/mastra-ai/mastra/commit/084b77b2955960e0190af8db3f77138aa83ed65c), [`a93ff84`](https://github.com/mastra-ai/mastra/commit/a93ff84b5e1af07ee236ac8873dac9b49aa5d501), [`bc5aacb`](https://github.com/mastra-ai/mastra/commit/bc5aacb646d468d325327e36117129f28cd13bf6), [`6b5af12`](https://github.com/mastra-ai/mastra/commit/6b5af12ce9e09066e0c32e821c203a6954498bea), [`bf60e4a`](https://github.com/mastra-ai/mastra/commit/bf60e4a89c515afd9570b7b79f33b95e7d07c397), [`d41aee5`](https://github.com/mastra-ai/mastra/commit/d41aee526d124e35f42720a08e64043229193679), [`e8fe13c`](https://github.com/mastra-ai/mastra/commit/e8fe13c4b4c255a42520127797ec394310f7c919), [`3ca833d`](https://github.com/mastra-ai/mastra/commit/3ca833dc994c38e3c9b4f9b4478a61cd8e07b32a), [`1edb8d1`](https://github.com/mastra-ai/mastra/commit/1edb8d1cfb963e72a12412990fb9170936c9904c), [`fbf6e32`](https://github.com/mastra-ai/mastra/commit/fbf6e324946332d0f5ed8930bf9d4d4479cefd7a), [`4753027`](https://github.com/mastra-ai/mastra/commit/4753027ee889288775c6958bdfeda03ff909af67)]:
  - @mastra/core@0.20.0-alpha.0

## 0.19.1

### Patch Changes

- Added Mastra model router to Playground UI ([#8332](https://github.com/mastra-ai/mastra/pull/8332))

- Updated dependencies [[`4a70ccc`](https://github.com/mastra-ai/mastra/commit/4a70ccc5cfa12ae9c2b36545a5814cd98e5a0ead), [`0992b8b`](https://github.com/mastra-ai/mastra/commit/0992b8bf0f4f1ba7ad9940883ec4bb8d867d3105), [`283bea0`](https://github.com/mastra-ai/mastra/commit/283bea07adbaf04a27fa3ad2df611095e0825195)]:
  - @mastra/core@0.19.1

## 0.19.1-alpha.1

### Patch Changes

- Updated dependencies [[`4a70ccc`](https://github.com/mastra-ai/mastra/commit/4a70ccc5cfa12ae9c2b36545a5814cd98e5a0ead)]:
  - @mastra/core@0.19.1-alpha.1

## 0.19.1-alpha.0

### Patch Changes

- Added Mastra model router to Playground UI ([#8332](https://github.com/mastra-ai/mastra/pull/8332))

- Updated dependencies [[`0992b8b`](https://github.com/mastra-ai/mastra/commit/0992b8bf0f4f1ba7ad9940883ec4bb8d867d3105), [`283bea0`](https://github.com/mastra-ai/mastra/commit/283bea07adbaf04a27fa3ad2df611095e0825195)]:
  - @mastra/core@0.19.1-alpha.0

## 0.19.0

### Patch Changes

- Support passing tracing options for start/resume workflows for server APIs and client sdk ([#8277](https://github.com/mastra-ai/mastra/pull/8277))

- add a way to hide the deploy mastra cloud button ([#8137](https://github.com/mastra-ai/mastra/pull/8137))

- Update peer deps ([#8154](https://github.com/mastra-ai/mastra/pull/8154))

- Add types in the streamVNext codepath, fixes for various issues across multiple packages surfaced from type issues, align return types. ([#8010](https://github.com/mastra-ai/mastra/pull/8010))

- Support tracing options for workflow streaming endpoints ([#8278](https://github.com/mastra-ai/mastra/pull/8278))

- Adjust deprecation warnings ([#8326](https://github.com/mastra-ai/mastra/pull/8326))

- When step is created from agent or tool, add the description and component key to show that ([#8151](https://github.com/mastra-ai/mastra/pull/8151))

- Add server apis to get scores by span ([#8237](https://github.com/mastra-ai/mastra/pull/8237))

- Updated dependencies [[`dc099b4`](https://github.com/mastra-ai/mastra/commit/dc099b40fb31147ba3f362f98d991892033c4c67), [`504438b`](https://github.com/mastra-ai/mastra/commit/504438b961bde211071186bba63a842c4e3db879), [`b342a68`](https://github.com/mastra-ai/mastra/commit/b342a68e1399cf1ece9ba11bda112db89d21118c), [`a7243e2`](https://github.com/mastra-ai/mastra/commit/a7243e2e58762667a6e3921e755e89d6bb0a3282), [`7fceb0a`](https://github.com/mastra-ai/mastra/commit/7fceb0a327d678e812f90f5387c5bc4f38bd039e), [`303a9c0`](https://github.com/mastra-ai/mastra/commit/303a9c0d7dd58795915979f06a0512359e4532fb), [`df64f9e`](https://github.com/mastra-ai/mastra/commit/df64f9ef814916fff9baedd861c988084e7c41de), [`370f8a6`](https://github.com/mastra-ai/mastra/commit/370f8a6480faec70fef18d72e5f7538f27004301), [`809eea0`](https://github.com/mastra-ai/mastra/commit/809eea092fa80c3f69b9eaf078d843b57fd2a88e), [`683e5a1`](https://github.com/mastra-ai/mastra/commit/683e5a1466e48b686825b2c11f84680f296138e4), [`3679378`](https://github.com/mastra-ai/mastra/commit/3679378673350aa314741dc826f837b1984149bc), [`7775bc2`](https://github.com/mastra-ai/mastra/commit/7775bc20bb1ad1ab24797fb420e4f96c65b0d8ec), [`623ffaf`](https://github.com/mastra-ai/mastra/commit/623ffaf2d969e11e99a0224633cf7b5a0815c857), [`9fc1613`](https://github.com/mastra-ai/mastra/commit/9fc16136400186648880fd990119ac15f7c02ee4), [`61f62aa`](https://github.com/mastra-ai/mastra/commit/61f62aa31bc88fe4ddf8da6240dbcfbeb07358bd), [`db1891a`](https://github.com/mastra-ai/mastra/commit/db1891a4707443720b7cd8a260dc7e1d49b3609c), [`e8f379d`](https://github.com/mastra-ai/mastra/commit/e8f379d390efa264c4e0874f9ac0cf8839b07777), [`652066b`](https://github.com/mastra-ai/mastra/commit/652066bd1efc6bb6813ba950ed1d7573e8b7d9d4), [`3e292ba`](https://github.com/mastra-ai/mastra/commit/3e292ba00837886d5d68a34cbc0d9b703c991883), [`418c136`](https://github.com/mastra-ai/mastra/commit/418c1366843d88e491bca3f87763899ce855ca29), [`ea8d386`](https://github.com/mastra-ai/mastra/commit/ea8d386cd8c5593664515fd5770c06bf2aa980ef), [`67b0f00`](https://github.com/mastra-ai/mastra/commit/67b0f005b520335c71fb85cbaa25df4ce8484a81), [`c2a4919`](https://github.com/mastra-ai/mastra/commit/c2a4919ba6797d8bdb1509e02287496eef69303e), [`c84b7d0`](https://github.com/mastra-ai/mastra/commit/c84b7d093c4657772140cbfd2b15ef72f3315ed5), [`0130986`](https://github.com/mastra-ai/mastra/commit/0130986fc62d0edcc626dd593282661dbb9af141)]:
  - @mastra/core@0.19.0

## 0.19.0-alpha.1

### Patch Changes

- Support passing tracing options for start/resume workflows for server APIs and client sdk ([#8277](https://github.com/mastra-ai/mastra/pull/8277))

- Update peer deps ([#8154](https://github.com/mastra-ai/mastra/pull/8154))

- Support tracing options for workflow streaming endpoints ([#8278](https://github.com/mastra-ai/mastra/pull/8278))

- Add server apis to get scores by span ([#8237](https://github.com/mastra-ai/mastra/pull/8237))

- Updated dependencies [[`504438b`](https://github.com/mastra-ai/mastra/commit/504438b961bde211071186bba63a842c4e3db879), [`a7243e2`](https://github.com/mastra-ai/mastra/commit/a7243e2e58762667a6e3921e755e89d6bb0a3282), [`7fceb0a`](https://github.com/mastra-ai/mastra/commit/7fceb0a327d678e812f90f5387c5bc4f38bd039e), [`df64f9e`](https://github.com/mastra-ai/mastra/commit/df64f9ef814916fff9baedd861c988084e7c41de), [`809eea0`](https://github.com/mastra-ai/mastra/commit/809eea092fa80c3f69b9eaf078d843b57fd2a88e), [`683e5a1`](https://github.com/mastra-ai/mastra/commit/683e5a1466e48b686825b2c11f84680f296138e4), [`3679378`](https://github.com/mastra-ai/mastra/commit/3679378673350aa314741dc826f837b1984149bc), [`7775bc2`](https://github.com/mastra-ai/mastra/commit/7775bc20bb1ad1ab24797fb420e4f96c65b0d8ec), [`db1891a`](https://github.com/mastra-ai/mastra/commit/db1891a4707443720b7cd8a260dc7e1d49b3609c), [`e8f379d`](https://github.com/mastra-ai/mastra/commit/e8f379d390efa264c4e0874f9ac0cf8839b07777), [`652066b`](https://github.com/mastra-ai/mastra/commit/652066bd1efc6bb6813ba950ed1d7573e8b7d9d4), [`ea8d386`](https://github.com/mastra-ai/mastra/commit/ea8d386cd8c5593664515fd5770c06bf2aa980ef), [`c2a4919`](https://github.com/mastra-ai/mastra/commit/c2a4919ba6797d8bdb1509e02287496eef69303e), [`0130986`](https://github.com/mastra-ai/mastra/commit/0130986fc62d0edcc626dd593282661dbb9af141)]:
  - @mastra/core@0.19.0-alpha.1

## 0.18.1-alpha.0

### Patch Changes

- add a way to hide the deploy mastra cloud button ([#8137](https://github.com/mastra-ai/mastra/pull/8137))

- Add types in the streamVNext codepath, fixes for various issues across multiple packages surfaced from type issues, align return types. ([#8010](https://github.com/mastra-ai/mastra/pull/8010))

- When step is created from agent or tool, add the description and component key to show that ([#8151](https://github.com/mastra-ai/mastra/pull/8151))

- Updated dependencies [[`dc099b4`](https://github.com/mastra-ai/mastra/commit/dc099b40fb31147ba3f362f98d991892033c4c67), [`b342a68`](https://github.com/mastra-ai/mastra/commit/b342a68e1399cf1ece9ba11bda112db89d21118c), [`303a9c0`](https://github.com/mastra-ai/mastra/commit/303a9c0d7dd58795915979f06a0512359e4532fb), [`370f8a6`](https://github.com/mastra-ai/mastra/commit/370f8a6480faec70fef18d72e5f7538f27004301), [`623ffaf`](https://github.com/mastra-ai/mastra/commit/623ffaf2d969e11e99a0224633cf7b5a0815c857), [`9fc1613`](https://github.com/mastra-ai/mastra/commit/9fc16136400186648880fd990119ac15f7c02ee4), [`61f62aa`](https://github.com/mastra-ai/mastra/commit/61f62aa31bc88fe4ddf8da6240dbcfbeb07358bd), [`3e292ba`](https://github.com/mastra-ai/mastra/commit/3e292ba00837886d5d68a34cbc0d9b703c991883), [`418c136`](https://github.com/mastra-ai/mastra/commit/418c1366843d88e491bca3f87763899ce855ca29), [`c84b7d0`](https://github.com/mastra-ai/mastra/commit/c84b7d093c4657772140cbfd2b15ef72f3315ed5)]:
  - @mastra/core@0.18.1-alpha.0

## 0.18.0

### Patch Changes

- Allow agent instructions to accept SystemMessage types ([#7987](https://github.com/mastra-ai/mastra/pull/7987))

  Agents can now use rich instruction formats beyond simple strings:
  - CoreSystemMessage and SystemModelMessage objects with provider-specific options
  - Arrays of strings or system messages
  - Dynamic instructions returning any SystemMessage type

- Add model fallback handlers and apis ([#7378](https://github.com/mastra-ai/mastra/pull/7378))

- Delayed streamVNext breaking change notice by 1 week ([#8121](https://github.com/mastra-ai/mastra/pull/8121))

- Update Peerdeps for packages based on core minor bump ([#8025](https://github.com/mastra-ai/mastra/pull/8025))

- Add server api to score traces ([#8064](https://github.com/mastra-ai/mastra/pull/8064))

- Updated dependencies [[`cf34503`](https://github.com/mastra-ai/mastra/commit/cf345031de4e157f29087946449e60b965e9c8a9), [`6b4b1e4`](https://github.com/mastra-ai/mastra/commit/6b4b1e4235428d39e51cbda9832704c0ba70ab32), [`3469fca`](https://github.com/mastra-ai/mastra/commit/3469fca7bb7e5e19369ff9f7044716a5e4b02585), [`a61f23f`](https://github.com/mastra-ai/mastra/commit/a61f23fbbca4b88b763d94f1d784c47895ed72d7), [`4b339b8`](https://github.com/mastra-ai/mastra/commit/4b339b8141c20d6a6d80583c7e8c5c05d8c19492), [`d1dc606`](https://github.com/mastra-ai/mastra/commit/d1dc6067b0557a71190b68d56ee15b48c26d2411), [`c45298a`](https://github.com/mastra-ai/mastra/commit/c45298a0a0791db35cf79f1199d77004da0704cb), [`c4a8204`](https://github.com/mastra-ai/mastra/commit/c4a82046bfd241d6044e234bc5917d5a01fe6b55), [`d3bd4d4`](https://github.com/mastra-ai/mastra/commit/d3bd4d482a685bbb67bfa89be91c90dca3fa71ad), [`c591dfc`](https://github.com/mastra-ai/mastra/commit/c591dfc1e600fae1dedffe239357d250e146378f), [`1920c5c`](https://github.com/mastra-ai/mastra/commit/1920c5c6d666f687785c73021196aa551e579e0d), [`b6a3b65`](https://github.com/mastra-ai/mastra/commit/b6a3b65d830fa0ca7754ad6481661d1f2c878f21), [`af3abb6`](https://github.com/mastra-ai/mastra/commit/af3abb6f7c7585d856e22d27f4e7d2ece2186b9a)]:
  - @mastra/core@0.18.0

## 0.18.0-alpha.3

### Patch Changes

- Add model fallback handlers and apis ([#7378](https://github.com/mastra-ai/mastra/pull/7378))

- Delayed streamVNext breaking change notice by 1 week ([#8121](https://github.com/mastra-ai/mastra/pull/8121))

- Add server api to score traces ([#8064](https://github.com/mastra-ai/mastra/pull/8064))

- Updated dependencies [[`4b339b8`](https://github.com/mastra-ai/mastra/commit/4b339b8141c20d6a6d80583c7e8c5c05d8c19492), [`c591dfc`](https://github.com/mastra-ai/mastra/commit/c591dfc1e600fae1dedffe239357d250e146378f), [`1920c5c`](https://github.com/mastra-ai/mastra/commit/1920c5c6d666f687785c73021196aa551e579e0d), [`b6a3b65`](https://github.com/mastra-ai/mastra/commit/b6a3b65d830fa0ca7754ad6481661d1f2c878f21), [`af3abb6`](https://github.com/mastra-ai/mastra/commit/af3abb6f7c7585d856e22d27f4e7d2ece2186b9a)]:
  - @mastra/core@0.18.0-alpha.3

## 0.18.0-alpha.2

### Patch Changes

- Allow agent instructions to accept SystemMessage types ([#7987](https://github.com/mastra-ai/mastra/pull/7987))

  Agents can now use rich instruction formats beyond simple strings:
  - CoreSystemMessage and SystemModelMessage objects with provider-specific options
  - Arrays of strings or system messages
  - Dynamic instructions returning any SystemMessage type

- Update Peerdeps for packages based on core minor bump ([#8025](https://github.com/mastra-ai/mastra/pull/8025))

- Updated dependencies [[`cf34503`](https://github.com/mastra-ai/mastra/commit/cf345031de4e157f29087946449e60b965e9c8a9), [`6b4b1e4`](https://github.com/mastra-ai/mastra/commit/6b4b1e4235428d39e51cbda9832704c0ba70ab32), [`3469fca`](https://github.com/mastra-ai/mastra/commit/3469fca7bb7e5e19369ff9f7044716a5e4b02585), [`c4a8204`](https://github.com/mastra-ai/mastra/commit/c4a82046bfd241d6044e234bc5917d5a01fe6b55)]:
  - @mastra/core@0.18.0-alpha.2

## 0.17.2-alpha.1

### Patch Changes

- Updated dependencies [[`c45298a`](https://github.com/mastra-ai/mastra/commit/c45298a0a0791db35cf79f1199d77004da0704cb)]:
  - @mastra/core@0.17.2-alpha.1

## 0.17.2-alpha.0

### Patch Changes

- Updated dependencies [[`a61f23f`](https://github.com/mastra-ai/mastra/commit/a61f23fbbca4b88b763d94f1d784c47895ed72d7), [`d1dc606`](https://github.com/mastra-ai/mastra/commit/d1dc6067b0557a71190b68d56ee15b48c26d2411), [`d3bd4d4`](https://github.com/mastra-ai/mastra/commit/d3bd4d482a685bbb67bfa89be91c90dca3fa71ad)]:
  - @mastra/core@0.17.2-alpha.0

## 0.17.1

### Patch Changes

- fix workflow resuming issue in the playground ([#7988](https://github.com/mastra-ai/mastra/pull/7988))

- Updated dependencies [[`fd00e63`](https://github.com/mastra-ai/mastra/commit/fd00e63759cbcca3473c40cac9843280b0557cff), [`ab610f6`](https://github.com/mastra-ai/mastra/commit/ab610f6f41dbfe6c9502368671485ca7a0aac09b), [`e6bda5f`](https://github.com/mastra-ai/mastra/commit/e6bda5f954ee8493ea18adc1a883f0a5b785ad9b)]:
  - @mastra/core@0.17.1

## 0.17.1-alpha.0

### Patch Changes

- fix workflow resuming issue in the playground ([#7988](https://github.com/mastra-ai/mastra/pull/7988))

- Updated dependencies [[`fd00e63`](https://github.com/mastra-ai/mastra/commit/fd00e63759cbcca3473c40cac9843280b0557cff), [`ab610f6`](https://github.com/mastra-ai/mastra/commit/ab610f6f41dbfe6c9502368671485ca7a0aac09b), [`e6bda5f`](https://github.com/mastra-ai/mastra/commit/e6bda5f954ee8493ea18adc1a883f0a5b785ad9b)]:
  - @mastra/core@0.17.1-alpha.0

## 0.17.0

### Minor Changes

- Remove original AgentNetwork ([#7919](https://github.com/mastra-ai/mastra/pull/7919))

### Patch Changes

- Add helpful error message when trying to import from top-level import ([#7762](https://github.com/mastra-ai/mastra/pull/7762))

- Update peerdep of @mastra/core ([#7619](https://github.com/mastra-ai/mastra/pull/7619))

- Resumable streams ([#7949](https://github.com/mastra-ai/mastra/pull/7949))

- Voice errors that are instance of a MastraError should not throw a 500 ([#7749](https://github.com/mastra-ai/mastra/pull/7749))

- Update package.json and README ([#7886](https://github.com/mastra-ai/mastra/pull/7886))

- Updated dependencies [[`197cbb2`](https://github.com/mastra-ai/mastra/commit/197cbb248fc8cb4bbf61bf70b770f1388b445df2), [`a1bb887`](https://github.com/mastra-ai/mastra/commit/a1bb887e8bfae44230f487648da72e96ef824561), [`6590763`](https://github.com/mastra-ai/mastra/commit/65907630ef4bf4127067cecd1cb21b56f55d5f1b), [`fb84c21`](https://github.com/mastra-ai/mastra/commit/fb84c21859d09bdc8f158bd5412bdc4b5835a61c), [`5802bf5`](https://github.com/mastra-ai/mastra/commit/5802bf57f6182e4b67c28d7d91abed349a8d14f3), [`5bda53a`](https://github.com/mastra-ai/mastra/commit/5bda53a9747bfa7d876d754fc92c83a06e503f62), [`c2eade3`](https://github.com/mastra-ai/mastra/commit/c2eade3508ef309662f065e5f340d7840295dd53), [`f26a8fd`](https://github.com/mastra-ai/mastra/commit/f26a8fd99fcb0497a5d86c28324430d7f6a5fb83), [`222965a`](https://github.com/mastra-ai/mastra/commit/222965a98ce8197b86673ec594244650b5960257), [`6047778`](https://github.com/mastra-ai/mastra/commit/6047778e501df460648f31decddf8e443f36e373), [`a0f5f1c`](https://github.com/mastra-ai/mastra/commit/a0f5f1ca39c3c5c6d26202e9fcab986b4fe14568), [`9d4fc09`](https://github.com/mastra-ai/mastra/commit/9d4fc09b2ad55caa7738c7ceb3a905e454f74cdd), [`05c7abf`](https://github.com/mastra-ai/mastra/commit/05c7abfe105a015b7760c9bf33ff4419727502a0), [`0324ceb`](https://github.com/mastra-ai/mastra/commit/0324ceb8af9d16c12a531f90e575f6aab797ac81), [`d75ccf0`](https://github.com/mastra-ai/mastra/commit/d75ccf06dfd2582b916aa12624e3cd61b279edf1), [`0f9d227`](https://github.com/mastra-ai/mastra/commit/0f9d227890a98db33865abbea39daf407cd55ef7), [`b356f5f`](https://github.com/mastra-ai/mastra/commit/b356f5f7566cb3edb755d91f00b72fc1420b2a37), [`de056a0`](https://github.com/mastra-ai/mastra/commit/de056a02cbb43f6aa0380ab2150ea404af9ec0dd), [`f5ce05f`](https://github.com/mastra-ai/mastra/commit/f5ce05f831d42c69559bf4c0fdb46ccb920fc3a3), [`60c9cec`](https://github.com/mastra-ai/mastra/commit/60c9cec7048a79a87440f7840c383875bd710d93), [`c93532a`](https://github.com/mastra-ai/mastra/commit/c93532a340b80e4dd946d4c138d9381de5f70399), [`6cb1fcb`](https://github.com/mastra-ai/mastra/commit/6cb1fcbc8d0378ffed0d17784c96e68f30cb0272), [`aee4f00`](https://github.com/mastra-ai/mastra/commit/aee4f00e61e1a42e81a6d74ff149dbe69e32695a), [`9f6f30f`](https://github.com/mastra-ai/mastra/commit/9f6f30f04ec6648bbca798ea8aad59317c40d8db), [`547c621`](https://github.com/mastra-ai/mastra/commit/547c62104af3f7a551b3754e9cbdf0a3fbba15e4), [`897995e`](https://github.com/mastra-ai/mastra/commit/897995e630d572fe2891e7ede817938cabb43251), [`0fed8f2`](https://github.com/mastra-ai/mastra/commit/0fed8f2aa84b167b3415ea6f8f70755775132c8d), [`4f9ea8c`](https://github.com/mastra-ai/mastra/commit/4f9ea8c95ea74ba9abbf3b2ab6106c7d7bc45689), [`1a1fbe6`](https://github.com/mastra-ai/mastra/commit/1a1fbe66efb7d94abc373ed0dd9676adb8122454), [`d706fad`](https://github.com/mastra-ai/mastra/commit/d706fad6e6e4b72357b18d229ba38e6c913c0e70), [`87fd07f`](https://github.com/mastra-ai/mastra/commit/87fd07ff35387a38728967163460231b5d33ae3b), [`5c3768f`](https://github.com/mastra-ai/mastra/commit/5c3768fa959454232ad76715c381f4aac00c6881), [`2685a78`](https://github.com/mastra-ai/mastra/commit/2685a78f224b8b04e20d4fab5ac1adb638190071), [`36f39c0`](https://github.com/mastra-ai/mastra/commit/36f39c00dc794952dc3c11aab91c2fa8bca74b11), [`239b5a4`](https://github.com/mastra-ai/mastra/commit/239b5a497aeae2e8b4d764f46217cfff2284788e), [`8a3f5e4`](https://github.com/mastra-ai/mastra/commit/8a3f5e4212ec36b302957deb4bd47005ab598382)]:
  - @mastra/core@0.17.0

## 0.17.0-alpha.8

### Patch Changes

- Updated dependencies [[`05c7abf`](https://github.com/mastra-ai/mastra/commit/05c7abfe105a015b7760c9bf33ff4419727502a0), [`aee4f00`](https://github.com/mastra-ai/mastra/commit/aee4f00e61e1a42e81a6d74ff149dbe69e32695a)]:
  - @mastra/core@0.17.0-alpha.8

## 0.17.0-alpha.7

### Patch Changes

- Updated dependencies [[`4f9ea8c`](https://github.com/mastra-ai/mastra/commit/4f9ea8c95ea74ba9abbf3b2ab6106c7d7bc45689)]:
  - @mastra/core@0.17.0-alpha.7

## 0.17.0-alpha.6

### Minor Changes

- Remove original AgentNetwork ([#7919](https://github.com/mastra-ai/mastra/pull/7919))

### Patch Changes

- Resumable streams ([#7949](https://github.com/mastra-ai/mastra/pull/7949))

- Updated dependencies [[`197cbb2`](https://github.com/mastra-ai/mastra/commit/197cbb248fc8cb4bbf61bf70b770f1388b445df2), [`6590763`](https://github.com/mastra-ai/mastra/commit/65907630ef4bf4127067cecd1cb21b56f55d5f1b), [`c2eade3`](https://github.com/mastra-ai/mastra/commit/c2eade3508ef309662f065e5f340d7840295dd53), [`222965a`](https://github.com/mastra-ai/mastra/commit/222965a98ce8197b86673ec594244650b5960257), [`0324ceb`](https://github.com/mastra-ai/mastra/commit/0324ceb8af9d16c12a531f90e575f6aab797ac81), [`0f9d227`](https://github.com/mastra-ai/mastra/commit/0f9d227890a98db33865abbea39daf407cd55ef7), [`de056a0`](https://github.com/mastra-ai/mastra/commit/de056a02cbb43f6aa0380ab2150ea404af9ec0dd), [`c93532a`](https://github.com/mastra-ai/mastra/commit/c93532a340b80e4dd946d4c138d9381de5f70399), [`6cb1fcb`](https://github.com/mastra-ai/mastra/commit/6cb1fcbc8d0378ffed0d17784c96e68f30cb0272), [`2685a78`](https://github.com/mastra-ai/mastra/commit/2685a78f224b8b04e20d4fab5ac1adb638190071), [`239b5a4`](https://github.com/mastra-ai/mastra/commit/239b5a497aeae2e8b4d764f46217cfff2284788e)]:
  - @mastra/core@0.17.0-alpha.6

## 0.17.0-alpha.5

### Patch Changes

- Updated dependencies [[`6047778`](https://github.com/mastra-ai/mastra/commit/6047778e501df460648f31decddf8e443f36e373)]:
  - @mastra/core@0.17.0-alpha.5

## 0.17.0-alpha.4

### Patch Changes

- Update package.json and README ([#7886](https://github.com/mastra-ai/mastra/pull/7886))

- Updated dependencies [[`fb84c21`](https://github.com/mastra-ai/mastra/commit/fb84c21859d09bdc8f158bd5412bdc4b5835a61c), [`9d4fc09`](https://github.com/mastra-ai/mastra/commit/9d4fc09b2ad55caa7738c7ceb3a905e454f74cdd), [`d75ccf0`](https://github.com/mastra-ai/mastra/commit/d75ccf06dfd2582b916aa12624e3cd61b279edf1), [`0fed8f2`](https://github.com/mastra-ai/mastra/commit/0fed8f2aa84b167b3415ea6f8f70755775132c8d), [`87fd07f`](https://github.com/mastra-ai/mastra/commit/87fd07ff35387a38728967163460231b5d33ae3b)]:
  - @mastra/core@0.17.0-alpha.4

## 0.17.0-alpha.3

### Patch Changes

- Add helpful error message when trying to import from top-level import ([#7762](https://github.com/mastra-ai/mastra/pull/7762))

- Update peerdep of @mastra/core ([#7619](https://github.com/mastra-ai/mastra/pull/7619))

- Updated dependencies [[`a1bb887`](https://github.com/mastra-ai/mastra/commit/a1bb887e8bfae44230f487648da72e96ef824561), [`a0f5f1c`](https://github.com/mastra-ai/mastra/commit/a0f5f1ca39c3c5c6d26202e9fcab986b4fe14568), [`b356f5f`](https://github.com/mastra-ai/mastra/commit/b356f5f7566cb3edb755d91f00b72fc1420b2a37), [`f5ce05f`](https://github.com/mastra-ai/mastra/commit/f5ce05f831d42c69559bf4c0fdb46ccb920fc3a3), [`9f6f30f`](https://github.com/mastra-ai/mastra/commit/9f6f30f04ec6648bbca798ea8aad59317c40d8db), [`d706fad`](https://github.com/mastra-ai/mastra/commit/d706fad6e6e4b72357b18d229ba38e6c913c0e70), [`5c3768f`](https://github.com/mastra-ai/mastra/commit/5c3768fa959454232ad76715c381f4aac00c6881), [`8a3f5e4`](https://github.com/mastra-ai/mastra/commit/8a3f5e4212ec36b302957deb4bd47005ab598382)]:
  - @mastra/core@0.17.0-alpha.3

## 0.16.4-alpha.2

### Patch Changes

- Updated dependencies [[`60c9cec`](https://github.com/mastra-ai/mastra/commit/60c9cec7048a79a87440f7840c383875bd710d93), [`897995e`](https://github.com/mastra-ai/mastra/commit/897995e630d572fe2891e7ede817938cabb43251)]:
  - @mastra/core@0.16.4-alpha.2

## 0.16.4-alpha.1

### Patch Changes

- Updated dependencies [[`547c621`](https://github.com/mastra-ai/mastra/commit/547c62104af3f7a551b3754e9cbdf0a3fbba15e4)]:
  - @mastra/core@0.16.4-alpha.1

## 0.16.4-alpha.0

### Patch Changes

- Voice errors that are instance of a MastraError should not throw a 500 ([#7749](https://github.com/mastra-ai/mastra/pull/7749))

- Updated dependencies [[`5802bf5`](https://github.com/mastra-ai/mastra/commit/5802bf57f6182e4b67c28d7d91abed349a8d14f3), [`5bda53a`](https://github.com/mastra-ai/mastra/commit/5bda53a9747bfa7d876d754fc92c83a06e503f62), [`f26a8fd`](https://github.com/mastra-ai/mastra/commit/f26a8fd99fcb0497a5d86c28324430d7f6a5fb83), [`1a1fbe6`](https://github.com/mastra-ai/mastra/commit/1a1fbe66efb7d94abc373ed0dd9676adb8122454), [`36f39c0`](https://github.com/mastra-ai/mastra/commit/36f39c00dc794952dc3c11aab91c2fa8bca74b11)]:
  - @mastra/core@0.16.4-alpha.0

## 0.16.3

### Patch Changes

- Delayed deprecation notice for streamVNext() replacing stream() until Sept 23rd ([#7739](https://github.com/mastra-ai/mastra/pull/7739))

- an part 3 ([#7705](https://github.com/mastra-ai/mastra/pull/7705))

- Update peer deps ([#7741](https://github.com/mastra-ai/mastra/pull/7741))

- Client SDK Agents, Mastra server - support runtimeContext with GET requests ([#7734](https://github.com/mastra-ai/mastra/pull/7734))

- Updated dependencies [[`b4379f7`](https://github.com/mastra-ai/mastra/commit/b4379f703fd74474f253420e8c3a684f2c4b2f8e), [`2a6585f`](https://github.com/mastra-ai/mastra/commit/2a6585f7cb71f023f805d521d1c3c95fb9a3aa59), [`3d26e83`](https://github.com/mastra-ai/mastra/commit/3d26e8353a945719028f087cc6ac4b06f0ce27d2), [`dd9119b`](https://github.com/mastra-ai/mastra/commit/dd9119b175a8f389082f75c12750e51f96d65dca), [`d34aaa1`](https://github.com/mastra-ai/mastra/commit/d34aaa1da5d3c5f991740f59e2fe6d28d3e2dd91), [`56e55d1`](https://github.com/mastra-ai/mastra/commit/56e55d1e9eb63e7d9e41aa46e012aae471256812), [`ce1e580`](https://github.com/mastra-ai/mastra/commit/ce1e580f6391e94a0c6816a9c5db0a21566a262f), [`b2babfa`](https://github.com/mastra-ai/mastra/commit/b2babfa9e75b22f2759179e71d8473f6dc5421ed), [`d8c3ba5`](https://github.com/mastra-ai/mastra/commit/d8c3ba516f4173282d293f7e64769cfc8738d360), [`a566c4e`](https://github.com/mastra-ai/mastra/commit/a566c4e92d86c1671707c54359b1d33934f7cc13), [`af333aa`](https://github.com/mastra-ai/mastra/commit/af333aa30fe6d1b127024b03a64736c46eddeca2), [`3863c52`](https://github.com/mastra-ai/mastra/commit/3863c52d44b4e5779968b802d977e87adf939d8e), [`6424c7e`](https://github.com/mastra-ai/mastra/commit/6424c7ec38b6921d66212431db1e0958f441b2a7), [`db94750`](https://github.com/mastra-ai/mastra/commit/db94750a41fd29b43eb1f7ce8e97ba8b9978c91b), [`a66a371`](https://github.com/mastra-ai/mastra/commit/a66a3716b00553d7f01842be9deb34f720b10fab), [`69fc3cd`](https://github.com/mastra-ai/mastra/commit/69fc3cd0fd814901785bdcf49bf536ab1e7fd975)]:
  - @mastra/core@0.16.3

## 0.16.3-alpha.1

### Patch Changes

- Delayed deprecation notice for streamVNext() replacing stream() until Sept 23rd ([#7739](https://github.com/mastra-ai/mastra/pull/7739))

- Update peer deps ([#7741](https://github.com/mastra-ai/mastra/pull/7741))

- Client SDK Agents, Mastra server - support runtimeContext with GET requests ([#7734](https://github.com/mastra-ai/mastra/pull/7734))

- Updated dependencies [[`2a6585f`](https://github.com/mastra-ai/mastra/commit/2a6585f7cb71f023f805d521d1c3c95fb9a3aa59), [`3d26e83`](https://github.com/mastra-ai/mastra/commit/3d26e8353a945719028f087cc6ac4b06f0ce27d2), [`56e55d1`](https://github.com/mastra-ai/mastra/commit/56e55d1e9eb63e7d9e41aa46e012aae471256812)]:
  - @mastra/core@0.16.3-alpha.1

## 0.16.3-alpha.0

### Patch Changes

- an part 3 ([#7705](https://github.com/mastra-ai/mastra/pull/7705))

- Updated dependencies [[`b4379f7`](https://github.com/mastra-ai/mastra/commit/b4379f703fd74474f253420e8c3a684f2c4b2f8e), [`dd9119b`](https://github.com/mastra-ai/mastra/commit/dd9119b175a8f389082f75c12750e51f96d65dca), [`d34aaa1`](https://github.com/mastra-ai/mastra/commit/d34aaa1da5d3c5f991740f59e2fe6d28d3e2dd91), [`ce1e580`](https://github.com/mastra-ai/mastra/commit/ce1e580f6391e94a0c6816a9c5db0a21566a262f), [`b2babfa`](https://github.com/mastra-ai/mastra/commit/b2babfa9e75b22f2759179e71d8473f6dc5421ed), [`d8c3ba5`](https://github.com/mastra-ai/mastra/commit/d8c3ba516f4173282d293f7e64769cfc8738d360), [`a566c4e`](https://github.com/mastra-ai/mastra/commit/a566c4e92d86c1671707c54359b1d33934f7cc13), [`af333aa`](https://github.com/mastra-ai/mastra/commit/af333aa30fe6d1b127024b03a64736c46eddeca2), [`3863c52`](https://github.com/mastra-ai/mastra/commit/3863c52d44b4e5779968b802d977e87adf939d8e), [`6424c7e`](https://github.com/mastra-ai/mastra/commit/6424c7ec38b6921d66212431db1e0958f441b2a7), [`db94750`](https://github.com/mastra-ai/mastra/commit/db94750a41fd29b43eb1f7ce8e97ba8b9978c91b), [`a66a371`](https://github.com/mastra-ai/mastra/commit/a66a3716b00553d7f01842be9deb34f720b10fab), [`69fc3cd`](https://github.com/mastra-ai/mastra/commit/69fc3cd0fd814901785bdcf49bf536ab1e7fd975)]:
  - @mastra/core@0.16.3-alpha.0

## 0.16.2

### Patch Changes

- Updated dependencies [[`61926ef`](https://github.com/mastra-ai/mastra/commit/61926ef40d415b805a63527cffe27a50542e15e5)]:
  - @mastra/core@0.16.2

## 0.16.2-alpha.0

### Patch Changes

- Updated dependencies [[`61926ef`](https://github.com/mastra-ai/mastra/commit/61926ef40d415b805a63527cffe27a50542e15e5)]:
  - @mastra/core@0.16.2-alpha.0

## 0.16.1

### Patch Changes

- Flatten loop config in stream options and pass to loop options ([#7643](https://github.com/mastra-ai/mastra/pull/7643))

- Fix a bug where `typescript` was bundled into `dist` ([#7585](https://github.com/mastra-ai/mastra/pull/7585))

- Updated dependencies [[`47b6dc9`](https://github.com/mastra-ai/mastra/commit/47b6dc94f4976d4f3d3882e8f19eb365bbc5976c), [`827d876`](https://github.com/mastra-ai/mastra/commit/827d8766f36a900afcaf64a040f7ba76249009b3), [`0662d02`](https://github.com/mastra-ai/mastra/commit/0662d02ef16916e67531890639fcd72c69cfb6e2), [`565d65f`](https://github.com/mastra-ai/mastra/commit/565d65fc16314a99f081975ec92f2636dff0c86d), [`6189844`](https://github.com/mastra-ai/mastra/commit/61898448e65bda02bb814fb15801a89dc6476938), [`4da3d68`](https://github.com/mastra-ai/mastra/commit/4da3d68a778e5c4d5a17351ef223289fe2f45a45), [`fd9bbfe`](https://github.com/mastra-ai/mastra/commit/fd9bbfee22484f8493582325f53e8171bf8e682b), [`7eaf1d1`](https://github.com/mastra-ai/mastra/commit/7eaf1d1cec7e828d7a98efc2a748ac395bbdba3b), [`6f046b5`](https://github.com/mastra-ai/mastra/commit/6f046b5ccc5c8721302a9a61d5d16c12374cc8d7), [`d7a8f59`](https://github.com/mastra-ai/mastra/commit/d7a8f59154b0621aec4f41a6b2ea2b3882f03cb7), [`0b0bbb2`](https://github.com/mastra-ai/mastra/commit/0b0bbb24f4198ead69792e92b68a350f52b45cf3), [`d951f41`](https://github.com/mastra-ai/mastra/commit/d951f41771e4e5da8da4b9f870949f9509e38756), [`4dda259`](https://github.com/mastra-ai/mastra/commit/4dda2593b6343f9258671de5fb237aeba3ef6bb7), [`8049e2e`](https://github.com/mastra-ai/mastra/commit/8049e2e8cce80a00353c64894c62b695ac34e35e), [`f3427cd`](https://github.com/mastra-ai/mastra/commit/f3427cdaf9eecd63360dfc897a4acbf5f4143a4e), [`defed1c`](https://github.com/mastra-ai/mastra/commit/defed1ca8040cc8d42e645c5a50a1bc52a4918d7), [`6991ced`](https://github.com/mastra-ai/mastra/commit/6991cedcb5a44a49d9fe58ef67926e1f96ba55b1), [`9cb9c42`](https://github.com/mastra-ai/mastra/commit/9cb9c422854ee81074989dd2d8dccc0500ba8d3e), [`8334859`](https://github.com/mastra-ai/mastra/commit/83348594d4f37b311ba4a94d679c5f8721d796d4), [`05f13b8`](https://github.com/mastra-ai/mastra/commit/05f13b8fb269ccfc4de98e9db58dbe16eae55a5e)]:
  - @mastra/core@0.16.1

## 0.16.1-alpha.3

### Patch Changes

- Updated dependencies [[`fd9bbfe`](https://github.com/mastra-ai/mastra/commit/fd9bbfee22484f8493582325f53e8171bf8e682b)]:
  - @mastra/core@0.16.1-alpha.3

## 0.16.1-alpha.2

### Patch Changes

- Flatten loop config in stream options and pass to loop options ([#7643](https://github.com/mastra-ai/mastra/pull/7643))

- Fix a bug where `typescript` was bundled into `dist` ([#7585](https://github.com/mastra-ai/mastra/pull/7585))

- Updated dependencies [[`827d876`](https://github.com/mastra-ai/mastra/commit/827d8766f36a900afcaf64a040f7ba76249009b3), [`7eaf1d1`](https://github.com/mastra-ai/mastra/commit/7eaf1d1cec7e828d7a98efc2a748ac395bbdba3b), [`f3427cd`](https://github.com/mastra-ai/mastra/commit/f3427cdaf9eecd63360dfc897a4acbf5f4143a4e), [`05f13b8`](https://github.com/mastra-ai/mastra/commit/05f13b8fb269ccfc4de98e9db58dbe16eae55a5e)]:
  - @mastra/core@0.16.1-alpha.2

## 0.16.1-alpha.1

### Patch Changes

- Updated dependencies [[`47b6dc9`](https://github.com/mastra-ai/mastra/commit/47b6dc94f4976d4f3d3882e8f19eb365bbc5976c), [`565d65f`](https://github.com/mastra-ai/mastra/commit/565d65fc16314a99f081975ec92f2636dff0c86d), [`4da3d68`](https://github.com/mastra-ai/mastra/commit/4da3d68a778e5c4d5a17351ef223289fe2f45a45), [`0b0bbb2`](https://github.com/mastra-ai/mastra/commit/0b0bbb24f4198ead69792e92b68a350f52b45cf3), [`d951f41`](https://github.com/mastra-ai/mastra/commit/d951f41771e4e5da8da4b9f870949f9509e38756), [`8049e2e`](https://github.com/mastra-ai/mastra/commit/8049e2e8cce80a00353c64894c62b695ac34e35e)]:
  - @mastra/core@0.16.1-alpha.1

## 0.16.1-alpha.0

### Patch Changes

- Updated dependencies [[`0662d02`](https://github.com/mastra-ai/mastra/commit/0662d02ef16916e67531890639fcd72c69cfb6e2), [`6189844`](https://github.com/mastra-ai/mastra/commit/61898448e65bda02bb814fb15801a89dc6476938), [`d7a8f59`](https://github.com/mastra-ai/mastra/commit/d7a8f59154b0621aec4f41a6b2ea2b3882f03cb7), [`4dda259`](https://github.com/mastra-ai/mastra/commit/4dda2593b6343f9258671de5fb237aeba3ef6bb7), [`defed1c`](https://github.com/mastra-ai/mastra/commit/defed1ca8040cc8d42e645c5a50a1bc52a4918d7), [`6991ced`](https://github.com/mastra-ai/mastra/commit/6991cedcb5a44a49d9fe58ef67926e1f96ba55b1), [`9cb9c42`](https://github.com/mastra-ai/mastra/commit/9cb9c422854ee81074989dd2d8dccc0500ba8d3e), [`8334859`](https://github.com/mastra-ai/mastra/commit/83348594d4f37b311ba4a94d679c5f8721d796d4)]:
  - @mastra/core@0.16.1-alpha.0

## 0.16.0

### Minor Changes

- 376913a: Update peerdeps of @mastra/core

### Patch Changes

- cf4e353: Agent Builder Template - adding in UI components to use agent builder template actions
- 5397eb4: Add public URL support when adding files in Multi Modal
- 97eea1f: add body sanitization to agent handlers
- Updated dependencies [8fbf79e]
- Updated dependencies [fd83526]
- Updated dependencies [d0b90ab]
- Updated dependencies [6f5eb7a]
- Updated dependencies [a01cf14]
- Updated dependencies [a9e50ee]
- Updated dependencies [5397eb4]
- Updated dependencies [c9f4e4a]
- Updated dependencies [0acbc80]
  - @mastra/core@0.16.0

## 0.16.0-alpha.1

### Minor Changes

- 376913a: Update peerdeps of @mastra/core

### Patch Changes

- Updated dependencies [8fbf79e]
  - @mastra/core@0.16.0-alpha.1

## 0.16.0-alpha.0

### Patch Changes

- cf4e353: Agent Builder Template - adding in UI components to use agent builder template actions
- 5397eb4: Add public URL support when adding files in Multi Modal
- 97eea1f: add body sanitization to agent handlers
- Updated dependencies [fd83526]
- Updated dependencies [d0b90ab]
- Updated dependencies [6f5eb7a]
- Updated dependencies [a01cf14]
- Updated dependencies [a9e50ee]
- Updated dependencies [5397eb4]
- Updated dependencies [c9f4e4a]
- Updated dependencies [0acbc80]
  - @mastra/core@0.16.0-alpha.0

## 0.15.3

### Patch Changes

- ff89505: Add deprecation warnings and add legacy routes
- de3cbc6: Update the `package.json` file to include additional fields like `repository`, `homepage` or `files`.
- f0dfcac: updated core peerdep
- 48f0742: add deployer, server and clientjs handlers for agent builder template
- 12adcc8: add missing endpoint to get agent tool by ID
- bcec7db: Mastra server - Pipe abort signal correctly to agent stream,generate
- 5de1555: Fixed tracingContext on tool executions in AI tracing
- 03d0c39: temp disable agent-builder workflows import
- Updated dependencies [ab48c97]
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
- Updated dependencies [61debef]
- Updated dependencies [9beaeff]
- Updated dependencies [29de0e1]
- Updated dependencies [f643c65]
- Updated dependencies [00c74e7]
- Updated dependencies [fef7375]
- Updated dependencies [e3d8fea]
- Updated dependencies [45e4d39]
- Updated dependencies [9eee594]
- Updated dependencies [7149d8d]
- Updated dependencies [822c2e8]
- Updated dependencies [979912c]
- Updated dependencies [7dcf4c0]
- Updated dependencies [4106a58]
- Updated dependencies [ad78bfc]
- Updated dependencies [0302f50]
- Updated dependencies [6ac697e]
- Updated dependencies [74db265]
- Updated dependencies [0ce418a]
- Updated dependencies [af90672]
- Updated dependencies [8387952]
- Updated dependencies [7f3b8da]
- Updated dependencies [905352b]
- Updated dependencies [599d04c]
- Updated dependencies [56041d0]
- Updated dependencies [3412597]
- Updated dependencies [5eca5d2]
- Updated dependencies [f2cda47]
- Updated dependencies [5de1555]
- Updated dependencies [cfd377a]
- Updated dependencies [1ed5a3e]
  - @mastra/core@0.15.3

## 0.15.3-alpha.9

### Patch Changes

- Updated dependencies [[`599d04c`](https://github.com/mastra-ai/mastra/commit/599d04cebe92c1d536fee3190434941b8c91548e)]:
  - @mastra/core@0.15.3-alpha.9

## 0.15.3-alpha.8

### Patch Changes

- Updated dependencies [[`4474d04`](https://github.com/mastra-ai/mastra/commit/4474d0489b1e152e0985c33a4f529207317d27b5), [`4106a58`](https://github.com/mastra-ai/mastra/commit/4106a58b15b4c0a060a4a9ccab52d119d00d8edb)]:
  - @mastra/core@0.15.3-alpha.8

## 0.15.3-alpha.7

### Patch Changes

- [#7394](https://github.com/mastra-ai/mastra/pull/7394) [`f0dfcac`](https://github.com/mastra-ai/mastra/commit/f0dfcac4458bdf789b975e2d63e984f5d1e7c4d3) Thanks [@NikAiyer](https://github.com/NikAiyer)! - updated core peerdep

- Updated dependencies [[`7149d8d`](https://github.com/mastra-ai/mastra/commit/7149d8d4bdc1edf0008e0ca9b7925eb0b8b60dbe)]:
  - @mastra/core@0.15.3-alpha.7

## 0.15.3-alpha.6

### Patch Changes

- [#7388](https://github.com/mastra-ai/mastra/pull/7388) [`03d0c39`](https://github.com/mastra-ai/mastra/commit/03d0c3963a748294577dd232a53ee01e1e5bcc12) Thanks [@NikAiyer](https://github.com/NikAiyer)! - temp disable agent-builder workflows import

- Updated dependencies [[`c19bcf7`](https://github.com/mastra-ai/mastra/commit/c19bcf7b43542b02157b5e17303e519933a153ab), [`b42a961`](https://github.com/mastra-ai/mastra/commit/b42a961a5aefd19d6e938a7705fc0ecc90e8f756), [`45e4d39`](https://github.com/mastra-ai/mastra/commit/45e4d391a2a09fc70c48e4d60f505586ada1ba0e), [`0302f50`](https://github.com/mastra-ai/mastra/commit/0302f50861a53c66ff28801fc371b37c5f97e41e), [`74db265`](https://github.com/mastra-ai/mastra/commit/74db265b96aa01a72ffd91dcae0bc3b346cca0f2), [`7f3b8da`](https://github.com/mastra-ai/mastra/commit/7f3b8da6dd21c35d3672e44b4f5dd3502b8f8f92), [`905352b`](https://github.com/mastra-ai/mastra/commit/905352bcda134552400eb252bca1cb05a7975c14), [`f2cda47`](https://github.com/mastra-ai/mastra/commit/f2cda47ae911038c5d5489f54c36517d6f15bdcc), [`cfd377a`](https://github.com/mastra-ai/mastra/commit/cfd377a3a33a9c88b644f6540feed9cd9832db47)]:
  - @mastra/core@0.15.3-alpha.6

## 0.15.3-alpha.5

### Patch Changes

- [#7343](https://github.com/mastra-ai/mastra/pull/7343) [`de3cbc6`](https://github.com/mastra-ai/mastra/commit/de3cbc61079211431bd30487982ea3653517278e) Thanks [@LekoArts](https://github.com/LekoArts)! - Update the `package.json` file to include additional fields like `repository`, `homepage` or `files`.

- Updated dependencies [[`85ef90b`](https://github.com/mastra-ai/mastra/commit/85ef90bb2cd4ae4df855c7ac175f7d392c55c1bf), [`de3cbc6`](https://github.com/mastra-ai/mastra/commit/de3cbc61079211431bd30487982ea3653517278e)]:
  - @mastra/core@0.15.3-alpha.5

## 0.15.3-alpha.4

### Patch Changes

- [#7269](https://github.com/mastra-ai/mastra/pull/7269) [`ff89505`](https://github.com/mastra-ai/mastra/commit/ff895057c8c7e91a5535faef46c5e5391085ddfa) Thanks [@wardpeet](https://github.com/wardpeet)! - Add deprecation warnings and add legacy routes

- [#7136](https://github.com/mastra-ai/mastra/pull/7136) [`48f0742`](https://github.com/mastra-ai/mastra/commit/48f0742662414610dc9a7a99d45902d059ee123d) Thanks [@NikAiyer](https://github.com/NikAiyer)! - add deployer, server and clientjs handlers for agent builder template

- [#7250](https://github.com/mastra-ai/mastra/pull/7250) [`12adcc8`](https://github.com/mastra-ai/mastra/commit/12adcc8929db79b3cf7b83237ebaf6ba2db0181e) Thanks [@roaminro](https://github.com/roaminro)! - add missing endpoint to get agent tool by ID

- [#7259](https://github.com/mastra-ai/mastra/pull/7259) [`bcec7db`](https://github.com/mastra-ai/mastra/commit/bcec7db62dab25e4c85f1d484172061382c6615d) Thanks [@TheIsrael1](https://github.com/TheIsrael1)! - Mastra server - Pipe abort signal correctly to agent stream,generate

- Updated dependencies [[`ab48c97`](https://github.com/mastra-ai/mastra/commit/ab48c979098ea571faf998a55d3a00e7acd7a715), [`ff89505`](https://github.com/mastra-ai/mastra/commit/ff895057c8c7e91a5535faef46c5e5391085ddfa), [`183dc95`](https://github.com/mastra-ai/mastra/commit/183dc95596f391b977bd1a2c050b8498dac74891), [`a1111e2`](https://github.com/mastra-ai/mastra/commit/a1111e24e705488adfe5e0a6f20c53bddf26cb22), [`61debef`](https://github.com/mastra-ai/mastra/commit/61debefd80ad3a7ed5737e19df6a23d40091689a), [`9beaeff`](https://github.com/mastra-ai/mastra/commit/9beaeffa4a97b1d5fd01a7f8af8708b16067f67c), [`9eee594`](https://github.com/mastra-ai/mastra/commit/9eee594e35e0ca2a650fcc33fa82009a142b9ed0), [`979912c`](https://github.com/mastra-ai/mastra/commit/979912cfd180aad53287cda08af771df26454e2c), [`7dcf4c0`](https://github.com/mastra-ai/mastra/commit/7dcf4c04f44d9345b1f8bc5d41eae3f11ac61611), [`ad78bfc`](https://github.com/mastra-ai/mastra/commit/ad78bfc4ea6a1fff140432bf4f638e01af7af668), [`0ce418a`](https://github.com/mastra-ai/mastra/commit/0ce418a1ccaa5e125d4483a9651b635046152569), [`8387952`](https://github.com/mastra-ai/mastra/commit/838795227b4edf758c84a2adf6f7fba206c27719), [`5eca5d2`](https://github.com/mastra-ai/mastra/commit/5eca5d2655788863ea0442a46c9ef5d3c6dbe0a8)]:
  - @mastra/core@0.15.3-alpha.4

## 0.15.3-alpha.3

### Patch Changes

- Updated dependencies [[`aedbbfa`](https://github.com/mastra-ai/mastra/commit/aedbbfa064124ddde039111f12629daebfea7e48), [`f643c65`](https://github.com/mastra-ai/mastra/commit/f643c651bdaf57c2343cf9dbfc499010495701fb), [`fef7375`](https://github.com/mastra-ai/mastra/commit/fef737534574f41b432a7361a285f776c3bac42b), [`e3d8fea`](https://github.com/mastra-ai/mastra/commit/e3d8feaacfb8b5c5c03c13604cc06ea2873d45fe), [`3412597`](https://github.com/mastra-ai/mastra/commit/3412597a6644c0b6bf3236d6e319ed1450c5bae8)]:
  - @mastra/core@0.15.3-alpha.3

## 0.15.3-alpha.2

### Patch Changes

- Updated dependencies [[`822c2e8`](https://github.com/mastra-ai/mastra/commit/822c2e88a3ecbffb7c680e6227976006ccefe6a8)]:
  - @mastra/core@0.15.3-alpha.2

## 0.15.3-alpha.1

### Patch Changes

- Updated dependencies [[`637f323`](https://github.com/mastra-ai/mastra/commit/637f32371d79a8f78c52c0d53411af0915fcec67), [`29de0e1`](https://github.com/mastra-ai/mastra/commit/29de0e1b0a7173317ae7d1ab0c0993167c659f2b), [`6ac697e`](https://github.com/mastra-ai/mastra/commit/6ac697edcc2435482c247cba615277ec4765dcc4)]:
  - @mastra/core@0.15.3-alpha.1

## 0.15.3-alpha.0

### Patch Changes

- [#7109](https://github.com/mastra-ai/mastra/pull/7109) [`5de1555`](https://github.com/mastra-ai/mastra/commit/5de15554d3d6695211945a36928f6657e76cddc9) Thanks [@epinzur](https://github.com/epinzur)! - Fixed tracingContext on tool executions in AI tracing

- Updated dependencies [[`00c74e7`](https://github.com/mastra-ai/mastra/commit/00c74e73b1926be0d475693bb886fb67a22ff352), [`af90672`](https://github.com/mastra-ai/mastra/commit/af906722d8da28688882193b1e531026f9e2e81e), [`56041d0`](https://github.com/mastra-ai/mastra/commit/56041d018863a3da6b98c512e47348647c075fb3), [`5de1555`](https://github.com/mastra-ai/mastra/commit/5de15554d3d6695211945a36928f6657e76cddc9), [`1ed5a3e`](https://github.com/mastra-ai/mastra/commit/1ed5a3e19330374c4347a4237cd2f4b9ffb60376)]:
  - @mastra/core@0.15.3-alpha.0

## 0.15.2

### Patch Changes

- [`c6113ed`](https://github.com/mastra-ai/mastra/commit/c6113ed7f9df297e130d94436ceee310273d6430) Thanks [@wardpeet](https://github.com/wardpeet)! - Fix peerdpes for @mastra/core

- Updated dependencies []:
  - @mastra/core@0.15.2

## 0.15.1

### Patch Changes

- [`95b2aa9`](https://github.com/mastra-ai/mastra/commit/95b2aa908230919e67efcac0d69005a2d5745298) Thanks [@wardpeet](https://github.com/wardpeet)! - Fix peerdeps @mastra/core

- Updated dependencies []:
  - @mastra/core@0.15.1

## 0.15.0

### Minor Changes

- [#7028](https://github.com/mastra-ai/mastra/pull/7028) [`da58ccc`](https://github.com/mastra-ai/mastra/commit/da58ccc1f2ac33da0cb97b00443fc6208b45bdec) Thanks [@wardpeet](https://github.com/wardpeet)! - Bump core peerdependency

- [#7032](https://github.com/mastra-ai/mastra/pull/7032) [`1191ce9`](https://github.com/mastra-ai/mastra/commit/1191ce946b40ed291e7877a349f8388e3cff7e5c) Thanks [@wardpeet](https://github.com/wardpeet)! - Bump zod peerdep to 3.25.0 to support both v3/v4

### Patch Changes

- [#6995](https://github.com/mastra-ai/mastra/pull/6995) [`681252d`](https://github.com/mastra-ai/mastra/commit/681252d20e57fcee6821377dea96cacab3bc230f) Thanks [@wardpeet](https://github.com/wardpeet)! - Improve type resolving

- [#6967](https://github.com/mastra-ai/mastra/pull/6967) [`01be5d3`](https://github.com/mastra-ai/mastra/commit/01be5d358fad8faa101e5c69dfa54562c02cc0af) Thanks [@YujohnNattrass](https://github.com/YujohnNattrass)! - Implement AI traces for server apis and client sdk

- [#6933](https://github.com/mastra-ai/mastra/pull/6933) [`bf504a8`](https://github.com/mastra-ai/mastra/commit/bf504a833051f6f321d832cc7d631f3cb86d657b) Thanks [@NikAiyer](https://github.com/NikAiyer)! - Add util functions for workflow server handlers and made processor process function async

- [#6942](https://github.com/mastra-ai/mastra/pull/6942) [`ca8ec2f`](https://github.com/mastra-ai/mastra/commit/ca8ec2f61884b9dfec5fc0d5f4f29d281ad13c01) Thanks [@wardpeet](https://github.com/wardpeet)! - Add zod as peerdeps for all packages

- Updated dependencies [[`0778757`](https://github.com/mastra-ai/mastra/commit/07787570e4addbd501522037bd2542c3d9e26822), [`943a7f3`](https://github.com/mastra-ai/mastra/commit/943a7f3dbc6a8ab3f9b7bc7c8a1c5b319c3d7f56), [`bf504a8`](https://github.com/mastra-ai/mastra/commit/bf504a833051f6f321d832cc7d631f3cb86d657b), [`be49354`](https://github.com/mastra-ai/mastra/commit/be493546dca540101923ec700feb31f9a13939f2), [`d591ab3`](https://github.com/mastra-ai/mastra/commit/d591ab3ecc985c1870c0db347f8d7a20f7360536), [`ba82abe`](https://github.com/mastra-ai/mastra/commit/ba82abe76e869316bb5a9c95e8ea3946f3436fae), [`727f7e5`](https://github.com/mastra-ai/mastra/commit/727f7e5086e62e0dfe3356fb6dcd8bcb420af246), [`e6f5046`](https://github.com/mastra-ai/mastra/commit/e6f50467aff317e67e8bd74c485c3fbe2a5a6db1), [`82d9f64`](https://github.com/mastra-ai/mastra/commit/82d9f647fbe4f0177320e7c05073fce88599aa95), [`2e58325`](https://github.com/mastra-ai/mastra/commit/2e58325beb170f5b92f856e27d915cd26917e5e6), [`1191ce9`](https://github.com/mastra-ai/mastra/commit/1191ce946b40ed291e7877a349f8388e3cff7e5c), [`4189486`](https://github.com/mastra-ai/mastra/commit/4189486c6718fda78347bdf4ce4d3fc33b2236e1), [`ca8ec2f`](https://github.com/mastra-ai/mastra/commit/ca8ec2f61884b9dfec5fc0d5f4f29d281ad13c01), [`9613558`](https://github.com/mastra-ai/mastra/commit/9613558e6475f4710e05d1be7553a32ee7bddc20)]:
  - @mastra/core@0.15.0

## 0.15.0-alpha.4

### Minor Changes

- [#7032](https://github.com/mastra-ai/mastra/pull/7032) [`1191ce9`](https://github.com/mastra-ai/mastra/commit/1191ce946b40ed291e7877a349f8388e3cff7e5c) Thanks [@wardpeet](https://github.com/wardpeet)! - Bump zod peerdep to 3.25.0 to support both v3/v4

### Patch Changes

- Updated dependencies [[`1191ce9`](https://github.com/mastra-ai/mastra/commit/1191ce946b40ed291e7877a349f8388e3cff7e5c)]:
  - @mastra/core@0.15.0-alpha.4

## 0.15.0-alpha.3

### Minor Changes

- [#7028](https://github.com/mastra-ai/mastra/pull/7028) [`da58ccc`](https://github.com/mastra-ai/mastra/commit/da58ccc1f2ac33da0cb97b00443fc6208b45bdec) Thanks [@wardpeet](https://github.com/wardpeet)! - Bump core peerdependency

### Patch Changes

- Updated dependencies []:
  - @mastra/core@0.15.0-alpha.3

## 0.14.2-alpha.2

### Patch Changes

- Updated dependencies [[`2e58325`](https://github.com/mastra-ai/mastra/commit/2e58325beb170f5b92f856e27d915cd26917e5e6)]:
  - @mastra/core@0.14.2-alpha.2

## 0.14.2-alpha.1

### Patch Changes

- [#6995](https://github.com/mastra-ai/mastra/pull/6995) [`681252d`](https://github.com/mastra-ai/mastra/commit/681252d20e57fcee6821377dea96cacab3bc230f) Thanks [@wardpeet](https://github.com/wardpeet)! - Improve type resolving

- [#6967](https://github.com/mastra-ai/mastra/pull/6967) [`01be5d3`](https://github.com/mastra-ai/mastra/commit/01be5d358fad8faa101e5c69dfa54562c02cc0af) Thanks [@YujohnNattrass](https://github.com/YujohnNattrass)! - Implement AI traces for server apis and client sdk

- [#6942](https://github.com/mastra-ai/mastra/pull/6942) [`ca8ec2f`](https://github.com/mastra-ai/mastra/commit/ca8ec2f61884b9dfec5fc0d5f4f29d281ad13c01) Thanks [@wardpeet](https://github.com/wardpeet)! - Add zod as peerdeps for all packages

- Updated dependencies [[`943a7f3`](https://github.com/mastra-ai/mastra/commit/943a7f3dbc6a8ab3f9b7bc7c8a1c5b319c3d7f56), [`be49354`](https://github.com/mastra-ai/mastra/commit/be493546dca540101923ec700feb31f9a13939f2), [`d591ab3`](https://github.com/mastra-ai/mastra/commit/d591ab3ecc985c1870c0db347f8d7a20f7360536), [`ba82abe`](https://github.com/mastra-ai/mastra/commit/ba82abe76e869316bb5a9c95e8ea3946f3436fae), [`727f7e5`](https://github.com/mastra-ai/mastra/commit/727f7e5086e62e0dfe3356fb6dcd8bcb420af246), [`82d9f64`](https://github.com/mastra-ai/mastra/commit/82d9f647fbe4f0177320e7c05073fce88599aa95), [`4189486`](https://github.com/mastra-ai/mastra/commit/4189486c6718fda78347bdf4ce4d3fc33b2236e1), [`ca8ec2f`](https://github.com/mastra-ai/mastra/commit/ca8ec2f61884b9dfec5fc0d5f4f29d281ad13c01)]:
  - @mastra/core@0.14.2-alpha.1

## 0.14.2-alpha.0

### Patch Changes

- [#6933](https://github.com/mastra-ai/mastra/pull/6933) [`bf504a8`](https://github.com/mastra-ai/mastra/commit/bf504a833051f6f321d832cc7d631f3cb86d657b) Thanks [@NikAiyer](https://github.com/NikAiyer)! - Add util functions for workflow server handlers and made processor process function async

- Updated dependencies [[`0778757`](https://github.com/mastra-ai/mastra/commit/07787570e4addbd501522037bd2542c3d9e26822), [`bf504a8`](https://github.com/mastra-ai/mastra/commit/bf504a833051f6f321d832cc7d631f3cb86d657b), [`e6f5046`](https://github.com/mastra-ai/mastra/commit/e6f50467aff317e67e8bd74c485c3fbe2a5a6db1), [`9613558`](https://github.com/mastra-ai/mastra/commit/9613558e6475f4710e05d1be7553a32ee7bddc20)]:
  - @mastra/core@0.14.2-alpha.0

## 0.14.1

### Patch Changes

- Updated dependencies [[`6e7e120`](https://github.com/mastra-ai/mastra/commit/6e7e1207d6e8d8b838f9024f90bd10df1181ba27), [`0f00e17`](https://github.com/mastra-ai/mastra/commit/0f00e172953ccdccadb35ed3d70f5e4d89115869), [`217cd7a`](https://github.com/mastra-ai/mastra/commit/217cd7a4ce171e9a575c41bb8c83300f4db03236), [`a5a23d9`](https://github.com/mastra-ai/mastra/commit/a5a23d981920d458dc6078919992a5338931ef02)]:
  - @mastra/core@0.14.1

## 0.14.1-alpha.1

### Patch Changes

- Updated dependencies [[`0f00e17`](https://github.com/mastra-ai/mastra/commit/0f00e172953ccdccadb35ed3d70f5e4d89115869), [`217cd7a`](https://github.com/mastra-ai/mastra/commit/217cd7a4ce171e9a575c41bb8c83300f4db03236)]:
  - @mastra/core@0.14.1-alpha.1

## 0.14.1-alpha.0

### Patch Changes

- Updated dependencies [[`6e7e120`](https://github.com/mastra-ai/mastra/commit/6e7e1207d6e8d8b838f9024f90bd10df1181ba27), [`a5a23d9`](https://github.com/mastra-ai/mastra/commit/a5a23d981920d458dc6078919992a5338931ef02)]:
  - @mastra/core@0.14.1-alpha.0

## 0.14.0

### Minor Changes

- 03997ae: Update peer deps of core

### Patch Changes

- 6313063: Implement model switcher in playground
- a89de7e: Adding a new agentic loop and streaming workflow system while working towards AI SDK v5 support.
- a9916bd: Model switcher v5 support
- 57f7019: Add modelVersion to agent response
- 4908422: Fix agent scorers page by correctly passing in agent name
- Updated dependencies [227c7e6]
- Updated dependencies [12cae67]
- Updated dependencies [fd3a3eb]
- Updated dependencies [6faaee5]
- Updated dependencies [4232b14]
- Updated dependencies [a89de7e]
- Updated dependencies [5a37d0c]
- Updated dependencies [4bde0cb]
- Updated dependencies [cf4f357]
- Updated dependencies [ad888a2]
- Updated dependencies [481751d]
- Updated dependencies [2454423]
- Updated dependencies [194e395]
- Updated dependencies [a722c0b]
- Updated dependencies [c30bca8]
- Updated dependencies [3b5fec7]
- Updated dependencies [a8f129d]
  - @mastra/core@0.14.0

## 0.14.0-alpha.7

### Minor Changes

- 03997ae: Update peer deps of core

### Patch Changes

- @mastra/core@0.14.0-alpha.7

## 0.14.0-alpha.6

### Patch Changes

- a9916bd: Model switcher v5 support
- Updated dependencies [ad888a2]
- Updated dependencies [481751d]
- Updated dependencies [194e395]
  - @mastra/core@0.14.0-alpha.6

## 0.14.0-alpha.5

### Patch Changes

- 4908422: Fix agent scorers page by correctly passing in agent name
  - @mastra/core@0.14.0-alpha.5

## 0.14.0-alpha.4

### Patch Changes

- bc1684a: Fix lint
- dfb91e9: Server handlers
- 57f7019: Add modelVersion to agent response
- Updated dependencies [0a7f675]
- Updated dependencies [12cae67]
- Updated dependencies [5a37d0c]
- Updated dependencies [4bde0cb]
- Updated dependencies [1a80071]
- Updated dependencies [36a3be8]
- Updated dependencies [361757b]
- Updated dependencies [2bb9955]
- Updated dependencies [2454423]
- Updated dependencies [a44d91e]
- Updated dependencies [dfb91e9]
- Updated dependencies [a741dde]
- Updated dependencies [7cb3fc0]
- Updated dependencies [195eabb]
- Updated dependencies [b78b95b]
  - @mastra/core@0.14.0-alpha.4

## 0.14.0-alpha.3

### Patch Changes

- Updated dependencies [227c7e6]
- Updated dependencies [fd3a3eb]
- Updated dependencies [a8f129d]
  - @mastra/core@0.14.0-alpha.3

## 0.14.0-alpha.2

### Patch Changes

- @mastra/core@0.14.0-alpha.2

## 0.14.0-alpha.1

### Patch Changes

- 6313063: Implement model switcher in playground
- a89de7e: Adding a new agentic loop and streaming workflow system while working towards AI SDK v5 support.
- Updated dependencies [6faaee5]
- Updated dependencies [4232b14]
- Updated dependencies [a89de7e]
- Updated dependencies [cf4f357]
- Updated dependencies [a722c0b]
- Updated dependencies [3b5fec7]
  - @mastra/core@0.14.0-alpha.1

## 0.13.3-alpha.0

### Patch Changes

- Updated dependencies [c30bca8]
  - @mastra/core@0.13.3-alpha.0

## 0.13.2

### Patch Changes

- a239d41: Updated A2A syntax to v0.3.0
- f6a1ae7: Return correct `agentIds` for `/api/scores/scorers` and `/api/scores/scorers/${scorerId}` endpoints
- ce04175: Add update agent model handler
- Updated dependencies [d5330bf]
- Updated dependencies [2e74797]
- Updated dependencies [8388649]
- Updated dependencies [a239d41]
- Updated dependencies [dd94a26]
- Updated dependencies [3ba6772]
- Updated dependencies [b5cf2a3]
- Updated dependencies [2fff911]
- Updated dependencies [b32c50d]
- Updated dependencies [63449d0]
- Updated dependencies [121a3f8]
- Updated dependencies [ec510e7]
  - @mastra/core@0.13.2

## 0.13.2-alpha.3

### Patch Changes

- Updated dependencies [b5cf2a3]
  - @mastra/core@0.13.2-alpha.3

## 0.13.2-alpha.2

### Patch Changes

- a239d41: Updated A2A syntax to v0.3.0
- f6a1ae7: Return correct `agentIds` for `/api/scores/scorers` and `/api/scores/scorers/${scorerId}` endpoints
- ce04175: Add update agent model handler
- Updated dependencies [d5330bf]
- Updated dependencies [a239d41]
- Updated dependencies [b32c50d]
- Updated dependencies [121a3f8]
- Updated dependencies [ec510e7]
  - @mastra/core@0.13.2-alpha.2

## 0.13.2-alpha.1

### Patch Changes

- Updated dependencies [2e74797]
- Updated dependencies [63449d0]
  - @mastra/core@0.13.2-alpha.1

## 0.13.2-alpha.0

### Patch Changes

- Updated dependencies [8388649]
- Updated dependencies [dd94a26]
- Updated dependencies [3ba6772]
- Updated dependencies [2fff911]
  - @mastra/core@0.13.2-alpha.0

## 0.13.1

### Patch Changes

- Updated dependencies [cd0042e]
  - @mastra/core@0.13.1

## 0.13.1-alpha.0

### Patch Changes

- Updated dependencies [cd0042e]
  - @mastra/core@0.13.1-alpha.0

## 0.13.0

### Patch Changes

- e202b82: Add getThreadsByResourceIdPaginated to the Memory Class
- 4a406ec: fixes TypeScript declaration file imports to ensure proper ESM compatibility
- Updated dependencies [cb36de0]
- Updated dependencies [d0496e6]
- Updated dependencies [a82b851]
- Updated dependencies [ea0c5f2]
- Updated dependencies [41a0a0e]
- Updated dependencies [2871020]
- Updated dependencies [94f4812]
- Updated dependencies [e202b82]
- Updated dependencies [e00f6a0]
- Updated dependencies [4a406ec]
- Updated dependencies [b0e43c1]
- Updated dependencies [5d377e5]
- Updated dependencies [1fb812e]
- Updated dependencies [35c5798]
  - @mastra/core@0.13.0

## 0.13.0-alpha.3

### Patch Changes

- Updated dependencies [d0496e6]
  - @mastra/core@0.13.0-alpha.3

## 0.13.0-alpha.2

### Patch Changes

- 4a406ec: fixes TypeScript declaration file imports to ensure proper ESM compatibility
- Updated dependencies [cb36de0]
- Updated dependencies [a82b851]
- Updated dependencies [41a0a0e]
- Updated dependencies [2871020]
- Updated dependencies [4a406ec]
- Updated dependencies [5d377e5]
  - @mastra/core@0.13.0-alpha.2

## 0.13.0-alpha.1

### Patch Changes

- Updated dependencies [ea0c5f2]
- Updated dependencies [b0e43c1]
- Updated dependencies [1fb812e]
- Updated dependencies [35c5798]
  - @mastra/core@0.13.0-alpha.1

## 0.12.2-alpha.0

### Patch Changes

- e202b82: Add getThreadsByResourceIdPaginated to the Memory Class
- Updated dependencies [94f4812]
- Updated dependencies [e202b82]
- Updated dependencies [e00f6a0]
  - @mastra/core@0.12.2-alpha.0

## 0.12.1

### Patch Changes

- Updated dependencies [33dcb07]
- Updated dependencies [d0d9500]
- Updated dependencies [d30b1a0]
- Updated dependencies [bff87f7]
- Updated dependencies [b4a8df0]
  - @mastra/core@0.12.1

## 0.12.1-alpha.1

### Patch Changes

- Updated dependencies [d0d9500]
  - @mastra/core@0.12.1-alpha.1

## 0.12.1-alpha.0

### Patch Changes

- Updated dependencies [33dcb07]
- Updated dependencies [d30b1a0]
- Updated dependencies [bff87f7]
- Updated dependencies [b4a8df0]
  - @mastra/core@0.12.1-alpha.0

## 0.12.0

### Minor Changes

- f42c4c2: update peer deps for packages to latest core range

### Patch Changes

- ff9c125: enhance thread retrieval with sorting options in libsql and pg
- 9802f42: Added types and tests to ensure client-js and hono endpoints can save memory messages where the input is either a v1 or v2 mastra message
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

- Updated dependencies [510e2c8]
- Updated dependencies [2f72fb2]
- Updated dependencies [27cc97a]
- Updated dependencies [3f89307]
- Updated dependencies [9eda7d4]
- Updated dependencies [9d49408]
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
- Updated dependencies [b8efbb9]
- Updated dependencies [71466e7]
- Updated dependencies [0c99fbe]
  - @mastra/core@0.12.0

## 0.12.0-alpha.5

### Minor Changes

- f42c4c2: update peer deps for packages to latest core range

### Patch Changes

- @mastra/core@0.12.0-alpha.5

## 0.12.0-alpha.4

### Patch Changes

- Updated dependencies [ad0a58b]
  - @mastra/core@0.12.0-alpha.4

## 0.12.0-alpha.3

### Patch Changes

- 9802f42: Added types and tests to ensure client-js and hono endpoints can save memory messages where the input is either a v1 or v2 mastra message
  - @mastra/core@0.12.0-alpha.3

## 0.12.0-alpha.2

### Patch Changes

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

- Updated dependencies [27cc97a]
- Updated dependencies [41daa63]
- Updated dependencies [254a36b]
- Updated dependencies [0b89602]
- Updated dependencies [4d37822]
- Updated dependencies [ff9c125]
- Updated dependencies [b8efbb9]
- Updated dependencies [71466e7]
- Updated dependencies [0c99fbe]
  - @mastra/core@0.12.0-alpha.2

## 0.12.0-alpha.1

### Patch Changes

- Updated dependencies [e0f73c6]
- Updated dependencies [cda801d]
- Updated dependencies [a77c823]
  - @mastra/core@0.12.0-alpha.1

## 0.12.0-alpha.0

### Patch Changes

- Updated dependencies [510e2c8]
- Updated dependencies [2f72fb2]
- Updated dependencies [3f89307]
- Updated dependencies [9eda7d4]
- Updated dependencies [9d49408]
- Updated dependencies [2ecf658]
- Updated dependencies [7a7754f]
- Updated dependencies [fc92d80]
- Updated dependencies [23a6a7c]
- Updated dependencies [09bca64]
  - @mastra/core@0.12.0-alpha.0

## 0.11.1

### Patch Changes

- 417fd92: Revert breaking chnage
- ce088f5: Update all peerdeps to latest core
  - @mastra/core@0.11.1

## 0.11.0

### Patch Changes

- f248d53: Adding `getMessagesPaginated` to the serve, deployer, and client-js
- 35b1155: Added "Semantic recall search" to playground UI chat sidebar, to search for messages and find them in the chat list
- 65e3395: Add Scores playground-ui and add scorer hooks
- bea9dd1: Refactor Agent class to consolidate LLM generate and stream methods and improve type safety. This includes
  extracting common logic into prepareLLMOptions(), enhancing type definitions, and fixing test annotations.

  This changeset entry follows the established format in your project:
  - Targets the @mastra/core package with a patch version bump
  - Provides a concise description of the refactoring and type safety improvements
  - Mentions the key changes without being too verbose

- 62007b3: Fix upserting memory messages via hono endpoints
- dcd4802: scores mastra server
- Updated dependencies [f248d53]
- Updated dependencies [2affc57]
- Updated dependencies [66e13e3]
- Updated dependencies [edd9482]
- Updated dependencies [18344d7]
- Updated dependencies [9d372c2]
- Updated dependencies [40c2525]
- Updated dependencies [e473f27]
- Updated dependencies [032cb66]
- Updated dependencies [703ac71]
- Updated dependencies [a723d69]
- Updated dependencies [7827943]
- Updated dependencies [5889a31]
- Updated dependencies [bf1e7e7]
- Updated dependencies [65e3395]
- Updated dependencies [4933192]
- Updated dependencies [d1c77a4]
- Updated dependencies [bea9dd1]
- Updated dependencies [dcd4802]
- Updated dependencies [cbddd18]
- Updated dependencies [7ba91fa]
  - @mastra/core@0.11.0

## 0.11.0-alpha.3

### Patch Changes

- 62007b3: Fix upserting memory messages via hono endpoints
  - @mastra/core@0.11.0-alpha.3

## 0.11.0-alpha.2

### Patch Changes

- f248d53: Adding `getMessagesPaginated` to the serve, deployer, and client-js
- 35b1155: Added "Semantic recall search" to playground UI chat sidebar, to search for messages and find them in the chat list
- 65e3395: Add Scores playground-ui and add scorer hooks
- bea9dd1: Refactor Agent class to consolidate LLM generate and stream methods and improve type safety. This includes
  extracting common logic into prepareLLMOptions(), enhancing type definitions, and fixing test annotations.

  This changeset entry follows the established format in your project:
  - Targets the @mastra/core package with a patch version bump
  - Provides a concise description of the refactoring and type safety improvements
  - Mentions the key changes without being too verbose

- dcd4802: scores mastra server
- Updated dependencies [f248d53]
- Updated dependencies [2affc57]
- Updated dependencies [66e13e3]
- Updated dependencies [edd9482]
- Updated dependencies [18344d7]
- Updated dependencies [9d372c2]
- Updated dependencies [40c2525]
- Updated dependencies [e473f27]
- Updated dependencies [032cb66]
- Updated dependencies [703ac71]
- Updated dependencies [a723d69]
- Updated dependencies [5889a31]
- Updated dependencies [65e3395]
- Updated dependencies [4933192]
- Updated dependencies [d1c77a4]
- Updated dependencies [bea9dd1]
- Updated dependencies [dcd4802]
- Updated dependencies [7ba91fa]
  - @mastra/core@0.11.0-alpha.2

## 0.11.0-alpha.1

### Patch Changes

- @mastra/core@0.11.0-alpha.1

## 0.11.0-alpha.0

### Patch Changes

- Updated dependencies [7827943]
- Updated dependencies [bf1e7e7]
- Updated dependencies [cbddd18]
  - @mastra/core@0.11.0-alpha.0

## 0.10.15

### Patch Changes

- 626b0f4: [Cloud-126] Working Memory Playground - Added working memory to playground to allow users to view/edit working memory
- Updated dependencies [0b56518]
- Updated dependencies [db5cc15]
- Updated dependencies [2ba5b76]
- Updated dependencies [5237998]
- Updated dependencies [c3a30de]
- Updated dependencies [37c1acd]
- Updated dependencies [1aa60b1]
- Updated dependencies [89ec9d4]
- Updated dependencies [cf3a184]
- Updated dependencies [d6bfd60]
- Updated dependencies [626b0f4]
- Updated dependencies [c22a91f]
- Updated dependencies [f7403ab]
- Updated dependencies [6c89d7f]
  - @mastra/core@0.10.15

## 0.10.15-alpha.1

### Patch Changes

- Updated dependencies [0b56518]
- Updated dependencies [2ba5b76]
- Updated dependencies [c3a30de]
- Updated dependencies [cf3a184]
- Updated dependencies [d6bfd60]
  - @mastra/core@0.10.15-alpha.1

## 0.10.15-alpha.0

### Patch Changes

- 626b0f4: [Cloud-126] Working Memory Playground - Added working memory to playground to allow users to view/edit working memory
- Updated dependencies [db5cc15]
- Updated dependencies [5237998]
- Updated dependencies [37c1acd]
- Updated dependencies [1aa60b1]
- Updated dependencies [89ec9d4]
- Updated dependencies [626b0f4]
- Updated dependencies [c22a91f]
- Updated dependencies [f7403ab]
- Updated dependencies [6c89d7f]
  - @mastra/core@0.10.15-alpha.0

## 0.10.14

### Patch Changes

- @mastra/core@0.10.14

## 0.10.12

### Patch Changes

- Updated dependencies [b4a9811]
- Updated dependencies [4d5583d]
  - @mastra/core@0.10.12

## 0.10.12-alpha.1

### Patch Changes

- Updated dependencies [4d5583d]
  - @mastra/core@0.10.12-alpha.1

## 0.10.12-alpha.0

### Patch Changes

- Updated dependencies [b4a9811]
  - @mastra/core@0.10.12-alpha.0

## 0.10.11

### Patch Changes

- Updated dependencies [2873c7f]
- Updated dependencies [1c1c6a1]
- Updated dependencies [f8ce2cc]
- Updated dependencies [8c846b6]
- Updated dependencies [c7bbf1e]
- Updated dependencies [8722d53]
- Updated dependencies [565cc0c]
- Updated dependencies [b790fd1]
- Updated dependencies [132027f]
- Updated dependencies [0c85311]
- Updated dependencies [d7ed04d]
- Updated dependencies [cb16baf]
- Updated dependencies [f36e4f1]
- Updated dependencies [7f6e403]
  - @mastra/core@0.10.11

## 0.10.11-alpha.4

### Patch Changes

- @mastra/core@0.10.11-alpha.4

## 0.10.11-alpha.3

### Patch Changes

- Updated dependencies [c7bbf1e]
- Updated dependencies [8722d53]
- Updated dependencies [132027f]
- Updated dependencies [0c85311]
- Updated dependencies [cb16baf]
  - @mastra/core@0.10.11-alpha.3

## 0.10.11-alpha.2

### Patch Changes

- Updated dependencies [2873c7f]
- Updated dependencies [1c1c6a1]
- Updated dependencies [565cc0c]
  - @mastra/core@0.10.11-alpha.2

## 0.10.11-alpha.1

### Patch Changes

- Updated dependencies [7f6e403]
  - @mastra/core@0.10.11-alpha.1

## 0.10.11-alpha.0

### Patch Changes

- Updated dependencies [f8ce2cc]
- Updated dependencies [8c846b6]
- Updated dependencies [b790fd1]
- Updated dependencies [d7ed04d]
- Updated dependencies [f36e4f1]
  - @mastra/core@0.10.11-alpha.0

## 0.10.10

### Patch Changes

- 6e13b80: Add error cause and stack trace to mastra server error handler
- 6997af1: add send event to server, deployer, client-js and playground-ui
- Updated dependencies [4d3fbdf]
  - @mastra/core@0.10.10

## 0.10.10-alpha.1

### Patch Changes

- 6997af1: add send event to server, deployer, client-js and playground-ui
  - @mastra/core@0.10.10-alpha.1

## 0.10.10-alpha.0

### Patch Changes

- 6e13b80: Add error cause and stack trace to mastra server error handler
- Updated dependencies [4d3fbdf]
  - @mastra/core@0.10.10-alpha.0

## 0.10.9

### Patch Changes

- a606c75: show right suspend schema for nested workflow on playground
- 038e5ae: Add cancel workflow run
- 81a1b3b: Update peerdeps
- 7e801dd: Add tools to network api response
- Updated dependencies [9dda1ac]
- Updated dependencies [c984582]
- Updated dependencies [7e801dd]
- Updated dependencies [a606c75]
- Updated dependencies [7aa70a4]
- Updated dependencies [764f86a]
- Updated dependencies [1760a1c]
- Updated dependencies [038e5ae]
- Updated dependencies [7dda16a]
- Updated dependencies [5ebfcdd]
- Updated dependencies [b2d0c91]
- Updated dependencies [4e809ad]
- Updated dependencies [57929df]
- Updated dependencies [b7852ed]
- Updated dependencies [6320a61]
  - @mastra/core@0.10.9

## 0.10.9-alpha.0

### Patch Changes

- a606c75: show right suspend schema for nested workflow on playground
- 038e5ae: Add cancel workflow run
- 81a1b3b: Update peerdeps
- 7e801dd: Add tools to network api response
- Updated dependencies [9dda1ac]
- Updated dependencies [c984582]
- Updated dependencies [7e801dd]
- Updated dependencies [a606c75]
- Updated dependencies [7aa70a4]
- Updated dependencies [764f86a]
- Updated dependencies [1760a1c]
- Updated dependencies [038e5ae]
- Updated dependencies [7dda16a]
- Updated dependencies [5ebfcdd]
- Updated dependencies [b2d0c91]
- Updated dependencies [4e809ad]
- Updated dependencies [57929df]
- Updated dependencies [b7852ed]
- Updated dependencies [6320a61]
  - @mastra/core@0.10.9-alpha.0

## 0.10.8

### Patch Changes

- a344ac7: Fix tool streaming in agent network
- Updated dependencies [b8f16b2]
- Updated dependencies [3e04487]
- Updated dependencies [a344ac7]
- Updated dependencies [dc4ca0a]
  - @mastra/core@0.10.8

## 0.10.8-alpha.1

### Patch Changes

- Updated dependencies [b8f16b2]
- Updated dependencies [3e04487]
- Updated dependencies [dc4ca0a]
  - @mastra/core@0.10.8-alpha.1

## 0.10.8-alpha.0

### Patch Changes

- a344ac7: Fix tool streaming in agent network
- Updated dependencies [a344ac7]
  - @mastra/core@0.10.8-alpha.0

## 0.10.7

### Patch Changes

- 9bf1d55: Fix runtimeContext in mastra server, client SDK
- 5d74aab: vNext network in playground
- 502fe05: createRun() -> createRunAsync()
- 4afab04: fix: getAgentsHandler return type
- 10a4f10: Cancel agent generate/stream when request aborts
- Updated dependencies [15e9d26]
- Updated dependencies [d1baedb]
- Updated dependencies [d8f2d19]
- Updated dependencies [4d21bf2]
- Updated dependencies [07d6d88]
- Updated dependencies [9d52b17]
- Updated dependencies [2097952]
- Updated dependencies [792c4c0]
- Updated dependencies [5d74aab]
- Updated dependencies [a8b194f]
- Updated dependencies [4fb0cc2]
- Updated dependencies [d2a7a31]
- Updated dependencies [502fe05]
- Updated dependencies [144eb0b]
- Updated dependencies [8ba1b51]
- Updated dependencies [4efcfa0]
- Updated dependencies [0e17048]
  - @mastra/core@0.10.7

## 0.10.7-alpha.5

### Patch Changes

- @mastra/core@0.10.7-alpha.5

## 0.10.7-alpha.4

### Patch Changes

- Updated dependencies [a8b194f]
  - @mastra/core@0.10.7-alpha.4

## 0.10.7-alpha.3

### Patch Changes

- 502fe05: createRun() -> createRunAsync()
- 4afab04: fix: getAgentsHandler return type
- 10a4f10: Cancel agent generate/stream when request aborts
- Updated dependencies [792c4c0]
- Updated dependencies [502fe05]
- Updated dependencies [4efcfa0]
  - @mastra/core@0.10.7-alpha.3

## 0.10.7-alpha.2

### Patch Changes

- 9bf1d55: Fix runtimeContext in mastra server, client SDK
- 5d74aab: vNext network in playground
- Updated dependencies [15e9d26]
- Updated dependencies [07d6d88]
- Updated dependencies [5d74aab]
- Updated dependencies [144eb0b]
  - @mastra/core@0.10.7-alpha.2

## 0.10.7-alpha.1

### Patch Changes

- Updated dependencies [d1baedb]
- Updated dependencies [4d21bf2]
- Updated dependencies [2097952]
- Updated dependencies [4fb0cc2]
- Updated dependencies [d2a7a31]
- Updated dependencies [0e17048]
  - @mastra/core@0.10.7-alpha.1

## 0.10.7-alpha.0

### Patch Changes

- Updated dependencies [d8f2d19]
- Updated dependencies [9d52b17]
- Updated dependencies [8ba1b51]
  - @mastra/core@0.10.7-alpha.0

## 0.10.6

### Patch Changes

- 5f67b6f: Transfer-Encoding chunked header for agent stream hono route
- 8e6f677: Dynamic default llm options
- ee9af57: Add api for polling run execution result and get run by id
- 2002c59: fix(voice): compatibility with dynamic agent instructions
- 3270d9d: Fix runtime context being undefined
- 53d3c37: Get workflows from an agent if not found from Mastra instance #5083
- Updated dependencies [63f6b7d]
- Updated dependencies [12a95fc]
- Updated dependencies [4b0f8a6]
- Updated dependencies [51264a5]
- Updated dependencies [8e6f677]
- Updated dependencies [d70c420]
- Updated dependencies [ee9af57]
- Updated dependencies [36f1c36]
- Updated dependencies [2a16996]
- Updated dependencies [10d352e]
- Updated dependencies [9589624]
- Updated dependencies [53d3c37]
- Updated dependencies [751c894]
- Updated dependencies [577ce3a]
- Updated dependencies [9260b3a]
  - @mastra/core@0.10.6

## 0.10.6-alpha.5

### Patch Changes

- 8e6f677: Dynamic default llm options
- Updated dependencies [12a95fc]
- Updated dependencies [51264a5]
- Updated dependencies [8e6f677]
  - @mastra/core@0.10.6-alpha.5

## 0.10.6-alpha.4

### Patch Changes

- Updated dependencies [9589624]
  - @mastra/core@0.10.6-alpha.4

## 0.10.6-alpha.3

### Patch Changes

- 2002c59: fix(voice): compatibility with dynamic agent instructions
- Updated dependencies [d70c420]
- Updated dependencies [2a16996]
  - @mastra/core@0.10.6-alpha.3

## 0.10.6-alpha.2

### Patch Changes

- 5f67b6f: Transfer-Encoding chunked header for agent stream hono route
- Updated dependencies [4b0f8a6]
  - @mastra/core@0.10.6-alpha.2

## 0.10.6-alpha.1

### Patch Changes

- ee9af57: Add api for polling run execution result and get run by id
- 3270d9d: Fix runtime context being undefined
- Updated dependencies [ee9af57]
- Updated dependencies [751c894]
- Updated dependencies [577ce3a]
- Updated dependencies [9260b3a]
  - @mastra/core@0.10.6-alpha.1

## 0.10.6-alpha.0

### Patch Changes

- 53d3c37: Get workflows from an agent if not found from Mastra instance #5083
- Updated dependencies [63f6b7d]
- Updated dependencies [36f1c36]
- Updated dependencies [10d352e]
- Updated dependencies [53d3c37]
  - @mastra/core@0.10.6-alpha.0

## 0.10.5

### Patch Changes

- 1ba421d: fix the tools not showing on workflows attached to agents
- Updated dependencies [13c97f9]
  - @mastra/core@0.10.5

## 0.10.4

### Patch Changes

- f1f1f1b: Add basic filtering capabilities to logs
- 9597ee5: Hoist runtimeContext from POST request into middleware
- 82090c1: Add pagination to logs
- bebd27c: Only apply <placeholder> text inside instructions in the playground ui
- Updated dependencies [d1ed912]
- Updated dependencies [f6fd25f]
- Updated dependencies [dffb67b]
- Updated dependencies [f1f1f1b]
- Updated dependencies [925ab94]
- Updated dependencies [f9816ae]
- Updated dependencies [82090c1]
- Updated dependencies [1b443fd]
- Updated dependencies [ce97900]
- Updated dependencies [f1309d3]
- Updated dependencies [14a2566]
- Updated dependencies [f7f8293]
- Updated dependencies [48eddb9]
  - @mastra/core@0.10.4

## 0.10.4-alpha.3

### Patch Changes

- Updated dependencies [925ab94]
  - @mastra/core@0.10.4-alpha.3

## 0.10.4-alpha.2

### Patch Changes

- Updated dependencies [48eddb9]
  - @mastra/core@0.10.4-alpha.2

## 0.10.4-alpha.1

### Patch Changes

- 9597ee5: Hoist runtimeContext from POST request into middleware
- bebd27c: Only apply <placeholder> text inside instructions in the playground ui
- Updated dependencies [f6fd25f]
- Updated dependencies [dffb67b]
- Updated dependencies [f1309d3]
- Updated dependencies [f7f8293]
  - @mastra/core@0.10.4-alpha.1

## 0.10.4-alpha.0

### Patch Changes

- f1f1f1b: Add basic filtering capabilities to logs
- 82090c1: Add pagination to logs
- Updated dependencies [d1ed912]
- Updated dependencies [f1f1f1b]
- Updated dependencies [f9816ae]
- Updated dependencies [82090c1]
- Updated dependencies [1b443fd]
- Updated dependencies [ce97900]
- Updated dependencies [14a2566]
  - @mastra/core@0.10.4-alpha.0

## 0.10.3

### Patch Changes

- Updated dependencies [2b0fc7e]
  - @mastra/core@0.10.3

## 0.10.3-alpha.0

### Patch Changes

- Updated dependencies [2b0fc7e]
  - @mastra/core@0.10.3-alpha.0

## 0.10.2

### Patch Changes

- e5dc18d: Added a backwards compatible layer to begin storing/retrieving UIMessages in storage instead of CoreMessages
- 1b5fc55: Fixed an issue where the playground wouldn't display images saved in memory. Fixed memory to always store images as strings. Removed duplicate storage of reasoning and file/image parts in storage dbs
- e2228f6: Remove stray server log
- a399086: Bumping because we forgot to
- c5bf1ce: Add backwards compat code for new MessageList in storage
- 422ee9e: Fix a2a getTask to be undefined
- f0d559f: Fix peerdeps for alpha channel
- a0ebc3f: Do not throw on lack of storage
- Updated dependencies [ee77e78]
- Updated dependencies [592a2db]
- Updated dependencies [e5dc18d]
- Updated dependencies [ab5adbe]
- Updated dependencies [1e8bb40]
- Updated dependencies [1b5fc55]
- Updated dependencies [195c428]
- Updated dependencies [f73e11b]
- Updated dependencies [37643b8]
- Updated dependencies [99fd6cf]
- Updated dependencies [c5bf1ce]
- Updated dependencies [add596e]
- Updated dependencies [8dc94d8]
- Updated dependencies [ecebbeb]
- Updated dependencies [79d5145]
- Updated dependencies [12b7002]
- Updated dependencies [2901125]
  - @mastra/core@0.10.2

## 0.10.2-alpha.8

### Patch Changes

- Updated dependencies [37643b8]
- Updated dependencies [79d5145]
  - @mastra/core@0.10.2-alpha.8

## 0.10.2-alpha.7

### Patch Changes

- a399086: Bumping because we forgot to
  - @mastra/core@0.10.2-alpha.7

## 0.10.2-alpha.6

### Patch Changes

- Updated dependencies [99fd6cf]
- Updated dependencies [8dc94d8]
  - @mastra/core@0.10.2-alpha.6

## 0.10.2-alpha.5

### Patch Changes

- 1b5fc55: Fixed an issue where the playground wouldn't display images saved in memory. Fixed memory to always store images as strings. Removed duplicate storage of reasoning and file/image parts in storage dbs
- Updated dependencies [1b5fc55]
- Updated dependencies [add596e]
- Updated dependencies [ecebbeb]
  - @mastra/core@0.10.2-alpha.5

## 0.10.2-alpha.4

### Patch Changes

- c5bf1ce: Add backwards compat code for new MessageList in storage
- Updated dependencies [c5bf1ce]
- Updated dependencies [12b7002]
  - @mastra/core@0.10.2-alpha.4

## 0.10.2-alpha.3

### Patch Changes

- 422ee9e: Fix a2a getTask to be undefined
- Updated dependencies [ab5adbe]
- Updated dependencies [195c428]
- Updated dependencies [f73e11b]
  - @mastra/core@0.10.2-alpha.3

## 0.10.2-alpha.2

### Patch Changes

- f0d559f: Fix peerdeps for alpha channel
- a0ebc3f: Do not throw on lack of storage
- Updated dependencies [1e8bb40]
  - @mastra/core@0.10.2-alpha.2

## 0.10.2-alpha.1

### Patch Changes

- Updated dependencies [ee77e78]
- Updated dependencies [2901125]
  - @mastra/core@0.10.2-alpha.1

## 0.10.2-alpha.0

### Patch Changes

- e5dc18d: Added a backwards compatible layer to begin storing/retrieving UIMessages in storage instead of CoreMessages
- e2228f6: Remove stray server log
- Updated dependencies [592a2db]
- Updated dependencies [e5dc18d]
  - @mastra/core@0.10.2-alpha.0

## 0.10.1

### Patch Changes

- 5343f93: Move emitter to symbol to make private
- 6015bdf: Leverage defaultAgentStreamOption, defaultAgentGenerateOption in playground
- Updated dependencies [d70b807]
- Updated dependencies [6d16390]
- Updated dependencies [1e4a421]
- Updated dependencies [200d0da]
- Updated dependencies [bf5f17b]
- Updated dependencies [5343f93]
- Updated dependencies [38aee50]
- Updated dependencies [5c41100]
- Updated dependencies [d6a759b]
- Updated dependencies [6015bdf]
  - @mastra/core@0.10.1

## 0.10.1-alpha.3

### Patch Changes

- Updated dependencies [d70b807]
  - @mastra/core@0.10.1-alpha.3

## 0.10.1-alpha.1

### Patch Changes

- 6015bdf: Leverage defaultAgentStreamOption, defaultAgentGenerateOption in playground
- Updated dependencies [6015bdf]
  - @mastra/core@0.10.1-alpha.2

## 0.10.1-alpha.0

### Patch Changes

- 5343f93: Move emitter to symbol to make private
- Updated dependencies [200d0da]
- Updated dependencies [bf5f17b]
- Updated dependencies [5343f93]
- Updated dependencies [38aee50]
- Updated dependencies [5c41100]
- Updated dependencies [d6a759b]
  - @mastra/core@0.10.1-alpha.1

## 0.10.0

### Minor Changes

- 83da932: Move @mastra/core to peerdeps
- 5eb5a99: Remove pino from @mastra/core into @mastra/loggers

### Patch Changes

- b3a3d63: BREAKING: Make vnext workflow the default worklow, and old workflow legacy_workflow
- 0215b0b: Add description to vnext workflow response
- f53a6ac: Add VNextWorkflowRuns type
- d0ee3c6: Change all public functions and constructors in vector stores to use named args and prepare to phase out positional args
- Updated dependencies [b3a3d63]
- Updated dependencies [344f453]
- Updated dependencies [0a3ae6d]
- Updated dependencies [95911be]
- Updated dependencies [f53a6ac]
- Updated dependencies [5eb5a99]
- Updated dependencies [7e632c5]
- Updated dependencies [1e9fbfa]
- Updated dependencies [eabdcd9]
- Updated dependencies [90be034]
- Updated dependencies [99f050a]
- Updated dependencies [d0ee3c6]
- Updated dependencies [b2ae5aa]
- Updated dependencies [23f258c]
- Updated dependencies [a7292b0]
- Updated dependencies [0dcb9f0]
- Updated dependencies [2672a05]
  - @mastra/core@0.10.0

## 2.1.0-alpha.1

### Minor Changes

- 83da932: Move @mastra/core to peerdeps
- 5eb5a99: Remove pino from @mastra/core into @mastra/loggers

### Patch Changes

- b3a3d63: BREAKING: Make vnext workflow the default worklow, and old workflow legacy_workflow
- 0215b0b: Add description to vnext workflow response
- Updated dependencies [b3a3d63]
- Updated dependencies [344f453]
- Updated dependencies [0a3ae6d]
- Updated dependencies [95911be]
- Updated dependencies [5eb5a99]
- Updated dependencies [7e632c5]
- Updated dependencies [1e9fbfa]
- Updated dependencies [b2ae5aa]
- Updated dependencies [a7292b0]
- Updated dependencies [0dcb9f0]
  - @mastra/core@0.10.0-alpha.1

## 2.0.5-alpha.0

### Patch Changes

- f53a6ac: Add VNextWorkflowRuns type
- d0ee3c6: Change all public functions and constructors in vector stores to use named args and prepare to phase out positional args
- Updated dependencies [f53a6ac]
- Updated dependencies [eabdcd9]
- Updated dependencies [90be034]
- Updated dependencies [99f050a]
- Updated dependencies [d0ee3c6]
- Updated dependencies [23f258c]
- Updated dependencies [2672a05]
  - @mastra/core@0.9.5-alpha.0

## 2.0.4

### Patch Changes

- ab80e7e: Fix resume workflow throwing workflow run not found error
- 5c70b8a: [MASTRA-3234] added limit for client-js getMessages
- 0c3d117: Add workflows to agent server handlers
- cb1f698: Set runtimeContext from playground for agents, tools, workflows
- 0b8b868: Added A2A support + streaming
- c28d7a0: Fix watch workflow not streaming response back in legacy workflow
- Updated dependencies [396be50]
- Updated dependencies [ab80e7e]
- Updated dependencies [c3bd795]
- Updated dependencies [da082f8]
- Updated dependencies [a5810ce]
- Updated dependencies [3e9c131]
- Updated dependencies [3171b5b]
- Updated dependencies [973e5ac]
- Updated dependencies [daf942f]
- Updated dependencies [0b8b868]
- Updated dependencies [9e1eff5]
- Updated dependencies [6fa1ad1]
- Updated dependencies [c28d7a0]
- Updated dependencies [edf1e88]
  - @mastra/core@0.9.4

## 2.0.4-alpha.4

### Patch Changes

- 5c70b8a: [MASTRA-3234] added limit for client-js getMessages
- Updated dependencies [3e9c131]
  - @mastra/core@0.9.4-alpha.4

## 2.0.4-alpha.3

### Patch Changes

- 0c3d117: Add workflows to agent server handlers
- Updated dependencies [396be50]
- Updated dependencies [c3bd795]
- Updated dependencies [da082f8]
- Updated dependencies [a5810ce]
  - @mastra/core@0.9.4-alpha.3

## 2.0.4-alpha.2

### Patch Changes

- Updated dependencies [3171b5b]
- Updated dependencies [973e5ac]
- Updated dependencies [9e1eff5]
  - @mastra/core@0.9.4-alpha.2

## 2.0.4-alpha.1

### Patch Changes

- ab80e7e: Fix resume workflow throwing workflow run not found error
- c28d7a0: Fix watch workflow not streaming response back in legacy workflow
- Updated dependencies [ab80e7e]
- Updated dependencies [6fa1ad1]
- Updated dependencies [c28d7a0]
- Updated dependencies [edf1e88]
  - @mastra/core@0.9.4-alpha.1

## 2.0.4-alpha.0

### Patch Changes

- cb1f698: Set runtimeContext from playground for agents, tools, workflows
- 0b8b868: Added A2A support + streaming
- Updated dependencies [daf942f]
- Updated dependencies [0b8b868]
  - @mastra/core@0.9.4-alpha.0

## 2.0.3

### Patch Changes

- 526c570: expose agent runtimeContext from clientSDK
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

## 2.0.3-alpha.1

### Patch Changes

- Updated dependencies [e450778]
- Updated dependencies [8902157]
- Updated dependencies [ca0dc88]
- Updated dependencies [9cd1a46]
- Updated dependencies [70dbf51]
  - @mastra/core@0.9.3-alpha.1

## 2.0.3-alpha.0

### Patch Changes

- 526c570: expose agent runtimeContext from clientSDK
- Updated dependencies [526c570]
- Updated dependencies [b5d2de0]
- Updated dependencies [644f8ad]
  - @mastra/core@0.9.3-alpha.0

## 2.0.2

### Patch Changes

- 6052aa6: Add getWorkflowRunById to vNext workflow core and server handler
- 4155f47: Add parameters to filter workflow runs
  Add fromDate and toDate to telemetry parameters
- 0097d50: Add serializedStepGraph to vNext workflow
  Return serializedStepGraph from vNext workflow
  Use serializedStepGraph in vNext workflow graph
- Updated dependencies [6052aa6]
- Updated dependencies [967b41c]
- Updated dependencies [3d2fb5c]
- Updated dependencies [26738f4]
- Updated dependencies [4155f47]
- Updated dependencies [7eeb2bc]
- Updated dependencies [b804723]
- Updated dependencies [8607972]
- Updated dependencies [ccef9f9]
- Updated dependencies [0097d50]
- Updated dependencies [7eeb2bc]
- Updated dependencies [17826a9]
- Updated dependencies [7d8b7c7]
- Updated dependencies [fba031f]
- Updated dependencies [3a5f1e1]
- Updated dependencies [51e6923]
- Updated dependencies [8398d89]
  - @mastra/core@0.9.2

## 2.0.2-alpha.6

### Patch Changes

- 6052aa6: Add getWorkflowRunById to vNext workflow core and server handler
- Updated dependencies [6052aa6]
- Updated dependencies [7d8b7c7]
- Updated dependencies [3a5f1e1]
- Updated dependencies [8398d89]
  - @mastra/core@0.9.2-alpha.6

## 2.0.2-alpha.5

### Patch Changes

- Updated dependencies [3d2fb5c]
- Updated dependencies [7eeb2bc]
- Updated dependencies [8607972]
- Updated dependencies [7eeb2bc]
- Updated dependencies [fba031f]
  - @mastra/core@0.9.2-alpha.5

## 2.0.2-alpha.4

### Patch Changes

- Updated dependencies [ccef9f9]
- Updated dependencies [51e6923]
  - @mastra/core@0.9.2-alpha.4

## 2.0.2-alpha.3

### Patch Changes

- 4155f47: Add parameters to filter workflow runs
  Add fromDate and toDate to telemetry parameters
- Updated dependencies [967b41c]
- Updated dependencies [4155f47]
- Updated dependencies [17826a9]
  - @mastra/core@0.9.2-alpha.3

## 2.0.2-alpha.2

### Patch Changes

- Updated dependencies [26738f4]
  - @mastra/core@0.9.2-alpha.2

## 2.0.2-alpha.1

### Patch Changes

- Updated dependencies [b804723]
  - @mastra/core@0.9.2-alpha.1

## 2.0.2-alpha.0

### Patch Changes

- 0097d50: Add serializedStepGraph to vNext workflow
  Return serializedStepGraph from vNext workflow
  Use serializedStepGraph in vNext workflow graph
- Updated dependencies [0097d50]
  - @mastra/core@0.9.2-alpha.0

## 2.0.1

### Patch Changes

- 34a76ca: Call workflow cleanup function when closing watch stream controller
- 35955b0: Rename import to runtime-contxt
- c1409ef: Add vNextWorkflow handlers and APIs
  Add stepGraph and steps to vNextWorkflow
- 3e7b69d: Dynamic agent props
- f200fed: Server handler audioStream fix
- 11d4485: Show VNext workflows on the playground
  Show running status for step in vNext workflowState
- 57b25ed: Use resumeSchema to show inputs on the playground for suspended workflows
- 1d3b1cd: Rebump
- Updated dependencies [405b63d]
- Updated dependencies [81fb7f6]
- Updated dependencies [20275d4]
- Updated dependencies [7d1892c]
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
- Updated dependencies [c23a81c]
- Updated dependencies [2d4001d]
- Updated dependencies [c71013a]
- Updated dependencies [1d3b1cd]
  - @mastra/core@0.9.1

## 2.0.1-alpha.8

### Patch Changes

- Updated dependencies [2d17c73]
  - @mastra/core@0.9.1-alpha.8

## 2.0.1-alpha.7

### Patch Changes

- 1d3b1cd: Rebump
- Updated dependencies [1d3b1cd]
  - @mastra/core@0.9.1-alpha.7

## 2.0.1-alpha.6

### Patch Changes

- Updated dependencies [c23a81c]
  - @mastra/core@0.9.1-alpha.6

## 2.0.1-alpha.5

### Patch Changes

- 3e7b69d: Dynamic agent props
- Updated dependencies [3e7b69d]
  - @mastra/core@0.9.1-alpha.5

## 2.0.1-alpha.4

### Patch Changes

- Updated dependencies [e4943b8]
- Updated dependencies [479f490]
  - @mastra/core@0.9.1-alpha.4

## 2.0.1-alpha.3

### Patch Changes

- 34a76ca: Call workflow cleanup function when closing watch stream controller
- Updated dependencies [6262bd5]
  - @mastra/core@0.9.1-alpha.3

## 2.0.1-alpha.2

### Patch Changes

- 57b25ed: Use resumeSchema to show inputs on the playground for suspended workflows
- Updated dependencies [405b63d]
- Updated dependencies [61e92f5]
- Updated dependencies [c71013a]
  - @mastra/core@0.9.1-alpha.2

## 2.0.1-alpha.1

### Patch Changes

- 35955b0: Rename import to runtime-contxt
- c1409ef: Add vNextWorkflow handlers and APIs
  Add stepGraph and steps to vNextWorkflow
- f200fed: Server handler audioStream fix
- 11d4485: Show VNext workflows on the playground
  Show running status for step in vNext workflowState
- Updated dependencies [20275d4]
- Updated dependencies [7d1892c]
- Updated dependencies [a90a082]
- Updated dependencies [35955b0]
- Updated dependencies [c1409ef]
- Updated dependencies [11d4485]
- Updated dependencies [2d4001d]
  - @mastra/core@0.9.1-alpha.1

## 2.0.1-alpha.0

### Patch Changes

- Updated dependencies [81fb7f6]
  - @mastra/core@0.9.1-alpha.0

## 2.0.0

### Minor Changes

- fe3ae4d: Remove \_\_ functions in storage and move to storage proxy to make sure init is called

### Patch Changes

- 0f4eae3: Rename Container into RuntimeContext
- 1c0d2b7: Fix speakerId in voice speak method
- Updated dependencies [000a6d4]
- Updated dependencies [08bb78e]
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
- Updated dependencies [9c26508]
- Updated dependencies [0f4eae3]
- Updated dependencies [16a8648]
- Updated dependencies [6f92295]
  - @mastra/core@0.9.0

## 2.0.0-alpha.8

### Patch Changes

- 0f4eae3: Rename Container into RuntimeContext
- 1c0d2b7: Fix speakerId in voice speak method
- Updated dependencies [000a6d4]
- Updated dependencies [ed2f549]
- Updated dependencies [c0f22b4]
- Updated dependencies [0a033fa]
- Updated dependencies [9c26508]
- Updated dependencies [0f4eae3]
- Updated dependencies [16a8648]
  - @mastra/core@0.9.0-alpha.8

## 2.0.0-alpha.7

### Patch Changes

- Updated dependencies [71d9444]
  - @mastra/core@0.9.0-alpha.7

## 2.0.0-alpha.6

### Patch Changes

- Updated dependencies [157c741]
  - @mastra/core@0.9.0-alpha.6

## 2.0.0-alpha.5

### Patch Changes

- Updated dependencies [08bb78e]
  - @mastra/core@0.9.0-alpha.5

## 2.0.0-alpha.4

### Patch Changes

- Updated dependencies [7e92011]
  - @mastra/core@0.9.0-alpha.4

## 2.0.0-alpha.3

### Minor Changes

- fe3ae4d: Remove \_\_ functions in storage and move to storage proxy to make sure init is called

### Patch Changes

- Updated dependencies [fe3ae4d]
  - @mastra/core@0.9.0-alpha.3

## 1.0.4-alpha.2

### Patch Changes

- Updated dependencies [9ee4293]
  - @mastra/core@0.8.4-alpha.2

## 1.0.4-alpha.1

### Patch Changes

- Updated dependencies [8a8a73b]
- Updated dependencies [6f92295]
  - @mastra/core@0.8.4-alpha.1

## 1.0.4-alpha.0

### Patch Changes

- Updated dependencies [03f3cd0]
  - @mastra/core@0.8.4-alpha.0

## 1.0.3

### Patch Changes

- 9f6f6dd: Fix container for tools execution api
- 32e7b71: Add support for dependency injection
- 37bb612: Add Elastic-2.0 licensing for packages
- Updated dependencies [d72318f]
- Updated dependencies [0bcc862]
- Updated dependencies [10a8caf]
- Updated dependencies [359b089]
- Updated dependencies [32e7b71]
- Updated dependencies [37bb612]
- Updated dependencies [7f1b291]
  - @mastra/core@0.8.3

## 1.0.3-alpha.6

### Patch Changes

- Updated dependencies [d72318f]
  - @mastra/core@0.8.3-alpha.5

## 1.0.3-alpha.5

### Patch Changes

- 9f6f6dd: Fix container for tools execution api

## 1.0.3-alpha.4

### Patch Changes

- Updated dependencies [7f1b291]
  - @mastra/core@0.8.3-alpha.4

## 1.0.3-alpha.3

### Patch Changes

- Updated dependencies [10a8caf]
  - @mastra/core@0.8.3-alpha.3

## 1.0.3-alpha.2

### Patch Changes

- Updated dependencies [0bcc862]
  - @mastra/core@0.8.3-alpha.2

## 1.0.3-alpha.1

### Patch Changes

- 32e7b71: Add support for dependency injection
- 37bb612: Add Elastic-2.0 licensing for packages
- Updated dependencies [32e7b71]
- Updated dependencies [37bb612]
  - @mastra/core@0.8.3-alpha.1

## 1.0.3-alpha.0

### Patch Changes

- Updated dependencies [359b089]
  - @mastra/core@0.8.3-alpha.0

## 1.0.2

### Patch Changes

- Updated dependencies [a06aadc]
  - @mastra/core@0.8.2

## 1.0.2-alpha.0

### Patch Changes

- Updated dependencies [a06aadc]
  - @mastra/core@0.8.2-alpha.0

## 1.0.1

### Patch Changes

- Updated dependencies [99e2998]
- Updated dependencies [8fdb414]
  - @mastra/core@0.8.1

## 1.0.1-alpha.0

### Patch Changes

- Updated dependencies [99e2998]
- Updated dependencies [8fdb414]
  - @mastra/core@0.8.1-alpha.0

## 1.0.0

### Patch Changes

- 84fe241: Decoupled handlers from hono
- 789bef3: Make runId optional for workflow startAsync api
- a3f0e90: Update storage initialization to ensure tables are present
- 8393832: Handle nested workflow view on workflow graph
- 84fe241: Improve streaming of workflows
- febc8a6: Added dual tracing and fixed local tracing recursion
- Updated dependencies [56c31b7]
- Updated dependencies [619c39d]
- Updated dependencies [5ae0180]
- Updated dependencies [fe56be0]
- Updated dependencies [93875ed]
- Updated dependencies [107bcfe]
- Updated dependencies [9bfa12b]
- Updated dependencies [515ebfb]
- Updated dependencies [5b4e19f]
- Updated dependencies [dbbbf80]
- Updated dependencies [a0967a0]
- Updated dependencies [fca3b21]
- Updated dependencies [88fa727]
- Updated dependencies [f37f535]
- Updated dependencies [a3f0e90]
- Updated dependencies [4d67826]
- Updated dependencies [6330967]
- Updated dependencies [8393832]
- Updated dependencies [6330967]
- Updated dependencies [99d43b9]
- Updated dependencies [d7e08e8]
- Updated dependencies [febc8a6]
- Updated dependencies [7599d77]
- Updated dependencies [0118361]
- Updated dependencies [619c39d]
- Updated dependencies [cafae83]
- Updated dependencies [8076ecf]
- Updated dependencies [8df4a77]
- Updated dependencies [304397c]
  - @mastra/core@0.8.0

## 0.0.1-alpha.6

### Patch Changes

- Updated dependencies [8df4a77]
  - @mastra/core@0.8.0-alpha.8

## 0.0.1-alpha.5

### Patch Changes

- febc8a6: Added dual tracing and fixed local tracing recursion
- Updated dependencies [febc8a6]
  - @mastra/core@0.8.0-alpha.7

## 0.0.1-alpha.4

### Patch Changes

- a3f0e90: Update storage initialization to ensure tables are present
- Updated dependencies [a3f0e90]
  - @mastra/core@0.8.0-alpha.6

## 0.0.1-alpha.3

### Patch Changes

- Updated dependencies [93875ed]
  - @mastra/core@0.8.0-alpha.5

## 0.0.1-alpha.2

### Patch Changes

- Updated dependencies [d7e08e8]
  - @mastra/core@0.8.0-alpha.4

## 0.0.1-alpha.1

### Patch Changes

- 789bef3: Make runId optional for workflow startAsync api
- 8393832: Handle nested workflow view on workflow graph
- Updated dependencies [5ae0180]
- Updated dependencies [9bfa12b]
- Updated dependencies [515ebfb]
- Updated dependencies [88fa727]
- Updated dependencies [f37f535]
- Updated dependencies [4d67826]
- Updated dependencies [6330967]
- Updated dependencies [8393832]
- Updated dependencies [6330967]
  - @mastra/core@0.8.0-alpha.3

## 0.0.1-alpha.0

### Patch Changes

- 84fe241: Decoupled handlers from hono
- 84fe241: Improve streaming of workflows
- Updated dependencies [56c31b7]
- Updated dependencies [dbbbf80]
- Updated dependencies [99d43b9]
  - @mastra/core@0.8.0-alpha.2

## 0.2.5-alpha.0

### Patch Changes

- Updated dependencies [b4fbc59]
  - @mastra/core@0.6.5-alpha.0

## 0.2.4

### Patch Changes

- e764fd1: Fix telemetry when side-effects are added to the mastra file
- 709aa2c: fix building externals
- e764fd1: Fix deployer when side-effects are added to the mastra file
- 05ef3e0: Support voice for mastra client
- 95c5745: Fix symlink resolving and externals
- 85a2461: Fix cloudflare deployer
- Updated dependencies [6794797]
- Updated dependencies [fb68a80]
- Updated dependencies [b56a681]
- Updated dependencies [248cb07]
  - @mastra/core@0.6.4

## 0.2.4-alpha.1

### Patch Changes

- 709aa2c: fix building externals
- 85a2461: Fix cloudflare deployer
- Updated dependencies [6794797]
  - @mastra/core@0.6.4-alpha.1

## 0.2.4-alpha.0

### Patch Changes

- e764fd1: Fix telemetry when side-effects are added to the mastra file
- e764fd1: Fix deployer when side-effects are added to the mastra file
- 05ef3e0: Support voice for mastra client
- 95c5745: Fix symlink resolving and externals
- Updated dependencies [fb68a80]
- Updated dependencies [b56a681]
- Updated dependencies [248cb07]
  - @mastra/core@0.6.4-alpha.0

## 0.2.3

### Patch Changes

- 404640e: AgentNetwork changeset
- Updated dependencies [404640e]
- Updated dependencies [3bce733]
  - @mastra/core@0.6.3

## 0.2.3-alpha.1

### Patch Changes

- Updated dependencies [3bce733]
  - @mastra/core@0.6.3-alpha.1

## 0.2.3-alpha.0

### Patch Changes

- 404640e: AgentNetwork changeset
- Updated dependencies [404640e]
  - @mastra/core@0.6.3-alpha.0

## 0.2.2

### Patch Changes

- 4e6732b: Add support for tsconfig paths aliases
- Updated dependencies [beaf1c2]
- Updated dependencies [3084e13]
  - @mastra/core@0.6.2

## 0.2.2-alpha.1

### Patch Changes

- Updated dependencies [beaf1c2]
- Updated dependencies [3084e13]
  - @mastra/core@0.6.2-alpha.0

## 0.2.2-alpha.0

### Patch Changes

- 4e6732b: Add support for tsconfig paths aliases

## 0.2.1

### Patch Changes

- cc7f392: Fix babel transformation in deployer
- 0850b4c: Watch and resume per run
- da8d9bb: Enable public dir copying if it exists
- 9116d70: Handle the different workflow methods in workflow graph
- 61ad5a4: Move esbuild plugin higher than commonjs for telemetry extraction
- Updated dependencies [fc2f89c]
- Updated dependencies [dfbb131]
- Updated dependencies [f4854ee]
- Updated dependencies [afaf73f]
- Updated dependencies [0850b4c]
- Updated dependencies [7bcfaee]
- Updated dependencies [44631b1]
- Updated dependencies [9116d70]
- Updated dependencies [6e559a0]
- Updated dependencies [5f43505]
  - @mastra/core@0.6.1

## 0.2.1-alpha.2

### Patch Changes

- cc7f392: Fix babel transformation in deployer
- 0850b4c: Watch and resume per run
- da8d9bb: Enable public dir copying if it exists
- 9116d70: Handle the different workflow methods in workflow graph
- Updated dependencies [fc2f89c]
- Updated dependencies [dfbb131]
- Updated dependencies [0850b4c]
- Updated dependencies [9116d70]
  - @mastra/core@0.6.1-alpha.2

## 0.2.1-alpha.1

### Patch Changes

- 61ad5a4: Move esbuild plugin higher than commonjs for telemetry extraction
- Updated dependencies [f4854ee]
- Updated dependencies [afaf73f]
- Updated dependencies [44631b1]
- Updated dependencies [6e559a0]
- Updated dependencies [5f43505]
  - @mastra/core@0.6.1-alpha.1

## 0.2.1-alpha.0

### Patch Changes

- Updated dependencies [7bcfaee]
  - @mastra/core@0.6.1-alpha.0

## 0.2.0

### Minor Changes

- 95b4144: Added server middleware to apply custom functionality in API endpoints like auth

### Patch Changes

- Updated dependencies [16b98d9]
- Updated dependencies [1c8cda4]
- Updated dependencies [95b4144]
- Updated dependencies [3729dbd]
- Updated dependencies [c2144f4]
  - @mastra/core@0.6.0

## 0.2.0-alpha.1

### Minor Changes

- 95b4144: Added server middleware to apply custom functionality in API endpoints like auth

### Patch Changes

- Updated dependencies [16b98d9]
- Updated dependencies [1c8cda4]
- Updated dependencies [95b4144]
- Updated dependencies [c2144f4]
  - @mastra/core@0.6.0-alpha.1

## 0.1.9-alpha.0

### Patch Changes

- Updated dependencies [3729dbd]
  - @mastra/core@0.5.1-alpha.0

## 0.1.8

### Patch Changes

- 7a7a547: Fix telemetry getter in hono server
- e9fbac5: Update Vercel tools to have id and update deployer
- 8deb34c: Better workflow watch api + watch workflow by runId
- c2dde91: Return full workflow details in api/workflows endpoint
- 5d41958: Remove redundant mastra server agent stream, generate messages validation
- 144b3d5: Update traces table UI, agent Chat UI
  Fix get workflows breaking
- 03236ec: Added GRPC Exporter for Laminar and updated dodcs for Observability Providers
- 731dd8a: Removed useless logging that showed up when user selected log drains tab on the playground
- 0461849: Fixed a bug where mastra.db file location was inconsistently created when running mastra dev vs running a file directly (tsx src/index.ts for ex)
- fd4a1d7: Update cjs bundling to make sure files are split
- 960690d: return runId from server on workflow watch
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
- Updated dependencies [03236ec]
- Updated dependencies [3764e71]
- Updated dependencies [df982db]
- Updated dependencies [a171b37]
- Updated dependencies [506f1d5]
- Updated dependencies [02ffb7b]
- Updated dependencies [0461849]
- Updated dependencies [2259379]
- Updated dependencies [aeb5e36]
- Updated dependencies [f2301de]
- Updated dependencies [358f069]
- Updated dependencies [fd4a1d7]
- Updated dependencies [c139344]
  - @mastra/core@0.5.0

## 0.1.8-alpha.12

### Patch Changes

- Updated dependencies [a85ab24]
  - @mastra/core@0.5.0-alpha.12

## 0.1.8-alpha.11

### Patch Changes

- 7a7a547: Fix telemetry getter in hono server
- 8deb34c: Better workflow watch api + watch workflow by runId
- 5d41958: Remove redundant mastra server agent stream, generate messages validation
- fd4a1d7: Update cjs bundling to make sure files are split
- Updated dependencies [7a7a547]
- Updated dependencies [c93798b]
- Updated dependencies [dbd9f2d]
- Updated dependencies [a171b37]
- Updated dependencies [fd4a1d7]
  - @mastra/core@0.5.0-alpha.11

## 0.1.8-alpha.10

### Patch Changes

- Updated dependencies [a910463]
  - @mastra/core@0.5.0-alpha.10

## 0.1.8-alpha.9

### Patch Changes

- e9fbac5: Update Vercel tools to have id and update deployer
- Updated dependencies [e9fbac5]
- Updated dependencies [1e8bcbc]
- Updated dependencies [aeb5e36]
- Updated dependencies [f2301de]
  - @mastra/core@0.5.0-alpha.9

## 0.1.8-alpha.8

### Patch Changes

- Updated dependencies [506f1d5]
  - @mastra/core@0.5.0-alpha.8

## 0.1.8-alpha.7

### Patch Changes

- Updated dependencies [ee667a2]
  - @mastra/core@0.5.0-alpha.7

## 0.1.8-alpha.6

### Patch Changes

- Updated dependencies [f6678e4]
  - @mastra/core@0.5.0-alpha.6

## 0.1.8-alpha.5

### Patch Changes

- 03236ec: Added GRPC Exporter for Laminar and updated dodcs for Observability Providers
- 0461849: Fixed a bug where mastra.db file location was inconsistently created when running mastra dev vs running a file directly (tsx src/index.ts for ex)
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

## 0.1.8-alpha.4

### Patch Changes

- 144b3d5: Update traces table UI, agent Chat UI
  Fix get workflows breaking
- Updated dependencies [d79aedf]
  - @mastra/core@0.5.0-alpha.4

## 0.1.8-alpha.3

### Patch Changes

- Updated dependencies [3d0e290]
  - @mastra/core@0.5.0-alpha.3

## 0.1.8-alpha.2

### Patch Changes

- Updated dependencies [02ffb7b]
  - @mastra/core@0.5.0-alpha.2

## 0.1.8-alpha.1

### Patch Changes

- Updated dependencies [dab255b]
  - @mastra/core@0.5.0-alpha.1

## 0.1.8-alpha.0

### Patch Changes

- c2dde91: Return full workflow details in api/workflows endpoint
- 731dd8a: Removed useless logging that showed up when user selected log drains tab on the playground
- 960690d: return runId from server on workflow watch
- Updated dependencies [59df7b6]
- Updated dependencies [29f3a82]
- Updated dependencies [59df7b6]
- Updated dependencies [c139344]
  - @mastra/core@0.5.0-alpha.0

## 0.1.7

### Patch Changes

- 30a4c29: fix mastra build errors related to esbuild not removing types
- e1e2705: Added --ignore-workspace when installing dependencies in mastra build with pnpm package manager
- Updated dependencies [1da20e7]
  - @mastra/core@0.4.4

## 0.1.7-alpha.0

### Patch Changes

- 30a4c29: fix mastra build errors related to esbuild not removing types
- e1e2705: Added --ignore-workspace when installing dependencies in mastra build with pnpm package manager
- Updated dependencies [1da20e7]
  - @mastra/core@0.4.4-alpha.0

## 0.1.6

### Patch Changes

- 80cdd76: Add hono routes for agent voice methods speakers, speak and listen
- 0fd78ac: Update vector store functions to use object params
- 0d25b75: Add all agent stream,generate option to cliend-js sdk
- bb4f447: Add support for commonjs
- Updated dependencies [0d185b1]
- Updated dependencies [ed55f1d]
- Updated dependencies [06aa827]
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

## 0.1.6-alpha.4

### Patch Changes

- Updated dependencies [dabecf4]
  - @mastra/core@0.4.3-alpha.4

## 0.1.6-alpha.3

### Patch Changes

- 0fd78ac: Update vector store functions to use object params
- 0d25b75: Add all agent stream,generate option to cliend-js sdk
- bb4f447: Add support for commonjs
- Updated dependencies [0fd78ac]
- Updated dependencies [0d25b75]
- Updated dependencies [fd14a3f]
- Updated dependencies [3f369a2]
- Updated dependencies [4d4e1e1]
- Updated dependencies [bb4f447]
  - @mastra/core@0.4.3-alpha.3

## 0.1.6-alpha.2

### Patch Changes

- Updated dependencies [2512a93]
- Updated dependencies [e62de74]
  - @mastra/core@0.4.3-alpha.2

## 0.1.6-alpha.1

### Patch Changes

- 80cdd76: Add hono routes for agent voice methods speakers, speak and listen
- Updated dependencies [0d185b1]
- Updated dependencies [ed55f1d]
- Updated dependencies [8d13b14]
- Updated dependencies [3ee4831]
- Updated dependencies [108793c]
- Updated dependencies [5f28f44]
  - @mastra/core@0.4.3-alpha.1

## 0.1.6-alpha.0

### Patch Changes

- Updated dependencies [06aa827]
  - @mastra/core@0.4.3-alpha.0

## 0.1.5

### Patch Changes

- e4ee56c: Enable \* imports in analyze bundle
- 2d68431: Fix mastra server error processing
- e752340: Move storage/vector libSQL to own files so they do not get imported when not using bundlers.
- Updated dependencies [7fceae1]
- Updated dependencies [8d94c3e]
- Updated dependencies [99dcdb5]
- Updated dependencies [6cb63e0]
- Updated dependencies [f626fbb]
- Updated dependencies [e752340]
- Updated dependencies [eb91535]
  - @mastra/core@0.4.2

## 0.1.5-alpha.3

### Patch Changes

- e752340: Move storage/vector libSQL to own files so they do not get imported when not using bundlers.
- Updated dependencies [8d94c3e]
- Updated dependencies [99dcdb5]
- Updated dependencies [e752340]
- Updated dependencies [eb91535]
  - @mastra/core@0.4.2-alpha.2

## 0.1.5-alpha.2

### Patch Changes

- Updated dependencies [6cb63e0]
  - @mastra/core@0.4.2-alpha.1

## 0.1.5-alpha.1

### Patch Changes

- 2d68431: Fix mastra server error processing

## 0.1.5-alpha.0

### Patch Changes

- e4ee56c: Enable \* imports in analyze bundle
- Updated dependencies [7fceae1]
- Updated dependencies [f626fbb]
  - @mastra/core@0.4.2-alpha.0

## 0.1.4

### Patch Changes

- 967da43: Logger, transport fixes
- Updated dependencies [ce44b9b]
- Updated dependencies [967da43]
- Updated dependencies [b405f08]
  - @mastra/core@0.4.1

## 0.1.3

### Patch Changes

- 5297264: Fix build errors by changing contracts
- Updated dependencies [2fc618f]
- Updated dependencies [fe0fd01]
  - @mastra/core@0.4.0

## 0.1.3-alpha.1

### Patch Changes

- Updated dependencies [fe0fd01]
  - @mastra/core@0.4.0-alpha.1

## 0.1.3-alpha.0

### Patch Changes

- 5297264: Fix build errors by changing contracts
- Updated dependencies [2fc618f]
  - @mastra/core@0.4.0-alpha.0

## 0.1.2

### Patch Changes

- Updated dependencies [f205ede]
  - @mastra/core@0.3.0

## 0.1.1

### Patch Changes

- 936dc26: Add mastra server endpoints for watch/resume + plug watch and resume functionality to dev playground
- 91ef439: Add eslint and ran autofix
- aac1667: Improve treeshaking of core and output
- Updated dependencies [d59f1a8]
- Updated dependencies [91ef439]
- Updated dependencies [4a25be4]
- Updated dependencies [bf2e88f]
- Updated dependencies [2f0d707]
- Updated dependencies [aac1667]
  - @mastra/core@0.2.1

## 0.1.1-alpha.0

### Patch Changes

- 936dc26: Add mastra server endpoints for watch/resume + plug watch and resume functionality to dev playground
- 91ef439: Add eslint and ran autofix
- aac1667: Improve treeshaking of core and output
- Updated dependencies [d59f1a8]
- Updated dependencies [91ef439]
- Updated dependencies [4a25be4]
- Updated dependencies [bf2e88f]
- Updated dependencies [2f0d707]
- Updated dependencies [aac1667]
  - @mastra/core@0.2.1-alpha.0

## 0.1.0

### Minor Changes

- 4d4f6b6: Update deployer
- 5916f9d: Update deps from fixed to ^
- 8b416d9: Breaking changes

### Patch Changes

- 2ab57d6: Fix: Workflows require a trigger schema otherwise it fails to run in dev
- a1774e7: Improve bundling
- 291fe57: mastra openapi, swagger ui, dynamic servers
- e4d4ede: Better setLogger()
- 73d112c: Core and deployer fixes
- 9d1796d: Fix storage and eval serialization on api
- e27fe69: Add dir to deployer
- 246f06c: Fix import \* from telemetry package
- ac8c61a: Mastra server vector operations
- 82a6d53: better create-mastra tsconfig, better error for mastra server agent stream
- bdaf834: publish packages
- 7d83b92: Create default storage and move evals towards it
- 8fa48b9: Add an API to enhance agent instructions
- 685108a: Remove syncs and excess rag
- 5fdc87c: Update evals storage in attachListeners
- ae7bf94: Fix loggers messing up deploys
- b97ca96: Tracing into default storage
- ad2cd74: Deploy fix
- 7babd5c: CLI build and other
- a9b5ddf: Publish new versions
- 9066f95: CF deployer fixes
- 4139b43: Deployer utils
- ab01c53: Fix mastra server agent streamObject
- 1944807: Unified logger and major step in better logs
- 8aec8b7: Normalize imports to package name and dedupe while writing package.json after mastra build
- 685108a: Removing mastra syncs
- 382f4dc: move telemetry init to instrumentation.mjs file in build directory
- 7892533: Updated test evals to use Mastra Storage
- 9c10484: update all packages
- 88f18d7: Update cors support
- 70dabd9: Fix broken publish
- 1a41fbf: Fix playground workflow triggerData on execution
- 391d5ea: Add @opentelemetry/instrumentation to pkg json of build artifcat
- 8329f1a: Add debug env
- e6d8055: Added Mastra Storage to add and query live evals
- a18e96c: Array schemas for dev tool playground
- 5950de5: Added update instructions API
- b425845: Logger and execa logs
- 0696eeb: Cleanup Mastra server
- 6780223: fix workflow runId not unique per execution in dev
- a8a459a: Updated Evals table UI
- 0b96376: fix pino of being null
- cfb966f: Deprecate @mastra/tts for mastra speech providers
- 9625602: Use mastra core splitted bundles in other packages
- 72d1990: Updated evals table schema
- a291824: Deployer fixes
- 8ea426a: Fix patch
- c5f2d50: Split deployer package
- 7064554: deployer fixes
- 72c280b: Fixes
- b80ea8d: Fix bundling of server
- 42a2e69: Fix playground error parsing
- 28dceab: Catch apiKey error in dev
- a5604c4: Deployer initial
- 38b7f66: Update deployer logic
- b9c7047: Move to non deprecated table name for eval insertion
- 4a328af: Set request limit to 4.5MB
- 9ade36e: Changed measure for evals, added endpoints, attached metrics to agent, added ui for evals in playground, and updated docs
- d9c8dd0: Logger changes for default transports
- 9fb59d6: changeset
- f1e3105: Now that memory can be added to an agent, the playground needs to look up memory on the agent, not on mastra. Now the playground looks up on the agent to properly access memory
- ae7bf94: Changeset
- 4f1d1a1: Enforce types ann cleanup package.json
- Updated dependencies [f537e33]
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
- Updated dependencies [3967e69]
- Updated dependencies [8ae2bbc]
- Updated dependencies [e9d1b47]
- Updated dependencies [016493a]
- Updated dependencies [bc40916]
- Updated dependencies [93a3719]
- Updated dependencies [7d83b92]
- Updated dependencies [9fb3039]
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
- Updated dependencies [7d87a15]
- Updated dependencies [b97ca96]
- Updated dependencies [23dcb23]
- Updated dependencies [033eda6]
- Updated dependencies [8105fae]
- Updated dependencies [e097800]
- Updated dependencies [1944807]
- Updated dependencies [30322ce]
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
- Updated dependencies [70dabd9]
- Updated dependencies [21fe536]
- Updated dependencies [176bc42]
- Updated dependencies [401a4d9]
- Updated dependencies [2e099d2]
- Updated dependencies [0b826f6]
- Updated dependencies [d68b532]
- Updated dependencies [75bf3f0]
- Updated dependencies [e6d8055]
- Updated dependencies [e2e76de]
- Updated dependencies [ccbc581]
- Updated dependencies [5950de5]
- Updated dependencies [fe3dcb0]
- Updated dependencies [78eec7c]
- Updated dependencies [a8a459a]
- Updated dependencies [0be7181]
- Updated dependencies [7b87567]
- Updated dependencies [b524c22]
- Updated dependencies [d7d465a]
- Updated dependencies [df843d3]
- Updated dependencies [4534e77]
- Updated dependencies [d6d8159]
- Updated dependencies [0bd142c]
- Updated dependencies [9625602]
- Updated dependencies [72d1990]
- Updated dependencies [f6ba259]
- Updated dependencies [2712098]
- Updated dependencies [eedb829]
- Updated dependencies [5285356]
- Updated dependencies [74b3078]
- Updated dependencies [cb290ee]
- Updated dependencies [b4d7416]
- Updated dependencies [e608d8c]
- Updated dependencies [06b2c0a]
- Updated dependencies [002d6d8]
- Updated dependencies [e448a26]
- Updated dependencies [8b416d9]
- Updated dependencies [fd494a3]
- Updated dependencies [dc90663]
- Updated dependencies [c872875]
- Updated dependencies [3c4488b]
- Updated dependencies [a7b016d]
- Updated dependencies [fd75f3c]
- Updated dependencies [7f24c29]
- Updated dependencies [2017553]
- Updated dependencies [a10b7a3]
- Updated dependencies [cf6d825]
- Updated dependencies [963c15a]
- Updated dependencies [7365b6c]
- Updated dependencies [5ee67d3]
- Updated dependencies [d38f7a6]
- Updated dependencies [38b7f66]
- Updated dependencies [2fa7f53]
- Updated dependencies [1420ae2]
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
  - @mastra/core@0.2.0

## 0.1.0-alpha.63

### Patch Changes

- 391d5ea: Add @opentelemetry/instrumentation to pkg json of build artifcat

## 0.1.0-alpha.62

### Patch Changes

- 382f4dc: move telemetry init to instrumentation.mjs file in build directory
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

## 0.1.0-alpha.61

### Patch Changes

- b9c7047: Move to non deprecated table name for eval insertion

## 0.1.0-alpha.60

### Patch Changes

- Updated dependencies [d5fccfb]
  - @mastra/core@0.2.0-alpha.109

## 0.1.0-alpha.59

### Patch Changes

- Updated dependencies [5ee67d3]
- Updated dependencies [95a4697]
  - @mastra/core@0.2.0-alpha.108

## 0.1.0-alpha.58

### Patch Changes

- 8fa48b9: Add an API to enhance agent instructions
- Updated dependencies [66a5392]
  - @mastra/core@0.2.0-alpha.107

## 0.1.0-alpha.57

### Patch Changes

- a8a459a: Updated Evals table UI
- 4a328af: Set request limit to 4.5MB
- Updated dependencies [6f2c0f5]
- Updated dependencies [a8a459a]
  - @mastra/core@0.2.0-alpha.106

## 0.1.0-alpha.56

### Patch Changes

- 246f06c: Fix import \* from telemetry package

## 0.1.0-alpha.55

### Patch Changes

- Updated dependencies [1420ae2]
- Updated dependencies [99f1847]
  - @mastra/core@0.2.0-alpha.105

## 0.1.0-alpha.54

### Patch Changes

- 5fdc87c: Update evals storage in attachListeners
- b97ca96: Tracing into default storage
- 6780223: fix workflow runId not unique per execution in dev
- 72d1990: Updated evals table schema
- Updated dependencies [5fdc87c]
- Updated dependencies [b97ca96]
- Updated dependencies [72d1990]
- Updated dependencies [cf6d825]
- Updated dependencies [10870bc]
  - @mastra/core@0.2.0-alpha.104

## 0.1.0-alpha.53

### Patch Changes

- Updated dependencies [4534e77]
  - @mastra/core@0.2.0-alpha.103

## 0.1.0-alpha.52

### Patch Changes

- Updated dependencies [a9345f9]
  - @mastra/core@0.2.0-alpha.102

## 0.1.0-alpha.51

### Patch Changes

- 4f1d1a1: Enforce types ann cleanup package.json
- Updated dependencies [66a03ec]
- Updated dependencies [4f1d1a1]
  - @mastra/core@0.2.0-alpha.101

## 0.1.0-alpha.50

### Patch Changes

- 9d1796d: Fix storage and eval serialization on api
- Updated dependencies [9d1796d]
  - @mastra/core@0.2.0-alpha.100

## 0.1.0-alpha.49

### Patch Changes

- 7d83b92: Create default storage and move evals towards it
- Updated dependencies [7d83b92]
  - @mastra/core@0.2.0-alpha.99

## 0.1.0-alpha.48

### Patch Changes

- 8aec8b7: Normalize imports to package name and dedupe while writing package.json after mastra build

## 0.1.0-alpha.47

### Patch Changes

- 70dabd9: Fix broken publish
- Updated dependencies [70dabd9]
- Updated dependencies [202d404]
  - @mastra/core@0.2.0-alpha.98

## 0.1.0-alpha.46

### Patch Changes

- 7892533: Updated test evals to use Mastra Storage
- e6d8055: Added Mastra Storage to add and query live evals
- a18e96c: Array schemas for dev tool playground
- 5950de5: Added update instructions API
- f1e3105: Now that memory can be added to an agent, the playground needs to look up memory on the agent, not on mastra. Now the playground looks up on the agent to properly access memory
- Updated dependencies [07c069d]
- Updated dependencies [7892533]
- Updated dependencies [e6d8055]
- Updated dependencies [5950de5]
- Updated dependencies [df843d3]
- Updated dependencies [a870123]
  - @mastra/core@0.2.0-alpha.97

## 0.1.0-alpha.45

### Patch Changes

- Updated dependencies [74b3078]
  - @mastra/core@0.2.0-alpha.96

## 0.1.0-alpha.44

### Patch Changes

- 9fb59d6: changeset
- Updated dependencies [9fb59d6]
  - @mastra/core@0.2.0-alpha.95

## 0.1.0-alpha.43

### Minor Changes

- 8b416d9: Breaking changes

### Patch Changes

- 9c10484: update all packages
- Updated dependencies [9c10484]
- Updated dependencies [8b416d9]
  - @mastra/core@0.2.0-alpha.94

## 0.1.0-alpha.42

### Patch Changes

- 42a2e69: Fix playground error parsing
- Updated dependencies [5285356]
  - @mastra/core@0.2.0-alpha.93

## 0.1.0-alpha.41

### Patch Changes

- 0b96376: fix pino of being null

## 0.1.0-alpha.40

### Patch Changes

- 8329f1a: Add debug env

## 0.1.0-alpha.39

### Patch Changes

- 8ea426a: Fix patch

## 0.1.0-alpha.34

### Patch Changes

- b80ea8d: Fix bundling of server

## 0.1.0-alpha.38

### Minor Changes

- 4d4f6b6: Update deployer

### Patch Changes

- Updated dependencies [4d4f6b6]
  - @mastra/core@0.2.0-alpha.92

## 0.1.0-alpha.37

### Patch Changes

- Updated dependencies [d7d465a]
- Updated dependencies [d7d465a]
- Updated dependencies [2017553]
- Updated dependencies [a10b7a3]
- Updated dependencies [16e5b04]
  - @mastra/core@0.2.0-alpha.91

## 0.1.0-alpha.36

### Patch Changes

- 82a6d53: better create-mastra tsconfig, better error for mastra server agent stream
- Updated dependencies [8151f44]
- Updated dependencies [e897f1c]
- Updated dependencies [3700be1]
  - @mastra/core@0.2.0-alpha.90

## 0.1.0-alpha.35

### Patch Changes

- Updated dependencies [27275c9]
  - @mastra/core@0.2.0-alpha.89

## 0.1.0-alpha.34

### Patch Changes

- ab01c53: Fix mastra server agent streamObject
- Updated dependencies [ccbc581]
  - @mastra/core@0.2.0-alpha.88

## 0.1.0-alpha.33

### Patch Changes

- Updated dependencies [7365b6c]
  - @mastra/core@0.2.0-alpha.87

## 0.1.0-alpha.32

### Minor Changes

- 5916f9d: Update deps from fixed to ^

### Patch Changes

- Updated dependencies [6fa4bd2]
- Updated dependencies [e2e76de]
- Updated dependencies [7f24c29]
- Updated dependencies [67637ba]
- Updated dependencies [04f3171]
  - @mastra/core@0.2.0-alpha.86

## 0.0.1-alpha.31

### Patch Changes

- c5f2d50: Split deployer package
- Updated dependencies [e9d1b47]
  - @mastra/core@0.2.0-alpha.85

## 0.0.1-alpha.30

### Patch Changes

- e27fe69: Add dir to deployer

## 0.0.1-alpha.29

### Patch Changes

- 0696eeb: Cleanup Mastra server
- 38b7f66: Update deployer logic
- Updated dependencies [2f17a5f]
- Updated dependencies [cb290ee]
- Updated dependencies [b4d7416]
- Updated dependencies [38b7f66]
  - @mastra/core@0.2.0-alpha.84

## 0.0.1-alpha.28

### Patch Changes

- 2ab57d6: Fix: Workflows require a trigger schema otherwise it fails to run in dev
- 9625602: Use mastra core splitted bundles in other packages
- Updated dependencies [30322ce]
- Updated dependencies [78eec7c]
- Updated dependencies [9625602]
- Updated dependencies [8769a62]
  - @mastra/core@0.2.0-alpha.83

## 0.0.1-alpha.27

### Patch Changes

- 73d112c: Core and deployer fixes
- ac8c61a: Mastra server vector operations
- Updated dependencies [73d112c]
  - @mastra/core@0.1.27-alpha.82

## 0.0.1-alpha.26

### Patch Changes

- Updated dependencies [9fb3039]
  - @mastra/core@0.1.27-alpha.81

## 0.0.1-alpha.25

### Patch Changes

- Updated dependencies [327ece7]
  - @mastra/core@0.1.27-alpha.80

## 0.0.1-alpha.24

### Patch Changes

- Updated dependencies [21fe536]
  - @mastra/core@0.1.27-alpha.79

## 0.0.1-alpha.23

### Patch Changes

- 88f18d7: Update cors support

## 0.0.1-alpha.22

### Patch Changes

- 685108a: Remove syncs and excess rag
- 685108a: Removing mastra syncs
- Updated dependencies [685108a]
- Updated dependencies [685108a]
  - @mastra/core@0.1.27-alpha.78

## 0.0.1-alpha.21

### Patch Changes

- cfb966f: Deprecate @mastra/tts for mastra speech providers
- Updated dependencies [8105fae]
  - @mastra/core@0.1.27-alpha.77

## 0.0.1-alpha.20

### Patch Changes

- ae7bf94: Fix loggers messing up deploys
- ae7bf94: Changeset
- Updated dependencies [ae7bf94]
- Updated dependencies [ae7bf94]
  - @mastra/core@0.1.27-alpha.76

## 0.0.1-alpha.19

### Patch Changes

- 7064554: deployer fixes
- Updated dependencies [23dcb23]
  - @mastra/core@0.1.27-alpha.75

## 0.0.1-alpha.18

### Patch Changes

- Updated dependencies [7b87567]
  - @mastra/core@0.1.27-alpha.74

## 0.0.1-alpha.17

### Patch Changes

- Updated dependencies [3427b95]
  - @mastra/core@0.1.27-alpha.73

## 0.0.1-alpha.16

### Patch Changes

- e4d4ede: Better setLogger()
- Updated dependencies [e4d4ede]
- Updated dependencies [06b2c0a]
  - @mastra/core@0.1.27-alpha.72

## 0.0.1-alpha.15

### Patch Changes

- d9c8dd0: Logger changes for default transports
- Updated dependencies [d9c8dd0]
  - @mastra/core@0.1.27-alpha.71

## 0.0.1-alpha.14

### Patch Changes

- ad2cd74: Deploy fix

## 0.0.1-alpha.13

### Patch Changes

- a1774e7: Improve bundling

## 0.0.1-alpha.12

### Patch Changes

- 28dceab: Catch apiKey error in dev

## 0.0.1-alpha.11

### Patch Changes

- bdaf834: publish packages

## 0.0.1-alpha.10

### Patch Changes

- Updated dependencies [dd6d87f]
- Updated dependencies [04434b6]
  - @mastra/core@0.1.27-alpha.70

## 0.0.1-alpha.9

### Patch Changes

- 9066f95: CF deployer fixes

## 0.0.1-alpha.8

### Patch Changes

- b425845: Logger and execa logs

## 0.0.1-alpha.7

### Patch Changes

- 1944807: Unified logger and major step in better logs
- 9ade36e: Changed measure for evals, added endpoints, attached metrics to agent, added ui for evals in playground, and updated docs
- Updated dependencies [1944807]
- Updated dependencies [9ade36e]
  - @mastra/core@0.1.27-alpha.69

## 0.0.1-alpha.6

### Patch Changes

- 291fe57: mastra openapi, swagger ui, dynamic servers
- 1a41fbf: Fix playground workflow triggerData on execution

## 0.0.1-alpha.5

### Patch Changes

- Updated dependencies [0be7181]
- Updated dependencies [0be7181]
  - @mastra/core@0.1.27-alpha.68

## 0.0.1-alpha.4

### Patch Changes

- 7babd5c: CLI build and other

## 0.0.1-alpha.3

### Patch Changes

- a291824: Deployer fixes
- Updated dependencies [c8ff2f5]
  - @mastra/core@0.1.27-alpha.67

## 0.0.1-alpha.2

### Patch Changes

- a9b5ddf: Publish new versions
- 72c280b: Fixes

## 0.0.1-alpha.0

### Patch Changes

- 4139b43: Deployer utils
- a5604c4: Deployer initial
