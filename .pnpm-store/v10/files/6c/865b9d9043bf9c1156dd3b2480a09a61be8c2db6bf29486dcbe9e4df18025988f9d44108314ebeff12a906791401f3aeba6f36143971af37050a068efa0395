import { M as Meta } from './public-types-d899d203.js';
export { A as AddMocks, D as Decorator, L as Loader, P as Preview, b as StoryContext, S as StoryFn, a as StoryObj } from './public-types-d899d203.js';
import { NamedOrDefaultProjectAnnotations, NormalizedProjectAnnotations, ProjectAnnotations, Args, StoryAnnotationsOrFn, ComposedStoryFn, Store_CSFExports, StoriesWithPartialProps } from 'storybook/internal/types';
export { ArgTypes, Args, Parameters, StrictArgs } from 'storybook/internal/types';
import { R as ReactRenderer } from './types-7abe74eb.js';
export { a as ReactTypes } from './types-7abe74eb.js';
export { ReactPreview, ReactStory, __definePreview } from './preview.js';
import 'react';
import 'react-dom/client';
import 'storybook/internal/csf';

/**
 * Function that sets the globalConfig of your storybook. The global config is the preview module of
 * your .storybook folder.
 *
 * It should be run a single time, so that your global config (e.g. decorators) is applied to your
 * stories when using `composeStories` or `composeStory`.
 *
 * Example:
 *
 * ```jsx
 * // setup-file.js
 * import { setProjectAnnotations } from '@storybook/react';
 * import projectAnnotations from './.storybook/preview';
 *
 * setProjectAnnotations(projectAnnotations);
 * ```
 *
 * @param projectAnnotations - E.g. (import * as projectAnnotations from '../.storybook/preview')
 */
declare function setProjectAnnotations(projectAnnotations: NamedOrDefaultProjectAnnotations<any> | NamedOrDefaultProjectAnnotations<any>[]): NormalizedProjectAnnotations<ReactRenderer>;
declare const INTERNAL_DEFAULT_PROJECT_ANNOTATIONS: ProjectAnnotations<ReactRenderer>;
/**
 * Function that will receive a story along with meta (e.g. a default export from a .stories file)
 * and optionally projectAnnotations e.g. (import * as projectAnnotations from
 * '../.storybook/preview) and will return a composed component that has all
 * args/parameters/decorators/etc combined and applied to it.
 *
 * It's very useful for reusing a story in scenarios outside of Storybook like unit testing.
 *
 * Example:
 *
 * ```jsx
 * import { render } from '@testing-library/react';
 * import { composeStory } from '@storybook/react';
 * import Meta, { Primary as PrimaryStory } from './Button.stories';
 *
 * const Primary = composeStory(PrimaryStory, Meta);
 *
 * test('renders primary button with Hello World', () => {
 *   const { getByText } = render(<Primary>Hello world</Primary>);
 *   expect(getByText(/Hello world/i)).not.toBeNull();
 * });
 * ```
 *
 * @param story
 * @param componentAnnotations - E.g. (import Meta from './Button.stories')
 * @param [projectAnnotations] - E.g. (import * as projectAnnotations from '../.storybook/preview')
 *   this can be applied automatically if you use `setProjectAnnotations` in your setup files.
 * @param [exportsName] - In case your story does not contain a name and you want it to have a name.
 */
declare function composeStory<TArgs extends Args = Args>(story: StoryAnnotationsOrFn<ReactRenderer, TArgs>, componentAnnotations: Meta<TArgs | any>, projectAnnotations?: ProjectAnnotations<ReactRenderer>, exportsName?: string): ComposedStoryFn<ReactRenderer, Partial<TArgs>>;
/**
 * Function that will receive a stories import (e.g. `import * as stories from './Button.stories'`)
 * and optionally projectAnnotations (e.g. `import * as projectAnnotations from
 * '../.storybook/preview`) and will return an object containing all the stories passed, but now as
 * a composed component that has all args/parameters/decorators/etc combined and applied to it.
 *
 * It's very useful for reusing stories in scenarios outside of Storybook like unit testing.
 *
 * Example:
 *
 * ```jsx
 * import { render } from '@testing-library/react';
 * import { composeStories } from '@storybook/react';
 * import * as stories from './Button.stories';
 *
 * const { Primary, Secondary } = composeStories(stories);
 *
 * test('renders primary button with Hello World', () => {
 *   const { getByText } = render(<Primary>Hello world</Primary>);
 *   expect(getByText(/Hello world/i)).not.toBeNull();
 * });
 * ```
 *
 * @param csfExports - E.g. (import * as stories from './Button.stories')
 * @param [projectAnnotations] - E.g. (import * as projectAnnotations from '../.storybook/preview')
 *   this can be applied automatically if you use `setProjectAnnotations` in your setup files.
 */
declare function composeStories<TModule extends Store_CSFExports<ReactRenderer, any>>(csfExports: TModule, projectAnnotations?: ProjectAnnotations<ReactRenderer>): Omit<StoriesWithPartialProps<ReactRenderer, TModule>, keyof Store_CSFExports>;

export { INTERNAL_DEFAULT_PROJECT_ANNOTATIONS, Meta, ReactRenderer, composeStories, composeStory, setProjectAnnotations };
