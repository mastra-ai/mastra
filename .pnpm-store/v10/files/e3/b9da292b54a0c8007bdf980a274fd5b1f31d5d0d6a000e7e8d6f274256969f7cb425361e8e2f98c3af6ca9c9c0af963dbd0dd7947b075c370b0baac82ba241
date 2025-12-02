var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _DocumentationBuilder_props, _DocumentationBuilder_context, _DocumentationBuilder_childContext, _DocumentationBuilder_composes, _DocumentationBuilder_data;
class DocumentationBuilder {
    constructor() {
        _DocumentationBuilder_props.set(this, void 0);
        _DocumentationBuilder_context.set(this, void 0);
        _DocumentationBuilder_childContext.set(this, void 0);
        _DocumentationBuilder_composes.set(this, void 0);
        _DocumentationBuilder_data.set(this, void 0);
        __classPrivateFieldSet(this, _DocumentationBuilder_props, new Map(), "f");
        __classPrivateFieldSet(this, _DocumentationBuilder_context, new Map(), "f");
        __classPrivateFieldSet(this, _DocumentationBuilder_childContext, new Map(), "f");
        __classPrivateFieldSet(this, _DocumentationBuilder_composes, new Set(), "f");
        __classPrivateFieldSet(this, _DocumentationBuilder_data, new Map(), "f");
    }
    addComposes(moduleName) {
        __classPrivateFieldGet(this, _DocumentationBuilder_composes, "f").add(moduleName);
    }
    set(key, value) {
        __classPrivateFieldGet(this, _DocumentationBuilder_data, "f").set(key, value);
    }
    get(key) {
        return __classPrivateFieldGet(this, _DocumentationBuilder_data, "f").get(key);
    }
    getPropDescriptor(propName) {
        let propDescriptor = __classPrivateFieldGet(this, _DocumentationBuilder_props, "f").get(propName);
        if (!propDescriptor) {
            __classPrivateFieldGet(this, _DocumentationBuilder_props, "f").set(propName, (propDescriptor = {}));
        }
        return propDescriptor;
    }
    getContextDescriptor(propName) {
        let propDescriptor = __classPrivateFieldGet(this, _DocumentationBuilder_context, "f").get(propName);
        if (!propDescriptor) {
            __classPrivateFieldGet(this, _DocumentationBuilder_context, "f").set(propName, (propDescriptor = {}));
        }
        return propDescriptor;
    }
    getChildContextDescriptor(propName) {
        let propDescriptor = __classPrivateFieldGet(this, _DocumentationBuilder_childContext, "f").get(propName);
        if (!propDescriptor) {
            __classPrivateFieldGet(this, _DocumentationBuilder_childContext, "f").set(propName, (propDescriptor = {}));
        }
        return propDescriptor;
    }
    build() {
        const obj = {};
        for (const [key, value] of __classPrivateFieldGet(this, _DocumentationBuilder_data, "f")) {
            // @ts-expect-error custom handlers can add any properties to Documentation
            obj[key] = value;
        }
        if (__classPrivateFieldGet(this, _DocumentationBuilder_props, "f").size > 0) {
            obj.props = {};
            for (const [propName, propDescriptor] of __classPrivateFieldGet(this, _DocumentationBuilder_props, "f")) {
                if (Object.keys(propDescriptor).length > 0) {
                    obj.props[propName] = propDescriptor;
                }
            }
        }
        if (__classPrivateFieldGet(this, _DocumentationBuilder_context, "f").size > 0) {
            obj.context = {};
            for (const [contextName, contextDescriptor] of __classPrivateFieldGet(this, _DocumentationBuilder_context, "f")) {
                if (Object.keys(contextDescriptor).length > 0) {
                    obj.context[contextName] = contextDescriptor;
                }
            }
        }
        if (__classPrivateFieldGet(this, _DocumentationBuilder_childContext, "f").size > 0) {
            obj.childContext = {};
            for (const [childContextName, childContextDescriptor] of __classPrivateFieldGet(this, _DocumentationBuilder_childContext, "f")) {
                obj.childContext[childContextName] = childContextDescriptor;
            }
        }
        if (__classPrivateFieldGet(this, _DocumentationBuilder_composes, "f").size > 0) {
            obj.composes = Array.from(__classPrivateFieldGet(this, _DocumentationBuilder_composes, "f"));
        }
        return obj;
    }
}
_DocumentationBuilder_props = new WeakMap(), _DocumentationBuilder_context = new WeakMap(), _DocumentationBuilder_childContext = new WeakMap(), _DocumentationBuilder_composes = new WeakMap(), _DocumentationBuilder_data = new WeakMap();
export default DocumentationBuilder;
