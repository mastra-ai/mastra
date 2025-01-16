# Role-based prompting

Role-based prompting helps models adopt specific personas for specialized tasks. Here's how to implement it in Mastra:

```typescript
type CodeReviewVars = {
  code: string;
  focus: 'security' | 'performance' | 'architecture';
};

const securityReviewPrompt = createPrompt<CodeReviewVars>('Review code security', {
  persona: 'Senior Security Engineer',
  style: 'thorough',
  tone: 'professional',
  outputFormat: 'markdown',
})
  .text('Review this code for {{focus}} concerns:\n\n{{code}}')
  .constraints([
    'Focus on security best practices',
    'Identify potential vulnerabilities',
    'Suggest secure alternatives',
    'Reference relevant security standards',
  ])
  .thinking({
    steps: [
      'Identify sensitive operations',
      'Check for common vulnerabilities',
      'Evaluate security controls',
      'Assess compliance requirements',
      'Propose security improvements',
    ],
  });

// Usage example
const review = securityReviewPrompt.toString({
  code: `
    function authenticateUser(username, password) {
      if (username === 'admin' && password === 'password123') {
        return true;
      }
      return false;
    }
  `,
  focus: 'security',
});
```

# Few-Shot Learning

Few-shot learning helps models understand patterns through examples. Here's how to implement it effectively in Mastra:

```typescript
type SentimentVars = {
  text: string;
  language: string;
};

const sentimentPrompt = createPrompt<SentimentVars>('Analyze sentiment', {
  persona: 'Language Analyst',
  outputFormat: 'json',
})
  .text('Analyze the sentiment of this {{language}} text:\n\n{{text}}')
  .examples([
    {
      input: {
        text: 'The product exceeded my expectations, highly recommend!',
        language: 'English',
      },
      output: {
        sentiment: 'positive',
        confidence: 0.95,
        aspects: ['product quality', 'recommendation'],
      },
    },
    {
      input: {
        text: 'Service was okay, but the wait time was too long',
        language: 'English',
      },
      output: {
        sentiment: 'mixed',
        confidence: 0.8,
        aspects: ['service quality', 'wait time'],
      },
    },
  ])
  .constraints([
    'Follow the exact output format from examples',
    'Include confidence score',
    'Identify key aspects mentioned',
  ]);

// Usage example
const analysis = sentimentPrompt.toString({
  text: 'Great features but the interface could be more intuitive',
  language: 'English',
});
```

# Chain of Thought Prompting

Chain of thought prompting helps models break down complex problems into steps. Here's how to implement it in Mastra:

```typescript
type WordProblemVars = {
  problem: string;
};

const mathSolver = createPrompt<WordProblemVars>('Solve word problem', {
  persona: 'Math Teacher',
  outputFormat: 'markdown',
})
  .text('Solve this word problem:\n\n{{problem}}')
  .thinking({
    autoChainOfThought: true,
    steps: [
      'Read and understand the problem',
      'Identify important information',
      'Choose the right operation',
      'Solve step by step',
      'Check the answer',
    ],
  });

// Usage example
const solution = mathSolver.toString({
  problem: 'If a store sells 12 apples per hour and is open for 8 hours, how many apples do they sell in a day?',
});
```

# Self-Verification Prompting

Self-verification prompting helps models validate their own outputs and catch potential errors. Here's how to implement it in Mastra:

```typescript
type CodeGenerationVars = {
  requirements: string;
  language: 'typescript' | 'python' | 'javascript';
  testCases?: string[];
};

const codeGenPrompt = createPrompt<CodeGenerationVars>('Generate code with verification', {
  persona: 'Senior Software Engineer',
  outputFormat: 'markdown',
})
  .text('Generate {{language}} code that meets these requirements:\n\n{{requirements}}')
  .thinking({
    steps: [
      'Analyze requirements',
      'Plan implementation approach',
      'Write initial code',
      'Add error handling',
      'Implement input validation',
    ],
  })
  .verificationSteps([
    'Check if implementation meets all requirements',
    'Run test cases: {{testCases}}',
    'Verify edge case handling',
    'Validate error handling',
    'Check input validation',
    'Assess code quality',
    'Identify potential improvements',
  ])
  .constraints([
    'Must handle all edge cases',
    'Include input validation',
    'Add error handling',
    'Follow {{language}} best practices',
  ]);

// Usage example
const implementation = codeGenPrompt.toString({
  requirements: 'Create a function that validates email addresses',
  language: 'typescript',
  testCases: ['valid email', 'missing @', 'multiple @', 'invalid domain'],
});
```

# Tree of Thought Prompting

Tree of thought prompting helps models explore multiple solution paths simultaneously. Here's how to implement it in Mastra:

```typescript
type ProblemSolvingVars = {
  problem: string;
};

const problemSolver = createPrompt<ProblemSolvingVars>('Solve complex problem', {
  persona: 'Problem Solver',
  outputFormat: 'markdown',
})
  .text('Solve this problem:\n\n{{problem}}')
  .thinking({
    branches: {
      'Technical Solution': [
        'Analyze technical requirements',
        'Consider implementation options',
        'Evaluate technical tradeoffs',
      ],
      'User Experience': ['Identify user needs', 'Design user interactions', 'Consider accessibility'],
      'Business Impact': ['Assess costs', 'Evaluate timeline', 'Consider scalability'],
    },
  });

// Usage example
const solution = problemSolver.toString({
  problem: 'Design a new feature for uploading and processing large files in a web application',
});
```
