# Documentation Assistant

Build an assistant that answers questions about a documentation site you choose, with links to the pages it used. Amazon Titan embeds the pages and your questions, MongoDB Atlas Vector Search finds relevant passages, and Claude on Amazon Bedrock writes the response. MongoDB also stores the conversation, so you can continue a thread after restarting the dev server. The included example is configured for the Mastra documentation; you can adapt the ingestion script and agent instructions for another site.

## Why we built this

A docs assistant needs somewhere to keep the embeddings, somewhere to keep the conversation, and a model. Wiring those parts together is most of the work. File-backed storage also becomes a problem when you deploy to a runtime with a read-only filesystem, such as Bedrock AgentCore.

One Atlas cluster handles vector search and conversation storage, while Bedrock provides both models. You can run the agent locally and deploy it without changing where the data is stored.

## Demo

<video controls width="640" height="360" src="https://res.cloudinary.com/mastra-assets/video/upload/v1793804120/MongoDB_AWS_Bedrock_nzagvh.mp4"></video>

## Prerequisites

- **[MongoDB Atlas account](https://www.mongodb.com/cloud/atlas/register)**: create a cluster, a database user, and an [IP access list entry](https://www.mongodb.com/docs/atlas/connect-to-database-deployment/) for your computer. Set `MONGODB_URI` to the cluster's connection string with that database user's credentials. The free cluster tier supports Atlas Vector Search. `MONGODB_DATABASE` names the database used for documents and conversations; it defaults to `mastra_docs`.
- **[AWS account](https://signin.aws.amazon.com/signup?request_type=register)**: use an account with access to Amazon Bedrock. Bedrock charges for model calls, including local ingestion and questions.
- **[Bedrock model access](https://docs.aws.amazon.com/bedrock/latest/userguide/model-access.html)**: choose a region where the chat and embedding models are available. Set `AWS_REGION` to that region (default: `us-east-1`). For a first use of Claude, submit Anthropic's use case details from the Bedrock Model catalog if prompted. The IAM identity you use locally needs `bedrock:InvokeModel` and, for streamed responses, `bedrock:InvokeModelWithResponseStream`. Access to the default Claude inference profile must also cover its destination regions.
- **[AWS credentials for local development](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html)**: use the standard AWS credential chain, such as an SSO profile configured with `aws configure sso` and signed in with `aws sso login --profile <profile>`. [Install the AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) if you use this path. Set `AWS_PROFILE` if you use a named profile. Access keys through the standard AWS environment variables are another option; no separate Bedrock API key is used.
- **[Bedrock model IDs](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-sonnet-4-6.html)**: `BEDROCK_MODEL_ID` defaults to `us.anthropic.claude-sonnet-4-6`, and `BEDROCK_EMBED_MODEL_ID` defaults to [`amazon.titan-embed-text-v2:0`](https://docs.aws.amazon.com/bedrock/latest/userguide/titan-embedding-models.html). Use model IDs available to your account and region. `EMBED_DIMENSION` defaults to `1024` and must match the embedding model's output and the Atlas vector index.
- Run one ingestion at a time. A successful run removes obsolete chunks and pages excluded by `DOCS_LIMIT` from the Mastra documentation corpus. Failed runs retain older records, though pages written before the failure may already be updated.
- `DOCS_LIMIT` optionally limits how many pages the ingestion script reads from the documentation index; the default is `60`. The included example uses the [Mastra documentation index](https://mastra.ai/llms.txt).

## Quickstart 🚀

1. **Clone the template**
   - Run `npx create-mastra@latest --template mongodb-bedrock-agent`.
   - Run `cd mongodb-bedrock-agent` and `npm install`.
2. **Add your credentials**
   - Run `cp .env.example .env` and fill in the values described under Prerequisites.
3. **Load the documentation**
   - Run `npm run ingest` to embed the example documentation corpus and store it in Atlas. Check that the command finishes successfully and reports inserted chunks. A failed fetch, empty page, or embedding error stops the run before cleanup; retry after fixing the reported error.
4. **Start the dev server**
   - Run `npm run dev`.
   - Open [Mastra Studio](http://localhost:4111), select **Mastra Docs Agent**, and ask “How do I give a Mastra agent memory?” Look for an answer based on the retrieved documentation with a **Sources** list linking the pages used.

## Try it out

- In the same thread, ask “Show me that as a TypeScript snippet.” The agent can use the earlier question as context without you repeating it.
- Open the Studio trace for a question and follow the query embedding on Bedrock, vector search in Atlas, and answer generation.
- With the included example corpus, ask “How do I define a tool in Mastra?” and follow the rendered page and raw Markdown links in the **Sources** list to inspect the passages behind the answer.
- Stop `npm run dev`, start it again, and reopen the same thread. Ask a follow-up question to explore the conversation stored in MongoDB.

## Customization

- Open the project in your coding agent and describe the change you want. For example: “Adapt this docs assistant to our API reference. Explore the ingestion script, search tool, and agent instructions, then propose a plan before changing code.”
- To use your own documentation site, update `LLMS_TXT`, the link pattern, and the reconciliation URL filter in `scripts/ingest.ts`, adjust the subject in `src/mastra/agents/docs-agent.ts`, and run `npm run ingest` again.

For related memory concepts, see the [Mastra semantic recall documentation](https://mastra.ai/docs/memory/semantic-recall).

## Deploy to Amazon Bedrock AgentCore

`agent.ts` implements the AgentCore HTTP contract (`POST /invocations`, `GET /ping`) and maps each user and session pair to a Mastra memory thread. `agentcore/agentcore.json` declares the runtime; the `Dockerfile` builds the required ARM64 image.

1. Copy `agentcore/aws-targets.example.json` to `agentcore/aws-targets.json` and set your AWS account id and region.
2. In [AWS Secrets Manager](https://docs.aws.amazon.com/secretsmanager/latest/userguide/create_secret.html), create an **Other type of secret** in that region. Use the **Plaintext** editor and store only your MongoDB connection URI, without JSON or surrounding quotes. Use the default `aws/secretsmanager` encryption key.
3. Copy the secret's complete ARN into both `MONGODB_SECRET_ARN` in `agentcore/agentcore.json` and `Resource` in `agentcore/mongodb-secret-policy.json`, replacing the example ARN. Set `AWS_REGION` in the runtime configuration to the secret's region as well. The policy grants the runtime role access to that one secret.
4. Deploy and invoke the runtime:

```bash
npx @aws/agentcore@0.31.1 deploy
export AGENTCORE_USER_ID="your-own-operator-id"
npx @aws/agentcore@0.31.1 invoke --user-id "$AGENTCORE_USER_ID" --prompt "How do I define a tool in Mastra?"
```

`scripts/ask.sh "your question"` wraps that invoke call and renders the answer as Markdown in your terminal.

Invocation JSON is limited to 64 KiB (UTF-8 bytes), including requests without `Content-Length`. Larger uploads return HTTP 413; uploads that do not finish within 30 seconds return HTTP 408 and close the connection. These application limits apply independently of AgentCore service quotas.

This deployment uses IAM authentication. Restrict `bedrock-agentcore:InvokeAgentRuntime` and `bedrock-agentcore:InvokeAgentRuntimeForUser` to trusted operators or your backend and the specific runtime ARN. The CLI example is an operator demo, not end-user authentication.

For an app with multiple users, authenticate each user in your backend, derive `runtimeUserId` from that verified identity, and generate and store a separate `runtimeSessionId` for each conversation. Check ownership before reusing a session. Call `InvokeAgentRuntime` with those server-owned values; never forward user or session IDs supplied by a browser. Both AgentCore headers are required by this server, and identity fields in the JSON body are rejected. The memory key includes both IDs, so two users with the same session ID have separate histories.

The [AgentCore user-id header does not verify end-user identity](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-oauth.html). A principal allowed to invoke for users must therefore be trusted to supply the correct identity. Do not expose the container's HTTP port directly or grant these IAM permissions to untrusted end users. Local Studio is for development and should remain private.

The runtime uses its IAM execution role for Bedrock and calls Secrets Manager's `GetSecretValue` at startup to load the MongoDB URI. The URI stays out of the image and the deployment configuration. If you use a customer-managed KMS key instead of the default encryption key, grant the runtime role `kms:Decrypt` on that key and allow the role in the key policy.

Local development still reads `MONGODB_URI` from `.env`; it takes precedence when set. `agentcore/.env.local` does not inject arbitrary variables into a deployed runtime. To pick up a rotated secret, restart the runtime so it reads the new value.

## About Mastra templates

This is an official Mastra template for exploring documentation search with MongoDB Atlas and Amazon Bedrock. Official templates live in the [Mastra monorepo](https://github.com/mastra-ai/mastra) and are synchronized to standalone repositories.

[Want to contribute?](https://github.com/mastra-ai/mastra/blob/main/templates/template-mongodb-bedrock-agent/CONTRIBUTING.md)
