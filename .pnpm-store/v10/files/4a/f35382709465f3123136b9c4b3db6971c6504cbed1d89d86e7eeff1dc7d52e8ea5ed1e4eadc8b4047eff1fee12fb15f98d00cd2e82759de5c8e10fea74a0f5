import parseJsDoc from '../utils/parseJsDoc.js';
function removeEmpty(obj) {
    return Object.fromEntries(Object.entries(obj).filter(([, v]) => v != null));
}
function merge(obj1, obj2) {
    if (obj1 == null && obj2 == null) {
        return null;
    }
    const merged = {
        ...removeEmpty(obj1 ?? {}),
        ...removeEmpty(obj2 ?? {}),
    };
    return merged;
}
/**
 * Extract info from the methods jsdoc blocks. Must be run after
 * componentMethodsHandler.
 */
const componentMethodsJsDocHandler = function (documentation) {
    let methods = documentation.get('methods');
    if (!methods) {
        return;
    }
    methods = methods.map((method) => {
        if (!method.docblock) {
            return method;
        }
        const jsDoc = parseJsDoc(method.docblock);
        const returns = merge(jsDoc.returns, method.returns);
        const params = method.params.map((param) => {
            const jsDocParam = jsDoc.params.find((p) => p.name === param.name);
            return merge(jsDocParam, param);
        });
        return {
            ...method,
            description: jsDoc.description || null,
            returns,
            params,
        };
    });
    documentation.set('methods', methods);
};
export default componentMethodsJsDocHandler;
