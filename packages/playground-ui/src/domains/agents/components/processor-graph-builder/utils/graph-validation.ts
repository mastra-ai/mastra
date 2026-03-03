import type { ProcessorGraphBuilderState, ValidationResult, ValidationError } from '../types';

export function validateGraph(state: ProcessorGraphBuilderState): ValidationResult {
  const errors: ValidationError[] = [];

  for (const layer of state.layers) {
    const { entry } = layer;

    switch (entry.type) {
      case 'step': {
        if (!entry.step.providerId) {
          errors.push({ layerId: layer.id, field: 'providerId', message: 'Step must have a processor provider' });
        }
        if (entry.step.enabledPhases.length === 0) {
          errors.push({
            layerId: layer.id,
            field: 'enabledPhases',
            message: 'Step must have at least one enabled phase',
          });
        }
        break;
      }

      case 'parallel': {
        if (entry.branches.length === 0) {
          errors.push({ layerId: layer.id, message: 'Parallel layer must have at least one branch' });
        }
        for (let bi = 0; bi < entry.branches.length; bi++) {
          const branch = entry.branches[bi]!;
          if (branch.length === 0) {
            errors.push({ layerId: layer.id, field: `branch-${bi}`, message: `Branch ${bi + 1} has no steps` });
          }
          for (let si = 0; si < branch.length; si++) {
            const entry = branch[si]!;
            if (entry.type !== 'step') continue;
            if (!entry.step.providerId) {
              errors.push({
                layerId: layer.id,
                field: `branch-${bi}-step-${si}-providerId`,
                message: `Branch ${bi + 1}, step ${si + 1} must have a processor provider`,
              });
            }
            if (entry.step.enabledPhases.length === 0) {
              errors.push({
                layerId: layer.id,
                field: `branch-${bi}-step-${si}-enabledPhases`,
                message: `Branch ${bi + 1}, step ${si + 1} must have at least one enabled phase`,
              });
            }
          }
        }
        break;
      }

      case 'conditional': {
        if (entry.conditions.length === 0) {
          errors.push({ layerId: layer.id, message: 'Conditional layer must have at least one condition' });
        }
        for (let ci = 0; ci < entry.conditions.length; ci++) {
          const condition = entry.conditions[ci]!;
          if (condition.steps.length === 0) {
            errors.push({
              layerId: layer.id,
              field: `condition-${ci}`,
              message: `Condition ${ci + 1} has no steps`,
            });
          }
        }
        break;
      }
    }
  }

  return { isValid: errors.length === 0, errors };
}
