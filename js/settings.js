import { version } from './version.js';

// Update version in footer
document.querySelector('footer .version').textContent = `v${version.toString()}`;

// Initialize settings immediately
let settings = {
    mealPlanStartDay: 0  // Default to Sunday
};

// Load settings from localStorage if available
const savedSettings = localStorage.getItem('meale-settings');
if (savedSettings) {
    try {
        const parsedSettings = JSON.parse(savedSettings);
        settings = { ...settings, ...parsedSettings };
        console.log('Loaded settings from localStorage:', settings);
    } catch (e) {
        console.error('Error loading settings:', e);
    }
}

// Make settings available globally immediately
window.settings = settings;

// Save settings to localStorage
function saveToLocalStorage() {
    localStorage.setItem('meale-settings', JSON.stringify(settings));
    // Update global settings
    window.settings = settings;
}

// Initialize form with current settings
function initializeForm() {
    const startDaySelect = document.getElementById('start-day');
    if (startDaySelect) {
        startDaySelect.value = settings.mealPlanStartDay.toString();
        startDaySelect.addEventListener('change', (event) => {
            const startDay = parseInt(event.target.value);
            settings.mealPlanStartDay = startDay;
            saveToLocalStorage();
            // No alert needed
            console.log('Settings updated:', settings);
        });
    }
}

// Add event listeners
document.addEventListener('DOMContentLoaded', () => {
    initializeForm();
});

// Export settings and save function
export { settings, saveToLocalStorage }; 