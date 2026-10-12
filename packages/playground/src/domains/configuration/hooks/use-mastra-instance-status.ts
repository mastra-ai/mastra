import { useQuery } from '@tanstack/react-query';

export type UseMastraInstanceStatusResponse = {
  status: 'active' | 'inactive';
};

const normalizeApiPrefix = (apiPrefix: string): string => {
  const normalized = apiPrefix.trim().replace(/\/+/g, '/').replace(/\/$/, '');
  if (!normalized) return '';
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
};

// Probe a public route under the API prefix rather than the server root: when Mastra is
// mounted in a host app via a server adapter, the root belongs to the host app.
const getInstanceStatusUrl = (endpoint: string, apiPrefix: string): string =>
  `${endpoint.replace(/\/+$/, '')}${normalizeApiPrefix(apiPrefix)}/auth/capabilities`;

const getMastraInstanceStatus = async (
  endpoint: string,
  apiPrefix: string,
  headers?: Record<string, string>,
): Promise<UseMastraInstanceStatusResponse> => {
  try {
    const response = await fetch(getInstanceStatusUrl(endpoint, apiPrefix), { headers });

    return { status: response.ok ? 'active' : 'inactive' };
  } catch {
    return { status: 'inactive' };
  }
};

export const useMastraInstanceStatus = (
  endpoint: string = 'http://localhost:4111',
  apiPrefix: string = '/api',
  headers?: Record<string, string>,
) => {
  return useQuery({
    queryKey: ['mastra-instance-status', endpoint, apiPrefix, headers],
    queryFn: () => getMastraInstanceStatus(endpoint, apiPrefix, headers),
    retry: false,
  });
};
