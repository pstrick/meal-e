import { version } from './version.js';

// Update version in footer
document.getElementById('version').textContent = version;

// Custom ingredients data structure
let customIngredients = [];

// DOM Elements
const form = document.getElementById('custom-ingredient-form');
const ingredientsList = document.getElementById('custom-ingredients-list');
const searchInput = document.getElementById('ingredient-search');

// Load custom ingredients from localStorage
function loadCustomIngredients() {
    try {
        console.log('Loading custom ingredients...');
        const savedIngredients = localStorage.getItem('meale-custom-ingredients');
        if (savedIngredients) {
            customIngredients = JSON.parse(savedIngredients);
            console.log('Loaded custom ingredients:', customIngredients.length);
        } else {
            console.log('No custom ingredients found');
        }
        renderIngredientsList();
    } catch (error) {
        console.error('Error loading custom ingredients:', error);
    }
}

// Save custom ingredients to localStorage
function saveCustomIngredients() {
    try {
        console.log('Saving custom ingredients...');
        localStorage.setItem('meale-custom-ingredients', JSON.stringify(customIngredients));
        // Make ingredients available globally
        window.customIngredients = customIngredients;
        console.log('Saved custom ingredients:', customIngredients.length);
    } catch (error) {
        console.error('Error saving custom ingredients:', error);
    }
}

// Add new custom ingredient
function addCustomIngredient(event) {
    try {
        event.preventDefault();
        console.log('Adding new custom ingredient...');
        
        const ingredient = {
            id: Date.now().toString(),
            name: document.getElementById('ingredient-name').value,
            totalPrice: parseFloat(document.getElementById('total-price').value),
            totalWeight: parseFloat(document.getElementById('total-weight').value),
            servingSize: parseFloat(document.getElementById('serving-size').value),
            nutrition: {
                calories: parseInt(document.getElementById('calories').value),
                fat: parseFloat(document.getElementById('fat').value),
                carbs: parseFloat(document.getElementById('carbs').value),
                protein: parseFloat(document.getElementById('protein').value)
            },
            isCustom: true
        };
        
        // Calculate price per gram
        ingredient.pricePerGram = ingredient.totalPrice / ingredient.totalWeight;
        
        customIngredients.push(ingredient);
        saveCustomIngredients();
        renderIngredientsList();
        form.reset();
        
        console.log('Added new ingredient:', ingredient);
    } catch (error) {
        console.error('Error adding custom ingredient:', error);
    }
}

// Delete custom ingredient
function deleteCustomIngredient(id) {
    try {
        console.log('Deleting custom ingredient:', id);
        customIngredients = customIngredients.filter(ing => ing.id !== id);
        saveCustomIngredients();
        renderIngredientsList();
    } catch (error) {
        console.error('Error deleting custom ingredient:', error);
    }
}

// Render ingredients list
function renderIngredientsList(filteredIngredients = null) {
    try {
        console.log('Rendering ingredients list...');
        const ingredients = filteredIngredients || customIngredients;
        ingredientsList.innerHTML = '';
        
        if (ingredients.length === 0) {
            ingredientsList.innerHTML = '<p class="no-items">No custom ingredients found</p>';
            return;
        }
        
        ingredients.forEach(ingredient => {
            const ingredientElement = document.createElement('div');
            ingredientElement.className = 'ingredient-item';
            ingredientElement.innerHTML = `
                <div class="ingredient-info">
                    <h3>${ingredient.name}</h3>
                    <p>Price: $${ingredient.totalPrice.toFixed(2)} (${ingredient.totalWeight}g)</p>
                    <p>Serving: ${ingredient.servingSize}g</p>
                    <p>Nutrition per serving:</p>
                    <ul>
                        <li>Calories: ${ingredient.nutrition.calories}</li>
                        <li>Fat: ${ingredient.nutrition.fat}g</li>
                        <li>Carbs: ${ingredient.nutrition.carbs}g</li>
                        <li>Protein: ${ingredient.nutrition.protein}g</li>
                    </ul>
                </div>
                <button class="btn btn-danger" onclick="deleteCustomIngredient('${ingredient.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            `;
            ingredientsList.appendChild(ingredientElement);
        });
    } catch (error) {
        console.error('Error rendering ingredients list:', error);
    }
}

// Search ingredients
function searchIngredients(event) {
    try {
        const searchTerm = event.target.value.toLowerCase();
        console.log('Searching ingredients:', searchTerm);
        
        const filteredIngredients = customIngredients.filter(ingredient =>
            ingredient.name.toLowerCase().includes(searchTerm)
        );
        
        renderIngredientsList(filteredIngredients);
    } catch (error) {
        console.error('Error searching ingredients:', error);
    }
}

// Event Listeners
form.addEventListener('submit', addCustomIngredient);
searchInput.addEventListener('input', searchIngredients);

// Make delete function available globally
window.deleteCustomIngredient = deleteCustomIngredient;

// Initialize
loadCustomIngredients(); 