# Studio walkthrough

Complete the Quickstart in the [README](../README.md) with a fresh local database for the documentation-only start. Use a separate browser session for each profile. The private credential file printed by `npm run dev` contains the generated tokens for that launch.

| Profile                | Tenant        | Customer   | Actor               |
| ---------------------- | ------------- | ---------- | ------------------- |
| `retailops-store-42`   | `retailops`   | `store-42` | `alex`              |
| `retailops-colleague`  | `retailops`   | `store-42` | `lee`               |
| `retailops-store-73`   | `retailops`   | `store-73` | `riley`             |
| `fieldretail-store-42` | `fieldretail` | `store-42` | `sam`               |
| `retailops-reviewer`   | `retailops`   | `store-42` | `morgan` (reviewer) |

## 1. Explore the initial Knowledge

As `retailops-store-42`, open **Knowledge**, select **support**, and explore the guides, link graph and `tenant:retailops#policies/safe-changes`. The guides contain original summaries of vendor references with links and verification dates. Start a **Support** chat about intermittent Wi-Fi. Look for the network guide citation, a diagnostic question, and the empty customer history.

## 2. Confirm and review a private finding

Continue the chat with a fictional observation.

> Confirmed: The terminal had selected the guest Wi-Fi network while an adjacent device on the intended network stayed connected. No offline payments were pending. With authorization we selected the intended network and three checks succeeded. Public reference docs:retailops#guides/network, version 1.

Find the thread ID and confirmed message ID in the authenticated Memory response `GET /api/memory/threads/<threadId>/messages?agentId=support`, using the technician session. Switch to the reviewer profile and start **Review** with these inputs.

```json
{
  "threadId": "<technician thread>",
  "messageId": "<confirmed user message>",
  "sourceActorId": "alex",
  "audience": "private"
}
```

Inspect the suspended `review-decision` proposal, including its content, target, and evidence. Resume it with its exact revision.

```json
{
  "decision": "approve",
  "revision": "<stored proposal revision>",
  "reason": "Verified the confirmed network selection and observed checks"
}
```

Approval publishes the reviewed record to the customer's Knowledge. To try rejection, start a separate proposal for a different confirmed observation. Choose `reject` and check that the proposed page is absent.

A suspended proposal saved by an earlier version may fail current validation and be denied resume. As its owning reviewer, inspect the saved review for invalid record fields, including topic tags longer than 80 characters, or text exceeding the native page-description or note limits. Start a fresh Review from the same confirmed message and inspect the new proposal before deciding. The earlier proposal remains in the audit history.

## 3. Approve a shared finding and reuse it

Start a separate **Review** proposal for the same confirmation with `audience` set to `tenant`. Inspect the sanitized guidance, the conditions where it applies, and the public source revision before approving. Use `retailops-store-73` to start a new Support conversation about an unintended Wi-Fi network. Ask for reviewed findings and look for the approved `tenant:retailops#learnings/…` reference.

## 4. Load customer history

Run `npm run knowledge:seed -- --dataset retail-pos-history` and start a fresh Store 42 connectivity chat as `retailops-store-42`. Check the dates, applicability, and references. The preflight supplies up to three matching records and distinguishes unresolved observations from verified outcomes.

## 5. Check isolation

Browse and chat as `retailops-store-73` and `fieldretail-store-42` to see each profile's own case and follow-up note. Try those same references as `retailops-store-42` and check that the foreign records are unavailable. As `retailops-colleague`, check that Store 42's shared customer Knowledge is visible and Alex's conversation is private. A fresh thread starts with its own conversation history.

## 6. Refresh the policy in the same chat

Ask about factory-resetting a terminal with pending offline payments. Edit the [example team's policy](../knowledge-datasets/retail-pos/retail-policy.md), for example by adding a step to contact the on-duty lead. Apply it with `npm run knowledge:seed -- --dataset retail-pos-docs`, reload the Knowledge explorer, and continue the same chat. Look for the updated pinned Knowledge and guidance based on the revised policy.
