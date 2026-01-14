---
name: e2e-frontend-validation
description: E2E validation workflow for frontend changes in playground packages using Playwright MCP
model: claude-opus-4-5
---

# E2E Validation for Frontend Modifications

## Prerequisites

Requires Playwright MCP server. If the `browser_navigate` tool is unavailable, instruct the user to add it:

```sh
claude mcp add playwright -- npx @playwright/mcp@latest
```

## Validation Steps

After completing frontend changes:

1. **Build the CLI**

```sh
pnpm build:cli
```

2. **Start the dev server**

```sh
cd examples/agent && node ../../packages/cli/dist/index.js dev
```

3. **Verify server is running**
   - URL: http://localhost:4111
   - Wait for the server to be ready before proceeding

4. **Identify impacted routes**
   - Routes are defined in `packages/playground/src/App.tsx`
   - Browse them ALL to verify behavior

5. **Test with Playwright MCP**
   - Use `browser_navigate` to visit each impacted route
   - Visually verify the changes render correctly
   - Test any interactive elements modified
   - Use `browser_screenshot` to capture results for the user

## Quick Reference

| Step    | Command/Action                                                   |
| ------- | ---------------------------------------------------------------- |
| Build   | `pnpm build:cli`                                                 |
| Start   | `cd examples/agent && node ../../packages/cli/dist/index.js dev` |
| App URL | http://localhost:4111                                            |
| Routes  | `@packages/playground/src/App.tsx`                               |
