---
'@mastra/core': minor
---

Add `beforeAll`, `afterAll`, `beforeEach`, and `afterEach` lifecycle hooks to `runExperiment` for setting up and tearing down test data around an experiment run. `beforeAll` failures fail the experiment, `beforeEach` failures mark the item failed and skip execution (with `afterEach` still running), and `afterEach` failures are logged as warnings.
