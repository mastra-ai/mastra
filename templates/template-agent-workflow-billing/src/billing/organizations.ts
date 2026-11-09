import { z } from 'zod';
import { decodeJwt } from 'jose';
import type { AdmissionIdentity } from './accounting.js';
import { BillingError, identifierSchema, parseInput, timestampSchema } from './contracts.js';
import { assertIdentityMode, credentialSchema, hashSecret, LocalIdentityAdapter } from './identity.js';
import type { Identity, IdentityAdapter } from './identity.js';
import { OrganizationStorage, roleSchema } from './storage/organizations.js';
import type { Permission, WorkspaceContext } from './storage/organizations.js';

const contextSchema = z.strictObject({ credential: credentialSchema, workspaceId: identifierSchema.optional() });
const keySchema = identifierSchema;
const invitationSchema = z.strictObject({
  recipientId: identifierSchema,
  role: roleSchema,
  expiresAt: timestampSchema,
});
const memberSchema = z.strictObject({ memberId: identifierSchema, role: roleSchema.nullable() });
const profileSchema = z.strictObject({ profileId: identifierSchema, displayName: z.string().trim().min(1).max(100) });
const principalSchema = z.strictObject({
  workspaceId: identifierSchema.optional(),
  issuer: z.url(),
  subject: z.string().min(1).max(256),
  displayName: profileSchema.shape.displayName,
});

export interface BillingContext extends WorkspaceContext {}

export class OrganizationService {
  private readonly contexts = new WeakMap<
    BillingContext,
    { credential: string; actorId: string; workspaceId: string }
  >();
  readonly identity: IdentityAdapter;

  constructor(
    readonly storage: OrganizationStorage,
    options: {
      identity?: IdentityAdapter;
      mode: 'local' | 'production';
      provider: string;
    },
  ) {
    this.identity = options.identity ?? new LocalIdentityAdapter(storage);
    assertIdentityMode(this.identity, { mode: options.mode, provider: options.provider });
  }

  async context(input: z.input<typeof contextSchema>): Promise<BillingContext> {
    const selection = parseInput(contextSchema, input);
    const identity = await this.identity.authenticate(selection.credential);
    const resolved = await this.storage.resolve(identity.id, selection.workspaceId);
    const context = Object.freeze(resolved);
    this.contexts.set(context, {
      credential: selection.credential,
      actorId: identity.id,
      workspaceId: resolved.workspaceId,
    });
    return context;
  }

  private async current(context: BillingContext): Promise<{ actorId: string; workspaceId: string }> {
    const bound = this.contexts.get(context);
    if (!bound) throw new BillingError('forbidden');
    const identity = await this.identity.authenticate(bound.credential);
    if (identity.id !== bound.actorId) throw new BillingError('unauthenticated');
    return { actorId: bound.actorId, workspaceId: bound.workspaceId };
  }

  // Internal accounting evidence is always derived from a live bound context.
  // Storage rechecks local revocation, identity and membership in its transaction.
  async accountingIdentity(context: BillingContext): Promise<AdmissionIdentity> {
    const current = await this.current(context);
    const bound = this.contexts.get(context)!;
    return {
      ...current,
      credentialHash: this.identity.kind === 'local' ? hashSecret(bound.credential) : null,
      validUntil: this.identity.kind === 'jwt' ? decodeJwt(bound.credential).exp! * 1000 : null,
    };
  }

  async authorize(context: BillingContext, permission: Permission = 'execute'): Promise<WorkspaceContext> {
    const current = await this.current(context);
    return this.storage.resolve(current.actorId, current.workspaceId, permission);
  }

  async convert(context: BillingContext, key: string) {
    const parsedKey = parseInput(keySchema, key);
    const current = await this.current(context);
    return this.storage.convert(current.actorId, current.workspaceId, parsedKey);
  }

  async invite(context: BillingContext, key: string, input: unknown) {
    const invitation = parseInput(invitationSchema, input);
    const parsedKey = parseInput(keySchema, key);
    const current = await this.current(context);
    return this.storage.invite(current.actorId, current.workspaceId, parsedKey, invitation);
  }

  async accept(context: BillingContext, key: string, input: unknown) {
    const { token } = parseInput(z.strictObject({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }), input);
    const parsedKey = parseInput(keySchema, key);
    const current = await this.current(context);
    // Acceptance authenticates the recipient, without requiring existing target membership.
    return this.storage.accept(current.actorId, parsedKey, token);
  }

  async acceptInvitation(input: { credential: string; key: string; token: string }) {
    const invitation = parseInput(
      z.strictObject({
        credential: credentialSchema,
        key: keySchema,
        token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
      }),
      input,
    );
    const identity = await this.identity.authenticate(invitation.credential);
    return this.storage.accept(identity.id, invitation.key, invitation.token);
  }

  async changeMember(context: BillingContext, key: string, input: unknown) {
    const member = parseInput(memberSchema, input);
    const parsedKey = parseInput(keySchema, key);
    const current = await this.current(context);
    return this.storage.changeMember(current.actorId, current.workspaceId, parsedKey, member);
  }

  async members(context: BillingContext) {
    const current = await this.current(context);
    return this.storage.members(current.actorId, current.workspaceId);
  }

  async readPrivateRecord(context: BillingContext, recordId: string) {
    const id = parseInput(identifierSchema, recordId);
    const current = await this.current(context);
    return this.storage.readPrivateRecord(current.actorId, current.workspaceId, id);
  }

  // Trusted setup API. No HTTP endpoint creates identities or generates credentials.
  provisionLocal(
    input: z.input<typeof profileSchema>,
  ): Promise<{ identity: Identity; workspaceId: string; credential: string | null }> {
    if (this.identity.kind !== 'local') throw new BillingError('unsupported');
    const profile = parseInput(profileSchema, input);
    return this.storage.provisionPrincipal(
      { issuer: 'local', subject: profile.profileId, displayName: profile.displayName },
      true,
    );
  }
  provisionJwt(input: z.input<typeof principalSchema>) {
    if (this.identity.kind !== 'jwt') throw new BillingError('unsupported');
    return this.storage.provisionPrincipal(parseInput(principalSchema, input), false);
  }
  close(): void {
    this.storage.close();
  }
}
