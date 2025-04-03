declare module '@mastra/core/mastra' {
  export class Mastra {
    constructor(config: any);
    getWorkflow(id: string): any;
  }
}

declare module '@mastra/core/logger' {
  export function createLogger(options: any): any;
}

declare module '@mastra/core/workflows' {
  export class Workflow {
    constructor(config: any);
    step(step: Step): Workflow;
    then(step: Step): Workflow;
    commit(): void;
  }
  
  export class Step {
    constructor(config: any);
  }
}

declare module './agents' {
  export const weatherAgent: any;
  export const keywordResearcherAgent: any;
  export const contentPlannerAgent: any;
  export const blogWriterAgent: any;
  export const editorAgent: any;
  export const contentPublisherAgent: any;
  export const browserAgent: any;
}

declare module './workflows/blogWorkflow' {
  export const escortBlogWorkflow: any;
}

declare module './workflows/browserWorkflow' {
  export const browserWorkflow: any;
}

declare module './mcp' {
  // Export declarations for mcp module
}

declare module './tools' {
  export const browserTool: any;
}

declare module './agents/browserAgent' {
  export const browserAgent: any;
  export const createBrowserAgentWithMCP: any;
} 