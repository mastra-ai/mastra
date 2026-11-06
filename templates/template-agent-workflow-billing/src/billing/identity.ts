import { createHash, randomBytes } from 'node:crypto';
import { createLocalJWKSet, jwtVerify } from 'jose';
import type { JSONWebKeySet } from 'jose';
import { z } from 'zod';
import { BillingError, identifierSchema, parseInput } from './contracts.js';

export const identitySchema = z.strictObject({ id: identifierSchema, displayName: z.string().trim().min(1).max(100) });
export type Identity = Readonly<z.infer<typeof identitySchema>>;
export const credentialSchema = z.string().min(1).max(8192);
export const hashSecret = (secret: string): string => createHash('sha256').update(secret).digest('hex');
export const generateSecret = (): string => randomBytes(32).toString('base64url');

export interface IdentityDirectory {
  findLocalCredential(hash: string): Promise<Identity>;
  findPrincipal(issuer: string, subject: string): Promise<Identity>;
}

export interface IdentityAdapter {
  readonly kind: 'local' | 'jwt';
  authenticate(credential: string): Promise<Identity>;
}

export class LocalIdentityAdapter implements IdentityAdapter {
  readonly kind = 'local';
  constructor(private readonly directory: IdentityDirectory) {}
  authenticate(credential: string): Promise<Identity> {
    return this.directory.findLocalCredential(hashSecret(parseInput(credentialSchema, credential)));
  }
}

const jwtOptionsSchema = z.strictObject({
  issuer: z.url(),
  audience: z.string().min(1).max(256),
  algorithms: z
    .array(z.enum(['RS256', 'RS384', 'RS512', 'PS256', 'PS384', 'PS512', 'ES256', 'ES384', 'ES512', 'EdDSA']))
    .min(1),
});
export interface JwtIdentityOptions {
  readonly issuer: string;
  readonly audience: string;
  readonly algorithms: z.infer<typeof jwtOptionsSchema>['algorithms'];
  readonly jwks: JSONWebKeySet;
}

export class JwtIdentityAdapter implements IdentityAdapter {
  readonly kind = 'jwt';
  private readonly options: z.infer<typeof jwtOptionsSchema>;
  private readonly keys: ReturnType<typeof createLocalJWKSet>;

  constructor(
    private readonly directory: IdentityDirectory,
    options: JwtIdentityOptions,
  ) {
    if (!options || typeof options !== 'object' || !options.jwks) throw new BillingError('invalid_configuration');
    const parsed = jwtOptionsSchema.safeParse({
      issuer: options.issuer,
      audience: options.audience,
      algorithms: options.algorithms,
    });
    const keys = z
      .strictObject({ keys: z.array(z.object({ kty: z.enum(['RSA', 'EC', 'OKP']) }).passthrough()).min(1) })
      .safeParse(options.jwks);
    if (!parsed.success || !keys.success || options.jwks.keys.some(key => 'd' in key || 'k' in key))
      throw new BillingError('invalid_configuration');
    this.options = parsed.data;
    this.keys = createLocalJWKSet(structuredClone(options.jwks));
  }

  async authenticate(credential: string): Promise<Identity> {
    const token = parseInput(credentialSchema, credential);
    let subject: string;
    try {
      const { payload } = await jwtVerify(token, this.keys, {
        issuer: this.options.issuer,
        audience: this.options.audience,
        algorithms: this.options.algorithms,
        requiredClaims: ['sub', 'exp', 'iss', 'aud'],
      });
      subject = z.string().min(1).max(256).parse(payload.sub);
    } catch {
      throw new BillingError('unauthenticated');
    }
    // No email matching or implicit provisioning from token claims.
    return this.directory.findPrincipal(this.options.issuer, subject);
  }
}

export function assertIdentityMode(
  adapter: IdentityAdapter,
  options: { mode: 'local' | 'production'; provider: 'local' | 'polar' },
): void {
  const configuration = z
    .strictObject({ mode: z.enum(['local', 'production']), provider: z.enum(['local', 'polar']) })
    .safeParse(options);
  if (
    !configuration.success ||
    !['local', 'jwt'].includes(adapter.kind) ||
    (adapter.kind === 'local' && (options.mode !== 'local' || options.provider !== 'local'))
  )
    throw new BillingError('invalid_configuration');
}
