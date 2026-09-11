// AUTO-GENERATED from rhysbalevicius/integration-templates @ cfb727cbc131 — do not edit by hand.
import { createPlatformProxy } from '../../runtime/platform-proxy.js';
import type { ProviderToolsOptions } from '../../toolset.js';
import { applyAllowTools } from '../../toolset.js';
import { cancelEmailTool } from './tools/cancel-email.js';
import { createDomainTool } from './tools/create-domain.js';
import { getDomainTool } from './tools/get-domain.js';
import { getEmailTool } from './tools/get-email.js';
import { listDomainsTool } from './tools/list-domains.js';
import { listEmailsTool } from './tools/list-emails.js';
import { sendEmailTool } from './tools/send-email.js';
import { verifyDomainTool } from './tools/verify-domain.js';

export function createResendTools(options?: ProviderToolsOptions) {
  const platformProxy = createPlatformProxy({ connectionId: options?.connectionId, client: options?.client });
  const tools = {
    resend_cancel_email: cancelEmailTool(platformProxy),
    resend_create_domain: createDomainTool(platformProxy),
    resend_get_domain: getDomainTool(platformProxy),
    resend_get_email: getEmailTool(platformProxy),
    resend_list_domains: listDomainsTool(platformProxy),
    resend_list_emails: listEmailsTool(platformProxy),
    resend_send_email: sendEmailTool(platformProxy),
    resend_verify_domain: verifyDomainTool(platformProxy),
  };
  return applyAllowTools(tools, options?.allowTools);
}
