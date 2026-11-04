# AGENTS.md

This repo is a Mastra template. The Mastra project lives at the repo root (`src/`, `scripts/`, `agent.ts`),
and the **AWS AgentCore** project (`agentcore/`) deploys it. Guidance for each is below.

See `CONTRIBUTING.md` for the code principles this template is held to — it is a teaching artifact, so prefer
direct happy-path code over defensive production patterns.

## Working on the Mastra agent (repo root)

- **Load the `mastra` skill / live docs BEFORE any Mastra work.** Mastra APIs change between versions — never rely
  on cached knowledge. Sources: [Mastra docs](https://mastra.ai/llms.txt), [skills](https://mastra.ai/.well-known/skills/index.json).
- Register all agents, tools, and vector stores in `src/mastra/index.ts`.
- Use the `dev` / `build` / `ingest` scripts in `package.json` (don't call `mastra`/`tsc` directly).
- ESM is strict (`NodeNext`): relative imports need explicit `.js` extensions.
- Bedrock model ids are env-configurable (`BEDROCK_MODEL_ID`, `BEDROCK_EMBED_MODEL_ID`, `EMBED_DIMENSION`) because
  availability differs by account/region. If you change the embedder, keep `EMBED_DIMENSION` in sync with its output.
- MongoDB is the storage/vector backend (not the default `LibSQLStore`) — required because AgentCore's runtime
  filesystem is read-only.

## Working on the AgentCore project (`agentcore/`)

This directory is a declarative model of the deployment. The `agentcore/cdk/` subdirectory uses the
`@aws/agentcore-cdk` L3 constructs to deploy the configuration to AWS.

## Mental Model

The project uses a **flat resource model**. Agents, memories, credentials, gateways, evaluators, and policies are
independent top-level arrays in `agentcore.json`. There is no binding between resources in the schema — each resource is
provisioned independently. Agents discover memories and credentials at runtime via environment variables or SDK calls.
Tags defined in `agentcore.json` flow through to deployed CloudFormation resources.

## Critical Invariants

1. **Schema-First Authority:** The `.json` files are the source of truth. Do not modify agent behavior by editing
   generated CDK code in `cdk/`.
2. **Resource Identity:** The `name` field determines the CloudFormation Logical ID.
   - **Renaming** a resource will **destroy and recreate** it.
   - **Modifying** other fields will update the resource **in-place**.
3. **Schema Validation:** If your JSON conforms to the types in `.llm-context/`, it will deploy successfully. Run
   `agentcore validate` to check.
4. **Resource Removal:** Use `agentcore remove` to remove resources. Run `agentcore deploy` after removal to tear down
   deployed infrastructure.

## Directory Structure

```
mongodb-bedrock-agent/
├── README.md               # Template page on mastra.ai is generated from this
├── CONTRIBUTING.md         # Code principles + pre-PR checks
├── AGENTS.md               # This file — AI coding assistant context
├── package.json            # dev / build / ingest scripts
├── .env.example            # MongoDB + Bedrock settings
├── src/mastra/
│   ├── index.ts            # Mastra instance: MongoDB storage + vector store
│   ├── agents/docs-agent.ts
│   ├── tools/docs-search-tool.ts
│   ├── bedrock.ts          # Shared Bedrock provider + model ids
│   └── mongo.ts            # Shared MongoDB config + index names
├── scripts/ingest.ts       # docs → chunks → Titan embeddings → Atlas Vector Search
├── agent.ts                # AgentCore entrypoint (POST /invocations, GET /ping)
├── Dockerfile              # ARM64 node:22-slim, non-root, OTEL
└── agentcore/              # AWS deploy layer
    ├── agentcore.json      # Main project config (AgentCoreProjectSpec)
    ├── aws-targets.json    # Deployment targets (account + region)
    ├── .env.local          # Secrets — MONGODB_URI (gitignored)
    ├── .llm-context/       # TypeScript type definitions for AI assistants
    └── cdk/                # AWS CDK project (@aws/agentcore-cdk L3 constructs)
```

## Schema Reference

The `agentcore/.llm-context/` directory contains TypeScript type definitions optimized for AI coding assistants. Each
file maps to a JSON config file and includes validation constraints as comments (`@regex`, `@min`, `@max`).

| JSON Config                           | Schema File                             | Root Type               |
| ------------------------------------- | --------------------------------------- | ----------------------- |
| `agentcore/agentcore.json`            | `agentcore/.llm-context/agentcore.ts`   | `AgentCoreProjectSpec`  |
| `agentcore/agentcore.json` (gateways) | `agentcore/.llm-context/mcp.ts`         | `AgentCoreMcpSpec`      |
| `agentcore/aws-targets.json`          | `agentcore/.llm-context/aws-targets.ts` | `AwsDeploymentTarget[]` |

### Key Types

- **AgentCoreProjectSpec**: Root config with `runtimes`, `memories`, `credentials`, `agentCoreGateways`, `evaluators`, `onlineEvalConfigs`, `onlineInsightsConfigs`, `knowledgeBases`, `harnesses`, `policyEngines`, `policies`, `payments` (managers + connectors), `configBundles`, `datasets`, `runtimeEndpoints` arrays
- **AgentEnvSpec**: Agent configuration (build type, entrypoint, code location, runtime version, network mode)
- **Memory**: Memory resource with strategies (SEMANTIC, SUMMARIZATION, USER_PREFERENCE, EPISODIC) and expiry
- **Credential**: API key or OAuth credential provider
- **AgentCoreGateway**: MCP gateway with targets (Lambda, MCP server, OpenAPI, Smithy, API Gateway, web-search, knowledge-base)
- **Evaluator**: LLM-as-a-Judge or code-based evaluator
- **OnlineEvalConfig**: Continuous evaluation pipeline bound to an agent
- **OnlineInsightsConfig** _[preview]_: Continuous failure-pattern analysis bound to an agent
- **KnowledgeBase**: Managed Bedrock Knowledge Base auto-wired to a gateway
- **Harness**: Declarative agent — runtime + tools + skills + memory + observability without writing agent code
- **PolicyEngine** + **Policy**: Cedar policy engine with form-based guardrails (Bedrock content filters, prompt-attack, sensitive-info) or raw Cedar policies
- **PaymentManager** + **PaymentConnector**: x402-protocol payment orchestration with provider credentials (CoinbaseCDP, StripePrivy)
- **ConfigBundle**: Versioned runtime configuration as a separately-deployable resource
- **Dataset**: Curated session dataset for batch evaluation and recommendation runs
- **RuntimeEndpoint**: Named endpoint (e.g. `PROMPT_V1`) targeting a specific runtime version

### Common Enum Values

- **BuildType**: `'CodeZip'` | `'Container'`
- **NetworkMode**: `'PUBLIC'` | `'VPC'`
- **RuntimeVersion**: `'PYTHON_3_10'` | `'PYTHON_3_11'` | `'PYTHON_3_12'` | `'PYTHON_3_13'` | `'PYTHON_3_14'` | `'NODE_18'` | `'NODE_20'` | `'NODE_22'`
- **MemoryStrategyType**: `'SEMANTIC'` | `'SUMMARIZATION'` | `'USER_PREFERENCE'` | `'EPISODIC'`
- **GatewayTargetType**: `'lambda'` | `'mcpServer'` | `'openApiSchema'` | `'smithyModel'` | `'apiGateway'` | `'lambdaFunctionArn'` | `'connector'` (web-search, bedrock-knowledge-bases)
- **ModelProvider**: `'Bedrock'` | `'Gemini'` | `'OpenAI'` | `'Anthropic'`
- **PaymentProvider**: `'CoinbaseCDP'` | `'StripePrivy'`
- **PolicyEnforcementMode**: `'ACTIVE'` | `'PASSIVE'`
- **GuardrailContentFilter**: `'VIOLENCE'` | `'HATE'` | `'SEXUAL'` | `'MISCONDUCT'` | `'INSULTS'`

### Build Types

- **CodeZip**: Python source packaged as a zip and deployed directly to AgentCore Runtime.
- **Container**: Docker image built in CodeBuild (ARM64), pushed to a per-agent ECR repository. Requires a `Dockerfile`
  in the agent's `codeLocation` directory. For local development (`agentcore dev`), the container is built and run
  locally with volume-mounted hot-reload.

### Supported Frameworks (for template agents)

- **Strands** — Bedrock, Anthropic, OpenAI, Gemini
- **LangChain/LangGraph** — Bedrock, Anthropic, OpenAI, Gemini
- **GoogleADK** — Gemini
- **OpenAI Agents** — OpenAI
- **Autogen** — Bedrock, Anthropic, OpenAI, Gemini

### Protocols

- **HTTP** — Standard HTTP agent endpoint
- **MCP** — Model Context Protocol server
- **A2A** — Agent-to-Agent protocol (Google A2A)

## Deployment

Deployments are orchestrated through the CLI:

```bash
agentcore deploy    # Synthesizes CDK and deploys to AWS
agentcore status    # Shows deployment status
```

Alternatively, deploy directly via CDK:

```bash
cd agentcore/cdk
npm install
npx cdk synth
npx cdk deploy
```

## Editing Schemas

When modifying JSON config files:

1. Read the corresponding `agentcore/.llm-context/*.ts` file for type definitions
2. Check validation constraint comments (`@regex`, `@min`, `@max`)
3. Use exact enum values as string literals
4. Use CloudFormation-safe names (alphanumeric, start with letter)
5. Run `agentcore validate` to verify changes

## Harness Export

`agentcore export harness` converts a harness configuration into a deployable Strands Python agent under `app/<agentName>/`.

**After every export, you MUST read `app/<agentName>/EXPORT_NOTES.md` before proceeding.**

This file lists any manual follow-up items required before the agent will deploy or run correctly — missing files to create, IAM policies to add, or configuration steps the exporter could not automate. A clean export produces "No manual steps required." Complete every item in the file before running `agentcore deploy`.

```bash
agentcore export harness --name <harnessName>   # generates app/<agentName>/EXPORT_NOTES.md
cat app/<agentName>/EXPORT_NOTES.md             # read this before touching anything else
```

## CLI Commands

Run `agentcore --help` or `agentcore <command> --help` for full flags. Commonly used:

**Project lifecycle**

| Command              | Description                                                       |
| -------------------- | ----------------------------------------------------------------- |
| `agentcore create`   | Create a new project                                              |
| `agentcore dev`      | Run agent locally with hot-reload                                 |
| `agentcore deploy`   | Deploy to AWS                                                     |
| `agentcore invoke`   | Invoke agent (local or deployed)                                  |
| `agentcore status`   | Show deployment status                                            |
| `agentcore validate` | Validate configuration                                            |
| `agentcore package`  | Package agent artifacts                                           |
| `agentcore import`   | Import resources from a Bedrock AgentCore Starter Toolkit project |

**Resources**

| Command                       | Description                                                                                                                                                                                                                   |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `agentcore add <resource>`    | Add agent, memory, credential, gateway, gateway-target, evaluator, online-eval, online-insights, knowledge-base, harness, policy-engine, policy, payment-manager, payment-connector, config-bundle, dataset, runtime-endpoint |
| `agentcore remove <resource>` | Remove any resource                                                                                                                                                                                                           |
| `agentcore export harness`    | Export a harness to a Strands runtime agent under `app/<agentName>/`                                                                                                                                                          |

**Jobs (run, view, archive, lifecycle)**

| Command                                              | Description                                                                    |
| ---------------------------------------------------- | ------------------------------------------------------------------------------ |
| `agentcore run eval`                                 | Run on-demand evaluation against agent traces                                  |
| `agentcore run batch-evaluation`                     | Run evaluators across all sessions at scale                                    |
| `agentcore run recommendation`                       | Optimize prompts or tool descriptions from real traces                         |
| `agentcore run insights` _[preview]_                 | Run failure-pattern analysis across sessions                                   |
| `agentcore run ab-test`                              | Start an A/B test (config-bundle or target-based)                              |
| `agentcore run ingest`                               | Start a fresh ingestion job for every data source on a deployed knowledge base |
| `agentcore view <type>`                              | List or view jobs (recommendation, batch-evaluation, ab-test, insights)        |
| `agentcore archive <type>`                           | Delete a job on the service + clear local history                              |
| `agentcore stop <type>`                              | Stop a running batch-evaluation or ab-test                                     |
| `agentcore promote ab-test`                          | Apply the winning variant to `agentcore.json`                                  |
| `agentcore pause <type>` / `agentcore resume <type>` | Pause/resume a deployed online-eval, online-insights, or ab-test               |

**Config bundles & datasets**

| Command                                                  | Description                               |
| -------------------------------------------------------- | ----------------------------------------- |
| `agentcore config-bundle versions` (alias `cb versions`) | List version history for a bundle         |
| `agentcore config-bundle diff`                           | Diff two versions of a bundle             |
| `agentcore config-bundle create-branch`                  | Create a new branch on an existing bundle |
| `agentcore dataset download`                             | Download a dataset version locally        |
| `agentcore dataset publish-version`                      | Publish a new dataset version             |
| `agentcore dataset remove-version`                       | Remove a dataset version                  |

**Observability & history**

| Command                                          | Description                                |
| ------------------------------------------------ | ------------------------------------------ |
| `agentcore logs`                                 | Stream/search agent runtime logs           |
| `agentcore logs evals`                           | Stream/search online-eval logs             |
| `agentcore traces list` / `agentcore traces get` | List recent traces or download one to JSON |
| `agentcore evals history`                        | View past on-demand eval results           |

**Utilities**

| Command                  | Description                                                    |
| ------------------------ | -------------------------------------------------------------- |
| `agentcore fetch access` | Fetch access info for deployed gateway or agent                |
| `agentcore feedback`     | Send feedback (with optional screenshot) to the AgentCore team |
| `agentcore update`       | Check for and install CLI updates                              |
| `agentcore telemetry`    | View or change telemetry preferences                           |
