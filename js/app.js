import config from './config.js';
import { version } from './version.js';
import './mealplan.js';
import { initializeMealPlanner } from './mealplan.js';
import { settings } from './settings.js';

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


// Smart Relevancy Scoring System
function calculateRelevancyScore(product, query) {
    const queryLower = query.toLowerCase();
    let score = 0;
    
    // Product name exact match (highest priority)
    if (product.product_name) {
        const nameLower = product.product_name.toLowerCase();
        if (nameLower === queryLower) {
            score += 100; // Exact match
        } else if (nameLower.startsWith(queryLower)) {
            score += 80; // Starts with query
        } else if (nameLower.includes(queryLower)) {
            score += 60; // Contains query
        }
        
        // Word boundary matches (more relevant)
        const queryWords = queryLower.split(/\s+/);
        const nameWords = nameLower.split(/\s+/);
        queryWords.forEach(queryWord => {
            if (nameWords.some(nameWord => nameWord === queryWord)) {
                score += 40; // Word exact match
            } else if (nameWords.some(nameWord => nameWord.startsWith(queryWord))) {
                score += 30; // Word starts with
            } else if (nameWords.some(nameWord => nameWord.includes(queryWord))) {
                score += 20; // Word contains
            }
        });
    }
    
    // Brand name relevance
    if (product.brands) {
        const brandsLower = product.brands.toLowerCase();
        if (brandsLower.includes(queryLower)) {
            score += 15; // Brand contains query
        }
    }
    
    // Category relevance (food categories get higher scores)
    if (product.categories) {
        const categoriesLower = product.categories.toLowerCase();
        const foodCategories = ['food', 'beverage', 'dairy', 'meat', 'vegetable', 'fruit', 'grain', 'snack'];
        const isFoodCategory = foodCategories.some(cat => categoriesLower.includes(cat));
        
        if (isFoodCategory) {
            score += 25; // Food category bonus
        }
        
        // Specific category matches
        if (categoriesLower.includes(queryLower)) {
            score += 35; // Category contains query
        }
    }
    
    // Ingredients text relevance (lower priority but still important)
    if (product.ingredients_text) {
        const ingredientsLower = product.ingredients_text.toLowerCase();
        if (ingredientsLower.includes(queryLower)) {
            score += 10; // Ingredients contain query
        }
    }
    
    // Quality indicators (products with more complete data)
    if (product.nutrition_grades && product.nutrition_grades !== 'unknown') {
        score += 5; // Has nutrition grade
    }
    
    if (product.image_url) {
        score += 3; // Has image
    }
    
    if (product.ingredients_text && product.ingredients_text.length > 50) {
        score += 2; // Detailed ingredients
    }
    
    // Penalty for very long product names (likely less relevant)
    if (product.product_name && product.product_name.length > 100) {
        score -= 10;
    }
    
    return score;
}

async function searchIngredients(query) {
    const params = new URLSearchParams({
        search_terms: query,
        page_size: 50, // Get more results to sort
        json: 1
    });

    try {
        const response = await fetch(`${config.OFF_API_BASE_URL}/cgi/search.pl?${params}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        if (!data || !data.products) {
            console.error('Invalid response format:', data);
            return [];
        }

        // Filter out products without names and apply additional relevancy filters
        const validProducts = data.products.filter(product => {
            if (!product.product_name) return false;
            
            // Filter out products that are clearly not food items
            const nameLower = product.product_name.toLowerCase();
            const categoriesLower = (product.categories || '').toLowerCase();
            
            // Skip non-food items
            const nonFoodKeywords = ['cosmetic', 'cleaning', 'hygiene', 'beauty', 'shampoo', 'soap', 'toothpaste', 'medicine', 'supplement', 'vitamin'];
            if (nonFoodKeywords.some(keyword => nameLower.includes(keyword) || categoriesLower.includes(keyword))) {
                return false;
            }
            
            // Skip products with very low relevancy scores (likely irrelevant)
            const score = calculateRelevancyScore(product, query);
            return score > 5; // Only include products with some relevancy
        });
        
        // Calculate relevancy scores and sort
        const scoredProducts = validProducts.map(product => ({
            ...product,
            relevancyScore: calculateRelevancyScore(product, query)
        }));
        
        // Sort by relevancy score (highest first)
        const sortedProducts = scoredProducts.sort((a, b) => b.relevancyScore - a.relevancyScore);
        
        // Return top 25 most relevant results
        const topResults = sortedProducts.slice(0, 25);
        
        console.log('Open Food Facts search results (ranked by relevancy):', topResults.map(p => ({
            name: p.product_name,
            score: p.relevancyScore,
            brand: p.brands
        })));
        
        return topResults;
    } catch (error) {
        console.error('Error searching ingredients:', error);
        throw error;
    }
}

async function getFoodDetails(productCode) {
    try {
        const response = await fetch(`${config.OFF_API_BASE_URL}/product/${productCode}.json`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('Open Food Facts product details:', data);
        return data;
    } catch (error) {
        console.error('Error getting food details:', error);
        return null;
    }
}

// Modified Nutrition Calculations for Open Food Facts
function calculateNutritionPerGram(foodData) {
    console.log('Calculating nutrition for food:', foodData.product?.product_name || 'Unknown');
    
    const nutrition = {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0
    };

    if (!foodData.product || !foodData.product.nutriments) {
        console.error('No nutrition data found in Open Food Facts response');
        return nutrition;
    }

    const nutriments = foodData.product.nutriments;
    
    // Open Food Facts provides nutrition per 100g by default
    // We need to convert to per gram (divide by 100)
    
    // Energy (calories) - try different possible keys
    if (nutriments['energy-kcal_100g']) {
        nutrition.calories = nutriments['energy-kcal_100g'] / 100;
    } else if (nutriments['energy_100g']) {
        // Convert from kJ to kcal (1 kcal = 4.184 kJ)
        nutrition.calories = (nutriments['energy_100g'] / 4.184) / 100;
    }
    
    // Protein
    if (nutriments['proteins_100g']) {
        nutrition.protein = nutriments['proteins_100g'] / 100;
    }
    
    // Carbohydrates
    if (nutriments['carbohydrates_100g']) {
        nutrition.carbs = nutriments['carbohydrates_100g'] / 100;
    }
    
    // Fat
    if (nutriments['fat_100g']) {
        nutrition.fat = nutriments['fat_100g'] / 100;
    }

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
            ${recipe.steps ? `
                <p class="recipe-steps">
                    <strong>Instructions:</strong><br>
                    ${recipe.steps.length > 100 ? recipe.steps.substring(0, 100) + '...' : recipe.steps}
                </p>
            ` : ''}
            
            <div class="recipe-actions">
                <button class="btn btn-edit" onclick="editRecipe(${recipe.id})">
                    <i class="fas fa-edit"></i> Edit
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
    const steps = document.getElementById('recipe-steps').value.trim();
    
    if (!name || !servingSize || servingSize <= 0) {
        alert('Please fill in all required fields');
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
                source: ingredientData.source || 'usda' // Default to usda for backward compatibility
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
                window.settings.theme = e.target.checked ? 'dark' : 'light';
                localStorage.setItem('meale-settings', JSON.stringify(window.settings));
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

        // Initialize cancel recipe button
        const cancelRecipeBtn = document.getElementById('cancel-recipe');
        if (cancelRecipeBtn) {
            cancelRecipeBtn.addEventListener('click', closeModalHandler);
        }

        console.log('App initialized successfully');
    } catch (error) {
        console.error('Error initializing app:', error);
    }
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
                            <span class="ingredient-name">${ing.name}</span>
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
        ingredientItem.innerHTML = `
            <div class="ingredient-main">
                <input type="text" class="ingredient-name" placeholder="Search for ingredient" required readonly value="${ing.name}">
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
        const ingredientData = {
            name: ing.name,
            amount: parseFloat(ing.amount),
            nutrition: ing.nutrition,
            source: ing.source || 'usda' // Default to usda for backward compatibility
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
    
    // Clear and focus search input
    const searchInput = document.getElementById('ingredient-search-input');
    if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
    }
    
    // Clear previous search results
    const searchResults = document.getElementById('search-results');
    if (searchResults) {
        searchResults.innerHTML = '';
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

// Unified Ingredient Search Functions
async function searchAllIngredients(query) {
    const results = [];
    
    // Search custom ingredients
    const customIngredients = JSON.parse(localStorage.getItem('meale-custom-ingredients') || '[]');
    const customMatches = customIngredients.filter(ingredient => 
        ingredient.name.toLowerCase().includes(query.toLowerCase())
    );
    
    // Add custom ingredients to results
    customMatches.forEach(ingredient => {
        // Convert nutrition from total serving size to per-gram values
        const servingSize = ingredient.servingSize || 100; // Default to 100g if not specified
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
            brandOwner: 'Custom Ingredient'
        });
    });
    
    // Search Open Food Facts ingredients
    try {
        const offResults = await searchIngredients(query);
        offResults.forEach(product => {
            if (product.product_name) {
                results.push({
                    id: product.code || product._id,
                    name: product.product_name,
                    source: 'off',
                    productCode: product.code || product._id,
                    brandOwner: product.brands || product.brand_owner || 'Generic',
                    image: product.image_url || product.image_front_url
                });
            }
        });
    } catch (error) {
        console.error('Error searching Open Food Facts ingredients:', error);
    }
    
    // Sort results: custom ingredients first, then by name
    results.sort((a, b) => {
        if (a.source === 'custom' && b.source !== 'custom') return -1;
        if (a.source !== 'custom' && b.source === 'custom') return 1;
        return a.name.localeCompare(b.name);
    });
    
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
        const sourceIcon = ingredient.source === 'custom' ? '🏠' : (ingredient.source === 'off' ? '🌍' : '🔍');
        const sourceLabel = ingredient.source === 'custom' ? 'Custom' : (ingredient.source === 'off' ? 'Open Food Facts' : 'Unknown');
        
        const [mainName, ...details] = ingredient.name.split(',');
        div.innerHTML = `
            <div class="search-result-header">
                <span class="source-indicator ${ingredient.source}">
                    ${sourceIcon} ${sourceLabel}
                </span>
                <h4>${mainName}${details.length > 0 ? ',' : ''}<span class="details">${details.join(',')}</span></h4>
            </div>
            <p>${ingredient.brandOwner}</p>
        `;
        
        div.addEventListener('click', async () => {
            try {
                if (!currentIngredientInput) {
                    alert('No ingredient input is currently selected. Please click an ingredient input field first.');
                    return;
                }
                
                let ingredientData;
                
                if (ingredient.source === 'custom') {
                    // Handle custom ingredient
                    ingredientData = {
                        name: ingredient.name,
                        amount: parseFloat(currentIngredientInput.querySelector('.ingredient-amount').value) || 0,
                        nutrition: ingredient.nutrition,
                        source: 'custom',
                        id: ingredient.id
                    };
                    
                    // Store in selectedIngredients with custom ID
                    selectedIngredients.set(`custom-${ingredient.id}`, ingredientData);
                    
                    // Update the input field
                    currentIngredientInput.querySelector('.ingredient-name').value = ingredient.name;
                    currentIngredientInput.querySelector('.ingredient-name').dataset.fdcId = `custom-${ingredient.id}`;
                    
                } else if (ingredient.source === 'off') {
                    // Handle Open Food Facts ingredient
                    const details = await getFoodDetails(ingredient.productCode);
                    if (details) {
                        const nutrition = calculateNutritionPerGram(details);
                        const amount = parseFloat(currentIngredientInput.querySelector('.ingredient-amount').value) || 0;
                        
                        ingredientData = {
                            name: ingredient.name,
                            amount: amount,
                            nutrition: nutrition,
                            source: 'off',
                            productCode: ingredient.productCode
                        };
                        
                        // Store in selectedIngredients with Open Food Facts product code
                        selectedIngredients.set(ingredient.productCode, ingredientData);
                        
                        // Update the input field
                        currentIngredientInput.querySelector('.ingredient-name').value = ingredient.name;
                        currentIngredientInput.querySelector('.ingredient-name').dataset.fdcId = ingredient.productCode;
                    }
                } else {
                    // Handle other sources (fallback)
                    console.warn('Unknown ingredient source:', ingredient.source);
                }
                
                if (ingredientData) {
                    // Update ingredient macros
                    updateIngredientMacros(currentIngredientInput, ingredientData);
                    
                    // Update nutrition display
                    updateTotalNutrition();
                    closeIngredientSearch();
                }
            } catch (error) {
                console.error('Error selecting ingredient:', error);
                alert('Error selecting ingredient. Please try again.');
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