## PR 4.1: @mastra/core Changes

**Package:** `packages/core`
**Scope:** Score/Feedback schemas, storage interface, Span/Trace API definitions

### 4.1.1 Score Schema

**File:** `packages/core/src/observability/types/scores.ts` (new)

```typescript
import { z } from 'zod';

export const scoreInputSchema = z.object({
  scorerName: z.string(),
  score: z.number(),
  reason: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  experiment: z.string().optional(),  // For grouping scores by experiment
});

export type ScoreInput = z.infer<typeof scoreInputSchema>;

export const scoreRecordSchema = z.object({
  id: z.string(),
  timestamp: z.date(),

  // Target
  traceId: z.string(),
  spanId: z.string().optional(),

  // Score data
  scorerName: z.string(),
  score: z.number(),
  reason: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  experiment: z.string().optional(),

  // Multi-tenancy
  organizationId: z.string().optional(),
  userId: z.string().optional(),

  // Environment
  environment: z.string().optional(),
  serviceName: z.string().optional(),
});

export type ScoreRecord = z.infer<typeof scoreRecordSchema>;
```

**Notes:**
- Score range is defined on the scorer, not in the score result
- `experiment` field for grouping scores (e.g., A/B tests, eval runs)

**Tasks:**
- [ ] Define ScoreInput schema (user-facing)
- [ ] Define ScoreRecord schema (storage)
- [ ] Export from types index

**TODO:** Verify alignment with existing evals scores schema.

### 4.1.2 Feedback Schema

**File:** `packages/core/src/observability/types/feedback.ts` (new)

```typescript
import { z } from 'zod';

export const feedbackInputSchema = z.object({
  source: z.string(),           // e.g., 'user', 'system', 'manual'
  feedbackType: z.string(),     // e.g., 'thumbs', 'rating', 'correction'
  value: z.union([z.number(), z.string()]),
  comment: z.string().optional(),
  userId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  experiment: z.string().optional(),
});

export type FeedbackInput = z.infer<typeof feedbackInputSchema>;

export const feedbackRecordSchema = z.object({
  id: z.string(),
  timestamp: z.date(),

  // Target
  traceId: z.string(),
  spanId: z.string().optional(),

  // Feedback data
  source: z.string(),
  feedbackType: z.string(),
  value: z.union([z.number(), z.string()]),
  comment: z.string().optional(),
  experiment: z.string().optional(),

  // Attribution
  userId: z.string().optional(),

  // Multi-tenancy
  organizationId: z.string().optional(),

  // Environment
  environment: z.string().optional(),
  serviceName: z.string().optional(),

  // Extra
  metadata: z.record(z.unknown()).optional(),
});

export type FeedbackRecord = z.infer<typeof feedbackRecordSchema>;
```

**Notes:**
- `feedbackType` is flexible string (not enum) to support various feedback types
- `value` can be number (rating) or string (correction text)

**Tasks:**
- [ ] Define FeedbackInput schema (user-facing)
- [ ] Define FeedbackRecord schema (storage)
- [ ] Export from types index

**TODO:** Revisit table name `mastra_ai_trace_feedback`.

### 4.1.3 Update Span Interface

**File:** `packages/core/src/observability/types/tracing.ts` (modify)

```typescript
export interface Span {
  // Existing properties...
  readonly traceId: string;
  readonly spanId: string;
  readonly name: string;

  // Existing methods...
  setStatus(status: SpanStatus): void;
  setAttribute(key: string, value: AttributeValue): void;
  addEvent(name: string, attributes?: Record<string, AttributeValue>): void;
  end(): void;

  // NEW: Score and Feedback
  addScore(score: ScoreInput): void;
  addFeedback(feedback: FeedbackInput): void;
}
```

**Tasks:**
- [ ] Add `addScore()` to Span interface
- [ ] Add `addFeedback()` to Span interface

### 4.1.4 Add Trace Interface

**File:** `packages/core/src/observability/types/tracing.ts` (modify)

```typescript
export interface Trace {
  readonly traceId: string;
  readonly spans: ReadonlyArray<Span>;

  addScore(score: ScoreInput): void;
  addFeedback(feedback: FeedbackInput): void;
  getSpan(spanId: string): Span | null;
}
```

**Tasks:**
- [ ] Define Trace interface
- [ ] Export from types index

### 4.1.5 Add Mastra.getTrace() API

**File:** `packages/core/src/mastra/types.ts` (modify)

```typescript
export interface Mastra {
  // Existing...

  // NEW: Trace retrieval for post-hoc score/feedback attachment
  getTrace(traceId: string): Promise<Trace | null>;
}
```

**Tasks:**
- [ ] Add `getTrace()` to Mastra interface

### 4.1.6 Storage Interface Extensions

**File:** `packages/core/src/storage/domains/observability/base.ts` (modify)

```typescript
// Add to ObservabilityStorage abstract class

// === Scores ===
async createScore(args: CreateScoreArgs): Promise<void> {
  throw new Error('Not implemented');
}

async listScores(args: ListScoresArgs): Promise<PaginatedResult<ScoreRecord>> {
  throw new Error('Not implemented');
}

// === Feedback ===
async createFeedback(args: CreateFeedbackArgs): Promise<void> {
  throw new Error('Not implemented');
}

async listFeedback(args: ListFeedbackArgs): Promise<PaginatedResult<FeedbackRecord>> {
  throw new Error('Not implemented');
}

// Types
export interface CreateScoreArgs {
  score: ScoreRecord;
}

export interface ListScoresArgs {
  filters?: {
    traceId?: string;
    spanId?: string;
    scorerName?: string | string[];
    experiment?: string;
    organizationId?: string;
    startTime?: Date;
    endTime?: Date;
  };
  pagination?: {
    limit?: number;
    offset?: number;
  };
  orderBy?: {
    field: 'timestamp' | 'score';
    direction: 'asc' | 'desc';
  };
}

export interface CreateFeedbackArgs {
  feedback: FeedbackRecord;
}

export interface ListFeedbackArgs {
  filters?: {
    traceId?: string;
    spanId?: string;
    feedbackType?: string | string[];
    source?: string;
    experiment?: string;
    userId?: string;
    organizationId?: string;
    startTime?: Date;
    endTime?: Date;
  };
  pagination?: {
    limit?: number;
    offset?: number;
  };
  orderBy?: {
    field: 'timestamp';
    direction: 'asc' | 'desc';
  };
}
```

**Tasks:**
- [ ] Add `createScore()` method
- [ ] Add `listScores()` method
- [ ] Add `createFeedback()` method
- [ ] Add `listFeedback()` method
- [ ] Define all argument interfaces

### 4.1.7 Update StorageCapabilities

```typescript
export interface StorageCapabilities {
  tracing: { /* existing */ };
  logs: { /* existing */ };
  metrics: { /* existing */ };
  scores: { supported: boolean };
  feedback: { supported: boolean };
}
```

**Tasks:**
- [ ] Ensure scores/feedback capabilities are defined

### PR 4.1 Testing

**Tasks:**
- [ ] Test ScoreInput/ScoreRecord schema validation
- [ ] Test FeedbackInput/FeedbackRecord schema validation
- [ ] Verify type exports

