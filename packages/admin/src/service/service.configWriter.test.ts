import * as fs from 'fs';
import * as path from 'path';

import { ConfigWriterService } from './service.configWriter';

const configFilePath = path.join(__dirname, 'test.future.config.ts');
const exampleConfig = `
import { SomeOtherIntegration } from '@arkw/someotherintegration';

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
    it('should add a integration and import statement to the config file', async () => {
      const integrationName = 'RewatchIntegration';
      const config = `{
        config: {
          CLIENT_ID: 'test-client-id',
          CLIENT_SECRET: 'test-client-secret',
        },
      }`;
      const intImporter = `${integrationName}Integration`;

      await service.addIntegration(integrationName, config);

      const updatedConfig = fs.readFileSync(configFilePath, 'utf8');
      expect(updatedConfig).toContain(`import { ${intImporter} } from 'future-${integrationName.toLowerCase()}'`);
      expect(updatedConfig).toContain(`new ${intImporter}(${JSON.stringify(config, null, 2)})`);
    });
  });

  describe('removeIntegration', () => {
    it('should remove a integration and import statement from the config file', async () => {
      const intName = 'RewatchIntegration';

      await service.removeIntegration(intName);

      const updatedConfig = fs.readFileSync(configFilePath, 'utf8');
      expect(updatedConfig).not.toContain(`import { ${intName} } from 'future-${intName.toLowerCase()}'`);
      expect(updatedConfig).not.toContain(`new ${intName}(`);
    });
  });
});
