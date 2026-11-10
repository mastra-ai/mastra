// `@mastra/mcp-apps-components` builds after this package (it builds on `@mastra/client-js`), so the optional
// import in `route.ts` is typed here instead of from its build output.
declare module '@mastra/mcp-apps-components/trace-viewer' {
  export const traceViewerApp: { name: string; description: string; html: string };
}
