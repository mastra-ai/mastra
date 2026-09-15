import pkgJson from '../../../package.json';
import { getAnalytics } from '../../analytics';
import type { CreateCommandOptions } from '../create/create';
import { getCreateCommandAnalyticsArgs, isCreateCancelledError, runCreateCommand } from '../create/create';
import { getVersionTag } from '../utils';

type Analytics = NonNullable<ReturnType<typeof getAnalytics>>;
type CreateOrigin = Parameters<Analytics['trackCommandExecution']>[0]['origin'];

const origin = process.env.MASTRA_ANALYTICS_ORIGIN as CreateOrigin;

export interface CreateProjectDependencies {
  analytics?: Analytics | null;
  resolveVersionTag?: () => Promise<string | undefined>;
}

export const createProjectWithDependencies = async (
  projectName: string | undefined,
  args: CreateCommandOptions,
  dependencies: CreateProjectDependencies = {},
) => {
  const analytics = dependencies.analytics === undefined ? getAnalytics() : dependencies.analytics;
  const resolveVersionTag = dependencies.resolveVersionTag ?? (() => getVersionTag(pkgJson.version));
  const execution = async () => {
    try {
      await runCreateCommand(projectName, args, {
        analytics: analytics ?? undefined,
        resolveVersionTag,
      });
    } catch (error) {
      if (isCreateCancelledError(error)) return;
      throw error;
    }
  };

  if (!analytics) {
    await execution();
    return;
  }

  await analytics.trackCommandExecution({
    command: 'create',
    args: getCreateCommandAnalyticsArgs(args),
    execution,
    origin,
  });
};

export const createProject = (projectName: string | undefined, args: CreateCommandOptions) =>
  createProjectWithDependencies(projectName, args);
