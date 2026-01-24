# LANE 11 - GitHub Project Source (Future, P2)

Create implementation plan for LANE 11: @mastra/source-github GitHub project source.

Reference the master plan at thoughts/shared/plans/2025-01-23-mastra-admin-master-plan.md for context.

**Dependencies**: LANE 1 (Core Package) must be complete (for ProjectSourceProvider interface).
**Priority**: P2 (Future Enhancement)

This includes:
- sources/github/ package setup
- GitHubProjectSource implementing ProjectSourceProvider interface
- GitHub App authentication:
  - App JWT generation using private key
  - Installation access token generation
  - Token caching and refresh
- Repository operations:
  - List user's accessible repositories
  - List organization repositories
  - Get repository details
  - Check repository access permissions
- Installation management:
  - Handle GitHub App installation events
  - Store/retrieve installation IDs per team
  - Validate installation access
- Webhook handling:
  - installation events (created, deleted, suspend, unsuspend)
  - push events (for auto-deploy triggers)
  - repository events (for sync)
  - Webhook signature verification
- Clone URL generation and cloning:
  - Generate authenticated clone URLs using installation tokens
  - Clone repos to target directory
  - Support for private repositories

Key files:
```
sources/github/
├── src/
│   ├── index.ts
│   ├── provider.ts
│   ├── types.ts
│   ├── auth/
│   │   ├── jwt.ts
│   │   ├── installation-token.ts
│   │   └── token-cache.ts
│   ├── api/
│   │   ├── client.ts
│   │   ├── repositories.ts
│   │   ├── installations.ts
│   │   └── rate-limit.ts
│   ├── webhooks/
│   │   ├── handler.ts
│   │   ├── verify.ts
│   │   └── events.ts
│   └── clone.ts
├── package.json
└── tsconfig.json
```

Save plan to: thoughts/shared/plans/2025-01-23-source-github.md
