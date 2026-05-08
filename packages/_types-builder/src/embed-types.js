import fs from 'fs/promises';
import path from 'path';
import { Extractor, ExtractorConfig } from '@microsoft/api-extractor';
import { Project } from 'ts-morph';
import { createReadStream } from 'fs';
import { Writable } from 'node:stream';

export async function embedTypes(file, rootDir, bundledPackages) {
  const packageJsonFullPath = path.join(rootDir, 'package.json');
  const pkgJson = JSON.parse(await fs.readFile(packageJsonFullPath, 'utf8'));

  const shouldRunEmbed = await new Promise((resolve, reject) => {
    let found = false;

    createReadStream(file).pipe(
      new Writable({
        write(chunk, encoding, callback) {
          const hasExternal = Array.from(bundledPackages).some(pkg => chunk.includes(pkg));
          if (hasExternal) {
            found = true;
            resolve(found);
          }
          callback();
        },
        final(callback) {
          if (!found) {
            resolve(false);
          }
          callback();
        },
      }),
    );
  });

  if (!shouldRunEmbed) {
    return;
  }

  // Load and parse the api-extractor.json file
  /** @type {ExtractorConfig} */
  const extractorConfig = ExtractorConfig.prepare({
    packageFolder: rootDir,
    packageJson: pkgJson,
    packageJsonFullPath,
    configObject: {
      $schema: 'https://developer.microsoft.com/json-schemas/api-extractor/v7/api-extractor.schema.json',
      mainEntryPointFilePath: file,
      bundledPackages: Array.from(bundledPackages),
      compiler: {
        tsconfigFilePath: path.join(rootDir, 'tsconfig.build.json'),
      },
      messages: {
        extractorMessageReporting: {
          'ae-forgotten-export': {
            logLevel: 'warning',
          },
        },
      },
      projectFolder: rootDir,
      dtsRollup: {
        enabled: true,
        publicTrimmedFilePath: path.relative(rootDir, file),
      },
      apiReport: {
        enabled: false,
      },
      docModel: {
        enabled: false,
      },
    },
  });

  const missingExports = [];
  // Invoke API Extractor
  const extractorResult = Extractor.invoke(extractorConfig, {
    localBuild: true,
    showVerboseMessages: false,
    showDiagnostics: false,
    messageCallback: msg => {
      msg._handled = true;
      if (msg.messageId === 'ae-forgotten-export') {
        const matched = msg.text.match(/The symbol "([^"]+)"/);
        if (matched) {
          missingExports.push(matched[1]);
        }
      }
    },
  });

  if (missingExports.length > 0) {
    const project = new Project();
    const sourceFile = project.addSourceFileAtPath(file);

    const declarations = [];
    for (const symbol of missingExports) {
      declarations.push({
        name: symbol,
        alias: symbol,
      });
    }

    sourceFile.addExportDeclaration({
      namedExports: declarations,
    });

    await sourceFile.save();
  }

  if (extractorResult.succeeded) {
    return true;
  } else {
    throw new Error(
      `API Extractor completed with ${extractorResult.errorCount} errors` +
        ` and ${extractorResult.warningCount} warnings`,
    );
  }
}
