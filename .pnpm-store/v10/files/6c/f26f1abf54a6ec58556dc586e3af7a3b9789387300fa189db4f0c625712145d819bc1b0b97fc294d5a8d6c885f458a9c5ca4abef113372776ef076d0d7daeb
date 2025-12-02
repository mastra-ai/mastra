import type { Linter, Rule } from 'eslint';

declare const plugin: {
	meta: {
		name: string;
		version: string;
	};
	configs: {
		angular: Linter.LegacyConfig;
		dom: Linter.LegacyConfig;
		marko: Linter.LegacyConfig;
		react: Linter.LegacyConfig;
		svelte: Linter.LegacyConfig;
		vue: Linter.LegacyConfig;
		'flat/angular': Linter.FlatConfig;
		'flat/dom': Linter.FlatConfig;
		'flat/marko': Linter.FlatConfig;
		'flat/react': Linter.FlatConfig;
		'flat/svelte': Linter.FlatConfig;
		'flat/vue': Linter.FlatConfig;
	};
	rules: {
		[key: string]: Rule.RuleModule;
	};
};

export = plugin;
