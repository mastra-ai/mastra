import type { ReactNode } from 'react';
import { useCallback, useRef, useState } from 'react';
import { v4 as uuid } from '@lukeed/uuid';
import { File, FileCode, FileJson, FileText, Folder, FolderOpen, FolderPlus, Image, Plus, Trash2 } from 'lucide-react';

import { Tree } from '@/ds/components/Tree/tree';
import { IconButton } from '@/ds/components/IconButton';
import { TooltipProvider } from '@/ds/components/Tooltip';

import type { InMemoryFileNode } from '../agent-edit-page/utils/form-validation';

export interface SkillFileTreeProps {
  files: InMemoryFileNode[];
  onChange: (files: InMemoryFileNode[]) => void;
  selectedFileId: string | null;
  onSelectFile: (id: string | null) => void;
  readOnly?: boolean;
}

// Well-known IDs for structural nodes
const STRUCTURAL_IDS = new Set(['root', 'skill-md', 'license-md', 'references', 'scripts', 'assets']);

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function createInitialStructure(name: string): InMemoryFileNode[] {
  const slug = slugify(name) || 'untitled';
  return [
    {
      id: 'root',
      name: slug,
      type: 'folder',
      children: [
        { id: 'skill-md', name: 'SKILL.md', type: 'file', content: '' },
        { id: 'license-md', name: 'LICENSE.md', type: 'file', content: '' },
        { id: 'references', name: 'references', type: 'folder', children: [] },
        { id: 'scripts', name: 'scripts', type: 'folder', children: [] },
        { id: 'assets', name: 'assets', type: 'folder', children: [] },
      ],
    },
  ];
}

export function updateRootFolderName(files: InMemoryFileNode[], name: string): InMemoryFileNode[] {
  const slug = slugify(name) || 'untitled';
  return files.map(node => (node.id === 'root' ? { ...node, name: slug } : node));
}

export function extractSkillInstructions(files: InMemoryFileNode[]): string {
  const root = files.find(n => n.id === 'root');
  if (!root?.children) return '';
  const skillMd = root.children.find(n => n.id === 'skill-md');
  return skillMd?.content ?? '';
}

export function extractSkillLicense(files: InMemoryFileNode[]): string | undefined {
  const root = files.find(n => n.id === 'root');
  if (!root?.children) return undefined;
  const licenseMd = root.children.find(n => n.id === 'license-md');
  const content = licenseMd?.content?.trim();
  return content || undefined;
}

export function isImageContent(content: string | undefined): boolean {
  return !!content && content.startsWith('data:image/');
}

function getFileIcon(name: string): ReactNode {
  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
      return <FileCode className="text-blue-400" />;
    case 'json':
      return <FileJson className="text-yellow-400" />;
    case 'md':
    case 'mdx':
      return <FileText className="text-neutral4" />;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'webp':
      return <Image className="text-purple-400" />;
    default:
      return <File className="text-neutral4" />;
  }
}

function getFolderIcon(isOpen: boolean): ReactNode {
  return isOpen ? <FolderOpen className="text-amber-400" /> : <Folder className="text-amber-400" />;
}

function insertNode(nodes: InMemoryFileNode[], parentId: string, newNode: InMemoryFileNode): InMemoryFileNode[] {
  return nodes.map(node => {
    if (node.id === parentId && node.type === 'folder') {
      return { ...node, children: [...(node.children ?? []), newNode] };
    }
    if (node.children) {
      return { ...node, children: insertNode(node.children, parentId, newNode) };
    }
    return node;
  });
}

function removeNode(nodes: InMemoryFileNode[], nodeId: string): InMemoryFileNode[] {
  return nodes
    .filter(node => node.id !== nodeId)
    .map(node => {
      if (node.children) {
        return { ...node, children: removeNode(node.children, nodeId) };
      }
      return node;
    });
}

function findNodeById(nodes: InMemoryFileNode[], id: string): InMemoryFileNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

function containsNode(nodes: InMemoryFileNode[], targetId: string): boolean {
  for (const node of nodes) {
    if (node.id === targetId) return true;
    if (node.children && containsNode(node.children, targetId)) return true;
  }
  return false;
}

export function updateNodeContent(nodes: InMemoryFileNode[], nodeId: string, content: string): InMemoryFileNode[] {
  return nodes.map(node => {
    if (node.id === nodeId) {
      return { ...node, content };
    }
    if (node.children) {
      return { ...node, children: updateNodeContent(node.children, nodeId, content) };
    }
    return node;
  });
}

function FolderAddAction({ tooltip, onClick }: { tooltip: string; onClick: () => void }) {
  return (
    <span className="opacity-0 group-hover:opacity-100">
      <IconButton size="sm" variant="ghost" tooltip={tooltip} onClick={onClick}>
        <Plus />
      </IconButton>
    </span>
  );
}

function FolderActions({ onAddFile, onAddFolder }: { onAddFile: () => void; onAddFolder: () => void }) {
  return (
    <span className="flex opacity-0 group-hover:opacity-100">
      <IconButton size="sm" variant="ghost" tooltip="New file" onClick={onAddFile}>
        <Plus />
      </IconButton>
      <IconButton size="sm" variant="ghost" tooltip="New folder" onClick={onAddFolder}>
        <FolderPlus />
      </IconButton>
    </span>
  );
}

function FileDeleteAction({ nodeId, onRemove }: { nodeId: string; onRemove: (id: string) => void }) {
  return (
    <span className="ml-auto shrink-0 opacity-0 group-hover:opacity-100">
      <IconButton
        size="sm"
        variant="ghost"
        tooltip="Delete file"
        onClick={e => {
          e.stopPropagation();
          onRemove(nodeId);
        }}
      >
        <Trash2 />
      </IconButton>
    </span>
  );
}

function UserNodeList({
  nodes,
  readOnly,
  openFolders,
  pendingInput,
  onRemove,
  onAddFile,
  onAddFolder,
  onFolderOpenChange,
  onInputSubmit,
  onInputCancel,
}: {
  nodes: InMemoryFileNode[];
  readOnly?: boolean;
  openFolders: Record<string, boolean>;
  pendingInput: PendingInput | null;
  onRemove: (id: string) => void;
  onAddFile: (parentId: string) => void;
  onAddFolder: (parentId: string) => void;
  onFolderOpenChange: (folderId: string, open: boolean) => void;
  onInputSubmit: (name: string) => void;
  onInputCancel: () => void;
}) {
  return nodes
    .filter(n => !STRUCTURAL_IDS.has(n.id))
    .map(node => {
      if (node.type === 'folder') {
        const isOpen = openFolders[node.id] ?? true;
        return (
          <Tree.Folder key={node.id} open={isOpen} onOpenChange={open => onFolderOpenChange(node.id, open)}>
            <Tree.FolderTrigger
              actions={
                !readOnly && (
                  <span className="flex opacity-0 group-hover:opacity-100">
                    <IconButton size="sm" variant="ghost" tooltip="New file" onClick={() => onAddFile(node.id)}>
                      <Plus />
                    </IconButton>
                    <IconButton size="sm" variant="ghost" tooltip="New folder" onClick={() => onAddFolder(node.id)}>
                      <FolderPlus />
                    </IconButton>
                    <IconButton
                      size="sm"
                      variant="ghost"
                      tooltip="Delete folder"
                      onClick={e => {
                        e.stopPropagation();
                        onRemove(node.id);
                      }}
                    >
                      <Trash2 />
                    </IconButton>
                  </span>
                )
              }
            >
              <Tree.Icon>{getFolderIcon(isOpen)}</Tree.Icon>
              <Tree.Label>{node.name}</Tree.Label>
            </Tree.FolderTrigger>
            <Tree.FolderContent>
              <UserNodeList
                nodes={node.children ?? []}
                readOnly={readOnly}
                openFolders={openFolders}
                pendingInput={pendingInput}
                onRemove={onRemove}
                onAddFile={onAddFile}
                onAddFolder={onAddFolder}
                onFolderOpenChange={onFolderOpenChange}
                onInputSubmit={onInputSubmit}
                onInputCancel={onInputCancel}
              />
              {pendingInput?.parentId === node.id && (
                <Tree.Input
                  type={pendingInput.type === 'folder' ? 'folder' : 'file'}
                  placeholder={pendingInput.type === 'folder' ? 'folder name' : 'filename.ext'}
                  onSubmit={onInputSubmit}
                  onCancel={onInputCancel}
                />
              )}
            </Tree.FolderContent>
          </Tree.Folder>
        );
      }

      return (
        <Tree.File key={node.id} id={node.id}>
          <Tree.Icon>{getFileIcon(node.name)}</Tree.Icon>
          <Tree.Label>{node.name}</Tree.Label>
          {!readOnly && <FileDeleteAction nodeId={node.id} onRemove={onRemove} />}
        </Tree.File>
      );
    });
}

type PendingInput = { parentId: string; type: 'file' | 'folder' };

export function SkillFileTree({ files, onChange, selectedFileId, onSelectFile, readOnly }: SkillFileTreeProps) {
  const [pendingInput, setPendingInput] = useState<PendingInput | null>(null);
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({
    references: true,
    scripts: true,
    assets: true,
  });
  const imageInputRef = useRef<HTMLInputElement>(null);

  const setFolderOpen = useCallback((folderId: string, open: boolean) => {
    setOpenFolders(prev => ({ ...prev, [folderId]: open }));
  }, []);

  const handleAddFile = useCallback(
    (parentId: string) => {
      setFolderOpen(parentId, true);
      setPendingInput({ parentId, type: 'file' });
    },
    [setFolderOpen],
  );

  const handleAddFolder = useCallback(
    (parentId: string) => {
      setFolderOpen(parentId, true);
      setPendingInput({ parentId, type: 'folder' });
    },
    [setFolderOpen],
  );

  const handleAddImage = useCallback(() => {
    setFolderOpen('assets', true);
    imageInputRef.current?.click();
  }, [setFolderOpen]);

  const handleImagePicked = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        const newNode: InMemoryFileNode = {
          id: uuid(),
          name: file.name,
          type: 'file',
          content: base64,
        };
        onChange(insertNode(files, 'assets', newNode));
        onSelectFile(newNode.id);
      };
      reader.readAsDataURL(file);

      // Reset so the same file can be picked again
      e.target.value = '';
    },
    [files, onChange, onSelectFile],
  );

  const handleInputSubmit = useCallback(
    (name: string) => {
      if (!pendingInput) return;
      const newId = uuid();
      const newNode: InMemoryFileNode =
        pendingInput.type === 'folder'
          ? { id: newId, name, type: 'folder', children: [] }
          : { id: newId, name, type: 'file', content: '' };
      onChange(insertNode(files, pendingInput.parentId, newNode));
      if (pendingInput.type === 'folder') {
        setFolderOpen(newId, true);
      }
      setPendingInput(null);
    },
    [pendingInput, files, onChange, setFolderOpen],
  );

  const handleInputCancel = useCallback(() => {
    setPendingInput(null);
  }, []);

  const handleRemove = useCallback(
    (nodeId: string) => {
      if (STRUCTURAL_IDS.has(nodeId)) return;
      if (selectedFileId) {
        if (selectedFileId === nodeId) {
          onSelectFile(null);
        } else {
          const node = findNodeById(files, nodeId);
          if (node?.children && containsNode(node.children, selectedFileId)) {
            onSelectFile(null);
          }
        }
      }
      onChange(removeNode(files, nodeId));
    },
    [files, onChange, selectedFileId, onSelectFile],
  );

  const root = files.find(n => n.id === 'root');
  if (!root?.children) return null;

  const referencesFolder = root.children.find(n => n.id === 'references');
  const scriptsFolder = root.children.find(n => n.id === 'scripts');
  const assetsFolder = root.children.find(n => n.id === 'assets');

  return (
    <TooltipProvider>
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImagePicked} />

      <Tree selectedId={selectedFileId ?? undefined} onSelect={onSelectFile}>
        <Tree.Folder defaultOpen>
          <Tree.FolderTrigger>
            <Tree.Icon>{getFolderIcon(true)}</Tree.Icon>
            <Tree.Label>{root.name}</Tree.Label>
          </Tree.FolderTrigger>
          <Tree.FolderContent>
            <Tree.File id="skill-md">
              <Tree.Icon>{getFileIcon('SKILL.md')}</Tree.Icon>
              <Tree.Label>SKILL.md</Tree.Label>
            </Tree.File>

            <Tree.File id="license-md">
              <Tree.Icon>{getFileIcon('LICENSE.md')}</Tree.Icon>
              <Tree.Label>LICENSE.md</Tree.Label>
            </Tree.File>

            {referencesFolder && (
              <Tree.Folder open={openFolders.references} onOpenChange={open => setFolderOpen('references', open)}>
                <Tree.FolderTrigger
                  actions={
                    !readOnly && (
                      <FolderActions
                        onAddFile={() => handleAddFile('references')}
                        onAddFolder={() => handleAddFolder('references')}
                      />
                    )
                  }
                >
                  <Tree.Icon>{getFolderIcon(openFolders.references)}</Tree.Icon>
                  <Tree.Label>references</Tree.Label>
                </Tree.FolderTrigger>
                <Tree.FolderContent>
                  <UserNodeList
                    nodes={referencesFolder.children ?? []}
                    readOnly={readOnly}
                    openFolders={openFolders}
                    pendingInput={pendingInput}
                    onRemove={handleRemove}
                    onAddFile={handleAddFile}
                    onAddFolder={handleAddFolder}
                    onFolderOpenChange={setFolderOpen}
                    onInputSubmit={handleInputSubmit}
                    onInputCancel={handleInputCancel}
                  />
                  {pendingInput?.parentId === 'references' && (
                    <Tree.Input
                      type={pendingInput.type === 'folder' ? 'folder' : 'file'}
                      placeholder={pendingInput.type === 'folder' ? 'folder name' : 'filename.ext'}
                      onSubmit={handleInputSubmit}
                      onCancel={handleInputCancel}
                    />
                  )}
                </Tree.FolderContent>
              </Tree.Folder>
            )}

            {scriptsFolder && (
              <Tree.Folder open={openFolders.scripts} onOpenChange={open => setFolderOpen('scripts', open)}>
                <Tree.FolderTrigger
                  actions={
                    !readOnly && (
                      <FolderActions
                        onAddFile={() => handleAddFile('scripts')}
                        onAddFolder={() => handleAddFolder('scripts')}
                      />
                    )
                  }
                >
                  <Tree.Icon>{getFolderIcon(openFolders.scripts)}</Tree.Icon>
                  <Tree.Label>scripts</Tree.Label>
                </Tree.FolderTrigger>
                <Tree.FolderContent>
                  <UserNodeList
                    nodes={scriptsFolder.children ?? []}
                    readOnly={readOnly}
                    openFolders={openFolders}
                    pendingInput={pendingInput}
                    onRemove={handleRemove}
                    onAddFile={handleAddFile}
                    onAddFolder={handleAddFolder}
                    onFolderOpenChange={setFolderOpen}
                    onInputSubmit={handleInputSubmit}
                    onInputCancel={handleInputCancel}
                  />
                  {pendingInput?.parentId === 'scripts' && (
                    <Tree.Input
                      type={pendingInput.type === 'folder' ? 'folder' : 'file'}
                      placeholder={pendingInput.type === 'folder' ? 'folder name' : 'filename.ext'}
                      onSubmit={handleInputSubmit}
                      onCancel={handleInputCancel}
                    />
                  )}
                </Tree.FolderContent>
              </Tree.Folder>
            )}

            {assetsFolder && (
              <Tree.Folder open={openFolders.assets} onOpenChange={open => setFolderOpen('assets', open)}>
                <Tree.FolderTrigger
                  actions={!readOnly && <FolderAddAction tooltip="Add image" onClick={handleAddImage} />}
                >
                  <Tree.Icon>{getFolderIcon(openFolders.assets)}</Tree.Icon>
                  <Tree.Label>assets</Tree.Label>
                </Tree.FolderTrigger>
                <Tree.FolderContent>
                  {(assetsFolder.children ?? [])
                    .filter(n => !STRUCTURAL_IDS.has(n.id))
                    .map(node => (
                      <Tree.File key={node.id} id={node.id}>
                        <Tree.Icon>{getFileIcon(node.name)}</Tree.Icon>
                        <Tree.Label>{node.name}</Tree.Label>
                        {!readOnly && <FileDeleteAction nodeId={node.id} onRemove={handleRemove} />}
                      </Tree.File>
                    ))}
                </Tree.FolderContent>
              </Tree.Folder>
            )}
          </Tree.FolderContent>
        </Tree.Folder>
      </Tree>
    </TooltipProvider>
  );
}
