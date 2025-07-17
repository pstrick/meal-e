// Meal Planning functionality
let currentWeekOffset = 0;  // Track week offset instead of modifying date directly
let selectedSlot = null;
let selectedItem = null;
let mealPlanForm = null;
let mealPlanModal = null;
let cancelMeal = null;
let weekDisplay = null;
let prevWeekBtn = null;
let nextWeekBtn = null;

// Initialize meal plan data
let mealPlan = {};

// Custom ingredient search function for meal plan (no USDA API)
async function searchAllIngredients(query) {
    const results = [];
    
    // Search custom ingredients only (no USDA API search)
    const customIngredients = JSON.parse(localStorage.getItem('meale-custom-ingredients') || '[]');
    const customMatches = customIngredients.filter(ingredient => 
        ingredient.name.toLowerCase().includes(query.toLowerCase())
    );
    
    // Add custom ingredients to results
    customMatches.forEach(ingredient => {
        // Convert nutrition from total serving size to per-gram values
        const servingSize = ingredient.servingSize || 100; // Default to 100g if not specified
        results.push({
            id: ingredient.id,
            name: ingredient.name,
            source: 'custom',
            nutrition: {
                calories: ingredient.nutrition.calories / servingSize,
                protein: ingredient.nutrition.protein / servingSize,
                carbs: ingredient.nutrition.carbs / servingSize,
                fat: ingredient.nutrition.fat / servingSize
            },
            servingSize: ingredient.servingSize,
            brandOwner: 'Custom Ingredient'
        });
    });
    
    // Sort results alphabetically
    results.sort((a, b) => a.name.localeCompare(b.name));
    
    return results;
}

// Get week dates based on current week and start day setting
function getWeekDates(weekOffset = 0) {
    console.log('getWeekDates called with weekOffset:', weekOffset);
    
    // Get settings from localStorage if not available globally
    if (!window.settings) {
        const savedSettings = localStorage.getItem('meale-settings');
        window.settings = savedSettings ? JSON.parse(savedSettings) : { mealPlanStartDay: 0 };
        console.log('Loaded settings in getWeekDates:', window.settings);
    }
    
    const startDay = parseInt(window.settings.mealPlanStartDay) || 0;
    console.log('Using start day from settings:', startDay);
    
    const today = new Date();
    console.log('Today:', today.toISOString());
    
    const currentDay = today.getDay();
    console.log('Current day of week:', currentDay);
    
    // Calculate days to start of week
    const daysToStart = (currentDay - startDay + 7) % 7;
    console.log('Days to start of week:', daysToStart);
    
    // Calculate start date of the week
    const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    startDate.setDate(startDate.getDate() - daysToStart + (weekOffset * 7));
    console.log('Calculated start date:', startDate.toISOString());
    
    // Generate dates for the week
    const dates = [];
    const dayNames = [];
    for (let i = 0; i < 7; i++) {
        const date = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
        dates.push(date.toISOString().split('T')[0]);
        dayNames.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
    }
    
    console.log('Generated dates:', dates);
    console.log('Generated day names:', dayNames);
    
    return {
        startDate: dates[0],
        endDate: dates[6],
        dates: dates,
        dayNames: dayNames
    };
}

function formatDate(dateStr) {
    console.log('Formatting date string:', dateStr);
    if (!dateStr) {
        console.log('Empty date string');
        return '';
    }
    try {
        const [year, month, day] = dateStr.split('-').map(Number);
        console.log('Parsed date components:', { year, month, day });
        if (isNaN(year) || isNaN(month) || isNaN(day)) {
            console.error('Invalid date components:', { year, month, day });
            return '';
        }
        const date = new Date(year, month - 1, day);
        console.log('Created date object:', date);
        if (isNaN(date.getTime())) {
            console.error('Invalid date object created');
            return '';
        }
        const formatted = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        console.log('Formatted date:', formatted);
        return formatted;
    } catch (error) {
        console.error('Error formatting date:', error);
        return '';
    }
}

function updateWeekDisplay() {
    console.log('Updating week display with offset:', currentWeekOffset);
    
    // Make sure weekDisplay element exists
    if (!weekDisplay) {
        console.error('weekDisplay element not found');
        return;
    }
    
    try {
        const week = getWeekDates(currentWeekOffset);
        console.log('Week data:', week);
        const startDate = formatDate(week.startDate);
        const endDate = formatDate(week.endDate);
        console.log('Formatted dates:', { startDate, endDate });
        if (startDate && endDate) {
            weekDisplay.textContent = `Week of ${startDate} - ${endDate}`;
        } else {
            console.error('Invalid dates generated');
            weekDisplay.textContent = 'Week of Loading...';
        }
        loadMealPlan();
    } catch (error) {
        console.error('Error updating week display:', error);
        weekDisplay.textContent = 'Week of Loading...';
    }
}

function openMealPlanModal(slot) {
    console.log('Opening meal plan modal for slot:', slot);
    
    if (!slot || !slot.dataset || !slot.dataset.day || !slot.dataset.meal) {
        console.error('Invalid slot provided:', slot);
        return;
    }
    
    selectedSlot = slot;
    selectedItem = null;
    
    // Reset the form and filters
    if (!mealPlanForm) {
        console.error('Meal plan form not found');
        return;
    }
    
    const unifiedSearch = mealPlanForm.querySelector('#unified-search');
    const categoryFilter = mealPlanForm.querySelector('#item-category-filter');
    const amountInput = mealPlanForm.querySelector('#item-amount');
    const selectedItemDiv = mealPlanForm.querySelector('.selected-item');
    const submitButton = mealPlanForm.querySelector('button[type="submit"]');
    
    if (unifiedSearch) unifiedSearch.value = '';
    if (categoryFilter) categoryFilter.value = 'all';
    if (amountInput) amountInput.value = '100';
    if (selectedItemDiv) selectedItemDiv.style.display = 'none';
    if (submitButton) submitButton.disabled = true;
    
    // Store the slot reference in a data attribute
    mealPlanForm.dataset.currentSlot = `${slot.dataset.day}-${slot.dataset.meal}`;
    console.log('Stored slot reference:', mealPlanForm.dataset.currentSlot);
    
    // Clear any selected items in the list
    mealPlanForm.querySelectorAll('.unified-option.selected').forEach(option => {
        option.classList.remove('selected');
    });
    
    // Make sure modal is visible
    mealPlanModal.style.display = 'block';
    mealPlanModal.classList.add('active');

    // Load all items immediately
    updateUnifiedList();
}

async function updateUnifiedList() {
    const unifiedList = document.querySelector('.unified-list');
    const searchInput = document.getElementById('unified-search');
    const categoryFilter = document.getElementById('item-category-filter');
    
    // Check if required elements exist
    if (!unifiedList || !searchInput || !categoryFilter) {
        console.log('Unified list elements not found, skipping update');
        return;
    }
    
    const searchTerm = searchInput.value.toLowerCase().trim();
    const category = categoryFilter.value;
    
    // Clear the current list
    unifiedList.innerHTML = '';
    
    const results = [];
    
    // Search meals (recipes)
    if (window.recipes && Array.isArray(window.recipes)) {
        const filteredMeals = window.recipes.filter(recipe => {
            const matchesSearch = searchTerm === '' || 
                recipe.name.toLowerCase().includes(searchTerm) ||
                recipe.ingredients.some(ing => ing.name.toLowerCase().includes(searchTerm));
            const matchesCategory = category === 'all' || recipe.category === category;
            return matchesSearch && matchesCategory;
        });
        
        filteredMeals.forEach(recipe => {
            results.push({
                type: 'meal',
                id: recipe.id,
                name: recipe.name,
                category: recipe.category,
                servingSize: recipe.servingSize,
                nutrition: recipe.nutrition,
                icon: '🍽️',
                label: 'Meal'
            });
        });
    }
    
    // Search custom ingredients only
    try {
        const ingredientResults = await searchAllIngredients(searchTerm);
        for (const ingredient of ingredientResults) {
            // Only add if category matches or is 'all'
            if (category === 'all' || ingredient.category === category) {
                results.push({
                    type: 'ingredient',
                    id: `custom-${ingredient.id}`,
                    name: ingredient.name,
                    category: ingredient.category || 'ingredient',
                    nutrition: ingredient.nutrition,
                    source: ingredient.source,
                    icon: '🥩',
                    label: 'Ingredient'
                });
            }
        }
    } catch (error) {
        console.error('Error searching ingredients:', error);
    }
    
    // Sort results: meals first, then ingredients, then alphabetically
    results.sort((a, b) => {
        if (a.type === 'meal' && b.type !== 'meal') return -1;
        if (a.type !== 'meal' && b.type === 'meal') return 1;
        return a.name.localeCompare(b.name);
    });
    
    // Add results to the list
    results.forEach(item => {
        const div = document.createElement('div');
        div.className = 'unified-option';
        div.innerHTML = `
            <div class="item-header">
                <span class="item-icon">${item.icon}</span>
                <span class="item-type">${item.label}</span>
                <h4>${item.name}</h4>
            </div>
            <p>Category: ${item.category}</p>
            ${item.type === 'meal' ? `<p>Serving Size: ${item.servingSize}g</p>` : ''}
            <div class="item-nutrition">
                <span>Cal: ${Math.round(item.nutrition.calories * 100)}</span>
                <span>P: ${Math.round(item.nutrition.protein * 100)}g</span>
                <span>C: ${Math.round(item.nutrition.carbs * 100)}g</span>
                <span>F: ${Math.round(item.nutrition.fat * 100)}g</span>
            </div>
        `;
        
        div.addEventListener('click', () => {
            // Remove selection from other options
            unifiedList.querySelectorAll('.unified-option').forEach(option => {
                option.classList.remove('selected');
            });
            
            // Select this option
            div.classList.add('selected');
            selectItem(item);
        });
        
        unifiedList.appendChild(div);
    });
    
    // Show message if no items found
    if (results.length === 0) {
        unifiedList.innerHTML = '<div class="unified-option">No items found</div>';
    }
}

function selectItem(item) {
    console.log('Selecting item:', item);
    selectedItem = item;
    
    // Get elements from the form
    const selectedItemDiv = mealPlanForm.querySelector('.selected-item');
    const submitButton = mealPlanForm.querySelector('button[type="submit"]');
    
    if (!selectedItemDiv || !submitButton) {
        console.error('Required elements not found in the form');
        return;
    }
    
    // Update selected item display
    selectedItemDiv.style.display = 'block';
    selectedItemDiv.querySelector('.item-name').textContent = item.name;
    
    // Handle nutrition display - ensure we have nutrition data
    const nutrition = item.nutrition || { calories: 0, protein: 0, carbs: 0, fat: 0 };
    selectedItemDiv.querySelector('.calories').textContent = Math.round(nutrition.calories * 100);
    selectedItemDiv.querySelector('.protein').textContent = Math.round(nutrition.protein * 100);
    selectedItemDiv.querySelector('.carbs').textContent = Math.round(nutrition.carbs * 100);
    selectedItemDiv.querySelector('.fat').textContent = Math.round(nutrition.fat * 100);
    
    // Enable submit button and ensure it's visible
    submitButton.disabled = false;
    submitButton.style.display = 'block';
    console.log('Submit button enabled:', submitButton);
    
    // Update unified list selection
    const unifiedList = mealPlanForm.querySelector('.unified-list');
    if (unifiedList) {
        unifiedList.querySelectorAll('.unified-option').forEach(option => {
            option.classList.remove('selected');
            if (option.querySelector('h4').textContent === item.name) {
                option.classList.add('selected');
            }
        });
    }
}

function closeMealPlanModal() {
    if (!mealPlanModal) return;
    
    mealPlanModal.classList.remove('active');
    mealPlanModal.style.display = 'none';
    
    // Clear the stored slot reference
    if (mealPlanForm) {
        delete mealPlanForm.dataset.currentSlot;
    }
    
    selectedSlot = null;
    selectedItem = null;
    
    // Reset form if it exists
    if (mealPlanForm) {
        mealPlanForm.reset();
        const selectedItemDiv = mealPlanForm.querySelector('.selected-item');
        const submitButton = mealPlanForm.querySelector('button[type="submit"]');
        if (selectedItemDiv) selectedItemDiv.style.display = 'none';
        if (submitButton) submitButton.disabled = true;
    }
}

// Make closeMealPlanModal available globally
window.closeMealPlanModal = closeMealPlanModal;

function createMealItem(item, amount, itemIndex, slot) {
    const div = document.createElement('div');
    div.className = 'meal-item';
    div.dataset.itemType = item.type;
    div.dataset.itemId = item.id;
    div.dataset.itemAmount = amount;
    
    const icon = item.type === 'meal' ? '🍽️' : '🥩';
    const label = item.type === 'meal' ? 'Meal' : 'Ingredient';
    
    // Calculate nutrition for this item
    let itemNutrition = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    if (item.type === 'meal') {
        const recipe = window.recipes.find(r => r.id === item.id);
        if (recipe && recipe.nutrition) {
            const servingSize = recipe.servingSize || 100;
            const nutritionPerGram = {
                calories: recipe.nutrition.calories / servingSize,
                protein: recipe.nutrition.protein / servingSize,
                carbs: recipe.nutrition.carbs / servingSize,
                fat: recipe.nutrition.fat / servingSize
            };
            itemNutrition = {
                calories: nutritionPerGram.calories * amount,
                protein: nutritionPerGram.protein * amount,
                carbs: nutritionPerGram.carbs * amount,
                fat: nutritionPerGram.fat * amount
            };
        }
    } else if (item.type === 'ingredient') {
        if (item.id.startsWith('custom-')) {
            const customIngredients = JSON.parse(localStorage.getItem('meale-custom-ingredients') || '[]');
            const customId = item.id.replace('custom-', '');
            const customIngredient = customIngredients.find(ing => ing.id === customId);
            if (customIngredient) {
                const servingSize = customIngredient.servingSize || 100;
                const nutritionPerGram = {
                    calories: customIngredient.nutrition.calories / servingSize,
                    protein: customIngredient.nutrition.protein / servingSize,
                    carbs: customIngredient.nutrition.carbs / servingSize,
                    fat: customIngredient.nutrition.fat / servingSize
                };
                itemNutrition = {
                    calories: nutritionPerGram.calories * amount,
                    protein: nutritionPerGram.protein * amount,
                    carbs: nutritionPerGram.carbs * amount,
                    fat: nutritionPerGram.fat * amount
                };
            }
        } else if (item.nutrition) {
            itemNutrition = {
                calories: item.nutrition.calories * amount,
                protein: item.nutrition.protein * amount,
                carbs: item.nutrition.carbs * amount,
                fat: item.nutrition.fat * amount
            };
        }
    }
    
    div.innerHTML = `
        <div class="meal-item-header">
            <span class="meal-item-icon">${icon}</span>
            <span class="meal-item-name">${item.name}</span>
            <button class="remove-meal" title="Remove Item">&times;</button>
        </div>
        <div class="meal-item-details">
            <span class="meal-item-amount">${amount}g</span>
            <span class="meal-item-type">${label}</span>
        </div>
        <div class="meal-item-nutrition">
            <span class="nutrition-calories">${Math.round(itemNutrition.calories)} cal</span>
            <span class="nutrition-protein">${Math.round(itemNutrition.protein)}g P</span>
            <span class="nutrition-carbs">${Math.round(itemNutrition.carbs)}g C</span>
            <span class="nutrition-fat">${Math.round(itemNutrition.fat)}g F</span>
        </div>
    `;
    
    // Remove item handler
    div.querySelector('.remove-meal').addEventListener('click', (e) => {
        e.stopPropagation();
        // Remove this item from the slot
        const mealKey = getMealKey(slot.dataset.day, slot.dataset.meal);
        if (mealPlan[mealKey] && Array.isArray(mealPlan[mealKey])) {
            mealPlan[mealKey].splice(itemIndex, 1);
            if (mealPlan[mealKey].length === 0) delete mealPlan[mealKey];
            saveMealPlan();
            updateMealPlanDisplay();
            updateNutritionSummary();
        }
    });
    return div;
}

function getMealKey(date, mealType) {
    return `${date}-${mealType}`;
}

function saveMealPlan() {
    console.log('Saving meal plan...');
    
    // Save the current mealPlan object directly
    localStorage.setItem('mealPlan', JSON.stringify(mealPlan));
    console.log('Meal plan saved:', mealPlan);
}

async function loadMealPlan() {
    try {
        // Check if we're on the meal plan page
        const mealPlanGrid = document.querySelector('.meal-plan-grid');
        if (!mealPlanGrid) {
            console.log('Not on meal plan page, skipping meal plan load');
            return;
        }

        // Load meal plan from localStorage
        const savedMealPlan = localStorage.getItem('mealPlan');
        if (savedMealPlan) {
            mealPlan = JSON.parse(savedMealPlan);
            console.log('Meal plan loaded from localStorage:', mealPlan);
        } else {
            // Initialize empty meal plan if none exists
            mealPlan = {};
            console.log('No saved meal plan found, initializing empty plan');
        }

        // Update the display
        await updateMealPlanDisplay();
    } catch (error) {
        console.error('Error loading meal plan:', error);
        // Initialize empty meal plan on error
        mealPlan = {};
    }
}

async function calculateDayNutrition(date) {
    console.log('Calculating nutrition for date:', date);
    const nutrition = {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0
    };

    const mealTypes = ['breakfast', 'lunch', 'dinner', 'snacks'];
    
    for (const mealType of mealTypes) {
        const key = getMealKey(date, mealType);
        const items = mealPlan[key] || [];
        console.log(`Items for ${mealType}:`, items);
        
        for (const itemData of items) {
            if (itemData.type === 'meal') {
                const recipe = window.recipes.find(r => r.id === itemData.id);
                if (recipe && recipe.nutrition) {
                    // Convert recipe nutrition to per-gram values
                    const servingSize = recipe.servingSize || 100;
                    const nutritionPerGram = {
                        calories: recipe.nutrition.calories / servingSize,
                        protein: recipe.nutrition.protein / servingSize,
                        carbs: recipe.nutrition.carbs / servingSize,
                        fat: recipe.nutrition.fat / servingSize
                    };
                    
                    nutrition.calories += nutritionPerGram.calories * itemData.amount;
                    nutrition.protein += nutritionPerGram.protein * itemData.amount;
                    nutrition.carbs += nutritionPerGram.carbs * itemData.amount;
                    nutrition.fat += nutritionPerGram.fat * itemData.amount;
                }
            } else if (itemData.type === 'ingredient') {
                // For ingredients, we need to get nutrition data
                try {
                    let ingredientNutrition;
                    if (itemData.id.startsWith('custom-')) {
                        // Custom ingredient
                        const customIngredients = JSON.parse(localStorage.getItem('meale-custom-ingredients') || '[]');
                        const customId = itemData.id.replace('custom-', '');
                        const customIngredient = customIngredients.find(ing => ing.id === customId);
                        if (customIngredient) {
                            const servingSize = customIngredient.servingSize || 100;
                            ingredientNutrition = {
                                calories: customIngredient.nutrition.calories / servingSize,
                                protein: customIngredient.nutrition.protein / servingSize,
                                carbs: customIngredient.nutrition.carbs / servingSize,
                                fat: customIngredient.nutrition.fat / servingSize
                            };
                        }
                    } else {
                        // USDA ingredient - use stored nutrition if available
                        ingredientNutrition = itemData.nutrition || { calories: 0, protein: 0, carbs: 0, fat: 0 };
                    }
                    
                    if (ingredientNutrition) {
                        nutrition.calories += ingredientNutrition.calories * itemData.amount;
                        nutrition.protein += ingredientNutrition.protein * itemData.amount;
                        nutrition.carbs += ingredientNutrition.carbs * itemData.amount;
                        nutrition.fat += ingredientNutrition.fat * itemData.amount;
                    }
                } catch (error) {
                    console.error('Error calculating ingredient nutrition:', error);
                }
            }
        }
    }

    console.log('Calculated nutrition for', date, ':', nutrition);
    return nutrition;
}

async function calculateMealNutrition(date, mealType) {
    const key = getMealKey(date, mealType);
    const items = mealPlan[key] || [];
    const nutrition = {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0
    };

    for (const itemData of items) {
        if (itemData.type === 'meal') {
            const recipe = window.recipes.find(r => r.id === itemData.id);
            if (recipe && recipe.nutrition) {
                const servingSize = recipe.servingSize || 100;
                const nutritionPerGram = {
                    calories: recipe.nutrition.calories / servingSize,
                    protein: recipe.nutrition.protein / servingSize,
                    carbs: recipe.nutrition.carbs / servingSize,
                    fat: recipe.nutrition.fat / servingSize
                };
                
                nutrition.calories += nutritionPerGram.calories * itemData.amount;
                nutrition.protein += nutritionPerGram.protein * itemData.amount;
                nutrition.carbs += nutritionPerGram.carbs * itemData.amount;
                nutrition.fat += nutritionPerGram.fat * itemData.amount;
            }
        } else if (itemData.type === 'ingredient') {
            try {
                let ingredientNutrition;
                if (itemData.id.startsWith('custom-')) {
                    const customIngredients = JSON.parse(localStorage.getItem('meale-custom-ingredients') || '[]');
                    const customId = itemData.id.replace('custom-', '');
                    const customIngredient = customIngredients.find(ing => ing.id === customId);
                    if (customIngredient) {
                        const servingSize = customIngredient.servingSize || 100;
                        ingredientNutrition = {
                            calories: customIngredient.nutrition.calories / servingSize,
                            protein: customIngredient.nutrition.protein / servingSize,
                            carbs: customIngredient.nutrition.carbs / servingSize,
                            fat: customIngredient.nutrition.fat / servingSize
                        };
                    }
                } else {
                    ingredientNutrition = itemData.nutrition || { calories: 0, protein: 0, carbs: 0, fat: 0 };
                }
                
                if (ingredientNutrition) {
                    nutrition.calories += ingredientNutrition.calories * itemData.amount;
                    nutrition.protein += ingredientNutrition.protein * itemData.amount;
                    nutrition.carbs += ingredientNutrition.carbs * itemData.amount;
                    nutrition.fat += ingredientNutrition.fat * itemData.amount;
                }
            } catch (error) {
                console.error('Error calculating ingredient nutrition:', error);
            }
        }
    }

    return nutrition;
}

async function updateNutritionSummary() {
    try {
        // Check if we're on the meal plan page
        const mealPlanGrid = document.querySelector('.meal-plan-grid');
        if (!mealPlanGrid) {
            console.log('Not on meal plan page, skipping nutrition update');
            return;
        }

        const week = getWeekDates(currentWeekOffset);
        const nutritionSummary = document.querySelector('.nutrition-summary');
        if (!nutritionSummary) {
            console.log('Nutrition summary element not found');
            return;
        }

        // Calculate total nutrition for the week
        let totalCalories = 0;
        let totalProtein = 0;
        let totalCarbs = 0;
        let totalFat = 0;

        // Calculate nutrition for each day
        const dayNutritionData = [];
        for (const date of week.dates) {
            const dayNutrition = await calculateDayNutrition(date);
            dayNutritionData.push({ date, nutrition: dayNutrition });
            
            totalCalories += dayNutrition.calories;
            totalProtein += dayNutrition.protein;
            totalCarbs += dayNutrition.carbs;
            totalFat += dayNutrition.fat;
        }

        // Update the summary display with daily breakdown and weekly totals
        nutritionSummary.innerHTML = `
            <h3>Weekly Nutrition Summary</h3>
            <div class="daily-nutrition-grid">
                ${dayNutritionData.map(({ date, nutrition }) => `
                    <div class="daily-nutrition-item">
                        <h4>${formatDate(date)}</h4>
                        <div class="nutrition-values">
                            <span>${Math.round(nutrition.calories)} cal</span>
                            <span>${Math.round(nutrition.protein)}g P</span>
                            <span>${Math.round(nutrition.carbs)}g C</span>
                            <span>${Math.round(nutrition.fat)}g F</span>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div class="weekly-totals">
                <h4>Weekly Totals</h4>
                <div class="nutrition-grid">
                    <div class="nutrition-item">
                        <span class="label">Total Calories:</span>
                        <span class="value">${Math.round(totalCalories)}</span>
                    </div>
                    <div class="nutrition-item">
                        <span class="label">Protein:</span>
                        <span class="value">${Math.round(totalProtein)}g</span>
                    </div>
                    <div class="nutrition-item">
                        <span class="label">Carbs:</span>
                        <span class="value">${Math.round(totalCarbs)}g</span>
                    </div>
                    <div class="nutrition-item">
                        <span class="label">Fat:</span>
                        <span class="value">${Math.round(totalFat)}g</span>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error updating nutrition summary:', error);
    }
}

// Remove the old event listeners for meal slots since we're handling clicks on the buttons directly
document.querySelectorAll('.meal-slot').forEach(slot => {
    slot.removeEventListener('click', () => {});
});

// Initialize meal planner
export function initializeMealPlanner() {
    console.log('Initializing meal planner...');
    
    // Load recipes first
    const loadRecipes = async () => {
        try {
            // Try to load recipes from localStorage first
            const savedRecipes = localStorage.getItem('recipes');
            if (savedRecipes) {
                window.recipes = JSON.parse(savedRecipes);
                console.log('Recipes loaded from localStorage:', window.recipes);
                await continueInitialization();
                return;
            }

            // If no saved recipes, try to load from module
            try {
                const recipesModule = await import('../js/recipes.js');
                window.recipes = recipesModule.recipes;
                console.log('Recipes loaded from module:', window.recipes);
                
                // Save to localStorage for future use
                localStorage.setItem('recipes', JSON.stringify(window.recipes));
                
                // Continue initialization after recipes are loaded
                await continueInitialization();
            } catch (moduleError) {
                console.error('Error loading recipes module:', moduleError);
                // Initialize with empty recipes array
                window.recipes = [];
                localStorage.setItem('recipes', JSON.stringify(window.recipes));
                await continueInitialization();
            }
        } catch (error) {
            console.error('Error in loadRecipes:', error);
            // Initialize with empty recipes array
            window.recipes = [];
            localStorage.setItem('recipes', JSON.stringify(window.recipes));
            await continueInitialization();
        }
    };

    // Start loading recipes
    loadRecipes();
}

// Continue initialization after recipes are loaded
async function continueInitialization() {
    try {
        // Reset to current week
        currentWeekOffset = 0;
        console.log('Reset currentWeekOffset to 0');
        
        // Initialize DOM elements
        mealPlanForm = document.getElementById('meal-plan-form');
        mealPlanModal = document.getElementById('meal-plan-modal');
        cancelMeal = document.getElementById('cancel-meal');
        weekDisplay = document.getElementById('week-display');
        prevWeekBtn = document.getElementById('prev-week');
        nextWeekBtn = document.getElementById('next-week');
        
        console.log('DOM elements initialized:', {
            mealPlanForm: !!mealPlanForm,
            mealPlanModal: !!mealPlanModal,
            weekDisplay: !!weekDisplay,
            prevWeekBtn: !!prevWeekBtn,
            nextWeekBtn: !!nextWeekBtn
        });
        
        // Load meal plan
        await loadMealPlan();
        
        // Update week display to show current week
        updateWeekDisplay();
        
        // Initialize week navigation
        initializeWeekNavigation();
        
        // Initialize search handlers
        initializeSearchHandlers();
        
        // Initialize cancel meal button
        if (cancelMeal) {
            cancelMeal.addEventListener('click', closeMealPlanModal);
        }
        
        // Attach the submit handler for the meal plan form
        if (mealPlanForm) {
            mealPlanForm.addEventListener('submit', handleMealPlanSubmit);
        }
        
        console.log('Meal planner initialized successfully');
    } catch (error) {
        console.error('Error continuing initialization:', error);
    }
}

async function handleMealPlanSubmit(e) {
    console.log('Form submission triggered');
    e.preventDefault();
    if (!selectedSlot || !selectedItem) {
        console.error('No slot or item selected');
        return;
    }
    const amount = parseInt(document.getElementById('item-amount').value) || 100;
    const mealKey = getMealKey(selectedSlot.dataset.day, selectedSlot.dataset.meal);
    if (!mealPlan[mealKey]) mealPlan[mealKey] = [];
    mealPlan[mealKey].push({
        type: selectedItem.type,
        id: selectedItem.id,
        amount: amount,
        name: selectedItem.name,
        nutrition: selectedItem.nutrition
    });
    saveMealPlan();
    await updateMealPlanDisplay();
    closeMealPlanModal();
}

async function addAddMealButton(slot) {
    if (!slot) return;
    // Clear existing content
    slot.innerHTML = '';
    
    // Add meal items if any
    const mealKey = getMealKey(slot.dataset.day, slot.dataset.meal);
    const items = mealPlan[mealKey];
    if (items && Array.isArray(items) && items.length > 0) {
        items.forEach((itemData, idx) => {
            let item;
            if (itemData.type === 'meal') {
                item = window.recipes.find(r => r.id === itemData.id);
            } else if (itemData.type === 'ingredient') {
                // For ingredients, we need to get the nutrition data
                // This will be handled in the display function
                item = {
                    type: 'ingredient',
                    id: itemData.id,
                    name: itemData.name || 'Ingredient', // We'll need to store name
                    nutrition: itemData.nutrition || { calories: 0, protein: 0, carbs: 0, fat: 0 }
                };
            }
            if (item) {
                const itemContent = createMealItem(item, itemData.amount, idx, slot);
                slot.appendChild(itemContent);
            }
        });
        
        // Add meal-level nutrition summary
        calculateMealNutrition(slot.dataset.day, slot.dataset.meal).then(mealNutrition => {
            if (mealNutrition.calories > 0 || mealNutrition.protein > 0 || mealNutrition.carbs > 0 || mealNutrition.fat > 0) {
                const mealNutritionDiv = document.createElement('div');
                mealNutritionDiv.className = 'meal-nutrition-summary';
                mealNutritionDiv.innerHTML = `
                    <div class="meal-totals">
                        <span class="total-calories">${Math.round(mealNutrition.calories)} cal</span>
                        <span class="total-protein">${Math.round(mealNutrition.protein)}g P</span>
                        <span class="total-carbs">${Math.round(mealNutrition.carbs)}g C</span>
                        <span class="total-fat">${Math.round(mealNutrition.fat)}g F</span>
                    </div>
                `;
                slot.appendChild(mealNutritionDiv);
            }
        });
        
        slot.classList.add('has-meal');
    } else {
        slot.classList.remove('has-meal');
    }
    
    // Add the Add Item button (always visible)
    const addBtn = document.createElement('button');
    addBtn.className = 'add-meal-btn';
    addBtn.innerHTML = '<i class="fas fa-plus"></i> Add Item';
    addBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openMealPlanModal(slot);
    });
    slot.appendChild(addBtn);
    
    // Make the whole slot clickable (except for buttons)
    slot.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        openMealPlanModal(slot);
    });
}

async function updateMealPlanDisplay() {
    const mealPlanGrid = document.querySelector('.meal-plan-grid');
    if (!mealPlanGrid) return;
    
    // Clear existing content
    mealPlanGrid.innerHTML = '';
    
    // Add header row
    const headerRow = document.createElement('div');
    headerRow.className = 'meal-plan-header';
    
    // Add empty cell for time column
    const emptyCell = document.createElement('div');
    emptyCell.className = 'day-header';
    headerRow.appendChild(emptyCell);
    
    // Add day headers
    const week = getWeekDates(currentWeekOffset);
    week.dayNames.forEach((day, index) => {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'day-header';
        dayHeader.textContent = `${day}\n${formatDate(week.dates[index])}`;
        headerRow.appendChild(dayHeader);
    });
    
    mealPlanGrid.appendChild(headerRow);
    
    // Add meal slots
    const mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
    for (const mealType of mealTypes) {
        const row = document.createElement('div');
        row.className = 'meal-row';
        
        // Add time slot
        const timeSlot = document.createElement('div');
        timeSlot.className = 'time-slot';
        timeSlot.textContent = mealType;
        row.appendChild(timeSlot);
        
        // Add meal slots for each day
        for (const date of week.dates) {
            const mealSlot = document.createElement('div');
            mealSlot.className = 'meal-slot';
            mealSlot.dataset.day = date;
            mealSlot.dataset.meal = mealType.toLowerCase();
            
            await addAddMealButton(mealSlot);
            row.appendChild(mealSlot);
        }
        
        mealPlanGrid.appendChild(row);
    }
    
    // Update nutrition summary after display is complete
    await updateNutritionSummary();
}

// Add window resize handler to reload meal plan when switching between mobile and desktop
let lastIsMobile = window.innerWidth <= 768;
window.addEventListener('resize', () => {
    const isMobile = window.innerWidth <= 768;
    if (isMobile !== lastIsMobile) {
        lastIsMobile = isMobile;
        loadMealPlan();
    }
});

// Initialize week navigation buttons
function initializeWeekNavigation() {
    const prevWeekBtn = document.getElementById('prev-week');
    const nextWeekBtn = document.getElementById('next-week');
    
    if (prevWeekBtn) {
        prevWeekBtn.addEventListener('click', async () => {
            currentWeekOffset--;
            updateWeekDisplay();
            await updateMealPlanDisplay();
        });
    }
    
    if (nextWeekBtn) {
        nextWeekBtn.addEventListener('click', async () => {
            currentWeekOffset++;
            updateWeekDisplay();
            await updateMealPlanDisplay();
        });
    }
}

// Initialize search handlers when the page loads
document.addEventListener('DOMContentLoaded', () => {
    initializeSearchHandlers();
    initializeWeekNavigation();
});

// Add debounced search
let searchTimeout;
function initializeSearchHandlers() {
    const searchInput = document.getElementById('unified-search');
    const categoryFilter = document.getElementById('item-category-filter');
    
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                updateUnifiedList();
            }, 300); // Debounce for 300ms
        });
    }
    
    if (categoryFilter) {
        categoryFilter.addEventListener('change', updateUnifiedList);
    }
} 