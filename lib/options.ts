import * as helpers from "./common/helpers";
import * as yargs from "yargs";

export class Options {
	private static DASHED_OPTION_REGEX = /(.+?)([A-Z])(.*)/;
	private static NONDASHED_OPTION_REGEX = /(.+?)[-]([a-zA-Z])(.*)/;

	private optionsWhiteList = ["ui", "recursive", "reporter", "require", "timeout", "_", "$0"]; // These options shouldn't be validated
	public argv: IYargArgv;
	private globalOptions: IDictionary<IDashedOption> = {
		log: { type: OptionType.String },
		verbose: { type: OptionType.Boolean, alias: "v" },
		version: { type: OptionType.Boolean },
		help: { type: OptionType.Boolean, alias: "h" },
		profileDir: { type: OptionType.String },
		analyticsClient: { type: OptionType.String },
		path: { type: OptionType.String, alias: "p" },
		// This will parse all non-hyphenated values as strings.
		_: { type: OptionType.String }
	};

	public options: IDictionary<IDashedOption>;

	constructor(private $errors: IErrors,
		private $staticConfig: Config.IStaticConfig,
		private $settingsService: ISettingsService) {

		this.options = _.extend({}, this.commonOptions, this.globalOptions);
		this.setArgv();
	}

	public get shorthands(): string[] {
		const result: string[] = [];
		_.each(_.keys(this.options), optionName => {
			if (this.options[optionName].alias) {
				result.push(this.options[optionName].alias);
			}
		});
		return result;
	}

	private get commonOptions(): IDictionary<IDashedOption> {
		return {
			ipa: { type: OptionType.String },
			frameworkPath: { type: OptionType.String },
			frameworkName: { type: OptionType.String },
			framework: { type: OptionType.String },
			frameworkVersion: { type: OptionType.String },
			forDevice: { type: OptionType.Boolean },
			provision: { type: OptionType.Object },
			client: { type: OptionType.Boolean, default: true },
			env: { type: OptionType.Object },
			production: { type: OptionType.Boolean },
			debugTransport: { type: OptionType.Boolean },
			keyStorePath: { type: OptionType.String },
			keyStorePassword: { type: OptionType.String, },
			keyStoreAlias: { type: OptionType.String },
			keyStoreAliasPassword: { type: OptionType.String },
			ignoreScripts: { type: OptionType.Boolean },
			disableNpmInstall: { type: OptionType.Boolean },
			compileSdk: { type: OptionType.Number },
			port: { type: OptionType.Number },
			copyTo: { type: OptionType.String },
			platformTemplate: { type: OptionType.String },
			js: { type: OptionType.Boolean },
			javascript: { type: OptionType.Boolean },
			ng: { type: OptionType.Boolean },
			angular: { type: OptionType.Boolean },
			vue: { type: OptionType.Boolean },
			vuejs: { type: OptionType.Boolean },
			tsc: { type: OptionType.Boolean },
			ts: { type: OptionType.Boolean },
			typescript: { type: OptionType.Boolean },
			androidTypings: { type: OptionType.Boolean },
			bundle: { type: OptionType.String },
			all: { type: OptionType.Boolean },
			teamId: { type: OptionType.Object },
			syncAllFiles: { type: OptionType.Boolean, default: false },
			chrome: { type: OptionType.Boolean },
			inspector: { type: OptionType.Boolean },
			clean: { type: OptionType.Boolean },
			watch: { type: OptionType.Boolean, default: true },
			background: { type: OptionType.String },
			username: { type: OptionType.String },
			pluginName: { type: OptionType.String },
			hmr: { type: OptionType.Boolean },
			collection: { type: OptionType.String, alias: "c" },
			json: { type: OptionType.Boolean },
			avd: { type: OptionType.String },
			config: { type: OptionType.Array },
			insecure: { type: OptionType.Boolean, alias: "k" },
			debug: { type: OptionType.Boolean, alias: "d" },
			timeout: { type: OptionType.String },
			device: { type: OptionType.String },
			availableDevices: { type: OptionType.Boolean },
			appid: { type: OptionType.String },
			geny: { type: OptionType.String },
			debugBrk: { type: OptionType.Boolean },
			debugPort: { type: OptionType.Number },
			start: { type: OptionType.Boolean },
			stop: { type: OptionType.Boolean },
			ddi: { type: OptionType.String }, // the path to developer  disk image
			justlaunch: { type: OptionType.Boolean },
			file: { type: OptionType.String },
			force: { type: OptionType.Boolean, alias: "f" },
			companion: { type: OptionType.Boolean },
			emulator: { type: OptionType.Boolean },
			sdk: { type: OptionType.String },
			template: { type: OptionType.String },
			certificate: { type: OptionType.String },
			certificatePassword: { type: OptionType.String },
			release: { type: OptionType.Boolean, alias: "r" },
			var: { type: OptionType.Object },
			default: { type: OptionType.Boolean },
			count: { type: OptionType.Number },
			hooks: { type: OptionType.Boolean, default: true },
			analyticsLogFile: { type: OptionType.String },
			link: { type: OptionType.Boolean, default: false }
		};
	}

	private get optionNames(): string[] {
		return _.keys(this.options);
	}

	private getOptionValue(optionName: string): any {
		optionName = this.getCorrectOptionName(optionName);
		return this.argv[optionName];
	}

	public validateOptions(commandSpecificDashedOptions?: IDictionary<IDashedOption>): void {
		if (commandSpecificDashedOptions) {
			_.extend(this.options, commandSpecificDashedOptions);
			this.setArgv();
		}

		const parsed = Object.create(null);
		// DO NOT REMOVE { } as when they are missing and some of the option values is false, the each stops as it thinks we have set "return false".
		_.each(_.keys(this.argv), optionName => {
			parsed[optionName] = this.getOptionValue(optionName);
		});

		_.each(parsed, (value: any, originalOptionName: string) => {
			// when this.options are passed to yargs, it returns all of them and the ones that are not part of process.argv are set to undefined.
			if (value === undefined) {
				return;
			}

			const optionName = this.getCorrectOptionName(originalOptionName);

			if (!_.includes(this.optionsWhiteList, optionName)) {
				if (!this.isOptionSupported(optionName)) {
					this.$errors.failWithoutHelp(`The option '${originalOptionName}' is not supported. To see command's options, use '$ ${this.$staticConfig.CLIENT_NAME.toLowerCase()} help ${process.argv[2]}'. To see all commands use '$ ${this.$staticConfig.CLIENT_NAME.toLowerCase()} help'.`);
				}

				const optionType = this.getOptionType(optionName),
					optionValue = parsed[optionName];

				if (_.isArray(optionValue) && optionType !== OptionType.Array) {
					this.$errors.fail("You have set the %s option multiple times. Check the correct command syntax below and try again.", originalOptionName);
				} else if (optionType === OptionType.String && helpers.isNullOrWhitespace(optionValue)) {
					this.$errors.failWithoutHelp("The option '%s' requires non-empty value.", originalOptionName);
				} else if (optionType === OptionType.Array && optionValue.length === 0) {
					this.$errors.failWithoutHelp(`The option '${originalOptionName}' requires one or more values, separated by a space.`);
				}
			}
		});
	}

	private getCorrectOptionName(optionName: string): string {
		const secondaryOptionName = this.getNonDashedOptionName(optionName);
		return _.includes(this.optionNames, secondaryOptionName) ? secondaryOptionName : optionName;
	}

	private getOptionType(optionName: string): string {
		const option = this.options[optionName] || this.tryGetOptionByAliasName(optionName);
		return option ? option.type : "";
	}

	private tryGetOptionByAliasName(aliasName: string) {
		const option = _.find(this.options, opt => opt.alias === aliasName);
		return option;
	}

	private isOptionSupported(option: string): boolean {
		if (!this.options[option]) {
			const opt = this.tryGetOptionByAliasName(option);
			return !!opt;
		}

		return true;
	}

	// If you pass value with dash, yargs adds it to yargs.argv in two ways:
	// with dash and without dash, replacing first symbol after it with its toUpper equivalent
	// ex, "$ <cli name> emulate android --profile-dir" will add profile-dir to yargs.argv as profile-dir and profileDir
	// IMPORTANT: In your code, it is better to use the value without dashes (profileDir in the example).
	// This way your code will work in case "$ <cli name> emulate android --profile-dir" or "$ <cli name> emulate android --profileDir" is used by user.
	private getNonDashedOptionName(optionName: string): string {
		const matchUpperCaseLetters = optionName.match(Options.NONDASHED_OPTION_REGEX);
		if (matchUpperCaseLetters) {
			// get here if option with upperCase letter is specified, for example profileDir
			// check if in knownOptions we have its kebabCase presentation
			const secondaryOptionName = matchUpperCaseLetters[1] + matchUpperCaseLetters[2].toUpperCase() + matchUpperCaseLetters[3] || '';
			return this.getNonDashedOptionName(secondaryOptionName);
		}

		return optionName;
	}

	private getDashedOptionName(optionName: string): string {
		const matchUpperCaseLetters = optionName.match(Options.DASHED_OPTION_REGEX);
		if (matchUpperCaseLetters) {
			const secondaryOptionName = `${matchUpperCaseLetters[1]}-${matchUpperCaseLetters[2].toLowerCase()}${matchUpperCaseLetters[3] || ''}`;
			return this.getDashedOptionName(secondaryOptionName);
		}

		return optionName;
	}

	private setArgv(): void {
		const opts: IDictionary<IDashedOption> = <IDictionary<IDashedOption>>{};
		_.each(this.options, (value: IDashedOption, key: string) => {
			opts[this.getDashedOptionName(key)] = value;
		});

		this.argv = yargs(process.argv.slice(2)).options(opts).argv;

		// For backwards compatibility
		// Previously profileDir had a default option and calling `this.$options.profileDir` always returned valid result.
		// Now the profileDir should be used from $settingsService, but ensure the `this.$options.profileDir` returns the same value.
		this.$settingsService.setSettings({ profileDir: this.argv.profileDir });
		this.argv.profileDir = this.argv["profile-dir"] = this.$settingsService.getProfileDir();

		// if justlaunch is set, it takes precedence over the --watch flag and the default true value
		if (this.argv.justlaunch) {
			this.argv.watch = false;
		}

		if (this.argv.ts || this.argv.typescript) {
			this.argv.tsc = true;
		}

		if (this.argv.angular) {
			this.argv.ng = true;
		}

		if (this.argv.vuejs) {
			this.argv.vue = true;
		}

		if (this.argv.javascript) {
			this.argv.js = true;
		}

		// Default to "nativescript-dev-webpack" if only `--bundle` is passed
		if (this.argv.bundle !== undefined || this.argv.hmr) {
			this.argv.bundle = this.argv.bundle || "webpack";
		}

		this.adjustDashedOptions();
	}

	private adjustDashedOptions(): void {
		_.each(this.optionNames, optionName => {
			Object.defineProperty(Options.prototype, optionName, {
				configurable: true,
				get: () => {
					return this.getOptionValue(optionName);
				},
				set: (value: any) => {
					this.argv[optionName] = value;
				}
			});
		});
	}
}
$injector.register("options", Options);
