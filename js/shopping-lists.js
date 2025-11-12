// Shopping Lists Management
import { settings, applyDarkMode } from './settings.js';
import { showAlert } from './alert.js';

let shoppingLists = [];
let currentListId = null;
let currentEditItemId = null;
const DEFAULT_STORE_SECTION = 'Uncategorized';
const normalizeStoreSection = (section) => {
    const trimmed = (section || '').trim();
    return trimmed ? trimmed : DEFAULT_STORE_SECTION;
};
const sortStoreSections = (a, b) => {
    if (a === b) return 0;
    if (a === DEFAULT_STORE_SECTION) return 1;
    if (b === DEFAULT_STORE_SECTION) return -1;
    return a.localeCompare(b);
};

// DOM Elements (will be initialized when DOM is ready)
let addListBtn;
let shoppingListsContainer;
let shoppingListModal;
let shoppingListForm;
let shoppingItemsModal;
let addItemModal;
let addItemForm;
let addItemBtn;
let printListBtn;
let shoppingItemsList;

function parseOptionalAmount(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }
    const trimmed = String(value).trim();
    if (trimmed === '') return null;
    const numeric = parseFloat(trimmed);
    return Number.isFinite(numeric) ? numeric : null;
}

function formatItemAmount(item) {
    const amount = parseOptionalAmount(item?.amount);
    const unit = (item?.unit || '').trim();

    if (amount !== null && unit) {
        return `${amount} ${unit}`.trim();
    }

    if (amount !== null) {
        return `${amount}`;
    }

    if (unit) {
        return unit;
    }

    return '';
}

// Initialize shopping lists
function initializeShoppingLists() {
    console.log('Initializing shopping lists...');
    
    // Initialize DOM elements
    addListBtn = document.getElementById('add-list-btn');
    shoppingListsContainer = document.getElementById('shopping-lists-container');
    shoppingListModal = document.getElementById('shopping-list-modal');
    shoppingListForm = document.getElementById('shopping-list-form');
    shoppingItemsModal = document.getElementById('shopping-items-modal');
    addItemModal = document.getElementById('add-item-modal');
    addItemForm = document.getElementById('add-item-form');
    addItemBtn = document.getElementById('add-item-btn');
    printListBtn = document.getElementById('print-list-btn');
    shoppingItemsList = document.getElementById('shopping-items-list');
    
    console.log('DOM elements initialized:', {
        addListBtn: !!addListBtn,
        shoppingListsContainer: !!shoppingListsContainer,
        shoppingListForm: !!shoppingListForm
    });
    
    loadShoppingLists();
    console.log('Loaded shopping lists:', shoppingLists);
    setupEventListeners();
    updateShoppingListsDisplay();
}

// Setup event listeners
function setupEventListeners() {
    console.log('Setting up event listeners...');
    console.log('addListBtn:', addListBtn);
    
    // Shopping list modal
    if (addListBtn) {
        addListBtn.addEventListener('click', () => {
            console.log('Add list button clicked!');
            openShoppingListModal();
        });
    } else {
        console.error('addListBtn not found!');
    }
    document.querySelector('#shopping-list-modal .close')?.addEventListener('click', closeShoppingListModal);
    document.getElementById('cancel-list')?.addEventListener('click', closeShoppingListModal);
    shoppingListForm?.addEventListener('submit', handleShoppingListSubmit);
    
    // Shopping items modal
    document.querySelector('#shopping-items-modal .close')?.addEventListener('click', closeShoppingItemsModal);
    addItemBtn?.addEventListener('click', () => openAddItemModal());
    printListBtn?.addEventListener('click', printShoppingList);
    
    // Add item modal
    document.querySelector('#add-item-modal .close')?.addEventListener('click', closeAddItemModal);
    document.getElementById('cancel-item')?.addEventListener('click', closeAddItemModal);
    addItemForm?.addEventListener('submit', handleAddItemSubmit);
    
    // Save list details button
    document.getElementById('save-list-details-btn')?.addEventListener('click', handleSaveListDetails);
}

// Shopping List Management
function openShoppingListModal(listId = null) {
    console.log('openShoppingListModal called with listId:', listId);
    // Ensure currentListId is properly set to null for new lists
    currentListId = listId || null;
    console.log('currentListId set to:', currentListId);
    
    const modal = document.getElementById('shopping-list-modal');
    const title = document.getElementById('list-modal-title');
    const form = document.getElementById('shopping-list-form');
    
    console.log('Modal elements found:', {
        modal: !!modal,
        title: !!title,
        form: !!form
    });
    
    if (listId) {
        // Edit existing list
        const list = shoppingLists.find(l => l.id === listId);
        if (list) {
            title.textContent = 'Edit Shopping List';
            document.getElementById('list-name').value = list.name;
            document.getElementById('list-description').value = list.description || '';
        }
    } else {
        // Create new list
        title.textContent = 'Create New Shopping List';
        form.reset();
    }
    
    modal.classList.add('active');
}

function closeShoppingListModal() {
    const modal = document.getElementById('shopping-list-modal');
    modal.classList.remove('active');
    currentListId = null;
}

function handleShoppingListSubmit(e) {
    e.preventDefault();
    console.log('Form submitted!');
    console.log('currentListId before processing:', currentListId);
    console.log('currentListId type:', typeof currentListId);
    
    const name = document.getElementById('list-name').value.trim();
    const description = document.getElementById('list-description').value.trim();
    
    console.log('Form data:', { name, description, currentListId });
    
    if (!name) {
        showAlert('Please enter a list name', { type: 'warning' });
        return;
    }
    
    // Ensure currentListId is properly handled
    const listId = currentListId && typeof currentListId === 'number' ? currentListId : null;
    console.log('Processed listId:', listId);
    
    if (listId) {
        console.log('Updating existing list');
        // Update existing list
        const index = shoppingLists.findIndex(l => l.id === listId);
        if (index !== -1) {
            shoppingLists[index] = {
                ...shoppingLists[index],
                name,
                description
            };
        }
    } else {
        console.log('Creating new list');
        // Create new list
        const newList = {
            id: Date.now(),
            name,
            description,
            items: [],
            createdAt: new Date().toISOString()
        };
        shoppingLists.push(newList);
        console.log('New list created:', newList);
        console.log('Total lists after creation:', shoppingLists.length);
    }
    
    console.log('Saving shopping lists...');
    saveShoppingLists();
    console.log('Updating display...');
    updateShoppingListsDisplay();
    console.log('Closing modal...');
    closeShoppingListModal();
}

// Shopping Items Management
function openManageListModal(listId) {
    console.log('Opening manage list modal for listId:', listId);
    currentListId = listId;
    const list = shoppingLists.find(l => l.id === listId);
    if (!list) {
        console.error('List not found for ID:', listId);
        return;
    }
    
    console.log('Found list:', list);
    
    const modal = document.getElementById('shopping-items-modal');
    const title = document.getElementById('items-modal-title');
    const listNameInput = document.getElementById('manage-list-name');
    const listDescriptionInput = document.getElementById('manage-list-description');
    
    title.textContent = `Edit Shopping List: ${list.name}`;
    listNameInput.value = list.name;
    listDescriptionInput.value = list.description || '';
    
    updateShoppingItemsDisplay();
    modal.classList.add('active');
    console.log('Manage list modal opened successfully');
}

function closeShoppingItemsModal() {
    const modal = document.getElementById('shopping-items-modal');
    modal.classList.remove('active');
    currentListId = null;
}

function updateShoppingItemsDisplay() {
    if (!currentListId) return;
    
    const list = shoppingLists.find(l => l.id === currentListId);
    if (!list) return;
    
    shoppingItemsList.innerHTML = '';
    
    if (list.items.length === 0) {
        shoppingItemsList.innerHTML = '<div class="no-items">No items in this list. Click "Add Item" to get started.</div>';
        return;
    }
    
    const groupedItems = list.items.reduce((groups, item) => {
        const section = normalizeStoreSection(item.storeSection);
        item.storeSection = section;
        if (!groups[section]) {
            groups[section] = [];
        }
        groups[section].push(item);
        return groups;
    }, {});
    
    const sortedSections = Object.keys(groupedItems).sort(sortStoreSections);
    
    sortedSections.forEach(section => {
        const sectionContainer = document.createElement('div');
        sectionContainer.className = 'shopping-section';
        
        const sectionHeader = document.createElement('h4');
        sectionHeader.className = 'shopping-section-title';
        sectionHeader.textContent = section;
        sectionContainer.appendChild(sectionHeader);
        
        const itemsContainer = document.createElement('div');
        itemsContainer.className = 'shopping-section-items';
        
        groupedItems[section]
            .sort((a, b) => a.name.localeCompare(b.name))
            .forEach(item => {
                const itemElement = createShoppingItemElement(item);
                itemsContainer.appendChild(itemElement);
            });
        
        sectionContainer.appendChild(itemsContainer);
        shoppingItemsList.appendChild(sectionContainer);
    });
}

function createShoppingItemElement(item) {
    const div = document.createElement('div');
    div.className = 'shopping-item';
    div.dataset.itemId = item.id;
    div.dataset.storeSection = normalizeStoreSection(item.storeSection);
    
    const amountText = formatItemAmount(item);
    
    div.innerHTML = `
        <div class="item-info">
            <div class="item-main">
                <span class="item-name">${item.name}</span>
                ${amountText ? `<span class="item-amount">${amountText}</span>` : ''}
            </div>
            ${item.notes ? `<div class="item-notes">${item.notes}</div>` : ''}
        </div>
        <div class="item-actions">
            <button class="btn btn-edit" onclick="editShoppingItem(${item.id})">
                <i class="fas fa-edit"></i>
            </button>
            <button class="btn btn-delete" onclick="deleteShoppingItem(${item.id})">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
    
    return div;
}

function openAddItemModal(itemId = null) {
    currentEditItemId = itemId;
    const modal = document.getElementById('add-item-modal');
    const form = document.getElementById('add-item-form');
    const storeSectionInput = document.getElementById('item-store-section');
    
    if (itemId) {
        // Edit existing item
        const list = shoppingLists.find(l => l.id === currentListId);
        const item = list?.items.find(i => i.id === itemId);
        if (item) {
            document.getElementById('item-name').value = item.name;
            document.getElementById('item-amount').value = parseOptionalAmount(item.amount) ?? '';
            document.getElementById('item-unit').value = item.unit || 'g';
            document.getElementById('item-notes').value = item.notes || '';
            if (storeSectionInput) {
                storeSectionInput.value = item.storeSection || '';
            }
        }
    } else {
        // Add new item
        form.reset();
        document.getElementById('item-amount').value = '';
        if (storeSectionInput) {
            storeSectionInput.value = '';
        }
    }
    
    modal.classList.add('active');
}

function closeAddItemModal() {
    const modal = document.getElementById('add-item-modal');
    modal.classList.remove('active');
    currentEditItemId = null;
}

function handleSaveListDetails() {
    console.log('Saving list details...');
    if (!currentListId) {
        console.error('No current list ID');
        return;
    }
    
    const listName = document.getElementById('manage-list-name').value.trim();
    const listDescription = document.getElementById('manage-list-description').value.trim();
    
    console.log('New list details:', { listName, listDescription });
    
    if (!listName) {
        showAlert('Please enter a list name', { type: 'warning' });
        return;
    }
    
    const listIndex = shoppingLists.findIndex(l => l.id === currentListId);
    if (listIndex === -1) {
        console.error('List not found for updating');
        return;
    }
    
    shoppingLists[listIndex] = {
        ...shoppingLists[listIndex],
        name: listName,
        description: listDescription
    };
    
    console.log('Updated list:', shoppingLists[listIndex]);
    
    saveShoppingLists();
    updateShoppingListsDisplay();
    
    // Update the modal title
    const title = document.getElementById('items-modal-title');
    title.textContent = `Edit Shopping List: ${listName}`;
    
    showAlert('List details saved successfully!', { type: 'success' });
}

function handleAddItemSubmit(e) {
    e.preventDefault();
    
    if (!currentListId) return;
    
    const name = document.getElementById('item-name').value.trim();
    const amountInput = document.getElementById('item-amount').value.trim();
    const unit = document.getElementById('item-unit').value;
    const notes = document.getElementById('item-notes').value.trim();
    const storeSectionInput = document.getElementById('item-store-section');
    const storeSection = normalizeStoreSection(storeSectionInput ? storeSectionInput.value : '');
    
    const parsedAmount = amountInput === '' ? null : parseFloat(amountInput);
    
    if (!name) {
        showAlert('Please enter an item name', { type: 'warning' });
        return;
    }
    
    if (amountInput !== '' && (isNaN(parsedAmount) || parsedAmount <= 0)) {
        showAlert('Please enter a valid amount greater than 0, or leave it blank', { type: 'warning' });
        return;
    }
    
    const listIndex = shoppingLists.findIndex(l => l.id === currentListId);
    if (listIndex === -1) return;
    
    if (currentEditItemId) {
        // Update existing item
        const itemIndex = shoppingLists[listIndex].items.findIndex(i => i.id === currentEditItemId);
        if (itemIndex !== -1) {
            shoppingLists[listIndex].items[itemIndex] = {
                ...shoppingLists[listIndex].items[itemIndex],
                name,
                amount: parsedAmount,
                unit,
                notes,
                storeSection
            };
        }
    } else {
        // Add new item
        const newItem = {
            id: Date.now(),
            name,
            amount: parsedAmount,
            unit,
            notes,
            storeSection,
            addedAt: new Date().toISOString()
        };
        shoppingLists[listIndex].items.push(newItem);
    }
    
    saveShoppingLists();
    updateShoppingItemsDisplay();
    closeAddItemModal();
}

// Shopping List Display
function updateShoppingListsDisplay() {
    console.log('updateShoppingListsDisplay called');
    console.log('shoppingListsContainer:', shoppingListsContainer);
    console.log('shoppingLists:', shoppingLists);
    
    if (!shoppingListsContainer) {
        console.error('shoppingListsContainer not found!');
        return;
    }
    
    shoppingListsContainer.innerHTML = '';
    
    if (shoppingLists.length === 0) {
        console.log('No shopping lists, showing empty state');
        shoppingListsContainer.innerHTML = `
            <div class="no-lists">
                <p>No shopping lists yet. Create your first list to get started!</p>
            </div>
        `;
        return;
    }
    
    console.log('Displaying', shoppingLists.length, 'shopping lists');
    shoppingLists.forEach((list, index) => {
        console.log(`Creating element for list ${index}:`, list);
        const listElement = createShoppingListElement(list);
        shoppingListsContainer.appendChild(listElement);
        console.log(`List ${index} element added to container`);
    });
}

function createShoppingListElement(list) {
    const div = document.createElement('div');
    div.className = 'shopping-list-card';
    
    const itemCount = list.items.length;
    const totalItems = list.items.reduce((sum, item) => {
        const amount = parseOptionalAmount(item.amount);
        return sum + (amount ?? 0);
    }, 0);
    
    div.innerHTML = `
        <div class="list-header">
            <h3>${list.name}</h3>
            <div class="list-meta">
                <span class="item-count">${itemCount} items</span>
                <span class="created-date">${new Date(list.createdAt).toLocaleDateString()}</span>
            </div>
        </div>
        
        ${list.description ? `<p class="list-description">${list.description}</p>` : ''}
        
        <div class="list-actions">
            <button class="btn btn-primary" onclick="openManageListModal(${list.id})">
                <i class="fas fa-pen"></i> Edit
            </button>
            <button class="btn btn-secondary" onclick="duplicateShoppingList(${list.id})">
                <i class="fas fa-copy"></i> Duplicate
            </button>
            <button class="btn btn-delete" onclick="deleteShoppingList(${list.id})">
                <i class="fas fa-trash"></i> Delete
            </button>
        </div>
    `;
    
    // Make entire card clickable (excluding buttons)
    div.addEventListener('click', (event) => {
        if (event.target.closest('button')) {
            return;
        }
        openManageListModal(list.id);
    });
    
    return div;
}

// Shopping List Operations
function duplicateShoppingList(listId) {
    const originalList = shoppingLists.find(l => l.id === listId);
    if (!originalList) return;
    
    const duplicatedList = {
        ...originalList,
        id: Date.now(),
        name: `${originalList.name} (Copy)`,
        createdAt: new Date().toISOString(),
        items: originalList.items.map(item => ({
            ...item,
            id: Date.now() + Math.random(),
            addedAt: new Date().toISOString()
        }))
    };
    
    shoppingLists.push(duplicatedList);
    saveShoppingLists();
    updateShoppingListsDisplay();
}

function deleteShoppingList(listId) {
    if (!confirm('Are you sure you want to delete this shopping list?')) return;
    
    shoppingLists = shoppingLists.filter(l => l.id !== listId);
    saveShoppingLists();
    updateShoppingListsDisplay();
}

function editShoppingItem(itemId) {
    openAddItemModal(itemId);
}

function deleteShoppingItem(itemId) {
    if (!currentListId) return;
    
    if (!confirm('Are you sure you want to delete this item?')) return;
    
    const listIndex = shoppingLists.findIndex(l => l.id === currentListId);
    if (listIndex === -1) return;
    
    shoppingLists[listIndex].items = shoppingLists[listIndex].items.filter(i => i.id !== itemId);
    saveShoppingLists();
    updateShoppingItemsDisplay();
}



// Print Shopping List
function printShoppingList() {
    if (!currentListId) return;
    
    const list = shoppingLists.find(l => l.id === currentListId);
    if (!list) return;
    
    const printWindow = window.open('', '_blank');
    const groupedItems = list.items.reduce((groups, item) => {
        const section = normalizeStoreSection(item.storeSection);
        if (!groups[section]) {
            groups[section] = [];
        }
        groups[section].push(item);
        return groups;
    }, {});
    
    const sortedSections = Object.keys(groupedItems).sort(sortStoreSections);
    
    const itemsHtml = sortedSections.map(section => {
        const sectionItems = groupedItems[section]
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name));
        const sectionItemsHtml = sectionItems.map(item => {
            const amountText = formatItemAmount(item);
            return `
                    <div class="shopping-item">
                        <div class="checkbox"></div>
                        <div class="item-info">
                            <div class="item-main">
                                <span class="item-name">${item.name}</span>
                                ${amountText ? `<span class="item-amount">${amountText}</span>` : ''}
                            </div>
                            ${item.notes ? `<div class="item-notes">${item.notes}</div>` : ''}
                        </div>
                    </div>
                `;
        }).join('');
        
        return `
                <div class="print-shopping-section">
                    <h3 class="print-section-subtitle">${section}</h3>
                    ${sectionItemsHtml}
                </div>
            `;
    }).join('');
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${list.name} - Shopping List</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                }
                .list-header {
                    text-align: center;
                    border-bottom: 3px solid #4CAF50;
                    padding-bottom: 20px;
                    margin-bottom: 30px;
                }
                .list-title {
                    font-size: 2rem;
                    color: #4CAF50;
                    margin: 0 0 10px 0;
                }
                .list-description {
                    color: #666;
                    font-style: italic;
                }
                .list-meta {
                    margin-top: 10px;
                    color: #888;
                    font-size: 0.9rem;
                }
                .items-section {
                    margin-bottom: 30px;
                }
                .section-title {
                    font-size: 1.5rem;
                    color: #4CAF50;
                    border-bottom: 2px solid #4CAF50;
                    padding-bottom: 10px;
                    margin-bottom: 20px;
                }
                .shopping-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 15px;
                    margin-bottom: 10px;
                    background: #f8f9fa;
                    border-radius: 6px;
                    border: 1px solid #dee2e6;
                }
                .item-info {
                    flex: 1;
                }
                .item-main {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 5px;
                }
                .item-name {
                    font-weight: 600;
                    font-size: 1.1rem;
                }
                .item-amount {
                    font-weight: 600;
                    color: #4CAF50;
                }
                .item-notes {
                    font-size: 0.9rem;
                    color: #666;
                    font-style: italic;
                }
                .checkbox {
                    width: 20px;
                    height: 20px;
                    border: 2px solid #4CAF50;
                    border-radius: 4px;
                    margin-right: 15px;
                }
                @media print {
                    body { margin: 0; padding: 15px; }
                    .list-header { border-bottom-color: #000; }
                    .section-title { border-bottom-color: #000; color: #000; }
                    .item-amount { color: #000; }
                    .list-title { color: #000; }
                }
            </style>
        </head>
        <body>
            <div class="list-header">
                <h1 class="list-title">${list.name}</h1>
                ${list.description ? `<p class="list-description">${list.description}</p>` : ''}
                <div class="list-meta">
                    Created: ${new Date(list.createdAt).toLocaleDateString()} | 
                    ${list.items.length} items
                </div>
            </div>
            
            <div class="items-section">
                <h2 class="section-title">Shopping Items</h2>
                ${itemsHtml}
            </div>
        </body>
        </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
        printWindow.print();
    }, 500);
}

// Local Storage Management
function loadShoppingLists() {
    try {
        const data = localStorage.getItem('shoppingLists');
        if (data) {
            shoppingLists = JSON.parse(data).map(list => ({
                ...list,
                items: Array.isArray(list.items)
                    ? list.items.map(item => ({
                        ...item,
                        storeSection: normalizeStoreSection(item.storeSection)
                    }))
                    : []
            }));
        }
    } catch (error) {
        console.error('Error loading shopping lists:', error);
        shoppingLists = [];
    }
}

function saveShoppingLists() {
    try {
        localStorage.setItem('shoppingLists', JSON.stringify(shoppingLists));
    } catch (error) {
        console.error('Error saving shopping lists:', error);
    }
}

// Make functions globally available immediately
window.openShoppingListModal = openShoppingListModal;
window.openManageListModal = openManageListModal;
window.duplicateShoppingList = duplicateShoppingList;
window.deleteShoppingList = deleteShoppingList;
window.editShoppingItem = editShoppingItem;
window.deleteShoppingItem = deleteShoppingItem;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing shopping lists...');
    // Apply dark mode on page load
    applyDarkMode();
    initializeShoppingLists();
}); 