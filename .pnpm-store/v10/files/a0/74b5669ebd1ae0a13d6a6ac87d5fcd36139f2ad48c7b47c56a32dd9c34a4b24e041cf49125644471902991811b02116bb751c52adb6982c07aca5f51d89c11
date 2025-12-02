import { MotionValue, transformProps, acceleratedValues } from 'motion-dom';

class WillChangeMotionValue extends MotionValue {
    constructor() {
        super(...arguments);
        this.isEnabled = false;
    }
    add(name) {
        if (transformProps.has(name) || acceleratedValues.has(name)) {
            this.isEnabled = true;
            this.update();
        }
    }
    update() {
        this.set(this.isEnabled ? "transform" : "auto");
    }
}

export { WillChangeMotionValue };
