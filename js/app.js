// DOM Elements
const navLinks = document.querySelectorAll('nav a');
const sections = document.querySelectorAll('.section');
const addRecipeBtn = document.getElementById('add-recipe');
const recipeList = document.getElementById('recipe-list');

// Sample data structure (will be replaced with localStorage later)
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

// Recipe Management
function createRecipeCard(recipe) {
    const card = document.createElement('div');
    card.className = 'macro-card';
    card.innerHTML = `
        <h3>${recipe.name}</h3>
        <p>${recipe.description}</p>
        <p><strong>Calories:</strong> ${recipe.calories}</p>
        <div class="card-actions">
            <button class="btn" onclick="editRecipe(${recipe.id})">Edit</button>
            <button class="btn" onclick="deleteRecipe(${recipe.id})">Delete</button>
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
    recipes.forEach(recipe => {
        recipeList.appendChild(createRecipeCard(recipe));
    });
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

// Add Recipe Button Handler
addRecipeBtn.addEventListener('click', () => {
    const newRecipe = {
        id: Date.now(),
        name: 'New Recipe',
        description: 'Click to edit this recipe',
        calories: 0,
        ingredients: []
    };
    addRecipe(newRecipe);
});

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    loadFromLocalStorage();
}); 