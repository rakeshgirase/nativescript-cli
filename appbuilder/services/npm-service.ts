import * as path from "path";
import * as os from "os";
import { fromWindowsRelativePathToUnix } from "../../helpers";
import * as constants from "../../constants";
import { exportedPromise } from "../../decorators";

export class NpmService implements INpmService {
	private static TYPES_DIRECTORY = "@types/";
	private static TNS_CORE_MODULES_DEFINITION_FILE_NAME = `${constants.TNS_CORE_MODULES}${constants.FileExtensions.TYPESCRIPT_DEFINITION_FILE}`;
	private static NPM_REGISTRY_URL = "https://registry.npmjs.org";

	private _npmExecutableName: string;

	constructor(private $childProcess: IChildProcess,
		private $errors: IErrors,
		private $fs: IFileSystem,
		private $hostInfo: IHostInfo,
		private $httpClient: Server.IHttpClient,
		private $logger: ILogger,
		private $projectConstants: Project.IConstants) { }

	@exportedPromise("npmService")
	public install(projectDir: string, dependencyToInstall?: INpmDependency): IFuture<INpmInstallResult> {
		return (() => {
			let npmInstallResult: INpmInstallResult = {};

			if (dependencyToInstall) {
				npmInstallResult.result = {
					isInstalled: false,
					isTypesInstalled: false
				};

				try {
					this.npmInstall(projectDir, dependencyToInstall.name, dependencyToInstall.version, ["--save", "--save-exact"]).wait();
					npmInstallResult.result.isInstalled = true;
				} catch (err) {
					npmInstallResult.error = err;
				}

				if (dependencyToInstall.installTypes && npmInstallResult.result.isInstalled && this.hasTypesForDependency(dependencyToInstall.name).wait()) {
					try {
						this.installTypingsForDependency(projectDir, dependencyToInstall.name).wait();
						npmInstallResult.result.isTypesInstalled = true;
					} catch (err) {
						npmInstallResult.error = err;
					}
				}
			} else {
				try {
					this.npmPrune(projectDir).wait();
					this.npmInstall(projectDir).wait();
				} catch (err) {
					npmInstallResult.error = err;
				}
			}

			this.generateReferencesFile(projectDir).wait();

			return npmInstallResult;
		}).future<INpmInstallResult>()();
	}

	@exportedPromise("npmService")
	public uninstall(projectDir: string, dependency: string): IFuture<void> {
		return (() => {
			let packageJsonContent = this.getPackageJsonContent(projectDir).wait();

			if (packageJsonContent && packageJsonContent.dependencies && packageJsonContent.dependencies[dependency]) {
				this.npmUninstall(projectDir, dependency, ["--save"]).wait();
			}

			if (packageJsonContent && packageJsonContent.devDependencies && packageJsonContent.devDependencies[`${NpmService.TYPES_DIRECTORY}${dependency}`]) {
				this.npmUninstall(projectDir, `${NpmService.TYPES_DIRECTORY}${dependency}`, ["--save-dev"]).wait();
			}
		}).future<void>()();
	}

	public getPackageJsonFromNpmRegistry(packageName: string, version?: string): IFuture<any> {
		return (() => {
			let packageJsonContent: any;
			version = version || "latest";
			try {
				let url = this.buildNpmRegistryUrl(packageName, version);
				// This call will return error with message '{}' in case there's no such package.
				let result = this.$httpClient.httpRequest(url).wait().body;
				packageJsonContent = JSON.parse(result);
			} catch (err) {
				this.$logger.trace("Error caught while checking the NPM Registry for plugin with id: %s", packageName);
				this.$logger.trace(err.message);
			}

			return packageJsonContent;
		}).future<any>()();
	}

	private hasTypesForDependency(packageName: string): IFuture<boolean> {
		return (() => {
			return !!this.getPackageJsonFromNpmRegistry(`${NpmService.TYPES_DIRECTORY}${packageName}`).wait();
		}).future<boolean>()();
	}

	private buildNpmRegistryUrl(packageName: string, version: string): string {
		return `${NpmService.NPM_REGISTRY_URL}/${packageName.replace("/", "%2F")}?version=${encodeURIComponent(version)}`;
	}

	private getPackageJsonContent(projectDir: string): IFuture<any> {
		return (() => {
			let pathToPackageJson = this.getPathToPackageJson(projectDir);

			try {
				return this.$fs.readJson(pathToPackageJson).wait();
			} catch (err) {
				if (err.code === "ENOENT") {
					this.$errors.failWithoutHelp(`Unable to find ${this.$projectConstants.PACKAGE_JSON_NAME} in ${projectDir}.`);
				}

				throw err;
			}

		}).future<any>()();
	}

	private getPathToPackageJson(projectDir: string): string {
		return path.join(projectDir, this.$projectConstants.PACKAGE_JSON_NAME);
	}

	private getPathToReferencesFile(projectDir: string): string {
		return path.join(projectDir, this.$projectConstants.REFERENCES_FILE_NAME);
	}

	private installTypingsForDependency(projectDir: string, dependency: string): IFuture<void> {
		return this.npmInstall(projectDir, `${NpmService.TYPES_DIRECTORY}${dependency}`, null, ["--save-dev", "--save-exact"]);
	}

	private generateReferencesFile(projectDir: string): IFuture<void> {
		return (() => {
			let packageJsonContent = this.getPackageJsonContent(projectDir).wait();

			let pathToReferenceFile = this.getPathToReferencesFile(projectDir),
				lines: string[] = [];

			if (packageJsonContent && packageJsonContent.dependencies && packageJsonContent.dependencies[constants.TNS_CORE_MODULES]) {
				let relativePathToTnsCoreModulesDts = `./${constants.NODE_MODULES_DIR_NAME}/${constants.TNS_CORE_MODULES}/${NpmService.TNS_CORE_MODULES_DEFINITION_FILE_NAME}`;

				if (this.$fs.exists(path.join(projectDir, relativePathToTnsCoreModulesDts)).wait()) {
					lines.push(this.getReferenceLine(relativePathToTnsCoreModulesDts));
				}
			}

			_(packageJsonContent.devDependencies)
				.keys()
				.each(devDependency => {
					if (this.isFromTypesRepo(devDependency)) {
						let nodeModulesDirectory = path.join(projectDir, constants.NODE_MODULES_DIR_NAME);
						let definitionFiles = this.$fs.enumerateFilesInDirectorySync(path.join(nodeModulesDirectory, devDependency),
							(file, stat) => _.endsWith(file, constants.FileExtensions.TYPESCRIPT_DEFINITION_FILE) || stat.isDirectory(), { enumerateDirectories: false });

						let defs = _.map(definitionFiles, def => this.getReferenceLine(fromWindowsRelativePathToUnix(path.relative(projectDir, def))));

						this.$logger.trace(`Adding lines for definition files: ${definitionFiles.join(", ")}`);
						lines.push(...defs);
					}
				});

			// TODO: Make sure the android17.d.ts and ios.d.ts are added.

			if (lines.length) {
				this.$logger.trace("Updating reference file with new entries...");
				this.$fs.writeFile(pathToReferenceFile, lines.join(os.EOL), "utf8").wait();
			} else {
				this.$logger.trace(`Could not find any .d.ts files for ${this.$projectConstants.REFERENCES_FILE_NAME} file. Deleting the old file.`);
				this.$fs.deleteFile(pathToReferenceFile).wait();
			}
		}).future<void>()();
	}

	private isFromTypesRepo(dependency: string): boolean {
		return !!dependency.match(/^@types\//);
	}

	private getReferenceLine(pathToReferencedFile: string): string {
		return `/// <reference path="${pathToReferencedFile}" />`;
	}

	private get npmExecutableName(): string {
		if (!this._npmExecutableName) {
			this._npmExecutableName = "npm";

			if (this.$hostInfo.isWindows) {
				this._npmExecutableName += ".cmd";
			}
		}

		return this._npmExecutableName;
	}

	private getNpmArguments(command: string, npmArguments: string[] = []): string[] {
		return npmArguments.concat([command]);
	}

	private npmInstall(projectDir: string, dependency?: string, version?: string, npmArguments?: string[]): IFuture<void> {
		return this.executeNpmCommand(projectDir, this.getNpmArguments("install", npmArguments), dependency, version);
	}

	private npmUninstall(projectDir: string, dependency?: string, npmArguments?: string[]): IFuture<void> {
		return this.executeNpmCommand(projectDir, this.getNpmArguments("uninstall", npmArguments), dependency, null);
	}

	private npmPrune(projectDir: string, dependency?: string, version?: string): IFuture<void> {
		return this.executeNpmCommand(projectDir, this.getNpmArguments("prune"), dependency, version);
	}

	private executeNpmCommand(projectDir: string, npmArguments: string[], dependency: string, version?: string): IFuture<void> {
		return (() => {
			if (dependency) {
				let dependencyToInstall = dependency;
				if (version) {
					dependencyToInstall += `@${version}`;
				}

				npmArguments.push(dependencyToInstall);
			}

			this.$childProcess.spawnFromEvent(this.npmExecutableName, npmArguments, "close", { cwd: projectDir }).wait();
		}).future<void>()();
	}
}
$injector.register("npmService", NpmService);