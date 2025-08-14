/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";

interface FeedbackData {
  feedback: string;
  rating?: number;
  email?: string;
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
    // fallback in case there's an error stringifying the maybeError
    // like with circular references for example.
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

    const clientIP =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown";

    const feedbackEntry = {
      id: `feedback_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      feedback: body.feedback.trim(),
      rating: body.rating || null,
      email: body.email?.trim() || null,
      page: body.page,
      userAgent:
        body.userAgent || request.headers.get("user-agent") || "unknown",
      clientIP,
      timestamp: body.timestamp || new Date().toISOString(),
      source: "docs",
    };

    await sendToAirtable(feedbackEntry);

    return NextResponse.json(
      {
        success: true,
        message: "Feedback submitted successfully",
        id: feedbackEntry.id,
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", message: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

async function sendToAirtable(feedback: any) {
  const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME || "Feedback";

  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    throw new Error(
      "Airtable configuration missing: AIRTABLE_API_KEY and AIRTABLE_BASE_ID are required",
    );
  }

  const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`;

  const payload = {
    records: [
      {
        fields: {
          "Feedback ID": feedback.id,
          "Feedback Text": feedback.feedback,
          Rating: feedback.rating,
          Email: feedback.email || "",
          "Page URL": feedback.page,
          "User Agent": feedback.userAgent,
          "Client IP": feedback.clientIP,
          Timestamp: feedback.timestamp.split("T")[0], // Convert to YYYY-MM-DD format
          Source: feedback.source,
          Status: "New",
          "Created Date": new Date().toISOString().split("T")[0], // YYYY-MM-DD format
        },
      },
    ],
  };

  const response = await fetch(airtableUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Airtable API error: ${response.status} ${response.statusText} - ${errorText}`,
    );
  }

  const result = await response.json();
  return result;
}
