// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const EmailAddressSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
});

const PersonalizationSchema = z.object({
  to: z.array(EmailAddressSchema).min(1),
  cc: z.array(EmailAddressSchema).optional(),
  bcc: z.array(EmailAddressSchema).optional(),
  subject: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  substitutions: z.record(z.string(), z.string()).optional(),
  custom_args: z.record(z.string(), z.string()).optional(),
  send_at: z.number().optional(),
  dynamic_template_data: z.record(z.string(), z.unknown()).optional(),
});

const ContentSchema = z.object({
  type: z.string(),
  value: z.string(),
});

const AttachmentSchema = z.object({
  content: z.string(),
  filename: z.string(),
  type: z.string().optional(),
  disposition: z.string().optional(),
  content_id: z.string().optional(),
});

const AsmSchema = z.object({
  group_id: z.number(),
  groups_to_display: z.array(z.number()).optional(),
});

const MailSettingsSchema = z.object({
  bcc: z.object({ email: z.string().email(), enable: z.boolean().optional() }).optional(),
  bypass_list_management: z.object({ enable: z.boolean().optional() }).optional(),
  bypass_unsubscribe_management: z.object({ enable: z.boolean().optional() }).optional(),
  footer: z
    .object({ enable: z.boolean().optional(), text: z.string().optional(), html: z.string().optional() })
    .optional(),
  sandbox_mode: z.object({ enable: z.boolean().optional() }).optional(),
  spam_check: z
    .object({ enable: z.boolean().optional(), threshold: z.number().optional(), post_to_url: z.string().optional() })
    .optional(),
});

const TrackingSettingsSchema = z.object({
  click_tracking: z.object({ enable: z.boolean().optional(), enable_text: z.boolean().optional() }).optional(),
  open_tracking: z.object({ enable: z.boolean().optional(), substitution_tag: z.string().optional() }).optional(),
  subscription_tracking: z
    .object({
      enable: z.boolean().optional(),
      text: z.string().optional(),
      html: z.string().optional(),
      substitution_tag: z.string().optional(),
    })
    .optional(),
  ganalytics: z
    .object({
      enable: z.boolean().optional(),
      utm_source: z.string().optional(),
      utm_medium: z.string().optional(),
      utm_term: z.string().optional(),
      utm_content: z.string().optional(),
      utm_campaign: z.string().optional(),
    })
    .optional(),
});

export const sendMailInputSchema = z
  .object({
    personalizations: z.array(PersonalizationSchema).min(1),
    from: EmailAddressSchema,
    reply_to: EmailAddressSchema.optional(),
    reply_to_list: z.array(EmailAddressSchema).optional(),
    subject: z.string().optional(),
    content: z.array(ContentSchema).optional(),
    attachments: z.array(AttachmentSchema).optional(),
    template_id: z.string().min(1).optional(),
    sections: z.record(z.string(), z.string()).optional(),
    headers: z.record(z.string(), z.string()).optional(),
    categories: z.array(z.string()).optional(),
    custom_args: z.record(z.string(), z.string()).optional(),
    send_at: z.number().optional(),
    batch_id: z.string().optional(),
    asm: AsmSchema.optional(),
    ip_pool_name: z.string().optional(),
    mail_settings: MailSettingsSchema.optional(),
    tracking_settings: TrackingSettingsSchema.optional(),
  })
  .refine(data => !(data.reply_to !== undefined && data.reply_to_list !== undefined), {
    message: 'reply_to is mutually exclusive with reply_to_list.',
  })
  .refine(data => data.template_id !== undefined || (data.content !== undefined && data.content.length > 0), {
    message: 'Unless a valid template_id is provided, content is required with at least one entry.',
  })
  .refine(
    data =>
      data.template_id !== undefined ||
      data.subject !== undefined ||
      data.personalizations.every(p => p.subject !== undefined),
    {
      message: 'subject is required unless template_id is provided or every personalization defines its own subject.',
    },
  );

export const sendMailOutputSchema = z.object({
  accepted: z.boolean(),
  message_id: z.string().optional(),
});

export function sendMailTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sendgrid_send_mail',
    description: 'Send an email.',
    inputSchema: sendMailInputSchema,
    outputSchema: sendMailOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof sendMailOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://www.twilio.com/docs/sendgrid/api-reference/mail-send/mail-send
        endpoint: '/v3/mail/send',
        data: input,
        retries: 3,
      });

      let messageId: string | undefined;
      if (response.headers && typeof response.headers === 'object' && !Array.isArray(response.headers)) {
        const val = response.headers['x-message-id'] || response.headers['X-Message-Id'];
        if (typeof val === 'string') {
          messageId = val;
        }
      }

      return {
        accepted: response.status === 200 || response.status === 202,
        message_id: messageId,
      };
    },
  });
}
