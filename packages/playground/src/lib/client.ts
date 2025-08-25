import { MastraClient } from '@mastra/client-js';

// Extend the window object to include our injected configuration
declare global {
  interface Window {
    MASTRA_TELEMETRY_DISABLED?: string;
    MASTRA_SERVER_URL?: string;
  }
}

// Get the server URL from the injected configuration, fallback to empty string for relative URLs
// Also check if the placeholder wasn't replaced (indicates an issue with the server-side replacement)
const getBaseUrl = () => {
  if (typeof window === 'undefined') return '';

  const serverUrl = window.MASTRA_SERVER_URL;

  // If the placeholder wasn't replaced, fall back to relative URLs
  if (!serverUrl || serverUrl.includes('%%MASTRA_SERVER_URL%%')) {
    return '';
  }

  return serverUrl;
};

export const client = new MastraClient({
  baseUrl: getBaseUrl(),
  headers: {
    'x-mastra-dev-playground': 'true',
  },
});
