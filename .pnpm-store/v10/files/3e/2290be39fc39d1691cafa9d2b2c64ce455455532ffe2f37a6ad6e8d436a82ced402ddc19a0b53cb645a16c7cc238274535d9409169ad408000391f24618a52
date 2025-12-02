'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var React = require('react');
var useIsomorphicLayoutEffect = require('use-isomorphic-layout-effect');

function _interopDefault (e) { return e && e.__esModule ? e : { 'default': e }; }

var React__default = /*#__PURE__*/_interopDefault(React);
var useIsomorphicLayoutEffect__default = /*#__PURE__*/_interopDefault(useIsomorphicLayoutEffect);

var useLatest = function useLatest(value) {
  var ref = React__default["default"].useRef(value);
  useIsomorphicLayoutEffect__default["default"](function () {
    ref.current = value;
  });
  return ref;
};

exports["default"] = useLatest;
