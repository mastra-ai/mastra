import { IntegrationContext } from '@arkw/core';
import { Email as PostalMimeEmail, Address as PostalMimeAddress } from 'postal-mime';
import { z } from 'zod';

import { GoogleClient } from './client';
import { Labels } from './constants';

export type EmailAddress = PostalMimeAddress;

export interface Source {
  type: string;
  id: string;
}

export interface Metadata {
  primary: boolean;
  source: Source;
}
export interface ContactEmailAddress {
  metadata: Metadata;
  value: string;
  type?: string;
  formattedType?: string;
}

export interface Name {
  metadata: Metadata;
  displayName: string;
  givenName: string;
  displayNameLastFirst: string;
  unstructuredName: string;
  familyName?: string;
  middleName?: string;
}

export interface GoogleConnection {
  resourceName: string;
  etag: string;
  names?: Name[];
  emailAddresses?: ContactEmailAddress[];
}

export type CreateEmailsParams = {
  emails: Email[];
  options?: {
    connectedEmail: string;
    entityId: string;
    recordSearchCache: Set<string>;
  };
  referenceId: string;
  contacts: Record<string, GoogleConnection>;
};

export type createCalendarEventsParams = {
  person?: { email: string; recordId: string };
  duration?: { minDate: Date; maxDate: Date };
  options?: {
    entityId: string;
  };
  connectedEmail?: string;
  referenceId: string;
};

export interface GooglePeopleData {
  connections?: GoogleConnection[];
  nextPageToken?: string;
  totalPeople: number;
  totalItems: number;
}

export interface Email extends PostalMimeEmail {
  id: string;
  threadId: string;
  snippet: string;
  labelIds: string[];
}

export interface MessagesByThread {
  threadId: string;
  messages: Email[];
  firstMessageDate: Date;
}

export interface ThreadResponseMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  sizeEstimate: number;
  historyId: string;
  internalDate: string;
}

export interface ThreadResponse {
  id: string;
  historyId: string;
  messages: ThreadResponseMessage[];
}

export const CalendarEventAttendeesStatusEnum = {
  declined: 'declined',
  accepted: 'accepted',
  needsAction: 'needsAction',
} as const;

export const CalendarEventAttendeeStatuses = [
  CalendarEventAttendeesStatusEnum.declined,
  CalendarEventAttendeesStatusEnum.accepted,
  CalendarEventAttendeesStatusEnum.needsAction,
] as const;

export interface EmailRequestBody {
  historyId?: string;
  id?: string;
  internalDate?: string;
  labelIds?: (keyof typeof Labels)[];
  payload?: Record<any, any>;
  raw: string;
  snippet: string;
  threadId?: string;
}

export interface CalendarType {
  kind: string;
  etag: string;
  id: string;
  summary: string;
  summaryOverride: string;
  timeZone: string;
  colorId: string;
  backgroundColor: string;
  foregroundColor: string;
  selected: boolean;
  accessRole: string;
  defaultReminders: { method: string; minutes: number }[];
  notificationSettings: {
    notifications: { type: string; method: string }[];
  };
  primary: boolean;
  hidden: boolean;
  deleted: boolean;
  description: string;
  location: string;
}

export const createEmailSchema = z.object({
  messageId: z.string(),
  emailId: z.string(),
  threadId: z.string(),
  subject: z.string(),
  labelIds: z.array(z.string()),
  snippet: z.string(),

  from: z.string(),
  to: z.array(z.string()),
  cc: z.array(z.string()).optional(),
  bcc: z.array(z.string()).optional(),

  text: z.string().optional(),
  html: z.string().optional(),
  date: z.date(),
});

export const calendarEventSchema = z.object({
  kind: z.string(),
  etag: z.string(),
  id: z.string(),
  status: z.string(),
  htmlLink: z.string(),
  created: z.string(),
  updated: z.string(),
  summary: z.string(),
  creator: z.object({ email: z.string(), self: z.boolean() }),
  organizer: z.object({ email: z.string(), self: z.boolean() }),
  originalStartTime: z.object({ dateTime: z.string(), timeZone: z.string() }),
  start: z.object({ dateTime: z.string(), timeZone: z.string() }),
  end: z.object({ dateTime: z.string(), timeZone: z.string() }),
  iCalUID: z.string(),
  sequence: z.number(),
  attendees: z.array(
    z.union([
      z.object({
        email: z.string(),
        displayName: z.string().optional(),
        organizer: z.boolean(),
        self: z.boolean().optional(),
        responseStatus: z.enum(CalendarEventAttendeeStatuses),
      }),
      z.object({
        email: z.string(),
        displayName: z.string().optional(),
        responseStatus: z.enum(CalendarEventAttendeeStatuses),
      }),
    ]),
  ),
  hangoutLink: z.string(),
  conferenceData: z.object({
    entryPoints: z.array(
      z.object({
        entryPointType: z.string(),
        uri: z.string(),
        label: z.string(),
      }),
    ),
    conferenceSolution: z.object({
      key: z.object({ type: z.string() }),
      name: z.string(),
      iconUri: z.string(),
    }),
    conferenceId: z.string(),
  }),
  recurringEventId: z.string().optional(),

  reminders: z.object({ useDefault: z.boolean() }),
  eventType: z.string(),
  calendarId: z.string().optional(),
});

export interface GetCalendarEventsProps {
  startDate?: Date;
  endDate?: Date;
  calendarId: string;
  orderBy: string;
  singleEvents: boolean;
}

export type CalendarEvent = z.infer<typeof calendarEventSchema>;

export interface ListCalendarEventsResponse {
  kind?: string | null; // kind: 'calendar#events';
  etag?: string | null;
  summary?: string | null;
  description?: string | null;
  updated?: string | null;
  timeZone?: string | null;
  accessRole?: string | null;
  defaultReminders?: [
    {
      method: string;
      minutes: number;
    },
  ];
  nextPageToken?: string | null;
  nextSyncToken?: string | null;
  items?: CalendarEvent[];
}

export type MakeClient = (context: IntegrationContext) => Promise<GoogleClient>;

export type CreateEmailType = z.infer<typeof createEmailSchema>;

export type UpdateEmailsParam = {
  emails: Record<string, any>;
  contacts: Record<string, any>;
  referenceId: string;
};

export type updateCalendarsParam = { referenceId: string; entityId: string };
