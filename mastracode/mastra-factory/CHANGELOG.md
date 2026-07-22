# create-factory

## 0.0.3-alpha.0

### Patch Changes

- Added the `create-factory` CLI. It scaffolds a Mastra Software Factory project: enter a project name and the CLI clones the template, installs dependencies, and initializes git. Configuration (model providers, integrations, database) happens in the web UI on first load. ([#19609](https://github.com/mastra-ai/mastra/pull/19609))

  ```bash
  npm create factory my-factory
  cd my-factory
  npm run dev
  ```

## 0.0.2

### Patch Changes

- First real scaffold release for `npm create factory`. Clones the softwarefactory template, installs dependencies, initializes git, and prints next steps. Configuration (model providers, database, integrations) happens in the web UI on first load.

## 0.0.1

### Patch Changes

- Initial public package name claim.
