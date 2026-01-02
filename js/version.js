// Static version - only updated by git pre-commit hook
export const version = {
    year: 2026,
    month: 1,
    build: 21,
    toString: function() {
        return `${this.year}.${String(this.month).padStart(2, '0')}.${this.build}`;
    }
};
