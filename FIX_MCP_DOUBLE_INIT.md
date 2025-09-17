# Fix for MCP Tool Double Initialization Issue

## Problem

After bundling changes in PR #7619 (Sept 16), MCP tools were being initialized twice in dev mode, causing a singleton enforcement error: "MCPClient was initialized multiple times with the same configuration options."

## Root Cause

Tools were being bundled in two places:

1. As separate entry points (`tools/[uuid].mjs` files)
2. Inline in the main bundle (`index.mjs`) when imported via `#tools`

This double bundling caused the MCPClient singleton to be instantiated twice, triggering the error.

## Solution

Added a Rollup plugin (`prevent-tool-double-bundling`) in `packages/cli/src/commands/dev/DevBundler.ts` that:

1. **Intercepts `#tools` imports**: Replaces them with a virtual module to prevent inline bundling
2. **Creates a virtual module**: Returns a dynamic import that loads tools at runtime (not build time)
3. **Externalizes tool imports**: Prevents source file imports to tools from being bundled inline
4. **Uses dynamic import trick**: String concatenation (`'./tools' + '.mjs'`) prevents static analysis

## Implementation Details

### Key Changes

- **File**: `packages/cli/src/commands/dev/DevBundler.ts`
- **Plugin**: `prevent-tool-double-bundling`
- **Methods**:
  - `resolveId()`: Intercepts and redirects tool-related imports
  - `load()`: Provides virtual module content with runtime dynamic import

### How It Works

1. When the dev entry file imports from `#tools`, it gets a virtual module instead
2. The virtual module uses a dynamic import to load `tools.mjs` at runtime
3. The `tools.mjs` file is created by the `tools-watcher` plugin after build
4. Individual tool files are bundled separately as entry points
5. No tool code gets bundled inline in the main bundle

## Testing

To verify the fix works:

1. Run `pnpm build:cli` in the mastra monorepo
2. In a project with MCP tools, run `pnpm dev` or `mastra dev`
3. Confirm no "MCPClient was initialized multiple times" error appears
4. Verify MCP tools work correctly

## Impact

- Fixes the immediate dev mode double initialization issue
- Maintains proper tool separation and bundling
- No changes needed to user code or configuration
- Tools are only bundled once, as separate entry points
