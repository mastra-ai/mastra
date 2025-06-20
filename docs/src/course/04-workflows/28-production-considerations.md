# Production Considerations

Learn important considerations for deploying workflows to production environments where reliability and performance matter.

## Environment Configuration

Set up proper environment variables for production:

```typescript
// src/config/production.ts
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "staging"]),
  DATABASE_URL: z.string(),
  OPENAI_API_KEY: z.string(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  WORKFLOW_TIMEOUT: z.string().transform(Number).default("300000") // 5 minutes
});

export const config = envSchema.parse(process.env);
```

## Error Handling and Retries

Make workflows more resilient with proper error handling:

```typescript
const resilientStep = createStep({
  id: "resilient-step",
  description: "Step with retry logic",
  inputSchema: z.object({
    content: z.string()
  }),
  outputSchema: z.object({
    result: z.string()
  }),
  execute: async ({ inputData }) => {
    const maxRetries = 3;
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Your potentially failing operation
        const result = await processContent(inputData.content);
        return { result };
        
      } catch (error) {
        lastError = error;
        console.warn(`Attempt ${attempt} failed:`, error.message);
        
        if (attempt < maxRetries) {
          // Exponential backoff
          await new Promise(resolve => 
            setTimeout(resolve, Math.pow(2, attempt) * 1000)
          );
        }
      }
    }
    
    throw new Error(`Failed after ${maxRetries} attempts: ${lastError.message}`);
  }
});
```

## Monitoring and Logging

Add comprehensive logging for production monitoring:

```typescript
const monitoredStep = createStep({
  id: "monitored-step",
  description: "Step with production monitoring",
  inputSchema: z.object({
    content: z.string()
  }),
  outputSchema: z.object({
    result: z.string()
  }),
  execute: async ({ inputData }) => {
    const startTime = Date.now();
    const stepId = "monitored-step";
    
    try {
      console.log(`[${stepId}] Starting execution`, {
        inputSize: inputData.content.length,
        timestamp: new Date().toISOString()
      });
      
      const result = await processContent(inputData.content);
      const duration = Date.now() - startTime;
      
      console.log(`[${stepId}] Completed successfully`, {
        duration,
        outputSize: result.length,
        timestamp: new Date().toISOString()
      });
      
      return { result };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      console.error(`[${stepId}] Failed`, {
        error: error.message,
        duration,
        timestamp: new Date().toISOString()
      });
      
      throw error;
    }
  }
});
```

## Performance Optimization

Optimize workflows for production performance:

```typescript
// Cache expensive operations
const cache = new Map();

const optimizedStep = createStep({
  id: "optimized-step",
  description: "Performance-optimized step",
  inputSchema: z.object({
    content: z.string()
  }),
  outputSchema: z.object({
    result: z.string()
  }),
  execute: async ({ inputData }) => {
    // Create cache key
    const cacheKey = createHash('md5').update(inputData.content).digest('hex');
    
    // Check cache first
    if (cache.has(cacheKey)) {
      console.log("Cache hit for content");
      return cache.get(cacheKey);
    }
    
    // Process if not cached
    const result = await expensiveOperation(inputData.content);
    
    // Cache the result
    cache.set(cacheKey, { result });
    
    return { result };
  }
});
```

## Security Considerations

- **Input validation**: Always validate and sanitize inputs
- **API keys**: Store secrets in environment variables, never in code
- **Rate limiting**: Prevent abuse with request rate limits
- **Access control**: Implement proper authentication and authorization

## Deployment Checklist

Before production deployment:

- [ ] Environment variables configured
- [ ] Error handling and retries implemented
- [ ] Logging and monitoring set up
- [ ] Performance testing completed
- [ ] Security review conducted
- [ ] Backup and recovery procedures tested
- [ ] Documentation updated

Next, you'll learn best practices for workflow design and maintenance!