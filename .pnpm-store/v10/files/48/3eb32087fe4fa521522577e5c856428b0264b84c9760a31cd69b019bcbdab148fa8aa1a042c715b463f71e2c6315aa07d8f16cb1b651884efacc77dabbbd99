import type { HighlightProps, RenderProps, Token } from 'prism-react-renderer';
import type { BaseContextProps, BaseLineContextProps } from './shared/types.js';
export interface RootContextProps extends Omit<HighlightProps, 'children'>, BaseContextProps {
}
export interface LineContextProps extends BaseLineContextProps {
    line: Token[];
    highlight?: RenderProps;
}
