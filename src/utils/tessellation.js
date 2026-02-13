
import { Delaunay } from 'd3-delaunay';

/**
 * Generates a set of random points within bounds.
 * @param {number} width 
 * @param {number} height 
 * @param {number} count 
 * @returns {Array<[number, number]>}
 */
export const generateRandomPoints = (width, height, count) => {
    return Array.from({ length: count }, () => [
        Math.random() * width,
        Math.random() * height
    ]);
};

/**
 * Computes the Voronoi diagram from a set of points.
 * @param {Array<[number, number]>} points 
 * @param {number} width 
 * @param {number} height 
 * @returns {Voronoi}
 */
export const computeVoronoi = (points, width, height) => {
    const delaunay = Delaunay.from(points);
    return delaunay.voronoi([0, 0, width, height]);
};

/**
 * Performs one iteration of Lloyd's relaxation to stipple the image.
 * Moves points towards the centroid of their Voronoi cell, weighted by pixel brightness.
 * @param {Voronoi} voronoi 
 * @param {Uint8ClampedArray} pixelData 
 * @param {number} width 
 * @param {number} height 
 * @returns {Array<[number, number]>} New points
 */
export const relaxPoints = (voronoi, pixelData, width, height) => {
    const points = [];
    const siteCount = voronoi.delaunay.points.length / 2;

    for (let i = 0; i < siteCount; i++) {
        const polygon = voronoi.cellPolygon(i);
        if (!polygon) continue;

        let xSum = 0;
        let ySum = 0;
        let weightSum = 0;

        // Simple bounding box for the polygon to sample pixels
        let minX = width, maxX = 0, minY = height, maxY = 0;
        for (const [px, py] of polygon) {
            if (px < minX) minX = px;
            if (px > maxX) maxX = px;
            if (py < minY) minY = py;
            if (py > maxY) maxY = py;
        }

        minX = Math.floor(Math.max(0, minX));
        maxX = Math.ceil(Math.min(width - 1, maxX));
        minY = Math.floor(Math.max(0, minY));
        maxY = Math.ceil(Math.min(height - 1, maxY));

        // Iterate over pixels in the bounding box
        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                if (voronoi.contains(i, x, y)) { // Precise check if pixel is in cell
                    const idx = (y * width + x) * 4;
                    // Invert brightness: darker pixels = higher weight (more dots)
                    // Or standard: brighter = higher weight. 
                    // For stippling (drawing black dots on white), we usually want more points in dark areas.
                    // So weight = 1 - brightness.
                    const r = pixelData[idx];
                    const g = pixelData[idx + 1];
                    const b = pixelData[idx + 2];
                    const brightness = (r + g + b) / (3 * 255);
                    const weight = 1 - brightness;

                    xSum += x * weight;
                    ySum += y * weight;
                    weightSum += weight;
                }
            }
        }

        if (weightSum > 0) {
            points.push([xSum / weightSum, ySum / weightSum]);
        } else {
            // If no weight, keep original position (or could randomize)
            points.push([voronoi.delaunay.points[i * 2], voronoi.delaunay.points[i * 2 + 1]]);
        }
    }
    return points;
};

/**
 * Determines which image index to use for a given cell based on a pattern.
 * @param {number} col Column index (or general X rough coordinate converted to index)
 * @param {number} row Row index (or general Y rough coordinate converted to index)
 * @param {string} pattern 'checkerboard', 'rows', 'cols', 'random', 'single'
 * @param {number} imageCount 
 * @returns {number} Image index
 */
export const getAlternationIndex = (col, row, pattern, imageCount) => {
    if (imageCount <= 1) return 0;

    const safeMod = (n, m) => ((n % m) + m) % m;

    switch (pattern) {
        case 'checkerboard':
            return safeMod(col + row, imageCount);
        case 'rows':
            return safeMod(row, imageCount);
        case 'cols':
            return safeMod(col, imageCount);
        case 'random':
            // Simple hash for deterministic "random" based on position
            return Math.abs(Math.floor(Math.sin(col * 12.9898 + row * 78.233) * 43758.5453)) % imageCount;
        case 'sequence':
            // TBD: Sequential filling?
            return safeMod(col + row * 10, imageCount);
        default:
            return 0;
    }
};
