ALTER TABLE workflow_resume_commands ADD COLUMN payload_fingerprint TEXT;

CREATE INDEX IF NOT EXISTS workflow_resume_commands_thread_action_status
ON workflow_resume_commands (tenant_id, thread_id, action_type, status, updated_at);

INSERT OR IGNORE INTO foundation_migrations (id, applied_at)
VALUES ('006-resume-payload-binding', '2026-08-21T00:00:00.000Z');
