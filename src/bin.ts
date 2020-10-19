#!/usr/bin/env node
import fs from 'fs';
import nodemon from 'nodemon';
import path from 'path';
import { fileURLToPath } from 'url';
import yargs from 'yargs';
import runAutomation from './automation.js';

(async () => {
  const options = yargs
    .usage('Usage: --includeMount <includeMount> --page <page> --port <port> --watch <watch>')
    .option('includeMount', {
      describe: 'includes the initial mount render',
      type: 'boolean',
    })
    .option('page', {
      describe: 'page to be tested',
      type: 'string',
      demandOption: true,
    })
    .option('port', {
      describe: 'port to be used for server',
      type: 'number',
    })
    .option('watch', {
      describe: 'generate charts on every new build',
      type: 'string',
    })
    .argv;

  const {
    includeMount = false,
    page,
    port = 1235,
    watch = '',
  } = options;

  const cwd = path.resolve();
  const scriptPath = fileURLToPath(import.meta.url);
  const packagePath = `${scriptPath.slice(0, scriptPath.lastIndexOf('/'))}`;
  const serverPath = `http://localhost:${port}`;

  global.automation = {
    cwd,
    includeMount,
    packagePath,
    port,
    serverPath,
    url: page,
    watch,
  };

  const deleteJsonFiles = async () => {
    await fs.readdir(packagePath, (err, files) => {
      if (err) throw err;
      for (const file of files) {
        if (file.includes('.json')) fs.unlink(path.join(packagePath, file), err => {
          if (err) throw err;
        });
      }
    });
  };

  await deleteJsonFiles();

  if (watch) {
    console.log('watch mode');
    nodemon({
      delay: 15000,
      ext: 'js,jsx,ts,tsx',
      script: `${packagePath}/automation.js`,
      watch: [`${cwd}/${watch}`],
    });
    nodemon.on('quit', () => process.exit());
  } else {
    console.log('running automation once');
    await runAutomation();
  }
})();
