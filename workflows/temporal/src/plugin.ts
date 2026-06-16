import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { WorkerOptions, WorkerPlugin } from '@temporalio/worker';
import type { TemporalActivityBinding } from './transforms/activities';
import { buildTemporalActivitiesModule } from './transforms/activities';
import { buildTemporalWorkflowModule } from './transforms/workflows';

const CACHE_PATH = 'node_modules/.mastra';
const WORKFLOW_FILE_NAME = 'workflow.mjs';
const ACTIVITIES_FILE_NAME = 'activities.mjs';
const ACTIVITY_BINDINGS_FILE_NAME = 'activity-bindings.json';

function getGeneratedWorkflowModulePath(outputDir: string): string {
  return path.join(outputDir, WORKFLOW_FILE_NAME);
}

function getGeneratedActivitiesModulePath(outputDir: string): string {
  return path.join(outputDir, ACTIVITIES_FILE_NAME);
}

function getActivityBindingsPath(outputDir: string): string {
  return path.join(outputDir, ACTIVITY_BINDINGS_FILE_NAME);
}

export class MastraPlugin implements WorkerPlugin {
  #prebuildPath: string | null = null;
  #compiledActivitiesModules = new Map<string, Promise<Record<string, unknown>>>();
  name = 'Mastra';

  constructor() {}

  async #bundleMastra(entryFile: string, projectRoot: string, outputDirectory: string): Promise<string> {
    const { BuildBundler } = await import('./mastra-deployer');
    const normalizedEntryFile = entryFile.startsWith('file:/') ? fileURLToPath(entryFile) : entryFile;
    const mastraBundler = new BuildBundler();
    await mastraBundler.prepare(outputDirectory);
    await mastraBundler.bundle(normalizedEntryFile, outputDirectory, {
      toolsPaths: [],
      projectRoot,
    });

    return path.join(outputDirectory, 'output', 'index.mjs');
  }

  async prebuild({
    entryFile,
    projectRoot = process.cwd(),
  }: {
    entryFile: string;
    projectRoot?: string;
  }): Promise<ReturnType<typeof this.getTemporalWorkerOptions>> {
    const temporalOutputDir = path.resolve(projectRoot, CACHE_PATH);
    const compiledEntryPath = await this.#bundleMastra(entryFile, projectRoot, temporalOutputDir);

    await buildTemporalWorkflowModule(compiledEntryPath, temporalOutputDir, WORKFLOW_FILE_NAME);

    const { activityBindings } = await buildTemporalActivitiesModule(
      compiledEntryPath,
      temporalOutputDir,
      ACTIVITIES_FILE_NAME,
    );

    await writeFile(getActivityBindingsPath(temporalOutputDir), JSON.stringify(activityBindings, null, 2), 'utf8');

    this.#prebuildPath = temporalOutputDir;
    return this.getTemporalWorkerOptions(temporalOutputDir);
  }

  #loadActivityBindings(activityBindingsPath: string): TemporalActivityBinding[] {
    try {
      const bindings = JSON.parse(readFileSync(activityBindingsPath, 'utf8')) as TemporalActivityBinding[];
      return bindings;
    } catch (error) {
      throw new Error(`MastraPlugin.prebuild() must be called before use, or ${activityBindingsPath} must exist`, {
        cause: error,
      });
    }
  }

  #loadCompiledActivitiesModule(activitiesModulePath: string): Promise<Record<string, unknown>> {
    const cachedModule = this.#compiledActivitiesModules.get(activitiesModulePath);
    if (cachedModule) {
      return cachedModule;
    }

    const modulePromise = import(`${pathToFileURL(activitiesModulePath).href}?t=${Date.now()}`) as Promise<
      Record<string, unknown>
    >;

    this.#compiledActivitiesModules.set(activitiesModulePath, modulePromise);
    return modulePromise;
  }

  #generateActivityBindings(
    activityBindings: TemporalActivityBinding[],
    compiledActivitiesPath: string,
  ): Record<string, (...args: unknown[]) => Promise<unknown>> {
    const generatedActivities: Record<string, (...args: unknown[]) => Promise<unknown>> = {};
    for (const binding of activityBindings) {
      if (generatedActivities[binding.stepId]) {
        continue;
      }

      generatedActivities[binding.stepId] = async (...args: unknown[]) => {
        const activityModule = await this.#loadCompiledActivitiesModule(compiledActivitiesPath);
        const activity = activityModule[binding.exportName];

        if (typeof activity !== 'function') {
          throw new Error(`Unable to load activity '${binding.exportName}' from ${compiledActivitiesPath}`);
        }

        return activity(...args);
      };
    }

    return generatedActivities;
  }

  getTemporalWorkerOptions(temporalOutputDir: string): {
    // workflowBundle: WorkerOptions['workflowBundle'];
    workflowsPath: WorkerOptions['workflowsPath'];
    activities: WorkerOptions['activities'];
  } {
    const workflowOutputPath = getGeneratedWorkflowModulePath(temporalOutputDir);
    const activitiesOutputPath = getGeneratedActivitiesModulePath(temporalOutputDir);
    const activityBindings = this.#loadActivityBindings(getActivityBindingsPath(temporalOutputDir));

    return {
      workflowsPath: workflowOutputPath,
      // workflowBundle: {
      //   codePath: workflowOutputPath,
      //   sourceMapPath: `${workflowOutputPath}.map`,
      // },
      activities: this.#generateActivityBindings(activityBindings, activitiesOutputPath),
    };
  }

  configureWorker(options: WorkerOptions): WorkerOptions {
    const augmentedOptions = Object.assign({}, options);
    if (this.#prebuildPath) {
      Object.assign(augmentedOptions, this.getTemporalWorkerOptions(this.#prebuildPath));
    } else {
      if (!options.workflowsPath || !options.activities) {
        throw new Error('MastraPlugin.prebuild() must be called before use');
      }
    }

    return augmentedOptions;
  }
}
