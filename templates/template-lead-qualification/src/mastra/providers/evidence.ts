import type { z } from 'zod';
import type { QualificationSnapshot, researchTargetSchema } from '../config/qualification';
import type { QualificationStore } from '../persistence/qualification-store';
import type {
  discoverySchema,
  extractionSchema,
  verificationSchema,
  Candidate,
  Evidence,
  ResearchBranch,
  Fact,
  ResearchRound,
} from '../research/contracts';

/** Captured policy, durable budget and accumulated material for one research round. */
export interface ResearchContext {
  /** Accepted run whose reservations and results must remain durable across retries. */
  runId: string;
  /** Confirmed company domain anchoring identity and source attribution. */
  domain: string;
  /** Company domain and additional domains approved by the captured source policy. */
  domains: string[];
  /** Immutable configuration, assessment time and model captured at admission. */
  snapshot: QualificationSnapshot;
  /** Absolute deadline in milliseconds since the Unix epoch, shared by every attempt. */
  deadline: number;
  /** Reserve budget before external work; settle measured usage and retain unknown usage. */
  store: QualificationStore;
  /** Current target, prior findings and bounded discovery diagnostics. */
  round: {
    index: number;
    target: z.infer<typeof researchTargetSchema>;
    query: string;
    gap: ResearchRound['diagnostic']['gap'];
    year: number;
    searchDomains: string[];
    previousEvidence: Evidence[];
    consultedUrls: string[];
    missingAttributes: z.infer<typeof researchTargetSchema>[];
    supportedFacts: Partial<Record<z.infer<typeof researchTargetSchema>, Fact>>;
    counters: {
      discoveredUrls: number;
      retrievedPages: number;
      extractedCandidates: number;
      selectedCandidates: number;
      urls: Array<{ url: string; outcome: 'retrieved' | 'unavailable' | 'already_consulted' | 'unsupported_format' }>;
      discoverySelection?: ResearchRound['diagnostic']['discoverySelection'];
    };
  };
}
/**
 * Research adapter supplying sourced proposals and independent factual verification.
 * External calls and retries share the context's durable budget and deadline.
 * Source content is untrusted data; deterministic qualification belongs to the scoring policy.
 */
export interface EvidenceProvider {
  /** Stable ID selected through sources.providerIds and recorded on supplied evidence. */
  readonly id: string;
  /**
   * Discover URLs on approved domains or return bounded, attributable evidence directly.
   * Preserve source references, collection time, exact excerpts and their SHA256 digests.
   * Citation preferences must refer to URLs present in sourceUrls.
   */
  search(branch: ResearchBranch, context: ResearchContext): Promise<z.infer<typeof discoverySchema>>;
  /**
   * Propose facts supported by exact passages in the supplied material.
   * Keep observations and inferences distinct, preserve contradictions and report identity conflicts.
   * Missing evidence must remain unknown rather than become a negative factual claim.
   */
  extract(
    branch: ResearchBranch,
    evidence: Evidence[],
    context: ResearchContext,
  ): Promise<z.infer<typeof extractionSchema>>;
  /**
   * Independently check each proposal against its cited material and return supported candidate IDs.
   * Establish factual support without deciding qualification, score or routing.
   * Optional diagnostics explain support decisions without replacing supportedCandidateIds.
   */
  verify(
    branch: ResearchBranch,
    candidates: Candidate[],
    evidence: Evidence[],
    context: ResearchContext,
  ): Promise<z.infer<typeof verificationSchema>>;
}
