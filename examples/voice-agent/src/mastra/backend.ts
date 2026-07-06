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

// --- Consent store (companion to configuration.requireConsent) ---------------

/** Consent grants captured during a call, keyed by caller (the memory `resource`). */
const summaryConsentByCaller = new Map<string, boolean>();

/**
 * Record whether the caller consented to storing a summary of the call. Wired to the `recordConsent`
 * tool (see tools/intake-tools) via `createConsentTool`, which the agent calls once the caller
 * answers the consent question — the runtime-capture companion to `configuration.requireConsent`.
 */
export async function recordSummaryConsent(resourceId: string, granted: boolean): Promise<void> {
  await simulateBackendLatency();
  summaryConsentByCaller.set(resourceId, granted);
}

/**
 * Whether the caller granted consent to store a summary of the call. Defaults to NOT granted (no
 * record → no consent → no summary), the correct compliance behavior: the agent must obtain and
 * record consent during the call for the end-of-call summary distillation to run.
 */
export function hasSummaryConsent(resourceId: string): boolean {
  return summaryConsentByCaller.get(resourceId) === true;
}

/** Whether the deployment requires consent before storing a call summary. */
export function summaryStorageRequired(requireConsent?: {
  summaryStorage?: boolean | { required?: boolean };
}): boolean {
  const req = requireConsent?.summaryStorage;
  return req === true || (typeof req === 'object' && req?.required !== false);
}
