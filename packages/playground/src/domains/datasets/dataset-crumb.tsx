import { Button } from '@mastra/playground-ui/components/Button';
import { ComboboxPrimitive, comboboxStyles } from '@mastra/playground-ui/components/Combobox';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { useParams } from 'react-router';
import { useDatasets } from './hooks/use-datasets';
import { useLinkComponent } from '@/lib/framework';

type DatasetOption = { label: string; value: string };

/**
 * Dataset breadcrumb, split in two: the dataset name is a plain link to the
 * dataset page; only the small arrow opens the dataset switcher popup.
 */
export function DatasetCrumb() {
  const { datasetId } = useParams<{ datasetId: string }>();
  const { data } = useDatasets();
  const { Link, navigate, paths } = useLinkComponent();

  if (!datasetId) return null;

  const datasets = data?.datasets ?? [];
  const options: DatasetOption[] = datasets.map(d => ({ label: d.name, value: d.id }));
  const selected = options.find(o => o.value === datasetId) ?? null;

  return (
    <span className="flex items-center">
      <Button as={Link} href={paths.datasetLink(datasetId)} variant="ghost" size="sm">
        {selected?.label ?? datasetId}
      </Button>
      <ComboboxPrimitive.Root
        autoHighlight
        items={options}
        value={selected}
        onValueChange={(item: DatasetOption | null) => {
          if (item && item.value !== datasetId) {
            navigate(paths.datasetLink(item.value));
          }
        }}
      >
        <ComboboxPrimitive.Trigger
          aria-label="Switch dataset"
          className="text-neutral4 hover:bg-surface4 hover:text-neutral6 flex h-6 w-5 shrink-0 cursor-pointer items-center justify-center rounded-md"
        >
          <ChevronsUpDown className="h-4 w-4 opacity-60" />
        </ComboboxPrimitive.Trigger>
        <ComboboxPrimitive.Portal>
          <ComboboxPrimitive.Positioner align="start" sideOffset={4} className={comboboxStyles.positioner}>
            <ComboboxPrimitive.Popup className={comboboxStyles.popup}>
              <div className={comboboxStyles.searchContainer}>
                <Search className={comboboxStyles.searchIcon} />
                <ComboboxPrimitive.Input className={comboboxStyles.searchInput} placeholder="Search datasets..." />
              </div>
              <ComboboxPrimitive.Empty className={comboboxStyles.empty}>No datasets found.</ComboboxPrimitive.Empty>
              <ComboboxPrimitive.List className={comboboxStyles.list}>
                {(option: DatasetOption) => (
                  <ComboboxPrimitive.Item key={option.value} value={option} className={comboboxStyles.item}>
                    <span className={comboboxStyles.optionText}>
                      <span className={comboboxStyles.optionLabel}>{option.label}</span>
                    </span>
                    <span className={comboboxStyles.itemRightSlot}>
                      <span className={comboboxStyles.checkContainer}>
                        <ComboboxPrimitive.ItemIndicator>
                          <Check className={comboboxStyles.checkIcon} />
                        </ComboboxPrimitive.ItemIndicator>
                      </span>
                    </span>
                  </ComboboxPrimitive.Item>
                )}
              </ComboboxPrimitive.List>
            </ComboboxPrimitive.Popup>
          </ComboboxPrimitive.Positioner>
        </ComboboxPrimitive.Portal>
      </ComboboxPrimitive.Root>
    </span>
  );
}
