// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const generateAuthLinkInputSchema = z.object({
  type: z
    .union([
      z.literal('magiclink'),
      z.literal('recovery'),
      z.literal('invite'),
      z.literal('signup'),
      z.literal('email_change_current'),
      z.literal('email_change_new'),
    ])
    .describe('Type of link to generate.'),
  email: z.string().describe('Email address of the user.'),
  new_email: z
    .string()
    .optional()
    .describe('New email address for email_change_current and email_change_new link types.'),
  redirect_to: z.string().optional().describe('Optional redirect URL after verification.'),
  data: z.record(z.string(), z.unknown()).optional().describe('Optional extra metadata to attach to the user.'),
});

const ProviderUserSchema = z.object({
  id: z.string().optional(),
  aud: z.string().optional(),
  role: z.string().optional(),
  email: z.string().optional(),
  email_confirmed_at: z.string().optional(),
  phone: z.string().optional(),
  phone_confirmed_at: z.string().optional(),
  confirmation_sent_at: z.string().optional(),
  recovery_sent_at: z.string().optional(),
  email_change_sent_at: z.string().optional(),
  new_email: z.string().optional(),
  invited_at: z.string().optional(),
  action_link: z.string().optional(),
  email_otp: z.string().optional(),
  hashed_token: z.string().optional(),
  verification_type: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const generateAuthLinkOutputSchema = z.object({
  id: z.string().optional(),
  email: z.string().optional(),
  action_link: z.string().optional(),
  email_otp: z.string().optional(),
  hashed_token: z.string().optional(),
  verification_type: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export function generateAuthLinkTool(proxy: PlatformProxy) {
  return createTool({
    id: 'supabase_generate_auth_link',
    description: 'Generate a magic link, OTP, invite, signup, or recovery link for a user.',
    inputSchema: generateAuthLinkInputSchema,
    outputSchema: generateAuthLinkOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof generateAuthLinkOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const connection = await platformProxy.getConnection();
      const connectionConfig = connection.connection_config;
      const projectUrl =
        typeof connectionConfig === 'object' && connectionConfig !== null && 'projectUrl' in connectionConfig
          ? String(connectionConfig['projectUrl'])
          : undefined;
      const baseUrlOverride = projectUrl
        ? projectUrl.startsWith('http')
          ? projectUrl
          : `https://${projectUrl}`
        : undefined;

      if ((input.type === 'email_change_current' || input.type === 'email_change_new') && !input.new_email) {
        throw new platformProxy.ActionError({
          type: 'invalid_input',
          message: `new_email is required when type is "${input.type}".`,
        });
      }

      const body: {
        type: string;
        email: string;
        new_email?: string;
        redirect_to?: string;
        data?: Record<string, unknown>;
      } = {
        type: input.type,
        email: input.email,
      };

      if (input.new_email !== undefined) {
        body.new_email = input.new_email;
      }

      if (input.redirect_to !== undefined) {
        body.redirect_to = input.redirect_to;
      }

      if (input.data !== undefined) {
        body.data = input.data;
      }

      const response = await platformProxy.post({
        // https://supabase.com/docs/reference/api/admin-generate-link
        endpoint: '/auth/v1/admin/generate_link',
        baseUrlOverride,
        data: body,
        retries: 3,
      });

      const providerData = ProviderUserSchema.parse(response.data);

      return {
        ...(providerData.id !== undefined && { id: providerData.id }),
        ...(providerData.email !== undefined && { email: providerData.email }),
        ...(providerData.action_link !== undefined && { action_link: providerData.action_link }),
        ...(providerData.email_otp !== undefined && { email_otp: providerData.email_otp }),
        ...(providerData.hashed_token !== undefined && { hashed_token: providerData.hashed_token }),
        ...(providerData.verification_type !== undefined && { verification_type: providerData.verification_type }),
        ...(providerData.created_at !== undefined && { created_at: providerData.created_at }),
        ...(providerData.updated_at !== undefined && { updated_at: providerData.updated_at }),
      };
    },
  });
}
