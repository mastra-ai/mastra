import { resolveCredentialStore, resolveTenantFromRequestContext } from '@mastra/code-sdk/agents/credential-resolver';
import { normalizeLegacyProviderId } from '@mastra/code-sdk/providers/model-ids';
import type { Processor, ProcessOutputStepArgs } from '@mastra/core/processors';

import { credentialLabel, getAuthProviderId } from '../routes/provider-credentials.js';

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
    const tenant = resolveTenantFromRequestContext(requestContext);
    const store = resolveCredentialStore(requestContext);
    if (!tenant || !store) return messageList;
    for (const message of messageList.get.response.db()) {
      const metadata = message.content.metadata;
      if (message.role !== 'assistant' || !metadata || typeof metadata.provider !== 'string') continue;
      if (metadata.credentialLabel !== undefined) continue;
      const [sdkProviderRoot = metadata.provider] = metadata.provider.split('.');
      const provider = normalizeLegacyProviderId(sdkProviderRoot);
      const credential = store.get(getAuthProviderId(provider));
      const label = credential && credentialLabel(provider, credential.type);
      if (!label) continue;
      metadata.credentialLabel = label;
      if (tenant.credentialScope === 'user') metadata.credentialOwnerId = tenant.userId;
    }
    return messageList;
  }
}
