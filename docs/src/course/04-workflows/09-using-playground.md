# Using the Playground

The Mastra Playground provides a visual interface to test and run your workflows. Let's see your workflow in action!

## Starting the Development Server

Start your Mastra development server:

```bash
pnpm dev
```

You should see output like:
```
🚀 Mastra Dev Server starting...
📊 Playground available at: http://localhost:4111
```

## Accessing Workflows in Playground

1. Open your browser and go to `http://localhost:4111`
2. Click on "Workflows" in the navigation
3. You should see your `contentWorkflow` listed

## Testing Your Workflow

1. Click on your `contentWorkflow`
2. You'll see an input form based on your workflow's input schema
3. Enter some test content:
   ```json
   {
     "content": "Machine learning is revolutionizing healthcare by enabling faster diagnoses and personalized treatments.",
     "type": "article"
   }
   ```
4. Click "Run Workflow"
5. Watch the execution progress and see the results

## Understanding the Interface

The playground shows you:
- **Input Schema**: What data your workflow expects
- **Execution Progress**: Real-time updates as steps complete
- **Output**: The final result from your workflow
- **Execution Time**: How long the workflow took to run

## Benefits of the Playground

- **Visual Testing**: Easy way to test workflows without writing code
- **Schema Validation**: Automatic form generation from your schemas
- **Real-time Feedback**: See exactly what's happening during execution
- **Easy Debugging**: Quickly test different inputs

Great! You can now visually test your workflow. Next, you'll learn how to run workflows programmatically.