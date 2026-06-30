---
name: codeowners
description: >
  Maps every code path in the Mastra monorepo to exactly two reviewers (GitHub handles).
  Use this resource to determine who to tag for PR reviews. For a changed file, find the
  longest matching path prefix in the tables below. The two handles on that row are the
  reviewers. owner_1 is the primary expert, owner_2 is the secondary expert.
---

# CODEOWNERS

Given a file path from a PR diff, look up the two reviewers to tag.

## How to use

1. Take each changed file path from the PR diff.
2. Find the **longest matching path prefix** in the tables below.
3. Return `owner_1` and `owner_2` from that row.
4. If no deep path matches, walk up to the parent path.
5. Never guess or infer owners — only return handles found in this file.

## What NOT to do

- Do NOT assign reviewers who are not listed in this file.
- Do NOT use the Handle Directory table to guess ownership — it is only a name lookup.
- Do NOT assign both owners from a parent path if a more specific child path matches.
- Do NOT split a single file across two different path matches — one file = one path match.

## Handle Directory

Use this table only to resolve a handle to a human name. Do NOT use it to determine ownership.

| handle | name |
|---|---|
| @abhiaiyer91 | Abhi Aiyer |
| @TylerBarnes | Tyler Barnes |
| @wardpeet | Ward Peeters |
| @TheIsrael1 | Ehindero Israel |
| @NikAiyer | NikAiyer |
| @DanielSLew | Daniel Lew |
| @rase- | Tony Kovanen |
| @rphansen91 | Ryan Hansen |
| @epinzur | Eric Pinzur |
| @taofeeq-deru | Taofeeq Oluderu |
| @CalebBarnes | Caleb Barnes |
| @YujohnNattrass | YujohnNattrass |
| @mfrachet | Marvin Frachet |
| @damien-schneider | Damien Schneider |
| @LekoArts | Lennart |
| @junydania | OJ |
| @intojhanurag | Anurag Ojha |
| @graysonhicks | Grayson Hicks |
| @greglobinski | Greg Lobinski |
| @smthomas | Shane Thomas |
| @roaminro | Roamin |

## Path to Owners

Longest matching path prefix wins. All paths end with `/` to indicate directories.

### packages/core/src/

| path | owner_1 | owner_2 |
|---|---|---|
| packages/core/src/agent/ | @TylerBarnes | @CalebBarnes |
| packages/core/src/agent/durable/ | @taofeeq-deru | @TylerBarnes |
| packages/core/src/agent/heartbeat/ | @CalebBarnes | @TylerBarnes |
| packages/core/src/agent/message-list/ | @TylerBarnes | @roaminro |
| packages/core/src/agent/save-queue/ | @NikAiyer | @wardpeet |
| packages/core/src/agent/workflows/ | @TylerBarnes | @wardpeet |
| packages/core/src/agent-builder/ | @NikAiyer | @DanielSLew |
| packages/core/src/agent-controller/ | @abhiaiyer91 | @wardpeet |
| packages/core/src/a2a/ | @TheIsrael1 | @wardpeet |
| packages/core/src/action/ | @abhiaiyer91 | @wardpeet |
| packages/core/src/auth/ | @graysonhicks | @YujohnNattrass |
| packages/core/src/background-tasks/ | @taofeeq-deru | @wardpeet |
| packages/core/src/browser/ | @NikAiyer | @TylerBarnes |
| packages/core/src/browser/recording/ | @DanielSLew | @NikAiyer |
| packages/core/src/bundler/ | @wardpeet | @LekoArts |
| packages/core/src/cache/ | @abhiaiyer91 | @rase- |
| packages/core/src/channels/ | @CalebBarnes | @intojhanurag |
| packages/core/src/datasets/ | @YujohnNattrass | @DanielSLew |
| packages/core/src/deployer/ | @wardpeet | @abhiaiyer91 |
| packages/core/src/di/ | @DanielSLew | @abhiaiyer91 |
| packages/core/src/editor/ | @DanielSLew | @NikAiyer |
| packages/core/src/error/ | @wardpeet | @NikAiyer |
| packages/core/src/evals/ | @epinzur | @intojhanurag |
| packages/core/src/events/ | @rase- | @TylerBarnes |
| packages/core/src/features/ | @TylerBarnes | @epinzur |
| packages/core/src/harness/ | @TylerBarnes | @abhiaiyer91 |
| packages/core/src/hooks/ | @NikAiyer | @abhiaiyer91 |
| packages/core/src/integration/ | @abhiaiyer91 | @wardpeet |
| packages/core/src/license/ | @junydania | @abhiaiyer91 |
| packages/core/src/llm/ | @wardpeet | @TylerBarnes |
| packages/core/src/llm/model/aisdk/ | @wardpeet | @TylerBarnes |
| packages/core/src/llm/model/gateways/ | @TylerBarnes | @wardpeet |
| packages/core/src/logger/ | @abhiaiyer91 | @wardpeet |
| packages/core/src/loop/ | @CalebBarnes | @TylerBarnes |
| packages/core/src/loop/network/ | @NikAiyer | @wardpeet |
| packages/core/src/mastra/ | @DanielSLew | @NikAiyer |
| packages/core/src/mcp/ | @graysonhicks | @wardpeet |
| packages/core/src/memory/ | @TylerBarnes | @DanielSLew |
| packages/core/src/notifications/ | @TylerBarnes | @CalebBarnes |
| packages/core/src/observability/ | @epinzur | @intojhanurag |
| packages/core/src/processor-provider/ | @wardpeet | @epinzur |
| packages/core/src/processors/ | @TylerBarnes | @wardpeet |
| packages/core/src/relevance/ | @CalebBarnes | @NikAiyer |
| packages/core/src/request-context/ | @DanielSLew | @abhiaiyer91 |
| packages/core/src/run/ | @epinzur | @intojhanurag |
| packages/core/src/schema/ | @wardpeet | @epinzur |
| packages/core/src/server/ | @rphansen91 | @intojhanurag |
| packages/core/src/signals/ | @TylerBarnes | @abhiaiyer91 |
| packages/core/src/skills/ | @abhiaiyer91 | @wardpeet |
| packages/core/src/storage/ | @DanielSLew | @epinzur |
| packages/core/src/storage/domains/background-tasks/ | @taofeeq-deru | @wardpeet |
| packages/core/src/storage/domains/blobs/ | @DanielSLew | @NikAiyer |
| packages/core/src/storage/domains/channels/ | @CalebBarnes | @intojhanurag |
| packages/core/src/storage/domains/datasets/ | @YujohnNattrass | @DanielSLew |
| packages/core/src/storage/domains/experiments/ | @YujohnNattrass | @DanielSLew |
| packages/core/src/storage/domains/favorites/ | @NikAiyer | @DanielSLew |
| packages/core/src/storage/domains/harness/ | @wardpeet | @TylerBarnes |
| packages/core/src/storage/domains/mcp-clients/ | @DanielSLew | @NikAiyer |
| packages/core/src/storage/domains/mcp-servers/ | @DanielSLew | @NikAiyer |
| packages/core/src/storage/domains/notifications/ | @TylerBarnes | @CalebBarnes |
| packages/core/src/storage/domains/observability/ | @epinzur | @intojhanurag |
| packages/core/src/storage/domains/prompt-blocks/ | @DanielSLew | @NikAiyer |
| packages/core/src/storage/domains/scorer-definitions/ | @DanielSLew | @NikAiyer |
| packages/core/src/storage/domains/skills/ | @DanielSLew | @NikAiyer |
| packages/core/src/storage/domains/tool-provider-connections/ | @YujohnNattrass | @NikAiyer |
| packages/core/src/storage/domains/workspaces/ | @DanielSLew | @NikAiyer |
| packages/core/src/storage/providers/ | @DanielSLew | @NikAiyer |
| packages/core/src/stream/ | @taofeeq-deru | @wardpeet |
| packages/core/src/telemetry/ | @epinzur | @intojhanurag |
| packages/core/src/tool-loop-agent/ | @CalebBarnes | @wardpeet |
| packages/core/src/tool-provider/ | @DanielSLew | @YujohnNattrass |
| packages/core/src/tools/ | @wardpeet | @abhiaiyer91 |
| packages/core/src/tools/tool-builder/ | @DanielSLew | @wardpeet |
| packages/core/src/tts/ | @wardpeet | @abhiaiyer91 |
| packages/core/src/utils/ | @wardpeet | @NikAiyer |
| packages/core/src/vector/ | @intojhanurag | @NikAiyer |
| packages/core/src/voice/ | @wardpeet | @LekoArts |
| packages/core/src/voice/aisdk/ | @wardpeet | @abhiaiyer91 |
| packages/core/src/worker/ | @rase- | @NikAiyer |
| packages/core/src/workflows/ | @rase- | @taofeeq-deru |
| packages/core/src/workflows/scheduler/ | @abhiaiyer91 | @rase- |
| packages/core/src/workspace/ | @CalebBarnes | @NikAiyer |
| packages/core/src/workspace/sandbox/process-manager/ | @CalebBarnes | @NikAiyer |

### packages/

| path | owner_1 | owner_2 |
|---|---|---|
| packages/core/ | @abhiaiyer91 | @wardpeet |
| packages/cli/ | @LekoArts | @wardpeet |
| packages/create-mastra/ | @wardpeet | @TheIsrael1 |
| packages/memory/ | @TylerBarnes | @wardpeet |
| packages/memory/src/processors/observational-memory/ | @TylerBarnes | @rase- |
| packages/memory/src/processors/working-memory-state/ | @CalebBarnes | @TylerBarnes |
| packages/evals/ | @epinzur | @intojhanurag |
| packages/evals/src/scorers/ | @YujohnNattrass | @wardpeet |
| packages/evals/src/scorers/llm/trajectory/ | @DanielSLew | @YujohnNattrass |
| packages/evals/src/scorers/code/trajectory/ | @DanielSLew | @YujohnNattrass |
| packages/rag/ | @wardpeet | @NikAiyer |
| packages/mcp/ | @wardpeet | @graysonhicks |
| packages/mcp/src/server/ | @DanielSLew | @wardpeet |
| packages/mcp/src/client/ | @DanielSLew | @wardpeet |
| packages/mcp/src/shared/ | @graysonhicks | @roaminro |
| packages/server/ | @DanielSLew | @NikAiyer |
| packages/server/src/a2a/ | @abhiaiyer91 | @DanielSLew |
| packages/server/src/auth/ | @NikAiyer | @DanielSLew |
| packages/server/src/schemas/ | @rase- | @DanielSLew |
| packages/server/src/server-adapter/ | @rase- | @DanielSLew |
| packages/playground/ | @mfrachet | @damien-schneider |
| packages/playground/src/pages/agents/ | @mfrachet | @DanielSLew |
| packages/playground/src/pages/cms/ | @mfrachet | @DanielSLew |
| packages/playground/src/pages/evaluation/ | @DanielSLew | @mfrachet |
| packages/playground/src/pages/experiments/ | @DanielSLew | @mfrachet |
| packages/playground/src/pages/processors/ | @greglobinski | @damien-schneider |
| packages/playground/src/pages/prompt-blocks/ | @damien-schneider | @greglobinski |
| packages/playground/src/pages/resources/ | @DanielSLew | @mfrachet |
| packages/playground/src/pages/login/ | @rphansen91 | @damien-schneider |
| packages/playground/src/pages/signup/ | @rphansen91 | @damien-schneider |
| packages/playground/src/pages/metrics/ | @greglobinski | @damien-schneider |
| packages/playground/src/pages/traces/ | @greglobinski | @damien-schneider |
| packages/playground/src/pages/logs/ | @greglobinski | @damien-schneider |
| packages/playground/src/pages/datasets/ | @greglobinski | @damien-schneider |
| packages/playground/src/pages/workspace/ | @damien-schneider | @NikAiyer |
| packages/playground/src/pages/integrations/ | @YujohnNattrass | @damien-schneider |
| packages/playground-ui/ | @mfrachet | @damien-schneider |
| packages/playground-ui/src/domains/metrics/ | @greglobinski | @intojhanurag |
| packages/playground-ui/src/domains/traces/ | @greglobinski | @damien-schneider |
| packages/playground-ui/src/domains/logs/ | @greglobinski | @damien-schneider |
| packages/playground-ui/src/utils/ | @damien-schneider | @mfrachet |
| packages/playground-ui/src/lib/env-file/ | @damien-schneider | @mfrachet |
| packages/deployer/ | @wardpeet | @NikAiyer |
| packages/editor/ | @DanielSLew | @wardpeet |
| packages/editor/src/ee/ | @YujohnNattrass | @DanielSLew |
| packages/agent-builder/ | @wardpeet | @abhiaiyer91 |
| packages/agent-builder/src/workflows/workflow-builder/ | @DanielSLew | @wardpeet |
| packages/auth/ | @rphansen91 | @wardpeet |
| packages/acp/ | @wardpeet | @TylerBarnes |
| packages/loggers/ | @wardpeet | @abhiaiyer91 |
| packages/fastembed/ | @TylerBarnes | @wardpeet |
| packages/mcp-docs-server/ | @TylerBarnes | @wardpeet |
| packages/mcp-registry-registry/ | @abhiaiyer91 | @wardpeet |
| packages/codemod/ | @LekoArts | @wardpeet |
| packages/schema-compat/ | @wardpeet | @DanielSLew |
| packages/_changeset-cli/ | @wardpeet | @LekoArts |
| packages/_config/ | @wardpeet | @TylerBarnes |
| packages/_external-types/ | @NikAiyer | @wardpeet |
| packages/_internal-core/ | @epinzur | @intojhanurag |
| packages/_internals/ | @wardpeet | @abhiaiyer91 |
| packages/_llm-recorder/ | @wardpeet | @abhiaiyer91 |
| packages/_test-utils/ | @wardpeet | @TylerBarnes |
| packages/_types-builder/ | @wardpeet | @TylerBarnes |
| packages/_vendored/ | @wardpeet | @CalebBarnes |

### stores/

| path | owner_1 | owner_2 |
|---|---|---|
| stores/pg/ | @DanielSLew | @NikAiyer |
| stores/upstash/ | @NikAiyer | @wardpeet |
| stores/astra/ | @wardpeet | @NikAiyer |
| stores/chroma/ | @wardpeet | @NikAiyer |
| stores/pinecone/ | @wardpeet | @NikAiyer |
| stores/qdrant/ | @wardpeet | @NikAiyer |
| stores/vectorize/ | @wardpeet | @NikAiyer |
| stores/clickhouse/ | @NikAiyer | @epinzur |
| stores/cloudflare/ | @NikAiyer | @wardpeet |
| stores/cloudflare-d1/ | @NikAiyer | @wardpeet |
| stores/convex/ | @NikAiyer | @wardpeet |
| stores/couchbase/ | @wardpeet | @NikAiyer |
| stores/dsql/ | @TylerBarnes | @wardpeet |
| stores/duckdb/ | @epinzur | @wardpeet |
| stores/dynamodb/ | @NikAiyer | @wardpeet |
| stores/elasticsearch/ | @wardpeet | @NikAiyer |
| stores/lance/ | @NikAiyer | @wardpeet |
| stores/libsql/ | @DanielSLew | @NikAiyer |
| stores/mongodb/ | @DanielSLew | @NikAiyer |
| stores/mssql/ | @NikAiyer | @wardpeet |
| stores/mysql/ | @NikAiyer | @wardpeet |
| stores/opensearch/ | @wardpeet | @NikAiyer |
| stores/redis/ | @wardpeet | @NikAiyer |
| stores/s3vectors/ | @wardpeet | @NikAiyer |
| stores/spanner/ | @NikAiyer | @wardpeet |
| stores/turbopuffer/ | @wardpeet | @NikAiyer |

### deployers/

| path | owner_1 | owner_2 |
|---|---|---|
| deployers/vercel/ | @wardpeet | @abhiaiyer91 |
| deployers/cloudflare/ | @wardpeet | @TheIsrael1 |
| deployers/netlify/ | @wardpeet | @abhiaiyer91 |
| deployers/cloud/ | @wardpeet | @YujohnNattrass |

### observability/

| path | owner_1 | owner_2 |
|---|---|---|
| observability/langfuse/ | @epinzur | @intojhanurag |
| observability/braintrust/ | @epinzur | @intojhanurag |
| observability/otel-exporter/ | @epinzur | @intojhanurag |
| observability/mastra/ | @epinzur | @intojhanurag |
| observability/otel-bridge/ | @epinzur | @intojhanurag |
| observability/clickhouse-design/ | @epinzur | @intojhanurag |
| observability/langsmith/ | @epinzur | @intojhanurag |
| observability/arize/ | @epinzur | @intojhanurag |
| observability/datadog/ | @epinzur | @intojhanurag |
| observability/posthog/ | @epinzur | @intojhanurag |
| observability/laminar/ | @epinzur | @intojhanurag |
| observability/sentry/ | @epinzur | @intojhanurag |
| observability/arthur/ | @epinzur | @intojhanurag |

### server-adapters/

| path | owner_1 | owner_2 |
|---|---|---|
| server-adapters/express/ | @NikAiyer | @wardpeet |
| server-adapters/hono/ | @NikAiyer | @wardpeet |
| server-adapters/fastify/ | @wardpeet | @roaminro |
| server-adapters/koa/ | @wardpeet | @roaminro |
| server-adapters/nestjs/ | @wardpeet | @roaminro |
| server-adapters/next/ | @abhiaiyer91 | @wardpeet |
| server-adapters/tanstack-start/ | @abhiaiyer91 | @wardpeet |

### auth/

| path | owner_1 | owner_2 |
|---|---|---|
| auth/supabase/ | @wardpeet | @rphansen91 |
| auth/firebase/ | @wardpeet | @rphansen91 |
| auth/auth0/ | @wardpeet | @rphansen91 |
| auth/workos/ | @wardpeet | @rphansen91 |
| auth/clerk/ | @wardpeet | @rphansen91 |
| auth/okta/ | @wardpeet | @rphansen91 |
| auth/cloud/ | @wardpeet | @rphansen91 |
| auth/studio/ | @rphansen91 | @wardpeet |
| auth/better-auth/ | @wardpeet | @rphansen91 |
| auth/google/ | @graysonhicks | @wardpeet |
| auth/neon/ | @rphansen91 | @wardpeet |

### browser/

| path | owner_1 | owner_2 |
|---|---|---|
| browser/agent-browser/ | @NikAiyer | @wardpeet |
| browser/stagehand/ | @NikAiyer | @TylerBarnes |
| browser/browser-viewer/ | @NikAiyer | @TylerBarnes |
| browser/firecrawl/ | @NikAiyer | @abhiaiyer91 |

### agent-sdks/

| path | owner_1 | owner_2 |
|---|---|---|
| agent-sdks/acp/ | @wardpeet | @LekoArts |
| agent-sdks/claude/ | @TheIsrael1 | @LekoArts |
| agent-sdks/cursor/ | @TheIsrael1 | @LekoArts |
| agent-sdks/openai/ | @TheIsrael1 | @abhiaiyer91 |

### client-sdks/

| path | owner_1 | owner_2 |
|---|---|---|
| client-sdks/client-js/ | @DanielSLew | @mfrachet |
| client-sdks/ai-sdk/ | @TheIsrael1 | @wardpeet |
| client-sdks/react/ | @mfrachet | @TylerBarnes |

### pubsub/

| path | owner_1 | owner_2 |
|---|---|---|
| pubsub/google-cloud-pubsub/ | @wardpeet | @NikAiyer |
| pubsub/redis-streams/ | @rase- | @taofeeq-deru |

### Other satellites

| path | owner_1 | owner_2 |
|---|---|---|
| channels/slack/ | @CalebBarnes | @TylerBarnes |
| signals/github/ | @TylerBarnes | @abhiaiyer91 |
| embedders/voyageai/ | @TylerBarnes | @wardpeet |
| integrations/brightdata/ | @abhiaiyer91 | @wardpeet |
| integrations/opencode/ | @wardpeet | @abhiaiyer91 |
| integrations/perplexity/ | @wardpeet | @TylerBarnes |
| integrations/tavily/ | @abhiaiyer91 | @wardpeet |
| ee/ | @rphansen91 | @graysonhicks |

### docs/

| path | owner_1 | owner_2 |
|---|---|---|
| docs/ | @LekoArts | @TylerBarnes |
| docs/src/course/ | @LekoArts | @NikAiyer |
| docs/src/components/ | @LekoArts | @YujohnNattrass |
| docs/src/plugins/ | @LekoArts | @wardpeet |
| docs/styleguides/ | @LekoArts | @wardpeet |

### Infrastructure

| path | owner_1 | owner_2 |
|---|---|---|
| e2e-tests/ | @wardpeet | @LekoArts |
| scripts/ | @wardpeet | @LekoArts |
| templates/ | @LekoArts | @taofeeq-deru |
| explorations/ | @TylerBarnes | @abhiaiyer91 |
| mastracode/ | @TylerBarnes | @abhiaiyer91 |
