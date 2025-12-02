export * from '@storybook/react';
export { __definePreview as definePreview } from '@storybook/react';
import { StorybookConfig as StorybookConfig$1, TypescriptOptions as TypescriptOptions$1, CompatibleString } from 'storybook/internal/types';
import { BuilderOptions, StorybookConfigVite } from '@storybook/builder-vite';
import docgenTypescript from '@joshwooding/vite-plugin-react-docgen-typescript';

type FrameworkName = CompatibleString<'@storybook/react-vite'>;
type BuilderName = CompatibleString<'@storybook/builder-vite'>;
type FrameworkOptions = {
    builder?: BuilderOptions;
    strictMode?: boolean;
    /**
     * Use React's legacy root API to mount components
     *
     * React has introduced a new root API with React 18.x to enable a whole set of new features (e.g.
     * concurrent features) If this flag is true, the legacy Root API is used to mount components to
     * make it easier to migrate step by step to React 18.
     *
     * @default false
     */
    legacyRootApi?: boolean;
};
type StorybookConfigFramework = {
    framework: FrameworkName | {
        name: FrameworkName;
        options: FrameworkOptions;
    };
    core?: StorybookConfig$1['core'] & {
        builder?: BuilderName | {
            name: BuilderName;
            options: BuilderOptions;
        };
    };
};
type TypescriptOptions = TypescriptOptions$1 & {
    /**
     * Sets the type of Docgen when working with React and TypeScript
     *
     * @default `'react-docgen'`
     */
    reactDocgen: 'react-docgen-typescript' | 'react-docgen' | false;
    /** Configures `@joshwooding/vite-plugin-react-docgen-typescript` */
    reactDocgenTypescriptOptions: Parameters<typeof docgenTypescript>[0];
};
/** The interface for Storybook configuration in `main.ts` files. */
type StorybookConfig = Omit<StorybookConfig$1, keyof StorybookConfigVite | keyof StorybookConfigFramework | 'typescript'> & StorybookConfigVite & StorybookConfigFramework & {
    typescript?: Partial<TypescriptOptions>;
};

export { FrameworkOptions, StorybookConfig };
