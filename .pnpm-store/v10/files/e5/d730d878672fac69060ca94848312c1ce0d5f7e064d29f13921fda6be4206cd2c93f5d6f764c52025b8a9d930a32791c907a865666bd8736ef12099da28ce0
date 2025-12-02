import { EnrichCsfOptions } from 'storybook/internal/csf-tools';

interface LoaderContext {
    async: () => (err: Error | null, result?: string, map?: any) => void;
    getOptions: () => EnrichCsfOptions;
    resourcePath: string;
}
declare function loader(this: LoaderContext, content: string, map: any): Promise<void>;

export { loader as default };
