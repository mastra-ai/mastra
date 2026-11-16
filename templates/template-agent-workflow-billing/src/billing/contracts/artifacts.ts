import type { z } from 'zod';
import type { AdmissionIdentity } from '../runtime/accounting.js';
import type { ExecutionScope } from '../runtime/execution-scope.js';

/** Private downloads are authorized by billing before any bytes are returned. */
export interface ArtifactReader {
  /**
   * Return verified file bytes for the authenticated creator of a settled execution.
   * Throw BillingError('forbidden') for missing, unowned or unsettled artifacts.
   * Return null only for an authorized artifact whose stored bytes are no longer available.
   */
  read(
    identity: AdmissionIdentity,
    artifactId: string,
  ): Promise<{ bytes: Uint8Array; filename: string; mime: string } | null>;
}

/** Billing-owned persistence available to tools that produce durable artifacts. */
export interface ArtifactPersistence {
  /** Reserve the current artifact slot once, or return its previously completed metadata. */
  claim<T>(scope: ExecutionScope, fingerprint: string, schema: z.ZodType<T>): Promise<T | null>;
  /** Attach ownership and publish metadata only while the reservation and execution remain active. */
  complete<T extends { id: string }>(scope: ExecutionScope, metadata: object, schema: z.ZodType<T>): Promise<T>;
  /** Mark a failed dispatch uncertain so retries cannot repeat external compute. */
  uncertain(scope: ExecutionScope): Promise<void>;
  /** Read a completed slot while checking the current execution and workflow segment. */
  completed<T>(scope: ExecutionScope, schema: z.ZodType<T>): Promise<T>;
  /** Read metadata only for the current authenticated creator after positive settlement. */
  read<T>(identity: AdmissionIdentity, id: string, schema: z.ZodType<T>): Promise<T>;
}
