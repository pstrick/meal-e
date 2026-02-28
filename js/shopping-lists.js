import { applyDarkMode } from './settings.js';
import { showAlert } from './alert.js';

const DEFAULT_STORE_SECTION = 'Uncategorized';
const SHOPPING_LISTS_STORAGE_KEY = 'shoppingLists';
const INGREDIENTS_STORAGE_KEY = 'meale-my-ingredients';

let shoppingLists = [];
let currentListId = null;
let selectedQuickAddIngredient = null;
let listDetailsSaveTimeout = null;
let quickAddSearchTimeout = null;
let quickAddResults = [];
let quickAddActiveIndex = -1;
let draggedSectionName = null;

let addListBtn;
let listsTableBody;
let listSearchInput;
let listStatusFilterEl;
let shoppingListModal;
let shoppingListForm;
let shoppingItemsModal;
let shoppingItemsList;
let quickAddIngredientSearchInput;
let quickAddSearchResults;
let quickAddQuantityInput;
let quickAddSectionInput;
let quickAddNotesInput;
let quickAddPackageSizeEl;
let quickAddPackagePriceEl;
let quickAddItemBtn;
let listActionsMenuBtn;
let listActionsMenu;
let listActionPrintBtn;
let listActionEditDetailsBtn;
let listDetailsModal;
let manageListNameInput;
let manageListDescriptionInput;

let listSearchTerm = '';
let listFilter = '';
let listSortColumn = 'name';
let listSortDirection = 'asc';

function notifyUser(message, options = {}) {
    try {
        showAlert(message, options);
    } catch (error) {
        console.error('Unable to show alert:', error);
    }
}

function normalizeStoreSection(section) {
    const trimmed = (section || '').trim();
    return trimmed ? trimmed : DEFAULT_STORE_SECTION;
}

function compareIds(a, b) {
    return String(a) === String(b);
}

function formatMoney(value) {
    if (!Number.isFinite(value)) return '--';
    return `$${value.toFixed(2)}`;
}

function formatPackageSize(item) {
    if (item.packageSize && String(item.packageSize).trim()) {
        return String(item.packageSize).trim();
    }
    return '--';
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
}

function getListById(listId) {
    return shoppingLists.find((list) => compareIds(list.id, listId)) || null;
}

function normalizeListItem(item) {
    const legacyAmount = Number.parseFloat(item?.amount);
    const legacyUnit = (item?.unit || '').trim();
    const legacyPackage = legacyAmount > 0 && legacyUnit ? `${legacyAmount} ${legacyUnit}` : '';
    const parsedPackagePrice = Number.parseFloat(item?.packagePrice);
    const parsedQty = Number.parseFloat(item?.quantity);

    return {
        id: item?.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        ingredientId: item?.ingredientId ?? null,
        name: (item?.name || '').trim(),
        image: (item?.image || '').trim(),
        storeSection: normalizeStoreSection(item?.storeSection),
        packageSize: (item?.packageSize || legacyPackage || '').trim(),
        packagePrice: Number.isFinite(parsedPackagePrice) ? parsedPackagePrice : null,
        quantity: Number.isFinite(parsedQty) && parsedQty > 0 ? parsedQty : 1,
        notes: (item?.notes || '').trim(),
        addedAt: item?.addedAt || new Date().toISOString()
    };
}

function normalizeShoppingList(list) {
    const sectionOrder = Array.isArray(list?.sectionOrder)
        ? list.sectionOrder.map((section) => normalizeStoreSection(section))
        : [];
    const uniqueSectionOrder = [...new Set(sectionOrder)];

    return {
        id: list?.id || Date.now(),
        name: (list?.name || 'Untitled List').trim(),
        description: (list?.description || '').trim(),
        items: Array.isArray(list?.items) ? list.items.map(normalizeListItem) : [],
        sectionOrder: uniqueSectionOrder,
        createdAt: list?.createdAt || new Date().toISOString()
    };
}

function loadShoppingLists() {
    try {
        const data = localStorage.getItem(SHOPPING_LISTS_STORAGE_KEY);
        const parsed = data ? JSON.parse(data) : [];
        shoppingLists = Array.isArray(parsed) ? parsed.map(normalizeShoppingList) : [];
    } catch (error) {
        console.error('Error loading shopping lists:', error);
        shoppingLists = [];
    }
}

function saveShoppingLists() {
    try {
        localStorage.setItem(SHOPPING_LISTS_STORAGE_KEY, JSON.stringify(shoppingLists));
    } catch (error) {
        console.error('Error saving shopping lists:', error);
    }
}

function loadMyIngredients() {
    try {
        const raw = localStorage.getItem(INGREDIENTS_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(parsed)) return [];

        return parsed
            .map((ingredient) => {
                const totalWeight = Number.parseFloat(ingredient.totalWeight);
                const totalPrice = Number.parseFloat(ingredient.totalPrice);
                return {
                    id: ingredient.id,
                    name: (ingredient.name || '').trim(),
                    image: (ingredient.image || ingredient.icon || '').trim(),
                    storeSection: normalizeStoreSection(ingredient.storeSection),
                    packageSize: Number.isFinite(totalWeight) && totalWeight > 0 ? `${totalWeight}g` : '',
                    packagePrice: Number.isFinite(totalPrice) ? totalPrice : null
                };
            })
            .filter((ingredient) => ingredient.name);
    } catch (error) {
        console.error('Error loading ingredients:', error);
        return [];
    }
}

function initializeShoppingLists() {
    const listsTable = document.getElementById('lists-table');
    addListBtn = document.getElementById('add-list-btn');
    listsTableBody = listsTable?.querySelector('tbody');
    listSearchInput = document.getElementById('list-search');
    listStatusFilterEl = document.getElementById('list-status-filter');
    shoppingListModal = document.getElementById('shopping-list-modal');
    shoppingListForm = document.getElementById('shopping-list-form');
    shoppingItemsModal = document.getElementById('shopping-items-modal');
    shoppingItemsList = document.getElementById('shopping-items-list');
    quickAddIngredientSearchInput = document.getElementById('quick-add-ingredient-search');
    quickAddSearchResults = document.getElementById('quick-add-search-results');
    quickAddQuantityInput = document.getElementById('quick-add-quantity');
    quickAddSectionInput = document.getElementById('quick-add-section');
    quickAddNotesInput = document.getElementById('quick-add-notes');
    quickAddPackageSizeEl = document.getElementById('quick-add-package-size');
    quickAddPackagePriceEl = document.getElementById('quick-add-package-price');
    quickAddItemBtn = document.getElementById('quick-add-item-btn');
    listActionsMenuBtn = document.getElementById('list-actions-menu-btn');
    listActionsMenu = document.getElementById('list-actions-menu');
    listActionPrintBtn = document.getElementById('list-action-print');
    listActionEditDetailsBtn = document.getElementById('list-action-edit-details');
    listDetailsModal = document.getElementById('list-details-modal');
    manageListNameInput = document.getElementById('manage-list-name');
    manageListDescriptionInput = document.getElementById('manage-list-description');

    loadShoppingLists();
    setupEventListeners();
    setupListsTableListeners();
    renderListsTable();
    handleReturnContextFromUrl();
}

function setupEventListeners() {
    addListBtn?.addEventListener('click', () => openShoppingListModal());
    document.querySelector('#shopping-list-modal .close')?.addEventListener('click', closeShoppingListModal);
    document.getElementById('cancel-list')?.addEventListener('click', closeShoppingListModal);
    shoppingListForm?.addEventListener('submit', handleShoppingListSubmit);

    document.querySelector('#shopping-items-modal .close')?.addEventListener('click', closeShoppingItemsModal);

    listActionsMenuBtn?.addEventListener('click', (event) => {
        event.stopPropagation();
        toggleListActionsMenu();
    });
    listActionPrintBtn?.addEventListener('click', () => {
        closeListActionsMenu();
        printShoppingList();
    });
    listActionEditDetailsBtn?.addEventListener('click', () => {
        closeListActionsMenu();
        openListDetailsModal();
    });

    document.querySelector('#list-details-modal .close')?.addEventListener('click', closeListDetailsModal);
    listDetailsModal?.addEventListener('click', (event) => {
        if (event.target === listDetailsModal) closeListDetailsModal();
    });

    manageListNameInput?.addEventListener('input', debouncedAutoSaveListDetails);
    manageListDescriptionInput?.addEventListener('input', debouncedAutoSaveListDetails);

    quickAddIngredientSearchInput?.addEventListener('input', handleQuickAddSearchInput);
    quickAddIngredientSearchInput?.addEventListener('keydown', handleQuickAddSearchKeydown);
    quickAddIngredientSearchInput?.addEventListener('focus', () => {
        const value = quickAddIngredientSearchInput.value.trim();
        if (value.length >= 1) {
            updateQuickAddSearchResults(value);
        }
    });
    quickAddItemBtn?.addEventListener('click', addItemFromQuickAdd);

    document.addEventListener('click', (event) => {
        const quickAddContainer = quickAddIngredientSearchInput?.closest('.quick-add-main');
        if (quickAddContainer && !quickAddContainer.contains(event.target)) {
            hideQuickAddSearchResults();
        }
        const menuContainer = document.querySelector('.list-actions-menu-wrapper');
        if (menuContainer && !menuContainer.contains(event.target)) {
            closeListActionsMenu();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeListActionsMenu();
            hideQuickAddSearchResults();
        }
    });
}

function setupListsTableListeners() {
    listSearchInput?.addEventListener('input', (event) => {
        listSearchTerm = (event.target.value || '').toLowerCase();
        renderListsTable();
    });

    listStatusFilterEl?.addEventListener('change', (event) => {
        listFilter = (event.target.value || '').trim();
        renderListsTable();
    });

    const listsTable = document.getElementById('lists-table');
    listsTable?.querySelectorAll('th.sortable').forEach((th) => {
        th.addEventListener('click', onListSortHeaderClick);
    });
}

function onListSortHeaderClick(event) {
    const th = event.target.closest('th.sortable');
    if (!th || !th.dataset.sort) return;
    const key = th.dataset.sort;
    if (listSortColumn === key) {
        listSortDirection = listSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        listSortColumn = key;
        listSortDirection = 'asc';
    }
    renderListsTable();
}

function openShoppingListModal(listId = null) {
    currentListId = listId;
    const modal = shoppingListModal;
    const title = document.getElementById('list-modal-title');
    const form = shoppingListForm;
    if (!modal || !title || !form) return;

    if (listId) {
        const list = getListById(listId);
        if (!list) return;
        title.textContent = 'Edit Shopping List';
        document.getElementById('list-name').value = list.name;
        document.getElementById('list-description').value = list.description || '';
    } else {
        title.textContent = 'Create New Shopping List';
        form.reset();
    }

    modal.classList.add('active');
}

function closeShoppingListModal() {
    shoppingListModal?.classList.remove('active');
    currentListId = null;
}

function handleShoppingListSubmit(event) {
    event.preventDefault();
    const name = (document.getElementById('list-name').value || '').trim();
    const description = (document.getElementById('list-description').value || '').trim();

    if (!name) {
        notifyUser('Please enter a list name', { type: 'warning' });
        return;
    }

    if (currentListId) {
        const index = shoppingLists.findIndex((list) => compareIds(list.id, currentListId));
        if (index !== -1) {
            shoppingLists[index] = {
                ...shoppingLists[index],
                name,
                description
            };
        }
    } else {
        shoppingLists.push({
            id: Date.now(),
            name,
            description,
            items: [],
            sectionOrder: [],
            createdAt: new Date().toISOString()
        });
    }

    saveShoppingLists();
    renderListsTable();
    closeShoppingListModal();
}

function openManageListModal(listId) {
    const list = getListById(listId);
    if (!list) return;

    currentListId = list.id;
    document.getElementById('items-modal-title').textContent = `Edit Shopping List: ${list.name}`;
    resetQuickAddRow();
    updateShoppingItemsDisplay();
    shoppingItemsModal?.classList.add('active');
}

function closeShoppingItemsModal() {
    shoppingItemsModal?.classList.remove('active');
    currentListId = null;
    closeListActionsMenu();
    hideQuickAddSearchResults();
}

function openListDetailsModal() {
    const list = getListById(currentListId);
    if (!list || !listDetailsModal) return;
    manageListNameInput.value = list.name;
    manageListDescriptionInput.value = list.description || '';
    listDetailsModal.classList.add('active');
    manageListNameInput.focus();
}

function closeListDetailsModal() {
    if (listDetailsSaveTimeout) {
        window.clearTimeout(listDetailsSaveTimeout);
        listDetailsSaveTimeout = null;
    }
    listDetailsModal?.classList.remove('active');
}

function debouncedAutoSaveListDetails() {
    if (listDetailsSaveTimeout) {
        window.clearTimeout(listDetailsSaveTimeout);
    }
    listDetailsSaveTimeout = window.setTimeout(() => {
        const list = getListById(currentListId);
        if (!list) return;

        const nextName = (manageListNameInput.value || '').trim();
        if (!nextName) return;

        list.name = nextName;
        list.description = (manageListDescriptionInput.value || '').trim();
        saveShoppingLists();
        renderListsTable();
        document.getElementById('items-modal-title').textContent = `Edit Shopping List: ${list.name}`;
    }, 300);
}

function toggleListActionsMenu() {
    if (!listActionsMenu || !listActionsMenuBtn) return;
    const isOpen = !listActionsMenu.hidden;
    listActionsMenu.hidden = isOpen;
    listActionsMenuBtn.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
}

function closeListActionsMenu() {
    if (!listActionsMenu || !listActionsMenuBtn) return;
    listActionsMenu.hidden = true;
    listActionsMenuBtn.setAttribute('aria-expanded', 'false');
}

function handleQuickAddSearchInput() {
    clearQuickAddSelection();
    const query = (quickAddIngredientSearchInput.value || '').trim();
    if (quickAddSearchTimeout) {
        window.clearTimeout(quickAddSearchTimeout);
    }
    if (!query) {
        hideQuickAddSearchResults();
        return;
    }
    quickAddSearchTimeout = window.setTimeout(() => {
        updateQuickAddSearchResults(query);
    }, 150);
}

function handleQuickAddSearchKeydown(event) {
    if (quickAddSearchResults.hidden) return;
    if (event.key === 'ArrowDown') {
        event.preventDefault();
        quickAddActiveIndex = Math.min(quickAddActiveIndex + 1, quickAddResults.length);
        renderQuickAddSearchResults((quickAddIngredientSearchInput.value || '').trim());
        return;
    }
    if (event.key === 'ArrowUp') {
        event.preventDefault();
        quickAddActiveIndex = Math.max(quickAddActiveIndex - 1, 0);
        renderQuickAddSearchResults((quickAddIngredientSearchInput.value || '').trim());
        return;
    }
    if (event.key === 'Enter') {
        event.preventDefault();
        if (quickAddActiveIndex >= 0 && quickAddActiveIndex < quickAddResults.length) {
            selectQuickAddIngredient(quickAddResults[quickAddActiveIndex]);
            return;
        }
        if (quickAddActiveIndex === quickAddResults.length) {
            addNewIngredientFromQuickSearch((quickAddIngredientSearchInput.value || '').trim());
        }
    }
}

function updateQuickAddSearchResults(query) {
    const normalizedQuery = query.toLowerCase();
    quickAddResults = loadMyIngredients()
        .filter((ingredient) => ingredient.name.toLowerCase().includes(normalizedQuery))
        .slice(0, 8);
    quickAddActiveIndex = quickAddResults.length > 0 ? 0 : quickAddResults.length;
    renderQuickAddSearchResults(query);
}

function renderQuickAddSearchResults(query) {
    if (!quickAddSearchResults) return;

    const itemsHtml = quickAddResults.map((ingredient, index) => {
        const isActive = index === quickAddActiveIndex ? ' active' : '';
        return `
            <button type="button" class="search-result-item${isActive}" data-index="${index}">
                <div style="font-weight: 600;">${escapeHtml(ingredient.name)}</div>
                <div style="font-size: 0.82em; color: var(--color-text-muted);">
                    ${escapeHtml(ingredient.storeSection)} • ${escapeHtml(ingredient.packageSize || 'Package: --')} • ${escapeHtml(formatMoney(ingredient.packagePrice))}
                </div>
            </button>
        `;
    }).join('');

    const noResultsHtml = quickAddResults.length === 0
        ? '<div class="search-result-item" style="color: var(--color-text-muted);">No matching ingredients</div>'
        : '';

    const addNewActive = quickAddActiveIndex === quickAddResults.length ? ' active' : '';
    quickAddSearchResults.innerHTML = `
        ${itemsHtml}
        ${noResultsHtml}
        <button type="button" class="search-result-item add-new-ingredient${addNewActive}" data-action="add-new">
            <div style="font-weight: 600;">➕ Add New Ingredient</div>
            <div style="font-size: 0.82em; color: var(--color-text-muted);">
                "${escapeHtml(query)}" not in your ingredients yet
            </div>
        </button>
    `;

    quickAddSearchResults.hidden = false;
    quickAddSearchResults.querySelectorAll('[data-index]').forEach((button) => {
        button.addEventListener('mousedown', (event) => {
            event.preventDefault();
            const index = Number.parseInt(button.dataset.index, 10);
            selectQuickAddIngredient(quickAddResults[index]);
        });
    });
    quickAddSearchResults.querySelector('[data-action="add-new"]')?.addEventListener('mousedown', (event) => {
        event.preventDefault();
        addNewIngredientFromQuickSearch(query);
    });
}

function hideQuickAddSearchResults() {
    if (!quickAddSearchResults) return;
    quickAddSearchResults.hidden = true;
    quickAddSearchResults.innerHTML = '';
    quickAddActiveIndex = -1;
}

function selectQuickAddIngredient(ingredient) {
    selectedQuickAddIngredient = ingredient;
    quickAddIngredientSearchInput.value = ingredient.name;
    quickAddSectionInput.value = ingredient.storeSection === DEFAULT_STORE_SECTION ? '' : ingredient.storeSection;
    quickAddPackageSizeEl.textContent = `Package: ${ingredient.packageSize || '--'}`;
    quickAddPackagePriceEl.textContent = `Price: ${formatMoney(ingredient.packagePrice)}`;
    quickAddItemBtn.disabled = false;
    hideQuickAddSearchResults();
}

function clearQuickAddSelection() {
    selectedQuickAddIngredient = null;
    quickAddPackageSizeEl.textContent = 'Package: --';
    quickAddPackagePriceEl.textContent = 'Price: --';
    quickAddItemBtn.disabled = true;
}

function resetQuickAddRow() {
    quickAddIngredientSearchInput.value = '';
    quickAddQuantityInput.value = '1';
    quickAddSectionInput.value = '';
    quickAddNotesInput.value = '';
    clearQuickAddSelection();
}

function addNewIngredientFromQuickSearch(query) {
    if (!query) return;
    const openListId = encodeURIComponent(String(currentListId || ''));
    const ingredientQuery = encodeURIComponent(query);
    window.location.href = `ingredients.html?openIngredientModal=1&returnTo=shopping-lists&openListId=${openListId}&ingredientQuery=${ingredientQuery}`;
}

function addItemFromQuickAdd() {
    const list = getListById(currentListId);
    if (!list) return;
    if (!selectedQuickAddIngredient) {
        notifyUser('Select an ingredient from search results first.', { type: 'warning' });
        return;
    }

    const quantity = Number.parseFloat(quickAddQuantityInput.value);
    if (!Number.isFinite(quantity) || quantity <= 0) {
        notifyUser('Quantity must be greater than 0.', { type: 'warning' });
        return;
    }

    const item = normalizeListItem({
        id: Date.now(),
        ingredientId: selectedQuickAddIngredient.id,
        name: selectedQuickAddIngredient.name,
        image: selectedQuickAddIngredient.image,
        storeSection: quickAddSectionInput.value || selectedQuickAddIngredient.storeSection,
        packageSize: selectedQuickAddIngredient.packageSize,
        packagePrice: selectedQuickAddIngredient.packagePrice,
        quantity,
        notes: quickAddNotesInput.value
    });

    list.items.push(item);
    if (!list.sectionOrder.includes(item.storeSection)) {
        list.sectionOrder.push(item.storeSection);
    }

    saveShoppingLists();
    renderListsTable();
    updateShoppingItemsDisplay();
    resetQuickAddRow();
    quickAddIngredientSearchInput.focus();
}

function getOrderedSections(list, groupedItems) {
    const groupedSections = Object.keys(groupedItems);
    const knownOrder = (list.sectionOrder || []).filter((section) => groupedSections.includes(section));
    const rest = groupedSections
        .filter((section) => !knownOrder.includes(section))
        .sort((a, b) => a.localeCompare(b));
    return [...knownOrder, ...rest];
}

function updateShoppingItemsDisplay() {
    const list = getListById(currentListId);
    if (!list || !shoppingItemsList) return;

    if (!Array.isArray(list.items) || list.items.length === 0) {
        shoppingItemsList.innerHTML = '<div class="no-items">No items yet. Search your ingredients above to add one.</div>';
        return;
    }

    const groupedItems = list.items.reduce((groups, item) => {
        const section = normalizeStoreSection(item.storeSection);
        item.storeSection = section;
        if (!groups[section]) groups[section] = [];
        groups[section].push(item);
        return groups;
    }, {});

    const orderedSections = getOrderedSections(list, groupedItems);
    list.sectionOrder = orderedSections.slice();

    shoppingItemsList.innerHTML = orderedSections.map((section) => {
        const rows = groupedItems[section].map((item) => `
            <tr data-item-id="${escapeHtml(String(item.id))}">
                <td class="shopping-item-image-cell">
                    ${item.image ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" class="shopping-item-thumb">` : '<span class="no-image">—</span>'}
                </td>
                <td>${escapeHtml(item.name)}</td>
                <td>${escapeHtml(formatPackageSize(item))}</td>
                <td>${escapeHtml(formatMoney(item.packagePrice))}</td>
                <td><input class="item-inline-input item-quantity-input" type="number" min="0.1" step="0.1" value="${escapeHtml(String(item.quantity))}" data-item-id="${escapeHtml(String(item.id))}"></td>
                <td><input class="item-inline-input item-section-input" type="text" value="${escapeHtml(item.storeSection)}" data-item-id="${escapeHtml(String(item.id))}"></td>
                <td><input class="item-inline-input item-notes-input" type="text" value="${escapeHtml(item.notes || '')}" data-item-id="${escapeHtml(String(item.id))}"></td>
                <td>
                    <button type="button" class="btn btn-delete item-delete-btn" data-item-id="${escapeHtml(String(item.id))}">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        return `
            <section class="shopping-section" draggable="true" data-section="${escapeHtml(section)}">
                <div class="shopping-section-header-row">
                    <h4 class="shopping-section-title">
                        <span class="section-drag-handle"><i class="fas fa-grip-vertical"></i></span>
                        ${escapeHtml(section)}
                    </h4>
                    <span class="shopping-section-count">${groupedItems[section].length} item(s)</span>
                </div>
                <div class="table-container">
                    <table class="ingredients-table shopping-items-table">
                        <thead>
                            <tr>
                                <th>Image</th>
                                <th>Item</th>
                                <th>Package</th>
                                <th>Price</th>
                                <th>Qty</th>
                                <th>Section</th>
                                <th>Notes</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </section>
        `;
    }).join('');

    attachItemRowListeners();
    attachSectionReorderListeners();
    saveShoppingLists();
}

function attachItemRowListeners() {
    shoppingItemsList.querySelectorAll('.item-delete-btn').forEach((button) => {
        button.addEventListener('click', async () => {
            await deleteShoppingItem(button.dataset.itemId);
        });
    });
    shoppingItemsList.querySelectorAll('.item-quantity-input').forEach((input) => {
        input.addEventListener('change', () => {
            const qty = Number.parseFloat(input.value);
            if (!Number.isFinite(qty) || qty <= 0) {
                input.value = '1';
                return;
            }
            mutateCurrentListItem(input.dataset.itemId, (item) => {
                item.quantity = qty;
            }, false);
        });
    });
    shoppingItemsList.querySelectorAll('.item-section-input').forEach((input) => {
        input.addEventListener('change', () => {
            mutateCurrentListItem(input.dataset.itemId, (item) => {
                item.storeSection = normalizeStoreSection(input.value);
            }, true);
        });
    });
    shoppingItemsList.querySelectorAll('.item-notes-input').forEach((input) => {
        input.addEventListener('change', () => {
            mutateCurrentListItem(input.dataset.itemId, (item) => {
                item.notes = (input.value || '').trim();
            }, false);
        });
    });
}

function mutateCurrentListItem(itemId, mutator, shouldRerenderSections) {
    const list = getListById(currentListId);
    if (!list) return;
    const item = list.items.find((candidate) => compareIds(candidate.id, itemId));
    if (!item) return;
    mutator(item);
    saveShoppingLists();
    renderListsTable();
    if (shouldRerenderSections) {
        updateShoppingItemsDisplay();
    }
}

async function deleteShoppingItem(itemId) {
    const list = getListById(currentListId);
    if (!list) return;

    const item = list.items.find((entry) => compareIds(entry.id, itemId));
    const itemName = item?.name ? `"${item.name}"` : 'this item';
    const confirmed = await showAlert(`Delete ${itemName} from this list?`, {
        title: 'Delete Item',
        type: 'warning',
        confirmText: 'Delete',
        cancelText: 'Keep Item'
    });
    if (!confirmed) return;

    list.items = list.items.filter((entry) => !compareIds(entry.id, itemId));
    saveShoppingLists();
    renderListsTable();
    updateShoppingItemsDisplay();
}

function attachSectionReorderListeners() {
    shoppingItemsList.querySelectorAll('.shopping-section').forEach((sectionEl) => {
        sectionEl.addEventListener('dragstart', () => {
            draggedSectionName = sectionEl.dataset.section;
            sectionEl.classList.add('is-dragging');
        });
        sectionEl.addEventListener('dragend', () => {
            draggedSectionName = null;
            sectionEl.classList.remove('is-dragging');
            shoppingItemsList.querySelectorAll('.shopping-section').forEach((node) => node.classList.remove('drag-over'));
        });
        sectionEl.addEventListener('dragover', (event) => {
            event.preventDefault();
            if (!draggedSectionName || draggedSectionName === sectionEl.dataset.section) return;
            sectionEl.classList.add('drag-over');
        });
        sectionEl.addEventListener('dragleave', () => {
            sectionEl.classList.remove('drag-over');
        });
        sectionEl.addEventListener('drop', (event) => {
            event.preventDefault();
            sectionEl.classList.remove('drag-over');
            reorderSectionBeforeTarget(draggedSectionName, sectionEl.dataset.section);
        });
    });
}

function reorderSectionBeforeTarget(sourceSection, targetSection) {
    if (!sourceSection || !targetSection || sourceSection === targetSection) return;
    const list = getListById(currentListId);
    if (!list) return;

    const order = [...(list.sectionOrder || [])];
    const sourceIndex = order.indexOf(sourceSection);
    const targetIndex = order.indexOf(targetSection);
    if (sourceIndex === -1 || targetIndex === -1) return;

    order.splice(sourceIndex, 1);
    const nextTargetIndex = order.indexOf(targetSection);
    order.splice(nextTargetIndex, 0, sourceSection);
    list.sectionOrder = order;
    saveShoppingLists();
    updateShoppingItemsDisplay();
}

function getFilteredLists() {
    return shoppingLists.filter((list) => {
        const matchesSearch = !listSearchTerm
            || (list.name || '').toLowerCase().includes(listSearchTerm)
            || (list.description || '').toLowerCase().includes(listSearchTerm);
        const itemCount = (list.items || []).length;
        const matchesFilter = !listFilter
            || (listFilter === 'with_items' && itemCount > 0)
            || (listFilter === 'empty' && itemCount === 0);
        return matchesSearch && matchesFilter;
    });
}

function getSortedLists(lists) {
    const arr = [...lists];
    arr.sort((a, b) => {
        switch (listSortColumn) {
            case 'name':
                return listSortDirection === 'asc'
                    ? (a.name || '').localeCompare(b.name || '')
                    : (b.name || '').localeCompare(a.name || '');
            case 'items':
                return listSortDirection === 'asc'
                    ? (a.items || []).length - (b.items || []).length
                    : (b.items || []).length - (a.items || []).length;
            case 'created': {
                const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return listSortDirection === 'asc' ? aTime - bTime : bTime - aTime;
            }
            default:
                return 0;
        }
    });
    return arr;
}

function updateListSortIcons() {
    const table = document.getElementById('lists-table');
    if (!table) return;
    table.querySelectorAll('th.sortable').forEach((th) => {
        const key = th.dataset.sort;
        const icon = th.querySelector('.sort-icon');
        if (!icon) return;
        if (key !== listSortColumn) {
            icon.textContent = '';
            return;
        }
        icon.textContent = listSortDirection === 'asc' ? ' ▲' : ' ▼';
    });
}

function renderListsTable() {
    if (!listsTableBody) return;
    const filtered = getFilteredLists();
    const sorted = getSortedLists(filtered);
    updateListSortIcons();
    listsTableBody.innerHTML = '';

    if (sorted.length === 0) {
        listsTableBody.innerHTML = `
            <tr>
                <td colspan="5" class="no-items">${shoppingLists.length === 0
                    ? 'No shopping lists yet. Create your first list to get started!'
                    : 'No lists match your search or filter.'}</td>
            </tr>
        `;
        return;
    }

    sorted.forEach((list) => {
        const row = document.createElement('tr');
        const itemCount = (list.items || []).length;
        const created = list.createdAt ? new Date(list.createdAt).toLocaleDateString() : '—';
        row.innerHTML = `
            <td><span class="ingredient-name-text">${escapeHtml(list.name)}</span></td>
            <td>${escapeHtml(list.description || '—')}</td>
            <td>${itemCount}</td>
            <td>${escapeHtml(created)}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-primary list-edit-btn" data-list-id="${escapeHtml(String(list.id))}">
                        <i class="fas fa-pen"></i> Edit
                    </button>
                    <button class="btn btn-secondary list-duplicate-btn" data-list-id="${escapeHtml(String(list.id))}">
                        <i class="fas fa-copy"></i> Duplicate
                    </button>
                    <button class="btn btn-delete list-delete-btn" data-list-id="${escapeHtml(String(list.id))}">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </td>
        `;
        listsTableBody.appendChild(row);
    });

    listsTableBody.querySelectorAll('.list-edit-btn').forEach((button) => {
        button.addEventListener('click', () => openManageListModal(button.dataset.listId));
    });
    listsTableBody.querySelectorAll('.list-duplicate-btn').forEach((button) => {
        button.addEventListener('click', () => duplicateShoppingList(button.dataset.listId));
    });
    listsTableBody.querySelectorAll('.list-delete-btn').forEach((button) => {
        button.addEventListener('click', async () => {
            await deleteShoppingList(button.dataset.listId);
        });
    });
}

function duplicateShoppingList(listId) {
    const source = getListById(listId);
    if (!source) return;

    const copy = normalizeShoppingList({
        ...source,
        id: Date.now(),
        name: `${source.name} (Copy)`,
        createdAt: new Date().toISOString(),
        items: source.items.map((item) => ({ ...item, id: `${Date.now()}-${Math.random()}` }))
    });

    shoppingLists.push(copy);
    saveShoppingLists();
    renderListsTable();
}

async function deleteShoppingList(listId) {
    const list = getListById(listId);
    const listName = list?.name ? `"${list.name}"` : 'this shopping list';
    const confirmed = await showAlert(`Are you sure you want to delete ${listName}?`, {
        title: 'Delete Shopping List',
        type: 'warning',
        confirmText: 'Delete',
        cancelText: 'Keep List'
    });
    if (!confirmed) return;

    shoppingLists = shoppingLists.filter((entry) => !compareIds(entry.id, listId));
    if (currentListId && compareIds(currentListId, listId)) {
        closeShoppingItemsModal();
    }
    saveShoppingLists();
    renderListsTable();
}

function printShoppingList() {
    const list = getListById(currentListId);
    if (!list) return;

    const grouped = list.items.reduce((acc, item) => {
        const section = normalizeStoreSection(item.storeSection);
        if (!acc[section]) acc[section] = [];
        acc[section].push(item);
        return acc;
    }, {});
    const sections = getOrderedSections(list, grouped);

    const itemsHtml = sections.map((section) => {
        const rows = grouped[section].map((item) => `
            <div class="shopping-item">
                <div class="checkbox"></div>
                ${item.image ? `<img src="${escapeHtml(item.image)}" class="print-item-image" alt="${escapeHtml(item.name)}">` : '<div class="print-item-image print-item-image-empty"></div>'}
                <div class="item-info">
                    <div class="item-main">
                        <span class="item-name">${escapeHtml(item.name)}</span>
                        <span class="item-amount">${escapeHtml(item.quantity)}x</span>
                    </div>
                    <div class="item-notes">${escapeHtml(item.notes || '')}</div>
                    <div class="item-notes">${escapeHtml(formatPackageSize(item))} • ${escapeHtml(formatMoney(item.packagePrice))}</div>
                </div>
            </div>
        `).join('');
        return `
            <div class="print-shopping-section">
                <h3 class="print-section-subtitle">${escapeHtml(section)}</h3>
                ${rows}
            </div>
        `;
    }).join('');

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${escapeHtml(list.name)} - Shopping List</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 0 auto; max-width: 700px; padding: 20px; color: #222; }
                .list-header { border-bottom: 2px solid #333; margin-bottom: 20px; padding-bottom: 10px; }
                .list-title { margin: 0 0 8px 0; }
                .print-shopping-section { margin-bottom: 18px; }
                .print-section-subtitle { margin: 0 0 10px 0; border-bottom: 1px solid #ddd; padding-bottom: 6px; }
                .shopping-item { display: flex; align-items: center; gap: 10px; border: 1px solid #ddd; border-radius: 6px; padding: 8px; margin-bottom: 8px; }
                .checkbox { width: 18px; height: 18px; border: 2px solid #555; border-radius: 4px; flex: 0 0 auto; }
                .print-item-image { width: 64px; height: 64px; object-fit: cover; border-radius: 6px; border: 1px solid #ddd; }
                .print-item-image-empty { background: #f3f3f3; }
                .item-info { flex: 1; }
                .item-main { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 4px; }
                .item-name { font-weight: 700; }
                .item-notes { color: #666; font-size: 0.9rem; }
            </style>
        </head>
        <body>
            <div class="list-header">
                <h1 class="list-title">${escapeHtml(list.name)}</h1>
                ${list.description ? `<p>${escapeHtml(list.description)}</p>` : ''}
                <div>${new Date(list.createdAt).toLocaleDateString()} • ${list.items.length} items</div>
            </div>
            ${itemsHtml}
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
}

function handleReturnContextFromUrl() {
    try {
        const params = new URLSearchParams(window.location.search);
        const openListId = params.get('openListId');
        const ingredientQuery = params.get('ingredientQuery');
        if (!openListId) return;

        const list = getListById(openListId);
        if (!list) return;

        openManageListModal(list.id);
        if (ingredientQuery) {
            quickAddIngredientSearchInput.value = ingredientQuery;
            updateQuickAddSearchResults(ingredientQuery);
        }
    } catch (error) {
        console.error('Error handling return context:', error);
    }
}

window.openShoppingListModal = openShoppingListModal;
window.openManageListModal = openManageListModal;
window.duplicateShoppingList = duplicateShoppingList;
window.deleteShoppingList = deleteShoppingList;

document.addEventListener('DOMContentLoaded', () => {
    applyDarkMode();
    initializeShoppingLists();
});