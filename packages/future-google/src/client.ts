import { calendar } from '@googleapis/calendar';
import { gmail } from '@googleapis/gmail';
import { auth } from '@googleapis/oauth2';
import { TokenInfo } from 'google-auth-library';
import PostalMime from 'postal-mime';

import { GMAIL_API_URL } from './constants';
import {
  CalendarEvent,
  CalendarType,
  Email,
  EmailRequestBody,
  GetCalendarEventsProps,
  ListCalendarEventsResponse,
} from './types';

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

  /**
   * Gmail APIs
   */

  async getGmailInstance() {
    if (!this.token) throw new Error('Token not found');

    return gmail({
      version: `v1`,
    }).context({ auth: await this.getOAuth() });
  }

  async getGmailSignature() {
    const gmail = await this.getGmailInstance();

    try {
      const response = await gmail.users.settings.sendAs.list({
        userId: 'me',
      });

      const data = response.data.sendAs?.[0].signature ?? ('' as string);
      return data;
    } catch (error) {
      console.log({ namespace: 'getUserGmailSignature', error });
      throw new Error(`An error occurred while getting Gmail signature`);
    }
  }

  async getGmailMessage({ messageId, batched = false }: { messageId: string; batched?: boolean }) {
    const gmail = await this.getGmailInstance();

    try {
      const response = await gmail.users.messages.get({ id: messageId, userId: 'me', format: 'RAW' });

      const message = response.data;
      const { id, threadId, raw, labelIds, snippet } = message;

      if (!raw) {
        throw new Error(`Gmail message has not 'raw' value: ${messageId}`);
      }

      const emailMime = Buffer.from(raw, 'base64').toString('utf-8');
      return { ...(await PostalMime.parse(emailMime)), labelIds, id, threadId, snippet } as Email;
    } catch (error) {
      console.log({ namespace: 'getGmailMessage', error });
      throw error;
    }
  }

  async sendGmailMessage({ requestBody }: { requestBody: EmailRequestBody }) {
    const response = await fetch(`${GMAIL_API_URL}/gmail/v1/users/me/messages/send`, {
      method: 'post',
      headers: {
        ContentType: 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify(requestBody),
    });

    return response;
  }

  /**
   * Calendar APIs
   */

  async getCalendarInstance() {
    if (!this.token) throw new Error('Token not found');

    return calendar({
      version: 'v3',
    }).context({ auth: await this.getOAuth() });
  }

  async getCalendarById({ calendarId }: { calendarId: string }) {
    const calendar = await this.getCalendarInstance();

    const res = await calendar.calendars.get({
      calendarId: calendarId,
    });

    try {
      return res.data as CalendarType;
    } catch (error) {
      throw new Error(`An error occured while getting calendar`);
    }
  }

  async stopCalendarChannel() {
    // try stopping any open channel and fail silently if channel does not exist
    try {
      const info = await this.getTokenInfo();

      const calendarId = info.email;

      if (!calendarId) {
        console.log(`error occurred stoping channel for ${calendarId}`);
        return;
      }

      const calendar = await this.getCalendarInstance();

      await calendar.channels.stop({
        requestBody: {
          id: calendarId,
        },
      });
    } catch (error) {
      console.error(`error occurred stoping channel`, error);
    }
  }

  async getEventsForCalendar(calendarEventOptions: GetCalendarEventsProps) {
    const calendar = await this.getCalendarInstance();
    const { startDate, endDate, calendarId, orderBy, singleEvents } = calendarEventOptions;
    let eventsList: CalendarEvent[] = [];
    let nextPageToken: string = '';

    do {
      const res = await calendar.events.list({
        calendarId: calendarId,
        timeMin: startDate ? startDate?.toISOString() : undefined,
        timeMax: endDate ? endDate?.toISOString() : undefined,
        maxResults: 2500,
        singleEvents: singleEvents,
        orderBy: orderBy,
        pageToken: nextPageToken || '',
      });

      const eventResponse = res.data as ListCalendarEventsResponse;
      eventsList.push(
        ...(eventResponse?.items ?? []).map(event => {
          event.calendarId = calendarId;
          return event;
        }),
      );
      nextPageToken = eventResponse.nextPageToken ?? '';
    } while (nextPageToken);

    return eventsList;
  }
}
