import { supportLoginRoute } from "./authentication-routes";
import { supportInboundRoute } from "./inbound-routes";
import {
  supportCaseApproveRoute,
  supportCaseRejectRoute,
} from "./approval-routes";
import {
  supportCaseFeedbackRoute,
  supportCaseFollowUpRoute,
  supportCaseManualResolutionContextRoute,
  supportCaseManualResolutionRoute,
  supportCaseDetailRoute,
  supportCustomerFinancialRequestsRoute,
  supportCasesListRoute,
} from "./casework-routes";
import {
  supportKnowledgeReindexRoute,
  supportMonitoringSummaryRoute,
  supportOpenApiRoute,
} from "./operations-routes";
import { supportCaseSupervisorRoute } from "./supervisor-routes";
import {
  intercomWebhookRoute,
  readWebhookBody,
  stripeWebhookRoute,
} from "./webhook-routes";

export {
  intercomWebhookRoute,
  readWebhookBody,
  stripeWebhookRoute,
  supportCaseApproveRoute,
  supportCaseDetailRoute,
  supportCustomerFinancialRequestsRoute,
  supportCaseFeedbackRoute,
  supportCaseFollowUpRoute,
  supportCaseManualResolutionContextRoute,
  supportCaseManualResolutionRoute,
  supportCaseRejectRoute,
  supportCaseSupervisorRoute,
  supportCasesListRoute,
  supportInboundRoute,
  supportKnowledgeReindexRoute,
  supportLoginRoute,
  supportMonitoringSummaryRoute,
  supportOpenApiRoute,
};

export const supportRoutes = [
  supportLoginRoute,
  supportInboundRoute,
  intercomWebhookRoute,
  stripeWebhookRoute,
  supportCasesListRoute,
  supportCustomerFinancialRequestsRoute,
  supportCaseDetailRoute,
  supportCaseSupervisorRoute,
  supportCaseApproveRoute,
  supportCaseRejectRoute,
  supportCaseFollowUpRoute,
  supportCaseManualResolutionContextRoute,
  supportCaseManualResolutionRoute,
  supportCaseFeedbackRoute,
  supportMonitoringSummaryRoute,
  supportKnowledgeReindexRoute,
  supportOpenApiRoute,
];
