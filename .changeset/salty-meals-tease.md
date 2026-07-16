---
'mastra': minor
'create-mastra': major
---

Improved project creation with a new default template, provider-native OpenAI, Anthropic, Google Gemini, and xAI setup, an empty scaffold mode, automatic skills, and automatic git initialization.

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

This removes the classic component and example scaffold controls, custom source-directory selection, MCP editor setup, interactive skills selection, and observability provisioning from `create-mastra`/`mastra create`. Project names are now positional, managed projects use a new default template, skills are installed automatically for detected coding assistants, and git is initialized automatically. Use `--empty` for a minimal project, `--no-skills` to skip skills installation, or `--no-git` to skip git initialization. The separate `mastra init` command retains its existing MCP, skills, and observability setup.

**Migration examples**

Create the default managed project:

```bash
# Before
mastra create --project-name my-app --default

# After
mastra create my-app --yes
```

Create a minimal project instead of configuring components or examples:

```bash
# Before
mastra create --project-name my-app --components agents,tools --no-example

# After
mastra create my-app --empty --yes
```

Skip the new automatic post-create setup when needed:

```bash
mastra create my-app --yes --no-skills --no-git
```
