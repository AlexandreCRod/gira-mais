import { describe, expect, it } from 'vitest';
import { compareVersions } from '$lib/fork';

describe('compareVersions', () => {
	it('compares the numeric version like upstream', () => {
		expect(compareVersions('v1.7.2', '1.7.1')).toBe(1);
		expect(compareVersions('v1.7.0', '1.7.1')).toBe(-1);
		expect(compareVersions('v1.8', '1.8.0')).toBe(0);
		expect(compareVersions('v1.10.0', '1.9.9')).toBe(1);
	});

	it('ignores the dev suffix', () => {
		expect(compareVersions('v1.7.1', '1.7.1-dev (a9fc393)')).toBe(0);
		expect(compareVersions('v1.7.2', '1.7.1-dev (a9fc393)')).toBe(1);
	});

	it('orders fork revisions of the same upstream version', () => {
		expect(compareVersions('v1.7.1-multi.1', '1.7.1')).toBe(1);
		expect(compareVersions('v1.7.1-multi.2', '1.7.1-multi.1')).toBe(1);
		expect(compareVersions('v1.7.1-multi.1', '1.7.1-multi.1')).toBe(0);
		expect(compareVersions('v1.7.1-multi.3', '1.7.2')).toBe(-1);
		expect(compareVersions('v1.7.1-multi.1', '1.7.1-dev (a9fc393)')).toBe(1);
	});
});