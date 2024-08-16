import * as fs from 'fs';
import * as path from 'path';

import { ConfigWriterService } from './service.configWriter';

const configFilePath = path.join(__dirname, 'test.future.config.ts');
const exampleConfig = `
import { SomeOtherPlugin } from 'future-someotherplugin';

const config = {
  plugins: [
    new SomeOtherPlugin({}),
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

  describe('addPlugin', () => {
    it('should add a plugin and import statement to the config file', async () => {
      const pluginName = 'RewatchIntegration';
      const pluginConfig = {
        config: {
          CLIENT_ID: 'test-client-id',
          CLIENT_SECRET: 'test-client-secret',
        },
      };

      await service.addPlugin(pluginName, pluginConfig);

      const updatedConfig = fs.readFileSync(configFilePath, 'utf8');
      expect(updatedConfig).toContain(`import { ${pluginName} } from 'future-${pluginName.toLowerCase()}'`);
      expect(updatedConfig).toContain(`new ${pluginName}(${JSON.stringify(pluginConfig, null, 2)})`);
    });
  });

  describe('removePlugin', () => {
    it('should remove a plugin and import statement from the config file', async () => {
      const pluginName = 'RewatchIntegration';

      await service.removePlugin(pluginName);

      const updatedConfig = fs.readFileSync(configFilePath, 'utf8');
      expect(updatedConfig).not.toContain(`import { ${pluginName} } from 'future-${pluginName.toLowerCase()}'`);
      expect(updatedConfig).not.toContain(`new ${pluginName}(`);
    });
  });
});
