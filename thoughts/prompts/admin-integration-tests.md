# LANE 7 - Integration Tests (after Phase 2)

Create implementation plan for LANE 7: Integration tests for MastraAdmin.

Reference the master plan at thoughts/shared/plans/2025-01-23-mastra-admin-master-plan.md for context.

**Dependencies**: LANES 1-5, 12 (All core providers) must be complete.

This includes:
- Test fixtures and setup:
  - Mock data generators for users, teams, projects
  - Test database setup/teardown
- Docker Compose for test dependencies:
  - PostgreSQL
  - ClickHouse
  - Any other required services
- E2E test scenarios:
  - User registration and authentication (using @mastra/auth-supabase)
  - Team creation and member management
  - Team invitations
  - Project CRUD operations
  - Environment variable management
  - Build and deployment lifecycle:
    - Create deployment
    - Trigger build
    - Verify build queue processing
    - Verify server starts and becomes healthy
    - Verify route is registered
  - Observability data flow:
    - Write events via ObservabilityWriter
    - Verify files are written
    - Run ingestion worker
    - Verify data in ClickHouse
- RBAC permission testing:
  - Team-level permissions
  - Project-level permissions
  - Admin vs member access
- Error handling tests:
  - Invalid inputs
  - Permission denied
  - Resource not found

Save plan to: thoughts/shared/plans/2025-01-23-admin-integration-tests.md
