"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var chai_1 = require("chai");
var buildFilter_1 = require("../buildFilter");
function createProp(name, required, defaultValue, description, type, parent) {
    if (required === void 0) { required = false; }
    if (description === void 0) { description = ''; }
    if (type === void 0) { type = { name: 'string' }; }
    return {
        defaultValue: defaultValue,
        description: description,
        name: name,
        parent: parent,
        required: required,
        type: type
    };
}
describe('buildFilter', function () {
    describe('default behaviour', function () {
        it('should skip "children" property if no description is set', function () {
            var prop1 = createProp('prop1', false, undefined, 'prop1 description');
            var prop2 = createProp('prop2', false, undefined, 'prop2 description');
            var children = createProp('children', false, undefined, '');
            var opts = {};
            var filterFn = buildFilter_1.buildFilter(opts);
            chai_1.expect([prop1, prop2, children].filter(function (prop) {
                return filterFn(prop, { name: prop.name });
            })).to.eql([prop1, prop2]);
        });
        it('should not skip "children" property if description is set', function () {
            var prop1 = createProp('prop1', false, undefined, 'prop1 description');
            var prop2 = createProp('prop2', false, undefined, 'prop2 description');
            var children = createProp('children', false, undefined, 'children description');
            var opts = {};
            var filterFn = buildFilter_1.buildFilter(opts);
            chai_1.expect([prop1, prop2, children].filter(function (prop) {
                return filterFn(prop, { name: prop.name });
            })).to.eql([prop1, prop2, children]);
        });
    });
    describe('static prop filter', function () {
        describe('skipPropsWithName', function () {
            it('should skip single prop by name', function () {
                var prop1 = createProp('prop1', false, undefined, 'prop1 description');
                var prop2 = createProp('prop2', false, undefined, 'prop2 description');
                var opts = {
                    propFilter: { skipPropsWithName: 'prop1' }
                };
                var filterFn = buildFilter_1.buildFilter(opts);
                chai_1.expect([prop1, prop2].filter(function (prop) { return filterFn(prop, { name: prop.name }); })).to.eql([prop2]);
            });
            it('should skip multiple props by name', function () {
                var prop1 = createProp('prop1', false, undefined, 'prop1 description');
                var prop2 = createProp('prop2', false, undefined, 'prop2 description');
                var prop3 = createProp('prop3', false, undefined, 'prop3 description');
                var opts = {
                    propFilter: { skipPropsWithName: ['prop1', 'prop3'] }
                };
                var filterFn = buildFilter_1.buildFilter(opts);
                chai_1.expect([prop1, prop2, prop3].filter(function (prop) {
                    return filterFn(prop, { name: prop.name });
                })).to.eql([prop2]);
            });
        });
        describe('skipPropsWithoutDoc', function () {
            it('should skip children props with no documentation', function () {
                var prop1 = createProp('prop1', false, undefined, 'prop1 description');
                var prop2 = createProp('prop2', false, undefined, '');
                var opts = {
                    propFilter: { skipPropsWithoutDoc: true }
                };
                var filterFn = buildFilter_1.buildFilter(opts);
                chai_1.expect([prop1, prop2].filter(function (prop) { return filterFn(prop, { name: prop.name }); })).to.eql([prop1]);
            });
        });
    });
    describe('dynamic prop filter', function () {
        it('should skip props based on dynamic filter rule', function () {
            var prop1 = createProp('foo', false, undefined, 'foo description');
            var prop2 = createProp('bar', false, undefined, 'bar description');
            var prop3 = createProp('foobar', false, undefined, 'foobar description');
            var opts = {
                propFilter: function (prop, component) { return prop.name.indexOf('foo') === -1; }
            };
            var filterFn = buildFilter_1.buildFilter(opts);
            chai_1.expect([prop1, prop2, prop3].filter(function (prop) {
                return filterFn(prop, { name: prop.name });
            })).to.eql([prop2]);
        });
        it('should get be possible to filter by component name', function () {
            var prop1 = createProp('foo', false, undefined, 'foo description');
            var prop2 = createProp('bar', false, undefined, 'bar description');
            var prop3 = createProp('foobar', false, undefined, 'foobar description');
            var opts = {
                propFilter: function (prop, component) { return component.name.indexOf('BAR') === -1; }
            };
            var filterFn = buildFilter_1.buildFilter(opts);
            chai_1.expect([prop1, prop2, prop3].filter(function (prop) {
                return filterFn(prop, { name: prop.name.toUpperCase() });
            })).to.eql([prop1]);
        });
        it('should be possible to filter by interface in which prop was declared.', function () {
            var stringType = { name: 'string' };
            var htmlAttributesInterface = {
                fileName: 'node_modules/@types/react/index.d.ts',
                name: 'HTMLAttributes'
            };
            var excludedType = { name: 'ExcludedType', fileName: 'src/types.ts' };
            var prop1 = createProp('foo', false, undefined, 'foo description', stringType);
            var prop2 = createProp('bar', false, undefined, 'bar description', stringType, excludedType);
            var prop3 = createProp('onFocus', false, undefined, 'onFocus description', stringType, htmlAttributesInterface);
            var opts = {
                propFilter: function (prop, component) {
                    if (prop.parent == null) {
                        return true;
                    }
                    if (prop.parent.fileName.indexOf('@types/react/index.d.ts') > -1) {
                        return false;
                    }
                    return prop.parent.name !== 'ExcludedType';
                }
            };
            var filterFn = buildFilter_1.buildFilter(opts);
            chai_1.expect([prop1, prop2, prop3].filter(function (prop) {
                return filterFn(prop, { name: 'SomeComponent' });
            })).to.eql([prop1]);
        });
    });
});
//# sourceMappingURL=buildFilter.js.map