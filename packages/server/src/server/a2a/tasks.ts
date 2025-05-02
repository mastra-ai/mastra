import type { Message, TaskContext, TaskAndHistory, Task, TaskState, TaskStatus, Artifact } from '@mastra/core/a2a';
import { A2AError } from '@mastra/core/a2a';
import { activeCancellations } from './store';
import type { InMemoryTaskStore } from './store';

function isTaskStatusUpdate(update: any): update is Omit<TaskStatus, 'timestamp'> {
  return 'state' in update && !('parts' in update);
}

function isArtifactUpdate(update: any): update is Artifact {
  return 'parts' in update;
}

export function applyUpdateToTaskAndHistory(
  current: TaskAndHistory,
  update: Omit<TaskStatus, 'timestamp'> | Artifact,
): TaskAndHistory {
  let newTask = { ...current.task }; // Shallow copy task
  let newHistory = [...current.history]; // Shallow copy history

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
}: {
  agentId: string;
  taskId: string;
  taskStore: InMemoryTaskStore;
  message: Message;
  sessionId?: string | null; // Allow null
  metadata?: Record<string, unknown> | null; // Allow null
}): Promise<TaskAndHistory> {
  let data = await taskStore.load({ agentId, taskId });
  let needsSave = false;

  if (!data) {
    // Create new task and history
    const initialTask: Task = {
      id: taskId,
      sessionId: sessionId ?? undefined, // Store undefined if null
      status: {
        state: 'submitted', // Start as submitted
        timestamp: new Date().toISOString(),
        message: null, // Initial user message goes only to history for now
      },
      artifacts: [],
      metadata: metadata ?? undefined, // Store undefined if null
    };
    const initialHistory: Message[] = [message]; // History starts with user message
    data = { task: initialTask, history: initialHistory };
    needsSave = true; // Mark for saving
    console.log(`[Task ${taskId}] Created new task and history.`);
  } else {
    console.log(`[Task ${taskId}] Loaded existing task and history.`);
    // Add current user message to history
    // Make a copy before potentially modifying
    data = { task: data.task, history: [...data.history, message] };
    needsSave = true; // History updated, mark for saving

    // Handle state transitions for existing tasks
    const finalStates: TaskState[] = ['completed', 'failed', 'canceled'];
    if (finalStates.includes(data.task.status.state)) {
      console.warn(
        `[Task ${taskId}] Received message for task already in final state ${data.task.status.state}. Handling as new submission (keeping history).`,
      );
      // Option 1: Reset state to 'submitted' (keeps history, effectively restarts)
      const resetUpdate: Omit<TaskStatus, 'timestamp'> = {
        state: 'submitted',
        message: null, // Clear old agent message
      };
      data = applyUpdateToTaskAndHistory(data, resetUpdate);
      // needsSave is already true

      // Option 2: Throw error (stricter)
      // throw A2AError.invalidRequest(`Task ${taskId} is already in a final state.`);
    } else if (data.task.status.state === 'input-required') {
      console.log(`[Task ${taskId}] Received message while 'input-required', changing state to 'working'.`);
      // If it was waiting for input, update state to 'working'
      const workingUpdate: Omit<TaskStatus, 'timestamp'> = {
        state: 'working',
      };
      data = applyUpdateToTaskAndHistory(data, workingUpdate);
      // needsSave is already true
    } else if (data.task.status.state === 'working') {
      // If already working, maybe warn but allow? Or force back to submitted?
      console.warn(`[Task ${taskId}] Received message while already 'working'. Proceeding.`);
      // No state change needed, but history was updated, so needsSave is true.
    }
    // If 'submitted', receiving another message might be odd, but proceed.
  }

  if (!data) {
    throw A2AError.internalError(`Task ${taskId} data not found.`);
  }

  // Save if created or modified before returning
  if (needsSave) {
    await taskStore.save({ agentId, data });
  }

  // Return copies to prevent mutation by caller before handler runs
  return { task: { ...data.task }, history: [...data.history] };
}

export function createTaskContext({
  task,
  userMessage,
  history,
}: {
  task: Task;
  userMessage: Message;
  history: Message[]; // Add history parameter
}): TaskContext {
  return {
    task: { ...task }, // Pass a copy
    userMessage: userMessage,
    history: [...history], // Pass a copy of the history
    isCancelled: () => activeCancellations.has(task.id),
    // taskStore is removed
  };
}
