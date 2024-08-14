import { z } from 'zod';

export const connectParams = z.object({
  name: z.string(),
  connectionId: z.string(),
  clientRedirectPath: z.string().optional(),
});

export const oauthState = connectParams.extend({
  previewRedirect: z.string().optional(),
});
