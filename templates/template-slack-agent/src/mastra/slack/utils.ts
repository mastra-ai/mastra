/** Async delay */
export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Convert kebab-case/snake_case/camelCase to Title Case */
export const formatName = (id: string) =>
  id
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/[-_]/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
