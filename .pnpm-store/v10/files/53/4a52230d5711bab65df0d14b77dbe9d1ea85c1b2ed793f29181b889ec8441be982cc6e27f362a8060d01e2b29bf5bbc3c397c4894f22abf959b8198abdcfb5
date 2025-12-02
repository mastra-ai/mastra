import * as React from 'react';
export * from '@tanstack/table-core';
import { TableOptions, RowData } from '@tanstack/table-core';
export type Renderable<TProps> = React.ReactNode | React.ComponentType<TProps>;
/**
 * If rendering headers, cells, or footers with custom markup, use flexRender instead of `cell.getValue()` or `cell.renderValue()`.
 */
export declare function flexRender<TProps extends object>(Comp: Renderable<TProps>, props: TProps): React.ReactNode | React.JSX.Element;
export declare function useReactTable<TData extends RowData>(options: TableOptions<TData>): import("@tanstack/table-core").Table<TData>;
