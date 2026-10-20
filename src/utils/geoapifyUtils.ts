/**
 * Geoapify API Utility
 * Manages Geoapify API configuration and requests
 */

interface GeoapifyConfig {
    id: number;
    api_name: string;
    api_key: string;
    base_url: string;
    status: string;
    description: string;
    config_data: {
        max_requests_per_day: number;
        location_accuracy: string;
        enable_address_lookup: boolean;
        enable_reverse_geocoding: boolean;
    };
    created_at: string;
    updated_at: string;
}

interface GeocodeResult {
    lat: number;
    lon: number;
    address: string;
}

interface ReverseGeocodeResult {
    address: string;
    city?: string;
    state?: string;
    country?: string;
    postal_code?: string;
}

const API_CONFIG_ENDPOINT = 'http://localhost/cims/api_config.php';

/**
 * Fetch Geoapify API key from database
 */
export async function getGeoapifyConfig(): Promise<GeoapifyConfig | null> {
    try {
        const response = await fetch(
            `${API_CONFIG_ENDPOINT}?action=get&api_name=geoapify`
        );

        if (!response.ok) {
            console.error('Failed to fetch Geoapify config:', response.status);
            return null;
        }

        const data = await response.json();
        return data.success ? data.data : null;
    } catch (error) {
        console.error('Error fetching Geoapify config:', error);
        return null;
    }
}

/**
 * Forward geocoding - Convert address to coordinates
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
    try {
        const config = await getGeoapifyConfig();
        if (!config || !config.api_key) {
            console.error('Geoapify API key not configured');
            return null;
        }

        const params = new URLSearchParams({
            text: address,
            apiKey: config.api_key,
        });

        const response = await fetch(
            `${config.base_url}/v1/geocode/search?${params}`
        );

        if (!response.ok) {
            console.error('Geocoding failed:', response.status);
            return null;
        }

        const data = await response.json();
        
        if (data.features && data.features.length > 0) {
            const feature = data.features[0];
            return {
                lat: feature.geometry.coordinates[1],
                lon: feature.geometry.coordinates[0],
                address: feature.properties.formatted,
            };
        }

        return null;
    } catch (error) {
        console.error('Error geocoding address:', error);
        return null;
    }
}

/**
 * Reverse geocoding - Convert coordinates to address
 */
export async function reverseGeocode(
    lat: number,
    lon: number
): Promise<ReverseGeocodeResult | null> {
    try {
        const config = await getGeoapifyConfig();
        if (!config || !config.api_key) {
            console.error('Geoapify API key not configured');
            return null;
        }

        const params = new URLSearchParams({
            lat: lat.toString(),
            lon: lon.toString(),
            apiKey: config.api_key,
        });

        const response = await fetch(
            `${config.base_url}/v1/geocode/reverse?${params}`
        );

        if (!response.ok) {
            console.error('Reverse geocoding failed:', response.status);
            return null;
        }

        const data = await response.json();
        
        if (data.features && data.features.length > 0) {
            const properties = data.features[0].properties;
            return {
                address: properties.formatted,
                city: properties.city,
                state: properties.state,
                country: properties.country,
                postal_code: properties.postcode,
            };
        }

        return null;
    } catch (error) {
        console.error('Error reverse geocoding:', error);
        return null;
    }
}

/**
 * Get distance matrix between points
 */
export async function getDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): Promise<number | null> {
    try {
        // Simple haversine formula for distance calculation
        // For more accurate results, use Geoapify's routing API
        const R = 6371; // Earth's radius in km

        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;

        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((lat1 * Math.PI) / 180) *
                Math.cos((lat2 * Math.PI) / 180) *
                Math.sin(dLon / 2) *
                Math.sin(dLon / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // Distance in km
    } catch (error) {
        console.error('Error calculating distance:', error);
        return null;
    }
}

/**
 * Validate Geoapify API configuration
 */
export async function validateGeoapifyConfig(): Promise<boolean> {
    try {
        const config = await getGeoapifyConfig();
        if (!config) {
            console.warn('Geoapify configuration not found in database');
            return false;
        }

        if (config.api_key === 'YOUR_GEOAPIFY_API_KEY_HERE') {
            console.warn('Geoapify API key not set - using placeholder value');
            return false;
        }

        return true;
    } catch (error) {
        console.error('Error validating Geoapify config:', error);
        return false;
    }
}

export default {
    getGeoapifyConfig,
    geocodeAddress,
    reverseGeocode,
    getDistance,
    validateGeoapifyConfig,
};
