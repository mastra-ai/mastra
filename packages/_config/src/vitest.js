import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { defineConfig as vitestDefineConfig } from 'vitest/config';
export * from 'vitest/config';

import {
  createWorkspacePackageIndex,
  resolveWorkspaceSource,
  workspaceSourceResolver,
} from './vitest-source-resolver.js';

let workspacePackageIndex;

export function defineConfig(config) {
  if (process.env.CI) return vitestDefineConfig(config);

  return vitestDefineConfig(wrapConfig(config));
}

function wrapConfig(config) {
  if (typeof config === 'function') {
    return async env => injectWorkspaceSourceResolver(await config(env));
  }

  if (config && typeof config.then === 'function') {
    return config.then(resolvedConfig => injectWorkspaceSourceResolver(resolvedConfig));
  }

  return injectWorkspaceSourceResolver(config);
}

function injectWorkspaceSourceResolver(config) {
  if (Array.isArray(config)) return config.map(projectConfig => injectWorkspaceSourceResolver(projectConfig));
  if (!config || typeof config !== 'object') return config;

  return injectIntoConfig(config);
}

function injectIntoConfig(config) {
  const plugin = workspaceSourceResolver();
  const test = config.test ? rewriteTestOptions(config.test) : config.test;
  const nextConfig = {
    ...config,
    plugins: [plugin, ...toArray(config.plugins)],
    ...(test ? { test } : {}),
  };

  if (Array.isArray(config.test?.projects)) {
    nextConfig.test = {
      ...test,
      projects: config.test.projects.map(project => {
        if (typeof project === 'string') return project;
        return injectIntoConfig(project);
      }),
    };
  }

  return nextConfig;
}

function rewriteTestOptions(test) {
  if (!test.setupFiles) return test;

  return {
    ...test,
    setupFiles: Array.isArray(test.setupFiles)
      ? test.setupFiles.map(rewriteWorkspaceSpecifier)
      : rewriteWorkspaceSpecifier(test.setupFiles),
  };
}

function rewriteWorkspaceSpecifier(value) {
  if (typeof value !== 'string') return value;

  workspacePackageIndex ??= createWorkspacePackageIndex(findWorkspaceRoot(process.cwd()));
  return resolveWorkspaceSource(value, workspacePackageIndex)?.path ?? value;
}

function findWorkspaceRoot(start) {
  let current = start;
  while (current !== dirname(current)) {
    if (existsSync(join(current, 'pnpm-workspace.yaml'))) return current;
    current = dirname(current);
  }
  return start;
}

function toArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}
