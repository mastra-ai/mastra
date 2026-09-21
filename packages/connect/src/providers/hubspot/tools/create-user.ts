// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createUserInputSchema = z.object({
  email: z.string().email().describe('The email address of the user to create. Example: "user@example.com"'),
  firstName: z.string().optional().describe('The first name of the user. Example: "John"'),
  lastName: z.string().optional().describe('The last name of the user. Example: "Doe"'),
  roleId: z.string().optional().describe('The ID of the role/permission set to assign to the user. Example: "12345"'),
  teamId: z.string().optional().describe('The ID of the primary team to assign the user to. Example: "67890"'),
  sendWelcomeEmail: z
    .boolean()
    .optional()
    .describe('Whether to send a welcome email to the user. Defaults to true if not specified.'),
});

export const createUserOutputSchema = z.object({
  id: z.string(),
  email: z.string(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  roleId: z.string().optional(),
  teamId: z.string().optional(),
  createdAt: z.string().optional(),
});

export function createUserTool(proxy: PlatformProxy) {
  return createTool({
    id: 'hubspot_create_user',
    description: 'Provision a HubSpot user with email, role, and team assignments',
    inputSchema: createUserInputSchema,
    outputSchema: createUserOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createUserOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.hubspot.com/docs/api-reference/settings-user-provisioning-v3/users/post-settings-v3-users-
      const requestBody: Record<string, any> = {
        email: input.email,
        sendWelcomeEmail: input.sendWelcomeEmail ?? true,
      };

      if (input.firstName) {
        requestBody['firstName'] = input.firstName;
      }

      if (input.lastName) {
        requestBody['lastName'] = input.lastName;
      }

      if (input.roleId) {
        requestBody['roleId'] = input.roleId;
      }

      if (input.teamId) {
        requestBody['teamId'] = input.teamId;
      }

      const response = await platformProxy.post({
        endpoint: '/settings/v3/users/',
        data: requestBody,
        retries: 3,
      });

      const data = response.data;

      return {
        id: data.id,
        email: data.email,
        firstName: data['firstName'] ?? undefined,
        lastName: data['lastName'] ?? undefined,
        roleId: data['roleId'] ?? undefined,
        teamId: data['teamId'] ?? undefined,
        createdAt: data['createdAt'] ?? undefined,
      };
    },
  });
}
