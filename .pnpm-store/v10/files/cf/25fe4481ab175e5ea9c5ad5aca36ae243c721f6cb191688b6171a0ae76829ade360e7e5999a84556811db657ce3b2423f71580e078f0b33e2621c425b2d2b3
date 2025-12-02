"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildFilter = void 0;
function buildFilter(opts) {
    return function (prop, component) {
        var propFilter = opts.propFilter;
        // skip children property in case it has no custom documentation
        if (prop.name === 'children' &&
            prop.description.length === 0 &&
            opts.skipChildrenPropWithoutDoc !== false) {
            return false;
        }
        if (typeof propFilter === 'function') {
            var keep = propFilter(prop, component);
            if (!keep) {
                return false;
            }
        }
        else if (typeof propFilter === 'object') {
            var _a = propFilter, skipPropsWithName = _a.skipPropsWithName, skipPropsWithoutDoc = _a.skipPropsWithoutDoc;
            if (typeof skipPropsWithName === 'string' &&
                skipPropsWithName === prop.name) {
                return false;
            }
            else if (Array.isArray(skipPropsWithName) &&
                skipPropsWithName.indexOf(prop.name) > -1) {
                return false;
            }
            if (skipPropsWithoutDoc && prop.description.length === 0) {
                return false;
            }
        }
        return true;
    };
}
exports.buildFilter = buildFilter;
//# sourceMappingURL=buildFilter.js.map