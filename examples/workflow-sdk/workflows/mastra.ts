/**
 * Bridges Mastra into the Workflow SDK.
 *
 * The re-export exposes the Workflow SDK workflow and step functions that
 * `@mastra/workflow` ships (the ones carrying the "use workflow" and
 * "use step" directives), so the Workflow SDK compiler picks them up from this
 * project's `workflows/` directory and generates route handlers for them.
 *
 * The side-effect import pulls in the Mastra instance so the workflows it
 * registers are known to the runner before a run is replayed.
 */
export * from '@mastra/workflow/workflows';

import '../src/mastra';
