import { describe, expect, it } from 'vitest';
import { nextRevision, readGradleVersion, releaseVersion, releaseVersionCode, stampGradle, stampPackageJson } from './multi-release';

const gradle = `    defaultConfig {
        versionCode 32
        versionName "1.7.1"
        testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"
`;

describe('multi-release versions', () => {
	it('starts at revision 1 and continues after the highest tag of the same upstream version', () => {
		expect(nextRevision('1.7.1', ['v1.7.0', 'v1.7.1'])).toBe(1);
		expect(nextRevision('1.7.1', ['v1.7.1-multi.1', 'v1.7.1-multi.10', 'v1.7.1-multi.2', 'v1.7.0-multi.40'])).toBe(11);
		expect(nextRevision('1.7.2', ['v1.7.1-multi.3'])).toBe(1);
	});

	it('ignores tags that only share a prefix', () => {
		expect(nextRevision('1.7.1', ['v1.7.10-multi.5', 'v1.7.1-multi.x'])).toBe(1);
	});

	it('refuses a revision the versionCode has no room for', () => {
		expect(() => nextRevision('1.7.1', ['v1.7.1-multi.99'])).toThrow();
	});

	it('keeps the versionCode increasing across revisions and upstream bumps', () => {
		expect(releaseVersion('1.7.1', 2)).toBe('1.7.1-multi.2');
		const codes = [releaseVersionCode(32, 1), releaseVersionCode(32, 2), releaseVersionCode(33, 1)];
		expect(codes).toEqual([3201, 3202, 3301]);
	});

	it('stamps build.gradle and package.json without touching anything else', () => {
		expect(readGradleVersion(gradle)).toEqual({ code: 32, name: '1.7.1' });
		const stamped = stampGradle(gradle, '1.7.1-multi.1', 3201);
		expect(readGradleVersion(stamped)).toEqual({ code: 3201, name: '1.7.1-multi.1' });
		expect(stamped).toContain('testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"');
		const packageJson = '{\n  "name": "gira-mais",\n  "version": "1.7.1",\n  "type": "module"\n}\n';
		expect(JSON.parse(stampPackageJson(packageJson, '1.7.1-multi.1'))).toEqual({ name: 'gira-mais', version: '1.7.1-multi.1', type: 'module' });
	});
});