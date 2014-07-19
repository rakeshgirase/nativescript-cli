///<reference path="../.d.ts"/>

import util = require("util");
import path = require("path");
import shell = require("shelljs");
import npm = require("npm");
var options = require("./../options");
var helpers = require("./../common/helpers");
import Future = require("fibers/future");

export class ProjectTemplatesService implements IProjectTemplatesService {
	private static NPM_DEFAULT_TEMPLATE_NAME = "tns-template-hello-world";

	public constructor(private $npm: INodePackageManager) { }

	public get defaultTemplatePath(): IFuture<string> {
		return this.$npm.downloadNpmPackage(ProjectTemplatesService.NPM_DEFAULT_TEMPLATE_NAME);
	}

	/* public installAndroidFramework(where?: string): IFuture<string> {
		return this.installNpmPackage(ProjectTemplatesService.NPM_ANDROID_BRIDGE_NAME, where);
	} */

}
$injector.register("projectTemplatesService", ProjectTemplatesService);