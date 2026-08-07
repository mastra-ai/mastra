# MastraCode contributor guide

Use this guide to find the right package and run Factory locally.

## Packages

| Package                                        | Responsibility                                            |
| ---------------------------------------------- | --------------------------------------------------------- |
| [`factory`](./factory/README.md)               | Factory backend: storage, routes, rules, and integrations |
| [`factory-ui`](./factory-ui/README.md)         | Factory React application and browser tests               |
| [`web`](./web/README.md)                       | Local and deployable Factory host                         |
| [`sdk`](./sdk/README.md)                       | Shared coding-agent runtime                               |
| [`tui`](./tui/README.md)                       | Terminal interface                                        |
| [`mastra-factory`](./mastra-factory/README.md) | `create-factory` scaffolder                               |

## Setup

From the repository root:

```shell
pnpm install
pnpm --dir mastracode/web install
pnpm --dir mastracode/web run prebuild
```

The web host is a separate pnpm project. `prebuild` builds the local packages it links to.

## Run Factory

First complete the [local GitHub App setup](./web/README.md#configure-local-onboarding).

For backend work, run the API and bundled UI together:

```shell
pnpm --dir mastracode/web dev
```

Open `http://localhost:5873`.

For UI work with hot module replacement, run the API and the Vite dev server together:

```shell
pnpm --filter ./mastracode/factory-ui web
```

Open `http://localhost:5173`. To run them in separate terminals instead, use `pnpm --filter ./mastracode/factory-ui web:api` and `pnpm --filter ./mastracode/factory-ui dev`.
