import type { AgentControllerEvent, AgentControllerTaskState } from './types';

export class SessionTasks {
  #snapshot: AgentControllerTaskState = { threadId: null, status: 'loading' };

  get(): AgentControllerTaskState {
    return this.#snapshot;
  }

  bind(threadId: string | null): void {
    if (threadId !== this.#snapshot.threadId) {
      this.#snapshot = { threadId, status: 'loading' };
    }
  }

  apply(event: AgentControllerEvent): boolean {
    if (event.type === 'task_snapshot') {
      if (event.snapshot.threadId !== this.#snapshot.threadId) return false;
      this.#snapshot = event.snapshot;
    } else if (event.type === 'task_updated') {
      if (event.threadId !== this.#snapshot.threadId) return false;
      this.#snapshot = { threadId: event.threadId, status: 'ready', tasks: event.tasks };
    }
    return true;
  }
}
