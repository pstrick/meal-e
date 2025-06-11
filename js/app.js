import config from './config.js';
import { version } from './version.js';
import './mealplan.js';
import { initializeMealPlanner } from './mealplan.js';

// Update version in footer
document.querySelector('footer p').innerHTML = `&copy; ${version.year} Meal-E <span class="version">v${version.toString()}</span>`;

// Add version number styling
const versionStyle = document.createElement('style');
versionStyle.textContent = `
    .version {
        font-size: 0.9em;
        color: #666;
        margin-left: 1rem;
    }
`;
document.head.appendChild(versionStyle);

// DOM Elements
const navLinks = document.querySelectorAll('nav a');
const sections = document.querySelectorAll('.section');
const addRecipeBtn = document.getElementById('add-recipe');
const recipeList = document.getElementById('recipe-list');
const recipeModal = document.getElementById('recipe-modal');
const recipeForm = document.getElementById('recipe-form');
const closeModal = document.querySelector('.close');
const cancelRecipe = document.getElementById('cancel-recipe');
const addIngredientBtn = document.getElementById('add-ingredient');
const ingredientsList = document.getElementById('ingredients-list');
const categoryFilter = document.getElementById('recipe-category-filter');
const ingredientSearchModal = document.getElementById('ingredient-search-modal');
const ingredientSearchInput = document.getElementById('ingredient-search');
const searchBtn = document.getElementById('search-btn');
const searchResults = document.getElementById('search-results');
const totalCalories = document.getElementById('total-calories');
const totalProtein = document.getElementById('total-protein');
const totalCarbs = document.getElementById('total-carbs');
const totalFat = document.getElementById('total-fat');

// Sample data structure
let recipes = [];
let mealPlan = {};
let settings = {
    mealPlanStartDay: 0 // Default to Sunday
};
let nutritionData = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0
};

// Current state
let currentIngredientInput = null;
let selectedIngredients = new Map(); // Maps ingredient IDs to their nutrition data

// Navigation
navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('href').substring(1);
        
        // Update active states
        navLinks.forEach(l => l.classList.remove('active'));
        sections.forEach(s => s.classList.remove('active'));
        
        link.classList.add('active');
        document.getElementById(targetId).classList.add('active');
    });
});

// Modal Management
function openModal() {
    recipeModal.classList.add('active');
    // Add first ingredient input if none exists
    if (ingredientsList.children.length === 0) {
        addIngredientInput();
    }
    // Initialize nutrition display
    updateTotalNutrition();
}

function closeModalHandler() {
    recipeModal.classList.remove('active');
    recipeForm.reset();
    ingredientsList.innerHTML = '';
}

// USDA API Functions

// Helper function to normalize and stem words
function normalizeSearchTerm(term) {
    // Basic stemming rules
    return term.toLowerCase()
        .replace(/(\w+)ing\b/, '$1')    // running -> run
        .replace(/(\w+)s\b/, '$1')      // eggs -> egg
        .replace(/(\w+)es\b/, '$1')     // dishes -> dish
        .replace(/(\w+)ed\b/, '$1')     // cooked -> cook
        .trim();
}

// Helper function to calculate relevancy score
function calculateRelevancyScore(foodDesc, searchTerms) {
    const description = foodDesc.toLowerCase();
    const normalizedDesc = description.split(/[,()]/).map(part => part.trim());
    let score = 0;

    // Normalize search terms
    const normalizedTerms = searchTerms.map(term => normalizeSearchTerm(term));
    
    // Core term matching (first part of description)
    const mainTerm = normalizedDesc[0];
    for (const term of normalizedTerms) {
        // Exact match of main term
        if (normalizeSearchTerm(mainTerm) === term) {
            score += 100;
        }
        // Main term starts with search term
        else if (normalizeSearchTerm(mainTerm).startsWith(term)) {
            score += 50;
        }
        // Main term contains search term
        else if (normalizeSearchTerm(mainTerm).includes(term)) {
            score += 25;
        }
    }

    // Penalize for complexity and processing terms
    const complexityPenalty = description.split(/[,()]/).length * 5;
    const processingTerms = [
        'prepared', 'processed', 'mixed', 'enriched', 'fortified',
        'preserved', 'canned', 'packaged', 'with added'
    ];
    const processingPenalty = processingTerms.some(term => description.includes(term)) ? 20 : 0;

    // Prefer raw/basic ingredients
    const rawBonus = description.includes('raw') ? 15 : 0;
    const basicBonus = normalizedDesc.length === 1 ? 10 : 0;

    // Calculate final score
    const finalScore = score + rawBonus + basicBonus - complexityPenalty - processingPenalty;

    return finalScore;
}

async function searchIngredients(query) {
    const params = new URLSearchParams({
        api_key: config.USDA_API_KEY,
        query: query,
        dataType: ['Survey (FNDDS)', 'Foundation', 'SR Legacy'].join(','),
        pageSize: 25,
        nutrients: [208, 203, 204, 205].join(',') // Request specific nutrients
    });

    try {
        const response = await fetch(`${config.USDA_API_BASE_URL}/foods/search?${params}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        if (!data || !data.foods) {
            console.error('Invalid response format:', data);
            return [];
        }

        console.log('Search results with nutrition:', data.foods);
        return data.foods;
    } catch (error) {
        console.error('Error searching ingredients:', error);
        throw error;
    }
}

async function getFoodDetails(fdcId) {
    const params = new URLSearchParams({
        api_key: config.USDA_API_KEY,
        nutrients: [208, 203, 204, 205].join(',') // Request specific nutrients
    });

    try {
        const response = await fetch(`${config.USDA_API_BASE_URL}/food/${fdcId}?${params}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('Raw API Response:', JSON.stringify(data, null, 2));
        return data;
    } catch (error) {
        console.error('Error getting food details:', error);
        return null;
    }
}

// Modified Nutrition Calculations
function calculateNutritionPerGram(foodData) {
    console.log('Calculating nutrition for food:', foodData.description);
    
    // First try foodNutrients array
    let nutrients = foodData.foodNutrients;
    
    // If no nutrients found, try looking in the nutrientData object
    if (!nutrients || nutrients.length === 0) {
        nutrients = [];
        if (foodData.nutrientData) {
            for (let nutrientId in foodData.nutrientData) {
                nutrients.push({
                    nutrientId: parseInt(nutrientId),
                    amount: foodData.nutrientData[nutrientId].amount,
                    unitName: foodData.nutrientData[nutrientId].unit
                });
            }
        }
    }

    console.log('Found nutrients:', nutrients);

    const nutrition = {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0
    };

    if (!nutrients || nutrients.length === 0) {
        console.error('No nutrients found in food data');
        return nutrition;
    }

    nutrients.forEach(nutrient => {
        // Handle different API response formats
        const id = nutrient.nutrientId || nutrient.nutrient?.id || nutrient.number;
        const amount = nutrient.amount || nutrient.value || 0;

        console.log('Processing nutrient:', {
            id: id,
            amount: amount,
            unit: nutrient.unitName || nutrient.unit
        });

        // Convert to number if it's a string
        const numericId = typeof id === 'string' ? parseInt(id) : id;

        switch (numericId) {
            case 208:   // Energy (kcal)
            case 1008:  // Energy (kcal)
                nutrition.calories = amount / 100; // Convert to per gram
                break;
            case 203:   // Protein
            case 1003:  // Protein
                nutrition.protein = amount / 100;
                break;
            case 204:   // Total Fat
            case 1004:  // Total Fat
                nutrition.fat = amount / 100;
                break;
            case 205:   // Carbohydrates
            case 1005:  // Carbohydrates
                nutrition.carbs = amount / 100;
                break;
        }
    });

    console.log('Final calculated nutrition (per gram):', nutrition);
    return nutrition;
}

function updateTotalNutrition() {
    const totalWeight = calculateTotalWeight();
    const servingSize = parseFloat(document.getElementById('recipe-serving-size').value) || totalWeight;
    const numberOfServings = Math.round((totalWeight / servingSize) * 10) / 10; // Round to 1 decimal

    let totals = {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0
    };

    // Get all ingredient inputs
    const ingredientItems = ingredientsList.querySelectorAll('.ingredient-item');
    
    ingredientItems.forEach(item => {
        const fdcId = item.querySelector('.ingredient-name').dataset.fdcId;
        const amount = parseFloat(item.querySelector('.ingredient-amount').value) || 0;
        
        if (fdcId && selectedIngredients.has(fdcId)) {
            const ingredient = selectedIngredients.get(fdcId);
            if (ingredient && ingredient.nutrition) {
                totals.calories += ingredient.nutrition.calories * amount;
                totals.protein += ingredient.nutrition.protein * amount;
                totals.carbs += ingredient.nutrition.carbs * amount;
                totals.fat += ingredient.nutrition.fat * amount;
            }
        }
    });

    // Calculate per-serving values based on serving size
    const perServing = {
        calories: Math.round(totals.calories * (servingSize / totalWeight)),
        protein: Math.round(totals.protein * (servingSize / totalWeight)),
        carbs: Math.round(totals.carbs * (servingSize / totalWeight)),
        fat: Math.round(totals.fat * (servingSize / totalWeight))
    };

    // Update display
    document.getElementById('total-calories').textContent = perServing.calories;
    document.getElementById('total-protein').textContent = perServing.protein;
    document.getElementById('total-carbs').textContent = perServing.carbs;
    document.getElementById('total-fat').textContent = perServing.fat;
    document.getElementById('recipe-servings').textContent = numberOfServings;
}

function calculateTotalWeight() {
    let totalWeight = 0;
    const ingredientItems = ingredientsList.querySelectorAll('.ingredient-item');
    
    ingredientItems.forEach(item => {
        const amount = parseFloat(item.querySelector('.ingredient-amount').value) || 0;
        totalWeight += amount;
    });

    return totalWeight;
}

// Update serving size when ingredients change
function updateServingSizeDefault() {
    const totalWeight = calculateTotalWeight();
    const servingSizeInput = document.getElementById('recipe-serving-size');
    if (!servingSizeInput.value) {
        servingSizeInput.value = totalWeight;
    }
    updateTotalNutrition();
}

// Modified Recipe Card Creation
function createRecipeCard(recipe) {
    const card = document.createElement('div');
    card.className = 'macro-card recipe-card';
    
    const ingredients = recipe.ingredients
        .map(ing => `${ing.name} (${ing.amount}g)`)
        .join(', ');

    const totalWeight = recipe.ingredients.reduce((sum, ing) => sum + ing.amount, 0);
    const numberOfServings = Math.round((totalWeight / recipe.servingSize) * 10) / 10;

    card.innerHTML = `
        <span class="recipe-category">${recipe.category}</span>
        <h3>${recipe.name}</h3>
        <p class="recipe-servings">Serving Size: ${recipe.servingSize}g (Makes ${numberOfServings} servings)</p>
        <p class="recipe-ingredients">
            <strong>Ingredients:</strong><br>
            ${ingredients}
        </p>
        <p class="recipe-nutrition">
            <strong>Per Serving (${recipe.servingSize}g):</strong><br>
            Calories: ${recipe.nutrition.calories} |
            Protein: ${recipe.nutrition.protein}g |
            Carbs: ${recipe.nutrition.carbs}g |
            Fat: ${recipe.nutrition.fat}g
        </p>
        <div class="card-actions">
            <button class="btn" onclick="editRecipe(${recipe.id})">Edit</button>
            <button class="btn btn-secondary" onclick="deleteRecipe(${recipe.id})">Delete</button>
        </div>
    `;
    return card;
}

async function handleRecipeSubmit(e, editId = null) {
    e.preventDefault();

    // Validate that we have at least one ingredient
    if (selectedIngredients.size === 0) {
        alert('Please add at least one ingredient to your recipe');
        return;
    }

    // Validate required fields
    const name = document.getElementById('recipe-name').value.trim();
    const servingSize = parseFloat(document.getElementById('recipe-serving-size').value);
    const category = document.getElementById('recipe-category').value;
    
    if (!name || !servingSize || servingSize <= 0) {
        alert('Please fill in all required fields');
        return;
    }

    // Gather ingredients with their nutrition data
    const ingredients = Array.from(ingredientsList.children)
        .map(item => {
            const fdcId = item.querySelector('.ingredient-name').dataset.fdcId;
            const ingredientData = selectedIngredients.get(fdcId);
            if (!ingredientData) return null;
            
            return {
                fdcId: fdcId,
                name: ingredientData.name,
                amount: parseFloat(item.querySelector('.ingredient-amount').value) || 0,
                nutrition: ingredientData.nutrition
            };
        })
        .filter(ing => ing !== null && ing.amount > 0);

    const totalWeight = ingredients.reduce((sum, ing) => sum + ing.amount, 0);

    // Calculate nutrition per serving size
    const totalNutrition = {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0
    };

    ingredients.forEach(ing => {
        if (ing.nutrition && ing.amount) {
            totalNutrition.calories += ing.nutrition.calories * ing.amount;
            totalNutrition.protein += ing.nutrition.protein * ing.amount;
            totalNutrition.carbs += ing.nutrition.carbs * ing.amount;
            totalNutrition.fat += ing.nutrition.fat * ing.amount;
        }
    });

    const newRecipe = {
        id: editId || Date.now(),
        name: name,
        category: category,
        servingSize: servingSize,
        ingredients: ingredients,
        nutrition: {
            calories: Math.round(totalNutrition.calories * (servingSize / totalWeight)),
            protein: Math.round(totalNutrition.protein * (servingSize / totalWeight)),
            carbs: Math.round(totalNutrition.carbs * (servingSize / totalWeight)),
            fat: Math.round(totalNutrition.fat * (servingSize / totalWeight))
        }
    };

    try {
        if (editId) {
            // Update existing recipe
            const index = recipes.findIndex(r => r.id === editId);
            if (index !== -1) {
                recipes[index] = newRecipe;
            }
        } else {
            // Add new recipe
            recipes.push(newRecipe);
        }
        
        updateRecipeList();
        saveToLocalStorage();
        closeModalHandler();
        selectedIngredients.clear();
        
        // Reset form handler
        recipeForm.onsubmit = (e) => handleRecipeSubmit(e);
    } catch (error) {
        console.error('Error saving recipe:', error);
        alert('There was an error saving your recipe. Please try again.');
    }
}

// Local Storage Management
function saveToLocalStorage() {
    localStorage.setItem('recipes', JSON.stringify(recipes));
    localStorage.setItem('mealPlan', JSON.stringify(mealPlan));
    localStorage.setItem('settings', JSON.stringify(settings));
    localStorage.setItem('meale-nutrition', JSON.stringify(nutritionData));
    // Update global recipes
    window.recipes = recipes;
}

function loadFromLocalStorage() {
    const savedRecipes = localStorage.getItem('recipes');
    if (savedRecipes) {
        recipes = JSON.parse(savedRecipes);
        // Make recipes available globally
        window.recipes = recipes;
    }

    const savedMealPlan = localStorage.getItem('mealPlan');
    if (savedMealPlan) {
        mealPlan = JSON.parse(savedMealPlan);
    }

    const savedSettings = localStorage.getItem('settings');
    if (savedSettings) {
        settings = JSON.parse(savedSettings);
        // Apply saved settings
        document.getElementById('meal-plan-start-day').value = settings.mealPlanStartDay;
    }

    const savedNutrition = localStorage.getItem('meale-nutrition');
    if (savedNutrition) {
        nutritionData = JSON.parse(savedNutrition);
    }

    updateRecipeList();
}

// Initialize settings
function initializeSettings() {
    console.log('Initializing settings...');
    const startDaySelect = document.getElementById('meal-plan-start-day');
    
    // Load settings from localStorage
    const savedSettings = localStorage.getItem('meale-settings');
    if (savedSettings) {
        settings = JSON.parse(savedSettings);
        console.log('Loaded settings from localStorage:', settings);
    } else {
        settings = { mealPlanStartDay: 0 };
        console.log('Using default settings:', settings);
    }
    
    // Make settings available globally
    window.settings = settings;
    
    // Set the select value
    startDaySelect.value = settings.mealPlanStartDay;
    console.log('Set start day select to:', settings.mealPlanStartDay);
    
    startDaySelect.addEventListener('change', () => {
        settings.mealPlanStartDay = parseInt(startDaySelect.value);
        saveToLocalStorage();
        // Make settings available globally
        window.settings = settings;
        console.log('Updated settings:', settings);
        // Reset week offset to current week
        if (typeof currentWeekOffset !== 'undefined') {
            currentWeekOffset = 0;
        }
        // Refresh the meal plan view to reflect the new start day
        if (typeof updateWeekDisplay === 'function') {
            updateWeekDisplay();
        }
    });
}

// Initialize the application
function initializeApp() {
    console.log('Initializing app...');
    loadFromLocalStorage();
    initializeSettings();
    updateRecipeList();
    
    // Initialize meal planner after settings are loaded
    console.log('Initializing meal planner...');
    initializeMealPlanner();
}

// Initialize when the DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp);

// Recipe Management
function editRecipe(id) {
    const recipe = recipes.find(r => r.id === id);
    if (!recipe) return;

    // Clear existing form
    recipeForm.reset();
    ingredientsList.innerHTML = '';
    selectedIngredients.clear();

    // Fill in basic recipe info
    document.getElementById('recipe-name').value = recipe.name;
    document.getElementById('recipe-category').value = recipe.category;
    document.getElementById('recipe-serving-size').value = recipe.servingSize;

    // Add ingredients
    recipe.ingredients.forEach(ing => {
        const ingredientItem = document.createElement('div');
        ingredientItem.className = 'ingredient-item';
        ingredientItem.innerHTML = `
            <div class="ingredient-main">
                <input type="text" class="ingredient-name" placeholder="Search for ingredient" required readonly value="${ing.name}">
                <input type="number" class="ingredient-amount" placeholder="Grams" min="0" step="0.1" required value="${ing.amount}">
                <button type="button" class="remove-ingredient">&times;</button>
            </div>
            <div class="ingredient-macros">
                <span class="macro-item">Cal: <span class="calories">0</span></span>
                <span class="macro-item">P: <span class="protein">0</span>g</span>
                <span class="macro-item">C: <span class="carbs">0</span>g</span>
                <span class="macro-item">F: <span class="fat">0</span>g</span>
            </div>
        `;

        const nameInput = ingredientItem.querySelector('.ingredient-name');
        const amountInput = ingredientItem.querySelector('.ingredient-amount');
        
        // Store the ingredient data
        nameInput.dataset.fdcId = ing.fdcId;
        selectedIngredients.set(ing.fdcId, {
            name: ing.name,
            amount: ing.amount,
            nutrition: ing.nutrition
        });

        // Add event listeners
        nameInput.addEventListener('click', () => openIngredientSearch(ingredientItem));
        amountInput.addEventListener('input', () => {
            const fdcId = nameInput.dataset.fdcId;
            if (fdcId && selectedIngredients.has(fdcId)) {
                const ingredient = selectedIngredients.get(fdcId);
                ingredient.amount = parseFloat(amountInput.value) || 0;
                selectedIngredients.set(fdcId, ingredient);
                updateIngredientMacros(ingredientItem, ingredient);
                updateServingSizeDefault();
            }
        });

        ingredientItem.querySelector('.remove-ingredient').addEventListener('click', () => {
            if (ingredientsList.children.length > 1) {
                const fdcId = nameInput.dataset.fdcId;
                if (fdcId) {
                    selectedIngredients.delete(fdcId);
                    updateServingSizeDefault();
                }
                ingredientItem.remove();
            }
        });

        ingredientsList.appendChild(ingredientItem);
        updateIngredientMacros(ingredientItem, ing);
    });

    // Update form handler
    recipeForm.onsubmit = (e) => handleRecipeSubmit(e, id);
    
    // Show modal
    recipeModal.classList.add('active');
    updateTotalNutrition();
}

// Make edit and delete functions globally available
window.editRecipe = editRecipe;
window.deleteRecipe = deleteRecipe;

// Add some CSS for the new search result styling
const style = document.createElement('style');
style.textContent = `
    .search-result-item .details {
        color: #666;
        font-weight: normal;
    }
    .no-results {
        padding: 1rem;
        text-align: center;
        color: #666;
    }
`;
document.head.appendChild(style);

// Ingredient Search Functions
function openIngredientSearch(ingredientInput) {
    currentIngredientInput = ingredientInput;
    ingredientSearchModal.classList.add('active');
    ingredientSearchInput.value = '';
    ingredientSearchInput.focus();
}

function closeIngredientSearch() {
    ingredientSearchModal.classList.remove('active');
    searchResults.innerHTML = '';
}

// Modified Ingredient Search Result Handler
async function displaySearchResults(results) {
    searchResults.innerHTML = '';
    
    if (results.length === 0) {
        searchResults.innerHTML = '<div class="no-results">No matching ingredients found</div>';
        return;
    }
    
    for (const food of results) {
        const div = document.createElement('div');
        div.className = 'search-result-item';
        
        const [mainName, ...details] = food.description.split(',');
        div.innerHTML = `
            <h4>${mainName}${details.length > 0 ? ',' : ''}<span class="details">${details.join(',')}</span></h4>
            <p>${food.brandOwner || 'Generic'}</p>
        `;
        
        div.addEventListener('click', async () => {
            try {
                const details = await getFoodDetails(food.fdcId);
                if (details) {
                    const nutrition = calculateNutritionPerGram(details);
                    const amount = parseFloat(currentIngredientInput.querySelector('.ingredient-amount').value) || 0;
                    
                    // Store nutrition data with the ingredient
                    const ingredientData = {
                        name: food.description,
                        amount: amount,
                        nutrition: nutrition
                    };
                    selectedIngredients.set(food.fdcId.toString(), ingredientData);
                    
                    // Update the input field
                    currentIngredientInput.querySelector('.ingredient-name').value = food.description;
                    currentIngredientInput.querySelector('.ingredient-name').dataset.fdcId = food.fdcId.toString();
                    
                    // Update ingredient macros
                    updateIngredientMacros(currentIngredientInput, ingredientData);
                    
                    // Update nutrition display
                    updateTotalNutrition();
                    closeIngredientSearch();
                }
            } catch (error) {
                console.error('Error getting food details:', error);
                alert('Error getting food details. Please try again.');
            }
        });
        
        searchResults.appendChild(div);
    }
}

// Modified Ingredient Input Handler
function addIngredientInput() {
    const ingredientItem = document.createElement('div');
    ingredientItem.className = 'ingredient-item';
    ingredientItem.innerHTML = `
        <div class="ingredient-main">
            <input type="text" class="ingredient-name" placeholder="Search for ingredient" required readonly>
            <input type="number" class="ingredient-amount" placeholder="Grams" min="0" step="0.1" required value="0">
            <button type="button" class="remove-ingredient">&times;</button>
        </div>
        <div class="ingredient-macros">
            <span class="macro-item">Cal: <span class="calories">0</span></span>
            <span class="macro-item">P: <span class="protein">0</span>g</span>
            <span class="macro-item">C: <span class="carbs">0</span>g</span>
            <span class="macro-item">F: <span class="fat">0</span>g</span>
        </div>
    `;

    const nameInput = ingredientItem.querySelector('.ingredient-name');
    const amountInput = ingredientItem.querySelector('.ingredient-amount');

    nameInput.addEventListener('click', () => openIngredientSearch(ingredientItem));
    
    // Update nutrition and serving size when amount changes
    amountInput.addEventListener('input', () => {
        const fdcId = nameInput.dataset.fdcId;
        if (fdcId && selectedIngredients.has(fdcId)) {
            const ingredient = selectedIngredients.get(fdcId);
            ingredient.amount = parseFloat(amountInput.value) || 0;
            selectedIngredients.set(fdcId, ingredient);
            updateIngredientMacros(ingredientItem, ingredient);
            updateServingSizeDefault();
        }
    });

    ingredientItem.querySelector('.remove-ingredient').addEventListener('click', () => {
        if (ingredientsList.children.length > 1) {
            const fdcId = nameInput.dataset.fdcId;
            if (fdcId) {
                selectedIngredients.delete(fdcId);
                updateServingSizeDefault();
            }
            ingredientItem.remove();
        }
    });

    ingredientsList.appendChild(ingredientItem);
}

function updateIngredientMacros(ingredientItem, ingredient) {
    const amount = parseFloat(ingredient.amount) || 0;
    const macros = {
        calories: Math.round(ingredient.nutrition.calories * amount),
        protein: Math.round(ingredient.nutrition.protein * amount),
        carbs: Math.round(ingredient.nutrition.carbs * amount),
        fat: Math.round(ingredient.nutrition.fat * amount)
    };

    ingredientItem.querySelector('.calories').textContent = macros.calories;
    ingredientItem.querySelector('.protein').textContent = macros.protein;
    ingredientItem.querySelector('.carbs').textContent = macros.carbs;
    ingredientItem.querySelector('.fat').textContent = macros.fat;
}

// Add styles for the macro display
const macroStyles = document.createElement('style');
macroStyles.textContent = `
    .ingredient-item {
        margin-bottom: 1rem;
    }
    .ingredient-main {
        display: grid;
        grid-template-columns: 2fr 1fr auto;
        gap: 0.5rem;
        margin-bottom: 0.25rem;
    }
    .ingredient-macros {
        display: flex;
        gap: 1rem;
        font-size: 0.9em;
        color: #666;
        padding-left: 0.5rem;
        margin-top: 0.25rem;
    }
    .macro-item {
        background: #f5f5f5;
        padding: 0.2rem 0.5rem;
        border-radius: 4px;
    }
`;
document.head.appendChild(macroStyles);

// Event Listeners
addRecipeBtn.addEventListener('click', openModal);
closeModal.addEventListener('click', closeModalHandler);
cancelRecipe.addEventListener('click', closeModalHandler);
addIngredientBtn.addEventListener('click', addIngredientInput);
recipeForm.addEventListener('submit', handleRecipeSubmit);
categoryFilter.addEventListener('change', updateRecipeList);
searchBtn.addEventListener('click', async () => {
    const query = ingredientSearchInput.value.trim();
    if (query) {
        searchResults.innerHTML = '<div class="loading">Searching...</div>';
        try {
            const results = await searchIngredients(query);
            displaySearchResults(results);
        } catch (error) {
            console.error('Error searching ingredients:', error);
            searchResults.innerHTML = '<div class="error">Error searching ingredients. Please try again.</div>';
        }
    }
});
ingredientSearchInput.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        searchBtn.click();
    }
});

// Close buttons for all modals
document.querySelectorAll('.modal .close').forEach(closeBtn => {
    closeBtn.addEventListener('click', (event) => {
        const modal = event.target.closest('.modal');
        if (modal.id === 'recipe-modal') {
            closeModalHandler();
        } else if (modal.id === 'ingredient-search-modal') {
            closeIngredientSearch();
        } else if (modal.id === 'meal-plan-modal' && window.closeMealPlanModal) {
            window.closeMealPlanModal();
        }
    });
});

// Close modal when clicking outside
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            if (modal.id === 'recipe-modal') {
                closeModalHandler();
            } else if (modal.id === 'ingredient-search-modal') {
                closeIngredientSearch();
            } else if (modal.id === 'meal-plan-modal' && window.closeMealPlanModal) {
                window.closeMealPlanModal();
            }
        }
    });
});

// Modified Recipe Management
function addRecipe(recipe) {
    // Ensure the recipe has all required properties
    const validatedRecipe = {
        id: recipe.id,
        name: recipe.name,
        category: recipe.category,
        servingSize: recipe.servingSize,
        ingredients: recipe.ingredients,
        nutrition: recipe.nutrition || {
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0
        }
    };

    recipes.push(validatedRecipe);
    updateRecipeList();
    saveToLocalStorage();
}

function deleteRecipe(id) {
    if (confirm('Are you sure you want to delete this recipe?')) {
        recipes = recipes.filter(recipe => recipe.id !== id);
        updateRecipeList();
        saveToLocalStorage();
    }
}

function updateRecipeList() {
    recipeList.innerHTML = '';
    const selectedCategory = categoryFilter.value;
    
    const filteredRecipes = selectedCategory === 'all' 
        ? recipes 
        : recipes.filter(recipe => recipe.category === selectedCategory);

    filteredRecipes.forEach(recipe => {
        recipeList.appendChild(createRecipeCard(recipe));
    });
}

// Make recipes available globally for other modules
window.recipes = recipes;
window.addRecipe = addRecipe;
window.editRecipe = editRecipe;
window.deleteRecipe = deleteRecipe; 