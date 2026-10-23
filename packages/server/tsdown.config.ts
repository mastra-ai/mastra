import { defineLibConfig } from '@internal/types-builder/tsdown';

export default defineLibConfig({
  entry: [
    'src/index.ts',
    'src/server/handlers.ts',
    'src/server/handlers/*.ts',
    'src/server/a2a/store.ts',
    'src/server/server-adapter/index.ts',
    'src/server/auth/index.ts',
    'src/server/schemas/index.ts',
    'src/server/browser-stream/index.ts',
    '!src/server/handlers/*.test.ts',
    '!src/server/auth/*.test.ts',
    '!src/server/schemas/*.test.ts',
  ],
  // The `@mastra/agent-builder` package has `typescript` as a peer dependency and we don't want to bundle it
  deps: {
    neverBundle: ['typescript'],
    alwaysBundle: ['@internal/core', '@internal/voice', '@mastra/schema-compat'],
  },
  bundledTypes: ['@internal/core', '@mastra/schema-compat', '@internal/voice'],
});
