// Shopping Lists Management
let shoppingLists = [];
let currentListId = null;
let currentEditItemId = null;

// DOM Elements
const addListBtn = document.getElementById('add-list-btn');
const shoppingListsContainer = document.getElementById('shopping-lists-container');
const shoppingListModal = document.getElementById('shopping-list-modal');
const shoppingListForm = document.getElementById('shopping-list-form');
const shoppingItemsModal = document.getElementById('shopping-items-modal');
const addItemModal = document.getElementById('add-item-modal');
const addItemForm = document.getElementById('add-item-form');
const addItemBtn = document.getElementById('add-item-btn');
const printListBtn = document.getElementById('print-list-btn');
const shoppingItemsList = document.getElementById('shopping-items-list');

// Initialize shopping lists
function initializeShoppingLists() {
    console.log('Initializing shopping lists...');
    loadShoppingLists();
    setupEventListeners();
    updateShoppingListsDisplay();
}

// Setup event listeners
function setupEventListeners() {
    console.log('Setting up event listeners...');
    console.log('addListBtn:', addListBtn);
    
    // Shopping list modal
    addListBtn?.addEventListener('click', openShoppingListModal);
    document.querySelector('#shopping-list-modal .close')?.addEventListener('click', closeShoppingListModal);
    document.getElementById('cancel-list')?.addEventListener('click', closeShoppingListModal);
    
    console.log('shoppingListForm:', shoppingListForm);
    shoppingListForm?.addEventListener('submit', handleShoppingListSubmit);
    
    // Shopping items modal
    document.querySelector('#shopping-items-modal .close')?.addEventListener('click', closeShoppingItemsModal);
    addItemBtn?.addEventListener('click', openAddItemModal);
    printListBtn?.addEventListener('click', printShoppingList);
    
    // Add item modal
    document.querySelector('#add-item-modal .close')?.addEventListener('click', closeAddItemModal);
    document.getElementById('cancel-item')?.addEventListener('click', closeAddItemModal);
    addItemForm?.addEventListener('submit', handleAddItemSubmit);
    

}

// Shopping List Management
function openShoppingListModal(listId = null) {
    console.log('Opening shopping list modal, listId:', listId);
    currentListId = listId;
    const modal = document.getElementById('shopping-list-modal');
    const title = document.getElementById('list-modal-title');
    const form = document.getElementById('shopping-list-form');
    
    console.log('Modal elements:', { modal, title, form });
    
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
    console.log('Shopping list form submitted!');
    e.preventDefault();
    
    const name = document.getElementById('list-name').value.trim();
    const description = document.getElementById('list-description').value.trim();
    
    console.log('Form data:', { name, description });
    
    if (!name) {
        alert('Please enter a list name');
        return;
    }
    
    if (currentListId) {
        // Update existing list
        const index = shoppingLists.findIndex(l => l.id === currentListId);
        if (index !== -1) {
            shoppingLists[index] = {
                ...shoppingLists[index],
                name,
                description
            };
        }
    } else {
        // Create new list
        const newList = {
            id: Date.now(),
            name,
            description,
            items: [],
            createdAt: new Date().toISOString()
        };
        shoppingLists.push(newList);
        console.log('Created new list:', newList);
    }
    
    console.log('Shopping lists after save:', shoppingLists);
    saveShoppingLists();
    updateShoppingListsDisplay();
    closeShoppingListModal();
}

// Shopping Items Management
function openShoppingItemsModal(listId) {
    currentListId = listId;
    const list = shoppingLists.find(l => l.id === listId);
    if (!list) return;
    
    const modal = document.getElementById('shopping-items-modal');
    const title = document.getElementById('items-modal-title');
    const listName = document.getElementById('current-list-name');
    const listDescription = document.getElementById('current-list-description');
    
    title.textContent = `Shopping List: ${list.name}`;
    listName.textContent = list.name;
    listDescription.textContent = list.description || 'No description';
    
    updateShoppingItemsDisplay();
    modal.classList.add('active');
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
    
    list.items.forEach(item => {
        const itemElement = createShoppingItemElement(item);
        shoppingItemsList.appendChild(itemElement);
    });
}

function createShoppingItemElement(item) {
    const div = document.createElement('div');
    div.className = 'shopping-item';
    div.dataset.itemId = item.id;
    
    div.innerHTML = `
        <div class="item-info">
            <div class="item-main">
                <span class="item-name">${item.name}</span>
                <span class="item-amount">${item.amount} ${item.unit}</span>
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
    
    if (itemId) {
        // Edit existing item
        const list = shoppingLists.find(l => l.id === currentListId);
        const item = list?.items.find(i => i.id === itemId);
        if (item) {
            document.getElementById('item-name').value = item.name;
            document.getElementById('item-amount').value = item.amount;
            document.getElementById('item-unit').value = item.unit;
            document.getElementById('item-notes').value = item.notes || '';
        }
    } else {
        // Add new item
        form.reset();
    }
    
    modal.classList.add('active');
}

function closeAddItemModal() {
    const modal = document.getElementById('add-item-modal');
    modal.classList.remove('active');
    currentEditItemId = null;
}

function handleAddItemSubmit(e) {
    e.preventDefault();
    
    if (!currentListId) return;
    
    const name = document.getElementById('item-name').value.trim();
    const amount = parseFloat(document.getElementById('item-amount').value);
    const unit = document.getElementById('item-unit').value;
    const notes = document.getElementById('item-notes').value.trim();
    
    if (!name || isNaN(amount) || amount <= 0) {
        alert('Please enter valid item details');
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
                amount,
                unit,
                notes
            };
        }
    } else {
        // Add new item
        const newItem = {
            id: Date.now(),
            name,
            amount,
            unit,
            notes,
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
    console.log('Updating shopping lists display...');
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
    
    console.log(`Creating ${shoppingLists.length} list elements`);
    shoppingLists.forEach(list => {
        const listElement = createShoppingListElement(list);
        shoppingListsContainer.appendChild(listElement);
    });
}

function createShoppingListElement(list) {
    const div = document.createElement('div');
    div.className = 'shopping-list-card';
    
    const itemCount = list.items.length;
    const totalItems = list.items.reduce((sum, item) => sum + item.amount, 0);
    
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
            <button class="btn btn-primary" onclick="openShoppingItemsModal(${list.id})">
                <i class="fas fa-eye"></i> View Items
            </button>
            <button class="btn btn-secondary" onclick="duplicateShoppingList(${list.id})">
                <i class="fas fa-copy"></i> Duplicate
            </button>
            <button class="btn btn-edit" onclick="openShoppingListModal(${list.id})">
                <i class="fas fa-edit"></i> Edit
            </button>
            <button class="btn btn-delete" onclick="deleteShoppingList(${list.id})">
                <i class="fas fa-trash"></i> Delete
            </button>
        </div>
    `;
    
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
                ${list.items.map(item => `
                    <div class="shopping-item">
                        <div class="checkbox"></div>
                        <div class="item-info">
                            <div class="item-main">
                                <span class="item-name">${item.name}</span>
                                <span class="item-amount">${item.amount} ${item.unit}</span>
                            </div>
                            ${item.notes ? `<div class="item-notes">${item.notes}</div>` : ''}
                        </div>
                    </div>
                `).join('')}
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
            shoppingLists = JSON.parse(data);
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

// Make functions globally available
window.openShoppingListModal = openShoppingListModal;
window.openShoppingItemsModal = openShoppingItemsModal;
window.duplicateShoppingList = duplicateShoppingList;
window.deleteShoppingList = deleteShoppingList;
window.editShoppingItem = editShoppingItem;
window.deleteShoppingItem = deleteShoppingItem;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeShoppingLists); 