import { describe, expect, it } from 'vitest';

import { workflowsFixture } from '../../components/workflows-list/__tests__/fixtures/workflows';
import { buildRegistryIndex, flattenWorkflowTree, getDirectNestedWorkflowIds } from '../nested-workflows';
import type { WorkflowListEntry } from '../nested-workflows';

const entry = (registryKey: string): WorkflowListEntry => ({ ...workflowsFixture[registryKey], id: registryKey });

describe('getDirectNestedWorkflowIds', () => {
  it('returns only top-level steps flagged as workflows', () => {
    expect(getDirectNestedWorkflowIds(workflowsFixture.prdShipProduct)).toEqual([
      'prd-groom-product',
      'prd-fix-product',
    ]);
  });

  it('ignores dot-path descendants that are not top-level steps', () => {
    expect(getDirectNestedWorkflowIds(workflowsFixture.prdShipProduct)).not.toContain(
      'prd-groom-product.use-case-arch',
    );
  });

  it('returns empty for leaf workflows', () => {
    expect(getDirectNestedWorkflowIds(workflowsFixture.prdFixProduct)).toEqual([]);
  });
});

describe('buildRegistryIndex', () => {
  it('resolves both registry keys and workflow ids to the registry key', () => {
    const index = buildRegistryIndex(workflowsFixture);
    expect(index.get('prdGroomProduct')).toBe('prdGroomProduct');
    expect(index.get('prd-groom-product')).toBe('prdGroomProduct');
    expect(index.get('use-case-arch')).toBeUndefined();
  });
});

describe('flattenWorkflowTree', () => {
  it('renders only roots when nothing is expanded', () => {
    const rows = flattenWorkflowTree([entry('prdShipProduct')], workflowsFixture, new Set());

    expect(rows.map(row => row.pathKey)).toEqual(['prdShipProduct']);
    expect(rows[0].depth).toBe(0);
  });

  it('appends registered children of an expanded row as workflow rows keyed by registry key', () => {
    const rows = flattenWorkflowTree([entry('prdShipProduct')], workflowsFixture, new Set(['prdShipProduct']));

    expect(rows.map(row => row.pathKey)).toEqual([
      'prdShipProduct',
      'prdShipProduct/prdGroomProduct',
      'prdShipProduct/prdFixProduct',
    ]);
    expect(rows[1]).toMatchObject({ kind: 'workflow', depth: 1 });
    expect(rows[1].kind === 'workflow' && rows[1].workflow.id).toBe('prdGroomProduct');
  });

  it('renders unregistered nested workflows as inline leaf rows', () => {
    const rows = flattenWorkflowTree([entry('prdGroomProduct')], workflowsFixture, new Set(['prdGroomProduct']));

    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({
      kind: 'inline',
      stepId: 'use-case-arch',
      pathKey: 'prdGroomProduct/use-case-arch',
      depth: 1,
      description: 'use-case-arch step',
    });
  });

  it('keeps expansion independent for the same child under different parents', () => {
    const rows = flattenWorkflowTree(
      [entry('prdShipProduct'), entry('prdGroomProduct')],
      workflowsFixture,
      new Set(['prdGroomProduct']),
    );

    expect(rows.map(row => row.pathKey)).toEqual([
      'prdShipProduct',
      'prdGroomProduct',
      'prdGroomProduct/use-case-arch',
    ]);
  });

  it('computes connector guides and last-child flags for the tree lines', () => {
    const rows = flattenWorkflowTree(
      [entry('prdShipProduct')],
      workflowsFixture,
      new Set(['prdShipProduct', 'prdShipProduct/prdGroomProduct']),
    );

    expect(rows.map(row => [row.pathKey, row.depth, row.guides, row.isLastChild])).toEqual([
      ['prdShipProduct', 0, [], false],
      ['prdShipProduct/prdGroomProduct', 1, [], false],
      // prd-groom-product is not the last child, so its guide continues past
      // the inline grandchild; the grandchild itself closes its branch.
      ['prdShipProduct/prdGroomProduct/use-case-arch', 2, [true], true],
      ['prdShipProduct/prdFixProduct', 1, [], true],
    ]);
  });

  it('guards against cycles by dropping ancestors from a row nested ids', () => {
    const rows = flattenWorkflowTree([entry('loopA')], workflowsFixture, new Set(['loopA', 'loopA/loopB']));

    expect(rows.map(row => row.pathKey)).toEqual(['loopA', 'loopA/loopB']);
    const childRow = rows[1];
    expect(childRow.kind === 'workflow' && childRow.nestedIds).toEqual([]);
  });
});
