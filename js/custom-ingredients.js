import { version } from './version.js';
import { settings, applyDarkMode } from './settings.js';

// Update version in footer
const versionEl = document.getElementById('version');
if (versionEl) versionEl.textContent = version;

// Custom ingredients data structure
let customIngredients = [];
let editingIngredientId = null;
let lastScrapedIngredientData = null;

function sanitizeEmojiInput(value) {
    const trimmed = (value || '').trim();
    if (!trimmed) {
        return '';
    }
    const chars = Array.from(trimmed);
    return chars.slice(0, 2).join('');
}

let emojiPickerInstance = null;
let emojiPickerReady = false;
let emojiPickerInitializationFailed = false;

function getEmojiPickerTheme() {
    return settings?.darkMode ? 'dark' : 'light';
}

function disableEmojiPickerToggle(message) {
    if (!emojiPickerToggle) return;
    emojiPickerToggle.disabled = true;
    emojiPickerToggle.setAttribute('aria-disabled', 'true');
    if (message) {
        emojiPickerToggle.title = message;
    }
}

function ensureEmojiPicker() {
    if (emojiPickerReady && emojiPickerInstance) {
        if (typeof emojiPickerInstance.setTheme === 'function') {
            emojiPickerInstance.setTheme(getEmojiPickerTheme());
        }
        return true;
    }

    if (emojiPickerInitializationFailed) {
        return false;
    }

    if (typeof window === 'undefined' || typeof window.EmojiButton !== 'function') {
        console.warn('Emoji picker library is unavailable.');
        emojiPickerInitializationFailed = true;
        disableEmojiPickerToggle('Emoji picker failed to load.');
        return false;
    }

    try {
        emojiPickerInstance = new window.EmojiButton({
            autoHide: true,
            position: 'bottom-start',
            showPreview: false,
            showSearch: true,
            theme: getEmojiPickerTheme(),
            zIndex: 1300
        });

        emojiPickerInstance.on('emoji', (selection) => {
            applyEmojiSelection(selection);
        });

        emojiPickerReady = true;
        return true;
    } catch (error) {
        console.warn('Failed to initialize emoji picker:', error);
        emojiPickerInitializationFailed = true;
        disableEmojiPickerToggle('Emoji picker failed to initialize.');
        return false;
    }
}

function openEmojiPicker(anchor = emojiPickerToggle || emojiInput) {
    if (!ensureEmojiPicker() || !emojiPickerInstance || !anchor) {
        return;
    }
    emojiPickerInstance.showPicker(anchor);
}

function closeEmojiPicker() {
    if (!emojiPickerInstance) return;
    emojiPickerInstance.hidePicker();
}

function toggleEmojiPicker(anchor = emojiPickerToggle || emojiInput) {
    if (!ensureEmojiPicker() || !emojiPickerInstance || !anchor) {
        return;
    }
    emojiPickerInstance.togglePicker(anchor);
}

function applyEmojiSelection(selection) {
    if (!emojiInput) return;
    const value = typeof selection === 'string'
        ? selection
        : selection?.emoji || selection?.unicode || '';
    emojiInput.value = sanitizeEmojiInput(value);
    emojiInput.focus();
    closeEmojiPicker();
}

// DOM Elements
const form = document.getElementById('custom-ingredient-form');
const ingredientsList = document.getElementById('custom-ingredients-list');
const searchInput = document.getElementById('ingredient-search');
const emojiInput = document.getElementById('ingredient-emoji');
const emojiPickerToggle = document.getElementById('emoji-picker-toggle');

if (emojiPickerToggle) {
    ensureEmojiPicker();
}
const addIngredientBtn = document.getElementById('add-ingredient-btn');
const ingredientModal = document.getElementById('ingredient-modal');
const cancelIngredientBtn = document.getElementById('cancel-ingredient');
const closeModalBtn = ingredientModal.querySelector('.close');

const scrapeIngredientBtn = document.getElementById('scrape-ingredient-btn');
const scrapeModal = document.getElementById('scrape-ingredient-modal');
const scrapeCloseBtn = scrapeModal ? scrapeModal.querySelector('.scrape-close') : null;
const scrapeForm = document.getElementById('scrape-ingredient-form');
const scrapeUrlInput = document.getElementById('scrape-url');
const scrapeProgress = document.getElementById('scrape-progress');
const scrapeError = document.getElementById('scrape-error');
const scrapeResults = document.getElementById('scrape-results');
const scrapeTitle = document.getElementById('scrape-title');
const scrapeDescription = document.getElementById('scrape-description');
const scrapeNutritionSection = document.getElementById('scrape-nutrition-section');
const scrapeIngredientsSection = document.getElementById('scrape-ingredients-section');
const scrapeIngredientList = document.getElementById('scrape-ingredient-list');
const scrapePrefillBtn = document.getElementById('scrape-prefill-btn');
const scrapeCalories = document.getElementById('scrape-calories');
const scrapeFat = document.getElementById('scrape-fat');
const scrapeCarbs = document.getElementById('scrape-carbs');
const scrapeProtein = document.getElementById('scrape-protein');
const scrapeServingSize = document.getElementById('scrape-serving-size');
const cancelScrapeBtn = document.getElementById('cancel-scrape');

// Load custom ingredients from localStorage
function loadCustomIngredients() {
    try {
        console.log('Loading custom ingredients...');
        const savedIngredients = localStorage.getItem('meale-custom-ingredients');
        if (savedIngredients) {
            customIngredients = JSON.parse(savedIngredients).map(ingredient => ({
                ...ingredient,
                storeSection: ingredient.storeSection || '',
                emoji: sanitizeEmojiInput(ingredient.emoji)
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
            emojiInput.value = sanitizeEmojiInput(ingredient.emoji);
        }
    } else {
        if (storeSectionInput) {
            storeSectionInput.value = '';
        }
        if (emojiInput) {
            emojiInput.value = '';
        }
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
}

// Add or update custom ingredient
function saveCustomIngredient(event) {
    try {
        event.preventDefault();
        console.log('Saving custom ingredient...');
        
        const storeSectionInput = document.getElementById('store-section');
        const normalizedEmoji = emojiInput ? sanitizeEmojiInput(emojiInput.value) : '';
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

if (scrapeModal && scrapeIngredientBtn && scrapeForm) {
    const normalizeUrl = (value) => {
        if (typeof value !== 'string') return '';
        const trimmed = value.trim();
        if (!trimmed) return '';
        if (!/^https?:\/\//i.test(trimmed)) {
            return `https://${trimmed}`;
        }
        return trimmed;
    };

    const extractNumber = (value) => {
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
        }
        if (typeof value === 'string') {
            const normalized = value.replace(',', '.');
            const match = normalized.match(/-?\d+(\.\d+)?/);
            if (match) {
                const parsed = parseFloat(match[0]);
                return Number.isFinite(parsed) ? parsed : null;
            }
        }
        return null;
    };

    const parseServingSize = (value) => {
        if (!value) return null;
        if (typeof value === 'number') {
            return Number.isFinite(value) ? value : null;
        }
        const numeric = extractNumber(value);
        if (numeric === null) return null;
        const lower = value.toLowerCase();
        if (lower.includes('mg')) return numeric / 1000;
        if (lower.includes('kg')) return numeric * 1000;
        if (lower.includes('ounce') || lower.includes('oz')) return numeric * 28.3495;
        if (lower.includes('lb') || lower.includes('pound')) return numeric * 453.592;
        if (lower.includes('ml')) return numeric;
        return numeric;
    };

    const normalizeStringArray = (value) => {
        if (!value) return [];
        const array = Array.isArray(value) ? value : [value];
        const cleaned = array
            .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
            .filter(Boolean);
        return [...new Set(cleaned)];
    };

    const parseNutritionInfo = (raw) => {
        if (!raw || typeof raw !== 'object') return {};

        const valueFromKeys = (...keys) => {
            for (const key of keys) {
                const candidate = raw[key];
                if (candidate == null) continue;
                const numeric = extractNumber(candidate);
                if (numeric !== null) return numeric;
            }
            return null;
        };

        const nutrition = {};
        const calories = valueFromKeys('calories', 'calorieContent', 'energy', 'energyContent');
        const fat = valueFromKeys('fatContent', 'fat');
        const carbs = valueFromKeys('carbohydrateContent', 'carbs', 'carbohydrates');
        const protein = valueFromKeys('proteinContent', 'protein');

        if (calories !== null) nutrition.calories = calories;
        if (fat !== null) nutrition.fat = fat;
        if (carbs !== null) nutrition.carbs = carbs;
        if (protein !== null) nutrition.protein = protein;

        const servingSize = raw.servingSize || raw.serving_size || raw.servingSizeDescription;
        if (servingSize) {
            nutrition.servingSize = typeof servingSize === 'string' ? servingSize.trim() : servingSize;
            const servingValue = parseServingSize(servingSize);
            if (servingValue !== null) {
                nutrition.servingSizeValue = servingValue;
            }
        }

        return nutrition;
    };

    const flattenJsonLd = (entry) => {
        if (!entry) return [];
        if (Array.isArray(entry)) {
            return entry.flatMap(flattenJsonLd);
        }
        if (typeof entry === 'object') {
            if (entry['@graph']) {
                return flattenJsonLd(entry['@graph']);
            }
            return [entry];
        }
        return [];
    };

    const safeParseJsonLd = (text) => {
        if (!text) return null;
        const cleaned = text.trim().replace(/^\s*<!--/, '').replace(/-->\s*$/, '');
        if (!cleaned) return null;
        try {
            return JSON.parse(cleaned);
        } catch (error) {
            try {
                const normalized = cleaned.replace(/}\s*{\s*/g, '},{');
                return JSON.parse(`[${normalized}]`);
            } catch (nestedError) {
                console.warn('Unable to parse JSON-LD snippet', nestedError);
                return null;
            }
        }
    };

    const parseJsonLdItems = (doc) => {
        const scripts = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));
        const items = [];
        scripts.forEach((script) => {
            const parsed = safeParseJsonLd(script.textContent || script.innerText || '');
            if (!parsed) return;
            items.push(...flattenJsonLd(parsed));
        });
        return items;
    };

    const buildResultFromSchema = (schema) => {
        if (!schema || typeof schema !== 'object') return null;
        const types = schema['@type'];
        const typeList = Array.isArray(types) ? types : (types ? [types] : []);
        const normalizedTypes = typeList.map((type) => (typeof type === 'string' ? type.toLowerCase() : '')).filter(Boolean);

        const isRelevantType = normalizedTypes.some((type) =>
            ['recipe', 'product', 'food', 'menuitem'].includes(type)
        );

        if (!isRelevantType) {
            return null;
        }

        const ingredients = normalizeStringArray(
            schema.recipeIngredient || schema.ingredients || schema.ingredient || schema.hasIngredient
        );

        const nutrition = parseNutritionInfo(
            schema.nutrition || schema.nutritionalInformation || schema.nutritionFacts
        );

        const name = schema.name || schema.headline || schema.alternateName || '';
        const description = schema.description || schema.summary || '';

        if (
            !name &&
            ingredients.length === 0 &&
            (!nutrition.calories && !nutrition.fat && !nutrition.carbs && !nutrition.protein)
        ) {
            return null;
        }

        const result = {
            name: name ? String(name).trim() : '',
            description: description ? String(description).trim() : '',
            ingredients,
            nutrition
        };

        if (!result.nutrition.servingSize && schema.recipeYield) {
            const servingText = Array.isArray(schema.recipeYield) ? schema.recipeYield[0] : schema.recipeYield;
            if (servingText) {
                result.nutrition.servingSize = String(servingText).trim();
                const servingValue = parseServingSize(result.nutrition.servingSize);
                if (servingValue !== null) {
                    result.nutrition.servingSizeValue = servingValue;
                }
            }
        }

        return result;
    };

    const fallbackFromDom = (doc) => {
        if (!doc) return null;
        const name =
            doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
            doc.querySelector('title')?.textContent ||
            doc.querySelector('h1')?.textContent ||
            '';

        const description =
            doc.querySelector('meta[name="description"]')?.getAttribute('content') ||
            doc.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
            '';

        const ingredientCandidates = new Set();

        const candidateSelectors = [
            '[itemprop="recipeIngredient"]',
            '.ingredient',
            '.ingredients',
            '[class*="ingredient"]',
            '[id*="ingredient"]'
        ];

        candidateSelectors.forEach((selector) => {
            doc.querySelectorAll(selector).forEach((node) => {
                if (!node) return;
                const elements =
                    node.tagName === 'LI' || node.tagName === 'P'
                        ? [node]
                        : Array.from(node.querySelectorAll('li, p'));
                elements.forEach((element) => {
                    const text = element.textContent ? element.textContent.trim() : '';
                    if (!text) return;
                    if (text.length > 2 && text.length < 160) {
                        ingredientCandidates.add(text);
                    }
                });
            });
        });

        const ingredients = [...ingredientCandidates];
        if (ingredients.length === 0) {
            return null;
        }

        return {
            name: name ? name.trim() : '',
            description: description ? description.trim() : '',
            ingredients,
            nutrition: {}
        };
    };

    const parseIngredientData = (html) => {
        if (!html) return null;
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            const schemas = parseJsonLdItems(doc);
            for (const schema of schemas) {
                const result = buildResultFromSchema(schema);
                if (result) {
                    return result;
                }
            }

            return fallbackFromDom(doc);
        } catch (error) {
            console.error('Failed to parse scraped ingredient data:', error);
            return null;
        }
    };

    const fetchPageHtml = async (url) => {
        let lastError = null;
        try {
            const directResponse = await fetch(url, { mode: 'cors' });
            if (directResponse.ok) {
                return await directResponse.text();
            }
            lastError = new Error(`Request failed with status ${directResponse.status}`);
        } catch (error) {
            lastError = error;
        }

        try {
            const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
            const proxyResponse = await fetch(proxyUrl);
            if (!proxyResponse.ok) {
                throw new Error(`Proxy request failed with status ${proxyResponse.status}`);
            }
            return await proxyResponse.text();
        } catch (proxyError) {
            console.error('Unable to fetch ingredient page via proxy:', proxyError);
            throw lastError || proxyError;
        }
    };

    const resetScrapeModalState = () => {
        lastScrapedIngredientData = null;
        if (scrapeForm) {
            scrapeForm.reset();
        }
        if (scrapeProgress) {
            scrapeProgress.hidden = true;
        }
        if (scrapeError) {
            scrapeError.hidden = true;
            scrapeError.textContent = '';
        }
        if (scrapeResults) {
            scrapeResults.hidden = true;
        }
        if (scrapePrefillBtn) {
            scrapePrefillBtn.disabled = true;
        }
    };

    const setScrapeLoading = (isLoading) => {
        if (scrapeProgress) {
            scrapeProgress.hidden = !isLoading;
        }
        if (scrapeForm) {
            Array.from(scrapeForm.elements).forEach((element) => {
                if (!(element instanceof HTMLButtonElement) || element.id !== 'cancel-scrape') {
                    element.disabled = isLoading;
                }
            });
        }
        if (scrapePrefillBtn) {
            scrapePrefillBtn.disabled = isLoading || !lastScrapedIngredientData;
        }
        if (scrapeError && isLoading) {
            scrapeError.hidden = true;
            scrapeError.textContent = '';
        }
    };

    const openScrapeModal = () => {
        resetScrapeModalState();
        scrapeModal.style.display = 'block';
        scrapeModal.classList.add('active');
        if (scrapeUrlInput) {
            scrapeUrlInput.focus();
        }
    };

    const closeScrapeModal = () => {
        scrapeModal.style.display = 'none';
        scrapeModal.classList.remove('active');
        setScrapeLoading(false);
    };

    const showScrapeError = (message) => {
        if (scrapeError) {
            scrapeError.textContent = message;
            scrapeError.hidden = false;
        }
        if (scrapeResults) {
            scrapeResults.hidden = true;
        }
    };

    const formatUnitValue = (value, unit) => {
        if (value == null || Number.isNaN(value)) {
            return '—';
        }
        const rounded = Math.round(value * 10) / 10;
        return unit ? `${rounded}${unit}` : String(rounded);
    };

    const showScrapeResults = (data) => {
        if (!data || !scrapeResults) return;

        const hasIngredients = Array.isArray(data.ingredients) && data.ingredients.length > 0;
        const nutrition = data.nutrition || {};
        const hasNutrition =
            nutrition.calories != null ||
            nutrition.fat != null ||
            nutrition.carbs != null ||
            nutrition.protein != null ||
            nutrition.servingSize;

        if (scrapeTitle) {
            scrapeTitle.textContent = data.name || 'Ingredient Details';
        }

        if (scrapeDescription) {
            if (data.description) {
                scrapeDescription.textContent = data.description;
                scrapeDescription.style.display = 'block';
            } else {
                scrapeDescription.textContent = '';
                scrapeDescription.style.display = 'none';
            }
        }

        if (scrapeIngredientsSection) {
            scrapeIngredientsSection.hidden = !hasIngredients;
            if (hasIngredients && scrapeIngredientList) {
                scrapeIngredientList.innerHTML = '';
                data.ingredients.forEach((ingredient) => {
                    const li = document.createElement('li');
                    li.textContent = ingredient;
                    scrapeIngredientList.appendChild(li);
                });
            } else if (scrapeIngredientList) {
                scrapeIngredientList.innerHTML = '';
            }
        }

        if (scrapeNutritionSection) {
            scrapeNutritionSection.hidden = !hasNutrition;
            if (hasNutrition) {
                if (scrapeCalories) {
                    scrapeCalories.textContent =
                        nutrition.calories != null ? formatUnitValue(nutrition.calories, ' kcal') : '—';
                }
                if (scrapeFat) {
                    scrapeFat.textContent =
                        nutrition.fat != null ? formatUnitValue(nutrition.fat, ' g') : '—';
                }
                if (scrapeCarbs) {
                    scrapeCarbs.textContent =
                        nutrition.carbs != null ? formatUnitValue(nutrition.carbs, ' g') : '—';
                }
                if (scrapeProtein) {
                    scrapeProtein.textContent =
                        nutrition.protein != null ? formatUnitValue(nutrition.protein, ' g') : '—';
                }
                if (scrapeServingSize) {
                    if (nutrition.servingSize) {
                        scrapeServingSize.textContent = String(nutrition.servingSize);
                    } else if (nutrition.servingSizeValue != null) {
                        scrapeServingSize.textContent = `${formatUnitValue(nutrition.servingSizeValue, ' g')}`;
                    } else {
                        scrapeServingSize.textContent = '—';
                    }
                }
            }
        }

        scrapeResults.hidden = false;
        if (scrapePrefillBtn) {
            const canPrefill =
                Boolean(data.name) ||
                nutrition.calories != null ||
                nutrition.fat != null ||
                nutrition.carbs != null ||
                nutrition.protein != null ||
                nutrition.servingSizeValue != null;
            scrapePrefillBtn.disabled = !canPrefill;
        }
    };

    const prefillIngredientFormFromScrape = () => {
        if (!lastScrapedIngredientData) return;

        const data = lastScrapedIngredientData;
        closeScrapeModal();
        openIngredientModal();

        const nameInput = document.getElementById('ingredient-name');
        const caloriesInput = document.getElementById('calories');
        const fatInput = document.getElementById('fat');
        const carbsInput = document.getElementById('carbs');
        const proteinInput = document.getElementById('protein');
        const servingSizeInput = document.getElementById('serving-size');

        if (nameInput && data.name) {
            nameInput.value = data.name;
        }

        if (caloriesInput && data.nutrition?.calories != null) {
            caloriesInput.value = Math.round(data.nutrition.calories);
        }

        if (fatInput && data.nutrition?.fat != null) {
            fatInput.value = Math.round(data.nutrition.fat * 10) / 10;
        }

        if (carbsInput && data.nutrition?.carbs != null) {
            carbsInput.value = Math.round(data.nutrition.carbs * 10) / 10;
        }

        if (proteinInput && data.nutrition?.protein != null) {
            proteinInput.value = Math.round(data.nutrition.protein * 10) / 10;
        }

        if (servingSizeInput) {
            const servingValue =
                data.nutrition?.servingSizeValue != null
                    ? data.nutrition.servingSizeValue
                    : parseServingSize(data.nutrition?.servingSize);
            if (servingValue != null) {
                servingSizeInput.value = Math.round(servingValue);
            }
        }
    };

    const handleScrapeSubmit = async (event) => {
        event.preventDefault();
        if (!scrapeUrlInput) return;

        const normalizedUrl = normalizeUrl(scrapeUrlInput.value);
        if (!normalizedUrl) {
            showScrapeError('Please enter a valid URL.');
            return;
        }

        console.log('Fetching ingredient data from:', normalizedUrl);
        setScrapeLoading(true);

        try {
            const html = await fetchPageHtml(normalizedUrl);
            const parsedData = parseIngredientData(html);
            if (!parsedData) {
                throw new Error('We could not locate ingredient data on that page.');
            }

            lastScrapedIngredientData = parsedData;
            showScrapeResults(parsedData);
        } catch (error) {
            console.error('Ingredient scraping failed:', error);
            let message =
                error?.message ||
                'Unable to fetch ingredient information. Please try again or use a different URL.';
            if (typeof message === 'string' && message.toLowerCase().includes('failed to fetch')) {
                message = 'We could not reach that page. Some sites block scraping—try another URL or add the ingredients manually.';
            }
            showScrapeError(message);
        } finally {
            setScrapeLoading(false);
        }
    };

    scrapeIngredientBtn.addEventListener('click', (event) => {
        event.preventDefault();
        openScrapeModal();
    });

    if (scrapeCloseBtn) {
        scrapeCloseBtn.addEventListener('click', () => closeScrapeModal());
    }

    if (cancelScrapeBtn) {
        cancelScrapeBtn.addEventListener('click', () => closeScrapeModal());
    }

    scrapeForm.addEventListener('submit', handleScrapeSubmit);

    if (scrapePrefillBtn) {
        scrapePrefillBtn.addEventListener('click', () => prefillIngredientFormFromScrape());
    }

    window.addEventListener('click', (event) => {
        if (event.target === scrapeModal) {
            closeScrapeModal();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && scrapeModal.classList.contains('active')) {
            closeScrapeModal();
        }
    });
}

// Event Listeners
form.addEventListener('submit', saveCustomIngredient);
form.addEventListener('reset', closeEmojiPicker);
searchInput.addEventListener('input', searchIngredients);
addIngredientBtn.addEventListener('click', () => openIngredientModal());
cancelIngredientBtn.addEventListener('click', closeIngredientModal);
closeModalBtn.addEventListener('click', closeIngredientModal);

if (emojiInput) {
    emojiInput.addEventListener('focus', () => openEmojiPicker(emojiInput));
    emojiInput.addEventListener('click', () => openEmojiPicker(emojiInput));
    emojiInput.addEventListener('input', () => {
        const sanitized = sanitizeEmojiInput(emojiInput.value);
        if (emojiInput.value !== sanitized) {
            emojiInput.value = sanitized;
        }
    });
}

if (emojiPickerToggle) {
    emojiPickerToggle.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleEmojiPicker(emojiPickerToggle);
    });
}

// The EmojiButton instance manages its own overlay and closing behaviour.

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