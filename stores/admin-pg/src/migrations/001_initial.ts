import type { Pool } from 'pg';

export async function up(pool: Pool, schema: string): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${schema}.teams (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS ${schema}.projects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      team_id UUID NOT NULL REFERENCES ${schema}.teams(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) NOT NULL,
      source_type VARCHAR(50) NOT NULL DEFAULT 'local',
      source_config JSONB NOT NULL DEFAULT '{}',
      default_branch VARCHAR(255) NOT NULL DEFAULT 'main',
      env_vars JSONB NOT NULL DEFAULT '[]',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(team_id, slug)
    );

    CREATE TABLE IF NOT EXISTS ${schema}.deployments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL REFERENCES ${schema}.projects(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL DEFAULT 'production',
      branch VARCHAR(255) NOT NULL,
      slug VARCHAR(255) NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      current_build_id UUID,
      public_url VARCHAR(500),
      port INTEGER,
      process_id INTEGER,
      env_var_overrides JSONB NOT NULL DEFAULT '[]',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(project_id, slug)
    );

    CREATE TABLE IF NOT EXISTS ${schema}.builds (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      deployment_id UUID NOT NULL REFERENCES ${schema}.deployments(id) ON DELETE CASCADE,
      trigger VARCHAR(50) NOT NULL DEFAULT 'manual',
      status VARCHAR(50) NOT NULL DEFAULT 'queued',
      log_path VARCHAR(500),
      queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      error_message TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Add foreign key for current_build_id after builds table exists
    ALTER TABLE ${schema}.deployments
      ADD CONSTRAINT fk_current_build
      FOREIGN KEY (current_build_id) REFERENCES ${schema}.builds(id) ON DELETE SET NULL;

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_projects_team_id ON ${schema}.projects(team_id);
    CREATE INDEX IF NOT EXISTS idx_deployments_project_id ON ${schema}.deployments(project_id);
    CREATE INDEX IF NOT EXISTS idx_deployments_status ON ${schema}.deployments(status);
    CREATE INDEX IF NOT EXISTS idx_builds_deployment_id ON ${schema}.builds(deployment_id);
    CREATE INDEX IF NOT EXISTS idx_builds_status ON ${schema}.builds(status);

    -- Updated_at trigger function
    CREATE OR REPLACE FUNCTION ${schema}.update_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    -- Triggers for updated_at
    DROP TRIGGER IF EXISTS teams_updated_at ON ${schema}.teams;
    CREATE TRIGGER teams_updated_at BEFORE UPDATE ON ${schema}.teams
      FOR EACH ROW EXECUTE FUNCTION ${schema}.update_updated_at();

    DROP TRIGGER IF EXISTS projects_updated_at ON ${schema}.projects;
    CREATE TRIGGER projects_updated_at BEFORE UPDATE ON ${schema}.projects
      FOR EACH ROW EXECUTE FUNCTION ${schema}.update_updated_at();

    DROP TRIGGER IF EXISTS deployments_updated_at ON ${schema}.deployments;
    CREATE TRIGGER deployments_updated_at BEFORE UPDATE ON ${schema}.deployments
      FOR EACH ROW EXECUTE FUNCTION ${schema}.update_updated_at();
  `);
}
