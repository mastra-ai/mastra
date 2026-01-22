/**
 * Workspace Types
 *
 * Shared types for the workspace module to avoid circular dependencies.
 */

// =============================================================================
// Status Types
// =============================================================================

export type WorkspaceStatus = 'pending' | 'initializing' | 'ready' | 'paused' | 'error' | 'destroying' | 'destroyed';
