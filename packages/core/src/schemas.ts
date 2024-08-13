import { z } from 'zod';

export const oauthState = z.object({
  name: z.string(),
  connectionId: z.string(),
  clientRedirectPath: z.string(),
  previewRedirect: z.string().optional(),
});
