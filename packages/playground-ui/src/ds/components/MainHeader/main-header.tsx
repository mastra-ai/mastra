import { MainHeaderRoot } from './main-header-root';
import { MainHeaderTitle } from './main-header-title';
import { MainHeaderDescription } from './main-header-description';
import { MainHeaderColumn } from './main-header-column';

export { type MainHeaderRootProps } from './main-header-root';
export { type MainHeaderTitleProps } from './main-header-title';
export { type MainHeaderDescriptionProps } from './main-header-description';
export { type MainHeaderColumnProps } from './main-header-column';

export const MainHeader = Object.assign(MainHeaderRoot, {
  Title: MainHeaderTitle,
  Description: MainHeaderDescription,
  Column: MainHeaderColumn,
});
