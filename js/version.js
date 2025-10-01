// Static version - only updated by git pre-commit hook
export const version = {
    year: 2025,
    month: 10,
    build: 4,
    toString: function() {
        return `${this.year}.${this.month}.${this.build}`;
    }
};
