import { Env, MiddlewareHandler } from 'hono';
import { SwaggerConfigs } from 'swagger-ui-dist';

type RequireOne<T, K extends keyof T = keyof T> = K extends keyof T ? PartialRequire<T, K> : never;
type PartialRequire<O, K extends keyof O> = {
    [P in K]-?: O[P];
} & O;
type DistSwaggerUIOptions = {
    configUrl?: SwaggerConfigs['configUrl'];
    deepLinking?: SwaggerConfigs['deepLinking'];
    presets?: string[];
    plugins?: string[];
    spec?: SwaggerConfigs['spec'];
    layout?: SwaggerConfigs['layout'];
    docExpansion?: SwaggerConfigs['docExpansion'];
    maxDisplayedTags?: SwaggerConfigs['maxDisplayedTags'];
    /**
     * accepts function as a string.
     *
     * @example (a, b) => a.path.localeCompare(b.path)
     */
    operationsSorter?: string;
    /**
     * accepts function as a string.
     *
     * @example (req) => req
     */
    requestInterceptor?: string;
    /**
     * accepts function as a string.
     *
     * @example (res) => res
     */
    responseInterceptor?: string;
    persistAuthorization?: boolean;
    defaultModelsExpandDepth?: number;
    defaultModelExpandDepth?: number;
    defaultModelRendering?: 'example' | 'model' | undefined;
    displayRequestDuration?: boolean;
    filter?: boolean | string;
    showExtensions?: boolean;
    showCommonExtensions?: boolean;
    queryConfigEnabled?: boolean;
    displayOperationId?: boolean;
    /**
     * accepts function as a string.
     * swagger-ui accepts alpha in the tagsSorter, but this middleware does not support it.
     *
     * @example (a, b) => a.name.localeCompare(b.name)
     */
    tagsSorter?: string;
    /**
     * accepts function as a string.
     * @example () => { console.log('Swagger UI Loaded'); }
     */
    onComplete?: string;
    syntaxHighlight?: boolean | {
        activated: boolean;
        theme: string[];
    };
    tryItOutEnabled?: boolean;
    requestSnippetsEnabled?: boolean;
    requestSnippets?: object;
    oauth2RedirectUrl?: string;
    showMutabledRequest?: boolean;
    request?: {
        curlOptions?: string[];
    };
    supportedSubmitMethods?: string[];
    validatorUrl?: string;
    withCredentials?: boolean;
    modelPropertyMacro?: string;
    parameterMacro?: string;
} & RequireOne<{
    url?: SwaggerConfigs['url'];
    urls?: SwaggerConfigs['urls'];
}>;

interface AssetURLs {
    css: string[];
    js: string[];
}

type OriginalSwaggerUIOptions = {
    version?: string;
    /**
     * manuallySwaggerUIHtml is a string that is used to render SwaggerUI.
     * If this is set, all other options will be ignored except version.
     * The string will be inserted into the body of the HTML.
     * This is useful when you want to fully customize the UI.
     *
     * @example
     * ```ts
     * const swaggerUI = SwaggerUI({
     *   manuallySwaggerUIHtml: (asset) => `
     *   <div>
     *     <div id="swagger-ui"></div>
     *     ${asset.css.map((url) => `<link rel="stylesheet" href="${url}" />`)}
     *     ${asset.js.map((url) => `<script src="${url}" crossorigin="anonymous"></script>`)}
     *     <script>
     *       window.onload = () => {
     *         window.ui = SwaggerUIBundle({
     *           dom_id: '#swagger-ui',
     *           url: 'https://petstore.swagger.io/v2/swagger.json',
     *         })
     *       }
     *     </script>
     *   </div>
     *   `,
     * })
     * ```
     */
    manuallySwaggerUIHtml?: (asset: AssetURLs) => string;
    title?: string;
};
type SwaggerUIOptions = OriginalSwaggerUIOptions & DistSwaggerUIOptions;
declare const SwaggerUI: (options: SwaggerUIOptions) => string;
declare const middleware: <E extends Env>(options: SwaggerUIOptions) => MiddlewareHandler<E>;

export { SwaggerUI, type SwaggerUIOptions, middleware as swaggerUI };
