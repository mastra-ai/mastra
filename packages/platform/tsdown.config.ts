import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/ai-sdk.ts', 'src/langchain.ts', 'src/langgraph.ts', 'src/pi-agent.ts'],
  format: ['esm', 'cjs'],
  fixedExtension: false,
  nodeProtocol: 'strip',
  clean: true,
  dts: false,
  treeshake: true,
  sourcemap: true,
  deps: {
    neverBundle: ['@mastra/core', '@ai-sdk/provider', /^@langchain\/core/, 'langchain', /^@earendil-works\//],
  },
  onSuccess: async () => {
    await generateTypes(process.cwd());
  },
});
