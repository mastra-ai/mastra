import * as fs from 'fs';
import * as path from 'path';

import { capitalizeFirstLetter } from '@/lib/string';

import { ConfigWriterService } from './service.configWriter';

const configFilePath = path.join(__dirname, 'test.future.config.ts');
const exampleConfig = `
import { SomeOtherIntegration } from '@mastra/someotherintegration';

const config = {
  integrations: [
    new SomeOtherIntegration({}),
  ],
};

export default config;
`;

describe('ConfigWriterService', () => {
  let service: ConfigWriterService;

  beforeAll(() => {
    // Write the example config to the file before running tests
    fs.writeFileSync(configFilePath, exampleConfig, 'utf8');
    service = new ConfigWriterService(configFilePath);
  });

  afterAll(() => {
    // Clean up the config file after tests
    fs.unlinkSync(configFilePath);
  });

  describe('addIntegration', () => {
    it('should add core integration and import statement to the config file', async () => {
      const integrationName = 'Rewatch';
      const config = `{
        config: {
          CLIENT_ID: 'test-client-id',
          CLIENT_SECRET: 'test-client-secret',
        },
      }`;
      const intImporter = `${integrationName}Integration`;

      await service.addIntegration(integrationName, config, false);

      const updatedConfig = fs.readFileSync(configFilePath, 'utf8');
      expect(updatedConfig).toContain(`import { ${intImporter} } from '@mastra/${integrationName.toLowerCase()}'`);
      expect(updatedConfig).toContain(`new ${intImporter}(`);
      expect(updatedConfig).toContain(`CLIENT_ID: 'test-client-id'`);
    });

    it('should add user defined integration and import statement to the config file', async () => {
      const integrationName = 'Irokotv';
      const config = `{
        config: {
          IROKOTV_CLIENT_ID: 'test-client-id',
          IROKOTV_CLIENT_SECRET: 'test-client-secret',
        },
      }`;
      const intImporter = `${integrationName}Integration`;

      await service.addIntegration(integrationName, config, false);

      const updatedConfig = fs.readFileSync(configFilePath, 'utf8');
      expect(updatedConfig).toContain(`import { ${intImporter} } from './${capitalizeFirstLetter(integrationName)}'`);
      expect(updatedConfig).toContain(`new ${intImporter}(`);
      expect(updatedConfig).toContain(`IROKOTV_CLIENT_ID: 'test-client-id'`);
    });
  });

  describe('removeIntegration', () => {
    it('should remove a integration and import statement from the config file', async () => {
      const intName = 'RewatchIntegration';

      await service.removeIntegration(intName);

      const updatedConfig = fs.readFileSync(configFilePath, 'utf8');
      expect(updatedConfig).not.toContain(`import { ${intName} } from '@mastra/${intName.toLowerCase()}'`);
      expect(updatedConfig).not.toContain(`new ${intName}(`);
    });
  });
});
