import { Sandbox } from '@vercel/sandbox';
import { MastraSandbox } from '@mastra/core/sandbox';

export class VercelSandbox extends MastraSandbox {
  teamId: string;
  projectId: string;
  token: string;

  constructor({
    teamId,
    projectId,
    token,
  }: {
    teamId?: string;
    projectId?: string;
    token?: string;
  } = {}) {
    super();

    this.teamId = (process.env.VERCEL_TEAM_ID || teamId)!;
    this.projectId = (process.env.VERCEL_PROJECT_ID || projectId)!;
    this.token = (process.env.VERCEL_TOKEN || token)!;
  }

  async createSandbox({ language }) {
    const sandbox = await Sandbox.create({
      teamId: process.env.VERCEL_TEAM_ID!,
      projectId: process.env.VERCEL_PROJECT_ID!,
      token: process.env.VERCEL_TOKEN!,
      runtime: language,
    });

    return {
      id: sandbox.sandboxId,
    };
  }
}
