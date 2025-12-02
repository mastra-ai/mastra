import path from 'path';
import { isWindows } from "./is-windows.js";
/**
 * Converts an environment variable usage to be appropriate for the current OS
 * @param command Command to convert
 * @param env Map of the current environment variable names and their values
 * @param normalize If the command should be normalized using `path` after converting
 * @returns Converted command
 */
export function commandConvert(command, env, normalize = false) {
    if (!isWindows()) {
        return command;
    }
    // Handle simple variables: $var or ${var}
    const simpleEnvRegex = /\$(\w+)|\${(\w+)}/g;
    // Handle bash parameter expansion with default values: ${var:-default}
    const defaultValueRegex = /\$\{(\w+):-([^}]+)\}/g;
    let convertedCmd = command;
    // First, handle bash parameter expansion with default values
    convertedCmd = convertedCmd.replace(defaultValueRegex, (match, varName, defaultValue) => {
        // If the variable exists, use its value; otherwise use the default
        const value = env[varName] || defaultValue;
        return value;
    });
    // Then handle simple variable references
    convertedCmd = convertedCmd.replace(simpleEnvRegex, (match, $1, $2) => {
        const varName = $1 || $2;
        // In Windows, non-existent variables are not replaced by the shell,
        // so for example "echo %FOO%" will literally print the string "%FOO%", as
        // opposed to printing an empty string in UNIX. See kentcdodds/cross-env#145
        // If the env variable isn't defined at runtime, just strip it from the command entirely
        return env[varName] ? `%${varName}%` : '';
    });
    // Normalization is required for commands with relative paths
    // For example, `./cmd.bat`. See kentcdodds/cross-env#127
    // However, it should not be done for command arguments.
    // See https://github.com/kentcdodds/cross-env/pull/130#issuecomment-319887970
    return normalize === true ? path.normalize(convertedCmd) : convertedCmd;
}
