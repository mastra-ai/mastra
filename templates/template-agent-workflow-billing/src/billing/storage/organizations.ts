import { randomUUID } from 'node:crypto';
import type { Row, Transaction } from '@libsql/client/node';
import { z } from 'zod';
import { BillingError, identifierSchema, parseInput } from '../contracts.js';
import { hashSecret, generateSecret, identitySchema } from '../identity.js';
import type { Identity, IdentityDirectory } from '../identity.js';
import { BillingDatabase } from './database.js';

export const roleSchema = z.enum(['owner', 'admin', 'member']);
export type Role = z.infer<typeof roleSchema>;
export type Permission = 'execute' | 'manage-members' | 'manage-billing' | 'manage-ownership';
export interface WorkspaceContext {
  readonly actorId: string;
  readonly workspaceId: string;
  readonly role: Role;
  readonly kind: 'personal' | 'shared';
}
const allowed: Record<Permission, readonly Role[]> = {
  execute: ['owner', 'admin', 'member'],
  'manage-members': ['owner', 'admin'],
  'manage-billing': ['owner'],
  'manage-ownership': ['owner'],
};
const principalSchema = z.strictObject({
  issuer: z.string().min(1).max(256),
  subject: z.string().min(1).max(256),
  displayName: identitySchema.shape.displayName,
});
export const privateRecordSchema = z.strictObject({
  id: identifierSchema,
  workspaceId: identifierSchema,
  actorId: identifierSchema,
  result: z.strictObject({ text: z.string().max(16384) }),
});
const publicIdentity = (row: Row): Identity => identitySchema.parse({ id: row.id, displayName: row.display_name });

export class OrganizationStorage implements IdentityDirectory {
  private constructor(private readonly database: BillingDatabase) {}
  static async open(options: { url: string }): Promise<OrganizationStorage> {
    return new OrganizationStorage(await BillingDatabase.open(options));
  }
  close(): void {
    this.database.close();
  }

  async provisionPrincipal(
    input: z.input<typeof principalSchema>,
    local: boolean,
  ): Promise<{ identity: Identity; workspaceId: string; credential: string | null }> {
    const principal = parseInput(principalSchema, input);
    const credential = local ? generateSecret() : null;
    return this.database.write(async transaction => {
      const existing = (
        await transaction.execute({
          sql: 'SELECT * FROM identities WHERE issuer = ? AND subject = ?',
          args: [principal.issuer, principal.subject],
        })
      ).rows[0];
      if (existing) {
        if (existing.active !== 1n || existing.kind !== (local ? 'local' : 'jwt')) throw new BillingError('conflict');
        const workspace = (
          await transaction.execute({
            sql: 'SELECT id FROM workspaces WHERE personal_identity_id = ?',
            args: [existing.id],
          })
        ).rows[0];
        return { identity: publicIdentity(existing), workspaceId: String(workspace.id), credential: null };
      }
      const identity = { id: randomUUID(), displayName: principal.displayName };
      const workspaceId = randomUUID();
      await transaction.execute({
        sql: 'INSERT INTO identities (id, issuer, subject, kind, display_name, active) VALUES (?, ?, ?, ?, ?, 1)',
        args: [identity.id, principal.issuer, principal.subject, local ? 'local' : 'jwt', identity.displayName],
      });
      await transaction.execute({
        sql: "INSERT INTO workspaces (id, personal_identity_id, kind) VALUES (?, ?, 'personal')",
        args: [workspaceId, identity.id],
      });
      await transaction.execute({
        sql: "INSERT INTO memberships (workspace_id, identity_id, role) VALUES (?, ?, 'owner')",
        args: [workspaceId, identity.id],
      });
      if (credential)
        await transaction.execute({
          sql: 'INSERT INTO local_credentials (hash, identity_id, active) VALUES (?, ?, 1)',
          args: [hashSecret(credential), identity.id],
        });
      return { identity, workspaceId, credential };
    });
  }

  async findLocalCredential(hash: string): Promise<Identity> {
    return this.database.write(async transaction => {
      const row = (
        await transaction.execute({
          sql: "SELECT i.* FROM identities i JOIN local_credentials c ON c.identity_id = i.id WHERE c.hash = ? AND c.active = 1 AND i.active = 1 AND i.kind = 'local'",
          args: [hash],
        })
      ).rows[0];
      if (!row) throw new BillingError('unauthenticated');
      return publicIdentity(row);
    });
  }

  async findPrincipal(issuer: string, subject: string): Promise<Identity> {
    return this.database.write(async transaction => {
      const row = (
        await transaction.execute({
          sql: "SELECT * FROM identities WHERE issuer = ? AND subject = ? AND active = 1 AND kind = 'jwt'",
          args: [issuer, subject],
        })
      ).rows[0];
      if (!row) throw new BillingError('unauthenticated');
      return publicIdentity(row);
    });
  }

  // Trusted provisioning/revocation only; never expose these as HTTP handlers.
  async setIdentityActive(identityId: string, active: boolean): Promise<void> {
    const input = parseInput(z.strictObject({ identityId: identifierSchema, active: z.boolean() }), {
      identityId,
      active,
    });
    await this.database.write(async transaction => {
      await transaction.execute({
        sql: 'UPDATE identities SET active = ? WHERE id = ?',
        args: [input.active ? 1 : 0, input.identityId],
      });
    });
  }
  async revokeCredential(credential: string): Promise<void> {
    await this.database.write(async transaction => {
      await transaction.execute({
        sql: 'UPDATE local_credentials SET active = 0 WHERE hash = ?',
        args: [hashSecret(credential)],
      });
    });
  }

  private async authorize(
    transaction: Transaction,
    actorId: string,
    workspaceId: string | undefined,
    permission: Permission,
  ): Promise<WorkspaceContext> {
    const identity = (await transaction.execute({ sql: 'SELECT active FROM identities WHERE id = ?', args: [actorId] }))
      .rows[0];
    if (identity?.active !== 1n) throw new BillingError('unauthenticated');
    const row = (
      await transaction.execute({
        sql:
          workspaceId === undefined
            ? 'SELECT w.id, w.kind, m.role FROM workspaces w JOIN memberships m ON m.workspace_id = w.id WHERE w.personal_identity_id = ? AND m.identity_id = ?'
            : 'SELECT w.id, w.kind, m.role FROM workspaces w JOIN memberships m ON m.workspace_id = w.id WHERE w.id = ? AND m.identity_id = ?',
        args: [workspaceId ?? actorId, actorId],
      })
    ).rows[0];
    if (!row || !allowed[permission].includes(row.role as Role)) throw new BillingError('forbidden');
    return { actorId, workspaceId: String(row.id), kind: row.kind as 'personal' | 'shared', role: row.role as Role };
  }

  resolve(actorId: string, workspaceId?: string, permission: Permission = 'execute'): Promise<WorkspaceContext> {
    return this.database.write(transaction => this.authorize(transaction, actorId, workspaceId, permission));
  }

  private async mutate<T extends object>(
    actorId: string,
    workspaceId: string,
    operation: string,
    key: string,
    input: unknown,
    permission: Permission,
    change: (transaction: Transaction, context: WorkspaceContext) => Promise<{ result: T; secret?: string }>,
  ): Promise<T> {
    const fingerprint = hashSecret(JSON.stringify(input));
    return this.database.write(async transaction => {
      const context = await this.authorize(transaction, actorId, workspaceId, permission);
      const previous = (
        await transaction.execute({
          sql: 'SELECT fingerprint, result FROM organization_operations WHERE actor_id = ? AND workspace_id = ? AND operation = ? AND key = ?',
          args: [actorId, workspaceId, operation, key],
        })
      ).rows[0];
      if (previous) {
        if (previous.fingerprint !== fingerprint) throw new BillingError('conflict');
        return JSON.parse(String(previous.result)) as T;
      }
      const { result, secret } = await change(transaction, context);
      // Store a replay projection only. Invitation credentials are returned once.
      await transaction.execute({
        sql: 'INSERT INTO organization_operations (actor_id, workspace_id, operation, key, fingerprint, result) VALUES (?, ?, ?, ?, ?, ?)',
        args: [actorId, workspaceId, operation, key, fingerprint, JSON.stringify(result)],
      });
      return secret ? { ...result, token: secret } : result;
    });
  }

  convert(actorId: string, workspaceId: string, key: string): Promise<{ workspaceId: string; kind: 'shared' }> {
    return this.mutate(actorId, workspaceId, 'convert', key, {}, 'manage-ownership', async transaction => {
      await transaction.execute({ sql: "UPDATE workspaces SET kind = 'shared' WHERE id = ?", args: [workspaceId] });
      return { result: { workspaceId, kind: 'shared' as const } };
    });
  }

  invite(
    actorId: string,
    workspaceId: string,
    key: string,
    input: { recipientId: string; role: Role; expiresAt: string },
  ): Promise<{
    invitationId: string;
    workspaceId: string;
    recipientId: string;
    role: Role;
    expiresAt: string;
    token: string | null;
  }> {
    const secret = generateSecret();
    return this.mutate(actorId, workspaceId, 'invite', key, input, 'manage-members', async (transaction, context) => {
      if (context.kind !== 'shared' || (input.role === 'owner' && context.role !== 'owner'))
        throw new BillingError('forbidden');
      if (Date.parse(input.expiresAt) <= Date.now()) throw new BillingError('conflict');
      const recipient = (
        await transaction.execute({ sql: 'SELECT active FROM identities WHERE id = ?', args: [input.recipientId] })
      ).rows[0];
      if (recipient?.active !== 1n) throw new BillingError('conflict');
      const member = (
        await transaction.execute({
          sql: 'SELECT role FROM memberships WHERE workspace_id = ? AND identity_id = ?',
          args: [workspaceId, input.recipientId],
        })
      ).rows[0];
      if (member) throw new BillingError('conflict');
      const invitationId = randomUUID();
      await transaction.execute({
        sql: 'INSERT INTO invitations (id, workspace_id, recipient_id, role, token_hash, expires_at, accepted_at) VALUES (?, ?, ?, ?, ?, ?, NULL)',
        args: [invitationId, workspaceId, input.recipientId, input.role, hashSecret(secret), input.expiresAt],
      });
      return { result: { invitationId, workspaceId, ...input, token: null }, secret };
    });
  }

  async accept(
    actorId: string,
    key: string,
    token: string,
  ): Promise<{ workspaceId: string; actorId: string; role: Role }> {
    const tokenHash = hashSecret(token);
    // Resolve only the invitation's workspace here, never grant from this lookup.
    const workspaceId = await this.database.write(async transaction => {
      const row = (
        await transaction.execute({
          sql: 'SELECT workspace_id FROM invitations WHERE token_hash = ?',
          args: [tokenHash],
        })
      ).rows[0];
      if (!row) throw new BillingError('forbidden');
      return String(row.workspace_id);
    });
    return this.database.write(async transaction => {
      const identity = (
        await transaction.execute({ sql: 'SELECT active FROM identities WHERE id = ?', args: [actorId] })
      ).rows[0];
      if (identity?.active !== 1n) throw new BillingError('unauthenticated');
      const invitation = (
        await transaction.execute({
          sql: 'SELECT * FROM invitations WHERE token_hash = ? AND recipient_id = ?',
          args: [tokenHash, actorId],
        })
      ).rows[0];
      if (!invitation) throw new BillingError('forbidden');
      const previous = (
        await transaction.execute({
          sql: "SELECT fingerprint, result FROM organization_operations WHERE actor_id = ? AND workspace_id = ? AND operation = 'accept' AND key = ?",
          args: [actorId, workspaceId, key],
        })
      ).rows[0];
      if (previous) {
        if (previous.fingerprint !== tokenHash) throw new BillingError('conflict');
        await this.authorize(transaction, actorId, workspaceId, 'execute');
        return JSON.parse(String(previous.result));
      }
      if (invitation.accepted_at !== null || Date.parse(String(invitation.expires_at)) <= Date.now())
        throw new BillingError('conflict');
      const workspace = (
        await transaction.execute({ sql: 'SELECT kind FROM workspaces WHERE id = ?', args: [workspaceId] })
      ).rows[0];
      if (workspace.kind !== 'shared') throw new BillingError('forbidden');
      const existing = (
        await transaction.execute({
          sql: 'SELECT role FROM memberships WHERE workspace_id = ? AND identity_id = ?',
          args: [workspaceId, actorId],
        })
      ).rows[0];
      if (existing) throw new BillingError('conflict');
      await transaction.execute({
        sql: 'INSERT INTO memberships (workspace_id, identity_id, role) VALUES (?, ?, ?)',
        args: [workspaceId, actorId, invitation.role],
      });
      await transaction.execute({
        sql: 'UPDATE invitations SET accepted_at = ? WHERE id = ? AND accepted_at IS NULL',
        args: [new Date().toISOString(), invitation.id],
      });
      const result = { workspaceId, actorId, role: invitation.role as Role };
      await transaction.execute({
        sql: "INSERT INTO organization_operations (actor_id, workspace_id, operation, key, fingerprint, result) VALUES (?, ?, 'accept', ?, ?, ?)",
        args: [actorId, workspaceId, key, tokenHash, JSON.stringify(result)],
      });
      return result;
    });
  }

  changeMember(
    actorId: string,
    workspaceId: string,
    key: string,
    input: { memberId: string; role: Role | null },
  ): Promise<{ memberId: string; role: Role | null }> {
    return this.mutate(actorId, workspaceId, 'member', key, input, 'manage-members', async (transaction, context) => {
      const member = (
        await transaction.execute({
          sql: 'SELECT role FROM memberships WHERE workspace_id = ? AND identity_id = ?',
          args: [workspaceId, input.memberId],
        })
      ).rows[0];
      if (!member) throw new BillingError('conflict');
      if ((member.role === 'owner' || input.role === 'owner') && context.role !== 'owner')
        throw new BillingError('forbidden');
      if (member.role === 'owner' && input.role !== 'owner') {
        const owners = (
          await transaction.execute({
            sql: "SELECT COUNT(*) AS count FROM memberships WHERE workspace_id = ? AND role = 'owner'",
            args: [workspaceId],
          })
        ).rows[0];
        if (owners.count === 1n) throw new BillingError('conflict');
      }
      if (input.role === null)
        await transaction.execute({
          sql: 'DELETE FROM memberships WHERE workspace_id = ? AND identity_id = ?',
          args: [workspaceId, input.memberId],
        });
      else
        await transaction.execute({
          sql: 'UPDATE memberships SET role = ? WHERE workspace_id = ? AND identity_id = ?',
          args: [input.role, workspaceId, input.memberId],
        });
      return { result: input };
    });
  }

  async members(actorId: string, workspaceId: string): Promise<{ actorId: string; role: Role }[]> {
    return this.database.write(async transaction => {
      await this.authorize(transaction, actorId, workspaceId, 'manage-members');
      return (
        await transaction.execute({
          sql: 'SELECT identity_id, role FROM memberships WHERE workspace_id = ? ORDER BY identity_id',
          args: [workspaceId],
        })
      ).rows.map(row => ({ actorId: String(row.identity_id), role: row.role as Role }));
    });
  }

  // Bounded trusted seed/read contract for actor-private projections; no executor.
  async seedPrivateRecord(input: z.input<typeof privateRecordSchema>): Promise<void> {
    const record = parseInput(privateRecordSchema, input);
    await this.database.write(async transaction => {
      await this.authorize(transaction, record.actorId, record.workspaceId, 'execute');
      await transaction.execute({
        sql: 'INSERT INTO private_records (id, workspace_id, actor_id, result) VALUES (?, ?, ?, ?)',
        args: [record.id, record.workspaceId, record.actorId, JSON.stringify(record.result)],
      });
    });
  }
  async readPrivateRecord(actorId: string, workspaceId: string, recordId: string): Promise<{ text: string }> {
    return this.database.write(async transaction => {
      await this.authorize(transaction, actorId, workspaceId, 'execute');
      const row = (
        await transaction.execute({
          sql: 'SELECT result FROM private_records WHERE id = ? AND workspace_id = ? AND actor_id = ?',
          args: [recordId, workspaceId, actorId],
        })
      ).rows[0];
      if (!row) throw new BillingError('forbidden');
      return JSON.parse(String(row.result));
    });
  }
}
