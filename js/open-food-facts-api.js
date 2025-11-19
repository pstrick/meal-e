// Open Food Facts API Service
// Free, open database of food products with barcode and nutrition data
// Documentation: https://world.openfoodfacts.org/data

/**
 * Search for foods using Open Food Facts API
 * @param {string} query - Search query (product name, brand, etc.)
 * @param {number} pageSize - Number of results to return (max 20 per page)
 * @returns {Promise<Array>} Array of food results
 */
export async function searchOpenFoodFacts(query, pageSize = 20) {
    if (!query || query.trim().length < 2) {
        console.log('Open Food Facts search skipped: query too short');
        return [];
    }

    try {
        // Open Food Facts search endpoint
        // Documentation: https://world.openfoodfacts.org/data
        // Search by product name using the search_terms parameter
        const searchParams = new URLSearchParams({
            action: 'process',
            search_terms: query.trim(),
            page_size: Math.min(pageSize, 20), // Open Food Facts limits to 20 per page
            json: '1',
            fields: 'code,product_name,brands,quantity,nutriments,serving_size,nutrition_grade_fr,image_url,image_small_url'
        });

        const url = `https://world.openfoodfacts.org/cgi/search.pl?${searchParams.toString()}`;
        console.log('Open Food Facts API URL:', url);
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'Meal-E App - https://github.com/pstrick/meal-e'
            }
        });
        console.log('Open Food Facts API response status:', response.status, response.statusText);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Open Food Facts API error response:', errorText);
            throw new Error(`Open Food Facts API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Open Food Facts API response data:', {
            count: data.count,
            page: data.page,
            page_size: data.page_size,
            productsCount: data.products ? data.products.length : 0,
            hasProducts: !!data.products
        });
        
        const products = data.products || [];
        
        // Filter out products with no name (invalid products)
        const validProducts = products.filter(p => p.product_name || p.product_name_en || p.product_name_fr);
        console.log('Open Food Facts API returning', validProducts.length, 'valid products (filtered from', products.length, 'total)');
        
        if (validProducts.length === 0 && products.length > 0) {
            console.warn('All Open Food Facts products were filtered out (no product names)');
            console.log('Sample product structure:', products[0]);
        }
        
        return validProducts;
    } catch (error) {
        console.error('Error searching Open Food Facts:', error);
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
 * Extract nutrition data from Open Food Facts product
 * @param {Object} product - Open Food Facts product object
 * @returns {Object} Nutrition data per 100g
 */
export function extractOpenFoodFactsNutrition(product) {
    if (!product || !product.nutriments) {
        console.warn('extractOpenFoodFactsNutrition: No product or nutriments found', {
            hasProduct: !!product,
            hasNutriments: !!(product && product.nutriments)
        });
        return {
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0
        };
    }

    const nutriments = product.nutriments;
    
    // Open Food Facts provides values per 100g
    // Energy can be in different formats: energy-kcal_100g, energy-kcal, energy_100g (in kJ)
    // Try multiple field names to find the data
    let calories = nutriments['energy-kcal_100g'] || 
                   nutriments['energy-kcal'] || 
                   (nutriments['energy-kj_100g'] ? nutriments['energy-kj_100g'] / 4.184 : 0) || // Convert kJ to kcal
                   (nutriments['energy_100g'] ? nutriments['energy_100g'] / 4.184 : 0) || 0; // Convert kJ to kcal
    
    const protein = nutriments['proteins_100g'] || nutriments['proteins'] || nutriments['protein_100g'] || 0;
    const carbs = nutriments['carbohydrates_100g'] || nutriments['carbohydrates'] || nutriments['carbohydrate_100g'] || 0;
    const fat = nutriments['fat_100g'] || nutriments['fat'] || nutriments['total-fat_100g'] || 0;

    console.log('Extracted Open Food Facts nutrition (per 100g):', { calories, protein, carbs, fat });

    // Convert to per-gram values (Open Food Facts data is per 100g)
    const servingSize = 100;
    
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
 * Convert Open Food Facts product to app format
 * @param {Object} product - Open Food Facts product object
 * @returns {Object} Formatted ingredient object
 */
export function formatOpenFoodFactsProduct(product) {
    if (!product) {
        console.warn('formatOpenFoodFactsProduct received null/undefined product');
        return null;
    }
    
    console.log('Formatting Open Food Facts product:', {
        code: product.code,
        product_name: product.product_name,
        brands: product.brands,
        hasNutriments: !!product.nutriments,
        nutrimentsKeys: product.nutriments ? Object.keys(product.nutriments).slice(0, 10) : []
    });
    
    const nutrition = extractOpenFoodFactsNutrition(product);
    
    // Validate nutrition data
    if (!nutrition || 
        (nutrition.calories === 0 && nutrition.protein === 0 && nutrition.carbs === 0 && nutrition.fat === 0)) {
        console.warn('Open Food Facts product has no nutrition data:', {
            code: product.code,
            product_name: product.product_name,
            hasNutriments: !!product.nutriments,
            nutrimentsKeys: product.nutriments ? Object.keys(product.nutriments) : []
        });
        // Still return the product, but with zero nutrition (better than nothing)
    }
    
    const productName = product.product_name || product.product_name_en || product.product_name_fr || 'Unknown product';
    const brands = product.brands || product.brand || 'Unknown brand';
    const quantity = product.quantity || '';
    
    // Combine brand and product name
    const displayName = brands && brands !== 'Unknown brand' 
        ? `${productName} (${brands})` 
        : productName;
    
    if (!product.code) {
        console.warn('Open Food Facts product missing code:', product);
        return null;
    }
    
    const formatted = {
        id: product.code,
        fdcId: `off-${product.code}`, // Open Food Facts uses barcode as ID
        name: displayName,
        source: 'openfoodfacts',
        nutrition: {
            calories: nutrition.calories || 0,
            protein: nutrition.protein || 0,
            carbs: nutrition.carbs || 0,
            fat: nutrition.fat || 0
        },
        servingSize: 100, // Open Food Facts data is per 100g
        brandOwner: brands,
        quantity: quantity,
        barcode: product.code,
        imageUrl: product.image_url || product.image_small_url || '',
        nutritionGrade: product.nutrition_grade_fr || '',
        storeSection: '', // Open Food Facts doesn't provide store sections
        emoji: '' // Open Food Facts doesn't provide emojis
    };
    
    console.log('Formatted Open Food Facts product with nutrition:', {
        name: formatted.name,
        nutrition: formatted.nutrition,
        code: formatted.barcode
    });
    return formatted;
}

/**
 * Search Open Food Facts and return formatted results
 * @param {string} query - Search query
 * @param {number} maxResults - Maximum number of results
 * @returns {Promise<Array>} Array of formatted ingredient objects
 */
export async function searchOpenFoodFactsIngredients(query, maxResults = 10) {
    try {
        console.log('searchOpenFoodFactsIngredients called with query:', query, 'maxResults:', maxResults);
        const products = await searchOpenFoodFacts(query, maxResults);
        console.log('searchOpenFoodFacts returned', products.length, 'products');
        
        if (products.length === 0) {
            console.warn('No products returned from Open Food Facts API for query:', query);
            return [];
        }
        
        const formatted = products
            .map(formatOpenFoodFactsProduct)
            .filter(product => product !== null);
        console.log('Formatted', formatted.length, 'Open Food Facts ingredients (filtered out nulls)');
        return formatted;
    } catch (error) {
        console.error('Error searching Open Food Facts ingredients:', error);
        console.error('Error details:', {
            message: error.message,
            name: error.name,
            stack: error.stack
        });
        return [];
    }
}


