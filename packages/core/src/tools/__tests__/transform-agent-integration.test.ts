import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { RequestContext } from '../../request-context';
import { createTool } from '../tool';
import { CoreToolBuilder } from '../tool-builder/builder';

describe('Tool validation with transforms through Agent pipeline', () => {
  it('should handle outputSchema with transform when tool is built for agent use', async () => {
    // Test that Zod transforms work correctly through the Agent pipeline
    const rawDataSchema = z.object({
      firstName: z.string(),
      lastName: z.string(),
      heightInches: z.number(),
    });

    const formatHeight = (inches: number) => {
      const feet = Math.floor(inches / 12);
      const remainingInches = inches % 12;
      return `${feet}'${remainingInches}"`;
    };

    const transformedSchema = rawDataSchema
      .pick({
        firstName: true,
        lastName: true,
        heightInches: true,
      })
      .transform(v => ({
        fullName: `${v.firstName} ${v.lastName}`,
        height: formatHeight(v.heightInches),
      }));

    // Create tool that returns raw API data
    const tool = createTool({
      id: 'get-data',
      description: 'Get data from API',
      outputSchema: transformedSchema.array(),
      execute: async () => {
        // Returns raw API response (pre-transform shape)
        return [
          {
            firstName: 'John',
            lastName: 'Doe',
            heightInches: 74,
          },
          {
            firstName: 'Jane',
            lastName: 'Smith',
            heightInches: 65,
          },
        ];
      },
    });

    // Test 1: Direct execution
    const directResult = await tool.execute!({});

    expect(directResult).toEqual([
      {
        fullName: 'John Doe',
        height: '6\'2"',
      },
      {
        fullName: 'Jane Smith',
        height: '5\'5"',
      },
    ]);

    // Test 2: Through CoreToolBuilder (simulates Agent pipeline)
    const mockModel = {
      modelId: 'test-model',
      provider: 'test',
      specificationVersion: 'v2',
      supportsStructuredOutputs: false,
    } as any;

    const builder = new CoreToolBuilder({
      originalTool: tool,
      options: {
        name: 'get-data',
        logger: console as any,
        description: 'Get data from API',
        requestContext: new RequestContext(),
        tracingContext: {},
        model: mockModel,
      },
    });

    const builtTool = builder.build();

    // Execute through the built tool (this is what happens in Agent)
    const agentResult = await builtTool.execute!({}, {} as any);

    // Should work through Agent pipeline too
    expect(agentResult).toEqual([
      {
        fullName: 'John Doe',
        height: '6\'2"',
      },
      {
        fullName: 'Jane Smith',
        height: '5\'5"',
      },
    ]);
  });

  it('should handle inputSchema with transform for lenient enum handling', async () => {
    // Test that input transforms normalize various formats to canonical values
    const STATUS_NAME_BY_UPPER: Record<string, string> = {
      ENABLED: 'Enabled',
      DISABLED: 'Disabled',
    };

    const StatusEnum = z.enum(['Enabled', 'Disabled']);

    const LenientStatusInput = z
      .string()
      .trim()
      .transform(s => s.replace(/\s+/g, ' '))
      .transform(s => {
        const upper = s.toUpperCase();
        return STATUS_NAME_BY_UPPER[upper] ?? s;
      })
      .pipe(StatusEnum);

    const tool = createTool({
      id: 'update-status',
      description: 'Update status',
      inputSchema: z.object({
        itemId: z.string(),
        status: LenientStatusInput,
      }),
      execute: async inputData => {
        // inputData.status should be normalized to canonical form
        return {
          itemId: inputData.itemId,
          status: inputData.status,
          success: true,
        };
      },
    });

    // Test various input formats
    const testInputs = [
      { itemId: '1', status: 'enabled' },
      { itemId: '2', status: 'Enabled' },
      { itemId: '3', status: 'ENABLED' },
      { itemId: '4', status: '  enabled  ' },
      { itemId: '5', status: 'disabled' },
    ];

    for (const input of testInputs) {
      // Type assertion needed here because we're intentionally testing lenient input handling
      // The transform will normalize these various formats to the canonical enum values
      const result = await tool.execute!(input as any, {});
      expect(['Enabled', 'Disabled']).toContain(result.status);
    }
  });
});
