// Firebase Authentication Service
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateProfile
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { firebaseConfig, ENABLE_FIREBASE } from './firebase-config.js';
import { showAlert } from './alert.js';

let app = null;
let auth = null;
let currentUser = null;
let authStateListeners = [];

// Initialize Firebase if enabled
if (ENABLE_FIREBASE) {
    try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        
        // Listen for auth state changes
        onAuthStateChanged(auth, (user) => {
            currentUser = user;
            authStateListeners.forEach(listener => listener(user));
        });
        
        console.log('Firebase initialized successfully');
    } catch (error) {
        console.error('Error initializing Firebase:', error);
        showAlert('Firebase initialization failed. Please check your configuration.', { type: 'error' });
    }
}

/**
 * Register a listener for authentication state changes
 * @param {Function} callback - Function to call when auth state changes
 * @returns {Function} Unsubscribe function
 */
export function onAuthChange(callback) {
    if (!ENABLE_FIREBASE || !auth) {
        // If Firebase is disabled, call with null user
        callback(null);
        return () => {};
    }
    
    authStateListeners.push(callback);
    
    // Call immediately with current user
    if (currentUser !== undefined) {
        callback(currentUser);
    }
    
    // Return unsubscribe function
    return () => {
        authStateListeners = authStateListeners.filter(l => l !== callback);
    };
}

/**
 * Get the current authenticated user
 * @returns {Object|null} Current user or null
 */
export function getCurrentUser() {
    return currentUser;
}

/**
 * Check if user is authenticated
 * @returns {boolean}
 */
export function isAuthenticated() {
    return currentUser !== null;
}

/**
 * Sign up a new user
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {string} displayName - Optional display name
 * @returns {Promise<Object>} User object
 */
export async function signUp(email, password, displayName = null) {
    if (!ENABLE_FIREBASE || !auth) {
        throw new Error('Firebase is not enabled or initialized');
    }
    
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        
        // Update profile with display name if provided
        if (displayName && userCredential.user) {
            await updateProfile(userCredential.user, { displayName });
        }
        
        return userCredential.user;
    } catch (error) {
        console.error('Sign up error:', error);
        throw handleAuthError(error);
    }
}

/**
 * Sign in an existing user
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<Object>} User object
 */
export async function signIn(email, password) {
    if (!ENABLE_FIREBASE || !auth) {
        throw new Error('Firebase is not enabled or initialized');
    }
    
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return userCredential.user;
    } catch (error) {
        console.error('Sign in error:', error);
        throw handleAuthError(error);
    }
}

/**
 * Sign out the current user
 * @returns {Promise<void>}
 */
export async function signOutUser() {
    if (!ENABLE_FIREBASE || !auth) {
        return;
    }
    
    try {
        await signOut(auth);
    } catch (error) {
        console.error('Sign out error:', error);
        throw handleAuthError(error);
    }
}

/**
 * Handle Firebase auth errors and return user-friendly messages
 * @param {Error} error - Firebase error
 * @returns {Error} User-friendly error
 */
function handleAuthError(error) {
    const errorMessages = {
        'auth/email-already-in-use': 'This email is already registered. Please sign in instead.',
        'auth/invalid-email': 'Please enter a valid email address.',
        'auth/operation-not-allowed': 'Email/password accounts are not enabled. Please contact support.',
        'auth/weak-password': 'Password should be at least 6 characters.',
        'auth/user-disabled': 'This account has been disabled.',
        'auth/user-not-found': 'No account found with this email.',
        'auth/wrong-password': 'Incorrect password. Please try again.',
        'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
        'auth/network-request-failed': 'Network error. Please check your connection.'
    };
    
    const message = errorMessages[error.code] || error.message || 'An authentication error occurred.';
    const friendlyError = new Error(message);
    friendlyError.code = error.code;
    return friendlyError;
}


