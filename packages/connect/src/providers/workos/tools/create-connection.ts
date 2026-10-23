// AUTO-GENERATED from NangoHQ/integration-templates @ 792329abc442 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const KeyPairSchema = z.object({ key: z.string(), cert: z.string() });

const AttributeMapsSchema = z.object({
  standard_attributes: z
    .object({
      idp_id: z.string().optional(),
      email: z.string().optional(),
      first_name: z.string().optional(),
      last_name: z.string().optional(),
      groups: z.string().nullable().optional(),
      name: z.string().nullable().optional(),
    })
    .optional(),
  custom_attributes: z.record(z.string(), z.string()).optional(),
});

const SamlOptionsSchema = z.object({
  idp_metadata_url: z.string().url().optional(),
  acs_url: z.string().url().optional(),
  sp_entity_id: z.string().optional(),
  idp_entity_id: z.string().optional(),
  idp_sso_url: z.string().url().optional(),
  idp_signing_certs: z.array(z.string()).optional(),
  sp_signing_key_pair: KeyPairSchema.optional(),
  sp_encryption_key_pairs: z.array(KeyPairSchema).optional(),
});

const OidcOptionsSchema = z.object({
  discovery_endpoint: z.string().url(),
  client_id: z.string(),
  client_secret: z.string().optional(),
  redirect_uri: z.string().url().optional(),
  pkce: z.boolean().optional(),
  token_authentication_method: z.enum(['client_secret_post', 'client_secret_basic', 'private_key_jwt']).optional(),
  jwt_signing_key_pair: KeyPairSchema.optional(),
  id_token_signature_algorithm: z
    .enum([
      'ES256',
      'ES384',
      'ES512',
      'EdDSA',
      'HS256',
      'HS384',
      'HS512',
      'PS256',
      'PS384',
      'PS512',
      'RS256',
      'RS384',
      'RS512',
    ])
    .optional(),
  fetch_user_info: z.boolean().optional(),
});

export const createConnectionInputSchema = z
  .object({
    organization_id: z.string(),
    name: z.string().optional(),
    external_id: z
      .string()
      .max(128)
      .refine(
        value => Array.from(value).every(character => character.charCodeAt(0) <= 127),
        'External ID must contain only ASCII characters.',
      )
      .optional(),
    connection_type: z.string().optional(),
    attribute_maps: AttributeMapsSchema.optional(),
    saml_options: SamlOptionsSchema.optional(),
    oidc_options: OidcOptionsSchema.optional(),
  })
  .refine(input => Number(input.saml_options !== undefined) + Number(input.oidc_options !== undefined) === 1, {
    message: 'Exactly one of saml_options or oidc_options is required.',
  });

const ResourceSchema = z
  .object({
    object: z.literal('connection'),
    id: z.string(),
    organization_id: z.string().optional(),
    connection_type: z.string(),
    name: z.string(),
    state: z.enum(['requires_type', 'draft', 'active', 'validating', 'inactive', 'deleting']),
    status: z.enum(['linked', 'unlinked']),
    domains: z.array(
      z.object({ id: z.string(), object: z.literal('connection_domain'), domain: z.string() }).passthrough(),
    ),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .passthrough();

export const createConnectionOutputSchema = ResourceSchema;

export function createConnectionTool(proxy: PlatformProxy) {
  return createTool({
    id: 'workos_create_connection',
    description: 'Create a WorkOS SSO connection.',
    inputSchema: createConnectionInputSchema,
    outputSchema: createConnectionOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createConnectionOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://workos.com/docs/reference/sso/connection
        endpoint: '/connections',
        data: {
          organization_id: input.organization_id,
          ...(input.name !== undefined && { name: input.name }),
          ...(input.external_id !== undefined && { external_id: input.external_id }),
          ...(input.connection_type !== undefined && { connection_type: input.connection_type }),
          ...(input.attribute_maps !== undefined && { attribute_maps: input.attribute_maps }),
          ...(input.saml_options !== undefined && { saml_options: input.saml_options }),
          ...(input.oidc_options !== undefined && { oidc_options: input.oidc_options }),
        },
        retries: 3,
      });
      return ResourceSchema.parse(response.data);
    },
  });
}
