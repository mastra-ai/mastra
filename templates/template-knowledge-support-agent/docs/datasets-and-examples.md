# Datasets and examples

Run `npm run knowledge:seed` to load the guides and policy for the example selected by `SUPPORT_EXAMPLE`. The default example covers Square Terminal support. Its fictional case history is available separately.

| Dataset                | Contents                                                                                                 |
| ---------------------- | -------------------------------------------------------------------------------------------------------- |
| `retail-pos-docs`      | Square Terminal network, payment, and printer guides and the retail policy. This is the default dataset. |
| `retail-pos-history`   | Fictional retail cases and follow-up notes.                                                              |
| `software-integration` | An HTTP authentication guide, an integration policy, and a fictional case.                               |
| `it-helpdesk`          | A Windows network guide, a helpdesk policy, and fictional cases for two customer groups.                 |
| `retail-pos`           | Earlier retail example with the `north-*` and `south-store` profiles.                                    |

## Write a required safety policy

1. Use `## Before changes`, `## Prohibited actions`, and `## When uncertain` once each. Keep the rendered policy within 800 characters, including source attribution and links, so the agent receives it in full.
2. Review the Markdown and manifest entry, then run `npm run knowledge:seed -- --dry-run`. For each unapproved revision, the output gives the Knowledge reference and the SHA-256 digest to approve.
3. Put each reference and its approved digests in a JSON file, for example `{"tenant:example#policies/safe-changes": ["<64-character SHA-256>"]}`. Set `SUPPORT_POLICY_APPROVAL_FILE` to that file for both the seed and Studio. Allow only authorized operators to edit it.
4. Save approval changes to a separate file and run `npm run knowledge:seed -- --replace-policy-approvals next-approvals.json` to replace the configured approvals under the database writer lock. Keep the previous digest approved until the new seed succeeds. Run the dry run again, then run `npm run knowledge:seed` to apply the change.

To restore an older policy, restore its Markdown and manifest entry, check its approval with a dry run, then run the seed again.

## Add a support case

1. Add a Markdown file next to the [retail history manifest](../knowledge-datasets/retail-pos/history-manifest.json). Describe the symptom, what the technician observed, and how they verified the fix or what still needs checking.
2. Add the page to the manifest with a stable `key`, a unique `path` under `cases/`, and the customer's profile in `scope.profile`. The `record` fields help the agent find cases by topic.
3. Run `npm run knowledge:seed -- --dataset retail-pos-history --dry-run` to preview the result. Apply it with the same command without `--dry-run`. Ask about the case in a fresh **Support** chat for that customer.

For example, save the case narrative in `terminal-network-check.md` and add this entry to the `pages` array.

```json
{
  "key": "terminal-network-check",
  "path": "cases/terminal-network-check",
  "title": "Terminal connection drops during opening checks",
  "file": "terminal-network-check.md",
  "scope": {
    "kind": "customer",
    "profile": "retailops-store-42"
  },
  "kind": "case",
  "source": {
    "kind": "Fictional technician report"
  },
  "record": {
    "topicTags": ["connectivity"],
    "observedOn": "2026-11-18",
    "state": "open",
    "summary": "The terminal lost connectivity twice during opening checks.",
    "applicability": "The selected Wi-Fi network and connection indicator still need verification."
  }
}
```

Use `open` for unresolved observations and `approved` for verified outcomes. Add dated follow-ups under `notes` with stable keys. The existing Wi-Fi case in the manifest shows how to attribute a note.

## Adapt the template to your application

1. Copy an example in [runtime.ts](../src/examples/runtime.ts). Define the tenants, customers, technicians, and reviewers. Give technicians and reviewers different actor IDs.
2. Copy a dataset under `knowledge-datasets/` and give its manifest a new ID. Use `docs` for shared references, `tenant` for team guidance and policies, and `customer` for private cases. Credit external sources in the manifest.
3. Register the dataset in the new example and set `initialDataset`, the policy path, and the profiles that seed the data. Match the agent's instructions, topic terms, and response language to your content.
4. Set `SUPPORT_EXAMPLE` to the new example ID. Preview the seed with `--dry-run`, apply it, and try a support question with each profile.

## Try the software integration example

Stop Studio and run these commands from the project directory in a local shell. Unset `MASTRA_ENVIRONMENT_ID` if it is set.

```sh
export SUPPORT_MODE=local DATABASE_PROVIDER=local
export SUPPORT_EXAMPLE=software-integration
export SUPPORT_DATABASE_URL=file:./.local/integration.db
npm run knowledge:seed
npm run dev
```

Use the `integration-team` token. Ask **Support**, “Our HTTP integration returned 401. What evidence should I check?” Look for the RFC 9110 guide, a question about the authentication challenge, and whether the past case applies. To try review, use `integration-team` for the confirmation and `integration-reviewer` for the decision. [Confirmation and review steps](studio-walkthrough.md#2-confirm-and-review-a-private-finding)

## Try the IT helpdesk example

Stop Studio and run these commands from the project directory in a local shell. Unset `MASTRA_ENVIRONMENT_ID` if it is set.

```sh
export SUPPORT_MODE=local DATABASE_PROVIDER=local
export SUPPORT_EXAMPLE=it-helpdesk
export SUPPORT_DATABASE_URL=file:./.local/helpdesk.db
npm run knowledge:seed
npm run dev
```

Use the `helpdesk-office` token. Ask **Support**, “I need to investigate a Windows network connection. What should I check?” Look for the `ipconfig /all` guide, a question about the active adapter, and the fictional office case. Switch to `helpdesk-branch` and try to open `customer:helpdesk:office#cases/network-check` in **Knowledge**. The office case stays private to the office profiles.

To try review, report a fictional outcome as `helpdesk-office` and decide as `helpdesk-reviewer`. For shared guidance, cite `docs:helpdesk#guides/network-configuration` with the `network-guide` version in the seed output. [Confirmation and review steps](studio-walkthrough.md#2-confirm-and-review-a-private-finding)

If you used the earlier Portuguese example, run the seed again with the same database URL to update its pages to English.

## Manage local seed data

- Studio and the seed use `.local/support.db` by default. Set `SUPPORT_DATABASE_URL` in `.env` or in your shell to use a different local file.
- Keep dataset, page, and note keys stable when you update them. Reapplying the seed preserves IDs and versions for unchanged content. Removed entries stay in Knowledge and appear in the seed report.
- If the seed exits with code `75`, another process is writing to the database. Retry when it finishes.
