import { GroupAnimation } from './GroupAnimation.mjs';

class GroupAnimationWithThen extends GroupAnimation {
    then(onResolve, _onReject) {
        return this.finished.finally(onResolve).then(() => { });
    }
}

export { GroupAnimationWithThen };
