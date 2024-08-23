import retry from 'async-retry-ng';
import { TokenInfo } from 'google-auth-library';
import { google, gmail_v1 } from 'googleapis';

import PostalMime from '../node_modules/postal-mime';

import { GMAIL_API_URL, Labels } from './constants';
import { GmailMessageNotFound } from './errors';
import {
  arrangeEmailsInOrderOfCreation,
  buildGetMessagesQuery,
  getValidRecipientAddresses,
  haveSameDomain,
  isEmailValidForSync,
  isSentEmail,
  nameForContact,
} from './helpers';
import {
  CalendarEvent,
  CalendarType,
  GoogleConnection,
  Email,
  EmailRequestBody,
  GetCalendarEventsProps,
  GooglePeopleData,
  ListCalendarEventsResponse,
  MessagesByThread,
  ThreadResponse,
  CreateEmailType,
  EmailAddress,
} from './types';

export class GoogleClient {
  private token: string;

  constructor({ token }: { token: string }) {
    this.token = token;
  }

  async getOAuth() {
    return new google.auth.OAuth2({
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

  async subscribeToGmail({ topic }: { topic: string }) {
    const gmail = await this.getGmailInstance();
    const response = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        labelIds: ['INBOX'],
        labelFilterBehavior: 'INCLUDE',
        topicName: topic,
      },
    });

    return response;
  }

  async getGmailInstance() {
    if (!this.token) throw new Error('Token not found');
    return google.gmail({ version: 'v1', auth: await this.getOAuth() } as any);
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

  async getGmailHistory({
    historyId,
    histories,
    pageToken,
  }: {
    historyId: string;
    histories: gmail_v1.Schema$History[];
    pageToken: string | undefined;
  }) {
    const gmail = await this.getGmailInstance();
    do {
      const historyResponse = await gmail.users.history.list({
        userId: 'me',
        startHistoryId: historyId,
        historyTypes: ['messageAdded', 'messageDeleted', 'labelAdded', 'labelRemoved'],
        pageToken,
      });

      if (historyResponse.data.history) {
        histories.push(...historyResponse.data.history);
      }

      pageToken = historyResponse.data.nextPageToken ?? undefined;
    } while (pageToken);

    return histories;
  }

  async getThreads({
    labels,
    from,
    to,
    limit = 100,
    pageToken,
  }: {
    pageToken: string;
    labels?: (keyof typeof Labels)[];
    from?: Date;
    to?: Date;
    limit?: number;
  }) {
    const query = await buildGetMessagesQuery({ labels, from, to });

    type GmailThread = { id: string; snippet: string; historyId: string };

    const searchParam = `?pageToken=${pageToken == 'skip' ? '' : pageToken}&maxResults=${limit}${
      query ? `&${query}` : ''
    }`;

    const response = await fetch(`${GMAIL_API_URL}/gmail/v1/users/me/threads${searchParam}`, {
      method: 'GET',
      headers: {
        ContentType: 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
    });

    const data = await response.json();

    const gmailThreads = data.threads as GmailThread[] | undefined;
    pageToken = data.nextPageToken || '';

    return { threads: gmailThreads, pageToken };
  }

  async getThreadById({
    threadId,
    batched = false,
  }: {
    threadId: string;
    batched?: boolean;
  }): Promise<MessagesByThread> {
    const gmail = await this.getGmailInstance();

    let thread: ThreadResponse;
    try {
      const response = await gmail.users.threads.get({ id: threadId, userId: 'me' });
      thread = response.data as ThreadResponse;
    } catch (error) {
      console.log({ namespace: 'getThreadById', error });
      throw new Error(`An error occurred while getting Gmail thread ${threadId}`);
    }

    if (!thread) {
      throw new Error(`An error occurred while getting Gmail thread ${threadId}`);
    }

    // group all messages in array
    const threadMessageIds = thread.messages.map(msg => msg.id);
    let threadBatchCursor = 0;
    const BATCH_SIZE = 40;
    const threadMessages = [];

    /**
     * Batch message fetching from Gmail API to reduce the speed to hitting the 'Queries per limit per user' quota
     * https://developers.google.com/gmail/api/guides/batch
     */
    while (threadBatchCursor <= threadMessageIds.length) {
      //pick the first 40 Ids and make requests to get their messages
      const batchedIds = threadMessageIds.slice(threadBatchCursor, BATCH_SIZE);
      const batchedMessages = await Promise.all(batchedIds.map(id => this.getGmailMessage({ messageId: id })));

      threadMessages.push(...(batchedMessages ?? []));
      threadBatchCursor += BATCH_SIZE;
    }

    let sortedMessages = threadMessages.sort(
      (a, b) => new Date(a.date as string).getTime() - new Date(b.date as string).getTime(),
    );

    const messages = arrangeEmailsInOrderOfCreation(sortedMessages);

    return {
      threadId,
      messages,
      firstMessageDate: new Date(messages[0]?.date || ''),
    };
  }

  /**
   * Retrieves all message info for messages in a Gmail history
   * @param gmailHistory
   * @param token - Integration bearer token
   * @returns
   */
  aggregateMessagesFromHistory = async ({ gmailHistory }: { gmailHistory: gmail_v1.Schema$History[] }) => {
    let messages: Email[] = [];

    for (const history of gmailHistory) {
      const deletedMessageIds = new Set(
        history.messagesDeleted ? history.messagesDeleted?.map(msg => msg?.message?.id ?? '') : [],
      );

      /**
       * Filter out deleted messages before reordering.
       * Also, arrange emails in order of creation to avoid failed reply lookups.
       * */
      const reOrderedMessages = arrangeEmailsInOrderOfCreation(
        (history.messages?.filter(msg => !deletedMessageIds.has(msg?.id!))?.map(message => message) ?? []) as Email[],
      );

      await Promise.all(
        reOrderedMessages.map(async message => {
          try {
            const email = await retry(async () => this.getGmailMessage({ messageId: message.id }), {
              retries: 5,
            });
            messages.push(email);
            return email;
          } catch (error) {
            if (error instanceof Error) {
              /**
               * If error message is 'Requested entity was not found', then the message has been deleted.
               * The deletion would've also been tracked in a previous history, so we'd skip instead of throwing an error
               */
              if (error.message !== 'Requested entity was not found.') {
                throw new GmailMessageNotFound(`Gmail message not found with messageId: ${message.id}`);
              }
            }
            throw error;
          }
        }),
      );
    }

    return messages;
  };

  /**
   * Calendar APIs
   */

  async getCalendarInstance() {
    if (!this.token) throw new Error('Token not found');

    return google.calendar({
      version: 'v3',
      auth: await this.getOAuth(),
    } as any);
  }

  async subscribeToGCAL({ webhookUrl, channelId }: { webhookUrl: string; channelId: string }) {
    const info = await this.getTokenInfo();

    const calendarId = info.email;

    console.log({ calendarId, webhookUrl });

    const calendar = await this.getCalendarInstance();

    const response = await calendar.events.watch({
      calendarId: calendarId,
      requestBody: {
        id: channelId,
        type: 'web_hook',
        address: webhookUrl,
      },
    });

    return response;
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

  /**
   * Contacts
   */

  async getPeopleInstance() {
    return google.people({
      version: 'v1',
      auth: await this.getOAuth(),
    } as any);
  }

  async findGoogleContactsHavingEmailAddress(): Promise<Record<string, GoogleConnection>> {
    const service = await this.getPeopleInstance();
    let nextPageToken = '';
    let connectionsMap: Record<string, GoogleConnection> = {};

    do {
      const result = await service.people.connections.list({
        resourceName: 'people/me',
        pageSize: 1000,
        sortOrder: 'LAST_MODIFIED_DESCENDING',
        personFields: 'names,emailAddresses',
        pageToken: nextPageToken,
      });

      if (result.statusText != 'OK') return connectionsMap;
      const data = result.data as GooglePeopleData;
      nextPageToken = data.nextPageToken ?? '';

      for (const cn of data?.connections ?? []) {
        if (cn.names && cn.emailAddresses) {
          for (const emailAddress of cn.emailAddresses) {
            connectionsMap[emailAddress.value] = cn;
          }
        }
      }
    } while (nextPageToken !== '');

    return connectionsMap;
  }

  /* 
  custom
  */

  async fetchEmails({
    emails,
    options,
    contacts,
  }: {
    emails: Email[];
    referenceId: string;
    options?: {
      connectedEmail: string;
      recordSearchCache: Set<string>;
    };
    contacts: Record<string, GoogleConnection>;
  }) {
    const emailsToSave: CreateEmailType[] = [];
    const personRecordsToCreate: Record<string, any>[] = [];

    for (const message of emails) {
      if (!message.to) {
        continue;
      }

      let recipients: EmailAddress[] = isSentEmail(message) ? message.to : [message.from];
      recipients = getValidRecipientAddresses({ addresses: recipients, connectedEmail: options?.connectedEmail });
      if (recipients?.length < 1) continue;

      if (!isEmailValidForSync({ email: message.from?.address || '', connectedEmail: options?.connectedEmail }))
        continue;

      for (const recipient of recipients) {
        if (!options) continue;

        if (!recipient.address || recipient.address == options.connectedEmail) {
          continue;
        }
        let isRecordExistingInCache = options.recordSearchCache.has(recipient.address);
        if (!isRecordExistingInCache) {
          if (!recipient.address) return null;

          const existingRecord = contacts[recipient.address];

          if (existingRecord) {
            options.recordSearchCache.add(recipient.address);
            continue;
          }

          const recordName = await nameForContact({
            nameFromService: recipient.name,
            emailAddress: recipient.address,
            contacts,
          });

          personRecordsToCreate.push({
            firstName: recordName.firstName ? recordName.firstName : '',
            lastName: recordName.lastName ? recordName.lastName : '',
            email: recipient.address,
          });
        }
      }

      const toAdresses = message.to.reduce((prev: string[], curr) => {
        if (curr.address) prev.push(curr.address);
        return prev;
      }, []);

      const ccAdresses = message.cc?.reduce((prev: string[], curr) => {
        if (curr.address) prev.push(curr.address);
        return prev;
      }, []);

      const bccAdresses = message.bcc?.reduce((prev: string[], curr) => {
        if (curr.address) prev.push(curr.address);
        return prev;
      }, []);

      const email: CreateEmailType = {
        messageId: message.messageId,
        emailId: message.id,
        threadId: message.threadId,
        subject: message.subject || '',
        labelIds: message.labelIds,
        snippet: message.snippet,
        from: message.from.address || '',
        to: toAdresses,
        cc: ccAdresses,
        bcc: bccAdresses,
        text: message.text,
        html: message.html,
        date: new Date(message.date || ''),
      };

      emailsToSave.push(email);
    }
    return { emailsToSave, personRecordsToCreate };
  }

  async fetchCalendarEvents({
    connectedEmail,
    duration,
    person,
  }: {
    person?: { email: string; recordId: string };
    duration?: { minDate: Date; maxDate: Date };
    connectedEmail?: string;
  }) {
    const isSinglePersonSync = person !== undefined;

    // getting events from all calendars for 1 year ago and 6 months in the future
    let currentDate = new Date();

    // Get the minDate (1 year ago)
    let minDate = new Date(currentDate);
    minDate.setFullYear(minDate.getFullYear() - 1);

    // Get the maxDate (6 months later)
    let maxDate = new Date(currentDate);
    maxDate.setMonth(maxDate.getMonth() + 6);

    // get calendar
    const calendar = await this.getCalendarById({
      calendarId: 'primary',
    });

    const calendarEvents = await this.getEventsForCalendar({
      startDate: duration ? duration.minDate : minDate,
      endDate: duration ? duration.maxDate : maxDate,
      calendarId: calendar.id,
      orderBy: 'startTime',
      singleEvents: true,
    });

    let peopleRecordsToCreate: Record<string, any>[] = [];
    let contacts: Record<string, GoogleConnection> = {};

    try {
      contacts = await this.findGoogleContactsHavingEmailAddress();
    } catch (error) {
      /* fail silently */
    }

    const eventResponseMap: Record<string, boolean> = {};

    // array of savable events
    let eventsToSave: CalendarEvent[] = [];

    for (const event of calendarEvents) {
      if (!event.attendees) continue;
      /**
     if the sync is for one record, check the attendees to make sure the event has that record as an attendee
     *
    */

      if (isSinglePersonSync) {
        let hasPersonEmail = false;

        for (const attendee of event.attendees) {
          if (attendee.email == person.email) hasPersonEmail = true;
        }

        if (!hasPersonEmail) continue;
      }

      for (const attendee of event.attendees) {
        if (connectedEmail && haveSameDomain(connectedEmail as string, attendee.email)) {
          continue;
        }
        const recordName = await nameForContact({
          nameFromService: attendee.displayName ?? '',
          emailAddress: attendee.email,
          contacts,
        });

        peopleRecordsToCreate.push({
          firstName: recordName.firstName ? recordName.firstName : '',
          lastName: recordName.lastName ? recordName.lastName : '',
          email: attendee.email,
        });
      }

      eventResponseMap[event.id] = true;
      eventsToSave.push(event);
    }

    return { eventsToSave, peopleRecordsToCreate };
  }
}
