import { describe, expect, it } from 'vitest';

import { githubShareUrl } from '../github';

describe('githubShareUrl', () => {
  it('keeps the Platform share parameters and returns to the factory page', () => {
    const url = new URL(
      githubShareUrl(
        'https://api.mastra.ai/v1/server/github-app/share?organizationId=org-1&installationId=9&projectId=p-1',
        'https://acme.factory.mastra.cloud/settings?tab=connections',
      ),
    );

    expect(Object.fromEntries(url.searchParams)).toEqual({
      organizationId: 'org-1',
      installationId: '9',
      projectId: 'p-1',
      returnTo: 'https://acme.factory.mastra.cloud/settings?tab=connections',
    });
  });
});
