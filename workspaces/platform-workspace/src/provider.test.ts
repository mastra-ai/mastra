import { describe, expect, it } from 'vitest';
import { platformSandboxProvider } from './provider.js';

type OperationSchema = {
  properties: {
    method: { const: string };
    args: Record<string, unknown>;
  };
};

describe('platformSandboxProvider', () => {
  it('requires template handles and definitions together', () => {
    const schema = platformSandboxProvider.configSchema!;

    expect(schema.dependentRequired).toEqual({
      templateId: ['templateDefinition'],
      templateDefinition: ['templateId'],
    });
  });

  it('describes each protocol-v1 operation with method-specific arguments', () => {
    const schema = platformSandboxProvider.configSchema!;
    const properties = schema.properties as Record<string, Record<string, unknown>>;
    const templateDefinition = properties.templateDefinition;
    const templateProperties = templateDefinition.properties as Record<string, Record<string, unknown>>;
    const operations = templateProperties.operations;
    const operationSchemas = (operations.items as { oneOf: OperationSchema[] }).oneOf;

    expect(properties.sandboxProvider).toMatchObject({ enum: ['railway', 'e2b'] });
    expect(templateDefinition).toMatchObject({
      type: 'object',
      required: ['schemaVersion', 'operations'],
      additionalProperties: false,
    });
    expect(templateProperties.schemaVersion).toEqual({ const: 1 });
    expect(operations.maxItems).toBe(256);
    expect(operationSchemas.map(operation => operation.properties.method.const)).toEqual([
      'runCmd',
      'setWorkdir',
      'setEnvs',
      'aptInstall',
      'pipInstall',
      'npmInstall',
    ]);

    const runCmd = operationSchemas[0]!;
    const setEnvs = operationSchemas[2]!;
    const aptInstall = operationSchemas[3]!;
    expect(runCmd.properties.args).toMatchObject({ minItems: 1, maxItems: 1 });
    expect(setEnvs.properties.args).toMatchObject({ minItems: 1, maxItems: 1 });
    expect(aptInstall.properties.args).toMatchObject({ minItems: 1, maxItems: 2 });
  });
});
