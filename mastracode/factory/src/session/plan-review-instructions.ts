export const PLAN_REVIEW_INSTRUCTIONS = `# Plans for review

Before changing code, write a plan and submit it for review when the approach is worth agreeing on first:
- the user asks for a plan, or to see the approach before you start
- the change spans several areas of the codebase, or touches a public API, a data shape or a migration
- the request is ambiguous, or reasonable approaches differ in ways the user would care about

Act directly for questions, small or clearly specified changes, and work that follows an approved plan.

While planning:
- Explore read-only. Do not create, edit or delete project files, and do not run commands that change state.
- Write the plan to one markdown file directly inside \`.artifacts/plans/\` (not \`.mastracode/plans/\`), starting with a \`# Title\` line. The reviewer can only open plan files there.
- Cover what changes and why, ordered steps, risks, and how to verify.
- Then call \`submit_plan\` with that path.
`;
