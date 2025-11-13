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

const FOOD_EMOJIS = [
    { emoji: '🍎', label: 'Red Apple', keywords: ['apple', 'fruit', 'produce'] },
    { emoji: '🍏', label: 'Green Apple', keywords: ['apple', 'fruit', 'produce'] },
    { emoji: '🍌', label: 'Banana', keywords: ['banana', 'fruit', 'produce'] },
    { emoji: '🍓', label: 'Strawberry', keywords: ['strawberry', 'berries'] },
    { emoji: '🍇', label: 'Grapes', keywords: ['grapes', 'fruit'] },
    { emoji: '🍉', label: 'Watermelon', keywords: ['watermelon', 'fruit'] },
    { emoji: '🍍', label: 'Pineapple', keywords: ['pineapple', 'tropical', 'fruit'] },
    { emoji: '🥝', label: 'Kiwi', keywords: ['kiwi', 'fruit'] },
    { emoji: '🥭', label: 'Mango', keywords: ['mango', 'fruit'] },
    { emoji: '🥥', label: 'Coconut', keywords: ['coconut', 'fruit'] },
    { emoji: '🥑', label: 'Avocado', keywords: ['avocado', 'produce', 'healthy'] },
    { emoji: '🥦', label: 'Broccoli', keywords: ['broccoli', 'vegetable', 'produce'] },
    { emoji: '🥕', label: 'Carrot', keywords: ['carrot', 'vegetable', 'produce'] },
    { emoji: '🌽', label: 'Corn', keywords: ['corn', 'vegetable', 'produce'] },
    { emoji: '🥔', label: 'Potato', keywords: ['potato', 'vegetable'] },
    { emoji: '🍠', label: 'Sweet Potato', keywords: ['yam', 'sweet potato', 'vegetable'] },
    { emoji: '🥒', label: 'Cucumber', keywords: ['cucumber', 'vegetable'] },
    { emoji: '🫑', label: 'Bell Pepper', keywords: ['pepper', 'vegetable'] },
    { emoji: '🍅', label: 'Tomato', keywords: ['tomato', 'vegetable', 'produce'] },
    { emoji: '🧅', label: 'Onion', keywords: ['onion', 'aromatics'] },
    { emoji: '🧄', label: 'Garlic', keywords: ['garlic', 'aromatics'] },
    { emoji: '🥬', label: 'Leafy Greens', keywords: ['greens', 'lettuce', 'vegetable'] },
    { emoji: '🍄', label: 'Mushroom', keywords: ['mushroom', 'fungi'] },
    { emoji: '🍞', label: 'Bread', keywords: ['bread', 'bakery'] },
    { emoji: '🥐', label: 'Croissant', keywords: ['pastry', 'croissant', 'bakery'] },
    { emoji: '🥖', label: 'Baguette', keywords: ['baguette', 'bread'] },
    { emoji: '🥨', label: 'Pretzel', keywords: ['pretzel', 'snack'] },
    { emoji: '🧀', label: 'Cheese', keywords: ['cheese', 'dairy'] },
    { emoji: '🥚', label: 'Egg', keywords: ['egg', 'protein'] },
    { emoji: '🥛', label: 'Milk', keywords: ['milk', 'dairy'] },
    { emoji: '🧈', label: 'Butter', keywords: ['butter', 'dairy'] },
    { emoji: '🍗', label: 'Chicken Leg', keywords: ['chicken', 'protein', 'meat'] },
    { emoji: '🥩', label: 'Steak', keywords: ['steak', 'beef', 'protein'] },
    { emoji: '🥓', label: 'Bacon', keywords: ['bacon', 'pork'] },
    { emoji: '🍖', label: 'Rib', keywords: ['pork', 'meat'] },
    { emoji: '🍤', label: 'Shrimp', keywords: ['shrimp', 'seafood'] },
    { emoji: '🐟', label: 'Fish', keywords: ['fish', 'seafood'] },
    { emoji: '🍣', label: 'Sushi', keywords: ['sushi', 'seafood'] },
    { emoji: '🍛', label: 'Curry', keywords: ['curry', 'meal'] },
    { emoji: '🍜', label: 'Noodles', keywords: ['noodles', 'pasta'] },
    { emoji: '🍝', label: 'Spaghetti', keywords: ['pasta', 'spaghetti'] },
    { emoji: '🥗', label: 'Salad', keywords: ['salad', 'greens'] },
    { emoji: '🥪', label: 'Sandwich', keywords: ['sandwich', 'deli'] },
    { emoji: '🌮', label: 'Taco', keywords: ['taco'] },
    { emoji: '🌯', label: 'Burrito', keywords: ['burrito'] },
    { emoji: '🍕', label: 'Pizza', keywords: ['pizza'] },
    { emoji: '🥙', label: 'Stuffed Pita', keywords: ['pita', 'wrap'] },
    { emoji: '🍲', label: 'Stew', keywords: ['stew', 'soup'] },
    { emoji: '🥣', label: 'Cereal Bowl', keywords: ['breakfast', 'cereal'] },
    { emoji: '🍱', label: 'Bento Box', keywords: ['bento', 'lunch'] },
    { emoji: '🧆', label: 'Falafel', keywords: ['falafel', 'vegetarian'] },
    { emoji: '🫘', label: 'Beans', keywords: ['beans', 'legumes'] },
    { emoji: '🥫', label: 'Canned Food', keywords: ['canned', 'pantry'] },
    { emoji: '🧃', label: 'Juice Box', keywords: ['juice', 'drink'] },
    { emoji: '🧊', label: 'Ice', keywords: ['ice'] },
    { emoji: '🍩', label: 'Donut', keywords: ['donut', 'dessert'] },
    { emoji: '🍪', label: 'Cookie', keywords: ['cookie', 'dessert'] },
    { emoji: '🧁', label: 'Cupcake', keywords: ['cupcake', 'dessert'] },
    { emoji: '🍰', label: 'Cake Slice', keywords: ['cake', 'dessert'] },
    { emoji: '🍯', label: 'Honey', keywords: ['honey', 'sweetener'] },
    { emoji: '🥜', label: 'Peanuts', keywords: ['nuts', 'snack'] },
    { emoji: '🌰', label: 'Chestnut', keywords: ['nuts', 'snack'] },
    { emoji: '🍫', label: 'Chocolate', keywords: ['chocolate', 'dessert'] },
    { emoji: '🍿', label: 'Popcorn', keywords: ['popcorn', 'snack'] },
    { emoji: '🫐', label: 'Blueberries', keywords: ['berries', 'fruit'] },
    { emoji: '🍋', label: 'Lemon', keywords: ['citrus', 'fruit'] },
    { emoji: '🍊', label: 'Orange', keywords: ['citrus', 'fruit'] },
    { emoji: '🍑', label: 'Peach', keywords: ['peach', 'fruit'] },
    { emoji: '🍐', label: 'Pear', keywords: ['pear', 'fruit'] },
    { emoji: '🍈', label: 'Melon', keywords: ['melon', 'fruit'] },
    { emoji: '🍒', label: 'Cherries', keywords: ['cherries', 'fruit'] }
].map((item) => ({
    ...item,
    search: `${item.label} ${item.keywords.join(' ')} ${item.emoji}`.toLowerCase()
}));

let emojiPickerInitialized = false;
let emojiPickerFilter = '';

function filterEmojiOptions(term) {
    const normalized = (term || '').trim().toLowerCase();
    if (!normalized) {
        return FOOD_EMOJIS;
    }
    return FOOD_EMOJIS.filter((item) => item.search.includes(normalized));
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
        button.textContent = item.emoji;
        button.title = item.label;
        button.dataset.emoji = item.emoji;
        button.addEventListener('click', () => {
            applyEmojiSelection(item.emoji);
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

function applyEmojiSelection(emoji) {
    if (!emojiInput) return;
    emojiInput.value = sanitizeEmojiInput(emoji);
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

    const parseWegmansNutrition = (nutritionData) => {
        if (!nutritionData || typeof nutritionData !== 'object') {
            return {};
        }

        const nutrition = {};

        const addValue = (key, value, unitHint = '') => {
            if (value == null) return;
            const numeric = extractNumber(value);
            if (numeric == null) return;
            if (unitHint === 'mg') {
                nutrition[key] = numeric / 1000;
            } else {
                nutrition[key] = numeric;
            }
        };

        const handleRow = (label, value) => {
            if (!label) return;
            const normalized = label.toLowerCase();
            if (normalized.includes('calorie')) {
                addValue('calories', value);
            } else if (normalized.includes('total fat')) {
                addValue('fat', value);
            } else if (normalized.includes('saturated fat')) {
                // ignore
            } else if (normalized.includes('carbohydrate')) {
                addValue('carbs', value);
            } else if (normalized.includes('protein')) {
                addValue('protein', value);
            } else if (normalized.includes('serving size')) {
                nutrition.servingSize = typeof value === 'string' ? value.trim() : value;
                const parsed = parseServingSize(value);
                if (parsed != null) {
                    nutrition.servingSizeValue = parsed;
                }
            }
        };

        if (Array.isArray(nutritionData.sections)) {
            nutritionData.sections.forEach((section) => {
                if (!section) return;
                if (Array.isArray(section.rows)) {
                    section.rows.forEach((row) => {
                        if (!row) return;
                        const label = row.label || row.name || row.title;
                        const value = row.value || row.amount || row.text;
                        handleRow(label, value);
                    });
                }
            });
        }

        if (nutritionData.servingSize && !nutrition.servingSize) {
            nutrition.servingSize = String(nutritionData.servingSize).trim();
            const parsedSize = parseServingSize(nutritionData.servingSize);
            if (parsedSize != null) {
                nutrition.servingSizeValue = parsedSize;
            }
        }

        if (
            nutritionData.calories != null ||
            nutritionData.totalFat != null ||
            nutritionData.totalCarbohydrate != null ||
            nutritionData.protein != null
        ) {
            addValue('calories', nutritionData.calories);
            addValue('fat', nutritionData.totalFat);
            addValue('carbs', nutritionData.totalCarbohydrate);
            addValue('protein', nutritionData.protein);
        }

        return nutrition;
    };

    const extractWegmansIngredients = (product) => {
        const collected = [];

        const addFromString = (value) => {
            if (typeof value !== 'string') return;
            const cleaned = value
                .replace(/[\u2022•]/g, ',')
                .replace(/Ingredients?:/i, '')
                .split(/[,;]+/)
                .map((entry) => entry.trim())
                .filter(Boolean);
            collected.push(...cleaned);
        };

        if (typeof product?.ingredientStatement === 'string') {
            addFromString(product.ingredientStatement);
        }

        if (typeof product?.ingredientStatementHtml === 'string') {
            addFromString(product.ingredientStatementHtml.replace(/<[^>]+>/g, ' '));
        }

        const arrayLikeKeys = ['ingredients', 'ingredientList', 'ingredientsList'];
        arrayLikeKeys.forEach((key) => {
            const value = product?.[key];
            if (Array.isArray(value)) {
                value.forEach((item) => {
                    if (!item) return;
                    if (typeof item === 'string') {
                        addFromString(item);
                    } else if (typeof item === 'object' && typeof item.name === 'string') {
                        addFromString(item.name);
                    }
                });
            } else if (typeof value === 'string') {
                addFromString(value);
            }
        });

        return [...new Set(collected)];
    };

    const parseWegmansDomSections = (doc) => {
        if (!doc) return { ingredients: [], nutrition: {} };

        const ingredients = [];
        const ingredientSelectors = [
            '[data-ui="product-ingredients"] li',
            'section[id*="ingredient"] li',
            'section[class*="ingredient"] li',
            '.product-ingredients li',
            '[data-testid="ingredients-list"] li'
        ];

        ingredientSelectors.forEach((selector) => {
            doc.querySelectorAll(selector).forEach((node) => {
                const text = node.textContent ? node.textContent.trim() : '';
                if (text) {
                    ingredients.push(text);
                }
            });
        });

        const normalizedIngredients = [...new Set(ingredients.filter(Boolean))];

        const nutrition = {};
        const nutritionRowSelectors = [
            '[data-ui="product-nutrition"] table tr',
            'section[id*="nutrition"] table tr',
            '.nutrition-facts table tr',
            '[data-testid="nutrition-facts"] tr'
        ];

        const tryAssignFromRow = (label, value) => {
            if (!label || !value) return;
            const normalized = label.toLowerCase();
            if (normalized.includes('calorie')) {
                const parsed = extractNumber(value);
                if (parsed != null) nutrition.calories = parsed;
            } else if (normalized.includes('total fat')) {
                const parsed = extractNumber(value);
                if (parsed != null) nutrition.fat = parsed;
            } else if (normalized.includes('carbohydrate')) {
                const parsed = extractNumber(value);
                if (parsed != null) nutrition.carbs = parsed;
            } else if (normalized.includes('protein')) {
                const parsed = extractNumber(value);
                if (parsed != null) nutrition.protein = parsed;
            } else if (normalized.includes('serving size')) {
                nutrition.servingSize = value.trim();
                const parsed = parseServingSize(value);
                if (parsed != null) {
                    nutrition.servingSizeValue = parsed;
                }
            }
        };

        nutritionRowSelectors.forEach((selector) => {
            doc.querySelectorAll(selector).forEach((row) => {
                const cells = row.querySelectorAll('td, th');
                if (cells.length >= 2) {
                    const label = cells[0].textContent?.trim() || '';
                    const value = cells[1].textContent?.trim() || '';
                    tryAssignFromRow(label, value);
                }
            });
        });

        if (!nutrition.servingSize) {
            const servingNode =
                doc.querySelector('[data-ui="serving-size"]') || doc.querySelector('.serving-size');
            if (servingNode) {
                const text = servingNode.textContent?.trim();
                if (text) {
                    nutrition.servingSize = text;
                    const parsed = parseServingSize(text);
                    if (parsed != null) {
                        nutrition.servingSizeValue = parsed;
                    }
                }
            }
        }

        return {
            ingredients: normalizedIngredients,
            nutrition
        };
    };

    const parseWegmansData = (doc) => {
        if (!doc) return null;

        const scripts = Array.from(doc.querySelectorAll('script'));
        const candidateObjects = [];

        const parseScriptContent = (text) => {
            if (!text) return null;
            let trimmed = text.trim();
            if (!trimmed) return null;

            const nuxtMatch = trimmed.match(/^window\.__NUXT__\s*=\s*(.+)$/s);
            if (nuxtMatch) {
                trimmed = nuxtMatch[1].trim();
                if (trimmed.endsWith(';')) {
                    trimmed = trimmed.slice(0, -1);
                }
            }

            if (
                (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
                (trimmed.startsWith('[') && trimmed.endsWith(']'))
            ) {
                try {
                    return JSON.parse(trimmed);
                } catch (error) {
                    return null;
                }
            }
            return null;
        };

        scripts.forEach((script) => {
            const text = script.textContent || script.innerText || '';
            if (!text || (!text.includes('displayName') && !text.includes('ingredient'))) {
                return;
            }
            const parsed = parseScriptContent(text);
            if (!parsed) return;
            if (Array.isArray(parsed)) {
                parsed.forEach((item) => {
                    if (item && typeof item === 'object') {
                        candidateObjects.push(item);
                    }
                });
            } else if (typeof parsed === 'object') {
                candidateObjects.push(parsed);
            }
        });

        const visited = new Set();
        const stack = [...candidateObjects];
        let product = null;

        const isProductCandidate = (value) => {
            if (!value || typeof value !== 'object') return false;
            const hasName =
                typeof value.displayName === 'string' ||
                typeof value.name === 'string' ||
                typeof value.productName === 'string';
            if (!hasName) return false;
            const hasIngredients =
                typeof value.ingredientStatement === 'string' ||
                (Array.isArray(value.ingredients) && value.ingredients.length > 0) ||
                (Array.isArray(value.ingredientList) && value.ingredientList.length > 0) ||
                (Array.isArray(value.ingredientsList) && value.ingredientsList.length > 0);
            const hasNutrition =
                value.nutritionFacts ||
                value.nutrition ||
                value.nutritionInfo ||
                value.nutritionalInformation;
            return hasIngredients || Boolean(hasNutrition);
        };

        while (stack.length && !product) {
            const current = stack.pop();
            if (!current || typeof current !== 'object') continue;
            if (visited.has(current)) continue;
            visited.add(current);

            if (isProductCandidate(current)) {
                product = current;
                break;
            }

            Object.keys(current).forEach((key) => {
                const value = current[key];
                if (value && typeof value === 'object') {
                    stack.push(value);
                }
            });
        }

        const result = {
            name: '',
            description: '',
            ingredients: [],
            nutrition: {}
        };

        if (product) {
            result.name =
                product.displayName ||
                product.name ||
                product.productName ||
                result.name ||
                '';
            result.description =
                product.description ||
                product.longDescription ||
                product.shortDescription ||
                result.description ||
                '';
            result.ingredients = extractWegmansIngredients(product);

            const nutritionData =
                product.nutritionFacts ||
                product.nutrition ||
                product.nutritionalInformation ||
                product.nutritionInfo ||
                null;

            const nutrition = parseWegmansNutrition(nutritionData);

            if (
                !nutrition.servingSize &&
                typeof product.servingSize === 'string' &&
                product.servingSize.trim()
            ) {
                nutrition.servingSize = product.servingSize.trim();
                const parsed = parseServingSize(product.servingSize);
                if (parsed != null) {
                    nutrition.servingSizeValue = parsed;
                }
            }

            result.nutrition = nutrition;
        }

        const domData = parseWegmansDomSections(doc);
        if (!result.name) {
            const title =
                doc.querySelector('[data-ui="product-name"]')?.textContent ||
                doc.querySelector('h1')?.textContent ||
                doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
                '';
            result.name = title ? title.trim() : '';
        }
        if (!result.description) {
            const metaDescription =
                doc.querySelector('meta[name="description"]')?.getAttribute('content') || '';
            result.description = metaDescription ? metaDescription.trim() : result.description;
        }

        if (result.ingredients.length === 0 && domData.ingredients.length > 0) {
            result.ingredients = domData.ingredients;
        }

        const nutritionKeys = ['calories', 'fat', 'carbs', 'protein', 'servingSize', 'servingSizeValue'];
        const hasNutritionValues = nutritionKeys.some((key) => result.nutrition[key] != null);
        if (!hasNutritionValues) {
            nutritionKeys.forEach((key) => {
                if (domData.nutrition[key] != null) {
                    result.nutrition[key] = domData.nutrition[key];
                }
            });
        }

        const hasMeaningfulData =
            Boolean(result.name) ||
            (Array.isArray(result.ingredients) && result.ingredients.length > 0) ||
            Object.values(result.nutrition).some((value) => value != null);

        if (!hasMeaningfulData) {
            return null;
        }

        result.ingredients = normalizeStringArray(result.ingredients);
        return result;
    };

    const parseIngredientData = (html, options = {}) => {
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

            if (options?.url && options.url.includes('wegmans.com')) {
                const wegmansData = parseWegmansData(doc);
                if (wegmansData) {
                    return wegmansData;
                }
            }

            const fallback = fallbackFromDom(doc);
            if (fallback) {
                return fallback;
            }

            return null;
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
            scrapeProgress.setAttribute('aria-busy', isLoading ? 'true' : 'false');
        }
        if (scrapeForm) {
            Array.from(scrapeForm.elements).forEach((element) => {
                if (!(element instanceof HTMLButtonElement) || element.id !== 'cancel-scrape') {
                    element.disabled = isLoading;
                }
            });
        }
        if (scrapeResults) {
            scrapeResults.setAttribute('aria-busy', isLoading ? 'true' : 'false');
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
            scrapeResults.setAttribute('aria-busy', 'false');
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
        scrapeResults.setAttribute('aria-busy', 'false');
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
            const parsedData = parseIngredientData(html, { url: normalizedUrl });
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
    emojiInput.addEventListener('focus', () => {
        void openEmojiPicker(emojiInput);
    });
    emojiInput.addEventListener('click', () => {
        void openEmojiPicker(emojiInput);
    });
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