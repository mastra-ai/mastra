import { DataKeysAndValuesHeader } from './data-keys-and-values-header';
import { DataKeysAndValuesKey } from './data-keys-and-values-key';
import { DataKeysAndValuesRoot } from './data-keys-and-values-root';
import { DataKeysAndValuesValue } from './data-keys-and-values-value';
import { DataKeysAndValuesValueLink } from './data-keys-and-values-value-link';
import { DataKeysAndValuesValueWithCopyBtn } from './data-keys-and-values-value-with-copy-btn';
import { DataKeysAndValuesValueWithTooltip } from './data-keys-and-values-value-with-tooltip';

export const DataKeysAndValues = Object.assign(DataKeysAndValuesRoot, {
  Key: DataKeysAndValuesKey,
  Value: DataKeysAndValuesValue,
  ValueLink: DataKeysAndValuesValueLink,
  ValueWithTooltip: DataKeysAndValuesValueWithTooltip,
  ValueWithCopyBtn: DataKeysAndValuesValueWithCopyBtn,
  Header: DataKeysAndValuesHeader,
});
