import {scienceChatAgent} from './agents/test-agent';

const config = {
  agents: {
    scienceChatAgent,
  },
  workflows: {},
} as const;

export default config;
