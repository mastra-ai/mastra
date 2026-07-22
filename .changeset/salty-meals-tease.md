---
'mastra': minor
'create-mastra': minor
---

Improved project creation with a new default template, provider-native OpenAI, Anthropic, Google Gemini, and xAI setup, an empty scaffold mode, automatic skills, automatic git initialization, and interactive Mastra platform setup.

**Breaking change**

The following `create-mastra`/`mastra create` flags and aliases were removed:

- `-p, --project-name`
- `--default`
- `-d, --dir`
- `-c, --components`
- `-e, --example` and `--no-example`
- `-m, --mcp`
- `--skills`
- `--observe`, `--no-observe`, `--observability`, `--no-observability`, and `--observability-project`

This removes the classic component and example scaffold controls, custom source-directory selection, MCP editor setup, interactive skills selection, and observability CLI flags from `create-mastra`/`mastra create`. Project names are now positional, managed projects use a new default template, skills are installed automatically for detected coding assistants, and git is initialized automatically. Interactive managed creation offers Mastra platform setup through a browser authentication prompt, creates a platform project with the local project name, and writes its credentials to `.env`. Prompt-free creation can add platform afterward with `mastra init`. Use `--empty` for a minimal project, `--no-skills` to skip skills installation, or `--no-git` to skip git initialization. The separate `mastra init` command retains its existing MCP, skills, and observability setup.

**Migration examples**

Create the default managed project:

```bash
# Before
npx create-mastra@latest --project-name my-app --default

# After
npx create-mastra@latest my-app --llm openai
```

Create a minimal project instead of configuring components or examples:

```bash
# Before
npx create-mastra@latest --project-name my-app --components agents,tools --no-example

# After
npx create-mastra@latest my-app --empty
```

Skip the new automatic post-create setup when needed:

```bash
npx create-mastra@latest my-app --llm openai --no-skills --no-git
```
