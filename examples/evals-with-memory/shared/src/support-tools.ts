/**
 * A support desk with enough surface area that choosing is a real decision.
 *
 * The Agent Builder's pitch is that it picks the *minimum* set of capabilities
 * an outcome needs. With one tool registered there is nothing to pick, and the
 * demo proves nothing. With nine, three different requests produce three
 * genuinely different agents, and the room watches it reason about which is
 * which:
 *
 *   "customer is out of space"  → lookupAccount, listDevices, searchKnowledgeBase
 *   "customer wants a refund"   → getBillingHistory, checkRefundEligibility, createSupportTicket
 *   "sync is broken"            → getSyncHealth, getServiceStatus, listDevices, searchPastTickets
 *
 * Everything reads one shared fixture, `NIMBUS`, and that is the part worth
 * copying. Tools that each invent their own unrelated data produce an agent
 * that can answer questions but cannot *diagnose*, because no two answers line
 * up. Here they do: `acct-42` is on Free with four devices, the Free plan
 * allows three, and its sync failures are all `DEVICE_LIMIT` on the fourth.
 * An agent with the right three tools walks that chain and lands on a root
 * cause. That is the difference between a demo that lists facts and one that
 * looks like software.
 *
 * Three accounts, three different root causes, so a demo can go more than one
 * way:
 *
 *   acct-42  Free, 11.2/15 GB, 4 devices  → too many devices
 *   acct-77  Pro, 480/2000 GB, 6 devices  → regional incident, not their fault
 *   acct-13  Free, 14.8/15 GB, 2 devices  → genuinely full, and refund-eligible
 *
 * Every value is fixed. No clocks, no randomness, no network — the same
 * question gives the same answer on every machine, which matters when the
 * numbers end up on a slide.
 *
 * The plan limits here (15 GB / 3 devices on Free, 2 TB on paid, 14-day
 * refunds) are the same ones the workspace skills quote. Skills and tools
 * disagreeing is the fastest way to make an agent look broken, and it is a
 * mistake worth *not* demonstrating.
 */
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { NIMBUS_KNOWLEDGE } from './data/support-qa.ts';

/** The workshop's fixed "today". Deterministic date maths, no clock. */
const TODAY = '2026-08-14';

type Device = {
  name: string;
  platform: string;
  lastSyncAt: string;
  status: 'syncing' | 'blocked' | 'offline';
};

type SyncEvent = {
  at: string;
  device: string;
  code: 'DEVICE_LIMIT' | 'QUOTA_EXCEEDED' | 'REGION_DEGRADED' | 'FILE_TOO_LARGE';
  detail: string;
};

type Invoice = {
  id: string;
  date: string;
  amountUsd: number;
  description: string;
  refunded: boolean;
};

type Account = {
  plan: 'Free' | 'Pro' | 'Enterprise';
  storageUsedGb: number;
  storageLimitGb: number;
  deviceLimit: number | null;
  region: string;
  devices: Device[];
  syncEvents: SyncEvent[];
  invoices: Invoice[];
};

/**
 * The fixture. Read-only on purpose — `createSupportTicket` is the only tool
 * that writes, and it writes to its own store below rather than mutating this.
 */
const NIMBUS: Record<string, Account> = {
  'acct-42': {
    plan: 'Free',
    storageUsedGb: 11.2,
    storageLimitGb: 15,
    deviceLimit: 3,
    region: 'us-east',
    devices: [
      { name: 'MacBook Pro', platform: 'macOS', lastSyncAt: '2026-08-14T09:12:00Z', status: 'syncing' },
      { name: 'iPhone 17', platform: 'iOS', lastSyncAt: '2026-08-14T08:47:00Z', status: 'syncing' },
      { name: 'Desktop-Home', platform: 'Windows', lastSyncAt: '2026-08-13T22:03:00Z', status: 'syncing' },
      // The fourth device is the whole story for this account.
      { name: 'iPad Air', platform: 'iPadOS', lastSyncAt: '2026-08-09T17:20:00Z', status: 'blocked' },
    ],
    syncEvents: [
      { at: '2026-08-14T09:15:00Z', device: 'iPad Air', code: 'DEVICE_LIMIT', detail: 'Free plan syncs up to 3 devices; this is the 4th.' },
      { at: '2026-08-13T11:02:00Z', device: 'iPad Air', code: 'DEVICE_LIMIT', detail: 'Free plan syncs up to 3 devices; this is the 4th.' },
      { at: '2026-08-11T19:44:00Z', device: 'iPad Air', code: 'DEVICE_LIMIT', detail: 'Free plan syncs up to 3 devices; this is the 4th.' },
    ],
    invoices: [],
  },
  'acct-77': {
    plan: 'Pro',
    storageUsedGb: 480,
    storageLimitGb: 2000,
    deviceLimit: null,
    region: 'eu-west',
    devices: [
      { name: 'ThinkPad X1', platform: 'Linux', lastSyncAt: '2026-08-14T06:30:00Z', status: 'offline' },
      { name: 'Studio Mac', platform: 'macOS', lastSyncAt: '2026-08-14T06:31:00Z', status: 'offline' },
      { name: 'Pixel 11', platform: 'Android', lastSyncAt: '2026-08-14T06:28:00Z', status: 'offline' },
      { name: 'Office NAS', platform: 'Linux', lastSyncAt: '2026-08-14T06:29:00Z', status: 'offline' },
      { name: 'Surface Laptop', platform: 'Windows', lastSyncAt: '2026-08-14T06:33:00Z', status: 'offline' },
      { name: 'iPad Pro', platform: 'iPadOS', lastSyncAt: '2026-08-14T06:27:00Z', status: 'offline' },
    ],
    syncEvents: [
      { at: '2026-08-14T06:34:00Z', device: 'Studio Mac', code: 'REGION_DEGRADED', detail: 'eu-west sync backend degraded.' },
      { at: '2026-08-14T06:33:00Z', device: 'ThinkPad X1', code: 'REGION_DEGRADED', detail: 'eu-west sync backend degraded.' },
      { at: '2026-08-14T06:31:00Z', device: 'Pixel 11', code: 'REGION_DEGRADED', detail: 'eu-west sync backend degraded.' },
    ],
    invoices: [
      { id: 'inv-2026-08-01', date: '2026-08-01', amountUsd: 96, description: 'Nimbus Pro — annual', refunded: false },
      { id: 'inv-2025-08-01', date: '2025-08-01', amountUsd: 96, description: 'Nimbus Pro — annual', refunded: false },
    ],
  },
  'acct-13': {
    plan: 'Free',
    storageUsedGb: 14.8,
    storageLimitGb: 15,
    deviceLimit: 3,
    region: 'us-west',
    devices: [
      { name: 'Chromebook', platform: 'ChromeOS', lastSyncAt: '2026-08-14T07:55:00Z', status: 'blocked' },
      { name: 'Galaxy S26', platform: 'Android', lastSyncAt: '2026-08-14T07:51:00Z', status: 'blocked' },
    ],
    syncEvents: [
      { at: '2026-08-14T07:56:00Z', device: 'Chromebook', code: 'QUOTA_EXCEEDED', detail: '14.8 GB of 15 GB used; upload rejected.' },
      { at: '2026-08-14T07:52:00Z', device: 'Galaxy S26', code: 'QUOTA_EXCEEDED', detail: '14.8 GB of 15 GB used; upload rejected.' },
      { at: '2026-08-12T14:10:00Z', device: 'Chromebook', code: 'FILE_TOO_LARGE', detail: 'archive.zip is 3.1 GB; Free plan caps files at 2 GB.' },
    ],
    // Charged 5 days before TODAY — inside the 14-day refund window.
    invoices: [{ id: 'inv-2026-08-09', date: '2026-08-09', amountUsd: 12, description: 'Nimbus Pro — monthly', refunded: false }],
  },
};

/** Current incidents. `acct-77` lives in the degraded region; nobody else does. */
const SERVICE_STATUS = {
  updatedAt: '2026-08-14T09:00:00Z',
  regions: [
    { region: 'us-east', status: 'operational' as const, note: null },
    { region: 'us-west', status: 'operational' as const, note: null },
    {
      region: 'eu-west',
      status: 'degraded' as const,
      note: 'Elevated sync latency and intermittent upload failures since 06:20 UTC. Engineers engaged; no data loss.',
    },
  ],
};

/** Resolved tickets, for "has anyone seen this before". */
const PAST_TICKETS = [
  {
    id: 'TCK-3391',
    summary: 'One device stopped syncing after buying a new tablet',
    resolution: 'Free plan device limit reached. Removed a retired laptop under Settings → Devices; the tablet synced within minutes.',
    tags: ['sync', 'device-limit', 'free-plan'],
  },
  {
    id: 'TCK-3402',
    summary: 'Uploads failing across every device at once',
    resolution: 'Regional incident, not account-specific. Confirmed on the status page, set expectations, no action needed from the customer.',
    tags: ['sync', 'incident', 'region'],
  },
  {
    id: 'TCK-3418',
    summary: 'Large video file will not upload on Free',
    resolution: 'File exceeded the 2 GB Free-plan cap. Options given: split the archive or move to a paid plan (50 GB cap).',
    tags: ['upload', 'file-size', 'free-plan'],
  },
  {
    id: 'TCK-3455',
    summary: 'Customer at quota, asking to delete files from support side',
    resolution: 'Support cannot delete customer files. Walked them through emptying trash, which recovered 2.4 GB — deleted files count until purged.',
    tags: ['storage', 'quota', 'trash'],
  },
];

/** Tickets created during a session. In-memory; a demo, not a database. */
const CREATED_TICKETS: Array<{ id: string; accountId: string; severity: string; summary: string }> = [];

export function resetSupportDesk(): void {
  CREATED_TICKETS.length = 0;
}

/** Days between two ISO dates, floor. Deterministic — both dates are fixtures. */
function daysBetween(from: string, to: string): number {
  const ms = new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime();
  return Math.floor(ms / 86_400_000);
}

function requireAccount(accountId: string): Account {
  const account = NIMBUS[accountId];
  if (!account) {
    throw new Error(`Unknown account "${accountId}". Known accounts: ${Object.keys(NIMBUS).join(', ')}.`);
  }
  return account;
}

// ---------------------------------------------------------------------------
// Read tools
// ---------------------------------------------------------------------------

export const getAccountOverview = createTool({
  id: 'getAccountOverview',
  description:
    "Get a Nimbus customer's plan, storage usage, device count and home region. Start here for almost any account-specific question.",
  inputSchema: z.object({ accountId: z.string().describe('Customer account id, e.g. acct-42') }),
  outputSchema: z.object({
    plan: z.string(),
    storageUsedGb: z.number(),
    storageLimitGb: z.number(),
    percentUsed: z.number(),
    deviceCount: z.number(),
    deviceLimit: z.number().nullable(),
    region: z.string(),
  }),
  execute: async ({ accountId }) => {
    const account = requireAccount(accountId);
    return {
      plan: account.plan,
      storageUsedGb: account.storageUsedGb,
      storageLimitGb: account.storageLimitGb,
      percentUsed: Math.round((account.storageUsedGb / account.storageLimitGb) * 1000) / 10,
      deviceCount: account.devices.length,
      deviceLimit: account.deviceLimit,
      region: account.region,
    };
  },
});

export const listDevices = createTool({
  id: 'listDevices',
  description:
    'List every device on an account with its platform, last sync time and current status, plus whether the account is over its plan device limit.',
  inputSchema: z.object({ accountId: z.string().describe('Customer account id, e.g. acct-42') }),
  outputSchema: z.object({
    deviceLimit: z.number().nullable(),
    overLimitBy: z.number(),
    devices: z.array(
      z.object({
        name: z.string(),
        platform: z.string(),
        lastSyncAt: z.string(),
        status: z.string(),
      }),
    ),
  }),
  execute: async ({ accountId }) => {
    const account = requireAccount(accountId);
    const overLimitBy = account.deviceLimit === null ? 0 : Math.max(0, account.devices.length - account.deviceLimit);
    return { deviceLimit: account.deviceLimit, overLimitBy, devices: account.devices };
  },
});

export const getSyncHealth = createTool({
  id: 'getSyncHealth',
  description:
    'Get recent sync failures for an account, with error codes and the dominant failure reason. Use this to diagnose "my files are not syncing".',
  inputSchema: z.object({
    accountId: z.string().describe('Customer account id, e.g. acct-42'),
    limit: z.number().int().min(1).max(50).default(10).describe('Maximum events to return'),
  }),
  outputSchema: z.object({
    failureCount: z.number(),
    dominantCode: z.string().nullable(),
    events: z.array(z.object({ at: z.string(), device: z.string(), code: z.string(), detail: z.string() })),
  }),
  execute: async ({ accountId, limit }) => {
    const account = requireAccount(accountId);
    const events = account.syncEvents.slice(0, limit);
    const tally = new Map<string, number>();
    for (const event of account.syncEvents) tally.set(event.code, (tally.get(event.code) ?? 0) + 1);
    const dominantCode = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    return { failureCount: account.syncEvents.length, dominantCode, events };
  },
});

export const getServiceStatus = createTool({
  id: 'getServiceStatus',
  description:
    'Check current Nimbus service health by region. Use this before blaming an account for a sync problem — a regional incident affects every device at once.',
  inputSchema: z.object({
    region: z.string().optional().describe('Restrict to one region, e.g. eu-west. Omit for all regions.'),
  }),
  outputSchema: z.object({
    updatedAt: z.string(),
    anyDegraded: z.boolean(),
    regions: z.array(z.object({ region: z.string(), status: z.string(), note: z.string().nullable() })),
  }),
  execute: async ({ region }) => {
    const regions = region ? SERVICE_STATUS.regions.filter(r => r.region === region) : SERVICE_STATUS.regions;
    return {
      updatedAt: SERVICE_STATUS.updatedAt,
      anyDegraded: regions.some(r => r.status !== 'operational'),
      regions,
    };
  },
});

export const searchKnowledgeBase = createTool({
  id: 'searchKnowledgeBase',
  description:
    'Search the Nimbus product documentation for plan limits, policies and how-to answers. Use this for general product questions that are not about one specific account.',
  inputSchema: z.object({ query: z.string().describe('What to look up, in plain words') }),
  outputSchema: z.object({
    matches: z.array(z.object({ topic: z.string(), answer: z.string() })),
  }),
  execute: async ({ query }) => {
    const words = query.toLowerCase().split(/\W+/).filter(w => w.length > 2);
    const matches = Object.entries(NIMBUS_KNOWLEDGE)
      .map(([topic, answer]) => {
        const haystack = `${topic} ${answer}`.toLowerCase();
        return { topic, answer, hits: words.filter(w => haystack.includes(w)).length };
      })
      .filter(m => m.hits > 0)
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 3)
      .map(({ topic, answer }) => ({ topic, answer }));
    return { matches };
  },
});

export const getBillingHistory = createTool({
  id: 'getBillingHistory',
  description: "List an account's invoices with dates, amounts and whether each has already been refunded.",
  inputSchema: z.object({ accountId: z.string().describe('Customer account id, e.g. acct-13') }),
  outputSchema: z.object({
    invoices: z.array(
      z.object({
        id: z.string(),
        date: z.string(),
        amountUsd: z.number(),
        description: z.string(),
        refunded: z.boolean(),
      }),
    ),
  }),
  execute: async ({ accountId }) => ({ invoices: requireAccount(accountId).invoices }),
});

export const checkRefundEligibility = createTool({
  id: 'checkRefundEligibility',
  description:
    'Check whether an invoice qualifies for the 14-day no-questions-asked refund. Read-only — this decides eligibility, it does not move any money.',
  inputSchema: z.object({
    accountId: z.string().describe('Customer account id'),
    invoiceId: z.string().describe('Invoice id from getBillingHistory, e.g. inv-2026-08-09'),
  }),
  outputSchema: z.object({
    eligible: z.boolean(),
    daysSincePurchase: z.number(),
    windowDays: z.number(),
    reason: z.string(),
  }),
  execute: async ({ accountId, invoiceId }) => {
    const account = requireAccount(accountId);
    const invoice = account.invoices.find(i => i.id === invoiceId);
    if (!invoice) {
      return { eligible: false, daysSincePurchase: -1, windowDays: 14, reason: `No invoice "${invoiceId}" on this account.` };
    }
    const days = daysBetween(invoice.date, TODAY);
    if (invoice.refunded) {
      return { eligible: false, daysSincePurchase: days, windowDays: 14, reason: 'This invoice has already been refunded.' };
    }
    return days <= 14
      ? { eligible: true, daysSincePurchase: days, windowDays: 14, reason: `Purchased ${days} days ago, inside the 14-day window.` }
      : { eligible: false, daysSincePurchase: days, windowDays: 14, reason: `Purchased ${days} days ago, outside the 14-day window.` };
  },
});

export const searchPastTickets = createTool({
  id: 'searchPastTickets',
  description:
    'Search resolved support tickets for a similar problem and how it was fixed. Use this before escalating — the answer is often already written down.',
  inputSchema: z.object({ query: z.string().describe('Describe the problem in plain words') }),
  outputSchema: z.object({
    tickets: z.array(z.object({ id: z.string(), summary: z.string(), resolution: z.string(), tags: z.array(z.string()) })),
  }),
  execute: async ({ query }) => {
    const words = query.toLowerCase().split(/\W+/).filter(w => w.length > 2);
    const tickets = PAST_TICKETS.map(ticket => {
      const haystack = `${ticket.summary} ${ticket.resolution} ${ticket.tags.join(' ')}`.toLowerCase();
      return { ticket, hits: words.filter(w => haystack.includes(w)).length };
    })
      .filter(t => t.hits > 0)
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 3)
      .map(t => t.ticket);
    return { tickets };
  },
});

// ---------------------------------------------------------------------------
// The one write tool
// ---------------------------------------------------------------------------

/**
 * Deliberately the only tool with a side effect.
 *
 * An agent whose whole toolbox is read-only never has to show judgment. One
 * write action gives the Builder something to be careful with, and gives the
 * skills something to govern: `escalation-policy` in the workspace says when
 * this is allowed to be called and when the agent should answer instead.
 */
export const createSupportTicket = createTool({
  id: 'createSupportTicket',
  description:
    'Escalate to a human by opening a support ticket. Use only when the problem cannot be resolved from the documentation or the account data — every ticket costs a person time.',
  inputSchema: z.object({
    accountId: z.string().describe('Customer account id'),
    severity: z.enum(['low', 'normal', 'high', 'urgent']).describe('See the escalation-policy skill for the severity matrix'),
    summary: z.string().describe('One line a human can triage from'),
  }),
  outputSchema: z.object({ ticketId: z.string(), severity: z.string(), queuePosition: z.number() }),
  execute: async ({ accountId, severity, summary }) => {
    requireAccount(accountId);
    // Deterministic id from the count, not a clock or a random.
    const ticketId = `TCK-${9000 + CREATED_TICKETS.length + 1}`;
    CREATED_TICKETS.push({ id: ticketId, accountId, severity, summary });
    return { ticketId, severity, queuePosition: CREATED_TICKETS.length };
  },
});

/** Everything above, ready to spread into `new Mastra({ tools })`. */
export const supportDeskTools = {
  getAccountOverview,
  listDevices,
  getSyncHealth,
  getServiceStatus,
  searchKnowledgeBase,
  getBillingHistory,
  checkRefundEligibility,
  searchPastTickets,
  createSupportTicket,
};
