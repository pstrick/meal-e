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

// Initialize meal plan data structure
const mealPlan = JSON.parse(localStorage.getItem('meale-mealPlan')) || {};

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

function loadMealPlan() {
    console.log('Loading meal plan...');
    const week = getWeekDates(currentWeekOffset);
    
    // Find or create the container
    let mealPlanContainer = document.querySelector('.meal-plan-container');
    if (!mealPlanContainer) {
        mealPlanContainer = document.createElement('div');
        mealPlanContainer.className = 'meal-plan-container';
        const oldGrid = document.querySelector('.meal-plan-grid');
        if (oldGrid) {
            oldGrid.parentNode.replaceChild(mealPlanContainer, oldGrid);
        }
    }
    
    // Create or get the grid
    let mealPlanGrid = mealPlanContainer.querySelector('.meal-plan-grid');
    if (!mealPlanGrid) {
        mealPlanGrid = document.createElement('div');
        mealPlanGrid.className = 'meal-plan-grid';
        mealPlanContainer.appendChild(mealPlanGrid);
    }
    
    const isMobile = window.innerWidth <= 768;

    if (!mealPlanGrid) {
        console.error('Meal plan grid not found!');
        return;
    }

    console.log('Current week:', week);
    console.log('Is mobile:', isMobile);

    // Clear existing content
    mealPlanGrid.innerHTML = '';

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
        week.dayNames.forEach((dayName, index) => {
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
            week.dates.forEach((dateStr, index) => {
                const mealSlot = document.createElement('div');
                mealSlot.className = 'meal-slot';
                mealSlot.dataset.day = week.dayNames[index].toLowerCase();
                mealSlot.dataset.meal = mealType;
                mealSlot.dataset.date = dateStr;
                bodyContainer.appendChild(mealSlot);
            });
        });
        
        mealPlanGrid.appendChild(bodyContainer);
    } else {
        // Mobile layout
        const bodyContainer = document.createElement('div');
        bodyContainer.className = 'meal-plan-body';
        
        // Create a column for each day
        week.dates.forEach((dateStr, index) => {
            const dayColumn = document.createElement('div');
            dayColumn.className = 'day-column';
            
            // Add day header
            const dayHeader = document.createElement('div');
            dayHeader.className = 'day-header';
            const dayName = week.dayNames[index];
            const date = new Date(dateStr);
            const dayDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            dayHeader.textContent = `${dayName}, ${dayDate}`;
            dayColumn.appendChild(dayHeader);
            
            // Add meal slots
            ['breakfast', 'lunch', 'dinner', 'snacks'].forEach(mealType => {
                const timeSlot = document.createElement('div');
                timeSlot.className = 'time-slot';
                timeSlot.textContent = mealType.charAt(0).toUpperCase() + mealType.slice(1);
                dayColumn.appendChild(timeSlot);
                
                const mealSlot = document.createElement('div');
                mealSlot.className = 'meal-slot';
                mealSlot.dataset.day = dayName.toLowerCase();
                mealSlot.dataset.meal = mealType;
                mealSlot.dataset.date = dateStr;
                dayColumn.appendChild(mealSlot);
            });
            
            bodyContainer.appendChild(dayColumn);
        });
        
        mealPlanGrid.appendChild(bodyContainer);
    }

    // Load meals into slots
    const mealSlots = document.querySelectorAll('.meal-slot');
    console.log('Found meal slots:', mealSlots.length);

    mealSlots.forEach(slot => {
        const date = slot.dataset.date;
        const meal = slot.dataset.meal;
        const key = getMealKey(date, meal);
        
        console.log('Processing slot:', { date, meal, key });
        
        // Clear existing content
        slot.innerHTML = '';
        
        const meals = mealPlan[key] || [];
        
        // Add meals to the slot
        meals.forEach(mealData => {
            const recipe = window.recipes.find(r => r.id === mealData.recipeId);
            if (recipe) {
                const mealItem = createMealItem(recipe, mealData.servings);
                mealItem.dataset.recipeId = recipe.id;
                mealItem.dataset.servings = mealData.servings;
                slot.appendChild(mealItem);
            }
        });
        
        // Add the "Add Meal" button
        addAddMealButton(slot);
    });

    updateNutritionSummary();
    console.log('Meal plan loaded');
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
    console.log('Updating nutrition summary...');
    const week = getWeekDates(currentWeekOffset);
    
    // Calculate daily totals and weekly average
    const dailyTotals = [];
    const weeklyTotals = {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0
    };

    // Calculate daily totals
    week.dates.forEach(date => {
        const nutrition = calculateDayNutrition(date);
        dailyTotals.push(nutrition);
        
        weeklyTotals.calories += nutrition.calories;
        weeklyTotals.protein += nutrition.protein;
        weeklyTotals.carbs += nutrition.carbs;
        weeklyTotals.fat += nutrition.fat;
    });

    // Calculate daily averages
    const dailyAverage = {
        calories: weeklyTotals.calories / 7,
        protein: weeklyTotals.protein / 7,
        carbs: weeklyTotals.carbs / 7,
        fat: weeklyTotals.fat / 7
    };

    // Update the totals row in the meal plan table
    const mealPlanTable = document.querySelector('.meal-plan-grid');
    
    // Remove existing totals rows if they exist
    const existingTotals = mealPlanTable.querySelectorAll('.totals-row, .average-row');
    existingTotals.forEach(row => row.remove());

    // Create daily totals row
    const totalsRow = document.createElement('div');
    totalsRow.className = 'totals-row';
    
    // Add label cell
    const labelCell = document.createElement('div');
    labelCell.className = 'time-slot';
    labelCell.textContent = 'Daily Totals';
    totalsRow.appendChild(labelCell);

    // Add daily total cells
    dailyTotals.forEach(nutrition => {
        const totalCell = document.createElement('div');
        totalCell.className = 'daily-total';
        totalCell.innerHTML = `
            <div class="total-calories">${Math.round(nutrition.calories)} cal</div>
            <div class="total-macros">
                <span class="macro-total">P: ${Math.round(nutrition.protein)}g</span>
                <span class="macro-total">C: ${Math.round(nutrition.carbs)}g</span>
                <span class="macro-total">F: ${Math.round(nutrition.fat)}g</span>
            </div>
        `;
        totalsRow.appendChild(totalCell);
    });

    // Create average row
    const averageRow = document.createElement('div');
    averageRow.className = 'average-row';
    
    // Add label cell
    const avgLabelCell = document.createElement('div');
    avgLabelCell.className = 'time-slot';
    avgLabelCell.textContent = 'Daily Average';
    averageRow.appendChild(avgLabelCell);

    // Add average cell that spans all days
    const avgCell = document.createElement('div');
    avgCell.className = 'weekly-average-cell';
    avgCell.innerHTML = `
        <div class="total-calories">${Math.round(dailyAverage.calories)} cal</div>
        <div class="total-macros">
            <span class="macro-total">P: ${Math.round(dailyAverage.protein)}g</span>
            <span class="macro-total">C: ${Math.round(dailyAverage.carbs)}g</span>
            <span class="macro-total">F: ${Math.round(dailyAverage.fat)}g</span>
        </div>
    `;
    averageRow.appendChild(avgCell);

    // Add the rows to the meal plan table
    mealPlanTable.appendChild(totalsRow);
    mealPlanTable.appendChild(averageRow);
}

// Remove the old event listeners for meal slots since we're handling clicks on the buttons directly
document.querySelectorAll('.meal-slot').forEach(slot => {
    slot.removeEventListener('click', () => {});
});

// Export the initialization function
export function initializeMealPlanner() {
    console.log('Initializing meal planner...');
    
    // Wait for recipes to be available
    const checkRecipes = setInterval(() => {
        if (window.recipes && Array.isArray(window.recipes)) {
            console.log('Recipes loaded, proceeding with initialization');
            clearInterval(checkRecipes);
            continueInitialization();
        }
    }, 100);

    // Timeout after 5 seconds
    setTimeout(() => {
        clearInterval(checkRecipes);
        if (!window.recipes || !Array.isArray(window.recipes)) {
            console.error('Recipes not properly loaded after timeout');
        }
    }, 5000);
}

// Continue initialization after recipes are loaded
function continueInitialization() {
    console.log('Available recipes:', window.recipes.length);
    
    // Verify settings are loaded
    if (!window.settings) {
        console.error('Settings not properly loaded');
        return;
    }
    
    console.log('Using settings for meal planner:', window.settings);
    
    // Reset week offset to ensure we start from current week
    currentWeekOffset = 0;
    
    // Initialize the meal planner with current settings
    const week = getWeekDates();
    console.log('Initial week dates:', week);
    
    // Update the week display
    updateWeekDisplay();
    
    // Load the meal plan
    loadMealPlan();
    
    // Ensure modal is properly initialized
    if (!mealPlanModal) {
        console.error('Meal plan modal not found!');
        return;
    }

    // Initialize form and its elements
    const oldForm = mealPlanForm;
    if (oldForm) {
        // Remove old event listeners by cloning
        const newForm = oldForm.cloneNode(true);
        oldForm.parentNode.replaceChild(newForm, oldForm);
        mealPlanForm = newForm;

        // Store the current slot in a data attribute
        mealPlanForm.addEventListener('submit', (e) => {
            console.log('Form submit event triggered');
            console.log('Current slot when submitting:', selectedSlot);
            handleMealPlanSubmit(e);
        });

        // Reattach event listeners to form elements
        const recipeSearch = mealPlanForm.querySelector('#recipe-search');
        const categoryFilter = mealPlanForm.querySelector('#meal-category-filter');
        const cancelButton = mealPlanForm.querySelector('#cancel-meal');

        if (recipeSearch) {
            recipeSearch.addEventListener('input', () => {
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

prevWeekBtn.addEventListener('click', () => {
    currentWeekOffset--;
    updateWeekDisplay();
    updateNutritionSummary();
});

nextWeekBtn.addEventListener('click', () => {
    currentWeekOffset++;
    updateWeekDisplay();
    updateNutritionSummary();
});

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

// Initialize search handlers when the page loads
document.addEventListener('DOMContentLoaded', () => {
    initializeSearchHandlers();
});

// Add window resize handler to reload meal plan when switching between mobile and desktop
let lastIsMobile = window.innerWidth <= 768;
window.addEventListener('resize', () => {
    const isMobile = window.innerWidth <= 768;
    if (isMobile !== lastIsMobile) {
        lastIsMobile = isMobile;
        loadMealPlan();
    }
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