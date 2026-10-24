import { describe, expect, it, vi } from 'vitest';
import { checkRouteFGA } from '../server-adapter';
import { getBuiltInRouteFGAConfig } from '../server-adapter/routes/fga-manifest';
import { RUN_KNOWLEDGE_IMPORTER_WEBHOOK_ROUTE } from './knowledge-imports';

// The importer webhook queues writes into Knowledge, so an FGA-enabled server
// must authorize the caller against the specific importer — authentication alone
// is not enough.
describe('Knowledge importer webhook route under FGA', () => {
  const params = { instanceKey: 'default', importerId: 'calendar' };
  const user = { id: 'other-org-user' };

  function setup(allowed: boolean) {
    const fga = { check: vi.fn().mockResolvedValue(allowed), require: vi.fn(), filterAccessible: vi.fn() };
    const mastra = { getServer: () => ({ fga }) };
    const requestContext = new Map<string, unknown>([['user', user]]);
    return { fga, mastra, requestContext };
  }

  it('gives distinct importers distinct FGA resource ids even when their keys contain colons', () => {
    const config = getBuiltInRouteFGAConfig(RUN_KNOWLEDGE_IMPORTER_WEBHOOK_ROUTE as any)!;
    const resourceId = config.resourceId as (params: Record<string, unknown>, ctx: any) => string;
    const left = resourceId({ instanceKey: 'a:b', importerId: 'c' }, {});
    const right = resourceId({ instanceKey: 'a', importerId: 'b:c' }, {});
    expect(config.resourceType).toBe('knowledge-importer');
    expect(left).not.toBe(right);
  });

  it('checks the caller against the specific importer and denies when the provider refuses', async () => {
    const { fga, mastra, requestContext } = setup(false);

    const result = await checkRouteFGA(
      mastra as any,
      RUN_KNOWLEDGE_IMPORTER_WEBHOOK_ROUTE as any,
      requestContext as any,
      params,
    );

    expect(fga.check).toHaveBeenCalledTimes(1);
    expect(fga.check).toHaveBeenCalledWith(
      user,
      expect.objectContaining({
        resource: { type: 'knowledge-importer', id: JSON.stringify(['default', 'calendar']) },
        permission: 'knowledge:write',
      }),
    );
    expect(result).toMatchObject({ status: 403 });
  });

  it('lets the request through when the provider allows it', async () => {
    const { fga, mastra, requestContext } = setup(true);

    const result = await checkRouteFGA(
      mastra as any,
      RUN_KNOWLEDGE_IMPORTER_WEBHOOK_ROUTE as any,
      requestContext as any,
      params,
    );

    expect(fga.check).toHaveBeenCalledTimes(1);
    expect(result).toBeNull();
  });
});
