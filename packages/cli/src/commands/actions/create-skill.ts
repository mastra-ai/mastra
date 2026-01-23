import { analytics } from '../..';
import type { CLI_ORIGIN } from '../../analytics';
import { createSkill as createSkillImpl } from '../skills/create-skill';

const origin = process.env.MASTRA_ANALYTICS_ORIGIN as CLI_ORIGIN;

export const createSkill = async (name: string | undefined, args: { dir?: string }) => {
    await analytics.trackCommandExecution({
        command: 'skill-create',
        args: { ...args, name },
        execution: async () => {
            await createSkillImpl(name, args.dir);
        },
        origin,
    });
};
