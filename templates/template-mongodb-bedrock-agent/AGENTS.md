# MongoDB Bedrock template

Read `README.md` for setup and `CONTRIBUTING.md` for code principles. Keep this teaching template direct and focused.

## Agent

- Before changing Mastra APIs, consult [live docs](https://mastra.ai/llms.txt) and match the versions in `package.json`.
- Register agents, tools, and vector stores in `src/mastra/index.ts`. Use the `dev`, `build`, and `ingest` npm scripts.
- TypeScript uses strict NodeNext ESM; relative imports need `.js` extensions.
- MongoDB Atlas backs retrieval, conversations, and traces. Keep storage off the runtime filesystem.
- Bedrock uses the AWS credential chain. Keep model IDs configurable and `EMBED_DIMENSION` consistent with the embedder and Atlas index.
- Preserve the pinned Bedrock provider version and its `patch-package` fix until deliberately migrating it.
- Never commit credentials, `.env` files, deployment state, or generated output. Keep example configuration free of secrets.

## AgentCore

- `agent.ts` serves `/invocations` and `/ping`; the Docker runtime targets ARM64.
- Deployment configuration lives in `agentcore/agentcore.json`; read types in `agentcore/.llm-context/` before editing schemas. Do not change agent behavior through generated CDK code.
- Resource names determine CloudFormation identity; renaming can recreate resources. Use `agentcore remove` for removals.
- Validate configuration with `agentcore validate`. After harness export, read and complete `EXPORT_NOTES.md` before deployment.

## Verification

Run `npm run build`. For CDK changes, run its build and tests from `agentcore/cdk`. Verify ingestion and the README's first Studio prompt when changing runtime behavior; update setup docs when configuration changes.
