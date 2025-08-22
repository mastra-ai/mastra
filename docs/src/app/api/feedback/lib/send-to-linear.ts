/* eslint-disable @typescript-eslint/no-explicit-any */
import { FeedbackData } from "./types";
import { mastra } from "@/mastra";

export async function sendToLinear(feedback: FeedbackData) {
  const LINEAR_API_KEY = process.env.LINEAR_API_KEY;
  const LINEAR_TEAM_ID = process.env.LINEAR_TEAM_ID;
  const LINEAR_PROJECT_ID = process.env.LINEAR_PROJECT_ID;

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

  if (!LINEAR_PROJECT_ID) {
    console.warn(
      "LINEAR_PROJECT_ID not configured, skipping Linear ticket creation",
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

  const getCycleQuery = `
    query getCurrentCycle {
      teams {
        nodes {
          activeCycle {
            id
          }
        }
      }
    }
  `;

  // Fetch current cycle
  const getCurrentCycle = async () => {
    try {
      const cycleResponse = await fetch(linearUrl, {
        method: "POST",
        headers: {
          Authorization: `${LINEAR_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: getCycleQuery,
        }),
      });

      if (!cycleResponse.ok) {
        console.warn(
          "Failed to fetch current cycle, proceeding without cycle assignment",
        );
        return null;
      }

      const cycleResult = await cycleResponse.json();

      if (cycleResult.errors) {
        console.warn("GraphQL errors when fetching cycle:", cycleResult.errors);
        return null;
      }

      // Find the first team with an active cycle
      const teams = cycleResult.data?.teams?.nodes || [];
      const teamWithCycle = teams.find((team: any) => team.activeCycle);

      return teamWithCycle?.activeCycle?.id || null;
    } catch (error) {
      console.warn("Error fetching current cycle:", error);
      return null;
    }
  };

  const res = await mastra
    .getAgent("summarizer")
    .generate(`Give me a succint title from ${feedback.feedback}`);

  // Get the current cycle ID
  const cycleId = await getCurrentCycle();

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
      ...(cycleId && { cycleId }), // Only add cycleId if it exists
      projectId: LINEAR_PROJECT_ID,
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
