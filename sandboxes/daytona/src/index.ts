import { Daytona } from '@daytonaio/sdk';
import { MastraSandbox } from '@mastra/core/sandbox';

export class DaytonaSandbox extends MastraSandbox {
  client: Daytona;

  constructor({
    apikey,
    apiUrl,
    target,
  }: {
    apikey?: string;
    apiUrl?: string;
    target?: 'us' | 'eu';
  } = {}) {
    super({
      name: 'daytona',
    });

    // Using explicit configuration
    this.client = new Daytona({
      apiKey: process.env.DAYTONA_API_KEY || apikey,
      apiUrl: process.env.DAYTONA_API_URL || apiUrl,
      target: process.env.DAYTONA_TARGET || target,
    });
  }

  async createSandbox({ language }) {
    const sandbox = await this.client.create({
      language,
    });

    return {
      id: sandbox.id,
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
    const sandbox = await this.client.get(sandboxId);

    return sandbox.process.codeRun(
      code,
      {
        argv: options?.argv,
        env: options?.env,
      },
      options?.timeout,
    );
  }
}
