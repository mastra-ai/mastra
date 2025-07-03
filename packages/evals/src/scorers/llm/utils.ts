export function renderTemplate(template: string, params: Record<string, any> = {}) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return params[key] !== undefined ? String(params[key]) : match;
  });
}
