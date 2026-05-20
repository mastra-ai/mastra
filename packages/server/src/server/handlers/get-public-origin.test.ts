/**
 * Tests for getPublicOrigin helper function.
 *
 * Covers reverse proxy header resolution for:
 * - X-Forwarded-Host (traditional reverse proxies)
 * - Host header (AWS ALB with Preserve Host Header)
 * - X-Forwarded-Proto (protocol detection)
 * - Fallback to request.url (local development)
 */

import { describe, it, expect } from 'vitest';

import { getPublicOrigin } from './auth';

describe('getPublicOrigin — reverse proxy header resolution', () => {
  it('should use X-Forwarded-Host when present (reverse proxy)', () => {
    const headers = new Headers({
      'x-forwarded-host': 'api.example.com',
      host: 'internal-hostname',
    });
    const request = new Request('http://internal-hostname:3000/some-path', { headers });

    expect(getPublicOrigin(request)).toBe('https://api.example.com');
  });

  it('should use Host header when X-Forwarded-Host absent (AWS ALB)', () => {
    const headers = new Headers({
      host: 'example.com',
      'x-forwarded-proto': 'https',
    });
    const request = new Request('http://example.com/some-path', { headers });

    expect(getPublicOrigin(request)).toBe('https://example.com');
  });

  it('should respect X-Forwarded-Proto when using Host header', () => {
    const headers = new Headers({
      host: 'example.com',
      'x-forwarded-proto': 'http',
    });
    const request = new Request('https://example.com/some-path', { headers });

    expect(getPublicOrigin(request)).toBe('http://example.com');
  });

  it('should use request.url scheme with Host header when X-Forwarded-Proto is absent (http)', () => {
    const headers = new Headers({
      host: 'example.com',
    });
    const request = new Request('http://example.com/some-path', { headers });

    // Host without X-Forwarded-Proto: scheme comes from request.url, host from header
    expect(getPublicOrigin(request)).toBe('http://example.com');
  });

  it('should preserve port in X-Forwarded-Host', () => {
    const headers = new Headers({
      'x-forwarded-host': 'api.example.com:8080',
    });
    const request = new Request('http://internal:3000/some-path', { headers });

    expect(getPublicOrigin(request)).toBe('https://api.example.com:8080');
  });

  it('should handle comma-separated X-Forwarded-Host by using first value', () => {
    const headers = new Headers({
      'x-forwarded-host': 'api.example.com, other.example.com',
    });
    const request = new Request('http://internal:3000/some-path', { headers });

    expect(getPublicOrigin(request)).toBe('https://api.example.com');
  });

  it('should always use HTTPS with X-Forwarded-Host (ignore X-Forwarded-Proto)', () => {
    const headers = new Headers({
      'x-forwarded-host': 'api.example.com',
      'x-forwarded-proto': 'http',
    });
    const request = new Request('http://internal:3000/some-path', { headers });

    // Always HTTPS with X-Forwarded-Host due to Knative queue-proxy unreliability
    expect(getPublicOrigin(request)).toBe('https://api.example.com');
  });

  it('should use request.url protocol when Host header lacks X-Forwarded-Proto', () => {
    const headers = new Headers({
      host: 'example.com:8443',
    });
    const request = new Request('http://example.com:8443/api/auth/sso/callback', { headers });

    // Host without X-Forwarded-Proto: proto comes from request.url, host from header
    expect(getPublicOrigin(request)).toBe('http://example.com:8443');
  });

  it('should merge request.url protocol with Host header when X-Forwarded-Proto absent', () => {
    // AWS ALB with Preserve Host Header ON but no X-Forwarded-Proto header
    // Proto comes from request.url, host from the header
    const headers = new Headers({
      host: 'example.com',
    });
    const request = new Request('https://internal-host/api/auth/sso/callback', { headers });

    // Host without X-Forwarded-Proto: proto from request.url (https) + host header (example.com)
    expect(getPublicOrigin(request)).toBe('https://example.com');
  });

  it('should trim whitespace in comma-separated X-Forwarded-Host', () => {
    const headers = new Headers({
      'x-forwarded-host': '  api.example.com  , other.example.com',
    });
    const request = new Request('http://internal:3000/some-path', { headers });

    expect(getPublicOrigin(request)).toBe('https://api.example.com');
  });

  it('should fall back to request.url.origin when no proxy headers present', () => {
    // Local development or direct access: no proxy headers at all
    const headers = new Headers();
    const request = new Request('http://localhost:3000/api/auth/sso/callback', { headers });

    // No headers: preserve full request.url origin
    expect(getPublicOrigin(request)).toBe('http://localhost:3000');
  });

  it('should preserve HTTPS in request.url fallback', () => {
    // Local HTTPS server without proxy headers
    const headers = new Headers();
    const request = new Request('https://localhost:8443/api/auth/sso/login', { headers });

    expect(getPublicOrigin(request)).toBe('https://localhost:8443');
  });
});
