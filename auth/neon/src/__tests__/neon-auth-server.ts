/**
 * A local HTTP stand-in for a hosted Neon Auth instance.
 *
 * Every behavior here was recorded from a hosted Neon Auth project
 * (Managed Better Auth) and is what the adapter must cope with:
 * - Endpoints live directly under the Neon Auth URL (`<base>/get-session`,
 *   `<base>/.well-known/jwks.json`), not under an extra `/auth` segment.
 * - Sessions are only recognized through the signed
 *   `__Secure-neon-auth.session_token` cookie (`<token>.<signature>`). The raw
 *   token from the sign-in body, bearer headers, and other cookie names all
 *   produce `null` from get-session.
 * - POST endpoints require an Origin header that Neon Auth trusts
 *   (localhost when "allow localhost" is on, plus Neon Auth's own origin).
 * - `/token` issues an EdDSA JWT whose `iss` and `aud` are the Neon Auth
 *   origin and whose `role` claim is the Data API role `authenticated`.
 * - Organization roles are read with the session cookie through
 *   `/organization/get-active-member-role`.
 *
 * The live suite runs the same scenarios against a live Neon project.
 */
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';

const COOKIE_NAME = '__Secure-neon-auth.session_token';
const BASE_PATH = '/neondb/auth';

interface StoredUser {
  id: string;
  email: string;
  name: string;
  password: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

interface StoredSession {
  id: string;
  token: string;
  userId: string;
  activeOrganizationId: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

export interface NeonAuthTestServer {
  baseUrl: string;
  close(): Promise<void>;
}

export async function startNeonAuthTestServer(): Promise<NeonAuthTestServer> {
  const secret = randomBytes(32);
  const { publicKey, privateKey } = await generateKeyPair('EdDSA', { crv: 'Ed25519' });
  const kid = randomUUID();
  const publicJwk = { ...(await exportJWK(publicKey)), alg: 'EdDSA', kid };

  const users = new Map<string, StoredUser>();
  const sessions = new Map<string, StoredSession>();
  const members: { organizationId: string; userId: string; role: string }[] = [];

  let origin = '';

  const sign = (token: string) => `${token}.${createHmac('sha256', secret).update(token).digest('base64url')}`;

  const sessionFromCookie = (req: IncomingMessage): StoredSession | null => {
    for (const pair of (req.headers.cookie ?? '').split(';')) {
      const index = pair.indexOf('=');
      if (index === -1 || pair.slice(0, index).trim() !== COOKIE_NAME) continue;
      const value = decodeURIComponent(pair.slice(index + 1).trim());
      const dot = value.lastIndexOf('.');
      if (dot === -1) return null;
      const token = value.slice(0, dot);
      if (sign(token) !== value) return null;
      const session = sessions.get(token);
      return session && new Date(session.expiresAt) > new Date() ? session : null;
    }
    return null;
  };

  const publicUser = (user: StoredUser) => ({
    name: user.name,
    email: user.email,
    emailVerified: false,
    image: null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    role: user.role,
    banned: false,
    banReason: null,
    banExpires: null,
    id: user.id,
  });

  const createSession = (user: StoredUser): StoredSession => {
    const now = new Date();
    const session: StoredSession = {
      id: randomUUID(),
      token: randomBytes(24).toString('base64url'),
      userId: user.id,
      activeOrganizationId: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
    sessions.set(session.token, session);
    return session;
  };

  const sessionCookie = (session: StoredSession) =>
    `${COOKIE_NAME}=${sign(session.token)}; Max-Age=604800; Path=/; HttpOnly; Secure; SameSite=None; Partitioned`;

  const isTrustedOrigin = (value: string) => {
    if (value === origin) return true;
    try {
      const { hostname } = new URL(value);
      return hostname === 'localhost' || hostname === '127.0.0.1';
    } catch {
      return false;
    }
  };

  const send = (
    res: ServerResponse,
    status: number,
    body: unknown,
    headers: Record<string, string | string[]> = {},
  ) => {
    res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
    res.end(body === undefined ? '' : JSON.stringify(body));
  };

  const readJson = async (req: IncomingMessage): Promise<Record<string, string>> => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const raw = Buffer.concat(chunks).toString('utf8');
    return raw ? JSON.parse(raw) : {};
  };

  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', origin);
    if (!url.pathname.startsWith(`${BASE_PATH}/`)) return send(res, 404, undefined);
    const path = url.pathname.slice(BASE_PATH.length);

    if (req.method === 'POST') {
      const requestOrigin = req.headers.origin;
      if (!requestOrigin) {
        return send(res, path === '/sign-out' ? 403 : 400, {
          message: 'Missing or null Origin',
          code: 'MISSING_OR_NULL_ORIGIN',
        });
      }
      if (!isTrustedOrigin(requestOrigin)) {
        return send(res, 403, { message: 'Invalid origin', code: 'INVALID_ORIGIN' });
      }
    }

    if (req.method === 'GET' && path === '/.well-known/jwks.json') {
      return send(res, 200, { keys: [publicJwk] });
    }

    if (req.method === 'POST' && path === '/sign-up/email') {
      const body = await readJson(req);
      if ([...users.values()].some(u => u.email === body.email)) {
        return send(res, 422, {
          message: 'User already exists. Use another email.',
          code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL',
        });
      }
      const now = new Date().toISOString();
      const user: StoredUser = {
        id: randomUUID(),
        email: body.email!,
        name: body.name!,
        password: body.password!,
        role: 'user',
        createdAt: now,
        updatedAt: now,
      };
      users.set(user.id, user);
      const session = createSession(user);
      return send(res, 200, { token: session.token, user: publicUser(user) }, { 'Set-Cookie': sessionCookie(session) });
    }

    if (req.method === 'POST' && path === '/sign-in/email') {
      const body = await readJson(req);
      const user = [...users.values()].find(u => u.email === body.email && u.password === body.password);
      if (!user) {
        return send(res, 401, { message: 'Invalid email or password', code: 'INVALID_EMAIL_OR_PASSWORD' });
      }
      const session = createSession(user);
      return send(
        res,
        200,
        { redirect: false, token: session.token, user: publicUser(user) },
        { 'Set-Cookie': sessionCookie(session) },
      );
    }

    if (req.method === 'GET' && path === '/get-session') {
      const session = sessionFromCookie(req);
      if (!session) return send(res, 200, null);
      const { token: _token, ...rest } = session;
      return send(res, 200, {
        session: { ...rest, token: session.token },
        user: publicUser(users.get(session.userId)!),
      });
    }

    if (req.method === 'GET' && path === '/token') {
      const session = sessionFromCookie(req);
      if (!session) return send(res, 401, { message: 'Unauthorized', code: 'UNAUTHORIZED' });
      const user = users.get(session.userId)!;
      const { role: _role, ...claims } = publicUser(user);
      const token = await new SignJWT({ ...claims, role: 'authenticated' })
        .setProtectedHeader({ alg: 'EdDSA', kid })
        .setSubject(user.id)
        .setIssuedAt()
        .setIssuer(origin)
        .setAudience(origin)
        .setExpirationTime('15m')
        .sign(privateKey);
      return send(res, 200, { token });
    }

    if (req.method === 'POST' && path === '/sign-out') {
      const session = sessionFromCookie(req);
      if (session) sessions.delete(session.token);
      return send(res, 200, { success: true });
    }

    if (req.method === 'POST' && path === '/organization/create') {
      const session = sessionFromCookie(req);
      if (!session) return send(res, 401, { message: 'Unauthorized', code: 'UNAUTHORIZED' });
      const body = await readJson(req);
      const organizationId = randomUUID();
      members.push({ organizationId, userId: session.userId, role: 'owner' });
      session.activeOrganizationId = organizationId;
      return send(res, 200, { id: organizationId, name: body.name, slug: body.slug, members });
    }

    if (req.method === 'GET' && path === '/organization/get-active-member-role') {
      const session = sessionFromCookie(req);
      if (!session) return send(res, 401, { message: 'Unauthorized', code: 'UNAUTHORIZED' });
      const organizationId = url.searchParams.get('organizationId') ?? session.activeOrganizationId;
      const member = members.find(m => m.organizationId === organizationId && m.userId === session.userId);
      if (!member) {
        return send(res, 403, {
          message: 'You are not a member of this organization',
          code: 'YOU_ARE_NOT_A_MEMBER_OF_THIS_ORGANIZATION',
        });
      }
      return send(res, 200, { role: member.role });
    }

    return send(res, 404, undefined);
  };

  const server = createServer((req, res) => {
    handle(req, res).catch(error => send(res, 500, { message: String(error) }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  origin = `http://127.0.0.1:${port}`;

  return {
    baseUrl: `${origin}${BASE_PATH}`,
    close: () => new Promise<void>(resolve => server.close(() => resolve())),
  };
}
