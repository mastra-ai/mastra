import { calendar } from '@googleapis/calendar';
import { gmail } from '@googleapis/gmail';
import { auth } from '@googleapis/oauth2';
import { TokenInfo } from 'google-auth-library';

export class GoogleClient {
  private token: string;

  constructor({ token }: { token: string }) {
    this.token = token;
  }

  async getOAuth() {
    return new auth.OAuth2({
      credentials: {
        access_token: this.token,
      },
    });
  }

  async getTokenInfo(): Promise<TokenInfo> {
    const oauth = await this.getOAuth();
    const tokenInfo = oauth.getTokenInfo(this.token);
    return tokenInfo;
  }

  async getGmailInstance() {
    if (!this.token) throw new Error('Token not found');

    return gmail({
      version: `v1`,
    }).context({ auth: await this.getOAuth() });
  }

  async getCalendarInstance() {
    if (!this.token) throw new Error('Token not found');

    return calendar({
      version: 'v3',
    }).context({ auth: await this.getOAuth() });
  }
}
