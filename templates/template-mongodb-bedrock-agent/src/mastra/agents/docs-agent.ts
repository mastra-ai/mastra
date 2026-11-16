import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { MongoDBStore } from '@mastra/mongodb';
import { bedrock, CHAT_MODEL_ID } from '../bedrock.js';
import { MONGODB_DATABASE, MONGODB_URI } from '../mongo.js';
import { docsSearchTool } from '../tools/docs-search-tool.js';

export const docsAgent = new Agent({
  id: 'docs-agent',
  name: 'Mastra Docs Agent',
  instructions: `You are a helpful assistant for the Mastra framework (the TypeScript
AI agent framework). Answer questions using ONLY the official Mastra documentation.

How to respond:
- FIRST call the docsSearchTool to retrieve relevant documentation.
- THEN write the answer. Base it strictly on the retrieved passages. If the docs don't cover
  it, say so plainly instead of guessing.
- Include short, correct TypeScript examples when they help.
- Preserve valid model IDs from retrieved documentation. When adapting an example for this
  template, use its configured Bedrock client and CHAT_MODEL_ID from src/mastra/bedrock.ts
  so it works with the same AWS credentials.
- Remember the user's stated preferences and prior questions within the conversation and
  build on them.
- End every answer with a "Sources:" section. For each source you used, output a bullet that
  links BOTH the rendered page and the raw markdown file, using the tool result's fields:
    - [<title>](<pageUrl>) — [markdown](<mdUrl>)
  Only include sources you actually drew from; do not invent URLs.`,
  model: bedrock(CHAT_MODEL_ID),
  tools: { docsSearchTool },
  // Conversation history + semantic recall persisted in MongoDB — the SAME Atlas
  // cluster that stores the RAG embeddings.
  memory: new Memory({
    storage: new MongoDBStore({
      id: 'mongodb-memory',
      uri: MONGODB_URI,
      dbName: MONGODB_DATABASE,
    }),
  }),
});
