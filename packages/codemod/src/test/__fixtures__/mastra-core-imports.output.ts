// @ts-nocheck
import { Mastra } from '@mastra/core';
import { Mastra as MastraSubpath } from '@mastra/core/mastra';
import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { Workflow, Step } from '@mastra/core/workflows';

// Multiple imports
import { Mastra as MastraMulti } from '@mastra/core';

import { Agent as AgentMulti } from '@mastra/core/agent';
import { createTool as createToolMulti } from '@mastra/core/tools';

// Workflows mixed with other imports
import { Mastra as MastraMixed } from '@mastra/core';

import { createWorkflow as makeWorkflow, createStep as makeStep } from '@mastra/core/workflows';
import { Agent as AgentMixed } from '@mastra/core/agent';

// Import with alias
import { Mastra as MastraApp } from '@mastra/core';
import { Agent as MastraAgent } from '@mastra/core/agent';

// Multiple imports with alias
import { Mastra as MastraApp2 } from '@mastra/core';

import { Agent as MastraAgent2 } from '@mastra/core/agent';
import { createWorkflow as defineWorkflow } from '@mastra/core/workflows';
import type { Agent as TypeAgent } from '@mastra/core/agent';
import { createTool as createTool2 } from '@mastra/core/tools';
import { Agent as ValueAgent } from '@mastra/core/agent';
import type { Tool } from '@mastra/core/tools';
import type { Agent as TypeOnlyAgent } from '@mastra/core/agent';
import type { Workflow as TypeOnlyWorkflow } from '@mastra/core/workflows';

// Should not affect other packages
import { Mastra as MastraOther } from 'some-other-package';
import { Agent as AgentOther } from 'another-package';
