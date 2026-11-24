CREATE INDEX IF NOT EXISTS analytics_outbox_projection_lease
ON analytics_outbox (tenant_id, projected_at, lease_expires_at, created_at, event_id);

INSERT OR IGNORE INTO foundation_migrations (id, applied_at)
VALUES ('009-analytics-projector-lease', '2026-08-22T00:00:00.000Z');
