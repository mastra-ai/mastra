/**
 * @mastra/core/auth
 *
 * Enterprise authentication capabilities for Mastra.
 *
 * @packageDocumentation
 */

// Interfaces
export * from './interfaces';

// Capabilities
export * from './capabilities';

// License
export { validateLicense, isLicenseValid, isEELicenseValid, isFeatureEnabled, type LicenseInfo } from './license';

// Default implementations
export * from './defaults';
