/**
 * Default request-context schema attached to every stored agent created through
 * the Agent Builder. Describes a single `user` request-context variable whose
 * shape mirrors `CurrentUser` from `@/domains/auth/types`:
 *
 *   { id: string; email?; name?; avatarUrl?; roles?: string[]; permissions?: string[] } | null
 *
 * This constant is set once at create-time and never touched by the save/
 * autosave path, so subsequent builder edits do not clobber user-provided
 * schemas in the future.
 */
export const DEFAULT_BUILDER_REQUEST_CONTEXT_SCHEMA = {
  type: 'object',
  properties: {
    user: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        email: { type: 'string' },
        name: { type: 'string' },
        avatarUrl: { type: 'string' },
        roles: { type: 'array', items: { type: 'string' } },
        permissions: { type: 'array', items: { type: 'string' } },
      },
      required: ['id'],
    },
    required: ['user'],
  },
} as const satisfies Record<string, unknown>;
