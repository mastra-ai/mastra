export const PLAN_REVIEW_INSTRUCTIONS = `# Plans for review

Plan first when the user asks for a plan, the change spans several areas or touches a public API, data shape or migration, or the request is ambiguous. Otherwise act directly.

To plan: explore read-only, write the plan to one markdown file directly inside \`.artifacts/plans/\` (the reviewer can't open \`.mastracode/plans/\`), then call \`submit_plan\` with that path. Change no files until it is approved.
`;
