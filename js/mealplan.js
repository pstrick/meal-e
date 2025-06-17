// Meal Planning functionality
let currentWeekOffset = 0;  // Track week offset instead of modifying date directly
let selectedSlot = null;
let selectedRecipe = null;
let mealPlanForm = document.getElementById('meal-plan-form');
const mealPlanModal = document.getElementById('meal-plan-modal');
const cancelMeal = document.getElementById('cancel-meal');
const weekDisplay = document.getElementById('week-display');
const prevWeekBtn = document.getElementById('prev-week');
const nextWeekBtn = document.getElementById('next-week');

// Initialize meal plan data
let mealPlan = {};

// Get week dates based on current week and start day setting
function getWeekDates(weekOffset = 0) {
    // Get settings from localStorage if not available globally
    if (!window.settings) {
        const savedSettings = localStorage.getItem('meale-settings');
        window.settings = savedSettings ? JSON.parse(savedSettings) : { mealPlanStartDay: 0 };
        console.log('Loaded settings in getWeekDates:', window.settings);
    }
    
    const startDay = parseInt(window.settings.mealPlanStartDay);
    console.log('Using start day from settings:', startDay);
    
    const today = new Date();
    const currentDay = today.getDay();
    console.log('Current day of week:', currentDay);
    
    // Calculate days to start of week
    const daysToStart = (currentDay - startDay + 7) % 7;
    console.log('Days to start of week:', daysToStart);
    
    // Calculate start date of the week
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - daysToStart + (weekOffset * 7));
    console.log('Start date:', startDate);
    
    // Generate dates for the week
    const dates = [];
    const dayNames = [];
    for (let i = 0; i < 7; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
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
    selectedRecipe = null;
    
    // Reset the form and filters
    if (!mealPlanForm) {
        console.error('Meal plan form not found');
        return;
    }
    
    const recipeSearch = mealPlanForm.querySelector('#recipe-search');
    const categoryFilter = mealPlanForm.querySelector('#meal-category-filter');
    const servingsInput = mealPlanForm.querySelector('#meal-servings');
    const selectedRecipeDiv = mealPlanForm.querySelector('.selected-recipe');
    const submitButton = mealPlanForm.querySelector('button[type="submit"]');
    
    if (recipeSearch) recipeSearch.value = '';
    if (categoryFilter) categoryFilter.value = 'all';
    if (servingsInput) servingsInput.value = '1';
    if (selectedRecipeDiv) selectedRecipeDiv.style.display = 'none';
    if (submitButton) submitButton.disabled = true;
    
    // Store the slot reference in a data attribute
    mealPlanForm.dataset.currentSlot = `${slot.dataset.day}-${slot.dataset.meal}`;
    console.log('Stored slot reference:', mealPlanForm.dataset.currentSlot);
    
    // Clear any selected recipes in the list
    mealPlanForm.querySelectorAll('.recipe-option.selected').forEach(option => {
        option.classList.remove('selected');
    });
    
    // Make sure modal is visible
    mealPlanModal.style.display = 'block';
    mealPlanModal.classList.add('active');

    // Load all recipes immediately
    updateRecipeList();
}

function updateRecipeList() {
    const recipeList = document.querySelector('.recipe-list');
    const searchTerm = document.getElementById('recipe-search').value.toLowerCase().trim();
    const category = document.getElementById('meal-category-filter').value;
    
    // Ensure recipes are available
    if (!window.recipes || !Array.isArray(window.recipes)) {
        console.error('Recipes not available:', window.recipes);
        recipeList.innerHTML = '<div class="recipe-option">No recipes available</div>';
        return;
    }

    console.log('Available recipes:', window.recipes);
    
    // Filter recipes based on search term and category
    const filteredRecipes = window.recipes.filter(recipe => {
        const matchesSearch = searchTerm === '' || 
            recipe.name.toLowerCase().includes(searchTerm) ||
            recipe.ingredients.some(ing => ing.name.toLowerCase().includes(searchTerm));
        const matchesCategory = category === 'all' || recipe.category === category;
        return matchesSearch && matchesCategory;
    });
    
    // Clear the current list
    recipeList.innerHTML = '';
    
    if (filteredRecipes.length === 0) {
        recipeList.innerHTML = `
            <div class="recipe-option no-results">
                ${searchTerm ? 'No recipes found matching "' + searchTerm + '"' : 'No recipes found'}
                ${category !== 'all' ? ' in category "' + category + '"' : ''}
            </div>`;
        return;
    }
    
    // Add filtered recipes to the list
    filteredRecipes.forEach(recipe => {
        const div = document.createElement('div');
        div.className = 'recipe-option';
        if (selectedRecipe && selectedRecipe.id === recipe.id) {
            div.classList.add('selected');
        }
        
        const ingredients = recipe.ingredients
            .map(ing => ing.name)
            .slice(0, 3)
            .join(', ') + (recipe.ingredients.length > 3 ? '...' : '');
        
        div.innerHTML = `
            <h4>${recipe.name}</h4>
            <div class="recipe-meta">
                <span class="category">${recipe.category}</span> • 
                <span class="calories">${recipe.nutrition.calories} cal</span> • 
                <span class="protein">${recipe.nutrition.protein}g protein</span>
            </div>
            <div class="ingredients">
                <small>${ingredients}</small>
            </div>
        `;
        
        div.addEventListener('click', () => selectRecipe(recipe));
        recipeList.appendChild(div);
    });
}

function selectRecipe(recipe) {
    console.log('Selecting recipe:', recipe);
    selectedRecipe = recipe;
    
    // Get elements from the form
    const selectedRecipeDiv = mealPlanForm.querySelector('.selected-recipe');
    const submitButton = mealPlanForm.querySelector('button[type="submit"]');
    
    if (!selectedRecipeDiv || !submitButton) {
        console.error('Required elements not found in the form');
        return;
    }
    
    // Update selected recipe display
    selectedRecipeDiv.style.display = 'block';
    selectedRecipeDiv.querySelector('.recipe-name').textContent = recipe.name;
    selectedRecipeDiv.querySelector('.calories').textContent = recipe.nutrition.calories;
    selectedRecipeDiv.querySelector('.protein').textContent = recipe.nutrition.protein;
    selectedRecipeDiv.querySelector('.carbs').textContent = recipe.nutrition.carbs;
    selectedRecipeDiv.querySelector('.fat').textContent = recipe.nutrition.fat;
    
    // Enable submit button and ensure it's visible
    submitButton.disabled = false;
    submitButton.style.display = 'block';
    console.log('Submit button enabled:', submitButton);
    
    // Update recipe list selection
    const recipeList = mealPlanForm.querySelector('.recipe-list');
    if (recipeList) {
        recipeList.querySelectorAll('.recipe-option').forEach(option => {
            option.classList.remove('selected');
            if (option.querySelector('h4').textContent === recipe.name) {
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
    selectedRecipe = null;
    
    // Reset form if it exists
    if (mealPlanForm) {
        mealPlanForm.reset();
        const selectedRecipeDiv = mealPlanForm.querySelector('.selected-recipe');
        const submitButton = mealPlanForm.querySelector('button[type="submit"]');
        if (selectedRecipeDiv) selectedRecipeDiv.style.display = 'none';
        if (submitButton) submitButton.disabled = true;
    }
}

// Make closeMealPlanModal available globally
window.closeMealPlanModal = closeMealPlanModal;

function createMealItem(recipe, servings) {
    const div = document.createElement('div');
    div.className = 'meal-item';
    div.innerHTML = `
        <span class="remove-meal">&times;</span>
        <div class="recipe-name">${recipe.name}</div>
        <div class="servings">${servings} serving${servings === 1 ? '' : 's'}</div>
    `;

    div.querySelector('.remove-meal').addEventListener('click', (e) => {
        e.stopPropagation();
        const mealSlot = div.closest('.meal-slot');
        if (!mealSlot) {
            console.error('Could not find parent meal slot');
            return;
        }
        
        // Remove the meal item
        div.remove();
        
        // Add the "Add Meal" button if it doesn't exist
        addAddMealButton(mealSlot);
        
        // Save changes and update nutrition
        saveMealPlan();
        updateNutritionSummary();
    });

    return div;
}

function getMealKey(date, mealType) {
    return `${date}-${mealType}`;
}

function saveMealPlan() {
    console.log('Saving meal plan...');
    const mealSlots = document.querySelectorAll('.meal-slot');
    
    mealSlots.forEach(slot => {
        const date = slot.dataset.date;
        const meal = slot.dataset.meal;
        const key = `${date}-${meal}`;
        
        const meals = [];
        slot.querySelectorAll('.meal-item').forEach(item => {
            const recipeId = parseInt(item.dataset.recipeId);
            const servings = parseFloat(item.dataset.servings);
            if (recipeId && servings) {
                meals.push({ recipeId, servings });
            }
        });
        
        if (meals.length > 0) {
            mealPlan[key] = meals;
        } else {
            delete mealPlan[key];
        }
    });

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

function calculateDayNutrition(date) {
    console.log('Calculating nutrition for date:', date);
    const nutrition = {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0
    };

    ['breakfast', 'lunch', 'dinner', 'snacks'].forEach(mealType => {
        const key = getMealKey(date, mealType);
        const meals = mealPlan[key] || [];
        console.log(`Meals for ${mealType}:`, meals);
        
        meals.forEach(mealData => {
            const recipe = window.recipes.find(r => r.id === mealData.recipeId);
            if (recipe && recipe.nutrition) {
                nutrition.calories += recipe.nutrition.calories * mealData.servings;
                nutrition.protein += recipe.nutrition.protein * mealData.servings;
                nutrition.carbs += recipe.nutrition.carbs * mealData.servings;
                nutrition.fat += recipe.nutrition.fat * mealData.servings;
            }
        });
    });

    console.log('Calculated nutrition:', nutrition);
    return nutrition;
}

function updateNutritionSummary() {
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
        let totalCost = 0;

        week.dates.forEach(date => {
            const dayNutrition = calculateDayNutrition(date);
            totalCalories += dayNutrition.calories;
            totalProtein += dayNutrition.protein;
            totalCarbs += dayNutrition.carbs;
            totalFat += dayNutrition.fat;
            totalCost += dayNutrition.cost;
        });

        // Update the summary display
        nutritionSummary.innerHTML = `
            <h3>Weekly Summary</h3>
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
                <div class="nutrition-item">
                    <span class="label">Total Cost:</span>
                    <span class="value">$${totalCost.toFixed(2)}</span>
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
        // Load meal plan
        await loadMealPlan();
        
        // Initialize week navigation
        initializeWeekNavigation();
        
        // Initialize search handlers
        initializeSearchHandlers();
        
        console.log('Meal planner initialized successfully');
    } catch (error) {
        console.error('Error continuing initialization:', error);
    }
}

function handleMealPlanSubmit(e) {
    console.log('Form submission triggered');
    e.preventDefault();
    
    // Find the current slot using the stored reference
    if (!selectedRecipe) {
        console.error('No recipe selected');
        return;
    }
    
    if (!selectedSlot) {
        console.error('No slot selected');
        // Try to recover the slot reference
        const slotRef = mealPlanForm.dataset.currentSlot;
        if (slotRef) {
            const [day, meal] = slotRef.split('-');
            selectedSlot = document.querySelector(`.meal-slot[data-day="${day}"][data-meal="${meal}"]`);
            console.log('Recovered slot reference:', selectedSlot);
        }
    }
    
    if (!selectedSlot) {
        console.error('Could not recover slot reference');
        return;
    }
    
    const servingsInput = mealPlanForm.querySelector('#meal-servings');
    if (!servingsInput) {
        console.error('Servings input not found');
        return;
    }
    
    const servings = parseFloat(servingsInput.value);
    console.log('Creating meal item with:', { recipe: selectedRecipe, servings, slot: selectedSlot });
    
    const mealItem = createMealItem(selectedRecipe, servings);
    mealItem.dataset.recipeId = selectedRecipe.id;
    mealItem.dataset.servings = servings;
    
    // Remove the "Add Meal" button if it exists
    const addButton = selectedSlot.querySelector('.add-meal-btn');
    if (addButton) {
        addButton.remove();
    }
    
    // Append the new meal item
    selectedSlot.appendChild(mealItem);
    
    // Add the "Add Meal" button back
    addAddMealButton(selectedSlot);
    
    // Save and update nutrition
    saveMealPlan();
    updateNutritionSummary();
    
    closeMealPlanModal();
}

// Helper function to create and add the "Add Meal" button
function addAddMealButton(slot) {
    if (!slot) {
        console.error('Cannot add button to null slot');
        return;
    }
    
    // Only add if there isn't already an add button
    if (!slot.querySelector('.add-meal-btn')) {
        const addButton = document.createElement('button');
        addButton.className = 'add-meal-btn';
        addButton.innerHTML = '<i class="fas fa-plus"></i> Add Meal';
        addButton.addEventListener('click', function(e) {
            e.stopPropagation();
            // Use the parent slot element as the reference
            const mealSlot = this.closest('.meal-slot');
            if (mealSlot) {
                openMealPlanModal(mealSlot);
            } else {
                console.error('Could not find parent meal slot');
            }
        });
        slot.appendChild(addButton);
    }
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
        prevWeekBtn.addEventListener('click', () => {
            currentWeekOffset--;
            updateWeekDisplay();
            updateNutritionSummary();
        });
    }
    
    if (nextWeekBtn) {
        nextWeekBtn.addEventListener('click', () => {
            currentWeekOffset++;
            updateWeekDisplay();
            updateNutritionSummary();
        });
    }
}

// Initialize search handlers when the page loads
document.addEventListener('DOMContentLoaded', () => {
    initializeSearchHandlers();
    initializeWeekNavigation();
});

// Update meal plan display
function updateMealPlanDisplay() {
    const week = getWeekDates(currentWeekOffset);
    
    // Update week display
    const startDateStr = new Date(week.startDate).toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric'
    });
    const endDateStr = new Date(week.endDate).toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric'
    });
    document.getElementById('week-display').textContent = `Week of ${startDateStr} - ${endDateStr}`;
    
    // Clear existing meal plan grid
    const mealPlanGrid = document.querySelector('.meal-plan-grid');
    mealPlanGrid.innerHTML = '';
    
    // Get device type
    const isMobile = window.innerWidth <= 768;
    
    if (!isMobile) {
        // Desktop layout
        // Add header row
        const headerRow = document.createElement('div');
        headerRow.className = 'meal-plan-header';
        
        // Add empty cell for time slots
        const emptyCell = document.createElement('div');
        emptyCell.className = 'day-header';
        headerRow.appendChild(emptyCell);
        
        // Add day headers
        week.dayNames.forEach(dayName => {
            const dayHeader = document.createElement('div');
            dayHeader.className = 'day-header';
            dayHeader.textContent = dayName;
            headerRow.appendChild(dayHeader);
        });
        
        mealPlanGrid.appendChild(headerRow);
        
        // Create body container
        const bodyContainer = document.createElement('div');
        bodyContainer.className = 'meal-plan-body';
        
        // Add time slots
        ['breakfast', 'lunch', 'dinner', 'snacks'].forEach(mealType => {
            const timeSlot = document.createElement('div');
            timeSlot.className = 'time-slot';
            timeSlot.textContent = mealType.charAt(0).toUpperCase() + mealType.slice(1);
            bodyContainer.appendChild(timeSlot);
            
            // Add meal slots for each day
            week.dates.forEach((date, index) => {
                const mealSlot = document.createElement('div');
                mealSlot.className = 'meal-slot';
                const dayName = week.dayNames[index].toLowerCase();
                mealSlot.dataset.day = dayName;
                mealSlot.dataset.meal = mealType;
                mealSlot.dataset.date = date;
                
                // Add meals for this slot
                const key = `${date}-${mealType}`;
                const meals = mealPlan[key] || [];
                
                meals.forEach(mealData => {
                    const recipe = window.recipes.find(r => r.id === mealData.recipeId);
                    if (recipe) {
                        const mealItem = createMealItem(recipe, mealData.servings);
                        mealItem.dataset.recipeId = recipe.id;
                        mealItem.dataset.servings = mealData.servings;
                        mealSlot.appendChild(mealItem);
                    }
                });
                
                // Add the "Add Meal" button
                addAddMealButton(mealSlot);
                
                bodyContainer.appendChild(mealSlot);
            });
        });
        
        mealPlanGrid.appendChild(bodyContainer);
    } else {
        // Mobile layout
        const bodyContainer = document.createElement('div');
        bodyContainer.className = 'meal-plan-body';
        
        // Create a column for each day
        week.dates.forEach((date, index) => {
            const dayColumn = document.createElement('div');
            dayColumn.className = 'day-column';
            
            // Add day header
            const dayHeader = document.createElement('div');
            dayHeader.className = 'day-header';
            dayHeader.textContent = week.dayNames[index];
            dayColumn.appendChild(dayHeader);
            
            // Add meal slots
            ['breakfast', 'lunch', 'dinner', 'snacks'].forEach(mealType => {
                const timeSlot = document.createElement('div');
                timeSlot.className = 'time-slot';
                timeSlot.textContent = mealType.charAt(0).toUpperCase() + mealType.slice(1);
                dayColumn.appendChild(timeSlot);
                
                const mealSlot = document.createElement('div');
                mealSlot.className = 'meal-slot';
                const dayName = week.dayNames[index].toLowerCase();
                mealSlot.dataset.day = dayName;
                mealSlot.dataset.meal = mealType;
                mealSlot.dataset.date = date;
                
                // Add meals for this slot
                const key = `${date}-${mealType}`;
                const meals = mealPlan[key] || [];
                
                meals.forEach(mealData => {
                    const recipe = window.recipes.find(r => r.id === mealData.recipeId);
                    if (recipe) {
                        const mealItem = createMealItem(recipe, mealData.servings);
                        mealItem.dataset.recipeId = recipe.id;
                        mealItem.dataset.servings = mealData.servings;
                        mealSlot.appendChild(mealItem);
                    }
                });
                
                // Add the "Add Meal" button
                addAddMealButton(mealSlot);
                
                dayColumn.appendChild(mealSlot);
            });
            
            bodyContainer.appendChild(dayColumn);
        });
        
        mealPlanGrid.appendChild(bodyContainer);
    }
    
    // Update nutrition summary
    updateNutritionSummary();
}

// Add debounced search
let searchTimeout;
function initializeSearchHandlers() {
    const searchInput = document.getElementById('recipe-search');
    const categoryFilter = document.getElementById('meal-category-filter');
    
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                updateRecipeList();
            }, 300); // Debounce for 300ms
        });
    }
    
    if (categoryFilter) {
        categoryFilter.addEventListener('change', updateRecipeList);
    }
} 