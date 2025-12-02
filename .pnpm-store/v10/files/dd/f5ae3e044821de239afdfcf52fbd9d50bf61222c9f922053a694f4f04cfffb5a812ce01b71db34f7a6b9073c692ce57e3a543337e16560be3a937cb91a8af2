import { ComponentType, JSX } from 'react';
import { RootOptions } from 'react-dom/client';
import { WebRenderer, Canvas } from 'storybook/internal/types';

interface ReactRenderer extends WebRenderer {
    component: ComponentType<this['T']>;
    storyResult: StoryFnReactReturnType;
    mount: (ui?: JSX.Element) => Promise<Canvas>;
}
interface ReactParameters {
    /** React renderer configuration */
    react?: {
        /**
         * Whether to enable React Server Components
         *
         * @see https://storybook.js.org/docs/get-started/frameworks/nextjs#react-server-components-rsc
         */
        rsc?: boolean;
        /** Options passed to React root creation */
        rootOptions?: RootOptions;
    };
}
interface ReactTypes extends ReactRenderer {
    parameters: ReactParameters;
}
type StoryFnReactReturnType = JSX.Element;

export { ReactRenderer as R, ReactTypes as a };
