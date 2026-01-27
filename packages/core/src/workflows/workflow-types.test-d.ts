/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, expectTypeOf, it } from 'vitest';
import { z } from 'zod';
import { RequestContext } from '../request-context';
import { createWorkflow } from './workflow';

/**
 * Type tests for Workflow RequestContext variance
 *
 * Tests that workflow methods accept both typed RequestContext<T>
 * and untyped RequestContext for backward compatibility.
 */
describe('Workflow Type Tests', () => {
  describe('RequestContext type variance', () => {
    interface CustomContext {
      tenantId: string;
      orgId: string;
    }

    const workflow = createWorkflow({
      name: 'test-workflow',
      triggerSchema: z.object({
        input: z.string().optional(),
      }),
    })
      .step({
        id: 'step1',
        execute: async () => {
          return { result: 'success' };
        },
      })
      .commit();

    it('should accept typed RequestContext<T> in workflow.start()', async () => {
      const typedContext = new RequestContext<CustomContext>();
      typedContext.set({ tenantId: 'tenant-123', orgId: 'org-456' });

      const run = await workflow.createRun();

      // This should compile without errors
      expectTypeOf(run.start({ requestContext: typedContext })).toEqualTypeOf<Promise<any>>();
    });

    it('should accept untyped RequestContext in workflow.start() for backward compatibility', async () => {
      const untypedContext = new RequestContext();

      const run = await workflow.createRun();

      // This should compile without errors (backward compatibility)
      expectTypeOf(run.start({ requestContext: untypedContext })).toEqualTypeOf<Promise<any>>();
    });

    it('should accept typed RequestContext<T> in workflow.stream()', async () => {
      const typedContext = new RequestContext<CustomContext>();
      typedContext.set({ tenantId: 'tenant-123', orgId: 'org-456' });

      const run = await workflow.createRun();

      // This should compile without errors
      expectTypeOf(run.stream({ requestContext: typedContext })).toEqualTypeOf<any>();
    });

    it('should accept untyped RequestContext in workflow.stream() for backward compatibility', async () => {
      const untypedContext = new RequestContext();

      const run = await workflow.createRun();

      // This should compile without errors (backward compatibility)
      expectTypeOf(run.stream({ requestContext: untypedContext })).toEqualTypeOf<any>();
    });

    it('should accept typed RequestContext<T> in workflow.streamLegacy()', async () => {
      const typedContext = new RequestContext<CustomContext>();
      typedContext.set({ tenantId: 'tenant-123', orgId: 'org-456' });

      const run = await workflow.createRun();

      // This should compile without errors
      expectTypeOf(run.streamLegacy({ requestContext: typedContext })).toEqualTypeOf<any>();
    });

    it('should accept untyped RequestContext in workflow.streamLegacy() for backward compatibility', async () => {
      const untypedContext = new RequestContext();

      const run = await workflow.createRun();

      // This should compile without errors (backward compatibility)
      expectTypeOf(run.streamLegacy({ requestContext: untypedContext })).toEqualTypeOf<any>();
    });
  });
});
