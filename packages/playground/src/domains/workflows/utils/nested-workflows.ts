import type { GetWorkflowResponse } from '@mastra/client-js';

export interface WorkflowListEntry extends GetWorkflowResponse {
  id: string;
}

interface TreeRowBase {
  /** Unique per rendered row — the same child under two parents expands independently. */
  pathKey: string;
  depth: number;
  /**
   * Connector guides for ancestor levels (index 0 = outermost): `true` means
   * that ancestor has more siblings below, so its vertical guide line passes
   * through this row.
   */
  guides: boolean[];
  /** Last child among its siblings — the connector closes with an L shape. */
  isLastChild: boolean;
}

export type WorkflowTreeRow =
  | (TreeRowBase & {
      kind: 'workflow';
      workflow: WorkflowListEntry;
      /** Direct nested workflow step ids (registered or inline), for the badge and expansion. */
      nestedIds: string[];
    })
  | (TreeRowBase & {
      kind: 'inline';
      /** Nested workflow that is not registered standalone — rendered as a non-link leaf row. */
      stepId: string;
      description?: string;
    });

/**
 * Ids of workflows composed directly as steps of this workflow. A directly
 * nested workflow appears in the top-level `steps` record and carries the
 * `isWorkflow` flag in `allSteps` (which also holds deeper `a.b` descendants).
 */
export function getDirectNestedWorkflowIds(workflow: GetWorkflowResponse): string[] {
  return Object.keys(workflow.steps ?? {}).filter(stepId => workflow.allSteps?.[stepId]?.isWorkflow);
}

/**
 * Nested step ids reference the child workflow's own id (its `name`), while
 * the registry record may be keyed differently (e.g. camelCase config keys).
 * This index resolves a step id to the registry key by either route.
 */
export function buildRegistryIndex(workflowsById: Record<string, GetWorkflowResponse>): Map<string, string> {
  const index = new Map<string, string>();
  for (const [registryKey, workflow] of Object.entries(workflowsById)) {
    index.set(registryKey, registryKey);
    if (workflow.name) index.set(workflow.name, registryKey);
  }
  return index;
}

/**
 * Flattens the visible rows of the workflows tree: every root, plus the
 * children of each expanded row, depth-first. Registered children recurse as
 * full workflow rows; inline-only nested workflows render as leaf rows. An
 * ancestor guard drops a child already on its own ancestry path, so mutually
 * nested workflows cannot expand forever.
 */
export function flattenWorkflowTree(
  roots: WorkflowListEntry[],
  workflowsById: Record<string, GetWorkflowResponse>,
  expandedPaths: ReadonlySet<string>,
): WorkflowTreeRow[] {
  const registryIndex = buildRegistryIndex(workflowsById);
  const rows: WorkflowTreeRow[] = [];

  const visit = (
    entry: WorkflowListEntry,
    pathKey: string,
    depth: number,
    ancestors: ReadonlySet<string>,
    guides: boolean[],
    isLastChild: boolean,
  ) => {
    const nestedIds = getDirectNestedWorkflowIds(entry).filter(stepId => {
      const registryKey = registryIndex.get(stepId);
      return registryKey === undefined || !ancestors.has(registryKey);
    });
    rows.push({ kind: 'workflow', workflow: entry, pathKey, depth, nestedIds, guides, isLastChild });

    if (!expandedPaths.has(pathKey) || nestedIds.length === 0) return;

    const nextAncestors = new Set(ancestors).add(entry.id);
    const childGuides = depth === 0 ? [] : [...guides, !isLastChild];
    for (const [index, stepId] of nestedIds.entries()) {
      const childIsLast = index === nestedIds.length - 1;
      const registryKey = registryIndex.get(stepId);
      if (registryKey === undefined) {
        rows.push({
          kind: 'inline',
          stepId,
          description: entry.allSteps?.[stepId]?.description,
          pathKey: `${pathKey}/${stepId}`,
          depth: depth + 1,
          guides: childGuides,
          isLastChild: childIsLast,
        });
        continue;
      }
      visit(
        { ...workflowsById[registryKey], id: registryKey },
        `${pathKey}/${registryKey}`,
        depth + 1,
        nextAncestors,
        childGuides,
        childIsLast,
      );
    }
  };

  for (const root of roots) {
    visit(root, root.id, 0, new Set([root.id]), [], false);
  }

  return rows;
}
