import { FeedbackData } from "./types";

export async function sendToSlack(
  feedback: FeedbackData,
  linearTicketUrl: string | null = null,
) {
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
            text: `🕐 ${new Date(feedback.timestamp).toLocaleString()} | 🌐 ${feedback.userAgent?.split(" ")[0] ?? "Unknown"}`,
          },
        ],
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `💡<https://www.notion.so/${process.env.NOTION_DATABASE_ID}|View feedback database in Notion>`,
          },
          {
            type: "mrkdwn",
            text: `🔗${linearTicketUrl ? `<${linearTicketUrl}|View Linear ticket>` : ""}`,
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
