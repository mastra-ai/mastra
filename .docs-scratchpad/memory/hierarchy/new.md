# Monday To-Do List (Memory Documentation Review)

## Documentation Review Tasks
- [ ] Review all MDX files in the memory documentation section in order
- [ ] Check content, examples, and cross-links in each file
- [ ] Ensure consistent tone and formatting across all pages
- [ ] Verify that code examples are correct and up-to-date
- [ ] Shorten overly long H1 headings that wrap to multiple lines

## Missing Content to Create
- [ ] Create deployment options documentation
  - [ ] Outline considerations for different hosting providers
  - [ ] Document database requirements for each hosting environment 
  - [ ] Add specific instructions for Vercel, Netlify, and Cloudflare
- [x] Add Mastra memory features list to overview page
  - [x] Include links to each feature page with one-sentence descriptions
- [ ] Consider adding tool calling page under memory section
  - [ ] Document the tool call filter processor
  - [ ] Explain how tool calling interacts with memory
- [x] Add link to memory processors reference page in token management section
- [x] Create text diagram for context window in overview page
  - [x] Visualize the structure of a context window and its components
  - [x] Show how different types of information are organized in the context
- [ ] Generate proper images for diagrams
  - [ ] Use ChatGPT to create professional images for text-based diagrams
  - [ ] If needed, create mermaid diagrams as an alternative
- [x] Streamline Getting Started page
  - [x] Address repetition between Installation, Adding Memory, Using Memory, and Trying It Out sections
  - [x] Either consolidate similar content or reorganize for better flow
  - [x] Consider making Trying It Out the primary example and simplifying earlier sections
- [ ] Restructure Memory Features Documentation
  - [ ] Create new page `/docs/memory/features.mdx`
  - [ ] Move "Mastra Memory Features" list from `overview.mdx` to `features.mdx`
  - [ ] Move "Memory Request Flow" diagram from `overview.mdx` to `features.mdx`
  - [ ] Consider moving `last-messages.mdx`, `semantic-recall.mdx`, `working-memory.mdx` to `/docs/reference/memory/`
  - [ ] Update links in `overview.mdx` and `features.mdx` to point to new locations (or reference pages)
  - [ ] Update `/docs/memory/_meta.ts` to place "Features" after "Getting Started" and potentially remove individual feature pages if moved to reference

## Redirects and Integration
- [ ] Update the existing agents memory page
  - [ ] Either redirect to the new memory overview
  - [ ] Or update with minimal content that links to the new memory section
- [ ] Reorder pages in _meta.ts
  - [ ] Move the architecture page above the FAQ in the navigation
  - [ ] Move memory threads higher in the sidebar (above similarity search or conversation history)

## Final Validation
- [ ] Test all links between documentation pages
- [ ] Ensure navigation is intuitive and logical
- [ ] Review for any missing content or gaps in the documentation

## Documentation Writing Guidelines
- [ ] Avoid marketing adjectives (e.g., "powerful", "built-in", "complete", "out-of-the-box", "hands-on").
- [ ] Avoid marketing phrases (e.g., "production-ready", "makes it easy", "choose the right...solution").
- [ ] Avoid overly enthusiastic exhortations (e.g., "Check out", "Learn more", "Explore").
- [ ] Avoid vague benefit-oriented language (e.g., "without changing your code", "automatically handles").
- [ ] Focus on technical details, specifics, and "nuts and bolts" rather than high-level benefits.
- [ ] Use neutral, objective language suitable for an engineering audience.

---

# Mastra Memory Documentation Checklist

This is a high level overview for the new info arch for Mastra Memory documentation

## The Story of Memory

1. Overview
   - [ ] 1.1. What is memory? Memory is the LLM context window
       - [x] Initial draft ./new-docs/1-overview/index.md
       - [x] Pair review / edits
       - [x] Compare with user feedback
       - [ ] Move into actual docs page
       - [ ] Add diagrams / illustrations
   - [ ] 1.2. Types of memory (long/short term)
       - [x] Initial draft ./new-docs/1-overview/index.md
       - [x] Pair review / edits
       - [x] Compare with user feedback
       - [ ] Move into actual docs page
   - [ ] 1.3. How Mastra handles memory (architecture overview)
       - [x] Initial draft ./new-docs/1-overview/index.md
       - [x] Pair review / edits
       - [x] Compare with user feedback
       - [ ] Move into actual docs page
       - [ ] Refine architecture diagram

2. Getting started
   - [ ] 2.1. Installation
       - [x] Initial draft ./new-docs/2-getting-started/index.md
       - [x] Add package manager instructions (npm, pnpm, yarn)
       - [x] Clarify that @mastra/memory needs to be installed separately
       - [ ] Add troubleshooting for common installation issues
       - [x] Pair review / edits
       - [x] Compare with user feedback
       - [ ] Move into actual docs page
   - [ ] 2.2. Adding memory to an agent
       - [x] Initial draft ./new-docs/2-getting-started/index.md
       - [x] Pair review / edits
       - [x] Compare with user feedback
       - [ ] Move into actual docs page
   - [ ] 2.3. Trying it out (playground)
       - [x] Initial draft ./new-docs/2-getting-started/index.md
       - [x] Pair review / edits
       - [x] Compare with user feedback
       - [ ] Move into actual docs page
       - [ ] Add screenshots of playground

3. Using memory
   - [ ] 3.1. Conversations and turn based interactions (Last messages)
       - [x] Initial draft ./new-docs/3-using-memory/3.1-last-messages.md
       - [x] Pair review / edits
       - [x] Compare with user feedback
       - [ ] Move into actual docs page
   - [ ] 3.2. Recalling old messages (Semantic recall)
       - [x] Initial draft ./new-docs/3-using-memory/3.2-semantic-recall.md
       - [x] Pair review / edits
       - [ ] Compare with user feedback
       - [ ] Move into actual docs page
   - [x] 3.3. Continuously relevant information (Working memory)
       - [x] Initial draft ./new-docs/3-using-memory/3.3-working-memory.md
       - [x] Add clearer explanation of working memory modes (text-stream vs tool-call)
       - [x] Explain working memory scoping (per thread, not per agent)
       - [x] Add template design best practices (Removed - integrated into main text)
       - [x] Include code examples for programmatically accessing/modifying working memory (Removed)
       - [x] Pair review / edits
       - [x] Compare with user feedback
       - [x] Move into actual docs page
       - [ ] Add diagrams illustrating working memory flow
   - [x] 3.4. Frontend UI (Matra client + useChat)
       - [x] Initial draft ./new-docs/3-using-memory/3.4-frontend-integration.md
       - [x] Pair review / edits
       - [x] Compare with user feedback (omicrxn threads)
       - [x] Move into actual docs page
       - [x] Add React/Next.js example
   - [ ] 3.5. Tuning for your LLM (token limits + tool call filters)
       - [x] Initial draft ./new-docs/3-using-memory/3.5-token-management.md
       - [x] Pair review / edits
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
       - [x] Add diagrams showing resource/thread relationship
       - [x] Clarify why both resourceId and threadId are required
       - [x] Explain best practices for ID formatting
       - [x] Pair review / edits
       - [ ] Compare with user feedback
       - [ ] Move into actual docs page
   - [ ] 4.2. How agents interact with memory threads
       - [x] Initial draft ./new-docs/4-memory-threads/index.md
       - [x] Add examples of multiple agents using the same thread
       - [x] Explain memory sharing vs. isolation strategies
       - [x] Pair review / edits
       - [ ] Compare with user feedback
       - [ ] Move into actual docs page
   - [ ] 4.3. Handling multiple users
       - [x] Content merged into ./new-docs/4-memory-threads/index.md
       - [x] Add examples of using memory with multiple users
       - [x] Add examples of multiple threads per user
       - [x] Add thread management and retrieval section
       - [x] Pair review / edits
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