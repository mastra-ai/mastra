// Main storage class
export { PrismaStore } from './storage';
export type { PrismaStoreConfig } from './storage';

// Prisma client utilities
export { createPrismaClient, disconnectPrisma } from './client';
export type { PrismaConfig } from './client';

// Re-export Prisma types for consumers
export type {
  // Models
  WorkflowSnapshot,
  Thread,
  Message,
  AISpan,
  Trace,
  Scorer,
  Eval,
  Resource,

  // Prisma utilities
  Prisma,
  PrismaClient,
} from '@prisma/client';

// Re-export specific Prisma namespace types that are commonly used
export type {
  // Input types for creating/updating
  Prisma as PrismaTypes,
} from '@prisma/client';