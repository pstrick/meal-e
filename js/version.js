export const version = {
    year: 2024,
    month: 3,  // March
    build: 1,  // Increment this with each push
    toString: function() {
        return `${this.year}.${this.month}.${this.build}`;
    }
}; 