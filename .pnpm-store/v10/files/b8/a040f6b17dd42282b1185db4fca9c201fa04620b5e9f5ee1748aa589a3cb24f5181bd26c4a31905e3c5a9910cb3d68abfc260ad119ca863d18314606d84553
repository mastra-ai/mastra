import { D as Decorator } from './public-types-d899d203.js';
import { ArgsStoryFn, RenderContext, BaseAnnotations, LegacyStoryFn, DecoratorFunction } from 'storybook/internal/types';
import { R as ReactRenderer } from './types-7abe74eb.js';
import 'react';
import 'react-dom/client';

declare const render: ArgsStoryFn<ReactRenderer>;

declare function renderToCanvas({ storyContext, unboundStoryFn, showMain, showException, forceRemount, }: RenderContext<ReactRenderer>, canvasElement: ReactRenderer['canvasElement']): Promise<() => Promise<void>>;

declare const mount: BaseAnnotations<ReactRenderer>['mount'];

declare const applyDecorators: (storyFn: LegacyStoryFn<ReactRenderer>, decorators: DecoratorFunction<ReactRenderer>[]) => LegacyStoryFn<ReactRenderer>;

declare const decorators: Decorator[];
declare const parameters: {
    renderer: string;
};
declare const beforeAll: () => Promise<void>;

export { applyDecorators, beforeAll, decorators, mount, parameters, render, renderToCanvas };
