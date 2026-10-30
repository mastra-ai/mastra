# Attio

Use a dedicated company list for qualification. New Triage entries start research; confirmed outcomes update the entry, while uncertain cases move to Needs review. Stage, Summary, and Justification are the working fields. Metadata holds submitted input and protected machine output.

## Select Attio

Set `LEAD_INPUT_PROVIDER=attio`, `LEAD_OUTPUT_PROVIDER=attio`, `ATTIO_API_TOKEN`, and `ATTIO_WEBHOOK_SECRET` in `.env`. To use only one direction, select Attio for that direction. Output alone needs no webhook secret and uses Studio/API review.

Create a token in [Attio developer settings](https://app.attio.com/settings/developers). Runtime needs `record_permission:read`, `object_configuration:read`, `list_entry:read-write`, and `list_configuration:read`. Setup also needs `list_configuration:read-write` to create missing attributes and options.

## Map a dedicated list

Inspect a plan for an existing company list:

```bash
node --env-file=.env --import tsx scripts/attio-setup.ts --list-id <list-uuid>
```

For a new list, replace `--list-id` with `--new-list "Lead Qualification" --list-slug lead_qualification`. Repeat the chosen command with `--apply` to create missing resources and write `attio.mapping.json`. The mapping contains IDs and limits; credentials stay in `.env`.

Keep the application stopped when replacing mappings and reconcile active work first. Setup reuses compatible resources, stops on conflicts, and preserves the previous mapping as a backup. It doesn't register webhooks. Field definitions and limits are in `src/mastra/config/attio.ts`.

| Field         | Use                                                        |
| ------------- | ---------------------------------------------------------- |
| Stage         | Triage, Needs review, Qualified, Nurture, Disqualified     |
| Summary       | Findings, score, public sources, and next action           |
| Justification | Optional reviewer explanation, up to 2,000 characters      |
| Metadata      | Structured input, assessment references, and output marker |

Add a company with one unambiguous domain to the mapped list at Stage Triage. For inbound intent, include `Metadata.input.inquiry` when creating the entry, using the [inquiry contract](intake.md#include-a-buying-inquiry):

```json
{
  "version": 2,
  "input": {
    "inquiry": {
      "type": "demo_request",
      "occurredAt": "2026-10-19T12:00:00Z",
      "text": "Please show our procurement team a demo."
    }
  }
}
```

## Receive webhooks

Expose `/lead-qualification/webhooks/attio` through HTTPS. Register the `list-entry.created` and Stage `list-entry.updated` filters printed by setup in [Attio webhooks](https://docs.attio.com/rest-api/guides/webhooks). Use their signing secret as `ATTIO_WEBHOOK_SECRET`.

The signed endpoint persists deliveries before acknowledging them. The worker reads authoritative entry/company data and processes relevant events. Production authentication still protects Studio and the other API routes.

## Review by Stage

For a pending review, inspect Summary and move Stage to Qualified, Nurture, or Disqualified. Justification is optional. The adapter verifies the workspace member, active value history, packet, and timestamp before recording the decision. Machine output must remain unchanged. Editing Summary, Metadata, or Justification alone doesn't approve a review.

On a closed entry, Needs review opens a new review revision using the same assessment. Triage requests a fresh linked assessment. Active work or unresolved output conflicts block a new cycle. Earlier decisions and assessments remain in history.

Inspect failures through the run endpoint or `/lead-qualification/attio/deliveries/:deliveryId`. Retry limits and Retry-After are respected. Output uses read-then-write followed by read-back; the API doesn't provide an atomic compare-and-set guarantee. Keep Metadata intact and reconcile conflicting edits before resuming work.

## Observe sales outcomes

An optional `sales` mapping can read Won/Lost transitions from a separate list. Map its stage, assessment ID, cycle ID, and outcome options, then register that list's Stage subscription. IDs must reference an applied qualification. These observations feed the [aggregate report](observability.md); the template doesn't create deals or sales handoffs.
