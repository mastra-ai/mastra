export { Mastra, type Config } from './mastra';

// Re-export inbox types for convenience
export {
  Inbox,
  TaskStatus,
  TaskPriority,
  type Task,
  type CreateTaskInput,
  type ClaimFilter,
  type ListFilter,
  type InboxStats,
  type IInbox,
  type InboxConfig,
  type RetryConfig,
  type SuspendTaskInput,
  type ResumeTaskInput,
} from './inbox';
