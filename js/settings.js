import { version } from './version.js';

// Initialize settings immediately
let settings = {
    mealPlanStartDay: 0,  // Default to Sunday
    nutritionGoals: {
        calories: 2000,
        protein: 150,
        carbs: 200,
        fat: 65
    }
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

function saveNutritionGoals() {
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
}

// Add event listeners
document.addEventListener('DOMContentLoaded', () => {
    initializeForm();
});

// Export settings and save function
export { settings, saveToLocalStorage }; 