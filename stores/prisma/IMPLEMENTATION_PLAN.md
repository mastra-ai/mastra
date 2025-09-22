# Prisma Storage Provider Implementation Plan

## Overview
Implement a new storage provider for Mastra using Prisma ORM, providing type-safe database access with support for multiple database backends (PostgreSQL, MySQL, SQLite).

## Package Structure
Location: `stores/prisma/`

```
stores/prisma/
├── src/
│   ├── index.ts                 # Main exports
│   ├── storage.ts               # PrismaStore class extending MastraStorage
│   ├── client.ts                # Prisma client setup and configuration
│   ├── domains/
│   │   ├── workflows/           # WorkflowsPrisma implementation
│   │   ├── memory/              # MemoryPrisma implementation
│   │   ├── traces/              # TracesPrisma implementation
│   │   ├── scores/              # ScoresPrisma implementation
│   │   ├── legacy-evals/        # LegacyEvalsPrisma implementation
│   │   ├── operations/          # StoreOperationsPrisma implementation
│   │   └── observability/       # ObservabilityPrisma implementation (optional)
│   └── utils/
│       ├── converters.ts        # Data format converters
│       └── pagination.ts        # Pagination helpers
├── prisma/
│   └── schema.prisma            # Prisma schema definitions
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── vitest.config.ts
```

## Implementation Steps

### 1. Package Setup
- Initialize npm package with appropriate metadata
- Add dependencies:
  - `prisma` (dev dependency)
  - `@prisma/client` (runtime dependency)
  - Standard build tools (tsup, vitest, typescript)
- Configure TypeScript with strict mode
- Setup build configuration for ESM/CJS dual support

### 2. Schema Definition

#### Prisma Schema (`prisma/schema.prisma`)
Convert table schemas from `packages/core/src/storage/constants.ts` to Prisma models:

```prisma
model WorkflowSnapshot {
  id           String   @id @default(uuid())
  workflowName String   @map("workflow_name")
  runId        String   @map("run_id")
  resourceId   String?
  snapshot     Json
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@unique([workflowName, runId])
  @@map("mastra_workflow_snapshot")
}

model Thread {
  id         String    @id @default(uuid())
  resourceId String
  title      String
  metadata   Json?
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt
  messages   Message[]

  @@map("mastra_threads")
}

model Message {
  id         String   @id @default(uuid())
  threadId   String   @map("thread_id")
  thread     Thread   @relation(fields: [threadId], references: [id])
  content    String   @db.Text
  role       String
  type       String
  resourceId String?
  createdAt  DateTime @default(now())

  @@map("mastra_messages")
}

model AISpan {
  traceId      String    @map("trace_id")
  spanId       String    @map("span_id")
  parentSpanId String?   @map("parent_span_id")
  name         String
  scope        Json?
  spanType     Int       @map("span_type")
  attributes   Json?
  metadata     Json?
  links        Json?
  input        Json?
  output       Json?
  error        Json?
  startedAt    DateTime  @map("started_at")
  endedAt      DateTime? @map("ended_at")
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime? @updatedAt @map("updated_at")
  isEvent      Boolean   @map("is_event")

  @@id([traceId, spanId])
  @@map("mastra_ai_spans")
}

// Additional models for Traces, Scorers, Resources, Evals...
```

### 3. Core Storage Implementation

#### PrismaStore Class (`src/storage.ts`)
```typescript
export class PrismaStore extends MastraStorage {
  private prisma: PrismaClient;
  stores: StorageDomains;

  constructor(config: PrismaStoreConfig) {
    super({ name: 'PrismaStore' });
    // Initialize Prisma client with config
    // Setup domain stores
  }

  public get supports() {
    return {
      selectByIncludeResourceScope: true,
      resourceWorkingMemory: true,
      hasColumn: true,
      createTable: true,
      deleteMessages: true,
      aiTracing: true,
      indexManagement: true,
    };
  }

  // Implement all abstract methods...
}
```

### 4. Domain Implementations

Each domain implementation will handle its specific concerns:

#### WorkflowsPrisma
- Workflow snapshot persistence and retrieval
- State updates with proper transaction handling
- Efficient querying with date ranges and pagination

#### MemoryPrisma
- Thread and message management
- Efficient pagination using Prisma's cursor-based pagination
- Support for both v1 and v2 message formats
- Batch message operations

#### TracesPrisma
- Trace data storage and retrieval
- Efficient querying with filters
- Batch insert operations for performance

#### ScoresPrisma
- Score persistence with validation
- Query by scorer ID, run ID, entity ID
- Paginated results

#### StoreOperationsPrisma
- Table creation/alteration (handled by Prisma migrations)
- Index management operations
- Schema introspection

#### ObservabilityPrisma (Optional)
- AI span creation and updates
- Batch operations for spans
- Trace retrieval with hierarchical span data

### 5. Testing

#### Test Setup
- Docker compose configuration for test databases
- Integration tests using `@internal/storage-test-utils`
- Test against multiple database providers:
  - PostgreSQL (primary)
  - MySQL
  - SQLite (for local development)

#### Test Coverage
- All CRUD operations for each domain
- Pagination edge cases
- Transaction rollback scenarios
- Connection pooling behavior
- Schema migration testing

## Technical Considerations

### Database Provider Support
- Use Prisma's provider switching to support multiple databases
- Abstract provider-specific features (e.g., JSONB for PostgreSQL)
- Handle differences in timestamp precision across providers

### Performance Optimizations
- Use Prisma's `createMany` for batch inserts
- Implement cursor-based pagination for large datasets
- Use select/include carefully to avoid N+1 queries
- Configure appropriate connection pool sizes

### Type Safety
- Leverage Prisma's generated types
- Create converter functions for Mastra <-> Prisma data formats
- Ensure proper typing for JSON fields

### Migration Strategy
- Use Prisma Migrate for schema management
- Provide migration scripts for existing data
- Support both development and production migration workflows

### Error Handling
- Map Prisma errors to Mastra error types
- Handle connection failures gracefully
- Implement retry logic for transient failures

## Configuration

### Environment Variables
```env
DATABASE_URL="postgresql://user:password@localhost:5432/mastra"
DATABASE_PROVIDER="postgresql" # or mysql, sqlite
```

### PrismaStoreConfig
```typescript
interface PrismaStoreConfig {
  databaseUrl?: string;
  provider?: 'postgresql' | 'mysql' | 'sqlite';
  connectionLimit?: number;
  logLevel?: 'query' | 'info' | 'warn' | 'error';
}
```

## Next Steps

1. Initialize the package structure
2. Define complete Prisma schema
3. Implement PrismaStore base class
4. Implement domain classes one by one
5. Add comprehensive tests
6. Documentation and examples