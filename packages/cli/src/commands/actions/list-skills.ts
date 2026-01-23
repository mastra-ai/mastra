import { analytics } from '../..';
import type { CLI_ORIGIN } from '../../analytics';
import { listSkillsCommand as listSkillsImpl } from '../skills/list-skills';

const origin = process.env.MASTRA_ANALYTICS_ORIGIN as CLI_ORIGIN;

export const listSkills = async (args: { dir?: string }) => {
  await analytics.trackCommandExecution({
    command: 'skill-list',
    args,
    execution: async () => {
      await listSkillsImpl(args.dir);
    },
    origin,
  });
};
