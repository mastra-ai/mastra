import { z } from 'zod';

export const SESSION_ROW_WINDOW = 5;
export const SESSION_ROW_WINDOW_MAX = 500;
export const SESSION_ROW_PINS_MAX = 100;
export const SESSION_ROW_WINDOWS_MAX = 64;

export const SESSION_ROW_STATUSES = ['waiting', 'working', 'initializing', 'idle', 'done'] as const;
export const SESSION_ROW_SORTS = ['activity', 'updated', 'created'] as const;
export const SESSION_ROW_GROUP_BYS = ['board', 'status', 'owner', 'none'] as const;
export const SESSION_ROW_UPDATED_WITHIN = ['24h', '7d', '30d'] as const;
export const SESSION_ROW_ALL_OWNERS = 'all';
export const SESSION_ROW_MY_SESSIONS = 'mine';
const SESSION_ROW_OWNER_PREFIX = 'owner:';

export function sessionRowOwnerKey(userId: string): string {
  return `${SESSION_ROW_OWNER_PREFIX}${userId}`;
}

export const sessionRowGroupKeys = {
  board: (boardId: string) => `board:${boardId}`,
  user: 'user',
  slack: 'slack',
  status: (status: (typeof SESSION_ROW_STATUSES)[number]) => `status:${status}`,
  owner: sessionRowOwnerKey,
  all: 'all',
} as const;

export const sessionRowOwnerSchema = z.union([
  z.enum([SESSION_ROW_ALL_OWNERS, SESSION_ROW_MY_SESSIONS]),
  z
    .string()
    .regex(new RegExp(`^${SESSION_ROW_OWNER_PREFIX}.+$`))
    .max(512),
]);
