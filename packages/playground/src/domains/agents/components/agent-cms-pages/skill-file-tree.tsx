import { v4 as uuid } from '@lukeed/uuid';
import { Button } from '@mastra/playground-ui/components/Button';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { Tree, flattenTreeRows } from '@mastra/playground-ui/components/Tree';
import { IconFileBend } from '@mastra/playground-ui/icons/central/IconFileBend';
import { IconFileText } from '@mastra/playground-ui/icons/central/IconFileText';

import { IconFolder1 } from '@mastra/playground-ui/icons/central/IconFolder1';
import { IconFolderAddRight } from '@mastra/playground-ui/icons/central/IconFolderAddRight';
import { IconFolderOpen } from '@mastra/playground-ui/icons/central/IconFolderOpen';
import { IconImages1 } from '@mastra/playground-ui/icons/central/IconImages1';
import { IconPlusMedium } from '@mastra/playground-ui/icons/central/IconPlusMedium';
import { IconScript } from '@mastra/playground-ui/icons/central/IconScript';
import { TrashIcon } from '@mastra/playground-ui/icons/TrashIcon';
import type { ReactNode } from 'react';
import { useCallback, useRef, useState } from 'react';
import type { InMemoryFileNode } from '../agent-edit-page/utils/form-validation';
import { STRUCTURAL_IDS } from './skill-file-tree-utils';

export interface SkillFileTreeProps {
  files: InMemoryFileNode[];
  onChange: (files: InMemoryFileNode[]) => void;
  selectedFileId: string | null;
  onSelectFile: (id: string | null) => void;
  readOnly?: boolean;
}

function getFileIcon(name: string): ReactNode {
  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
      return <IconScript className="text-badge-blue-indicator" />;
    case 'json':
      return <IconFileText className="text-badge-amber-indicator" />;
    case 'md':
    case 'mdx':
      return <IconFileText className="text-muted-foreground" />;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'webp':
      return <IconImages1 className="text-badge-purple-indicator" />;
    default:
      return <IconFileBend className="text-muted-foreground" />;
  }
}

function getFolderIcon(isOpen: boolean): ReactNode {
  return isOpen ? (
    <IconFolderOpen className="text-badge-amber-indicator" />
  ) : (
    <IconFolder1 className="text-badge-amber-indicator" />
  );
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

type PendingInput = { parentId: string; type: 'file' | 'folder' };

type FolderActionsKind = 'none' | 'create' | 'image' | 'all';

type SkillTreeNode =
  | { kind: 'file'; id: string; name: string; deletable: boolean }
  | { kind: 'folder'; id: string; name: string; actions: FolderActionsKind; children: SkillTreeNode[] }
  | { kind: 'input'; id: string; name: string; type: 'file' | 'folder' };

function withPendingInput(parentId: string, children: SkillTreeNode[], pendingInput: PendingInput | null) {
  if (pendingInput?.parentId !== parentId) return children;
  return [...children, { kind: 'input' as const, id: `${parentId}/\0new`, name: '', type: pendingInput.type }];
}

function userNodes(nodes: InMemoryFileNode[], pendingInput: PendingInput | null): SkillTreeNode[] {
  return nodes
    .filter(node => !STRUCTURAL_IDS.has(node.id))
    .map(node =>
      node.type === 'folder'
        ? {
            kind: 'folder',
            id: node.id,
            name: node.name,
            actions: 'all',
            children: withPendingInput(node.id, userNodes(node.children ?? [], pendingInput), pendingInput),
          }
        : { kind: 'file', id: node.id, name: node.name, deletable: true },
    );
}

function sectionNode(
  folder: InMemoryFileNode | undefined,
  actions: FolderActionsKind,
  children: SkillTreeNode[],
): SkillTreeNode[] {
  return folder ? [{ kind: 'folder', id: folder.id, name: folder.name, actions, children }] : [];
}

function RowActions({ children }: { children: ReactNode }) {
  return <span className="ml-auto flex shrink-0 opacity-0 group-hover:opacity-100">{children}</span>;
}

function FolderRowActions({
  node,
  onAddFile,
  onAddFolder,
  onAddImage,
  onRemove,
}: {
  node: Extract<SkillTreeNode, { kind: 'folder' }>;
  onAddFile: (parentId: string) => void;
  onAddFolder: (parentId: string) => void;
  onAddImage: () => void;
  onRemove: (id: string) => void;
}) {
  if (node.actions === 'none') return null;
  if (node.actions === 'image') {
    return (
      <RowActions>
        <Button size="icon-sm" variant="ghost" tooltip="Add image" onClick={onAddImage}>
          <IconPlusMedium />
        </Button>
      </RowActions>
    );
  }
  return (
    <RowActions>
      <Button size="icon-sm" variant="ghost" tooltip="New file" onClick={() => onAddFile(node.id)}>
        <IconPlusMedium />
      </Button>
      <Button size="icon-sm" variant="ghost" tooltip="New folder" onClick={() => onAddFolder(node.id)}>
        <IconFolderAddRight />
      </Button>
      {node.actions === 'all' && (
        <Button size="icon-sm" variant="ghost" tooltip="Delete folder" onClick={() => onRemove(node.id)}>
          <TrashIcon />
        </Button>
      )}
    </RowActions>
  );
}

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

  const section = (id: string) => root.children?.find(n => n.id === id);
  const references = section('references');
  const scripts = section('scripts');
  const assets = section('assets');
  const nodes: SkillTreeNode[] = [
    {
      kind: 'folder',
      id: 'root',
      name: root.name,
      actions: 'none',
      children: [
        { kind: 'file', id: 'skill-md', name: 'SKILL.md', deletable: false },
        { kind: 'file', id: 'license-md', name: 'LICENSE.md', deletable: false },
        ...sectionNode(
          references,
          'create',
          withPendingInput('references', userNodes(references?.children ?? [], pendingInput), pendingInput),
        ),
        ...sectionNode(
          scripts,
          'create',
          withPendingInput('scripts', userNodes(scripts?.children ?? [], pendingInput), pendingInput),
        ),
        ...sectionNode(
          assets,
          'image',
          (assets?.children ?? [])
            .filter(n => !STRUCTURAL_IDS.has(n.id))
            .map(node => ({ kind: 'file' as const, id: node.id, name: node.name, deletable: true })),
        ),
      ],
    },
  ];
  const rows = flattenTreeRows(nodes, {
    getId: node => node.id,
    getChildren: node => (node.kind === 'folder' ? node.children : undefined),
    isOpen: id => openFolders[id] ?? true,
  });

  return (
    <TooltipProvider>
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImagePicked} />

      <Tree
        aria-label="Skill files"
        rows={rows}
        getRowLabel={row => row.node.name}
        selectedId={selectedFileId ?? undefined}
        onActivate={row => {
          if (row.node.kind === 'file') onSelectFile(row.id);
          if (row.node.kind === 'folder') setFolderOpen(row.id, !row.expanded);
        }}
        onExpandedChange={(row, expanded) => setFolderOpen(row.id, expanded)}
        renderRow={({ node, expanded }) => {
          if (node.kind === 'input') {
            return (
              <Tree.Input
                type={node.type}
                placeholder={node.type === 'folder' ? 'folder name' : 'filename.ext'}
                onSubmit={handleInputSubmit}
                onCancel={handleInputCancel}
              />
            );
          }
          if (node.kind === 'file') {
            return (
              <>
                <Tree.Icon>{getFileIcon(node.name)}</Tree.Icon>
                <Tree.Label>{node.name}</Tree.Label>
                {node.deletable && !readOnly && (
                  <RowActions>
                    <Button size="icon-sm" variant="ghost" tooltip="Delete file" onClick={() => handleRemove(node.id)}>
                      <TrashIcon />
                    </Button>
                  </RowActions>
                )}
              </>
            );
          }
          return (
            <>
              <Tree.Icon>{getFolderIcon(!!expanded)}</Tree.Icon>
              <Tree.Label>{node.name}</Tree.Label>
              {!readOnly && (
                <FolderRowActions
                  node={node}
                  onAddFile={handleAddFile}
                  onAddFolder={handleAddFolder}
                  onAddImage={handleAddImage}
                  onRemove={handleRemove}
                />
              )}
            </>
          );
        }}
      />
    </TooltipProvider>
  );
}
