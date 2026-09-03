import type { ToolsInput } from '@mastra/core/agent';
import { z } from 'zod';

import type { ProviderToolsOptions } from '../toolset.js';
import { applyAllowTools, defineProxyTool } from '../toolset.js';

const ENV_VAR = 'MASTRA_RESEND_CONNECTION_ID';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

/** Resend list endpoints wrap items in a `data` array. */
function dataOf(raw: unknown): Record<string, unknown>[] {
  const list = asRecord(raw).data;
  return Array.isArray(list) ? list.map(asRecord) : [];
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

/**
 * Curated Resend toolset executing through the platform connection proxy.
 * All tools resolve the connection from `options.connectionId` or
 * MASTRA_RESEND_CONNECTION_ID at execute time.
 */
export function createResendTools(options?: ProviderToolsOptions): ToolsInput {
  const context = { envVar: ENV_VAR, options };

  const tools = {
    resend_send_email: defineProxyTool(context, {
      id: 'resend_send_email',
      description: 'Send an email through Resend. Requires plain text and/or HTML content.',
      inputSchema: z
        .object({
          from: z.string().min(1).describe('Sender address, e.g. "Acme <noreply@acme.test>"'),
          to: z.array(z.string().min(1)).min(1).describe('Recipient addresses'),
          subject: z.string().min(1),
          text: z.string().optional().describe('Plain-text body'),
          html: z.string().optional().describe('HTML body'),
          replyTo: z.string().optional().describe('Reply-to address'),
        })
        .refine(input => input.text !== undefined || input.html !== undefined, {
          message: 'Provide at least one of text or html.',
        }),
      outputSchema: z.object({ id: z.string() }),
      request: input => ({
        method: 'POST',
        path: 'emails',
        body: {
          from: input.from,
          to: input.to,
          subject: input.subject,
          text: input.text,
          html: input.html,
          reply_to: input.replyTo,
        },
      }),
      transform: raw => ({ id: String(asRecord(raw).id ?? '') }),
    }),

    resend_get_email: defineProxyTool(context, {
      id: 'resend_get_email',
      description: 'Get a previously sent email by id, including its content and last delivery event.',
      inputSchema: z.object({ emailId: z.string().min(1) }),
      outputSchema: z.object({
        id: z.string(),
        from: z.string(),
        to: z.array(z.string()),
        subject: z.string(),
        text: z.string().nullable(),
        html: z.string().nullable(),
        createdAt: z.string(),
        lastEvent: z.string(),
      }),
      request: input => ({ method: 'GET', path: `emails/${encodeURIComponent(input.emailId)}` }),
      transform: raw => {
        const email = asRecord(raw);
        return {
          id: String(email.id ?? ''),
          from: String(email.from ?? ''),
          to: toStringArray(email.to),
          subject: String(email.subject ?? ''),
          text: typeof email.text === 'string' ? email.text : null,
          html: typeof email.html === 'string' ? email.html : null,
          createdAt: String(email.created_at ?? ''),
          lastEvent: String(email.last_event ?? ''),
        };
      },
    }),

    resend_list_domains: defineProxyTool(context, {
      id: 'resend_list_domains',
      description: 'List the sending domains configured in Resend.',
      inputSchema: z.object({}),
      outputSchema: z.object({
        domains: z.array(
          z.object({ id: z.string(), name: z.string(), status: z.string(), region: z.string(), createdAt: z.string() }),
        ),
      }),
      request: () => ({ method: 'GET', path: 'domains' }),
      transform: raw => ({
        domains: dataOf(raw).map(domain => ({
          id: String(domain.id ?? ''),
          name: String(domain.name ?? ''),
          status: String(domain.status ?? ''),
          region: String(domain.region ?? ''),
          createdAt: String(domain.created_at ?? ''),
        })),
      }),
    }),

    resend_list_audiences: defineProxyTool(context, {
      id: 'resend_list_audiences',
      description: 'List contact audiences (mailing lists) in Resend.',
      inputSchema: z.object({}),
      outputSchema: z.object({
        audiences: z.array(z.object({ id: z.string(), name: z.string(), createdAt: z.string() })),
      }),
      request: () => ({ method: 'GET', path: 'audiences' }),
      transform: raw => ({
        audiences: dataOf(raw).map(audience => ({
          id: String(audience.id ?? ''),
          name: String(audience.name ?? ''),
          createdAt: String(audience.created_at ?? ''),
        })),
      }),
    }),

    resend_create_contact: defineProxyTool(context, {
      id: 'resend_create_contact',
      description: 'Add a contact to a Resend audience.',
      inputSchema: z.object({
        audienceId: z.string().min(1),
        email: z.string().email().describe('Contact email address'),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        unsubscribed: z.boolean().optional().describe('Mark the contact as unsubscribed'),
      }),
      outputSchema: z.object({ id: z.string() }),
      request: input => ({
        method: 'POST',
        path: `audiences/${encodeURIComponent(input.audienceId)}/contacts`,
        body: {
          email: input.email,
          first_name: input.firstName,
          last_name: input.lastName,
          unsubscribed: input.unsubscribed,
        },
      }),
      transform: raw => ({ id: String(asRecord(raw).id ?? '') }),
    }),

    resend_list_contacts: defineProxyTool(context, {
      id: 'resend_list_contacts',
      description: 'List the contacts of a Resend audience.',
      inputSchema: z.object({ audienceId: z.string().min(1) }),
      outputSchema: z.object({
        contacts: z.array(
          z.object({
            id: z.string(),
            email: z.string(),
            firstName: z.string(),
            lastName: z.string(),
            unsubscribed: z.boolean(),
            createdAt: z.string(),
          }),
        ),
      }),
      request: input => ({
        method: 'GET',
        path: `audiences/${encodeURIComponent(input.audienceId)}/contacts`,
      }),
      transform: raw => ({
        contacts: dataOf(raw).map(contact => ({
          id: String(contact.id ?? ''),
          email: String(contact.email ?? ''),
          firstName: String(contact.first_name ?? ''),
          lastName: String(contact.last_name ?? ''),
          unsubscribed: contact.unsubscribed === true,
          createdAt: String(contact.created_at ?? ''),
        })),
      }),
    }),

    resend_list_broadcasts: defineProxyTool(context, {
      id: 'resend_list_broadcasts',
      description: 'List email broadcasts (bulk sends) in Resend.',
      inputSchema: z.object({}),
      outputSchema: z.object({
        broadcasts: z.array(
          z.object({
            id: z.string(),
            name: z.string().nullable(),
            audienceId: z.string(),
            status: z.string(),
            createdAt: z.string(),
            scheduledAt: z.string().nullable(),
            sentAt: z.string().nullable(),
          }),
        ),
      }),
      request: () => ({ method: 'GET', path: 'broadcasts' }),
      transform: raw => ({
        broadcasts: dataOf(raw).map(broadcast => ({
          id: String(broadcast.id ?? ''),
          name: typeof broadcast.name === 'string' ? broadcast.name : null,
          audienceId: String(broadcast.audience_id ?? ''),
          status: String(broadcast.status ?? ''),
          createdAt: String(broadcast.created_at ?? ''),
          scheduledAt: typeof broadcast.scheduled_at === 'string' ? broadcast.scheduled_at : null,
          sentAt: typeof broadcast.sent_at === 'string' ? broadcast.sent_at : null,
        })),
      }),
    }),
  };

  return applyAllowTools(tools, options?.allowTools);
}
