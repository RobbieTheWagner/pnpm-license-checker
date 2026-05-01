import { exec } from 'node:child_process';
import path from 'node:path';
import { fs, vol } from 'memfs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  checkLicenses,
  defaultAllowedLicenses,
  findLicenseCheckerConfig,
  getPnpmLicenses,
  isLicenseAllowed,
  loadConfig,
} from '../src/licenseChecker';

// tell vitest to use fs mock from __mocks__ folder
// this can be done in a setup file if fs should always be mocked
vi.mock('node:fs');
vi.mock('node:fs/promises');
vi.mock('node:child_process');

const originalProcessArgv = process.argv;

beforeEach(() => {
  // reset the state of in-memory fs
  vol.reset();
});
afterEach(() => {
  vi.restoreAllMocks();
  process.argv = originalProcessArgv;
});

describe('findLicenseCheckerConfig', () => {
  it('returns null if no config file is found', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    const result = findLicenseCheckerConfig(process.cwd());
    expect(result).toBeNull();
  });

  it('finds the config file in the current directory', () => {
    const configPath = path.join(process.cwd(), '.pnpm-license-checker.json');
    vi.spyOn(fs, 'existsSync').mockImplementation(
      (file) => file === configPath,
    );

    const result = findLicenseCheckerConfig(process.cwd());
    expect(result).toBe(configPath);
  });

  it('finds the config file in a parent directory', () => {
    const parentDir = path.dirname(process.cwd());
    const configPath = path.join(parentDir, '.pnpm-license-checker.json');
    vi.spyOn(fs, 'existsSync').mockImplementation(
      (file) => file === configPath,
    );

    const result = findLicenseCheckerConfig(process.cwd());
    expect(result).toBe(configPath);
  });
});

describe('loadConfig', () => {
  it('returns default configuration if no config file is found', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    const { allowedPackages, allowedLicenses } = loadConfig();

    expect(allowedPackages).toEqual([]);
    expect(allowedLicenses).toEqual(defaultAllowedLicenses);
  });

  it('returns allowedPackages from a valid config file', () => {
    const configPath = path.join(process.cwd(), '.pnpm-license-checker.json');
    const configData = JSON.stringify({
      allowedPackages: ['specific-package1'],
    });

    // Mock file system behavior
    vi.spyOn(fs, 'existsSync').mockImplementation(
      (file) => file === configPath,
    );
    vi.spyOn(fs, 'readFileSync').mockImplementation((file) => {
      if (file === configPath) {
        return configData;
      }
      throw new Error('File not found');
    });

    const { allowedPackages } = loadConfig();
    expect(allowedPackages).toEqual(['specific-package1']);
  });

  it('overrides allowedLicenses from config file', () => {
    const configPath = path.join(process.cwd(), '.pnpm-license-checker.json');
    const configData = JSON.stringify({
      allowedLicenses: ['MIT', 'Apache-2.0'],
    });

    // Mock file system behavior
    vi.spyOn(fs, 'existsSync').mockImplementation(
      (file) => file === configPath,
    );
    vi.spyOn(fs, 'readFileSync').mockImplementation((file) => {
      if (file === configPath) {
        return configData;
      }
      throw new Error('File not found');
    });

    const { allowedLicenses } = loadConfig();
    expect(allowedLicenses).toEqual(['MIT', 'Apache-2.0']);
  });

  it('falls back to default allowedLicenses if missing in config file', () => {
    const configPath = path.join(process.cwd(), '.pnpm-license-checker.json');
    const invalidData = JSON.stringify({});

    // Mock file system behavior
    vi.spyOn(fs, 'existsSync').mockImplementation(
      (file) => file === configPath,
    );
    vi.spyOn(fs, 'readFileSync').mockImplementation((file) => {
      if (file === configPath) {
        return invalidData;
      }
      throw new Error('File not found');
    });

    const { allowedLicenses } = loadConfig();
    expect(allowedLicenses).toEqual(defaultAllowedLicenses);
  });
});

describe('getPnpmLicenses', () => {
  it('passes certain CLI flags through to pnpm licenses', () => {
    process.argv = ['-D', '--dev', '-P', '--prod', '--no-pass'];
    getPnpmLicenses();
    expect(exec).toHaveBeenCalledWith(
      'pnpm licenses list --json -D --dev -P --prod',
      expect.anything(),
      expect.anything(),
    );
  });
});

describe('isLicenseAllowed', () => {
  it('allows a plain allowed license', () => {
    expect(isLicenseAllowed('MIT', new Set(['MIT']))).toBe(true);
  });

  it('rejects a plain disallowed license', () => {
    expect(isLicenseAllowed('GPL-3.0', new Set(['MIT']))).toBe(false);
  });

  it('OR: passes when at least one side is allowed', () => {
    expect(isLicenseAllowed('(MIT OR GPL-3.0)', new Set(['MIT']))).toBe(true);
  });

  it('OR: passes when both sides are allowed', () => {
    expect(isLicenseAllowed('(MIT OR Apache-2.0)', new Set(['MIT', 'Apache-2.0']))).toBe(true);
  });

  it('OR: fails when neither side is allowed', () => {
    expect(isLicenseAllowed('(GPL-2.0 OR GPL-3.0)', new Set(['MIT']))).toBe(false);
  });

  it('AND: passes when all parts are allowed', () => {
    expect(isLicenseAllowed('Apache-2.0 AND BSD-3-Clause', new Set(['Apache-2.0', 'BSD-3-Clause']))).toBe(true);
  });

  it('AND: fails when any part is disallowed', () => {
    expect(isLicenseAllowed('Apache-2.0 AND GPL-3.0', new Set(['Apache-2.0', 'MIT']))).toBe(false);
  });

  it('grouped: (MIT OR Apache-2.0) AND BSD-3-Clause passes when OR-group and AND-part are allowed', () => {
    expect(isLicenseAllowed('(MIT OR Apache-2.0) AND BSD-3-Clause', new Set(['Apache-2.0', 'BSD-3-Clause']))).toBe(true);
  });

  it('grouped: (MIT OR Apache-2.0) AND BSD-3-Clause fails when AND-part is not allowed', () => {
    expect(isLicenseAllowed('(MIT OR Apache-2.0) AND BSD-3-Clause', new Set(['MIT', 'Apache-2.0']))).toBe(false);
  });

  it('grouped: MIT OR (Apache-2.0 AND BSD-3-Clause) passes when the OR-left is allowed', () => {
    expect(isLicenseAllowed('MIT OR (Apache-2.0 AND BSD-3-Clause)', new Set(['MIT']))).toBe(true);
  });

  it('grouped: MIT OR (Apache-2.0 AND BSD-3-Clause) passes when both AND-parts are allowed', () => {
    expect(isLicenseAllowed('MIT OR (Apache-2.0 AND BSD-3-Clause)', new Set(['Apache-2.0', 'BSD-3-Clause']))).toBe(true);
  });

  it('grouped: MIT OR (Apache-2.0 AND BSD-3-Clause) fails when neither alternative is fully allowed', () => {
    expect(isLicenseAllowed('MIT OR (Apache-2.0 AND BSD-3-Clause)', new Set(['Apache-2.0']))).toBe(false);
  });

  it('grouped: (MIT OR Apache-2.0) AND (BSD-3-Clause OR ISC) passes when one of each group is allowed', () => {
    expect(isLicenseAllowed('(MIT OR Apache-2.0) AND (BSD-3-Clause OR ISC)', new Set(['MIT', 'ISC']))).toBe(true);
  });

  it('WITH: passes when the full "X WITH Y" string is in allowedLicenses', () => {
    expect(isLicenseAllowed('GPL-2.0 WITH Classpath-exception-2.0', new Set(['GPL-2.0 WITH Classpath-exception-2.0']))).toBe(true);
  });

  it('WITH: fails when only the base license is in allowedLicenses', () => {
    expect(isLicenseAllowed('GPL-2.0 WITH Classpath-exception-2.0', new Set(['GPL-2.0']))).toBe(false);
  });
});

describe('checkLicenses', () => {
  const makePkg = (name) => ({ name });

  it('passes when all licenses are allowed', () => {
    const licenses = {
      MIT: [makePkg('pkg-a')],
      'Apache-2.0': [makePkg('pkg-b')],
    };
    const { passed, violations } = checkLicenses(licenses, [], ['MIT', 'Apache-2.0']);
    expect(passed).toBe(true);
    expect(violations).toHaveLength(0);
  });

  it('fails when a license is not allowed', () => {
    const licenses = {
      'GPL-3.0': [makePkg('bad-pkg')],
    };
    const { passed, violations } = checkLicenses(licenses, [], ['MIT']);
    expect(passed).toBe(false);
    expect(violations).toHaveLength(1);
    expect(violations[0].license).toBe('GPL-3.0');
    expect(violations[0].packages).toEqual(['bad-pkg']);
  });

  it('OR: passes when at least one license in an OR expression is allowed', () => {
    const licenses = {
      '(MIT OR GPL-3.0)': [makePkg('pkg-c')],
    };
    const { passed } = checkLicenses(licenses, [], ['MIT']);
    expect(passed).toBe(true);
  });

  it('AND: fails when one part of an AND expression is not allowed', () => {
    const licenses = {
      'Apache-2.0 AND GPL-3.0': [makePkg('pkg-d')],
    };
    const { passed } = checkLicenses(licenses, [], ['Apache-2.0', 'MIT']);
    expect(passed).toBe(false);
  });

  it('AND: passes when all parts of an AND expression are allowed', () => {
    const licenses = {
      'Apache-2.0 AND BSD-3-Clause': [makePkg('pkg-e')],
    };
    const { passed } = checkLicenses(licenses, [], ['Apache-2.0', 'BSD-3-Clause']);
    expect(passed).toBe(true);
  });

  it('skips packages listed in allowedPackages even with a bad license', () => {
    const licenses = {
      'GPL-3.0': [makePkg('exempted-pkg'), makePkg('other-pkg')],
    };
    const { passed, violations } = checkLicenses(licenses, ['exempted-pkg'], ['MIT']);
    expect(passed).toBe(false);
    expect(violations[0].packages).toEqual(['other-pkg']);
  });

  it('passes when all packages with a bad license are in allowedPackages', () => {
    const licenses = {
      'GPL-3.0': [makePkg('exempted-pkg')],
    };
    const { passed } = checkLicenses(licenses, ['exempted-pkg'], ['MIT']);
    expect(passed).toBe(true);
  });
});
