import type { LogLevel, LogRecord } from './types';

const ENTITY_NAMES_BY_TYPE: Record<string, string[]> = {
  AGENT: [
    'chefAgent',
    'dynamicAgent',
    'evalAgent',
    'supervisorAgent',
    'networkAgent',
    'moderatedAssistantAgent',
    'simpleAssistantAgent',
    'subscriptionOrchestratorAgent',
  ],
  WORKFLOW: [
    'myWorkflow',
    'lessComplexWorkflow',
    'nestedWorkflow',
    'contentModerationWorkflow',
    'advancedModerationWorkflow',
    'findUserWorkflow',
  ],
  TOOL: [
    'cooking-tool',
    'get-weather',
    'calculator_add',
    'calculator_multiply',
    'get_stock_price',
    'translate_text',
    'search_database',
    'generate_report',
    'create_subscription',
  ],
  SYSTEM: ['mastra-server'],
};

const ENTITY_TYPES = Object.keys(ENTITY_NAMES_BY_TYPE);

const LOG_MESSAGES: Record<string, string[]> = {
  AGENT: [
    'Processing user query',
    'Generating response with model gpt-4o',
    'Memory context retrieved successfully',
    'Tool selection: chose cooking-tool',
    'Response generated in streaming mode',
    'Conversation turn completed',
    'Agent initialized with 3 tools',
    'Rate limit check passed',
    'Context window: 4,521 tokens used',
    'Moderation check passed',
  ],
  WORKFLOW: [
    'Workflow execution started',
    'Step 1/4: Data collection completed',
    'Step 2/4: Content moderation check',
    'Step 3/4: Validation passed',
    'Step 4/4: Output generated',
    'Workflow completed successfully',
    'Retry attempt 2/3 for step findUser',
    'Parallel branch merged',
    'Condition evaluated: route → moderation-branch',
    'Workflow execution failed at step transform',
  ],
  TOOL: [
    'Fetching weather data for New York',
    'Recipe lookup: found 12 matching dishes',
    'Calculator: 42 + 58 = 100',
    'Stock price query: AAPL → $198.50',
    'Translation completed: en → es',
    'Database search returned 42 rows',
    'Report generated: quarterly-summary.pdf',
    'Subscription created: plan=pro',
    'GET https://api.openweathermap.org → 200',
    'Tool execution completed successfully',
  ],
  SYSTEM: [
    'Server started on port 4111',
    'Health check: all services operational',
    'Memory usage: 256 MB / 512 MB',
    'MCP server connected: myMcpServer',
    'MCP server connected: myMcpServerTwo',
    'Database connection pool: 8/20 active',
    'Auth middleware initialized',
    'RBAC provider loaded',
    'Observability exporter flushed 24 spans',
    'Metrics exported to collector',
  ],
};

const ERROR_MESSAGES = [
  'Connection refused: ECONNREFUSED 127.0.0.1:5432',
  'Timeout exceeded: 30000ms',
  'Rate limit exceeded — 429 Too Many Requests',
  'Invalid API key provided',
  'Out of memory: heap allocation failed',
  'Unhandled promise rejection',
];

function randomHexString(length: number) {
  return Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickLevel(): LogLevel {
  const r = Math.random();
  if (r < 0.6) return 'info';
  if (r < 0.8) return 'warn';
  if (r < 0.92) return 'error';
  if (r < 0.97) return 'debug';
  return 'fatal';
}

export function generateMockLogs(count: number): LogRecord[] {
  const now = Date.now();
  const logs: LogRecord[] = [];

  for (let i = 0; i < count; i++) {
    const entityType = pickRandom(ENTITY_TYPES);
    const entityName = pickRandom(ENTITY_NAMES_BY_TYPE[entityType]);
    const level = pickLevel();
    const message = level === 'error' ? pickRandom(ERROR_MESSAGES) : pickRandom(LOG_MESSAGES[entityType]);

    logs.push({
      timestamp: new Date(now - (i < 10 ? i * (Math.random() * 5000 + 500) : (i - 10) * (Math.random() * 5000 + 500) + 86_400_000)),
      level,
      message,
      traceId: randomHexString(32),
      spanId: randomHexString(16),
      entityType,
      entityName,
      serviceName: entityType === 'SYSTEM' ? 'mastra-server' : entityName,
      environment: 'production',
      source: 'mastra',
      metadata: { host: 'prod-us-east-1', version: '1.2.3' },
    });
  }

  return logs.sort((a, b) => (b.timestamp as Date).getTime() - (a.timestamp as Date).getTime());
}
