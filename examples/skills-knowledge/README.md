# Skills + Knowledge Example

This example demonstrates both Skills and Knowledge primitives working together with Mastra agents.

## Overview

- **Skills**: Domain-specific instructions (SKILL.md files) that agents activate on-demand using tools
- **Knowledge**: Factual content (FAQs, docs) that is automatically retrieved based on user queries

## Structure

```
examples/skills-knowledge/
├── skills/                    # Global skills (inherited by all agents)
│   ├── api-design/
│   ├── code-review/
│   └── customer-support/
├── docs-skills/               # Agent-specific skills (docs agent only)
│   └── brand-guidelines/
├── .mastra-knowledge/         # Knowledge storage
│   └── knowledge/support/     # Support FAQ knowledge base
├── src/
│   ├── mastra/
│   │   ├── agents/
│   │   │   ├── skills-agent.ts    # Agent with own skills (brand-guidelines)
│   │   │   ├── developer-agent.ts # Agent inheriting global skills
│   │   │   └── knowledge-agent.ts # Agent using RetrievedKnowledge
│   │   ├── knowledge/
│   │   │   └── index.ts           # Knowledge setup and sample data
│   │   └── index.ts               # Mastra instance
│   ├── demo.ts                # Combined demo
│   ├── demo-skills.ts         # Skills-only demo
│   └── demo-knowledge.ts      # Knowledge-only demo
└── package.json
```

## Running the Demos

```bash
# Install dependencies
pnpm install

# Run combined demo (recommended)
pnpm demo

# Run skills-only demo
pnpm demo:skills

# Run knowledge-only demo
pnpm demo:knowledge
```

## Key Concepts

### Skills

Skills are domain expertise packaged as SKILL.md files. The agent decides when to activate them.

**Default behavior**: Agents automatically inherit skills from Mastra.

```typescript
import { Skills } from '@mastra/skills';

// Default: Agent inherits skills from Mastra (no config needed)
const agent = new Agent({
  // skills are inherited automatically
});

// Agent-specific skills (replaces inherited)
const mySkills = new Skills({
  id: 'my-skills',
  paths: ['./my-skills'],
});

const agent = new Agent({
  skills: mySkills, // Uses only these skills, not Mastra's
});

// Disable skills entirely
const agent = new Agent({
  skills: false, // No skills
});
```

### Knowledge (RetrievedKnowledge)

Knowledge is factual content that's automatically retrieved based on the user's query.

```typescript
import { RetrievedKnowledge, StaticKnowledge } from '@mastra/skills';

const agent = new Agent({
  inputProcessors: [
    new StaticKnowledge({ format: 'markdown' }), // Always included
    new RetrievedKnowledge({ topK: 3, mode: 'bm25' }), // Query-based
  ],
  // ...
});
```

#### Namespaces

Knowledge is organized into namespaces. Each `RetrievedKnowledge` processor searches a single namespace (defaults to `'default'`). To search a different namespace:

```typescript
new RetrievedKnowledge({
  namespace: 'faq', // Search the 'faq' namespace instead of 'default'
  topK: 3,
  mode: 'bm25',
});
```

To search multiple namespaces, use multiple processors:

```typescript
const agent = new Agent({
  inputProcessors: [
    new RetrievedKnowledge({ namespace: 'faq', topK: 3 }),
    new RetrievedKnowledge({ namespace: 'docs', topK: 3 }),
  ],
});
```

## Comparison

| Aspect    | Skills                 | Knowledge             |
| --------- | ---------------------- | --------------------- |
| Content   | SKILL.md files         | Arbitrary documents   |
| Retrieval | Tool-based (on-demand) | Processor (automatic) |
| Use case  | Domain expertise       | Factual content       |
| Example   | Brand guidelines       | FAQ documents         |
