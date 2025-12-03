// Nitro config for workflow SDK
// The workflow/nitro module enables "use workflow" and "use step" directive compilation
export default {
  modules: ['workflow/nitro'],
  // Mark @mastra/core as external to avoid bundling Node.js deps
  // TODO: This needs a proper solution - mastra must be available at runtime
  rollupConfig: {
    external: [/^@mastra\/core/],
  },
};
