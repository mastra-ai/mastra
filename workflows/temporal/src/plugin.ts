import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SimplePlugin } from '@temporalio/plugin';
import type { WorkerOptions } from '@temporalio/worker';
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

export interface MastraPluginOptions {
  /** Persist transformed modules and emitted workflow bundles for debugging. */
  debug?: boolean;
}

export class MastraPlugin extends SimplePlugin {
  private compiledActivitiesModule: Promise<Record<string, unknown>> | null = null;
  private compiledEntryPath: string | null = null;
  private compiledActivitiesPath: string | null = null;
  private activityBindings: TemporalActivityBinding[] | null = null;

  constructor(_options: MastraPluginOptions = {}) {
    super({
      name: 'Mastra',
    });
  }

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

  async prebuild({ entryFile, projectRoot = process.cwd() }: { entryFile: string; projectRoot?: string }): Promise<{
    workflowBundle: WorkerOptions['workflowBundle'];
  }> {
    const temporalOutputDir = path.resolve(projectRoot, CACHE_PATH);
    const compiledEntryPath = await this.#bundleMastra(entryFile, projectRoot, temporalOutputDir);

    const workflowOutputPath = await buildTemporalWorkflowModule(
      compiledEntryPath,
      temporalOutputDir,
      WORKFLOW_FILE_NAME,
    );

    const { outputPath: activitiesOutputPath, activityBindings } = await buildTemporalActivitiesModule(
      compiledEntryPath,
      temporalOutputDir,
      ACTIVITIES_FILE_NAME,
    );

    await writeFile(getActivityBindingsPath(temporalOutputDir), JSON.stringify(activityBindings, null, 2), 'utf8');

    this.compiledActivitiesModule = null;
    this.compiledEntryPath = workflowOutputPath;
    this.compiledActivitiesPath = activitiesOutputPath;
    this.activityBindings = activityBindings;

    return {
      workflowBundle: {
        codePath: workflowOutputPath,
      },
    };
  }

  private getInitializedState(outputDir: string): {
    compiledEntryPath: string;
    compiledActivitiesPath: string;
    activityBindings: TemporalActivityBinding[];
  } {
    const compiledEntryPath = this.compiledEntryPath ?? getGeneratedWorkflowModulePath(outputDir);
    const compiledActivitiesPath = this.compiledActivitiesPath ?? getGeneratedActivitiesModulePath(outputDir);
    const activityBindings = this.activityBindings ?? this.loadActivityBindings(getActivityBindingsPath(outputDir));

    return {
      compiledEntryPath,
      compiledActivitiesPath,
      activityBindings,
    };
  }

  private loadActivityBindings(activityBindingsPath: string): TemporalActivityBinding[] {
    try {
      const bindings = JSON.parse(readFileSync(activityBindingsPath, 'utf8')) as TemporalActivityBinding[];
      this.activityBindings = bindings;
      return bindings;
    } catch (error) {
      throw new Error(`MastraPlugin.prebuild() must be called before use, or ${activityBindingsPath} must exist`, {
        cause: error,
      });
    }
  }

  private loadCompiledActivitiesModule(activitiesModulePath: string): Promise<Record<string, unknown>> {
    if (this.compiledActivitiesModule) {
      return this.compiledActivitiesModule;
    }

    const modulePromise = import(`${pathToFileURL(activitiesModulePath).href}?t=${Date.now()}`) as Promise<
      Record<string, unknown>
    >;

    this.compiledActivitiesModule = modulePromise;
    return modulePromise;
  }

  configureWorker(options: WorkerOptions): WorkerOptions {
    const temporalOutputDir = path.resolve(process.cwd(), CACHE_PATH);
    const { compiledActivitiesPath, activityBindings } = this.getInitializedState(temporalOutputDir);
    const generatedActivities = Object.assign({}, options.activities) as Record<string, unknown>;

    for (const binding of activityBindings) {
      if (generatedActivities[binding.stepId]) {
        continue;
      }

      generatedActivities[binding.stepId] = async (...args: unknown[]) => {
        const activityModule = await this.loadCompiledActivitiesModule(compiledActivitiesPath);
        const activity = activityModule[binding.exportName];

        if (typeof activity !== 'function') {
          throw new Error(`Unable to load activity '${binding.exportName}' from ${compiledActivitiesPath}`);
        }

        return activity(...args);
      };
    }

    return {
      ...options,
      workflowsPath: getGeneratedWorkflowModulePath(temporalOutputDir),
      activities: generatedActivities,
    };
  }
}
