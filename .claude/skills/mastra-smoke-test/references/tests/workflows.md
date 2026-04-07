# Workflows Testing (`--test workflows`)

## Purpose
Verify workflows page loads and workflow execution works.

## Steps

### 1. Navigate to Workflows Page
- [ ] Open `/workflows` in Studio
- [ ] Verify workflows list loads without errors
- [ ] Confirm at least one workflow appears

### 2. Select a Workflow
- [ ] Click on a workflow (e.g., `weather-workflow`)
- [ ] Verify workflow details/run panel opens
- [ ] Confirm input fields are visible (if any)

### 3. Execute Workflow
- [ ] Enter required input (e.g., "Berlin" for city)
- [ ] Click "Run" or "Execute"
- [ ] Wait for workflow to complete

### 4. Verify Execution
- [ ] Workflow shows "Running" state
- [ ] Workflow completes (success or shows steps)
- [ ] Output/result is visible

### 5. Check Workflow Steps
- [ ] Verify individual steps executed
- [ ] Check step-by-step output if available
- [ ] Confirm final result matches expected

## Expected Results

| Check | Expected |
|-------|----------|
| Workflows list | Shows available workflows |
| Run panel | Input fields and run button visible |
| Execution | Shows running state, then completes |
| Steps | Individual steps visible/executed |
| Output | Final result displayed |

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| "No workflows found" | Workflows not registered | Check `src/mastra/workflows/` |
| Workflow fails | Step error | Check individual step logs |
| Timeout | Long-running workflow | Increase timeout or simplify |

## Browser Actions

```
Navigate to: /workflows
Click: First workflow in list
Type in input (if required): "Berlin"
Click: Run button
Wait: For completion
Verify: Success state and output
```
