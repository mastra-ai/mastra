import type { SourcePickerItem } from './intake-source-picker';

export function sourcePickerItemText(item: SourcePickerItem): string {
  return item.detail ? `${item.detail}: ${item.label}` : item.label;
}
