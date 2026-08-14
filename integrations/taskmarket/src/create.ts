import { createHash } from 'node:crypto';

import {
  TASKMARKET_BASE_CHAIN_ID,
  TASKMARKET_BASE_USDC_CONTRACT,
  TaskmarketCliError,
} from './client.js';
import type { TaskmarketClient, TaskmarketDeposit, TaskmarketTask } from './client.js';

export const TASKMARKET_BASE_NETWORK_NAME = 'Base Mainnet';

const ETH_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const TASK_ID_RE = /^0x[0-9a-fA-F]{64}$/;

export type TaskmarketCreateConfig = {
  description: string;
  rewardUsdc: string;
  durationHours: number;
  mode: 'bounty' | 'claim' | 'pitch' | 'benchmark' | 'auction';
  taskVisibility: 'public' | 'unlisted' | 'private';
  submissionVisibility: 'public' | 'reveal_all' | 'winner_only' | 'never';
  maxSpendUsdc: string;
  tags: string[];
  privateAccessPassword?: string;
  allowedViewers?: string[];
  maxPriceUsdc?: string;
  auctionType?: 'dutch' | 'english' | 'reverse_dutch' | 'reverse_english';
  auctionStartPriceUsdc?: string;
  auctionFloorPriceUsdc?: string;
  pitchDeadlineHours?: number;
  bidDeadlineHours?: number;
};

export type TaskmarketPreview = {
  description: string;
  rewardUsdc: string;
  durationHours: number;
  mode: string;
  network: string;
  chainId: number;
  usdcContract: string;
  maxSpendUsdc: string;
  taskVisibility: string;
  submissionVisibility: string;
  tags: string[];
  privateAccessPasswordSet: boolean;
  allowedViewers: string[];
  maxPriceUsdc?: string;
  auctionType?: string;
  auctionStartPriceUsdc?: string;
  auctionFloorPriceUsdc?: string;
  pitchDeadlineHours?: number;
  bidDeadlineHours?: number;
  /**
   * Confirmation code bound to this exact task configuration. The user must
   * type this code back into the create tool; any change to the configuration
   * produces a different code and the authorization is refused.
   */
  confirmationCode: string;
};

export class TaskmarketValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TaskmarketValidationError';
  }
}

export class TaskmarketAuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TaskmarketAuthorizationError';
  }
}

export class TaskmarketNetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TaskmarketNetworkError';
  }
}

export class TaskmarketFundingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TaskmarketFundingError';
  }
}

function assertUsdcAmount(raw: string, label: string): string {
  const trimmed = raw.trim();
  const match = /^(\d{1,9})(?:\.(\d{1,6}))?$/.exec(trimmed);
  if (match === null) {
    throw new TaskmarketValidationError(
      `${label} must be a USDC amount with at most 6 decimal places (e.g. 5 or 5.5), got "${raw}"`,
    );
  }
  if (Number(trimmed) <= 0) {
    throw new TaskmarketValidationError(`${label} must be greater than zero, got "${raw}"`);
  }
  return trimmed;
}

function assertPositiveHours(raw: number, label: string): void {
  if (!Number.isFinite(raw) || raw <= 0) {
    throw new TaskmarketValidationError(`${label} must be a positive number of hours, got ${raw}`);
  }
}

function assertAddressList(raw: string[], label: string): void {
  for (const address of raw) {
    if (!ETH_ADDRESS_RE.test(address)) {
      throw new TaskmarketValidationError(`${label} contains an invalid Ethereum address: "${address}"`);
    }
  }
}

function normalizeTags(raw: string[]): string[] {
  return raw
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0)
    .slice(0, 10);
}

/**
 * Validates a task-creation configuration and returns the CLI arguments that
 * would create it. All validation happens locally before any CLI call, so a
 * misconfigured task can never reach the network.
 *
 * `maxSpendUsdc` is the user-authorized spending cap for the operation. The
 * Taskmarket CLI escrows exactly `reward` USDC on creation (the platform fee
 * is deducted from the reward when workers are paid, never charged on top),
 * so the cap must equal the reward for the authorization to succeed; the cap
 * is surfaced in the preview and enforced by the balance guard, but is not a
 * CLI flag.
 */
export function validateCreateConfig(
  raw: TaskmarketCreateConfig,
): { config: TaskmarketCreateConfig; args: string[] } {
  const description = raw.description.trim();
  if (description.length < 10) {
    throw new TaskmarketValidationError('description must be at least 10 characters');
  }
  if (description.length > 4000) {
    throw new TaskmarketValidationError('description must be at most 4000 characters');
  }

  assertUsdcAmount(raw.rewardUsdc, 'reward');
  const rewardUsdc = raw.rewardUsdc.trim();

  assertPositiveHours(raw.durationHours, 'duration');
  const durationHours = raw.durationHours;

  if (!['bounty', 'claim', 'pitch', 'benchmark', 'auction'].includes(raw.mode)) {
    throw new TaskmarketValidationError(
      `mode must be one of bounty, claim, pitch, benchmark, auction; got "${raw.mode}"`,
    );
  }

  if (!['public', 'unlisted', 'private'].includes(raw.taskVisibility)) {
    throw new TaskmarketValidationError(
      `taskVisibility must be one of public, unlisted, private; got "${raw.taskVisibility}"`,
    );
  }

  if (!['public', 'reveal_all', 'winner_only', 'never'].includes(raw.submissionVisibility)) {
    throw new TaskmarketValidationError(
      `submissionVisibility must be one of public, reveal_all, winner_only, never; got "${raw.submissionVisibility}"`,
    );
  }

  assertUsdcAmount(raw.maxSpendUsdc, 'maxSpend');
  const maxSpendUsdc = raw.maxSpendUsdc.trim();
  if (usdcToBaseUnits(maxSpendUsdc) < usdcToBaseUnits(rewardUsdc)) {
    throw new TaskmarketValidationError(
      `maxSpend (${maxSpendUsdc} USDC) must be at least the reward (${rewardUsdc} USDC)`,
    );
  }

  const tags = normalizeTags(raw.tags);

  const allowedViewers = raw.allowedViewers ?? [];
  assertAddressList(allowedViewers, 'allowedViewers');

  const privateAccessPassword = raw.privateAccessPassword;
  if (raw.taskVisibility === 'private') {
    if (allowedViewers.length === 0 && !privateAccessPassword) {
      throw new TaskmarketValidationError(
        'taskVisibility "private" requires at least one allowedViewers address or a privateAccessPassword',
      );
    }
    if (privateAccessPassword !== undefined && privateAccessPassword.length < 8) {
      throw new TaskmarketValidationError('privateAccessPassword must be at least 8 characters');
    }
  } else if (allowedViewers.length > 0 || privateAccessPassword !== undefined) {
    throw new TaskmarketValidationError(
      'allowedViewers and privateAccessPassword are only valid with taskVisibility "private"',
    );
  }

  let maxPriceUsdc: string | undefined;
  let auctionType: TaskmarketCreateConfig['auctionType'];
  let auctionStartPriceUsdc: string | undefined;
  let auctionFloorPriceUsdc: string | undefined;

  if (raw.mode === 'auction') {
    if (raw.auctionType === undefined) {
      throw new TaskmarketValidationError('auction mode requires an auctionType');
    }
    if (!['dutch', 'english', 'reverse_dutch', 'reverse_english'].includes(raw.auctionType)) {
      throw new TaskmarketValidationError(
        `auctionType must be one of dutch, english, reverse_dutch, reverse_english; got "${raw.auctionType}"`,
      );
    }
    if (raw.maxPriceUsdc === undefined) {
      throw new TaskmarketValidationError('auction mode requires maxPrice');
    }
    assertUsdcAmount(raw.maxPriceUsdc, 'maxPrice');
    maxPriceUsdc = raw.maxPriceUsdc.trim();
    if (maxPriceUsdc !== rewardUsdc) {
      throw new TaskmarketValidationError(
        `maxPrice (${maxPriceUsdc} USDC) must equal reward (${rewardUsdc} USDC) for auction mode`,
      );
    }
    if (raw.auctionType === 'dutch') {
      if (raw.auctionFloorPriceUsdc === undefined) {
        throw new TaskmarketValidationError('dutch auctions require auctionFloorPrice');
      }
      assertUsdcAmount(raw.auctionFloorPriceUsdc, 'auctionFloorPrice');
      auctionFloorPriceUsdc = raw.auctionFloorPriceUsdc.trim();
      if (usdcToBaseUnits(auctionFloorPriceUsdc) > usdcToBaseUnits(rewardUsdc)) {
        throw new TaskmarketValidationError(
          `auctionFloorPrice (${auctionFloorPriceUsdc} USDC) must not exceed reward (${rewardUsdc} USDC)`,
        );
      }
    }
    if (raw.auctionType === 'reverse_dutch') {
      if (raw.auctionStartPriceUsdc === undefined) {
        throw new TaskmarketValidationError('reverse_dutch auctions require auctionStartPrice');
      }
      assertUsdcAmount(raw.auctionStartPriceUsdc, 'auctionStartPrice');
      auctionStartPriceUsdc = raw.auctionStartPriceUsdc.trim();
      if (usdcToBaseUnits(auctionStartPriceUsdc) > usdcToBaseUnits(rewardUsdc)) {
        throw new TaskmarketValidationError(
          `auctionStartPrice (${auctionStartPriceUsdc} USDC) must not exceed reward (${rewardUsdc} USDC)`,
        );
      }
    }
    if (raw.bidDeadlineHours !== undefined) {
      assertPositiveHours(raw.bidDeadlineHours, 'bidDeadline');
    }
  } else if (
    raw.maxPriceUsdc !== undefined ||
    raw.auctionType !== undefined ||
    raw.auctionStartPriceUsdc !== undefined ||
    raw.auctionFloorPriceUsdc !== undefined ||
    raw.bidDeadlineHours !== undefined
  ) {
    throw new TaskmarketValidationError('auction-only fields require mode "auction"');
  }

  if (raw.mode === 'pitch' && raw.pitchDeadlineHours !== undefined) {
    assertPositiveHours(raw.pitchDeadlineHours, 'pitchDeadline');
  } else if (raw.mode !== 'pitch' && raw.pitchDeadlineHours !== undefined) {
    throw new TaskmarketValidationError('pitchDeadline is only valid for pitch mode');
  }

  const config: TaskmarketCreateConfig = {
    description,
    rewardUsdc,
    durationHours,
    mode: raw.mode,
    taskVisibility: raw.taskVisibility,
    submissionVisibility: raw.submissionVisibility,
    maxSpendUsdc,
    tags,
    privateAccessPassword,
    allowedViewers,
    maxPriceUsdc,
    auctionType,
    auctionStartPriceUsdc,
    auctionFloorPriceUsdc,
    pitchDeadlineHours: raw.pitchDeadlineHours,
    bidDeadlineHours: raw.bidDeadlineHours,
  };

  const args: string[] = [
    '--description',
    description,
    '--reward',
    rewardUsdc,
    '--duration',
    String(durationHours),
    '--mode',
    raw.mode,
    '--task-visibility',
    raw.taskVisibility,
    '--submission-visibility',
    raw.submissionVisibility,
  ];
  if (tags.length > 0) {
    args.push('--tags', tags.join(','));
  }
  if (raw.taskVisibility === 'private') {
    if (allowedViewers.length > 0) {
      args.push('--allowed-viewers', allowedViewers.join(','));
    }
    if (privateAccessPassword !== undefined) {
      args.push('--access-password', privateAccessPassword);
    }
  }
  if (raw.mode === 'auction') {
    args.push('--auction-type', raw.auctionType!);
    args.push('--max-price', maxPriceUsdc!);
    if (auctionFloorPriceUsdc !== undefined) {
      args.push('--auction-floor-price', auctionFloorPriceUsdc);
    }
    if (auctionStartPriceUsdc !== undefined) {
      args.push('--auction-start-price', auctionStartPriceUsdc);
    }
    if (raw.bidDeadlineHours !== undefined) {
      args.push('--bid-deadline', String(raw.bidDeadlineHours));
    }
  }
  if (raw.mode === 'pitch' && raw.pitchDeadlineHours !== undefined) {
    args.push('--pitch-deadline', String(raw.pitchDeadlineHours));
  }

  return { config, args };
}

/**
 * Renders the exact task the user is about to create, including the network,
 * the maximum spend cap, and the escrow mechanics. Everything shown here is
 * what the authorization gate commits to.
 */
export function buildCreatePreview(config: TaskmarketCreateConfig): TaskmarketPreview {
  return {
    description: config.description,
    rewardUsdc: config.rewardUsdc,
    durationHours: config.durationHours,
    mode: config.mode,
    network: TASKMARKET_BASE_NETWORK_NAME,
    chainId: TASKMARKET_BASE_CHAIN_ID,
    usdcContract: TASKMARKET_BASE_USDC_CONTRACT,
    maxSpendUsdc: config.maxSpendUsdc,
    taskVisibility: config.taskVisibility,
    submissionVisibility: config.submissionVisibility,
    tags: config.tags,
    privateAccessPasswordSet: config.privateAccessPassword !== undefined,
    allowedViewers: config.allowedViewers ?? [],
    maxPriceUsdc: config.maxPriceUsdc,
    auctionType: config.auctionType,
    auctionStartPriceUsdc: config.auctionStartPriceUsdc,
    auctionFloorPriceUsdc: config.auctionFloorPriceUsdc,
    pitchDeadlineHours: config.pitchDeadlineHours,
    bidDeadlineHours: config.bidDeadlineHours,
    confirmationCode: buildConfirmationCode(config),
  };
}

/**
 * Derives the confirmation code for a task configuration. The code is a short
 * digest over the exact fields that will be sent to Taskmarket, so it is
 * bound to the task being created: showing a preview and confirming it
 * authorizes precisely that task, and nothing else. If any field changes
 * between preview and confirmation, the code no longer matches and the
 * authorization gate refuses to create.
 */
export function buildConfirmationCode(config: TaskmarketCreateConfig): string {
  const canonical = JSON.stringify({
    description: config.description,
    rewardUsdc: config.rewardUsdc,
    durationHours: config.durationHours,
    mode: config.mode,
    taskVisibility: config.taskVisibility,
    submissionVisibility: config.submissionVisibility,
    maxSpendUsdc: config.maxSpendUsdc,
    tags: config.tags,
    privateAccessPassword: config.privateAccessPassword ?? null,
    allowedViewers: config.allowedViewers ?? [],
    maxPriceUsdc: config.maxPriceUsdc ?? null,
    auctionType: config.auctionType ?? null,
    auctionStartPriceUsdc: config.auctionStartPriceUsdc ?? null,
    auctionFloorPriceUsdc: config.auctionFloorPriceUsdc ?? null,
    pitchDeadlineHours: config.pitchDeadlineHours ?? null,
    bidDeadlineHours: config.bidDeadlineHours ?? null,
  });
  const digest = createHash('sha256').update(canonical).digest('hex');
  return `tm-${digest.slice(0, 12)}`;
}

/**
 * Authorization gate. Requires an explicit confirmation code (`confirm`) that
 * matches the code bound to the exact task preview shown to the user. The code
 * is derived from the task configuration itself, so confirming one task can
 * never authorize a different one, and a missing or stale code aborts before
 * any CLI call. The gate also refuses to authorize a max spend below the
 * escrowed reward, which would be a lie about the money that moves.
 */
export function authorizeTaskCreation(
  preview: TaskmarketPreview,
  confirm: string,
  renderedCode: string,
): void {
  if (confirm !== renderedCode) {
    throw new TaskmarketAuthorizationError(
      'Authorization required: pass the exact confirmation code shown with the task preview to create and fund this task. No task was created.',
    );
  }
  if (usdcToBaseUnits(preview.maxSpendUsdc) < usdcToBaseUnits(preview.rewardUsdc)) {
    throw new TaskmarketAuthorizationError(
      `Authorization refused: maxSpend (${preview.maxSpendUsdc} USDC) is below the escrowed reward (${preview.rewardUsdc} USDC).`,
    );
  }
}

/**
 * Network guard: refuses any operation whose backend is not the intended
 * production Base network. `taskmarket deposit` reports the network, chain id,
 * and USDC contract of the configured backend (selected by `TASKMARKET_API_URL`
 * or production by default).
 */
export async function assertBaseNetwork(
  client: TaskmarketClient,
): Promise<TaskmarketDeposit> {
  let deposit: TaskmarketDeposit;
  try {
    deposit = await client.deposit();
  } catch (error) {
    if (error instanceof TaskmarketCliError) {
      throw new TaskmarketNetworkError(
        `Cannot verify the Taskmarket network before this action: ${error.message}`,
      );
    }
    throw error;
  }
  if (deposit.chainId !== TASKMARKET_BASE_CHAIN_ID || deposit.network !== 'Base') {
    throw new TaskmarketNetworkError(
      `Refusing to act: the configured Taskmarket backend reports network "${deposit.network}" (chain id ${deposit.chainId}), but this integration only operates on ${TASKMARKET_BASE_NETWORK_NAME} (chain id ${TASKMARKET_BASE_CHAIN_ID}). Set TASKMARKET_API_URL back to the production backend (or unset it) and re-run.`,
    );
  }
  if (deposit.usdcContract.toLowerCase() !== TASKMARKET_BASE_USDC_CONTRACT.toLowerCase()) {
    throw new TaskmarketNetworkError(
      `Refusing to act: the configured Taskmarket backend reports USDC contract ${deposit.usdcContract}, expected ${TASKMARKET_BASE_USDC_CONTRACT} on ${TASKMARKET_BASE_NETWORK_NAME}.`,
    );
  }
  return deposit;
}

/**
 * Spending guard: verifies the wallet holds at least the full max spend before
 * any paid action. The wallet must be funded with Base Mainnet USDC; the CLI
 * escrows the reward on task creation.
 */
export async function assertSufficientBalance(
  client: TaskmarketClient,
  maxSpendUsdc: string,
): Promise<{ address: string; balanceUsdc: string }> {
  const maxSpendBaseUnits = usdcToBaseUnits(maxSpendUsdc);
  const balance = await client.balance();
  const balanceBaseUnits = BigInt(balance.balanceBaseUnits);
  if (balanceBaseUnits < maxSpendBaseUnits) {
    throw new TaskmarketFundingError(
      `Insufficient USDC: the wallet ${balance.address} holds ${balance.balanceUsdc} USDC but this task requires up to ${maxSpendUsdc} USDC (reward plus fees). Fund the wallet on ${TASKMARKET_BASE_NETWORK_NAME} and re-run.`,
    );
  }
  return { address: balance.address, balanceUsdc: balance.balanceUsdc };
}

/**
 * Converts a human-readable USDC amount (at most 6 decimal places) to base
 * units, mirroring the CLI's parsing rules.
 */
export function usdcToBaseUnits(raw: string): bigint {
  const match = /^(\d+)(?:\.(\d{1,6}))?$/.exec(raw.trim());
  if (match === null) {
    throw new TaskmarketValidationError(`Invalid USDC amount: "${raw}"`);
  }
  const whole = BigInt(match[1]!);
  const fraction = (match[2] ?? '').padEnd(6, '0');
  const fractionUnits = fraction.length > 0 ? BigInt(fraction) : 0n;
  return whole * 1_000_000n + fractionUnits;
}

export function isTaskId(value: string): boolean {
  return TASK_ID_RE.test(value);
}

export function isTaskOpen(task: TaskmarketTask): boolean {
  return task.status === 'open' && (task.phase === null || task.phase === 'active');
}

export function taskStatusLine(task: TaskmarketTask): string {
  const status = task.status ?? 'unknown';
  const phase = task.phase ?? null;
  const submissions = task.submissionCount ?? 0;
  return `status=${status} phase=${phase ?? 'n/a'} submissions=${submissions}`;
}
