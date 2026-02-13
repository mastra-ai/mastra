import type { ContextWithMastra } from '@mastra/core/server';
import {
  canAccessPublicly,
  checkRules,
  defaultAuthConfig,
  isDevPlaygroundRequest,
  isProtectedPath,
} from '@mastra/server/auth';
import { Elysia } from 'elysia';

