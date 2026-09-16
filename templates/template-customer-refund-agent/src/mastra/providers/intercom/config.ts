import { z } from "zod";
import type { CaseProviderBindings, ProviderBinding } from "../contracts";

export const INTERCOM_API_VERSION = "2.16";
const sourceSchema = z.enum(["mock", "intercom"]);
const LOCAL_DEMO_TENANT = "local-demo";
const APPROVED_API_ORIGINS = new Set([
  "https://api.intercom.io",
  "https://api.eu.intercom.io",
]);

export interface IntercomDevelopmentConfig {
  enabled: true;
  tenantId: string;
  accountId: string;
  accessToken: string;
  clientSecret: string;
  adminId: string;
  apiBaseUrl: string;
  knowledgeEnabled: boolean;
  ticketTypeId?: string;
  ticketStateId?: string;
}

function enabledSource() {
  return sourceSchema.parse(
    process.env.SUPPORT_SOURCE?.trim().toLowerCase() || "mock",
  );
}
function truthy(name: string) {
  return process.env[name]?.trim().toLowerCase() === "true";
}
function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value)
    throw new Error(`${name} is required when SUPPORT_SOURCE=intercom.`);
  return value;
}

/** Parse rather than silently falling back: an enabled external route must be
 * complete and explicitly development-only.  Tokens are never included in
 * this value's string representation or errors. */
export function intercomDevelopmentConfig():
  IntercomDevelopmentConfig | undefined {
  if (enabledSource() !== "intercom") return undefined;
  if (!truthy("INTERCOM_DEVELOPMENT_ENABLED"))
    throw new Error(
      "SUPPORT_SOURCE=intercom requires INTERCOM_DEVELOPMENT_ENABLED=true.",
    );
  const apiBaseUrl =
    process.env.INTERCOM_API_BASE_URL?.trim() || "https://api.intercom.io";
  const url = new URL(apiBaseUrl);
  if (process.env.NODE_ENV !== "test") {
    if (!APPROVED_API_ORIGINS.has(url.origin) || url.pathname !== "/")
      throw new Error(
        "INTERCOM_API_BASE_URL must be an approved Intercom API origin outside tests.",
      );
  }
  const ticketTypeId = process.env.INTERCOM_TICKET_TYPE_ID?.trim() || undefined;
  const ticketStateId =
    process.env.INTERCOM_TICKET_STATE_ID?.trim() || undefined;
  if (ticketStateId && !ticketTypeId)
    throw new Error(
      "INTERCOM_TICKET_STATE_ID requires INTERCOM_TICKET_TYPE_ID.",
    );
  const tenantId = required("INTERCOM_TENANT_ID");
  // This template has one authenticated local tenant.  Accepting a remote
  // tenant while retaining local commerce/financial providers would cross an
  // authorization boundary, so fail explicitly instead of falling back.
  if (tenantId !== LOCAL_DEMO_TENANT)
    throw new Error(
      "INTERCOM_TENANT_ID must be local-demo for the configured local authenticated tenant.",
    );
  return {
    enabled: true,
    tenantId,
    accountId: required("INTERCOM_APP_ID"),
    accessToken: required("INTERCOM_ACCESS_TOKEN"),
    clientSecret: required("INTERCOM_CLIENT_SECRET"),
    adminId: required("INTERCOM_ADMIN_ID"),
    apiBaseUrl: url.toString().replace(/\/$/, ""),
    knowledgeEnabled: truthy("INTERCOM_KNOWLEDGE_ENABLED"),
    ticketTypeId,
    ticketStateId,
  };
}

export function intercomBinding(
  config: IntercomDevelopmentConfig,
  conversationId: string,
): ProviderBinding {
  return {
    tenantId: config.tenantId,
    providerKind: "intercom",
    providerAccountId: config.accountId,
    externalConversationId: conversationId,
  };
}

/** Bind every port at acceptance time.  Commerce and financial actions remain
 * local until their own provider phase, even while support uses Intercom. */
export function bindingsForIntercomConversation(
  config: IntercomDevelopmentConfig,
  conversationId: string,
): CaseProviderBindings {
  const support = intercomBinding(config, conversationId);
  const local: ProviderBinding = {
    tenantId: config.tenantId,
    providerKind: "local",
    providerAccountId: "local-demo",
    externalConversationId: conversationId,
  };
  return {
    support,
    commerce: local,
    transactions: local,
    knowledge: config.knowledgeEnabled ? support : local,
  };
}

export function redactIntercomConfig(config: IntercomDevelopmentConfig) {
  return {
    enabled: config.enabled,
    tenantId: config.tenantId,
    accountId: config.accountId,
    adminId: config.adminId,
    apiBaseUrl: config.apiBaseUrl,
    knowledgeEnabled: config.knowledgeEnabled,
    ticketConfigured: Boolean(config.ticketTypeId),
    apiVersion: INTERCOM_API_VERSION,
  };
}
