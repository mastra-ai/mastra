import { RequestContext as CoreRequestContext } from '@mastra/core/request-context';
import { describe, expect, it } from 'vitest';
import { RequestContext } from './index';

describe('package exports', () => {
  it('re-exports RequestContext from core', () => {
    expect(RequestContext).toBe(CoreRequestContext);
  });
});
