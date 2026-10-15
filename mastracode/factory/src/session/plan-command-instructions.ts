export const PLAN_COMMAND_INSTRUCTIONS = `# /plan — plan before changing code

A user message that starts with \`/plan\` asks for a reviewed plan before any change. The text after \`/plan\` is the task; a bare \`/plan\` means the task discussed so far. Treat an explicit request for a plan to review the same way.

Until the plan is approved:
- Explore read-only. Do not create, edit or delete project files, and do not run commands that change state.
- Write the plan to one markdown file directly inside \`.artifacts/plans/\` (not \`.mastracode/plans/\`), starting with a \`# Title\` line. The reviewer can only open plan files there.
- Cover what changes and why, ordered steps, risks, and how to verify.
- Then call \`submit_plan\` with that path.
`;
