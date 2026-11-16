# Contributing

This repository is auto-generated from the [Mastra monorepo](https://github.com/mastra-ai/mastra). Pull requests opened in the synchronized standalone repository will be ignored.

To contribute:

1. Fork the [Mastra monorepo](https://github.com/mastra-ai/mastra).
2. Find this template in [templates/template-agent-workflow-billing](https://github.com/mastra-ai/mastra/tree/main/templates/template-agent-workflow-billing).
3. Make your changes and follow the [Mastra contribution guidelines](https://github.com/mastra-ai/mastra/blob/main/CONTRIBUTING.md).
4. Open a pull request against the monorepo.

A bot syncs accepted changes to the standalone repository.

## Validate changes

From the template root, use Node.js 22.13+ or 24 and run:

```sh
npm run check
npm run test:unit
npm run test:integration
npm run test:provider
npm run test:local
```

The local suites use real databases, Mastra servers and controlled HTTP model/provider endpoints. They don't require live credentials. Server fixtures run in temporary copies without your `.env`, private data or shared build output. `test:local` also checks a clean dependency installation.

For both supported Node versions, run `node scripts/test-node-compatibility.mjs --node22 /absolute/path/to/node22 --node24 /absolute/path/to/node24`.

`test:openai` and `test:autumn` are separate opt-in checks that use live services. Follow the [Autumn verification guide](docs/autumn.md#sdk-and-verification) before running the sandbox proof.
