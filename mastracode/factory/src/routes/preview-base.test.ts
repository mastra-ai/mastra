import { describe, expect, it } from 'vitest';

import type { SourceControlSession } from '../storage/domains/source-control/base.js';
import { resolvePreviewBase } from './preview-base.js';
import { sessionSlug } from './preview.js';

// The route wrapper is thin (session auth + JSON) and covered by the surface
// integration tests; the interesting logic — mapping factory config into a
// PreviewBase payload — is pure and tested here directly.

const fakeSession = { sessionId: 'sess-1' } as unknown as SourceControlSession;

const baseDeps = {
  auth: null as never,
  sessions: {} as never,
};

describe('resolvePreviewBase', () => {
  it('reports available=false with a stable slug when preview is disabled', () => {
    const result = resolvePreviewBase(fakeSession, {
      ...baseDeps,
      previewEnabled: false,
      publicUrl: 'http://localhost:4111',
    });
    expect(result).toEqual({ available: false, slug: sessionSlug('sess-1') });
  });
  it('reports available=false when publicUrl has no wildcard-capable hostname', () => {
    const result = resolvePreviewBase(fakeSession, {
      ...baseDeps,
      previewEnabled: true,
      publicUrl: 'http://10.0.0.1:4111',
    });
    expect(result.available).toBe(false);
    expect(result.slug).toBe(sessionSlug('sess-1'));
    expect(result.parentHost).toBeUndefined();
  });
  it('reports available=true with the parent host for a local deploy', () => {
    const result = resolvePreviewBase(fakeSession, {
      ...baseDeps,
      previewEnabled: true,
      publicUrl: 'http://localhost:4111',
    });
    expect(result).toEqual({ available: true, slug: sessionSlug('sess-1'), parentHost: 'localhost' });
  });
  it('reports available=true with the parent host for a subdomain deploy', () => {
    const result = resolvePreviewBase(fakeSession, {
      ...baseDeps,
      previewEnabled: true,
      publicUrl: 'https://studio-abc.mastra.cloud',
    });
    expect(result.available).toBe(true);
    expect(result.parentHost).toBe('studio-abc.mastra.cloud');
  });
});
