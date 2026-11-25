const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const revisionArgs = ['HEAD'];
const mergeHead = spawnSync('git', ['rev-parse', '--verify', '-q', 'MERGE_HEAD'], { encoding: 'utf8' });
if (mergeHead.status === 0) revisionArgs.push('MERGE_HEAD');

const commitCount = Number(execFileSync('git', ['rev-list', '--count', ...revisionArgs], { encoding: 'utf8' }).trim());
const nextVersion = `v0.${commitCount + 1}`;
const appPath = path.join(repoRoot, 'js/app.js');
const htmlPath = path.join(repoRoot, 'index.html');
const appSource = fs.readFileSync(appPath, 'utf8');
const htmlSource = fs.readFileSync(htmlPath, 'utf8');
const appVersionPattern = /const APP_VERSION = "v\d+(?:\.\d+)*";/;
const htmlVersionPattern = /(<span id="appVersionDisplay"[^>]*>)v\d+(?:\.\d+)*(<\/span>)/;

if (!appVersionPattern.test(appSource) || !htmlVersionPattern.test(htmlSource)) {
  throw new Error('Could not find both app version labels; refusing to create a commit with mismatched versions.');
}

if (process.argv.includes('--dry-run')) {
  console.log(nextVersion);
  process.exit(0);
}

fs.writeFileSync(appPath, appSource.replace(appVersionPattern, `const APP_VERSION = "${nextVersion}";`));
fs.writeFileSync(htmlPath, htmlSource.replace(htmlVersionPattern, `$1${nextVersion}$2`));