# Workflow Builder for Mastra

The Workflow Builder is a new feature in the agent-builder package that allows you to create, edit, and discover Mastra workflows using AI-powered assistance.

## Features

- **Workflow Discovery**: Automatically discover existing workflows in your Mastra project
- **AI-Assisted Creation**: Create new workflows using natural language descriptions
- **Smart Editing**: Edit existing workflows with intelligent suggestions
- **Project Analysis**: Understand your project structure and dependencies
- **Research Integration**: Leverage documentation and best practices
- **Task Management**: Systematic task planning and execution
- **Validation**: Automatic code validation and error fixing

## Usage

### Import the Workflow Builder

```typescript
import {
  workflowBuilderWorkflow,
  createWorkflowWithBuilder,
  editWorkflowWithBuilder,
  discoverWorkflows,
} from '@mastra/agent-builder';
```

### Discover Existing Workflows

```typescript
// Discover all workflows in your project
const discoveryResult = await discoverWorkflows('/path/to/your/project');

console.log(`Found ${discoveryResult.discovery.workflows.length} workflows:`);
discoveryResult.discovery.workflows.forEach(workflow => {
  console.log(`- ${workflow.name} (${workflow.file})`);
});
```

### Create a New Workflow

```typescript
// Create a new workflow using AI assistance
const result = await createWorkflowWithBuilder(
  'emailProcessor',
  'Process incoming emails and extract key information',
  `Create a workflow that:
  1. Accepts an email object with subject, body, and sender
  2. Extracts key information using NLP
  3. Categorizes the email (urgent, normal, spam)
  4. Stores the processed information
  5. Returns a summary object`,
  '/path/to/your/project',
);

if (result.success) {
  console.log(`Workflow created: ${result.workflowFile}`);
  console.log('Next steps:', result.nextSteps);
} else {
  console.error('Failed to create workflow:', result.error);
}
```

### Edit an Existing Workflow

```typescript
// Edit an existing workflow
const editResult = await editWorkflowWithBuilder(
  'emailProcessor',
  'Enhanced email processing with sentiment analysis',
  `Modify the existing email processor workflow to:
  1. Add sentiment analysis to the email processing
  2. Include confidence scores for categorization
  3. Add retry logic for failed processing
  4. Improve error handling`,
  '/path/to/your/project',
);

if (editResult.success) {
  console.log(`Workflow updated: ${editResult.workflowFile}`);
} else {
  console.error('Failed to edit workflow:', editResult.error);
}
```

### Advanced Usage with the Main Workflow

```typescript
// Use the main workflow for more control
const run = await workflowBuilderWorkflow.createRunAsync();

const result = await run.start({
  inputData: {
    action: 'create', // or 'edit' or 'discover'
    workflowName: 'dataProcessor',
    description: 'Process and transform data files',
    requirements: `
      Create a workflow that:
      - Accepts file paths as input
      - Validates file formats
      - Transforms data according to schema
      - Outputs processed results
      - Handles errors gracefully
    `,
    projectPath: '/path/to/your/project',
  },
});

// Stream the workflow for real-time updates
const streamRun = await workflowBuilderWorkflow.createRunAsync();
const streamResult = await streamRun.stream({
  inputData: {
    action: 'create',
    workflowName: 'myWorkflow',
    description: 'My custom workflow',
    requirements: 'Detailed requirements here...',
  },
});

for await (const chunk of streamResult.stream) {
  console.log('Progress:', chunk);
}
```

## Workflow Structure

The Workflow Builder follows this systematic approach:

1. **Discovery Phase**: Analyzes your project to understand existing structure
2. **Research Phase**: Gathers relevant documentation and best practices
3. **Planning Phase**: Creates a detailed task list for implementation
4. **Execution Phase**: Systematically implements the workflow
5. **Validation Phase**: Tests and validates the created workflow

## Configuration

The Workflow Builder integrates with the AgentBuilder system and uses the same configuration:

```typescript
import { AgentBuilder } from '@mastra/agent-builder';
import { openai } from '@ai-sdk/openai';

// Configure your AgentBuilder
const builder = new AgentBuilder({
  projectPath: '/path/to/your/project',
  mode: 'code-editor',
  model: openai('gpt-4o'),
  instructions: 'Custom instructions for workflow generation...',
});
```

## Best Practices

1. **Clear Requirements**: Provide detailed, specific requirements for better results
2. **Project Structure**: Ensure your project follows Mastra conventions
3. **Iterative Development**: Start with simple workflows and gradually add complexity
4. **Validation**: Always test generated workflows before using in production
5. **Documentation**: Document your custom workflows for future reference

## Examples

See the `/examples` directory for complete workflow examples created with the Workflow Builder.

## Troubleshooting

### Common Issues

1. **Model Configuration**: Ensure your language model is properly configured
2. **Project Path**: Verify the project path points to a valid Mastra project
3. **Dependencies**: Check that all required dependencies are installed
4. **Permissions**: Ensure write permissions for the target directory

### Error Handling

The Workflow Builder includes comprehensive error handling and will provide detailed error messages to help debug issues.

## Contributing

To contribute to the Workflow Builder:

1. Fork the repository
2. Create a feature branch
3. Implement your changes
4. Add tests
5. Submit a pull request

## License

This package is part of the Mastra ecosystem and follows the same licensing terms.
