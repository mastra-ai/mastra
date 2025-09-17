# How to Add a New Template

To add a new template to the `templates/` directory, follow these steps:

## 1. Create a New Template Folder

- Inside the `templates/` directory, create a new folder named after your template (e.g., `my-new-template/`).

## 2. Required Files

Your template folder **must** include the following files:

### a. `package.json`

- Use `@ai-sdk/openai` as the LLM provider in your code/config.
- All `@mastra/*` dependencies should be set to `"latest"` in the `dependencies` section.
- `mastra` devDependency should be set to `"latest"` in the `devDependencies` section.
- The `description` field should clearly describe what the template does.

**Example:**

```json
{
  "name": "my-new-template",
  "version": "1.0.0",
  "description": "A template that demonstrates how to build an OpenAI-powered agent using Mastra.",
  "main": "index.js",
  "license": "Apache-2.0",
  "type": "module",

  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1",
    "dev": "mastra dev"
  },
  "dependencies": {
    "@mastra/core": "latest",
    "zod": "^3.25.67",
    "@mastra/loggers": "latest",
    "@ai-sdk/openai": "^1.3.23"
  },
  "devDependencies": {
    "@types/node": "^24.0.4",
    "mastra": "latest",
    "typescript": "^5.8.3"
  }
}
```

### b. `.env.example`

- List all required environment variables, such as API keys and configuration values.
- Use `***` as the default value for secrets or required fields.

**Example:**

```
OPENAI_API_KEY=***
OTHER_REQUIRED_VARIABLE=***
```

### c. `README.md`

- Clearly explain what the template does, its overview, and any setup steps.
- Mention that the template uses OpenAI as the LLM provider.
- List all required environment variables and what they are for.

**Example:**

```markdown
# My New Template

This template demonstrates how to build an agent using OpenAI as the LLM provider with Mastra.

## Overview

The overview of the template.

## Setup

1. Copy `.env.example` to `.env` and fill in your API keys.
2. Install dependencies: `pnpm install`
3. Run the project: `pnpm dev`.

## Environment Variables

- `OPENAI_API_KEY`: Your OpenAI API key. [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- `OTHER_REQUIRED_VARIABLE`: Description of what this variable is for.
```

## 3. Additional Recommendations

- Include any scripts or configuration files needed to run the template.
- Keep your code clean and well-commented.
- Test your template before submitting.

---

By following these steps, you’ll ensure your template is easy to use and consistent with the rest of the repository.
