import type { StorageSkillFileNode } from '../../storage/types';
import type { SkillSource, SkillSourceEntry, SkillSourceStat } from './skill-source';

const ROOT_PATH = 'stored-skill';

interface StoredFileEntry {
  node: StorageSkillFileNode;
  content?: string | Buffer;
}

function validateNodeName(name: string): void {
  if (!name || name === '.' || name === '..' || name.includes('/') || name.includes('\\') || name.includes('\0')) {
    throw new Error(`Invalid stored skill file name: "${name}"`);
  }
}

function decodeBase64(content: string, path: string): Buffer {
  const canonicalBase64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
  if (!canonicalBase64.test(content)) {
    throw new Error(`Stored skill file "${path}" must contain valid base64 content in canonical form`);
  }

  const decoded = Buffer.from(content, 'base64');
  if (decoded.toString('base64') !== content) {
    throw new Error(`Stored skill file "${path}" must contain valid base64 content in canonical form`);
  }
  return decoded;
}

/** Exposes a stored file snapshot through the same source contract used by filesystem publication. */
export class StoredFilesSkillSource implements SkillSource {
  readonly rootPath = ROOT_PATH;
  private readonly entries = new Map<string, StoredFileEntry>();
  private readonly children = new Map<string, SkillSourceEntry[]>();

  constructor(files: StorageSkillFileNode[]) {
    this.children.set(ROOT_PATH, []);
    this.addNodes(files, ROOT_PATH);
  }

  private addNodes(nodes: StorageSkillFileNode[], parentPath: string): void {
    const parentChildren = this.children.get(parentPath)!;

    for (const node of nodes) {
      validateNodeName(node.name);
      const path = `${parentPath}/${node.name}`;
      if (this.entries.has(path)) {
        throw new Error(`Duplicate stored skill file path: "${path.slice(ROOT_PATH.length + 1)}"`);
      }

      if (node.type === 'folder') {
        if (node.content !== undefined || node.encoding !== undefined || node.mimeType !== undefined) {
          throw new Error(
            `Invalid stored skill folder node at "${path}": folders cannot have file content or metadata`,
          );
        }
        this.entries.set(path, { node });
        this.children.set(path, []);
        parentChildren.push({ name: node.name, type: 'directory' });
        this.addNodes(node.children ?? [], path);
        continue;
      }

      if (node.children !== undefined) {
        throw new Error(`Invalid stored skill file node at "${path}": files cannot have children`);
      }
      const stringContent = node.content ?? '';
      const content = node.encoding === 'base64' ? decodeBase64(stringContent, path) : stringContent;
      this.entries.set(path, { node, content });
      parentChildren.push({ name: node.name, type: 'file' });
    }
  }

  async exists(path: string): Promise<boolean> {
    return path === ROOT_PATH || this.entries.has(path);
  }

  async stat(path: string): Promise<SkillSourceStat> {
    const now = new Date(0);
    if (path === ROOT_PATH) {
      return { name: ROOT_PATH, type: 'directory', size: 0, createdAt: now, modifiedAt: now };
    }
    const entry = this.entries.get(path);
    if (!entry) throw new Error(`Stored skill path not found: "${path}"`);
    const isDirectory = entry.node.type === 'folder';
    const size = isDirectory
      ? 0
      : Buffer.isBuffer(entry.content)
        ? entry.content.length
        : Buffer.byteLength(entry.content ?? '', 'utf-8');
    return {
      name: entry.node.name,
      type: isDirectory ? 'directory' : 'file',
      size,
      createdAt: now,
      modifiedAt: now,
      mimeType: entry.node.mimeType,
      encoding: entry.node.encoding ?? 'utf-8',
    };
  }

  async readFile(path: string): Promise<string | Buffer> {
    const entry = this.entries.get(path);
    if (!entry || entry.node.type !== 'file') throw new Error(`Stored skill file not found: "${path}"`);
    return entry.content ?? '';
  }

  async readdir(path: string): Promise<SkillSourceEntry[]> {
    const entries = this.children.get(path);
    if (!entries) throw new Error(`Stored skill directory not found: "${path}"`);
    return entries.map(entry => ({ ...entry }));
  }
}
