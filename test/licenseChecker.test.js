import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  findLicenseCheckerConfig,
  loadAllowedPackages,
  processLicenseKey,
  allowedLicenses,
} from '../src/licenseChecker';

vi.mock('fs');

describe('License Checker', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('allowedLicenses', () => {
    it('contains all expected license values', () => {
      const expectedLicenses = [
        'Apache-2.0',
        'All Rights Reserved',
        'Artistic-2.0',
        'BlueOak-1.0.0',
        '0BSD',
        'BSD',
        'BSD-2-Clause',
        'BSD-3-Clause',
        'CC0-1.0',
        'CC-BY-4.0',
        'CC BY-SA 4.0',
        'ISC',
        'LGPL-3.0-or-later',
        'MIT',
        'MIT-0',
        'MPL-2.0',
        'Public Domain',
        'Python-2.0',
        'Unicode-DFS-2016',
        'Unlicense',
        'UNLICENSED',
      ];

      expect(allowedLicenses).toEqual(expect.arrayContaining(expectedLicenses));
      expect(allowedLicenses).not.toContain('GPL-3.0'); // Explicitly check for unsupported licenses
    });
  });

  describe('loadAllowedPackages', () => {
    it('returns an empty array if no config file is found', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      const result = loadAllowedPackages();
      expect(result).toEqual([]);
    });

    it.skip('returns allowedPackages from a valid config file', () => {
      const configData = JSON.stringify({
        allowedPackages: ['specific-package1'],
      });
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(configData);

      const result = loadAllowedPackages();
      expect(result).toEqual(['specific-package1']);
    });

    it('returns an empty array for invalid config format', () => {
      const invalidData = JSON.stringify({ notAllowedPackages: [] });
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(invalidData);

      const result = loadAllowedPackages();
      expect(result).toEqual([]);
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

  describe('Integration Tests', () => {
    it('handles no allowed packages and unsupported license', () => {
      const licenses = {
        '(MIT OR Apache-2.0)': [{ name: 'package1' }],
        'GPL-3.0': [{ name: 'package2' }],
      };
      const allowedPackages = [];

      const unsupportedLicenses = Object.entries(licenses).flatMap(
        ([licenseKey, packages]) => {
          const individualLicenses = processLicenseKey(licenseKey);
          const filteredPackages = packages
            .filter((pkg) => !allowedPackages.includes(pkg.name))
            .map((pkg) => pkg.name);

          const invalidLicenses = individualLicenses.filter(
            (license) => !allowedLicenses.includes(license)
          );

          return invalidLicenses.length > 0
            ? { licenseKey, filteredPackages, invalidLicenses }
            : [];
        }
      );

      expect(unsupportedLicenses).toEqual([
        {
          licenseKey: 'GPL-3.0',
          filteredPackages: ['package2'],
          invalidLicenses: ['GPL-3.0'],
        },
      ]);
    });

    it('allows packages specified in the config', () => {
      const licenses = {
        '(MIT OR Apache-2.0)': [{ name: 'package1' }],
        'GPL-3.0': [{ name: 'specific-package2' }],
      };
      const allowedPackages = ['specific-package2'];

      const unsupportedLicenses = Object.entries(licenses).flatMap(
        ([licenseKey, packages]) => {
          const individualLicenses = processLicenseKey(licenseKey);

          // Filter out allowed packages
          const filteredPackages = packages
            .filter((pkg) => !allowedPackages.includes(pkg.name))
            .map((pkg) => pkg.name);

          if (filteredPackages.length === 0) {
            // No unsupported packages remain after filtering
            return [];
          }

          // Check if licenses are unsupported
          const invalidLicenses = individualLicenses.filter(
            (license) => !allowedLicenses.includes(license)
          );

          if (invalidLicenses.length > 0) {
            return { licenseKey, filteredPackages, invalidLicenses };
          }

          return [];
        }
      );

      expect(unsupportedLicenses).toEqual([]);
    });

    it('handles mixed scenarios with allowed and unsupported licenses', () => {
      const licenses = {
        '(MIT OR Apache-2.0)': [{ name: 'package1' }],
        'GPL-3.0': [{ name: 'package2' }],
        ISC: [{ name: 'specific-package3' }],
      };
      const allowedPackages = ['specific-package3'];

      const unsupportedLicenses = Object.entries(licenses).flatMap(
        ([licenseKey, packages]) => {
          const individualLicenses = processLicenseKey(licenseKey);
          const filteredPackages = packages
            .filter((pkg) => !allowedPackages.includes(pkg.name))
            .map((pkg) => pkg.name);

          const invalidLicenses = individualLicenses.filter(
            (license) => !allowedLicenses.includes(license)
          );

          return invalidLicenses.length > 0
            ? { licenseKey, filteredPackages, invalidLicenses }
            : [];
        }
      );

      expect(unsupportedLicenses).toEqual([
        {
          licenseKey: 'GPL-3.0',
          filteredPackages: ['package2'],
          invalidLicenses: ['GPL-3.0'],
        },
      ]);
    });
  });
});
