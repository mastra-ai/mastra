import { Integration, IntegrationCredentialType, IntegrationAuth } from '@kpl/core';

// @ts-ignore
import Google_CalendarLogo from './assets/google_calendar.png';
import { comments } from './client/service-comments';
import * as integrationClient from './client/services.gen';
import * as zodSchema from './client/zodSchema';

type Google_CalendarConfig = {
  CLIENT_ID: string;
  CLIENT_SECRET: string;

  [key: string]: any;
};

export class Google_CalendarIntegration extends Integration {
  categories = ['calendar', 'scheduling', 'ai&automation'];
  description = 'Google Calendar is a time-management and scheduling calendar service developed by Google.';
  availableScopes = [
    {
      key: `https://www.googleapis.com/auth/calendar`,
      description: `See, edit, share, and permanently delete all the calendars you can access using Google Calendar`,
    },
    {
      key: `https://www.googleapis.com/auth/calendar.events`,
      description: `View and edit events on all your calendars`,
    },
    {
      key: `https://www.googleapis.com/auth/calendar.events.readonly`,
      description: `View events on all your calendars`,
    },
    {
      key: `https://www.googleapis.com/auth/calendar.readonly`,
      description: `See and download any calendar you can access using your Google Calendar`,
    },
    {
      key: `https://www.googleapis.com/auth/calendar.settings.readonly`,
      description: `View your Calendar settings`,
    },
  ];

  constructor({ config }: { config: Google_CalendarConfig }) {
    super({
      ...config,
      authType: IntegrationCredentialType.OAUTH,
      name: 'GOOGLE_CALENDAR',
      logoUrl: Google_CalendarLogo,
    });
  }

  getClientZodSchema() {
    return zodSchema;
  }

  getCommentsForClientApis() {
    return comments;
  }

  getBaseClient() {
    integrationClient.client.setConfig({
      baseUrl: 'https://www.googleapis.com/calendar/v3',
    });
    return integrationClient;
  }

  getApiClient = async ({ connectionId }: { connectionId: string }) => {
    const connection = await this.dataLayer?.getConnection({ name: this.name, connectionId });

    if (!connection) {
      throw new Error(`Connection not found for connectionId: ${connectionId}`);
    }

    const authenticator = this.getAuthenticator();
    const { accessToken } = await authenticator.getAuthToken({ k_id: connection.id });

    const baseClient = this.getBaseClient();

    baseClient.client.interceptors.request.use((request, options) => {
      request.headers.set('Authorization', `Bearer ${accessToken}`);
      return request;
    });

    return integrationClient;
  };

  registerEvents() {
    this.events = {};
    return this.events;
  }

  getAuthenticator() {
    return new IntegrationAuth({
      dataAccess: this.dataLayer!,
      // @ts-ignore
      onConnectionCreated: () => {
        // TODO
      },
      config: {
        INTEGRATION_NAME: this.name,
        AUTH_TYPE: this.config.authType,
        CLIENT_ID: this.config.CLIENT_ID,
        CLIENT_SECRET: this.config.CLIENT_SECRET,
        REDIRECT_URI: this.config.REDIRECT_URI || this.corePresets.redirectURI,
        SERVER: `https://www.googleapis.com/calendar/v3`,
        AUTHORIZATION_ENDPOINT: `https://accounts.google.com/o/oauth2/v2/auth`,
        TOKEN_ENDPOINT: `https://oauth2.googleapis.com/token`,
        SCOPES: this.config.SCOPES || [],
      },
    });
  }
}
