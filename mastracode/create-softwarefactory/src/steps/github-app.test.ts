import { beforeEach, describe, expect, it, vi } from 'vitest';

const CANCEL = Symbol('cancel');

const prompts = vi.hoisted(() => ({
  confirm: vi.fn(),
  text: vi.fn(),
  password: vi.fn(),
  log: { message: vi.fn(), success: vi.fn() },
  isCancel: (value: unknown) => value === CANCEL,
}));

vi.mock('@clack/prompts', () => prompts);

import type { CreateContext } from '../context.js';
import { githubAppStep } from './github-app.js';

function makeCtx() {
  const env = new Map<string, string>();
  const events: Array<{ name: string; props: Record<string, unknown> }> = [];
  const ctx = {
    projectName: 'proj',
    publicUrl: 'http://localhost:5173',
    env: { set: (key: string, value: string) => void env.set(key, value) },
    analytics: {
      trackEvent: (name: string, props: Record<string, unknown>) => void events.push({ name, props }),
    },
    githubConfigured: false,
    followUps: [] as string[],
  } as unknown as CreateContext;
  return { ctx, env, events };
}

beforeEach(() => {
  prompts.confirm.mockReset();
  prompts.text.mockReset();
  prompts.password.mockReset();
});

describe('githubAppStep', () => {
  it('writes all GITHUB_APP_* vars and a generated webhook secret on full entry', async () => {
    const { ctx, env, events } = makeCtx();
    prompts.confirm.mockResolvedValue(true);
    prompts.text
      .mockResolvedValueOnce('12345') // App ID
      .mockResolvedValueOnce('Iv1.abc') // Client ID
      .mockResolvedValueOnce('my-factory'); // App slug
    prompts.password
      .mockResolvedValueOnce('shhh') // Client secret
      .mockResolvedValueOnce('-----BEGIN RSA PRIVATE KEY-----\nabc\n-----END RSA PRIVATE KEY-----'); // PEM

    await githubAppStep(ctx);

    expect(env.get('GITHUB_APP_ID')).toBe('12345');
    expect(env.get('GITHUB_APP_CLIENT_ID')).toBe('Iv1.abc');
    expect(env.get('GITHUB_APP_CLIENT_SECRET')).toBe('shhh');
    expect(env.get('GITHUB_APP_SLUG')).toBe('my-factory');
    expect(env.get('GITHUB_APP_PRIVATE_KEY')).toContain('BEGIN RSA PRIVATE KEY');
    expect(env.get('GITHUB_APP_WEBHOOK_SECRET')).toMatch(/^[0-9a-f]{48}$/);
    expect(ctx.githubConfigured).toBe(true);
    expect(events).toContainEqual({
      name: 'sf_github_configured',
      props: { configured: true, mode: 'manual' },
    });
  });

  it('skip leaves env untouched and pushes a follow-up', async () => {
    const { ctx, env, events } = makeCtx();
    prompts.confirm.mockResolvedValue(false);

    await githubAppStep(ctx);

    expect(env.size).toBe(0);
    expect(ctx.githubConfigured).toBe(false);
    expect(ctx.followUps.some(f => f.includes('GITHUB_APP_'))).toBe(true);
    expect(events).toContainEqual({
      name: 'sf_github_configured',
      props: { configured: false, mode: 'skipped' },
    });
  });

  it('cancel mid-entry pushes a follow-up and stops without configuring', async () => {
    const { ctx, env } = makeCtx();
    prompts.confirm.mockResolvedValue(true);
    prompts.text.mockResolvedValueOnce('12345').mockResolvedValueOnce(CANCEL);

    await githubAppStep(ctx);

    expect(ctx.githubConfigured).toBe(false);
    expect(env.has('GITHUB_APP_WEBHOOK_SECRET')).toBe(false);
    expect(ctx.followUps.some(f => f.includes('GITHUB_APP_'))).toBe(true);
  });

  it('shows guided instructions with the callback URL derived from publicUrl', async () => {
    const { ctx } = makeCtx();
    prompts.confirm.mockResolvedValue(true);
    prompts.text.mockResolvedValue(CANCEL);

    await githubAppStep(ctx);

    const message = prompts.log.message.mock.calls.map(args => String(args[0])).join('\n');
    expect(message).toContain('http://localhost:5173/auth/github/callback');
    expect(message).toContain('github.com/settings/apps/new');
  });
});
