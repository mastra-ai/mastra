import { GoogleAuth } from 'google-auth-library';
import { GeminiLiveErrorCode } from '../types';
import type { AuthOptions } from '../types';
import { GeminiLiveError } from '../utils/errors';

export interface AuthConfig {
  apiKey?: string;
  vertexAI?: boolean;
  project?: string;
  debug: boolean;
  serviceAccountKeyFile?: string;
  serviceAccountEmail?: string;
  tokenExpirationTime?: number;
}

export class AuthManager {
  private authClient?: GoogleAuth;
  private accessToken?: string;
  private tokenExpirationTime?: number;
  private readonly config: AuthConfig;

  constructor(config: AuthConfig) {
    this.config = config;
    this.tokenExpirationTime = config.tokenExpirationTime ?? 50 * 60 * 1000;
  }

  /**
   * Initialize authentication based on configuration
   */
  async initialize(): Promise<void> {
    if (this.config.vertexAI) {
      await this.initializeVertexAI();
    } else if (this.config.apiKey) {
      // API key auth doesn't need initialization
      return;
    } else {
      throw new GeminiLiveError(
        GeminiLiveErrorCode.API_KEY_MISSING,
        'Either API key or Vertex AI configuration is required',
      );
    }
  }

  /**
   * Initialize Vertex AI authentication
   */
  private async initializeVertexAI(): Promise<void> {
    if (!this.config.project) {
      throw new GeminiLiveError(
        GeminiLiveErrorCode.PROJECT_ID_MISSING,
        'Google Cloud project ID is required when using Vertex AI',
      );
    }

    const authOptions: AuthOptions = {
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      projectId: this.config.project,
    };

    // Support service account key file
    if (this.config.serviceAccountKeyFile) {
      authOptions.keyFilename = this.config.serviceAccountKeyFile;
      this.log('Using service account key file for authentication:', this.config.serviceAccountKeyFile);
    }

    // Support impersonation via service account email
    if (this.config.serviceAccountEmail) {
      authOptions.clientOptions = { subject: this.config.serviceAccountEmail };
      this.log('Using service account impersonation:', this.config.serviceAccountEmail);
    }

    try {
      this.authClient = new GoogleAuth(authOptions);
    } catch (error) {
      throw new GeminiLiveError(
        GeminiLiveErrorCode.AUTHENTICATION_FAILED,
        `Failed to initialize Vertex AI authentication: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get access token for Vertex AI
   */
  async getAccessToken(): Promise<string> {
    if (!this.config.vertexAI) {
      throw new GeminiLiveError(GeminiLiveErrorCode.AUTHENTICATION_FAILED, 'Vertex AI authentication not configured');
    }

    if (!this.authClient) {
      throw new GeminiLiveError(GeminiLiveErrorCode.AUTHENTICATION_FAILED, 'Authentication client not initialized');
    }

    // Check if we have a valid cached token
    if (this.accessToken && this.tokenExpirationTime && Date.now() < this.tokenExpirationTime) {
      return this.accessToken;
    }

    try {
      const client = await this.authClient.getClient();
      const token = await client.getAccessToken();

      if (!token.token) {
        throw new Error('No access token received');
      }

      this.accessToken = token.token;

      // Set expiry time (tokens typically last 1 hour, so set to 50 minutes to be safe)
      this.tokenExpirationTime = Date.now() + 50 * 60 * 1000;

      this.log('Successfully obtained new access token');
      return this.accessToken;
    } catch (error) {
      throw new GeminiLiveError(
        GeminiLiveErrorCode.AUTHENTICATION_FAILED,
        `Failed to get access token: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get API key if using API key authentication
   */
  getApiKey(): string | undefined {
    if (this.config.vertexAI) {
      return undefined;
    }
    return this.config.apiKey;
  }

  /**
   * Check if using Vertex AI authentication
   */
  isUsingVertexAI(): boolean {
    return this.config.vertexAI === true;
  }

  /**
   * Check if authentication is configured
   */
  isConfigured(): boolean {
    return !!(this.config.apiKey || (this.config.vertexAI && this.config.project));
  }

  /**
   * Check if access token is valid
   */
  hasValidToken(): boolean {
    if (!this.config.vertexAI) return false;
    return !!(this.accessToken && this.tokenExpirationTime && Date.now() < this.tokenExpirationTime);
  }

  /**
   * Clear cached authentication data
   */
  clearCache(): void {
    this.accessToken = undefined;
    this.tokenExpirationTime = undefined;
  }

  /**
   * Get authentication configuration
   */
  getConfig(): AuthConfig {
    return { ...this.config };
  }

  /**
   * Log message if debug is enabled
   */
  private log(message: string, ...args: unknown[]): void {
    if (this.config.debug) {
      console.info(`[AuthManager] ${message}`, ...args);
    }
  }
}
