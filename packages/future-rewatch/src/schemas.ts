import { z } from 'zod';

import { apiKeyConnectionOptions } from '@/lib/integrations-framework/schemas';

export const rewatchConnectionOptions = apiKeyConnectionOptions.extend({
  channel: z.string(),
});

export const blankSchema = z.object({});

export const videoUploadedPayload = z.object({
  videoId: z.string(),
});
