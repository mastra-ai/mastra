/**
 * Dual Auth Example
 *
 * Demonstrates separate authentication for Studio (internal team) and API (external consumers):
 * - Studio: WorkOS SSO (Google OAuth, SAML, etc.) for your team members
 * - API: JWT tokens for programmatic API access
 *
 * This pattern is common in SaaS products where:
 * - Internal dashboard uses SSO for team members
 * - Public API uses API keys or JWT for customers
 */

import { Mastra } from '@mastra/core/mastra';
import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { MastraAuthWorkos } from '@mastra/auth-workos';
import { LibSQLStore } from '@mastra/libsql';
import { z } from 'zod';

// =============================================================================
// Simple Tool
// =============================================================================

const greetTool = createTool({
  id: 'greet',
  description: 'Greet a user by name',
  inputSchema: z.object({
    name: z.string().describe('Name of the person to greet'),
  }),
  outputSchema: z.object({
    greeting: z.string(),
  }),
  execute: async (input) => {
    return { greeting: `Hello, ${input.name}! Welcome to the dual auth example.` };
  },
});

// =============================================================================
// Simple Agent
// =============================================================================

const assistantAgent = new Agent({
  id: 'assistant',
  name: 'Assistant',
  instructions: 'You are a helpful assistant. Use the greet tool when asked to greet someone.',
  model: '__GATEWAY_OPENAI_MODEL_MINI__',
  tools: { greet: greetTool },
});

// =============================================================================
// Auth Providers
// =============================================================================

// Studio Auth: WorkOS SSO for internal team members
const studioAuth = new MastraAuthWorkos({
  clientId: process.env.WORKOS_CLIENT_ID!,
  apiKey: process.env.WORKOS_API_KEY!,
  redirectUri: process.env.WORKOS_REDIRECT_URI!,
  // Optional: use specific OAuth provider instead of AuthKit
  sso: process.env.WORKOS_SSO_PROVIDER
    ? { provider: process.env.WORKOS_SSO_PROVIDER as 'GoogleOAuth' }
    : undefined,
});

// Server Auth: JWT verification for API consumers using HMAC-SHA256
const serverAuth = {
  authenticateToken: async (token: string) => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET not configured');
    }

    try {
      // Basic JWT structure: header.payload.signature
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

      const [headerB64, payloadB64, signatureB64] = parts;

      // Verify HMAC-SHA256 signature
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
      );

      const signatureInput = `${headerB64}.${payloadB64}`;
      const expectedSignature = await crypto.subtle.sign('HMAC', key, encoder.encode(signatureInput));
      const expectedSignatureB64 = Buffer.from(expectedSignature).toString('base64url');

      // Constant-time comparison to prevent timing attacks
      if (signatureB64.length !== expectedSignatureB64.length) {
        return null;
      }
      let mismatch = 0;
      for (let i = 0; i < signatureB64.length; i++) {
        mismatch |= signatureB64.charCodeAt(i) ^ expectedSignatureB64.charCodeAt(i);
      }
      if (mismatch !== 0) {
        return null;
      }

      // Decode and validate payload
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());

      // Check expiration
      if (payload.exp && payload.exp < Date.now() / 1000) {
        return null;
      }

      return {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
      };
    } catch {
      return null;
    }
  },
};

// =============================================================================
// Mastra Instance
// =============================================================================

export const mastra = new Mastra({
  agents: { assistant: assistantAgent },
  storage: new LibSQLStore({ id: 'dual-auth-example', url: 'file:.mastra/data.db' }),
  server: {
    // API authentication: JWT tokens for programmatic access
    auth: serverAuth,
  },
  studio: {
    // Studio authentication: WorkOS SSO for team members
    auth: studioAuth,
  },
});
