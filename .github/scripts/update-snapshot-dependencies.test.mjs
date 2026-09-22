import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { updateSnapshotDependencies } from './update-snapshot-dependencies.mjs';

const workspacePackages = new Set(['@mastra/core', '@mastra/mcp', '@mastra/memory']);
const docsServerPath = 'packages/mcp-docs-server/package.json';

test('preserves the docs server compatibility pin to the published MCP API', () => {
  const content = readFileSync(new URL(`../../${docsServerPath}`, import.meta.url), 'utf8');
  const original = JSON.parse(content);
  const updated = JSON.parse(updateSnapshotDependencies(content, docsServerPath, workspacePackages));

  assert.equal(updated.dependencies['@mastra/mcp'], original.dependencies['@mastra/mcp']);
  assert.equal(updated.dependencies['@mastra/core'], 'workspace:*');
});

test('uses the workspace MCP when the docs server explicitly opts into it', () => {
  const content = JSON.stringify({ dependencies: { '@mastra/mcp': 'workspace:^' } });
  const updated = JSON.parse(updateSnapshotDependencies(content, docsServerPath, workspacePackages));

  assert.equal(updated.dependencies['@mastra/mcp'], 'workspace:*');
});

test('keeps other consumers on the snapshot workspace packages', () => {
  const content = JSON.stringify({
    dependencies: { '@mastra/mcp': '^1.18.0', '@internal/helpers': 'workspace:^' },
    devDependencies: { '@mastra/core': '^1.0.0' },
    peerDependencies: { '@mastra/memory': '>=1.0.0' },
  });
  const updated = JSON.parse(updateSnapshotDependencies(content, 'packages/consumer/package.json', workspacePackages));

  assert.equal(updated.dependencies['@mastra/mcp'], 'workspace:*');
  assert.equal(updated.dependencies['@internal/helpers'], 'workspace:*');
  assert.equal(updated.devDependencies['@mastra/core'], 'workspace:*');
  assert.equal(updated.peerDependencies['@mastra/memory'], 'workspace:*');
});

test('preserves dependencies published outside this workspace', () => {
  const content = JSON.stringify({
    dependencies: { '@mastra/docusaurus-plugin-mastra': '^1.0.0', zod: 'catalog:' },
  });

  assert.equal(updateSnapshotDependencies(content, 'docs/package.json', workspacePackages), content);
});

test('is safe to run more than once', () => {
  const content = JSON.stringify({ dependencies: { '@mastra/core': '^1.0.0', '@mastra/mcp': '^1.18.0' } });
  const updated = updateSnapshotDependencies(content, docsServerPath, workspacePackages);

  assert.equal(updateSnapshotDependencies(updated, docsServerPath, workspacePackages), updated);
});
