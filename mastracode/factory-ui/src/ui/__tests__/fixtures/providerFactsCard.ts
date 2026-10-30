import type { Card } from '@mastra/factory/storage/domains/work-items/base';
import { reviewItem } from './reviewCard';

export const providerFactsCard: Card = {
  ...reviewItem,
  id: 'provider-facts-card',
  workItemId: 'work-provider-facts',
  board: 'work',
  title: 'Outdated wire title',
  externalSource: {
    integrationId: 'github',
    type: 'issue',
    externalId: 'github-issue:73',
    url: 'https://github.com/acme/app/issues/1',
  },
  workItem: {
    ...reviewItem.workItem,
    sources: reviewItem.workItem.sources.map(source => ({
      ...source,
      id: 'source-provider-facts',
      workItemId: 'work-provider-facts',
      sourceType: 'issue',
      externalId: 'issue:github-issue:73',
      sourceKey: 'github:issue:github-issue:73',
      key: 'acme/app#73',
      url: 'https://github.com/acme/app/issues/73',
      state: 'closed',
      labels: ['customer-visible'],
      author: 'reporter',
      metadata: null,
    })),
    id: 'work-provider-facts',
    externalId: 'issue:github-issue:73',
    key: 'acme/app#73',
    url: 'https://github.com/acme/app/issues/73',
    title: 'Repair source facts',
    state: 'closed',
    labels: ['customer-visible'],
    author: 'reporter',
    metadata: null,
  },
  metadata: { authorTrusted: true, author: 'stale-author', labels: ['stale-label'], state: 'open' },
};
