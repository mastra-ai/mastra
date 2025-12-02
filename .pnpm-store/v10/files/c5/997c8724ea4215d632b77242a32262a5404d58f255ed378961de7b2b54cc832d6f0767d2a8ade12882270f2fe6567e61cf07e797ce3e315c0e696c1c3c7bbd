import { invariant } from '@epic-web/invariant';
import { spawn } from 'cross-spawn';
import { commandConvert } from "./command.js";
import { varValueConvert } from "./variable.js";
const envSetterRegex = /(\w+)=('(.*)'|"(.*)"|(.*))/;
export function crossEnv(args, options = {}) {
    const [envSetters, command, commandArgs] = parseCommand(args);
    const env = getEnvVars(envSetters);
    if (command) {
        const spawnOptions = {
            stdio: 'inherit',
            shell: options.shell,
            env,
        };
        const proc = spawn(
        // run `path.normalize` for command(on windows)
        commandConvert(command, env, true), 
        // by default normalize is `false`, so not run for cmd args
        commandArgs.map((arg) => commandConvert(arg, env)), spawnOptions);
        process.on('SIGTERM', () => proc.kill('SIGTERM'));
        process.on('SIGINT', () => proc.kill('SIGINT'));
        process.on('SIGBREAK', () => proc.kill('SIGBREAK'));
        process.on('SIGHUP', () => proc.kill('SIGHUP'));
        proc.on('exit', (code, signal) => {
            let crossEnvExitCode = code;
            // exit code could be null when OS kills the process(out of memory, etc) or due to node handling it
            // but if the signal is SIGINT the user exited the process so we want exit code 0
            if (crossEnvExitCode === null) {
                crossEnvExitCode = signal === 'SIGINT' ? 0 : 1;
            }
            process.exit(crossEnvExitCode);
        });
        return proc;
    }
    return null;
}
function parseCommand(args) {
    const envSetters = {};
    let command = null;
    let commandArgs = [];
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (!arg)
            continue;
        const match = envSetterRegex.exec(arg);
        if (match && match[1]) {
            let value;
            if (typeof match[3] !== 'undefined') {
                value = match[3];
            }
            else if (typeof match[4] === 'undefined') {
                value = match[5] || '';
            }
            else {
                value = match[4];
            }
            envSetters[match[1]] = value;
        }
        else {
            // No more env setters, the rest of the line must be the command and args
            const cStart = args
                .slice(i)
                // Regex:
                // match "\'" or "'"
                // or match "\" if followed by [$"\] (lookahead)
                .map((a) => {
                const re = /\\\\|(\\)?'|([\\])(?=[$"\\])/g;
                // Eliminate all matches except for "\'" => "'"
                return a.replace(re, (m) => {
                    if (m === '\\\\')
                        return '\\';
                    if (m === "\\'")
                        return "'";
                    return '';
                });
            });
            const parsedCommand = cStart[0];
            invariant(parsedCommand, 'Command is required');
            command = parsedCommand;
            commandArgs = cStart.slice(1).filter(Boolean);
            break;
        }
    }
    return [envSetters, command, commandArgs];
}
function getEnvVars(envSetters) {
    const envVars = { ...process.env };
    if (process.env.APPDATA) {
        envVars.APPDATA = process.env.APPDATA;
    }
    Object.keys(envSetters).forEach((varName) => {
        const value = envSetters[varName];
        if (value !== undefined) {
            envVars[varName] = varValueConvert(value, varName);
        }
    });
    return envVars;
}
