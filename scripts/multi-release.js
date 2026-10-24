// Gira+ Multi: stamps a release version on the working tree, for the multi-release workflow only.
// Releases are named after the upstream version they're built on plus a revision (1.7.1-multi.1, 1.7.1-multi.2,
// then 1.7.2-multi.1), and Android's versionCode is upstream's times 100 plus the revision, so it always increases.
// Nothing here is committed: upstream's version lines stay untouched and rebases don't conflict on them.
import { execSync } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const MAX_REVISION = 99;

/** The revision after the highest one already tagged for this upstream version. */
export function nextRevision(baseVersion, tags) {
	const prefix = `v${baseVersion}-multi.`;
	const revisions = tags
		.filter(tag => tag.startsWith(prefix))
		.map(tag => Number(tag.slice(prefix.length)))
		.filter(Number.isInteger);
	const next = Math.max(0, ...revisions) + 1;
	if (next > MAX_REVISION) throw new Error(`Too many releases of ${baseVersion}: the versionCode only has room for ${MAX_REVISION}`);
	return next;
}

export function releaseVersion(baseVersion, revision) {
	return `${baseVersion}-multi.${revision}`;
}

export function releaseVersionCode(upstreamCode, revision) {
	return upstreamCode * 100 + revision;
}

/** Upstream's versionCode and versionName from build.gradle. */
export function readGradleVersion(gradle) {
	const code = gradle.match(/^\s*versionCode (\d+)\s*$/m);
	const name = gradle.match(/^\s*versionName "([^"]+)"\s*$/m);
	if (!code || !name) throw new Error('versionCode or versionName not found in build.gradle');
	return { code: Number(code[1]), name: name[1] };
}

export function stampGradle(gradle, version, code) {
	return gradle
		.replace(/^(\s*versionCode )\d+(\s*)$/m, `$1${code}$2`)
		.replace(/^(\s*versionName )"[^"]+"(\s*)$/m, `$1"${version}"$2`);
}

export function stampPackageJson(packageJson, version) {
	return packageJson.replace(/^(\s*"version": )"[^"]+"/m, `$1"${version}"`);
}

function main() {
	const gradlePath = 'android/app/build.gradle';
	const packageJson = readFileSync('package.json', 'utf8');
	const gradle = readFileSync(gradlePath, 'utf8');
	const baseVersion = JSON.parse(packageJson).version;
	const upstream = readGradleVersion(gradle);
	if (baseVersion.includes('-multi.')) throw new Error(`package.json already has a release version (${baseVersion})`);
	if (upstream.name !== baseVersion) throw new Error(`build.gradle (${upstream.name}) and package.json (${baseVersion}) disagree`);

	const tags = execSync('git tag --list', { encoding: 'utf8' }).split('\n').map(tag => tag.trim()).filter(Boolean);
	const revision = nextRevision(baseVersion, tags);
	const version = releaseVersion(baseVersion, revision);
	const code = releaseVersionCode(upstream.code, revision);
	writeFileSync('package.json', stampPackageJson(packageJson, version));
	writeFileSync(gradlePath, stampGradle(gradle, version, code));

	const outputs = `version=${version}\ntag=v${version}\ncode=${code}\n`;
	if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, outputs);
	process.stdout.write(outputs);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();