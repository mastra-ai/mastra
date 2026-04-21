import type { OperationObject } from '@loopback/rest';

import type { LoopbackApiRouteMethod } from './types.js';

export function extractPathParamNames(path: string): string[] {
  const names = new Set<string>();
  const braceParamRegex = /\{([^}]+)\}/g;
  let match: RegExpExecArray | null = null;

  while ((match = braceParamRegex.exec(path)) !== null) {
    if (match[1]) {
      names.add(match[1]);
    }
  }

  return [...names];
}

export function toLoopbackPath(path: string): string {
  return path.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

export function joinPath(prefix: string | undefined, path: string): string {
  const joined = `${prefix ?? ''}/${path}`.replace(/\/{2,}/g, '/');
  return joined.startsWith('/') ? joined : `/${joined}`;
}

export function toLoopbackMethods(method: LoopbackApiRouteMethod): string[] {
  if (method === 'ALL') {
    return ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
  }
  return [method];
}

export function createOperationSpec(pathParamNames: string[]): OperationObject {
  const spec: OperationObject = {
    responses: {
      '200': {
        description: 'Mastra route response',
      },
    },
  };

  if (pathParamNames.length > 0) {
    spec.parameters = pathParamNames.map(name => ({
      name,
      in: 'path',
      required: true,
      schema: { type: 'string' },
    }));
  }

  spec.requestBody = {
    required: false,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          additionalProperties: true,
        },
      },
    },
  };

  return spec;
}
