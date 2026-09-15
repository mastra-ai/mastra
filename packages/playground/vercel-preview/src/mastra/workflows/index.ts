import { countdown } from './countdown';
import { delayedReport } from './delayed-report';
import { documentBatch } from './document-batch';
import { orderFulfillment } from './order-fulfillment';
import { requestReview } from './request-review';

export const previewWorkflows = { requestReview, documentBatch, countdown, delayedReport, orderFulfillment };
