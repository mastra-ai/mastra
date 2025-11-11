# OtelBridge Examples

This directory contains example applications demonstrating how to use `@mastra/otel-bridge` with different frameworks and scenarios.

## Available Examples

### [express-basic](./express-basic/)

Minimal Express server demonstrating Scenario A: HTTP service receiving W3C trace context headers.

**What it shows:**

- Setting up OtelBridge with Express
- Extracting trace context from HTTP headers
- Passing RequestContext to Mastra agents
- Maintaining trace continuity across service boundaries

**Best for:** Understanding the basics of OTEL context propagation with HTTP services.

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
