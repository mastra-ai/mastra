import { createEffect } from '../utils/create-effect.mjs';

const propEffect = /*@__PURE__*/ createEffect((subject, state, key, value) => {
    return state.set(key, value, () => {
        subject[key] = state.latest[key];
    }, undefined, false);
});

export { propEffect };
