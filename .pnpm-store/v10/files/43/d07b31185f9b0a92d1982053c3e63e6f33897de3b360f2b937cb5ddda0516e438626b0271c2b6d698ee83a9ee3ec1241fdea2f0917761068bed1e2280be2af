// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../../resource';
import * as Core from '../../../../core';
import * as ReferencesAPI from './references';
import { ReferenceGetParams, ReferenceGetResponse, References } from './references';
import { SinglePage } from '../../../../pagination';

export class Integrations extends APIResource {
  references: ReferencesAPI.References = new ReferencesAPI.References(this._client);

  /**
   * Create new risk score integration.
   *
   * @example
   * ```ts
   * const integration =
   *   await client.zeroTrust.riskScoring.integrations.create({
   *     account_id: 'account_id',
   *     integration_type: 'Okta',
   *     tenant_url: 'https://example.com',
   *   });
   * ```
   */
  create(
    params: IntegrationCreateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<IntegrationCreateResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/zt_risk_scoring/integrations`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: IntegrationCreateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Overwrite the reference_id, tenant_url, and active values with the ones
   * provided.
   *
   * @example
   * ```ts
   * const integration =
   *   await client.zeroTrust.riskScoring.integrations.update(
   *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *     {
   *       account_id: 'account_id',
   *       active: true,
   *       tenant_url: 'https://example.com',
   *     },
   *   );
   * ```
   */
  update(
    integrationId: string,
    params: IntegrationUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<IntegrationUpdateResponse> {
    const { account_id, ...body } = params;
    return (
      this._client.put(`/accounts/${account_id}/zt_risk_scoring/integrations/${integrationId}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: IntegrationUpdateResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * List all risk score integrations for the account.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const integrationListResponse of client.zeroTrust.riskScoring.integrations.list(
   *   { account_id: 'account_id' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    params: IntegrationListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<IntegrationListResponsesSinglePage, IntegrationListResponse> {
    const { account_id } = params;
    return this._client.getAPIList(
      `/accounts/${account_id}/zt_risk_scoring/integrations`,
      IntegrationListResponsesSinglePage,
      options,
    );
  }

  /**
   * Delete a risk score integration.
   *
   * @example
   * ```ts
   * const integration =
   *   await client.zeroTrust.riskScoring.integrations.delete(
   *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *     { account_id: 'account_id' },
   *   );
   * ```
   */
  delete(
    integrationId: string,
    params: IntegrationDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<IntegrationDeleteResponse | null> {
    const { account_id } = params;
    return (
      this._client.delete(
        `/accounts/${account_id}/zt_risk_scoring/integrations/${integrationId}`,
        options,
      ) as Core.APIPromise<{ result: IntegrationDeleteResponse | null }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Get risk score integration by id.
   *
   * @example
   * ```ts
   * const integration =
   *   await client.zeroTrust.riskScoring.integrations.get(
   *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
   *     { account_id: 'account_id' },
   *   );
   * ```
   */
  get(
    integrationId: string,
    params: IntegrationGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<IntegrationGetResponse> {
    const { account_id } = params;
    return (
      this._client.get(
        `/accounts/${account_id}/zt_risk_scoring/integrations/${integrationId}`,
        options,
      ) as Core.APIPromise<{ result: IntegrationGetResponse }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class IntegrationListResponsesSinglePage extends SinglePage<IntegrationListResponse> {}

export interface IntegrationCreateResponse {
  /**
   * The id of the integration, a UUIDv4.
   */
  id: string;

  /**
   * The Cloudflare account tag.
   */
  account_tag: string;

  /**
   * Whether this integration is enabled and should export changes in risk score.
   */
  active: boolean;

  /**
   * When the integration was created in RFC3339 format.
   */
  created_at: string;

  integration_type: 'Okta';

  /**
   * A reference ID defined by the client. Should be set to the Access-Okta IDP
   * integration ID. Useful when the risk-score integration needs to be associated
   * with a secondary asset and recalled using that ID.
   */
  reference_id: string;

  /**
   * The base URL for the tenant. E.g. "https://tenant.okta.com".
   */
  tenant_url: string;

  /**
   * The URL for the Shared Signals Framework configuration, e.g.
   * "/.well-known/sse-configuration/{integration_uuid}/".
   * https://openid.net/specs/openid-sse-framework-1_0.html#rfc.section.6.2.1.
   */
  well_known_url: string;
}

export interface IntegrationUpdateResponse {
  /**
   * The id of the integration, a UUIDv4.
   */
  id: string;

  /**
   * The Cloudflare account tag.
   */
  account_tag: string;

  /**
   * Whether this integration is enabled and should export changes in risk score.
   */
  active: boolean;

  /**
   * When the integration was created in RFC3339 format.
   */
  created_at: string;

  integration_type: 'Okta';

  /**
   * A reference ID defined by the client. Should be set to the Access-Okta IDP
   * integration ID. Useful when the risk-score integration needs to be associated
   * with a secondary asset and recalled using that ID.
   */
  reference_id: string;

  /**
   * The base URL for the tenant. E.g. "https://tenant.okta.com".
   */
  tenant_url: string;

  /**
   * The URL for the Shared Signals Framework configuration, e.g.
   * "/.well-known/sse-configuration/{integration_uuid}/".
   * https://openid.net/specs/openid-sse-framework-1_0.html#rfc.section.6.2.1.
   */
  well_known_url: string;
}

export interface IntegrationListResponse {
  /**
   * The id of the integration, a UUIDv4.
   */
  id: string;

  /**
   * The Cloudflare account tag.
   */
  account_tag: string;

  /**
   * Whether this integration is enabled and should export changes in risk score.
   */
  active: boolean;

  /**
   * When the integration was created in RFC3339 format.
   */
  created_at: string;

  integration_type: 'Okta';

  /**
   * A reference ID defined by the client. Should be set to the Access-Okta IDP
   * integration ID. Useful when the risk-score integration needs to be associated
   * with a secondary asset and recalled using that ID.
   */
  reference_id: string;

  /**
   * The base URL for the tenant. E.g. "https://tenant.okta.com".
   */
  tenant_url: string;

  /**
   * The URL for the Shared Signals Framework configuration, e.g.
   * "/.well-known/sse-configuration/{integration_uuid}/".
   * https://openid.net/specs/openid-sse-framework-1_0.html#rfc.section.6.2.1.
   */
  well_known_url: string;
}

export type IntegrationDeleteResponse = unknown;

export interface IntegrationGetResponse {
  /**
   * The id of the integration, a UUIDv4.
   */
  id: string;

  /**
   * The Cloudflare account tag.
   */
  account_tag: string;

  /**
   * Whether this integration is enabled and should export changes in risk score.
   */
  active: boolean;

  /**
   * When the integration was created in RFC3339 format.
   */
  created_at: string;

  integration_type: 'Okta';

  /**
   * A reference ID defined by the client. Should be set to the Access-Okta IDP
   * integration ID. Useful when the risk-score integration needs to be associated
   * with a secondary asset and recalled using that ID.
   */
  reference_id: string;

  /**
   * The base URL for the tenant. E.g. "https://tenant.okta.com".
   */
  tenant_url: string;

  /**
   * The URL for the Shared Signals Framework configuration, e.g.
   * "/.well-known/sse-configuration/{integration_uuid}/".
   * https://openid.net/specs/openid-sse-framework-1_0.html#rfc.section.6.2.1.
   */
  well_known_url: string;
}

export interface IntegrationCreateParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param:
   */
  integration_type: 'Okta';

  /**
   * Body param: The base url of the tenant, e.g. "https://tenant.okta.com".
   */
  tenant_url: string;

  /**
   * Body param: A reference id that can be supplied by the client. Currently this
   * should be set to the Access-Okta IDP ID (a UUIDv4).
   * https://developers.cloudflare.com/api/operations/access-identity-providers-get-an-access-identity-provider
   */
  reference_id?: string | null;
}

export interface IntegrationUpdateParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param: Whether this integration is enabled. If disabled, no risk changes
   * will be exported to the third-party.
   */
  active: boolean;

  /**
   * Body param: The base url of the tenant, e.g. "https://tenant.okta.com".
   */
  tenant_url: string;

  /**
   * Body param: A reference id that can be supplied by the client. Currently this
   * should be set to the Access-Okta IDP ID (a UUIDv4).
   * https://developers.cloudflare.com/api/operations/access-identity-providers-get-an-access-identity-provider
   */
  reference_id?: string | null;
}

export interface IntegrationListParams {
  account_id: string;
}

export interface IntegrationDeleteParams {
  account_id: string;
}

export interface IntegrationGetParams {
  account_id: string;
}

Integrations.IntegrationListResponsesSinglePage = IntegrationListResponsesSinglePage;
Integrations.References = References;

export declare namespace Integrations {
  export {
    type IntegrationCreateResponse as IntegrationCreateResponse,
    type IntegrationUpdateResponse as IntegrationUpdateResponse,
    type IntegrationListResponse as IntegrationListResponse,
    type IntegrationDeleteResponse as IntegrationDeleteResponse,
    type IntegrationGetResponse as IntegrationGetResponse,
    IntegrationListResponsesSinglePage as IntegrationListResponsesSinglePage,
    type IntegrationCreateParams as IntegrationCreateParams,
    type IntegrationUpdateParams as IntegrationUpdateParams,
    type IntegrationListParams as IntegrationListParams,
    type IntegrationDeleteParams as IntegrationDeleteParams,
    type IntegrationGetParams as IntegrationGetParams,
  };

  export {
    References as References,
    type ReferenceGetResponse as ReferenceGetResponse,
    type ReferenceGetParams as ReferenceGetParams,
  };
}
