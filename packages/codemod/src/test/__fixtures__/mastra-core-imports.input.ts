// @ts-nocheck
import { Mastra } from '@mastra/core';
import { Mastra as MastraSubpath } from '@mastra/core/mastra';
import { Agent } from '@mastra/core';
import { createTool } from '@mastra/core';

// Workflow imports
import { createWorkflow, createStep } from '@mastra/core';
import { Workflow, Step } from '@mastra/core';

// Multiple imports
import { Mastra as MastraMulti, Agent as AgentMulti, createTool as createToolMulti } from '@mastra/core';

// Workflows mixed with other imports
import {
  Mastra as MastraMixed,
  createWorkflow as makeWorkflow,
  Agent as AgentMixed,
  createStep as makeStep,
} from '@mastra/core';

// Import with alias
import { Mastra as MastraApp } from '@mastra/core';
import { Agent as MastraAgent } from '@mastra/core';

// Multiple imports with alias
import { Mastra as MastraApp2, Agent as MastraAgent2 } from '@mastra/core';

// Workflow with alias
import { createWorkflow as defineWorkflow } from '@mastra/core';

// Type imports (inline)
import { type Agent as TypeAgent, createTool as createTool2 } from '@mastra/core';
import { Agent as ValueAgent, type Tool } from '@mastra/core';

// Type-only imports
import type { Agent as TypeOnlyAgent, Workflow as TypeOnlyWorkflow } from '@mastra/core';

// Should not affect other packages
import { Mastra as MastraOther } from 'some-other-package';
import { Agent as AgentOther } from 'another-package';
