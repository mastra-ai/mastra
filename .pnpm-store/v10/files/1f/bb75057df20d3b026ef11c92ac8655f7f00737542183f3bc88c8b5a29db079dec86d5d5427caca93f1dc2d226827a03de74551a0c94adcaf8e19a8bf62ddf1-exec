# Brocli 🥦
Modern type-safe way of building CLIs with TypeScript or JavaScript  
by [Drizzle Team](https://drizzle.team)  

```ts
import { command, string, boolean, run } from "@drizzle-team/brocli";

const push = command({
  name: "push",
  options: {
    dialect: string().enum("postgresql", "mysql", "sqlite"),
    databaseSchema: string().required(),
    databaseUrl: string().required(),
    strict: boolean().default(false),
  },
  handler: (opts) => {
    ...
  },
});

run([push]); // parse shell arguments and run command
```
 
### Why?
Brocli is meant to solve a list of challenges we've faced while building 
[Drizzle ORM](https://orm.drizzle.team) CLI companion for generating and running SQL schema migrations:
- [x] Explicit, straightforward and discoverable API
- [x] Typed options(arguments) with built in validation
- [x] Ability to reuse options(or option sets) across commands
- [x] Transformer hook to decouple runtime config consumption from command business logic
- [x] `--version`, `-v` as either string or callback
- [x] Command hooks to run common stuff before/after command
- [x] Explicit global params passthrough
- [x] Testability, the most important part for us to iterate without breaking
- [x] Themes, simple API to style global/command helps
- [x] Docs generation API to eliminate docs drifting

### Learn by examples
If you need API referece - [see here](#api-reference), this list of practical example 
is meant to a be a zero to hero walk through for you to learn Brocli 🚀  

Simple echo command with positional argument:
```ts
import { run, command, positional } from "@drizzle-team/brocli";

const echo = command({
  name: "echo",
  options: {
    text: positional().desc("Text to echo").default("echo"),
  },
  handler: (opts) => {
    console.log(opts.text);
  },
});

run([echo])
```
```bash
~ bun run index.ts echo
echo

~ bun run index.ts echo text
text
```

Print version with `--version -v`:
```ts
...

run([echo], {
  version: "1.0.0",
);
```
```bash
~ bun run index.ts --version
1.0.0
```
  
Version accepts async callback for you to do any kind of io if necessary before printing cli version:  
```ts
import { run, command, positional } from "@drizzle-team/brocli";

const version = async () => {
  // you can run async here, for example fetch version of runtime-dependend library

  const envVersion = process.env.CLI_VERSION;
  console.log(chalk.gray(envVersion), "\n");
};

const echo = command({ ... });

run([echo], {
  version: version,
);
```



  
  


# API reference
[**`command`**](#command)  
- [`command → name`](#command-name)
- [`command → desc`](#command-desc)
- [`command → shortDesc`](#command-shortDesc)
- [`command → aliases`](#command-aliases)
- [`command → options`](#command-options)
- [`command → transform`](#command-transform)
- [`command → handler`](#command-handler)
- [`command → help`](#command-help)
- [`command → hidden`](#command-hidden)
- [`command → metadata`](#command-metadata)

[**`options`**](#options)  
- [`string`](#options-string)
- [`boolean`](#options-boolean)
- [`number`](#options-number)
- [`enum`](#options-enum)
- [`positional`](#options-positional)
- [`required`](#options-required)
- [`alias`](#options-alias)
- [`desc`](#options-desc)
- [`default`](#options-default)
- [`hidden`](#options-hidden)

  
[**`run`**](#run)
- [`string`](#options-string)

  
Brocli **`command`** declaration has:  
`name` - command name, will be listed in `help`  
`desc` - optional description, will be listed in the command `help`  
`shortDesc` - optional short description, will be listed in the all commands/all subcommands `help`   
`aliases` - command name aliases  
`hidden` - flag to hide command from `help`  
`help` - command help text or a callback to print help text with dynamically provided config  
`options` - typed list of shell arguments to be parsed and provided to `transform` or `handler`    
`transform` - optional hook, will be called before handler to modify CLI params  
`handler` - called with either typed `options` or `transform` params, place to run your command business logic  
`metadata` - optional meta information for docs generation flow

`name`, `desc`, `shortDesc` and `metadata` are provided to docs generation step  
  
  
```ts
import { command, string, boolean } from "@drizzle-team/brocli";



const push = command({
  name: "push",
  options: {
    dialect: string().enum("postgresql", "mysql", "sqlite"),
    databaseSchema: string().required(),
    databaseUrl: string().required(),
    strict: boolean().default(false),
  },
  transform: (opts) => {
  },
  handler: (opts) => {
    ...
  },
});
```



```ts
import { command } from "@drizzle-team/brocli";

const cmd = command({
  name: "cmd",
  options: {
    dialect: string().enum("postgresql", "mysql", "sqlite"),
    schema: string().required(),
    url: string().required(),
  },
  handler: (opts) => {
    ...
  },
});

```

### Option builder
Initial builder functions:

-   `string(name?: string)` - defines option as a string-type option which requires data to be passed as `--option=value` or `--option value`    
    -   `name` - name by which option is passed in cli args  
    If not specified, defaults to key of this option    
    :warning: - must not contain `=` character, not be in `--help`,`-h`,`--version`,`-v` and be unique per each command  
    :speech_balloon: - will be automatically prefixed with `-` if one character long, `--` if longer  
    If you wish to have only single hyphen as a prefix on multi character name - simply specify name with it: `string('-longname')`  

-   `number(name?: string)` - defines option as a number-type option which requires data to be passed as `--option=value` or `--option value`    
    -   `name` - name by which option is passed in cli args  
    If not specified, defaults to key of this option    
    :warning: - must not contain `=` character, not be in `--help`,`-h`,`--version`,`-v` and be unique per each command  
    :speech_balloon: - will be automatically prefixed with `-` if one character long, `--` if longer  
    If you wish to have only single hyphen as a prefix on multi character name - simply specify name with it: `number('-longname')`  

-   `boolean(name?: string)` - defines option as a boolean-type option which requires data to be passed as `--option`  
    -   `name` - name by which option is passed in cli args  
    If not specified, defaults to key of this option    
    :warning: - must not contain `=` character, not be in `--help`,`-h`,`--version`,`-v` and be unique per each command  
    :speech_balloon: - will be automatically prefixed with `-` if one character long, `--` if longer  
    If you wish to have only single hyphen as a prefix on multi character name - simply specify name with it: `boolean('-longname')`  

-   `positional(displayName?: string)` - defines option as a positional-type option which requires data to be passed after a command as `command value`    
    -   `displayName` - name by which option is passed in cli args  
    If not specified, defaults to key of this option  
    :warning: - does not consume options and data that starts with  
    
Extensions: 

-   `.alias(...aliases: string[])` - defines aliases for option  
     -   `aliases` - aliases by which option is passed in cli args  
    :warning: - must not contain `=` character, not be in `--help`,`-h`,`--version`,`-v` and be unique per each command  
    :speech_balloon: - will be automatically prefixed with `-` if one character long, `--` if longer  
    If you wish to have only single hyphen as a prefix on multi character alias - simply specify alias with it: `.alias('-longname')`  

-   `.desc(description: string)` - defines description for option to be displayed in `help` command  

-   `.required()` - sets option as required, which means that application will print an error if it is not present in cli args  

-   `.default(value: string | boolean)` - sets default value for option which will be assigned to it in case it is not present in cli args

-   `.hidden()` - sets option as hidden - option will be omitted from being displayed in `help` command

-   `.enum(values: [string, ...string[]])` - limits values of string to one of specified here  
    -   `values` - allowed enum values  

-   `.int()` - ensures that number is an integer  

-   `.min(value: number)` - specified minimal allowed value for numbers  
    -   `value` - minimal allowed value  
    :warning: - does not limit defaults

-   `.max(value: number)` - specified maximal allowed value for numbers  
    -   `value` - maximal allowed value  
    :warning: - does not limit defaults

### Creating handlers

Normally, you can write handlers right in the `command()` function, however there might be cases where you'd want to define your handlers separately.  
For such cases, you'd want to infer type of `options` that will be passes inside your handler.  
You can do it using `TypeOf` type:  

```Typescript
import { string, boolean, type TypeOf } from '@drizzle-team/brocli'

const commandOptions = {
    opt1: string(),
    opt2: boolean('flag').alias('f'),
    // And so on... 
}

export const commandHandler = (options: TypeOf<typeof commandOptions>) => {
    // Your logic goes here...
}
```

Or by using `handler(options, myHandler () => {...})`

```Typescript
import { string, boolean, handler } from '@drizzle-team/brocli'

const commandOptions = {
    opt1: string(),
    opt2: boolean('flag').alias('f'),
    // And so on... 
}

export const commandHandler = handler(commandOptions, (options) => {
    // Your logic goes here...
});
```

### Defining commands

To define commands, use `command()` function:  

```Typescript
import { command, type Command, string, boolean, type TypeOf } from '@drizzle-team/brocli'

const commandOptions = {
    opt1: string(),
    opt2: boolean('flag').alias('f'),
    // And so on... 
}

const commands: Command[] = []

commands.push(command({
    name: 'command', 
    aliases: ['c', 'cmd'],
    desc: 'Description goes here',
    shortDesc: 'Short description'
    hidden: false,
    options: commandOptions,
    transform: (options) => {
        // Preprocess options here...
        return processedOptions
    },
    handler: (processedOptions) => {
        // Your logic goes here...
    },
    help: () => 'This command works like this: ...',
    subcommands: [
        command(
            // You can define subcommands like this
        )
    ]
}));
```

Parameters:  

-   `name` - name by which command is searched in cli args  
    :warning: - must not start with `-` character, be equal to [`true`, `false`, `0`, `1`] (case-insensitive) and be unique per command collection  

-   `aliases` - aliases by which command is searched in cli args  
    :warning: - must not start with `-` character, be equal to [`true`, `false`, `0`, `1`] (case-insensitive) and be unique per command collection  

-   `desc` - description for command to be displayed in `help` command  

-   `shortDesc` - short description for command to be displayed in `help` command  

-   `hidden` - sets command as hidden - if `true`, command will be omitted from being displayed in `help` command  

-   `options` - object containing command options created using `string` and `boolean` functions  

-   `transform` - optional function to preprocess options before they are passed to handler    
    :warning: - type of return mutates type of handler's input  

-   `handler` - function, which will be executed in case of successful option parse  
    :warning: - must be present if your command doesn't have subcommands  
    If command has subcommands but no handler, help for this command is going to be called instead of handler

-   `help` - function or string, which will be executed or printed when help is called for this command  
    :warning: - if passed, takes prevalence over theme's `commandHelp` event  

-   `subcommands` - subcommands for command    
    :warning: - command can't have subcommands and `positional` options at the same time  

-   `metadata` - any data that you want to attach to command to later use in docs generation step  

### Running commands

After defining commands, you're going to need to execute `run` function to start command execution

```Typescript
import { command, type Command, run, string, boolean, type TypeOf } from '@drizzle-team/brocli'

const commandOptions = {
    opt1: string(),
    opt2: boolean('flag').alias('f'),
    // And so on... 
}

const commandHandler = (options: TypeOf<typeof commandOptions>) => {
    // Your logic goes here...
}

const commands: Command[] = []

commands.push(command({
    name: 'command', 
    aliases: ['c', 'cmd'],
    desc: 'Description goes here',
    hidden: false,
    options: commandOptions,
    handler: commandHandler,
}));

// And so on...

run(commands, {
    name: 'mysoft',
    description: 'MySoft CLI',
    omitKeysOfUndefinedOptions: true,
    argSource: customEnvironmentArgvStorage,
    version: '1.0.0',
    help: () => {
        console.log('Command list:');
        commands.forEach(c => console.log('This command does ... and has options ...'));
    },
	theme: async (event) => {
		if (event.type === 'commandHelp') {
			await myCustomUniversalCommandHelp(event.command);

			return true;
		}

		if (event.type === 'unknownError') {
			console.log('Something went wrong...');

			return true;
		}

		return false;
	},
    hook: (event, command) => {
        if(event === 'before') console.log(`Command '${command.name}' started`)
        if(event === 'after') console.log(`Command '${command.name}' succesfully finished it's work`)
    }
})
```

Parameters:

-   `name` - name that's used to invoke your application from cli.  
Used for themes that print usage examples, example:  
`app do-task --help` results in `Usage: app do-task <positional> [flags] ...`  
Default: `undefined`

-   `description` - description of your app  
Used for themes, example:  
`myapp --help` results in  
```
MyApp CLI

Usage: myapp [command]...
```  
Default: `undefined`

-   `omitKeysOfUndefinedOptions` - flag that determines whether undefined options will be passed to transform\handler or not  
Default: `false`  

-   `argSource` - location of array of args in your environment  
:warning: - first two items of this storage will be ignored as they typically contain executable and executed file paths  
Default: `process.argv`

-   `version` - string or handler used to print your app version  
:warning: - if passed, takes prevalence over theme's version event

-   `help` - string or handler used to print your app's global help    
:warning: - if passed, takes prevalence over theme's `globalHelp` event

-   `theme(event: BroCliEvent)` - function that's used to customize messages that are printed on various events    
Return:  
    `true` | `Promise<true>` if you consider event processed  
    `false` | `Promise<false>` to redirect event to default theme  

-   `hook(event: EventType, command: Command)` - function that's used to execute code before and after every command's `transform` and `handler` execution  

### Additional functions

-   `commandsInfo(commands: Command[])` - get simplified representation of your command collection  
Can be used to generate docs  

-   `test(command: Command, args: string)` - test behaviour for command with specified arguments  
:warning: - if command has `transform`, it will get called, however `handler` won't  

-   `getCommandNameWithParents(command: Command)` - get subcommand's name with parent command names  

## CLI

In `BroCLI`, command doesn't have to be the first argument, instead it may be passed in any order.  
To make this possible, hovewer, option that's passed right before command should have an explicit value, even if it is a flag: `--verbose true <command-name>` (does not apply to reserved flags: [ `--help` | `-h` | `--version` | `-v`])    
Options are parsed in strict mode, meaning that having any unrecognized options will result in an error.     
