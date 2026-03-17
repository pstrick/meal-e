import { applyDarkMode } from './settings.js';
import { showAlert } from './alert.js';
import {
    loadMeals,
    saveMeals,
    loadRecipes,
    loadIngredients,
    calculateMealTotals
} from './meals.js';

let meals = [];
let recipes = [];
let ingredients = [];
let currentEditMealId = null;
let editingComponents = [];
let inlineEditingMealId = null;

let sortColumn = 'name';
let sortDirection = 'asc';
let searchTerm = '';
let categoryFilter = 'all';

const dom = {};

function compareIds(a, b) {
    return String(a) === String(b);
}

function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value ?? '';
    return div.innerHTML;
}

function readDom() {
    dom.addMealBtn = document.getElementById('add-meal-btn');
    dom.mealList = document.getElementById('meal-list');
    dom.mealSearch = document.getElementById('meal-search');
    dom.mealCategoryFilter = document.getElementById('meal-category-filter');
    dom.mealsTable = document.getElementById('meals-table');

    dom.mealModal = document.getElementById('meal-modal');
    dom.mealModalTitle = document.getElementById('meal-modal-title');
    dom.mealForm = document.getElementById('meal-form');
    dom.mealName = document.getElementById('meal-name');
    dom.mealCategory = document.getElementById('meal-category');
    dom.mealServingSize = document.getElementById('meal-serving-size');
    dom.mealNotes = document.getElementById('meal-notes');
    dom.cancelMealModal = document.getElementById('cancel-meal-modal');
    dom.closeMealModal = dom.mealModal?.querySelector('.close');

    dom.componentType = document.getElementById('component-type');
    dom.componentItem = document.getElementById('component-item');
    dom.componentAmount = document.getElementById('component-amount');
    dom.addComponentBtn = document.getElementById('add-component-btn');
    dom.componentsList = document.getElementById('meal-components-list');

    dom.totalCalories = document.getElementById('meal-total-calories');
    dom.totalProtein = document.getElementById('meal-total-protein');
    dom.totalCarbs = document.getElementById('meal-total-carbs');
    dom.totalFat = document.getElementById('meal-total-fat');
    dom.totalCost = document.getElementById('meal-total-cost');
}

function initData() {
    recipes = loadRecipes();
    ingredients = loadIngredients();
    meals = loadMeals();
    renderMealsTable();
}

function setupListeners() {
    dom.addMealBtn?.addEventListener('click', () => openMealModal());
    dom.mealSearch?.addEventListener('input', (event) => {
        searchTerm = (event.target.value || '').toLowerCase().trim();
        renderMealsTable();
    });
    dom.mealCategoryFilter?.addEventListener('change', (event) => {
        categoryFilter = event.target.value || 'all';
        renderMealsTable();
    });
    dom.mealsTable?.querySelectorAll('th.sortable').forEach((th) => {
        th.addEventListener('click', () => onSortClick(th.dataset.sort));
    });

    dom.cancelMealModal?.addEventListener('click', closeMealModal);
    dom.closeMealModal?.addEventListener('click', closeMealModal);
    dom.mealModal?.addEventListener('click', (event) => {
        if (event.target === dom.mealModal) closeMealModal();
    });
    dom.mealForm?.addEventListener('submit', handleMealSubmit);

    dom.componentType?.addEventListener('change', rebuildComponentItemOptions);
    dom.addComponentBtn?.addEventListener('click', addComponentToMeal);

    document.addEventListener('click', (event) => {
        if (event.target.closest('.kebab-dropdown-wrap')) {
            return;
        }
        document.querySelectorAll('.kebab-dropdown-wrap.is-open').forEach((wrap) => {
            wrap.classList.remove('is-open');
        });
    });

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        document.querySelectorAll('.kebab-dropdown-wrap.is-open').forEach((wrap) => {
            wrap.classList.remove('is-open');
        });
    });
}

function onSortClick(column) {
    if (!column) return;
    if (sortColumn === column) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortColumn = column;
        sortDirection = 'asc';
    }
    renderMealsTable();
}

function sortedAndFilteredMeals() {
    const filtered = meals.filter((meal) => {
        const matchesSearch = !searchTerm
            || (meal.name || '').toLowerCase().includes(searchTerm)
            || (meal.notes || '').toLowerCase().includes(searchTerm);
        const matchesCategory = categoryFilter === 'all' || meal.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    filtered.sort((a, b) => {
        let result = 0;
        if (sortColumn === 'name') {
            result = (a.name || '').localeCompare(b.name || '');
        } else if (sortColumn === 'category') {
            result = (a.category || '').localeCompare(b.category || '');
        } else if (sortColumn === 'components') {
            result = (a.components?.length || 0) - (b.components?.length || 0);
        } else if (sortColumn === 'servingSize') {
            result = (a.servingSize || 0) - (b.servingSize || 0);
        } else if (sortColumn === 'calories') {
            const aTotals = calculateMealTotals(a, a.servingSize, { recipes, ingredients });
            const bTotals = calculateMealTotals(b, b.servingSize, { recipes, ingredients });
            result = (aTotals.nutrition.calories || 0) - (bTotals.nutrition.calories || 0);
        }
        return sortDirection === 'asc' ? result : -result;
    });

    return filtered;
}

function updateSortIcons() {
    dom.mealsTable?.querySelectorAll('th.sortable').forEach((th) => {
        const icon = th.querySelector('.sort-icon');
        if (!icon) return;
        if (th.dataset.sort !== sortColumn) {
            icon.textContent = '';
        } else {
            icon.textContent = sortDirection === 'asc' ? ' ▲' : ' ▼';
        }
    });
}

function renderMealsTable() {
    if (!dom.mealList) return;
    updateSortIcons();
    const rows = sortedAndFilteredMeals();
    dom.mealList.innerHTML = '';

    if (rows.length === 0) {
        dom.mealList.innerHTML = `
            <tr>
                <td colspan="7" class="no-items">No meals found. Create one to get started.</td>
            </tr>
        `;
        return;
    }

    rows.forEach((meal) => {
        const totals = calculateMealTotals(meal, meal.servingSize, { recipes, ingredients });
        const tr = document.createElement('tr');
        const isInlineEditing = compareIds(inlineEditingMealId, meal.id);
        const mealId = escapeHtml(String(meal.id));
        const safeName = escapeHtml(meal.name || '');
        const safeNotes = escapeHtml(meal.notes || '');
        const safeCategory = escapeHtml(meal.category || 'dinner');
        const safeServingSize = Math.round(meal.servingSize || 0);

        if (isInlineEditing) {
            tr.innerHTML = `
                <td><input class="item-inline-input" data-inline-field="name" data-id="${mealId}" value="${safeName}" /></td>
                <td>
                    <select class="item-inline-input" data-inline-field="category" data-id="${mealId}">
                        <option value="breakfast" ${safeCategory === 'breakfast' ? 'selected' : ''}>Breakfast</option>
                        <option value="lunch" ${safeCategory === 'lunch' ? 'selected' : ''}>Lunch</option>
                        <option value="dinner" ${safeCategory === 'dinner' ? 'selected' : ''}>Dinner</option>
                        <option value="snacks" ${safeCategory === 'snacks' ? 'selected' : ''}>Snacks</option>
                    </select>
                </td>
                <td>${meal.components?.length || 0}</td>
                <td><input type="number" min="1" step="1" class="item-inline-input" data-inline-field="servingSize" data-id="${mealId}" value="${safeServingSize || 1}" /></td>
                <td>${Math.round(totals.nutrition.calories || 0)}</td>
                <td><input class="item-inline-input" data-inline-field="notes" data-id="${mealId}" value="${safeNotes}" placeholder="Notes" /></td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-primary btn-icon" type="button" data-action="inline-save" data-id="${mealId}" title="Save" aria-label="Save">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="btn btn-secondary btn-icon" type="button" data-action="inline-cancel" data-id="${mealId}" title="Cancel" aria-label="Cancel">
                            <i class="fas fa-times"></i>
                        </button>
                        <button class="btn btn-edit btn-icon" type="button" data-action="edit" data-id="${mealId}" title="Open full editor" aria-label="Open full editor">
                            <i class="fas fa-expand"></i>
                        </button>
                    </div>
                </td>
            `;
            dom.mealList.appendChild(tr);
            return;
        }

        tr.innerHTML = `
            <td><span class="recipe-name-text">${escapeHtml(meal.name)}</span></td>
            <td>${escapeHtml(meal.category || '')}</td>
            <td>${meal.components?.length || 0}</td>
            <td>${Math.round(meal.servingSize || 0)} <small>g</small></td>
            <td>${Math.round(totals.nutrition.calories || 0)}</td>
            <td>
                <div class="macro-info">
                    <span>F: ${Math.round((totals.nutrition.fat || 0) * 10) / 10}g</span>
                    <span>C: ${Math.round((totals.nutrition.carbs || 0) * 10) / 10}g</span>
                    <span>P: ${Math.round((totals.nutrition.protein || 0) * 10) / 10}g</span>
                </div>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-edit btn-icon" data-action="inline-edit" data-id="${mealId}" title="Quick edit" aria-label="Quick edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <div class="kebab-dropdown-wrap">
                        <button class="btn btn-secondary btn-icon" type="button" title="More actions" aria-label="More actions" onclick="this.closest('.kebab-dropdown-wrap').classList.toggle('is-open')">
                            <i class="fas fa-ellipsis-v"></i>
                        </button>
                        <div class="kebab-dropdown">
                            <button class="kebab-item" type="button" data-action="edit" data-id="${mealId}">
                                <i class="fas fa-expand"></i> Open full editor
                            </button>
                            <button class="kebab-item" type="button" data-action="duplicate" data-id="${mealId}">
                                <i class="fas fa-copy"></i> Duplicate
                            </button>
                            <button class="kebab-item" type="button" data-action="delete" data-id="${mealId}">
                                <i class="fas fa-trash"></i> Delete
                            </button>
                        </div>
                    </div>
                </div>
            </td>
        `;
        dom.mealList.appendChild(tr);
    });

    dom.mealList.querySelectorAll('[data-action="inline-edit"]').forEach((button) => {
        button.addEventListener('click', () => {
            inlineEditingMealId = button.dataset.id;
            renderMealsTable();
        });
    });
    dom.mealList.querySelectorAll('[data-action="inline-save"]').forEach((button) => {
        button.addEventListener('click', () => saveInlineMealEdit(button.dataset.id));
    });
    dom.mealList.querySelectorAll('[data-action="inline-cancel"]').forEach((button) => {
        button.addEventListener('click', () => {
            inlineEditingMealId = null;
            renderMealsTable();
        });
    });
    dom.mealList.querySelectorAll('[data-action="edit"]').forEach((button) => {
        button.addEventListener('click', () => openMealModal(button.dataset.id));
    });
    dom.mealList.querySelectorAll('[data-action="duplicate"]').forEach((button) => {
        button.addEventListener('click', () => duplicateMeal(button.dataset.id));
    });
    dom.mealList.querySelectorAll('[data-action="delete"]').forEach((button) => {
        button.addEventListener('click', () => deleteMeal(button.dataset.id));
    });
}

function saveInlineMealEdit(mealId) {
    const target = meals.find((meal) => compareIds(meal.id, mealId));
    if (!target) return;

    const getValue = (field) => dom.mealList.querySelector(`[data-inline-field="${field}"][data-id="${CSS.escape(String(mealId))}"]`);
    const nameInput = getValue('name');
    const categoryInput = getValue('category');
    const servingSizeInput = getValue('servingSize');
    const notesInput = getValue('notes');

    const name = (nameInput?.value || '').trim();
    const category = (categoryInput?.value || '').trim() || 'dinner';
    const servingSize = Number.parseFloat(servingSizeInput?.value || '');
    const notes = (notesInput?.value || '').trim();

    if (!name) {
        showAlert('Meal name is required.', { type: 'warning' });
        return;
    }
    if (!Number.isFinite(servingSize) || servingSize <= 0) {
        showAlert('Serving size must be greater than 0.', { type: 'warning' });
        return;
    }

    target.name = name;
    target.category = category;
    target.servingSize = servingSize;
    target.notes = notes;
    target.updatedAt = new Date().toISOString();

    meals = saveMeals(meals);
    inlineEditingMealId = null;
    renderMealsTable();
}

function openMealModal(mealId = null) {
    currentEditMealId = mealId;
    editingComponents = [];
    recipes = loadRecipes();
    ingredients = loadIngredients();

    if (mealId) {
        const meal = meals.find((item) => compareIds(item.id, mealId));
        if (!meal) return;
        dom.mealModalTitle.textContent = 'Edit Meal';
        dom.mealName.value = meal.name || '';
        dom.mealCategory.value = meal.category || 'dinner';
        dom.mealServingSize.value = Math.round(meal.servingSize || 100);
        dom.mealNotes.value = meal.notes || '';
        editingComponents = Array.isArray(meal.components) ? meal.components.map((component) => ({ ...component })) : [];
    } else {
        dom.mealModalTitle.textContent = 'Add Meal';
        dom.mealForm.reset();
        dom.mealCategory.value = 'dinner';
        dom.mealServingSize.value = '100';
        dom.componentAmount.value = '100';
    }

    rebuildComponentItemOptions();
    renderComponentList();
    updatePreview();
    dom.mealModal.classList.add('active');
}

function closeMealModal() {
    dom.mealModal.classList.remove('active');
    currentEditMealId = null;
    editingComponents = [];
}

function rebuildComponentItemOptions() {
    if (!dom.componentItem || !dom.componentType) return;
    const type = dom.componentType.value;
    const options = type === 'recipe' ? recipes : ingredients;
    dom.componentItem.innerHTML = '';

    if (!options.length) {
        dom.componentItem.innerHTML = '<option value="">No items available</option>';
        return;
    }

    options.forEach((item) => {
        const option = document.createElement('option');
        option.value = String(item.id);
        option.textContent = item.name || (type === 'recipe' ? 'Recipe' : 'Ingredient');
        dom.componentItem.appendChild(option);
    });
}

function addComponentToMeal() {
    const type = dom.componentType.value;
    const id = dom.componentItem.value;
    const amount = Number.parseFloat(dom.componentAmount.value);

    if (!id) {
        showAlert('Select a component item first.', { type: 'warning' });
        return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
        showAlert('Component amount must be greater than 0.', { type: 'warning' });
        return;
    }

    editingComponents.push({
        type,
        id,
        amount
    });

    renderComponentList();
    updatePreview();
}

function renderComponentList() {
    if (!dom.componentsList) return;
    if (editingComponents.length === 0) {
        dom.componentsList.innerHTML = '<div class="no-items">No components yet.</div>';
        return;
    }

    dom.componentsList.innerHTML = editingComponents.map((component, index) => {
        const itemName = component.type === 'recipe'
            ? (recipes.find((recipe) => compareIds(recipe.id, component.id))?.name || 'Missing recipe')
            : (ingredients.find((ingredient) => compareIds(ingredient.id, String(component.id).replace(/^custom-/, '')))?.name || 'Missing ingredient');

        return `
            <div class="ingredient-item" style="margin-bottom: 8px;">
                <div class="ingredient-header">
                    <span class="ingredient-name">${escapeHtml(itemName)} <small>(${escapeHtml(component.type)})</small></span>
                    <button type="button" class="btn btn-delete btn-icon" data-remove-component="${index}" title="Delete" aria-label="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                <div class="ingredient-details">
                    <span>${Math.round(component.amount)}g</span>
                </div>
            </div>
        `;
    }).join('');

    dom.componentsList.querySelectorAll('[data-remove-component]').forEach((button) => {
        button.addEventListener('click', () => {
            const index = Number.parseInt(button.dataset.removeComponent, 10);
            if (Number.isInteger(index) && index >= 0 && index < editingComponents.length) {
                editingComponents.splice(index, 1);
                renderComponentList();
                updatePreview();
            }
        });
    });
}

function updatePreview() {
    const previewMeal = {
        id: 'preview',
        name: dom.mealName?.value || 'Preview',
        category: dom.mealCategory?.value || 'dinner',
        servingSize: Number.parseFloat(dom.mealServingSize?.value) || 100,
        notes: dom.mealNotes?.value || '',
        components: editingComponents
    };

    const totals = calculateMealTotals(previewMeal, previewMeal.servingSize, { recipes, ingredients });
    dom.totalCalories.textContent = Math.round(totals.nutrition.calories || 0);
    dom.totalProtein.textContent = `${Math.round((totals.nutrition.protein || 0) * 10) / 10}g`;
    dom.totalCarbs.textContent = `${Math.round((totals.nutrition.carbs || 0) * 10) / 10}g`;
    dom.totalFat.textContent = `${Math.round((totals.nutrition.fat || 0) * 10) / 10}g`;
    dom.totalCost.textContent = `$${(totals.cost || 0).toFixed(2)}`;
}

function handleMealSubmit(event) {
    event.preventDefault();
    const name = (dom.mealName.value || '').trim();
    const category = dom.mealCategory.value;
    const servingSize = Number.parseFloat(dom.mealServingSize.value);
    const notes = (dom.mealNotes.value || '').trim();

    if (!name) {
        showAlert('Meal name is required.', { type: 'warning' });
        return;
    }
    if (!Number.isFinite(servingSize) || servingSize <= 0) {
        showAlert('Serving size must be greater than 0.', { type: 'warning' });
        return;
    }
    if (!editingComponents.length) {
        showAlert('Add at least one recipe or ingredient component.', { type: 'warning' });
        return;
    }

    const now = new Date().toISOString();
    const nextMeal = {
        id: currentEditMealId || Date.now(),
        name,
        category,
        servingSize,
        notes,
        components: editingComponents.map((component) => ({
            type: component.type,
            id: component.id,
            amount: Number.parseFloat(component.amount) || 0
        })),
        createdAt: currentEditMealId
            ? (meals.find((meal) => compareIds(meal.id, currentEditMealId))?.createdAt || now)
            : now,
        updatedAt: now
    };

    if (currentEditMealId) {
        const index = meals.findIndex((meal) => compareIds(meal.id, currentEditMealId));
        if (index !== -1) {
            meals[index] = nextMeal;
        }
    } else {
        meals.push(nextMeal);
    }

    meals = saveMeals(meals);
    renderMealsTable();
    closeMealModal();
}

function duplicateMeal(mealId) {
    const source = meals.find((meal) => compareIds(meal.id, mealId));
    if (!source) return;
    meals.push({
        ...source,
        id: Date.now(),
        name: `${source.name} (Copy)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        components: (source.components || []).map((component) => ({ ...component }))
    });
    meals = saveMeals(meals);
    renderMealsTable();
}

async function deleteMeal(mealId) {
    const target = meals.find((meal) => compareIds(meal.id, mealId));
    if (!target) return;
    const confirmed = await showAlert(`Delete "${target.name}"?`, {
        title: 'Delete Meal',
        type: 'warning',
        confirmText: 'Delete',
        cancelText: 'Keep Meal'
    });
    if (!confirmed) return;
    meals = meals.filter((meal) => !compareIds(meal.id, mealId));
    meals = saveMeals(meals);
    renderMealsTable();
}

document.addEventListener('DOMContentLoaded', () => {
    applyDarkMode();
    readDom();
    initData();
    setupListeners();
    [dom.mealName, dom.mealCategory, dom.mealServingSize, dom.mealNotes].forEach((element) => {
        element?.addEventListener('input', updatePreview);
        element?.addEventListener('change', updatePreview);
    });
});
