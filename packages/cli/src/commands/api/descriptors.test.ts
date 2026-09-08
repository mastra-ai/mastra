import { Command } from 'commander';
import { beforeEach, describe, expect, it } from 'vitest';
import { FACTORY_API_ROUTE_CATALOG, FACTORY_API_ROUTE_METADATA } from './factory-route-metadata.generated';
import { BUNDLED_ROUTE_SCHEMAS } from './schema';
import type { ApiCommandDescriptor } from './types';
import { API_COMMANDS, CLI_ROUTE_METADATA, registerApiCommand } from './index';

interface CommandLeaf {
  path: string;
  command: Command;
  arguments: string[];
}

beforeEach(() => {
  registerApiCommand(new Command());
});

function findCommand(parent: Command | undefined, name: string) {
  return parent?.commands.find(command => command.name() === name);
}

function collectLeaves(command: Command, path: string[] = []): CommandLeaf[] {
  if (command.commands.length === 0) {
    const registeredArguments = (command as unknown as { registeredArguments?: Array<{ name(): string }> })
      .registeredArguments;

    return [
      {
        path: path.join(' '),
        command,
        arguments: registeredArguments?.map(argument => argument.name()) ?? [],
      },
    ];
  }

  return command.commands.flatMap(child => collectLeaves(child, [...path, child.name()]));
}

function commandKey(name: string): string {
  return name.replace(/ ([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function routeKey(descriptor: ApiCommandDescriptor): keyof typeof CLI_ROUTE_METADATA {
  return `${descriptor.method} ${descriptor.path}` as keyof typeof CLI_ROUTE_METADATA;
}

function pathParams(path: string): string[] {
  return [...path.matchAll(/:([A-Za-z0-9_]+)/g)].map(match => match[1]);
}

describe('api command descriptors', () => {
  it('keeps exported descriptors aligned with the Commander leaf commands', () => {
    const program = new Command();
    registerApiCommand(program);

    const api = findCommand(program, 'api');
    expect(api).toBeDefined();

    const leaves = collectLeaves(api!);
    const descriptorsByName = new Map(Object.values(API_COMMANDS).map(descriptor => [descriptor.name, descriptor]));

    expect(leaves.map(leaf => leaf.path).sort()).toEqual([...descriptorsByName.keys()].sort());

    for (const leaf of leaves) {
      const descriptor = descriptorsByName.get(leaf.path);
      expect(descriptor, leaf.path).toBeDefined();
      expect(descriptor?.key, leaf.path).toBe(commandKey(leaf.path));
      expect(leaf.arguments, leaf.path).toEqual([
        ...(descriptor?.positionals ?? []),
        ...((descriptor?.acceptsInput ?? false) ? ['input'] : []),
      ]);
      expect(leaf.command.helpInformation().includes('--schema'), leaf.path).toBe(descriptor?.acceptsInput);
    }
  });

  it('keeps every descriptor internally consistent with generated route metadata', () => {
    const keys = Object.keys(API_COMMANDS);
    const names = Object.values(API_COMMANDS).map(descriptor => descriptor.name);

    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(names).size).toBe(names.length);

    for (const descriptor of Object.values(API_COMMANDS)) {
      const metadata = CLI_ROUTE_METADATA[routeKey(descriptor)];
      expect(metadata, descriptor.key).toBeDefined();
      expect(descriptor.method, descriptor.key).toBe(metadata.method);
      expect(descriptor.path, descriptor.key).toBe(metadata.path);
      expect(descriptor.queryParams, descriptor.key).toEqual(metadata.queryParams);
      expect(descriptor.bodyParams, descriptor.key).toEqual(metadata.bodyParams);
      expect(descriptor.responseShape, descriptor.key).toEqual(metadata.responseShape);
      expect(descriptor.inputRequired, descriptor.key).toBe(descriptor.inputRequired && descriptor.acceptsInput);

      const routePathParams = pathParams(descriptor.path);
      const requestParams = [...routePathParams, ...descriptor.queryParams, ...descriptor.bodyParams];
      expect(
        descriptor.positionals.every(positional => requestParams.includes(positional)),
        descriptor.key,
      ).toBe(true);

      for (const param of routePathParams) {
        expect(
          descriptor.positionals.includes(param) || descriptor.acceptsInput,
          `${descriptor.key} must expose ${param} as a positional or accept JSON input`,
        ).toBe(true);
      }

      if (descriptor.list) {
        expect(['array', 'record', 'object-property', 'single', 'unknown'], descriptor.key).toContain(
          descriptor.responseShape.kind,
        );
      }
    }
  });

  it('exposes every generated Factory contract through root-level descriptors and bundled schemas', () => {
    const expected = {
      factoryProjectList: ['projectList', [], true, false, true],
      factoryProjectGet: ['projectGet', ['id'], false, false, false],
      factoryProjectCreate: ['projectCreate', [], true, true, false],
      factoryProjectUpdate: ['projectUpdate', ['id'], true, true, false],
      factoryProjectDelete: ['projectDelete', ['id'], false, false, false],
      'factoryWork-itemList': ['workItemList', ['id'], false, false, false],
      'factoryWork-itemCreate': ['workItemCreate', ['id'], true, true, false],
      'factoryWork-itemUpdate': ['workItemUpdate', ['id'], true, true, false],
      'factoryWork-itemDelete': ['workItemDelete', ['id'], false, false, false],
      'factoryWork-itemTransition': ['workItemTransition', ['id', 'workItemId'], true, true, false],
      'factoryWork-itemStart': ['workItemStart', ['id'], true, true, false],
      factoryMetrics: ['metricsGet', ['id'], true, false, false],
      factoryHealthThresholds: ['healthThresholdsGet', ['id'], false, false, false],
      factoryDecisionList: ['decisionList', ['id'], true, false, false],
      factoryDecisionApprove: ['decisionApprove', ['id', 'decisionId'], false, false, false],
      factoryDecisionDismiss: ['decisionDismiss', ['id', 'decisionId'], false, false, false],
      factoryDecisionRetry: ['decisionRetry', ['id', 'decisionId'], false, false, false],
      factoryAttentionList: ['attentionList', ['id'], true, false, false],
      'factoryAttentionRead-all': ['attentionReadAll', ['id'], true, false, false],
      factoryAttentionRead: ['attentionRead', ['id', 'kind', 'sourceId', 'occurrence'], false, false, false],
      factoryAttentionArchive: ['attentionArchive', ['id', 'kind', 'sourceId', 'occurrence'], false, false, false],
      factoryAttentionRestore: ['attentionRestore', ['id', 'kind', 'sourceId', 'occurrence'], false, false, false],
      factorySupervisorSession: ['supervisorSession', ['id'], false, false, false],
      factorySupervisorHealth: ['supervisorHealth', ['id'], false, false, false],
    } as const;

    const exposedRouteKeys = new Set<string>();
    for (const [descriptorKey, [contractKey, positionals, acceptsInput, inputRequired, list]] of Object.entries(
      expected,
    )) {
      const descriptor = API_COMMANDS[descriptorKey];
      const generatedRouteKey = FACTORY_API_ROUTE_CATALOG[contractKey];

      expect(descriptor, descriptorKey).toBeDefined();
      expect(descriptor, descriptorKey).toMatchObject({
        positionals,
        acceptsInput,
        inputRequired,
        list,
        routePlacement: 'origin',
      });
      expect(`${descriptor.method} ${descriptor.path}`, descriptorKey).toBe(generatedRouteKey);
      expect(CLI_ROUTE_METADATA[generatedRouteKey], descriptorKey).toBe(FACTORY_API_ROUTE_METADATA[generatedRouteKey]);
      expect(BUNDLED_ROUTE_SCHEMAS[generatedRouteKey], descriptorKey).toBeDefined();
      exposedRouteKeys.add(generatedRouteKey);
    }

    expect(exposedRouteKeys).toEqual(new Set(Object.values(FACTORY_API_ROUTE_CATALOG)));
  });

  it('keeps targeted regressions for commands with non-obvious input behavior', () => {
    for (const key of ['threadCreate', 'threadUpdate', 'threadDelete'] as const) {
      expect(API_COMMANDS[key]).toMatchObject({ acceptsInput: true, inputRequired: true });
      expect(API_COMMANDS[key].queryParams.length).toBeGreaterThan(0);
    }

    for (const key of ['memoryStatus', 'memoryCurrentGet', 'memoryCurrentUpdate'] as const) {
      expect(API_COMMANDS[key]).toMatchObject({ acceptsInput: true });
      expect(API_COMMANDS[key].queryParams.length).toBeGreaterThan(0);
    }

    expect(API_COMMANDS.toolExecute.inputRequired).toBe(true);
    expect(API_COMMANDS.mcpToolExecute.inputRequired).toBe(true);
    expect(API_COMMANDS.workflowRunResume.positionals).toEqual(['workflowId', 'runId']);
    expect(API_COMMANDS.workflowRunStart.defaultTimeoutMs).toBe(120_000);
    expect(API_COMMANDS.workflowRunResume.defaultTimeoutMs).toBe(120_000);
  });
});
