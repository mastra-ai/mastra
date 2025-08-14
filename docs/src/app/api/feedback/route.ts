import { NextRequest, NextResponse } from "next/server";

interface FeedbackData {
  feedback: string;
  rating?: number;
  email?: string;
  page: string;
  userAgent?: string;
  timestamp: string;
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
      id: `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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

    try {
      await sendToAirtable(feedbackEntry);
    } catch (airtableError) {
      await logFeedback(feedbackEntry);
    }

    return NextResponse.json(
      {
        success: true,
        message: "Feedback submitted successfully",
        id: feedbackEntry.id,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Feedback submission error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// Simple logging function that can be replaced with actual storage
async function logFeedback(feedback: any) {
  // In a real implementation, this would save to your chosen storage
  // For development purposes, we'll just log detailed info

  const logEntry = {
    ...feedback,
    processed: new Date().toISOString(),
  };

  // This could be:
  // - Written to a file
  // - Sent to a logging service
  // - Stored in a database
  // - Sent to Airtable/Notion/etc.

  console.log("💾 Feedback logged:", JSON.stringify(logEntry, null, 2));

  // You could also write to a local file for development:
  // const fs = require('fs').promises;
  // await fs.appendFile('feedback.log', JSON.stringify(logEntry) + '\n');
}

// Airtable integration
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
          Timestamp: feedback.timestamp,
          Source: feedback.source,
          Status: "New",
          "Created Date": new Date().toISOString().split("T")[0], // YYYY-MM-DD format
        },
      },
    ],
  };

  console.log("🚀 Sending to Airtable:", airtableUrl);
  console.log("📋 Payload:", JSON.stringify(payload, null, 2));

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
    console.error("Airtable API Error Response:", {
      status: response.status,
      statusText: response.statusText,
      body: errorText,
    });
    throw new Error(
      `Airtable API error: ${response.status} ${response.statusText} - ${errorText}`,
    );
  }

  const result = await response.json();
  console.log("✅ Airtable response:", result);
  return result;
}
