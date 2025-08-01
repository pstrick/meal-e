// Meal Planning functionality
let currentWeekOffset = 0;  // Track week offset instead of modifying date directly
let baseStartOfWeekTimestamp = null; // Anchor for week navigation as timestamp
let selectedSlot = null;
let selectedItem = null;
let mealPlanForm = null;
let mealPlanModal = null;
let cancelMeal = null;
let weekDisplay = null;
let prevWeekBtn = null;
let nextWeekBtn = null;
let weekNavInitialized = false;

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

function getBaseStartOfWeekTimestamp() {
    const today = new Date();
    console.log('DEBUG: Today:', today.toISOString());
    console.log('DEBUG: window.settings:', window.settings);
    const startDay = parseInt(window.settings?.mealPlanStartDay) || 0;
    console.log('DEBUG: startDay:', startDay);
    const currentDay = today.getDay();
    console.log('DEBUG: currentDay:', currentDay);
    const daysToStart = (currentDay - startDay + 7) % 7;
    console.log('DEBUG: daysToStart:', daysToStart);
    const base = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysToStart);
    base.setHours(0,0,0,0);
    console.log('DEBUG: base date:', base.toISOString());
    return base.getTime();
}

function getWeekDates(weekOffset = 0) {
    if (!baseStartOfWeekTimestamp) {
        baseStartOfWeekTimestamp = getBaseStartOfWeekTimestamp();
    }
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    const startOfWeek = new Date(baseStartOfWeekTimestamp + (weekOffset * 7 * MS_PER_DAY));
    console.log('DEBUG: baseStartOfWeekTimestamp:', new Date(baseStartOfWeekTimestamp).toISOString());
    console.log('DEBUG: currentWeekOffset:', weekOffset);
    console.log('DEBUG: startOfWeek:', startOfWeek.toISOString());
    const dates = [];
    const dayNames = [];
    for (let i = 0; i < 7; i++) {
        const date = new Date(startOfWeek.getTime() + (i * MS_PER_DAY));
        dates.push(date.toISOString().split('T')[0]);
        dayNames.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
    }
    console.log('DEBUG: week dates:', dates);
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
                label: 'Recipe'
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
                    label: 'Custom Ingredient'
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
    console.log('Creating meal item:', item, 'amount:', amount);
    
    const div = document.createElement('div');
    div.className = 'meal-item';
    div.dataset.itemType = item.type;
    div.dataset.itemId = item.id;
    div.dataset.itemAmount = amount;
    
    const icon = item.type === 'meal' ? '🍽️' : '🥩';
    const label = item.type === 'meal' ? 'Recipe' : 'Custom Ingredient';
    
    // Truncate item name to 50 characters
    const truncatedName = item.name.length > 50 ? item.name.substring(0, 50) + '...' : item.name;
    
    // Calculate nutrition for this item
    let itemNutrition = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    if (item.type === 'meal') {
        console.log('Processing meal nutrition for:', item.name);
        console.log('Recipe nutrition:', item.nutrition);
        console.log('Serving size:', item.servingSize);
        
        if (item.nutrition) {
            const servingSize = item.servingSize || 100;
            const nutritionPerGram = {
                calories: item.nutrition.calories / servingSize,
                protein: item.nutrition.protein / servingSize,
                carbs: item.nutrition.carbs / servingSize,
                fat: item.nutrition.fat / servingSize
            };
            itemNutrition = {
                calories: nutritionPerGram.calories * amount,
                protein: nutritionPerGram.protein * amount,
                carbs: nutritionPerGram.carbs * amount,
                fat: nutritionPerGram.fat * amount
            };
            console.log('Calculated meal nutrition:', itemNutrition);
        } else {
            console.log('No nutrition data found for meal:', item.name);
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
    
    console.log('Final item nutrition:', itemNutrition);
    
    div.innerHTML = `
        <div class="meal-item-header">
            <span class="meal-item-icon">${icon}</span>
            <span class="meal-item-name" title="${item.name}">${truncatedName}</span>
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
        for (const date of week.dates) {
            const dayNutrition = await calculateDayNutrition(date);
            totalCalories += dayNutrition.calories;
            totalProtein += dayNutrition.protein;
            totalCarbs += dayNutrition.carbs;
            totalFat += dayNutrition.fat;
        }

        // Update the summary display with weekly totals only
        nutritionSummary.innerHTML = `
            <h3>Weekly Nutrition Summary</h3>
            <div class="weekly-totals">
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
        currentWeekOffset = 0;
        baseStartOfWeekTimestamp = getBaseStartOfWeekTimestamp();
        console.log('Reset currentWeekOffset to 0 and set baseStartOfWeekTimestamp');
        
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
        
        // Update week display to show current week (this will also load meal plan)
        updateWeekDisplay();
        
        // Initialize week navigation
        initializeWeekNavigation();
        
        // Initialize search handlers
        initializeSearchHandlers();
        
        // Initialize print and shopping list buttons
        initializePrintButton();
        initializeShoppingListButton();
        
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
    
    // Create content container
    const contentContainer = document.createElement('div');
    contentContainer.className = 'meal-slot-content';
    slot.appendChild(contentContainer);
    
    // Add meal items if any
    const mealKey = getMealKey(slot.dataset.day, slot.dataset.meal);
    const items = mealPlan[mealKey];
    if (items && Array.isArray(items) && items.length > 0) {
        items.forEach((itemData, idx) => {
            let item;
            if (itemData.type === 'meal') {
                const recipe = window.recipes.find(r => r.id === itemData.id);
                if (recipe) {
                    item = {
                        type: 'meal',
                        id: recipe.id,
                        name: recipe.name,
                        nutrition: recipe.nutrition,
                        servingSize: recipe.servingSize
                    };
                } else {
                    console.error('Recipe not found for ID:', itemData.id);
                    item = {
                        type: 'meal',
                        id: itemData.id,
                        name: itemData.name || 'Unknown Meal',
                        nutrition: { calories: 0, protein: 0, carbs: 0, fat: 0 },
                        servingSize: 100
                    };
                }
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
                contentContainer.appendChild(itemContent);
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
    contentContainer.appendChild(addBtn);
    
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
    
    // Calculate daily nutrition data and add at the bottom
    const dayNutritionData = [];
    for (const date of week.dates) {
        const dayNutrition = await calculateDayNutrition(date);
        dayNutritionData.push({ date, nutrition: dayNutrition });
    }
    
    // Add daily nutrition row at the bottom
    const dailyNutritionRow = document.createElement('div');
    dailyNutritionRow.className = 'daily-nutrition-row';
    
    // Add empty cell for time column
    const dailyEmptyCell = document.createElement('div');
    dailyEmptyCell.className = 'daily-nutrition-cell';
    dailyNutritionRow.appendChild(dailyEmptyCell);
    
    // Add daily nutrition for each day
    dayNutritionData.forEach(({ date, nutrition }) => {
        const dayNutritionCell = document.createElement('div');
        dayNutritionCell.className = 'daily-nutrition-cell';
        dayNutritionCell.innerHTML = `
            <div class="daily-totals">
                <div class="daily-calories">${Math.round(nutrition.calories)} cal</div>
                <div class="daily-macros">
                    <span class="daily-protein">${Math.round(nutrition.protein)}g P</span>
                    <span class="daily-carbs">${Math.round(nutrition.carbs)}g C</span>
                    <span class="daily-fat">${Math.round(nutrition.fat)}g F</span>
                </div>
            </div>
        `;
        dailyNutritionRow.appendChild(dayNutritionCell);
    });
    
    mealPlanGrid.appendChild(dailyNutritionRow);
    
    // Update weekly nutrition summary
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
    if (weekNavInitialized) return;
    weekNavInitialized = true;
    const prevWeekBtn = document.getElementById('prev-week');
    const nextWeekBtn = document.getElementById('next-week');
    
    if (prevWeekBtn) {
        prevWeekBtn.addEventListener('click', async () => {
            currentWeekOffset--;
            console.log('DEBUG: prevWeekBtn clicked, new currentWeekOffset:', currentWeekOffset);
            updateWeekDisplay();
        });
    }
    
    if (nextWeekBtn) {
        nextWeekBtn.addEventListener('click', async () => {
            currentWeekOffset++;
            console.log('DEBUG: nextWeekBtn clicked, new currentWeekOffset:', currentWeekOffset);
            updateWeekDisplay();
        });
    }
}

// Note: Initialization is now handled in continueInitialization() function

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

// Initialize print button functionality
function initializePrintButton() {
    const printButton = document.getElementById('print-meal-plan');
    
    if (printButton) {
        printButton.addEventListener('click', () => {
            printMealPlan();
        });
    }
}

// Initialize shopping list generation button
function initializeShoppingListButton() {
    const generateButton = document.getElementById('generate-shopping-list');
    
    if (generateButton) {
        generateButton.addEventListener('click', () => {
            generateShoppingListFromMealPlan();
        });
    }
}

// Generate shopping list from meal plan
function generateShoppingListFromMealPlan() {
    try {
        // Load meal plan data from localStorage
        const mealPlanData = localStorage.getItem('mealPlan');
        if (!mealPlanData) {
            alert('No meal plan found. Please add some meals to your plan first.');
            return;
        }
        
        const mealPlan = JSON.parse(mealPlanData);
        console.log('Loaded meal plan data:', mealPlan);
        
        // Get the current week dates
        console.log('DEBUG: currentWeekOffset before getWeekDates:', currentWeekOffset);
        const week = getWeekDates(currentWeekOffset);
        const startDate = formatDate(week.startDate);
        const endDate = formatDate(week.endDate);
        
        console.log('DEBUG: Week object:', week);
        console.log('DEBUG: Week start date (raw):', week.startDate);
        console.log('DEBUG: Week end date (raw):', week.endDate);
        console.log('DEBUG: Week start date (formatted):', startDate);
        console.log('DEBUG: Week end date (formatted):', endDate);
        console.log('Generating shopping list for week:', startDate, 'to', endDate);
        
        const ingredients = new Map(); // Map to aggregate ingredients
        const currentWeekMeals = []; // Track meals from current week
        
        // Process only meals from the current week
        console.log('DEBUG: Processing', Object.keys(mealPlan).length, 'total meals from meal plan');
        Object.keys(mealPlan).forEach(mealKey => {
            // Extract date and meal type from meal key (format: "YYYY-MM-DD-mealtype")
            const parts = mealKey.split('-');
            if (parts.length >= 3) {
                const mealDate = `${parts[0]}-${parts[1]}-${parts[2]}`;
                
                console.log(`DEBUG: Checking meal: ${mealKey} with date: ${mealDate}`);
                console.log(`DEBUG: Week range: ${week.startDate} to ${week.endDate}`);
                console.log(`DEBUG: Date comparison: ${mealDate} >= ${week.startDate} && ${mealDate} <= ${week.endDate}`);
                
                // Check if this meal is from the current week using string comparison
                // This is more reliable than Date object comparison
                if (mealDate >= week.startDate && mealDate <= week.endDate) {
                    console.log(`✅ Processing meal from current week: ${mealKey} (date: ${mealDate})`);
                    currentWeekMeals.push(mealKey);
                    const mealItems = mealPlan[mealKey];
                    
                    if (mealItems && Array.isArray(mealItems)) {
                        mealItems.forEach(item => {
                            // Validate item has required properties
                            if (!item || !item.name || typeof item.amount === 'undefined') {
                                console.warn('Skipping invalid item:', item);
                                return;
                            }
                            
                            const key = item.name.toLowerCase();
                            if (ingredients.has(key)) {
                                const existing = ingredients.get(key);
                                existing.amount += item.amount;
                            } else {
                                ingredients.set(key, {
                                    name: item.name,
                                    amount: item.amount,
                                    unit: 'g', // Default to grams
                                    notes: `From meal plan: ${item.name}`
                                });
                            }
                        });
                    }
                } else {
                    console.log(`❌ Skipping meal from different week: ${mealKey} (date: ${mealDate}, week: ${week.startDate} to ${week.endDate})`);
                }
            }
        });
        
        console.log('DEBUG: Meals found for current week:', currentWeekMeals);
        console.log('Aggregated ingredients:', ingredients);
        console.log('DEBUG: Found', ingredients.size, 'unique ingredients for current week');
        
        if (ingredients.size === 0) {
            alert(`No ingredients found in your meal plan for the week of ${startDate} to ${endDate}. Please add meals to this week first.`);
            return;
        }
        
        // Load existing shopping lists
        let shoppingLists = [];
        try {
            const shoppingListsData = localStorage.getItem('shoppingLists');
            if (shoppingListsData) {
                shoppingLists = JSON.parse(shoppingListsData);
            }
        } catch (error) {
            console.error('Error loading shopping lists:', error);
        }
        
        // Create new shopping list
        // Use the week data already calculated above
        const listName = `Meal Plan Shopping List - Week of ${startDate}`;
        
        const newList = {
            id: Date.now(),
            name: listName,
            description: `Generated from meal plan for week of ${startDate} to ${endDate}`,
            items: Array.from(ingredients.values()).map(ing => ({
                id: Date.now() + Math.random(),
                name: ing.name,
                amount: Math.round(ing.amount * 10) / 10, // Round to 1 decimal
                unit: ing.unit,
                notes: ing.notes,
                addedAt: new Date().toISOString()
            })),
            createdAt: new Date().toISOString()
        };
        
        shoppingLists.push(newList);
        
        // Save to localStorage
        try {
            localStorage.setItem('shoppingLists', JSON.stringify(shoppingLists));
        } catch (error) {
            console.error('Error saving shopping list:', error);
            alert('Error saving shopping list. Please try again.');
            return;
        }
        
        // Redirect to shopping lists page
        window.location.href = 'shopping-lists.html';
        
    } catch (error) {
        console.error('Error generating shopping list from meal plan:', error);
        alert('Error generating shopping list. Please try again.');
    }
}

// Print meal plan function
function printMealPlan() {
    console.log('Printing meal plan...');
    
    // Create a print-friendly version of the page
    const printWindow = window.open('', '_blank');
    const week = getWeekDates(currentWeekOffset);
    const startDate = formatDate(week.startDate);
    const endDate = formatDate(week.endDate);
    
    // Get the meal plan grid content
    const mealPlanGrid = document.querySelector('.meal-plan-grid');
    if (!mealPlanGrid) {
        console.error('Meal plan grid not found');
        return;
    }
    
    // Create print HTML
    const printHTML = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Meal Plan - Week of ${startDate} - ${endDate}</title>
            <style>
                @media print {
                    @page {
                        margin: 0.5in;
                        size: letter;
                    }
                }
                
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    margin: 0;
                    padding: 20px;
                    background: white;
                    font-size: 12pt;
                    line-height: 1.4;
                }
                
                .print-header {
                    text-align: center;
                    margin-bottom: 20px;
                    page-break-after: avoid;
                }
                
                .print-header h1 {
                    font-size: 18pt;
                    margin: 0 0 10px 0;
                    color: #000;
                }
                
                .print-header h2 {
                    font-size: 14pt;
                    margin: 0;
                    color: #000;
                }
                
                .meal-plan-grid {
                    display: table;
                    width: 100%;
                    background: white;
                    border-collapse: collapse;
                    table-layout: fixed;
                    page-break-inside: avoid;
                }
                
                .meal-plan-header {
                    display: table-row;
                    page-break-inside: avoid;
                }
                
                .day-header {
                    background: #f5f6fa;
                    font-weight: bold;
                    text-align: center;
                    padding: 8px 4px;
                    border: 1px solid #000;
                    font-size: 10pt;
                    white-space: pre-line;
                    display: table-cell;
                    vertical-align: middle;
                    width: 120px;
                    page-break-inside: avoid;
                }
                
                .meal-row {
                    display: table-row;
                    page-break-inside: avoid;
                }
                
                .time-slot {
                    background: #f5f6fa;
                    font-weight: 600;
                    text-align: right;
                    padding: 8px 4px;
                    border: 1px solid #000;
                    font-size: 10pt;
                    display: table-cell;
                    vertical-align: middle;
                    width: 120px;
                    page-break-inside: avoid;
                }
                
                .meal-slot {
                    background: white;
                    border: 1px solid #000;
                    display: table-cell;
                    vertical-align: top;
                    padding: 4px;
                    box-sizing: border-box;
                    width: calc((100% - 120px) / 7);
                    max-width: calc((100% - 120px) / 7);
                    overflow: visible;
                    page-break-inside: avoid;
                    min-height: 60px;
                }
                
                .meal-item {
                    background: #f8fff8;
                    border: 1px solid #ccc;
                    border-radius: 3px;
                    margin-bottom: 4px;
                    padding: 4px;
                    display: block;
                    font-size: 9pt;
                    position: relative;
                    max-width: 100%;
                    overflow: visible;
                    page-break-inside: avoid;
                }
                
                .meal-item-header {
                    display: flex;
                    align-items: flex-start;
                    width: 100%;
                    justify-content: space-between;
                    flex-direction: column;
                }
                
                .meal-item-name {
                    font-weight: 600;
                    font-size: 9pt;
                    color: #000;
                    max-width: 100%;
                    overflow: visible;
                    text-overflow: clip;
                    white-space: normal;
                    word-wrap: break-word;
                    word-break: break-word;
                    display: block;
                    line-height: 1.2;
                    margin-bottom: 2px;
                }
                
                .meal-item-details {
                    font-size: 8pt;
                    color: #666;
                    margin-top: 2px;
                }
                
                .meal-item-nutrition {
                    font-size: 8pt;
                    margin-top: 2px;
                }
                
                .meal-item-nutrition span {
                    display: inline-block;
                    margin-right: 8px;
                    font-size: 8pt;
                }
                
                .daily-nutrition-row {
                    display: table-row;
                    page-break-inside: avoid;
                }
                
                .daily-nutrition-cell {
                    background: #f0f0f0;
                    border: 1px solid #000;
                    padding: 4px;
                    text-align: center;
                    font-size: 9pt;
                    display: table-cell;
                    vertical-align: middle;
                    page-break-inside: avoid;
                }
                
                .daily-nutrition-cell:first-child {
                    width: 120px;
                    font-weight: bold;
                    background: #e0e0e0;
                }
                
                .daily-totals {
                    display: block;
                }
                
                .daily-calories {
                    font-weight: bold;
                    font-size: 9pt;
                    display: block;
                    margin-bottom: 2px;
                }
                
                .daily-macros {
                    font-size: 8pt;
                    display: block;
                }
                
                .daily-macros span {
                    display: inline-block;
                    margin-right: 6px;
                }
                
                .empty-slot {
                    background: #f9f9f9;
                    min-height: 40px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 8pt;
                    color: #999;
                    font-style: italic;
                }
                
                @media print {
                    body {
                        margin: 0;
                        padding: 0;
                    }
                    
                    .print-header {
                        margin-bottom: 15px;
                    }
                }
            </style>
        </head>
        <body>
            <div class="print-header">
                <h1>Meal Plan</h1>
                <h2>Week of ${startDate} - ${endDate}</h2>
            </div>
            ${mealPlanGrid.outerHTML}
        </body>
        </html>
    `;
    
    // Write the HTML to the new window
    printWindow.document.write(printHTML);
    printWindow.document.close();
    
    // Wait for content to load, then print
    printWindow.onload = function() {
        // Remove any add buttons and replace empty slots with placeholder text
        const addButtons = printWindow.document.querySelectorAll('.add-meal-btn');
        addButtons.forEach(btn => {
            btn.remove();
        });
        
        // Replace empty meal slots with placeholder text
        const mealSlots = printWindow.document.querySelectorAll('.meal-slot');
        mealSlots.forEach(slot => {
            if (slot.children.length === 0 || (slot.children.length === 1 && slot.querySelector('.add-meal-btn'))) {
                slot.innerHTML = '<div class="empty-slot">Empty</div>';
            }
        });
        
        // Trigger print
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 500);
    };
} 