import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

import { z } from 'zod';

export const campaignRequestLedgerSchema = z
  .object({
    version: z.literal(1),
    campaign: z.literal('opensanctions-template-smoke'),
    limit: z.literal(50),
    reservedRequests: z.number().int().min(0).max(50),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export type CampaignRequestLedger = z.infer<typeof campaignRequestLedgerSchema>;

type ReservationInput = Readonly<{
  ledgerPath: string;
  requests: number;
  limit: 50;
  initialReservedRequests?: number;
  now?: () => Date;
  lockTimeoutMs?: number;
}>;

const wait = (milliseconds: number): Promise<void> => new Promise(resolve => setTimeout(resolve, milliseconds));

const acquireLock = async (lockPath: string, timeoutMs: number): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  const attempt = async (): Promise<void> => {
    try {
      await mkdir(lockPath);
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'EEXIST') throw error;
      if (Date.now() >= deadline) throw new Error('OpenSanctions campaign ledger is locked; no requests were reserved');
      await wait(10);
      await attempt();
    }
  };
  await attempt();
};

const readLedger = async (
  ledgerPath: string,
  limit: 50,
  initialReservedRequests: number | undefined,
  now: () => Date,
): Promise<CampaignRequestLedger> => {
  try {
    return campaignRequestLedgerSchema.parse(JSON.parse(await readFile(ledgerPath, 'utf8')));
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
    if (initialReservedRequests === undefined) {
      throw new Error(
        'OpenSanctions campaign ledger is missing; initialize it with the audited consumed request count',
      );
    }
    return campaignRequestLedgerSchema.parse({
      version: 1,
      campaign: 'opensanctions-template-smoke',
      limit,
      reservedRequests: initialReservedRequests,
      updatedAt: now().toISOString(),
    });
  }
};

const writeLedger = async (ledgerPath: string, ledger: CampaignRequestLedger): Promise<void> => {
  const temporaryPath = `${ledgerPath}.${String(process.pid)}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, `${JSON.stringify(ledger, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
      flag: 'wx',
    });
    await rename(temporaryPath, ledgerPath);
  } finally {
    await rm(temporaryPath, { force: true });
  }
};

export const reserveCampaignRequests = async (input: ReservationInput): Promise<CampaignRequestLedger> => {
  const requests = z.number().int().positive().parse(input.requests);
  const initialReservedRequests =
    input.initialReservedRequests === undefined
      ? undefined
      : z.number().int().min(0).max(input.limit).parse(input.initialReservedRequests);
  const lockPath = `${input.ledgerPath}.lock`;
  await acquireLock(lockPath, input.lockTimeoutMs ?? 5_000);
  try {
    const now = input.now ?? (() => new Date());
    const current = await readLedger(input.ledgerPath, input.limit, initialReservedRequests, now);
    if (current.reservedRequests + requests > current.limit)
      throw new Error('OpenSanctions campaign request ceiling would be exceeded');
    const reserved = campaignRequestLedgerSchema.parse({
      ...current,
      reservedRequests: current.reservedRequests + requests,
      updatedAt: now().toISOString(),
    });
    await writeLedger(input.ledgerPath, reserved);
    return reserved;
  } finally {
    await rm(lockPath, { recursive: true, force: true });
  }
};
