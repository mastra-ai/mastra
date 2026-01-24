import type { Project, Deployment } from '@mastra/admin';
import { DeploymentType } from '@mastra/admin';
import { describe, it, expect } from 'vitest';
import { SubdomainGenerator } from './generator';

describe('SubdomainGenerator', () => {
  const generator = new SubdomainGenerator();

  const createMockProject = (slug: string): Project =>
    ({
      id: 'project-1',
      slug,
      name: 'Test Project',
      sourceType: 'local',
      sourceConfig: { path: '/test' },
      createdAt: new Date(),
      updatedAt: new Date(),
    }) as Project;

  const createMockDeployment = (type: DeploymentType, extra: Partial<Deployment> = {}): Deployment =>
    ({
      id: 'deployment-1',
      projectId: 'project-1',
      buildId: 'build-1',
      type,
      slug: `deployment-${type}`,
      branch: 'main',
      status: 'running',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...extra,
    }) as Deployment;

  describe('generate', () => {
    it('should generate production subdomain as project slug', () => {
      const project = createMockProject('my-project');
      const deployment = createMockDeployment(DeploymentType.PRODUCTION);

      expect(generator.generate(project, deployment)).toBe('my-project');
    });

    it('should generate staging subdomain with staging prefix', () => {
      const project = createMockProject('my-project');
      const deployment = createMockDeployment(DeploymentType.STAGING);

      expect(generator.generate(project, deployment)).toBe('staging--my-project');
    });

    it('should generate preview subdomain with branch prefix', () => {
      const project = createMockProject('my-project');
      const deployment = createMockDeployment(DeploymentType.PREVIEW, { branch: 'feature-new-ui' });

      expect(generator.generate(project, deployment)).toBe('feature-new-ui--my-project');
    });

    it('should sanitize special characters in project slug', () => {
      const project = createMockProject('My_Project 123!');
      const deployment = createMockDeployment(DeploymentType.PRODUCTION);

      expect(generator.generate(project, deployment)).toBe('my-project-123');
    });

    it('should sanitize branch names with slashes', () => {
      const project = createMockProject('api');
      const deployment = createMockDeployment(DeploymentType.PREVIEW, { branch: 'feature/auth/oauth2' });

      expect(generator.generate(project, deployment)).toBe('featureauthoauth2--api');
    });

    it('should handle uppercase letters in project slug', () => {
      const project = createMockProject('MyAwesomeProject');
      const deployment = createMockDeployment(DeploymentType.PRODUCTION);

      expect(generator.generate(project, deployment)).toBe('myawesomeproject');
    });

    it('should collapse multiple hyphens', () => {
      const project = createMockProject('my---project');
      const deployment = createMockDeployment(DeploymentType.PRODUCTION);

      expect(generator.generate(project, deployment)).toBe('my-project');
    });

    it('should trim leading and trailing hyphens', () => {
      const project = createMockProject('-my-project-');
      const deployment = createMockDeployment(DeploymentType.PRODUCTION);

      expect(generator.generate(project, deployment)).toBe('my-project');
    });
  });

  describe('parse', () => {
    it('should parse production subdomain', () => {
      const result = generator.parse('my-project');

      expect(result.projectSlug).toBe('my-project');
      expect(result.deploymentSlug).toBeUndefined();
    });

    it('should parse staging subdomain', () => {
      const result = generator.parse('staging--my-project');

      expect(result.projectSlug).toBe('my-project');
      expect(result.deploymentSlug).toBe('staging');
    });

    it('should parse preview subdomain with branch', () => {
      const result = generator.parse('feature-new-ui--my-project');

      expect(result.projectSlug).toBe('my-project');
      expect(result.deploymentSlug).toBe('feature-new-ui');
    });

    it('should handle multiple double-dash separators', () => {
      const result = generator.parse('some-prefix--another--my-project');

      expect(result.projectSlug).toBe('my-project');
      expect(result.deploymentSlug).toBe('some-prefix--another');
    });
  });
});
