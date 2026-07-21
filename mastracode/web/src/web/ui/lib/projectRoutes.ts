import type { Factory } from '../domains/workspaces';
import { isGithubFactory } from '../domains/workspaces';

export type ProjectNamespace = 'local' | 'dashboard';

export function factoryNamespace(factory: Factory): ProjectNamespace {
  return isGithubFactory(factory) ? 'dashboard' : 'local';
}

export function projectRoot(factory: Factory): string {
  return `/${factoryNamespace(factory)}/${encodeURIComponent(factory.id)}`;
}

export function projectEntry(factory: Factory): string {
  return `${projectRoot(factory)}/${isGithubFactory(factory) ? 'factory/board' : 'new'}`;
}

export function projectPath(factory: Factory, path: string): string {
  return `${projectRoot(factory)}/${path.replace(/^\//, '')}`;
}
