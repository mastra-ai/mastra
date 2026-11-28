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
  /**
   * Guards a key's raw value until the batch applies: `value` is the bytes the caller read and
   * decided on, or `null` when the key must still be absent. A batch that cannot honour a guard
   * applies nothing and `exec()` throws {@link WritePreconditionError}, so the caller re-reads and
   * re-decides rather than overwriting or deleting bytes it never saw. Needs a guarded batch
   * ({@link guardedWriteBatch}); a plain MULTI cannot check it.
   */
  expect(key: string, value: string | null): unknown;
  exec(): Promise<unknown>;
}

/** A guarded key changed since the batch was planned: the caller must re-read and re-decide. */
export class WritePreconditionError extends Error {
  constructor() {
    super('Write precondition failed: a guarded key changed since the batch was planned');
    this.name = 'WritePreconditionError';
  }
}

/**
 * A claim expires after this long without a claim, renewal or release, and a
 * fence this long after it was retired. A running execution renews every few
 * seconds, and a raised fence never expires. Expiring is safe: a later claim's
 * generation comes from the clock, so it still outranks every fence the expired
 * record issued, and a write checked against a missing record is rejected.
 */
export const RUN_CLAIM_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export function runClaimKey(claims: RunClaimTable, runId: string): string {
  return `${claims}:run_id:${runId}`;
}

// A run's claim is a hash of generation, ownerId, updatedAt and, while
// leased, leaseExpiresAt. A raised fence also holds retiredAt once retired.
// Every script reads and writes it in one atomic step, and leases and
// timestamps are measured on the store's clock.
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

// ARGV: ownerId, leaseMs, force ('1' or '0'), expectedGeneration ('' when unset), retentionMs
const CLAIM = `${LIB}
local t = now()
local stamp = string.format('%d', t)
local lease = string.format('%d', t + tonumber(ARGV[2]))
local generation = tonumber(redis.call('HGET', KEYS[1], 'generation'))
local expected = ARGV[4]
if not generation then
  if expected ~= '' and expected ~= '0' then return owner(0, t) end
  -- The first generation comes from the store's clock, so a claim after this
  -- hash is removed still outranks a surviving fence.
  redis.call('HSET', KEYS[1], 'generation', string.format('%d', math.max(1, t)), 'ownerId', ARGV[1], 'leaseExpiresAt', lease, 'updatedAt', stamp)
  redis.call('PEXPIRE', KEYS[1], ARGV[5])
  return owner(1, t)
end
if expected ~= '' and generation ~= tonumber(expected) then return owner(0, t) end
if ARGV[3] ~= '1' then
  local expires = tonumber(redis.call('HGET', KEYS[1], 'leaseExpiresAt'))
  if expires and expires > t then return owner(0, t) end
end
redis.call('HSET', KEYS[1], 'generation', string.format('%d', generation + 1), 'ownerId', ARGV[1], 'leaseExpiresAt', lease, 'updatedAt', stamp)
redis.call('PEXPIRE', KEYS[1], ARGV[5])
return owner(1, t)
`;

// ARGV: generation, ownerId, leaseMs, retentionMs
const RENEW = `${LIB}
local t = now()
local r = redis.call('HMGET', KEYS[1], 'generation', 'ownerId', 'leaseExpiresAt')
if tonumber(r[1]) ~= tonumber(ARGV[1]) or r[2] ~= ARGV[2] or not r[3] then return owner(0, t) end
redis.call('HSET', KEYS[1], 'leaseExpiresAt', string.format('%d', t + tonumber(ARGV[3])), 'updatedAt', string.format('%d', t))
redis.call('PEXPIRE', KEYS[1], ARGV[4])
return owner(1, t)
`;

// ARGV: generation, ownerId, retentionMs
const RELEASE = `${LIB}
local t = now()
local r = redis.call('HMGET', KEYS[1], 'generation', 'ownerId')
if tonumber(r[1]) ~= tonumber(ARGV[1]) or r[2] ~= ARGV[2] then return 0 end
redis.call('HDEL', KEYS[1], 'leaseExpiresAt')
redis.call('HSET', KEYS[1], 'updatedAt', string.format('%d', t))
redis.call('PEXPIRE', KEYS[1], ARGV[3])
return 1
`;

const READ = `${LIB}
return owner(1, now())
`;

/** Single-key reads `getRunOwnerships` keeps in flight, bounding the client's pipeline. */
const READ_BATCH_SIZE = 500;

// ARGV: generation, ownerId
const RAISE = `
local r = redis.call('HMGET', KEYS[1], 'generation', 'ownerId')
local current = tonumber(r[1])
if not current or current < tonumber(ARGV[1]) then
  redis.call('HSET', KEYS[1], 'generation', ARGV[1], 'ownerId', ARGV[2])
elseif current ~= tonumber(ARGV[1]) or r[2] ~= ARGV[2] then
  return 0
end
-- Every write un-retires the fence.
redis.call('HDEL', KEYS[1], 'retiredAt')
redis.call('PERSIST', KEYS[1])
return 1
`;

// ARGV: generation, ownerId, retentionMs
const RETIRE = `${LIB}
local t = now()
local r = redis.call('HMGET', KEYS[1], 'generation', 'ownerId')
if tonumber(r[1]) ~= tonumber(ARGV[1]) or r[2] ~= ARGV[2] then return 0 end
redis.call('HSET', KEYS[1], 'retiredAt', string.format('%d', t))
redis.call('PEXPIRE', KEYS[1], ARGV[3])
return 1
`;

/** A guarded key's expected raw value when the key must still be absent. Snapshot values are JSON. */
const ABSENT = '__mastra_absent__';

// KEYS: [1] the run's claim key, or '' when the write is not fenced; [2..1+G] the guarded keys;
//       [2+G..] every key the write's commands touch.
// ARGV: [1] generation ('' when unfenced), [2] ownerId, [3] guard count G, [4..3+G] each guarded
//       key's expected raw value, then each command as its argument count followed by its arguments.
// A guard that no longer matches, or a fence that is no longer current, aborts before any command
// runs, so a rejected batch writes nothing. Returns 1 applied, 0 stale fence, -1 changed guard.
const GUARDED_WRITE = `
local guards = tonumber(ARGV[3])
if ARGV[1] ~= '' then
  local r = redis.call('HMGET', KEYS[1], 'generation', 'ownerId')
  if tonumber(r[1]) ~= tonumber(ARGV[1]) or r[2] ~= ARGV[2] then return 0 end
end
for j = 1, guards do
  local expected = ARGV[3 + j]
  local current = redis.call('GET', KEYS[1 + j])
  if expected == '${ABSENT}' then
    if current then return -1 end
  elseif current ~= expected then
    return -1
  end
end
local i = 4 + guards
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
    String(RUN_CLAIM_RETENTION_MS),
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
    String(RUN_CLAIM_RETENTION_MS),
  ]);
  return applied ? { renewed: true, record: record! } : { renewed: false, record };
}

export async function releaseRunOwnership(client: ValkeyClient, fence: RunFence): Promise<boolean> {
  const released = await evalScript(
    client,
    RELEASE,
    [runClaimKey(TABLE_WORKFLOW_RUN_OWNERS, fence.runId)],
    [String(fence.generation), fence.ownerId, String(RUN_CLAIM_RETENTION_MS)],
  );
  return Number(released) === 1;
}

export async function getRunOwnership(client: ValkeyClient, runId: string): Promise<RunOwnershipRecord | null> {
  return (await evalOwner(client, READ, runId, [])).record;
}

/**
 * The ownership records of `runIds`. Each run is its own single-key script call, so the reads stay
 * valid on a clustered server where the keys live in different hash slots; the client multiplexes
 * the {@link READ_BATCH_SIZE} calls it sends at once over its connection.
 */
export async function getRunOwnerships(
  client: ValkeyClient,
  runIds: string[],
): Promise<Map<string, RunOwnershipRecord>> {
  const records = new Map<string, RunOwnershipRecord>();
  const ids = [...new Set(runIds)];

  for (let start = 0; start < ids.length; start += READ_BATCH_SIZE) {
    const chunk = ids.slice(start, start + READ_BATCH_SIZE);
    const read = await Promise.all(chunk.map(runId => evalOwner(client, READ, runId, [])));
    chunk.forEach((runId, i) => {
      const record = read[i]!.record;
      if (record) {
        records.set(runId, record);
      }
    });
  }

  return records;
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

export async function retireRunFence(client: ValkeyClient, fence: RunFence): Promise<boolean> {
  const retired = await evalScript(
    client,
    RETIRE,
    [runClaimKey(TABLE_MEMORY_RUN_FENCES, fence.runId)],
    [String(fence.generation), fence.ownerId, String(RUN_CLAIM_RETENTION_MS)],
  );
  return Number(retired) === 1;
}

/**
 * Collects writes and applies them in one script that first checks the run's fence and then every
 * compare-and-set guard. A fence that is no longer current makes `exec()` throw
 * `RunFenceConflictError`; a guarded key that changed makes it throw {@link WritePreconditionError};
 * either way nothing is written. Scripts run atomically, so a takeover or a competing write lands
 * either before the batch (failing its check) or after it.
 */
class GuardedWriteBatch implements WriteBatch {
  readonly #keys = new Set<string>();
  readonly #args: string[] = [];
  readonly #guardedKeys: string[] = [];
  readonly #guardedValues: string[] = [];

  constructor(
    private readonly client: ValkeyClient,
    private readonly check?: RunFenceCheck,
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

  expect(key: string, value: string | null) {
    this.#guardedKeys.push(key);
    this.#guardedValues.push(value ?? ABSENT);
    return this;
  }

  async exec(): Promise<void> {
    const fence = this.check?.fence;
    const applied = await evalScript(
      this.client,
      GUARDED_WRITE,
      [fence ? runClaimKey(this.check!.claims, fence.runId) : '', ...this.#guardedKeys, ...this.#keys],
      [
        fence ? String(fence.generation) : '',
        fence ? fence.ownerId : '',
        String(this.#guardedKeys.length),
        ...this.#guardedValues,
        ...this.#args,
      ],
    );
    if (Number(applied) === 0) throw new RunFenceConflictError(this.check!.fence, this.check!.operation);
    if (Number(applied) !== 1) throw new WritePreconditionError();
  }
}

/** A plain MULTI transaction, for a write with no fence and no compare-and-set guards. */
class MultiWriteBatch implements WriteBatch {
  readonly #multi: ReturnType<ValkeyClient['multi']>;

  constructor(client: ValkeyClient) {
    this.#multi = client.multi();
  }

  set(key: string, value: string) {
    this.#multi.set(key, value);
    return this;
  }

  del(key: string) {
    this.#multi.del(key);
    return this;
  }

  zAdd(key: string, { score, value }: { score: number; value: string }) {
    this.#multi.zAdd(key, { score, value });
    return this;
  }

  zRem(key: string, member: string) {
    this.#multi.zRem(key, member);
    return this;
  }

  expect(): never {
    throw new Error('expect() needs a guarded batch; build it with guardedWriteBatch()');
  }

  exec(): Promise<unknown> {
    return this.#multi.exec();
  }
}

/** A MULTI transaction, or a fenced script batch when `check` is set. */
export function writeBatch(client: ValkeyClient, check: RunFenceCheck | undefined): WriteBatch {
  return check ? new GuardedWriteBatch(client, check) : new MultiWriteBatch(client);
}

/**
 * A batch that applies its writes, its fence check and every compare-and-set guard in one script.
 * Use it for a read-decide-write — a relocation or a delete — where the decision must be atomic
 * with the bytes it was based on: mark those bytes with `expect`, and a change to any of them
 * throws {@link WritePreconditionError} without writing, so the caller can re-read and re-decide.
 */
export function guardedWriteBatch(client: ValkeyClient, check: RunFenceCheck | undefined): WriteBatch {
  return new GuardedWriteBatch(client, check);
}

/**
 * Rejects a fenced write that turns out to have nothing to write when its
 * fence is no longer current, as the write itself would have been rejected.
 */
export async function assertRunFence(client: ValkeyClient, check: RunFenceCheck | undefined): Promise<void> {
  if (check) await new GuardedWriteBatch(client, check).exec();
}
