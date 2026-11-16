import { constants } from 'node:fs';
import { open, rename, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Autumn, HTTPClient } from 'autumn-js';
import { createLocalJWKSet, exportJWK, generateKeyPair, importJWK, jwtVerify, SignJWT } from 'jose';
import { z } from 'zod';
import { BillingError, identifierSchema } from '../src/billing/contracts/core.js';
import { configuredOrganizations } from '../src/billing/configuration/environment.js';
import { JwtIdentityAdapter, jwtIdentityConfigurationSchema } from '../src/billing/identity.js';
import { OrganizationService } from '../src/billing/organizations.js';
import { bindingSchema } from '../src/billing/providers/autumn/index.js';
import { OrganizationStorage } from '../src/billing/storage/organizations.js';
import { privateDirectory } from '../src/billing/storage/private-files.js';

const issuer = 'https://billing-sandbox.local';
const audience = 'billing-studio-sandbox';
const subject = 'sandbox-john';
const profileSchema = z.strictObject({
  version: z.literal(1),
  actorId: identifierSchema,
  workspaceId: identifierSchema,
  customerId: identifierSchema,
  featureId: identifierSchema,
  creditPoolId: identifierSchema,
  credential: z.string().min(1),
  expiresAt: z.iso.datetime(),
});
const signingKeySchema = z
  .object({
    kty: z.literal('RSA'),
    kid: z.string().min(1),
    n: z.string().min(1),
    e: z.string().min(1),
    d: z.string().min(1),
  })
  .passthrough();

function fail(message: string): never {
  const error = new Error(message);
  error.name = 'SandboxSetupError';
  throw error;
}

async function readPrivate(filename: string): Promise<unknown> {
  const handle = await open(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.nlink !== 1 || info.uid !== process.getuid?.() || (info.mode & 0o077) !== 0)
      fail('Sandbox files must be private regular files owned by your user.');
    return JSON.parse(await handle.readFile('utf8'));
  } finally {
    await handle.close();
  }
}

async function optionalPrivate(filename: string) {
  try {
    return await readPrivate(filename);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
    throw error;
  }
}

async function writePrivate(filename: string, value: unknown) {
  const temporary = `${filename}.${randomUUID()}.tmp`;
  try {
    await open(temporary, 'wx', 0o600).then(async handle => {
      try {
        await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`);
        await handle.sync();
      } finally {
        await handle.close();
      }
    });
    await rename(temporary, filename);
  } finally {
    await unlink(temporary).catch(() => {});
  }
}

function sandboxPaths(environment: NodeJS.ProcessEnv) {
  const root = resolve(environment.BILLING_PROJECT_ROOT ?? '.');
  const directory = resolve(root, 'data/autumn-sandbox');
  const paths = {
    root,
    directory,
    identity: resolve(directory, 'identity.json'),
    bindings: resolve(directory, 'autumn.json'),
    key: resolve(directory, 'signing-key.json'),
    profile: resolve(directory, 'profile.json'),
    database: pathToFileURL(resolve(directory, 'billing.db')).href,
  };
  if (
    environment.BILLING_MODE !== 'production' ||
    environment.BILLING_PROVIDER !== 'autumn' ||
    resolve(root, environment.BILLING_IDENTITY_CONFIG_FILE ?? '') !== paths.identity ||
    resolve(root, environment.AUTUMN_CONFIG_FILE ?? '') !== paths.bindings ||
    environment.BILLING_DATABASE_URL !== paths.database ||
    environment.BILLING_CONFIG_FILE !== undefined
  )
    fail(
      'Use the sandbox .env from docs/autumn.md, including its isolated database URL. Leave BILLING_CONFIG_FILE unset.',
    );
  return paths;
}

async function preflight(environment: NodeJS.ProcessEnv) {
  const ids = z
    .object({
      customerId: identifierSchema,
      featureId: identifierSchema,
      creditPoolId: identifierSchema,
    })
    .parse({
      customerId: environment.AUTUMN_TEST_CUSTOMER_ID,
      featureId: environment.AUTUMN_TEST_FEATURE_ID,
      creditPoolId: environment.AUTUMN_TEST_CREDIT_POOL_ID,
    });
  if (!environment.AUTUMN_SECRET_KEY?.startsWith('am_sk_test_'))
    fail('AUTUMN_SECRET_KEY must be a sandbox key starting with am_sk_test_.');
  if (environment.AUTUMN_SERVER_URL) {
    const url = new URL(environment.AUTUMN_SERVER_URL);
    if (
      url.protocol !== 'http:' ||
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    )
      fail('AUTUMN_SERVER_URL is restricted to loopback HTTP for controlled tests.');
  }
  const httpClient = new HTTPClient();
  httpClient.addHook('response', response => {
    if (response.status !== 200) fail('Autumn did not return HTTP 200. Check the sandbox key and resource IDs.');
  });
  const client = new Autumn({
    secretKey: environment.AUTUMN_SECRET_KEY,
    xApiVersion: '2.6.0',
    failOpen: false,
    retryConfig: { strategy: 'none' },
    useEdge: false,
    timeoutMs: 10000,
    serverURL: environment.AUTUMN_SERVER_URL,
    httpClient,
  });
  // Read an existing customer before doing anything locally. No get-or-create,
  // plan attachment, balance adjustment, reservation or paid compute occurs here.
  const customer = await client.customers.get({ customerId: ids.customerId });
  if (customer.id !== ids.customerId || customer.env !== 'sandbox')
    fail('The selected customer must exist in the Autumn sandbox.');
  const feature = await client.features.get({ featureId: ids.featureId });
  const pool = await client.features.get({ featureId: ids.creditPoolId });
  const rates = pool.creditSchema?.filter(rate => rate.meteredFeatureId === ids.featureId) ?? [];
  const rate = rates[0];
  if (
    feature.id !== ids.featureId ||
    feature.type !== 'metered' ||
    !feature.consumable ||
    feature.archived ||
    pool.id !== ids.creditPoolId ||
    pool.type !== 'credit_system' ||
    pool.archived ||
    rates.length !== 1 ||
    !rate ||
    !('creditCost' in rate) ||
    rate.creditCost !== 1 ||
    (rate.billingUnits ?? 1) !== 1 ||
    rate.dimensions ||
    rate.multipliers
  )
    fail(
      'Use a consumable metered feature and a credit system with a flat 1:1 rate, without dimensions or multipliers.',
    );
  const result = await client.check({ customerId: ids.customerId, featureId: ids.featureId, requiredBalance: 4 });
  if (
    result.customerId !== ids.customerId ||
    result.allowed !== true ||
    result.balance?.featureId !== ids.creditPoolId ||
    result.balance.unlimited ||
    result.balance.overageAllowed ||
    result.balance.remaining < 4
  )
    fail('Attach the sandbox plan with at least four available pool credits; disable unlimited usage and overage.');
  return ids;
}

async function issueToken(paths: ReturnType<typeof sandboxPaths>, profile: z.infer<typeof profileSchema>) {
  const jwk = signingKeySchema.parse(await readPrivate(paths.key));
  const identity = jwtIdentityConfigurationSchema.parse(await readPrivate(paths.identity));
  const credential = await new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', kid: jwk.kid })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject(subject)
    .setIssuedAt()
    .setJti(randomUUID())
    .setExpirationTime('8h')
    .sign(await importJWK(jwk, 'RS256'));
  const { payload } = await jwtVerify(credential, createLocalJWKSet(identity.jwks), {
    issuer,
    audience,
    algorithms: ['RS256'],
  });
  return profileSchema.parse({ ...profile, credential, expiresAt: new Date(payload.exp! * 1000).toISOString() });
}

export async function runSandboxCommand(args: string[], environment: NodeJS.ProcessEnv) {
  const [action] = args;
  if (args.length !== 1 || !['setup', 'renew', 'header', 'check'].includes(action!))
    fail('Usage: node scripts/autumn-sandbox.mjs setup|renew|header|check');
  const paths = sandboxPaths(environment);
  await privateDirectory(resolve(paths.root, 'data'));
  await privateDirectory(paths.directory);
  let lock;
  if (action === 'setup' || action === 'renew') {
    lock = await open(resolve(paths.directory, 'setup.lock'), 'wx', 0o600).catch(() =>
      fail(
        'Sandbox setup lock exists. Stop other setup/renew commands before removing data/autumn-sandbox/setup.lock.',
      ),
    );
  }
  try {
    if (action === 'setup') {
      const ids = await preflight(environment);
      const previousValue = await optionalPrivate(paths.profile);
      const previous = previousValue === undefined ? undefined : profileSchema.parse(previousValue);
      if (
        previous &&
        (previous.customerId !== ids.customerId ||
          previous.featureId !== ids.featureId ||
          previous.creditPoolId !== ids.creditPoolId)
      )
        fail('Sandbox resource IDs changed. Restore the original IDs to preserve the existing payer and operations.');
      let jwk = await optionalPrivate(paths.key);
      if (jwk === undefined) {
        if (previous) fail('The saved signing key is missing. Restore it instead of replacing the sandbox identity.');
        const { privateKey } = await generateKeyPair('RS256', { extractable: true });
        jwk = { ...(await exportJWK(privateKey)), kid: randomUUID() };
        await writePrivate(paths.key, jwk);
      }
      const key = signingKeySchema.parse(jwk);
      const identity = jwtIdentityConfigurationSchema.parse({
        issuer,
        audience,
        algorithms: ['RS256'],
        jwks: { keys: [{ kty: key.kty, kid: key.kid, n: key.n, e: key.e }] },
      });
      const existingIdentity = await optionalPrivate(paths.identity);
      if (existingIdentity !== undefined && JSON.stringify(existingIdentity) !== JSON.stringify(identity))
        fail('The saved public identity configuration differs from the signing key. Restore the original files.');
      const storage = await OrganizationStorage.open({ url: paths.database });
      const organizations = new OrganizationService(storage, {
        identity: new JwtIdentityAdapter(storage, identity),
        mode: 'production',
        provider: 'autumn',
      });
      try {
        const john = await organizations.provisionJwt({ issuer, subject, displayName: 'John' });
        if (previous && (previous.actorId !== john.identity.id || previous.workspaceId !== john.workspaceId))
          fail('Saved sandbox identity does not match this database. Restore the original database.');
        const bindings = bindingSchema.parse({
          customers: [{ workspaceId: john.workspaceId, customerId: ids.customerId, name: "John's Org" }],
          meters: [{ key: 'credits', featureId: ids.featureId, creditPoolId: ids.creditPoolId }],
        });
        const existingBindings = await optionalPrivate(paths.bindings);
        if (existingBindings !== undefined && JSON.stringify(existingBindings) !== JSON.stringify(bindings))
          fail('Saved sandbox bindings differ. Restore the original bindings instead of changing an existing payer.');
        await writePrivate(paths.identity, identity);
        await writePrivate(paths.bindings, bindings);
        const profile = await issueToken(paths, {
          version: 1,
          actorId: john.identity.id,
          workspaceId: john.workspaceId,
          ...ids,
          credential: 'pending',
          expiresAt: new Date().toISOString(),
        });
        await organizations.context({ credential: profile.credential });
        await writePrivate(paths.profile, profile);
        console.log(
          `Sandbox ready. Workspace: ${profile.workspaceId}. JWT expires: ${profile.expiresAt}. Run npm run dev, then npm run autumn:check.`,
        );
      } finally {
        organizations.close();
      }
      return;
    }
    let profile = profileSchema.parse(await readPrivate(paths.profile));
    if (action === 'renew') profile = await issueToken(paths, profile);
    const organizations = await configuredOrganizations(environment);
    try {
      const context = await organizations.context({ credential: profile.credential }).catch(error => {
        if (action !== 'renew' && error instanceof BillingError && error.code === 'unauthenticated')
          fail('The saved JWT is expired or invalid. Run npm run autumn:renew.');
        throw error;
      });
      if (context.actorId !== profile.actorId || context.workspaceId !== profile.workspaceId)
        fail('The token, saved profile and database must identify the same sandbox user and workspace.');
    } finally {
      organizations.close();
    }
    if (action === 'renew') {
      await writePrivate(paths.profile, profile);
      console.log(
        `JWT renewed until ${profile.expiresAt}. Update the Studio Authorization header. No server restart is needed.`,
      );
    } else if (action === 'header') {
      console.log(`Bearer ${profile.credential}`);
    } else {
      const port = z.coerce
        .number()
        .int()
        .min(1)
        .max(65535)
        .parse(environment.BILLING_PORT ?? 4111);
      const base = `http://127.0.0.1:${port}`;
      for (const path of [
        '/api/agents',
        '/api/memory/threads?agentId=studio-assistant',
        `/billing/workspaces/${profile.workspaceId}/usage`,
      ]) {
        const response = await fetch(base + path, {
          headers: { Authorization: `Bearer ${profile.credential}` },
          redirect: 'error',
          signal: AbortSignal.timeout(15000),
        });
        if (response.status !== 200)
          fail(
            `${path}: HTTP ${response.status}. Check the running server's .env and restart it after switching modes.`,
          );
        const body = await response.json();
        if (path.endsWith('/usage')) console.log(JSON.stringify(body, null, 2));
        else console.log(`${path}: HTTP 200`);
      }
    }
  } finally {
    if (lock) {
      await lock.close();
      await unlink(resolve(paths.directory, 'setup.lock'));
    }
  }
}
