import { version } from './version.js';
import { settings, applyDarkMode } from './settings.js';

// Update version in footer
const versionEl = document.getElementById('version');
if (versionEl) versionEl.textContent = version;

// Custom ingredients data structure
let customIngredients = [];
let editingIngredientId = null;

// DOM Elements
const form = document.getElementById('custom-ingredient-form');
const ingredientsList = document.getElementById('custom-ingredients-list');
const searchInput = document.getElementById('ingredient-search');
const emojiInput = document.getElementById('ingredient-emoji');
const addIngredientBtn = document.getElementById('add-ingredient-btn');
const ingredientModal = document.getElementById('ingredient-modal');
const cancelIngredientBtn = document.getElementById('cancel-ingredient');
const closeModalBtn = ingredientModal.querySelector('.close');

// Load custom ingredients from localStorage
function loadCustomIngredients() {
    try {
        console.log('Loading custom ingredients...');
        const savedIngredients = localStorage.getItem('meale-custom-ingredients');
        if (savedIngredients) {
            customIngredients = JSON.parse(savedIngredients).map(ingredient => ({
                ...ingredient,
                storeSection: ingredient.storeSection || '',
                emoji: (() => {
                    const trimmed = (ingredient.emoji || '').trim();
                    return trimmed ? Array.from(trimmed).slice(0, 2).join('') : '';
                })()
            }));
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

// Open modal for adding/editing ingredient
function openIngredientModal(ingredient = null) {
    editingIngredientId = ingredient ? ingredient.id : null;
    
    // Reset form
    form.reset();
    
    // Set form title
    const modalTitle = ingredientModal.querySelector('h2');
    modalTitle.textContent = ingredient ? 'Edit Ingredient' : 'Add New Ingredient';
    
    // Fill form if editing
    const storeSectionInput = document.getElementById('store-section');

    if (ingredient) {
        document.getElementById('ingredient-name').value = ingredient.name;
        document.getElementById('total-price').value = ingredient.totalPrice;
        document.getElementById('total-weight').value = ingredient.totalWeight;
        document.getElementById('serving-size').value = ingredient.servingSize;
        document.getElementById('calories').value = ingredient.nutrition.calories;
        document.getElementById('fat').value = ingredient.nutrition.fat;
        document.getElementById('carbs').value = ingredient.nutrition.carbs;
        document.getElementById('protein').value = ingredient.nutrition.protein;
        if (storeSectionInput) {
            storeSectionInput.value = ingredient.storeSection || '';
        }
        if (emojiInput) {
            emojiInput.value = ingredient.emoji || '';
        }
    } else {
        if (storeSectionInput) {
            storeSectionInput.value = '';
        }
        if (emojiInput) {
            emojiInput.value = '';
        }
    }
    
    // Show modal
    ingredientModal.style.display = 'block';
    ingredientModal.classList.add('active');
}

// Close ingredient modal
function closeIngredientModal() {
    ingredientModal.style.display = 'none';
    ingredientModal.classList.remove('active');
    editingIngredientId = null;
    form.reset();
}

// Add or update custom ingredient
function saveCustomIngredient(event) {
    try {
        event.preventDefault();
        console.log('Saving custom ingredient...');
        
        const storeSectionInput = document.getElementById('store-section');
        const emojiValue = emojiInput ? emojiInput.value.trim() : '';
        const normalizedEmoji = emojiValue ? Array.from(emojiValue).slice(0, 2).join('') : '';
        const ingredient = {
            id: editingIngredientId || Date.now().toString(),
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
            isCustom: true,
            storeSection: storeSectionInput ? storeSectionInput.value.trim() : '',
            emoji: normalizedEmoji
        };
        
        // Calculate price per gram
        ingredient.pricePerGram = ingredient.totalPrice / ingredient.totalWeight;
        
        if (editingIngredientId) {
            // Update existing ingredient
            const index = customIngredients.findIndex(ing => ing.id === editingIngredientId);
            if (index !== -1) {
                customIngredients[index] = ingredient;
            }
        } else {
            // Add new ingredient
            customIngredients.push(ingredient);
        }
        
        saveCustomIngredients();
        renderIngredientsList();
        closeIngredientModal();
        
        console.log('Saved ingredient:', ingredient);
    } catch (error) {
        console.error('Error saving custom ingredient:', error);
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
        const tbody = ingredientsList.querySelector('tbody');
        tbody.innerHTML = '';
        
        if (ingredients.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="no-items">No custom ingredients found</td>
                </tr>`;
            return;
        }
        
        ingredients.forEach(ingredient => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${ingredient.emoji ? `<span class="ingredient-emoji">${ingredient.emoji}</span> ` : ''}${ingredient.name}</td>
                <td>${ingredient.storeSection || 'Uncategorized'}</td>
                <td>$${ingredient.totalPrice.toFixed(2)} (${ingredient.totalWeight}g)</td>
                <td>${ingredient.nutrition.calories}</td>
                <td>
                    <div class="macro-info">
                        <span>F: ${ingredient.nutrition.fat}g</span>
                        <span>C: ${ingredient.nutrition.carbs}g</span>
                        <span>P: ${ingredient.nutrition.protein}g</span>
                    </div>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-edit" onclick="editCustomIngredient('${ingredient.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-delete" onclick="deleteCustomIngredient('${ingredient.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Error rendering ingredients list:', error);
    }
}

// Edit custom ingredient
function editCustomIngredient(id) {
    const ingredient = customIngredients.find(ing => ing.id === id);
    if (ingredient) {
        openIngredientModal(ingredient);
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
form.addEventListener('submit', saveCustomIngredient);
searchInput.addEventListener('input', searchIngredients);
addIngredientBtn.addEventListener('click', () => openIngredientModal());
cancelIngredientBtn.addEventListener('click', closeIngredientModal);
closeModalBtn.addEventListener('click', closeIngredientModal);

// Close modal when clicking outside
window.addEventListener('click', (event) => {
    if (event.target === ingredientModal) {
        closeIngredientModal();
    }
});

// Make functions available globally
window.deleteCustomIngredient = deleteCustomIngredient;
window.editCustomIngredient = editCustomIngredient;

// Initialize
loadCustomIngredients();
// Apply dark mode on page load
applyDarkMode(); 