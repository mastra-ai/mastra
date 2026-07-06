import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { SLACK_CALLBACK_PORTS } from '../oauth.js';
import { SLACK_MANIFEST_USER_SCOPES } from '../scopes.js';

const here = dirname(fileURLToPath(import.meta.url));
// src/slack/__tests__ -> mastracode root
const manifestPath = join(here, '..', '..', '..', 'slack-app-manifest.json');

type Manifest = {
  oauth_config: {
    redirect_urls: string[];
    scopes: { user: string[] };
    pkce_enabled?: boolean;
  };
  settings: Record<string, unknown>;
};

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;

describe('slack app manifest', () => {
  it('declares exactly the manifest user-scope superset from scopes.ts', () => {
    expect([...manifest.oauth_config.scopes.user].sort()).toEqual([...SLACK_MANIFEST_USER_SCOPES].sort());
  });

  it('lists a redirect URL for every loopback callback port', () => {
    for (const port of SLACK_CALLBACK_PORTS) {
      expect(manifest.oauth_config.redirect_urls).toContain(`http://localhost:${port}/callback`);
    }
    expect(manifest.oauth_config.redirect_urls).toHaveLength(SLACK_CALLBACK_PORTS.length);
  });

  it('enables the public (PKCE) client and MCP', () => {
    expect(manifest.oauth_config.pkce_enabled).toBe(true);
    expect(manifest.settings.is_mcp_enabled).toBe(true);
  });
});
