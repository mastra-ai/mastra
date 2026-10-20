import type { NormalizedEvent } from '../contracts';
import type { Assessment } from '../research/contracts';
import type { OwnedPatch } from '../review/contracts';
import { ownedPatchSchema } from '../review/contracts';
import type { Client } from '@libsql/client';

export type OutputFactory = (client: Client) => OutputProvider;

/** Readable reports generated from one exact journaled patch. */
export interface OutputContent {
  /** Plain UTF-8 text suitable for a terminal or text viewer. */
  text: string;
  /** UTF-8 Markdown suitable for saving as a .md report. */
  markdown: string;
}
/** Persistent output retry limits; every delay is in milliseconds. */
export interface OutputRetryPolicy {
  /** Maximum total attempts for the current output lifecycle. */
  maxAttempts: number;
  /** Minimum delay in milliseconds between retryable attempts. */
  retryDelayMs: number;
  /** Maximum accepted delay in milliseconds, including Retry-After responses. */
  maxRetryDelayMs: number;
}
/** Authoritative destination values used for compare-and-set and reconciliation. */
export interface DestinationState {
  /** Current values; adapters expose business fields even when their transport stores compact metadata. */
  fields: Record<string, unknown>;
  /** Last durably applied integration operation ID, or null before an integration write. */
  marker: string | null;
  /** Current concurrency token covering human-editable command fields. */
  revision?: string;
  /** Historical token retained only when older pending journals require it. */
  legacyRevision?: string;
  /** Readable content from the same persisted owned state, never an unjournaled side effect. */
  content?: OutputContent;
}
export class OutputError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
    readonly retryAfterMs = 0,
  ) {
    super(code);
  }
}
/** Destination driver; writes require the shared service's persisted authorization and journal. */
export interface OutputProvider {
  /** Stable ID independently selected from the input driver. */
  readonly id: string;
  /** External commands require the provider's authenticated actor verification; defaults to operator review. */
  readonly reviewMode?: 'operator' | 'external';
  /** Capture deterministic presentation in the exact patch before packet or policy authorization. */
  present?(assessment: Assessment, patch: OwnedPatch): OwnedPatch;
  /** Deterministically update presentation after a human decision; retain historical authorized versions. */
  finalize?(patch: OwnedPatch): OwnedPatch;
  /** Compare an authoritative state with a current or supported historical revision token. */
  matchesRevision?(state: DestinationState, expected: string): boolean;
  /** Bounded durable retry policy; safe OutputError failures carry retryability and server delay. */
  retryPolicy?: OutputRetryPolicy;
  /** Exact persisted field projection for a journaled patch, operation ID and previous owned state. */
  project?(patch: OwnedPatch, operationId: string, expected?: Record<string, unknown>): Record<string, unknown>;
  /** Select only integration-owned values for exact comparisons, retaining unrelated destination data. */
  owned?(fields: Record<string, unknown>): Record<string, unknown>;
  /** Human command fields permitted to differ from a published packet after authoritative verification. */
  reviewFields?: readonly string[];
  /** Fingerprint machine-owned state retained after detailed records expire. */
  retentionDigest?(fields: Record<string, unknown>): string;
  /** Read the configured existing destination and operation marker; null means the record is absent. */
  read(destination: NormalizedEvent['destination']): Promise<DestinationState | null>;
  /**
   * Apply only the journaled owned patch using its stable operation ID. Compare the
   * authoritative destination against expected owned fields and optional revision;
   * preserve all unowned values. A lost response must remain reconcilable by read.
   */
  apply(
    destination: NormalizedEvent['destination'],
    operationId: string,
    patch: OwnedPatch,
    expected: Record<string, unknown>,
    expectedRevision?: string,
  ): Promise<void>;
}
export function ownedState(fields: Record<string, unknown>): Record<string, unknown> {
  const keys = Object.keys(ownedPatchSchema.shape).filter(key => key !== 'presentationVersion');
  return Object.fromEntries(keys.filter(key => key in fields).map(key => [key, fields[key]]));
}

export function projectedPatch(
  provider: OutputProvider,
  patch: OwnedPatch,
  operationId: string,
  expected?: Record<string, unknown>,
) {
  return provider.project?.(patch, operationId, expected) ?? ownedState(patch);
}
export function destinationFields(provider: OutputProvider, fields: Record<string, unknown>) {
  return provider.owned?.(fields) ?? ownedState(fields);
}

export function revisionMatches(provider: OutputProvider, state: DestinationState, expected?: string) {
  return expected === undefined || (provider.matchesRevision?.(state, expected) ?? state.revision === expected);
}
