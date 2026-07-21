import { getFactoryStorage } from '../runtime-config.js';
import type { ModelCredentialsStorage } from './domains/credentials/base.js';
import type { IntakeStorage } from './domains/intake/base.js';
import type { IntegrationStorage } from './domains/integrations/base.js';
import type { ModelPacksStorage } from './domains/model-packs/base.js';
import type { FactoryProjectsStorage } from './domains/projects/base.js';
import type { QueueHealthStorage } from './domains/queue-health/base.js';
import type { SourceControlStorage } from './domains/source-control/base.js';
import type { WorkItemsStorage } from './domains/work-items/base.js';

export function getModelCredentialsStorage(): ModelCredentialsStorage {
  return getFactoryStorage().getDomain<ModelCredentialsStorage>('model-credentials');
}

export function getIntakeStorage(): IntakeStorage {
  return getFactoryStorage().getDomain<IntakeStorage>('intake');
}

export function getQueueHealthStorage(): QueueHealthStorage {
  return getFactoryStorage().getDomain<QueueHealthStorage>('queue-health');
}

export function getIntegrationStorage(): IntegrationStorage {
  return getFactoryStorage().getDomain<IntegrationStorage>('integrations');
}

export function getModelPacksStorage(): ModelPacksStorage {
  return getFactoryStorage().getDomain<ModelPacksStorage>('model-packs');
}

export function getFactoryProjectsStorage(): FactoryProjectsStorage {
  return getFactoryStorage().getDomain<FactoryProjectsStorage>('projects');
}

export function getSourceControlStorage(): SourceControlStorage {
  return getFactoryStorage().getDomain<SourceControlStorage>('source-control');
}

export function getWorkItemsStorage(): WorkItemsStorage {
  return getFactoryStorage().getDomain<WorkItemsStorage>('work-items');
}
