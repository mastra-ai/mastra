import { jest } from '@jest/globals';
import { vol } from 'memfs';


beforeEach(() => {
  vol.reset()
  jest.resetAllMocks()
})

jest.unstable_mockModule('./utils', () => ({
  checkDependencies: jest.fn(),
  checkInitialization: jest.fn(),
  writeIndexFile: jest.fn(),
  createComponentsDir: jest.fn(),
  writeAPIKey: jest.fn(),
  createMastraDir: jest.fn(),
  writeCodeSample: jest.fn()
}));

const utils = await import('./utils')
const { init } = await import('./init')


describe('init', () => {
  test('creates the mastra directory and components directories', async () => {
    const mockCheckDeps =jest.spyOn(utils, 'checkDependencies').mockResolvedValue('ok');
    const mockCheckInit = jest.spyOn(utils, 'checkInitialization').mockResolvedValue(false);
    const mockWriteIdx = jest.spyOn(utils, 'writeIndexFile').mockResolvedValue(undefined);
    const mockCreateCompDir = jest.spyOn(utils, 'createComponentsDir').mockResolvedValue(undefined);
    const mockWriteKey = jest.spyOn(utils, 'writeAPIKey').mockResolvedValue(undefined as never);
    const mockCreateDir = jest.spyOn(utils, 'createMastraDir').mockResolvedValue('/test/mastra');

    await init({
      directory: '/test',
      llmProvider: 'openai',
      addExample: false,
      components: ['agents', 'tools'],
    });

    expect(mockCheckDeps).toHaveBeenCalled();
    expect(mockCreateDir).toHaveBeenCalled();
    expect(mockCheckInit).toHaveBeenCalledWith('/test/mastra');
    expect(mockWriteIdx).toHaveBeenCalledWith('/test/mastra', false);
    expect(mockCreateCompDir).toHaveBeenCalledTimes(2);
    expect(mockWriteKey).toHaveBeenCalledWith('openai');
  });

});
