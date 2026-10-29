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
    id: 'work-provider-facts',
    kind: 'issue',
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
