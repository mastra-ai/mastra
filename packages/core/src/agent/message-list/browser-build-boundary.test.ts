import { expect, it } from 'vitest';
import aiV4BuildConfig from '../../../../_vendored/ai_v4/tsdown.config.ts';

it('keeps Node-only AI SDK test tooling out of the browser-reachable build graph', () => {
  expect(aiV4BuildConfig.entry).toEqual(['src/index.ts', 'src/mcp-stdio.ts']);
});
