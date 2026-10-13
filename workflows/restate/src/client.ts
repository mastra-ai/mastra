import * as restate from '@restatedev/restate-sdk';
import * as clients from '@restatedev/restate-sdk-clients';
import type { Ingress } from '@restatedev/restate-sdk-clients';

/**
 * Connect to a Restate server ingress endpoint. Pass the returned client to
 * `createRestateAgent` as the `restate` option.
 */
export function connect(url: string): Ingress {
  return clients.connect({ url });
}

/**
 * Serve Restate services from the current process. Call once at startup with
 * the service returned by `createRestateAgentService` (or any other Restate
 * services). The service handlers close over their Mastra agent, so the agent
 * must be registered on the same Mastra instance that serves.
 */
export function serve(options: { services: restate.Service<any>[]; port?: number }): ReturnType<typeof restate.serve> {
  return restate.serve({ services: options.services, port: options.port } as any);
}
