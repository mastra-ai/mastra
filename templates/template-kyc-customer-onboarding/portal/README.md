# Example KYC portal

This optional React portal demonstrates applicant, reviewer and senior-reviewer journeys over the same durable workflow used by Mastra Studio.

From the repository root, start the portal, API, and Mastra Studio together:

```bash
npm run dev
```

Open `http://127.0.0.1:5173`. The portal shows synthetic application input, current status, redacted events, pending actions and terminal outcomes. It stores CSRF and idempotency state only in memory and does not write applicant data or tokens to browser storage.

The built-in personas and process-local session cookie are demo controls, not production IAM or RBAC. Replace them before real deployment and keep tenant, origin, authorization and PII boundaries enforced by the API.
