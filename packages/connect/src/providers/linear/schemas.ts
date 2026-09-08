// AUTO-GENERATED from NangoHQ/integration-templates @ <SHA> — do not edit by hand.
import { z } from 'zod';

// —— create-issue ——
export const createIssueInput = z.object({
  teamId: z.string().describe('Team ID. Example: "9cfb482a-81e3-4154-b5b9-2c805e70a02d"'),
  title: z.string().describe('Issue title'),
  description: z.string().optional().describe('Issue description in markdown'),
  priority: z
    .number()
    .int()
    .min(0)
    .max(4)
    .optional()
    .describe('Priority from 0 (no priority) to 4 (low). 1=urgent, 2=high, 3=medium'),
  stateId: z.string().optional().describe('Workflow state ID'),
  assigneeId: z.string().optional().describe('Assignee user ID'),
  cycleId: z.string().optional().describe('Cycle ID'),
  labelIds: z.array(z.string()).optional().describe('Array of label IDs'),
  projectId: z.string().optional().describe('Project ID'),
});

export const createIssueOutput = z.object({
  id: z.string(),
  identifier: z.string().optional(),
  title: z.string().optional(),
  url: z.string().optional(),
  description: z.string().optional(),
  priority: z.number().int().optional(),
  stateId: z.string().optional(),
  assigneeId: z.string().optional(),
  teamId: z.string().optional(),
  cycleId: z.string().optional(),
  projectId: z.string().optional(),
});

const providerIssueSchema = z.object({
  id: z.string(),
  identifier: z.string().optional(),
  title: z.string().optional(),
  url: z.string().optional(),
  description: z.string().optional().nullable(),
  priority: z.number().int().optional().nullable(),
  state: z.object({ id: z.string() }).optional().nullable(),
  assignee: z.object({ id: z.string() }).optional().nullable(),
  team: z.object({ id: z.string() }).optional().nullable(),
  cycle: z.object({ id: z.string() }).optional().nullable(),
  project: z.object({ id: z.string() }).optional().nullable(),
});

export const createIssueProviderResponse = z.object({
  data: z.object({
    issueCreate: z.object({
      success: z.boolean(),
      issue: providerIssueSchema.optional().nullable(),
    }),
  }),
  errors: z.array(z.object({ message: z.string(), path: z.array(z.string()).optional() })).optional(),
});
