import { describe, expectTypeOf, it } from 'vitest';
import type { Workspace } from '../workspace';
import { Mastra } from './index';

describe('Mastra.getWorkspaceById types', () => {
  const mastra = new Mastra({});

  it('returns a workspace unless the lookup may be optional', () => {
    expectTypeOf(mastra.getWorkspaceById('id')).toEqualTypeOf<Workspace>();
    expectTypeOf(mastra.getWorkspaceById('id', {})).toEqualTypeOf<Workspace>();
    expectTypeOf(mastra.getWorkspaceById('id', { optional: false })).toEqualTypeOf<Workspace>();
    expectTypeOf(mastra.getWorkspaceById('id', { optional: true })).toEqualTypeOf<Workspace | undefined>();
  });

  it('accepts boolean options that are only known at runtime', () => {
    const optional = Math.random() > 0.5;
    expectTypeOf(mastra.getWorkspaceById('id', { optional })).toEqualTypeOf<Workspace | undefined>();

    const options: { optional?: boolean } = {};
    expectTypeOf(mastra.getWorkspaceById('id', options)).toEqualTypeOf<Workspace | undefined>();
  });
});
