/**
 * ID Generator utilities for Mastra
 *
 * This module provides a thin wrapper around Vercel AI SDK's ID generation
 * capabilities, allowing for consistent ID generation across the Mastra ecosystem.
 *
 * Usage patterns:
 * 1. Default: import { generateId } from 'ai'
 * 2. Prefixed: import { createIdGenerator } from 'ai'; const gen = createIdGenerator({ prefix: 'msg' })
 * 3. Custom: Configure custom generator in Mastra config for special algorithms (ULID, etc.)
 */

// Re-export Vercel AI SDK's ID generation utilities
export { generateId, createIdGenerator } from 'ai';
export type { IdGenerator } from 'ai';
