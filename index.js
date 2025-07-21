#!/usr/bin/env node

import { exec } from 'node:child_process';
import { loadConfig, processLicenseKey } from './src/licenseChecker.js';

// ANSI escape codes for colors
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
};

function getPnpmLicenses() {
  return new Promise((resolve, reject) => {
    exec(
      'pnpm licenses list --json',
      { encoding: 'utf-8' },
      (error, stdout, stderr) => {
        if (error) {
          reject(`Error: ${error.message}`);
          return;
        }
        if (stderr) {
          reject(`Standard Error: ${stderr}`);
          return;
        }
        try {
          const licensesData = JSON.parse(stdout);
          resolve(licensesData);
        } catch (parseError) {
          reject(`Failed to parse JSON: ${parseError.message}`);
        }
      },
    );
  });
}

(async () => {
  try {
    const { allowedPackages, allowedLicenses } = loadConfig();
    const licenses = await getPnpmLicenses();

    console.log('Licenses Data:', licenses);

    let hasUnsupportedLicense = false;

    // Iterate over licenses
    for (const [licenseKey, packages] of Object.entries(licenses)) {
      // Process license key to handle "OR" lists
      const individualLicenses = processLicenseKey(licenseKey);

      // Filter out allowed packages
      const filteredPackages = packages
        .filter((pkg) => !allowedPackages.includes(pkg.name))
        .map((pkg) => pkg.name); // Get the names of the remaining packages

      // Check licenses for filtered packages
      if (filteredPackages.length > 0) {
        // Ensure all individual licenses in the list are supported
        const unsupportedLicenses = individualLicenses.filter(
          (license) => !allowedLicenses.includes(license),
        );

        if (unsupportedLicenses.length > 0) {
          hasUnsupportedLicense = true;
          console.error(
            `${
              colors.red
            }Unsupported License(s) Detected: ${unsupportedLicenses.join(
              ', ',
            )}${colors.reset}`,
          );
          console.error(`Affected Packages: ${filteredPackages.join(', ')}`);
        }
      }
    }

    if (hasUnsupportedLicense) {
      throw new Error('One or more packages have unsupported licenses.');
    }
    console.log(
      `${colors.green}All packages have supported licenses.${colors.reset}`,
    );
  } catch (error) {
    console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
    process.exit(1); // Exit with failure code
  }
})();
