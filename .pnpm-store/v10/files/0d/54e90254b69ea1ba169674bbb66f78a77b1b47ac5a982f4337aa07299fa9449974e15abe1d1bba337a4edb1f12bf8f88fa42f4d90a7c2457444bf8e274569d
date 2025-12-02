function makeUncaughtExceptionHandler(captureFn, onFatalFn) {
    let calledFatalError = false;
    return Object.assign((error)=>{
        const userProvidedListenersCount = global.process.listeners('uncaughtException').filter((listener)=>'domainUncaughtExceptionClear' !== listener.name && true !== listener._posthogErrorHandler).length;
        const processWouldExit = 0 === userProvidedListenersCount;
        captureFn(error, {
            mechanism: {
                type: 'onuncaughtexception',
                handled: false
            }
        });
        if (!calledFatalError && processWouldExit) {
            calledFatalError = true;
            onFatalFn(error);
        }
    }, {
        _posthogErrorHandler: true
    });
}
function addUncaughtExceptionListener(captureFn, onFatalFn) {
    global.process.on('uncaughtException', makeUncaughtExceptionHandler(captureFn, onFatalFn));
}
function addUnhandledRejectionListener(captureFn) {
    global.process.on('unhandledRejection', (reason)=>captureFn(reason, {
            mechanism: {
                type: 'onunhandledrejection',
                handled: false
            }
        }));
}
export { addUncaughtExceptionListener, addUnhandledRejectionListener };
