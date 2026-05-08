import { ColumnContent } from './column-content';
import { ColumnRoot } from './column-root';
import { ColumnToolbar } from './column-toolbar';

export const Column = Object.assign(ColumnRoot, {
  Content: ColumnContent,
  Toolbar: ColumnToolbar,
});
