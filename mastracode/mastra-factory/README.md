# create-factory

Create your own **Mastra Software Factory**, an open-source, agent-powered software delivery environment built on [Mastra](https://mastra.ai).

```bash
npm create factory
```

The CLI is intentionally minimal: It asks for a project name, clones the [softwarefactory-template](https://github.com/mastra-ai/softwarefactory-template), installs dependencies, and initializes git.

Run `npm run dev` and finish the setup (model providers, integrations, database) from the web UI on first load.

## Usage

```text
Usage: create-factory [options] [project-name]

Create a new Mastra Software Factory project

Arguments:
  project-name                Directory name of the project

Options:
  --template <template-name>  Create a project from a template (public GitHub URL) (default: "https://github.com/mastra-ai/softwarefactory-template")
  -v, --version               output the version number
  -h, --help                  display help for command
```

## License

Apache-2.0
