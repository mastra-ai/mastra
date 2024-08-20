import * as fs from 'fs';
import * as path from 'path';

import { FileEnvService } from './service.fileEnv';

const envFilePath = path.join(__dirname, 'test.env');
const exampleEnv = `
MY_ENV_VAR=test_value
`;

describe('FileEnvService', () => {
  let service: FileEnvService;

  beforeAll(() => {
    // Write the example env to the file before running tests
    fs.writeFileSync(envFilePath, exampleEnv, 'utf8');
    service = new FileEnvService(envFilePath);
  });

  afterAll(() => {
    // Clean up the env file after tests
    fs.unlinkSync(envFilePath);
  });

  describe('getEnvValue', () => {
    it('should get the value of an existing environment variable', async () => {
      const value = await service.getEnvValue('MY_ENV_VAR');
      expect(value).toBe('test_value');
    });

    it('should return null for a non-existing environment variable', async () => {
      const value = await service.getEnvValue('NON_EXISTENT_VAR');
      expect(value).toBeNull();
    });
  });

  describe('setEnvValue', () => {
    it('should set the value of an existing environment variable', async () => {
      await service.setEnvValue('MY_ENV_VAR', 'new_value');
      const updatedValue = await service.getEnvValue('MY_ENV_VAR');
      expect(updatedValue).toBe('new_value');
    });

    it('should add a new environment variable if it does not exist', async () => {
      await service.setEnvValue('NEW_ENV_VAR', 'new_value');
      const newValue = await service.getEnvValue('NEW_ENV_VAR');
      expect(newValue).toBe('new_value');
    });
  });
});
