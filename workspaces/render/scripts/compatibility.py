"""Install packed public consumers, with and without the provisional Workflows package."""
import json
from pathlib import Path
import shutil
import subprocess
root = Path(__file__).resolve().parents[1]
base = root / 'validation/matrix-artifacts'
base.mkdir(exist_ok=True)
results = []
for name, core, workflows in [('standalone-current', '1.75.0', False), ('standalone-minimum', '1.67.0', False), ('with-workflows', '1.67.0', True)]:
    cwd = base / name
    # Regenerate only this script's disposable fixture, avoiding npm's cached 0.0.0 tarball.
    if cwd.exists():
        shutil.rmtree(cwd)
    cwd.mkdir()
    dependencies = {'@mastra/render': 'file:../../mastra-render-0.0.0.tgz', '@mastra/core': core, 'typescript': '5.9.3', '@types/node': '24.5.2'}
    if workflows:
        dependencies.update({'@renderinc/mastra': 'file:../../renderinc-mastra-0.0.0.tgz', 'zod': '3.25.76'})
    (cwd/'package.json').write_text(json.dumps({'name': name, 'private': True, 'type': 'module', 'dependencies': dependencies}, indent=2)+'\n')
    shutil.copyfile(root/'scripts/consumer-smoke.mjs', cwd/'smoke.mjs')
    (cwd/'consumer.ts').write_text("import { Workspace } from '@mastra/core/workspace';\nimport { RenderSandbox, renderSandboxProvider } from '@mastra/render';\nconst sandbox = new RenderSandbox({ create: { networkPolicy: { type: 'allow-list', rules: [{ domain: 'example.com', protocol: 'https' }] } } });\nconst workspace = new Workspace({ sandbox });\nvoid renderSandboxProvider; void workspace;\n")
    commands = [
        ['npm', 'install', '--workspaces=false', '--ignore-scripts', '--no-audit', '--no-fund'],
        ['node', 'smoke.mjs'] + (['--workflows'] if workflows else []),
        ['npx', '--no-install', 'tsc', '--noEmit', '--strict', '--skipLibCheck', '--module', 'NodeNext', '--target', 'ES2022', 'consumer.ts'],
        ['npm', 'ls', '@renderinc/sdk', '@mastra/core', '--all'],
    ]
    with (cwd/'checks.log').open('w') as log:
        for command in commands:
            result = subprocess.run(command, cwd=cwd, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=180)
            log.write(result.stdout); log.flush()
            if result.returncode:
                print(result.stdout[-6000:]); raise SystemExit(result.returncode)
    result = json.loads((cwd/'result.json').read_text())
    result['name'] = name
    result['consumerTypes'] = 'PASS'
    results.append(result)
    print(json.dumps(result), flush=True)
(root/'validation/compatibility.json').write_text(json.dumps(results, indent=2)+'\n')
