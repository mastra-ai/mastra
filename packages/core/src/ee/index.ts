/**
 * @mastra/core/ee
 *
 * Enterprise authentication capabilities for Mastra.
 *
 * @packageDocumentation
 */

// Interfaces
export * from './interfaces';

// Base Auth Provider
export { MastraAuthProvider, type MastraAuthProviderConfig, type CapabilityFlags } from './auth-provider';

// Capabilities
export * from './capabilities';

// License
export { validateLicense, isEELicenseValid, isFeatureEnabled, type LicenseInfo } from './license';

// Wrapper
export { withEE, type WithEEOptions, type EEAuthProvider } from './with-ee';

// Default implementations
export * from './defaults';
