# Agent Inbox - Implementation Tasks

## Overview

Implementation tasks for the Agent Inbox feature. Each task is self-contained with detailed specifications.

## Task Order

### Phase 1: Core Infrastructure

| #   | Task                  | File                                       | Status  |
| --- | --------------------- | ------------------------------------------ | ------- |
| 01  | Inbox Types           | `packages/core/src/inbox/types.ts`         | pending |
| 02  | Inbox Constants       | `packages/core/src/inbox/constants.ts`     | pending |
| 03  | InboxStorage Domain   | `packages/core/src/inbox/inbox-storage.ts` | pending |
| 04  | Base Inbox Class      | `packages/core/src/inbox/inbox.ts`         | pending |
| 05  | Inbox Exports         | `packages/core/src/inbox/index.ts`         | pending |
| 06  | StorageDomains Update | `packages/core/src/storage/base.ts`        | pending |
| 07  | Mastra Integration    | `packages/core/src/mastra/index.ts`        | pending |
| 08  | Core Exports          | `packages/core/src/index.ts`               | pending |

### Phase 2: Agent Integration

| #   | Task                 | File                               | Status  |
| --- | -------------------- | ---------------------------------- | ------- |
| 09  | AgentRunOptions Type | `packages/core/src/agent/types.ts` | pending |
| 10  | Agent Run Loop       | `packages/core/src/agent/agent.ts` | pending |

### Phase 3: GitHub Inbox

| #   | Task                | File            | Status  |
| --- | ------------------- | --------------- | ------- |
| 11  | GitHubInbox Package | `tasks/github/` | pending |

### Phase 4: Verification

| #   | Task              | Status  |
| --- | ----------------- | ------- |
| 12  | Build & Typecheck | pending |

### Phase 5: Tests

| #   | Task                      | File                                                      | Status  |
| --- | ------------------------- | --------------------------------------------------------- | ------- |
| 13  | InboxStorage Shared Tests | `test-utils/src/storage/inbox-storage.test.ts`            | pending |
| 14  | Inbox Class Tests         | `packages/core/src/inbox/__tests__/inbox.test.ts`         | pending |
| 15  | Agent Run Loop Tests      | `packages/core/src/agent/__tests__/agent-run.test.ts`     | pending |
| 16  | Mastra Inbox Tests        | `packages/core/src/mastra/__tests__/mastra-inbox.test.ts` | pending |
| 17  | GitHubInbox Tests         | `tasks/github/src/__tests__/github-inbox.test.ts`         | pending |

### Phase 6: Refinements

| #   | Task                       | File                                                       | Status  |
| --- | -------------------------- | ---------------------------------------------------------- | ------- |
| 18  | Task → Run Association     | `packages/core/src/inbox/types.ts`, `agent.ts`             | pending |
| 19  | Configurable Claim Timeout | `packages/core/src/inbox/types.ts`, `inbox-storage.ts`     | pending |
| 20  | Human-in-the-Loop          | `packages/core/src/inbox/types.ts`, `inbox.ts`, `agent.ts` | pending |
| 21  | Exponential Retry Backoff  | `packages/core/src/inbox/types.ts`, `utils.ts`             | pending |

### Phase 7: Documentation

| #   | Task          | File                                            | Status  |
| --- | ------------- | ----------------------------------------------- | ------- |
| 22  | Documentation | `docs/src/pages/docs/inbox/`, `examples/inbox/` | pending |

## Dependencies

```
Implementation:
01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09 → 10 → 11 → 12

Tests (can run in parallel after implementation):
03 done → 13 (InboxStorage tests)
04 done → 14 (Inbox class tests)
10 done → 15 (Agent run tests)
07 done → 16 (Mastra tests)
11 done → 17 (GitHubInbox tests)
```

## Test Coverage Summary

| Area           | Test File                             | Pattern                              |
| -------------- | ------------------------------------- | ------------------------------------ |
| InboxStorage   | `test-utils/src/storage/`             | Shared tests (runs against any impl) |
| Inbox class    | `packages/core/src/inbox/__tests__/`  | Unit tests                           |
| Agent.run()    | `packages/core/src/agent/__tests__/`  | Unit tests                           |
| Mastra inboxes | `packages/core/src/mastra/__tests__/` | Unit tests                           |
| GitHubInbox    | `tasks/github/src/__tests__/`         | Unit tests (mocked Octokit)          |

## Specification

See `/Users/abhiramaiyer/.claude/plans/squishy-inventing-spark.md` for full architecture spec.

## Quick Start

1. Read the spec in the plan file
2. Start with task 01
3. Follow task order and dependencies
4. Run tests after each phase
5. Mark tasks complete in this README as you go
