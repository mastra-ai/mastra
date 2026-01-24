# @mastra/observability-clickhouse

## 0.0.1

### Features

- Initial release
- ClickHouse schema for traces, spans, logs, metrics, scores
- Materialized views for hourly aggregations
- `IngestionWorker` for processing JSONL files into ClickHouse
- `ClickHouseQueryProvider` for querying observability data
- CLI for running ingestion worker standalone
- Migration support with `migrate` command
