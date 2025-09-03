import { describe, expect, it } from 'vitest';
import { parseCloudAccessToken } from './parseCloudAccessToken';

function createTestJWT(payload: { teamId: string; projectId: string }): string {
  const header = { typ: 'JWT', alg: 'HS256' };
  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = 'fake-signature'; // We don't verify, so this can be anything

  return `${headerB64}.${payloadB64}.${signature}`;
}

describe('parseCloudAccessToken', () => {
  it('should correctly parse teamId and projectId from JWT', () => {
    const testPayload = { teamId: 'test-team', projectId: 'test-project' };
    const jwt = createTestJWT(testPayload);

    const result = parseCloudAccessToken(jwt);

    expect(result.teamId).toBe('test-team');
    expect(result.projectId).toBe('test-project');
  });

  it('should throw error for invalid JWT format', () => {
    expect(() => {
      parseCloudAccessToken('invalid.jwt');
    }).toThrow('Invalid JWT format');
  });

  it('should throw error for JWT missing teamId', () => {
    const invalidPayload = { projectId: 'test-project' }; // missing teamId
    const header = { typ: 'JWT', alg: 'HS256' };
    const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
    const payloadB64 = Buffer.from(JSON.stringify(invalidPayload)).toString('base64url');
    const invalidJWT = `${headerB64}.${payloadB64}.signature`;

    expect(() => {
      parseCloudAccessToken(invalidJWT);
    }).toThrow('JWT missing teamId or projectId');
  });

  it('should throw error for JWT missing projectId', () => {
    const invalidPayload = { teamId: 'test-team' }; // missing projectId
    const header = { typ: 'JWT', alg: 'HS256' };
    const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
    const payloadB64 = Buffer.from(JSON.stringify(invalidPayload)).toString('base64url');
    const invalidJWT = `${headerB64}.${payloadB64}.signature`;

    expect(() => {
      parseCloudAccessToken(invalidJWT);
    }).toThrow('JWT missing teamId or projectId');
  });

  it('should throw error for malformed JWT payload', () => {
    const malformedPayload = 'not-valid-json';
    const header = { typ: 'JWT', alg: 'HS256' };
    const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
    const payloadB64 = Buffer.from(malformedPayload).toString('base64url');
    const malformedJWT = `${headerB64}.${payloadB64}.signature`;

    expect(() => {
      parseCloudAccessToken(malformedJWT);
    }).toThrow();
  });
});
