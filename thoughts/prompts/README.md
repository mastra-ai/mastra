# MastraAdmin Implementation Prompts

Prompts for creating implementation plans for each component of the MastraAdmin platform.

## Execution Order

### Layer 0 - Foundation (Must be first)
```
admin-core.md                    # @mastra/admin core package
```

### Layer 1 - Providers (Run in parallel after Layer 0)
```
admin-pg.md                      # PostgreSQL storage
observability-writer.md          # Observability writer
observability-file-storage.md    # Local file storage
source-local.md                  # Local project source
runner-local.md                  # LocalProcess runner
router-local.md                  # Local edge router
```

### Layer 1.5 - Backend Services (After Layer 1)
```
observability-clickhouse.md      # ClickHouse + ingestion worker
admin-server.md                  # HTTP API server (required for UI)
```

### Layer 2 - Integration (After Layer 1.5)
```
admin-integration-tests.md       # Integration tests
```

### Layer 3 - Deployment & UI (After Layer 2)
```
admin-docker.md                  # Docker self-hosting
admin-ui.md                      # Admin UI
```

### Layer 4 - Future Enhancements (P2 priority)
```
observability-file-s3.md         # S3 file storage
observability-file-gcs.md        # GCS file storage
runner-k8s.md                    # Kubernetes runner
source-github.md                 # GitHub project source
router-cloudflare.md             # Cloudflare edge router
```

## Usage

```bash
# Run a single prompt
cat thoughts/prompts/admin-core.md | claude -p --dangerously-skip-permissions

# Run Layer 1 prompts in parallel (separate terminals)
cat thoughts/prompts/admin-pg.md | claude -p --dangerously-skip-permissions &
cat thoughts/prompts/observability-writer.md | claude -p --dangerously-skip-permissions &
cat thoughts/prompts/observability-file-storage.md | claude -p --dangerously-skip-permissions &
cat thoughts/prompts/source-local.md | claude -p --dangerously-skip-permissions &
cat thoughts/prompts/runner-local.md | claude -p --dangerously-skip-permissions &
cat thoughts/prompts/router-local.md | claude -p --dangerously-skip-permissions &
```

## Dependencies

| Prompt | Depends On |
|--------|------------|
| admin-core | None (foundation) |
| admin-pg | admin-core |
| observability-writer | admin-core |
| observability-file-storage | admin-core |
| observability-clickhouse | observability-writer, observability-file-storage |
| source-local | admin-core |
| runner-local | admin-core, source-local, router-local |
| router-local | admin-core |
| admin-server | admin-core, All Layer 1 providers |
| admin-integration-tests | All Layer 1, admin-server |
| admin-docker | All Layer 1, observability-clickhouse, admin-server |
| admin-ui | admin-server |
| runner-k8s | admin-core |
| source-github | admin-core |
| router-cloudflare | admin-core |

## Output Plans

Plans are saved to `thoughts/shared/plans/2025-01-23-<name>.md`

See the master plan at `thoughts/shared/plans/2025-01-23-mastra-admin-master-plan.md` for full context.
