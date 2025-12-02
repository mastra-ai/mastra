import { PresetProperty } from 'storybook/internal/types';

declare const addons: PresetProperty<'addons'>;
declare const previewAnnotations: PresetProperty<'previewAnnotations'>;
/**
 * Try to resolve react and react-dom from the root node_modules of the project addon-docs uses this
 * to alias react and react-dom to the project's version when possible If the user doesn't have an
 * explicit dependency on react this will return the existing values Which will be the versions
 * shipped with addon-docs
 *
 * We do the exact same thing in the common preset, but that will fail in Yarn PnP because
 *
 * Storybook/internal/core-server doesn't have a peer dependency on react This will make
 *
 * @storybook/react projects work in Yarn PnP
 */
declare const resolvedReact: (existing: any) => Promise<any>;

export { addons, previewAnnotations, resolvedReact };
