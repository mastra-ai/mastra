import type { Server } from 'node:http';
import { request } from 'node:http';
import { z } from 'zod';
import type { Profile, Target } from './contracts.js';
import { ControlPlaneError } from './contracts.js';

/** Transport-level identity result without credentials or raw response bytes. */
export type IdentityObservation = {
  /** Observed identity, response, or feed state, as selected by the enclosing contract. */
  status: 'READY' | 'AUTH_REQUIRED' | 'UNAVAILABLE';
  /** Sanitized machine-readable reason for the recorded state. */
  reason: string;
};
/** Trusted identity-check transport with explicit target/profile support. */
export interface IdentityTransport {
  /** Whether the transport supports this target/profile boundary. */
  supports(target: Target, profile: Profile): boolean;
  /** Check the expected identity with trusted runtime-resolved credentials. */
  check(profile: Profile, headers: Record<string, string>): Promise<IdentityObservation>;
}
export class DisabledIdentityTransport implements IdentityTransport {
  supports() {
    return false;
  }
  /** Verify the expected principal through confined identity transport without exporting credentials. */
  async check(): Promise<IdentityObservation> {
    return { status: 'UNAVAILABLE', reason: 'REMOTE_IDENTITY_DISABLED' };
  }
}
const identityResponse = z
  .object({
    identity: z
      .string()
      .min(1)
      .max(120)
      .regex(/^[a-zA-Z0-9:_-]+$/),
    role: z
      .string()
      .min(1)
      .max(120)
      .regex(/^[a-zA-Z0-9:_-]+$/),
  })
  .strict();

// A trusted caller supplies its own already-listening fixture, never a request-provided URL.
// This capability is limited to one literal IPv4 loopback socket and the fixed GET /identity route.
/** Create identity transport confined to the explicitly owned loopback target boundary. */
export function ownedLoopbackIdentityTransport(listener: Server): IdentityTransport {
  const address = listener.address();
  if (!address || typeof address === 'string' || address.address !== '127.0.0.1' || !listener.listening) {
    throw new ControlPlaneError('OWNED_LOOPBACK_REQUIRED', 503);
  }
  const endpoint = `http://127.0.0.1:${address.port}/identity`;
  return {
    /** Accept only supported bearer or header identity profiles on an owned lab target. */
    supports: (target, profile) =>
      target.environment === 'lab' &&
      (profile.kind === 'bearer' || profile.kind === 'header') &&
      profile.identityEndpoint === endpoint &&
      listener.listening,
    /** Verify the expected principal through confined identity transport without exporting credentials. */
    async check(profile, headers) {
      if (
        profile.kind === 'public' ||
        profile.kind === 'api_key_header' ||
        profile.identityEndpoint !== endpoint ||
        !listener.listening
      ) {
        return { status: 'UNAVAILABLE', reason: 'REMOTE_IDENTITY_DISABLED' };
      }
      return new Promise(resolve => {
        let completed = false;
        /** Resolve the identity observation once, ignoring subsequent completion attempts. */
        const finish = (result: IdentityObservation) => {
          if (!completed) {
            completed = true;
            resolve(result);
          }
        };
        const outgoing = request(
          { hostname: '127.0.0.1', port: address.port, path: '/identity', method: 'GET', headers, agent: false },
          incoming => {
            const status = incoming.statusCode ?? 0;
            if (status === 401 || status === 403 || (status >= 300 && status < 400)) {
              finish({ status: 'AUTH_REQUIRED', reason: 'SESSION_REJECTED' });
              incoming.destroy();
              return;
            }
            if (status !== 200 || !/^application\/json(?:;|$)/i.test(String(incoming.headers['content-type']))) {
              finish({ status: 'UNAVAILABLE', reason: 'IDENTITY_RESPONSE_INVALID' });
              incoming.destroy();
              return;
            }
            const chunks: Buffer[] = [];
            let size = 0;
            incoming.on('data', (chunk: Buffer) => {
              size += chunk.length;
              if (size > 4096) {
                // destroy() can emit aborted synchronously; settle the classified result first.
                finish({ status: 'UNAVAILABLE', reason: 'IDENTITY_RESPONSE_TOO_LARGE' });
                incoming.destroy();
              } else chunks.push(chunk);
            });
            incoming.once('end', () => {
              try {
                const parsed = identityResponse.safeParse(JSON.parse(Buffer.concat(chunks).toString('utf8')));
                finish(
                  !parsed.success
                    ? { status: 'UNAVAILABLE', reason: 'IDENTITY_RESPONSE_INVALID' }
                    : parsed.data.identity === profile.expectedIdentity && parsed.data.role === profile.role
                      ? { status: 'READY', reason: 'IDENTITY_MATCHED' }
                      : { status: 'AUTH_REQUIRED', reason: 'IDENTITY_MISMATCH' },
                );
              } catch {
                finish({ status: 'UNAVAILABLE', reason: 'IDENTITY_RESPONSE_INVALID' });
              }
            });
            incoming.once('error', () => finish({ status: 'UNAVAILABLE', reason: 'IDENTITY_TRANSPORT_FAILED' }));
            incoming.once('aborted', () => finish({ status: 'UNAVAILABLE', reason: 'IDENTITY_TRANSPORT_FAILED' }));
          },
        );
        const deadline = setTimeout(() => {
          finish({ status: 'UNAVAILABLE', reason: 'IDENTITY_TIMEOUT' });
          outgoing.destroy();
        }, 1000);
        outgoing.once('close', () => clearTimeout(deadline));
        outgoing.once('error', () => finish({ status: 'UNAVAILABLE', reason: 'IDENTITY_TRANSPORT_FAILED' }));
        outgoing.end();
      });
    },
  };
}
