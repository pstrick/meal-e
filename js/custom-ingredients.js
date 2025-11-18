import { version } from './version.js';
import { settings, applyDarkMode } from './settings.js';
import {
    ensureIconify,
    scanIconifyElements,
    normalizeIconValue,
    renderIcon
} from './icon-utils.js';

// Update version in footer
const versionEl = document.getElementById('version');
if (versionEl) versionEl.textContent = version;

// Custom ingredients data structure
let customIngredients = [];
let editingIngredientId = null;
let lastScrapedIngredientData = null;
let selectedIconValue = '';

const ICONIFY_FOOD_ICONS = [
    { icon: 'mdi:food-apple', emoji: '🍎', label: 'Apple', keywords: ['apple', 'produce', 'fruit'] },
    { icon: 'mdi:carrot', emoji: '🥕', label: 'Carrot', keywords: ['carrot', 'vegetable', 'produce'] },
    { icon: 'mdi:food-croissant', emoji: '🥐', label: 'Croissant', keywords: ['croissant', 'pastry', 'bakery'] },
    { icon: 'mdi:cupcake', emoji: '🧁', label: 'Cupcake', keywords: ['cupcake', 'dessert', 'sweet'] },
    { icon: 'mdi:pizza', emoji: '🍕', label: 'Pizza', keywords: ['pizza', 'fastfood'] },
    { icon: 'mdi:hamburger', emoji: '🍔', label: 'Burger', keywords: ['burger', 'fastfood'] },
    { icon: 'mdi:food-drumstick', emoji: '🍗', label: 'Chicken', keywords: ['chicken', 'protein', 'meat'] },
    { icon: 'mdi:food-steak', emoji: '🥩', label: 'Steak', keywords: ['steak', 'beef', 'protein'] },
    { icon: 'mdi:fish', emoji: '🐟', label: 'Fish', keywords: ['fish', 'seafood', 'protein'] },
    { icon: 'mdi:food-soup', emoji: '🍲', label: 'Soup', keywords: ['soup', 'stew', 'comfort'] },
    { icon: 'mdi:food-turkey', emoji: '🦃', label: 'Turkey', keywords: ['turkey', 'protein', 'meat'] },
    { icon: 'mdi:food-variant', emoji: '🍽️', label: 'Meal', keywords: ['meal', 'plate', 'food'] },
    { icon: 'mdi:fruit-grapes', emoji: '🍇', label: 'Grapes', keywords: ['grapes', 'fruit', 'produce'] },
    { icon: 'mdi:fruit-watermelon', emoji: '🍉', label: 'Watermelon', keywords: ['watermelon', 'fruit', 'produce'] },
    { icon: 'mdi:food-banana', emoji: '🍌', label: 'Banana', keywords: ['banana', 'fruit', 'produce'] },
    { icon: 'mdi:fruit-cherries', emoji: '🍒', label: 'Cherries', keywords: ['cherries', 'fruit', 'produce'] },
    { icon: 'mdi:fruit-pineapple', emoji: '🍍', label: 'Pineapple', keywords: ['pineapple', 'fruit', 'tropical'] },
    { icon: 'mdi:fruit-pear', emoji: '🍐', label: 'Pear', keywords: ['pear', 'fruit'] },
    { icon: 'mdi:food-apple-outline', emoji: '🍎', label: 'Apple Outline', keywords: ['apple', 'produce', 'fruit'] },
    { icon: 'mdi:corn', emoji: '🌽', label: 'Corn', keywords: ['corn', 'vegetable'] },
    { icon: 'mdi:food-pepper', emoji: '🫑', label: 'Pepper', keywords: ['pepper', 'vegetable', 'spice'] },
    { icon: 'mdi:food-onion', emoji: '🧅', label: 'Onion', keywords: ['onion', 'aromatic'] },
    { icon: 'mdi:garlic', emoji: '🧄', label: 'Garlic', keywords: ['garlic', 'aromatic'] },
    { icon: 'mdi:mushroom', emoji: '🍄', label: 'Mushroom', keywords: ['mushroom', 'vegetable'] },
    { icon: 'mdi:food-egg', emoji: '🥚', label: 'Egg', keywords: ['egg', 'protein'] },
    { icon: 'mdi:egg-easter', emoji: '🥚', label: 'Egg (Decorated)', keywords: ['egg', 'protein'] },
    { icon: 'mdi:food-hot-dog', emoji: '🌭', label: 'Hot Dog', keywords: ['hotdog', 'fastfood'] },
    { icon: 'mdi:food-takeout-box', emoji: '🥡', label: 'Takeout', keywords: ['takeout', 'box', 'meal'] },
    { icon: 'mdi:food-bowl', emoji: '🥣', label: 'Bowl', keywords: ['bowl', 'meal'] },
    { icon: 'mdi:food-ramen', emoji: '🍜', label: 'Ramen', keywords: ['ramen', 'noodles'] },
    { icon: 'mdi:food-apple-plus', emoji: '🍎', label: 'Apple Plus', keywords: ['apple', 'nutrition'] },
    { icon: 'mdi:noodles', emoji: '🍝', label: 'Noodles', keywords: ['noodles', 'pasta'] },
    { icon: 'mdi:pasta', emoji: '🍝', label: 'Pasta', keywords: ['pasta', 'italian'] },
    { icon: 'mdi:rice', emoji: '🍚', label: 'Rice', keywords: ['rice', 'grain'] },
    { icon: 'mdi:bread-slice', emoji: '🍞', label: 'Bread Slice', keywords: ['bread', 'bakery'] },
    { icon: 'mdi:baguette', emoji: '🥖', label: 'Baguette', keywords: ['bread', 'baguette'] },
    { icon: 'mdi:pretzel', emoji: '🥨', label: 'Pretzel', keywords: ['pretzel', 'snack'] },
    { icon: 'mdi:cookie', emoji: '🍪', label: 'Cookie', keywords: ['cookie', 'dessert'] },
    { icon: 'mdi:cake-variant', emoji: '🍰', label: 'Cake', keywords: ['cake', 'dessert'] },
    { icon: 'mdi:cup-water', emoji: '🥤', label: 'Water', keywords: ['water', 'drink'] },
    { icon: 'mdi:coffee', emoji: '☕️', label: 'Coffee', keywords: ['coffee', 'drink'] },
    { icon: 'mdi:tea', emoji: '🍵', label: 'Tea', keywords: ['tea', 'drink'] },
    { icon: 'mdi:glass-cocktail', emoji: '🍸', label: 'Cocktail', keywords: ['cocktail', 'drink'] },
    { icon: 'mdi:beer', emoji: '🍺', label: 'Beer', keywords: ['beer', 'drink'] },
    { icon: 'mdi:bottle-wine', emoji: '🍷', label: 'Wine', keywords: ['wine', 'drink'] },
    { icon: 'mdi:barbecue', emoji: '🍖', label: 'Barbecue', keywords: ['bbq', 'grill'] },
    { icon: 'mdi:food-burrito', emoji: '🌯', label: 'Burrito', keywords: ['burrito', 'wrap'] },
    { icon: 'mdi:food-taco', emoji: '🌮', label: 'Taco', keywords: ['taco', 'mexican'] },
    { icon: 'mdi:food-kiwi', emoji: '🥝', label: 'Kiwi', keywords: ['kiwi', 'fruit'] },
    { icon: 'mdi:food-grains', emoji: '🌾', label: 'Grains', keywords: ['grains', 'wheat'] },
    { icon: 'mdi:food-corn', emoji: '🌽', label: 'Corn Alt', keywords: ['corn', 'vegetable'] },
    { icon: 'fluent:food-grains-24-filled', emoji: '🌾', label: 'Grains Filled', keywords: ['grain', 'bread'] },
    { icon: 'fluent:food-pizza-24-filled', emoji: '🍕', label: 'Pizza Fluent', keywords: ['pizza', 'fastfood'] },
    { icon: 'fluent:drink-coffee-24-filled', emoji: '☕️', label: 'Coffee Fluent', keywords: ['coffee', 'drink'] },
    { icon: 'fluent:food-carrot-24-filled', emoji: '🥕', label: 'Carrot Fluent', keywords: ['carrot', 'vegetable'] },
    { icon: 'fluent:food-cake-24-filled', emoji: '🍰', label: 'Cake Fluent', keywords: ['cake', 'dessert'] },
    { icon: 'twemoji:grapes', emoji: '🍇', label: 'Emoji Grapes', keywords: ['grapes', 'fruit'] },
    { icon: 'twemoji:hot-dog', emoji: '🌭', label: 'Emoji Hot Dog', keywords: ['hotdog', 'fastfood'] },
    { icon: 'twemoji:hamburger', emoji: '🍔', label: 'Emoji Burger', keywords: ['burger'] },
    { icon: 'twemoji:shallow-pan-of-food', emoji: '🥘', label: 'Emoji Paella', keywords: ['meal', 'food'] },
    { icon: 'twemoji:teacup-without-handle', emoji: '🍵', label: 'Emoji Tea', keywords: ['tea', 'drink'] }
].map((item) => ({
    ...item,
    value: `iconify:${item.icon}`,
    search: `${item.label} ${item.keywords.join(' ')} ${item.icon}`.toLowerCase()
}));

function findIconDefinition(iconValue) {
    const normalized = (iconValue || '').trim();
    if (!normalized) {
        return null;
    }
    return ICONIFY_FOOD_ICONS.find((item) => item.value === normalized) || null;
}

let emojiPickerInitialized = false;
let emojiPickerFilter = '';

function filterEmojiOptions(term) {
    const normalized = (term || '').trim().toLowerCase();
    if (!normalized) {
        return ICONIFY_FOOD_ICONS;
    }
    return ICONIFY_FOOD_ICONS.filter((item) => item.search.includes(normalized));
}

function ensureEmojiPickerPanel() {
    if (!emojiPickerPanel || emojiPickerInitialized) {
        return;
    }

    emojiPickerPanel.innerHTML = '';

    const searchWrapper = document.createElement('div');
    searchWrapper.className = 'emoji-picker-search';

    const searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.placeholder = 'Search food emojis...';
    searchInput.setAttribute('aria-label', 'Search emojis');
    searchInput.autocomplete = 'off';
    searchWrapper.appendChild(searchInput);

    const grid = document.createElement('div');
    grid.className = 'emoji-picker-grid';
    grid.dataset.role = 'emoji-grid';

    const emptyState = document.createElement('div');
    emptyState.className = 'emoji-picker-empty';
    emptyState.dataset.role = 'emoji-empty';
    emptyState.hidden = true;

    emojiPickerPanel.appendChild(searchWrapper);
    emojiPickerPanel.appendChild(grid);
    emojiPickerPanel.appendChild(emptyState);

    searchInput.addEventListener('input', (event) => {
        emojiPickerFilter = event.target.value;
        renderEmojiResults(emojiPickerFilter);
    });

    emojiPickerInitialized = true;
    renderEmojiResults('');
}

function renderEmojiResults(term) {
    if (!emojiPickerPanel) return;
    const grid = emojiPickerPanel.querySelector('[data-role="emoji-grid"]');
    const emptyState = emojiPickerPanel.querySelector('[data-role="emoji-empty"]');
    if (!grid || !emptyState) return;

    const results = filterEmojiOptions(term);
    grid.innerHTML = '';

    if (results.length === 0) {
        emptyState.textContent = 'No emojis match your search.';
        emptyState.hidden = false;
        grid.hidden = true;
        return;
    }

    emptyState.hidden = true;
    grid.hidden = false;

    results.forEach((item) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'emoji-picker-option';
        button.innerHTML = `<span class="iconify" data-icon="${item.icon}" aria-hidden="true"></span>`;
        button.title = item.label;
        button.dataset.iconify = item.value;
        button.addEventListener('click', () => {
            applyIconSelection(item);
        });
        grid.appendChild(button);
    });
    ensureIconify().then(() => scanIconifyElements(grid));
}

function openEmojiPicker(anchor = emojiPickerToggle || emojiInput) {
    if (!emojiPickerPanel) return;
    ensureEmojiPickerPanel();
    emojiPickerPanel.hidden = false;
    const searchInput = emojiPickerPanel.querySelector('input[type="search"]');
    if (searchInput) {
        searchInput.value = '';
        emojiPickerFilter = '';
        renderEmojiResults('');
        setTimeout(() => {
            searchInput.focus({ preventScroll: true });
        }, 10);
    }
}

function closeEmojiPicker() {
    if (!emojiPickerPanel) return;
    emojiPickerPanel.hidden = true;
}

function toggleEmojiPicker(anchor = emojiPickerToggle || emojiInput) {
    if (!emojiPickerPanel) return;
    if (emojiPickerPanel.hidden) {
        openEmojiPicker(anchor);
    } else {
        closeEmojiPicker();
    }
}

function applyIconSelection(selectedItem) {
    if (!emojiInput) return;
    const normalizedEmoji = normalizeIconValue(selectedItem?.emoji);
    selectedIconValue = selectedItem?.value || '';
    emojiInput.value = normalizedEmoji;
    emojiInput.dataset.iconifyValue = selectedIconValue;
    emojiInput.dataset.iconifyLabel = selectedItem?.label || '';
    closeEmojiPicker();
    emojiInput.focus();
}

// DOM Elements
const form = document.getElementById('custom-ingredient-form');
const ingredientsList = document.getElementById('custom-ingredients-list');
const searchInput = document.getElementById('ingredient-search');
const emojiInput = document.getElementById('ingredient-emoji');
const emojiPickerToggle = document.getElementById('emoji-picker-toggle');
const emojiPickerPanel = document.getElementById('emoji-picker-panel');

if (emojiPickerToggle) {
    void ensureEmojiPickerPanel();
}
const addIngredientBtn = document.getElementById('add-ingredient-btn');
const ingredientModal = document.getElementById('ingredient-modal');
const cancelIngredientBtn = document.getElementById('cancel-ingredient');
const closeModalBtn = ingredientModal.querySelector('.close');

// CSV Upload/Download DOM Elements
const downloadCsvTemplateBtn = document.getElementById('download-csv-template-btn');
const uploadCsvBtn = document.getElementById('upload-csv-btn');
const uploadCsvModal = document.getElementById('upload-csv-modal');
const uploadCsvForm = document.getElementById('upload-csv-form');
const csvFileInput = document.getElementById('csv-file-input');
const csvUploadProgress = document.getElementById('csv-upload-progress');
const csvUploadError = document.getElementById('csv-upload-error');
const csvUploadResults = document.getElementById('csv-upload-results');
const csvUploadSummary = document.getElementById('csv-upload-summary');
const csvCloseBtn = uploadCsvModal ? uploadCsvModal.querySelector('.csv-close') : null;
const cancelCsvUploadBtn = document.getElementById('cancel-csv-upload');

// Load custom ingredients from localStorage
function loadCustomIngredients() {
    try {
        console.log('Loading custom ingredients...');
        const savedIngredients = localStorage.getItem('meale-custom-ingredients');
        if (savedIngredients) {
            customIngredients = JSON.parse(savedIngredients).map(ingredient => {
                const iconValue = typeof ingredient.icon === 'string' ? ingredient.icon.trim() : '';
                const iconDef = findIconDefinition(iconValue);
                const fallbackEmoji = iconDef?.emoji || ingredient.emoji;
                return {
                ...ingredient,
                storeSection: ingredient.storeSection || '',
                    emoji: normalizeIconValue(fallbackEmoji),
                    icon: iconValue,
                    iconLabel: ingredient.iconLabel || iconDef?.label || ''
                };
            });
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
            const normalized = normalizeIconValue(ingredient.emoji);
            const iconValue = typeof ingredient.icon === 'string' ? ingredient.icon.trim() : '';
            const iconDef = findIconDefinition(iconValue);
            selectedIconValue = iconValue;
            emojiInput.value = normalized;
            if (iconValue) {
                emojiInput.dataset.iconifyValue = iconValue;
                emojiInput.dataset.iconifyLabel = iconDef?.label || ingredient.iconLabel || '';
            } else {
                delete emojiInput.dataset.iconifyValue;
                delete emojiInput.dataset.iconifyLabel;
            }
        }
    } else {
        if (storeSectionInput) {
            storeSectionInput.value = '';
        }
        if (emojiInput) {
            emojiInput.value = '';
            delete emojiInput.dataset.iconifyValue;
            delete emojiInput.dataset.iconifyLabel;
        }
        selectedIconValue = '';
    }
    closeEmojiPicker();
    
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
    closeEmojiPicker();
    selectedIconValue = '';
    if (emojiInput) {
        delete emojiInput.dataset.iconifyValue;
        delete emojiInput.dataset.iconifyLabel;
    }
}

// Add or update custom ingredient
function saveCustomIngredient(event) {
    try {
        event.preventDefault();
        console.log('Saving custom ingredient...');
        
        const storeSectionInput = document.getElementById('store-section');
        const normalizedEmoji = emojiInput ? normalizeIconValue(emojiInput.value) : '';
        const iconLabel = emojiInput?.dataset.iconifyLabel || '';
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
            emoji: normalizedEmoji,
            icon: selectedIconValue,
            iconLabel: iconLabel
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
        selectedIconValue = '';
        
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
            const iconSource = ingredient.icon || ingredient.emoji;
            const iconMarkup = iconSource ? renderIcon(iconSource, { className: 'ingredient-icon' }) : '';
            const nameHTML = iconMarkup
                ? `${iconMarkup}<span class="ingredient-name-text">${ingredient.name}</span>`
                : `<span class="ingredient-name-text">${ingredient.name}</span>`;
            row.innerHTML = `
                <td class="ingredient-name-cell">${nameHTML}</td>
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
            scanIconifyElements(row);
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

// CSV Upload/Download Functionality

// CSV Template Download Function (must be defined outside conditional)
function downloadCsvTemplate() {
    const headers = [
        'name',
        'emoji',
        'storeSection',
        'totalPrice',
        'totalWeight',
        'servingSize',
        'calories',
        'fat',
        'carbs',
        'protein'
    ];
    
    const exampleRow = [
        'Chicken Breast',
        '🍗',
        'Meat',
        '8.99',
        '500',
        '100',
        '165',
        '3.6',
        '0',
        '31'
    ];
    
    const csvContent = [
        headers.join(','),
        exampleRow.join(','),
        '# Example: Add your ingredients below',
        '# All numeric values should be numbers (no units)',
        '# emoji and storeSection are optional'
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'ingredients-template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

if (downloadCsvTemplateBtn) {
    downloadCsvTemplateBtn.addEventListener('click', downloadCsvTemplate);
}

if (uploadCsvBtn && uploadCsvModal && uploadCsvForm) {
    // CSV Upload and Parse Function
    function parseCsvFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const text = e.target.result;
                    const lines = text.split('\n').filter(line => line.trim() && !line.trim().startsWith('#'));
                    
                    if (lines.length < 2) {
                        reject(new Error('CSV file must have at least a header row and one data row'));
                        return;
                    }
                    
                    // Parse CSV line handling quoted values
                    function parseCsvLine(line) {
                        const result = [];
                        let current = '';
                        let inQuotes = false;
                        
                        for (let i = 0; i < line.length; i++) {
                            const char = line[i];
                            if (char === '"') {
                                inQuotes = !inQuotes;
                            } else if (char === ',' && !inQuotes) {
                                result.push(current.trim());
                                current = '';
                            } else {
                                current += char;
                            }
                        }
                        result.push(current.trim());
                        return result;
                    }
                    
                    const headers = parseCsvLine(lines[0]).map(h => h.trim().toLowerCase());
                    const requiredHeaders = ['name', 'servingsize', 'calories', 'fat', 'carbs', 'protein'];
                    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
                    
                    if (missingHeaders.length > 0) {
                        reject(new Error(`Missing required columns: ${missingHeaders.join(', ')}`));
                        return;
                    }
                    
                    const ingredients = [];
                    for (let i = 1; i < lines.length; i++) {
                        const values = parseCsvLine(lines[i]);
                        if (values.length < headers.length) continue;
                        
                        const nameIndex = headers.indexOf('name');
                        const name = nameIndex >= 0 ? values[nameIndex] || '' : '';
                        
                        if (!name) continue; // Skip rows without a name
                        
                        const getValue = (headerName, defaultValue = '') => {
                            const index = headers.indexOf(headerName);
                            return index >= 0 ? (values[index] || defaultValue) : defaultValue;
                        };
                        
                        const ingredient = {
                            id: Date.now() + i,
                            name: name,
                            emoji: getValue('emoji', '').trim(),
                            storeSection: getValue('storesection', '').trim(),
                            totalPrice: parseFloat(getValue('totalprice', '0')) || null,
                            totalWeight: parseFloat(getValue('totalweight', '0')) || null,
                            servingSize: parseFloat(getValue('servingsize', '100')) || 100,
                            nutrition: {
                                calories: parseFloat(getValue('calories', '0')) || 0,
                                fat: parseFloat(getValue('fat', '0')) || 0,
                                carbs: parseFloat(getValue('carbs', '0')) || 0,
                                protein: parseFloat(getValue('protein', '0')) || 0
                            }
                        };
                        
                        ingredients.push(ingredient);
                    }
                    
                    if (ingredients.length === 0) {
                        reject(new Error('No valid ingredients found in CSV file'));
                        return;
                    }
                    
                    resolve(ingredients);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }
    
    // CSV Upload Modal Functions
    const openCsvUploadModal = () => {
        if (uploadCsvModal) {
            uploadCsvModal.style.display = 'block';
            uploadCsvModal.classList.add('active');
            if (csvFileInput) {
                csvFileInput.value = '';
            }
            if (csvUploadError) {
                csvUploadError.hidden = true;
                csvUploadError.textContent = '';
            }
            if (csvUploadResults) {
                csvUploadResults.hidden = true;
            }
            if (csvUploadProgress) {
                csvUploadProgress.hidden = true;
            }
        }
    };
    
    const closeCsvUploadModal = () => {
        if (uploadCsvModal) {
            uploadCsvModal.style.display = 'none';
            uploadCsvModal.classList.remove('active');
        }
        if (csvUploadProgress) {
            csvUploadProgress.hidden = true;
        }
    };
    
    const showCsvError = (message) => {
        if (csvUploadError) {
            csvUploadError.textContent = message;
            csvUploadError.hidden = false;
        }
        if (csvUploadResults) {
            csvUploadResults.hidden = true;
        }
    };
    
    const showCsvResults = (imported, skipped, errors) => {
        if (csvUploadResults && csvUploadSummary) {
            let summary = `Successfully imported ${imported} ingredient(s).`;
            if (skipped > 0) {
                summary += ` ${skipped} ingredient(s) skipped (duplicates or invalid data).`;
            }
            if (errors.length > 0) {
                summary += ` Errors: ${errors.join(', ')}`;
            }
            csvUploadSummary.textContent = summary;
            csvUploadResults.hidden = false;
        }
    };
    
    const handleCsvUpload = async (event) => {
        event.preventDefault();
        if (!csvFileInput || !csvFileInput.files || csvFileInput.files.length === 0) {
            showCsvError('Please select a CSV file');
            return;
        }
        
        const file = csvFileInput.files[0];
        if (csvUploadProgress) {
            csvUploadProgress.hidden = false;
        }
        if (csvUploadError) {
            csvUploadError.hidden = true;
        }
        
        try {
            const importedIngredients = await parseCsvFile(file);
            
            let imported = 0;
            let skipped = 0;
            const errors = [];
            
            importedIngredients.forEach(ingredient => {
                // Check for duplicates by name
                const existing = customIngredients.find(ci => 
                    ci.name.toLowerCase() === ingredient.name.toLowerCase()
                );
                
                if (existing) {
                    skipped++;
                } else {
                    customIngredients.push(ingredient);
                    imported++;
                }
            });
            
            if (imported > 0) {
                saveCustomIngredients();
                renderIngredientsList();
            }
            
            showCsvResults(imported, skipped, errors);
            
            // Auto-close after 3 seconds if successful
            if (imported > 0) {
                setTimeout(() => {
                    closeCsvUploadModal();
                }, 3000);
            }
        } catch (error) {
            console.error('CSV upload error:', error);
            showCsvError(error.message || 'Failed to process CSV file. Please check the format.');
        } finally {
            if (csvUploadProgress) {
                csvUploadProgress.hidden = true;
            }
        }
    };
    
    // Event Listeners
    uploadCsvBtn.addEventListener('click', openCsvUploadModal);
    uploadCsvForm.addEventListener('submit', handleCsvUpload);
    
    if (csvCloseBtn) {
        csvCloseBtn.addEventListener('click', closeCsvUploadModal);
    }
    
    if (cancelCsvUploadBtn) {
        cancelCsvUploadBtn.addEventListener('click', closeCsvUploadModal);
    }
    
    window.addEventListener('click', (event) => {
        if (event.target === uploadCsvModal) {
            closeCsvUploadModal();
        }
    });
    
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && uploadCsvModal && uploadCsvModal.classList.contains('active')) {
            closeCsvUploadModal();
        }
    });
}

// Event Listeners
if (form) {
    form.addEventListener('submit', saveCustomIngredient);
    form.addEventListener('reset', closeEmojiPicker);
}
if (searchInput) {
    searchInput.addEventListener('input', searchIngredients);
}
if (addIngredientBtn) {
    addIngredientBtn.addEventListener('click', () => openIngredientModal());
}
if (cancelIngredientBtn) {
    cancelIngredientBtn.addEventListener('click', closeIngredientModal);
}
if (closeModalBtn) {
    closeModalBtn.addEventListener('click', closeIngredientModal);
}

if (emojiInput) {
    emojiInput.addEventListener('focus', () => {
        void openEmojiPicker(emojiInput);
    });
    emojiInput.addEventListener('click', () => {
        void openEmojiPicker(emojiInput);
    });
    emojiInput.addEventListener('input', () => {
        const sanitized = normalizeIconValue(emojiInput.value);
        if (emojiInput.value !== sanitized) {
            emojiInput.value = sanitized;
        }
        selectedIconValue = '';
        delete emojiInput.dataset.iconifyValue;
        delete emojiInput.dataset.iconifyLabel;
    });
}

if (emojiPickerToggle) {
    emojiPickerToggle.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        void toggleEmojiPicker(emojiPickerToggle);
    });
}

document.addEventListener('click', (event) => {
    if (!emojiPickerPanel || emojiPickerPanel.hidden) return;
    if (
        emojiPickerPanel.contains(event.target) ||
        (emojiPickerToggle && emojiPickerToggle.contains(event.target)) ||
        (emojiInput && emojiInput.contains(event.target))
    ) {
        return;
    }
    closeEmojiPicker();
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && emojiPickerPanel && !emojiPickerPanel.hidden) {
        closeEmojiPicker();
    }
});

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