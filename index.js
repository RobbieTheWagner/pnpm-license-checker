#!/usr/bin/env node

import {
  getPnpmLicenses,
  loadConfig,
  checkLicenses,
} from './src/licenseChecker.js';

// ANSI escape codes for colors
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
};

(async () => {
  try {
    const { allowedPackages, allowedLicenses } = loadConfig();
    const licenses = await getPnpmLicenses();

    console.log('Licenses Data:', licenses);

    const { passed, violations } = checkLicenses(licenses, allowedPackages, allowedLicenses);

    for (const { license, packages } of violations) {
      console.error(`${colors.red}Unsupported License Detected: ${license}${colors.reset}`);
      console.error(`Affected Packages: ${packages.join(', ')}`);
    }

    if (!passed) {
      throw new Error('One or more packages have unsupported licenses.');
    }
    console.log(
      `${colors.green}All packages have supported licenses.${colors.reset}`,
    );
  } catch (error) {
    console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
    process.exit(1);
  }
})();
