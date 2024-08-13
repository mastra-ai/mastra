import { Labels } from './constants';
import { Email } from './types';

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
