/** Authentication material accepted by integration capabilities. */
export type IntegrationConnection =
  | { type: 'app-installation'; installationId: number }
  | { type: 'oauth'; accessToken: string };
