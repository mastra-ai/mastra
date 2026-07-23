# create-factory

Scaffolding CLI for the **Mastra Factory** — an open-source, agent-powered software delivery environment built on [Mastra](https://mastra.ai).

```bash
npm create factory
```

The CLI is intentionally minimal: it asks for a project name, clones the [softwarefactory-template](https://github.com/mastra-ai/softwarefactory-template), installs dependencies, and initializes git. That's it — run `npm run dev` and finish setup (model providers, integrations, database) from the web UI on first load.

## Flags

```text
Usage: create-factory [options] [project-name]

Create a new Mastra Factory project

Arguments:
  project-name                Directory name of the project

Options:
  --template <template-name>  Create a project from a template (public GitHub URL) (default: "https://github.com/mastra-ai/softwarefactory-template")
  --no-platform               Skip Mastra platform sign-in, project, and Neon provisioning
  --org <org>                 Mastra organization id or name — skips the interactive org picker
  --region <region>           Platform project region (eu or us); prompts when omitted
  -v, --version               output the version number
  -h, --help                  display help for command
```

## License

Apache-2.0
