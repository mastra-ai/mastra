/*! firebase-admin v13.5.0 */
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectConfigManager = void 0;
const project_config_1 = require("./project-config");
const auth_api_request_1 = require("./auth-api-request");
/**
 * Manages (gets and updates) the current project config.
 */
class ProjectConfigManager {
    /**
     * Initializes a ProjectConfigManager instance for a specified FirebaseApp.
     *
     * @param app - The app for this ProjectConfigManager instance.
     *
     * @constructor
     * @internal
     */
    constructor(app) {
        this.authRequestHandler = new auth_api_request_1.AuthRequestHandler(app);
    }
    /**
     * Get the project configuration.
     *
     * @returns A promise fulfilled with the project configuration.
     */
    getProjectConfig() {
        return this.authRequestHandler.getProjectConfig()
            .then((response) => {
            return new project_config_1.ProjectConfig(response);
        });
    }
    /**
     * Updates an existing project configuration.
     *
     * @param projectConfigOptions - The properties to update on the project.
     *
     * @returns A promise fulfilled with the updated project config.
     */
    updateProjectConfig(projectConfigOptions) {
        return this.authRequestHandler.updateProjectConfig(projectConfigOptions)
            .then((response) => {
            return new project_config_1.ProjectConfig(response);
        });
    }
}
exports.ProjectConfigManager = ProjectConfigManager;
