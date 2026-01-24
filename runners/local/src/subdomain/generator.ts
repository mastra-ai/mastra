import type { Project, Deployment } from '@mastra/admin';
import { DeploymentType } from '@mastra/admin';

/**
 * Generates subdomain strings for deployments.
 *
 * Patterns:
 * - production: "{project-slug}"
 * - staging: "staging--{project-slug}"
 * - preview: "{branch}--{project-slug}"
 */
export class SubdomainGenerator {
  /**
   * Generate subdomain for a deployment.
   */
  generate(project: Project, deployment: Deployment): string {
    const projectSlug = this.sanitizeSlug(project.slug);

    switch (deployment.type) {
      case DeploymentType.PRODUCTION:
        return projectSlug;

      case DeploymentType.STAGING:
        return `staging--${projectSlug}`;

      case DeploymentType.PREVIEW: {
        const branchSlug = this.sanitizeSlug(deployment.branch);
        return `${branchSlug}--${projectSlug}`;
      }

      default: {
        // For any custom deployment types
        const typeSlug = this.sanitizeSlug(deployment.slug);
        return `${typeSlug}--${projectSlug}`;
      }
    }
  }

  /**
   * Parse a subdomain to extract project slug and deployment type.
   */
  parse(subdomain: string): { projectSlug: string; deploymentSlug?: string } {
    const parts = subdomain.split('--');

    if (parts.length === 1) {
      // Production deployment
      return { projectSlug: parts[0]! };
    }

    // Non-production deployment
    return {
      projectSlug: parts[parts.length - 1]!,
      deploymentSlug: parts.slice(0, -1).join('--'),
    };
  }

  /**
   * Sanitize a string for use in a subdomain.
   * - Lowercase
   * - Replace spaces and underscores with hyphens
   * - Remove invalid characters
   * - Collapse multiple hyphens
   * - Trim hyphens from start/end
   */
  private sanitizeSlug(input: string): string {
    return input
      .toLowerCase()
      .replace(/[\s_]/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
