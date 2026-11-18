import { isProcessorWorkflow } from './is-processor-workflow';
import type { InputProcessorOrWorkflow, OutputProcessorOrWorkflow, Processor } from './index';

/** Whether any processor matches, looking inside processor workflows (including the agent's combined one). */
export function hasConfiguredProcessor(
  processors: Array<InputProcessorOrWorkflow | OutputProcessorOrWorkflow>,
  predicate: (processor: Processor) => boolean,
): boolean {
  return processors.some(processor => {
    const maybeWorkflow = processor as {
      steps?: Record<string, unknown>;
      stepGraph?: Array<{ type: string; step?: unknown; steps?: Array<{ step?: unknown }> }>;
    };
    const isWorkflowLike = isProcessorWorkflow(processor);

    const workflowSteps = [
      ...Object.values(maybeWorkflow.steps ?? {}),
      ...(maybeWorkflow.stepGraph ?? []).flatMap(entry => {
        if (entry.type === 'step') {
          return entry.step ? [entry.step] : [];
        }
        return entry.steps?.map(stepEntry => stepEntry.step).filter(Boolean) ?? [];
      }),
    ];

    if (!isWorkflowLike || workflowSteps.length === 0) {
      const processorId =
        typeof (processor as Processor).id === 'string' && (processor as Processor).id.startsWith('processor:')
          ? (processor as Processor).id.slice('processor:'.length)
          : (processor as Processor).id;
      return predicate({
        ...(processor as Processor),
        id: processorId,
        providesSkillDiscovery: (processor as Processor).providesSkillDiscovery,
      } as Processor);
    }

    return workflowSteps.some(step => {
      if (isProcessorWorkflow(step)) {
        return hasConfiguredProcessor([step], predicate);
      }

      const stepId = typeof (step as { id?: unknown }).id === 'string' ? (step as { id: string }).id : undefined;
      if (!stepId?.startsWith('processor:')) {
        return false;
      }

      const processorId = stepId.slice('processor:'.length);
      const workflowStep = step as { providesSkillDiscovery?: Processor['providesSkillDiscovery'] };
      return predicate({
        id: processorId,
        providesSkillDiscovery: workflowStep.providesSkillDiscovery,
      } as Processor);
    });
  });
}
