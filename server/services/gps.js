// CoalGuard GPS Verification Service

// Earth's radius in meters
const EARTH_RADIUS = 6371000;

/**
 * Convert degrees to radians
 */
function toRadians(degrees) {
    return degrees * (Math.PI / 180);
}

/**
 * Calculate distance between two GPS coordinates
 * using the Haversine formula.
 *
 * @param {number} lat1 Inspector latitude
 * @param {number} lon1 Inspector longitude
 * @param {number} lat2 Registered location latitude
 * @param {number} lon2 Registered location longitude
 * @returns {number} Distance in meters
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const latDifference = toRadians(lat2 - lat1);
    const lonDifference = toRadians(lon2 - lon1);

    const a =
        Math.sin(latDifference / 2) ** 2 +
        Math.cos(toRadians(lat1)) *
        Math.cos(toRadians(lat2)) *
        Math.sin(lonDifference / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return EARTH_RADIUS * c;
}

/**
 * Check whether an inspector is within
 * the allowed 30-meter radius.
 */
function verifyLocation(
    inspectorLatitude,
    inspectorLongitude,
    locationLatitude,
    locationLongitude
) {
    const distance = calculateDistance(
        inspectorLatitude,
        inspectorLongitude,
        locationLatitude,
        locationLongitude
    );

    const MAX_DISTANCE = 30;

    return {
        verified: distance <= MAX_DISTANCE,
        distance: Number(distance.toFixed(2)),
        allowedDistance: MAX_DISTANCE
    };
}

module.exports = {
    calculateDistance,
    verifyLocation
};