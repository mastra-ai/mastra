import { DataKeysAndValuesHeader } from './data-keys-and-values-header';
import { DataKeysAndValuesKey } from './data-keys-and-values-key';
import { DataKeysAndValuesRoot } from './data-keys-and-values-root';
import { DataKeysAndValuesValue } from './data-keys-and-values-value';

export const DataKeysAndValues = Object.assign(DataKeysAndValuesRoot, {
  Key: DataKeysAndValuesKey,
  Value: DataKeysAndValuesValue,
  Header: DataKeysAndValuesHeader,
});
