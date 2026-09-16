import fs from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';

const { writeFile, rename, rm } = fs;
let writes = 0;
let renames = 0;
fs.writeFile = async (path, ...args) => {
  if (String(path).includes('.mastra-mcp-') && ++writes === 2 && process.env.MCP_TEST_FS_FAULT === 'stage') {
    throw new Error('SENTINEL_DISK_SECRET');
  }
  return writeFile(path, ...args);
};
fs.rename = async (...args) => {
  if (++renames === 2 && process.env.MCP_TEST_FS_FAULT === 'rename') throw new Error('SENTINEL_RENAME_SECRET');
  return rename(...args);
};
fs.rm = async (path, ...args) => {
  if (String(path).includes('.mastra-mcp-') && process.env.MCP_TEST_FS_FAULT === 'cleanup')
    throw new Error('SENTINEL_CLEANUP_SECRET');
  return rm(path, ...args);
};
syncBuiltinESMExports();
