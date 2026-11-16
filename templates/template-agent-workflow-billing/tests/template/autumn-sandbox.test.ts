import { afterEach, expect, it } from 'vitest';
import { readFile, writeFile, stat, realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { importJWK, SignJWT } from 'jose';
import { configuredOrganizations } from '../../src/billing/configuration/environment.js';
import { autumnFixture } from '../support/autumn.js';
import { imageBoundary } from '../support/images.js';
import { command, sanitizedEnvironment, serve, templateCopy } from '../support/template.js';

const cleanups: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

async function sandboxCopy() {
  const remote = await autumnFixture();
  cleanups.push(remote.close);
  const copy = await templateCopy();
  cleanups.push(copy.cleanup);
  const root = await realpath(copy.root);
  const environment = {
    ...sanitizedEnvironment(),
    BILLING_MODE: 'production',
    BILLING_PROVIDER: 'autumn',
    BILLING_STUDIO_ENABLED: 'true',
    BILLING_PROJECT_ROOT: root,
    BILLING_DATABASE_URL: pathToFileURL(resolve(root, 'data/autumn-sandbox/billing.db')).href,
    BILLING_IDENTITY_CONFIG_FILE: 'data/autumn-sandbox/identity.json',
    AUTUMN_CONFIG_FILE: 'data/autumn-sandbox/autumn.json',
    AUTUMN_SECRET_KEY: 'am_sk_test_controlled',
    AUTUMN_TEST_CUSTOMER_ID: 'johns-org',
    AUTUMN_TEST_FEATURE_ID: 'generated_images',
    AUTUMN_TEST_CREDIT_POOL_ID: 'image_credits',
    AUTUMN_SERVER_URL: remote.options.serverURL,
  };
  const path = (name: string) => resolve(root, 'data/autumn-sandbox', name);
  const json = async (name: string) => JSON.parse(await readFile(path(name), 'utf8'));
  return { root, remote, environment, path, json };
}

it('a fresh sandbox setup rejects live keys, live customers and incompatible credits before provisioning', async () => {
  const f = await sandboxCopy();
  const setup = (overrides = {}) => command(f.root, ['run', 'setup:autumn'], { ...f.environment, ...overrides }, false);
  expect((await setup({ AUTUMN_SECRET_KEY: 'am_sk_live_rejected' })).output).toContain('sandbox key');
  expect(f.remote.requests).toHaveLength(0);
  f.remote.behavior.environment = 'live';
  expect((await setup()).output).toContain('must exist in the Autumn sandbox');
  f.remote.behavior.environment = 'sandbox';
  f.remote.behavior.cost = 2;
  expect((await setup()).output).toContain('flat 1:1');
  f.remote.behavior.cost = 1;
  f.remote.behavior.balance = 3;
  expect((await setup()).output).toContain('at least four');
  await expect(readFile(f.path('signing-key.json'))).rejects.toMatchObject({ code: 'ENOENT' });
  await expect(readFile(f.path('billing.db'))).rejects.toMatchObject({ code: 'ENOENT' });
  expect(f.remote.requests.every(request => !request.body.lock)).toBe(true);
  expect(f.remote.behavior.consumed).toBe(0);
}, 60000);

it('documented commands preserve local state, bill a Studio image and renew expired JWTs without restarting', async () => {
  const f = await sandboxCopy();
  const boundary = await imageBoundary();
  cleanups.push(boundary.close);
  await command(f.root, ['run', 'setup'], {
    ...sanitizedEnvironment(),
    BILLING_MODE: 'local',
    BILLING_PROVIDER: 'local',
  });
  const localProfiles = await readFile(resolve(f.root, 'data/local-profiles.json'));
  // Follow the guide with .env rather than depending on inherited sandbox settings.
  const settings = { ...f.environment, OPENAI_API_KEY: 'controlled', OPENAI_BASE_URL: boundary.url };
  await writeFile(
    resolve(f.root, '.env'),
    Object.entries(settings)
      .filter(([key]) => /^(BILLING_|AUTUMN_|OPENAI_)/.test(key))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n'),
    { mode: 0o600 },
  );
  const setup = await command(f.root, ['run', 'setup:autumn'], sanitizedEnvironment());
  let profile = await f.json('profile.json');
  expect(setup.output).toContain(profile.workspaceId);
  expect(setup.output).not.toContain(profile.credential);
  const key = await readFile(f.path('signing-key.json'));
  const identity = await readFile(f.path('identity.json'));
  const bindings = await readFile(f.path('autumn.json'));
  for (const name of ['signing-key.json', 'profile.json', 'identity.json', 'autumn.json', 'billing.db'])
    expect((await stat(f.path(name))).mode & 0o777).toBe(0o600);
  expect((await stat(f.path('.'))).mode & 0o777).toBe(0o700);
  const organizations = await configuredOrganizations(f.environment);
  try {
    expect(await organizations.context({ credential: profile.credential })).toMatchObject({
      actorId: profile.actorId,
      workspaceId: profile.workspaceId,
    });
  } finally {
    organizations.close();
  }
  expect((await command(f.root, ['run', '--silent', 'autumn:header'], sanitizedEnvironment())).output.trim()).toBe(
    `Bearer ${profile.credential}`,
  );
  expect(f.remote.behavior.consumed).toBe(0);
  expect(f.remote.requests.every(request => !request.body.lock && !request.path.includes('billing.attach'))).toBe(true);

  const server = await serve(f.root, sanitizedEnvironment(), 'dev', profile.credential);
  cleanups.push(server.close);
  const usagePath = `/billing/workspaces/${profile.workspaceId}/usage`;
  const check = await command(f.root, ['run', 'autumn:check'], server.environment);
  expect(check.output).toContain('"mode": "autumn"');
  expect(check.output).toContain('"confirmedBalance": 10');
  expect((await fetch(`${server.url}/api/agents`)).status).toBe(401);
  expect(
    (
      await server.call('/api/agents/studio-assistant/send-message', {
        threadId: 'sandbox-walkthrough',
        resourceId: 'default',
        message: 'CALL image {"action":"execute","prompt":"A blue bird in a quiet forest","operationId":null}',
      })
    ).status,
  ).toBe(200);
  let history = '';
  for (let attempt = 0; attempt < 200; attempt++) {
    history = JSON.stringify(
      (await server.call('/api/memory/threads/sandbox-walkthrough/messages?agentId=studio-assistant')).body,
    );
    if (history.includes('"billedUnits":1')) break;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  expect(history).toContain('"billedUnits":1');
  expect(history).toContain('"executionStatus":"completed"');
  expect(boundary.images).toHaveLength(1);
  expect(f.remote.behavior.consumed).toBe(1);
  const artifactId = history.match(/\/billing\/workspaces\/[^"\\]+\/artifacts\/([a-f0-9-]{36})/)?.[1];
  expect(artifactId).toBeTruthy();
  await command(
    f.root,
    [
      'run',
      'images',
      '--',
      'download',
      artifactId!,
      'sandbox.png',
      '--profile-file',
      'data/autumn-sandbox/profile.json',
      '--url',
      server.url,
    ],
    sanitizedEnvironment(),
  );
  expect(await readFile(resolve(f.root, 'sandbox.png'))).toEqual(boundary.png);
  expect(f.remote.behavior.consumed).toBe(1);
  const openingAfterImage = (await server.call(usagePath)).body;
  expect(openingAfterImage.meters[0].confirmedBalance).toBe(9);

  const expired = await new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', kid: JSON.parse(key.toString()).kid })
    .setIssuer('https://billing-sandbox.local')
    .setAudience('billing-studio-sandbox')
    .setSubject('sandbox-john')
    .setIssuedAt(Math.floor(Date.now() / 1000) - 100)
    .setExpirationTime(Math.floor(Date.now() / 1000) - 10)
    .sign(await importJWK(JSON.parse(key.toString()), 'RS256'));
  await writeFile(
    f.path('profile.json'),
    JSON.stringify({ ...profile, credential: expired, expiresAt: new Date(Date.now() - 10000).toISOString() }),
  );
  expect((await fetch(server.url + '/api/agents', { headers: { Authorization: `Bearer ${expired}` } })).status).toBe(
    401,
  );
  for (const action of ['autumn:header', 'autumn:check']) {
    const rejected = await command(f.root, ['run', '--silent', action], sanitizedEnvironment(), false);
    expect(rejected.code).not.toBe(0);
    expect(rejected.output).toContain('Run npm run autumn:renew.');
    expect(rejected.output).not.toContain(expired);
  }
  const renewal = await command(f.root, ['run', 'autumn:renew'], sanitizedEnvironment());
  const renewed = await f.json('profile.json');
  expect(renewal.output).not.toContain(renewed.credential);
  expect(renewed).toMatchObject({ actorId: profile.actorId, workspaceId: profile.workspaceId });
  const authenticated = await fetch(server.url + '/api/agents', {
    headers: { Authorization: `Bearer ${renewed.credential}` },
  });
  expect(authenticated.status).toBe(200);
  const afterRenewal = await fetch(server.url + usagePath, {
    headers: { Authorization: `Bearer ${renewed.credential}` },
  });
  expect((await afterRenewal.json()).meters[0].confirmedBalance).toBe(9);
  await command(f.root, ['run', 'setup:autumn'], sanitizedEnvironment());
  profile = await f.json('profile.json');
  expect(profile).toMatchObject({ actorId: renewed.actorId, workspaceId: renewed.workspaceId });
  expect(await readFile(f.path('signing-key.json'))).toEqual(key);
  expect(await readFile(f.path('identity.json'))).toEqual(identity);
  expect(await readFile(f.path('autumn.json'))).toEqual(bindings);
  expect(await readFile(resolve(f.root, 'data/local-profiles.json'))).toEqual(localProfiles);
  expect(f.remote.behavior.consumed).toBe(1);
  expect(boundary.images).toHaveLength(1);
  const changed = await command(
    f.root,
    ['run', 'setup:autumn'],
    { ...sanitizedEnvironment(), AUTUMN_TEST_CUSTOMER_ID: 'another-customer' },
    false,
  );
  expect(changed.output).toContain('resource IDs changed');
  expect(await readFile(f.path('autumn.json'))).toEqual(bindings);
  const savedProfile = await readFile(f.path('profile.json'));
  const revoked = await configuredOrganizations(f.environment);
  try {
    await revoked.storage.setIdentityActive(profile.actorId, false);
  } finally {
    revoked.close();
  }
  expect((await command(f.root, ['run', 'autumn:renew'], sanitizedEnvironment(), false)).code).not.toBe(0);
  expect(await readFile(f.path('profile.json'))).toEqual(savedProfile);
  expect(f.remote.behavior.consumed).toBe(1);
}, 180000);
