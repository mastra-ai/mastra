import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it } from 'vitest';

import { resolveKnowledgeResourceId } from '../subconscious/scope';

// The server merges body-supplied requestContext entries into the run context,
// skipping only reserved `mastra__*` keys. A non-reserved override key would let
// an HTTP caller anchor Knowledge on a resource their FGA check never saw.
describe('knowledge resource override key', () => {
  it('ignores a plain knowledgeResourceId entry a caller could supply over HTTP', () => {
    const requestContext = new RequestContext([['knowledgeResourceId', 'victim-project']]);

    expect(resolveKnowledgeResourceId(requestContext, 'caller-resource')).toBe('caller-resource');
  });

  it('honors the reserved override a trusted host sets', () => {
    const requestContext = new RequestContext([['mastra__knowledgeResourceId', 'project-1']]);

    expect(resolveKnowledgeResourceId(requestContext, 'caller-resource')).toBe('project-1');
  });
});
