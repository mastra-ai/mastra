# AI SDK v5 Revert Investigation

## Problem Statement
Tests that run in 5-7 minutes on `main` are taking 10+ minutes and timing out at 500s on the revert branch. This indicates a real performance issue with the code changes, not a test configuration issue.

## Branch Information
- **Current Branch**: `revert-8687-chore/core/swap-aiv5-ai-package-naming`
- **Original v5 PR**: #8687 (merged at commit `59d036d4c2706b430b0e3f1f1e0ee853ce16ca04`)
- **Revert PR**: #8730

## Investigation Steps

### Step 1: Identify All Changed Files Since Original v5 PR

Gathering all commits and files changed on `main` since the original v5 PR was merged...

## All Commits and Files Changed Since Original v5 PR

### Commit: b2da66cca2
**Message**: tests: improve e2e tests (#8766)

**Files changed**:
- e2e-tests/kitchen-sink/template/package.json
- e2e-tests/kitchen-sink/template/src/mastra/agents/index.ts
- e2e-tests/kitchen-sink/tests/agents.$agentId.spec.ts
- e2e-tests/kitchen-sink/tests/agents.$agentId.spec.ts-snapshots/overall-layout-information-1.aria.yml
- e2e-tests/kitchen-sink/tests/agents.spec.ts
- examples/agent/src/mastra/agents/model-v2-agent.ts
- packages/playground-ui/package.json
- packages/playground-ui/src/components/assistant-ui/tools/badges/agent-badge.tsx
- packages/playground-ui/src/components/assistant-ui/tools/badges/badge-wrapper.tsx
- packages/playground-ui/src/components/assistant-ui/tools/badges/tool-badge.tsx
- packages/playground-ui/src/components/assistant-ui/tools/badges/workflow-badge.tsx
- packages/playground-ui/src/domains/agents/components/agent-metadata/agent-metadata-model-switcher.tsx
- packages/playground-ui/src/domains/agents/components/agent-metadata/agent-metadata.tsx
- packages/playground-ui/src/domains/agents/utils/__tests__/extractPrompt.test.ts
- packages/playground/src/hooks/use-memory.ts
- pnpm-lock.yaml

### Commit: 5176e5ebe1
**Message**: docs: Undo disable transformerNotationDiff

**Files changed**:
- docs/next.config.mjs

### Commit: b882c66731
**Message**: docs: fix prettier issues

**Files changed**:
- docs/config/redirects.mjs
- docs/src/content/en/reference/scorers/_meta.ts

### Commit: 8384e1c368
**Message**: docs: fix build issues

**Files changed**:
- docs/src/components/nextra-layout.tsx
- docs/src/content/en/examples/_meta.tsx

### Commit: 364aabc058
**Message**: docs: Move Snapshots to under Workflows

**Files changed**:
- docs/config/redirects.mjs
- docs/src/content/en/docs/server-db/_meta.ts
- docs/src/content/en/docs/workflows/_meta.tsx
- docs/src/content/en/docs/workflows/snapshots.mdx

### Commit: c36307e59b
**Message**: docs: Make the subfolders not seem nested under previous item

**Files changed**:
- docs/src/app/globals.css

### Commit: baf1834630
**Message**: docs: Change choose deployment option order

**Files changed**:
- docs/src/content/en/docs/deployment/overview.mdx

### Commit: a2122d79cb
**Message**: docs: Remove Add Workflow example page

**Files changed**:
- docs/config/redirects.mjs
- docs/src/content/en/examples/agents/_meta.ts
- docs/src/content/en/examples/agents/using-a-workflow.mdx

### Commit: 2a04d3d891
**Message**: docs: Remove Add Tool example page

**Files changed**:
- docs/config/redirects.mjs
- docs/src/content/en/examples/agents/_meta.ts
- docs/src/content/en/examples/agents/using-a-tool.mdx

### Commit: 8485296c0b
**Message**: docs: Remove unnecessary section Compatibility Layer for Tool Schemas

**Files changed**:
- docs/src/content/en/docs/tools-mcp/overview.mdx

### Commit: 49128b9373
**Message**: docs: Rename 'from curl' to 'Using HTTP or curl'

**Files changed**:
- docs/src/content/en/examples/agents/calling-agents.mdx

### Commit: 2f65a98de2
**Message**: docs: Remove unnecessary CLI example for Mastra client

**Files changed**:
- docs/src/content/en/examples/agents/calling-agents.mdx

### Commit: b2f18a74db
**Message**: docs: Move Evals to under Scorers

**Files changed**:
- docs/config/redirects.mjs
- docs/src/content/en/docs/_meta.tsx
- docs/src/content/en/docs/scorers/_meta.ts
- docs/src/content/en/docs/scorers/evals-old-api/_meta.ts
- docs/src/content/en/docs/scorers/evals-old-api/custom-eval.mdx
- docs/src/content/en/docs/scorers/evals-old-api/overview.mdx
- docs/src/content/en/docs/scorers/evals-old-api/running-in-ci.mdx
- docs/src/content/en/docs/scorers/evals-old-api/textual-evals.mdx

### Commit: ae721ffa3c
**Message**: docs: Collapse examples categories by default except Getting Started

**Files changed**:
- docs/src/components/nextra-layout.tsx

### Commit: 0aa0ce8109
**Message**: docs: Remove Tools RuntimeContext page

**Files changed**:
- docs/config/redirects.mjs
- docs/src/content/en/docs/server-db/runtime-context.mdx
- docs/src/content/en/docs/tools-mcp/_meta.ts
- docs/src/content/en/docs/tools-mcp/runtime-context.mdx

### Commit: 4ad8ab7bbe
**Message**: docs: Improve scorers overview

**Files changed**:
- docs/src/content/en/docs/scorers/overview.mdx

### Commit: 5df5a7cfe7
**Message**: docs: Move scorer examples to API reference

**Files changed**:
- docs/config/redirects.mjs
- docs/src/content/en/docs/scorers/custom-scorers.mdx
- docs/src/content/en/examples/_meta.tsx
- docs/src/content/en/examples/scorers/_meta.ts
- docs/src/content/en/examples/scorers/answer-relevancy.mdx
- docs/src/content/en/examples/scorers/answer-similarity.mdx
- docs/src/content/en/examples/scorers/bias.mdx
- docs/src/content/en/examples/scorers/completeness.mdx
- docs/src/content/en/examples/scorers/content-similarity.mdx
- docs/src/content/en/examples/scorers/context-precision.mdx
- docs/src/content/en/examples/scorers/context-relevance.mdx
- docs/src/content/en/examples/scorers/custom-scorer.mdx
- docs/src/content/en/examples/scorers/faithfulness.mdx
- docs/src/content/en/examples/scorers/hallucination.mdx
- docs/src/content/en/examples/scorers/keyword-coverage.mdx
- docs/src/content/en/examples/scorers/noise-sensitivity.mdx
- docs/src/content/en/examples/scorers/prompt-alignment.mdx
- docs/src/content/en/examples/scorers/textual-difference.mdx
- docs/src/content/en/examples/scorers/tone-consistency.mdx
- docs/src/content/en/examples/scorers/tool-call-accuracy.mdx
- docs/src/content/en/examples/scorers/toxicity.mdx
- docs/src/content/en/reference/scorers/_meta.ts
- docs/src/content/en/reference/scorers/answer-relevancy.mdx
- docs/src/content/en/reference/scorers/answer-similarity.mdx
- docs/src/content/en/reference/scorers/bias.mdx
- docs/src/content/en/reference/scorers/completeness.mdx
- docs/src/content/en/reference/scorers/content-similarity.mdx
- docs/src/content/en/reference/scorers/context-precision.mdx
- docs/src/content/en/reference/scorers/context-relevance.mdx
- docs/src/content/en/reference/scorers/faithfulness.mdx
- docs/src/content/en/reference/scorers/hallucination.mdx
- docs/src/content/en/reference/scorers/keyword-coverage.mdx
- docs/src/content/en/reference/scorers/noise-sensitivity.mdx
- docs/src/content/en/reference/scorers/prompt-alignment.mdx
- docs/src/content/en/reference/scorers/textual-difference.mdx
- docs/src/content/en/reference/scorers/tone-consistency.mdx
- docs/src/content/en/reference/scorers/tool-call-accuracy.mdx
- docs/src/content/en/reference/scorers/toxicity.mdx

### Commit: 23c5db0c7b
**Message**: docs: Remove duplicate examples in Examples > Deployment

**Files changed**:
- docs/config/redirects.mjs
- docs/src/content/en/examples/_meta.tsx
- docs/src/content/en/examples/deployment/_meta.ts
- docs/src/content/en/examples/deployment/auth-middleware.mdx
- docs/src/content/en/examples/deployment/cors-middleware.mdx
- docs/src/content/en/examples/deployment/custom-api-route.mdx
- docs/src/content/en/examples/deployment/deploying-mastra-server.mdx
- docs/src/content/en/examples/deployment/index.mdx
- docs/src/content/en/examples/deployment/logging-middleware.mdx

### Commit: 8dd019df43
**Message**: docs: Collapse examples categories by default

**Files changed**:
- docs/src/content/en/examples/_meta.tsx
- docs/src/content/en/examples/rag/_meta.ts
- docs/src/content/en/examples/scorers/_meta.ts

### Commit: aa80cfa5e1
**Message**: docs: Combine /adding-voice-capabilities and /docs/agents/adding-voice

**Files changed**:
- docs/config/redirects.mjs
- docs/next.config.mjs
- docs/src/content/en/docs/agents/adding-voice.mdx
- docs/src/content/en/examples/agents/_meta.ts
- docs/src/content/en/examples/agents/adding-voice-capabilities.mdx

### Commit: df24c07fdd
**Message**: Tests tool approval workflow in `createToolCallStep` (#8824)

**Files changed**:
- packages/core/src/loop/workflows/agentic-execution/tool-call-step.test.ts

### Commit: c925b4375c
**Message**: chore(deps): update dependency @composio/core to ^0.1.55 (#8831)

**Files changed**:
- templates/template-google-sheets/package.json

### Commit: 81506dc06b
**Message**: chore(deps): update redis docker tag to v8 (#8753)

**Files changed**:
- packages/agent-builder/integration-tests/docker-compose.yml
- packages/memory/integration-tests-v5/docker-compose.yml
- packages/memory/integration-tests/docker-compose.yml

### Commit: a998b8f858
**Message**: Fix `generateTitle: false` and `generateTitle: { model: ... }` not working (#8800)

**Files changed**:
- .changeset/tasty-showers-pay.md
- packages/core/src/memory/memory.ts

### Commit: e3c107763a
**Message**: fix(core): Handle agent maxRetries option (#8729)

**Files changed**:
- .changeset/plain-onions-accept.md
- packages/core/package.json
- packages/core/src/agent/agent.test.ts
- packages/core/src/agent/agent.types.ts
- packages/core/src/loop/test-utils/options.ts
- packages/core/src/loop/test-utils/streamObject.ts
- packages/core/src/stream/aisdk/v5/execute.ts
- pnpm-lock.yaml

### Commit: 0dab4590cf
**Message**: feat(core): improve structured output with zod validation (#8734)

**Files changed**:
- packages/core/src/loop/test-utils/streamObject.ts
- packages/core/src/loop/workflows/agentic-execution/llm-execution-step.ts
- packages/core/src/stream/base/output-format-handlers.test.ts
- packages/core/src/stream/base/output-format-handlers.ts
- packages/core/src/stream/base/output.ts

### Commit: c7eef0fb94
**Message**: Add AI SDK v5 compatibility to Langfuse exporter (#8790)

**Files changed**:
- .changeset/langfuse-ai-sdk-v5-compatibility.md
- observability/langfuse/src/ai-tracing.test.ts
- observability/langfuse/src/ai-tracing.ts

### Commit: 5c4d7e99c9
**Message**: [Braintrust] Use Mastra's `traceId` as `root_span_id` for braintrust traces (#8821)

**Files changed**:
- .changeset/clean-rabbits-pay.md
- observability/braintrust/package.json
- observability/braintrust/src/ai-tracing.test.ts
- observability/braintrust/src/ai-tracing.ts
- pnpm-lock.yaml

### Commit: dec5fb673e
**Message**: chore(deps): update dependency vite to v7.1.9 (#8816)

**Files changed**:
- client-sdks/react/package.json
- examples/agui/package.json
- examples/agui/pnpm-lock.yaml
- examples/client-side-tools/package.json
- examples/client-side-tools/pnpm-lock.yaml
- packages/playground-ui/package.json
- packages/playground/package.json
- pnpm-lock.yaml

### Commit: 8a37bddb6d
**Message**: chore(repo): Improve READMEs (#8819)

**Files changed**:
- .changeset/tiny-goats-brush.md
- CODE_OF_CONDUCT.md
- CONTRIBUTING.md
- README.md
- docs/src/content/en/docs/index.mdx
- packages/cli/README.md
- packages/core/README.md
- packages/create-mastra/README.md

### Commit: 0f73d53712
**Message**: Workflow validation docs (#8820)

**Files changed**:
- docs/src/content/en/reference/workflows/workflow.mdx

### Commit: 47d90e728e
**Message**: add documentation for workflow input validation (#8818)

**Files changed**:
- docs/src/content/en/docs/workflows/overview.mdx
- docs/src/content/en/reference/workflows/workflow.mdx

### Commit: 61663d5d91
**Message**: remove getting-started/model-providers (#8801)

**Files changed**:
- docs/config/redirects.mjs
- docs/src/content/en/docs/agents/overview.mdx
- docs/src/content/en/docs/frameworks/agentic-uis/ai-sdk.mdx
- docs/src/content/en/docs/frameworks/servers/express.mdx
- docs/src/content/en/docs/getting-started/_meta.ts
- docs/src/content/en/docs/getting-started/installation.mdx
- docs/src/content/en/docs/getting-started/model-providers.mdx
- docs/src/content/en/guides/guide/ai-recruiter.mdx
- docs/src/content/en/guides/guide/chef-michel.mdx
- docs/src/content/en/guides/guide/notes-mcp-server.mdx
- docs/src/content/en/guides/guide/research-assistant.mdx
- docs/src/content/en/guides/guide/stock-agent.mdx
- docs/src/content/en/models/index.mdx

### Commit: b9b9d7dbf3
**Message**: use only zod validation in dynamic form (#8802)

**Files changed**:
- .changeset/lucky-pens-move.md
- packages/playground-ui/src/components/dynamic-form/index.tsx

### Commit: 65493b31c3
**Message**: Stream `finalResult` from network loop (#8795)

**Files changed**:
- .changeset/free-meals-nail.md
- .changeset/sparkly-peaches-wear.md
- client-sdks/react/src/lib/ai-sdk/transformers/AISdkNetworkTransformer.ts
- packages/cli/package.json
- packages/core/src/loop/network/index.ts
- packages/core/src/stream/types.ts

### Commit: f6be9cc207
**Message**: chore(docs): Add codex mcp setup instructions (#8760)

**Files changed**:
- README.md
- docs/src/content/en/docs/getting-started/mcp-docs-server.mdx

### Commit: fb703b9634
**Message**: Unified sidebar (#8655)

**Files changed**:
- .changeset/legal-papayas-join.md
- packages/playground-ui/src/components/ui/elements/index.ts
- packages/playground-ui/src/components/ui/elements/main-sidebar/index.ts
- packages/playground-ui/src/components/ui/elements/main-sidebar/main-sidebar-bottom.tsx
- packages/playground-ui/src/components/ui/elements/main-sidebar/main-sidebar-context.tsx
- packages/playground-ui/src/components/ui/elements/main-sidebar/main-sidebar-nav-header.tsx
- packages/playground-ui/src/components/ui/elements/main-sidebar/main-sidebar-nav-link.tsx
- packages/playground-ui/src/components/ui/elements/main-sidebar/main-sidebar-nav-list.tsx
- packages/playground-ui/src/components/ui/elements/main-sidebar/main-sidebar-nav-section.tsx
- packages/playground-ui/src/components/ui/elements/main-sidebar/main-sidebar-nav-separator.tsx
- packages/playground-ui/src/components/ui/elements/main-sidebar/main-sidebar-nav.tsx
- packages/playground-ui/src/components/ui/elements/main-sidebar/main-sidebar-root.tsx
- packages/playground-ui/src/components/ui/elements/main-sidebar/main-sidebar.tsx
- packages/playground-ui/src/index.ts
- packages/playground/src/components/layout.tsx
- packages/playground/src/components/ui/app-sidebar.tsx
- packages/playground/src/components/ui/sidebar.tsx

### Commit: 7852f6c2ef
**Message**: chore(docs): Typo fixes (#8799)

**Files changed**:
- docs/src/content/en/docs/getting-started/installation.mdx

### Commit: 5ef944a372
**Message**: [Fix] Add div wrapper around Entity tables and toolbar  (#8758)

**Files changed**:
- .changeset/quick-insects-invite.md
- packages/playground-ui/src/domains/agents/components/agent-table/agent-table.tsx
- packages/playground-ui/src/domains/mcps/components/mcp-table/mcp-table.tsx
- packages/playground-ui/src/domains/scores/components/scorers-table/scorers-table.tsx
- packages/playground-ui/src/domains/tools/components/tool-table/tool-table.tsx
- packages/playground-ui/src/domains/workflows/components/workflow-table/workflow-table.tsx

### Commit: d6b186fb08
**Message**: Set custom trace type for TracesList (#8759)

**Files changed**:
- .changeset/shiny-ears-sneeze.md
- packages/playground-ui/src/domains/observability/components/traces-list.tsx

### Commit: abc1d4fdb4
**Message**: [Fix] cannot read VSCODE_TEXTMATE_DEBUG error (#8796)

**Files changed**:
- packages/playground/vite.config.ts

### Commit: 288c2ec873
**Message**: fix: peer and dev deps react version in hooks package (#8698)

**Files changed**:
- .changeset/heavy-chairs-punch.md
- client-sdks/react/package.json
- pnpm-lock.yaml

### Commit: 963b0cc7f5
**Message**: chore(deps): update actions/create-github-app-token action to v2 (#8744)

**Files changed**:
- .github/workflows/create-release.yml
- .github/workflows/pr-snapshot.yml
- .github/workflows/renovate.yml
- .github/workflows/sync-templates.yml
- .github/workflows/sync_renovate-changesets.yml
- .github/workflows/version-packages.yml

### Commit: cc4ead5070
**Message**: Network migration guide (#8791)

**Files changed**:
- docs/src/content/en/guides/migrations/_meta.ts
- docs/src/content/en/guides/migrations/agentnetwork.mdx

### Commit: ca5a01f0dd
**Message**: fix: add typescript to global externals to prevent bundling OOM (#8789)

**Files changed**:
- .changeset/fluffy-buckets-camp.md
- packages/deployer/src/build/analyze/constants.ts

### Commit: 3651569f39
**Message**: docs tweaks (#8788)

**Files changed**:
- docs/src/content/en/docs/getting-started/installation.mdx
- docs/src/content/en/docs/index.mdx

### Commit: 1bccdb33eb
**Message**: feat: add deprecation warnings for workflow stream methods (#8701)

**Files changed**:
- .changeset/purple-words-stop.md
- packages/core/src/workflows/workflow.ts

### Commit: 9888265c13
**Message**: Add `resourceAttributes` to `OtelExporterConfig` (#8700)

**Files changed**:
- .changeset/rough-lightbulb-elephant.md
- docs/src/content/en/docs/observability/ai-tracing/exporters/otel.mdx
- docs/src/content/en/reference/observability/ai-tracing/exporters/otel.mdx
- observability/otel-exporter/src/ai-tracing.ts
- observability/otel-exporter/src/types.ts

### Commit: efaa2e1bdc
**Message**: tweak intro (#8786)

**Files changed**:
- docs/src/content/en/docs/index.mdx

### Commit: 366fb08f31
**Message**: Disable permissions in renovate.yml

**Files changed**:
- .github/workflows/renovate.yml

### Commit: b3855e8be9
**Message**: chore(deps): update dependency @vitejs/plugin-react to v5.0.4 (#8747)

**Files changed**:
- client-sdks/react/package.json
- examples/agui/package.json
- examples/agui/pnpm-lock.yaml
- examples/client-side-tools/package.json
- examples/client-side-tools/pnpm-lock.yaml
- packages/playground-ui/package.json
- packages/playground/package.json
- pnpm-lock.yaml

### Commit: c24ade91e4
**Message**: chore(deps): update dependency cross-env to v10 (#8749)

**Files changed**:
- packages/mcp-docs-server/package.json
- packages/mcp-registry-registry/package.json
- pnpm-lock.yaml

### Commit: e2c2e0ad44
**Message**: chore(deps): update dependency cpy-cli to v6 (#8748)

**Files changed**:
- packages/cli/package.json
- pnpm-lock.yaml

### Commit: 00487850bf
**Message**: chore(deps): update actions/github-script action to v8 (#8745)

**Files changed**:
- .github/workflows/delete-spam-issues.yml

### Commit: fd55bc5acc
**Message**: chore(deps): update dependency pnpm to v10.18.2 (#8750)

**Files changed**:
- e2e-tests/commonjs/template/package.json
- e2e-tests/kitchen-sink/template/package.json
- e2e-tests/monorepo/template/package.json
- package.json
- pnpm-lock.yaml
- templates/template-docs-chatbot/package.json
- voice/gladia/package.json

### Commit: 037f7b6322
**Message**: chore(deps): update renovatebot/github-action action to v43.0.17 (#8671)

**Files changed**:
- .github/workflows/renovate.yml

### Commit: d151129110
**Message**: chore(deps): update cloudflare to ^4.20251008.0 (#8727)

**Files changed**:
- pnpm-lock.yaml
- stores/cloudflare-d1/package.json
- stores/cloudflare/package.json
- voice/cloudflare/package.json

### Commit: 5a7e4db81b
**Message**: chore(deps): update dependency storybook to ^9.1.10 (#8637)

**Files changed**:
- packages/playground-ui/package.json
- pnpm-lock.yaml

### Commit: 1101a2923c
**Message**: chore(deps): update dependency inngest to ^3.44.2 (#8651)

**Files changed**:
- .changeset/@mastra_google-cloud-pubsub-8651-dependencies.md
- .changeset/@mastra_inngest-8651-dependencies.md
- pnpm-lock.yaml
- pubsub/google-cloud-pubsub/package.json
- workflows/inngest/package.json

### Commit: ca4df53e1f
**Message**: chore(deps): update dependency @browserbasehq/stagehand to ^2.5.2 (#8735)

**Files changed**:
- templates/template-ad-copy-from-content/package.json
- templates/template-browsing-agent/package.json

### Commit: 3bb6dc15ef
**Message**: Fix: Include models in middleware matcher (#8779)

**Files changed**:
- docs/src/middleware.ts

### Commit: 611c91aef6
**Message**: install guide (#8783)

**Files changed**:
- docs/src/content/en/docs/getting-started/installation.mdx

### Commit: ded09f35db
**Message**: docs(fix): relocate processor examples (#8780)

**Files changed**:
- docs/src/content/en/examples/_meta.tsx
- docs/src/content/en/examples/index.mdx
- docs/src/content/en/examples/processors/_meta.ts
- docs/src/content/en/examples/processors/message-length-limiter.mdx
- docs/src/content/en/examples/processors/response-length-limiter.mdx
- docs/src/content/en/examples/processors/response-validator.mdx

### Commit: bfff12b29e
**Message**: paul/grwth-873-docstoberfest-agents-memory (#8769)

**Files changed**:
- docs/src/content/en/docs/agents/agent-memory.mdx
- docs/src/content/en/docs/agents/guardrails.mdx
- docs/src/content/en/docs/tools-mcp/overview.mdx

### Commit: db2afbad3f
**Message**: Preserve Mastra span id (#8714)

**Files changed**:
- .changeset/fast-cups-turn.md
- observability/braintrust/src/ai-tracing.ts

### Commit: 05a9dee3d3
**Message**: ai sdk workflow route, agent network route (#8672)

**Files changed**:
- .changeset/clever-eggs-remain.md
- .changeset/olive-geckos-stand.md
- client-sdks/ai-sdk/src/chat-route.ts
- client-sdks/ai-sdk/src/index.ts
- client-sdks/ai-sdk/src/network-route.ts
- client-sdks/ai-sdk/src/to-ai-sdk-format.ts
- client-sdks/ai-sdk/src/transformers.ts
- client-sdks/ai-sdk/src/workflow-route.ts
- packages/core/src/loop/network/index.ts
- packages/core/src/stream/index.ts
- packages/core/src/stream/types.ts

### Commit: 421f019496
**Message**: feat: send message react sdk (#8715)

**Files changed**:
- .changeset/chatty-knives-peel.md
- client-sdks/react/src/agent/hooks.ts
- packages/playground-ui/src/services/mastra-runtime-provider.tsx

### Commit: a504f477c2
**Message**: Trace Span Scoring - update (#8677)

**Files changed**:
- packages/core/src/scores/scoreTraces/runScorerOnTarget.test.ts
- packages/core/src/scores/scoreTraces/scoreTracesWorkflow.ts
- packages/playground-ui/src/components/ui/containers/buttons-group.tsx
- packages/playground-ui/src/components/ui/containers/index.ts
- packages/playground-ui/src/components/ui/containers/sections.tsx
- packages/playground-ui/src/components/ui/elements/entry-list/entry-list-root.tsx
- packages/playground-ui/src/components/ui/elements/index.ts
- packages/playground-ui/src/components/ui/elements/notification/index.ts
- packages/playground-ui/src/components/ui/elements/notification/notification.tsx
- packages/playground-ui/src/components/ui/elements/section/index.ts
- packages/playground-ui/src/components/ui/elements/section/section-header.tsx
- packages/playground-ui/src/components/ui/elements/section/section-heading.tsx
- packages/playground-ui/src/components/ui/elements/section/section-root.tsx
- packages/playground-ui/src/components/ui/elements/section/section.tsx
- packages/playground-ui/src/components/ui/elements/side-dialog/index.tsx
- packages/playground-ui/src/components/ui/elements/side-dialog/side-dialog-code-section.tsx
- packages/playground-ui/src/components/ui/elements/side-dialog/side-dialog-content.tsx
- packages/playground-ui/src/components/ui/elements/side-dialog/side-dialog-nav.tsx
- packages/playground-ui/src/components/ui/elements/side-dialog/side-dialog-root.tsx
- packages/playground-ui/src/components/ui/elements/side-dialog/side-dialog-top.tsx
- packages/playground-ui/src/components/ui/elements/side-dialog/side-dialog.tsx
- packages/playground-ui/src/components/ui/elements/tabs/tabs-content.tsx
- packages/playground-ui/src/components/ui/elements/tabs/tabs-list.tsx
- packages/playground-ui/src/components/ui/elements/tabs/tabs-root.tsx
- packages/playground-ui/src/components/ui/elements/tabs/tabs-tab.tsx
- packages/playground-ui/src/components/ui/elements/tabs/tabs.tsx
- packages/playground-ui/src/components/ui/elements/text/text-and-icon.tsx
- packages/playground-ui/src/domains/observability/components/index.ts
- packages/playground-ui/src/domains/observability/components/span-details.tsx
- packages/playground-ui/src/domains/observability/components/span-dialog.tsx
- packages/playground-ui/src/domains/observability/components/span-score-list.tsx
- packages/playground-ui/src/domains/observability/components/span-scoring.tsx
- packages/playground-ui/src/domains/observability/components/span-tabs.tsx
- packages/playground-ui/src/domains/observability/components/trace-dialog.tsx
- packages/playground-ui/src/domains/observability/components/trace-span-usage.tsx
- packages/playground-ui/src/domains/observability/components/trace-timeline.tsx
- packages/playground-ui/src/domains/scores/components/score-dialog.tsx
- packages/playground-ui/src/domains/scores/components/scorers-dropdown.tsx
- packages/playground-ui/src/domains/scores/hooks/use-trace-span-scores.tsx
- packages/playground-ui/src/domains/scores/hooks/use-trigger-scorer.tsx
- packages/playground-ui/src/domains/scores/index.ts
- packages/playground/src/pages/observability/index.tsx
- packages/playground/src/pages/scorers/scorer/index.tsx

### Commit: 69cad5fe17
**Message**: rewrite documentation overview page (#8675)

**Files changed**:
- docs/src/content/en/docs/index.mdx

### Commit: 158381d393
**Message**:  fix(core): improve error propagation in agent stream failures  (#8733)

**Files changed**:
- .changeset/fluffy-tools-lick.md
- packages/core/src/agent/agent.ts

### Commit: 7b5826e494
**Message**: chore(deps): update e2e tests (#8692)

**Files changed**:
- e2e-tests/commonjs/template/package.json
- e2e-tests/deployers/template/cloudflare/package.json
- e2e-tests/kitchen-sink/package.json
- e2e-tests/kitchen-sink/pnpm-lock.yaml
- e2e-tests/kitchen-sink/template/package.json
- e2e-tests/monorepo/template/apps/custom/package.json

### Commit: 5af7816e23
**Message**: feat(core): dynamic model router with auto-refresh and runtime type generation (#8688)

**Files changed**:
- docs/src/content/en/models/gateways/fireworks-ai.mdx
- docs/src/content/en/models/gateways/groq.mdx
- docs/src/content/en/models/gateways/huggingface.mdx
- docs/src/content/en/models/gateways/index.mdx
- docs/src/content/en/models/gateways/netlify.mdx
- docs/src/content/en/models/gateways/openrouter.mdx
- docs/src/content/en/models/gateways/togetherai.mdx
- docs/src/content/en/models/gateways/vercel.mdx
- docs/src/content/en/models/index.mdx
- docs/src/content/en/models/providers/alibaba-cn.mdx
- docs/src/content/en/models/providers/alibaba.mdx
- docs/src/content/en/models/providers/anthropic.mdx
- docs/src/content/en/models/providers/baseten.mdx
- docs/src/content/en/models/providers/cerebras.mdx
- docs/src/content/en/models/providers/chutes.mdx
- docs/src/content/en/models/providers/cortecs.mdx
- docs/src/content/en/models/providers/deepinfra.mdx
- docs/src/content/en/models/providers/deepseek.mdx
- docs/src/content/en/models/providers/fastrouter.mdx
- docs/src/content/en/models/providers/github-models.mdx
- docs/src/content/en/models/providers/google.mdx
- docs/src/content/en/models/providers/inception.mdx
- docs/src/content/en/models/providers/index.mdx
- docs/src/content/en/models/providers/inference.mdx
- docs/src/content/en/models/providers/llama.mdx
- docs/src/content/en/models/providers/lmstudio.mdx
- docs/src/content/en/models/providers/lucidquery.mdx
- docs/src/content/en/models/providers/mistral.mdx
- docs/src/content/en/models/providers/modelscope.mdx
- docs/src/content/en/models/providers/moonshotai-cn.mdx
- docs/src/content/en/models/providers/moonshotai.mdx
- docs/src/content/en/models/providers/morph.mdx
- docs/src/content/en/models/providers/nvidia.mdx
- docs/src/content/en/models/providers/openai.mdx
- docs/src/content/en/models/providers/opencode.mdx
- docs/src/content/en/models/providers/perplexity.mdx
- docs/src/content/en/models/providers/requesty.mdx
- docs/src/content/en/models/providers/submodel.mdx
- docs/src/content/en/models/providers/synthetic.mdx
- docs/src/content/en/models/providers/upstage.mdx
- docs/src/content/en/models/providers/venice.mdx
- docs/src/content/en/models/providers/wandb.mdx
- docs/src/content/en/models/providers/xai.mdx
- docs/src/content/en/models/providers/zai-coding-plan.mdx
- docs/src/content/en/models/providers/zai.mdx
- docs/src/content/en/models/providers/zhipuai-coding-plan.mdx
- docs/src/content/en/models/providers/zhipuai.mdx
- packages/core/.gitignore
- packages/core/package.json
- packages/core/scripts/generate-model-docs.ts
- packages/core/scripts/generate-providers.ts
- packages/core/src/llm/index.ts
- packages/core/src/llm/model/gateways/models-dev.integration.test.ts
- packages/core/src/llm/model/gateways/models-dev.ts
- packages/core/src/llm/model/gateways/netlify.ts
- packages/core/src/llm/model/index.ts
- packages/core/src/llm/model/provider-registry.generated.ts
- packages/core/src/llm/model/provider-registry.json
- packages/core/src/llm/model/provider-registry.test.ts
- packages/core/src/llm/model/provider-registry.ts
- packages/core/src/llm/model/provider-types.generated.d.ts
- packages/core/src/llm/model/registry-generator.ts
- packages/core/src/llm/model/router.integration.test.ts
- packages/core/src/llm/model/router.ts
- packages/core/src/llm/model/shared.types.ts
- packages/core/tsup.config.ts

### Commit: d962491c0c
**Message**: paul/grwth-871-docstoberfest-agents-runtime-context (#8725)

**Files changed**:
- docs/config/redirects.mjs
- docs/public/image/agents/agents-runtime-context.jpg
- docs/src/content/en/docs/agents/_meta.tsx
- docs/src/content/en/docs/agents/overview.mdx
- docs/src/content/en/docs/agents/runtime-context.mdx
- docs/src/content/en/docs/server-db/_meta.ts
- docs/src/content/en/docs/server-db/middleware.mdx
- docs/src/content/en/docs/server-db/runtime-context.mdx
- docs/src/content/en/docs/tools-mcp/overview.mdx
- docs/src/content/en/docs/workflows/overview.mdx

### Commit: a162a0123c
**Message**: ci: add required API keys to core package tests workflow (#8731)

**Files changed**:
- .github/workflows/secrets.test-core.yml

### Commit: 37a23148e0
**Message**: feat(core): add-tracing-to-processors (#8623)

**Files changed**:
- .changeset/chatty-crabs-hide.md
- .changeset/many-schools-tap.md
- observability/otel-exporter/package.json
- observability/otel-exporter/src/span-converter.ts
- packages/core/src/ai-tracing/integration-tests.test.ts
- packages/core/src/ai-tracing/spans/base.test.ts
- packages/core/src/ai-tracing/spans/base.ts
- packages/core/src/ai-tracing/types.ts
- packages/core/src/processors/processors/language-detector.ts
- packages/core/src/processors/processors/moderation.ts
- packages/core/src/processors/processors/pii-detector.ts
- packages/core/src/processors/processors/prompt-injection-detector.ts
- packages/core/src/processors/processors/structured-output.ts
- packages/core/src/processors/processors/system-prompt-scrubber.ts
- packages/core/src/processors/runner.ts
- packages/core/src/stream/base/output.ts

### Commit: bccbdabb02
**Message**: fix(playground): model picker autotab fix (#8680)

**Files changed**:
- .changeset/dry-squids-flow.md
- packages/playground-ui/src/domains/agents/components/agent-metadata/agent-metadata-model-switcher.tsx

### Commit: 8b4676381b
**Message**: fix(chat-route): pass runtimeContext to agent stream options (#8641)

**Files changed**:
- .changeset/breezy-dots-act.md
- client-sdks/ai-sdk/src/chat-route.ts

### Commit: 16f1c10625
**Message**: feat(pg): add PostgresConfig support to PgVector for consistency with PostgresStore (#8103)

**Files changed**:
- .changeset/fast-streets-eat.md
- packages/memory/integration-tests/src/reusable-tests.ts
- packages/memory/integration-tests/src/worker/generic-memory-worker.ts
- stores/pg/src/index.ts
- stores/pg/src/shared/config.ts
- stores/pg/src/storage/index.ts
- stores/pg/src/storage/test-utils.ts
- stores/pg/src/vector/index.test.ts
- stores/pg/src/vector/index.ts

### Commit: ccf9cd850d
**Message**: paul/grwth-864-docstoberfest-agents-tools-mcp (#8678)

**Files changed**:
- docs/config/redirects.mjs
- docs/src/content/en/docs/agents/_meta.tsx
- docs/src/content/en/docs/agents/overview.mdx
- docs/src/content/en/docs/agents/using-tools-and-mcp.mdx
- docs/src/content/en/docs/agents/using-tools.mdx

### Commit: 686bbfed4b
**Message**: add note to writer docs that it's only available in workflow (#8697)

**Files changed**:
- docs/src/content/en/docs/streaming/workflow-streaming.mdx

### Commit: 075e1b586f
**Message**: chore: version packages (alpha) (#8629)

**Files changed**:
- .changeset/pre.json
- client-sdks/ai-sdk/CHANGELOG.md
- client-sdks/ai-sdk/package.json
- client-sdks/client-js/CHANGELOG.md
- client-sdks/client-js/package.json
- client-sdks/react/CHANGELOG.md
- client-sdks/react/package.json
- deployers/cloud/CHANGELOG.md
- deployers/cloud/package.json
- deployers/cloudflare/CHANGELOG.md
- deployers/cloudflare/package.json
- deployers/netlify/CHANGELOG.md
- deployers/netlify/package.json
- deployers/vercel/CHANGELOG.md
- deployers/vercel/package.json
- examples/dane/CHANGELOG.md
- examples/dane/package.json
- explorations/longmemeval/CHANGELOG.md
- explorations/longmemeval/package.json
- observability/braintrust/CHANGELOG.md
- observability/braintrust/package.json
- observability/langfuse/CHANGELOG.md
- observability/langfuse/package.json
- observability/langsmith/CHANGELOG.md
- observability/langsmith/package.json
- observability/otel-exporter/CHANGELOG.md
- observability/otel-exporter/package.json
- packages/agent-builder/CHANGELOG.md
- packages/agent-builder/package.json
- packages/cli/CHANGELOG.md
- packages/cli/package.json
- packages/cloud/CHANGELOG.md
- packages/cloud/package.json
- packages/core/CHANGELOG.md
- packages/core/package.json
- packages/create-mastra/CHANGELOG.md
- packages/create-mastra/package.json
- packages/deployer/CHANGELOG.md
- packages/deployer/package.json
- packages/evals/CHANGELOG.md
- packages/evals/package.json
- packages/loggers/CHANGELOG.md
- packages/loggers/package.json
- packages/mcp-docs-server/CHANGELOG.md
- packages/mcp-docs-server/package.json
- packages/mcp-registry-registry/CHANGELOG.md
- packages/mcp-registry-registry/package.json
- packages/mcp/CHANGELOG.md
- packages/mcp/package.json
- packages/memory/CHANGELOG.md
- packages/memory/package.json
- packages/playground-ui/CHANGELOG.md
- packages/playground-ui/package.json
- packages/rag/CHANGELOG.md
- packages/rag/package.json
- packages/server/CHANGELOG.md
- packages/server/package.json
- pubsub/google-cloud-pubsub/CHANGELOG.md
- pubsub/google-cloud-pubsub/package.json
- stores/astra/CHANGELOG.md
- stores/astra/package.json
- stores/chroma/CHANGELOG.md
- stores/chroma/package.json
- stores/clickhouse/CHANGELOG.md
- stores/clickhouse/package.json
- stores/cloudflare-d1/CHANGELOG.md
- stores/cloudflare-d1/package.json
- stores/cloudflare/CHANGELOG.md
- stores/cloudflare/package.json
- stores/couchbase/CHANGELOG.md
- stores/couchbase/package.json
- stores/dynamodb/CHANGELOG.md
- stores/dynamodb/package.json
- stores/lance/CHANGELOG.md
- stores/lance/package.json
- stores/libsql/CHANGELOG.md
- stores/libsql/package.json
- stores/mongodb/CHANGELOG.md
- stores/mongodb/package.json
- stores/mssql/CHANGELOG.md
- stores/mssql/package.json
- stores/opensearch/CHANGELOG.md
- stores/opensearch/package.json
- stores/pg/CHANGELOG.md
- stores/pg/package.json
- stores/pinecone/CHANGELOG.md
- stores/pinecone/package.json
- stores/qdrant/CHANGELOG.md
- stores/qdrant/package.json
- stores/s3vectors/CHANGELOG.md
- stores/s3vectors/package.json
- stores/turbopuffer/CHANGELOG.md
- stores/turbopuffer/package.json
- stores/upstash/CHANGELOG.md
- stores/upstash/package.json
- stores/vectorize/CHANGELOG.md
- stores/vectorize/package.json
- voice/azure/CHANGELOG.md
- voice/azure/package.json
- voice/cloudflare/CHANGELOG.md
- voice/cloudflare/package.json
- voice/deepgram/CHANGELOG.md
- voice/deepgram/package.json
- voice/elevenlabs/CHANGELOG.md
- voice/elevenlabs/package.json
- voice/gladia/CHANGELOG.md
- voice/gladia/package.json
- voice/google-gemini-live-api/CHANGELOG.md
- voice/google-gemini-live-api/package.json
- voice/google/CHANGELOG.md
- voice/google/package.json
- voice/murf/CHANGELOG.md
- voice/murf/package.json
- voice/openai-realtime-api/CHANGELOG.md
- voice/openai-realtime-api/package.json
- voice/openai/CHANGELOG.md
- voice/openai/package.json
- voice/playai/CHANGELOG.md
- voice/playai/package.json
- voice/sarvam/CHANGELOG.md
- voice/sarvam/package.json
- voice/speechify/CHANGELOG.md
- voice/speechify/package.json
- workflows/inngest/CHANGELOG.md
- workflows/inngest/package.json

### Commit: 1ed9670d3c
**Message**: fix aisdk format causing stream issue when agent is used as step in wflow (#8716)

**Files changed**:
- .changeset/chatty-moons-sleep.md
- packages/core/src/agent/agent.ts
- packages/core/src/agent/workflows/prepare-stream/index.ts
- packages/core/src/agent/workflows/prepare-stream/prepare-tools-step.ts
- packages/core/src/workflows/default.ts
- packages/core/src/workflows/evented/execution-engine.ts
- packages/core/src/workflows/execution-engine.ts
- packages/core/src/workflows/step.ts
- packages/core/src/workflows/workflow.ts

### Commit: f920afdf87
**Message**: fix: gracefully handle error object in react sdk (#8703)

**Files changed**:
- .changeset/angry-items-mate.md
- client-sdks/react/src/lib/ai-sdk/utils/toUIMessage.ts

### Commit: 0286f1770d
**Message**: docs(fix): runtime context example (#8654)

**Files changed**:
- docs/src/content/en/docs/agents/runtime-context.mdx
- docs/src/content/en/examples/agents/_meta.ts
- docs/src/content/en/examples/agents/dynamic-agents.mdx
- docs/src/content/en/examples/agents/runtime-context.mdx


---

## Summary: Files with Potential AI SDK Import Issues

Analyzing all changed files for AI SDK imports...

### Files Changed Since v5 PR (Total:      498)

### TypeScript Files (excluding .d.ts):      169

### Files with AI SDK Imports

#### client-sdks/ai-sdk/src/chat-route.ts
```typescript
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
```

#### client-sdks/ai-sdk/src/network-route.ts
```typescript
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
```

#### client-sdks/ai-sdk/src/to-ai-sdk-format.ts
```typescript
import type { InferUIMessageChunk, UIMessage } from 'ai';
```

#### client-sdks/ai-sdk/src/workflow-route.ts
```typescript
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
```

#### client-sdks/react/src/agent/hooks.ts
```typescript
import { UIMessage } from '@ai-sdk/react';
```

#### e2e-tests/kitchen-sink/template/src/mastra/agents/index.ts
```typescript
import { openai } from '@ai-sdk/openai';
```

#### examples/agent/src/mastra/agents/model-v2-agent.ts
```typescript
import { openai, openai as openai_v5 } from '@ai-sdk/openai-v5';
```

#### packages/core/src/agent/agent.test.ts
```typescript
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAI as createOpenAIV5 } from '@ai-sdk/openai-v5';
import type { LanguageModelV2, LanguageModelV2TextPart } from '@ai-sdk/provider-v5';
import type { ToolInvocationUIPart } from '@ai-sdk/ui-utils';
import type { CoreMessage, LanguageModelV1, CoreSystemMessage } from 'ai';
import { simulateReadableStream } from 'ai';
```

#### packages/core/src/agent/agent.ts
```typescript
import type { CoreMessage, StreamObjectResult, TextPart, Tool, UIMessage } from 'ai';
```

#### packages/core/src/agent/agent.types.ts
```typescript
import type { TelemetrySettings } from 'ai';
```

#### packages/core/src/llm/index.ts
```typescript
} from 'ai';
```

#### packages/core/src/llm/model/gateways/models-dev.ts
```typescript
import { createAnthropic } from '@ai-sdk/anthropic-v5';
import { createGoogleGenerativeAI } from '@ai-sdk/google-v5';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible-v5';
import { createOpenAI } from '@ai-sdk/openai-v5';
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { createXai } from '@ai-sdk/xai-v5';
```

#### packages/core/src/llm/model/gateways/netlify.ts
```typescript
import { createAnthropic } from '@ai-sdk/anthropic-v5';
import { createGoogleGenerativeAI } from '@ai-sdk/google-v5';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible-v5';
import { createOpenAI } from '@ai-sdk/openai-v5';
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
```

#### packages/core/src/llm/model/router.ts
```typescript
import { createOpenAICompatible } from '@ai-sdk/openai-compatible-v5';
import type { LanguageModelV2, LanguageModelV2CallOptions, LanguageModelV2StreamPart } from '@ai-sdk/provider-v5';
```

#### packages/core/src/llm/model/shared.types.ts
```typescript
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import type { LanguageModelV1 } from 'ai';
```

#### packages/core/src/loop/test-utils/options.ts
```typescript
import { convertAsyncIterableToArray } from '@ai-sdk/provider-utils/test';
} from '@ai-sdk/provider-v5';
```

#### packages/core/src/loop/test-utils/streamObject.ts
```typescript
} from '@ai-sdk/provider-utils-v5/test';
import type { LanguageModelV2CallWarning, LanguageModelV2StreamPart } from '@ai-sdk/provider-v5';
```

#### packages/core/src/loop/workflows/agentic-execution/llm-execution-step.ts
```typescript
import { isAbortError } from '@ai-sdk/provider-utils-v5';
import type { LanguageModelV2, LanguageModelV2Usage } from '@ai-sdk/provider-v5';
```

#### packages/core/src/memory/memory.ts
```typescript
import type { EmbeddingModelV2 } from '@ai-sdk/provider-v5';
import type { AssistantContent, UserContent, CoreMessage, EmbeddingModel } from 'ai';
```

#### packages/core/src/stream/aisdk/v5/execute.ts
```typescript
import { isAbortError } from '@ai-sdk/provider-utils';
import { injectJsonInstructionIntoMessages } from '@ai-sdk/provider-utils-v5';
import type { LanguageModelV2, LanguageModelV2Prompt, SharedV2ProviderOptions } from '@ai-sdk/provider-v5';
```

#### packages/core/src/stream/base/output-format-handlers.test.ts
```typescript
import { convertArrayToReadableStream, convertAsyncIterableToArray } from '@ai-sdk/provider-utils/test';
```

#### packages/core/src/stream/types.ts
```typescript
import type { LanguageModelV1LogProbs } from '@ai-sdk/provider';
} from '@ai-sdk/provider-v5';
import type { FinishReason, LanguageModelRequestMetadata, TelemetrySettings } from 'ai';
```

#### packages/memory/integration-tests/src/reusable-tests.ts
```typescript
import type { ToolResultPart, TextPart, ToolCallPart } from 'ai';
```


---

## Critical Files: Branch vs Main Comparison

### packages/core/package.json - AI SDK Dependencies

**On main (v5 as default):**
    "@ai-sdk/provider": "^2.0.0",
    "@ai-sdk/provider-utils": "^3.0.10",
--
    "ai": "^5.0.60",
    "ai-v4": "npm:ai@4.3.19",
--
    "@ai-sdk/openai": "2.0.42",
    "@ai-sdk/openai-compatible": "^1.0.19",

**On revert branch (v4 as default):**
    "@ai-sdk/provider": "^1.1.3",
    "@ai-sdk/provider-utils": "^2.2.8",
--
    "ai": "^4.3.19",
    "ai-v5": "npm:ai@5.0.60",
--
    "@ai-sdk/openai": "^1.3.24",
    "@babel/core": "^7.28.4",

---

## Next Steps

1. Review all files with AI SDK imports
2. Check for version mismatches or incorrect imports
3. Identify performance bottlenecks


---

## Verification Checklist

Going through each file to verify correct AI SDK version usage:
- ✅ = Correct
- ❌ = Needs fixing
- ⚠️ = Needs review

### Rule:
- Files using v2 features (LanguageModelV2, etc.) should import from `-v5` packages
- Files using v1 features (LanguageModelV1, CoreMessage, etc.) should import from base packages (no suffix)
- `client-sdks/ai-sdk` was created AFTER v5 PR, so should use v5 (no suffix)

### File-by-File Verification

#### 1. client-sdks/ai-sdk/src/chat-route.ts
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
**Status**: ✅ Correct - uses 'ai' (v5) as expected for post-v5 code

#### 2. client-sdks/ai-sdk/src/network-route.ts
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
**Status**: ✅ Correct - uses 'ai' (v5) as expected for post-v5 code

#### 3. client-sdks/ai-sdk/src/to-ai-sdk-format.ts
import type { InferUIMessageChunk, UIMessage } from 'ai';
**Status**: ✅ Correct - uses 'ai' (v5) as expected for post-v5 code

#### 4. client-sdks/ai-sdk/src/workflow-route.ts
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
**Status**: ✅ Correct - uses 'ai' (v5) as expected for post-v5 code

#### 5. client-sdks/react/src/agent/hooks.ts
import { UIMessage } from '@ai-sdk/react';
**Status**: ⚠️ Needs review - check if @ai-sdk/react should have -v5 suffix

#### 6. e2e-tests/kitchen-sink/template/src/mastra/agents/index.ts
import { openai } from '@ai-sdk/openai';
**Status**: ⚠️ Needs review - e2e test, check what version it should use

#### 7. examples/agent/src/mastra/agents/model-v2-agent.ts
import { openai, openai as openai_v5 } from '@ai-sdk/openai-v5';
**Status**: ✅ Correct - uses @ai-sdk/openai-v5 for v2 model


### Core Package Files

#### 8. packages/core/src/agent/agent.test.ts
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAI as createOpenAIV5 } from '@ai-sdk/openai-v5';
import type { LanguageModelV2, LanguageModelV2TextPart } from '@ai-sdk/provider-v5';
import type { ToolInvocationUIPart } from '@ai-sdk/ui-utils';
import type { CoreMessage, LanguageModelV1, CoreSystemMessage } from 'ai';
import { simulateReadableStream } from 'ai';
import { MockLanguageModelV1 } from 'ai/test';
import { stepCountIs } from 'ai-v5';
import type { SystemModelMessage, UIMessageChunk } from 'ai-v5';
import { convertArrayToReadableStream, MockLanguageModelV2 } from 'ai-v5/test';
**Status**: ✅ Correct - uses 'ai' (v4) for v1 types, '@ai-sdk/openai-v5' for v2 tests

#### 9. packages/core/src/agent/agent.ts
import type { CoreMessage, StreamObjectResult, TextPart, Tool, UIMessage } from 'ai';
import { AISpanType, getOrCreateSpan, getValidTraceId } from '../ai-tracing';
import type { AISpan, TracingContext, TracingOptions, TracingProperties } from '../ai-tracing';
**Status**: ⚠️ CRITICAL - Check if this should use v4 or v5

#### 10. packages/core/src/agent/agent.types.ts
import type { TelemetrySettings } from 'ai';
import type { ModelMessage, ToolChoice } from 'ai-v5';
import type { TracingContext, TracingOptions } from '../ai-tracing';
**Status**: ⚠️ CRITICAL - Check TelemetrySettings version

