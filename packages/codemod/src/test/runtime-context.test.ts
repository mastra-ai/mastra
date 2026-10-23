import { describe, it } from 'vitest';
import transformer from '../codemods/v1/runtime-context';
import { testTransform } from './test-utils';

describe('runtime-context', () => {
  it('transforms correctly', () => {
    testTransform(transformer, 'runtime-context');
  });

  it('transforms the documented v0 DI import', () => {
    testTransform(transformer, 'runtime-context-di');
  });

  it('does not rename RuntimeContext class if not imported from Mastra', () => {
    testTransform(transformer, 'runtime-context-no-import');
  });
});
