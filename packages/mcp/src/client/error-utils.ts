export function isReconnectableMCPError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const errorMessage = error.message.toLowerCase();

  return (
    errorMessage.includes('no valid session') ||
    errorMessage.includes('session') ||
    errorMessage.includes('server not initialized') ||
    errorMessage.includes('not connected') ||
    errorMessage.includes('http 400') ||
    errorMessage.includes('http 401') ||
    errorMessage.includes('http 403') ||
    errorMessage.includes('http 404') ||
    errorMessage.includes('econnrefused') ||
    errorMessage.includes('fetch failed') ||
    errorMessage.includes('connection refused') ||
    errorMessage.includes('connection closed') ||
    errorMessage.includes('sse stream disconnected') ||
    errorMessage.includes('typeerror: terminated')
  );
}
