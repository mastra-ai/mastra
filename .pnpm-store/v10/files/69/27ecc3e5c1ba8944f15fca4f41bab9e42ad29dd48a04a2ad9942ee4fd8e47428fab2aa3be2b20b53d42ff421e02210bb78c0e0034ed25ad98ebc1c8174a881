type LoadScriptOptions = {
    async?: boolean;
    defer?: boolean;
    crossOrigin?: 'anonymous' | 'use-credentials';
    nonce?: string;
    beforeLoad?: (script: HTMLScriptElement) => void;
};
declare function loadScript(src: string | undefined, opts: LoadScriptOptions): Promise<HTMLScriptElement>;

export { loadScript };
