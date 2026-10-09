import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * `requiresAuth: false` skips core route auth entirely, leaving the handler as
 * the only check. Only routes that must work without a Factory session may
 * declare it: the `/auth/*` sign-in and connect flows, signature-verified
 * webhooks, and the Slack connect landing. Adding one here needs a reason.
 */
const ALLOWED_PUBLIC_DECLARATIONS: Record<string, number> = {
  'auth.ts': 2, // provider `/auth/*` routes, `/auth/me`
  'integrations/github/routes.ts': 3, // webhook (signature-verified), `/auth/github/*` connect + callback
  'integrations/gitlab/routes.ts': 1, // webhook (token-verified)
  'integrations/linear/routes.ts': 2, // `/auth/linear/connect`, `/auth/linear/callback`
  'integrations/platform/github/integration.ts': 2, // `/auth/github/connect`, `/auth/github/connect-user`
  'integrations/platform/linear/integration.ts': 1, // `/auth/linear/connect`
  'integrations/slack/connect-route.ts': 3, // `/connect/slack`, OIDC start + callback
};

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [path] : [];
  });
}

describe('public Factory routes', () => {
  it('only declares requiresAuth: false on allowlisted routes', () => {
    const root = import.meta.dirname;
    const found: Record<string, number> = {};
    for (const file of sourceFiles(root)) {
      const count = readFileSync(file, 'utf8')
        .split('\n')
        .filter(line => /^\s*requiresAuth: false,/.test(line)).length;
      if (count) found[relative(root, file)] = count;
    }
    expect(found).toEqual(ALLOWED_PUBLIC_DECLARATIONS);
  });
});
