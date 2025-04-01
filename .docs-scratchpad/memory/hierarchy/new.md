This is a high level proposal for the new info arch for Mastra Memory documentation

## The story of Memory

1. Overview
   1. What is memory? Memory is the LLM context window
   2. Types of memory (long/short term)
   3. How Mastra handles memory (architecture overview)
2. Getting started
   1. Installation
   2. Adding memory to an agent
   3. Trying it out (playground)
3. Using memory
   1. Conversations and turn based interactions (Last messages)
   2. Recalling old messages (Semantic recall)
   3. Continuously relevant information (Working memory)
   4. Frontend UI (Matra client + useChat)
   5. Tuning for your LLM (token limits + tool call filters)
   6. Memory in workflows
4. Memory Threads
   1. What's a thread? What's a resource?
   2. How agents interact with memory threads
   3. Handling multiple users
   4. Building admin UIs to manage threads
   5. Auth?
5. Configuring memory
   1. Database adapters (storage, vector, and embedder)
   2. Defaults and recommended settings

## Examples

1. Conversation
2. Semantic Recall (RAG)
3. Working memory
4. Frontend
5. Auth ? (w/ JWT and thread management)
6. DBs (Default, PG, Upstash, ?)
