/** Preview-only replacement for the external auth SDK. Never bundled by src/vite.config.ts. */
export class AuthError extends Error {
  type = 'unknown';
}

export default class DemoPlatformAuth {
  constructor(private readonly config: { connectSessionToken: string }) {}

  async auth(integrationId: string) {
    // Credentials supplied by the real form are intentionally neither read nor sent.
    const response = await fetch('/preview/platform/authorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ integrationId, sessionToken: this.config.connectSessionToken }),
    });
    if (!response.ok) throw new AuthError('The demo connection failed. Please retry.');
  }
}
