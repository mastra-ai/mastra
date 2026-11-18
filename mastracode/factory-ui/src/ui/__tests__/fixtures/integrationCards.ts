import type { Card } from '@mastra/factory/storage/domains/work-items/base';
import { providerFactsCard } from './providerFactsCard';

type FiledWorkItem = Pick<Card['workItem'], 'provider' | 'key' | 'url' | 'title'>;

/** A card an integration filed: its provenance, and the work item that integration describes. */
function filedCard(id: string, externalSource: NonNullable<Card['externalSource']>, workItem: FiledWorkItem): Card {
  return {
    ...providerFactsCard,
    id,
    workItemId: `work-${id}`,
    title: workItem.title,
    externalSource,
    workItem: {
      ...providerFactsCard.workItem,
      ...workItem,
      id: `work-${id}`,
      sources: [],
      externalId: externalSource.externalId,
      state: 'open',
      labels: [],
      author: null,
      metadata: null,
    },
    metadata: {},
  };
}

export const vantaVulnerabilityUrl = 'https://scanner.example.com/vulnerabilities/CVE-2026-112366';

export const vantaCard = filedCard(
  'vanta-card',
  { integrationId: 'vanta', type: 'vulnerability', externalId: 'vuln-1', url: vantaVulnerabilityUrl },
  {
    provider: 'vanta',
    key: 'CVE-2026-112366',
    url: vantaVulnerabilityUrl,
    title: 'npm-picomatch <= 4.0.7: CVE-2026-112366',
  },
);

export const dependabotAlertUrl = 'https://github.com/acme/app/security/dependabot/3543';

export const dependabotCard = filedCard(
  'dependabot-card',
  { integrationId: 'github', type: 'dependabot-alert', externalId: 'acme/app:3543', url: dependabotAlertUrl },
  {
    provider: 'github',
    key: '#3543',
    url: dependabotAlertUrl,
    title: 'picomatch: vulnerable to ReDoS through single-branch repeated extglobs',
  },
);

export const detailCard = filedCard(
  'detail-card',
  {
    integrationId: 'detail',
    type: 'finding',
    externalId: 'repo-1:finding-2',
    url: 'https://example.com/finding',
  },
  { provider: 'detail', key: null, url: 'https://example.com/finding', title: 'Unchecked redirect in the login flow' },
);

export const gitlabCard = filedCard(
  'gitlab-card',
  {
    integrationId: 'gitlab',
    type: 'issue',
    externalId: 'gitlab:42',
    url: 'https://gitlab.com/acme/app/-/issues/42',
  },
  {
    provider: 'gitlab',
    key: 'acme/app#42',
    url: 'https://gitlab.com/acme/app/-/issues/42',
    title: 'Flaky checkout test',
  },
);
