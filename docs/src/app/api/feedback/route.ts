/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";

interface FeedbackData {
  feedback: string;
  rating?: number;
  page: string;
  userAgent?: string;
  timestamp: string;
}

type ErrorWithMessage = {
  message: string;
};

function isErrorWithMessage(error: unknown): error is ErrorWithMessage {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as Record<string, unknown>).message === "string"
  );
}

function toErrorWithMessage(maybeError: unknown): ErrorWithMessage {
  if (isErrorWithMessage(maybeError)) return maybeError;

  try {
    return new Error(JSON.stringify(maybeError));
  } catch {
    return new Error(String(maybeError));
  }
}

function getErrorMessage(error: unknown) {
  return toErrorWithMessage(error).message;
}

export async function POST(request: NextRequest) {
  try {
    const body: FeedbackData = await request.json();

    if (!body.feedback || body.feedback.trim().length < 10) {
      return NextResponse.json(
        { error: "Feedback must be at least 10 characters" },
        { status: 400 },
      );
    }

    if (!body.page) {
      return NextResponse.json(
        { error: "Page information is required" },
        { status: 400 },
      );
    }

    const now = new Date();
    const dateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD
    const timeStr = now.toTimeString().split(" ")[0].replace(/:/g, ""); // HHMMSS
    const randomId = Math.random().toString(36).substring(2, 6).toUpperCase(); // 4 char random

    const feedbackEntry = {
      id: `FEEDBACK-${dateStr}-${timeStr}-${randomId}`,
      feedback: body.feedback.trim(),
      rating: body.rating || null,
      page: body.page,
      userAgent:
        body.userAgent || request.headers.get("user-agent") || "unknown",
      timestamp: body.timestamp || new Date().toISOString(),
      source: "docs",
    };

    await sendToNotion(feedbackEntry);
    await sendToSlack(feedbackEntry);

    return NextResponse.json(
      {
        success: true,
        message: "Feedback submitted successfully",
        id: feedbackEntry.id,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error", message: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

async function sendToNotion(feedback: any) {
  const NOTION_API_KEY = process.env.NOTION_API_KEY;
  const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;

  if (!NOTION_DATABASE_ID) {
    throw new Error(
      "Notion configuration missing: NOTION_DATABASE_ID is required",
    );
  }

  if (!NOTION_API_KEY) {
    throw new Error("Notion configuration missing: NOTION_API_KEY is required");
  }

  const notionUrl = `https://api.notion.com/v1/pages`;

  const payload: any = {
    parent: {
      type: "database_id",
      database_id: NOTION_DATABASE_ID,
    },
    properties: {
      "Feedback ID": {
        title: [
          {
            type: "text",
            text: { content: feedback.id },
          },
        ],
      },
      "Feedback Text": {
        rich_text: [
          {
            type: "text",
            text: { content: feedback.feedback },
          },
        ],
      },
      "Page URL": {
        url: feedback.page,
      },
      "User Agent": {
        rich_text: [
          {
            type: "text",
            text: { content: feedback.userAgent },
          },
        ],
      },

      Timestamp: {
        date: { start: feedback.timestamp },
      },
      Source: {
        select: { name: feedback.source },
      },
      Status: {
        select: { name: "New" },
      },
    },
  };

  // Add optional properties if they exist
  if (feedback.rating) {
    payload.properties["Rating"] = {
      number: feedback.rating,
    };
  }

  const response = await fetch(notionUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${NOTION_API_KEY}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Notion API error: ${response.status} ${response.statusText} - ${errorText}`,
    );
  }

  const result = await response.json();
  return result;
}

async function sendToSlack(feedback: any) {
  const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

  if (!SLACK_WEBHOOK_URL) {
    console.warn(
      "SLACK_WEBHOOK_URL not configured, skipping Slack notification",
    );
    return;
  }

  const getRatingText = (rating: number | null) => {
    if (!rating) return "No rating";
    switch (rating) {
      case 3:
        return "😊 Helpful";
      case 2:
        return "😐 Somewhat helpful";
      case 1:
        return "😕 Not helpful";
      default:
        return "No rating";
    }
  };

  const ratingText = getRatingText(feedback.rating);

  const page = `${process.env.NEXT_PUBLIC_APP_URL}${feedback.page}`;

  const slackMessage = {
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "📝 New Docs Feedback Received",
          emoji: true,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Feedback ID:*\n\`${feedback.id}\``,
          },
          {
            type: "mrkdwn",
            text: `*Rating:*\n${ratingText}`,
          },
          {
            type: "mrkdwn",
            text: `*Page:*\n<${page}|View Docs Page>`,
          },
          {
            type: "mrkdwn",
            text: `*Source:*\n${feedback.source}`,
          },
        ],
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Feedback:*\n> ${feedback.feedback}`,
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `🕐 ${new Date(feedback.timestamp).toLocaleString()} | 🌐 ${feedback.userAgent.split(" ")[0] ?? "Unknown"}`,
          },
        ],
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `💡 <https://www.notion.so/${process.env.NOTION_DATABASE_ID}|View feedback database in Notion>`,
          },
        ],
      },
    ],
  };

  try {
    const response = await fetch(SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(slackMessage),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `Slack webhook error: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }
  } catch (error) {
    console.error("Failed to send Slack notification:", error);
  }
}
