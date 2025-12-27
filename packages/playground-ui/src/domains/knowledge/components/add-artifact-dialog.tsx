import { useState, useRef, useCallback } from 'react';
import { Button } from '@/ds/components/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, FileText, Upload, X, File, AlertCircle, Lock, Unlock } from 'lucide-react';

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

  const handleFileSelect = (file: File) => {
    setFileInfo({
      file,
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
    });
    // Auto-fill key from filename if empty
    if (!key.trim()) {
      setKey(file.name);
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [key],
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

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
        setMetadataError('Invalid JSON format');
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
        <Button variant="default" size="lg">
          <Plus className="h-4 w-4 mr-2" />
          Add Artifact
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Add Knowledge Artifact
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-4">
          {/* Artifact Type Tabs */}
          <Tabs value={artifactType} onValueChange={val => setArtifactType(val as ArtifactType)} className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-surface2 rounded-lg p-1 h-auto">
              <TabsTrigger
                value="text"
                className="flex items-center gap-2 py-2.5 px-4 rounded-md data-[state=active]:bg-surface4 data-[state=active]:text-text1"
              >
                <FileText className="h-4 w-4" />
                Text Content
              </TabsTrigger>
              <TabsTrigger
                value="file"
                disabled={!supportsFileUpload}
                className="flex items-center gap-2 py-2.5 px-4 rounded-md data-[state=active]:bg-surface4 data-[state=active]:text-text1 disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                File Upload
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Artifact Key */}
          <div className="space-y-2">
            <Label htmlFor="key">Artifact Key</Label>
            <Input
              id="key"
              value={key}
              onChange={e => setKey(e.target.value)}
              placeholder="unique-artifact-key"
              className="font-mono"
              required
            />
            <p className="text-xs text-text3">A unique identifier for this artifact within the namespace.</p>
          </div>

          {/* Content based on type */}
          {artifactType === 'text' ? (
            <div className="space-y-2">
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Enter the text content for this artifact..."
                rows={8}
                required
                className="font-mono text-sm resize-none"
              />
              <div className="flex justify-between text-xs text-text3">
                <span>Plain text content that will be indexed for search</span>
                <span>{content.length} characters</span>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>File</Label>
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
                <div className="flex items-center gap-3 p-4 rounded-lg bg-surface2 border border-border1">
                  <div className="p-2 rounded-md bg-surface3">
                    <File className="h-5 w-5 text-icon3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{fileInfo.name}</p>
                    <p className="text-xs text-text3">
                      {formatFileSize(fileInfo.size)} &middot; {fileInfo.type}
                    </p>
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
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                  className={`
                    flex flex-col items-center justify-center gap-3 p-8 rounded-lg border-2 border-dashed cursor-pointer transition-colors
                    ${isDragging ? 'border-accent3 bg-accent1/10' : 'border-border1 hover:border-border2 hover:bg-surface2'}
                  `}
                >
                  <div className="p-3 rounded-full bg-surface3">
                    <Upload className="h-6 w-6 text-icon3" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">Drop a file here or click to browse</p>
                    <p className="text-xs text-text3 mt-1">Supports any file type</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Static Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-surface2 border border-border1">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-md ${isStatic ? 'bg-amber-500/10' : 'bg-surface3'}`}>
                {isStatic ? <Lock className="h-4 w-4 text-amber-400" /> : <Unlock className="h-4 w-4 text-icon3" />}
              </div>
              <div>
                <p className="text-sm font-medium">Static Artifact</p>
                <p className="text-xs text-text3">
                  {isStatic
                    ? 'Available via getStatic() for system prompts, not indexed for search'
                    : 'Will be indexed and searchable'}
                </p>
              </div>
            </div>
            <Switch checked={isStatic} onCheckedChange={setIsStatic} />
          </div>

          {/* Metadata */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="metadata">Metadata (optional)</Label>
              <span className="text-xs text-text3">JSON format</span>
            </div>
            <Textarea
              id="metadata"
              value={metadataStr}
              onChange={e => {
                setMetadataStr(e.target.value);
                setMetadataError(null);
              }}
              placeholder='{"source": "docs", "category": "tutorial", "author": "team"}'
              rows={3}
              className="font-mono text-sm resize-none"
            />
            {metadataError && (
              <div className="flex items-center gap-1.5 text-xs text-red-500">
                <AlertCircle className="h-3 w-3" />
                {metadataError}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t border-border1">
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
