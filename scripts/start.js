#!/usr/bin/env node
// Launch Electron with ELECTRON_RUN_AS_NODE cleared (VS Code terminals set it, which breaks the app).
const { spawn } = require('node:child_process');
const electron = require('electron');

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
spawn(electron, ['.'], { stdio: 'inherit', env, cwd: require('node:path').join(__dirname, '..') }).on('exit', (code) =>
  process.exit(code ?? 0)
);
