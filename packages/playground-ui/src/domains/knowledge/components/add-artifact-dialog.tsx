import { useState, useRef, useCallback } from 'react';
import { Button } from '@/ds/components/Button';
import { Icon } from '@/ds/icons/Icon';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Plus, FileText, Upload, X, File, Lock, Search } from 'lucide-react';

type ArtifactType = 'text' | 'file';

interface FileInfo {
  file: File;
  name: string;
  size: number;
  type: string;
}

export interface AddArtifactParams {
  key: string;
  type: ArtifactType;
  content?: string;
  file?: File;
  metadata?: Record<string, unknown>;
  isStatic?: boolean;
}

interface AddArtifactDialogProps {
  onSubmit: (params: AddArtifactParams) => void;
  isLoading?: boolean;
  supportsFileUpload?: boolean;
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export function AddArtifactDialog({ onSubmit, isLoading, supportsFileUpload = true }: AddArtifactDialogProps) {
  const [open, setOpen] = useState(false);
  const [artifactType, setArtifactType] = useState<ArtifactType>('text');
  const [key, setKey] = useState('');
  const [content, setContent] = useState('');
  const [metadataStr, setMetadataStr] = useState('');
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [isStatic, setIsStatic] = useState(false);
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setArtifactType('text');
    setKey('');
    setContent('');
    setMetadataStr('');
    setMetadataError(null);
    setIsStatic(false);
    setFileInfo(null);
    setIsDragging(false);
  };

  const handleFileSelect = useCallback(
    (file: File) => {
      setFileInfo({
        file,
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
      });
      if (!key.trim()) {
        setKey(file.name);
      }
    },
    [key],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim()) return;
    if (artifactType === 'text' && !content.trim()) return;
    if (artifactType === 'file' && !fileInfo) return;

    let metadata: Record<string, unknown> | undefined;
    if (metadataStr.trim()) {
      try {
        metadata = JSON.parse(metadataStr);
        setMetadataError(null);
      } catch {
        setMetadataError('Invalid JSON');
        return;
      }
    }

    onSubmit({
      key: key.trim(),
      type: artifactType,
      content: artifactType === 'text' ? content.trim() : undefined,
      file: artifactType === 'file' ? fileInfo?.file : undefined,
      metadata,
      isStatic,
    });

    resetForm();
    setOpen(false);
  };

  const isFormValid =
    key.trim() && ((artifactType === 'text' && content.trim()) || (artifactType === 'file' && fileInfo));

  return (
    <Dialog
      open={open}
      onOpenChange={val => {
        setOpen(val);
        if (!val) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Icon>
            <Plus />
          </Icon>
          Add Artifact
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Add Artifact
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 mt-2">
          {/* Type Tabs */}
          <div className="flex gap-1 p-1 bg-surface4 rounded-lg">
            <button
              type="button"
              onClick={() => setArtifactType('text')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded text-sm font-medium transition-colors ${
                artifactType === 'text' ? 'bg-surface2 text-icon6' : 'text-icon4 hover:text-icon5'
              }`}
            >
              <FileText className="h-4 w-4" />
              Text
            </button>
            <button
              type="button"
              onClick={() => setArtifactType('file')}
              disabled={!supportsFileUpload}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50 ${
                artifactType === 'file' ? 'bg-surface2 text-icon6' : 'text-icon4 hover:text-icon5'
              }`}
            >
              <Upload className="h-4 w-4" />
              File
            </button>
          </div>

          {/* Key */}
          <div className="grid gap-1.5">
            <Label htmlFor="key" className="text-xs text-icon4">
              Key
            </Label>
            <Input
              id="key"
              value={key}
              onChange={e => setKey(e.target.value)}
              placeholder="unique-artifact-key"
              className="font-mono"
              required
            />
          </div>

          {/* Content / File */}
          {artifactType === 'text' ? (
            <div className="grid gap-1.5">
              <div className="flex justify-between">
                <Label htmlFor="content" className="text-xs text-icon4">
                  Content
                </Label>
                <span className="text-xs text-icon3">{content.length} chars</span>
              </div>
              <Textarea
                id="content"
                value={content}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setContent(e.target.value)}
                placeholder="Enter text content..."
                rows={6}
                required
                className="font-mono text-sm resize-none"
              />
            </div>
          ) : (
            <div className="grid gap-1.5">
              <Label className="text-xs text-icon4">File</Label>
              <input
                type="file"
                ref={fileInputRef}
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                }}
                className="hidden"
              />
              {fileInfo ? (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-surface4">
                  <div className="p-2 rounded bg-surface5">
                    <File className="h-4 w-4 text-icon4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-icon6 truncate">{fileInfo.name}</p>
                    <p className="text-xs text-icon3">{formatFileSize(fileInfo.size)}</p>
                  </div>
                  <Button
                    type="button"
                    variant="light"
                    size="md"
                    onClick={() => {
                      setFileInfo(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div
                  onDrop={handleDrop}
                  onDragOver={e => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={e => {
                    e.preventDefault();
                    setIsDragging(false);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex flex-col items-center justify-center gap-2 p-6 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
                    isDragging ? 'border-accent1 bg-accent1/5' : 'border-border1 hover:border-border2'
                  }`}
                >
                  <Upload className="h-6 w-6 text-icon3" />
                  <p className="text-sm text-icon4">Drop file or click to browse</p>
                </div>
              )}
            </div>
          )}

          {/* Static Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-surface4">
            <div className="flex items-center gap-2.5">
              <div className={`p-1.5 rounded ${isStatic ? 'bg-amber-500/10' : 'bg-blue-500/10'}`}>
                {isStatic ? (
                  <Lock className="h-3.5 w-3.5 text-amber-400" />
                ) : (
                  <Search className="h-3.5 w-3.5 text-blue-400" />
                )}
              </div>
              <div>
                <p className="text-sm text-icon6">{isStatic ? 'Static (not searchable)' : 'Searchable'}</p>
                <p className="text-xs text-icon3">
                  {isStatic ? 'Retrieve with getStatic()' : 'Indexed for keyword/vector search'}
                </p>
              </div>
            </div>
            <Switch checked={isStatic} onCheckedChange={setIsStatic} />
          </div>

          {/* Metadata */}
          <div className="grid gap-1.5">
            <Label htmlFor="metadata" className="text-xs text-icon4">
              Metadata <span className="text-icon3">(optional JSON)</span>
            </Label>
            <Textarea
              id="metadata"
              value={metadataStr}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                setMetadataStr(e.target.value);
                setMetadataError(null);
              }}
              placeholder='{"key": "value"}'
              rows={2}
              className="font-mono text-sm resize-none"
            />
            {metadataError && <p className="text-xs text-red-400">{metadataError}</p>}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="light" type="button" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !isFormValid}>
              {isLoading ? 'Adding...' : 'Add Artifact'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
