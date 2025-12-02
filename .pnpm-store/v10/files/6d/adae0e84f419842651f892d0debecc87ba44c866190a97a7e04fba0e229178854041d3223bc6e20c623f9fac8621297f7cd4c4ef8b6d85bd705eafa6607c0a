![hero illustration](./assets/banner.png)

# OpenRouter SDK (Beta)

The [OpenRouter SDK](https://openrouter.ai/docs/sdks/typescript) is a TypeScript toolkit designed to help you build AI-powered features and solutions in any JS or TS based runtime. Giving you easy access to over 300 models across providers in an easy and type-safe way.

To learn more about how to use the OpenRouter SDK, check out our [API Reference](https://openrouter.ai/docs/sdks/typescript/reference) and [Documentation](https://openrouter.ai/docs/sdks/typescript).

<!-- No Summary [summary] -->

<!-- No Table of Contents [toc] -->

<!-- Start SDK Installation [installation] -->
## SDK Installation

The SDK can be installed with either [npm](https://www.npmjs.com/), [pnpm](https://pnpm.io/), [bun](https://bun.sh/) or [yarn](https://classic.yarnpkg.com/en/) package managers.

### NPM

```bash
npm add @openrouter/sdk
```

### PNPM

```bash
pnpm add @openrouter/sdk
```

### Bun

```bash
bun add @openrouter/sdk
```

### Yarn

```bash
yarn add @openrouter/sdk
```

> [!NOTE]
> This package is published as an ES Module (ESM) only. For applications using
> CommonJS, use `await import("@openrouter/sdk")` to import and use this package.
<!-- End SDK Installation [installation] -->

<!-- Start Requirements [requirements] -->
## Requirements

For supported JavaScript runtimes, please consult [RUNTIMES.md](RUNTIMES.md).
<!-- End Requirements [requirements] -->

<!-- No SDK Example Usage [usage] -->
## SDK Usage

```typescript
import { OpenRouter } from "@openrouter/sdk";

const openRouter = new OpenRouter();

const result = await openRouter.chat.send({
  messages: [
    {
      role: "user",
      content: "Hello, how are you?",
    },
  ],
  model: "openai/gpt-5",
  provider: {
    zdr: true,
    sort: "price",
  },
  stream: true
});

for await (const chunk of result) {
  console.log(chunk.choices[0].delta.content)
}

```

<!-- No Authentication [security] -->

<!-- No Available Resources and Operations [operations] -->

<!-- No Standalone functions [standalone-funcs] -->

<!-- No React hooks with TanStack Query [react-query] -->

<!-- No Server-sent event streaming [eventstream] -->

<!-- No Retries [retries] -->

<!-- No Error Handling [errors] -->

<!-- No Server Selection [server] -->

<!-- No Custom HTTP Client [http-client] -->

<!-- Start Debugging [debug] -->
## Debugging

You can setup your SDK to emit debug logs for SDK requests and responses.

You can pass a logger that matches `console`'s interface as an SDK option.

> [!WARNING]
> Beware that debug logging will reveal secrets, like API tokens in headers, in log messages printed to a console or files. It's recommended to use this feature only during local development and not in production.

```typescript
import { OpenRouter } from "@openrouter/sdk";

const sdk = new OpenRouter({ debugLogger: console });
```

You can also enable a default debug logger by setting an environment variable `OPENROUTER_DEBUG` to true.
<!-- End Debugging [debug] -->

<!-- Placeholder for Future Speakeasy SDK Sections -->

# Development

## Running Tests

To run the test suite, you'll need to set up your environment with an OpenRouter API key.

### Local Development

1. Copy the example environment file:

   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your OpenRouter API key:

   ```bash
   OPENROUTER_API_KEY=your_api_key_here
   ```

3. Run the tests:

   ```bash
   npx vitest
   ```

## Maturity

This SDK is in beta, and there may be breaking changes between versions without a major version update. Therefore, we recommend pinning usage
to a specific package version. This way, you can install the same version each time without breaking changes unless you are intentionally
looking for the latest version.
