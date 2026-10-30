import { describe, expect, it } from 'vitest';

import { authorLabel, authorTooltip } from './authorLabel';

describe('authorLabel', () => {
  it('names the provider for an importer actor', () => {
    expect(authorLabel('importer:connect:linear:lin_01ABCDEFGHJKMNPQRSTVWXYZ00')).toBe('Linear importer');
    expect(authorLabel('importer:connect:google-drive:gd_1')).toBe('Google Drive importer');
    expect(authorLabel('importer:connect:incident-io:inc_1')).toBe('incident.io importer');
  });

  it('treats the agentic variant as the same provider', () => {
    expect(authorLabel('importer:connect:fireflies-agentic:fir_1')).toBe('Fireflies importer');
  });

  it('title-cases a provider it does not know yet', () => {
    expect(authorLabel('importer:connect:service-now:sn_1')).toBe('Service Now importer');
  });

  it('explains an importer actor without repeating its connection id', () => {
    const actor = 'importer:connect:linear:lin_01ABCDEFGHJKMNPQRSTVWXYZ00';
    const tooltip = authorTooltip(actor);
    expect(tooltip).toBe('Imported by the Linear connection');
    expect(tooltip).not.toContain('lin_01ABCDEFGHJKMNPQRSTVWXYZ00');
    expect(tooltip).not.toContain('importer:connect:');
    expect(authorTooltip('importer:connect:fireflies-agentic:fir_1')).toBe('Imported by the Fireflies connection');
  });

  it('gives no tooltip to other authors', () => {
    for (const author of ['admin', 'support-agent', 'user:jamie', 'importer:linear', 'importer:connect:linear']) {
      expect(authorTooltip(author)).toBeUndefined();
    }
  });

  it('leaves every other author as written', () => {
    for (const author of ['admin', 'support-agent', 'user:jamie', 'importer:linear', 'importer:connect:linear']) {
      expect(authorLabel(author)).toBe(author);
    }
  });
});
