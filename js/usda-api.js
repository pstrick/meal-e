// USDA FoodData Central API Service
import config from './config.js';
import { getCachedResults, setCachedResults } from './food-cache.js';

/**
 * Search for foods using USDA FoodData Central API
 * @param {string} query - Search query
 * @param {number} pageSize - Number of results to return (max 200)
 * @returns {Promise<Array>} Array of food results
 */
export async function searchUSDAFoods(query, pageSize = 20) {
    if (!query || query.trim().length < 2) {
        console.log('USDA search skipped: query too short');
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
            console.log('Using USDA API key');
        } else {
            console.log('No USDA API key provided (using public access)');
        }

        const url = `${config.usda.baseUrl}${config.usda.searchEndpoint}?${searchParams.toString()}`;
        console.log('USDA API URL:', url);
        
        // Make fetch request with error handling for CORS and network issues
        let response;
        try {
            response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                // Note: CORS is handled by the server, we can't control it from here
            });
            console.log('USDA API response status:', response.status, response.statusText);
        } catch (fetchError) {
            // This catches network errors, CORS errors, etc.
            console.error('Fetch error (could be CORS or network):', fetchError);
            throw new Error(`Network error: ${fetchError.message}. This might be a CORS issue.`);
        }
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('USDA API error response:', errorText);
            
            // Handle specific error cases
            if (response.status === 403) {
                try {
                    const errorData = JSON.parse(errorText);
                    if (errorData.error && errorData.error.code === 'API_KEY_MISSING') {
                        throw new Error('USDA API key is required. Please get a free API key at https://fdc.nal.usda.gov/api-key-signup.html and add it to js/config.js');
                    }
                } catch (parseError) {
                    // If we can't parse the error, use the original error
                }
            }
            
            throw new Error(`USDA API error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        console.log('USDA API response data:', {
            totalHits: data.totalHits,
            currentPage: data.currentPage,
            totalPages: data.totalPages,
            foodsCount: data.foods ? data.foods.length : 0
        });
        
        const foods = data.foods || [];
        console.log('USDA API returning', foods.length, 'foods');
        return foods;
    } catch (error) {
        console.error('Error searching USDA foods:', error);
        console.error('Error details:', {
            message: error.message,
            name: error.name,
            stack: error.stack
        });
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
        console.warn('extractUSDANutrition: No food or foodNutrients found', { 
            hasFood: !!food, 
            hasFoodNutrients: !!(food && food.foodNutrients),
            foodNutrientsCount: food?.foodNutrients?.length || 0
        });
        return {
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0
        };
    }

    // Helper to find nutrient by nutrient ID
    const findNutrient = (nutrientId) => {
        const nutrient = food.foodNutrients.find(n => 
            n.nutrientId === nutrientId || 
            n.nutrient?.id === nutrientId ||
            n.nutrientId === nutrientId.toString() ||
            n.nutrient?.id === nutrientId.toString()
        );
        const amount = nutrient?.amount || 0;
        if (amount > 0) {
            console.log(`Found nutrient ${nutrientId}:`, amount);
        }
        return amount;
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

    console.log('Extracted USDA nutrition (per 100g):', { calories, protein, carbs, fat });

    // Convert to per-gram values (USDA data is typically per 100g)
    const servingSize = 100; // USDA data is per 100g
    
    const perGramNutrition = {
        calories: calories / servingSize,
        protein: protein / servingSize,
        carbs: carbs / servingSize,
        fat: fat / servingSize
    };
    
    console.log('Converted to per-gram nutrition:', perGramNutrition);
    
    return perGramNutrition;
}

/**
 * Convert USDA food result to app format
 * @param {Object} food - USDA food object
 * @returns {Object} Formatted ingredient object
 */
export function formatUSDAFood(food) {
    if (!food) {
        console.warn('formatUSDAFood received null/undefined food');
        return null;
    }
    
    console.log('Formatting USDA food:', {
        fdcId: food.fdcId,
        description: food.description,
        hasFoodNutrients: !!food.foodNutrients,
        foodNutrientsCount: food.foodNutrients ? food.foodNutrients.length : 0
    });
    
    const nutrition = extractUSDANutrition(food);
    
    // Validate nutrition data
    if (!nutrition || 
        (nutrition.calories === 0 && nutrition.protein === 0 && nutrition.carbs === 0 && nutrition.fat === 0)) {
        console.warn('USDA food has no nutrition data:', {
            fdcId: food.fdcId,
            description: food.description,
            hasFoodNutrients: !!food.foodNutrients,
            foodNutrientsCount: food.foodNutrients?.length || 0
        });
        // Still return the food, but with zero nutrition (better than nothing)
    }
    
    const description = food.description || food.lowercaseDescription || food.brandedFoodCategory || 'Unknown food';
    const brandOwner = food.brandOwner || food.brandName || food.brandedFoodCategory || 'USDA';
    const dataType = food.dataType || 'Unknown';
    
    if (!food.fdcId) {
        console.warn('USDA food missing fdcId:', food);
        return null;
    }
    
    const formatted = {
        id: food.fdcId,
        fdcId: food.fdcId,
        name: description,
        source: 'usda',
        nutrition: {
            calories: nutrition.calories || 0,
            protein: nutrition.protein || 0,
            carbs: nutrition.carbs || 0,
            fat: nutrition.fat || 0
        },
        servingSize: 100, // USDA data is per 100g
        brandOwner: brandOwner,
        dataType: dataType,
        storeSection: '', // USDA doesn't provide store sections
        emoji: '' // USDA doesn't provide emojis
    };
    
    console.log('Formatted USDA food with nutrition:', {
        name: formatted.name,
        nutrition: formatted.nutrition,
        fdcId: formatted.fdcId
    });
    return formatted;
}

/**
 * Search USDA foods and return formatted results
 * @param {string} query - Search query
 * @param {number} maxResults - Maximum number of results
 * @returns {Promise<Array>} Array of formatted ingredient objects
 */
export async function searchUSDAIngredients(query, maxResults = 10) {
    try {
        console.log('searchUSDAIngredients called with query:', query, 'maxResults:', maxResults);
        
        // Check cache first
        const cachedResults = await getCachedResults(query, 'usda', maxResults);
        if (cachedResults !== null) {
            console.log('Returning cached USDA results:', cachedResults.length, 'items');
            return cachedResults;
        }
        
        // Cache miss - make API call
        console.log('Cache miss for USDA query:', query, '- making API call');
        const foods = await searchUSDAFoods(query, maxResults);
        console.log('searchUSDAFoods returned', foods.length, 'foods');
        
        if (foods.length === 0) {
            console.warn('No foods returned from USDA API for query:', query);
            return [];
        }
        
        const formatted = foods.map(formatUSDAFood).filter(food => food !== null);
        console.log('Formatted', formatted.length, 'USDA ingredients (filtered out nulls)');
        
        // Cache the results for future use
        await setCachedResults(query, 'usda', formatted, maxResults);
        
        return formatted;
    } catch (error) {
        console.error('Error searching USDA ingredients:', error);
        console.error('Error details:', {
            message: error.message,
            name: error.name,
            stack: error.stack
        });
        return [];
    }
}


