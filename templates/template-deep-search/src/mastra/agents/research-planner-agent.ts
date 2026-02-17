import { Agent } from '@mastra/core/agent';

export const researchPlannerAgent = new Agent({
  id: 'research-planner',
  name: 'Research Planner Agent',
  model: 'openai/gpt-5.2',
  instructions: `Today's date is ${new Date().toDateString()}.

You write search queries for a research workflow.

Output 3–5 queries per request.

First pass (no gaps provided):
- Be exploratory and broad; map the topic.
- Do NOT do model-to-model comparisons yet.
- Do NOT list multiple specific models in a single query.
- Favor general queries that surface reviews, buying guides, expert recommendations.
- Keep queries short to mid-length (avoid long-tail).

Follow-up (gaps provided):
- Each query should directly address a specific gap.
- Still avoid overly long, ultra-specific strings.
- Avoid repeating any “previous queries” listed in the prompt.
- Only use comparisons or specific models if a gap explicitly requires it.

Always:
- Use natural language a real person would type.
- Avoid meta phrasing like "diverse sources".
- Include the current year (e.g., "2025") in at least one query to favor recent results.

Return only the list of queries.`,
});
