import { setTimeout } from 'node:timers/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { JwtIdentityAdapter, LocalIdentityAdapter, hashSecret } from '../../src/billing/identity.js';
import { OrganizationService } from '../../src/billing/organizations.js';
import { localAccountSeedSchema } from '../../src/billing/configuration.js';
import { LocalBillingStorage } from '../../src/billing/storage/libsql.js';
import { OrganizationStorage } from '../../src/billing/storage/organizations.js';
import { configuredOrganizations } from '../../src/mastra/setup.js';
import { createBillingApp } from '../../src/server/billing.js';
import { independentClient, temporaryDatabase, usage } from '../support/billing.js';
import { httpServer, mastraServer, organizationWriter, request } from '../support/organizations.js';

const cleanups: (() => void | Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});
const future = () => new Date(Date.now() + 3600_000).toISOString();

async function fixture() {
  const database = await temporaryDatabase();
  cleanups.push(database.cleanup);
  const storage = await OrganizationStorage.open({ url: database.url });
  const service = new OrganizationService(storage, { mode: 'local', provider: 'local' });
  cleanups.push(() => service.close());
  const observer = await independentClient(database.url);
  cleanups.push(() => observer.close());
  return { database, storage, service, observer };
}
async function profile(service: OrganizationService, profileId: string) {
  const provisioned = await service.provisionLocal({ profileId, displayName: profileId });
  if (provisioned.credential === null) throw new Error('Fixture identity was provisioned before');
  return { ...provisioned, credential: provisioned.credential };
}

async function share(
  service: OrganizationService,
  owner: Awaited<ReturnType<typeof profile>>,
  recipient: Awaited<ReturnType<typeof profile>>,
  role: 'owner' | 'admin' | 'member' = 'member',
) {
  const context = await service.context({ credential: owner.credential });
  await service.convert(context, 'convert');
  const invitation = await service.invite(context, `invite-${recipient.identity.id}`, {
    recipientId: recipient.identity.id,
    role,
    expiresAt: future(),
  });
  await service.accept(await service.context({ credential: recipient.credential }), `accept-${recipient.identity.id}`, {
    token: invitation.token!,
  });
  return service.context({ credential: recipient.credential, workspaceId: owner.workspaceId });
}

describe('trusted identity and shared workspace journeys', () => {
  it('personal workspace becomes a shared payer through explicit invitation', async () => {
    const localRoot = await temporaryDatabase();
    cleanups.push(localRoot.cleanup);
    const localBootstrap = await configuredOrganizations({
      MASTRA_PROJECT_ROOT: localRoot.directory,
      MASTRA_DEV: 'true',
      NODE_ENV: 'production',
    });
    cleanups.push(() => localBootstrap.close());
    const bootstrapProfile = await profile(localBootstrap, 'bootstrap-owner');
    expect(await localBootstrap.context({ credential: bootstrapProfile.credential })).toMatchObject({
      actorId: bootstrapProfile.identity.id,
      kind: 'personal',
    });
    const bootstrapObserver = await independentClient(new URL('data/billing.db', new URL('./', localRoot.url)).href);
    cleanups.push(() => bootstrapObserver.close());
    expect((await bootstrapObserver.execute('SELECT COUNT(*) AS count FROM identities')).rows[0].count).toBe(1n);
    await expect(
      configuredOrganizations({ BILLING_DATABASE_URL: localRoot.url, NODE_ENV: 'production' }),
    ).rejects.toMatchObject({ code: 'invalid_configuration' });
    // Reconstruct the actual previous managed schema, retaining its financial rows.
    const legacyDatabase = await temporaryDatabase();
    cleanups.push(legacyDatabase.cleanup);
    const legacyAccounting = await LocalBillingStorage.open({ url: legacyDatabase.url });
    cleanups.push(() => legacyAccounting.close());
    const legacyAccount = await legacyAccounting.ensureAccount(
      { workspaceId: 'legacy' },
      localAccountSeedSchema.parse({
        workspaceId: 'legacy',
        meters: [{ key: 'credits', funding: 'prepaid', balance: 100 }],
      }),
    );
    await legacyAccounting.reportUsage(usage(legacyAccount));
    legacyAccounting.close();
    const legacyObserver = await independentClient(legacyDatabase.url);
    cleanups.push(() => legacyObserver.close());
    const initialChecksum = (await legacyObserver.execute('SELECT checksum FROM billing_migrations WHERE version = 1'))
      .rows[0].checksum;
    for (const table of [
      'provider_usage',
      'hosted_operations',
      'grant_allocations',
      'credit_grants',
      'provider_links',
      'billing_workflow_operations',
      'billing_workflow_runs',
      'billing_outbox',
      'billing_ledger',
      'billing_measurements',
      'billing_reservations',
      'billing_operations',
      'billing_executions',
      'private_records',
      'organization_operations',
      'invitations',
      'memberships',
      'workspaces',
      'local_credentials',
      'identities',
    ])
      await legacyObserver.execute(`DROP TABLE ${table}`);
    await legacyObserver.execute('ALTER TABLE billing_accounts DROP COLUMN effective_provider');
    await legacyObserver.execute('DELETE FROM billing_migrations WHERE version >= 2');
    await legacyObserver.execute('PRAGMA user_version = 1');
    const upgraded = await OrganizationStorage.open({ url: legacyDatabase.url });
    cleanups.push(() => upgraded.close());
    expect(
      (await legacyObserver.execute('SELECT version, checksum FROM billing_migrations ORDER BY version')).rows,
    ).toEqual([
      { version: 1n, checksum: initialChecksum },
      { version: 2n, checksum: expect.stringMatching(/^[a-f0-9]{64}$/) },
      { version: 3n, checksum: expect.stringMatching(/^[a-f0-9]{64}$/) },
      { version: 4n, checksum: expect.stringMatching(/^[a-f0-9]{64}$/) },
      { version: 5n, checksum: expect.stringMatching(/^[a-f0-9]{64}$/) },
    ]);
    expect((await legacyObserver.execute('SELECT id, units FROM immutable_usage')).rows).toEqual([
      { id: 'event-1', units: 3n },
    ]);
    expect((await legacyObserver.execute('SELECT balance, consumed FROM commercial_meters')).rows).toEqual([
      { balance: 97n, consumed: 3n },
    ]);
    const { database, service, storage, observer } = await fixture();
    const owner = await profile(service, 'alice');
    const member = await profile(service, 'bob');
    const outsider = await profile(service, 'mallory');
    expect(await service.provisionLocal({ profileId: 'alice', displayName: 'alice' })).toEqual({
      identity: owner.identity,
      workspaceId: owner.workspaceId,
      credential: null,
    });
    const accounting = await LocalBillingStorage.open({ url: database.url });
    cleanups.push(() => accounting.close());
    const before = await accounting.ensureAccount(
      { workspaceId: owner.workspaceId },
      localAccountSeedSchema.parse({
        workspaceId: owner.workspaceId,
        meters: [{ key: 'credits', funding: 'prepaid', balance: 100 }],
      }),
    );
    await accounting.reportUsage(usage(before));
    const ownerContext = await service.context({ credential: owner.credential });
    const server = await mastraServer(database.url, owner.credential);
    cleanups.push(server.close);
    const call = (credential: string | null, path: string, options = {}) =>
      request(server.url, credential, path, options);
    const base = `/billing/workspaces/${owner.workspaceId}`;
    expect(await call(owner.credential, '/billing/context')).toEqual({
      status: 200,
      body: { actorId: owner.identity.id, workspaceId: owner.workspaceId, role: 'owner', kind: 'personal' },
    });
    expect((await call(member.credential, '/billing/context')).body.workspaceId).toBe(member.workspaceId);
    expect((await call(null, '/billing/context')).status).toBe(401);
    const inviteInput = { recipientId: member.identity.id, role: 'member', expiresAt: future() };
    expect((await call(owner.credential, `${base}/invitations`, { body: inviteInput, key: 'invite' })).status).toBe(
      403,
    );
    expect((await observer.execute('SELECT id FROM invitations')).rows).toEqual([]);
    expect(
      (await call(owner.credential, `${base}/convert`, { body: { oversized: 'x'.repeat(20_000) }, key: 'oversized' }))
        .status,
    ).toBe(413);
    expect((await call(owner.credential, base)).body.kind).toBe('personal');

    expect(
      (await call(owner.credential, `${base}/convert`, { body: { actorId: outsider.identity.id }, key: 'convert' }))
        .status,
    ).toBe(400);
    expect((await call(owner.credential, `${base}/convert`, { body: {} })).status).toBe(400);
    const converted = await call(owner.credential, `${base}/convert`, { body: {}, key: 'convert' });
    expect(converted).toEqual({ status: 200, body: { workspaceId: owner.workspaceId, kind: 'shared' } });
    expect(await call(owner.credential, `${base}/convert`, { body: {}, key: 'convert' })).toEqual(converted);
    const invited = await call(owner.credential, `${base}/invitations`, { body: inviteInput, key: 'invite' });
    expect(invited.status).toBe(200);
    expect(invited.body.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(await call(owner.credential, `${base}/invitations`, { body: inviteInput, key: 'invite' })).toEqual({
      status: 200,
      body: { ...invited.body, token: null },
    });
    expect(
      (await call(owner.credential, `${base}/invitations`, { body: { ...inviteInput, role: 'admin' }, key: 'invite' }))
        .status,
    ).toBe(409);
    expect(
      (
        await call(owner.credential, `${base}/invitations`, {
          body: { ...inviteInput, actorId: owner.identity.id },
          key: 'injection',
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await call(outsider.credential, '/billing/invitations/accept', {
          body: { token: invited.body.token },
          key: 'accept',
        })
      ).status,
    ).toBe(403);
    const accepted = await call(member.credential, '/billing/invitations/accept', {
      body: { token: invited.body.token },
      key: 'accept',
    });
    expect(accepted).toEqual({
      status: 200,
      body: { actorId: member.identity.id, workspaceId: owner.workspaceId, role: 'member' },
    });
    expect(
      await call(member.credential, '/billing/invitations/accept', {
        body: { token: invited.body.token },
        key: 'accept',
      }),
    ).toEqual(accepted);
    expect(
      (
        await call(member.credential, '/billing/invitations/accept', {
          body: { token: invited.body.token },
          key: 'different-accept',
        })
      ).status,
    ).toBe(409);
    const sharedContext = await call(member.credential, base);
    expect(sharedContext).toEqual({
      status: 200,
      body: { actorId: member.identity.id, workspaceId: owner.workspaceId, role: 'member', kind: 'shared' },
    });
    expect((await call(owner.credential, base)).body.actorId).toBe(owner.identity.id);
    expect(await accounting.ensureAccount({ workspaceId: sharedContext.body.workspaceId })).toEqual(before);
    expect((await accounting.getState(before)).meters).toMatchObject([{ confirmedBalance: 97, consumedUnits: 3 }]);
    expect(
      (
        await observer.execute({
          sql: 'SELECT COUNT(*) AS count FROM memberships WHERE workspace_id = ? AND identity_id = ?',
          args: [owner.workspaceId, member.identity.id],
        })
      ).rows[0].count,
    ).toBe(1n);
    const storedCredentials = await observer.execute('SELECT hash FROM local_credentials');
    expect(storedCredentials.rows).toContainEqual({ hash: hashSecret(owner.credential) });
    const invitationRow = (await observer.execute('SELECT token_hash FROM invitations')).rows[0];
    expect(invitationRow.token_hash).toBe(hashSecret(invited.body.token));
    const persisted = JSON.stringify((await observer.execute('SELECT result FROM organization_operations')).rows);
    expect(persisted).not.toContain(invited.body.token);
    expect(persisted).not.toContain(owner.credential);
    await server.close();
    service.close();
    const reopenedStorage = await OrganizationStorage.open({ url: database.url });
    const reopened = new OrganizationService(reopenedStorage, { mode: 'local', provider: 'local' });
    cleanups.push(() => reopened.close());
    expect(await reopened.context({ credential: member.credential, workspaceId: owner.workspaceId })).toMatchObject({
      actorId: member.identity.id,
      workspaceId: owner.workspaceId,
    });
    await expect(reopened.authorize(ownerContext)).rejects.toMatchObject({ code: 'forbidden' });
    expect(await reopened.provisionLocal({ profileId: 'alice', displayName: 'alice' })).toEqual({
      identity: owner.identity,
      workspaceId: owner.workspaceId,
      credential: null,
    });
    const restartedOwner = await reopened.context({ credential: owner.credential });
    expect((await reopened.invite(restartedOwner, 'invite', inviteInput as never)).token).toBeNull();
    expect((await observer.execute('SELECT COUNT(*) AS count FROM immutable_usage')).rows[0].count).toBe(1n);
    expect((await observer.execute('SELECT COUNT(*) AS count FROM identities')).rows[0].count).toBe(3n);
    expect((await observer.execute('SELECT COUNT(*) AS count FROM workspaces')).rows[0].count).toBe(3n);
  }, 120_000);

  it('forged expired and revoked identities cannot access another workspace', async () => {
    const { database, service, storage, observer } = await fixture();
    const owner = await profile(service, 'local-owner');
    const member = await profile(service, 'local-member');
    const stale = await share(service, owner, member);
    const ownerContext = await service.context({ credential: owner.credential });
    await expect(service.authorize({ ...ownerContext })).rejects.toMatchObject({ code: 'forbidden' });
    await expect(
      service.context({ credential: owner.credential, workspaceId: member.workspaceId }),
    ).rejects.toMatchObject({ code: 'forbidden' });
    await expect(
      service.context({ credential: owner.credential, actorId: member.identity.id } as never),
    ).rejects.toMatchObject({ code: 'invalid_input' });
    await service.changeMember(ownerContext, 'remove-member', { memberId: member.identity.id, role: null });
    await expect(service.authorize(stale)).rejects.toMatchObject({ code: 'forbidden' });
    const localContext = await service.context({ credential: member.credential });
    await storage.revokeCredential(member.credential);
    await expect(service.authorize(localContext)).rejects.toMatchObject({ code: 'unauthenticated' });
    expect(
      () =>
        new OrganizationService(storage, {
          identity: new LocalIdentityAdapter(storage),
          mode: 'production',
          provider: 'local',
        }),
    ).toThrowError(/configuration/);
    expect(() => new OrganizationService(storage, { mode: 'local', provider: 'polar' })).toThrowError(/configuration/);

    const { privateKey, publicKey } = await generateKeyPair('ES256');
    const publicJwk = { ...(await exportJWK(publicKey)), kid: 'trusted' };
    const jwtIdentity = new JwtIdentityAdapter(storage, {
      issuer: 'https://issuer.example',
      audience: 'billing',
      algorithms: ['ES256'],
      jwks: { keys: [publicJwk] },
    });
    const jwtService = new OrganizationService(storage, {
      identity: jwtIdentity,
      mode: 'production',
      provider: 'local',
    });
    const alice = await jwtService.provisionJwt({
      issuer: 'https://issuer.example',
      subject: 'alice',
      displayName: 'Alice',
    });
    const bob = await jwtService.provisionJwt({ issuer: 'https://issuer.example', subject: 'bob', displayName: 'Bob' });
    const now = Math.floor(Date.now() / 1000);
    const claims = { iss: 'https://issuer.example', aud: 'billing', sub: 'alice', exp: now + 3600 };
    const sign = (payload: Record<string, unknown>, key = privateKey, algorithm = 'ES256') =>
      new SignJWT(payload).setProtectedHeader({ alg: algorithm, kid: 'trusted' }).sign(key);
    const valid = await sign(claims);
    const server = await httpServer(createBillingApp(jwtService));
    cleanups.push(server.close);
    expect((await request(server.url, valid, '/billing/context')).body).toMatchObject({
      actorId: alice.identity.id,
      workspaceId: alice.workspaceId,
    });
    const otherKey = await generateKeyPair('ES256');
    const { exp: _exp, ...noExpiry } = claims;
    const { sub: _sub, ...noSubject } = claims;
    const invalidTokens = [
      'not-a-jwt',
      valid.slice(0, -8) + 'AAAAAAAA',
      await sign({ ...claims, iss: 'https://wrong.example' }),
      await sign({ ...claims, aud: 'wrong' }),
      await sign({ ...claims, exp: now - 1 }),
      await sign(noExpiry),
      await sign(noSubject),
      await sign({ ...claims, sub: '' }),
      await sign({ ...claims, nbf: now + 3600 }),
      await sign({ ...claims, exp: 'tomorrow' }),
      await sign({ ...claims, sub: 'unknown', email: 'alice@example.test' }),
      await sign(claims, otherKey.privateKey),
      await new SignJWT(claims)
        .setProtectedHeader({ alg: 'HS256' })
        .sign(new TextEncoder().encode('a-long-symmetric-secret-that-must-never-be-accepted')),
    ];
    for (const token of invalidTokens) {
      expect((await request(server.url, token, '/billing/context')).status).toBe(401);
      expect((await request(server.url, valid, '/billing/context')).status).toBe(200);
    }
    const bobToken = await sign({ ...claims, sub: 'bob', email: 'alice@example.test' });
    expect((await request(server.url, bobToken, '/billing/context')).body.actorId).toBe(bob.identity.id);
    expect((await request(server.url, bobToken, `/billing/workspaces/${alice.workspaceId}`)).status).toBe(403);
    const aliceContext = await jwtService.context({ credential: valid });
    await storage.setIdentityActive(alice.identity.id, false);
    expect((await request(server.url, valid, '/billing/context')).status).toBe(401);
    await expect(jwtService.authorize(aliceContext)).rejects.toMatchObject({ code: 'unauthenticated' });
    expect((await request(server.url, bobToken, '/billing/context')).status).toBe(200);
    const expiringToken = await sign({ ...claims, sub: 'bob', exp: Math.floor(Date.now() / 1000) + 1 });
    const expiringContext = await jwtService.context({ credential: expiringToken });
    await setTimeout(1100);
    await expect(jwtService.authorize(expiringContext)).rejects.toMatchObject({ code: 'unauthenticated' });
    expect(
      (
        await observer.execute({
          sql: 'SELECT COUNT(*) AS count FROM memberships WHERE workspace_id = ?',
          args: [alice.workspaceId],
        })
      ).rows[0].count,
    ).toBe(1n);
    expect((await observer.execute('SELECT COUNT(*) AS count FROM identities')).rows[0].count).toBe(4n);
    const reopened = await OrganizationStorage.open({ url: database.url });
    cleanups.push(() => reopened.close());
    expect(await reopened.findPrincipal('https://issuer.example', 'bob')).toEqual(bob.identity);
    await expect(reopened.findPrincipal('https://issuer.example', 'alice')).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  }, 30_000);

  it('invitation expiry and last owner constraints survive concurrent requests', async () => {
    const { database, service, observer } = await fixture();
    const owner = await profile(service, 'expiry-owner');
    const recipient = await profile(service, 'expiry-recipient');
    const stranger = await profile(service, 'expiry-stranger');
    const ownerContext = await service.context({ credential: owner.credential });
    await service.convert(ownerContext, 'convert');
    await expect(
      service.invite(ownerContext, 'already-expired', {
        recipientId: recipient.identity.id,
        role: 'member',
        expiresAt: '2020-01-01T00:00:00Z',
      }),
    ).rejects.toMatchObject({ code: 'conflict' });
    const expired = await service.invite(ownerContext, 'expires', {
      recipientId: recipient.identity.id,
      role: 'member',
      expiresAt: future(),
    });
    await observer.execute({
      sql: "UPDATE invitations SET expires_at = '2020-01-01T00:00:00Z' WHERE id = ?",
      args: [expired.invitationId],
    });
    const server = await httpServer(createBillingApp(service));
    cleanups.push(server.close);
    expect(
      (
        await request(server.url, recipient.credential, '/billing/invitations/accept', {
          body: { token: expired.token },
          key: 'expired',
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await request(server.url, stranger.credential, '/billing/invitations/accept', {
          body: { token: expired.token },
          key: 'wrong-recipient',
        })
      ).status,
    ).toBe(403);
    await expect(
      service.changeMember(ownerContext, 'last-owner', { memberId: owner.identity.id, role: null }),
    ).rejects.toMatchObject({ code: 'conflict' });
    expect(
      (
        await observer.execute({
          sql: 'SELECT accepted_at FROM invitations WHERE id = ?',
          args: [expired.invitationId],
        })
      ).rows,
    ).toEqual([{ accepted_at: null }]);
    const writers = [organizationWriter(database.url), organizationWriter(database.url)];
    cleanups.push(...writers.map(writer => writer.close));
    await Promise.all(writers.map(writer => writer.wait('ready')));
    const race = async (round: number, messages: object[]) => {
      const barrier = await observer.transaction('write');
      try {
        writers.forEach((writer, index) => writer.send(messages[index]));
        expect(
          (await Promise.all(writers.map(writer => writer.wait('attempting', round)))).map(
            message => message.contended,
          ),
        ).toEqual([true, true]);
        await setTimeout(40);
        await barrier.commit();
      } finally {
        barrier.close();
      }
      return (await Promise.all(writers.map(writer => writer.wait('result', round))))
        .map(message => message.status)
        .sort();
    };
    for (let round = 0; round < 20; round++) {
      const first = await profile(service, `first-${round}`);
      const second = await profile(service, `second-${round}`);
      const context = await service.context({ credential: first.credential });
      await service.convert(context, 'convert');
      const invitation = await service.invite(context, 'co-owner', {
        recipientId: second.identity.id,
        role: 'owner',
        expiresAt: future(),
      });
      const acceptance = {
        round: round * 2,
        action: 'accept',
        credential: second.credential,
        workspaceId: second.workspaceId,
        key: 'accept',
        token: invitation.token,
      };
      expect(await race(round * 2, [acceptance, acceptance])).toEqual(['accepted', 'accepted']);
      expect(
        (
          await observer.execute({
            sql: 'SELECT COUNT(*) AS count FROM memberships WHERE workspace_id = ?',
            args: [first.workspaceId],
          })
        ).rows[0].count,
      ).toBe(2n);
      const selfChanges = [first, second].map(person => ({
        round: round * 2 + 1,
        action: 'member',
        credential: person.credential,
        workspaceId: first.workspaceId,
        key: 'self-change',
        memberId: person.identity.id,
        role: round % 2 === 0 ? 'member' : null,
      }));
      expect(await race(round * 2 + 1, selfChanges)).toEqual(['accepted', 'conflict']);
      expect(
        (
          await observer.execute({
            sql: "SELECT COUNT(*) AS count FROM memberships WHERE workspace_id = ? AND role = 'owner'",
            args: [first.workspaceId],
          })
        ).rows[0].count,
      ).toBe(1n);
      expect(
        (
          await observer.execute({
            sql: "SELECT COUNT(*) AS count FROM organization_operations WHERE workspace_id = ? AND operation = 'member'",
            args: [first.workspaceId],
          })
        ).rows[0].count,
      ).toBe(1n);
    }
    expect(
      (await observer.execute('SELECT COUNT(*) AS count FROM invitations WHERE accepted_at IS NOT NULL')).rows[0].count,
    ).toBe(20n);
    const formerOwner = await profile(service, 'former-owner');
    const newOwner = await profile(service, 'new-owner');
    await share(service, formerOwner, newOwner, 'owner');
    const formerContext = await service.context({ credential: formerOwner.credential });
    await service.changeMember(formerContext, 'leave-original', { memberId: formerOwner.identity.id, role: null });
    const host = await profile(service, 'new-host');
    const hostContext = await service.context({ credential: host.credential });
    await service.convert(hostContext, 'convert');
    const returnInvite = await service.invite(hostContext, 'invite-former-owner', {
      recipientId: formerOwner.identity.id,
      role: 'member',
      expiresAt: future(),
    });
    expect(
      (
        await request(server.url, formerOwner.credential, '/billing/invitations/accept', {
          body: { token: returnInvite.token },
          key: 'join-new-host',
        })
      ).status,
    ).toBe(200);
    expect((await request(server.url, formerOwner.credential, `/billing/workspaces/${host.workspaceId}`)).status).toBe(
      200,
    );
    expect((await observer.execute('PRAGMA foreign_key_check')).rows).toEqual([]);
  }, 120_000);

  it('billing management and private result access use separate permissions', async () => {
    const { service, storage, observer } = await fixture();
    const owner = await profile(service, 'owner');
    const admin = await profile(service, 'admin');
    const member = await profile(service, 'member');
    const outsider = await profile(service, 'outsider');
    await storage.seedPrivateRecord({
      id: 'historical-owner-result',
      actorId: owner.identity.id,
      workspaceId: owner.workspaceId,
      result: { text: 'owner-private-history' },
    });
    const adminContext = await share(service, owner, admin, 'admin');
    await share(service, owner, member);
    await storage.seedPrivateRecord({
      id: 'member-result',
      actorId: member.identity.id,
      workspaceId: owner.workspaceId,
      result: { text: 'member-private-result' },
    });
    const server = await httpServer(createBillingApp(service));
    cleanups.push(server.close);
    const base = `/billing/workspaces/${owner.workspaceId}`;
    const call = (credential: string, path: string, options = {}) =>
      request(server.url, credential, base + path, options);
    expect((await call(owner.credential, '/billing-access')).body.permission).toBe('manage-billing');
    for (const person of [admin, member, outsider])
      expect((await call(person.credential, '/billing-access')).status).toBe(403);
    expect((await call(admin.credential, '/members')).body).toHaveLength(3);
    expect((await call(member.credential, '/members')).status).toBe(403);
    for (const person of [owner, admin, outsider])
      expect((await call(person.credential, '/private-records/member-result')).status).toBe(403);
    expect(await call(member.credential, '/private-records/member-result')).toEqual({
      status: 200,
      body: { text: 'member-private-result' },
    });
    expect(await call(owner.credential, '/private-records/historical-owner-result')).toEqual({
      status: 200,
      body: { text: 'owner-private-history' },
    });
    expect((await call(admin.credential, '/private-records/historical-owner-result')).status).toBe(403);
    expect((await call(member.credential, '/private-records/historical-owner-result')).status).toBe(403);
    for (const change of [
      { memberId: owner.identity.id, role: 'member' },
      { memberId: owner.identity.id, role: null },
      { memberId: member.identity.id, role: 'owner' },
    ]) {
      expect(
        (
          await call(admin.credential, '/members', {
            method: 'PATCH',
            body: change,
            key: `denied-${String(change.role)}-${change.memberId}`,
          })
        ).status,
      ).toBe(403);
    }
    expect(
      (
        await call(admin.credential, '/invitations', {
          body: { recipientId: outsider.identity.id, role: 'owner', expiresAt: future() },
          key: 'owner-invite',
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await call(member.credential, '/invitations', {
          body: { recipientId: outsider.identity.id, role: 'member', expiresAt: future() },
          key: 'member-invite',
        })
      ).status,
    ).toBe(403);
    const sharedKey = 'scoped-mutation';
    const input = { recipientId: outsider.identity.id, role: 'member', expiresAt: future() };
    const ownerInvite = await call(owner.credential, '/invitations', { body: input, key: sharedKey });
    const adminInvite = await call(admin.credential, '/invitations', { body: input, key: sharedKey });
    expect(ownerInvite.status).toBe(200);
    expect(adminInvite.status).toBe(200);
    expect(adminInvite.body.invitationId).not.toBe(ownerInvite.body.invitationId);
    expect(adminInvite.body.token).not.toBe(ownerInvite.body.token);
    const reordered = { expiresAt: input.expiresAt, role: input.role, recipientId: input.recipientId };
    expect((await call(admin.credential, '/invitations', { body: reordered, key: sharedKey })).body.token).toBeNull();
    const ownAdmin = await service.context({ credential: admin.credential });
    await service.convert(ownAdmin, sharedKey);
    expect((await service.invite(ownAdmin, sharedKey, { ...input, role: 'member' })).token).toMatch(
      /^[A-Za-z0-9_-]{43}$/,
    );
    expect(
      (
        await call(admin.credential, '/members', {
          method: 'PATCH',
          body: { memberId: member.identity.id, role: 'admin' },
          key: 'promote-member',
        })
      ).status,
    ).toBe(200);
    const ownerContext = await service.context({ credential: owner.credential });
    await service.changeMember(ownerContext, 'demote-admin', { memberId: admin.identity.id, role: 'member' });
    await expect(service.authorize(adminContext, 'manage-members')).rejects.toMatchObject({ code: 'forbidden' });
    expect((await call(admin.credential, '/invitations', { body: input, key: sharedKey })).status).toBe(403);
    await service.changeMember(ownerContext, 'remove-member', { memberId: member.identity.id, role: null });
    expect((await call(member.credential, '/private-records/member-result')).status).toBe(403);
    expect(
      (await observer.execute({ sql: 'SELECT result FROM private_records WHERE id = ?', args: ['member-result'] }))
        .rows,
    ).toEqual([{ result: JSON.stringify({ text: 'member-private-result' }) }]);
    expect(
      (
        await observer.execute({
          sql: 'SELECT role FROM memberships WHERE workspace_id = ? AND identity_id = ?',
          args: [owner.workspaceId, owner.identity.id],
        })
      ).rows,
    ).toEqual([{ role: 'owner' }]);
  });
});
