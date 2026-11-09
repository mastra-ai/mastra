const resolverComputerToolsWorkspaces = new WeakSet<object>();

export function enableResolverComputerTools(workspace: object): void {
  resolverComputerToolsWorkspaces.add(workspace);
}

export function resolvesComputerTools(workspace: object): boolean {
  return resolverComputerToolsWorkspaces.has(workspace);
}
