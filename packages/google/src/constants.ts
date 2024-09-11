import { PropertyType } from '@kpl/core';

export const Labels = {
  CHAT: 'CHAT',
  SENT: 'SENT',
  INBOX: 'INBOX',
  IMPORTANT: 'IMPORTANT',
  TRASH: 'TRASH',
  DRAFT: 'DRAFT',
  SPAM: 'SPAM',
  CATEGORY_FORUMS: 'CATEGORY_FORUMS',
  CATEGORY_UPDATES: 'CATEGORY_UPDATES',
  CATEGORY_PERSONAL: 'CATEGORY_PERSONAL',
  CATEGORY_PROMOTIONS: 'CATEGORY_PROMOTIONS',
  CATEGORY_SOCIAL: 'CATEGORY_SOCIAL',
  STARRED: 'STARRED',
  UNREAD: 'UNREAD',
} as const;

export const GMAIL_API_URL = `https://gmail.googleapis.com`;

export const WORKSHEET_RECORD_TYPE_NAME = 'people';

export const CONTACT_FIELDS = [
  {
    name: 'firstName',
    displayName: 'First Name',
    type: PropertyType.SINGLE_LINE_TEXT,
    visible: true,
    order: 1,
    modifiable: true,
  } as const,
  {
    name: 'lastName',
    displayName: 'Last Name',
    type: PropertyType.SINGLE_LINE_TEXT,
    visible: true,
    order: 2,
    modifiable: true,
  } as const,
  {
    name: 'email',
    displayName: 'Email',
    type: PropertyType.SINGLE_LINE_TEXT,
    visible: true,
    order: 3,
  } as const,
];

export const EMAIL_FIELDS = [
  {
    name: 'messageId',
    displayName: 'Message ID',
    type: PropertyType.SINGLE_LINE_TEXT,
    visible: true,
    order: 1,
    modifiable: true,
  } as const,
  {
    name: 'emailId',
    displayName: 'Email ID',
    type: PropertyType.SINGLE_LINE_TEXT,
    visible: true,
    order: 2,
    modifiable: true,
  } as const,
  {
    name: 'threadId',
    displayName: 'Thread ID',
    type: PropertyType.SINGLE_LINE_TEXT,
    visible: true,
    order: 3,
    modifiable: true,
  } as const,
  {
    name: 'subject',
    displayName: 'Subject',
    type: PropertyType.SINGLE_LINE_TEXT,
    visible: true,
    order: 4,
  } as const,
  {
    name: 'snippet',
    displayName: 'Snippet',
    type: PropertyType.LONG_TEXT,
    visible: true,
    order: 5,
  } as const,
  {
    name: 'html',
    displayName: 'HTML',
    type: PropertyType.LONG_TEXT,
    visible: true,
    order: 6,
  } as const,
  {
    name: 'text',
    displayName: 'Text',
    type: PropertyType.LONG_TEXT,
    visible: true,
    order: 7,
  } as const,
  {
    name: 'date',
    displayName: 'Date',
    type: PropertyType.DATE,
    visible: true,
    order: 8,
  } as const,
  {
    name: 'from',
    displayName: 'From',
    type: PropertyType.SINGLE_LINE_TEXT,
    visible: true,
    order: 9,
  } as const,
  {
    name: 'to',
    displayName: 'To',
    type: PropertyType.SINGLE_LINE_TEXT,
    visible: true,
    order: 10,
  } as const,
  {
    name: 'cc',
    displayName: 'CC',
    type: PropertyType.SINGLE_LINE_TEXT,
    visible: true,
    order: 11,
  } as const,
  {
    name: 'bcc',
    displayName: 'BCC',
    type: PropertyType.SINGLE_LINE_TEXT,
    visible: true,
    order: 12,
  } as const,
  {
    name: `labelIds`,
    displayName: `Label IDs`,
    type: PropertyType.SINGLE_LINE_TEXT,
    visible: true,
    order: 13,
  } as const,
];

export const CALENDAR_FIELDS = [
  {
    name: 'calendarId',
    displayName: 'Calendar ID',
    type: PropertyType.SINGLE_LINE_TEXT,
    visible: true,
    order: 1,
    modifiable: true,
  } as const,
  {
    name: 'eventId',
    displayName: 'Event ID',
    type: PropertyType.SINGLE_LINE_TEXT,
    visible: true,
    order: 2,
    modifiable: true,
  } as const,
  {
    name: 'summary',
    displayName: 'Summary',
    type: PropertyType.SINGLE_LINE_TEXT,
    visible: true,
    order: 3,
  } as const,
  {
    name: 'description',
    displayName: 'Description',
    type: PropertyType.LONG_TEXT,
    visible: true,
    order: 4,
  } as const,
  {
    name: 'location',
    displayName: 'Location',
    type: PropertyType.SINGLE_LINE_TEXT,
    visible: true,
    order: 5,
  } as const,
  {
    name: 'start',
    displayName: 'Start Date/Time',
    type: PropertyType.DATE,
    visible: true,
    order: 6,
  } as const,
  {
    name: 'end',
    displayName: 'End Date/Time',
    type: PropertyType.DATE,
    visible: true,
    order: 7,
  } as const,
  {
    name: 'attendees',
    displayName: 'Attendees',
    type: PropertyType.LONG_TEXT,
    visible: true,
    order: 8,
  } as const,
  {
    name: 'organizer',
    displayName: 'Organizer',
    type: PropertyType.SINGLE_LINE_TEXT,
    visible: true,
    order: 9,
  } as const,
  {
    name: 'status',
    displayName: 'Event Status',
    type: PropertyType.SINGLE_LINE_TEXT,
    visible: true,
    order: 10,
  } as const,
  {
    name: 'created',
    displayName: 'Created Date/Time',
    type: PropertyType.DATE,
    visible: true,
    order: 11,
  } as const,
  {
    name: 'updated',
    displayName: 'Updated Date/Time',
    type: PropertyType.DATE,
    visible: true,
    order: 12,
  } as const,
];

export const googleEntityToFieldsMap = {
  CONTACTS: CONTACT_FIELDS,
  EMAIL: EMAIL_FIELDS,
  CALENDAR: CALENDAR_FIELDS,
} as const;
