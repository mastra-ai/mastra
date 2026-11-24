import { FieldBlocksLayoutColumn } from './field-blocks-layout-column';
import { FieldBlocksLayoutRoot } from './field-blocks-layout-root';

/** @deprecated Lay fields out with plain grid or flex classes; `FieldGroup` stacks related fields. */
export const FieldBlocksLayout = Object.assign(FieldBlocksLayoutRoot, {
  Column: FieldBlocksLayoutColumn,
});
