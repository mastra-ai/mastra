import type { DatasetItemToolMock } from '@mastra/client-js';
import { collectToolMocks } from '@mastra/core/utils/collect-tool-mocks';
import { safeStringify } from '@mastra/core/utils/safe-stringify';
import { Button } from '@mastra/playground-ui/components/Button';
import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
import { Label } from '@mastra/playground-ui/components/Label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@mastra/playground-ui/components/Select';
import { SideDialog } from '@mastra/playground-ui/components/SideDialog';
import type { SideDialogRootProps } from '@mastra/playground-ui/components/SideDialog';
import { TextAndIcon, getShortId } from '@mastra/playground-ui/components/Text';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { EyeIcon, WrenchIcon } from 'lucide-react';
import { useState } from 'react';
import { useDatasetItem, useDatasetItems } from '@/domains/datasets/hooks/use-dataset-items';
import { useDatasetMutations } from '@/domains/datasets/hooks/use-dataset-mutations';
import { useDatasets } from '@/domains/datasets/hooks/use-datasets';

type AddTraceMocksToItemDialogProps = {
  traceId?: string;
  isOpen: boolean;
  onClose: () => void;
  level?: SideDialogRootProps['level'];
};

/** Short, human-readable label for an item: short id + a preview of the input. */
function itemLabel(item: { id: string; input: unknown }): string {
  const preview = (() => {
    try {
      const json = JSON.stringify(item.input);
      if (!json) return '';
      return json.length > 40 ? `${json.slice(0, 40)}…` : json;
    } catch {
      return '';
    }
  })();
  const shortId = getShortId(item.id) ?? item.id;
  return preview ? `${shortId} — ${preview}` : shortId;
}

export function AddTraceMocksToItemDialog({ traceId, isOpen, onClose, level = 2 }: AddTraceMocksToItemDialogProps) {
  const client = useMastraClient();

  const { data: trajectory, isLoading: isTrajectoryLoading } = useQuery({
    queryKey: ['trace-trajectory', traceId],
    queryFn: () => client.getTraceTrajectory(traceId!),
    enabled: isOpen && !!traceId,
  });

  const derivedMocks: DatasetItemToolMock[] = trajectory?.steps ? collectToolMocks(trajectory.steps) : [];
  const initialMocksJson = derivedMocks.length > 0 ? safeStringify(derivedMocks, 2) : '';

  return (
    <SideDialog
      dialogTitle="Add Tool Mocks to Item"
      dialogDescription="Append trace-derived tool mocks to an existing dataset item"
      isOpen={isOpen}
      onClose={onClose}
      level={level}
    >
      <SideDialog.Top>
        <TextAndIcon>
          <EyeIcon /> {getShortId(traceId)}
        </TextAndIcon>
        ›
        <TextAndIcon>
          <WrenchIcon /> Add Tool Mocks to Item
        </TextAndIcon>
      </SideDialog.Top>

      <SideDialog.Content>
        <SideDialog.Header>
          <SideDialog.Heading>
            <WrenchIcon /> Add Tool Mocks to Item
          </SideDialog.Heading>
        </SideDialog.Header>

        {isTrajectoryLoading ? (
          <div className="px-2 py-4 text-sm text-neutral4">Loading tool calls from trace...</div>
        ) : (
          // Remount when the source trace changes so the form's useState seeds
          // from the freshly derived mocks — no state-reset effect needed.
          <AddTraceMocksForm key={traceId ?? 'no-trace'} initialMocksJson={initialMocksJson} onClose={onClose} />
        )}
      </SideDialog.Content>
    </SideDialog>
  );
}

type AddTraceMocksFormProps = {
  initialMocksJson: string;
  onClose: () => void;
};

function AddTraceMocksForm({ initialMocksJson, onClose }: AddTraceMocksFormProps) {
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('');
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  // Editable JSON of the mocks to append, seeded once from the trace-derived mocks.
  const [mocksJson, setMocksJson] = useState<string>(initialMocksJson);

  const { data: datasetsData, isLoading: isDatasetsLoading } = useDatasets();
  const datasets = datasetsData?.datasets ?? [];

  const { data: items = [], isLoading: isItemsLoading } = useDatasetItems(selectedDatasetId);
  const { data: selectedItem, isFetching: isSelectedItemFetching } = useDatasetItem(selectedDatasetId, selectedItemId);
  const { updateItem } = useDatasetMutations();

  // Whether the current editor content is a non-empty JSON array (enables submit).
  const hasMocks = (() => {
    if (!mocksJson.trim()) return false;
    try {
      const parsed = JSON.parse(mocksJson);
      return Array.isArray(parsed) && parsed.length > 0;
    } catch {
      return false;
    }
  })();

  const handleDatasetChange = (value: string) => {
    setSelectedDatasetId(value);
    setSelectedItemId('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedDatasetId || !selectedItemId) {
      toast.error('Please select a dataset and an item');
      return;
    }

    // Parse the (possibly edited) mocks JSON.
    let parsedMocks: DatasetItemToolMock[];
    try {
      const parsed = mocksJson.trim() ? JSON.parse(mocksJson) : [];
      if (!Array.isArray(parsed)) {
        toast.error('Tool Mocks must be a JSON array');
        return;
      }
      parsedMocks = parsed as DatasetItemToolMock[];
    } catch {
      toast.error('Tool Mocks must be valid JSON');
      return;
    }
    if (parsedMocks.length === 0) {
      toast.error('There are no tool mocks to add');
      return;
    }
    // Guard against appending to a stale/unloaded item — require the authoritative item first.
    if (!selectedItem || selectedItem.id !== selectedItemId) {
      toast.error('Item is still loading, please try again');
      return;
    }

    const existing = selectedItem.toolMocks ?? [];
    const merged = [...existing, ...parsedMocks];

    try {
      await updateItem.mutateAsync({
        datasetId: selectedDatasetId,
        itemId: selectedItemId,
        toolMocks: merged,
      });
      toast.success(`Added ${parsedMocks.length} tool mock(s) to the item`);
      onClose();
    } catch (error) {
      toast.error(`Failed to add tool mocks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="target-dataset">Dataset *</Label>
        <Select value={selectedDatasetId} onValueChange={handleDatasetChange} disabled={isDatasetsLoading}>
          <SelectTrigger id="target-dataset">
            <SelectValue placeholder={isDatasetsLoading ? 'Loading datasets...' : 'Select a dataset'} />
          </SelectTrigger>
          <SelectContent>
            {datasets.length === 0 ? (
              <div className="px-2 py-4 text-sm text-neutral4 text-center">No datasets available</div>
            ) : (
              datasets.map(dataset => (
                <SelectItem key={dataset.id} value={dataset.id}>
                  {dataset.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="target-item">Item *</Label>
        <Select
          value={selectedItemId}
          onValueChange={setSelectedItemId}
          disabled={!selectedDatasetId || isItemsLoading}
        >
          <SelectTrigger id="target-item">
            <SelectValue
              placeholder={
                !selectedDatasetId ? 'Select a dataset first' : isItemsLoading ? 'Loading items...' : 'Select an item'
              }
            />
          </SelectTrigger>
          <SelectContent>
            {items.length === 0 ? (
              <div className="px-2 py-4 text-sm text-neutral4 text-center">No items available</div>
            ) : (
              items.map(item => (
                <SelectItem key={item.id} value={item.id}>
                  {itemLabel(item)}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="derived-mocks">Tool Mocks (JSON)</Label>
        <CodeEditor value={mocksJson} onChange={setMocksJson} showCopyButton={false} className="min-h-[160px]" />
        <p className="text-xs text-neutral4">
          Seeded from the trace&apos;s tool calls. Edit or remove entries before appending.
        </p>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="default"
          disabled={
            updateItem.isPending ||
            isSelectedItemFetching ||
            !hasMocks ||
            !selectedDatasetId ||
            !selectedItemId ||
            selectedItem?.id !== selectedItemId
          }
        >
          {updateItem.isPending ? 'Adding...' : 'Append Tool Mocks'}
        </Button>
      </div>
    </form>
  );
}
