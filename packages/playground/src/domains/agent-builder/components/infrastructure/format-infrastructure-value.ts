export const titleCase = (value: string) =>
  value
    .split(/([\s-]+)/)
    .map(part => (/^[\s-]+$/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join('');

export const titleCaseOrNotSet = (value: string | null | undefined) => (value ? titleCase(value) : 'Not set');
