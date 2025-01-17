## Prompt Templates

### Core Elements

### 1. Intent

The primary instruction or goal of your prompt. This should be clear and specific:

```typescript
// ❌ Vague intent
createPrompt('fix this');

// ✅ Clear intent
createPrompt('Add type checking to this function');
```

### 2. Configuration

Optional settings that shape how the model approaches the task:

```typescript
const explainPrompt = createPrompt('Explain this code', {
  // Who the model should act as
  persona: 'JavaScript Teacher',

  // How to approach the explanation
  style: 'beginner-friendly',

  // Communication style
  tone: 'encouraging',

  // Expected response format
  outputFormat: 'markdown',

  // System or user message
  as: 'system',
});

// Usage
const explanation = explainPrompt.toString();
```

### 3. Components

Building blocks that make up your prompt:

```typescript
const debugPrompt = createPrompt('Debug this code')
  // Main input text
  .text('function add(x,y) { retrun x + y }')

  // Background information
  .context('This is part of a calculator app')

  // Response boundaries
  .constraints(['Fix only syntax errors', 'Keep the logic the same'])

  // Guide with examples
  .examples([
    {
      input: 'function sub(x,y) { reutrn x - y }',
      output: 'function sub(x,y) { return x - y }',
    },
  ])

  // Reasoning approach
  .thinking({
    autoChainOfThought: true,
    steps: ['Identify syntax errors', 'Apply corrections'],
  });

// Usage
const debug = debugPrompt.toString();
```

### 4. Variables

Dynamic values that can be injected into your prompts:

```typescript
// Define variable types
type CodeReviewVars = {
  file: string;
  changes: number;
};

// Create template with variables
const reviewTemplate = createPrompt<CodeReviewVars>('Review code changes')
  .text('Review {{changes}} changes in {{file}}')
  .constraints(['Focus on {{file}} specific patterns', 'Suggest maximum {{changes}} improvements']);

// Use the template with different values
const review1 = reviewTemplate.toString({
  file: 'auth.ts',
  changes: 3,
});

const review2 = reviewTemplate.toString({
  file: 'api.ts',
  changes: 5,
});
```

## Putting It All Together

Here's how all elements work together:

```typescript
type BugReportVars = {
  severity: string;
  component: string;
};

const bugReportTemplate = createPrompt<BugReportVars>('Create bug report', {
  persona: 'QA Engineer',
  outputFormat: 'markdown',
})
  .context('We use GitHub issues for tracking bugs')
  .constraints(['Be specific and actionable', 'Include reproduction steps'])
  .examples([
    {
      input: "Login button doesn't work",
      output: '## Login Authentication Failure\n1. Steps to reproduce...',
    },
  ])
  .text('Create a {{severity}} bug report for {{component}} issue');

// Usage examples
const reportString = bugReportTemplate.toString({
  severity: 'high',
  component: 'checkout',
});

const reportMessage = bugReportTemplate.toMessage({
  severity: 'high',
  component: 'checkout',
});
```
