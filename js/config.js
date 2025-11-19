// App Configuration
const config = {
    // USDA FoodData Central API
    // Get your free API key at: https://fdc.nal.usda.gov/api-key-signup.html
    usda: {
        baseUrl: 'https://api.nal.usda.gov/fdc/v1',
        apiKey: 'Ehk6yKrcf6082fryJo96C35PpkTj2DHby4nqKfkQ', // USDA FoodData Central API key
        searchEndpoint: '/foods/search',
        detailsEndpoint: '/food'
    },
    // Open Food Facts API
    // Free, open database of food products with barcodes and nutrition data
    // No API key required - https://world.openfoodfacts.org/
    openFoodFacts: {
        baseUrl: 'https://world.openfoodfacts.org',
        searchEndpoint: '/cgi/search.pl',
        // No API key needed - completely free and open
    }
};

export default config; 