# Workflow Best Practices

Learn essential best practices for designing, building, and maintaining production-quality workflows.

## Design Principles

### 1. Single Responsibility
Each step should do one thing well:

```typescript
// Good: Focused step
const validateEmailStep = createStep({
  id: "validate-email",
  description: "Validates email format and domain",
  // ... focused validation logic
});

// Avoid: Step that does too much
const processUserStep = createStep({
  id: "process-user", 
  description: "Validates, enriches, notifies, and saves user",
  // ... too many responsibilities
});
```

### 2. Clear Naming
Use descriptive names for workflows and steps:

```typescript
// Good: Clear and descriptive
export const userOnboardingWorkflow = createWorkflow({
  id: "user-onboarding-workflow",
  description: "Complete new user onboarding process"
});

// Avoid: Vague or generic names
export const processWorkflow = createWorkflow({
  id: "process",
  description: "Processes stuff"
});
```

### 3. Consistent Schemas
Keep schemas simple and consistent:

```typescript
// Good: Consistent structure
inputSchema: z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  preferences: z.object({
    notifications: z.boolean(),
    theme: z.enum(["light", "dark"])
  })
})

// Avoid: Inconsistent field names and types
inputSchema: z.object({
  user_id: z.number(), // Different naming convention
  emailAddress: z.string(), // Inconsistent field naming
  prefs: z.any() // Untyped data
})
```

## Code Organization

### 1. File Structure
Organize workflows logically:

```
src/mastra/
├── workflows/
│   ├── user/
│   │   ├── onboarding-workflow.ts
│   │   └── verification-workflow.ts
│   ├── content/
│   │   ├── processing-workflow.ts
│   │   └── analysis-workflow.ts
│   └── index.ts
├── agents/
└── tools/
```

### 2. Shared Steps
Extract reusable steps:

```typescript
// shared/validation-steps.ts
export const validateEmailStep = createStep({...});
export const validatePhoneStep = createStep({...});

// workflows/user-onboarding.ts
import { validateEmailStep } from "../shared/validation-steps";

export const onboardingWorkflow = createWorkflow({...})
  .then(validateEmailStep)
  .then(...)
  .commit();
```

### 3. Configuration
Keep configuration separate and environment-specific:

```typescript
// config/workflows.ts
export const workflowConfig = {
  timeouts: {
    default: 5 * 60 * 1000, // 5 minutes
    longRunning: 30 * 60 * 1000 // 30 minutes
  },
  retries: {
    maxAttempts: 3,
    backoffMs: 1000
  }
};
```

## Error Handling Patterns

### 1. Graceful Degradation
Handle errors without breaking the entire workflow:

```typescript
const optionalEnrichmentStep = createStep({
  execute: async ({ inputData }) => {
    try {
      const enrichedData = await enrichUser(inputData);
      return { ...inputData, ...enrichedData };
    } catch (error) {
      // Log error but continue with original data
      console.warn("Enrichment failed, continuing with basic data:", error.message);
      return inputData;
    }
  }
});
```

### 2. Circuit Breaker Pattern
Prevent cascade failures:

```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailTime = 0;
  private readonly threshold = 5;
  private readonly timeout = 60000; // 1 minute
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      throw new Error("Circuit breaker is open");
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private isOpen(): boolean {
    return this.failures >= this.threshold && 
           Date.now() - this.lastFailTime < this.timeout;
  }
  
  private onSuccess(): void {
    this.failures = 0;
  }
  
  private onFailure(): void {
    this.failures++;
    this.lastFailTime = Date.now();
  }
}
```

## Testing Strategies

### 1. Test Pyramid
- **Unit tests**: Test individual steps
- **Integration tests**: Test complete workflows
- **End-to-end tests**: Test with real external services

### 2. Mock External Dependencies
```typescript
// In tests, mock external services
const mockAIService = {
  analyze: vi.fn().mockResolvedValue({ score: 85, feedback: "Good content" })
};

// Inject mock during testing
const testStep = createStep({
  execute: async ({ inputData, context }) => {
    const aiService = context?.aiService || realAIService;
    return await aiService.analyze(inputData.content);
  }
});
```

## Performance Guidelines

### 1. Use Parallel Execution Wisely
```typescript
// Good: Independent operations in parallel
.parallel([seoAnalysis, readabilityCheck, sentimentAnalysis])

// Avoid: Sequential when parallel is possible
.then(seoAnalysis)
.then(readabilityCheck) 
.then(sentimentAnalysis)
```

### 2. Optimize Data Flow
Minimize data copying between steps:

```typescript
// Good: Pass only necessary data
outputSchema: z.object({
  id: z.string(),
  status: z.enum(["processed"]),
  metadata: z.object({
    processedAt: z.string()
  })
})

// Avoid: Passing large unnecessary data
outputSchema: z.object({
  originalContent: z.string(), // Large, unnecessary for next step
  processedContent: z.string(),
  debugInfo: z.any() // Undefined large object
})
```

## Documentation Standards

Document your workflows clearly:

```typescript
/**
 * User Onboarding Workflow
 * 
 * Handles the complete onboarding process for new users including:
 * - Email validation and verification
 * - Profile setup and enrichment
 * - Welcome email sending
 * - Account activation
 * 
 * @example
 * const result = await userOnboardingWorkflow.run({
 *   email: "user@example.com",
 *   firstName: "John",
 *   lastName: "Doe"
 * });
 */
export const userOnboardingWorkflow = createWorkflow({
  id: "user-onboarding-workflow",
  description: "Complete new user onboarding process",
  // ...
});
```

Following these best practices will help you build maintainable, reliable, and efficient workflows! Next, you'll wrap up the course with a summary of everything you've learned.