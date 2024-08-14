import { DataLayer, IntegrationAction, extractSchemaOptions } from 'core';
import { z } from 'zod';

// TODO: ADD ACTION ICON
// import gmailIcon from '../assets/gmail.svg';
import { createRawMessage, getSnippet, threadHasMessage } from '../helpers';
import { SEND_EMAIL_SCHEMA } from '../schemas';
import { CreateEmailsParams, EmailRequestBody, MakeClient } from '../types';

const gmailIcon = '';

export const SEND_EMAIL = ({
  name,
  makeClient,
  createEmails,
  dataAccess,
}: {
  name: string;
  dataAccess: DataLayer;
  makeClient: MakeClient;
  createEmails: (params: CreateEmailsParams) => Promise<void>;
}): IntegrationAction<
  z.input<typeof SEND_EMAIL_SCHEMA>,
  {
    status: boolean;
    message: string;
    messageId?: string;
    joinedEmail?: string[];
  }
> => ({
  pluginName: name,
  label: 'Send Email',
  icon: {
    alt: 'Gmail',
    icon: gmailIcon,
  },
  description: 'Send an email',
  schema: SEND_EMAIL_SCHEMA,
  type: 'SEND_EMAIL',
  async getSchemaOptions({ ctx }) {
    const emailSet = new Set();
    // shouldn't have to call this again if we already have the data
    const people = await dataAccess.getRecordsByFieldName({ fieldName: 'email', connectionId: ctx.connectionId });
    /**
     * get list of pipelines
     * get list of stages
     *
     * update get schema options response - [], {default: []}, {pipeline1: [], pipeline2: []}
     */

    people.forEach(person => {
      if ((person.data as any)?.email) {
        emailSet.add((person.data as any)?.email);
      }
    });

    const emailList = Array.from(emailSet)?.map(el => ({ label: el as string, value: el as string }));
    const schemaOptions = extractSchemaOptions({
      schema: SEND_EMAIL_SCHEMA,
      dataCtx: { to: { options: emailList }, cc: { options: emailList }, bcc: { options: emailList } },
    });

    return schemaOptions;
  },
  executor: async ({ data, ctx: { connectionId } }) => {
    const client = await makeClient({ connectionId });

    const email = data;

    const { body, subject, to, bcc, cc, emailId } = email;

    const joinedEmail = email?.to?.join(',');

    let threadId: string | undefined = undefined;
    let rawMessage = '';

    if (emailId) {
      const messageObj = await client.getGmailMessage({ messageId: emailId });
      let references = `${messageObj.references || ''} ${messageObj.messageId}`;
      // const replySubject = `Re: ${messageObj.subject}`;
      rawMessage = createRawMessage(to, cc, bcc, subject || '', body, 'html', messageObj.messageId, references);
    } else {
      rawMessage = createRawMessage(to, cc, bcc, subject || '', body, 'html');
    }

    const snippet = getSnippet(body, 100);

    const requestBody: EmailRequestBody = {
      raw: rawMessage,
      snippet: snippet,
    };

    if (threadId) requestBody.threadId = threadId;
    if (emailId) requestBody.id = emailId;

    const response = await client.sendGmailMessage({ requestBody });

    if (!response.ok) {
      const errorData = await response.json();
      console.error(`HTTP error ${response.status}`);
      return errorData;
    }

    const { id, error } = await response.json();

    if (!id && !error) {
      return { status: false, message: 'sending email failed', joinedEmail };
    }

    const messageId = id;

    // Save new email
    try {
      const actualMessage = await client.getGmailMessage({ messageId });

      const thread = await client.getThreadById({ threadId: actualMessage.threadId });

      if (!threadHasMessage(thread, messageId)) throw new Error('New message not in thread');

      await createEmails({ emails: thread.messages, contacts: {} });

      return { status: true, message: 'email sent', messageId, joinedEmail };
    } catch (e) {
      console.error(e);
      return { status: false, message: 'sending email was successful, but failed to store email', joinedEmail };
    }
  },
});

export const SEND_BULK_EMAIL = ({
  name,
  dataAccess,
  makeClient,
  createEmails,
}: {
  name: string;
  dataAccess: DataLayer;
  makeClient: MakeClient;
  createEmails: (params: CreateEmailsParams) => Promise<void>;
}): IntegrationAction<
  z.input<typeof SEND_EMAIL_SCHEMA>,
  {
    status: boolean;
    message: string;
  }
> => ({
  pluginName: name,
  label: 'Send Bulk Email',
  icon: {
    icon: gmailIcon,
    alt: 'Gmail',
  },
  description: 'Send an email to multiple recipients',
  schema: SEND_EMAIL_SCHEMA,
  type: 'SEND_BULK_EMAIL',
  async getSchemaOptions({ ctx }) {
    const emailSet = new Set();
    const people = await dataAccess.getRecordsByFieldName({ fieldName: 'email', connectionId: ctx.connectionId });

    people.forEach(person => {
      if ((person.data as any)?.email) {
        emailSet.add((person.data as any)?.email);
      }
    });

    const emailList = Array.from(emailSet)?.map(el => ({ label: el as string, value: el as string }));
    const schemaOptions = extractSchemaOptions({
      schema: SEND_EMAIL_SCHEMA,
      dataCtx: { to: { options: emailList }, cc: { options: emailList }, bcc: { options: emailList } },
    });

    return schemaOptions;
  },
  executor: async ({ data, ctx: { connectionId } }) => {
    const email = data;

    try {
      const result = await Promise.all(
        email.to?.map(async emailTo => {
          return SEND_EMAIL({ name, dataAccess, makeClient, createEmails }).executor({
            data: { ...email, to: [emailTo] },
            ctx: { connectionId },
          });
        }),
      );

      const goodResult = result?.filter(r => r?.status === true);
      if (goodResult?.length === email?.to?.length) {
        return { status: true, message: 'Bulk email sent' };
      } else {
        const badResults = result
          ?.filter(r => r?.status === false)
          ?.map(r => r?.joinedEmail)
          ?.join(',');

        return { status: true, message: `Unable to send Emails to ${badResults}` };
      }
    } catch (e) {
      console.error(e);
      return { status: false, message: 'sending email failed' };
    }
  },
});
