import { RunFenceConflictError, TABLE_MEMORY_RUN_FENCES, TABLE_WORKFLOW_RUN_OWNERS } from '@mastra/core/storage';
import type {
  ClaimRunOwnershipInput,
  ClaimRunOwnershipResult,
  RenewRunOwnershipInput,
  RenewRunOwnershipResult,
  RunFence,
  RunOwnershipRecord,
} from '@mastra/core/storage';
import type { Redis } from '@upstash/redis';

/** Table holding a run's current claim: its ownership hash (workflows) or raised fence (memory). */
export type RunClaimTable = typeof TABLE_WORKFLOW_RUN_OWNERS | typeof TABLE_MEMORY_RUN_FENCES;

/** A write's fence, and the table holding the run's current claim to check it against. */
export interface RunFenceCheck {
  claims: RunClaimTable;
  fence: RunFence;
  operation: string;
}

/** The subset of a pipeline the domains write through. */
export interface WriteBatch {
  set(key: string, value: unknown): unknown;
  del(key: string): unknown;
  zadd(key: string, member: { score: number; member: string }): unknown;
  zrem(key: string, member: string): unknown;
  exec(): Promise<unknown>;
}

export function runClaimKey(claims: RunClaimTable, runId: string): string {
  return `${claims}:run_id:${runId}`;
}

// Returned by a fenced script whose fence is stale. JSON.parse rejects it, so
// it reaches the caller as this exact string with or without automatic
// deserialization.
const RUN_FENCE_CONFLICT = 'MASTRA_RUN_FENCE_CONFLICT';

// Prepended to a script to reject it unless the run's claim matches the fence.
// The claim key is the last KEYS entry and the fence the last two ARGV
// entries, so the script's own KEYS and ARGV indices are unchanged.
const FENCE_GUARD = `
local fenceClaim = redis.call('HMGET', KEYS[#KEYS], 'generation', 'ownerId')
if tonumber(fenceClaim[1]) ~= tonumber(ARGV[#ARGV - 1]) or fenceClaim[2] ~= ARGV[#ARGV] then
  return '${RUN_FENCE_CONFLICT}'
end
`;

// A run's claim is a hash of generation, ownerId and, while leased,
// leaseExpiresAt. Every script reads and writes it in one atomic step. Leases
// are measured on the caller's clock: Upstash does not document TIME inside
// scripts, and skew between callers only delays or hastens takeover, while the
// generation check keeps stale writers out either way.
//
// Replies are JSON-encoded in the script so that automatic deserialization
// parses them once, rather than coercing each element (an ownerId of "123"
// would otherwise come back as a number).
const OWNER = `
local function owner(flag)
  local r = redis.call('HMGET', KEYS[1], 'generation', 'ownerId', 'leaseExpiresAt')
  return cjson.encode({ flag, r[1], r[2], r[3] })
end
`;

// ARGV: ownerId, force ('1' or '0'), expectedGeneration ('' when unset), now, leaseExpiresAt
const CLAIM = `${OWNER}
local generation = tonumber(redis.call('HGET', KEYS[1], 'generation'))
local expected = ARGV[3]
if not generation then
  if expected ~= '' and expected ~= '0' then return owner(0) end
  redis.call('HSET', KEYS[1], 'generation', '1', 'ownerId', ARGV[1], 'leaseExpiresAt', ARGV[5])
  return owner(1)
end
if expected ~= '' and generation ~= tonumber(expected) then return owner(0) end
if ARGV[2] ~= '1' then
  local expires = tonumber(redis.call('HGET', KEYS[1], 'leaseExpiresAt'))
  if expires and expires > tonumber(ARGV[4]) then return owner(0) end
end
redis.call('HSET', KEYS[1], 'generation', string.format('%d', generation + 1), 'ownerId', ARGV[1], 'leaseExpiresAt', ARGV[5])
return owner(1)
`;

// ARGV: generation, ownerId, leaseExpiresAt
const RENEW = `${OWNER}
local r = redis.call('HMGET', KEYS[1], 'generation', 'ownerId', 'leaseExpiresAt')
if tonumber(r[1]) ~= tonumber(ARGV[1]) or r[2] ~= ARGV[2] or not r[3] then return owner(0) end
redis.call('HSET', KEYS[1], 'leaseExpiresAt', ARGV[3])
return owner(1)
`;

// ARGV: generation, ownerId
const RELEASE = `
local r = redis.call('HMGET', KEYS[1], 'generation', 'ownerId')
if tonumber(r[1]) ~= tonumber(ARGV[1]) or r[2] ~= ARGV[2] then return 0 end
redis.call('HDEL', KEYS[1], 'leaseExpiresAt')
return 1
`;

const READ = `${OWNER}
return owner(1)
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

// Run after FENCE_GUARD. ARGV: each command as its argument count followed by
// its arguments, then the fence.
const FENCED_WRITE = `
local i = 1
while i <= #ARGV - 2 do
  local n = tonumber(ARGV[i])
  redis.call(unpack(ARGV, i + 1, i + n))
  i = i + n + 1
end
return 1
`;

/**
 * Runs `script`, first checking the run's claim against `check`'s fence in
 * the same script when `check` is set. A stale fence throws
 * `RunFenceConflictError` before the script does anything.
 */
export async function evalFenced(
  client: Redis,
  script: string,
  keys: string[],
  args: string[],
  check: RunFenceCheck | undefined,
): Promise<unknown> {
  if (!check) return client.eval(script, keys, args);
  const { claims, fence, operation } = check;
  const result = await client.eval(
    FENCE_GUARD + script,
    [...keys, runClaimKey(claims, fence.runId)],
    [...args, String(fence.generation), fence.ownerId],
  );
  if (result === RUN_FENCE_CONFLICT) throw new RunFenceConflictError(fence, operation);
  return result;
}

type OwnerReply = [number, string | false | null, string | false | null, string | false | null];

function toRunOwnershipRecord(runId: string, reply: OwnerReply, now: number): RunOwnershipRecord | null {
  const [, generation, ownerId, leaseExpiresAt] = reply;
  if (!generation) return null;
  const expiresAt = leaseExpiresAt ? Number(leaseExpiresAt) : null;
  return {
    runId,
    generation: Number(generation),
    ownerId: String(ownerId),
    leaseExpiresAt: expiresAt === null ? null : new Date(expiresAt),
    live: expiresAt !== null && expiresAt > now,
  };
}

async function evalOwner(
  client: Redis,
  script: string,
  runId: string,
  args: string[],
  now: number,
): Promise<{ applied: boolean; record: RunOwnershipRecord | null }> {
  const raw = await client.eval(script, [runClaimKey(TABLE_WORKFLOW_RUN_OWNERS, runId)], args);
  const reply = (typeof raw === 'string' ? JSON.parse(raw) : raw) as OwnerReply;
  return { applied: Number(reply[0]) === 1, record: toRunOwnershipRecord(runId, reply, now) };
}

export async function claimRunOwnership(
  client: Redis,
  { runId, ownerId, leaseMs, force, expectedGeneration }: ClaimRunOwnershipInput,
): Promise<ClaimRunOwnershipResult> {
  const now = Date.now();
  const { applied, record } = await evalOwner(
    client,
    CLAIM,
    runId,
    [
      ownerId,
      force ? '1' : '0',
      expectedGeneration === undefined ? '' : String(expectedGeneration),
      String(now),
      String(now + leaseMs),
    ],
    now,
  );
  return applied ? { acquired: true, record: record! } : { acquired: false, record };
}

export async function renewRunOwnership(
  client: Redis,
  { leaseMs, ...fence }: RenewRunOwnershipInput,
): Promise<RenewRunOwnershipResult> {
  const now = Date.now();
  const { applied, record } = await evalOwner(
    client,
    RENEW,
    fence.runId,
    [String(fence.generation), fence.ownerId, String(now + leaseMs)],
    now,
  );
  return applied ? { renewed: true, record: record! } : { renewed: false, record };
}

export async function releaseRunOwnership(client: Redis, fence: RunFence): Promise<boolean> {
  const released = await client.eval(
    RELEASE,
    [runClaimKey(TABLE_WORKFLOW_RUN_OWNERS, fence.runId)],
    [String(fence.generation), fence.ownerId],
  );
  return Number(released) === 1;
}

export async function getRunOwnership(client: Redis, runId: string): Promise<RunOwnershipRecord | null> {
  return (await evalOwner(client, READ, runId, [], Date.now())).record;
}

export async function raiseRunFence(client: Redis, fence: RunFence): Promise<boolean> {
  const raised = await client.eval(
    RAISE,
    [runClaimKey(TABLE_MEMORY_RUN_FENCES, fence.runId)],
    [String(fence.generation), fence.ownerId],
  );
  return Number(raised) === 1;
}

// Matches @upstash/redis's default serializer, so a fenced write stores the
// same value a pipeline would.
function serialize(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
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
    private readonly client: Redis,
    private readonly check: RunFenceCheck,
  ) {}

  #add(key: string, ...command: string[]): this {
    this.#keys.add(key);
    this.#args.push(String(command.length), ...command);
    return this;
  }

  set(key: string, value: unknown) {
    return this.#add(key, 'SET', key, serialize(value));
  }

  del(key: string) {
    return this.#add(key, 'DEL', key);
  }

  zadd(key: string, { score, member }: { score: number; member: string }) {
    return this.#add(key, 'ZADD', key, String(score), member);
  }

  zrem(key: string, member: string) {
    return this.#add(key, 'ZREM', key, member);
  }

  async exec(): Promise<void> {
    await evalFenced(this.client, FENCED_WRITE, [...this.#keys], this.#args, this.check);
  }
}

/** A pipeline, or a fenced batch when `check` is set. */
export function writeBatch(client: Redis, check: RunFenceCheck | undefined): WriteBatch {
  return check ? new FencedWriteBatch(client, check) : client.pipeline();
}

/**
 * Rejects a fenced write that turns out to have nothing to write when its
 * fence is no longer current, as the write itself would have been rejected.
 */
export async function assertRunFence(client: Redis, check: RunFenceCheck | undefined): Promise<void> {
  if (check) await new FencedWriteBatch(client, check).exec();
}
