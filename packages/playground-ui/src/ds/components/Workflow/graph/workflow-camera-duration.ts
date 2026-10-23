export function workflowCameraDuration() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 300;
}
