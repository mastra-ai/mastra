// AUTO-GENERATED from NangoHQ/integration-templates @ 8b75595da34c — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createUserInputSchema = z.object({
  external_id: z.string().optional(),
  email_address: z.array(z.string().email()).max(100).optional(),
  phone_number: z.array(z.string()).max(100).optional(),
  username: z.string().optional(),
  password: z.string().min(8).optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  locale: z.string().optional().describe('BCP-47 locale. Example: "en-US"'),
  skip_password_checks: z.boolean().optional(),
  skip_password_requirement: z.boolean().optional(),
  banned: z.boolean().optional(),
  locked: z.boolean().optional(),
  public_metadata: z.record(z.string(), z.unknown()).optional(),
  private_metadata: z.record(z.string(), z.unknown()).optional(),
  unsafe_metadata: z.record(z.string(), z.unknown()).optional(),
});

const UserSchema = z
  .object({
    id: z.string(),
    object: z.string().optional(),
    username: z.string().nullable().optional(),
    first_name: z.string().nullable().optional(),
    last_name: z.string().nullable().optional(),
    image_url: z.string().optional(),
    primary_email_address_id: z.string().nullable().optional(),
    primary_phone_number_id: z.string().nullable().optional(),
    external_id: z.string().nullable().optional(),
    banned: z.boolean().optional(),
    locked: z.boolean().optional(),
    created_at: z.number().optional(),
    updated_at: z.number().optional(),
    locale: z.string().nullable().optional(),
  })
  .passthrough();

export const createUserOutputSchema = UserSchema;

export function createUserTool(proxy: PlatformProxy) {
  return createTool({
    id: 'clerk_create_user',
    description: 'Create a user in Clerk.',
    inputSchema: createUserInputSchema,
    outputSchema: createUserOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createUserOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://clerk.com/docs/reference/backend-api/tag/Users#operation/CreateUser
        endpoint: '/v1/users',
        data: {
          ...(input.external_id !== undefined && { external_id: input.external_id }),
          ...(input.email_address !== undefined && { email_address: input.email_address }),
          ...(input.phone_number !== undefined && { phone_number: input.phone_number }),
          ...(input.username !== undefined && { username: input.username }),
          ...(input.password !== undefined && { password: input.password }),
          ...(input.first_name !== undefined && { first_name: input.first_name }),
          ...(input.last_name !== undefined && { last_name: input.last_name }),
          ...(input.locale !== undefined && { locale: input.locale }),
          ...(input.skip_password_checks !== undefined && { skip_password_checks: input.skip_password_checks }),
          ...(input.skip_password_requirement !== undefined && {
            skip_password_requirement: input.skip_password_requirement,
          }),
          ...(input.banned !== undefined && { banned: input.banned }),
          ...(input.locked !== undefined && { locked: input.locked }),
          ...(input.public_metadata !== undefined && { public_metadata: input.public_metadata }),
          ...(input.private_metadata !== undefined && { private_metadata: input.private_metadata }),
          ...(input.unsafe_metadata !== undefined && { unsafe_metadata: input.unsafe_metadata }),
        },
        retries: 3,
      });
      return UserSchema.parse(response.data);
    },
  });
}
