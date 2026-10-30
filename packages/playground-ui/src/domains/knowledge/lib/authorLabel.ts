/** Turn a provenance author into what a reader should see; importer actors carry an opaque connection id. */

const PROVIDERS: Record<string, string> = {
  confluence: 'Confluence',
  discord: 'Discord',
  fireflies: 'Fireflies',
  github: 'GitHub',
  'google-drive': 'Google Drive',
  hubspot: 'HubSpot',
  'incident-io': 'incident.io',
  jira: 'Jira',
  linear: 'Linear',
  'microsoft-teams': 'Microsoft Teams',
  notion: 'Notion',
  'one-drive': 'OneDrive',
  slack: 'Slack',
  zendesk: 'Zendesk',
};

const IMPORTER_ACTOR = /^importer:connect:([a-z0-9-]+?)(?:-agentic)?:.+$/;

export function authorLabel(author: string): string {
  const provider = IMPORTER_ACTOR.exec(author)?.[1];
  if (!provider) return author;
  const name =
    PROVIDERS[provider] ??
    provider
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  return `${name} importer`;
}
