import type { ApiRoute } from '@mastra/core/server';
import { LibSQLFactoryStorage } from '@mastra/libsql';
import { IntakeStorage } from '@mastra/factory/storage/domains/intake/base';
import { IntegrationStorage } from '@mastra/factory/storage/domains/integrations/base';
import { FactoryProjectsStorage } from '@mastra/factory/storage/domains/projects/base';
import { SourceControlStorage } from '@mastra/factory/storage/domains/source-control/base';
import type { Hono } from 'hono';
import { onTestFinished } from 'vitest';

export async function createPlatformStorageForTests() {
  const storage = new LibSQLFactoryStorage({ id: 'platform-integration-test', url: ':memory:' });
  const intake = storage.registerDomain(new IntakeStorage());
  const integrations = storage.registerDomain(new IntegrationStorage());
  const projects = storage.registerDomain(new FactoryProjectsStorage());
  const sourceControl = storage.registerDomain(new SourceControlStorage());
  await storage.init();
  onTestFinished(() => storage.close());
  return { storage, intake, integrations, projects, sourceControl };
}

export function mountApiRoutes(app: Hono, routes: ApiRoute[]): void {
  for (const route of routes) {
    if ('handler' in route) app.on(route.method, route.path, route.handler as never);
  }
}
