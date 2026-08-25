import type { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';

import type { IntegrationTools } from '../integrations/base.js';
import type { WorkItemRow, WorkItemsStorage } from '../storage/domains/work-items/base.js';
import type { FactorySessionSourceLookup } from './binding-context.js';
import { resolveFactorySessionAddress } from './binding-context.js';
import { renderReviewReport, reviewReportSchema } from './review-report.js';
import { reviewRuntimeFromRequestContext } from './review-runtime.js';

export type PublishedReview = {
  url: string | null;
  /** What the platform accepted — `comment` means it refused the verdict event. */
  event: 'approve' | 'request-changes' | 'comment';
};

export interface FactoryReviewPublisher {
  publish(input: {
    orgId: string;
    factoryProjectId: string;
    item: WorkItemRow;
    verdict: 'approve' | 'request-changes';
    body: string;
  }): Promise<PublishedReview>;
}

export async function createFactoryReviewTools(options: {
  requestContext: RequestContext;
  storage: WorkItemsStorage;
  publisher: FactoryReviewPublisher;
  sessions?: FactorySessionSourceLookup;
}): Promise<IntegrationTools> {
  const resolution = await resolveFactorySessionAddress({
    requestContext: options.requestContext,
    storage: options.storage,
    sessions: options.sessions,
  });
  if (!resolution) return {};
  // Any binding the thread has held, not only an active one: the review pass
  // closes its binding on transition, and a re-review in the same thread must
  // still publish through the tool rather than compose the body by hand.
  const binding = await options.storage.findRunBindingBySession(resolution.address);
  if (!binding) return {};
  const item = await options.storage.get({ orgId: binding.orgId, id: binding.workItemId });
  if (item?.externalSource?.type !== 'pull-request') return {};

  return {
    factory_publish_review: createTool({
      id: 'factory_publish_review',
      description:
        'Publish the review verdict on the pull request bound to this thread. Supply the review as data — the body, its section order and the runtime attribution are composed here.',
      inputSchema: reviewReportSchema,
      execute: async (report, execution) => {
        const current = await options.storage.get({ orgId: binding.orgId, id: binding.workItemId });
        if (current?.externalSource?.type !== 'pull-request') {
          throw new Error('The bound Factory work item no longer tracks a pull request.');
        }
        const body = renderReviewReport(report, reviewRuntimeFromRequestContext(execution.requestContext));
        const published = await options.publisher.publish({
          orgId: binding.orgId,
          factoryProjectId: binding.factoryProjectId,
          item: current,
          verdict: report.verdict,
          body,
        });
        return { ...published, body };
      },
    }),
  };
}
