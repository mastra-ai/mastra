# Experiments - User Requirements

## Overview

Experiments enable teams to systematically test Agents and Workflows against Datasets before deploying to production. Results are persisted, linked to traces, and can be compared across versions.

---

## 1. Playground UI Requirements

### 1.1 Navigation

- [ ] "Experiments" appears in the Observability section of the sidebar navigation

### 1.2 Experiments List Page

- [ ] User can view a table of all experiments
- [ ] Table shows: Name, Target, Dataset, Status, Scores Summary, Created Date
- [ ] User can filter by Target (Agent/Workflow)
- [ ] User can filter by Dataset
- [ ] User can filter by Status (pending, running, completed, failed, cancelled)
- [ ] User can filter by Date Range
- [ ] User can paginate through results
- [ ] User can click a row to view experiment details
- [ ] User can select two experiments to compare
- [ ] User can re-run an experiment from the list
- [ ] User can delete an experiment from the list

### 1.3 New Experiment Page

- [ ] User can enter a name for the experiment
- [ ] User can enter an optional description
- [ ] User can select a Target Type (Agent or Workflow)
- [ ] User can select which Agent or Workflow to test
- [ ] User can select which version of the target to test (published or draft)
- [ ] User can see version details (hash, label, date) after selection
- [ ] User can select a Dataset to run against
- [ ] User can see the dataset item count before running
- [ ] User can see the default scorers configured on the target
- [ ] User can add additional scorers
- [ ] User can remove scorers from the default set
- [ ] User can configure concurrency (how many items run in parallel)
- [ ] User can click "Run Experiment" to start execution
- [ ] Form fields can be pre-populated via URL parameters (for contextual entry)

### 1.4 Experiment Detail Page

- [ ] User can see experiment metadata (name, description, status, timestamps)
- [ ] User can see target information (name, type, version details)
- [ ] User can see dataset information (name, item count)
- [ ] User can see a progress bar while the experiment is running
- [ ] User can see "X of Y items completed" during execution
- [ ] User can cancel a running experiment
- [ ] User can see aggregate scores after completion (mean, min, max per scorer)
- [ ] User can see a table of all results (one row per dataset item)
- [ ] Results table shows: Input preview, Output preview, Scores, Status
- [ ] User can expand a row to see full input/output content
- [ ] User can click "View Trace" to see the full trace for any result
- [ ] User can re-run the experiment
- [ ] User can compare this experiment with another
- [ ] User can delete the experiment

### 1.5 Compare Page

- [ ] User can compare two experiments side-by-side
- [ ] User can see both experiment names and metadata
- [ ] User can see aggregate score differences (Exp 1 vs Exp 2)
- [ ] User can see the direction of change (improvement or regression)
- [ ] User can see percentage change for each scorer
- [ ] User can see per-item score differences (when same dataset)
- [ ] User can filter to show only regressions
- [ ] User can filter to show only improvements
- [ ] User can navigate to either experiment's detail page

### 1.6 Re-run Functionality

- [ ] User can re-run an experiment with the same configuration
- [ ] User can provide a new name (defaults to "Re-run: {original name}")
- [ ] Re-run creates a new experiment record (original preserved)
- [ ] Re-run uses the current version of the target (not the original version)

### 1.7 Contextual Entry Points

Users can trigger experiment creation from related pages, reducing navigation friction.

**From Dataset Page:**

- [ ] User can click "Run Experiment" from a Dataset detail page
- [ ] Clicking navigates to new experiment form with dataset pre-selected
- [ ] User can still change the pre-selected dataset if needed

**From Agent Page:**

- [ ] User can click "Run Experiment" from an Agent detail page
- [ ] Clicking navigates to new experiment form with agent pre-selected
- [ ] Target type is set to "Agent" automatically

**From Workflow Page:**

- [ ] User can click "Run Experiment" from a Workflow detail page
- [ ] Clicking navigates to new experiment form with workflow pre-selected
- [ ] Target type is set to "Workflow" automatically

---

## 2. Server SDK Requirements

### 2.1 Running Experiments

- [ ] Developer can run an experiment via `mastra.runExperiment()`
- [ ] Developer can specify a name and description
- [ ] Developer can specify which Agent or Workflow to test
- [ ] Developer can specify which version of the target to test
- [ ] Developer can specify a Dataset ID
- [ ] Developer can specify which scorers to use
- [ ] Developer can exclude specific default scorers
- [ ] Developer can set concurrency limit
- [ ] Developer can receive progress updates via callback

### 2.2 Querying Experiments

- [ ] Developer can get an experiment by ID via `mastra.getExperiment(id)`
- [ ] Developer can list experiments via `mastra.listExperiments(options)`
- [ ] Developer can filter by target, dataset, status, and date range
- [ ] Developer can paginate results
- [ ] Developer can get results for an experiment via `mastra.getExperimentResults(id)`
- [ ] Developer can compare two experiments via `mastra.compareExperiments(id1, id2)`

---

## 3. Client SDK Requirements

### 3.1 Running Experiments

- [ ] Frontend developer can create an experiment via `client.experiments.create()`
- [ ] Frontend developer can subscribe to progress via `client.experiments.subscribe()`
- [ ] Progress subscription provides real-time updates (completed count, latest result)
- [ ] Progress subscription notifies on completion or failure

### 3.2 Querying Experiments

- [ ] Frontend developer can get an experiment via `client.experiments.get(id)`
- [ ] Frontend developer can list experiments via `client.experiments.list(options)`
- [ ] Frontend developer can get results via `client.experiments.getResults(id)`
- [ ] Frontend developer can compare experiments via `client.experiments.compare(id1, id2)`

### 3.3 Managing Experiments

- [ ] Frontend developer can cancel a running experiment via `client.experiments.cancel(id)`
- [ ] Frontend developer can delete an experiment via `client.experiments.delete(id)`
- [ ] Frontend developer can re-run an experiment via `client.experiments.rerun(id)`

---

## 4. CI/CD Requirements

### 4.1 Threshold Configuration

- [ ] Developer can configure score thresholds for pass/fail determination
- [ ] Developer can set minimum threshold (score must be >= value)
- [ ] Developer can set maximum threshold (score must be <= value)
- [ ] Developer can set thresholds for multiple scorers

### 4.2 Pass/Fail Determination

- [ ] Experiment result indicates whether all thresholds passed
- [ ] Experiment result lists which thresholds failed and why
- [ ] Experiment result can be awaited synchronously for CI usage

### 4.3 CLI Integration

- [ ] Developer can run experiments via CLI: `mastra experiment run`
- [ ] Developer can list experiments via CLI: `mastra experiment list`
- [ ] Developer can get experiment details via CLI: `mastra experiment get <id>`
- [ ] CLI exits with code 0 when thresholds pass
- [ ] CLI exits with code 1 when thresholds fail
- [ ] CLI supports JSON output for machine parsing

---

## 5. Data Persistence Requirements

- [ ] Experiment metadata is persisted (name, description, status, timestamps)
- [ ] Experiment configuration is persisted (target, dataset, scorers, concurrency)
- [ ] Target version is captured at creation time for traceability
- [ ] Each result item is persisted (input, output, scores, trace link, latency)
- [ ] Aggregate scores are calculated and stored
- [ ] Experiments can be retrieved after completion
- [ ] Experiments can be deleted (soft delete)

---

## 6. Execution Requirements

- [ ] Each dataset item is executed against the target
- [ ] Each result is scored by configured scorers
- [ ] A trace is created for each execution
- [ ] Trace ID is stored with the result for navigation
- [ ] Progress updates are provided during execution
- [ ] Execution continues even if individual items fail
- [ ] Failed items capture error information
- [ ] Status transitions: pending → running → completed/failed/cancelled
