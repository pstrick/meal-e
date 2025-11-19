// Static version - only updated by git pre-commit hook
export const version = {
    year: 2025,
    month: 11,
    build: 74,
    toString: function() {
        return `${this.year}.${this.month}.${this.build}`;
    }
};
