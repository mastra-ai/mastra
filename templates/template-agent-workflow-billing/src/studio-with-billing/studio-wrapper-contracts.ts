import type { MastraCompositeStore } from '@mastra/core/storage';
import type { MiddlewareHandler } from 'hono';
import type { AnyWorkflow } from '@mastra/core/workflows';
import type { BillingHttpGateway } from '../billing/mastra.js';
import type { OrganizationService, BillingContext } from '../billing/organizations.js';
import type { AgentResource, WorkflowResource, AnyAgent } from '../billing/mastra-resources.js';
import type { ConversationStorage, ConversationOwner } from '../billing/storage/conversations.js';

/** Prepared server-owned billing services; tools never need a database or a separate policy catalog. */
export interface StudioBillingIntegration {
  readonly organizations: OrganizationService;
  readonly execution: BillingHttpGateway;
  readonly conversations: ConversationStorage;
  readonly storage: MastraCompositeStore;
  readonly resources: {
    readonly agents: Readonly<Record<string, AgentResource<any>>>;
    readonly workflows: Readonly<Record<string, WorkflowResource<AnyWorkflow>>>;
  };
}
/** Trusted process-local conversation activity. Credentials remain in the identity service, never persisted in links. */
export interface StudioConversation {
  readonly billing: BillingContext;
  readonly owner: ConversationOwner;
  readonly controller: AbortController;
}
/** Public composition surface consumed by integration.server and attach. */
export interface StudioServerWrapper {
  readonly integration: StudioBillingIntegration;
  readonly agents: Readonly<Record<string, AnyAgent>>;
  /** Classify aliases before ordinary native access is expanded. */
  registerAlias(id: string, agent: AnyAgent): boolean;
  /** Guard only the exact supported native routes. */
  middleware(apiPrefix: string, fallback: MiddlewareHandler): MiddlewareHandler;
}
