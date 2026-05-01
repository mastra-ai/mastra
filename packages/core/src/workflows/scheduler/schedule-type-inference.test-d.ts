import { describe, expectTypeOf, it } from 'vitest';
import { z } from 'zod/v4';
import { createWorkflow } from '../workflow';
import type { WorkflowScheduleConfig, WorkflowScheduleInput } from './types';

describe('WorkflowScheduleConfig type inference', () => {
  describe('default type parameters', () => {
    it('falls back to permissive types when no type parameters are supplied', () => {
      const schedule: WorkflowScheduleConfig = {
        cron: '0 9 * * *',
        inputData: { anything: 'goes' },
        initialState: { anything: 'goes' },
        requestContext: { anything: 'goes' },
      };

      expectTypeOf(schedule.inputData).toEqualTypeOf<unknown>();
      expectTypeOf(schedule.initialState).toEqualTypeOf<unknown>();
      expectTypeOf(schedule.requestContext).toEqualTypeOf<Record<string, unknown> | undefined>();
    });
  });

  describe('inputData inference from inputSchema', () => {
    it('accepts a schedule with matching inputData', () => {
      createWorkflow({
        id: 'wf',
        inputSchema: z.object({ tenantId: z.string(), reportType: z.enum(['daily', 'weekly']) }),
        outputSchema: z.object({ ok: z.boolean() }),
        schedule: {
          cron: '0 9 * * *',
          inputData: { tenantId: 'acme', reportType: 'daily' },
        },
      });
    });

    it('rejects a schedule whose inputData has a wrong literal value', () => {
      createWorkflow({
        id: 'wf',
        inputSchema: z.object({ tenantId: z.string(), reportType: z.enum(['daily', 'weekly']) }),
        outputSchema: z.object({ ok: z.boolean() }),
        // @ts-expect-error - 'monthly' is not in the reportType enum
        schedule: {
          cron: '0 9 * * *',
          inputData: { tenantId: 'acme', reportType: 'monthly' },
        },
      });
    });

    it('rejects a schedule whose inputData is missing a required field', () => {
      createWorkflow({
        id: 'wf',
        inputSchema: z.object({ tenantId: z.string(), reportType: z.enum(['daily', 'weekly']) }),
        outputSchema: z.object({ ok: z.boolean() }),
        // @ts-expect-error - missing required reportType
        schedule: {
          cron: '0 9 * * *',
          inputData: { tenantId: 'acme' },
        },
      });
    });

    it('rejects a schedule whose inputData has a wrong field type', () => {
      createWorkflow({
        id: 'wf',
        inputSchema: z.object({ tenantId: z.string() }),
        outputSchema: z.object({ ok: z.boolean() }),
        // @ts-expect-error - tenantId must be a string
        schedule: {
          cron: '0 9 * * *',
          inputData: { tenantId: 42 },
        },
      });
    });
  });

  describe('initialState inference from stateSchema', () => {
    it('accepts a schedule with matching initialState', () => {
      createWorkflow({
        id: 'wf',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        stateSchema: z.object({ counter: z.number() }),
        schedule: {
          cron: '0 9 * * *',
          initialState: { counter: 0 },
        },
      });
    });

    it('rejects a schedule whose initialState has a wrong field type', () => {
      createWorkflow({
        id: 'wf',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        stateSchema: z.object({ counter: z.number() }),
        // @ts-expect-error - counter must be a number
        schedule: {
          cron: '0 9 * * *',
          initialState: { counter: 'zero' },
        },
      });
    });
  });

  describe('requestContext inference from requestContextSchema', () => {
    it('accepts a schedule with matching requestContext', () => {
      createWorkflow({
        id: 'wf',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        requestContextSchema: z.object({ tenantId: z.string(), actor: z.literal('system') }),
        schedule: {
          cron: '0 9 * * *',
          requestContext: { tenantId: 'acme', actor: 'system' },
        },
      });
    });

    it('rejects a schedule whose requestContext has a wrong literal value', () => {
      createWorkflow({
        id: 'wf',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        requestContextSchema: z.object({ actor: z.literal('system') }),
        // @ts-expect-error - actor must be the literal 'system'
        schedule: {
          cron: '0 9 * * *',
          requestContext: { actor: 'user' },
        },
      });
    });

    it('falls back to a generic record when no requestContextSchema is declared', () => {
      createWorkflow({
        id: 'wf',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        schedule: {
          cron: '0 9 * * *',
          requestContext: { anything: 'goes', or: 42 },
        },
      });
    });
  });

  describe('array form of schedule', () => {
    it('type-checks each entry against the workflow schemas', () => {
      createWorkflow({
        id: 'wf',
        inputSchema: z.object({ region: z.enum(['us', 'eu']) }),
        outputSchema: z.object({}),
        schedule: [
          { id: 'us', cron: '0 9 * * *', inputData: { region: 'us' } },
          { id: 'eu', cron: '0 9 * * *', inputData: { region: 'eu' } },
        ],
      });
    });

    it('rejects an entry whose inputData has a wrong literal value', () => {
      createWorkflow({
        id: 'wf',
        inputSchema: z.object({ region: z.enum(['us', 'eu']) }),
        outputSchema: z.object({}),
        schedule: [
          { id: 'us', cron: '0 9 * * *', inputData: { region: 'us' } },
          // @ts-expect-error - 'apac' is not in the region enum
          { id: 'apac', cron: '0 9 * * *', inputData: { region: 'apac' } },
        ],
      });
    });
  });

  describe('WorkflowScheduleInput', () => {
    it('accepts both single and array forms with the same type parameters', () => {
      type Input = { region: 'us' | 'eu' };
      const single: WorkflowScheduleInput<Input> = {
        cron: '0 9 * * *',
        inputData: { region: 'us' },
      };
      const many: WorkflowScheduleInput<Input> = [
        { id: 'us', cron: '0 9 * * *', inputData: { region: 'us' } },
        { id: 'eu', cron: '0 9 * * *', inputData: { region: 'eu' } },
      ];

      expectTypeOf(single).not.toBeNever();
      expectTypeOf(many).not.toBeNever();
    });
  });
});
