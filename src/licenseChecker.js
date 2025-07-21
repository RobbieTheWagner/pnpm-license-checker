import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

// ANSI escape codes for colors
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
};

// Default allowed licenses
export const defaultAllowedLicenses = [
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

/**
 * Recursively finds the .pnpm-license-checker.json configuration file
 * @param {string} startDir - Starting directory for the search
 * @returns {string|null} - Path to the configuration file or null if not found
 */
export function findLicenseCheckerConfig(startDir) {
  let currentDir = startDir;

  while (true) {
    const configPath = path.join(currentDir, '.pnpm-license-checker.json');
    if (existsSync(configPath)) {
      return configPath;
    }

    const parentDir = path.dirname(currentDir);
    if (currentDir === parentDir) {
      // Reached the root directory
      break;
    }
    currentDir = parentDir;
  }

  return null;
}

/**
 * Loads configuration values from the configuration file
 * @returns {Object} - Contains `allowedPackages` and `allowedLicenses`
 */
export function loadConfig() {
  const configPath = findLicenseCheckerConfig(process.cwd());
  if (!configPath) {
    console.log(
      `${colors.yellow}No .pnpm-license-checker.json file found. Using default configuration.${colors.reset}`
    );
    return { allowedPackages: [], allowedLicenses: defaultAllowedLicenses };
  }

  try {
    const config = JSON.parse(readFileSync(configPath, 'utf8'));

    console.log(config);

    // Validate and load allowedPackages
    const allowedPackages = Array.isArray(config.allowedPackages)
      ? config.allowedPackages
      : [];

    // Validate and load allowedLicenses
    const allowedLicenses = Array.isArray(config.allowedLicenses)
      ? config.allowedLicenses
      : defaultAllowedLicenses;

    console.log(
      `${colors.green}Loaded configuration from ${configPath}.${colors.reset}`
    );

    return { allowedPackages, allowedLicenses };
  } catch (error) {
    console.error(
      `${colors.red}Error reading .pnpm-license-checker.json: ${error.message}${colors.reset}`
    );
    return { allowedPackages: [], allowedLicenses: defaultAllowedLicenses };
  }
}

/**
 * Processes license strings with "OR" logic
 * @param {string} licenseKey - License string, e.g., "(MIT OR Apache-2.0)"
 * @returns {Array<string>} - Array of individual licenses
 */
export function processLicenseKey(licenseKey) {
  return licenseKey
    .replace(/[()]/g, '')
    .split(/\s*OR\s*/)
    .map((license) => license.trim());
}
