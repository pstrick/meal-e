import { showAlert } from './alert.js';
import { searchUSDAIngredients } from './usda-api.js';
import { searchOpenFoodFactsIngredients } from './open-food-facts-api.js';

// Helper function to get my ingredients with migration support
function getMyIngredients() {
    // Migrate old storage key if needed
    const oldKey = 'meale-custom-ingredients';
    const newKey = 'meale-my-ingredients';
    const oldData = localStorage.getItem(oldKey);
    const newData = localStorage.getItem(newKey);
    
    if (!newData && oldData) {
        localStorage.setItem(newKey, oldData);
        localStorage.removeItem(oldKey);
    }
    
    return JSON.parse(localStorage.getItem(newKey) || '[]');
}

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
let printOptionsModal = null;
let printOptionsForm = null;
let printRecipeSelectionList = null;
let selectAllRecipesCheckbox = null;
let cancelPrintOptionsButton = null;
let shoppingListSelectionModal = null;
let shoppingListSelectionForm = null;
let existingShoppingListSelect = null;
let shoppingListOptionRadios = [];
let newShoppingListNameInput = null;
let newShoppingListDescriptionInput = null;
let cancelShoppingListSelectionButton = null;
let pendingShoppingListData = null;

const DEFAULT_STORE_SECTION = 'Uncategorized';

function normalizeStoreSection(section) {
    const trimmed = (section || '').trim();
    return trimmed ? trimmed : DEFAULT_STORE_SECTION;
}

function sanitizeEmoji(value) {
    const trimmed = (value || '').trim();
    if (!trimmed) {
        return '';
    }
    const chars = Array.from(trimmed);
    return chars.slice(0, 2).join('');
}

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

// Ingredient search function for meal plan (includes USDA API)
async function searchAllIngredients(query) {
    const results = [];
    
    // Search my ingredients first (faster, local) - show immediately
    // Prioritize exact matches and starts-with matches
    const queryLower = query.toLowerCase().trim();
    const allMyIngredients = getMyIngredients();
    
    // Filter out ingredients without valid nutrition data
    const validMyIngredients = allMyIngredients.filter(ingredient => {
        if (!ingredient.nutrition) {
            return false;
        }
        const nutrition = ingredient.nutrition;
        const hasValidNutrition = 
            nutrition.calories > 0 || 
            nutrition.protein > 0 || 
            nutrition.carbs > 0 || 
            nutrition.fat > 0;
        
        if (!hasValidNutrition) {
            console.log('Filtering out ingredient from "my ingredients" without valid nutrition:', ingredient.name);
        }
        return hasValidNutrition;
    });
    
    const customIngredients = validMyIngredients.map(ingredient => ({
        ...ingredient,
        storeSection: ingredient.storeSection || '',
        emoji: (ingredient.emoji || '').trim(),
        pricePerGram: typeof ingredient.pricePerGram === 'number' ? ingredient.pricePerGram : null,
        totalPrice: typeof ingredient.totalPrice === 'number' ? ingredient.totalPrice : null,
        totalWeight: typeof ingredient.totalWeight === 'number' ? ingredient.totalWeight : null
    }));
    
    // Sort custom ingredients by relevance: exact match > starts with > contains
    const customMatches = customIngredients
        .filter(ingredient => {
            const nameLower = ingredient.name.toLowerCase();
            return nameLower.includes(queryLower);
        })
        .map(ingredient => {
            const nameLower = ingredient.name.toLowerCase();
            let relevance = 0;
            if (nameLower === queryLower) {
                relevance = 3; // Exact match
            } else if (nameLower.startsWith(queryLower)) {
                relevance = 2; // Starts with
            } else {
                relevance = 1; // Contains
            }
            return { ingredient, relevance };
        })
        .sort((a, b) => b.relevance - a.relevance)
        .map(item => item.ingredient);
    
    // Add custom ingredients to results
    customMatches.forEach(ingredient => {
        // Convert nutrition from total serving size to per-gram values
        const servingSize = ingredient.servingSize || 100; // Default to 100g if not specified
        
        // Calculate pricePer100g from pricePerGram if available
        let pricePer100g = null;
        if (ingredient.pricePerGram) {
            pricePer100g = ingredient.pricePerGram * 100;
        }
        
        results.push({
            id: ingredient.id,
            fdcId: `custom-${ingredient.id}`,
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
            brandOwner: 'My Ingredient',
            storeSection: ingredient.storeSection || '',
            pricePerGram: ingredient.pricePerGram || null,
            pricePer100g: pricePer100g,
            totalPrice: ingredient.totalPrice,
            totalWeight: ingredient.totalWeight,
            emoji: ingredient.emoji
        });
    });
    
    // Search USDA API (async, network call) - for generic foods
    // Only get the most relevant result
    try {
        const usdaResults = await searchUSDAIngredients(query, 20); // Get more to find best match
        if (usdaResults && usdaResults.length > 0) {
            // Find the most relevant USDA result
            const bestUSDAResult = usdaResults
                .map(result => {
                    const nameLower = (result.name || '').toLowerCase();
                    let relevance = 0;
                    if (nameLower === queryLower) {
                        relevance = 3; // Exact match
                    } else if (nameLower.startsWith(queryLower)) {
                        relevance = 2; // Starts with
                    } else if (nameLower.includes(queryLower)) {
                        relevance = 1; // Contains
                    }
                    // Boost relevance if it has nutrition data
                    if (result.nutrition && (result.nutrition.calories > 0 || result.nutrition.protein > 0)) {
                        relevance += 0.5;
                    }
                    return { result, relevance };
                })
                .sort((a, b) => b.relevance - a.relevance)[0];
            
            if (bestUSDAResult && bestUSDAResult.relevance > 0) {
                results.push({
                    ...bestUSDAResult.result,
                    category: bestUSDAResult.result.category || 'ingredient',
                    pricePerGram: null,
                    totalPrice: null,
                    totalWeight: null
                });
            }
        }
    } catch (error) {
        console.error('Error searching USDA API:', error);
        // Continue with other sources if USDA fails
    }
    
    // Search Open Food Facts API (async, network call) - for branded products
    // Only get the most relevant result
    try {
        const offResults = await searchOpenFoodFactsIngredients(query, 20); // Get more to find best match
        if (offResults && offResults.length > 0) {
            // Find the most relevant Open Food Facts result
            const bestOFFResult = offResults
                .map(result => {
                    const nameLower = (result.name || '').toLowerCase();
                    let relevance = 0;
                    if (nameLower === queryLower) {
                        relevance = 3; // Exact match
                    } else if (nameLower.startsWith(queryLower)) {
                        relevance = 2; // Starts with
                    } else if (nameLower.includes(queryLower)) {
                        relevance = 1; // Contains
                    }
                    // Boost relevance if it has nutrition data
                    if (result.nutrition && (result.nutrition.calories > 0 || result.nutrition.protein > 0)) {
                        relevance += 0.5;
                    }
                    return { result, relevance };
                })
                .sort((a, b) => b.relevance - a.relevance)[0];
            
            if (bestOFFResult && bestOFFResult.relevance > 0) {
                results.push({
                    ...bestOFFResult.result,
                    category: bestOFFResult.result.category || 'ingredient',
                    pricePerGram: null,
                    totalPrice: null,
                    totalWeight: null
                });
            }
        }
    } catch (error) {
        console.error('Error searching Open Food Facts API:', error);
        // Continue with other sources if Open Food Facts fails
    }
    
    // Sort results: my ingredients first (already added first), then API results by relevance and shortest name
    results.sort((a, b) => {
        // My ingredients first (source === 'custom')
        if (a.source === 'custom' && b.source !== 'custom') return -1;
        if (a.source !== 'custom' && b.source === 'custom') return 1;
        
        // For API results, sort by relevance (exact match > starts with > contains) then by shortest name
        if (a.source !== 'custom' && b.source !== 'custom') {
            const aNameLower = a.name.toLowerCase();
            const bNameLower = b.name.toLowerCase();
            
            // Calculate relevance scores
            let aRelevance = 0;
            let bRelevance = 0;
            
            if (aNameLower === queryLower) aRelevance = 3;
            else if (aNameLower.startsWith(queryLower)) aRelevance = 2;
            else if (aNameLower.includes(queryLower)) aRelevance = 1;
            
            if (bNameLower === queryLower) bRelevance = 3;
            else if (bNameLower.startsWith(queryLower)) bRelevance = 2;
            else if (bNameLower.includes(queryLower)) bRelevance = 1;
            
            // Sort by relevance first
            if (aRelevance !== bRelevance) {
                return bRelevance - aRelevance;
            }
            
            // Then by shortest name
            if (a.name.length !== b.name.length) {
                return a.name.length - b.name.length;
            }
            
            // Finally alphabetically
            return a.name.localeCompare(b.name);
        }
        
        // Alphabetically for my ingredients
        return a.name.localeCompare(b.name);
    });
    
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
                emoji: '',
                icon: '🍽️',
                label: 'Recipe'
            });
        });
    }
    
    // Search custom ingredients and USDA API
    try {
        const ingredientResults = await searchAllIngredients(searchTerm);
        for (const ingredient of ingredientResults) {
            // Add ingredient with default category if none exists
            const ingredientCategory = ingredient.category || 'ingredient';
            
            // Only add if category matches or is 'all'
            if (category === 'all' || ingredientCategory === category) {
                // Determine icon and label based on source
                let icon = '🥩';
                let label = 'My Ingredient';
                let id;
                if (ingredient.source === 'usda') {
                    icon = '🌾';
                    label = 'USDA Database';
                    id = `usda-${ingredient.fdcId}`;
                } else if (ingredient.source === 'openfoodfacts') {
                    icon = '🏷️';
                    label = 'Open Food Facts';
                    id = `off-${ingredient.fdcId || ingredient.id}`;
                } else {
                    id = `custom-${ingredient.id}`;
                }
                
                results.push({
                    type: 'ingredient',
                    id: id,
                    name: ingredient.name,
                    category: ingredientCategory,
                    servingSize: ingredient.servingSize || 100, // Default to 100g if not specified
                    nutrition: ingredient.nutrition,
                    source: ingredient.source,
                    fdcId: ingredient.fdcId,
                    emoji: ingredient.emoji || '',
                    storeSection: ingredient.storeSection || '',
                    brandOwner: ingredient.brandOwner || '',
                    pricePerGram: ingredient.pricePerGram || null,
                    pricePer100g: ingredient.pricePer100g || null,
                    icon: icon,
                    label: label
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
        const brandInfo = item.brandOwner && item.source === 'usda' ? `<p class="brand-info">${item.brandOwner}</p>` : '';
        
        // Format price information for ingredients
        let priceInfo = '';
        if (item.type === 'ingredient') {
            if (item.pricePer100g) {
                priceInfo = `<p style="color: #666; font-size: 0.9em;">Price: $${item.pricePer100g.toFixed(2)}/100g</p>`;
            } else if (item.pricePerGram) {
                priceInfo = `<p style="color: #666; font-size: 0.9em;">Price: $${(item.pricePerGram * 100).toFixed(2)}/100g</p>`;
            } else {
                priceInfo = '<p style="color: #999; font-size: 0.9em;">Price: N/A</p>';
            }
        }
        
        div.innerHTML = `
            <div class="item-header">
                <span class="item-icon">${item.icon}</span>
                <span class="item-type">${item.label}</span>
                <h4>${item.name}</h4>
            </div>
            <p>Category: ${item.category}</p>
            <p>Serving Size: ${item.servingSize || 100}g</p>
            ${brandInfo}
            ${priceInfo}
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
    const sanitizedEmoji = (item.emoji || '').trim();
    selectedItem = {
        ...item,
        emoji: sanitizedEmoji
    };
    
    // Get elements from the form
    const selectedItemDiv = mealPlanForm.querySelector('.selected-item');
    const submitButton = mealPlanForm.querySelector('button[type="submit"]');
    
    if (!selectedItemDiv || !submitButton) {
        console.error('Required elements not found in the form');
        return;
    }
    
    // Update selected item display
    selectedItemDiv.style.display = 'block';
    const displayName = sanitizedEmoji ? `${sanitizedEmoji} ${item.name}` : item.name;
    selectedItemDiv.querySelector('.item-name').textContent = displayName;
    
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
            if (option.querySelector('h4').textContent === displayName) {
                option.classList.add('selected');
            }
        });
    }
}

function closeMealPlanModal() {
    if (!mealPlanModal) return;
    
    mealPlanModal.classList.remove('active');
    
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
                storeSection: item.storeSection || '',
                emoji: item.emoji || ''
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
                emoji: recurringItem.emoji || '',
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
    div.dataset.itemEmoji = item.emoji || '';
    
    const label = item.type === 'meal' ? 'Recipe' : 'Custom Ingredient';
    
    // Truncate item name to keep cards compact
    const displayName = item.emoji ? `${item.emoji} ${item.name}` : item.name;
    const truncatedName = displayName.length > 140 ? `${displayName.substring(0, 137).trimEnd()}...` : displayName;
    
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
            const customIngredients = getMyIngredients();
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
            <span class="meal-item-name" title="${displayName}">${truncatedName}</span>
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

async function calculateDayNutrition(date) {
    console.log('Calculating nutrition for date:', date);
    const nutrition = {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0
    };

    const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];
    
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
                        // My ingredient
                        const customIngredients = getMyIngredients();
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
        initializeShoppingListSelectionModal();
        initializePrintOptionsModal();
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
            alert('Please select at least one day of the week for recurring items.');
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
            emoji: selectedItem.emoji || '',
            endDate: endDate || null,
            source: selectedItem.source || 'custom',
            fdcId: selectedItem.fdcId || null
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
            emoji: selectedItem.emoji || '',
            source: selectedItem.source || 'custom',
            fdcId: selectedItem.fdcId || null
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
                const emoji = (itemData.emoji || '').trim();
                item = {
                    type: 'ingredient',
                    id: itemData.id,
                    name: itemData.name || 'Ingredient', // We'll need to store name
                    nutrition: itemData.nutrition || { calories: 0, protein: 0, carbs: 0, fat: 0 },
                    emoji: emoji,
                    storeSection: itemData.storeSection || ''
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
    
    // Add daily nutrition for each day with progress bars
    // Get nutrition goals from settings, with fallbacks
    const dailyGoals = {
        calories: window.settings?.nutritionGoals?.calories || 2000,
        protein: window.settings?.nutritionGoals?.protein || 150,
        carbs: window.settings?.nutritionGoals?.carbs || 200,
        fat: window.settings?.nutritionGoals?.fat || 65
    };
    
    dayNutritionData.forEach(({ date, nutrition }) => {
        const dayNutritionCell = document.createElement('div');
        dayNutritionCell.className = 'daily-nutrition-cell';
        
        const caloriesConsumed = Math.round(nutrition.calories);
        const caloriesRemaining = Math.max(0, dailyGoals.calories - caloriesConsumed);
        const calorieProgressPercentage = Math.min(100, (caloriesConsumed / dailyGoals.calories) * 100);
        const isCalorieOverGoal = caloriesConsumed > dailyGoals.calories;
        
        const proteinConsumed = Math.round(nutrition.protein);
        const proteinProgressPercentage = Math.min(100, (proteinConsumed / dailyGoals.protein) * 100);
        const isProteinOverGoal = proteinConsumed > dailyGoals.protein;
        
        const carbsConsumed = Math.round(nutrition.carbs);
        const carbsProgressPercentage = Math.min(100, (carbsConsumed / dailyGoals.carbs) * 100);
        const isCarbsOverGoal = carbsConsumed > dailyGoals.carbs;
        
        const fatConsumed = Math.round(nutrition.fat);
        const fatProgressPercentage = Math.min(100, (fatConsumed / dailyGoals.fat) * 100);
        const isFatOverGoal = fatConsumed > dailyGoals.fat;
        
        // Format numbers with commas
        const formatNumber = (num) => num.toLocaleString();
        
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
            if (printOptionsModal) {
                openPrintOptionsModal();
            } else {
                printMealPlan();
            }
        });
    }
}

// Initialize shopping list generation button
function initializeShoppingListButton() {
    const generateButton = document.getElementById('generate-shopping-list');
    
    if (generateButton) {
        generateButton.addEventListener('click', () => {
            const shoppingListData = buildShoppingListData();
            if (shoppingListData) {
                openShoppingListSelectionModal(shoppingListData);
            }
        });
    }
}

function buildShoppingListData() {
    try {
        // Load meal plan data from localStorage
        const mealPlanData = localStorage.getItem('mealPlan');
        if (!mealPlanData) {
            showAlert('No meal plan found. Please add some meals to your plan first.', { type: 'info' });
            return null;
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
        const customIngredients = getMyIngredients().map(ing => ({
            ...ing,
            storeSection: ing.storeSection || '',
            emoji: sanitizeEmoji(ing.emoji)
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
        const resolveEmoji = (name, emoji = '') => {
            const trimmed = sanitizeEmoji(emoji);
            if (trimmed) return trimmed;
            const match = customIngredients.find(ing => ing.name.toLowerCase() === name.toLowerCase());
            if (match && match.emoji) {
                return match.emoji;
            }
            return '';
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
                                            const emoji = resolveEmoji(ingredient.name, ingredient.emoji);
                                            const key = `${storeSection.toLowerCase()}|${ingredient.name.toLowerCase()}`;
                                            
                                            if (ingredients.has(key)) {
                                                const existing = ingredients.get(key);
                                                existing.amount += scaledAmount;
                                                // Update notes to include recipe name
                                                if (!existing.notes.includes(recipe.name)) {
                                                    existing.notes += `, ${recipe.name}`;
                                                }
                                                if (!existing.emoji && emoji) {
                                                    existing.emoji = emoji;
                                                }
                                            } else {
                                                ingredients.set(key, {
                                                    name: ingredient.name,
                                                    amount: scaledAmount,
                                                    unit: 'g',
                                                    notes: `From recipe: ${recipe.name}`,
                                                    storeSection: storeSection,
                                                    emoji: emoji
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
                                const emoji = resolveEmoji(item.name, item.emoji);
                                const key = `${storeSection.toLowerCase()}|${item.name.toLowerCase()}`;
                                if (ingredients.has(key)) {
                                    const existing = ingredients.get(key);
                                    existing.amount += item.amount;
                                    if (!existing.emoji && emoji) {
                                        existing.emoji = emoji;
                                    }
                                } else {
                                    ingredients.set(key, {
                                        name: item.name,
                                        amount: item.amount,
                                        unit: 'g',
                                        notes: `From meal plan: ${item.name}`,
                                        storeSection: storeSection,
                                        emoji: emoji
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
            return null;
        }
        
        const DEFAULT_SECTION = 'Uncategorized';
        const aggregatedItems = Array.from(ingredients.values());
        aggregatedItems.sort((a, b) => {
            const sectionA = (a.storeSection || DEFAULT_SECTION).toLowerCase();
            const sectionB = (b.storeSection || DEFAULT_SECTION).toLowerCase();
            if (sectionA !== sectionB) {
                if (sectionA === DEFAULT_SECTION.toLowerCase()) return 1;
                if (sectionB === DEFAULT_SECTION.toLowerCase()) return -1;
                return sectionA.localeCompare(sectionB);
            }
            return a.name.localeCompare(b.name);
        });
        
        return {
            week,
            startDate,
            endDate,
            listName: `Meal Plan Shopping List - Week of ${startDate}`,
            description: `Generated from meal plan for week of ${startDate} to ${endDate}`,
            items: aggregatedItems.map(ing => ({
                name: ing.name,
                amount: Math.round(ing.amount * 10) / 10,
                unit: ing.unit,
                notes: ing.notes,
                storeSection: ing.storeSection || DEFAULT_SECTION,
                emoji: sanitizeEmoji(ing.emoji)
            }))
        };
    } catch (error) {
        console.error('Error generating shopping list from meal plan:', error);
        showAlert('Error generating shopping list. Please try again.', { type: 'error' });
        return null;
    }
}

function initializeShoppingListSelectionModal() {
    shoppingListSelectionModal = document.getElementById('shopping-list-selection-modal');
    
    if (!shoppingListSelectionModal) {
        return;
    }
    
    shoppingListSelectionForm = document.getElementById('shopping-list-selection-form');
    existingShoppingListSelect = document.getElementById('existing-shopping-list');
    shoppingListOptionRadios = Array.from(document.querySelectorAll('input[name="shopping-list-option"]'));
    newShoppingListNameInput = document.getElementById('new-shopping-list-name');
    newShoppingListDescriptionInput = document.getElementById('new-shopping-list-description');
    cancelShoppingListSelectionButton = document.getElementById('cancel-shopping-list-selection');
    
    if (shoppingListSelectionForm) {
        shoppingListSelectionForm.addEventListener('submit', handleShoppingListSelectionSubmit);
    }
    
    shoppingListOptionRadios.forEach((radio) => {
        radio.addEventListener('change', updateShoppingListOptionState);
    });
    
    const closeBtn = shoppingListSelectionModal.querySelector('.close');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeShoppingListSelectionModal);
    }
    
    if (cancelShoppingListSelectionButton) {
        cancelShoppingListSelectionButton.addEventListener('click', (event) => {
            event.preventDefault();
            closeShoppingListSelectionModal();
        });
    }
    
    shoppingListSelectionModal.addEventListener('click', (event) => {
        if (event.target === shoppingListSelectionModal) {
            closeShoppingListSelectionModal();
        }
    });
    
    updateShoppingListOptionState();
}

function openShoppingListSelectionModal(shoppingListData) {
    if (!shoppingListSelectionModal || !shoppingListSelectionForm) {
        // If modal not available, fall back to creating new list immediately
        createShoppingList(shoppingListData);
        return;
    }
    
    pendingShoppingListData = shoppingListData;
    shoppingListSelectionForm.reset();
    
    const hasExistingLists = populateExistingShoppingLists();
    
    if (newShoppingListNameInput) {
        newShoppingListNameInput.value = shoppingListData.listName || '';
    }
    if (newShoppingListDescriptionInput) {
        newShoppingListDescriptionInput.value = shoppingListData.description || '';
    }
    
    if (hasExistingLists) {
        const existingOption = shoppingListOptionRadios.find(radio => radio.value === 'existing');
        if (existingOption) {
            existingOption.checked = true;
        }
    } else {
        shoppingListOptionRadios.forEach(radio => {
            radio.checked = radio.value === 'new';
        });
    }
    
    updateShoppingListOptionState();
    
    shoppingListSelectionModal.classList.add('active');
}

function closeShoppingListSelectionModal() {
    if (shoppingListSelectionModal) {
        shoppingListSelectionModal.classList.remove('active');
    }
    pendingShoppingListData = null;
}

function populateExistingShoppingLists() {
    if (!existingShoppingListSelect) {
        return false;
    }
    
    const shoppingLists = loadExistingShoppingLists();
    existingShoppingListSelect.innerHTML = '';
    
    if (!shoppingLists.length) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No shopping lists available';
        existingShoppingListSelect.appendChild(option);
        existingShoppingListSelect.disabled = true;
        return false;
    }
    
    shoppingLists
        .slice()
        .sort((a, b) => {
            const aDate = a.updatedAt || a.createdAt || '';
            const bDate = b.updatedAt || b.createdAt || '';
            return new Date(bDate).getTime() - new Date(aDate).getTime();
        })
        .forEach(list => {
            const option = document.createElement('option');
            option.value = list.id;
            option.textContent = list.name || `Shopping List (${new Date(list.createdAt || Date.now()).toLocaleDateString()})`;
            existingShoppingListSelect.appendChild(option);
        });
    
    existingShoppingListSelect.disabled = false;
    return true;
}

function getSelectedShoppingListOption() {
    const selectedRadio = shoppingListOptionRadios.find(radio => radio.checked);
    return selectedRadio ? selectedRadio.value : null;
}

function updateShoppingListOptionState() {
    const selectedOption = getSelectedShoppingListOption();
    const hasUsableExistingList = !!existingShoppingListSelect &&
        !existingShoppingListSelect.disabled &&
        existingShoppingListSelect.options.length > 0 &&
        existingShoppingListSelect.value !== '';
    
    const useExisting = selectedOption === 'existing' && hasUsableExistingList;
    
    if (existingShoppingListSelect) {
        existingShoppingListSelect.disabled = !useExisting;
    }
    
    const disableNewInputs = selectedOption !== 'new';
    if (newShoppingListNameInput) {
        newShoppingListNameInput.disabled = disableNewInputs;
    }
    if (newShoppingListDescriptionInput) {
        newShoppingListDescriptionInput.disabled = disableNewInputs;
    }
}

function handleShoppingListSelectionSubmit(event) {
    event.preventDefault();
    
    if (!pendingShoppingListData) {
        showAlert('Unable to add items to a shopping list. Please try again.', { type: 'error' });
        closeShoppingListSelectionModal();
        return;
    }
    
    const option = getSelectedShoppingListOption();
    if (!option) {
        showAlert('Please choose whether to add to an existing list or create a new one.', { type: 'warning' });
        return;
    }
    
    let shoppingLists = loadExistingShoppingLists();
    const timestamp = new Date().toISOString();
    
    if (option === 'existing') {
        const selectedId = existingShoppingListSelect?.value;
        if (!selectedId) {
            showAlert('Please select a shopping list to add to.', { type: 'warning' });
            return;
        }
        
        const numericId = Number(selectedId);
        const targetList = shoppingLists.find(list => list.id === numericId);
        if (!targetList) {
            showAlert('Selected shopping list could not be found. Please try again.', { type: 'error' });
            return;
        }
        
        mergeItemsIntoList(targetList, pendingShoppingListData.items, timestamp);
        targetList.updatedAt = timestamp;
    } else {
        const providedName = (newShoppingListNameInput?.value || '').trim();
        const listName = providedName || pendingShoppingListData.listName;
        
        if (!listName) {
            showAlert('Please provide a name for the new shopping list.', { type: 'warning' });
            return;
        }
        
        const description = (newShoppingListDescriptionInput?.value || '').trim() || pendingShoppingListData.description;
        
        const newList = {
            id: Date.now(),
            name: listName,
            description,
            items: pendingShoppingListData.items.map(item => createShoppingListItem(item, timestamp)),
            createdAt: timestamp,
            updatedAt: timestamp
        };
        
        shoppingLists.push(newList);
    }
    
    if (!saveShoppingListsToStorage(shoppingLists)) {
        showAlert('Error saving shopping list. Please try again.', { type: 'error' });
        return;
    }
    
    closeShoppingListSelectionModal();
    window.location.href = 'shopping-lists.html';
}

function mergeItemsIntoList(list, items, timestamp) {
    if (!Array.isArray(list.items)) {
        list.items = [];
    }
    
    items.forEach(item => {
        const normalizedName = (item.name || '').trim().toLowerCase();
        const normalizedUnit = (item.unit || 'g').trim().toLowerCase();
        const normalizedSection = normalizeStoreSection(item.storeSection);
        const normalizedEmoji = sanitizeEmoji(item.emoji);
        
        const existingItem = list.items.find(existing => 
            (existing.name || '').trim().toLowerCase() === normalizedName &&
            (existing.unit || 'g').trim().toLowerCase() === normalizedUnit &&
            normalizeStoreSection(existing.storeSection) === normalizedSection
        );
        
        if (existingItem) {
            if (typeof existingItem.amount === 'number' && typeof item.amount === 'number') {
                existingItem.amount = Math.round((existingItem.amount + item.amount) * 10) / 10;
            } else if (typeof item.amount === 'number') {
                existingItem.amount = Math.round(item.amount * 10) / 10;
            }
            
            if (item.notes) {
                if (existingItem.notes) {
                    if (!existingItem.notes.includes(item.notes)) {
                        existingItem.notes = `${existingItem.notes}; ${item.notes}`;
                    }
                } else {
                    existingItem.notes = item.notes;
                }
            }
            
            if (normalizedEmoji && !existingItem.emoji) {
                existingItem.emoji = normalizedEmoji;
            }
            
            existingItem.updatedAt = timestamp;
        } else {
            list.items.push(createShoppingListItem({
                ...item,
                storeSection: normalizedSection,
                emoji: normalizedEmoji
            }, timestamp));
        }
    });
}

function createShoppingListItem(item, timestamp) {
    return {
        id: Date.now() + Math.random(),
        name: item.name,
        amount: Math.round((item.amount ?? 0) * 10) / 10,
        unit: item.unit || 'g',
        notes: item.notes,
        storeSection: normalizeStoreSection(item.storeSection),
        emoji: sanitizeEmoji(item.emoji),
        addedAt: timestamp,
        updatedAt: timestamp
    };
}

function loadExistingShoppingLists() {
    try {
        const data = localStorage.getItem('shoppingLists');
        if (!data) {
            return [];
        }
        const parsed = JSON.parse(data);
        if (!Array.isArray(parsed)) {
            return [];
        }
        return parsed.map(list => ({
            ...list,
            items: Array.isArray(list.items)
                ? list.items.map(item => ({
                    ...item,
                    storeSection: normalizeStoreSection(item.storeSection),
                    emoji: sanitizeEmoji(item.emoji)
                }))
                : []
        }));
    } catch (error) {
        console.error('Error loading shopping lists:', error);
        return [];
    }
}

function saveShoppingListsToStorage(shoppingLists) {
    try {
        localStorage.setItem('shoppingLists', JSON.stringify(shoppingLists));
        return true;
    } catch (error) {
        console.error('Error saving shopping lists:', error);
        return false;
    }
}

function createShoppingList(shoppingListData) {
    const timestamp = new Date().toISOString();
    const shoppingLists = loadExistingShoppingLists();
    
    const newList = {
        id: Date.now(),
        name: shoppingListData.listName,
        description: shoppingListData.description,
        items: shoppingListData.items.map(item => createShoppingListItem(item, timestamp)),
        createdAt: timestamp,
        updatedAt: timestamp
    };
    
    shoppingLists.push(newList);
    
    if (!saveShoppingListsToStorage(shoppingLists)) {
        showAlert('Error saving shopping list. Please try again.', { type: 'error' });
        return;
    }
    
    window.location.href = 'shopping-lists.html';
}

function initializePrintOptionsModal() {
    printOptionsModal = document.getElementById('print-options-modal');
    
    if (!printOptionsModal) {
        return;
    }
    
    printOptionsForm = document.getElementById('print-options-form');
    printRecipeSelectionList = printOptionsModal.querySelector('.recipe-selection-list');
    selectAllRecipesCheckbox = document.getElementById('select-all-recipes');
    cancelPrintOptionsButton = document.getElementById('cancel-print-options');
    
    const closeBtn = printOptionsModal.querySelector('.close');
    if (closeBtn) {
        closeBtn.addEventListener('click', closePrintOptionsModal);
    }
    
    if (cancelPrintOptionsButton) {
        cancelPrintOptionsButton.addEventListener('click', (event) => {
            event.preventDefault();
            closePrintOptionsModal();
        });
    }
    
    if (printOptionsForm) {
        printOptionsForm.addEventListener('submit', handlePrintOptionsSubmit);
    }
    
    if (selectAllRecipesCheckbox) {
        selectAllRecipesCheckbox.addEventListener('change', handleSelectAllRecipesChange);
    }
    
    printOptionsModal.addEventListener('click', (event) => {
        if (event.target === printOptionsModal) {
            closePrintOptionsModal();
        }
    });
}

function openPrintOptionsModal() {
    if (!printOptionsModal) {
        printMealPlan();
        return;
    }
    
    const weeklyRecipes = getCurrentWeekRecipesSummary();
    renderPrintRecipeSelectionList(weeklyRecipes);
    
    printOptionsModal.classList.add('active');
}

function closePrintOptionsModal() {
    if (!printOptionsModal) return;
    
    printOptionsModal.classList.remove('active');
}

function getCurrentWeekRecipesSummary() {
    const summaryMap = new Map();
    const week = getWeekDates(currentWeekOffset);
    const recipesList = Array.isArray(window.recipes) ? window.recipes : [];
    
    Object.entries(mealPlan || {}).forEach(([key, items]) => {
        if (!Array.isArray(items) || items.length === 0) return;
        
        const parts = key.split('-');
        if (parts.length < 4) return;
        
        const mealDate = `${parts[0]}-${parts[1]}-${parts[2]}`;
        if (mealDate < week.startDate || mealDate > week.endDate) {
            return;
        }
        
        const mealType = parts.slice(3).join('-');
        
        items.forEach(item => {
            if (!item || item.type !== 'meal') return;
            
            const recipe = recipesList.find(r => r.id === item.id);
            if (!recipe) return;
            
            if (!summaryMap.has(recipe.id)) {
                summaryMap.set(recipe.id, {
                    id: recipe.id,
                    name: recipe.name,
                    category: recipe.category || 'Uncategorized',
                    occurrences: 0,
                    mealTypes: new Set()
                });
            }
            
            const entry = summaryMap.get(recipe.id);
            entry.occurrences += 1;
            if (mealType) {
                const formattedMealType = mealType.charAt(0).toUpperCase() + mealType.slice(1);
                entry.mealTypes.add(formattedMealType);
            }
        });
    });
    
    return Array.from(summaryMap.values())
        .map(entry => ({
            ...entry,
            mealTypes: Array.from(entry.mealTypes).sort((a, b) => a.localeCompare(b))
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

function renderPrintRecipeSelectionList(recipes = []) {
    if (!printRecipeSelectionList) return;
    
    printRecipeSelectionList.innerHTML = '';
    
    const selectAllContainer = selectAllRecipesCheckbox?.closest('.select-all-recipes');
    
    if (!recipes.length) {
        if (selectAllContainer) {
            selectAllContainer.style.display = 'none';
        }
        
        const emptyState = document.createElement('div');
        emptyState.className = 'recipe-selection-empty';
        emptyState.textContent = 'No recipes found on this week\'s meal plan. You can still print the calendar.';
        printRecipeSelectionList.appendChild(emptyState);
        
        if (selectAllRecipesCheckbox) {
            selectAllRecipesCheckbox.checked = false;
            selectAllRecipesCheckbox.indeterminate = false;
            selectAllRecipesCheckbox.disabled = true;
        }
        return;
    }
    
    if (selectAllContainer) {
        selectAllContainer.style.display = 'flex';
    }
    
    recipes.forEach(recipe => {
        const label = document.createElement('label');
        label.className = 'recipe-selection-item';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.name = 'print-recipes';
        checkbox.value = recipe.id;
        checkbox.checked = true;
        checkbox.addEventListener('change', updateSelectAllRecipesState);
        
        const details = document.createElement('div');
        details.className = 'recipe-selection-details';
        
        const nameEl = document.createElement('span');
        nameEl.className = 'recipe-selection-name';
        nameEl.textContent = recipe.name;
        
        const metaEl = document.createElement('span');
        metaEl.className = 'recipe-selection-meta';
        const metaParts = [];
        if (recipe.category) metaParts.push(recipe.category);
        if (recipe.mealTypes && recipe.mealTypes.length) {
            metaParts.push(`Used for ${recipe.mealTypes.join(', ')}`);
        }
        if (recipe.occurrences > 1) {
            metaParts.push(`${recipe.occurrences} times this week`);
        }
        metaEl.textContent = metaParts.join(' • ');
        
        details.appendChild(nameEl);
        if (metaEl.textContent) {
            details.appendChild(metaEl);
        }
        
        label.appendChild(checkbox);
        label.appendChild(details);
        printRecipeSelectionList.appendChild(label);
    });
    
    if (selectAllRecipesCheckbox) {
        selectAllRecipesCheckbox.disabled = false;
        selectAllRecipesCheckbox.checked = true;
        selectAllRecipesCheckbox.indeterminate = false;
    }
    
    updateSelectAllRecipesState();
}

function updateSelectAllRecipesState() {
    if (!selectAllRecipesCheckbox || !printRecipeSelectionList) return;
    
    const checkboxes = Array.from(printRecipeSelectionList.querySelectorAll('input[name="print-recipes"]'));
    if (!checkboxes.length) {
        selectAllRecipesCheckbox.checked = false;
        selectAllRecipesCheckbox.indeterminate = false;
        selectAllRecipesCheckbox.disabled = true;
        return;
    }
    
    const checkedCount = checkboxes.filter(box => box.checked).length;
    selectAllRecipesCheckbox.disabled = false;
    selectAllRecipesCheckbox.checked = checkedCount === checkboxes.length;
    selectAllRecipesCheckbox.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
}

function handleSelectAllRecipesChange(event) {
    if (!printRecipeSelectionList) return;
    const checkboxes = Array.from(printRecipeSelectionList.querySelectorAll('input[name="print-recipes"]'));
    checkboxes.forEach(box => {
        box.checked = event.target.checked;
    });
    updateSelectAllRecipesState();
}

function handlePrintOptionsSubmit(event) {
    event.preventDefault();
    
    if (!printOptionsForm) {
        printMealPlan();
        return;
    }
    
    const formData = new FormData(printOptionsForm);
    const selectedRecipeIds = formData.getAll('print-recipes')
        .map(id => Number(id))
        .filter(id => Number.isInteger(id));
    
    closePrintOptionsModal();
    printMealPlan(selectedRecipeIds);
}

function buildRecipePrintSection(recipe) {
    if (!recipe) return '';
    
    const ingredientsList = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
    const steps = typeof recipe.steps === 'string' ? recipe.steps.trim() : '';
    const nutrition = recipe.nutrition || {};
    
    const totalWeight = ingredientsList.reduce((sum, ingredient) => {
        const amount = parseFloat(ingredient.amount);
        return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);
    const servingSize = parseFloat(recipe.servingSize);
    const servings = Number.isFinite(totalWeight) && Number.isFinite(servingSize) && servingSize > 0
        ? Math.round((totalWeight / servingSize) * 10) / 10
        : null;
    
    const truncatedIngredients = ingredientsList.slice(0, 5).map(ingredient => {
        const amount = parseFloat(ingredient.amount);
        const displayAmount = Number.isFinite(amount) ? `${Math.round(amount * 10) / 10}g` : '';
        const ingredientName = ingredient.name || 'Ingredient';
        return `<li>${ingredientName}${displayAmount ? ` · ${displayAmount}` : ''}</li>`;
    }).join('');
    const moreIngredients = ingredientsList.length > 5 ? `<li>+ ${ingredientsList.length - 5} more</li>` : '';
    
    const stepLines = steps
        ? steps.split(/\r?\n/).map(line => line.trim()).filter(Boolean).slice(0, 2)
        : [];
    const truncatedSteps = stepLines.length
        ? `<p>${stepLines.join('<br>')}</p>`
        : '';
    
    return `
        <article class="print-recipe">
            <header class="print-recipe-header">
                <h2 class="print-recipe-title">${recipe.name}</h2>
                <div class="print-recipe-meta">
                    ${recipe.category ? `<span class="print-recipe-category">${recipe.category}</span>` : ''}
                    ${servings ? `<span class="print-recipe-servings">~${servings} servings</span>` : ''}
                </div>
            </header>
            <div class="print-recipe-summary">
                <div><strong>Cal:</strong> ${Number.isFinite(nutrition.calories) ? nutrition.calories : '—'}</div>
                <div><strong>P:</strong> ${Number.isFinite(nutrition.protein) ? `${nutrition.protein}g` : '—'}</div>
                <div><strong>C:</strong> ${Number.isFinite(nutrition.carbs) ? `${nutrition.carbs}g` : '—'}</div>
                <div><strong>F:</strong> ${Number.isFinite(nutrition.fat) ? `${nutrition.fat}g` : '—'}</div>
            </div>
            <ul class="recipe-ingredient-list">
                ${truncatedIngredients || '<li>No ingredients listed</li>'}
                ${moreIngredients}
            </ul>
            ${truncatedSteps ? `<div class="print-recipe-notes">${truncatedSteps}</div>` : ''}
        </article>
    `;
}

// Print meal plan function
function printMealPlan(selectedRecipeIds = []) {
    console.log('Printing meal plan...');
    
    // Create a print-friendly version of the page
    const printWindow = window.open('', '_blank');
    const week = getWeekDates(currentWeekOffset);
    const startDate = formatDate(week.startDate);
    const endDate = formatDate(week.endDate);
    const generatedDate = new Date().toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
    
    // Get the meal plan grid content
    const mealPlanGrid = document.querySelector('.meal-plan-grid');
    if (!mealPlanGrid) {
        console.error('Meal plan grid not found');
        return;
    }
    
    const recipesToPrint = Array.isArray(selectedRecipeIds)
        ? selectedRecipeIds
            .map(id => (Array.isArray(window.recipes) ? window.recipes.find(r => r.id === id) : null))
            .filter(Boolean)
        : [];
    
    const recipeSectionsHtml = recipesToPrint.map(buildRecipePrintSection).join('\n');
    const hasRecipeSections = recipeSectionsHtml.trim().length > 0;
    
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
                        size: landscape;
                        margin: 0.45in;
                    }
                    @page recipe {
                        size: portrait;
                        margin: 0.5in;
                    }
                }
                
                body {
                    font-family: 'Inter', 'Segoe UI', Tahoma, sans-serif;
                    margin: 0;
                    padding: 0.45in;
                    background: #ffffff;
                    font-size: 10pt;
                    line-height: 1.4;
                    color: #1f2933;
                }
                
                .print-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-end;
                    gap: 16px;
                    margin-bottom: 16px;
                    padding-bottom: 10px;
                    border-bottom: 1px solid #d8dee7;
                }
                
                .print-title h1 {
                    margin: 0;
                    font-size: 18pt;
                    font-weight: 700;
                    letter-spacing: -0.01em;
                    color: #0f172a;
                }
                
                .print-title .print-subtitle {
                    margin: 4px 0 0 0;
                    font-size: 10pt;
                    color: #475569;
                }
                
                .print-meta {
                    text-align: right;
                    font-size: 8.5pt;
                    color: #6b7280;
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }
                
                .meal-plan-grid {
                    width: 100%;
                    border: 1px solid #d8dee7;
                    border-radius: 6px;
                    overflow: hidden;
                    background: #ffffff;
                    display: block;
                    margin: 0;
                }
                
                .meal-plan-grid > * {
                    margin: 0;
                }
                
                .meal-plan-grid > .meal-plan-header,
                .meal-plan-grid > .meal-row,
                .meal-plan-grid > .daily-nutrition-row {
                    display: grid;
                    grid-template-columns: minmax(68px, 0.9fr) repeat(7, minmax(80px, 1fr));
                    align-items: stretch;
                    gap: 0;
                }
                
                .meal-plan-header {
                    background: #eef2f8;
                }
                
                .day-header {
                    font-weight: 600;
                    text-align: center;
                    padding: 6px 4px;
                    font-size: 8.6pt;
                    color: #1f2937;
                    border-right: 1px solid #d8dee7;
                    border-bottom: 1px solid #d8dee7;
                    white-space: pre-line;
                }
                
                .day-header:first-child {
                    text-align: right;
                    background: #f5f7fb;
                }
                
                .day-header:last-child,
                .meal-row > *:last-child,
                .daily-nutrition-row > *:last-child {
                    border-right: none;
                }
                
                .time-slot {
                    background: #f5f7fb;
                    color: #1f2937;
                    font-weight: 600;
                    text-align: right;
                    padding: 6px 5px;
                    border-right: 1px solid #d8dee7;
                    border-bottom: 1px solid #d8dee7;
                    font-size: 8.6pt;
                }
                
                .meal-row > * {
                    border-bottom: 1px solid #d8dee7;
                }
                
                .meal-slot {
                    padding: 5px;
                    border-right: 1px solid #d8dee7;
                    vertical-align: top;
                    background: #ffffff;
                    page-break-inside: avoid;
                    min-height: 72px;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                
                .meal-item {
                    border: 1px solid #d1ede1;
                    background: #f4fcf7;
                    border-radius: 6px;
                    margin-bottom: 4px;
                    padding: 5px 6px;
                    font-size: 8.2pt;
                    color: #1f2937;
                    page-break-inside: avoid;
                }
                
                .meal-item:last-child {
                    margin-bottom: 0;
                }
                
                .meal-item-name {
                    font-weight: 600;
                    margin: 0 0 2px 0;
                    font-size: 8.4pt;
                    word-break: break-word;
                }
                
                .meal-item-details {
                    font-size: 7.8pt;
                    color: #4b5563;
                    display: flex;
                    gap: 6px;
                }
                
                .meal-item-nutrition {
                    font-size: 7.5pt;
                    color: #6b7280;
                    margin-top: 3px;
                }
                
                .meal-item-nutrition span {
                    margin-right: 6px;
                }
                
                .daily-nutrition-row {
                    background: #f8fafc;
                    border-top: 1px solid #d8dee7;
                }
                
                .daily-nutrition-cell {
                    padding: 6px;
                    border-right: 1px solid #d8dee7;
                    border-bottom: 1px solid #d8dee7;
                    font-size: 8.2pt;
                    color: #1f2937;
                    text-align: center;
                }
                
                .daily-nutrition-cell:first-child {
                    font-weight: 600;
                    text-align: right;
                    color: #0b3d25;
                    background: #f5f7fb;
                }
                
                .daily-totals {
                    display: flex;
                    flex-direction: column;
                    gap: 3px;
                }
                
                .daily-calories {
                    font-weight: 700;
                    font-size: 9.4pt;
                    color: #0f172a;
                }
                
                .daily-calories span {
                    color: #15803d;
                }
                
                .daily-macros {
                    font-size: 8pt;
                    color: #4b5563;
                }
                
                .macro-progress-container {
                    display: flex;
                    flex-direction: column;
                    align-items: stretch;
                    gap: 4px;
                    margin-top: 4px;
                }
                
                .macro-progress-item {
                    display: flex;
                    flex-direction: row;
                    align-items: center;
                    justify-content: space-between;
                    min-width: 0;
                    font-size: 7.4pt;
                    color: #4b5563;
                    gap: 6px;
                }
                
                .circular-progress {
                    display: inline-flex;
                    align-items: baseline;
                    justify-content: center;
                    gap: 0.12rem;
                    font-size: 0.78rem;
                    font-weight: 700;
                    color: #111827;
                }
                
                .circular-progress-svg {
                    display: none;
                }
                
                .macro-label {
                    font-size: 0.62rem;
                    color: #0b3d25;
                    font-weight: 600;
                    letter-spacing: 0.03em;
                    margin-top: 0;
                    text-transform: uppercase;
                    white-space: nowrap;
                }
                
                .print-recipes {
                    margin-top: 24px;
                    column-count: 2;
                    column-gap: 16px;
                    page-break-before: always;
                    page: recipe;
                }
                
                .print-recipes-title {
                    column-span: all;
                    font-size: 14pt;
                    margin: 0 0 10px 0;
                    color: #0f172a;
                    font-weight: 600;
                }
                
                .print-recipe {
                    display: inline-block;
                    width: 100%;
                    border: 1px solid #d8dee7;
                    border-radius: 6px;
                    padding: 10px;
                    margin: 0 0 12px;
                    background: #ffffff;
                    page-break-inside: avoid;
                    break-inside: avoid-column;
                    font-size: 8pt;
                    color: #1f2937;
                }
                
                .print-recipe-header {
                    margin-bottom: 6px;
                }
                
                .print-recipe-title {
                    margin: 0;
                    font-size: 11pt;
                    color: #0f172a;
                    font-weight: 600;
                }
                
                .print-recipe-meta {
                    display: flex;
                    gap: 6px;
                    flex-wrap: wrap;
                    font-size: 7.4pt;
                    color: #4b5563;
                    margin-top: 2px;
                }
                
                .print-recipe-category {
                    background: rgba(76, 175, 80, 0.16);
                    color: #065f46;
                    padding: 1px 6px;
                    border-radius: 999px;
                    font-weight: 600;
                    font-size: 7pt;
                    text-transform: uppercase;
                }
                
                .print-recipe-summary {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(80px, 1fr));
                    gap: 4px;
                    background: #f4f8f6;
                    border: 1px solid #d1ede1;
                    border-radius: 6px;
                    padding: 8px;
                    margin-bottom: 6px;
                }
                
                .recipe-ingredient-list {
                    margin: 0;
                    padding-left: 14px;
                    font-size: 7.6pt;
                    color: #1f2937;
                }
                
                .recipe-ingredient-list li {
                    margin-bottom: 2px;
                }
                
                .print-recipe-notes {
                    font-size: 7.2pt;
                    color: #6b7280;
                }
                
                .empty-slot {
                    background: #f8fafc;
                    min-height: 38px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 7.6pt;
                    color: #94a3b8;
                    font-style: italic;
                    border-radius: 4px;
                    border: 1px dashed #d8dee7;
                }
            </style>
        </head>
        <body>
            <div class="print-header">
                <div class="print-title">
                    <h1>Meal Plan</h1>
                    <p class="print-subtitle">Week of ${startDate} - ${endDate}</p>
                </div>
                <div class="print-meta">
                    <span>${generatedDate}</span>
                    ${window.settings?.profile?.name ? `<span>${window.settings.profile.name}</span>` : ''}
                </div>
            </div>
            ${mealPlanGrid.outerHTML}
            ${hasRecipeSections ? `
                <div class="print-recipes">
                    <h1 class="print-recipes-title">Recipes</h1>
                    ${recipeSectionsHtml}
                </div>
            ` : ''}
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
        
        const totalsHeadingCell = printWindow.document.querySelector('.daily-nutrition-row .daily-nutrition-cell');
        if (totalsHeadingCell && !totalsHeadingCell.textContent.trim()) {
            totalsHeadingCell.textContent = 'Daily Totals';
        }
        
        // Trigger print
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 500);
    };
}
