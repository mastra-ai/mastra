// @ts-nocheck
import { Mastra } from '@mastra/core';
import { Mastra as MastraSubpath } from '@mastra/core/mastra';
import { Agent } from '@mastra/core';
import { createTool } from '@mastra/core';

// Multiple imports
import { Mastra as MastraMulti, Agent as AgentMulti, createTool as createToolMulti } from '@mastra/core';

// Import with alias
import { Mastra as MastraApp } from '@mastra/core';
import { Agent as MastraAgent } from '@mastra/core';

// Multiple imports with alias
import { Mastra as MastraApp2, Agent as MastraAgent2 } from '@mastra/core';

// Should not affect other packages
import { Mastra as MastraOther } from 'some-other-package';
import { Agent as AgentOther } from 'another-package';
