import { FeedbackData } from "./types";

export async function sendToNotion(feedback: FeedbackData) {
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

  const payload = {
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
      Status: {
        select: { name: "New" },
      },
      Rating: {
        number: feedback.rating,
      },
    },
  };

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
