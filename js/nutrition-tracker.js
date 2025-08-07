// Nutrition Tracker Module
import { settings } from './settings.js';

// Global variables
let currentDate = new Date();
let currentDayOffset = 0;
let nutritionLogs = {};
let currentMeal = '';

// DOM elements
let addFoodModal, foodSearch, foodSearchResults, selectedFoodSection;
let selectedFoodDetails, foodAmount, foodServings, nutritionPreview;
let currentDateDisplay, prevDayBtn, nextDayBtn;
let saveGoalsBtn, autoLogWeekBtn;

// Initialize the nutrition tracker
document.addEventListener('DOMContentLoaded', async function() {
    await initializeNutritionTracker();
});

async function initializeNutritionTracker() {
    try {
        // Initialize DOM elements
        initializeDOMElements();
        
        // Load data
        loadNutritionLogs();
        
        // Set up event listeners
        setupEventListeners();
        
        // Update display
        updateDateDisplay();
        updateGoalsDisplay();
        updateProgressDisplay();
        updateMealsDisplay();
        
        console.log('Nutrition tracker initialized successfully');
    } catch (error) {
        console.error('Error initializing nutrition tracker:', error);
    }
}

function initializeDOMElements() {
    // Modal elements
    addFoodModal = document.getElementById('add-food-modal');
    foodSearch = document.getElementById('food-search');
    foodSearchResults = document.getElementById('food-search-results');
    selectedFoodSection = document.getElementById('selected-food-section');
    selectedFoodDetails = document.getElementById('selected-food-details');
    foodAmount = document.getElementById('food-amount');
    nutritionPreview = document.getElementById('nutrition-preview');
    
    // Navigation elements
    currentDateDisplay = document.getElementById('current-date');
    prevDayBtn = document.getElementById('prev-day');
    nextDayBtn = document.getElementById('next-day');
    
    // Button elements
    autoLogWeekBtn = document.getElementById('auto-log-week');
}

function setupEventListeners() {
    // Date navigation
    prevDayBtn.addEventListener('click', () => navigateDate(-1));
    nextDayBtn.addEventListener('click', () => navigateDate(1));
    
    // Goals are now handled in settings
    
    // Auto-log from meal plan
    autoLogWeekBtn.addEventListener('click', autoLogFromMealPlan);
    
    // Add food buttons
    document.querySelectorAll('.add-food-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const meal = e.target.closest('.add-food-btn').dataset.meal;
            openAddFoodModal(meal);
        });
    });
    
    // Modal events
    const closeBtn = addFoodModal.querySelector('.close');
    const cancelBtn = document.getElementById('cancel-add-food');
    const addFoodBtn = document.getElementById('add-food-to-meal');
    
    closeBtn.addEventListener('click', closeAddFoodModal);
    cancelBtn.addEventListener('click', closeAddFoodModal);
    addFoodBtn.addEventListener('click', addFoodToMeal);
    
    // Search functionality
    foodSearch.addEventListener('input', handleFoodSearch);
    
    // Amount changes
    foodAmount.addEventListener('input', updateNutritionPreview);
    
    // Click outside modal to close
    window.addEventListener('click', (e) => {
        if (e.target === addFoodModal) {
            closeAddFoodModal();
        }
    });
}

// Date Navigation
function navigateDate(direction) {
    currentDayOffset += direction;
    currentDate = new Date();
    currentDate.setDate(currentDate.getDate() + currentDayOffset);
    
    console.log('Navigating date:', direction, 'New date:', currentDate.toISOString().split('T')[0]);
    
    updateDateDisplay();
    updateProgressDisplay();
    updateMealsDisplay();
}

function updateDateDisplay() {
    const dateString = currentDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    if (currentDayOffset === 0) {
        currentDateDisplay.textContent = 'Today';
    } else if (currentDayOffset === 1) {
        currentDateDisplay.textContent = 'Tomorrow';
    } else if (currentDayOffset === -1) {
        currentDateDisplay.textContent = 'Yesterday';
    } else {
        currentDateDisplay.textContent = dateString;
    }
}

// Goals Management
function updateGoalsDisplay() {
    const goals = settings.nutritionGoals || { calories: 0, protein: 0, carbs: 0, fat: 0 };
    
    document.getElementById('calorie-goal-display').textContent = goals.calories || 0;
    document.getElementById('protein-goal-display').textContent = goals.protein || 0;
    document.getElementById('carbs-goal-display').textContent = goals.carbs || 0;
    document.getElementById('fat-goal-display').textContent = goals.fat || 0;
}

// Nutrition Logs Management
function loadNutritionLogs() {
    const saved = localStorage.getItem('nutritionLogs');
    if (saved) {
        nutritionLogs = JSON.parse(saved);
    } else {
        nutritionLogs = {};
    }
}

function saveNutritionLogs() {
    localStorage.setItem('nutritionLogs', JSON.stringify(nutritionLogs));
}

function getCurrentDateKey() {
    return currentDate.toISOString().split('T')[0];
}

function getDayLog() {
    const dateKey = getCurrentDateKey();
    if (!nutritionLogs[dateKey]) {
        nutritionLogs[dateKey] = {
            breakfast: [],
            lunch: [],
            dinner: [],
            snacks: []
        };
    }
    return nutritionLogs[dateKey];
}

// Progress Display
function updateProgressDisplay() {
    const dayLog = getDayLog();
    const totals = calculateDayTotals(dayLog);
    
    // Update current values
    document.getElementById('calorie-current').textContent = Math.round(totals.calories);
    document.getElementById('protein-current').textContent = Math.round(totals.protein);
    document.getElementById('carbs-current').textContent = Math.round(totals.carbs);
    document.getElementById('fat-current').textContent = Math.round(totals.fat);
    
    const goals = settings.nutritionGoals || { calories: 0, protein: 0, carbs: 0, fat: 0 };
    
    // Update targets
    document.getElementById('calorie-target').textContent = goals.calories || 0;
    document.getElementById('protein-target').textContent = goals.protein || 0;
    document.getElementById('carbs-target').textContent = goals.carbs || 0;
    document.getElementById('fat-target').textContent = goals.fat || 0;
    
    // Update progress bars
    updateProgressBar('calorie', totals.calories, goals.calories);
    updateProgressBar('protein', totals.protein, goals.protein);
    updateProgressBar('carbs', totals.carbs, goals.carbs);
    updateProgressBar('fat', totals.fat, goals.fat);
}

function updateProgressBar(type, current, target) {
    const progressBar = document.getElementById(`${type}-progress`);
    if (!target || target === 0) {
        progressBar.style.width = '0%';
        return;
    }
    
    const percentage = Math.min((current / target) * 100, 100);
    progressBar.style.width = `${percentage}%`;
    
    // Color coding
    if (percentage >= 100) {
        progressBar.style.backgroundColor = '#e74c3c'; // Red for over
    } else if (percentage >= 80) {
        progressBar.style.backgroundColor = '#f39c12'; // Orange for close
    } else {
        progressBar.style.backgroundColor = '#27ae60'; // Green for good
    }
}

function calculateDayTotals(dayLog) {
    const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    
    Object.values(dayLog).forEach(meal => {
        meal.forEach(food => {
            totals.calories += food.calories || 0;
            totals.protein += food.protein || 0;
            totals.carbs += food.carbs || 0;
            totals.fat += food.fat || 0;
        });
    });
    
    return totals;
}

// Meals Display
function updateMealsDisplay() {
    const dayLog = getDayLog();
    console.log('Updating meals display for date:', getCurrentDateKey(), 'Day log:', dayLog);
    
    ['breakfast', 'lunch', 'dinner', 'snacks'].forEach(meal => {
        updateMealDisplay(meal, dayLog[meal]);
    });
}

function updateMealDisplay(meal, foods) {
    const itemsContainer = document.getElementById(`${meal}-items`);
    const totalsContainer = document.getElementById(`${meal}-totals`);
    
    // Clear container
    itemsContainer.innerHTML = '';
    
    if (foods.length === 0) {
        itemsContainer.innerHTML = '<div class="no-items">No foods logged yet</div>';
        totalsContainer.innerHTML = '<span>0 calories</span>';
        return;
    }
    
    // Add food items
    foods.forEach((food, index) => {
        const foodElement = createFoodElement(food, meal, index);
        itemsContainer.appendChild(foodElement);
    });
    
    // Calculate and display totals
    const mealTotals = foods.reduce((totals, food) => {
        totals.calories += food.calories || 0;
        totals.protein += food.protein || 0;
        totals.carbs += food.carbs || 0;
        totals.fat += food.fat || 0;
        return totals;
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
    
    totalsContainer.innerHTML = `
        <span>${Math.round(mealTotals.calories)} calories</span>
        <div class="meal-macros">
            <span class="macro protein">${Math.round(mealTotals.protein)}g protein</span>
            <span class="macro carbs">${Math.round(mealTotals.carbs)}g carbs</span>
            <span class="macro fat">${Math.round(mealTotals.fat)}g fat</span>
        </div>
    `;
}

function createFoodElement(food, meal, index) {
    const div = document.createElement('div');
    div.className = 'food-item';
    div.innerHTML = `
        <div class="food-info">
            <div class="food-name">${food.name}</div>
            <div class="food-details">
                ${food.amount}g
            </div>
            <div class="food-nutrition">
                <span class="calories">${Math.round(food.calories)} cal</span>
                <span class="protein">${Math.round(food.protein)}g protein</span>
                <span class="carbs">${Math.round(food.carbs)}g carbs</span>
                <span class="fat">${Math.round(food.fat)}g fat</span>
            </div>
        </div>
        <button class="remove-food" onclick="removeFood('${meal}', ${index})">
            <i class="fas fa-times"></i>
        </button>
    `;
    return div;
}

// Make removeFood globally accessible
window.removeFood = function(meal, index) {
    const dayLog = getDayLog();
    dayLog[meal].splice(index, 1);
    saveNutritionLogs();
    updateMealsDisplay();
    updateProgressDisplay();
};

// Add Food Modal
function openAddFoodModal(meal) {
    currentMeal = meal;
    const mealNames = {
        breakfast: 'Breakfast',
        lunch: 'Lunch',
        dinner: 'Dinner',
        snacks: 'Snacks'
    };
    
    document.getElementById('modal-meal-name').textContent = mealNames[meal];
    addFoodModal.classList.add('active');
    
    // Clear previous data
    foodSearch.value = '';
    foodSearchResults.innerHTML = '';
    selectedFoodSection.style.display = 'none';
}

function closeAddFoodModal() {
    addFoodModal.classList.remove('active');
    currentMeal = '';
}

function handleFoodSearch() {
    const query = foodSearch.value.toLowerCase().trim();
    if (query.length < 2) {
        foodSearchResults.innerHTML = '';
        return;
    }
    
    const results = searchFoods(query);
    displaySearchResults(results);
}

function searchFoods(query) {
    const results = [];
    
    // Search custom ingredients
    const ingredients = JSON.parse(localStorage.getItem('meale-custom-ingredients') || '[]');
    console.log('Searching ingredients:', ingredients.length, 'found');
    ingredients.forEach(ingredient => {
        if (ingredient.name.toLowerCase().includes(query)) {
            results.push({
                type: 'ingredient',
                data: ingredient
            });
        }
    });
    
    // Search custom recipes
    const recipes = JSON.parse(localStorage.getItem('recipes') || '[]');
    console.log('Searching recipes:', recipes.length, 'found');
    recipes.forEach(recipe => {
        if (recipe.name.toLowerCase().includes(query)) {
            results.push({
                type: 'recipe',
                data: recipe
            });
        }
    });
    
    console.log('Search results:', results.length, 'total');
    return results.slice(0, 10); // Limit to 10 results
}

function displaySearchResults(results) {
    foodSearchResults.innerHTML = '';
    
    if (results.length === 0) {
        foodSearchResults.innerHTML = '<div class="no-results">No foods found</div>';
        return;
    }
    
    results.forEach(result => {
        const div = document.createElement('div');
        div.className = 'search-result-item';
        div.innerHTML = `
            <div class="result-header">
                <span class="result-type ${result.type}">${result.type}</span>
                <h4>${result.data.name}</h4>
            </div>
            <p>${result.type === 'recipe' ? 'Recipe' : 'Ingredient'}</p>
        `;
        
        div.addEventListener('click', () => selectFood(result));
        foodSearchResults.appendChild(div);
    });
}

function selectFood(foodResult) {
    const food = foodResult.data;
    const type = foodResult.type;
    
    // Store the selected food data for calculations
    selectedFoodDetails.dataset.foodData = JSON.stringify(food);
    selectedFoodDetails.dataset.foodType = type;
    
    selectedFoodDetails.innerHTML = `
        <div class="selected-food-info">
            <h4>${food.name}</h4>
            <p class="food-type">${type === 'recipe' ? 'Recipe' : 'Ingredient'}</p>
            ${type === 'recipe' ? `<p class="serving-size">Serving size: ${food.servingSize || '1 serving'}</p>` : ''}
            ${type === 'ingredient' ? `<p class="nutrition-info">Per 100g: ${food.calories || 0} cal, ${food.protein || 0}g protein, ${food.carbs || 0}g carbs, ${food.fat || 0}g fat</p>` : ''}
        </div>
    `;
    
    selectedFoodSection.style.display = 'block';
    updateNutritionPreview();
}

function updateNutritionPreview() {
    const amount = parseFloat(foodAmount.value) || 0;
    
    // Get the selected food data
    const foodDataStr = selectedFoodDetails.dataset.foodData;
    const foodType = selectedFoodDetails.dataset.foodType;
    
    if (!foodDataStr) {
        nutritionPreview.innerHTML = '<h4>Nutrition Preview</h4><p>Select a food first</p>';
        return;
    }
    
    const foodData = JSON.parse(foodDataStr);
    let calories = 0, protein = 0, carbs = 0, fat = 0;
    
    if (foodType === 'ingredient') {
        // For ingredients, calculate based on per 100g values
        const multiplier = amount / 100; // Convert to percentage of 100g
        calories = Math.round((foodData.calories || 0) * multiplier);
        protein = Math.round((foodData.protein || 0) * multiplier);
        carbs = Math.round((foodData.carbs || 0) * multiplier);
        fat = Math.round((foodData.fat || 0) * multiplier);
    } else if (foodType === 'recipe') {
        // For recipes, use the stored nutrition data per serving
        if (foodData.nutrition) {
            // Calculate based on the amount relative to serving size
            const servingRatio = amount / (foodData.servingSize || 1);
            calories = Math.round((foodData.nutrition.calories || 0) * servingRatio);
            protein = Math.round((foodData.nutrition.protein || 0) * servingRatio);
            carbs = Math.round((foodData.nutrition.carbs || 0) * servingRatio);
            fat = Math.round((foodData.nutrition.fat || 0) * servingRatio);
        } else {
            // Fallback for recipes without nutrition data
            calories = 0;
            protein = 0;
            carbs = 0;
            fat = 0;
        }
    }
    
    console.log('Nutrition preview calculation:', {
        amount,
        foodType,
        foodData,
        calculated: { calories, protein, carbs, fat }
    });
    
    nutritionPreview.innerHTML = `
        <h4>Nutrition Preview</h4>
        <div class="nutrition-values">
            <span class="calories">${calories} calories</span>
            <span class="protein">${protein}g protein</span>
            <span class="carbs">${carbs}g carbs</span>
            <span class="fat">${fat}g fat</span>
        </div>
    `;
}

function addFoodToMeal() {
    const amount = parseFloat(foodAmount.value) || 0;
    
    if (amount <= 0) {
        alert('Please enter a valid amount');
        return;
    }
    
    // Get the selected food data
    const foodDataStr = selectedFoodDetails.dataset.foodData;
    const foodType = selectedFoodDetails.dataset.foodType;
    
    if (!foodDataStr) {
        alert('Please select a food first');
        return;
    }
    
    const foodData = JSON.parse(foodDataStr);
    let calories = 0, protein = 0, carbs = 0, fat = 0;
    
    if (foodType === 'ingredient') {
        // For ingredients, calculate based on per 100g values
        const multiplier = amount / 100; // Convert to percentage of 100g
        calories = Math.round((foodData.calories || 0) * multiplier);
        protein = Math.round((foodData.protein || 0) * multiplier);
        carbs = Math.round((foodData.carbs || 0) * multiplier);
        fat = Math.round((foodData.fat || 0) * multiplier);
    } else if (foodType === 'recipe') {
        // For recipes, calculate based on serving size and ingredients
        if (foodData.ingredients && Array.isArray(foodData.ingredients)) {
            foodData.ingredients.forEach(ingredient => {
                const ingredientMultiplier = (ingredient.amount || 0) / 100;
                calories += Math.round((ingredient.calories || 0) * ingredientMultiplier);
                protein += Math.round((ingredient.protein || 0) * ingredientMultiplier);
                carbs += Math.round((ingredient.carbs || 0) * ingredientMultiplier);
                fat += Math.round((ingredient.fat || 0) * ingredientMultiplier);
            });
        } else {
            // Fallback for recipes without detailed ingredient data
            calories = Math.round((foodData.calories || 0));
            protein = Math.round((foodData.protein || 0));
            carbs = Math.round((foodData.carbs || 0));
            fat = Math.round((foodData.fat || 0));
        }
    }
    
    // Create food entry with calculated nutrition
    const foodEntry = {
        name: selectedFoodDetails.querySelector('h4').textContent,
        amount: amount,
        calories: calories,
        protein: protein,
        carbs: carbs,
        fat: fat,
        timestamp: new Date().toISOString()
    };
    
    console.log('Adding food entry:', foodEntry);
    
    // Add to current day's log
    const dayLog = getDayLog();
    dayLog[currentMeal].push(foodEntry);
    
    // Save and update
    saveNutritionLogs();
    updateMealsDisplay();
    updateProgressDisplay();
    
    closeAddFoodModal();
}

// Auto-log from Meal Plan
async function autoLogFromMealPlan() {
    try {
        const mealPlan = JSON.parse(localStorage.getItem('mealPlan') || '{}');
        const dayLog = getDayLog();
        
        // Clear existing logs for the week
        const weekStart = new Date(currentDate);
        weekStart.setDate(weekStart.getDate() - currentDate.getDay());
        
        for (let i = 0; i < 7; i++) {
            const date = new Date(weekStart);
            date.setDate(date.getDate() + i);
            const dateKey = date.toISOString().split('T')[0];
            
            if (!nutritionLogs[dateKey]) {
                nutritionLogs[dateKey] = {
                    breakfast: [],
                    lunch: [],
                    dinner: [],
                    snacks: []
                };
            }
            
            // Clear existing data for this day
            Object.keys(nutritionLogs[dateKey]).forEach(meal => {
                nutritionLogs[dateKey][meal] = [];
            });
        }
        
        // Process meal plan data
        Object.keys(mealPlan).forEach(mealKey => {
            const [dateStr, timeSlot] = mealKey.split('_');
            const mealDate = new Date(dateStr);
            const dateKey = mealDate.toISOString().split('T')[0];
            
            if (!nutritionLogs[dateKey]) return;
            
            const mealItems = mealPlan[mealKey];
            if (!Array.isArray(mealItems)) return;
            
            // Map time slots to meals
            let targetMeal = 'snacks'; // default
            if (timeSlot === 'breakfast') targetMeal = 'breakfast';
            else if (timeSlot === 'lunch') targetMeal = 'lunch';
            else if (timeSlot === 'dinner') targetMeal = 'dinner';
            
            mealItems.forEach(item => {
                if (item && item.name) {
                    const foodEntry = {
                        name: item.name,
                        amount: item.amount || 100,
                        calories: item.calories || 0,
                        protein: item.protein || 0,
                        carbs: item.carbs || 0,
                        fat: item.fat || 0,
                        timestamp: new Date().toISOString(),
                        fromMealPlan: true
                    };
                    
                    nutritionLogs[dateKey][targetMeal].push(foodEntry);
                }
            });
        });
        
        saveNutritionLogs();
        updateMealsDisplay();
        updateProgressDisplay();
        
        alert('Successfully imported meal plan data for the week!');
        
    } catch (error) {
        console.error('Error auto-logging from meal plan:', error);
        alert('Error importing meal plan data. Please try again.');
    }
} 