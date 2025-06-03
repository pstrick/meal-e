import config from './config.js';

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
    // Add first ingredient input
    addIngredientInput();
}

function closeModalHandler() {
    recipeModal.classList.remove('active');
    recipeForm.reset();
    ingredientsList.innerHTML = '';
}

// USDA API Functions
async function searchIngredients(query) {
    const params = new URLSearchParams({
        api_key: config.USDA_API_KEY,
        query: query,
        dataType: ['Survey (FNDDS)'],
        pageSize: 25 // Increased to get more results for better sorting
    });

    try {
        const response = await fetch(`${config.USDA_API_BASE_URL}/foods/search?${params}`);
        const data = await response.json();
        
        // Sort results by relevance
        const foods = data.foods || [];
        return foods.sort((a, b) => {
            // Prioritize exact matches
            const aExact = a.description.toLowerCase() === query.toLowerCase();
            const bExact = b.description.toLowerCase() === query.toLowerCase();
            if (aExact && !bExact) return -1;
            if (!aExact && bExact) return 1;

            // Prioritize shorter descriptions (usually simpler items)
            const aLength = a.description.length;
            const bLength = b.description.length;
            if (aLength !== bLength) return aLength - bLength;

            // If lengths are equal, prioritize items with fewer commas (usually simpler items)
            const aCommas = (a.description.match(/,/g) || []).length;
            const bCommas = (b.description.match(/,/g) || []).length;
            return aCommas - bCommas;
        });
    } catch (error) {
        console.error('Error searching ingredients:', error);
        return [];
    }
}

async function getFoodDetails(fdcId) {
    const params = new URLSearchParams({
        api_key: config.USDA_API_KEY
    });

    try {
        const response = await fetch(`${config.USDA_API_BASE_URL}/food/${fdcId}?${params}`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error getting food details:', error);
        return null;
    }
}

// Nutrition Calculations
function calculateNutritionPerGram(foodData) {
    const nutrients = foodData.foodNutrients;
    const nutrition = {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0
    };

    nutrients.forEach(nutrient => {
        const amount = nutrient.amount || 0;
        switch (nutrient.nutrientNumber) {
            case '208': // Energy (kcal)
                nutrition.calories = amount / 100; // per gram
                break;
            case '203': // Protein
                nutrition.protein = amount / 100;
                break;
            case '205': // Carbohydrates
                nutrition.carbs = amount / 100;
                break;
            case '204': // Fat
                nutrition.fat = amount / 100;
                break;
        }
    });

    return nutrition;
}

function updateTotalNutrition() {
    const servings = parseInt(document.getElementById('recipe-servings').value) || 1;
    let totals = {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0
    };

    selectedIngredients.forEach((data, id) => {
        const amount = data.amount;
        totals.calories += data.nutrition.calories * amount;
        totals.protein += data.nutrition.protein * amount;
        totals.carbs += data.nutrition.carbs * amount;
        totals.fat += data.nutrition.fat * amount;
    });

    // Update display (per serving)
    totalCalories.textContent = Math.round(totals.calories / servings);
    totalProtein.textContent = Math.round(totals.protein / servings);
    totalCarbs.textContent = Math.round(totals.carbs / servings);
    totalFat.textContent = Math.round(totals.fat / servings);
}

// UI Functions
function displaySearchResults(results) {
    searchResults.innerHTML = '';
    
    results.forEach(food => {
        const div = document.createElement('div');
        div.className = 'search-result-item';
        div.innerHTML = `
            <h4>${food.description}</h4>
            <p>${food.brandOwner || 'Generic'}</p>
        `;
        
        div.addEventListener('click', async () => {
            const details = await getFoodDetails(food.fdcId);
            if (details) {
                const nutrition = calculateNutritionPerGram(details);
                selectedIngredients.set(food.fdcId, {
                    name: food.description,
                    amount: parseInt(currentIngredientInput.querySelector('.ingredient-amount').value) || 0,
                    nutrition: nutrition
                });
                
                currentIngredientInput.querySelector('.ingredient-name').value = food.description;
                currentIngredientInput.querySelector('.ingredient-name').dataset.fdcId = food.fdcId;
                
                updateTotalNutrition();
                closeIngredientSearch();
            }
        });
        
        searchResults.appendChild(div);
    });
}

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

// Modified Ingredient Management
function addIngredientInput() {
    const ingredientItem = document.createElement('div');
    ingredientItem.className = 'ingredient-item';
    ingredientItem.innerHTML = `
        <input type="text" class="ingredient-name" placeholder="Search for ingredient" required readonly>
        <input type="number" class="ingredient-amount" placeholder="Grams" min="0" required>
        <button type="button" class="remove-ingredient">&times;</button>
    `;

    const nameInput = ingredientItem.querySelector('.ingredient-name');
    const amountInput = ingredientItem.querySelector('.ingredient-amount');

    nameInput.addEventListener('click', () => openIngredientSearch(ingredientItem));
    
    // Update nutrition when amount changes
    amountInput.addEventListener('input', () => {
        const fdcId = nameInput.dataset.fdcId;
        if (fdcId && selectedIngredients.has(fdcId)) {
            const ingredient = selectedIngredients.get(fdcId);
            ingredient.amount = parseInt(amountInput.value) || 0;
            selectedIngredients.set(fdcId, ingredient);
            updateTotalNutrition();
        }
    });

    ingredientItem.querySelector('.remove-ingredient').addEventListener('click', () => {
        if (ingredientsList.children.length > 1) {
            const fdcId = nameInput.dataset.fdcId;
            if (fdcId) {
                selectedIngredients.delete(fdcId);
                updateTotalNutrition();
            }
            ingredientItem.remove();
        }
    });

    ingredientsList.appendChild(ingredientItem);
}

// Update nutrition when servings change
document.getElementById('recipe-servings').addEventListener('input', updateTotalNutrition);

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
        searchResults.innerHTML = '<div class="loading">Searching</div>';
        const results = await searchIngredients(query);
        displaySearchResults(results);
    }
});
ingredientSearchInput.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        searchBtn.click();
    }
});

document.querySelectorAll('.modal .close').forEach(closeBtn => {
    closeBtn.addEventListener('click', () => {
        closeModalHandler();
        closeIngredientSearch();
    });
});

// Modified Recipe Management
function createRecipeCard(recipe) {
    const card = document.createElement('div');
    card.className = 'macro-card recipe-card';
    
    const ingredients = recipe.ingredients
        .map(ing => `${ing.name} (${ing.amount}g)`)
        .join(', ');

    card.innerHTML = `
        <span class="recipe-category">${recipe.category}</span>
        <h3>${recipe.name}</h3>
        <p class="recipe-servings">Servings: ${recipe.servings}</p>
        <p class="recipe-ingredients">
            <strong>Ingredients:</strong><br>
            ${ingredients}
        </p>
        <p class="recipe-nutrition">
            <strong>Per Serving:</strong><br>
            Calories: ${Math.round(recipe.nutrition.calories)} |
            Protein: ${Math.round(recipe.nutrition.protein)}g |
            Carbs: ${Math.round(recipe.nutrition.carbs)}g |
            Fat: ${Math.round(recipe.nutrition.fat)}g
        </p>
        <div class="card-actions">
            <button class="btn" onclick="editRecipe(${recipe.id})">Edit</button>
            <button class="btn btn-secondary" onclick="deleteRecipe(${recipe.id})">Delete</button>
        </div>
    `;
    return card;
}

function addRecipe(recipe) {
    recipes.push(recipe);
    updateRecipeList();
    saveToLocalStorage();
}

function deleteRecipe(id) {
    recipes = recipes.filter(recipe => recipe.id !== id);
    updateRecipeList();
    saveToLocalStorage();
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

// Modified Form Handling
async function handleRecipeSubmit(e) {
    e.preventDefault();

    // Validate that we have at least one ingredient
    if (selectedIngredients.size === 0) {
        alert('Please add at least one ingredient to your recipe');
        return;
    }

    const ingredients = Array.from(ingredientsList.children).map(item => {
        const fdcId = item.querySelector('.ingredient-name').dataset.fdcId;
        const ingredientData = selectedIngredients.get(fdcId);
        if (!ingredientData) return null;
        return {
            fdcId: fdcId,
            name: ingredientData.name,
            amount: ingredientData.amount,
            nutrition: ingredientData.nutrition
        };
    }).filter(ing => ing !== null);

    const servings = parseInt(document.getElementById('recipe-servings').value) || 1;
    const totalNutrition = {
        calories: parseInt(totalCalories.textContent) * servings,
        protein: parseInt(totalProtein.textContent) * servings,
        carbs: parseInt(totalCarbs.textContent) * servings,
        fat: parseInt(totalFat.textContent) * servings
    };

    const newRecipe = {
        id: Date.now(),
        name: document.getElementById('recipe-name').value,
        category: document.getElementById('recipe-category').value,
        servings: servings,
        ingredients: ingredients,
        nutrition: totalNutrition
    };

    addRecipe(newRecipe);
    closeModalHandler();
    selectedIngredients.clear(); // Clear the selected ingredients
}

// Local Storage Management
function saveToLocalStorage() {
    localStorage.setItem('meale-recipes', JSON.stringify(recipes));
    localStorage.setItem('meale-mealPlan', JSON.stringify(mealPlan));
    localStorage.setItem('meale-nutrition', JSON.stringify(nutritionData));
}

function loadFromLocalStorage() {
    const savedRecipes = localStorage.getItem('meale-recipes');
    const savedMealPlan = localStorage.getItem('meale-mealPlan');
    const savedNutrition = localStorage.getItem('meale-nutrition');

    if (savedRecipes) recipes = JSON.parse(savedRecipes);
    if (savedMealPlan) mealPlan = JSON.parse(savedMealPlan);
    if (savedNutrition) nutritionData = JSON.parse(savedNutrition);

    updateRecipeList();
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    loadFromLocalStorage();
}); 