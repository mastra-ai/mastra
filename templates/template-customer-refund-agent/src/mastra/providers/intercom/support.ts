import { z } from 'zod';
import type { DeliveryReceipt, ProviderBinding, ProviderMutationFence, SupportChannelProvider } from '../contracts';
import { ProviderEffectFenceRejectedError } from '../contracts';
import { IntercomClient } from './client';
import { type IntercomDevelopmentConfig } from './config';
import type { VerifiedIntercomConversationWebhook } from './webhook';

const providerId = z.union([
  z
    .string()
    .refine(
      id => id.trim().length > 0,
      'Intercom mutation response cannot unambiguously identify its created conversation part.',
    ),
  z.number(),
]);
const conversationPartResponse = z
  .object({
    id: providerId.optional(),
    part_type: z.string().optional(),
    body: z.string().nullable().optional(),
    author: z.unknown().optional(),
  })
  .passthrough();
const conversationResponse = z
  .object({
    id: providerId,
    state: z.string().optional(),
    conversation_parts: z
      .object({
        conversation_parts: z.array(conversationPartResponse).optional(),
      })
      .optional(),
  })
  .passthrough();
const ticketResponse = z
  .object({
    id: providerId,
    ticket_id: z.union([z.string(), z.number()]).optional(),
  })
  .passthrough();
const fullContactResponse = z
  .object({
    id: z.union([z.string(), z.number()]),
    email: z.string().email(),
    name: z.string().optional(),
  })
  .passthrough();
function record(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
}
function stringValue(value: unknown) {
  return typeof value === 'string' ? value : undefined;
}
function usableProviderPartId(value: unknown): value is string | number {
  return (
    (typeof value === 'string' && value.trim().length > 0) || (typeof value === 'number' && Number.isFinite(value))
  );
}
/** Preserve a provider identifier's type and bytes while comparing snapshots.
 * In particular, an API string id is not equivalent to a numeric id that
 * happens to stringify to the same characters. */
function providerIdKey(id: string | number) {
  return `${typeof id}:${id}`;
}
function escapedParagraph(body: string) {
  // Intercom can return a plain-text submission as a single HTML paragraph.
  // Accept only that one byte-for-byte rendering; do not parse or normalize
  // arbitrary HTML, because visually similar markup can carry different
  // message content.
  return `<p>${body.replace(/[&<>"']/g, character => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return character;
    }
  })}</p>`;
}
function matchesSentBody(body: string | null | undefined, sentBody: string) {
  return body === sentBody || body === escapedParagraph(sentBody);
}
function customerAuthor(value: unknown) {
  const author = record(value);
  const id = stringValue(author?.id);
  const type = stringValue(author?.type);
  // The signed Conversation author is the sole identity input. Intercom
  // documents user and lead authors for created events (and leads for reply
  // events); both resolve through the Contact API. A visitor reply is signed
  // but does not establish a stable Contact identity here, so we deliberately
  // reject it rather than borrowing a participant or inventing an email.
  return id && ['contact', 'user', 'lead'].includes(type ?? '') ? { id, author } : undefined;
}
function eventTimestamp(value: unknown, fallback: number) {
  const timestamp = Number(value ?? fallback);
  if (!Number.isFinite(timestamp) || timestamp <= 0)
    throw new Error('Intercom customer event lacks a valid occurrence time.');
  return new Date(timestamp * 1_000).toISOString();
}

/**
 * A Conversation `source` is the part which *started* the conversation, not
 * the message that caused a later `conversation.user.replied` notification.
 * The webhook snapshot is authenticated, so for replies we require its final
 * part to be an unambiguous customer-authored message.  Falling back to the
 * source would attach an old message (and potentially its owner) to a new
 * event.
 */
function inboundCustomerMessage(topic: string, item: Record<string, unknown>, eventCreatedAt: number) {
  if (topic === 'conversation.user.created') {
    const source = record(item.source);
    const customer = customerAuthor(source?.author);
    const body = stringValue(source?.body);
    if (!customer || !body) throw new Error('Intercom created conversation lacks a customer source author or body.');
    return {
      contactId: customer.id,
      author: customer.author,
      body,
      id: stringValue(source?.id),
      createdAt: eventTimestamp(item.created_at, eventCreatedAt),
    };
  }

  if (topic !== 'conversation.user.replied') throw new Error('Intercom event is not a customer conversation event.');
  const parts = record(item.conversation_parts)?.conversation_parts;
  if (!Array.isArray(parts) || parts.length === 0)
    throw new Error('Intercom reply event lacks a conversation-part snapshot to identify the reply.');
  // Intercom returns the Conversation part list in conversation order. The
  // notification can be safely accepted only when the final snapshot part is
  // the actual customer reply; choosing an earlier customer part would make a
  // delayed/admin-originated conversation look like a new customer message.
  const part = record(parts.at(-1));
  const customer = customerAuthor(part?.author);
  const id = stringValue(part?.id);
  const body = stringValue(part?.body);
  if (!customer || !id || !body) throw new Error('Intercom reply event lacks an unambiguous customer reply part.');
  return {
    contactId: customer.id,
    author: customer.author,
    body,
    id,
    createdAt: eventTimestamp(part?.created_at, eventCreatedAt),
  };
}

/** Maps only normalized domain fields.  Neither workflow nor domain sees a
 * vendor payload; the verified event identity remains the durable dedup key. */
export class IntercomSupportProvider implements SupportChannelProvider {
  readonly kind = 'intercom' as const;
  constructor(
    private readonly config: IntercomDevelopmentConfig,
    private readonly client = new IntercomClient(config),
  ) {}
  async normalizeInbound(payload: unknown) {
    const event = payload as VerifiedIntercomConversationWebhook;
    const item = event?.data?.item;
    if (!item || typeof item !== 'object' || event.binding.providerKind !== 'intercom')
      throw new Error('Intercom inbound was not verified by the webhook boundary.');
    const itemRecord = item as Record<string, unknown>;
    // Contacts are participants, not authenticated message authors. The
    // topic-specific source/part selection above is the sole owner input.
    const message = inboundCustomerMessage(event.topic, itemRecord, event.created_at);
    const sender = fullContactResponse.safeParse(message.author).success
      ? fullContactResponse.parse(message.author)
      : await this.client.request(
          `/contacts/${encodeURIComponent(message.contactId)}`,
          { method: 'GET' },
          fullContactResponse,
        );
    if (String(sender.id) !== message.contactId)
      throw new Error('Intercom contact enrichment did not match the event author.');
    return {
      binding: event.binding,
      externalId: event.id,
      source: 'intercom-conversation' as const,
      customer: { email: sender.email, name: sender.name },
      subject: stringValue(itemRecord.title) ?? 'Intercom conversation',
      message: {
        id: `intercom_part_${message.id ?? event.id}`,
        author: 'customer' as const,
        authorName: sender.name,
        body: message.body,
        createdAt: message.createdAt,
      },
      // Keep a minimized reference, not the full provider request body.
      rawPayload: {
        id: event.id,
        topic: event.topic,
        created_at: event.created_at,
        contactId: message.contactId,
      },
    };
  }
  private assert(binding: ProviderBinding) {
    if (
      binding.providerKind !== 'intercom' ||
      binding.tenantId !== this.config.tenantId ||
      binding.providerAccountId !== this.config.accountId
    )
      throw new Error('Intercom delivery binding is not configured.');
  }
  planFinalizationOutbox(input: { status: 'resolved' | 'escalated'; subject: string; escalationReason?: string }) {
    const operations: Array<{
      operation: 'note' | 'status' | 'ticket';
      body: string;
      status: string;
    }> = [
      {
        operation: 'status',
        body: '',
        status: input.status,
      },
    ];
    if (input.status !== 'escalated') return operations;
    const reason = input.escalationReason?.trim() || 'Support escalation requires staff review.';
    operations.unshift({
      operation: 'note',
      body: reason,
      status: input.status,
    });
    if (this.config.ticketTypeId)
      operations.push({
        operation: 'ticket',
        body: reason,
        status: input.subject,
      });
    return operations;
  }
  private assertConversation(binding: ProviderBinding, response: z.infer<typeof conversationResponse>) {
    if (String(response.id) !== binding.externalConversationId)
      throw new Error('Intercom mutation response does not match the bound Conversation.');
  }
  private conversationParts(response: z.infer<typeof conversationResponse>, context: 'read' | 'mutation') {
    const parts = response.conversation_parts?.conversation_parts;
    if (!parts) throw new Error(`Intercom ${context} response lacks a conversation-part snapshot.`);
    return parts;
  }
  private assertPreMutationConversation(binding: ProviderBinding, response: z.infer<typeof conversationResponse>) {
    this.assertConversation(binding, response);
    this.conversationParts(response, 'read');
  }
  private partWasAuthoredByConfiguredAdmin(part: z.infer<typeof conversationPartResponse>) {
    const author = record(part.author);
    return (
      author?.type === 'admin' &&
      (author.id === this.config.adminId ||
        (typeof author.id === 'number' && Number.isFinite(author.id) && String(author.id) === this.config.adminId))
    );
  }
  private matchesOperation(
    part: z.infer<typeof conversationPartResponse>,
    operation: 'reply' | 'note' | 'status',
    body: string,
    status?: 'open' | 'closed',
  ) {
    if (!this.partWasAuthoredByConfiguredAdmin(part)) return false;
    if (operation === 'reply')
      // An initial reply can be represented as an automatic assignment. It is
      // still only safe when it carries this exact reply body and admin.
      return (part.part_type === 'comment' || part.part_type === 'assignment') && matchesSentBody(part.body, body);
    if (operation === 'note') return part.part_type === 'note' && matchesSentBody(part.body, body);
    return (
      part.part_type === (status === 'closed' ? 'close' : 'open') &&
      (part.body === undefined || part.body === null || part.body === '')
    );
  }
  private receipt(
    binding: ProviderBinding,
    before: z.infer<typeof conversationResponse>,
    response: z.infer<typeof conversationResponse>,
    operation: 'reply' | 'note' | 'status',
    body: string,
    status?: 'open' | 'closed',
  ): DeliveryReceipt {
    this.assertConversation(binding, before);
    this.assertConversation(binding, response);
    if (operation === 'status' && response.state !== status)
      throw new Error('Intercom status mutation response does not demonstrate the desired Conversation state.');
    const knownPartIds = new Set(
      this.conversationParts(before, 'read')
        .map(part => part.id)
        .filter(usableProviderPartId)
        .map(providerIdKey),
    );
    const candidates = this.conversationParts(response, 'mutation').filter(
      part =>
        usableProviderPartId(part.id) &&
        !knownPartIds.has(providerIdKey(part.id)) &&
        this.matchesOperation(part, operation, body, status),
    );
    // A full Conversation can include system parts and concurrent changes.
    // Never pick by list position or body alone: only one novel, semantic
    // candidate is a receipt for this particular POST.
    if (candidates.length !== 1 || candidates[0]?.id === undefined)
      throw new Error('Intercom mutation response cannot unambiguously identify its created conversation part.');
    const id = candidates[0].id;
    if (!usableProviderPartId(id))
      throw new Error('Intercom mutation response cannot unambiguously identify its created conversation part.');
    return {
      receiptId: `intercom:${operation}:${id}`,
      providerMessageId: String(id),
      deliveredAt: new Date().toISOString(),
    };
  }
  private async conversation(binding: ProviderBinding) {
    return this.client.request(
      `/conversations/${encodeURIComponent(binding.externalConversationId)}`,
      { method: 'GET' },
      conversationResponse,
    );
  }
  async currentConversationState(binding: ProviderBinding): Promise<{ id: string; state: 'open' | 'closed' }> {
    this.assert(binding);
    const response = await this.conversation(binding);
    this.assertConversation(binding, response);
    if (response.state !== 'open' && response.state !== 'closed')
      throw new Error('Intercom conversation has an unsupported state.');
    return {
      id: String(response.id),
      state: response.state === 'closed' ? 'closed' : 'open',
    };
  }
  async deliver(binding: ProviderBinding, body: string, _status: string, _idempotencyKey?: string) {
    this.assert(binding);
    const before = await this.conversation(binding);
    this.assertPreMutationConversation(binding, before);
    const response = await this.client.request(
      `/conversations/${encodeURIComponent(binding.externalConversationId)}/reply`,
      {
        method: 'POST',
        body: JSON.stringify({
          message_type: 'comment',
          type: 'admin',
          admin_id: this.config.adminId,
          body,
        }),
      },
      conversationResponse,
    );
    return this.receipt(binding, before, response, 'reply', body);
  }
  async addInternalNote(
    binding: ProviderBinding,
    body: string,
    _idempotencyKey: string,
    beforeMutation?: ProviderMutationFence,
  ) {
    this.assert(binding);
    const before = await this.conversation(binding);
    this.assertPreMutationConversation(binding, before);
    if (beforeMutation && !(await beforeMutation())) throw new ProviderEffectFenceRejectedError();
    const response = await this.client.request(
      `/conversations/${encodeURIComponent(binding.externalConversationId)}/reply`,
      {
        method: 'POST',
        body: JSON.stringify({
          message_type: 'note',
          type: 'admin',
          admin_id: this.config.adminId,
          body,
        }),
      },
      conversationResponse,
    );
    return this.receipt(binding, before, response, 'note', body);
  }
  async updateStatus(
    binding: ProviderBinding,
    status: string,
    _idempotencyKey: string,
    beforeMutation?: ProviderMutationFence,
  ) {
    this.assert(binding);
    const state = status === 'resolved' ? 'closed' : 'open';
    const before = await this.conversation(binding);
    this.assertPreMutationConversation(binding, before);
    if (before.state === state)
      return {
        // This is a verified no-op, not evidence that a Conversation part was
        // created. Keep the bound conversation only in the receipt id.
        receiptId: `intercom:status:no-op:${binding.externalConversationId}`,
        deliveredAt: new Date().toISOString(),
      };
    if (beforeMutation && !(await beforeMutation())) throw new ProviderEffectFenceRejectedError();
    const messageType = state === 'open' ? 'open' : 'close';
    const response = await this.client.request(
      `/conversations/${encodeURIComponent(binding.externalConversationId)}/parts`,
      {
        method: 'POST',
        body: JSON.stringify({
          message_type: messageType,
          type: 'admin',
          admin_id: this.config.adminId,
          body: '',
        }),
      },
      conversationResponse,
    );
    return this.receipt(binding, before, response, 'status', '', state);
  }
  async convertToTicket(
    binding: ProviderBinding,
    input: { title: string; description: string },
    _idempotencyKey: string,
  ) {
    this.assert(binding);
    if (!this.config.ticketTypeId) throw new Error('Intercom ticket conversion is not configured.');
    const response = await this.client.request(
      `/conversations/${encodeURIComponent(binding.externalConversationId)}/convert`,
      {
        method: 'POST',
        body: JSON.stringify({
          ticket_type_id: this.config.ticketTypeId,
          ...(this.config.ticketStateId ? { ticket_state_id: this.config.ticketStateId } : {}),
          attributes: {
            _default_title_: input.title,
            _default_description_: input.description,
          },
        }),
      },
      ticketResponse,
    );
    // The API id, not ticket_id (display identifier), is the durable reference.
    return {
      receiptId: `intercom:ticket:${response.id}`,
      providerMessageId: String(response.id),
      deliveredAt: new Date().toISOString(),
    };
  }
}
