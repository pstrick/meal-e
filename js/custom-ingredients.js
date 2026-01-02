import { version } from './version.js';
import { settings, applyDarkMode } from './settings.js';

// Update version in footer
const versionEl = document.getElementById('version');
if (versionEl) versionEl.textContent = version;

// Custom ingredients data structure
let customIngredients = [];
let editingIngredientId = null;
let selectedImageDataUrl = '';

// Image upload handling
function updateImagePreview(imageDataUrl) {
    const previewImg = document.getElementById('ingredient-image-preview-img');
    const removeBtn = document.getElementById('ingredient-image-remove-btn');
    if (!previewImg || !removeBtn) return;
    
    if (imageDataUrl) {
        previewImg.src = imageDataUrl;
        previewImg.style.display = 'block';
        removeBtn.style.display = 'inline-block';
    } else {
        previewImg.src = '';
        previewImg.style.display = 'none';
        removeBtn.style.display = 'none';
    }
}

function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
        alert('Please select an image file.');
        return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        alert('Image size must be less than 5MB.');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        selectedImageDataUrl = e.target.result;
        updateImagePreview(selectedImageDataUrl);
        console.log('Image uploaded:', file.name, 'Size:', file.size, 'bytes');
    };
    reader.onerror = () => {
        alert('Error reading image file.');
    };
    reader.readAsDataURL(file);
}

function removeImage() {
    const fileInput = document.getElementById('ingredient-image');
    if (fileInput) {
        fileInput.value = '';
    }
    selectedImageDataUrl = '';
    updateImagePreview('');
}

// DOM Elements
const form = document.getElementById('custom-ingredient-form');
const ingredientsList = document.getElementById('custom-ingredients-list');
const searchInput = document.getElementById('ingredient-search');
const imageInput = document.getElementById('ingredient-image');
const imageUploadBtn = document.getElementById('ingredient-image-upload-btn');
const imageRemoveBtn = document.getElementById('ingredient-image-remove-btn');
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
                // Support both image and icon for backward compatibility
                const imageValue = ingredient.image || ingredient.icon || '';
                return {
                ...ingredient,
                storeSection: ingredient.storeSection || '',
                    emoji: '',
                    image: imageValue
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
        // Load image if available
        const imageValue = typeof ingredient.image === 'string' ? ingredient.image.trim() : '';
        selectedImageDataUrl = imageValue;
        updateImagePreview(imageValue);
    } else {
        if (storeSectionInput) {
            storeSectionInput.value = '';
        }
        selectedImageDataUrl = '';
        updateImagePreview('');
    }
    
    // Show modal
    ingredientModal.classList.add('active');
}

// Close ingredient modal
function closeIngredientModal() {
    ingredientModal.classList.remove('active');
    editingIngredientId = null;
    form.reset();
    selectedImageDataUrl = '';
    updateImagePreview('');
    if (imageInput) {
        imageInput.value = '';
    }
}

// Add or update custom ingredient
async function saveCustomIngredient(event) {
    try {
        event.preventDefault();
        console.log('Saving custom ingredient...');
        
        const storeSectionInput = document.getElementById('store-section');
        
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
            emoji: '',
            image: selectedImageDataUrl || '' // Store uploaded image as data URL
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
        selectedImageDataUrl = '';
        
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
            const imageSource = ingredient.image || ingredient.icon; // Support both for backward compatibility
            // Display image if available, otherwise show nothing
            const imageMarkup = imageSource ? `<img src="${imageSource}" class="ingredient-image" style="width: 24px; height: 24px; object-fit: cover; border-radius: 4px; margin-right: 8px;" alt="">` : '';
            const nameHTML = imageMarkup
                ? `${imageMarkup}<span class="ingredient-name-text">${ingredient.name}</span>`
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
    form.addEventListener('reset', () => {
        selectedImageDataUrl = '';
        updateImagePreview('');
        if (imageInput) {
            imageInput.value = '';
        }
    });
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

// Image upload event listeners
if (imageUploadBtn && imageInput) {
    imageUploadBtn.addEventListener('click', () => {
        imageInput.click();
    });
}

if (imageInput) {
    imageInput.addEventListener('change', handleImageUpload);
}

if (imageRemoveBtn) {
    imageRemoveBtn.addEventListener('click', removeImage);
}

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