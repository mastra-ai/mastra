import { apiKeyConnectionOptions } from '@kepler/core';
import { z } from 'zod';

export const rewatchConnectionOptions = apiKeyConnectionOptions.extend({
  channel: z.string(),
});

export const blankSchema = z.object({});

export const videoUploadedPayload = z.object({
  videoId: z.string(),
});
