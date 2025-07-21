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
    super({
      name: 'vercel',
    });

    this.teamId = (process.env.VERCEL_TEAM_ID || teamId)!;
    this.projectId = (process.env.VERCEL_PROJECT_ID || projectId)!;
    this.token = (process.env.VERCEL_TOKEN || token)!;
  }

  async createSandbox({ language }) {
    const sandbox = await Sandbox.create({
      teamId: process.env.VERCEL_TEAM_ID!,
      projectId: process.env.VERCEL_PROJECT_ID!,
      token: process.env.VERCEL_TOKEN!,
      runtime: language === 'python' ? 'python3.13' : 'node22',
    });

    return {
      id: sandbox.sandboxId,
    };
  }

  async executeCode({
    sandboxId,
    code,
    options,
  }: {
    sandboxId: string;
    code: string;
    options?: {
      argv?: string[];
      env?: Record<string, string>;
      timeout?: number;
    };
  }) {
    const sandbox = await Sandbox.get({
      sandboxId,
      teamId: this.teamId,
      projectId: this.projectId,
      token: this.token,
    });

    return sandbox.runCommand({
      cmd: code,
      env: options?.env,
      args: options?.argv,
    });
  }
}
