import { WorkflowStatusEnum } from '@mastra/core';
import * as fs from 'fs';
import * as path from 'path';

import { BlueprintWriterService } from './service.blueprintWriter';

const testDirectoryPath = path.join(__dirname, 'test_blueprints');
const exampleBlueprint1 = {
  id: 'blueprint1',
  title: 'New Workflow',
  description: null,
  status: WorkflowStatusEnum.UNPUBLISHED,
  actions: [
    {
      id: 'action1',
      type: 'CREATE_NOTE',
      payload: {
        title: 'babayaga',
      },
      subActions: [
        {
          id: 'action2',
          type: 'CREATE_TASK',
          payload: {
            name: 'some random task',
            dueDate: '2024-08-02T15:37:06.384Z',
            description: '',
          },
          subActions: [],
          parentActionId: 'action1',
        },
      ],
    },
  ],
  trigger: {
    id: 'trigger-id',
    type: 'RECORD_UPDATED',
    payload: {
      value: {
        entityType: 'companies',
      },
    },
  },
};
const exampleBlueprint2 = {
  id: 'blueprint2',
  title: 'Worksheet Sync',
  description: 'Actions that happen after a worksheet is synced',
  status: WorkflowStatusEnum.PUBLISHED,
  trigger: {
    id: 'trigger-id-2',
    type: 'RECORD_UPDATED',
    payload: {
      value: {
        entityType: 'companies',
      },
    },
  },
  actions: [
    {
      id: 'action-id-2',
      type: 'BULK_ENRICH_RECORD',
      payload: {},
      variables: {},
      subActions: [],
    },
  ],
};

describe('BlueprintWriterService', () => {
  let service: BlueprintWriterService;

  beforeAll(() => {
    // Create test directory and write example Blueprint files before running tests
    if (!fs.existsSync(testDirectoryPath)) {
      fs.mkdirSync(testDirectoryPath);
    }
    fs.writeFileSync(
      path.join(testDirectoryPath, 'blueprint1.json'),
      JSON.stringify(exampleBlueprint1, null, 2),
      'utf8',
    );
    service = new BlueprintWriterService(testDirectoryPath);
  });

  afterAll(() => {
    // Clean up the test directory and files after tests
    fs.readdirSync(testDirectoryPath).forEach(file => {
      fs.unlinkSync(path.join(testDirectoryPath, file));
    });
    fs.rmdirSync(testDirectoryPath);
  });

  describe('readJsonFile', () => {
    it('should read a Blueprint file and return its content', async () => {
      const data = await service.readBlueprint(path.join(testDirectoryPath, 'blueprint1.json'));
      expect(data).toEqual(exampleBlueprint1);
    });
  });

  describe('writeJsonFile', () => {
    it('should write a Blueprint file', async () => {
      const filePath = path.join(testDirectoryPath, 'blueprint2.json');
      await service.writeBlueprint(filePath, exampleBlueprint2);
      const writtenData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      expect(writtenData).toEqual(exampleBlueprint2);
    });
  });

  describe('listJsonFiles', () => {
    it('should list Blureprint files with their file paths and data', async () => {
      const result = await service.getBlueprints();
      expect(result).toEqual([exampleBlueprint1, exampleBlueprint2]);
    });
  });

  describe('deleteBlueprint', () => {
    it('should delete a Blueprint file', async () => {
      const filePath = path.join(testDirectoryPath, 'blueprint2.json');
      // Ensure the file exists before deletion
      expect(fs.existsSync(filePath)).toBe(true);

      await service.deleteBlueprint(filePath);

      // Check that the file has been deleted
      expect(fs.existsSync(filePath)).toBe(false);
    });
  });
});
