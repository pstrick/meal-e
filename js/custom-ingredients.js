import { version } from './version.js';
import { settings, applyDarkMode } from './settings.js';
import {
    ensureIconify,
    scanIconifyElements,
    normalizeIconValue,
    renderIcon,
    iconifyToDataUrl,
    isDataUrl
} from './icon-utils.js';

// Update version in footer
const versionEl = document.getElementById('version');
if (versionEl) versionEl.textContent = version;

// Custom ingredients data structure
let customIngredients = [];
let editingIngredientId = null;
let selectedIconValue = '';

const FOOD_ICON_OPTIONS = [
    { value: 'food-icon:apple', label: 'Apple', keywords: ['apple', 'fruit', 'produce'] },
    { value: 'food-icon:banana', label: 'Banana', keywords: ['banana', 'fruit', 'produce'] },
    { value: 'food-icon:bread', label: 'Bread', keywords: ['bread', 'bakery', 'grain'] },
    { value: 'food-icon:meat', label: 'Meat', keywords: ['meat', 'protein'] },
    { value: 'food-icon:fish', label: 'Fish', keywords: ['fish', 'seafood', 'protein'] },
    { value: 'food-icon:salad', label: 'Salad', keywords: ['salad', 'greens', 'vegetable'] },
    { value: 'food-icon:cheese', label: 'Cheese', keywords: ['cheese', 'dairy'] },
    { value: 'food-icon:egg', label: 'Egg', keywords: ['egg', 'protein', 'breakfast'] },
    { value: 'food-icon:milk', label: 'Milk', keywords: ['milk', 'dairy', 'drink'] },
    { value: 'food-icon:drink', label: 'Drink', keywords: ['drink', 'beverage'] },
    { value: 'food-icon:snack', label: 'Snack', keywords: ['snack', 'chips', 'treat'] }
].map((item) => ({
    ...item,
    search: `${item.label} ${item.keywords.join(' ')} ${item.value}`.toLowerCase()
}));

let emojiPickerInitialized = false;
let emojiPickerFilter = '';

function updateIconPreview(iconValue) {
    const preview = document.getElementById('ingredient-icon-preview');
    if (!preview) return;
    preview.innerHTML = iconValue ? renderIcon(iconValue, { className: 'ingredient-icon', size: '24px' }) : '';
}

function filterEmojiOptions(term) {
    const normalized = (term || '').trim().toLowerCase();
    if (!normalized) {
        return FOOD_ICON_OPTIONS;
    }
    return FOOD_ICON_OPTIONS.filter((item) => item.search.includes(normalized));
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
        button.innerHTML = renderIcon(item.value, { className: 'ingredient-icon', size: '24px' });
        button.title = item.label;
        button.dataset.iconify = item.value;
        button.addEventListener('click', async () => {
            await applyIconSelection(item);
        });
        grid.appendChild(button);
    });
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

async function applyIconSelection(selectedItem) {
    if (!emojiInput) return;
    const iconifyValue = selectedItem?.value || '';
    
    // Convert Iconify icon to image data URL
    let iconDataUrl = null;
    if (iconifyValue && iconifyValue.startsWith('iconify:')) {
        const iconName = iconifyValue.slice('iconify:'.length);
        try {
            iconDataUrl = await iconifyToDataUrl(iconName);
            if (iconDataUrl) {
                console.log('Icon converted to data URL:', iconName);
            } else {
                console.warn('Failed to convert icon to data URL, keeping iconify reference');
            }
        } catch (error) {
            console.error('Error converting icon to data URL:', error);
        }
    }
    
    // Store the icon value (prefer data URL, fallback to iconify reference)
    selectedIconValue = iconDataUrl || iconifyValue || '';
    
    // Store the icon value in the input's dataset so it persists even if user types.
    // Do not display emoji text in the field – we rely solely on the icon value.
    emojiInput.value = '';
    emojiInput.dataset.iconifyValue = selectedIconValue;
    emojiInput.dataset.iconifyLabel = selectedItem?.label || '';
    console.log('Icon selected:', { 
        icon: selectedIconValue, 
        label: selectedItem?.label,
        isDataUrl: isDataUrl(selectedIconValue)
    });
    updateIconPreview(selectedIconValue);
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

// Migrate old localStorage key to new key
function migrateIngredientsStorage() {
    try {
        const oldKey = 'meale-custom-ingredients';
        const newKey = 'meale-my-ingredients';
        const oldData = localStorage.getItem(oldKey);
        const newData = localStorage.getItem(newKey);
        
        // If new key doesn't exist but old key does, migrate
        if (!newData && oldData) {
            console.log('Migrating ingredients from old storage key to new key...');
            localStorage.setItem(newKey, oldData);
            localStorage.removeItem(oldKey);
            console.log('Migration complete');
        }
    } catch (error) {
        console.error('Error migrating ingredients storage:', error);
    }
}

// Load my ingredients from localStorage
function loadCustomIngredients() {
    try {
        // Migrate old storage key if needed
        migrateIngredientsStorage();
        
        console.log('Loading my ingredients...');
        const savedIngredients = localStorage.getItem('meale-my-ingredients');
        if (savedIngredients) {
            customIngredients = JSON.parse(savedIngredients).map(ingredient => {
                const iconValue = typeof ingredient.icon === 'string' ? ingredient.icon.trim() : '';
                return {
                ...ingredient,
                storeSection: ingredient.storeSection || '',
                    // Stop using emoji for custom ingredients; rely entirely on icon
                    emoji: '',
                    icon: iconValue,
                    iconLabel: ingredient.iconLabel || ''
                };
            });
            console.log('Loaded my ingredients:', customIngredients.length);
        } else {
            console.log('No my ingredients found');
        }
        renderIngredientsList();
    } catch (error) {
        console.error('Error loading my ingredients:', error);
    }
}

// Save my ingredients to localStorage
function saveCustomIngredients() {
    try {
        console.log('Saving my ingredients...');
        localStorage.setItem('meale-my-ingredients', JSON.stringify(customIngredients));
        // Make ingredients available globally
        window.customIngredients = customIngredients;
        window.myIngredients = customIngredients; // Also expose as myIngredients for clarity
        console.log('Saved my ingredients:', customIngredients.length);
    } catch (error) {
        console.error('Error saving my ingredients:', error);
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
        document.getElementById('ingredient-name').value = ingredient.name || '';
        document.getElementById('total-price').value = ingredient.totalPrice || '';
        document.getElementById('total-weight').value = ingredient.totalWeight || '';
        document.getElementById('serving-size').value = ingredient.servingSize || 100;
        const nutrition = ingredient.nutrition || { calories: 0, fat: 0, carbs: 0, protein: 0 };
        document.getElementById('calories').value = Math.round(nutrition.calories || 0);
        document.getElementById('fat').value = nutrition.fat || 0;
        document.getElementById('carbs').value = nutrition.carbs || 0;
        document.getElementById('protein').value = nutrition.protein || 0;
        if (storeSectionInput) {
            storeSectionInput.value = ingredient.storeSection || '';
        }
        if (emojiInput) {
            const iconValue = typeof ingredient.icon === 'string' ? ingredient.icon.trim() : '';
            selectedIconValue = iconValue;
            // Do not display emoji text; just keep icon metadata for the picker
            emojiInput.value = '';
            if (iconValue) {
                emojiInput.dataset.iconifyValue = iconValue;
                emojiInput.dataset.iconifyLabel = ingredient.iconLabel || '';
            } else {
                delete emojiInput.dataset.iconifyValue;
                delete emojiInput.dataset.iconifyLabel;
            }
            updateIconPreview(iconValue);
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
        updateIconPreview('');
    }
    closeEmojiPicker();
    
    // Show modal
    ingredientModal.classList.add('active');
}

// Close ingredient modal
function closeIngredientModal() {
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
async function saveCustomIngredient(event) {
    try {
        event.preventDefault();
        console.log('Saving custom ingredient...');
        
        const storeSectionInput = document.getElementById('store-section');
        // Prioritize icon from dataset (persists even if user types), then selectedIconValue
        let iconValue = emojiInput?.dataset.iconifyValue || selectedIconValue || '';
        const iconLabel = emojiInput?.dataset.iconifyLabel || '';
        
        // If icon is an iconify reference (not already a data URL), convert it to data URL
        if (iconValue && iconValue.startsWith('iconify:') && !isDataUrl(iconValue)) {
            const iconName = iconValue.slice('iconify:'.length);
            console.log('Converting iconify reference to data URL:', iconName);
            const dataUrl = await iconifyToDataUrl(iconName);
            if (dataUrl) {
                iconValue = dataUrl;
                console.log('Icon converted to data URL');
            } else {
                console.warn('Failed to convert icon to data URL, keeping iconify reference');
            }
        }
        
        console.log('Saving ingredient with icon:', { 
            iconValue: iconValue ? (isDataUrl(iconValue) ? 'data URL (length: ' + iconValue.length + ')' : iconValue) : 'none',
            iconLabel, 
            isDataUrl: isDataUrl(iconValue)
        });
        
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
            // Do not store emoji anymore; rely entirely on icon
            emoji: '',
            icon: iconValue, // Primary: icon as data URL (e.g., "data:image/svg+xml;base64,...")
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
        
        // Only render ingredients list if we're on the ingredients page
        const ingredientsList = document.getElementById('custom-ingredients-list');
        if (ingredientsList) {
        renderIngredientsList();
        }
        
        closeIngredientModal();
        selectedIconValue = '';
        
        console.log('Saved ingredient:', ingredient);
        
        // Show success message and dispatch event for other pages to listen
        if (typeof showAlert !== 'undefined') {
            showAlert('Ingredient saved successfully! You can now search for it.', { type: 'success' });
        }
        
        // Dispatch custom event that recipes page can listen to
        window.dispatchEvent(new CustomEvent('ingredientSaved', { detail: { ingredient } }));
        
        // If we were editing a recipe, return to it
        if (window.returnToRecipeAfterIngredient) {
            window.returnToRecipeAfterIngredient = false;
            const recipeModal = document.getElementById('recipe-modal');
            if (recipeModal) {
                // Small delay to ensure modal closes first
                setTimeout(() => {
                    // Re-open the recipe modal
                    recipeModal.classList.add('active');
                    
                    // Focus back on the ingredient input that was being edited
                    if (window.lastEditedIngredientInput) {
                        const nameInput = window.lastEditedIngredientInput.querySelector('.ingredient-name');
                        if (nameInput) {
                            nameInput.focus();
                            // Trigger search again to show the new ingredient
                            const query = nameInput.value.trim();
                            if (query.length >= 2) {
                                setTimeout(() => {
                                    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
                                }, 200);
                            }
                        }
                        window.lastEditedIngredientInput = null;
                    }
                }, 100);
            }
        }
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
                    <td colspan="6" class="no-items">No ingredients found</td>
                </tr>`;
            return;
        }
        
        ingredients.forEach(ingredient => {
            const row = document.createElement('tr');
            const iconSource = ingredient.icon;
            // renderIcon now handles data URLs and iconify references
            const iconMarkup = iconSource ? renderIcon(iconSource, { className: 'ingredient-icon', size: '24px' }) : '';
            const nameHTML = iconMarkup
                ? `${iconMarkup}<span class="ingredient-name-text">${ingredient.name}</span>`
                : `<span class="ingredient-name-text">${ingredient.name}</span>`;
            
            // Handle price and weight display - API ingredients might not have these
            const servingSize = ingredient.servingSize || 100;
            let priceDisplay = 'N/A';
            if (ingredient.totalPrice !== null && ingredient.totalPrice !== undefined && 
                ingredient.totalWeight !== null && ingredient.totalWeight !== undefined) {
                priceDisplay = `$${ingredient.totalPrice.toFixed(2)} (${ingredient.totalWeight}g)`;
            } else if (ingredient.pricePerGram !== null && ingredient.pricePerGram !== undefined) {
                // Calculate estimated price for 100g if we have price per gram
                const estimatedPrice = ingredient.pricePerGram * 100;
                priceDisplay = `~$${estimatedPrice.toFixed(2)}/100g`;
            }
            
            // Nutrition is stored per serving size, so display it correctly
            const nutrition = ingredient.nutrition || { calories: 0, fat: 0, carbs: 0, protein: 0 };
            const caloriesPerServing = Math.round(nutrition.calories || 0);
            const fatPerServing = (nutrition.fat || 0).toFixed(1);
            const carbsPerServing = (nutrition.carbs || 0).toFixed(1);
            const proteinPerServing = (nutrition.protein || 0).toFixed(1);
            
            // Add source indicator for API-sourced ingredients
            let sourceBadge = '';
            if (ingredient.source === 'usda' || ingredient.source === 'openfoodfacts') {
                const sourceLabel = ingredient.source === 'usda' ? 'USDA' : 'OFF';
                sourceBadge = `<span class="source-badge" title="Imported from ${sourceLabel}">${sourceLabel}</span>`;
            }
            
            row.innerHTML = `
                <td class="ingredient-name-cell">${nameHTML} ${sourceBadge}</td>
                <td>${ingredient.storeSection || 'Uncategorized'}</td>
                <td>${priceDisplay}</td>
                <td>${caloriesPerServing} <small>(${servingSize}g)</small></td>
                <td>
                    <div class="macro-info">
                        <span>F: ${fatPerServing}g</span>
                        <span>C: ${carbsPerServing}g</span>
                        <span>P: ${proteinPerServing}g</span>
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
window.openIngredientModal = openIngredientModal;

// Initialize
loadCustomIngredients();
// Apply dark mode on page load
applyDarkMode();

// If we were sent here from another page with a request to open the ingredient modal,
// honor that by opening the existing modal on this page.
try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('openIngredientModal') === '1') {
        openIngredientModal();
    }
} catch (error) {
    console.error('Error checking URL parameters for openIngredientModal:', error);
}