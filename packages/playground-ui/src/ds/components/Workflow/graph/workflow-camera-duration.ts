export const WORKFLOW_CAMERA_DURATION = 300;

export function workflowCameraDuration() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : WORKFLOW_CAMERA_DURATION;
}
