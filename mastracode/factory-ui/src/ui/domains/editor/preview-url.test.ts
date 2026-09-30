// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PreviewBase } from '../../../api/types';
import { buildSandboxPreviewUrl, detectLocalhostUrls } from './preview-url';

describe('detectLocalhostUrls', () => {
  it('finds a bare localhost dev-server line', () => {
    const found = detectLocalhostUrls('  Local:   http://localhost:5173/');
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ port: 5173, path: '/' });
  });
  it('captures deep-link paths after the origin', () => {
    const found = detectLocalhostUrls('open http://localhost:3000/dashboard?tab=agents to view');
    expect(found[0]).toMatchObject({ port: 3000, path: '/dashboard?tab=agents' });
  });
  it('handles both localhost and 127.0.0.1 hosts', () => {
    const found = detectLocalhostUrls('two: http://localhost:8080 and http://127.0.0.1:8081');
    expect(found.map(item => item.port)).toEqual([8080, 8081]);
  });
  it('handles IPv6 loopbacks', () => {
    const found = detectLocalhostUrls('running on http://[::]:9000/ and http://[::1]:9001/');
    expect(found.map(item => item.port)).toEqual([9000, 9001]);
  });
  it('ignores substrings that only look like localhost inside other words', () => {
    expect(detectLocalhostUrls('resolves-localhost:1234/foo unrelated')).toHaveLength(0);
  });
  it('rejects out-of-range ports', () => {
    expect(detectLocalhostUrls('bogus http://localhost:99999/')).toHaveLength(0);
    expect(detectLocalhostUrls('bogus http://localhost:0/')).toHaveLength(0);
  });
});

describe('buildSandboxPreviewUrl', () => {
  const originalLocation = window.location;
  beforeEach(() => {
    // Vitest's jsdom lets us reassign location to any URL-shaped object.
    Object.defineProperty(window, 'location', {
      value: new URL('http://localhost:4111/thread/abc') as unknown as Location,
      writable: true,
    });
  });
  afterEach(() => {
    Object.defineProperty(window, 'location', { value: originalLocation, writable: true });
    vi.restoreAllMocks();
  });

  it('constructs the preview URL when preview subdomains are enabled', () => {
    const preview: PreviewBase = { available: true, slug: 'abcdefghij', parentHost: 'localhost' };
    expect(buildSandboxPreviewUrl(5173, preview)).toBe('http://p-5173-abcdefghij.preview.localhost:4111/');
  });
  it('preserves the origin port only when the current URL has one', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('https://studio-x.mastra.cloud/') as unknown as Location,
      writable: true,
    });
    const preview: PreviewBase = { available: true, slug: 'abcdefghij', parentHost: 'studio-x.mastra.cloud' };
    expect(buildSandboxPreviewUrl(3000, preview)).toBe('https://p-3000-abcdefghij.preview.studio-x.mastra.cloud/');
  });
  it('falls back to the raw localhost URL when preview is not available', () => {
    const preview: PreviewBase = { available: false, slug: 'abcdefghij' };
    expect(buildSandboxPreviewUrl(3000, preview)).toBe('http://localhost:3000/');
  });
  it('falls back to the raw localhost URL when previewBase is undefined', () => {
    expect(buildSandboxPreviewUrl(3000, undefined)).toBe('http://localhost:3000/');
  });
});
