// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createUserInputSchema = z.object({
  name: z.string().describe('The full name of the user. Example: "John Doe"'),
  email: z.string().optional().describe('The primary email address of the user. Example: "john@example.com"'),
  phone: z.string().optional().describe('The phone number of the user. Example: "+1234567890"'),
  role: z.enum(['end-user', 'agent', 'admin']).optional().describe('The role of the user. Example: "end-user"'),
  external_id: z.string().optional().describe('A unique identifier from your external system. Example: "ext-123"'),
  locale: z.string().optional().describe('The locale of the user. Example: "en-US"'),
  signature: z.string().optional().describe('The signature of the agent/admin. Example: "Best regards, John"'),
  details: z.string().optional().describe('Details about the user. Example: "VIP customer"'),
  notes: z.string().optional().describe('Notes about the user. Example: "Acquired through referral"'),
  organization_id: z.number().optional().describe('The ID of the organization the user belongs to. Example: 123'),
  verified: z.boolean().optional().describe('Whether the user has been verified. Example: true'),
  suspended: z.boolean().optional().describe('Whether the user is suspended. Example: false'),
});

const ProviderUserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().optional(),
  phone: z.string().nullable().optional(),
  role: z.string().optional(),
  external_id: z.string().nullable().optional(),
  locale: z.string().optional(),
  signature: z.string().nullable().optional(),
  details: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  organization_id: z.number().nullable().optional(),
  active: z.boolean().optional(),
  verified: z.boolean().optional(),
  suspended: z.boolean().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const createUserOutputSchema = z.object({
  id: z.number().describe('The ID of the created user. Example: 123'),
  name: z.string().describe('The name of the created user. Example: "John Doe"'),
  email: z.string().optional().describe('The email of the created user. Example: "john@example.com"'),
  phone: z.string().optional().describe('The phone of the created user. Example: "+1234567890"'),
  role: z.string().optional().describe('The role of the created user. Example: "end-user"'),
  external_id: z.string().optional().describe('The external ID of the created user. Example: "ext-123"'),
  locale: z.string().optional().describe('The locale of the created user. Example: "en-US"'),
  signature: z.string().optional().describe('The signature of the created user. Example: "Best regards, John"'),
  details: z.string().optional().describe('The details of the created user. Example: "VIP customer"'),
  notes: z.string().optional().describe('The notes of the created user. Example: "Acquired through referral"'),
  organization_id: z.number().optional().describe('The organization ID of the created user. Example: 123'),
  active: z.boolean().optional().describe('Whether the created user is active. Example: true'),
  verified: z.boolean().optional().describe('Whether the created user is verified. Example: true'),
  suspended: z.boolean().optional().describe('Whether the created user is suspended. Example: false'),
  created_at: z.string().optional().describe('The creation timestamp. Example: "2024-01-01T00:00:00Z"'),
  updated_at: z.string().optional().describe('The update timestamp. Example: "2024-01-01T00:00:00Z"'),
});

export function createUserTool(proxy: PlatformProxy) {
  return createTool({
    id: 'zendesk_create_user',
    description: 'Create a user in Zendesk Support.',
    inputSchema: createUserInputSchema,
    outputSchema: createUserOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createUserOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const userPayload: Record<string, unknown> = {
        name: input.name,
        ...(input.email !== undefined && { email: input.email }),
        ...(input.phone !== undefined && { phone: input.phone }),
        ...(input.role !== undefined && { role: input.role }),
        ...(input.external_id !== undefined && { external_id: input.external_id }),
        ...(input.locale !== undefined && { locale: input.locale }),
        ...(input.signature !== undefined && { signature: input.signature }),
        ...(input.details !== undefined && { details: input.details }),
        ...(input.notes !== undefined && { notes: input.notes }),
        ...(input.organization_id !== undefined && { organization_id: input.organization_id }),
        ...(input.verified !== undefined && { verified: input.verified }),
        ...(input.suspended !== undefined && { suspended: input.suspended }),
      };

      // https://developer.zendesk.com/api-reference/ticketing/users/users/
      const response = await platformProxy.post({
        endpoint: '/api/v2/users.json',
        data: {
          user: userPayload,
        },
        retries: 1,
      });

      if (!response.data || !response.data.user) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Invalid response from Zendesk API: missing user data',
        });
      }

      const providerUser = ProviderUserSchema.parse(response.data.user);

      return {
        id: providerUser.id,
        name: providerUser.name,
        ...(providerUser.email !== undefined && { email: providerUser.email }),
        ...(providerUser.phone != null && { phone: providerUser.phone }),
        ...(providerUser.role !== undefined && { role: providerUser.role }),
        ...(providerUser.external_id != null && { external_id: providerUser.external_id }),
        ...(providerUser.locale !== undefined && { locale: providerUser.locale }),
        ...(providerUser.signature != null && { signature: providerUser.signature }),
        ...(providerUser.details != null && { details: providerUser.details }),
        ...(providerUser.notes != null && { notes: providerUser.notes }),
        ...(providerUser.organization_id != null && { organization_id: providerUser.organization_id }),
        ...(providerUser.active !== undefined && { active: providerUser.active }),
        ...(providerUser.verified !== undefined && { verified: providerUser.verified }),
        ...(providerUser.suspended !== undefined && { suspended: providerUser.suspended }),
        ...(providerUser.created_at !== undefined && { created_at: providerUser.created_at }),
        ...(providerUser.updated_at !== undefined && { updated_at: providerUser.updated_at }),
      };
    },
  });
}
