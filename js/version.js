// Static version - only updated by update-version.js script
export const version = {
    year: 2025,
    month: 7,
    build: 53,
    toString: function() {
        return `${this.year}.${this.month}.${this.build}`;
    }
};
