import * as sdk from './generated/sdk.gen';

export type MastraClientConfig = {
  baseUrl: string;
};

export class MastraClient {
  private sdk: typeof sdk;

  constructor(config: MastraClientConfig) {
    sdk.client.setConfig({
      baseUrl: config.baseUrl,
    });

    this.sdk = sdk;
  }

  static create(config: MastraClientConfig) {
    const mastraClient = new MastraClient(config);
    return mastraClient.sdk;
  }
}

// Re-export everything from the generated SDK
export * from './generated/sdk.gen';

const client = MastraClient.create({
  baseUrl: 'http://localhost:4111',
});

client.getApiAgents().then(data => {
  console.log('ss', data);
});
