import { hover, frame } from 'motion-dom';
import { extractEventInfo } from '../events/event-info.mjs';
import { Feature } from '../motion/features/Feature.mjs';

function handleHoverEvent(node, event, lifecycle) {
    const { props } = node;
    if (node.animationState && props.whileHover) {
        node.animationState.setActive("whileHover", lifecycle === "Start");
    }
    const eventName = ("onHover" + lifecycle);
    const callback = props[eventName];
    if (callback) {
        frame.postRender(() => callback(event, extractEventInfo(event)));
    }
}
class HoverGesture extends Feature {
    mount() {
        const { current } = this.node;
        if (!current)
            return;
        this.unmount = hover(current, (_element, startEvent) => {
            handleHoverEvent(this.node, startEvent, "Start");
            return (endEvent) => handleHoverEvent(this.node, endEvent, "End");
        });
    }
    unmount() { }
}

export { HoverGesture };
