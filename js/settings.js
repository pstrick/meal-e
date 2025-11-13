import { showAlert } from './alert.js';

function normalizeThemePreference(settingsObj = {}) {
    let isDark = false;

    if (settingsObj.theme === 'dark') {
        isDark = true;
    } else if (settingsObj.theme === 'light') {
        isDark = false;
    } else if (typeof settingsObj.darkMode === 'boolean') {
        isDark = settingsObj.darkMode;
    }

    settingsObj.theme = isDark ? 'dark' : 'light';
    settingsObj.darkMode = isDark;

    return settingsObj;
}

// Initialize settings immediately
let settings = normalizeThemePreference({
    mealPlanStartDay: 0,  // Default to Sunday
    theme: 'light',
    darkMode: false,
    nutritionGoals: {
        calories: 2000,
        protein: 150,
        carbs: 200,
        fat: 65
    }
});

// Load settings from localStorage if available
const savedSettings = localStorage.getItem('meale-settings');
if (savedSettings) {
    try {
        const parsedSettings = JSON.parse(savedSettings);
        settings = normalizeThemePreference({ ...settings, ...parsedSettings });
        console.log('Loaded settings from localStorage:', settings);
    } catch (e) {
        console.error('Error loading settings:', e);
    }
}

// Make settings available globally immediately
window.settings = settings;

// Apply dark mode to the document
function applyDarkMode() {
    const isDark = settings.theme === 'dark';
    const root = document.documentElement;

    root.classList.toggle('dark-mode', isDark);
    root.style.colorScheme = isDark ? 'dark' : 'light';

    if (isDark) {
        root.style.backgroundColor = '#0f172a';
    } else {
        root.style.removeProperty('background-color');
    }

    if (document.body) {
        document.body.classList.toggle('dark-theme', isDark);
    }
}

// Save settings to localStorage
function saveToLocalStorage() {
    normalizeThemePreference(settings);
    localStorage.setItem('meale-settings', JSON.stringify(settings));
    // Update global settings
    window.settings = settings;
    // Apply dark mode immediately
    applyDarkMode();
}

// Initialize form with current settings
function initializeForm() {
    // Initialize dark mode toggle
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    if (darkModeToggle) {
        darkModeToggle.checked = settings.theme === 'dark';
        darkModeToggle.addEventListener('change', (event) => {
            settings.theme = event.target.checked ? 'dark' : 'light';
            settings.darkMode = settings.theme === 'dark';
            saveToLocalStorage();
            console.log('Theme toggled:', settings.theme);
        });
    }

    const startDaySelect = document.getElementById('start-day');
    if (startDaySelect) {
        startDaySelect.value = settings.mealPlanStartDay.toString();
        startDaySelect.addEventListener('change', (event) => {
            const startDay = parseInt(event.target.value);
            settings.mealPlanStartDay = startDay;
            saveToLocalStorage();
            console.log('Settings updated:', settings);
        });
    }

    // Initialize nutrition goals
    const calorieGoal = document.getElementById('calorie-goal');
    const proteinGoal = document.getElementById('protein-goal');
    const carbsGoal = document.getElementById('carbs-goal');
    const fatGoal = document.getElementById('fat-goal');
    const saveNutritionGoalsBtn = document.getElementById('save-nutrition-goals');

    if (calorieGoal) {
        calorieGoal.value = settings.nutritionGoals.calories || '';
    }
    if (proteinGoal) {
        proteinGoal.value = settings.nutritionGoals.protein || '';
    }
    if (carbsGoal) {
        carbsGoal.value = settings.nutritionGoals.carbs || '';
    }
    if (fatGoal) {
        fatGoal.value = settings.nutritionGoals.fat || '';
    }

    if (saveNutritionGoalsBtn) {
        saveNutritionGoalsBtn.addEventListener('click', saveNutritionGoals);
    }
}

async function saveNutritionGoals() {
    const goals = {
        calories: parseInt(document.getElementById('calorie-goal').value) || 0,
        protein: parseInt(document.getElementById('protein-goal').value) || 0,
        carbs: parseInt(document.getElementById('carbs-goal').value) || 0,
        fat: parseInt(document.getElementById('fat-goal').value) || 0
    };
    
    settings.nutritionGoals = goals;
    saveToLocalStorage();
    
    // Show success message
    const btn = document.getElementById('save-nutrition-goals');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-check"></i> Saved!';
    btn.style.background = 'var(--success-color)';
    
    setTimeout(() => {
        btn.innerHTML = originalText;
        btn.style.background = '';
    }, 2000);
    
    console.log('Nutrition goals saved:', goals);
    
    // Refresh meal plan if we're on the meal plan page
    if (window.location.pathname.includes('mealplan.html')) {
        try {
            const { refreshMealPlanOnSettingsChange } = await import('./mealplan.js');
            refreshMealPlanOnSettingsChange();
        } catch (error) {
            console.log('Meal plan refresh not available:', error);
        }
    }
}

// Recurring Items Management
function loadRecurringItems() {
    try {
        const saved = localStorage.getItem('meale-recurring-items');
        return saved ? JSON.parse(saved) : [];
    } catch (error) {
        console.error('Error loading recurring items:', error);
        return [];
    }
}

function updateRecurringItemsDisplay() {
    const recurringItemsList = document.getElementById('recurring-items-list');
    if (!recurringItemsList) return;
    
    const recurringItems = loadRecurringItems();
    
    if (recurringItems.length === 0) {
        recurringItemsList.innerHTML = '<div class="no-items">No recurring items yet</div>';
        return;
    }
    
    recurringItemsList.innerHTML = recurringItems.map(item => {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const selectedDays = item.days.map(dayIndex => days[dayIndex]).join(', ');
        const endDateText = item.endDate ? ` (ends ${new Date(item.endDate).toLocaleDateString()})` : ' (indefinite)';
        
        return `
            <div class="recurring-item-card">
                <div class="recurring-item-info">
                    <h4>${item.name}</h4>
                    <p><strong>Days:</strong> ${selectedDays}</p>
                    <p><strong>Meal:</strong> ${item.mealType}</p>
                    <p><strong>Amount:</strong> ${item.amount}g</p>
                    <p><strong>Duration:</strong> ${endDateText}</p>
                </div>
                <div class="recurring-item-actions">
                    <button class="btn btn-danger btn-sm" onclick="deleteRecurringItem(${item.id})">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function clearDeletedInstances() {
    if (confirm('Are you sure you want to restore all manually deleted recurring item instances? This will bring back any recurring items you previously removed from specific days.')) {
        localStorage.removeItem('meale-deleted-recurring-instances');
        showAlert('Deleted instances have been cleared. Recurring items will now appear on all their scheduled days.', { type: 'success' });
    }
}

// Make functions globally available
window.deleteRecurringItem = function(id) {
    if (confirm('Are you sure you want to delete this recurring item? This will remove it from all days.')) {
        let recurringItems = loadRecurringItems();
        recurringItems = recurringItems.filter(item => item.id !== id);
        localStorage.setItem('meale-recurring-items', JSON.stringify(recurringItems));
        updateRecurringItemsDisplay();
    }
};

// Add event listeners
document.addEventListener('DOMContentLoaded', () => {
    initializeForm();
    // Apply dark mode on page load
    applyDarkMode();
    
    // Initialize recurring items display
    updateRecurringItemsDisplay();
    
    // Add event listener for clear deleted instances button
    const clearDeletedBtn = document.getElementById('clear-deleted-instances');
    if (clearDeletedBtn) {
        clearDeletedBtn.addEventListener('click', clearDeletedInstances);
    }
});

// Export settings and save function
export { settings, saveToLocalStorage, applyDarkMode }; 