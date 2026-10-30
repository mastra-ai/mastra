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

function importerProvider(author: string): string | undefined {
  const provider = IMPORTER_ACTOR.exec(author)?.[1];
  if (!provider) return undefined;
  return (
    PROVIDERS[provider] ??
    provider
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  );
}

export function authorLabel(author: string): string {
  const provider = importerProvider(author);
  return provider ? `${provider} importer` : author;
}

/** A tooltip for an importer actor that never repeats its connection id; nothing for other authors. */
export function authorTooltip(author: string): string | undefined {
  const provider = importerProvider(author);
  return provider ? `Imported by the ${provider} connection` : undefined;
}
