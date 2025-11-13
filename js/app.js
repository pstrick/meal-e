import config from './config.js';
import { version } from './version.js';
import './mealplan.js';
import { initializeMealPlanner } from './mealplan.js';
import { settings } from './settings.js';
import { showAlert } from './alert.js';

// DOM Elements
const navLinks = document.querySelectorAll('nav a');
const sections = document.querySelectorAll('.section');
const addRecipeBtn = document.getElementById('add-recipe-btn');
const recipeList = document.getElementById('recipe-list');
const recipeModal = document.getElementById('recipe-modal');
const recipeForm = document.getElementById('recipe-form');
const closeModal = document.querySelector('.close');
const cancelRecipe = document.getElementById('cancel-recipe');
const addIngredientBtn = document.getElementById('add-ingredient');
const ingredientsList = document.getElementById('ingredients-list');
const categoryFilter = document.getElementById('category-filter');
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

const DARK_THEME_VARS = {
    '--color-bg': '#0f172a',
    '--color-bg-muted': '#1e293b',
    '--color-surface': '#101b2d',
    '--color-surface-alt': '#152136',
    '--color-surface-elevated': '#1c2b44',
    '--color-text': '#e2e8f0',
    '--color-text-muted': '#94a3b8',
    '--color-text-subtle': '#c3d1e2',
    '--color-border': 'rgba(148, 163, 184, 0.18)',
    '--color-border-strong': 'rgba(148, 163, 184, 0.26)',
    '--color-divider': 'rgba(71, 85, 105, 0.22)'
};

function addDarkModePreloadStyle() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('dark-mode-preload')) return;
    const style = document.createElement('style');
    style.id = 'dark-mode-preload';
    style.textContent = 'html, body { background-color: #0f172a !important; color: #e2e8f0 !important; }';
    (document.head || document.documentElement).appendChild(style);
}

function removeDarkModePreloadStyle() {
    if (typeof document === 'undefined') return;
    const style = document.getElementById('dark-mode-preload');
    if (style) {
        style.remove();
    }
}

function applyInlineDarkThemeVars() {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    Object.entries(DARK_THEME_VARS).forEach(([key, value]) => {
        root.style.setProperty(key, value);
    });
}

function clearInlineDarkThemeVars() {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    Object.keys(DARK_THEME_VARS).forEach((key) => {
        root.style.removeProperty(key);
    });
}

function applyThemePreload() {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.add('theme-preload');
}

function releaseThemePreload() {
    if (typeof document === 'undefined') return;
    window.requestAnimationFrame(() => {
        document.documentElement.classList.remove('theme-preload');
    });
}

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
    selectedIngredients.clear();
    currentEditRecipeId = null;
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


// Custom Ingredients Search Functions
function searchCustomIngredients(query) {
    const customIngredients = JSON.parse(localStorage.getItem('meale-custom-ingredients') || '[]');
    const queryLower = query.toLowerCase();
    
    return customIngredients.filter(ingredient => {
        const nameLower = ingredient.name.toLowerCase();
        return nameLower.includes(queryLower) || 
               nameLower.startsWith(queryLower) ||
               nameLower === queryLower;
    });
}

// Nutrition Calculations for Custom Ingredients
function calculateNutritionPerGram(ingredient) {
    console.log('Calculating nutrition for ingredient:', ingredient.name || 'Unknown');
    
    // Custom ingredients already have nutrition per 100g, convert to per gram
    const nutrition = {
        calories: (ingredient.calories || 0) / 100,
        protein: (ingredient.protein || 0) / 100,
        carbs: (ingredient.carbs || 0) / 100,
        fat: (ingredient.fat || 0) / 100
    };

    console.log('Calculated nutrition per gram:', nutrition);
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
        .map(ing => {
            const emoji = (ing.emoji || '').trim();
            return `${emoji ? `${emoji} ` : ''}${ing.name} (${ing.amount}g)`;
        })
        .join(', ');

    const totalWeight = recipe.ingredients.reduce((sum, ing) => sum + ing.amount, 0);
    const computedServings = recipe.servingSize ? Math.round((totalWeight / recipe.servingSize) * 10) / 10 : 1;
    const numberOfServings = Number.isFinite(computedServings) && computedServings > 0 ? computedServings : 1;
    const instructionsPreview = recipe.steps ? recipe.steps.trim().replace(/\s+/g, ' ') : '';
    const instructionsSnippet = instructionsPreview.length > 160 ? `${instructionsPreview.substring(0, 160)}...` : instructionsPreview;

    card.innerHTML = `
        <div class="recipe-card-content">
            <div class="recipe-card-header">
                <div class="recipe-title-group">
                    <span class="recipe-category">${recipe.category}</span>
                    <h3>${recipe.name}</h3>
                </div>
                <div class="recipe-meta">
                    <span class="recipe-servings">Serving Size: ${recipe.servingSize}g</span>
                    <span class="recipe-serving-count">Makes ${numberOfServings} servings</span>
                </div>
            </div>
            
            <div class="recipe-card-body">
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
                <div class="recipe-summary">
                    <div class="recipe-ingredients">
                        <strong>Ingredients</strong>
                        <p class="recipe-text">${ingredients}</p>
                    </div>
                    ${instructionsPreview ? `
                        <div class="recipe-steps">
                            <strong>Instructions</strong>
                            <p class="recipe-text">${instructionsSnippet}</p>
                        </div>
                    ` : ''}
                </div>
            </div>
            
            <div class="recipe-actions">
                <button class="btn btn-edit" onclick="editRecipe(${recipe.id})">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-duplicate" onclick="duplicateRecipe(${recipe.id})">
                    <i class="fas fa-copy"></i> Duplicate
                </button>
                <button class="btn btn-print" onclick="printRecipe(${recipe.id})">
                    <i class="fas fa-print"></i> Print
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
    const ingredientsList = document.getElementById('ingredients-list');
    if (!ingredientsList) {
        console.error('ingredients-list element not found');
        showAlert('Please add at least one ingredient to your recipe', { type: 'warning' });
        return;
    }
    
    const ingredientItems = ingredientsList.querySelectorAll('.ingredient-item');
    console.log('Found ingredient items:', ingredientItems.length);
    console.log('Ingredients list innerHTML length:', ingredientsList.innerHTML.length);
    
    // Also check if there are any visible ingredient items (not just in DOM)
    const visibleIngredientItems = Array.from(ingredientItems).filter(item => 
        item.style.display !== 'none' && item.offsetParent !== null
    );
    console.log('Visible ingredient items:', visibleIngredientItems.length);
    
    // Check if ingredients exist in the DOM even if not visible
    const hasIngredients = ingredientItems.length > 0;
    console.log('Has ingredients in DOM:', hasIngredients);
    
    if (!hasIngredients) {
        showAlert('Please add at least one ingredient to your recipe', { type: 'warning' });
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
    const steps = document.getElementById('recipe-steps').value.trim();
    
    if (!name || !servingSize || servingSize <= 0) {
        showAlert('Please fill in all required fields', { type: 'warning' });
        return;
    }

    // Gather ingredients with their nutrition data
    const ingredients = Array.from(ingredientsList.children)
        .map(item => {
            const fdcId = item.querySelector('.ingredient-name').dataset.fdcId;
            const ingredientData = selectedIngredients.get(fdcId);
            console.log('Gathering ingredient:', { fdcId, ingredientData });
            if (!fdcId || !ingredientData || !ingredientData.name || !ingredientData.nutrition) return null;
            return {
                fdcId: fdcId,
                name: ingredientData.name,
                amount: parseFloat(item.querySelector('.ingredient-amount').value) || 0,
                nutrition: ingredientData.nutrition,
                source: ingredientData.source || 'usda', // Default to usda for backward compatibility
                storeSection: ingredientData.storeSection || '',
                emoji: ingredientData.emoji || ''
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
        steps: steps,
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
        showAlert('There was an error saving your recipe. Please try again.', { type: 'error' });
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
            const savedSettings = localStorage.getItem('meale-settings');
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
                localStorage.setItem('meale-settings', JSON.stringify(window.settings));
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
                applyThemePreload();
                window.settings.theme = e.target.checked ? 'dark' : 'light';
                localStorage.setItem('meale-settings', JSON.stringify(window.settings));
                const isDark = e.target.checked;
                document.body.classList.toggle('dark-theme', isDark);
                document.documentElement.classList.toggle('dark-mode', isDark);
                document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
                if (isDark) {
                    document.documentElement.style.backgroundColor = '#0f172a';
                    addDarkModePreloadStyle();
                    applyInlineDarkThemeVars();
                } else {
                    document.documentElement.style.removeProperty('background-color');
                    removeDarkModePreloadStyle();
                    clearInlineDarkThemeVars();
                }
                setTimeout(() => {
                    if (isDark) {
                        setTimeout(() => removeDarkModePreloadStyle(), 120);
                    }
                    releaseThemePreload();
                }, 80);
            });
            const initialDark = window.settings.theme === 'dark';
            document.body.classList.toggle('dark-theme', initialDark);
            document.documentElement.classList.toggle('dark-mode', initialDark);
            document.documentElement.style.colorScheme = initialDark ? 'dark' : 'light';
            if (initialDark) {
                document.documentElement.style.backgroundColor = '#0f172a';
                addDarkModePreloadStyle();
                applyInlineDarkThemeVars();
            } else {
                document.documentElement.style.removeProperty('background-color');
                removeDarkModePreloadStyle();
                clearInlineDarkThemeVars();
            }
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
        applyThemePreload();
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

        // Initialize add meal button if available
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

        // Initialize search button and search input for ingredient search modal
        const searchBtn = document.getElementById('search-btn');
        const ingredientSearchInput = document.getElementById('ingredient-search-input');
        
        if (searchBtn) {
            searchBtn.addEventListener('click', async () => {
                const query = ingredientSearchInput ? ingredientSearchInput.value.trim() : '';
                if (query) {
                    const searchResults = document.getElementById('search-results');
                    if (searchResults) {
                        searchResults.innerHTML = '<div class="loading">Searching...</div>';
                        try {
                            const results = await searchAllIngredients(query);
                            displaySearchResults(results);
                        } catch (error) {
                            console.error('Error searching ingredients:', error);
                            searchResults.innerHTML = '<div class="error">Error searching ingredients. Please try again.</div>';
                        }
                    }
                }
            });
        }

        if (ingredientSearchInput) {
            ingredientSearchInput.addEventListener('keypress', async (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (searchBtn) searchBtn.click();
                }
            });
        }

        // Initialize category filter
        const categoryFilter = document.getElementById('category-filter');
        if (categoryFilter) {
            categoryFilter.addEventListener('change', updateRecipeList);
        }

        // Initialize recipe search
        const recipeSearch = document.getElementById('recipe-search');
        if (recipeSearch) {
            recipeSearch.addEventListener('input', updateRecipeList);
        }

        // Initialize cancel recipe button
        const cancelRecipeBtn = document.getElementById('cancel-recipe');
        if (cancelRecipeBtn) {
            cancelRecipeBtn.addEventListener('click', closeModalHandler);
        }

        console.log('App initialized successfully');
    } catch (error) {
        console.error('Error initializing app:', error);
    }

    window.addEventListener('load', () => {
        releaseThemePreload();
        if (document.body.classList.contains('dark-theme')) {
            setTimeout(() => removeDarkModePreloadStyle(), 150);
        } else {
            removeDarkModePreloadStyle();
            clearInlineDarkThemeVars();
        }
    }, { once: true });
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp);

// Print recipe function
function printRecipe(id) {
    const recipe = recipes.find(r => r.id === id);
    if (!recipe) return;
    
    const printWindow = window.open('', '_blank');
    const totalWeight = recipe.ingredients.reduce((sum, ing) => sum + ing.amount, 0);
    const numberOfServings = Math.round((totalWeight / recipe.servingSize) * 10) / 10;
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${recipe.name} - Recipe</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 20px;
                }
                .recipe-header {
                    text-align: center;
                    border-bottom: 3px solid #4CAF50;
                    padding-bottom: 20px;
                    margin-bottom: 30px;
                }
                .recipe-title {
                    font-size: 2.5rem;
                    color: #4CAF50;
                    margin: 0 0 10px 0;
                }
                .recipe-category {
                    background: #4CAF50;
                    color: white;
                    padding: 5px 15px;
                    border-radius: 20px;
                    font-size: 0.9rem;
                    text-transform: uppercase;
                    display: inline-block;
                    margin-bottom: 10px;
                }
                .recipe-info {
                    background: #f8f9fa;
                    padding: 20px;
                    border-radius: 8px;
                    margin-bottom: 30px;
                }
                .nutrition-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 15px;
                    margin: 20px 0;
                }
                .nutrition-item {
                    background: white;
                    padding: 15px;
                    border-radius: 6px;
                    text-align: center;
                    border: 1px solid #dee2e6;
                }
                .nutrition-value {
                    font-size: 1.5rem;
                    font-weight: bold;
                    color: #4CAF50;
                    display: block;
                }
                .nutrition-label {
                    font-size: 0.9rem;
                    color: #666;
                    margin-top: 5px;
                }
                .ingredients-section, .instructions-section {
                    margin-bottom: 30px;
                }
                .section-title {
                    font-size: 1.5rem;
                    color: #4CAF50;
                    border-bottom: 2px solid #4CAF50;
                    padding-bottom: 10px;
                    margin-bottom: 20px;
                }
                .ingredients-list {
                    list-style: none;
                    padding: 0;
                }
                .ingredient-item {
                    background: white;
                    padding: 15px;
                    margin-bottom: 10px;
                    border-radius: 6px;
                    border: 1px solid #dee2e6;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .ingredient-name {
                    font-weight: 600;
                }
                .ingredient-details {
                    text-align: right;
                    color: #666;
                }
                .instructions {
                    background: white;
                    padding: 20px;
                    border-radius: 6px;
                    border: 1px solid #dee2e6;
                    white-space: pre-wrap;
                    line-height: 1.8;
                }
                .no-instructions {
                    color: #666;
                    font-style: italic;
                }
                @media print {
                    body { margin: 0; padding: 15px; }
                    .recipe-header { border-bottom-color: #000; }
                    .section-title { border-bottom-color: #000; color: #000; }
                    .nutrition-value { color: #000; }
                    .recipe-title { color: #000; }
                }
            </style>
        </head>
        <body>
            <div class="recipe-header">
                <h1 class="recipe-title">${recipe.name}</h1>
                <span class="recipe-category">${recipe.category}</span>
                <p>Serving Size: ${recipe.servingSize}g (Makes ${numberOfServings} servings)</p>
            </div>
            
            <div class="recipe-info">
                <h2 class="section-title">Nutrition Information</h2>
                <div class="nutrition-grid">
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
            </div>
            
            <div class="ingredients-section">
                <h2 class="section-title">Ingredients</h2>
                <ul class="ingredients-list">
                    ${recipe.ingredients.map(ing => `
                        <li class="ingredient-item">
                            <span class="ingredient-name">${((ing.emoji || '').trim()) ? `${(ing.emoji || '').trim()} ${ing.name}` : ing.name}</span>
                            <div class="ingredient-details">
                                <div>${ing.amount}g</div>
                                <div style="font-size: 0.9rem;">
                                    Cal: ${Math.round(ing.nutrition.calories * ing.amount)} | 
                                    P: ${Math.round(ing.nutrition.protein * ing.amount)}g | 
                                    C: ${Math.round(ing.nutrition.carbs * ing.amount)}g | 
                                    F: ${Math.round(ing.nutrition.fat * ing.amount)}g
                                </div>
                            </div>
                        </li>
                    `).join('')}
                </ul>
            </div>
            
            <div class="instructions-section">
                <h2 class="section-title">Instructions</h2>
                <div class="instructions">
                    ${recipe.steps ? recipe.steps : '<span class="no-instructions">No instructions provided</span>'}
                </div>
            </div>
        </body>
        </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    
    // Wait for content to load then print
    setTimeout(() => {
        printWindow.print();
    }, 500);
}

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
    document.getElementById('recipe-steps').value = recipe.steps || '';
    recipe.ingredients.forEach(ing => {
        const ingredientItem = document.createElement('div');
        ingredientItem.className = 'ingredient-item';
        const emoji = (ing.emoji || '').trim();
        const displayName = emoji ? `${emoji} ${ing.name}` : ing.name;
        ingredientItem.innerHTML = `
            <div class="ingredient-main">
                <input type="text" class="ingredient-name" placeholder="Search for ingredient" required readonly value="${displayName}">
                <input type="number" class="ingredient-amount" placeholder="Grams" min="0" step="0.1" required value="${ing.amount}">
                <button type="button" class="remove-ingredient">&times;</button>
            </div>
            <div class="ingredient-macros">
                <span class="macro-item">Calories: <span class="calories">0</span></span>
                <span class="macro-item">Protein: <span class="protein">0</span>g</span>
                <span class="macro-item">Carbs: <span class="carbs">0</span>g</span>
                <span class="macro-item">Fat: <span class="fat">0</span>g</span>
            </div>
        `;
        const nameInput = ingredientItem.querySelector('.ingredient-name');
        const amountInput = ingredientItem.querySelector('.ingredient-amount');
        // Ensure fdcId is present, fallback to a unique id if missing
        let fdcId = ing.fdcId ? ing.fdcId.toString() : `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        nameInput.dataset.fdcId = fdcId;
        nameInput.dataset.storeSection = ing.storeSection || '';
        nameInput.dataset.emoji = emoji;
        const ingredientData = {
            name: ing.name,
            amount: parseFloat(ing.amount),
            nutrition: ing.nutrition,
            source: ing.source || 'usda', // Default to usda for backward compatibility
            storeSection: ing.storeSection || '',
            emoji: emoji
        };
        selectedIngredients.set(fdcId, ingredientData);
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
        console.log('Added ingredient item to DOM:', ing.name, 'Total items now:', ingredientsList.children.length);
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
window.duplicateRecipe = duplicateRecipe;
window.printRecipe = printRecipe;

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

// Inline Ingredient Search Functions
function openIngredientSearch(ingredientInput) {
    // Store reference to the input being edited
    currentIngredientInput = ingredientInput;
    
    // Make the input editable and focus it
    const nameInput = ingredientInput.querySelector('.ingredient-name');
    if (nameInput) {
        nameInput.readOnly = false;
        nameInput.focus();
        nameInput.placeholder = 'Type to search ingredients...';
        
        // Add event listeners for inline search
        nameInput.addEventListener('input', handleInlineSearch);
        nameInput.addEventListener('blur', handleIngredientBlur);
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

// Inline search handlers
let searchTimeout;
let currentSearchDropdown = null;

function handleInlineSearch(event) {
    const query = event.target.value.trim();
    
    // Clear previous timeout
    clearTimeout(searchTimeout);
    
    // Remove existing dropdown
    removeSearchDropdown();
    
    if (query.length < 2) {
        return;
    }
    
    // Debounce search
    searchTimeout = setTimeout(async () => {
        try {
            const results = await searchAllIngredients(query);
            if (results.length > 0) {
                showInlineSearchResults(event.target, results);
            }
        } catch (error) {
            console.error('Error searching ingredients:', error);
        }
    }, 300);
}

function handleIngredientBlur(event) {
    // Delay hiding dropdown to allow clicking on results
    setTimeout(() => {
        removeSearchDropdown();
    }, 200);
}

function showInlineSearchResults(input, results) {
    // Remove existing dropdown
    removeSearchDropdown();
    
    // Create dropdown container
    const dropdown = document.createElement('div');
    dropdown.className = 'ingredient-search-dropdown';
    dropdown.style.cssText = `
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: white;
        border: 1px solid #ddd;
        border-radius: 4px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        max-height: 200px;
        overflow-y: auto;
        z-index: 1000;
    `;
    
    // Add results
    results.slice(0, 5).forEach(result => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.style.cssText = `
            padding: 8px 12px;
            cursor: pointer;
            border-bottom: 1px solid #eee;
        `;
        item.innerHTML = `
            <div style="font-weight: 600;">${result.name}</div>
            <div style="font-size: 0.8em; color: #666;">${result.brandOwner || 'Custom Ingredient'}</div>
        `;
        
        item.addEventListener('click', () => {
            selectIngredient(result);
            removeSearchDropdown();
        });
        
        item.addEventListener('mouseenter', () => {
            item.style.backgroundColor = '#f5f5f5';
        });
        
        item.addEventListener('mouseleave', () => {
            item.style.backgroundColor = 'white';
        });
        
        dropdown.appendChild(item);
    });
    
    // Position dropdown relative to input
    const inputRect = input.getBoundingClientRect();
    const container = input.closest('.ingredient-item');
    container.style.position = 'relative';
    container.appendChild(dropdown);
    
    currentSearchDropdown = dropdown;
}

function removeSearchDropdown() {
    if (currentSearchDropdown) {
        currentSearchDropdown.remove();
        currentSearchDropdown = null;
    }
}

function selectIngredient(ingredient) {
    if (!currentIngredientInput) return;
    
    const nameInput = currentIngredientInput.querySelector('.ingredient-name');
    const amountInput = currentIngredientInput.querySelector('.ingredient-amount');
    
    if (nameInput && amountInput) {
        // Generate unique ID for this ingredient
        const fdcId = `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const emoji = (ingredient.emoji || '').trim();
        nameInput.dataset.fdcId = fdcId;
        nameInput.dataset.storeSection = ingredient.storeSection || '';
        nameInput.dataset.emoji = emoji;
        const displayName = emoji ? `${emoji} ${ingredient.name}` : ingredient.name;
        nameInput.value = displayName;
        nameInput.readOnly = true;
        nameInput.placeholder = 'Search for ingredient';
        
        // Store ingredient data
        const ingredientData = {
            name: ingredient.name,
            amount: parseFloat(amountInput.value) || 0,
            nutrition: ingredient.nutrition,
            source: ingredient.source || 'custom',
            storeSection: ingredient.storeSection || '',
            emoji: emoji
        };
        selectedIngredients.set(fdcId, ingredientData);
        
        // Update nutrition display
        updateIngredientMacros(currentIngredientInput, ingredientData);
        updateServingSizeDefault();
        
        // Remove event listeners
        nameInput.removeEventListener('input', handleInlineSearch);
        nameInput.removeEventListener('blur', handleIngredientBlur);
    }
}

// Unified Ingredient Search Functions
async function searchAllIngredients(query) {
    const results = [];
    
    // Search only custom ingredients
    const customIngredients = JSON.parse(localStorage.getItem('meale-custom-ingredients') || '[]');
    const customMatches = customIngredients.filter(ingredient => 
        ingredient.name.toLowerCase().includes(query.toLowerCase())
    );
    
    // Add custom ingredients to results
    customMatches.forEach(ingredient => {
        // Convert nutrition from total serving size to per-gram values
        const servingSize = ingredient.servingSize || 100; // Default to 100g if not specified
        const emoji = (ingredient.emoji || '').trim();
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
            brandOwner: 'Custom Ingredient',
            storeSection: ingredient.storeSection || '',
            emoji: emoji
        });
    });
    
    // Sort results by name
    results.sort((a, b) => a.name.localeCompare(b.name));
    
    return results;
}

// Modified Ingredient Search Result Handler
async function displaySearchResults(results) {
    searchResults.innerHTML = '';
    
    if (results.length === 0) {
        searchResults.innerHTML = '<div class="no-results">No matching ingredients found</div>';
        return;
    }
    
    for (const ingredient of results) {
        const div = document.createElement('div');
        div.className = 'search-result-item';
        
        // Create visual indicator for ingredient source
        const sourceIcon = '🏠';
        const sourceLabel = 'Custom Ingredient';
        
        const [mainName, ...details] = ingredient.name.split(',');
        const emoji = (ingredient.emoji || '').trim();
        div.innerHTML = `
            <div class="search-result-header">
                <span class="source-indicator ${ingredient.source}">
                    ${sourceIcon} ${sourceLabel}
                </span>
                <h4>${emoji ? `<span class="ingredient-emoji">${emoji}</span> ` : ''}${mainName}${details.length > 0 ? ',' : ''}<span class="details">${details.join(',')}</span></h4>
            </div>
            <p>${ingredient.brandOwner}</p>
        `;
        
        div.addEventListener('click', async () => {
            try {
                if (!currentIngredientInput) {
                    showAlert('No ingredient input is currently selected. Please click an ingredient input field first.', { type: 'warning' });
                    return;
                }
                
                // Handle custom ingredient
                const ingredientData = {
                    name: ingredient.name,
                    amount: parseFloat(currentIngredientInput.querySelector('.ingredient-amount').value) || 0,
                    nutrition: ingredient.nutrition,
                    source: 'custom',
                    id: ingredient.id,
                    storeSection: ingredient.storeSection || '',
                    emoji: emoji
                };
                
                // Store in selectedIngredients with custom ID
                selectedIngredients.set(`custom-${ingredient.id}`, ingredientData);
                
                // Update the input field
                const nameField = currentIngredientInput.querySelector('.ingredient-name');
                if (nameField) {
                    const displayName = emoji ? `${emoji} ${ingredient.name}` : ingredient.name;
                    nameField.value = displayName;
                    nameField.dataset.fdcId = `custom-${ingredient.id}`;
                    nameField.dataset.storeSection = ingredient.storeSection || '';
                    nameField.dataset.emoji = emoji;
                }
                
                // Update ingredient macros
                updateIngredientMacros(currentIngredientInput, ingredientData);
                
                // Update nutrition display
                updateTotalNutrition();
                closeIngredientSearch();
            } catch (error) {
                console.error('Error selecting ingredient:', error);
                showAlert('Error selecting ingredient. Please try again.', { type: 'error' });
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
            <span class="macro-item">Calories: <span class="calories">0</span></span>
            <span class="macro-item">Protein: <span class="protein">0</span>g</span>
            <span class="macro-item">Carbs: <span class="carbs">0</span>g</span>
            <span class="macro-item">Fat: <span class="fat">0</span>g</span>
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

// Initialize modal close handlers when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Close buttons for all modals
    document.querySelectorAll('.modal .close').forEach(closeBtn => {
        if (closeBtn) {
            closeBtn.addEventListener('click', (event) => {
                const modal = event.target.closest('.modal');
                if (modal && modal.id === 'recipe-modal') {
                    closeModalHandler();
                } else if (modal && modal.id === 'ingredient-search-modal') {
                    closeIngredientSearch();
                } else if (modal && modal.id === 'meal-plan-modal') {
                    if (window.closeMealPlanModal) {
                        window.closeMealPlanModal();
                    } else {
                        // Fallback: hide the modal directly
                        modal.classList.remove('active');
                        modal.style.display = 'none';
                    }
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
                    } else if (modal.id === 'meal-plan-modal') {
                        if (window.closeMealPlanModal) {
                            window.closeMealPlanModal();
                        } else {
                            // Fallback: hide the modal directly
                            modal.classList.remove('active');
                            modal.style.display = 'none';
                        }
                    }
                }
            });
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

function duplicateRecipe(id) {
    const originalRecipe = recipes.find(recipe => recipe.id === id);
    if (!originalRecipe) {
        console.error('Recipe not found for duplication');
        return;
    }

    // Reset form and clear previous data
    recipeForm.reset();
    ingredientsList.innerHTML = '';
    selectedIngredients.clear();
    
    // Pre-fill form with duplicated recipe data
    document.getElementById('recipe-name').value = `${originalRecipe.name} (Copy)`;
    document.getElementById('recipe-category').value = originalRecipe.category;
    document.getElementById('recipe-serving-size').value = originalRecipe.servingSize;
    document.getElementById('recipe-steps').value = originalRecipe.steps || '';
    
    // Add ingredients to the form
    originalRecipe.ingredients.forEach(ing => {
        const ingredientItem = document.createElement('div');
        ingredientItem.className = 'ingredient-item';
        const emoji = (ing.emoji || '').trim();
        const displayName = emoji ? `${emoji} ${ing.name}` : ing.name;
        ingredientItem.innerHTML = `
            <div class="ingredient-main">
                <input type="text" class="ingredient-name" placeholder="Search for ingredient" required readonly value="${displayName}">
                <input type="number" class="ingredient-amount" placeholder="Grams" min="0" step="0.1" required value="${ing.amount}">
                <button type="button" class="remove-ingredient">&times;</button>
            </div>
            <div class="ingredient-macros">
                <span class="macro-item">Calories: <span class="calories">0</span></span>
                <span class="macro-item">Protein: <span class="protein">0</span>g</span>
                <span class="macro-item">Carbs: <span class="carbs">0</span>g</span>
                <span class="macro-item">Fat: <span class="fat">0</span>g</span>
            </div>
        `;
        const nameInput = ingredientItem.querySelector('.ingredient-name');
        const amountInput = ingredientItem.querySelector('.ingredient-amount');
        
        // Generate unique ID for the duplicated ingredient
        const fdcId = `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        nameInput.dataset.fdcId = fdcId;
        nameInput.dataset.storeSection = ing.storeSection || '';
        nameInput.dataset.emoji = emoji;
        
        const ingredientData = {
            name: ing.name,
            amount: parseFloat(ing.amount),
            nutrition: ing.nutrition,
            source: ing.source || 'custom',
            storeSection: ing.storeSection || '',
            emoji: emoji
        };
        selectedIngredients.set(fdcId, ingredientData);
        
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
        updateIngredientMacros(ingredientItem, ingredientData);
    });
    
    // Clear edit ID so it creates a new recipe instead of editing
    currentEditRecipeId = null;
    
    // Set the form handler
    recipeForm.onsubmit = handleRecipeSubmit;
    
    // Open the modal
    recipeModal.classList.add('active');
    
    // Update nutrition display
    updateTotalNutrition();
    
    console.log(`Recipe "${originalRecipe.name}" prepared for duplication`);
}

function updateRecipeList() {
    if (!recipeList) {
        console.log('Recipe list element not found, skipping update');
        return;
    }

    recipeList.innerHTML = '';
    const selectedCategory = categoryFilter ? categoryFilter.value : 'all';
    const searchTerm = document.getElementById('recipe-search') ? document.getElementById('recipe-search').value.toLowerCase().trim() : '';
    
    let filteredRecipes = selectedCategory === 'all' 
        ? recipes 
        : recipes.filter(recipe => recipe.category === selectedCategory);

    // Apply search filter if search term is provided
    if (searchTerm) {
        filteredRecipes = filteredRecipes.filter(recipe => {
            return recipe.name.toLowerCase().includes(searchTerm) ||
                   recipe.ingredients.some(ing => ing.name.toLowerCase().includes(searchTerm)) ||
                   (recipe.steps && recipe.steps.toLowerCase().includes(searchTerm));
        });
    }

    filteredRecipes.forEach(recipe => {
        recipeList.appendChild(createRecipeCard(recipe));
    });
}

// Make recipes available globally for other modules
window.recipes = recipes;
window.addRecipe = addRecipe;
window.editRecipe = editRecipe;
window.duplicateRecipe = duplicateRecipe;
window.deleteRecipe = deleteRecipe; 