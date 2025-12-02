import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import * as ObjectsAPI from "./objects.js";
import { DurableObject, DurableObjectsCursorLimitPagination, ObjectListParams, Objects } from "./objects.js";
import { SinglePage } from "../../../pagination.js";
export declare class Namespaces extends APIResource {
    objects: ObjectsAPI.Objects;
    /**
     * Returns the Durable Object namespaces owned by an account.
     */
    list(params: NamespaceListParams, options?: Core.RequestOptions): Core.PagePromise<NamespacesSinglePage, Namespace>;
}
export declare class NamespacesSinglePage extends SinglePage<Namespace> {
}
export interface Namespace {
    id?: string;
    class?: string;
    name?: string;
    script?: string;
    use_sqlite?: boolean;
}
export interface NamespaceListParams {
    /**
     * Identifier.
     */
    account_id: string;
}
export declare namespace Namespaces {
    export { type Namespace as Namespace, NamespacesSinglePage as NamespacesSinglePage, type NamespaceListParams as NamespaceListParams, };
    export { Objects as Objects, type DurableObject as DurableObject, DurableObjectsCursorLimitPagination as DurableObjectsCursorLimitPagination, type ObjectListParams as ObjectListParams, };
}
//# sourceMappingURL=namespaces.d.ts.map