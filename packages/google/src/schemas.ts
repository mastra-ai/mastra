import { IntegrationFieldTypeEnum } from '@kepler/core';
import { z } from 'zod';

export const SEND_EMAIL_SCHEMA = z.object({
  emailId: z.string().optional().default(''), // if this is a reply
  to: z.array(z.string().email()).describe(`type::${IntegrationFieldTypeEnum.CREATABLE_SELECT}`),
  subject: z.string().trim().min(1, 'Required'),
  body: z.string().trim().min(1, 'Required').describe(`type::${IntegrationFieldTypeEnum.RICH_TEXT}`),
  cc: z.array(z.string().email()).describe(`type::${IntegrationFieldTypeEnum.CREATABLE_SELECT}`).optional(),
  bcc: z.array(z.string().email()).describe(`type::${IntegrationFieldTypeEnum.CREATABLE_SELECT}`).optional(),
});
