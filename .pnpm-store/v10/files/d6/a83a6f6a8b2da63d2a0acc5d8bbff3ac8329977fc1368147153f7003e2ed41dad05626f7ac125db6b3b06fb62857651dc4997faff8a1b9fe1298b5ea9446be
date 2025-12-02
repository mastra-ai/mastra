import { visitors } from '@babel/traverse';
import resolveToValue from './resolveToValue.js';
import { ignore, shallowIgnoreVisitors } from './traverse.js';
const explodedVisitors = visitors.explode({
    ...shallowIgnoreVisitors,
    Function: { enter: ignore },
    ReturnStatement: {
        enter: function (nodePath, state) {
            const argument = nodePath.get('argument');
            if (argument.hasNode()) {
                state.returnPath = resolveToValue(argument);
                return nodePath.stop();
            }
            nodePath.skip();
        },
    },
});
export default function resolveFunctionDefinitionToReturnValue(path) {
    const body = path.get('body');
    const state = {};
    body.traverse(explodedVisitors, state);
    return state.returnPath || null;
}
