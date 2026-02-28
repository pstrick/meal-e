import { version } from './version.js';
import { settings, applyDarkMode } from './settings.js';

// Update version in footer
const versionEl = document.getElementById('version');
if (versionEl) versionEl.textContent = version;

// Custom ingredients data structure
let customIngredients = [];
let editingIngredientId = null;
let selectedImageDataUrl = '';
let shoppingListReturnContext = null;

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
const ingredientSourceUrlInput = document.getElementById('ingredient-source-url');
const fetchWegmansUrlBtn = document.getElementById('fetch-wegmans-url-btn');
const wegmansFetchProgress = document.getElementById('wegmans-fetch-progress');
const wegmansFetchError = document.getElementById('wegmans-fetch-error');
const addIngredientBtn = document.getElementById('add-ingredient-btn');
const ingredientModal = document.getElementById('ingredient-modal');
const cancelIngredientBtn = document.getElementById('cancel-ingredient');
const closeModalBtn = ingredientModal.querySelector('.close');

// Filter/sort state
let searchTerm = '';
let filterStoreSection = '';
let sortColumn = 'name';
let sortDirection = 'asc';

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
const storeSectionFilterEl = document.getElementById('ingredient-store-section-filter');

function getDefaultWegmansStoreNumber() {
    const fallback = 24;
    const storeNumberFromGlobal = Number.parseInt(String(window.settings?.defaultWegmansStoreNumber ?? ''), 10);
    if (Number.isInteger(storeNumberFromGlobal) && storeNumberFromGlobal > 0) {
        return storeNumberFromGlobal;
    }

    try {
        const rawSettings = localStorage.getItem('meale-settings');
        if (!rawSettings) {
            return fallback;
        }
        const parsedSettings = JSON.parse(rawSettings);
        const parsedStoreNumber = Number.parseInt(String(parsedSettings?.defaultWegmansStoreNumber ?? ''), 10);
        return Number.isInteger(parsedStoreNumber) && parsedStoreNumber > 0 ? parsedStoreNumber : fallback;
    } catch (error) {
        console.warn('Unable to load default Wegmans store number from settings:', error);
        return fallback;
    }
}

function showWegmansFetchError(message) {
    if (!wegmansFetchError) return;
    wegmansFetchError.textContent = message;
    wegmansFetchError.hidden = false;
}

function clearWegmansFetchMessages() {
    if (wegmansFetchError) {
        wegmansFetchError.textContent = '';
        wegmansFetchError.hidden = true;
    }
    if (wegmansFetchProgress) {
        wegmansFetchProgress.hidden = true;
    }
}

function setWegmansFetchLoading(isLoading) {
    if (wegmansFetchProgress) {
        wegmansFetchProgress.hidden = !isLoading;
    }
    if (fetchWegmansUrlBtn) {
        fetchWegmansUrlBtn.disabled = isLoading;
    }
}

function getWegmansProductIdFromUrl(rawUrl) {
    try {
        const parsedUrl = new URL(rawUrl);
        if (!parsedUrl.hostname.toLowerCase().includes('wegmans.com')) {
            return null;
        }
        const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
        const productIndex = pathSegments.findIndex(segment => segment === 'product');
        if (productIndex === -1 || !pathSegments[productIndex + 1]) {
            return null;
        }
        const slug = pathSegments[productIndex + 1];
        const candidateId = slug.split('-')[0];
        return /^\d+$/.test(candidateId) ? candidateId : null;
    } catch (error) {
        return null;
    }
}

function convertWeightToGrams(value, rawUnit) {
    const amount = Number.parseFloat(String(value));
    if (!Number.isFinite(amount) || amount <= 0) return null;
    const unit = String(rawUnit || '').trim().toLowerCase();
    if (!unit || unit === 'g' || unit === 'gram' || unit === 'grams') return amount;
    if (unit === 'kg' || unit === 'kilogram' || unit === 'kilograms') return amount * 1000;
    if (unit === 'oz' || unit === 'ounce' || unit === 'ounces') return amount * 28.3495;
    if (unit === 'lb' || unit === 'lbs' || unit === 'pound' || unit === 'pounds') return amount * 453.592;
    return null;
}

function parseWeightStringToGrams(rawWeightString) {
    const text = String(rawWeightString || '').trim().toLowerCase();
    if (!text) return null;
    const match = text.match(/(\d+(?:\.\d+)?)\s*(kg|kilograms?|g|grams?|oz|ounces?|lb|lbs|pounds?)/i);
    if (!match) return null;
    return convertWeightToGrams(match[1], match[2]);
}

function extractWegmansNutrition(nutrition) {
    const defaults = { calories: null, fat: null, carbs: null, protein: null };
    if (!nutrition || !Array.isArray(nutrition.nutritions)) {
        return defaults;
    }

    const itemByName = new Map();
    nutrition.nutritions.forEach(group => {
        const generalItems = Array.isArray(group?.general) ? group.general : [];
        generalItems.forEach(item => {
            const normalizedName = String(item?.name || '').trim().toLowerCase();
            if (!normalizedName || itemByName.has(normalizedName)) return;
            itemByName.set(normalizedName, item?.quantity);
        });
    });

    const calories = Number.parseFloat(String(itemByName.get('calories')));
    const fat = Number.parseFloat(String(itemByName.get('total fat')));
    const carbs = Number.parseFloat(String(itemByName.get('total carbohydrate')));
    const protein = Number.parseFloat(String(itemByName.get('protein')));

    return {
        calories: Number.isFinite(calories) ? calories : null,
        fat: Number.isFinite(fat) ? fat : null,
        carbs: Number.isFinite(carbs) ? carbs : null,
        protein: Number.isFinite(protein) ? protein : null
    };
}

function extractWegmansServingSizeGrams(nutrition) {
    const serving = nutrition?.serving;
    if (!serving) return null;
    return convertWeightToGrams(serving.servingSize, serving.servingSizeUom);
}

function extractWegmansTotalWeightGrams(product) {
    const fromPackSize = parseWeightStringToGrams(product?.packSize);
    if (Number.isFinite(fromPackSize) && fromPackSize > 0) {
        return fromPackSize;
    }
    return null;
}

function extractWegmansTotalPrice(product) {
    const deliveryAmount = Number.parseFloat(String(product?.price_delivery?.amount));
    if (Number.isFinite(deliveryAmount) && deliveryAmount >= 0) {
        return deliveryAmount;
    }
    const inStoreAmount = Number.parseFloat(String(product?.price_instore?.amount ?? product?.price_inStore?.amount));
    if (Number.isFinite(inStoreAmount) && inStoreAmount >= 0) {
        return inStoreAmount;
    }
    return null;
}

function extractWegmansStoreSection(product) {
    const categoryNames = Array.isArray(product?.category)
        ? product.category.map(entry => String(entry?.name || '').trim()).filter(Boolean)
        : [];
    const categoryLabel = categoryNames.length > 0 ? categoryNames[categoryNames.length - 1] : '';

    const aisleLocation = String(product?.planogram?.aisle || product?.aisle?.locationName || '').trim();
    const planogramSection = String(product?.planogram?.section || '').trim();
    const shelf = String(product?.planogram?.shelf || '').trim();

    const locationParts = [];
    if (aisleLocation) locationParts.push(`Aisle ${aisleLocation}`);
    if (planogramSection) locationParts.push(`Section ${planogramSection}`);
    if (shelf) locationParts.push(`Shelf ${shelf}`);

    if (categoryLabel && locationParts.length > 0) {
        return `${categoryLabel} (${locationParts.join(', ')})`;
    }
    if (categoryLabel) return categoryLabel;
    if (locationParts.length > 0) return locationParts.join(', ');
    return '';
}

function applyWegmansProductToForm(product, sourceUrl) {
    const name = String(product?.productName || '').trim();
    const images = Array.isArray(product?.images) ? product.images : [];
    const imageUrl = typeof images[0] === 'string' ? images[0].trim() : '';
    const totalPrice = extractWegmansTotalPrice(product);
    const totalWeight = extractWegmansTotalWeightGrams(product);
    const servingSize = extractWegmansServingSizeGrams(product?.nutrition);
    const nutrition = extractWegmansNutrition(product?.nutrition);
    const storeInput = document.getElementById('store');
    const storeSectionInput = document.getElementById('store-section');
    const storeSection = extractWegmansStoreSection(product);

    if (name) document.getElementById('ingredient-name').value = name;
    if (Number.isFinite(totalPrice)) document.getElementById('total-price').value = totalPrice.toFixed(2);
    if (Number.isFinite(totalWeight)) document.getElementById('total-weight').value = Math.round(totalWeight);
    if (Number.isFinite(servingSize)) document.getElementById('serving-size').value = Math.round(servingSize);
    if (Number.isFinite(nutrition.calories)) document.getElementById('calories').value = Math.round(nutrition.calories);
    if (Number.isFinite(nutrition.fat)) document.getElementById('fat').value = nutrition.fat;
    if (Number.isFinite(nutrition.carbs)) document.getElementById('carbs').value = nutrition.carbs;
    if (Number.isFinite(nutrition.protein)) document.getElementById('protein').value = nutrition.protein;

    if (storeInput && !storeInput.value.trim()) {
        storeInput.value = 'Wegmans';
    }
    if (storeSectionInput && (!storeSectionInput.value.trim() || storeSectionInput.value.trim() === 'Uncategorized') && storeSection) {
        storeSectionInput.value = storeSection;
    }
    if (ingredientSourceUrlInput) {
        ingredientSourceUrlInput.value = sourceUrl;
    }

    if (imageUrl) {
        selectedImageDataUrl = imageUrl;
        updateImagePreview(imageUrl);
    }
}

async function fetchWegmansProductFromUrl() {
    const sourceUrl = String(ingredientSourceUrlInput?.value || '').trim();
    if (!sourceUrl) {
        showWegmansFetchError('Please enter a Wegmans product URL first.');
        return;
    }

    const productId = getWegmansProductIdFromUrl(sourceUrl);
    if (!productId) {
        showWegmansFetchError('Please provide a valid Wegmans product URL.');
        return;
    }

    clearWegmansFetchMessages();
    setWegmansFetchLoading(true);

    try {
        const storeNumber = getDefaultWegmansStoreNumber();
        const response = await fetch(`/api/wegmans-product?productId=${encodeURIComponent(productId)}&storeNumber=${encodeURIComponent(storeNumber)}`);
        let payload = null;
        try {
            payload = await response.json();
        } catch (error) {
            payload = null;
        }

        if (!response.ok || !payload?.success || !payload?.product) {
            throw new Error(payload?.error || 'Unable to fetch product details from Wegmans.');
        }

        applyWegmansProductToForm(payload.product, sourceUrl);
    } catch (error) {
        console.error('Error fetching Wegmans product details:', error);
        showWegmansFetchError(error.message || 'Unable to fetch product details from Wegmans.');
    } finally {
        setWegmansFetchLoading(false);
    }
}

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
                store: ingredient.store || '',
                storeSection: ingredient.storeSection || '',
                    emoji: '',
                    image: imageValue
                };
            });
            console.log('Loaded my ingredients:', customIngredients.length);
        } else {
            console.log('No my ingredients found');
        }
        updateStoreSectionFilterOptions();
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
    const storeInput = document.getElementById('store');
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
        if (storeInput) storeInput.value = ingredient.store || '';
        if (storeSectionInput) storeSectionInput.value = ingredient.storeSection || '';
        if (ingredientSourceUrlInput) ingredientSourceUrlInput.value = ingredient.sourceUrl || '';
        // Load image if available
        const imageValue = typeof ingredient.image === 'string' ? ingredient.image.trim() : '';
        selectedImageDataUrl = imageValue;
        updateImagePreview(imageValue);
    } else {
        if (storeInput) storeInput.value = '';
        if (storeSectionInput) storeSectionInput.value = '';
        if (ingredientSourceUrlInput) ingredientSourceUrlInput.value = '';
        selectedImageDataUrl = '';
        updateImagePreview('');
    }
    clearWegmansFetchMessages();
    
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
    if (ingredientSourceUrlInput) {
        ingredientSourceUrlInput.value = '';
    }
    clearWegmansFetchMessages();
    if (imageInput) {
        imageInput.value = '';
    }
}

// Add or update custom ingredient
async function saveCustomIngredient(event) {
    try {
        event.preventDefault();
        console.log('Saving custom ingredient...');
        
        const storeInput = document.getElementById('store');
        const storeSectionInput = document.getElementById('store-section');
        const existingIngredient = editingIngredientId
            ? customIngredients.find(ing => ing.id === editingIngredientId)
            : null;
        const sourceUrl = String(ingredientSourceUrlInput?.value || '').trim();
        
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
            store: storeInput ? storeInput.value.trim() : '',
            storeSection: storeSectionInput ? storeSectionInput.value.trim() : '',
            sourceUrl,
            source: sourceUrl ? 'wegmans' : (existingIngredient?.source || ''),
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

        const listEl = document.getElementById('custom-ingredients-list');
        if (listEl) {
            updateStoreSectionFilterOptions();
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

        // Return to shopping lists flow when ingredient creation was launched from list quick-add.
        if (shoppingListReturnContext && shoppingListReturnContext.openListId) {
            const openListId = encodeURIComponent(shoppingListReturnContext.openListId);
            const ingredientQuery = encodeURIComponent(ingredient.name || shoppingListReturnContext.ingredientQuery || '');
            window.location.href = `shopping-lists.html?openListId=${openListId}&ingredientQuery=${ingredientQuery}`;
            return;
        }
        
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
        updateStoreSectionFilterOptions();
        renderIngredientsList();
    } catch (error) {
        console.error('Error deleting custom ingredient:', error);
    }
}

// Get filtered ingredients (search + store section)
function getFilteredIngredients() {
    return customIngredients.filter(ingredient => {
        const matchesSearch = !searchTerm || ingredient.name.toLowerCase().includes(searchTerm);
        const section = (ingredient.storeSection || '').trim() || 'Uncategorized';
        const matchesSection = !filterStoreSection || section === filterStoreSection;
        return matchesSearch && matchesSection;
    });
}

// Get sorted copy of ingredients
function getSortedIngredients(ingredients) {
    const arr = [...ingredients];
    arr.sort((a, b) => {
        let va; let vb;
        switch (sortColumn) {
            case 'name':
                va = (a.name || '').toLowerCase();
                vb = (b.name || '').toLowerCase();
                return sortDirection === 'asc' ? (va < vb ? -1 : va > vb ? 1 : 0) : (vb < va ? -1 : vb > va ? 1 : 0);
            case 'store': {
                const sa = (a.store || '').trim();
                const sb = (b.store || '').trim();
                return sortDirection === 'asc' ? sa.localeCompare(sb) : sb.localeCompare(sa);
            }
            case 'storeSection': {
                const sa = (a.storeSection || '').trim() || 'Uncategorized';
                const sb = (b.storeSection || '').trim() || 'Uncategorized';
                return sortDirection === 'asc' ? sa.localeCompare(sb) : sb.localeCompare(sa);
            }
            case 'price': {
                va = (a.totalPrice != null && a.totalWeight != null) ? a.totalPrice / (a.totalWeight || 1) : (a.pricePerGram ?? 0);
                vb = (b.totalPrice != null && b.totalWeight != null) ? b.totalPrice / (b.totalWeight || 1) : (b.pricePerGram ?? 0);
                return sortDirection === 'asc' ? va - vb : vb - va;
            }
            case 'calories': {
                va = (a.nutrition && a.nutrition.calories != null) ? a.nutrition.calories : 0;
                vb = (b.nutrition && b.nutrition.calories != null) ? b.nutrition.calories : 0;
                return sortDirection === 'asc' ? va - vb : vb - va;
            }
            default:
                return 0;
        }
    });
    return arr;
}

function escapeHtmlAttr(str) {
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function getSafeExternalUrl(rawUrl) {
    try {
        const parsed = new URL(rawUrl);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
            return parsed.href;
        }
        return '';
    } catch (error) {
        return '';
    }
}

// Populate store section filter dropdown from current ingredients
function updateStoreSectionFilterOptions() {
    if (!storeSectionFilterEl) return;
    const sections = new Set();
    customIngredients.forEach(ing => {
        const s = (ing.storeSection || '').trim() || 'Uncategorized';
        sections.add(s);
    });
    const sorted = [...sections].sort((a, b) => a.localeCompare(b));
    const current = storeSectionFilterEl.value;
    storeSectionFilterEl.innerHTML = '<option value="">All sections</option>' +
        sorted.map(s => `<option value="${escapeHtmlAttr(s)}">${escapeHtmlAttr(s)}</option>`).join('');
    if (sorted.includes(current)) {
        storeSectionFilterEl.value = current;
    } else {
        filterStoreSection = '';
        storeSectionFilterEl.value = '';
    }
}

// Update sort icons and aria-sort in table header
function updateSortIcons() {
    if (!ingredientsList) return;
    ingredientsList.querySelectorAll('th.sortable').forEach(th => {
        const key = th.dataset.sort;
        const icon = th.querySelector('.sort-icon');
        if (!icon) return;
        if (key !== sortColumn) {
            icon.textContent = '';
            icon.className = 'sort-icon';
            th.removeAttribute('aria-sort');
            return;
        }
        icon.className = 'sort-icon sort-active';
        icon.textContent = sortDirection === 'asc' ? '\u25B2' : '\u25BC';
        th.setAttribute('aria-sort', sortDirection === 'asc' ? 'ascending' : 'descending');
    });
}

// Render ingredients list (uses filter + sort state)
function renderIngredientsList() {
    try {
        const filtered = getFilteredIngredients();
        const ingredients = getSortedIngredients(filtered);
        const tbody = ingredientsList.querySelector('tbody');
        tbody.innerHTML = '';

        updateSortIcons();

        if (ingredients.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="no-items">No ingredients found</td>
                </tr>`;
            return;
        }

        ingredients.forEach(ingredient => {
            const row = document.createElement('tr');
            const imageSource = ingredient.image || ingredient.icon;
            const imageMarkup = imageSource
                ? `<img src="${imageSource}" class="ingredient-image" alt="${ingredient.name}" title="${ingredient.name}">`
                : '<span class="no-image">—</span>';
            const safeSourceUrl = getSafeExternalUrl(ingredient.sourceUrl || '');
            const safeIngredientName = escapeHtmlAttr(ingredient.name || '');
            const nameHTML = safeSourceUrl
                ? `<a class="ingredient-name-text ingredient-source-link" href="${escapeHtmlAttr(safeSourceUrl)}" target="_blank" rel="noopener noreferrer">${safeIngredientName}</a>`
                : `<span class="ingredient-name-text">${safeIngredientName}</span>`;

            const servingSize = ingredient.servingSize || 100;
            let priceDisplay = 'N/A';
            if (ingredient.totalPrice !== null && ingredient.totalPrice !== undefined &&
                ingredient.totalWeight !== null && ingredient.totalWeight !== undefined) {
                priceDisplay = `$${ingredient.totalPrice.toFixed(2)} (${ingredient.totalWeight}g)`;
            } else if (ingredient.pricePerGram !== null && ingredient.pricePerGram !== undefined) {
                const estimatedPrice = ingredient.pricePerGram * 100;
                priceDisplay = `~$${estimatedPrice.toFixed(2)}/100g`;
            }

            const nutrition = ingredient.nutrition || { calories: 0, fat: 0, carbs: 0, protein: 0 };
            const caloriesPerServing = Math.round(nutrition.calories || 0);
            const fatPerServing = (nutrition.fat || 0).toFixed(1);
            const carbsPerServing = (nutrition.carbs || 0).toFixed(1);
            const proteinPerServing = (nutrition.protein || 0).toFixed(1);

            let sourceBadge = '';
            if (ingredient.source === 'usda' || ingredient.source === 'openfoodfacts' || ingredient.source === 'wegmans') {
                const sourceLabel = ingredient.source === 'usda' ? 'USDA' : (ingredient.source === 'openfoodfacts' ? 'OFF' : 'Wegmans');
                sourceBadge = `<span class="source-badge" title="Imported from ${sourceLabel}">${sourceLabel}</span>`;
            }

            row.innerHTML = `
                <td class="ingredient-image-cell">${imageMarkup}</td>
                <td class="ingredient-name-cell">${nameHTML} ${sourceBadge}</td>
                <td>${ingredient.store || '—'}</td>
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
function onSearchInput(event) {
    searchTerm = (event.target.value || '').toLowerCase();
    renderIngredientsList();
}

// Store section filter change
function onStoreSectionFilterChange(event) {
    filterStoreSection = (event.target.value || '').trim();
    renderIngredientsList();
}

// Sort by column
function onSortHeaderClick(event) {
    const th = event.target.closest('th.sortable');
    if (!th || !th.dataset.sort) return;
    const key = th.dataset.sort;
    if (sortColumn === key) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortColumn = key;
        sortDirection = 'asc';
    }
    renderIngredientsList();
}

// CSV Upload/Download Functionality

// CSV Template Download Function (must be defined outside conditional)
function downloadCsvTemplate() {
    const headers = [
        'name',
        'emoji',
        'store',
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
        'Whole Foods',
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
        '# emoji, store, and storeSection are optional'
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
                            store: getValue('store', '').trim(),
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
                updateStoreSectionFilterOptions();
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
    searchInput.addEventListener('input', onSearchInput);
}
if (storeSectionFilterEl) {
    storeSectionFilterEl.addEventListener('change', onStoreSectionFilterChange);
}
const sortableHeaders = ingredientsList ? ingredientsList.querySelectorAll('th.sortable') : [];
sortableHeaders.forEach(th => {
    th.addEventListener('click', onSortHeaderClick);
});
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

if (fetchWegmansUrlBtn) {
    fetchWegmansUrlBtn.addEventListener('click', fetchWegmansProductFromUrl);
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
    if (params.get('returnTo') === 'shopping-lists') {
        shoppingListReturnContext = {
            openListId: params.get('openListId') || '',
            ingredientQuery: params.get('ingredientQuery') || ''
        };
    }
    if (params.get('openIngredientModal') === '1') {
        openIngredientModal();
    }
} catch (error) {
    console.error('Error checking URL parameters for openIngredientModal:', error);
}