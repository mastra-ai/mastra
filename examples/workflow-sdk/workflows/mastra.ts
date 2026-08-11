/**
 * Registers the @mastra/workflow-sdk runner with the Workflow SDK compiler.
 *
 * Both lines are load-bearing:
 * - the re-export puts the runner and its steps into the workflow build so
 *   the compiler can assign them ids;
 * - the side-effect import loads the Mastra workflow definitions in the
 *   process that executes steps — without it every step fails with a
 *   "workflow not registered" error.
 */
export * from '@mastra/workflow-sdk/workflows';
import '../src/mastra';
