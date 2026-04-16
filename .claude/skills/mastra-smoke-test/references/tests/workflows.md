# Workflows Testing (`--test workflows`)

## Purpose

Verify workflows page loads and workflow execution works.

## Steps

### 1. Navigate to Workflows Page

- [ ] Open `/workflows` in Studio
- [ ] Note if workflows list loads and any errors displayed
- [ ] Record which workflows appear

### 2. Select a Workflow

- [ ] Click on a workflow (e.g., `weather-workflow`)
- [ ] Note if workflow details/run panel opens
- [ ] Record which input fields are visible (if any)

### 3. Execute Workflow

- [ ] Enter the required input (e.g., "Berlin" for city)
- [ ] Click "Run" or "Execute"
- [ ] Wait for workflow to complete

### 4. Observe Execution

- [ ] Record the workflow state shown (Running, etc.)
- [ ] Note completion status (success, failure, steps shown)
- [ ] Record output/result displayed

### 5. Check Workflow Steps

- [ ] Record which individual steps executed
- [ ] Note step-by-step output if available
- [ ] Record the final result

## Observations to Report

| Check          | What to Record                       |
| -------------- | ------------------------------------ |
| Workflows list | Which workflows appear, any errors   |
| Run panel      | Input fields and controls shown      |
| Execution      | State transitions, completion status |
| Steps          | Which steps executed, their output   |
| Output         | Final result content                 |

## Common Issues

| Issue                | Cause                    | Fix                           |
| -------------------- | ------------------------ | ----------------------------- |
| "No workflows found" | Workflows not registered | Check `src/mastra/workflows/` |
| Workflow fails       | Step error               | Check individual step logs    |
| Timeout              | Long-running workflow    | Increase timeout or simplify  |

## Browser Actions

```text
Navigate to: /workflows
Click: First workflow in list
Type in input (if required): "Berlin"
Click: Run button
Wait: For completion
Verify: Success state and output
```
