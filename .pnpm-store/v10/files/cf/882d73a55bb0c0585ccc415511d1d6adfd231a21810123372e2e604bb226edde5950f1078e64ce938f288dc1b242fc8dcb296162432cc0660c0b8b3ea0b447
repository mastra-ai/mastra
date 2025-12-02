"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createChildren = createChildren;
exports.createClassNameString = createClassNameString;
exports.createStyleObject = createStyleObject;
exports["default"] = createElement;
var _extends2 = _interopRequireDefault(require("@babel/runtime/helpers/extends"));
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _react = _interopRequireDefault(require("react"));
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { (0, _defineProperty2["default"])(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
// Get all possible permutations of all power sets
//
// Super simple, non-algorithmic solution since the
// number of class names will not be greater than 4
function powerSetPermutations(arr) {
  var arrLength = arr.length;
  if (arrLength === 0 || arrLength === 1) return arr;
  if (arrLength === 2) {
    // prettier-ignore
    return [arr[0], arr[1], "".concat(arr[0], ".").concat(arr[1]), "".concat(arr[1], ".").concat(arr[0])];
  }
  if (arrLength === 3) {
    return [arr[0], arr[1], arr[2], "".concat(arr[0], ".").concat(arr[1]), "".concat(arr[0], ".").concat(arr[2]), "".concat(arr[1], ".").concat(arr[0]), "".concat(arr[1], ".").concat(arr[2]), "".concat(arr[2], ".").concat(arr[0]), "".concat(arr[2], ".").concat(arr[1]), "".concat(arr[0], ".").concat(arr[1], ".").concat(arr[2]), "".concat(arr[0], ".").concat(arr[2], ".").concat(arr[1]), "".concat(arr[1], ".").concat(arr[0], ".").concat(arr[2]), "".concat(arr[1], ".").concat(arr[2], ".").concat(arr[0]), "".concat(arr[2], ".").concat(arr[0], ".").concat(arr[1]), "".concat(arr[2], ".").concat(arr[1], ".").concat(arr[0])];
  }
  if (arrLength >= 4) {
    // Currently does not support more than 4 extra
    // class names (after `.token` has been removed)
    return [arr[0], arr[1], arr[2], arr[3], "".concat(arr[0], ".").concat(arr[1]), "".concat(arr[0], ".").concat(arr[2]), "".concat(arr[0], ".").concat(arr[3]), "".concat(arr[1], ".").concat(arr[0]), "".concat(arr[1], ".").concat(arr[2]), "".concat(arr[1], ".").concat(arr[3]), "".concat(arr[2], ".").concat(arr[0]), "".concat(arr[2], ".").concat(arr[1]), "".concat(arr[2], ".").concat(arr[3]), "".concat(arr[3], ".").concat(arr[0]), "".concat(arr[3], ".").concat(arr[1]), "".concat(arr[3], ".").concat(arr[2]), "".concat(arr[0], ".").concat(arr[1], ".").concat(arr[2]), "".concat(arr[0], ".").concat(arr[1], ".").concat(arr[3]), "".concat(arr[0], ".").concat(arr[2], ".").concat(arr[1]), "".concat(arr[0], ".").concat(arr[2], ".").concat(arr[3]), "".concat(arr[0], ".").concat(arr[3], ".").concat(arr[1]), "".concat(arr[0], ".").concat(arr[3], ".").concat(arr[2]), "".concat(arr[1], ".").concat(arr[0], ".").concat(arr[2]), "".concat(arr[1], ".").concat(arr[0], ".").concat(arr[3]), "".concat(arr[1], ".").concat(arr[2], ".").concat(arr[0]), "".concat(arr[1], ".").concat(arr[2], ".").concat(arr[3]), "".concat(arr[1], ".").concat(arr[3], ".").concat(arr[0]), "".concat(arr[1], ".").concat(arr[3], ".").concat(arr[2]), "".concat(arr[2], ".").concat(arr[0], ".").concat(arr[1]), "".concat(arr[2], ".").concat(arr[0], ".").concat(arr[3]), "".concat(arr[2], ".").concat(arr[1], ".").concat(arr[0]), "".concat(arr[2], ".").concat(arr[1], ".").concat(arr[3]), "".concat(arr[2], ".").concat(arr[3], ".").concat(arr[0]), "".concat(arr[2], ".").concat(arr[3], ".").concat(arr[1]), "".concat(arr[3], ".").concat(arr[0], ".").concat(arr[1]), "".concat(arr[3], ".").concat(arr[0], ".").concat(arr[2]), "".concat(arr[3], ".").concat(arr[1], ".").concat(arr[0]), "".concat(arr[3], ".").concat(arr[1], ".").concat(arr[2]), "".concat(arr[3], ".").concat(arr[2], ".").concat(arr[0]), "".concat(arr[3], ".").concat(arr[2], ".").concat(arr[1]), "".concat(arr[0], ".").concat(arr[1], ".").concat(arr[2], ".").concat(arr[3]), "".concat(arr[0], ".").concat(arr[1], ".").concat(arr[3], ".").concat(arr[2]), "".concat(arr[0], ".").concat(arr[2], ".").concat(arr[1], ".").concat(arr[3]), "".concat(arr[0], ".").concat(arr[2], ".").concat(arr[3], ".").concat(arr[1]), "".concat(arr[0], ".").concat(arr[3], ".").concat(arr[1], ".").concat(arr[2]), "".concat(arr[0], ".").concat(arr[3], ".").concat(arr[2], ".").concat(arr[1]), "".concat(arr[1], ".").concat(arr[0], ".").concat(arr[2], ".").concat(arr[3]), "".concat(arr[1], ".").concat(arr[0], ".").concat(arr[3], ".").concat(arr[2]), "".concat(arr[1], ".").concat(arr[2], ".").concat(arr[0], ".").concat(arr[3]), "".concat(arr[1], ".").concat(arr[2], ".").concat(arr[3], ".").concat(arr[0]), "".concat(arr[1], ".").concat(arr[3], ".").concat(arr[0], ".").concat(arr[2]), "".concat(arr[1], ".").concat(arr[3], ".").concat(arr[2], ".").concat(arr[0]), "".concat(arr[2], ".").concat(arr[0], ".").concat(arr[1], ".").concat(arr[3]), "".concat(arr[2], ".").concat(arr[0], ".").concat(arr[3], ".").concat(arr[1]), "".concat(arr[2], ".").concat(arr[1], ".").concat(arr[0], ".").concat(arr[3]), "".concat(arr[2], ".").concat(arr[1], ".").concat(arr[3], ".").concat(arr[0]), "".concat(arr[2], ".").concat(arr[3], ".").concat(arr[0], ".").concat(arr[1]), "".concat(arr[2], ".").concat(arr[3], ".").concat(arr[1], ".").concat(arr[0]), "".concat(arr[3], ".").concat(arr[0], ".").concat(arr[1], ".").concat(arr[2]), "".concat(arr[3], ".").concat(arr[0], ".").concat(arr[2], ".").concat(arr[1]), "".concat(arr[3], ".").concat(arr[1], ".").concat(arr[0], ".").concat(arr[2]), "".concat(arr[3], ".").concat(arr[1], ".").concat(arr[2], ".").concat(arr[0]), "".concat(arr[3], ".").concat(arr[2], ".").concat(arr[0], ".").concat(arr[1]), "".concat(arr[3], ".").concat(arr[2], ".").concat(arr[1], ".").concat(arr[0])];
  }
}
var classNameCombinations = {};
function getClassNameCombinations(classNames) {
  if (classNames.length === 0 || classNames.length === 1) return classNames;
  var key = classNames.join('.');
  if (!classNameCombinations[key]) {
    classNameCombinations[key] = powerSetPermutations(classNames);
  }
  return classNameCombinations[key];
}
function createStyleObject(classNames) {
  var elementStyle = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  var stylesheet = arguments.length > 2 ? arguments[2] : undefined;
  var nonTokenClassNames = classNames.filter(function (className) {
    return className !== 'token';
  });
  var classNamesCombinations = getClassNameCombinations(nonTokenClassNames);
  return classNamesCombinations.reduce(function (styleObject, className) {
    return _objectSpread(_objectSpread({}, styleObject), stylesheet[className]);
  }, elementStyle);
}
function createClassNameString(classNames) {
  return classNames.join(' ');
}
function createChildren(stylesheet, useInlineStyles) {
  var childrenCount = 0;
  return function (children) {
    childrenCount += 1;
    return children.map(function (child, i) {
      return createElement({
        node: child,
        stylesheet: stylesheet,
        useInlineStyles: useInlineStyles,
        key: "code-segment-".concat(childrenCount, "-").concat(i)
      });
    });
  };
}
function createElement(_ref) {
  var node = _ref.node,
    stylesheet = _ref.stylesheet,
    _ref$style = _ref.style,
    style = _ref$style === void 0 ? {} : _ref$style,
    useInlineStyles = _ref.useInlineStyles,
    key = _ref.key;
  var properties = node.properties,
    type = node.type,
    TagName = node.tagName,
    value = node.value;
  if (type === 'text') {
    return value;
  } else if (TagName) {
    var childrenCreator = createChildren(stylesheet, useInlineStyles);
    var props;
    if (!useInlineStyles) {
      props = _objectSpread(_objectSpread({}, properties), {}, {
        className: createClassNameString(properties.className)
      });
    } else {
      var allStylesheetSelectors = Object.keys(stylesheet).reduce(function (classes, selector) {
        selector.split('.').forEach(function (className) {
          if (!classes.includes(className)) classes.push(className);
        });
        return classes;
      }, []);

      // For compatibility with older versions of react-syntax-highlighter
      var startingClassName = properties.className && properties.className.includes('token') ? ['token'] : [];
      var className = properties.className && startingClassName.concat(properties.className.filter(function (className) {
        return !allStylesheetSelectors.includes(className);
      }));
      props = _objectSpread(_objectSpread({}, properties), {}, {
        className: createClassNameString(className) || undefined,
        style: createStyleObject(properties.className, Object.assign({}, properties.style, style), stylesheet)
      });
    }
    var children = childrenCreator(node.children);
    return /*#__PURE__*/_react["default"].createElement(TagName, (0, _extends2["default"])({
      key: key
    }, props), children);
  }
}