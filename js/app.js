import config from './config.js';
import { version } from './version.js';
import './mealplan.js';
import { initializeMealPlanner } from './mealplan.js';
import { settings, normalizeThemeSettings } from './settings.js';
import { showAlert } from './alert.js';
import { searchUSDAIngredients } from './usda-api.js';
import { searchOpenFoodFactsIngredients } from './open-food-facts-api.js';

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
    // Set up serving size event listener
    setupServingSizeListener();
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
    // Reset serving size listener flag for next time
    const servingSizeInput = document.getElementById('recipe-serving-size');
    if (servingSizeInput) {
        servingSizeInput.removeAttribute('data-listener-added');
    }
    servingSizeListenerSetup = false;
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
    // Handle division by zero case
    const perServing = totalWeight > 0 ? {
        calories: Math.round(totals.calories * (servingSize / totalWeight)),
        protein: Math.round(totals.protein * (servingSize / totalWeight) * 10) / 10,
        carbs: Math.round(totals.carbs * (servingSize / totalWeight) * 10) / 10,
        fat: Math.round(totals.fat * (servingSize / totalWeight) * 10) / 10
    } : {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0
    };

    // Round total recipe values
    const totalRecipe = {
        calories: Math.round(totals.calories),
        protein: Math.round(totals.protein),
        carbs: Math.round(totals.carbs),
        fat: Math.round(totals.fat)
    };

    // Update display if elements exist (per-serving values - legacy support)
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

    // Update recipe totals display - show per-serving values
    const recipeTotalsSection = document.getElementById('recipe-totals');
    const recipeTotalCalories = document.getElementById('recipe-total-calories');
    const recipeTotalProtein = document.getElementById('recipe-total-protein');
    const recipeTotalCarbs = document.getElementById('recipe-total-carbs');
    const recipeTotalFat = document.getElementById('recipe-total-fat');

    if (recipeTotalCalories) recipeTotalCalories.textContent = perServing.calories;
    if (recipeTotalProtein) recipeTotalProtein.textContent = `${perServing.protein}g`;
    if (recipeTotalCarbs) recipeTotalCarbs.textContent = `${perServing.carbs}g`;
    if (recipeTotalFat) recipeTotalFat.textContent = `${perServing.fat}g`;
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

// Set up event listener for serving size input
let servingSizeListenerSetup = false;
function setupServingSizeListener() {
    const servingSizeInput = document.getElementById('recipe-serving-size');
    if (!servingSizeInput) return;
    
    // Only set up listener once to avoid duplicates
    if (servingSizeListenerSetup && servingSizeInput.dataset.listenerAdded === 'true') {
        return;
    }
    
    // Add event listener to update nutrition when serving size changes
    servingSizeInput.addEventListener('input', () => {
        updateTotalNutrition();
    });
    servingSizeInput.dataset.listenerAdded = 'true';
    servingSizeListenerSetup = true;
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
            const amount = parseFloat(item.querySelector('.ingredient-amount').value) || 0;
            // Calculate total price for this ingredient amount if pricePerGram is available
            let totalPrice = null;
            if (ingredientData.pricePerGram && amount > 0) {
                totalPrice = ingredientData.pricePerGram * amount;
            }
            
            return {
                fdcId: fdcId,
                name: ingredientData.name,
                amount: amount,
                nutrition: ingredientData.nutrition,
                source: ingredientData.source || 'usda', // Default to usda for backward compatibility
                storeSection: ingredientData.storeSection || '',
                emoji: ingredientData.emoji || '',
                pricePerGram: ingredientData.pricePerGram || null,
                pricePer100g: ingredientData.pricePer100g || null,
                totalPrice: totalPrice
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
                theme: 'light',
                darkMode: false
            };
        }
        normalizeThemeSettings(window.settings);

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
            themeToggle.checked = window.settings.darkMode === true;
            themeToggle.addEventListener('change', (e) => {
                applyThemePreload();
                window.settings.theme = e.target.checked ? 'dark' : 'light';
                window.settings.darkMode = e.target.checked;
                normalizeThemeSettings(window.settings);
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
            const initialDark = window.settings.darkMode === true;
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
                const searchResultsElement = document.getElementById('search-results');
                if (searchResultsElement) {
                    if (query.length < 2) {
                        searchResultsElement.innerHTML = '<div class="no-results">Please enter at least 2 characters to search</div>';
                        return;
                    }
                    searchResultsElement.innerHTML = '<div class="loading">Searching custom ingredients, USDA database, and Open Food Facts...</div>';
                    try {
                        console.log('=== STARTING SEARCH ===');
                        console.log('Query:', query);
                        const results = await searchAllIngredients(query);
                        console.log('=== SEARCH COMPLETE ===');
                        console.log('Total results:', results.length);
                        console.log('Results breakdown:', {
                            custom: results.filter(r => r.source === 'custom').length,
                            usda: results.filter(r => r.source === 'usda').length,
                            openfoodfacts: results.filter(r => r.source === 'openfoodfacts').length,
                            total: results.length
                        });
                        await displaySearchResults(results);
                    } catch (error) {
                        console.error('Error searching ingredients:', error);
                        searchResultsElement.innerHTML = '<div class="error">Error searching ingredients. Please try again.</div>';
                    }
                } else {
                    console.error('Search results element not found');
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
            
            // Also allow real-time search as user types
            ingredientSearchInput.addEventListener('input', async (e) => {
                const query = e.target.value.trim();
                const searchResultsElement = document.getElementById('search-results');
                if (searchResultsElement && query.length >= 2) {
                    clearTimeout(modalSearchTimeout);
                    modalSearchTimeout = setTimeout(async () => {
                        searchResultsElement.innerHTML = '<div class="loading">Searching custom ingredients, USDA database, and Open Food Facts...</div>';
                        try {
                            console.log('=== STARTING TYPED SEARCH ===');
                            console.log('Query:', query);
                            const results = await searchAllIngredients(query);
                            console.log('=== TYPED SEARCH COMPLETE ===');
                            console.log('Total results:', results.length);
                            console.log('Results breakdown:', {
                                custom: results.filter(r => r.source === 'custom').length,
                                usda: results.filter(r => r.source === 'usda').length,
                                openfoodfacts: results.filter(r => r.source === 'openfoodfacts').length,
                                total: results.length
                            });
                            await displaySearchResults(results);
                        } catch (error) {
                            console.error('Error searching ingredients:', error);
                            searchResultsElement.innerHTML = '<div class="error">Error searching ingredients. Please try again.</div>';
                        }
                    }, 300);
                } else if (searchResultsElement && query.length === 0) {
                    searchResultsElement.innerHTML = '';
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
    if (!printWindow) {
        showAlert('Unable to open print preview. Please allow pop-ups for this site.', { type: 'error' });
        return;
    }

    const escapeHtml = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
    const steps = typeof recipe.steps === 'string' ? recipe.steps.trim() : '';
    const nutrition = recipe.nutrition || {};
    const totalWeight = ingredients.reduce((sum, ing) => {
        const amount = parseFloat(ing.amount);
        return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);
    const servingSize = parseFloat(recipe.servingSize);
    const servings = Number.isFinite(totalWeight) && Number.isFinite(servingSize) && servingSize > 0
        ? Math.round((totalWeight / servingSize) * 10) / 10
        : null;

    const ingredientItems = ingredients.length
        ? ingredients.map(ing => {
            const amount = parseFloat(ing.amount);
            const amountLabel = Number.isFinite(amount) ? `${Math.round(amount * 10) / 10}g` : '';
            const emoji = (ing.emoji || '').trim();
            const name = emoji
                ? `${emoji} ${escapeHtml(ing.name || 'Ingredient')}`
                : escapeHtml(ing.name || 'Ingredient');
            const macros = ing.nutrition
                ? {
                    calories: Math.round(ing.nutrition.calories * (Number.isFinite(amount) ? amount : 0)),
                    protein: Math.round(ing.nutrition.protein * (Number.isFinite(amount) ? amount : 0)),
                    carbs: Math.round(ing.nutrition.carbs * (Number.isFinite(amount) ? amount : 0)),
                    fat: Math.round(ing.nutrition.fat * (Number.isFinite(amount) ? amount : 0))
                }
                : null;
            const macroLine = macros
                ? `<span class="ingredient-macros">Cal ${macros.calories} · P ${macros.protein}g · C ${macros.carbs}g · F ${macros.fat}g</span>`
                : '';
            return `
                <li>
                    <div class="ingredient-line">
                        <span class="ingredient-name">${name}</span>
                        ${amountLabel ? `<span class="ingredient-amount">${amountLabel}</span>` : ''}
                    </div>
                    ${macroLine}
                </li>
            `;
        }).join('')
        : '<li>No ingredients listed</li>';

    const instructionSteps = steps
        ? steps.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
        : [];
    const instructionsHtml = instructionSteps.length
        ? `<ol class="print-recipe-steps">${instructionSteps.map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol>`
        : '<p class="print-recipe-empty">No instructions provided.</p>';

    const generatedDate = new Date().toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });

    const recipeHtml = `
        <article class="print-recipe detailed">
            <header class="print-recipe-header">
                <h2 class="print-recipe-title">${escapeHtml(recipe.name)}</h2>
                <div class="print-recipe-meta">
                    ${recipe.category ? `<span class="print-recipe-category">${escapeHtml(recipe.category)}</span>` : ''}
                    ${Number.isFinite(servings) ? `<span class="print-recipe-servings">~${servings} servings</span>` : ''}
                    ${Number.isFinite(servingSize) ? `<span class="print-recipe-serving-size">${servingSize}g serving size</span>` : ''}
                </div>
            </header>
            <div class="print-recipe-summary">
                <div><strong>Cal:</strong> ${Number.isFinite(nutrition.calories) ? nutrition.calories : '—'}</div>
                <div><strong>P:</strong> ${Number.isFinite(nutrition.protein) ? `${nutrition.protein}g` : '—'}</div>
                <div><strong>C:</strong> ${Number.isFinite(nutrition.carbs) ? `${nutrition.carbs}g` : '—'}</div>
                <div><strong>F:</strong> ${Number.isFinite(nutrition.fat) ? `${nutrition.fat}g` : '—'}</div>
            </div>
            <section class="print-recipe-section">
                <h3 class="print-section-title">Ingredients</h3>
                <ul class="recipe-ingredient-list">
                    ${ingredientItems}
                </ul>
            </section>
            <section class="print-recipe-section">
                <h3 class="print-section-title">Instructions</h3>
                ${instructionsHtml}
            </section>
        </article>
    `;

    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${escapeHtml(recipe.name)} - Meal-E Recipe</title>
            <style>
                @media print {
                    @page {
                        size: portrait;
                        margin: 0.5in;
                    }
                }

                body {
                    font-family: 'Inter', 'Segoe UI', Tahoma, sans-serif;
                    margin: 0;
                    padding: 0.5in;
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

                .print-recipes {
                    margin-top: 24px;
                    column-count: 2;
                    column-gap: 16px;
                    page-break-before: auto;
                }

                .print-recipes.single {
                    column-count: 1;
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

                .print-recipe-servings,
                .print-recipe-serving-size {
                    font-weight: 500;
                }

                .print-recipe-summary {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(80px, 1fr));
                    gap: 4px;
                    background: #f4f8f6;
                    border: 1px solid #d1ede1;
                    border-radius: 6px;
                    padding: 8px;
                    margin-bottom: 10px;
                }

                .print-recipe-section {
                    margin-top: 10px;
                }

                .print-section-title {
                    font-size: 8.2pt;
                    font-weight: 600;
                    color: #0f172a;
                    margin: 0 0 6px;
                    letter-spacing: 0.03em;
                    text-transform: uppercase;
                }

                .recipe-ingredient-list {
                    margin: 0;
                    padding-left: 14px;
                    font-size: 7.6pt;
                    color: #1f2937;
                }

                .recipe-ingredient-list li {
                    margin-bottom: 4px;
                    list-style: disc;
                }

                .ingredient-line {
                    display: flex;
                    justify-content: space-between;
                    gap: 8px;
                }

                .ingredient-name {
                    font-weight: 600;
                    color: #0f172a;
                }

                .ingredient-amount {
                    color: #475569;
                    white-space: nowrap;
                }

                .ingredient-macros {
                    display: block;
                    margin-top: 2px;
                    color: #6b7280;
                    font-size: 7pt;
                }

                .print-recipe-steps {
                    margin: 0;
                    padding-left: 16px;
                    font-size: 7.6pt;
                    color: #1f2937;
                }

                .print-recipe-steps li {
                    margin-bottom: 6px;
                }

                .print-recipe-empty {
                    margin: 0;
                    font-size: 7.2pt;
                    color: #6b7280;
                    font-style: italic;
                }
            </style>
        </head>
        <body>
            <div class="print-header">
                <div class="print-title">
                    <h1>Meal-E Recipe</h1>
                    <p class="print-subtitle">${escapeHtml(recipe.name)}</p>
                </div>
                <div class="print-meta">
                    <span>${generatedDate}</span>
                    ${window.settings?.profile?.name ? `<span>${escapeHtml(window.settings.profile.name)}</span>` : ''}
                </div>
            </div>
            <div class="print-recipes single">
                ${recipeHtml}
            </div>
        </body>
        </html>
    `);

    printWindow.document.close();

    printWindow.onload = () => {
        printWindow.focus();
        printWindow.print();
    };

    printWindow.addEventListener('afterprint', () => {
        printWindow.close();
    });
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
                <button type="button" class="remove-ingredient btn btn-ghost btn-icon" aria-label="Remove ingredient">&times;</button>
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
            emoji: emoji,
            pricePerGram: ing.pricePerGram || null,
            pricePer100g: ing.pricePer100g || null,
            totalPrice: ing.totalPrice || null
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
    // Set up serving size event listener
    setupServingSizeListener();
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
    
    // Enable inline search directly in the text box (no modal)
    const nameInput = ingredientInput.querySelector('.ingredient-name');
    if (nameInput) {
        nameInput.readOnly = false;
        nameInput.placeholder = 'Type to search custom ingredients, USDA database, or Open Food Facts...';
        nameInput.focus();
        
        // Remove existing event listeners by cloning (clean way to remove all listeners)
        const oldValue = nameInput.value;
        const newNameInput = nameInput.cloneNode(true);
        newNameInput.value = oldValue;
        nameInput.parentNode.replaceChild(newNameInput, nameInput);
        
        // Add event listeners for inline search
        newNameInput.addEventListener('input', handleInlineSearch);
        newNameInput.addEventListener('blur', handleIngredientBlur);
        
        // Update currentIngredientInput reference to use the new input
        currentIngredientInput = ingredientInput;
    }
}

// Function to open the ingredient search modal
function openIngredientSearchModal() {
    const searchModal = document.getElementById('ingredient-search-modal');
    const ingredientSearchInput = document.getElementById('ingredient-search-input');
    const searchResultsElement = document.getElementById('search-results');
    
    if (searchModal) {
        searchModal.classList.add('active');
        if (ingredientSearchInput) {
            ingredientSearchInput.focus();
            ingredientSearchInput.value = '';
        }
        if (searchResultsElement) {
            searchResultsElement.innerHTML = '';
        }
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
let modalSearchTimeout;
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
    // Use a longer delay to ensure click events on dropdown items fire first
    setTimeout(() => {
        // Only remove if the focus didn't move to the dropdown
        const activeElement = document.activeElement;
        const dropdown = document.querySelector('.ingredient-search-dropdown');
        if (!dropdown || !dropdown.contains(activeElement)) {
            removeSearchDropdown();
        }
    }, 300);
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
        let sourceLabel = 'Custom Ingredient';
        let sourceIcon = '🏠';
        if (result.source === 'usda') {
            sourceLabel = 'USDA Database';
            sourceIcon = '🌾';
        } else if (result.source === 'openfoodfacts') {
            sourceLabel = 'Open Food Facts';
            sourceIcon = '🏷️';
        }
        item.innerHTML = `
            <div style="font-weight: 600;">${sourceIcon} ${result.name}</div>
            <div style="font-size: 0.8em; color: #666;">${result.brandOwner || sourceLabel}</div>
        `;
        
        item.addEventListener('mousedown', (e) => {
            e.preventDefault(); // Prevent blur event from firing before click
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
        // Generate unique ID based on source
        const emoji = (ingredient.emoji || '').trim();
        let storageId;
        if (ingredient.source === 'usda') {
            storageId = `usda-${ingredient.fdcId}`;
        } else if (ingredient.source === 'openfoodfacts') {
            storageId = `off-${ingredient.fdcId || ingredient.id}`;
        } else {
            storageId = `custom-${ingredient.id || Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        }
        
        nameInput.dataset.fdcId = storageId;
        nameInput.dataset.storeSection = ingredient.storeSection || '';
        nameInput.dataset.emoji = emoji;
        const displayName = emoji ? `${emoji} ${ingredient.name}` : ingredient.name;
        nameInput.value = displayName;
        nameInput.readOnly = true;
        nameInput.placeholder = 'Search for ingredient';
        
        // Store ingredient data - ensure nutrition is properly structured
        const nutrition = ingredient.nutrition || {
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0
        };
        
        // Log the raw nutrition data we received
        console.log('Raw nutrition data from ingredient:', {
            ingredientName: ingredient.name,
            source: ingredient.source,
            rawNutrition: nutrition,
            hasNutrition: !!ingredient.nutrition,
            nutritionKeys: ingredient.nutrition ? Object.keys(ingredient.nutrition) : []
        });
        
        // Validate nutrition data exists
        if (!nutrition || (nutrition.calories === 0 && nutrition.protein === 0 && nutrition.carbs === 0 && nutrition.fat === 0)) {
            console.warn('⚠️ Ingredient has no nutrition data:', {
                name: ingredient.name,
                source: ingredient.source,
                nutrition: nutrition,
                fullIngredient: ingredient
            });
        }
        
        // Set default amount to 100g if empty
        const defaultAmount = parseFloat(amountInput.value) || 100;
        if (!amountInput.value || amountInput.value === '0') {
            amountInput.value = '100';
        }
        
        // Ensure nutrition values are numbers (handle any string conversions)
        const safeNutrition = {
            calories: Number(nutrition.calories) || 0,
            protein: Number(nutrition.protein) || 0,
            carbs: Number(nutrition.carbs) || 0,
            fat: Number(nutrition.fat) || 0
        };
        
        const ingredientData = {
            name: ingredient.name,
            amount: defaultAmount,
            nutrition: safeNutrition,
            source: ingredient.source || 'custom',
            id: ingredient.id || ingredient.fdcId,
            fdcId: ingredient.fdcId || storageId,
            storeSection: ingredient.storeSection || '',
            emoji: emoji,
            pricePerGram: ingredient.pricePerGram || null,
            pricePer100g: ingredient.pricePer100g || null,
            totalPrice: ingredient.totalPrice || null
        };
        
        console.log('Storing ingredient data:', {
            name: ingredientData.name,
            source: ingredientData.source,
            nutrition: ingredientData.nutrition,
            amount: ingredientData.amount,
            originalIngredientNutrition: ingredient.nutrition
        });
        
        // Verify nutrition values are valid numbers
        if (ingredientData.nutrition.calories > 0 || ingredientData.nutrition.protein > 0) {
            console.log('✅ Nutrition data looks good:', ingredientData.nutrition);
        } else {
            console.warn('⚠️ Nutrition data is all zeros!', {
                ingredientName: ingredient.name,
                source: ingredient.source,
                originalNutrition: ingredient.nutrition,
                storedNutrition: ingredientData.nutrition
            });
        }
        
        selectedIngredients.set(storageId, ingredientData);
        
        // Update nutrition display
        console.log('Calling updateIngredientMacros with:', {
            ingredientName: ingredientData.name,
            amount: ingredientData.amount,
            nutrition: ingredientData.nutrition,
            currentIngredientInput: currentIngredientInput,
            hasMacrosContainer: currentIngredientInput ? !!currentIngredientInput.querySelector('.ingredient-macros') : false
        });
        
        if (!currentIngredientInput) {
            console.error('⚠️ CRITICAL: currentIngredientInput is null! Cannot update macros.');
            return;
        }
        
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
    
    // Search custom ingredients first (faster, local)
    // Prioritize exact matches and starts-with matches
    const queryLower = query.toLowerCase().trim();
    const customIngredients = JSON.parse(localStorage.getItem('meale-custom-ingredients') || '[]');
    
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
        const emoji = (ingredient.emoji || '').trim();
        results.push({
            id: ingredient.id,
            fdcId: `custom-${ingredient.id}`, // Custom ID for tracking
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
    
    // Search USDA API (async, network call) - for generic foods
    // Only get the most relevant result
    try {
        console.log('Searching USDA API for:', query);
        const usdaResults = await searchUSDAIngredients(query, 20); // Get more to find best match
        console.log('USDA API returned', usdaResults.length, 'results');
        
        if (usdaResults && usdaResults.length > 0) {
            // Find the most relevant USDA result
            const queryLower = query.toLowerCase().trim();
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
                results.push(bestUSDAResult.result);
                console.log('Added best USDA result:', bestUSDAResult.result.name, 'relevance:', bestUSDAResult.relevance);
            }
        } else {
            console.warn('USDA API returned empty results for query:', query);
        }
    } catch (error) {
        console.error('Error searching USDA API:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            query: query
        });
        
        // Show user-friendly error if API key is missing
        if (error.message && error.message.includes('API key is required')) {
            console.warn('⚠️ USDA API key missing. Get a free key at: https://fdc.nal.usda.gov/api-key-signup.html');
        }
        
        // Continue with other sources if USDA fails
    }
    
    // Search Open Food Facts API (async, network call) - for branded products
    // Only get the most relevant result
    try {
        console.log('Searching Open Food Facts API for:', query);
        const offResults = await searchOpenFoodFactsIngredients(query, 20); // Get more to find best match
        console.log('Open Food Facts API returned', offResults.length, 'results');
        
        if (offResults && offResults.length > 0) {
            // Find the most relevant Open Food Facts result
            const queryLower = query.toLowerCase().trim();
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
                results.push(bestOFFResult.result);
                console.log('Added best Open Food Facts result:', bestOFFResult.result.name, 'relevance:', bestOFFResult.relevance);
            }
        } else {
            console.warn('Open Food Facts API returned empty results for query:', query);
        }
    } catch (error) {
        console.error('Error searching Open Food Facts API:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            query: query
        });
        // Continue with other sources if Open Food Facts fails
    }
    
    // Sort results: custom ingredients first, then Open Food Facts (branded), then USDA (generic), then alphabetically
    results.sort((a, b) => {
        // Custom ingredients first
        if (a.source === 'custom' && b.source !== 'custom') return -1;
        if (a.source !== 'custom' && b.source === 'custom') return 1;
        // Then Open Food Facts (branded products)
        if (a.source === 'openfoodfacts' && b.source !== 'openfoodfacts') return -1;
        if (a.source !== 'openfoodfacts' && b.source === 'openfoodfacts') return 1;
        // Then USDA (generic foods)
        if (a.source === 'usda' && b.source !== 'usda') return -1;
        if (a.source !== 'usda' && b.source === 'usda') return 1;
        // Then alphabetically
        return a.name.localeCompare(b.name);
    });
    
    return results;
}

// Modified Ingredient Search Result Handler
async function displaySearchResults(results) {
    const searchResultsElement = document.getElementById('search-results');
    if (!searchResultsElement) {
        console.error('Search results element not found');
        return;
    }
    
    searchResultsElement.innerHTML = '';
    
    if (results.length === 0) {
        searchResultsElement.innerHTML = '<div class="no-results">No matching ingredients found</div>';
        return;
    }
    
    for (const ingredient of results) {
        const div = document.createElement('div');
        div.className = 'search-result-item';
        
        // Create visual indicator for ingredient source
        let sourceConfig = { icon: '🏠', label: 'Custom Ingredient' };
        if (ingredient.source === 'usda') {
            sourceConfig = { icon: '🌾', label: 'USDA Database' };
        } else if (ingredient.source === 'openfoodfacts') {
            sourceConfig = { icon: '🏷️', label: 'Open Food Facts' };
        }
        
        const [mainName, ...details] = ingredient.name.split(',');
        const emoji = (ingredient.emoji || '').trim();
        div.innerHTML = `
            <div class="search-result-header">
                <span class="source-indicator ${ingredient.source}">
                    ${sourceConfig.icon} ${sourceConfig.label}
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
                
                // Handle ingredient (custom, USDA, or Open Food Facts)
                // Ensure nutrition is properly structured
                const nutrition = ingredient.nutrition || {
                    calories: 0,
                    protein: 0,
                    carbs: 0,
                    fat: 0
                };
                
                // Validate nutrition data exists
                if (!nutrition || (nutrition.calories === 0 && nutrition.protein === 0 && nutrition.carbs === 0 && nutrition.fat === 0)) {
                    console.warn('Ingredient has no nutrition data:', {
                        name: ingredient.name,
                        source: ingredient.source,
                        nutrition: nutrition
                    });
                }
                
                const ingredientData = {
                    name: ingredient.name,
                    amount: parseFloat(currentIngredientInput.querySelector('.ingredient-amount').value) || 0,
                    nutrition: {
                        calories: nutrition.calories || 0,
                        protein: nutrition.protein || 0,
                        carbs: nutrition.carbs || 0,
                        fat: nutrition.fat || 0
                    },
                    source: ingredient.source || 'custom',
                    id: ingredient.id || ingredient.fdcId,
                    fdcId: ingredient.fdcId || `custom-${ingredient.id}`,
                    storeSection: ingredient.storeSection || '',
                    emoji: emoji,
                    pricePerGram: ingredient.pricePerGram || null,
                    pricePer100g: ingredient.pricePer100g || null,
                    totalPrice: ingredient.totalPrice || null
                };
                
                console.log('Storing ingredient from modal:', {
                    name: ingredientData.name,
                    source: ingredientData.source,
                    nutrition: ingredientData.nutrition,
                    amount: ingredientData.amount
                });
                
                // Store in selectedIngredients with appropriate ID
                let storageId;
                if (ingredient.source === 'usda') {
                    storageId = `usda-${ingredient.fdcId}`;
                } else if (ingredient.source === 'openfoodfacts') {
                    storageId = `off-${ingredient.fdcId || ingredient.id}`;
                } else {
                    storageId = `custom-${ingredient.id}`;
                }
                selectedIngredients.set(storageId, ingredientData);
                
                // Update the input field
                const nameField = currentIngredientInput.querySelector('.ingredient-name');
                if (nameField) {
                    const displayName = emoji ? `${emoji} ${ingredient.name}` : ingredient.name;
                    nameField.value = displayName;
                    nameField.dataset.fdcId = storageId;
                    nameField.dataset.storeSection = ingredient.storeSection || '';
                    nameField.dataset.emoji = emoji;
                }
                
                // Update ingredient macros
                updateIngredientMacros(currentIngredientInput, ingredientData);
                
                // Update nutrition display
                updateTotalNutrition();
                removeSearchDropdown();
            } catch (error) {
                console.error('Error selecting ingredient:', error);
                showAlert('Error selecting ingredient. Please try again.', { type: 'error' });
            }
        });
        
        searchResultsElement.appendChild(div);
    }
}

// Modified Ingredient Input Handler
function addIngredientInput() {
    const ingredientItem = document.createElement('div');
    ingredientItem.className = 'ingredient-item';
    ingredientItem.innerHTML = `
        <div class="ingredient-main">
            <input type="text" class="ingredient-name" placeholder="Search for ingredient" required readonly>
            <input type="number" class="ingredient-amount" placeholder="Grams" min="0" step="0.1" required value="100">
            <button type="button" class="remove-ingredient btn btn-ghost btn-icon" aria-label="Remove ingredient">&times;</button>
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
            const newAmount = parseFloat(amountInput.value) || 0;
            ingredient.amount = newAmount;
            selectedIngredients.set(fdcId, ingredient);
            console.log('Amount changed for', ingredient.name, 'to', newAmount, 'g');
            updateIngredientMacros(ingredientItem, ingredient);
            updateServingSizeDefault();
        } else {
            console.warn('Amount changed but ingredient not found in selectedIngredients:', fdcId);
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
    
    // Ensure nutrition object exists and has all required fields
    const nutrition = ingredient.nutrition || {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0
    };
    
    // Validate nutrition values are numbers
    const safeNutrition = {
        calories: Number.isFinite(nutrition.calories) ? nutrition.calories : 0,
        protein: Number.isFinite(nutrition.protein) ? nutrition.protein : 0,
        carbs: Number.isFinite(nutrition.carbs) ? nutrition.carbs : 0,
        fat: Number.isFinite(nutrition.fat) ? nutrition.fat : 0
    };
    
    const macros = {
        calories: Math.round(safeNutrition.calories * amount),
        protein: Math.round(safeNutrition.protein * amount),
        carbs: Math.round(safeNutrition.carbs * amount),
        fat: Math.round(safeNutrition.fat * amount)
    };
    
    console.log('updateIngredientMacros calculation:', {
        ingredientName: ingredient.name,
        amount: amount,
        nutritionPerGram: safeNutrition,
        calculatedMacros: macros
    });
    
    // Log if macros are zero but we have nutrition data
    if (amount > 0 && macros.calories === 0 && macros.protein === 0 && macros.carbs === 0 && macros.fat === 0) {
        console.warn('⚠️ updateIngredientMacros: All macros are zero', {
            ingredientName: ingredient.name,
            amount: amount,
            nutrition: safeNutrition,
            source: ingredient.source,
            rawNutrition: nutrition
        });
    }

    // Find the macros container first
    const macrosContainer = ingredientItem.querySelector('.ingredient-macros');
    if (!macrosContainer) {
        console.error('⚠️ CRITICAL: .ingredient-macros container not found!', {
            ingredientItem: ingredientItem,
            ingredientItemHTML: ingredientItem.innerHTML.substring(0, 200),
            ingredientName: ingredient.name
        });
        return; // Can't update if structure is wrong
    }
    
    const caloriesEl = macrosContainer.querySelector('.calories');
    const proteinEl = macrosContainer.querySelector('.protein');
    const carbsEl = macrosContainer.querySelector('.carbs');
    const fatEl = macrosContainer.querySelector('.fat');
    
    console.log('DOM elements found:', {
        macrosContainer: !!macrosContainer,
        caloriesEl: !!caloriesEl,
        proteinEl: !!proteinEl,
        carbsEl: !!carbsEl,
        fatEl: !!fatEl,
        macrosToSet: macros,
        ingredientItemClasses: ingredientItem.className
    });
    
    if (!caloriesEl || !proteinEl || !carbsEl || !fatEl) {
        console.error('⚠️ CRITICAL: One or more macro elements not found!', {
            caloriesEl: !!caloriesEl,
            proteinEl: !!proteinEl,
            carbsEl: !!carbsEl,
            fatEl: !!fatEl,
            macrosHTML: macrosContainer.innerHTML
        });
        return;
    }
    
    // Update all macro values
    caloriesEl.textContent = macros.calories;
    proteinEl.textContent = macros.protein;
    carbsEl.textContent = macros.carbs;
    fatEl.textContent = macros.fat;
    
    console.log('✅ Successfully updated macros:', {
        calories: macros.calories,
        protein: macros.protein,
        carbs: macros.carbs,
        fat: macros.fat
    });
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

async function deleteRecipe(id) {
    const recipe = recipes.find(r => r.id === id);
    const recipeName = recipe?.name ? `"${recipe.name}"` : 'this recipe';

    const confirmed = await showAlert(
        `Are you sure you want to delete ${recipeName}? This action cannot be undone.`,
        {
            title: 'Delete Recipe',
            type: 'warning',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            confirmButtonClass: 'btn btn-delete app-alert__confirm',
            cancelButtonClass: 'btn btn-secondary app-alert__cancel'
        }
    );

    if (!confirmed) {
        return;
    }

    recipes = recipes.filter(recipe => recipe.id !== id);
    updateRecipeList();
    saveToLocalStorage();
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
                <button type="button" class="remove-ingredient btn btn-ghost btn-icon" aria-label="Remove ingredient">&times;</button>
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