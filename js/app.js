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
async function searchIngredients(query) {
    const params = new URLSearchParams({
        api_key: config.USDA_API_KEY,
        query: query,
        dataType: ['Survey (FNDDS)'],
        pageSize: 25
    });

    try {
        const response = await fetch(`${config.USDA_API_BASE_URL}/foods/search?${params}`);
        const data = await response.json();
        
        // Filter and sort results
        const searchTerms = query.toLowerCase().split(',').map(term => term.trim());
        const foods = (data.foods || []).filter(food => {
            const description = food.description.toLowerCase();
            // All search terms must be present in the description
            return searchTerms.every(term => description.includes(term));
        });

        return foods.sort((a, b) => {
            const aDesc = a.description.toLowerCase();
            const bDesc = b.description.toLowerCase();
            
            // Exact match gets highest priority
            if (aDesc === query.toLowerCase()) return -1;
            if (bDesc === query.toLowerCase()) return 1;

            // Then prioritize by how many search terms are at the start of the description
            const aStartMatches = searchTerms.filter(term => aDesc.startsWith(term)).length;
            const bStartMatches = searchTerms.filter(term => bDesc.startsWith(term)).length;
            if (aStartMatches !== bStartMatches) return bStartMatches - aStartMatches;

            // Then by description length
            return aDesc.length - bDesc.length;
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
        if (data.nutrition && data.amount) {
            totals.calories += data.nutrition.calories * data.amount;
            totals.protein += data.nutrition.protein * data.amount;
            totals.carbs += data.nutrition.carbs * data.amount;
            totals.fat += data.nutrition.fat * data.amount;
        }
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
                const amount = parseInt(currentIngredientInput.querySelector('.ingredient-amount').value) || 0;
                
                selectedIngredients.set(food.fdcId, {
                    name: food.description,
                    amount: amount,
                    nutrition: nutrition
                });
                
                currentIngredientInput.querySelector('.ingredient-name').value = food.description;
                currentIngredientInput.querySelector('.ingredient-name').dataset.fdcId = food.fdcId;
                
                updateTotalNutrition(); // Update nutrition when ingredient is selected
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
        <input type="number" class="ingredient-amount" placeholder="Grams" min="0" required value="0">
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
                updateTotalNutrition(); // Update nutrition when ingredient is removed
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

    // Ensure nutrition values exist or default to 0
    const nutrition = recipe.nutrition || {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0
    };

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
            Calories: ${Math.round(nutrition.calories)} |
            Protein: ${Math.round(nutrition.protein)}g |
            Carbs: ${Math.round(nutrition.carbs)}g |
            Fat: ${Math.round(nutrition.fat)}g
        </p>
        <div class="card-actions">
            <button class="btn" onclick="editRecipe(${recipe.id})">Edit</button>
            <button class="btn btn-secondary" onclick="deleteRecipe(${recipe.id})">Delete</button>
        </div>
    `;
    return card;
}

function addRecipe(recipe) {
    // Ensure the recipe has all required properties
    const validatedRecipe = {
        id: recipe.id,
        name: recipe.name,
        category: recipe.category,
        servings: recipe.servings,
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

// Modified Form Handling
async function handleRecipeSubmit(e, editId = null) {
    e.preventDefault();

    // Validate that we have at least one ingredient
    if (selectedIngredients.size === 0) {
        alert('Please add at least one ingredient to your recipe');
        return;
    }

    // Validate required fields
    const name = document.getElementById('recipe-name').value.trim();
    const servings = parseInt(document.getElementById('recipe-servings').value);
    
    if (!name || !servings || servings < 1) {
        alert('Please fill in all required fields');
        return;
    }

    const ingredients = Array.from(ingredientsList.children)
        .map(item => {
            const fdcId = item.querySelector('.ingredient-name').dataset.fdcId;
            const ingredientData = selectedIngredients.get(fdcId);
            if (!ingredientData) return null;
            return {
                fdcId: fdcId,
                name: ingredientData.name,
                amount: ingredientData.amount,
                nutrition: ingredientData.nutrition
            };
        })
        .filter(ing => ing !== null);

    // Calculate total nutrition values
    const totalNutrition = {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0
    };

    ingredients.forEach(ing => {
        if (ing.nutrition && ing.amount) {
            totalNutrition.calories += (ing.nutrition.calories * ing.amount);
            totalNutrition.protein += (ing.nutrition.protein * ing.amount);
            totalNutrition.carbs += (ing.nutrition.carbs * ing.amount);
            totalNutrition.fat += (ing.nutrition.fat * ing.amount);
        }
    });

    // Convert total nutrition to per-serving values
    const perServingNutrition = {
        calories: totalNutrition.calories / servings,
        protein: totalNutrition.protein / servings,
        carbs: totalNutrition.carbs / servings,
        fat: totalNutrition.fat / servings
    };

    const newRecipe = {
        id: editId || Date.now(),
        name: name,
        category: document.getElementById('recipe-category').value,
        servings: servings,
        ingredients: ingredients,
        nutrition: perServingNutrition
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
    document.getElementById('recipe-servings').value = recipe.servings;

    // Add ingredients
    recipe.ingredients.forEach(ing => {
        const ingredientItem = document.createElement('div');
        ingredientItem.className = 'ingredient-item';
        ingredientItem.innerHTML = `
            <input type="text" class="ingredient-name" placeholder="Search for ingredient" required readonly value="${ing.name}">
            <input type="number" class="ingredient-amount" placeholder="Grams" min="0" required value="${ing.amount}">
            <button type="button" class="remove-ingredient">&times;</button>
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
    });

    // Update nutrition display
    updateTotalNutrition();

    // Show modal
    openModal();

    // Update form submission to handle edit
    const originalSubmit = recipeForm.onsubmit;
    recipeForm.onsubmit = (e) => {
        e.preventDefault();
        handleRecipeSubmit(e, id);
    };
}

// Make edit and delete functions globally available
window.editRecipe = editRecipe;
window.deleteRecipe = deleteRecipe; 