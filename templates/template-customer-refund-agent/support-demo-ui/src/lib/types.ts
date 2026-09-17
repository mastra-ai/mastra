import type {
  InboundSupportResponse,
  MonitoringSummaryResponse,
  MockEmailPayload,
  SupportCaseDto,
} from '../../../src/mastra/server/contracts';

/** These DTOs are inferred from the API's Zod boundary, not manually duplicated. */
export type { InboundSupportResponse, MockEmailPayload };
export type SupportCase = SupportCaseDto;
export type CaseStatus = SupportCase['status'];
export type CaseMessage = SupportCase['messages'][number];
export type TriageResult = NonNullable<SupportCase['triage']>;
export type PolicyMatch = NonNullable<SupportCase['policyMatches']>[number];
export type OrderLookup = NonNullable<SupportCase['orderLookup']>;
export type SubscriptionLookup = NonNullable<SupportCase['subscriptionLookup']>;
export type RefundHistory = NonNullable<SupportCase['refundHistory']>;
export type DraftResolution = NonNullable<SupportCase['draft']>;
export type ApprovalDecision = NonNullable<SupportCase['approval']>;
export type RefundResult = NonNullable<SupportCase['refundResult']>;

// Mirrors src/mastra/lib/monitoring.ts on the API side.

export type MonitoringSummary = MonitoringSummaryResponse;
