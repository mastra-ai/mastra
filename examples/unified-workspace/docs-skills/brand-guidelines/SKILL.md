---
name: brand-guidelines
description: Applies Mastra's brand colors, typography, and writing style to documentation, code examples, or artifacts. Use when brand colors, style guidelines, visual formatting, or company design standards apply.
license: Apache-2.0
---

# Mastra Brand Guidelines

## Overview

Access Mastra's brand identity, style resources, and writing guidelines.

**Keywords**: branding, Mastra brand, documentation style, visual identity, brand colors, typography, writing guidelines, technical writing

## Writing Style Guidelines

### Voice & Tone

Mastra's documentation is written for **engineers, not marketers**. Focus on implementation details and technical precision.

**Core principles:**

- Technical and direct
- Implementation-first, benefit-second
- Factual and descriptive
- No marketing fluff or superlatives
- Clear code examples

### What to AVOID

**❌ Marketing adjectives:**

- "powerful", "built-in", "complete", "out-of-the-box", "hands-on"

**❌ Enthusiasm language:**

- "Check out", "Learn more", "Explore", "essential", "offers"

**❌ Marketing jargon:**

- "your needs", "production-ready", "makes it easy", "choose the right...solution"

**❌ Vague benefit phrases:**

- "without changing your code", "automatically handles"

**❌ Generic benefit-focused sentences** that glide between benefits without diving into details

### What to DO

**✅ Use technical descriptions:**

- State what features exist and how they work
- Provide specific implementation details
- Use concrete code examples
- Explain mechanisms, not just benefits

**✅ Good examples:**

- "Agents use LLMs and tools to solve open-ended tasks. They reason about goals, decide which tools to use, retain conversation memory, and iterate internally until the model emits a final answer."
- "Mastra requires a storage provider to persist memory and supports three types: PostgreSQL, LibSQL, and Redis."

**✅ Formatting rules:**

- All H1 headings use sentence case (e.g., "Getting started", "Human in-the-loop workflow")
- Code examples should be practical and runnable
- Keep explanations concise and specific

## Brand Colors

### Light Mode

**Primary Green:**

- Primary: `#0d8020`
- Dark: `#0b6e1b`
- Darker: `#0a6619`
- Darkest: `#085314`
- Light: `#177326`
- Lighter: `#198128`
- Lightest: `#1f9d2f`

**Green Accents:**

- Accent: `hsl(143, 97%, 54%)`
- Accent 2: `hsla(125, 66%, 50%, 1)`
- Accent 3: `hsla(143, 97%, 24%, 1)`
- Muted: `#84d291`
- Code: `#177326`

**Text Colors:**

- Primary: `#0a0a0a`
- Secondary: `#141414`
- Tertiary: `#5f5f5f`
- Quaternary: `#7f7e7e`
- Muted: `#8f8f8f`

**Surface Colors:**

- Surface 1: `#f0f0f0`
- Surface 2: `#f2f2f2`
- Surface 3: `#ededed`
- Surface 4: `#ebebeb`

**Borders:**

- Border: `#ccc`
- Border Subtle: `hsla(0, 0%, 80%, 1)`
- Border Code: `#b8b8b8`

**Background:**

- Background: `#fafafa`

### Dark Mode

**Primary Green:**

- Primary: `hsl(143, 97%, 54%)`
- Dark: `#2aed73`
- Darker: `#1fea6a`
- Darkest: `#16c858`
- Light: `#62f69d`
- Lighter: `#77f7ab`
- Lightest: `#a1fac7`

**Green Accents:**

- Accent: `hsl(143, 97%, 54%)`
- Accent 2: `hsla(125, 66%, 50%, 1)`

**Text Colors:**

- Primary: `#ffffff`
- Secondary: `#e6e6e6`
- Tertiary: `#939393`
- Quaternary: `#707070`

**Surface Colors:**

- Surface 1: `hsla(0, 0%, 8%, 1)`
- Surface 2: `hsla(0, 0%, 10%, 1)`
- Surface 3: `#121212`
- Surface 4: `#171717`

**Borders:**

- Border: `#343434`
- Border Subtle: `hsla(0, 0%, 19%, 1)`
- Border Code: `hsla(0, 0%, 26%, 1)`

**Background:**

- Background: `#050505`
- Code Background: `#171717`

### Syntax Highlighting

**Light Mode:**

- String: `#158d29`
- Keyword: `#d81717`
- Function: `#9829c7`
- Comment: `#939393`
- Variable: `#0a0a0a`
- Inserted: `#177326`
- Deleted: `#d81717`

**Dark Mode:**

- String: `#46f488`
- Keyword: `#fa7b6a`
- Function: `#d06bee`
- Comment: `#939393`
- Variable: `#fff`
- Inserted: `#62f69d`
- Deleted: `#d81717`

## Typography

### Fonts

**Primary Font:**

- Family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif
- Use for body text and UI elements

**Monospace Font:**

- Family: "Geist Mono", "Menlo", "Monaco", "Courier New", monospace
- Use for code blocks and inline code

### Font Sizes

- H1: `2.25rem` (36px)
- H2: `1.8rem` (28.8px)
- H3: `1.25rem` (20px)
- H4: `1.2rem` (19.2px)
- H5: `1rem` (16px)
- H6: `0.875rem` (14px)
- Base: `16px`
- Code: `0.875rem` (14px)

### Typography Rules

- Line height: `1.6` for body text
- Letter spacing: `-0.028em` for headings
- H2 and H3 headings have bottom borders
- Code font weight: `500`

## Company Information

**Product:**

- Name: Mastra
- Tagline: "TypeScript agent framework"
- Full description: "Mastra is a framework for building AI-powered applications and agents with a modern TypeScript stack."

**Technical Details:**

- Language: TypeScript
- License: MIT
- Target audience: Developers building AI applications
- Backed by: Y Combinator W25

**Contact:**

- Website: mastra.ai
- Security: security@mastra.ai
- GitHub: github.com/mastra-ai/mastra

## Key Features (Technical Descriptions)

When describing Mastra features, use these technical, factual descriptions:

**Agents:**

- "Agents use LLMs and tools to solve open-ended tasks. They reason about goals, decide which tools to use, retain conversation memory, and iterate internally until the model emits a final answer or an optional stop condition is met."

**Memory:**

- "Memory gives your agent coherence across interactions and allows it to improve over time by retaining relevant information from past conversations."

**Workflows:**

- "Workflows let you define complex sequences of tasks using clear, structured steps rather than relying on the reasoning of a single agent."

**Tools:**

- "Tools are functions that agents can execute. They extend agent capabilities by providing access to external systems, databases, APIs, or custom logic."

## Examples of Good vs Bad Writing

### ❌ BAD (Marketing-focused):

"This makes it easy to build AI applications that maintain meaningful conversations and remember important details, whether you're building a simple chatbot or a sophisticated AI assistant."

### ✅ GOOD (Technical, specific):

"Agents use a thread-based memory system. Each thread maintains conversation history and can optionally enable semantic recall to retrieve relevant context from past interactions using vector search."

### ❌ BAD (Vague benefits):

"Mastra makes it easy to deploy your AI agents to production without changing your code."

### ✅ GOOD (Specific implementation):

"Deploy agents using framework-agnostic adapters. The deployer package provides integrations for Vercel, Netlify, and Cloudflare Workers."

## Usage Guidelines

### When to Apply Brand Colors

- Documentation websites
- Code examples with syntax highlighting
- Diagrams and flowcharts
- UI components
- Marketing materials

### When to Apply Writing Style

- All documentation (docs.mastra.ai)
- README files
- Code comments describing features
- API reference documentation
- Tutorial content
- Blog posts about technical features

### When NOT to Apply Writing Guidelines

- Marketing website copy (more flexibility allowed)
- Social media posts (can be more casual)
- Internal team communications
- User-facing error messages (prioritize clarity)
