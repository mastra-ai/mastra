// @ts-nocheck
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';

// Multiple imports
import { Mastra as MastraMulti } from '@mastra/core';
import { Agent as AgentMulti } from '@mastra/core/agent';
import { createTool as createToolMulti } from '@mastra/core/tools';

// Import with alias
import { Mastra as MastraApp } from '@mastra/core';
import { Agent as MastraAgent } from '@mastra/core/agent';

// Multiple imports with alias
import { Mastra as MastraApp2 } from '@mastra/core';
import { Agent as MastraAgent2 } from '@mastra/core/agent';

// Should not affect other packages
import { Mastra as MastraOther } from 'some-other-package';
import { Agent as AgentOther } from 'another-package';
