# Persistent observability

Operational events, run associations and Mastra workflow snapshots live in `data/application.db` through LibSQL. MastraCompositeStore routes the observability domain to native DuckDB at `data/observability.duckdb`; MastraStorageExporter writes traces, safe application logs and native technical metrics there. Both files are local, persistent and ignored by Git. Use one application process per directory.

The `lead-intake` workflow is visible in Studio after submission through the event API. Studio traces and logs support technical inspection. Intake status is available through its bounded read endpoint. Qualification scores and review/output state are available from authoritative operational records through the run endpoint. No conversion report or automatic business KPI dashboard is provided.

The output processor removes span inputs, outputs, arbitrary attributes, request context, tags, links, free-form names and error details before metrics/export. Traces retain safe types, timing, generic error information and validated run UUIDs. Framework log forwarding is disabled because external errors may contain private content. Application diagnostics use an explicit code/UUID schema and the native exporter. Contact data and raw accepted events stay in the operational database, which must be protected and backed up accordingly.

Telemetry failure never authorizes or replays work. Diagnostic submission failures emit a fixed warning; `telemetryDegraded` on the run endpoint exposes degradation detected by the application. It is a process health hint, not proof that every export succeeded. Graceful shutdown stops dispatch, flushes observability, closes native stores and releases DuckDB's file lock. Forced termination can lose buffered telemetry; acknowledged operational associations remain recoverable.

There is no retention maintenance command yet. Keep use bounded, inspect both files, and manage dedicated development data with the process stopped. Do not treat an observability purge as an operational reset. Pending work and workflow snapshots must remain together for recovery.

Customization prompt:

> Extend technical observability for [safe event] using the existing native Mastra exporter and composite storage. Add only explicitly allowed codes, bounded numeric fields and validated correlation IDs. Keep private content, secrets, raw bodies, prompts and contacts out of traces/logs/metric labels. Test persisted DuckDB records, operational separation, export failure isolation and reopen persistence. Update this guide without promising automatic business KPI charts.
