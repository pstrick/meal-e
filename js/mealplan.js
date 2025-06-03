// Meal Planning functionality
let currentWeek = new Date();
let selectedSlot = null;
const mealPlanModal = document.getElementById('meal-plan-modal');
const mealPlanForm = document.getElementById('meal-plan-form');
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
    selectedSlot = slot;
    const recipeSelect = document.getElementById('meal-recipe');
    recipeSelect.innerHTML = '<option value="">Select a recipe...</option>';
    
    // Populate recipe options
    recipes.forEach(recipe => {
        const option = document.createElement('option');
        option.value = recipe.id;
        option.textContent = recipe.name;
        recipeSelect.appendChild(option);
    });

    mealPlanModal.classList.add('active');
}

function closeMealPlanModal() {
    mealPlanModal.classList.remove('active');
    selectedSlot = null;
    mealPlanForm.reset();
}

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
        if (confirm('Remove this meal from the plan?')) {
            div.remove();
            saveMealPlan();
            updateNutritionSummary();
        }
    });

    return div;
}

function getMealKey(date, mealType) {
    return `${date.toISOString().split('T')[0]}-${mealType}`;
}

function saveMealPlan() {
    const week = getWeekDates(currentWeek);
    const mealSlots = document.querySelectorAll('.meal-slot');
    
    mealSlots.forEach(slot => {
        const day = slot.dataset.day;
        const meal = slot.dataset.meal;
        const dayDate = week.dates[['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].indexOf(day)];
        const key = getMealKey(dayDate, meal);
        
        const meals = [];
        slot.querySelectorAll('.meal-item').forEach(item => {
            const recipeId = item.dataset.recipeId;
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
}

function loadMealPlan() {
    const week = getWeekDates(currentWeek);
    const mealSlots = document.querySelectorAll('.meal-slot');
    
    mealSlots.forEach(slot => {
        slot.innerHTML = '';
        const day = slot.dataset.day;
        const meal = slot.dataset.meal;
        const dayDate = week.dates[['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].indexOf(day)];
        const key = getMealKey(dayDate, meal);
        
        const meals = mealPlan[key] || [];
        meals.forEach(mealData => {
            const recipe = recipes.find(r => r.id === mealData.recipeId);
            if (recipe) {
                const mealItem = createMealItem(recipe, mealData.servings);
                mealItem.dataset.recipeId = recipe.id;
                mealItem.dataset.servings = mealData.servings;
                slot.appendChild(mealItem);
            }
        });
    });

    updateNutritionSummary();
}

function calculateDayNutrition(date) {
    const nutrition = {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0
    };

    ['breakfast', 'lunch', 'dinner', 'snacks'].forEach(mealType => {
        const key = getMealKey(date, mealType);
        const meals = mealPlan[key] || [];
        
        meals.forEach(mealData => {
            const recipe = recipes.find(r => r.id === mealData.recipeId);
            if (recipe && recipe.nutrition) {
                nutrition.calories += recipe.nutrition.calories * mealData.servings;
                nutrition.protein += recipe.nutrition.protein * mealData.servings;
                nutrition.carbs += recipe.nutrition.carbs * mealData.servings;
                nutrition.fat += recipe.nutrition.fat * mealData.servings;
            }
        });
    });

    return nutrition;
}

function updateNutritionSummary() {
    const week = getWeekDates(currentWeek);
    const nutritionGrid = document.querySelector('.nutrition-grid');
    nutritionGrid.innerHTML = '';

    week.dates.forEach(date => {
        const nutrition = calculateDayNutrition(date);
        const dayDiv = document.createElement('div');
        dayDiv.className = 'day-nutrition';
        dayDiv.innerHTML = `
            <h4>${formatDate(date)}</h4>
            <div class="nutrition-value">Calories: ${Math.round(nutrition.calories)}</div>
            <div class="nutrition-value">Protein: ${Math.round(nutrition.protein)}g</div>
            <div class="nutrition-value">Carbs: ${Math.round(nutrition.carbs)}g</div>
            <div class="nutrition-value">Fat: ${Math.round(nutrition.fat)}g</div>
        `;
        nutritionGrid.appendChild(dayDiv);
    });
}

// Event Listeners
document.querySelectorAll('.meal-slot').forEach(slot => {
    slot.addEventListener('click', () => openMealPlanModal(slot));
});

mealPlanForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const recipeId = document.getElementById('meal-recipe').value;
    const servings = parseFloat(document.getElementById('meal-servings').value);
    const recipe = recipes.find(r => r.id === parseInt(recipeId));
    
    if (recipe && selectedSlot) {
        const mealItem = createMealItem(recipe, servings);
        mealItem.dataset.recipeId = recipe.id;
        mealItem.dataset.servings = servings;
        selectedSlot.appendChild(mealItem);
        saveMealPlan();
        updateNutritionSummary();
    }
    
    closeMealPlanModal();
});

cancelMeal.addEventListener('click', closeMealPlanModal);
document.querySelectorAll('#meal-plan-modal .close').forEach(btn => {
    btn.addEventListener('click', closeMealPlanModal);
});

prevWeekBtn.addEventListener('click', () => {
    currentWeek.setDate(currentWeek.getDate() - 7);
    updateWeekDisplay();
});

nextWeekBtn.addEventListener('click', () => {
    currentWeek.setDate(currentWeek.getDate() + 7);
    updateWeekDisplay();
});

// Initialize the meal planner
updateWeekDisplay(); 