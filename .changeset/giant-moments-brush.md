---
'create-mastra': major
'mastra': patch
---

Improved project creation with an agent-harness default, provider-native OpenAI, Anthropic, Google Gemini, and xAI setup, an empty scaffold mode, automatic skills, and automatic git initialization.

**Breaking change**

Removed the old project-name, default, components, example, source-directory, MCP, skills, and observability create flags and aliases. Use the positional project name with the new yes, empty, no-skills, and no-git options.

**Before**

```bash
create-mastra --project-name my-app --default --components agents,tools --no-example
```

**After**

```bash
create-mastra my-app --yes
create-mastra my-empty-app --empty --yes
```
