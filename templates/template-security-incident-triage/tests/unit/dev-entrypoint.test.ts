import { afterEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prepare: vi.fn(),
  startDevelopment: vi.fn(),
  checkPort: vi.fn(),
  createMastra: vi.fn(() => ({})),
}));
vi.mock('../../src/dev-database.js', () => ({
  prepareDevelopmentDatabase: mocks.prepare,
}));
vi.mock('../../src/dev-supervisor.js', () => ({
  startDevelopment: mocks.startDevelopment,
  assertDevelopmentPortAvailable: mocks.checkPort,
}));

vi.mock('../../src/mastra/runtime.js', () => ({
  createRuntimeMastra: mocks.createMastra,
  storage: {},
  createDomainEventPubSub: vi.fn(),
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.resetModules();
});

it.each([
  { mode: 'local', workos: false, fixtures: true },
  { mode: 'local', workos: true, fixtures: false },
  { mode: 'staging', workos: true, fixtures: false },
  { mode: 'production', workos: false, fixtures: false },
])('routes dev in $mode with WorkOS=$workos', async ({ mode, workos, fixtures }) => {
  vi.stubEnv('RUNTIME_MODE', mode);
  vi.stubEnv('OPENAI_API_KEY', 'test-key');
  vi.stubEnv('APPROVAL_RESUME_SECRET', 'r'.repeat(32));
  vi.stubEnv('WORKOS_PROVIDER_ENABLED', String(workos));
  vi.stubEnv('WEBHOOKS_ENABLED', 'true');
  vi.stubEnv('ALERT_WEBHOOK_SECRET', 'test-alert-webhook-secret');
  vi.stubEnv('WORKOS_API_KEY', 'test-workos-api-key');
  vi.stubEnv('WORKOS_WEBHOOK_SECRET', 'test-webhook-secret');
  vi.stubEnv('WORKOS_ORGANIZATION_ID', 'org_1');
  vi.stubEnv('WORKOS_ALLOWED_ROLE_SLUGS', 'member,admin');
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  await import('../../scripts/dev.js');
  expect(mocks.checkPort).toHaveBeenCalledTimes(1);
  expect(mocks.startDevelopment).toHaveBeenCalledTimes(1);
  expect(mocks.prepare).toHaveBeenCalledTimes(fixtures ? 1 : 0);
  await import('../../src/mastra/index.js');
  expect(mocks.createMastra).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      allowWebhookInput: fixtures,
      integrationConfig: expect.objectContaining({ mode }),
    }),
  );
});
