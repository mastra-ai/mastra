/**
 * @mastra/core/auth/ee
 *
 * Enterprise authentication capabilities for Mastra.
 * This code is licensed under the Mastra Enterprise License - see ee/LICENSE.
 *
 * @license Mastra Enterprise License - see ee/LICENSE
 * @packageDocumentation
 */

// EE Interfaces
export * from './interfaces';

// Capabilities
export * from './capabilities';

// License
export {
  validateLicense,
  isLicenseValid,
  isEELicenseValid,
  isFeatureEnabled,
  isDevEnvironment,
  isEEEnabled,
  clearLicenseCache,
  type LicenseInfo,
} from './license';

// FGA check utility
export {
  checkFGA,
  requireFGA,
  FGADeniedError,
  getAgentFGAResourceId,
  getWorkflowFGAResourceId,
  getStandaloneToolFGAResourceId,
  getAgentToolFGAResourceId,
  getMCPToolFGAResourceId,
  type CheckFGAOptions,
  type RequireFGAOptions,
} from './fga-check';

// Default implementations
export * from './defaults';
