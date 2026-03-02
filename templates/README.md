# How to add a new template

To add a new template to the `templates/` directory, follow these steps:

## 1. Create a new template folder

- Inside the `templates/` directory, create a new folder named after your template (e.g., `my-new-template/`).

## 2. Required files

Your template folder **must** include the following files:

### a. `package.json`

- Use OpenAI as the LLM provider in your code/config.
- All `@mastra/*` dependencies should be set to `"latest"` in the `dependencies` section.
- `mastra` devDependency should be set to `"latest"` in the `devDependencies` section.
- The `description` field should clearly describe what the template does.

### b. `.env.example`

- List all required environment variables, such as API keys and configuration values.

### c. `README.md`

Follow this template for your `README.md`:

````markdown
# Title

Introductory paragraph describing what this template does.

## Why we built this

Explain the motivation behind creating this template and the problem it solves. And which features of Mastra it demonstrates.

## Demo

This demo runs in Mastra Studio, but you can connect this workflow to your React, Next.js, or Vue app using the [Mastra Client SDK](https://mastra.ai/docs/server/mastra-client) or agentic UI libraries like [AI SDK UI](https://mastra.ai/guides/build-your-ui/ai-sdk-ui), [CopilotKit](https://mastra.ai/guides/build-your-ui/copilotkit), or [Assistant UI](https://mastra.ai/guides/build-your-ui/assistant-ui).

## Prerequisites

- [OpenAI API key](https://platform.openai.com/api-keys): Used by default, but you can swap in any model

## Quickstart 🚀

1. **Clone the template**
   - Run `npx create-mastra@latest --template TEMPLATE_NAME` to scaffold the project locally.
2. **Add your API keys**
   - Copy `.env.example` to `.env` and fill in your keys.
3. **Start the dev server**
   - Run `npm run dev` and open [localhost:4111](http://localhost:4111) to try it out.

## Making it yours

Explain how they can use it and how they can customize it for their needs.

## About Mastra templates

[Mastra templates](https://mastra.ai/templates) are ready-to-use projects that show off what you can build — clone one, poke around, and make it yours. They live in the [Mastra monorepo](https://github.com/mastra-ai/mastra) and are automatically synced to standalone repositories for easier cloning.

Want to contribute? See [CONTRIBUTING.md](./CONTRIBUTING.md).
````

### d. `CONTRIBUTING.md`

Create a `CONTRIBUTING.md` file:

````markdown
# Contributing

This repository is auto-generated from the [Mastra monorepo](https://github.com/mastra-ai/mastra). Pull requests opened here will be ignored.

To contribute:

1. Fork the [Mastra monorepo](https://github.com/mastra-ai/mastra)
2. Find this template in `templates/TEMPLATE_NAME`
3. Make your changes
4. Open a pull request against the monorepo

A bot syncs accepted changes to this repository.
````
