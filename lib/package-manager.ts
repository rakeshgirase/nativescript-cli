
import { cache, exported, invokeInit } from './common/decorators';
export class PackageManager implements INodePackageManager {
	private packageManager: INodePackageManager;

	constructor(
		private $errors: IErrors,
		private $npm: INodePackageManager,
		private $options: IOptions,
		private $yarn: INodePackageManager,
		private $userSettingsService: IUserSettingsService
	) {}

	@cache()
	protected async init(): Promise<void> {
		this.packageManager = await this._determinePackageManager();
	}

	@exported("packageManager")
	@invokeInit()
	public install(packageName: string, pathToSave: string, config: INodePackageManagerInstallOptions): Promise<INpmInstallResultInfo> {
		return this.packageManager.install(packageName, pathToSave, config);
	}
	@exported("packageManager")
	@invokeInit()
	public uninstall(packageName: string, config?: IDictionary<string | boolean>, path?: string): Promise<string> {
		return this.packageManager.uninstall(packageName, config, path);
	}
	@exported("packageManager")
	@invokeInit()
	public view(packageName: string, config: Object): Promise<any> {
		return this.packageManager.view(packageName, config);
	}
	@exported("packageManager")
	@invokeInit()
	public search(filter: string[], config: IDictionary<string | boolean>): Promise<string> {
		return this.packageManager.search(filter, config);
	}

	@invokeInit()
	public searchNpms(keyword: string): Promise<INpmsResult> {
		return this.packageManager.searchNpms(keyword);
	}

	@invokeInit()
	public getRegistryPackageData(packageName: string): Promise<any> {
		return this.packageManager.getRegistryPackageData(packageName);
	}

	@invokeInit()
	public getCachePath(): Promise<string> {
		return this.packageManager.getCachePath();
	}

	private async _determinePackageManager(): Promise<INodePackageManager> {
		let pm = null;
		try {
			pm = await this.$userSettingsService.getSettingValue('packageManager');
		} catch (err) {
			this.$errors.fail(`Unable to read package manager config from user settings ${err}`);
		}

		if (pm === 'yarn' || this.$options.yarn) {
			return this.$yarn;
		} else {
			return this.$npm;
		}
	}
}

$injector.register('packageManager', PackageManager);
