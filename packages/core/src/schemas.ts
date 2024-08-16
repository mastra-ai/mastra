import { z } from 'zod';

export const connectParams = z.object({
  name: z.string(),
  connectionId: z.string(),
  clientRedirectPath: z.string().optional().default('/'),
});

export const oauthState = connectParams.extend({
  previewRedirect: z.string().optional(),
});

export const callbackParams = z.object({
  state: z.preprocess(
    (s) => JSON.parse(Buffer.from(s as string, 'base64').toString()),
    oauthState
  ),
  error: z.string().optional(),
});
