import { describe, expect, it } from 'vitest';

import { RequestContext } from '../../request-context';
import { createTool } from '../../tools';
import type { ToolAction } from '../../tools/types';
import { resolveToolDescriptionForNetwork } from './index';

describe('resolveToolDescriptionForNetwork', () => {
  it('resolves descriptions for Tool instances with dynamic description', async () => {
    const tool = createTool({
      id: 'dynamic-tool',
      description: ({ requestContext }) => `Tenant: ${requestContext.get('tenant')}`,
      execute: async () => ({}),
    });

    const requestContext = new RequestContext();
    requestContext.set('tenant', 'acme');

    const description = await resolveToolDescriptionForNetwork(tool, requestContext);

    expect(description).toBe('Tenant: acme');
  });

  it('resolves descriptions for raw ToolAction objects with dynamic description', async () => {
    const tool: ToolAction = {
      id: 'raw-dynamic-tool',
      description: ({ requestContext }) => `Org: ${requestContext.get('org')}`,
      execute: async () => ({}),
    };

    const requestContext = new RequestContext();
    requestContext.set('org', 'mastra');

    const description = await resolveToolDescriptionForNetwork(tool, requestContext);

    expect(description).toBe('Org: mastra');
  });

  it('returns undefined when description resolver throws', async () => {
    const tool = createTool({
      id: 'throwing-tool',
      description: () => {
        throw new Error('boom');
      },
      execute: async () => ({}),
    });

    const requestContext = new RequestContext();

    const description = await resolveToolDescriptionForNetwork(tool, requestContext);

    expect(description).toBeUndefined();
  });
});
