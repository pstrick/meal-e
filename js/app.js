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

// Sample data structure
let recipes = [];
let mealPlan = {};
let nutritionData = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0
};

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

// Ingredient Management
function addIngredientInput() {
    const ingredientItem = document.createElement('div');
    ingredientItem.className = 'ingredient-item';
    ingredientItem.innerHTML = `
        <input type="text" class="ingredient-name" placeholder="Ingredient name" required>
        <input type="number" class="ingredient-amount" placeholder="Grams" min="0" required>
        <button type="button" class="remove-ingredient">&times;</button>
    `;

    ingredientItem.querySelector('.remove-ingredient').addEventListener('click', () => {
        if (ingredientsList.children.length > 1) {
            ingredientItem.remove();
        }
    });

    ingredientsList.appendChild(ingredientItem);
}

// Recipe Management
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

// Form Handling
function handleRecipeSubmit(e) {
    e.preventDefault();

    const ingredients = Array.from(ingredientsList.children).map(item => ({
        name: item.querySelector('.ingredient-name').value,
        amount: parseInt(item.querySelector('.ingredient-amount').value)
    }));

    const newRecipe = {
        id: Date.now(),
        name: document.getElementById('recipe-name').value,
        category: document.getElementById('recipe-category').value,
        servings: parseInt(document.getElementById('recipe-servings').value),
        ingredients: ingredients
    };

    addRecipe(newRecipe);
    closeModalHandler();
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

// Event Listeners
addRecipeBtn.addEventListener('click', openModal);
closeModal.addEventListener('click', closeModalHandler);
cancelRecipe.addEventListener('click', closeModalHandler);
addIngredientBtn.addEventListener('click', addIngredientInput);
recipeForm.addEventListener('submit', handleRecipeSubmit);
categoryFilter.addEventListener('change', updateRecipeList);

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    loadFromLocalStorage();
}); 