const fs = require('fs');
const path = require('path');

// ANSI escape codes for colors
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
};

// List of allowed licenses
const allowedLicenses = [
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
function findLicenseCheckerConfig(startDir) {
  let currentDir = startDir;

  while (true) {
    const configPath = path.join(currentDir, '.pnpm-license-checker.json');
    if (fs.existsSync(configPath)) {
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
 * Loads allowed packages from the configuration file
 * @returns {Array<string>} - Array of allowed package names
 */
function loadAllowedPackages() {
  const configPath = findLicenseCheckerConfig(process.cwd());
  if (!configPath) {
    console.log(
      `${colors.yellow}No .pnpm-license-checker.json file found. Defaulting to an empty allowedPackages list.${colors.reset}`
    );
    return [];
  }

  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (Array.isArray(config.allowedPackages)) {
      console.log(
        `${colors.green}Loaded allowedPackages from ${configPath}.${colors.reset}`
      );
      return config.allowedPackages;
    } else {
      console.warn(
        `${colors.yellow}Invalid format in .pnpm-license-checker.json: allowedPackages should be an array. Defaulting to an empty list.${colors.reset}`
      );
      return [];
    }
  } catch (error) {
    console.error(
      `${colors.red}Error reading .pnpm-license-checker.json: ${error.message}${colors.reset}`
    );
    return [];
  }
}

/**
 * Processes license strings with "OR" logic
 * @param {string} licenseKey - License string, e.g., "(MIT OR Apache-2.0)"
 * @returns {Array<string>} - Array of individual licenses
 */
function processLicenseKey(licenseKey) {
  return licenseKey
    .replace(/[()]/g, '')
    .split(/\s*OR\s*/)
    .map((license) => license.trim());
}

module.exports = {
  findLicenseCheckerConfig,
  loadAllowedPackages,
  processLicenseKey,
  allowedLicenses,
};
