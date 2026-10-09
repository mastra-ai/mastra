import { http, HttpResponse } from 'msw';
import { z } from 'zod';
import type { OAuthStartResponse, ProviderInfo } from '../src/api/types';
import type { AvailableModelOption } from '../src/hooks/useAvailableModels';

const prefix = 'factory-onboarding-preview.';
const sessionPrefix = `${prefix}oauth-session.`;
const credential = z.enum(['api_key', 'oauth']);
const scopeSchema = z.enum(['org', 'user']).default('user');
const sessionSchema = z.object({
  provider: z.string(),
  scope: scopeSchema,
  kind: z.enum(['paste-code', 'device-code']),
  userCode: z.string(),
  expiresAt: z.number(),
  authorized: z.boolean(),
});
type DemoSession = z.infer<typeof sessionSchema>;

// Representative catalog; capabilities match the production OAuth routes.
const catalog: ProviderInfo[] = [
  { provider: 'openai', source: 'none', envVar: 'OPENAI_API_KEY', oauth: { supported: true, modes: ['device-code'] } },
  {
    provider: 'anthropic',
    source: 'none',
    envVar: 'ANTHROPIC_API_KEY',
    oauth: { supported: true, modes: ['paste-code'] },
  },
  { provider: 'github-copilot', source: 'none', oauth: { supported: true, modes: ['device-code'] } },
  { provider: 'xai', source: 'none', envVar: 'XAI_API_KEY', oauth: { supported: true, modes: ['device-code'] } },
];
const models: AvailableModelOption[] = [
  { id: 'openai/gpt-5.6-sol', provider: 'openai', modelName: 'gpt-5.6-sol', hasApiKey: true },
  { id: 'openai/gpt-6.1-sol', provider: 'openai', modelName: 'gpt-6.1-sol', hasApiKey: true },
  { id: 'anthropic/claude-fable-5', provider: 'anthropic', modelName: 'claude-fable-5', hasApiKey: true },
  { id: 'github-copilot/gpt-4.1', provider: 'github-copilot', modelName: 'gpt-4.1', hasApiKey: true },
  { id: 'xai/grok-4.5', provider: 'xai', modelName: 'grok-4.5', hasApiKey: true },
];
const credentialKey = (provider: string, scope: 'org' | 'user') =>
  `${prefix}${scope === 'org' ? 'org' : 'personal'}-${provider}`;
const providers = (): ProviderInfo[] =>
  catalog.map(provider => {
    const orgCredential = credential.safeParse(sessionStorage.getItem(credentialKey(provider.provider, 'org'))).data;
    const userCredential = credential.safeParse(sessionStorage.getItem(credentialKey(provider.provider, 'user'))).data;
    const active = userCredential ?? orgCredential;
    const owner = userCredential ? 'user' : 'org';
    const source: ProviderInfo['source'] = active ? `${active === 'oauth' ? 'oauth' : 'stored'}-${owner}` : 'none';
    return { ...provider, source, orgCredential, userCredential, orgKey: Boolean(orgCredential) };
  });

export function readDemoSession(id: string): DemoSession | undefined {
  try {
    return sessionSchema.safeParse(JSON.parse(localStorage.getItem(sessionPrefix + id) ?? 'null')).data;
  } catch {
    return undefined;
  }
}

export function authorizeDemoSession(id: string, userCode: string): boolean {
  const session = readDemoSession(id);
  if (!session || session.expiresAt <= Date.now() || session.userCode !== userCode.trim()) return false;
  localStorage.setItem(sessionPrefix + id, JSON.stringify({ ...session, authorized: true }));
  return true;
}

export function clearDemoSessions() {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(sessionPrefix)) localStorage.removeItem(key);
  }
}

function completeSession(id: string, session: DemoSession) {
  sessionStorage.setItem(credentialKey(session.provider, session.scope), 'oauth');
  localStorage.removeItem(sessionPrefix + id);
  return HttpResponse.json({ status: 'complete' });
}

export const providerHandlers = [
  http.get('*/web/config/providers', () => HttpResponse.json({ providers: providers(), orgKeyAdmin: true })),
  http.get('*/web/config/models', () => {
    const connected = providers().filter(provider => provider.source !== 'none');
    return HttpResponse.json({
      models: models.filter(model => connected.some(provider => provider.provider === model.provider)),
    });
  }),
  http.put('*/web/config/providers/:provider/key', async ({ params, request }) => {
    const body = z.object({ key: z.literal('DEMO'), scope: scopeSchema }).safeParse(await request.json());
    const provider = catalog.find(provider => provider.provider === params.provider && provider.envVar);
    if (!body.success || !provider)
      return HttpResponse.json({ error: 'Preview only: enter DEMO. Do not use a real API key.' }, { status: 400 });
    // Persist only the method and scope, never the submitted value.
    sessionStorage.setItem(credentialKey(provider.provider, body.data.scope), 'api_key');
    return HttpResponse.json({ ok: true });
  }),
  http.post('*/web/config/providers/:provider/oauth/start', async ({ params, request }) => {
    const body = z
      .object({ mode: z.enum(['paste-code', 'device-code']), scope: scopeSchema })
      .safeParse(await request.json());
    const provider = catalog.find(provider => provider.provider === params.provider);
    if (!body.success || !provider?.oauth?.modes.includes(body.data.mode))
      return HttpResponse.json({ error: 'Unsupported sign-in method' }, { status: 400 });
    const sessionId = crypto.randomUUID();
    const session: DemoSession = {
      provider: provider.provider,
      scope: body.data.scope,
      kind: body.data.mode,
      userCode: 'DEMO-1234',
      expiresAt: Date.now() + 600_000,
      authorized: false,
    };
    localStorage.setItem(sessionPrefix + sessionId, JSON.stringify(session));
    const response: OAuthStartResponse = {
      sessionId,
      kind: session.kind,
      url: `${location.origin}/?demo-provider=${provider.provider}&session=${sessionId}`,
      instructions:
        session.kind === 'paste-code'
          ? 'Preview only: enter DEMO to simulate sign-in. No real account is connected.'
          : 'Preview only: open the demo authorization page and enter this device code. No real account is connected.',
      expiresAt: session.expiresAt,
      ...(session.kind === 'device-code' ? { userCode: session.userCode, nextPollMs: 1000 } : {}),
    };
    return HttpResponse.json(response);
  }),
  http.post('*/web/config/providers/:provider/oauth/complete', async ({ params, request }) => {
    const body = z.object({ sessionId: z.string(), code: z.literal('DEMO') }).safeParse(await request.json());
    if (!body.success)
      return HttpResponse.json({ error: 'Preview only: the authorization code is DEMO.' }, { status: 400 });
    const session = readDemoSession(body.data.sessionId);
    if (
      !session ||
      session.provider !== params.provider ||
      session.kind !== 'paste-code' ||
      session.expiresAt <= Date.now()
    )
      return HttpResponse.json({ error: 'Sign-in expired. Cancel and try again.' }, { status: 400 });
    return completeSession(body.data.sessionId, session);
  }),
  http.post('*/web/config/providers/:provider/oauth/poll', async ({ params, request }) => {
    const body = z.object({ sessionId: z.string() }).safeParse(await request.json());
    const session = body.success ? readDemoSession(body.data.sessionId) : undefined;
    if (
      !body.success ||
      !session ||
      session.provider !== params.provider ||
      session.kind !== 'device-code' ||
      session.expiresAt <= Date.now()
    )
      return HttpResponse.json({ status: 'failed', error: 'Sign-in expired. Cancel and try again.' });
    if (!session.authorized) return HttpResponse.json({ status: 'pending', nextPollMs: 1000 });
    return completeSession(body.data.sessionId, session);
  }),
  http.delete('*/web/config/providers/:provider/oauth/session/:session', ({ params }) => {
    localStorage.removeItem(sessionPrefix + params.session);
    return HttpResponse.json({ ok: true });
  }),
];
