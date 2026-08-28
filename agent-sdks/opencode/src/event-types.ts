import type { Event, Part } from '@opencode-ai/sdk/v2';

/**
 * Named symbols for the `Event`/`Part` discriminant strings this package
 * actually switches on, checked against the SDK's own union types via
 * `satisfies` — a typo or an SDK rename fails the build instead of silently
 * falling through a `switch`/`if` chain. The SDK itself ships no runtime
 * enum for these, only string-literal types, so this is the closest
 * equivalent.
 *
 * Sourced from `@opencode-ai/sdk/v2` (not the default `@opencode-ai/sdk`
 * export): v2 renamed `permission.updated` to `permission.asked` and added a
 * parallel `permission.v2.*` pair alongside it. Everything else
 * (`message.*`, `session.*`, `todo.updated`, `command.executed`) kept the
 * same discriminant strings.
 */
export const OpenCodeEventType = {
  MessageUpdated: 'message.updated',
  MessageRemoved: 'message.removed',
  MessagePartUpdated: 'message.part.updated',
  MessagePartRemoved: 'message.part.removed',
  /**
   * v2 split streamed text deltas out of `message.part.updated` (which now
   * only carries the accumulated `part` snapshot) into this dedicated event.
   */
  MessagePartDelta: 'message.part.delta',
  PermissionAsked: 'permission.asked',
  PermissionReplied: 'permission.replied',
  PermissionV2Asked: 'permission.v2.asked',
  PermissionV2Replied: 'permission.v2.replied',
  SessionStatus: 'session.status',
  SessionIdle: 'session.idle',
  SessionCompacted: 'session.compacted',
  TodoUpdated: 'todo.updated',
  CommandExecuted: 'command.executed',
  SessionCreated: 'session.created',
  SessionUpdated: 'session.updated',
  SessionDeleted: 'session.deleted',
  SessionDiff: 'session.diff',
  SessionError: 'session.error',
} as const satisfies Record<string, Event['type']>;

export const OpenCodePartType = {
  Text: 'text',
  Tool: 'tool',
  Subtask: 'subtask',
} as const satisfies Record<string, Part['type']>;
