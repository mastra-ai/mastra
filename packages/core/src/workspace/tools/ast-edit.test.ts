import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { WORKSPACE_TOOLS } from '../constants';
import { LocalFilesystem } from '../filesystem';
import { Workspace } from '../workspace';
import { isAstGrepAvailable } from './ast-edit';
import { createWorkspaceTools } from './tools';

// Skip all tests if @ast-grep/napi is not installed
const describeIfAstGrep = isAstGrepAvailable() ? describe : describe.skip;

describeIfAstGrep('workspace_ast_edit', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workspace-ast-edit-test-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  // ===========================================================================
  // Tool Creation
  // ===========================================================================
  describe('tool creation', () => {
    it('should create ast_edit tool when filesystem is available and ast-grep installed', () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });

      const tools = createWorkspaceTools(workspace);

      expect(tools).toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.AST_EDIT);
    });

    it('should not create ast_edit tool when filesystem is read-only', () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir, readOnly: true }),
      });

      const tools = createWorkspaceTools(workspace);

      expect(tools).not.toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.AST_EDIT);
    });

    it('should not create ast_edit tool when disabled via config', () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
        tools: {
          [WORKSPACE_TOOLS.FILESYSTEM.AST_EDIT]: { enabled: false },
        },
      });

      const tools = createWorkspaceTools(workspace);

      expect(tools).not.toHaveProperty(WORKSPACE_TOOLS.FILESYSTEM.AST_EDIT);
    });
  });

  // ===========================================================================
  // Pattern Replace
  // ===========================================================================
  describe('pattern replace', () => {
    it('should replace pattern with metavariable substitution', async () => {
      const code = `console.log("hello");\nconsole.log("world");`;
      await fs.writeFile(path.join(tempDir, 'test.ts'), code);

      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.AST_EDIT].execute({
        path: '/test.ts',
        pattern: 'console.log($ARG)',
        replacement: 'logger.debug($ARG)',
      });

      expect(result).toContain('2 occurrences');

      const content = await fs.readFile(path.join(tempDir, 'test.ts'), 'utf-8');
      expect(content).toContain('logger.debug("hello")');
      expect(content).toContain('logger.debug("world")');
      expect(content).not.toContain('console.log');
    });

    it('should indicate no changes when pattern not found', async () => {
      const code = `const x = 1;`;
      await fs.writeFile(path.join(tempDir, 'test.ts'), code);

      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.AST_EDIT].execute({
        path: '/test.ts',
        pattern: 'console.log($ARG)',
        replacement: 'logger.debug($ARG)',
      });

      expect(result).toContain('No changes');
      expect(result).toContain('0 occurrences');
    });

    it('should error when neither transform nor pattern provided', async () => {
      await fs.writeFile(path.join(tempDir, 'test.ts'), 'const x = 1;');

      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.AST_EDIT].execute({
        path: '/test.ts',
      });

      expect(result).toContain('Must provide');
    });
  });

  // ===========================================================================
  // Add Import
  // ===========================================================================
  describe('add-import transform', () => {
    it('should add named import after last existing import', async () => {
      const code = `import { foo } from 'bar';\n\nconst x = 1;`;
      await fs.writeFile(path.join(tempDir, 'test.ts'), code);

      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.AST_EDIT].execute({
        path: '/test.ts',
        transform: 'add-import',
        importSpec: { module: 'react', names: ['useState', 'useEffect'] },
      });

      expect(result).toContain('react');
      expect(result).not.toContain('No changes');

      const content = await fs.readFile(path.join(tempDir, 'test.ts'), 'utf-8');
      expect(content).toContain("import { useState, useEffect } from 'react';");
    });

    it('should add default import', async () => {
      const code = `const x = 1;`;
      await fs.writeFile(path.join(tempDir, 'test.ts'), code);

      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.AST_EDIT].execute({
        path: '/test.ts',
        transform: 'add-import',
        importSpec: { module: 'react', names: ['React'], isDefault: true },
      });

      expect(result).not.toContain('No changes');

      const content = await fs.readFile(path.join(tempDir, 'test.ts'), 'utf-8');
      expect(content).toContain("import React from 'react';");
    });

    it('should not duplicate existing import', async () => {
      const code = `import { useState } from 'react';\n\nconst x = 1;`;
      await fs.writeFile(path.join(tempDir, 'test.ts'), code);

      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.AST_EDIT].execute({
        path: '/test.ts',
        transform: 'add-import',
        importSpec: { module: 'react', names: ['useState'] },
      });

      expect(result).toContain('No changes');
    });

    it('should merge named import into existing import with aliases', async () => {
      const code = `import { foo as bar } from 'utils';\n\nconst x = 1;`;
      await fs.writeFile(path.join(tempDir, 'test.ts'), code);

      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.AST_EDIT].execute({
        path: '/test.ts',
        transform: 'add-import',
        importSpec: { module: 'utils', names: ['baz'] },
      });

      expect(result).not.toContain('No changes');

      const content = await fs.readFile(path.join(tempDir, 'test.ts'), 'utf-8');
      expect(content).toContain('foo as bar');
      expect(content).toContain('baz');
    });

    it('should add default import with additional named imports', async () => {
      const code = `const x = 1;`;
      await fs.writeFile(path.join(tempDir, 'test.ts'), code);

      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.AST_EDIT].execute({
        path: '/test.ts',
        transform: 'add-import',
        importSpec: { module: 'express', names: ['express', 'Router', 'Request'], isDefault: true },
      });

      expect(result).not.toContain('No changes');

      const content = await fs.readFile(path.join(tempDir, 'test.ts'), 'utf-8');
      expect(content).toContain("import express, { Router, Request } from 'express';");
    });

    it('should insert new value import when only a type-only import exists', async () => {
      const code = `import type { Foo } from 'utils';\n\nconst x = 1;`;
      await fs.writeFile(path.join(tempDir, 'test.ts'), code);

      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.AST_EDIT].execute({
        path: '/test.ts',
        transform: 'add-import',
        importSpec: { module: 'utils', names: ['bar'] },
      });

      expect(result).not.toContain('No changes');

      const content = await fs.readFile(path.join(tempDir, 'test.ts'), 'utf-8');
      // Original type import preserved, new value import added
      expect(content).toContain("import type { Foo } from 'utils';");
      expect(content).toContain("import { bar } from 'utils';");
    });

    it('should insert new value import when only a namespace import exists', async () => {
      const code = `import * as utils from 'utils';\n\nconst x = 1;`;
      await fs.writeFile(path.join(tempDir, 'test.ts'), code);

      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.AST_EDIT].execute({
        path: '/test.ts',
        transform: 'add-import',
        importSpec: { module: 'utils', names: ['bar'] },
      });

      expect(result).not.toContain('No changes');

      const content = await fs.readFile(path.join(tempDir, 'test.ts'), 'utf-8');
      // Original namespace import preserved, new named import added
      expect(content).toContain("import * as utils from 'utils';");
      expect(content).toContain("import { bar } from 'utils';");
    });

    it('should error when importSpec missing', async () => {
      await fs.writeFile(path.join(tempDir, 'test.ts'), 'const x = 1;');

      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.AST_EDIT].execute({
        path: '/test.ts',
        transform: 'add-import',
      });

      expect(result).toContain('importSpec');
    });
  });

  // ===========================================================================
  // Remove Import
  // ===========================================================================
  describe('remove-import transform', () => {
    it('should remove import by module name', async () => {
      const code = `import { useState } from 'react';\nimport { z } from 'zod';\n\nconst x = 1;`;
      await fs.writeFile(path.join(tempDir, 'test.ts'), code);

      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.AST_EDIT].execute({
        path: '/test.ts',
        transform: 'remove-import',
        targetName: 'zod',
      });

      expect(result).not.toContain('No changes');
      expect(result).toContain('zod');

      const content = await fs.readFile(path.join(tempDir, 'test.ts'), 'utf-8');
      expect(content).not.toContain('zod');
      expect(content).toContain("import { useState } from 'react';");
    });

    it('should error when targetName missing', async () => {
      await fs.writeFile(path.join(tempDir, 'test.ts'), 'const x = 1;');

      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.AST_EDIT].execute({
        path: '/test.ts',
        transform: 'remove-import',
      });

      expect(result).toContain('targetName');
    });
  });

  // ===========================================================================
  // Rename
  // ===========================================================================
  describe('rename transform', () => {
    it('should rename function declaration and call sites', async () => {
      const code = `function greet(name: string) {\n  return "Hello " + name;\n}\n\ngreet("world");\ngreet("foo");`;
      await fs.writeFile(path.join(tempDir, 'test.ts'), code);

      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.AST_EDIT].execute({
        path: '/test.ts',
        transform: 'rename',
        targetName: 'greet',
        newName: 'sayHello',
      });

      expect(result).toContain('occurrences');
      expect(result).not.toContain('No changes');

      const content = await fs.readFile(path.join(tempDir, 'test.ts'), 'utf-8');
      expect(content).toContain('function sayHello');
      expect(content).toContain('sayHello("world")');
      expect(content).toContain('sayHello("foo")');
      expect(content).not.toMatch(/\bgreet\b/);
    });

    it('should rename variable declarations and all references', async () => {
      const code = `const count = 0;\nconst total = count + 1;\nconsole.log(count);`;
      await fs.writeFile(path.join(tempDir, 'test.ts'), code);

      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.AST_EDIT].execute({
        path: '/test.ts',
        transform: 'rename',
        targetName: 'count',
        newName: 'counter',
      });

      expect(result).toContain('occurrences');
      expect(result).not.toContain('No changes');

      const content = await fs.readFile(path.join(tempDir, 'test.ts'), 'utf-8');
      expect(content).toContain('const counter = 0');
      expect(content).toContain('counter + 1');
      expect(content).toContain('console.log(counter)');
      // 'count' appears as substring of 'counter', so use word boundary check
      expect(content).not.toMatch(/\bcount\b/);
    });

    it('should error when targetName or newName missing', async () => {
      await fs.writeFile(path.join(tempDir, 'test.ts'), 'function foo() {}');

      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.AST_EDIT].execute({
        path: '/test.ts',
        transform: 'rename',
        targetName: 'foo',
      });

      expect(result).toContain('newName');
    });
  });

  // ===========================================================================
  // Language Detection
  // ===========================================================================
  describe('language detection', () => {
    it('should handle JavaScript files', async () => {
      const code = `console.log("hello");`;
      await fs.writeFile(path.join(tempDir, 'test.js'), code);

      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.AST_EDIT].execute({
        path: '/test.js',
        pattern: 'console.log($ARG)',
        replacement: 'logger.info($ARG)',
      });

      expect(result).not.toContain('No changes');
    });

    it('should handle TSX files with JSX syntax', async () => {
      const code = `const App = () => <div>hello</div>;`;
      await fs.writeFile(path.join(tempDir, 'test.tsx'), code);

      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.AST_EDIT].execute({
        path: '/test.tsx',
        transform: 'rename',
        targetName: 'App',
        newName: 'MyApp',
      });

      expect(result).not.toContain('No changes');
      const content = await fs.readFile(path.join(tempDir, 'test.tsx'), 'utf-8');
      expect(content).toContain('MyApp');
    });

    it('should handle JSX files with JSX syntax', async () => {
      const code = `const App = () => <div>hello</div>;`;
      await fs.writeFile(path.join(tempDir, 'test.jsx'), code);

      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.AST_EDIT].execute({
        path: '/test.jsx',
        transform: 'rename',
        targetName: 'App',
        newName: 'MyApp',
      });

      expect(result).not.toContain('No changes');
      const content = await fs.readFile(path.join(tempDir, 'test.jsx'), 'utf-8');
      expect(content).toContain('MyApp');
    });

    it('should handle CSS files', async () => {
      await fs.writeFile(path.join(tempDir, 'test.css'), '.foo { color: red; }');

      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.AST_EDIT].execute({
        path: '/test.css',
        pattern: '.foo {}',
        replacement: '.bar {}',
      });

      // CSS grammar is recognized — the key thing is it doesn't error with "Unsupported file type"
      expect(result).not.toContain('Unsupported file type');
    });

    it('should handle HTML files', async () => {
      const code = `<div class="foo">hello</div>`;
      await fs.writeFile(path.join(tempDir, 'test.html'), code);

      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.AST_EDIT].execute({
        path: '/test.html',
        pattern: '<div class="foo">$CONTENT</div>',
        replacement: '<section class="foo">$CONTENT</section>',
      });

      // HTML pattern matching may not match depending on ast-grep's HTML grammar;
      // the key thing is it doesn't error with "Unsupported file type"
      expect(result).not.toContain('Unsupported file type');
    });

    it('should return error for unsupported file types', async () => {
      await fs.writeFile(path.join(tempDir, 'test.py'), 'print("hello")');

      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.AST_EDIT].execute({
        path: '/test.py',
        pattern: 'print($ARG)',
        replacement: 'log($ARG)',
      });

      expect(result).toContain('Unsupported file type');
    });
  });

  // ===========================================================================
  // Error Cases
  // ===========================================================================
  describe('error handling', () => {
    it('should return error message for non-existent file', async () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: tempDir }),
      });
      const tools = createWorkspaceTools(workspace);

      const result = await tools[WORKSPACE_TOOLS.FILESYSTEM.AST_EDIT].execute({
        path: '/nonexistent.ts',
        pattern: 'foo',
        replacement: 'bar',
      });

      expect(result).toContain('File not found');
      expect(result).toContain('write_file');
    });
  });
});
