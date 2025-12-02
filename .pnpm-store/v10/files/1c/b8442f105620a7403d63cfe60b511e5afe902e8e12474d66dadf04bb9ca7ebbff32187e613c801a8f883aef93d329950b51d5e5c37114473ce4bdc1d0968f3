"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkComponent = exports.check = exports.fixturePath = void 0;
var chai_1 = require("chai");
var lodash_1 = require("lodash");
var path = require("path");
var parser_1 = require("../parser");
function fixturePath(componentName) {
    return path.join(__dirname, '..', '..', 'src', '__tests__', 'data', "" + componentName + (componentName.includes('.ts') ? '' : '.tsx')); // it's running in ./temp
}
exports.fixturePath = fixturePath;
function check(componentName, expected, exactProperties, description, parserOpts) {
    if (exactProperties === void 0) { exactProperties = true; }
    var result = parser_1.parse(fixturePath(componentName), parserOpts);
    checkComponent(result, expected, exactProperties, description);
}
exports.check = check;
function checkComponent(actual, expected, exactProperties, description) {
    if (exactProperties === void 0) { exactProperties = true; }
    var expectedComponentNames = Object.getOwnPropertyNames(expected);
    chai_1.assert.equal(actual.length, expectedComponentNames.length, 
    // tslint:disable-next-line:max-line-length
    "The number of expected components is different - \r\nexpected: " + expectedComponentNames + ", \r\nactual: " + actual.map(function (i) { return i.displayName; }));
    var errors = [];
    var _loop_1 = function (expectedComponentName) {
        var expectedComponent = expected[expectedComponentName];
        var componentDocs = actual.filter(function (i) { return i.displayName === expectedComponentName; });
        if (componentDocs.length === 0) {
            errors.push("Component is missing - " + expectedComponentName);
            return "continue";
        }
        var componentDoc = componentDocs[0];
        var expectedPropNames = Object.getOwnPropertyNames(expectedComponent);
        var propNames = Object.getOwnPropertyNames(componentDoc.props);
        var compName = componentDoc.displayName;
        var expectedComponentDescription = compName + " description";
        if (description !== undefined) {
            expectedComponentDescription = description || '';
        }
        if (componentDoc.description !== expectedComponentDescription) {
            // tslint:disable-next-line:max-line-length
            errors.push(compName + " description is different - expected: '" + expectedComponentDescription + "', actual: '" + componentDoc.description + "'");
        }
        if (propNames.length !== expectedPropNames.length &&
            exactProperties === true) {
            // tslint:disable-next-line:max-line-length
            errors.push("Properties for " + compName + " are different - expected: " + expectedPropNames.length + ", actual: " + propNames.length + " (" + JSON.stringify(expectedPropNames) + ", " + JSON.stringify(propNames) + ")");
        }
        for (var _a = 0, expectedPropNames_1 = expectedPropNames; _a < expectedPropNames_1.length; _a++) {
            var expectedPropName = expectedPropNames_1[_a];
            var expectedProp = expectedComponent[expectedPropName];
            var prop = componentDoc.props[expectedPropName];
            if (prop === undefined) {
                errors.push("Property '" + compName + "." + expectedPropName + "' is missing");
            }
            else {
                if (expectedProp.type !== prop.type.name) {
                    // tslint:disable-next-line:max-line-length
                    errors.push("Property '" + compName + "." + expectedPropName + "' type is different - expected: " + expectedProp.type + ", actual: " + prop.type.name);
                }
                var expectedDescription = expectedProp.description === undefined
                    ? expectedPropName + " description"
                    : expectedProp.description;
                if (expectedDescription !== prop.description) {
                    errors.push(
                    // tslint:disable-next-line:max-line-length
                    "Property '" + compName + "." + expectedPropName + "' description is different - expected: " + expectedDescription + ", actual: " + prop.description);
                }
                var expectedParentFileName = expectedProp.parent
                    ? expectedProp.parent.fileName
                    : undefined;
                if (expectedParentFileName &&
                    prop.parent &&
                    expectedParentFileName !== prop.parent.fileName) {
                    errors.push(
                    // tslint:disable-next-line:max-line-length
                    "Property '" + compName + "." + expectedPropName + "' parent fileName is different - expected: " + expectedParentFileName + ", actual: " + prop.parent.fileName);
                }
                var expectedRequired = expectedProp.required === undefined ? true : expectedProp.required;
                if (expectedRequired !== prop.required) {
                    errors.push(
                    // tslint:disable-next-line:max-line-length
                    "Property '" + compName + "." + expectedPropName + "' required is different - expected: " + expectedRequired + ", actual: " + prop.required);
                }
                var expectedDefaultValue = expectedProp.defaultValue;
                var actualDefaultValue = prop.defaultValue
                    ? prop.defaultValue.value
                    : prop.defaultValue;
                if (expectedDefaultValue &&
                    expectedDefaultValue !== actualDefaultValue) {
                    errors.push(
                    // tslint:disable-next-line:max-line-length
                    "Property '" + compName + "." + expectedPropName + "' defaultValue is different - expected: " + expectedDefaultValue + ", actual: " + actualDefaultValue);
                }
                var exptectedRaw = expectedProp.raw;
                if (exptectedRaw && exptectedRaw !== prop.type.raw) {
                    // tslint:disable-next-line:max-line-length
                    errors.push("Property '" + compName + "." + expectedPropName + "' raw value is different - expected: " + exptectedRaw + ", actual: " + prop.type.raw);
                }
                var expectedValue = expectedProp.value;
                if (expectedValue && !lodash_1.isEqual(expectedValue, prop.type.value)) {
                    // tslint:disable-next-line:max-line-length
                    errors.push("Property '" + compName + "." + expectedPropName + "' value is different - expected: " + JSON.stringify(expectedValue) + ", actual: " + JSON.stringify(prop.type.value));
                }
                var expectedPropTags = expectedProp.tags;
                var propTags = prop.tags;
                if (expectedPropTags && !lodash_1.isEqual(expectedPropTags, propTags)) {
                    errors.push("Property '" + compName + "." + expectedPropName + "' tags are different - expected: " + JSON.stringify(expectedPropTags) + ", actual: " + JSON.stringify(propTags));
                }
            }
        }
    };
    for (var _i = 0, expectedComponentNames_1 = expectedComponentNames; _i < expectedComponentNames_1.length; _i++) {
        var expectedComponentName = expectedComponentNames_1[_i];
        _loop_1(expectedComponentName);
    }
    var ok = errors.length === 0;
    if (!ok) {
        // tslint:disable-next-line:no-console
        console.log(JSON.stringify(actual, null, 4));
    }
    chai_1.assert(ok, errors.join('\r\n'));
}
exports.checkComponent = checkComponent;
//# sourceMappingURL=testUtils.js.map