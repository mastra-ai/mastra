import { createRenderBatcher } from './batcher.mjs';

const { schedule: microtask, cancel: cancelMicrotask } = 
/* @__PURE__ */ createRenderBatcher(queueMicrotask, false);

export { cancelMicrotask, microtask };
