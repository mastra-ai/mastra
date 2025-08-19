import { BaseResource } from './base';
import type { ClientOptions, TemplateInstallationRequest, TemplateInstallationResult } from '../types';

/**
 * Templates resource: operations related to template management via server endpoints.
 */
export class Templates extends BaseResource {
  constructor(options: ClientOptions) {
    super(options);
  }

  /**
   * Installs a template on the server side.
   * This calls the server endpoint `/api/templates/install`.
   */
  install(params: TemplateInstallationRequest): Promise<TemplateInstallationResult> {
    return this.request(`/api/templates/install`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: params,
    });
  }
}
