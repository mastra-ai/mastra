import type {
  Message,
  Task,
  TaskState,
  TaskStatus,
  TaskContext,
  TaskArtifactUpdateEvent,
  Artifact,
} from '@mastra/core/a2a';
import type { IMastraLogger } from '@mastra/core/logger';
import type { InMemoryTaskStore } from './store';

function isTaskStatusUpdate(update: TaskStatus | TaskArtifactUpdateEvent): update is Omit<TaskStatus, 'timestamp'> {
  return 'state' in update && !('parts' in update);
}

function isArtifactUpdate(update: TaskStatus | TaskArtifactUpdateEvent): update is TaskArtifactUpdateEvent {
  return 'kind' in update && update.kind === 'artifact-update';
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
        state: 'submitted',
        timestamp: new Date().toISOString(),
        message: undefined,
      },
      artifacts: [],
      history: [message],
      metadata: metadata,
      kind: 'task',
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
  const finalStates: TaskState[] = ['completed', 'failed', 'canceled'];

  if (finalStates.includes(status.state)) {
    logger?.warn(`[Task ${taskId}] Received message for task in final state ${status.state}. Restarting.`);
    updatedData = applyUpdateToTask(updatedData, {
      state: 'submitted',
      message: undefined,
    });
  } else if (status.state === 'input-required') {
    logger?.info(`[Task ${taskId}] Changing state from 'input-required' to 'working'.`);
    updatedData = applyUpdateToTask(updatedData, { state: 'working' });
  } else if (status.state === 'working') {
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
