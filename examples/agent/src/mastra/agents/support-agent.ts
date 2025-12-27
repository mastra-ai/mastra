import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { RetrievedKnowledge, StaticKnowledge } from '@mastra/knowledge';

/**
 * Static knowledge processor - includes fixed policy info in every response.
 * Reads from static/* artifacts in the knowledge store.
 */
const companyPoliciesProcessor = new StaticKnowledge({
  namespace: 'default',
  format: 'markdown',
});

/**
 * Retrieved knowledge processor - dynamically fetches relevant FAQ docs based on user query.
 */
const faqRetrieverProcessor = new RetrievedKnowledge({
  namespace: 'default',
  topK: 3, // Get top 3 most relevant documents
  mode: 'bm25', // Use BM25 keyword search (fast, no embeddings needed)
  format: 'xml', // Format as XML for better LLM parsing
});

/**
 * Support agent that uses knowledge retrieval to answer customer questions.
 *
 * This agent demonstrates:
 * 1. RetrievedKnowledge - dynamically retrieves relevant FAQ docs based on user query
 * 2. StaticKnowledge - includes fixed policy info in every response
 * 3. BM25 search - fast keyword-based retrieval without embeddings
 */
export const supportAgent = new Agent({
  id: 'support-agent',
  name: 'Support Agent',
  description: 'A helpful support agent that answers questions using a knowledge base of FAQs and documentation.',
  instructions: `You are a friendly and helpful customer support agent.

Your job is to help customers with their questions using the knowledge provided to you.

Guidelines:
- Always base your answers on the provided knowledge
- If the knowledge doesn't contain the answer, say so honestly
- Be concise but thorough
- Use step-by-step formatting when explaining procedures
- If a question is ambiguous, ask for clarification
- For billing questions, remind users they can email billing@example.com
- For urgent issues, mention urgent@example.com`,

  model: openai('gpt-4o-mini'),

  // Input processors inject knowledge into the context before the LLM call
  inputProcessors: [
    companyPoliciesProcessor, // Static: always included
    faqRetrieverProcessor, // Dynamic: searches based on query
  ],
});

/**
 * Alternative support agent using hybrid search (requires vector embeddings).
 * Uncomment and configure if you want semantic + keyword search.
 */
// import { Knowledge } from '@mastra/knowledge';
//
// const hybridKnowledge = new Knowledge({
//   provider: 'PINECONE',
//   apiKey: process.env.PINECONE_API_KEY,
//   indexName: 'support-docs',
//   model: openai.embedding('text-embedding-3-small'),
//   bm25: true,
// });
//
// const hybridProcessor = new RetrievedKnowledge({
//   knowledge: hybridKnowledge,
//   topK: 5,
//   mode: 'hybrid',
//   hybrid: { vectorWeight: 0.7 }, // 70% semantic, 30% keyword
// });
//
// export const hybridSupportAgent = new Agent({
//   id: 'hybrid-support-agent',
//   name: 'Hybrid Support Agent',
//   model: openai('gpt-4o'),
//   inputProcessors: [hybridProcessor],
// });
