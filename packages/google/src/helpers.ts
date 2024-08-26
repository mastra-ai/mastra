import * as base64 from 'base64-js';
import { JSDOM } from 'jsdom';
import { marked } from 'marked';
import { Address as PostalMimeAddress } from 'postal-mime';

import { Labels } from './constants';
import { GoogleConnection, Email, MessagesByThread } from './types';

export const formatDate = (date: Date): string => {
  date = new Date(date);
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // Month is zero-based, so add 1
  const day = date.getDate();

  // Padding zeros if necessary
  const formattedMonth = month < 10 ? '0' + month : month.toString();
  const formattedDay = day < 10 ? '0' + day : day.toString();

  const formattedDate = `${year}/${formattedMonth}/${formattedDay}`;
  return formattedDate;
};

export const threadHasMessage = (thread: MessagesByThread, messageId: string): boolean => {
  for (const message of thread.messages) {
    if (message.id == messageId) return true;
  }
  return false;
};

export function getSnippet(body: string, length: number = 100): string {
  const dom = new JSDOM(body);
  const plainTextBody = dom.window.document.body.textContent || '';

  // Trim the plain text to the desired snippet length.
  return plainTextBody.slice(0, length);
}

export function createRawMessage(
  to: string[],
  cc: string[] = [],
  bcc: string[] = [],
  subject: string,
  body: string,
  format: 'text' | 'html' = 'html',
  inReplyTo?: string,
  references?: string,
): string {
  // Create the message headers.
  const headers = [
    `To: ${to.join(', ')}`,
    `Cc: ${cc.join(', ')}`,
    `Bcc: ${bcc.join(', ')}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: ${format === 'html' ? 'text/html' : 'text/plain'}; charset=UTF-8`,
  ];

  // Add In-Reply-To and References headers if provided.
  if (inReplyTo) {
    headers.push(`In-Reply-To: ${inReplyTo}`);
  }
  if (references) {
    headers.push(`References: ${references}`);
  }

  // Create the message body.
  const messageBody = marked.parse(body, { async: false }) as string;

  // Combine the headers and body into a single string.
  const message = headers.join('\n') + '\n\n' + messageBody;
  // convert to html

  // Encode the message in base64url.
  const rawMessage = base64.fromByteArray(new TextEncoder().encode(message));

  return rawMessage;
}

export const buildGetMessagesQuery = async ({
  labels,
  from,
  to,
}: {
  labels?: (keyof typeof Labels)[];
  from?: Date;
  to?: Date;
}): Promise<string> => {
  let query: string = '';
  let filter: string = '';
  // filter example `in:sent after:${formatDate(date of type Date)}`

  if (labels) {
    for (const label of labels) {
      query = query == '' ? `labelIds=${label}` : `${query}&labelIds=${label}`;
    }
  }

  if (from) {
    const f = `after:${formatDate(from)}`;
    filter = filter == '' ? f : `${filter} ${f}`;
  }

  if (to) {
    const f = `before:${formatDate(to)}`;
    filter = filter == '' ? f : `${filter} ${f}`;
  }

  return query == '' ? `q=${filter}` : `${query}&q=${filter}`;
};

export const getValidRecipientAddresses = ({
  addresses,
  connectedEmail,
}: {
  addresses: PostalMimeAddress[];
  connectedEmail?: string;
}): PostalMimeAddress[] => {
  let newAddressList: PostalMimeAddress[] = [];

  for (const address of addresses) {
    if (isEmailValidForSync({ email: address?.address ?? '', connectedEmail })) newAddressList.push(address);
  }
  return newAddressList;
};

// function to perform Depth-First Search (DFS) and topological sort
export function dfsEmails(email: Email, emailMap: Map<string, Email>, visited: Set<string>, stack: Email[]) {
  if (visited.has(email.messageId)) return;
  visited.add(email.messageId);

  if (email.inReplyTo) {
    const parentEmail = emailMap.get(email.inReplyTo);
    if (parentEmail) {
      dfsEmails(parentEmail, emailMap, visited, stack);
    }
    delete email.inReplyTo;
  }

  stack.push(email);
}

// Function to sort emails to avoid non-existing inReplyTo reference
export function arrangeEmailsInOrderOfCreation(emails: Email[]): Email[] {
  const emailMap = new Map<string, Email>();
  for (const email of emails) {
    emailMap.set(email.messageId, email);
  }

  const visited = new Set<string>();
  const stack: Email[] = [];

  for (const email of emails) {
    if (!visited.has(email.messageId)) {
      dfsEmails(email, emailMap, visited, stack);
    }
  }

  return stack;
}

export function extractCompanyDomain(email: string): string {
  const [, domain] = email.split('@');
  return domain;
}

export const isSentEmail = (email: Email): boolean => {
  return email.labelIds.includes('SENT');
};

export const getNamesWithEmailFromContacts = async (
  email: string,
  contacts: Record<string, GoogleConnection>,
): Promise<{ firstName: string; lastName: string } | undefined> => {
  const contact = contacts[email];
  if (!contact) return;

  let firstName = (contact.names ?? []).length > 0 ? (contact.names ?? [])[0].givenName : '';
  let lastName = (contact.names ?? []).length > 0 ? (contact.names ?? [])[0].familyName : '';

  firstName =
    firstName != '' ? firstName : (contact.names ?? []).length > 0 ? (contact.names ?? [])[0].middleName ?? '' : '';

  lastName = lastName != '' ? lastName : (contact.names ?? []).length > 0 ? (contact.names ?? [])[0].middleName : '';

  if (firstName == '' && lastName == '') return;
  return { firstName, lastName: lastName ?? '' };
};

export const nameForContact = async ({
  nameFromService,
  emailAddress,
  contacts,
}: {
  nameFromService?: string; //this is the name gotten from the service (example: gmail)
  emailAddress: string;
  contacts: Record<string, GoogleConnection>; //get this with the function findContactsHavingEmailAddress
}): Promise<{ firstName?: string; lastName?: string }> => {
  let firstName = (nameFromService ?? '')?.split(' ').length >= 0 ? nameFromService?.split(' ')[0] : '';
  let lastName = (nameFromService ?? '')?.split(' ').length >= 1 ? nameFromService?.split(' ')[1] : '';

  if (firstName && lastName) {
    return { firstName, lastName };
  }
  const contact = await getNamesWithEmailFromContacts(emailAddress, contacts);

  return { firstName: contact?.firstName || firstName, lastName: contact?.lastName || lastName };
};

export function haveSameDomain(email1: string, email2: string): boolean {
  const excludedDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com']; // this array will keep growing
  const domain = extractCompanyDomain(email1);
  return domain === extractCompanyDomain(email2) && !excludedDomains.includes(domain);
}

export const isEmailValidForSync = ({ email, connectedEmail }: { email: string; connectedEmail?: string }): boolean => {
  if (!email || email == '') return false;
  const exludeStrings = [
    'no-reply',
    'noreply',
    'support',
    'notification',
    'mailer-daemon',
    'success@',
    'communications@',
    'feedback@',
    'onboarding@',
    'hello@',
  ];

  if (connectedEmail && haveSameDomain(email, connectedEmail)) return false;

  for (const st of exludeStrings) {
    if (email.includes(st)) {
      return false;
    }
  }
  return true;
};

export const arrangeThreadMessagesByFirstMessageData = (messagesByThread: MessagesByThread[]) => {
  const filteredResults: MessagesByThread[] = messagesByThread.reduce(
    (prev: MessagesByThread[], curr): MessagesByThread[] => {
      if (curr) prev.push(curr);
      return prev;
    },
    [],
  );
  filteredResults.sort((a, b) => (a?.firstMessageDate as Date).getTime() - (b?.firstMessageDate as Date).getTime());
  return filteredResults;
};
