// Public configuration compatibility facade. Provider-neutral policy and
// capability constraints live in configuration-schema; shipped Polar input is
// normalized and validated at the explicit provider compatibility boundary.
export { billingPolicySchema, localAccountSeedSchema, freezeConfiguration } from './configuration-schema.js';
export type { LocalAccountSeed } from './configuration-schema.js';
export {
  compatibleConfigurationSchema as billingConfigurationSchema,
  parseCompatibleConfiguration as parseBillingConfiguration,
} from './providers/polar-compatibility.js';
import type { parseCompatibleConfiguration } from './providers/polar-compatibility.js';
export type BillingConfiguration = ReturnType<typeof parseCompatibleConfiguration>;
