import config from './config.js';
import { version } from './version.js';

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
        dataType: ['Survey (FNDDS)', 'Foundation', 'SR Legacy'],
        pageSize: 25
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

        // Split search terms and normalize
        const searchTerms = query.toLowerCase()
            .split(/[,\s]+/)
            .map(term => term.trim())
            .filter(term => term.length > 0);

        // Filter and score results
        const foods = data.foods.filter(food => {
            const description = food.description.toLowerCase();
            // At least one search term must be present
            return searchTerms.some(term => 
                description.includes(normalizeSearchTerm(term))
            );
        });

        // Sort by relevancy score
        return foods.sort((a, b) => {
            const scoreA = calculateRelevancyScore(a.description, searchTerms);
            const scoreB = calculateRelevancyScore(b.description, searchTerms);
            return scoreB - scoreA;
        });

    } catch (error) {
        console.error('Error searching ingredients:', error);
        throw error;
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

// Modified Nutrition Calculations
function calculateNutritionPerGram(foodData) {
    const nutrients = foodData.foodNutrients;
    const nutrition = {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0
    };

    nutrients.forEach(nutrient => {
        // Using nutrientId instead of nutrientNumber for more reliable matching
        switch (nutrient.nutrientId) {
            case 1008: // Energy (kcal)
                nutrition.calories = nutrient.amount / 100; // per gram
                break;
            case 1003: // Protein
                nutrition.protein = nutrient.amount / 100;
                break;
            case 1005: // Carbohydrates
                nutrition.carbs = nutrient.amount / 100;
                break;
            case 1004: // Total Fat
                nutrition.fat = nutrient.amount / 100;
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

    // Log for debugging
    console.log('Selected Ingredients:', selectedIngredients);

    selectedIngredients.forEach((data) => {
        if (data.nutrition && data.amount) {
            const amount = parseFloat(data.amount) || 0;
            console.log(`Calculating for ${data.name}:`, {
                amount,
                nutrition: data.nutrition
            });
            
            totals.calories += data.nutrition.calories * amount;
            totals.protein += data.nutrition.protein * amount;
            totals.carbs += data.nutrition.carbs * amount;
            totals.fat += data.nutrition.fat * amount;
        }
    });

    console.log('Total nutrition before per-serving:', totals);
    console.log('Servings:', servings);

    // Update display (per serving)
    totalCalories.textContent = Math.round(totals.calories / servings);
    totalProtein.textContent = Math.round(totals.protein / servings);
    totalCarbs.textContent = Math.round(totals.carbs / servings);
    totalFat.textContent = Math.round(totals.fat / servings);

    console.log('Updated display values:', {
        calories: totalCalories.textContent,
        protein: totalProtein.textContent,
        carbs: totalCarbs.textContent,
        fat: totalFat.textContent
    });
}

// Add event listeners for nutrition updates
document.getElementById('recipe-servings').addEventListener('input', () => {
    console.log('Servings changed, updating nutrition...');
    updateTotalNutrition();
});

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
                    
                    selectedIngredients.set(food.fdcId.toString(), {
                        name: food.description,
                        amount: amount,
                        nutrition: nutrition
                    });
                    
                    currentIngredientInput.querySelector('.ingredient-name').value = food.description;
                    currentIngredientInput.querySelector('.ingredient-name').dataset.fdcId = food.fdcId.toString();
                    
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
        <input type="text" class="ingredient-name" placeholder="Search for ingredient" required readonly>
        <input type="number" class="ingredient-amount" placeholder="Grams" min="0" step="0.1" required value="0">
        <button type="button" class="remove-ingredient">&times;</button>
    `;

    const nameInput = ingredientItem.querySelector('.ingredient-name');
    const amountInput = ingredientItem.querySelector('.ingredient-amount');

    nameInput.addEventListener('click', () => openIngredientSearch(ingredientItem));
    
    // Update nutrition when amount changes
    amountInput.addEventListener('input', () => {
        console.log('Amount changed for ingredient');
        const fdcId = nameInput.dataset.fdcId;
        if (fdcId && selectedIngredients.has(fdcId)) {
            const ingredient = selectedIngredients.get(fdcId);
            ingredient.amount = parseFloat(amountInput.value) || 0;
            console.log('Updated ingredient:', ingredient);
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