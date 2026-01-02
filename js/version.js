// Static version - only updated by git pre-commit hook
export const version = {
    year: 2026,
    month: 01,
    build: 1,
    toString: function() {
        return `${this.year}.${this.month}.${this.build}`;
    }
};
