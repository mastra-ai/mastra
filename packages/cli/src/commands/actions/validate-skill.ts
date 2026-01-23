import { analytics } from '../..';
import type { CLI_ORIGIN } from '../../analytics';
import { validateSkillCommand as validateSkillImpl } from '../skills/validate-skill';

const origin = process.env.MASTRA_ANALYTICS_ORIGIN as CLI_ORIGIN;

export const validateSkill = async (path: string | undefined, args: {}) => {
  await analytics.trackCommandExecution({
    command: 'skill-validate',
    args: { ...args, path },
    execution: async () => {
      await validateSkillImpl(path);
    },
    origin,
  });
};
