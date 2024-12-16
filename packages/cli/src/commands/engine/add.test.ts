import * as p from '@clack/prompts';
import { jest } from '@jest/globals';
import yoctoSpinner from 'yocto-spinner';

import { DepsService } from '../../services/service.deps.js';
import { DockerService } from '../../services/service.docker.js';
import { FileService } from '../../services/service.file.js';

import { add } from './add';

jest.mock('../../services/service.deps.js');
jest.mock('../../services/service.docker.js');
jest.mock('../../services/service.file.js');
jest.mock('@clack/prompts', () => ({
  confirm: jest.fn(),
  cancel: jest.fn(),
}));
jest.mock('yocto-spinner', () => {
  return jest.fn(() => ({
    start: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
  }));
});

describe('add', () => {
  let depsServiceMock: jest.Mocked<DepsService>;
  let dockerServiceMock: jest.Mocked<DockerService>;
  let fileServiceMock: jest.Mocked<FileService>;
  let spinnerMock: any;

  beforeEach(() => {
    depsServiceMock = new DepsService() as jest.Mocked<DepsService>;
    dockerServiceMock = new DockerService() as jest.Mocked<DockerService>;
    fileServiceMock = new FileService() as jest.Mocked<FileService>;

    spinnerMock = yoctoSpinner();

    (p.confirm as jest.Mock).mockResolvedValue(true);
  });

  it('should setup Mastra Engine successfully', async () => {
    depsServiceMock.getProjectName.mockResolvedValue('test-project');
    dockerServiceMock.provision.mockResolvedValue({ dbUrl: 'test-db-url' });

    await add();

    expect(spinnerMock.start).toHaveBeenCalled();
    expect(depsServiceMock.getProjectName).toHaveBeenCalled();
    expect(dockerServiceMock.provision).toHaveBeenCalledWith('test-project');
    expect(dockerServiceMock.startDockerContainer).toHaveBeenCalledWith('mastra-pg.docker-compose.yaml');
    expect(fileServiceMock.setupEnvFile).toHaveBeenCalledWith({ dbUrl: 'test-db-url' });
    expect(spinnerMock.success).toHaveBeenCalledWith('Dependencies installed successfully');
  });

  it('should handle installation cancellation', async () => {
    (p.confirm as jest.Mock).mockResolvedValue(false);

    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    await expect(add()).rejects.toThrow('process.exit called');

    expect(p.cancel).toHaveBeenCalledWith('Installation Cancelled');
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('should handle errors during setup', async () => {
    depsServiceMock.getProjectName.mockRejectedValue(new Error('Failed to get project name'));

    await expect(add()).rejects.toThrow('Failed to get project name');

    expect(spinnerMock.error).toHaveBeenCalledWith('Failed to start Mastra engine');
  });
});
