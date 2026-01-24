console.log('[APP] Starting app.js module load...');
console.log('[APP] Current URL:', window.location.href);
console.log('[APP] Document ready state:', document.readyState);

import config from './config.js';
console.log('[APP] Config loaded:', config);

import { version } from './version.js';
console.log('[APP] Version loaded:', version.toString());

import './mealplan.js';
import { initializeMealPlanner } from './mealplan.js';
console.log('[APP] Meal planner module loaded');

import { settings, normalizeThemeSettings } from './settings.js';
console.log('[APP] Settings module loaded');

import { showAlert } from './alert.js';
import { renderIcon } from './icon-utils.js';
console.log('[APP] All modules imported successfully');

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

// Recipe table sort state (recipes page)
let recipeSortColumn = 'name';
let recipeSortDirection = 'asc';

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
    try {
    const recipeModal = document.getElementById('recipe-modal');
    if (!recipeModal) {
        console.log('Recipe modal not found');
        return;
    }
    recipeModal.classList.add('active');
    // Add first ingredient input if none exists
        const ingredientsList = document.getElementById('ingredients-list');
        if (ingredientsList && ingredientsList.children.length === 0) {
            try {
        addIngredientInput();
            } catch (error) {
                console.error('Error adding ingredient input:', error);
            }
    }
    // Set up serving size event listener
        try {
    setupServingSizeListener();
        } catch (error) {
            console.error('Error setting up serving size listener:', error);
    }
    // Initialize nutrition display
        try {
    updateTotalNutrition();
        } catch (error) {
            console.error('Error updating total nutrition:', error);
        }
    } catch (error) {
        console.error('Error opening modal:', error);
    }
}

function closeModalHandler() {
    const recipeModal = document.getElementById('recipe-modal');
    if (!recipeModal) {
        console.log('Recipe modal not found');
        return;
    }
    recipeModal.classList.remove('active');
    const recipeForm = document.getElementById('recipe-form');
    if (recipeForm) {
    recipeForm.reset();
    }
    const ingredientsList = document.getElementById('ingredients-list');
    if (ingredientsList) {
    ingredientsList.innerHTML = '';
    }
    selectedIngredients.clear();
    currentEditRecipeId = null;
    // Reset serving size listener flag for next time
    const servingSizeInput = document.getElementById('recipe-serving-size');
    if (servingSizeInput) {
        servingSizeInput.removeAttribute('data-listener-added');
    }
    servingSizeListenerSetup = false;
    window.dispatchEvent(new CustomEvent('recipe-modal-closed'));
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


// My Ingredients Search Functions
function searchCustomIngredients(query) {
    // Helper function to get my ingredients with migration support
    function getMyIngredients() {
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
    const customIngredients = getMyIngredients();
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
        fat: 0,
        cost: 0
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
            // Calculate cost
            if (ingredient && ingredient.pricePerGram && amount > 0) {
                totals.cost += ingredient.pricePerGram * amount;
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

    // Calculate cost per serving
    const costPerServing = totalWeight > 0 && totals.cost > 0 
        ? totals.cost * (servingSize / totalWeight) 
        : 0;

    // Update recipe totals display - show per-serving values
    const recipeTotalsSection = document.getElementById('recipe-totals');
    const recipeTotalCalories = document.getElementById('recipe-total-calories');
    const recipeTotalProtein = document.getElementById('recipe-total-protein');
    const recipeTotalCarbs = document.getElementById('recipe-total-carbs');
    const recipeTotalFat = document.getElementById('recipe-total-fat');
    const recipeTotalCost = document.getElementById('recipe-total-cost');
    const recipeCostPerServing = document.getElementById('recipe-cost-per-serving');

    if (recipeTotalCalories) recipeTotalCalories.textContent = perServing.calories;
    if (recipeTotalProtein) recipeTotalProtein.textContent = `${perServing.protein}g`;
    if (recipeTotalCarbs) recipeTotalCarbs.textContent = `${perServing.carbs}g`;
    if (recipeTotalFat) recipeTotalFat.textContent = `${perServing.fat}g`;
    
    // Update cost displays
    if (recipeTotalCost) {
        if (totals.cost > 0) {
            recipeTotalCost.textContent = `$${totals.cost.toFixed(2)}`;
        } else {
            recipeTotalCost.textContent = 'N/A';
        }
    }
    if (recipeCostPerServing) {
        if (costPerServing > 0) {
            recipeCostPerServing.textContent = `$${costPerServing.toFixed(2)}`;
        } else {
            recipeCostPerServing.textContent = 'N/A';
        }
    }
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

// Recipe table: filtered list (search + category)
function getFilteredRecipes() {
    const searchEl = document.getElementById('recipe-search');
    const categoryEl = document.getElementById('category-filter');
    const searchTerm = (searchEl && searchEl.value) ? searchEl.value.toLowerCase().trim() : '';
    const selectedCategory = (categoryEl && categoryEl.value) ? categoryEl.value : 'all';

    return recipes.filter(recipe => {
        const matchesCategory = selectedCategory === 'all' || (recipe.category === selectedCategory);
        if (!matchesCategory) return false;
        if (!searchTerm) return true;
        const nameMatch = (recipe.name || '').toLowerCase().includes(searchTerm);
        const ingMatch = Array.isArray(recipe.ingredients) &&
            recipe.ingredients.some(ing => (ing.name || '').toLowerCase().includes(searchTerm));
        const stepsMatch = (typeof recipe.steps === 'string' && recipe.steps.toLowerCase().includes(searchTerm));
        return nameMatch || ingMatch || stepsMatch;
    });
}

// Recipe table: sorted list
function getSortedRecipes(list) {
    const arr = [...list];
    arr.sort((a, b) => {
        let va; let vb;
        switch (recipeSortColumn) {
            case 'name':
                va = (a.name || '').toLowerCase();
                vb = (b.name || '').toLowerCase();
                return recipeSortDirection === 'asc'
                    ? (va < vb ? -1 : va > vb ? 1 : 0)
                    : (vb < va ? -1 : vb > va ? 1 : 0);
            case 'category': {
                va = (a.category || '').toLowerCase();
                vb = (b.category || '').toLowerCase();
                return recipeSortDirection === 'asc'
                    ? va.localeCompare(vb)
                    : vb.localeCompare(va);
            }
            case 'servingSize':
                va = Number(a.servingSize) || 0;
                vb = Number(b.servingSize) || 0;
                return recipeSortDirection === 'asc' ? va - vb : vb - va;
            case 'calories': {
                const na = a.nutrition || {};
                const nb = b.nutrition || {};
                va = Number(na.calories) || 0;
                vb = Number(nb.calories) || 0;
                return recipeSortDirection === 'asc' ? va - vb : vb - va;
            }
            default:
                return 0;
        }
    });
    return arr;
}

// Update sort icons in recipes table header
function updateRecipeSortIcons() {
    const table = document.getElementById('recipes-table');
    if (!table) return;
    table.querySelectorAll('th.sortable').forEach(th => {
        const key = th.dataset.sort;
        const icon = th.querySelector('.sort-icon');
        if (!icon) return;
        if (key !== recipeSortColumn) {
            icon.textContent = '';
            icon.className = 'sort-icon';
            return;
        }
        icon.className = 'sort-icon sort-active';
        icon.textContent = recipeSortDirection === 'asc' ? ' \u25B2' : ' \u25BC';
    });
}

// Sortable header click (recipes table)
function onRecipeSortHeaderClick(event) {
    const th = event.target.closest('th.sortable');
    if (!th || !th.dataset.sort) return;
    const key = th.dataset.sort;
    if (recipeSortColumn === key) {
        recipeSortDirection = recipeSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        recipeSortColumn = key;
        recipeSortDirection = 'asc';
    }
    updateRecipeList();
}

// Create a table row for a recipe
function createRecipeRow(recipe) {
    const row = document.createElement('tr');
    const nutrition = recipe.nutrition || { calories: 0, protein: 0, carbs: 0, fat: 0 };
    const calories = Math.round(Number(nutrition.calories) || 0);
    const protein = (Number(nutrition.protein) || 0).toFixed(1);
    const carbs = (Number(nutrition.carbs) || 0).toFixed(1);
    const fat = (Number(nutrition.fat) || 0).toFixed(1);
    const servingSize = Number(recipe.servingSize) || 0;
    const category = (recipe.category || '').trim() || '—';
    const name = (recipe.name || '').trim() || 'Untitled';
    const id = recipe.id;

    row.innerHTML = `
        <td class="recipe-name-cell"><span class="recipe-name-text">${name}</span></td>
        <td>${category}</td>
        <td>${servingSize} <small>g</small></td>
        <td>${calories}</td>
        <td>
            <div class="macro-info">
                <span>P: ${protein}g</span>
                <span>C: ${carbs}g</span>
                <span>F: ${fat}g</span>
            </div>
        </td>
        <td>
            <div class="action-buttons">
                <button class="btn btn-edit" onclick="editRecipe(${id})" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-duplicate" onclick="duplicateRecipe(${id})" title="Duplicate">
                    <i class="fas fa-copy"></i>
                </button>
                <button class="btn btn-print" onclick="printRecipe(${id})" title="Print">
                    <i class="fas fa-print"></i>
                </button>
                <button class="btn btn-delete" onclick="deleteRecipe(${id})" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </td>
    `;
    return row;
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
                source: 'custom',
                store: ingredientData.store || '',
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
        if (!currentEditRecipeId) {
            window.dispatchEvent(new CustomEvent('recipe-created', { detail: { recipe: newRecipe } }));
        }
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
        console.log('[STORAGE] ===== Starting localStorage load =====');
        console.log('[STORAGE] localStorage available:', typeof Storage !== 'undefined');
        console.log('[STORAGE] localStorage quota check:', navigator.storage?.estimate ? 'available' : 'not available');
        
        // Check localStorage keys
        const allKeys = Object.keys(localStorage);
        console.log('[STORAGE] All localStorage keys:', allKeys);
        console.log('[STORAGE] Total keys in localStorage:', allKeys.length);
        
        const savedRecipes = localStorage.getItem('recipes');
        console.log('[STORAGE] Recipes key exists:', !!savedRecipes);
        if (savedRecipes) {
            try {
                const parsed = JSON.parse(savedRecipes);
                recipes = parsed;
                // Update global recipes
                window.recipes = recipes;
                console.log('[STORAGE] ✅ Loaded recipes successfully:', recipes.length, 'recipes');
                console.log('[STORAGE] Recipe IDs:', recipes.map(r => r.id || r.name).slice(0, 5));
            } catch (error) {
                console.error('[STORAGE] ❌ Error parsing saved recipes:', error);
                console.error('[STORAGE] Raw recipes data (first 200 chars):', savedRecipes?.substring(0, 200));
            }
        } else {
            console.log('[STORAGE] ⚠️ No saved recipes found in localStorage');
        }

        const savedMealPlan = localStorage.getItem('mealPlan');
        console.log('[STORAGE] MealPlan key exists:', !!savedMealPlan);
        if (savedMealPlan) {
            try {
                mealPlan = JSON.parse(savedMealPlan);
                const mealPlanKeys = Object.keys(mealPlan);
                console.log('[STORAGE] ✅ Loaded meal plan successfully');
                console.log('[STORAGE] Meal plan dates:', mealPlanKeys.slice(0, 5));
            } catch (error) {
                console.error('[STORAGE] ❌ Error parsing saved meal plan:', error);
            }
        } else {
            console.log('[STORAGE] ⚠️ No saved meal plan found in localStorage');
        }

        const savedNutrition = localStorage.getItem('meale-nutrition');
        console.log('[STORAGE] Nutrition key exists:', !!savedNutrition);
        if (savedNutrition) {
            try {
                nutritionData = JSON.parse(savedNutrition);
                console.log('[STORAGE] ✅ Loaded nutrition data successfully:', nutritionData);
            } catch (error) {
                console.error('[STORAGE] ❌ Error parsing saved nutrition data:', error);
            }
        } else {
            console.log('[STORAGE] ⚠️ No saved nutrition data found in localStorage');
        }
        
        console.log('[STORAGE] ===== localStorage load complete =====');
    } catch (error) {
        console.error('[STORAGE] ❌ Fatal error loading from localStorage:', error);
        console.error('[STORAGE] Error stack:', error.stack);
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
    console.log('[INIT] ===== App initialization started =====');
    console.log('[INIT] Document ready state:', document.readyState);
    console.log('[INIT] Current page:', window.location.pathname);
    console.log('[INIT] Timestamp:', new Date().toISOString());
    
    try {
        console.log('[INIT] Applying theme preload...');
        applyThemePreload();
        console.log('[INIT] Theme preload applied');
        
        // Load recipes and meal plan from localStorage first
        console.log('[INIT] Loading data from localStorage...');
        loadFromLocalStorage();
        console.log('[INIT] Data loaded from localStorage');

        // Initialize settings first
        console.log('[INIT] Initializing settings...');
        initializeSettings();
        console.log('[INIT] Settings initialized');

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
        console.log('[INIT] Checking for recipe list element...');
        console.log('[INIT] Recipe list element found:', !!elements.recipeList);
        console.log('[INIT] Category filter found:', !!document.getElementById('category-filter'));
        if (elements.recipeList && document.getElementById('category-filter')) {
            try {
                console.log('[INIT] Updating recipe list...');
                console.log('[INIT] Current recipes count:', recipes.length);
                updateRecipeList();
                console.log('[INIT] ✅ Recipe list updated');
            } catch (error) {
                console.error('[INIT] ❌ Error updating recipe list:', error);
                console.error('[INIT] Error stack:', error.stack);
            }
        } else {
            console.log('[INIT] ⚠️ Not on recipes page or elements missing');
        }

        // Initialize meal planner if available
        console.log('[INIT] Checking for meal planner...');
        console.log('[INIT] initializeMealPlanner function available:', typeof initializeMealPlanner === 'function');
        if (typeof initializeMealPlanner === 'function') {
            try {
                console.log('[INIT] Initializing meal planner...');
                initializeMealPlanner();
                console.log('[INIT] ✅ Meal planner initialization started');
            } catch (error) {
                console.error('[INIT] ❌ Error initializing meal planner:', error);
                console.error('[INIT] Error stack:', error.stack);
            }
        } else {
            console.log('[INIT] ⚠️ Meal planner function not available');
        }

        // Initialize recipe form if available
        if (elements.recipeForm) {
            try {
            elements.recipeForm.addEventListener('submit', handleRecipeSubmit);
            } catch (error) {
                console.error('Error setting up recipe form:', error);
            }
        }

        // Initialize add meal button if available
        if (elements.addRecipeBtn) {
            try {
            elements.addRecipeBtn.addEventListener('click', openModal);
                console.log('Add recipe button initialized');
            } catch (error) {
                console.error('Error setting up add recipe button:', error);
            }
        } else {
            console.log('Add recipe button not found');
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
                    searchResultsElement.innerHTML = '<div class="loading">Searching my ingredients...</div>';
                    try {
                        console.log('=== STARTING SEARCH ===');
                        console.log('Query:', query);
                        const results = await searchAllIngredients(query);
                        console.log('=== SEARCH COMPLETE ===');
                        console.log('Total results:', results.length);
                        console.log('Results breakdown:', {
                            custom: results.filter(r => r.source === 'custom').length,
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
                        searchResultsElement.innerHTML = '<div class="loading">Searching my ingredients...</div>';
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

        // Initialize recipe table sortable headers
        const recipesTable = document.getElementById('recipes-table');
        if (recipesTable) {
            recipesTable.querySelectorAll('th.sortable').forEach(th => {
                th.addEventListener('click', onRecipeSortHeaderClick);
            });
        }

        // Initialize cancel recipe button
        const cancelRecipeBtn = document.getElementById('cancel-recipe');
        if (cancelRecipeBtn) {
            cancelRecipeBtn.addEventListener('click', closeModalHandler);
        }

        console.log('[INIT] ✅ App initialized successfully');
        console.log('[INIT] ===== App initialization complete =====');
    } catch (error) {
        console.error('[INIT] ❌ Fatal error initializing app:', error);
        console.error('[INIT] Error name:', error.name);
        console.error('[INIT] Error message:', error.message);
        console.error('[INIT] Error stack:', error.stack);
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
console.log('[APP] Setting up DOMContentLoaded listener...');
console.log('[APP] Current document ready state:', document.readyState);

if (document.readyState === 'loading') {
    console.log('[APP] DOM still loading, waiting for DOMContentLoaded...');
    document.addEventListener('DOMContentLoaded', () => {
        console.log('[APP] DOMContentLoaded fired, calling initializeApp');
        initializeApp();
    });
} else {
    console.log('[APP] DOM already loaded, calling initializeApp immediately');
    initializeApp();
}

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
                <input type="text" class="ingredient-name" placeholder="Search for ingredient" required readonly tabindex="0" value="${displayName}">
                <input type="number" class="ingredient-amount" placeholder="Grams" min="0" step="0.1" required value="${ing.amount}">
                <button type="button" class="remove-ingredient btn btn-ghost btn-icon" aria-label="Remove ingredient">&times;</button>
            </div>
            <div class="ingredient-macros">
                <span class="macro-item">Calories: <span class="calories">0</span></span>
                <span class="macro-item">Protein: <span class="protein">0</span>g</span>
                <span class="macro-item">Carbs: <span class="carbs">0</span>g</span>
                <span class="macro-item">Fat: <span class="fat">0</span>g</span>
                <span class="macro-item">Cost: <span class="cost">$0.00</span></span>
            </div>
        `;
        const nameInput = ingredientItem.querySelector('.ingredient-name');
        const amountInput = ingredientItem.querySelector('.ingredient-amount');
        // Ensure fdcId is present, fallback to a unique id if missing
        let fdcId = ing.fdcId ? ing.fdcId.toString() : `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        nameInput.dataset.fdcId = fdcId;
        nameInput.dataset.store = ing.store || '';
        nameInput.dataset.storeSection = ing.storeSection || '';
        nameInput.dataset.emoji = emoji;
        const ingredientData = {
            name: ing.name,
            amount: parseFloat(ing.amount),
            nutrition: ing.nutrition,
            source: ing.source || 'usda', // Default to usda for backward compatibility
            store: ing.store || '',
            storeSection: ing.storeSection || '',
            emoji: emoji,
            pricePerGram: ing.pricePerGram || null,
            pricePer100g: ing.pricePer100g || null,
            totalPrice: ing.totalPrice || null
        };
        selectedIngredients.set(fdcId, ingredientData);
        nameInput.addEventListener('click', () => openIngredientSearch(ingredientItem));
        nameInput.addEventListener('focus', () => openIngredientSearch(ingredientItem));
        
        // Use a named function to prevent duplicate listeners
        const handleAmountInput = function() {
            const fdcId = nameInput.dataset.fdcId;
            const newAmount = parseFloat(amountInput.value) || 0;
            
            // Try to get ingredient from selectedIngredients
            let ingredient = null;
            if (fdcId) {
                // Try direct lookup first
                if (selectedIngredients.has(fdcId)) {
                    ingredient = selectedIngredients.get(fdcId);
                } else {
                    // Try alternative lookup strategies for different fdcId formats
                    for (const [key, value] of selectedIngredients.entries()) {
                        if (key === fdcId || key.endsWith(fdcId) || fdcId.endsWith(key)) {
                            ingredient = value;
                            nameInput.dataset.fdcId = key;
                            break;
                        }
                    }
                }
            }
            
            if (ingredient) {
                ingredient.amount = newAmount;
                // Use the actual key from selectedIngredients (which might be different from fdcId)
                const actualKey = nameInput.dataset.fdcId;
                if (actualKey) {
                    selectedIngredients.set(actualKey, ingredient);
                }
                updateIngredientMacros(ingredientItem, ingredient);
                updateServingSizeDefault();
                updateTotalNutrition();
            } else {
                // If ingredient not found, try fallback approach
                console.warn('Amount changed but ingredient not found in selectedIngredients:', fdcId, 'Available keys:', Array.from(selectedIngredients.keys()));
                
                const macrosContainer = ingredientItem.querySelector('.ingredient-macros');
                if (macrosContainer) {
                    const caloriesEl = macrosContainer.querySelector('.calories');
                    const proteinEl = macrosContainer.querySelector('.protein');
                    const carbsEl = macrosContainer.querySelector('.carbs');
                    const fatEl = macrosContainer.querySelector('.fat');
                    
                    const oldCalories = caloriesEl ? parseFloat(caloriesEl.textContent) || 0 : 0;
                    const oldProtein = proteinEl ? parseFloat(proteinEl.textContent) || 0 : 0;
                    const oldCarbs = carbsEl ? parseFloat(carbsEl.textContent) || 0 : 0;
                    const oldFat = fatEl ? parseFloat(fatEl.textContent) || 0 : 0;
                    
                    const oldAmountInput = ingredientItem.querySelector('.ingredient-amount');
                    const oldAmount = oldAmountInput ? (parseFloat(oldAmountInput.defaultValue) || parseFloat(oldAmountInput.value) || 100) : 100;
                    
                    if (oldAmount > 0) {
                        const nutritionPerGram = {
                            calories: oldCalories / oldAmount,
                            protein: oldProtein / oldAmount,
                            carbs: oldCarbs / oldAmount,
                            fat: oldFat / oldAmount
                        };
                        
                        const fallbackIngredient = {
                            name: nameInput.value || 'Unknown',
                            amount: newAmount,
                            nutrition: nutritionPerGram
                        };
                        
                        updateIngredientMacros(ingredientItem, fallbackIngredient);
                    }
                }
                
                updateServingSizeDefault();
                updateTotalNutrition();
            }
        };
        
        // Remove any existing listener first to prevent duplicates
        amountInput.removeEventListener('input', handleAmountInput);
        // Add the listener
        amountInput.addEventListener('input', handleAmountInput);
        
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
        // Always make the field editable when clicked/focused
        nameInput.readOnly = false;
        nameInput.placeholder = 'Type to search my ingredients...';
        
        // Remove existing event listeners by cloning (clean way to remove all listeners)
        const oldValue = nameInput.value;
        const oldFdcId = nameInput.dataset.fdcId;
        const oldStore = nameInput.dataset.store;
        const oldStoreSection = nameInput.dataset.storeSection;
        const oldEmoji = nameInput.dataset.emoji;
        const newNameInput = nameInput.cloneNode(true);
        newNameInput.value = oldValue;
        if (oldFdcId) newNameInput.dataset.fdcId = oldFdcId;
        if (oldStore !== undefined) newNameInput.dataset.store = oldStore || '';
        if (oldStoreSection) newNameInput.dataset.storeSection = oldStoreSection;
        if (oldEmoji) newNameInput.dataset.emoji = oldEmoji;
        // Ensure tabindex is set for accessibility
        newNameInput.setAttribute('tabindex', '0');
        nameInput.parentNode.replaceChild(newNameInput, nameInput);
        
        // Add event listeners for inline search
        newNameInput.addEventListener('input', handleInlineSearch);
        newNameInput.addEventListener('blur', handleIngredientBlur);
        // Re-add click and focus handlers so user can edit again after selection
        // Use mousedown instead of click to ensure it fires before blur
        newNameInput.addEventListener('mousedown', (e) => {
            if (newNameInput.readOnly) {
                e.preventDefault();
                openIngredientSearch(ingredientInput);
            }
        });
        newNameInput.addEventListener('click', (e) => {
            if (newNameInput.readOnly) {
                e.preventDefault();
                openIngredientSearch(ingredientInput);
            }
        });
        newNameInput.addEventListener('focus', () => {
            if (newNameInput.readOnly) {
                openIngredientSearch(ingredientInput);
            }
        });
        
        // Focus the input to start typing (only if not readonly)
        if (!newNameInput.readOnly) {
            newNameInput.focus();
            // Select all text so user can start typing immediately
            newNameInput.select();
        }
        
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
            // Always show dropdown if there are results OR to show "Add New" option
                showInlineSearchResults(event.target, results);
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
    
    // Show "no results" message if there are no results (but still show "Add New" option)
    if (results.length === 0) {
        const noResultsItem = document.createElement('div');
        noResultsItem.className = 'search-result-item';
        noResultsItem.style.cssText = 'color: var(--color-text-muted); font-size: 0.9em;';
        noResultsItem.textContent = 'No matching ingredients found';
        dropdown.appendChild(noResultsItem);
    }
    
    // Add results (already limited to 10 in searchAllIngredients)
    results.forEach(result => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        const sourceLabel = 'My Ingredient';
        const sourceIcon = '🏠';
        
        // Format price information
        let priceInfo = '';
        if (result.pricePer100g) {
            priceInfo = `$${result.pricePer100g.toFixed(2)}/100g`;
        } else if (result.pricePerGram) {
            priceInfo = `$${(result.pricePerGram * 100).toFixed(2)}/100g`;
        } else {
            priceInfo = 'Price: N/A';
        }
        
        item.innerHTML = `
            <div style="font-weight: 600; color: var(--color-text);">${sourceIcon} ${result.name}</div>
            <div style="font-size: 0.8em; color: var(--color-text-muted);">${result.brandOwner || sourceLabel}</div>
            <div style="font-size: 0.8em; color: var(--color-text-muted);">${priceInfo}</div>
        `;
        
        item.addEventListener('mousedown', (e) => {
            e.preventDefault(); // Prevent blur event from firing before click
            selectIngredient(result);
            removeSearchDropdown();
        });
        
        dropdown.appendChild(item);
    });
    
    // Always add "New Custom Ingredient" option at the bottom
    const addNewItem = document.createElement('div');
    addNewItem.className = 'search-result-item add-new-ingredient';
    
    addNewItem.innerHTML = `
        <div style="font-weight: 600; color: var(--color-success);">➕ New Custom Ingredient</div>
        <div style="font-size: 0.8em; color: var(--color-text-muted);">Create a new ingredient or search APIs</div>
    `;
    
    addNewItem.addEventListener('mousedown', (e) => {
        e.preventDefault();
        removeSearchDropdown();
        
        // Redirect to ingredients page and use existing modal there
        window.location.href = 'ingredients.html?openIngredientModal=1';
    });
    
    dropdown.appendChild(addNewItem);
    
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
        // Get emoji from ingredient (if available)
        const emoji = (ingredient.emoji || '').trim();
        
        // Generate unique ID for custom ingredient
        const storageId = `custom-${ingredient.id || Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        nameInput.dataset.fdcId = storageId;
        nameInput.dataset.store = ingredient.store || '';
        nameInput.dataset.storeSection = ingredient.storeSection || '';
        // Stop storing emoji on the input; just use the ingredient name
        nameInput.dataset.emoji = '';
        nameInput.value = ingredient.name;
        nameInput.readOnly = true;
        nameInput.placeholder = 'Click to search for ingredient';
        // Ensure tabindex is set so field is focusable
        nameInput.setAttribute('tabindex', '0');
        
        // Ensure click and focus handlers are present so user can edit again
        // Remove existing handlers and re-add
        const newNameInput = nameInput.cloneNode(true);
        // Preserve all data attributes
        newNameInput.dataset.fdcId = storageId;
        newNameInput.dataset.store = ingredient.store || '';
        newNameInput.dataset.storeSection = ingredient.storeSection || '';
        newNameInput.dataset.emoji = emoji;
        newNameInput.setAttribute('tabindex', '0');
        nameInput.parentNode.replaceChild(newNameInput, nameInput);
        newNameInput.addEventListener('click', (e) => {
            e.preventDefault();
            openIngredientSearch(currentIngredientInput);
        });
        newNameInput.addEventListener('focus', () => openIngredientSearch(currentIngredientInput));
        
        // Store ingredient data - ensure nutrition is properly structured
        const nutrition = ingredient.nutrition || {
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0
        };
        
        // Convert nutrition values to numbers and check for valid data
        // Note: per-gram values can be very small (e.g., 0.003 cal/g), so we check for any positive value
        const caloriesNum = Number(nutrition.calories) || 0;
        const proteinNum = Number(nutrition.protein) || 0;
        const carbsNum = Number(nutrition.carbs) || 0;
        const fatNum = Number(nutrition.fat) || 0;
        
        // Log the raw nutrition data we received
        console.log('Raw nutrition data from ingredient:', {
            ingredientName: ingredient.name,
            source: ingredient.source,
            rawNutrition: nutrition,
            numericValues: { calories: caloriesNum, protein: proteinNum, carbs: carbsNum, fat: fatNum },
            hasNutrition: !!ingredient.nutrition,
            nutritionKeys: ingredient.nutrition ? Object.keys(ingredient.nutrition) : []
        });
        
        // Validate nutrition data exists - filter out ingredients with no valid nutrition
        // Check if any value is a positive number (even very small per-gram values are valid)
        const hasValidNutrition = (
            (Number.isFinite(caloriesNum) && caloriesNum > 0) || 
            (Number.isFinite(proteinNum) && proteinNum > 0) || 
            (Number.isFinite(carbsNum) && carbsNum > 0) || 
            (Number.isFinite(fatNum) && fatNum > 0)
        );
        
        if (!hasValidNutrition) {
            console.warn('⚠️ Ingredient has no valid nutrition data - rejecting selection:', {
                name: ingredient.name,
                source: ingredient.source,
                rawNutrition: nutrition,
                numericValues: { calories: caloriesNum, protein: proteinNum, carbs: carbsNum, fat: fatNum },
                fullIngredient: ingredient
            });
            showAlert(`Cannot select "${ingredient.name}" - no nutrition data available.`, { type: 'warning' });
            return; // Don't select ingredients without valid nutrition
        }
        
        // Set default amount to 100g if empty
        const defaultAmount = parseFloat(amountInput.value) || 100;
        if (!amountInput.value || amountInput.value === '0') {
            amountInput.value = '100';
        }
        
        // CRITICAL: Normalize nutrition to per-gram format ONCE and store statically
        // Nutrition from APIs should be per-gram, but we'll ensure it's normalized
        let nutritionPerGram = {
            calories: Number(nutrition.calories) || 0,
            protein: Number(nutrition.protein) || 0,
            carbs: Number(nutrition.carbs) || 0,
            fat: Number(nutrition.fat) || 0
        };
        
        // Detect if nutrition is per-100g and convert to per-gram
        // Typical per-gram: calories < 10, protein/carbs/fat < 1
        // Typical per-100g: calories > 50, protein/carbs/fat > 1
        // Use more aggressive detection - if ANY value looks like per-100g, convert all
        const looksLikePer100g = nutritionPerGram.calories > 10 || 
                                 nutritionPerGram.protein > 1 || 
                                 nutritionPerGram.carbs > 1 || 
                                 nutritionPerGram.fat > 1;
        
        if (looksLikePer100g) {
            console.warn('⚠️ Converting nutrition from per-100g to per-gram during storage:', {
                before: nutritionPerGram,
                ingredientName: ingredient.name,
                source: ingredient.source,
                reason: 'Values exceed per-gram thresholds (calories > 10 or macros > 1)'
            });
            nutritionPerGram = {
                calories: nutritionPerGram.calories / 100,
                protein: nutritionPerGram.protein / 100,
                carbs: nutritionPerGram.carbs / 100,
                fat: nutritionPerGram.fat / 100
            };
            console.log('✅ Converted to per-gram:', nutritionPerGram);
        } else {
            console.log('✅ Nutrition values already appear to be per-gram format:', nutritionPerGram);
        }
        
        // Store with high precision (don't round - keep as decimals)
        // These values will be STATIC and never change - only multiplied by amount
        const staticNutritionPerGram = {
            calories: nutritionPerGram.calories,
            protein: nutritionPerGram.protein,
            carbs: nutritionPerGram.carbs,
            fat: nutritionPerGram.fat
        };
        
        // Log to verify nutrition format
        console.group('💾 Storing ingredient in selectedIngredients (STATIC per-gram values)');
        console.log('Ingredient details:', {
            name: ingredient.name,
            source: ingredient.source,
            fdcId: ingredient.fdcId,
            id: ingredient.id
        });
        console.log('Raw nutrition from ingredient:', nutrition);
        console.log('✅ STATIC nutrition per gram (will NEVER change):', staticNutritionPerGram);
        console.log('These values will be multiplied by amount when calculating macros');
        console.log('Default amount:', defaultAmount);
        console.groupEnd();
        
        const ingredientData = {
            name: ingredient.name,
            amount: defaultAmount,
            nutrition: staticNutritionPerGram, // STATIC per-gram values - never change
            source: ingredient.source || 'custom',
            id: ingredient.id || ingredient.fdcId,
            fdcId: ingredient.fdcId || storageId,
            store: ingredient.store || '',
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
        
        // Note: All ingredients are now custom, so this block is no longer needed
        // Keeping structure for potential future use
        if (false) {
            try {
                // Helper function to get my ingredients with migration support
                function getMyIngredients() {
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
                
                const myIngredients = getMyIngredients();
                const servingSize = ingredient.servingSize || 100;
                
                // Check if ingredient already exists (by name, case-insensitive)
                const existingIndex = myIngredients.findIndex(ing => 
                    ing.name.toLowerCase() === ingredient.name.toLowerCase()
                );
                
                // Convert nutrition from per-gram to per-serving-size for storage
                const nutritionPerServing = {
                    calories: (ingredient.nutrition?.calories || 0) * servingSize,
                    protein: (ingredient.nutrition?.protein || 0) * servingSize,
                    carbs: (ingredient.nutrition?.carbs || 0) * servingSize,
                    fat: (ingredient.nutrition?.fat || 0) * servingSize
                };
                
                const ingredientToSave = {
                    id: existingIndex >= 0 ? myIngredients[existingIndex].id : Date.now().toString(),
                    name: ingredient.name,
                    totalPrice: ingredient.totalPrice || null,
                    totalWeight: ingredient.totalWeight || null,
                    servingSize: servingSize,
                    nutrition: nutritionPerServing,
                    isCustom: false, // Mark as API-sourced but editable
                    storeSection: ingredient.storeSection || '',
                    // Do not persist emoji; prefer icon/image
                    emoji: '',
                    icon: ingredient.icon || '',
                    iconLabel: ingredient.iconLabel || '',
                    pricePerGram: ingredient.pricePerGram || null,
                    source: ingredient.source, // Track original source
                    fdcId: ingredient.fdcId || ingredient.id // Keep original ID for reference
                };
                
                // Calculate price per gram if we have price data
                if (ingredientToSave.totalPrice && ingredientToSave.totalWeight) {
                    ingredientToSave.pricePerGram = ingredientToSave.totalPrice / ingredientToSave.totalWeight;
                } else if (ingredient.pricePerGram) {
                    ingredientToSave.pricePerGram = ingredient.pricePerGram;
                }
                
                if (existingIndex >= 0) {
                    // Update existing ingredient
                    myIngredients[existingIndex] = ingredientToSave;
                    console.log('Updated existing ingredient in my ingredients:', ingredient.name);
                } else {
                    // Add new ingredient
                    myIngredients.push(ingredientToSave);
                    console.log('Added API ingredient to my ingredients:', ingredient.name);
                }
                
                // Save to localStorage
                localStorage.setItem('meale-my-ingredients', JSON.stringify(myIngredients));
                
                // Update global reference
                if (window.customIngredients) {
                    window.customIngredients = myIngredients;
                }
                if (window.myIngredients) {
                    window.myIngredients = myIngredients;
                }
            } catch (error) {
                console.error('Error saving API ingredient to my ingredients:', error);
                // Continue even if save fails
            }
        }
        
        selectedIngredients.set(storageId, ingredientData);
        
        // CRITICAL: Set the fdcId in the dataset to match the storageId used in selectedIngredients
        // This ensures the amount change handler can find the ingredient
        nameInput.dataset.fdcId = storageId;
        console.log('✅ Set nameInput.dataset.fdcId to storageId:', {
            storageId: storageId,
            fdcId: nameInput.dataset.fdcId,
            storedInSelectedIngredients: selectedIngredients.has(storageId)
        });
        
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
    
    // Helper function to get my ingredients with migration support
    function getMyIngredients() {
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
    
    // Search my ingredients only (no API calls)
    const queryLower = query.toLowerCase().trim();
    const allMyIngredients = getMyIngredients();
    
    console.log('=== SEARCH DEBUG ===');
    console.log('Query:', query);
    console.log('Total ingredients loaded:', allMyIngredients.length);
    
    // Filter out ingredients without valid nutrition data
    const customIngredients = allMyIngredients.filter(ingredient => {
        if (!ingredient.nutrition) {
            console.log('Filtering out ingredient without nutrition object:', ingredient.name);
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
    
    console.log('Ingredients with valid nutrition:', customIngredients.length);
    
    // Helper function to calculate relevance score (defined before use)
    function calculateRelevance(text, query) {
        if (!text || !query) return 0;
        
        const textLower = text.toLowerCase().trim();
        const queryLower = query.toLowerCase().trim();
        const queryWords = queryLower.split(/\s+/).filter(w => w.length > 0);
        const textWords = textLower.split(/\s+/).filter(w => w.length > 0);
        const wordCount = textWords.length;
        
        let score = 0;
        
        // Exact match (highest priority) - huge boost
        if (textLower === queryLower) {
            score += 100;
        }
        // Starts with query (very high priority) - major boost
        else if (textLower.startsWith(queryLower)) {
            score += 50;
            // Extra boost if it's a single word or very short
            if (wordCount <= 2) {
                score += 20; // "rice" or "rice cakes" get extra boost
            } else if (wordCount <= 3) {
                score += 10; // "rice, cooked" gets moderate boost
            }
        }
        // First word matches query (high priority)
        else if (textWords.length > 0 && textWords[0] === queryLower) {
            score += 30;
            // Boost for fewer words
            if (wordCount <= 2) score += 15;
            else if (wordCount <= 3) score += 8;
        }
        // First word starts with query
        else if (textWords.length > 0 && textWords[0].startsWith(queryLower)) {
            score += 20;
            // Boost for fewer words
            if (wordCount <= 2) score += 10;
            else if (wordCount <= 3) score += 5;
        }
        // Contains query as whole phrase
        else if (textLower.includes(queryLower)) {
            score += 10;
        }
        // Word-based matching - check if all query words appear
        else if (queryWords.length > 1) {
            const matchingWords = queryWords.filter(qw => 
                textWords.some(tw => tw === qw || tw.startsWith(qw) || tw.includes(qw))
            );
            const wordMatchRatio = matchingWords.length / queryWords.length;
            score += wordMatchRatio * 5; // Up to 5 points for word matching
            
            // Bonus if words appear in order
            let wordsInOrder = 0;
            let lastIndex = -1;
            for (const qw of queryWords) {
                const index = textWords.findIndex(tw => tw === qw || tw.startsWith(qw));
                if (index > lastIndex) {
                    wordsInOrder++;
                    lastIndex = index;
                }
            }
            if (wordsInOrder === queryWords.length) {
                score += 2; // Bonus for words in order
            }
        }
        // Single word - check for word boundaries
        else if (queryWords.length === 1) {
            const queryWord = queryWords[0];
            const wordBoundaryRegex = new RegExp(`\\b${queryWord}`, 'i');
            if (wordBoundaryRegex.test(textLower)) {
                score += 8; // Word boundary match
            } else if (textLower.includes(queryWord)) {
                score += 3; // Partial match
            }
        }
        
        // Penalty for longer names (heavily favor shorter/simpler names)
        // This is the key to showing "rice" before "Brown Rice, Long Grain, Cooked"
        if (wordCount > 5) {
            score -= 15; // Heavy penalty for very long names
        } else if (wordCount > 3) {
            score -= 8; // Moderate penalty for longer names
        } else if (wordCount === 1) {
            score += 10; // Big boost for single-word matches
        } else if (wordCount === 2) {
            score += 5; // Boost for two-word matches
        }
        
        // Penalty for very long character length
        if (textLower.length > 50) {
            score -= 5;
        }
        
        return Math.max(0, score); // Ensure score is never negative
    }
    
    // Sort custom ingredients by relevance using improved algorithm
    const nameMatches = customIngredients.filter(ingredient => {
        const nameLower = ingredient.name.toLowerCase();
        const matches = nameLower.includes(queryLower);
        if (matches) {
            console.log('Found name match:', ingredient.name);
        }
        return matches;
    });
    
    console.log('Ingredients matching name:', nameMatches.length);
    
    const customMatches = nameMatches
        .map(ingredient => {
            let relevance = calculateRelevance(ingredient.name, query);
            // Ensure any ingredient that matches the name filter gets at least a minimum relevance
            // This prevents valid matches from being filtered out due to penalties in the relevance calculation
            if (relevance === 0 && ingredient.name.toLowerCase().includes(queryLower)) {
                relevance = 1; // Minimum relevance for name matches
                console.log('Setting minimum relevance for name match:', ingredient.name);
            }
            return { ingredient, relevance };
        })
        .filter(item => {
            if (item.relevance > 0) {
                console.log('Ingredient with relevance > 0:', item.ingredient.name, 'relevance:', item.relevance);
            } else {
                console.log('Filtering out ingredient with relevance 0:', item.ingredient.name);
            }
            return item.relevance > 0; // Only include relevant matches
        })
        .sort((a, b) => {
            // Sort by relevance first
            if (b.relevance !== a.relevance) {
                return b.relevance - a.relevance;
            }
            // Then by word count (fewer words = simpler/better)
            const aWords = (a.ingredient.name || '').split(/\s+/).length;
            const bWords = (b.ingredient.name || '').split(/\s+/).length;
            if (aWords !== bWords) {
                return aWords - bWords;
            }
            // Then by name length (shorter = more specific)
            return a.ingredient.name.length - b.ingredient.name.length;
        })
        .map(item => item.ingredient);
    
    console.log('Final custom matches:', customMatches.length);
    
    // Add custom ingredients to results
    customMatches.forEach(ingredient => {
        // Convert nutrition from total serving size to per-gram values
        const servingSize = ingredient.servingSize || 100; // Default to 100g if not specified
        const imageSource = ingredient.image || ingredient.icon || ''; // Support both for backward compatibility
        const iconHtml = imageSource ? `<img src="${imageSource}" class="ingredient-icon" style="width: 20px; height: 20px; object-fit: cover; border-radius: 4px;" alt="">` : '';
        
        // Calculate pricePer100g from pricePerGram if available
        let pricePer100g = null;
        if (ingredient.pricePerGram) {
            pricePer100g = ingredient.pricePerGram * 100;
        }
        
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
            store: ingredient.store || '',
            storeSection: ingredient.storeSection || '',
            emoji: ingredient.emoji || '',
            pricePerGram: ingredient.pricePerGram || null,
            pricePer100g: pricePer100g
        });
    });
    
    console.log('Search results (custom ingredients only):', {
        total: results.length,
        custom: results.filter(r => r.source === 'custom').length
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
    
    // Display search results
    if (results.length === 0) {
        searchResultsElement.innerHTML = '<div class="no-results">No matching ingredients found</div>';
    } else {
    for (const ingredient of results) {
        const div = document.createElement('div');
        div.className = 'search-result-item';
        
        // All ingredients are custom now
        const sourceConfig = { icon: '🏠', label: 'Custom Ingredient' };
        
        const [mainName, ...details] = ingredient.name.split(',');
        const imageSource = ingredient.image || ingredient.icon || ''; // Support both for backward compatibility
        const iconHtml = imageSource ? `<img src="${imageSource}" class="ingredient-icon" style="width: 20px; height: 20px; object-fit: cover; border-radius: 4px;" alt="">` : '';
        
        // Format price information
        let priceInfo = '';
        if (ingredient.pricePer100g) {
            priceInfo = `$${ingredient.pricePer100g.toFixed(2)}/100g`;
        } else if (ingredient.pricePerGram) {
            priceInfo = `$${(ingredient.pricePerGram * 100).toFixed(2)}/100g`;
        } else {
            priceInfo = 'Price: N/A';
        }
        
        div.innerHTML = `
            <div class="search-result-header">
                <span class="source-indicator ${ingredient.source}">
                    ${sourceConfig.icon} ${sourceConfig.label}
                </span>
                <h4>${iconHtml ? `${iconHtml} ` : ''}${mainName}${details.length > 0 ? ',' : ''}<span class="details">${details.join(',')}</span></h4>
            </div>
            <p>${ingredient.brandOwner || ''}</p>
            <p style="color: var(--color-text-muted); font-size: 0.9em;">${priceInfo}</p>
        `;
        
        div.addEventListener('click', async () => {
            try {
                if (!currentIngredientInput) {
                    showAlert('No ingredient input is currently selected. Please click an ingredient input field first.', { type: 'warning' });
                    return;
                }
                
                // Get emoji from ingredient (if available)
                const emoji = (ingredient.emoji || '').trim();
                
                // Handle ingredient (custom only)
                // Ensure nutrition is properly structured
                const nutrition = ingredient.nutrition || {
                    calories: 0,
                    protein: 0,
                    carbs: 0,
                    fat: 0
                };
                
                // Convert nutrition values to numbers and validate
                // Note: per-gram values can be very small (e.g., 0.003 cal/g), so we check for any positive value
                const caloriesNum = Number(nutrition.calories) || 0;
                const proteinNum = Number(nutrition.protein) || 0;
                const carbsNum = Number(nutrition.carbs) || 0;
                const fatNum = Number(nutrition.fat) || 0;
                
                // Validate nutrition data exists - check if any value is a positive number
                const hasValidNutrition = (
                    (Number.isFinite(caloriesNum) && caloriesNum > 0) || 
                    (Number.isFinite(proteinNum) && proteinNum > 0) || 
                    (Number.isFinite(carbsNum) && carbsNum > 0) || 
                    (Number.isFinite(fatNum) && fatNum > 0)
                );
                
                if (!hasValidNutrition) {
                    console.warn('⚠️ Ingredient has no valid nutrition data - rejecting selection:', {
                        name: ingredient.name,
                        source: ingredient.source,
                        rawNutrition: nutrition,
                        numericValues: { calories: caloriesNum, protein: proteinNum, carbs: carbsNum, fat: fatNum }
                    });
                    showAlert(`Cannot select "${ingredient.name}" - no nutrition data available.`, { type: 'warning' });
                    return; // Don't select ingredients without valid nutrition
                }
                
                // CRITICAL: Normalize nutrition to per-gram format ONCE and store statically
                let nutritionPerGram = {
                    calories: Number(nutrition.calories) || 0,
                    protein: Number(nutrition.protein) || 0,
                    carbs: Number(nutrition.carbs) || 0,
                    fat: Number(nutrition.fat) || 0
                };
                
                // Detect if nutrition is per-100g and convert to per-gram
                // Use more aggressive detection - if ANY value looks like per-100g, convert all
                const looksLikePer100g = nutritionPerGram.calories > 10 || 
                                         nutritionPerGram.protein > 1 || 
                                         nutritionPerGram.carbs > 1 || 
                                         nutritionPerGram.fat > 1;
                
                if (looksLikePer100g) {
                    console.warn('⚠️ Converting nutrition from per-100g to per-gram during storage:', {
                        before: nutritionPerGram,
                        ingredientName: ingredient.name,
                        source: ingredient.source,
                        reason: 'Values exceed per-gram thresholds (calories > 10 or macros > 1)'
                    });
                    nutritionPerGram = {
                        calories: nutritionPerGram.calories / 100,
                        protein: nutritionPerGram.protein / 100,
                        carbs: nutritionPerGram.carbs / 100,
                        fat: nutritionPerGram.fat / 100
                    };
                    console.log('✅ Converted to per-gram:', nutritionPerGram);
                } else {
                    console.log('✅ Nutrition values already appear to be per-gram format:', nutritionPerGram);
                }
                
                // Store static per-gram values (high precision, never change)
                const staticNutritionPerGram = {
                    calories: nutritionPerGram.calories,
                    protein: nutritionPerGram.protein,
                    carbs: nutritionPerGram.carbs,
                    fat: nutritionPerGram.fat
                };
                
                // Get amount from input, default to 100g if empty or 0
                const amountInput = currentIngredientInput.querySelector('.ingredient-amount');
                let amount = parseFloat(amountInput?.value) || 0;
                if (!amount || amount === 0) {
                    amount = 100;
                    if (amountInput) {
                        amountInput.value = '100';
                    }
                }
                
                const ingredientData = {
                    name: ingredient.name,
                    amount: amount,
                    nutrition: staticNutritionPerGram, // STATIC per-gram values - never change
                    source: ingredient.source || 'custom',
                    id: ingredient.id || ingredient.fdcId,
                    fdcId: ingredient.fdcId || `custom-${ingredient.id}`,
                    store: ingredient.store || '',
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
                
                // Note: All ingredients are now custom, so this block is no longer needed
                // Keeping structure for potential future use
                if (false) {
                    try {
                        // Helper function to get my ingredients with migration support
                        function getMyIngredients() {
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
                        
                        const myIngredients = getMyIngredients();
                        const servingSize = ingredient.servingSize || 100;
                        
                        // Check if ingredient already exists (by name, case-insensitive)
                        const existingIndex = myIngredients.findIndex(ing => 
                            ing.name.toLowerCase() === ingredient.name.toLowerCase()
                        );
                        
                        // Convert nutrition from per-gram to per-serving-size for storage
                        const nutritionPerServing = {
                            calories: (ingredient.nutrition?.calories || 0) * servingSize,
                            protein: (ingredient.nutrition?.protein || 0) * servingSize,
                            carbs: (ingredient.nutrition?.carbs || 0) * servingSize,
                            fat: (ingredient.nutrition?.fat || 0) * servingSize
                        };
                        
                        const ingredientToSave = {
                            id: existingIndex >= 0 ? myIngredients[existingIndex].id : Date.now().toString(),
                            name: ingredient.name,
                            totalPrice: ingredient.totalPrice || null,
                            totalWeight: ingredient.totalWeight || null,
                            servingSize: servingSize,
                            nutrition: nutritionPerServing,
                            isCustom: false, // Mark as API-sourced but editable
                            storeSection: ingredient.storeSection || '',
                            // Do not persist emoji; prefer icon/image
                            emoji: '',
                            icon: ingredient.icon || '',
                            iconLabel: ingredient.iconLabel || '',
                            pricePerGram: ingredient.pricePerGram || null,
                            source: ingredient.source, // Track original source
                            fdcId: ingredient.fdcId || ingredient.id // Keep original ID for reference
                        };
                        
                        // Calculate price per gram if we have price data
                        if (ingredientToSave.totalPrice && ingredientToSave.totalWeight) {
                            ingredientToSave.pricePerGram = ingredientToSave.totalPrice / ingredientToSave.totalWeight;
                        } else if (ingredient.pricePerGram) {
                            ingredientToSave.pricePerGram = ingredient.pricePerGram;
                        }
                        
                        if (existingIndex >= 0) {
                            // Update existing ingredient
                            myIngredients[existingIndex] = ingredientToSave;
                            console.log('Updated existing ingredient in my ingredients:', ingredient.name);
                        } else {
                            // Add new ingredient
                            myIngredients.push(ingredientToSave);
                            console.log('Added API ingredient to my ingredients:', ingredient.name);
                        }
                        
                        // Save to localStorage
                        localStorage.setItem('meale-my-ingredients', JSON.stringify(myIngredients));
                        
                        // Update global reference
                        if (window.customIngredients) {
                            window.customIngredients = myIngredients;
                        }
                        if (window.myIngredients) {
                            window.myIngredients = myIngredients;
                        }
                    } catch (error) {
                        console.error('Error saving API ingredient to my ingredients:', error);
                        // Continue even if save fails
                    }
                }
                
                // Store in selectedIngredients with custom ID
                const storageId = `custom-${ingredient.id}`;
                selectedIngredients.set(storageId, ingredientData);
                
                // Update the input field
                const nameField = currentIngredientInput.querySelector('.ingredient-name');
                if (nameField) {
                    const displayName = emoji ? `${emoji} ${ingredient.name}` : ingredient.name;
                    nameField.value = displayName;
                    // CRITICAL: Set fdcId to match storageId used in selectedIngredients
                    nameField.dataset.fdcId = storageId;
                    nameField.dataset.store = ingredient.store || '';
                    nameField.dataset.storeSection = ingredient.storeSection || '';
                    nameField.dataset.emoji = emoji;
                    nameField.readOnly = true;
                    nameField.placeholder = 'Click to search for ingredient';
                    nameField.setAttribute('tabindex', '0');
                    
                    console.log('✅ Set nameField.dataset.fdcId to storageId:', {
                        storageId: storageId,
                        fdcId: nameField.dataset.fdcId,
                        storedInSelectedIngredients: selectedIngredients.has(storageId)
                    });
                    
                    // Ensure click and focus handlers are present so user can edit again
                    const newNameField = nameField.cloneNode(true);
                    // CRITICAL: Preserve fdcId - use storageId directly, not from nameField (which might be stale)
                    newNameField.dataset.fdcId = storageId;
                    newNameField.dataset.store = ingredient.store || '';
                    newNameField.dataset.storeSection = ingredient.storeSection || '';
                    newNameField.dataset.emoji = emoji;
                    newNameField.setAttribute('tabindex', '0');
                    nameField.parentNode.replaceChild(newNameField, nameField);
                    
                    // Verify the fdcId is still set after replacement
                    console.log('✅ After replacement, newNameField.dataset.fdcId:', newNameField.dataset.fdcId);
                    
                    newNameField.addEventListener('click', (e) => {
                        e.preventDefault();
                        openIngredientSearch(currentIngredientInput);
                    });
                    newNameField.addEventListener('focus', () => openIngredientSearch(currentIngredientInput));
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
    
    // Always show "Add New Ingredient" option at the end
    const addNewDiv = document.createElement('div');
    addNewDiv.className = 'search-result-item add-new-ingredient';
    addNewDiv.style.borderTop = '2px solid var(--color-border-strong)';
    addNewDiv.style.marginTop = 'var(--space-3)';
    addNewDiv.style.paddingTop = 'var(--space-3)';
    addNewDiv.innerHTML = `
        <div class="search-result-header">
            <span class="source-indicator add-new">
                ➕ Add New Ingredient
            </span>
        </div>
        <p style="color: var(--color-text-muted); font-size: 0.9em;">Create a new custom ingredient</p>
    `;
    
    addNewDiv.addEventListener('click', () => {
        // Close the search modal/dropdown
        removeSearchDropdown();
        // Redirect to ingredients page and use existing modal there
        window.location.href = 'ingredients.html?openIngredientModal=1';
    });
    
    searchResultsElement.appendChild(addNewDiv);
}

// Modified Ingredient Input Handler
function addIngredientInput() {
    const ingredientItem = document.createElement('div');
    ingredientItem.className = 'ingredient-item';
    ingredientItem.innerHTML = `
        <div class="ingredient-main">
            <input type="text" class="ingredient-name" placeholder="Search for ingredient" required readonly tabindex="0">
            <input type="number" class="ingredient-amount" placeholder="Grams" min="0" step="0.1" required value="100">
            <button type="button" class="remove-ingredient btn btn-ghost btn-icon" aria-label="Remove ingredient">&times;</button>
        </div>
        <div class="ingredient-macros">
            <span class="macro-item">Calories: <span class="calories">0</span></span>
            <span class="macro-item">Protein: <span class="protein">0</span>g</span>
            <span class="macro-item">Carbs: <span class="carbs">0</span>g</span>
            <span class="macro-item">Fat: <span class="fat">0</span>g</span>
            <span class="macro-item">Cost: <span class="cost">$0.00</span></span>
        </div>
    `;

    const nameInput = ingredientItem.querySelector('.ingredient-name');
    const amountInput = ingredientItem.querySelector('.ingredient-amount');

    nameInput.addEventListener('click', () => openIngredientSearch(ingredientItem));
    nameInput.addEventListener('focus', () => openIngredientSearch(ingredientItem));
    
    // Update nutrition and serving size when amount changes
    // Use a named function and ensure it's only added once
    const handleAmountInput = function() {
        // CRITICAL: Get the current nameInput from the ingredientItem, not from closure
        // This ensures we get the element even if it was replaced
        const currentNameInput = ingredientItem.querySelector('.ingredient-name');
        const currentAmountInput = ingredientItem.querySelector('.ingredient-amount');
        
        console.log('🔔 Amount input event fired!', { 
            value: currentAmountInput?.value,
            fdcId: currentNameInput?.dataset.fdcId,
            nameInputExists: !!currentNameInput
        });
        
        const fdcId = currentNameInput?.dataset.fdcId;
        const newAmount = parseFloat(currentAmountInput?.value) || 0;
        console.log('🔔 Processing amount change:', { fdcId, newAmount });
        
        // Try to get ingredient from selectedIngredients
        let ingredient = null;
        if (fdcId) {
            // Try direct lookup first
            if (selectedIngredients.has(fdcId)) {
                ingredient = selectedIngredients.get(fdcId);
            } else {
                // Try alternative lookup strategies for different fdcId formats
                // Check if it's a prefixed ID (custom-)
                for (const [key, value] of selectedIngredients.entries()) {
                    if (key === fdcId || key.endsWith(fdcId) || fdcId.endsWith(key)) {
                        ingredient = value;
                        // Update the dataset to match the actual key
                        if (currentNameInput) {
                            currentNameInput.dataset.fdcId = key;
                        }
                        break;
                    }
                }
            }
        }
        
        if (ingredient) {
            ingredient.amount = newAmount;
            // Use the actual key from selectedIngredients (which might be different from fdcId)
            const actualKey = currentNameInput?.dataset.fdcId;
            if (actualKey) {
                selectedIngredients.set(actualKey, ingredient);
            }
            console.log('Amount changed for', ingredient.name, 'to', newAmount, 'g');
            updateIngredientMacros(ingredientItem, ingredient);
            updateServingSizeDefault();
            updateTotalNutrition();
        } else {
            // If ingredient not found, try to construct a minimal ingredient object from existing data
            // This can happen if the ingredient was added but not properly stored
            console.warn('Amount changed but ingredient not found in selectedIngredients:', fdcId, 'Available keys:', Array.from(selectedIngredients.keys()));
            
            // Try to get existing macro values to reverse-calculate nutrition per gram
            const macrosContainer = ingredientItem.querySelector('.ingredient-macros');
            if (macrosContainer) {
                const caloriesEl = macrosContainer.querySelector('.calories');
                const proteinEl = macrosContainer.querySelector('.protein');
                const carbsEl = macrosContainer.querySelector('.carbs');
                const fatEl = macrosContainer.querySelector('.fat');
                
                const oldCalories = caloriesEl ? parseFloat(caloriesEl.textContent) || 0 : 0;
                const oldProtein = proteinEl ? parseFloat(proteinEl.textContent) || 0 : 0;
                const oldCarbs = carbsEl ? parseFloat(carbsEl.textContent) || 0 : 0;
                const oldFat = fatEl ? parseFloat(fatEl.textContent) || 0 : 0;
                
                // Get the old amount from the input's default value or current stored amount
                const oldAmount = currentAmountInput ? (parseFloat(currentAmountInput.defaultValue) || parseFloat(currentAmountInput.value) || 100) : 100;
                
                // If we have old values, try to calculate nutrition per gram
                if (oldAmount > 0) {
                    const nutritionPerGram = {
                        calories: oldCalories / oldAmount,
                        protein: oldProtein / oldAmount,
                        carbs: oldCarbs / oldAmount,
                        fat: oldFat / oldAmount
                    };
                    
                    const fallbackIngredient = {
                        name: currentNameInput?.value || 'Unknown',
                        amount: newAmount,
                        nutrition: nutritionPerGram
                    };
                    
                    console.log('Using fallback ingredient with reverse-calculated nutrition:', fallbackIngredient);
                    updateIngredientMacros(ingredientItem, fallbackIngredient);
                } else {
                    console.warn('Cannot calculate nutrition - old amount is 0 or invalid');
                }
            }
            
            // Always update totals
            updateServingSizeDefault();
            updateTotalNutrition();
        }
    };
    
    // Remove any existing listener first to prevent duplicates
    amountInput.removeEventListener('input', handleAmountInput);
    // Add the listener
    amountInput.addEventListener('input', handleAmountInput);

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
    console.group('🔬 updateIngredientMacros - DEBUG START');
    console.log('Input ingredient:', {
        name: ingredient?.name,
        amount: ingredient?.amount,
        nutrition: ingredient?.nutrition,
        source: ingredient?.source,
        hasNutrition: !!ingredient?.nutrition,
        nutritionType: typeof ingredient?.nutrition,
        nutritionKeys: ingredient?.nutrition ? Object.keys(ingredient.nutrition) : []
    });
    
    // Check if ingredient is null/undefined
    if (!ingredient) {
        console.error('❌ CRITICAL: ingredient parameter is null or undefined!');
        console.groupEnd();
        return;
    }
    
    // Read amount directly from input field to ensure it's current
    const amountInput = ingredientItem.querySelector('.ingredient-amount');
    const amount = amountInput ? (parseFloat(amountInput.value) || 0) : (parseFloat(ingredient.amount) || 0);
    console.log('📏 Amount from input:', {
        inputValue: amountInput?.value,
        parsedAmount: amount,
        ingredientAmount: ingredient?.amount
    });
    
    // Update ingredient object with current amount
    if (ingredient) {
        ingredient.amount = amount;
    }
    
    // Try to get nutrition from ingredient parameter first, but fallback to selectedIngredients
    let nutrition = ingredient.nutrition;
    
    // If nutrition is missing or all zeros, try to get it from selectedIngredients
    if (!nutrition || (nutrition.calories === 0 && nutrition.protein === 0 && nutrition.carbs === 0 && nutrition.fat === 0)) {
        const nameInput = ingredientItem.querySelector('.ingredient-name');
        if (nameInput) {
            const fdcId = nameInput.dataset.fdcId;
            if (fdcId && selectedIngredients.has(fdcId)) {
                const storedIngredient = selectedIngredients.get(fdcId);
                if (storedIngredient && storedIngredient.nutrition) {
                    console.log('🔍 Nutrition missing from ingredient parameter, using selectedIngredients:', {
                        fdcId: fdcId,
                        storedNutrition: storedIngredient.nutrition
                    });
                    nutrition = storedIngredient.nutrition;
                    // Also update the ingredient object so it has nutrition
                    ingredient.nutrition = nutrition;
                }
            }
        }
    }
    
    // Final fallback to empty object
    nutrition = nutrition || {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0
    };
    console.log('📊 Raw nutrition object (after fallback):', nutrition);
    
    // Validate nutrition values are numbers
    let safeNutrition = {
        calories: Number.isFinite(nutrition.calories) ? nutrition.calories : 0,
        protein: Number.isFinite(nutrition.protein) ? nutrition.protein : 0,
        carbs: Number.isFinite(nutrition.carbs) ? nutrition.carbs : 0,
        fat: Number.isFinite(nutrition.fat) ? nutrition.fat : 0
    };
    console.log('✅ Validated nutrition:', safeNutrition);
    
    // Final check if all values are still zero after fallback
    if (safeNutrition.calories === 0 && safeNutrition.protein === 0 && safeNutrition.carbs === 0 && safeNutrition.fat === 0) {
        console.error('❌ CRITICAL: All nutrition values are ZERO after all fallbacks!', {
            ingredientName: ingredient.name,
            rawNutrition: nutrition,
            validatedNutrition: safeNutrition,
            ingredientObject: ingredient,
            possibleIssue: 'Nutrition data is missing or not stored correctly. Ingredient may need to be re-selected.'
        });
    }
    
    // CRITICAL: Nutrition values are STATIC per-gram values stored when ingredient was selected
    // DO NOT modify or recalculate them - just use them as-is for multiplication
    // The nutrition values should already be normalized to per-gram format
    console.log('✅ Using STATIC nutrition per-gram values (never modified):', safeNutrition);
    console.log('These values were calculated ONCE when ingredient was selected and stored statically');
    
    // Verify the values look correct for per-gram format
    // If they look like per-100g, convert them on-the-fly as a safety measure
    const looksLikePer100g = safeNutrition.calories > 10 || 
                             safeNutrition.protein > 1 || 
                             safeNutrition.carbs > 1 || 
                             safeNutrition.fat > 1;
    
    if (looksLikePer100g) {
        console.error('❌ ERROR: Nutrition values look like per-100g instead of per-gram! Converting now...', {
            before: safeNutrition,
            expectedRange: {
                calories: '0-10 cal/g (typical: 0.5-4)',
                protein: '0-1 g/g (typical: 0.01-0.5)',
                carbs: '0-1 g/g (typical: 0.01-0.8)',
                fat: '0-1 g/g (typical: 0.01-0.9)'
            },
            issue: 'These values should have been converted to per-gram when ingredient was selected'
        });
        
        // Convert on-the-fly as a safety measure
        safeNutrition = {
            calories: safeNutrition.calories / 100,
            protein: safeNutrition.protein / 100,
            carbs: safeNutrition.carbs / 100,
            fat: safeNutrition.fat / 100
        };
        
        console.warn('✅ Converted to per-gram on-the-fly:', safeNutrition);
        
        // Update the stored value in selectedIngredients if possible
        const nameInput = ingredientItem.querySelector('.ingredient-name');
        if (nameInput) {
            const fdcId = nameInput.dataset.fdcId;
            if (fdcId && selectedIngredients.has(fdcId)) {
                const storedIngredient = selectedIngredients.get(fdcId);
                storedIngredient.nutrition = safeNutrition;
                selectedIngredients.set(fdcId, storedIngredient);
                console.log('✅ Updated stored nutrition in selectedIngredients');
            }
        }
    }
    
    // Show what the calculation will be
    console.log('📐 Calculation preview:', {
        amount: amount,
        nutritionPerGram: safeNutrition,
        willCalculate: {
            calories: `${safeNutrition.calories} × ${amount} = ${safeNutrition.calories * amount}`,
            protein: `${safeNutrition.protein} × ${amount} = ${safeNutrition.protein * amount}`,
            carbs: `${safeNutrition.carbs} × ${amount} = ${safeNutrition.carbs * amount}`,
            fat: `${safeNutrition.fat} × ${amount} = ${safeNutrition.fat * amount}`
        }
    });
    
    // Calculate total macros: nutrition per gram × amount in grams
    console.log('🧮 Final calculation step:');
    const caloriesCalc = safeNutrition.calories * amount;
    const proteinCalc = safeNutrition.protein * amount;
    const carbsCalc = safeNutrition.carbs * amount;
    const fatCalc = safeNutrition.fat * amount;
    
    console.log('   Raw calculations:', {
        calories: `${safeNutrition.calories} × ${amount} = ${caloriesCalc}`,
        protein: `${safeNutrition.protein} × ${amount} = ${proteinCalc}`,
        carbs: `${safeNutrition.carbs} × ${amount} = ${carbsCalc}`,
        fat: `${safeNutrition.fat} × ${amount} = ${fatCalc}`
    });
    
    // Round to nearest whole number for calories, keep 1 decimal for macros
    const macros = {
        calories: Math.round(caloriesCalc),
        protein: Math.round(proteinCalc * 10) / 10, // Round to 1 decimal
        carbs: Math.round(carbsCalc * 10) / 10,     // Round to 1 decimal
        fat: Math.round(fatCalc * 10) / 10          // Round to 1 decimal
    };
    
    console.log('   Rounded results:', macros);
    
    // Validate results are reasonable
    const isReasonable = macros.calories <= 10000 && 
                        macros.protein <= 1000 && 
                        macros.carbs <= 1000 && 
                        macros.fat <= 1000;
    
    if (!isReasonable) {
        console.error('❌ ERROR: Calculated macros seem unreasonable!', {
            macros: macros,
            nutritionPerGram: safeNutrition,
        amount: amount,
            suggestion: 'Nutrition might be in wrong format or calculation is incorrect'
        });
    }
    
    // Log detailed calculation info
    console.log('📊 FINAL RESULT:', {
        ingredientName: ingredient.name,
        amountInGrams: amount,
        nutritionPerGram: safeNutrition,
        rawNutrition: nutrition,
        calculation: {
            calories: `${safeNutrition.calories} cal/g × ${amount}g = ${macros.calories} cal`,
            protein: `${safeNutrition.protein}g/g × ${amount}g = ${macros.protein}g`,
            carbs: `${safeNutrition.carbs}g/g × ${amount}g = ${macros.carbs}g`,
            fat: `${safeNutrition.fat}g/g × ${amount}g = ${macros.fat}g`
        },
        calculatedMacros: macros,
        isReasonable: isReasonable
    });
    
    // EXPANDED NUTRITION VALUES FOR DEBUGGING
    console.log('🔍 EXPANDED NUTRITION VALUES:', {
        'nutritionPerGram (used in calculation)': {
            calories: safeNutrition.calories,
            protein: safeNutrition.protein,
            carbs: safeNutrition.carbs,
            fat: safeNutrition.fat
        },
        'rawNutrition (from ingredient object)': {
            calories: nutrition.calories,
            protein: nutrition.protein,
            carbs: nutrition.carbs,
            fat: nutrition.fat
        },
        'amount (grams)': amount,
        'expected per 100g (if per-gram is correct)': {
            calories: safeNutrition.calories * 100,
            protein: safeNutrition.protein * 100,
            carbs: safeNutrition.carbs * 100,
            fat: safeNutrition.fat * 100
        },
        'calculated total for this amount': macros,
        'WARNING': safeNutrition.calories < 0.1 ? '⚠️ Calories per gram is VERY LOW (< 0.1). This might indicate nutrition is stored incorrectly.' : 
                  safeNutrition.calories > 10 ? '⚠️ Calories per gram is VERY HIGH (> 10). This might be per-100g format.' :
                  '✅ Calories per gram looks reasonable'
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
    const costEl = macrosContainer.querySelector('.cost');
    
    console.log('DOM elements found:', {
        macrosContainer: !!macrosContainer,
        caloriesEl: !!caloriesEl,
        proteinEl: !!proteinEl,
        carbsEl: !!carbsEl,
        fatEl: !!fatEl,
        costEl: !!costEl,
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
    
    // Calculate cost
    let cost = 0;
    if (ingredient.pricePerGram && amount > 0) {
        cost = ingredient.pricePerGram * amount;
    }
    
    // Get the current amount from the input field (amountInput already declared above)
    const currentAmount = amountInput ? amountInput.value : 'N/A';
    
    // Update all macro values
    console.log('🖥️ Updating DOM elements with calculated macros:', {
        macros: macros,
        amountInField: currentAmount,
        amountInGrams: amount
    });
    
    // Verify elements exist before updating
    if (caloriesEl) {
        const beforeCalories = caloriesEl.textContent;
        caloriesEl.textContent = macros.calories;
        const afterCalories = caloriesEl.textContent;
        console.log('   Calories:', { 
            before: beforeCalories, 
            setTo: macros.calories, 
            after: afterCalories,
            amount: currentAmount
        });
    } else {
        console.error('   ❌ caloriesEl not found!');
    }
    
    if (proteinEl) {
        const beforeProtein = proteinEl.textContent;
        proteinEl.textContent = macros.protein;
        const afterProtein = proteinEl.textContent;
        console.log('   Protein:', { 
            before: beforeProtein, 
            setTo: macros.protein, 
            after: afterProtein,
            amount: currentAmount
        });
    } else {
        console.error('   ❌ proteinEl not found!');
    }
    
    if (carbsEl) {
        const beforeCarbs = carbsEl.textContent;
        carbsEl.textContent = macros.carbs;
        const afterCarbs = carbsEl.textContent;
        console.log('   Carbs:', { 
            before: beforeCarbs, 
            setTo: macros.carbs, 
            after: afterCarbs,
            amount: currentAmount
        });
    } else {
        console.error('   ❌ carbsEl not found!');
    }
    
    if (fatEl) {
        const beforeFat = fatEl.textContent;
        fatEl.textContent = macros.fat;
        const afterFat = fatEl.textContent;
        console.log('   Fat:', { 
            before: beforeFat, 
            setTo: macros.fat, 
            after: afterFat,
            amount: currentAmount
        });
    } else {
        console.error('   ❌ fatEl not found!');
    }
    
    // Update cost if element exists
    if (costEl) {
        if (cost > 0) {
            costEl.textContent = `$${cost.toFixed(2)}`;
        } else {
            costEl.textContent = 'N/A';
        }
    }
    
    // Verify the update worked by reading back from DOM
    const verifyCalories = caloriesEl ? caloriesEl.textContent : 'NOT FOUND';
    const verifyProtein = proteinEl ? proteinEl.textContent : 'NOT FOUND';
    const verifyCarbs = carbsEl ? carbsEl.textContent : 'NOT FOUND';
    const verifyFat = fatEl ? fatEl.textContent : 'NOT FOUND';
    
    console.log('✅ Verification - Values in DOM after update:', {
        calories: verifyCalories,
        protein: verifyProtein,
        carbs: verifyCarbs,
        fat: verifyFat,
        expected: macros,
        amountInField: currentAmount,
        amountInGrams: amount,
        match: verifyCalories == macros.calories && 
               verifyProtein == macros.protein && 
               verifyCarbs == macros.carbs && 
               verifyFat == macros.fat
    });
    
    if (verifyCalories != macros.calories || verifyProtein != macros.protein || 
        verifyCarbs != macros.carbs || verifyFat != macros.fat) {
        console.error('❌ MISMATCH: DOM values do not match calculated macros!', {
            calculated: macros,
            inDOM: { calories: verifyCalories, protein: verifyProtein, carbs: verifyCarbs, fat: verifyFat }
        });
    }
    
    console.log('✅ Successfully updated macros:', {
        calories: macros.calories,
        protein: macros.protein,
        carbs: macros.carbs,
        fat: macros.fat
    });
    console.groupEnd('🔬 updateIngredientMacros - DEBUG END');
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
                <input type="text" class="ingredient-name" placeholder="Search for ingredient" required readonly tabindex="0" value="${displayName}">
                <input type="number" class="ingredient-amount" placeholder="Grams" min="0" step="0.1" required value="${ing.amount}">
                <button type="button" class="remove-ingredient btn btn-ghost btn-icon" aria-label="Remove ingredient">&times;</button>
            </div>
            <div class="ingredient-macros">
                <span class="macro-item">Calories: <span class="calories">0</span></span>
                <span class="macro-item">Protein: <span class="protein">0</span>g</span>
                <span class="macro-item">Carbs: <span class="carbs">0</span>g</span>
                <span class="macro-item">Fat: <span class="fat">0</span>g</span>
                <span class="macro-item">Cost: <span class="cost">$0.00</span></span>
            </div>
        `;
        const nameInput = ingredientItem.querySelector('.ingredient-name');
        const amountInput = ingredientItem.querySelector('.ingredient-amount');
        
        // Generate unique ID for the duplicated ingredient
        const fdcId = `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        nameInput.dataset.fdcId = fdcId;
        nameInput.dataset.store = ing.store || '';
        nameInput.dataset.storeSection = ing.storeSection || '';
        nameInput.dataset.emoji = emoji;
        
        const ingredientData = {
            name: ing.name,
            amount: parseFloat(ing.amount),
            nutrition: ing.nutrition,
            source: ing.source || 'custom',
            store: ing.store || '',
            storeSection: ing.storeSection || '',
            emoji: emoji
        };
        selectedIngredients.set(fdcId, ingredientData);
        
        // Add event listeners
        nameInput.addEventListener('click', () => openIngredientSearch(ingredientItem));
        nameInput.addEventListener('focus', () => openIngredientSearch(ingredientItem));
        
        // Use a named function to prevent duplicate listeners
        const handleAmountInput = function() {
            const fdcId = nameInput.dataset.fdcId;
            const newAmount = parseFloat(amountInput.value) || 0;
            
            // Try to get ingredient from selectedIngredients
            let ingredient = null;
            if (fdcId) {
                // Try direct lookup first
                if (selectedIngredients.has(fdcId)) {
                    ingredient = selectedIngredients.get(fdcId);
                } else {
                    // Try alternative lookup strategies for different fdcId formats
                    for (const [key, value] of selectedIngredients.entries()) {
                        if (key === fdcId || key.endsWith(fdcId) || fdcId.endsWith(key)) {
                            ingredient = value;
                            nameInput.dataset.fdcId = key;
                            break;
                        }
                    }
                }
            }
            
            if (ingredient) {
                ingredient.amount = newAmount;
                // Use the actual key from selectedIngredients (which might be different from fdcId)
                const actualKey = nameInput.dataset.fdcId;
                if (actualKey) {
                    selectedIngredients.set(actualKey, ingredient);
                }
                updateIngredientMacros(ingredientItem, ingredient);
                updateServingSizeDefault();
                updateTotalNutrition();
            } else {
                // If ingredient not found, try fallback approach
                console.warn('Amount changed but ingredient not found in selectedIngredients:', fdcId, 'Available keys:', Array.from(selectedIngredients.keys()));
                
                const macrosContainer = ingredientItem.querySelector('.ingredient-macros');
                if (macrosContainer) {
                    const caloriesEl = macrosContainer.querySelector('.calories');
                    const proteinEl = macrosContainer.querySelector('.protein');
                    const carbsEl = macrosContainer.querySelector('.carbs');
                    const fatEl = macrosContainer.querySelector('.fat');
                    
                    const oldCalories = caloriesEl ? parseFloat(caloriesEl.textContent) || 0 : 0;
                    const oldProtein = proteinEl ? parseFloat(proteinEl.textContent) || 0 : 0;
                    const oldCarbs = carbsEl ? parseFloat(carbsEl.textContent) || 0 : 0;
                    const oldFat = fatEl ? parseFloat(fatEl.textContent) || 0 : 0;
                    
                    const oldAmountInput = ingredientItem.querySelector('.ingredient-amount');
                    const oldAmount = oldAmountInput ? (parseFloat(oldAmountInput.defaultValue) || parseFloat(oldAmountInput.value) || 100) : 100;
                    
                    if (oldAmount > 0) {
                        const nutritionPerGram = {
                            calories: oldCalories / oldAmount,
                            protein: oldProtein / oldAmount,
                            carbs: oldCarbs / oldAmount,
                            fat: oldFat / oldAmount
                        };
                        
                        const fallbackIngredient = {
                            name: nameInput.value || 'Unknown',
                            amount: newAmount,
                            nutrition: nutritionPerGram
                        };
                        
                        updateIngredientMacros(ingredientItem, fallbackIngredient);
                    }
                }
                
                updateServingSizeDefault();
                updateTotalNutrition();
            }
        };
        
        // Remove any existing listener first to prevent duplicates
        amountInput.removeEventListener('input', handleAmountInput);
        // Add the listener
        amountInput.addEventListener('input', handleAmountInput);
        
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
    
    // Set up serving size event listener
    setupServingSizeListener();
    
    // Open the modal
    recipeModal.classList.add('active');
    
    // Update total nutrition after all ingredients are added
    updateTotalNutrition();
    
    console.log(`Recipe "${originalRecipe.name}" prepared for duplication`);
}

function updateRecipeList() {
    const tbody = document.getElementById('recipe-list');
    if (!tbody) {
        console.log('Recipe list (tbody) not found, skipping update');
        return;
    }

    const filtered = getFilteredRecipes();
    const sorted = getSortedRecipes(filtered);
    updateRecipeSortIcons();

    tbody.innerHTML = '';
    if (sorted.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="no-items">No recipes found</td></tr>';
        return;
    }

    sorted.forEach(recipe => {
        tbody.appendChild(createRecipeRow(recipe));
    });
}

// Make recipes available globally for other modules
window.recipes = recipes;
window.addRecipe = addRecipe;
window.editRecipe = editRecipe;
window.duplicateRecipe = duplicateRecipe;
window.deleteRecipe = deleteRecipe; 
window.deleteRecipe = deleteRecipe;
window.openRecipeModal = openModal; 