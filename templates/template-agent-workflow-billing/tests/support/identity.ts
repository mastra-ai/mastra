import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { billingConfigurationSchema } from '../../src/billing/configuration/policy.js';
import type { JwtIdentityOptions } from '../../src/billing/identity.js';
import { JwtIdentityAdapter } from '../../src/billing/identity.js';
import { OrganizationService } from '../../src/billing/organizations.js';
import { OrganizationStorage } from '../../src/billing/storage/organizations.js';
import { temporaryDatabase, independentClient } from './billing.js';

export async function identityFixture() {
  const database = await temporaryDatabase();
  const storage = await OrganizationStorage.open({ url: database.url });
  const keys = await generateKeyPair('EdDSA');
  const jwtConfiguration: JwtIdentityOptions = {
    issuer: 'https://identity.example.test',
    audience: 'billing',
    algorithms: ['EdDSA'],
    jwks: { keys: [await exportJWK(keys.publicKey)] },
  };
  const organizations = new OrganizationService(storage, {
    identity: new JwtIdentityAdapter(storage, jwtConfiguration),
    mode: 'production',
    provider: 'autumn',
  });
  const profile = async (subject: string) => {
    const user = await organizations.provisionJwt({ issuer: jwtConfiguration.issuer, subject, displayName: subject });
    const credential = await new SignJWT({ email: 'untrusted@example.test' })
      .setProtectedHeader({ alg: 'EdDSA' })
      .setSubject(subject)
      .setIssuer(jwtConfiguration.issuer)
      .setAudience('billing')
      .setExpirationTime('1h')
      .sign(keys.privateKey);
    return { ...user, credential, context: await organizations.context({ credential }) };
  };
  const owner = await profile('John');
  const observer = await independentClient(database.url);
  const configuration = billingConfigurationSchema.parse({
    provider: 'local',
    resourcePolicies: [
      {
        id: 'assistant',
        kind: 'agent',
        operations: ['generate'],
        policy: { version: 'v1', charge: { type: 'credits', meter: 'credits', units: 3 } },
      },
    ],
    billingKeys: {
      entitlements: ['access'],
      subscriptions: ['subscription'],
      meters: [{ key: 'credits', unit: 'credits', funding: ['prepaid'] }],
    },
    catalog: { offers: [{ key: 'credit-pack', version: 'v1' }] },
    hosted: { returnUrls: ['https://app.example.test/billing'] },
  });
  return {
    database,
    organizations,
    jwtConfiguration,
    owner,
    profile,
    observer,
    configuration,
    close: async () => {
      observer.close();
      organizations.close();
      await database.cleanup();
    },
  };
}
