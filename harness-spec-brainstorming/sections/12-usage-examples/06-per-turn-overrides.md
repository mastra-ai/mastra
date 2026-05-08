### 12.6 Per-turn overrides

```ts
// Use a faster model for this one turn, without changing the session default.
await session.message({
  content: 'Quick: what file owns the auth flow?',
  model: 'anthropic/claude-haiku-4-5',
});

// Add an extra tool just for this turn — typed result via `output` requires `sync: true`.
const audit = await session.message({
  content: 'Audit the security policy',
  addTools: { auditTool },
  output: AuditSchema,
  sync: true,
});

// Bypass approvals for an automated cleanup task.
await session.message({
  content: 'Delete all stale temp files in /tmp',
  yolo: true,
});

// Switch mode for one turn (e.g. drop into "plan" mode for a single planning question).
await session.message({
  content: 'Plan the migration before we start',
  mode: 'plan',
});
```
