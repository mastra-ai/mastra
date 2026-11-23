import { describe, expect, it } from 'vitest';

import { planHandwrittenTools } from '../../scripts/generate-provider.js';
import { listInstalledProviderIds, readManifest } from '../../scripts/provider-utils.js';
import { PROVIDERS } from '../providers/index.js';

// Regeneration rewrites tools.ts from the template actions plus the
// hand-written tools it finds. If it would lose a registered tool, the next
// template sync silently drops that tool from the toolset.
describe('regenerating a provider', () => {
  const generated = listInstalledProviderIds().flatMap(localId => {
    const manifest = readManifest(localId);
    return manifest ? [{ localId, manifest }] : [];
  });

  it.each(generated)('keeps every tool $localId registers today', ({ localId, manifest }) => {
    const generatedSlugs = Object.keys(manifest.files).flatMap(file => /^tools\/([^/]+)\.ts$/.exec(file)?.[1] ?? []);
    const { handwrittenTools } = planHandwrittenTools(localId, generatedSlugs);
    const registration = PROVIDERS.find(provider => provider.integrationId === localId);
    if (!registration || !('createTools' in registration)) throw new Error(`${localId} is not a registered toolset`);
    const registered = Object.keys(registration.createTools()).sort();

    const prefix = `${localId.replace(/-/g, '_')}_`;
    const planned = [
      ...generatedSlugs.map(slug => `${prefix}${slug.replace(/-/g, '_')}`),
      ...handwrittenTools.map(tool => tool.key),
    ].sort();

    expect(planned).toEqual(registered);
  });

  it('keeps the Zendesk tools no template covers', () => {
    const manifest = readManifest('zendesk')!;
    const generatedSlugs = Object.keys(manifest.files).flatMap(file => /^tools\/([^/]+)\.ts$/.exec(file)?.[1] ?? []);
    const { handwrittenFiles, handwrittenTools } = planHandwrittenTools('zendesk', generatedSlugs);

    expect(handwrittenFiles).toContain('article.ts');
    expect(handwrittenTools.map(tool => tool.key).sort()).toEqual([
      'zendesk_archive_article',
      'zendesk_create_article',
      'zendesk_delete_category',
      'zendesk_delete_organization',
      'zendesk_delete_section',
      'zendesk_delete_ticket',
      'zendesk_list_permission_groups',
      'zendesk_update_article',
      'zendesk_update_article_translation',
    ]);
  });

  it('refuses a hand-written tool that would replace a generated one', () => {
    const manifest = readManifest('zendesk')!;
    const generatedSlugs = Object.keys(manifest.files).flatMap(file => /^tools\/([^/]+)\.ts$/.exec(file)?.[1] ?? []);

    expect(() => planHandwrittenTools('zendesk', [...generatedSlugs, 'delete-ticket'])).toThrow(
      /collides with a generated tool/,
    );
  });
});
