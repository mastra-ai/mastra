import { supportsLinearEasing } from '../../../utils/supports/linear-easing.mjs';
import { isGenerator } from '../../generators/utils/is-generator.mjs';

function applyGeneratorOptions({ type, ...options }) {
    if (isGenerator(type) && supportsLinearEasing()) {
        return type.applyToOptions(options);
    }
    else {
        options.duration ?? (options.duration = 300);
        options.ease ?? (options.ease = "easeOut");
    }
    return options;
}

export { applyGeneratorOptions };
