// Gira+ Multi: what sets this fork apart from upstream Gira+, kept in one file so rebases onto new
// upstream releases rarely touch it.

/** Where this build's releases are published; the update check points here rather than at upstream. */
export const RELEASES_REPO = 'AlexandreCRod/gira-mais';
export const RELEASES_URL = `https://github.com/${RELEASES_REPO}/releases`;
export const LATEST_RELEASE_API_URL = `https://api.github.com/repos/${RELEASES_REPO}/releases/latest`;

function versionParts(version: string) {
	const match = version.match(/(\d+(?:\.\d+)*)(?:-multi\.(\d+))?/);
	return { base: (match?.[1] ?? '').split('.').map(Number), revision: Number(match?.[2] ?? 0) };
}

/**
 * Compare two versions (with or without a 'v' prefix or a `-dev (hash)` suffix): 1 if version1 > version2,
 * -1 if lower, 0 if equal. The fork's `-multi.N` revision orders releases of the same upstream version,
 * so 1.7.1 < 1.7.1-multi.1 < 1.7.1-multi.2 < 1.7.2.
 */
export function compareVersions(version1: string, version2: string) {
	const v1 = versionParts(version1);
	const v2 = versionParts(version2);

	// Pad with zeros if one version has fewer parts
	const maxLength = Math.max(v1.base.length, v2.base.length);
	while (v1.base.length < maxLength) v1.base.push(0);
	while (v2.base.length < maxLength) v2.base.push(0);

	for (let i = 0; i < maxLength; i++) {
		if (v1.base[i] > v2.base[i]) return 1;
		if (v1.base[i] < v2.base[i]) return -1;
	}

	return Math.sign(v1.revision - v2.revision);
}