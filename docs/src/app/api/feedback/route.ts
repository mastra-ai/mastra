/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { sendToNotion } from "./lib/send-to-notion";
import { sendToLinear } from "./lib/send-to-linear";
import { sendToSlack } from "./lib/send-to-slack";
import { getErrorMessage } from "./lib/error";
import { FeedbackData } from "./lib/types";


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
    };

    const [notionResult, linearResult] = await Promise.allSettled([
      sendToNotion(feedbackEntry),
      sendToLinear(feedbackEntry),
    ]);


    let linearTicketUrl = null;

    if (linearResult.status === 'fulfilled' && linearResult.value?.url) {
      linearTicketUrl = linearResult.value.url;
      try {
        await sendToSlack(feedbackEntry, linearTicketUrl);
      } catch (error) {
        console.error('Failed to send updated Slack notification with Linear link:', error);
      }
    }

    if (notionResult.status === 'rejected') {
      console.error('Failed to send to Notion:', notionResult.reason);
    }
 
    if (linearResult.status === 'rejected') {
      console.error('Failed to send to Linear:', linearResult.reason);
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
    return NextResponse.json(
      { error: "Internal server error", message: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

