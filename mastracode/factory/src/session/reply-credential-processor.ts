import { resolveCredentialStore, resolveTenantFromRequestContext } from '@mastra/code-sdk/agents/credential-resolver';
import { normalizeLegacyProviderId } from '@mastra/code-sdk/providers/model-ids';
import type { Processor, ProcessOutputStepArgs } from '@mastra/core/processors';
import type { RequestContext } from '@mastra/core/request-context';

import { credentialLabel, getAuthProviderId } from '../routes/provider-credentials.js';

/** A personal credential carries its owner's id; an organization credential has none. */
export interface RunCredential {
  label: string;
  ownerId?: string;
}

/** The credential this request's calls to `provider` (`anthropic`, `openai.responses`) run on. */
export function runCredential(requestContext: RequestContext | undefined, provider: string): RunCredential | undefined {
  const tenant = resolveTenantFromRequestContext(requestContext);
  const store = resolveCredentialStore(requestContext);
  if (!tenant || !store) return undefined;
  const [sdkProviderRoot = provider] = provider.split('.');
  const authProvider = normalizeLegacyProviderId(sdkProviderRoot);
  const credential = store.get(getAuthProviderId(authProvider));
  const label = credential && credentialLabel(authProvider, credential.type);
  if (!label) return undefined;
  return tenant.credentialScope === 'user' ? { label, ownerId: tenant.userId } : { label };
}

/**
 * Stamps each assistant reply with the credential that answered it, as
 * `content.metadata.credentialLabel` ("Claude Pro/Max", "Anthropic API key")
 * and, for a personal credential, `content.metadata.credentialOwnerId`. A
 * reply without an owner id was answered by the organization's credential.
 * Stamped at send time so a reply keeps its label after the thread's
 * credential scope changes.
 */
export class FactoryReplyCredentialProcessor implements Processor {
  readonly id = 'factory-reply-credential';
  readonly name = 'Factory reply credential';

  processOutputStep({ messageList, requestContext }: ProcessOutputStepArgs) {
    for (const message of messageList.get.response.db()) {
      const metadata = message.content.metadata;
      if (message.role !== 'assistant' || !metadata || typeof metadata.provider !== 'string') continue;
      if (metadata.credentialLabel !== undefined) continue;
      const credential = runCredential(requestContext, metadata.provider);
      if (!credential) continue;
      metadata.credentialLabel = credential.label;
      if (credential.ownerId) metadata.credentialOwnerId = credential.ownerId;
    }
    return messageList;
  }
}
