const BACKGROUND_TOOL_TASK_ID_PATTERN = /^Background task started\. Task ID: ([^.\s]+)/;

export function parseBackgroundToolTaskId(result: string): string | undefined {
  return BACKGROUND_TOOL_TASK_ID_PATTERN.exec(result)?.[1];
}
