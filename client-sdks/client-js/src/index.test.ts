import { getToolReplayMarker as coreGetToolReplayMarker } from '@mastra/core/datasets';
import { RequestContext as CoreRequestContext } from '@mastra/core/request-context';
import { describe, expect, it } from 'vitest';
import { getToolReplayMarker, RequestContext } from './index';

describe('package exports', () => {
  it('re-exports RequestContext from core', () => {
    expect(RequestContext).toBe(CoreRequestContext);
  });

  it('re-exports getToolReplayMarker from core', () => {
    expect(getToolReplayMarker).toBe(coreGetToolReplayMarker);
  });
});
