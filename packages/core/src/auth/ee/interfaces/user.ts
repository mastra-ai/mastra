/**
 * Enterprise user type for EE authentication.
 * Extends the base User type with enterprise-specific fields.
 *
 * @license Mastra Enterprise License - see ee/LICENSE
 */

import type { User } from '../../interfaces/user';

/**
 * Enterprise user type with additional metadata.
 *
 * Extends the base `User` type with fields commonly needed
 * for RBAC, ACL, and organizational features.
 */
export interface EEUser extends User {
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}
