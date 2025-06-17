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

// Handle form submission
function handleSettingsSubmit(event) {
    event.preventDefault();
    
    try {
        // Get the selected start day
        const startDay = parseInt(document.getElementById('start-day').value);
        
        // Update settings
        settings.mealPlanStartDay = startDay;
        
        // Save to localStorage
        saveToLocalStorage();
        
        // Show success message
        alert('Settings saved successfully!');
        
        console.log('Settings updated:', settings);
    } catch (error) {
        console.error('Error saving settings:', error);
        alert('Error saving settings. Please try again.');
    }
}

// Initialize form with current settings
function initializeForm() {
    const startDaySelect = document.getElementById('start-day');
    if (startDaySelect) {
        startDaySelect.value = settings.mealPlanStartDay.toString();
    }
}

// Add event listeners
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('settings-form');
    if (form) {
        form.addEventListener('submit', handleSettingsSubmit);
    }
    
    initializeForm();
});

// Export settings and save function
export { settings, saveToLocalStorage }; 