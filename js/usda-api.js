// USDA FoodData Central API Service
import config from './config.js';

/**
 * Search for foods using USDA FoodData Central API
 * @param {string} query - Search query
 * @param {number} pageSize - Number of results to return (max 200)
 * @returns {Promise<Array>} Array of food results
 */
export async function searchUSDAFoods(query, pageSize = 20) {
    if (!query || query.trim().length < 2) {
        return [];
    }

    try {
        const searchParams = new URLSearchParams({
            query: query.trim(),
            pageSize: Math.min(pageSize, 200),
            dataType: 'Foundation,SR Legacy', // Foundation foods and Standard Reference Legacy
            sortBy: 'dataType.keyword',
            sortOrder: 'asc'
        });

        // Add API key if provided (optional for basic use)
        if (config.usda.apiKey) {
            searchParams.append('api_key', config.usda.apiKey);
        }

        const url = `${config.usda.baseUrl}${config.usda.searchEndpoint}?${searchParams.toString()}`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`USDA API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data.foods || [];
    } catch (error) {
        console.error('Error searching USDA foods:', error);
        // Return empty array on error so app continues to work
        return [];
    }
}

/**
 * Get detailed food information by FDC ID
 * @param {number} fdcId - FoodData Central ID
 * @returns {Promise<Object|null>} Food details or null
 */
export async function getUSDAFoodDetails(fdcId) {
    if (!fdcId) {
        return null;
    }

    try {
        const searchParams = new URLSearchParams();
        if (config.usda.apiKey) {
            searchParams.append('api_key', config.usda.apiKey);
        }

        const url = `${config.usda.baseUrl}${config.usda.detailsEndpoint}/${fdcId}?${searchParams.toString()}`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`USDA API error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching USDA food details:', error);
        return null;
    }
}

/**
 * Extract nutrition data from USDA food object
 * @param {Object} food - USDA food object
 * @returns {Object} Nutrition data per 100g
 */
export function extractUSDANutrition(food) {
    if (!food || !food.foodNutrients) {
        return {
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0
        };
    }

    // Helper to find nutrient by nutrient ID
    const findNutrient = (nutrientId) => {
        const nutrient = food.foodNutrients.find(n => n.nutrientId === nutrientId || n.nutrient?.id === nutrientId);
        return nutrient?.amount || 0;
    };

    // USDA Nutrient IDs:
    // 1008 = Energy (kcal)
    // 1003 = Protein
    // 1005 = Carbohydrate, by difference
    // 1004 = Total lipid (fat)
    
    const calories = findNutrient(1008);
    const protein = findNutrient(1003);
    const carbs = findNutrient(1005);
    const fat = findNutrient(1004);

    // Convert to per-gram values (USDA data is typically per 100g)
    const servingSize = 100; // USDA data is per 100g
    
    return {
        calories: calories / servingSize,
        protein: protein / servingSize,
        carbs: carbs / servingSize,
        fat: fat / servingSize
    };
}

/**
 * Convert USDA food result to app format
 * @param {Object} food - USDA food object
 * @returns {Object} Formatted ingredient object
 */
export function formatUSDAFood(food) {
    const nutrition = extractUSDANutrition(food);
    const description = food.description || food.lowercaseDescription || 'Unknown food';
    const brandOwner = food.brandOwner || food.brandName || 'USDA';
    const dataType = food.dataType || 'Unknown';
    
    return {
        id: food.fdcId,
        fdcId: food.fdcId,
        name: description,
        source: 'usda',
        nutrition: nutrition,
        servingSize: 100, // USDA data is per 100g
        brandOwner: brandOwner,
        dataType: dataType,
        storeSection: '', // USDA doesn't provide store sections
        emoji: '' // USDA doesn't provide emojis
    };
}

/**
 * Search USDA foods and return formatted results
 * @param {string} query - Search query
 * @param {number} maxResults - Maximum number of results
 * @returns {Promise<Array>} Array of formatted ingredient objects
 */
export async function searchUSDAIngredients(query, maxResults = 10) {
    try {
        const foods = await searchUSDAFoods(query, maxResults);
        return foods.map(formatUSDAFood);
    } catch (error) {
        console.error('Error searching USDA ingredients:', error);
        return [];
    }
}


