import { IntegrationFieldTypeEnum } from '@kepler/core';
import { z } from 'zod';

export const SEND_MESSAGE_TO_CHANNEL_SCHEMA = z.object({
  channelId: z.string().trim().min(1, 'Required'),
  message: z.string().describe(`type::${IntegrationFieldTypeEnum.LONG_TEXT}`),
});

export const CREATE_NEW_CHANNEL_SCHEMA = z.object({
  channelName: z.string().trim().min(1, 'Required'),
  isPrivate: z.enum(['true', 'false']),
});

export const CREATE_NEW_CHANNEL_OUTPUT_SCHEMA = z.object({
  channelId: z.string().nullable(),
});

export const INVITE_TO_CHANNEL_SCHEMA = z.object({
  channelId: z.string().trim().min(1, 'Required'),
  users: z.array(z.string()),
});
