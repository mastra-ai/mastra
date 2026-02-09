# Datasets

**Datasets are collections of test cases used to systematically evaluate AI agents and workflows.**

Catch quality issues before they reach users. Measure whether changes improve or regress performance. Build confidence that your AI application works as expected.

---

## The Problem

Building AI applications today often means:

- Testing with a few manual examples and hoping for the best
- No way to know if a prompt change made things better or worse
- Discovering quality issues from user complaints, not testing
- Difficulty comparing different approaches objectively

Teams need a structured way to evaluate AI behavior—similar to how unit tests work for traditional software, but designed for the non-deterministic nature of AI outputs.

---

## How It Works

```
Create Dataset     →     Run Experiment     →     Review Results
(test cases)            (execute & score)        (compare & improve)
```

1. **Create a dataset** with test cases representing real usage scenarios
2. **Run the dataset** against your agent or workflow
3. **Scores are computed** automatically for each result
4. **Compare runs** to see what improved or regressed
5. **Iterate** with confidence that you're measuring quality

---

## Key Capabilities

- **Multiple targets** — Test agents, workflows, scorers, or data processors. Evaluate any component in isolation before integrating.
- **Automatic scoring** — Apply quality metrics to every result. Remove manual review bottlenecks and get consistent measurement.
- **Run comparison** — Side-by-side analysis with regression detection. Know exactly what changed when you modify prompts or models.
- **Versioning** — Track dataset changes, reproduce past experiments. Never wonder which test data was used for a specific run.
- **Bulk import** — Load test cases from CSV files. Quickly onboard existing test data from spreadsheets or other systems.
- **Analytics** — Score distributions, trends, and latency metrics. Spot patterns and track quality trajectory over time.
- **Item selection** — Run experiments on specific items instead of full datasets. Iterate quickly on failing cases, debug edge cases, or test fixes before full evaluation runs.

---

## Current Status

### Done

in branch: https://github.com/mastra-ai/mastra/pull/12168

- Core dataset and item management
- Basic run execution against agents
- Storage adapters (InMemory, LibSQL)

### In Progress

- Automatic scoring integration
- Run comparison and analytics
- Workflow target support
- UI for full evaluation workflow

---

## Child Pages

- [Datasets Backend Requirements](./datasets-backend-requirements.md)
- [Dataset Backend Tasks](./dataset-backend-tasks.md)
- [Dataset UI Requirements](./dataset-ui-requirements.md)
- [Dataset UI Tasks](./dataset-ui-tasks.md)
- [Datasets Core Requirements](./datasets-core-requirements.md)
- [Datasets Core Test Coverage Tasks](./datasets-core-test-coverage-tasks.md)
- [Dataset Item Details Dialog](./dataset-item-details-dialog.md)
- [Studio - Context.md](./studio-context.md)
- [Mastra - Langfuse Comparison](./mastra-langfuse-comparison.md)
- [Mastra - Braintrust comparison](./mastra-braintrust-comparison.md)
- [Remaining requirements for MVP](./remaining-requirements-mvp.md)
