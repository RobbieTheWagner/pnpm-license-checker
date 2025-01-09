import path from 'node:path';
import { fs, vol } from 'memfs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  defaultAllowedLicenses,
  findLicenseCheckerConfig,
  loadConfig,
  processLicenseKey,
} from '../src/licenseChecker';

// tell vitest to use fs mock from __mocks__ folder
// this can be done in a setup file if fs should always be mocked
vi.mock('node:fs');
vi.mock('node:fs/promises');

beforeEach(() => {
  // reset the state of in-memory fs
  vol.reset();
});
afterEach(() => {
  vi.restoreAllMocks();
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

describe('processLicenseKey', () => {
  it('handles a single license key without OR', () => {
    const licenseKey = 'MIT';
    const result = processLicenseKey(licenseKey);
    expect(result).toEqual(['MIT']);
  });

  it('splits OR-separated license keys', () => {
    const licenseKey = '(MIT OR Apache-2.0)';
    const result = processLicenseKey(licenseKey);
    expect(result).toEqual(['MIT', 'Apache-2.0']);
  });

  it('handles complex OR-separated license keys', () => {
    const licenseKey = '(BSD-2-Clause OR MIT OR Apache-2.0)';
    const result = processLicenseKey(licenseKey);
    expect(result).toEqual(['BSD-2-Clause', 'MIT', 'Apache-2.0']);
  });
});
