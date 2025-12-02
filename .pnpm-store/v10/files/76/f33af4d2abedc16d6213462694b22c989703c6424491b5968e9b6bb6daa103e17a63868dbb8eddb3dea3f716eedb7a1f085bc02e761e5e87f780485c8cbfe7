import { isControllingVariants } from '../../render/utils/is-controlling-variants.mjs';
import { isVariantLabel } from '../../render/utils/is-variant-label.mjs';

function getCurrentTreeVariants(props, context) {
    if (isControllingVariants(props)) {
        const { initial, animate } = props;
        return {
            initial: initial === false || isVariantLabel(initial)
                ? initial
                : undefined,
            animate: isVariantLabel(animate) ? animate : undefined,
        };
    }
    return props.inherit !== false ? context : {};
}

export { getCurrentTreeVariants };
