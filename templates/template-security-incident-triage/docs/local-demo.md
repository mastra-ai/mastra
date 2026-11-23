# Key-free local demo

From the repository root with Node 22, choose a **new output directory**:

```bash
npm run demo:local -- --output /tmp/security-local-demo
```

No `.env`, model key, provider account, Redis or listening HTTP server is used. Requests go through the real Hono webhook route and request-context middleware in-process, using a newly generated synthetic signing secret and an injected fixture clock. Agent invokers and embeddings are deterministic; this is not a demonstration of live-model reasoning or browser/AuthKit authentication.

For each privilege, country and device scenario, the command verifies:

1. An invalid signature returns 401 and creates no incident. A valid signed webhook returns 202. Repeating it returns the same incident without another intake effect.
2. Publishing with no workflow subscriber fails, leaving the committed outbox command pending. The transport/store are closed and reopened; a new local transport and worker recover it.
3. The worker calls **native Mastra `startAsync`**. The actual workflow gathers evidence in parallel, correlates, retrieves the runbook, proposes a plan and suspends. A bounded state poll waits for the real suspended snapshot; no containment effects exist yet.
4. The allowed synthetic `studio-soc-manager` approves through domain operations. Resume executes and verifies two local actions and updates the local incident provider. Stale-plan, foreign-tenant resume and consumed-token replay probes are rejected.
5. Republishing the original durable event does not create another workflow or repeat effects. Final incident is `closed`, response is `contained`, with severity high/medium/medium respectively.

`demo-report.json` contains verified synthetic IDs/statuses/counts. Three case `.db` files retain operational data, local provider effects and Mastra snapshots for inspection/analytics. Existing outputs are never overwritten. The reported restart is a **transport/store restart inside the same CLI process**, not a process-kill test or a distributed broker guarantee. Rejected, expired and benign workflow paths are covered by the ten-case [`eval:check`](evals.md) suite.

Generate an analytics report from one retained case:

```bash
npm run analytics:report -- \
  --input /tmp/security-local-demo/privilege-approved.db \
  --analytics /tmp/security-local-demo/privilege.duckdb \
  --output /tmp/security-local-demo/privilege-metrics.json \
  --tenant tenant-1
```

All data is synthetic, but snapshots are still local development artifacts. Do not commit databases or include them in CI uploads. To clean up, remove only the exact output directory you created after finishing inspection; the demo never deletes user data automatically.

```bash
npm test -- tests/integration/local-demo.test.ts tests/integration/local-pubsub-outbox.test.ts
```
