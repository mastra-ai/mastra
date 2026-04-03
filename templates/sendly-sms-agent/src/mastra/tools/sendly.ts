import { createTool } from '@mastra/core/tools';
import Sendly from '@sendly/node';
import { z } from 'zod';

const sendly = new Sendly(process.env.SENDLY_API_KEY!);

export const sendSmsTool = createTool({
  id: "send-sms",
  description:
    "Send an SMS message to a phone number. Use for notifications, alerts, reminders, or any outbound text message. The phone number must be in E.164 format (e.g. +15551234567). Returns the message ID and delivery status.",
  inputSchema: z.object({
    to: z.string().describe("Recipient phone number in E.164 format, e.g. +15551234567"),
    text: z.string().describe("The message content to send (max 1600 characters)"),
    messageType: z
      .enum(["transactional", "marketing"])
      .optional()
      .default("transactional")
      .describe("Message type: 'transactional' for alerts/OTP/notifications, 'marketing' for promotions"),
  }),
  outputSchema: z.object({
    id: z.string(),
    status: z.string(),
    to: z.string(),
    segments: z.number(),
  }),
  execute: async ({ to, text, messageType }) => {
    const message = await sendly.messages.send({ to, text, messageType });
    return {
      id: message.id,
      status: message.status,
      to: message.to,
      segments: message.segments,
    };
  },
});

export const verifyPhoneTool = createTool({
  id: "verify-phone",
  description:
    "Send a one-time verification code (OTP) to a phone number via SMS. Use this to confirm a user owns a phone number before granting access. Returns a verification ID needed to check the code later.",
  inputSchema: z.object({
    to: z.string().describe("Phone number to verify in E.164 format, e.g. +15551234567"),
  }),
  outputSchema: z.object({
    verificationId: z.string(),
    status: z.string(),
    expiresAt: z.string(),
  }),
  execute: async ({ to }) => {
    const result = await sendly.verify.send({ to });
    return {
      verificationId: result.id,
      status: result.status,
      expiresAt: result.expiresAt,
    };
  },
});

export const checkVerificationTool = createTool({
  id: "check-verification",
  description:
    "Check a verification code that a user entered. Requires the verification ID from the verify-phone tool and the 6-digit code the user provides. Returns whether the phone number is verified.",
  inputSchema: z.object({
    verificationId: z.string().describe("The verification ID returned by the verify-phone tool"),
    code: z.string().describe("The 6-digit code the user received and entered"),
  }),
  outputSchema: z.object({
    status: z.string(),
    verified: z.boolean(),
  }),
  execute: async ({ verificationId, code }) => {
    const result = await sendly.verify.check(verificationId, { code });
    return {
      status: result.status,
      verified: result.status === "verified",
    };
  },
});

export const listMessagesTool = createTool({
  id: "list-messages",
  description:
    "List recent SMS messages sent from this account. Returns message history with status, recipient, and content. Useful for checking delivery status or reviewing what was sent.",
  inputSchema: z.object({
    limit: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .default(10)
      .describe("Number of messages to return (1-100, default 10)"),
  }),
  outputSchema: z.object({
    messages: z.array(
      z.object({
        id: z.string(),
        to: z.string(),
        text: z.string(),
        status: z.string(),
        createdAt: z.string(),
      }),
    ),
    count: z.number(),
  }),
  execute: async ({ limit }) => {
    const response = await sendly.messages.list({ limit });
    return {
      messages: response.data.map((msg) => ({
        id: msg.id,
        to: msg.to,
        text: msg.text,
        status: msg.status,
        createdAt: msg.createdAt,
      })),
      count: response.data.length,
    };
  },
});

export const searchMessagesTool = createTool({
  id: "search-messages",
  description:
    "Search through sent SMS messages by text content. Uses full-text search to find messages containing specific words or phrases. Useful for finding a specific message or checking if a particular notification was sent.",
  inputSchema: z.object({
    query: z.string().describe("Search query to find in message text"),
    limit: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .default(10)
      .describe("Number of results to return (1-100, default 10)"),
  }),
  outputSchema: z.object({
    messages: z.array(
      z.object({
        id: z.string(),
        to: z.string(),
        text: z.string(),
        status: z.string(),
        createdAt: z.string(),
      }),
    ),
    count: z.number(),
  }),
  execute: async ({ query, limit }) => {
    const baseUrl = "https://sendly.live/api/v1";
    const res = await fetch(
      `${baseUrl}/messages?q=${encodeURIComponent(query)}&limit=${limit}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.SENDLY_API_KEY}`,
          "Content-Type": "application/json",
        },
      },
    );
    const response = (await res.json()) as {
      data: Array<{
        id: string;
        to: string;
        text: string;
        status: string;
        createdAt: string;
      }>;
    };
    return {
      messages: response.data.map((msg) => ({
        id: msg.id,
        to: msg.to,
        text: msg.text,
        status: msg.status,
        createdAt: msg.createdAt,
      })),
      count: response.data.length,
    };
  },
});

export const getBalanceTool = createTool({
  id: "get-balance",
  description:
    "Check the current SMS credit balance for this account. Returns total balance, reserved credits (for scheduled messages), and available credits. Each US/CA SMS costs 2 credits ($0.02), international varies by country.",
  inputSchema: z.object({}),
  outputSchema: z.object({
    balance: z.number(),
    reservedBalance: z.number(),
    availableBalance: z.number(),
  }),
  execute: async () => {
    const credits = await sendly.account.getCredits();
    return {
      balance: credits.balance,
      reservedBalance: credits.reservedBalance,
      availableBalance: credits.availableBalance,
    };
  },
});
