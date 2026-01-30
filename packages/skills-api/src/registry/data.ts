/**
 * Sample registry data for skills.sh
 * This would typically be stored in a database
 */

import type { RegistrySkill, Category } from './types.js';

/**
 * Categories for organizing skills
 */
export const categories: Category[] = [
  {
    name: 'development',
    displayName: 'Development',
    description: 'Skills for software development, code review, and debugging',
    skillCount: 0,
  },
  {
    name: 'writing',
    displayName: 'Writing',
    description: 'Skills for content creation, editing, and documentation',
    skillCount: 0,
  },
  {
    name: 'data',
    displayName: 'Data & Analytics',
    description: 'Skills for data analysis, visualization, and reporting',
    skillCount: 0,
  },
  {
    name: 'design',
    displayName: 'Design',
    description: 'Skills for UI/UX design, graphics, and visual content',
    skillCount: 0,
  },
  {
    name: 'productivity',
    displayName: 'Productivity',
    description: 'Skills for task management, planning, and organization',
    skillCount: 0,
  },
  {
    name: 'research',
    displayName: 'Research',
    description: 'Skills for research, analysis, and information gathering',
    skillCount: 0,
  },
  {
    name: 'devops',
    displayName: 'DevOps',
    description: 'Skills for deployment, CI/CD, and infrastructure',
    skillCount: 0,
  },
  {
    name: 'security',
    displayName: 'Security',
    description: 'Skills for security analysis and vulnerability assessment',
    skillCount: 0,
  },
];

/**
 * Sample skills data
 * In production, this would come from a database
 */
export const skills: RegistrySkill[] = [
  {
    name: 'code-review',
    displayName: 'Code Review',
    description:
      'Reviews code for quality, style, and potential issues. Provides detailed feedback on code structure, best practices, and potential bugs.',
    version: '1.2.0',
    author: 'mastra',
    license: 'MIT',
    repository: 'https://github.com/mastra-ai/skills/tree/main/code-review',
    homepage: 'https://skills.sh/skills/code-review',
    tags: ['code', 'review', 'quality', 'best-practices', 'linting'],
    category: 'development',
    downloads: 12500,
    stars: 245,
    createdAt: '2024-06-15T00:00:00Z',
    updatedAt: '2025-01-15T00:00:00Z',
    npmPackage: '@mastra-skills/code-review',
    githubRepo: 'mastra-ai/skills',
    featured: true,
    compatibility: {
      mastraVersion: '>=1.0.0',
      models: ['claude-3', 'gpt-4'],
    },
    preview:
      'You are a code reviewer. When reviewing code:\n\n1. Check for bugs and edge cases\n2. Verify the code follows the style guide\n3. Suggest improvements for readability',
  },
  {
    name: 'technical-writing',
    displayName: 'Technical Writing',
    description:
      'Helps write clear, concise technical documentation. Follows best practices for API docs, READMEs, and developer guides.',
    version: '1.0.0',
    author: 'mastra',
    license: 'MIT',
    repository: 'https://github.com/mastra-ai/skills/tree/main/technical-writing',
    homepage: 'https://skills.sh/skills/technical-writing',
    tags: ['documentation', 'writing', 'api', 'readme', 'guides'],
    category: 'writing',
    downloads: 8200,
    stars: 156,
    createdAt: '2024-08-01T00:00:00Z',
    updatedAt: '2025-01-10T00:00:00Z',
    npmPackage: '@mastra-skills/technical-writing',
    githubRepo: 'mastra-ai/skills',
    featured: true,
    compatibility: {
      mastraVersion: '>=1.0.0',
    },
    preview:
      'You are a technical writer. Write documentation that is:\n\n1. Clear and concise\n2. Well-structured with proper headings\n3. Includes code examples where appropriate',
  },
  {
    name: 'sql-query-builder',
    displayName: 'SQL Query Builder',
    description:
      'Helps construct and optimize SQL queries. Supports PostgreSQL, MySQL, SQLite, and SQL Server with dialect-specific optimizations.',
    version: '2.1.0',
    author: 'mastra',
    license: 'Apache-2.0',
    repository: 'https://github.com/mastra-ai/skills/tree/main/sql-query-builder',
    homepage: 'https://skills.sh/skills/sql-query-builder',
    tags: ['sql', 'database', 'query', 'optimization', 'postgresql', 'mysql'],
    category: 'data',
    downloads: 15600,
    stars: 312,
    createdAt: '2024-05-20T00:00:00Z',
    updatedAt: '2025-01-20T00:00:00Z',
    npmPackage: '@mastra-skills/sql-query-builder',
    githubRepo: 'mastra-ai/skills',
    featured: true,
    compatibility: {
      mastraVersion: '>=1.0.0',
      tools: ['database-query'],
    },
    preview:
      'You are a SQL expert. When building queries:\n\n1. Use proper indexing strategies\n2. Avoid N+1 query problems\n3. Optimize for the specific database dialect',
  },
  {
    name: 'react-component-builder',
    displayName: 'React Component Builder',
    description:
      'Builds React components following best practices. Supports TypeScript, hooks, and modern patterns like Server Components.',
    version: '1.5.0',
    author: 'mastra',
    license: 'MIT',
    repository: 'https://github.com/mastra-ai/skills/tree/main/react-component-builder',
    homepage: 'https://skills.sh/skills/react-component-builder',
    tags: ['react', 'typescript', 'components', 'hooks', 'frontend'],
    category: 'development',
    downloads: 22100,
    stars: 489,
    createdAt: '2024-04-10T00:00:00Z',
    updatedAt: '2025-01-25T00:00:00Z',
    npmPackage: '@mastra-skills/react-component-builder',
    githubRepo: 'mastra-ai/skills',
    featured: true,
    compatibility: {
      mastraVersion: '>=1.0.0',
    },
    preview:
      'You are a React expert. When building components:\n\n1. Use functional components with hooks\n2. Implement proper TypeScript types\n3. Follow accessibility best practices',
  },
  {
    name: 'git-workflow',
    displayName: 'Git Workflow',
    description:
      'Manages Git workflows including branching strategies, commit messages, and pull request reviews. Follows conventional commits.',
    version: '1.1.0',
    author: 'mastra',
    license: 'MIT',
    repository: 'https://github.com/mastra-ai/skills/tree/main/git-workflow',
    homepage: 'https://skills.sh/skills/git-workflow',
    tags: ['git', 'version-control', 'branching', 'commits', 'pull-requests'],
    category: 'devops',
    downloads: 9800,
    stars: 178,
    createdAt: '2024-07-05T00:00:00Z',
    updatedAt: '2025-01-05T00:00:00Z',
    npmPackage: '@mastra-skills/git-workflow',
    githubRepo: 'mastra-ai/skills',
    featured: false,
    compatibility: {
      mastraVersion: '>=1.0.0',
      tools: ['git'],
    },
    preview:
      'You manage Git workflows. For commits:\n\n1. Use conventional commit format\n2. Keep commits atomic and focused\n3. Write clear commit messages',
  },
  {
    name: 'api-design',
    displayName: 'API Design',
    description:
      'Designs RESTful and GraphQL APIs following best practices. Includes OpenAPI specification generation and validation.',
    version: '1.3.0',
    author: 'mastra',
    license: 'MIT',
    repository: 'https://github.com/mastra-ai/skills/tree/main/api-design',
    homepage: 'https://skills.sh/skills/api-design',
    tags: ['api', 'rest', 'graphql', 'openapi', 'design'],
    category: 'development',
    downloads: 11200,
    stars: 234,
    createdAt: '2024-06-01T00:00:00Z',
    updatedAt: '2025-01-18T00:00:00Z',
    npmPackage: '@mastra-skills/api-design',
    githubRepo: 'mastra-ai/skills',
    featured: false,
    compatibility: {
      mastraVersion: '>=1.0.0',
    },
    preview:
      'You are an API designer. When designing APIs:\n\n1. Follow RESTful conventions\n2. Use proper HTTP status codes\n3. Design for backwards compatibility',
  },
  {
    name: 'security-audit',
    displayName: 'Security Audit',
    description:
      'Performs security audits on code and configurations. Identifies vulnerabilities, suggests fixes, and follows OWASP guidelines.',
    version: '1.0.0',
    author: 'mastra',
    license: 'Apache-2.0',
    repository: 'https://github.com/mastra-ai/skills/tree/main/security-audit',
    homepage: 'https://skills.sh/skills/security-audit',
    tags: ['security', 'audit', 'vulnerabilities', 'owasp', 'scanning'],
    category: 'security',
    downloads: 7500,
    stars: 145,
    createdAt: '2024-09-15T00:00:00Z',
    updatedAt: '2025-01-12T00:00:00Z',
    npmPackage: '@mastra-skills/security-audit',
    githubRepo: 'mastra-ai/skills',
    featured: false,
    compatibility: {
      mastraVersion: '>=1.0.0',
    },
    preview:
      'You are a security auditor. When auditing:\n\n1. Check for common vulnerabilities (XSS, SQL injection, etc.)\n2. Review authentication and authorization\n3. Verify secure data handling',
  },
  {
    name: 'test-generator',
    displayName: 'Test Generator',
    description:
      'Generates comprehensive test suites for code. Supports Jest, Vitest, Pytest, and other testing frameworks.',
    version: '1.4.0',
    author: 'mastra',
    license: 'MIT',
    repository: 'https://github.com/mastra-ai/skills/tree/main/test-generator',
    homepage: 'https://skills.sh/skills/test-generator',
    tags: ['testing', 'jest', 'vitest', 'unit-tests', 'integration-tests'],
    category: 'development',
    downloads: 18900,
    stars: 367,
    createdAt: '2024-05-01T00:00:00Z',
    updatedAt: '2025-01-22T00:00:00Z',
    npmPackage: '@mastra-skills/test-generator',
    githubRepo: 'mastra-ai/skills',
    featured: true,
    compatibility: {
      mastraVersion: '>=1.0.0',
    },
    preview:
      'You generate tests. For each test:\n\n1. Cover happy path and edge cases\n2. Use descriptive test names\n3. Follow AAA pattern (Arrange, Act, Assert)',
  },
  {
    name: 'data-visualization',
    displayName: 'Data Visualization',
    description: 'Creates data visualizations and charts. Supports D3.js, Chart.js, and generates insights from data.',
    version: '1.2.0',
    author: 'community',
    license: 'MIT',
    repository: 'https://github.com/community-skills/data-visualization',
    homepage: 'https://skills.sh/skills/data-visualization',
    tags: ['data', 'visualization', 'charts', 'd3', 'analytics'],
    category: 'data',
    downloads: 6800,
    stars: 123,
    createdAt: '2024-08-20T00:00:00Z',
    updatedAt: '2025-01-08T00:00:00Z',
    githubRepo: 'community-skills/data-visualization',
    featured: false,
    compatibility: {
      mastraVersion: '>=1.0.0',
    },
    preview:
      'You create data visualizations. When visualizing:\n\n1. Choose the right chart type for the data\n2. Use clear labels and legends\n3. Ensure accessibility with color choices',
  },
  {
    name: 'project-planning',
    displayName: 'Project Planning',
    description:
      'Helps plan and organize software projects. Creates roadmaps, breaks down tasks, and estimates timelines.',
    version: '1.0.0',
    author: 'community',
    license: 'MIT',
    repository: 'https://github.com/community-skills/project-planning',
    homepage: 'https://skills.sh/skills/project-planning',
    tags: ['planning', 'project-management', 'roadmap', 'agile', 'tasks'],
    category: 'productivity',
    downloads: 5400,
    stars: 98,
    createdAt: '2024-10-01T00:00:00Z',
    updatedAt: '2025-01-02T00:00:00Z',
    githubRepo: 'community-skills/project-planning',
    featured: false,
    compatibility: {
      mastraVersion: '>=1.0.0',
    },
    preview:
      'You help with project planning. When planning:\n\n1. Break down goals into actionable tasks\n2. Identify dependencies and blockers\n3. Create realistic timelines',
  },
  {
    name: 'ui-ux-review',
    displayName: 'UI/UX Review',
    description:
      'Reviews UI/UX designs for usability, accessibility, and best practices. Provides actionable feedback.',
    version: '1.1.0',
    author: 'community',
    license: 'MIT',
    repository: 'https://github.com/community-skills/ui-ux-review',
    homepage: 'https://skills.sh/skills/ui-ux-review',
    tags: ['ui', 'ux', 'design', 'accessibility', 'usability'],
    category: 'design',
    downloads: 4200,
    stars: 87,
    createdAt: '2024-09-01T00:00:00Z',
    updatedAt: '2024-12-15T00:00:00Z',
    githubRepo: 'community-skills/ui-ux-review',
    featured: false,
    compatibility: {
      mastraVersion: '>=1.0.0',
    },
    preview:
      'You review UI/UX designs. When reviewing:\n\n1. Check for accessibility (WCAG compliance)\n2. Evaluate information hierarchy\n3. Assess mobile responsiveness',
  },
  {
    name: 'research-assistant',
    displayName: 'Research Assistant',
    description: 'Helps with research tasks including literature review, summarization, and citation management.',
    version: '1.0.0',
    author: 'community',
    license: 'Apache-2.0',
    repository: 'https://github.com/community-skills/research-assistant',
    homepage: 'https://skills.sh/skills/research-assistant',
    tags: ['research', 'literature', 'citations', 'summarization', 'academic'],
    category: 'research',
    downloads: 3100,
    stars: 67,
    createdAt: '2024-11-01T00:00:00Z',
    updatedAt: '2025-01-05T00:00:00Z',
    githubRepo: 'community-skills/research-assistant',
    featured: false,
    compatibility: {
      mastraVersion: '>=1.0.0',
    },
    preview:
      'You assist with research. When researching:\n\n1. Synthesize information from multiple sources\n2. Provide proper citations\n3. Identify knowledge gaps',
  },
];

// Update category counts
for (const category of categories) {
  category.skillCount = skills.filter(s => s.category === category.name).length;
}

/**
 * Get all unique tags from skills
 */
export function getAllTags(): string[] {
  const tagSet = new Set<string>();
  for (const skill of skills) {
    for (const tag of skill.tags) {
      tagSet.add(tag);
    }
  }
  return Array.from(tagSet).sort();
}

/**
 * Get all unique authors from skills
 */
export function getAllAuthors(): string[] {
  const authorSet = new Set<string>();
  for (const skill of skills) {
    authorSet.add(skill.author);
  }
  return Array.from(authorSet).sort();
}
