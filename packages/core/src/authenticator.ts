import { OAuth2Client } from '@badgateway/oauth2-client';
import { DataIntegration } from '@prisma/client';
import { DataLayer } from './data-access';
import { oauthState } from './schemas';

import {
  IntegrationCredentialType,
  OAuthToken,
  APIKey,
  AuthToken,
} from './types';

type OAuthConfig = {
  SERVER: string;
  CLIENT_ID: string;
  CLIENT_SECRET: string;
  DISCOVERY_ENDPOINT?: string;
  REDIRECT_URI: string;
  SCOPES: string[];
  INTEGRATION_NAME: string;
  AUTH_TYPE: IntegrationCredentialType;
  AUTHORIZATION_ENDPOINT?: string;
  TOKEN_ENDPOINT?: string;
  REVOCATION_ENDPOINT?: string;
  AUTHENTICATION_METHOD?: string;
  EXTRA_AUTH_PARAMS?: {
    prompt?: string;
    access_type?: string;
  };
};

type APIKeyAuthConfig = {
  INTEGRATION_NAME: string;
  AUTH_TYPE: IntegrationCredentialType.API_KEY;
};

type AuthConfig = OAuthConfig | APIKeyAuthConfig;

export class IntegrationAuth {
  config: AuthConfig;
  client?: OAuth2Client;
  dataAccess: DataLayer;
  onDataIntegrationCreated?: (
    integration: DataIntegration,
    token: AuthToken
  ) => void;

  constructor({
    config,
    dataAccess,
    onDataIntegrationCreated,
  }: {
    config: AuthConfig;
    dataAccess: DataLayer;
    onDataIntegrationCreated: (integration: DataIntegration) => void;
  }) {
    this.config = config;
    this.onDataIntegrationCreated = onDataIntegrationCreated;
    this.dataAccess = dataAccess;
  }

  getClient(): OAuth2Client {
    if (this.config.AUTH_TYPE === IntegrationCredentialType.API_KEY) {
      throw new Error(
        'Plugins using API Key authentication do not support OAuth2Client'
      );
    }

    const {
      SERVER,
      CLIENT_ID,
      CLIENT_SECRET,
      DISCOVERY_ENDPOINT,
      AUTHORIZATION_ENDPOINT,
      REVOCATION_ENDPOINT,
      TOKEN_ENDPOINT,
      AUTHENTICATION_METHOD,
    } = this.config as OAuthConfig;

    if (!this.client) {
      this.client = new OAuth2Client({
        server: SERVER,
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        discoveryEndpoint: DISCOVERY_ENDPOINT,
        authorizationEndpoint: AUTHORIZATION_ENDPOINT,
        tokenEndpoint: TOKEN_ENDPOINT,
        revocationEndpoint: REVOCATION_ENDPOINT,
        authenticationMethod: AUTHENTICATION_METHOD,
      });
    }

    return this.client;
  }

  getScopes() {
    if (this.config.AUTH_TYPE === IntegrationCredentialType.API_KEY) {
      return [];
    }

    return this.config.SCOPES;
  }

  async getRedirectUri(clientRedirectPath?: string) {
    if (this.config.AUTH_TYPE === IntegrationCredentialType.API_KEY) {
      throw new Error(
        'Plugins using API Key authentication do not use redirect URIs'
      );
    }

    const client = this.getClient();
    const redirectUri = this.config.REDIRECT_URI;
    const scopes = this.config.SCOPES;
    const name = this.config.INTEGRATION_NAME;

    return await client.authorizationCode.getAuthorizeUri({
      redirectUri,
      scope: scopes,
      state: Buffer.from(JSON.stringify({ name, clientRedirectPath })).toString(
        'base64'
      ),
      extraParams: this.config.EXTRA_AUTH_PARAMS ?? {},
    });
  }

  async getTokenFromCodeRedirect(url: string) {
    if (this.config.AUTH_TYPE === IntegrationCredentialType.API_KEY) {
      throw new Error(
        'Plugins using API Key authentication do not use authorization codes'
      );
    }

    const client = this.getClient();
    return await client.authorizationCode.getTokenFromCodeRedirect(url, {
      redirectUri: this.config.REDIRECT_URI,
    });
  }

  async getStateFromRedirect(url: string) {
    const state = new URL(url).searchParams.get('state');

    if (!state) {
      throw new Error('No state found in redirect');
    }

    return oauthState.parse(
      JSON.parse(Buffer.from(state, 'base64').toString())
    );
  }

  async processCallback(url: string) {
    const tokenFromRedirect = await this.getTokenFromCodeRedirect(url);
    const state = await this.getStateFromRedirect(url);

    const integration = await this.dataAccess.createDataIntegration({
      dataIntegration: {
        connectionId: state.connectionId,
        name: this.config.INTEGRATION_NAME,
      },
      credential: {
        type: this.config.AUTH_TYPE,
        value: tokenFromRedirect,
        scope: this.getScopes(),
      },
    });

    const token = await this.getAuthToken({ integrationId: integration.id });

    if (this.onDataIntegrationCreated) {
      await Promise.resolve(this.onDataIntegrationCreated(integration, token));
    }
  }

  async getAuthToken({
    integrationId,
  }: {
    integrationId: string;
  }): Promise<AuthToken> {
    const credential = await this.dataAccess.getDataIntegrationCredentialsById(
      integrationId
    );

    if (credential.type === IntegrationCredentialType.API_KEY) {
      return credential.value as APIKey;
    }

    const token = credential.value as OAuthToken;

    const { accessToken, expiresAt, refreshToken, ...rest } = token;

    const minTokenLifetime = 60 * 5 * 1000; // 5 minutes
    const now = Date.now();

    // If the token has no expiration date, it can be assumed it never expires
    if (!expiresAt) {
      return {
        accessToken,
        expiresAt,
        ...rest,
      };
    }

    // If the token is not expired and won't expire soon, use it.
    if (expiresAt - now > minTokenLifetime) {
      return {
        accessToken,
        expiresAt,
        ...rest,
      };
    }

    // If the token is expired or will expire soon, refresh it.
    const refreshedToken = await this._refreshAuth({ token, integrationId });
    return {
      accessToken: refreshedToken.accessToken,
      expiresAt: refreshedToken.expiresAt,
      ...rest,
    };
  }

  private async _refreshAuth({
    token,
    integrationId,
  }: {
    token: OAuthToken;
    integrationId: string;
  }): Promise<OAuthToken> {
    const oauthClient = this.getClient();
    const newToken = await oauthClient.refreshToken(token);

    const existingRefreshToken = token.refreshToken;
    const { accessToken, expiresAt } = newToken;
    await this.dataAccess.updateDataIntegrationCredential({
      integrationId,
      token: {
        accessToken,
        refreshToken: existingRefreshToken,
        expiresAt,
      },
    });
    return newToken;
  }

  async revokeAuth({ integrationId }: { integrationId: string }) {
    const oauthClient = this.getClient();

    const credential = await this.dataAccess.getDataIntegrationCredentialsById(
      integrationId
    );
    const token = credential.value as OAuthToken;

    if (await oauthClient.getEndpoint('revocationEndpoint')) {
      try {
        await oauthClient.revoke(token, 'refresh_token');
      } catch (err) {
        console.log('Error revoking token', err);
      }
    }
  }
}
