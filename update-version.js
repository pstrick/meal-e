#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Get current date
const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth() + 1; // getMonth() returns 0-11, so add 1

// Read the current version file to get the last build number
const versionFilePath = path.join(__dirname, 'js', 'version.js');
let currentBuild = 1;

try {
    const versionContent = fs.readFileSync(versionFilePath, 'utf8');
    const buildMatch = versionContent.match(/build:\s*(\d+)/);
    if (buildMatch) {
        currentBuild = parseInt(buildMatch[1]) + 1;
    }
} catch (error) {
    console.log('Could not read current version file, starting with build 1');
}

// Create the new version content
const newVersionContent = `// Get current date
const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth() + 1; // getMonth() returns 0-11, so add 1

// Get the last build number from localStorage or default to 0
const getLastBuildInfo = () => {
    const lastInfo = localStorage.getItem('meale-version-info');
    if (lastInfo) {
        return JSON.parse(lastInfo);
    }
    return { year: currentYear, month: currentMonth, build: 0 };
};

const lastInfo = getLastBuildInfo();

// Determine if we need to reset build number (new month)
let buildNumber = 1; // Default to 1 for new month
if (lastInfo.year === currentYear && lastInfo.month === currentMonth) {
    // Same month, increment build number
    buildNumber = lastInfo.build + 1;
}

// Save current version info
const versionInfo = {
    year: currentYear,
    month: currentMonth,
    build: buildNumber
};
localStorage.setItem('meale-version-info', JSON.stringify(versionInfo));

export const version = {
    year: currentYear,
    month: currentMonth,
    build: buildNumber,
    toString: function() {
        return \`\${this.year}.\${this.month}.\${this.build}\`;
    }
}; // Auto-updated based on current date
`;

// Write the new version file
try {
    fs.writeFileSync(versionFilePath, newVersionContent);
    console.log(`✅ Version updated to ${currentYear}.${currentMonth}.${currentBuild}`);
    console.log(`📅 Current date: ${now.toLocaleDateString()}`);
} catch (error) {
    console.error('❌ Error updating version file:', error.message);
    process.exit(1);
} 