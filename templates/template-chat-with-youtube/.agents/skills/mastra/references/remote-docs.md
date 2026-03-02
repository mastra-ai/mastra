# Remote Docs Reference

How to look up current documentation from https://mastra.ai when local packages aren't available or you need conceptual guidance.

**Use this when:**

- Mastra packages aren't installed locally
- You need conceptual explanations or guides
- You want the latest documentation (may be ahead of installed version)

## Documentation site structure

Mastra docs are organized at **https://mastra.ai**:

- **Docs**: Core documentation covering concepts, features, and implementation details
- **Models**: Mastra provides a unified interface for working with LLMs across multiple providers
- **Guides**: Step-by-step tutorials for building specific applications
- **Reference**: API reference documentation

## Finding relevant documentation

### Method 1: Use llms.txt (Recommended)

The main llms.txt file provides an agent-friendly overview of all documentation: https://mastra.ai/llms.txt

This returns a structured markdown document with:

- Documentation organization and hierarchy
- All available topics and sections
- Direct links to relevant documentation
- Agent-optimized content structure

**Use this first** to understand what documentation is available and where to find specific topics.

### Method 2: Direct URL patterns

Documentation follows predictable URL patterns:

- Overview pages: `https://mastra.ai/docs/{topic}/overview`
- API reference: `https://mastra.ai/reference/{topic}/`
- Guides: `https://mastra.ai/guides/{topic}/`

**Examples:**

- `https://mastra.ai/docs/agents/overview`
- `https://mastra.ai/docs/workflows/overview`
- `https://mastra.ai/reference/workflows/workflow-methods/`

## Agent-friendly documentation

**Critical feature**: Send the `text-markdown` request header or add `.md` to any documentation URL to get clean, agent-friendly markdown.

### Standard URL:

```
https://mastra.ai/reference/workflows/workflow-methods/then
```

### Agent-friendly URL (Markdown):

```
https://mastra.ai/reference/workflows/workflow-methods/then.md
```

The `.md` version:

- Removes navigation, headers, footers
- Returns pure markdown content
- Optimized for LLM consumption
- Includes all code examples and explanations

## Lookup Workflow

### 1. Check the main documentation index

**Start here** to understand what's available:

```
https://mastra.ai/llms.txt
```

This provides:

- Complete documentation structure
- Available topics and sections
- Links to relevant documentation pages

### 2. Find relevant documentation

**Option A: Use information from llms.txt**
The main llms.txt will guide you to the right section.

**Option B: Construct URL directly**

```
https://mastra.ai/docs/{topic}/overview
https://mastra.ai/reference/{topic}/
```

### 3. Fetch agent-friendly version

Add `.md` to the end of any documentation URL:

```
https://mastra.ai/reference/workflows/workflow-methods/then.md
```

### 4. Extract relevant information

The markdown will include:

- Function signatures
- Parameter descriptions
- Return types
- Usage examples
- Best practices

## Common documentation paths

### Agents

- Overview: `https://mastra.ai/docs/agents/overview`
- Creating agents: `https://mastra.ai/docs/agents/creating-agents`
- Agent tools: `https://mastra.ai/docs/agents/tools`
- Memory: `https://mastra.ai/docs/agents/memory`

### Workflows

- Overview: `https://mastra.ai/docs/workflows/overview`
- Creating workflows: `https://mastra.ai/docs/workflows/creating-workflows`
- Workflow methods: `https://mastra.ai/reference/workflows/workflow-methods/`

### Tools

- Overview: `https://mastra.ai/docs/tools/overview`
- Creating tools: `https://mastra.ai/docs/tools/creating-tools`

### Memory

- Overview: `https://mastra.ai/docs/memory/overview`
- Configuration: `https://mastra.ai/docs/memory/configuration`

### RAG

- Overview: `https://mastra.ai/docs/rag/overview`
- Vector stores: `https://mastra.ai/docs/rag/vector-stores`

## Example: Looking up workflow .then() method

### 1. Check main documentation index

```
WebFetch({
  url: "https://mastra.ai/llms.txt",
  prompt: "Where can I find documentation about workflow methods like .then()?"
})
```

This will point you to the workflows reference section.

### 2. Fetch specific method documentation

```
https://mastra.ai/reference/workflows/workflow-methods/then.md
```

### 3. Use WebFetch tool

```
WebFetch({
  url: "https://mastra.ai/reference/workflows/workflow-methods/then.md",
  prompt: "What are the parameters for the .then() method and how do I use it?"
})
```

## When to use remote vs embedded docs

| Situation                  | Use                                                 |
| -------------------------- | --------------------------------------------------- |
| Packages installed locally | **Embedded docs** (guaranteed version match)        |
| Packages not installed     | **Remote docs**                                     |
| Need conceptual guides     | **Remote docs**                                     |
| Need exact API signatures  | **Embedded docs** (if available)                    |
| Exploring new features     | **Remote docs** (may be ahead of installed version) |
| Need working examples      | **Both** (embedded for types, remote for guides)    |

## Best practices

1. **Always use .md** for fetching documentation
2. **Check sitemap.xml** when unsure about URL structure
3. **Prefer embedded docs** when packages are installed (version accuracy)
4. **Use remote docs** for conceptual understanding and guides
5. **Combine both** for comprehensive understanding
