// Get current date
const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth() + 1; // getMonth() returns 0-11, so add 1

// Get the last build number from localStorage or default to 0
const getLastBuildInfo = () => {
    const lastInfo = localStorage.getItem('meale-version-info');
    if (lastInfo) {
        return JSON.parse(lastInfo);
    }
    return { year: currentYear, month: currentMonth, build: 2 };
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
        return `${this.year}.${this.month}.${this.build}`;
    }
}; // Auto-updated based on current date
