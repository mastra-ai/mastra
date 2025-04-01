# Mastra Memory Documentation Checklist

This is a high level overview for the new info arch for Mastra Memory documentation

## The Story of Memory

1. Overview
   - [ ] 1.1. What is memory? Memory is the LLM context window
       - [x] Initial draft ./new-docs/1-overview/index.md
       - [ ] Pair review / edits
       - [ ] Compare with user feedback
       - [ ] Move into actual docs page
       - [ ] Add diagrams / illustrations
   - [ ] 1.2. Types of memory (long/short term)
       - [x] Initial draft ./new-docs/1-overview/index.md
       - [ ] Pair review / edits
       - [ ] Compare with user feedback
       - [ ] Move into actual docs page
   - [ ] 1.3. How Mastra handles memory (architecture overview)
       - [x] Initial draft ./new-docs/1-overview/index.md
       - [ ] Pair review / edits
       - [ ] Compare with user feedback
       - [ ] Move into actual docs page
       - [ ] Refine architecture diagram

2. Getting started
   - [ ] 2.1. Installation
       - [x] Initial draft ./new-docs/2-getting-started/index.md
       - [ ] Add package manager instructions (npm, pnpm, yarn)
       - [ ] Clarify that @mastra/memory needs to be installed separately
       - [ ] Add troubleshooting for common installation issues
       - [ ] Pair review / edits
       - [ ] Compare with user feedback
       - [ ] Move into actual docs page
   - [ ] 2.2. Adding memory to an agent
       - [x] Initial draft ./new-docs/2-getting-started/index.md
       - [ ] Pair review / edits
       - [ ] Compare with user feedback
       - [ ] Move into actual docs page
   - [ ] 2.3. Trying it out (playground)
       - [x] Initial draft ./new-docs/2-getting-started/index.md
       - [ ] Pair review / edits
       - [ ] Compare with user feedback
       - [ ] Move into actual docs page
       - [ ] Add screenshots of playground

3. Using memory
   - [ ] 3.1. Conversations and turn based interactions (Last messages)
       - [x] Initial draft ./new-docs/3-using-memory/3.1-last-messages.md
       - [ ] Pair review / edits
       - [ ] Compare with user feedback
       - [ ] Move into actual docs page
   - [ ] 3.2. Recalling old messages (Semantic recall)
       - [x] Initial draft ./new-docs/3-using-memory/3.2-semantic-recall.md
       - [ ] Pair review / edits
       - [ ] Compare with user feedback
       - [ ] Move into actual docs page
   - [ ] 3.3. Continuously relevant information (Working memory)
       - [x] Initial draft ./new-docs/3-using-memory/3.3-working-memory.md
       - [ ] Add clearer explanation of working memory modes (text-stream vs tool-call)
       - [ ] Explain working memory scoping (per thread, not per agent)
       - [ ] Add template design best practices
       - [ ] Include code examples for programmatically accessing/modifying working memory
       - [ ] Pair review / edits
       - [ ] Compare with user feedback
       - [ ] Move into actual docs page
       - [ ] Add diagrams illustrating working memory flow
   - [ ] 3.4. Frontend UI (Matra client + useChat)
       - [x] Initial draft ./new-docs/3-using-memory/3.4-frontend-integration.md
       - [ ] Pair review / edits
       - [ ] Compare with user feedback (omicrxn threads)
       - [ ] Move into actual docs page
       - [ ] Add React/Next.js example
   - [ ] 3.5. Tuning for your LLM (token limits + tool call filters)
       - [x] Initial draft ./new-docs/3-using-memory/3.5-token-management.md
       - [ ] Pair review / edits
       - [ ] Compare with user feedback
       - [ ] Move into actual docs page
       - [ ] Add performance metrics for different models
   - [ ] 3.6. Memory in workflows
       - [x] Initial draft ./new-docs/3-using-memory/3.6-memory-workflows.md
       - [ ] Pair review / edits
       - [ ] Compare with user feedback
       - [ ] Move into actual docs page

4. Memory Threads
   - [ ] 4.1. What's a thread? What's a resource?
       - [x] Initial draft ./new-docs/4-memory-threads/index.md
       - [ ] Add diagrams showing resource/thread relationship
       - [ ] Clarify why both resourceId and threadId are required
       - [ ] Explain best practices for ID formatting
       - [ ] Pair review / edits
       - [ ] Compare with user feedback
       - [ ] Move into actual docs page
   - [ ] 4.2. How agents interact with memory threads
       - [x] Initial draft ./new-docs/4-memory-threads/index.md
       - [ ] Add examples of multiple agents using the same thread
       - [ ] Explain memory sharing vs. isolation strategies
       - [ ] Pair review / edits
       - [ ] Compare with user feedback
       - [ ] Move into actual docs page
   - [ ] 4.3. Handling multiple users
       - [x] Initial draft ./new-docs/4-memory-threads/4.3-multiple-users.md
       - [ ] Pair review / edits
       - [ ] Compare with user feedback
       - [ ] Move into actual docs page
   - [ ] 4.4. Building admin UIs to manage threads
       - [x] Initial draft ./new-docs/4-memory-threads/4.4-admin-ui.md
       - [ ] Pair review / edits
       - [ ] Compare with user feedback
       - [ ] Move into actual docs page
       - [ ] Add UI mockups or screenshots
   - [ ] 4.5. Auth?
       - [x] Initial draft ./new-docs/4-memory-threads/4.5-auth.md
       - [ ] Pair review / edits
       - [ ] Compare with user feedback
       - [ ] Move into actual docs page

5. Configuring memory
   - [ ] 5.1. Database adapters (storage, vector, and embedder)
       - [x] Initial draft ./new-docs/5-configuring-memory/index.md
       - [ ] Pair review / edits
       - [ ] Compare with user feedback (satvik thread)
       - [ ] Move into actual docs page
       - [ ] Add performance comparison table
   - [ ] 5.2. Defaults and recommended settings
       - [x] Initial draft ./new-docs/5-configuring-memory/index.md
       - [ ] Pair review / edits
       - [ ] Compare with user feedback
       - [ ] Move into actual docs page
   - [ ] 5.3. Deployment options
       - [x] Initial draft ./new-docs/5-configuring-memory/5.3-deployment-options.md
       - [ ] Pair review / edits
       - [ ] Compare with user feedback (cristiandley, jpvaillancourt threads)
       - [ ] Move into actual docs page
       - [ ] Add sections for Mastra Cloud, Vercel, and Cloudflare

6. Debugging memory
   - [ ] 6.1. Common issues and solutions
       - [x] Initial draft ./new-docs/6-debugging-memory/index.md
       - [ ] Pair review / edits
       - [ ] Compare with user feedback (omicrxn, mundume threads)
       - [ ] Move into actual docs page
   - [ ] 6.2. Viewing thread data for debugging
       - [x] Initial draft ./new-docs/6-debugging-memory/index.md
       - [ ] Pair review / edits
       - [ ] Compare with user feedback
       - [ ] Move into actual docs page
   - [ ] 6.3. Troubleshooting semantic search
       - [x] Initial draft ./new-docs/6-debugging-memory/index.md
       - [ ] Pair review / edits
       - [ ] Compare with user feedback
       - [ ] Move into actual docs page

7. Frequently Asked Questions
   - [ ] 7.1. Common questions about memory
       - [x] Initial draft .docs-scratchpad/memory/new-docs/7-faq/index.md
       - [ ] Pair review / edits
       - [ ] Compare with user feedback
       - [ ] Move into actual docs page
   - [ ] 7.2. Working memory questions and best practices
       - [x] Combined into .docs-scratchpad/memory/new-docs/7-faq/index.md
       - [ ] Pair review / edits
       - [ ] Compare with user feedback
       - [ ] Move into actual docs page
   - [ ] 7.3. Thread and resource management
       - [x] Included in .docs-scratchpad/memory/new-docs/7-faq/index.md
       - [ ] Pair review / edits
       - [ ] Compare with user feedback
       - [ ] Move into actual docs page
   - [ ] 7.4. Database and deployment troubleshooting
       - [x] Included in .docs-scratchpad/memory/new-docs/7-faq/index.md
       - [ ] Pair review / edits
       - [ ] Compare with user feedback
       - [ ] Move into actual docs page

## Examples

1. Conversation
   - [x] Initial draft ./new-docs/examples/conversation.md
   - [ ] Pair review / edits
   - [ ] Compare with user feedback
   - [ ] Move into actual docs page
   - [ ] Test code examples

2. Semantic Recall (RAG)
   - [x] Initial draft ./new-docs/examples/semantic-recall.md
   - [ ] Pair review / edits
   - [ ] Compare with user feedback
   - [ ] Move into actual docs page
   - [ ] Test code examples

3. Working memory
   - [x] Initial draft ./new-docs/examples/working-memory.md
   - [ ] Pair review / edits
   - [ ] Compare with user feedback
   - [ ] Move into actual docs page
   - [ ] Test code examples

4. Frontend
   - [x] Initial draft ./new-docs/examples/frontend.md
   - [ ] Pair review / edits
   - [ ] Compare with user feedback (omicrxn threads)
   - [ ] Move into actual docs page
   - [ ] Test code examples

5. Auth ? (w/ JWT and thread management)
   - [x] Initial draft ./new-docs/examples/auth.md
   - [ ] Pair review / edits
   - [ ] Compare with user feedback
   - [ ] Move into actual docs page
   - [ ] Test code examples

6. DBs (Default, PG, Upstash, ?)
   - [x] Initial draft ./new-docs/examples/database.md
   - [ ] Pair review / edits
   - [ ] Compare with user feedback (mundume, jpvaillancourt, cristiandley threads)
   - [ ] Move into actual docs page
   - [ ] Test code examples

## Final Steps

1. Cross-link related sections
   - [ ] 1.1. Add internal links between related content
   - [ ] 1.2. Ensure navigation is intuitive

2. Documentation quality
   - [ ] 2.1. Add API reference links
   - [ ] 2.2. Review for consistency across pages
   - [ ] 2.3. SEO optimization

3. User experience
   - [ ] 3.1. User feedback collection setup
   - [ ] 3.2. Ensure documentation addresses common Discord questions
   - [ ] 3.3. Link FAQ answers to relevant documentation sections
