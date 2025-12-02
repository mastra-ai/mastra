// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';

export class Settings extends APIResource {
  /**
   * Patch Universal SSL Settings for a Zone.
   *
   * @example
   * ```ts
   * const universalSSLSettings =
   *   await client.ssl.universal.settings.edit({
   *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *   });
   * ```
   */
  edit(params: SettingEditParams, options?: Core.RequestOptions): Core.APIPromise<UniversalSSLSettings> {
    const { zone_id, ...body } = params;
    return (
      this._client.patch(`/zones/${zone_id}/ssl/universal/settings`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: UniversalSSLSettings }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Get Universal SSL Settings for a Zone.
   *
   * @example
   * ```ts
   * const universalSSLSettings =
   *   await client.ssl.universal.settings.get({
   *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
   *   });
   * ```
   */
  get(params: SettingGetParams, options?: Core.RequestOptions): Core.APIPromise<UniversalSSLSettings> {
    const { zone_id } = params;
    return (
      this._client.get(`/zones/${zone_id}/ssl/universal/settings`, options) as Core.APIPromise<{
        result: UniversalSSLSettings;
      }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export interface UniversalSSLSettings {
  /**
   * Disabling Universal SSL removes any currently active Universal SSL certificates
   * for your zone from the edge and prevents any future Universal SSL certificates
   * from being ordered. If there are no advanced certificates or custom certificates
   * uploaded for the domain, visitors will be unable to access the domain over
   * HTTPS.
   *
   * By disabling Universal SSL, you understand that the following Cloudflare
   * settings and preferences will result in visitors being unable to visit your
   * domain unless you have uploaded a custom certificate or purchased an advanced
   * certificate.
   *
   * - HSTS
   * - Always Use HTTPS
   * - Opportunistic Encryption
   * - Onion Routing
   * - Any Page Rules redirecting traffic to HTTPS
   *
   * Similarly, any HTTP redirect to HTTPS at the origin while the Cloudflare proxy
   * is enabled will result in users being unable to visit your site without a valid
   * certificate at Cloudflare's edge.
   *
   * If you do not have a valid custom or advanced certificate at Cloudflare's edge
   * and are unsure if any of the above Cloudflare settings are enabled, or if any
   * HTTP redirects exist at your origin, we advise leaving Universal SSL enabled for
   * your domain.
   */
  enabled?: boolean;
}

export interface SettingEditParams {
  /**
   * Path param: Identifier.
   */
  zone_id: string;

  /**
   * Body param: Disabling Universal SSL removes any currently active Universal SSL
   * certificates for your zone from the edge and prevents any future Universal SSL
   * certificates from being ordered. If there are no advanced certificates or custom
   * certificates uploaded for the domain, visitors will be unable to access the
   * domain over HTTPS.
   *
   * By disabling Universal SSL, you understand that the following Cloudflare
   * settings and preferences will result in visitors being unable to visit your
   * domain unless you have uploaded a custom certificate or purchased an advanced
   * certificate.
   *
   * - HSTS
   * - Always Use HTTPS
   * - Opportunistic Encryption
   * - Onion Routing
   * - Any Page Rules redirecting traffic to HTTPS
   *
   * Similarly, any HTTP redirect to HTTPS at the origin while the Cloudflare proxy
   * is enabled will result in users being unable to visit your site without a valid
   * certificate at Cloudflare's edge.
   *
   * If you do not have a valid custom or advanced certificate at Cloudflare's edge
   * and are unsure if any of the above Cloudflare settings are enabled, or if any
   * HTTP redirects exist at your origin, we advise leaving Universal SSL enabled for
   * your domain.
   */
  enabled?: boolean;
}

export interface SettingGetParams {
  /**
   * Identifier.
   */
  zone_id: string;
}

export declare namespace Settings {
  export {
    type UniversalSSLSettings as UniversalSSLSettings,
    type SettingEditParams as SettingEditParams,
    type SettingGetParams as SettingGetParams,
  };
}
