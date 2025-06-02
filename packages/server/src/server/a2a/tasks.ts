import type { Message, TaskContext, TaskAndHistory, Task, TaskState, TaskStatus, Artifact } from '@mastra/core/a2a';
import type { IMastraLogger } from '@mastra/core/logger';
import type { InMemoryTaskStore } from './store';

function isTaskStatusUpdate(update: TaskStatus | Artifact): update is Omit<TaskStatus, 'timestamp'> {
  return 'state' in update && !('parts' in update);
}

function isArtifactUpdate(update: TaskStatus | Artifact): update is Artifact {
  return 'parts' in update;
}

export function applyUpdateToTaskAndHistory(
  current: TaskAndHistory,
  update: Omit<TaskStatus, 'timestamp'> | Artifact,
): TaskAndHistory {
  let newTask = structuredClone(current.task);
  let newHistory = structuredClone(current.history);

  if (isTaskStatusUpdate(update)) {
    // Merge status update
    newTask.status = {
      ...newTask.status, // Keep existing properties if not overwritten
      ...update, // Apply updates
      timestamp: new Date().toISOString(),
    };

    // If the update includes an agent message, add it to history
    if (update.message?.role === 'agent') {
      newHistory.push(update.message);
    }
  } else if (isArtifactUpdate(update)) {
    // Handle artifact update
    if (!newTask.artifacts) {
      newTask.artifacts = [];
    } else {
      // Ensure we're working with a copy of the artifacts array
      newTask.artifacts = [...newTask.artifacts];
    }

    const existingIndex = update.index ?? -1; // Use index if provided
    let replaced = false;

    if (existingIndex >= 0 && existingIndex < newTask.artifacts.length) {
      const existingArtifact = newTask.artifacts[existingIndex];
      if (update.append) {
        // Create a deep copy for modification to avoid mutating original
        const appendedArtifact = JSON.parse(JSON.stringify(existingArtifact));
        appendedArtifact.parts.push(...update.parts);
        if (update.metadata) {
          appendedArtifact.metadata = {
            ...(appendedArtifact.metadata || {}),
            ...update.metadata,
          };
        }
        if (update.lastChunk !== undefined) appendedArtifact.lastChunk = update.lastChunk;
        if (update.description) appendedArtifact.description = update.description;
        newTask.artifacts[existingIndex] = appendedArtifact; // Replace with appended version
        replaced = true;
      } else {
        // Overwrite artifact at index (with a copy of the update)
        newTask.artifacts[existingIndex] = { ...update };
        replaced = true;
      }
    } else if (update.name) {
      const namedIndex = newTask.artifacts.findIndex(a => a.name === update.name);
      if (namedIndex >= 0) {
        newTask.artifacts[namedIndex] = { ...update }; // Replace by name (with copy)
        replaced = true;
      }
    }

    if (!replaced) {
      newTask.artifacts.push({ ...update }); // Add as a new artifact (copy)
      // Sort if indices are present
      if (newTask.artifacts.some(a => a.index !== undefined)) {
        newTask.artifacts.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
      }
    }
  }

  return { task: newTask, history: newHistory };
}

export async function loadOrCreateTaskAndHistory({
  agentId,
  taskId,
  taskStore,
  message,
  sessionId,
  metadata,
  logger,
}: {
  agentId: string;
  taskId: string;
  taskStore: InMemoryTaskStore;
  message: Message;
  sessionId?: string | null;
  metadata?: Record<string, unknown> | null;
  logger?: IMastraLogger;
}): Promise<TaskAndHistory> {
  const data = await taskStore.load({ agentId, taskId });

  // Create new task if none exists
  if (!data) {
    const initialTask: Task = {
      id: taskId,
      sessionId: sessionId,
      status: {
        state: 'submitted',
        timestamp: new Date().toISOString(),
        message: null,
      },
      artifacts: [],
      metadata: metadata,
    };

    const initialData = {
      task: initialTask,
      history: [message],
    };

    logger?.info(`[Task ${taskId}] Created new task and history.`);
    await taskStore.save({ agentId, data: initialData });

    return initialData;
  }

  // Handle existing task
  logger?.info(`[Task ${taskId}] Loaded existing task and history.`);

  // Add message to history and prepare updated data
  let updatedData = {
    task: data.task,
    history: [...data.history, message],
  };

  // Handle state transitions
  const { status } = data.task;
  const finalStates: TaskState[] = ['completed', 'failed', 'canceled'];

  if (finalStates.includes(status.state)) {
    logger?.warn(`[Task ${taskId}] Received message for task in final state ${status.state}. Restarting.`);
    updatedData = applyUpdateToTaskAndHistory(updatedData, {
      state: 'submitted',
      message: null,
    });
  } else if (status.state === 'input-required') {
    logger?.info(`[Task ${taskId}] Changing state from 'input-required' to 'working'.`);
    updatedData = applyUpdateToTaskAndHistory(updatedData, { state: 'working' });
  } else if (status.state === 'working') {
    logger?.warn(`[Task ${taskId}] Received message while already 'working'. Proceeding.`);
  }

  await taskStore.save({ agentId, data: updatedData });

  return {
    task: { ...updatedData.task },
    history: [...updatedData.history],
  };
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
