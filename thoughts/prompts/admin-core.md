# LANE 1 - Core Package (must be first)

Create implementation plan for LANE 1: @mastra/admin core package.

Reference the master plan at thoughts/shared/plans/2025-01-23-mastra-admin-master-plan.md for context.

This includes:
- packages/admin/ setup
- MastraAdmin class
- Abstract provider interfaces (AdminStorage, FileStorageProvider, ObservabilityWriter, ProjectRunner, ProjectSourceProvider, BillingProvider, EmailProvider, EncryptionProvider, EdgeRouterProvider, ObservabilityQueryProvider)
- Core types (User, Team, TeamMember, Project, Deployment, Build, RunningServer, etc.)
- License validation system (LicenseValidator class, feature gating, tier management)
- Observability event types (Trace, Span, Log, Metric, Score)
- RBACManager implementation
- Error classes and error handling
- Built-in simple providers (NoBillingProvider, ConsoleEmailProvider, NodeCryptoEncryptionProvider)

Note: Auth uses existing @mastra/auth-* packages - no admin-specific auth abstraction needed.

Save plan to: thoughts/shared/plans/2025-01-23-admin-core.md
