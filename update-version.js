#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read the current version file to get the last minor version
const versionFilePath = path.join(__dirname, 'js', 'version.js');
let currentMinor = 1;

try {
    const versionContent = fs.readFileSync(versionFilePath, 'utf8');
    const majorMatch = versionContent.match(/major:\s*(\d+)/);
    const minorMatch = versionContent.match(/minor:\s*(\d+)/);
    
    if (majorMatch && minorMatch) {
        const lastMajor = parseInt(majorMatch[1]);
        const lastMinor = parseInt(minorMatch[1]);
        
        // Always increment minor version
        currentMinor = lastMinor + 1;
    }
} catch (error) {
    console.log('Could not read current version file, starting with minor 1');
}

// Create the new version content
const newVersionContent = `// Static version - only updated by update-version.js script
export const version = {
    major: 2025,
    minor: ${currentMinor},
    toString: function() {
        return \`\${this.major}.\${this.minor}\`;
    }
};
`;

// Write the new version file
try {
    fs.writeFileSync(versionFilePath, newVersionContent);
    console.log(`✅ Version updated to 2025.${currentMinor}`);
} catch (error) {
    console.error('❌ Error updating version file:', error.message);
    process.exit(1);
} 