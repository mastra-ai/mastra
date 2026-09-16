import type { ContextWithMastra } from "@mastra/core/server";
import {
  staffCaseMetadataSchema,
  type PublicSupportCase,
  type SupportCase,
} from "../domain/support-case";
import { hasRole, principalFromHeaders, type SupportPrincipal } from "./auth";
import { canAccessCase } from "./auth";
import { errorResponseSchema } from "./contracts";

export function principal(c: ContextWithMastra): SupportPrincipal | undefined {
  return c.req.raw?.headers
    ? principalFromHeaders(c.req.raw.headers)
    : undefined;
}

export function requirePrincipal(
  c: ContextWithMastra,
): SupportPrincipal | Response {
  return (
    principal(c) ??
    c.json(
      errorResponseSchema.parse({ error: "Authentication required." }),
      401,
    )
  );
}

export function requireRole(
  c: ContextWithMastra,
  role: "customer" | "support-agent" | "approver" | "admin",
) {
  const current = requirePrincipal(c);
  if (current instanceof Response) return current;
  return hasRole(current, role)
    ? current
    : c.json(
        errorResponseSchema.parse({ error: "Insufficient authority." }),
        403,
      );
}

export function caseScope(
  c: ContextWithMastra,
  supportCase: Parameters<typeof canAccessCase>[1],
) {
  const current = requirePrincipal(c);
  if (current instanceof Response) return current;
  return canAccessCase(current, supportCase)
    ? current
    : c.json(errorResponseSchema.parse({ error: "Case access denied." }), 403);
}

/** Returns a role-scoped case projection that cannot expose new internal
 * fields by accident when the persistent case schema evolves. */
export function scopedCaseDto(
  supportCase: SupportCase,
  current: SupportPrincipal,
): PublicSupportCase {
  if (hasRole(current, "customer"))
    return {
      id: supportCase.id,
      externalId: supportCase.externalId,
      source: supportCase.source,
      customer: { email: current.email, name: supportCase.customer.name },
      subject: supportCase.subject,
      messages: supportCase.messages.filter(
        (message) => message.author !== "internal",
      ),
      status: supportCase.status,
      createdAt: supportCase.createdAt,
      updatedAt: supportCase.updatedAt,
      feedback: supportCase.feedback
        ? {
            rating: supportCase.feedback.rating,
            comment: supportCase.feedback.comment,
            submittedAt: supportCase.feedback.submittedAt,
          }
        : undefined,
      metadata: {},
    } as PublicSupportCase;
  const refundCommand = supportCase.metadata.refundCommand;
  const subscriptionCreditCommand =
    supportCase.metadata.subscriptionCreditCommand;
  return {
    ...supportCase,
    metadata: staffCaseMetadataSchema.parse({
      ...(refundCommand
        ? { refundCommand: { fingerprint: refundCommand.fingerprint } }
        : {}),
      ...(subscriptionCreditCommand
        ? {
            subscriptionCreditCommand: {
              fingerprint: subscriptionCreditCommand.fingerprint,
            },
          }
        : {}),
    }),
  } as PublicSupportCase;
}
