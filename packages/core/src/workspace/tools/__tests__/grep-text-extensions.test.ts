import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { WORKSPACE_TOOLS } from '../../constants';
import { LocalFilesystem } from '../../filesystem';
import { Workspace } from '../../workspace';
import { createWorkspaceTools } from '../tools';

// Template, lock and build files are plain text, but grep used to skip them
// because their extensions were missing from the built-in text set. (#28365)
describe('workspace grep over common template, lock and build files', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'grep-text-ext-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  async function grep(input: { pattern: string; path?: string }) {
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: tempDir }) });
    const tools = await createWorkspaceTools(workspace);
    return tools[WORKSPACE_TOOLS.FILESYSTEM.GREP].execute(input, { workspace });
  }

  it('finds markup in a Rails view template (#28365)', async () => {
    await fs.mkdir(path.join(tempDir, 'app', 'views'), { recursive: true });
    await fs.writeFile(
      path.join(tempDir, 'app', 'views', '_header.html.erb'),
      '<header>\n  <div class="panel"><%= title %></div>\n</header>\n',
    );

    const result = await grep({ pattern: 'class="panel"' });

    expect(result).toContain('app/views/_header.html.erb:2:8:');
    expect(result).toContain('1 match across 1 file');
  });

  it('searches an explicitly targeted .erb file instead of reporting it skipped (#28365)', async () => {
    await fs.writeFile(path.join(tempDir, 'show.html.erb'), '<div class="panel"></div>\n');

    const result = await grep({ pattern: 'class="panel"', path: 'show.html.erb' });

    expect(result).toContain('1 match across 1 file');
    expect(result).not.toContain('unsupported extension');
  });

  it('searches every template, lock and build format listed in the issue (#28365)', async () => {
    const files = [
      'view.html.erb',
      'card.hbs',
      'card.handlebars',
      'layout.haml',
      'layout.slim',
      'page.ejs',
      'partial.mustache',
      'email.jinja',
      'config.j2',
      'base.twig',
      'Index.cshtml',
      'app.gemspec',
      'yarn.lock',
      'Gemfile.lock',
      'Cargo.lock',
      'service.proto',
      'build.gradle',
      'app.properties',
    ];
    for (const file of files) {
      await fs.writeFile(path.join(tempDir, file), 'before\nneedle-28365\nafter\n');
    }

    const result = await grep({ pattern: 'needle-28365' });

    for (const file of files) {
      expect(result).toContain(`${file}:2:1: needle-28365`);
    }
    expect(result).toContain(`${files.length} matches across ${files.length} files`);
  });

  it('still skips binary formats such as images and archives', async () => {
    await fs.writeFile(path.join(tempDir, 'logo.png'), 'needle-28365');
    await fs.writeFile(path.join(tempDir, 'bundle.zip'), 'needle-28365');
    await fs.writeFile(path.join(tempDir, 'notes.txt'), 'needle-28365');

    const result = await grep({ pattern: 'needle-28365' });

    expect(result).toContain('notes.txt');
    expect(result).not.toContain('logo.png');
    expect(result).not.toContain('bundle.zip');
    expect(result).toContain('1 match across 1 file');
  });
});
