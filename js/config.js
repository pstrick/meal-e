// App Configuration
const config = {
    // USDA FoodData Central API
    usda: {
        baseUrl: 'https://api.nal.usda.gov/fdc/v1',
        apiKey: null, // API key is optional for basic searches (up to 1000 requests/day)
        searchEndpoint: '/foods/search',
        detailsEndpoint: '/food'
    }
};

export default config; 