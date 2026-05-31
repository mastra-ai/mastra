---
name: agent-prompt-quality-bar
description: Universal quality bar and final audit rubric for any agent system prompt. Activate this whenever you are unsure which archetype skill applies, or as a final review pass before writing the system prompt. It defines the required run contract, completion criteria, fallback paths, response format, and anti-patterns every produced agent prompt must satisfy.
---

# Universal Agent-Prompt Quality Bar

This is the builder's compile check. If no archetype skill matches the user's request, OR if you want a final review pass after picking an archetype, follow these rules to write a great agent system prompt.

A produced agent is good only when it can finish a real run, not when it merely sounds capable.

## Required run contract

Before writing the produced system prompt, instantiate this contract for the user's request:

1. **Trigger / input** — what starts the run: a user message, schedule, webhook, file, spreadsheet row, support ticket, document, or event.
2. **Owned outcome** — the one concrete result the agent is responsible for finishing.
3. **Available capabilities** — only the tools, data sources, workflows, agents, or stored skills actually attached or available.
4. **Missing-capability fallback** — what the agent must do when a required integration, credential, workspace, permission, source, or input is absent.
5. **Done criteria** — how the agent proves the job is complete, including tool confirmation, read-back, tests, citations, delivery receipt, or an explicit not-run reason.
6. **Final response format** — the exact receipt, report, draft, diff summary, confirmation, or escalation note the user receives.

## Non-negotiable sections

Every produced agent system prompt MUST contain these sections. If any is missing, the agent will underperform.

### 1. Role and outcome

- One sentence: who the agent is and the _single outcome_ it owns.
- Bad: "You are a helpful AI assistant."
- Good: "You are Acme's Tier-1 Email Triager. You reply to inbound billing and account tickets, or escalate cases that need a human."

### 2. Trigger and input

- Name what starts a run and what data the agent expects.
- Bad: implicit trigger.
- Good: "A run starts when the user provides a support ticket or a scheduled inbox workflow passes unread tickets to you."

### 3. Decision rules

- 3–6 bullets stating the defaults the agent uses when the request is ambiguous.
- Replace broad "ask the user" language with explicit choices unless action is impossible or unsafe.
- Bad: "If unsure, ask the user."
- Good: "If the customer didn't specify a region, default to the account's billing country and state that assumption once."

### 4. Capability awareness

- Describe capabilities only if they are attached or available.
- Phrase them in outcome terms, not internal ids.
- Bad: "Use `sheetsTool` and `emailWorkflow`."
- Good: "You can read and update the connected leads sheet, and you can draft follow-up emails."

### 5. Missing-capability fallback

- Include explicit behavior for missing integrations, credentials, workspace, permissions, or data.
- Bad: agent silently invents success.
- Good: "If spreadsheet access is missing, stop and say: 'I need access to the leads sheet before I can update rows.'"

### 6. Communication style and final response format

- Tone, length, structure, and exact output shape.
- Bad: "Be friendly and helpful."
- Good: "Return a receipt with: action taken, affected records, status, verification, and next step if any."

### 7. Refusals and escalations

- What the agent will not do, and what it does instead.
- Always include out-of-scope and missing-capability refusals.
- For real user data or external systems, include destructive-action and privacy/security boundaries.

### 8. Completion criteria

- An explicit numbered list of conditions that MUST all be true before the agent stops.
- This is the single most important section. It is the #1 reason agents stop mid-task or wander.
- Good:
  > Completion criteria — you are NOT done until:
  >
  > 1. The action was attempted, not merely planned.
  > 2. The result was verified by read-back, status code, test output, citation, or tool confirmation.
  > 3. Failures are reported with the specific item and reason.
  > 4. The final response follows the required format.
  >    Stop only when all four are true.

### 9. Worked example

- Include one short input → behavior → final output example.
- The example must demonstrate a complete run, including verification or a clean fallback.
- Do not leave placeholder names or vague "then respond" endings.

## Mandatory final audit rubric

Before calling the tool that writes the produced system prompt, verify every item below is true:

- **Single concrete outcome**: the role owns one job, not a vague domain.
- **Named trigger/input**: the prompt says exactly what starts a run.
- **Capabilities are accurate**: the prompt describes only attached/available tools, workflows, agents, data sources, or stored skills.
- **Missing integration behavior exists**: the prompt has a clean refusal/fallback for absent tools, credentials, permissions, workspace, or source data.
- **Completion criteria are verifiable and tool-aware**: done means confirmed, read back, tested, cited, delivered, or explicitly not run with a reason.
- **Final response format is specified**: the user knows what receipt/report/draft/confirmation to expect.
- **No placeholders remain**: no `<...>`, "TBD", "TODO", "your company", "policy here", or generic policy gaps.
- **No internal terms leak**: no builder playbook names, tool ids, schemas, file paths, or implementation jargon.
- **No unsupported promises**: the prompt never claims the agent can browse, send, edit files, access sheets, run tests, or update accounts unless that capability is attached.
- **Refusal path is present**: unsafe, out-of-scope, destructive, or unsupported requests have explicit behavior.
- **Worked example completes a full run**: not just a sample input; it shows the expected action and final output.

If any item fails, revise the system prompt before writing it.

## Universal anti-patterns to reject

- **No completion criteria.** Agent never finishes. Fix: add a numbered "done when" list.
- **"Ask the user if unsure."** Agent stalls on every request. Fix: state defaults, and ask only when action is impossible or unsafe.
- **No scope.** Agent drifts into unrelated requests. Fix: explicit in-scope / out-of-scope lists.
- **Too many tools.** Agent makes worse choices with more options. Fix: attach the minimum.
- **Generic identity ("helpful assistant").** Produces generic output. Fix: name a specific outcome.
- **No missing-capability fallback.** Agent hallucinates success. Fix: state exactly when to stop and what to tell the user.
- **Marketing voice in instructions ("be amazing", "delight users").** Untestable. Fix: concrete behaviors.

## How to use this skill

If you already activated an archetype skill (coding, spreadsheet, research, customer-support, content-writer, ops-automation, generic-assistant), the archetype's template provides the domain rules. Use this skill as the final compile check.

If no archetype fit and the user's outcome is genuinely novel:

1. Draft the run contract.
2. Write each required section from scratch.
3. Apply the mandatory final audit rubric.
4. Reject anything that drifts toward the anti-patterns list.

## Cross-references

- `coding-agent` — for code-writing/editing/review agents.
- `spreadsheet-agent` — for tabular data agents.
- `research-agent` — for research-and-report agents.
- `customer-support-agent` — for ticket / inbox triage agents.
- `content-writer-agent` — for marketing / blog / social agents.
- `ops-automation-agent` — for recurring / event-driven internal automation.
- `generic-assistant` — fallback for general personal helpers.
