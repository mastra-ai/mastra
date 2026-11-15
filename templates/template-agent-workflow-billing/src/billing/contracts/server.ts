import type { ArtifactReader } from './artifacts.js';
import type { OrganizationService } from '../organizations.js';
import type { CommercialService } from '../runtime/commercial.js';
import type { BillingHttpGateway } from '../mastra.js';

/** Services shared by the HTTP router and Mastra server boundary. */
export interface BillingServerOptions {
  /** Authenticate credentials and enforce current workspace membership. */
  readonly organizations: OrganizationService;
  /** Execute agents and workflows through the billing facade. */
  readonly execution?: BillingHttpGateway;
  /** Read balances and open owner-authorized checkout or portal sessions. */
  readonly commercial?: CommercialService;
  /** Authorize and retrieve private artifacts after positive settlement. */
  readonly artifacts?: ArtifactReader;
  /** Explicit native resources or custom application routes outside billing protection. */
  readonly nativeAccess?: (path: string, method?: string) => boolean;
  /** Whether unwrapped resources require native routes alongside the billing gateway. */
  readonly allowNative?: boolean;
}
