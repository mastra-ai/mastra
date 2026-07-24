/**
 * Context-free structural rules: everything that can be decided from the
 * definition alone — ids, duplicates, entry placement, container arity,
 * declarative-predicate presence, nested-workflow identity, self-cycles.
 */
import { forEachSingleStepEntryWithPath } from '../graph';
import { leafEntryId } from './types';
import type { WorkflowValidationInput, WorkflowValidationIssue } from './types';

const TOP_LEVEL_PATH = /^graph\.\d+$/;

export function validateWorkflowStructure(def: WorkflowValidationInput): WorkflowValidationIssue[] {
  const issues: WorkflowValidationIssue[] = [];

  if (def.graph.length === 0) {
    issues.push({ code: 'empty-graph', path: 'graph', message: 'Workflow graph must contain at least one step.' });
  }

  const seenIds = new Set<string>();
  forEachSingleStepEntryWithPath(def.graph, (entry, path) => {
    const id = leafEntryId(entry);
    const idPath = entry.type === 'step' ? `${path}.step.id` : `${path}.id`;
    if (!id) issues.push({ code: 'missing-step-id', path: idPath, message: 'Step id is required.' });
    else if (seenIds.has(id))
      issues.push({ code: 'duplicate-step-id', path: idPath, message: `Step id "${id}" is duplicated.` });
    else seenIds.add(id);

    if (entry.type === 'mapping' && !TOP_LEVEL_PATH.test(path)) {
      issues.push({
        code: 'invalid-map-placement',
        path,
        message: 'Persisted mapping steps must be top-level workflow entries.',
      });
    }

    if (entry.type === 'workflow') {
      if (entry.id !== entry.workflowId) {
        issues.push({
          code: 'invalid-nested-workflow-id',
          path: `${path}.id`,
          message: `Nested workflow step id "${entry.id}" must match workflowId "${entry.workflowId}". Use "${entry.workflowId}" for both fields.`,
        });
      }
      if (entry.workflowId === def.id) {
        issues.push({
          code: 'self-reference',
          path: `${path}.workflowId`,
          message: `Step "${entry.id}" declares { type: "workflow", workflowId: "${entry.workflowId}" } which refers to itself. Nested workflow cycles are not allowed.`,
        });
      }
    }
  });

  def.graph.forEach((entry, index) => {
    const path = `graph.${index}`;
    switch (entry.type) {
      case 'parallel':
      case 'conditional': {
        if (entry.steps.length === 0) {
          issues.push({
            code: entry.type === 'parallel' ? 'invalid-parallel' : 'invalid-conditional',
            path: `${path}.steps`,
            message: `${entry.type} steps cannot be empty.`,
          });
        }
        if (entry.type === 'conditional') {
          if (!entry.predicates) {
            issues.push({
              code: 'invalid-conditional',
              path,
              message: 'Conditional entries must use declarative predicates.',
            });
          } else {
            if (entry.steps.length !== entry.predicates.length) {
              issues.push({
                code: 'invalid-conditional',
                path,
                message: 'Conditional steps and predicates must be aligned.',
              });
            }
            entry.predicates.forEach((predicate, predicateIndex) => {
              if (predicate === null) {
                issues.push({
                  code: 'invalid-conditional',
                  path: `${path}.predicates.${predicateIndex}`,
                  message: 'Conditional entries must use declarative predicates.',
                });
              }
            });
          }
        }
        return;
      }
      case 'loop': {
        if (!entry.predicate) {
          issues.push({
            code: 'invalid-loop',
            path,
            message: 'Loop entries must use a declarative predicate.',
          });
        }
        return;
      }
      case 'foreach': {
        if (entry.opts?.concurrency !== undefined && entry.opts.concurrency < 1) {
          issues.push({
            code: 'invalid-foreach',
            path: `${path}.opts.concurrency`,
            message: 'Concurrency must be positive.',
          });
        }
        return;
      }
      default:
        return;
    }
  });

  return issues;
}
