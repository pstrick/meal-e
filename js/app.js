import config from './config.js';
import { version } from './version.js';
import './mealplan.js';
import { initializeMealPlanner } from './mealplan.js';
import { settings } from './settings.js';

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
const ingredientSearchInput = document.getElementById('ingredient-search-input');
const searchBtn = document.getElementById('search-btn');
const searchResults = document.getElementById('search-results');
const totalCalories = document.getElementById('total-calories');
const totalProtein = document.getElementById('total-protein');
const totalCarbs = document.getElementById('total-carbs');
const totalFat = document.getElementById('total-fat');

// Initialize data structures
let recipes = [];
let mealPlan = {};
let nutritionData = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0
};

// Current state
let currentIngredientInput = null;
let selectedIngredients = new Map(); // Maps ingredient IDs to their nutrition data

// Track the current recipe being edited
let currentEditRecipeId = null;

// Modal Management
function openModal() {
    const recipeModal = document.getElementById('recipe-modal');
    if (!recipeModal) {
        console.log('Recipe modal not found');
        return;
    }
    recipeModal.classList.add('active');
    // Add first ingredient input if none exists
    if (ingredientsList.children.length === 0) {
        addIngredientInput();
    }
    // Initialize nutrition display
    updateTotalNutrition();
}

function closeModalHandler() {
    const recipeModal = document.getElementById('recipe-modal');
    if (!recipeModal) {
        console.log('Recipe modal not found');
        return;
    }
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
    // Check if we're on the recipe form page
    const servingSizeInput = document.getElementById('recipe-serving-size');
    const ingredientsList = document.getElementById('ingredients-list');
    if (!servingSizeInput || !ingredientsList) {
        console.log('Not on recipe form page, skipping nutrition update');
        return;
    }

    const totalWeight = calculateTotalWeight();
    const servingSize = parseFloat(servingSizeInput.value) || totalWeight;
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
        const nameInput = item.querySelector('.ingredient-name');
        const amountInput = item.querySelector('.ingredient-amount');
        if (!nameInput || !amountInput) return;

        const fdcId = nameInput.dataset.fdcId;
        const amount = parseFloat(amountInput.value) || 0;
        
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

    // Update display if elements exist
    const totalCalories = document.getElementById('total-calories');
    const totalProtein = document.getElementById('total-protein');
    const totalCarbs = document.getElementById('total-carbs');
    const totalFat = document.getElementById('total-fat');
    const recipeServings = document.getElementById('recipe-servings');

    if (totalCalories) totalCalories.textContent = perServing.calories;
    if (totalProtein) totalProtein.textContent = perServing.protein;
    if (totalCarbs) totalCarbs.textContent = perServing.carbs;
    if (totalFat) totalFat.textContent = perServing.fat;
    if (recipeServings) recipeServings.textContent = numberOfServings;
}

function calculateTotalWeight() {
    const ingredientsList = document.getElementById('ingredients-list');
    if (!ingredientsList) return 0;

    let totalWeight = 0;
    const ingredientItems = ingredientsList.querySelectorAll('.ingredient-item');
    
    ingredientItems.forEach(item => {
        const amountInput = item.querySelector('.ingredient-amount');
        if (!amountInput) return;
        const amount = parseFloat(amountInput.value) || 0;
        totalWeight += amount;
    });

    return totalWeight;
}

// Update serving size when ingredients change
function updateServingSizeDefault() {
    // Check if we're on the recipe form page
    const recipeForm = document.getElementById('recipe-form');
    if (!recipeForm) {
        console.log('Not on recipe form page, skipping serving size update');
        return;
    }

    const servingSizeInput = document.getElementById('recipe-serving-size');
    if (!servingSizeInput) {
        console.log('Serving size input not found, skipping update');
        return;
    }

    const totalWeight = calculateTotalWeight();
    if (!servingSizeInput.value) {
        servingSizeInput.value = totalWeight;
    }
    updateTotalNutrition();
}

// Modified Recipe Card Creation
function createRecipeCard(recipe) {
    const card = document.createElement('div');
    card.className = 'recipe-card';
    
    const ingredients = recipe.ingredients
        .map(ing => `${ing.name} (${ing.amount}g)`)
        .join(', ');

    const totalWeight = recipe.ingredients.reduce((sum, ing) => sum + ing.amount, 0);
    const numberOfServings = Math.round((totalWeight / recipe.servingSize) * 10) / 10;

    card.innerHTML = `
        <div class="recipe-card-content">
            <span class="recipe-category">${recipe.category}</span>
            <h3>${recipe.name}</h3>
            <p class="recipe-servings">Serving Size: ${recipe.servingSize}g (Makes ${numberOfServings} servings)</p>
            
            <div class="recipe-nutrition">
                <div class="nutrition-item">
                    <span class="nutrition-value">${recipe.nutrition.calories}</span>
                    <span class="nutrition-label">Calories</span>
                </div>
                <div class="nutrition-item">
                    <span class="nutrition-value">${recipe.nutrition.protein}g</span>
                    <span class="nutrition-label">Protein</span>
                </div>
                <div class="nutrition-item">
                    <span class="nutrition-value">${recipe.nutrition.carbs}g</span>
                    <span class="nutrition-label">Carbs</span>
                </div>
                <div class="nutrition-item">
                    <span class="nutrition-value">${recipe.nutrition.fat}g</span>
                    <span class="nutrition-label">Fat</span>
                </div>
            </div>
            
            <p class="recipe-ingredients">
                <strong>Ingredients:</strong><br>
                ${ingredients}
            </p>
            
            <div class="recipe-actions">
                <button class="btn btn-edit" onclick="editRecipe(${recipe.id})">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-delete" onclick="deleteRecipe(${recipe.id})">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `;
    return card;
}

// Update the recipe form submit handler to use the global edit ID
async function handleRecipeSubmit(e) {
    e.preventDefault();

    // Check if we're on the recipe form page
    const recipeForm = document.getElementById('recipe-form');
    if (!recipeForm) {
        console.log('Not on recipe form page, skipping submission');
        return;
    }

    // Validate that we have at least one ingredient
    if (selectedIngredients.size === 0) {
        alert('Please add at least one ingredient to your recipe');
        return;
    }

    // Validate required fields
    const nameInput = document.getElementById('recipe-name');
    const servingSizeInput = document.getElementById('recipe-serving-size');
    const categoryInput = document.getElementById('recipe-category');

    if (!nameInput || !servingSizeInput || !categoryInput) {
        console.error('Required form elements not found');
        return;
    }

    const name = nameInput.value.trim();
    const servingSize = parseFloat(servingSizeInput.value);
    const category = categoryInput.value;
    
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
        id: currentEditRecipeId || Date.now(),
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
        if (currentEditRecipeId) {
            // Update existing recipe
            const index = recipes.findIndex(r => r.id === currentEditRecipeId);
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
        currentEditRecipeId = null;
    } catch (error) {
        console.error('Error saving recipe:', error);
        alert('There was an error saving your recipe. Please try again.');
    }
}

// Local Storage Management
function loadFromLocalStorage() {
    try {
        console.log('Loading data from localStorage...');
        
        const savedRecipes = localStorage.getItem('recipes');
        if (savedRecipes) {
            try {
                recipes = JSON.parse(savedRecipes);
                // Update global recipes
                window.recipes = recipes;
                console.log('Loaded recipes:', recipes.length);
            } catch (error) {
                console.error('Error parsing saved recipes:', error);
            }
        } else {
            console.log('No saved recipes found');
        }

        const savedMealPlan = localStorage.getItem('mealPlan');
        if (savedMealPlan) {
            try {
                mealPlan = JSON.parse(savedMealPlan);
                console.log('Loaded meal plan');
            } catch (error) {
                console.error('Error parsing saved meal plan:', error);
            }
        } else {
            console.log('No saved meal plan found');
        }

        const savedNutrition = localStorage.getItem('meale-nutrition');
        if (savedNutrition) {
            try {
                nutritionData = JSON.parse(savedNutrition);
                console.log('Loaded nutrition data');
            } catch (error) {
                console.error('Error parsing saved nutrition data:', error);
            }
        } else {
            console.log('No saved nutrition data found');
        }
    } catch (error) {
        console.error('Error loading from localStorage:', error);
    }
}

// Save data to localStorage
function saveToLocalStorage() {
    try {
        console.log('Saving data to localStorage...');
        
        // Save recipes
        localStorage.setItem('recipes', JSON.stringify(recipes));
        console.log('Saved recipes:', recipes.length);
        
        // Save meal plan
        localStorage.setItem('mealPlan', JSON.stringify(mealPlan));
        console.log('Saved meal plan');
        
        // Save nutrition data
        localStorage.setItem('meale-nutrition', JSON.stringify(nutritionData));
        console.log('Saved nutrition data');
        
        // Update global recipes for other modules
        window.recipes = recipes;
        
    } catch (error) {
        console.error('Error saving to localStorage:', error);
    }
}

// Initialize settings
function initializeSettings() {
    try {
        // Get settings from localStorage if not already loaded
        if (!window.settings) {
            const savedSettings = localStorage.getItem('settings');
            window.settings = savedSettings ? JSON.parse(savedSettings) : {
                mealPlanStartDay: 0, // Default to Sunday
                theme: 'light'
            };
        }

        // Only initialize settings UI if we're on the settings page
        const startDaySelect = document.getElementById('meal-plan-start-day');
        if (startDaySelect) {
            startDaySelect.value = window.settings.mealPlanStartDay;
            startDaySelect.addEventListener('change', (e) => {
                window.settings.mealPlanStartDay = parseInt(e.target.value);
                localStorage.setItem('settings', JSON.stringify(window.settings));
                // Reset week offset when start day changes
                if (window.currentWeekOffset !== undefined) {
                    window.currentWeekOffset = 0;
                }
                // Update meal plan if we're on that page
                if (typeof updateWeekDisplay === 'function') {
                    updateWeekDisplay();
                }
            });
        }

        // Only initialize theme if we're on a page with theme elements
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.checked = window.settings.theme === 'dark';
            themeToggle.addEventListener('change', (e) => {
                window.settings.theme = e.target.checked ? 'dark' : 'light';
                localStorage.setItem('settings', JSON.stringify(window.settings));
                document.body.classList.toggle('dark-theme', e.target.checked);
            });
            document.body.classList.toggle('dark-theme', window.settings.theme === 'dark');
        }
    } catch (error) {
        console.error('Error initializing settings:', error);
    }
}

// Handle custom ingredient form submission
function handleCustomIngredientSubmit(e) {
    e.preventDefault();
    
    const name = document.getElementById('ingredient-name').value;
    const totalPrice = parseFloat(document.getElementById('total-price').value);
    const totalWeight = parseFloat(document.getElementById('total-weight').value);
    const servingSize = parseFloat(document.getElementById('serving-size').value);
    const calories = parseFloat(document.getElementById('calories').value);
    const fat = parseFloat(document.getElementById('fat').value);
    const carbs = parseFloat(document.getElementById('carbs').value);
    const protein = parseFloat(document.getElementById('protein').value);

    // Calculate per gram values
    const pricePerGram = totalPrice / totalWeight;
    const caloriesPerGram = calories / servingSize;
    const fatPerGram = fat / servingSize;
    const carbsPerGram = carbs / servingSize;
    const proteinPerGram = protein / servingSize;

    const ingredient = {
        id: Date.now().toString(),
        name,
        pricePerGram,
        caloriesPerGram,
        fatPerGram,
        carbsPerGram,
        proteinPerGram,
        servingSize,
        isCustom: true
    };

    // Get existing ingredients
    const ingredients = JSON.parse(localStorage.getItem('customIngredients') || '[]');
    ingredients.push(ingredient);
    localStorage.setItem('customIngredients', JSON.stringify(ingredients));

    // Update the list
    updateCustomIngredientsList();

    // Reset form
    e.target.reset();
}

// Update custom ingredients list
function updateCustomIngredientsList(ingredients = null) {
    const list = document.getElementById('custom-ingredients-list');
    if (!list) return;

    if (!ingredients) {
        ingredients = JSON.parse(localStorage.getItem('customIngredients') || '[]');
    }

    list.innerHTML = ingredients.map(ingredient => `
        <div class="ingredient-item" data-id="${ingredient.id}">
            <div class="ingredient-info">
                <h3>${ingredient.name}</h3>
                <p>Price: $${(ingredient.pricePerGram * 100).toFixed(2)}/100g</p>
                <p>Calories: ${(ingredient.caloriesPerGram * 100).toFixed(1)}/100g</p>
                <p>Macros: ${(ingredient.fatPerGram * 100).toFixed(1)}g fat, ${(ingredient.carbsPerGram * 100).toFixed(1)}g carbs, ${(ingredient.proteinPerGram * 100).toFixed(1)}g protein</p>
            </div>
            <div class="ingredient-actions">
                <button class="btn btn-edit" onclick="editCustomIngredient('${ingredient.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-delete" onclick="deleteCustomIngredient('${ingredient.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

// Edit custom ingredient
function editCustomIngredient(id) {
    const ingredients = JSON.parse(localStorage.getItem('customIngredients') || '[]');
    const ingredient = ingredients.find(i => i.id === id);
    if (!ingredient) return;

    // Populate form
    document.getElementById('ingredient-name').value = ingredient.name;
    document.getElementById('total-price').value = (ingredient.pricePerGram * 100).toFixed(2);
    document.getElementById('total-weight').value = '100';
    document.getElementById('serving-size').value = ingredient.servingSize;
    document.getElementById('calories').value = (ingredient.caloriesPerGram * 100).toFixed(1);
    document.getElementById('fat').value = (ingredient.fatPerGram * 100).toFixed(1);
    document.getElementById('carbs').value = (ingredient.carbsPerGram * 100).toFixed(1);
    document.getElementById('protein').value = (ingredient.proteinPerGram * 100).toFixed(1);

    // Remove old ingredient
    deleteCustomIngredient(id);
}

// Delete custom ingredient
function deleteCustomIngredient(id) {
    const ingredients = JSON.parse(localStorage.getItem('customIngredients') || '[]');
    const updatedIngredients = ingredients.filter(i => i.id !== id);
    localStorage.setItem('customIngredients', JSON.stringify(updatedIngredients));
    updateCustomIngredientsList();
}

// Initialize app
function initializeApp() {
    try {
        // Load recipes and meal plan from localStorage first
        loadFromLocalStorage();

        // Initialize settings first
        initializeSettings();

        // Get all potential elements we might need to initialize
        const elements = {
            recipeList: document.getElementById('recipe-list'),
            recipeForm: document.getElementById('recipe-form'),
            addRecipeBtn: document.getElementById('add-recipe-btn'),
            closeButtons: document.querySelectorAll('.close-modal'),
            ingredientInputs: document.querySelectorAll('.ingredient-input'),
            addIngredientBtn: document.getElementById('add-ingredient-btn'),
            servingSizeInput: document.getElementById('serving-size'),
            totalWeightInput: document.getElementById('total-weight'),
            totalPriceInput: document.getElementById('total-price'),
            totalCaloriesInput: document.getElementById('total-calories'),
            totalFatInput: document.getElementById('total-fat'),
            totalCarbsInput: document.getElementById('total-carbs'),
            totalProteinInput: document.getElementById('total-protein'),
            customIngredientForm: document.getElementById('custom-ingredient-form'),
            customIngredientsList: document.getElementById('custom-ingredients-list'),
            ingredientSearch: document.getElementById('ingredient-search')
        };

        // Initialize recipe list if we're on the recipes page
        if (elements.recipeList && document.getElementById('category-filter')) {
            updateRecipeList();
        }

        // Initialize meal planner if available
        if (typeof initializeMealPlanner === 'function') {
            initializeMealPlanner();
        }

        // Initialize recipe form if available
        if (elements.recipeForm) {
            elements.recipeForm.addEventListener('submit', handleRecipeSubmit);
        }

        // Initialize add recipe button if available
        if (elements.addRecipeBtn) {
            elements.addRecipeBtn.addEventListener('click', openModal);
        }

        // Initialize modal close buttons if available
        if (elements.closeButtons.length > 0) {
            elements.closeButtons.forEach(button => {
                if (button) {
                    button.addEventListener('click', closeModalHandler);
                }
            });
        }

        // Initialize ingredient inputs if available
        if (elements.ingredientInputs.length > 0) {
            elements.ingredientInputs.forEach(input => {
                if (input) {
                    input.addEventListener('focus', () => openIngredientSearch(input));
                }
            });
        }

        // Initialize add ingredient button if available
        if (elements.addIngredientBtn) {
            elements.addIngredientBtn.addEventListener('click', addIngredientInput);
        }

        // Initialize serving size input if available
        if (elements.servingSizeInput) {
            elements.servingSizeInput.addEventListener('input', updateServingSizeDefault);
        }

        // Initialize total weight input if available
        if (elements.totalWeightInput) {
            elements.totalWeightInput.addEventListener('input', updateTotalNutrition);
        }

        // Initialize total price input if available
        if (elements.totalPriceInput) {
            elements.totalPriceInput.addEventListener('input', updateTotalNutrition);
        }

        // Initialize total calories input if available
        if (elements.totalCaloriesInput) {
            elements.totalCaloriesInput.addEventListener('input', updateTotalNutrition);
        }

        // Initialize total fat input if available
        if (elements.totalFatInput) {
            elements.totalFatInput.addEventListener('input', updateTotalNutrition);
        }

        // Initialize total carbs input if available
        if (elements.totalCarbsInput) {
            elements.totalCarbsInput.addEventListener('input', updateTotalNutrition);
        }

        // Initialize total protein input if available
        if (elements.totalProteinInput) {
            elements.totalProteinInput.addEventListener('input', updateTotalNutrition);
        }

        // Initialize custom ingredient form if available
        if (elements.customIngredientForm) {
            elements.customIngredientForm.addEventListener('submit', handleCustomIngredientSubmit);
        }

        // Initialize custom ingredients list if available
        if (elements.customIngredientsList) {
            updateCustomIngredientsList();
        }

        // Initialize ingredient search if available
        if (elements.ingredientSearch) {
            elements.ingredientSearch.addEventListener('input', () => {
                const searchTerm = elements.ingredientSearch.value.toLowerCase();
                const ingredients = JSON.parse(localStorage.getItem('customIngredients') || '[]');
                const filteredIngredients = ingredients.filter(ingredient => 
                    ingredient.name.toLowerCase().includes(searchTerm)
                );
                updateCustomIngredientsList(filteredIngredients);
            });
        }

        console.log('App initialized successfully');
    } catch (error) {
        console.error('Error initializing app:', error);
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp);

// Update editRecipe to set the global edit ID and handler
function editRecipe(id) {
    const recipe = recipes.find(r => r.id === id);
    if (!recipe) return;
    recipeForm.reset();
    ingredientsList.innerHTML = '';
    selectedIngredients.clear();
    document.getElementById('recipe-name').value = recipe.name;
    document.getElementById('recipe-category').value = recipe.category;
    document.getElementById('recipe-serving-size').value = recipe.servingSize;
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
        nameInput.dataset.fdcId = ing.fdcId;
        const ingredientData = {
            amount: parseFloat(ing.amount),
            nutrition: ing.nutrition
        };
        selectedIngredients.set(ing.fdcId.toString(), ingredientData);
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
        updateIngredientMacros(ingredientItem, ingredientData);
    });
    // Set the global edit ID
    currentEditRecipeId = id;
    // Set the form handler
    recipeForm.onsubmit = handleRecipeSubmit;
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
    // Check if we're on a page with the ingredient search modal
    const searchModal = document.getElementById('ingredient-search-modal');
    if (!searchModal) {
        console.log('Not on a page with ingredient search, skipping modal open');
        return;
    }

    // Store reference to the input being edited
    currentIngredientInput = ingredientInput;
    
    // Show modal
    searchModal.classList.add('active');
    
    // Focus search input
    const searchInput = document.getElementById('ingredient-search-input');
    if (searchInput) {
        searchInput.focus();
    }
}

function closeIngredientSearch() {
    const searchModal = document.getElementById('ingredient-search-modal');
    if (!searchModal) {
        console.log('Ingredient search modal not found');
        return;
    }
    searchModal.classList.remove('active');
    currentIngredientInput = null;
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
if (addRecipeBtn) {
    addRecipeBtn.addEventListener('click', openModal);
}

if (closeModal) {
    closeModal.addEventListener('click', closeModalHandler);
}

if (cancelRecipe) {
    cancelRecipe.addEventListener('click', closeModalHandler);
}

if (addIngredientBtn) {
    addIngredientBtn.addEventListener('click', addIngredientInput);
}

if (recipeForm) {
    recipeForm.addEventListener('submit', handleRecipeSubmit);
}

if (categoryFilter) {
    categoryFilter.addEventListener('change', updateRecipeList);
}

if (searchBtn) {
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
}

if (ingredientSearchInput) {
    ingredientSearchInput.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            searchBtn.click();
        }
    });
}

// Close buttons for all modals
document.querySelectorAll('.modal .close').forEach(closeBtn => {
    if (closeBtn) {
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
    }
});

// Close modal when clicking outside
document.querySelectorAll('.modal').forEach(modal => {
    if (modal) {
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
    }
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
    if (!recipeList) {
        console.log('Recipe list element not found, skipping update');
        return;
    }

    recipeList.innerHTML = '';
    const selectedCategory = categoryFilter ? categoryFilter.value : 'all';
    
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