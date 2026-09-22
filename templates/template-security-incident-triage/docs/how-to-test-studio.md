# Try the workflow in Studio

Start the app, paste a sample alert, review the plan, and approve or reject it. You only need an OpenAI API key.

## Start locally

Install dependencies with `npm install`. Copy `.env.example` to `.env` if you have not already created it, then set `OPENAI_API_KEY`. Keep the local settings and all integration flags disabled. Do not overwrite an existing `.env` with credentials you still need.

```bash
npm run dev
```

The first start downloads an embedding model and indexes the runbooks. Wait for Studio to be ready, then open [localhost:4111](http://localhost:4111) and select **Workflows → securityIncidentWorkflow**.

The OpenAI model uses your API key. Identity, device, country and containment providers use sample data. You do not need WorkOS, IPinfo, Linear, `LOCAL_APPROVALS_ENABLED`, or approval secrets for this path.

## Choose a sample alert

Open a file below, copy its JSON into the workflow input, and start a new run.

| Sample                                                                  | Expected result                                                    |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [Unfamiliar device](../scripts/fixtures/studio/01-new-device.json)      | Prepares a response plan and pauses for approval.                  |
| [Login from the US](../scripts/fixtures/studio/02-country-us.json)      | Closes as benign without a containment plan or approval.           |
| [Login from Brazil](../scripts/fixtures/studio/03-country-br.json)      | Proposes containment of the sample session and waits for approval. |
| [Privilege change](../scripts/fixtures/studio/04-privilege-change.json) | Proposes restoring the previous role and waits for approval.       |

These alerts use `source: "studio-demo"`. The local workflow gives each new run a fresh event ID and timestamp, so you can reuse the files. Retries of the same run retain their original identity.

Country and device checks are simulated. The Brazil example is outside the sample US policy; its response targets a session, not an IP firewall rule.

## Review and decide

Inspect the evidence, runbook citations, severity, summary and proposed actions in the completed steps. An actionable incident pauses at `await-approval` with status `suspended`. No containment has happened yet.

In that step's **Resume** input, paste [resolve.json](../scripts/fixtures/studio/resolve.json) to approve the displayed plan or [reject.json](../scripts/fixtures/studio/reject.json) to finish without containment.

Approve before the plan's `expiresAt` time. The server still checks the plan, tenant, run and expiry; the local decision input supplies a simulated operator decision. Approved runs execute and verify local actions, then return `contained`. Rejected runs return `rejected` without executing containment.

To repeat a scenario, create a new run. A finished or expired run is not a fresh approval request.

## If the run needs attention

- `manual-review` means required evidence or model validation was unavailable. Inspect the branch results and reason codes.
- `blocked` means an integrity or scope check failed. Inspect the step result before retrying.
- If the model request fails, check the API key and the model error. The local providers do not replace the OpenAI model in Studio.

For an automated walkthrough without model calls, use the [local demo](local-demo.md). For real providers, follow [provider setup](provider-setup.md) and submit signed events through Hono. Local sample approvals are disabled when external integrations are enabled.
