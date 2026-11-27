import { defineConfig as vitestDefineConfig } from 'vitest/config';
export * from 'vitest/config';

import {
  RESOLVER_PLUGIN_NAME,
  createWorkspacePackageIndex,
  findWorkspaceRoot,
  resolveWorkspaceSource,
  workspaceSourceResolver,
} from './vitest-source-resolver.js';

let workspacePackageIndex;

// Node processes a test spawns (fork, spawn, worker threads) inherit this through the worker's env,
// so they resolve workspace packages from source too. Tests still opt into TypeScript with tsx.
const NODE_SOURCE_HOOKS = `--import=${new URL('./node-source-hooks.js', import.meta.url).href}`;

export function defineConfig(config) {
  if (process.env.MASTRA_TEST_DIST) return vitestDefineConfig(config);

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

function injectIntoConfig(config, { inheritsResolver = false } = {}) {
  const test = rewriteTestOptions(config.test ?? {});
  const plugins = toArray(config.plugins).filter(plugin => !isResolverPlugin(plugin));
  const nextConfig = {
    ...config,
    // Since Vitest 5, inline projects inherit the declaring config's plugins unless `extends: false`.
    plugins: inheritsResolver ? plugins : [workspaceSourceResolver(), ...plugins],
    test,
  };

  if (Array.isArray(config.test?.projects)) {
    nextConfig.test = {
      ...test,
      projects: config.test.projects.map(project => {
        if (typeof project === 'string') return project;
        return injectIntoConfig(project, { inheritsResolver: project.extends !== false });
      }),
    };
  }

  return nextConfig;
}

function isResolverPlugin(plugin) {
  return plugin?.name === RESOLVER_PLUGIN_NAME;
}

function rewriteTestOptions(test) {
  const nodeOptions = test.env?.NODE_OPTIONS ?? process.env.NODE_OPTIONS ?? '';
  const nextTest = {
    ...test,
    env: {
      ...test.env,
      NODE_OPTIONS: nodeOptions.includes(NODE_SOURCE_HOOKS)
        ? nodeOptions
        : `${nodeOptions} ${NODE_SOURCE_HOOKS}`.trim(),
    },
  };
  if (!test.setupFiles) return nextTest;

  return {
    ...nextTest,
    setupFiles: Array.isArray(test.setupFiles)
      ? test.setupFiles.map(rewriteWorkspaceSpecifier)
      : rewriteWorkspaceSpecifier(test.setupFiles),
  };
}

function rewriteWorkspaceSpecifier(value) {
  if (typeof value !== 'string') return value;

  workspacePackageIndex ??= createWorkspacePackageIndex(findWorkspaceRoot());
  return resolveWorkspaceSource(value, workspacePackageIndex)?.path ?? value;
}

function toArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}
