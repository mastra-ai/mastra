/* IMPORT */
import { IS_LINUX, IS_WINDOWS } from './constants.js';
/* MAIN */
//URL: https://github.com/tapjs/signal-exit/blob/03dd77a96caa309c6a02c59274d58c812a2dce45/signals.js
const Signals = ['SIGABRT', 'SIGALRM', 'SIGHUP', 'SIGINT', 'SIGTERM'];
if (!IS_WINDOWS) {
    Signals.push('SIGVTALRM', 'SIGXCPU', 'SIGXFSZ', 'SIGUSR2', 'SIGTRAP', 'SIGSYS', 'SIGQUIT', 'SIGIOT');
}
if (IS_LINUX) {
    Signals.push('SIGIO', 'SIGPOLL', 'SIGPWR', 'SIGSTKFLT', 'SIGUNUSED');
}
/* EXPORT */
export default Signals;
