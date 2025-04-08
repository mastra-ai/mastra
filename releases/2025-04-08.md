Today we release a new latest version of Mastra. There are several issues lurking we are trying to figure out around the clock right now.

Top issues:

- MCP rough edges, unable to connect, failures in IDEs (if you're around discord a lot you know)
- Memory default embedder "fastembedjs" breaks in certain execution environnments
- Deployers
- Improving Documentation on Memory and MCP/Tools

As for the release itself there is good stuff. Since this our first official release-channel comm, if you want to give feedback on how to better improve it, let me know!

**To take advantage of this release please install all modules @latest.**

Here's the changes

## Getting Started

- Fix example workflow in getting started (#3473)

## Playground

- Fix scroll issue on playground tools page (#3489)
- Add our new design system to the playground (#3482)
- Fix playground freezing when buffer is passed between steps (#3484)
- Ability to configure llm settings from playground (#3454)
- Fix workflow sidebar not expanding the output section (#3447)
- Cleanup playground dynamic form (#3449)
- Leverage autoform for playground dynamic form (#3427)

- Show "No Input" for empty workflow steps (#2696)
- Nested workflows rendering in dev playground (#3408)

## CLI

- Set disablegeoip to false in getsystemproperties (#3481)
- Fix CLI build command to use correct Mastra directory structure (#3435)

## Storage / Vectors

- Cloudflare kv support (#2642)
- Update error message for upsert operations (#3300)
- Check Vectorize index Existence (#3470)
- Add missing getTraces method to Upstash (#3472)
- Update Chroma version and add specific tests (#3471)
- Support missing getEvalsByAgentName method in pg and upstash (#3415)
- Update storage initialization and add underscore methods (#3433)
- Move to batch insert for memory management (#3422)
- Add missing ssl property postgres config (#3399)
- Clickhouse storage (#3351)
- Clickhouse ttl configs (#3397)

## Memory

- Add performance testing suite for memory (#3457)
- Fix memory semantic recall performance and bundle size (#3419)
- Fix crash when parsing invalid JSON in memory messages (#3280)
- Use markdown formatting instead of XML inside working memory tags (#3396)
- Add resourceId to memory metadata (#3266)
- Memory processors (#3304)

## Agents

- Fix fastembed (#3455) <- Still present on latest. NOT FIXED.
- Add defaultGenerateOptions/defaultStreamOptions to Agent constructor (#3143)

## Workflows

- Fix if-else execution (#3428)
- Fix hanging and excessive execution (#3253)
- Unify start and watch results (#3282)
- Make runId optional for workflow startAsync api (#3405)
- Fix compound subscribers edge case (#3406)
- Loop Variables (#3414)
- GetWorkflows API (#3350)
- Accept unique id on step config (#3316)

## Client SDK

- Update ai sdk to ^4.2.2 (#3244)
- Remove x-mastra-client-type custom header from mastraClient (#3469)

## Mastra Server / Deployers

- Make timeout 30s (#3422)
- Decouple handlers from Hono (#3294)
- Mastra custom API Routes (#3308)
- Fix deployer server (#3468) <- Caused more issues (still present on latest)
- Add missing triggerData to the openapi.json for the POST /api/workflow/{workflowId}/start endpoint (#3263)
- Add Cloudflare Worker environment variable auto-population (#3439)
- Support port and server timeouts (#3395)
- Vercel deployer fix attempt (#3340) <-- (still present on latest)

## Voice

- Voice method references (#3388)
- Change listenProvider and speakProvider to input and output (#3343)
- Update voice dependencies (#3261)
- Default agent voice (#3344)

## Evals

- Modified evaluation to include output (#3353)

## CI / Tests

- Update babel monorepo (#3225)
- Remove non-package from changeset (#3346)
- Update tests to ensure collection is empty (#3313)

## Observability

- Disable instrumentation if inside web container (#3410)
- Fix error on traces page (#3466)
- Fix tracing and add dual tracing support (#3453)
- Exclude more methods from tracing (#3305)
- Add request id to traces (#3342)
