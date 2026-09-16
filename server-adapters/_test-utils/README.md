# @mastra/server-adapters-test-suite

Reusable conformance test suites for authors of Mastra server adapters.

## Installation

Install the suite with its peer dependencies in your adapter's development environment:

```bash
npm install @mastra/server-adapters-test-suite
```

The package requires Mastra Core and Server `>=1.64.0-0 <2.0.0-0`, Vitest `>=4.0.0 <5.0.0`, and Zod `^3.25.0 || ^4.0.0`. Install those peer dependencies in your adapter's development environment.

## Usage

Provide framework-specific setup and request execution functions to the shared suite:

```typescript
import { createRouteAdapterTestSuite } from '@mastra/server-adapters-test-suite';
import { executeHttpRequest, setupAdapter } from './adapter-test-helpers';

createRouteAdapterTestSuite({
  suiteName: 'My server adapter',
  setupAdapter,
  executeHttpRequest,
});
```

Additional root exports cover MCP routes and transports, multipart requests, HTTP logging, and request body limits.

## Documentation

- [Custom server adapters](https://mastra.ai/docs/server/custom-adapters#test-adapter-compatibility)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/server-adapters/_test-utils/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
