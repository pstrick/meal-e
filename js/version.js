export const version = {
    year: 2025,
    month: 6,  // June
    build: 26,  // Increment this with each push
    toString: function() {
        return `${this.year}.${this.month}.${this.build}`;
    }
}; 