# OtelBridge Examples

This directory contains example applications demonstrating how to use `@mastra/otel-bridge` with different frameworks using standard OTEL auto-instrumentation.

## Available Examples

### [express-basic](./express-basic/)

Minimal Express server demonstrating standard OTEL auto-instrumentation pattern.

**What it shows:**

- Setting up OTEL SDK with NodeSDK
- Configuring OtelBridge with Mastra
- Automatic context propagation via AsyncLocalStorage
- No middleware required

**Best for:** Understanding the standard OTEL integration pattern.

### [fastify-basic](./fastify-basic/)

Minimal Fastify server demonstrating standard OTEL auto-instrumentation pattern.

**What it shows:**

- Standard OTEL setup with Fastify
- Automatic context propagation
- No Fastify plugin required

**Best for:** Fastify-specific integration.

### [hono-basic](./hono-basic/)

Minimal Hono server demonstrating standard OTEL auto-instrumentation pattern.

**What it shows:**

- Standard OTEL setup with Hono
- Automatic context propagation
- Works with @hono/node-server

**Best for:** Hono framework integration.

### [nextjs-basic](./nextjs-basic/)

Minimal Next.js App Router application demonstrating standard OTEL auto-instrumentation pattern.

**What it shows:**

- Next.js built-in instrumentation file support
- Automatic context propagation in API routes
- Optional Edge runtime middleware support

**Best for:** Next.js integration with App Router.

## Running Examples

All examples use workspace dependencies and must be run from within the monorepo:

1. Install dependencies from the monorepo root:

   ```bash
   cd /path/to/mastra
   pnpm install
   ```

2. Build the packages:

   ```bash
   pnpm build
   ```

3. Navigate to an example and run it:
   ```bash
   cd observability/otel-bridge/examples/express-basic
   pnpm start
   ```

## Example Structure

Each example contains:

- `server.ts` - Main application code
- `package.json` - Dependencies (using workspace protocol)
- `tsconfig.json` - TypeScript configuration
- `README.md` - Detailed instructions and explanation

## Note on Publishing

These examples are for development and documentation purposes only. They are **not included** in the published `@mastra/otel-bridge` package (excluded via the `files` field in package.json).
