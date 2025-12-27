import { useState } from 'react';
import { Button } from '@/ds/components/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Plus, Database, Search, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';

interface VectorConfig {
  vectorStoreName?: string;
  indexName?: string;
  embedderName?: string;
}

interface CreateNamespaceDialogProps {
  onSubmit: (params: {
    namespace: string;
    description?: string;
    enableBM25?: boolean;
    vectorConfig?: VectorConfig;
  }) => void;
  isLoading?: boolean;
}

export function CreateNamespaceDialog({ onSubmit, isLoading }: CreateNamespaceDialogProps) {
  const [open, setOpen] = useState(false);
  const [namespace, setNamespace] = useState('');
  const [description, setDescription] = useState('');
  const [enableBM25, setEnableBM25] = useState(true);
  const [enableVector, setEnableVector] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [vectorStoreName, setVectorStoreName] = useState('');
  const [indexName, setIndexName] = useState('');
  const [embedderName, setEmbedderName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!namespace.trim()) return;

    const vectorConfig: VectorConfig | undefined =
      enableVector && (vectorStoreName.trim() || indexName.trim())
        ? {
            vectorStoreName: vectorStoreName.trim() || undefined,
            indexName: indexName.trim() || undefined,
            embedderName: embedderName.trim() || undefined,
          }
        : undefined;

    onSubmit({
      namespace: namespace.trim(),
      description: description.trim() || undefined,
      enableBM25,
      vectorConfig,
    });

    // Reset form
    setNamespace('');
    setDescription('');
    setEnableBM25(true);
    setEnableVector(false);
    setShowAdvanced(false);
    setVectorStoreName('');
    setIndexName('');
    setEmbedderName('');
    setOpen(false);
  };

  const resetForm = () => {
    setNamespace('');
    setDescription('');
    setEnableBM25(true);
    setEnableVector(false);
    setShowAdvanced(false);
    setVectorStoreName('');
    setIndexName('');
    setEmbedderName('');
  };

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
          Create Namespace
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Create Knowledge Namespace
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 mt-4">
          {/* Basic Info */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="namespace">Namespace ID</Label>
              <Input
                id="namespace"
                value={namespace}
                onChange={e => setNamespace(e.target.value)}
                placeholder="my-knowledge-base"
                className="font-mono"
                required
              />
              <p className="text-xs text-text3">A unique identifier for this knowledge namespace.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="A collection of documents about..."
              />
            </div>
          </div>

          {/* Search Configuration */}
          <div className="space-y-4 pt-2 border-t border-border1">
            <h4 className="text-sm font-medium text-text2">Search Configuration</h4>

            {/* BM25 Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-surface2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-surface3">
                  <Search className="h-4 w-4 text-icon3" />
                </div>
                <div>
                  <p className="text-sm font-medium">BM25 Keyword Search</p>
                  <p className="text-xs text-text3">Full-text search using BM25 algorithm</p>
                </div>
              </div>
              <Switch checked={enableBM25} onCheckedChange={setEnableBM25} />
            </div>

            {/* Vector Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-surface2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-surface3">
                  <Sparkles className="h-4 w-4 text-icon3" />
                </div>
                <div>
                  <p className="text-sm font-medium">Vector Search</p>
                  <p className="text-xs text-text3">Semantic search using embeddings</p>
                </div>
              </div>
              <Switch checked={enableVector} onCheckedChange={setEnableVector} />
            </div>

            {/* Vector Config */}
            {enableVector && (
              <div className="space-y-3 pl-4 border-l-2 border-border1 ml-2">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-1 text-xs text-text3 hover:text-text2 transition-colors"
                >
                  {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {showAdvanced ? 'Hide' : 'Show'} vector configuration
                </button>

                {showAdvanced && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="vectorStoreName" className="text-xs">
                        Vector Store Name
                      </Label>
                      <Input
                        id="vectorStoreName"
                        value={vectorStoreName}
                        onChange={e => setVectorStoreName(e.target.value)}
                        placeholder="default"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="indexName" className="text-xs">
                        Index Name
                      </Label>
                      <Input
                        id="indexName"
                        value={indexName}
                        onChange={e => setIndexName(e.target.value)}
                        placeholder="knowledge-index"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="embedderName" className="text-xs">
                        Embedder Name (optional)
                      </Label>
                      <Input
                        id="embedderName"
                        value={embedderName}
                        onChange={e => setEmbedderName(e.target.value)}
                        placeholder="text-embedding-3-small"
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {!enableBM25 && !enableVector && (
              <p className="text-xs text-amber-500 px-1">
                At least one search method should be enabled for this namespace to be useful.
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t border-border1">
            <Button variant="light" type="button" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !namespace.trim()}>
              {isLoading ? 'Creating...' : 'Create Namespace'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
