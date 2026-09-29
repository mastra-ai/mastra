ALTER TABLE workflow_resume_commands ADD COLUMN result_json TEXT;
ALTER TABLE workflow_resume_commands ADD COLUMN result_fingerprint TEXT;

INSERT OR IGNORE INTO foundation_migrations (id, applied_at)
VALUES ('007-resume-outcome-replay', '2026-08-21T00:00:00.000Z');
