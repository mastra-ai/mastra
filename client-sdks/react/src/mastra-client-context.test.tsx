import { beforeEach, describe, expect, it, vi } from 'vitest';

import { isLocalUrl } from './mastra-client-context';

describe('isLocalUrl', () => {
  it('should return true when baseUrl is undefined', () => {
    expect(isLocalUrl(undefined)).toBe(true);
  });

  it('should return true when baseUrl is empty string', () => {
    expect(isLocalUrl('')).toBe(true);
  });

  it('should return true for localhost URLs', () => {
    expect(isLocalUrl('http://localhost:4000')).toBe(true);
    expect(isLocalUrl('http://localhost:4111')).toBe(true);
    expect(isLocalUrl('http://localhost')).toBe(true);
    expect(isLocalUrl('https://localhost:3000')).toBe(true);
  });

  it('should return true for 127.0.0.1 URLs', () => {
    expect(isLocalUrl('http://127.0.0.1:4000')).toBe(true);
    expect(isLocalUrl('http://127.0.0.1:4111')).toBe(true);
    expect(isLocalUrl('http://127.0.0.1')).toBe(true);
  });

  it('should return true for IPv6 loopback URLs', () => {
    expect(isLocalUrl('http://[::1]:4000')).toBe(true);
    expect(isLocalUrl('http://[::1]')).toBe(true);
  });

  it('should return false for .local hostnames', () => {
    expect(isLocalUrl('http://mastra.local:4000')).toBe(false);
    expect(isLocalUrl('http://mastra.local')).toBe(false);
    expect(isLocalUrl('https://my-app.local:3000')).toBe(false);
  });

  it('should return true for 127.x.x.x loopback range', () => {
    expect(isLocalUrl('http://127.0.0.1:4000')).toBe(true);
    expect(isLocalUrl('http://127.0.0.2')).toBe(true);
    expect(isLocalUrl('http://127.255.255.255')).toBe(true);
  });

  it('should return true for .localhost hostnames', () => {
    expect(isLocalUrl('http://mastra.localhost:4000')).toBe(true);
    expect(isLocalUrl('http://dev.localhost')).toBe(true);
  });

  it('should return false for hostnames that start with 127 but are not IPv4 loopback', () => {
    expect(isLocalUrl('http://127.example.com')).toBe(false);
    expect(isLocalUrl('http://127.0.0.256')).toBe(false);
  });

  it('should return false for remote URLs', () => {
    expect(isLocalUrl('https://api.example.com')).toBe(false);
    expect(isLocalUrl('https://my-app.vercel.app')).toBe(false);
    expect(isLocalUrl('http://192.168.1.100:4000')).toBe(false);
  });

  it('should return false for URLs that contain localhost as a substring of a domain', () => {
    expect(isLocalUrl('https://notlocalhost.com')).toBe(false);
    expect(isLocalUrl('https://localhost.evil.com')).toBe(false);
  });
});

// Mock MastraClient to capture construction options
const mockMastraClientOptions: any[] = [];
vi.mock('@mastra/client-js', () => ({
  MastraClient: class MockMastraClient {
    options: any;
    constructor(options: any) {
      this.options = options;
      mockMastraClientOptions.push(options);
    }
  },
}));

// Re-import after mock is set up — need the actual createMastraClient logic
// which is invoked inside MastraClientProvider
const { MastraClientProvider, useMastraClient } = await import('./mastra-client-context');

describe('createMastraClient credentials', () => {
  // See: https://github.com/mastra-ai/mastra/issues/14770

  beforeEach(() => {
    mockMastraClientOptions.length = 0;
  });

  it('should pass credentials: include for local URLs so session cookies are sent', async () => {
    const { createElement } = await import('react');
    const { renderToString } = await import('react-dom/server');

    let capturedClient: any;
    function Inspector() {
      capturedClient = useMastraClient();
      return null;
    }

    renderToString(createElement(MastraClientProvider, { baseUrl: 'http://localhost:4000' }, createElement(Inspector)));

    expect(capturedClient.options.credentials).toBe('include');
  });

  it('should allow overriding credentials via prop', async () => {
    const { createElement } = await import('react');
    const { renderToString } = await import('react-dom/server');

    let capturedClient: any;
    function Inspector() {
      capturedClient = useMastraClient();
      return null;
    }

    renderToString(
      createElement(
        MastraClientProvider,
        { baseUrl: 'http://localhost:4000', credentials: 'same-origin' },
        createElement(Inspector),
      ),
    );

    expect(capturedClient.options.credentials).toBe('same-origin');
  });

  it('should pass credentials: include for remote URLs', async () => {
    const { createElement } = await import('react');
    const { renderToString } = await import('react-dom/server');

    let capturedClient: any;
    function Inspector() {
      capturedClient = useMastraClient();
      return null;
    }

    renderToString(
      createElement(MastraClientProvider, { baseUrl: 'https://api.example.com' }, createElement(Inspector)),
    );

    expect(capturedClient.options.credentials).toBe('include');
  });
});
