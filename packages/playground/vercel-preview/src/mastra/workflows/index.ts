import { countdown } from './countdown';
import { delayedReport } from './delayed-report';
import { documentBatch } from './document-batch';
import { agentReview } from './edge-cases/agent-review';
import { collectionProcessing } from './edge-cases/collection-processing';
import { deliveryRouting } from './edge-cases/delivery-routing';
import { retryWindow } from './edge-cases/retry-window';
import { orderFulfillment } from './order-fulfillment';
import { requestReview } from './request-review';

export const previewWorkflows = {
  requestReview,
  documentBatch,
  countdown,
  delayedReport,
  orderFulfillment,
  collectionProcessing,
  deliveryRouting,
  retryWindow,
  agentReview,
};
