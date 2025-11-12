import { showAlert } from './alert.js';

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

// Recurring items data
let recurringItems = [];

// Week offset persistence functions
function saveWeekOffset(offset) {
    try {
        localStorage.setItem('meale-current-week-offset', offset.toString());
        console.log('Saved week offset:', offset);
    } catch (error) {
        console.error('Error saving week offset:', error);
    }
}

function loadWeekOffset() {
    try {
        const savedOffset = localStorage.getItem('meale-current-week-offset');
        if (savedOffset !== null) {
            const offset = parseInt(savedOffset, 10);
            console.log('Loaded week offset:', offset);
            return offset;
        }
    } catch (error) {
        console.error('Error loading week offset:', error);
    }
    return 0; // Default to current week if no saved offset
}

// Function to reset week offset to current week (useful for debugging or user preference)
function resetWeekOffset() {
    currentWeekOffset = 0;
    saveWeekOffset(currentWeekOffset);
    updateWeekDisplay();
    console.log('Week offset reset to current week');
}

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
            category: ingredient.category || 'ingredient',
            nutrition: {
                calories: ingredient.nutrition.calories / servingSize,
                protein: ingredient.nutrition.protein / servingSize,
                carbs: ingredient.nutrition.carbs / servingSize,
                fat: ingredient.nutrition.fat / servingSize
            },
            servingSize: ingredient.servingSize,
            brandOwner: 'Custom Ingredient',
            storeSection: ingredient.storeSection || '',
            pricePerGram: typeof ingredient.pricePerGram === 'number' ? ingredient.pricePerGram : null,
            totalPrice: typeof ingredient.totalPrice === 'number' ? ingredient.totalPrice : null,
            totalWeight: typeof ingredient.totalWeight === 'number' ? ingredient.totalWeight : null
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
    
    // Hide recurring options initially - they will show when item is selected
    const recurringOptions = selectedItemDiv.querySelector('.recurring-options');
    if (recurringOptions) {
        recurringOptions.style.display = 'none';
    }
    
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
            // Add ingredient with default category if none exists
            const ingredientCategory = ingredient.category || 'ingredient';
            
            // Only add if category matches or is 'all'
            if (category === 'all' || ingredientCategory === category) {
                results.push({
                    type: 'ingredient',
                    id: `custom-${ingredient.id}`,
                    name: ingredient.name,
                    category: ingredientCategory,
                    servingSize: ingredient.servingSize || 100, // Default to 100g if not specified
                    nutrition: ingredient.nutrition,
                    source: ingredient.source,
                    storeSection: ingredient.storeSection || '',
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
            <p>Serving Size: ${item.servingSize || 100}g</p>
            ${typeof item.pricePerGram === 'number' && !Number.isNaN(item.pricePerGram) ? `<p class="item-price">Price: $${(item.pricePerGram * 100).toFixed(2)}/100g</p>` : ''}
            <div class="item-nutrition">
                <span>Cal: ${Math.round(item.nutrition.calories * (item.servingSize || 100))}</span>
                <span>P: ${Math.round(item.nutrition.protein * (item.servingSize || 100))}g</span>
                <span>C: ${Math.round(item.nutrition.carbs * (item.servingSize || 100))}g</span>
                <span>F: ${Math.round(item.nutrition.fat * (item.servingSize || 100))}g</span>
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
    
    // Set default serving size in amount input
    const amountInput = selectedItemDiv.querySelector('#item-amount');
    if (amountInput && item.servingSize) {
        amountInput.value = item.servingSize;
    }
    
    // Handle nutrition display - ensure we have nutrition data
    const nutrition = item.nutrition || { calories: 0, protein: 0, carbs: 0, fat: 0 };
    const servingSize = item.servingSize || 100;
    selectedItemDiv.querySelector('.calories').textContent = Math.round(nutrition.calories * servingSize);
    selectedItemDiv.querySelector('.protein').textContent = Math.round(nutrition.protein * servingSize);
    selectedItemDiv.querySelector('.carbs').textContent = Math.round(nutrition.carbs * servingSize);
    selectedItemDiv.querySelector('.fat').textContent = Math.round(nutrition.fat * servingSize);
    
    // Show recurring options now that item is selected
    const recurringOptions = selectedItemDiv.querySelector('.recurring-options');
    if (recurringOptions) {
        recurringOptions.style.display = 'block';
    }
    
    // Reset recurring form
    const makeRecurringCheckbox = selectedItemDiv.querySelector('#make-recurring');
    if (makeRecurringCheckbox) {
        makeRecurringCheckbox.checked = false;
    }
    
    const recurringDetails = selectedItemDiv.querySelector('.recurring-details');
    if (recurringDetails) {
        recurringDetails.style.display = 'none';
    }
    
    // Clear all day checkboxes
    const dayCheckboxes = selectedItemDiv.querySelectorAll('input[name="recurring-days"]');
    dayCheckboxes.forEach(checkbox => checkbox.checked = false);
    
    // Clear end date
    const endDateInput = selectedItemDiv.querySelector('#recurring-end-date');
    if (endDateInput) {
        endDateInput.value = '';
    }
    
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

// Make week offset functions available globally for debugging
window.resetWeekOffset = resetWeekOffset;
window.saveWeekOffset = saveWeekOffset;
window.loadWeekOffset = loadWeekOffset;

// Recurring Items Functions
function loadRecurringItems() {
    try {
        const saved = localStorage.getItem('meale-recurring-items');
        if (saved) {
            recurringItems = JSON.parse(saved).map(item => ({
                ...item,
                storeSection: item.storeSection || ''
            }));
            console.log('Loaded recurring items:', recurringItems.length);
        }
    } catch (error) {
        console.error('Error loading recurring items:', error);
        recurringItems = [];
    }
}

function saveRecurringItems() {
    try {
        localStorage.setItem('meale-recurring-items', JSON.stringify(recurringItems));
        console.log('Saved recurring items:', recurringItems.length);
    } catch (error) {
        console.error('Error saving recurring items:', error);
    }
}


function deleteRecurringItem(id) {
    if (confirm('Are you sure you want to delete this recurring item?')) {
        recurringItems = recurringItems.filter(item => item.id !== id);
        saveRecurringItems();
        applyRecurringItems();
        updateMealPlanDisplay();
        console.log('Recurring item deleted:', id);
    }
}

function applyRecurringItems() {
    // Clear existing recurring items from meal plan
    for (const key in mealPlan) {
        if (mealPlan[key]) {
            mealPlan[key] = mealPlan[key].filter(item => !item.isRecurring);
        }
    }
    
    // Load deleted instances
    const deletedInstances = JSON.parse(localStorage.getItem('meale-deleted-recurring-instances') || '[]');
    
    // Apply recurring items to current week
    const week = getWeekDates(currentWeekOffset);
    
    recurringItems.forEach(recurringItem => {
        recurringItem.days.forEach(dayIndex => {
            const date = week.dates[dayIndex];
            
            // Check if this specific instance was manually deleted
            const deletedKey = `${recurringItem.id}-${date}-${recurringItem.mealType}`;
            if (deletedInstances.includes(deletedKey)) {
                return; // Skip this specific instance as it was manually deleted
            }
            
            // Check if recurring item has ended for this specific date
            if (recurringItem.endDate) {
                const endDate = new Date(recurringItem.endDate);
                const mealDate = new Date(date);
                // Set time to end of day for end date comparison
                endDate.setHours(23, 59, 59, 999);
                if (mealDate > endDate) {
                    return; // Skip this specific date as it's after the end date
                }
            }
            
            const mealKey = getMealKey(date, recurringItem.mealType);
            
            if (!mealPlan[mealKey]) mealPlan[mealKey] = [];
            
            mealPlan[mealKey].push({
                type: recurringItem.type,
                id: recurringItem.itemId,
                amount: recurringItem.amount,
                name: recurringItem.name,
                nutrition: recurringItem.nutrition,
                servingSize: recurringItem.servingSize,
                storeSection: recurringItem.storeSection || '',
                pricePerGram: typeof recurringItem.pricePerGram === 'number' ? recurringItem.pricePerGram : null,
                isRecurring: true,
                recurringId: recurringItem.id
            });
        });
    });
    
    saveMealPlan();
    // Don't call updateMealPlanDisplay() here to avoid duplication
    // The display will be updated by the calling function
}

// Initialize recurring items functionality
function initializeRecurringItems() {
    // Load recurring items
    loadRecurringItems();
    
    // Apply recurring items to current week
    applyRecurringItems();
    updateMealPlanDisplay();
}

// Initialize recurring modal options
function initializeRecurringModalOptions() {
    const makeRecurringCheckbox = document.getElementById('make-recurring');
    const recurringDetails = document.querySelector('.recurring-details');
    const recurringOptions = document.querySelector('.recurring-options');
    
    if (makeRecurringCheckbox && recurringDetails) {
        makeRecurringCheckbox.addEventListener('change', function() {
            if (this.checked) {
                recurringDetails.style.display = 'block';
            } else {
                recurringDetails.style.display = 'none';
            }
        });
    }
}


// Make recurring functions globally available
window.deleteRecurringItem = deleteRecurringItem;

function createMealItem(item, amount, itemIndex, slot) {
    console.log('Creating meal item:', item, 'amount:', amount);
    
    const div = document.createElement('div');
    div.className = 'meal-item';
    div.dataset.itemType = item.type;
    div.dataset.itemId = item.id;
    div.dataset.itemAmount = amount;
    
    const label = item.type === 'meal' ? 'Recipe' : 'Custom Ingredient';
    
    // Truncate item name to 300 characters for better readability
    const truncatedName = item.name.length > 300 ? item.name.substring(0, 300) + '...' : item.name;
    
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
            <span class="meal-item-name" title="${item.name}">${truncatedName}</span>
            <button class="remove-meal" title="Remove Item">&times;</button>
        </div>
        <div class="meal-item-details">
            <span class="meal-item-amount">${amount}g</span>
            <span class="meal-item-type">${label}</span>
        </div>
    `;
    
    // Remove item handler
    div.querySelector('.remove-meal').addEventListener('click', (e) => {
        e.stopPropagation();
        // Remove this item from the slot
        const mealKey = getMealKey(slot.dataset.day, slot.dataset.meal);
        if (mealPlan[mealKey] && Array.isArray(mealPlan[mealKey])) {
            const item = mealPlan[mealKey][itemIndex];
            
            // If it's a recurring item, mark this specific instance as deleted
            if (item.isRecurring && item.recurringId) {
                // Store the deleted instance info to prevent re-adding
                const deletedKey = `${item.recurringId}-${slot.dataset.day}-${slot.dataset.meal}`;
                let deletedInstances = JSON.parse(localStorage.getItem('meale-deleted-recurring-instances') || '[]');
                if (!deletedInstances.includes(deletedKey)) {
                    deletedInstances.push(deletedKey);
                    localStorage.setItem('meale-deleted-recurring-instances', JSON.stringify(deletedInstances));
                }
            }
            
            mealPlan[mealKey].splice(itemIndex, 1);
            if (mealPlan[mealKey].length === 0) delete mealPlan[mealKey];
            saveMealPlan();
            updateMealPlanDisplay();
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

async function calculateDayNutrition(date, customIngredientsMap = new Map()) {
    console.log('Calculating nutrition for date:', date);
    const totals = {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        cost: 0
    };

    const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];
    
    for (const mealType of mealTypes) {
        const key = getMealKey(date, mealType);
        const items = mealPlan[key] || [];
        console.log(`Items for ${mealType}:`, items);
        
        for (const itemData of items) {
            const amount = parseFloat(itemData.amount) || 0;
            if (amount <= 0) continue;

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
                    
                    totals.calories += nutritionPerGram.calories * amount;
                    totals.protein += nutritionPerGram.protein * amount;
                    totals.carbs += nutritionPerGram.carbs * amount;
                    totals.fat += nutritionPerGram.fat * amount;

                    const recipeCost = calculateRecipeItemCost(recipe, amount, customIngredientsMap);
                    totals.cost += recipeCost;
                }
            } else if (itemData.type === 'ingredient') {
                // For ingredients, we need to get nutrition data
                try {
                    let ingredientNutrition;
                    if (typeof itemData.id === 'string' && itemData.id.startsWith('custom-')) {
                        const customId = itemData.id.replace('custom-', '');
                        const customIngredient = customIngredientsMap.get(customId);
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
                        totals.calories += ingredientNutrition.calories * amount;
                        totals.protein += ingredientNutrition.protein * amount;
                        totals.carbs += ingredientNutrition.carbs * amount;
                        totals.fat += ingredientNutrition.fat * amount;
                    }

                    let pricePerGram = null;
                    if (typeof itemData.pricePerGram === 'number' && !Number.isNaN(itemData.pricePerGram)) {
                        pricePerGram = itemData.pricePerGram;
                    } else if (typeof itemData.id === 'string') {
                        pricePerGram = resolveCustomIngredientPricePerGram(itemData.id, customIngredientsMap);
                    }

                    if (typeof pricePerGram === 'number' && !Number.isNaN(pricePerGram)) {
                        totals.cost += pricePerGram * amount;
                    }
                } catch (error) {
                    console.error('Error calculating ingredient nutrition:', error);
                }
            }
        }
    }

    console.log('Calculated nutrition for', date, ':', totals);
    return totals;
}

function resolveCustomIngredientPricePerGram(identifier, customIngredientsMap) {
    if (!identifier) return null;
    try {
        const normalizedId = String(identifier).replace(/^custom-/, '');
        if (!normalizedId) return null;
        const customIngredient = customIngredientsMap.get(normalizedId);
        if (customIngredient && typeof customIngredient.pricePerGram === 'number' && !Number.isNaN(customIngredient.pricePerGram)) {
            return customIngredient.pricePerGram;
        }
    } catch (error) {
        console.error('Error resolving custom ingredient price:', error);
    }
    return null;
}

function calculateRecipeItemCost(recipe, amount, customIngredientsMap) {
    const parsedAmount = parseFloat(amount);
    if (!recipe || !Array.isArray(recipe.ingredients) || !parsedAmount || parsedAmount <= 0) {
        return 0;
    }

    let totalWeight = 0;
    let totalCost = 0;

    try {
        recipe.ingredients.forEach(ingredient => {
            const ingredientAmount = parseFloat(ingredient.amount) || 0;
            if (ingredientAmount <= 0) {
                return;
            }

            totalWeight += ingredientAmount;

            let pricePerGram = null;
            if (typeof ingredient.pricePerGram === 'number' && !Number.isNaN(ingredient.pricePerGram)) {
                pricePerGram = ingredient.pricePerGram;
            } else if (ingredient.fdcId) {
                pricePerGram = resolveCustomIngredientPricePerGram(ingredient.fdcId, customIngredientsMap);
            } else if (ingredient.id) {
                pricePerGram = resolveCustomIngredientPricePerGram(ingredient.id, customIngredientsMap);
            }

            if (typeof pricePerGram === 'number' && !Number.isNaN(pricePerGram)) {
                totalCost += pricePerGram * ingredientAmount;
            }
        });
    } catch (error) {
        console.error('Error calculating recipe cost:', error);
        return 0;
    }

    if (totalWeight <= 0 || totalCost <= 0) {
        return 0;
    }

    const scaleFactor = parsedAmount / totalWeight;
    if (!Number.isFinite(scaleFactor) || scaleFactor <= 0) {
        return 0;
    }

    return totalCost * scaleFactor;
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
        currentWeekOffset = loadWeekOffset();
        baseStartOfWeekTimestamp = getBaseStartOfWeekTimestamp();
        console.log('Loaded currentWeekOffset:', currentWeekOffset, 'and set baseStartOfWeekTimestamp');
        
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
        
        // Initialize recurring items
        initializeRecurringItems();
        
        // Initialize recurring options in modal
        initializeRecurringModalOptions();
        
        // Initialize cancel meal button
        if (cancelMeal) {
            cancelMeal.addEventListener('click', closeMealPlanModal);
        }
        
        // Initialize close button for meal plan modal
        const closeBtn = mealPlanModal?.querySelector('.close');
        if (closeBtn) {
            closeBtn.addEventListener('click', closeMealPlanModal);
            console.log('Meal plan modal close button initialized');
        } else {
            console.warn('Meal plan modal close button not found');
        }
        
        // Initialize click-outside-to-close for meal plan modal
        if (mealPlanModal) {
            mealPlanModal.addEventListener('click', (event) => {
                if (event.target === mealPlanModal) {
                    closeMealPlanModal();
                }
            });
            console.log('Meal plan modal click-outside handler initialized');
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
    const isRecurring = document.getElementById('make-recurring').checked;
    
    if (isRecurring) {
        // Handle recurring item
        const selectedDays = Array.from(document.querySelectorAll('input[name="recurring-days"]:checked'))
            .map(checkbox => parseInt(checkbox.value));
        const endDate = document.getElementById('recurring-end-date').value;
        
        if (selectedDays.length === 0) {
            showAlert('Please select at least one day of the week for recurring items.', { type: 'warning' });
            return;
        }
        
        // Create recurring item
        const recurringItem = {
            id: Date.now(),
            name: selectedItem.name,
            type: selectedItem.type,
            amount: amount,
            mealType: selectedSlot.dataset.meal,
            days: selectedDays,
            itemId: selectedItem.id,
            nutrition: selectedItem.nutrition,
            servingSize: selectedItem.servingSize,
            storeSection: selectedItem.storeSection || '',
            endDate: endDate || null,
            pricePerGram: typeof selectedItem.pricePerGram === 'number' ? selectedItem.pricePerGram : null
        };
        
        recurringItems.push(recurringItem);
        saveRecurringItems();
        applyRecurringItems();
        await updateMealPlanDisplay();
        
        console.log('Recurring item added:', recurringItem);
    } else {
        // Handle single item
        const mealKey = getMealKey(selectedSlot.dataset.day, selectedSlot.dataset.meal);
        if (!mealPlan[mealKey]) mealPlan[mealKey] = [];
        mealPlan[mealKey].push({
            type: selectedItem.type,
            id: selectedItem.id,
            amount: amount,
            name: selectedItem.name,
            nutrition: selectedItem.nutrition,
            servingSize: selectedItem.servingSize,
            storeSection: selectedItem.storeSection || '',
            pricePerGram: typeof selectedItem.pricePerGram === 'number' ? selectedItem.pricePerGram : null
        });
        saveMealPlan();
    }
    
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

// Add flag to prevent multiple simultaneous updates
let isUpdatingDisplay = false;

async function updateMealPlanDisplay() {
    const mealPlanGrid = document.querySelector('.meal-plan-grid');
    if (!mealPlanGrid) return;
    
    // Prevent multiple simultaneous updates
    if (isUpdatingDisplay) {
        console.log('Display update already in progress, skipping...');
        return;
    }
    
    isUpdatingDisplay = true;
    
    try {
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
    let customIngredientsList = [];
    try {
        const savedCustomIngredients = localStorage.getItem('meale-custom-ingredients');
        if (savedCustomIngredients) {
            customIngredientsList = JSON.parse(savedCustomIngredients);
        }
    } catch (error) {
        console.error('Error loading custom ingredients for cost calculation:', error);
    }

    const customIngredientsMap = new Map();
    customIngredientsList.forEach(ingredient => {
        if (ingredient && ingredient.id !== undefined && ingredient.id !== null) {
            customIngredientsMap.set(String(ingredient.id), ingredient);
        }
    });

    const dayNutritionData = [];
    for (const date of week.dates) {
        const dayNutrition = await calculateDayNutrition(date, customIngredientsMap);
        dayNutritionData.push({ date, totals: dayNutrition });
    }
    
    // Add daily nutrition row at the bottom
    const dailyNutritionRow = document.createElement('div');
    dailyNutritionRow.className = 'daily-nutrition-row';
    
    // Add empty cell for time column
    const dailyEmptyCell = document.createElement('div');
    dailyEmptyCell.className = 'daily-nutrition-cell';
    dailyNutritionRow.appendChild(dailyEmptyCell);
    
    // Add daily nutrition for each day with progress bars
    // Get nutrition goals from settings, with fallbacks
    const dailyGoals = {
        calories: window.settings?.nutritionGoals?.calories || 2000,
        protein: window.settings?.nutritionGoals?.protein || 150,
        carbs: window.settings?.nutritionGoals?.carbs || 200,
        fat: window.settings?.nutritionGoals?.fat || 65
    };
    
    const formatNumber = (num) => Number(num || 0).toLocaleString();
    const formatCurrency = (value) => {
        const numericValue = Number(value);
        if (!Number.isFinite(numericValue)) {
            return '$0.00';
        }
        return numericValue.toLocaleString(undefined, {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    };

    dayNutritionData.forEach(({ date, totals }) => {
        const dayNutritionCell = document.createElement('div');
        dayNutritionCell.className = 'daily-nutrition-cell';
        
        const caloriesConsumed = Math.round(totals.calories);
        const caloriesRemaining = dailyGoals.calories ? Math.max(0, dailyGoals.calories - caloriesConsumed) : 0;
        const calorieProgressPercentage = dailyGoals.calories ? Math.min(100, (caloriesConsumed / dailyGoals.calories) * 100) : 0;
        const isCalorieOverGoal = caloriesConsumed > dailyGoals.calories;
        
        const proteinConsumed = Math.round(totals.protein);
        const proteinProgressPercentage = dailyGoals.protein ? Math.min(100, (proteinConsumed / dailyGoals.protein) * 100) : 0;
        const isProteinOverGoal = proteinConsumed > dailyGoals.protein;
        
        const carbsConsumed = Math.round(totals.carbs);
        const carbsProgressPercentage = dailyGoals.carbs ? Math.min(100, (carbsConsumed / dailyGoals.carbs) * 100) : 0;
        const isCarbsOverGoal = carbsConsumed > dailyGoals.carbs;
        
        const fatConsumed = Math.round(totals.fat);
        const fatProgressPercentage = dailyGoals.fat ? Math.min(100, (fatConsumed / dailyGoals.fat) * 100) : 0;
        const isFatOverGoal = fatConsumed > dailyGoals.fat;
        
        dayNutritionCell.innerHTML = `
            <div class="daily-totals">
                <div class="calorie-progress-container">
                    <div class="calorie-progress-header">
                        <span class="calories-consumed">${formatNumber(caloriesConsumed)}</span>
                        <span class="calorie-separator">/</span>
                        <span class="calories-goal">${formatNumber(dailyGoals.calories)}</span>
                        <span class="calorie-unit">cal</span>
                    </div>
                    <div class="calorie-progress-bar">
                        <div class="calorie-progress-fill ${isCalorieOverGoal ? 'over-goal' : ''}" style="width: ${calorieProgressPercentage}%"></div>
                    </div>
                    <div class="calorie-remaining">${formatNumber(caloriesRemaining)} remaining</div>
                </div>
                <div class="macro-progress-container">
                    <div class="macro-progress-item">
                        <div class="circular-progress" data-progress="${proteinProgressPercentage}" data-over-goal="${isProteinOverGoal}">
                            <svg class="circular-progress-svg" viewBox="0 0 36 36">
                                <path class="circular-progress-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                                <path class="circular-progress-fill" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                            </svg>
                            <div class="circular-progress-text">
                                <span class="macro-value">${formatNumber(proteinConsumed)}</span>
                                <span class="macro-unit">g</span>
                            </div>
                        </div>
                        <div class="macro-label">Protein</div>
                    </div>
                    <div class="macro-progress-item">
                        <div class="circular-progress" data-progress="${carbsProgressPercentage}" data-over-goal="${isCarbsOverGoal}">
                            <svg class="circular-progress-svg" viewBox="0 0 36 36">
                                <path class="circular-progress-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                                <path class="circular-progress-fill" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                            </svg>
                            <div class="circular-progress-text">
                                <span class="macro-value">${formatNumber(carbsConsumed)}</span>
                                <span class="macro-unit">g</span>
                            </div>
                        </div>
                        <div class="macro-label">Carbs</div>
                    </div>
                    <div class="macro-progress-item">
                        <div class="circular-progress" data-progress="${fatProgressPercentage}" data-over-goal="${isFatOverGoal}">
                            <svg class="circular-progress-svg" viewBox="0 0 36 36">
                                <path class="circular-progress-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                                <path class="circular-progress-fill" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                            </svg>
                            <div class="circular-progress-text">
                                <span class="macro-value">${formatNumber(fatConsumed)}</span>
                                <span class="macro-unit">g</span>
                            </div>
                        </div>
                        <div class="macro-label">Fat</div>
                    </div>
                </div>
            </div>
        `;
        dailyNutritionRow.appendChild(dayNutritionCell);
    });
    
    mealPlanGrid.appendChild(dailyNutritionRow);

    // Add total cost row
    const weeklyCostTotal = dayNutritionData.reduce((sum, data) => {
        const cost = Number(data?.totals?.cost);
        return sum + (Number.isFinite(cost) ? cost : 0);
    }, 0);

    const dailyCostRow = document.createElement('div');
    dailyCostRow.className = 'daily-cost-row';

    const costSummaryCell = document.createElement('div');
    costSummaryCell.className = 'daily-cost-cell daily-cost-summary';
    costSummaryCell.innerHTML = `
        <div class="cost-label">Total Cost</div>
        <div class="cost-week-total">Week: ${formatCurrency(weeklyCostTotal)}</div>
    `;
    dailyCostRow.appendChild(costSummaryCell);

    dayNutritionData.forEach(({ totals }) => {
        const costCell = document.createElement('div');
        costCell.className = 'daily-cost-cell';
        costCell.textContent = formatCurrency(totals.cost);
        dailyCostRow.appendChild(costCell);
    });

    mealPlanGrid.appendChild(dailyCostRow);
    
    // Animate circular progress bars
    setTimeout(() => {
        document.querySelectorAll('.circular-progress').forEach(progress => {
            const progressPercentage = parseFloat(progress.dataset.progress);
            const isOverGoal = progress.dataset.overGoal === 'true';
            const fillPath = progress.querySelector('.circular-progress-fill');
            
            // Calculate stroke-dasharray for the progress
            const circumference = 2 * Math.PI * 15.9155; // radius = 15.9155
            const strokeDasharray = circumference;
            const strokeDashoffset = circumference - (progressPercentage / 100) * circumference;
            
            fillPath.style.strokeDasharray = strokeDasharray;
            fillPath.style.strokeDashoffset = strokeDashoffset;
            fillPath.classList.toggle('over-goal', isOverGoal);
        });
    }, 100);
    
    } catch (error) {
        console.error('Error updating meal plan display:', error);
    } finally {
        isUpdatingDisplay = false;
    }
}

// Function to refresh meal plan when settings change
export function refreshMealPlanOnSettingsChange() {
    // Re-display the meal plan with updated settings
    updateMealPlanDisplay();
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
            saveWeekOffset(currentWeekOffset);
            updateWeekDisplay();
            applyRecurringItems();
            updateMealPlanDisplay();
        });
    }
    
    if (nextWeekBtn) {
        nextWeekBtn.addEventListener('click', async () => {
            currentWeekOffset++;
            console.log('DEBUG: nextWeekBtn clicked, new currentWeekOffset:', currentWeekOffset);
            saveWeekOffset(currentWeekOffset);
            updateWeekDisplay();
            applyRecurringItems();
            updateMealPlanDisplay();
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
            showAlert('No meal plan found. Please add some meals to your plan first.', { type: 'info' });
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
        const customIngredients = JSON.parse(localStorage.getItem('meale-custom-ingredients') || '[]').map(ing => ({
            ...ing,
            storeSection: ing.storeSection || ''
        }));
        const resolveStoreSection = (name, section = '') => {
            const trimmed = (section || '').trim();
            if (trimmed) return trimmed;
            const match = customIngredients.find(ing => ing.name.toLowerCase() === name.toLowerCase());
            if (match && match.storeSection) {
                const normalized = match.storeSection.trim();
                return normalized || 'Uncategorized';
            }
            return 'Uncategorized';
        };
        
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
                            
                            if (item.type === 'meal') {
                                // For recipes, break down into individual ingredients
                                const recipe = window.recipes.find(r => r.id === item.id);
                                if (recipe && recipe.ingredients) {
                                    console.log(`Breaking down recipe: ${item.name} (${item.amount}g)`);
                                    
                                    // Calculate scaling factor based on recipe serving size vs amount
                                    const servingSize = recipe.servingSize || 100;
                                    const scaleFactor = item.amount / servingSize;
                                    
                                    recipe.ingredients.forEach(ingredient => {
                                        if (ingredient.name && ingredient.amount) {
                                            const scaledAmount = Math.round(ingredient.amount * scaleFactor);
                                            const storeSection = resolveStoreSection(ingredient.name, ingredient.storeSection);
                                            const key = `${storeSection.toLowerCase()}|${ingredient.name.toLowerCase()}`;
                                            
                                            if (ingredients.has(key)) {
                                                const existing = ingredients.get(key);
                                                existing.amount += scaledAmount;
                                                // Update notes to include recipe name
                                                if (!existing.notes.includes(recipe.name)) {
                                                    existing.notes += `, ${recipe.name}`;
                                                }
                                            } else {
                                                ingredients.set(key, {
                                                    name: ingredient.name,
                                                    amount: scaledAmount,
                                                    unit: 'g',
                                                    notes: `From recipe: ${recipe.name}`,
                                                    storeSection: storeSection
                                                });
                                            }
                                        }
                                    });
                                } else {
                                    console.warn(`Recipe not found or no ingredients for: ${item.name}`);
                                }
                            } else if (item.type === 'ingredient') {
                                // For ingredients, add directly
                                const storeSection = resolveStoreSection(item.name, item.storeSection);
                                const key = `${storeSection.toLowerCase()}|${item.name.toLowerCase()}`;
                                if (ingredients.has(key)) {
                                    const existing = ingredients.get(key);
                                    existing.amount += item.amount;
                                } else {
                                    ingredients.set(key, {
                                        name: item.name,
                                        amount: item.amount,
                                        unit: 'g',
                                        notes: `From meal plan: ${item.name}`,
                                        storeSection: storeSection
                                    });
                                }
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
            showAlert(`No ingredients found in your meal plan for the week of ${startDate} to ${endDate}. Please add meals to this week first.`, { type: 'info' });
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
        
        const aggregatedItems = Array.from(ingredients.values());
        aggregatedItems.sort((a, b) => {
            const sectionA = (a.storeSection || 'Uncategorized').toLowerCase();
            const sectionB = (b.storeSection || 'Uncategorized').toLowerCase();
            if (sectionA !== sectionB) {
                return sectionA.localeCompare(sectionB);
            }
            return a.name.localeCompare(b.name);
        });
        
        const newList = {
            id: Date.now(),
            name: listName,
            description: `Generated from meal plan for week of ${startDate} to ${endDate}`,
            items: aggregatedItems.map(ing => ({
                id: Date.now() + Math.random(),
                name: ing.name,
                amount: Math.round(ing.amount * 10) / 10, // Round to 1 decimal
                unit: ing.unit,
                notes: ing.notes,
                storeSection: ing.storeSection || 'Uncategorized',
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
            showAlert('Error saving shopping list. Please try again.', { type: 'error' });
            return;
        }
        
        // Redirect to shopping lists page
        window.location.href = 'shopping-lists.html';
        
    } catch (error) {
        console.error('Error generating shopping list from meal plan:', error);
        showAlert('Error generating shopping list. Please try again.', { type: 'error' });
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
                
                .daily-cost-row {
                    display: table-row;
                    page-break-inside: avoid;
                }
                
                .daily-cost-cell {
                    background: #ffffff;
                    border: 1px solid #000;
                    padding: 4px;
                    text-align: center;
                    font-size: 9pt;
                    display: table-cell;
                    vertical-align: middle;
                }
                
                .daily-cost-cell:first-child {
                    font-weight: bold;
                    text-align: left;
                    background: #f0f0f0;
                }
                
                .daily-cost-summary .cost-label {
                    display: block;
                    margin-bottom: 2px;
                }
                
                .daily-cost-summary .cost-week-total {
                    font-weight: 600;
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

                .macro-progress-container {
                    display: flex;
                    justify-content: space-around;
                    align-items: center;
                    gap: 0.3rem;
                    margin-top: 4px;
                }

                .macro-progress-item {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    flex: 1;
                }

                .circular-progress {
                    position: relative;
                    width: 36px;
                    height: 36px;
                    margin-bottom: 4px;
                }

                .circular-progress-svg {
                    width: 100%;
                    height: 100%;
                    transform: rotate(-90deg);
                }

                .circular-progress-bg {
                    fill: none;
                    stroke: #e0e0e0;
                    stroke-width: 2;
                }

                .circular-progress-fill {
                    fill: none;
                    stroke: #4caf50;
                    stroke-width: 2;
                    stroke-linecap: round;
                    transition: none;
                }

                .circular-progress-fill.over-goal {
                    stroke: #f44336;
                }

                .circular-progress-text {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    text-align: center;
                    font-size: 0.7rem;
                    font-weight: 600;
                    line-height: 1;
                }

                .macro-value {
                    display: block;
                    color: #000;
                }

                .macro-unit {
                    font-size: 0.6rem;
                    color: #555;
                }

                .macro-label {
                    font-size: 0.65rem;
                    color: #555;
                    font-weight: 500;
                    text-align: center;
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