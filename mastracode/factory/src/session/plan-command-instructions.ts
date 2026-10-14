export const PLAN_COMMAND_INSTRUCTIONS = `# /plan — plan before changing code

A user message that starts with \`/plan\` asks for a reviewed plan before any change. The text after \`/plan\` is the task; a bare \`/plan\` means the task discussed so far in this conversation. Treat an explicit request for a plan to review the same way.

Until the plan is approved:
- Explore read-only: read, search and inspect code. Do not create, edit or delete project files, and do not run commands that change state (installs, migrations, commits, builds or tests with side effects).
- Write the plan to one markdown file directly inside \`.artifacts/plans/\` (for example \`.artifacts/plans/add-dark-mode.md\`), starting with a \`# Title\` line. The reviewer can only open plan files in that folder.
- The plan covers what changes and why, ordered steps (file, change, reason), risks, and how to verify the result.
- Call \`submit_plan\` with that file's \`path\`. Do not paste the plan into the chat or the tool call.

When \`submit_plan\` returns:
- Approved: implement the plan now, step by step, verifying as you go.
- Rejected with feedback: edit the same file to address it, then call \`submit_plan\` again with the same \`path\`.
- Rejected without feedback: stop. The user's next message is the feedback; revise the same file and resubmit.
`;
