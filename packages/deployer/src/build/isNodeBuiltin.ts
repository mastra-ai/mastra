import { builtinModules } from 'node:module';

export function isNodeBuiltin(dep: string): boolean {
  const [pkg] = dep.split('/');

  return dep.startsWith('node:') || builtinModules.includes(dep) || builtinModules.includes(pkg!);
}
