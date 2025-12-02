import runResolver from './utils/runResolver.js';
var ChainingLogic;
(function (ChainingLogic) {
    ChainingLogic[ChainingLogic["ALL"] = 0] = "ALL";
    ChainingLogic[ChainingLogic["FIRST_FOUND"] = 1] = "FIRST_FOUND";
})(ChainingLogic || (ChainingLogic = {}));
class ChainResolver {
    constructor(resolvers, options) {
        this.resolvers = resolvers;
        this.options = options;
    }
    resolveFirstOnly(file) {
        for (const resolver of this.resolvers) {
            const components = runResolver(resolver, file);
            if (components.length > 0) {
                return components;
            }
        }
        return [];
    }
    resolveAll(file) {
        const allComponents = new Set();
        for (const resolver of this.resolvers) {
            const components = runResolver(resolver, file);
            components.forEach((component) => {
                allComponents.add(component);
            });
        }
        return Array.from(allComponents);
    }
    resolve(file) {
        if (this.options.chainingLogic === ChainingLogic.FIRST_FOUND) {
            return this.resolveFirstOnly(file);
        }
        return this.resolveAll(file);
    }
}
ChainResolver.Logic = ChainingLogic;
export default ChainResolver;
