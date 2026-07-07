/**
 * Mock "third-party backend" for the Meridian Trades demo: the per-tenant config you would
 * fetch from Firebase keyed by the dialed number, a service-area (zip) check, and the intake
 * store with the end-of-call reconciliation pass.
 *
 * This stands in for the real integrations a trades contractor would wire up. Everything is
 * in-memory and resets on worker restart, which is what you want for a smoke test.
 */
import { simulateBackendLatency } from './data';
import type { TradeId } from './data';

export interface Workspace {
  id: string;
  company: string;
  /** Dialed number this workspace answers on. */
  did: string;
  trades: TradeId[];
  serviceAreaLabel: string;
  /** Zip codes inside the service area. A real backend would store a polygon or radius. */
  serviceAreaZips: string[];
}

// Stand-in for the per-tenant config you'd resolve from Firebase. One demo tenant here; the
// directory is keyed by dialed number so the same agent can serve many tenants.
const WORKSPACES: Workspace[] = [
  {
    id: 'ws_meridian',
    company: 'Meridian Trades',
    did: '+15550100',
    trades: ['plumbing', 'electrical', 'roofing', 'carpentry', 'painting'],
    serviceAreaLabel: 'the San Francisco Bay Area',
    serviceAreaZips: ['94016', '94017', '94102', '94103', '94110', '94501', '94555', '94601', '94609', '94704'],
  },
];

const DEFAULT_WORKSPACE = WORKSPACES[0]!;

/** Mock Firebase lookup: resolve the tenant for the call from the dialed number. */
export async function resolveWorkspace(did?: string): Promise<Workspace> {
  await simulateBackendLatency();
  return WORKSPACES.find(w => w.did === did) ?? DEFAULT_WORKSPACE;
}

/** Synchronous accessor for code that just needs the active tenant (e.g. a processor). */
export function getWorkspace(did?: string): Workspace {
  return WORKSPACES.find(w => w.did === did) ?? DEFAULT_WORKSPACE;
}

function normalizeZip(zip: string): string {
  return zip.replace(/\D/g, '').slice(0, 5);
}

export interface ServiceAreaResult {
  zip: string;
  inArea: boolean;
  serviceAreaLabel: string;
}

/** Service-area validation: is this zip one the tenant covers? */
export async function checkServiceArea(zip: string, workspaceId: string = DEFAULT_WORKSPACE.id): Promise<ServiceAreaResult> {
  await simulateBackendLatency();
  const workspace = WORKSPACES.find(w => w.id === workspaceId) ?? DEFAULT_WORKSPACE;
  const normalized = normalizeZip(zip);
  return {
    zip: normalized,
    inArea: workspace.serviceAreaZips.includes(normalized),
    serviceAreaLabel: workspace.serviceAreaLabel,
  };
}

// --- Intake store + reconciliation ------------------------------------------

export type IntakeScenario = 'lead' | 'inspection' | 'callback';

export interface IntakeRecord {
  reference: string;
  scenario: IntakeScenario;
  name: string;
  phone: string;
  trade?: TradeId;
  jobDescription?: string;
  address?: string;
  zip?: string;
  reason?: string;
  createdAt: string;
}

export const intakes: IntakeRecord[] = [];

let nextIntakeNumber = 5000;

export interface ReconcileInput {
  scenario: IntakeScenario;
  name?: string;
  phone?: string;
  trade?: TradeId;
  jobDescription?: string;
  address?: string;
  zip?: string;
  reason?: string;
}

export type ReconcileResult =
  | { submitted: true; reference: string; record: IntakeRecord }
  | { submitted: false; reason: string; missing?: string[]; serviceAreaLabel?: string };

/**
 * The deterministic end-of-call reconciliation pass. Validates the collected fields for the
 * scenario, re-checks the service area for inspections (never trusting the conversation alone),
 * and writes one authoritative record. This is the agent-loop equivalent of a workflow's
 * "reconciliation step at the end" — but it lives in code, not in the model.
 */
export async function reconcileIntake(input: ReconcileInput): Promise<ReconcileResult> {
  await simulateBackendLatency();
  const phone = input.phone?.replace(/\D/g, '');
  const missing: string[] = [];
  if (!input.name?.trim()) missing.push('name');
  if (!phone) missing.push('phone number');

  if (input.scenario === 'lead') {
    if (!input.trade) missing.push('trade');
    if (!input.jobDescription?.trim()) missing.push('a short description of the work');
  }
  if (input.scenario === 'inspection') {
    if (!input.address?.trim()) missing.push('property address');
    if (!input.zip?.trim()) missing.push('zip code');
  }
  if (input.scenario === 'callback') {
    if (!input.reason?.trim()) missing.push('reason for the call');
  }
  if (missing.length) {
    return { submitted: false, reason: 'missing required details', missing };
  }

  // Inspections only proceed inside the service area — re-validated here so a misheard or
  // optimistic "yes" earlier in the call can't book an out-of-area visit.
  if (input.scenario === 'inspection') {
    const area = await checkServiceArea(input.zip!);
    if (!area.inArea) {
      return { submitted: false, reason: 'outside service area', serviceAreaLabel: area.serviceAreaLabel };
    }
  }

  nextIntakeNumber += 1;
  const record: IntakeRecord = {
    reference: `MT-INT-${nextIntakeNumber}`,
    scenario: input.scenario,
    name: input.name!.trim(),
    phone: phone!,
    trade: input.trade,
    jobDescription: input.jobDescription?.trim(),
    address: input.address?.trim(),
    zip: input.zip ? normalizeZip(input.zip) : undefined,
    reason: input.reason?.trim(),
    createdAt: new Date().toISOString(),
  };
  intakes.push(record);
  return { submitted: true, reference: record.reference, record };
}

// --- Contact activity log (post-turn, off the audio path) -------------------

export interface ContactLogEntry {
  /** The caller this turn belonged to (the memory `resource`). */
  resourceId: string;
  /** What the agent said this turn. */
  reply: string;
  /** Tools the agent invoked this turn. */
  tools: string[];
  /** True when barge-in cut the turn short. */
  interrupted: boolean;
  loggedAt: string;
}

export const contactLog: ContactLogEntry[] = [];

/**
 * Append a turn to the CRM's contact activity log. A contractor wants every interaction on
 * record, but the caller should never wait for that write — so this is called from the
 * `onTurnComplete` hook, which runs after the reply has streamed and off the audio path.
 */
export async function recordContact(entry: Omit<ContactLogEntry, 'loggedAt'>): Promise<void> {
  await simulateBackendLatency();
  contactLog.push({ ...entry, loggedAt: new Date().toISOString() });
}

// --- Call summary records (end-of-call, consent-gated) -----------------------

export interface CallSummaryRecord {
  /** The call this summary belongs to (the memory `thread`). */
  callId: string;
  /** The caller (the memory `resource`). */
  callerId?: string;
  /** Concise human-readable summary of the call. */
  summary: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  /** Services the caller asked about, if any. */
  requestedServices: string[];
  savedAt: string;
}

/** Call summaries keyed by call (thread) id — the business's own system of record. */
export const callRecords = new Map<string, CallSummaryRecord>();

/**
 * Upsert the summary record for a finished call. Wired to the call-summary extractor's
 * `onExtracted` hook (see memory.ts) so the structured summary lands in the app's own storage,
 * not in Mastra memory — the business queries these records directly (and deletes them on its
 * own retention schedule).
 */
export async function saveCallSummary(record: Omit<CallSummaryRecord, 'savedAt'>): Promise<void> {
  await simulateBackendLatency();
  callRecords.set(record.callId, { ...record, savedAt: new Date().toISOString() });
  // The store is in-memory, so print the record — this is how you SEE the end-of-call summary
  // land when testing live calls (it appears in the worker terminal right after hang-up).
  console.info('[backend] call summary saved', record);
}

// --- Consent store (companion to configuration.requireConsent) ---------------

/**
 * Consent ledger: caller (the memory `resource`) → consent item → granted. A named, per-item set
 * rather than one global "consented" flag — mirroring `configuration.requireConsent` and the
 * `createConsentTool` item set — so a regulated line can capture several independent consents
 * (call recording, summary storage, data sharing, marketing). Only the REGULATED line uses this:
 * its `recordConsent` tool (tools/compliance-tools) writes here, and its `onCallEnd` reads it back
 * to gate the call summary and log the audit trail. The default Meridian workers are deliberately
 * permissive and never touch consent.
 */
const consentLedger = new Map<string, Map<string, boolean>>();

/** Record one consent decision for a caller. Wired to `createConsentTool`'s `onGrant`. */
export async function recordConsent(resourceId: string, item: string, granted: boolean): Promise<void> {
  await simulateBackendLatency();
  let items = consentLedger.get(resourceId);
  if (!items) {
    items = new Map();
    consentLedger.set(resourceId, items);
  }
  items.set(item, granted);
}

/**
 * Whether the caller granted a given consent item. Defaults to NOT granted (no record → no consent),
 * the correct compliance default: the agent must obtain and record consent for the gated action to
 * proceed.
 */
export function hasConsent(resourceId: string, item: string): boolean {
  return consentLedger.get(resourceId)?.get(item) === true;
}

/** The full set of consent decisions captured for a caller — for the audit trail / end-of-call log. */
export function getConsentLedger(resourceId: string): Record<string, boolean> {
  return Object.fromEntries(consentLedger.get(resourceId) ?? []);
}

/**
 * Whether the caller granted consent to store a summary of the call. Defaults to NOT granted (no
 * record → no consent → no summary), the correct compliance behavior for the REGULATED line: its
 * agent must obtain and record consent during the call for the end-of-call summary to run.
 */
export function hasSummaryConsent(resourceId: string): boolean {
  return hasConsent(resourceId, 'summaryStorage');
}

/** Whether the deployment requires consent before storing a call summary. */
export function summaryStorageRequired(requireConsent?: {
  summaryStorage?: boolean | { required?: boolean };
}): boolean {
  const req = requireConsent?.summaryStorage;
  return req === true || (typeof req === 'object' && req?.required !== false);
}
