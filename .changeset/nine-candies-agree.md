---
'@mastra/railway': minor
---

Added checkpoint persistence, automatic restart, and reconnect support to RailwaySandbox. New checkpointName option saves sandbox filesystem state before idle timeout so sandboxes can be restored on reconnect. restart() and withRestartRetry() automatically reconnect or recreate unavailable sandboxes during command execution. Fixed restart() to await in-flight checkpoint saves before nulling the sandbox reference. Fixed _teardown() to always destroy the sandbox even when checkpoint flush fails. Fixed checkpoint refresh timer race where a stale finally() callback could clobber a newer timer handle. Removed RailwayConnectionError from retriable sandbox errors to prevent command replay after transport failures. Restored template build fallback to plain sandbox with exec-based setup commands when SandboxTemplateBuildError occurs.
