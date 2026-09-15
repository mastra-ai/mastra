type SubmitPlanToolId = (typeof import('@mastra/core/tools'))['submitPlanTool']['id'];

// Keep the browser bundle free of the Node-oriented tool implementation while
// retaining a compile-time link to the literal ID exported by @mastra/core.
export const SUBMIT_PLAN_TOOL_ID: SubmitPlanToolId = 'submit_plan';
