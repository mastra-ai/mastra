export function toWorkflowType(id: string) {
  const camelCased = id.replace(/[-_]+([a-zA-Z0-9])/g, (_, char: string) => char.toUpperCase());
  return camelCased.endsWith('Workflow') ? camelCased : `${camelCased}Workflow`;
}
