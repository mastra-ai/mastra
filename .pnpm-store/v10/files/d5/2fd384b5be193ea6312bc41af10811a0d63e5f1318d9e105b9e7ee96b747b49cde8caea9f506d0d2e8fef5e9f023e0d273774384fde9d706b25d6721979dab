export interface Options {
	/**
	__Don't use this option unless you really have to!__

	Suffix appended to the project name to avoid name conflicts with native apps. Pass an empty string to disable it.

	@default 'nodejs'
	*/
	readonly suffix?: string;
}

export interface Paths {
	/**
	Directory for data files.

	Example locations (with the default `nodejs` suffix):

	- macOS: `~/Library/Application Support/MyApp-nodejs`
	- Windows: `%LOCALAPPDATA%\MyApp-nodejs\Data` (for example, `C:\Users\USERNAME\AppData\Local\MyApp-nodejs\Data`)
	- Linux: `~/.local/share/MyApp-nodejs` (or `$XDG_DATA_HOME/MyApp-nodejs`)
	*/
	readonly data: string;

	/**
	Directory for data files.

	Example locations (with the default `nodejs` suffix):

	- macOS: `~/Library/Preferences/MyApp-nodejs`
	- Windows: `%APPDATA%\MyApp-nodejs\Config` (for example, `C:\Users\USERNAME\AppData\Roaming\MyApp-nodejs\Config`)
	- Linux: `~/.config/MyApp-nodejs` (or `$XDG_CONFIG_HOME/MyApp-nodejs`)
	*/
	readonly config: string;

	/**
	Directory for non-essential data files.

	Example locations (with the default `nodejs` suffix):

	- macOS: `~/Library/Caches/MyApp-nodejs`
	- Windows: `%LOCALAPPDATA%\MyApp-nodejs\Cache` (for example, `C:\Users\USERNAME\AppData\Local\MyApp-nodejs\Cache`)
	- Linux: `~/.cache/MyApp-nodejs` (or `$XDG_CACHE_HOME/MyApp-nodejs`)
	*/
	readonly cache: string;

	/**
	Directory for log files.

	Example locations (with the default `nodejs` suffix):

	- macOS: `~/Library/Logs/MyApp-nodejs`
	- Windows: `%LOCALAPPDATA%\MyApp-nodejs\Log` (for example, `C:\Users\USERNAME\AppData\Local\MyApp-nodejs\Log`)
	- Linux: `~/.local/state/MyApp-nodejs` (or `$XDG_STATE_HOME/MyApp-nodejs`)
	*/
	readonly log: string;

	/**
	Directory for temporary files.

	Example locations (with the default `nodejs` suffix):

	- macOS: `/var/folders/jf/f2twvvvs5jl_m49tf034ffpw0000gn/T/MyApp-nodejs`
	- Windows: `%LOCALAPPDATA%\Temp\MyApp-nodejs` (for example, `C:\Users\USERNAME\AppData\Local\Temp\MyApp-nodejs`)
	- Linux: `/tmp/USERNAME/MyApp-nodejs`
	*/
	readonly temp: string;
}

/**
Get paths for storing things like data, config, cache, etc.

Note: It only generates the path strings. It doesn't create the directories for you. You could use [`make-dir`](https://github.com/sindresorhus/make-dir) to create the directories.

@param name - The name of your project. Used to generate the paths.
@returns The paths to use for your project on current OS.

@example
```
import envPaths from 'env-paths';

const paths = envPaths('MyApp');

paths.data;
//=> '/home/sindresorhus/.local/share/MyApp-nodejs'

paths.config
//=> '/home/sindresorhus/.config/MyApp-nodejs'
```
*/
export default function envPaths(name: string, options?: Options): Paths;
