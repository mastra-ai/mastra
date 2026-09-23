# Safe agency primitives

For the local Studio demo only (local mode, no external integrations, fixture input enabled), `await-approval` also accepts `{ localDemoDecision: true, decision, reason }`. This deliberately simulates `studio-soc-manager`, not human authentication. Server-bound plan, scope, expiry, decision/token/receipt operations and the containment gateway still apply; caller-supplied authority fields are rejected. Hosted/provider-enabled runtimes retain receipt-only resume. Keep local Studio private. See the [Studio walkthrough](how-to-test-studio.md).

The workflow owns the trusted tenant, incident, subject and run, and performs exactly three parallel provider reads through its read tools. Model-based scope validation is unnecessary: the scope-loading step validates the database-bound context server-side.

After each read, the configured SOC supervisor uses native Mastra sub-agent delegation to the source's specialist. The server allows exactly one matching delegation, replaces the delegated prompt and instructions with validated fact tokens, drops parent message history and limits the child to one step and the parent to two. The three specialist agents have no tools or memory. They cannot repeat provider calls or perform containment. Child JSON must contain the exact token list and no invented gaps or metadata; the parent must reproduce the validated child report. Unknown, duplicate, missing or failed delegations fail validation. These are bounded model reviews of already-read facts; they do not grant scope or decide authoritative severity.

Runtime assembly binds the configured supervisor, correlation analyst and response planner instances to workflow invokers. Injected deterministic invokers remain available for offline evaluation. Native delegation tests use real Mastra agents with synthetic language models; they prove orchestration and enforcement, not production model quality.

After suspend/resume and an authenticated approval decision, the containment step constructs a Mastra Tool with `requireApproval: true`. Its strict input contains only `actionId`; tenant, incident, run, approval and the exact plan are server-bound closure values. The workflow invokes the tool under the existing provider trace boundary. It is not registered on investigation agents.

The native approval flag is descriptive to Mastra's tool orchestration, not authorization. Even a direct programmatic `tool.execute` must pass the unchanged `ContainmentGateway` checks against persisted approval, manager role, tenant/run/plan/hash/expiry/action authority, provider preconditions and idempotency. Pending, rejected, expired, missing or stale authority produces no provider effect. Repeated valid execution returns the persisted result without repeating the effect.

No additional telemetry database writes occur at model boundaries. Existing Mastra traces and operational audit records remain the audit sources.
