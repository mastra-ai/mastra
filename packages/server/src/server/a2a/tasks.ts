import type { Message, Task, TaskStatus, TaskContext, TaskArtifactUpdateEvent, Artifact } from '@mastra/core/a2a';
import { MastraA2AError } from '@mastra/core/a2a';
import type { IMastraLogger } from '@mastra/core/logger';
import { TaskStoreVersionConflictError, type InMemoryTaskStore } from './store';
import { isTerminalTaskState } from './task-state';

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
  for (let attempt = 0; attempt < 2; attempt++) {
    const snapshot = taskStore.loadWithVersion({ agentId, taskId });
    const data = snapshot?.task;

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
      try {
        await taskStore.save({ agentId, data: initialTask, expectedVersion: 0 });
        return initialTask;
      } catch (error) {
        if (error instanceof TaskStoreVersionConflictError) {
          continue;
        }
        throw error;
      }
    }

    logger?.info(`[Task ${taskId}] Loaded existing task.`);

    const { status } = data;
    if (isTerminalTaskState(status.state)) {
      throw MastraA2AError.invalidRequest(
        `Task ${taskId} is in terminal state ${status.state} and cannot be restarted.`,
      );
    }

    let updatedData: Task = {
      ...data,
      history: [...(data.history || []), message],
    };

    if (status.state === 'input-required' || status.state === 'auth-required') {
      logger?.info(`[Task ${taskId}] Changing state from '${status.state}' to 'working'.`);
      updatedData = applyUpdateToTask(updatedData, { state: 'working' });
    } else if (status.state === 'working') {
      logger?.warn(`[Task ${taskId}] Received message while already 'working'. Proceeding.`);
    }

    try {
      await taskStore.save({ agentId, data: updatedData, expectedVersion: snapshot.version });
      return updatedData;
    } catch (error) {
      if (error instanceof TaskStoreVersionConflictError) {
        continue;
      }
      throw error;
    }
  }

  throw MastraA2AError.invalidRequest(`Task ${taskId} was updated concurrently. Retry the request.`);
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
