import { RunFenceConflictError, TABLE_MEMORY_RUN_FENCES, TABLE_WORKFLOW_RUN_OWNERS } from '@mastra/core/storage';
import type {
  ClaimRunOwnershipInput,
  ClaimRunOwnershipResult,
  RenewRunOwnershipInput,
  RenewRunOwnershipResult,
  RunFence,
  RunOwnershipRecord,
} from '@mastra/core/storage';

import type { ValkeyClient } from '../types';

/** Table holding a run's current claim: its ownership hash (workflows) or raised fence (memory). */
export type RunClaimTable = typeof TABLE_WORKFLOW_RUN_OWNERS | typeof TABLE_MEMORY_RUN_FENCES;

/** A write's fence, and the table holding the run's current claim to check it against. */
export interface RunFenceCheck {
  claims: RunClaimTable;
  fence: RunFence;
  operation: string;
}

/** The subset of a MULTI transaction the domains write through. */
export interface WriteBatch {
  set(key: string, value: string): unknown;
  del(key: string): unknown;
  zAdd(key: string, member: { score: number; value: string }): unknown;
  zRem(key: string, member: string): unknown;
  exec(): Promise<unknown>;
}

export function runClaimKey(claims: RunClaimTable, runId: string): string {
  return `${claims}:run_id:${runId}`;
}

// A run's claim is a hash of generation, ownerId and, while leased,
// leaseExpiresAt. Every script reads and writes it in one atomic step, and
// leases are measured on the store's clock.
const LIB = `
local function now()
  local t = redis.call('TIME')
  return tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)
end
local function owner(flag, t)
  local r = redis.call('HMGET', KEYS[1], 'generation', 'ownerId', 'leaseExpiresAt')
  return { flag, r[1], r[2], r[3], t }
end
`;

// ARGV: ownerId, leaseMs, force ('1' or '0'), expectedGeneration ('' when unset)
const CLAIM = `${LIB}
local t = now()
local lease = string.format('%d', t + tonumber(ARGV[2]))
local generation = tonumber(redis.call('HGET', KEYS[1], 'generation'))
local expected = ARGV[4]
if not generation then
  if expected ~= '' and expected ~= '0' then return owner(0, t) end
  redis.call('HSET', KEYS[1], 'generation', '1', 'ownerId', ARGV[1], 'leaseExpiresAt', lease)
  return owner(1, t)
end
if expected ~= '' and generation ~= tonumber(expected) then return owner(0, t) end
if ARGV[3] ~= '1' then
  local expires = tonumber(redis.call('HGET', KEYS[1], 'leaseExpiresAt'))
  if expires and expires > t then return owner(0, t) end
end
redis.call('HSET', KEYS[1], 'generation', string.format('%d', generation + 1), 'ownerId', ARGV[1], 'leaseExpiresAt', lease)
return owner(1, t)
`;

// ARGV: generation, ownerId, leaseMs
const RENEW = `${LIB}
local t = now()
local r = redis.call('HMGET', KEYS[1], 'generation', 'ownerId', 'leaseExpiresAt')
if tonumber(r[1]) ~= tonumber(ARGV[1]) or r[2] ~= ARGV[2] or not r[3] then return owner(0, t) end
redis.call('HSET', KEYS[1], 'leaseExpiresAt', string.format('%d', t + tonumber(ARGV[3])))
return owner(1, t)
`;

// ARGV: generation, ownerId
const RELEASE = `
local r = redis.call('HMGET', KEYS[1], 'generation', 'ownerId')
if tonumber(r[1]) ~= tonumber(ARGV[1]) or r[2] ~= ARGV[2] then return 0 end
redis.call('HDEL', KEYS[1], 'leaseExpiresAt')
return 1
`;

const READ = `${LIB}
return owner(1, now())
`;

// ARGV: generation, ownerId
const RAISE = `
local r = redis.call('HMGET', KEYS[1], 'generation', 'ownerId')
local current = tonumber(r[1])
if not current or current < tonumber(ARGV[1]) then
  redis.call('HSET', KEYS[1], 'generation', ARGV[1], 'ownerId', ARGV[2])
  return 1
end
if current == tonumber(ARGV[1]) and r[2] == ARGV[2] then return 1 end
return 0
`;

// ARGV: generation, ownerId, then each command as its argument count followed by its arguments
const FENCED_WRITE = `
local r = redis.call('HMGET', KEYS[1], 'generation', 'ownerId')
if tonumber(r[1]) ~= tonumber(ARGV[1]) or r[2] ~= ARGV[2] then return 0 end
local i = 3
while i <= #ARGV do
  local n = tonumber(ARGV[i])
  redis.call(unpack(ARGV, i + 1, i + n))
  i = i + n + 1
end
return 1
`;

type OwnerReply = [number, string | null, string | null, string | null, number];

function evalScript(client: ValkeyClient, script: string, keys: string[], args: string[]): Promise<unknown> {
  return client.eval(script, { keys, arguments: args });
}

function toRunOwnershipRecord(runId: string, reply: OwnerReply): RunOwnershipRecord | null {
  const [, generation, ownerId, leaseExpiresAt, now] = reply;
  if (generation === null) return null;
  const expiresAt = leaseExpiresAt === null ? null : Number(leaseExpiresAt);
  return {
    runId,
    generation: Number(generation),
    ownerId: String(ownerId),
    leaseExpiresAt: expiresAt === null ? null : new Date(expiresAt),
    live: expiresAt !== null && expiresAt > Number(now),
  };
}

async function evalOwner(
  client: ValkeyClient,
  script: string,
  runId: string,
  args: string[],
): Promise<{ applied: boolean; record: RunOwnershipRecord | null }> {
  const reply = (await evalScript(client, script, [runClaimKey(TABLE_WORKFLOW_RUN_OWNERS, runId)], args)) as OwnerReply;
  return { applied: Number(reply[0]) === 1, record: toRunOwnershipRecord(runId, reply) };
}

export async function claimRunOwnership(
  client: ValkeyClient,
  { runId, ownerId, leaseMs, force, expectedGeneration }: ClaimRunOwnershipInput,
): Promise<ClaimRunOwnershipResult> {
  const { applied, record } = await evalOwner(client, CLAIM, runId, [
    ownerId,
    String(leaseMs),
    force ? '1' : '0',
    expectedGeneration === undefined ? '' : String(expectedGeneration),
  ]);
  return applied ? { acquired: true, record: record! } : { acquired: false, record };
}

export async function renewRunOwnership(
  client: ValkeyClient,
  { leaseMs, ...fence }: RenewRunOwnershipInput,
): Promise<RenewRunOwnershipResult> {
  const { applied, record } = await evalOwner(client, RENEW, fence.runId, [
    String(fence.generation),
    fence.ownerId,
    String(leaseMs),
  ]);
  return applied ? { renewed: true, record: record! } : { renewed: false, record };
}

export async function releaseRunOwnership(client: ValkeyClient, fence: RunFence): Promise<boolean> {
  const released = await evalScript(
    client,
    RELEASE,
    [runClaimKey(TABLE_WORKFLOW_RUN_OWNERS, fence.runId)],
    [String(fence.generation), fence.ownerId],
  );
  return Number(released) === 1;
}

export async function getRunOwnership(client: ValkeyClient, runId: string): Promise<RunOwnershipRecord | null> {
  return (await evalOwner(client, READ, runId, [])).record;
}

export async function raiseRunFence(client: ValkeyClient, fence: RunFence): Promise<boolean> {
  const raised = await evalScript(
    client,
    RAISE,
    [runClaimKey(TABLE_MEMORY_RUN_FENCES, fence.runId)],
    [String(fence.generation), fence.ownerId],
  );
  return Number(raised) === 1;
}

/**
 * Collects writes and applies them in one script that first checks the run's
 * claim against the fence. A fence that is no longer current makes `exec()`
 * throw `RunFenceConflictError` without writing anything. Scripts run
 * atomically, so a takeover lands either before the batch (failing its check)
 * or after it.
 */
class FencedWriteBatch implements WriteBatch {
  readonly #keys = new Set<string>();
  readonly #args: string[] = [];

  constructor(
    private readonly client: ValkeyClient,
    private readonly check: RunFenceCheck,
  ) {}

  #add(key: string, ...command: string[]): this {
    this.#keys.add(key);
    this.#args.push(String(command.length), ...command);
    return this;
  }

  set(key: string, value: string) {
    return this.#add(key, 'SET', key, value);
  }

  del(key: string) {
    return this.#add(key, 'DEL', key);
  }

  zAdd(key: string, { score, value }: { score: number; value: string }) {
    return this.#add(key, 'ZADD', key, String(score), value);
  }

  zRem(key: string, member: string) {
    return this.#add(key, 'ZREM', key, member);
  }

  async exec(): Promise<void> {
    const { claims, fence, operation } = this.check;
    const applied = await evalScript(
      this.client,
      FENCED_WRITE,
      [runClaimKey(claims, fence.runId), ...this.#keys],
      [String(fence.generation), fence.ownerId, ...this.#args],
    );
    if (Number(applied) !== 1) throw new RunFenceConflictError(fence, operation);
  }
}

/** A MULTI transaction, or a fenced batch when `check` is set. */
export function writeBatch(client: ValkeyClient, check: RunFenceCheck | undefined): WriteBatch {
  return check ? new FencedWriteBatch(client, check) : client.multi();
}

/**
 * Rejects a fenced write that turns out to have nothing to write when its
 * fence is no longer current, as the write itself would have been rejected.
 */
export async function assertRunFence(client: ValkeyClient, check: RunFenceCheck | undefined): Promise<void> {
  if (check) await new FencedWriteBatch(client, check).exec();
}
