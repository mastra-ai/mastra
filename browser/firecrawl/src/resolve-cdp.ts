/**
 * Resolve an HTTP CDP endpoint to a WebSocket URL (same behavior as MastraBrowser.resolveWebSocketUrl).
 */
export async function resolveCdpWebSocketUrl(
  url: string,
  logger?: { debug?: (message: string) => void; warn?: (message: string) => void },
): Promise<string> {
  if (url.startsWith('ws://') || url.startsWith('wss://')) {
    return url;
  }

  if (url.startsWith('http://') || url.startsWith('https://')) {
    const baseUrl = url.replace(/\/$/, '');
    const versionUrl = `${baseUrl}/json/version`;

    logger?.debug?.(`Resolving WebSocket URL from ${versionUrl}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(versionUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(
          `Failed to fetch CDP version info from ${versionUrl}: ${response.status} ${response.statusText}`,
        );
      }

      const data = (await response.json()) as { webSocketDebuggerUrl?: string };
      if (!data.webSocketDebuggerUrl) {
        throw new Error(`No webSocketDebuggerUrl found in CDP version response from ${versionUrl}`);
      }

      logger?.debug?.(`Resolved WebSocket URL: ${data.webSocketDebuggerUrl}`);
      return data.webSocketDebuggerUrl;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Timeout resolving WebSocket URL from ${versionUrl} (10s)`);
      }
      throw error;
    }
  }

  return url;
}
