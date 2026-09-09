import { describe, expect, it } from 'vitest';

import { FACTORY_DOC_KINDS } from './catalog.js';
import { FactoryDocsManifestError, parseFactoryDocsManifestText, resolveFactoryDocsManifest } from './manifest.js';

describe('parseFactoryDocsManifestText', () => {
  it('parses the flat subset with comments and quotes', () => {
    const parsed = parseFactoryDocsManifestText(`
# factory docs
version: 1
documents:
  architecture: docs/factory/arch/overview.md   # trailing comment
  glossary: "docs/factory/glossary.md"
`);
    expect(parsed).toEqual({
      version: 1,
      documents: { architecture: 'docs/factory/arch/overview.md', glossary: 'docs/factory/glossary.md' },
    });
  });

  it('rejects nested mappings, orphan entries, and duplicate keys', () => {
    expect(() => parseFactoryDocsManifestText('documents:\n  architecture:\n    nested: x')).toThrow(
      FactoryDocsManifestError,
    );
    expect(() => parseFactoryDocsManifestText('  architecture: docs/factory/a.md')).toThrow(FactoryDocsManifestError);
    expect(() =>
      parseFactoryDocsManifestText('documents:\n  glossary: docs/factory/a.md\n  glossary: docs/factory/b.md'),
    ).toThrow(/duplicate key/);
  });
});

describe('resolveFactoryDocsManifest', () => {
  it('falls back to catalog defaults when the manifest is missing', () => {
    const resolved = resolveFactoryDocsManifest(null);
    expect(resolved.status).toBe('missing');
    expect(resolved.warnings).toEqual([]);
    for (const definition of FACTORY_DOC_KINDS) {
      expect(resolved.paths[definition.kind]).toBe(definition.defaultPath);
    }
  });

  it('overrides only the mapped kinds and keeps defaults for the rest', () => {
    const resolved = resolveFactoryDocsManifest('documents:\n  architecture: docs/factory/arch/system.md\n');
    expect(resolved.status).toBe('ok');
    expect(resolved.paths.architecture).toBe('docs/factory/arch/system.md');
    expect(resolved.paths.glossary).toBe('docs/factory/glossary.md');
  });

  it('ignores unknown kinds with a warning', () => {
    const resolved = resolveFactoryDocsManifest('documents:\n  roadmap: docs/factory/roadmap.md\n');
    expect(resolved.status).toBe('ok');
    expect(resolved.warnings).toEqual(['Manifest maps unknown document kind "roadmap"; ignored']);
  });

  it('rejects paths outside docs/factory or containing traversal', () => {
    for (const path of [
      'src/secrets.md',
      'docs/factory/../../etc/passwd',
      '/docs/factory/a.md',
      'docs/factory/a.txt',
    ]) {
      const resolved = resolveFactoryDocsManifest(`documents:\n  glossary: ${path}\n`);
      expect(resolved.status, path).toBe('invalid');
      expect(resolved.paths.glossary).toBe('docs/factory/glossary.md');
    }
  });

  it('treats unparseable text as invalid and keeps defaults', () => {
    const resolved = resolveFactoryDocsManifest('documents:\n  - architecture\n');
    expect(resolved.status).toBe('invalid');
    expect(resolved.warnings[0]).toMatch(/could not be parsed/);
    expect(resolved.paths.architecture).toBe('docs/factory/architecture.md');
  });

  it('rejects two kinds mapped to one file', () => {
    const resolved = resolveFactoryDocsManifest(
      'documents:\n  glossary: docs/factory/shared.md\n  personas: docs/factory/shared.md\n',
    );
    expect(resolved.status).toBe('invalid');
    expect(resolved.warnings.at(-1)).toMatch(/same file/);
  });

  it('rejects an override that steals another kind default file', () => {
    const resolved = resolveFactoryDocsManifest('documents:\n  glossary: docs/factory/personas.md\n');
    expect(resolved.status).toBe('invalid');
    expect(resolved.paths.glossary).toBe('docs/factory/glossary.md');
  });
});
