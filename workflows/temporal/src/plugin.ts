import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { RequestContext } from '@mastra/core/di';
import { MastraError } from '@mastra/core/error';
import { toStandardSchema } from '@mastra/core/schema';
import type { PublicSchema } from '@mastra/core/schema';
import { validateStepInput, validateStepRequestContext } from '@mastra/core/workflows';
import { ApplicationFailure } from '@temporalio/activity';
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

interface ActivityParams extends Record<string, unknown> {
  inputData?: unknown;
  requestContext?: Record<string, unknown>;
  validateInputs?: boolean;
}

type GeneratedActivity = (params: ActivityParams) => Promise<unknown>;

interface GeneratedStep {
  execute: GeneratedActivity;
  inputSchema?: PublicSchema;
  requestContextSchema?: PublicSchema;
}

type GeneratedActivitiesModule = Record<string, GeneratedActivity | GeneratedStep | undefined>;

/**
 * Activities queued by a Workflow built before `validateInputs` existed carry no flag and run
 * unchecked. A mismatch is non-retryable because a retry gets the same input.
 */
async function checkStepParams(
  stepId: string,
  { inputSchema, requestContextSchema }: GeneratedStep,
  { validateInputs, ...params }: ActivityParams,
): Promise<ActivityParams> {
  if (validateInputs !== true) {
    return params;
  }

  const [input, requestContext] = await Promise.all([
    validateStepInput({
      prevOutput: params.inputData,
      step: { inputSchema: inputSchema && toStandardSchema(inputSchema) },
      validateInputs: true,
    }),
    validateStepRequestContext({
      requestContext: new RequestContext(Object.entries(params.requestContext ?? {})),
      step: { id: stepId, requestContextSchema: requestContextSchema && toStandardSchema(requestContextSchema) },
      validateInputs: true,
    }),
  ]);

  // Input errors win, as in Mastra's step handler.
  const error = input.validationError ?? requestContext.validationError;

  if (error) {
    throw ApplicationFailure.create({
      type: error instanceof MastraError ? error.id : error.name,
      message: error.message,
      nonRetryable: true,
      cause: error,
    });
  }

  return { ...params, inputData: input.inputData };
}

export class MastraPlugin implements WorkerPlugin {
  #prebuildPath: string | null = null;
  #prebuildPromise: Promise<ReturnType<typeof this.getTemporalWorkerOptions>> | null = null;
  #compiledActivitiesModules = new Map<string, Promise<GeneratedActivitiesModule>>();
  name = 'Mastra';

  constructor(
    private readonly entryFile: string,
    private readonly projectRoot: string = process.cwd(),
  ) {}

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

  /**
   * @deprecated Please use the constructor params instead.
   */
  async prebuild({
    entryFile,
    projectRoot = process.cwd(),
  }: {
    entryFile: string;
    projectRoot?: string;
  }): Promise<ReturnType<typeof this.getTemporalWorkerOptions>> {
    return this.#prebuild(entryFile, projectRoot);
  }

  async #prebuild(entryFile: string, projectRoot: string): Promise<ReturnType<typeof this.getTemporalWorkerOptions>> {
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

  #loadCompiledActivitiesModule(activitiesModulePath: string): Promise<GeneratedActivitiesModule> {
    const cachedModule = this.#compiledActivitiesModules.get(activitiesModulePath);
    if (cachedModule) {
      return cachedModule;
    }

    const modulePromise = import(
      `${pathToFileURL(activitiesModulePath).href}?t=${Date.now()}`
    ) as Promise<GeneratedActivitiesModule>;

    this.#compiledActivitiesModules.set(activitiesModulePath, modulePromise);
    return modulePromise;
  }

  #generateActivityBindings(
    activityBindings: TemporalActivityBinding[],
    compiledActivitiesPath: string,
  ): Record<string, GeneratedActivity> {
    const generatedActivities: Record<string, GeneratedActivity> = {};
    for (const binding of activityBindings) {
      if (generatedActivities[binding.stepId]) {
        continue;
      }

      generatedActivities[binding.stepId] = async params => {
        const activityModule = await this.#loadCompiledActivitiesModule(compiledActivitiesPath);
        const activity = activityModule[binding.exportName];

        // Mappings are plain functions, and so are steps generated by an older plugin version.
        // Those steps run unchecked.
        if (typeof activity === 'function') {
          return activity(params);
        }

        if (typeof activity?.execute !== 'function') {
          throw new Error(`Unable to load activity '${binding.exportName}' from ${compiledActivitiesPath}`);
        }

        return activity.execute(await checkStepParams(binding.stepId, activity, params));
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

  async configureWorker(options: WorkerOptions): Promise<WorkerOptions> {
    const augmentedOptions = Object.assign({}, options);
    if (!this.#prebuildPath) {
      this.#prebuildPromise ??= this.#prebuild(this.entryFile, this.projectRoot).catch(error => {
        this.#prebuildPromise = null;
        throw error;
      });
      await this.#prebuildPromise;
    }

    const generatedOptions = this.getTemporalWorkerOptions(this.#prebuildPath!);
    Object.assign(augmentedOptions, generatedOptions, {
      activities: {
        ...options.activities,
        ...generatedOptions.activities,
      },
    });

    return augmentedOptions;
  }
}
