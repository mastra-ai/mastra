# Mastra Memory Documentation Checklist

This is a high level overview for the new info arch for Mastra Memory documentation

## The Story of Memory

1. Overview
   - [ ] 1.1. What is memory? Memory is the LLM context window
   - [ ] 1.2. Types of memory (long/short term)
   - [ ] 1.3. How Mastra handles memory (architecture overview)
2. Getting started
   - [ ] 2.1. Installation
   - [ ] 2.2. Adding memory to an agent
   - [ ] 2.3. Trying it out (playground)
3. Using memory
   - [ ] 3.1. Conversations and turn based interactions (Last messages)
   - [ ] 3.2. Recalling old messages (Semantic recall)
   - [ ] Add section on embedding performance
   - [ ] 3.3. Continuously relevant information (Working memory)
   - [ ] 3.4. Frontend UI (Matra client + useChat)
   - [ ] 3.5. Tuning for your LLM (token limits + tool call filters)
   - [ ] 3.6. Memory in workflows
4. Memory Threads
   - [ ] 4.1. What's a thread? What's a resource?
   - [ ] 4.2. How agents interact with memory threads
   - [ ] 4.3. Handling multiple users
   - [ ] 4.4. Building admin UIs to manage threads
   - [ ] 4.5. Auth?
5. Configuring memory
   - [ ] 5.1. Database adapters (storage, vector, and embedder)
   - [ ] 5.2. Defaults and recommended settings
6. Debugging memory
   - [ ] 6.1. Common issues and solutions
   - [ ] 6.2. Viewing thread data for debugging
   - [ ] 6.3. Troubleshooting semantic search

## Examples

- [ ] 1. Conversation
- [ ] 2. Semantic Recall (RAG)
- [ ] 3. Working memory
- [ ] 4. Frontend
- [ ] 5. Auth ? (w/ JWT and thread management)
- [ ] 6. DBs (Default, PG, Upstash, ?)
