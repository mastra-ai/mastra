import * as e2bTools from './e2b';
import * as daytonaTools from './daytona/tools';

function getProvider() {
  if (process.env.DAYTONA_API_KEY) {
    return 'daytona';
  } else if (process.env.E2B_API_KEY) {
    return 'e2b';
  } else {
    throw new Error(
      'No sandbox provider configured. Please set either DAYTONA_API_KEY or E2B_API_KEY environment variable.',
    );
  }
}

const provider = getProvider();

// Helper function to select the right tool (bundler can inline this)
// Using 'as any' because E2B and Daytona have slightly different schemas
const selectTool = (daytonaTool: any, e2bTool: any) => (provider === 'daytona' ? daytonaTool : e2bTool);

export const createSandbox = selectTool(daytonaTools.createSandbox, e2bTools.createSandbox);
export const runCode = selectTool(daytonaTools.runCode, e2bTools.runCode);
export const readFile = selectTool(daytonaTools.readFile, e2bTools.readFile);
export const writeFile = selectTool(daytonaTools.writeFile, e2bTools.writeFile);
export const writeFiles = selectTool(daytonaTools.writeFiles, e2bTools.writeFiles);
export const listFiles = selectTool(daytonaTools.listFiles, e2bTools.listFiles);
export const deleteFile = selectTool(daytonaTools.deleteFile, e2bTools.deleteFile);
export const createDirectory = selectTool(daytonaTools.createDirectory, e2bTools.createDirectory);
export const getFileInfo = selectTool(daytonaTools.getFileInfo, e2bTools.getFileInfo);
export const checkFileExists = selectTool(daytonaTools.checkFileExists, e2bTools.checkFileExists);
export const getFileSize = selectTool(daytonaTools.getFileSize, e2bTools.getFileSize);
export const watchDirectory = selectTool(daytonaTools.watchDirectory, e2bTools.watchDirectory);
export const runCommand = selectTool(daytonaTools.runCommand, e2bTools.runCommand);
