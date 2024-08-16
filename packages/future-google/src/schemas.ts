import { z } from 'zod';

export const SEND_EMAIL_SCHEMA = z.object({
  emailId: z.string().optional().default(''), // if this is a reply
  to: z.array(z.string().email()),
  subject: z.string().trim().min(1, 'Required'),
  body: z.string().trim().min(1, 'Required'),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
});
