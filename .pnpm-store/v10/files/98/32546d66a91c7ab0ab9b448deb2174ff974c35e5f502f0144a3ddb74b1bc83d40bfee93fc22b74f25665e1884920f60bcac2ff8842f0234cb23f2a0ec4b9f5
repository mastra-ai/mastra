import { Scope as BaseScope } from '@babel/traverse';
class TypeBinding {
    constructor(data) {
        this.identifier = data.identifier;
        this.identifierPath = data.identifierPath;
        this.path = data.path;
        this.scope = data.scope;
        this.typeKind = data.typeKind;
    }
}
function registerTypeBinding(typeKind, path, bindingPath) {
    const id = path.node;
    const { name } = id;
    const local = this.getOwnTypeBinding(name);
    if (local) {
        if (local.identifier === id)
            return;
        if (
        // <!>: does collide,
        // <=>: does not collide (type merging)
        //
        // enum <!> interface
        // enum <!> alias
        // interface <!> alias
        // alias <!> alias
        // interface <=> interface
        // enum <=> enum
        typeKind !== local.typeKind ||
            typeKind === 'alias' ||
            local.typeKind === 'alias') {
            throw this.hub.buildError(id, `Duplicate type declaration "${name}"`, TypeError);
        }
    }
    else {
        this.typeBindings[name] = new TypeBinding({
            identifier: id,
            identifierPath: path,
            path: bindingPath,
            scope: this,
            typeKind,
        });
    }
}
function getTypeBinding(name) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let scope = this;
    do {
        const binding = scope.getOwnTypeBinding(name);
        if (binding) {
            return binding;
        }
    } while ((scope = scope.parent));
    return undefined;
}
function getOwnTypeBinding(name) {
    return this.typeBindings[name];
}
function registerDeclaration(path) {
    if (path.isTSTypeAliasDeclaration()) {
        this.registerTypeBinding('alias', path.get('id'), path);
    }
    else if (path.isTSInterfaceDeclaration()) {
        this.registerTypeBinding('interface', path.get('id'), path);
    }
    else if (path.isTSEnumDeclaration()) {
        this.registerTypeBinding('enum', path.get('id'), path);
    }
    else {
        this._realRegisterDeclaration(path);
    }
}
export default function initialize(scopeClass) {
    // @ts-expect-error The typ assumes getTypeBinding is always set,
    // but we know we have to do that once and that is here
    if (scopeClass.prototype.getTypeBinding) {
        return;
    }
    scopeClass.prototype.getTypeBinding = getTypeBinding;
    scopeClass.prototype.registerTypeBinding = registerTypeBinding;
    scopeClass.prototype.getOwnTypeBinding = getOwnTypeBinding;
    scopeClass.prototype._realRegisterDeclaration =
        scopeClass.prototype.registerDeclaration;
    scopeClass.prototype.registerDeclaration = registerDeclaration;
    scopeClass.prototype._realCrawl = scopeClass.prototype.crawl;
    scopeClass.prototype.crawl = function () {
        this.typeBindings = Object.create(null);
        this._realCrawl();
    };
}
initialize(BaseScope);
