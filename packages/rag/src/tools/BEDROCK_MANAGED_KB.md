# Bedrock Managed Knowledge Base Support

## Overview
Adds a Mastra RAG tool that queries Amazon Bedrock Knowledge Bases for managed retrieval within Mastra agents.

## Usage
```typescript
import { Agent } from '@mastra/core';
import { bedrockKnowledgeBaseTool } from '@mastra/rag/tools';

const kbTool = bedrockKnowledgeBaseTool({
  knowledgeBaseId: 'YOUR_KB_ID',
  region: 'us-east-1',
});

const agent = new Agent({
  name: 'research-agent',
  tools: { kb: kbTool },
  instructions: 'Use the knowledge base to answer questions.',
});
```

## Configuration
| Variable | Description | Default |
|---|---|---|
| KNOWLEDGE_BASE_ID | Bedrock Knowledge Base ID | None |
| AWS_REGION | AWS region for the KB | us-east-1 |
| AWS_ACCESS_KEY_ID | AWS access key | None |
| AWS_SECRET_ACCESS_KEY | AWS secret key | None |
| USE_AGENTIC_RETRIEVAL | Enable agentic retrieval | true |

## Features
- Managed search (no vector store needed)
- Agentic retrieval with query decomposition + reranking
- Automatic fallback to plain Retrieve if agentic fails
- Multi-source support (S3, Web, Confluence, SharePoint)
- Compatible with Mastra tool interface

## SDK Requirements
- @aws-sdk/client-bedrock-agent-runtime >= 3.700
- @mastra/core >= 0.1
- @mastra/rag >= 0.1

## Required IAM Permissions
```json
{
  "Effect": "Allow",
  "Action": [
    "bedrock:Retrieve",
    "bedrock:AgenticRetrieve"
  ],
  "Resource": "arn:aws:bedrock:<region>:<account-id>:knowledge-base/<kb-id>"
}
```

## References
- [Build a Managed Knowledge Base](https://docs.aws.amazon.com/bedrock/latest/userguide/kb-build-managed.html)
- [Retrieve API](https://docs.aws.amazon.com/bedrock/latest/userguide/kb-test-retrieve.html)
- [Agentic Retrieval](https://docs.aws.amazon.com/bedrock/latest/userguide/kb-test-agentic.html)
