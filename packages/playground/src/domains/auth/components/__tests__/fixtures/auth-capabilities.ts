import type { RouteResponse } from '@mastra/client-js';

type AuthCapabilitiesResponse = RouteResponse<'GET /auth/capabilities'>;

export const jwtAuthCapabilities = {
  enabled: true,
  login: null,
} satisfies AuthCapabilitiesResponse;

export const credentialsAuthCapabilities = {
  enabled: true,
  login: { type: 'credentials' as const },
} satisfies AuthCapabilitiesResponse;
