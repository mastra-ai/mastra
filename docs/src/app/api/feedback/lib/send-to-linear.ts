import { FeedbackData } from "./types";
import { mastra } from "@/mastra";

export async function sendToLinear(feedback: FeedbackData) {
  const LINEAR_API_KEY = process.env.LINEAR_API_KEY;
  const LINEAR_TEAM_ID = process.env.LINEAR_TEAM_ID;

  if (!LINEAR_API_KEY) {
    console.warn(
      "LINEAR_API_KEY not configured, skipping Linear ticket creation",
    );
    return null;
  }

  if (!LINEAR_TEAM_ID) {
    console.warn(
      "LINEAR_TEAM_ID not configured, skipping Linear ticket creation",
    );
    return null;
  }

  const linearUrl = "https://api.linear.app/graphql";

  // Get priority based on rating
  const getPriority = (rating: number | null) => {
    if (!rating) return 3;
    switch (rating) {
      case 3:
        return 3; // Normal
      case 2:
        return 2; // High
      case 1:
        return 1; // Urgent
      default:
        return 3; // Normal
    }
  };

  const priority = getPriority(feedback.rating);
  const page = `${process.env.NEXT_PUBLIC_APP_URL}${feedback.page}`;

  const mutation = `
    mutation IssueCreate($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue {
          id
          identifier
          title
          url
        }
      }
    }
  `;

  const res = await mastra
    .getAgent("summarizer")
    .generate(`Give me a succint title from ${feedback.feedback}`);

  const variables = {
    input: {
      teamId: LINEAR_TEAM_ID,
      title: `MDF: ${res.text}`,
      description: `
${feedback.feedback},
Affected Page: ${page}
`,
      priority: priority,
      assigneeId: "3237bea7-049c-48f5-bb95-57e00e5f31c4",
    },
  };

  try {
    const response = await fetch(linearUrl, {
      method: "POST",
      headers: {
        Authorization: `${LINEAR_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: mutation,
        variables: variables,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Linear API error: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const result = await response.json();

    if (result.errors) {
      throw new Error(
        `Linear GraphQL errors: ${JSON.stringify(result.errors)}`,
      );
    }

    if (!result.data?.issueCreate?.success) {
      throw new Error("Failed to create Linear issue");
    }

    //might want to parse this
    const issue = result.data.issueCreate.issue;

    return {
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      url: issue.url,
    };
  } catch (error) {
    console.error("Failed to create Linear ticket:", error);
    throw error;
  }
}
