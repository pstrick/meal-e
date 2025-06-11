// Meal Planning functionality
let currentWeek = new Date();
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

function getWeekDates(date) {
    const monday = new Date(date);
    monday.setDate(date.getDate() - date.getDay() + 1);
    
    const week = {
        start: monday,
        dates: []
    };

    for (let i = 0; i < 7; i++) {
        const day = new Date(monday);
        day.setDate(monday.getDate() + i);
        week.dates.push(day);
    }

    return week;
}

function formatDate(date) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function updateWeekDisplay() {
    const week = getWeekDates(currentWeek);
    weekDisplay.textContent = `Week of ${formatDate(week.start)}`;
    loadMealPlan();
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
    return `${date.toISOString().split('T')[0]}-${mealType}`;
}

function saveMealPlan() {
    console.log('Saving meal plan...');
    const week = getWeekDates(currentWeek);
    const mealSlots = document.querySelectorAll('.meal-slot');
    
    mealSlots.forEach(slot => {
        const day = slot.dataset.day;
        const meal = slot.dataset.meal;
        const dayDate = week.dates[['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].indexOf(day)];
        const key = getMealKey(dayDate, meal);
        
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

    localStorage.setItem('meale-mealPlan', JSON.stringify(mealPlan));
    console.log('Meal plan saved:', mealPlan);
}

function loadMealPlan() {
    console.log('Loading meal plan...');
    const week = getWeekDates(currentWeek);
    
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
        week.dates.forEach(date => {
            const dayHeader = document.createElement('div');
            dayHeader.className = 'day-header';
            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
            const dayDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            dayHeader.innerHTML = `${dayName}<br>${dayDate}`;
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
            week.dates.forEach(date => {
                const mealSlot = document.createElement('div');
                mealSlot.className = 'meal-slot';
                const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
                mealSlot.dataset.day = dayName;
                mealSlot.dataset.meal = mealType;
                bodyContainer.appendChild(mealSlot);
            });
        });
        
        mealPlanGrid.appendChild(bodyContainer);
    } else {
        // Mobile layout
        const bodyContainer = document.createElement('div');
        bodyContainer.className = 'meal-plan-body';
        
        // Create a column for each day
        week.dates.forEach(date => {
            const dayColumn = document.createElement('div');
            dayColumn.className = 'day-column';
            
            // Add day header
            const dayHeader = document.createElement('div');
            dayHeader.className = 'day-header';
            const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
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
                const slotDayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
                mealSlot.dataset.day = slotDayName;
                mealSlot.dataset.meal = mealType;
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
        const day = slot.dataset.day;
        const meal = slot.dataset.meal;
        const dayIndex = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
            .indexOf(day);
        const dayDate = week.dates[dayIndex];
        const key = getMealKey(dayDate, meal);
        
        console.log('Processing slot:', { day, meal, key });
        
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
    const week = getWeekDates(currentWeek);
    
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

// Initialize modals and event listeners when the page loads AND recipes are available
function initializeMealPlanner() {
    console.log('Initializing meal planner...');
    
    // Verify recipes are loaded correctly
    if (!window.recipes || !Array.isArray(window.recipes)) {
        console.error('Recipes not properly loaded:', window.recipes);
        return;
    }
    
    console.log('Available recipes:', window.recipes.length);
    
    // Initialize the meal planner
    updateWeekDisplay();
    loadMealPlan();
    
    // Ensure modal is properly initialized
    if (!mealPlanModal) {
        console.error('Meal plan modal not found!');
        return;
    }

    // Initialize form and its elements
    const oldForm = document.getElementById('meal-plan-form');
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

        if (cancelButton) {
            cancelButton.addEventListener('click', closeMealPlanModal);
        }

        // Ensure the submit button is properly set up
        const submitButton = mealPlanForm.querySelector('button[type="submit"]');
        if (submitButton) {
            submitButton.disabled = true;
            console.log('Submit button initialized:', submitButton);
        }
    }

    // Handle modal close buttons
    const closeButtons = document.querySelectorAll('#meal-plan-modal .close');
    closeButtons.forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', closeMealPlanModal);
    });

    // Add click outside modal to close
    mealPlanModal.addEventListener('click', (event) => {
        if (event.target === mealPlanModal) {
            closeMealPlanModal();
        }
    });
    
    console.log('Meal planner initialization complete');
}

// Wait for both DOM content and recipes to be loaded
document.addEventListener('DOMContentLoaded', () => {
    // Check if recipes are already available
    if (window.recipes) {
        initializeMealPlanner();
    } else {
        // If recipes aren't available yet, wait for them
        const checkRecipes = setInterval(() => {
            if (window.recipes) {
                clearInterval(checkRecipes);
                initializeMealPlanner();
            }
        }, 100);
        
        // Stop checking after 5 seconds to prevent infinite loop
        setTimeout(() => {
            clearInterval(checkRecipes);
            console.error('Timeout waiting for recipes to load');
        }, 5000);
    }
});

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
    currentWeek.setDate(currentWeek.getDate() - 7);
    updateWeekDisplay();
    updateNutritionSummary();
});

nextWeekBtn.addEventListener('click', () => {
    currentWeek.setDate(currentWeek.getDate() + 7);
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