import { useState } from 'react';
import { Button } from '@/ds/components/Button';
import { Icon } from '@/ds/icons/Icon';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/ds/components/Dialog';
import { Input } from '@/ds/components/Input';
import { Label } from '@/ds/components/Label';
import { Switch } from '@/ds/components/Switch';
import { Plus, Database, Search, Sparkles } from 'lucide-react';

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
  const [vectorStoreName, setVectorStoreName] = useState('');
  const [indexName, setIndexName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!namespace.trim()) return;

    const vectorConfig: VectorConfig | undefined =
      enableVector && (vectorStoreName.trim() || indexName.trim())
        ? {
            vectorStoreName: vectorStoreName.trim() || undefined,
            indexName: indexName.trim() || undefined,
          }
        : undefined;

    onSubmit({
      namespace: namespace.trim(),
      description: description.trim() || undefined,
      enableBM25,
      vectorConfig,
    });

    resetForm();
    setOpen(false);
  };

  const resetForm = () => {
    setNamespace('');
    setDescription('');
    setEnableBM25(true);
    setEnableVector(false);
    setVectorStoreName('');
    setIndexName('');
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
        <Button>
          <Icon>
            <Plus />
          </Icon>
          Create Namespace
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Create Namespace
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 mt-2">
          {/* Namespace ID */}
          <div className="grid gap-1.5">
            <Label htmlFor="namespace" className="text-xs text-icon4">
              Namespace ID
            </Label>
            <Input
              id="namespace"
              value={namespace}
              onChange={e => setNamespace(e.target.value)}
              placeholder="my-knowledge-base"
              className="font-mono"
              required
            />
          </div>

          {/* Description */}
          <div className="grid gap-1.5">
            <Label htmlFor="description" className="text-xs text-icon4">
              Description <span className="text-icon3">(optional)</span>
            </Label>
            <Input
              id="description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="A collection of documents about..."
            />
          </div>

          {/* Search Options */}
          <div className="grid gap-3 pt-2">
            <span className="text-xs text-icon3 uppercase tracking-wide">Search</span>

            {/* BM25 */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-surface4">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded bg-blue-500/10">
                  <Search className="h-3.5 w-3.5 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-icon6">BM25 Keyword Search</p>
                  <p className="text-xs text-icon3">Full-text search</p>
                </div>
              </div>
              <Switch checked={enableBM25} onCheckedChange={setEnableBM25} />
            </div>

            {/* Vector */}
            <div className="rounded-lg bg-surface4 overflow-hidden">
              <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded bg-purple-500/10">
                    <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm text-icon6">Vector Search</p>
                    <p className="text-xs text-icon3">Semantic similarity</p>
                  </div>
                </div>
                <Switch checked={enableVector} onCheckedChange={setEnableVector} />
              </div>

              {enableVector && (
                <div className="px-3 pb-3 grid gap-2 border-t border-border1 pt-3">
                  <Input
                    value={vectorStoreName}
                    onChange={e => setVectorStoreName(e.target.value)}
                    placeholder="Vector store name"
                    className="h-8 text-sm"
                  />
                  <Input
                    value={indexName}
                    onChange={e => setIndexName(e.target.value)}
                    placeholder="Index name"
                    className="h-8 text-sm"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="light" type="button" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !namespace.trim()}>
              {isLoading ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
