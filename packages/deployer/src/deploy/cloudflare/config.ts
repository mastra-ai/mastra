export function getWorkerConfig({
  workerName,
  route,
  zone,
  envVars,
}: {
  workerName: string;
  route?: string;
  zone?: string;
  envVars?: Record<string, string>;
}) {
  return `
        name = "${workerName}"
        main = "index.mjs"  # Your main worker file
        compatibility_date = "2024-12-02"
        compatibility_flags = ["nodejs_compat"]
        find_additional_modules = true

        [build]
        command = "npm install" 

        [[build.upload]]
        type = "javascript_module"
        main = "mastra.mjs"

        [observability.logs]
        enabled = true

        ${
          route
            ? `[[routes]]
        pattern = "${route}"
        zone_name = "${zone}"
        custom_domain = true`
            : ``
        }

        [vars]
        ${Object.entries(envVars || {})
          ?.map(([key, value]) => `${key} = "${value}"`)
          .join('\n')}
    `;
}
