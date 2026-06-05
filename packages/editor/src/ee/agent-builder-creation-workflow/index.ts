import { createWorkflow } from '@mastra/core/workflows';

import {
  createUnderstandUserOutcomeStep,
  createFeatureCapabilityStep,
  createSetDescriptionStep,
  createSetNameStep,
  createSetInstructionsStep,
  createSetWorkspaceIdStep,
  createSetToolsStep,
  createSetSkillsStep,
  createSetModelStep,
  createSetBrowserEnabledStep,
  createPersistAgentStep,
} from './steps';
import { inputSchema, createResultSchema, type Config } from './types';

export * from './types';
export * from './constant';

/**
 * Agent Builder Creation Workflow
 *
 * A sequence of steps that turns a plain-language description into an agent
 * configuration covering every field the playground agent-builder client tools
 * can set. The first step interprets the raw user prompt into a structured,
 * LLM-understandable user outcome (goal, audience, capabilities, tone, success
 * criteria); every later step reads that outcome so the produced fields are
 * grounded in what the user actually wants:
 * - `userOutcome` (understand-user-outcome)
 * - `featureCapabilities` (feature-capability)
 * - `name` (set-agent-name)
 * - `description` (set-agent-description)
 * - `instructions` (set-agent-instructions)
 * - `workspaceId` (set-agent-workspace-id)
 * - `tools` / `agents` / `workflows` (set-agent-tools, routed by type)
 * - `skills` (set-agent-skills)
 * - `model` (set-agent-model)
 * - `browserEnabled` (set-agent-browser-enabled)
 * - persisted agent (persist-agent) — the terminal step that maps the resolved
 *   config onto a `StorageCreateAgentInput` and calls `editor.agent.create(...)`,
 *   returning the created agent's id, visibility and resolved config.
 *
 * Each step lives in its own folder under `./steps` with three siblings: the
 * step (`index.ts`), a `handler.ts` with the infra-agnostic field logic, and an
 * `agent.ts` with the step's narrowly-scoped agent. The step's `execute`
 * instantiates that agent from the builder `model` and injects it into the
 * handler (DI). Handlers receive explicit domain arguments, never a workflow
 * `ctx`.
 *
 * The workflow is bound to the builder agent's `model` (a plain string). Each
 * step is built by a `createXStep({ model })` factory so that each step can spin
 * up its own sub-agent (`new Agent({ model, ... })`) using the same model the
 * builder runs on, mirroring `workflow-builder.ts`'s per-step research agent.
 */
export function createAgentBuilderCreationWorkflow({ model }: { model: string }) {
  const understandUserOutcomeStep = createUnderstandUserOutcomeStep({ model });
  const featureCapabilityStep = createFeatureCapabilityStep({ model });
  const setDescriptionStep = createSetDescriptionStep({ model });
  const setNameStep = createSetNameStep({ model });
  const setInstructionsStep = createSetInstructionsStep({ model });
  const setWorkspaceIdStep = createSetWorkspaceIdStep({ model });
  const setToolsStep = createSetToolsStep({ model });
  const setSkillsStep = createSetSkillsStep({ model });
  const setModelStep = createSetModelStep({ model });
  const setBrowserEnabledStep = createSetBrowserEnabledStep({ model });
  const persistAgentStep = createPersistAgentStep({ model });

  return (
    createWorkflow({
      id: 'agent-builder-creation',
      description: 'Turn a plain-language description into an agent configuration for the agent builder',
      inputSchema,
      outputSchema: createResultSchema,
      steps: [
        understandUserOutcomeStep,
        featureCapabilityStep,
        setDescriptionStep,
        setNameStep,
        setInstructionsStep,
        setWorkspaceIdStep,
        setToolsStep,
        setSkillsStep,
        setModelStep,
        setBrowserEnabledStep,
        persistAgentStep,
      ],
    })
      // The first two steps are sequential: every later step reads the structured
      // `userOutcome` (and the resolved `featureCapabilities`) they produce.
      .then(understandUserOutcomeStep)
      .then(featureCapabilityStep)
      // Independent fields only depend on `userOutcome`/`featureCapabilities`, so
      // they run concurrently. Each branch is handed the same accumulated config
      // and returns it with its own field added; `.parallel` keys those outputs by
      // step id, which the following `.map` merges back into one config.
      .parallel([setNameStep, setDescriptionStep, setWorkspaceIdStep, setToolsStep, setSkillsStep, setModelStep])
      .map(async ({ inputData }) => mergeParallelConfig(inputData))
      // `instructions` needs the resolved `name` + `description`, and
      // `browser-enabled` needs `description`, so they run after the merge — but
      // are independent of each other, so they too run concurrently.
      .parallel([setInstructionsStep, setBrowserEnabledStep])
      .map(async ({ inputData }) => mergeParallelConfig(inputData))
      .then(persistAgentStep)
      .commit()
  );
}

/**
 * Merge the branch outputs of a `.parallel([...])` group back into a single
 * accumulated config.
 *
 * `.parallel` yields `{ [stepId]: branchOutput }`. Every creation step spreads
 * the config it received and adds its own field, so each branch output is a full
 * `Config` that already carries `userOutcome`/`featureCapabilities` plus exactly
 * one freshly-resolved field. Spreading the branch outputs in order rebuilds the
 * combined config; later branches never clobber earlier ones because each only
 * sets its own field on top of the shared base.
 */
function mergeParallelConfig(inputData: Record<string, unknown>): Config {
  const branches = Object.values(inputData) as Config[];
  return branches.reduce<Config>((merged, branch) => ({ ...merged, ...branch }), branches[0] ?? ({} as Config));
}
