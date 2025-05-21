import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

export type JwtPayload = jwt.JwtPayload;

export async function decodeToken(accessToken: string) {
  const decoded = jwt.decode(accessToken, { complete: true });
  return decoded;
}

export function getTokenIssuer(decoded: jwt.JwtPayload | null) {
  if (!decoded) throw new Error('Invalid token');
  if (!decoded.payload || typeof decoded.payload !== 'object') throw new Error('Invalid token payload');
  if (!decoded.payload.iss) throw new Error('Invalid token header');
  return decoded.payload.iss;
}

export async function verifyHmac(accessToken: string, secret: string) {
  const decoded = jwt.decode(accessToken, { complete: true });

  if (!decoded) throw new Error('Invalid token');

  return jwt.verify(accessToken, secret) as jwt.JwtPayload;
}

export async function verifyJwks(accessToken: string, jwksUri: string) {
  const decoded = jwt.decode(accessToken, { complete: true });

  if (!decoded) throw new Error('Invalid token');

  const client = jwksClient({ jwksUri });
  const key = await client.getSigningKey(decoded.header.kid);
  const signingKey = key.getPublicKey();
  return jwt.verify(accessToken, signingKey) as jwt.JwtPayload;
}
