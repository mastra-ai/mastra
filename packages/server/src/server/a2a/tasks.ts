import type { IMastraLogger } from '@mastra/core/logger';
import type { InMemoryTaskStore } from './store';
import type {
  A2AWireArtifact as Artifact,
  A2AWireMessage as Message,
  A2AWireTask as Task,
  A2AWireTaskArtifactUpdateEvent as TaskArtifactUpdateEvent,
  A2AWireTaskStatus as TaskStatus,
} from './wire-types';
import { TERMINAL_TASK_STATES } from './wire-types';

export interface TaskContext {
  task: Task;
  userMessage: Message;
  history: Message[];
  isCancelled(): boolean;
}

// v1 wire status/artifact updates are discriminated structurally (no `kind`):
// a status update carries `state`; an artifact update carries `artifact`.
function isTaskStatusUpdate(update: TaskStatus | TaskArtifactUpdateEvent): update is Omit<TaskStatus, 'timestamp'> {
  return 'state' in update && !('artifact' in update);
}

function isArtifactUpdate(update: TaskStatus | TaskArtifactUpdateEvent): update is TaskArtifactUpdateEvent {
  return 'artifact' in update;
}

export function applyUpdateToTask(
  current: Task,
  update: Omit<TaskStatus, 'timestamp'> | TaskArtifactUpdateEvent,
): Task {
  let newTask = structuredClone(current);

  if (isTaskStatusUpdate(update)) {
    // Merge status update
    newTask.status = {
      ...newTask.status, // Keep existing properties if not overwritten
      ...update, // Apply updates
      timestamp: new Date().toISOString(),
    };
  } else if (isArtifactUpdate(update)) {
    // Handle artifact update
    if (!newTask.artifacts) {
      newTask.artifacts = [];
    } else {
      // Ensure we're working with a copy of the artifacts array
      newTask.artifacts = [...newTask.artifacts];
    }

    const artifact = update.artifact;
    const existingIndex = newTask.artifacts.findIndex(a => a.name === artifact.name);
    const existingArtifact = newTask.artifacts[existingIndex];

    if (existingArtifact) {
      if (update.append) {
        // Create a deep copy for modification to avoid mutating original
        const appendedArtifact = JSON.parse(JSON.stringify(existingArtifact)) as Artifact;
        appendedArtifact.parts.push(...artifact.parts);
        if (artifact.metadata) {
          appendedArtifact.metadata = {
            ...(appendedArtifact.metadata || {}),
            ...artifact.metadata,
          };
        }
        if (artifact.description) appendedArtifact.description = artifact.description;
        newTask.artifacts[existingIndex] = appendedArtifact; // Replace with appended version
      } else {
        // Overwrite artifact at index (with a copy of the update)
        newTask.artifacts[existingIndex] = { ...artifact };
      }
    } else {
      newTask.artifacts.push({ ...artifact });
    }
  }

  return newTask;
}

export async function loadOrCreateTask({
  agentId,
  taskId,
  taskStore,
  message,
  contextId,
  metadata,
  logger,
}: {
  agentId: string;
  taskId: string;
  taskStore: InMemoryTaskStore;
  message: Message;
  contextId?: string;
  metadata?: Record<string, unknown>;
  logger?: IMastraLogger;
}): Promise<Task> {
  const data = await taskStore.load({ agentId, taskId });

  // Create new task if none exists
  if (!data) {
    const initialTask: Task = {
      id: taskId,
      contextId: contextId || crypto.randomUUID(),
      status: {
        state: 'TASK_STATE_SUBMITTED',
        timestamp: new Date().toISOString(),
        message: undefined,
      },
      artifacts: [],
      history: [message],
      metadata: metadata,
    };

    logger?.info(`[Task ${taskId}] Created new task.`);
    await taskStore.save({ agentId, data: initialTask });

    return initialTask;
  }

  // Handle existing task
  logger?.info(`[Task ${taskId}] Loaded existing task.`);

  // Add message to history and prepare updated data
  let updatedData = data;
  updatedData.history = [...(data.history || []), message];

  // Handle state transitions
  const { status } = data;

  if (TERMINAL_TASK_STATES.includes(status.state)) {
    logger?.warn(`[Task ${taskId}] Received message for task in final state ${status.state}. Restarting.`);
    updatedData = applyUpdateToTask(updatedData, {
      state: 'TASK_STATE_SUBMITTED',
      message: undefined,
    });
  } else if (status.state === 'TASK_STATE_INPUT_REQUIRED') {
    logger?.info(`[Task ${taskId}] Changing state from 'input-required' to 'working'.`);
    updatedData = applyUpdateToTask(updatedData, { state: 'TASK_STATE_WORKING' });
  } else if (status.state === 'TASK_STATE_WORKING') {
    logger?.warn(`[Task ${taskId}] Received message while already 'working'. Proceeding.`);
  }

  await taskStore.save({ agentId, data: updatedData });

  return updatedData;
}

export function createTaskContext({
  task,
  userMessage,
  history,
  activeCancellations,
}: {
  task: Task;
  userMessage: Message;
  history: Message[];
  activeCancellations: Set<string>;
}): TaskContext {
  return {
    task: structuredClone(task),
    userMessage,
    history: structuredClone(history),
    isCancelled: () => activeCancellations.has(task.id),
  };
}
