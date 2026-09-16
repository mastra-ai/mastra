import type {
  CaseMessage,
  SupportCase,
} from "../../src/mastra/domain/support-case";

/** Test-only shape used by the mock inbound provider. Application adapters
 * use the provider contract directly and do not import fixture abstractions. */
interface SupportSourceAdapter {
  source: "mock-email";
  normalizeInbound(payload: unknown): Promise<
    Omit<SupportCase, "id" | "status" | "metadata"> & {
      metadata: Record<string, unknown>;
    }
  >;
  sendReply(caseId: string, body: string): Promise<void>;
  addInternalNote(caseId: string, body: string): Promise<void>;
  updateStatus(caseId: string, status: string): Promise<void>;
}

export interface MockEmailPayload {
  externalId: string;
  from: string;
  fromName?: string;
  subject: string;
  body: string;
  receivedAt?: string;
}

export const MOCK_INBOUND_EMAILS: MockEmailPayload[] = [
  {
    externalId: "email-1001",
    from: "alex@example.com",
    fromName: "Alex Kim",
    subject: "I was charged twice",
    body: "Hi, I just noticed two charges of $49 on my card this month for my Pro Plan subscription. I only expected one. Can you refund the extra charge? My order is ORD-1001.",
  },
  {
    externalId: "email-1002",
    from: "jordan@example.com",
    fromName: "Jordan Patel",
    subject: "Where is my order?",
    body: "Hey, I ordered wireless headphones (ORD-1002) over a week ago and haven't received any shipping update. Can you tell me the status?",
  },
  {
    externalId: "email-1003",
    from: "sam@example.com",
    fromName: "Sam Rivera",
    subject: "Standing desk arrived damaged",
    body: "The standing desk I ordered (ORD-1003) arrived with a large crack in the tabletop. This is unacceptable for a $349 order. I want a full refund, not a replacement.",
  },
  {
    externalId: "email-1004",
    from: "riley@example.com",
    fromName: "Riley Chen",
    subject: "Need to cancel my team plan",
    body: "We are shutting down this project and need to cancel our Team Plan subscription (SUB-1004) immediately. We already got a partial credit last time, but please just cancel it this time, no refund needed.",
  },
  {
    externalId: "email-1005",
    from: "taylor@example.com",
    fromName: "Taylor Brooks",
    subject: "THIS IS RIDICULOUS - refund me NOW",
    body: "I have emailed three times about a refund for an order I never even received and nobody has responded. I want my money back immediately or I am disputing the charge with my bank and posting about this everywhere.",
  },
];

function messageFromPayload(payload: MockEmailPayload): CaseMessage {
  return {
    id: `msg_${crypto.randomUUID().slice(0, 8)}`,
    author: "customer",
    authorName: payload.fromName ?? payload.from,
    body: payload.body,
    createdAt: payload.receivedAt ?? new Date().toISOString(),
  };
}

export class MockSupportAdapter implements SupportSourceAdapter {
  source = "mock-email" as const;

  async normalizeInbound(rawPayload: unknown) {
    const payload = rawPayload as MockEmailPayload;
    if (!payload?.externalId || !payload?.from || !payload?.body)
      throw new Error(
        "Invalid mock email payload: externalId, from, and body are required.",
      );
    const message = messageFromPayload(payload);
    return {
      externalId: payload.externalId,
      source: this.source,
      customer: { email: payload.from, name: payload.fromName },
      subject: payload.subject || "(no subject)",
      messages: [message],
      createdAt: message.createdAt,
      updatedAt: message.createdAt,
      metadata: { rawPayload: payload },
    } satisfies Omit<SupportCase, "id" | "status" | "metadata"> & {
      metadata: Record<string, unknown>;
    };
  }

  async sendReply(caseId: string, body: string): Promise<void> {
    void caseId;
    void body;
  }
  async addInternalNote(caseId: string, body: string): Promise<void> {
    void caseId;
    void body;
  }
  async updateStatus(caseId: string, status: string): Promise<void> {
    void caseId;
    void status;
  }
}

export const mockSupportAdapter = new MockSupportAdapter();
