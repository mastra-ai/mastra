import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, it, expect, afterAll, afterEach } from 'vitest';
import { sharedFileEditor } from '../file-editor.js';

const projectRoot = path.resolve(import.meta.dirname, '../../..');
const tmpDir = path.join(projectRoot, '.test-tmp-editor');

function tmpFile(name: string): string {
  return path.join(tmpDir, name);
}

function writeTmpFile(name: string, content: string): string {
  const filePath = tmpFile(name);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

afterEach(() => {
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

afterAll(() => {
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

describe('FileEditor.strReplace whitespace-agnostic matching', () => {
  it('matches when old_str uses spaces but file uses tabs', async () => {
    const filePath = writeTmpFile(
      'tabs-vs-spaces.ts',
      `function hello() {\n\tconst x = 1\n\tconst y = 2\n\treturn x + y\n}\n`,
    );

    const result = await sharedFileEditor.strReplace({
      path: filePath,
      old_str: `function hello() {\n    const x = 1\n    const y = 2\n    return x + y\n}`,
      new_str: `function hello() {\n\tconst x = 10\n\tconst y = 20\n\treturn x + y\n}`,
    });

    expect(result).toContain('has been edited');
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('const x = 10');
    expect(content).toContain('const y = 20');
  });

  it('matches multi-line blocks with mixed indentation (tabs in file, spaces in old_str)', async () => {
    const filePath = writeTmpFile(
      'mixed-indent.ts',
      [
        '\tprivate renderTasks(',
        '\t\ttasks: TaskItem[],',
        '\t\tinsertIndex = -1,',
        '\t): void {',
        '\t\tconst MAX_VISIBLE = 4',
        '\t\tconst visible = tasks.slice(0, MAX_VISIBLE)',
        '',
        '\t\tif (insertIndex >= 0) {',
        '\t\t\tthis.container.splice(insertIndex, 0)',
        '\t\t} else {',
        '\t\t\tthis.container.push()',
        '\t\t}',
        '\t}',
        '',
      ].join('\n'),
    );

    const result = await sharedFileEditor.strReplace({
      path: filePath,
      old_str: [
        '    private renderTasks(',
        '        tasks: TaskItem[],',
        '        insertIndex = -1,',
        '    ): void {',
        '        const MAX_VISIBLE = 4',
        '        const visible = tasks.slice(0, MAX_VISIBLE)',
        '',
        '        if (insertIndex >= 0) {',
      ].join('\n'),
      new_str: [
        '\tprivate renderTasks(',
        '\t\ttasks: TaskItem[],',
        '\t\tinsertIndex = -1,',
        '\t\tcollapsed = false,',
        '\t): void {',
        '\t\tconst MAX_VISIBLE = 4',
        '\t\tconst visible = collapsed ? tasks.slice(0, MAX_VISIBLE) : tasks',
        '',
        '\t\tif (insertIndex >= 0) {',
      ].join('\n'),
    });

    expect(result).toContain('has been edited');
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('collapsed = false');
    expect(content).toContain('collapsed ? tasks.slice');
  });

  it('matches when old_str has different amounts of whitespace than file', async () => {
    const filePath = writeTmpFile('extra-spaces.ts', `if (  x  ===  true  ) {\n    doSomething()\n}\n`);

    const result = await sharedFileEditor.strReplace({
      path: filePath,
      old_str: `if (x === true) {\n    doSomething()\n}`,
      new_str: `if (x === false) {\n    doSomething()\n}`,
    });

    expect(result).toContain('has been edited');
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('false');
  });

  it('exact match still takes priority over whitespace-normalized match', async () => {
    const filePath = writeTmpFile('exact-priority.ts', `const a = 1\nconst b = 2\nconst c = 3\n`);

    const result = await sharedFileEditor.strReplace({
      path: filePath,
      old_str: `const b = 2`,
      new_str: `const b = 99`,
    });

    expect(result).toContain('has been edited');
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('const b = 99');
    // Other lines untouched
    expect(content).toContain('const a = 1');
    expect(content).toContain('const c = 3');
  });
  it('uses new_str as-is without reindenting when whitespace-agnostic match', async () => {
    // File uses tabs
    const filePath = writeTmpFile(
      'no-reindent.ts',
      ['class Foo {', '\tprivate bar() {', '\t\tconst x = 1', '\t\treturn x', '\t}', '}', ''].join('\n'),
    );

    // old_str uses spaces (won't exact-match), new_str uses tabs
    const result = await sharedFileEditor.strReplace({
      path: filePath,
      old_str: ['    private bar() {', '        const x = 1', '        return x', '    }'].join('\n'),
      new_str: ['\tprivate bar() {', '\t\tconst x = 1', '\t\tconst y = 2', '\t\treturn x + y', '\t}'].join('\n'),
    });

    expect(result).toContain('has been edited');
    const content = fs.readFileSync(filePath, 'utf-8');
    // new_str used as-is (tabs)
    expect(content).toContain('\t\tconst y = 2');
    expect(content).toContain('\t\treturn x + y');
  });

  it('handles a realistic 30+ line block with tab/space mismatch', async () => {
    // Simulate a real file with tabs
    const fileLines: string[] = [];
    for (let i = 0; i < 50; i++) {
      fileLines.push(`\tline${i}: ${i},`);
    }
    const filePath = writeTmpFile('large-block.ts', `const obj = {\n${fileLines.join('\n')}\n}\n`);

    // old_str with spaces instead of tabs, targeting lines 10-40
    const oldLines: string[] = [];
    for (let i = 10; i < 40; i++) {
      oldLines.push(`    line${i}: ${i},`);
    }

    const newLines: string[] = [];
    for (let i = 10; i < 40; i++) {
      newLines.push(`\tline${i}: ${i * 10},`);
    }

    const result = await sharedFileEditor.strReplace({
      path: filePath,
      old_str: oldLines.join('\n'),
      new_str: newLines.join('\n'),
    });

    expect(result).toContain('has been edited');
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('line10: 100,');
    expect(content).toContain('line39: 390,');
    // Untouched lines
    expect(content).toContain('line0: 0,');
    expect(content).toContain('line49: 49,');
  });
});
