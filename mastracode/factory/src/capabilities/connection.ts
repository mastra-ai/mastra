/** Authentication material accepted by integration capabilities. */
export type IntegrationConnection =
  | {
      type: 'app-installation';
      installationId: number;
      /** The Factory org the installation serves, when the integration that built the connection knows it. */
      orgId?: string;
    }
  | { type: 'oauth'; accessToken: string };
