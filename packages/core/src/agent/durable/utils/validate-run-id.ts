export function assertValidRunId(runId: string): void {
  if (runId.includes('\u0000retake\u0000') || runId.endsWith('\u0000retake')) {
    throw new TypeError(
      '`runId` must not contain the reserved lease delimiter "\\u0000retake\\u0000" or end with "\\u0000retake".',
    );
  }
}
