import getPropertyName from './getPropertyName.js';
const componentMethods = [
    'componentDidMount',
    'componentDidReceiveProps',
    'componentDidUpdate',
    'componentWillMount',
    'UNSAFE_componentWillMount',
    'componentWillReceiveProps',
    'UNSAFE_componentWillReceiveProps',
    'componentWillUnmount',
    'componentWillUpdate',
    'UNSAFE_componentWillUpdate',
    'getChildContext',
    'getDefaultProps',
    'getInitialState',
    'render',
    'shouldComponentUpdate',
    'getDerivedStateFromProps',
    'getDerivedStateFromError',
    'getSnapshotBeforeUpdate',
    'componentDidCatch',
];
/**
 * Returns if the method path is a Component method.
 */
export default function (methodPath) {
    if (!methodPath.isClassMethod() &&
        !methodPath.isObjectMethod() &&
        !methodPath.isObjectProperty()) {
        return false;
    }
    const name = getPropertyName(methodPath);
    return Boolean(name && componentMethods.indexOf(name) !== -1);
}
