import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { feedbackData } from "../data/feedback";

const feedbackItemSchema = z.object({
  id: z.string(),
  text: z.string(),
  source: z.string(),
  date: z.string(),
  customer_tier: z.string(),
});

export const getFeedbackTool = createTool({
  id: "get-feedback",
  description:
    "Retrieves customer feedback from the database. Can filter by source, customer tier, or date range. Supports pagination via limit and offset. Use these to batch through large result sets without overwhelming the context window.",
  inputSchema: z.object({
    source: z
      .enum(["support_ticket", "app_review", "survey", "social_media"])
      .optional()
      .describe("Filter by feedback source"),
    customer_tier: z
      .enum(["free", "pro", "enterprise"])
      .optional()
      .describe("Filter by customer tier"),
    start_date: z
      .string()
      .optional()
      .describe("Filter feedback from this date onwards (YYYY-MM-DD)"),
    end_date: z
      .string()
      .optional()
      .describe("Filter feedback up to this date (YYYY-MM-DD)"),
    limit: z
      .number()
      .optional()
      .default(40)
      .describe("Maximum number of items to return (default: 40)"),
    offset: z
      .number()
      .optional()
      .default(0)
      .describe("Number of items to skip for pagination (default: 0)"),
  }),
  outputSchema: z.object({
    feedback: z.array(feedbackItemSchema),
    total: z.number().describe("Total matching items (before pagination)"),
    returned: z.number().describe("Number of items in this page"),
    limit: z.number(),
    offset: z.number(),
    has_more: z.boolean().describe("Whether more items are available"),
    filters_applied: z.record(z.string(), z.string()),
  }),
  execute: async (input) => {
    let filtered = [...feedbackData];

    const filtersApplied: Record<string, string> = {};

    if (input.source) {
      filtered = filtered.filter((item) => item.source === input.source);
      filtersApplied.source = input.source;
    }

    if (input.customer_tier) {
      filtered = filtered.filter(
        (item) => item.customer_tier === input.customer_tier,
      );
      filtersApplied.customer_tier = input.customer_tier;
    }

    if (input.start_date) {
      filtered = filtered.filter((item) => item.date >= input.start_date!);
      filtersApplied.start_date = input.start_date;
    }

    if (input.end_date) {
      filtered = filtered.filter((item) => item.date <= input.end_date!);
      filtersApplied.end_date = input.end_date;
    }

    const total = filtered.length;
    const limit = input.limit ?? 40;
    const offset = input.offset ?? 0;
    const page = filtered.slice(offset, offset + limit);

    return {
      feedback: page,
      total,
      returned: page.length,
      limit,
      offset,
      has_more: offset + limit < total,
      filters_applied: filtersApplied,
    };
  },
});
