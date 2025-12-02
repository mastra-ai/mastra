# conf

> Simple config handling for your app or module

All you have to care about is what to persist. This module will handle all the dull details like where and how.

**It does not support multiple processes writing to the same store.**\
I initially made this tool to let command-line tools persist some data.

*If you need this for Electron, check out [`electron-store`](https://github.com/sindresorhus/electron-store) instead.*

## Install

```sh
npm install conf
```

## Usage

```js
import Conf from 'conf';

const config = new Conf({projectName: 'foo'});

config.set('unicorn', '🦄');
console.log(config.get('unicorn'));
//=> '🦄'

// Use dot-notation to access nested properties
config.set('foo.bar', true);
console.log(config.get('foo'));
//=> {bar: true}

config.delete('unicorn');
console.log(config.get('unicorn'));
//=> undefined
```

Or [create a subclass](https://github.com/sindresorhus/electron-store/blob/main/index.js).

## API

Changes are written to disk atomically, so if the process crashes during a write, it will not corrupt the existing config.

### Conf(options?)

Returns a new instance.

### options

Type: `object`

#### defaults

Type: `object`

Default values for the config items.

**Note:** The values in `defaults` will overwrite the `default` key in the `schema` option.

#### schema

Type: `object`

[JSON Schema](https://json-schema.org) to validate your config data.

This will be the [`properties`](https://json-schema.org/understanding-json-schema/reference/object.html#properties) object of the JSON schema. That is, define `schema` as an object where each key is the name of your data's property and each value is a JSON schema used to validate that property. 

Example:

```js
import Conf from 'conf';

const schema = {
	foo: {
		type: 'number',
		maximum: 100,
		minimum: 1,
		default: 50
	},
	bar: {
		type: 'string',
		format: 'url'
	}
};

const config = new Conf({
	projectName: 'foo',
	schema
});

console.log(config.get('foo'));
//=> 50

config.set('foo', '1');
// [Error: Config schema violation: `foo` should be number]
```

**Note:** The `default` value will be overwritten by the `defaults` option if set.

#### rootSchema

Type: `object`

Top-level properties for the schema, excluding `properties` field.

Example:

```js
import Conf from 'conf';

const store = new Conf({
	projectName: 'foo',
	schema: { /* … */ },
	rootSchema: {
		additionalProperties: false
	}
});
```

#### ajvOptions

Type: `object`

[Options passed to AJV](https://ajv.js.org/options.html).

Under the hood, the JSON Schema validator [ajv](https://ajv.js.org/json-schema.html) is used to validate your config. We use [JSON Schema draft-2020-12](https://json-schema.org/draft/2020-12/release-notes) and support all validation keywords and formats.

**Note:** By default, `allErrors` and `useDefaults` are both set to `true`, but can be overridden.

Example:

```js
import Conf from 'conf';

const store = new Conf({
	projectName: 'foo',
	schema: { /* … */ },
	rootSchema: {
		additionalProperties: false
	},
	ajvOptions: {
		removeAdditional: true
	}
});
```

#### migrations

Type: `object`

**Important: I cannot provide support for this feature. It has some known bugs. I have no plans to work on it, but pull requests are welcome.**

You can use migrations to perform operations to the store whenever a **project version** is upgraded.

The `migrations` object should consist of a key-value pair of `'version': handler`. The `version` can also be a [semver range](https://github.com/npm/node-semver#ranges).

Example:

```js
import Conf from 'conf';

const store = new Conf({
	projectName: 'foo',
	projectVersion: …,
	migrations: {
		'0.0.1': store => {
			store.set('debugPhase', true);
		},
		'1.0.0': store => {
			store.delete('debugPhase');
			store.set('phase', '1.0.0');
		},
		'1.0.2': store => {
			store.set('phase', '1.0.2');
		},
		'>=2.0.0': store => {
			store.set('phase', '>=2.0.0');
		}
	}
});
```

> Note: The version the migrations use refers to the **project version** by default. If you want to change this behavior, specify the [`projectVersion`](#projectVersion) option.

#### beforeEachMigration

Type: `Function`\
Default: `undefined`

The given callback function will be called before each migration step.

The function receives the store as the first argument and a context object as the second argument with the following properties:

- `fromVersion` - The version the migration step is being migrated from.
- `toVersion` - The version the migration step is being migrated to.
- `finalVersion` - The final version after all the migrations are applied.
- `versions` - All the versions with a migration step.

This can be useful for logging purposes, preparing migration data, etc.

Example:

```js
import Conf from 'conf';

console.log = someLogger.log;

const mainConfig = new Conf({
	projectName: 'foo1',
	beforeEachMigration: (store, context) => {
		console.log(`[main-config] migrate from ${context.fromVersion} → ${context.toVersion}`);
	},
	migrations: {
		'0.4.0': store => {
			store.set('debugPhase', true);
		},
	}
});

const secondConfig = new Conf({
	projectName: 'foo2',
	beforeEachMigration: (store, context) => {
		console.log(`[second-config] migrate from ${context.fromVersion} → ${context.toVersion}`);
	},
	migrations: {
		'1.0.1': store => {
			store.set('debugPhase', true);
		},
	}
});
```

#### configName

Type: `string`\
Default: `'config'`

Name of the config file (without extension).

Useful if you need multiple config files for your app or module. For example, different config files between two major versions.

#### projectName

Type: `string`

**Required unless you specify the `cwd` option.**

You can fetch the `name` field from package.json.

#### projectVersion

Type: `string`

**Required if you specify the `migration` option.**

You can fetch the `version` field from package.json.

#### cwd

Type: `string`\
Default: System default [user config directory](https://github.com/sindresorhus/env-paths#pathsconfig)

**You most likely don't need this. Please don't use it unless you really have to. By default, it will pick the optimal location by adhering to system conventions. You are very likely to get this wrong and annoy users.**

Overrides `projectName`.

The only use-case I can think of is having the config located in the app directory or on some external storage.

#### encryptionKey

Type: `string | Uint8Array | TypedArray | DataView`\
Default: `undefined`

Note that this is **not intended for security purposes**, since the encryption key would be easily found inside a plain-text Node.js app.

Its main use is for obscurity. If a user looks through the config directory and finds the config file, since it's just a JSON file, they may be tempted to modify it. By providing an encryption key, the file will be obfuscated, which should hopefully deter any users from doing so.

When specified, the store will be encrypted using the [`aes-256-cbc`](https://en.wikipedia.org/wiki/Block_cipher_mode_of_operation) encryption algorithm.

#### fileExtension

Type: `string`\
Default: `'json'`

Extension of the config file.

You would usually not need this, but could be useful if you want to interact with a file with a custom file extension that can be associated with your app. These might be simple save/export/preference files that are intended to be shareable or saved outside of the app.

#### clearInvalidConfig

Type: `boolean`\
Default: `false`

The config is cleared if reading the config file causes a `SyntaxError`. This is a good behavior for unimportant data, as the config file is not intended to be hand-edited, so it usually means the config is corrupt and there's nothing the user can do about it anyway. However, if you let the user edit the config file directly, mistakes might happen and it could be more useful to throw an error when the config is invalid instead of clearing.

#### serialize

Type: `Function`\
Default: `value => JSON.stringify(value, null, '\t')`

Function to serialize the config object to a UTF-8 string when writing the config file.

You would usually not need this, but it could be useful if you want to use a format other than JSON.

#### deserialize

Type: `Function`\
Default: `JSON.parse`

Function to deserialize the config object from a UTF-8 string when reading the config file.

You would usually not need this, but it could be useful if you want to use a format other than JSON.

#### projectSuffix

Type: `string`\
Default: `'nodejs'`

**You most likely don't need this. Please don't use it unless you really have to.**

Suffix appended to `projectName` during config file creation to avoid name conflicts with native apps.

You can pass an empty string to remove the suffix.

For example, on macOS, the config file will be stored in the `~/Library/Preferences/foo-nodejs` directory, where `foo` is the `projectName`.

#### accessPropertiesByDotNotation

Type: `boolean`\
Default: `true`

Accessing nested properties by dot notation. For example:

```js
import Conf from 'conf';

const config = new Conf({projectName: 'foo'});

config.set({
	foo: {
		bar: {
			foobar: '🦄'
		}
	}
});

console.log(config.get('foo.bar.foobar'));
//=> '🦄'
```

Alternatively, you can set this option to `false` so the whole string would be treated as one key.

```js
import Conf from 'conf';

const config = new Conf({
	projectName: 'foo',
	accessPropertiesByDotNotation: false
});

config.set({
	`foo.bar.foobar`: '🦄'
});

console.log(config.get('foo.bar.foobar'));
//=> '🦄'
```

#### watch

type: `boolean`\
Default: `false`

Watch for any changes in the config file and call the callback for `onDidChange` or `onDidAnyChange` if set. This is useful if there are multiple processes changing the same config file.

#### configFileMode

Type: `number`\
Default: `0o666`

The [mode](https://en.wikipedia.org/wiki/File-system_permissions#Numeric_notation) that will be used for the config file.

You would usually not need this, but it could be useful if you want to restrict the permissions of the config file. Setting a permission such as `0o600` would result in a config file that can only be accessed by the user running the program.

Note that setting restrictive permissions can cause problems if different users need to read the file. A common problem is a user running your tool with and without `sudo` and then not being able to access the config the second time.

### Instance

You can use [dot-notation](https://github.com/sindresorhus/dot-prop) in a `key` to access nested properties.

The instance is [`iterable`](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Iteration_protocols) so you can use it directly in a [`for…of`](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Statements/for...of) loop.

#### .set(key, value)

Set an item.

The `value` must be JSON serializable. Trying to set the type `undefined`, `function`, or `symbol` will result in a TypeError.

#### .set(object)

Set multiple items at once.

#### .get(key, defaultValue?)

Get an item or `defaultValue` if the item does not exist.

#### .reset(...keys)

Reset items to their default values, as defined by the `defaults` or `schema` option.

Use `.clear()` to reset all items.

#### .has(key)

Check if an item exists.

#### .delete(key)

Delete an item.

#### .clear()

Delete all items.

This resets known items to their default values, if defined by the `defaults` or `schema` option.

#### .onDidChange(key, callback)

`callback`: `(newValue, oldValue) => {}`

Watches the given `key`, calling `callback` on any changes.

When a key is first set `oldValue` will be `undefined`, and when a key is deleted `newValue` will be `undefined`.

Returns a function which you can use to unsubscribe:

```js
const unsubscribe = conf.onDidChange(key, callback);

unsubscribe();
```

#### .onDidAnyChange(callback)

`callback`: `(newValue, oldValue) => {}`

Watches the whole config object, calling `callback` on any changes.

`oldValue` and `newValue` will be the config object before and after the change, respectively. You must compare `oldValue` to `newValue` to find out what changed.

Returns a function which you can use to unsubscribe:

```js
const unsubscribe = conf.onDidAnyChange(callback);

unsubscribe();
```

#### .size

Get the item count.

#### .store

Get all the config as an object or replace the current config with an object:

```js
conf.store = {
	hello: 'world'
};
```

#### .path

Get the path to the config file.

## FAQ

### How is this different from [`configstore`](https://github.com/yeoman/configstore)?

I'm also the author of `configstore`. While it's pretty good, I did make some mistakes early on that are hard to change at this point. This module is the result of everything I learned from making `configstore`. Mainly where the config is stored. In `configstore`, the config is stored in `~/.config` (which is mainly a Linux convention) on all systems, while `conf` stores config in the system default [user config directory](https://github.com/sindresorhus/env-paths#pathsconfig). The `~/.config` directory, it turns out, often have an incorrect permission on macOS and Windows, which has caused a lot of grief for users.

### Can I use YAML or another serialization format?

The `serialize` and `deserialize` options can be used to customize the format of the config file, as long as the representation is compatible with `utf8` encoding.

Example using YAML:

```js
import Conf from 'conf';
import yaml from 'js-yaml';

const config = new Conf({
	projectName: 'foo',
	fileExtension: 'yaml',
	serialize: yaml.safeDump,
	deserialize: yaml.safeLoad
});
```

## Related

- [electron-store](https://github.com/sindresorhus/electron-store) - Simple data persistence for your Electron app or module
- [cache-conf](https://github.com/SamVerschueren/cache-conf) - Simple cache config handling for your app or module
