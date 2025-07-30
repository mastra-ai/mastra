import * as p from '@clack/prompts';

export interface Template {
  githubUrl: string;
  title: string;
  slug: string;
  agents: string[];
  mcp: string[];
  tools: string[];
  networks: string[];
  workflows: string[];
}

const TEMPLATES_API_URL = process.env.MASTRA_TEMPLATES_API_URL || 'https://mastra.ai/api/templates.json';

export async function loadTemplates(): Promise<Template[]> {
  try {
    const response = await fetch(TEMPLATES_API_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch templates: ${response.statusText}`);
    }
    const templates = (await response.json()) as Template[];
    return templates;
  } catch (error) {
    console.error('Error loading templates:', error);
    throw new Error('Failed to load templates. Please check your internet connection and try again.');
  }
}

function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : plural || `${singular}s`;
}

export async function selectTemplate(templates: Template[]): Promise<Template | null> {
  const choices = templates.map(template => {
    const parts = [];
    if (template.agents?.length) {
      parts.push(`${template.agents.length} ${pluralize(template.agents.length, 'agent')}`);
    }
    if (template.tools?.length) {
      parts.push(`${template.tools.length} ${pluralize(template.tools.length, 'tool')}`);
    }
    if (template.workflows?.length) {
      parts.push(`${template.workflows.length} ${pluralize(template.workflows.length, 'workflow')}`);
    }
    if (template.mcp?.length) {
      parts.push(`${template.mcp.length} ${pluralize(template.mcp.length, 'MCP server')}`);
    }
    if (template.networks?.length) {
      parts.push(`${template.networks.length} ${pluralize(template.networks.length, 'agent network')}`);
    }

    return {
      value: template,
      label: template.title,
      hint: parts.join(', ') || 'Template components',
    };
  });

  const selected = await p.select({
    message: 'Select a template:',
    options: choices,
  });

  if (p.isCancel(selected)) {
    return null;
  }

  return selected as Template;
}

export function findTemplateByName(templates: Template[], templateName: string): Template | null {
  // First try to find by exact slug match
  let template = templates.find(t => t.slug === templateName);
  if (template) return template;

  // Then try to find by slug without "template-" prefix
  const slugWithPrefix = `template-${templateName}`;
  template = templates.find(t => t.slug === slugWithPrefix);
  if (template) return template;

  // Finally try case-insensitive name match
  template = templates.find(t => t.title.toLowerCase() === templateName.toLowerCase());
  if (template) return template;

  return null;
}

export function getDefaultProjectName(template: Template): string {
  // Remove "template-" prefix from slug if it exists
  return template.slug.replace(/^template-/, '');
}
