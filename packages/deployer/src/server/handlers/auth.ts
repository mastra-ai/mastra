import type { Context, Next } from 'hono';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

const PROVIDER_CONFIG: Record<string, { type: string; secret?: string; jwksUri?: string }> = {
  'https://mucfwbutfcoirsqanbuo.supabase.co/auth/v1': {
    type: 'hmac',
    secret: process.env.SUPABASE_JWT_SECRET,
  },
  'https://securetoken.google.com/<your-firebase-project>': {
    type: 'jwks',
    jwksUri: 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
  },
  'https://your-auth0-domain.auth0.com/': {
    type: 'jwks',
    jwksUri: 'https://your-auth0-domain.auth0.com/.well-known/jwks.json',
  },
};

export const authenticateMiddleware = async (c: Context, next: Next) => {
  const token = c.req.header('Authorization');

  if (!process.env.MASTRA_JWT_SECRET) {
    return next();
  }

  if (!token) {
    return next();
  }

  const decoded = await jwt.verify(token.replace('Bearer ', ''), process.env.MASTRA_JWT_SECRET);
  c.get('runtimeContext').set('user', decoded);

  await next();
};

export const exchangeTokenHandler = async (c: Context) => {
  try {
    const { token } = await c.req.json();

    const decoded = await verifyToken(token);

    const payload = {
      iss: c.req.url,
      sub: decoded.sub,
      email: decoded.email,
      // name: decoded.name,
      // picture: decoded.picture,
      // provider: decoded.provider,
    };

    if (!process.env.MASTRA_JWT_SECRET) throw new Error('Missing MASTRA_JWT_SECRET');

    const apiKey = jwt.sign(payload, process.env.MASTRA_JWT_SECRET);

    return c.json({ apiKey });
  } catch (error) {
    console.error(error);
    return c.json({ error: 'Invalid token' }, 401);
  }
};

async function verifyToken(accessToken: string) {
  const decoded = jwt.decode(accessToken, { complete: true });

  if (!decoded) throw new Error('Invalid token');
  if (!decoded.payload || typeof decoded.payload !== 'object') throw new Error('Invalid token payload');
  if (!decoded.payload.iss) throw new Error('Invalid token header');

  const iss = decoded.payload.iss;

  const provider = PROVIDER_CONFIG[iss];
  if (!provider) throw new Error(`Unsupported provider: ${iss}`);

  if (provider.type === 'hmac') {
    if (!provider.secret) throw new Error(`Missing secret for hmac provider: ${iss}`);
    return jwt.verify(accessToken, provider.secret) as jwt.JwtPayload;
  }

  if (provider.type === 'jwks') {
    if (!provider.jwksUri) throw new Error(`Missing jwksUri for jwks provider: ${iss}`);
    const client = jwksClient({ jwksUri: provider.jwksUri });
    const key = await client.getSigningKey(decoded.header.kid);
    const signingKey = key.getPublicKey();
    return jwt.verify(accessToken, signingKey) as jwt.JwtPayload;
  }

  throw new Error(`Unknown provider type for ${iss}`);
}
