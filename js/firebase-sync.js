// Firebase Sync Service
// Handles syncing all app data to/from Firestore

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
    getFirestore, 
    collection, 
    doc, 
    setDoc, 
    getDoc, 
    getDocs,
    deleteDoc,
    onSnapshot,
    serverTimestamp,
    writeBatch
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { firebaseConfig, ENABLE_FIREBASE } from './firebase-config.js';
import { getCurrentUser, onAuthChange } from './firebase-auth.js';
import { showAlert } from './alert.js';

let db = null;
let syncListeners = {
    recipes: [],
    mealPlan: [],
    nutritionLogs: [],
    shoppingLists: [],
    customIngredients: [],
    settings: []
};

// Initialize Firestore if enabled
if (ENABLE_FIREBASE) {
    try {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        console.log('Firestore initialized successfully');
    } catch (error) {
        console.error('Error initializing Firestore:', error);
    }
}

/**
 * Get the user's data collection path
 * @param {string} collectionName - Name of the collection
 * @returns {string} Collection path
 */
function getUserCollectionPath(collectionName) {
    const user = getCurrentUser();
    if (!user) {
        throw new Error('User must be authenticated to sync data');
    }
    return `users/${user.uid}/${collectionName}`;
}

/**
 * Sync recipes to Firestore
 * @param {Array} recipes - Array of recipe objects
 * @returns {Promise<void>}
 */
export async function syncRecipes(recipes) {
    if (!ENABLE_FIREBASE || !db || !getCurrentUser()) {
        return;
    }
    
    try {
        const batch = writeBatch(db);
        const recipesRef = collection(db, getUserCollectionPath('recipes'));
        
        // Get existing recipes to delete ones that no longer exist
        const existingSnapshot = await getDocs(recipesRef);
        const existingIds = new Set(existingSnapshot.docs.map(d => d.id));
        const currentIds = new Set(recipes.map(r => r.id.toString()));
        
        // Delete removed recipes
        existingSnapshot.docs.forEach(docSnap => {
            if (!currentIds.has(docSnap.id)) {
                batch.delete(docSnap.ref);
            }
        });
        
        // Add/update recipes
        recipes.forEach(recipe => {
            const recipeRef = doc(db, getUserCollectionPath('recipes'), recipe.id.toString());
            batch.set(recipeRef, {
                ...recipe,
                updatedAt: serverTimestamp()
            });
        });
        
        await batch.commit();
        console.log('Recipes synced successfully');
    } catch (error) {
        console.error('Error syncing recipes:', error);
        throw error;
    }
}

/**
 * Load recipes from Firestore
 * @returns {Promise<Array>} Array of recipes
 */
export async function loadRecipes() {
    if (!ENABLE_FIREBASE || !db || !getCurrentUser()) {
        return [];
    }
    
    try {
        const recipesRef = collection(db, getUserCollectionPath('recipes'));
        const snapshot = await getDocs(recipesRef);
        return snapshot.docs.map(doc => doc.data());
    } catch (error) {
        console.error('Error loading recipes:', error);
        return [];
    }
}

/**
 * Sync meal plan to Firestore
 * @param {Object} mealPlan - Meal plan object
 * @returns {Promise<void>}
 */
export async function syncMealPlan(mealPlan) {
    if (!ENABLE_FIREBASE || !db || !getCurrentUser()) {
        return;
    }
    
    try {
        const mealPlanRef = doc(db, getUserCollectionPath('data'), 'mealPlan');
        await setDoc(mealPlanRef, {
            data: mealPlan,
            updatedAt: serverTimestamp()
        });
        console.log('Meal plan synced successfully');
    } catch (error) {
        console.error('Error syncing meal plan:', error);
        throw error;
    }
}

/**
 * Load meal plan from Firestore
 * @returns {Promise<Object>} Meal plan object
 */
export async function loadMealPlan() {
    if (!ENABLE_FIREBASE || !db || !getCurrentUser()) {
        return {};
    }
    
    try {
        const mealPlanRef = doc(db, getUserCollectionPath('data'), 'mealPlan');
        const snapshot = await getDoc(mealPlanRef);
        return snapshot.exists() ? (snapshot.data().data || {}) : {};
    } catch (error) {
        console.error('Error loading meal plan:', error);
        return {};
    }
}

/**
 * Sync nutrition logs to Firestore
 * @param {Object} nutritionLogs - Nutrition logs object
 * @returns {Promise<void>}
 */
export async function syncNutritionLogs(nutritionLogs) {
    if (!ENABLE_FIREBASE || !db || !getCurrentUser()) {
        return;
    }
    
    try {
        const nutritionRef = doc(db, getUserCollectionPath('data'), 'nutritionLogs');
        await setDoc(nutritionRef, {
            data: nutritionLogs,
            updatedAt: serverTimestamp()
        });
        console.log('Nutrition logs synced successfully');
    } catch (error) {
        console.error('Error syncing nutrition logs:', error);
        throw error;
    }
}

/**
 * Load nutrition logs from Firestore
 * @returns {Promise<Object>} Nutrition logs object
 */
export async function loadNutritionLogs() {
    if (!ENABLE_FIREBASE || !db || !getCurrentUser()) {
        return {};
    }
    
    try {
        const nutritionRef = doc(db, getUserCollectionPath('data'), 'nutritionLogs');
        const snapshot = await getDoc(nutritionRef);
        return snapshot.exists() ? (snapshot.data().data || {}) : {};
    } catch (error) {
        console.error('Error loading nutrition logs:', error);
        return {};
    }
}

/**
 * Sync shopping lists to Firestore
 * @param {Array} shoppingLists - Array of shopping list objects
 * @returns {Promise<void>}
 */
export async function syncShoppingLists(shoppingLists) {
    if (!ENABLE_FIREBASE || !db || !getCurrentUser()) {
        return;
    }
    
    try {
        const batch = writeBatch(db);
        const listsRef = collection(db, getUserCollectionPath('shoppingLists'));
        
        // Get existing lists
        const existingSnapshot = await getDocs(listsRef);
        const existingIds = new Set(existingSnapshot.docs.map(d => d.id));
        const currentIds = new Set(shoppingLists.map(l => l.id.toString()));
        
        // Delete removed lists
        existingSnapshot.docs.forEach(docSnap => {
            if (!currentIds.has(docSnap.id)) {
                batch.delete(docSnap.ref);
            }
        });
        
        // Add/update lists
        shoppingLists.forEach(list => {
            const listRef = doc(db, getUserCollectionPath('shoppingLists'), list.id.toString());
            batch.set(listRef, {
                ...list,
                updatedAt: serverTimestamp()
            });
        });
        
        await batch.commit();
        console.log('Shopping lists synced successfully');
    } catch (error) {
        console.error('Error syncing shopping lists:', error);
        throw error;
    }
}

/**
 * Load shopping lists from Firestore
 * @returns {Promise<Array>} Array of shopping lists
 */
export async function loadShoppingLists() {
    if (!ENABLE_FIREBASE || !db || !getCurrentUser()) {
        return [];
    }
    
    try {
        const listsRef = collection(db, getUserCollectionPath('shoppingLists'));
        const snapshot = await getDocs(listsRef);
        return snapshot.docs.map(doc => doc.data());
    } catch (error) {
        console.error('Error loading shopping lists:', error);
        return [];
    }
}

/**
 * Sync custom ingredients to Firestore
 * @param {Array} customIngredients - Array of custom ingredient objects
 * @returns {Promise<void>}
 */
export async function syncCustomIngredients(customIngredients) {
    if (!ENABLE_FIREBASE || !db || !getCurrentUser()) {
        return;
    }
    
    try {
        const batch = writeBatch(db);
        const ingredientsRef = collection(db, getUserCollectionPath('customIngredients'));
        
        // Get existing ingredients
        const existingSnapshot = await getDocs(ingredientsRef);
        const existingIds = new Set(existingSnapshot.docs.map(d => d.id));
        const currentIds = new Set(customIngredients.map(i => i.id.toString()));
        
        // Delete removed ingredients
        existingSnapshot.docs.forEach(docSnap => {
            if (!currentIds.has(docSnap.id)) {
                batch.delete(docSnap.ref);
            }
        });
        
        // Add/update ingredients
        customIngredients.forEach(ingredient => {
            const ingredientRef = doc(db, getUserCollectionPath('customIngredients'), ingredient.id.toString());
            batch.set(ingredientRef, {
                ...ingredient,
                updatedAt: serverTimestamp()
            });
        });
        
        await batch.commit();
        console.log('Custom ingredients synced successfully');
    } catch (error) {
        console.error('Error syncing custom ingredients:', error);
        throw error;
    }
}

/**
 * Load custom ingredients from Firestore
 * @returns {Promise<Array>} Array of custom ingredients
 */
export async function loadCustomIngredients() {
    if (!ENABLE_FIREBASE || !db || !getCurrentUser()) {
        return [];
    }
    
    try {
        const ingredientsRef = collection(db, getUserCollectionPath('customIngredients'));
        const snapshot = await getDocs(ingredientsRef);
        return snapshot.docs.map(doc => doc.data());
    } catch (error) {
        console.error('Error loading custom ingredients:', error);
        return [];
    }
}

/**
 * Sync settings to Firestore
 * @param {Object} settings - Settings object
 * @returns {Promise<void>}
 */
export async function syncSettings(settings) {
    if (!ENABLE_FIREBASE || !db || !getCurrentUser()) {
        return;
    }
    
    try {
        const settingsRef = doc(db, getUserCollectionPath('data'), 'settings');
        await setDoc(settingsRef, {
            data: settings,
            updatedAt: serverTimestamp()
        });
        console.log('Settings synced successfully');
    } catch (error) {
        console.error('Error syncing settings:', error);
        throw error;
    }
}

/**
 * Load settings from Firestore
 * @returns {Promise<Object>} Settings object
 */
export async function loadSettings() {
    if (!ENABLE_FIREBASE || !db || !getCurrentUser()) {
        return null;
    }
    
    try {
        const settingsRef = doc(db, getUserCollectionPath('data'), 'settings');
        const snapshot = await getDoc(settingsRef);
        return snapshot.exists() ? (snapshot.data().data || null) : null;
    } catch (error) {
        console.error('Error loading settings:', error);
        return null;
    }
}

/**
 * Sync all data to Firestore
 * @returns {Promise<void>}
 */
export async function syncAllData() {
    if (!ENABLE_FIREBASE || !db || !getCurrentUser()) {
        return;
    }
    
    try {
        // Load from localStorage
        const recipes = JSON.parse(localStorage.getItem('recipes') || '[]');
        const mealPlan = JSON.parse(localStorage.getItem('mealPlan') || '{}');
        const nutritionLogs = JSON.parse(localStorage.getItem('nutritionLogs') || '{}');
        const shoppingLists = JSON.parse(localStorage.getItem('shoppingLists') || '[]');
        const customIngredients = JSON.parse(localStorage.getItem('meale-custom-ingredients') || '[]');
        const settings = JSON.parse(localStorage.getItem('meale-settings') || 'null');
        
        // Sync all data
        await Promise.all([
            syncRecipes(recipes),
            syncMealPlan(mealPlan),
            syncNutritionLogs(nutritionLogs),
            syncShoppingLists(shoppingLists),
            syncCustomIngredients(customIngredients),
            settings && syncSettings(settings)
        ]);
        
        console.log('All data synced successfully');
    } catch (error) {
        console.error('Error syncing all data:', error);
        throw error;
    }
}

/**
 * Load all data from Firestore
 * @returns {Promise<Object>} Object containing all loaded data
 */
export async function loadAllData() {
    if (!ENABLE_FIREBASE || !db || !getCurrentUser()) {
        return null;
    }
    
    try {
        const [recipes, mealPlan, nutritionLogs, shoppingLists, customIngredients, settings] = await Promise.all([
            loadRecipes(),
            loadMealPlan(),
            loadNutritionLogs(),
            loadShoppingLists(),
            loadCustomIngredients(),
            loadSettings()
        ]);
        
        return {
            recipes,
            mealPlan,
            nutritionLogs,
            shoppingLists,
            customIngredients,
            settings
        };
    } catch (error) {
        console.error('Error loading all data:', error);
        return null;
    }
}

/**
 * Set up real-time listeners for data changes
 * @param {Function} callback - Callback function when data changes
 * @returns {Function} Unsubscribe function
 */
export function setupRealtimeListeners(callback) {
    if (!ENABLE_FIREBASE || !db || !getCurrentUser()) {
        return () => {};
    }
    
    const user = getCurrentUser();
    const unsubscribes = [];
    
    // Listen to recipes
    const recipesRef = collection(db, getUserCollectionPath('recipes'));
    unsubscribes.push(
        onSnapshot(recipesRef, (snapshot) => {
            const recipes = snapshot.docs.map(doc => doc.data());
            callback({ type: 'recipes', data: recipes });
        })
    );
    
    // Listen to meal plan
    const mealPlanRef = doc(db, getUserCollectionPath('data'), 'mealPlan');
    unsubscribes.push(
        onSnapshot(mealPlanRef, (snapshot) => {
            if (snapshot.exists()) {
                callback({ type: 'mealPlan', data: snapshot.data().data || {} });
            }
        })
    );
    
    // Listen to nutrition logs
    const nutritionRef = doc(db, getUserCollectionPath('data'), 'nutritionLogs');
    unsubscribes.push(
        onSnapshot(nutritionRef, (snapshot) => {
            if (snapshot.exists()) {
                callback({ type: 'nutritionLogs', data: snapshot.data().data || {} });
            }
        })
    );
    
    // Listen to shopping lists
    const listsRef = collection(db, getUserCollectionPath('shoppingLists'));
    unsubscribes.push(
        onSnapshot(listsRef, (snapshot) => {
            const shoppingLists = snapshot.docs.map(doc => doc.data());
            callback({ type: 'shoppingLists', data: shoppingLists });
        })
    );
    
    // Listen to custom ingredients
    const ingredientsRef = collection(db, getUserCollectionPath('customIngredients'));
    unsubscribes.push(
        onSnapshot(ingredientsRef, (snapshot) => {
            const customIngredients = snapshot.docs.map(doc => doc.data());
            callback({ type: 'customIngredients', data: customIngredients });
        })
    );
    
    // Listen to settings
    const settingsRef = doc(db, getUserCollectionPath('data'), 'settings');
    unsubscribes.push(
        onSnapshot(settingsRef, (snapshot) => {
            if (snapshot.exists()) {
                callback({ type: 'settings', data: snapshot.data().data || null });
            }
        })
    );
    
    // Return unsubscribe function
    return () => {
        unsubscribes.forEach(unsub => unsub());
    };
}


